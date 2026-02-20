import { createServerFn } from "@tanstack/react-start"
import { eq, desc } from "drizzle-orm"
import { z } from "zod"
import { requireAuth } from "./session"
import { createAuditLogger } from "./audit"
import { db, tierConfigs, contacts, loans, paymentSchedule } from "@/lib/db"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { parsePenaltyConfig, penaltyConfigSchema, type PenaltyConfig } from "@/lib/constants/penalty-defaults"
import {
  type BorrowerTier,
  getDefaultTierConfig,
} from "@/lib/constants/tier-defaults"
import { calculateOnTimeStats } from "@/lib/utils/on-time-stats"
import { resolveBorrowerTier } from "@/lib/utils/renewal-tiers"

// ============================================================================
// Types
// ============================================================================

interface TierConfigResult {
  tier: BorrowerTier
  interestRate: number
  penaltyConfig: PenaltyConfig
}

// ============================================================================
// Get Tier Configs
// ============================================================================

/**
 * Get all 4 tier configs for the authenticated lender.
 * Returns defaults if none saved yet.
 */
export const getTierConfigs = createServerFn().handler(async () => {
  const session = await requireAuth()

  if (!hasRole(session.user.role, ROLES.LENDER)) {
    throw new Error("Forbidden: Lender access required")
  }

  return getTierConfigsForLender(session.user.id)
})

/**
 * Internal helper: get tier configs for a specific lender (no auth check).
 */
export async function getTierConfigsForLender(lenderId: string): Promise<TierConfigResult[]> {
  const rows = await db.query.tierConfigs.findMany({
    where: eq(tierConfigs.lenderId, lenderId),
  })

  const savedMap = new Map(rows.map((r) => [r.tier, r]))

  const tiers: BorrowerTier[] = ["new", "returning", "established", "loyal"]
  return tiers.map((tier) => {
    const saved = savedMap.get(tier)
    if (saved) {
      return {
        tier,
        interestRate: parseFloat(saved.interestRate),
        penaltyConfig: parsePenaltyConfig(saved.config),
      }
    }
    const def = getDefaultTierConfig(tier)
    return {
      tier,
      interestRate: def.interestRate,
      penaltyConfig: def.penaltyConfig,
    }
  })
}

// ============================================================================
// Save Tier Configs
// ============================================================================

const saveTierConfigsSchema = z.array(
  z.object({
    tier: z.enum(["new", "returning", "established", "loyal"]),
    interestRate: z.number().min(0).max(15),
    penaltyConfig: penaltyConfigSchema,
  })
)

/**
 * Upsert all 4 tier configs at once (delete + insert).
 */
export const saveTierConfigs = createServerFn()
  .inputValidator(saveTierConfigsSchema)
  .handler(async ({ data: configs }) => {
    const session = await requireAuth()

    if (!hasRole(session.user.role, ROLES.LENDER)) {
      throw new Error("Forbidden: Lender access required")
    }

    const now = new Date()

    const values = configs.map((config) => ({
      lenderId: session.user.id,
      tier: config.tier as BorrowerTier,
      interestRate: config.interestRate.toString(),
      config: JSON.stringify(config.penaltyConfig),
      createdAt: now,
      updatedAt: now,
    }))

    // Atomic delete + insert via batch
    await db.batch([
      db.delete(tierConfigs).where(eq(tierConfigs.lenderId, session.user.id)),
      db.insert(tierConfigs).values(values),
    ])

    const log = createAuditLogger(session.user)
    log("tierConfig.update", "tier_configs", session.user.id)

    return { success: true }
  })

// ============================================================================
// Resolve Borrower Tier For Loan
// ============================================================================

/**
 * Calculate on-time stats, resolve tier, and look up lender's tier config
 * for a specific borrower. Used in loan creation wizard.
 */
export const resolveBorrowerTierForLoan = createServerFn()
  .inputValidator(z.string())
  .handler(async ({ data: contactId }) => {
    await requireAuth()

    const contact = await db.query.contacts.findFirst({
      where: eq(contacts.id, contactId),
      with: {
        loans: {
          with: {
            schedule: true,
          },
          orderBy: desc(loans.createdAt),
        },
      },
    })

    if (!contact) {
      throw new Error("Contact not found")
    }

    const lenderId = contact.lenderId
    const allLoans = contact.loans
    const completedLoans = allLoans.filter((l) => l.status === "completed").length

    // Calculate on-time stats (raw due date)
    const allScheduleItems = allLoans.flatMap((loan) => loan.schedule)
    const stats = calculateOnTimeStats(allScheduleItems)

    // Resolve tier
    const tierResult = resolveBorrowerTier({
      completedLoans,
      onTimeRate: stats.onTimeRate,
    })

    // Look up lender's tier config for this tier
    const lenderTierConfigs = await getTierConfigsForLender(lenderId)
    const matchedConfig = lenderTierConfigs.find((r) => r.tier === tierResult.tier)

    const interestRate = matchedConfig?.interestRate ?? getDefaultTierConfig(tierResult.tier).interestRate
    const penaltyConfig = matchedConfig?.penaltyConfig ?? getDefaultTierConfig(tierResult.tier).penaltyConfig

    return {
      tier: tierResult.tier,
      tierLabel: tierResult.tierLabel,
      interestRate,
      penaltyConfig,
      reasoning: tierResult.reasoning,
      scorecard: {
        completedLoans,
        onTimeRate: stats.onTimeRate,
        latePayments: stats.lateCount,
        avgDaysLate: stats.lateCount > 0 ? Math.round(stats.totalDaysLate / stats.lateCount) : 0,
        totalLoans: allLoans.length,
      },
    }
  })

// ============================================================================
// Refresh Contact Tier (fire-and-forget)
// ============================================================================

/**
 * Recalculate and store a contact's tier and on-time rate.
 * Call after key events: payment recorded, loan completed, loan created.
 * Non-blocking — errors are caught and logged.
 */
export async function refreshContactTier(contactId: string): Promise<void> {
  try {
    const contact = await db.query.contacts.findFirst({
      where: eq(contacts.id, contactId),
      with: {
        loans: {
          with: {
            schedule: true,
          },
        },
      },
    })

    if (!contact) return

    const completedLoans = contact.loans.filter((l) => l.status === "completed").length
    const allScheduleItems = contact.loans.flatMap((loan) => loan.schedule)
    const stats = calculateOnTimeStats(allScheduleItems)

    const tierResult = resolveBorrowerTier({
      completedLoans,
      onTimeRate: stats.onTimeRate,
    })

    await db
      .update(contacts)
      .set({
        tier: tierResult.tier,
        onTimeRate: stats.onTimeRate.toString(),
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, contactId))
  } catch (error) {
    console.error("[TIER] Failed to refresh contact tier:", error, { contactId })
  }
}
