import { createFileRoute, Link } from "@tanstack/react-router"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { AccessDenied } from "@/components/access-denied"
import { Stagger, StaggerItem } from "@/components/ui/stagger"
import {
  ChartLineUp,
  CurrencyCircleDollar,
  UsersThree,
  Warning,
  ArrowRight,
} from "@phosphor-icons/react"

export const Route = createFileRoute("/_dashboard/reports/")({
  component: ReportsHub,
})

const reports = [
  {
    title: "Portfolio Analytics",
    description: "Collection trends, tier distribution, concentration risk, and aging analysis of your overdue accounts.",
    href: "/reports/portfolio",
    icon: ChartLineUp,
    iconColor: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-950/40",
    accent: "group-hover:border-blue-300 dark:group-hover:border-blue-800",
    tag: "Health",
    tagColor: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  },
  {
    title: "Cash Flow",
    description: "Monthly collections vs disbursements, commission outflows, penalty income, and net profit trend.",
    href: "/reports/cash-flow",
    icon: CurrencyCircleDollar,
    iconColor: "text-green-600 dark:text-green-400",
    iconBg: "bg-green-100 dark:bg-green-950/40",
    accent: "group-hover:border-green-300 dark:group-hover:border-green-800",
    tag: "Money",
    tagColor: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  },
  {
    title: "Borrower Risk",
    description: "Risk scores across all borrowers based on payment history, defaults, penalties, and overdue frequency.",
    href: "/reports/risk",
    icon: Warning,
    iconColor: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-950/40",
    accent: "group-hover:border-amber-300 dark:group-hover:border-amber-800",
    tag: "Risk",
    tagColor: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  },
  {
    title: "Agent Performance",
    description: "Collection efficiency, commission trends, and monthly performance breakdowns for your field team.",
    href: "/reports/agents",
    icon: UsersThree,
    iconColor: "text-violet-600 dark:text-violet-400",
    iconBg: "bg-violet-100 dark:bg-violet-950/40",
    accent: "group-hover:border-violet-300 dark:group-hover:border-violet-800",
    tag: "Team",
    tagColor: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
  },
]

function ReportsHub() {
  const { session } = Route.useRouteContext() as { session: { user: { role: string | null } } }
  if (!hasRole(session?.user?.role ?? null, ROLES.LENDER)) {
    return <AccessDenied message="Only lenders can access reports." homeLink="/agent" homeLinkLabel="Go to Agent Portal" />
  }

  return (
    <Stagger className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <StaggerItem>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-lg text-muted-foreground mt-1">
          Dig into your{' '}
          <span className="text-foreground font-semibold bg-primary/10 px-1.5 py-0.5 rounded-md">
            numbers
          </span>{' '}
          — portfolio health, cash flow, risk, and team.
        </p>
      </StaggerItem>

      {/* Report Cards */}
      <StaggerItem>
        <div className="grid gap-4 sm:grid-cols-2">
          {reports.map((report) => {
            const IconComp = report.icon
            return (
              <Link
                key={report.href}
                to={report.href}
                className={`group relative rounded-xl border bg-card p-6 transition-all hover:shadow-md ${report.accent}`}
              >
                {/* Top row: icon + tag */}
                <div className="flex items-center justify-between mb-4">
                  <div className={`h-12 w-12 rounded-xl ${report.iconBg} flex items-center justify-center`}>
                    <IconComp className={`h-6 w-6 ${report.iconColor}`} weight="bold" />
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${report.tagColor}`}>
                    {report.tag}
                  </span>
                </div>

                {/* Title + description */}
                <h3 className="text-base font-semibold">{report.title}</h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                  {report.description}
                </p>

                {/* Bottom action hint */}
                <div className="flex items-center gap-1.5 mt-4 text-xs font-medium text-primary opacity-0 translate-x-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                  View report
                  <ArrowRight className="h-3 w-3" weight="bold" />
                </div>
              </Link>
            )
          })}
        </div>
      </StaggerItem>
    </Stagger>
  )
}
