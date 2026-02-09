/**
 * Shared penalty generation logic. Server-only — never import from client components.
 * Used by loans.ts, penalties.ts, and payments.ts.
 */
import { db, penalties } from '@/lib/db'
import { eq } from 'drizzle-orm'
import {
  calculateLateFee,
  calculateDailyPenaltyInterest,
  calendarDaysOverdue,
  type PenaltyConfig,
} from '@/lib/constants/penalty-defaults'

/**
 * Ensure pending penalty records exist and are up-to-date for a single loan.
 * Creates late_fee records (once per overdue item) and creates/updates
 * daily_interest records. Idempotent — safe to call on every page load.
 */
export async function ensurePendingPenalties(
  loan: {
    id: string
    principal: string
    schedule: {
      id: string
      status: string
      dueDate: Date
      amount: string
      paidAmount: string
    }[]
  },
  config: PenaltyConfig,
  existingPenalties: {
    id: string
    scheduleItemId: string
    penaltyType: string
    status: string
    amount: string
  }[],
) {
  if (!config.enabled || loan.schedule.every((s) => s.status !== 'overdue'))
    return

  const now = new Date()

  for (const item of loan.schedule) {
    if (item.status !== 'overdue') continue

    const daysOverdue = calendarDaysOverdue(new Date(item.dueDate), now)
    if (daysOverdue <= 0) continue

    const overdueAmount = parseFloat(item.amount) - parseFloat(item.paidAmount)
    if (overdueAmount <= 0) continue

    const itemPenalties = existingPenalties.filter(
      (p) => p.scheduleItemId === item.id,
    )

    // Late fee: create once per item if past grace period
    if (
      config.lateFee.enabled &&
      daysOverdue > config.lateFee.gracePeriodDays
    ) {
      const hasLateFee = itemPenalties.some((p) => p.penaltyType === 'late_fee')
      if (!hasLateFee) {
        const lateFeeAmount = calculateLateFee(
          config,
          overdueAmount,
          daysOverdue,
        )
        if (lateFeeAmount > 0) {
          await db.insert(penalties).values({
            loanId: loan.id,
            scheduleItemId: item.id,
            penaltyType: 'late_fee',
            amount: lateFeeAmount.toFixed(2),
          })
        }
      }
    }

    // Daily interest: create or update one pending record per item
    if (
      config.dailyPenaltyInterest.enabled &&
      daysOverdue > config.dailyPenaltyInterest.startsAfterDays
    ) {
      const pendingDailyInterest = itemPenalties.find(
        (p) => p.penaltyType === 'daily_interest' && p.status === 'pending',
      )
      // Don't recreate if lender already waived or applied daily interest
      const hasDecidedDailyInterest = itemPenalties.some(
        (p) =>
          p.penaltyType === 'daily_interest' &&
          (p.status === 'waived' || p.status === 'applied'),
      )

      const dailyAmount = calculateDailyPenaltyInterest(
        config,
        overdueAmount,
        daysOverdue,
      )
      if (dailyAmount > 0) {
        if (pendingDailyInterest) {
          await db
            .update(penalties)
            .set({ amount: dailyAmount.toFixed(2) })
            .where(eq(penalties.id, pendingDailyInterest.id))
        } else if (!hasDecidedDailyInterest) {
          await db.insert(penalties).values({
            loanId: loan.id,
            scheduleItemId: item.id,
            penaltyType: 'daily_interest',
            amount: dailyAmount.toFixed(2),
          })
        }
      }
    }
  }
}
