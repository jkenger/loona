import { createServerFn } from "@tanstack/react-start"
import { db, loans, paymentSchedule, contacts, agents, penaltySettings, commissionSettings, penalties, payments } from "@/lib/db"
import { eq, desc, and, sql, inArray } from "drizzle-orm"
import { requireAuth } from "./session"
import { createAuditLogger } from "./audit"
import { z } from "zod"
import { getPublicQrCodesForLender } from "@/server/qr-codes"

import { type CustomClauses, DEFAULT_CLAUSES, type ClauseKey } from "@/lib/constants/promissory-clauses"
import {
  getEffectivePenaltyConfig,
  getRemainingPenaltyBudget,
  parsePenaltyConfig,
  type PenaltyConfig,
} from "@/lib/constants/penalty-defaults"
import { parseCommissionConfig } from "@/lib/constants/commission-defaults"
import { assignLoanToAgent } from "@/server/agents"

// Valid loan status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["active"],
  pending_disbursement: ["active"],
  pending_approval: ["active", "rejected"],
  active: ["completed", "defaulted"],
  completed: ["active"], // via reversePayment
  defaulted: ["active", "completed"], // recovery or full payoff
}

export function assertTransition(current: string, next: string) {
  const allowed = VALID_TRANSITIONS[current]
  if (!allowed || !allowed.includes(next)) {
    throw new Error(`Invalid status transition: ${current} → ${next}`)
  }
}

// Validation schemas
const createLoanSchema = z.object({
  contactId: z.string().min(1, "Contact is required"),
  principal: z.number().positive("Principal must be positive"),
  interestRate: z.number().min(0).max(15),
  termMonths: z.number().int().positive(),
  paymentFrequency: z.enum(["daily", "weekly", "biweekly", "semimonthly", "monthly"]),
  startDate: z.string().transform((s) => new Date(s)),
  // Optional fields
  purpose: z.string().optional(),
  collateralDescription: z.string().optional(),
  coMakerName: z.string().optional(),
  coMakerEmail: z.string().optional(),
  coMakerPhone: z.string().optional(),
  coMakerRelationship: z.string().optional(),
})

// Server functions
export const getLoans = createServerFn().handler(async () => {
  const session = await requireAuth()

  const result = await db
    .select({
      id: loans.id,
      principal: loans.principal,
      interestRate: loans.interestRate,
      termMonths: loans.termMonths,
      paymentFrequency: loans.paymentFrequency,
      paymentAmount: loans.paymentAmount,
      totalToRepay: loans.totalToRepay,
      amountPaid: loans.amountPaid,
      remainingBalance: loans.remainingBalance,
      status: loans.status,
      startDate: loans.startDate,
      maturityDate: loans.maturityDate,
      createdAt: loans.createdAt,
      contactName: contacts.name,
      contactId: contacts.id,
    })
    .from(loans)
    .innerJoin(contacts, eq(loans.contactId, contacts.id))
    .where(eq(loans.lenderId, session.user.id))
    .orderBy(desc(loans.createdAt))

  return result.map((l) => ({
    ...l,
    startDate: l.startDate?.toISOString() ?? null,
    maturityDate: l.maturityDate?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
  }))
})

export const getLoan = createServerFn()
  .inputValidator(z.string())
  .handler(async ({ data: id }) => {
    const session = await requireAuth()

    const result = await db.query.loans.findFirst({
      where: eq(loans.id, id),
      with: {
        contact: true,
        schedule: {
          orderBy: paymentSchedule.dueDate,
        },
        payments: {
          orderBy: (payments, { desc }) => [desc(payments.paidAt), desc(payments.createdAt)],
        },
        penalties: true,
        restructures: {
          orderBy: (r, { desc }) => [desc(r.createdAt)],
        },
        assignedAgent: {
          with: {
            agentUser: true,
          },
        },
      },
    })

    if (!result) {
      throw new Error("Loan not found")
    }

    // Allow access if user is the lender OR the assigned agent
    const isLender = result.lenderId === session.user.id
    const isAssignedAgent = result.assignedAgent?.agentUser?.id === session.user.id

    if (!isLender && !isAssignedAgent) {
      throw new Error("Loan not found")
    }

    // Check if agent can record payments
    let canRecordPayments = isLender // Lenders can always record payments
    if (isAssignedAgent && result.assignedAgent) {
      // Get full agent record to check permission
      const agentRecord = await db.query.agents.findFirst({
        where: eq(agents.id, result.assignedAgent.id),
      })
      canRecordPayments = agentRecord?.canRecordPayments ?? false
    }

    // Load penalty data inline (for any viewer when loan is active)
    let penaltyData: {
      config: PenaltyConfig
      penalties: {
        id: string
        loanId: string
        scheduleItemId: string
        penaltyType: "late_fee" | "daily_interest"
        amount: string
        status: "pending" | "applied" | "waived"
        appliedAt: string | null
        waivedAt: string | null
        decidedBy: string | null
        notes: string | null
        metadata: string | null
        createdAt: string
      }[]
      totalApplied: number
      totalPending: number
      budgetRemaining: number
    } | null = null

    // Resolve effective penalty config from loan snapshot only
    const penaltyConfig = getEffectivePenaltyConfig(result.penaltyConfig)

    // Always load existing penalties from DB (they may exist from before config changes)
    if (result.penalties.length > 0 || (result.status === "active" && penaltyConfig.enabled)) {
      const totalApplied = result.penalties
        .filter((p) => p.status === "applied")
        .reduce((sum, p) => sum + parseFloat(p.amount), 0)

      const totalPending = result.penalties
        .filter((p) => p.status === "pending")
        .reduce((sum, p) => sum + parseFloat(p.amount), 0)

      penaltyData = {
        config: penaltyConfig,
        penalties: result.penalties.map((p) => ({
          id: p.id,
          loanId: p.loanId,
          scheduleItemId: p.scheduleItemId,
          penaltyType: p.penaltyType,
          amount: p.amount,
          status: p.status,
          appliedAt: p.appliedAt?.toISOString() ?? null,
          waivedAt: p.waivedAt?.toISOString() ?? null,
          decidedBy: p.decidedBy,
          notes: p.notes,
          metadata: p.metadata,
          createdAt: p.createdAt.toISOString(),
        })),
        totalApplied,
        totalPending,
        budgetRemaining: getRemainingPenaltyBudget(penaltyConfig, parseFloat(result.principal), totalApplied),
      }
    }

    // Look up renewal chain
    let renewedFromLoan: { id: string; principal: string; contactName: string } | null = null
    if (result.renewedFromLoanId) {
      const parent = await db.query.loans.findFirst({
        where: eq(loans.id, result.renewedFromLoanId),
        with: { contact: true },
      })
      if (parent) {
        renewedFromLoan = { id: parent.id, principal: parent.principal, contactName: parent.contact.name }
      }
    }

    // Check if this loan was renewed into another loan
    let renewedToLoan: { id: string; principal: string } | null = null
    const child = await db.query.loans.findFirst({
      where: eq(loans.renewedFromLoanId, id),
    })
    if (child) {
      renewedToLoan = { id: child.id, principal: child.principal }
    }

    return {
      ...result,
      startDate: result.startDate?.toISOString() ?? null,
      maturityDate: result.maturityDate?.toISOString() ?? null,
      completedAt: result.completedAt?.toISOString() ?? null,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
      renewedFromLoan,
      renewedToLoan,
      contact: {
        ...result.contact,
        createdAt: result.contact.createdAt.toISOString(),
        updatedAt: result.contact.updatedAt.toISOString(),
      },
      schedule: result.schedule.map((s) => ({
        ...s,
        dueDate: s.dueDate.toISOString(),
        paidAt: s.paidAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      })),
      payments: result.payments.map((p) => ({
        ...p,
        penaltyId: p.penaltyId,
        paidAt: p.paidAt.toISOString(),
        createdAt: p.createdAt.toISOString(),
        reversedAt: p.reversedAt?.toISOString() ?? null,
      })),
      penalties: undefined, // don't expose raw relation, use penaltyData instead
      penaltyData,
      effectivePenaltyConfig: penaltyConfig,
      gracePeriodDays: penaltyConfig.gracePeriodDays,
      assignedAgent: result.assignedAgent
        ? {
            id: result.assignedAgent.id,
            name: result.assignedAgent.agentUser.name,
            email: result.assignedAgent.agentUser.email,
          }
        : null,
      // Include viewer context for UI permissions
      isLender,
      canRecordPayments,
      customClauses: result.customClauses,
    }
  }
)

// Public — no auth. Only returns data for completed loans.
export const getPublicLoanRecap = createServerFn()
  .inputValidator(z.string())
  .handler(async ({ data: id }) => {
    const result = await db.query.loans.findFirst({
      where: eq(loans.id, id),
      with: {
        contact: true,
        schedule: {
          orderBy: paymentSchedule.dueDate,
        },
        penalties: true,
      },
    })

    if (!result || result.status !== "completed") {
      return null
    }

    const penaltyConfig = getEffectivePenaltyConfig(result.penaltyConfig)

    const totalApplied = result.penalties
      .filter((p) => p.status === "applied")
      .reduce((sum, p) => sum + parseFloat(p.amount), 0)

    return {
      id: result.id,
      principal: result.principal,
      totalToRepay: result.totalToRepay,
      amountPaid: result.amountPaid,
      interestRate: result.interestRate,
      termMonths: result.termMonths,
      paymentFrequency: result.paymentFrequency,
      startDate: result.startDate?.toISOString() ?? null,
      maturityDate: result.maturityDate?.toISOString() ?? null,
      completedAt: result.completedAt?.toISOString() ?? null,
      contactName: result.contact.name,
      schedule: result.schedule.map((s) => ({
        id: s.id,
        dueDate: s.dueDate.toISOString(),
        amount: s.amount,
        paidAmount: s.paidAmount,
        paidAt: s.paidAt?.toISOString() ?? null,
        status: s.status,
      })),
      totalPenaltiesApplied: totalApplied,
      gracePeriodDays: penaltyConfig.gracePeriodDays,
    }
  })

// Public — no auth. Returns loan data for the borrower portal via magic link token.
export const getPublicLoanByToken = createServerFn()
  .inputValidator(z.string())
  .handler(async ({ data: token }) => {
    const result = await db.query.loans.findFirst({
      where: eq(loans.borrowerToken, token),
      with: {
        contact: true,
        lender: true,
        schedule: { orderBy: paymentSchedule.dueDate },
        payments: {
          orderBy: (p, { desc }) => [desc(p.paidAt)],
        },
        penalties: true,
      },
    })

    if (!result) return null

    const penaltyConfig = getEffectivePenaltyConfig(result.penaltyConfig)
    const qrCodes = await getPublicQrCodesForLender(result.lenderId)
    const totalPenalties = result.penalties
      .filter((p) => p.status === "applied" || p.status === "pending")
      .reduce((sum, p) => sum + parseFloat(p.amount), 0)

    // Find next pending payment
    const nextPayment = result.schedule.find((s) => s.status === "pending" || s.status === "overdue")
    const overdueCount = result.schedule.filter((s) => s.status === "overdue").length
    const paidCount = result.schedule.filter((s) => s.status === "paid").length
    const overdueAmount = result.schedule
      .filter((s) => s.status === "overdue")
      .reduce((sum, s) => sum + parseFloat(s.amount) - parseFloat(s.paidAmount), 0)

    return {
      id: result.id,
      status: result.status,
      lenderName: result.lender.name,
      borrowerName: result.contact.name,
      principal: result.principal,
      totalToRepay: result.totalToRepay,
      amountPaid: result.amountPaid,
      remainingBalance: result.remainingBalance,
      interestRate: result.interestRate,
      termMonths: result.termMonths,
      paymentFrequency: result.paymentFrequency,
      startDate: result.startDate?.toISOString() ?? null,
      maturityDate: result.maturityDate?.toISOString() ?? null,
      gracePeriodDays: penaltyConfig.gracePeriodDays,
      totalPenalties,
      overdueAmount,
      overdueCount,
      paidCount,
      totalScheduleItems: result.schedule.length,
      nextPayment: nextPayment ? {
        dueDate: nextPayment.dueDate.toISOString(),
        amount: nextPayment.amount,
        status: nextPayment.status,
      } : null,
      schedule: result.schedule.map((s) => ({
        dueDate: s.dueDate.toISOString(),
        amount: s.amount,
        paidAmount: s.paidAmount,
        paidAt: s.paidAt?.toISOString() ?? null,
        status: s.status,
      })),
      payments: result.payments.slice(0, 10).map((p) => ({
        amount: p.amount,
        method: p.method,
        paidAt: p.paidAt.toISOString(),
        type: p.type,
      })),
      qrCodes: qrCodes.map((q) => ({ label: q.label, imageData: q.imageData })),
    }
  })

export const createLoan = createServerFn()
  .inputValidator(createLoanSchema)
  .handler(async ({ data }) => {
  const session = await requireAuth()
  const log = createAuditLogger(session.user)

  // Verify contact ownership
  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.id, data.contactId),
  })

  if (!contact || contact.lenderId !== session.user.id) {
    throw new Error("Contact not found")
  }

  // Calculate loan terms
  const principal = data.principal
  const interestRate = data.interestRate
  const termMonths = data.termMonths
  const totalInterest = principal * (interestRate / 100) * termMonths
  const totalToRepay = principal + totalInterest

  // Calculate payment schedule
  const paymentsCount = calculatePaymentsCount(termMonths, data.paymentFrequency)
  const paymentAmount = totalToRepay / paymentsCount

  // Calculate maturity date
  const maturityDate = new Date(data.startDate)
  maturityDate.setMonth(maturityDate.getMonth() + termMonths)

  // Snapshot penalty config at creation time
  const penaltySettingsRow = await db.query.penaltySettings.findFirst({
    where: eq(penaltySettings.lenderId, session.user.id),
  })

  // Create loan
  const [loan] = await db
    .insert(loans)
    .values({
      lenderId: session.user.id,
      contactId: data.contactId,
      principal: principal.toString(),
      interestRate: interestRate.toString(),
      termMonths,
      paymentFrequency: data.paymentFrequency,
      paymentAmount: paymentAmount.toFixed(2),
      totalToRepay: totalToRepay.toFixed(2),
      remainingBalance: totalToRepay.toFixed(2),
      status: "active",
      startDate: data.startDate,
      maturityDate,
      // Optional fields
      purpose: data.purpose || null,
      collateralDescription: data.collateralDescription || null,
      coMakerName: data.coMakerName || null,
      coMakerEmail: data.coMakerEmail || null,
      coMakerPhone: data.coMakerPhone || null,
      coMakerRelationship: data.coMakerRelationship || null,
      // Snapshot penalty config
      penaltyConfig: penaltySettingsRow?.config ?? null,
      // Borrower portal magic link token
      borrowerToken: crypto.randomUUID().replace(/-/g, "").slice(0, 24),
    })
    .returning()

  // Generate payment schedule
  const scheduleItems = generatePaymentSchedule(
    loan.id,
    data.startDate,
    paymentsCount,
    paymentAmount,
    data.paymentFrequency,
    totalToRepay
  )

  await db.insert(paymentSchedule).values(scheduleItems)

  log("loan.create", "loan", loan.id, {
    contactId: data.contactId,
    contactName: contact.name,
    principal,
    termMonths,
  })

  return {
    ...loan,
    startDate: loan.startDate?.toISOString() ?? null,
    maturityDate: loan.maturityDate?.toISOString() ?? null,
    createdAt: loan.createdAt.toISOString(),
    updatedAt: loan.updatedAt.toISOString(),
  }
})

export const disburseLoan = createServerFn()
  .inputValidator(z.string())
  .handler(async ({ data: id }) => {
    const session = await requireAuth()

    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, id),
    })

    if (!loan || loan.lenderId !== session.user.id) {
      throw new Error("Loan not found")
    }

    assertTransition(loan.status, "active")

    const [updated] = await db
      .update(loans)
      .set({
        status: "active",
        startDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(loans.id, id))
      .returning()

    return { success: true, loan: updated }
  }
)

// Helper functions
function calculatePaymentsCount(
  termMonths: number,
  frequency: "daily" | "weekly" | "biweekly" | "semimonthly" | "monthly"
): number {
  switch (frequency) {
    case "daily":
      return termMonths * 30
    case "weekly":
      return termMonths * 4
    case "biweekly":
      return termMonths * 2
    case "semimonthly":
      return termMonths * 2
    case "monthly":
    default:
      return termMonths
  }
}

function generatePaymentSchedule(
  loanId: string,
  startDate: Date,
  paymentsCount: number,
  paymentAmount: number,
  frequency: "daily" | "weekly" | "biweekly" | "semimonthly" | "monthly",
  totalToRepay?: number,
) {
  const schedule = []
  const currentDate = new Date(startDate)
  const roundedAmount = paymentAmount.toFixed(2)

  for (let i = 0; i < paymentsCount; i++) {
    // Move to next payment date
    switch (frequency) {
      case "daily":
        currentDate.setDate(currentDate.getDate() + 1)
        break
      case "weekly":
        currentDate.setDate(currentDate.getDate() + 7)
        break
      case "biweekly":
        currentDate.setDate(currentDate.getDate() + 14)
        break
      case "semimonthly":
        // 1st and 15th of each month pattern
        if (currentDate.getDate() < 15) {
          currentDate.setDate(15)
        } else {
          currentDate.setDate(1)
          currentDate.setMonth(currentDate.getMonth() + 1)
        }
        break
      case "monthly":
        currentDate.setMonth(currentDate.getMonth() + 1)
        break
    }

    // Last item absorbs rounding difference so schedule sums to totalToRepay
    let itemAmount = roundedAmount
    if (totalToRepay !== undefined && i === paymentsCount - 1) {
      const sumSoFar = parseFloat(roundedAmount) * (paymentsCount - 1)
      itemAmount = (totalToRepay - sumSoFar).toFixed(2)
    }

    schedule.push({
      loanId,
      dueDate: new Date(currentDate),
      amount: itemAmount,
    })
  }

  return schedule
}

// Combined contact + loan creation for the new wizard
const createContactAndLoanSchema = z.discriminatedUnion("isNewContact", [
  z.object({
    isNewContact: z.literal(true),
    // Contact fields
    name: z.string().min(2, "Name must be at least 2 characters"),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")).or(z.literal(undefined)),
    address: z.string().optional(),
    city: z.string().optional(),
    facebookProfile: z.string().optional(),
    notes: z.string().optional(),
    income: z.string().optional(),
    otherIncome: z.string().optional(),
    // Loan fields
    principal: z.number().positive("Principal must be positive"),
    interestRate: z.number().min(0).max(15),
    termMonths: z.number().int().positive(),
    paymentFrequency: z.enum(["daily", "weekly", "biweekly", "semimonthly", "monthly"]),
    startDate: z.string().transform((s) => new Date(s)),
    purpose: z.string().optional(),
    collateralDescription: z.string().optional(),
    coMakerName: z.string().optional(),
    coMakerEmail: z.string().optional(),
    coMakerPhone: z.string().optional(),
    coMakerRelationship: z.string().optional(),
    renewedFromLoanId: z.string().optional(),
    penaltyConfigJson: z.string().optional(),
    assignedAgentId: z.string().optional(),
    notifyAgent: z.boolean().optional().default(false),
    processingFeePercent: z.number().min(0).max(100).optional(),
    status: z.enum(["active", "draft"]).optional().default("active"),
  }),
  z.object({
    isNewContact: z.literal(false),
    contactId: z.string().min(1, "Contact is required"),
    // Loan fields
    principal: z.number().positive("Principal must be positive"),
    interestRate: z.number().min(0).max(15),
    termMonths: z.number().int().positive(),
    paymentFrequency: z.enum(["daily", "weekly", "biweekly", "semimonthly", "monthly"]),
    startDate: z.string().transform((s) => new Date(s)),
    purpose: z.string().optional(),
    collateralDescription: z.string().optional(),
    coMakerName: z.string().optional(),
    coMakerEmail: z.string().optional(),
    coMakerPhone: z.string().optional(),
    coMakerRelationship: z.string().optional(),
    renewedFromLoanId: z.string().optional(),
    penaltyConfigJson: z.string().optional(),
    assignedAgentId: z.string().optional(),
    notifyAgent: z.boolean().optional().default(false),
    processingFeePercent: z.number().min(0).max(100).optional(),
    status: z.enum(["active", "draft"]).optional().default("active"),
  }),
])

export const createContactAndLoan = createServerFn()
  .inputValidator(createContactAndLoanSchema)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const log = createAuditLogger(session.user)

    let contactId: string
    let contactName: string

    if (data.isNewContact) {
      // Create the contact first
      const [contact] = await db
        .insert(contacts)
        .values({
          name: data.name,
          phone: data.phone || null,
          email: data.email || null,
          address: data.address || null,
          city: data.city || null,
          facebookProfile: data.facebookProfile || null,
          notes: data.notes || null,
          income: data.income || null,
          otherIncome: data.otherIncome || null,
          lenderId: session.user.id,
        })
        .returning()

      contactId = contact.id
      contactName = contact.name

      log("contact.create", "contact", contact.id, { name: contact.name })
    } else {
      // Verify ownership of existing contact
      const contact = await db.query.contacts.findFirst({
        where: eq(contacts.id, data.contactId),
      })

      if (!contact || contact.lenderId !== session.user.id) {
        throw new Error("Contact not found")
      }

      contactId = contact.id
      contactName = contact.name
    }

    // Calculate loan terms
    const principal = data.principal
    const interestRate = data.interestRate
    const termMonths = data.termMonths
    const totalInterest = principal * (interestRate / 100) * termMonths
    const totalToRepay = principal + totalInterest

    const paymentsCount = calculatePaymentsCount(termMonths, data.paymentFrequency)
    const paymentAmount = totalToRepay / paymentsCount

    const maturityDate = new Date(data.startDate)
    maturityDate.setMonth(maturityDate.getMonth() + termMonths)

    // Use wizard-provided penalty config if available, otherwise fall back to global
    let penaltyConfigSnapshot: string | null = null
    if (data.penaltyConfigJson) {
      const parsed = parsePenaltyConfig(data.penaltyConfigJson)
      penaltyConfigSnapshot = JSON.stringify(parsed)
    } else {
      const penaltySettingsRow = await db.query.penaltySettings.findFirst({
        where: eq(penaltySettings.lenderId, session.user.id),
      })
      penaltyConfigSnapshot = penaltySettingsRow?.config ?? null
    }

    const isDraft = data.status === "draft"

    // Create loan
    const [loan] = await db
      .insert(loans)
      .values({
        lenderId: session.user.id,
        contactId,
        principal: principal.toString(),
        interestRate: interestRate.toString(),
        termMonths,
        paymentFrequency: data.paymentFrequency,
        paymentAmount: paymentAmount.toFixed(2),
        totalToRepay: totalToRepay.toFixed(2),
        remainingBalance: totalToRepay.toFixed(2),
        status: isDraft ? "draft" : "active",
        startDate: data.startDate,
        maturityDate,
        purpose: data.purpose || null,
        collateralDescription: data.collateralDescription || null,
        coMakerName: data.coMakerName || null,
        coMakerEmail: data.coMakerEmail || null,
        coMakerPhone: data.coMakerPhone || null,
        coMakerRelationship: data.coMakerRelationship || null,
        renewedFromLoanId: data.renewedFromLoanId || null,
        penaltyConfig: penaltyConfigSnapshot,
        processingFeePercent: data.processingFeePercent?.toString() || null,
        assignedAgentId: data.assignedAgentId || null,
        borrowerToken: crypto.randomUUID().replace(/-/g, "").slice(0, 24),
      })
      .returning()

    // Only generate schedule and notify agent for active loans
    if (!isDraft) {
      const scheduleItems = generatePaymentSchedule(
        loan.id,
        data.startDate,
        paymentsCount,
        paymentAmount,
        data.paymentFrequency,
        totalToRepay
      )

      await db.insert(paymentSchedule).values(scheduleItems)

      if (data.assignedAgentId) {
        assignLoanToAgent({ data: { loanId: loan.id, agentId: data.assignedAgentId, notify: data.notifyAgent } }).catch((err) => {
          console.error('[Loan] Post-create agent assignment failed', err)
        })
      }
    }

    log("loan.create", "loan", loan.id, {
      contactId,
      contactName,
      principal,
      termMonths,
      isNewContact: data.isNewContact,
      renewedFromLoanId: data.renewedFromLoanId || null,
      status: isDraft ? "draft" : "active",
    })

    return {
      ...loan,
      startDate: loan.startDate?.toISOString() ?? null,
      maturityDate: loan.maturityDate?.toISOString() ?? null,
      createdAt: loan.createdAt.toISOString(),
      updatedAt: loan.updatedAt.toISOString(),
    }
  })

export const deleteLoan = createServerFn()
  .inputValidator(z.string())
  .handler(async ({ data: id }) => {
    const session = await requireAuth()
    const log = createAuditLogger(session.user)

    // Get the loan with payments count
    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, id),
      with: {
        payments: true,
        contact: true,
      },
    })

    if (!loan || loan.lenderId !== session.user.id) {
      throw new Error("Loan not found")
    }

    // Check if loan has any payments
    if (loan.payments.length > 0) {
      throw new Error(
        `Cannot delete loan with ${loan.payments.length} payment${loan.payments.length !== 1 ? "s" : ""}. Delete payments first.`
      )
    }

    // Delete schedule items first (foreign key constraint)
    await db.delete(paymentSchedule).where(eq(paymentSchedule.loanId, id))

    // Delete the loan
    await db.delete(loans).where(eq(loans.id, id))

    log("loan.delete", "loan", id, {
      contactName: loan.contact.name,
      principal: loan.principal,
    })

    return { success: true }
  }
)

// ============================================================================
// Custom Clauses
// ============================================================================

const customClausesSchema = z.object({
  loanId: z.string(),
  customClauses: z.record(
    z.enum(["default", "acceleration", "attorneysFees", "waiver", "venue"]),
    z.object({ en: z.string(), fil: z.string() })
  ),
})

export const updateLoanClauses = createServerFn()
  .inputValidator(customClausesSchema)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const log = createAuditLogger(session.user)

    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, data.loanId),
    })

    if (!loan || loan.lenderId !== session.user.id) {
      throw new Error("Loan not found")
    }

    // Strip clauses that match default text
    const cleaned: CustomClauses = {}
    for (const [key, value] of Object.entries(data.customClauses)) {
      const clauseKey = key as ClauseKey
      const defaultText = DEFAULT_CLAUSES[clauseKey]
      if (
        value &&
        (value.en.trim() !== defaultText.en.trim() ||
          value.fil.trim() !== defaultText.fil.trim())
      ) {
        cleaned[clauseKey] = value
      }
    }

    const jsonValue = Object.keys(cleaned).length > 0 ? JSON.stringify(cleaned) : null

    await db
      .update(loans)
      .set({
        customClauses: jsonValue,
        updatedAt: new Date(),
      })
      .where(eq(loans.id, data.loanId))

    log("loan.updateClauses", "loan", data.loanId, {
      clausesCustomized: Object.keys(cleaned),
    })

    return { success: true }
  })

// ============================================================================
// Agent Loan Creation Functions
// ============================================================================

// Get agent's contacts (those assigned to their loans + contacts they created)
export const getAgentAssignedContacts = createServerFn().handler(async () => {
  const session = await requireAuth()

  // Get agent's relationships
  const agentRelationships = await db.query.agents.findMany({
    where: and(
      eq(agents.agentUserId, session.user.id),
      eq(agents.status, "active")
    ),
  })

  if (agentRelationships.length === 0) {
    return []
  }

  const agentIds = agentRelationships.map((r) => r.id)
  const lenderIds = agentRelationships.map((r) => r.lenderId)

  // Get unique contacts that are either:
  // 1. Have loans assigned to this agent
  // 2. Were created by this agent
  const result = await db
    .selectDistinct({
      id: contacts.id,
      name: contacts.name,
      phone: contacts.phone,
      email: contacts.email,
      city: contacts.city,
      lenderId: contacts.lenderId,
    })
    .from(contacts)
    .leftJoin(loans, eq(contacts.id, loans.contactId))
    .where(
      sql`(${loans.assignedAgentId} IN ${agentIds} OR ${contacts.createdByAgentId} IN ${agentIds}) AND ${contacts.lenderId} IN ${lenderIds}`
    )
    .orderBy(contacts.name)

  return result
})

// Get agent's permission to create loans for a specific lender
export const getAgentLoanCreationPermission = createServerFn().handler(async () => {
  const session = await requireAuth()

  // Get active agent relationships with loan creation permission
  const agentRelationships = await db.query.agents.findMany({
    where: and(
      eq(agents.agentUserId, session.user.id),
      eq(agents.status, "active"),
      eq(agents.canCreateLoans, true)
    ),
    with: {
      lender: true,
    },
  })

  // Enrich with portfolio cap info
  const results = await Promise.all(
    agentRelationships.map(async (r) => {
      const settingsRow = await db.query.commissionSettings.findFirst({
        where: eq(commissionSettings.lenderId, r.lenderId),
      })
      const config = parseCommissionConfig(settingsRow?.config ?? null)
      const agentTier = r.tier ?? 1
      const tierConfig = config.tiers.find((t) => t.tier === agentTier)
        ?? config.tiers[0]

      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(loans)
        .where(
          and(
            eq(loans.assignedAgentId, r.id),
            inArray(loans.status, ["active", "pending_approval", "pending_disbursement"])
          )
        )

      return {
        agentId: r.id,
        lenderId: r.lenderId,
        lenderName: r.lender.name,
        portfolioCap: tierConfig?.portfolioCap ?? 10,
        currentLoanCount: countResult?.count ?? 0,
      }
    })
  )

  return results
})

// Schema for agent creating a loan with agentId
const agentLoanSchema = z.discriminatedUnion("isNewContact", [
  z.object({
    agentId: z.string(),
    isNewContact: z.literal(true),
    name: z.string().min(2),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")).or(z.literal(undefined)),
    address: z.string().optional(),
    city: z.string().optional(),
    facebookProfile: z.string().optional(),
    notes: z.string().optional(),
    principal: z.number().positive(),
    interestRate: z.number().min(0).max(15),
    termMonths: z.number().int().positive(),
    paymentFrequency: z.enum(["daily", "weekly", "biweekly", "semimonthly", "monthly"]),
    startDate: z.string().transform((s) => new Date(s)),
    purpose: z.string().optional(),
    collateralDescription: z.string().optional(),
    coMakerName: z.string().optional(),
    coMakerEmail: z.string().optional(),
    coMakerPhone: z.string().optional(),
    coMakerRelationship: z.string().optional(),
  }),
  z.object({
    agentId: z.string(),
    isNewContact: z.literal(false),
    contactId: z.string().min(1),
    principal: z.number().positive(),
    interestRate: z.number().min(0).max(15),
    termMonths: z.number().int().positive(),
    paymentFrequency: z.enum(["daily", "weekly", "biweekly", "semimonthly", "monthly"]),
    startDate: z.string().transform((s) => new Date(s)),
    purpose: z.string().optional(),
    collateralDescription: z.string().optional(),
    coMakerName: z.string().optional(),
    coMakerEmail: z.string().optional(),
    coMakerPhone: z.string().optional(),
    coMakerRelationship: z.string().optional(),
  }),
])

// Agent creates a loan (pending approval)
export const createLoanAsAgent = createServerFn()
  .inputValidator(agentLoanSchema)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const log = createAuditLogger(session.user)

    // Verify agent relationship and permission
    const agent = await db.query.agents.findFirst({
      where: and(
        eq(agents.id, data.agentId),
        eq(agents.agentUserId, session.user.id),
        eq(agents.status, "active"),
        eq(agents.canCreateLoans, true)
      ),
    })

    if (!agent) {
      throw new Error("You do not have permission to create loans")
    }

    // Enforce portfolio cap
    const settingsRow = await db.query.commissionSettings.findFirst({
      where: eq(commissionSettings.lenderId, agent.lenderId),
    })
    const commissionConfig = parseCommissionConfig(settingsRow?.config ?? null)
    const agentTier = agent.tier ?? 1
    const tierConfig = commissionConfig.tiers.find((t) => t.tier === agentTier)
      ?? commissionConfig.tiers[0]

    if (tierConfig) {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(loans)
        .where(
          and(
            eq(loans.assignedAgentId, agent.id),
            inArray(loans.status, ["active", "pending_approval", "pending_disbursement"])
          )
        )
      const currentCount = countResult?.count ?? 0
      if (currentCount >= tierConfig.portfolioCap) {
        throw new Error(
          `You've reached your portfolio limit of ${tierConfig.portfolioCap} loans. Contact your lender to increase your limit or wait for existing loans to complete.`
        )
      }
    }

    let contactId: string
    let contactName: string

    if (data.isNewContact) {
      // Create the contact with agent tracking
      const [contact] = await db
        .insert(contacts)
        .values({
          name: data.name,
          phone: data.phone || null,
          email: data.email || null,
          address: data.address || null,
          city: data.city || null,
          facebookProfile: data.facebookProfile || null,
          notes: data.notes || null,
          lenderId: agent.lenderId,
          createdByAgentId: agent.id,
        })
        .returning()

      contactId = contact.id
      contactName = contact.name

      log("contact.create", "contact", contact.id, {
        name: contact.name,
        createdByAgentId: agent.id,
      })
    } else {
      // Verify contact belongs to this lender
      const contact = await db.query.contacts.findFirst({
        where: eq(contacts.id, data.contactId),
      })

      if (!contact || contact.lenderId !== agent.lenderId) {
        throw new Error("Contact not found")
      }

      contactId = contact.id
      contactName = contact.name
    }

    // Calculate loan terms
    const principal = data.principal
    const interestRate = data.interestRate
    const termMonths = data.termMonths
    const totalInterest = principal * (interestRate / 100) * termMonths
    const totalToRepay = principal + totalInterest

    const paymentsCount = calculatePaymentsCount(termMonths, data.paymentFrequency)
    const paymentAmount = totalToRepay / paymentsCount

    const maturityDate = new Date(data.startDate)
    maturityDate.setMonth(maturityDate.getMonth() + termMonths)

    // Snapshot penalty config at creation time
    const penaltySettingsRow = await db.query.penaltySettings.findFirst({
      where: eq(penaltySettings.lenderId, agent.lenderId),
    })

    // Create loan with pending_approval status
    const [loan] = await db
      .insert(loans)
      .values({
        lenderId: agent.lenderId,
        contactId,
        principal: principal.toString(),
        interestRate: interestRate.toString(),
        termMonths,
        paymentFrequency: data.paymentFrequency,
        paymentAmount: paymentAmount.toFixed(2),
        totalToRepay: totalToRepay.toFixed(2),
        remainingBalance: totalToRepay.toFixed(2),
        status: "pending_approval",
        startDate: data.startDate,
        maturityDate,
        purpose: data.purpose || null,
        collateralDescription: data.collateralDescription || null,
        coMakerName: data.coMakerName || null,
        coMakerEmail: data.coMakerEmail || null,
        coMakerPhone: data.coMakerPhone || null,
        coMakerRelationship: data.coMakerRelationship || null,
        createdByAgentId: agent.id,
        assignedAgentId: agent.id,
        penaltyConfig: penaltySettingsRow?.config ?? null,
        borrowerToken: crypto.randomUUID().replace(/-/g, "").slice(0, 24),
      })
      .returning()

    // Note: Payment schedule will be generated when loan is approved

    log("loan.create", "loan", loan.id, {
      contactId,
      contactName,
      principal,
      termMonths,
      createdByAgentId: agent.id,
      status: "pending_approval",
    })

    return {
      ...loan,
      startDate: loan.startDate?.toISOString() ?? null,
      maturityDate: loan.maturityDate?.toISOString() ?? null,
      createdAt: loan.createdAt.toISOString(),
      updatedAt: loan.updatedAt.toISOString(),
    }
  })

// Get pending approval loans count for lender dashboard
export const getPendingApprovalCount = createServerFn().handler(async () => {
  const session = await requireAuth()

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loans)
    .where(
      and(
        eq(loans.lenderId, session.user.id),
        eq(loans.status, "pending_approval")
      )
    )

  return result[0]?.count || 0
})

// Approve a pending loan
export const approveLoan = createServerFn()
  .inputValidator(z.object({
    loanId: z.string(),
    updateStartDate: z.boolean().optional(),
  }))
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const log = createAuditLogger(session.user)

    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, data.loanId),
      with: { contact: true },
    })

    if (!loan || loan.lenderId !== session.user.id) {
      throw new Error("Loan not found")
    }

    assertTransition(loan.status, "active")

    // Guard against duplicate schedule generation
    const existingSchedule = await db.query.paymentSchedule.findFirst({
      where: eq(paymentSchedule.loanId, data.loanId),
    })
    if (existingSchedule) {
      throw new Error("Payment schedule already generated for this loan")
    }

    const now = new Date()
    const updateFields: Record<string, unknown> = {
      status: "active",
      updatedAt: now,
    }

    // Determine the start date for schedule generation
    let scheduleStartDate: Date

    if (data.updateStartDate) {
      // Use today's date as the new start date
      scheduleStartDate = now
      updateFields.startDate = now
      // Recalculate maturity date
      const maturityDate = new Date(now)
      maturityDate.setMonth(maturityDate.getMonth() + loan.termMonths)
      updateFields.maturityDate = maturityDate
    } else {
      // Use the original start date
      scheduleStartDate = loan.startDate || now
    }

    // Generate payment schedule (always done on approval)
    const paymentsCount = calculatePaymentsCount(loan.termMonths, loan.paymentFrequency as any)
    const scheduleItems = generatePaymentSchedule(
      loan.id,
      scheduleStartDate,
      paymentsCount,
      parseFloat(loan.paymentAmount),
      loan.paymentFrequency as any,
      parseFloat(loan.totalToRepay)
    )

    // Atomic: insert schedule + update loan status in one batch
    const [, [updated]] = await db.batch([
      db.insert(paymentSchedule).values(scheduleItems),
      db.update(loans).set(updateFields).where(eq(loans.id, data.loanId)).returning(),
    ])

    log("loan.approve", "loan", data.loanId, {
      contactName: loan.contact.name,
      principal: loan.principal,
      approvedBy: session.user.id,
      startDateUpdated: data.updateStartDate,
    })

    return {
      ...updated,
      startDate: updated.startDate?.toISOString() ?? null,
      maturityDate: updated.maturityDate?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }
  })

// Reject a pending loan
export const rejectLoan = createServerFn()
  .inputValidator(z.object({
    loanId: z.string(),
    reason: z.string().min(1, "Rejection reason is required"),
  }))
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const log = createAuditLogger(session.user)

    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, data.loanId),
      with: { contact: true },
    })

    if (!loan || loan.lenderId !== session.user.id) {
      throw new Error("Loan not found")
    }

    assertTransition(loan.status, "rejected")

    const [updated] = await db
      .update(loans)
      .set({
        status: "rejected",
        rejectionReason: data.reason,
        updatedAt: new Date(),
      })
      .where(eq(loans.id, data.loanId))
      .returning()

    log("loan.reject", "loan", data.loanId, {
      contactName: loan.contact.name,
      principal: loan.principal,
      rejectedBy: session.user.id,
      reason: data.reason,
    })

    return {
      ...updated,
      startDate: updated.startDate?.toISOString() ?? null,
      maturityDate: updated.maturityDate?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }
  })

// ============================================================================
// Mark Loan as Defaulted / Recovered
// ============================================================================

export const markLoanDefaulted = createServerFn()
  .inputValidator(z.object({
    loanId: z.string(),
    reason: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const log = createAuditLogger(session.user)

    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, data.loanId),
      with: { contact: true },
    })

    if (!loan || loan.lenderId !== session.user.id) {
      throw new Error("Loan not found")
    }

    assertTransition(loan.status, "defaulted")

    const [updated] = await db
      .update(loans)
      .set({ status: "defaulted", updatedAt: new Date() })
      .where(eq(loans.id, data.loanId))
      .returning()

    log("loan.defaulted", "loan", data.loanId, {
      contactName: loan.contact.name,
      remainingBalance: loan.remainingBalance,
      principal: loan.principal,
      reason: data.reason ?? null,
    })

    return {
      ...updated,
      startDate: updated.startDate?.toISOString() ?? null,
      maturityDate: updated.maturityDate?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }
  })

export const markLoanActive = createServerFn()
  .inputValidator(z.object({ loanId: z.string() }))
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const log = createAuditLogger(session.user)

    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, data.loanId),
      with: { contact: true },
    })

    if (!loan || loan.lenderId !== session.user.id) {
      throw new Error("Loan not found")
    }

    assertTransition(loan.status, "active")

    const [updated] = await db
      .update(loans)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(loans.id, data.loanId))
      .returning()

    log("loan.recovered", "loan", data.loanId, {
      contactName: loan.contact.name,
      remainingBalance: loan.remainingBalance,
    })

    return {
      ...updated,
      startDate: updated.startDate?.toISOString() ?? null,
      maturityDate: updated.maturityDate?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }
  })

// ============================================================================
// Regenerate Remaining Schedule
// ============================================================================

export const regenerateSchedule = createServerFn()
  .inputValidator(z.object({ loanId: z.string() }))
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const log = createAuditLogger(session.user)

    // Fetch loan with schedule + penalties
    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, data.loanId),
      with: {
        schedule: { orderBy: paymentSchedule.dueDate },
        penalties: true,
      },
    })

    if (!loan || loan.lenderId !== session.user.id) {
      throw new Error("Loan not found")
    }

    if (loan.status !== "active") {
      throw new Error("Only active loans can have their schedule regenerated")
    }

    // Separate paid vs unpaid items
    const paidItems = loan.schedule.filter((s) => s.status === "paid")
    const unpaidItems = loan.schedule.filter((s) => s.status !== "paid")

    if (unpaidItems.length === 0) {
      throw new Error("No unpaid items to regenerate")
    }

    // Identify schedule items with applied/waived penalties (must be skipped)
    const appliedOrWaivedPenaltyItemIds = new Set(
      loan.penalties
        .filter((p) => p.status === "applied" || p.status === "waived")
        .map((p) => p.scheduleItemId)
    )

    const skippedItems = unpaidItems.filter((s) => appliedOrWaivedPenaltyItemIds.has(s.id))
    const regenerableItems = unpaidItems.filter((s) => !appliedOrWaivedPenaltyItemIds.has(s.id))

    if (regenerableItems.length === 0) {
      throw new Error("All unpaid items have applied or waived penalties and cannot be regenerated")
    }

    // Calculate adjusted balance before any mutations
    const regenerableItemIds = regenerableItems.map((s) => s.id)
    const originalPayment = parseFloat(loan.paymentAmount)

    const skippedUnpaidTotal = skippedItems.reduce(
      (sum, s) => sum + (parseFloat(s.amount) - parseFloat(s.paidAmount)),
      0
    )
    const adjustedBalance = parseFloat(loan.remainingBalance) - skippedUnpaidTotal

    if (adjustedBalance <= 0) {
      throw new Error("No remaining balance to regenerate — loan may be overpaid")
    }

    // Determine remaining count: try to keep original count, but reduce if balance
    // is too small (e.g. due to overpayments) to avoid negative first item
    const totalOriginalItems = loan.schedule.length
    let remainingCount = totalOriginalItems - paidItems.length - skippedItems.length
    while (remainingCount > 1 && adjustedBalance <= (remainingCount - 1) * originalPayment) {
      remainingCount--
    }

    // First item absorbs the difference, rest keep original payment amount
    const firstItemAmount = remainingCount === 1
      ? adjustedBalance
      : adjustedBalance - (remainingCount - 1) * originalPayment

    // Generate new schedule items starting from today
    const today = new Date()
    const newItems = generatePaymentSchedule(
      loan.id,
      today,
      remainingCount,
      originalPayment,
      loan.paymentFrequency as any,
    )

    // Override first item amount
    if (newItems.length > 0) {
      newItems[0].amount = firstItemAmount.toFixed(2)
    }

    // Identify pending penalties to delete
    const pendingPenaltiesToDelete = loan.penalties.filter(
      (p) => p.status === "pending" && regenerableItemIds.includes(p.scheduleItemId)
    )

    // Build all writes for atomic batch execution
    const writes: any[] = []

    // 1. Delete pending penalties on regenerable items
    if (pendingPenaltiesToDelete.length > 0) {
      writes.push(
        db.delete(penalties).where(inArray(penalties.id, pendingPenaltiesToDelete.map((p) => p.id)))
      )
    }

    // 2. Unlink payments from regenerable schedule items (FK has no cascade)
    writes.push(
      db.update(payments).set({ scheduleItemId: null }).where(inArray(payments.scheduleItemId, regenerableItemIds))
    )

    // 3. Delete regenerable schedule items
    writes.push(
      db.delete(paymentSchedule).where(inArray(paymentSchedule.id, regenerableItemIds))
    )

    // 4. Insert new schedule items
    writes.push(
      db.insert(paymentSchedule).values(newItems)
    )

    // 5. Touch loan updatedAt
    writes.push(
      db.update(loans).set({ updatedAt: new Date() }).where(eq(loans.id, data.loanId))
    )

    await db.batch(writes as any)

    log("loan.regenerate_schedule", "loan", data.loanId, {
      originalPaymentAmount: loan.paymentAmount,
      firstItemAmount: firstItemAmount.toFixed(2),
      paidItems: paidItems.length,
      skippedItems: skippedItems.length,
      regeneratedItems: remainingCount,
      pendingPenaltiesDeleted: pendingPenaltiesToDelete.length,
      adjustedBalance: adjustedBalance.toFixed(2),
    })

    return { success: true }
  })

// ============================================================================
// Draft Loan — Activate
// ============================================================================

export const activateDraftLoan = createServerFn()
  .inputValidator(z.object({ loanId: z.string() }))
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const log = createAuditLogger(session.user)

    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, data.loanId),
      with: { contact: true },
    })

    if (!loan || loan.lenderId !== session.user.id) {
      throw new Error("Loan not found")
    }

    assertTransition(loan.status, "active")

    const paymentsCount = calculatePaymentsCount(loan.termMonths, loan.paymentFrequency as any)
    const scheduleItems = generatePaymentSchedule(
      loan.id,
      loan.startDate || new Date(),
      paymentsCount,
      parseFloat(loan.paymentAmount),
      loan.paymentFrequency as any,
      parseFloat(loan.totalToRepay)
    )

    const [, [updated]] = await db.batch([
      db.insert(paymentSchedule).values(scheduleItems),
      db.update(loans).set({ status: "active", updatedAt: new Date() }).where(eq(loans.id, data.loanId)).returning(),
    ])

    log("loan.activate_draft", "loan", data.loanId, {
      contactName: loan.contact.name,
      principal: loan.principal,
    })

    return {
      ...updated,
      startDate: updated.startDate?.toISOString() ?? null,
      maturityDate: updated.maturityDate?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }
  })

// ============================================================================
// Draft Loan — Update Fields
// ============================================================================

export const updateDraftLoan = createServerFn()
  .inputValidator(z.object({
    loanId: z.string(),
    principal: z.number().positive(),
    interestRate: z.number().min(0).max(15),
    termMonths: z.number().int().positive(),
    paymentFrequency: z.enum(["daily", "weekly", "biweekly", "semimonthly", "monthly"]),
    startDate: z.string(),
    purpose: z.string().optional(),
    collateralDescription: z.string().optional(),
    coMakerName: z.string().optional(),
    processingFeePercent: z.number().min(0).max(100).optional(),
  }))
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const log = createAuditLogger(session.user)

    const loan = await db.query.loans.findFirst({ where: eq(loans.id, data.loanId) })

    if (!loan || loan.lenderId !== session.user.id) {
      throw new Error("Loan not found")
    }

    if (loan.status !== "draft") {
      throw new Error("Only draft loans can be edited")
    }

    const totalInterest = data.principal * (data.interestRate / 100) * data.termMonths
    const totalToRepay = data.principal + totalInterest
    const paymentsCount = calculatePaymentsCount(data.termMonths, data.paymentFrequency)
    const paymentAmount = totalToRepay / paymentsCount
    const startDate = new Date(data.startDate)
    const maturityDate = new Date(startDate)
    maturityDate.setMonth(maturityDate.getMonth() + data.termMonths)

    const [updated] = await db.update(loans).set({
      principal: data.principal.toString(),
      interestRate: data.interestRate.toString(),
      termMonths: data.termMonths,
      paymentFrequency: data.paymentFrequency,
      paymentAmount: paymentAmount.toFixed(2),
      totalToRepay: totalToRepay.toFixed(2),
      remainingBalance: totalToRepay.toFixed(2),
      startDate,
      maturityDate,
      purpose: data.purpose || null,
      collateralDescription: data.collateralDescription || null,
      coMakerName: data.coMakerName || null,
      processingFeePercent: data.processingFeePercent?.toString() || null,
      updatedAt: new Date(),
    }).where(eq(loans.id, data.loanId)).returning()

    log("loan.update_draft", "loan", data.loanId, { principal: data.principal })

    return {
      ...updated,
      startDate: updated.startDate?.toISOString() ?? null,
      maturityDate: updated.maturityDate?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }
  })
