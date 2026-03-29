import { createFileRoute, Link } from "@tanstack/react-router"
import { getCashFlowReport } from "@/server/reports"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { AccessDenied } from "@/components/access-denied"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Stagger, StaggerItem } from "@/components/ui/stagger"
import {
  ArrowLeft,
  CurrencyCircleDollar,
  TrendUp,
  TrendDown,
  ArrowsLeftRight,
  Receipt,
} from "@phosphor-icons/react"
import {
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

export const Route = createFileRoute("/_dashboard/reports/cash-flow")({
  loader: async ({ context }) => {
    const { session } = context as { session: { user: { role: string | null } } }
    if (!hasRole(session.user.role, ROLES.LENDER)) return { data: null, unauthorized: true }
    const data = await getCashFlowReport({ data: { months: 6 } })
    return { data, unauthorized: false }
  },
  component: CashFlowPage,
})

function fmt(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const tooltipStyle = { borderRadius: "8px", border: "1px solid var(--border)", background: "var(--card)", fontSize: "13px" }

function CashFlowPage() {
  const { data, unauthorized } = Route.useLoaderData()

  if (unauthorized) return <AccessDenied message="Only lenders can access reports." homeLink="/agent" homeLinkLabel="Go to Agent Portal" />
  if (!data) return null

  const { cashFlow, totals } = data

  const kpis = [
    { label: "Total Collected", value: fmt(totals.collected), valueColor: "text-blue-600 dark:text-blue-400", icon: CurrencyCircleDollar, iconBg: "bg-blue-100 dark:bg-blue-950/30", iconColor: "text-blue-600 dark:text-blue-400" },
    { label: "Total Disbursed", value: fmt(totals.disbursed), icon: ArrowsLeftRight, iconBg: "bg-muted", iconColor: "text-muted-foreground" },
    { label: "Commission", value: fmt(totals.commission), valueColor: "text-amber-600 dark:text-amber-400", icon: Receipt, iconBg: "bg-amber-100 dark:bg-amber-950/30", iconColor: "text-amber-600 dark:text-amber-400" },
    { label: "Penalty Income", value: fmt(totals.penaltyIncome), valueColor: "text-red-600 dark:text-red-400", icon: TrendDown, iconBg: "bg-red-100 dark:bg-red-950/30", iconColor: "text-red-600 dark:text-red-400" },
    {
      label: "Net Profit",
      value: fmt(totals.netProfit),
      valueColor: totals.netProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive",
      icon: totals.netProfit >= 0 ? TrendUp : TrendDown,
      iconBg: totals.netProfit >= 0 ? "bg-green-100 dark:bg-green-950/30" : "bg-red-100 dark:bg-red-950/30",
      iconColor: totals.netProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
    },
  ]

  return (
    <Stagger className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <StaggerItem>
        <Link to="/reports" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-3.5 w-3.5" />
          Reports
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Cash Flow Report</h1>
        <p className="text-sm text-muted-foreground mt-1">Monthly collections, disbursements, and net profit overview.</p>
      </StaggerItem>

      {/* KPI Cards */}
      <StaggerItem>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="rounded-xl shadow-sm">
              <CardContent className="p-5 relative">
                <div className={`absolute top-4 right-4 h-9 w-9 rounded-lg ${kpi.iconBg} flex items-center justify-center`}>
                  <kpi.icon className={`h-4.5 w-4.5 ${kpi.iconColor}`} weight="bold" />
                </div>
                <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                <p className={`text-2xl font-bold mt-1 ${kpi.valueColor ?? ""}`}>{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </StaggerItem>

      {/* Chart */}
      <StaggerItem>
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="p-5 pb-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CurrencyCircleDollar className="h-4.5 w-4.5 text-primary" weight="bold" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Monthly Cash Flow</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Collections, disbursements, and net profit trend</p>
                </div>
              </div>
              {cashFlow.length > 0 && (
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-muted-foreground">6-Month Net</p>
                  <p className={`text-lg font-bold ${totals.netProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                    {fmt(totals.netProfit)}
                  </p>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-4">
            {cashFlow.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={cashFlow}>
                  <defs>
                    <linearGradient id="collectedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => fmt(v)} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [fmt(value)]} />
                  <Area type="monotone" dataKey="collected" stroke="#3b82f6" strokeWidth={2} fill="url(#collectedGrad)" name="Collected" />
                  <Bar dataKey="disbursed" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Disbursed" barSize={28} />
                  <Line type="monotone" dataKey="netProfit" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 4, fill: "#16a34a" }} name="Net Profit" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CurrencyCircleDollar className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm font-medium">No cash flow data yet</p>
                <p className="text-xs mt-0.5">Data will appear as loans are disbursed and payments collected.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Monthly Breakdown Table */}
      <StaggerItem>
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="p-5 pb-1">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center">
                <Receipt className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" weight="bold" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Monthly Breakdown</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Detailed figures for each month</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-4 overflow-x-auto">
            {cashFlow.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Month</th>
                    <th className="pb-3 font-medium text-right">Expected</th>
                    <th className="pb-3 font-medium text-right">Collected</th>
                    <th className="pb-3 font-medium text-right">Disbursed</th>
                    <th className="pb-3 font-medium text-right">Commission</th>
                    <th className="pb-3 font-medium text-right">Penalties</th>
                    <th className="pb-3 font-medium text-right">Net Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {cashFlow.map((row, i) => (
                    <tr key={row.month} className={`border-b last:border-0 ${i % 2 === 1 ? "bg-muted/30" : ""}`}>
                      <td className="py-3 font-medium">{row.month}</td>
                      <td className="py-3 text-right text-muted-foreground">{fmt(row.expected)}</td>
                      <td className="py-3 text-right text-blue-500 font-medium">{fmt(row.collected)}</td>
                      <td className="py-3 text-right">{fmt(row.disbursed)}</td>
                      <td className="py-3 text-right text-amber-500">{fmt(row.commission)}</td>
                      <td className="py-3 text-right text-red-500">{fmt(row.penaltyIncome)}</td>
                      <td className={`py-3 text-right font-semibold ${row.netProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                        {fmt(row.netProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 bg-card">
                  <tr className="border-t-2 font-bold">
                    <td className="pt-3 pb-1">Total</td>
                    <td className="pt-3 pb-1 text-right text-muted-foreground">{fmt(totals.expected)}</td>
                    <td className="pt-3 pb-1 text-right text-blue-500">{fmt(totals.collected)}</td>
                    <td className="pt-3 pb-1 text-right">{fmt(totals.disbursed)}</td>
                    <td className="pt-3 pb-1 text-right text-amber-500">{fmt(totals.commission)}</td>
                    <td className="pt-3 pb-1 text-right text-red-500">{fmt(totals.penaltyIncome)}</td>
                    <td className={`pt-3 pb-1 text-right ${totals.netProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                      {fmt(totals.netProfit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Receipt className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm font-medium">No monthly data available</p>
                <p className="text-xs mt-0.5">Breakdown will appear once transactions are recorded.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </StaggerItem>
    </Stagger>
  )
}
