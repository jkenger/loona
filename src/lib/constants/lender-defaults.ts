import { z } from "zod"

// ============================================================================
// Lender Config Types
// ============================================================================

export interface LenderConfig {
  initialCapital: number
  paymentReceiptsEnabled: boolean
  overdueAlertsEnabled: boolean
}

// ============================================================================
// Zod Schema
// ============================================================================

export const lenderConfigSchema = z.object({
  initialCapital: z.number().min(0).max(999_999_999),
  paymentReceiptsEnabled: z.boolean().default(false),
  overdueAlertsEnabled: z.boolean().default(false),
})

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_LENDER_CONFIG: LenderConfig = {
  initialCapital: 0,
  paymentReceiptsEnabled: false,
  overdueAlertsEnabled: false,
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
