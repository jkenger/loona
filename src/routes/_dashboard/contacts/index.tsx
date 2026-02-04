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
import { format } from "date-fns"

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
    <div>
      {/* Header skeleton */}
      <div className="bg-[hsl(215_45%_14%)] text-white pt-6 lg:pt-8 pb-16">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 space-y-4">
          <Skeleton className="h-5 w-64 bg-white/10" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="border-l-4 border-primary pl-4 space-y-2">
              <Skeleton className="h-10 w-40 bg-white/10" />
              <Skeleton className="h-4 w-48 bg-white/10" />
            </div>
            <Skeleton className="h-10 w-32 bg-white/10" />
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-8 pb-8 space-y-6 relative">
        <Card className="shadow-lg">
          <CardContent className="p-4">
            <Skeleton className="h-10 w-full max-w-sm" />
          </CardContent>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="shadow-sm">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
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
    <div>
      {/* Header with background */}
      <div className="bg-[hsl(215_45%_14%)] text-white pt-6 lg:pt-8 pb-16">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 space-y-4">
          {/* Meta Bar */}
          <div className="flex items-center gap-2 text-sm text-blue-200/70">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/20 text-primary-foreground text-xs font-medium">
              Lender Portal
            </span>
            <span className="text-blue-300/40">·</span>
            <span>Contacts</span>
            <span className="text-blue-300/40">·</span>
            <span>{format(new Date(), "EEEE, MMMM d, yyyy")}</span>
          </div>

          {/* Title Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="border-l-4 border-primary pl-4">
              <h1 className="text-4xl font-bold tracking-tight">Contacts</h1>
              <p className="text-blue-200/70">Manage your borrowers</p>
            </div>
            <Link to="/contacts/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" weight="bold" />
                Add Contact
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Content - overlaps header */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-8 pb-8 space-y-6 relative">
        {/* Search */}
        <Card className="shadow-lg">
          <CardContent className="p-4">
            <div className="relative max-w-sm">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Contacts Grid */}
        {filteredContacts.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredContacts.map((contact) => (
              <Link key={contact.id} to="/contacts/$contactId" params={{ contactId: contact.id }}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full shadow-sm">
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
          <Card className="shadow-sm">
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
    </div>
  )
}
