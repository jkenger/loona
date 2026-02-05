import { createFileRoute, Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { getAgentContacts } from '@/server/agents'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AccessDenied } from '@/components/access-denied'
import { hasRole, ROLES } from '@/lib/constants/roles'
import { formatCurrencyCompact } from '@/lib/utils'
import {
  Users,
  ArrowRight,
  CurrencyCircleDollar,
} from '@phosphor-icons/react'

export const Route = createFileRoute('/_dashboard/agent/contacts/')({
  loader: async ({ context }) => {
    const { session } = context as {
      session: { user: { role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.AGENT)) {
      return { contacts: [], unauthorized: true }
    }
    const contacts = await getAgentContacts()
    return { contacts, unauthorized: false }
  },
  component: AgentContactsPage,
})

function AgentContactsPage() {
  const { contacts, unauthorized } = Route.useLoaderData()

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
            <span>Contacts</span>
            <span className="text-blue-300/40">·</span>
            <span>{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
          </div>

          {/* Title Row */}
          <div className="border-l-4 border-primary pl-4">
            <h1 className="text-4xl font-bold tracking-tight">Contacts</h1>
            <p className="text-blue-200/70">Borrowers with loans assigned to you</p>
          </div>
        </div>
      </div>

      {/* Content - overlaps header */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-8 pb-8 space-y-6 relative">

      {/* Stats - 3 column on mobile */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">
              Contacts
            </CardTitle>
            <Users className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-lg md:text-2xl font-bold">
              {contacts.length}
            </div>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">
              Loans
            </CardTitle>
            <CurrencyCircleDollar className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-lg md:text-2xl font-bold">
              {contacts.reduce((sum, c) => sum + c.activeLoans, 0)}
            </div>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">
              To Collect
            </CardTitle>
            <CurrencyCircleDollar className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-lg md:text-2xl font-bold">
              {formatCurrencyCompact(
                contacts.reduce(
                  (sum, c) => sum + parseFloat(c.totalRemaining),
                  0,
                ),
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contacts List */}
      {contacts.length > 0 ? (
        <Card className="shadow-lg">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base md:text-lg">
              Your Contacts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-2">
              {contacts.map((contact) => (
                <Link
                  key={contact.id}
                  to="/agent/contacts/$contactId"
                  params={{ contactId: contact.id }}
                  className="block"
                >
                  <div className="flex items-center justify-between p-2 md:p-3 rounded border hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                      <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs md:text-sm font-medium text-primary">
                          {contact.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm md:text-base truncate">
                          {contact.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate hidden sm:block">
                          {contact.phone || contact.city || 'No contact info'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3 shrink-0 ml-2">
                      <div className="text-right">
                        <Badge variant="secondary" className="text-xs">
                          {contact.activeLoans} loan
                          {contact.activeLoans !== 1 ? 's' : ''}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatCurrencyCompact(contact.totalRemaining)}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 md:py-12">
            <Users className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground/50 mb-3" />
            <h3 className="text-base md:text-lg font-semibold mb-1">
              No contacts assigned
            </h3>
            <p className="text-muted-foreground text-xs md:text-sm text-center max-w-md px-4">
              When your lenders assign loans to you, the borrowers will appear
              here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
    </div>
  )
}
