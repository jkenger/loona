import { createFileRoute, Link } from "@tanstack/react-router"
import { getUpcomingPayments, getPayments } from "@/server/payments"
import { PenaltyItems } from "@/components/penalty-items"
import { RecordPaymentDialog } from "@/components/record-payment-dialog"
import { ReversePaymentDialog } from "@/components/reverse-payment-dialog"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Receipt,
  Warning,
  Clock,
  Check,
  CurrencyCircleDollar,
  Funnel,
  DownloadSimple,
  TrendUp,
  CalendarCheck,
  ArrowCounterClockwise,
} from "@phosphor-icons/react"
import { subDays, startOfMonth, isAfter, format } from "date-fns"
import { formatRelativeDate } from "@/lib/utils/date"
import { Skeleton } from "@/components/ui/skeleton"
import { AccessDenied } from "@/components/access-denied"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { Stagger, StaggerItem } from "@/components/ui/stagger"

export const Route = createFileRoute("/_dashboard/payments/")({
  loader: async ({ context }) => {
    const { session } = context as { session: { user: { role: string | null } } }
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      return { upcoming: [], history: [], unauthorized: true }
    }
    const [upcoming, history] = await Promise.all([
      getUpcomingPayments(),
      getPayments(),
    ])
    return { upcoming, history, unauthorized: false }
  },
  pendingComponent: PaymentsPageSkeleton,
  component: PaymentsPage,
})

function PaymentsPageSkeleton() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="bg-[hsl(215_45%_14%)] text-white pt-6 lg:pt-8 pb-16">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 space-y-4">
          <Skeleton className="h-5 w-64 bg-white/10" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="border-l-4 border-primary pl-4 space-y-2">
              <Skeleton className="h-10 w-40 bg-white/10" />
              <Skeleton className="h-4 w-52 bg-white/10" />
            </div>
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-8 pb-8 space-y-6 relative">
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="shadow-sm">
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Two column skeleton */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader className="p-4 pb-2">
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </CardContent>
            </Card>
          </div>
          <Card className="shadow-sm">
            <CardHeader className="p-4 pb-2">
              <Skeleton className="h-6 w-36" />
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function PaymentsPage() {
  const { upcoming, history, unauthorized } = Route.useLoaderData()

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
  } | null>(null)

  // Date range filter
  const [dateFilter, setDateFilter] = useState<"all" | "month" | "30days" | "90days">("month")

  // Upcoming pagination
  const [upcomingPage, setUpcomingPage] = useState(1)
  const UPCOMING_PAGE_SIZE = 5

  // Separate overdue from upcoming
  const overdueItems = upcoming.filter((item) => item.status === "overdue")
  const upcomingItems = upcoming.filter((item) => item.status !== "overdue")

  // Calculate stats
  const now = new Date()
  const thisMonthPayments = history.filter((p) => isAfter(new Date(p.paidAt), startOfMonth(now)))
  const collectedThisMonth = thisMonthPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0)
  const overdueAmount = overdueItems.reduce((sum, item) => sum + parseFloat(item.amount) - parseFloat(item.paidAmount), 0)
  const upcomingAmount = upcomingItems.reduce((sum, item) => sum + parseFloat(item.amount) - parseFloat(item.paidAmount), 0)

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
    <div>
      {/* Header with background */}
      <div className="bg-[hsl(215_45%_14%)] text-white pt-6 lg:pt-8 pb-16">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 space-y-4">
          {/* Meta Bar */}
          <div className="flex items-center gap-2 text-sm text-blue-200/70">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/20 text-primary-foreground text-xs font-medium">
              Lender Portal
            </span>
            <span className="text-blue-300/40">·</span>
            <span>Payments</span>
            <span className="text-blue-300/40">·</span>
            <span>{format(new Date(), "EEEE, MMMM d, yyyy")}</span>
          </div>

          {/* Title Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="border-l-4 border-primary pl-4">
              <h1 className="text-4xl font-bold tracking-tight">Payments</h1>
              <p className="text-blue-200/70">Track and record loan payments</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content - overlaps header */}
      <Stagger className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-8 pb-8 space-y-6 relative">

        {/* Stats Row */}
        <StaggerItem className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Card className="shadow-sm">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs md:text-sm text-muted-foreground">Collected</p>
                <TrendUp className="h-4 w-4 text-primary" />
              </div>
              <p className="text-lg md:text-2xl font-bold mt-1">{formatCurrency(collectedThisMonth)}</p>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-destructive/50">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs md:text-sm text-muted-foreground">Overdue</p>
                <Warning className="h-4 w-4 text-destructive" />
              </div>
              <p className="text-lg md:text-2xl font-bold mt-1 text-destructive">{formatCurrency(overdueAmount)}</p>
              <p className="text-xs text-muted-foreground">{overdueItems.length} payment{overdueItems.length !== 1 ? "s" : ""}</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs md:text-sm text-muted-foreground">Upcoming</p>
                <CalendarCheck className="h-4 w-4 text-primary" />
              </div>
              <p className="text-lg md:text-2xl font-bold mt-1">{formatCurrency(upcomingAmount)}</p>
              <p className="text-xs text-muted-foreground">Next 30 days</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs md:text-sm text-muted-foreground">Recorded</p>
                <Receipt className="h-4 w-4 text-primary" />
              </div>
              <p className="text-lg md:text-2xl font-bold mt-1">{thisMonthPayments.length}</p>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Two Column Layout */}
        <StaggerItem className="grid lg:grid-cols-2 gap-6">
          {/* Left Column: Track - Overdue & Upcoming */}
          <div className="space-y-6">
            {/* Overdue Section */}
            <Card className={`shadow-lg ${overdueItems.length > 0 ? "border-destructive/50" : ""}`}>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Warning className="h-5 w-5" weight="bold" />
                  Overdue
                </CardTitle>
                <CardDescription>
                  {overdueItems.length > 0
                    ? `${overdueItems.length} payment${overdueItems.length !== 1 ? "s" : ""} need attention`
                    : "No overdue payments"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {overdueItems.length > 0 ? (
                  <div className="space-y-2">
                    {overdueItems.map((item) => {
                      const remaining = parseFloat(item.amount) - parseFloat(item.paidAmount)
                      const appliedPenaltyTotal = item.penalties
                        .filter((p) => p.status === "applied")
                        .reduce((sum, p) => sum + parseFloat(p.amount), 0)
                      return (
                        <PenaltyItems
                          key={item.id}
                          penalties={item.penalties}
                          daysOverdue={item.daysOverdue}
                          penaltyIn={item.penaltyIn}
                          formatCurrency={formatCurrency}
                        >
                          {({ toggleButton, detailPanel }) => (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between p-3 rounded border border-destructive/30 bg-destructive/5">
                                <div className="min-w-0 flex-1">
                                  <Link
                                    to="/contacts/$contactId"
                                    params={{ contactId: item.contactId }}
                                    className="font-medium text-sm hover:text-primary truncate block"
                                  >
                                    {item.contactName}
                                  </Link>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>Due {formatRelativeDate(item.dueDate)}</span>
                                    {toggleButton}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 ml-2">
                                  <div className="text-right">
                                    <p className="font-semibold text-sm">{formatCurrency(remaining)}</p>
                                    {appliedPenaltyTotal > 0 && (
                                      <p className="text-xs text-amber-600">
                                        + {formatCurrency(appliedPenaltyTotal)} penalty
                                      </p>
                                    )}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => setSelectedScheduleItem(item)}
                                    className="h-8"
                                  >
                                    Record
                                  </Button>
                                </div>
                              </div>
                              {detailPanel && (
                                <div className="ml-3">{detailPanel}</div>
                              )}
                            </div>
                          )}
                        </PenaltyItems>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Check className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <p className="text-sm">All caught up!</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upcoming Section */}
            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      Upcoming
                    </CardTitle>
                    <CardDescription>Next 30 days · {upcomingItems.length} total</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {upcomingItems.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      {upcomingItems
                        .slice((upcomingPage - 1) * UPCOMING_PAGE_SIZE, upcomingPage * UPCOMING_PAGE_SIZE)
                        .map((item) => {
                          const remaining = parseFloat(item.amount) - parseFloat(item.paidAmount)
                          const isPartial = item.status === "partial"
                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-3 rounded border"
                            >
                              <div className="min-w-0 flex-1">
                                <Link
                                  to="/contacts/$contactId"
                                  params={{ contactId: item.contactId }}
                                  className="font-medium text-sm hover:text-primary truncate block"
                                >
                                  {item.contactName}
                                </Link>
                                <p className="text-xs text-muted-foreground">
                                  Due {formatRelativeDate(item.dueDate)}
                                  {isPartial && <Badge variant="secondary" className="ml-2 text-[10px]">Partial</Badge>}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 ml-2">
                                <div className="text-right">
                                  <p className="font-semibold text-sm">{formatCurrency(remaining)}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedScheduleItem(item)}
                                  className="h-8"
                                >
                                  Record
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                    {/* Pagination */}
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
                  <p className="text-muted-foreground text-center py-6 text-sm">
                    No upcoming payments
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: History */}
          <div className="space-y-6">
            {/* History */}
            <Card className="shadow-sm h-fit">
            <CardHeader className="p-4 pb-2">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="h-5 w-5 text-primary" />
                      History
                    </CardTitle>
                    <CardDescription>
                      {filteredHistory.length} recorded
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToCSV}
                    className="gap-1.5"
                  >
                    <DownloadSimple className="h-4 w-4" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>
                </div>
                <div className="flex items-center gap-1">
                  <Funnel className="h-4 w-4 text-muted-foreground mr-1" />
                  {[
                    { key: "month", label: "Month" },
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
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {filteredHistory.length > 0 ? (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredHistory.map((payment) => {
                    const isDebit = payment.type === "debit"
                    const isReversed = payment.type === "credit" && !!payment.reversedAt
                    // Check if this credit is the most recent non-reversed credit for its schedule item
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
                          className="flex items-center justify-between p-3 rounded border border-destructive/20 bg-destructive/5 opacity-80"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
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
                              {payment.notes && (
                                <p className="text-xs text-destructive/70 mt-0.5 truncate">
                                  {payment.notes}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 ml-2">
                            <p className="font-semibold text-sm text-destructive">
                              -{formatCurrency(payment.amount)}
                            </p>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={payment.id}
                        className={`flex items-center justify-between p-3 rounded border ${isReversed ? "opacity-60" : ""}`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isReversed ? "bg-destructive/10" : "bg-primary/10"}`}>
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
                                className={`font-medium text-sm hover:text-primary truncate block ${isReversed ? "line-through" : ""}`}
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
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <p className={`font-semibold text-sm ${isReversed ? "text-muted-foreground line-through" : "text-primary"}`}>
                            +{formatCurrency(payment.amount)}
                          </p>
                          {canReverse && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                              onClick={() => setSelectedPaymentForReversal({
                                id: payment.id,
                                amount: payment.amount,
                                method: payment.method,
                                paidAt: payment.paidAt,
                              })}
                            >
                              <ArrowCounterClockwise className="h-3.5 w-3.5" />
                            </Button>
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
            </CardContent>
          </Card>
          </div>
        </StaggerItem>
      </Stagger>

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        open={!!selectedScheduleItem}
        onOpenChange={(open) => { if (!open) setSelectedScheduleItem(null) }}
        loanId={selectedScheduleItem?.loanId ?? ""}
        borrowerName={selectedScheduleItem?.contactName ?? ""}
        scheduleItem={selectedScheduleItem}
        appliedPenalties={
          selectedScheduleItem
            ? selectedScheduleItem.penalties
                .filter((p) => p.status === "applied")
                .reduce((sum, p) => sum + parseFloat(p.amount), 0)
            : 0
        }
      />

      {/* Reverse Payment Dialog */}
      <ReversePaymentDialog
        open={!!selectedPaymentForReversal}
        onOpenChange={(open) => { if (!open) setSelectedPaymentForReversal(null) }}
        payment={selectedPaymentForReversal}
      />
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
