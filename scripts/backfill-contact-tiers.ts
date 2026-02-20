/**
 * Backfill tier and onTimeRate for all contacts.
 *
 * Populates the cached `tier` and `on_time_rate` columns on the contacts table
 * by resolving each contact's tier from their loan/payment history.
 *
 * Usage: npx tsx scripts/backfill-contact-tiers.ts [--dry-run]
 */

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "../src/lib/db/schema"
import { eq } from "drizzle-orm"
import { calculateOnTimeStats } from "../src/lib/utils/on-time-stats"
import { resolveBorrowerTier } from "../src/lib/utils/renewal-tiers"
import "dotenv/config"

const isDryRun = process.argv.includes("--dry-run")

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

async function main() {
  console.log(`Backfilling contact tiers${isDryRun ? " (DRY RUN)" : ""}...\n`)

  const allContacts = await db.query.contacts.findMany({
    with: {
      loans: {
        with: {
          schedule: true,
        },
      },
    },
  })

  console.log(`Found ${allContacts.length} contacts\n`)

  let updated = 0
  let skipped = 0

  for (const contact of allContacts) {
    const completedLoans = contact.loans.filter((l) => l.status === "completed").length
    const allScheduleItems = contact.loans.flatMap((loan) => loan.schedule)
    const stats = calculateOnTimeStats(allScheduleItems)

    const tierResult = resolveBorrowerTier({
      completedLoans,
      onTimeRate: stats.onTimeRate,
    })

    const currentTier = contact.tier
    const currentRate = contact.onTimeRate ? parseFloat(contact.onTimeRate) : null

    if (currentTier === tierResult.tier && currentRate === stats.onTimeRate) {
      skipped++
      continue
    }

    console.log(
      `  ${contact.name}: ${currentTier ?? "null"} -> ${tierResult.tier}, ` +
      `on-time: ${currentRate ?? "null"}% -> ${stats.onTimeRate}% ` +
      `(${completedLoans} completed, ${contact.loans.length} total)`
    )

    if (!isDryRun) {
      await db
        .update(schema.contacts)
        .set({
          tier: tierResult.tier,
          onTimeRate: stats.onTimeRate.toString(),
          updatedAt: new Date(),
        })
        .where(eq(schema.contacts.id, contact.id))
    }

    updated++
  }

  console.log(`\nDone. Updated: ${updated}, Skipped (no change): ${skipped}`)
  if (isDryRun) {
    console.log("(Dry run — no changes written)")
  }
}

main().catch((err) => {
  console.error("Failed:", err)
  process.exit(1)
})
