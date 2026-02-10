import { z } from "zod"

// ============================================================================
// Lender Config Types
// ============================================================================

export interface LenderConfig {
  initialCapital: number
}

// ============================================================================
// Zod Schema
// ============================================================================

export const lenderConfigSchema = z.object({
  initialCapital: z.number().min(0).max(999_999_999),
})

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_LENDER_CONFIG: LenderConfig = {
  initialCapital: 0,
}

// ============================================================================
// Helpers
// ============================================================================

export function parseLenderConfig(json: string | null): LenderConfig {
  if (!json) return DEFAULT_LENDER_CONFIG
  try {
    const parsed = JSON.parse(json)
    const result = lenderConfigSchema.safeParse(parsed)
    if (result.success) return result.data
    return DEFAULT_LENDER_CONFIG
  } catch {
    return DEFAULT_LENDER_CONFIG
  }
}
