import { createFileRoute, Link } from "@tanstack/react-router"
import { getUpcomingPayments, getPayments, getMonthlyPaymentStats } from "@/server/payments"
import { PenaltyBadge } from "@/components/penalty-badge"
import { RecordPaymentDialog } from "@/components/record-payment-dialog"
import { ReversePaymentDialog } from "@/components/reverse-payment-dialog"
import { EditPaymentDateDialog } from "@/components/edit-payment-date-dialog"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Receipt,
  Warning,
  Clock,
  Check,
  CurrencyCircleDollar,
  Funnel,
  DownloadSimple,
  ArrowCounterClockwise,
  PencilSimple,
  LinkSimple,
  ArrowRight,
  ChartBar,
  CheckCircle,
} from "@phosphor-icons/react"
import { subDays, startOfMonth, isAfter, format } from "date-fns"
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
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        </div>
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-xl border shadow-sm p-5 space-y-3">
            <Skeleton className="h-5 w-24" />
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
          <div className="rounded-xl border shadow-sm p-5 space-y-3">
            <Skeleton className="h-5 w-24" />
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
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

  // Reverse payment dialog state
  const [selectedPaymentForReversal, setSelectedPaymentForReversal] = useState<{
    id: string; amount: string; method: string; paidAt: string
    scheduleDueDate: string | null; scheduleAmount: string | null
  } | null>(null)

  // Edit payment date dialog state
  const [selectedPaymentForEdit, setSelectedPaymentForEdit] = useState<{
    id: string; amount: string; method: string; paidAt: string
    scheduleDueDate: string | null; scheduleAmount: string | null
  } | null>(null)

  // Date range filter
  const [dateFilter, setDateFilter] = useState<"all" | "month" | "30days" | "90days">("month")

  // Upcoming pagination
  const [upcomingPage, setUpcomingPage] = useState(1)
  const UPCOMING_PAGE_SIZE = 5

  // Separate overdue from upcoming
  const overdueItems = upcoming.filter((item) => item.status === "overdue")
  const upcomingItems = upcoming.filter((item) => item.status !== "overdue")

  const now = new Date()
  const overdueAmount = overdueItems.reduce((sum, item) => sum + parseFloat(item.amount) - parseFloat(item.paidAmount), 0)

  // Monthly stats
  const expectedAmount = monthlyStats?.expectedAmount ?? 0
  const collectedAmount = monthlyStats?.collectedAmount ?? 0
  const collectionRate = monthlyStats?.collectionRate ?? 0
  const expectedCount = monthlyStats?.expectedCount ?? 0
  const collectedCount = monthlyStats?.collectedCount ?? 0
  const collectionProgress = expectedAmount > 0 ? Math.min((collectedAmount / expectedAmount) * 100, 100) : 0

  // Filter history by date range
  const filteredHistory = history.filter((payment) => {
    if (dateFilter === "all") return true
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
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
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

  return (
    <Stagger className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
        <p className="text-muted-foreground">Track and record loan payments</p>
        <div className="flex items-center gap-1 mt-4">
          <span className="px-3 py-1.5 text-sm font-medium text-foreground border-b-2 border-primary">
            Collections
          </span>
          <Link
            to="/penalties"
            search={{ loan: undefined }}
            className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent"
          >
            Penalties
          </Link>
        </div>
      </div>

      {/* Bento Grid */}
      <StaggerItem className="grid gap-5 lg:grid-cols-5">
        {/* Left Column */}
        <div className="lg:col-span-3 space-y-5">
          {/* Collection Progress */}
          <div className="rounded-xl border shadow-sm">
            <div className="p-5 pb-3">
              <div className="flex items-center gap-2">
                <ChartBar className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-base font-semibold">Collection Progress</h3>
              </div>
            </div>
            <div className="p-5 pt-0">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground">Expected</p>
                  <p className="text-lg font-bold">{formatCurrency(expectedAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Collected</p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(collectedAmount)}</p>
                  <p className="text-xs text-muted-foreground">{collectionRate}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Overdue</p>
                  <p className={cn("text-lg font-bold", overdueItems.length > 0 && "text-destructive")}>
                    {overdueItems.length > 0 ? formatCurrency(overdueAmount) : formatCurrency(0)}
                  </p>
                </div>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${collectionProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {collectedCount} of {expectedCount} payments collected
              </p>
            </div>
          </div>

          {/* Upcoming Collections */}
          <div className="rounded-xl border shadow-sm">
            <div className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-base font-semibold">Upcoming Collections</h3>
                </div>
                <Link
                  to="/loans"
                  className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
            <div className="p-5 pt-0">
              {upcomingItems.length > 0 ? (
                <>
                  <div className="space-y-0">
                    {upcomingItems
                      .slice((upcomingPage - 1) * UPCOMING_PAGE_SIZE, upcomingPage * UPCOMING_PAGE_SIZE)
                      .map((item) => {
                        const remaining = parseFloat(item.amount) - parseFloat(item.paidAmount)
                        const isPartial = item.status === "partial"
                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 py-3 border-b last:border-0 hover:bg-muted/50 -mx-5 px-5 transition-colors"
                          >
                            <span className="h-2 w-2 rounded-full shrink-0 bg-primary" />
                            <div className="flex-1 min-w-0">
                              <Link
                                to="/loans/$loanId"
                                params={{ loanId: item.loanId }}
                                className="text-sm font-medium truncate block hover:text-primary"
                              >
                                {item.contactName}
                              </Link>
                              <p className="text-xs text-muted-foreground">
                                {formatRelativeDate(item.dueDate)}
                                {isPartial && <Badge variant="secondary" className="ml-2 text-[10px]">Partial</Badge>}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <p className="text-sm font-semibold">{formatCurrency(remaining)}</p>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedScheduleItem(item)}
                                className="h-7 text-xs"
                              >
                                Record
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                  {upcomingItems.length > UPCOMING_PAGE_SIZE && (
                    <div className="flex items-center justify-between mt-4 pt-3 border-t">
                      <p className="text-xs text-muted-foreground">
                        {(upcomingPage - 1) * UPCOMING_PAGE_SIZE + 1}-{Math.min(upcomingPage * UPCOMING_PAGE_SIZE, upcomingItems.length)} of {upcomingItems.length}
                      </p>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setUpcomingPage((p) => Math.max(1, p - 1))}
                          disabled={upcomingPage === 1}
                        >
                          Prev
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setUpcomingPage((p) => Math.min(Math.ceil(upcomingItems.length / UPCOMING_PAGE_SIZE), p + 1))}
                          disabled={upcomingPage >= Math.ceil(upcomingItems.length / UPCOMING_PAGE_SIZE)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-8 text-center">
                  <CheckCircle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No upcoming payments</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Overdue */}
          <div className={cn("rounded-xl border shadow-sm", overdueItems.length > 0 && "border-destructive/50")}>
            <div className="p-5 pb-3">
              <div className="flex items-center gap-2">
                <Warning className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-base font-semibold">Overdue</h3>
              </div>
            </div>
            <div className="p-5 pt-0">
              {overdueItems.length > 0 ? (
                <div className="space-y-0">
                  {overdueItems.map((item) => {
                    const remaining = parseFloat(item.amount) - parseFloat(item.paidAmount)
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 py-3 border-b last:border-0 hover:bg-muted/50 -mx-5 px-5 transition-colors"
                      >
                        <span className="h-2 w-2 rounded-full shrink-0 bg-destructive" />
                        <div className="flex-1 min-w-0">
                          <Link
                            to="/loans/$loanId"
                            params={{ loanId: item.loanId }}
                            className="text-sm font-medium truncate block hover:text-primary text-destructive"
                          >
                            {item.contactName}
                          </Link>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{item.daysOverdue}d overdue</span>
                            <PenaltyBadge
                              penalties={item.penalties}
                              formatCurrency={formatCurrency}
                              loanId={item.loanId}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className="text-sm font-semibold text-destructive">{formatCurrency(remaining)}</p>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setSelectedScheduleItem(item)}
                            className="h-7 text-xs"
                          >
                            Record
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm">All caught up!</p>
                </div>
              )}
            </div>
          </div>

          {/* Payment History */}
          <div className="rounded-xl border shadow-sm">
            <div className="p-5 pb-3">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-base font-semibold">History</h3>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToCSV}
                    className="gap-1.5 h-7 text-xs"
                  >
                    <DownloadSimple className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>
                </div>
                <div className="flex items-center gap-1">
                  <Funnel className="h-4 w-4 text-muted-foreground mr-1" />
                  {[
                    { key: "month", label: "Mo" },
                    { key: "30days", label: "30d" },
                    { key: "90days", label: "90d" },
                    { key: "all", label: "All" },
                  ].map((filter) => (
                    <Button
                      key={filter.key}
                      variant={dateFilter === filter.key ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setDateFilter(filter.key as typeof dateFilter)}
                      className="text-xs h-7 px-2"
                    >
                      {filter.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-5 pt-0">
              {filteredHistory.length > 0 ? (
                <div className="space-y-0 max-h-[500px] overflow-y-auto">
                  {filteredHistory.map((payment) => {
                    const isDebit = payment.type === "debit"
                    const isReversed = payment.type === "credit" && !!payment.reversedAt
                    const canReverse = payment.type === "credit" && !payment.reversedAt && payment.scheduleItemId && !history.some(
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
                          className="flex items-center gap-3 py-3 border-b last:border-0 -mx-5 px-5 opacity-80"
                        >
                          <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-destructive/10">
                            <ArrowCounterClockwise className="h-4 w-4 text-destructive" weight="bold" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Link
                                to="/loans/$loanId"
                                params={{ loanId: payment.loanId }}
                                className="font-medium text-sm hover:text-primary truncate block text-destructive"
                              >
                                {payment.contactName}
                              </Link>
                              <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30 shrink-0">
                                Reversal
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(payment.paidAt), "MMM d, h:mm a")}
                            </p>
                          </div>
                          <p className="font-semibold text-sm text-destructive shrink-0">
                            -{formatCurrency(payment.amount)}
                          </p>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={payment.id}
                        className={cn(
                          "flex items-center gap-3 py-3 border-b last:border-0 hover:bg-muted/50 -mx-5 px-5 transition-colors group",
                          isReversed && "opacity-60"
                        )}
                      >
                        <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", isReversed ? "bg-destructive/10" : "bg-primary/10")}>
                          {isReversed ? (
                            <ArrowCounterClockwise className="h-4 w-4 text-destructive" weight="bold" />
                          ) : (
                            <Check className="h-4 w-4 text-primary" weight="bold" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Link
                              to="/loans/$loanId"
                              params={{ loanId: payment.loanId }}
                              className={cn("font-medium text-sm hover:text-primary truncate block", isReversed && "line-through")}
                            >
                              {payment.contactName}
                            </Link>
                            {isReversed && (
                              <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30 shrink-0">
                                Reversed
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(payment.paidAt), "MMM d, h:mm a")} · {payment.method.toUpperCase()}
                          </p>
                          {isReversed && payment.reversalReason && (
                            <p className="text-xs text-destructive/70 mt-0.5 truncate">
                              Reason: {payment.reversalReason}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <p className={cn("font-semibold text-sm", isReversed ? "text-muted-foreground line-through" : "text-primary")}>
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
                                onClick={() => setSelectedPaymentForEdit({
                                  id: payment.id,
                                  amount: payment.amount,
                                  method: payment.method,
                                  paidAt: payment.paidAt,
                                  scheduleDueDate: payment.scheduleDueDate,
                                  scheduleAmount: payment.scheduleAmount,
                                })}
                              >
                                <PencilSimple className="h-3.5 w-3.5" />
                              </Button>
                              {canReverse && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => setSelectedPaymentForReversal({
                                    id: payment.id,
                                    amount: payment.amount,
                                    method: payment.method,
                                    paidAt: payment.paidAt,
                                    scheduleDueDate: payment.scheduleDueDate,
                                    scheduleAmount: payment.scheduleAmount,
                                  })}
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
                <div className="text-center py-8">
                  <CurrencyCircleDollar className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">
                    {history.length > 0
                      ? "No payments in selected period"
                      : "No payments recorded yet"}
                  </p>
                  {history.length > 0 && dateFilter !== "all" && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setDateFilter("all")}
                      className="mt-2"
                    >
                      Show all payments
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </StaggerItem>

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        open={!!selectedScheduleItem}
        onOpenChange={(open) => { if (!open) setSelectedScheduleItem(null) }}
        loanId={selectedScheduleItem?.loanId ?? ""}
        borrowerName={selectedScheduleItem?.contactName ?? ""}
        scheduleItem={selectedScheduleItem}
        appliedPenalties={0}
      />

      {/* Reverse Payment Dialog */}
      <ReversePaymentDialog
        open={!!selectedPaymentForReversal}
        onOpenChange={(open) => { if (!open) setSelectedPaymentForReversal(null) }}
        payment={selectedPaymentForReversal}
        scheduleInfo={selectedPaymentForReversal?.scheduleDueDate && selectedPaymentForReversal?.scheduleAmount
          ? { label: "Installment", dueDate: selectedPaymentForReversal.scheduleDueDate, amount: selectedPaymentForReversal.scheduleAmount }
          : null}
      />

      {/* Edit Payment Date Dialog */}
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
