import { createFileRoute } from '@tanstack/react-router'
import { format, subDays, startOfMonth, isAfter } from 'date-fns'
import { getAgentPayments, getAgentUpcomingPayments, getAgentDashboard } from '@/server/agents'
import { PenaltyBadge } from '@/components/penalty-badge'
import { RecordPaymentDialog } from '@/components/record-payment-dialog'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AccessDenied } from '@/components/access-denied'
import { hasRole, ROLES } from '@/lib/constants/roles'
import { useState } from 'react'
import {
  Receipt,
  Clock,
  Warning,
  Check,
  Funnel,
  TrendUp,
  CalendarCheck,
  CurrencyCircleDollar,
} from '@phosphor-icons/react'
import { formatRelativeDate } from '@/lib/utils/date'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_dashboard/agent/payments')({
  loader: async ({ context }) => {
    const { session } = context as {
      session: { user: { role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.AGENT)) {
      return { payments: [], upcoming: [], canRecordPayments: false, unauthorized: true }
    }
    const [payments, upcoming, dashboard] = await Promise.all([
      getAgentPayments(),
      getAgentUpcomingPayments(),
      getAgentDashboard(),
    ])
    return { payments, upcoming, canRecordPayments: dashboard.canRecordPayments, unauthorized: false }
  },
  pendingComponent: PaymentsPageSkeleton,
  component: AgentPaymentsPage,
})

function PaymentsPageSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-4 w-52" />
      </div>

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
          <Card className="shadow-sm rounded-xl">
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
        <Card className="shadow-sm rounded-xl">
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
  )
}

function AgentPaymentsPage() {
  const { payments, upcoming, canRecordPayments, unauthorized } = Route.useLoaderData()

  if (unauthorized) {
    return (
      <AccessDenied
        title="Agent Portal"
        message="You need to be an agent to access this portal."
        homeLink="/dashboard"
        homeLinkLabel="Go to Dashboard"
      />
    )
  }

  const [selectedScheduleItem, setSelectedScheduleItem] = useState<
    (typeof upcoming)[0] | null
  >(null)

  // Date range filter
  const [dateFilter, setDateFilter] = useState<'all' | 'month' | '30days' | '90days'>('month')

  // Upcoming pagination
  const [upcomingPage, setUpcomingPage] = useState(1)
  const UPCOMING_PAGE_SIZE = 5

  // Separate overdue from upcoming
  const overdueItems = upcoming.filter((item) => item.status === 'overdue')
  const upcomingItems = upcoming.filter((item) => item.status !== 'overdue')

  // Calculate stats
  const now = new Date()
  const thisMonthPayments = payments.filter((p) => isAfter(new Date(p.paidAt), startOfMonth(now)))
  const collectedThisMonth = thisMonthPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0)
  const overdueAmount = overdueItems.reduce((sum, item) => sum + parseFloat(item.amount) - parseFloat(item.paidAmount), 0)
  const upcomingAmount = upcomingItems.reduce((sum, item) => sum + parseFloat(item.amount) - parseFloat(item.paidAmount), 0)

  // Filter history by date range
  const filteredHistory = payments.filter((payment) => {
    if (dateFilter === 'all') return true
    const paymentDate = new Date(payment.paidAt)

    switch (dateFilter) {
      case 'month':
        return isAfter(paymentDate, startOfMonth(now))
      case '30days':
        return isAfter(paymentDate, subDays(now, 30))
      case '90days':
        return isAfter(paymentDate, subDays(now, 90))
      default:
        return true
    }
  })

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
        <p className="text-muted-foreground">Collect and record payments for your assigned loans</p>
      </div>

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
              <p className="text-xs text-muted-foreground">{overdueItems.length} payment{overdueItems.length !== 1 ? 's' : ''}</p>
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
            <Card className={`shadow-sm rounded-xl ${overdueItems.length > 0 ? 'border-destructive/50' : ''}`}>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Warning className="h-5 w-5" weight="bold" />
                  Overdue
                </CardTitle>
                <CardDescription>
                  {overdueItems.length > 0
                    ? `${overdueItems.length} payment${overdueItems.length !== 1 ? 's' : ''} need attention`
                    : 'No overdue payments'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {overdueItems.length > 0 ? (
                  <div className="space-y-2">
                    {overdueItems.map((item) => {
                      const remaining = parseFloat(item.amount) - parseFloat(item.paidAmount)
                      const itemPenalties = item.penalties ?? []
                      return (
                        <div key={item.id} className="space-y-1">
                          <div
                            className="flex items-center justify-between p-3 rounded border border-destructive/30 bg-destructive/5"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">
                                {item.contactName}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>Due {formatRelativeDate(item.dueDate)}</span>
                                <PenaltyBadge
                                  penalties={itemPenalties}
                                  formatCurrency={formatCurrency}
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                              <div className="text-right">
                                <p className="font-semibold text-sm">{formatCurrency(remaining)}</p>
                              </div>
                              {canRecordPayments && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setSelectedScheduleItem(item)}
                                  className="h-8"
                                >
                                  Collect
                                </Button>
                              )}
                            </div>
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
                          const isPartial = item.status === 'partial'
                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-3 rounded border"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm truncate">
                                  {item.contactName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Due {formatRelativeDate(item.dueDate)}
                                  {isPartial && <Badge variant="secondary" className="ml-2 text-[10px]">Partial</Badge>}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 ml-2">
                                <div className="text-right">
                                  <p className="font-semibold text-sm">{formatCurrency(remaining)}</p>
                                </div>
                                {canRecordPayments && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedScheduleItem(item)}
                                    className="h-8"
                                  >
                                    Collect
                                  </Button>
                                )}
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
                  </div>
                  <div className="flex items-center gap-1">
                    <Funnel className="h-4 w-4 text-muted-foreground mr-1" />
                    {[
                      { key: 'month', label: 'Month' },
                      { key: '30days', label: '30d' },
                      { key: '90days', label: '90d' },
                      { key: 'all', label: 'All' },
                    ].map((filter) => (
                      <Button
                        key={filter.key}
                        variant={dateFilter === filter.key ? 'secondary' : 'ghost'}
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
                            <p className="font-medium text-sm truncate">
                              {payment.contactName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(payment.paidAt), 'MMM d')} · {payment.method.toUpperCase()}
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
                      {payments.length > 0
                        ? 'No payments in selected period'
                        : 'No payments recorded yet'}
                    </p>
                    {payments.length > 0 && dateFilter !== 'all' && (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setDateFilter('all')}
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

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        open={!!selectedScheduleItem}
        onOpenChange={(open) => { if (!open) setSelectedScheduleItem(null) }}
        loanId={selectedScheduleItem?.loanId ?? ''}
        borrowerName={selectedScheduleItem?.contactName ?? ''}
        scheduleItem={selectedScheduleItem}
        appliedPenalties={0}
      />
    </div>
  )
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}
