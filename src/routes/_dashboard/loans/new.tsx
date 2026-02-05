import { createFileRoute, useRouter, Link } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { format } from "date-fns"
import { toast } from "sonner"
import { createLoan } from "@/server/loans"
import { getContacts } from "@/server/contacts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CurrencyInput } from "@/components/ui/currency-input"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { AccessDenied } from "@/components/access-denied"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { Spinner, Calculator, User, CurrencyCircleDollar, ShieldCheck, Users } from "@phosphor-icons/react"
import { z } from "zod"

const PURPOSE_TEMPLATES = [
  { label: "Bill Payment", icon: "💳" },
  { label: "Utilities", icon: "💡" },
  { label: "Groceries", icon: "🛒" },
  { label: "Rent", icon: "🏠" },
  { label: "Tuition", icon: "🎓" },
  { label: "Medical", icon: "🏥" },
  { label: "Business", icon: "💼" },
  { label: "Emergency", icon: "🚨" },
]

const searchSchema = z.object({
  contactId: z.string().optional(),
})

export const Route = createFileRoute("/_dashboard/loans/new")({
  validateSearch: searchSchema,
  loader: async ({ context }) => {
    const { session } = context as { session: { user: { role: string | null } } }
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      return { contacts: [], unauthorized: true }
    }
    const contacts = await getContacts()
    return { contacts, unauthorized: false }
  },
  component: NewLoanPage,
})

function NewLoanPage() {
  const router = useRouter()
  const { contacts, unauthorized } = Route.useLoaderData()
  const { contactId: preselectedContactId } = Route.useSearch()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [step, setStep] = useState<"form" | "review">("form")

  // Form state
  const [contactId, setContactId] = useState(preselectedContactId || "")
  const [principal, setPrincipal] = useState("")
  const [interestRate, setInterestRate] = useState("5")
  const [termMonths, setTermMonths] = useState("6")
  const [paymentFrequency, setPaymentFrequency] = useState<"daily" | "weekly" | "biweekly" | "semimonthly" | "monthly">("monthly")
  const [startDate, setStartDate] = useState<Date>(new Date())

  // Optional fields
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
        message="Only lenders can create loans."
        homeLink="/agent"
        homeLinkLabel="Go to Agent Portal"
      />
    )
  }

  // Calculated values
  const [calculations, setCalculations] = useState({
    totalInterest: 0,
    totalToRepay: 0,
    paymentAmount: 0,
    paymentsCount: 0,
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

      setCalculations({
        totalInterest,
        totalToRepay,
        paymentAmount: totalToRepay / paymentsCount,
        paymentsCount,
      })
    } else {
      setCalculations({
        totalInterest: 0,
        totalToRepay: 0,
        paymentAmount: 0,
        paymentsCount: 0,
      })
    }
  }, [principal, interestRate, termMonths, paymentFrequency])

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setStep("review")
  }

  const handleSubmit = async () => {
    setError("")
    setLoading(true)

    try {
      const loan = await createLoan({
        data: {
          contactId,
          principal: parseFloat(principal),
          interestRate: parseFloat(interestRate),
          termMonths: parseInt(termMonths),
          paymentFrequency,
          startDate: format(startDate, "yyyy-MM-dd"),
          // Optional fields
          purpose: purpose || undefined,
          collateralDescription: hasCollateral ? collateralDescription : undefined,
          coMakerName: hasCoMaker ? coMakerName : undefined,
          coMakerPhone: hasCoMaker ? coMakerPhone : undefined,
          coMakerRelationship: hasCoMaker ? coMakerRelationship : undefined,
        },
      })
      toast.success("Loan created successfully")
      router.navigate({ to: "/loans/$loanId", params: { loanId: loan.id } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create loan")
      setError(err instanceof Error ? err.message : "Failed to create loan")
      setLoading(false)
    }
  }

  const selectedContact = contacts.find((c) => c.id === contactId)

  return (
    <div>
      {/* Compact Header */}
      <div className="bg-[hsl(215_45%_14%)] text-white py-4 pb-12">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link to="/loans" className="text-sm text-blue-200/70 hover:text-white transition-colors">
              Loans
            </Link>
            <span className="text-blue-300/40">/</span>
            <h1 className="text-lg font-semibold">New Loan</h1>
          </div>
        </div>
      </div>

      {/* Form - overlaps header */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-6 pb-8">
      {step === "form" ? (
      <form onSubmit={handleReview}>
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Loan Details */}
          <Card className="lg:col-span-3 shadow-lg">
            <CardHeader className="p-4 pb-2">
              <CardTitle>Loan Details</CardTitle>
              <CardDescription>Enter the loan terms</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-6">
              {/* Borrower Selection */}
              <div className="space-y-2">
                <Label htmlFor="contactId">Borrower</Label>
                <Select value={contactId} onValueChange={(v) => v && setContactId(v)}>
                  <SelectTrigger>
                    {selectedContact ? (
                      <span className="inline-flex items-center gap-2">
                        <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span>{selectedContact.name}</span>
                        {selectedContact.phone && (
                          <span className="text-muted-foreground">({selectedContact.phone})</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Select a borrower...</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        <span className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {contact.name}
                          {contact.phone && (
                            <span className="text-muted-foreground">({contact.phone})</span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {contacts.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No contacts yet.{" "}
                    <Link to="/contacts/new" className="text-primary hover:underline">
                      Add one first
                    </Link>
                  </p>
                )}
              </div>

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
                      max="100"
                      step="0.5"
                      placeholder="5"
                      value={interestRate}
                      onChange={(e) => setInterestRate(e.target.value)}
                      className="pr-16"
                      required
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">% / mo</span>
                  </div>
                </div>
              </div>

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
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">months</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentFrequency">Payment Frequency</Label>
                  <Select value={paymentFrequency} onValueChange={(v) => setPaymentFrequency(v as typeof paymentFrequency)}>
                    <SelectTrigger>
                      {{ monthly: "Monthly", semimonthly: "Semi-monthly", biweekly: "Bi-weekly", weekly: "Weekly", daily: "Daily" }[paymentFrequency]}
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

              {/* Start Date */}
              <div className="space-y-2">
                <Label>Start Date</Label>
                <DatePicker
                  value={startDate}
                  onChange={(date) => date && setStartDate(date)}
                />
              </div>

              <Separator />

              {/* Purpose (Optional) */}
              <div className="space-y-3">
                <Label>Purpose <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <div className="flex flex-wrap gap-2">
                  {PURPOSE_TEMPLATES.map((template) => (
                    <Button
                      key={template.label}
                      type="button"
                      variant={purpose === template.label ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPurpose(purpose === template.label ? "" : template.label)}
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

              {/* Collateral (Optional) */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={hasCollateral}
                    onCheckedChange={(checked) => setHasCollateral(!!checked)}
                  />
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">This loan has collateral</span>
                  </div>
                </label>
                {hasCollateral && (
                  <Textarea
                    value={collateralDescription}
                    onChange={(e) => setCollateralDescription(e.target.value)}
                    placeholder="Describe the collateral (e.g., Vehicle - Honda Click 150, 2020 model, OR/CR available)"
                    rows={3}
                  />
                )}
              </div>

              <Separator />

              {/* Co-maker (Optional) */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={hasCoMaker}
                    onCheckedChange={(checked) => setHasCoMaker(!!checked)}
                  />
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Add co-maker / guarantor</span>
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
                        <Label htmlFor="coMakerRelationship">Relationship</Label>
                        <Input
                          id="coMakerRelationship"
                          value={coMakerRelationship}
                          onChange={(e) => setCoMakerRelationship(e.target.value)}
                          placeholder="e.g., Spouse, Parent"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Calculations */}
          <Card className="lg:col-span-2 h-fit shadow-lg">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              {selectedContact && (
                <div className="flex items-center gap-3 p-3 rounded bg-secondary mb-4">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {selectedContact.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">{selectedContact.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedContact.phone || "No phone"}</p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Principal</span>
                  <span className="font-medium">{formatCurrency(parseFloat(principal) || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Interest</span>
                  <span className="font-medium">{formatCurrency(calculations.totalInterest)}</span>
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
                  <span className="font-medium">{calculations.paymentsCount}x</span>
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

        <div className="flex gap-3 mt-6">
          <Link to="/loans">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={!contactId}>
            Review Loan
          </Button>
        </div>
      </form>
      ) : (
      /* Review Step */
      <div className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader className="p-4 pb-2">
            <CardTitle>Review Loan Details</CardTitle>
            <CardDescription>Please confirm the loan details before creating</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-6">
            {/* Borrower Info */}
            {selectedContact && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Borrower</h4>
                <div className="flex items-center gap-3 p-3 rounded bg-secondary">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {selectedContact.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{selectedContact.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedContact.phone || "No phone"}</p>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* Loan Terms */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Loan Terms</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Principal</span>
                  <span className="font-medium">{formatCurrency(parseFloat(principal) || 0)}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Interest Rate</span>
                  <span className="font-medium">{interestRate}% / month</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Term</span>
                  <span className="font-medium">{termMonths} months</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Frequency</span>
                  <span className="font-medium capitalize">{paymentFrequency}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Start Date</span>
                  <span className="font-medium">{format(startDate, "MMMM d, yyyy")}</span>
                </div>
                {purpose && (
                  <div className="flex justify-between p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">Purpose</span>
                    <span className="font-medium">{purpose}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Summary */}
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Interest</span>
                  <span className="font-medium">{formatCurrency(calculations.totalInterest)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Number of Payments</span>
                  <span className="font-medium">{calculations.paymentsCount}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Each Payment</span>
                  <span className="font-medium">{formatCurrency(calculations.paymentAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Total to Repay</span>
                  <span className="font-bold text-primary">{formatCurrency(calculations.totalToRepay)}</span>
                </div>
              </div>
            </div>

            {/* Collateral */}
            {hasCollateral && collateralDescription && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Collateral</h4>
                <p className="p-3 rounded bg-muted/50 text-sm">{collateralDescription}</p>
              </div>
            )}

            {/* Co-maker */}
            {hasCoMaker && coMakerName && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Co-maker / Guarantor</h4>
                <div className="p-3 rounded bg-muted/50 text-sm space-y-1">
                  <p><span className="text-muted-foreground">Name:</span> {coMakerName}</p>
                  {coMakerPhone && <p><span className="text-muted-foreground">Phone:</span> {coMakerPhone}</p>}
                  {coMakerRelationship && <p><span className="text-muted-foreground">Relationship:</span> {coMakerRelationship}</p>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <div className="p-3 rounded bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => setStep("form")} disabled={loading}>
            Back to Edit
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Spinner className="h-4 w-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              <>
                <CurrencyCircleDollar className="h-4 w-4 mr-2" />
                Create Loan
              </>
            )}
          </Button>
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
