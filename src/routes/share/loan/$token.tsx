import { createFileRoute } from "@tanstack/react-router"
import { getPublicLoanByToken } from "@/server/loans"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoonaBrand, FloatingCircle } from "@/components/ui/loona-brand"
import { Stagger, StaggerItem } from "@/components/ui/stagger"
import {
  CheckCircle,
  Clock,
  Warning,
  CurrencyCircleDollar,
  CalendarBlank,
  Receipt,
  ShieldCheck,
  QrCode,
} from "@phosphor-icons/react"
import { motion } from "framer-motion"
import { format, formatDistanceToNow } from "date-fns"

export const Route = createFileRoute("/share/loan/$token")({
  loader: async ({ params }) => {
    try {
      const loan = await getPublicLoanByToken({ data: params.token })
      return { loan }
    } catch {
      return { loan: null }
    }
  },
  component: BorrowerLoanPortal,
})

function fmt(n: string | number) {
  return `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  semimonthly: "Semi-monthly",
  monthly: "Monthly",
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  paid: { label: "Paid", color: "text-green-600 dark:text-green-400", icon: CheckCircle },
  pending: { label: "Upcoming", color: "text-muted-foreground", icon: Clock },
  partial: { label: "Partial", color: "text-primary", icon: Clock },
  overdue: { label: "Overdue", color: "text-destructive", icon: Warning },
}

function BorrowerLoanPortal() {
  const { loan } = Route.useLoaderData()

  if (!loan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-page p-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-3">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mx-auto">
            <ShieldCheck className="h-7 w-7 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold">Link Not Available</h1>
          <p className="text-sm text-muted-foreground max-w-xs">This loan link is invalid or has expired.</p>
        </motion.div>
      </div>
    )
  }

  const progress = Number(loan.totalToRepay) > 0
    ? Math.min(100, (Number(loan.amountPaid) / Number(loan.totalToRepay)) * 100)
    : 0

  const isCompleted = loan.status === "completed"

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left panel — branding (desktop) */}
      <div className="hidden md:flex md:w-[380px] bg-gradient-to-br from-primary via-primary to-primary/80 p-10 flex-col items-center justify-center relative overflow-hidden shrink-0">
        <FloatingCircle className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" delay={0} duration={8} />
        <FloatingCircle className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" delay={0.5} duration={7} />

        <motion.div
          className="relative z-10 flex flex-col items-center text-center space-y-6 max-w-xs"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <LoonaBrand size="lg" variant="white" animated />

          <div className="space-y-2 pt-4">
            <p className="text-white/60 text-xs uppercase tracking-wider font-medium">Your Loan With</p>
            <h2 className="text-2xl font-bold text-white">{loan.lenderName}</h2>
          </div>

          {/* Big progress ring */}
          <div className="relative h-32 w-32">
            <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
              <circle
                cx="60" cy="60" r="52" fill="none" stroke="white" strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 52}`}
                strokeDashoffset={`${2 * Math.PI * 52 * (1 - progress / 100)}`}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-white">{Math.round(progress)}%</span>
              <span className="text-xs text-white/60">paid</span>
            </div>
          </div>

          <div className="space-y-1 text-white/80 text-sm">
            <p>{loan.paidCount} of {loan.totalScheduleItems} payments completed</p>
            {loan.overdueCount > 0 && (
              <p className="text-red-300 font-medium">{loan.overdueCount} overdue</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Right panel — content */}
      <div className="flex-1 overflow-y-auto">
        {/* Mobile header */}
        <div className="md:hidden bg-gradient-to-r from-primary to-primary/80 px-6 py-5 text-center">
          <LoonaBrand size="sm" variant="white" />
          <p className="text-white/70 text-xs mt-2">Your loan with</p>
          <p className="text-white font-semibold">{loan.lenderName}</p>
        </div>

        <Stagger className="max-w-lg mx-auto px-4 sm:px-6 py-6 space-y-5">
          {/* Greeting */}
          <StaggerItem>
            <h1 className="text-xl font-bold tracking-tight">Hi, {loan.borrowerName.split(" ")[0]}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Here's a summary of your loan.</p>
          </StaggerItem>

          {/* Total Due / Completed banner */}
          <StaggerItem>
            {isCompleted ? (
              <div className="rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 p-5 text-center">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400 mx-auto mb-2" weight="bold" />
                <p className="font-semibold text-green-700 dark:text-green-400">Loan Fully Paid!</p>
                <p className="text-xs text-green-600/80 dark:text-green-400/60 mt-1">Congratulations, you've completed all payments.</p>
              </div>
            ) : (loan.overdueAmount > 0 || loan.totalPenalties > 0) ? (
              <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">Total Amount Due</p>
                    <p className="text-3xl font-bold mt-1 text-red-700 dark:text-red-300">
                      {fmt(loan.overdueAmount + loan.totalPenalties)}
                    </p>
                  </div>
                  <Warning className="h-10 w-10 text-red-400 shrink-0 mt-1" weight="duotone" />
                </div>
                <div className="space-y-2 border-t border-red-200 dark:border-red-800 pt-3">
                  {loan.overdueAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-red-600/80 dark:text-red-400/70">
                        Overdue payments ({loan.overdueCount})
                      </span>
                      <span className="font-semibold text-red-700 dark:text-red-300">{fmt(loan.overdueAmount)}</span>
                    </div>
                  )}
                  {loan.totalPenalties > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-red-600/80 dark:text-red-400/70">Penalties</span>
                      <span className="font-semibold text-red-700 dark:text-red-300">{fmt(loan.totalPenalties)}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : loan.nextPayment ? (
              <div className="rounded-xl p-5 border bg-primary/5 border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Next Payment</p>
                    <p className="text-2xl font-bold mt-1">{fmt(loan.nextPayment.amount)}</p>
                    <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <CalendarBlank className="h-3.5 w-3.5" />
                      {format(new Date(loan.nextPayment.dueDate), "MMMM d, yyyy")}
                    </p>
                  </div>
                  <CurrencyCircleDollar className="h-10 w-10 text-primary/30 shrink-0" weight="duotone" />
                </div>
              </div>
            ) : null}
          </StaggerItem>

          {/* Loan Summary */}
          <StaggerItem>
            <Card className="rounded-xl shadow-sm">
              <CardContent className="p-5">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Principal</p>
                    <p className="font-semibold mt-0.5">{fmt(loan.principal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total to Repay</p>
                    <p className="font-semibold mt-0.5">{fmt(loan.totalToRepay)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Amount Paid</p>
                    <p className="font-semibold mt-0.5 text-green-600 dark:text-green-400">{fmt(loan.amountPaid)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Remaining</p>
                    <p className="font-bold mt-0.5">{fmt(loan.remainingBalance)}</p>
                  </div>
                </div>
                {/* Progress bar — mobile */}
                <div className="mt-4 md:hidden">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Progress</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                  <div>
                    <span>{loan.interestRate}% / mo</span>
                  </div>
                  <div>
                    <span>{loan.termMonths} months</span>
                  </div>
                  <div>
                    <span>{FREQUENCY_LABELS[loan.paymentFrequency] ?? loan.paymentFrequency}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>

          {/* Payment Schedule */}
          <StaggerItem>
            <Card className="rounded-xl shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarBlank className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Payment Schedule</h3>
                </div>
                <div className="space-y-1.5">
                  {loan.schedule.map((item, i) => {
                    const config = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending
                    const StatusIcon = config.icon
                    return (
                      <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
                        <StatusIcon className={`h-4 w-4 shrink-0 ${config.color}`} weight="bold" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">Payment #{i + 1}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(item.dueDate), "MMM d, yyyy")}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">{fmt(item.amount)}</p>
                          {item.status === "paid" && item.paidAt && (
                            <p className="text-[10px] text-green-600 dark:text-green-400">
                              Paid {format(new Date(item.paidAt), "MMM d")}
                            </p>
                          )}
                          {item.status === "overdue" && (
                            <p className="text-[10px] text-destructive">Overdue</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </StaggerItem>

          {/* Recent Payments */}
          {loan.payments.length > 0 && (
            <StaggerItem>
              <Card className="rounded-xl shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Recent Payments</h3>
                  </div>
                  <div className="space-y-1.5">
                    {loan.payments.map((p, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{fmt(p.amount)}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(p.paidAt), "MMM d, yyyy")} · {p.method.toUpperCase()}</p>
                        </div>
                        <Badge variant="secondary" className="text-[10px]">{p.type === "credit" ? "Payment" : "Debit"}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          )}


          {/* QR Payment Codes */}
          {loan.qrCodes.length > 0 && (
            <StaggerItem>
              <Card className="rounded-xl shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <QrCode className="h-4 w-4 text-muted-foreground" weight="duotone" />
                    <h3 className="text-sm font-semibold">Pay via QR Code</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">Scan any code below to pay instantly.</p>
                  <div className="flex flex-col items-center gap-6">
                    {loan.qrCodes.map((qr, i) => (
                      <div key={i} className="flex flex-col items-center gap-2">
                        <img
                          src={qr.imageData}
                          alt={`${qr.label} QR Code`}
                          className="w-52 h-52 object-contain border-2 rounded-xl bg-white p-2"
                        />
                        <p className="text-sm font-semibold">{qr.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          )}

          {/* Footer */}
          <StaggerItem className="text-center pb-4">
            <p className="text-xs text-muted-foreground">
              <ShieldCheck className="h-3 w-3 inline-block mr-1" weight="bold" />
              Powered by Loona · This page is private to you.
            </p>
          </StaggerItem>
        </Stagger>
      </div>
    </div>
  )
}
