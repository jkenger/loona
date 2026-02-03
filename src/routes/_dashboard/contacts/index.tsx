import { createFileRoute, Link } from "@tanstack/react-router"
import { getContacts } from "@/server/contacts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { AccessDenied } from "@/components/access-denied"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { Plus, MagnifyingGlass, User, Phone, Envelope } from "@phosphor-icons/react"
import { useState } from "react"

export const Route = createFileRoute("/_dashboard/contacts/")({
  loader: async ({ context }) => {
    const { session } = context as { session: { user: { role: string | null } } }
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      return { contacts: [], unauthorized: true }
    }
    const contacts = await getContacts()
    return { contacts, unauthorized: false }
  },
  pendingComponent: ContactsPageSkeleton,
  component: ContactsPage,
})

function ContactsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-10 w-full max-w-sm" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    </div>
  )
}

function ContactsPage() {
  const { contacts, unauthorized } = Route.useLoaderData()
  const [search, setSearch] = useState("")

  if (unauthorized) {
    return (
      <AccessDenied
        message="Only lenders can access the contacts page."
        homeLink="/agent"
        homeLinkLabel="Go to Agent Portal"
      />
    )
  }

  const filteredContacts = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(search.toLowerCase()) ||
    contact.phone?.toLowerCase().includes(search.toLowerCase()) ||
    contact.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground">Manage your borrowers</p>
        </div>
        <Link to="/contacts/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" weight="bold" />
            Add Contact
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Contacts Grid */}
      {filteredContacts.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredContacts.map((contact) => (
            <Link key={contact.id} to="/contacts/$contactId" params={{ contactId: contact.id }}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{contact.name}</CardTitle>
                        {contact.city && (
                          <CardDescription>{contact.city}</CardDescription>
                        )}
                      </div>
                    </div>
                    {contact.activeLoans > 0 && (
                      <Badge variant="secondary">{contact.activeLoans} active</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-2">
                  {contact.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      {contact.phone}
                    </div>
                  )}
                  {contact.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Envelope className="h-4 w-4" />
                      {contact.email}
                    </div>
                  )}
                  <div className="pt-2 text-xs text-muted-foreground">
                    {contact.totalLoans} total loan{contact.totalLoans !== 1 ? "s" : ""}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 md:py-12">
            <User className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No contacts found</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {search ? "Try a different search term" : "Get started by adding your first contact"}
            </p>
            {!search && (
              <Link to="/contacts/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
