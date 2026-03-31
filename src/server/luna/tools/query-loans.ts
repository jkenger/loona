import { db, loans, paymentSchedule, contacts } from "@/lib/db"
import { eq, and, ilike, desc } from "drizzle-orm"
import type { LunaTool } from "./index"

export const getOverdueLoans: LunaTool = {
  definition: {
    name: "get_overdue_loans",
    description:
      "Get all overdue payment schedule items with borrower info and amounts. Use when the lender asks about overdue loans, late payments, or delinquent borrowers.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Max results to return (default 10)",
        },
      },
      required: [],
    },
  },
  async execute(input: { limit?: number }, lenderId: string) {
    const limit = input.limit ?? 10

    const rows = await db
      .select({
        scheduleId: paymentSchedule.id,
        loanId: loans.id,
        borrowerName: contacts.name,
        dueDate: paymentSchedule.dueDate,
        amount: paymentSchedule.amount,
        paidAmount: paymentSchedule.paidAmount,
        principal: loans.principal,
        remainingBalance: loans.remainingBalance,
      })
      .from(paymentSchedule)
      .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
      .innerJoin(contacts, eq(loans.contactId, contacts.id))
      .where(
        and(
          eq(loans.lenderId, lenderId),
          eq(paymentSchedule.status, "overdue"),
          eq(loans.status, "active"),
        ),
      )
      .orderBy(paymentSchedule.dueDate)
      .limit(limit)

    const totalOverdue = rows.reduce(
      (sum, r) => sum + (Number(r.amount) - Number(r.paidAmount)),
      0,
    )

    return {
      result: `Found ${rows.length} overdue payments totaling ₱${totalOverdue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}. ${rows.map((r) => `${r.borrowerName}: ₱${(Number(r.amount) - Number(r.paidAmount)).toLocaleString("en-PH", { minimumFractionDigits: 2 })} due ${new Date(r.dueDate!).toLocaleDateString("en-PH")}`).join("; ")}`,
      contextCard: {
        type: "overdue_loans_table" as const,
        title: "Overdue Payments",
        data: rows.map((r) => ({
          scheduleId: r.scheduleId,
          loanId: r.loanId,
          borrowerName: r.borrowerName,
          dueDate: r.dueDate,
          amountDue: Number(r.amount) - Number(r.paidAmount),
          principal: Number(r.principal),
          remainingBalance: Number(r.remainingBalance),
        })),
      },
    }
  },
}

export const getLoanDetails: LunaTool = {
  definition: {
    name: "get_loan_details",
    description:
      "Get full details of a specific loan including schedule, payments, and borrower info. Use when the lender asks about a specific loan or borrower's loan.",
    input_schema: {
      type: "object" as const,
      properties: {
        loanId: {
          type: "string",
          description: "Loan ID to look up",
        },
        borrowerName: {
          type: "string",
          description:
            "Borrower name to search for (use if loanId not known)",
        },
      },
      required: [],
    },
  },
  async execute(
    input: { loanId?: string; borrowerName?: string },
    lenderId: string,
  ) {
    let loan: any

    if (input.loanId) {
      const [row] = await db
        .select()
        .from(loans)
        .innerJoin(contacts, eq(loans.contactId, contacts.id))
        .where(and(eq(loans.id, input.loanId), eq(loans.lenderId, lenderId)))

      loan = row
    } else if (input.borrowerName) {
      const [row] = await db
        .select()
        .from(loans)
        .innerJoin(contacts, eq(loans.contactId, contacts.id))
        .where(
          and(
            eq(loans.lenderId, lenderId),
            ilike(contacts.name, `%${input.borrowerName}%`),
            eq(loans.status, "active"),
          ),
        )
        .orderBy(desc(loans.createdAt))
        .limit(1)

      loan = row
    }

    if (!loan) return { result: "Loan not found" }

    const schedule = await db
      .select()
      .from(paymentSchedule)
      .where(eq(paymentSchedule.loanId, loan.loans.id))
      .orderBy(paymentSchedule.dueDate)

    const paidCount = schedule.filter((s) => s.status === "paid").length
    const overdueCount = schedule.filter((s) => s.status === "overdue").length

    return {
      result: `Loan for ${loan.contacts.name}: ₱${Number(loan.loans.principal).toLocaleString("en-PH")} principal, ₱${Number(loan.loans.remainingBalance).toLocaleString("en-PH")} remaining. ${loan.loans.interestRate}% interest, ${loan.loans.paymentFrequency} payments of ₱${Number(loan.loans.paymentAmount).toLocaleString("en-PH")}. Status: ${loan.loans.status}. ${paidCount}/${schedule.length} payments completed, ${overdueCount} overdue.`,
      contextCard: {
        type: "loan_detail" as const,
        title: `Loan — ${loan.contacts.name}`,
        data: {
          loan: {
            id: loan.loans.id,
            principal: Number(loan.loans.principal),
            interestRate: Number(loan.loans.interestRate),
            termMonths: loan.loans.termMonths,
            paymentFrequency: loan.loans.paymentFrequency,
            paymentAmount: Number(loan.loans.paymentAmount),
            totalToRepay: Number(loan.loans.totalToRepay),
            amountPaid: Number(loan.loans.amountPaid),
            remainingBalance: Number(loan.loans.remainingBalance),
            status: loan.loans.status,
            startDate: loan.loans.startDate,
            maturityDate: loan.loans.maturityDate,
          },
          borrower: {
            id: loan.contacts.id,
            name: loan.contacts.name,
            phone: loan.contacts.phone,
            tier: loan.contacts.tier,
          },
          schedule: schedule.map((s) => ({
            id: s.id,
            dueDate: s.dueDate,
            amount: Number(s.amount),
            paidAmount: Number(s.paidAmount),
            status: s.status,
          })),
        },
      },
    }
  },
}

export const searchLoans: LunaTool = {
  definition: {
    name: "search_loans",
    description:
      "Search loans by status or borrower name. Use when the lender asks to list loans with a filter.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: [
            "active",
            "completed",
            "defaulted",
            "pending_disbursement",
            "pending_approval",
          ],
          description: "Filter by loan status",
        },
        borrowerName: {
          type: "string",
          description: "Filter by borrower name (partial match)",
        },
        limit: {
          type: "number",
          description: "Max results (default 10)",
        },
      },
      required: [],
    },
  },
  async execute(
    input: { status?: string; borrowerName?: string; limit?: number },
    lenderId: string,
  ) {
    const conditions = [eq(loans.lenderId, lenderId)]
    if (input.status) conditions.push(eq(loans.status, input.status as any))
    if (input.borrowerName)
      conditions.push(ilike(contacts.name, `%${input.borrowerName}%`))

    const rows = await db
      .select({
        loanId: loans.id,
        borrowerName: contacts.name,
        principal: loans.principal,
        remainingBalance: loans.remainingBalance,
        status: loans.status,
        interestRate: loans.interestRate,
        startDate: loans.startDate,
        paymentFrequency: loans.paymentFrequency,
      })
      .from(loans)
      .innerJoin(contacts, eq(loans.contactId, contacts.id))
      .where(and(...conditions))
      .orderBy(desc(loans.createdAt))
      .limit(input.limit ?? 10)

    return {
      result: `Found ${rows.length} loans. ${rows.map((r) => `${r.borrowerName}: ₱${Number(r.principal).toLocaleString("en-PH")} (${r.status})`).join("; ")}`,
      contextCard: {
        type: "loan_detail" as const,
        title: `Loans${input.status ? ` — ${input.status}` : ""}`,
        data: rows,
      },
    }
  },
}
