import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { getLoan, deleteLoan } from "@/server/loans"
import { getAgents, assignLoanToAgent } from "@/server/agents"
import { recordPayment } from "@/server/payments"
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
import { AccessDenied } from "@/components/access-denied"
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
} from "@phosphor-icons/react"
import { DatePicker } from "@/components/ui/date-picker"
import { format } from "date-fns"

export const Route = createFileRoute("/_dashboard/loans/$loanId")({
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
  component: LoanDetailPage,
})

type ScheduleItem = NonNullable<Awaited<ReturnType<typeof getLoan>>>["schedule"][0]

function LoanDetailPage() {
  const { loan, agents, unauthorized } = Route.useLoaderData()
  const router = useRouter()
  const [assigning, setAssigning] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

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

  const openPaymentDialog = (item: ScheduleItem) => {
    setSelectedScheduleItem(item)
    const remaining = parseFloat(item.amount) - parseFloat(item.paidAmount)
    setPaymentAmount(remaining.toString())
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


  const statusConfig: Record<string, { variant: any; label: string }> = {
    pending_disbursement: { variant: "outline", label: "Pending Disbursement" },
    active: { variant: "secondary", label: "Active" },
    completed: { variant: "default", label: "Completed" },
    defaulted: { variant: "destructive", label: "Defaulted" },
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
                <Badge variant={statusConfig[loan.status].variant} className={loan.status === "active" ? "bg-primary/20 text-primary-foreground border-0" : ""}>
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
              <span className="text-muted-foreground">Amount Paid</span>
              <span className="font-medium text-primary">{formatCurrency(loan.amountPaid)}</span>
            </div>
            <div className="flex justify-between border-t pt-4">
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

              return (
                <div
                  key={item.id}
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
                      <p className="text-sm text-muted-foreground">
                        Due: {new Date(item.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(item.amount)}</p>
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
