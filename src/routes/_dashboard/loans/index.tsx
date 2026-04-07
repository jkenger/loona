import { createFileRoute, Link } from "@tanstack/react-router"
import { getLoans } from "@/server/loans"
import { getContacts } from "@/server/contacts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { AccessDenied } from "@/components/access-denied"
import { hasRole, ROLES } from "@/lib/constants/roles"
import {
  Plus,
  MagnifyingGlass,
  CurrencyCircleDollar,
  CaretRight,
  Funnel,
  ClipboardText,
  Users,
  ChartLineUp,
  Wallet,
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
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <Skeleton className="h-10 w-full max-w-sm" />
      <div className="rounded-xl border overflow-hidden">
        {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-14 border-b last:border-0" />)}
      </div>
    </div>
  )
}

type StatusFilter = "all" | "active" | "pending_disbursement" | "completed" | "defaulted" | "pending_approval" | "rejected"

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  active: { label: "Active", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
  pending_disbursement: { label: "Pending", dot: "bg-blue-400", text: "text-blue-600 dark:text-blue-400" },
  completed: { label: "Completed", dot: "bg-gray-400 dark:bg-gray-500", text: "text-muted-foreground" },
  defaulted: { label: "Defaulted", dot: "bg-red-500", text: "text-red-700 dark:text-red-400" },
  pending_approval: { label: "Review", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  rejected: { label: "Rejected", dot: "bg-gray-300 dark:bg-gray-600", text: "text-muted-foreground" },
}

const FILTER_LABELS: Record<string, string> = {
  all: "All",
  active: "Active",
  pending_disbursement: "Pending",
  completed: "Completed",
  defaulted: "Defaulted",
  pending_approval: "Review",
  rejected: "Rejected",
}

function LoansPage() {
  const { loans, contacts, unauthorized } = Route.useLoaderData()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  if (unauthorized) {
    return <AccessDenied message="Only lenders can access the loans page." homeLink="/agent" homeLinkLabel="Go to Agent Portal" />
  }

  // Build contact lookup for search by phone/email
  const contactLookup = useMemo(() => {
    const map = new Map<string, { phone: string | null; email: string | null }>()
    for (const c of contacts) {
      map.set(c.id, { phone: c.phone, email: c.email })
    }
    return map
  }, [contacts])

  // Portfolio stats
  const stats = useMemo(() => {
    const activeLoans = loans.filter((l) => l.status === "active")
    const totalOutstanding = activeLoans.reduce((sum, l) => sum + parseFloat(l.remainingBalance), 0)
    const totalPaid = loans.reduce((sum, l) => sum + parseFloat(l.amountPaid), 0)
    const totalToRepay = loans.reduce((sum, l) => sum + parseFloat(l.totalToRepay), 0)
    const collectionRate = totalToRepay > 0 ? Math.round((totalPaid / totalToRepay) * 100) : 0
    const uniqueBorrowers = new Set(loans.map((l) => l.contactId)).size
    return { totalOutstanding, activeCount: activeLoans.length, borrowers: uniqueBorrowers, collectionRate }
  }, [loans])

  // Filter and sort
  const filteredLoans = useMemo(() => {
    let result = loans

    if (search) {
      const q = search.toLowerCase()
      result = result.filter((loan) => {
        if (loan.contactName.toLowerCase().includes(q)) return true
        const c = contactLookup.get(loan.contactId)
        if (c?.phone?.toLowerCase().includes(q)) return true
        if (c?.email?.toLowerCase().includes(q)) return true
        return false
      })
    }

    if (statusFilter !== "all") {
      result = result.filter((l) => l.status === statusFilter)
    }

    // Sort by urgency
    result = [...result].sort((a, b) => {
      const priority = (s: string) => {
        if (s === "defaulted") return 0
        if (s === "active") return 1
        if (s === "pending_approval") return 2
        if (s === "pending_disbursement") return 3
        if (s === "completed") return 4
        if (s === "rejected") return 5
        return 6
      }
      const pa = priority(a.status)
      const pb = priority(b.status)
      if (pa !== pb) return pa - pb

      // Within active: least progress first
      if (a.status === "active" && b.status === "active") {
        const progA = parseFloat(a.totalToRepay) > 0 ? parseFloat(a.amountPaid) / parseFloat(a.totalToRepay) : 0
        const progB = parseFloat(b.totalToRepay) > 0 ? parseFloat(b.amountPaid) / parseFloat(b.totalToRepay) : 0
        return progA - progB
      }

      return 0
    })

    return result
  }, [loans, search, statusFilter, contactLookup])

  // Status counts
  const statusCounts = useMemo(() => ({
    all: loans.length,
    active: loans.filter((l) => l.status === "active").length,
    pending_disbursement: loans.filter((l) => l.status === "pending_disbursement").length,
    completed: loans.filter((l) => l.status === "completed").length,
    defaulted: loans.filter((l) => l.status === "defaulted").length,
    pending_approval: loans.filter((l) => l.status === "pending_approval").length,
    rejected: loans.filter((l) => l.status === "rejected").length,
  }), [loans])

  // Pagination
  const totalPages = Math.ceil(filteredLoans.length / PAGE_SIZE)
  const paginatedLoans = filteredLoans.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const handleFilterChange = (f: StatusFilter) => { setStatusFilter(f); setPage(1) }

  return (
    <Stagger className="px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Header */}
      <StaggerItem>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Loans</h1>
          <div className="flex items-center gap-2">
            <Link to="/loans/applications">
              <Button variant="outline" size="sm" className="gap-1.5 h-9">
                <ClipboardText className="h-4 w-4" />
                <span className="hidden sm:inline">Applications</span>
              </Button>
            </Link>
            <Link to="/loans/new-wizard">
              <Button size="sm" className="gap-1.5 h-9">
                <Plus className="h-4 w-4" weight="bold" />
                New Loan
              </Button>
            </Link>
          </div>
        </div>
      </StaggerItem>

      {/* Portfolio Summary */}
      {loans.length > 0 && (
        <StaggerItem>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-card px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Wallet className="h-3.5 w-3.5" />
                Outstanding
              </div>
              <p className="text-lg font-bold tracking-tight">{formatCurrency(stats.totalOutstanding)}</p>
            </div>
            <div className="rounded-xl border bg-card px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <CurrencyCircleDollar className="h-3.5 w-3.5" />
                Active
              </div>
              <p className="text-lg font-bold tracking-tight">{stats.activeCount}</p>
            </div>
            <div className="rounded-xl border bg-card px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Users className="h-3.5 w-3.5" />
                Borrowers
              </div>
              <p className="text-lg font-bold tracking-tight">{stats.borrowers}</p>
            </div>
            <div className="rounded-xl border bg-card px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <ChartLineUp className="h-3.5 w-3.5" />
                Collected
              </div>
              <p className="text-lg font-bold tracking-tight">{stats.collectionRate}%</p>
            </div>
          </div>
        </StaggerItem>
      )}

      {/* Search + Filters */}
      <StaggerItem>
        <div className="space-y-3">
          <div className="relative max-w-sm">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9 h-9"
            />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <Funnel className="h-3.5 w-3.5 text-muted-foreground mr-0.5" />
            {statusCounts.pending_approval > 0 && (
              <button
                onClick={() => handleFilterChange("pending_approval")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  statusFilter === "pending_approval"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400"
                    : "text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Review
                <span className="bg-amber-500 text-white rounded-full px-1.5 text-[10px] font-bold leading-tight">{statusCounts.pending_approval}</span>
              </button>
            )}
            {(["all", "active", "pending_disbursement", "completed", "defaulted"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => handleFilterChange(s)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  statusFilter === s
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {s !== "all" && <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_CONFIG[s]?.dot)} />}
                {FILTER_LABELS[s]}
                <span className="text-muted-foreground/70">({statusCounts[s]})</span>
              </button>
            ))}
            {statusCounts.rejected > 0 && (
              <button
                onClick={() => handleFilterChange("rejected")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  statusFilter === "rejected"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                Rejected
                <span className="text-muted-foreground/70">({statusCounts.rejected})</span>
              </button>
            )}
          </div>
        </div>
      </StaggerItem>

      {/* Loan List */}
      <StaggerItem>
        {paginatedLoans.length > 0 ? (
          <div className="rounded-xl border bg-card overflow-hidden">
            {/* Desktop header */}
            <div className="hidden sm:grid sm:grid-cols-[1fr_100px_100px_100px_90px_28px] gap-3 px-4 py-2.5 border-b bg-muted/30 text-xs font-medium text-muted-foreground">
              <span>Borrower</span>
              <span className="text-right">Principal</span>
              <span className="text-center">Status</span>
              <span className="text-right">Balance</span>
              <span className="text-right">Progress</span>
              <span />
            </div>

            {/* Rows */}
            {paginatedLoans.map((loan) => {
              const config = STATUS_CONFIG[loan.status] || STATUS_CONFIG.active
              const progress = parseFloat(loan.totalToRepay) > 0
                ? (parseFloat(loan.amountPaid) / parseFloat(loan.totalToRepay)) * 100
                : 0
              const isActive = loan.status === "active"
              const isCompleted = loan.status === "completed"

              return (
                <Link
                  key={loan.id}
                  to="/loans/$loanId"
                  params={{ loanId: loan.id }}
                  className="block border-b last:border-0 hover:bg-muted/40 transition-colors"
                >
                  {/* Desktop row */}
                  <div className="hidden sm:grid sm:grid-cols-[1fr_100px_100px_100px_90px_28px] gap-3 px-4 py-3 items-center">
                    {/* Borrower */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                        {loan.contactName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{loan.contactName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {loan.interestRate}% · {loan.termMonths}mo
                        </p>
                      </div>
                    </div>

                    {/* Principal */}
                    <p className="text-sm font-semibold text-right tabular-nums">
                      {formatCurrency(loan.principal)}
                    </p>

                    {/* Status */}
                    <div className="flex items-center justify-center gap-1.5">
                      <span className={cn("h-2 w-2 rounded-full shrink-0", config.dot)} />
                      <span className={cn("text-xs font-medium", config.text)}>{config.label}</span>
                    </div>

                    {/* Balance */}
                    <p className={cn("text-sm text-right tabular-nums", isCompleted ? "text-muted-foreground" : "font-medium")}>
                      {isCompleted ? "—" : formatCurrency(loan.remainingBalance)}
                    </p>

                    {/* Progress */}
                    <div className="flex items-center justify-end gap-2">
                      {isActive ? (
                        <>
                          <div className="h-1.5 w-12 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, progress)}%` }} />
                          </div>
                          <span className="text-[11px] text-muted-foreground tabular-nums w-7 text-right">{Math.round(progress)}%</span>
                        </>
                      ) : isCompleted ? (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">100%</span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </div>

                    {/* Arrow */}
                    <CaretRight className="h-4 w-4 text-muted-foreground/50" />
                  </div>

                  {/* Mobile row */}
                  <div className="sm:hidden px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                          {loan.contactName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{loan.contactName}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
                            <span className={cn("text-[11px] font-medium", config.text)}>{config.label}</span>
                            <span className="text-[11px] text-muted-foreground">· {loan.interestRate}% · {loan.termMonths}mo</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold tabular-nums">{formatCurrency(loan.principal)}</p>
                        {isActive && (
                          <p className="text-[11px] text-muted-foreground tabular-nums">
                            {formatCurrency(loan.remainingBalance)} left
                          </p>
                        )}
                        {isCompleted && (
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Paid</p>
                        )}
                      </div>
                    </div>
                    {isActive && (
                      <div className="mt-2 ml-11">
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, progress)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl border bg-card">
            <div className="flex flex-col items-center justify-center py-12">
              <CurrencyCircleDollar className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium mb-1">
                {search || statusFilter !== "all" ? "No loans match your filters" : "No loans yet"}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                {search || statusFilter !== "all" ? "Try adjusting your search or filters" : "Create your first loan to get started"}
              </p>
              {!search && statusFilter === "all" ? (
                <Link to="/loans/new-wizard">
                  <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />New Loan</Button>
                </Link>
              ) : (
                <Button variant="outline" size="sm" onClick={() => { setSearch(""); setStatusFilter("all") }}>Clear filters</Button>
              )}
            </div>
          </div>
        )}
      </StaggerItem>

      {/* Pagination */}
      {totalPages > 1 && (
        <StaggerItem>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredLoans.length)} of {filteredLoans.length}
            </p>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="h-8" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
              <Button variant="outline" size="sm" className="h-8" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</Button>
            </div>
          </div>
        </StaggerItem>
      )}
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
