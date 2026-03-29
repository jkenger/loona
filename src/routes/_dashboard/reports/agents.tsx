import { createFileRoute, Link } from "@tanstack/react-router"
import { getAgentPerformance } from "@/server/reports"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { AccessDenied } from "@/components/access-denied"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Stagger, StaggerItem } from "@/components/ui/stagger"
import {
  ArrowLeft,
  UsersThree,
  TrendUp,
  CurrencyCircleDollar,
  Wallet,
  Warning,
} from "@phosphor-icons/react"
import { Area, AreaChart, ResponsiveContainer } from "recharts"

export const Route = createFileRoute("/_dashboard/reports/agents")({
  loader: async ({ context }) => {
    const { session } = context as { session: { user: { role: string | null } } }
    if (!hasRole(session.user.role, ROLES.LENDER)) return { data: null, unauthorized: true }
    const data = await getAgentPerformance({ data: undefined })
    return { data, unauthorized: false }
  },
  component: AgentPerformancePage,
})

function fmt(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function rateColor(rate: number) {
  if (rate >= 80) return { text: "text-green-600 dark:text-green-400", bg: "#16a34a" }
  if (rate >= 50) return { text: "text-amber-600 dark:text-amber-400", bg: "#f59e0b" }
  return { text: "text-red-600 dark:text-red-400", bg: "#dc2626" }
}

function AgentPerformancePage() {
  const { data, unauthorized } = Route.useLoaderData()

  if (unauthorized) return <AccessDenied message="Only lenders can access reports." homeLink="/agent" homeLinkLabel="Go to Agent Portal" />
  if (!data) return null

  const { agents } = data

  const totalAgents = agents.length
  const avgCollectionRate = totalAgents > 0 ? Math.round(agents.reduce((sum, a) => sum + a.collectionRate, 0) / totalAgents) : 0
  const totalCollected = agents.reduce((sum, a) => sum + a.totalCollected, 0)
  const totalCommission = agents.reduce((sum, a) => sum + a.totalCommissionEarned, 0)

  const kpis = [
    {
      label: "Total Agents",
      value: String(totalAgents),
      icon: UsersThree,
      iconColor: "text-violet-500",
      iconBg: "bg-violet-100 dark:bg-violet-950/40",
    },
    {
      label: "Avg Collection Rate",
      value: `${avgCollectionRate}%`,
      valueColor: rateColor(avgCollectionRate).text,
      icon: TrendUp,
      iconColor: "text-blue-500",
      iconBg: "bg-blue-100 dark:bg-blue-950/40",
    },
    {
      label: "Total Collected",
      value: fmt(totalCollected),
      icon: CurrencyCircleDollar,
      iconColor: "text-green-500",
      iconBg: "bg-green-100 dark:bg-green-950/40",
    },
    {
      label: "Total Commission",
      value: fmt(totalCommission),
      icon: Wallet,
      iconColor: "text-amber-500",
      iconBg: "bg-amber-100 dark:bg-amber-950/40",
    },
  ]

  return (
    <Stagger className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <StaggerItem>
        <Link
          to="/reports"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Reports
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Agent Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track collection efficiency, commissions, and monthly trends across your team.
        </p>
      </StaggerItem>

      {/* Summary KPIs */}
      <StaggerItem>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {kpis.map((kpi) => {
            const Icon = kpi.icon
            return (
              <Card key={kpi.label} className="rounded-xl shadow-sm">
                <CardContent className="p-5 relative">
                  <div className={`absolute top-4 right-4 h-9 w-9 rounded-lg ${kpi.iconBg} flex items-center justify-center`}>
                    <Icon className={`h-4.5 w-4.5 ${kpi.iconColor}`} weight="bold" />
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${kpi.valueColor ?? ""}`}>{kpi.value}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </StaggerItem>

      {/* Agent Cards or Empty State */}
      {agents.length === 0 ? (
        <StaggerItem>
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-5">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
                  <UsersThree className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No agents yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Add agents to your team to start tracking their collection performance and commissions.
                </p>
                <Link
                  to="/agents"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  Go to Agents
                  <ArrowLeft className="h-3 w-3 rotate-180" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
      ) : (
        <StaggerItem>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => {
              const rate = agent.collectionRate
              const color = rateColor(rate)
              return (
                <Card key={agent.id} className="rounded-xl shadow-sm overflow-hidden">
                  <CardContent className="p-5 space-y-4">
                    {/* Agent header */}
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{agent.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{agent.email}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0 ml-2">
                        Tier {agent.tier}
                      </Badge>
                    </div>

                    {/* Mini sparkline */}
                    {agent.monthlyTrend.length > 1 && (
                      <div className="h-[80px] w-full -mx-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={agent.monthlyTrend} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                            <defs>
                              <linearGradient id={`spark-${agent.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <Area
                              type="monotone"
                              dataKey="collected"
                              stroke="#3b82f6"
                              strokeWidth={1.5}
                              fill={`url(#spark-${agent.id})`}
                              dot={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Collection rate bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Collection Rate</span>
                        <span className={`text-sm font-bold ${color.text}`}>{rate}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${rate}%`, background: color.bg }}
                        />
                      </div>
                    </div>

                    {/* Metrics grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">Active Loans</p>
                        <p className="text-sm font-semibold">{agent.loans.active}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          Overdue
                          {agent.overdueCount > 0 && <Warning className="h-3 w-3 text-red-500" weight="fill" />}
                        </p>
                        <p className={`text-sm font-semibold ${agent.overdueCount > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                          {agent.overdueCount}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">Collected</p>
                        <p className="text-sm font-semibold">{fmt(agent.totalCollected)}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">Commission</p>
                        <p className="text-sm font-semibold">{fmt(agent.totalCommissionEarned)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </StaggerItem>
      )}
    </Stagger>
  )
}
