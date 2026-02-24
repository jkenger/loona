import { createFileRoute, Link } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { format } from "date-fns"
import { toast } from "sonner"
import { z } from "zod"
import { createContactAndLoan, getLoan } from "@/server/loans"
import { getContacts, getBorrowerScorecard } from "@/server/contacts"
import { getCashPosition } from "@/server/lender-settings"
import { getPenaltySettings } from "@/server/penalty-settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CurrencyInput } from "@/components/ui/currency-input"
import { PhoneInput } from "@/components/ui/phone-input"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { SkeletonFormPage } from "@/components/ui/skeleton"
import { AccessDenied } from "@/components/access-denied"
import { hasRole, ROLES } from "@/lib/constants/roles"
import {
  Spinner,
  Calculator,
  User,
  CurrencyCircleDollar,
  ShieldCheck,
  Users,
  Envelope,
  MapPin,
  FacebookLogo,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle,
  FileText,
  Scroll,
  ArrowSquareOut,
  Plus,
  Info,
  Warning,
  Gavel,
  ChartBar,
  TrendUp,
} from "@phosphor-icons/react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { type PenaltyConfig, DEFAULT_PENALTY_CONFIG } from "@/lib/constants/penalty-defaults"
import { calculateEIR, formatEIR } from "@/lib/utils/eir"
import { InterestRateWarning } from "@/components/interest-rate-warning"
import { LendingTip } from "@/components/lending-tip"


const PURPOSE_TEMPLATES = [
  { label: "Bill Payment", icon: "\u{1F4B3}" },
  { label: "Utilities", icon: "\u{1F4A1}" },
  { label: "Groceries", icon: "\u{1F6D2}" },
  { label: "Rent", icon: "\u{1F3E0}" },
  { label: "Tuition", icon: "\u{1F393}" },
  { label: "Medical", icon: "\u{1F3E5}" },
  { label: "Business", icon: "\u{1F4BC}" },
  { label: "Emergency", icon: "\u{1F6A8}" },
]

const STEP_LABELS = ["Borrower", "Loan Terms", "Review", "Done"]

const searchSchema = z.object({
  contactId: z.string().optional(),
  renewFromLoanId: z.string().optional(),
  principal: z.string().optional(),
  interestRate: z.string().optional(),
  termMonths: z.string().optional(),
  paymentFrequency: z.enum(["daily", "weekly", "biweekly", "semimonthly", "monthly"]).optional(),
})

export const Route = createFileRoute("/_dashboard/loans/new-wizard")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ renewFromLoanId: search.renewFromLoanId }),
  loader: async ({ context, deps }) => {
    const { session } = context as {
      session: { user: { role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      return { contacts: [], cashPosition: null, unauthorized: true, renewFromLoan: null, scorecard: null, penaltyConfig: null }
    }
    const [contacts, cashPosition, penaltyConfig] = await Promise.all([
      getContacts(),
      getCashPosition().catch(() => null),
      getPenaltySettings().catch(() => null),
    ])
    let renewFromLoan: Awaited<ReturnType<typeof getLoan>> | null = null
    let scorecard: Awaited<ReturnType<typeof getBorrowerScorecard>> | null = null
    if (deps.renewFromLoanId) {
      try {
        renewFromLoan = await getLoan({ data: deps.renewFromLoanId })
        if (renewFromLoan) {
          scorecard = await getBorrowerScorecard({ data: renewFromLoan.contactId })
        }
      } catch {
        // Source loan not found or not accessible
      }
    }
    return { contacts, cashPosition, unauthorized: false, renewFromLoan, scorecard, penaltyConfig }
  },
  pendingComponent: SkeletonFormPage,
  component: NewLoanWizard,
})

function NewLoanWizard() {
  const { contacts, cashPosition, unauthorized, renewFromLoan, scorecard, penaltyConfig: loaderPenaltyConfig } = Route.useLoaderData()
  const {
    contactId: preselectedContactId,
    principal: searchPrincipal,
    interestRate: searchInterestRate,
    termMonths: searchTermMonths,
    paymentFrequency: searchPaymentFrequency,
  } = Route.useSearch()

  const isRenewal = !!renewFromLoan
  const renewalContactId = renewFromLoan?.contactId
  const effectivePreselectedContactId = renewalContactId || preselectedContactId
  const hasPreselected = !!effectivePreselectedContactId && contacts.some((c) => c.id === effectivePreselectedContactId)

  const [step, setStep] = useState(hasPreselected ? 2 : 1)
  const [loading, setLoading] = useState(false)
  const [stepError, setStepError] = useState("")
  const [createdLoanId, setCreatedLoanId] = useState<string | null>(null)

  // Step 1 — Borrower
  const [isNewContact, setIsNewContact] = useState(!hasPreselected)
  // New borrower fields
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [facebookProfile, setFacebookProfile] = useState("")
  const [contactNotes, setContactNotes] = useState("")
  const [contactIncome, setContactIncome] = useState("")
  const [contactOtherIncome, setContactOtherIncome] = useState("")
  // Existing borrower
  const [contactId, setContactId] = useState(effectivePreselectedContactId || "")

  // Step 2 — Loan Terms (pre-fill from renewal source if available)
  const [principal, setPrincipal] = useState(renewFromLoan ? renewFromLoan.principal : searchPrincipal || "")
  const [interestRate, setInterestRate] = useState(renewFromLoan ? renewFromLoan.interestRate : searchInterestRate || "5")
  const [termMonths, setTermMonths] = useState(renewFromLoan ? String(renewFromLoan.termMonths) : searchTermMonths || "6")
  const [paymentFrequency, setPaymentFrequency] = useState<
    "daily" | "weekly" | "biweekly" | "semimonthly" | "monthly"
  >(renewFromLoan?.paymentFrequency as any || searchPaymentFrequency || "monthly")
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [purpose, setPurpose] = useState(renewFromLoan?.purpose || "")
  const [hasCollateral, setHasCollateral] = useState(!!renewFromLoan?.collateralDescription)
  const [collateralDescription, setCollateralDescription] = useState(renewFromLoan?.collateralDescription || "")
  const [hasCoMaker, setHasCoMaker] = useState(!!renewFromLoan?.coMakerName)
  const [coMakerName, setCoMakerName] = useState(renewFromLoan?.coMakerName || "")
  const [coMakerPhone, setCoMakerPhone] = useState(renewFromLoan?.coMakerPhone || "")
  const [coMakerRelationship, setCoMakerRelationship] = useState(renewFromLoan?.coMakerRelationship || "")

  // Penalty config — pre-filled from lender's global settings
  const [penaltyConfig, setPenaltyConfig] = useState<PenaltyConfig>(
    loaderPenaltyConfig ?? DEFAULT_PENALTY_CONFIG
  )
  const lenderHasPenaltySettings = loaderPenaltyConfig?.enabled === true
  const updatePenalty = (partial: Partial<PenaltyConfig>) =>
    setPenaltyConfig(prev => ({ ...prev, ...partial }))

  if (unauthorized) {
    return (
      <AccessDenied
        message="Only lenders can create loans."
        homeLink="/dashboard"
        homeLinkLabel="Go to Dashboard"
      />
    )
  }

  // Calculations
  const [calculations, setCalculations] = useState({
    totalInterest: 0,
    totalToRepay: 0,
    paymentAmount: 0,
    paymentsCount: 0,
    eir: 0,
  })

  useEffect(() => {
    const p = parseFloat(principal) || 0
    const r = parseFloat(interestRate) || 0
    const t = parseInt(termMonths) || 0

    if (p > 0 && t > 0) {
      const totalInterest = p * (r / 100) * t
      const totalToRepay = p + totalInterest

      let paymentsCount = t
      switch (paymentFrequency) {
        case "daily":
          paymentsCount = t * 30
          break
        case "weekly":
          paymentsCount = t * 4
          break
        case "biweekly":
          paymentsCount = t * 2
          break
        case "semimonthly":
          paymentsCount = t * 2
          break
      }

      const eir = calculateEIR({
        principal: p,
        totalInterest,
        termMonths: t,
        paymentFrequency,
      })

      setCalculations({
        totalInterest,
        totalToRepay,
        paymentAmount: totalToRepay / paymentsCount,
        paymentsCount,
        eir,
      })
    } else {
      setCalculations({
        totalInterest: 0,
        totalToRepay: 0,
        paymentAmount: 0,
        paymentsCount: 0,
        eir: 0,
      })
    }
  }, [principal, interestRate, termMonths, paymentFrequency])

  // Validation
  const validateStep1 = () => {
    if (isNewContact) {
      if (!name.trim() || name.trim().length < 2) {
        setStepError("Name must be at least 2 characters")
        return false
      }
    } else {
      if (!contactId) {
        setStepError("Please select a borrower")
        return false
      }
    }
    setStepError("")
    return true
  }

  const validateStep2 = () => {
    if (!principal || parseFloat(principal) <= 0) {
      setStepError("Principal amount is required")
      return false
    }
    if (!interestRate || parseFloat(interestRate) < 0) {
      setStepError("Interest rate is required")
      return false
    }
    if (parseFloat(interestRate) > 15) {
      setStepError("Interest rate cannot exceed 15% per month")
      return false
    }
    if (!termMonths || parseInt(termMonths) <= 0) {
      setStepError("Loan term is required")
      return false
    }
    setStepError("")
    return true
  }

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2)
    } else if (step === 2 && validateStep2()) {
      setStep(3)
    }
  }

  const handleBack = () => {
    setStepError("")
    setStep(step - 1)
  }

  const handleSubmit = async () => {
    setStepError("")
    setLoading(true)

    try {
      const loanFields = {
        principal: parseFloat(principal),
        interestRate: parseFloat(interestRate),
        termMonths: parseInt(termMonths),
        paymentFrequency,
        startDate: format(startDate, "yyyy-MM-dd"),
        purpose: purpose || undefined,
        collateralDescription: hasCollateral
          ? collateralDescription
          : undefined,
        coMakerName: hasCoMaker ? coMakerName : undefined,
        coMakerPhone: hasCoMaker ? coMakerPhone : undefined,
        coMakerRelationship: hasCoMaker ? coMakerRelationship : undefined,
        renewedFromLoanId: renewFromLoan?.id || undefined,
        penaltyConfigJson: JSON.stringify(penaltyConfig),
      }

      const payload = isNewContact
        ? {
            isNewContact: true as const,
            name: name.trim(),
            phone: phone || undefined,
            email: email || undefined,
            address: address || undefined,
            city: city || undefined,
            facebookProfile: facebookProfile || undefined,
            notes: contactNotes || undefined,
            income: contactIncome || undefined,
            otherIncome: contactOtherIncome || undefined,
            ...loanFields,
          }
        : {
            isNewContact: false as const,
            contactId,
            ...loanFields,
          }

      const loan = await createContactAndLoan({ data: payload })
      setCreatedLoanId(loan.id)
      setLoading(false)
      setStep(4)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create loan"
      )
      setStepError(
        err instanceof Error ? err.message : "Failed to create loan"
      )
      setLoading(false)
    }
  }

  const selectedContact = contacts.find((c) => c.id === contactId)
  const borrowerDisplayName = isNewContact
    ? name.trim() || "New Borrower"
    : selectedContact?.name || "—"

  const frequencyLabel: Record<string, string> = {
    monthly: "Monthly",
    semimonthly: "Semi-monthly",
    biweekly: "Bi-weekly",
    weekly: "Weekly",
    daily: "Daily",
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-[hsl(215_45%_14%)] text-white py-4 pb-12">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              to="/loans"
              className="text-sm text-blue-200/70 hover:text-white transition-colors"
            >
              Loans
            </Link>
            <span className="text-blue-300/40">/</span>
            <h1 className="text-lg font-semibold">{isRenewal ? "Renew Loan" : "New Loan"}</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-6 pb-8">
        {/* Renewal Banner */}
        {isRenewal && renewFromLoan && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-blue-300/50 bg-blue-50 dark:bg-blue-950/30 p-3 text-sm">
            <ArrowRight className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="text-blue-800 dark:text-blue-200">
              Renewing from{" "}
              <Link
                to="/loans/$loanId"
                params={{ loanId: renewFromLoan.id }}
                className="font-medium underline hover:no-underline"
              >
                {formatCurrency(parseFloat(renewFromLoan.principal))} loan
              </Link>
              {" "}for {renewFromLoan.contact.name}. All terms are pre-filled — edit as needed.
            </span>
          </div>
        )}

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-0 mb-6 bg-card rounded-lg border shadow-lg p-4">
          {STEP_LABELS.map((label, i) => {
            const stepNum = i + 1
            const isActive = step === stepNum
            const isCompleted = step > stepNum
            return (
              <div key={label} className="flex items-center">
                {i > 0 && (
                  <div
                    className={cn(
                      "w-12 sm:w-20 h-0.5 mx-1 sm:mx-2",
                      isCompleted ? "bg-primary" : "bg-border"
                    )}
                  />
                )}
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors",
                      isActive &&
                        "border-primary bg-primary text-primary-foreground",
                      isCompleted &&
                        "border-primary bg-primary text-primary-foreground",
                      !isActive &&
                        !isCompleted &&
                        "border-muted-foreground/30 text-muted-foreground"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" weight="bold" />
                    ) : (
                      stepNum
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-sm font-medium hidden sm:inline",
                      isActive && "text-foreground",
                      isCompleted && "text-foreground",
                      !isActive && !isCompleted && "text-muted-foreground"
                    )}
                  >
                    {label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Step 1 — Borrower */}
        {step === 1 && (
          <Card className="shadow-lg">
            <CardHeader className="p-4 pb-2">
              <CardTitle>Borrower</CardTitle>
              <CardDescription>
                Create a new borrower or select an existing contact
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-6">
              {/* Toggle */}
              <div className="flex rounded-lg border p-1 w-fit">
                <button
                  type="button"
                  className={cn(
                    "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                    isNewContact
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setIsNewContact(true)}
                >
                  New Borrower
                </button>
                <button
                  type="button"
                  className={cn(
                    "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                    !isNewContact
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setIsNewContact(false)}
                >
                  Existing Contact
                </button>
              </div>

              {isNewContact ? (
                <div className="space-y-4">
                  {/* Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Full Name <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Juan dela Cruz"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Phone & Email */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <PhoneInput
                        id="phone"
                        value={phone}
                        onValueChange={setPhone}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Envelope className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="juan@example.com"
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Address & City */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="address">Address</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="address"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="123 Main St, Brgy. Sample"
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Manila"
                      />
                    </div>
                  </div>

                  {/* Facebook */}
                  <div className="space-y-2">
                    <Label htmlFor="facebookProfile">Facebook Profile</Label>
                    <div className="relative">
                      <FacebookLogo className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="facebookProfile"
                        value={facebookProfile}
                        onChange={(e) => setFacebookProfile(e.target.value)}
                        placeholder="facebook.com/username"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Income */}
                  <div className="space-y-2">
                    <Label>
                      Monthly Income{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Basic Pay</span>
                        <CurrencyInput
                          id="contactIncome"
                          value={contactIncome}
                          onValueChange={setContactIncome}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Other Income</span>
                        <CurrencyInput
                          id="contactOtherIncome"
                          value={contactOtherIncome}
                          onValueChange={setContactOtherIncome}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    {(parseFloat(contactIncome) > 0 || parseFloat(contactOtherIncome) > 0) && (
                      <p className="text-xs text-muted-foreground">
                        Total: {formatCurrency((parseFloat(contactIncome) || 0) + (parseFloat(contactOtherIncome) || 0))}/mo
                      </p>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="contactNotes">Notes</Label>
                    <Textarea
                      id="contactNotes"
                      value={contactNotes}
                      onChange={(e) => setContactNotes(e.target.value)}
                      placeholder="Any additional information about this contact..."
                      rows={3}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="contactId">Select Borrower</Label>
                  <Select
                    value={contactId}
                    onValueChange={(v) => v && setContactId(v)}
                  >
                    <SelectTrigger>
                      {selectedContact ? (
                        <span className="inline-flex items-center gap-2">
                          <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span>{selectedContact.name}</span>
                          {selectedContact.phone && (
                            <span className="text-muted-foreground">
                              ({selectedContact.phone})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Select a borrower...
                        </span>
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          <span className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {contact.name}
                            {contact.phone && (
                              <span className="text-muted-foreground">
                                ({contact.phone})
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {contacts.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No contacts yet. Switch to "New Borrower" to create one.
                    </p>
                  )}
                </div>
              )}

              {stepError && (
                <div className="p-3 rounded bg-destructive/10 text-destructive text-sm">
                  {stepError}
                </div>
              )}

              <div className="flex justify-between pt-2">
                <Link to="/loans">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
                <Button type="button" onClick={handleNext} className="gap-2">
                  Next
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2 — Loan Terms */}
        {step === 2 && (
          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3 shadow-lg">
              <CardHeader className="p-4 pb-2">
                <CardTitle>Loan Terms</CardTitle>
                <CardDescription>
                  Configure the loan details for {borrowerDisplayName}
                </CardDescription>
                {isRenewal ? (
                  <LendingTip tip="Reward consistency — good borrowers are your best asset." className="px-4" />
                ) : selectedContact && selectedContact.totalLoans === 0 ? (
                  <LendingTip tip="Start small, build trust. First loans are about the relationship, not the amount." className="px-4" />
                ) : null}
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-6">
                {/* Principal & Interest */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="principal">Principal Amount</Label>
                    <CurrencyInput
                      id="principal"
                      value={principal}
                      onValueChange={setPrincipal}
                      placeholder="10,000"
                      required
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
                        required
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        % / mo
                      </span>
                    </div>
                  </div>
                </div>

                {/* DTI Hint — only shown for amber/red */}
                {(() => {
                  if (isNewContact || !selectedContact) return null
                  const grossIncome = (parseFloat(selectedContact.income ?? "0")) + (parseFloat(selectedContact.otherIncome ?? "0"))
                  if (!grossIncome || !calculations.paymentAmount) return null

                  const existingObligation = parseFloat(selectedContact.monthlyObligation ?? "0")
                  const proposedMonthly = paymentFrequency === "daily" ? calculations.paymentAmount * 30
                    : paymentFrequency === "weekly" ? calculations.paymentAmount * 4
                    : paymentFrequency === "biweekly" || paymentFrequency === "semimonthly" ? calculations.paymentAmount * 2
                    : calculations.paymentAmount
                  const totalDebt = existingObligation + proposedMonthly
                  const dtiRatio = (totalDebt / grossIncome) * 100

                  if (dtiRatio <= 30) return null

                  const severity = dtiRatio > 50 ? "red" : "amber"
                  const severityLabel = severity === "red" ? "heavy" : "stretched"
                  const textColor = severity === "red" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"

                  return (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                      <ChartBar className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        DTI: <span className={cn("font-semibold", textColor)}>{dtiRatio.toFixed(0)}% ({severityLabel})</span>
                        {" "}—{" "}
                        <span className="relative group/debt cursor-help">
                          monthly debt {formatCurrency(totalDebt)}
                          <Info className="inline h-3 w-3 ml-0.5 opacity-50 group-hover/debt:opacity-100" />
                          <span className="absolute bottom-full left-0 mb-2 w-64 rounded-md border bg-popover p-3 text-popover-foreground shadow-md opacity-0 pointer-events-none group-hover/debt:opacity-100 group-hover/debt:pointer-events-auto transition-opacity z-50">
                            <span className="block text-xs text-muted-foreground leading-relaxed">
                              {existingObligation > 0 && <>Existing loans: {formatCurrency(existingObligation)}/mo<br /></>}
                              This loan: {formatCurrency(proposedMonthly)}/mo<br />
                              <span className="font-medium text-foreground">Total: {formatCurrency(totalDebt)}/mo</span>
                            </span>
                          </span>
                        </span>
                        {" "}vs {formatCurrency(grossIncome)} income.{" "}
                        <Link
                          to="/tools/estimator"
                          search={{
                            principal,
                            interestRate,
                            termMonths,
                            paymentFrequency,
                            contactId: selectedContact?.id,
                          }}
                          className="underline hover:text-foreground"
                        >
                          Review in estimator →
                        </Link>
                      </span>
                    </p>
                  )
                })()}

                {/* Interest Rate Warning */}
                <InterestRateWarning rate={interestRate} />

                {/* Term & Frequency */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="termMonths">Loan Term</Label>
                    <div className="relative">
                      <Input
                        id="termMonths"
                        type="number"
                        min="1"
                        max="60"
                        placeholder="6"
                        value={termMonths}
                        onChange={(e) => setTermMonths(e.target.value)}
                        className="pr-20"
                        required
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
                      onValueChange={(v) =>
                        setPaymentFrequency(v as typeof paymentFrequency)
                      }
                    >
                      <SelectTrigger>
                        {frequencyLabel[paymentFrequency]}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="semimonthly">
                          Semi-monthly (1st & 15th)
                        </SelectItem>
                        <SelectItem value="biweekly">Bi-weekly</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Start Date */}
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <DatePicker
                    value={startDate}
                    onChange={(date) => date && setStartDate(date)}
                  />
                </div>

                <Separator />

                {/* Purpose */}
                <div className="space-y-3">
                  <Label>
                    Purpose{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {PURPOSE_TEMPLATES.map((template) => (
                      <Button
                        key={template.label}
                        type="button"
                        variant={
                          purpose === template.label ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() =>
                          setPurpose(
                            purpose === template.label ? "" : template.label
                          )
                        }
                        className="gap-1.5"
                      >
                        <span>{template.icon}</span>
                        <span>{template.label}</span>
                      </Button>
                    ))}
                  </div>
                  <Input
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Or type a custom purpose..."
                  />
                </div>

                <Separator />

                {/* Collateral */}
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={hasCollateral}
                      onCheckedChange={(checked) =>
                        setHasCollateral(!!checked)
                      }
                    />
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        This loan has collateral
                      </span>
                    </div>
                  </label>
                  {hasCollateral && (
                    <Textarea
                      value={collateralDescription}
                      onChange={(e) =>
                        setCollateralDescription(e.target.value)
                      }
                      placeholder="Describe the collateral (e.g., Vehicle - Honda Click 150, 2020 model, OR/CR available)"
                      rows={3}
                    />
                  )}
                </div>

                <Separator />

                {/* Co-maker */}
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={hasCoMaker}
                      onCheckedChange={(checked) => setHasCoMaker(!!checked)}
                    />
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        Add co-maker / guarantor
                      </span>
                    </div>
                  </label>
                  {hasCoMaker && (
                    <div className="space-y-3 pl-7">
                      <div className="space-y-2">
                        <Label htmlFor="coMakerName">Co-maker Name</Label>
                        <Input
                          id="coMakerName"
                          value={coMakerName}
                          onChange={(e) => setCoMakerName(e.target.value)}
                          placeholder="Full name of co-maker"
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="coMakerPhone">Phone Number</Label>
                          <Input
                            id="coMakerPhone"
                            value={coMakerPhone}
                            onChange={(e) => setCoMakerPhone(e.target.value)}
                            placeholder="09XX XXX XXXX"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="coMakerRelationship">
                            Relationship
                          </Label>
                          <Input
                            id="coMakerRelationship"
                            value={coMakerRelationship}
                            onChange={(e) =>
                              setCoMakerRelationship(e.target.value)
                            }
                            placeholder="e.g., Spouse, Parent"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Penalty Config */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gavel className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Enable Penalties</span>
                    </div>
                    <Switch
                      checked={penaltyConfig.enabled}
                      onCheckedChange={(enabled) => updatePenalty({ enabled })}
                    />
                  </div>
                  {lenderHasPenaltySettings && penaltyConfig.enabled && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 shrink-0" />
                      Pre-filled from your penalty settings
                    </p>
                  )}
                  {penaltyConfig.enabled && (
                    <LendingTip tip="Penalties should motivate timely payment, not punish. Keep them fair and transparent." />
                  )}
                  {penaltyConfig.enabled && (
                    <div className="space-y-4 pl-6 border-l-2 border-border">
                      {/* Grace Period */}
                      <div className="space-y-1">
                        <Label>Grace Period (days)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="90"
                          value={penaltyConfig.gracePeriodDays}
                          onChange={(e) =>
                            updatePenalty({ gracePeriodDays: parseInt(e.target.value) || 0 })
                          }
                          className="max-w-[120px]"
                        />
                      </div>

                      {/* Late Fee */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Late Fee</Label>
                          <Switch
                            checked={penaltyConfig.lateFee.enabled}
                            onCheckedChange={(enabled) =>
                              updatePenalty({ lateFee: { ...penaltyConfig.lateFee, enabled } })
                            }
                          />
                        </div>
                        {penaltyConfig.lateFee.enabled && (
                          <div className="grid grid-cols-2 gap-3">
                            <Select
                              value={penaltyConfig.lateFee.type}
                              onValueChange={(type) => {
                                if (type) updatePenalty({ lateFee: { ...penaltyConfig.lateFee, type: type as "fixed" | "percentage" } })
                              }}
                            >
                              <SelectTrigger>
                                {penaltyConfig.lateFee.type === "fixed" ? "Fixed" : "% of Overdue"}
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="fixed">Fixed Amount</SelectItem>
                                <SelectItem value="percentage">% of Overdue</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              min="0"
                              step={penaltyConfig.lateFee.type === "fixed" ? "1" : "0.1"}
                              value={penaltyConfig.lateFee.amount}
                              onChange={(e) =>
                                updatePenalty({
                                  lateFee: { ...penaltyConfig.lateFee, amount: parseFloat(e.target.value) || 0 },
                                })
                              }
                              placeholder={penaltyConfig.lateFee.type === "fixed" ? "₱ amount" : "%"}
                            />
                          </div>
                        )}
                      </div>

                      {/* Daily Penalty Interest */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Daily Penalty Interest</Label>
                          <Switch
                            checked={penaltyConfig.dailyPenaltyInterest.enabled}
                            onCheckedChange={(enabled) =>
                              updatePenalty({
                                dailyPenaltyInterest: { ...penaltyConfig.dailyPenaltyInterest, enabled },
                              })
                            }
                          />
                        </div>
                        {penaltyConfig.dailyPenaltyInterest.enabled && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <span className="text-xs text-muted-foreground">Rate/day (%)</span>
                              <Input
                                type="number"
                                min="0"
                                max="10"
                                step="0.01"
                                value={penaltyConfig.dailyPenaltyInterest.ratePerDay}
                                onChange={(e) =>
                                  updatePenalty({
                                    dailyPenaltyInterest: {
                                      ...penaltyConfig.dailyPenaltyInterest,
                                      ratePerDay: parseFloat(e.target.value) || 0,
                                    },
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-xs text-muted-foreground">Max days</span>
                              <Input
                                type="number"
                                min="1"
                                max="365"
                                value={penaltyConfig.dailyPenaltyInterest.maxDays}
                                onChange={(e) =>
                                  updatePenalty({
                                    dailyPenaltyInterest: {
                                      ...penaltyConfig.dailyPenaltyInterest,
                                      maxDays: parseInt(e.target.value) || 1,
                                    },
                                  })
                                }
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Penalty Cap */}
                      <div className="space-y-2">
                        <Label>Penalty Cap</Label>
                        <div className="grid grid-cols-2 gap-3">
                          <Select
                            value={penaltyConfig.penaltyCap.type}
                            onValueChange={(type) => {
                              if (type) updatePenalty({ penaltyCap: { ...penaltyConfig.penaltyCap, type: type as "fixed" | "percentage" } })
                            }}
                          >
                            <SelectTrigger>
                              {penaltyConfig.penaltyCap.type === "fixed" ? "Fixed" : "% of Principal"}
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">% of Principal</SelectItem>
                              <SelectItem value="fixed">Fixed Amount</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            min="0"
                            value={penaltyConfig.penaltyCap.amount}
                            onChange={(e) =>
                              updatePenalty({
                                penaltyCap: { ...penaltyConfig.penaltyCap, amount: parseFloat(e.target.value) || 0 },
                              })
                            }
                            placeholder={penaltyConfig.penaltyCap.type === "fixed" ? "₱ amount" : "%"}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {stepError && (
                  <div className="p-3 rounded bg-destructive/10 text-destructive text-sm">
                    {stepError}
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="gap-2"
                  >
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Summary Card + Scorecard Column */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="h-fit shadow-lg">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-primary" />
                    Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded bg-secondary">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {borrowerDisplayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {borrowerDisplayName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isNewContact ? "New borrower" : "Existing contact"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Principal</span>
                      <span className="font-medium">
                        {formatCurrency(parseFloat(principal) || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Total Interest
                      </span>
                      <span className="font-medium">
                        {formatCurrency(calculations.totalInterest)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Interest Rate</span>
                      <span className="font-medium">{interestRate || 0}% / mo</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground relative group/eir cursor-help">
                        Effective Rate
                        <Info className="inline h-3 w-3 ml-1 opacity-50 group-hover/eir:opacity-100" />
                        <span className="absolute bottom-full left-0 mb-2 w-64 rounded-md border bg-popover p-3 text-popover-foreground shadow-md opacity-0 pointer-events-none group-hover/eir:opacity-100 group-hover/eir:pointer-events-auto transition-opacity z-50">
                          <span className="block text-xs text-muted-foreground leading-relaxed">
                            The Effective Interest Rate (EIR) shows the true annual cost. It's higher than the monthly rate because interest is charged on the full principal for the entire term, even as you pay it down each period.
                          </span>
                        </span>
                      </span>
                      <span className="font-medium text-primary">
                        {formatEIR(calculations.eir)}
                      </span>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex justify-between">
                      <span className="font-semibold">Total to Repay</span>
                      <span className="font-bold text-lg text-primary">
                        {formatCurrency(calculations.totalToRepay)}
                      </span>
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Payments</span>
                      <span className="font-medium">
                        {calculations.paymentsCount}x
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Each Payment</span>
                      <span className="font-medium">
                        {formatCurrency(calculations.paymentAmount)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Borrower History Scorecard — renewals only */}
              {isRenewal && scorecard && (
                <Card className="h-fit shadow-lg">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <ChartBar className="h-5 w-5 text-primary" />
                      Borrower History
                    </CardTitle>
                    <CardDescription>
                      Payment track record across {scorecard.totalLoans} loan{scorecard.totalLoans !== 1 ? "s" : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-4">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Loans Completed</p>
                        <p className="text-lg font-bold">
                          {scorecard.completedLoans}
                          <span className="text-sm font-normal text-muted-foreground"> / {scorecard.totalLoans}</span>
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">On-Time Rate</p>
                        <p className={cn(
                          "text-lg font-bold",
                          scorecard.onTimeRate >= 90 ? "text-green-600 dark:text-green-400" :
                          scorecard.onTimeRate >= 70 ? "text-amber-600 dark:text-amber-400" :
                          "text-red-600 dark:text-red-400"
                        )}>
                          {scorecard.onTimeRate}%
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Total Borrowed</p>
                        <p className="text-lg font-bold">{formatCurrency(scorecard.totalBorrowed)}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Penalties</p>
                        <p className={cn(
                          "text-lg font-bold",
                          scorecard.totalPenalties > 0 ? "text-red-600 dark:text-red-400" : ""
                        )}>
                          {scorecard.totalPenalties > 0 ? formatCurrency(scorecard.totalPenalties) : "None"}
                        </p>
                      </div>
                    </div>

                    {/* Extra stats */}
                    {(scorecard.latePayments > 0 || scorecard.defaultedLoans > 0) && (
                      <div className="space-y-2 text-sm">
                        {scorecard.latePayments > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Late Payments</span>
                            <span className="font-medium text-amber-600 dark:text-amber-400">
                              {scorecard.latePayments} (avg {scorecard.avgDaysLate}d late)
                            </span>
                          </div>
                        )}
                        {scorecard.defaultedLoans > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Defaulted Loans</span>
                            <span className="font-medium text-red-600 dark:text-red-400">
                              {scorecard.defaultedLoans}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Previous Loans Trend */}
                    {scorecard.previousLoans.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                            <TrendUp className="h-3.5 w-3.5" />
                            Previous Loans
                          </p>
                          <div className="space-y-2">
                            {scorecard.previousLoans.map((loan) => (
                              <div
                                key={loan.id}
                                className="flex items-center justify-between text-sm p-2 rounded bg-secondary"
                              >
                                <span className="font-medium">
                                  {formatCurrency(parseFloat(loan.principal))}
                                </span>
                                <span className="text-muted-foreground text-xs">
                                  {loan.interestRate}% &middot; {loan.termMonths}mo
                                  {loan.completedAt && (
                                    <> &middot; {format(new Date(loan.completedAt), "MMM yyyy")}</>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

            </div>
          </div>
        )}

        {/* Step 3 — Review & Submit */}
        {step === 3 && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Borrower Summary */}
            <Card className="shadow-lg">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Borrower
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <div className="flex items-center gap-3 p-3 rounded bg-secondary">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {borrowerDisplayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{borrowerDisplayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {isNewContact ? "New borrower" : "Existing contact"}
                    </p>
                  </div>
                </div>

                {isNewContact && (
                  <div className="space-y-2 text-sm">
                    {phone && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phone</span>
                        <span>{phone}</span>
                      </div>
                    )}
                    {email && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email</span>
                        <span>{email}</span>
                      </div>
                    )}
                    {address && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Address</span>
                        <span>{address}</span>
                      </div>
                    )}
                    {city && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">City</span>
                        <span>{city}</span>
                      </div>
                    )}
                    {facebookProfile && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Facebook</span>
                        <span>{facebookProfile}</span>
                      </div>
                    )}
                    {contactNotes && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Notes</span>
                        <span className="text-right max-w-[200px] truncate">
                          {contactNotes}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {!isNewContact && selectedContact && (
                  <div className="space-y-2 text-sm">
                    {selectedContact.phone && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phone</span>
                        <span>{selectedContact.phone}</span>
                      </div>
                    )}
                    {selectedContact.email && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email</span>
                        <span>{selectedContact.email}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Loan Terms Summary */}
            <Card className="shadow-lg">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center gap-2">
                  <CurrencyCircleDollar className="h-5 w-5 text-primary" />
                  Loan Terms
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Principal</span>
                    <span className="font-medium">
                      {formatCurrency(parseFloat(principal) || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Interest Rate
                    </span>
                    <span className="font-medium">{interestRate}% / mo</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Term</span>
                    <span className="font-medium">{termMonths} months</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frequency</span>
                    <span className="font-medium">
                      {frequencyLabel[paymentFrequency]}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Start Date</span>
                    <span className="font-medium">
                      {format(startDate, "MMMM d, yyyy")}
                    </span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Total Interest
                    </span>
                    <span className="font-medium">
                      {formatCurrency(calculations.totalInterest)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Total to Repay</span>
                    <span className="font-bold text-primary">
                      {formatCurrency(calculations.totalToRepay)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {calculations.paymentsCount} payments of
                    </span>
                    <span className="font-medium">
                      {formatCurrency(calculations.paymentAmount)}
                    </span>
                  </div>
                </div>

                {(purpose || hasCollateral || hasCoMaker) && (
                  <>
                    <Separator />
                    <div className="space-y-2 text-sm">
                      {purpose && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Purpose
                          </span>
                          <span className="font-medium">{purpose}</span>
                        </div>
                      )}
                      {hasCollateral && collateralDescription && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Collateral
                          </span>
                          <span className="font-medium text-right max-w-[200px] truncate">
                            {collateralDescription}
                          </span>
                        </div>
                      )}
                      {hasCoMaker && coMakerName && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Co-maker
                          </span>
                          <span className="font-medium">{coMakerName}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Penalties Summary */}
            <Card className="shadow-lg">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Gavel className="h-5 w-5 text-primary" />
                  Penalties
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {!penaltyConfig.enabled ? (
                  <p className="text-sm text-muted-foreground">Disabled</p>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Grace Period</span>
                      <span className="font-medium">{penaltyConfig.gracePeriodDays} day{penaltyConfig.gracePeriodDays !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Late Fee</span>
                      <span className="font-medium">
                        {penaltyConfig.lateFee.enabled
                          ? penaltyConfig.lateFee.type === "fixed"
                            ? `₱${penaltyConfig.lateFee.amount.toLocaleString()}`
                            : `${penaltyConfig.lateFee.amount}% of overdue`
                          : "Off"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Daily Interest</span>
                      <span className="font-medium">
                        {penaltyConfig.dailyPenaltyInterest.enabled
                          ? `${penaltyConfig.dailyPenaltyInterest.ratePerDay}%/day (max ${penaltyConfig.dailyPenaltyInterest.maxDays}d)`
                          : "Off"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Penalty Cap</span>
                      <span className="font-medium">
                        {penaltyConfig.penaltyCap.type === "fixed"
                          ? `₱${penaltyConfig.penaltyCap.amount.toLocaleString()}`
                          : `${penaltyConfig.penaltyCap.amount}% of principal`}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cash Position Warning */}
            {cashPosition && cashPosition.initialCapital > 0 && (() => {
              const loanAmount = parseFloat(principal)
              const available = cashPosition.cashAvailable
              if (loanAmount > available) {
                const shortfall = loanAmount - available
                return (
                  <div className="lg:col-span-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3">
                    <Warning className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" weight="fill" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-600">Insufficient cash position</p>
                      <p className="text-muted-foreground mt-1">
                        You're about to disburse{" "}
                        {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(loanAmount)}{" "}
                        but your available cash is only{" "}
                        {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(available)}.{" "}
                        You're short by{" "}
                        <span className="font-medium text-amber-600">
                          {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(shortfall)}
                        </span>.
                      </p>
                    </div>
                  </div>
                )
              }
              return null
            })()}

            {/* Action Buttons — Full Width */}
            <div className="lg:col-span-2">
              {stepError && (
                <div className="p-3 rounded bg-destructive/10 text-destructive text-sm mb-4">
                  {stepError}
                </div>
              )}

              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="gap-2"
                >
                  {loading ? (
                    <>
                      <Spinner className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <CurrencyCircleDollar className="h-4 w-4" />
                      Issue Loan
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4 — Success */}
        {step === 4 && createdLoanId && (
          <div className="max-w-2xl mx-auto space-y-6">
            <Card className="shadow-lg text-center">
              <CardContent className="p-8 space-y-4">
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                  <CheckCircle
                    className="h-10 w-10 text-green-600 dark:text-green-400"
                    weight="fill"
                  />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Loan Created</h2>
                  <p className="text-muted-foreground mt-1">
                    The loan for{" "}
                    <span className="font-medium text-foreground">
                      {borrowerDisplayName}
                    </span>{" "}
                    has been created with a principal of{" "}
                    <span className="font-medium text-foreground">
                      {formatCurrency(parseFloat(principal) || 0)}
                    </span>
                    . Payment schedule has been generated.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Documents */}
            <Card className="shadow-lg">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base">Documents Ready</CardTitle>
                <CardDescription>
                  The following documents have been generated for this loan
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link
                    to="/loans/$loanId/disclosure"
                    params={{ loanId: createdLoanId }}
                    className="group flex items-start gap-3 p-4 rounded-lg border hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-sm">Disclosure Statement</p>
                        <ArrowSquareOut className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Full breakdown of credit terms and cost of borrowing
                      </p>
                    </div>
                  </Link>
                  <Link
                    to="/loans/$loanId/promissory-note"
                    params={{ loanId: createdLoanId }}
                    className="group flex items-start gap-3 p-4 rounded-lg border hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <Scroll className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-sm">Promissory Note</p>
                        <ArrowSquareOut className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Formal promise-to-pay agreement with terms
                      </p>
                    </div>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/loans/$loanId"
                params={{ loanId: createdLoanId }}
                className="flex-1"
              >
                <Button className="w-full gap-2">
                  <CurrencyCircleDollar className="h-4 w-4" />
                  View Loan Details
                </Button>
              </Link>
              <Link to="/loans/new-wizard" className="flex-1">
                <Button variant="outline" className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Create Another Loan
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}
