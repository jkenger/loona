import { db, contacts, loans } from "@/lib/db"
import { eq, desc, sql, and } from "drizzle-orm"

/**
 * Shared contact service functions
 * These contain core business logic used by both lender and agent features
 */

export interface ContactSummary {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  facebookProfile: string | null
  notes: string | null
  createdAt: string
  activeLoans: number
  totalLoans: number
}

export interface ContactDetail {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  facebookProfile: string | null
  notes: string | null
  lenderId: string
  createdAt: string
  updatedAt: string
  loans: LoanSummary[]
}

export interface LoanSummary {
  id: string
  principal: string
  interestRate: string
  termMonths: number
  paymentFrequency: string
  amountPaid: string
  remainingBalance: string
  status: string
  startDate: string | null
  maturityDate: string | null
  createdAt: string
}

/**
 * Get all contacts for a lender with loan counts
 */
export async function getContactsForLender(lenderId: string): Promise<ContactSummary[]> {
  const result = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      phone: contacts.phone,
      email: contacts.email,
      address: contacts.address,
      city: contacts.city,
      facebookProfile: contacts.facebookProfile,
      notes: contacts.notes,
      createdAt: contacts.createdAt,
      activeLoans: sql<number>`count(${loans.id}) filter (where ${loans.status} = 'active')::int`,
      totalLoans: sql<number>`count(${loans.id})::int`,
    })
    .from(contacts)
    .leftJoin(loans, eq(contacts.id, loans.contactId))
    .where(eq(contacts.lenderId, lenderId))
    .groupBy(contacts.id)
    .orderBy(desc(contacts.createdAt))

  return result.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }))
}

/**
 * Get contacts with assigned loans for an agent
 * Only shows contacts that have at least one loan assigned to this agent
 */
export async function getContactsForAgent(agentIds: string[]): Promise<(ContactSummary & {
  totalPrincipal: string
  totalRemaining: string
})[]> {
  if (agentIds.length === 0) return []

  const result = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      phone: contacts.phone,
      email: contacts.email,
      address: contacts.address,
      city: contacts.city,
      facebookProfile: contacts.facebookProfile,
      notes: contacts.notes,
      createdAt: contacts.createdAt,
      activeLoans: sql<number>`count(${loans.id}) filter (where ${loans.status} = 'active')::int`,
      totalLoans: sql<number>`count(${loans.id})::int`,
      totalPrincipal: sql<string>`coalesce(sum(${loans.principal}), 0)`,
      totalRemaining: sql<string>`coalesce(sum(${loans.remainingBalance}), 0)`,
    })
    .from(contacts)
    .innerJoin(loans, eq(contacts.id, loans.contactId))
    .where(sql`${loans.assignedAgentId} IN ${agentIds}`)
    .groupBy(contacts.id)
    .orderBy(contacts.name)

  return result.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }))
}

/**
 * Get contact detail for a lender
 */
export async function getContactDetailForLender(
  contactId: string,
  lenderId: string
): Promise<ContactDetail | null> {
  const result = await db.query.contacts.findFirst({
    where: and(eq(contacts.id, contactId), eq(contacts.lenderId, lenderId)),
    with: {
      loans: {
        with: {
          schedule: true,
        },
        orderBy: desc(loans.createdAt),
      },
    },
  })

  if (!result) return null

  return {
    ...result,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
    loans: result.loans.map((l) => ({
      id: l.id,
      principal: l.principal,
      interestRate: l.interestRate,
      termMonths: l.termMonths,
      paymentFrequency: l.paymentFrequency,
      amountPaid: l.amountPaid,
      remainingBalance: l.remainingBalance,
      status: l.status,
      startDate: l.startDate?.toISOString() ?? null,
      maturityDate: l.maturityDate?.toISOString() ?? null,
      createdAt: l.createdAt.toISOString(),
    })),
  }
}

/**
 * Get contact detail for an agent (only shows assigned loans)
 */
export async function getContactDetailForAgent(
  contactId: string,
  agentIds: string[]
): Promise<ContactDetail | null> {
  if (agentIds.length === 0) return null

  const result = await db.query.contacts.findFirst({
    where: eq(contacts.id, contactId),
    with: {
      loans: {
        where: sql`${loans.assignedAgentId} IN ${agentIds}`,
        with: {
          schedule: true,
        },
        orderBy: desc(loans.createdAt),
      },
    },
  })

  // Only return if contact has at least one assigned loan
  if (!result || result.loans.length === 0) return null

  return {
    ...result,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
    loans: result.loans.map((l) => ({
      id: l.id,
      principal: l.principal,
      interestRate: l.interestRate,
      termMonths: l.termMonths,
      paymentFrequency: l.paymentFrequency,
      amountPaid: l.amountPaid,
      remainingBalance: l.remainingBalance,
      status: l.status,
      startDate: l.startDate?.toISOString() ?? null,
      maturityDate: l.maturityDate?.toISOString() ?? null,
      createdAt: l.createdAt.toISOString(),
    })),
  }
}
