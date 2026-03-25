import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SkeletonDashboard } from '@/components/ui/skeleton'
import { AccessDenied } from '@/components/access-denied'
import { hasRole, ROLES } from '@/lib/constants/roles'
import { getDashboardStats } from '@/server/dashboard'
import { updateOverduePayments } from '@/server/payments'
import { getLenderSettings, saveLenderSettings } from '@/server/lender-settings'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  CaretLeft,
  CaretRight,
  TrendUp,
  CheckCircle,
  ArrowRight,
  Briefcase,
  CalendarDots,
  ListChecks,
  ChartBar,
  Receipt,
  Users,
  CurrencyCircleDollar,
} from '@phosphor-icons/react'
import {
  format,
  addMonths,
  subMonths,
  startOfWeek,
  addDays,
  isSameDay,
  isToday,
} from 'date-fns'
import { cn } from '@/lib/utils'
import { formatRelativeDateLower } from '@/lib/utils/date'
import { Stagger, StaggerItem } from '@/components/ui/stagger'

export const Route = createFileRoute('/_dashboard/dashboard/')({
  loader: async ({ context }) => {
    const { session } = context as {
      session: { user: { name: string | null; role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      return { stats: null, unauthorized: true, firstName: '', lenderConfig: null }
    }
    await updateOverduePayments()
    const [stats, lenderConfig] = await Promise.all([getDashboardStats(), getLenderSettings()])
    const firstName = session.user.name?.split(' ')[0] ?? ''
    return { stats, unauthorized: false, firstName, lenderConfig }
  },
  pendingComponent: SkeletonDashboard,
  component: DashboardPage,
})

function DashboardPage() {
  const { stats, unauthorized, firstName, lenderConfig } = Route.useLoaderData()

  const [showNotificationOnboarding, setShowNotificationOnboarding] = useState(
    !!lenderConfig && !lenderConfig.notificationOnboardingSeen
  )
  const [isEnablingAll, setIsEnablingAll] = useState(false)

  const handleEnableAll = async () => {
    if (!lenderConfig) return
    setIsEnablingAll(true)
    try {
      await saveLenderSettings({
        data: {
          ...lenderConfig,
          paymentReceiptsEnabled: true,
          overdueAlertsEnabled: true,
          lenderPaymentNotificationsEnabled: true,
          lenderDocumentNotificationsEnabled: true,
          lenderPenaltyNotificationsEnabled: true,
          lenderDailySummaryEnabled: true,
          notificationOnboardingSeen: true,
        },
      })
      toast.success("All notifications enabled")
      setShowNotificationOnboarding(false)
    } catch {
      toast.error("Failed to save")
    } finally {
      setIsEnablingAll(false)
    }
  }

  const handleDismissOnboarding = async () => {
    if (!lenderConfig) return
    setShowNotificationOnboarding(false)
    await saveLenderSettings({
      data: { ...lenderConfig, notificationOnboardingSeen: true },
    }).catch(() => {})
  }

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
  const [selectedDay, setSelectedDay] = useState(new Date())

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

  // Upcoming collections: overdue first, then upcoming
  const overduePayments = (stats.upcomingPayments ?? []).filter(
    (p: any) => p.status === 'overdue',
  )
  const upcomingPayments = (stats.upcomingPayments ?? []).filter(
    (p: any) => p.status !== 'overdue',
  )
  const allCollections = [...overduePayments, ...upcomingPayments].slice(0, 5)

  // Week calendar
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const selectedDayKey = format(selectedDay, 'yyyy-MM-dd')
  const selectedDayPayments = (calendarData as any)[selectedDayKey]?.payments ?? []

  // Collection progress
  const collectionProgress =
    summary.expectedThisMonth > 0
      ? Math.min(
          (summary.collectedThisMonth / summary.expectedThisMonth) * 100,
          100,
        )
      : 0

  return (
    <Stagger className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Page Header */}
      <StaggerItem>
        <p className="text-sm text-muted-foreground">
          {format(new Date(), 'EEEE, MMMM d')}
        </p>
        <h1 className="text-3xl font-bold tracking-tight mt-1">
          Hello, {firstName}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-1">
          <p className="text-2xl font-medium text-muted-foreground">
            Here's what's happening with your{' '}
            <span className="text-foreground font-semibold bg-primary/10 px-1.5 py-0.5 rounded-md">
              portfolio
            </span>{' '}
            today.
          </p>
          <div className="flex items-center gap-2">
          <Link to="/loans/new-wizard">
            <Button size="sm" className="rounded-full gap-1.5 font-semibold shadow-[0_0_12px_hsl(var(--primary)/0.4)]">
              <CurrencyCircleDollar className="h-4 w-4" weight="bold" />
              Issue a Loan
            </Button>
          </Link>
          <Link to="/payments">
            <Button variant="outline" size="sm" className="rounded-full gap-1.5">
              <Receipt className="h-4 w-4" weight="bold" />
              View Payments
            </Button>
          </Link>
          <Link to="/contacts">
            <Button variant="outline" size="sm" className="rounded-full gap-1.5">
              <Users className="h-4 w-4" weight="bold" />
              Manage Contacts
            </Button>
          </Link>
          </div>
        </div>
      </StaggerItem>

      {/* Bento Grid */}
      <StaggerItem className="grid gap-5 lg:grid-cols-5">
        {/* Left Column */}
        <div className="lg:col-span-3 space-y-5">
          {/* Upcoming Collections */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold">
                    Upcoming Collections
                  </CardTitle>
                </div>
                <Link
                  to="/payments"
                  className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {allCollections.length === 0 ? (
                <div className="py-8 text-center">
                  <CheckCircle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    You're all caught up
                  </p>
                </div>
              ) : (
                <div className="space-y-0">
                  {allCollections.map((p: any) => {
                    const isOverdue = p.status === 'overdue'
                    const remaining =
                      parseFloat(p.amount) - parseFloat(p.paidAmount)
                    return (
                      <Link
                        key={p.id}
                        to="/loans/$loanId"
                        params={{ loanId: p.loanId }}
                        className="flex items-center gap-3 py-3 border-b last:border-0 hover:bg-muted/50 -mx-5 px-5 transition-colors"
                      >
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full shrink-0',
                            isOverdue ? 'bg-destructive' : 'bg-primary',
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              'text-sm font-medium truncate',
                              isOverdue && 'text-destructive',
                            )}
                          >
                            {p.contactName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatRelativeDateLower(p.dueDate)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p
                            className={cn(
                              'text-sm font-semibold',
                              isOverdue && 'text-destructive',
                            )}
                          >
                            {formatCurrency(remaining)}
                          </p>
                          <Badge
                            variant={isOverdue ? 'destructive' : 'secondary'}
                            className="text-[10px]"
                          >
                            {p.status}
                          </Badge>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monthly Overview */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ChartBar className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold">
                    Monthly Overview
                  </CardTitle>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() =>
                      handleMonthChange(subMonths(currentMonth, 1))
                    }
                  >
                    <CaretLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[120px] text-center">
                    {format(currentMonth, 'MMMM yyyy')}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() =>
                      handleMonthChange(addMonths(currentMonth, 1))
                    }
                  >
                    <CaretRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent
              className={cn('p-5 pt-0', isLoading && 'opacity-50 pointer-events-none')}
            >
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground">Expected</p>
                  <p className="text-lg font-bold">
                    {formatCurrency(summary.expectedThisMonth)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Collected</p>
                  <p className="text-lg font-bold text-primary">
                    {formatCurrency(summary.collectedThisMonth)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {summary.collectionRate}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Overdue</p>
                  <p
                    className={cn(
                      'text-lg font-bold',
                      summary.overdueCount > 0 && 'text-destructive',
                    )}
                  >
                    {summary.overdueCount}
                  </p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${collectionProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {summary.paymentsCollected} of {summary.paymentsExpected}{' '}
                payments collected
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Portfolio */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold">
                    Portfolio
                  </CardTitle>
                </div>
                <Badge variant="secondary">{stats.activeLoans} Active</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Active Loans
                  </span>
                  <span className="text-sm font-semibold">
                    {stats.activeLoans}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Total Contacts
                  </span>
                  <span className="text-sm font-semibold">
                    {stats.totalContacts}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t pt-2.5">
                  <span className="text-sm text-muted-foreground">
                    Outstanding
                  </span>
                  <span className="text-sm font-semibold">
                    {formatCurrency(stats.outstandingBalance)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Total Collected
                  </span>
                  <span className="text-sm font-semibold">
                    {formatCurrency(stats.totalCollected)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Calendar — Week Strip */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDots className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold">
                    This Week
                  </CardTitle>
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(weekDays[0], 'MMM d')} – {format(weekDays[6], 'MMM d')}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {/* Week strip */}
              <div className="grid grid-cols-7 gap-1 mb-3">
                {weekDays.map((day) => {
                  const dayKey = format(day, 'yyyy-MM-dd')
                  const dayPayments =
                    (calendarData as any)[dayKey]?.payments ?? []
                  const isSelected = isSameDay(day, selectedDay)
                  const today = isToday(day)
                  const hasOverdue = dayPayments.some(
                    (p: any) => p.status === 'overdue',
                  )
                  return (
                    <button
                      key={dayKey}
                      onClick={() => setSelectedDay(day)}
                      className={cn(
                        'flex flex-col items-center py-2 rounded-lg text-xs transition-colors relative',
                        isSelected && !today && 'bg-muted ring-1 ring-border',
                        today && 'bg-primary text-primary-foreground',
                        !isSelected && !today && 'hover:bg-muted/50',
                      )}
                    >
                      <span className="font-medium">
                        {format(day, 'EEE')}
                      </span>
                      <span
                        className={cn(
                          'text-lg font-bold mt-0.5',
                          today
                            ? 'text-primary-foreground'
                            : 'text-foreground',
                        )}
                      >
                        {format(day, 'd')}
                      </span>
                      {dayPayments.length > 0 && (
                        <span
                          className={cn(
                            'text-[10px] font-semibold mt-0.5 px-1 rounded-full min-w-[16px] text-center',
                            today
                              ? 'bg-primary-foreground/20 text-primary-foreground'
                              : hasOverdue
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-primary/10 text-primary',
                          )}
                        >
                          {dayPayments.length}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Selected day header */}
              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium">
                    {isToday(selectedDay)
                      ? 'Today'
                      : format(selectedDay, 'EEEE, MMM d')}
                  </p>
                  {selectedDayPayments.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {selectedDayPayments.length} payment
                      {selectedDayPayments.length !== 1 ? 's' : ''} ·{' '}
                      {formatCurrency(
                        selectedDayPayments.reduce(
                          (sum: number, p: any) =>
                            sum + parseFloat(p.amount),
                          0,
                        ),
                      )}
                    </p>
                  )}
                </div>

                {/* Selected day's payments */}
                <div className="space-y-1.5">
                  {selectedDayPayments.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      No payments scheduled
                    </p>
                  ) : (
                    selectedDayPayments.map((p: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-sm py-1"
                      >
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full shrink-0',
                            p.status === 'paid'
                              ? 'bg-emerald-500'
                              : p.status === 'overdue'
                                ? 'bg-destructive'
                                : 'bg-amber-500',
                          )}
                        />
                        <span className="truncate flex-1">
                          {p.contactName || p.borrowerName}
                        </span>
                        <Badge
                          variant={
                            p.status === 'paid'
                              ? 'secondary'
                              : p.status === 'overdue'
                                ? 'destructive'
                                : 'outline'
                          }
                          className="text-[10px] shrink-0"
                        >
                          {p.status}
                        </Badge>
                        <span className="font-medium shrink-0 w-20 text-right">
                          {formatCurrency(p.amount)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-muted-foreground">Paid</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-[10px] text-muted-foreground">Pending</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-destructive" />
                  <span className="text-[10px] text-muted-foreground">Overdue</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Forecast */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center gap-2">
                <TrendUp className="h-4 w-4 text-primary" weight="bold" />
                <CardTitle className="text-base font-semibold">
                  Forecast
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-0">
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
                  <p className="text-lg font-bold">
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
                  <p className="text-lg font-bold">
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
                  <p className="text-lg font-bold">
                    {formatCurrency(stats.forecast.next90Days)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </StaggerItem>

      {/* Notification Onboarding Modal */}
      <Dialog open={showNotificationOnboarding} onOpenChange={(open) => {
        if (!open) handleDismissOnboarding()
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Stay in the Loop</DialogTitle>
            <DialogDescription>
              Get notified about important events via email — no need to check the dashboard constantly.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {[
              { label: "Payment Received", desc: "Know when borrowers pay" },
              { label: "Loan Fully Paid", desc: "Celebrate completed loans" },
              { label: "Document Signed", desc: "Borrower signed the contract" },
              { label: "Overdue Reminders", desc: "Auto-remind borrowers before & after due dates" },
              { label: "Penalty Generated", desc: "Late fees & daily interest alerts" },
              { label: "Daily Summary", desc: "Portfolio overview + missed payment escalation" },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3 p-2 rounded-lg bg-muted/40">
                <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            You can customize individual notifications anytime in Settings.
          </p>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleDismissOnboarding} disabled={isEnablingAll} className="w-full sm:w-auto">
              Not Now
            </Button>
            <Button onClick={handleEnableAll} disabled={isEnablingAll} className="w-full sm:w-auto">
              {isEnablingAll ? "Enabling..." : "Enable All Notifications"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Stagger>
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
