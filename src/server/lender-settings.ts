import { createServerFn } from "@tanstack/react-start"
import { db, lenderSettings, loans } from "@/lib/db"
import { eq, sql } from "drizzle-orm"
import { requireAuth } from "./session"
import { createAuditLogger } from "./audit"
import { hasRole, ROLES } from "@/lib/constants/roles"
import {
  parseLenderConfig,
  lenderConfigSchema,
} from "@/lib/constants/lender-defaults"

// ============================================================================
// Lender Settings Server Functions
// ============================================================================

/**
 * Get lender settings for the current lender (or defaults if none saved)
 */
export const getLenderSettings = createServerFn().handler(async () => {
  const session = await requireAuth()

  if (!hasRole(session.user.role, ROLES.LENDER)) {
    throw new Error("Forbidden: Lender access required")
  }

  const row = await db.query.lenderSettings.findFirst({
    where: eq(lenderSettings.lenderId, session.user.id),
  })

  return parseLenderConfig(row?.config ?? null)
})

/**
 * Lightweight cash position data for the nav wallet display
 */
export const getCashPosition = createServerFn().handler(async () => {
  const session = await requireAuth()

  if (!hasRole(session.user.role, ROLES.LENDER)) {
    return null
  }

  const row = await db.query.lenderSettings.findFirst({
    where: eq(lenderSettings.lenderId, session.user.id),
  })
  const config = parseLenderConfig(row?.config ?? null)

  if (config.initialCapital === 0) {
    return { initialCapital: 0, totalDisbursed: "0", totalCollected: "0", cashAvailable: 0 }
  }

  const totals = await db
    .select({
      totalDisbursed: sql<string>`coalesce(sum(${loans.principal}), 0)`,
      totalCollected: sql<string>`coalesce(sum(${loans.amountPaid}), 0)`,
    })
    .from(loans)
    .where(eq(loans.lenderId, session.user.id))

  const totalDisbursed = totals[0]?.totalDisbursed ?? "0"
  const totalCollected = totals[0]?.totalCollected ?? "0"
  const cashAvailable = config.initialCapital - parseFloat(totalDisbursed) + parseFloat(totalCollected)

  return { initialCapital: config.initialCapital, totalDisbursed, totalCollected, cashAvailable }
})

/**
 * Save lender settings for the current lender (upsert)
 */
export const saveLenderSettings = createServerFn()
  .inputValidator(lenderConfigSchema)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    if (!hasRole(session.user.role, ROLES.LENDER)) {
      throw new Error("Forbidden: Lender access required")
    }

    const configJson = JSON.stringify(data)

    // Upsert: check if row exists
    const existing = await db.query.lenderSettings.findFirst({
      where: eq(lenderSettings.lenderId, session.user.id),
    })

    if (existing) {
      await db
        .update(lenderSettings)
        .set({ config: configJson, updatedAt: new Date() })
        .where(eq(lenderSettings.id, existing.id))
    } else {
      await db.insert(lenderSettings).values({
        lenderId: session.user.id,
        config: configJson,
      })
    }

    const log = createAuditLogger(session.user)
    log("lender.updateSettings", "lender_settings", session.user.id)

    return { success: true }
  })
