import { z } from "zod"

// ============================================================================
// Lender Config Types
// ============================================================================

export interface LenderConfig {
  initialCapital: number
  paymentReceiptsEnabled: boolean
  overdueAlertsEnabled: boolean
  overdueAlertDaysBefore: number
  overdueAlertDaysAfter: number
}

// ============================================================================
// Zod Schema
// ============================================================================

export const lenderConfigSchema = z.object({
  initialCapital: z.number().min(0).max(999_999_999),
  paymentReceiptsEnabled: z.boolean().default(false),
  overdueAlertsEnabled: z.boolean().default(false),
  overdueAlertDaysBefore: z.number().int().min(1).max(30).default(3),
  overdueAlertDaysAfter: z.number().int().min(1).max(30).default(3),
})

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_LENDER_CONFIG: LenderConfig = {
  initialCapital: 0,
  paymentReceiptsEnabled: false,
  overdueAlertsEnabled: false,
  overdueAlertDaysBefore: 3,
  overdueAlertDaysAfter: 3,
}

// ============================================================================
// Helpers
// ============================================================================

export function parseLenderConfig(json: string | null): LenderConfig {
  if (!json) return DEFAULT_LENDER_CONFIG
  try {
    const parsed = JSON.parse(json)
    const result = lenderConfigSchema.safeParse(parsed)
    if (result.success) return { ...DEFAULT_LENDER_CONFIG, ...result.data }
    return DEFAULT_LENDER_CONFIG
  } catch {
    return DEFAULT_LENDER_CONFIG
  }
}
