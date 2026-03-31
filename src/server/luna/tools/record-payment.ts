import {
  db,
  payments,
  paymentSchedule,
  loans,
  contacts,
  lenderSettings,
} from "@/lib/db"
import { eq, and, sql, ne, ilike, asc } from "drizzle-orm"
import { assertTransition } from "@/server/loans"
import { parseLenderConfig } from "@/lib/constants/lender-defaults"
import { sendEmail, paymentReceiptEmail } from "@/lib/email"
import type { LunaTool } from "./index"

// Step 1: Prepare — resolve borrower/loan/installment and show preview
export const preparePaymentTool: LunaTool = {
  definition: {
    name: "prepare_payment",
    description:
      "Prepare a payment for recording. Resolves the borrower's loan and next unpaid installment, then shows a confirmation preview. The lender must approve before the payment is actually recorded. Use this FIRST — do NOT call confirm_payment without prepare_payment.",
    input_schema: {
      type: "object" as const,
      properties: {
        borrowerName: {
          type: "string",
          description: "Borrower name to look up",
        },
        loanId: {
          type: "string",
          description: "Loan ID (use if you already have it)",
        },
        amount: {
          type: "number",
          description: "Payment amount in PHP",
        },
        method: {
          type: "string",
          enum: ["cash", "gcash", "maya", "bank"],
          description: "Payment method",
        },
        notes: {
          type: "string",
          description: "Optional payment notes",
        },
      },
      required: ["amount", "method"],
    },
  },
  async execute(
    input: {
      borrowerName?: string
      loanId?: string
      amount: number
      method: "cash" | "gcash" | "maya" | "bank"
      notes?: string
    },
    lenderId: string,
  ) {
    // Resolve loan
    let loan: any

    if (input.loanId) {
      loan = await db.query.loans.findFirst({
        where: and(eq(loans.id, input.loanId), eq(loans.lenderId, lenderId)),
        with: { contact: true },
      })
    } else if (input.borrowerName) {
      const [row] = await db
        .select()
        .from(loans)
        .innerJoin(contacts, eq(loans.contactId, contacts.id))
        .where(
          and(
            eq(loans.lenderId, lenderId),
            eq(loans.status, "active"),
            ilike(contacts.name, `%${input.borrowerName}%`),
          ),
        )
        .limit(1)

      if (row) {
        loan = await db.query.loans.findFirst({
          where: eq(loans.id, row.loans.id),
          with: { contact: true },
        })
      }
    } else {
      return {
        result: "Error: Provide either a borrowerName or loanId.",
      }
    }

    if (!loan) return { result: "Error: No active loan found for this borrower." }
    if (loan.status !== "active")
      return { result: `Error: Loan is not active (status: ${loan.status})` }

    // Resolve next unpaid installment
    const [scheduleItem] = await db
      .select()
      .from(paymentSchedule)
      .where(
        and(
          eq(paymentSchedule.loanId, loan.id),
          sql`${paymentSchedule.status} IN ('overdue', 'pending', 'partial')`,
        ),
      )
      .orderBy(asc(paymentSchedule.dueDate))
      .limit(1)

    if (!scheduleItem) return { result: "Error: No unpaid installment found." }

    // Validate amount
    const itemRemaining =
      parseFloat(scheduleItem.amount) - parseFloat(scheduleItem.paidAmount)
    if (input.amount > itemRemaining)
      return {
        result: `Error: ₱${input.amount.toFixed(2)} exceeds installment balance of ₱${itemRemaining.toFixed(2)}.`,
      }

    const remainingBalance = parseFloat(loan.remainingBalance)
    if (input.amount > remainingBalance)
      return {
        result: `Error: ₱${input.amount.toFixed(2)} exceeds loan balance of ₱${remainingBalance.toFixed(2)}.`,
      }

    const fmt = (n: number) =>
      `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
    const dueDateStr = new Date(scheduleItem.dueDate).toLocaleDateString(
      "en-PH",
      { month: "long", day: "numeric", year: "numeric" },
    )

    return {
      result: `Ready to record: ${fmt(input.amount)} via ${input.method} for ${loan.contact?.name} (installment due ${dueDateStr}). Remaining installment balance: ${fmt(itemRemaining)}. Waiting for lender confirmation.`,
      contextCard: {
        type: "payment_preview" as const,
        title: "Confirm Payment",
        data: {
          loanId: loan.id,
          scheduleItemId: scheduleItem.id,
          borrowerName: loan.contact?.name,
          amount: input.amount,
          method: input.method,
          notes: input.notes,
          installmentDueDate: scheduleItem.dueDate,
          installmentAmount: parseFloat(scheduleItem.amount),
          installmentRemaining: itemRemaining,
          loanRemainingBalance: remainingBalance,
        },
      },
    }
  },
}

// Step 2: Confirm — actually execute the payment
export const confirmPaymentTool: LunaTool = {
  definition: {
    name: "confirm_payment",
    description:
      "Execute a previously prepared payment. Only call this AFTER prepare_payment has been shown and the lender has confirmed. Requires the exact loanId and scheduleItemId from the prepare_payment result.",
    input_schema: {
      type: "object" as const,
      properties: {
        loanId: {
          type: "string",
          description: "Loan ID from prepare_payment",
        },
        scheduleItemId: {
          type: "string",
          description: "Schedule item ID from prepare_payment",
        },
        amount: {
          type: "number",
          description: "Payment amount",
        },
        method: {
          type: "string",
          enum: ["cash", "gcash", "maya", "bank"],
          description: "Payment method",
        },
        notes: {
          type: "string",
          description: "Optional notes",
        },
      },
      required: ["loanId", "scheduleItemId", "amount", "method"],
    },
  },
  async execute(
    input: {
      loanId: string
      scheduleItemId: string
      amount: number
      method: "cash" | "gcash" | "maya" | "bank"
      notes?: string
    },
    lenderId: string,
  ) {
    const loan = await db.query.loans.findFirst({
      where: and(eq(loans.id, input.loanId), eq(loans.lenderId, lenderId)),
      with: { contact: true },
    })

    if (!loan) return { result: "Error: Loan not found." }
    if (loan.status !== "active")
      return { result: `Error: Loan is not active (status: ${loan.status})` }

    const scheduleItem = await db.query.paymentSchedule.findFirst({
      where: eq(paymentSchedule.id, input.scheduleItemId),
    })

    if (!scheduleItem) return { result: "Error: Schedule item not found." }

    // Duplicate check
    const recentDuplicate = await db.query.payments.findFirst({
      where: and(
        eq(payments.loanId, input.loanId),
        eq(payments.scheduleItemId, input.scheduleItemId),
        eq(payments.type, "credit"),
        eq(payments.amount, input.amount.toFixed(2)),
        sql`${payments.createdAt} > NOW() - INTERVAL '60 seconds'`,
        sql`${payments.reversedAt} IS NULL`,
      ),
    })
    if (recentDuplicate)
      return { result: "Error: Duplicate payment detected." }

    // Overpayment checks
    const remainingBalance = parseFloat(loan.remainingBalance)
    if (input.amount > remainingBalance)
      return { result: `Error: Exceeds loan balance.` }

    const itemRemaining =
      parseFloat(scheduleItem.amount) - parseFloat(scheduleItem.paidAmount)
    if (input.amount > itemRemaining)
      return { result: `Error: Exceeds installment balance.` }

    // Compute
    const paymentId = crypto.randomUUID()
    const paymentDate = new Date()
    const newAmountPaid = parseFloat(loan.amountPaid) + input.amount
    const newRemainingBalance = parseFloat(loan.totalToRepay) - newAmountPaid
    const isCompleted = newRemainingBalance <= 0.05
    const nextStatus = isCompleted ? "completed" : "active"

    if (isCompleted) assertTransition(loan.status, "completed")

    const principal = parseFloat(loan.principal)
    const totalToRepay = parseFloat(loan.totalToRepay)
    const interestRatio =
      totalToRepay > 0 ? (totalToRepay - principal) / totalToRepay : 0
    const newInterestEarned =
      parseFloat(loan.interestEarned) + input.amount * interestRatio

    const newPaidAmount = parseFloat(scheduleItem.paidAmount) + input.amount
    const itemFullyPaid = newPaidAmount >= parseFloat(scheduleItem.amount)

    // Atomic writes
    const writes: any[] = [
      db
        .insert(payments)
        .values({
          id: paymentId,
          loanId: input.loanId,
          amount: input.amount.toFixed(2),
          method: input.method,
          type: "credit",
          scheduleItemId: input.scheduleItemId,
          paidAt: paymentDate,
          notes: input.notes || null,
        })
        .returning(),
      db
        .update(loans)
        .set({
          amountPaid: newAmountPaid.toFixed(2),
          interestEarned: newInterestEarned.toFixed(2),
          remainingBalance: Math.max(0, newRemainingBalance).toFixed(2),
          status: nextStatus,
          completedAt: isCompleted ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(loans.id, input.loanId)),
      db
        .update(paymentSchedule)
        .set({
          paidAmount: newPaidAmount.toFixed(2),
          status: itemFullyPaid ? "paid" : "partial",
          paidAt: itemFullyPaid ? paymentDate : null,
        })
        .where(eq(paymentSchedule.id, input.scheduleItemId)),
    ]

    if (isCompleted) {
      writes.push(
        db
          .update(paymentSchedule)
          .set({
            status: "paid",
            paidAmount: sql`${paymentSchedule.amount}`,
            paidAt: paymentDate,
          })
          .where(
            and(
              eq(paymentSchedule.loanId, input.loanId),
              ne(paymentSchedule.status, "paid"),
              ne(paymentSchedule.id, input.scheduleItemId),
            ),
          ),
      )
    }

    await db.batch(writes as any)

    // Receipt email
    try {
      const settingsRow = await db.query.lenderSettings.findFirst({
        where: eq(lenderSettings.lenderId, lenderId),
      })
      const lenderConfig = parseLenderConfig(settingsRow?.config ?? null)
      if (lenderConfig.paymentReceiptsEnabled && loan.contact?.email) {
        const { subject, html, text } = await paymentReceiptEmail({
          borrowerName: loan.contact.name,
          lenderName: "Lender",
          amount: input.amount.toFixed(2),
          method: input.method,
          paidAt: paymentDate.toLocaleDateString("en-PH", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          remainingBalance: Math.max(0, newRemainingBalance).toFixed(2),
          loanReference: loan.id.slice(0, 8).toUpperCase(),
          loanPortalUrl: loan.borrowerToken
            ? `${process.env.BETTER_AUTH_URL || "https://loona.ph"}/share/loan/${loan.borrowerToken}`
            : undefined,
        })
        sendEmail({ to: loan.contact.email, subject, html, text }).catch(
          () => {},
        )
      }
    } catch {
      // non-critical
    }

    const fmt = (n: number) =>
      `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`

    return {
      result: `Payment recorded! ${fmt(input.amount)} via ${input.method} for ${loan.contact?.name ?? "borrower"}. ${isCompleted ? "Loan is now fully paid!" : `Remaining: ${fmt(Math.max(0, newRemainingBalance))}`}`,
      contextCard: {
        type: "payment_confirmation" as const,
        title: "Payment Recorded",
        data: {
          paymentId,
          loanId: input.loanId,
          borrowerName: loan.contact?.name,
          amount: input.amount,
          method: input.method,
          remainingBalance: Math.max(0, newRemainingBalance),
          isCompleted,
          paidAt: paymentDate.toISOString(),
        },
      },
    }
  },
}
