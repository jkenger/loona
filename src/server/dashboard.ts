import { createServerFn } from "@tanstack/react-start"
import { db, loans, contacts, paymentSchedule } from "@/lib/db"
import { eq, and, sql, gte, lte, or } from "drizzle-orm"
import { requireAuth } from "./session"
import {
  startOfMonth,
  endOfMonth,
  format,
  addDays,
} from "date-fns"

export type CalendarPayment = {
  id: string
  loanId: string
  borrowerName: string
  amount: string
  status: "pending" | "paid" | "overdue" | "partial"
  paidAmount: string
}

export type CalendarDay = {
  payments: CalendarPayment[]
  totalExpected: number
  totalPaid: number
  hasPaid: boolean
  hasPending: boolean
  hasOverdue: boolean
}

export const getDashboardStats = createServerFn<{
  data?: { month?: string }
}>().handler(async (ctx) => {
  const session = await requireAuth()
  const userId = session.user.id

  const targetMonth = ctx?.data?.month ? new Date(ctx.data.month) : new Date()

  // Get loan stats
  const loanStats = await db
    .select({
      totalLoans: sql<number>`count(*)::int`,
      activeLoans: sql<number>`count(*) filter (where ${loans.status} = 'active')::int`,
      totalDisbursed: sql<string>`coalesce(sum(${loans.principal}), 0)`,
      totalCollected: sql<string>`coalesce(sum(${loans.amountPaid}), 0)`,
      outstandingBalance: sql<string>`coalesce(sum(${loans.remainingBalance}), 0)`,
    })
    .from(loans)
    .where(eq(loans.lenderId, userId))

  // Get contact count
  const contactStats = await db
    .select({
      totalContacts: sql<number>`count(*)::int`,
    })
    .from(contacts)
    .where(eq(contacts.lenderId, userId))

  // Get overdue payments
  const now = new Date()
  const overdueStats = await db
    .select({
      overdueCount: sql<number>`count(*)::int`,
      overdueAmount: sql<string>`coalesce(sum(${paymentSchedule.amount} - ${paymentSchedule.paidAmount}), 0)`,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .where(and(eq(loans.lenderId, userId), eq(paymentSchedule.status, "overdue")))

  // Get expected/collected payments this month
  const monthStart = startOfMonth(targetMonth)
  const monthEnd = endOfMonth(targetMonth)

  const monthlyExpected = await db
    .select({
      amount: sql<string>`coalesce(sum(${paymentSchedule.amount}), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .where(
      and(
        eq(loans.lenderId, userId),
        gte(paymentSchedule.dueDate, monthStart),
        lte(paymentSchedule.dueDate, monthEnd)
      )
    )

  const monthlyCollected = await db
    .select({
      amount: sql<string>`coalesce(sum(${paymentSchedule.paidAmount}), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .where(
      and(
        eq(loans.lenderId, userId),
        gte(paymentSchedule.dueDate, monthStart),
        lte(paymentSchedule.dueDate, monthEnd),
        eq(paymentSchedule.status, "paid")
      )
    )

  // Get calendar data for the month
  const calendarPayments = await db
    .select({
      id: paymentSchedule.id,
      loanId: paymentSchedule.loanId,
      dueDate: paymentSchedule.dueDate,
      amount: paymentSchedule.amount,
      paidAmount: paymentSchedule.paidAmount,
      status: paymentSchedule.status,
      contactName: contacts.name,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .innerJoin(contacts, eq(loans.contactId, contacts.id))
    .where(
      and(
        eq(loans.lenderId, userId),
        gte(paymentSchedule.dueDate, monthStart),
        lte(paymentSchedule.dueDate, monthEnd)
      )
    )
    .orderBy(paymentSchedule.dueDate)

  // Build calendar data map
  const calendarData: Record<string, CalendarDay> = {}
  for (const payment of calendarPayments) {
    const dateKey = format(payment.dueDate, "yyyy-MM-dd")
    if (!calendarData[dateKey]) {
      calendarData[dateKey] = {
        payments: [],
        totalExpected: 0,
        totalPaid: 0,
        hasPaid: false,
        hasPending: false,
        hasOverdue: false,
      }
    }
    calendarData[dateKey].payments.push({
      id: payment.id,
      loanId: payment.loanId,
      borrowerName: payment.contactName,
      amount: payment.amount,
      paidAmount: payment.paidAmount,
      status: payment.status as CalendarPayment["status"],
    })
    calendarData[dateKey].totalExpected += parseFloat(payment.amount)
    calendarData[dateKey].totalPaid += parseFloat(payment.paidAmount)
    if (payment.status === "paid") calendarData[dateKey].hasPaid = true
    if (payment.status === "pending") calendarData[dateKey].hasPending = true
    if (payment.status === "overdue") calendarData[dateKey].hasOverdue = true
  }

  // Get forecast data (30/60/90 days)
  const next30 = addDays(now, 30)
  const next60 = addDays(now, 60)
  const next90 = addDays(now, 90)

  const forecast30 = await db
    .select({
      amount: sql<string>`coalesce(sum(${paymentSchedule.amount}), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .where(
      and(
        eq(loans.lenderId, userId),
        gte(paymentSchedule.dueDate, now),
        lte(paymentSchedule.dueDate, next30),
        or(eq(paymentSchedule.status, "pending"), eq(paymentSchedule.status, "overdue"))
      )
    )

  const forecast60 = await db
    .select({
      amount: sql<string>`coalesce(sum(${paymentSchedule.amount}), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .where(
      and(
        eq(loans.lenderId, userId),
        gte(paymentSchedule.dueDate, now),
        lte(paymentSchedule.dueDate, next60),
        or(eq(paymentSchedule.status, "pending"), eq(paymentSchedule.status, "overdue"))
      )
    )

  const forecast90 = await db
    .select({
      amount: sql<string>`coalesce(sum(${paymentSchedule.amount}), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .where(
      and(
        eq(loans.lenderId, userId),
        gte(paymentSchedule.dueDate, now),
        lte(paymentSchedule.dueDate, next90),
        or(eq(paymentSchedule.status, "pending"), eq(paymentSchedule.status, "overdue"))
      )
    )

  // Calculate collection rate
  const expectedAmount = parseFloat(monthlyExpected[0]?.amount ?? "0")
  const collectedAmount = parseFloat(monthlyCollected[0]?.amount ?? "0")
  const collectionRate = expectedAmount > 0 ? Math.round((collectedAmount / expectedAmount) * 100) : 0

  // Get upcoming payments (next 7 days, including today)
  const next7Days = addDays(now, 7)
  const upcomingPayments = await db
    .select({
      id: paymentSchedule.id,
      loanId: paymentSchedule.loanId,
      dueDate: paymentSchedule.dueDate,
      amount: paymentSchedule.amount,
      paidAmount: paymentSchedule.paidAmount,
      status: paymentSchedule.status,
      contactId: contacts.id,
      contactName: contacts.name,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .innerJoin(contacts, eq(loans.contactId, contacts.id))
    .where(
      and(
        eq(loans.lenderId, userId),
        gte(paymentSchedule.dueDate, now),
        lte(paymentSchedule.dueDate, next7Days),
        or(eq(paymentSchedule.status, "pending"), eq(paymentSchedule.status, "partial"))
      )
    )
    .orderBy(paymentSchedule.dueDate)
    .limit(5)

  return {
    // Portfolio stats
    totalLoans: loanStats[0]?.totalLoans ?? 0,
    activeLoans: loanStats[0]?.activeLoans ?? 0,
    totalDisbursed: loanStats[0]?.totalDisbursed ?? "0",
    totalCollected: loanStats[0]?.totalCollected ?? "0",
    outstandingBalance: loanStats[0]?.outstandingBalance ?? "0",
    totalContacts: contactStats[0]?.totalContacts ?? 0,

    // Monthly summary
    expectedThisMonth: monthlyExpected[0]?.amount ?? "0",
    collectedThisMonth: monthlyCollected[0]?.amount ?? "0",
    paymentsExpected: monthlyExpected[0]?.count ?? 0,
    paymentsCollected: monthlyCollected[0]?.count ?? 0,
    collectionRate,

    // Overdue
    overdueCount: overdueStats[0]?.overdueCount ?? 0,
    overdueAmount: overdueStats[0]?.overdueAmount ?? "0",

    // Calendar
    calendarData,
    currentMonth: targetMonth.toISOString(),

    // Forecast
    forecast: {
      next30Days: forecast30[0]?.amount ?? "0",
      next30DaysCount: forecast30[0]?.count ?? 0,
      next60Days: forecast60[0]?.amount ?? "0",
      next60DaysCount: forecast60[0]?.count ?? 0,
      next90Days: forecast90[0]?.amount ?? "0",
      next90DaysCount: forecast90[0]?.count ?? 0,
    },

    // Upcoming payments (next 7 days)
    upcomingPayments: upcomingPayments.map((p) => ({
      id: p.id,
      loanId: p.loanId,
      dueDate: p.dueDate.toISOString(),
      amount: p.amount,
      paidAmount: p.paidAmount,
      status: p.status,
      contactId: p.contactId,
      contactName: p.contactName,
    })),
  }
})
