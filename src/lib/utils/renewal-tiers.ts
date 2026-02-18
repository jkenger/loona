export type RenewalTier = "new" | "returning" | "established" | "loyal"

export type RenewalTierResult = {
  tier: RenewalTier
  tierLabel: string
  interestDiscount: number // negative = discount (e.g., -0.5)
  termBenefit: "shorter" | "same" | "longer" | null
  reasoning: string[]
  hasDefaults: boolean
}

type ScorecardInput = {
  completedLoans: number
  defaultedLoans: number
  onTimeRate: number
  latePayments: number
  avgDaysLate: number
  totalPenalties: number
}

export function computeRenewalTier(scorecard: ScorecardInput): RenewalTierResult {
  const { completedLoans, defaultedLoans, onTimeRate, latePayments, avgDaysLate, totalPenalties } = scorecard
  const hasDefaults = defaultedLoans > 0

  // Determine tier
  let tier: RenewalTier
  let tierLabel: string
  if (completedLoans === 0) {
    tier = "new"
    tierLabel = "New Borrower"
  } else if (completedLoans <= 2) {
    tier = "returning"
    tierLabel = "Returning Borrower"
  } else if (completedLoans <= 5) {
    tier = "established"
    tierLabel = "Established Borrower"
  } else {
    tier = "loyal"
    tierLabel = "Loyal Borrower"
  }

  // Calculate adjustments
  let interestDiscount = 0
  let termBenefit: RenewalTierResult["termBenefit"] = "same"
  const reasoning: string[] = []

  if (hasDefaults) {
    reasoning.push("Has defaulted loan(s) — no discount recommended")
    interestDiscount = 0
    termBenefit = "shorter"
  } else if (tier === "new") {
    reasoning.push("First loan — standard terms, no history to base adjustments on")
  } else if (tier === "returning") {
    if (onTimeRate >= 90) {
      interestDiscount = -0.5
      reasoning.push(`${onTimeRate}% on-time rate across ${completedLoans} loan(s) — eligible for -0.5% discount`)
    } else if (onTimeRate >= 75) {
      reasoning.push(`${onTimeRate}% on-time rate — maintain current terms`)
    } else {
      termBenefit = "shorter"
      reasoning.push(`${onTimeRate}% on-time rate is below target — consider shorter term`)
    }
  } else if (tier === "established") {
    if (onTimeRate >= 90) {
      interestDiscount = -1
      termBenefit = "longer"
      reasoning.push(`Excellent ${onTimeRate}% on-time rate across ${completedLoans} loans — eligible for -1% discount`)
      reasoning.push("Longer term option available based on track record")
    } else if (onTimeRate >= 75) {
      interestDiscount = -0.5
      reasoning.push(`${onTimeRate}% on-time rate — eligible for -0.5% discount`)
    } else {
      reasoning.push(`${onTimeRate}% on-time rate — maintain current terms`)
    }
  } else {
    // loyal
    if (onTimeRate >= 90) {
      interestDiscount = -1.5
      termBenefit = "longer"
      reasoning.push(`Outstanding ${onTimeRate}% on-time rate across ${completedLoans} loans — eligible for -1.5% discount`)
      reasoning.push("Eligible for longer terms and higher principal")
    } else if (onTimeRate >= 75) {
      interestDiscount = -1
      reasoning.push(`${onTimeRate}% on-time rate — eligible for -1% discount`)
    } else {
      interestDiscount = -0.5
      reasoning.push(`${onTimeRate}% on-time rate — eligible for -0.5% discount`)
    }
  }

  // Additional context
  if (latePayments > 0 && !hasDefaults) {
    reasoning.push(`${latePayments} late payment(s), avg ${avgDaysLate} day(s) late`)
  }
  if (totalPenalties > 0) {
    const formatted = new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(totalPenalties)
    reasoning.push(`${formatted} in penalties incurred`)
  }

  return {
    tier,
    tierLabel,
    interestDiscount,
    termBenefit,
    reasoning,
    hasDefaults,
  }
}
