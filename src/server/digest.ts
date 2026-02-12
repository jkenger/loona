/**
 * Daily agent activity digest processing. Server-only — no session required.
 * Queries payments recorded by agents in the last 24 hours and emails each
 * lender a summary, grouped by agent.
 */
import { db, payments, loans, contacts, agents, user } from "@/lib/db"
import { and, gte, isNotNull, isNull, eq } from "drizzle-orm"
import { aliasedTable } from "drizzle-orm"
import { sendEmail, agentActivityDigestEmail } from "@/lib/email"

export async function sendAgentActivityDigests() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const agentUser = aliasedTable(user, "agentUser")

  // Query all non-reversed agent-recorded payments from the last 24 hours
  const rows = await db
    .select({
      paymentId: payments.id,
      amount: payments.amount,
      lenderId: loans.lenderId,
      lenderName: user.name,
      lenderEmail: user.email,
      agentId: payments.recordedByAgentId,
      agentName: agentUser.name,
    })
    .from(payments)
    .innerJoin(loans, eq(payments.loanId, loans.id))
    .innerJoin(user, eq(loans.lenderId, user.id))
    .innerJoin(agents, eq(payments.recordedByAgentId, agents.id))
    .innerJoin(agentUser, eq(agents.agentUserId, agentUser.id))
    .where(
      and(
        isNotNull(payments.recordedByAgentId),
        isNull(payments.reversedAt),
        gte(payments.paidAt, since),
      ),
    )

  if (rows.length === 0) {
    return { lendersNotified: 0, totalPayments: 0 }
  }

  // Group by lender, then by agent
  const byLender = new Map<
    string,
    {
      lenderName: string
      lenderEmail: string
      agents: Map<string, { agentName: string; payments: number; total: number }>
    }
  >()

  for (const row of rows) {
    if (!byLender.has(row.lenderId)) {
      byLender.set(row.lenderId, {
        lenderName: row.lenderName,
        lenderEmail: row.lenderEmail,
        agents: new Map(),
      })
    }

    const lenderData = byLender.get(row.lenderId)!
    const agentId = row.agentId!

    if (!lenderData.agents.has(agentId)) {
      lenderData.agents.set(agentId, {
        agentName: row.agentName,
        payments: 0,
        total: 0,
      })
    }

    const agentData = lenderData.agents.get(agentId)!
    agentData.payments += 1
    agentData.total += parseFloat(row.amount)
  }

  const dashboardBase = process.env.BETTER_AUTH_URL || "https://loona.app"
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const formatPHP = (amount: number) =>
    `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  let lendersNotified = 0

  for (const [, lenderData] of byLender) {
    const agentsList = Array.from(lenderData.agents.values()).map((a) => ({
      name: a.agentName,
      paymentCount: a.payments,
      totalAmount: formatPHP(a.total),
    }))

    const grandTotal = formatPHP(
      Array.from(lenderData.agents.values()).reduce((sum, a) => sum + a.total, 0),
    )

    const email = agentActivityDigestEmail({
      lenderName: lenderData.lenderName,
      date: dateStr,
      agents: agentsList,
      grandTotal,
      dashboardUrl: `${dashboardBase}/dashboard`,
    })

    await sendEmail({
      to: lenderData.lenderEmail,
      ...email,
    })

    lendersNotified++
  }

  return { lendersNotified, totalPayments: rows.length }
}
