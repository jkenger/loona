import { db, payments, paymentSchedule, loans, contacts, commissions, agents } from "@/lib/db"
import { eq, desc, and, sql, lte, ne } from "drizzle-orm"

/**
 * Shared payment service functions
 * These contain core business logic used by both lender and agent features
 */

export interface PaymentRecord {
  id: string
  amount: string
  method: string
  paidAt: string
  notes: string | null
  loanId: string
  contactName: string
  principal: string
}

export interface UpcomingPayment {
  id: string
  dueDate: string
  amount: string
  status: string
  paidAmount: string
  loanId: string
  contactName: string
  contactId: string
  contactPhone?: string | null
}

/**
 * Get payments for a lender
 */
export async function getPaymentsForLender(lenderId: string): Promise<PaymentRecord[]> {
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
    .where(eq(loans.lenderId, lenderId))
    .orderBy(desc(payments.paidAt))
    .limit(100)

  return result.map((p) => ({
    ...p,
    paidAt: p.paidAt.toISOString(),
  }))
}

/**
 * Get payments for an agent's assigned loans
 */
export async function getPaymentsForAgent(agentIds: string[]): Promise<(PaymentRecord & { recordedByMe: boolean })[]> {
  if (agentIds.length === 0) return []

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
      recordedByMe: sql<boolean>`${payments.recordedByAgentId} IN ${agentIds}`,
    })
    .from(payments)
    .innerJoin(loans, eq(payments.loanId, loans.id))
    .innerJoin(contacts, eq(loans.contactId, contacts.id))
    .where(sql`${loans.assignedAgentId} IN ${agentIds}`)
    .orderBy(desc(payments.paidAt))
    .limit(100)

  return result.map((p) => ({
    ...p,
    paidAt: p.paidAt.toISOString(),
  }))
}

/**
 * Get upcoming/overdue payments for a lender
 */
export async function getUpcomingPaymentsForLender(lenderId: string): Promise<UpcomingPayment[]> {
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
        eq(loans.lenderId, lenderId),
        ne(paymentSchedule.status, "paid"),
        lte(paymentSchedule.dueDate, next30Days)
      )
    )
    .orderBy(paymentSchedule.dueDate)

  return result.map((p) => ({
    ...p,
    dueDate: p.dueDate.toISOString(),
  }))
}

/**
 * Get upcoming/overdue payments for an agent's assigned loans
 */
export async function getUpcomingPaymentsForAgent(agentIds: string[]): Promise<(UpcomingPayment & { contactPhone: string | null })[]> {
  if (agentIds.length === 0) return []

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
      contactPhone: contacts.phone,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .innerJoin(contacts, eq(loans.contactId, contacts.id))
    .where(
      and(
        sql`${loans.assignedAgentId} IN ${agentIds}`,
        ne(paymentSchedule.status, "paid"),
        lte(paymentSchedule.dueDate, next30Days)
      )
    )
    .orderBy(paymentSchedule.dueDate)

  return result.map((p) => ({
    ...p,
    dueDate: p.dueDate.toISOString(),
  }))
}

/**
 * Record a payment - shared logic for both lender and agent
 */
export interface RecordPaymentParams {
  loanId: string
  amount: number
  method: "cash" | "gcash" | "maya" | "bank"
  scheduleItemId?: string
  notes?: string
  agentId?: string | null
  agentRecord?: { commissionRate: string } | null
}

export async function recordPaymentCore(params: RecordPaymentParams) {
  const { loanId, amount, method, scheduleItemId, notes, agentId, agentRecord } = params

  // Create payment record
  const [payment] = await db
    .insert(payments)
    .values({
      loanId,
      amount: amount.toFixed(2),
      method,
      scheduleItemId: scheduleItemId || null,
      recordedByAgentId: agentId || null,
      notes: notes || null,
    })
    .returning()

  // Get loan for balance update
  const loan = await db.query.loans.findFirst({
    where: eq(loans.id, loanId),
  })

  if (!loan) {
    throw new Error("Loan not found")
  }

  // Update loan balances
  const newAmountPaid = parseFloat(loan.amountPaid) + amount
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
    .where(eq(loans.id, loanId))

  // Update schedule item if specified
  if (scheduleItemId) {
    const scheduleItem = await db.query.paymentSchedule.findFirst({
      where: eq(paymentSchedule.id, scheduleItemId),
    })

    if (scheduleItem) {
      const newPaidAmount = parseFloat(scheduleItem.paidAmount) + amount
      const scheduleAmount = parseFloat(scheduleItem.amount)
      const isPaid = newPaidAmount >= scheduleAmount

      await db
        .update(paymentSchedule)
        .set({
          paidAmount: newPaidAmount.toFixed(2),
          status: isPaid ? "paid" : "partial",
          paidAt: isPaid ? new Date() : null,
        })
        .where(eq(paymentSchedule.id, scheduleItemId))
    }
  }

  // Create commission record if recorded by agent
  if (agentId && agentRecord) {
    const commissionAmount = amount * (parseFloat(agentRecord.commissionRate) / 100)

    await db.insert(commissions).values({
      agentId,
      paymentId: payment.id,
      paymentAmount: amount.toFixed(2),
      commissionRate: agentRecord.commissionRate,
      commissionAmount: commissionAmount.toFixed(2),
    })

    // Update agent totals
    await db
      .update(agents)
      .set({
        totalCollected: sql`${agents.totalCollected} + ${amount}`,
        totalCommissionEarned: sql`${agents.totalCommissionEarned} + ${commissionAmount}`,
      })
      .where(eq(agents.id, agentId))
  }

  return {
    payment,
    isCompleted,
  }
}
