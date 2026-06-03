import { createFileRoute, Link } from "@tanstack/react-router"
import { getPortfolioAnalytics } from "@/server/reports"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { AccessDenied } from "@/components/access-denied"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Stagger, StaggerItem } from "@/components/ui/stagger"
import {
  ArrowLeft,
  ChartLineUp,
  Warning,
  Users,
  CurrencyCircleDollar,
  ShieldWarning,
  Percent,
  TrendUp,
  Briefcase,
  CheckCircle,
  XCircle,
} from "@phosphor-icons/react"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

export const Route = createFileRoute("/_dashboard/reports/portfolio")({
  loader: async ({ context }) => {
    const { session } = context as { session: { user: { role: string | null } } }
    if (!hasRole(session.user.role, ROLES.LENDER)) return { data: null, unauthorized: true }
    const data = await getPortfolioAnalytics({ data: { months: 6 } })
    return { data, unauthorized: false }
  },
  component: PortfolioAnalyticsPage,
})

const TIER_COLORS: Record<string, string> = {
  new: "#94a3b8",
  returning: "#60a5fa",
  established: "#a78bfa",
  loyal: "#34d399",
}

const TIER_LABELS: Record<string, string> = {
  new: "New",
  returning: "Returning",
  established: "Established",
  loyal: "Loyal",
}

const AGING_CONFIG = [
  { bucket: "1-7 days", color: "#facc15", bg: "bg-yellow-50 dark:bg-yellow-950/20", border: "border-yellow-200 dark:border-yellow-900" },
  { bucket: "8-14 days", color: "#fb923c", bg: "bg-orange-50 dark:bg-orange-950/20", border: "border-orange-200 dark:border-orange-900" },
  { bucket: "15-30 days", color: "#f87171", bg: "bg-red-50 dark:bg-red-950/20", border: "border-red-200 dark:border-red-900" },
  { bucket: "30+ days", color: "#dc2626", bg: "bg-red-100 dark:bg-red-950/30", border: "border-red-300 dark:border-red-800" },
]

function fmt(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const tooltipStyle = { borderRadius: "8px", border: "1px solid var(--border)", background: "var(--card)", fontSize: "13px" }

function PortfolioAnalyticsPage() {
  const { data, unauthorized } = Route.useLoaderData()

  if (unauthorized) return <AccessDenied message="Only lenders can access reports." homeLink="/agent" homeLinkLabel="Go to Agent Portal" />
  if (!data) return null

  const avgCollectionRate = data.collectionTrend.length > 0
    ? Math.round(data.collectionTrend.reduce((s, m) => s + m.rate, 0) / data.collectionTrend.length)
    : 0

  const totalOverdue = data.agingAnalysis.reduce((s, a) => s + a.count, 0)
  const totalOverdueAmount = data.agingAnalysis.reduce((s, a) => s + a.amount, 0)

  return (
    <Stagger className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <StaggerItem>
        <Link to="/reports" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-3.5 w-3.5" />
          Reports
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Portfolio Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          A bird's-eye view of your lending portfolio — collection health, risk exposure, and borrower composition.
        </p>
      </StaggerItem>

      {/* KPI Cards */}
      <StaggerItem>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          {[
            { label: "Total Loans", value: String(data.loanCounts.total), icon: Briefcase, iconColor: "text-muted-foreground", iconBg: "bg-muted" },
            { label: "Active", value: String(data.loanCounts.active), valueColor: "text-primary", icon: TrendUp, iconColor: "text-blue-600 dark:text-blue-400", iconBg: "bg-blue-100 dark:bg-blue-950/40" },
            { label: "Completed", value: String(data.loanCounts.completed), valueColor: "text-green-600 dark:text-green-400", icon: CheckCircle, iconColor: "text-green-600 dark:text-green-400", iconBg: "bg-green-100 dark:bg-green-950/40" },
            { label: "Default Rate", value: `${data.defaultRate}%`, valueColor: data.defaultRate > 10 ? "text-destructive" : "text-green-600 dark:text-green-400", icon: XCircle, iconColor: data.defaultRate > 10 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400", iconBg: data.defaultRate > 10 ? "bg-red-100 dark:bg-red-950/40" : "bg-green-100 dark:bg-green-950/40" },
            { label: "Total Losses", value: fmt(data.defaults.totalLoss), valueColor: data.defaults.totalLoss > 0 ? "text-destructive" : "", icon: Warning, iconColor: data.defaults.totalLoss > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground", iconBg: data.defaults.totalLoss > 0 ? "bg-red-100 dark:bg-red-950/40" : "bg-muted" },
            { label: "Outstanding", value: fmt(data.totalOutstanding), icon: CurrencyCircleDollar, iconColor: "text-amber-600 dark:text-amber-400", iconBg: "bg-amber-100 dark:bg-amber-950/40" },
          ].map((kpi) => (
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

      {/* Collection Trend — Full Width */}
      <StaggerItem>
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="p-5 pb-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ChartLineUp className="h-4.5 w-4.5 text-primary" weight="bold" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Collection Rate Trend</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Expected vs actual collections over the last 6 months</p>
                </div>
              </div>
              {avgCollectionRate > 0 && (
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-muted-foreground">Avg Rate</p>
                  <p className={`text-lg font-bold ${avgCollectionRate >= 80 ? "text-green-600 dark:text-green-400" : avgCollectionRate >= 50 ? "text-amber-600 dark:text-amber-400" : "text-destructive"}`}>
                    {avgCollectionRate}%
                  </p>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-4">
            {data.collectionTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data.collectionTrend}>
                  <defs>
                    <linearGradient id="expectedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#94a3b8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="collectedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => fmt(v)} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [fmt(value)]} />
                  <Area type="monotone" dataKey="expected" stroke="#94a3b8" strokeWidth={2} fill="url(#expectedGrad)" name="Expected" />
                  <Area type="monotone" dataKey="collected" stroke="#3b82f6" strokeWidth={2} fill="url(#collectedGrad)" name="Collected" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <ChartLineUp className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No collection data yet. Data will appear as payments come in.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Two-Column: Concentration + Tiers */}
      <StaggerItem className="grid gap-5 lg:grid-cols-2">
        {/* Concentration Risk */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="p-5 pb-1">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
                <Warning className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" weight="bold" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Concentration Risk</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Top 5 borrowers by outstanding balance</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-4">
            {data.concentration.length > 0 ? (
              <div className="space-y-3">
                {data.concentration.map((b, i) => (
                  <div key={b.contactId}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground w-4">#{i + 1}</span>
                        <Link to="/contacts/$contactId" params={{ contactId: b.contactId }} className="text-sm font-medium hover:text-primary transition-colors truncate max-w-[180px]">
                          {b.name}
                        </Link>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{b.percentage}%</span>
                        <span className="text-sm font-semibold">{fmt(b.outstanding)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 dark:bg-amber-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, b.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">No active loans.</p>
            )}
          </CardContent>
        </Card>

        {/* Tier Distribution */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="p-5 pb-1">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center">
                <Users className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" weight="bold" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Borrower Tiers</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Distribution across membership tiers</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-4">
            {data.tierDistribution.length > 0 ? (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <ResponsiveContainer width="100%" height={180} className="sm:w-1/2">
                  <PieChart>
                    <Pie
                      data={data.tierDistribution}
                      dataKey="count"
                      nameKey="tier"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      strokeWidth={2}
                      stroke="var(--card)"
                    >
                      {data.tierDistribution.map((entry) => (
                        <Cell key={entry.tier} fill={TIER_COLORS[entry.tier] ?? "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 w-full sm:w-1/2">
                  {data.tierDistribution.map((t) => {
                    const total = data.tierDistribution.reduce((s, x) => s + x.count, 0)
                    const pct = total > 0 ? Math.round((t.count / total) * 100) : 0
                    return (
                      <div key={t.tier} className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full shrink-0" style={{ background: TIER_COLORS[t.tier] ?? "#94a3b8" }} />
                        <span className="text-sm flex-1">{TIER_LABELS[t.tier] ?? t.tier}</span>
                        <span className="text-sm font-semibold">{t.count}</span>
                        <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">No borrowers yet.</p>
            )}
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Aging Analysis */}
      <StaggerItem>
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="p-5 pb-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-red-100 dark:bg-red-950/30 flex items-center justify-center">
                  <ShieldWarning className="h-4.5 w-4.5 text-red-600 dark:text-red-400" weight="bold" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Overdue Aging</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Breakdown of overdue installments by how late they are</p>
                </div>
              </div>
              {totalOverdue > 0 && (
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-muted-foreground">Total Overdue</p>
                  <p className="text-lg font-bold text-destructive">{totalOverdue} items · {fmt(totalOverdueAmount)}</p>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-4">
            {totalOverdue > 0 ? (
              <div className="grid gap-3 sm:grid-cols-4">
                {AGING_CONFIG.map(({ bucket, color, bg, border }) => {
                  const item = data.agingAnalysis.find((a) => a.bucket === bucket)
                  const count = item?.count ?? 0
                  const pct = totalOverdue > 0 ? Math.round((count / totalOverdue) * 100) : 0
                  return (
                    <div key={bucket} className={`rounded-xl border p-4 ${bg} ${border}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{bucket}</p>
                      </div>
                      <p className="text-2xl font-bold">{count}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-muted-foreground">{fmt(item?.amount ?? 0)}</p>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{pct}%</Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mb-2 text-green-500 opacity-50" />
                <p className="text-sm font-medium">No overdue payments</p>
                <p className="text-xs mt-0.5">All borrowers are current on their schedule.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Default & Recovery */}
      <StaggerItem>
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="p-5 pb-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-red-100 dark:bg-red-950/30 flex items-center justify-center">
                  <Warning className="h-4.5 w-4.5 text-red-600 dark:text-red-400" weight="bold" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Default & Recovery</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Track write-offs over time and which borrowers represent the biggest exposure.
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-4 space-y-6">
            {/* Mini KPI strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MiniStat label="Defaulted Loans" value={String(data.defaults.count)} tone={data.defaults.count > 0 ? "warn" : "muted"} />
              <MiniStat label="Total Loss" value={fmt(data.defaults.totalLoss)} tone={data.defaults.totalLoss > 0 ? "loss" : "muted"} />
              <MiniStat label="Average Loss" value={fmt(data.defaults.averageLoss)} tone="muted" />
              <MiniStat
                label="Recovery Rate"
                value={`${data.defaults.recoveryRate}%`}
                hint={`${data.defaults.recoveredCount} of ${data.defaults.everDefaultedCount} recovered`}
                tone={data.defaults.recoveryRate >= 50 ? "good" : data.defaults.recoveryRate > 0 ? "warn" : "muted"}
              />
            </div>

            {/* Trend + Top defaulters */}
            <div className="grid gap-5 lg:grid-cols-5">
              {/* Trend chart */}
              <div className="lg:col-span-3">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold">Default Trend</p>
                  <p className="text-xs text-muted-foreground">Last 6 months · loss in ₱</p>
                </div>
                {data.defaults.trend.some((m) => m.count > 0) ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.defaults.trend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => fmt(v)} />
                      <Tooltip contentStyle={tooltipStyle} formatter={((value: number) => [fmt(value), "Loss"]) as any} />
                      <Bar dataKey="totalLoss" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mb-2 text-green-500 opacity-50" />
                    <p className="text-sm font-medium">No defaults in the last 6 months</p>
                  </div>
                )}
              </div>

              {/* Top defaulters */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold">Top Defaulters</p>
                  <p className="text-xs text-muted-foreground">By outstanding loss</p>
                </div>
                {data.defaults.topDefaulters.length > 0 ? (
                  <div className="space-y-2.5">
                    {data.defaults.topDefaulters.map((d, i) => (
                      <div key={d.contactId} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-mono text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                          <Link
                            to="/contacts/$contactId"
                            params={{ contactId: d.contactId }}
                            className="text-sm font-medium hover:text-primary transition-colors truncate"
                          >
                            {d.contactName}
                          </Link>
                          {d.loanCount > 1 && (
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {d.loanCount} loans
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-destructive tabular-nums shrink-0">
                          {fmt(d.totalLoss)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No defaulted loans yet.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </StaggerItem>
    </Stagger>
  )
}

function MiniStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone: "muted" | "warn" | "loss" | "good"
}) {
  const valueClass =
    tone === "loss" ? "text-destructive"
    : tone === "warn" ? "text-amber-600 dark:text-amber-400"
    : tone === "good" ? "text-green-600 dark:text-green-400"
    : "text-foreground"
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold mt-1 tabular-nums ${valueClass}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  )
}
