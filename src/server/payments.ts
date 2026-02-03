import { createServerFn } from "@tanstack/react-start"
import {
  db,
  payments,
  paymentSchedule,
  loans,
  contacts,
  commissions,
  agents,
} from "@/lib/db"
import { eq, desc, and, sql, lte, ne } from "drizzle-orm"
import { requireAuth } from "./session"
import { createAuditLogger } from "./audit"
import { z } from "zod"

// Validation schemas
const recordPaymentSchema = z.object({
  loanId: z.string().min(1),
  scheduleItemId: z.string().min(1, "Schedule item is required"),
  amount: z.number().positive(),
  method: z.enum(["cash", "gcash", "maya", "bank"]),
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
      paidAt: payments.paidAt,
      notes: payments.notes,
      loanId: loans.id,
      contactName: contacts.name,
      principal: loans.principal,
    })
    .from(payments)
    .innerJoin(loans, eq(payments.loanId, loans.id))
    .innerJoin(contacts, eq(loans.contactId, contacts.id))
    .where(eq(loans.lenderId, session.user.id))
    .orderBy(desc(payments.paidAt))
    .limit(100)

  return result.map((p) => ({
    ...p,
    paidAt: p.paidAt.toISOString(),
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

  return result.map((p) => ({
    ...p,
    dueDate: p.dueDate.toISOString(),
  }))
})

export const recordPayment = createServerFn<{
  data: z.infer<typeof recordPaymentSchema>
}>().handler(async (ctx) => {
  const session = await requireAuth()
  const data = recordPaymentSchema.parse(ctx.data)

  // Get the loan
  const loan = await db.query.loans.findFirst({
    where: eq(loans.id, data.loanId),
    with: {
      assignedAgent: true,
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

  if (loan.status !== "active") {
    throw new Error("Loan is not active")
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

  // Create payment record
  const [payment] = await db
    .insert(payments)
    .values({
      loanId: data.loanId,
      amount: data.amount.toFixed(2),
      method: data.method,
      scheduleItemId: data.scheduleItemId || null,
      recordedByAgentId: agentId,
      notes: data.notes || null,
    })
    .returning()

  // Update loan balances
  const newAmountPaid = parseFloat(loan.amountPaid) + data.amount
  const newRemainingBalance = parseFloat(loan.totalToRepay) - newAmountPaid
  const isCompleted = newRemainingBalance <= 0

  await db
    .update(loans)
    .set({
      amountPaid: newAmountPaid.toFixed(2),
      remainingBalance: Math.max(0, newRemainingBalance).toFixed(2),
      status: isCompleted ? "completed" : "active",
      completedAt: isCompleted ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(loans.id, data.loanId))

  // Update schedule item (required)
  if (!data.scheduleItemId) {
    throw new Error("Schedule item is required")
  }

  const scheduleItem = await db.query.paymentSchedule.findFirst({
    where: eq(paymentSchedule.id, data.scheduleItemId),
  })

  if (!scheduleItem) {
    throw new Error("Schedule item not found")
  }

  const newPaidAmount = parseFloat(scheduleItem.paidAmount) + data.amount
  const scheduleAmount = parseFloat(scheduleItem.amount)
  const isPaid = newPaidAmount >= scheduleAmount

  await db
    .update(paymentSchedule)
    .set({
      paidAmount: newPaidAmount.toFixed(2),
      status: isPaid ? "paid" : "partial",
      paidAt: isPaid ? new Date() : null,
    })
    .where(eq(paymentSchedule.id, data.scheduleItemId))

  // Create commission record if recorded by agent
  if (agentId && agentRecord) {
    const commissionAmount =
      data.amount * (parseFloat(agentRecord.commissionRate) / 100)

    await db.insert(commissions).values({
      agentId,
      paymentId: payment.id,
      paymentAmount: data.amount.toFixed(2),
      commissionRate: agentRecord.commissionRate,
      commissionAmount: commissionAmount.toFixed(2),
    })

    // Update agent totals
    await db
      .update(agents)
      .set({
        totalCollected: sql`${agents.totalCollected} + ${data.amount}`,
        totalCommissionEarned: sql`${agents.totalCommissionEarned} + ${commissionAmount}`,
      })
      .where(eq(agents.id, agentId))
  }

  // Audit log
  const log = createAuditLogger(session.user)
  log("payment.record", "payment", payment.id, {
    loanId: data.loanId,
    amount: data.amount,
    method: data.method,
    isAgent: !!agentId,
    loanCompleted: isCompleted,
  })

  return {
    ...payment,
    paidAt: payment.paidAt.toISOString(),
    createdAt: payment.createdAt.toISOString(),
  }
})

// Update overdue payments (can be called by cron)
export const updateOverduePayments = createServerFn().handler(async () => {
  const now = new Date()

  await db
    .update(paymentSchedule)
    .set({ status: "overdue" })
    .where(
      and(eq(paymentSchedule.status, "pending"), lte(paymentSchedule.dueDate, now))
    )

  return { success: true }
})
