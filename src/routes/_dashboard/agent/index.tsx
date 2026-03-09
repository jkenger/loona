import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { SkeletonStatsPage } from "@/components/ui/skeleton"
import { getAgentDashboard, getAgentUpcomingPayments } from "@/server/agents"
import { getAgentLoanCreationPermission } from "@/server/loans"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AccessDenied } from "@/components/access-denied"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { formatCurrency } from "@/lib/utils"
import { formatRelativeDate } from "@/lib/utils/date"
import { RecordPaymentDialog } from "@/components/record-payment-dialog"
import { PenaltyItems } from "@/components/penalty-items"
import {
  Plus,
  Warning,
  CheckCircle,
  Phone,
  ArrowRight,
  CaretDown,
  Clock,
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
  pendingComponent: SkeletonStatsPage,
  component: AgentHomePage,
})

function AgentHomePage() {
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

  const canRecordPayments = dashboard.canRecordPayments

  // Client-side grouping
  const now = new Date()
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const overdue = upcoming
    .filter((p) => p.status === "overdue")
    .sort((a, b) => b.daysOverdue - a.daysOverdue)

  const nonOverdue = upcoming.filter((p) => p.status !== "overdue")

  const thisWeek = nonOverdue.filter((p) => new Date(p.dueDate) <= sevenDays)

  const upcomingItems = nonOverdue.filter((p) => new Date(p.dueDate) > sevenDays)

  const allItems = [...overdue, ...thisWeek, ...upcomingItems]
  const totalAmount = allItems.reduce(
    (sum, p) => sum + parseFloat(p.amount) - parseFloat(p.paidAmount),
    0
  )

  // Collect dialog state
  const [selectedItem, setSelectedItem] = useState<(typeof upcoming)[0] | null>(null)

  // Upcoming section collapsed by default
  const [upcomingExpanded, setUpcomingExpanded] = useState(false)

  const isEmpty = overdue.length === 0 && thisWeek.length === 0 && upcomingItems.length === 0

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Page title */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {isEmpty ? (
            <>
              <h1 className="text-3xl font-bold tracking-tight">You're all caught up</h1>
              <p className="text-muted-foreground">No payments to collect right now.</p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold tracking-tight">Agent Portal</h1>
              <p className="text-muted-foreground">
                {allItems.length} payment{allItems.length !== 1 ? "s" : ""} to collect — {formatCurrency(totalAmount)}
              </p>
            </>
          )}
        </div>
        {canCreateLoans && (
          <Link to="/agent/loans/new">
            <Button size="sm" className="gap-1.5 shrink-0">
              <Plus className="h-3.5 w-3.5" weight="bold" />
              <span className="hidden sm:inline">Create Loan</span>
              <span className="sm:hidden">New</span>
            </Button>
          </Link>
        )}
      </div>

      {/* Task list — single column, mobile-first */}
      <div className="mx-auto max-w-2xl space-y-4">

        {/* Empty state */}
        {isEmpty && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="h-12 w-12 text-primary mb-3" weight="fill" />
              <p className="text-muted-foreground text-sm">No payments due in the next 30 days.</p>
            </CardContent>
          </Card>
        )}

        {/* OVERDUE section */}
        {overdue.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2 px-1">
              <Warning className="h-4 w-4 text-destructive" weight="fill" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-destructive">
                Overdue
              </h2>
              <span className="text-xs text-muted-foreground">({overdue.length})</span>
            </div>
            <Card className="border-destructive/30 divide-y">
              {overdue.map((item) => (
                <TaskRow
                  key={item.id}
                  item={item}
                  variant="overdue"
                  canRecordPayments={canRecordPayments}
                  onCollect={() => setSelectedItem(item)}
                />
              ))}
            </Card>
          </section>
        )}

        {/* THIS WEEK section */}
        {thisWeek.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2 px-1">
              <Clock className="h-4 w-4 text-foreground" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                This Week
              </h2>
              <span className="text-xs text-muted-foreground">({thisWeek.length})</span>
            </div>
            <Card className="divide-y">
              {thisWeek.map((item) => (
                <TaskRow
                  key={item.id}
                  item={item}
                  variant="default"
                  canRecordPayments={canRecordPayments}
                  onCollect={() => setSelectedItem(item)}
                />
              ))}
            </Card>
          </section>
        )}

        {/* UPCOMING section — collapsed by default */}
        {upcomingItems.length > 0 && (
          <section>
            <button
              onClick={() => setUpcomingExpanded((v) => !v)}
              className="flex items-center gap-2 mb-2 px-1 w-full text-left"
            >
              <CaretDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${upcomingExpanded ? "rotate-0" : "-rotate-90"}`}
              />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Upcoming
              </h2>
              <span className="text-xs text-muted-foreground">
                {upcomingItems.length} more in next 30 days
              </span>
            </button>
            {upcomingExpanded && (
              <Card className="divide-y">
                {upcomingItems.map((item) => (
                  <TaskRow
                    key={item.id}
                    item={item}
                    variant="default"
                    canRecordPayments={canRecordPayments}
                    onCollect={() => setSelectedItem(item)}
                  />
                ))}
              </Card>
            )}
          </section>
        )}

        {/* RECENT ACTIVITY */}
        {dashboard.recentPayments.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2 px-1">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recent Activity
              </h2>
              <Link
                to="/agent/payments"
                className="text-xs font-medium text-primary hover:underline flex items-center gap-0.5"
              >
                View all history
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <Card className="divide-y">
              {dashboard.recentPayments.slice(0, 5).map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{payment.contactName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeDate(payment.paidAt)} · {payment.method.toUpperCase()}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-primary shrink-0 ml-2">
                    +{formatCurrency(payment.amount)}
                  </p>
                </div>
              ))}
            </Card>
          </section>
        )}

        {/* No relationships state */}
        {dashboard.relationships.length === 0 && isEmpty && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <p className="text-muted-foreground text-sm text-center">
                Once a lender adds you as their agent, your tasks will appear here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        open={!!selectedItem}
        onOpenChange={(open) => { if (!open) setSelectedItem(null) }}
        loanId={selectedItem?.loanId ?? ""}
        borrowerName={selectedItem?.contactName ?? ""}
        scheduleItem={selectedItem}
        appliedPenalties={0}
      />
    </div>
  )
}

// ---- Task row component ----

interface UpcomingItem {
  id: string
  dueDate: string
  amount: string
  status: string
  paidAmount: string
  loanId: string
  contactName: string
  contactId: string
  contactPhone: string | null
  penalties: { id: string; penaltyType: string; amount: string; status: string }[]
  daysOverdue: number
  penaltyIn: number
}

function TaskRow({
  item,
  variant,
  canRecordPayments,
  onCollect,
}: {
  item: UpcomingItem
  variant: "overdue" | "default"
  canRecordPayments: boolean | undefined
  onCollect: () => void
}) {
  const remaining = parseFloat(item.amount) - parseFloat(item.paidAmount)

  const isOverdue = variant === "overdue"

  // Due label
  let dueLabel: string
  if (isOverdue) {
    dueLabel =
      item.daysOverdue === 1
        ? "1 day overdue"
        : `${item.daysOverdue} days overdue`
  } else {
    dueLabel = `Due ${formatRelativeDate(item.dueDate).toLowerCase()}`
  }

  return (
    <PenaltyItems
      penalties={item.penalties ?? []}
      daysOverdue={item.daysOverdue}
      penaltyIn={item.penaltyIn}
      formatCurrency={formatCurrency}
    >
      {({ toggleButton, detailPanel }) => (
        <div className={isOverdue ? "bg-destructive/[0.03]" : ""}>
          <div className="flex items-center gap-3 px-4 py-3">
            {/* Left: name + due info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Link
                  to="/agent/contacts/$contactId"
                  params={{ contactId: item.contactId }}
                  className="font-medium text-sm truncate hover:underline"
                >
                  {item.contactName}
                </Link>
                {item.contactPhone && (
                  <a
                    href={`tel:${item.contactPhone}`}
                    className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`text-xs ${
                    isOverdue ? "text-destructive font-medium" : "text-muted-foreground"
                  }`}
                >
                  {dueLabel}
                </span>
                {toggleButton}
              </div>
            </div>

            {/* Right: amount + collect button */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right">
                <p className="font-semibold text-sm">{formatCurrency(remaining)}</p>
              </div>
              {canRecordPayments && (
                <Button
                  size="sm"
                  variant={isOverdue ? "destructive" : "default"}
                  onClick={onCollect}
                  className="h-9 px-3"
                >
                  Collect
                </Button>
              )}
            </div>
          </div>

          {/* Penalty detail panel */}
          {detailPanel && (
            <div className="px-4 pb-3">
              {detailPanel}
            </div>
          )}
        </div>
      )}
    </PenaltyItems>
  )
}
