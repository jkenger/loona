import { createFileRoute, useRouter, Link } from "@tanstack/react-router"
import { SkeletonFormPage } from "@/components/ui/skeleton"
import { useState, useEffect } from "react"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  createLoanAsAgent,
  getAgentAssignedContacts,
  getAgentLoanCreationPermission,
} from "@/server/loans"
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
  Clock,
  Info,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { calculateEIR, formatEIR } from "@/lib/utils/eir"
import { InterestRateWarning } from "@/components/interest-rate-warning"

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

const STEP_LABELS = ["Borrower", "Loan Terms", "Review"]

export const Route = createFileRoute("/_dashboard/agent/loans/new")({
  loader: async ({ context }) => {
    const { session } = context as {
      session: { user: { role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.AGENT)) {
      return { contacts: [], permissions: [], unauthorized: true }
    }

    const [contacts, permissions] = await Promise.all([
      getAgentAssignedContacts(),
      getAgentLoanCreationPermission(),
    ])

    return { contacts, permissions, unauthorized: false }
  },
  pendingComponent: SkeletonFormPage,
  component: AgentNewLoanWizard,
})

function AgentNewLoanWizard() {
  const router = useRouter()
  const { contacts, permissions, unauthorized } = Route.useLoaderData()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [stepError, setStepError] = useState("")

  // Selected lender (agent might work for multiple lenders)
  const [selectedAgentId, setSelectedAgentId] = useState(
    permissions.length > 0 ? permissions[0].agentId : ""
  )

  // Step 1 — Borrower
  const [isNewContact, setIsNewContact] = useState(true)
  // New borrower fields
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [facebookProfile, setFacebookProfile] = useState("")
  const [contactNotes, setContactNotes] = useState("")
  // Existing borrower
  const [contactId, setContactId] = useState("")

  // Step 2 — Loan Terms
  const [principal, setPrincipal] = useState("")
  const [interestRate, setInterestRate] = useState("5")
  const [termMonths, setTermMonths] = useState("6")
  const [paymentFrequency, setPaymentFrequency] = useState<
    "daily" | "weekly" | "biweekly" | "semimonthly" | "monthly"
  >("monthly")
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [purpose, setPurpose] = useState("")
  const [hasCollateral, setHasCollateral] = useState(false)
  const [collateralDescription, setCollateralDescription] = useState("")
  const [hasCoMaker, setHasCoMaker] = useState(false)
  const [coMakerName, setCoMakerName] = useState("")
  const [coMakerPhone, setCoMakerPhone] = useState("")
  const [coMakerRelationship, setCoMakerRelationship] = useState("")

  if (unauthorized) {
    return (
      <AccessDenied
        title="Agent Portal"
        message="You need to be an agent to access this page."
        homeLink="/dashboard"
        homeLinkLabel="Go to Dashboard"
      />
    )
  }

  if (permissions.length === 0) {
    return (
      <AccessDenied
        title="Permission Required"
        message="You don't have permission to create loans. Ask your lender to enable loan creation for your account."
        homeLink="/agent"
        homeLinkLabel="Back to Dashboard"
      />
    )
  }

  const selectedPermission = permissions.find((p) => p.agentId === selectedAgentId)

  // Check portfolio cap for the selected permission
  const isAtCap = selectedPermission
    ? selectedPermission.currentLoanCount >= selectedPermission.portfolioCap
    : false

  if (isAtCap && selectedPermission) {
    return (
      <AccessDenied
        title="Portfolio Limit Reached"
        message={`You've reached your portfolio limit of ${selectedPermission.portfolioCap} loans. Contact your lender to increase your limit or wait for existing loans to complete.`}
        homeLink="/agent/loans"
        homeLinkLabel="Back to Loans"
      />
    )
  }

  // Filter contacts to show only those belonging to the selected lender
  const availableContacts = contacts.filter(
    (c) => c.lenderId === selectedPermission?.lenderId
  )

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
        agentId: selectedAgentId,
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
            ...loanFields,
          }
        : {
            isNewContact: false as const,
            contactId,
            ...loanFields,
          }

      await createLoanAsAgent({ data: payload })
      toast.success("Loan submitted for approval")
      router.navigate({ to: "/agent/loans" })
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

  const selectedContact = availableContacts.find((c) => c.id === contactId)
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
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <Link
          to="/agent/loans"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Loans
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mt-2">New Loan</h1>
        <p className="text-muted-foreground">Create a new loan for approval</p>
      </div>

      <div>
        {/* Pending Approval Notice */}
        <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
          <Clock className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm">
            <span className="font-medium text-amber-600">Note:</span> This loan will be submitted for approval.
            Your lender must approve it before it becomes active.
          </p>
        </div>

        {/* Portfolio cap info */}
        {selectedPermission && (
          <div className="mb-4 p-3 rounded-lg bg-muted/50 border flex items-center gap-3">
            <Info className="h-5 w-5 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">
              {selectedPermission.currentLoanCount} of {selectedPermission.portfolioCap} loan slots used
            </p>
          </div>
        )}

        {/* Lender Selection (if agent works for multiple lenders) */}
        {permissions.length > 1 && (
          <Card className="mb-6 shadow-sm rounded-xl">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base">Select Lender</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <Select
                value={selectedAgentId}
                onValueChange={(v) => {
                  if (v) setSelectedAgentId(v)
                  setContactId("")
                }}
              >
                <SelectTrigger>
                  {selectedPermission?.lenderName || "Select lender"}
                </SelectTrigger>
                <SelectContent>
                  {permissions.map((p) => (
                    <SelectItem key={p.agentId} value={p.agentId}>
                      {p.lenderName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-0 mb-6 bg-card rounded-lg border shadow-sm rounded-xl p-4">
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
          <Card className="shadow-sm rounded-xl">
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
                      {availableContacts.map((contact) => (
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
                  {availableContacts.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No contacts available. Switch to "New Borrower" to create one.
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
                <Link to="/agent/loans">
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
            <Card className="lg:col-span-3 shadow-sm rounded-xl">
              <CardHeader className="p-4 pb-2">
                <CardTitle>Loan Terms</CardTitle>
                <CardDescription>
                  Configure the loan details for {borrowerDisplayName}
                </CardDescription>
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
                  <Label>Proposed Start Date</Label>
                  <DatePicker
                    value={startDate}
                    onChange={(date) => date && setStartDate(date)}
                  />
                  <p className="text-xs text-muted-foreground">
                    The lender may adjust this date upon approval
                  </p>
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

            {/* Summary Card */}
            <Card className="lg:col-span-2 h-fit shadow-sm rounded-xl">
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
          </div>
        )}

        {/* Step 3 — Review & Submit */}
        {step === 3 && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Borrower Summary */}
            <Card className="shadow-sm rounded-xl">
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
            <Card className="shadow-sm rounded-xl">
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

            {/* Action Buttons — Full Width */}
            <div className="lg:col-span-2">
              {/* Pending notice */}
              <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
                <Clock className="h-5 w-5 text-amber-500 shrink-0" />
                <p className="text-sm">
                  This loan will be submitted to{" "}
                  <span className="font-medium">
                    {selectedPermission?.lenderName}
                  </span>{" "}
                  for approval before it becomes active.
                </p>
              </div>

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
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CurrencyCircleDollar className="h-4 w-4" />
                      Submit for Approval
                    </>
                  )}
                </Button>
              </div>
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
