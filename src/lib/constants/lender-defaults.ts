import { z } from "zod"

// ============================================================================
// Lender Config Types
// ============================================================================

export interface LenderConfig {
  initialCapital: number
  // Borrower notifications
  paymentReceiptsEnabled: boolean
  overdueAlertsEnabled: boolean
  overdueAlertDaysBefore: number
  overdueAlertDaysAfter: number
  // Lender notifications
  lenderPaymentNotificationsEnabled: boolean
  lenderDocumentNotificationsEnabled: boolean
  lenderPenaltyNotificationsEnabled: boolean
  lenderDailySummaryEnabled: boolean
  // Agent notifications
  agentNotificationsEnabled: boolean
  // Onboarding
  notificationOnboardingSeen: boolean
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
  lenderPaymentNotificationsEnabled: z.boolean().default(false),
  lenderDocumentNotificationsEnabled: z.boolean().default(false),
  lenderPenaltyNotificationsEnabled: z.boolean().default(false),
  lenderDailySummaryEnabled: z.boolean().default(false),
  agentNotificationsEnabled: z.boolean().default(false),
  notificationOnboardingSeen: z.boolean().default(false),
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
  lenderPaymentNotificationsEnabled: false,
  lenderDocumentNotificationsEnabled: false,
  lenderPenaltyNotificationsEnabled: false,
  lenderDailySummaryEnabled: false,
  agentNotificationsEnabled: false,
  notificationOnboardingSeen: false,
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
