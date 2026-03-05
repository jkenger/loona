import { db, loans, contacts, paymentSchedule } from "@/lib/db"
import { eq, and, sql, gte, lte, lt } from "drizzle-orm"
import { format, subMonths, startOfMonth, endOfMonth, startOfDay, endOfDay, addDays } from "date-fns"

export async function buildBriefing(lenderId: string): Promise<string> {
  const now = new Date()
  const today = startOfDay(now)
  const tomorrow = addDays(today, 1)
  const tomorrowEnd = endOfDay(tomorrow)

  // Payments due today
  const dueToday = await db
    .select({
      count: sql<number>`count(*)::int`,
      amount: sql<string>`coalesce(sum(${paymentSchedule.amount} - ${paymentSchedule.paidAmount}), 0)`,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .where(
      and(
        eq(loans.lenderId, lenderId),
        gte(paymentSchedule.dueDate, today),
        lte(paymentSchedule.dueDate, endOfDay(today)),
        eq(paymentSchedule.status, "pending"),
      )
    )

  // Payments due tomorrow
  const dueTomorrow = await db
    .select({
      count: sql<number>`count(*)::int`,
      amount: sql<string>`coalesce(sum(${paymentSchedule.amount} - ${paymentSchedule.paidAmount}), 0)`,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .where(
      and(
        eq(loans.lenderId, lenderId),
        gte(paymentSchedule.dueDate, tomorrow),
        lte(paymentSchedule.dueDate, tomorrowEnd),
        eq(paymentSchedule.status, "pending"),
      )
    )

  // Overdue
  const overdue = await db
    .select({
      count: sql<number>`count(*)::int`,
      amount: sql<string>`coalesce(sum(${paymentSchedule.amount} - ${paymentSchedule.paidAmount}), 0)`,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .where(
      and(eq(loans.lenderId, lenderId), eq(paymentSchedule.status, "overdue"))
    )

  // Collection rate this month vs last month
  const thisMonthStart = startOfMonth(now)
  const thisMonthEnd = endOfMonth(now)
  const lastMonthStart = startOfMonth(subMonths(now, 1))
  const lastMonthEnd = endOfMonth(subMonths(now, 1))

  const collectionThisMonth = await db
    .select({
      expected: sql<string>`coalesce(sum(${paymentSchedule.amount}), 0)`,
      collected: sql<string>`coalesce(sum(${paymentSchedule.paidAmount}), 0)`,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .where(
      and(
        eq(loans.lenderId, lenderId),
        gte(paymentSchedule.dueDate, thisMonthStart),
        lte(paymentSchedule.dueDate, thisMonthEnd),
      )
    )

  const collectionLastMonth = await db
    .select({
      expected: sql<string>`coalesce(sum(${paymentSchedule.amount}), 0)`,
      collected: sql<string>`coalesce(sum(${paymentSchedule.paidAmount}), 0)`,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .where(
      and(
        eq(loans.lenderId, lenderId),
        gte(paymentSchedule.dueDate, lastMonthStart),
        lte(paymentSchedule.dueDate, lastMonthEnd),
      )
    )

  // Recently completed loans (last 7 days)
  const recentlyCompleted = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loans)
    .where(
      and(
        eq(loans.lenderId, lenderId),
        eq(loans.status, "completed"),
        gte(loans.updatedAt, addDays(today, -7)),
      )
    )

  // At-risk borrowers (overdue > 7 days)
  const atRisk = await db
    .select({
      count: sql<number>`count(distinct ${contacts.id})::int`,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .innerJoin(contacts, eq(loans.contactId, contacts.id))
    .where(
      and(
        eq(loans.lenderId, lenderId),
        eq(paymentSchedule.status, "overdue"),
        lt(paymentSchedule.dueDate, addDays(today, -7)),
      )
    )

  // Format values
  const dueTodayData = dueToday[0]
  const dueTomorrowData = dueTomorrow[0]
  const overdueData = overdue[0]
  const thisMonth = collectionThisMonth[0]
  const lastMonth = collectionLastMonth[0]

  const thisExpected = Number(thisMonth?.expected ?? 0)
  const thisCollected = Number(thisMonth?.collected ?? 0)
  const lastExpected = Number(lastMonth?.expected ?? 0)
  const lastCollected = Number(lastMonth?.collected ?? 0)

  const thisRate = thisExpected > 0 ? Math.round((thisCollected / thisExpected) * 100) : 0
  const lastRate = lastExpected > 0 ? Math.round((lastCollected / lastExpected) * 100) : 0
  const rateTrend = thisRate > lastRate ? "up" : thisRate < lastRate ? "down" : "neutral"

  const overdueAmount = Number(overdueData?.amount ?? 0)
  const completedCount = recentlyCompleted[0]?.count ?? 0
  const atRiskCount = atRisk[0]?.count ?? 0

  const formatPeso = (n: number) => `₱${n.toLocaleString()}`

  // Greeting based on time of day
  const hour = now.getHours()
  const greeting = hour < 12 ? "Magandang umaga" : hour < 18 ? "Magandang hapon" : "Magandang gabi"

  // Build briefing
  const lines: string[] = []
  lines.push(`${greeting}! Here's your snapshot for ${format(now, "MMMM d, yyyy")}.`)
  lines.push("")

  // Stats block
  const stats: { label: string; value: string; trend?: string }[] = [
    { label: "Due Today", value: `${dueTodayData?.count ?? 0} payments` },
    { label: "Overdue", value: formatPeso(overdueAmount), trend: overdueAmount > 0 ? "down" : "neutral" },
    { label: "Collection Rate", value: `${thisRate}%`, trend: rateTrend },
  ]

  if (completedCount > 0) {
    stats.push({ label: "Completed (7d)", value: `${completedCount} loans`, trend: "up" })
  }

  lines.push(":::stats")
  lines.push(JSON.stringify(stats))
  lines.push(":::")

  // Alerts
  if ((dueTomorrowData?.count ?? 0) > 0) {
    lines.push("")
    lines.push(":::alert")
    lines.push(JSON.stringify({
      type: "warning",
      title: `${dueTomorrowData!.count} Due Tomorrow`,
      message: `${formatPeso(Number(dueTomorrowData!.amount))} expected — make sure borrowers are reminded.`,
    }))
    lines.push(":::")
  }

  if (atRiskCount > 0) {
    lines.push("")
    lines.push(":::alert")
    lines.push(JSON.stringify({
      type: "warning",
      title: `${atRiskCount} At-Risk Borrower${atRiskCount > 1 ? "s" : ""}`,
      message: `Overdue for more than 7 days. Consider following up.`,
    }))
    lines.push(":::")
  }

  if (overdueAmount === 0 && (dueTodayData?.count ?? 0) === 0) {
    lines.push("")
    lines.push(":::alert")
    lines.push(JSON.stringify({
      type: "success",
      title: "All Clear!",
      message: "No overdue payments and nothing due today. Looking good!",
    }))
    lines.push(":::")
  }

  lines.push("")
  lines.push("Anything you'd like to dig into?")

  return lines.join("\n")
}
