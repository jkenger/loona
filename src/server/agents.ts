import { createServerFn } from "@tanstack/react-start"
import {
  db,
  agents,
  user,
  commissions,
  payments,
  loans,
  contacts,
} from "@/lib/db"
import { eq, desc, and, sql } from "drizzle-orm"
import { requireAuth } from "./session"
import { createAuditLogger } from "./audit"
import { z } from "zod"
import { ROLES } from "@/lib/constants/roles"

// Validation schemas
const createAgentSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  commissionRate: z.number().min(0).max(100).default(5),
})

// Generate a random password
function generatePassword(length = 12): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let password = ""
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

const updateAgentSchema = z.object({
  id: z.string(),
  commissionRate: z.number().min(0).max(100).optional(),
  status: z.enum(["active", "suspended", "terminated"]).optional(),
})

// Lender functions
export const getAgents = createServerFn().handler(async () => {
  const session = await requireAuth()

  const result = await db
    .select({
      id: agents.id,
      commissionRate: agents.commissionRate,
      status: agents.status,
      totalCollected: agents.totalCollected,
      totalCommissionEarned: agents.totalCommissionEarned,
      totalCommissionPaid: agents.totalCommissionPaid,
      createdAt: agents.createdAt,
      agentName: user.name,
      agentEmail: user.email,
    })
    .from(agents)
    .innerJoin(user, eq(agents.agentUserId, user.id))
    .where(eq(agents.lenderId, session.user.id))
    .orderBy(desc(agents.createdAt))

  // Get assigned loan counts for each agent
  const agentIds = result.map((a) => a.id)
  const loanCounts = agentIds.length > 0
    ? await db
        .select({
          agentId: loans.assignedAgentId,
          count: sql<number>`count(*)::int`,
        })
        .from(loans)
        .where(sql`${loans.assignedAgentId} IN ${agentIds}`)
        .groupBy(loans.assignedAgentId)
    : []

  const countMap = new Map(loanCounts.map((c) => [c.agentId, c.count]))

  return result.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
    pendingCommission: (
      parseFloat(a.totalCommissionEarned) - parseFloat(a.totalCommissionPaid)
    ).toFixed(2),
    assignedLoansCount: countMap.get(a.id) || 0,
  }))
})

export const createAgent = createServerFn<{
  data: z.infer<typeof createAgentSchema>
}>().handler(async (ctx) => {
  const session = await requireAuth()
  const data = createAgentSchema.parse(ctx.data)
  const emailLower = data.email.toLowerCase()

  // Check if this is the lender's own email
  if (emailLower === session.user.email.toLowerCase()) {
    throw new Error("You cannot add yourself as an agent")
  }

  // Find or create user by email
  let agentUser = await db.query.user.findFirst({
    where: eq(user.email, emailLower),
  })

  let generatedPassword: string | null = null

  if (!agentUser) {
    // Create new user with auto-generated password
    generatedPassword = generatePassword()
    const userId = crypto.randomUUID()

    // Hash password using Better Auth's method (we'll use a simple approach)
    // Better Auth expects the password in the account table
    const [newUser] = await db
      .insert(user)
      .values({
        id: userId,
        email: emailLower,
        name: data.name,
        role: ROLES.AGENT,
        emailVerified: true, // Skip verification for agent accounts
      })
      .returning()

    // Create account with password using Better Auth's internal hashing
    const { account } = await import("@/lib/db/schema")
    const { hashPassword } = await import("better-auth/crypto")
    const hashedPassword = await hashPassword(generatedPassword)

    await db.insert(account).values({
      id: crypto.randomUUID(),
      userId: userId,
      accountId: userId,
      providerId: "credential",
      password: hashedPassword,
    })

    agentUser = newUser
  } else {
    // Check if already an agent for this lender
    const existing = await db.query.agents.findFirst({
      where: and(
        eq(agents.agentUserId, agentUser.id),
        eq(agents.lenderId, session.user.id)
      ),
    })

    if (existing) {
      throw new Error("This user is already your agent")
    }

    // Update user role to include agent if not already
    if (!agentUser.role?.includes(ROLES.AGENT)) {
      const newRole = agentUser.role
        ? `${agentUser.role},${ROLES.AGENT}`
        : ROLES.AGENT
      await db.update(user).set({ role: newRole }).where(eq(user.id, agentUser.id))
    }
  }

  // Create agent relationship
  const [agent] = await db
    .insert(agents)
    .values({
      agentUserId: agentUser.id,
      lenderId: session.user.id,
      commissionRate: data.commissionRate.toFixed(2),
    })
    .returning()

  const log = createAuditLogger(session.user)
  log("agent.create", "agent", agent.id, {
    agentEmail: emailLower,
    agentName: agentUser.name,
    commissionRate: data.commissionRate,
    isNewUser: generatedPassword !== null,
  })

  return {
    ...agent,
    createdAt: agent.createdAt.toISOString(),
    generatedPassword, // Will be null if user already existed
    agentEmail: emailLower,
    agentName: agentUser.name,
    isNewUser: generatedPassword !== null,
  }
})

export const updateAgent = createServerFn<{
  data: z.infer<typeof updateAgentSchema>
}>().handler(async (ctx) => {
  const session = await requireAuth()
  const data = updateAgentSchema.parse(ctx.data)
  const { id, ...updates } = data

  // Verify ownership
  const existing = await db.query.agents.findFirst({
    where: eq(agents.id, id),
    with: { agentUser: true },
  })

  if (!existing || existing.lenderId !== session.user.id) {
    throw new Error("Agent not found")
  }

  const updateData: Record<string, unknown> = {}
  if (updates.commissionRate !== undefined) {
    updateData.commissionRate = updates.commissionRate.toFixed(2)
  }
  if (updates.status !== undefined) {
    updateData.status = updates.status
  }

  const [updated] = await db
    .update(agents)
    .set(updateData)
    .where(eq(agents.id, id))
    .returning()

  // Determine appropriate audit action based on status change
  const log = createAuditLogger(session.user)
  if (updates.status === "suspended") {
    log("agent.suspend", "agent", id, {
      agentEmail: existing.agentUser.email,
      previousStatus: existing.status,
    })
  } else if (updates.status === "terminated") {
    log("agent.terminate", "agent", id, {
      agentEmail: existing.agentUser.email,
      previousStatus: existing.status,
    })
  } else if (updates.status === "active" && existing.status !== "active") {
    log("agent.activate", "agent", id, {
      agentEmail: existing.agentUser.email,
      previousStatus: existing.status,
    })
  } else {
    log("agent.update", "agent", id, {
      agentEmail: existing.agentUser.email,
      changes: Object.keys(updates),
    })
  }

  return {
    ...updated,
    createdAt: updated.createdAt.toISOString(),
  }
})

export const payCommission = createServerFn<{ data: string }>().handler(
  async (ctx) => {
    const session = await requireAuth()
    const agentId = ctx.data

    // Verify ownership
    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
      with: { agentUser: true },
    })

    if (!agent || agent.lenderId !== session.user.id) {
      throw new Error("Agent not found")
    }

    const pendingAmount =
      parseFloat(agent.totalCommissionEarned) -
      parseFloat(agent.totalCommissionPaid)

    if (pendingAmount <= 0) {
      throw new Error("No pending commission to pay")
    }

    // Mark all pending commissions as paid
    await db
      .update(commissions)
      .set({
        status: "paid",
        paidAt: new Date(),
        paidBy: session.user.id,
      })
      .where(
        and(eq(commissions.agentId, agentId), eq(commissions.status, "pending"))
      )

    // Update agent totals
    await db
      .update(agents)
      .set({
        totalCommissionPaid: agent.totalCommissionEarned,
      })
      .where(eq(agents.id, agentId))

    // Audit log
    const log = createAuditLogger(session.user)
    log("commission.pay", "commission", agentId, {
      agentEmail: agent.agentUser.email,
      amountPaid: pendingAmount,
    })

    return { success: true, amountPaid: pendingAmount }
  }
)

// Agent portal functions
export const getAgentDashboard = createServerFn().handler(async () => {
  const session = await requireAuth()

  // Get agent relationships
  const agentRelationships = await db.query.agents.findMany({
    where: and(
      eq(agents.agentUserId, session.user.id),
      eq(agents.status, "active")
    ),
    with: {
      lender: true,
    },
  })

  if (agentRelationships.length === 0) {
    return {
      relationships: [],
      totalCollected: "0",
      totalCommissionEarned: "0",
      pendingCommission: "0",
      recentPayments: [],
    }
  }

  // Aggregate stats
  const totalCollected = agentRelationships.reduce(
    (sum, r) => sum + parseFloat(r.totalCollected),
    0
  )
  const totalCommissionEarned = agentRelationships.reduce(
    (sum, r) => sum + parseFloat(r.totalCommissionEarned),
    0
  )
  const totalCommissionPaid = agentRelationships.reduce(
    (sum, r) => sum + parseFloat(r.totalCommissionPaid),
    0
  )

  // Get recent payments recorded by this agent
  const agentIds = agentRelationships.map((r) => r.id)
  const recentPayments = await db
    .select({
      id: payments.id,
      amount: payments.amount,
      method: payments.method,
      paidAt: payments.paidAt,
      contactName: contacts.name,
      loanPrincipal: loans.principal,
    })
    .from(payments)
    .innerJoin(loans, eq(payments.loanId, loans.id))
    .innerJoin(contacts, eq(loans.contactId, contacts.id))
    .where(sql`${payments.recordedByAgentId} IN ${agentIds}`)
    .orderBy(desc(payments.paidAt))
    .limit(10)

  return {
    relationships: agentRelationships.map((r) => ({
      id: r.id,
      lenderName: r.lender.name,
      lenderEmail: r.lender.email,
      commissionRate: r.commissionRate,
      totalCollected: r.totalCollected,
      totalCommissionEarned: r.totalCommissionEarned,
      pendingCommission: (
        parseFloat(r.totalCommissionEarned) - parseFloat(r.totalCommissionPaid)
      ).toFixed(2),
    })),
    totalCollected: totalCollected.toFixed(2),
    totalCommissionEarned: totalCommissionEarned.toFixed(2),
    pendingCommission: (totalCommissionEarned - totalCommissionPaid).toFixed(2),
    recentPayments: recentPayments.map((p) => ({
      ...p,
      paidAt: p.paidAt.toISOString(),
    })),
  }
})

export const getAgentLoans = createServerFn().handler(async () => {
  const session = await requireAuth()

  // Get all agent relationships
  const agentRelationships = await db.query.agents.findMany({
    where: and(
      eq(agents.agentUserId, session.user.id),
      eq(agents.status, "active")
    ),
  })

  if (agentRelationships.length === 0) {
    return []
  }

  const agentIds = agentRelationships.map((r) => r.id)

  // Get only loans assigned to this agent
  const result = await db
    .select({
      id: loans.id,
      principal: loans.principal,
      interestRate: loans.interestRate,
      termMonths: loans.termMonths,
      paymentFrequency: loans.paymentFrequency,
      amountPaid: loans.amountPaid,
      remainingBalance: loans.remainingBalance,
      status: loans.status,
      createdAt: loans.createdAt,
      contactName: contacts.name,
      contactPhone: contacts.phone,
      lenderName: user.name,
    })
    .from(loans)
    .innerJoin(contacts, eq(loans.contactId, contacts.id))
    .innerJoin(user, eq(loans.lenderId, user.id))
    .where(sql`${loans.assignedAgentId} IN ${agentIds}`)
    .orderBy(desc(loans.createdAt))

  return result.map((l) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
  }))
})

// Loan assignment functions (for lenders)
const assignLoanSchema = z.object({
  loanId: z.string(),
  agentId: z.string().nullable(),
})

export const assignLoanToAgent = createServerFn<{
  data: z.infer<typeof assignLoanSchema>
}>().handler(async (ctx) => {
  const session = await requireAuth()
  const { loanId, agentId } = assignLoanSchema.parse(ctx.data)

  // Verify loan ownership
  const loan = await db.query.loans.findFirst({
    where: eq(loans.id, loanId),
    with: { contact: true },
  })

  if (!loan || loan.lenderId !== session.user.id) {
    throw new Error("Loan not found")
  }

  let agentEmail: string | null = null

  // If assigning (not unassigning), verify agent belongs to this lender
  if (agentId) {
    const agent = await db.query.agents.findFirst({
      where: and(
        eq(agents.id, agentId),
        eq(agents.lenderId, session.user.id),
        eq(agents.status, "active")
      ),
      with: { agentUser: true },
    })

    if (!agent) {
      throw new Error("Agent not found or not active")
    }
    agentEmail = agent.agentUser.email
  }

  // Update loan assignment
  const [updated] = await db
    .update(loans)
    .set({ assignedAgentId: agentId })
    .where(eq(loans.id, loanId))
    .returning()

  // Audit log
  const log = createAuditLogger(session.user)
  log("loan.assign_agent", "loan", loanId, {
    agentId: agentId || null,
    agentEmail: agentEmail,
    contactName: loan.contact.name,
    principal: loan.principal,
    previousAgentId: loan.assignedAgentId || null,
  })

  return {
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    startDate: updated.startDate?.toISOString() || null,
    maturityDate: updated.maturityDate?.toISOString() || null,
    completedAt: updated.completedAt?.toISOString() || null,
  }
})

// Get loans with assignment info for lenders
export const getLoansWithAssignments = createServerFn().handler(async () => {
  const session = await requireAuth()

  const result = await db
    .select({
      id: loans.id,
      principal: loans.principal,
      status: loans.status,
      contactName: contacts.name,
      assignedAgentId: loans.assignedAgentId,
      assignedAgentName: user.name,
    })
    .from(loans)
    .innerJoin(contacts, eq(loans.contactId, contacts.id))
    .leftJoin(agents, eq(loans.assignedAgentId, agents.id))
    .leftJoin(user, eq(agents.agentUserId, user.id))
    .where(eq(loans.lenderId, session.user.id))
    .orderBy(desc(loans.createdAt))

  return result
})

// ============================================================================
// Agent Portal Functions
// ============================================================================

import { paymentSchedule } from "@/lib/db"
import { ne, lte } from "drizzle-orm"

// Get contacts with assigned loans for agent
export const getAgentContacts = createServerFn().handler(async () => {
  const session = await requireAuth()

  // Get agent's relationships
  const agentRelationships = await db.query.agents.findMany({
    where: and(
      eq(agents.agentUserId, session.user.id),
      eq(agents.status, "active")
    ),
  })

  if (agentRelationships.length === 0) {
    return []
  }

  const agentIds = agentRelationships.map((r) => r.id)

  // Get unique contacts from assigned loans
  const result = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      phone: contacts.phone,
      email: contacts.email,
      city: contacts.city,
      loanCount: sql<number>`count(${loans.id})::int`,
      activeLoans: sql<number>`count(${loans.id}) filter (where ${loans.status} = 'active')::int`,
      totalPrincipal: sql<string>`coalesce(sum(${loans.principal}), 0)`,
      totalRemaining: sql<string>`coalesce(sum(${loans.remainingBalance}), 0)`,
    })
    .from(contacts)
    .innerJoin(loans, eq(contacts.id, loans.contactId))
    .where(sql`${loans.assignedAgentId} IN ${agentIds}`)
    .groupBy(contacts.id)
    .orderBy(contacts.name)

  return result
})

// Get payments for agent's assigned loans
export const getAgentPayments = createServerFn().handler(async () => {
  const session = await requireAuth()

  // Get agent's relationships
  const agentRelationships = await db.query.agents.findMany({
    where: and(
      eq(agents.agentUserId, session.user.id),
      eq(agents.status, "active")
    ),
  })

  if (agentRelationships.length === 0) {
    return []
  }

  const agentIds = agentRelationships.map((r) => r.id)

  const result = await db
    .select({
      id: payments.id,
      amount: payments.amount,
      method: payments.method,
      paidAt: payments.paidAt,
      notes: payments.notes,
      loanId: loans.id,
      contactName: contacts.name,
      principal: loans.principal,
      recordedByMe: sql<boolean>`${payments.recordedByAgentId} IN ${agentIds}`,
    })
    .from(payments)
    .innerJoin(loans, eq(payments.loanId, loans.id))
    .innerJoin(contacts, eq(loans.contactId, contacts.id))
    .where(sql`${loans.assignedAgentId} IN ${agentIds}`)
    .orderBy(desc(payments.paidAt))
    .limit(100)

  return result.map((p) => ({
    ...p,
    paidAt: p.paidAt.toISOString(),
  }))
})

// Get upcoming payments for agent's assigned loans
export const getAgentUpcomingPayments = createServerFn().handler(async () => {
  const session = await requireAuth()
  const now = new Date()
  const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  // Get agent's relationships
  const agentRelationships = await db.query.agents.findMany({
    where: and(
      eq(agents.agentUserId, session.user.id),
      eq(agents.status, "active")
    ),
  })

  if (agentRelationships.length === 0) {
    return []
  }

  const agentIds = agentRelationships.map((r) => r.id)

  const result = await db
    .select({
      id: paymentSchedule.id,
      dueDate: paymentSchedule.dueDate,
      amount: paymentSchedule.amount,
      status: paymentSchedule.status,
      paidAmount: paymentSchedule.paidAmount,
      loanId: loans.id,
      contactName: contacts.name,
      contactId: contacts.id,
      contactPhone: contacts.phone,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .innerJoin(contacts, eq(loans.contactId, contacts.id))
    .where(
      and(
        sql`${loans.assignedAgentId} IN ${agentIds}`,
        ne(paymentSchedule.status, "paid"),
        lte(paymentSchedule.dueDate, next30Days)
      )
    )
    .orderBy(paymentSchedule.dueDate)

  return result.map((p) => ({
    ...p,
    dueDate: p.dueDate.toISOString(),
  }))
})

// Get contact detail for agent (only shows assigned loans)
export const getAgentContact = createServerFn<{ data: string }>().handler(
  async (ctx) => {
    const session = await requireAuth()
    const contactId = ctx.data

    // Get agent's relationships
    const agentRelationships = await db.query.agents.findMany({
      where: and(
        eq(agents.agentUserId, session.user.id),
        eq(agents.status, "active")
      ),
    })

    if (agentRelationships.length === 0) {
      throw new Error("Contact not found")
    }

    const agentIds = agentRelationships.map((r) => r.id)

    // Get contact with only assigned loans
    const contact = await db.query.contacts.findFirst({
      where: eq(contacts.id, contactId),
    })

    if (!contact) {
      throw new Error("Contact not found")
    }

    // Get only loans assigned to this agent
    const assignedLoans = await db
      .select({
        id: loans.id,
        principal: loans.principal,
        interestRate: loans.interestRate,
        termMonths: loans.termMonths,
        paymentFrequency: loans.paymentFrequency,
        amountPaid: loans.amountPaid,
        remainingBalance: loans.remainingBalance,
        status: loans.status,
        startDate: loans.startDate,
        maturityDate: loans.maturityDate,
        createdAt: loans.createdAt,
      })
      .from(loans)
      .where(
        and(
          eq(loans.contactId, contactId),
          sql`${loans.assignedAgentId} IN ${agentIds}`
        )
      )
      .orderBy(desc(loans.createdAt))

    if (assignedLoans.length === 0) {
      throw new Error("Contact not found")
    }

    return {
      ...contact,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
      loans: assignedLoans.map((l) => ({
        ...l,
        startDate: l.startDate?.toISOString() ?? null,
        maturityDate: l.maturityDate?.toISOString() ?? null,
        createdAt: l.createdAt.toISOString(),
      })),
    }
  }
)
