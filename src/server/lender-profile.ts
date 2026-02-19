import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { db, user, loans, penaltySettings } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { requireAuth } from "./session"
import { parsePenaltyConfig } from "@/lib/constants/penalty-defaults"

// ============================================================================
// Public — no auth required
// ============================================================================

export const getPublicLenderProfile = createServerFn()
  .inputValidator((d: string) => d)
  .handler(async ({ data: userId }) => {
    const lender = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: {
        id: true,
        name: true,
        websiteUrl: true,
        facebookUrl: true,
        createdAt: true,
      },
    })

    if (!lender) return null

    // Penalty settings
    const penaltyRow = await db.query.penaltySettings.findFirst({
      where: eq(penaltySettings.lenderId, userId),
    })
    const penaltyConfig = parsePenaltyConfig(penaltyRow?.config ?? null)

    // Active loans count
    const activeLoans = await db.query.loans.findMany({
      where: and(
        eq(loans.lenderId, userId),
        eq(loans.status, "active"),
      ),
      columns: { id: true },
    })

    // Completed loans
    const completedLoans = await db.query.loans.findMany({
      where: and(
        eq(loans.lenderId, userId),
        eq(loans.status, "completed"),
      ),
      columns: {
        principal: true,
        interestRate: true,
        termMonths: true,
        paymentFrequency: true,
      },
    })

    // Derive typical packages by grouping on (interestRate, termMonths, paymentFrequency)
    const groupMap = new Map<string, { interestRate: string; termMonths: number; paymentFrequency: string; principals: number[] }>()

    for (const loan of completedLoans) {
      const key = `${loan.interestRate}|${loan.termMonths}|${loan.paymentFrequency}`
      let group = groupMap.get(key)
      if (!group) {
        group = {
          interestRate: loan.interestRate,
          termMonths: loan.termMonths,
          paymentFrequency: loan.paymentFrequency,
          principals: [],
        }
        groupMap.set(key, group)
      }
      group.principals.push(parseFloat(loan.principal))
    }

    // Sort by count desc, take top 5
    const packages = Array.from(groupMap.values())
      .sort((a, b) => b.principals.length - a.principals.length)
      .slice(0, 5)
      .map((g) => {
        const sorted = g.principals.slice().sort((a, b) => a - b)
        const mid = Math.floor(sorted.length / 2)
        const median = sorted.length % 2 !== 0
          ? sorted[mid]
          : (sorted[mid - 1] + sorted[mid]) / 2

        return {
          interestRate: g.interestRate,
          termMonths: g.termMonths,
          paymentFrequency: g.paymentFrequency,
          loanCount: g.principals.length,
          typicalPrincipal: median,
        }
      })

    return {
      lenderName: lender.name,
      websiteUrl: lender.websiteUrl,
      facebookUrl: lender.facebookUrl,
      memberSince: lender.createdAt.toISOString(),
      totalActiveLoans: activeLoans.length,
      totalCompletedLoans: completedLoans.length,
      penaltyConfig,
      packages,
    }
  })

// ============================================================================
// Authenticated — current user's profile links
// ============================================================================

export const getLenderProfileLinks = createServerFn().handler(async () => {
  const session = await requireAuth()

  const row = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
    columns: {
      websiteUrl: true,
      facebookUrl: true,
    },
  })

  return {
    websiteUrl: row?.websiteUrl ?? null,
    facebookUrl: row?.facebookUrl ?? null,
  }
})

const profileLinksSchema = z.object({
  websiteUrl: z.string().url().or(z.literal("")).optional().nullable(),
  facebookUrl: z.string().url().or(z.literal("")).optional().nullable(),
})

export const saveLenderProfileLinks = createServerFn()
  .inputValidator((d: z.infer<typeof profileLinksSchema>) => profileLinksSchema.parse(d))
  .handler(async ({ data }) => {
    const session = await requireAuth()

    await db
      .update(user)
      .set({
        websiteUrl: data.websiteUrl || null,
        facebookUrl: data.facebookUrl || null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, session.user.id))

    return { success: true }
  })
