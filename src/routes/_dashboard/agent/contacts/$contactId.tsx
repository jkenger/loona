import { createFileRoute, Link } from "@tanstack/react-router"
import { SkeletonDetailPage } from "@/components/ui/skeleton"
import { getAgentContact } from "@/server/agents"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { AccessDenied } from "@/components/access-denied"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { formatCurrencyCompact } from "@/lib/utils"
import {
  ArrowLeft,
  Phone,
  Envelope,
  MapPin,
  FacebookLogo,
  CurrencyCircleDollar,
  ArrowRight,
  User,
} from "@phosphor-icons/react"

export const Route = createFileRoute("/_dashboard/agent/contacts/$contactId")({
  loader: async ({ params, context }) => {
    const { session } = context as { session: { user: { role: string | null } } }
    if (!hasRole(session.user.role, ROLES.AGENT)) {
      return { contact: null, unauthorized: true }
    }
    try {
      const contact = await getAgentContact({ data: params.contactId })
      return { contact, unauthorized: false }
    } catch {
      return { contact: null, unauthorized: false }
    }
  },
  pendingComponent: SkeletonDetailPage,
  component: AgentContactDetailPage,
})

function AgentContactDetailPage() {
  const { contact, unauthorized } = Route.useLoaderData()

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

  if (!contact) {
    return (
      <AccessDenied
        title="Contact Not Found"
        message="This contact doesn't exist or you don't have access to it."
        homeLink="/agent/contacts"
        homeLinkLabel="Back to Contacts"
      />
    )
  }

  const activeLoans = contact.loans.filter((l) => l.status === "active")
  const totalRemaining = contact.loans.reduce(
    (sum, l) => sum + parseFloat(l.remainingBalance),
    0
  )

  const statusColors: Record<string, string> = {
    pending_disbursement: "outline",
    active: "secondary",
    completed: "default",
    defaulted: "destructive",
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Back Link */}
      <Link
        to="/agent/contacts"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Contacts
      </Link>

      {/* Title */}
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-7 w-7 text-primary" weight="bold" />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{contact.name}</h1>
            {activeLoans.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {activeLoans.length} loan{activeLoans.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            {formatCurrencyCompact(totalRemaining)} remaining
          </p>
        </div>
      </div>

      {/* Contact Info - Compact */}
      <Card className="shadow-sm rounded-xl">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base md:text-lg">Contact Info</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid gap-2 sm:grid-cols-2">
            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="font-medium text-sm truncate">{contact.phone}</p>
                </div>
              </a>
            )}

            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Envelope className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium text-sm truncate">{contact.email}</p>
                </div>
              </a>
            )}

            {(contact.address || contact.city) && (
              <div className="flex items-center gap-2 p-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p className="font-medium text-sm truncate">
                    {[contact.address, contact.city].filter(Boolean).join(", ")}
                  </p>
                </div>
              </div>
            )}

            {contact.facebookProfile && (
              <a
                href={contact.facebookProfile}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <FacebookLogo className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Facebook</p>
                  <p className="font-medium text-sm text-primary">View Profile</p>
                </div>
              </a>
            )}
          </div>

          {contact.notes && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{contact.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assigned Loans */}
      <Card className="shadow-sm rounded-xl">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <CurrencyCircleDollar className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            Loans
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {contact.loans.length > 0 ? (
            <div className="space-y-2">
              {contact.loans.map((loan) => {
                const progress =
                  (parseFloat(loan.amountPaid) /
                    (parseFloat(loan.amountPaid) +
                      parseFloat(loan.remainingBalance))) *
                  100

                return (
                  <Link
                    key={loan.id}
                    to="/agent/loans/$loanId"
                    params={{ loanId: loan.id }}
                    className="block"
                  >
                    <div className="p-2 md:p-3 rounded border hover:border-primary/50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm">
                            {formatCurrencyCompact(loan.principal)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {loan.interestRate}% · {loan.termMonths}mo · {loan.paymentFrequency}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <Badge variant={statusColors[loan.status] as any} className="text-xs">
                            {loan.status.replace("_", " ")}
                          </Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Progress</span>
                          <span>
                            {formatCurrencyCompact(loan.amountPaid)} / {formatCurrencyCompact(
                              parseFloat(loan.amountPaid) + parseFloat(loan.remainingBalance)
                            )}
                          </span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-6 text-sm">
              No assigned loans for this contact
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
