import { createServerFn } from "@tanstack/react-start"
import {
  db,
  payments,
  paymentSchedule,
  loans,
  contacts,
  commissions,
  agents,
  commissionSettings,
  penalties,
  lenderSettings,
} from "@/lib/db"
import { eq, desc, and, sql, lte, gte, ne } from "drizzle-orm"
import { requireAuth } from "./session"
import { assertTransition } from "./loans"
import { createAuditLogger } from "./audit"
import { z } from "zod"
import { parseCommissionConfig, calculateTierCommission } from "@/lib/constants/commission-defaults"
import { getEffectivePenaltyConfig, calendarDaysOverdue } from "@/lib/constants/penalty-defaults"
import { ensurePendingPenalties } from "./penalty-generation"
import { revertPenaltyCore } from "./penalties"
import { parseLenderConfig } from "@/lib/constants/lender-defaults"
import { sendEmail, paymentReceiptEmail } from "@/lib/email"

// Validation schemas
const recordPaymentSchema = z.object({
  loanId: z.string().min(1),
  scheduleItemId: z.string().min(1, "Schedule item is required"),
  amount: z.number().positive(),
  method: z.enum(["cash", "gcash", "maya", "bank"]),
  paidAt: z.string().optional()
    .transform((s) => {
      if (!s) return undefined
      // Date-only strings ("2026-02-16") parse as midnight UTC which shows as
      // 8:00 AM in PHT. Attach current time so the timestamp reflects actual time.
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const now = new Date()
        const [y, m, d] = s.split("-").map(Number)
        return new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds())
      }
      return new Date(s)
    })
    .refine((d) => !d || d <= new Date(), "Payment date cannot be in the future"),
  notes: z.string().optional(),
})

// Server functions
export const getPayments = createServerFn().handler(async () => {
  const session = await requireAuth()

  const result = await db
    .select({
      id: payments.id,
      amount: payments.amount,
      method: payments.method,
      type: payments.type,
      reversesPaymentId: payments.reversesPaymentId,
      paidAt: payments.paidAt,
      notes: payments.notes,
      loanId: loans.id,
      contactName: contacts.name,
      principal: loans.principal,
      scheduleItemId: payments.scheduleItemId,
      penaltyId: payments.penaltyId,
      reversedAt: payments.reversedAt,
      reversalReason: payments.reversalReason,
      createdAt: payments.createdAt,
      scheduleDueDate: paymentSchedule.dueDate,
      scheduleAmount: paymentSchedule.amount,
    })
    .from(payments)
    .innerJoin(loans, eq(payments.loanId, loans.id))
    .innerJoin(contacts, eq(loans.contactId, contacts.id))
    .leftJoin(paymentSchedule, eq(payments.scheduleItemId, paymentSchedule.id))
    .where(eq(loans.lenderId, session.user.id))
    .orderBy(desc(payments.paidAt), desc(payments.createdAt))
    .limit(100)

  return result.map((p) => ({
    ...p,
    paidAt: p.paidAt.toISOString(),
    reversedAt: p.reversedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    scheduleDueDate: p.scheduleDueDate?.toISOString() ?? null,
  }))
})

export const getUpcomingPayments = createServerFn().handler(async () => {
  const session = await requireAuth()
  const now = new Date()
  const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const result = await db
    .select({
      id: paymentSchedule.id,
      dueDate: paymentSchedule.dueDate,
      amount: paymentSchedule.amount,
      status: paymentSchedule.status,
      paidAmount: paymentSchedule.paidAmount,
      loanId: loans.id,
      loanPenaltyConfig: loans.penaltyConfig,
      contactName: contacts.name,
      contactId: contacts.id,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .innerJoin(contacts, eq(loans.contactId, contacts.id))
    .where(
      and(
        eq(loans.lenderId, session.user.id),
        ne(paymentSchedule.status, "paid"),
        lte(paymentSchedule.dueDate, next30Days)
      )
    )
    .orderBy(paymentSchedule.dueDate)

  const overdueIds = result.filter((r) => r.status === "overdue").map((r) => r.id)
  let penaltyMap: Record<string, { id: string; penaltyType: string; amount: string; status: string }[]> = {}

  if (overdueIds.length > 0) {
    const penaltyRows = await db.query.penalties.findMany({
      where: sql`${penalties.scheduleItemId} IN ${overdueIds}`,
    })
    for (const p of penaltyRows) {
      if (!penaltyMap[p.scheduleItemId]) penaltyMap[p.scheduleItemId] = []
      penaltyMap[p.scheduleItemId].push({
        id: p.id,
        penaltyType: p.penaltyType,
        amount: p.amount,
        status: p.status,
      })
    }
  }

  return result.map((p) => {
    const daysOverdue = p.status === "overdue" ? calendarDaysOverdue(p.dueDate, now) : 0
    // How many days until late fee applies (0 = already applies, -1 = penalties disabled)
    const penaltyConfig = getEffectivePenaltyConfig(p.loanPenaltyConfig)
    let penaltyIn = -1
    if (penaltyConfig.enabled && penaltyConfig.lateFee.enabled && p.status === "overdue") {
      const remaining = penaltyConfig.gracePeriodDays - daysOverdue
      penaltyIn = Math.max(0, remaining)
    }

    return {
      ...p,
      loanPenaltyConfig: undefined,
      dueDate: p.dueDate.toISOString(),
      penalties: penaltyMap[p.id] ?? [],
      daysOverdue,
      penaltyIn,
    }
  })
})

export const getMonthlyPaymentStats = createServerFn().handler(async () => {
  const session = await requireAuth()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const result = await db
    .select({
      expectedAmount: sql<string>`COALESCE(SUM(${paymentSchedule.amount}), '0')`,
      expectedCount: sql<number>`COUNT(*)::int`,
      collectedAmount: sql<string>`COALESCE(SUM(CASE WHEN ${paymentSchedule.status} = 'paid' THEN ${paymentSchedule.amount} ELSE ${paymentSchedule.paidAmount} END), '0')`,
      collectedCount: sql<number>`COUNT(*) FILTER (WHERE ${paymentSchedule.status} = 'paid')::int`,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .where(
      and(
        eq(loans.lenderId, session.user.id),
        gte(paymentSchedule.dueDate, monthStart),
        lte(paymentSchedule.dueDate, monthEnd)
      )
    )

  const row = result[0]
  const expected = parseFloat(row?.expectedAmount ?? "0")
  const collected = parseFloat(row?.collectedAmount ?? "0")
  const collectionRate = expected > 0 ? Math.round((collected / expected) * 100) : 0

  return {
    expectedAmount: expected,
    expectedCount: row?.expectedCount ?? 0,
    collectedAmount: collected,
    collectedCount: row?.collectedCount ?? 0,
    collectionRate,
  }
})

export const recordPayment = createServerFn()
  .inputValidator(recordPaymentSchema)
  .handler(async ({ data }) => {
  const session = await requireAuth()

  // Get the loan
  const loan = await db.query.loans.findFirst({
    where: eq(loans.id, data.loanId),
    with: {
      assignedAgent: true,
      contact: true,
    },
  })

  if (!loan) {
    throw new Error("Loan not found")
  }

  // Check if user is lender or assigned agent
  const isLender = loan.lenderId === session.user.id
  const isAssignedAgent = loan.assignedAgent?.agentUserId === session.user.id

  if (!isLender && !isAssignedAgent) {
    throw new Error("Loan not found")
  }

  // Check if agent has permission to record payments
  if (isAssignedAgent && loan.assignedAgent) {
    // Need to check canRecordPayments from the full agent record
    const agentRecord = await db.query.agents.findFirst({
      where: eq(agents.id, loan.assignedAgent.id),
    })
    if (agentRecord && !agentRecord.canRecordPayments) {
      throw new Error("You do not have permission to record payments")
    }
  }

  if (loan.status !== "active") {
    throw new Error("Loan is not active")
  }

  // Pre-generate payment ID for use in batch
  const paymentId = crypto.randomUUID()

  // Validate schedule item exists before any writes
  const scheduleItem = await db.query.paymentSchedule.findFirst({
    where: eq(paymentSchedule.id, data.scheduleItemId),
  })

  if (!scheduleItem) {
    throw new Error("Schedule item not found")
  }

  // Check if user is an agent (use assigned agent record if available)
  let agentId: string | null = null
  let agentRecord = null

  if (isAssignedAgent && loan.assignedAgent) {
    agentId = loan.assignedAgent.id
    agentRecord = loan.assignedAgent
  } else {
    // Check if lender is also acting as agent for another lender (edge case)
    const foundAgent = await db.query.agents.findFirst({
      where: and(
        eq(agents.agentUserId, session.user.id),
        eq(agents.lenderId, loan.lenderId),
        eq(agents.status, "active")
      ),
    })
    if (foundAgent) {
      agentId = foundAgent.id
      agentRecord = foundAgent
    }
  }

  // Check for duplicate payment (same loan, schedule item, amount within 60s, not reversed)
  const recentDuplicate = await db.query.payments.findFirst({
    where: and(
      eq(payments.loanId, data.loanId),
      eq(payments.scheduleItemId, data.scheduleItemId),
      eq(payments.type, "credit"),
      eq(payments.amount, data.amount.toFixed(2)),
      sql`${payments.createdAt} > NOW() - INTERVAL '60 seconds'`,
      sql`${payments.reversedAt} IS NULL`
    ),
  })
  if (recentDuplicate) {
    throw new Error("This payment was already recorded. Please wait before retrying.")
  }

  // Reject overpayment (loan-level)
  const remainingBalance = parseFloat(loan.remainingBalance)
  if (data.amount > remainingBalance) {
    throw new Error(
      `Payment of ₱${data.amount.toFixed(2)} exceeds remaining balance of ₱${remainingBalance.toFixed(2)}`
    )
  }

  // Reject overpayment (installment-level — no cascade)
  const itemRemaining = parseFloat(scheduleItem.amount) - parseFloat(scheduleItem.paidAmount)
  if (data.amount > itemRemaining) {
    throw new Error(
      `Payment of ₱${data.amount.toFixed(2)} exceeds remaining balance of ₱${itemRemaining.toFixed(2)} for this installment`
    )
  }

  // Create payment record
  const paymentDate = data.paidAt || new Date()

  // Loan balance computations
  const newAmountPaid = parseFloat(loan.amountPaid) + data.amount
  const newRemainingBalance = parseFloat(loan.totalToRepay) - newAmountPaid
  // Tolerance of ₱0.05 handles floating-point rounding gaps across partial payments
  const isCompleted = newRemainingBalance <= 0.05
  const nextStatus = isCompleted ? "completed" : "active"

  // Validate status transition
  if (isCompleted) {
    assertTransition(loan.status, "completed")
  }

  // Interest portion
  const principal = parseFloat(loan.principal)
  const totalToRepay = parseFloat(loan.totalToRepay)
  const interestRatio = totalToRepay > 0 ? (totalToRepay - principal) / totalToRepay : 0
  const interestPortion = data.amount * interestRatio
  const newInterestEarned = parseFloat(loan.interestEarned) + interestPortion

  // Single schedule item update
  const newPaidAmount = parseFloat(scheduleItem.paidAmount) + data.amount
  const itemFullyPaid = newPaidAmount >= parseFloat(scheduleItem.amount)

  // Commission computation (read settings before batch)
  let commissionAmount: number | null = null
  let effectiveRate: string | null = null

  if (agentId && agentRecord) {
    const settingsRow = await db.query.commissionSettings.findFirst({
      where: eq(commissionSettings.lenderId, loan.lenderId),
    })
    const config = parseCommissionConfig(settingsRow?.config ?? null)
    const tierConfig = agentRecord.tier !== null
      ? config.tiers.find((t) => t.tier === agentRecord.tier)
      : null

    if (tierConfig) {
      commissionAmount = calculateTierCommission(tierConfig, data.amount)
      effectiveRate = data.amount > 0
        ? ((commissionAmount / data.amount) * 100).toFixed(2)
        : "0.00"
    } else {
      commissionAmount = data.amount * (parseFloat(agentRecord.commissionRate) / 100)
      effectiveRate = agentRecord.commissionRate
    }
  }

  // === Atomic write phase ===
  const writes: any[] = [
    db.insert(payments).values({
      id: paymentId,
      loanId: data.loanId,
      amount: data.amount.toFixed(2),
      method: data.method,
      type: "credit",
      scheduleItemId: data.scheduleItemId,
      recordedByAgentId: agentId,
      paidAt: paymentDate,
      notes: data.notes || null,
    }).returning(),
    db.update(loans).set({
      amountPaid: newAmountPaid.toFixed(2),
      interestEarned: newInterestEarned.toFixed(2),
      remainingBalance: Math.max(0, newRemainingBalance).toFixed(2),
      status: nextStatus,
      completedAt: isCompleted ? new Date() : null,
      updatedAt: new Date(),
    }).where(eq(loans.id, data.loanId)),
    db.update(paymentSchedule).set({
      paidAmount: newPaidAmount.toFixed(2),
      status: itemFullyPaid ? "paid" : "partial",
      paidAt: itemFullyPaid ? paymentDate : null,
    }).where(eq(paymentSchedule.id, data.scheduleItemId)),
  ]

  // When auto-completing, close any remaining schedule items so the schedule
  // doesn't show lingering "pending"/"partial" rows on a completed loan
  if (isCompleted) {
    writes.push(
      db.update(paymentSchedule).set({
        status: "paid",
        paidAmount: sql`${paymentSchedule.amount}`,
        paidAt: paymentDate,
      }).where(
        and(
          eq(paymentSchedule.loanId, data.loanId),
          ne(paymentSchedule.status, "paid"),
          ne(paymentSchedule.id, data.scheduleItemId), // already handled above
        )
      ),
    )
  }

  if (agentId && agentRecord && commissionAmount !== null && effectiveRate !== null) {
    writes.push(
      db.insert(commissions).values({
        agentId,
        paymentId,
        paymentAmount: data.amount.toFixed(2),
        commissionRate: effectiveRate,
        commissionAmount: commissionAmount.toFixed(2),
      }),
      db.update(agents).set({
        totalCollected: sql`${agents.totalCollected} + ${data.amount}`,
        totalCommissionEarned: sql`${agents.totalCommissionEarned} + ${commissionAmount}`,
      }).where(eq(agents.id, agentId)),
    )
  }

  const [[payment]] = await db.batch(writes as any)

  // Audit log (non-critical, outside batch)
  const log = createAuditLogger(session.user)
  log("payment.record", "payment", paymentId, {
    loanId: data.loanId,
    amount: data.amount,
    method: data.method,
    isAgent: !!agentId,
    loanCompleted: isCompleted,
  })

  // Fire-and-forget payment receipt email (opt-in per lender)
  const settingsRow = await db.query.lenderSettings.findFirst({
    where: eq(lenderSettings.lenderId, loan.lenderId),
  })
  const lenderConfig = parseLenderConfig(settingsRow?.config ?? null)
  if (lenderConfig.paymentReceiptsEnabled && loan.contact?.email) {
    const paidAtFormatted = paymentDate.toLocaleDateString("en-PH", {
      year: "numeric", month: "long", day: "numeric",
    })
    const { subject, html, text } = paymentReceiptEmail({
      borrowerName: loan.contact.name,
      lenderName: session.user.name,
      amount: data.amount.toFixed(2),
      method: data.method,
      paidAt: paidAtFormatted,
      remainingBalance: Math.max(0, newRemainingBalance).toFixed(2),
      loanReference: loan.id.slice(0, 8).toUpperCase(),
    })
    sendEmail({ to: loan.contact.email, subject, html, text }).catch(() => {})
  }

  return {
    ...payment,
    paidAt: payment.paidAt.toISOString(),
    createdAt: payment.createdAt.toISOString(),
  }
})

// Edit payment date
const editPaymentDateSchema = z.object({
  paymentId: z.string().min(1),
  paidAt: z.string()
    .transform((s) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const now = new Date()
        const [y, m, d] = s.split("-").map(Number)
        return new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds())
      }
      return new Date(s)
    })
    .refine((d) => d <= new Date(), "Payment date cannot be in the future"),
})

export const editPaymentDate = createServerFn()
  .inputValidator(editPaymentDateSchema)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const payment = await db.query.payments.findFirst({
      where: eq(payments.id, data.paymentId),
      with: { loan: true },
    })

    if (!payment) throw new Error("Payment not found")
    if (payment.loan.lenderId !== session.user.id) throw new Error("Payment not found")
    if (payment.reversedAt) throw new Error("Cannot edit a reversed payment")
    if (payment.type !== "credit") throw new Error("Cannot edit a reversal entry")

    const oldPaidAt = payment.paidAt

    // Update payment paidAt
    const writes: any[] = [
      db.update(payments).set({ paidAt: data.paidAt }).where(eq(payments.id, data.paymentId)),
    ]

    // Update schedule items that were fully paid by this payment
    const allocations = payment.cascadeAllocations as
      | { scheduleItemId: string; applied: number; prevPaidAmount: number }[]
      | null

    if (allocations && allocations.length > 0) {
      // Cascade payment: update all fully-paid schedule items
      for (const alloc of allocations) {
        const item = await db.query.paymentSchedule.findFirst({
          where: eq(paymentSchedule.id, alloc.scheduleItemId),
        })
        if (item && item.status === "paid") {
          writes.push(
            db.update(paymentSchedule).set({ paidAt: data.paidAt }).where(eq(paymentSchedule.id, alloc.scheduleItemId))
          )
        }
      }
    } else if (payment.scheduleItemId) {
      // Single schedule item
      const item = await db.query.paymentSchedule.findFirst({
        where: eq(paymentSchedule.id, payment.scheduleItemId),
      })
      if (item && item.status === "paid") {
        writes.push(
          db.update(paymentSchedule).set({ paidAt: data.paidAt }).where(eq(paymentSchedule.id, payment.scheduleItemId))
        )
      }
    }

    await Promise.all(writes)

    // Audit log
    const log = createAuditLogger(session.user)
    log("payment.edit_date", "payment", data.paymentId, {
      loanId: payment.loanId,
      oldPaidAt: oldPaidAt.toISOString(),
      newPaidAt: data.paidAt.toISOString(),
    })

    return { success: true }
  })

// Update overdue payments + generate penalties (called on dashboard load as fallback)
export const updateOverduePayments = createServerFn().handler(async () => {
  const session = await requireAuth()
  const now = new Date()

  // Mark pending schedule items as overdue
  await db
    .update(paymentSchedule)
    .set({ status: "overdue" })
    .where(
      and(eq(paymentSchedule.status, "pending"), lte(paymentSchedule.dueDate, now))
    )

  // Generate penalties — each loan's own snapshot config decides
  const activeLoans = await db.query.loans.findMany({
    where: and(
      eq(loans.lenderId, session.user.id),
      eq(loans.status, "active"),
    ),
    with: {
      schedule: true,
      penalties: true,
    },
  })

  for (const loan of activeLoans) {
    const config = getEffectivePenaltyConfig(loan.penaltyConfig)
    if (!config.enabled) continue
    await ensurePendingPenalties(loan, config, loan.penalties)
  }

  return { success: true }
})

// Reverse a payment (soft delete + undo side effects)
const reversePaymentSchema = z.object({
  paymentId: z.string().min(1),
  reason: z.string().min(1, "Reason is required"),
})

export const reversePayment = createServerFn()
  .inputValidator(reversePaymentSchema)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    // Load payment with loan and commission
    const payment = await db.query.payments.findFirst({
      where: eq(payments.id, data.paymentId),
      with: {
        loan: true,
        commission: true,
      },
    })

    if (!payment) {
      throw new Error("Payment not found")
    }

    // Only lender can reverse
    if (payment.loan.lenderId !== session.user.id) {
      throw new Error("Payment not found")
    }

    // Check not already reversed
    if (payment.reversedAt) {
      throw new Error("Payment has already been reversed")
    }

    // Penalty payments (penaltyId set, no scheduleItemId) can always be reversed
    const isPenaltyPayment = !!payment.penaltyId && !payment.scheduleItemId

    if (!isPenaltyPayment) {
      // Must have a schedule item to check "most recent" rule
      if (!payment.scheduleItemId) {
        throw new Error("Cannot reverse a payment without a schedule item")
      }

      // Check this is the most recent non-reversed credit payment for this schedule item
      const laterPayment = await db.query.payments.findFirst({
        where: and(
          eq(payments.scheduleItemId, payment.scheduleItemId),
          eq(payments.type, "credit"),
          sql`${payments.reversedAt} IS NULL`,
          sql`${payments.createdAt} > ${payment.createdAt}`
        ),
      })

      if (laterPayment) {
        throw new Error("Only the most recent payment for a schedule item can be reversed")
      }
    }

    const now = new Date()
    const paymentAmount = parseFloat(payment.amount)

    // === Penalty payment reversal (separate path) ===
    if (isPenaltyPayment) {
      // Revert penalty back to pending (this also soft-reverses the payment)
      await revertPenaltyCore(payment.penaltyId!, payment.loanId, session.user.id)

      // Insert debit (reversal) transaction into the ledger
      await db.insert(payments).values({
        id: crypto.randomUUID(),
        loanId: payment.loanId,
        penaltyId: payment.penaltyId,
        scheduleItemId: null,
        amount: payment.amount,
        method: payment.method,
        type: "debit",
        reversesPaymentId: data.paymentId,
        paidAt: now,
        notes: data.reason,
      })

      const log = createAuditLogger(session.user)
      log("payment.reverse", "payment", data.paymentId, {
        loanId: payment.loanId,
        amount: paymentAmount,
        reason: data.reason,
        isPenaltyPayment: true,
        penaltyId: payment.penaltyId,
      })

      return { success: true }
    }

    // === Regular payment reversal ===

    // === Reads phase (before batch) ===
    const scheduleItem = await db.query.paymentSchedule.findFirst({
      where: eq(paymentSchedule.id, payment.scheduleItemId!),
    })

    // === Compute phase ===
    const newAmountPaid = Math.max(0, parseFloat(payment.loan.amountPaid) - paymentAmount)
    const newRemainingBalance = parseFloat(payment.loan.totalToRepay) - newAmountPaid

    // Reverse interest portion
    const principal = parseFloat(payment.loan.principal)
    const totalToRepay = parseFloat(payment.loan.totalToRepay)
    const interestRatio = totalToRepay > 0 ? (totalToRepay - principal) / totalToRepay : 0
    const interestPortion = paymentAmount * interestRatio
    const newInterestEarned = Math.max(0, parseFloat(payment.loan.interestEarned) - interestPortion)

    const wasCompleted = payment.loan.status === "completed"

    // Validate status transition for completed → active reversal
    if (wasCompleted) {
      assertTransition(payment.loan.status, "active")
    }

    // Pre-generate debit payment ID
    const debitPaymentId = crypto.randomUUID()

    // === Atomic write phase ===
    const writes: any[] = [
      // Mark the original credit as reversed (for UI filtering)
      db.update(payments).set({
        reversedAt: now,
        reversedBy: session.user.id,
        reversalReason: data.reason,
      }).where(eq(payments.id, data.paymentId)),
      // Insert debit (reversal) transaction into the ledger
      db.insert(payments).values({
        id: debitPaymentId,
        loanId: payment.loanId,
        scheduleItemId: payment.scheduleItemId,
        amount: payment.amount,
        method: payment.method,
        type: "debit",
        reversesPaymentId: data.paymentId,
        paidAt: now,
        notes: data.reason,
      }),
      db.update(loans).set({
        amountPaid: newAmountPaid.toFixed(2),
        interestEarned: newInterestEarned.toFixed(2),
        remainingBalance: Math.max(0, newRemainingBalance).toFixed(2),
        status: wasCompleted ? "active" : payment.loan.status,
        completedAt: wasCompleted ? null : payment.loan.completedAt,
        updatedAt: now,
      }).where(eq(loans.id, payment.loanId)),
    ]

    // Revert cascade allocations (or just the single schedule item)
    const allocations = payment.cascadeAllocations as
      | { scheduleItemId: string; applied: number; prevPaidAmount: number }[]
      | null

    if (allocations && allocations.length > 0) {
      // Cascade-aware reversal: restore each item to its pre-cascade paidAmount
      // Fetch the items so we can check due dates for overdue status
      const allocItemIds = allocations.map((a) => a.scheduleItemId)
      const allocItems = await db.query.paymentSchedule.findMany({
        where: sql`${paymentSchedule.id} IN ${allocItemIds}`,
      })
      const allocItemMap = new Map(allocItems.map((i) => [i.id, i]))

      for (const alloc of allocations) {
        const item = allocItemMap.get(alloc.scheduleItemId)
        if (!item) continue
        // Subtract what this cascade applied, not restore to snapshot
        // This preserves any payments made after the cascade
        const currentPaid = parseFloat(item.paidAmount)
        const newPaidAmount = Math.max(0, currentPaid - alloc.applied)
        const itemAmount = parseFloat(item.amount)

        // If still fully paid by other payments, leave it alone
        if (newPaidAmount >= itemAmount) continue

        let revertedStatus: "pending" | "partial" | "overdue"
        if (newPaidAmount <= 0) {
          revertedStatus = new Date(item.dueDate) < now ? "overdue" : "pending"
        } else {
          revertedStatus = "partial"
        }
        writes.push(
          db.update(paymentSchedule).set({
            paidAmount: newPaidAmount.toFixed(2),
            status: revertedStatus,
            paidAt: null,
          }).where(eq(paymentSchedule.id, alloc.scheduleItemId)),
        )
      }
    } else if (scheduleItem) {
      // Single-item reversal (no cascade or legacy payment)
      const newPaidAmount = Math.max(0, parseFloat(scheduleItem.paidAmount) - paymentAmount)

      let newStatus: "pending" | "partial" | "overdue"
      if (newPaidAmount <= 0) {
        newStatus = new Date(scheduleItem.dueDate) < now ? "overdue" : "pending"
      } else {
        newStatus = "partial"
      }

      writes.push(
        db.update(paymentSchedule).set({
          paidAmount: newPaidAmount.toFixed(2),
          status: newStatus,
          paidAt: null,
        }).where(eq(paymentSchedule.id, payment.scheduleItemId!)),
      )
    }

    // 4. Revert applied penalties for this schedule item
    const appliedPenalties = payment.scheduleItemId ? await db.query.penalties.findMany({
      where: and(
        eq(penalties.scheduleItemId, payment.scheduleItemId),
        eq(penalties.status, "applied"),
      ),
    }) : []

    for (const penalty of appliedPenalties) {
      await revertPenaltyCore(penalty.id, payment.loanId, session.user.id)
    }

    // 5. Reverse commission if exists
    if (payment.commission) {
      const commissionAmount = parseFloat(payment.commission.commissionAmount)

      writes.push(
        db.delete(commissions).where(eq(commissions.id, payment.commission.id)),
        db.update(agents).set({
          totalCollected: sql`GREATEST(0, ${agents.totalCollected} - ${paymentAmount})`,
          totalCommissionEarned: sql`GREATEST(0, ${agents.totalCommissionEarned} - ${commissionAmount})`,
        }).where(eq(agents.id, payment.commission.agentId)),
      )
    }

    // 6. Execute all writes
    await Promise.all(writes)

    // 7. Audit log
    const log = createAuditLogger(session.user)
    log("payment.reverse", "payment", data.paymentId, {
      loanId: payment.loanId,
      amount: paymentAmount,
      reason: data.reason,
      penaltiesReverted: appliedPenalties.length,
    })

    return { success: true }
  })

// Public receipt (no auth required)
export const getPublicPaymentReceipt = createServerFn()
  .inputValidator(z.string().min(1))
  .handler(async ({ data: paymentId }) => {
    const payment = await db.query.payments.findFirst({
      where: eq(payments.id, paymentId),
      with: {
        loan: {
          with: {
            contact: true,
            lender: true,
          },
        },
        scheduleItem: true,
        recordedByAgent: {
          with: {
            agentUser: true,
          },
        },
      },
    })

    if (!payment) return null
    if (payment.reversedAt) return null
    if (payment.type !== "credit") return null

    let scheduleItemData: {
      dueDate: string
      amount: string
      installmentLabel: string | null
    } | null = null

    if (payment.scheduleItem) {
      const scheduleItems = await db.query.paymentSchedule.findMany({
        where: eq(paymentSchedule.loanId, payment.loanId),
        orderBy: paymentSchedule.dueDate,
      })
      const installmentIndex = scheduleItems.findIndex((s) => s.id === payment.scheduleItemId)
      scheduleItemData = {
        dueDate: payment.scheduleItem.dueDate.toISOString(),
        amount: payment.scheduleItem.amount,
        installmentLabel: installmentIndex >= 0 ? `#${installmentIndex + 1} of ${scheduleItems.length}` : null,
      }
    }

    return {
      id: payment.id,
      amount: payment.amount,
      method: payment.method,
      paidAt: payment.paidAt.toISOString(),
      notes: payment.notes,
      createdAt: payment.createdAt.toISOString(),
      borrowerName: payment.loan.contact.name,
      lenderName: payment.loan.lender.name,
      penaltyId: payment.penaltyId,
      isPenaltyPayment: !!payment.penaltyId,
      scheduleItem: scheduleItemData,
      agentName: payment.recordedByAgent?.agentUser?.name ?? null,
    }
  })
