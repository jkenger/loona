import { createFileRoute } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import { getContacts } from "@/server/contacts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { SkeletonFormPage } from "@/components/ui/skeleton"
import { AccessDenied } from "@/components/access-denied"
import { Stagger, StaggerItem } from "@/components/ui/stagger"
import { InterestRateWarning } from "@/components/interest-rate-warning"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { calculatePaymentsCount, type PaymentFrequency } from "@/lib/utils/loan-math"
import { calculateEIR, formatEIR } from "@/lib/utils/eir"
import {
  Calculator,
  User,
  Info,
  CheckCircle,
  Warning,
  WarningOctagon,
  X,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_dashboard/tools/estimator")({
  loader: async ({ context }) => {
    const { session } = context as {
      session: { user: { role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      return { contacts: [], unauthorized: true }
    }
    const contacts = await getContacts()
    return { contacts, unauthorized: false }
  },
  pendingComponent: SkeletonFormPage,
  component: EstimatorPage,
})

const FREQUENCY_LABELS: Record<PaymentFrequency, string> = {
  monthly: "Monthly",
  semimonthly: "Semi-monthly",
  biweekly: "Bi-weekly",
  weekly: "Weekly",
  daily: "Daily",
}

function EstimatorPage() {
  const { contacts, unauthorized } = Route.useLoaderData()

  // Inputs — core loan params first
  const [principal, setPrincipal] = useState("")
  const [interestRate, setInterestRate] = useState("5")
  const [termMonths, setTermMonths] = useState("3")
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>("monthly")

  // Optional affordability inputs
  const [contactId, setContactId] = useState("")
  const [income, setIncome] = useState("")

  if (unauthorized) {
    return (
      <AccessDenied
        message="Only lenders can access the estimator."
        homeLink="/dashboard"
        homeLinkLabel="Go to Dashboard"
      />
    )
  }

  const selectedContact = contacts.find((c) => c.id === contactId)

  const handleContactChange = (id: string | null) => {
    if (!id) return
    setContactId(id)
    const contact = contacts.find((c) => c.id === id)
    if (contact?.income) {
      setIncome(contact.income)
    }
  }

  const clearContact = () => {
    setContactId("")
  }

  // All calculations are client-side and real-time
  const calc = useMemo(() => {
    const p = parseFloat(principal) || 0
    const r = parseFloat(interestRate) || 0
    const t = parseInt(termMonths) || 0
    const inc = parseFloat(income) || 0

    if (p <= 0 || t <= 0) {
      return null
    }

    const totalInterest = p * (r / 100) * t
    const totalToRepay = p + totalInterest
    const paymentsCount = calculatePaymentsCount(t, paymentFrequency)
    const paymentAmount = totalToRepay / paymentsCount

    // Maturity date
    const maturityDate = new Date()
    maturityDate.setMonth(maturityDate.getMonth() + t)

    // EIR
    const eir = calculateEIR({
      principal: p,
      totalInterest,
      termMonths: t,
      paymentFrequency,
    })

    // Affordability (only when income > 0)
    let affordability = null
    if (inc > 0) {
      const paymentPercent = (paymentAmount / inc) * 100
      let rating: "comfortable" | "stretched" | "heavy"
      let color: "green" | "yellow" | "red"
      if (paymentPercent <= 30) {
        rating = "comfortable"
        color = "green"
      } else if (paymentPercent <= 50) {
        rating = "stretched"
        color = "yellow"
      } else {
        rating = "heavy"
        color = "red"
      }
      affordability = {
        paymentPercent,
        rating,
        color,
        monthlyRemaining: inc - paymentAmount,
      }
    }

    return {
      totalInterest,
      totalToRepay,
      paymentsCount,
      paymentAmount,
      maturityDate,
      eir,
      affordability,
    }
  }, [principal, interestRate, termMonths, paymentFrequency, income])

  return (
    <div>
      {/* Dark header */}
      <div className="bg-[hsl(215_45%_14%)] text-white py-4 pb-12">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Calculator className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-semibold">Loan Estimator</h1>
          </div>
          <p className="text-blue-200/70 text-sm mt-1">
            Quick what-if calculator — no loan created
          </p>
        </div>
      </div>

      {/* Content overlapping header */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-6 pb-8">
        <Stagger className="grid gap-6 lg:grid-cols-5">
          {/* ── Inputs ── */}
          <StaggerItem className="lg:col-span-3">
            <Card className="shadow-lg">
              <CardHeader className="p-4 pb-2">
                <CardTitle>Loan Parameters</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-5">
                {/* Principal & Interest Rate */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="principal">Principal Amount</Label>
                    <CurrencyInput
                      id="principal"
                      value={principal}
                      onValueChange={setPrincipal}
                      placeholder="10,000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interestRate">Interest Rate</Label>
                    <div className="relative">
                      <Input
                        id="interestRate"
                        type="number"
                        min="0"
                        max="15"
                        step="0.5"
                        placeholder="5"
                        value={interestRate}
                        onChange={(e) => setInterestRate(e.target.value)}
                        className="pr-16"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        % / mo
                      </span>
                    </div>
                  </div>
                </div>

                {/* InterestRateWarning */}
                <InterestRateWarning rate={interestRate} />

                {/* Term & Frequency */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="termMonths">Term</Label>
                    <div className="relative">
                      <Input
                        id="termMonths"
                        type="number"
                        min="1"
                        max="60"
                        placeholder="3"
                        value={termMonths}
                        onChange={(e) => setTermMonths(e.target.value)}
                        className="pr-20"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        months
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paymentFrequency">Payment Frequency</Label>
                    <Select
                      value={paymentFrequency}
                      onValueChange={(v) => setPaymentFrequency(v as PaymentFrequency)}
                    >
                      <SelectTrigger>
                        {FREQUENCY_LABELS[paymentFrequency]}
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

                {/* Divider */}
                <div className="border-t" />

                {/* Affordability section */}
                <p className="text-xs text-muted-foreground">
                  Optional — for affordability check
                </p>
                <div className="grid gap-4 sm:grid-cols-2 -mt-2">
                  {/* Borrower Picker */}
                  <div className="space-y-2">
                    <Label>Borrower</Label>
                    {selectedContact ? (
                      <div className="flex h-9 items-center justify-between rounded-md border border-input bg-transparent px-3 text-sm">
                        <span className="inline-flex items-center gap-2 truncate">
                          <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{selectedContact.name}</span>
                          {selectedContact.income && (
                            <span className="text-muted-foreground text-xs shrink-0">
                              ({formatCurrency(parseFloat(selectedContact.income))}/mo)
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={clearContact}
                          className="ml-2 shrink-0 rounded-sm p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <Select
                        value={contactId}
                        onValueChange={handleContactChange}
                      >
                        <SelectTrigger>
                          <span className="text-muted-foreground">
                            Select borrower...
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {contacts.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              <span className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                {c.name}
                                {c.income && (
                                  <span className="text-muted-foreground text-xs">
                                    ({formatCurrency(parseFloat(c.income))}/mo)
                                  </span>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Net Income */}
                  <div className="space-y-2">
                    <Label htmlFor="income">Net Monthly Income</Label>
                    <CurrencyInput
                      id="income"
                      value={income}
                      onValueChange={setIncome}
                      placeholder="0"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>

          {/* ── Results ── */}
          <StaggerItem className="lg:col-span-2">
            <div className="space-y-6">
              {/* Estimate Card */}
              <Card className="shadow-lg">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-primary" />
                    Estimate
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {calc ? (
                    <div className="space-y-4">
                      {/* Hero: Payment Amount */}
                      <div className="text-center py-3">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                          Payment Amount
                        </p>
                        <p className="text-3xl font-bold text-primary">
                          {formatCurrency(calc.paymentAmount)}
                          <span className="text-base font-normal text-muted-foreground">
                            /{paymentFrequency === "monthly" ? "mo" : paymentFrequency === "semimonthly" ? "2×mo" : paymentFrequency === "biweekly" ? "2wk" : paymentFrequency === "weekly" ? "wk" : "day"}
                          </span>
                        </p>
                      </div>

                      <div className="border-t" />

                      {/* Detail rows */}
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Interest</span>
                          <span className="font-medium">{formatCurrency(calc.totalInterest)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="font-semibold">Total to Repay</span>
                          <span className="font-bold">{formatCurrency(calc.totalToRepay)}</span>
                        </div>
                      </div>

                      <div className="border-t" />

                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Payments</span>
                          <span className="font-medium">{calc.paymentsCount}×</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Maturity</span>
                          <span className="font-medium">
                            {calc.maturityDate.toLocaleDateString("en-PH", {
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground relative group/eir cursor-help">
                            EIR
                            <Info className="inline h-3 w-3 ml-1 opacity-50 group-hover/eir:opacity-100" />
                            <span className="absolute bottom-full left-0 mb-2 w-64 rounded-md border bg-popover p-3 text-popover-foreground shadow-md opacity-0 pointer-events-none group-hover/eir:opacity-100 group-hover/eir:pointer-events-auto transition-opacity z-50">
                              <span className="block text-xs text-muted-foreground leading-relaxed">
                                The Effective Interest Rate shows the true annual cost of borrowing, accounting for payment frequency and timing.
                              </span>
                            </span>
                          </span>
                          <span className="font-medium text-primary">{formatEIR(calc.eir)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Calculator className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Enter a principal amount and term to see estimates
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Affordability Card */}
              {calc?.affordability && (
                <Card className={cn(
                  "shadow-lg border-2",
                  calc.affordability.color === "green" && "border-green-500/30",
                  calc.affordability.color === "yellow" && "border-amber-500/30",
                  calc.affordability.color === "red" && "border-red-500/30",
                )}>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {calc.affordability.color === "green" && (
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" weight="fill" />
                      )}
                      {calc.affordability.color === "yellow" && (
                        <Warning className="h-5 w-5 text-amber-600 dark:text-amber-400" weight="fill" />
                      )}
                      {calc.affordability.color === "red" && (
                        <WarningOctagon className="h-5 w-5 text-red-600 dark:text-red-400" weight="fill" />
                      )}
                      Affordability
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-4">
                    {/* Progress bar */}
                    <AffordabilityBar percent={calc.affordability.paymentPercent} />

                    {/* Rating + stats */}
                    <div className="flex items-center justify-between">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium",
                        calc.affordability.color === "green" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
                        calc.affordability.color === "yellow" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
                        calc.affordability.color === "red" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
                      )}>
                        {calc.affordability.paymentPercent.toFixed(1)}% —{" "}
                        {calc.affordability.rating === "comfortable" && "Comfortable"}
                        {calc.affordability.rating === "stretched" && "Stretched"}
                        {calc.affordability.rating === "heavy" && "Heavy"}
                      </div>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Remaining</span>
                      <span className={cn(
                        "font-medium",
                        calc.affordability.monthlyRemaining < 0 && "text-red-600 dark:text-red-400",
                      )}>
                        {formatCurrency(calc.affordability.monthlyRemaining)}/mo
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {calc.affordability.rating === "comfortable" &&
                        "Low risk of default from cash flow. Payment is within a comfortable range of the borrower's income."}
                      {calc.affordability.rating === "stretched" &&
                        "Manageable but tight. The borrower may struggle if unexpected expenses arise."}
                      {calc.affordability.rating === "heavy" &&
                        "High risk. The borrower may struggle to meet payments consistently at this level."}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </StaggerItem>
        </Stagger>
      </div>
    </div>
  )
}

/* ─── Affordability progress bar ─── */

function AffordabilityBar({ percent }: { percent: number }) {
  // Clamp display to 100% max for the bar
  const clamped = Math.min(percent, 100)

  return (
    <div className="space-y-1">
      {/* Zone labels */}
      <div className="flex text-[10px] text-muted-foreground">
        <span style={{ width: "30%" }} className="text-left">Comfortable</span>
        <span style={{ width: "20%" }} className="text-center">Stretched</span>
        <span style={{ width: "50%" }} className="text-right">Heavy</span>
      </div>
      {/* Bar */}
      <div className="relative h-3 rounded-full overflow-hidden bg-muted">
        {/* Green zone: 0-30% */}
        <div
          className="absolute inset-y-0 left-0 bg-green-500/30"
          style={{ width: "30%" }}
        />
        {/* Yellow zone: 30-50% */}
        <div
          className="absolute inset-y-0 bg-amber-500/30"
          style={{ left: "30%", width: "20%" }}
        />
        {/* Red zone: 50-100% */}
        <div
          className="absolute inset-y-0 bg-red-500/30"
          style={{ left: "50%", width: "50%" }}
        />
        {/* Marker */}
        <div
          className={cn(
            "absolute top-0 h-full w-1 rounded-full transition-all duration-300",
            clamped <= 30 && "bg-green-600 dark:bg-green-400",
            clamped > 30 && clamped <= 50 && "bg-amber-600 dark:bg-amber-400",
            clamped > 50 && "bg-red-600 dark:bg-red-400",
          )}
          style={{ left: `${clamped}%`, transform: "translateX(-50%)" }}
        />
      </div>
      {/* Tick marks */}
      <div className="flex text-[10px] text-muted-foreground/50">
        <span style={{ width: "30%" }} className="text-right">30%</span>
        <span style={{ width: "20%" }} className="text-right">50%</span>
      </div>
    </div>
  )
}

/* ─── Helpers ─── */

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}
