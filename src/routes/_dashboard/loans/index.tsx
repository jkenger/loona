import { createFileRoute, Link } from "@tanstack/react-router"
import { getLoans } from "@/server/loans"
import { getContacts } from "@/server/contacts"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton"
import { AccessDenied } from "@/components/access-denied"
import { hasRole, ROLES } from "@/lib/constants/roles"
import {
  Plus,
  MagnifyingGlass,
  CurrencyCircleDollar,
  ArrowRight,
  Warning,
  Clock,
  CheckCircle,
  Funnel,
  ClipboardText,
  User,
  Phone,
  EnvelopeSimple,
  MapPin,
  Eye,
  EyeSlash,
} from "@phosphor-icons/react"
import { useState, useMemo } from "react"
import { Stagger, StaggerItem } from "@/components/ui/stagger"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_dashboard/loans/")({
  loader: async ({ context }) => {
    const { session } = context as { session: { user: { role: string | null } } }
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      return { loans: [], contacts: [], unauthorized: true }
    }
    const [loans, contacts] = await Promise.all([getLoans(), getContacts()])
    return { loans, contacts, unauthorized: false }
  },
  pendingComponent: LoansPageSkeleton,
  component: LoansPage,
})

function LoansPageSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-8 w-20" />)}
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  )
}

type StatusFilter = "all" | "active" | "pending_disbursement" | "completed" | "defaulted" | "pending_approval" | "rejected"

const statusLabels: Record<string, string> = {
  all: "All",
  active: "Active",
  pending_disbursement: "Pending",
  completed: "Completed",
  defaulted: "Defaulted",
  pending_approval: "Needs Approval",
  rejected: "Rejected",
}

const statusColors: Record<string, string> = {
  pending_disbursement: "bg-muted text-muted-foreground",
  active: "bg-primary/10 text-primary",
  completed: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  defaulted: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  pending_approval: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  rejected: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
}

function LoansPage() {
  const { loans, contacts, unauthorized } = Route.useLoaderData()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [showNoLoans, setShowNoLoans] = useState(false)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  if (unauthorized) {
    return <AccessDenied message="Only lenders can access the loans page." homeLink="/agent" homeLinkLabel="Go to Agent Portal" />
  }

  // Group loans by contact
  const borrowers = useMemo(() => {
    const contactMap = new Map<string, {
      id: string
      name: string
      phone: string | null
      email: string | null
      city: string | null
      activeLoans: number
      totalLoans: number
      loans: typeof loans
    }>()

    // Init from contacts
    for (const c of contacts) {
      contactMap.set(c.id, {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        city: c.city,
        activeLoans: c.activeLoans,
        totalLoans: c.totalLoans,
        loans: [],
      })
    }

    // Attach loans
    for (const loan of loans) {
      const entry = contactMap.get(loan.contactId)
      if (entry) {
        entry.loans.push(loan)
      }
    }

    return Array.from(contactMap.values())
  }, [loans, contacts])

  // Filter borrowers
  const filteredBorrowers = useMemo(() => {
    let result = borrowers

    // Search across name, phone, email
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((b) =>
        b.name.toLowerCase().includes(q) ||
        b.phone?.toLowerCase().includes(q) ||
        b.email?.toLowerCase().includes(q)
      )
    }

    // Status filter — show borrower if any loan matches
    if (statusFilter !== "all") {
      result = result.filter((b) => b.loans.some((l) => l.status === statusFilter))
    }

    // Hide contacts without loans unless toggled
    if (!showNoLoans && statusFilter === "all") {
      result = result.filter((b) => b.loans.length > 0)
    }

    // Sort: borrowers with defaulted loans first, then by most recent loan
    result = [...result].sort((a, b) => {
      const aHasDefaulted = a.loans.some((l) => l.status === "defaulted")
      const bHasDefaulted = b.loans.some((l) => l.status === "defaulted")
      if (aHasDefaulted && !bHasDefaulted) return -1
      if (bHasDefaulted && !aHasDefaulted) return 1

      const aHasActive = a.loans.some((l) => l.status === "active")
      const bHasActive = b.loans.some((l) => l.status === "active")
      if (aHasActive && !bHasActive) return -1
      if (bHasActive && !aHasActive) return 1

      // Contacts without loans go last
      if (a.loans.length === 0 && b.loans.length > 0) return 1
      if (b.loans.length === 0 && a.loans.length > 0) return -1

      return 0
    })

    return result
  }, [borrowers, search, statusFilter, showNoLoans])

  // Pagination
  const totalPages = Math.ceil(filteredBorrowers.length / PAGE_SIZE)
  const paginatedBorrowers = filteredBorrowers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleFilterChange = (filter: StatusFilter) => { setStatusFilter(filter); setPage(1) }
  const handleSearchChange = (value: string) => { setSearch(value); setPage(1) }

  // Status counts (loan-level)
  const statusCounts = useMemo(() => ({
    all: borrowers.filter((b) => b.loans.length > 0).length,
    active: loans.filter((l) => l.status === "active").length,
    pending_disbursement: loans.filter((l) => l.status === "pending_disbursement").length,
    completed: loans.filter((l) => l.status === "completed").length,
    defaulted: loans.filter((l) => l.status === "defaulted").length,
    pending_approval: loans.filter((l) => l.status === "pending_approval").length,
    rejected: loans.filter((l) => l.status === "rejected").length,
  }), [loans, borrowers])

  const contactsWithNoLoans = contacts.filter((c) => c.totalLoans === 0).length

  return (
    <Stagger className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Page Header */}
      <StaggerItem>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Loans</h1>
            <p className="text-muted-foreground">Borrowers & lending portfolio</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/loans/applications">
              <Button variant="outline" className="gap-2">
                <ClipboardText className="h-4 w-4" weight="bold" />
                <span className="hidden sm:inline">Applications</span>
              </Button>
            </Link>
            <Link to="/loans/new-wizard">
              <Button className="gap-2">
                <Plus className="h-4 w-4" weight="bold" />
                New Loan
              </Button>
            </Link>
          </div>
        </div>
      </StaggerItem>

      {/* Search & Filters */}
      <StaggerItem>
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or email..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            <Funnel className="h-4 w-4 text-muted-foreground mr-1" />
            {statusCounts.pending_approval > 0 && (
              <Button
                variant={statusFilter === "pending_approval" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handleFilterChange("pending_approval")}
                className="text-xs h-8 gap-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-950/60"
              >
                {statusLabels.pending_approval}
                <span className="bg-amber-500 text-white rounded-full px-1.5 text-[10px] font-bold">{statusCounts.pending_approval}</span>
              </Button>
            )}
            {(["all", "active", "pending_disbursement", "completed", "defaulted"] as StatusFilter[]).map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handleFilterChange(status)}
                className="text-xs h-8 gap-1.5"
              >
                {statusLabels[status]}
                <span className="text-muted-foreground">({status === "all" ? statusCounts.all : statusCounts[status]})</span>
              </Button>
            ))}
            {statusCounts.rejected > 0 && (
              <Button
                variant={statusFilter === "rejected" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handleFilterChange("rejected")}
                className="text-xs h-8 gap-1.5 text-muted-foreground"
              >
                {statusLabels.rejected}
                <span className="text-muted-foreground">({statusCounts.rejected})</span>
              </Button>
            )}

            {/* Show contacts without loans toggle */}
            {contactsWithNoLoans > 0 && statusFilter === "all" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowNoLoans(!showNoLoans); setPage(1) }}
                className="text-xs h-8 gap-1.5 ml-auto text-muted-foreground"
              >
                {showNoLoans ? <EyeSlash className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {contactsWithNoLoans} without loans
              </Button>
            )}
          </div>
        </div>
      </StaggerItem>

      {/* Results summary */}
      <StaggerItem>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            {filteredBorrowers.length} borrower{filteredBorrowers.length !== 1 ? "s" : ""}
            {statusFilter !== "all" && ` · ${statusLabels[statusFilter]}`}
            {search && ` · "${search}"`}
          </p>
          {filteredBorrowers.length > PAGE_SIZE && (
            <p>Page {page} of {totalPages}</p>
          )}
        </div>
      </StaggerItem>

      {/* Borrower Cards */}
      <StaggerItem>
        {paginatedBorrowers.length > 0 ? (
          <>
            <div className="space-y-4">
              {paginatedBorrowers.map((borrower) => {
                // Sort loans within card: defaulted first, then active by least progress, then rest
                const sortedLoans = [...borrower.loans].sort((a, b) => {
                  if (a.status === "defaulted" && b.status !== "defaulted") return -1
                  if (b.status === "defaulted" && a.status !== "defaulted") return 1
                  if (a.status === "active" && b.status === "active") {
                    return (parseFloat(a.amountPaid) / parseFloat(a.totalToRepay)) - (parseFloat(b.amountPaid) / parseFloat(b.totalToRepay))
                  }
                  if (a.status === "active" && b.status !== "active") return -1
                  if (b.status === "active" && a.status !== "active") return 1
                  return 0
                })

                // Filter loans if status filter active
                const visibleLoans = statusFilter !== "all"
                  ? sortedLoans.filter((l) => l.status === statusFilter)
                  : sortedLoans

                return (
                  <Card key={borrower.id} className="rounded-xl shadow-sm">
                    <CardContent className="p-0">
                      {/* Borrower header */}
                      <Link
                        to="/contacts/$contactId"
                        params={{ contactId: borrower.id }}
                        className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors rounded-t-xl"
                      >
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm">
                          {borrower.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold truncate">{borrower.name}</p>
                            {borrower.activeLoans > 0 && (
                              <Badge variant="secondary" className="text-[10px] shrink-0">
                                {borrower.activeLoans} active
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            {borrower.phone && (
                              <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{borrower.phone}</span>
                            )}
                            {borrower.email && (
                              <span className="flex items-center gap-1 hidden sm:flex"><EnvelopeSimple className="h-3 w-3" />{borrower.email}</span>
                            )}
                            {borrower.city && (
                              <span className="flex items-center gap-1 hidden md:flex"><MapPin className="h-3 w-3" />{borrower.city}</span>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </Link>

                      {/* Loan sub-rows */}
                      {visibleLoans.length > 0 ? (
                        <div className="border-t">
                          {visibleLoans.map((loan) => {
                            const progress = parseFloat(loan.totalToRepay) > 0
                              ? (parseFloat(loan.amountPaid) / parseFloat(loan.totalToRepay)) * 100
                              : 0
                            const isActive = loan.status === "active"
                            const isDefaulted = loan.status === "defaulted"
                            const isPendingApproval = loan.status === "pending_approval"

                            return (
                              <Link
                                key={loan.id}
                                to="/loans/$loanId"
                                params={{ loanId: loan.id }}
                                className="flex items-center gap-3 px-4 py-3 border-b last:border-0 hover:bg-muted/30 transition-colors"
                              >
                                <Badge className={cn("text-[10px] shrink-0 font-medium", statusColors[loan.status] || "")}>
                                  {loan.status === "pending_disbursement" ? "Pending" : loan.status === "pending_approval" ? "Review" : loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
                                </Badge>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm">
                                    <span className="font-semibold">{formatCurrency(loan.principal)}</span>
                                    <span className="text-muted-foreground"> · {loan.interestRate}% · {loan.termMonths}mo</span>
                                  </p>
                                  {isActive && (
                                    <div className="flex items-center gap-2 mt-1">
                                      <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden max-w-[200px]">
                                        <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, progress)}%` }} />
                                      </div>
                                      <span className="text-[10px] text-muted-foreground">{Math.round(progress)}%</span>
                                    </div>
                                  )}
                                  {isPendingApproval && (
                                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                                      <Clock className="h-3 w-3" /> Awaiting approval
                                    </p>
                                  )}
                                </div>
                                <div className="text-right shrink-0 hidden sm:block">
                                  {isActive || isDefaulted ? (
                                    <p className="text-sm font-semibold">{formatCurrency(loan.remainingBalance)}</p>
                                  ) : loan.status === "completed" ? (
                                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">Fully Paid</p>
                                  ) : null}
                                </div>
                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 hidden sm:block" />
                              </Link>
                            )
                          })}
                        </div>
                      ) : borrower.loans.length === 0 ? (
                        <div className="border-t px-4 py-3 text-center">
                          <p className="text-xs text-muted-foreground">No loans yet</p>
                          <Link to="/loans/new-wizard" search={{ contactId: borrower.id }}>
                            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 mt-1">
                              <Plus className="h-3 w-3" /> Create Loan
                            </Button>
                          </Link>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredBorrowers.length)} of {filteredBorrowers.length}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <Card className="shadow-sm rounded-xl">
            <CardContent className="flex flex-col items-center justify-center py-8 md:py-12">
              <CurrencyCircleDollar className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-1">No borrowers found</h3>
              <p className="text-muted-foreground text-sm mb-4">
                {search || statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Get started by creating your first loan"}
              </p>
              {!search && statusFilter === "all" ? (
                <Link to="/loans/new-wizard">
                  <Button><Plus className="h-4 w-4 mr-2" />Create Loan</Button>
                </Link>
              ) : (
                <Button variant="outline" onClick={() => { setSearch(""); setStatusFilter("all") }}>Clear Filters</Button>
              )}
            </CardContent>
          </Card>
        )}
      </StaggerItem>

    </Stagger>
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
