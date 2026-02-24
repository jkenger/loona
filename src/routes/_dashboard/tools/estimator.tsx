import { createFileRoute, Link } from "@tanstack/react-router"
import { useState, useMemo, useEffect } from "react"
import { z } from "zod"
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
  ChartBar,
  User,
  Info,
  Warning,
  X,
  ArrowRight,
} from "@phosphor-icons/react"
import { LendingTip } from "@/components/lending-tip"
import { cn } from "@/lib/utils"

const searchSchema = z.object({
  principal: z.string().optional(),
  interestRate: z.string().optional(),
  termMonths: z.string().optional(),
  paymentFrequency: z.enum(["daily", "weekly", "biweekly", "semimonthly", "monthly"]).optional(),
  contactId: z.string().optional(),
})

export const Route = createFileRoute("/_dashboard/tools/estimator")({
  validateSearch: searchSchema,
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

const FREQUENCY_TO_MONTHLY: Record<PaymentFrequency, number> = {
  monthly: 1,
  semimonthly: 2,
  biweekly: 2,
  weekly: 4,
  daily: 30,
}

function EstimatorPage() {
  const { contacts, unauthorized } = Route.useLoaderData()
  const search = Route.useSearch()

  // Inputs — core loan params first (prefill from search params)
  const [principal, setPrincipal] = useState(search.principal ?? "")
  const [interestRate, setInterestRate] = useState(search.interestRate ?? "5")
  const [termMonths, setTermMonths] = useState(search.termMonths ?? "3")
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>(search.paymentFrequency ?? "monthly")

  // Optional affordability inputs
  const [contactId, setContactId] = useState(search.contactId ?? "")
  const [basicPay, setBasicPay] = useState("")
  const [otherIncome, setOtherIncome] = useState("")

  // Auto-populate income when contactId comes from search params
  const [contactInitialized, setContactInitialized] = useState(false)
  useEffect(() => {
    if (contactInitialized || !search.contactId) return
    const contact = contacts.find((c) => c.id === search.contactId)
    if (contact) {
      if (contact.income) setBasicPay(contact.income)
      if (contact.otherIncome) setOtherIncome(contact.otherIncome)
      setContactInitialized(true)
    }
  }, [search.contactId, contacts, contactInitialized])
  const income = String((parseFloat(basicPay) || 0) + (parseFloat(otherIncome) || 0))

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
      setBasicPay(contact.income)
    }
    if (contact?.otherIncome) {
      setOtherIncome(contact.otherIncome)
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

    // DTI (only when income > 0)
    const proposedMonthly = paymentAmount * FREQUENCY_TO_MONTHLY[paymentFrequency]
    let dti = null
    if (inc > 0) {
      const existingObligation = parseFloat(selectedContact?.monthlyObligation ?? "0")
      const totalMonthlyDebt = existingObligation + proposedMonthly
      const dtiRatio = (totalMonthlyDebt / inc) * 100
      let rating: "comfortable" | "stretched" | "heavy"
      let color: "green" | "yellow" | "red"
      if (dtiRatio <= 30) {
        rating = "comfortable"
        color = "green"
      } else if (dtiRatio <= 50) {
        rating = "stretched"
        color = "yellow"
      } else {
        rating = "heavy"
        color = "red"
      }
      dti = {
        dtiRatio,
        rating,
        color,
        existingObligation,
        proposedMonthly,
        totalMonthlyDebt,
        monthlyRemaining: inc - totalMonthlyDebt,
      }
    }

    return {
      totalInterest,
      totalToRepay,
      paymentsCount,
      paymentAmount,
      maturityDate,
      eir,
      dti,
    }
  }, [principal, interestRate, termMonths, paymentFrequency, income, selectedContact])

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
                          {(selectedContact.income || selectedContact.otherIncome) && (
                            <span className="text-muted-foreground text-xs shrink-0">
                              ({formatCurrency((parseFloat(selectedContact.income ?? "0")) + (parseFloat(selectedContact.otherIncome ?? "0")))}/mo)
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
                                {(c.income || c.otherIncome) && (
                                  <span className="text-muted-foreground text-xs">
                                    ({formatCurrency((parseFloat(c.income ?? "0")) + (parseFloat(c.otherIncome ?? "0")))}/mo)
                                  </span>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Income */}
                  <div className="space-y-2">
                    <Label>Basic Pay</Label>
                    <CurrencyInput
                      id="basicPay"
                      value={basicPay}
                      onValueChange={setBasicPay}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 -mt-2">
                  <div className="space-y-2">
                    <Label>Other Income</Label>
                    <CurrencyInput
                      id="otherIncome"
                      value={otherIncome}
                      onValueChange={setOtherIncome}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Total Gross</Label>
                    <div className="flex h-9 items-center rounded-md border border-input bg-muted/50 px-3 text-sm">
                      {(parseFloat(basicPay) > 0 || parseFloat(otherIncome) > 0)
                        ? `${formatCurrency((parseFloat(basicPay) || 0) + (parseFloat(otherIncome) || 0))}/mo`
                        : <span className="text-muted-foreground">—</span>
                      }
                    </div>
                    {selectedContact && !selectedContact.income && !selectedContact.otherIncome && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                        <Warning className="h-3.5 w-3.5 shrink-0" weight="fill" />
                        <span>
                          No income on file — type it above, or{" "}
                          <Link
                            to="/contacts/$contactId"
                            params={{ contactId: selectedContact.id }}
                            className="underline hover:text-amber-700 dark:hover:text-amber-300"
                          >
                            add it on their profile
                          </Link>
                        </span>
                      </p>
                    )}
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
                          <span className="text-muted-foreground relative group/ti cursor-help">
                            Total Interest
                            <Info className="inline h-3 w-3 ml-1 opacity-50 group-hover/ti:opacity-100" />
                            <span className="absolute bottom-full left-0 mb-2 w-56 rounded-md border bg-popover p-3 text-popover-foreground shadow-md opacity-0 pointer-events-none group-hover/ti:opacity-100 group-hover/ti:pointer-events-auto transition-opacity z-50">
                              <span className="block text-xs text-muted-foreground leading-relaxed">
                                Principal × rate × term. Flat interest — charged on the original amount for the full term.
                              </span>
                            </span>
                          </span>
                          <span className="font-medium">{formatCurrency(calc.totalInterest)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="font-semibold relative group/tr cursor-help">
                            Total to Repay
                            <Info className="inline h-3 w-3 ml-1 opacity-50 group-hover/tr:opacity-100" />
                            <span className="absolute bottom-full left-0 mb-2 w-56 rounded-md border bg-popover p-3 text-popover-foreground shadow-md opacity-0 pointer-events-none group-hover/tr:opacity-100 group-hover/tr:pointer-events-auto transition-opacity z-50">
                              <span className="block text-xs text-muted-foreground leading-relaxed">
                                Principal + total interest. The full amount the borrower pays back over the life of the loan.
                              </span>
                            </span>
                          </span>
                          <span className="font-bold">{formatCurrency(calc.totalToRepay)}</span>
                        </div>
                      </div>

                      <div className="border-t" />

                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground relative group/pc cursor-help">
                            Payments
                            <Info className="inline h-3 w-3 ml-1 opacity-50 group-hover/pc:opacity-100" />
                            <span className="absolute bottom-full left-0 mb-2 w-56 rounded-md border bg-popover p-3 text-popover-foreground shadow-md opacity-0 pointer-events-none group-hover/pc:opacity-100 group-hover/pc:pointer-events-auto transition-opacity z-50">
                              <span className="block text-xs text-muted-foreground leading-relaxed">
                                Number of installments based on term length and payment frequency.
                              </span>
                            </span>
                          </span>
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

                      <div className="border-t" />

                      <Link
                        to="/loans/new-wizard"
                        search={{
                          ...(contactId ? { contactId } : {}),
                          principal,
                          interestRate,
                          termMonths,
                          paymentFrequency,
                        }}
                        className="flex items-center justify-center gap-2 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        Use these terms
                        <ArrowRight className="h-4 w-4" />
                      </Link>

                      <LendingTip tip="If you wouldn't borrow on these terms, don't lend on them." className="justify-center mt-3" />
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

              {/* DTI Card */}
              {calc?.dti && (
                <Card className={cn(
                  "shadow-lg border-2",
                  calc.dti.color === "green" && "border-green-500/30",
                  calc.dti.color === "yellow" && "border-amber-500/30",
                  calc.dti.color === "red" && "border-red-500/30",
                )}>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ChartBar className={cn(
                        "h-5 w-5",
                        calc.dti.color === "green" && "text-green-600 dark:text-green-400",
                        calc.dti.color === "yellow" && "text-amber-600 dark:text-amber-400",
                        calc.dti.color === "red" && "text-red-600 dark:text-red-400",
                      )} />
                      Debt-to-Income
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-4">
                    {/* Progress bar */}
                    <DtiBar percent={calc.dti.dtiRatio} />

                    {/* Rating pill */}
                    <div className="flex items-center justify-between">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium",
                        calc.dti.color === "green" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
                        calc.dti.color === "yellow" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
                        calc.dti.color === "red" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
                      )}>
                        {calc.dti.dtiRatio.toFixed(1)}% —{" "}
                        {calc.dti.rating === "comfortable" && "Comfortable"}
                        {calc.dti.rating === "stretched" && "Stretched"}
                        {calc.dti.rating === "heavy" && "Heavy"}
                      </div>
                    </div>

                    {/* Breakdown rows */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground relative group/eo cursor-help">
                          Existing obligations
                          <Info className="inline h-3 w-3 ml-1 opacity-50 group-hover/eo:opacity-100" />
                          <span className="absolute bottom-full left-0 mb-2 w-56 rounded-md border bg-popover p-3 text-popover-foreground shadow-md opacity-0 pointer-events-none group-hover/eo:opacity-100 group-hover/eo:pointer-events-auto transition-opacity z-50">
                            <span className="block text-xs text-muted-foreground leading-relaxed">
                              Sum of all active loan payments for this borrower, converted to monthly.
                            </span>
                          </span>
                        </span>
                        <span className="font-medium">
                          {calc.dti.existingObligation > 0
                            ? `${formatCurrency(calc.dti.existingObligation)}/mo`
                            : "none"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground relative group/tl cursor-help">
                          This loan
                          <Info className="inline h-3 w-3 ml-1 opacity-50 group-hover/tl:opacity-100" />
                          <span className="absolute bottom-full left-0 mb-2 w-56 rounded-md border bg-popover p-3 text-popover-foreground shadow-md opacity-0 pointer-events-none group-hover/tl:opacity-100 group-hover/tl:pointer-events-auto transition-opacity z-50">
                            <span className="block text-xs text-muted-foreground leading-relaxed">
                              This loan's payment amount converted to a monthly equivalent.
                            </span>
                          </span>
                        </span>
                        <span className="font-medium">{formatCurrency(calc.dti.proposedMonthly)}/mo</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold relative group/td cursor-help">
                          Total debt
                          <Info className="inline h-3 w-3 ml-1 opacity-50 group-hover/td:opacity-100" />
                          <span className="absolute bottom-full left-0 mb-2 w-56 rounded-md border bg-popover p-3 text-popover-foreground shadow-md opacity-0 pointer-events-none group-hover/td:opacity-100 group-hover/td:pointer-events-auto transition-opacity z-50">
                            <span className="block text-xs text-muted-foreground leading-relaxed">
                              Existing obligations + this loan. This is compared against gross income for the DTI ratio.
                            </span>
                          </span>
                        </span>
                        <span className="font-bold">{formatCurrency(calc.dti.totalMonthlyDebt)}/mo</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground relative group/ri cursor-help">
                          Remaining income
                          <Info className="inline h-3 w-3 ml-1 opacity-50 group-hover/ri:opacity-100" />
                          <span className="absolute bottom-full left-0 mb-2 w-56 rounded-md border bg-popover p-3 text-popover-foreground shadow-md opacity-0 pointer-events-none group-hover/ri:opacity-100 group-hover/ri:pointer-events-auto transition-opacity z-50">
                            <span className="block text-xs text-muted-foreground leading-relaxed">
                              Gross income minus total debt. What the borrower has left for living expenses each month.
                            </span>
                          </span>
                        </span>
                        <span className={cn(
                          "font-medium",
                          calc.dti.monthlyRemaining < 0 && "text-red-600 dark:text-red-400",
                        )}>
                          {formatCurrency(calc.dti.monthlyRemaining)}/mo
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {calc.dti.rating === "comfortable" &&
                        "Low risk of default from cash flow. Total debt is within a comfortable range of the borrower's income."}
                      {calc.dti.rating === "stretched" &&
                        "Manageable but tight. The borrower may struggle if unexpected expenses arise."}
                      {calc.dti.rating === "heavy" &&
                        "High risk. The borrower may struggle to meet payments consistently at this debt level."}
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

/* ─── DTI progress bar ─── */

function DtiBar({ percent }: { percent: number }) {
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
