export type PaymentFrequency =
  | "daily"
  | "weekly"
  | "biweekly"
  | "semimonthly"
  | "monthly"

/**
 * Calculate the number of payments based on term and frequency.
 * Shared between server (loan creation) and client (estimator).
 */
export function calculatePaymentsCount(
  termMonths: number,
  frequency: PaymentFrequency,
): number {
  switch (frequency) {
    case "daily":
      return termMonths * 30
    case "weekly":
      return termMonths * 4
    case "biweekly":
      return termMonths * 2
    case "semimonthly":
      return termMonths * 2
    case "monthly":
    default:
      return termMonths
  }
}
