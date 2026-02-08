import { Warning, Info } from "@phosphor-icons/react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"

interface InterestRateWarningProps {
  rate: number | string
  className?: string
}

const HIGH_RATE_THRESHOLD = 6 // Above 6% monthly is very high
const ADVISORY_THRESHOLD = 3 // Above 3% monthly warrants documentation advice

function RateDetails({ type }: { type: "high" | "advisory" }) {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-1 text-xs underline underline-offset-2 opacity-70 hover:opacity-100 cursor-help">
        <Info className="h-3 w-3" />
        Learn more
      </PopoverTrigger>
      <PopoverContent className="max-w-sm text-sm">
        {type === "high" ? (
          <div className="space-y-3">
            <p className="font-medium">Why This Matters</p>
            <p className="text-muted-foreground">
              Very high interest rates can lead to disputes and may be considered
              "unconscionable" if challenged in court. Philippine courts have historically
              reduced excessive rates in civil cases. To protect yourself, ensure the
              borrower clearly understands and signs the Promissory Note and Disclosure
              Statement before disbursing the loan.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="font-medium">Why Document Everything?</p>
            <p className="text-muted-foreground">
              Written agreements protect both you and the borrower. Have them sign the
              Promissory Note and review the Disclosure Statement so there's a clear
              record that both parties understood and agreed to the terms — especially the
              total cost and Effective Interest Rate (EIR).
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export function InterestRateWarning({ rate, className }: InterestRateWarningProps) {
  const numericRate = typeof rate === "string" ? parseFloat(rate) : rate

  if (isNaN(numericRate) || numericRate <= ADVISORY_THRESHOLD) {
    return null
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
