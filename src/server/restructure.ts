import { createServerFn } from "@tanstack/react-start"
import { db, loans, paymentSchedule, loanRestructures } from "@/lib/db"
import { eq, and, ne } from "drizzle-orm"
import { z } from "zod"
import { requireAuth } from "./session"
import { createAuditLogger } from "./audit"

const restructureLoanSchema = z.object({
  loanId: z.string().min(1),
  additionalMonths: z.number().int().min(0),
  balanceReduction: z.number().min(0),
  reason: z.string().optional(),
})

export const restructureLoan = createServerFn()
  .inputValidator(restructureLoanSchema)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, data.loanId),
    })

    if (!loan || loan.lenderId !== session.user.id) {
      throw new Error("Loan not found")
    }

    if (loan.status !== "active") {
      throw new Error("Only active loans can be restructured")
    }

    if (data.additionalMonths === 0 && data.balanceReduction === 0) {
      throw new Error("Provide at least an additional months or balance reduction")
    }

    const prevBalance = parseFloat(loan.remainingBalance)

    if (data.balanceReduction > prevBalance) {
      throw new Error("Balance reduction cannot exceed remaining balance")
    }

    const newBalance = prevBalance - data.balanceReduction
    const totalMonths = loan.termMonths + data.additionalMonths

    const frequency = loan.paymentFrequency as "daily" | "weekly" | "biweekly" | "semimonthly" | "monthly"

    // Cancel all pending schedule items
    const pending = await db.query.paymentSchedule.findMany({
      where: and(
        eq(paymentSchedule.loanId, data.loanId),
        ne(paymentSchedule.status, "paid"),
      ),
      orderBy: (s, { asc }) => [asc(s.dueDate)],
    })

    if (pending.length === 0) {
      throw new Error("No pending installments to restructure")
    }

    // New installment count = pending items + any extra from extension
    // This correctly accounts for payments already made regardless of the original term
    const extraPayments = data.additionalMonths > 0 ? calculatePaymentsCount(data.additionalMonths, frequency) : 0
    const newPaymentsCount = pending.length + extraPayments
    const newPaymentAmount = newPaymentsCount > 0 ? newBalance / newPaymentsCount : newBalance

    // Use the first pending item's due date as start for the new schedule
    const startDate = new Date(pending[0].dueDate)
    startDate.setDate(startDate.getDate() - 1) // generatePaymentSchedule advances by 1 period from startDate

    const newScheduleItems = generatePaymentSchedule(
      data.loanId,
      startDate,
      newPaymentsCount,
      newPaymentAmount,
      frequency,
      newBalance,
    )

    const restructureId = crypto.randomUUID()
    const now = new Date()

    // Atomic: mark old pending items restructured, insert new ones, update loan, insert audit
    await db.batch([
      // Mark pending items as restructured (soft-cancel via restructuredAt)
      ...pending.map((item) =>
        db.update(paymentSchedule)
          .set({ status: "paid", paidAmount: item.amount, paidAt: now, restructuredAt: now })
          .where(eq(paymentSchedule.id, item.id))
      ),
      // Insert new schedule items
      db.insert(paymentSchedule).values(
        newScheduleItems.map((item) => ({
          loanId: item.loanId,
          dueDate: item.dueDate,
          amount: item.amount,
        }))
      ),
      // Update loan
      db.update(loans).set({
        remainingBalance: newBalance.toFixed(2),
        paymentAmount: newPaymentAmount.toFixed(2),
        termMonths: totalMonths,
        restructureCount: (loan.restructureCount ?? 0) + 1,
        updatedAt: now,
      }).where(eq(loans.id, data.loanId)),
      // Insert restructure audit record
      db.insert(loanRestructures).values({
        id: restructureId,
        loanId: data.loanId,
        createdById: session.user.id,
        previousRemainingBalance: prevBalance.toFixed(2),
        balanceReduction: data.balanceReduction.toFixed(2),
        newRemainingBalance: newBalance.toFixed(2),
        additionalMonths: data.additionalMonths,
        newPaymentAmount: newPaymentAmount.toFixed(2),
        reason: data.reason ?? null,
      }),
    ] as any)

    const log = createAuditLogger(session.user)
    log("loan.restructure", "loan", data.loanId, {
      restructureId,
      prevBalance,
      newBalance,
      additionalMonths: data.additionalMonths,
      balanceReduction: data.balanceReduction,
    })

    return { success: true, restructureId }
  })

function calculatePaymentsCount(
  termMonths: number,
  frequency: "daily" | "weekly" | "biweekly" | "semimonthly" | "monthly"
): number {
  switch (frequency) {
    case "daily": return termMonths * 30
    case "weekly": return termMonths * 4
    case "biweekly": return termMonths * 2
    case "semimonthly": return termMonths * 2
    case "monthly":
    default: return termMonths
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

    let itemAmount = roundedAmount
    if (totalToRepay !== undefined && i === paymentsCount - 1) {
      const sumSoFar = parseFloat(roundedAmount) * (paymentsCount - 1)
      itemAmount = (totalToRepay - sumSoFar).toFixed(2)
    }

    schedule.push({ loanId, dueDate: new Date(currentDate), amount: itemAmount })
  }

  return schedule
}
