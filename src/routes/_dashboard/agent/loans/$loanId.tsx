import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { getLoan } from '@/server/loans'
import { recordPayment } from '@/server/payments'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { AccessDenied } from '@/components/access-denied'
import { hasRole, ROLES } from '@/lib/constants/roles'
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils'
import { formatRelativeDate } from '@/lib/utils/date'
import { useState } from 'react'
import {
  ArrowLeft,
  User,
  CalendarCheck,
  Receipt,
  Check,
  Clock,
  Warning,
  Phone,
  Spinner,
  X,
} from '@phosphor-icons/react'

export const Route = createFileRoute('/_dashboard/agent/loans/$loanId')({
  loader: async ({ params, context }) => {
    const { session } = context as {
      session: { user: { role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.AGENT)) {
      return { loan: null, unauthorized: true }
    }
    try {
      const loan = await getLoan({ data: params.loanId })
      if (loan.isLender) {
        return { loan: null, unauthorized: true }
      }
      return { loan, unauthorized: false }
    } catch {
      return { loan: null, unauthorized: false }
    }
  },
  component: AgentLoanDetailPage,
})

function AgentLoanDetailPage() {
  const { loan, unauthorized } = Route.useLoaderData()
  const router = useRouter()

  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'cash' | 'gcash' | 'maya' | 'bank'>(
    'cash',
  )
  const [notes, setNotes] = useState('')
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(
    null,
  )

  if (unauthorized) {
    return (
      <AccessDenied
        title="Agent Portal"
        message="You need to be an agent to access this portal."
        homeLink="/dashboard"
        homeLinkLabel="Go to Dashboard"
      />
    )
  }

  if (!loan) {
    return (
      <AccessDenied
        title="Loan Not Found"
        message="This loan doesn't exist or isn't assigned to you."
        homeLink="/agent/loans"
        homeLinkLabel="Back to Loans"
      />
    )
  }

  const principal = parseFloat(loan.principal)
  const totalToRepay = parseFloat(loan.totalToRepay)
  const amountPaid = parseFloat(loan.amountPaid)
  const remaining = parseFloat(loan.remainingBalance)
  const progress = totalToRepay > 0 ? (amountPaid / totalToRepay) * 100 : 0

  const pendingSchedule = loan.schedule.filter(
    (s) =>
      s.status === 'pending' ||
      s.status === 'partial' ||
      s.status === 'overdue',
  )

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedScheduleId) return
    setLoading(true)

    try {
      await recordPayment({
        data: {
          loanId: loan.id,
          amount: parseFloat(amount),
          method,
          scheduleItemId: selectedScheduleId,
          notes: notes || undefined,
        },
      })
      toast.success('Payment recorded successfully')
      setShowPaymentForm(false)
      setAmount('')
      setNotes('')
      setSelectedScheduleId(null)
      router.invalidate()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to record payment',
      )
    } finally {
      setLoading(false)
    }
  }

  const statusColors: Record<string, string> = {
    pending_disbursement: 'outline',
    active: 'secondary',
    completed: 'default',
    defaulted: 'destructive',
  }

  const scheduleStatusColors: Record<string, string> = {
    pending: 'outline',
    partial: 'secondary',
    paid: 'default',
    overdue: 'destructive',
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/agent/loans">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl md:text-3xl font-bold tracking-tight truncate">
              {loan.contact.name}
            </h1>
            <Badge
              variant={statusColors[loan.status] as any}
              className="text-xs shrink-0"
            >
              {loan.status.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatCurrencyCompact(principal)} · {loan.interestRate}% ·{' '}
            {loan.termMonths}mo
          </p>
        </div>
        {loan.status === 'active' && (
          <Button
            onClick={() => setShowPaymentForm(true)}
            size="sm"
            className="gap-1 shrink-0"
          >
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Record</span>
          </Button>
        )}
      </div>

      {/* Contact Quick Info */}
      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium text-sm truncate">
              {loan.contact.name}
            </span>
            {loan.contact.phone && (
              <a
                href={`tel:${loan.contact.phone}`}
                className="flex items-center gap-1 text-primary hover:underline text-sm shrink-0"
              >
                <Phone className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{loan.contact.phone}</span>
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment Form */}
      {showPaymentForm && (
        <Card className="border-primary">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Record Payment</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setShowPaymentForm(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="amount" className="text-sm">
                    Amount
                  </Label>
                  <CurrencyInput
                    id="amount"
                    value={amount}
                    onValueChange={setAmount}
                    placeholder="1,000"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="method" className="text-sm">
                    Method
                  </Label>
                  <Select
                    value={method}
                    onValueChange={(v) => setMethod(v as any)}
                  >
                    <SelectTrigger>
                      {
                        {
                          cash: 'Cash',
                          gcash: 'GCash',
                          maya: 'Maya',
                          bank: 'Bank',
                        }[method]
                      }
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="gcash">GCash</SelectItem>
                      <SelectItem value="maya">Maya</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-sm">Schedule Item</Label>
                  {pendingSchedule.length > 0 ? (
                    <Select
                      value={selectedScheduleId || ''}
                      onValueChange={setSelectedScheduleId}
                    >
                      <SelectTrigger className="text-sm">
                        {selectedScheduleId
                          ? `Due ${formatRelativeDate(pendingSchedule.find((s) => s.id === selectedScheduleId)?.dueDate || '')}`
                          : 'Select a schedule item...'}
                      </SelectTrigger>
                      <SelectContent>
                        {pendingSchedule.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {formatRelativeDate(s.dueDate)} -{' '}
                            {formatCurrencyCompact(s.amount)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      All payments are complete
                    </p>
                  )}
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="notes" className="text-sm">
                    Notes (optional)
                  </Label>
                  <Input
                    id="notes"
                    placeholder="Notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPaymentForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={loading || !amount || !selectedScheduleId}>
                  {loading ? (
                    <>
                      <Spinner className="h-4 w-4 animate-spin mr-1" />
                      Recording...
                    </>
                  ) : (
                    'Record'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Progress Card */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base md:text-lg">Progress</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Paid</span>
              <span className="font-medium">
                {formatCurrencyCompact(amountPaid)} /{' '}
                {formatCurrencyCompact(totalToRepay)}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{Math.round(progress)}% complete</span>
              <span>{formatCurrencyCompact(remaining)} left</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t">
            <div>
              <p className="text-xs text-muted-foreground">Principal</p>
              <p className="font-semibold">
                {formatCurrencyCompact(principal)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Interest</p>
              <p className="font-semibold">
                {formatCurrencyCompact(totalToRepay - principal)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Schedule */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <CalendarCheck className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {loan.schedule.length > 0 ? (
            <div className="space-y-2">
              {loan.schedule.map((item) => {
                const StatusIcon =
                  item.status === 'paid'
                    ? Check
                    : item.status === 'overdue'
                      ? Warning
                      : Clock

                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-2 md:p-3 rounded border ${
                      item.status === 'overdue'
                        ? 'border-destructive/50 bg-destructive/5'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <StatusIcon
                        className={`h-4 w-4 shrink-0 ${
                          item.status === 'paid'
                            ? 'text-primary'
                            : item.status === 'overdue'
                              ? 'text-destructive'
                              : 'text-muted-foreground'
                        }`}
                        weight={item.status === 'paid' ? 'fill' : 'regular'}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">
                          {formatRelativeDate(item.dueDate)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <div className="text-right">
                        <p className="font-semibold text-sm">
                          {formatCurrencyCompact(item.amount)}
                        </p>
                        {item.status === 'partial' && (
                          <p className="text-xs text-muted-foreground">
                            Paid: {formatCurrencyCompact(item.paidAmount)}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={scheduleStatusColors[item.status] as any}
                        className="text-xs"
                      >
                        {item.status}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-6 text-sm">
              No payment schedule
            </p>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Receipt className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {loan.payments.length > 0 ? (
            <div className="space-y-2">
              {loan.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-2 md:p-3 rounded border"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="h-4 w-4 text-primary" weight="bold" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">
                        {new Date(payment.paidAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        via {payment.method.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="font-semibold text-sm text-primary">
                      +{formatCurrencyCompact(payment.amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-6 text-sm">
              No payments yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
