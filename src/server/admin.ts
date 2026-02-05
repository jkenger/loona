import { createServerFn } from "@tanstack/react-start"
import { db, user, session, contacts, loans, auditLogs } from "@/lib/db"
import { eq, sql, ilike, or, and, gte, desc, count } from "drizzle-orm"
import { requireAdmin } from "./session"
import { logAudit } from "./audit"
import { z } from "zod"
import { ROLES } from "@/lib/constants/roles"

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
