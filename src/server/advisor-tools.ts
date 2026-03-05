import type Anthropic from "@anthropic-ai/sdk"
import { db, loans, contacts, paymentSchedule, penalties } from "@/lib/db"
import { eq, and, ilike, desc, sql, gte, lte } from "drizzle-orm"
import { queryDataTool, describeDataTool, executeQueryData, describeData } from "./advisor-query"
import { subMonths, startOfMonth, addDays, startOfDay, differenceInDays } from "date-fns"

// ============================================================================
// Tool definitions
// ============================================================================

export const advisorTools: Anthropic.Tool[] = [
  queryDataTool,
  describeDataTool,
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
  {
    name: "get_borrower_risk_score",
    description: "Get a comprehensive risk assessment for a borrower including risk score (0-100), category, and contributing factors based on payment history, loan performance, and penalties.",
    input_schema: {
      type: "object" as const,
      properties: {
        borrower_name: { type: "string", description: "Borrower name to evaluate" },
      },
      required: ["borrower_name"],
    },
  },
  {
    name: "get_portfolio_health",
    description: "Get a comprehensive portfolio health analysis including collection rate trends, concentration risk, tier distribution, default rate, and aging analysis of overdue payments.",
    input_schema: {
      type: "object" as const,
      properties: {
        period_months: { type: "number", description: "Number of months to analyze (default 3)" },
      },
      required: [],
    },
  },
  {
    name: "simulate_scenario",
    description: "Simulate financial scenarios: rate changes (recalculate payments with new rate), new loans (full projection with DTI), or term changes (payment and interest impact).",
    input_schema: {
      type: "object" as const,
      properties: {
        scenario_type: { type: "string", enum: ["rate_change", "new_loan", "term_change"], description: "Type of simulation" },
        borrower_name: { type: "string", description: "Borrower name (required for new_loan and rate_change with existing loan)" },
        parameters: {
          type: "object",
          properties: {
            new_rate: { type: "number", description: "New interest rate % (for rate_change)" },
            loan_amount: { type: "number", description: "Loan amount in PHP (for new_loan)" },
            term_months: { type: "number", description: "Term in months" },
            new_term_months: { type: "number", description: "New term in months (for term_change)" },
            loan_id: { type: "string", description: "Specific loan ID (for rate_change or term_change on existing loan)" },
          },
        },
      },
      required: ["scenario_type", "parameters"],
    },
  },
  {
    name: "compare_periods",
    description: "Compare two time periods side by side with metrics like disbursed amount, collected amount, collection rate, new loans, defaults, and penalties.",
    input_schema: {
      type: "object" as const,
      properties: {
        period_a: {
          type: "object",
          properties: {
            start: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end: { type: "string", description: "End date (YYYY-MM-DD)" },
          },
          required: ["start", "end"],
        },
        period_b: {
          type: "object",
          properties: {
            start: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end: { type: "string", description: "End date (YYYY-MM-DD)" },
          },
          required: ["start", "end"],
        },
        metrics: {
          type: "array",
          items: { type: "string" },
          description: "Specific metrics to compare (optional, defaults to all)",
        },
      },
      required: ["period_a", "period_b"],
    },
  },
]

// ============================================================================
// Tool executor
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function executeAdvisorTool(name: string, input: any, lenderId: string): Promise<string> {
  switch (name) {
    case "query_data":
      return await executeQueryData(input, lenderId)
    case "describe_data":
      return describeData(input.table)
    case "get_loan_recommendation":
      return await getLoanRecommendation(lenderId, input.borrower_name, input.proposed_amount, input.proposed_term_months)
    case "get_borrower_risk_score":
      return await getBorrowerRiskScore(lenderId, input.borrower_name)
    case "get_portfolio_health":
      return await getPortfolioHealth(lenderId, input.period_months)
    case "simulate_scenario":
      return await simulateScenario(lenderId, input.scenario_type, input.borrower_name, input.parameters)
    case "compare_periods":
      return await comparePeriods(lenderId, input.period_a, input.period_b)
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` })
  }
}

// ============================================================================
// Loan recommendation (business logic — not a simple query)
// ============================================================================

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
  const estimatedMonthlyPayment = amount > 0 ? (amount * 1.05) / term : 0

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

// ============================================================================
// Borrower risk score
// ============================================================================

async function getBorrowerRiskScore(lenderId: string, borrowerName: string): Promise<string> {
  const contact = await db.query.contacts.findFirst({
    where: and(eq(contacts.lenderId, lenderId), ilike(contacts.name, `%${borrowerName}%`)),
    with: { loans: { orderBy: [desc(loans.createdAt)] } },
  })

  if (!contact) return JSON.stringify({ error: `Borrower "${borrowerName}" not found` })

  const allLoans = contact.loans
  const activeLoans = allLoans.filter((l: { status: string }) => l.status === "active")
  const defaultedLoans = allLoans.filter((l: { status: string }) => l.status === "defaulted")
  const completedLoans = allLoans.filter((l: { status: string }) => l.status === "completed")

  // Payment history analysis
  const loanIds = allLoans.map((l: { id: string }) => l.id)
  let latePayments = 0
  let totalPayments = 0
  let totalDaysLate = 0

  if (loanIds.length > 0) {
    const schedules = await db
      .select({
        status: paymentSchedule.status,
        dueDate: paymentSchedule.dueDate,
        paidAt: paymentSchedule.paidAt,
      })
      .from(paymentSchedule)
      .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
      .where(and(eq(loans.lenderId, lenderId), sql`${paymentSchedule.loanId} = ANY(${loanIds})`))

    for (const s of schedules) {
      if (s.status === "paid" || s.status === "partial" || s.status === "overdue") {
        totalPayments++
        if (s.status === "overdue") {
          latePayments++
          totalDaysLate += differenceInDays(new Date(), new Date(s.dueDate))
        } else if (s.paidAt && new Date(s.paidAt) > new Date(s.dueDate)) {
          latePayments++
          totalDaysLate += differenceInDays(new Date(s.paidAt), new Date(s.dueDate))
        }
      }
    }
  }

  // Penalty history
  const penaltyData = loanIds.length > 0 ? await db
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${penalties.amount}), 0)`,
    })
    .from(penalties)
    .innerJoin(loans, eq(penalties.loanId, loans.id))
    .where(and(eq(loans.lenderId, lenderId), sql`${penalties.loanId} = ANY(${loanIds})`))
    : [{ count: 0, total: "0" }]

  // Calculate risk score (0 = lowest risk, 100 = highest risk)
  const factors: string[] = []
  let score = 0

  // Default history (heaviest weight)
  if (defaultedLoans.length > 0) {
    score += Math.min(defaultedLoans.length * 25, 40)
    factors.push(`${defaultedLoans.length} defaulted loan(s)`)
  }

  // Late payment ratio
  const lateRatio = totalPayments > 0 ? latePayments / totalPayments : 0
  if (lateRatio > 0.3) {
    score += 20
    factors.push(`High late payment rate (${Math.round(lateRatio * 100)}%)`)
  } else if (lateRatio > 0.15) {
    score += 10
    factors.push(`Moderate late payment rate (${Math.round(lateRatio * 100)}%)`)
  } else if (lateRatio > 0 && totalPayments > 0) {
    score += 5
    factors.push(`Low late payment rate (${Math.round(lateRatio * 100)}%)`)
  }

  // Average days late
  const avgDaysLate = latePayments > 0 ? totalDaysLate / latePayments : 0
  if (avgDaysLate > 14) {
    score += 15
    factors.push(`Average ${Math.round(avgDaysLate)} days late when overdue`)
  } else if (avgDaysLate > 7) {
    score += 8
    factors.push(`Average ${Math.round(avgDaysLate)} days late when overdue`)
  }

  // No history
  if (allLoans.length === 0) {
    score += 15
    factors.push("No loan history — unknown risk")
  } else if (completedLoans.length > 0 && defaultedLoans.length === 0 && lateRatio < 0.1) {
    factors.push(`${completedLoans.length} completed loan(s) with good record`)
  }

  // Penalty count
  const penCount = penaltyData[0]?.count ?? 0
  if (penCount > 5) {
    score += 10
    factors.push(`${penCount} penalties incurred`)
  } else if (penCount > 0) {
    score += 5
    factors.push(`${penCount} penalties incurred`)
  }

  // On-time rate from contact
  const onTimeRate = parseFloat(contact.onTimeRate ?? "0")
  if (onTimeRate >= 90 && totalPayments > 3) {
    score = Math.max(score - 10, 0)
    factors.push(`Strong on-time rate: ${onTimeRate}%`)
  }

  score = Math.min(score, 100)
  const category = score <= 25 ? "low" : score <= 50 ? "medium" : score <= 75 ? "high" : "critical"

  return JSON.stringify({
    borrower: contact.name,
    borrowerId: contact.id,
    riskScore: score,
    category,
    factors,
    details: {
      tier: contact.tier ?? "new",
      onTimeRate: contact.onTimeRate ? `${contact.onTimeRate}%` : "N/A",
      totalLoans: allLoans.length,
      activeLoans: activeLoans.length,
      completedLoans: completedLoans.length,
      defaultedLoans: defaultedLoans.length,
      totalPayments,
      latePayments,
      avgDaysLate: Math.round(avgDaysLate),
      totalPenalties: penCount,
      penaltyAmount: Number(penaltyData[0]?.total ?? 0).toFixed(2),
    },
  })
}

// ============================================================================
// Portfolio health
// ============================================================================

async function getPortfolioHealth(lenderId: string, periodMonths?: number): Promise<string> {
  const months = periodMonths ?? 3
  const now = new Date()
  const periodStart = startOfMonth(subMonths(now, months - 1))

  // Collection rate by month
  const monthlyCollection = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${paymentSchedule.dueDate}), 'YYYY-MM')`,
      expected: sql<string>`coalesce(sum(${paymentSchedule.amount}), 0)`,
      collected: sql<string>`coalesce(sum(${paymentSchedule.paidAmount}), 0)`,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .where(and(eq(loans.lenderId, lenderId), gte(paymentSchedule.dueDate, periodStart)))
    .groupBy(sql`date_trunc('month', ${paymentSchedule.dueDate})`)
    .orderBy(sql`date_trunc('month', ${paymentSchedule.dueDate})`)

  const collectionTrend = monthlyCollection.map((m) => {
    const exp = Number(m.expected)
    const col = Number(m.collected)
    return {
      month: m.month,
      expected: exp.toFixed(2),
      collected: col.toFixed(2),
      rate: exp > 0 ? `${Math.round((col / exp) * 100)}%` : "N/A",
    }
  })

  // Concentration risk — top 5 borrowers by outstanding balance
  const topBorrowers = await db
    .select({
      name: contacts.name,
      contactId: contacts.id,
      outstanding: sql<string>`coalesce(sum(${loans.remainingBalance}), 0)`,
    })
    .from(loans)
    .innerJoin(contacts, eq(loans.contactId, contacts.id))
    .where(and(eq(loans.lenderId, lenderId), eq(loans.status, "active")))
    .groupBy(contacts.id, contacts.name)
    .orderBy(desc(sql`sum(${loans.remainingBalance})`))
    .limit(5)

  const totalOutstanding = await db
    .select({ total: sql<string>`coalesce(sum(${loans.remainingBalance}), 0)` })
    .from(loans)
    .where(and(eq(loans.lenderId, lenderId), eq(loans.status, "active")))

  const totalOut = Number(totalOutstanding[0]?.total ?? 0)
  const concentration = topBorrowers.map((b) => ({
    name: b.name,
    contactId: b.contactId,
    outstanding: Number(b.outstanding).toFixed(2),
    percentage: totalOut > 0 ? `${Math.round((Number(b.outstanding) / totalOut) * 100)}%` : "0%",
  }))

  // Tier distribution
  const tierDist = await db
    .select({
      tier: contacts.tier,
      count: sql<number>`count(*)::int`,
    })
    .from(contacts)
    .where(eq(contacts.lenderId, lenderId))
    .groupBy(contacts.tier)

  // Default rate
  const loanCounts = await db
    .select({
      total: sql<number>`count(*)::int`,
      defaulted: sql<number>`count(*) filter (where ${loans.status} = 'defaulted')::int`,
    })
    .from(loans)
    .where(eq(loans.lenderId, lenderId))

  const totalLoans = loanCounts[0]?.total ?? 0
  const defaultedCount = loanCounts[0]?.defaulted ?? 0
  const defaultRate = totalLoans > 0 ? `${((defaultedCount / totalLoans) * 100).toFixed(1)}%` : "0%"

  // Aging analysis of overdue payments
  const today = startOfDay(now)
  const aging = await db
    .select({
      bucket: sql<string>`case
        when ${paymentSchedule.dueDate} >= ${addDays(today, -7)} then '1-7 days'
        when ${paymentSchedule.dueDate} >= ${addDays(today, -14)} then '8-14 days'
        when ${paymentSchedule.dueDate} >= ${addDays(today, -30)} then '15-30 days'
        else '30+ days'
      end`,
      count: sql<number>`count(*)::int`,
      amount: sql<string>`coalesce(sum(${paymentSchedule.amount} - ${paymentSchedule.paidAmount}), 0)`,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .where(and(eq(loans.lenderId, lenderId), eq(paymentSchedule.status, "overdue")))
    .groupBy(sql`case
      when ${paymentSchedule.dueDate} >= ${addDays(today, -7)} then '1-7 days'
      when ${paymentSchedule.dueDate} >= ${addDays(today, -14)} then '8-14 days'
      when ${paymentSchedule.dueDate} >= ${addDays(today, -30)} then '15-30 days'
      else '30+ days'
    end`)

  return JSON.stringify({
    periodMonths: months,
    collectionTrend,
    concentration: {
      topBorrowers: concentration,
      topFivePercentage: totalOut > 0
        ? `${Math.round((concentration.reduce((s, c) => s + Number(c.outstanding), 0) / totalOut) * 100)}%`
        : "0%",
    },
    tierDistribution: tierDist.map((t) => ({ tier: t.tier ?? "new", count: t.count })),
    defaultRate,
    totalLoans,
    defaultedCount,
    agingAnalysis: aging.map((a) => ({
      bucket: a.bucket,
      count: a.count,
      amount: Number(a.amount).toFixed(2),
    })),
  })
}

// ============================================================================
// Scenario simulation
// ============================================================================

async function simulateScenario(
  lenderId: string,
  scenarioType: string,
  borrowerName?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parameters?: any
): Promise<string> {
  const params = parameters ?? {}

  if (scenarioType === "rate_change") {
    const newRate = params.new_rate
    if (!newRate) return JSON.stringify({ error: "new_rate parameter required for rate_change" })

    // If loan_id provided, use that specific loan
    if (params.loan_id) {
      const loan = await db.query.loans.findFirst({
        where: and(eq(loans.id, params.loan_id), eq(loans.lenderId, lenderId)),
      })
      if (!loan) return JSON.stringify({ error: "Loan not found" })

      const principal = Number(loan.principal)
      const currentRate = Number(loan.interestRate)
      const term = loan.termMonths

      const currentTotal = principal * (1 + currentRate / 100)
      const newTotal = principal * (1 + newRate / 100)
      const currentMonthly = currentTotal / term
      const newMonthly = newTotal / term

      return JSON.stringify({
        scenario: "rate_change",
        loanId: loan.id,
        principal: principal.toFixed(2),
        termMonths: term,
        comparison: {
          currentRate: `${currentRate}%`,
          newRate: `${newRate}%`,
          currentMonthlyPayment: currentMonthly.toFixed(2),
          newMonthlyPayment: newMonthly.toFixed(2),
          currentTotalRepay: currentTotal.toFixed(2),
          newTotalRepay: newTotal.toFixed(2),
          monthlyDifference: (newMonthly - currentMonthly).toFixed(2),
          totalDifference: (newTotal - currentTotal).toFixed(2),
        },
      })
    }

    // Find borrower's active loan
    if (!borrowerName) return JSON.stringify({ error: "borrower_name or loan_id required" })
    const contact = await db.query.contacts.findFirst({
      where: and(eq(contacts.lenderId, lenderId), ilike(contacts.name, `%${borrowerName}%`)),
      with: { loans: { orderBy: [desc(loans.createdAt)] } },
    })
    if (!contact) return JSON.stringify({ error: `Borrower "${borrowerName}" not found` })

    const activeLoan = (contact.loans as { id: string; status: string; principal: string; interestRate: string; termMonths: number }[])
      .find((l) => l.status === "active")
    if (!activeLoan) return JSON.stringify({ error: `No active loan found for ${contact.name}` })

    const principal = Number(activeLoan.principal)
    const currentRate = Number(activeLoan.interestRate)
    const term = activeLoan.termMonths

    const currentTotal = principal * (1 + currentRate / 100)
    const newTotal = principal * (1 + newRate / 100)

    return JSON.stringify({
      scenario: "rate_change",
      borrower: contact.name,
      loanId: activeLoan.id,
      principal: principal.toFixed(2),
      termMonths: term,
      comparison: {
        currentRate: `${currentRate}%`,
        newRate: `${newRate}%`,
        currentMonthlyPayment: (currentTotal / term).toFixed(2),
        newMonthlyPayment: (newTotal / term).toFixed(2),
        currentTotalRepay: currentTotal.toFixed(2),
        newTotalRepay: newTotal.toFixed(2),
        monthlyDifference: ((newTotal - currentTotal) / term).toFixed(2),
        totalDifference: (newTotal - currentTotal).toFixed(2),
      },
    })
  }

  if (scenarioType === "new_loan") {
    if (!borrowerName) return JSON.stringify({ error: "borrower_name required for new_loan simulation" })
    const amount = params.loan_amount
    const term = params.term_months ?? 12
    if (!amount) return JSON.stringify({ error: "loan_amount parameter required" })

    const contact = await db.query.contacts.findFirst({
      where: and(eq(contacts.lenderId, lenderId), ilike(contacts.name, `%${borrowerName}%`)),
      with: { loans: { orderBy: [desc(loans.createdAt)] } },
    })
    if (!contact) return JSON.stringify({ error: `Borrower "${borrowerName}" not found` })

    const income = parseFloat(contact.income ?? "0") + parseFloat(contact.otherIncome ?? "0")
    const activeLoans = (contact.loans as { status: string; paymentAmount: string; paymentFrequency: string }[])
      .filter((l) => l.status === "active")

    const currentObligation = activeLoans.reduce((sum, l) => {
      const pa = parseFloat(l.paymentAmount)
      const freq = l.paymentFrequency
      const multiplier = freq === "daily" ? 30 : freq === "weekly" ? 4 : freq === "biweekly" ? 2 : freq === "semimonthly" ? 2 : 1
      return sum + pa * multiplier
    }, 0)

    const estimatedRate = 5 // default estimate
    const totalRepay = amount * (1 + estimatedRate / 100)
    const monthlyPayment = totalRepay / term
    const newObligation = currentObligation + monthlyPayment
    const dti = income > 0 ? (newObligation / income) * 100 : null

    return JSON.stringify({
      scenario: "new_loan",
      borrower: contact.name,
      borrowerId: contact.id,
      projection: {
        loanAmount: amount.toFixed(2),
        termMonths: term,
        estimatedRate: `${estimatedRate}%`,
        monthlyPayment: monthlyPayment.toFixed(2),
        totalRepay: totalRepay.toFixed(2),
        totalInterest: (totalRepay - amount).toFixed(2),
      },
      borrowerProfile: {
        monthlyIncome: income.toFixed(2),
        currentObligation: currentObligation.toFixed(2),
        newTotalObligation: newObligation.toFixed(2),
        currentDTI: income > 0 ? `${((currentObligation / income) * 100).toFixed(1)}%` : "N/A",
        projectedDTI: dti !== null ? `${dti.toFixed(1)}%` : "N/A",
        dtiAssessment: dti === null ? "Cannot assess — no income data"
          : dti <= 30 ? "Low risk — healthy DTI"
          : dti <= 50 ? "Moderate risk — manageable"
          : "High risk — exceeds recommended threshold",
      },
      riskFactors: {
        tier: contact.tier ?? "new",
        onTimeRate: contact.onTimeRate ? `${contact.onTimeRate}%` : "N/A",
        activeLoansCount: activeLoans.length,
      },
    })
  }

  if (scenarioType === "term_change") {
    const newTerm = params.new_term_months
    if (!newTerm) return JSON.stringify({ error: "new_term_months parameter required" })

    if (params.loan_id) {
      const loan = await db.query.loans.findFirst({
        where: and(eq(loans.id, params.loan_id), eq(loans.lenderId, lenderId)),
      })
      if (!loan) return JSON.stringify({ error: "Loan not found" })

      const principal = Number(loan.principal)
      const rate = Number(loan.interestRate)
      const currentTerm = loan.termMonths

      const currentTotal = principal * (1 + rate / 100)
      const newTotal = principal * (1 + rate / 100) // same rate, different term doesn't change total for simple interest
      // But for realistic modeling, longer terms may have more interest — keep simple for now

      return JSON.stringify({
        scenario: "term_change",
        loanId: loan.id,
        principal: principal.toFixed(2),
        interestRate: `${rate}%`,
        comparison: {
          currentTermMonths: currentTerm,
          newTermMonths: newTerm,
          currentMonthlyPayment: (currentTotal / currentTerm).toFixed(2),
          newMonthlyPayment: (newTotal / newTerm).toFixed(2),
          totalRepay: currentTotal.toFixed(2),
          monthlyDifference: ((currentTotal / newTerm) - (currentTotal / currentTerm)).toFixed(2),
        },
      })
    }

    // Find borrower's active loan
    if (!borrowerName) return JSON.stringify({ error: "borrower_name or loan_id required" })
    const contact = await db.query.contacts.findFirst({
      where: and(eq(contacts.lenderId, lenderId), ilike(contacts.name, `%${borrowerName}%`)),
      with: { loans: { orderBy: [desc(loans.createdAt)] } },
    })
    if (!contact) return JSON.stringify({ error: `Borrower "${borrowerName}" not found` })

    const activeLoan = (contact.loans as { id: string; status: string; principal: string; interestRate: string; termMonths: number }[])
      .find((l) => l.status === "active")
    if (!activeLoan) return JSON.stringify({ error: `No active loan found for ${contact.name}` })

    const principal = Number(activeLoan.principal)
    const rate = Number(activeLoan.interestRate)
    const currentTerm = activeLoan.termMonths
    const total = principal * (1 + rate / 100)

    return JSON.stringify({
      scenario: "term_change",
      borrower: contact.name,
      loanId: activeLoan.id,
      principal: principal.toFixed(2),
      interestRate: `${rate}%`,
      comparison: {
        currentTermMonths: currentTerm,
        newTermMonths: newTerm,
        currentMonthlyPayment: (total / currentTerm).toFixed(2),
        newMonthlyPayment: (total / newTerm).toFixed(2),
        totalRepay: total.toFixed(2),
        monthlyDifference: ((total / newTerm) - (total / currentTerm)).toFixed(2),
      },
    })
  }

  return JSON.stringify({ error: `Unknown scenario type: ${scenarioType}` })
}

// ============================================================================
// Period comparison
// ============================================================================

async function comparePeriods(
  lenderId: string,
  periodA: { start: string; end: string },
  periodB: { start: string; end: string },
): Promise<string> {
  const getMetrics = async (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)

    // Disbursed
    const disbursed = await db
      .select({ total: sql<string>`coalesce(sum(${loans.principal}), 0)`, count: sql<number>`count(*)::int` })
      .from(loans)
      .where(and(eq(loans.lenderId, lenderId), gte(loans.startDate, startDate), lte(loans.startDate, endDate)))

    // Collected
    const collected = await db
      .select({
        expected: sql<string>`coalesce(sum(${paymentSchedule.amount}), 0)`,
        collected: sql<string>`coalesce(sum(${paymentSchedule.paidAmount}), 0)`,
      })
      .from(paymentSchedule)
      .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
      .where(and(eq(loans.lenderId, lenderId), gte(paymentSchedule.dueDate, startDate), lte(paymentSchedule.dueDate, endDate)))

    // Defaults
    const defaults = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(loans)
      .where(and(eq(loans.lenderId, lenderId), eq(loans.status, "defaulted"), gte(loans.updatedAt, startDate), lte(loans.updatedAt, endDate)))

    // Penalties
    const penaltyTotal = await db
      .select({ total: sql<string>`coalesce(sum(${penalties.amount}), 0)`, count: sql<number>`count(*)::int` })
      .from(penalties)
      .innerJoin(loans, eq(penalties.loanId, loans.id))
      .where(and(eq(loans.lenderId, lenderId), gte(penalties.createdAt, startDate), lte(penalties.createdAt, endDate)))

    const exp = Number(collected[0]?.expected ?? 0)
    const col = Number(collected[0]?.collected ?? 0)

    return {
      disbursed: Number(disbursed[0]?.total ?? 0).toFixed(2),
      newLoans: disbursed[0]?.count ?? 0,
      expected: exp.toFixed(2),
      collected: col.toFixed(2),
      collectionRate: exp > 0 ? `${Math.round((col / exp) * 100)}%` : "N/A",
      defaults: defaults[0]?.count ?? 0,
      penaltyCount: penaltyTotal[0]?.count ?? 0,
      penaltyAmount: Number(penaltyTotal[0]?.total ?? 0).toFixed(2),
    }
  }

  const [metricsA, metricsB] = await Promise.all([
    getMetrics(periodA.start, periodA.end),
    getMetrics(periodB.start, periodB.end),
  ])

  return JSON.stringify({
    periodA: { ...periodA, metrics: metricsA },
    periodB: { ...periodB, metrics: metricsB },
  })
}
