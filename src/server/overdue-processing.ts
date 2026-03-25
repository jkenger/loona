/**
 * Shared overdue + penalty processing logic. Server-only — no session required.
 * Used by the cron endpoint and dashboard fallback (via updateOverduePayments).
 */
import { db, paymentSchedule, loans, contacts, user, penalties, lenderSettings } from "@/lib/db"
import { eq, and, lte } from "drizzle-orm"
import { sendEmail, paymentReminderEmail, lenderPenaltyAppliedEmail } from "@/lib/email"
import { getEffectivePenaltyConfig, calendarDaysOverdue } from "@/lib/constants/penalty-defaults"
import { ensurePendingPenalties } from "./penalty-generation"
import { parseLenderConfig } from "@/lib/constants/lender-defaults"

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

  // Track penalties before and after to detect new ones
  const penaltyCountsBefore = new Map<string, number>()
  for (const loan of activeLoans) {
    penaltyCountsBefore.set(loan.id, loan.penalties.length)
  }

  for (const loan of activeLoans) {
    const config = getEffectivePenaltyConfig(loan.penaltyConfig)
    if (!config.enabled) continue
    await ensurePendingPenalties(loan, config, loan.penalties)
  }

  // Check for new penalties and notify lenders
  for (const loan of activeLoans) {
    const beforeCount = penaltyCountsBefore.get(loan.id) ?? 0
    const currentPenalties = await db.query.penalties.findMany({
      where: eq(penalties.loanId, loan.id),
    })
    if (currentPenalties.length <= beforeCount) continue

    const newPenalties = currentPenalties.slice(beforeCount)
    const settingsRow = await db.query.lenderSettings.findFirst({
      where: eq(lenderSettings.lenderId, loan.lenderId),
    })
    const lenderConfig = parseLenderConfig(settingsRow?.config ?? null)
    if (!lenderConfig.lenderPenaltyNotificationsEnabled) continue

    const lender = await db.query.user.findFirst({ where: eq(user.id, loan.lenderId) })
    const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, loan.contactId) })
    if (!lender?.email || !contact) continue

    for (const penalty of newPenalties) {
      const scheduleItem = loan.schedule.find((s) => s.id === penalty.scheduleItemId)
      const daysOverdue = scheduleItem ? calendarDaysOverdue(new Date(scheduleItem.dueDate)) : 0
      const { subject, html, text } = lenderPenaltyAppliedEmail({
        lenderName: lender.name,
        borrowerName: contact.name,
        penaltyType: penalty.penaltyType,
        amount: parseFloat(penalty.amount).toFixed(2),
        loanReference: loan.id.slice(0, 8).toUpperCase(),
        daysOverdue,
      })
      sendEmail({ to: lender.email, subject, html, text }).catch(() => {})
    }
  }
}
