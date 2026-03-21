import { db, paymentSchedule, loans } from "@/lib/db"
import { eq, and, inArray, sql } from "drizzle-orm"
import { parseLenderConfig } from "@/lib/constants/lender-defaults"
import { sendEmail, overdueAlertEmail } from "@/lib/email"

// Days relative to due date to send reminders: -3 = 3 days before, 0 = on due date, +3 = 3 days after
const REMINDER_DAYS = [-3, 0, 3] as const

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export async function sendOverdueAlerts() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Find all lenders with overdueAlertsEnabled
  const allSettings = await db.query.lenderSettings.findMany()
  const enabledLenderIds = allSettings
    .filter((row) => parseLenderConfig(row.config).overdueAlertsEnabled)
    .map((row) => row.lenderId)

  if (enabledLenderIds.length === 0) {
    return { sent: 0, skipped: 0 }
  }

  let sent = 0
  let skipped = 0

  for (const days of REMINDER_DAYS) {
    const targetDate = new Date(today)
    targetDate.setDate(today.getDate() + days)
    const targetDateStr = toDateString(targetDate)

    // Find pending schedule items due on targetDate for enabled lenders
    const items = await db.query.paymentSchedule.findMany({
      where: and(
        sql`date(${paymentSchedule.dueDate}) = ${targetDateStr}`,
        inArray(
          paymentSchedule.loanId,
          db.select({ id: loans.id })
            .from(loans)
            .where(and(
              eq(loans.status, "active"),
              inArray(loans.lenderId, enabledLenderIds),
            ))
        ),
        eq(paymentSchedule.status, "pending"),
      ),
      with: {
        loan: {
          with: {
            contact: true,
            lender: true,
          },
        },
      },
    })

    for (const item of items) {
      const contact = item.loan.contact
      const lender = item.loan.lender

      if (!contact?.email) {
        skipped++
        continue
      }

      // Check which reminder column to use and whether already sent
      const alreadySent =
        days === -3 ? !!item.reminderBeforeSentAt :
        days === 0 ? !!item.reminderOnSentAt :
        !!item.reminderAfterSentAt

      if (alreadySent) {
        skipped++
        continue
      }

      const dueDateFormatted = new Date(item.dueDate).toLocaleDateString("en-PH", {
        year: "numeric", month: "long", day: "numeric",
      })

      const { subject, html, text } = overdueAlertEmail({
        borrowerName: contact.name,
        lenderName: lender.name,
        dueDate: dueDateFormatted,
        amountDue: parseFloat(item.amount).toFixed(2),
        loanReference: item.loanId.slice(0, 8).toUpperCase(),
        daysRelative: days,
      })

      try {
        await sendEmail({ to: contact.email, subject, html, text })

        // Mark as sent
        const updateField =
          days === -3 ? { reminderBeforeSentAt: new Date() } :
          days === 0 ? { reminderOnSentAt: new Date() } :
          { reminderAfterSentAt: new Date() }

        await db.update(paymentSchedule)
          .set(updateField)
          .where(eq(paymentSchedule.id, item.id))

        sent++
      } catch {
        skipped++
      }
    }
  }

  return { sent, skipped }
}
