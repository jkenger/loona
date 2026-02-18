import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import { toast } from "sonner"
import {
  getAllPenalties,
  applyPenalty,
  waivePenalty,
  revertPenalty,
  batchApplyPenalties,
  batchWaivePenalties,
  type AllPenaltyRecord,
} from "@/server/penalties"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
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
  Gavel,
  MagnifyingGlass,
  Spinner,
  ArrowCounterClockwise,
  Check,
  Clock,
  X,
} from "@phosphor-icons/react"
import { formatRelativeDate } from "@/lib/utils/date"

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
    <div>
      <div className="bg-[hsl(215_45%_14%)] text-white pt-6 lg:pt-8 pb-16">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 space-y-4">
          <Skeleton className="h-5 w-48 bg-white/10" />
          <div className="border-l-4 border-primary pl-4 space-y-2">
            <Skeleton className="h-10 w-40 bg-white/10" />
            <Skeleton className="h-4 w-52 bg-white/10" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-8 pb-8 space-y-6 relative">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="shadow-sm">
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
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
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [waivingId, setWaivingId] = useState<string | null>(null)
  const [revertingId, setRevertingId] = useState<string | null>(null)
  const [batchLoading, setBatchLoading] = useState<"apply" | "waive" | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    type: "apply" | "waive" | "revert"
    penalty: AllPenaltyRecord
  } | null>(null)
  const [confirmBatch, setConfirmBatch] = useState<"apply" | "waive" | null>(null)

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

  const handleBatchApply = async () => {
    setConfirmBatch(null)
    setBatchLoading("apply")
    try {
      const ids = Array.from(selected)
      const result = await batchApplyPenalties({ data: { penaltyIds: ids } })
      toast.success(`${result.success} penalt${result.success !== 1 ? "ies" : "y"} applied${result.failed > 0 ? `, ${result.failed} failed` : ""}`)
      setSelected(new Set())
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Batch apply failed")
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
    { key: "applied", label: `Applied (${summary.totalApplied})` },
    { key: "waived", label: `Waived (${summary.totalWaived})` },
  ]

  return (
    <div>
      {/* Header */}
      <div className="bg-[hsl(215_45%_14%)] text-white pt-6 lg:pt-8 pb-16">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="flex items-center gap-2 text-sm text-blue-200/70">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/20 text-primary-foreground text-xs font-medium">
              Lender Portal
            </span>
            <span className="text-blue-300/40">&middot;</span>
            <span>Payments</span>
            <span className="text-blue-300/40">&middot;</span>
            <span>Penalties</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="border-l-4 border-primary pl-4">
              <h1 className="text-4xl font-bold tracking-tight">Payments</h1>
              <p className="text-blue-200/70">
                {summary.totalPending > 0
                  ? `${summary.totalPending} pending penalty decision${summary.totalPending !== 1 ? "s" : ""}`
                  : "All penalties resolved"}
              </p>
            </div>
          </div>

          {/* Section Tabs */}
          <div className="flex items-center gap-1 border-t border-white/10 pt-3">
            <Link
              to="/payments"
              className="px-3 py-1.5 text-sm font-medium text-blue-200/50 hover:text-white transition-colors border-b-2 border-transparent"
            >
              Collections
            </Link>
            <span className="px-3 py-1.5 text-sm font-medium text-white border-b-2 border-primary">
              Penalties
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <Stagger className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-8 pb-8 space-y-6 relative">
        {/* Stats Row */}
        <StaggerItem className="grid grid-cols-3 gap-3 md:gap-4">
          <Card className="shadow-sm border-amber-300/50">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs md:text-sm text-muted-foreground">Pending</p>
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <p className="text-lg md:text-2xl font-bold mt-1 text-amber-600">{summary.totalPending}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(summary.pendingAmount)}</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs md:text-sm text-muted-foreground">Applied</p>
                <Check className="h-4 w-4 text-primary" />
              </div>
              <p className="text-lg md:text-2xl font-bold mt-1">{summary.totalApplied}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(summary.appliedAmount)}</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs md:text-sm text-muted-foreground">Waived</p>
                <X className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-lg md:text-2xl font-bold mt-1">{summary.totalWaived}</p>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Filter Bar */}
        <StaggerItem>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-1">
              {statusTabs.map((tab) => (
                <Button
                  key={tab.key}
                  variant={statusFilter === tab.key ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => { setStatusFilter(tab.key); setPage(1); setSelected(new Set()) }}
                  className="text-xs h-8 px-3"
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
        </StaggerItem>

        {/* Batch Action Bar */}
        <div
          className={`overflow-hidden transition-all duration-200 ${selected.size > 0 ? "max-h-20 opacity-100" : "max-h-0 opacity-0"}`}
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
                className="h-8 text-xs"
              >
                {batchLoading === "waive" ? <Spinner className="h-3 w-3 animate-spin mr-1" /> : null}
                Waive {selected.size}
              </Button>
              <Button
                size="sm"
                onClick={() => setConfirmBatch("apply")}
                disabled={!!batchLoading}
                className="h-8 text-xs"
              >
                {batchLoading === "apply" ? <Spinner className="h-3 w-3 animate-spin mr-1" /> : null}
                Apply {selected.size}
              </Button>
            </div>
          </div>
        </div>

        {/* Penalty List */}
        <StaggerItem>
          {filtered.length > 0 ? (
            <Card className="shadow-sm">
              <CardContent className="p-0">
                {/* Select all header */}
                {selectablePending.length > 0 && (
                  <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30">
                    <Checkbox
                      checked={allSelectedOnPage}
                      onCheckedChange={toggleAllOnPage}
                    />
                    <span className="text-xs text-muted-foreground">
                      Select all pending on this page
                    </span>
                  </div>
                )}
                <div className="divide-y">
                  {pageItems.map((penalty) => {
                    const isPending = penalty.status === "pending"
                    const isApplied = penalty.status === "applied"
                    const isWaived = penalty.status === "waived"

                    return (
                      <div
                        key={penalty.id}
                        className={`flex items-center gap-3 px-4 py-3 ${selected.has(penalty.id) ? "bg-amber-50/50 dark:bg-amber-900/10" : ""}`}
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
                                Applied
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
                        </div>

                        {/* Amount */}
                        <div className="text-right shrink-0">
                          <p className={`font-semibold text-sm ${isWaived ? "text-muted-foreground line-through" : ""}`}>
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
                                disabled={applyingId === penalty.id}
                                onClick={() => setConfirmAction({ type: "apply", penalty })}
                              >
                                {applyingId === penalty.id ? <Spinner className="h-3 w-3 animate-spin" /> : "Apply"}
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
                  <div className="flex items-center justify-between px-4 py-3 border-t">
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
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-sm">
              <CardContent className="p-8 text-center">
                <Gavel className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No penalties</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {search || statusFilter !== "all" || loanFilter
                    ? "Try adjusting your filters"
                    : "Penalties will appear here when borrowers have overdue payments"}
                </p>
              </CardContent>
            </Card>
          )}
        </StaggerItem>
      </Stagger>

      {/* Single Action Confirmation Dialog */}
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
                  to {confirmAction?.penalty.contactName}'s loan balance.
                </>
              ) : confirmAction?.type === "waive" ? (
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
                if (confirmAction.type === "apply") handleApply(confirmAction.penalty.id)
                else if (confirmAction.type === "waive") handleWaive(confirmAction.penalty.id)
                else handleRevert(confirmAction.penalty.id)
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

      {/* Batch Confirmation Dialog */}
      <AlertDialog open={!!confirmBatch} onOpenChange={(open) => !open && setConfirmBatch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmBatch === "apply" ? "Batch Apply Penalties" : "Batch Waive Penalties"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmBatch === "apply" ? (
                <>
                  This will apply <span className="font-semibold text-foreground">{selected.size}</span> pending
                  penalt{selected.size !== 1 ? "ies" : "y"} and add the amounts to their respective loan balances.
                </>
              ) : (
                <>
                  This will waive <span className="font-semibold text-foreground">{selected.size}</span> pending
                  penalt{selected.size !== 1 ? "ies" : "y"}. No amounts will be charged.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmBatch === "apply") handleBatchApply()
                else handleBatchWaive()
              }}
            >
              {confirmBatch === "apply" ? `Apply ${selected.size}` : `Waive ${selected.size}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
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
