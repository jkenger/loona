import { createFileRoute, Link } from "@tanstack/react-router"
import { getAllBorrowerRiskScores } from "@/server/reports"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { AccessDenied } from "@/components/access-denied"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Stagger, StaggerItem } from "@/components/ui/stagger"
import { useState } from "react"
import {
  ArrowLeft,
  Warning,
  ShieldWarning,
  ShieldCheck,
  Skull,
  CaretUp,
  CaretDown,
  Users,
} from "@phosphor-icons/react"

export const Route = createFileRoute("/_dashboard/reports/risk")({
  loader: async ({ context }) => {
    const { session } = context as { session: { user: { role: string | null } } }
    if (!hasRole(session.user.role, ROLES.LENDER)) return { data: null, unauthorized: true }
    const data = await getAllBorrowerRiskScores({ data: undefined })
    return { data, unauthorized: false }
  },
  component: RiskScoresPage,
})

function fmt(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const CATEGORY_CONFIG = {
  low: {
    label: "Low Risk",
    border: "border-l-green-500",
    bg: "bg-green-100 dark:bg-green-950/30",
    text: "text-green-700 dark:text-green-400",
    iconBg: "bg-green-100 dark:bg-green-950/30",
    iconText: "text-green-600 dark:text-green-400",
    badgeBg: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
    barBg: "bg-green-500",
    Icon: ShieldCheck,
  },
  medium: {
    label: "Medium Risk",
    border: "border-l-amber-500",
    bg: "bg-amber-100 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-950/30",
    iconText: "text-amber-600 dark:text-amber-400",
    badgeBg: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    barBg: "bg-amber-500",
    Icon: Warning,
  },
  high: {
    label: "High Risk",
    border: "border-l-orange-500",
    bg: "bg-orange-100 dark:bg-orange-950/30",
    text: "text-orange-700 dark:text-orange-400",
    iconBg: "bg-orange-100 dark:bg-orange-950/30",
    iconText: "text-orange-600 dark:text-orange-400",
    badgeBg: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
    barBg: "bg-orange-500",
    Icon: ShieldWarning,
  },
  critical: {
    label: "Critical Risk",
    border: "border-l-red-500",
    bg: "bg-red-100 dark:bg-red-950/30",
    text: "text-red-700 dark:text-red-400",
    iconBg: "bg-red-100 dark:bg-red-950/30",
    iconText: "text-red-600 dark:text-red-400",
    badgeBg: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
    barBg: "bg-red-500",
    Icon: Skull,
  },
} as const

type Category = keyof typeof CATEGORY_CONFIG
type SortKey = "score" | "name" | "onTimeRate" | "activeLoans" | "outstanding" | "overdueCount"

function ScoreBar({ score, category }: { score: number; category: string }) {
  const config = CATEGORY_CONFIG[category as Category] ?? CATEGORY_CONFIG.medium
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono font-semibold text-sm tabular-nums">{score}</span>
      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${config.barBg}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
    </div>
  )
}

function SortHeader({
  label,
  sortKey: key,
  currentKey,
  asc,
  onToggle,
  align = "left",
}: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  asc: boolean
  onToggle: (k: SortKey) => void
  align?: "left" | "right"
}) {
  const active = currentKey === key
  return (
    <th
      className={`px-4 py-3 font-medium cursor-pointer select-none hover:text-foreground text-muted-foreground transition-colors ${align === "right" ? "text-right" : "text-left"}`}
      onClick={() => onToggle(key)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (asc ? <CaretUp className="h-3 w-3" weight="bold" /> : <CaretDown className="h-3 w-3" weight="bold" />)}
      </span>
    </th>
  )
}

function RiskScoresPage() {
  const { data, unauthorized } = Route.useLoaderData()
  const [sortKey, setSortKey] = useState<SortKey>("score")
  const [sortAsc, setSortAsc] = useState(false)

  if (unauthorized) return <AccessDenied message="Only lenders can access reports." homeLink="/agent" homeLinkLabel="Go to Agent Portal" />
  if (!data) return null

  const { borrowers, distribution } = data
  const total = distribution.low + distribution.medium + distribution.high + distribution.critical

  const sorted = [...borrowers].sort((a, b) => {
    const dir = sortAsc ? 1 : -1
    if (sortKey === "name") return dir * a.name.localeCompare(b.name)
    return dir * ((a[sortKey] ?? 0) - (b[sortKey] ?? 0))
  })

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  const categories: Category[] = ["low", "medium", "high", "critical"]

  return (
    <Stagger className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <StaggerItem>
        <Link to="/reports" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Reports
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Borrower Risk Analysis</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Comprehensive risk assessment based on payment behavior, defaults, overdue history, and penalty frequency.
        </p>
      </StaggerItem>

      {/* Distribution Cards */}
      <StaggerItem>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((cat) => {
            const config = CATEGORY_CONFIG[cat]
            const count = distribution[cat]
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            const IconComp = config.Icon
            return (
              <Card key={cat} className={`rounded-xl shadow-sm border-l-4 ${config.border}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-3xl font-bold tracking-tight">{count}</p>
                      <p className={`text-sm font-medium mt-0.5 ${config.text}`}>{config.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{pct}% of total</p>
                    </div>
                    <div className={`h-10 w-10 rounded-lg ${config.iconBg} flex items-center justify-center`}>
                      <IconComp className={`h-5 w-5 ${config.iconText}`} weight="bold" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </StaggerItem>

      {/* Stacked Distribution Bar */}
      <StaggerItem>
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm font-medium text-muted-foreground mb-3">Risk Distribution</p>
            {total > 0 ? (
              <>
                <div className="flex h-4 w-full rounded-full overflow-hidden bg-muted">
                  {categories.map((cat) => {
                    const count = distribution[cat]
                    if (count === 0) return null
                    const pct = (count / total) * 100
                    const config = CATEGORY_CONFIG[cat]
                    return (
                      <div
                        key={cat}
                        className={`${config.barBg} transition-all`}
                        style={{ width: `${pct}%` }}
                        title={`${config.label}: ${count} (${Math.round(pct)}%)`}
                      />
                    )
                  })}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3">
                  {categories.map((cat) => {
                    const config = CATEGORY_CONFIG[cat]
                    const count = distribution[cat]
                    if (count === 0) return null
                    return (
                      <div key={cat} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div className={`h-2.5 w-2.5 rounded-full ${config.barBg}`} />
                        <span>{config.label}</span>
                        <span className="font-medium text-foreground">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <ShieldCheck className="h-8 w-8 mb-2" />
                <p className="text-sm">No borrower data available yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Borrower Table */}
      <StaggerItem>
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="p-5 pb-1">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-4.5 w-4.5 text-primary" weight="bold" />
              </div>
              <div>
                <h2 className="text-base font-semibold">All Borrowers</h2>
                <p className="text-xs text-muted-foreground">{borrowers.length} borrower{borrowers.length !== 1 ? "s" : ""} assessed</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 mt-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-t bg-muted/30">
                    <SortHeader label="Name" sortKey="name" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
                    <th className="px-4 py-3 font-medium text-muted-foreground text-left">Tier</th>
                    <SortHeader label="Risk Score" sortKey="score" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
                    <th className="px-4 py-3 font-medium text-muted-foreground text-left">Category</th>
                    <SortHeader label="On-Time" sortKey="onTimeRate" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} align="right" />
                    <SortHeader label="Active Loans" sortKey="activeLoans" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} align="right" />
                    <SortHeader label="Outstanding" sortKey="outstanding" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} align="right" />
                    <SortHeader label="Overdue" sortKey="overdueCount" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((b) => {
                    const config = CATEGORY_CONFIG[b.category as Category] ?? CATEGORY_CONFIG.medium
                    const onTimeColor = b.onTimeRate > 80 ? "text-green-600 dark:text-green-400" : b.onTimeRate > 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                    return (
                      <tr key={b.contactId} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3">
                          <Link to="/contacts/$contactId" params={{ contactId: b.contactId }} className="text-primary hover:underline font-medium">
                            {b.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="capitalize text-xs">{b.tier}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <ScoreBar score={b.score} category={b.category} />
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`capitalize text-xs border-0 ${config.badgeBg}`}>
                            {b.category}
                          </Badge>
                        </td>
                        <td className={`px-4 py-3 text-right font-medium tabular-nums ${onTimeColor}`}>
                          {b.onTimeRate}%
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{b.activeLoans}</td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">{fmt(b.outstanding)}</td>
                        <td className={`px-4 py-3 text-right tabular-nums font-medium ${b.overdueCount > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                          {b.overdueCount}
                        </td>
                      </tr>
                    )
                  })}
                  {sorted.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center text-muted-foreground">
                          <Users className="h-8 w-8 mb-2" />
                          <p className="text-sm">No borrowers found.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </StaggerItem>
    </Stagger>
  )
}
