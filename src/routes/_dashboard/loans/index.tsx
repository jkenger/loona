import { createFileRoute, Link } from "@tanstack/react-router"
import { getLoans } from "@/server/loans"
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
} from "@phosphor-icons/react"
import { useState, useMemo } from "react"
import { format } from "date-fns"

export const Route = createFileRoute("/_dashboard/loans/")({
  loader: async ({ context }) => {
    const { session } = context as { session: { user: { role: string | null } } }
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      return { loans: [], unauthorized: true }
    }
    const loans = await getLoans()
    return { loans, unauthorized: false }
  },
  pendingComponent: LoansPageSkeleton,
  component: LoansPage,
})

function LoansPageSkeleton() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="bg-[hsl(215_45%_14%)] text-white pt-6 lg:pt-8 pb-16">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 space-y-4">
          <Skeleton className="h-5 w-64 bg-white/10" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="border-l-4 border-primary pl-4 space-y-2">
              <Skeleton className="h-10 w-32 bg-white/10" />
              <Skeleton className="h-4 w-48 bg-white/10" />
            </div>
            <Skeleton className="h-10 w-28 bg-white/10" />
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-8 pb-8 space-y-6 relative">
        <Card className="shadow-lg">
          <CardContent className="p-4 space-y-4">
            <Skeleton className="h-10 w-full max-w-sm" />
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-8 w-20" />
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

type StatusFilter = "all" | "active" | "pending_disbursement" | "completed" | "defaulted" | "pending_approval" | "rejected"

function LoansPage() {
  const { loans, unauthorized } = Route.useLoaderData()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  if (unauthorized) {
    return (
      <AccessDenied
        message="Only lenders can access the loans page."
        homeLink="/agent"
        homeLinkLabel="Go to Agent Portal"
      />
    )
  }

  // Filter and sort loans
  const filteredLoans = useMemo(() => {
    let result = loans

    // Search filter
    if (search) {
      result = result.filter((loan) =>
        loan.contactName.toLowerCase().includes(search.toLowerCase())
      )
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((loan) => loan.status === statusFilter)
    }

    // Sort by attention needed: overdue first, then by progress (least progress first)
    result = [...result].sort((a, b) => {
      // Defaulted loans first
      if (a.status === "defaulted" && b.status !== "defaulted") return -1
      if (b.status === "defaulted" && a.status !== "defaulted") return 1

      // Then active loans with less progress
      if (a.status === "active" && b.status === "active") {
        const progressA = parseFloat(a.amountPaid) / parseFloat(a.totalToRepay)
        const progressB = parseFloat(b.amountPaid) / parseFloat(b.totalToRepay)
        return progressA - progressB // Less progress = needs more attention
      }

      // Active before pending/completed
      if (a.status === "active" && b.status !== "active") return -1
      if (b.status === "active" && a.status !== "active") return 1

      // Pending before completed
      if (a.status === "pending_disbursement" && b.status === "completed") return -1
      if (b.status === "pending_disbursement" && a.status === "completed") return 1

      return 0
    })

    return result
  }, [loans, search, statusFilter])

  // Pagination
  const totalPages = Math.ceil(filteredLoans.length / PAGE_SIZE)
  const paginatedLoans = filteredLoans.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Reset page when filters change
  const handleFilterChange = (filter: StatusFilter) => {
    setStatusFilter(filter)
    setPage(1)
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  // Count by status
  const statusCounts = useMemo(() => ({
    all: loans.length,
    active: loans.filter((l) => l.status === "active").length,
    pending_disbursement: loans.filter((l) => l.status === "pending_disbursement").length,
    completed: loans.filter((l) => l.status === "completed").length,
    defaulted: loans.filter((l) => l.status === "defaulted").length,
    pending_approval: loans.filter((l) => l.status === "pending_approval").length,
    rejected: loans.filter((l) => l.status === "rejected").length,
  }), [loans])

  const statusColors: Record<string, string> = {
    pending_disbursement: "outline",
    active: "secondary",
    completed: "default",
    defaulted: "destructive",
    pending_approval: "outline",
    rejected: "outline",
  }

  const statusLabels: Record<string, string> = {
    all: "All",
    active: "Active",
    pending_disbursement: "Pending",
    completed: "Completed",
    defaulted: "Defaulted",
    pending_approval: "Needs Approval",
    rejected: "Rejected",
  }

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
            <span>Loans</span>
            <span className="text-blue-300/40">·</span>
            <span>{format(new Date(), "EEEE, MMMM d, yyyy")}</span>
          </div>

          {/* Title Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="border-l-4 border-primary pl-4">
              <h1 className="text-4xl font-bold tracking-tight">Loans</h1>
              <p className="text-blue-200/70">Manage your lending portfolio</p>
            </div>
            <Link to="/loans/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" weight="bold" />
                New Loan
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Content - overlaps header */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-8 pb-8 space-y-6 relative">
        {/* Filters Card */}
        <Card className="shadow-lg">
          <CardContent className="p-4 space-y-4">
            {/* Search */}
            <div className="relative max-w-sm">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by borrower..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status Filters */}
            <div className="flex items-center gap-1 flex-wrap">
              <Funnel className="h-4 w-4 text-muted-foreground mr-1" />
              {/* Show pending_approval first if there are any */}
              {statusCounts.pending_approval > 0 && (
                <Button
                  variant={statusFilter === "pending_approval" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => handleFilterChange("pending_approval")}
                  className="text-xs h-8 gap-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700"
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
                  <span className="text-muted-foreground">({statusCounts[status]})</span>
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
            </div>
          </CardContent>
        </Card>

        {/* Results summary */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            {filteredLoans.length} loan{filteredLoans.length !== 1 ? "s" : ""}
            {statusFilter !== "all" && ` · ${statusLabels[statusFilter]}`}
            {search && ` · "${search}"`}
          </p>
          {filteredLoans.length > PAGE_SIZE && (
            <p>Page {page} of {totalPages}</p>
          )}
        </div>

        {/* Loans List */}
        {paginatedLoans.length > 0 ? (
          <>
            <div className="space-y-4">
              {paginatedLoans.map((loan) => {
                const progress = parseFloat(loan.amountPaid) / parseFloat(loan.totalToRepay) * 100
                const isDefaulted = loan.status === "defaulted"
                const isActive = loan.status === "active"
                const isPending = loan.status === "pending_disbursement"
                const isPendingApproval = loan.status === "pending_approval"
                const isRejected = loan.status === "rejected"

                return (
                  <Link key={loan.id} to="/loans/$loanId" params={{ loanId: loan.id }} className="block">
                    <Card className={`hover:border-primary/50 transition-colors cursor-pointer shadow-sm ${
                      isDefaulted ? "border-destructive/50" :
                      isPendingApproval ? "border-amber-300 bg-amber-50/50" :
                      isRejected ? "border-gray-300 opacity-60" :
                      ""
                    }`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                              isDefaulted ? "bg-destructive/10" :
                              isPendingApproval ? "bg-amber-100" :
                              isRejected ? "bg-gray-100" :
                              isPending ? "bg-muted" :
                              "bg-primary/10"
                            }`}>
                              {isDefaulted ? (
                                <Warning className="h-5 w-5 text-destructive" weight="bold" />
                              ) : isPendingApproval ? (
                                <Clock className="h-5 w-5 text-amber-600" weight="bold" />
                              ) : isRejected ? (
                                <Warning className="h-5 w-5 text-gray-400" />
                              ) : isPending ? (
                                <Clock className="h-5 w-5 text-muted-foreground" />
                              ) : progress >= 100 ? (
                                <CheckCircle className="h-5 w-5 text-primary" weight="bold" />
                              ) : (
                                <CurrencyCircleDollar className="h-5 w-5 text-primary" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`font-semibold truncate ${isRejected ? "line-through text-gray-500" : ""}`}>{loan.contactName}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatCurrency(loan.principal)} · {loan.interestRate}% · {loan.termMonths}mo
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right hidden sm:block">
                              <p className="font-semibold">
                                {formatCurrency(loan.remainingBalance)}
                              </p>
                              <p className="text-xs text-muted-foreground">remaining</p>
                            </div>
                            <Badge
                              variant={statusColors[loan.status] as any}
                              className={
                                isPendingApproval ? "bg-amber-100 text-amber-700 border-amber-300" :
                                isRejected ? "bg-gray-100 text-gray-500" :
                                ""
                              }
                            >
                              {loan.status.replace("_", " ")}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
                          </div>
                        </div>

                        {/* Progress bar - only for active loans */}
                        {isActive && (
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>
                                {formatCurrency(loan.amountPaid)} paid
                              </span>
                              <span>{Math.round(progress)}%</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${Math.min(100, progress)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Pending approval notice */}
                        {isPendingApproval && (
                          <div className="mt-3 pt-3 border-t flex items-center gap-2 text-amber-700 text-sm">
                            <Clock className="h-4 w-4" />
                            <span>Submitted by agent - awaiting your approval</span>
                          </div>
                        )}

                        {/* Mobile: show remaining balance */}
                        {!isPendingApproval && (
                          <div className="sm:hidden mt-3 pt-3 border-t flex justify-between text-sm">
                            <span className="text-muted-foreground">Remaining</span>
                            <span className="font-semibold">{formatCurrency(loan.remainingBalance)}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredLoans.length)} of {filteredLoans.length}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <Card className="shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-8 md:py-12">
              <CurrencyCircleDollar className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-1">No loans found</h3>
              <p className="text-muted-foreground text-sm mb-4">
                {search || statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Get started by creating your first loan"}
              </p>
              {!search && statusFilter === "all" && (
                <Link to="/loans/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Loan
                  </Button>
                </Link>
              )}
              {(search || statusFilter !== "all") && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("")
                    setStatusFilter("all")
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
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
