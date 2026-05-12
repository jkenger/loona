import { createFileRoute, Link } from "@tanstack/react-router"
import { getContact } from "@/server/contacts"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { AccessDenied } from "@/components/access-denied"
import { SkeletonDetailPage } from "@/components/ui/skeleton"
import { ArrowLeft } from "@phosphor-icons/react"
import { format, differenceInMonths } from "date-fns"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_dashboard/contacts/$contactId/receipt")({
  loader: async ({ params, context }) => {
    const { session } = context as {
      session: { user: { role: string | null; name: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      return { contact: null, unauthorized: true, lenderName: "" }
    }
    try {
      const contact = await getContact({ data: params.contactId })
      if (!contact.isLender) {
        return { contact: null, unauthorized: true, lenderName: "" }
      }
      return { contact, unauthorized: false, lenderName: session.user.name ?? "" }
    } catch {
      return { contact: null, unauthorized: false, lenderName: "" }
    }
  },
  pendingComponent: SkeletonDetailPage,
  component: ContactReceiptPage,
})

const OWING_STATUSES = ["active", "defaulted"] as const

function ContactReceiptPage() {
  const { contact, unauthorized, lenderName } = Route.useLoaderData()

  if (unauthorized) {
    return <AccessDenied message="Only lenders can view receipts." homeLink="/dashboard" />
  }

  if (!contact) {
    return (
      <div className="px-4 py-10 text-center text-sm text-muted-foreground">
        Contact not found.{" "}
        <Link to="/loans" className="underline">
          Go back
        </Link>
      </div>
    )
  }

  const owingLoans = contact.loans.filter((l) =>
    (OWING_STATUSES as readonly string[]).includes(l.status),
  )

  const totalAmount = owingLoans.reduce((s, l) => s + parseFloat(l.totalToRepay), 0)
  const collected = owingLoans.reduce((s, l) => s + parseFloat(l.amountPaid), 0)
  const stillOwed = owingLoans.reduce((s, l) => s + parseFloat(l.remainingBalance), 0)
  const progress = totalAmount > 0 ? Math.min((collected / totalAmount) * 100, 100) : 0

  // Earliest opened, latest maturity
  const startDates = owingLoans
    .map((l) => l.startDate)
    .filter((d): d is string => !!d)
    .map((d) => new Date(d))
  const maturityDates = owingLoans
    .map((l) => l.maturityDate)
    .filter((d): d is string => !!d)
    .map((d) => new Date(d))
  const earliestStart = startDates.length
    ? new Date(Math.min(...startDates.map((d) => d.getTime())))
    : null
  const latestMaturity = maturityDates.length
    ? new Date(Math.max(...maturityDates.map((d) => d.getTime())))
    : null

  // Overdue stamp — based on oldest unpaid schedule entry across all owing loans
  const now = new Date()
  const overdueScheduleDates = owingLoans
    .flatMap((l) => l.schedule)
    .filter((s) => !s.paidAt && new Date(s.dueDate) < now)
    .map((s) => new Date(s.dueDate))
  const oldestOverdue = overdueScheduleDates.length
    ? new Date(Math.min(...overdueScheduleDates.map((d) => d.getTime())))
    : null
  const monthsOverdue = oldestOverdue ? differenceInMonths(now, oldestOverdue) : 0

  // Payment history — paid schedule entries across all owing loans, newest first
  const payments = owingLoans
    .flatMap((l) =>
      l.schedule
        .filter((s) => s.paidAt)
        .map((s) => ({
          id: s.id,
          paidAt: s.paidAt!,
          amount: parseFloat(s.paidAmount),
        })),
    )
    .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="min-h-full bg-muted/30 py-6 sm:py-10">
      <div className="max-w-md mx-auto px-4">
        {/* Back link */}
        <Link
          to="/contacts/$contactId"
          params={{ contactId: contact.id }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {contact.name.split(" ")[0]}
        </Link>

        {/* Receipt sheet */}
        <div
          className={cn(
            "relative bg-card text-card-foreground rounded-sm shadow-lg font-mono text-[13px] leading-relaxed",
            "before:absolute before:inset-x-0 before:-top-px before:h-2 before:bg-[radial-gradient(circle_at_4px_0,transparent_3px,hsl(var(--card))_3px)] before:bg-[length:8px_8px] before:bg-repeat-x",
            "after:absolute after:inset-x-0 after:-bottom-px after:h-2 after:bg-[radial-gradient(circle_at_4px_8px,transparent_3px,hsl(var(--card))_3px)] after:bg-[length:8px_8px] after:bg-repeat-x",
          )}
        >
          <div className="px-6 sm:px-8 py-8 space-y-6">
            {/* Title */}
            <div className="text-center space-y-3">
              <h1 className="text-3xl font-bold tracking-tight">
                {contact.name}
              </h1>
              <div className="inline-block border border-foreground px-3 py-1 text-xs font-bold">
                {fmt(stillOwed)} REMAINING
              </div>
            </div>

            {/* Totals */}
            <Section>
              <Row label="TOTAL AMOUNT" value={fmt(totalAmount)} />
              <Row label="COLLECTED" value={fmt(collected)} />
              <Row label="STILL OWED" value={fmt(stillOwed)} bold />
            </Section>

            {/* Progress */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                <span>Collection Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 bg-muted overflow-hidden rounded-full">
                <div
                  className="h-full bg-foreground transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Items owed */}
            <Section title="ITEMS OWED">
              {owingLoans.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No active loans
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    <span>Item</span>
                    <span>Amount</span>
                  </div>
                  {owingLoans.map((l) => {
                    const opened = l.startDate ? new Date(l.startDate) : new Date(l.createdAt)
                    return (
                      <div key={l.id} className="py-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {format(opened, "MMM d, yyyy")}
                        </p>
                        <div className="flex items-start justify-between gap-3">
                          <Link
                            to="/loans/$loanId"
                            params={{ loanId: l.id }}
                            className="text-sm font-medium hover:underline truncate"
                          >
                            {l.purpose || `Loan ${l.id.slice(0, 8)}`}
                          </Link>
                          <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
                            {fmt(parseFloat(l.totalToRepay))}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                  <Divider />
                  <Row label="ITEMS TOTAL" value={fmt(totalAmount)} bold />
                </>
              )}
            </Section>

            {/* Payment history */}
            <Section title="PAYMENT HISTORY">
              {payments.length === 0 ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">No payments yet</span>
                  <span className="font-semibold tabular-nums">{fmt(0)}</span>
                </div>
              ) : (
                <>
                  {payments.slice(0, 10).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        {format(new Date(p.paidAt), "MMM d, yyyy")}
                      </span>
                      <span className="tabular-nums">{fmt(p.amount)}</span>
                    </div>
                  ))}
                  {payments.length > 10 && (
                    <p className="text-[10px] text-muted-foreground italic">
                      + {payments.length - 10} earlier payment
                      {payments.length - 10 === 1 ? "" : "s"}
                    </p>
                  )}
                </>
              )}
              <Divider />
              <Row label="TOTAL PAID" value={fmt(totalPaid)} bold />
            </Section>

            {/* Dates */}
            <Section>
              <Row
                label="OPENED"
                value={earliestStart ? format(earliestStart, "MMM d, yyyy") : "—"}
              />
              <Row
                label="EXPECTED BY"
                value={latestMaturity ? format(latestMaturity, "MMM d, yyyy") : "—"}
              />
            </Section>

            {/* Note */}
            {contact.notes && (
              <Section title="NOTE">
                <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
              </Section>
            )}

            {/* Overdue stamp */}
            {monthsOverdue >= 1 && (
              <div className="flex justify-center py-2">
                <div className="border-2 border-destructive text-destructive font-bold tracking-wider text-sm px-4 py-1 -rotate-[6deg]">
                  {monthsOverdue} MONTH{monthsOverdue === 1 ? "" : "S"} OVERDUE
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="pt-4 border-t border-dashed text-center text-[10px] uppercase tracking-wider text-muted-foreground">
              Printed by {lenderName || "lender"} on{" "}
              {format(now, "MMM d, yyyy")} at {format(now, "h:mm a")}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      {title && (
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-wider">{title}</h2>
        </div>
      )}
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({
  label,
  value,
  bold,
}: {
  label: string
  value: string
  bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={cn(
          "text-[11px] uppercase tracking-wider",
          bold ? "font-bold" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <span className={cn("tabular-nums", bold ? "font-bold" : "text-sm")}>
        {value}
      </span>
    </div>
  )
}

function Divider() {
  return <div className="border-t border-dashed my-1" />
}

function fmt(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
