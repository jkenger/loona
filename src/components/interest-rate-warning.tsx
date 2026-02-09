import { Warning, Info } from "@phosphor-icons/react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface InterestRateWarningProps {
  rate: number | string
  className?: string
}

const MAX_RATE = 15 // Hard ceiling — server rejects above this
const HIGH_RATE_THRESHOLD = 6 // Above 6% monthly is very high
const ADVISORY_THRESHOLD = 3 // Above 3% monthly warrants documentation advice

function RateDetails({ type }: { type: "max" | "high" | "advisory" }) {
  const content = {
    max: {
      label: "Why is there a limit?",
      title: `Why ${MAX_RATE}% per month?`,
      body: `${MAX_RATE}% monthly already means 180% a year. If a borrower ever disputes the loan, courts can cancel rates they consider too high — and you lose your protection. This limit keeps your loans in a range that holds up if things go wrong.`,
    },
    high: {
      label: "Learn more",
      title: "Why This Matters",
      body: "Rates this high can cause problems if a borrower disputes the loan later. To protect yourself, make sure they sign the Promissory Note and Disclosure Statement before you release the money.",
    },
    advisory: {
      label: "Learn more",
      title: "Why Document Everything?",
      body: "Signed documents protect both you and the borrower. Have them sign the Promissory Note and review the Disclosure Statement so there's a clear record that everyone agreed to the terms.",
    },
  }[type]

  return (
    <span className="relative inline-block group/tip">
      <span className="inline-flex items-center gap-1 text-xs underline underline-offset-2 opacity-70 hover:opacity-100 cursor-help">
        <Info className="h-3 w-3" />
        {content.label}
      </span>
      <span className="absolute bottom-full left-0 mb-2 w-72 rounded-md border bg-popover p-3 text-popover-foreground shadow-md opacity-0 pointer-events-none group-hover/tip:opacity-100 group-hover/tip:pointer-events-auto transition-opacity z-50">
        <span className="block font-medium text-xs mb-1">{content.title}</span>
        <span className="block text-xs text-muted-foreground leading-relaxed">{content.body}</span>
      </span>
    </span>
  )
}

export function InterestRateWarning({ rate, className }: InterestRateWarningProps) {
  const numericRate = typeof rate === "string" ? parseFloat(rate) : rate

  if (isNaN(numericRate) || numericRate <= ADVISORY_THRESHOLD) {
    return null
  }

  if (numericRate > MAX_RATE) {
    return (
      <Alert className={`border-red-500 bg-red-50 text-red-900 dark:border-red-600 dark:bg-red-950/50 dark:text-red-200 [&>svg]:text-red-600 ${className || ""}`}>
        <Warning className="h-4 w-4" />
        <AlertTitle>Rate Exceeds Maximum</AlertTitle>
        <AlertDescription className="text-sm text-red-800 dark:text-red-300">
          The maximum allowed interest rate is {MAX_RATE}% per month. Please lower the rate to continue.{" "}
          <RateDetails type="max" />
        </AlertDescription>
      </Alert>
    )
  }

  const isHighRate = numericRate > HIGH_RATE_THRESHOLD

  if (isHighRate) {
    return (
      <Alert className={`border-orange-500 bg-orange-50 text-orange-900 dark:border-orange-600 dark:bg-orange-950/50 dark:text-orange-200 [&>svg]:text-orange-600 ${className || ""}`}>
        <Warning className="h-4 w-4" />
        <AlertTitle>High Interest Rate</AlertTitle>
        <AlertDescription className="text-sm text-orange-800 dark:text-orange-300">
          Make sure your borrower fully understands the total cost and agrees to these terms in writing before disbursement.{" "}
          <RateDetails type="high" />
        </AlertDescription>
      </Alert>
    )
  }

  // Between 3% and 6%
  return (
    <Alert className={`border-yellow-500 bg-yellow-50 text-yellow-900 dark:border-yellow-600 dark:bg-yellow-950/50 dark:text-yellow-200 [&>svg]:text-yellow-600 ${className || ""}`}>
      <Warning className="h-4 w-4" />
      <AlertTitle>Tip</AlertTitle>
      <AlertDescription className="text-sm text-yellow-800 dark:text-yellow-300">
        Have the borrower sign the Promissory Note and Disclosure Statement for your protection.{" "}
        <RateDetails type="advisory" />
      </AlertDescription>
    </Alert>
  )
}
