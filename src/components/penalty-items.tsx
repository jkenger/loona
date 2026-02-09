import { type ReactNode, useState } from "react"
import { useRouter } from "@tanstack/react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Gavel, Spinner, CaretDown, ArrowCounterClockwise } from "@phosphor-icons/react"
import { applyPenalty, waivePenalty, revertPenalty } from "@/server/penalties"

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
  const [revertingId, setRevertingId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    type: "apply" | "waive" | "revert"
    penalty: PenaltyItem
  } | null>(null)

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
    setConfirmAction(null)
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
    setConfirmAction(null)
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

  const handleRevert = async (penaltyId: string) => {
    setConfirmAction(null)
    setRevertingId(penaltyId)
    try {
      await revertPenalty({ data: { penaltyId } })
      toast.success("Penalty reverted to pending")
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revert penalty")
    } finally {
      setRevertingId(null)
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
        <div
          key={p.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground mr-1.5"
        >
          <Gavel className="h-3 w-3" />
          {penaltyTypeLabel(p, daysOverdue)}: {formatCurrency(p.amount)} — Applied
          <button
            className="ml-1 text-muted-foreground/60 hover:text-foreground transition-colors disabled:opacity-50"
            disabled={revertingId === p.id}
            onClick={() => setConfirmAction({ type: "revert", penalty: p })}
            title="Undo"
          >
            {revertingId === p.id ? <Spinner className="h-3 w-3 animate-spin" /> : <ArrowCounterClockwise className="h-3 w-3" />}
          </button>
        </div>
      ))}

      {/* Waived */}
      {waived.map((p) => (
        <div
          key={p.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground/60 line-through mr-1.5"
        >
          <Gavel className="h-3 w-3" />
          {penaltyTypeLabel(p, daysOverdue)}: {formatCurrency(p.amount)} — Waived
          <button
            className="ml-1 no-underline text-muted-foreground/60 hover:text-foreground transition-colors disabled:opacity-50"
            disabled={revertingId === p.id}
            onClick={() => setConfirmAction({ type: "revert", penalty: p })}
            title="Undo"
          >
            {revertingId === p.id ? <Spinner className="h-3 w-3 animate-spin" /> : <ArrowCounterClockwise className="h-3 w-3" />}
          </button>
        </div>
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
              onClick={() => setConfirmAction({ type: "waive", penalty: p })}
            >
              {waivingId === p.id ? <Spinner className="h-3 w-3 animate-spin" /> : "Waive"}
            </Button>
            <Button
              size="sm"
              className="h-6 text-xs px-2"
              disabled={applyingId === p.id}
              onClick={() => setConfirmAction({ type: "apply", penalty: p })}
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

  return (
    <>
      {children({ toggleButton, detailPanel })}

      {/* Confirmation dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "apply"
                ? "Apply Penalty"
                : confirmAction?.type === "waive"
                  ? "Waive Penalty"
                  : "Revert Penalty"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "apply" ? (
                <>
                  This will add{" "}
                  <span className="font-semibold text-foreground">
                    {confirmAction ? formatCurrency(confirmAction.penalty.amount) : ""}
                  </span>{" "}
                  ({confirmAction ? penaltyTypeLabel(confirmAction.penalty, daysOverdue) : ""}) to the
                  loan balance.
                </>
              ) : confirmAction?.type === "waive" ? (
                <>
                  This will waive the{" "}
                  <span className="font-semibold text-foreground">
                    {confirmAction ? formatCurrency(confirmAction.penalty.amount) : ""}
                  </span>{" "}
                  {confirmAction ? penaltyTypeLabel(confirmAction.penalty, daysOverdue).toLowerCase() : ""} penalty.
                  No amount will be charged.
                </>
              ) : (
                <>
                  This will revert the{" "}
                  <span className="font-semibold text-foreground">
                    {confirmAction ? formatCurrency(confirmAction.penalty.amount) : ""}
                  </span>{" "}
                  {confirmAction ? penaltyTypeLabel(confirmAction.penalty, daysOverdue).toLowerCase() : ""} penalty
                  back to pending.
                  {confirmAction?.penalty.status === "applied" && (
                    <> The amount will be subtracted from the loan balance.</>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmAction) return
                if (confirmAction.type === "apply") {
                  handleApply(confirmAction.penalty.id)
                } else if (confirmAction.type === "waive") {
                  handleWaive(confirmAction.penalty.id)
                } else {
                  handleRevert(confirmAction.penalty.id)
                }
              }}
            >
              {confirmAction?.type === "apply"
                ? "Apply"
                : confirmAction?.type === "waive"
                  ? "Waive"
                  : "Revert"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
