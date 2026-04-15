import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import { toast } from "sonner"
import {
  getAllPenalties,
  waivePenalty,
  revertPenalty,
  batchPayPenalties,
  batchWaivePenalties,
  type AllPenaltyRecord,
} from "@/server/penalties"
import { PayPenaltyDialog } from "@/components/pay-penalty-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { AccessDenied } from "@/components/access-denied"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { Stagger, StaggerItem } from "@/components/ui/stagger"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Gavel,
  MagnifyingGlass,
  Spinner,
  ArrowCounterClockwise,
  X,
  Money,
  Bank,
  ArrowRight,
} from "@phosphor-icons/react"
import { formatRelativeDate } from "@/lib/utils/date"
import {
  parsePenaltyMetadata,
  formatPenaltyCalculation,
  formatPenaltyContext,
} from "@/lib/constants/penalty-defaults"
import { PenaltyTimeline } from "@/components/penalty-items"
import { format } from "date-fns"

export const Route = createFileRoute("/_dashboard/penalties/")({
  validateSearch: (search: Record<string, unknown>) => ({
    loan: (search.loan as string) || undefined,
  }),
  loader: async ({ context }) => {
    const { session } = context as { session: { user: { role: string | null } } }
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      return { data: null, unauthorized: true }
    }
    const data = await getAllPenalties()
    return { data, unauthorized: false }
  },
  pendingComponent: PenaltiesPageSkeleton,
  component: PenaltiesPage,
})

function PenaltiesPageSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div>
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-52 mt-2" />
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  )
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "bank", label: "Bank" },
] as const

function MethodIcon({ method, className, selected }: { method: string; className?: string; selected?: boolean }) {
  switch (method) {
    case "cash":
      return <Money className={className} weight={selected ? "fill" : "regular"} />
    case "gcash":
      return <img src="/icons/gcash.svg" alt="GCash" className={className} />
    case "maya":
      return <img src="/icons/maya.svg" alt="Maya" className={className} />
    case "bank":
      return <Bank className={className} weight={selected ? "fill" : "regular"} />
    default:
      return null
  }
}

type StatusFilter = "all" | "pending" | "applied" | "waived"

function PenaltiesPage() {
  const { data, unauthorized } = Route.useLoaderData()
  const { loan: loanFilter } = Route.useSearch()
  const router = useRouter()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  // Action states
  const [payingPenalty, setPayingPenalty] = useState<AllPenaltyRecord | null>(null)
  const [waivingId, setWaivingId] = useState<string | null>(null)
  const [revertingId, setRevertingId] = useState<string | null>(null)
  const [batchLoading, setBatchLoading] = useState<"pay" | "waive" | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    type: "waive" | "revert"
    penalty: AllPenaltyRecord
  } | null>(null)
  const [confirmBatch, setConfirmBatch] = useState<"pay" | "waive" | null>(null)

  // Batch pay dialog state
  const [batchPayMethod, setBatchPayMethod] = useState<"cash" | "gcash" | "maya" | "bank">("cash")
  const [batchPayDate, setBatchPayDate] = useState<Date>(new Date())

  if (unauthorized) {
    return (
      <AccessDenied
        message="Only lenders can access the penalties page."
        homeLink="/agent"
        homeLinkLabel="Go to Agent Portal"
      />
    )
  }

  if (!data) return null

  const { penalties, summary } = data

  const totalCount = penalties.length
  const resolvedCount = summary.totalApplied + summary.totalWaived
  const resolutionProgress = totalCount > 0 ? Math.min((resolvedCount / totalCount) * 100, 100) : 0

  // Filter
  const filtered = useMemo(() => {
    let items = penalties
    if (loanFilter) {
      items = items.filter((p) => p.loanId === loanFilter)
    }
    if (statusFilter !== "all") {
      items = items.filter((p) => p.status === statusFilter)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      items = items.filter((p) => p.contactName.toLowerCase().includes(q))
    }
    return items
  }, [penalties, statusFilter, search, loanFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const selectablePending = pageItems.filter((p) => p.status === "pending")
  const allSelectedOnPage = selectablePending.length > 0 && selectablePending.every((p) => selected.has(p.id))

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllOnPage = () => {
    if (allSelectedOnPage) {
      setSelected((prev) => {
        const next = new Set(prev)
        selectablePending.forEach((p) => next.delete(p.id))
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        selectablePending.forEach((p) => next.add(p.id))
        return next
      })
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

  const handleBatchPay = async () => {
    setConfirmBatch(null)
    setBatchLoading("pay")
    try {
      const ids = Array.from(selected)
      const result = await batchPayPenalties({
        data: {
          penaltyIds: ids,
          method: batchPayMethod,
          paidAt: format(batchPayDate, "yyyy-MM-dd"),
        },
      })
      toast.success(`${result.success} penalt${result.success !== 1 ? "ies" : "y"} paid${result.failed > 0 ? `, ${result.failed} failed` : ""}`)
      setSelected(new Set())
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Batch pay failed")
    } finally {
      setBatchLoading(null)
    }
  }

  const handleBatchWaive = async () => {
    setConfirmBatch(null)
    setBatchLoading("waive")
    try {
      const ids = Array.from(selected)
      const result = await batchWaivePenalties({ data: { penaltyIds: ids } })
      toast.success(`${result.success} penalt${result.success !== 1 ? "ies" : "y"} waived${result.failed > 0 ? `, ${result.failed} failed` : ""}`)
      setSelected(new Set())
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Batch waive failed")
    } finally {
      setBatchLoading(null)
    }
  }

  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "pending", label: "Pending", count: summary.totalPending },
    { key: "applied", label: "Paid", count: summary.totalApplied },
    { key: "waived", label: "Waived", count: summary.totalWaived },
    { key: "all", label: "All", count: penalties.length },
  ]

  return (
    <Stagger className="px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Penalties</h1>
          <p className="text-muted-foreground">
            {summary.totalPending > 0
              ? `${summary.totalPending} pending ${summary.totalPending !== 1 ? "decisions" : "decision"}`
              : "All penalties resolved"}
          </p>
        </div>
        <Link
          to="/payments"
          className="shrink-0 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Collections
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* KPI Hero Strip */}
      <StaggerItem>
        <div className="rounded-xl border bg-card p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Resolution Status
            </p>
            <p className="text-xs text-muted-foreground">
              {resolvedCount} of {totalCount} resolved
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 sm:gap-6">
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p
                className={cn(
                  "text-xl sm:text-2xl font-bold tracking-tight mt-0.5",
                  summary.totalPending > 0 && "text-amber-600 dark:text-amber-400"
                )}
              >
                {summary.totalPending}
              </p>
              {summary.totalPending > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(summary.pendingAmount)}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="text-xl sm:text-2xl font-bold tracking-tight mt-0.5">
                {summary.totalApplied}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(summary.appliedAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Waived</p>
              <p className="text-xl sm:text-2xl font-bold tracking-tight mt-0.5">
                {summary.totalWaived}
              </p>
            </div>
          </div>
          <div className="mt-5">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${resolutionProgress}%` }}
              />
            </div>
          </div>
        </div>
      </StaggerItem>

      {/* Penalties List */}
      <StaggerItem>
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-5 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <Gavel className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-base font-semibold">Penalties</h3>
              {loanFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.navigate({ to: "/penalties", search: { loan: undefined } })}
                  className="text-xs gap-1 h-7 ml-2"
                >
                  <X className="h-3 w-3" />
                  Clear loan filter
                </Button>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search borrower name"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  className="h-9 pl-9 text-sm bg-muted/40 border-transparent focus-visible:bg-background focus-visible:border-input"
                />
              </div>
              <div className="flex items-center gap-0.5 bg-muted/40 rounded-md p-0.5 self-start sm:self-auto overflow-x-auto">
                {statusTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => { setStatusFilter(tab.key); setPage(1); setSelected(new Set()) }}
                    className={cn(
                      "text-xs h-8 px-3 rounded font-medium transition-colors whitespace-nowrap inline-flex items-center gap-1.5",
                      statusFilter === tab.key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab.label}
                    <span className={cn(
                      "text-[10px] rounded px-1 min-w-[18px] text-center",
                      statusFilter === tab.key
                        ? "bg-muted text-foreground"
                        : "bg-background/60 text-muted-foreground"
                    )}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Batch Action Bar */}
          <div
            className={`overflow-hidden transition-all duration-200 ${selected.size > 0 ? "max-h-20 opacity-100 mb-0" : "max-h-0 opacity-0"}`}
          >
            <div className="mx-5 mb-3 flex items-center gap-3 p-3 rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
              <span className="text-sm font-medium">{selected.size} selected</span>
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmBatch("waive")}
                  disabled={!!batchLoading}
                  className="h-7 text-xs"
                >
                  {batchLoading === "waive" ? <Spinner className="h-3 w-3 animate-spin mr-1" /> : null}
                  Waive {selected.size}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setBatchPayMethod("cash")
                    setBatchPayDate(new Date())
                    setConfirmBatch("pay")
                  }}
                  disabled={!!batchLoading}
                  className="h-7 text-xs"
                >
                  {batchLoading === "pay" ? <Spinner className="h-3 w-3 animate-spin mr-1" /> : null}
                  Pay {selected.size}
                </Button>
              </div>
            </div>
          </div>

          <div className="px-5 pb-5">
            {filtered.length > 0 ? (
              <>
                {/* Select all header (pending only) */}
                {selectablePending.length > 0 && (
                  <div className="flex items-center gap-3 py-2 border-b -mx-5 px-5">
                    <Checkbox
                      checked={allSelectedOnPage}
                      onCheckedChange={toggleAllOnPage}
                    />
                    <span className="text-xs text-muted-foreground">
                      Select all pending on this page
                    </span>
                  </div>
                )}
                <div className="space-y-0">
                  {pageItems.map((penalty) => {
                    const isPending = penalty.status === "pending"
                    const isApplied = penalty.status === "applied"
                    const isWaived = penalty.status === "waived"

                    return (
                      <div
                        key={penalty.id}
                        className={cn(
                          "flex items-start gap-3 py-3 border-b last:border-0 -mx-5 px-5 transition-colors",
                          selected.has(penalty.id) ? "bg-amber-50/60 dark:bg-amber-950/10" : "hover:bg-muted/40"
                        )}
                      >
                        {/* Checkbox for pending only */}
                        <div className="w-5 shrink-0 pt-0.5">
                          {isPending && (
                            <Checkbox
                              checked={selected.has(penalty.id)}
                              onCheckedChange={() => toggleSelect(penalty.id)}
                            />
                          )}
                        </div>

                        {/* Main content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              to="/loans/$loanId"
                              params={{ loanId: penalty.loanId }}
                              className={cn(
                                "font-medium text-sm hover:text-primary truncate",
                                isWaived && "line-through text-muted-foreground"
                              )}
                            >
                              {penalty.contactName}
                            </Link>
                            {isPending && (
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 px-1.5 py-0.5 rounded shrink-0">
                                Pending
                              </span>
                            )}
                            {isApplied && (
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                                Paid
                              </span>
                            )}
                            {isWaived && (
                              <Badge variant="secondary" className="text-[10px] h-5 shrink-0">
                                Waived
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] h-5 shrink-0 text-muted-foreground">
                              {penalty.penaltyType === "late_fee" ? "Late Fee" : "Daily Interest"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Due {formatRelativeDate(penalty.dueDate)}
                            {penalty.daysOverdue > 0 && (
                              <span className="text-amber-600 dark:text-amber-400 ml-1">
                                · {penalty.daysOverdue}d overdue
                              </span>
                            )}
                          </p>
                          <PenaltyTimeline
                            metadata={penalty.metadata}
                            status={penalty.status}
                            appliedAt={penalty.appliedAt}
                            waivedAt={penalty.waivedAt}
                            daysOverdue={penalty.daysOverdue}
                          />
                          {(() => {
                            const meta = parsePenaltyMetadata(penalty.metadata)
                            if (!meta) return null
                            return (
                              <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                                {formatPenaltyCalculation(meta, penalty.penaltyType)}
                                {" "}
                                <span className="text-muted-foreground/50">
                                  ({formatPenaltyContext(meta)})
                                </span>
                              </p>
                            )
                          })()}
                        </div>

                        {/* Amount + Actions */}
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <p className={cn(
                            "font-semibold text-sm",
                            isWaived && "text-muted-foreground line-through"
                          )}>
                            {formatCurrency(penalty.amount)}
                          </p>
                          <div className="flex items-center gap-1.5">
                            {isPending && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs px-2"
                                  disabled={waivingId === penalty.id}
                                  onClick={() => setConfirmAction({ type: "waive", penalty })}
                                >
                                  {waivingId === penalty.id ? <Spinner className="h-3 w-3 animate-spin" /> : "Waive"}
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs px-2"
                                  onClick={() => setPayingPenalty(penalty)}
                                >
                                  Pay
                                </Button>
                              </>
                            )}
                            {(isApplied || isWaived) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs px-2 text-muted-foreground"
                                disabled={revertingId === penalty.id}
                                onClick={() => setConfirmAction({ type: "revert", penalty })}
                              >
                                {revertingId === penalty.id ? (
                                  <Spinner className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>
                                    <ArrowCounterClockwise className="h-3 w-3 mr-1" />
                                    Revert
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-3 mt-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Prev
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-10">
                <Gavel className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium">No penalties</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {search || statusFilter !== "all" || loanFilter
                    ? "Try adjusting your filters"
                    : "Penalties will appear here when borrowers have overdue payments"}
                </p>
                {(search || statusFilter !== "all") && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => { setSearch(""); setStatusFilter("all") }}
                    className="mt-1"
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </StaggerItem>

      {/* Pay Penalty Dialog */}
      <PayPenaltyDialog
        open={!!payingPenalty}
        onOpenChange={(open) => { if (!open) setPayingPenalty(null) }}
        penalty={payingPenalty ? {
          id: payingPenalty.id,
          penaltyType: payingPenalty.penaltyType,
          amount: payingPenalty.amount,
          contactName: payingPenalty.contactName,
        } : null}
      />

      {/* Single Action Confirmation */}
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
                  penalty for {confirmAction?.penalty.contactName}. No amount will be charged.
                </>
              ) : (
                <>
                  This will revert the{" "}
                  <span className="font-semibold text-foreground">
                    {confirmAction ? formatCurrency(confirmAction.penalty.amount) : ""}
                  </span>{" "}
                  penalty back to pending.
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
                if (confirmAction.type === "waive") handleWaive(confirmAction.penalty.id)
                else handleRevert(confirmAction.penalty.id)
              }}
            >
              {confirmAction?.type === "waive" ? "Waive" : "Revert"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Pay Dialog */}
      <Dialog open={confirmBatch === "pay"} onOpenChange={(open) => !open && setConfirmBatch(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay {selected.size} Penalties</DialogTitle>
            <DialogDescription>
              Choose a payment method and date for all {selected.size} selected penalties.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <div className="grid grid-cols-4 gap-2">
                {PAYMENT_METHODS.map((m) => {
                  const isSelected = batchPayMethod === m.value
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setBatchPayMethod(m.value as any)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-xs font-medium transition-all",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50 hover:bg-muted/50 text-muted-foreground"
                      )}
                    >
                      <MethodIcon method={m.value} className="h-5 w-5" selected={isSelected} />
                      {m.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment Date</Label>
              <DatePicker
                value={batchPayDate}
                onChange={(date) => date && setBatchPayDate(date)}
                disabledDates={{ after: new Date() }}
                disabledTooltip="Payment date cannot be in the future"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBatch(null)}>Cancel</Button>
            <Button onClick={handleBatchPay} disabled={!!batchLoading}>
              {batchLoading === "pay" ? (
                <><Spinner className="h-4 w-4 animate-spin mr-2" />Paying...</>
              ) : (
                `Pay ${selected.size}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Waive Confirmation */}
      <AlertDialog open={confirmBatch === "waive"} onOpenChange={(open) => !open && setConfirmBatch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batch Waive Penalties</AlertDialogTitle>
            <AlertDialogDescription>
              This will waive <span className="font-semibold text-foreground">{selected.size}</span> pending
              penalt{selected.size !== 1 ? "ies" : "y"}. No amounts will be charged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchWaive}>
              Waive {selected.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Stagger>
  )
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}
