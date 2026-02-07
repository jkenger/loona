import { createFileRoute, Link } from "@tanstack/react-router"
import { useRef, useState, useEffect } from "react"
import { getLoan } from "@/server/loans"
import { Button } from "@/components/ui/button"
import { SkeletonDetailPage } from "@/components/ui/skeleton"
import { AccessDenied } from "@/components/access-denied"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { calculateEIR, formatEIR } from "@/lib/utils/eir"
import { ArrowLeft, FilePdf, Spinner } from "@phosphor-icons/react"
import { format } from "date-fns"

export const Route = createFileRoute("/_dashboard/loans/$loanId/disclosure")({
  loader: async ({ params, context }) => {
    const { session } = context as {
      session: { user: { role: string | null; name: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      return { loan: null, unauthorized: true, lenderName: null }
    }

    try {
      const loan = await getLoan({ data: params.loanId })
      if (!loan.isLender) {
        return { loan: null, unauthorized: true, lenderName: null }
      }
      return { loan, unauthorized: false, lenderName: session.user.name }
    } catch {
      return { loan: null, unauthorized: false, lenderName: null }
    }
  },
  pendingComponent: SkeletonDetailPage,
  component: DisclosurePage,
})

function useDocColors(pdfMode: boolean) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const check = () =>
      setIsDark(document.documentElement.classList.contains("dark"))
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })
    return () => observer.disconnect()
  }, [])

  const dark = isDark && !pdfMode

  return {
    bg: dark ? "#1e293b" : "white",
    text: dark ? "#e2e8f0" : "#374151",
    textStrong: dark ? "#f1f5f9" : "#111827",
    muted: dark ? "#94a3b8" : "#6b7280",
    border: dark ? "#334155" : "#e5e7eb",
    borderStrong: dark ? "#475569" : "#d1d5db",
    borderSignature: dark ? "#94a3b8" : "#374151",
    rowAlt: dark ? "#253349" : "#f9fafb",
    rowEven: dark ? "#1e293b" : "white",
    highlight: dark ? "#1e3a5f" : "#dbeafe",
    mutedBg: dark ? "#334155" : "#f3f4f6",
    headerBg: dark ? "#334155" : "#e5e7eb",
  }
}

function DisclosurePage() {
  const { loan, unauthorized, lenderName } = Route.useLoaderData()
  const documentRef = useRef<HTMLDivElement>(null)
  const [generating, setGenerating] = useState(false)
  const [pdfMode, setPdfMode] = useState(false)
  const [lang, setLang] = useState<"en" | "fil">("en")
  const c = useDocColors(pdfMode)

  if (unauthorized) {
    return (
      <AccessDenied
        message="Only lenders can access disclosure statements."
        homeLink="/agent"
        homeLinkLabel="Go to Agent Portal"
      />
    )
  }

  if (!loan) {
    return (
      <AccessDenied
        title="Loan Not Found"
        message="This loan doesn't exist or you don't have access to it."
        homeLink="/loans"
        homeLinkLabel="Back to Loans"
      />
    )
  }

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

  const handleGeneratePDF = async () => {
    if (!documentRef.current) return

    setGenerating(true)
    setPdfMode(true)
    // Wait for React to re-render with light colors
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r))
    )

    try {
      const html2pdf = (await import("html2pdf.js")).default

      const element = documentRef.current
      const filename = `disclosure-${loan.contact.name.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}.pdf`

      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
        },
        jsPDF: {
          unit: "mm" as const,
          format: "a4" as const,
          orientation: "portrait" as const,
        },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] as const },
      }

      await html2pdf().set(opt).from(element).save()
    } catch (error) {
      console.error("Failed to generate PDF:", error)
    } finally {
      setPdfMode(false)
      setGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Controls Header */}
      <div className="bg-[hsl(215_45%_14%)] text-white py-4 sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link
              to="/loans/$loanId"
              params={{ loanId: loan.id }}
              className="inline-flex items-center gap-2 text-sm text-blue-200/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Loan Details
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-lg bg-white/10 p-1">
                <button
                  onClick={() => setLang("en")}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    lang === "en"
                      ? "bg-white text-slate-900"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLang("fil")}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    lang === "fil"
                      ? "bg-white text-slate-900"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  FIL
                </button>
              </div>
              <Button
                onClick={handleGeneratePDF}
                disabled={generating}
                className="gap-2"
              >
                {generating ? (
                  <>
                    <Spinner className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FilePdf className="h-4 w-4" weight="bold" />
                    Download PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Document Preview */}
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <div
          ref={documentRef}
          className="shadow-lg rounded-lg overflow-hidden"
          style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            backgroundColor: c.bg,
            color: c.text,
          }}
        >
          {/* Document Content with inline styles for PDF consistency */}
          <div className="p-8">
            {/* Header */}
            <div
              className="text-center pb-6 mb-6"
              style={{ borderBottom: `2px solid ${c.border}` }}
            >
              <h1
                className="font-bold uppercase tracking-wide"
                style={{
                  fontSize: "20px",
                  marginBottom: "8px",
                  color: c.textStrong,
                }}
              >
                Truth in Lending Disclosure Statement
              </h1>
              <p style={{ fontSize: "13px", color: c.muted }}>
                Pursuant to Republic Act No. 3765 (Truth in Lending Act)
              </p>
            </div>

            {/* Lender & Borrower Information */}
            <div
              className="grid grid-cols-2 gap-8 mb-8"
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}
            >
              <div>
                <h2
                  className="font-semibold uppercase mb-2"
                  style={{ fontSize: "11px", color: c.muted }}
                >
                  Lender / Creditor
                </h2>
                <p className="font-medium" style={{ fontSize: "14px" }}>
                  {lenderName || "—"}
                </p>
              </div>
              <div>
                <h2
                  className="font-semibold uppercase mb-2"
                  style={{ fontSize: "11px", color: c.muted }}
                >
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
                  <p style={{ fontSize: "12px", color: c.muted }}>
                    {loan.contact.phone}
                  </p>
                )}
              </div>
            </div>

            {/* Credit Terms Table */}
            <div className="mb-8">
              <h2
                className="font-semibold mb-4"
                style={{ fontSize: "16px", color: c.textStrong }}
              >
                Credit Terms
              </h2>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "13px",
                }}
              >
                <tbody>
                  {[
                    {
                      label: "1. Principal Amount",
                      value: formatCurrency(principal),
                      bold: true,
                    },
                    {
                      label: "2. Finance Charges (Total Interest)",
                      value: formatCurrency(totalInterest),
                      bold: true,
                    },
                    {
                      label: "3. Total Amount Financed",
                      value: formatCurrency(principal),
                    },
                    {
                      label: "4. Total Amount to be Paid",
                      value: formatCurrency(totalToRepay),
                      bold: true,
                    },
                    {
                      label: "5. Nominal Interest Rate (Monthly)",
                      value: `${loan.interestRate}% per month`,
                    },
                    {
                      label: "6. Effective Interest Rate (EIR) Per Annum",
                      value: formatEIR(eir),
                      highlight: true,
                      bold: true,
                    },
                    {
                      label: "7. Loan Term",
                      value: `${loan.termMonths} month${loan.termMonths !== 1 ? "s" : ""}`,
                    },
                    {
                      label: "8. Payment Frequency",
                      value:
                        frequencyLabels[loan.paymentFrequency] ||
                        loan.paymentFrequency,
                    },
                    {
                      label: "9. Regular Payment Amount",
                      value: formatCurrency(loan.paymentAmount),
                      bold: true,
                    },
                    {
                      label: "10. Number of Payments",
                      value: loan.schedule.length.toString(),
                    },
                    {
                      label: "11. First Payment Due Date",
                      value:
                        loan.schedule.length > 0
                          ? format(
                              new Date(loan.schedule[0].dueDate),
                              "MMMM d, yyyy"
                            )
                          : "—",
                    },
                    {
                      label: "12. Maturity Date",
                      value: loan.maturityDate
                        ? format(new Date(loan.maturityDate), "MMMM d, yyyy")
                        : "—",
                    },
                  ].map((row, i) => (
                    <tr
                      key={i}
                      style={{
                        backgroundColor: row.highlight
                          ? c.highlight
                          : i % 2 === 0
                            ? c.rowAlt
                            : c.rowEven,
                      }}
                    >
                      <td
                        style={{
                          padding: "10px 12px",
                          border: `1px solid ${c.border}`,
                          fontWeight: 500,
                        }}
                      >
                        {row.label}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          border: `1px solid ${c.border}`,
                          textAlign: "right",
                          fontWeight: row.bold ? 600 : 400,
                        }}
                      >
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Collateral Section */}
            {loan.collateralDescription && (
              <div className="mb-8">
                <h2
                  className="font-semibold mb-3"
                  style={{ fontSize: "16px", color: c.textStrong }}
                >
                  Collateral / Security
                </h2>
                <div
                  style={{
                    padding: "12px 16px",
                    backgroundColor: c.mutedBg,
                    borderRadius: "6px",
                    fontSize: "13px",
                  }}
                >
                  {loan.collateralDescription}
                </div>
              </div>
            )}

            {/* Co-maker Section */}
            {loan.coMakerName && (
              <div className="mb-8">
                <h2
                  className="font-semibold mb-3"
                  style={{ fontSize: "16px", color: c.textStrong }}
                >
                  Co-maker / Guarantor
                </h2>
                <div
                  style={{
                    padding: "12px 16px",
                    backgroundColor: c.mutedBg,
                    borderRadius: "6px",
                    fontSize: "13px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "4px",
                    }}
                  >
                    <span style={{ color: c.muted }}>Name:</span>
                    <span style={{ fontWeight: 500 }}>{loan.coMakerName}</span>
                  </div>
                  {loan.coMakerPhone && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "4px",
                      }}
                    >
                      <span style={{ color: c.muted }}>Phone:</span>
                      <span>{loan.coMakerPhone}</span>
                    </div>
                  )}
                  {loan.coMakerRelationship && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: c.muted }}>
                        Relationship to Borrower:
                      </span>
                      <span>{loan.coMakerRelationship}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Payment Schedule */}
            <div className="mb-8" style={{ pageBreakInside: "avoid" }}>
              <h2
                className="font-semibold mb-4"
                style={{ fontSize: "16px", color: c.textStrong }}
              >
                Payment Schedule
              </h2>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "12px",
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: c.headerBg }}>
                    <th
                      style={{
                        padding: "8px 10px",
                        border: `1px solid ${c.borderStrong}`,
                        textAlign: "left",
                        fontWeight: 600,
                      }}
                    >
                      #
                    </th>
                    <th
                      style={{
                        padding: "8px 10px",
                        border: `1px solid ${c.borderStrong}`,
                        textAlign: "left",
                        fontWeight: 600,
                      }}
                    >
                      Due Date
                    </th>
                    <th
                      style={{
                        padding: "8px 10px",
                        border: `1px solid ${c.borderStrong}`,
                        textAlign: "right",
                        fontWeight: 600,
                      }}
                    >
                      Amount
                    </th>
                    <th
                      style={{
                        padding: "8px 10px",
                        border: `1px solid ${c.borderStrong}`,
                        textAlign: "center",
                        fontWeight: 600,
                      }}
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loan.schedule.map((item, index) => (
                    <tr
                      key={item.id}
                      style={{
                        backgroundColor:
                          index % 2 === 0 ? c.rowEven : c.rowAlt,
                      }}
                    >
                      <td
                        style={{
                          padding: "6px 10px",
                          border: `1px solid ${c.border}`,
                        }}
                      >
                        {index + 1}
                      </td>
                      <td
                        style={{
                          padding: "6px 10px",
                          border: `1px solid ${c.border}`,
                        }}
                      >
                        {format(new Date(item.dueDate), "MMM d, yyyy")}
                      </td>
                      <td
                        style={{
                          padding: "6px 10px",
                          border: `1px solid ${c.border}`,
                          textAlign: "right",
                        }}
                      >
                        {formatCurrency(item.amount)}
                      </td>
                      <td
                        style={{
                          padding: "6px 10px",
                          border: `1px solid ${c.border}`,
                          textAlign: "center",
                          textTransform: "capitalize",
                        }}
                      >
                        {item.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr
                    style={{
                      backgroundColor: c.headerBg,
                      fontWeight: 600,
                    }}
                  >
                    <td
                      colSpan={2}
                      style={{
                        padding: "8px 10px",
                        border: `1px solid ${c.borderStrong}`,
                        textAlign: "right",
                      }}
                    >
                      Total:
                    </td>
                    <td
                      style={{
                        padding: "8px 10px",
                        border: `1px solid ${c.borderStrong}`,
                        textAlign: "right",
                      }}
                    >
                      {formatCurrency(totalToRepay)}
                    </td>
                    <td
                      style={{
                        padding: "8px 10px",
                        border: `1px solid ${c.borderStrong}`,
                      }}
                    ></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Borrower Acknowledgment */}
            <div
              style={{
                borderTop: `2px solid ${c.border}`,
                paddingTop: "24px",
                marginTop: "24px",
              }}
            >
              <h2
                className="font-semibold mb-4"
                style={{ fontSize: "16px", color: c.textStrong }}
              >
                Borrower's Acknowledgment
              </h2>
              <p
                style={{
                  fontSize: "13px",
                  lineHeight: "1.6",
                  marginBottom: "24px",
                  color: c.text,
                }}
              >
                {lang === "en" ? (
                  <>
                    I/We acknowledge receipt of this Truth in Lending Disclosure
                    Statement and confirm that I/we have read and understood all
                    the terms and conditions stated herein. I/We understand that
                    the Effective Interest Rate (EIR) disclosed above represents
                    the true cost of borrowing on an annual basis, as required
                    by Republic Act No. 3765 (Truth in Lending Act).
                  </>
                ) : (
                  <>
                    Kinikilala ko/namin ang pagtanggap ng Truth in Lending
                    Disclosure Statement na ito at pinapatunayan na nabasa at
                    naunawaan ko/namin ang lahat ng mga tuntunin at kundisyon na
                    nakasaad dito. Nauunawaan ko/namin na ang Effective Interest
                    Rate (EIR) na inihayag sa itaas ay kumakatawan sa tunay na
                    halaga ng paghiram sa taunang batayan, ayon sa Republic Act
                    No. 3765 (Truth in Lending Act).
                  </>
                )}
              </p>

              {/* Signature Lines */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: loan.coMakerName ? "1fr 1fr" : "1fr",
                  gap: "32px",
                  marginTop: "48px",
                }}
              >
                <div>
                  <div
                    style={{
                      borderBottom: `1px solid ${c.borderSignature}`,
                      height: "40px",
                      marginBottom: "8px",
                    }}
                  ></div>
                  <p style={{ fontSize: "13px", fontWeight: 500 }}>
                    {loan.contact.name}
                  </p>
                  <p style={{ fontSize: "11px", color: c.muted }}>
                    {lang === "en"
                      ? "Borrower's Signature over Printed Name"
                      : "Lagda ng Borrower sa ibabaw ng Nakalimbag na Pangalan"}
                  </p>
                  <div style={{ marginTop: "16px" }}>
                    <div
                      style={{
                        borderBottom: `1px solid ${c.borderSignature}`,
                        width: "150px",
                        marginBottom: "8px",
                      }}
                    ></div>
                    <p style={{ fontSize: "11px", color: c.muted }}>
                      {lang === "en" ? "Date" : "Petsa"}
                    </p>
                  </div>
                </div>

                {loan.coMakerName && (
                  <div>
                    <div
                      style={{
                        borderBottom: `1px solid ${c.borderSignature}`,
                        height: "40px",
                        marginBottom: "8px",
                      }}
                    ></div>
                    <p style={{ fontSize: "13px", fontWeight: 500 }}>
                      {loan.coMakerName}
                    </p>
                    <p style={{ fontSize: "11px", color: c.muted }}>
                      {lang === "en"
                        ? "Co-maker's Signature over Printed Name"
                        : "Lagda ng Co-maker sa ibabaw ng Nakalimbag na Pangalan"}
                    </p>
                    <div style={{ marginTop: "16px" }}>
                      <div
                        style={{
                          borderBottom: `1px solid ${c.borderSignature}`,
                          width: "150px",
                          marginBottom: "8px",
                        }}
                      ></div>
                      <p style={{ fontSize: "11px", color: c.muted }}>
                        {lang === "en" ? "Date" : "Petsa"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                borderTop: `1px solid ${c.border}`,
                marginTop: "48px",
                paddingTop: "16px",
                textAlign: "center",
                fontSize: "11px",
                color: c.muted,
              }}
            >
              <p>
                {lang === "en"
                  ? "This disclosure is made in compliance with Republic Act No. 3765 (Truth in Lending Act) and its implementing rules and regulations."
                  : "Ang pahayag na ito ay ginawa alinsunod sa Republic Act No. 3765 (Truth in Lending Act) at mga kaugnay na panuntunan nito."}
              </p>
              <p style={{ marginTop: "8px" }}>
                {lang === "en"
                  ? `Document generated on ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}`
                  : `Dokumentong nabuo noong ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}
