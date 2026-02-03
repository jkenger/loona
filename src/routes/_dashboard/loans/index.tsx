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
} from "@phosphor-icons/react"
import { useState } from "react"

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <Skeleton className="h-10 w-full max-w-sm" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}

function LoansPage() {
  const { loans, unauthorized } = Route.useLoaderData()
  const [search, setSearch] = useState("")

  if (unauthorized) {
    return (
      <AccessDenied
        message="Only lenders can access the loans page."
        homeLink="/agent"
        homeLinkLabel="Go to Agent Portal"
      />
    )
  }

  const filteredLoans = loans.filter((loan) =>
    loan.contactName.toLowerCase().includes(search.toLowerCase())
  )

  const statusColors: Record<string, string> = {
    pending_disbursement: "outline",
    active: "secondary",
    completed: "default",
    defaulted: "destructive",
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Loans</h1>
          <p className="text-muted-foreground">Manage your lending portfolio</p>
        </div>
        <Link to="/loans/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" weight="bold" />
            New Loan
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by borrower..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Loans List */}
      {filteredLoans.length > 0 ? (
        <div className="space-y-3">
          {filteredLoans.map((loan) => (
            <Link key={loan.id} to="/loans/$loanId" params={{ loanId: loan.id }}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <CurrencyCircleDollar className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{loan.contactName}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(loan.principal)} at {loan.interestRate}% for{" "}
                          {loan.termMonths} months
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="font-semibold">
                          {formatCurrency(loan.remainingBalance)}
                        </p>
                        <p className="text-xs text-muted-foreground">remaining</p>
                      </div>
                      <Badge variant={statusColors[loan.status] as any}>
                        {loan.status.replace("_", " ")}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>

                  {/* Mobile: show remaining balance */}
                  <div className="sm:hidden mt-3 pt-3 border-t flex justify-between text-sm">
                    <span className="text-muted-foreground">Remaining</span>
                    <span className="font-semibold">
                      {formatCurrency(loan.remainingBalance)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span>
                        {Math.round(
                          (parseFloat(loan.amountPaid) /
                            parseFloat(loan.totalToRepay)) *
                            100
                        )}
                        %
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            (parseFloat(loan.amountPaid) /
                              parseFloat(loan.totalToRepay)) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 md:py-12">
            <CurrencyCircleDollar className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No loans found</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {search
                ? "Try a different search term"
                : "Get started by creating your first loan"}
            </p>
            {!search && (
              <Link to="/loans/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Loan
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
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
