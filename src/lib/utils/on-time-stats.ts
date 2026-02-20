/**
 * On-time stats calculated against RAW due date (not grace-adjusted).
 * Grace period only affects when penalties apply, NOT on-time tracking.
 */

export interface OnTimeStats {
  onTimeCount: number
  lateCount: number
  totalDaysLate: number
  onTimeRate: number // 0-100
}

interface ScheduleItem {
  status: string
  dueDate: Date | string
  paidAt: Date | string | null
}

/**
 * Calculate on-time stats against raw due date (daysDiff <= 0 = on-time).
 */
export function calculateOnTimeStats(scheduleItems: ScheduleItem[]): OnTimeStats {
  let onTimeCount = 0
  let lateCount = 0
  let totalDaysLate = 0

  for (const item of scheduleItems) {
    if (item.status !== "paid") continue
    if (!item.paidAt) continue

    const dueDate = new Date(item.dueDate)
    const paidAt = new Date(item.paidAt)

    // Compare dates only (ignore time)
    const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
    const paidDateOnly = new Date(paidAt.getFullYear(), paidAt.getMonth(), paidAt.getDate())
    const diffMs = paidDateOnly.getTime() - dueDateOnly.getTime()
    const daysDiff = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    if (daysDiff <= 0) {
      onTimeCount++
    } else {
      lateCount++
      totalDaysLate += daysDiff
    }
  }

  const totalPaidItems = onTimeCount + lateCount
  const onTimeRate = totalPaidItems > 0 ? Math.round((onTimeCount / totalPaidItems) * 100) : 100

  return {
    onTimeCount,
    lateCount,
    totalDaysLate,
    onTimeRate,
  }
}
