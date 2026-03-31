import { db, payments, loans, contacts, paymentSchedule } from "@/lib/db"
import { eq, and, desc, isNull } from "drizzle-orm"
import type { LunaTool } from "./index"

export const getRecentPayments: LunaTool = {
  definition: {
    name: "get_recent_payments",
    description:
      "Get recent payment transactions across all loans. Use when the lender asks about recent collections or payment activity.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Max results (default 10)",
        },
      },
      required: [],
    },
  },
  async execute(input: { limit?: number }, lenderId: string) {
    const rows = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        method: payments.method,
        type: payments.type,
        paidAt: payments.paidAt,
        notes: payments.notes,
        loanId: loans.id,
        borrowerName: contacts.name,
        scheduleDueDate: paymentSchedule.dueDate,
      })
      .from(payments)
      .innerJoin(loans, eq(payments.loanId, loans.id))
      .innerJoin(contacts, eq(loans.contactId, contacts.id))
      .leftJoin(
        paymentSchedule,
        eq(payments.scheduleItemId, paymentSchedule.id),
      )
      .where(
        and(
          eq(loans.lenderId, lenderId),
          eq(payments.type, "credit"),
          isNull(payments.reversedAt),
        ),
      )
      .orderBy(desc(payments.paidAt))
      .limit(input.limit ?? 10)

    const total = rows.reduce((sum, r) => sum + Number(r.amount), 0)

    return {
      result: `${rows.length} recent payments totaling ₱${total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}. ${rows.map((r) => `${r.borrowerName}: ₱${Number(r.amount).toLocaleString("en-PH")} via ${r.method} on ${new Date(r.paidAt!).toLocaleDateString("en-PH")}`).join("; ")}`,
      contextCard: {
        type: "payment_history" as const,
        title: "Recent Payments",
        data: rows.map((r) => ({
          id: r.id,
          amount: Number(r.amount),
          method: r.method,
          paidAt: r.paidAt,
          borrowerName: r.borrowerName,
          loanId: r.loanId,
          scheduleDueDate: r.scheduleDueDate,
        })),
      },
    }
  },
}

export const getPaymentsByLoan: LunaTool = {
  definition: {
    name: "get_payments_by_loan",
    description:
      "Get all payments for a specific loan. Use when the lender asks about payment history for a particular borrower or loan.",
    input_schema: {
      type: "object" as const,
      properties: {
        loanId: {
          type: "string",
          description: "Loan ID",
        },
      },
      required: ["loanId"],
    },
  },
  async execute(input: { loanId: string }, lenderId: string) {
    // Verify loan belongs to lender
    const [loan] = await db
      .select({ id: loans.id, contactId: loans.contactId })
      .from(loans)
      .where(and(eq(loans.id, input.loanId), eq(loans.lenderId, lenderId)))

    if (!loan) return { result: "Loan not found or access denied" }

    const [contact] = await db
      .select({ name: contacts.name })
      .from(contacts)
      .where(eq(contacts.id, loan.contactId))

    const rows = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        method: payments.method,
        type: payments.type,
        paidAt: payments.paidAt,
        notes: payments.notes,
        reversedAt: payments.reversedAt,
        scheduleDueDate: paymentSchedule.dueDate,
        scheduleAmount: paymentSchedule.amount,
      })
      .from(payments)
      .leftJoin(
        paymentSchedule,
        eq(payments.scheduleItemId, paymentSchedule.id),
      )
      .where(eq(payments.loanId, input.loanId))
      .orderBy(desc(payments.paidAt))

    const activePayments = rows.filter((r) => !r.reversedAt)
    const total = activePayments.reduce(
      (sum, r) => sum + (r.type === "credit" ? Number(r.amount) : 0),
      0,
    )

    return {
      result: `${activePayments.length} payments for ${contact?.name ?? "unknown"}'s loan totaling ₱${total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}.`,
      contextCard: {
        type: "payment_history" as const,
        title: `Payments — ${contact?.name ?? "Loan"}`,
        data: rows.map((r) => ({
          id: r.id,
          amount: Number(r.amount),
          method: r.method,
          type: r.type,
          paidAt: r.paidAt,
          reversed: !!r.reversedAt,
          scheduleDueDate: r.scheduleDueDate,
          scheduleAmount: r.scheduleAmount ? Number(r.scheduleAmount) : null,
        })),
      },
    }
  },
}
