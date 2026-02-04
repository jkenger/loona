import { createFileRoute, Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { getAgentLoans } from '@/server/agents'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AccessDenied } from '@/components/access-denied'
import { hasRole, ROLES } from '@/lib/constants/roles'
import { formatCurrencyCompact } from '@/lib/utils'
import { CurrencyCircleDollar, Phone, ArrowRight } from '@phosphor-icons/react'

export const Route = createFileRoute('/_dashboard/agent/loans/')({
  loader: async ({ context }) => {
    const { session } = context as {
      session: { user: { role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.AGENT)) {
      return { loans: [], unauthorized: true }
    }
    const loans = await getAgentLoans()
    return { loans, unauthorized: false }
  },
  component: AgentLoansPage,
})

function AgentLoansPage() {
  const { loans, unauthorized } = Route.useLoaderData()

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

  const statusColors: Record<string, string> = {
    pending_disbursement: 'outline',
    active: 'secondary',
    completed: 'default',
    defaulted: 'destructive',
  }

  const statusLabels: Record<string, string> = {
    pending_disbursement: 'Pending',
    active: 'Active',
    completed: 'Done',
    defaulted: 'Default',
  }

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
            <span>Loans</span>
            <span className="text-blue-300/40">·</span>
            <span>{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
          </div>

          {/* Title Row */}
          <div className="border-l-4 border-amber-500 pl-4">
            <h1 className="text-4xl font-bold tracking-tight">Loans</h1>
            <p className="text-blue-200/70">Loans assigned to you for collection</p>
          </div>
        </div>
      </div>

      {/* Content - overlaps header */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-8 pb-8 space-y-6 relative">

      {/* Loans Grid */}
      {loans.length > 0 ? (
        <div className="grid gap-3 md:gap-4 md:grid-cols-2 lg:grid-cols-3 [&>a>div]:shadow-lg">
          {loans.map((loan) => {
            const amountPaid = parseFloat(loan.amountPaid)
            const remaining = parseFloat(loan.remainingBalance)
            const progress =
              amountPaid + remaining > 0
                ? (amountPaid / (amountPaid + remaining)) * 100
                : 0

            return (
              <Link
                key={loan.id}
                to="/agent/loans/$loanId"
                params={{ loanId: loan.id }}
                className="block"
              >
                <Card className="overflow-hidden hover:border-primary/50 transition-colors">
                  <CardHeader className="p-3 md:p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-sm md:text-base truncate">
                          {loan.contactName}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {loan.contactPhone || 'No phone'}
                          </span>
                        </p>
                      </div>
                      <Badge
                        variant={statusColors[loan.status] as any}
                        className="text-xs shrink-0"
                      >
                        {statusLabels[loan.status]}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 md:p-4 pt-0 space-y-3">
                    {/* Amount */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Principal</span>
                      <span className="font-semibold">
                        {formatCurrencyCompact(loan.principal)}
                      </span>
                    </div>

                    {/* Progress */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">
                          {Math.round(progress)}%
                        </span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatCurrencyCompact(amountPaid)} paid</span>
                        <span>{formatCurrencyCompact(remaining)} left</span>
                      </div>
                    </div>

                    {/* Lender */}
                    <div className="flex items-center justify-between pt-2 border-t text-xs">
                      <span className="text-muted-foreground truncate flex-1">
                        {loan.lenderName}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 md:py-12">
            <CurrencyCircleDollar className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground/50 mb-3" />
            <h3 className="text-base md:text-lg font-semibold mb-1">
              No loans assigned
            </h3>
            <p className="text-muted-foreground text-xs md:text-sm text-center max-w-md px-4">
              Your lenders need to assign loans to you before they appear here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
    </div>
  )
}
