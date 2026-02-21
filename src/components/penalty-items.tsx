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
import { waivePenalty, revertPenalty } from "@/server/penalties"
import { PayPenaltyDialog } from "@/components/pay-penalty-dialog"
import {
  parsePenaltyMetadata,
  formatPenaltyCalculation,
  formatPenaltyContext,
} from "@/lib/constants/penalty-defaults"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

export interface PenaltyItem {
  id: string
  penaltyType: string
  amount: string
  status: string
  metadata?: string | null
  createdAt?: string | null
  appliedAt?: string | null
  waivedAt?: string | null
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
  const [payingPenalty, setPayingPenalty] = useState<PenaltyItem | null>(null)
  const [waivingId, setWaivingId] = useState<string | null>(null)
  const [revertingId, setRevertingId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    type: "waive" | "revert"
    penalty: PenaltyItem
  } | null>(null)

  const applied = penalties.filter((p) => p.status === "applied")
  const pending = penalties.filter((p) => p.status === "pending")
  const waived = penalties.filter((p) => p.status === "waived")
  const hasInfo = applied.length > 0 || pending.length > 0 || waived.length > 0 || penaltyIn > 0

  const summaryLabel = pending.length > 0
    ? `${pending.length} pending`
    : applied.length > 0
      ? `${applied.length} paid`
      : waived.length > 0
        ? `${waived.length} waived`
        : `in ${penaltyIn}d`

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
      {/* Applied (Paid) */}
      {applied.map((p) => {
        const meta = parsePenaltyMetadata(p.metadata ?? null)
        return (
          <div key={p.id}>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground mr-1.5">
              <Gavel className="h-3 w-3" />
              {penaltyTypeLabel(p, daysOverdue)}: {formatCurrency(p.amount)} — Paid
              <button
                className="ml-1 text-muted-foreground/60 hover:text-foreground transition-colors disabled:opacity-50"
                disabled={revertingId === p.id}
                onClick={() => setConfirmAction({ type: "revert", penalty: p })}
                title="Undo"
              >
                {revertingId === p.id ? <Spinner className="h-3 w-3 animate-spin" /> : <ArrowCounterClockwise className="h-3 w-3" />}
              </button>
            </div>
            <PenaltyTimeline metadata={p.metadata} status={p.status} appliedAt={p.appliedAt} waivedAt={p.waivedAt} daysOverdue={daysOverdue} />
            {meta && (
              <p className="text-[11px] text-muted-foreground/60 pl-2 mt-0.5">
                {formatPenaltyCalculation(meta, p.penaltyType)} ({formatPenaltyContext(meta)})
              </p>
            )}
          </div>
        )
      })}

      {/* Waived */}
      {waived.map((p) => {
        const meta = parsePenaltyMetadata(p.metadata ?? null)
        return (
          <div key={p.id}>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground/60 line-through mr-1.5">
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
            <PenaltyTimeline metadata={p.metadata} status={p.status} appliedAt={p.appliedAt} waivedAt={p.waivedAt} daysOverdue={daysOverdue} />
            {meta && (
              <p className="text-[11px] text-muted-foreground/60 pl-2 mt-0.5">
                {formatPenaltyCalculation(meta, p.penaltyType)} ({formatPenaltyContext(meta)})
              </p>
            )}
          </div>
        )
      })}

      {/* Pending */}
      {pending.map((p) => {
        const meta = parsePenaltyMetadata(p.metadata ?? null)
        return (
          <div
            key={p.id}
            className="px-3 py-1.5 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm">
                <Gavel className="h-3.5 w-3.5 text-amber-600" />
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  {penaltyTypeLabel(p, daysOverdue)}:
                </span>
                <span className="font-semibold">{formatCurrency(p.amount)}</span>
                {p.createdAt && (
                  <span className="text-[11px] text-muted-foreground ml-1">
                    — {format(new Date(p.createdAt), "MMM d")}
                  </span>
                )}
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
                  onClick={() => setPayingPenalty(p)}
                >
                  Pay
                </Button>
              </div>
            </div>
            <PenaltyTimeline metadata={p.metadata} status={p.status} appliedAt={p.appliedAt} waivedAt={p.waivedAt} daysOverdue={daysOverdue} />
            {meta && (
              <p className="text-[11px] text-muted-foreground/70 mt-0.5 pl-5">
                {formatPenaltyCalculation(meta, p.penaltyType)} ({formatPenaltyContext(meta)})
              </p>
            )}
          </div>
        )
      })}

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

      {/* Pay Penalty Dialog (moved below PenaltyTimeline definition) */}
      <PayPenaltyDialog
        open={!!payingPenalty}
        onOpenChange={(open) => { if (!open) setPayingPenalty(null) }}
        penalty={payingPenalty ? {
          id: payingPenalty.id,
          penaltyType: payingPenalty.penaltyType,
          amount: payingPenalty.amount,
        } : null}
      />

      {/* Confirmation dialog (waive / revert only) */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "waive" ? "Waive Penalty" : "Revert Penalty"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "waive" ? (
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
                    <> The payment will be reversed and the amount removed from the loan.</>
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
                if (confirmAction.type === "waive") {
                  handleWaive(confirmAction.penalty.id)
                } else {
                  handleRevert(confirmAction.penalty.id)
                }
              }}
            >
              {confirmAction?.type === "waive" ? "Waive" : "Revert"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function PenaltyTimeline({ metadata, status, appliedAt, waivedAt, daysOverdue: daysOverdueProp, gracePeriodDays: gracePeriodDaysProp }: {
  metadata?: string | null
  status: string
  appliedAt?: string | null
  waivedAt?: string | null
  /** Fallback when metadata is null */
  daysOverdue?: number
  /** Fallback when metadata is null */
  gracePeriodDays?: number
}) {
  const meta = parsePenaltyMetadata(metadata ?? null)

  const graceDays = meta?.gracePeriodDays ?? gracePeriodDaysProp ?? 0
  const rawOverdue = meta?.daysOverdue ?? daysOverdueProp ?? 0

  // Nothing to show if no overdue info at all
  if (graceDays === 0 && rawOverdue === 0) return null

  const penaltyDays = meta?.applicableDays != null
    ? meta.applicableDays
    : Math.max(rawOverdue > graceDays ? 1 : 0, rawOverdue - graceDays)
  const totalDays = graceDays + penaltyDays

  const gracePercent = totalDays > 0 ? (graceDays / totalDays) * 100 : 0
  const penaltyPercent = totalDays > 0 ? (penaltyDays / totalDays) * 100 : 100

  const isApplied = status === "applied"
  const isWaived = status === "waived"

  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex h-1.5 rounded-full overflow-hidden w-24 bg-muted/30">
        {graceDays > 0 && (
          <div
            style={{ width: `${gracePercent}%`, minWidth: 4 }}
            className="bg-muted-foreground/20 rounded-l-full"
          />
        )}
        {penaltyDays > 0 && (
          <div
            style={{ width: `${penaltyPercent}%`, minWidth: 4 }}
            className={cn(
              isApplied ? "bg-green-500" : isWaived ? "bg-muted-foreground/30" : "bg-amber-500",
              graceDays === 0 ? "rounded-l-full" : "",
              "rounded-r-full",
            )}
          />
        )}
      </div>
      <span className="text-[11px] text-muted-foreground">
        {graceDays > 0 ? `${graceDays}d grace · ` : ""}
        {penaltyDays}d penalty
        {isApplied && appliedAt && ` · Paid ${format(new Date(appliedAt), "MMM d")}`}
        {isWaived && waivedAt && ` · Waived ${format(new Date(waivedAt), "MMM d")}`}
      </span>
    </div>
  )
}
