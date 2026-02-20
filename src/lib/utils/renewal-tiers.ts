import {
  type BorrowerTier,
  type TierResolution,
  TIER_REQUIREMENTS,
  getTierLabel,
} from "@/lib/constants/tier-defaults"

interface ResolveTierInput {
  completedLoans: number
  onTimeRate: number
}

/**
 * Resolve the borrower's absolute tier based on completed loans and on-time rate.
 * Uses raw due date on-time rate (not grace-adjusted).
 *
 * Tier thresholds:
 * - Loyal: 5+ completed, ≥85% on-time
 * - Established: 3+ completed, ≥80% on-time
 * - Returning: 1+ completed
 * - New: 0 completed
 *
 * Loyal is losable — drops to Established if on-time < 85%.
 */
export function resolveBorrowerTier(input: ResolveTierInput): TierResolution {
  const { completedLoans, onTimeRate } = input
  const reasoning: string[] = []

  let tier: BorrowerTier = "new"

  // Walk through requirements from highest to lowest
  for (const req of TIER_REQUIREMENTS) {
    if (completedLoans >= req.completedLoans) {
      if (req.onTimeRate === null || onTimeRate >= req.onTimeRate) {
        tier = req.tier
        break
      } else {
        // Met the loan count but not the on-time rate
        reasoning.push(
          `Has ${completedLoans} completed loan(s) but ${onTimeRate}% on-time rate is below the ${req.onTimeRate}% required for ${getTierLabel(req.tier)}`
        )
      }
    }
  }

  // Add context reasoning
  if (tier === "new") {
    reasoning.push("First-time borrower — no loan history")
  } else if (tier === "returning") {
    reasoning.push(`${completedLoans} completed loan(s) — returning borrower`)
  } else if (tier === "established") {
    reasoning.push(`${completedLoans} completed loan(s) with ${onTimeRate}% on-time rate — established borrower`)
  } else if (tier === "loyal") {
    reasoning.push(`${completedLoans} completed loan(s) with ${onTimeRate}% on-time rate — loyal borrower`)
  }

  return {
    tier,
    tierLabel: getTierLabel(tier),
    completedLoans,
    onTimeRate,
    reasoning,
  }
}
