/**
 * EIR (Effective Interest Rate) Calculator
 *
 * Calculates the annual effective interest rate using the IRR (Internal Rate of Return)
 * method as required by RA 3765 (Truth in Lending Act) of the Philippines.
 *
 * The EIR accounts for the timing of payments and is calculated by solving for
 * the periodic rate r where:
 * Principal = Σ (Payment / (1 + r)^n)
 *
 * Then annualized: EIR = (1 + r)^periodsPerYear - 1
 */

export type PaymentFrequency =
  | "daily"
  | "weekly"
  | "biweekly"
  | "semimonthly"
  | "monthly"

interface CalculateEIRParams {
  principal: number
  totalInterest: number
  termMonths: number
  paymentFrequency: PaymentFrequency
}

/**
 * Get the number of payment periods per year based on frequency
 */
function getPeriodsPerYear(frequency: PaymentFrequency): number {
  switch (frequency) {
    case "daily":
      return 365
    case "weekly":
      return 52
    case "biweekly":
      return 26
    case "semimonthly":
      return 24
    case "monthly":
      return 12
  }
}

/**
 * Get the number of payments based on term and frequency
 */
function getPaymentsCount(
  termMonths: number,
  frequency: PaymentFrequency
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
      return termMonths
  }
}

/**
 * Calculate the present value of an annuity given a periodic rate
 * PV = PMT × [(1 - (1 + r)^-n) / r]
 */
function presentValue(payment: number, rate: number, periods: number): number {
  if (rate === 0) {
    return payment * periods
  }
  return payment * ((1 - Math.pow(1 + rate, -periods)) / rate)
}

/**
 * Derivative of the present value function with respect to rate
 * Used for Newton-Raphson iteration
 */
function presentValueDerivative(
  payment: number,
  rate: number,
  periods: number
): number {
  if (rate === 0) {
    // Limit as rate approaches 0
    return -payment * periods * (periods + 1) / 2
  }
  const onePlusR = 1 + rate
  const onePlusRNegN = Math.pow(onePlusR, -periods)

  // d/dr of PMT × [(1 - (1+r)^-n) / r]
  const numerator = periods * onePlusRNegN / onePlusR - (1 - onePlusRNegN) / rate
  return payment * numerator / rate
}

/**
 * Calculate the Effective Interest Rate (EIR) using Newton-Raphson method
 *
 * @param params - The loan parameters
 * @returns The annual EIR as a decimal (e.g., 0.895 for 89.5%)
 */
export function calculateEIR(params: CalculateEIRParams): number {
  const { principal, totalInterest, termMonths, paymentFrequency } = params

  // Handle edge cases
  if (principal <= 0 || termMonths <= 0) {
    return 0
  }

  // Zero interest case
  if (totalInterest <= 0) {
    return 0
  }

  const totalToRepay = principal + totalInterest
  const paymentsCount = getPaymentsCount(termMonths, paymentFrequency)
  const payment = totalToRepay / paymentsCount
  const periodsPerYear = getPeriodsPerYear(paymentFrequency)

  // Initial guess: simple monthly rate converted to periodic rate
  // Monthly rate approximation: totalInterest / (principal × termMonths)
  const monthlyRateApprox = totalInterest / (principal * termMonths)
  let periodicRate = monthlyRateApprox * (12 / periodsPerYear)

  // Newton-Raphson iteration
  const maxIterations = 100
  const tolerance = 1e-10

  for (let i = 0; i < maxIterations; i++) {
    const pv = presentValue(payment, periodicRate, paymentsCount)
    const f = pv - principal // We want PV = Principal, so f(r) = PV - Principal = 0
    const fPrime = presentValueDerivative(payment, periodicRate, paymentsCount)

    if (Math.abs(fPrime) < 1e-15) {
      // Derivative too small, can't continue
      break
    }

    const newRate = periodicRate - f / fPrime

    // Check for convergence
    if (Math.abs(newRate - periodicRate) < tolerance) {
      periodicRate = newRate
      break
    }

    // Ensure rate stays positive
    periodicRate = Math.max(newRate, 1e-10)
  }

  // Annualize the periodic rate
  // EIR = (1 + r)^periodsPerYear - 1
  const eir = Math.pow(1 + periodicRate, periodsPerYear) - 1

  return eir
}

/**
 * Format EIR as a percentage string
 *
 * @param eir - The EIR as a decimal
 * @returns Formatted string like "89.5% p.a."
 */
export function formatEIR(eir: number): string {
  if (eir <= 0) {
    return "0% p.a."
  }

  const percentage = eir * 100

  // Format with 1 decimal place, but remove trailing .0
  const formatted = percentage.toFixed(1).replace(/\.0$/, "")

  return `${formatted}% p.a.`
}
