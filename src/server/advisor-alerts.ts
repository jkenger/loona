import { db, loans, contacts, paymentSchedule, advisorAlerts } from "@/lib/db"
import { eq, and, sql, gte, lt, lte, isNull, desc } from "drizzle-orm"
import { createServerFn } from "@tanstack/react-start"
import { getServerSession } from "@/server/session"
import { addDays, startOfDay, endOfDay, subDays, subMonths, startOfMonth, endOfMonth } from "date-fns"

// ============================================================================
// Alert evaluation — called on dashboard load
// ============================================================================

export async function evaluateAlerts(lenderId: string): Promise<void> {
  const now = new Date()
  const today = startOfDay(now)
  const tomorrow = addDays(today, 1)
  const tomorrowEnd = endOfDay(tomorrow)

  // 1. Payment due tomorrow for historically late payers
  const dueTomorrowRisky = await db
    .select({
      contactName: contacts.name,
      contactId: contacts.id,
      loanId: paymentSchedule.loanId,
      amount: paymentSchedule.amount,
      onTimeRate: contacts.onTimeRate,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .innerJoin(contacts, eq(loans.contactId, contacts.id))
    .where(
      and(
        eq(loans.lenderId, lenderId),
        gte(paymentSchedule.dueDate, tomorrow),
        lte(paymentSchedule.dueDate, tomorrowEnd),
        eq(paymentSchedule.status, "pending"),
        lt(contacts.onTimeRate, sql`80`),
      )
    )

  for (const item of dueTomorrowRisky) {
    await insertAlertIfNew(lenderId, "payment_due_risk", {
      title: `Payment at risk: ${item.contactName}`,
      message: `₱${Number(item.amount).toLocaleString()} due tomorrow. On-time rate: ${item.onTimeRate}%. [View borrower](/contacts/${item.contactId})`,
      metadata: { contactId: item.contactId, loanId: item.loanId, type: "payment_due_risk" },
    })
  }

  // 2. Overdue escalation thresholds
  const overdueThresholds = [
    { days: 30, label: "30+ days overdue" },
    { days: 14, label: "14+ days overdue" },
    { days: 7, label: "7+ days overdue" },
  ]

  for (const threshold of overdueThresholds) {
    const cutoff = subDays(today, threshold.days)
    const escalated = await db
      .select({
        contactName: contacts.name,
        contactId: contacts.id,
        loanId: paymentSchedule.loanId,
        amount: sql<string>`coalesce(sum(${paymentSchedule.amount} - ${paymentSchedule.paidAmount}), 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(paymentSchedule)
      .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
      .innerJoin(contacts, eq(loans.contactId, contacts.id))
      .where(
        and(
          eq(loans.lenderId, lenderId),
          eq(paymentSchedule.status, "overdue"),
          lt(paymentSchedule.dueDate, cutoff),
        )
      )
      .groupBy(contacts.id, contacts.name, paymentSchedule.loanId)

    for (const item of escalated) {
      await insertAlertIfNew(lenderId, "overdue_escalation", {
        title: `${threshold.label}: ${item.contactName}`,
        message: `₱${Number(item.amount).toLocaleString()} overdue across ${item.count} payment(s). [View borrower](/contacts/${item.contactId})`,
        metadata: { contactId: item.contactId, loanId: item.loanId, days: threshold.days, type: "overdue_escalation" },
      })
    }
  }

  // 3. Loan milestones — loans that recently reached 50% paid or fully paid
  const milestoneLoansPaid = await db
    .select({
      loanId: loans.id,
      contactName: contacts.name,
      contactId: contacts.id,
      principal: loans.principal,
      amountPaid: loans.amountPaid,
      totalToRepay: loans.totalToRepay,
      status: loans.status,
    })
    .from(loans)
    .innerJoin(contacts, eq(loans.contactId, contacts.id))
    .where(
      and(
        eq(loans.lenderId, lenderId),
        eq(loans.status, "completed"),
        gte(loans.updatedAt, subDays(today, 1)),
      )
    )

  for (const loan of milestoneLoansPaid) {
    await insertAlertIfNew(lenderId, "loan_milestone", {
      title: `Loan fully paid: ${loan.contactName}`,
      message: `₱${Number(loan.principal).toLocaleString()} loan completed! [View loan](/loans/${loan.loanId})`,
      metadata: { loanId: loan.loanId, contactId: loan.contactId, milestone: "completed", type: "loan_milestone" },
    })
  }

  // Check 50% milestone for active loans
  const halfwayLoans = await db
    .select({
      loanId: loans.id,
      contactName: contacts.name,
      contactId: contacts.id,
      principal: loans.principal,
      amountPaid: loans.amountPaid,
      totalToRepay: loans.totalToRepay,
    })
    .from(loans)
    .innerJoin(contacts, eq(loans.contactId, contacts.id))
    .where(
      and(
        eq(loans.lenderId, lenderId),
        eq(loans.status, "active"),
        gte(loans.amountPaid, sql`${loans.totalToRepay} * 0.5`),
      )
    )

  for (const loan of halfwayLoans) {
    await insertAlertIfNew(lenderId, "loan_milestone", {
      title: `50% paid: ${loan.contactName}`,
      message: `₱${Number(loan.amountPaid).toLocaleString()} of ₱${Number(loan.totalToRepay).toLocaleString()} repaid. [View loan](/loans/${loan.loanId})`,
      metadata: { loanId: loan.loanId, contactId: loan.contactId, milestone: "50_percent", type: "loan_milestone" },
    })
  }

  // 4. Collection rate dropping vs trailing average
  const thisMonthStart = startOfMonth(now)
  const thisMonthEnd = endOfMonth(now)
  const trailingStart = startOfMonth(subMonths(now, 3))
  const trailingEnd = endOfMonth(subMonths(now, 1))

  const [currentMonth, trailing] = await Promise.all([
    db.select({
      expected: sql<string>`coalesce(sum(${paymentSchedule.amount}), 0)`,
      collected: sql<string>`coalesce(sum(${paymentSchedule.paidAmount}), 0)`,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .where(and(eq(loans.lenderId, lenderId), gte(paymentSchedule.dueDate, thisMonthStart), lte(paymentSchedule.dueDate, thisMonthEnd))),

    db.select({
      expected: sql<string>`coalesce(sum(${paymentSchedule.amount}), 0)`,
      collected: sql<string>`coalesce(sum(${paymentSchedule.paidAmount}), 0)`,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .where(and(eq(loans.lenderId, lenderId), gte(paymentSchedule.dueDate, trailingStart), lte(paymentSchedule.dueDate, trailingEnd))),
  ])

  const currentExp = Number(currentMonth[0]?.expected ?? 0)
  const currentCol = Number(currentMonth[0]?.collected ?? 0)
  const trailingExp = Number(trailing[0]?.expected ?? 0)
  const trailingCol = Number(trailing[0]?.collected ?? 0)

  const currentRate = currentExp > 0 ? (currentCol / currentExp) * 100 : 0
  const trailingRate = trailingExp > 0 ? (trailingCol / trailingExp) * 100 : 0

  if (trailingRate > 0 && currentRate < trailingRate - 10) {
    await insertAlertIfNew(lenderId, "collection_rate_drop", {
      title: "Collection rate declining",
      message: `Current month: ${Math.round(currentRate)}% vs trailing avg: ${Math.round(trailingRate)}%. [View payments](/payments)`,
      metadata: { currentRate: Math.round(currentRate), trailingRate: Math.round(trailingRate), type: "collection_rate_drop" },
    })
  }
}

// ============================================================================
// Deduplication helper
// ============================================================================

async function insertAlertIfNew(
  lenderId: string,
  type: "payment_due_risk" | "overdue_escalation" | "loan_milestone" | "collection_rate_drop",
  data: { title: string; message: string; metadata: Record<string, unknown> },
) {
  // Check for duplicate: same type + same metadata key identifiers within last 24h
  const since = subDays(new Date(), 1)
  const existing = await db
    .select({ id: advisorAlerts.id })
    .from(advisorAlerts)
    .where(
      and(
        eq(advisorAlerts.lenderId, lenderId),
        eq(advisorAlerts.type, type),
        eq(advisorAlerts.title, data.title),
        gte(advisorAlerts.createdAt, since),
      )
    )
    .limit(1)

  if (existing.length > 0) return

  await db.insert(advisorAlerts).values({
    lenderId,
    type,
    title: data.title,
    message: data.message,
    metadata: data.metadata,
  })
}

// ============================================================================
// Server functions for UI
// ============================================================================

export const getUnreadAlertCount = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getServerSession()
  if (!session) return 0

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(advisorAlerts)
    .where(and(eq(advisorAlerts.lenderId, session.user.id), isNull(advisorAlerts.readAt)))

  return result[0]?.count ?? 0
})

export const getUnreadAlerts = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getServerSession()
  if (!session) return []

  const rows = await db
    .select({
      id: advisorAlerts.id,
      title: advisorAlerts.title,
      message: advisorAlerts.message,
      type: advisorAlerts.type,
      createdAt: advisorAlerts.createdAt,
    })
    .from(advisorAlerts)
    .where(and(eq(advisorAlerts.lenderId, session.user.id), isNull(advisorAlerts.readAt)))
    .orderBy(desc(advisorAlerts.createdAt))
    .limit(10)

  return rows
})

export const markAlertsRead = createServerFn({ method: "POST" }).handler(async () => {
  const session = await getServerSession()
  if (!session) return

  await db
    .update(advisorAlerts)
    .set({ readAt: new Date() })
    .where(and(eq(advisorAlerts.lenderId, session.user.id), isNull(advisorAlerts.readAt)))
})

export const triggerAlertEvaluation = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getServerSession()
  if (!session) return

  await evaluateAlerts(session.user.id)
})
