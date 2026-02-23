import { createFileRoute, Link } from "@tanstack/react-router"
import { useRef, useState } from "react"
import { getPublicLoanRecap } from "@/server/loans"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoonaBrand, FloatingCircle } from "@/components/ui/loona-brand"
import { Stagger, StaggerItem } from "@/components/ui/stagger"
import { FilePdf, Spinner } from "@phosphor-icons/react"
import { motion } from "framer-motion"
import { format, differenceInCalendarDays } from "date-fns"
import { formatCurrency } from "@/lib/utils"
import { useDocColors, generatePdf } from "@/lib/utils/share"

export const Route = createFileRoute("/share/recap/$loanId")({
  loader: async ({ params }) => {
    try {
      const recap = await getPublicLoanRecap({ data: params.loanId })
      return { recap }
    } catch {
      return { recap: null }
    }
  },
  component: RecapPage,
})

type RecapData = NonNullable<Awaited<ReturnType<typeof getPublicLoanRecap>>>

/** 2-decimal currency for the inline-styled PDF document zone */
function formatCurrencyDoc(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

function computeMetrics(recap: RecapData) {
  const schedule = recap.schedule
  const total = schedule.length

  let onTimeCount = 0
  let lateCount = 0
  let totalDaysDiff = 0
  let longestStreak = 0
  let currentStreak = 0

  for (const item of schedule) {
    if (!item.paidAt) continue

    const dueDate = new Date(item.dueDate)
    const paidDate = new Date(item.paidAt)
    const daysDiff = differenceInCalendarDays(paidDate, dueDate)

    totalDaysDiff += daysDiff

    if (daysDiff <= 0) {
      onTimeCount++
      currentStreak++
      longestStreak = Math.max(longestStreak, currentStreak)
    } else {
      lateCount++
      currentStreak = 0
    }
  }

  const paidCount = onTimeCount + lateCount
  const onTimeRate = paidCount > 0 ? Math.round((onTimeCount / paidCount) * 100) : 0
  const avgDaysToPay = paidCount > 0 ? Math.round(totalDaysDiff / paidCount) : 0

  return {
    total,
    onTimeCount,
    lateCount,
    onTimeRate,
    avgDaysToPay,
    longestStreak,
    totalPenalties: recap.totalPenaltiesApplied,
    totalPaid: parseFloat(recap.amountPaid),
    totalExpected: parseFloat(recap.totalToRepay),
  }
}

function RecapPage() {
  const { recap } = Route.useLoaderData()
  const documentRef = useRef<HTMLDivElement>(null)
  const [generating, setGenerating] = useState(false)
  const [pdfMode, setPdfMode] = useState(false)
  const c = useDocColors(pdfMode)

  if (!recap) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-page">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Recap Not Available</h1>
          <p className="text-muted-foreground">
            This loan recap doesn't exist or the loan is not yet completed.
          </p>
        </div>
      </div>
    )
  }

  const metrics = computeMetrics(recap)

  const handleGeneratePDF = async () => {
    if (!documentRef.current) return

    setGenerating(true)
    setPdfMode(true)
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r))
    )

    try {
      const filename = `loan-recap-${recap.contactName.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}.pdf`
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
        <Badge variant="outline">Loan Summary</Badge>
      </nav>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-4 py-8">
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
                <CardTitle>{recap.contactName}</CardTitle>
                <CardDescription>
                  Loan recap — {formatCurrency(metrics.totalPaid)} paid
                </CardDescription>
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
                    Loan Completion Summary
                  </h1>
                  <p style={{ fontSize: "14px", color: c.textStrong }}>
                    {recap.contactName}
                  </p>
                  <p style={{ fontSize: "12px", color: c.muted, marginTop: "4px" }}>
                    {recap.startDate
                      ? format(new Date(recap.startDate), "MMMM d, yyyy")
                      : "—"}{" "}
                    to{" "}
                    {recap.completedAt
                      ? format(new Date(recap.completedAt), "MMMM d, yyyy")
                      : recap.maturityDate
                        ? format(new Date(recap.maturityDate), "MMMM d, yyyy")
                        : "—"}
                  </p>
                </div>

                {/* Key Metrics */}
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
                      Total Paid
                    </p>
                    <p style={{ fontSize: "20px", fontWeight: 700, color: c.textStrong }}>
                      {formatCurrencyDoc(metrics.totalPaid)}
                    </p>
                    <p style={{ fontSize: "11px", color: c.muted }}>
                      of {formatCurrencyDoc(metrics.totalExpected)} expected
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
                      On-Time Rate
                    </p>
                    <p style={{ fontSize: "20px", fontWeight: 700, color: metrics.onTimeRate >= 80 ? c.green : c.amber }}>
                      {metrics.onTimeRate}%
                    </p>
                    <p style={{ fontSize: "11px", color: c.muted }}>
                      {metrics.onTimeCount} of {metrics.total} on time
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
                      Avg Days to Pay
                    </p>
                    <p style={{ fontSize: "20px", fontWeight: 700, color: c.textStrong }}>
                      {metrics.avgDaysToPay <= 0 ? metrics.avgDaysToPay : `+${metrics.avgDaysToPay}`}
                    </p>
                    <p style={{ fontSize: "11px", color: c.muted }}>
                      days from due date
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
                    {metrics.totalPenalties > 0 ? (
                      <>
                        <p style={{ fontSize: "11px", color: c.muted, textTransform: "uppercase", fontWeight: 600, marginBottom: "4px" }}>
                          Penalties Paid
                        </p>
                        <p style={{ fontSize: "20px", fontWeight: 700, color: c.amber }}>
                          {formatCurrencyDoc(metrics.totalPenalties)}
                        </p>
                        <p style={{ fontSize: "11px", color: c.muted }}>
                          total penalties applied
                        </p>
                      </>
                    ) : (
                      <>
                        <p style={{ fontSize: "11px", color: c.muted, textTransform: "uppercase", fontWeight: 600, marginBottom: "4px" }}>
                          Longest Streak
                        </p>
                        <p style={{ fontSize: "20px", fontWeight: 700, color: c.green }}>
                          {metrics.longestStreak}
                        </p>
                        <p style={{ fontSize: "11px", color: c.muted }}>
                          consecutive on-time payments
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Payment Timeline */}
                <div className="mb-8">
                  <h2
                    className="font-semibold mb-4"
                    style={{ fontSize: "16px", color: c.textStrong }}
                  >
                    Payment Timeline
                  </h2>
                  <div
                    style={{
                      position: "relative",
                      padding: "20px 0",
                      overflowX: "auto",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        minWidth: `${Math.max(recap.schedule.length * 48, 200)}px`,
                        position: "relative",
                      }}
                    >
                      {/* Connecting line */}
                      <div
                        style={{
                          position: "absolute",
                          top: "50%",
                          left: "16px",
                          right: "16px",
                          height: "2px",
                          backgroundColor: c.border,
                          transform: "translateY(-50%)",
                        }}
                      />
                      {/* Dots */}
                      {recap.schedule.map((item, index) => {
                        const isOnTime = item.paidAt
                          ? differenceInCalendarDays(new Date(item.paidAt), new Date(item.dueDate)) <= 0
                          : false
                        const dotColor = item.paidAt
                          ? isOnTime ? c.green : c.amber
                          : c.muted

                        return (
                          <div
                            key={item.id}
                            style={{
                              flex: 1,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              position: "relative",
                              zIndex: 1,
                            }}
                            title={
                              item.paidAt
                                ? `#${index + 1}: ${formatCurrencyDoc(item.amount)}\nDue: ${format(new Date(item.dueDate), "MMM d, yyyy")}\nPaid: ${format(new Date(item.paidAt), "MMM d, yyyy")}`
                                : `#${index + 1}: ${formatCurrencyDoc(item.amount)}\nDue: ${format(new Date(item.dueDate), "MMM d, yyyy")}\nNot paid`
                            }
                          >
                            <div
                              style={{
                                width: "14px",
                                height: "14px",
                                borderRadius: "50%",
                                backgroundColor: dotColor,
                                border: `2px solid ${c.bg}`,
                                boxShadow: `0 0 0 2px ${dotColor}`,
                              }}
                            />
                            <span
                              style={{
                                fontSize: "9px",
                                color: c.muted,
                                marginTop: "8px",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {index + 1}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  {/* Legend */}
                  <div
                    style={{
                      display: "flex",
                      gap: "16px",
                      justifyContent: "center",
                      marginTop: "8px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: c.muted }}>
                      <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: c.green }} />
                      On time
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: c.muted }}>
                      <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: c.amber }} />
                      Late
                    </div>
                  </div>
                </div>

                {/* Payment History Table */}
                <div className="mb-8" style={{ pageBreakInside: "avoid" }}>
                  <h2
                    className="font-semibold mb-4"
                    style={{ fontSize: "16px", color: c.textStrong }}
                  >
                    Payment History
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
                        {["#", "Due Date", "Paid Date", "Amount", "Status", "Days"].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "8px 10px",
                              border: `1px solid ${c.borderStrong}`,
                              textAlign: h === "Amount" ? "right" : h === "Days" || h === "Status" ? "center" : "left",
                              fontWeight: 600,
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recap.schedule.map((item, index) => {
                        const daysDiff = item.paidAt
                          ? differenceInCalendarDays(new Date(item.paidAt), new Date(item.dueDate))
                          : null
                        const isOnTime = daysDiff !== null && daysDiff <= 0
                        const isLate = daysDiff !== null && daysDiff > 0
                        const statusColor = isOnTime ? c.green : isLate ? c.amber : c.muted

                        return (
                          <tr
                            key={item.id}
                            style={{
                              backgroundColor: index % 2 === 0 ? c.rowEven : c.rowAlt,
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
                              }}
                            >
                              {item.paidAt
                                ? format(new Date(item.paidAt), "MMM d, yyyy")
                                : "—"}
                            </td>
                            <td
                              style={{
                                padding: "6px 10px",
                                border: `1px solid ${c.border}`,
                                textAlign: "right",
                              }}
                            >
                              {formatCurrencyDoc(item.paidAmount !== "0" ? item.paidAmount : item.amount)}
                            </td>
                            <td
                              style={{
                                padding: "6px 10px",
                                border: `1px solid ${c.border}`,
                                textAlign: "center",
                              }}
                            >
                              {item.paidAt ? (
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "2px 8px",
                                    borderRadius: "9999px",
                                    fontSize: "10px",
                                    fontWeight: 600,
                                    textTransform: "uppercase",
                                    color: statusColor,
                                    backgroundColor: isOnTime ? c.greenBg : isLate ? c.amberBg : c.mutedBg,
                                  }}
                                >
                                  {isOnTime ? "On Time" : "Late"}
                                </span>
                              ) : (
                                <span style={{ color: c.muted }}>—</span>
                              )}
                            </td>
                            <td
                              style={{
                                padding: "6px 10px",
                                border: `1px solid ${c.border}`,
                                textAlign: "center",
                                color: daysDiff !== null ? (daysDiff <= 0 ? c.green : c.amber) : c.muted,
                                fontWeight: 500,
                              }}
                            >
                              {daysDiff !== null
                                ? daysDiff === 0
                                  ? "0"
                                  : daysDiff > 0
                                    ? `+${daysDiff}`
                                    : `${daysDiff}`
                                : "—"}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr
                        style={{
                          backgroundColor: c.headerBg,
                          fontWeight: 600,
                        }}
                      >
                        <td
                          colSpan={3}
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
                          {formatCurrencyDoc(metrics.totalPaid)}
                        </td>
                        <td
                          colSpan={2}
                          style={{
                            padding: "8px 10px",
                            border: `1px solid ${c.borderStrong}`,
                          }}
                        />
                      </tr>
                    </tfoot>
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
                  {recap.completedAt && (
                    <p>
                      Loan completed on{" "}
                      {format(new Date(recap.completedAt), "MMMM d, yyyy")}
                    </p>
                  )}
                  <p style={{ marginTop: "4px" }}>
                    Document generated on{" "}
                    {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}
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
