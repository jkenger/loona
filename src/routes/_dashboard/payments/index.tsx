import { createFileRoute, Link } from "@tanstack/react-router"
import { getUpcomingPayments, getPayments, getMonthlyPaymentStats } from "@/server/payments"
import { PenaltyBadge } from "@/components/penalty-badge"
import { RecordPaymentDialog } from "@/components/record-payment-dialog"
import { ReversePaymentDialog } from "@/components/reverse-payment-dialog"
import { EditPaymentDateDialog } from "@/components/edit-payment-date-dialog"
import { useState, useMemo } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Receipt,
  Check,
  CurrencyCircleDollar,
  DownloadSimple,
  ArrowCounterClockwise,
  PencilSimple,
  LinkSimple,
  ArrowRight,
  CheckCircle,
  MagnifyingGlass,
} from "@phosphor-icons/react"
import { subDays, startOfMonth, isAfter, format, isToday, isTomorrow, addDays, isBefore } from "date-fns"
import { formatRelativeDate } from "@/lib/utils/date"
import { Skeleton } from "@/components/ui/skeleton"
import { AccessDenied } from "@/components/access-denied"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { Stagger, StaggerItem } from "@/components/ui/stagger"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_dashboard/payments/")({
  loader: async ({ context }) => {
    const { session } = context as { session: { user: { role: string | null } } }
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      return { upcoming: [], history: [], monthlyStats: null, unauthorized: true }
    }
    const [upcoming, history, monthlyStats] = await Promise.all([
      getUpcomingPayments(),
      getPayments(),
      getMonthlyPaymentStats(),
    ])
    return { upcoming, history, monthlyStats, unauthorized: false }
  },
  pendingComponent: PaymentsPageSkeleton,
  component: PaymentsPage,
})

function PaymentsPageSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-52 mt-2" />
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-xl" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  )
}

function PaymentsPage() {
  const { upcoming, history, monthlyStats, unauthorized } = Route.useLoaderData()

  if (unauthorized) {
    return (
      <AccessDenied
        message="Only lenders can access the payments page."
        homeLink="/agent"
        homeLinkLabel="Go to Agent Portal"
      />
    )
  }

  const [selectedScheduleItem, setSelectedScheduleItem] = useState<(typeof upcoming)[0] | null>(null)

  const [selectedPaymentForReversal, setSelectedPaymentForReversal] = useState<{
    id: string; amount: string; method: string; paidAt: string
    scheduleDueDate: string | null; scheduleAmount: string | null
  } | null>(null)

  const [selectedPaymentForEdit, setSelectedPaymentForEdit] = useState<{
    id: string; amount: string; method: string; paidAt: string
    scheduleDueDate: string | null; scheduleAmount: string | null
  } | null>(null)

  const [dateFilter, setDateFilter] = useState<"all" | "month" | "30days" | "90days">("month")
  const [historySearch, setHistorySearch] = useState("")

  const now = new Date()

  // Split + group due items
  const overdueItems = useMemo(
    () => upcoming.filter((item) => item.status === "overdue"),
    [upcoming]
  )
  const upcomingItems = useMemo(
    () => upcoming.filter((item) => item.status !== "overdue"),
    [upcoming]
  )

  const groupedUpcoming = useMemo(() => {
    const today: typeof upcomingItems = []
    const tomorrow: typeof upcomingItems = []
    const thisWeek: typeof upcomingItems = []
    const later: typeof upcomingItems = []
    const sevenDaysOut = addDays(now, 7)
    for (const item of upcomingItems) {
      const due = new Date(item.dueDate)
      if (isToday(due)) today.push(item)
      else if (isTomorrow(due)) tomorrow.push(item)
      else if (isBefore(due, sevenDaysOut)) thisWeek.push(item)
      else later.push(item)
    }
    return { today, tomorrow, thisWeek, later }
  }, [upcomingItems])

  const overdueAmount = overdueItems.reduce(
    (sum, item) => sum + parseFloat(item.amount) - parseFloat(item.paidAmount),
    0
  )

  const expectedAmount = monthlyStats?.expectedAmount ?? 0
  const collectedAmount = monthlyStats?.collectedAmount ?? 0
  const collectionRate = monthlyStats?.collectionRate ?? 0
  const expectedCount = monthlyStats?.expectedCount ?? 0
  const collectedCount = monthlyStats?.collectedCount ?? 0
  const collectionProgress =
    expectedAmount > 0 ? Math.min((collectedAmount / expectedAmount) * 100, 100) : 0

  // Filter history by date range + search
  const filteredHistory = useMemo(() => {
    let items = history
    if (dateFilter !== "all") {
      items = items.filter((payment) => {
        const paymentDate = new Date(payment.paidAt)
        switch (dateFilter) {
          case "month":
            return isAfter(paymentDate, startOfMonth(now))
          case "30days":
            return isAfter(paymentDate, subDays(now, 30))
          case "90days":
            return isAfter(paymentDate, subDays(now, 90))
          default:
            return true
        }
      })
    }
    if (historySearch.trim()) {
      const q = historySearch.trim().toLowerCase()
      items = items.filter(
        (p) =>
          p.contactName.toLowerCase().includes(q) ||
          p.amount.toString().includes(q) ||
          (p.notes ?? "").toLowerCase().includes(q)
      )
    }
    return items
  }, [history, dateFilter, historySearch])

  const exportToCSV = () => {
    if (filteredHistory.length === 0) {
      toast.error("No payments to export")
      return
    }
    const headers = ["Date", "Contact", "Amount", "Method", "Notes"]
    const rows = filteredHistory.map((p) => [
      new Date(p.paidAt).toLocaleDateString(),
      p.contactName,
      p.amount,
      p.method.toUpperCase(),
      p.notes || "",
    ])
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `payments-${new Date().toISOString().split("T")[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success("Payments exported to CSV")
  }

  const renderDueRow = (item: (typeof upcoming)[0], isOverdue: boolean) => {
    const remaining = parseFloat(item.amount) - parseFloat(item.paidAmount)
    const isPartial = item.status === "partial"
    return (
      <div
        key={item.id}
        className="flex items-center gap-3 py-3 border-b last:border-0 group"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              to="/loans/$loanId"
              params={{ loanId: item.loanId }}
              className="text-sm font-medium truncate block hover:text-primary transition-colors"
            >
              {item.contactName}
            </Link>
            {isOverdue && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 px-1.5 py-0.5 rounded shrink-0">
                {item.daysOverdue}d overdue
              </span>
            )}
            {isPartial && (
              <Badge variant="secondary" className="text-[10px] h-5 shrink-0">
                Partial
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span>{format(new Date(item.dueDate), "MMM d")}</span>
            {!isOverdue && (
              <span className="opacity-70">· {formatRelativeDate(item.dueDate)}</span>
            )}
            {isOverdue && (
              <PenaltyBadge
                penalties={item.penalties}
                formatCurrency={formatCurrency}
                loanId={item.loanId}
              />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <p className="text-sm font-semibold">{formatCurrency(remaining)}</p>
          <Button
            size="sm"
            variant={isOverdue ? "default" : "outline"}
            onClick={() => setSelectedScheduleItem(item)}
            className="h-7 text-xs"
          >
            Record
          </Button>
        </div>
      </div>
    )
  }

  const dueGroupLabel = (title: string, count: number) => (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </span>
      <span className="bg-muted rounded px-1.5 py-0.5 text-[10px] font-medium">{count}</span>
    </div>
  )

  const totalDueCount =
    overdueItems.length +
    groupedUpcoming.today.length +
    groupedUpcoming.tomorrow.length +
    groupedUpcoming.thisWeek.length +
    groupedUpcoming.later.length

  return (
    <Stagger className="px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">Record collections, track what's due, review history</p>
        </div>
        <Link
          to="/penalties"
          search={{ loan: undefined }}
          className="shrink-0 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Penalties
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* KPI Hero Strip — Collection Progress */}
      <StaggerItem>
        <div className="rounded-xl border bg-card p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              This Month
            </p>
            <p className="text-xs text-muted-foreground">
              {collectedCount} of {expectedCount} collected
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 sm:gap-6">
            <div>
              <p className="text-xs text-muted-foreground">Expected</p>
              <p className="text-xl sm:text-2xl font-bold tracking-tight mt-0.5">
                {formatCurrency(expectedAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Collected</p>
              <p className="text-xl sm:text-2xl font-bold tracking-tight mt-0.5">
                {formatCurrency(collectedAmount)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{collectionRate}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Overdue</p>
              <p
                className={cn(
                  "text-xl sm:text-2xl font-bold tracking-tight mt-0.5",
                  overdueItems.length > 0 && "text-amber-600 dark:text-amber-400"
                )}
              >
                {formatCurrency(overdueAmount)}
              </p>
              {overdueItems.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {overdueItems.length} {overdueItems.length === 1 ? "borrower" : "borrowers"}
                </p>
              )}
            </div>
          </div>
          <div className="mt-5">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${collectionProgress}%` }}
              />
            </div>
          </div>
        </div>
      </StaggerItem>

      {/* Due Collections (unified list) */}
      <StaggerItem>
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-5 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Due Collections</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {totalDueCount === 0
                  ? "Nothing due"
                  : `${totalDueCount} to collect`}
              </p>
            </div>
            {totalDueCount > 0 && (
              <Link
                to="/loans"
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                View loans <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
          <div className="p-5 pt-0 space-y-5">
            {totalDueCount === 0 ? (
              <div className="py-10 text-center">
                <CheckCircle className="h-8 w-8 text-primary mx-auto mb-2" weight="fill" />
                <p className="text-sm font-medium">All caught up</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  No overdue or upcoming collections in the next 30 days.
                </p>
              </div>
            ) : (
              <>
                {overdueItems.length > 0 && (
                  <div>
                    {dueGroupLabel("Overdue", overdueItems.length)}
                    <div className="space-y-0">
                      {overdueItems.map((item) => renderDueRow(item, true))}
                    </div>
                  </div>
                )}
                {groupedUpcoming.today.length > 0 && (
                  <div>
                    {dueGroupLabel("Today", groupedUpcoming.today.length)}
                    <div className="space-y-0">
                      {groupedUpcoming.today.map((item) => renderDueRow(item, false))}
                    </div>
                  </div>
                )}
                {groupedUpcoming.tomorrow.length > 0 && (
                  <div>
                    {dueGroupLabel("Tomorrow", groupedUpcoming.tomorrow.length)}
                    <div className="space-y-0">
                      {groupedUpcoming.tomorrow.map((item) => renderDueRow(item, false))}
                    </div>
                  </div>
                )}
                {groupedUpcoming.thisWeek.length > 0 && (
                  <div>
                    {dueGroupLabel("This Week", groupedUpcoming.thisWeek.length)}
                    <div className="space-y-0">
                      {groupedUpcoming.thisWeek.map((item) => renderDueRow(item, false))}
                    </div>
                  </div>
                )}
                {groupedUpcoming.later.length > 0 && (
                  <div>
                    {dueGroupLabel("Later", groupedUpcoming.later.length)}
                    <div className="space-y-0">
                      {groupedUpcoming.later.map((item) => renderDueRow(item, false))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </StaggerItem>

      {/* Payment History */}
      <StaggerItem>
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-5 pb-3">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-base font-semibold">Payment History</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                className="gap-1.5 h-8"
              >
                <DownloadSimple className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by name, amount, or notes"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="h-9 pl-9 text-sm bg-muted/40 border-transparent focus-visible:bg-background focus-visible:border-input"
                />
              </div>
              <div className="flex items-center gap-1 bg-muted/40 rounded-md p-0.5 self-start sm:self-auto">
                {[
                  { key: "month", label: "Month" },
                  { key: "30days", label: "30d" },
                  { key: "90days", label: "90d" },
                  { key: "all", label: "All" },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => setDateFilter(filter.key as typeof dateFilter)}
                    className={cn(
                      "text-xs h-8 px-3 rounded font-medium transition-colors",
                      dateFilter === filter.key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="px-5 pb-5">
            {filteredHistory.length > 0 ? (
              <div className="space-y-0 max-h-[560px] overflow-y-auto -mx-5">
                {filteredHistory.map((payment) => {
                  const isDebit = payment.type === "debit"
                  const isReversed = payment.type === "credit" && !!payment.reversedAt
                  const canReverse =
                    payment.type === "credit" &&
                    !payment.reversedAt &&
                    payment.scheduleItemId &&
                    !history.some(
                      (other) =>
                        other.id !== payment.id &&
                        other.type === "credit" &&
                        !other.reversedAt &&
                        other.scheduleItemId === payment.scheduleItemId &&
                        new Date(other.createdAt) > new Date(payment.createdAt)
                    )

                  if (isDebit) {
                    return (
                      <div
                        key={payment.id}
                        className="flex items-center gap-3 py-3 border-b last:border-0 px-5 opacity-70"
                      >
                        <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-muted">
                          <ArrowCounterClockwise className="h-4 w-4 text-muted-foreground" weight="bold" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Link
                              to="/loans/$loanId"
                              params={{ loanId: payment.loanId }}
                              className="font-medium text-sm hover:text-primary truncate block"
                            >
                              {payment.contactName}
                            </Link>
                            <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                              Reversal
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(payment.paidAt), "MMM d, h:mm a")}
                          </p>
                        </div>
                        <p className="font-medium text-sm shrink-0">
                          −{formatCurrency(payment.amount)}
                        </p>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={payment.id}
                      className={cn(
                        "flex items-center gap-3 py-3 border-b last:border-0 px-5 group transition-colors",
                        isReversed ? "opacity-60" : "hover:bg-muted/50"
                      )}
                    >
                      <div
                        className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                          isReversed ? "bg-muted" : "bg-primary/10"
                        )}
                      >
                        {isReversed ? (
                          <ArrowCounterClockwise className="h-4 w-4 text-muted-foreground" weight="bold" />
                        ) : (
                          <Check className="h-4 w-4 text-primary" weight="bold" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link
                            to="/loans/$loanId"
                            params={{ loanId: payment.loanId }}
                            className={cn(
                              "font-medium text-sm hover:text-primary truncate block",
                              isReversed && "line-through"
                            )}
                          >
                            {payment.contactName}
                          </Link>
                          {isReversed && (
                            <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                              Reversed
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(payment.paidAt), "MMM d, h:mm a")} · {payment.method.toUpperCase()}
                        </p>
                        {isReversed && payment.reversalReason && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                            {payment.reversalReason}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <p
                          className={cn(
                            "font-semibold text-sm",
                            isReversed && "line-through text-muted-foreground"
                          )}
                        >
                          +{formatCurrency(payment.amount)}
                        </p>
                        {payment.type === "credit" && !payment.reversedAt && (
                          <div className="flex items-center gap-0.5 max-w-0 overflow-hidden opacity-0 group-hover:max-w-[6rem] group-hover:opacity-100 transition-all duration-200">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-primary"
                              onClick={() => {
                                const url = `${window.location.origin}/share/receipt/${payment.id}`
                                navigator.clipboard.writeText(url)
                                toast.success("Receipt link copied to clipboard")
                              }}
                            >
                              <LinkSimple className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-primary"
                              onClick={() =>
                                setSelectedPaymentForEdit({
                                  id: payment.id,
                                  amount: payment.amount,
                                  method: payment.method,
                                  paidAt: payment.paidAt,
                                  scheduleDueDate: payment.scheduleDueDate,
                                  scheduleAmount: payment.scheduleAmount,
                                })
                              }
                            >
                              <PencilSimple className="h-3.5 w-3.5" />
                            </Button>
                            {canReverse && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() =>
                                  setSelectedPaymentForReversal({
                                    id: payment.id,
                                    amount: payment.amount,
                                    method: payment.method,
                                    paidAt: payment.paidAt,
                                    scheduleDueDate: payment.scheduleDueDate,
                                    scheduleAmount: payment.scheduleAmount,
                                  })
                                }
                              >
                                <ArrowCounterClockwise className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-10">
                <CurrencyCircleDollar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {history.length > 0
                    ? historySearch.trim()
                      ? "No matches for your search"
                      : "No payments in selected period"
                    : "No payments recorded yet"}
                </p>
                {history.length > 0 && (dateFilter !== "all" || historySearch.trim()) && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setDateFilter("all")
                      setHistorySearch("")
                    }}
                    className="mt-2"
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </StaggerItem>

      {/* Dialogs */}
      <RecordPaymentDialog
        open={!!selectedScheduleItem}
        onOpenChange={(open) => { if (!open) setSelectedScheduleItem(null) }}
        loanId={selectedScheduleItem?.loanId ?? ""}
        borrowerName={selectedScheduleItem?.contactName ?? ""}
        scheduleItem={selectedScheduleItem}
        appliedPenalties={0}
      />

      <ReversePaymentDialog
        open={!!selectedPaymentForReversal}
        onOpenChange={(open) => { if (!open) setSelectedPaymentForReversal(null) }}
        payment={selectedPaymentForReversal}
        scheduleInfo={selectedPaymentForReversal?.scheduleDueDate && selectedPaymentForReversal?.scheduleAmount
          ? { label: "Installment", dueDate: selectedPaymentForReversal.scheduleDueDate, amount: selectedPaymentForReversal.scheduleAmount }
          : null}
      />

      <EditPaymentDateDialog
        open={!!selectedPaymentForEdit}
        onOpenChange={(open) => { if (!open) setSelectedPaymentForEdit(null) }}
        payment={selectedPaymentForEdit}
        scheduleInfo={selectedPaymentForEdit?.scheduleDueDate && selectedPaymentForEdit?.scheduleAmount
          ? { label: "Installment", dueDate: selectedPaymentForEdit.scheduleDueDate, amount: selectedPaymentForEdit.scheduleAmount }
          : null}
      />
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
