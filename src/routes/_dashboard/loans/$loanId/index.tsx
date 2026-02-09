import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { getLoan, deleteLoan, approveLoan, rejectLoan } from "@/server/loans"
import { getAgents, assignLoanToAgent } from "@/server/agents"
import { recordPayment } from "@/server/payments"
import { PenaltyItems } from "@/components/penalty-items"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CurrencyInput } from "@/components/ui/currency-input"
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
  Gavel,
} from "@phosphor-icons/react"
import { Textarea } from "@/components/ui/textarea"
import { DatePicker } from "@/components/ui/date-picker"
import { format } from "date-fns"
import { calculateEIR, formatEIR } from "@/lib/utils/eir"

export const Route = createFileRoute("/_dashboard/loans/$loanId/")({
  loader: async ({ params, context }) => {
    const { session } = context as { session: { user: { role: string | null } } }
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      return { loan: null, agents: [], unauthorized: true }
    }

    try {
      const loan = await getLoan({ data: params.loanId })
      // Only allow if user is the lender
      if (!loan.isLender) {
        return { loan: null, agents: [], unauthorized: true }
      }

      let agents: Awaited<ReturnType<typeof getAgents>> = []
      try {
        agents = await getAgents()
      } catch {
        // Agents list not available
      }

      return { loan, agents, unauthorized: false }
    } catch {
      return { loan: null, agents: [], unauthorized: false }
    }
  },
  pendingComponent: SkeletonDetailPage,
  component: LoanDetailPage,
})

type ScheduleItem = NonNullable<Awaited<ReturnType<typeof getLoan>>>["schedule"][0]

function LoanDetailPage() {
  const { loan, agents, unauthorized } = Route.useLoaderData()
  const penaltyData = loan?.penaltyData ?? null
  const router = useRouter()
  const [assigning, setAssigning] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Approval state
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [updateStartDate, setUpdateStartDate] = useState(true)
  const [rejectionReason, setRejectionReason] = useState("")

  // Payment form state
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [paymentStep, setPaymentStep] = useState<"form" | "confirm">("form")
  const [selectedScheduleItem, setSelectedScheduleItem] = useState<ScheduleItem | null>(null)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "gcash" | "maya" | "bank">("cash")
  const [paymentDate, setPaymentDate] = useState<Date>(new Date())
  const [paymentNotes, setPaymentNotes] = useState("")
  const [isRecordingPayment, setIsRecordingPayment] = useState(false)


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

  const handleAssignAgent = async (agentId: string | null) => {
    setAssigning(true)
    try {
      await assignLoanToAgent({
        data: {
          loanId: loan.id,
          agentId: agentId === "unassigned" ? null : agentId,
        },
      })
      toast.success(agentId === "unassigned" ? "Agent unassigned" : "Agent assigned successfully")
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign agent")
    } finally {
      setAssigning(false)
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

  const openPaymentDialog = (item: ScheduleItem) => {
    setSelectedScheduleItem(item)
    const remaining = parseFloat(item.amount) - parseFloat(item.paidAmount)
    const appliedPenalties = (penaltyData?.penalties ?? [])
      .filter((p) => p.scheduleItemId === item.id && p.status === "applied")
      .reduce((sum, p) => sum + parseFloat(p.amount), 0)
    setPaymentAmount((remaining + appliedPenalties).toString())
    setPaymentMethod("cash")
    setPaymentDate(new Date())
    setPaymentNotes("")
    setPaymentStep("form")
    setShowPaymentDialog(true)
  }

  const closePaymentDialog = () => {
    setShowPaymentDialog(false)
    setSelectedScheduleItem(null)
    setPaymentAmount("")
    setPaymentDate(new Date())
    setPaymentNotes("")
    setPaymentStep("form")
  }

  const handleRecordPayment = async () => {
    if (!selectedScheduleItem) return

    setIsRecordingPayment(true)
    try {
      await recordPayment({
        data: {
          loanId: loan.id,
          scheduleItemId: selectedScheduleItem.id,
          amount: parseFloat(paymentAmount),
          method: paymentMethod,
          paidAt: format(paymentDate, "yyyy-MM-dd"),
          notes: paymentNotes || undefined,
        },
      })
      toast.success("Payment recorded successfully")
      closePaymentDialog()
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment")
    } finally {
      setIsRecordingPayment(false)
    }
  }


  const hasOverdueItems = loan?.schedule.some((s) => s.status === "overdue")

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

  return (
    <div>
      {/* Header with background */}
      <div className="bg-[hsl(215_45%_14%)] text-white pt-6 lg:pt-8 pb-16">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 space-y-4">
          {/* Back link */}
          <Link to="/loans" className="inline-flex items-center gap-2 text-sm text-blue-200/70 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Loans
          </Link>

          {/* Title Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="border-l-4 border-primary pl-4">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">
                  {formatCurrency(loan.principal)}
                </h1>
                <Badge variant={statusConfig[loan.status].variant} className={loan.status === "active" ? "bg-primary/20 text-primary-foreground border-0" : statusConfig[loan.status].className || ""}>
                  {statusConfig[loan.status].label}
                </Badge>
              </div>
              <p className="text-blue-200/70">
                {loan.contact.name} · {loan.interestRate}% for {loan.termMonths} months
              </p>
            </div>
            {loan.isLender && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteDialog(true)}
                  className="gap-2"
                >
                  <Trash className="h-4 w-4" weight="bold" />
                  Delete
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content - overlaps header */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-8 pb-8 space-y-6 relative">
      {/* Pending Approval Banner */}
      {loan.status === "pending_approval" && loan.isLender && (
        <Card className="border-amber-300 bg-amber-50 shadow-lg">
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
        <Card className="border-gray-300 bg-gray-50 shadow-lg">
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Loan Summary */}
        <Card className="shadow-lg">
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
          </CardContent>
        </Card>

        {/* Borrower */}
        <Card className="shadow-lg">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Borrower
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <Link
              to="/contacts/$contactId"
              params={{ contactId: loan.contact.id }}
              className="block hover:text-primary"
            >
              <p className="font-semibold text-lg">{loan.contact.name}</p>
              {loan.contact.phone && (
                <p className="text-muted-foreground">{loan.contact.phone}</p>
              )}
              {loan.contact.city && (
                <p className="text-sm text-muted-foreground">{loan.contact.city}</p>
              )}
            </Link>
          </CardContent>
        </Card>

        {/* Dates */}
        <Card className="shadow-lg">
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
                      onValueChange={handleAssignAgent}
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

      {/* Penalty Summary */}
      {penaltyData && penaltyData.config.enabled && hasOverdueItems && (
        <Card className="shadow-sm border-amber-300/50">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-amber-600" />
              Penalties
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1 p-3 rounded bg-muted/50">
                <p className="text-sm text-muted-foreground">Applied</p>
                <p className="text-lg font-bold">{formatCurrency(penaltyData.totalApplied)}</p>
              </div>
              <div className="space-y-1 p-3 rounded bg-amber-50 dark:bg-amber-900/20">
                <p className="text-sm text-muted-foreground">Pending Decisions</p>
                <p className="text-lg font-bold text-amber-600">
                  {penaltyData.penalties.filter((p) => p.status === "pending").length}
                </p>
              </div>
              <div className="space-y-1 p-3 rounded bg-muted/50">
                <p className="text-sm text-muted-foreground">Cap Remaining</p>
                <p className="text-lg font-bold">{formatCurrency(penaltyData.budgetRemaining)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
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
              const appliedPenaltyTotal = itemPenalties
                .filter((p) => p.status === "applied")
                .reduce((sum, p) => sum + parseFloat(p.amount), 0)
              // Compute days overdue from due date (calendar days)
              const daysOverdue = item.status === "overdue"
                ? Math.max(0, Math.floor((new Date(new Date().toDateString()).getTime() - new Date(new Date(item.dueDate).toDateString()).getTime()) / 86400000))
                : 0

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
                            {appliedPenaltyTotal > 0 && (
                              <p className="text-xs text-amber-600">
                                + {formatCurrency(appliedPenaltyTotal)} penalty
                              </p>
                            )}
                            {item.status === "paid" && item.paidAt && (
                              <p className="text-xs text-muted-foreground">
                                Paid: {new Date(item.paidAt).toLocaleDateString()}
                              </p>
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
                              onClick={() => openPaymentDialog(item)}
                            >
                              Pay
                            </Button>
                          )}
                        </div>
                      </div>
                      {detailPanel && (
                        <div className="ml-11">{detailPanel}</div>
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
              {loan.payments.slice(0, 5).map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium">{formatCurrency(payment.amount)}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(payment.paidAt).toLocaleDateString()} via{" "}
                      {payment.method.toUpperCase()}
                    </p>
                  </div>
                  {payment.notes && (
                    <p className="text-sm text-muted-foreground">{payment.notes}</p>
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
                <ArrowSquareOut className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>

            </div>
          </CardContent>
        </Card>
      )}
      </div>

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
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {paymentStep === "form" ? "Record Payment" : "Confirm Payment"}
            </DialogTitle>
            <DialogDescription>
              {selectedScheduleItem && (
                <>
                  Payment #{loan.schedule.findIndex(s => s.id === selectedScheduleItem.id) + 1} · Due{" "}
                  {new Date(selectedScheduleItem.dueDate).toLocaleDateString()}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedScheduleItem && paymentStep === "form" && (
            <div className="space-y-4">
              {/* Schedule item info */}
              <div className="p-3 rounded bg-muted/50 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Due</span>
                  <span className="font-medium">{formatCurrency(selectedScheduleItem.amount)}</span>
                </div>
                {parseFloat(selectedScheduleItem.paidAmount) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Already Paid</span>
                    <span className="font-medium text-primary">{formatCurrency(selectedScheduleItem.paidAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span className="text-muted-foreground">Remaining</span>
                  <span className="font-semibold">
                    {formatCurrency(parseFloat(selectedScheduleItem.amount) - parseFloat(selectedScheduleItem.paidAmount))}
                  </span>
                </div>
                {(() => {
                  const appliedTotal = (penaltyData?.penalties ?? [])
                    .filter((p) => p.scheduleItemId === selectedScheduleItem.id && p.status === "applied")
                    .reduce((sum, p) => sum + parseFloat(p.amount), 0)
                  if (appliedTotal <= 0) return null
                  const remaining = parseFloat(selectedScheduleItem.amount) - parseFloat(selectedScheduleItem.paidAmount)
                  return (
                    <>
                      <div className="flex justify-between text-amber-600">
                        <span>Applied Penalties</span>
                        <span className="font-medium">+{formatCurrency(appliedTotal)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-1 mt-1 font-semibold">
                        <span>Total Due</span>
                        <span>{formatCurrency(remaining + appliedTotal)}</span>
                      </div>
                    </>
                  )
                })()}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="paymentAmount">Payment Amount</Label>
                  <CurrencyInput
                    id="paymentAmount"
                    value={paymentAmount}
                    onValueChange={setPaymentAmount}
                    placeholder="1,000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                    <SelectTrigger>
                      {{ cash: "Cash", gcash: "GCash", maya: "Maya", bank: "Bank Transfer" }[paymentMethod]}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="gcash">GCash</SelectItem>
                      <SelectItem value="maya">Maya</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label>Payment Date</Label>
                  <DatePicker
                    value={paymentDate}
                    onChange={(date) => date && setPaymentDate(date)}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="paymentNotes">Notes (optional)</Label>
                  <Input
                    id="paymentNotes"
                    placeholder="Any additional notes..."
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {selectedScheduleItem && paymentStep === "confirm" && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                <div className="text-center pb-3 border-b">
                  <p className="text-2xl font-bold text-primary">{formatCurrency(paymentAmount)}</p>
                  <p className="text-sm text-muted-foreground">Payment Amount</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Borrower</span>
                    <span className="font-medium">{loan.contact.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Date</span>
                    <span className="font-medium">{format(paymentDate, "MMMM d, yyyy")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Method</span>
                    <span className="font-medium">
                      {{ cash: "Cash", gcash: "GCash", maya: "Maya", bank: "Bank Transfer" }[paymentMethod]}
                    </span>
                  </div>
                  {paymentNotes && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Notes</span>
                      <span className="font-medium text-right max-w-[180px] truncate">{paymentNotes}</span>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Please review the details above before confirming.
              </p>
            </div>
          )}

          <DialogFooter>
            {paymentStep === "form" ? (
              <>
                <Button variant="outline" onClick={closePaymentDialog}>
                  Cancel
                </Button>
                <Button onClick={() => setPaymentStep("confirm")} disabled={!paymentAmount}>
                  Review Payment
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setPaymentStep("form")}>
                  Back
                </Button>
                <Button onClick={handleRecordPayment} disabled={isRecordingPayment}>
                  {isRecordingPayment ? (
                    <>
                      <Spinner className="h-4 w-4 animate-spin mr-2" />
                      Recording...
                    </>
                  ) : (
                    "Confirm Payment"
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Loan Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-md">
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
        <DialogContent className="max-w-md">
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
