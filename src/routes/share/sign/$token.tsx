import { createFileRoute, Link } from "@tanstack/react-router"
import { useState, useEffect, useRef } from "react"
import { getSigningDocument, initiatePublicOtp, verifyPublicOtp } from "@/server/signatures"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { LoonaBrand, FloatingCircle } from "@/components/ui/loona-brand"
import { Stagger, StaggerItem } from "@/components/ui/stagger"
import { Spinner, Check, Warning, ShieldCheck } from "@phosphor-icons/react"
import { motion } from "framer-motion"
import { format } from "date-fns"
import { useDocColors } from "@/lib/utils/share"
import { calculateEIR, formatEIR } from "@/lib/utils/eir"
import { parsePenaltyConfig, formatPenaltyForDisclosure } from "@/lib/constants/penalty-defaults"
import {
  parseCustomClauses,
  resolveClause,
  CLAUSE_KEYS,
  type ClauseKey,
} from "@/lib/constants/promissory-clauses"

export const Route = createFileRoute("/share/sign/$token")({
  loader: async ({ params }) => {
    try {
      const result = await getSigningDocument({ data: params.token })
      return { result, token: params.token }
    } catch {
      return { result: { error: "invalid" as const }, token: params.token }
    }
  },
  component: SigningPage,
})

type SigningResult = NonNullable<Awaited<ReturnType<typeof getSigningDocument>>>

function formatCurrency(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

const RESEND_COOLDOWN = 60
const RESEND_OTP_EXPIRY_MINUTES = 10

function SigningPage() {
  const { result, token } = Route.useLoaderData()
  const [signed, setSigned] = useState(false)
  const [otpCode, setOtpCode] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [signedAt, setSignedAt] = useState<string | null>(null)
  const [resendEmail, setResendEmail] = useState<string | null>(null)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current)
    }
  }, [])

  if (result.error === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-page">
        <div className="text-center space-y-2">
          <Warning className="h-12 w-12 text-amber-500 mx-auto" />
          <h1 className="text-2xl font-bold">Invalid Signing Link</h1>
          <p className="text-muted-foreground">
            This signing link is invalid or has expired.
          </p>
        </div>
      </div>
    )
  }

  if (result.error === "already_signed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-page">
        <div className="text-center space-y-2">
          <Check className="h-12 w-12 text-green-500 mx-auto" weight="bold" />
          <h1 className="text-2xl font-bold">Already Signed</h1>
          <p className="text-muted-foreground">
            This document has already been signed.
          </p>
        </div>
      </div>
    )
  }

  if (result.error || !result.loan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-page">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-muted-foreground">Please try again later.</p>
        </div>
      </div>
    )
  }

  const { loan, documentType, signerName, signerEmail: maskedEmailFromResult, docStyle } = result
  const docTitle = documentType === "disclosure" ? "Disclosure Statement" : "Promissory Note"
  const c = useDocColors(false)
  const maskedEmail = resendEmail ?? maskedEmailFromResult

  const startCooldown = () => {
    setResendCooldown(RESEND_COOLDOWN)
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await initiatePublicOtp({ data: { token } })
      setResendEmail(res.email)
      startCooldown()
      setOtpCode("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to resend code")
    } finally {
      setSubmitting(false)
    }
  }

  const handleOtpChange = async (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 6)
    setOtpCode(digits)
    setError(null)

    if (digits.length === 6) {
      setSubmitting(true)
      try {
        const res = await verifyPublicOtp({ data: { token, code: digits } })
        setSignedAt(res.signedAt)
        setSigned(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Invalid code")
      } finally {
        setSubmitting(false)
      }
    }
  }

  if (signed) {
    return (
      <div className="min-h-screen bg-gradient-page relative overflow-hidden">
        <FloatingCircle
          className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2"
          delay={0} duration={8}
        />
        <FloatingCircle
          className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/2"
          delay={0.5} duration={7}
        />
        <nav className="relative z-10 flex items-center justify-between px-6 sm:px-12 py-6">
          <LoonaBrand size="sm" variant="gradient" animated={false} />
          <Badge variant="outline">Document Signing</Badge>
        </nav>
        <div className="relative z-10 mx-auto max-w-3xl px-4 py-16 text-center space-y-3">
          <ShieldCheck className="h-16 w-16 text-green-500 mx-auto" weight="fill" />
          <h1 className="text-2xl font-bold">Document Signed</h1>
          <p className="text-muted-foreground">
            Thank you, {signerName}. Your identity has been verified and the {docTitle} has been signed.
          </p>
          {signedAt && (
            <p className="text-sm text-muted-foreground">
              Signed on {format(new Date(signedAt), "MMMM d, yyyy 'at' h:mm a")}
            </p>
          )}
          <p className="text-sm text-muted-foreground">You may close this page.</p>
        </div>
        <footer className="relative z-10 px-6 sm:px-12 py-6 flex justify-center gap-6 text-xs text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
        </footer>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-page relative overflow-hidden">
      <FloatingCircle
        className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2"
        delay={0} duration={8}
      />
      <FloatingCircle
        className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/2"
        delay={0.5} duration={7}
      />

      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-12 py-6">
        <LoonaBrand size="sm" variant="gradient" animated={false} />
        <Badge variant="outline">Document Signing</Badge>
      </nav>

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Stagger className="space-y-4">
            {/* Info Card */}
            <StaggerItem>
              <Card>
                <CardHeader>
                  <CardTitle>{docTitle}</CardTitle>
                  <CardDescription>
                    {signerName}, please review the document below, then sign using your registered email address.
                  </CardDescription>
                </CardHeader>
              </Card>
            </StaggerItem>

            {/* Document Zone */}
            <StaggerItem>
              <div
                className="shadow-lg rounded-lg overflow-hidden"
                style={{
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  backgroundColor: c.bg,
                  color: c.text,
                }}
              >
                <div className="p-8">
                  {documentType === "disclosure" ? (
                    <DisclosureDocumentBody loan={loan} c={c} />
                  ) : (
                    <PromissoryDocumentBody loan={loan} c={c} docStyle={docStyle ?? "full"} />
                  )}
                </div>
              </div>
            </StaggerItem>

            {/* Sign Card */}
            <StaggerItem>
              <Card>
                <CardHeader>
                  <CardTitle>Sign Document</CardTitle>
                  <CardDescription>
                    Enter the 6-digit code sent to{maskedEmail ? ` ${maskedEmail}` : " your email"} to sign this {docTitle.toLowerCase()}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => handleOtpChange(e.target.value)}
                    disabled={submitting}
                    maxLength={6}
                    className="text-center text-2xl tracking-[0.5em] font-mono h-14"
                    autoFocus
                  />

                  {submitting && (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Spinner className="h-4 w-4 animate-spin" />
                      Verifying...
                    </div>
                  )}

                  {error && <p className="text-sm text-destructive text-center">{error}</p>}

                  <div className="text-center">
                    <button
                      onClick={handleResend}
                      disabled={resendCooldown > 0 || submitting}
                      className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
                    >
                      {resendCooldown > 0
                        ? `Resend code in ${resendCooldown}s`
                        : "Didn't receive a code? Resend"}
                    </button>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          </Stagger>
        </motion.div>
      </div>

      <footer className="relative z-10 px-6 sm:px-12 py-6 flex justify-center gap-6 text-xs text-muted-foreground">
        <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
        <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
      </footer>
    </div>
  )
}

// ============================================================================
// Document rendering components
// ============================================================================

type LoanData = NonNullable<Extract<SigningResult, { error: null }>["loan"]>
type DocColors = ReturnType<typeof useDocColors>

function VerifiedBadge({ name, date }: { name: string; date?: string | null }) {
  return (
    <div style={{ marginTop: "8px", fontSize: "12px", color: "#16a34a", display: "flex", alignItems: "center", gap: "4px" }}>
      <span>✓ Digitally signed by {name}</span>
      {date && <span style={{ color: "#6b7280" }}>on {format(new Date(date), "MMM d, yyyy")}</span>}
    </div>
  )
}

function SignatureLine({ name, label, borderColor, mutedColor, signedAt }: {
  name: string
  label: string
  borderColor: string
  mutedColor: string
  signedAt?: string | null
}) {
  return (
    <div style={{ textAlign: "center" }}>
      {signedAt ? (
        <div style={{ borderBottom: `2px solid ${borderColor}`, paddingBottom: "8px", marginBottom: "8px", minHeight: "40px", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <VerifiedBadge name={name} date={signedAt} />
        </div>
      ) : (
        <div style={{ borderBottom: `2px solid ${borderColor}`, height: "40px", marginBottom: "8px" }} />
      )}
      <p style={{ fontSize: "12px", color: mutedColor }}>{label}</p>
      <p style={{ fontSize: "13px", fontWeight: 600, marginTop: "4px" }}>{name}</p>
    </div>
  )
}

function DisclosureDocumentBody({
  loan,
  c,
}: {
  loan: LoanData
  c: DocColors
}) {
  const principal = parseFloat(loan.principal)
  const totalToRepay = parseFloat(loan.totalToRepay)
  const totalInterest = totalToRepay - principal

  const eir = calculateEIR({
    principal,
    totalInterest,
    termMonths: loan.termMonths,
    paymentFrequency: loan.paymentFrequency as any,
  })

  const frequencyLabels: Record<string, string> = {
    daily: "Daily",
    weekly: "Weekly",
    biweekly: "Bi-weekly",
    semimonthly: "Semi-monthly",
    monthly: "Monthly",
  }

  const penaltyConfig = loan.penaltyConfig
    ? parsePenaltyConfig(loan.penaltyConfig)
    : null

  const processingFee = loan.processingFeePercent
    ? parseFloat(loan.processingFeePercent) * principal / 100
    : null
  const netProceeds = processingFee != null ? principal - processingFee : null

  const baseRows = [
    { label: "Principal Amount", value: formatCurrency(principal), bold: true },
    { label: "Finance Charges (Total Interest)", value: formatCurrency(totalInterest), bold: true },
    { label: "Total Amount Financed", value: formatCurrency(principal) },
    { label: "Total Amount to be Paid", value: formatCurrency(totalToRepay), bold: true },
    { label: "Nominal Interest Rate (Monthly)", value: `${loan.interestRate}% per month` },
    { label: "Effective Interest Rate (EIR) Per Annum", value: formatEIR(eir), bold: true },
    { label: "Loan Term", value: `${loan.termMonths} month${loan.termMonths !== 1 ? "s" : ""}` },
    { label: "Payment Frequency", value: frequencyLabels[loan.paymentFrequency] || loan.paymentFrequency },
    { label: "Regular Payment Amount", value: formatCurrency(loan.paymentAmount), bold: true },
    { label: "Number of Payments", value: loan.schedule.length.toString() },
    {
      label: "First Payment Due Date",
      value: loan.schedule.length > 0 ? format(new Date(loan.schedule[0].dueDate), "MMMM d, yyyy") : "—",
    },
    { label: "Maturity Date", value: loan.maturityDate ? format(new Date(loan.maturityDate), "MMMM d, yyyy") : "—" },
    ...(processingFee != null ? [
      { label: `Processing Fee (${loan.processingFeePercent}%)`, value: formatCurrency(processingFee) },
      { label: "Net Proceeds (Disbursed Amount)", value: formatCurrency(netProceeds!), bold: true },
    ] : []),
    { label: "Late Payment Penalty", value: penaltyConfig ? formatPenaltyForDisclosure(penaltyConfig, loan.paymentFrequency) : "None" },
    { label: "Default / Acceleration Charges", value: "None" },
    { label: "Prepayment Policy", value: "No penalty for early repayment" },
  ]

  return (
    <>
      <div
        className="text-center pb-6 mb-6"
        style={{ borderBottom: `2px solid ${c.border}` }}
      >
        <h1
          className="font-bold uppercase tracking-wide"
          style={{ fontSize: "20px", marginBottom: "8px", color: c.textStrong }}
        >
          Loan Disclosure Statement
        </h1>
        <p style={{ fontSize: "13px", color: c.muted }}>
          Full transparency of credit terms and cost of borrowing
        </p>
      </div>

      <div
        className="grid grid-cols-2 gap-8 mb-8"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}
      >
        <div>
          <h2 className="font-semibold uppercase mb-2" style={{ fontSize: "11px", color: c.muted }}>
            Lender / Creditor
          </h2>
          <p className="font-medium" style={{ fontSize: "14px" }}>
            {loan.lenderName || "—"}
          </p>
        </div>
        <div>
          <h2 className="font-semibold uppercase mb-2" style={{ fontSize: "11px", color: c.muted }}>
            Borrower / Debtor
          </h2>
          <p className="font-medium" style={{ fontSize: "14px" }}>
            {loan.contact.name}
          </p>
          {loan.contact.address && (
            <p style={{ fontSize: "12px", color: c.muted }}>
              {loan.contact.address}
              {loan.contact.city && `, ${loan.contact.city}`}
            </p>
          )}
          {loan.contact.phone && (
            <p style={{ fontSize: "12px", color: c.muted }}>{loan.contact.phone}</p>
          )}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="font-semibold mb-4" style={{ fontSize: "16px", color: c.textStrong }}>
          Credit Terms
        </h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <tbody>
            {baseRows.map((row, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? c.rowAlt : c.rowEven }}>
                <td style={{ padding: "10px 12px", border: `1px solid ${c.border}`, fontWeight: 500 }}>
                  {i + 1}. {row.label}
                </td>
                <td style={{ padding: "10px 12px", border: `1px solid ${c.border}`, textAlign: "right", fontWeight: row.bold ? 600 : 400 }}>
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-8" style={{ pageBreakInside: "avoid" }}>
        <h2 className="font-semibold mb-4" style={{ fontSize: "16px", color: c.textStrong }}>
          Payment Schedule
        </h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ backgroundColor: c.headerBg }}>
              {["#", "Due Date", "Amount"].map((h) => (
                <th key={h} style={{ padding: "8px 10px", border: `1px solid ${c.borderStrong}`, textAlign: h === "Amount" ? "right" : "left", fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loan.schedule.map((item, index) => (
              <tr key={item.id} style={{ backgroundColor: index % 2 === 0 ? c.rowEven : c.rowAlt }}>
                <td style={{ padding: "6px 10px", border: `1px solid ${c.border}` }}>{index + 1}</td>
                <td style={{ padding: "6px 10px", border: `1px solid ${c.border}` }}>
                  {format(new Date(item.dueDate), "MMM d, yyyy")}
                </td>
                <td style={{ padding: "6px 10px", border: `1px solid ${c.border}`, textAlign: "right" }}>
                  {formatCurrency(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ borderTop: `2px solid ${c.border}`, paddingTop: "24px", marginTop: "24px" }}>
        <h2 className="font-semibold mb-4" style={{ fontSize: "16px", color: c.textStrong }}>
          Borrower's Acknowledgment
        </h2>
        <p style={{ fontSize: "13px", lineHeight: "1.6", marginBottom: "24px", color: c.text }}>
          I/We acknowledge receipt of this Loan Disclosure Statement
          and confirm that I/we have read and understood all the terms
          and conditions stated herein, including the total cost of
          borrowing and the Effective Interest Rate (EIR). I/We agree
          to the credit terms as disclosed above.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: loan.coMakerName ? "1fr 1fr" : "1fr",
            gap: "32px",
            marginTop: "48px",
          }}
        >
          <SignatureLine
            name={loan.contact.name}
            label="Borrower's Signature over Printed Name"
            borderColor={c.borderStrong}
            mutedColor={c.muted}
          />
          {loan.coMakerName && (
            <SignatureLine
              name={loan.coMakerName}
              label="Co-maker's Signature over Printed Name"
              borderColor={c.borderStrong}
              mutedColor={c.muted}
            />
          )}
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${c.border}`, marginTop: "48px", paddingTop: "16px", textAlign: "center", fontSize: "11px", color: c.muted }}>
        <p>Document generated on {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}</p>
      </div>
    </>
  )
}

function PromissoryDocumentBody({
  loan,
  c,
  docStyle = "full",
}: {
  loan: LoanData
  c: DocColors
  docStyle?: "full" | "simple"
}) {
  const principal = parseFloat(loan.principal)
  const interestPerAnnum = parseFloat(loan.interestRate) * 12
  const parsedClauses = parseCustomClauses(loan.customClauses ?? null)
  const SIMPLE_CLAUSE_KEYS: ClauseKey[] = ["default"]
  const activeClauses = docStyle === "simple" ? SIMPLE_CLAUSE_KEYS : CLAUSE_KEYS

  const freqLabel =
    {
      daily: "daily",
      weekly: "weekly",
      biweekly: "bi-weekly",
      semimonthly: "semi-monthly",
      monthly: "monthly",
    }[loan.paymentFrequency] || loan.paymentFrequency

  const firstDueDate =
    loan.schedule.length > 0
      ? format(new Date(loan.schedule[0].dueDate), "MMMM d, yyyy")
      : "—"
  const maturityDate = loan.maturityDate
    ? format(new Date(loan.maturityDate), "MMMM d, yyyy")
    : "—"

  const CLAUSE_DOC_LABELS: Record<ClauseKey, string> = {
    default: "Default.",
    acceleration: "Acceleration Clause.",
    attorneysFees: "Attorney's Fees and Collection Costs.",
    waiver: "Waiver of Demand and Notice.",
    venue: "Venue.",
  }

  return (
    <>
      <div
        className="text-center pb-6 mb-6"
        style={{ borderBottom: `2px solid ${c.border}` }}
      >
        <h1
          className="font-bold uppercase tracking-wide"
          style={{ fontSize: "22px", marginBottom: "4px", color: c.textStrong }}
        >
          Promissory Note
        </h1>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "24px" }}>
        <div>
          <span style={{ color: c.muted }}>Date: </span>
          <span style={{ fontWeight: 500 }}>
            {loan.startDate ? format(new Date(loan.startDate), "MMMM d, yyyy") : format(new Date(), "MMMM d, yyyy")}
          </span>
        </div>
        <div>
          <span style={{ color: c.muted }}>Place: </span>
          <span style={{ fontWeight: 500 }}>Philippines</span>
        </div>
      </div>

      <div
        style={{
          border: `2px solid #1e3a5f`,
          borderRadius: "8px",
          padding: "16px 20px",
          marginBottom: "24px",
          backgroundColor: "#f0f7ff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <span style={{ fontSize: "13px", color: c.muted, fontWeight: 500 }}>Principal Amount</span>
          <span style={{ fontSize: "20px", fontWeight: 700 }}>{formatCurrency(principal)}</span>
        </div>
      </div>

      <div style={{ marginBottom: "24px" }}>
        <p style={{ fontSize: "13px", lineHeight: "1.8", color: c.text, textAlign: "justify" }}>
          I/We, <span style={{ fontWeight: 600 }}>{loan.contact.name}</span>,
          (hereinafter referred to as the "Borrower/Maker"), for value received,
          hereby promise to pay <span style={{ fontWeight: 600 }}>{loan.lenderName}</span>{" "}
          (hereinafter referred to as the "Lender/Payee"), the sum of{" "}
          <span style={{ fontWeight: 600 }}>{formatCurrency(principal)}</span>,
          Philippine Currency, under the following terms and conditions:
        </p>
      </div>

      <div style={{ marginBottom: "24px" }}>
        <h2 className="font-semibold mb-4" style={{ fontSize: "16px", color: c.textStrong }}>
          Terms and Conditions
        </h2>
        <div style={{ fontSize: "13px", lineHeight: "1.8", color: c.text }}>
          <ol style={{ paddingLeft: "20px", margin: 0, listStyleType: "decimal" }}>
            <li style={{ marginBottom: "12px", textAlign: "justify" }}>
              <span style={{ fontWeight: 600 }}>Interest Rate.</span>{" "}
              This note shall bear interest at the rate of{" "}
              <span style={{ fontWeight: 600 }}>{loan.interestRate}% per month</span>{" "}
              ({interestPerAnnum}% per annum), computed on the outstanding principal balance.
            </li>
            <li style={{ marginBottom: "12px", textAlign: "justify" }}>
              <span style={{ fontWeight: 600 }}>Payment Terms.</span>{" "}
              The total amount due of <span style={{ fontWeight: 600 }}>{formatCurrency(loan.totalToRepay)}</span>{" "}
              (principal plus interest) shall be paid in{" "}
              <span style={{ fontWeight: 600 }}>{loan.schedule.length} {freqLabel} installments</span>{" "}
              of <span style={{ fontWeight: 600 }}>{formatCurrency(loan.paymentAmount)} each</span>,
              commencing on <span style={{ fontWeight: 600 }}>{firstDueDate}</span>{" "}
              and every {freqLabel} period thereafter until fully paid,
              with the final payment due on <span style={{ fontWeight: 600 }}>{maturityDate}</span>.
            </li>
            {activeClauses.map((key) => (
              <li key={key} style={{ marginBottom: "12px", textAlign: "justify" }}>
                <span style={{ fontWeight: 600 }}>{CLAUSE_DOC_LABELS[key]}</span>{" "}
                {resolveClause(key, parsedClauses).en}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {docStyle === "full" && loan.collateralDescription && (
        <div style={{ marginBottom: "24px" }}>
          <h2 className="font-semibold mb-3" style={{ fontSize: "16px", color: c.textStrong }}>
            Collateral / Security
          </h2>
          <div style={{ padding: "12px 16px", backgroundColor: c.mutedBg, borderRadius: "6px", fontSize: "13px" }}>
            {loan.collateralDescription}
          </div>
        </div>
      )}

      {docStyle === "full" && loan.coMakerName && (
        <div style={{ marginBottom: "24px" }}>
          <h2 className="font-semibold mb-3" style={{ fontSize: "16px", color: c.textStrong }}>
            Co-maker's Undertaking
          </h2>
          <p style={{ fontSize: "13px", lineHeight: "1.8", color: c.text, textAlign: "justify" }}>
            I, <span style={{ fontWeight: 600 }}>{loan.coMakerName}</span>
            {loan.coMakerRelationship && <> ({loan.coMakerRelationship} of the Borrower)</>},
            hereby bind myself jointly and severally with the Borrower for the
            full and faithful payment of the obligations stated in this Promissory Note.
          </p>
        </div>
      )}

      <div style={{ borderTop: `2px solid ${c.border}`, paddingTop: "24px", marginTop: "32px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: loan.coMakerName && docStyle === "full" ? "1fr 1fr" : "1fr",
            gap: "32px",
            marginBottom: "40px",
          }}
        >
          <SignatureLine
            name={loan.contact.name}
            label="Borrower / Maker"
            borderColor={c.borderStrong}
            mutedColor={c.muted}
          />
          {docStyle === "full" && loan.coMakerName && (
            <SignatureLine
              name={loan.coMakerName}
              label="Co-maker / Guarantor"
              borderColor={c.borderStrong}
              mutedColor={c.muted}
            />
          )}
        </div>

        <div style={{ marginBottom: "40px" }}>
          <p style={{ fontSize: "11px", color: c.muted, fontWeight: 600, textTransform: "uppercase", marginBottom: "16px" }}>
            Conforme:
          </p>
          <div style={{ maxWidth: "300px" }}>
            <SignatureLine
              name={loan.lenderName || "—"}
              label="Lender / Payee"
              borderColor={c.borderStrong}
              mutedColor={c.muted}
            />
          </div>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${c.border}`, marginTop: "48px", paddingTop: "16px", textAlign: "center", fontSize: "11px", color: c.muted }}>
        <p>Document generated on {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}</p>
      </div>
    </>
  )
}
