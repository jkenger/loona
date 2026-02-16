import { createFileRoute } from "@tanstack/react-router"
import { useRef, useState, useEffect } from "react"
import { getPublicLoanRecap } from "@/server/loans"
import { Button } from "@/components/ui/button"
import { FilePdf, Spinner } from "@phosphor-icons/react"
import { format, differenceInCalendarDays } from "date-fns"

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
  }
}

type RecapData = NonNullable<Awaited<ReturnType<typeof getPublicLoanRecap>>>

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
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
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
      const html2pdf = (await import("html2pdf.js")).default

      const element = documentRef.current
      const filename = `loan-recap-${recap.contactName.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}.pdf`

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
      {/* Header */}
      <div className="bg-[hsl(215_45%_14%)] text-white py-4">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <h2 className="text-sm font-medium text-blue-200/70">Loan Completion Summary</h2>
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
                      {formatCurrency(metrics.totalPaid)}
                    </p>
                    <p style={{ fontSize: "11px", color: c.muted }}>
                      of {formatCurrency(metrics.totalExpected)} expected
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
                          {formatCurrency(metrics.totalPenalties)}
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
                                ? `#${index + 1}: ${formatCurrency(item.amount)}\nDue: ${format(new Date(item.dueDate), "MMM d, yyyy")}\nPaid: ${format(new Date(item.paidAt), "MMM d, yyyy")}`
                                : `#${index + 1}: ${formatCurrency(item.amount)}\nDue: ${format(new Date(item.dueDate), "MMM d, yyyy")}\nNot paid`
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
                              {formatCurrency(item.paidAmount !== "0" ? item.paidAmount : item.amount)}
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
                          {formatCurrency(metrics.totalPaid)}
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
          </div>

          {/* Sidebar */}
          <div className="order-1 lg:order-2 lg:sticky lg:top-[20px] lg:max-h-[calc(100vh-56px)] rounded-lg border bg-background shadow-lg overflow-hidden flex flex-col">
            <div className="flex flex-col h-full bg-background border-l">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-sm">Loan Recap</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Payment behavior summary
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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}
