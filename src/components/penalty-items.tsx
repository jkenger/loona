import { type ReactNode, useState } from "react"
import { useRouter } from "@tanstack/react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Gavel, Spinner, CaretDown } from "@phosphor-icons/react"
import { applyPenalty, waivePenalty } from "@/server/penalties"

export interface PenaltyItem {
  id: string
  penaltyType: string
  amount: string
  status: string
}

interface PenaltyItemsProps {
  penalties: PenaltyItem[]
  daysOverdue: number
  /** Days until late fee applies — positive = countdown, 0 = already applies, -1 = disabled */
  penaltyIn?: number
  formatCurrency: (amount: string | number) => string
  children: (parts: {
    /** Inline toggle button (null if no penalty info) */
    toggleButton: ReactNode
    /** Expanded detail panel (null if collapsed or no info) */
    detailPanel: ReactNode
  }) => ReactNode
}

function penaltyTypeLabel(p: { penaltyType: string }, daysOverdue: number) {
  if (p.penaltyType === "daily_interest" && daysOverdue > 0) {
    return `Daily Interest (${daysOverdue}d)`
  }
  return p.penaltyType === "daily_interest" ? "Daily Interest" : "Late Fee"
}

/**
 * Shared penalty UI for overdue schedule items. Uses a render-prop so the
 * parent can place the toggle button and detail panel in different DOM positions.
 */
export function PenaltyItems({
  penalties,
  daysOverdue,
  penaltyIn = -1,
  formatCurrency,
  children,
}: PenaltyItemsProps) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [waivingId, setWaivingId] = useState<string | null>(null)

  const applied = penalties.filter((p) => p.status === "applied")
  const pending = penalties.filter((p) => p.status === "pending")
  const waived = penalties.filter((p) => p.status === "waived")
  const hasInfo = applied.length > 0 || pending.length > 0 || waived.length > 0 || penaltyIn > 0

  const summaryLabel = pending.length > 0
    ? `${pending.length} pending`
    : applied.length > 0
      ? `${applied.length} applied`
      : waived.length > 0
        ? `${waived.length} waived`
        : `in ${penaltyIn}d`

  const handleApply = async (penaltyId: string) => {
    setApplyingId(penaltyId)
    try {
      await applyPenalty({ data: { penaltyId } })
      toast.success("Penalty applied")
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply penalty")
    } finally {
      setApplyingId(null)
    }
  }

  const handleWaive = async (penaltyId: string) => {
    setWaivingId(penaltyId)
    try {
      await waivePenalty({ data: { penaltyId } })
      toast.success("Penalty waived")
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to waive penalty")
    } finally {
      setWaivingId(null)
    }
  }

  // Toggle button — sits inline next to the due date
  const toggleButton = hasInfo ? (
    <button
      onClick={() => setExpanded((v) => !v)}
      className="inline-flex items-center gap-0.5 text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
    >
      <Gavel className="h-3 w-3" />
      <span className="text-xs">{summaryLabel}</span>
      <CaretDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
    </button>
  ) : null

  // Detail panel — rendered below the schedule item row
  const detailPanel = hasInfo && expanded ? (
    <div className="space-y-1.5">
      {/* Applied */}
      {applied.map((p) => (
        <span
          key={p.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground mr-1.5"
        >
          <Gavel className="h-3 w-3" />
          {penaltyTypeLabel(p, daysOverdue)}: {formatCurrency(p.amount)} — Applied
        </span>
      ))}

      {/* Waived */}
      {waived.map((p) => (
        <span
          key={p.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground/60 line-through mr-1.5"
        >
          <Gavel className="h-3 w-3" />
          {penaltyTypeLabel(p, daysOverdue)}: {formatCurrency(p.amount)} — Waived
        </span>
      ))}

      {/* Pending */}
      {pending.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between gap-2 px-3 py-1.5 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
        >
          <div className="flex items-center gap-1.5 text-sm">
            <Gavel className="h-3.5 w-3.5 text-amber-600" />
            <span className="font-medium text-amber-700 dark:text-amber-400">
              {penaltyTypeLabel(p, daysOverdue)}:
            </span>
            <span className="font-semibold">{formatCurrency(p.amount)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs px-2"
              disabled={waivingId === p.id}
              onClick={() => handleWaive(p.id)}
            >
              {waivingId === p.id ? <Spinner className="h-3 w-3 animate-spin" /> : "Waive"}
            </Button>
            <Button
              size="sm"
              className="h-6 text-xs px-2"
              disabled={applyingId === p.id}
              onClick={() => handleApply(p.id)}
            >
              {applyingId === p.id ? <Spinner className="h-3 w-3 animate-spin" /> : "Apply"}
            </Button>
          </div>
        </div>
      ))}

      {/* Grace period indicator */}
      {pending.length === 0 && applied.length === 0 && penaltyIn > 0 && (
        <p className="text-xs text-muted-foreground py-1">
          Late fee applies in {penaltyIn} day{penaltyIn !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  ) : null

  return <>{children({ toggleButton, detailPanel })}</>
}
