import { db, agents, loans, payments, commissions, paymentSchedule } from "@/lib/db"
import { eq, and, gte, lte, inArray, sql, isNull } from "drizzle-orm"
import { parseLenderConfig } from "@/lib/constants/lender-defaults"
import { sendEmail, agentWeeklySummaryEmail } from "@/lib/email"

export async function sendAgentWeeklySummaries() {
  // Week window: last 7 days
  const now = new Date()
  now.setHours(23, 59, 59, 999)
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - 6)
  weekStart.setHours(0, 0, 0, 0)

  const weekLabel = `${weekStart.toLocaleDateString("en-PH", { month: "short", day: "numeric" })} – ${now.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`

  // Load all lender settings to find which have agentNotificationsEnabled
  const allSettings = await db.query.lenderSettings.findMany()
  const enabledLenderIds = allSettings
    .filter((row) => parseLenderConfig(row.config).agentNotificationsEnabled)
    .map((row) => row.lenderId)

  if (enabledLenderIds.length === 0) return { sent: 0, skipped: 0 }

  // Load all active agents for enabled lenders, with their user
  const allAgents = await db.query.agents.findMany({
    where: and(
      eq(agents.status, "active"),
      inArray(agents.lenderId, enabledLenderIds),
    ),
    with: {
      agentUser: true,
      lender: true,
    },
  })

  let sent = 0
  let skipped = 0

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  for (const agent of allAgents) {
    if (!agent.agentUser?.email) {
      skipped++
      continue
    }

    // Payments recorded by this agent in the past week
    const weekPayments = await db.query.payments.findMany({
      where: and(
        eq(payments.recordedByAgentId, agent.id),
        eq(payments.type, "credit"),
        isNull(payments.reversedAt),
        gte(payments.paidAt, weekStart),
        lte(payments.paidAt, now),
      ),
      with: { loan: { with: { contact: true } } },
    })

    const totalCollected = weekPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0)
    const paymentCount = weekPayments.length

    // Commission earned this week
    const weekCommissions = await db.query.commissions.findMany({
      where: and(
        eq(commissions.agentId, agent.id),
        gte(commissions.createdAt, weekStart),
        lte(commissions.createdAt, now),
      ),
    })
    const commissionEarned = weekCommissions.reduce((sum, c) => sum + parseFloat(c.commissionAmount), 0)

    // Assigned active loans
    const assignedLoans = await db.query.loans.findMany({
      where: and(
        eq(loans.assignedAgentId, agent.id),
        eq(loans.status, "active"),
      ),
    })

    // Overdue count on assigned loans
    const overdueCount = assignedLoans.length > 0
      ? await db.query.paymentSchedule.findMany({
          where: and(
            eq(paymentSchedule.status, "pending"),
            inArray(paymentSchedule.loanId, assignedLoans.map((l) => l.id)),
            sql`date(${paymentSchedule.dueDate}) < ${todayStr}`,
          ),
        }).then((r) => r.length)
      : 0

    // Top borrowers by amount collected this week
    const borrowerMap = new Map<string, { name: string; amount: number }>()
    for (const p of weekPayments) {
      const name = p.loan?.contact?.name ?? "Unknown"
      const existing = borrowerMap.get(name) ?? { name, amount: 0 }
      existing.amount += parseFloat(p.amount)
      borrowerMap.set(name, existing)
    }
    const topBorrowers = Array.from(borrowerMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((b) => ({ name: b.name, amount: b.amount.toFixed(2) }))

    const { subject, html, text } = agentWeeklySummaryEmail({
      agentName: agent.agentUser.name,
      lenderName: agent.lender.name,
      weekLabel,
      totalCollected: totalCollected.toFixed(2),
      paymentCount,
      commissionEarned: commissionEarned.toFixed(2),
      overdueCount,
      assignedLoansCount: assignedLoans.length,
      topBorrowers,
    })

    try {
      await sendEmail({ to: agent.agentUser.email, subject, html, text })
      sent++
    } catch {
      skipped++
    }
  }

  return { sent, skipped }
}
