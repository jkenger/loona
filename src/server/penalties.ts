import { createServerFn } from "@tanstack/react-start"
import { db, penalties, loans, penaltySettings } from "@/lib/db"
import { eq, and, sql } from "drizzle-orm"
import { requireAuth } from "./session"
import { createAuditLogger } from "./audit"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { z } from "zod"
import {
  parsePenaltyConfig,
  calculateSuggestedPenalty,
  getRemainingPenaltyBudget,
  calendarDaysOverdue,
  type PenaltyConfig,
  type SuggestedPenalty,
} from "@/lib/constants/penalty-defaults"
import { ensurePendingPenalties } from "./penalty-generation"

// ============================================================================
// Penalty Server Functions
// ============================================================================

export interface PenaltyRecord {
  id: string
  loanId: string
  scheduleItemId: string
  penaltyType: "late_fee" | "daily_interest"
  amount: string
  status: "pending" | "applied" | "waived"
  appliedAt: string | null
  waivedAt: string | null
  decidedBy: string | null
  notes: string | null
  createdAt: string
}

export interface ScheduleItemSuggestion {
  scheduleItemId: string
  daysOverdue: number
  overdueAmount: number
  suggestion: SuggestedPenalty
  existingPenalties: PenaltyRecord[]
}

export interface LoanPenaltyData {
  config: PenaltyConfig
  penalties: PenaltyRecord[]
  suggestions: ScheduleItemSuggestion[]
  totalApplied: number
  totalPending: number
  budgetRemaining: number
}

/**
 * Get all penalty data for a loan — generates/updates pending records first,
 * then returns records + suggestions for overdue items.
 */
export const getLoanPenalties = createServerFn()
  .inputValidator(z.string().min(1))
  .handler(async ({ data: loanId }): Promise<LoanPenaltyData> => {
    const session = await requireAuth()

    if (!hasRole(session.user.role, ROLES.LENDER)) {
      throw new Error("Forbidden: Lender access required")
    }

    // Get the loan and verify ownership
    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      with: {
        schedule: true,
      },
    })

    if (!loan || loan.lenderId !== session.user.id) {
      throw new Error("Loan not found")
    }

    // Get lender's penalty config
    const settingsRow = await db.query.penaltySettings.findFirst({
      where: eq(penaltySettings.lenderId, session.user.id),
    })
    const config = parsePenaltyConfig(settingsRow?.config ?? null)

    // Generate/update pending penalties for this loan before reading
    if (config.enabled && loan.status === "active") {
      const existingForGeneration = await db.query.penalties.findMany({
        where: eq(penalties.loanId, loanId),
      })
      await ensurePendingPenalties(loan, config, existingForGeneration)
    }

    // Now read the (potentially just-created) penalty records
    const penaltyRecords = await db.query.penalties.findMany({
      where: eq(penalties.loanId, loanId),
    })

    const serialized: PenaltyRecord[] = penaltyRecords.map((p) => ({
      id: p.id,
      loanId: p.loanId,
      scheduleItemId: p.scheduleItemId,
      penaltyType: p.penaltyType,
      amount: p.amount,
      status: p.status,
      appliedAt: p.appliedAt?.toISOString() ?? null,
      waivedAt: p.waivedAt?.toISOString() ?? null,
      decidedBy: p.decidedBy,
      notes: p.notes,
      createdAt: p.createdAt.toISOString(),
    }))

    const totalApplied = penaltyRecords
      .filter((p) => p.status === "applied")
      .reduce((sum, p) => sum + parseFloat(p.amount), 0)

    const totalPending = penaltyRecords
      .filter((p) => p.status === "pending")
      .reduce((sum, p) => sum + parseFloat(p.amount), 0)

    const budgetRemaining = getRemainingPenaltyBudget(
      config,
      parseFloat(loan.principal),
      totalApplied,
    )

    // Build suggestions for overdue schedule items
    const suggestions: ScheduleItemSuggestion[] = []
    const now = new Date()

    if (config.enabled) {
      for (const item of loan.schedule) {
        if (item.status !== "overdue") continue

        const daysOverdue = calendarDaysOverdue(new Date(item.dueDate), now)
        if (daysOverdue <= 0) continue

        const overdueAmount = parseFloat(item.amount) - parseFloat(item.paidAmount)
        if (overdueAmount <= 0) continue

        const itemPenalties = serialized.filter(
          (p) => p.scheduleItemId === item.id,
        )

        const suggestion = calculateSuggestedPenalty(
          config,
          overdueAmount,
          daysOverdue,
          parseFloat(loan.principal),
          totalApplied,
          totalPending,
        )

        suggestions.push({
          scheduleItemId: item.id,
          daysOverdue,
          overdueAmount,
          suggestion,
          existingPenalties: itemPenalties,
        })
      }
    }

    return {
      config,
      penalties: serialized,
      suggestions,
      totalApplied,
      totalPending,
      budgetRemaining,
    }
  })

/**
 * Apply a pending penalty — adds amount to loan balance.
 */
export const applyPenalty = createServerFn()
  .inputValidator(z.object({
    penaltyId: z.string().min(1),
    notes: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const session = await requireAuth()

    if (!hasRole(session.user.role, ROLES.LENDER)) {
      throw new Error("Forbidden: Lender access required")
    }

    // Get the penalty record
    const penalty = await db.query.penalties.findFirst({
      where: eq(penalties.id, data.penaltyId),
    })

    if (!penalty) {
      throw new Error("Penalty not found")
    }

    if (penalty.status !== "pending") {
      throw new Error("Penalty has already been decided")
    }

    // Verify loan ownership
    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, penalty.loanId),
    })

    if (!loan || loan.lenderId !== session.user.id) {
      throw new Error("Loan not found")
    }

    // Check cap
    const settingsRow = await db.query.penaltySettings.findFirst({
      where: eq(penaltySettings.lenderId, session.user.id),
    })
    const config = parsePenaltyConfig(settingsRow?.config ?? null)

    // Sum already-applied penalties
    const appliedResult = await db
      .select({ total: sql<string>`COALESCE(SUM(${penalties.amount}::numeric), 0)` })
      .from(penalties)
      .where(
        and(
          eq(penalties.loanId, penalty.loanId),
          eq(penalties.status, "applied"),
        ),
      )

    const totalApplied = parseFloat(appliedResult[0]?.total ?? "0")
    const penaltyAmount = parseFloat(penalty.amount)
    const budgetRemaining = getRemainingPenaltyBudget(
      config,
      parseFloat(loan.principal),
      totalApplied,
    )

    if (penaltyAmount > budgetRemaining) {
      throw new Error(
        `Penalty of ₱${penaltyAmount.toFixed(2)} would exceed the cap. Remaining budget: ₱${budgetRemaining.toFixed(2)}`,
      )
    }

    // Apply: update penalty record
    await db
      .update(penalties)
      .set({
        status: "applied",
        appliedAt: new Date(),
        decidedBy: session.user.id,
        notes: data.notes || null,
      })
      .where(eq(penalties.id, data.penaltyId))

    // Update loan balances
    await db
      .update(loans)
      .set({
        totalToRepay: sql`${loans.totalToRepay}::numeric + ${penaltyAmount}`,
        remainingBalance: sql`${loans.remainingBalance}::numeric + ${penaltyAmount}`,
        updatedAt: new Date(),
      })
      .where(eq(loans.id, penalty.loanId))

    const log = createAuditLogger(session.user)
    log("penalty.apply", "penalty", data.penaltyId, {
      loanId: penalty.loanId,
      amount: penaltyAmount,
      penaltyType: penalty.penaltyType,
    })

    return { success: true }
  })

/**
 * Waive a pending penalty — no balance change.
 */
export const waivePenalty = createServerFn()
  .inputValidator(z.object({
    penaltyId: z.string().min(1),
    notes: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const session = await requireAuth()

    if (!hasRole(session.user.role, ROLES.LENDER)) {
      throw new Error("Forbidden: Lender access required")
    }

    const penalty = await db.query.penalties.findFirst({
      where: eq(penalties.id, data.penaltyId),
    })

    if (!penalty) {
      throw new Error("Penalty not found")
    }

    if (penalty.status !== "pending") {
      throw new Error("Penalty has already been decided")
    }

    // Verify loan ownership
    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, penalty.loanId),
    })

    if (!loan || loan.lenderId !== session.user.id) {
      throw new Error("Loan not found")
    }

    await db
      .update(penalties)
      .set({
        status: "waived",
        waivedAt: new Date(),
        decidedBy: session.user.id,
        notes: data.notes || null,
      })
      .where(eq(penalties.id, data.penaltyId))

    const log = createAuditLogger(session.user)
    log("penalty.waive", "penalty", data.penaltyId, {
      loanId: penalty.loanId,
      amount: parseFloat(penalty.amount),
      penaltyType: penalty.penaltyType,
    })

    return { success: true }
  })
