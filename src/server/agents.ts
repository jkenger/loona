import { createServerFn } from '@tanstack/react-start'
import {
  db,
  agents,
  user,
  commissions,
  loans,
  contacts,
} from '@/lib/db'
import { eq, desc, and, sql } from 'drizzle-orm'
import { requireAuth } from './session'
import { createAuditLogger } from './audit'
import { z } from 'zod'
import { ROLES } from '@/lib/constants/roles'
import { sendEmail, agentInviteEmail } from '@/lib/email'

// ============================================================================
// Agent Management Service (Lender-facing)
// Functions for lenders to manage their agents
// ============================================================================

// Validation schemas
const createAgentSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  commissionRate: z.number().min(0).max(100).default(5),
})

// Generate a random password
function generatePassword(length = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

const updateAgentSchema = z.object({
  id: z.string(),
  commissionRate: z.number().min(0).max(100).optional(),
  status: z.enum(['active', 'suspended', 'terminated']).optional(),
  canCreateLoans: z.boolean().optional(),
})

// Get all agents for current lender
export const getAgents = createServerFn().handler(async () => {
  const session = await requireAuth()

  const result = await db
    .select({
      id: agents.id,
      commissionRate: agents.commissionRate,
      status: agents.status,
      canCreateLoans: agents.canCreateLoans,
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
  const loanCounts =
    agentIds.length > 0
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

// Create a new agent
export const createAgent = createServerFn()
  .inputValidator(createAgentSchema)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const emailLower = data.email.toLowerCase()

    // Check if this is the lender's own email
    if (emailLower === session.user.email.toLowerCase()) {
      throw new Error('You cannot add yourself as an agent')
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

      // Hash password using Better Auth's method
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
      const { account } = await import('@/lib/db/schema')
      const { hashPassword } = await import('better-auth/crypto')
      const hashedPassword = await hashPassword(generatedPassword)

      await db.insert(account).values({
        id: crypto.randomUUID(),
        userId: userId,
        accountId: userId,
        providerId: 'credential',
        password: hashedPassword,
      })

      agentUser = newUser
    } else {
      // Check if already an agent for this lender
      const existing = await db.query.agents.findFirst({
        where: and(
          eq(agents.agentUserId, agentUser.id),
          eq(agents.lenderId, session.user.id),
        ),
      })

      if (existing) {
        throw new Error('This user is already your agent')
      }

      // Update user role to include agent if not already
      if (!agentUser.role?.includes(ROLES.AGENT)) {
        const newRole = agentUser.role
          ? `${agentUser.role},${ROLES.AGENT}`
          : ROLES.AGENT
        await db
          .update(user)
          .set({ role: newRole })
          .where(eq(user.id, agentUser.id))
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
    log('agent.create', 'agent', agent.id, {
      agentEmail: emailLower,
      agentName: agentUser.name,
      commissionRate: data.commissionRate,
      isNewUser: generatedPassword !== null,
    })

    // Send invitation email if new user was created
    if (generatedPassword) {
      const email = agentInviteEmail({
        agentName: data.name,
        lenderName: session.user.name || 'A lender',
        email: emailLower,
        password: generatedPassword,
      })
      sendEmail({
        to: emailLower,
        ...email,
      }).catch((err) => {
        console.error('[Agent] Failed to send invite email:', err)
      })
    }

    return {
      ...agent,
      createdAt: agent.createdAt.toISOString(),
      generatedPassword, // Will be null if user already existed
      agentEmail: emailLower,
      agentName: agentUser.name,
      isNewUser: generatedPassword !== null,
    }
  })

// Update agent settings
export const updateAgent = createServerFn()
  .inputValidator(updateAgentSchema)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const { id, ...updates } = data

    // Verify ownership
    const existing = await db.query.agents.findFirst({
      where: eq(agents.id, id),
      with: { agentUser: true },
    })

    if (!existing || existing.lenderId !== session.user.id) {
      throw new Error('Agent not found')
    }

    const updateData: Record<string, unknown> = {}
    if (updates.commissionRate !== undefined) {
      updateData.commissionRate = updates.commissionRate.toFixed(2)
    }
    if (updates.status !== undefined) {
      updateData.status = updates.status
    }
    if (updates.canCreateLoans !== undefined) {
      updateData.canCreateLoans = updates.canCreateLoans
    }

    const [updated] = await db
      .update(agents)
      .set(updateData)
      .where(eq(agents.id, id))
      .returning()

    // Determine appropriate audit action based on status change
    const log = createAuditLogger(session.user)
    if (updates.status === 'suspended') {
      log('agent.suspend', 'agent', id, {
        agentEmail: existing.agentUser.email,
        previousStatus: existing.status,
      })
    } else if (updates.status === 'terminated') {
      log('agent.terminate', 'agent', id, {
        agentEmail: existing.agentUser.email,
        previousStatus: existing.status,
      })
    } else if (updates.status === 'active' && existing.status !== 'active') {
      log('agent.activate', 'agent', id, {
        agentEmail: existing.agentUser.email,
        previousStatus: existing.status,
      })
    } else {
      log('agent.update', 'agent', id, {
        agentEmail: existing.agentUser.email,
        changes: Object.keys(updates),
      })
    }

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
    }
  })

// Pay out pending commission to an agent
export const payCommission = createServerFn()
  .inputValidator(z.string())
  .handler(async ({ data: agentId }) => {
    const session = await requireAuth()

    // Verify ownership
    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
      with: { agentUser: true },
    })

    if (!agent || agent.lenderId !== session.user.id) {
      throw new Error('Agent not found')
    }

    const pendingAmount =
      parseFloat(agent.totalCommissionEarned) -
      parseFloat(agent.totalCommissionPaid)

    if (pendingAmount <= 0) {
      throw new Error('No pending commission to pay')
    }

    // Mark all pending commissions as paid
    await db
      .update(commissions)
      .set({
        status: 'paid',
        paidAt: new Date(),
        paidBy: session.user.id,
      })
      .where(
        and(
          eq(commissions.agentId, agentId),
          eq(commissions.status, 'pending'),
        ),
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
    log('commission.pay', 'commission', agentId, {
      agentEmail: agent.agentUser.email,
      amountPaid: pendingAmount,
    })

    return { success: true, amountPaid: pendingAmount }
  })

// Loan assignment functions (for lenders)
const assignLoanSchema = z.object({
  loanId: z.string(),
  agentId: z.string().nullable(),
})

// Assign a loan to an agent
export const assignLoanToAgent = createServerFn()
  .inputValidator(assignLoanSchema)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const { loanId, agentId } = data

    // Verify loan ownership
    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      with: { contact: true },
    })

    if (!loan || loan.lenderId !== session.user.id) {
      throw new Error('Loan not found')
    }

    let agentEmail: string | null = null

    // If assigning (not unassigning), verify agent belongs to this lender
    if (agentId) {
      const agent = await db.query.agents.findFirst({
        where: and(
          eq(agents.id, agentId),
          eq(agents.lenderId, session.user.id),
          eq(agents.status, 'active'),
        ),
        with: { agentUser: true },
      })

      if (!agent) {
        throw new Error('Agent not found or not active')
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
    log('loan.assign_agent', 'loan', loanId, {
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

// Re-export agent portal functions from dedicated module for backwards compatibility
export {
  getAgentDashboard,
  getAgentLoans,
  getAgentContacts,
  getAgentPayments,
  getAgentUpcomingPayments,
  getAgentContact,
  getAgentCommissions,
} from './agent-portal'
