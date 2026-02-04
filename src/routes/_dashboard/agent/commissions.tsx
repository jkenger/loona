import { createFileRoute } from '@tanstack/react-router'
import { format } from 'date-fns'
import { getAgentDashboard } from '@/server/agents'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AccessDenied } from '@/components/access-denied'
import { hasRole, ROLES } from '@/lib/constants/roles'
import { formatCurrencyCompact } from '@/lib/utils'
import {
  CurrencyCircleDollar,
  Wallet,
  Receipt,
  TrendUp,
} from '@phosphor-icons/react'

export const Route = createFileRoute('/_dashboard/agent/commissions')({
  loader: async ({ context }) => {
    const { session } = context as {
      session: { user: { role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.AGENT)) {
      return { dashboard: null, unauthorized: true }
    }
    const dashboard = await getAgentDashboard()
    return { dashboard, unauthorized: false }
  },
  component: AgentCommissionsPage,
})

function AgentCommissionsPage() {
  const { dashboard, unauthorized } = Route.useLoaderData()

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

  const totalEarned = parseFloat(dashboard.totalCommissionEarned)
  const pending = parseFloat(dashboard.pendingCommission)
  const paid = totalEarned - pending

  return (
    <div>
      {/* Header with background */}
      <div className="bg-[hsl(215_45%_14%)] text-white pt-6 lg:pt-8 pb-16">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 space-y-4">
          {/* Meta Bar */}
          <div className="flex items-center gap-2 text-sm text-blue-200/70">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-xs font-medium">
              Agent Portal
            </span>
            <span className="text-blue-300/40">·</span>
            <span>Commissions</span>
            <span className="text-blue-300/40">·</span>
            <span>{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
          </div>

          {/* Title Row */}
          <div className="border-l-4 border-amber-500 pl-4">
            <h1 className="text-4xl font-bold tracking-tight">Commissions</h1>
            <p className="text-blue-200/70">Track your earnings and payouts</p>
          </div>
        </div>
      </div>

      {/* Content - overlaps header */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-8 pb-8 space-y-6 relative">

      {/* Stats Cards - 3 column on mobile */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">
              Earned
            </CardTitle>
            <TrendUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-lg md:text-2xl font-bold">
              {formatCurrencyCompact(totalEarned)}
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">
              Paid
            </CardTitle>
            <Receipt className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-lg md:text-2xl font-bold">
              {formatCurrencyCompact(paid)}
            </div>
          </CardContent>
        </Card>

        <Card className="p-0 border-amber-500/50 bg-amber-50 dark:bg-amber-950">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">
              Pending
            </CardTitle>
            <Wallet className="h-3.5 w-3.5 md:h-4 md:w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-lg md:text-2xl font-bold text-amber-500">
              {formatCurrencyCompact(pending)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commission by Lender */}
      <Card className="shadow-lg">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base md:text-lg">By Lender</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {dashboard.relationships.length > 0 ? (
            <div className="space-y-2 md:space-y-3">
              {dashboard.relationships.map((rel) => {
                const earned = parseFloat(rel.totalCommissionEarned)
                const relPending = parseFloat(rel.pendingCommission)

                return (
                  <div
                    key={rel.id}
                    className="p-2 md:p-3 rounded border space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">
                          {rel.lenderName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate hidden sm:block">
                          {rel.lenderEmail}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {rel.commissionRate}%
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Collected</p>
                        <p className="font-semibold">
                          {formatCurrencyCompact(rel.totalCollected)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Earned</p>
                        <p className="font-semibold">
                          {formatCurrencyCompact(earned)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Pending</p>
                        <p className="font-semibold text-primary">
                          {formatCurrencyCompact(relPending)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6">
              <CurrencyCircleDollar className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground text-sm">
                No commission data yet
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it works - hidden on mobile */}
      <Card className="hidden md:block shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-lg">How Commissions Work</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-2 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">
              1. Record Payments:
            </span>{' '}
            When you collect payments from borrowers, record them in the app.
          </p>
          <p>
            <span className="font-medium text-foreground">
              2. Earn Commission:
            </span>{' '}
            Your commission is automatically calculated based on the rate set by
            each lender.
          </p>
          <p>
            <span className="font-medium text-foreground">3. Get Paid:</span>{' '}
            Your lender will pay your accumulated commission.
          </p>
        </CardContent>
      </Card>
    </div>
    </div>
  )
}
