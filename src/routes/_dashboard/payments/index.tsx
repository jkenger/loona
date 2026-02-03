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
  CalendarCheck,
  Warning,
  Clock,
  Check,
  Spinner,
  CurrencyCircleDollar,
  X,
  Notepad,
  Funnel,
  DownloadSimple,
} from "@phosphor-icons/react"
import { subDays, startOfMonth, isAfter } from "date-fns"
import { formatRelativeDate } from "@/lib/utils/date"
import { Skeleton, SkeletonListItem } from "@/components/ui/skeleton"
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-lg border bg-card">
            <div className="p-4 border-b">
              <Skeleton className="h-6 w-40" />
            </div>
            <div className="divide-y">
              {[1, 2, 3].map((i) => (
                <SkeletonListItem key={i} />
              ))}
            </div>
          </div>
          <div className="rounded-lg border bg-card">
            <div className="p-4 border-b">
              <Skeleton className="h-6 w-36" />
            </div>
            <div className="divide-y">
              {[1, 2, 3, 4, 5].map((i) => (
                <SkeletonListItem key={i} />
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 h-fit space-y-4">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
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
  const [selectedScheduleItem, setSelectedScheduleItem] = useState<(typeof upcoming)[0] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Payment form state
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<"cash" | "gcash" | "maya" | "bank">("cash")
  const [notes, setNotes] = useState("")

  // Date range filter
  const [dateFilter, setDateFilter] = useState<"all" | "month" | "30days" | "90days">("all")

  // Filter history by date range
  const filteredHistory = history.filter((payment) => {
    if (dateFilter === "all") return true
    const paymentDate = new Date(payment.paidAt)
    const now = new Date()

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
    // Pre-fill with remaining amount (total - already paid)
    const remaining = parseFloat(item.amount) - parseFloat(item.paidAmount)
    setAmount(remaining.toString())
    setShowPaymentForm(true)
  }

  const closePaymentForm = () => {
    setShowPaymentForm(false)
    setSelectedScheduleItem(null)
    setAmount("")
    setNotes("")
    setError("")
  }

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
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
          notes: notes || undefined,
        },
      })

      // Reset form and refresh
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

  const statusConfig: Record<string, { icon: typeof Check; className: string; label: string }> = {
    pending: { icon: Clock, className: "text-muted-foreground", label: "Pending" },
    partial: { icon: Clock, className: "text-primary", label: "Partial" },
    overdue: { icon: Warning, className: "text-destructive", label: "Overdue" },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">Track and record loan payments</p>
        </div>
      </div>

      {/* Payment Form Modal */}
      {showPaymentForm && selectedScheduleItem && (
        <Card className="border-primary">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Record Payment</CardTitle>
                <CardDescription>
                  {selectedScheduleItem.contactName} · Due {formatRelativeDate(selectedScheduleItem.dueDate)}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={closePaymentForm}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <form onSubmit={handleRecordPayment} className="space-y-4">
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
                  <Select value={method} onValueChange={(v) => setMethod(v as any)}>
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={closePaymentForm}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Spinner className="h-4 w-4 animate-spin mr-2" />
                      Recording...
                    </>
                  ) : (
                    "Record Payment"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Payments */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Upcoming & Overdue
          </CardTitle>
          <CardDescription>Next 30 days</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {upcoming.length > 0 ? (
            <div className="space-y-3">
              {upcoming.map((item) => {
                const config = statusConfig[item.status]
                const StatusIcon = config.icon
                const isOverdue = item.status === "overdue"

                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3 rounded border ${
                      isOverdue ? "border-destructive/50 bg-destructive/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <StatusIcon className={`h-5 w-5 ${config.className}`} weight="bold" />
                      <div>
                        <Link
                          to="/contacts/$contactId"
                          params={{ contactId: item.contactId }}
                          className="font-medium hover:text-primary"
                        >
                          {item.contactName}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          Due {formatRelativeDate(item.dueDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(item.amount)}</p>
                        <Badge variant={isOverdue ? "destructive" : "secondary"}>
                          {config.label}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPaymentForm(item)}
                      >
                        Pay
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No upcoming payments
            </p>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Payment History
              </CardTitle>
              <CardDescription>
                {filteredHistory.length} payment{filteredHistory.length !== 1 ? "s" : ""}
                {dateFilter !== "all" && ` (filtered)`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Funnel className="h-4 w-4 text-muted-foreground mr-1" />
                {[
                  { key: "all", label: "All" },
                  { key: "month", label: "This Month" },
                  { key: "30days", label: "30 Days" },
                  { key: "90days", label: "90 Days" },
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
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {filteredHistory.length > 0 ? (
            <div className="space-y-3">
              {filteredHistory.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 rounded border"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Check className="h-5 w-5 text-primary" weight="bold" />
                    </div>
                    <div>
                      <Link
                        to="/loans/$loanId"
                        params={{ loanId: payment.loanId }}
                        className="font-medium hover:text-primary"
                      >
                        {payment.contactName}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {new Date(payment.paidAt).toLocaleDateString()} via{" "}
                        {payment.method.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary">
                      +{formatCurrency(payment.amount)}
                    </p>
                    {payment.notes && (
                      <p className="text-xs text-muted-foreground">{payment.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CurrencyCircleDollar className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">
                {history.length > 0
                  ? "No payments in selected date range"
                  : "No payment history yet"}
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
