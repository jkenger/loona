import { createServerFn } from "@tanstack/react-start"
import {
  db,
  agents,
  commissions,
  payments,
  loans,
  contacts,
  paymentSchedule,
  penalties,
  penaltySettings,
} from "@/lib/db"
import { eq, desc, and, sql, ne, lte } from "drizzle-orm"
import { requireAuth } from "./session"
import { z } from "zod"
import { parsePenaltyConfig, calendarDaysOverdue } from "@/lib/constants/penalty-defaults"

// ============================================================================
// Agent Portal Service
// All functions for the agent portal (accessed by agents)
// ============================================================================

// Get agent permissions (lightweight - for layout banner)
export const getAgentPermissions = createServerFn().handler(async () => {
  const session = await requireAuth()

  // Get agent relationships
  const agentRelationships = await db.query.agents.findMany({
    where: and(
      eq(agents.agentUserId, session.user.id),
      eq(agents.status, "active")
    ),
  })

  if (agentRelationships.length === 0) {
    return {
      canRecordPayments: false,
      canCreateLoans: false,
    }
  }

  // Check if any relationship allows these permissions
  const canRecordPayments = agentRelationships.some((r) => r.canRecordPayments)
  const canCreateLoans = agentRelationships.some((r) => r.canCreateLoans)

  return {
    canRecordPayments,
    canCreateLoans,
  }
})

// Get agent dashboard stats
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

  // Check overall permission (if any relationship allows recording payments)
  const canRecordPayments = agentRelationships.some((r) => r.canRecordPayments)

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
      canRecordPayments: r.canRecordPayments,
    })),
    canRecordPayments,
    totalCollected: totalCollected.toFixed(2),
    totalCommissionEarned: totalCommissionEarned.toFixed(2),
    pendingCommission: (totalCommissionEarned - totalCommissionPaid).toFixed(2),
    recentPayments: recentPayments.map((p) => ({
      ...p,
      paidAt: p.paidAt.toISOString(),
    })),
  }
})

// Get loans assigned to agent
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

  // Create a map of agentId -> canRecordPayments for lookup
  const agentPermissions = new Map(
    agentRelationships.map((r) => [r.id, r.canRecordPayments])
  )

  // Get only loans assigned to this agent
  const { user } = await import("@/lib/db")
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
      assignedAgentId: loans.assignedAgentId,
    })
    .from(loans)
    .innerJoin(contacts, eq(loans.contactId, contacts.id))
    .innerJoin(user, eq(loans.lenderId, user.id))
    .where(sql`${loans.assignedAgentId} IN ${agentIds}`)
    .orderBy(desc(loans.createdAt))

  return result.map((l) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
    canRecordPayments: l.assignedAgentId ? agentPermissions.get(l.assignedAgentId) ?? false : false,
  }))
})

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

// Get upcoming payments for agent's assigned loans (only active loans)
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
      lenderId: loans.lenderId,
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
        eq(loans.status, "active"),
        ne(paymentSchedule.status, "paid"),
        lte(paymentSchedule.dueDate, next30Days)
      )
    )
    .orderBy(paymentSchedule.dueDate)

  // Load penalty configs per lender
  const uniqueLenderIds = [...new Set(result.map((r) => r.lenderId))]
  const penaltyConfigMap = new Map<string, ReturnType<typeof parsePenaltyConfig>>()

  for (const lenderId of uniqueLenderIds) {
    const settingsRow = await db.query.penaltySettings.findFirst({
      where: eq(penaltySettings.lenderId, lenderId),
    })
    penaltyConfigMap.set(lenderId, parsePenaltyConfig(settingsRow?.config ?? null))
  }

  // Load penalties for overdue schedule items
  const overdueIds = result.filter((r) => r.status === "overdue").map((r) => r.id)
  let penaltyMap: Record<string, { id: string; penaltyType: string; amount: string; status: string }[]> = {}

  if (overdueIds.length > 0) {
    const penaltyRows = await db.query.penalties.findMany({
      where: sql`${penalties.scheduleItemId} IN ${overdueIds}`,
    })
    for (const p of penaltyRows) {
      if (!penaltyMap[p.scheduleItemId]) penaltyMap[p.scheduleItemId] = []
      penaltyMap[p.scheduleItemId].push({
        id: p.id,
        penaltyType: p.penaltyType,
        amount: p.amount,
        status: p.status,
      })
    }
  }

  return result.map((p) => {
    const daysOverdue = p.status === "overdue" ? calendarDaysOverdue(p.dueDate, now) : 0
    const penaltyConfig = penaltyConfigMap.get(p.lenderId)
    let penaltyIn = -1
    if (penaltyConfig?.enabled && penaltyConfig.lateFee.enabled && p.status === "overdue") {
      const remaining = penaltyConfig.lateFee.gracePeriodDays - daysOverdue
      penaltyIn = Math.max(0, remaining)
    }

    return {
      ...p,
      dueDate: p.dueDate.toISOString(),
      penalties: penaltyMap[p.id] ?? [],
      daysOverdue,
      penaltyIn,
    }
  })
})

// Get contact detail for agent (only shows assigned loans)
export const getAgentContact = createServerFn()
  .inputValidator(z.string())
  .handler(async ({ data: contactId }) => {
    const session = await requireAuth()

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
  })

// Get agent commissions
export const getAgentCommissions = createServerFn().handler(async () => {
  const session = await requireAuth()

  // Get agent's relationships
  const agentRelationships = await db.query.agents.findMany({
    where: and(
      eq(agents.agentUserId, session.user.id),
      eq(agents.status, "active")
    ),
  })

  if (agentRelationships.length === 0) {
    return {
      commissions: [],
      summary: {
        totalEarned: "0",
        totalPaid: "0",
        pending: "0",
      },
    }
  }

  const agentIds = agentRelationships.map((r) => r.id)

  // Get commission records
  const result = await db
    .select({
      id: commissions.id,
      paymentAmount: commissions.paymentAmount,
      commissionRate: commissions.commissionRate,
      commissionAmount: commissions.commissionAmount,
      status: commissions.status,
      createdAt: commissions.createdAt,
      paidAt: commissions.paidAt,
      contactName: contacts.name,
      loanPrincipal: loans.principal,
    })
    .from(commissions)
    .innerJoin(payments, eq(commissions.paymentId, payments.id))
    .innerJoin(loans, eq(payments.loanId, loans.id))
    .innerJoin(contacts, eq(loans.contactId, contacts.id))
    .where(sql`${commissions.agentId} IN ${agentIds}`)
    .orderBy(desc(commissions.createdAt))
    .limit(100)

  // Calculate summary
  const totalEarned = agentRelationships.reduce(
    (sum, r) => sum + parseFloat(r.totalCommissionEarned),
    0
  )
  const totalPaid = agentRelationships.reduce(
    (sum, r) => sum + parseFloat(r.totalCommissionPaid),
    0
  )

  return {
    commissions: result.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      paidAt: c.paidAt?.toISOString() ?? null,
    })),
    summary: {
      totalEarned: totalEarned.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      pending: (totalEarned - totalPaid).toFixed(2),
    },
  }
})
