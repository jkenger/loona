import { createServerFn } from "@tanstack/react-start"
import { db, penaltySettings } from "@/lib/db"
import { eq } from "drizzle-orm"
import { requireAuth } from "./session"
import { createAuditLogger } from "./audit"
import { hasRole, ROLES } from "@/lib/constants/roles"
import {
  parsePenaltyConfig,
  penaltyConfigSchema,
} from "@/lib/constants/penalty-defaults"

// ============================================================================
// Penalty Settings Server Functions
// ============================================================================

/**
 * Get penalty settings for the current lender (or defaults if none saved)
 */
export const getPenaltySettings = createServerFn().handler(async () => {
  const session = await requireAuth()

  if (!hasRole(session.user.role, ROLES.LENDER)) {
    throw new Error("Forbidden: Lender access required")
  }

  const row = await db.query.penaltySettings.findFirst({
    where: eq(penaltySettings.lenderId, session.user.id),
  })

  return parsePenaltyConfig(row?.config ?? null)
})

/**
 * Save penalty settings for the current lender (upsert)
 */
export const savePenaltySettings = createServerFn()
  .inputValidator(penaltyConfigSchema)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    if (!hasRole(session.user.role, ROLES.LENDER)) {
      throw new Error("Forbidden: Lender access required")
    }

    const configJson = JSON.stringify(data)

    // Upsert: check if row exists
    const existing = await db.query.penaltySettings.findFirst({
      where: eq(penaltySettings.lenderId, session.user.id),
    })

    if (existing) {
      await db
        .update(penaltySettings)
        .set({ config: configJson, updatedAt: new Date() })
        .where(eq(penaltySettings.id, existing.id))
    } else {
      await db.insert(penaltySettings).values({
        lenderId: session.user.id,
        config: configJson,
      })
    }

    const log = createAuditLogger(session.user)
    log("penalty.updateSettings", "penalty_settings", session.user.id)

    return { success: true }
  })
