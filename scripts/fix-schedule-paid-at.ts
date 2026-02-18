/**
 * Fix paidAt on payment_schedule items.
 *
 * Problem: Kapita migration set the same paidAt (lastPaymentAt) for ALL schedule
 * items on a loan, even when individual payments were made on different dates.
 *
 * Strategy per loan:
 *   1. Gather schedule items (sorted by dueDate) and payments (sorted by paidAt).
 *   2. For items with directly-linked payments (post-migration), set paidAt to the
 *      latest linked payment's paidAt.
 *   3. For remaining "paid"/"partial" items with no linked payments, walk through
 *      unlinked payments chronologically, allocating amounts to schedule items in
 *      due-date order. The paidAt is the date of the payment that pushed the item
 *      to fully-paid (or the latest contributing payment for partial items).
 *   4. Write updates in a single batch per loan.
 *
 * Usage: npx tsx scripts/fix-schedule-paid-at.ts [--dry-run]
 */

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "../src/lib/db/schema"
import { eq, asc } from "drizzle-orm"
import "dotenv/config"

const isDryRun = process.argv.includes("--dry-run")

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

async function main() {
  console.log(`\n=== Fix schedule paidAt ${isDryRun ? "(DRY RUN)" : ""} ===\n`)

  // Get all loans that have at least one paid/partial schedule item
  const allLoans = await db.query.loans.findMany({
    columns: { id: true },
    with: {
      schedule: {
        orderBy: [asc(schema.paymentSchedule.dueDate)],
      },
      payments: {
        orderBy: [asc(schema.payments.paidAt)],
      },
    },
  })

  let totalUpdated = 0
  let totalSkipped = 0
  let loansProcessed = 0

  for (const loan of allLoans) {
    const items = loan.schedule
    const allPayments = loan.payments.filter(
      (p) => p.type === "credit" && !p.reversedAt,
    )

    if (items.length === 0 || allPayments.length === 0) continue

    // Split payments into linked (have scheduleItemId) and unlinked (migrated)
    const linkedPayments = allPayments.filter((p) => p.scheduleItemId !== null)
    const unlinkedPayments = allPayments.filter((p) => p.scheduleItemId === null)

    // Build a map: scheduleItemId → latest linked payment date
    const linkedPaidAtMap = new Map<string, Date>()
    for (const p of linkedPayments) {
      const existing = linkedPaidAtMap.get(p.scheduleItemId!)
      if (!existing || p.paidAt > existing) {
        linkedPaidAtMap.set(p.scheduleItemId!, p.paidAt)
      }
    }

    // For unlinked payments, simulate allocation in due-date order
    // Track running paid amounts and the date of the completing payment
    const unlinkedPaidAtMap = new Map<string, Date>()

    if (unlinkedPayments.length > 0) {
      // Running totals per schedule item from unlinked payments only
      const runningPaid = new Map<string, number>()
      // Amount already covered by linked payments per item
      const linkedCoverage = new Map<string, number>()

      for (const p of linkedPayments) {
        if (p.scheduleItemId) {
          const prev = linkedCoverage.get(p.scheduleItemId) || 0
          linkedCoverage.set(p.scheduleItemId, prev + parseFloat(p.amount))
        }
      }

      // Walk unlinked payments chronologically, allocate to items in due-date order
      let paymentIdx = 0
      let remainingFromPayment = 0
      let currentPaymentDate: Date | null = null

      for (const item of items) {
        if (item.status === "pending" || item.status === "overdue") continue

        const itemAmount = parseFloat(item.amount)
        const alreadyCoveredByLinked = linkedCoverage.get(item.id) || 0
        let needed = itemAmount - alreadyCoveredByLinked

        if (needed <= 0) continue // Fully covered by linked payments

        let latestContributingDate: Date | null = null

        while (needed > 0.01 && paymentIdx < unlinkedPayments.length) {
          if (remainingFromPayment <= 0.01) {
            // Move to next unlinked payment
            if (paymentIdx >= unlinkedPayments.length) break
            remainingFromPayment = parseFloat(unlinkedPayments[paymentIdx].amount)
            currentPaymentDate = unlinkedPayments[paymentIdx].paidAt
            if (remainingFromPayment <= 0.01) {
              paymentIdx++
              continue
            }
          }

          const applied = Math.min(needed, remainingFromPayment)
          needed -= applied
          remainingFromPayment -= applied
          latestContributingDate = currentPaymentDate

          if (remainingFromPayment <= 0.01) {
            paymentIdx++
          }
        }

        if (latestContributingDate) {
          unlinkedPaidAtMap.set(item.id, latestContributingDate)
        }
      }
    }

    // Determine final paidAt for each item and collect updates
    const updates: { id: string; paidAt: Date }[] = []

    for (const item of items) {
      if (item.status !== "paid" && item.status !== "partial") continue

      // Priority: linked payment date > unlinked allocation date > keep existing
      const linkedDate = linkedPaidAtMap.get(item.id)
      const unlinkedDate = unlinkedPaidAtMap.get(item.id)

      let newPaidAt: Date | null = null

      if (linkedDate && unlinkedDate) {
        // Both contributed — use the later date (the one that completed payment)
        newPaidAt = linkedDate > unlinkedDate ? linkedDate : unlinkedDate
      } else if (linkedDate) {
        newPaidAt = linkedDate
      } else if (unlinkedDate) {
        newPaidAt = unlinkedDate
      }

      if (!newPaidAt) continue

      // Only update if different from current
      const currentPaidAt = item.paidAt
      if (
        currentPaidAt &&
        new Date(currentPaidAt).toDateString() === newPaidAt.toDateString()
      ) {
        totalSkipped++
        continue
      }

      updates.push({ id: item.id, paidAt: newPaidAt })
    }

    if (updates.length > 0) {
      loansProcessed++
      console.log(
        `Loan ${loan.id}: ${updates.length} schedule item(s) to fix`,
      )

      for (const u of updates) {
        const item = items.find((i) => i.id === u.id)
        console.log(
          `  ${item?.dueDate.toLocaleDateString()} | ${item?.paidAt?.toLocaleDateString() ?? "null"} → ${u.paidAt.toLocaleDateString()}`,
        )
      }

      if (!isDryRun) {
        for (const u of updates) {
          await db
            .update(schema.paymentSchedule)
            .set({ paidAt: u.paidAt })
            .where(eq(schema.paymentSchedule.id, u.id))
        }
      }

      totalUpdated += updates.length
    }
  }

  console.log(`\n--- Summary ---`)
  console.log(`Loans processed: ${loansProcessed}`)
  console.log(`Schedule items updated: ${totalUpdated}`)
  console.log(`Schedule items skipped (already correct): ${totalSkipped}`)
  if (isDryRun) {
    console.log(`\n(Dry run — no changes written. Remove --dry-run to apply.)`)
  }
}

main().catch(console.error)
