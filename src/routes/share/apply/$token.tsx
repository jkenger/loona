import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { getApplicationFormInfo, submitLoanApplication } from "@/server/loan-applications"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { LoonaBrand, FloatingCircle } from "@/components/ui/loona-brand"
import {
  User,
  CurrencyCircleDollar,
  Briefcase,
  CheckCircle,
  Spinner,
  ShieldCheck,
  PaperPlaneTilt,
} from "@phosphor-icons/react"
import { motion } from "framer-motion"

export const Route = createFileRoute("/share/apply/$token")({
  loader: async ({ params }) => {
    try {
      const info = await getApplicationFormInfo({ data: params.token })
      return { info, token: params.token }
    } catch {
      return { info: null, token: params.token }
    }
  },
  component: LoanApplicationForm,
})

function LoanApplicationForm() {
  const { info, token } = Route.useLoaderData()
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [amount, setAmount] = useState("")
  const [termMonths, setTermMonths] = useState("")
  const [purpose, setPurpose] = useState("")
  const [monthlyIncome, setMonthlyIncome] = useState("")
  const [otherIncome, setOtherIncome] = useState("")

  if (!info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-page">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-3 p-8">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mx-auto">
            <ShieldCheck className="h-7 w-7 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold">Link Not Available</h1>
          <p className="text-sm text-muted-foreground max-w-xs">This application link is invalid or has expired. Please contact your lender for a new link.</p>
        </motion.div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-page p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="max-w-md w-full"
        >
          <Card className="rounded-2xl shadow-xl border-0 overflow-hidden">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-8 text-center relative overflow-hidden">
              <FloatingCircle className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" delay={0} duration={6} />
              <FloatingCircle className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" delay={0.3} duration={5} />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
                className="relative z-10"
              >
                <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="h-8 w-8 text-white" weight="bold" />
                </div>
                <h2 className="text-xl font-bold text-white">Application Submitted!</h2>
              </motion.div>
            </div>
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Your loan application has been sent to <strong className="text-foreground">{info.lenderName}</strong>. They will review your information and get back to you soon.
              </p>
              <div className="mt-5 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 inline-block mr-1.5 text-green-500" weight="bold" />
                Your data is private and shared only with your lender.
              </div>
            </CardContent>
          </Card>
          <div className="mt-6 text-center">
            <LoonaBrand size="sm" />
          </div>
        </motion.div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const parsedAmount = parseFloat(amount)
    if (!name.trim() || name.trim().length < 2) { setError("Please enter your full name"); return }
    if (!email.trim()) { setError("Please enter your email address"); return }
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) { setError("Please enter a valid loan amount"); return }

    setIsSubmitting(true)
    try {
      await submitLoanApplication({
        data: {
          lenderId: token,
          applicantName: name.trim(),
          applicantPhone: phone.trim() || undefined,
          applicantEmail: email.trim() || undefined,
          applicantAddress: address.trim() || undefined,
          applicantCity: city.trim() || undefined,
          requestedAmount: parsedAmount,
          requestedTermMonths: termMonths ? parseInt(termMonths) : undefined,
          purpose: purpose.trim() || undefined,
          monthlyIncome: monthlyIncome ? parseFloat(monthlyIncome) : undefined,
          otherIncome: otherIncome ? parseFloat(otherIncome) : undefined,
        },
      })
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const lenderInitial = info.lenderName.charAt(0).toUpperCase()

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left panel — branding (desktop only) */}
      <div className="hidden md:flex md:w-[420px] bg-gradient-to-br from-primary via-primary to-primary/80 p-12 flex-col items-center justify-center relative overflow-hidden shrink-0">
        <FloatingCircle className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" delay={0} duration={8} />
        <FloatingCircle className="absolute bottom-0 left-0 w-56 h-56 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" delay={0.5} duration={7} />
        <FloatingCircle className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-white/[0.03] rounded-full -translate-x-1/2 -translate-y-1/2" delay={1} duration={10} />

        <motion.div
          className="relative z-10 flex flex-col items-center text-center space-y-6 max-w-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <LoonaBrand size="lg" variant="white" animated />

          <div className="h-20 w-20 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
            <span className="text-3xl font-bold text-white">{lenderInitial}</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">{info.lenderName}</h1>
            <p className="text-white/70 text-sm">is accepting loan applications</p>
          </div>

          <div className="space-y-2 pt-4">
            {[
              "Quick and easy application",
              "No hidden fees",
              "Get a response within 24 hours",
            ].map((text) => (
              <div key={text} className="flex items-center gap-2 text-white/80 text-sm">
                <CheckCircle className="h-4 w-4 text-white/60 shrink-0" weight="bold" />
                {text}
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 overflow-y-auto">
        {/* Mobile header */}
        <div className="md:hidden bg-gradient-to-r from-primary to-primary/80 px-6 py-6 text-center">
          <LoonaBrand size="sm" variant="white" />
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-sm font-bold text-white">{lenderInitial}</span>
            </div>
            <p className="text-white/90 text-sm font-medium">{info.lenderName}</p>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-5 sm:px-8 py-8 sm:py-10">
          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h2 className="text-2xl font-bold tracking-tight hidden md:block">Loan Application</h2>
            <h2 className="text-xl font-bold tracking-tight md:hidden">Apply for a Loan</h2>
            <p className="text-sm text-muted-foreground mt-1.5">Takes about 2 minutes. Fields marked <span className="text-foreground font-medium">*</span> are required.</p>
          </motion.div>

          <motion.form
            onSubmit={handleSubmit}
            className="space-y-8"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {/* ── Section 1: Personal Information ── */}
            <Card className="rounded-2xl shadow-sm border-0 bg-card ring-1 ring-border/60">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-muted-foreground" weight="bold" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold">About You</h3>
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">1 of 3</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Let's start with your contact details</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-medium text-foreground">Full Name <span className="text-destructive">*</span></Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Juan dela Cruz" className="mt-1.5 h-11 rounded-lg" required />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium text-foreground">Phone Number</Label>
                      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 09171234567" className="mt-1.5 h-11 rounded-lg" />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-foreground">Email Address <span className="text-destructive">*</span></Label>
                      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. juan@email.com" className="mt-1.5 h-11 rounded-lg" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium text-foreground">Home Address</Label>
                      <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, Barangay" className="mt-1.5 h-11 rounded-lg" />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-foreground">City / Municipality</Label>
                      <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Quezon City" className="mt-1.5 h-11 rounded-lg" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Section 2: Loan Details ── */}
            <Card className="rounded-2xl shadow-sm border-0 bg-card ring-1 ring-border/60">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <CurrencyCircleDollar className="h-5 w-5 text-muted-foreground" weight="bold" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold">Loan Details</h3>
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">2 of 3</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">How much do you need and what is it for?</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium text-foreground">Loan Amount (₱) <span className="text-destructive">*</span></Label>
                      <Input type="number" min="0" step="100" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 10000" className="mt-1.5 h-11 rounded-lg" required />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-foreground">Preferred Term (months)</Label>
                      <Input type="number" min="1" max="60" value={termMonths} onChange={(e) => setTermMonths(e.target.value)} placeholder="e.g. 6" className="mt-1.5 h-11 rounded-lg" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-foreground">Purpose of Loan</Label>
                    <Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Business capital, home improvement, emergency expenses..." rows={3} className="mt-1.5 rounded-lg text-sm" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Section 3: Income (optional, lighter style) ── */}
            <Card className="rounded-2xl shadow-sm border-0 bg-muted/30 dark:bg-muted/10 ring-1 ring-border/40">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <Briefcase className="h-5 w-5 text-muted-foreground" weight="bold" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-muted-foreground">Income</h3>
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">3 of 3</span>
                      <span className="text-[10px] font-medium text-muted-foreground/70 italic">Optional</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Sharing this helps your lender review faster</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Monthly Income (₱)</Label>
                    <Input type="number" min="0" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} placeholder="e.g. 25000" className="mt-1.5 h-11 rounded-lg bg-background" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Other Income (₱)</Label>
                    <Input type="number" min="0" value={otherIncome} onChange={(e) => setOtherIncome(e.target.value)} placeholder="e.g. 5000" className="mt-1.5 h-11 rounded-lg bg-background" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive flex items-start gap-2"
              >
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" weight="bold" />
                {error}
              </motion.div>
            )}

            {/* Submit */}
            <div className="pt-1">
              <Button type="submit" className="w-full h-12 gap-2.5 text-sm font-semibold rounded-xl shadow-[0_0_16px_hsl(var(--primary)/0.25)]" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Spinner className="h-4.5 w-4.5 animate-spin" />Submitting your application...</>
                ) : (
                  <><PaperPlaneTilt className="h-4.5 w-4.5" weight="bold" />Submit Application</>
                )}
              </Button>
            </div>

            {/* Privacy note */}
            <p className="text-center text-[11px] text-muted-foreground pb-4">
              <ShieldCheck className="h-3.5 w-3.5 inline-block mr-1 align-[-2px]" weight="bold" />
              Your information is shared only with {info.lenderName} and is never sold.
            </p>
          </motion.form>
        </div>
      </div>
    </div>
  )
}
