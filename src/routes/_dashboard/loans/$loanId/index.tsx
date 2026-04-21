import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { getLoan, deleteLoan, approveLoan, rejectLoan, activateDraftLoan, updateDraftLoan } from "@/server/loans"
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
  CaretDown,
  CaretRight,
  CurrencyCircleDollar,
} from "@phosphor-icons/react"
import { Textarea } from "@/components/ui/textarea"
import { format } from "date-fns"
import { calculateEIR, formatEIR } from "@/lib/utils/eir"
import { Input } from "@/components/ui/input"
import { CurrencyInput } from "@/components/ui/currency-input"
import { DatePicker } from "@/components/ui/date-picker"

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

  // Draft loan state
  const [showActivateDraftDialog, setShowActivateDraftDialog] = useState(false)
  const [isActivatingDraft, setIsActivatingDraft] = useState(false)
  const [showEditDraftDialog, setShowEditDraftDialog] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [draftPrincipal, setDraftPrincipal] = useState("")
  const [draftInterestRate, setDraftInterestRate] = useState("")
  const [draftTermMonths, setDraftTermMonths] = useState("")
  const [draftStartDate, setDraftStartDate] = useState<Date | undefined>(undefined)
  const [draftFrequency, setDraftFrequency] = useState("")
  const [draftPurpose, setDraftPurpose] = useState("")

  // Progressive disclosure toggles
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)
  const [showPaidSchedule, setShowPaidSchedule] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [showAllPayments, setShowAllPayments] = useState(false)

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

  const handleActivateDraft = async () => {
    setIsActivatingDraft(true)
    try {
      await activateDraftLoan({ data: { loanId: loan.id } })
      toast.success("Loan activated")
      setShowActivateDraftDialog(false)
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to activate loan")
    } finally {
      setIsActivatingDraft(false)
    }
  }

  const handleSaveDraft = async () => {
    setIsSavingDraft(true)
    try {
      await updateDraftLoan({
        data: {
          loanId: loan.id,
          principal: parseFloat(draftPrincipal),
          interestRate: parseFloat(draftInterestRate),
          termMonths: parseInt(draftTermMonths),
          paymentFrequency: draftFrequency as any,
          startDate: draftStartDate ? format(draftStartDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
          purpose: draftPurpose || undefined,
        },
      })
      toast.success("Draft updated")
      setShowEditDraftDialog(false)
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update draft")
    } finally {
      setIsSavingDraft(false)
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
    draft: { variant: "outline", label: "Draft", className: "bg-muted text-muted-foreground border-border" },
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
    overdue: { icon: Warning, className: "text-muted-foreground bg-muted" },
  }

  const borrowerInitials = loan.contact.name
    .split(" ")
    .slice(0, 2)
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()

  // Derived values for redesigned page
  const overdueItems = loan.schedule.filter((s) => s.status === "overdue")
  const upcomingItems = loan.schedule.filter((s) => s.status === "pending" || s.status === "partial")
  const paidItems = loan.schedule.filter((s) => s.status === "paid")
  const chargedPenalties = (penaltyData?.penalties ?? []).filter((p) => p.status === "applied" || p.status === "pending")
  const overdueTotal = overdueItems.reduce((sum, s) => sum + parseFloat(s.amount) - parseFloat(s.paidAmount), 0)
  const penaltyTotal = chargedPenalties.reduce((sum, p) => sum + parseFloat(p.amount), 0)
  const totalDueNow = overdueTotal + penaltyTotal
  const nextUpcoming = upcomingItems[0]
  const progressPct = Math.round((parseFloat(loan.amountPaid) / parseFloat(loan.totalToRepay)) * 100)

  const handleQuickPay = () => {
    const target = overdueItems[0] || upcomingItems[0]
    if (target) setSelectedScheduleItem(target)
  }

  const freqLabel = loan.paymentFrequency === "semimonthly" ? "Semi-monthly" : loan.paymentFrequency.charAt(0).toUpperCase() + loan.paymentFrequency.slice(1)

  const renderScheduleItem = (item: ScheduleItem, index: number) => {
    const config = scheduleStatusConfig[item.status]
    const StatusIcon = config.icon
    const itemPenalties = penaltyData?.penalties.filter((p) => p.scheduleItemId === item.id) ?? []
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
            <div className="flex items-center justify-between p-3 rounded border">
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${config.className}`}>
                  <StatusIcon className="h-4 w-4" weight="bold" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">Payment #{index + 1}</p>
                    {item.status === "overdue" && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
                        Overdue
                      </span>
                    )}
                  </div>
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
                        <p className="text-xs text-primary">Paid: {formatCurrency(item.paidAmount)}</p>
                      )}
                      <p className={`text-xs ${paidLate ? "text-amber-600" : "text-muted-foreground"}`}>
                        {new Date(item.paidAt).toLocaleDateString()}
                        {paidLate ? " (late)" : ""}
                      </p>
                    </>
                  )}
                  {item.status === "partial" && (
                    <p className="text-xs text-primary">Paid: {formatCurrency(item.paidAmount)}</p>
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
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5 pb-28 md:pb-6 space-y-5">
      {/* Slim header */}
      <div className="flex items-center justify-between gap-3">
        <Link to="/loans" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Loans
        </Link>
        {loan.isLender && (
          <div className="flex items-center gap-1.5">
            {loan.borrowerToken && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => {
                  const url = `${window.location.origin}/share/loan/${loan.borrowerToken}`
                  navigator.clipboard.writeText(url)
                  toast.success("Borrower link copied!")
                }}
              >
                <LinkSimple className="h-3.5 w-3.5" weight="bold" />
                <span className="hidden sm:inline">Share</span>
              </Button>
            )}
            {loan.status === "completed" && (
              <Link to="/loans/new-wizard" search={{ renewFromLoanId: loan.id }}>
                <Button variant="outline" size="sm" className="gap-1.5 h-8">
                  <ArrowClockwise className="h-3.5 w-3.5" weight="bold" />
                  <span className="hidden sm:inline">Renew</span>
                </Button>
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={(props) => (
                  <Button {...props} variant="ghost" size="icon" className="h-8 w-8">
                    <DotsThreeVertical className="h-4 w-4" weight="bold" />
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

      {/* Borrower identity strip */}
      <Link
        to="/contacts/$contactId"
        params={{ contactId: loan.contact.id }}
        className="flex items-center gap-3 group"
      >
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm border border-primary/20">
          {borrowerInitials}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold tracking-tight group-hover:text-primary transition-colors truncate">
            {loan.contact.name}
          </h1>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <Badge variant={statusConfig[loan.status].variant} className={`text-[10px] h-5 ${statusConfig[loan.status].className || ""}`}>
              {statusConfig[loan.status].label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {loan.contact.phone}
              {loan.contact.phone && loan.contact.city && " · "}
              {loan.contact.city}
            </span>
          </div>
        </div>
      </Link>

      {/* Renewal chain (compact inline pills) */}
      {(loan.renewedFromLoan || loan.renewedToLoan) && (
        <div className="flex flex-wrap gap-2">
          {loan.renewedFromLoan && (
            <Link
              to="/loans/$loanId"
              params={{ loanId: loan.renewedFromLoan.id }}
              className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs hover:border-primary/40 transition-colors"
            >
              <ArrowCounterClockwise className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Renewed from</span>
              <span className="font-medium">{formatCurrency(loan.renewedFromLoan.principal)}</span>
            </Link>
          )}
          {loan.renewedToLoan && (
            <Link
              to="/loans/$loanId"
              params={{ loanId: loan.renewedToLoan.id }}
              className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs hover:border-primary/40 transition-colors"
            >
              <ArrowClockwise className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Renewed as</span>
              <span className="font-medium">{formatCurrency(loan.renewedToLoan.principal)}</span>
            </Link>
          )}
        </div>
      )}

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

      {/* Draft Banner */}
      {loan.status === "draft" && loan.isLender && (
        <Card className="border-muted shadow-sm rounded-xl">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold">Draft Loan</p>
                  <p className="text-sm text-muted-foreground">
                    No schedule generated yet. Edit the terms or activate to start collecting.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 sm:shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setDraftPrincipal(loan.principal)
                    setDraftInterestRate(loan.interestRate)
                    setDraftTermMonths(String(loan.termMonths))
                    setDraftStartDate(loan.startDate ? new Date(loan.startDate) : new Date())
                    setDraftFrequency(loan.paymentFrequency)
                    setDraftPurpose(loan.purpose || "")
                    setShowEditDraftDialog(true)
                  }}
                >
                  <PencilSimple className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowActivateDraftDialog(true)}
                >
                  <CurrencyCircleDollar className="h-4 w-4" />
                  Activate
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main two-column layout */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* LEFT COLUMN — Hero + Schedule */}
        <div className="lg:col-span-2 space-y-5">

          {/* HERO CARD */}
          <Card className="shadow-sm rounded-xl">
            <CardContent className="p-5 sm:p-6">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Remaining Balance</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-4xl font-bold tracking-tight">{formatCurrency(loan.remainingBalance)}</p>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                of {formatCurrency(loan.principal)} principal · {formatCurrency(loan.totalToRepay)} total repay
              </p>

              {/* Progress */}
              <div className="mt-5">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{paidItems.length} of {loan.schedule.length} payments</span>
                  <span>{Math.min(100, progressPct)}% paid</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, progressPct)}%` }}
                  />
                </div>
              </div>

              {/* Next due (when active, no overdue) */}
              {loan.status === "active" && totalDueNow <= 0 && nextUpcoming && (
                <div className="mt-5 pt-4 border-t flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 text-sm">
                    <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Next due</span>
                    <span className="font-medium">{format(new Date(nextUpcoming.dueDate), "MMM d")}</span>
                  </div>
                  <span className="font-semibold">{formatCurrency(nextUpcoming.amount)}</span>
                </div>
              )}

              {/* Total Due Now breakdown */}
              {loan.status === "active" && totalDueNow > 0 && (
                <div className="mt-5 pt-4 border-t space-y-1.5">
                  {overdueItems.map((s) => {
                    const idx = loan.schedule.findIndex((x) => x.id === s.id)
                    const due = parseFloat(s.amount) - parseFloat(s.paidAmount)
                    return (
                      <div key={s.id} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          Payment #{idx + 1}
                          <span className="ml-1 opacity-60">({format(new Date(s.dueDate), "MMM d")})</span>
                        </span>
                        <span className="font-medium">{formatCurrency(due)}</span>
                      </div>
                    )
                  })}
                  {penaltyTotal > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Penalties ({chargedPenalties.length})</span>
                      <span className="font-medium">{formatCurrency(penaltyTotal)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 mt-1 border-t">
                    <span className="text-sm font-bold">Total Due Now</span>
                    <span className="text-lg font-bold">{formatCurrency(totalDueNow)}</span>
                  </div>
                  {loan.isLender && (
                    <Button className="w-full gap-2 mt-2" onClick={handleQuickPay}>
                      <CurrencyCircleDollar className="h-4 w-4" weight="bold" />
                      Record Payment
                    </Button>
                  )}
                </div>
              )}

              {loan.status === "completed" && (
                <div className="mt-5 pt-4 border-t flex items-center gap-2.5 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" weight="fill" />
                  <span className="font-medium">Loan fully paid</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PAYMENT SCHEDULE — Grouped (hidden for drafts) */}
          {loan.status === "draft" ? (
            <Card className="shadow-sm rounded-xl">
              <CardContent className="p-8 text-center text-muted-foreground">
                <CurrencyCircleDollar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">No schedule yet</p>
                <p className="text-xs mt-1">Activate the loan to generate the payment schedule.</p>
              </CardContent>
            </Card>
          ) : (
          <Card className="shadow-sm rounded-xl">
            <CardHeader className="p-4 pb-2">
              <CardTitle>Payment Schedule</CardTitle>
              <CardDescription>
                {paidItems.length} of {loan.schedule.length} payments completed
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">

              {/* Overdue — auto-expanded */}
              {overdueItems.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    <span>Overdue</span>
                    <span className="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 rounded px-1.5 py-0.5 text-[10px]">
                      {overdueItems.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {overdueItems.map((item) => {
                      const index = loan.schedule.findIndex((s) => s.id === item.id)
                      return renderScheduleItem(item, index)
                    })}
                  </div>
                </div>
              )}

              {/* Upcoming */}
              {upcomingItems.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <span>Upcoming</span>
                      <span className="bg-muted rounded px-1.5 py-0.5 text-[10px] text-foreground">
                        {upcomingItems.length}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {(showAllUpcoming ? upcomingItems : upcomingItems.slice(0, 3)).map((item) => {
                      const index = loan.schedule.findIndex((s) => s.id === item.id)
                      return renderScheduleItem(item, index)
                    })}
                    {upcomingItems.length > 3 && (
                      <button
                        onClick={() => setShowAllUpcoming(!showAllUpcoming)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                      >
                        {showAllUpcoming ? <CaretDown className="h-3 w-3" /> : <CaretRight className="h-3 w-3" />}
                        {showAllUpcoming ? "Show less" : `Show ${upcomingItems.length - 3} more`}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Paid — collapsed by default */}
              {paidItems.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowPaidSchedule(!showPaidSchedule)}
                    className="flex items-center justify-between w-full mb-2 group"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground group-hover:text-foreground transition-colors">
                      <span>Paid</span>
                      <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px]">
                        {paidItems.length}
                      </span>
                    </div>
                    {showPaidSchedule
                      ? <CaretDown className="h-3.5 w-3.5 text-muted-foreground" />
                      : <CaretRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  </button>
                  {showPaidSchedule && (
                    <div className="space-y-2">
                      {paidItems.map((item) => {
                        const index = loan.schedule.findIndex((s) => s.id === item.id)
                        return renderScheduleItem(item, index)
                      })}
                    </div>
                  )}
                </div>
              )}

            </CardContent>
          </Card>
          )}

        </div>

        {/* RIGHT COLUMN — Recent Payments + Loan Details + Restructure + Documents */}
        <div className="space-y-5">

          {/* RECENT PAYMENTS (compact, top 5) */}
          {loan.payments.length > 0 && (
            <Card className="shadow-sm rounded-xl">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base">Recent Payments</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-0">
                  {(showAllPayments ? loan.payments : loan.payments.slice(0, 5)).map((payment) => {
                    const isDebit = payment.type === "debit"
                    const isReversed = payment.type === "credit" && !!payment.reversedAt
                    const isPenaltyPayment = !!payment.penaltyId && !payment.scheduleItemId
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
                        <div key={payment.id} className="py-2.5 border-b last:border-0 opacity-80">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">-{formatCurrency(payment.amount)}</p>
                            <Badge variant="outline" className="text-[10px] h-5">Reversal</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{new Date(payment.paidAt).toLocaleDateString()}</p>
                          {payment.notes && <p className="text-xs text-muted-foreground/70 mt-0.5">{payment.notes}</p>}
                        </div>
                      )
                    }

                    return (
                      <div key={payment.id} className={`py-2.5 border-b last:border-0 group ${isReversed ? "opacity-60" : ""}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-medium ${isReversed ? "line-through" : ""}`}>
                                {formatCurrency(payment.amount)}
                              </p>
                              {isPenaltyPayment && !isReversed && (
                                <Badge variant="outline" className="text-[10px] h-5 text-amber-600 border-amber-300">Penalty</Badge>
                              )}
                              {isReversed && (
                                <Badge variant="outline" className="text-[10px] h-5">Reversed</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {new Date(payment.paidAt).toLocaleDateString()} · {payment.method.toUpperCase()}
                            </p>
                            {isReversed && payment.reversalReason && (
                              <p className="text-xs text-muted-foreground/70 mt-0.5">Reason: {payment.reversalReason}</p>
                            )}
                          </div>
                          {payment.type === "credit" && !payment.reversedAt && loan.isLender && (
                            <div className="flex items-center gap-0.5 max-w-0 overflow-hidden opacity-0 group-hover:max-w-[6rem] group-hover:opacity-100 transition-all duration-200 shrink-0">
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
                {loan.payments.length > 5 && (
                  <button
                    onClick={() => setShowAllPayments(!showAllPayments)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-3"
                  >
                    {showAllPayments ? <CaretDown className="h-3 w-3" /> : <CaretRight className="h-3 w-3" />}
                    {showAllPayments ? "Show recent only" : `View all ${loan.payments.length} payments`}
                  </button>
                )}
              </CardContent>
            </Card>
          )}

          {/* LOAN DETAILS — collapsed by default */}
          <Card className="shadow-sm rounded-xl">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between p-4 group"
            >
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Loan Details</CardTitle>
              </div>
              {showDetails
                ? <CaretDown className="h-4 w-4 text-muted-foreground" />
                : <CaretRight className="h-4 w-4 text-muted-foreground" />}
            </button>
            {showDetails && (
              <CardContent className="p-4 pt-0 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Interest Rate</span>
                  <span className="font-medium">{loan.interestRate}% / mo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Effective Rate</span>
                  <span className="font-medium">
                    {formatEIR(
                      calculateEIR({
                        principal: parseFloat(loan.principal),
                        totalInterest: parseFloat(loan.totalToRepay) - parseFloat(loan.principal),
                        termMonths: loan.termMonths,
                        paymentFrequency: loan.paymentFrequency as any,
                      })
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Term</span>
                  <span className="font-medium">{loan.termMonths} months</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Frequency</span>
                  <span className="font-medium">{freqLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Paid</span>
                  <span className="font-medium">{formatCurrency(loan.amountPaid)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Start Date</span>
                  <span className="font-medium">{loan.startDate ? new Date(loan.startDate).toLocaleDateString() : "Not started"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Maturity Date</span>
                  <span className="font-medium">{loan.maturityDate ? new Date(loan.maturityDate).toLocaleDateString() : "—"}</span>
                </div>
                {loan.processingFeePercent && parseFloat(loan.processingFeePercent) > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Processing Fee ({loan.processingFeePercent}%)</span>
                      <span className="font-medium">{formatCurrency(parseFloat(loan.principal) * parseFloat(loan.processingFeePercent) / 100)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Net Proceeds</span>
                      <span className="font-medium">{formatCurrency(parseFloat(loan.principal) - parseFloat(loan.principal) * parseFloat(loan.processingFeePercent) / 100)}</span>
                    </div>
                  </>
                )}
                {loan.purpose && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-0.5">Purpose</p>
                    <p className="text-sm">{loan.purpose}</p>
                  </div>
                )}
                {loan.collateralDescription && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-0.5">Collateral</p>
                    <p className="text-sm">{loan.collateralDescription}</p>
                  </div>
                )}
                {loan.coMakerName && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-0.5">Co-maker / Guarantor</p>
                    <p className="text-sm font-medium">{loan.coMakerName}</p>
                    {loan.coMakerPhone && <p className="text-xs text-muted-foreground">{loan.coMakerPhone}</p>}
                    {loan.coMakerRelationship && <p className="text-xs text-muted-foreground">{loan.coMakerRelationship}</p>}
                  </div>
                )}
                {loan.isLender && activeAgents.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1.5">Agent Assignment</p>
                    <Select
                      value={loan.assignedAgentId || "unassigned"}
                      onValueChange={handleAgentSelectChange}
                      disabled={assigning}
                    >
                      <SelectTrigger className="w-full h-9 text-sm">
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
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Restructure History */}
          {loan.restructures && loan.restructures.length > 0 && (
            <Card className="shadow-sm rounded-xl">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ArrowCounterClockwise className="h-4 w-4 text-primary" />
                  Restructure History
                </CardTitle>
                <CardDescription className="text-xs">
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
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
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
            <Card className="shadow-sm rounded-xl">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base">Documents</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-2">
                  <Link
                    to="/loans/$loanId/disclosure"
                    params={{ loanId: loan.id }}
                    className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/40">
                      <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" weight="bold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Disclosure Statement</p>
                      <p className="text-xs text-muted-foreground">Credit terms & cost of borrowing</p>
                    </div>
                    <ArrowSquareOut className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>

                  <Link
                    to="/loans/$loanId/promissory-note"
                    params={{ loanId: loan.id }}
                    className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/40">
                      <Scroll className="h-4 w-4 text-amber-600 dark:text-amber-400" weight="bold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Promissory Note</p>
                      <p className="text-xs text-muted-foreground">Borrower's promise to pay</p>
                    </div>
                    <SigningStatusBadge status={signingStatus?.promissory_note} />
                    <ArrowSquareOut className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>

                  {loan.status === "completed" && (
                    <Link
                      to="/share/recap/$loanId"
                      params={{ loanId: loan.id }}
                      className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-950/40">
                        <ChartLineUp className="h-4 w-4 text-green-600 dark:text-green-400" weight="bold" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Loan Recap</p>
                        <p className="text-xs text-muted-foreground">Payment behavior summary</p>
                      </div>
                      <ArrowSquareOut className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>

      {/* Sticky mobile Record Payment footer — active loans with unpaid items */}
      {loan.isLender && loan.status === "active" && (overdueItems.length > 0 || upcomingItems.length > 0) && (
        <div className="fixed bottom-16 left-0 right-0 md:hidden bg-background border-t px-4 py-3 z-40 flex gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Button className="flex-1 gap-2" onClick={handleQuickPay}>
            <CurrencyCircleDollar className="h-4 w-4" weight="bold" />
            Record Payment
          </Button>
        </div>
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

      {/* Activate Draft Dialog */}
      <Dialog open={showActivateDraftDialog} onOpenChange={setShowActivateDraftDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Activate Loan</DialogTitle>
            <DialogDescription>
              This will generate the payment schedule and activate the loan for {loan.contact.name}. You won't be able to edit the terms after activation.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActivateDraftDialog(false)} disabled={isActivatingDraft}>
              Cancel
            </Button>
            <Button onClick={handleActivateDraft} disabled={isActivatingDraft} className="gap-2">
              {isActivatingDraft ? (
                <><Spinner className="h-4 w-4 animate-spin" /> Activating...</>
              ) : (
                <><CurrencyCircleDollar className="h-4 w-4" /> Activate Loan</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Draft Dialog */}
      <Dialog open={showEditDraftDialog} onOpenChange={setShowEditDraftDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Draft Loan</DialogTitle>
            <DialogDescription>Update loan terms before activating.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Principal Amount</Label>
                <CurrencyInput
                  value={draftPrincipal}
                  onValueChange={setDraftPrincipal}
                  placeholder="10,000"
                />
              </div>
              <div className="space-y-2">
                <Label>Interest Rate</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="15"
                    step="0.5"
                    value={draftInterestRate}
                    onChange={(e) => setDraftInterestRate(e.target.value)}
                    className="pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">% / mo</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Loan Term</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="1"
                    max="60"
                    value={draftTermMonths}
                    onChange={(e) => setDraftTermMonths(e.target.value)}
                    className="pr-20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">months</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Payment Frequency</Label>
                <Select value={draftFrequency} onValueChange={setDraftFrequency}>
                  <SelectTrigger>
                    {{ monthly: "Monthly", semimonthly: "Semi-monthly", biweekly: "Bi-weekly", weekly: "Weekly", daily: "Daily" }[draftFrequency] || "Select..."}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="semimonthly">Semi-monthly (1st & 15th)</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <DatePicker
                value={draftStartDate}
                onChange={(date) => date && setDraftStartDate(date)}
              />
            </div>
            <div className="space-y-2">
              <Label>Purpose <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                value={draftPurpose}
                onChange={(e) => setDraftPurpose(e.target.value)}
                placeholder="e.g., Medical, Business"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDraftDialog(false)} disabled={isSavingDraft}>
              Cancel
            </Button>
            <Button onClick={handleSaveDraft} disabled={isSavingDraft} className="gap-2">
              {isSavingDraft ? (
                <><Spinner className="h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                <><Check className="h-4 w-4" /> Save Changes</>
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
