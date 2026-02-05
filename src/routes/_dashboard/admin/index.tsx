import { createFileRoute } from "@tanstack/react-router"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import { PageHeader, PageContent } from "@/components/ui/page-header"
import { AccessDenied } from "@/components/access-denied"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { getAdminStats } from "@/server/admin"
import {
  Users,
  CurrencyCircleDollar,
  AddressBook,
  ClipboardText,
} from "@phosphor-icons/react"

export const Route = createFileRoute("/_dashboard/admin/")({
  loader: async ({ context }) => {
    const { session } = context as {
      session: { user: { role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.ADMIN)) {
      return { stats: null, unauthorized: true }
    }
    const stats = await getAdminStats()
    return { stats, unauthorized: false }
  },
  component: AdminDashboard,
})

function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

function AdminDashboard() {
  const { stats, unauthorized } = Route.useLoaderData()

  if (unauthorized || !stats) {
    return (
      <AccessDenied
        message="Only admins can access this page."
        homeLink="/dashboard"
        homeLinkLabel="Go to Dashboard"
      />
    )
  }

  return (
    <div>
      <PageHeader
        badge="Admin Portal"
        section="Overview"
        title="Admin Dashboard"
        subtitle="Platform-wide statistics and management"
      />
      <PageContent>
        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Users"
            value={stats.users.total}
            icon={<Users className="h-5 w-5" weight="bold" />}
            description={`${stats.users.newThisWeek} new this week`}
          />
          <StatCard
            label="Active Loans"
            value={stats.loans.active}
            icon={<CurrencyCircleDollar className="h-5 w-5" weight="bold" />}
            description={`${stats.loans.total} total loans`}
          />
          <StatCard
            label="Contacts"
            value={stats.contacts.total}
            icon={<AddressBook className="h-5 w-5" weight="bold" />}
          />
          <StatCard
            label="Audit Events"
            value={stats.audit.last7d}
            icon={<ClipboardText className="h-5 w-5" weight="bold" />}
            description={`${stats.audit.last24h} in last 24h`}
          />
        </div>

        {/* User Breakdown */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle>User Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1 p-4 rounded bg-secondary">
                <p className="text-sm text-muted-foreground">Lenders</p>
                <p className="text-2xl font-bold">{stats.users.lenders}</p>
              </div>
              <div className="space-y-1 p-4 rounded bg-secondary">
                <p className="text-sm text-muted-foreground">Agents</p>
                <p className="text-2xl font-bold">{stats.users.agents}</p>
              </div>
              <div className="space-y-1 p-4 rounded bg-secondary">
                <p className="text-sm text-muted-foreground">Admins</p>
                <p className="text-2xl font-bold">{stats.users.admins}</p>
              </div>
              <div className="space-y-1 p-4 rounded bg-secondary">
                <p className="text-sm text-muted-foreground">Banned</p>
                <p className="text-2xl font-bold text-destructive">
                  {stats.users.banned}
                </p>
              </div>
              <div className="space-y-1 p-4 rounded bg-secondary">
                <p className="text-sm text-muted-foreground">New This Month</p>
                <p className="text-2xl font-bold">{stats.users.newThisMonth}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle>Financial Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1 p-4 rounded bg-secondary">
                <p className="text-sm text-muted-foreground">Total Disbursed</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(stats.loans.disbursed)}
                </p>
              </div>
              <div className="space-y-1 p-4 rounded bg-secondary">
                <p className="text-sm text-muted-foreground">Total Collected</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(stats.loans.collected)}
                </p>
              </div>
              <div className="space-y-1 p-4 rounded bg-secondary">
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(stats.loans.outstanding)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </div>
  )
}
