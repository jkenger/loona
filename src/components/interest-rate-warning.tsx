import { Warning, Info } from "@phosphor-icons/react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"

interface InterestRateWarningProps {
  rate: number | string
  className?: string
}

const SEC_MONTHLY_CAP = 6 // SEC MC 19-2019: 6% monthly nominal cap for lending companies
const COURT_CONCERN_THRESHOLD = 3 // Courts often scrutinize rates above 3% monthly (36% p.a.)

function LegalDetails({ type }: { type: "high" | "advisory" }) {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-1 text-xs underline underline-offset-2 opacity-70 hover:opacity-100 cursor-help">
        <Info className="h-3 w-3" />
        Learn more
      </PopoverTrigger>
      <PopoverContent className="max-w-sm text-sm">
        {type === "high" ? (
          <div className="space-y-3">
            <p className="font-medium">Philippine Regulatory Context</p>
            <p className="text-muted-foreground">
              SEC MC 19-2019 caps interest rates at 6% monthly for registered lending companies.
              While this doesn't directly apply to personal lending, Philippine courts have
              historically reduced "unconscionable" interest rates to 12% per annum in civil cases.
            </p>
            <div className="pt-2 border-t space-y-1">
              <p className="text-xs font-medium">References:</p>
              <a
                href="https://www.sec.gov.ph/mc-2019/mc-no-19-s-2019-rules-and-regulations-for-lending-and-financing-companies/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline block"
              >
                SEC MC 19-2019 (Interest Rate Caps)
              </a>
              <a
                href="https://www.officialgazette.gov.ph/1963/06/22/republic-act-no-3765/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline block"
              >
                RA 3765 (Truth in Lending Act)
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="font-medium">Why Document Agreement?</p>
            <p className="text-muted-foreground">
              Rates above 3% monthly (36% p.a.) have been scrutinized in some Philippine court cases.
              Having clear written agreement protects both parties and demonstrates the borrower's
              informed consent to the terms.
            </p>
            <div className="pt-2 border-t space-y-1">
              <p className="text-xs font-medium">References:</p>
              <a
                href="https://www.officialgazette.gov.ph/1963/06/22/republic-act-no-3765/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline block"
              >
                RA 3765 (Truth in Lending Act)
              </a>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export function InterestRateWarning({ rate, className }: InterestRateWarningProps) {
  const numericRate = typeof rate === "string" ? parseFloat(rate) : rate

  if (isNaN(numericRate) || numericRate <= COURT_CONCERN_THRESHOLD) {
    return null
  }

  const isAboveSECCap = numericRate > SEC_MONTHLY_CAP

  if (isAboveSECCap) {
    return (
      <Alert className={`border-orange-500 bg-orange-50 text-orange-900 dark:border-orange-600 dark:bg-orange-950/50 dark:text-orange-200 [&>svg]:text-orange-600 ${className || ""}`}>
        <Warning className="h-4 w-4" />
        <AlertTitle>High Interest Rate</AlertTitle>
        <AlertDescription className="text-sm text-orange-800 dark:text-orange-300">
          This is a high interest rate. Make sure your borrower fully understands and agrees to these terms in writing.{" "}
          <LegalDetails type="high" />
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
        Document the borrower's agreement to these terms for your protection.{" "}
        <LegalDetails type="advisory" />
      </AlertDescription>
    </Alert>
  )
}
