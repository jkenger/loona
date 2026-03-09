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
  Check,
  Clock,
  X,
  Money,
  Bank,
  ChartBar,
  CheckCircle,
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
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-52 mt-2" />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-5">
          <div className="rounded-xl border shadow-sm p-5 space-y-4">
            <Skeleton className="h-5 w-40" />
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          <div className="rounded-xl border shadow-sm p-5 space-y-3">
            <Skeleton className="h-5 w-44" />
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-xl border shadow-sm p-5 space-y-3">
            <Skeleton className="h-5 w-36" />
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
          <div className="rounded-xl border shadow-sm p-5 space-y-3">
            <Skeleton className="h-5 w-36" />
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
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

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
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

  // Pending items for right column
  const pendingItems = penalties.filter((p) => p.status === "pending")
  // Recently resolved (paid/waived) for right column
  const resolvedItems = penalties.filter((p) => p.status === "applied" || p.status === "waived").slice(0, 10)

  // Resolution stats
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

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: `All (${penalties.length})` },
    { key: "pending", label: `Pending (${summary.totalPending})` },
    { key: "applied", label: `Paid (${summary.totalApplied})` },
    { key: "waived", label: `Waived (${summary.totalWaived})` },
  ]

  return (
    <Stagger className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
        <p className="text-muted-foreground">
          {summary.totalPending > 0
            ? `${summary.totalPending} pending penalty decision${summary.totalPending !== 1 ? "s" : ""}`
            : "All penalties resolved"}
        </p>
        <div className="flex items-center gap-1 mt-4">
          <Link
            to="/payments"
            className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent"
          >
            Collections
          </Link>
          <span className="px-3 py-1.5 text-sm font-medium text-foreground border-b-2 border-primary">
            Penalties
          </span>
        </div>
      </div>

      {/* Bento Grid */}
      <StaggerItem className="grid gap-5 lg:grid-cols-5">
        {/* Left Column */}
        <div className="lg:col-span-3 space-y-5">
          {/* Resolution Progress */}
          <div className="rounded-xl border shadow-sm">
            <div className="p-5 pb-3">
              <div className="flex items-center gap-2">
                <ChartBar className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-base font-semibold">Resolution Progress</h3>
              </div>
            </div>
            <div className="p-5 pt-0">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground">Pending</p>
                  <p className={cn("text-lg font-bold", summary.totalPending > 0 && "text-amber-600")}>
                    {summary.totalPending}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(summary.pendingAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Collected</p>
                  <p className="text-lg font-bold text-primary">{summary.totalApplied}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(summary.appliedAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Waived</p>
                  <p className="text-lg font-bold">{summary.totalWaived}</p>
                </div>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${resolutionProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {resolvedCount} of {totalCount} penalties resolved
              </p>
            </div>
          </div>

          {/* All Penalties */}
          <div className="rounded-xl border shadow-sm">
            <div className="p-5 pb-3">
              <div className="flex items-center gap-2">
                <Gavel className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-base font-semibold">All Penalties</h3>
              </div>
            </div>
            <div className="p-5 pt-0">
              {/* Filter Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                <div className="flex items-center gap-1">
                  {statusTabs.map((tab) => (
                    <Button
                      key={tab.key}
                      variant={statusFilter === tab.key ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => { setStatusFilter(tab.key); setPage(1); setSelected(new Set()) }}
                      className="text-xs h-7 px-2"
                    >
                      {tab.label}
                    </Button>
                  ))}
                </div>
                <div className="relative flex-1 max-w-xs">
                  <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search borrower..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                    className="w-full h-8 pl-8 pr-3 text-sm border rounded-md bg-background"
                  />
                </div>
                {loanFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.navigate({ to: "/penalties", search: { loan: undefined } })}
                    className="text-xs gap-1"
                  >
                    <X className="h-3 w-3" />
                    Clear loan filter
                  </Button>
                )}
              </div>

              {/* Batch Action Bar */}
              <div
                className={`overflow-hidden transition-all duration-200 ${selected.size > 0 ? "max-h-20 opacity-100 mb-4" : "max-h-0 opacity-0"}`}
              >
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                  <span className="text-sm font-medium">
                    {selected.size} selected
                  </span>
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

              {/* Penalty List */}
              {filtered.length > 0 ? (
                <>
                  {/* Select all header */}
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
                            "flex items-center gap-3 py-3 border-b last:border-0 -mx-5 px-5 transition-colors hover:bg-muted/50",
                            selected.has(penalty.id) && "bg-amber-50/50 dark:bg-amber-900/10"
                          )}
                        >
                          {/* Checkbox for pending only */}
                          <div className="w-5 shrink-0">
                            {isPending && (
                              <Checkbox
                                checked={selected.has(penalty.id)}
                                onCheckedChange={() => toggleSelect(penalty.id)}
                              />
                            )}
                          </div>

                          {/* Dot indicator */}
                          <span className={cn(
                            "h-2 w-2 rounded-full shrink-0",
                            isPending ? "bg-amber-500" : isApplied ? "bg-primary" : "bg-muted-foreground"
                          )} />

                          {/* Main content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link
                                to="/loans/$loanId"
                                params={{ loanId: penalty.loanId }}
                                className="font-medium text-sm hover:text-primary truncate"
                              >
                                {penalty.contactName}
                              </Link>
                              <Badge
                                variant="outline"
                                className="text-[10px] shrink-0"
                              >
                                {penalty.penaltyType === "late_fee" ? "Late Fee" : "Daily Interest"}
                              </Badge>
                              {isPending && (
                                <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-100">
                                  Pending
                                </Badge>
                              )}
                              {isApplied && (
                                <Badge className="text-[10px] bg-green-100 text-green-700 border-green-300 hover:bg-green-100">
                                  Paid
                                </Badge>
                              )}
                              {isWaived && (
                                <Badge variant="secondary" className="text-[10px]">
                                  Waived
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Due {formatRelativeDate(penalty.dueDate)}
                              {penalty.daysOverdue > 0 && (
                                <span className="text-destructive ml-1">
                                  ({penalty.daysOverdue}d overdue)
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

                          {/* Amount */}
                          <div className="text-right shrink-0">
                            <p className={cn("font-semibold text-sm", isWaived && "text-muted-foreground line-through")}>
                              {formatCurrency(penalty.amount)}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 shrink-0 w-[120px] justify-end">
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
                      )
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-3 mt-3 border-t">
                      <p className="text-xs text-muted-foreground">
                        {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
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
                <div className="text-center py-8">
                  <Gavel className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">No penalties</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {search || statusFilter !== "all" || loanFilter
                      ? "Try adjusting your filters"
                      : "Penalties will appear here when borrowers have overdue payments"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Needs Attention */}
          <div className={cn("rounded-xl border shadow-sm", pendingItems.length > 0 && "border-amber-300/50")}>
            <div className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-base font-semibold">Needs Attention</h3>
                </div>
                {pendingItems.length > 5 && (
                  <button
                    onClick={() => { setStatusFilter("pending"); setPage(1) }}
                    className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    View all <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
            <div className="p-5 pt-0">
              {pendingItems.length > 0 ? (
                <div className="space-y-0">
                  {pendingItems.slice(0, 5).map((penalty) => (
                    <div
                      key={penalty.id}
                      className="flex items-center gap-3 py-3 border-b last:border-0 hover:bg-muted/50 -mx-5 px-5 transition-colors"
                    >
                      <span className="h-2 w-2 rounded-full shrink-0 bg-amber-500" />
                      <div className="flex-1 min-w-0">
                        <Link
                          to="/loans/$loanId"
                          params={{ loanId: penalty.loanId }}
                          className="text-sm font-medium truncate block hover:text-primary"
                        >
                          {penalty.contactName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {penalty.penaltyType === "late_fee" ? "Late fee" : "Daily interest"}
                          {penalty.daysOverdue > 0 && (
                            <span className="text-destructive ml-1">· {penalty.daysOverdue}d overdue</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className="text-sm font-semibold">{formatCurrency(penalty.amount)}</p>
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setPayingPenalty(penalty)}
                        >
                          Pay
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm">All penalties resolved!</p>
                </div>
              )}
            </div>
          </div>

          {/* Recently Resolved */}
          <div className="rounded-xl border shadow-sm">
            <div className="p-5 pb-3">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-base font-semibold">Recently Resolved</h3>
              </div>
            </div>
            <div className="p-5 pt-0">
              {resolvedItems.length > 0 ? (
                <div className="space-y-0 max-h-[400px] overflow-y-auto">
                  {resolvedItems.map((penalty) => {
                    const isApplied = penalty.status === "applied"
                    return (
                      <div
                        key={penalty.id}
                        className="flex items-center gap-3 py-3 border-b last:border-0 hover:bg-muted/50 -mx-5 px-5 transition-colors group"
                      >
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                          isApplied ? "bg-primary/10" : "bg-muted"
                        )}>
                          {isApplied ? (
                            <Check className="h-4 w-4 text-primary" weight="bold" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground" weight="bold" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Link
                              to="/loans/$loanId"
                              params={{ loanId: penalty.loanId }}
                              className="font-medium text-sm hover:text-primary truncate block"
                            >
                              {penalty.contactName}
                            </Link>
                            <Badge
                              variant={isApplied ? "secondary" : "outline"}
                              className="text-[10px] shrink-0"
                            >
                              {isApplied ? "Paid" : "Waived"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {penalty.appliedAt
                              ? format(new Date(penalty.appliedAt), "MMM d, h:mm a")
                              : penalty.waivedAt
                                ? format(new Date(penalty.waivedAt), "MMM d, h:mm a")
                                : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <p className={cn(
                            "font-semibold text-sm",
                            isApplied ? "text-primary" : "text-muted-foreground line-through"
                          )}>
                            {formatCurrency(penalty.amount)}
                          </p>
                          <div className="max-w-0 overflow-hidden opacity-0 group-hover:max-w-[4rem] group-hover:opacity-100 transition-all duration-200">
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
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Gavel className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No resolved penalties yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </StaggerItem>

      {/* Pay Penalty Dialog (single) */}
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

      {/* Single Action Confirmation Dialog (waive / revert only) */}
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
            <Button variant="outline" onClick={() => setConfirmBatch(null)}>
              Cancel
            </Button>
            <Button onClick={handleBatchPay} disabled={!!batchLoading}>
              {batchLoading === "pay" ? (
                <>
                  <Spinner className="h-4 w-4 animate-spin mr-2" />
                  Paying...
                </>
              ) : (
                `Pay ${selected.size}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Waive Confirmation Dialog */}
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
