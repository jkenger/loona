import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { getUpcomingPayments, getPayments, recordPayment } from "@/server/payments"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CurrencyInput } from "@/components/ui/currency-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  Receipt,
  Warning,
  Clock,
  Check,
  Spinner,
  CurrencyCircleDollar,
  X,
  Notepad,
  Funnel,
  DownloadSimple,
  TrendUp,
  CalendarCheck,
} from "@phosphor-icons/react"
import { subDays, startOfMonth, isAfter, format } from "date-fns"
import { DatePicker } from "@/components/ui/date-picker"
import { formatRelativeDate } from "@/lib/utils/date"
import { Skeleton } from "@/components/ui/skeleton"
import { AccessDenied } from "@/components/access-denied"
import { hasRole, ROLES } from "@/lib/constants/roles"

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
  const router = useRouter()
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

  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentStep, setPaymentStep] = useState<"form" | "confirm">("form")
  const [selectedScheduleItem, setSelectedScheduleItem] = useState<(typeof upcoming)[0] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Payment form state
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<"cash" | "gcash" | "maya" | "bank">("cash")
  const [paidAt, setPaidAt] = useState<Date>(new Date())
  const [notes, setNotes] = useState("")

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

  const openPaymentForm = (item: (typeof upcoming)[0]) => {
    setSelectedScheduleItem(item)
    const remaining = parseFloat(item.amount) - parseFloat(item.paidAmount)
    setAmount(remaining.toString())
    setPaidAt(new Date())
    setPaymentStep("form")
    setShowPaymentForm(true)
  }

  const closePaymentForm = () => {
    setShowPaymentForm(false)
    setSelectedScheduleItem(null)
    setAmount("")
    setPaidAt(new Date())
    setNotes("")
    setError("")
    setPaymentStep("form")
  }

  const handleRecordPayment = async () => {
    if (!selectedScheduleItem) return

    setError("")
    setLoading(true)

    try {
      await recordPayment({
        data: {
          loanId: selectedScheduleItem.loanId,
          scheduleItemId: selectedScheduleItem.id,
          amount: parseFloat(amount),
          method,
          paidAt: format(paidAt, "yyyy-MM-dd"),
          notes: notes || undefined,
        },
      })

      closePaymentForm()
      toast.success("Payment recorded successfully")
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment")
      setError(err instanceof Error ? err.message : "Failed to record payment")
    } finally {
      setLoading(false)
    }
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
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-8 pb-8 space-y-6 relative">

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-6">
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
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 rounded border border-destructive/30 bg-destructive/5"
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
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <div className="text-right">
                              <p className="font-semibold text-sm">{formatCurrency(remaining)}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openPaymentForm(item)}
                              className="h-8"
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
                                  onClick={() => openPaymentForm(item)}
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

          {/* Right Column: Payment Form + History */}
          <div className="space-y-6">
            {/* Payment Form */}
            {showPaymentForm && selectedScheduleItem && (
              <Card className="border-primary shadow-lg">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{paymentStep === "form" ? "Record Payment" : "Confirm Payment"}</CardTitle>
                      <CardDescription>
                        {selectedScheduleItem.contactName} · Due {formatRelativeDate(selectedScheduleItem.dueDate)}
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={closePaymentForm}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {paymentStep === "form" ? (
                    <div className="space-y-4">
                      {/* Schedule item info */}
                      <div className="p-3 rounded bg-muted/50 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Amount Due</span>
                          <span className="font-medium">{formatCurrency(selectedScheduleItem.amount)}</span>
                        </div>
                        {parseFloat(selectedScheduleItem.paidAmount) > 0 && (
                          <div className="flex justify-between mt-1">
                            <span className="text-muted-foreground">Already Paid</span>
                            <span className="font-medium text-primary">{formatCurrency(selectedScheduleItem.paidAmount)}</span>
                          </div>
                        )}
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="amount">Payment Amount</Label>
                          <CurrencyInput
                            id="amount"
                            value={amount}
                            onValueChange={setAmount}
                            placeholder="1,000"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="method">Payment Method</Label>
                          <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                            <SelectTrigger>
                              {{ cash: "Cash", gcash: "GCash", maya: "Maya", bank: "Bank Transfer" }[method]}
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="gcash">GCash</SelectItem>
                              <SelectItem value="maya">Maya</SelectItem>
                              <SelectItem value="bank">Bank Transfer</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2 sm:col-span-2">
                          <Label>Payment Date</Label>
                          <DatePicker
                            value={paidAt}
                            onChange={(date) => date && setPaidAt(date)}
                          />
                        </div>

                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="notes">Notes</Label>
                          <div className="relative">
                            <Notepad className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="notes"
                              placeholder="Optional notes..."
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              className="pl-10"
                            />
                          </div>
                        </div>
                      </div>

                      {error && <p className="text-sm text-destructive">{error}</p>}

                      <div className="flex gap-3">
                        <Button type="button" variant="outline" onClick={closePaymentForm}>
                          Cancel
                        </Button>
                        <Button type="button" onClick={() => setPaymentStep("confirm")} disabled={!amount}>
                          Review Payment
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                        <div className="text-center pb-3 border-b">
                          <p className="text-2xl font-bold text-primary">{formatCurrency(amount)}</p>
                          <p className="text-sm text-muted-foreground">Payment Amount</p>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Borrower</span>
                            <span className="font-medium">{selectedScheduleItem.contactName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Payment Date</span>
                            <span className="font-medium">{format(paidAt, "MMMM d, yyyy")}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Method</span>
                            <span className="font-medium">
                              {{ cash: "Cash", gcash: "GCash", maya: "Maya", bank: "Bank Transfer" }[method]}
                            </span>
                          </div>
                          {notes && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Notes</span>
                              <span className="font-medium text-right max-w-[180px] truncate">{notes}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground text-center">
                        Please review the details above before confirming.
                      </p>

                      {error && <p className="text-sm text-destructive">{error}</p>}

                      <div className="flex gap-3">
                        <Button type="button" variant="outline" onClick={() => setPaymentStep("form")}>
                          Back
                        </Button>
                        <Button type="button" onClick={handleRecordPayment} disabled={loading}>
                          {loading ? (
                            <>
                              <Spinner className="h-4 w-4 animate-spin mr-2" />
                              Recording...
                            </>
                          ) : (
                            "Confirm Payment"
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

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
                  {filteredHistory.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 rounded border"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Check className="h-4 w-4 text-primary" weight="bold" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link
                            to="/loans/$loanId"
                            params={{ loanId: payment.loanId }}
                            className="font-medium text-sm hover:text-primary truncate block"
                          >
                            {payment.contactName}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(payment.paidAt), "MMM d")} · {payment.method.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <p className="font-semibold text-sm text-primary shrink-0 ml-2">
                        +{formatCurrency(payment.amount)}
                      </p>
                    </div>
                  ))}
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
        </div>
      </div>
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
