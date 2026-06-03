import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { db, loans, contacts, paymentSchedule, payments, penalties, agents, commissions, auditLogs } from "@/lib/db"
import { eq, and, gte, lte, desc, sql, ne, isNull, inArray } from "drizzle-orm"
import { requireAuth } from "./session"
import { subMonths, startOfMonth, addDays, startOfDay } from "date-fns"

// ============================================================================
// Portfolio Analytics
// ============================================================================

export const getPortfolioAnalytics = createServerFn()
  .inputValidator(z.object({ months: z.number().int().min(1).max(24).optional() }).optional())
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const lenderId = session.user.id
    const months = data?.months ?? 6
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

    const collectionTrend = monthlyCollection.map((m) => ({
      month: m.month,
      expected: Number(m.expected),
      collected: Number(m.collected),
      rate: Number(m.expected) > 0 ? Math.round((Number(m.collected) / Number(m.expected)) * 100) : 0,
    }))

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
      outstanding: Number(b.outstanding),
      percentage: totalOut > 0 ? Math.round((Number(b.outstanding) / totalOut) * 100) : 0,
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

    // Default rate + loss aggregates
    const loanCounts = await db
      .select({
        total: sql<number>`count(*)::int`,
        defaulted: sql<number>`count(*) filter (where ${loans.status} = 'defaulted')::int`,
        active: sql<number>`count(*) filter (where ${loans.status} = 'active')::int`,
        completed: sql<number>`count(*) filter (where ${loans.status} = 'completed')::int`,
        defaultedAmount: sql<string>`coalesce(sum(case when ${loans.status} = 'defaulted' then ${loans.remainingBalance} else 0 end), 0)`,
      })
      .from(loans)
      .where(eq(loans.lenderId, lenderId))

    const totalLoans = loanCounts[0]?.total ?? 0
    const defaultedCount = loanCounts[0]?.defaulted ?? 0
    const activeCount = loanCounts[0]?.active ?? 0
    const completedCount = loanCounts[0]?.completed ?? 0
    const defaultedAmount = Number(loanCounts[0]?.defaultedAmount ?? 0)
    const averageLoss = defaultedCount > 0 ? defaultedAmount / defaultedCount : 0

    // Recovered loans — distinct loan IDs with a "loan.recovered" audit entry
    const recoveredRows = await db
      .selectDistinct({ entityId: auditLogs.entityId })
      .from(auditLogs)
      .where(and(
        eq(auditLogs.userId, lenderId),
        eq(auditLogs.action, "loan.recovered"),
      ))
    const recoveredCount = recoveredRows.length
    const everDefaultedRows = await db
      .selectDistinct({ entityId: auditLogs.entityId })
      .from(auditLogs)
      .where(and(
        eq(auditLogs.userId, lenderId),
        eq(auditLogs.action, "loan.defaulted"),
      ))
    const everDefaultedCount = everDefaultedRows.length
    const recoveryRate = everDefaultedCount > 0
      ? Number(((recoveredCount / everDefaultedCount) * 100).toFixed(1))
      : 0

    // Monthly default trend — bucket `loan.defaulted` audit entries by month for the period
    const defaultEvents = await db
      .select({
        createdAt: auditLogs.createdAt,
        metadata: auditLogs.metadata,
      })
      .from(auditLogs)
      .where(and(
        eq(auditLogs.userId, lenderId),
        eq(auditLogs.action, "loan.defaulted"),
        gte(auditLogs.createdAt, periodStart),
      ))
      .orderBy(auditLogs.createdAt)

    const trendBuckets: Record<string, { count: number; totalLoss: number }> = {}
    for (let i = 0; i < months; i++) {
      const d = startOfMonth(subMonths(now, months - 1 - i))
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      trendBuckets[key] = { count: 0, totalLoss: 0 }
    }
    for (const e of defaultEvents) {
      const d = new Date(e.createdAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      if (!trendBuckets[key]) continue
      trendBuckets[key].count++
      if (e.metadata) {
        try {
          const meta = JSON.parse(e.metadata) as { remainingBalance?: string | number }
          const loss = typeof meta.remainingBalance === "string"
            ? parseFloat(meta.remainingBalance)
            : (meta.remainingBalance ?? 0)
          if (!isNaN(loss)) trendBuckets[key].totalLoss += loss
        } catch {
          // ignore malformed metadata
        }
      }
    }
    const defaultTrend = Object.entries(trendBuckets).map(([month, v]) => ({
      month,
      count: v.count,
      totalLoss: v.totalLoss,
    }))

    // Top defaulters — current defaulted loans grouped by contact, ranked by loss
    const topDefaultersRows = await db
      .select({
        contactId: contacts.id,
        contactName: contacts.name,
        loanCount: sql<number>`count(*)::int`,
        totalLoss: sql<string>`coalesce(sum(${loans.remainingBalance}), 0)`,
      })
      .from(loans)
      .innerJoin(contacts, eq(loans.contactId, contacts.id))
      .where(and(eq(loans.lenderId, lenderId), eq(loans.status, "defaulted")))
      .groupBy(contacts.id, contacts.name)
      .orderBy(sql`sum(${loans.remainingBalance}) desc`)
      .limit(5)
    const topDefaulters = topDefaultersRows.map((r) => ({
      contactId: r.contactId,
      contactName: r.contactName,
      loanCount: r.loanCount,
      totalLoss: Number(r.totalLoss),
    }))

    // Aging analysis of overdue payments
    const today = startOfDay(now)
    const overdueItems = await db
      .select({
        dueDate: paymentSchedule.dueDate,
        amount: paymentSchedule.amount,
        paidAmount: paymentSchedule.paidAmount,
      })
      .from(paymentSchedule)
      .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
      .where(and(eq(loans.lenderId, lenderId), eq(paymentSchedule.status, "overdue")))

    const buckets: Record<string, { count: number; amount: number }> = {
      "1-7 days": { count: 0, amount: 0 },
      "8-14 days": { count: 0, amount: 0 },
      "15-30 days": { count: 0, amount: 0 },
      "30+ days": { count: 0, amount: 0 },
    }
    for (const item of overdueItems) {
      const daysOverdue = Math.floor((today.getTime() - new Date(item.dueDate).getTime()) / (1000 * 60 * 60 * 24))
      const bucket = daysOverdue <= 7 ? "1-7 days" : daysOverdue <= 14 ? "8-14 days" : daysOverdue <= 30 ? "15-30 days" : "30+ days"
      buckets[bucket].count++
      buckets[bucket].amount += Number(item.amount) - Number(item.paidAmount)
    }
    const aging = Object.entries(buckets).map(([bucket, data]) => ({ bucket, ...data }))

    return {
      collectionTrend,
      concentration,
      totalOutstanding: totalOut,
      tierDistribution: tierDist.map((t) => ({ tier: t.tier ?? "new", count: t.count })),
      loanCounts: { total: totalLoans, defaulted: defaultedCount, active: activeCount, completed: completedCount },
      defaultRate: totalLoans > 0 ? Number(((defaultedCount / totalLoans) * 100).toFixed(1)) : 0,
      agingAnalysis: aging.map((a) => ({ bucket: a.bucket, count: a.count, amount: Number(a.amount) })),
      defaults: {
        count: defaultedCount,
        totalLoss: defaultedAmount,
        averageLoss,
        recoveredCount,
        everDefaultedCount,
        recoveryRate,
        trend: defaultTrend,
        topDefaulters,
      },
    }
  })

// ============================================================================
// Cash Flow Report
// ============================================================================

export const getCashFlowReport = createServerFn()
  .inputValidator(z.object({ months: z.number().int().min(1).max(24).optional() }).optional())
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const lenderId = session.user.id
    const months = data?.months ?? 6
    const now = new Date()
    const periodStart = startOfMonth(subMonths(now, months - 1))

    // Collections by month (actual payments received)
    const monthlyCollections = await db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${payments.paidAt}), 'YYYY-MM')`,
        collected: sql<string>`coalesce(sum(case when ${payments.type} = 'credit' and ${payments.reversedAt} is null then ${payments.amount} else 0 end), 0)`,
      })
      .from(payments)
      .innerJoin(loans, eq(payments.loanId, loans.id))
      .where(and(eq(loans.lenderId, lenderId), gte(payments.paidAt, periodStart)))
      .groupBy(sql`date_trunc('month', ${payments.paidAt})`)
      .orderBy(sql`date_trunc('month', ${payments.paidAt})`)

    // Expected by month (schedule items due)
    const monthlyExpected = await db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${paymentSchedule.dueDate}), 'YYYY-MM')`,
        expected: sql<string>`coalesce(sum(${paymentSchedule.amount}), 0)`,
      })
      .from(paymentSchedule)
      .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
      .where(and(eq(loans.lenderId, lenderId), gte(paymentSchedule.dueDate, periodStart)))
      .groupBy(sql`date_trunc('month', ${paymentSchedule.dueDate})`)

    // Disbursements (loan principals started per month)
    const monthlyDisbursements = await db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${loans.startDate}), 'YYYY-MM')`,
        disbursed: sql<string>`coalesce(sum(${loans.principal}), 0)`,
      })
      .from(loans)
      .where(and(
        eq(loans.lenderId, lenderId),
        gte(loans.startDate, periodStart),
        ne(loans.status, "rejected"),
      ))
      .groupBy(sql`date_trunc('month', ${loans.startDate})`)

    // Commissions paid per month
    const monthlyCommissions = await db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${commissions.createdAt}), 'YYYY-MM')`,
        amount: sql<string>`coalesce(sum(${commissions.commissionAmount}), 0)`,
      })
      .from(commissions)
      .innerJoin(payments, eq(commissions.paymentId, payments.id))
      .innerJoin(loans, eq(payments.loanId, loans.id))
      .where(and(eq(loans.lenderId, lenderId), gte(commissions.createdAt, periodStart)))
      .groupBy(sql`date_trunc('month', ${commissions.createdAt})`)

    // Penalty income per month
    const monthlyPenalties = await db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${penalties.createdAt}), 'YYYY-MM')`,
        amount: sql<string>`coalesce(sum(case when ${penalties.status} = 'applied' then ${penalties.amount} else 0 end), 0)`,
      })
      .from(penalties)
      .innerJoin(loans, eq(penalties.loanId, loans.id))
      .where(and(eq(loans.lenderId, lenderId), gte(penalties.createdAt, periodStart)))
      .groupBy(sql`date_trunc('month', ${penalties.createdAt})`)

    // Merge all into monthly buckets
    const allMonths = new Set<string>()
    for (const r of [...monthlyCollections, ...monthlyExpected, ...monthlyDisbursements, ...monthlyCommissions, ...monthlyPenalties]) {
      allMonths.add(r.month)
    }
    const toMap = <T extends { month: string }>(arr: T[], key: keyof T) =>
      Object.fromEntries(arr.map((r) => [r.month, Number(r[key as string as keyof T])]))

    const colMap = toMap(monthlyCollections, "collected" as any)
    const expMap = toMap(monthlyExpected, "expected" as any)
    const disMap = toMap(monthlyDisbursements, "disbursed" as any)
    const comMap = toMap(monthlyCommissions, "amount" as any)
    const penMap = toMap(monthlyPenalties, "amount" as any)

    const cashFlow = Array.from(allMonths)
      .sort()
      .map((month) => {
        const collected = colMap[month] ?? 0
        const expected = expMap[month] ?? 0
        const disbursed = disMap[month] ?? 0
        const commission = comMap[month] ?? 0
        const penaltyIncome = penMap[month] ?? 0
        return {
          month,
          expected,
          collected,
          disbursed,
          commission,
          penaltyIncome,
          netProfit: collected + penaltyIncome - disbursed - commission,
        }
      })

    const totals = cashFlow.reduce(
      (acc, m) => ({
        collected: acc.collected + m.collected,
        expected: acc.expected + m.expected,
        disbursed: acc.disbursed + m.disbursed,
        commission: acc.commission + m.commission,
        penaltyIncome: acc.penaltyIncome + m.penaltyIncome,
        netProfit: acc.netProfit + m.netProfit,
      }),
      { collected: 0, expected: 0, disbursed: 0, commission: 0, penaltyIncome: 0, netProfit: 0 },
    )

    return { cashFlow, totals }
  })

// ============================================================================
// Borrower Risk Scores (batch)
// ============================================================================

export const getAllBorrowerRiskScores = createServerFn().handler(async () => {
  const session = await requireAuth()
  const lenderId = session.user.id

  // Batch query: get all contacts with aggregated loan/payment stats
  const borrowerStats = await db
    .select({
      contactId: contacts.id,
      name: contacts.name,
      tier: contacts.tier,
      onTimeRate: contacts.onTimeRate,
      phone: contacts.phone,
      totalLoans: sql<number>`count(distinct ${loans.id})::int`,
      activeLoans: sql<number>`count(distinct ${loans.id}) filter (where ${loans.status} = 'active')::int`,
      completedLoans: sql<number>`count(distinct ${loans.id}) filter (where ${loans.status} = 'completed')::int`,
      defaultedLoans: sql<number>`count(distinct ${loans.id}) filter (where ${loans.status} = 'defaulted')::int`,
      totalOutstanding: sql<string>`coalesce(sum(case when ${loans.status} = 'active' then ${loans.remainingBalance}::numeric else 0 end), 0)`,
    })
    .from(contacts)
    .leftJoin(loans, eq(contacts.id, loans.contactId))
    .where(eq(contacts.lenderId, lenderId))
    .groupBy(contacts.id, contacts.name, contacts.tier, contacts.onTimeRate, contacts.phone)
    .having(sql`count(${loans.id}) > 0`)

  // Get overdue/penalty counts per contact
  const overdueStats = await db
    .select({
      contactId: contacts.id,
      overdueCount: sql<number>`count(*) filter (where ${paymentSchedule.status} = 'overdue')::int`,
      lateCount: sql<number>`count(*) filter (where ${paymentSchedule.paidAt} is not null and ${paymentSchedule.paidAt} > ${paymentSchedule.dueDate})::int`,
      totalScheduled: sql<number>`count(*)::int`,
      penaltyCount: sql<number>`(select count(*) from penalties p inner join loans l on p.loan_id = l.id where l.contact_id = contacts.id and l.lender_id = ${lenderId})::int`,
    })
    .from(contacts)
    .innerJoin(loans, eq(contacts.id, loans.contactId))
    .innerJoin(paymentSchedule, eq(loans.id, paymentSchedule.loanId))
    .where(eq(contacts.lenderId, lenderId))
    .groupBy(contacts.id)

  const overdueMap = Object.fromEntries(overdueStats.map((o) => [o.contactId, o]))

  // Compute risk scores using same algorithm as advisor-tools
  const results = borrowerStats.map((b) => {
    const o = overdueMap[b.contactId]
    let score = 0

    // Defaults (40 pts max)
    if (b.defaultedLoans > 0) score += Math.min(40, b.defaultedLoans * 20)

    // Late payment ratio (20 pts max)
    const totalScheduled = o?.totalScheduled ?? 0
    const lateCount = o?.lateCount ?? 0
    if (totalScheduled > 0) {
      const lateRatio = lateCount / totalScheduled
      if (lateRatio > 0.5) score += 20
      else if (lateRatio > 0.3) score += 15
      else if (lateRatio > 0.15) score += 10
      else if (lateRatio > 0) score += 5
    }

    // Current overdue (15 pts max)
    const overdueCount = o?.overdueCount ?? 0
    if (overdueCount > 3) score += 15
    else if (overdueCount > 1) score += 10
    else if (overdueCount > 0) score += 8

    // Penalties (10 pts max)
    const penaltyCount = o?.penaltyCount ?? 0
    if (penaltyCount > 5) score += 10
    else if (penaltyCount > 2) score += 7
    else if (penaltyCount > 0) score += 5

    // On-time rate bonus (reduces score)
    const onTimeRate = Number(b.onTimeRate ?? 0)
    if (onTimeRate > 90) score -= 10
    else if (onTimeRate > 70) score -= 5

    score = Math.max(0, Math.min(100, score))

    const category =
      score <= 20 ? "low" :
      score <= 40 ? "medium" :
      score <= 60 ? "high" : "critical"

    return {
      contactId: b.contactId,
      name: b.name,
      tier: b.tier ?? "new",
      onTimeRate,
      phone: b.phone,
      totalLoans: b.totalLoans,
      activeLoans: b.activeLoans,
      defaultedLoans: b.defaultedLoans,
      outstanding: Number(b.totalOutstanding),
      overdueCount,
      penaltyCount,
      score,
      category,
    }
  })

  // Sort by risk score descending (highest risk first)
  results.sort((a, b) => b.score - a.score)

  const distribution = {
    low: results.filter((r) => r.category === "low").length,
    medium: results.filter((r) => r.category === "medium").length,
    high: results.filter((r) => r.category === "high").length,
    critical: results.filter((r) => r.category === "critical").length,
  }

  return { borrowers: results, distribution }
})

// ============================================================================
// Agent Performance
// ============================================================================

export const getAgentPerformance = createServerFn().handler(async () => {
  const session = await requireAuth()
  const lenderId = session.user.id

  const agentList = await db.query.agents.findMany({
    where: and(eq(agents.lenderId, lenderId), eq(agents.status, "active")),
    with: { agentUser: true },
  })

  const now = new Date()
  const threeMonthsAgo = startOfMonth(subMonths(now, 2))

  const results = await Promise.all(
    agentList.map(async (agent) => {
      // Assigned loans
      const assignedLoans = await db
        .select({
          total: sql<number>`count(*)::int`,
          active: sql<number>`count(*) filter (where ${loans.status} = 'active')::int`,
          completed: sql<number>`count(*) filter (where ${loans.status} = 'completed')::int`,
        })
        .from(loans)
        .where(eq(loans.assignedAgentId, agent.id))

      // Monthly collection trend (last 3 months)
      const monthlyCollections = await db
        .select({
          month: sql<string>`to_char(date_trunc('month', ${payments.paidAt}), 'YYYY-MM')`,
          collected: sql<string>`coalesce(sum(${payments.amount}), 0)`,
          count: sql<number>`count(*)::int`,
        })
        .from(payments)
        .where(and(
          eq(payments.recordedByAgentId, agent.id),
          eq(payments.type, "credit"),
          isNull(payments.reversedAt),
          gte(payments.paidAt, threeMonthsAgo),
        ))
        .groupBy(sql`date_trunc('month', ${payments.paidAt})`)
        .orderBy(sql`date_trunc('month', ${payments.paidAt})`)

      // Collection rate: payments collected / total expected on assigned active loans
      const expectedTotal = await db
        .select({
          expected: sql<string>`coalesce(sum(${paymentSchedule.amount}), 0)`,
          collected: sql<string>`coalesce(sum(${paymentSchedule.paidAmount}), 0)`,
        })
        .from(paymentSchedule)
        .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
        .where(eq(loans.assignedAgentId, agent.id))

      const expected = Number(expectedTotal[0]?.expected ?? 0)
      const collected = Number(expectedTotal[0]?.collected ?? 0)
      const collectionRate = expected > 0 ? Math.round((collected / expected) * 100) : 0

      // Commission totals
      const commissionData = await db
        .select({
          earned: sql<string>`coalesce(sum(${commissions.commissionAmount}), 0)`,
          count: sql<number>`count(*)::int`,
        })
        .from(commissions)
        .where(eq(commissions.agentId, agent.id))

      // Overdue count on assigned loans
      const overdueData = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(paymentSchedule)
        .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
        .where(and(
          eq(loans.assignedAgentId, agent.id),
          eq(paymentSchedule.status, "overdue"),
        ))

      return {
        id: agent.id,
        name: agent.agentUser?.name ?? "Unknown",
        email: agent.agentUser?.email,
        tier: agent.tier,
        commissionRate: agent.commissionRate,
        totalCollected: Number(agent.totalCollected ?? 0),
        totalCommissionEarned: Number(agent.totalCommissionEarned ?? 0),
        totalCommissionPaid: Number(agent.totalCommissionPaid ?? 0),
        loans: {
          total: assignedLoans[0]?.total ?? 0,
          active: assignedLoans[0]?.active ?? 0,
          completed: assignedLoans[0]?.completed ?? 0,
        },
        collectionRate,
        overdueCount: overdueData[0]?.count ?? 0,
        monthlyTrend: monthlyCollections.map((m) => ({
          month: m.month,
          collected: Number(m.collected),
          count: m.count,
        })),
      }
    }),
  )

  // Sort by collection rate descending
  results.sort((a, b) => b.collectionRate - a.collectionRate)

  return { agents: results }
})

// ============================================================================
// Renewal Suggestions
// ============================================================================

export const getRenewalSuggestions = createServerFn().handler(async () => {
  const session = await requireAuth()
  const lenderId = session.user.id

  // Find completed loans not yet renewed, completed within last 90 days
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const completedLoans = await db.query.loans.findMany({
    where: and(
      eq(loans.lenderId, lenderId),
      eq(loans.status, "completed"),
      gte(loans.completedAt, ninetyDaysAgo),
    ),
    with: {
      contact: true,
      renewals: true,
    },
    orderBy: desc(loans.completedAt),
  })

  // Filter out loans that already have a renewal
  const suggestions = completedLoans
    .filter((loan) => !loan.renewals || loan.renewals.length === 0)
    .map((loan) => ({
      loanId: loan.id,
      contactId: loan.contactId,
      borrowerName: loan.contact.name,
      borrowerPhone: loan.contact.phone,
      tier: loan.contact.tier ?? "new",
      onTimeRate: Number(loan.contact.onTimeRate ?? 0),
      principal: loan.principal,
      interestRate: loan.interestRate,
      termMonths: loan.termMonths,
      completedAt: loan.completedAt?.toISOString() ?? null,
    }))
    .sort((a, b) => {
      // Sort by tier quality then on-time rate
      const tierOrder: Record<string, number> = { loyal: 0, established: 1, returning: 2, new: 3 }
      const tierDiff = (tierOrder[a.tier] ?? 3) - (tierOrder[b.tier] ?? 3)
      if (tierDiff !== 0) return tierDiff
      return b.onTimeRate - a.onTimeRate
    })
    .slice(0, 10)

  return { suggestions }
})
