import { db, loans, payments, paymentSchedule, user } from "@/lib/db"
import { eq, and, gte, lte, sql, isNull } from "drizzle-orm"
import { parseLenderConfig } from "@/lib/constants/lender-defaults"
import { sendEmail, lenderDailySummaryEmail } from "@/lib/email"

const formatPHP = (amount: number) =>
  `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export async function sendDailySummaries() {
  const allSettings = await db.query.lenderSettings.findMany()
  const enabledLenders = allSettings
    .map((row) => ({ lenderId: row.lenderId, config: parseLenderConfig(row.config) }))
    .filter((r) => r.config.lenderDailySummaryEnabled)

  if (enabledLenders.length === 0) return { sent: 0 }

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  const next7Days = new Date(todayStart)
  next7Days.setDate(next7Days.getDate() + 7)

  const dashboardBase = process.env.BETTER_AUTH_URL || "https://loona.ph"
  const dateStr = now.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })

  let sent = 0

  for (const { lenderId } of enabledLenders) {
    const lender = await db.query.user.findFirst({ where: eq(user.id, lenderId) })
    if (!lender?.email) continue

    // Collections today
    const todayPayments = await db
      .select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)` })
      .from(payments)
      .innerJoin(loans, eq(payments.loanId, loans.id))
      .where(and(
        eq(loans.lenderId, lenderId),
        gte(payments.paidAt, todayStart),
        isNull(payments.reversedAt),
      ))
    const collectionsToday = parseFloat(todayPayments[0]?.total ?? "0")

    // Loans completed today
    const completedToday = await db
      .select({ count: sql<number>`count(*)` })
      .from(loans)
      .where(and(
        eq(loans.lenderId, lenderId),
        eq(loans.status, "completed"),
        gte(loans.completedAt, todayStart),
      ))
    const loansCompleted = completedToday[0]?.count ?? 0

    // Upcoming due in next 7 days
    const upcoming = await db
      .select({ count: sql<number>`count(*)` })
      .from(paymentSchedule)
      .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
      .where(and(
        eq(loans.lenderId, lenderId),
        eq(paymentSchedule.status, "pending"),
        gte(paymentSchedule.dueDate, todayStart),
        lte(paymentSchedule.dueDate, next7Days),
      ))
    const upcomingDueCount = upcoming[0]?.count ?? 0

    // Overdue count
    const overdue = await db
      .select({ count: sql<number>`count(*)` })
      .from(paymentSchedule)
      .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
      .where(and(
        eq(loans.lenderId, lenderId),
        eq(paymentSchedule.status, "overdue"),
      ))
    const overdueCount = overdue[0]?.count ?? 0

    // Total outstanding
    const outstanding = await db
      .select({ total: sql<string>`coalesce(sum(${loans.remainingBalance}), 0)` })
      .from(loans)
      .where(and(
        eq(loans.lenderId, lenderId),
        eq(loans.status, "active"),
      ))
    const totalOutstanding = parseFloat(outstanding[0]?.total ?? "0")

    // Missed payment escalation: borrowers with 2+ consecutive overdue items
    const lenderLoans = await db.query.loans.findMany({
      where: and(eq(loans.lenderId, lenderId), eq(loans.status, "active")),
      with: {
        contact: true,
        schedule: { orderBy: (s, { asc }) => [asc(s.dueDate)] },
      },
    })

    const missedPaymentBorrowers: { name: string; consecutiveMissed: number; loanReference: string }[] = []
    for (const loan of lenderLoans) {
      // Count consecutive overdue items from the most recent
      let consecutive = 0
      const reversed = [...loan.schedule].reverse()
      for (const item of reversed) {
        if (item.status === "overdue") {
          consecutive++
        } else if (item.status === "pending" || item.status === "paid" || item.status === "partial") {
          break
        }
      }
      if (consecutive >= 2 && loan.contact) {
        missedPaymentBorrowers.push({
          name: loan.contact.name,
          consecutiveMissed: consecutive,
          loanReference: loan.id.slice(0, 8).toUpperCase(),
        })
      }
    }

    const { subject, html, text } = lenderDailySummaryEmail({
      lenderName: lender.name,
      date: dateStr,
      collectionsToday: formatPHP(collectionsToday),
      loansCompleted,
      upcomingDueCount,
      overdueCount,
      totalOutstanding: formatPHP(totalOutstanding),
      missedPaymentBorrowers,
      dashboardUrl: `${dashboardBase}/dashboard`,
    })

    try {
      const result = await sendEmail({ to: lender.email, subject, html, text })
      if (result.success && !("skipped" in result)) {
        sent++
      } else {
        console.error("[Daily Summary] Email failed for", lender.email, result)
      }
    } catch (err) {
      console.error("[Daily Summary] Email error for", lender.email, err)
    }
  }

  return { sent }
}
