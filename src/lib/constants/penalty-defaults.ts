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
// Frequency Scaling
// ============================================================================

export type PaymentFrequency = "daily" | "weekly" | "biweekly" | "semimonthly" | "monthly"

/**
 * Divisor to scale penalty amounts by payment frequency.
 * Lenders set penalties as a "monthly equivalent" — the system divides by the
 * divisor so total penalty exposure is roughly the same regardless of frequency.
 */
export function frequencyDivisor(frequency?: PaymentFrequency | string | null): number {
  switch (frequency) {
    case "daily": return 30
    case "weekly": return 4
    case "biweekly": return 2
    case "semimonthly": return 2
    case "monthly":
    default: return 1
  }
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

/**
 * Resolve effective penalty config: prefer loan-level snapshot, fall back to global settings.
 */
export function getEffectivePenaltyConfig(
  loanSnapshot: string | null,
  _globalSettingsJson?: string | null,
): PenaltyConfig {
  // Only use the loan-level snapshot. If no snapshot was saved at loan creation,
  // penalties are disabled for that loan. The global config is only used for
  // prefilling the loan wizard — never retroactively applied to existing loans.
  return parsePenaltyConfig(loanSnapshot)
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
 * When paymentFrequency is provided, the result is scaled down so that
 * weekly/daily borrowers aren't penalised disproportionately.
 */
export function calculateLateFee(
  config: PenaltyConfig,
  overdueAmount: number,
  daysOverdue: number,
  paymentFrequency?: PaymentFrequency | string | null,
): number {
  if (!config.enabled || !config.lateFee.enabled) return 0
  if (daysOverdue <= config.gracePeriodDays) return 0

  const divisor = frequencyDivisor(paymentFrequency)

  if (config.lateFee.type === "fixed") {
    return config.lateFee.amount / divisor
  }
  // percentage
  return (overdueAmount * (config.lateFee.amount / 100)) / divisor
}

/**
 * Calculate accumulated daily penalty interest for an overdue payment.
 * When paymentFrequency is provided, the per-day amount is scaled down so that
 * weekly/daily borrowers aren't penalised disproportionately.
 */
export function calculateDailyPenaltyInterest(
  config: PenaltyConfig,
  overdueAmount: number,
  daysOverdue: number,
  paymentFrequency?: PaymentFrequency | string | null,
): number {
  if (!config.enabled || !config.dailyPenaltyInterest.enabled) return 0
  if (daysOverdue <= config.gracePeriodDays) return 0

  const applicableDays = Math.min(
    daysOverdue - config.gracePeriodDays,
    config.dailyPenaltyInterest.maxDays,
  )

  const divisor = frequencyDivisor(paymentFrequency)
  return (overdueAmount * (config.dailyPenaltyInterest.ratePerDay / 100) * applicableDays) / divisor
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
  paymentFrequency?: PaymentFrequency | string | null,
): SuggestedPenalty {
  const lateFee = calculateLateFee(config, overdueAmount, daysOverdue, paymentFrequency)
  const dailyInterest = calculateDailyPenaltyInterest(config, overdueAmount, daysOverdue, paymentFrequency)
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

// ============================================================================
// Penalty Calculation Metadata
// ============================================================================

export interface PenaltyMetadata {
  overdueAmount: number
  daysOverdue: number
  gracePeriodDays: number
  // Late fee specific
  feeType?: "fixed" | "percentage"
  feeConfigAmount?: number
  // Daily interest specific
  ratePerDay?: number
  applicableDays?: number
  maxDays?: number
  // Frequency scaling (divisor > 1 means amount was scaled down)
  frequencyDivisor?: number
  paymentFrequency?: string
}

/**
 * Format a human-readable calculation breakdown from stored metadata.
 */
export function formatPenaltyCalculation(
  metadata: PenaltyMetadata,
  penaltyType: string,
): string {
  const amt = `₱${metadata.overdueAmount.toLocaleString()}`
  const divisor = metadata.frequencyDivisor ?? 1
  const freqLabel = divisor > 1 && metadata.paymentFrequency
    ? ` ÷ ${divisor} (${metadata.paymentFrequency})`
    : ""

  if (penaltyType === "late_fee") {
    if (metadata.feeType === "fixed") {
      return `${amt} overdue × fixed ₱${(metadata.feeConfigAmount ?? 0).toLocaleString()}${freqLabel}`
    }
    return `${amt} overdue × ${metadata.feeConfigAmount ?? 0}%${freqLabel}`
  }

  // daily_interest
  const days = metadata.applicableDays ?? 0
  const rate = metadata.ratePerDay ?? 0
  return `${amt} overdue × ${rate}%/day × ${days}d${freqLabel}`
}

/**
 * Format the grace/overdue context line.
 */
export function formatPenaltyContext(metadata: PenaltyMetadata): string {
  return `${metadata.gracePeriodDays}d grace, ${metadata.daysOverdue}d overdue`
}

/**
 * Safely parse a penalty metadata JSON string.
 */
export function parsePenaltyMetadata(json: string | null): PenaltyMetadata | null {
  if (!json) return null
  try {
    return JSON.parse(json) as PenaltyMetadata
  } catch {
    return null
  }
}

// ============================================================================
// Frequency Scaling Descriptions
// ============================================================================

export interface FrequencyScaledPreview {
  /** e.g. "₱50" or "1.25%" */
  scaledValue: string
  /** e.g. "₱200 ÷ 4 for weekly" */
  explanation: string
  /** The numeric divisor used */
  divisor: number
}

/**
 * Describe how the late fee scales for a given frequency.
 * Returns null when no scaling applies (monthly or disabled).
 */
export function getLateFeePreview(
  config: PenaltyConfig,
  frequency?: PaymentFrequency | string | null,
): FrequencyScaledPreview | null {
  const divisor = frequencyDivisor(frequency)
  if (divisor <= 1 || !config.lateFee.enabled || config.lateFee.amount <= 0) return null

  const freqName = frequency ?? "monthly"

  if (config.lateFee.type === "fixed") {
    const scaled = config.lateFee.amount / divisor
    return {
      scaledValue: `₱${scaled.toLocaleString()}`,
      explanation: `₱${config.lateFee.amount.toLocaleString()} ÷ ${divisor} for ${freqName}`,
      divisor,
    }
  }

  const scaled = config.lateFee.amount / divisor
  return {
    scaledValue: `${scaled.toFixed(2)}%`,
    explanation: `${config.lateFee.amount}% ÷ ${divisor} for ${freqName}`,
    divisor,
  }
}

/**
 * Describe how daily penalty interest scales for a given frequency.
 * Returns null when no scaling applies (monthly or disabled).
 */
export function getDailyInterestPreview(
  config: PenaltyConfig,
  frequency?: PaymentFrequency | string | null,
): FrequencyScaledPreview | null {
  const divisor = frequencyDivisor(frequency)
  if (divisor <= 1 || !config.dailyPenaltyInterest.enabled || config.dailyPenaltyInterest.ratePerDay <= 0) return null

  const freqName = frequency ?? "monthly"
  const scaled = config.dailyPenaltyInterest.ratePerDay / divisor

  return {
    scaledValue: `${scaled.toFixed(3)}%/day`,
    explanation: `${config.dailyPenaltyInterest.ratePerDay}%/day ÷ ${divisor} for ${freqName}`,
    divisor,
  }
}

/**
 * Human-readable string for disclosure.
 */
export function formatPenaltyForDisclosure(
  config: PenaltyConfig,
  paymentFrequency?: PaymentFrequency | string | null,
): string {
  if (!config.enabled) return "None"

  const parts: string[] = []

  if (config.lateFee.enabled) {
    const feeStr =
      config.lateFee.type === "fixed"
        ? `₱${config.lateFee.amount.toLocaleString()}`
        : `${config.lateFee.amount}% of overdue amount`
    let line = `Late fee of ${feeStr} after ${config.gracePeriodDays} day${config.gracePeriodDays !== 1 ? "s" : ""} grace period`
    const preview = getLateFeePreview(config, paymentFrequency)
    if (preview) {
      line += ` (${preview.scaledValue} per installment)`
    }
    parts.push(line)
  }

  if (config.dailyPenaltyInterest.enabled) {
    let line = `${config.dailyPenaltyInterest.ratePerDay}% per day penalty interest starting ${config.gracePeriodDays} day${config.gracePeriodDays !== 1 ? "s" : ""} after due date (max ${config.dailyPenaltyInterest.maxDays} days)`
    const preview = getDailyInterestPreview(config, paymentFrequency)
    if (preview) {
      line += ` (${preview.scaledValue} per installment)`
    }
    parts.push(line)
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
