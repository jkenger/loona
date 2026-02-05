import { createServerFn } from "@tanstack/react-start"
import { db, user, session, contacts, loans, auditLogs } from "@/lib/db"
import { eq, sql, ilike, or, and, gte, gt, desc, count } from "drizzle-orm"
import { requireAdmin } from "./session"
import { logAudit } from "./audit"
import { z } from "zod"
import { ROLES } from "@/lib/constants/roles"

// Compliance thresholds (Philippine regulations)
const SEC_MONTHLY_RATE_CAP = 6 // SEC MC 19-2019: 6% monthly nominal cap
const COURT_CONCERN_THRESHOLD = 3 // Courts often scrutinize rates above 3% monthly

// ============================================================================
// Admin Portal Service
// All functions for the admin portal (system-wide administration)
// ============================================================================

const KNOWN_ROLES = [ROLES.LENDER, ROLES.AGENT, ROLES.ADMIN]

// ============================================================================
// Admin Stats
// ============================================================================

export const getAdminStats = createServerFn().handler(async () => {
  await requireAdmin()

  const now = new Date()
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // User counts
  const [userStats] = await db
    .select({
      total: count(),
      lenders: sql<number>`count(*) filter (where ${user.role} ilike '%lender%')::int`,
      agents: sql<number>`count(*) filter (where ${user.role} ilike '%agent%')::int`,
      admins: sql<number>`count(*) filter (where ${user.role} ilike '%admin%')::int`,
      banned: sql<number>`count(*) filter (where ${user.banned} = true)::int`,
      newThisWeek: sql<number>`count(*) filter (where ${user.createdAt} >= ${oneWeekAgo})::int`,
      newThisMonth: sql<number>`count(*) filter (where ${user.createdAt} >= ${oneMonthAgo})::int`,
    })
    .from(user)

  // Loan stats
  const [loanStats] = await db
    .select({
      total: count(),
      active: sql<number>`count(*) filter (where ${loans.status} = 'active')::int`,
      disbursed: sql<string>`coalesce(sum(${loans.principal}), 0)`,
      collected: sql<string>`coalesce(sum(${loans.amountPaid}), 0)`,
      outstanding: sql<string>`coalesce(sum(${loans.remainingBalance}), 0)`,
    })
    .from(loans)

  // Contact count
  const [contactStats] = await db.select({ total: count() }).from(contacts)

  // Audit event counts
  const [auditStats] = await db
    .select({
      last24h: sql<number>`count(*) filter (where ${auditLogs.createdAt} >= ${oneDayAgo})::int`,
      last7d: sql<number>`count(*) filter (where ${auditLogs.createdAt} >= ${oneWeekAgo})::int`,
    })
    .from(auditLogs)

  return {
    users: {
      total: userStats.total,
      lenders: userStats.lenders,
      agents: userStats.agents,
      admins: userStats.admins,
      banned: userStats.banned,
      newThisWeek: userStats.newThisWeek,
      newThisMonth: userStats.newThisMonth,
    },
    loans: {
      total: loanStats.total,
      active: loanStats.active,
      disbursed: loanStats.disbursed,
      collected: loanStats.collected,
      outstanding: loanStats.outstanding,
    },
    contacts: { total: contactStats.total },
    audit: {
      last24h: auditStats.last24h,
      last7d: auditStats.last7d,
    },
  }
})

// ============================================================================
// User Management
// ============================================================================

export const listUsers = createServerFn()
  .inputValidator(
    z.object({
      search: z.string().optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      roleFilter: z.string().optional(),
    })
  )
  .handler(async ({ data }) => {
    await requireAdmin()

    const conditions = []

    if (data.search) {
      conditions.push(
        or(
          ilike(user.name, `%${data.search}%`),
          ilike(user.email, `%${data.search}%`)
        )
      )
    }

    if (data.roleFilter) {
      conditions.push(ilike(user.role, `%${data.roleFilter}%`))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [users, [{ total }]] = await Promise.all([
      db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          banned: user.banned,
          banReason: user.banReason,
          createdAt: user.createdAt,
        })
        .from(user)
        .where(where)
        .orderBy(desc(user.createdAt))
        .limit(data.limit)
        .offset(data.offset),
      db.select({ total: count() }).from(user).where(where),
    ])

    return {
      users: users.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
      })),
      total,
      limit: data.limit,
      offset: data.offset,
    }
  })

// ============================================================================
// Ban / Unban
// ============================================================================

export const adminBanUser = createServerFn()
  .inputValidator(
    z.object({
      userId: z.string(),
      banReason: z.string().optional(),
    })
  )
  .handler(async ({ data }) => {
    const adminSession = await requireAdmin()

    if (data.userId === adminSession.user.id) {
      throw new Error("Cannot ban yourself")
    }

    // Ban the user
    await db
      .update(user)
      .set({
        banned: true,
        banReason: data.banReason || null,
      })
      .where(eq(user.id, data.userId))

    // Delete all their sessions for immediate effect
    await db.delete(session).where(eq(session.userId, data.userId))

    // Audit log
    await logAudit({
      userId: adminSession.user.id,
      userEmail: adminSession.user.email,
      action: "admin.ban_user",
      entityType: "user",
      entityId: data.userId,
      metadata: { banReason: data.banReason },
    })

    return { success: true }
  })

export const adminUnbanUser = createServerFn()
  .inputValidator(
    z.object({
      userId: z.string(),
    })
  )
  .handler(async ({ data }) => {
    const adminSession = await requireAdmin()

    await db
      .update(user)
      .set({
        banned: false,
        banReason: null,
        banExpires: null,
      })
      .where(eq(user.id, data.userId))

    await logAudit({
      userId: adminSession.user.id,
      userEmail: adminSession.user.email,
      action: "admin.unban_user",
      entityType: "user",
      entityId: data.userId,
    })

    return { success: true }
  })

// ============================================================================
// Set Role
// ============================================================================

export const adminSetRole = createServerFn()
  .inputValidator(
    z.object({
      userId: z.string(),
      role: z.string(),
    })
  )
  .handler(async ({ data }) => {
    const adminSession = await requireAdmin()

    // Validate all role segments
    const roleSegments = data.role.split(",").map((r) => r.trim())
    for (const segment of roleSegments) {
      if (!KNOWN_ROLES.includes(segment as any)) {
        throw new Error(`Unknown role: ${segment}`)
      }
    }

    // Prevent removing own admin role
    if (data.userId === adminSession.user.id && !roleSegments.includes(ROLES.ADMIN)) {
      throw new Error("Cannot remove your own admin role")
    }

    await db
      .update(user)
      .set({ role: data.role })
      .where(eq(user.id, data.userId))

    await logAudit({
      userId: adminSession.user.id,
      userEmail: adminSession.user.email,
      action: "admin.set_role",
      entityType: "user",
      entityId: data.userId,
      metadata: { newRole: data.role },
    })

    return { success: true }
  })

// ============================================================================
// Audit Logs
// ============================================================================

export const getAuditLogs = createServerFn()
  .inputValidator(
    z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      action: z.string().optional(),
      entityType: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    })
  )
  .handler(async ({ data }) => {
    await requireAdmin()

    const conditions = []

    if (data.action) {
      conditions.push(ilike(auditLogs.action, `%${data.action}%`))
    }

    if (data.entityType) {
      conditions.push(eq(auditLogs.entityType, data.entityType))
    }

    if (data.from) {
      conditions.push(gte(auditLogs.createdAt, new Date(data.from)))
    }

    if (data.to) {
      const toDate = new Date(data.to)
      toDate.setDate(toDate.getDate() + 1) // Include the full day
      conditions.push(sql`${auditLogs.createdAt} < ${toDate}`)
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [logs, [{ total }]] = await Promise.all([
      db
        .select({
          id: auditLogs.id,
          userId: auditLogs.userId,
          userEmail: auditLogs.userEmail,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          metadata: auditLogs.metadata,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .where(where)
        .orderBy(desc(auditLogs.createdAt))
        .limit(data.limit)
        .offset(data.offset),
      db.select({ total: count() }).from(auditLogs).where(where),
    ])

    return {
      logs: logs.map((log) => ({
        ...log,
        createdAt: log.createdAt.toISOString(),
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
      })),
      total,
      limit: data.limit,
      offset: data.offset,
    }
  })

// ============================================================================
// Compliance Dashboard
// ============================================================================

export const getComplianceStats = createServerFn().handler(async () => {
  await requireAdmin()

  // Interest rate compliance stats
  const [interestRateStats] = await db
    .select({
      totalLoans: count(),
      loansAboveSECCap: sql<number>`count(*) filter (where ${loans.interestRate} > ${SEC_MONTHLY_RATE_CAP})::int`,
      loansAboveCourtConcern: sql<number>`count(*) filter (where ${loans.interestRate} > ${COURT_CONCERN_THRESHOLD} and ${loans.interestRate} <= ${SEC_MONTHLY_RATE_CAP})::int`,
      loansCompliant: sql<number>`count(*) filter (where ${loans.interestRate} <= ${COURT_CONCERN_THRESHOLD})::int`,
      avgInterestRate: sql<string>`coalesce(avg(${loans.interestRate}), 0)`,
      maxInterestRate: sql<string>`coalesce(max(${loans.interestRate}), 0)`,
      minInterestRate: sql<string>`coalesce(min(${loans.interestRate}), 0)`,
    })
    .from(loans)

  // Active loans breakdown
  const [activeLoansStats] = await db
    .select({
      totalActive: sql<number>`count(*) filter (where ${loans.status} = 'active')::int`,
      activeAboveSECCap: sql<number>`count(*) filter (where ${loans.status} = 'active' and ${loans.interestRate} > ${SEC_MONTHLY_RATE_CAP})::int`,
      activeAboveCourtConcern: sql<number>`count(*) filter (where ${loans.status} = 'active' and ${loans.interestRate} > ${COURT_CONCERN_THRESHOLD} and ${loans.interestRate} <= ${SEC_MONTHLY_RATE_CAP})::int`,
    })
    .from(loans)

  // Privacy compliance - users with potential data concerns
  const [privacyStats] = await db
    .select({
      totalContacts: count(),
      contactsWithEmail: sql<number>`count(*) filter (where ${contacts.email} is not null and ${contacts.email} != '')::int`,
      contactsWithPhone: sql<number>`count(*) filter (where ${contacts.phone} is not null and ${contacts.phone} != '')::int`,
      contactsWithAddress: sql<number>`count(*) filter (where ${contacts.address} is not null and ${contacts.address} != '')::int`,
    })
    .from(contacts)

  // Audit stats for app compliance
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [auditStats] = await db
    .select({
      last7d: sql<number>`count(*) filter (where ${auditLogs.createdAt} >= ${oneWeekAgo})::int`,
    })
    .from(auditLogs)

  // Recent high-rate loans (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const recentHighRateLoans = await db
    .select({
      id: loans.id,
      principal: loans.principal,
      interestRate: loans.interestRate,
      status: loans.status,
      createdAt: loans.createdAt,
      contactName: contacts.name,
      lenderEmail: user.email,
    })
    .from(loans)
    .leftJoin(contacts, eq(loans.contactId, contacts.id))
    .leftJoin(user, eq(loans.lenderId, user.id))
    .where(
      and(
        gt(loans.interestRate, sql`${SEC_MONTHLY_RATE_CAP}`),
        gte(loans.createdAt, thirtyDaysAgo)
      )
    )
    .orderBy(desc(loans.createdAt))
    .limit(10)

  // Interest rate distribution - fetch and compute in JS for reliability
  const allLoansForDistribution = await db
    .select({
      interestRate: loans.interestRate,
      principal: loans.principal,
    })
    .from(loans)

  // Compute distribution buckets
  const distributionMap: Record<string, { count: number; totalPrincipal: number; order: number }> = {
    "0-3%": { count: 0, totalPrincipal: 0, order: 1 },
    "3-6%": { count: 0, totalPrincipal: 0, order: 2 },
    "6-10%": { count: 0, totalPrincipal: 0, order: 3 },
    "10%+": { count: 0, totalPrincipal: 0, order: 4 },
  }

  for (const loan of allLoansForDistribution) {
    const rate = parseFloat(loan.interestRate)
    const principal = parseFloat(loan.principal)
    let bucket: string
    if (rate <= 3) bucket = "0-3%"
    else if (rate <= 6) bucket = "3-6%"
    else if (rate <= 10) bucket = "6-10%"
    else bucket = "10%+"

    distributionMap[bucket].count++
    distributionMap[bucket].totalPrincipal += principal
  }

  const rateDistribution = Object.entries(distributionMap)
    .map(([bucket, data]) => ({
      bucket,
      count: data.count,
      totalPrincipal: data.totalPrincipal.toString(),
      order: data.order,
    }))
    .sort((a, b) => a.order - b.order)

  return {
    interestRates: {
      totalLoans: interestRateStats.totalLoans,
      aboveSECCap: interestRateStats.loansAboveSECCap,
      aboveCourtConcern: interestRateStats.loansAboveCourtConcern,
      compliant: interestRateStats.loansCompliant,
      average: parseFloat(interestRateStats.avgInterestRate).toFixed(2),
      max: parseFloat(interestRateStats.maxInterestRate).toFixed(2),
      min: parseFloat(interestRateStats.minInterestRate).toFixed(2),
    },
    activeLoans: {
      total: activeLoansStats.totalActive,
      aboveSECCap: activeLoansStats.activeAboveSECCap,
      aboveCourtConcern: activeLoansStats.activeAboveCourtConcern,
    },
    privacy: {
      totalContacts: privacyStats.totalContacts,
      withEmail: privacyStats.contactsWithEmail,
      withPhone: privacyStats.contactsWithPhone,
      withAddress: privacyStats.contactsWithAddress,
    },
    recentHighRateLoans: recentHighRateLoans.map((loan) => ({
      id: loan.id,
      principal: loan.principal,
      interestRate: loan.interestRate,
      status: loan.status,
      createdAt: loan.createdAt.toISOString(),
      contactName: loan.contactName,
      lenderEmail: loan.lenderEmail,
    })),
    rateDistribution: rateDistribution.map((r) => ({
      bucket: r.bucket,
      count: r.count,
      totalPrincipal: r.totalPrincipal,
    })),
    thresholds: {
      secMonthlyCap: SEC_MONTHLY_RATE_CAP,
      courtConcern: COURT_CONCERN_THRESHOLD,
    },
    // App compliance checks
    appCompliance: {
      privacyPolicy: {
        status: "configured" as const,
        label: "Privacy Policy",
        description: "RA 10173 compliant privacy policy",
        path: "/privacy",
      },
      termsOfService: {
        status: "configured" as const,
        label: "Terms of Service",
        description: "User agreement and disclaimers",
        path: "/terms",
      },
      npcRegistration: {
        status: "manual" as const,
        label: "NPC Registration",
        description: "National Privacy Commission registration",
        href: "https://www.privacy.gov.ph/data-protection-registration/",
      },
      auditLogging: {
        status: auditStats.last7d > 0 ? "configured" as const : "attention" as const,
        label: "Audit Logging",
        description: "Activity tracking for accountability",
        detail: `${auditStats.last7d} events logged in last 7 days`,
      },
      passwordSecurity: {
        status: "configured" as const,
        label: "Password Security",
        description: "Passwords hashed with secure algorithm",
      },
      sessionManagement: {
        status: "configured" as const,
        label: "Session Management",
        description: "Secure session handling with expiry",
      },
      dataEncryption: {
        status: "configured" as const,
        label: "Database Encryption",
        description: "Data encrypted in transit (SSL/TLS)",
      },
      contactEmail: {
        status: "configured" as const,
        label: "Contact Information",
        description: "Support email configured",
        detail: "support@loona.app",
      },
    },
  }
})
