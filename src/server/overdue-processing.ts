/**
 * Shared overdue + penalty processing logic. Server-only — no session required.
 * Used by the cron endpoint and dashboard fallback (via updateOverduePayments).
 */
import { db, paymentSchedule, loans, penaltySettings } from "@/lib/db"
import { eq, and, lte } from "drizzle-orm"
import { parsePenaltyConfig } from "@/lib/constants/penalty-defaults"
import { ensurePendingPenalties } from "./penalty-generation"

/**
 * Mark overdue payments and generate penalties for ALL lenders.
 * No session required — used by cron and dashboard fallback.
 */
export async function processOverdueAndPenalties() {
  const now = new Date()

  // 1. Mark pending schedule items as overdue
  await db
    .update(paymentSchedule)
    .set({ status: "overdue" })
    .where(
      and(eq(paymentSchedule.status, "pending"), lte(paymentSchedule.dueDate, now))
    )

  // 2. Get all penalty settings (for all lenders who have them)
  const allSettings = await db.query.penaltySettings.findMany()

  for (const settingsRow of allSettings) {
    const config = parsePenaltyConfig(settingsRow.config)
    if (!config.enabled) continue

    // Get active loans for this lender with overdue items
    const activeLoans = await db.query.loans.findMany({
      where: and(
        eq(loans.lenderId, settingsRow.lenderId),
        eq(loans.status, "active"),
      ),
      with: {
        schedule: true,
        penalties: true,
      },
    })

    for (const loan of activeLoans) {
      await ensurePendingPenalties(loan, config, loan.penalties)
    }
  }
}
