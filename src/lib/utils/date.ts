import { isToday, isTomorrow, differenceInDays, format } from "date-fns"

/**
 * Formats a date string to a human-readable relative format
 * - "Today" / "Tomorrow" / "Yesterday"
 * - Day name for dates within 6 days (e.g., "Friday")
 * - "X days ago" for past dates
 * - "MMM d" for dates beyond a week (e.g., "Feb 15")
 */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const days = differenceInDays(date, now)

  if (isToday(date)) return "Today"
  if (isTomorrow(date)) return "Tomorrow"
  if (days < 0) {
    const absDays = Math.abs(days)
    if (absDays === 1) return "Yesterday"
    return `${absDays} days ago`
  }
  if (days <= 6) return format(date, "EEEE") // Day name like "Friday"
  return format(date, "MMM d") // "Feb 15"
}

/**
 * Lowercase version for inline use (e.g., "due today")
 */
export function formatRelativeDateLower(dateString: string): string {
  return formatRelativeDate(dateString).toLowerCase()
}
