import { z } from "zod"

// ============================================================================
// Penalty Config Types
// ============================================================================

export interface LateFeeConfig {
  enabled: boolean
  type: "fixed" | "percentage"
  amount: number         // flat amount (e.g., 200) or percentage (e.g., 5 for 5%)
}

export interface DailyPenaltyInterestConfig {
  enabled: boolean
  ratePerDay: number     // e.g., 0.1 for 0.1% per day
  maxDays: number        // cap on how many days of daily interest can accrue
}

export interface PenaltyCapConfig {
  type: "fixed" | "percentage" // percentage = % of principal
  amount: number               // e.g., 25 for 25% of principal, or flat amount
}

export interface PenaltyConfig {
  enabled: boolean
  gracePeriodDays: number // days after due date before any penalties apply
  lateFee: LateFeeConfig
  dailyPenaltyInterest: DailyPenaltyInterestConfig
  penaltyCap: PenaltyCapConfig
  commissionOnPenalties: boolean
}

// ============================================================================
// Zod Schemas
// ============================================================================

const lateFeeSchema = z.object({
  enabled: z.boolean(),
  type: z.enum(["fixed", "percentage"]),
  amount: z.number().min(0),
})

const dailyPenaltyInterestSchema = z.object({
  enabled: z.boolean(),
  ratePerDay: z.number().min(0).max(10),
  maxDays: z.number().int().min(1).max(365),
})

const penaltyCapSchema = z.object({
  type: z.enum(["fixed", "percentage"]),
  amount: z.number().min(0),
})

export const penaltyConfigSchema = z.object({
  enabled: z.boolean(),
  gracePeriodDays: z.number().int().min(0).max(90),
  lateFee: lateFeeSchema,
  dailyPenaltyInterest: dailyPenaltyInterestSchema,
  penaltyCap: penaltyCapSchema,
  commissionOnPenalties: z.boolean(),
})

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_PENALTY_CONFIG: PenaltyConfig = {
  enabled: false,
  gracePeriodDays: 3,
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

// ============================================================================
// Helpers
// ============================================================================

/**
 * Calendar-day difference between a due date and now.
 * Strips time so "yesterday at 11pm" → today = 1 day, not 0.
 */
export function calendarDaysOverdue(dueDate: Date, now: Date = new Date()): number {
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
}

export function parsePenaltyConfig(json: string | null): PenaltyConfig {
  if (!json) return DEFAULT_PENALTY_CONFIG
  try {
    const parsed = JSON.parse(json)

    // Migrate old shape: hoist nested gracePeriodDays to top level
    if (parsed.gracePeriodDays === undefined) {
      parsed.gracePeriodDays = parsed.lateFee?.gracePeriodDays ?? DEFAULT_PENALTY_CONFIG.gracePeriodDays
    }
    // Strip removed nested fields so Zod strict parsing won't choke on extras
    if (parsed.lateFee) delete parsed.lateFee.gracePeriodDays
    if (parsed.dailyPenaltyInterest) delete parsed.dailyPenaltyInterest.startsAfterDays

    const result = penaltyConfigSchema.safeParse(parsed)
    if (result.success) return result.data
    return DEFAULT_PENALTY_CONFIG
  } catch {
    return DEFAULT_PENALTY_CONFIG
  }
}

/**
 * Calculate the one-time late fee for an overdue payment.
 */
export function calculateLateFee(
  config: PenaltyConfig,
  overdueAmount: number,
  daysOverdue: number,
): number {
  if (!config.enabled || !config.lateFee.enabled) return 0
  if (daysOverdue <= config.gracePeriodDays) return 0

  if (config.lateFee.type === "fixed") {
    return config.lateFee.amount
  }
  // percentage
  return overdueAmount * (config.lateFee.amount / 100)
}

/**
 * Calculate accumulated daily penalty interest for an overdue payment.
 */
export function calculateDailyPenaltyInterest(
  config: PenaltyConfig,
  overdueAmount: number,
  daysOverdue: number,
): number {
  if (!config.enabled || !config.dailyPenaltyInterest.enabled) return 0
  if (daysOverdue <= config.gracePeriodDays) return 0

  const applicableDays = Math.min(
    daysOverdue - config.gracePeriodDays,
    config.dailyPenaltyInterest.maxDays,
  )

  return overdueAmount * (config.dailyPenaltyInterest.ratePerDay / 100) * applicableDays
}

/**
 * How much penalty budget remains before the cap is hit.
 */
export function getRemainingPenaltyBudget(
  config: PenaltyConfig,
  principal: number,
  totalApplied: number,
): number {
  const cap =
    config.penaltyCap.type === "percentage"
      ? principal * (config.penaltyCap.amount / 100)
      : config.penaltyCap.amount

  return Math.max(0, cap - totalApplied)
}

export interface SuggestedPenalty {
  lateFee: number
  dailyInterest: number
  total: number
  cappedTotal: number
  budgetRemaining: number
  wouldExceedCap: boolean
}

/**
 * Full suggestion with cap enforcement.
 * existingPending = sum of pending (not yet applied) penalty amounts for this loan.
 */
export function calculateSuggestedPenalty(
  config: PenaltyConfig,
  overdueAmount: number,
  daysOverdue: number,
  principal: number,
  totalApplied: number,
  existingPending: number,
): SuggestedPenalty {
  const lateFee = calculateLateFee(config, overdueAmount, daysOverdue)
  const dailyInterest = calculateDailyPenaltyInterest(config, overdueAmount, daysOverdue)
  const total = lateFee + dailyInterest
  const budgetRemaining = getRemainingPenaltyBudget(config, principal, totalApplied)
  const effectiveBudget = Math.max(0, budgetRemaining - existingPending)
  const cappedTotal = Math.min(total, effectiveBudget)
  const wouldExceedCap = total > effectiveBudget

  return {
    lateFee,
    dailyInterest,
    total,
    cappedTotal,
    budgetRemaining,
    wouldExceedCap,
  }
}

/**
 * Human-readable string for disclosure.
 */
export function formatPenaltyForDisclosure(config: PenaltyConfig): string {
  if (!config.enabled) return "None"

  const parts: string[] = []

  if (config.lateFee.enabled) {
    const feeStr =
      config.lateFee.type === "fixed"
        ? `₱${config.lateFee.amount.toLocaleString()}`
        : `${config.lateFee.amount}% of overdue amount`
    parts.push(
      `Late fee of ${feeStr} after ${config.gracePeriodDays} day${config.gracePeriodDays !== 1 ? "s" : ""} grace period`,
    )
  }

  if (config.dailyPenaltyInterest.enabled) {
    parts.push(
      `${config.dailyPenaltyInterest.ratePerDay}% per day penalty interest starting ${config.gracePeriodDays} day${config.gracePeriodDays !== 1 ? "s" : ""} after due date (max ${config.dailyPenaltyInterest.maxDays} days)`,
    )
  }

  if (parts.length === 0) return "None"

  const capStr =
    config.penaltyCap.type === "percentage"
      ? `${config.penaltyCap.amount}% of principal`
      : `₱${config.penaltyCap.amount.toLocaleString()}`
  parts.push(`Total penalties capped at ${capStr}`)

  return parts.join(". ") + "."
}

/**
 * Format daily interest details for disclosure row 14.
 */
export function formatDailyInterestForDisclosure(config: PenaltyConfig): string {
  if (!config.enabled || !config.dailyPenaltyInterest.enabled) return "None"

  return `${config.dailyPenaltyInterest.ratePerDay}% per day penalty interest starting ${config.gracePeriodDays} day${config.gracePeriodDays !== 1 ? "s" : ""} after due date, up to ${config.dailyPenaltyInterest.maxDays} days maximum`
}
