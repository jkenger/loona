import { db, loans, contacts, paymentSchedule, penalties, lenderSettings, penaltySettings } from "@/lib/db"
import { eq, and, sql } from "drizzle-orm"
import { parseLenderConfig } from "@/lib/constants/lender-defaults"
import { format } from "date-fns"

export async function buildSystemPrompt(lenderId: string): Promise<string> {
  const now = new Date()

  // Portfolio summary
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

  const contactStats = await db
    .select({ total: sql<number>`count(*)::int` })
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

  const penaltyStats = await db
    .select({
      pending: sql<string>`coalesce(sum(case when ${penalties.status} = 'pending' then ${penalties.amount} else 0 end), 0)`,
      applied: sql<string>`coalesce(sum(case when ${penalties.status} = 'applied' then ${penalties.amount} else 0 end), 0)`,
      waived: sql<string>`coalesce(sum(case when ${penalties.status} = 'waived' then ${penalties.amount} else 0 end), 0)`,
    })
    .from(penalties)
    .innerJoin(loans, eq(penalties.loanId, loans.id))
    .where(eq(loans.lenderId, lenderId))

  // Lender settings
  const lenderSettingsRow = await db.query.lenderSettings.findFirst({
    where: eq(lenderSettings.lenderId, lenderId),
  })
  const lenderConfig = parseLenderConfig(lenderSettingsRow?.config ?? null)

  // Penalty settings
  const penaltySettingsRow = await db.query.penaltySettings.findFirst({
    where: eq(penaltySettings.lenderId, lenderId),
  })

  const stats = loanStats[0]
  const overdue = overdueStats[0]
  const penStats = penaltyStats[0]
  const totalContacts = contactStats[0]?.total ?? 0

  return `You are the AI Advisor for a Philippine lending business using the Loona platform.
Today is ${format(now, "MMMM d, yyyy")}.

## Your Role
- You analyze the lender's portfolio data and provide actionable insights
- You are READ-ONLY: you can look up data but NEVER modify, create, or delete anything
- Be concise, specific, and use Philippine Peso (₱) for all amounts
- Format currency as ₱X,XXX.XX
- When asked vague questions, proactively use your tools to fetch relevant data

## Portfolio Snapshot
- Total borrowers: ${totalContacts}
- Total loans: ${stats?.totalLoans ?? 0} (Active: ${stats?.activeLoans ?? 0}, Completed: ${stats?.completedLoans ?? 0}, Defaulted: ${stats?.defaultedLoans ?? 0})
- Total disbursed: ₱${Number(stats?.totalDisbursed ?? 0).toLocaleString()}
- Total collected: ₱${Number(stats?.totalCollected ?? 0).toLocaleString()}
- Outstanding balance: ₱${Number(stats?.outstandingBalance ?? 0).toLocaleString()}
- Interest earned: ₱${Number(stats?.interestEarned ?? 0).toLocaleString()}
- Overdue items: ${overdue?.count ?? 0} (₱${Number(overdue?.amount ?? 0).toLocaleString()} outstanding)
- Penalties — Pending: ₱${Number(penStats?.pending ?? 0).toLocaleString()}, Applied: ₱${Number(penStats?.applied ?? 0).toLocaleString()}, Waived: ₱${Number(penStats?.waived ?? 0).toLocaleString()}
${lenderConfig.initialCapital > 0 ? `- Starting capital: ₱${lenderConfig.initialCapital.toLocaleString()}` : ""}

${penaltySettingsRow ? `## Penalty Configuration\n${penaltySettingsRow.config}` : ""}

## Guidelines
- Always verify claims with data — use tools to look up specifics
- When discussing risk, reference actual overdue history and on-time rates
- For loan recommendations, consider DTI ratios and borrower payment history
- Keep responses focused and under 300 words unless the user asks for detail
- Use markdown formatting for tables and lists when presenting data`
}
