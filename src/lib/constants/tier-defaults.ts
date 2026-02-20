import type { PenaltyConfig } from "./penalty-defaults"

// ============================================================================
// Borrower Tier Types
// ============================================================================

export type BorrowerTier = "new" | "returning" | "established" | "loyal"

export interface TierConfig {
  tier: BorrowerTier
  interestRate: number // monthly rate, e.g. 7 for 7%
  penaltyConfig: PenaltyConfig
}

export interface TierRequirement {
  tier: BorrowerTier
  completedLoans: number // minimum completed loans
  onTimeRate: number | null // minimum on-time rate (null = any)
}

export interface TierResolution {
  tier: BorrowerTier
  tierLabel: string
  completedLoans: number
  onTimeRate: number
  reasoning: string[]
}

// ============================================================================
// Tier Requirements (thresholds)
// ============================================================================

export const TIER_REQUIREMENTS: TierRequirement[] = [
  { tier: "loyal", completedLoans: 5, onTimeRate: 85 },
  { tier: "established", completedLoans: 3, onTimeRate: 80 },
  { tier: "returning", completedLoans: 1, onTimeRate: null },
  { tier: "new", completedLoans: 0, onTimeRate: null },
]

// ============================================================================
// Default Tier Configs
// ============================================================================

const BASE_PENALTY_CONFIG: PenaltyConfig = {
  enabled: true,
  gracePeriodDays: 0,
  lateFee: {
    enabled: true,
    type: "fixed",
    amount: 200,
  },
  dailyPenaltyInterest: {
    enabled: false,
    ratePerDay: 0.1,
    maxDays: 90,
  },
  penaltyCap: {
    type: "percentage",
    amount: 25,
  },
  commissionOnPenalties: false,
}

export const DEFAULT_TIER_CONFIGS: TierConfig[] = [
  {
    tier: "new",
    interestRate: 7,
    penaltyConfig: {
      ...BASE_PENALTY_CONFIG,
      gracePeriodDays: 0,
    },
  },
  {
    tier: "returning",
    interestRate: 5,
    penaltyConfig: {
      ...BASE_PENALTY_CONFIG,
      gracePeriodDays: 2,
    },
  },
  {
    tier: "established",
    interestRate: 5,
    penaltyConfig: {
      ...BASE_PENALTY_CONFIG,
      gracePeriodDays: 4,
    },
  },
  {
    tier: "loyal",
    interestRate: 3,
    penaltyConfig: {
      ...BASE_PENALTY_CONFIG,
      gracePeriodDays: 7,
    },
  },
]

// ============================================================================
// Helpers
// ============================================================================

const TIER_LABELS: Record<BorrowerTier, string> = {
  new: "New Borrower",
  returning: "Returning Borrower",
  established: "Established Borrower",
  loyal: "Loyal Borrower",
}

export function getTierLabel(tier: BorrowerTier): string {
  return TIER_LABELS[tier]
}

const TIER_ORDER: Record<BorrowerTier, number> = {
  new: 0,
  returning: 1,
  established: 2,
  loyal: 3,
}

export function getTierOrder(tier: BorrowerTier): number {
  return TIER_ORDER[tier]
}

export function getDefaultTierConfig(tier: BorrowerTier): TierConfig {
  return DEFAULT_TIER_CONFIGS.find((c) => c.tier === tier) ?? DEFAULT_TIER_CONFIGS[0]
}

export function getTierRequirementLabel(tier: BorrowerTier): string {
  const req = TIER_REQUIREMENTS.find((r) => r.tier === tier)
  if (!req) return ""
  if (tier === "new") return "First-time borrower"
  const parts: string[] = []
  parts.push(`${req.completedLoans}+ completed loans`)
  if (req.onTimeRate !== null) {
    parts.push(`≥${req.onTimeRate}% on-time`)
  }
  return parts.join(", ")
}
