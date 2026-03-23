import { db, paymentSchedule, loans } from "@/lib/db"
import { eq, and, inArray, sql } from "drizzle-orm"
import { parseLenderConfig } from "@/lib/constants/lender-defaults"
import { sendEmail, overdueAlertEmail } from "@/lib/email"

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export async function sendOverdueAlerts() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Load all enabled lenders with their configured day offsets
  const allSettings = await db.query.lenderSettings.findMany()
  const enabledLenders = allSettings
    .map((row) => ({ lenderId: row.lenderId, config: parseLenderConfig(row.config) }))
    .filter((r) => r.config.overdueAlertsEnabled)

  if (enabledLenders.length === 0) {
    return { sent: 0, skipped: 0 }
  }

  let sent = 0
  let skipped = 0

  // Process each lender with their own day offsets
  for (const { lenderId, config } of enabledLenders) {
    const reminderDays = [
      -config.overdueAlertDaysBefore, // before
      0,                               // on due date
      config.overdueAlertDaysAfter,    // after
    ] as const

    for (const days of reminderDays) {
      const targetDate = new Date(today)
      targetDate.setDate(today.getDate() + days)
      const targetDateStr = toDateString(targetDate)

      const items = await db.query.paymentSchedule.findMany({
        where: and(
          sql`date(${paymentSchedule.dueDate}) = ${targetDateStr}`,
          inArray(
            paymentSchedule.loanId,
            db.select({ id: loans.id })
              .from(loans)
              .where(and(
                eq(loans.status, "active"),
                eq(loans.lenderId, lenderId),
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

        const alreadySent =
          days < 0 ? !!item.reminderBeforeSentAt :
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

          const updateField =
            days < 0 ? { reminderBeforeSentAt: new Date() } :
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
  }

  return { sent, skipped }
}
