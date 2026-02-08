import { createServerFn } from "@tanstack/react-start"
import { db, commissionSettings, agents } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { requireAuth } from "./session"
import { createAuditLogger } from "./audit"
import { hasRole, ROLES } from "@/lib/constants/roles"
import {
  parseCommissionConfig,
  commissionProgramConfigSchema,
} from "@/lib/constants/commission-defaults"

// ============================================================================
// Commission Settings Server Functions
// ============================================================================

/**
 * Get commission settings for the current lender (or defaults if none saved)
 */
export const getCommissionSettings = createServerFn().handler(async () => {
  const session = await requireAuth()

  if (!hasRole(session.user.role, ROLES.LENDER)) {
    throw new Error("Forbidden: Lender access required")
  }

  const row = await db.query.commissionSettings.findFirst({
    where: eq(commissionSettings.lenderId, session.user.id),
  })

  return parseCommissionConfig(row?.config ?? null)
})

/**
 * Save commission settings for the current lender (upsert)
 */
export const saveCommissionSettings = createServerFn()
  .inputValidator(commissionProgramConfigSchema)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    if (!hasRole(session.user.role, ROLES.LENDER)) {
      throw new Error("Forbidden: Lender access required")
    }

    const configJson = JSON.stringify(data)

    // Upsert: check if row exists
    const existing = await db.query.commissionSettings.findFirst({
      where: eq(commissionSettings.lenderId, session.user.id),
    })

    if (existing) {
      await db
        .update(commissionSettings)
        .set({ config: configJson, updatedAt: new Date() })
        .where(eq(commissionSettings.id, existing.id))
    } else {
      await db.insert(commissionSettings).values({
        lenderId: session.user.id,
        config: configJson,
      })
    }

    const log = createAuditLogger(session.user)
    log("commission.updateSettings", "commission_settings", session.user.id)

    return { success: true }
  })

/**
 * Get commission programs for all lenders the current agent works for
 * Returns program config + agent's tier per lender relationship
 */
export const getAgentCommissionPrograms = createServerFn().handler(async () => {
  const session = await requireAuth()

  if (!hasRole(session.user.role, ROLES.AGENT)) {
    throw new Error("Forbidden: Agent access required")
  }

  // Get all active agent relationships with lender info
  const relationships = await db.query.agents.findMany({
    where: and(
      eq(agents.agentUserId, session.user.id),
      eq(agents.status, "active"),
    ),
    with: {
      lender: true,
    },
  })

  if (relationships.length === 0) {
    return []
  }

  // Get commission settings for each lender
  const lenderIds = relationships.map((r) => r.lenderId)
  const allSettings = await db.query.commissionSettings.findMany({
    where: eq(commissionSettings.lenderId, lenderIds[0]),
  })

  // If multiple lenders, fetch the rest
  if (lenderIds.length > 1) {
    for (let i = 1; i < lenderIds.length; i++) {
      const s = await db.query.commissionSettings.findFirst({
        where: eq(commissionSettings.lenderId, lenderIds[i]),
      })
      if (s) allSettings.push(s)
    }
  }

  const settingsMap = new Map(allSettings.map((s) => [s.lenderId, s]))

  return relationships.map((rel) => {
    const settings = settingsMap.get(rel.lenderId)
    const config = parseCommissionConfig(settings?.config ?? null)

    return {
      agentId: rel.id,
      lenderName: rel.lender.name,
      lenderEmail: rel.lender.email,
      tier: rel.tier,
      commissionRate: rel.commissionRate,
      config,
    }
  })
})
