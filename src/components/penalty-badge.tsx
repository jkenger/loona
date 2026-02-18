import { Link } from "@tanstack/react-router"
import { Gavel } from "@phosphor-icons/react"

interface PenaltyBadgeProps {
  penalties: { amount: string; status: string }[]
  formatCurrency: (amount: string | number) => string
  /** When set, clicking the badge navigates to /penalties?loan={loanId} */
  loanId?: string
}

/**
 * Read-only inline badge showing penalty summary for a schedule item.
 * Lender: clicking navigates to the penalties page filtered by loan.
 * Agent: no click behavior (omit loanId prop).
 */
export function PenaltyBadge({ penalties, formatCurrency, loanId }: PenaltyBadgeProps) {
  const applied = penalties.filter((p) => p.status === "applied")
  const pending = penalties.filter((p) => p.status === "pending")

  const appliedTotal = applied.reduce((sum, p) => sum + parseFloat(p.amount), 0)

  if (applied.length === 0 && pending.length === 0) return null

  const parts: string[] = []
  if (appliedTotal > 0) parts.push(`+${formatCurrency(appliedTotal)} penalty`)
  if (pending.length > 0) parts.push(`${pending.length} pending`)

  const label = parts.join(" · ")

  const badge = (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ${loanId ? "cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors" : ""}`}
    >
      <Gavel className="h-3 w-3" />
      {label}
    </span>
  )

  if (loanId) {
    return (
      <Link to="/penalties" search={{ loan: loanId }}>
        {badge}
      </Link>
    )
  }

  return badge
}
