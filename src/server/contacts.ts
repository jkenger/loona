import { createServerFn } from "@tanstack/react-start"
import { db, contacts, loans, agents, penaltySettings } from "@/lib/db"
import { eq, desc, sql, ilike, or, and } from "drizzle-orm"
import { requireAuth } from "./session"
import { createAuditLogger } from "./audit"
import { parsePenaltyConfig } from "@/lib/constants/penalty-defaults"
import { z } from "zod"

// Validation schemas
const createContactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  facebookProfile: z.string().optional(),
  notes: z.string().optional(),
})

const updateContactSchema = createContactSchema.partial().extend({
  id: z.string(),
})

// Server functions
export const getContacts = createServerFn().handler(async () => {
  const session = await requireAuth()

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
    .where(eq(contacts.lenderId, session.user.id))
    .groupBy(contacts.id)
    .orderBy(desc(contacts.createdAt))

  return result.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }))
})

export const getContact = createServerFn()
  .inputValidator(z.string())
  .handler(async ({ data: id }) => {
    const session = await requireAuth()

    const result = await db.query.contacts.findFirst({
      where: eq(contacts.id, id),
      with: {
        loans: {
          with: {
            schedule: true,
            assignedAgent: true,
          },
          orderBy: desc(loans.createdAt),
        },
      },
    })

    if (!result) {
      throw new Error("Contact not found")
    }

    // Check if user is the lender
    const isLender = result.lenderId === session.user.id

    // Check if user is an agent with an assigned loan for this contact
    let isAssignedAgent = false
    if (!isLender) {
      // Get user's agent IDs
      const userAgentRecords = await db.query.agents.findMany({
        where: and(
          eq(agents.agentUserId, session.user.id),
          eq(agents.status, "active")
        ),
      })
      const userAgentIds = userAgentRecords.map((a) => a.id)

      // Check if any loan for this contact is assigned to this agent
      isAssignedAgent = result.loans.some(
        (loan) => loan.assignedAgentId && userAgentIds.includes(loan.assignedAgentId)
      )
    }

    if (!isLender && !isAssignedAgent) {
      throw new Error("Contact not found")
    }

    // For agents, filter loans to only show their assigned ones
    const visibleLoans = isLender
      ? result.loans
      : result.loans.filter((loan) => {
          // Get agent IDs synchronously from closure - need to refetch
          return loan.assignedAgent?.agentUserId === session.user.id
        })

    return {
      ...result,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
      loans: visibleLoans.map((l) => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
        startDate: l.startDate?.toISOString() ?? null,
        maturityDate: l.maturityDate?.toISOString() ?? null,
        completedAt: l.completedAt?.toISOString() ?? null,
        schedule: l.schedule.map((s) => ({
          ...s,
          dueDate: s.dueDate.toISOString(),
          paidAt: s.paidAt?.toISOString() ?? null,
          createdAt: s.createdAt.toISOString(),
        })),
      })),
      isLender,
    }
  }
)

export const searchContacts = createServerFn()
  .inputValidator(z.string())
  .handler(async ({ data: query }) => {
    const session = await requireAuth()

    if (!query || query.length < 2) {
      return []
    }

    const result = await db
      .select({
        id: contacts.id,
        name: contacts.name,
        phone: contacts.phone,
        email: contacts.email,
      })
      .from(contacts)
      .where(
        and(
          eq(contacts.lenderId, session.user.id),
          or(
            ilike(contacts.name, `%${query}%`),
            ilike(contacts.phone, `%${query}%`),
            ilike(contacts.email, `%${query}%`)
          )
        )
      )
      .limit(10)

    return result
  }
)

export const createContact = createServerFn()
  .inputValidator(createContactSchema)
  .handler(async ({ data }) => {
  const session = await requireAuth()
  const log = createAuditLogger(session.user)

  const [contact] = await db
    .insert(contacts)
    .values({
      ...data,
      email: data.email || null,
      lenderId: session.user.id,
    })
    .returning()

  log("contact.create", "contact", contact.id, { name: contact.name })

  return {
    ...contact,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  }
})

export const updateContact = createServerFn()
  .inputValidator(updateContactSchema)
  .handler(async ({ data }) => {
  const session = await requireAuth()
  const { id, ...updates } = data
  const log = createAuditLogger(session.user)

  // Verify ownership
  const existing = await db.query.contacts.findFirst({
    where: eq(contacts.id, id),
  })

  if (!existing || existing.lenderId !== session.user.id) {
    throw new Error("Contact not found")
  }

  const [updated] = await db
    .update(contacts)
    .set({
      ...updates,
      email: updates.email || null,
      updatedAt: new Date(),
    })
    .where(eq(contacts.id, id))
    .returning()

  log("contact.update", "contact", id, { changes: Object.keys(updates) })

  return {
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  }
})

export const deleteContact = createServerFn()
  .inputValidator(z.string())
  .handler(async ({ data: id }) => {
    const session = await requireAuth()
    const log = createAuditLogger(session.user)

    // Verify ownership and check for loans
    const existing = await db.query.contacts.findFirst({
      where: eq(contacts.id, id),
      with: {
        loans: true,
      },
    })

    if (!existing || existing.lenderId !== session.user.id) {
      throw new Error("Contact not found")
    }

    if (existing.loans.length > 0) {
      throw new Error("Cannot delete contact with existing loans")
    }

    await db.delete(contacts).where(eq(contacts.id, id))

    log("contact.delete", "contact", id, { name: existing.name })

    return { success: true }
  }
)

export const getBorrowerScorecard = createServerFn()
  .inputValidator(z.string())
  .handler(async ({ data: contactId }) => {
    await requireAuth()

    const contact = await db.query.contacts.findFirst({
      where: eq(contacts.id, contactId),
      with: {
        loans: {
          with: {
            schedule: true,
            penalties: true,
          },
          orderBy: desc(loans.createdAt),
        },
      },
    })

    if (!contact) {
      throw new Error("Contact not found")
    }

    const allLoans = contact.loans
    const totalLoans = allLoans.length
    const completedLoans = allLoans.filter((l) => l.status === "completed").length
    const defaultedLoans = allLoans.filter((l) => l.status === "defaulted").length
    const totalBorrowed = allLoans.reduce((sum, l) => sum + parseFloat(l.principal), 0)

    // Fetch grace period from lender's penalty settings
    const settingsRow = await db.query.penaltySettings.findFirst({
      where: eq(penaltySettings.lenderId, contact.lenderId),
    })
    const penaltyConfig = parsePenaltyConfig(settingsRow?.config ?? null)
    const gracePeriodDays = penaltyConfig.lateFee.gracePeriodDays

    // Collect all schedule items across all loans
    let onTimeCount = 0
    let lateCount = 0
    let totalDaysLate = 0

    for (const loan of allLoans) {
      for (const item of loan.schedule) {
        if (item.status !== "paid") continue
        if (!item.paidAt) continue

        const dueDate = new Date(item.dueDate)
        const paidAt = new Date(item.paidAt)

        // Compare dates only (ignore time), accounting for grace period
        const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
        const paidDateOnly = new Date(paidAt.getFullYear(), paidAt.getMonth(), paidAt.getDate())
        const diffMs = paidDateOnly.getTime() - dueDateOnly.getTime()
        const daysDiff = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

        if (daysDiff <= gracePeriodDays) {
          onTimeCount++
        } else {
          lateCount++
          totalDaysLate += daysDiff
        }
      }
    }

    const totalPaidItems = onTimeCount + lateCount
    const onTimeRate = totalPaidItems > 0 ? Math.round((onTimeCount / totalPaidItems) * 100) : 100

    // Sum applied penalties
    const totalPenalties = allLoans.reduce((sum, loan) => {
      return sum + loan.penalties
        .filter((p) => p.status === "applied")
        .reduce((pSum, p) => pSum + parseFloat(p.amount), 0)
    }, 0)

    const avgDaysLate = lateCount > 0 ? Math.round(totalDaysLate / lateCount) : 0

    // Last 3 completed loans for trend
    const previousLoans = allLoans
      .filter((l) => l.status === "completed")
      .slice(0, 3)
      .map((l) => ({
        id: l.id,
        principal: l.principal,
        interestRate: l.interestRate,
        termMonths: l.termMonths,
        completedAt: l.completedAt?.toISOString() ?? null,
      }))

    return {
      totalLoans,
      completedLoans,
      defaultedLoans,
      totalBorrowed,
      onTimeRate,
      latePayments: lateCount,
      totalPenalties,
      avgDaysLate,
      previousLoans,
    }
  })
