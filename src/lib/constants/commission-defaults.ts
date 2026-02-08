import { z } from "zod"

// ============================================================================
// Commission Program Types
// ============================================================================

export type CommissionType = "fixed" | "higher_of" | "percentage"

export interface CommissionTier {
  name: string
  tier: number
  commissionType: CommissionType
  flatAmount: number        // e.g. 50 for PHP 50
  percentageRate: number    // e.g. 3 for 3%
  portfolioCap: number      // max loans assigned
  originationBonus: number  // one-time bonus per referral
  originationQualifyingPayments: number // payments before bonus is earned
}

export interface PromotionCriteria {
  months: number           // minimum months active
  minCollections: number   // minimum successful collections
  minOnTimeRate: number    // minimum on-time % (e.g. 85)
}

export interface CommissionProgramConfig {
  tiers: CommissionTier[]
  promotionCriteria: PromotionCriteria
  demotionRules: string
  agentRules: string[]
  payoutSchedule: string
}

// ============================================================================
// Zod Schemas
// ============================================================================

const commissionTierSchema = z.object({
  name: z.string().min(1),
  tier: z.number().int().min(1).max(10),
  commissionType: z.enum(["fixed", "higher_of", "percentage"]),
  flatAmount: z.number().min(0),
  percentageRate: z.number().min(0).max(100),
  portfolioCap: z.number().int().min(1).max(999),
  originationBonus: z.number().min(0),
  originationQualifyingPayments: z.number().int().min(0).max(99),
})

const promotionCriteriaSchema = z.object({
  months: z.number().int().min(1).max(99),
  minCollections: z.number().int().min(1).max(9999),
  minOnTimeRate: z.number().min(0).max(100),
})

export const commissionProgramConfigSchema = z.object({
  tiers: z.array(commissionTierSchema).max(3),
  promotionCriteria: promotionCriteriaSchema,
  demotionRules: z.string(),
  agentRules: z.array(z.string()),
  payoutSchedule: z.string().min(1),
})

// ============================================================================
// Defaults (from agent-commission-model.md)
// ============================================================================

export const DEFAULT_COMMISSION_PROGRAM: CommissionProgramConfig = {
  tiers: [
    {
      name: "Probationary",
      tier: 1,
      commissionType: "fixed",
      flatAmount: 50,
      percentageRate: 0,
      portfolioCap: 10,
      originationBonus: 100,
      originationQualifyingPayments: 3,
    },
    {
      name: "Trusted",
      tier: 2,
      commissionType: "higher_of",
      flatAmount: 50,
      percentageRate: 3,
      portfolioCap: 20,
      originationBonus: 200,
      originationQualifyingPayments: 2,
    },
  ],
  promotionCriteria: {
    months: 3,
    minCollections: 15,
    minOnTimeRate: 85,
  },
  demotionRules:
    "On-time collection rate drops below 70% for 2 consecutive months. Demotion effective the following month. Can re-qualify for Tier 2 after meeting original criteria again.",
  agentRules: [
    "No fund handling — All payments must go directly to the lender via ewallet or bank transfer. Cash is accepted only as last resort and must be remitted same-day with proof.",
    "No authority to modify terms — Agents cannot promise payment extensions, reduced amounts, interest waivers, or any changes to loan terms. Only the lender can approve modifications.",
    "Respectful communication — Agents must follow the lender's tone and approach when communicating with borrowers. No harassment, threats, or inappropriate contact.",
    "Transparency — Agents must not misrepresent loan terms, interest rates, or any conditions to potential or existing borrowers.",
    "Confidentiality — Borrower information must not be shared with anyone outside the lending relationship.",
  ],
  payoutSchedule: "Monthly",
}

// ============================================================================
// Helpers
// ============================================================================

export function parseCommissionConfig(json: string | null): CommissionProgramConfig {
  if (!json) return DEFAULT_COMMISSION_PROGRAM
  try {
    const parsed = JSON.parse(json)
    const result = commissionProgramConfigSchema.safeParse(parsed)
    if (result.success) return result.data
    return DEFAULT_COMMISSION_PROGRAM
  } catch {
    return DEFAULT_COMMISSION_PROGRAM
  }
}

export function calculateTierCommission(
  tier: CommissionTier,
  paymentAmount: number,
): number {
  switch (tier.commissionType) {
    case "fixed":
      return tier.flatAmount
    case "percentage":
      return paymentAmount * (tier.percentageRate / 100)
    case "higher_of":
      return Math.max(tier.flatAmount, paymentAmount * (tier.percentageRate / 100))
  }
}

export function commissionTypeLabel(type: CommissionType): string {
  switch (type) {
    case "fixed":
      return "Fixed Amount"
    case "higher_of":
      return "Percentage or Fixed (whichever is higher)"
    case "percentage":
      return "Percentage"
  }
}
