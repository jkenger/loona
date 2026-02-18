import { createFileRoute } from "@tanstack/react-router"
import { useRef, useState, useEffect } from "react"
import { getPublicBorrowerProfile } from "@/server/contacts"
import { Button } from "@/components/ui/button"
import { FilePdf, Spinner } from "@phosphor-icons/react"
import { format } from "date-fns"

export const Route = createFileRoute("/share/borrower/$contactId")({
  loader: async ({ params }) => {
    try {
      const profile = await getPublicBorrowerProfile({ data: params.contactId })
      return { profile }
    } catch {
      return { profile: null }
    }
  },
  component: BorrowerProfilePage,
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
    rowAlt: dark ? "#253349" : "#f9fafb",
    rowEven: dark ? "#1e293b" : "white",
    mutedBg: dark ? "#334155" : "#f3f4f6",
    headerBg: dark ? "#334155" : "#e5e7eb",
    green: dark ? "#22c55e" : "#16a34a",
    greenBg: dark ? "#14532d" : "#dcfce7",
    amber: dark ? "#f59e0b" : "#d97706",
    amberBg: dark ? "#78350f" : "#fef3c7",
    purple: dark ? "#a78bfa" : "#7c3aed",
    purpleBg: dark ? "#3b0764" : "#ede9fe",
    blue: dark ? "#60a5fa" : "#2563eb",
    blueBg: dark ? "#1e3a5f" : "#dbeafe",
  }
}

type ProfileData = NonNullable<Awaited<ReturnType<typeof getPublicBorrowerProfile>>>

function getTierColors(tier: ProfileData["tier"], c: ReturnType<typeof useDocColors>) {
  switch (tier) {
    case "loyal":
      return { color: c.purple, bg: c.purpleBg }
    case "established":
      return { color: c.blue, bg: c.blueBg }
    case "returning":
      return { color: c.green, bg: c.greenBg }
    default:
      return { color: c.muted, bg: c.mutedBg }
  }
}

function BorrowerProfilePage() {
  const { profile } = Route.useLoaderData()
  const documentRef = useRef<HTMLDivElement>(null)
  const [generating, setGenerating] = useState(false)
  const [pdfMode, setPdfMode] = useState(false)
  const c = useDocColors(pdfMode)

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Profile Not Available</h1>
          <p className="text-muted-foreground">
            This borrower profile doesn't exist or has no completed loans yet.
          </p>
        </div>
      </div>
    )
  }

  const tierColors = getTierColors(profile.tier, c)

  const handleGeneratePDF = async () => {
    if (!documentRef.current) return

    setGenerating(true)
    setPdfMode(true)
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r))
    )

    try {
      const html2pdf = (await import("html2pdf.js")).default

      const element = documentRef.current
      const filename = `borrower-profile-${profile.contactName.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}.pdf`

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

  const benefitItems: string[] = []
  if (profile.interestDiscount !== 0) {
    benefitItems.push(`${Math.abs(profile.interestDiscount)}% lower interest rate`)
  }
  if (profile.termBenefit === "longer") {
    benefitItems.push("Eligible for longer loan terms")
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-[hsl(215_45%_14%)] text-white py-4">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <h2 className="text-sm font-medium text-blue-200/70">Borrower Profile</h2>
        </div>
      </div>

      {/* Content Area */}
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
          {/* Document Preview */}
          <div className="min-w-0 order-2 lg:order-1">
            <div
              ref={documentRef}
              className="shadow-lg rounded-lg overflow-hidden"
              style={{
                fontFamily: "system-ui, -apple-system, sans-serif",
                backgroundColor: c.bg,
                color: c.text,
              }}
            >
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
                    {profile.contactName}
                  </h1>
                  <p style={{ fontSize: "13px", color: c.muted }}>
                    Member since {format(new Date(profile.memberSince), "MMMM yyyy")}
                  </p>
                  <div style={{ marginTop: "12px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 16px",
                        borderRadius: "9999px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: tierColors.color,
                        backgroundColor: tierColors.bg,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {profile.tierLabel}
                    </span>
                  </div>
                </div>

                {/* Tier Benefit Highlight */}
                <div
                  className="mb-8"
                  style={{
                    padding: "20px",
                    borderRadius: "12px",
                    border: `2px solid ${tierColors.color}20`,
                    backgroundColor: `${tierColors.bg}`,
                  }}
                >
                  <h2
                    style={{
                      fontSize: "15px",
                      fontWeight: 700,
                      color: tierColors.color,
                      marginBottom: "12px",
                    }}
                  >
                    {benefitItems.length > 0 ? "Your Next Loan Benefits" : "Unlock Benefits"}
                  </h2>
                  {benefitItems.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: c.text }}>
                      {benefitItems.map((item, i) => (
                        <li key={i} style={{ marginBottom: "6px" }}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ fontSize: "13px", color: c.muted }}>
                      Complete your first loan to unlock benefits
                    </p>
                  )}
                  {profile.reasoning.length > 0 && (
                    <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${c.border}` }}>
                      {profile.reasoning.map((r, i) => (
                        <p key={i} style={{ fontSize: "11px", color: c.muted, marginBottom: "4px" }}>
                          {r}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stats Grid */}
                <div
                  className="mb-8"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      padding: "16px",
                      backgroundColor: c.mutedBg,
                      borderRadius: "8px",
                      textAlign: "center",
                    }}
                  >
                    <p style={{ fontSize: "11px", color: c.muted, textTransform: "uppercase", fontWeight: 600, marginBottom: "4px" }}>
                      On-Time Rate
                    </p>
                    <p style={{ fontSize: "20px", fontWeight: 700, color: profile.onTimeRate >= 80 ? c.green : c.amber }}>
                      {profile.onTimeRate}%
                    </p>
                    {profile.gracePeriodDays > 0 && (
                      <p style={{ fontSize: "10px", color: c.muted }}>
                        with {profile.gracePeriodDays}-day grace period
                      </p>
                    )}
                  </div>
                  <div
                    style={{
                      padding: "16px",
                      backgroundColor: c.mutedBg,
                      borderRadius: "8px",
                      textAlign: "center",
                    }}
                  >
                    <p style={{ fontSize: "11px", color: c.muted, textTransform: "uppercase", fontWeight: 600, marginBottom: "4px" }}>
                      Completed Loans
                    </p>
                    <p style={{ fontSize: "20px", fontWeight: 700, color: c.textStrong }}>
                      {profile.completedLoans}
                    </p>
                    <p style={{ fontSize: "10px", color: c.muted }}>
                      of {profile.totalLoans} total
                    </p>
                  </div>
                  <div
                    style={{
                      padding: "16px",
                      backgroundColor: c.mutedBg,
                      borderRadius: "8px",
                      textAlign: "center",
                    }}
                  >
                    <p style={{ fontSize: "11px", color: c.muted, textTransform: "uppercase", fontWeight: 600, marginBottom: "4px" }}>
                      Late Payments
                    </p>
                    <p style={{ fontSize: "20px", fontWeight: 700, color: profile.latePayments > 0 ? c.amber : c.green }}>
                      {profile.latePayments}
                    </p>
                    {profile.latePayments > 0 && (
                      <p style={{ fontSize: "10px", color: c.muted }}>
                        avg {profile.avgDaysLate} day(s) late
                      </p>
                    )}
                  </div>
                  <div
                    style={{
                      padding: "16px",
                      backgroundColor: c.mutedBg,
                      borderRadius: "8px",
                      textAlign: "center",
                    }}
                  >
                    <p style={{ fontSize: "11px", color: c.muted, textTransform: "uppercase", fontWeight: 600, marginBottom: "4px" }}>
                      Penalties
                    </p>
                    <p style={{ fontSize: "20px", fontWeight: 700, color: profile.totalPenalties > 0 ? c.amber : c.green }}>
                      {profile.totalPenalties > 0 ? formatCurrency(profile.totalPenalties) : "None"}
                    </p>
                  </div>
                </div>

                {/* Loan History */}
                <div className="mb-8" style={{ pageBreakInside: "avoid" }}>
                  <h2
                    className="font-semibold mb-4"
                    style={{ fontSize: "16px", color: c.textStrong }}
                  >
                    Completed Loan History
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
                        {["#", "Principal", "Rate", "Term", "Completed", "On-Time"].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "8px 10px",
                              border: `1px solid ${c.borderStrong}`,
                              textAlign: h === "Principal" ? "right" : h === "On-Time" ? "center" : "left",
                              fontWeight: 600,
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {profile.completedLoanSummaries.map((loan, index) => (
                        <tr
                          key={loan.id}
                          style={{
                            backgroundColor: index % 2 === 0 ? c.rowEven : c.rowAlt,
                          }}
                        >
                          <td style={{ padding: "6px 10px", border: `1px solid ${c.border}` }}>
                            {index + 1}
                          </td>
                          <td style={{ padding: "6px 10px", border: `1px solid ${c.border}`, textAlign: "right" }}>
                            {formatCurrency(parseFloat(loan.principal))}
                          </td>
                          <td style={{ padding: "6px 10px", border: `1px solid ${c.border}` }}>
                            {loan.interestRate}%
                          </td>
                          <td style={{ padding: "6px 10px", border: `1px solid ${c.border}` }}>
                            {loan.termMonths} mo
                          </td>
                          <td style={{ padding: "6px 10px", border: `1px solid ${c.border}` }}>
                            {loan.completedAt
                              ? format(new Date(loan.completedAt), "MMM yyyy")
                              : "—"}
                          </td>
                          <td
                            style={{
                              padding: "6px 10px",
                              border: `1px solid ${c.border}`,
                              textAlign: "center",
                            }}
                          >
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: "9999px",
                                fontSize: "10px",
                                fontWeight: 600,
                                color: loan.onTimeRate >= 80 ? c.green : c.amber,
                                backgroundColor: loan.onTimeRate >= 80 ? c.greenBg : c.amberBg,
                              }}
                            >
                              {loan.onTimeRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div
                  style={{
                    borderTop: `1px solid ${c.border}`,
                    marginTop: "32px",
                    paddingTop: "16px",
                    textAlign: "center",
                    fontSize: "11px",
                    color: c.muted,
                  }}
                >
                  <p>
                    Document generated on{" "}
                    {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}
                  </p>
                  <p style={{ marginTop: "4px", opacity: 0.7 }}>
                    Powered by Loona
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="order-1 lg:order-2 lg:sticky lg:top-[20px] lg:max-h-[calc(100vh-56px)] rounded-lg border bg-background shadow-lg overflow-hidden flex flex-col">
            <div className="flex flex-col h-full bg-background border-l">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-sm">Borrower Profile</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Credit standing summary
                </p>
              </div>

              <div className="px-4 pt-3 pb-3 space-y-3">
                <Button
                  onClick={handleGeneratePDF}
                  disabled={generating}
                  className="gap-2 w-full justify-center"
                  size="sm"
                >
                  {generating ? (
                    <>
                      <Spinner className="h-3.5 w-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FilePdf className="h-3.5 w-3.5" weight="bold" />
                      Download PDF
                    </>
                  )}
                </Button>
              </div>
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
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}
