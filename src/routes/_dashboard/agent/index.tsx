import { createFileRoute, Link } from "@tanstack/react-router"
import { getAgentDashboard, getAgentUpcomingPayments } from "@/server/agents"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
} from "@phosphor-icons/react"

export const Route = createFileRoute("/_dashboard/agent/")({
  loader: async ({ context }) => {
    const { session } = context as { session: { user: { role: string | null } } }
    if (!hasRole(session.user.role, ROLES.AGENT)) {
      return { dashboard: null, upcoming: [], unauthorized: true }
    }
    const [dashboard, upcoming] = await Promise.all([
      getAgentDashboard(),
      getAgentUpcomingPayments(),
    ])
    return { dashboard, upcoming, unauthorized: false }
  },
  component: AgentDashboardPage,
})

function AgentDashboardPage() {
  const { dashboard, upcoming, unauthorized } = Route.useLoaderData()

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
    <div className="space-y-4 md:space-y-6">
      {/* Header - Compact on mobile */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground hidden sm:block">Track your collections and earnings</p>
        </div>
        {/* Quick action on mobile */}
        <Link to="/agent/payments" className="md:hidden">
          <Button size="sm" className="gap-1.5">
            <Receipt className="h-4 w-4" />
            Collect
          </Button>
        </Link>
      </div>

      {/* Overdue Payments Banner - Compact */}
      {overduePayments.length > 0 && (
        <div className="rounded-lg border bg-destructive/5 border-destructive/20 p-3 md:p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <Warning className="h-4 w-4 md:h-5 md:w-5 text-destructive" weight="fill" />
              </div>
              <div>
                <p className="font-semibold text-sm text-destructive">
                  {overduePayments.length} overdue
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(overduePayments.reduce((s, p) => s + parseFloat(p.amount), 0))}
                </p>
              </div>
            </div>
            <Link to="/agent/payments">
              <Button size="sm" variant="destructive" className="gap-1 text-xs md:text-sm">
                Collect
                <ArrowRight className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Upcoming Payments Banner - Compact */}
      {upcomingPayments.length > 0 && overduePayments.length === 0 && (
        <div className="rounded-lg border bg-primary/5 border-primary/20 p-3 md:p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bell className="h-4 w-4 md:h-5 md:w-5 text-primary" weight="fill" />
              </div>
              <div>
                <p className="font-semibold text-sm">
                  {upcomingPayments.length} due soon
                </p>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {upcomingPayments[0]?.contactName} {upcomingPayments.length > 1 && `+${upcomingPayments.length - 1} more`}
                </p>
              </div>
            </div>
            <Link to="/agent/payments">
              <Button size="sm" className="gap-1 text-xs md:text-sm">
                View
                <ArrowRight className="h-3 w-3 md:h-4 md:w-4" />
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
