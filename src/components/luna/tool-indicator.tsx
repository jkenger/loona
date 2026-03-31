import { Sparkle } from "@phosphor-icons/react"

const toolLabels: Record<string, string> = {
  get_overdue_loans: "Checking overdue loans",
  get_loan_details: "Looking up loan details",
  search_loans: "Searching loans",
  search_contacts: "Searching borrowers",
  get_contact_profile: "Looking up borrower profile",
  get_recent_payments: "Checking recent payments",
  get_payments_by_loan: "Looking up payment history",
  get_portfolio_overview: "Analyzing portfolio",
  get_collection_rate: "Calculating collection rate",
  prepare_payment: "Preparing payment",
  confirm_payment: "Recording payment",
}

interface ToolIndicatorProps {
  toolName: string
}

export function ToolIndicator({ toolName }: ToolIndicatorProps) {
  const label = toolLabels[toolName] || `Using ${toolName}`

  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
        <Sparkle className="h-3.5 w-3.5 text-white animate-pulse" weight="fill" />
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" />
        {label}...
      </div>
    </div>
  )
}
