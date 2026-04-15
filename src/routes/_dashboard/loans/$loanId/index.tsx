import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { getLoan, deleteLoan, approveLoan, rejectLoan } from "@/server/loans"
import { restructureLoan } from "@/server/restructure"
import { getLoanSigningStatus } from "@/server/signatures"
import { getAgents, assignLoanToAgent } from "@/server/agents"
import { PenaltyItems } from "@/components/penalty-items"
import { calendarDaysOverdue } from "@/lib/constants/penalty-defaults"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { RecordPaymentDialog } from "@/components/record-payment-dialog"
import { ReversePaymentDialog } from "@/components/reverse-payment-dialog"
import { EditPaymentDateDialog } from "@/components/edit-payment-date-dialog"
import { RegenerateScheduleDialog } from "@/components/regenerate-schedule-dialog"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SkeletonDetailPage } from "@/components/ui/skeleton"
import { AccessDenied } from "@/components/access-denied"
import { Checkbox } from "@/components/ui/checkbox"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { useState } from "react"
import {
  ArrowLeft,
  User,
  CalendarCheck,
  Check,
  Clock,
  Warning,
  UsersThree,
  Spinner,
  Trash,
  ShieldCheck,
  Users,
  Tag,
  FileText,
  CheckCircle,
  X,
  Scroll,
  ArrowSquareOut,
  ArrowCounterClockwise,
  ArrowClockwise,
  ChartLineUp,
  PencilSimple,
  LinkSimple,
  ArrowsClockwise,
  DotsThreeVertical,
} from "@phosphor-icons/react"
import { Textarea } from "@/components/ui/textarea"
import { format } from "date-fns"
import { calculateEIR, formatEIR } from "@/lib/utils/eir"
import { Input } from "@/components/ui/input"

export const Route = createFileRoute("/_dashboard/loans/$loanId/")({
  loader: async ({ params, context }) => {
    const { session } = context as { session: { user: { role: string | null } } }
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      return { loan: null, agents: [], unauthorized: true, signingStatus: null }
    }

    try {
      const loan = await getLoan({ data: params.loanId })
      // Only allow if user is the lender
      if (!loan.isLender) {
        return { loan: null, agents: [], unauthorized: true, signingStatus: null }
      }

      let agents: Awaited<ReturnType<typeof getAgents>> = []
      try {
        agents = await getAgents()
      } catch {
        // Agents list not available
      }

      let signingStatus: Awaited<ReturnType<typeof getLoanSigningStatus>> | null = null
      try {
        signingStatus = await getLoanSigningStatus({ data: params.loanId })
      } catch {
        // Signing status not available
      }

      return { loan, agents, unauthorized: false, signingStatus }
    } catch {
      return { loan: null, agents: [], unauthorized: false, signingStatus: null }
    }
  },
  pendingComponent: SkeletonDetailPage,
  component: LoanDetailPage,
})

type ScheduleItem = NonNullable<Awaited<ReturnType<typeof getLoan>>>["schedule"][0]

function LoanDetailPage() {
  const { loan, agents, unauthorized, signingStatus } = Route.useLoaderData()
  const penaltyData = loan?.penaltyData ?? null
  const router = useRouter()
  const [assigning, setAssigning] = useState(false)
  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [notifyAgent, setNotifyAgent] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Approval state
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [updateStartDate, setUpdateStartDate] = useState(true)
  const [rejectionReason, setRejectionReason] = useState("")

  // Payment dialog state
  const [selectedScheduleItem, setSelectedScheduleItem] = useState<ScheduleItem | null>(null)

  // Reverse payment dialog state
  const [selectedPaymentForReversal, setSelectedPaymentForReversal] = useState<{
    id: string; amount: string; method: string; paidAt: string; scheduleItemId: string | null
  } | null>(null)

  // Regenerate schedule dialog state
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false)

  // Restructure dialog state
  const [showRestructureDialog, setShowRestructureDialog] = useState(false)
  const [restructureAdditionalMonths, setRestructureAdditionalMonths] = useState("")
  const [restructureBalanceReduction, setRestructureBalanceReduction] = useState("")
  const [restructureReason, setRestructureReason] = useState("")
  const [isRestructuring, setIsRestructuring] = useState(false)

  // Edit payment date dialog state
  const [selectedPaymentForEdit, setSelectedPaymentForEdit] = useState<{
    id: string; amount: string; method: string; paidAt: string; scheduleItemId: string | null
  } | null>(null)

  if (unauthorized) {
    return (
      <AccessDenied
        message="Only lenders can access the loan details page."
        homeLink="/agent"
        homeLinkLabel="Go to Agent Portal"
      />
    )
  }

  if (!loan) {
    return (
      <AccessDenied
        title="Loan Not Found"
        message="This loan doesn't exist or you don't have access to it."
        homeLink="/loans"
        homeLinkLabel="Back to Loans"
      />
    )
  }

  const activeAgents = (agents || []).filter((a) => a.status === "active")
  const hasPayments = loan.payments.length > 0

  const handleAgentSelectChange = (value: string) => {
    setPendingAgentId(value)
    setNotifyAgent(false)
    setShowAssignDialog(true)
  }

  const handleConfirmAssign = async () => {
    if (pendingAgentId === undefined) return
    setAssigning(true)
    setShowAssignDialog(false)
    try {
      await assignLoanToAgent({
        data: {
          loanId: loan.id,
          agentId: pendingAgentId === "unassigned" ? null : pendingAgentId,
          notify: notifyAgent,
        },
      })
      toast.success(pendingAgentId === "unassigned" ? "Agent unassigned" : "Agent assigned successfully")
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign agent")
    } finally {
      setAssigning(false)
      setPendingAgentId(null)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteLoan({ data: loan.id })
      toast.success("Loan deleted")
      router.navigate({ to: "/loans" })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete loan")
      setIsDeleting(false)
    }
  }

  const handleApprove = async () => {
    setIsApproving(true)
    try {
      await approveLoan({ data: { loanId: loan.id, updateStartDate } })
      toast.success("Loan approved and activated")
      setShowApproveDialog(false)
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve loan")
    } finally {
      setIsApproving(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason")
      return
    }
    setIsRejecting(true)
    try {
      await rejectLoan({ data: { loanId: loan.id, reason: rejectionReason } })
      toast.success("Loan rejected")
      setShowRejectDialog(false)
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject loan")
    } finally {
      setIsRejecting(false)
    }
  }

  const getScheduleInfo = (scheduleItemId: string | null) => {
    if (!scheduleItemId) return null
    const idx = loan.schedule.findIndex((s) => s.id === scheduleItemId)
    if (idx === -1) return null
    const item = loan.schedule[idx]
    return { label: `Payment #${idx + 1}`, dueDate: item.dueDate, amount: item.amount }
  }

  const statusConfig: Record<string, { variant: any; label: string; className?: string }> = {
    pending_disbursement: { variant: "outline", label: "Pending Disbursement" },
    active: { variant: "secondary", label: "Active" },
    completed: { variant: "default", label: "Completed" },
    defaulted: { variant: "destructive", label: "Defaulted" },
    pending_approval: { variant: "outline", label: "Pending Approval", className: "bg-amber-100 text-amber-700 border-amber-300" },
    rejected: { variant: "outline", label: "Rejected", className: "bg-gray-100 text-gray-500 line-through" },
  }

  const scheduleStatusConfig: Record<string, { icon: typeof Check; className: string }> = {
    paid: { icon: Check, className: "text-primary bg-primary/10" },
    pending: { icon: Clock, className: "text-muted-foreground bg-muted" },
    partial: { icon: Clock, className: "text-primary bg-primary/10" },
    overdue: { icon: Warning, className: "text-destructive bg-destructive/10" },
  }

  const borrowerInitials = loan.contact.name
    .split(" ")
    .slice(0, 2)
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Back link */}
      <Link to="/loans" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Loans
      </Link>

      {/* Borrower Identity Hero + Loan Title Row */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Borrower strip */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b bg-muted/30">
          <Link
            to="/contacts/$contactId"
            params={{ contactId: loan.contact.id }}
            className="flex items-center gap-3 group"
          >
            <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm border border-primary/20">
              {borrowerInitials}
            </div>
            <div>
              <p className="font-semibold text-sm group-hover:text-primary transition-colors leading-tight">
                {loan.contact.name}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                {loan.contact.phone && <span>{loan.contact.phone}</span>}
                {loan.contact.phone && loan.contact.city && <span>·</span>}
                {loan.contact.city && <span>{loan.contact.city}</span>}
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground border rounded-full px-3 py-1 bg-background shrink-0">
            <User className="h-3 w-3" />
            Borrower
          </div>
        </div>

        {/* Loan title row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                {formatCurrency(loan.principal)}
              </h1>
              <Badge variant={statusConfig[loan.status].variant} className={statusConfig[loan.status].className || ""}>
                {statusConfig[loan.status].label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {loan.interestRate}% / mo · {loan.termMonths} months · {loan.paymentFrequency === "semimonthly" ? "Semi-monthly" : loan.paymentFrequency} payments
            </p>
          </div>
          {loan.isLender && (
            <div className="flex gap-2">
              {loan.borrowerToken && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    const url = `${window.location.origin}/share/loan/${loan.borrowerToken}`
                    navigator.clipboard.writeText(url)
                    toast.success("Borrower link copied!")
                  }}
                >
                  <LinkSimple className="h-4 w-4" weight="bold" />
                  Share
                </Button>
              )}
              {loan.status === "completed" && (
                <Link
                  to="/loans/new-wizard"
                  search={{ renewFromLoanId: loan.id }}
                >
                  <Button variant="outline" className="gap-2">
                    <ArrowClockwise className="h-4 w-4" weight="bold" />
                    Renew
                  </Button>
                </Link>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={(props) => (
                    <Button {...props} variant="ghost" size="icon">
                      <DotsThreeVertical className="h-5 w-5" weight="bold" />
                    </Button>
                  )}
                />
                <DropdownMenuContent align="end">
                  {loan.status === "active" && loan.schedule.some((s) => s.status !== "paid") && (
                    <DropdownMenuItem onClick={() => setShowRegenerateDialog(true)}>
                      <ArrowsClockwise className="h-4 w-4" />
                      Regenerate Schedule
                    </DropdownMenuItem>
                  )}
                  {import.meta.env.DEV && loan.status === "active" && loan.schedule.some((s) => s.status !== "paid") && (
                    <DropdownMenuItem onClick={() => {
                      setRestructureAdditionalMonths("")
                      setRestructureBalanceReduction("")
                      setRestructureReason("")
                      setShowRestructureDialog(true)
                    }}>
                      <ArrowCounterClockwise className="h-4 w-4" />
                      Restructure Loan
                    </DropdownMenuItem>
                  )}
                  {import.meta.env.DEV && loan.status === "active" && loan.schedule.some((s) => s.status !== "paid") && (
                    <DropdownMenuSeparator />
                  )}
                  <DropdownMenuItem variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                    <Trash className="h-4 w-4" />
                    Delete Loan
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>

      {/* Pending Approval Banner */}
      {loan.status === "pending_approval" && loan.isLender && (
        <Card className="border-amber-300 bg-amber-50 shadow-sm rounded-xl">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-amber-600" weight="bold" />
                </div>
                <div>
                  <p className="font-semibold text-amber-800">Awaiting Your Approval</p>
                  <p className="text-sm text-amber-700">
                    This loan was created by an agent and needs your approval to become active.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 sm:shrink-0">
                <Button
                  variant="outline"
                  onClick={() => setShowRejectDialog(true)}
                  className="gap-2 border-red-300 text-red-600 hover:bg-red-50"
                >
                  <X className="h-4 w-4" weight="bold" />
                  Reject
                </Button>
                <Button
                  onClick={() => setShowApproveDialog(true)}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4" weight="bold" />
                  Approve
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rejected Notice */}
      {loan.status === "rejected" && (
        <Card className="border-gray-300 bg-gray-50 shadow-sm rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <X className="h-5 w-5 text-gray-500" weight="bold" />
              </div>
              <div>
                <p className="font-semibold text-gray-700">Loan Rejected</p>
                {loan.rejectionReason && (
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium">Reason:</span> {loan.rejectionReason}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Renewal Chain */}
      {(loan.renewedFromLoan || loan.renewedToLoan) && (
        <div className="flex flex-wrap gap-3">
          {loan.renewedFromLoan && (
            <Link
              to="/loans/$loanId"
              params={{ loanId: loan.renewedFromLoan.id }}
              className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm hover:border-primary/40 transition-colors"
            >
              <ArrowCounterClockwise className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Renewed from</span>
              <span className="font-medium">{formatCurrency(loan.renewedFromLoan.principal)} loan</span>
            </Link>
          )}
          {loan.renewedToLoan && (
            <Link
              to="/loans/$loanId"
              params={{ loanId: loan.renewedToLoan.id }}
              className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm hover:border-primary/40 transition-colors"
            >
              <ArrowClockwise className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Renewed as</span>
              <span className="font-medium">{formatCurrency(loan.renewedToLoan.principal)} loan</span>
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Loan Summary */}
        <Card className="shadow-sm rounded-xl">
          <CardHeader className="p-4 pb-2">
            <CardTitle>Loan Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Principal</span>
              <span className="font-medium">{formatCurrency(loan.principal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total to Repay</span>
              <span className="font-medium">{formatCurrency(loan.totalToRepay)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Interest Rate</span>
              <span className="font-medium">{loan.interestRate}% / mo</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Effective Rate</span>
              <span className="font-medium text-primary">
                {formatEIR(
                  calculateEIR({
                    principal: parseFloat(loan.principal),
                    totalInterest:
                      parseFloat(loan.totalToRepay) - parseFloat(loan.principal),
                    termMonths: loan.termMonths,
                    paymentFrequency: loan.paymentFrequency as any,
                  })
                )}
              </span>
            </div>
            {loan.processingFeePercent && parseFloat(loan.processingFeePercent) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Processing Fee ({loan.processingFeePercent}%)</span>
                <span className="font-medium">{formatCurrency(parseFloat(loan.principal) * parseFloat(loan.processingFeePercent) / 100)}</span>
              </div>
            )}
            {loan.processingFeePercent && parseFloat(loan.processingFeePercent) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net Proceeds</span>
                <span className="font-medium">{formatCurrency(parseFloat(loan.principal) - parseFloat(loan.principal) * parseFloat(loan.processingFeePercent) / 100)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-4">
              <span className="text-muted-foreground">Amount Paid</span>
              <span className="font-medium text-primary">{formatCurrency(loan.amountPaid)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Remaining</span>
              <span className="font-bold">{formatCurrency(loan.remainingBalance)}</span>
            </div>

            {/* Progress */}
            <div className="pt-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Progress</span>
                <span>
                  {Math.round(
                    (parseFloat(loan.amountPaid) / parseFloat(loan.totalToRepay)) * 100
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
                      (parseFloat(loan.amountPaid) / parseFloat(loan.totalToRepay)) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Total Due Now — shown when overdue or penalties exist */}
            {loan.status === "active" && (() => {
              const overdueItems = loan.schedule.filter((s) => s.status === "overdue")
              const appliedPenalties = (penaltyData?.penalties ?? []).filter((p) => p.status === "applied")
              const overdueTotal = overdueItems.reduce((sum, s) => sum + parseFloat(s.amount) - parseFloat(s.paidAmount), 0)
              const penaltyTotal = appliedPenalties.reduce((sum, p) => sum + parseFloat(p.amount), 0)
              const grandTotal = overdueTotal + penaltyTotal
              if (grandTotal <= 0) return null
              return (
                <div className="rounded-lg bg-destructive/8 border border-destructive/20 p-3 space-y-1.5">
                  {overdueItems.map((s) => {
                    const idx = loan.schedule.findIndex((x) => x.id === s.id)
                    const due = parseFloat(s.amount) - parseFloat(s.paidAmount)
                    return (
                      <div key={s.id} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          Payment #{idx + 1} overdue
                          <span className="ml-1 opacity-60">({format(new Date(s.dueDate), "MMM d")})</span>
                        </span>
                        <span className="font-medium text-destructive">{formatCurrency(due)}</span>
                      </div>
                    )
                  })}
                  {penaltyTotal > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Penalties ({appliedPenalties.length})</span>
                      <span className="font-medium text-destructive">{formatCurrency(penaltyTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold border-t border-destructive/20 pt-1.5 mt-0.5">
                    <span className="flex items-center gap-1.5">
                      <Warning className="h-3.5 w-3.5 text-destructive" weight="bold" />
                      Total Due Now
                    </span>
                    <span className="text-destructive">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              )
            })()}
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card className="shadow-sm rounded-xl">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Start Date</span>
              <span className="font-medium">
                {loan.startDate
                  ? new Date(loan.startDate).toLocaleDateString()
                  : "Not started"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Maturity Date</span>
              <span className="font-medium">
                {loan.maturityDate
                  ? new Date(loan.maturityDate).toLocaleDateString()
                  : "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Frequency</span>
              <span className="font-medium capitalize">
                {loan.paymentFrequency === "semimonthly" ? "Semi-monthly" : loan.paymentFrequency}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Optional Details - Purpose, Collateral, Co-maker, Agent Assignment */}
      {(loan.purpose || loan.collateralDescription || loan.coMakerName || loan.isLender) && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Purpose */}
          {loan.purpose && (
            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Tag className="h-4 w-4 text-primary" />
                  Purpose
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-sm">{loan.purpose}</p>
              </CardContent>
            </Card>
          )}

          {/* Collateral */}
          {loan.collateralDescription && (
            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Collateral
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-sm">{loan.collateralDescription}</p>
              </CardContent>
            </Card>
          )}

          {/* Co-maker */}
          {loan.coMakerName && (
            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-primary" />
                  Co-maker / Guarantor
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                <p className="font-medium">{loan.coMakerName}</p>
                {loan.coMakerPhone && (
                  <p className="text-sm text-muted-foreground">{loan.coMakerPhone}</p>
                )}
                {loan.coMakerRelationship && (
                  <p className="text-sm text-muted-foreground">
                    Relationship: {loan.coMakerRelationship}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Agent Assignment */}
          {loan.isLender && (
            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <UsersThree className="h-4 w-4 text-primary" />
                  Agent Assignment
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {activeAgents.length > 0 ? (
                  <div className="space-y-2">
                    <Select
                      value={loan.assignedAgentId || "unassigned"}
                      onValueChange={handleAgentSelectChange}
                      disabled={assigning}
                    >
                      <SelectTrigger className="w-full">
                        {loan.assignedAgentId ? (
                          (() => {
                            const agent = activeAgents.find((a) => a.id === loan.assignedAgentId)
                            return agent ? `${agent.agentName} (${agent.commissionRate}%)` : "Select an agent"
                          })()
                        ) : (
                          <span className="text-muted-foreground">No agent assigned</span>
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">
                          <span className="text-muted-foreground">No agent assigned</span>
                        </SelectItem>
                        {activeAgents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.agentName} ({agent.commissionRate}%)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {assigning && <Spinner className="h-4 w-4 animate-spin" />}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No agents available.{" "}
                    <Link to="/agents" className="text-primary hover:underline">
                      Add agents
                    </Link>{" "}
                    to assign them to loans.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Payment Schedule */}
      <Card className="shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle>Payment Schedule</CardTitle>
          <CardDescription>
            {loan.schedule.filter((s) => s.status === "paid").length} of{" "}
            {loan.schedule.length} payments completed
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="space-y-2">
            {loan.schedule.map((item, index) => {
              const config = scheduleStatusConfig[item.status]
              const StatusIcon = config.icon
              const itemPenalties = penaltyData?.penalties.filter(
                (p) => p.scheduleItemId === item.id,
              ) ?? []
              // Determine if paid late — compare calendar dates, accounting for grace period
              const gracePeriodDays = loan.gracePeriodDays ?? 0
              const paidLate = item.paidAt && (() => {
                const paid = new Date(new Date(item.paidAt).toDateString()).getTime()
                const due = new Date(new Date(item.dueDate).toDateString()).getTime()
                const graceMs = gracePeriodDays * 24 * 60 * 60 * 1000
                return paid > due + graceMs
              })()
              const daysOverdue = calendarDaysOverdue(new Date(item.dueDate))

              return (
                <PenaltyItems
                  key={item.id}
                  penalties={itemPenalties}
                  daysOverdue={daysOverdue}
                  formatCurrency={formatCurrency}
                >
                  {({ toggleButton, detailPanel }) => (
                    <div className="space-y-1">
                      <div
                        className={`flex items-center justify-between p-3 rounded border ${
                          item.status === "overdue" ? "border-destructive/50" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${config.className}`}>
                            <StatusIcon className="h-4 w-4" weight="bold" />
                          </div>
                          <div>
                            <p className="font-medium">Payment #{index + 1}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>Due: {new Date(item.dueDate).toLocaleDateString()}</span>
                              {toggleButton}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-semibold">{formatCurrency(item.amount)}</p>
                            {item.status === "paid" && item.paidAt && (
                              <>
                                {parseFloat(item.paidAmount) !== parseFloat(item.amount) && (
                                  <p className="text-xs text-primary">
                                    Paid: {formatCurrency(item.paidAmount)}
                                  </p>
                                )}
                                <p className={`text-xs ${paidLate ? "text-amber-600" : "text-muted-foreground"}`}>
                                  {new Date(item.paidAt).toLocaleDateString()}
                                  {paidLate ? " (late)" : ""}
                                </p>
                              </>
                            )}
                            {item.status === "partial" && (
                              <p className="text-xs text-primary">
                                Paid: {formatCurrency(item.paidAmount)}
                              </p>
                            )}
                          </div>
                          {item.status !== "paid" && loan.status === "active" && (
                            <Button
                              size="sm"
                              variant={item.status === "overdue" ? "default" : "outline"}
                              onClick={() => setSelectedScheduleItem(item)}
                            >
                              Pay
                            </Button>
                          )}
                        </div>
                      </div>
                      {detailPanel && (
                        <div className="pl-14 pr-3 pb-1">
                          {detailPanel}
                        </div>
                      )}
                    </div>
                  )}
                </PenaltyItems>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Payments */}
      {loan.payments.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle>Recent Payments</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-3">
              {loan.payments.slice(0, 5).map((payment) => {
                const isDebit = payment.type === "debit"
                const isReversed = payment.type === "credit" && !!payment.reversedAt
                const isPenaltyPayment = !!payment.penaltyId && !payment.scheduleItemId
                // Check if this credit is the most recent non-reversed credit for its schedule item
                // Penalty payments can always be reversed (no "most recent" check needed)
                const canReverse = payment.type === "credit" && !payment.reversedAt && (
                  isPenaltyPayment || (
                    payment.scheduleItemId && !loan.payments.some(
                      (other) =>
                        other.id !== payment.id &&
                        other.type === "credit" &&
                        !other.reversedAt &&
                        other.scheduleItemId === payment.scheduleItemId &&
                        new Date(other.createdAt) > new Date(payment.createdAt)
                    )
                  )
                )

                if (isDebit) {
                  return (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between py-2 border-b last:border-0 opacity-80"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-destructive">
                            -{formatCurrency(payment.amount)}
                          </p>
                          <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                            Reversal
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(payment.paidAt).toLocaleDateString()}
                        </p>
                        {payment.notes && (
                          <p className="text-xs text-destructive/70 mt-0.5">
                            {payment.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={payment.id}
                    className={`flex items-center justify-between py-2 border-b last:border-0 group ${isReversed ? "opacity-60" : ""}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className={`font-medium ${isReversed ? "line-through" : ""}`}>
                          {formatCurrency(payment.amount)}
                        </p>
                        {isPenaltyPayment && !isReversed && (
                          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                            Penalty
                          </Badge>
                        )}
                        {isReversed && (
                          <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                            Reversed
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(payment.paidAt).toLocaleDateString()} via{" "}
                        {payment.method.toUpperCase()}
                      </p>
                      {isReversed && payment.reversalReason && (
                        <p className="text-xs text-destructive/70 mt-0.5">
                          Reason: {payment.reversalReason}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {payment.notes && (
                        <p className="text-sm text-muted-foreground mr-1">{payment.notes}</p>
                      )}
                      {payment.type === "credit" && !payment.reversedAt && loan.isLender && (
                        <div className="flex items-center gap-0.5 max-w-0 overflow-hidden opacity-0 group-hover:max-w-[6rem] group-hover:opacity-100 transition-all duration-200">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => {
                              const url = `${window.location.origin}/share/receipt/${payment.id}`
                              navigator.clipboard.writeText(url)
                              toast.success("Receipt link copied to clipboard")
                            }}
                          >
                            <LinkSimple className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => setSelectedPaymentForEdit({
                              id: payment.id,
                              amount: payment.amount,
                              method: payment.method,
                              paidAt: payment.paidAt,
                              scheduleItemId: payment.scheduleItemId,
                            })}
                          >
                            <PencilSimple className="h-3.5 w-3.5" />
                          </Button>
                          {canReverse && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setSelectedPaymentForReversal({
                                id: payment.id,
                                amount: payment.amount,
                                method: payment.method,
                                paidAt: payment.paidAt,
                                scheduleItemId: payment.scheduleItemId,
                              })}
                            >
                              <ArrowCounterClockwise className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Restructure History */}
      {loan.restructures && loan.restructures.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2">
              <ArrowCounterClockwise className="h-5 w-5 text-primary" />
              Restructure History
            </CardTitle>
            <CardDescription>
              {loan.restructures.length} restructure{loan.restructures.length > 1 ? "s" : ""} on record
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-3">
              {loan.restructures.map((r, i) => (
                <div key={r.id} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Restructure #{loan.restructures!.length - i}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(r.createdAt), "MMM d, yyyy")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <span className="text-muted-foreground">Balance before</span>
                    <span className="font-medium text-right">{formatCurrency(r.previousRemainingBalance)}</span>
                    {parseFloat(r.balanceReduction) > 0 && (
                      <>
                        <span className="text-muted-foreground">Balance waived</span>
                        <span className="font-medium text-right text-amber-600 dark:text-amber-400">−{formatCurrency(r.balanceReduction)}</span>
                      </>
                    )}
                    <span className="text-muted-foreground">New balance</span>
                    <span className="font-medium text-right">{formatCurrency(r.newRemainingBalance)}</span>
                    {r.additionalMonths > 0 && (
                      <>
                        <span className="text-muted-foreground">Term extended</span>
                        <span className="font-medium text-right">+{r.additionalMonths} months</span>
                      </>
                    )}
                    <span className="text-muted-foreground">New installment</span>
                    <span className="font-bold text-right text-primary">{formatCurrency(r.newPaymentAmount)}</span>
                  </div>
                  {r.reason && (
                    <p className="text-xs text-muted-foreground border-t pt-2 mt-1">"{r.reason}"</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      {loan.isLender && (
        <Card className="shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle>Documents</CardTitle>
            <CardDescription>
              Generate and download loan documents
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                to="/loans/$loanId/disclosure"
                params={{ loanId: loan.id }}
                className="group flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                  <FileText className="h-5 w-5 text-blue-600" weight="bold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">Disclosure Statement</p>
                  <p className="text-sm text-muted-foreground">
                    Credit terms and cost of borrowing
                  </p>
                </div>
                <ArrowSquareOut className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>

              <Link
                to="/loans/$loanId/promissory-note"
                params={{ loanId: loan.id }}
                className="group flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                  <Scroll className="h-5 w-5 text-amber-600" weight="bold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">Promissory Note</p>
                  <p className="text-sm text-muted-foreground">
                    Borrower's promise to pay
                  </p>
                </div>
                <SigningStatusBadge status={signingStatus?.promissory_note} />
                <ArrowSquareOut className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>

              {loan.status === "completed" && (
                <>
                  <Link
                    to="/share/recap/$loanId"
                    params={{ loanId: loan.id }}
                    className="group flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100">
                      <ChartLineUp className="h-5 w-5 text-green-600" weight="bold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">Loan Recap</p>
                      <p className="text-sm text-muted-foreground">
                        Payment behavior summary
                      </p>
                    </div>
                    <ArrowSquareOut className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </>
              )}

            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Assignment Confirmation Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={(open) => { if (!open) { setShowAssignDialog(false); setPendingAgentId(null) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UsersThree className="h-5 w-5 text-primary" />
              {pendingAgentId === "unassigned" ? "Remove Agent" : "Assign Agent"}
            </DialogTitle>
            <DialogDescription>
              {pendingAgentId === "unassigned"
                ? "Remove the agent assignment from this loan?"
                : (() => {
                    const agent = activeAgents.find((a) => a.id === pendingAgentId)
                    return agent
                      ? `Assign ${agent.agentName} (${agent.commissionRate}%) to this loan?`
                      : "Assign this agent to the loan?"
                  })()
              }
            </DialogDescription>
          </DialogHeader>
          {pendingAgentId !== "unassigned" && (
            <label className="flex items-center gap-2 cursor-pointer rounded-lg border p-3">
              <Checkbox
                checked={notifyAgent}
                onCheckedChange={(checked) => setNotifyAgent(!!checked)}
              />
              <div>
                <p className="text-sm font-medium">Notify agent by email</p>
                <p className="text-xs text-muted-foreground">Send an email to the agent about this assignment</p>
              </div>
            </label>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAssignDialog(false); setPendingAgentId(null) }}>
              Cancel
            </Button>
            <Button onClick={handleConfirmAssign} disabled={assigning} className="gap-2">
              {assigning && <Spinner className="h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Loan</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this {formatCurrency(loan.principal)} loan for{" "}
              {loan.contact.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {hasPayments && (
            <div className="p-3 rounded bg-destructive/10 text-destructive text-sm">
              This loan has {loan.payments.length} payment
              {loan.payments.length !== 1 ? "s" : ""}. You must delete all payments first.
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting || hasPayments}
            >
              {isDeleting ? (
                <>
                  <Spinner className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        open={!!selectedScheduleItem}
        onOpenChange={(open) => { if (!open) setSelectedScheduleItem(null) }}
        loanId={loan.id}
        borrowerName={loan.contact.name}
        scheduleItem={selectedScheduleItem}
        appliedPenalties={
          selectedScheduleItem
            ? 0
            : 0
        }
        scheduleIndex={
          selectedScheduleItem
            ? loan.schedule.findIndex((s) => s.id === selectedScheduleItem.id)
            : undefined
        }
      />

      {/* Reverse Payment Dialog */}
      <ReversePaymentDialog
        open={!!selectedPaymentForReversal}
        onOpenChange={(open) => { if (!open) setSelectedPaymentForReversal(null) }}
        payment={selectedPaymentForReversal}
        scheduleInfo={selectedPaymentForReversal ? getScheduleInfo(selectedPaymentForReversal.scheduleItemId) : null}
      />

      {/* Edit Payment Date Dialog */}
      <EditPaymentDateDialog
        open={!!selectedPaymentForEdit}
        onOpenChange={(open) => { if (!open) setSelectedPaymentForEdit(null) }}
        payment={selectedPaymentForEdit}
        scheduleInfo={selectedPaymentForEdit ? getScheduleInfo(selectedPaymentForEdit.scheduleItemId) : null}
      />

      {/* Regenerate Schedule Dialog */}
      {(() => {
        const unpaidItems = loan.schedule.filter((s) => s.status !== "paid")
        const appliedOrWaivedItemIds = new Set(
          (penaltyData?.penalties ?? [])
            .filter((p) => p.status === "applied" || p.status === "waived")
            .map((p) => p.scheduleItemId)
        )
        const skippedItems = unpaidItems.filter((s) => appliedOrWaivedItemIds.has(s.id))
        const regenerableItems = unpaidItems.filter((s) => !appliedOrWaivedItemIds.has(s.id))
        const skippedUnpaid = skippedItems.reduce(
          (sum, s) => sum + (parseFloat(s.amount) - parseFloat(s.paidAmount)),
          0
        )
        const adjustedBalance = parseFloat(loan.remainingBalance) - skippedUnpaid
        const originalPayment = parseFloat(loan.paymentAmount)

        // Mirror server logic: reduce count if balance is too small for original payment
        let remainingCount = regenerableItems.length
        while (remainingCount > 1 && adjustedBalance <= (remainingCount - 1) * originalPayment) {
          remainingCount--
        }
        const firstItemAmount = remainingCount === 1
          ? adjustedBalance
          : adjustedBalance - (remainingCount - 1) * originalPayment

        const pendingPenaltyCount = (penaltyData?.penalties ?? []).filter(
          (p) => p.status === "pending" && regenerableItems.some((s) => s.id === p.scheduleItemId)
        ).length

        return (
          <RegenerateScheduleDialog
            open={showRegenerateDialog}
            onOpenChange={setShowRegenerateDialog}
            loanId={loan.id}
            remainingBalance={adjustedBalance}
            remainingCount={remainingCount}
            originalPaymentAmount={originalPayment}
            firstItemAmount={firstItemAmount}
            skippedCount={skippedItems.length}
            pendingPenaltyCount={pendingPenaltyCount}
          />
        )
      })()}

      {/* Restructure Loan Dialog */}
      <Dialog open={showRestructureDialog} onOpenChange={setShowRestructureDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Restructure Loan</DialogTitle>
            <DialogDescription>
              Extend the term or reduce the balance. All pending installments will be replaced with a new schedule.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Current snapshot */}
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Current</p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Remaining Balance</span>
                <span className="font-medium">{formatCurrency(loan.remainingBalance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pending Installments</span>
                <span className="font-medium">{loan.schedule.filter((s) => s.status !== "paid").length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Payment</span>
                <span className="font-medium">{formatCurrency(loan.paymentAmount)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Additional Months (term extension)</Label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={restructureAdditionalMonths}
                onChange={(e) => setRestructureAdditionalMonths(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Balance Reduction (₱)</Label>
              <Input
                type="number"
                min="0"
                max={parseFloat(loan.remainingBalance)}
                step="0.01"
                placeholder="0.00"
                value={restructureBalanceReduction}
                onChange={(e) => setRestructureBalanceReduction(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Amount to waive from the remaining balance</p>
            </div>

            {/* Live preview */}
            {(restructureAdditionalMonths || restructureBalanceReduction) && (() => {
              const addMonths = parseInt(restructureAdditionalMonths || "0") || 0
              const reduction = parseFloat(restructureBalanceReduction || "0") || 0
              const pendingCount = loan.schedule.filter((s) => s.status !== "paid").length
              const freqMap: Record<string, number> = { daily: 30, weekly: 4, biweekly: 2, semimonthly: 2, monthly: 1 }
              const extraPayments = addMonths * (freqMap[loan.paymentFrequency] ?? 1)
              const newCount = pendingCount + extraPayments
              const newBalance = Math.max(0, parseFloat(loan.remainingBalance) - reduction)
              const newPayment = newCount > 0 ? newBalance / newCount : newBalance
              const isInvalid = reduction > parseFloat(loan.remainingBalance)
              return (
                <div className={`rounded-lg border p-3 text-sm space-y-1.5 ${isInvalid ? "border-destructive/40 bg-destructive/5" : "border-primary/20 bg-primary/5"}`}>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">After Restructure</p>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">New Balance</span>
                    <span className={`font-medium ${isInvalid ? "text-destructive" : ""}`}>{formatCurrency(newBalance.toFixed(2))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">New Installments</span>
                    <span className="font-medium">{newCount}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1.5 mt-1.5">
                    <span className="font-medium">New Payment Amount</span>
                    <span className={`font-bold ${isInvalid ? "text-destructive" : "text-primary"}`}>{formatCurrency(newPayment.toFixed(2))}</span>
                  </div>
                  {isInvalid && (
                    <p className="text-xs text-destructive pt-1">Balance reduction exceeds remaining balance</p>
                  )}
                </div>
              )
            })()}

            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                placeholder="e.g. Borrower requested extension due to financial hardship"
                value={restructureReason}
                onChange={(e) => setRestructureReason(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestructureDialog(false)} disabled={isRestructuring}>
              Cancel
            </Button>
            <Button
              disabled={isRestructuring || (!restructureAdditionalMonths && !restructureBalanceReduction)}
              onClick={async () => {
                const additionalMonths = parseInt(restructureAdditionalMonths || "0")
                const balanceReduction = parseFloat(restructureBalanceReduction || "0")
                if (isNaN(additionalMonths) || additionalMonths < 0) {
                  toast.error("Invalid additional months")
                  return
                }
                if (isNaN(balanceReduction) || balanceReduction < 0) {
                  toast.error("Invalid balance reduction")
                  return
                }
                if (balanceReduction > parseFloat(loan.remainingBalance)) {
                  toast.error("Balance reduction exceeds remaining balance")
                  return
                }
                setIsRestructuring(true)
                try {
                  await restructureLoan({ data: {
                    loanId: loan.id,
                    additionalMonths,
                    balanceReduction,
                    reason: restructureReason || undefined,
                  }})
                  toast.success("Loan restructured successfully")
                  setShowRestructureDialog(false)
                  router.invalidate()
                } catch (err: any) {
                  toast.error(err.message || "Failed to restructure loan")
                } finally {
                  setIsRestructuring(false)
                }
              }}
            >
              {isRestructuring ? (
                <><Spinner className="h-4 w-4 animate-spin mr-2" />Restructuring...</>
              ) : (
                "Confirm Restructure"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Loan Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Loan</DialogTitle>
            <DialogDescription>
              Review and approve this loan application from your agent.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Loan summary */}
            <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
              <div className="text-center pb-3 border-b">
                <p className="text-2xl font-bold text-primary">{formatCurrency(loan.principal)}</p>
                <p className="text-sm text-muted-foreground">Principal Amount</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Borrower</span>
                  <span className="font-medium">{loan.contact.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Interest Rate</span>
                  <span className="font-medium">{loan.interestRate}% / mo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Term</span>
                  <span className="font-medium">{loan.termMonths} months</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total to Repay</span>
                  <span className="font-medium">{formatCurrency(loan.totalToRepay)}</span>
                </div>
              </div>
            </div>

            {/* Start date option */}
            <div className="flex items-start gap-3">
              <Checkbox
                id="updateStartDate"
                checked={updateStartDate}
                onCheckedChange={(checked) => setUpdateStartDate(!!checked)}
              />
              <div>
                <Label htmlFor="updateStartDate" className="font-medium">
                  Start loan today
                </Label>
                <p className="text-sm text-muted-foreground">
                  {updateStartDate
                    ? "Payment schedule will begin from today"
                    : loan.startDate
                      ? `Will use original start date: ${format(new Date(loan.startDate), "MMM d, yyyy")}`
                      : "Will use today as start date"
                  }
                </p>
              </div>
            </div>

            {/* Warning when using original start date that's in the past */}
            {!updateStartDate && loan.startDate && new Date(loan.startDate) < new Date(new Date().setHours(0, 0, 0, 0)) && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <Warning className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-600">Past start date</p>
                  <p className="text-muted-foreground">
                    The original start date ({format(new Date(loan.startDate), "MMM d, yyyy")}) is in the past.
                    Some payments may immediately show as overdue.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)} disabled={isApproving}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={isApproving} className="bg-green-600 hover:bg-green-700">
              {isApproving ? (
                <>
                  <Spinner className="h-4 w-4 animate-spin mr-2" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve Loan
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Loan Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Loan</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this loan application.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Loan summary */}
            <div className="p-3 rounded-lg border bg-muted/30 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{loan.contact.name}</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(loan.principal)} loan</p>
              </div>
            </div>

            {/* Rejection reason */}
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">Rejection Reason</Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please explain why this loan is being rejected..."
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={isRejecting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isRejecting || !rejectionReason.trim()}
            >
              {isRejecting ? (
                <>
                  <Spinner className="h-4 w-4 animate-spin mr-2" />
                  Rejecting...
                </>
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Reject Loan
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

function SigningStatusBadge({ status }: { status?: string | null }) {
  if (!status || status === "unsigned") return null

  if (status === "signed") {
    return (
      <Badge variant="outline" className="text-[10px] h-5 text-green-600 border-green-200 shrink-0">
        Signed
      </Badge>
    )
  }

  if (status === "pending") {
    return (
      <Badge variant="outline" className="text-[10px] h-5 text-amber-600 border-amber-200 shrink-0">
        Pending
      </Badge>
    )
  }

  if (status === "lender_signed") {
    return (
      <Badge variant="outline" className="text-[10px] h-5 text-blue-600 border-blue-200 shrink-0">
        Lender Signed
      </Badge>
    )
  }

  return null
}
