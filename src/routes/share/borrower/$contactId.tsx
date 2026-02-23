import { createFileRoute, Link } from "@tanstack/react-router"
import { useRef, useState } from "react"
import { getPublicBorrowerProfile } from "@/server/contacts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoonaBrand, FloatingCircle } from "@/components/ui/loona-brand"
import { Stagger, StaggerItem } from "@/components/ui/stagger"
import { ArrowSquareOut, FilePdf, Spinner } from "@phosphor-icons/react"
import { motion } from "framer-motion"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/utils"
import { useDocColors, generatePdf } from "@/lib/utils/share"

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

function BorrowerProfilePage() {
  const { profile } = Route.useLoaderData()
  const documentRef = useRef<HTMLDivElement>(null)
  const [generating, setGenerating] = useState(false)
  const [pdfMode, setPdfMode] = useState(false)
  const c = useDocColors(pdfMode)

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-page">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Profile Not Available</h1>
          <p className="text-muted-foreground">
            This borrower profile doesn't exist or has no completed loans yet.
          </p>
        </div>
      </div>
    )
  }

  const handleGeneratePDF = async () => {
    if (!documentRef.current) return

    setGenerating(true)
    setPdfMode(true)
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r))
    )

    try {
      const filename = `borrower-profile-${profile.contactName.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}.pdf`
      await generatePdf(documentRef.current, filename)
    } catch (error) {
      console.error("Failed to generate PDF:", error)
    } finally {
      setPdfMode(false)
      setGenerating(false)
    }
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

      {/* Header */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-12 py-6">
        <LoonaBrand size="sm" variant="gradient" animated={false} />
        <Badge variant="outline">Borrower Profile</Badge>
      </nav>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
        <Stagger className="space-y-4">
          {/* PDF Action Card */}
          <StaggerItem>
            <Card>
              <CardHeader>
                <CardTitle>{profile.contactName}</CardTitle>
                <CardDescription>Credit standing summary</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleGeneratePDF}
                  disabled={generating}
                  className="gap-2 w-full justify-center"
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
              </CardContent>
            </Card>
          </StaggerItem>

          {/* Document Zone — ALL inline styles preserved for html2canvas */}
          <StaggerItem>
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
                        {["Loan", "Principal", "Rate", "Term", "Completed", "On-Time"].map((h) => (
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
                            <a
                              href={`/share/recap/${loan.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                color: c.blue,
                                textDecoration: "none",
                                fontWeight: 500,
                                fontSize: "11px",
                              }}
                            >
                              {loan.id.slice(0, 8)}
                              <ArrowSquareOut style={{ width: "12px", height: "12px" }} />
                            </a>
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
