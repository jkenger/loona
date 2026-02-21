/**
 * Shared overdue + penalty processing logic. Server-only — no session required.
 * Used by the cron endpoint and dashboard fallback (via updateOverduePayments).
 */
import { db, paymentSchedule, loans, contacts, user } from "@/lib/db"
import { eq, and, lte } from "drizzle-orm"
import { sendEmail, paymentReminderEmail } from "@/lib/email"
import { getEffectivePenaltyConfig } from "@/lib/constants/penalty-defaults"
import { ensurePendingPenalties } from "./penalty-generation"

/**
 * Mark overdue payments and generate penalties for ALL lenders.
 * No session required — used by cron and dashboard fallback.
 */
export async function processOverdueAndPenalties() {
  const now = new Date()

  // 1. Query items about to become overdue (before updating status)
  const newlyOverdue = await db
    .select({
      scheduleId: paymentSchedule.id,
      amount: paymentSchedule.amount,
      dueDate: paymentSchedule.dueDate,
      borrowerName: contacts.name,
      borrowerEmail: contacts.email,
      lenderName: user.name,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .innerJoin(contacts, eq(loans.contactId, contacts.id))
    .innerJoin(user, eq(loans.lenderId, user.id))
    .where(
      and(eq(paymentSchedule.status, "pending"), lte(paymentSchedule.dueDate, now))
    )

  // 2. Send overdue reminder emails (fire-and-forget, don't block cron)
  const formatPHP = (amount: string) =>
    `₱${parseFloat(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  for (const item of newlyOverdue) {
    if (!item.borrowerEmail) continue
    const emailContent = paymentReminderEmail({
      borrowerName: item.borrowerName,
      lenderName: item.lenderName || 'Your lender',
      amount: formatPHP(item.amount),
      dueDate: item.dueDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    })
    sendEmail({ to: item.borrowerEmail, ...emailContent }).catch((err) => {
      console.error('[Email] Payment reminder failed for', item.borrowerEmail, err)
    })
  }

  // 3. Mark pending schedule items as overdue
  await db
    .update(paymentSchedule)
    .set({ status: "overdue" })
    .where(
      and(eq(paymentSchedule.status, "pending"), lte(paymentSchedule.dueDate, now))
    )

  // 4. Generate penalties — each loan's own snapshot config decides
  const activeLoans = await db.query.loans.findMany({
    where: eq(loans.status, "active"),
    with: {
      schedule: true,
      penalties: true,
    },
  })

  for (const loan of activeLoans) {
    const config = getEffectivePenaltyConfig(loan.penaltyConfig)
    if (!config.enabled) continue
    await ensurePendingPenalties(loan, config, loan.penalties)
  }
}
