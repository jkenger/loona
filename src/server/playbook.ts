import { createServerFn } from "@tanstack/react-start"
import { eq, and } from "drizzle-orm"
import { z } from "zod"
import { requireAuth } from "./session"
import { createAuditLogger } from "./audit"
import { db, playbookSections, agents } from "@/lib/db"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { PLAYBOOK_SECTION_KEYS } from "@/lib/constants/playbook-sections"

// ============================================================================
// Playbook Server Functions
// ============================================================================

/**
 * Get all playbook sections for the current lender
 */
export const getPlaybook = createServerFn().handler(async () => {
  const session = await requireAuth()

  if (!hasRole(session.user.role, ROLES.LENDER)) {
    throw new Error("Forbidden: Lender access required")
  }

  const rows = await db.query.playbookSections.findMany({
    where: eq(playbookSections.lenderId, session.user.id),
  })

  // Return a map of sectionKey -> { content, contentTl } for easy lookup
  const sections: Record<string, { content: string | null; contentTl: string | null }> = {}
  for (const row of rows) {
    sections[row.sectionKey] = { content: row.content, contentTl: row.contentTl }
  }
  return sections
})

/**
 * Get playbook sections for an agent's lender(s)
 */
export const getPlaybookForAgent = createServerFn().handler(async () => {
  const session = await requireAuth()

  if (!hasRole(session.user.role, ROLES.AGENT)) {
    throw new Error("Forbidden: Agent access required")
  }

  // Get all active lender relationships for this agent
  const agentRelationships = await db.query.agents.findMany({
    where: and(
      eq(agents.agentUserId, session.user.id),
      eq(agents.status, "active")
    ),
    with: {
      lender: true,
    },
  })

  if (agentRelationships.length === 0) {
    return []
  }

  // For each lender, fetch their playbook sections
  const results = await Promise.all(
    agentRelationships.map(async (rel) => {
      const rows = await db.query.playbookSections.findMany({
        where: eq(playbookSections.lenderId, rel.lenderId),
      })

      const sections: Record<string, { content: string | null; contentTl: string | null }> = {}
      for (const row of rows) {
        sections[row.sectionKey] = { content: row.content, contentTl: row.contentTl }
      }

      return {
        lenderId: rel.lenderId,
        lenderName: rel.lender.name,
        sections,
      }
    })
  )

  return results
})

/**
 * Save (upsert) a single playbook section
 */
export const savePlaybookSection = createServerFn()
  .inputValidator(
    z.object({
      sectionKey: z.string().refine((k) => PLAYBOOK_SECTION_KEYS.includes(k), {
        message: "Invalid section key",
      }),
      content: z.string(),
      language: z.enum(["en", "tl"]).default("en"),
    })
  )
  .handler(async ({ data }) => {
    const session = await requireAuth()

    if (!hasRole(session.user.role, ROLES.LENDER)) {
      throw new Error("Forbidden: Lender access required")
    }

    const field = data.language === "tl" ? "contentTl" : "content"

    // Upsert: check if row exists
    const existing = await db.query.playbookSections.findFirst({
      where: and(
        eq(playbookSections.lenderId, session.user.id),
        eq(playbookSections.sectionKey, data.sectionKey)
      ),
    })

    if (existing) {
      await db
        .update(playbookSections)
        .set({ [field]: data.content, updatedAt: new Date() })
        .where(eq(playbookSections.id, existing.id))
    } else {
      await db.insert(playbookSections).values({
        lenderId: session.user.id,
        sectionKey: data.sectionKey,
        [field]: data.content,
      })
    }

    const log = createAuditLogger(session.user)
    log("playbook.updateSection", "playbook_section", session.user.id, {
      sectionKey: data.sectionKey,
      language: data.language,
    })

    return { success: true }
  })
