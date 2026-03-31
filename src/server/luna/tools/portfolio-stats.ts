import { db, loans, paymentSchedule, penalties } from "@/lib/db"
import { eq, and, sql, gte, lte } from "drizzle-orm"
import type { LunaTool } from "./index"

export const getPortfolioOverview: LunaTool = {
  definition: {
    name: "get_portfolio_overview",
    description:
      "Get a high-level overview of the lender's portfolio — active loans, total disbursed, outstanding balance, interest earned, overdue count. Use when asked about overall portfolio health or summary.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  async execute(_input: any, lenderId: string) {
    const [stats] = await db
      .select({
        totalLoans: sql<number>`count(*)::int`,
        activeLoans: sql<number>`count(*) filter (where ${loans.status} = 'active')::int`,
        completedLoans: sql<number>`count(*) filter (where ${loans.status} = 'completed')::int`,
        defaultedLoans: sql<number>`count(*) filter (where ${loans.status} = 'defaulted')::int`,
        totalDisbursed: sql<string>`coalesce(sum(${loans.principal}), 0)::text`,
        totalCollected: sql<string>`coalesce(sum(${loans.amountPaid}), 0)::text`,
        outstandingBalance: sql<string>`coalesce(sum(${loans.remainingBalance}) filter (where ${loans.status} = 'active'), 0)::text`,
        interestEarned: sql<string>`coalesce(sum(${loans.interestEarned}), 0)::text`,
      })
      .from(loans)
      .where(eq(loans.lenderId, lenderId))

    // Overdue stats
    const [overdue] = await db
      .select({
        count: sql<number>`count(*)::int`,
        amount: sql<string>`coalesce(sum(${paymentSchedule.amount} - ${paymentSchedule.paidAmount}), 0)::text`,
      })
      .from(paymentSchedule)
      .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
      .where(
        and(
          eq(loans.lenderId, lenderId),
          eq(paymentSchedule.status, "overdue"),
        ),
      )

    // Penalty income
    const [penaltyStats] = await db
      .select({
        applied: sql<string>`coalesce(sum(${penalties.amount}) filter (where ${penalties.status} = 'applied'), 0)::text`,
        pending: sql<string>`coalesce(sum(${penalties.amount}) filter (where ${penalties.status} = 'pending'), 0)::text`,
      })
      .from(penalties)
      .innerJoin(loans, eq(penalties.loanId, loans.id))
      .where(eq(loans.lenderId, lenderId))

    const data = {
      totalLoans: stats.totalLoans,
      activeLoans: stats.activeLoans,
      completedLoans: stats.completedLoans,
      defaultedLoans: stats.defaultedLoans,
      totalDisbursed: Number(stats.totalDisbursed),
      totalCollected: Number(stats.totalCollected),
      outstandingBalance: Number(stats.outstandingBalance),
      interestEarned: Number(stats.interestEarned),
      overdueCount: overdue.count,
      overdueAmount: Number(overdue.amount),
      penaltyIncome: Number(penaltyStats.applied),
      pendingPenalties: Number(penaltyStats.pending),
    }

    const fmt = (n: number) =>
      `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`

    return {
      result: `Portfolio: ${data.activeLoans} active loans, ${fmt(data.outstandingBalance)} outstanding. ${fmt(data.totalDisbursed)} total disbursed, ${fmt(data.totalCollected)} collected, ${fmt(data.interestEarned)} interest earned. ${data.overdueCount} overdue items totaling ${fmt(data.overdueAmount)}. ${data.completedLoans} completed, ${data.defaultedLoans} defaulted.`,
      contextCard: {
        type: "portfolio_stats" as const,
        title: "Portfolio Overview",
        data,
      },
    }
  },
}

export const getCollectionRate: LunaTool = {
  definition: {
    name: "get_collection_rate",
    description:
      "Get the collection rate for the current month — expected vs. actually collected amounts. Use when asked about collection performance or monthly stats.",
    input_schema: {
      type: "object" as const,
      properties: {
        month: {
          type: "string",
          description:
            "Month in YYYY-MM format (default: current month)",
        },
      },
      required: [],
    },
  },
  async execute(input: { month?: string }, lenderId: string) {
    const now = new Date()
    let year = now.getFullYear()
    let month = now.getMonth()

    if (input.month) {
      const [y, m] = input.month.split("-").map(Number)
      year = y
      month = m - 1
    }

    const monthStart = new Date(year, month, 1)
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59)

    const [stats] = await db
      .select({
        expectedAmount: sql<string>`coalesce(sum(${paymentSchedule.amount}), 0)::text`,
        expectedCount: sql<number>`count(*)::int`,
        collectedAmount: sql<string>`coalesce(sum(case when ${paymentSchedule.status} = 'paid' then ${paymentSchedule.amount} else ${paymentSchedule.paidAmount} end), 0)::text`,
        collectedCount: sql<number>`count(*) filter (where ${paymentSchedule.status} = 'paid')::int`,
      })
      .from(paymentSchedule)
      .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
      .where(
        and(
          eq(loans.lenderId, lenderId),
          gte(paymentSchedule.dueDate, monthStart),
          lte(paymentSchedule.dueDate, monthEnd),
        ),
      )

    const expected = Number(stats.expectedAmount)
    const collected = Number(stats.collectedAmount)
    const rate = expected > 0 ? ((collected / expected) * 100).toFixed(1) : "0"

    const fmt = (n: number) =>
      `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
    const monthLabel = monthStart.toLocaleDateString("en-PH", {
      month: "long",
      year: "numeric",
    })

    return {
      result: `${monthLabel} collection rate: ${rate}%. ${fmt(collected)} collected of ${fmt(expected)} expected. ${stats.collectedCount}/${stats.expectedCount} payments completed.`,
      contextCard: {
        type: "portfolio_stats" as const,
        title: `Collection Rate — ${monthLabel}`,
        data: {
          month: monthLabel,
          expected,
          collected,
          rate: Number(rate),
          expectedCount: stats.expectedCount,
          collectedCount: stats.collectedCount,
        },
      },
    }
  },
}
