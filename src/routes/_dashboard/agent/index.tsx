import { createFileRoute, Link } from "@tanstack/react-router"
import { format } from "date-fns"
import { getAgentDashboard, getAgentUpcomingPayments } from "@/server/agents"
import { getAgentLoanCreationPermission } from "@/server/loans"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AccessDenied } from "@/components/access-denied"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { formatRelativeDate, formatRelativeDateLower } from "@/lib/utils/date"
import {
  CurrencyCircleDollar,
  Receipt,
  Wallet,
  Clock,
  ArrowRight,
  Bell,
  Warning,
  Plus,
} from "@phosphor-icons/react"

export const Route = createFileRoute("/_dashboard/agent/")({
  loader: async ({ context }) => {
    const { session } = context as { session: { user: { role: string | null } } }
    if (!hasRole(session.user.role, ROLES.AGENT)) {
      return { dashboard: null, upcoming: [], canCreateLoans: false, unauthorized: true }
    }
    const [dashboard, upcoming, loanPermissions] = await Promise.all([
      getAgentDashboard(),
      getAgentUpcomingPayments(),
      getAgentLoanCreationPermission(),
    ])
    return { dashboard, upcoming, canCreateLoans: loanPermissions.length > 0, unauthorized: false }
  },
  component: AgentDashboardPage,
})

function AgentDashboardPage() {
  const { dashboard, upcoming, canCreateLoans, unauthorized } = Route.useLoaderData()

  if (unauthorized || !dashboard) {
    return (
      <AccessDenied
        title="Agent Portal"
        message="You need to be an agent to access this portal."
        homeLink="/dashboard"
        homeLinkLabel="Go to Dashboard"
      />
    )
  }

  const overduePayments = upcoming.filter((p) => p.status === "overdue")
  const upcomingPayments = upcoming.filter((p) => p.status !== "overdue").slice(0, 5)

  return (
    <div>
      {/* Header with background */}
      <div className="bg-[hsl(215_45%_14%)] text-white pt-6 lg:pt-8 pb-16">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 space-y-4">
          {/* Meta Bar */}
          <div className="flex items-center gap-2 text-sm text-blue-200/70">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/20 text-primary-foreground text-xs font-medium">
              Agent Portal
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
              <p className="text-blue-200/70">Track your collections and earnings</p>
            </div>
            <div className="flex gap-2">
              {canCreateLoans && (
                <Link to="/agent/loans/new">
                  <Button variant="outline" className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20">
                    <Plus className="h-4 w-4" weight="bold" />
                    Create Loan
                  </Button>
                </Link>
              )}
              <Link to="/agent/payments">
                <Button className="gap-2">
                  <Receipt className="h-4 w-4" weight="bold" />
                  Collect Payment
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content - overlaps header */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-8 pb-8 space-y-6 relative">

      {/* Overdue Payments Banner */}
      {overduePayments.length > 0 && (
        <div className="rounded-lg border border-destructive/20 bg-card shadow-lg p-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-destructive/5 pointer-events-none" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <Warning className="h-5 w-5 text-destructive" weight="fill" />
              </div>
              <div>
                <p className="font-semibold text-sm text-destructive">
                  {overduePayments.length} overdue payment
                  {overduePayments.length !== 1 ? 's' : ''}
                </p>
                <p className="text-sm text-muted-foreground">
                  Total overdue: {formatCurrency(overduePayments.reduce((s, p) => s + parseFloat(p.amount), 0))}
                </p>
              </div>
            </div>
            <Link to="/agent/payments">
              <Button size="sm" variant="destructive" className="gap-1.5">
                Collect Now
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Upcoming Payments Banner */}
      {upcomingPayments.length > 0 && overduePayments.length === 0 && (
        <div className="rounded-lg border border-primary/20 bg-card shadow-lg p-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bell className="h-5 w-5 text-primary" weight="fill" />
              </div>
              <div>
                <p className="font-semibold text-sm">
                  {upcomingPayments.length} payment
                  {upcomingPayments.length !== 1 ? 's' : ''} due this week
                </p>
                <p className="text-sm text-muted-foreground">
                  {upcomingPayments.slice(0, 3).map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && ', '}
                      {p.contactName} (
                      {formatCurrency(parseFloat(p.amount) - parseFloat(p.paidAmount))}{' '}
                      {formatRelativeDateLower(p.dueDate)})
                    </span>
                  ))}
                  {upcomingPayments.length > 3 && (
                    <span> and {upcomingPayments.length - 3} more</span>
                  )}
                </p>
              </div>
            </div>
            <Link to="/agent/payments">
              <Button size="sm" className="gap-1.5">
                View Payments
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Stats Cards - 2x2 grid on mobile */}
      <div className="grid grid-cols-2 gap-2 md:gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Collected</CardTitle>
            <Receipt className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-lg md:text-2xl font-bold">{formatCurrencyCompact(dashboard.totalCollected)}</div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Earned</CardTitle>
            <CurrencyCircleDollar className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-lg md:text-2xl font-bold">{formatCurrencyCompact(dashboard.totalCommissionEarned)}</div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Pending</CardTitle>
            <Wallet className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-lg md:text-2xl font-bold text-primary">{formatCurrencyCompact(dashboard.pendingCommission)}</div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Lenders</CardTitle>
            <Clock className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-lg md:text-2xl font-bold">{dashboard.relationships.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Lender Relationships - Compact on mobile */}
      {dashboard.relationships.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base md:text-lg">Your Lenders</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-2 md:space-y-3">
              {dashboard.relationships.map((rel) => (
                <div
                  key={rel.id}
                  className="flex items-center justify-between p-2 md:p-3 rounded border"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm md:text-base truncate">{rel.lenderName}</p>
                    <p className="text-xs text-muted-foreground truncate hidden sm:block">{rel.lenderEmail}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <Badge variant="secondary" className="text-xs">{rel.commissionRate}%</Badge>
                    <p className="text-xs text-primary font-medium mt-0.5">
                      {formatCurrencyCompact(rel.pendingCommission)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Payments - Compact on mobile */}
      <Card>
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base md:text-lg">Recent Collections</CardTitle>
          <Link
            to="/agent/loans"
            className="text-xs md:text-sm font-medium text-primary hover:underline flex items-center gap-1"
          >
            All loans
            <ArrowRight className="h-3 w-3 md:h-4 md:w-4" />
          </Link>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {dashboard.recentPayments.length > 0 ? (
            <div className="space-y-2">
              {dashboard.recentPayments.slice(0, 5).map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between py-1.5 md:py-2 border-b last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{payment.contactName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeDate(payment.paidAt)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="font-semibold text-sm">{formatCurrencyCompact(payment.amount)}</p>
                    <span className="text-xs text-muted-foreground uppercase">
                      {payment.method}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-6 text-sm">
              No payments recorded yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Empty state for no relationships */}
      {dashboard.relationships.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 md:py-12">
            <CurrencyCircleDollar className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground/50 mb-3" />
            <h3 className="text-base md:text-lg font-semibold mb-1">No active assignments</h3>
            <p className="text-muted-foreground text-xs md:text-sm text-center max-w-md px-4">
              Once a lender adds you as their agent, their loans will appear here.
            </p>
          </CardContent>
        </Card>
      )}
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

function formatCurrencyCompact(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  if (num >= 1000000) {
    return `₱${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `₱${(num / 1000).toFixed(num >= 10000 ? 0 : 1)}K`
  }
  return `₱${num.toLocaleString()}`
}
