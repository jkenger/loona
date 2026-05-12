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
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
  Receipt,
  Users,
  CurrencyCircleDollar,
  Bell,
  CurrencyDollar,
  FileText,
  Warning,
  ChartLineUp,
  EnvelopeSimple,
  Info,
} from '@phosphor-icons/react'
import { format, addMonths, subMonths } from 'date-fns'
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
    const [stats, lenderConfig] = await Promise.all([
      getDashboardStats(),
      getLenderSettings(),
    ])
    const firstName = session.user.name?.split(' ')[0] ?? ''
    return { stats, unauthorized: false, firstName, lenderConfig }
  },
  pendingComponent: SkeletonDashboard,
  component: DashboardPage,
})

function DashboardPage() {
  const { stats, unauthorized, firstName, lenderConfig } = Route.useLoaderData()

  const allNotificationsEnabled = !!lenderConfig && (
    lenderConfig.paymentReceiptsEnabled &&
    lenderConfig.overdueAlertsEnabled &&
    lenderConfig.lenderPaymentNotificationsEnabled &&
    lenderConfig.lenderDocumentNotificationsEnabled &&
    lenderConfig.lenderPenaltyNotificationsEnabled &&
    lenderConfig.lenderDailySummaryEnabled
  )
  const [showNotificationOnboarding, setShowNotificationOnboarding] = useState(
    !!lenderConfig && !lenderConfig.notificationOnboardingSeen && !allNotificationsEnabled
  )
  const [isEnablingAll, setIsEnablingAll] = useState(false)
  const [onboardingToggles, setOnboardingToggles] = useState({
    paymentReceipts: lenderConfig?.paymentReceiptsEnabled ?? false,
    overdueAlerts: lenderConfig?.overdueAlertsEnabled ?? false,
    lenderPayment: lenderConfig?.lenderPaymentNotificationsEnabled ?? false,
    lenderDocument: lenderConfig?.lenderDocumentNotificationsEnabled ?? false,
    lenderPenalty: lenderConfig?.lenderPenaltyNotificationsEnabled ?? false,
    dailySummary: lenderConfig?.lenderDailySummaryEnabled ?? false,
  })

  const handleEnableAll = async () => {
    if (!lenderConfig) return
    setIsEnablingAll(true)
    try {
      await saveLenderSettings({
        data: {
          ...lenderConfig,
          paymentReceiptsEnabled: onboardingToggles.paymentReceipts,
          overdueAlertsEnabled: onboardingToggles.overdueAlerts,
          lenderPaymentNotificationsEnabled: onboardingToggles.lenderPayment,
          lenderDocumentNotificationsEnabled: onboardingToggles.lenderDocument,
          lenderPenaltyNotificationsEnabled: onboardingToggles.lenderPenalty,
          lenderDailySummaryEnabled: onboardingToggles.dailySummary,
          notificationOnboardingSeen: true,
        },
      })
      toast.success("Notification preferences saved")
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
  const [summary, setSummary] = useState({
    expectedThisMonth: toNumber(stats?.expectedThisMonth),
    collectedThisMonth: toNumber(stats?.collectedThisMonth),
    paymentsExpected: stats?.paymentsExpected ?? 0,
    paymentsCollected: stats?.paymentsCollected ?? 0,
    collectionRate: stats?.collectionRate ?? 0,
    overdueCount: stats?.overdueCount ?? 0,
    overdueAmount: toNumber(stats?.overdueAmount),
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
      setSummary({
        expectedThisMonth: toNumber(newStats.expectedThisMonth),
        collectedThisMonth: toNumber(newStats.collectedThisMonth),
        paymentsExpected: newStats.paymentsExpected,
        paymentsCollected: newStats.paymentsCollected,
        collectionRate: newStats.collectionRate,
        overdueCount: newStats.overdueCount,
        overdueAmount: toNumber(newStats.overdueAmount),
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
  const allCollections = [...overduePayments, ...upcomingPayments].slice(0, 6)

  // Collection progress
  const collectionProgress =
    summary.expectedThisMonth > 0
      ? Math.min(
          (summary.collectedThisMonth / summary.expectedThisMonth) * 100,
          100,
        )
      : 0

  return (
    <Stagger className="px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Hero — greeting + month KPIs + actions */}
      <StaggerItem>
        <Card className="rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 sm:p-6">
            {/* Top row: greeting + actions */}
            <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
              <div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(), 'EEEE, MMMM d')}
                </p>
                <h1 className="text-2xl font-bold tracking-tight mt-1">
                  Hello, {firstName}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Here's what's happening with your portfolio.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Link to="/loans/new-wizard">
                  <Button size="sm" className="rounded-full gap-1.5 font-semibold shadow-[0_0_12px_hsl(var(--primary)/0.3)]">
                    <CurrencyCircleDollar className="h-4 w-4" weight="bold" />
                    Issue a Loan
                  </Button>
                </Link>
                <Link to="/payments">
                  <Button variant="outline" size="sm" className="rounded-full gap-1.5">
                    <Receipt className="h-4 w-4" weight="bold" />
                    Payments
                  </Button>
                </Link>
                <Link to="/loans">
                  <Button variant="outline" size="sm" className="rounded-full gap-1.5">
                    <Users className="h-4 w-4" weight="bold" />
                    Borrowers
                  </Button>
                </Link>
              </div>
            </div>

            {/* Month KPI row */}
            <div
              className={cn(
                'grid gap-5 sm:grid-cols-[1fr_1fr_minmax(180px,1.2fr)] items-end',
                isLoading && 'opacity-50 pointer-events-none',
              )}
            >
              {/* Collected */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Collected
                  </p>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => handleMonthChange(subMonths(currentMonth, 1))}
                      className="h-5 w-5 rounded hover:bg-muted flex items-center justify-center transition-colors"
                      aria-label="Previous month"
                    >
                      <CaretLeft className="h-3 w-3" />
                    </button>
                    <span className="text-[11px] font-medium text-muted-foreground min-w-[56px] text-center">
                      {format(currentMonth, 'MMM yyyy')}
                    </span>
                    <button
                      onClick={() => handleMonthChange(addMonths(currentMonth, 1))}
                      className="h-5 w-5 rounded hover:bg-muted flex items-center justify-center transition-colors"
                      aria-label="Next month"
                    >
                      <CaretRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <p className="text-3xl sm:text-4xl font-bold text-primary tabular-nums">
                  {formatCurrency(summary.collectedThisMonth)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  of {formatCurrency(summary.expectedThisMonth)} expected
                </p>
              </div>

              {/* Overdue */}
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                  Overdue
                </p>
                <p
                  className={cn(
                    'text-3xl sm:text-4xl font-bold tabular-nums',
                    summary.overdueCount > 0 ? 'text-destructive' : 'text-foreground',
                  )}
                >
                  {summary.overdueCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(summary.overdueAmount)} unpaid
                </p>
              </div>

              {/* Progress */}
              <div className="w-full">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Collection Rate
                  </span>
                  <span className="text-xs font-semibold">{summary.collectionRate}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${collectionProgress}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {summary.paymentsCollected} of {summary.paymentsExpected} payments
                </p>
              </div>
            </div>
          </div>
        </Card>
      </StaggerItem>

      {/* Row 2 — Upcoming Collections + Portfolio/Forecast */}
      <StaggerItem className="grid gap-5 lg:grid-cols-5">
        {/* Upcoming Collections */}
        <div className="lg:col-span-3">
          <Card className="rounded-xl shadow-sm h-full">
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
                <div className="py-10 text-center">
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
                              'text-sm font-semibold tabular-nums',
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
        </div>

        {/* Portfolio + Forecast combined */}
        <div className="lg:col-span-2">
          <Card className="rounded-xl shadow-sm h-full">
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
              {/* Snapshot */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Active Loans</span>
                  <span className="text-sm font-semibold tabular-nums">{stats.activeLoans}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Contacts</span>
                  <span className="text-sm font-semibold tabular-nums">{stats.totalContacts}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2.5">
                  <span className="text-sm text-muted-foreground">Outstanding</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrency(stats.outstandingBalance)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Collected</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrency(stats.totalCollected)}
                  </span>
                </div>
              </div>

              {/* Forecast */}
              <div className="mt-5 pt-4 border-t">
                <div className="flex items-center gap-2 mb-3">
                  <TrendUp className="h-4 w-4 text-primary" weight="bold" />
                  <p className="text-sm font-semibold">Forecast</p>
                </div>
                <div className="space-y-0">
                  {[
                    {
                      label: 'Next 30 days',
                      amount: stats.forecast.next30Days,
                      count: stats.forecast.next30DaysCount,
                    },
                    {
                      label: 'Next 60 days',
                      amount: stats.forecast.next60Days,
                      count: stats.forecast.next60DaysCount,
                    },
                    {
                      label: 'Next 90 days',
                      amount: stats.forecast.next90Days,
                      count: stats.forecast.next90DaysCount,
                    },
                  ].map((f, i) => (
                    <div
                      key={f.label}
                      className={cn(
                        'flex items-center justify-between py-2',
                        i > 0 && 'border-t',
                      )}
                    >
                      <div>
                        <p className="text-xs text-muted-foreground">{f.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {f.count} payments
                        </p>
                      </div>
                      <p className="text-sm font-bold tabular-nums">
                        {formatCurrency(f.amount)}
                      </p>
                    </div>
                  ))}
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
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
          {/* Header with gradient */}
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Bell className="h-5 w-5 text-primary" weight="fill" />
              </div>
              <div>
                <DialogHeader className="p-0 space-y-0">
                  <DialogTitle className="text-lg font-bold">Never Miss a Beat</DialogTitle>
                  <DialogDescription className="text-sm">
                    Get real-time email updates on your lending activity.
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>
          </div>

          {/* Toggle rows */}
          <div className="px-6 pb-2 space-y-1">
            {([
              {
                key: "paymentReceipts" as const,
                icon: CurrencyDollar,
                label: "Payment Receipts",
                color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50",
                tooltip: "Sends an email to your borrower each time you record a payment, with the amount and remaining balance.",
              },
              {
                key: "overdueAlerts" as const,
                icon: CalendarDots,
                label: "Due Date Reminders",
                color: "text-amber-600 bg-amber-50 dark:bg-amber-950/50",
                tooltip: "Automatically emails borrowers before their due date, on the due date, and after if unpaid. You can set the number of days in Settings.",
              },
              {
                key: "lenderPayment" as const,
                icon: EnvelopeSimple,
                label: "Payment Received (You)",
                color: "text-blue-600 bg-blue-50 dark:bg-blue-950/50",
                tooltip: "Notifies you by email whenever a payment is recorded on any of your active loans.",
              },
              {
                key: "lenderDocument" as const,
                icon: FileText,
                label: "Document Signed (You)",
                color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50",
                tooltip: "Alerts you when a borrower or co-maker signs a promissory note or any loan document.",
              },
              {
                key: "lenderPenalty" as const,
                icon: Warning,
                label: "Penalty Generated (You)",
                color: "text-red-600 bg-red-50 dark:bg-red-950/50",
                tooltip: "Notifies you when a late fee or daily interest penalty is automatically applied to a loan.",
              },
              {
                key: "dailySummary" as const,
                icon: ChartLineUp,
                label: "Daily Summary (You)",
                color: "text-violet-600 bg-violet-50 dark:bg-violet-950/50",
                tooltip: "A morning digest with collections, overdue counts, completed loans, and any borrowers with consecutive missed payments.",
              },
            ] as const).map((item) => (
              <div key={item.key} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/40 transition-colors">
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", item.color)}>
                  <item.icon className="h-4 w-4" weight="bold" />
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                  <p className="text-sm font-medium">{item.label}</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-56 text-xs">
                      {item.tooltip}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Switch
                  checked={onboardingToggles[item.key]}
                  onCheckedChange={(v) => setOnboardingToggles((prev) => ({ ...prev, [item.key]: v }))}
                />
              </div>
            ))}
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 pb-6 pt-3 flex-col gap-3 sm:flex-col sm:space-x-0">
            <Button onClick={handleEnableAll} disabled={isEnablingAll} className="w-full h-11 text-sm font-semibold gap-2">
              <EnvelopeSimple className="h-4 w-4" weight="bold" />
              {isEnablingAll ? "Saving..." : "Save Preferences"}
            </Button>
            <div className="flex items-center justify-between w-full">
              <button
                onClick={() => setOnboardingToggles({ paymentReceipts: true, overdueAlerts: true, lenderPayment: true, lenderDocument: true, lenderPenalty: true, dailySummary: true })}
                disabled={isEnablingAll}
                className="text-xs text-primary hover:underline transition-colors"
              >
                Enable all
              </button>
              <button
                onClick={handleDismissOnboarding}
                disabled={isEnablingAll}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip for now
              </button>
            </div>
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

function toNumber(v: number | string | null | undefined): number {
  if (v == null) return 0
  return typeof v === 'string' ? parseFloat(v) || 0 : v
}
