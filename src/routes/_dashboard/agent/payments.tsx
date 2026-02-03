import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { getAgentPayments, getAgentUpcomingPayments } from '@/server/agents'
import { recordPayment } from '@/server/payments'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { AccessDenied } from '@/components/access-denied'
import { hasRole, ROLES } from '@/lib/constants/roles'
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils'
import { useState } from 'react'
import {
  Receipt,
  Clock,
  Warning,
  Phone,
  Check,
  Spinner,
  CurrencyCircleDollar,
  X,
} from '@phosphor-icons/react'
import { formatRelativeDate } from '@/lib/utils/date'

export const Route = createFileRoute('/_dashboard/agent/payments')({
  loader: async ({ context }) => {
    const { session } = context as {
      session: { user: { role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.AGENT)) {
      return { payments: [], upcoming: [], unauthorized: true }
    }
    const [payments, upcoming] = await Promise.all([
      getAgentPayments(),
      getAgentUpcomingPayments(),
    ])
    return { payments, upcoming, unauthorized: false }
  },
  component: AgentPaymentsPage,
})

function AgentPaymentsPage() {
  const { payments, upcoming, unauthorized } = Route.useLoaderData()
  const router = useRouter()

  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [selectedScheduleItem, setSelectedScheduleItem] = useState<
    (typeof upcoming)[0] | null
  >(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  // Form state
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'cash' | 'gcash' | 'maya' | 'bank'>(
    'cash',
  )
  const [notes, setNotes] = useState('')

  const overduePayments = upcoming.filter((p) => p.status === 'overdue')
  const upcomingPayments = upcoming.filter((p) => p.status !== 'overdue')

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedScheduleItem) return

    setError('')
    setLoading(true)

    try {
      await recordPayment({
        data: {
          loanId: selectedScheduleItem.loanId,
          amount: parseFloat(amount),
          method,
          scheduleItemId: selectedScheduleItem.id,
          notes: notes || undefined,
        },
      })

      setShowPaymentForm(false)
      setSelectedScheduleItem(null)
      setAmount('')
      setMethod('cash')
      setNotes('')

      toast.success('Payment recorded successfully')
      router.invalidate()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to record payment',
      )
      setError(err instanceof Error ? err.message : 'Failed to record payment')
    } finally {
      setLoading(false)
    }
  }

  const openPaymentForm = (item: (typeof upcoming)[0]) => {
    setSelectedScheduleItem(item)
    setAmount(item.amount)
    setShowPaymentForm(true)
  }

  const closePaymentForm = () => {
    setShowPaymentForm(false)
    setSelectedScheduleItem(null)
    setAmount('')
    setNotes('')
    setError('')
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight">
          Payments
        </h1>
        <p className="text-sm text-muted-foreground hidden sm:block">
          Collect and record payments for your assigned loans
        </p>
      </div>

      {/* Stats - 3 column on mobile */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">
              Overdue
            </CardTitle>
            <Warning className="h-3.5 w-3.5 md:h-4 md:w-4 text-destructive" />
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-lg md:text-2xl font-bold text-destructive">
              {overduePayments.length}
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              {formatCurrencyCompact(
                overduePayments.reduce((s, p) => s + parseFloat(p.amount), 0),
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">
              Due Soon
            </CardTitle>
            <Clock className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-lg md:text-2xl font-bold">
              {upcomingPayments.length}
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              {formatCurrencyCompact(
                upcomingPayments.reduce((s, p) => s + parseFloat(p.amount), 0),
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">
              Collected
            </CardTitle>
            <Receipt className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-lg md:text-2xl font-bold">
              {payments.length}
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              {formatCurrencyCompact(
                payments.reduce((s, p) => s + parseFloat(p.amount), 0),
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payment Form Modal */}
      {showPaymentForm && selectedScheduleItem && (
        <Card className="border-primary">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base md:text-lg">
                  Record Payment
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  {selectedScheduleItem.contactName} · Due{' '}
                  {formatRelativeDate(selectedScheduleItem.dueDate)}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={closePaymentForm}>
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
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-sm">
                  Notes (optional)
                </Label>
                <Input
                  id="notes"
                  type="text"
                  placeholder="Any additional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={closePaymentForm}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={loading}>
                  {loading ? (
                    <>
                      <Spinner className="h-4 w-4 animate-spin mr-1" />
                      Recording...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Record
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Overdue Payments */}
      {overduePayments.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-destructive text-base md:text-lg">
              <Warning className="h-4 w-4 md:h-5 md:w-5" />
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-2">
              {overduePayments.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 md:p-3 rounded border border-destructive/30 bg-destructive/5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">
                      {item.contactName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeDate(item.dueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="font-semibold text-sm">
                      {formatCurrencyCompact(item.amount)}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => openPaymentForm(item)}
                      className="h-7 text-xs"
                    >
                      Collect
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Payments */}
      {upcomingPayments.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Clock className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              Upcoming
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-2">
              {upcomingPayments.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 md:p-3 rounded border"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">
                      {item.contactName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeDate(item.dueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="font-semibold text-sm">
                      {formatCurrencyCompact(item.amount)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openPaymentForm(item)}
                      className="h-7 text-xs"
                    >
                      Collect
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No upcoming payments */}
      {upcoming.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Clock className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <h3 className="text-base font-semibold mb-1">
              No upcoming payments
            </h3>
            <p className="text-muted-foreground text-xs text-center max-w-md">
              No payments due in the next 30 days.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      {payments.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base md:text-lg">History</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-2">
              {payments.slice(0, 10).map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">
                      {payment.contactName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(payment.paidAt).toLocaleDateString()} ·{' '}
                      {payment.method.toUpperCase()}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="font-semibold text-sm">
                      {formatCurrencyCompact(payment.amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
