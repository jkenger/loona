import type Anthropic from "@anthropic-ai/sdk"
import { db, loans, contacts, paymentSchedule, penalties } from "@/lib/db"
import { eq, and, sql, desc, gte, lte, ilike, or } from "drizzle-orm"
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns"

export const advisorTools: Anthropic.Tool[] = [
  {
    name: "get_portfolio_summary",
    description: "Get overall portfolio stats including active loans, disbursed amounts, outstanding balances, collection rates, and earnings. Use this for general portfolio health questions.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_loan_details",
    description: "Get details of a specific loan including schedule, payments, and penalties. Search by loan ID or borrower name.",
    input_schema: {
      type: "object" as const,
      properties: {
        loan_id: { type: "string", description: "The loan ID (if known)" },
        borrower_name: { type: "string", description: "Borrower name to search for (partial match)" },
      },
      required: [],
    },
  },
  {
    name: "get_borrower_profile",
    description: "Get borrower contact info, income, tier, on-time rate, and loan history. Search by ID or name.",
    input_schema: {
      type: "object" as const,
      properties: {
        contact_id: { type: "string", description: "The contact/borrower ID (if known)" },
        borrower_name: { type: "string", description: "Borrower name to search for (partial match)" },
      },
      required: [],
    },
  },
  {
    name: "get_overdue_report",
    description: "Get all overdue payment schedule items with borrower names, days overdue, and amounts. Use this when asked about overdue borrowers or collections needing attention.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max items to return (default 20)" },
      },
      required: [],
    },
  },
  {
    name: "get_penalty_summary",
    description: "Get breakdown of penalties — pending, applied, and waived — with amounts and counts.",
    input_schema: {
      type: "object" as const,
      properties: {
        loan_id: { type: "string", description: "Filter by specific loan ID (optional)" },
      },
      required: [],
    },
  },
  {
    name: "get_collection_trends",
    description: "Get monthly collection rates for the last N months. Shows expected vs collected amounts and percentages.",
    input_schema: {
      type: "object" as const,
      properties: {
        months: { type: "number", description: "Number of months to look back (default 6)" },
      },
      required: [],
    },
  },
  {
    name: "get_loan_recommendation",
    description: "Get a loan recommendation for a borrower including DTI check, payment history assessment, and suggested interest rate based on their tier.",
    input_schema: {
      type: "object" as const,
      properties: {
        borrower_name: { type: "string", description: "Borrower name to evaluate" },
        proposed_amount: { type: "number", description: "Proposed loan amount in PHP" },
        proposed_term_months: { type: "number", description: "Proposed term in months" },
      },
      required: ["borrower_name"],
    },
  },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function executeAdvisorTool(name: string, input: any, lenderId: string): Promise<string> {
  switch (name) {
    case "get_portfolio_summary":
      return await getPortfolioSummary(lenderId)
    case "get_loan_details":
      return await getLoanDetails(lenderId, input.loan_id, input.borrower_name)
    case "get_borrower_profile":
      return await getBorrowerProfile(lenderId, input.contact_id, input.borrower_name)
    case "get_overdue_report":
      return await getOverdueReport(lenderId, input.limit ?? 20)
    case "get_penalty_summary":
      return await getPenaltySummary(lenderId, input.loan_id)
    case "get_collection_trends":
      return await getCollectionTrends(lenderId, input.months ?? 6)
    case "get_loan_recommendation":
      return await getLoanRecommendation(lenderId, input.borrower_name, input.proposed_amount, input.proposed_term_months)
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` })
  }
}

async function getPortfolioSummary(lenderId: string): Promise<string> {
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const loanStats = await db
    .select({
      totalLoans: sql<number>`count(*)::int`,
      activeLoans: sql<number>`count(*) filter (where ${loans.status} = 'active')::int`,
      completedLoans: sql<number>`count(*) filter (where ${loans.status} = 'completed')::int`,
      defaultedLoans: sql<number>`count(*) filter (where ${loans.status} = 'defaulted')::int`,
      totalDisbursed: sql<string>`coalesce(sum(${loans.principal}), 0)`,
      totalCollected: sql<string>`coalesce(sum(${loans.amountPaid}), 0)`,
      outstandingBalance: sql<string>`coalesce(sum(${loans.remainingBalance}), 0)`,
      interestEarned: sql<string>`coalesce(sum(${loans.interestEarned}), 0)`,
    })
    .from(loans)
    .where(eq(loans.lenderId, lenderId))

  const contactCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contacts)
    .where(eq(contacts.lenderId, lenderId))

  const overdueStats = await db
    .select({
      count: sql<number>`count(*)::int`,
      amount: sql<string>`coalesce(sum(${paymentSchedule.amount} - ${paymentSchedule.paidAmount}), 0)`,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .where(and(eq(loans.lenderId, lenderId), eq(paymentSchedule.status, "overdue")))

  const monthlyExpected = await db
    .select({ amount: sql<string>`coalesce(sum(${paymentSchedule.amount}), 0)` })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .where(and(
      eq(loans.lenderId, lenderId),
      gte(paymentSchedule.dueDate, monthStart),
      lte(paymentSchedule.dueDate, monthEnd)
    ))

  const monthlyCollected = await db
    .select({ amount: sql<string>`coalesce(sum(${paymentSchedule.paidAmount}), 0)` })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .where(and(
      eq(loans.lenderId, lenderId),
      gte(paymentSchedule.dueDate, monthStart),
      lte(paymentSchedule.dueDate, monthEnd),
      eq(paymentSchedule.status, "paid")
    ))

  const expected = parseFloat(monthlyExpected[0]?.amount ?? "0")
  const collected = parseFloat(monthlyCollected[0]?.amount ?? "0")
  const collectionRate = expected > 0 ? ((collected / expected) * 100).toFixed(1) : "N/A"

  return JSON.stringify({
    borrowers: contactCount[0]?.count ?? 0,
    ...loanStats[0],
    overdue: overdueStats[0],
    thisMonth: {
      expected: monthlyExpected[0]?.amount,
      collected: monthlyCollected[0]?.amount,
      collectionRate: `${collectionRate}%`,
    },
  })
}

async function getLoanDetails(lenderId: string, loanId?: string, borrowerName?: string): Promise<string> {
  if (loanId) {
    const loan = await db.query.loans.findFirst({
      where: and(eq(loans.id, loanId), eq(loans.lenderId, lenderId)),
      with: {
        contact: true,
        schedule: { orderBy: [paymentSchedule.dueDate] },
        penalties: true,
      },
    })
    if (!loan) return JSON.stringify({ error: "Loan not found" })
    return JSON.stringify(serializeLoan(loan))
  }

  if (borrowerName) {
    const results = await db
      .select({
        id: loans.id,
        principal: loans.principal,
        interestRate: loans.interestRate,
        status: loans.status,
        remainingBalance: loans.remainingBalance,
        amountPaid: loans.amountPaid,
        startDate: loans.startDate,
        borrowerName: contacts.name,
      })
      .from(loans)
      .innerJoin(contacts, eq(loans.contactId, contacts.id))
      .where(and(eq(loans.lenderId, lenderId), ilike(contacts.name, `%${borrowerName}%`)))
      .orderBy(desc(loans.createdAt))
      .limit(5)

    if (results.length === 0) return JSON.stringify({ error: `No loans found for borrower matching "${borrowerName}"` })
    return JSON.stringify(results.map((r) => ({
      ...r,
      startDate: r.startDate?.toISOString() ?? null,
    })))
  }

  return JSON.stringify({ error: "Provide either loan_id or borrower_name" })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeLoan(loan: any) {
  return {
    id: loan.id,
    borrower: loan.contact?.name,
    principal: loan.principal,
    interestRate: loan.interestRate,
    termMonths: loan.termMonths,
    paymentFrequency: loan.paymentFrequency,
    paymentAmount: loan.paymentAmount,
    status: loan.status,
    amountPaid: loan.amountPaid,
    remainingBalance: loan.remainingBalance,
    startDate: loan.startDate?.toISOString() ?? null,
    maturityDate: loan.maturityDate?.toISOString() ?? null,
    purpose: loan.purpose,
    schedule: loan.schedule?.map((s: { id: string; dueDate: Date; amount: string; paidAmount: string; status: string }) => ({
      id: s.id,
      dueDate: s.dueDate.toISOString(),
      amount: s.amount,
      paidAmount: s.paidAmount,
      status: s.status,
    })),
    penalties: loan.penalties?.map((p: { id: string; penaltyType: string; amount: string; status: string }) => ({
      id: p.id,
      type: p.penaltyType,
      amount: p.amount,
      status: p.status,
    })),
  }
}

async function getBorrowerProfile(lenderId: string, contactId?: string, borrowerName?: string): Promise<string> {
  let contact
  if (contactId) {
    contact = await db.query.contacts.findFirst({
      where: and(eq(contacts.id, contactId), eq(contacts.lenderId, lenderId)),
      with: { loans: { orderBy: [desc(loans.createdAt)] } },
    })
  } else if (borrowerName) {
    contact = await db.query.contacts.findFirst({
      where: and(eq(contacts.lenderId, lenderId), ilike(contacts.name, `%${borrowerName}%`)),
      with: { loans: { orderBy: [desc(loans.createdAt)] } },
    })
  }

  if (!contact) return JSON.stringify({ error: "Borrower not found" })

  const income = parseFloat(contact.income ?? "0")
  const otherIncome = parseFloat(contact.otherIncome ?? "0")
  const totalIncome = income + otherIncome

  // Compute monthly obligation from active loans
  const activeLoans = contact.loans.filter((l: { status: string }) => l.status === "active")
  const monthlyObligation = activeLoans.reduce((sum: number, l: { paymentAmount: string; paymentFrequency: string }) => {
    const pa = parseFloat(l.paymentAmount)
    const freq = l.paymentFrequency
    const multiplier = freq === "daily" ? 30 : freq === "weekly" ? 4 : freq === "biweekly" ? 2 : freq === "semimonthly" ? 2 : 1
    return sum + pa * multiplier
  }, 0)

  const dti = totalIncome > 0 ? ((monthlyObligation / totalIncome) * 100).toFixed(1) : "N/A"

  return JSON.stringify({
    id: contact.id,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    address: contact.address,
    city: contact.city,
    tier: contact.tier ?? "new",
    onTimeRate: contact.onTimeRate ? `${contact.onTimeRate}%` : "N/A",
    income: contact.income,
    otherIncome: contact.otherIncome,
    totalMonthlyIncome: totalIncome.toFixed(2),
    currentMonthlyObligation: monthlyObligation.toFixed(2),
    dtiRatio: `${dti}%`,
    loanHistory: contact.loans.map((l: { id: string; principal: string; status: string; interestRate: string; startDate: Date | null }) => ({
      id: l.id,
      principal: l.principal,
      status: l.status,
      interestRate: l.interestRate,
      startDate: l.startDate?.toISOString() ?? null,
    })),
  })
}

async function getOverdueReport(lenderId: string, limit: number): Promise<string> {
  const now = new Date()
  const items = await db
    .select({
      scheduleId: paymentSchedule.id,
      loanId: paymentSchedule.loanId,
      dueDate: paymentSchedule.dueDate,
      amount: paymentSchedule.amount,
      paidAmount: paymentSchedule.paidAmount,
      borrowerName: contacts.name,
      contactId: contacts.id,
      principal: loans.principal,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .innerJoin(contacts, eq(loans.contactId, contacts.id))
    .where(and(eq(loans.lenderId, lenderId), eq(paymentSchedule.status, "overdue")))
    .orderBy(paymentSchedule.dueDate)
    .limit(limit)

  return JSON.stringify(
    items.map((i) => ({
      borrower: i.borrowerName,
      contactId: i.contactId,
      loanId: i.loanId,
      dueDate: i.dueDate.toISOString(),
      daysOverdue: Math.floor((now.getTime() - i.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
      amountDue: i.amount,
      amountPaid: i.paidAmount,
      remaining: (parseFloat(i.amount) - parseFloat(i.paidAmount)).toFixed(2),
      loanPrincipal: i.principal,
    }))
  )
}

async function getPenaltySummary(lenderId: string, loanId?: string): Promise<string> {
  const baseCondition = loanId
    ? and(eq(loans.lenderId, lenderId), eq(penalties.loanId, loanId))
    : eq(loans.lenderId, lenderId)

  const stats = await db
    .select({
      status: penalties.status,
      count: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${penalties.amount}), 0)`,
    })
    .from(penalties)
    .innerJoin(loans, eq(penalties.loanId, loans.id))
    .where(baseCondition)
    .groupBy(penalties.status)

  const recent = await db
    .select({
      id: penalties.id,
      loanId: penalties.loanId,
      type: penalties.penaltyType,
      amount: penalties.amount,
      status: penalties.status,
      borrowerName: contacts.name,
      createdAt: penalties.createdAt,
    })
    .from(penalties)
    .innerJoin(loans, eq(penalties.loanId, loans.id))
    .innerJoin(contacts, eq(loans.contactId, contacts.id))
    .where(baseCondition)
    .orderBy(desc(penalties.createdAt))
    .limit(10)

  return JSON.stringify({
    summary: stats,
    recentPenalties: recent.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  })
}

async function getCollectionTrends(lenderId: string, months: number): Promise<string> {
  const now = new Date()
  const trends = []

  for (let i = 0; i < months; i++) {
    const target = subMonths(now, i)
    const start = startOfMonth(target)
    const end = endOfMonth(target)

    const expected = await db
      .select({ amount: sql<string>`coalesce(sum(${paymentSchedule.amount}), 0)` })
      .from(paymentSchedule)
      .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
      .where(and(
        eq(loans.lenderId, lenderId),
        gte(paymentSchedule.dueDate, start),
        lte(paymentSchedule.dueDate, end)
      ))

    const collected = await db
      .select({ amount: sql<string>`coalesce(sum(${paymentSchedule.paidAmount}), 0)` })
      .from(paymentSchedule)
      .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
      .where(and(
        eq(loans.lenderId, lenderId),
        gte(paymentSchedule.dueDate, start),
        lte(paymentSchedule.dueDate, end),
        or(eq(paymentSchedule.status, "paid"), eq(paymentSchedule.status, "partial"))
      ))

    const exp = parseFloat(expected[0]?.amount ?? "0")
    const col = parseFloat(collected[0]?.amount ?? "0")
    trends.push({
      month: format(target, "yyyy-MM"),
      expected: exp.toFixed(2),
      collected: col.toFixed(2),
      rate: exp > 0 ? `${((col / exp) * 100).toFixed(1)}%` : "N/A",
    })
  }

  return JSON.stringify(trends)
}

async function getLoanRecommendation(
  lenderId: string,
  borrowerName: string,
  proposedAmount?: number,
  proposedTermMonths?: number
): Promise<string> {
  const contact = await db.query.contacts.findFirst({
    where: and(eq(contacts.lenderId, lenderId), ilike(contacts.name, `%${borrowerName}%`)),
    with: { loans: { orderBy: [desc(loans.createdAt)] } },
  })

  if (!contact) return JSON.stringify({ error: `Borrower "${borrowerName}" not found` })

  const income = parseFloat(contact.income ?? "0")
  const otherIncome = parseFloat(contact.otherIncome ?? "0")
  const totalIncome = income + otherIncome

  const activeLoans = contact.loans.filter((l: { status: string }) => l.status === "active")
  const completedLoans = contact.loans.filter((l: { status: string }) => l.status === "completed")
  const defaultedLoans = contact.loans.filter((l: { status: string }) => l.status === "defaulted")

  const currentObligation = activeLoans.reduce((sum: number, l: { paymentAmount: string; paymentFrequency: string }) => {
    const pa = parseFloat(l.paymentAmount)
    const freq = l.paymentFrequency
    const multiplier = freq === "daily" ? 30 : freq === "weekly" ? 4 : freq === "biweekly" ? 2 : freq === "semimonthly" ? 2 : 1
    return sum + pa * multiplier
  }, 0)

  // Estimate new monthly payment (simple interest)
  const amount = proposedAmount ?? 0
  const term = proposedTermMonths ?? 1
  const estimatedMonthlyPayment = amount > 0 ? (amount * 1.05) / term : 0 // rough 5% estimate

  const newTotalObligation = currentObligation + estimatedMonthlyPayment
  const dti = totalIncome > 0 ? (newTotalObligation / totalIncome) * 100 : null

  return JSON.stringify({
    borrower: contact.name,
    tier: contact.tier ?? "new",
    onTimeRate: contact.onTimeRate ? `${contact.onTimeRate}%` : "N/A",
    totalMonthlyIncome: totalIncome.toFixed(2),
    currentMonthlyObligation: currentObligation.toFixed(2),
    loanHistory: {
      total: contact.loans.length,
      completed: completedLoans.length,
      active: activeLoans.length,
      defaulted: defaultedLoans.length,
    },
    proposedLoan: amount > 0 ? {
      amount: amount.toFixed(2),
      termMonths: term,
      estimatedMonthlyPayment: estimatedMonthlyPayment.toFixed(2),
      newTotalObligation: newTotalObligation.toFixed(2),
      projectedDTI: dti !== null ? `${dti.toFixed(1)}%` : "N/A (no income data)",
      dtiAssessment: dti === null ? "Cannot assess — no income data"
        : dti <= 30 ? "Low risk — healthy DTI"
        : dti <= 50 ? "Moderate risk — manageable but tight"
        : "High risk — DTI exceeds recommended threshold",
    } : null,
    recommendation: defaultedLoans.length > 0
      ? "CAUTION: Borrower has defaulted loans. Consider requiring collateral or declining."
      : completedLoans.length === 0 && activeLoans.length === 0
        ? "New borrower — no history. Consider starting with a smaller amount."
        : parseFloat(contact.onTimeRate ?? "0") >= 80
          ? "Good payment history. Borrower appears reliable."
          : "Below-average on-time rate. Consider a shorter term or lower amount.",
  })
}
