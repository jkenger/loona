import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { SkeletonDashboard } from '@/components/ui/skeleton'
import { AccessDenied } from '@/components/access-denied'
import { hasRole, ROLES } from '@/lib/constants/roles'
import { getDashboardStats, type CalendarDay } from '@/server/dashboard'
import { updateOverduePayments } from '@/server/payments'
import {
  CurrencyCircleDollar,
  CalendarCheck,
  Warning,
  TrendUp,
  CaretLeft,
  CaretRight,
  Receipt,
  CheckCircle,
  Bell,
  ArrowRight,
} from '@phosphor-icons/react'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  getDay,
  addMonths,
  subMonths,
} from 'date-fns'
import { cn } from '@/lib/utils'
import { formatRelativeDateLower } from '@/lib/utils/date'

export const Route = createFileRoute('/_dashboard/dashboard/')({
  loader: async ({ context }) => {
    const { session } = context as {
      session: { user: { role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      return { stats: null, unauthorized: true }
    }
    // Update overdue statuses + generate penalties (fallback for cron)
    await updateOverduePayments()
    const stats = await getDashboardStats()
    return { stats, unauthorized: false }
  },
  pendingComponent: SkeletonDashboard,
  component: DashboardPage,
})

function DashboardPage() {
  const { stats, unauthorized } = Route.useLoaderData()

  // Initialize state with default values for unauthorized case
  const [currentMonth, setCurrentMonth] = useState(
    stats ? new Date(stats.currentMonth) : new Date(),
  )
  const [calendarData, setCalendarData] = useState(stats?.calendarData ?? {})
  const [summary, setSummary] = useState({
    expectedThisMonth: stats?.expectedThisMonth ?? 0,
    collectedThisMonth: stats?.collectedThisMonth ?? 0,
    paymentsExpected: stats?.paymentsExpected ?? 0,
    paymentsCollected: stats?.paymentsCollected ?? 0,
    collectionRate: stats?.collectionRate ?? 0,
    overdueCount: stats?.overdueCount ?? 0,
    overdueAmount: stats?.overdueAmount ?? 0,
  })
  const [isLoading, setIsLoading] = useState(false)

  if (unauthorized || !stats) {
    return (
      <AccessDenied
        message="Only lenders can access the dashboard."
        homeLink="/agent"
        homeLinkLabel="Go to Agent Portal"
      />
    )
  }

  const handleMonthChange = async (month: Date) => {
    setCurrentMonth(month)
    setIsLoading(true)
    try {
      const newStats = await getDashboardStats({
        data: { month: month.toISOString() },
      })
      setCalendarData(newStats.calendarData)
      setSummary({
        expectedThisMonth: newStats.expectedThisMonth,
        collectedThisMonth: newStats.collectedThisMonth,
        paymentsExpected: newStats.paymentsExpected,
        paymentsCollected: newStats.paymentsCollected,
        collectionRate: newStats.collectionRate,
        overdueCount: newStats.overdueCount,
        overdueAmount: newStats.overdueAmount,
      })
    } finally {
      setIsLoading(false)
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
            <span>Overview</span>
            <span className="text-blue-300/40">·</span>
            <span>{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
          </div>

          {/* Title Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="border-l-4 border-primary pl-4">
              <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-blue-200/70">
                Track your collections and portfolio
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/loans/new-wizard">
                <Button
                  size="lg"
                  className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-200 hover:scale-[1.02] font-semibold px-6"
                >
                  <CurrencyCircleDollar className="h-5 w-5" weight="bold" />
                  Issue a Loan
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content - overlaps header */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-8 pb-8 space-y-6 relative">
        {/* Hero KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Net Profit */}
          <Popover>
            <PopoverTrigger
              openOnHover
              delay={200}
              closeDelay={150}
              render={<div />}
              className="w-full"
            >
              <Card className="shadow-sm bg-primary/10 border-primary/20 cursor-help">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Net Profit
                  </CardTitle>
                  <TrendUp className="h-4 w-4 text-primary" weight="bold" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold text-primary">
                    {formatCurrency(stats.netProfit)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    your earnings
                  </p>
                </CardContent>
              </Card>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Breakdown
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Interest</span>
                  <span className="font-medium text-emerald-600">
                    {formatCurrency(stats.interestEarned)}
                  </span>
                </div>
                {parseFloat(stats.penaltyIncome) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">+ Penalties</span>
                    <span className="font-medium text-emerald-600">
                      {formatCurrency(stats.penaltyIncome)}
                    </span>
                  </div>
                )}
                {parseFloat(stats.paidCommissions) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      − Commissions
                    </span>
                    <span className="font-medium text-orange-500">
                      {formatCurrency(stats.paidCommissions)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1.5">
                  <span className="font-medium">Net Profit</span>
                  <span className="font-bold text-primary">
                    {formatCurrency(stats.netProfit)}
                  </span>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Net Collected */}
          <Popover>
            <PopoverTrigger
              openOnHover
              delay={200}
              closeDelay={150}
              render={<div />}
              className="w-full"
            >
              <Card className="shadow-sm cursor-help">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Net Collected
                  </CardTitle>
                  <CheckCircle
                    className="h-4 w-4 text-primary"
                    weight="bold"
                  />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold">
                    {formatCurrency(stats.netCollected)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    after commissions
                  </p>
                </CardContent>
              </Card>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Breakdown
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Collected</span>
                  <span className="font-medium">
                    {formatCurrency(stats.totalCollected)}
                  </span>
                </div>
                {parseFloat(stats.penaltyIncome) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">+ Penalties</span>
                    <span className="font-medium text-emerald-600">
                      {formatCurrency(stats.penaltyIncome)}
                    </span>
                  </div>
                )}
                {parseFloat(stats.paidCommissions) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      − Commissions
                    </span>
                    <span className="font-medium text-orange-500">
                      {formatCurrency(stats.paidCommissions)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1.5">
                  <span className="font-medium">Net Collected</span>
                  <span className="font-bold">
                    {formatCurrency(stats.netCollected)}
                  </span>
                </div>
                {parseFloat(stats.pendingCommissions) > 0 && (
                  <p className="text-xs text-muted-foreground pt-1.5 border-t">
                    {formatCurrency(stats.pendingCommissions)} pending
                    commissions not yet deducted
                  </p>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Interest Earned */}
          <Popover>
            <PopoverTrigger
              openOnHover
              delay={200}
              closeDelay={150}
              render={<div />}
              className="w-full"
            >
              <Card className="shadow-sm cursor-help">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Interest Earned
                  </CardTitle>
                  <CurrencyCircleDollar
                    className="h-4 w-4 text-emerald-600"
                    weight="bold"
                  />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold text-emerald-600">
                    {formatCurrency(stats.interestEarned)}
                  </div>
                </CardContent>
              </Card>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3">
              <p className="text-sm text-muted-foreground">
                Total interest earned across all loans from{' '}
                {stats.activeLoans} active loan
                {stats.activeLoans !== 1 ? 's' : ''}.
              </p>
            </PopoverContent>
          </Popover>

          {/* Total Disbursed */}
          <Popover>
            <PopoverTrigger
              openOnHover
              delay={200}
              closeDelay={150}
              render={<div />}
              className="w-full"
            >
              <Card className="shadow-sm cursor-help">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Disbursed
                  </CardTitle>
                  <Receipt
                    className="h-4 w-4 text-muted-foreground"
                    weight="bold"
                  />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold">
                    {formatCurrency(stats.totalDisbursed)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    capital out
                  </p>
                </CardContent>
              </Card>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Summary
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Loans</span>
                  <span className="font-medium">{stats.totalLoans}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active Loans</span>
                  <span className="font-medium">{stats.activeLoans}</span>
                </div>
                <div className="flex justify-between border-t pt-1.5">
                  <span className="text-muted-foreground">Outstanding</span>
                  <span className="font-medium">
                    {formatCurrency(stats.outstandingBalance)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Collected</span>
                  <span className="font-medium">
                    {formatCurrency(stats.totalCollected)}
                  </span>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Overdue Payments Banner */}
        {summary.overdueCount > 0 && (
          <div className="rounded-lg border border-destructive/20 bg-card shadow-lg p-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-destructive/5 pointer-events-none" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <Warning className="h-5 w-5 text-destructive" weight="fill" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-destructive">
                    {summary.overdueCount} overdue payment
                    {summary.overdueCount !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Total overdue: {formatCurrency(summary.overdueAmount)}
                  </p>
                </div>
              </div>
              <Link to="/payments">
                <Button size="sm" variant="destructive" className="gap-1.5">
                  Collect Now
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Upcoming Payments Banner */}
        {stats.upcomingPayments.length > 0 && summary.overdueCount === 0 && (
          <div className="rounded-lg border border-primary/20 bg-card shadow-lg p-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bell className="h-5 w-5 text-primary" weight="fill" />
                </div>
                <div>
                  <p className="font-semibold text-sm">
                    {stats.upcomingPayments.length} payment
                    {stats.upcomingPayments.length !== 1 ? 's' : ''} due this
                    week
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {stats.upcomingPayments.slice(0, 3).map((p, i) => (
                      <span key={p.id}>
                        {i > 0 && ', '}
                        {p.contactName} (
                        {formatCurrency(
                          parseFloat(p.amount) - parseFloat(p.paidAmount),
                        )}{' '}
                        {formatRelativeDateLower(p.dueDate)})
                      </span>
                    ))}
                    {stats.upcomingPayments.length > 3 && (
                      <span> and {stats.upcomingPayments.length - 3} more</span>
                    )}
                  </p>
                </div>
              </div>
              <Link to="/payments">
                <Button size="sm" className="gap-1.5">
                  View Payments
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Monthly Performance */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Monthly Performance</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  handleMonthChange(subMonths(currentMonth, 1))
                }
              >
                <CaretLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[140px] text-center">
                {format(currentMonth, 'MMMM yyyy')}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  handleMonthChange(addMonths(currentMonth, 1))
                }
              >
                <CaretRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div
            className={cn(
              'grid gap-4 md:grid-cols-3',
              isLoading && 'opacity-50 pointer-events-none',
            )}
          >
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                <CardTitle className="text-sm font-medium">Expected</CardTitle>
                <CalendarCheck
                  className="h-4 w-4 text-muted-foreground"
                  weight="bold"
                />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">
                  {formatCurrency(summary.expectedThisMonth)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.paymentsExpected} payments this month
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                <CardTitle className="text-sm font-medium">
                  Collected
                </CardTitle>
                <CheckCircle
                  className="h-4 w-4 text-primary"
                  weight="bold"
                />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(summary.collectedThisMonth)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.collectionRate}% rate · {summary.paymentsCollected}{' '}
                  paid
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-destructive/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                <Warning
                  className="h-4 w-4 text-destructive"
                  weight="bold"
                />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div
                  className={cn(
                    'text-2xl font-bold',
                    summary.overdueCount > 0 && 'text-destructive',
                  )}
                >
                  {formatCurrency(summary.overdueAmount)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.overdueCount} overdue payment
                  {summary.overdueCount !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Calendar and Sidebar */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Payment Calendar */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-lg font-semibold">
                Payment Calendar
              </CardTitle>
            </CardHeader>
            <CardContent
              className={cn(
                'p-4 pt-0',
                isLoading && 'opacity-50 pointer-events-none',
              )}
            >
              <PaymentCalendar
                calendarData={calendarData}
                currentMonth={currentMonth}
              />
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Portfolio Overview */}
            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">
                    Portfolio Overview
                  </CardTitle>
                  <Badge variant="secondary">
                    {stats.activeLoans} Active Loans
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Total Loans
                    </span>
                    <span className="text-sm font-medium">
                      {stats.totalLoans}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Total Contacts
                    </span>
                    <span className="text-sm font-medium">
                      {stats.totalContacts}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-sm text-muted-foreground">
                      Total Collected
                    </span>
                    <span className="text-sm font-medium">
                      {formatCurrency(stats.totalCollected)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Outstanding
                    </span>
                    <span className="text-sm font-medium">
                      {formatCurrency(stats.outstandingBalance)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Forecast */}
            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center gap-2">
                  <TrendUp className="h-4 w-4 text-primary" weight="bold" />
                  <CardTitle className="text-lg font-semibold">
                    Expected Collections
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Next 30 days
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {stats.forecast.next30DaysCount} payments
                      </p>
                    </div>
                    <p className="text-xl font-bold">
                      {formatCurrency(stats.forecast.next30Days)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Next 60 days
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {stats.forecast.next60DaysCount} payments
                      </p>
                    </div>
                    <p className="text-xl font-bold">
                      {formatCurrency(stats.forecast.next60Days)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Next 90 days
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {stats.forecast.next90DaysCount} payments
                      </p>
                    </div>
                    <p className="text-xl font-bold">
                      {formatCurrency(stats.forecast.next90Days)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

// Payment Calendar Component
function PaymentCalendar({
  calendarData,
  currentMonth,
}: {
  calendarData: Record<string, CalendarDay>
  currentMonth: Date
}) {
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const startDay = getDay(monthStart)
  const paddingDays = Array(startDay).fill(null)

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const statusColors: Record<string, string> = {
    paid: 'default',
    partial: 'secondary',
    pending: 'outline',
    overdue: 'destructive',
  }

  return (
    <div>
      {/* Week day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-muted-foreground py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Padding days */}
        {paddingDays.map((_, index) => (
          <div key={`pad-${index}`} className="h-12" />
        ))}

        {/* Actual days */}
        {days.map((date) => {
          const dateKey = format(date, 'yyyy-MM-dd')
          const dayData = calendarData[dateKey]
          const hasPayments = !!dayData
          const today = isToday(date)

          const dayContent = (
            <div
              className={cn(
                'h-12 rounded text-sm relative flex flex-col items-center justify-center transition-colors',
                today && 'ring-1 ring-primary bg-primary/5',
                hasPayments && 'hover:bg-muted/50 cursor-pointer',
                !hasPayments && 'text-muted-foreground',
              )}
            >
              <span className={cn('font-medium', today && 'text-primary')}>
                {format(date, 'd')}
              </span>

              {/* Payment indicators */}
              {hasPayments && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayData.hasPaid && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                  {dayData.hasOverdue && (
                    <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                  )}
                  {dayData.hasPending && !dayData.hasOverdue && (
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                  )}
                </div>
              )}
            </div>
          )

          if (!hasPayments) {
            return <div key={dateKey}>{dayContent}</div>
          }

          return (
            <Popover key={dateKey}>
              <PopoverTrigger
                openOnHover
                delay={100}
                closeDelay={100}
                render={<div />}
                className="w-full"
              >
                {dayContent}
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">
                      {format(date, 'MMMM d, yyyy')}
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      {dayData.payments.length} payment
                      {dayData.payments.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {dayData.payments.map((payment) => {
                      const remaining =
                        parseFloat(payment.amount) -
                        parseFloat(payment.paidAmount)
                      return (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between gap-2 p-2 rounded bg-muted/50"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">
                              {payment.borrowerName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {payment.status === 'paid'
                                ? formatCurrency(payment.amount)
                                : `${formatCurrency(remaining)} remaining`}
                            </p>
                          </div>
                          <Badge
                            variant={statusColors[payment.status] as any}
                            className="text-xs shrink-0"
                          >
                            {payment.status}
                          </Badge>
                        </div>
                      )
                    })}
                  </div>

                  <Link to="/payments" className="block">
                    <Button size="sm" className="w-full gap-1.5">
                      <Receipt className="h-4 w-4" />
                      View Payments
                    </Button>
                  </Link>
                </div>
              </PopoverContent>
            </Popover>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t">
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-muted-foreground">Paid</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-2 h-2 rounded-full bg-destructive" />
          <span className="text-muted-foreground">Overdue</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-2 h-2 rounded-full bg-muted-foreground" />
          <span className="text-muted-foreground">Upcoming</span>
        </div>
      </div>
    </div>
  )
}

function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}
