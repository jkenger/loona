import { createFileRoute, Link } from "@tanstack/react-router"
import { SkeletonStatsPage } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import { PageHeader, PageContent } from "@/components/ui/page-header"
import { AccessDenied } from "@/components/access-denied"
import { Badge } from "@/components/ui/badge"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { getComplianceStats } from "@/server/admin"
import {
  ShieldCheck,
  ShieldWarning,
  Warning,
  CheckCircle,
  Users,
  Percent,
  TrendUp,
  Eye,
  ArrowSquareOut,
  Book,
  Gear,
  XCircle,
  Question,
} from "@phosphor-icons/react"
import { formatDistanceToNow } from "date-fns"

// Resource link component for external references
function ResourceLink({
  title,
  description,
  href,
}: {
  title: string
  description: string
  href: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 p-3 rounded-lg hover:bg-secondary transition-colors group"
    >
      <ArrowSquareOut className="h-4 w-4 mt-0.5 text-muted-foreground group-hover:text-primary shrink-0" />
      <div className="space-y-0.5">
        <p className="text-sm font-medium group-hover:text-primary">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </a>
  )
}

// Compliance item component for app compliance checklist
type ComplianceStatus = "configured" | "attention" | "manual" | "not_configured"

interface ComplianceItemData {
  status: ComplianceStatus
  label: string
  description: string
  path?: string
  href?: string
  detail?: string
}

function ComplianceItem({ item }: { item: ComplianceItemData }) {
  const statusConfig = {
    configured: {
      icon: CheckCircle,
      color: "text-green-600 dark:text-green-500",
      bg: "bg-green-50 dark:bg-green-950/30",
      label: "Configured",
    },
    attention: {
      icon: Warning,
      color: "text-yellow-600 dark:text-yellow-500",
      bg: "bg-yellow-50 dark:bg-yellow-950/30",
      label: "Needs Attention",
    },
    manual: {
      icon: Question,
      color: "text-blue-600 dark:text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950/30",
      label: "Manual Check",
    },
    not_configured: {
      icon: XCircle,
      color: "text-red-600 dark:text-red-500",
      bg: "bg-red-50 dark:bg-red-950/30",
      label: "Not Configured",
    },
  }

  const config = statusConfig[item.status]
  const Icon = config.icon

  const content = (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${config.bg}`}>
      <Icon className={`h-5 w-5 shrink-0 ${config.color}`} weight="fill" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{item.label}</p>
          <span className={`text-xs ${config.color}`}>{config.label}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
        {item.detail && (
          <p className="text-xs text-muted-foreground mt-1 font-mono">{item.detail}</p>
        )}
      </div>
    </div>
  )

  if (item.href) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className="block hover:opacity-80 transition-opacity">
        {content}
      </a>
    )
  }

  if (item.path) {
    return (
      <Link to={item.path} className="block hover:opacity-80 transition-opacity">
        {content}
      </Link>
    )
  }

  return content
}

export const Route = createFileRoute("/_dashboard/admin/compliance")({
  loader: async ({ context }) => {
    const { session } = context as {
      session: { user: { role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.ADMIN)) {
      return { stats: null, unauthorized: true }
    }
    const stats = await getComplianceStats()
    return { stats, unauthorized: false }
  },
  pendingComponent: SkeletonStatsPage,
  component: ComplianceDashboard,
})

function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

function ComplianceDashboard() {
  const { stats, unauthorized } = Route.useLoaderData()

  if (unauthorized || !stats) {
    return (
      <AccessDenied
        message="Only admins can access this page."
        homeLink="/dashboard"
        homeLinkLabel="Go to Dashboard"
      />
    )
  }

  const complianceRate = stats.interestRates.totalLoans > 0
    ? ((stats.interestRates.compliant / stats.interestRates.totalLoans) * 100).toFixed(1)
    : "100"

  return (
    <div>
      <PageHeader
        badge="Admin Portal"
        section="Compliance"
        title="Compliance Dashboard"
        subtitle="Monitor platform compliance with Philippine lending regulations"
      />
      <PageContent>
        {/* Compliance Overview */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Compliance Rate"
            value={`${complianceRate}%`}
            icon={<ShieldCheck className="h-5 w-5" weight="bold" />}
            description="Loans within safe interest rates"
          />
          <StatCard
            label="Above SEC Cap"
            value={stats.interestRates.aboveSECCap}
            icon={<ShieldWarning className="h-5 w-5" weight="bold" />}
            description={`>${stats.thresholds.secMonthlyCap}% monthly rate`}
            destructive={stats.interestRates.aboveSECCap > 0}
          />
          <StatCard
            label="Court Concern Zone"
            value={stats.interestRates.aboveCourtConcern}
            icon={<Warning className="h-5 w-5" weight="bold" />}
            description={`${stats.thresholds.courtConcern}-${stats.thresholds.secMonthlyCap}% monthly`}
          />
          <StatCard
            label="Fully Compliant"
            value={stats.interestRates.compliant}
            icon={<CheckCircle className="h-5 w-5" weight="bold" />}
            description={`≤${stats.thresholds.courtConcern}% monthly rate`}
          />
        </div>

        {/* Regulatory Reference */}
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              Philippine Regulatory Reference
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">SEC MC 19-2019 (Lending Companies)</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Nominal interest rate cap: <strong>6% per month</strong></li>
                  <li>• Effective interest rate cap: 15% per month</li>
                  <li>• Processing fees cap: 5% of principal</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Court Precedents (Civil Cases)</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Rates above 3% monthly may be deemed "unconscionable"</li>
                  <li>• Courts may reduce to <strong>12% per annum</strong></li>
                  <li>• Applies to private lending agreements</li>
                </ul>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4 border-t pt-3">
              Note: This platform is a record-keeping tool. Users are responsible for their own compliance.
              These thresholds are provided for informational purposes only.
            </p>
          </CardContent>
        </Card>

        {/* App Compliance Status */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2">
              <Gear className="h-5 w-5" />
              App Compliance Status
            </CardTitle>
            <CardDescription>Platform compliance checklist for Loona</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(stats.appCompliance).map(([key, item]) => (
                <ComplianceItem key={key} item={item} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Interest Rate Distribution */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Interest Rate Distribution
            </CardTitle>
            <CardDescription>Breakdown of loans by interest rate brackets</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-3">
              {stats.rateDistribution.map((bucket) => {
                const isHighRisk = bucket.bucket === "10%+" || bucket.bucket === "6-10%"
                const isMediumRisk = bucket.bucket === "3-6%"
                const percentage = stats.interestRates.totalLoans > 0
                  ? ((bucket.count / stats.interestRates.totalLoans) * 100).toFixed(1)
                  : "0"

                return (
                  <div key={bucket.bucket} className="flex items-center gap-4">
                    <div className="w-20 text-sm font-medium">{bucket.bucket}</div>
                    <div className="flex-1">
                      <div className="h-8 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isHighRisk
                              ? "bg-destructive"
                              : isMediumRisk
                                ? "bg-yellow-500"
                                : "bg-primary"
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-24 text-right">
                      <span className="font-medium">{bucket.count}</span>
                      <span className="text-muted-foreground text-sm ml-1">({percentage}%)</span>
                    </div>
                    <div className="w-32 text-right text-sm text-muted-foreground">
                      {formatCurrency(bucket.totalPrincipal)}
                    </div>
                  </div>
                )
              })}
              {stats.rateDistribution.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No loans in the system yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Active Loans Risk */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2">
                <TrendUp className="h-5 w-5" />
                Active Loans Risk Profile
              </CardTitle>
              <CardDescription>Current exposure in active loans</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded bg-secondary">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    <span>Low Risk (≤6%)</span>
                  </div>
                  <span className="font-bold">
                    {stats.activeLoans.total - stats.activeLoans.aboveSECCap - stats.activeLoans.aboveCourtConcern}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded bg-secondary">
                  <div className="flex items-center gap-2">
                    <Warning className="h-5 w-5 text-yellow-500" />
                    <span>Medium Risk (3-6%)</span>
                  </div>
                  <span className="font-bold">{stats.activeLoans.aboveCourtConcern}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded bg-secondary">
                  <div className="flex items-center gap-2">
                    <ShieldWarning className="h-5 w-5 text-destructive" />
                    <span>High Risk ({">"}6%)</span>
                  </div>
                  <span className="font-bold text-destructive">{stats.activeLoans.aboveSECCap}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Privacy Stats */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Data Privacy Overview
              </CardTitle>
              <CardDescription>Personal data collected (RA 10173 compliance)</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded bg-secondary">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    <span>Total Contacts</span>
                  </div>
                  <span className="font-bold">{stats.privacy.totalContacts}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 rounded bg-secondary">
                    <p className="text-2xl font-bold">{stats.privacy.withEmail}</p>
                    <p className="text-xs text-muted-foreground">With Email</p>
                  </div>
                  <div className="p-3 rounded bg-secondary">
                    <p className="text-2xl font-bold">{stats.privacy.withPhone}</p>
                    <p className="text-xs text-muted-foreground">With Phone</p>
                  </div>
                  <div className="p-3 rounded bg-secondary">
                    <p className="text-2xl font-bold">{stats.privacy.withAddress}</p>
                    <p className="text-xs text-muted-foreground">With Address</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ensure proper consent is obtained for all personal data stored.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent High-Rate Loans */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2">
              <ShieldWarning className="h-5 w-5 text-destructive" />
              Recent High-Rate Loans
            </CardTitle>
            <CardDescription>
              Loans created in the last 30 days with interest rates above {stats.thresholds.secMonthlyCap}% monthly
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {stats.recentHighRateLoans.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Borrower</th>
                      <th className="text-left py-2 font-medium">Lender</th>
                      <th className="text-right py-2 font-medium">Principal</th>
                      <th className="text-right py-2 font-medium">Rate</th>
                      <th className="text-center py-2 font-medium">Status</th>
                      <th className="text-right py-2 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentHighRateLoans.map((loan) => (
                      <tr key={loan.id} className="border-b last:border-0">
                        <td className="py-2">{loan.contactName || "Unknown"}</td>
                        <td className="py-2 text-muted-foreground">{loan.lenderEmail}</td>
                        <td className="py-2 text-right">{formatCurrency(loan.principal)}</td>
                        <td className="py-2 text-right font-medium text-destructive">
                          {loan.interestRate}%
                        </td>
                        <td className="py-2 text-center">
                          <Badge
                            variant={
                              loan.status === "active"
                                ? "default"
                                : loan.status === "completed"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {loan.status}
                          </Badge>
                        </td>
                        <td className="py-2 text-right text-muted-foreground">
                          {formatDistanceToNow(new Date(loan.createdAt), { addSuffix: true })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto text-primary mb-2" />
                <p className="text-muted-foreground">
                  No high-rate loans created in the last 30 days.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Interest Rate Stats */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle>Platform Interest Rate Statistics</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1 p-4 rounded bg-secondary">
                <p className="text-sm text-muted-foreground">Average Rate</p>
                <p className="text-2xl font-bold">{stats.interestRates.average}%</p>
                <p className="text-xs text-muted-foreground">per month</p>
              </div>
              <div className="space-y-1 p-4 rounded bg-secondary">
                <p className="text-sm text-muted-foreground">Highest Rate</p>
                <p className="text-2xl font-bold">{stats.interestRates.max}%</p>
                <p className="text-xs text-muted-foreground">per month</p>
              </div>
              <div className="space-y-1 p-4 rounded bg-secondary">
                <p className="text-sm text-muted-foreground">Lowest Rate</p>
                <p className="text-2xl font-bold">{stats.interestRates.min}%</p>
                <p className="text-xs text-muted-foreground">per month</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Regulatory Resources */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2">
              <Book className="h-5 w-5" />
              Regulatory Resources
            </CardTitle>
            <CardDescription>
              Official references for Philippine lending regulations
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Interest Rate Regulations */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm border-b pb-2">Interest Rate & Lending</h4>
                <ResourceLink
                  title="SEC MC 19-2019"
                  description="Interest rate caps for lending and financing companies"
                  href="https://www.sec.gov.ph/mc-2019/mc-no-19-s-2019-rules-and-regulations-for-lending-and-financing-companies/"
                />
                <ResourceLink
                  title="RA 9474 - Lending Company Regulation Act"
                  description="Requirements for lending company registration"
                  href="https://www.officialgazette.gov.ph/2007/05/22/republic-act-no-9474/"
                />
                <ResourceLink
                  title="RA 3765 - Truth in Lending Act"
                  description="Disclosure requirements for credit transactions"
                  href="https://www.officialgazette.gov.ph/1963/06/22/republic-act-no-3765/"
                />
                <ResourceLink
                  title="BSP Circular 799"
                  description="Interest rate ceiling removal (reference)"
                  href="https://www.bsp.gov.ph/Regulations/Issuances/2013/c799.pdf"
                />
              </div>

              {/* Data Privacy & Other */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm border-b pb-2">Data Privacy & Registration</h4>
                <ResourceLink
                  title="RA 10173 - Data Privacy Act"
                  description="Protection of personal information"
                  href="https://www.officialgazette.gov.ph/2012/08/15/republic-act-no-10173/"
                />
                <ResourceLink
                  title="NPC Registration Portal"
                  description="Register as Personal Information Controller"
                  href="https://www.privacy.gov.ph/data-protection-registration/"
                />
                <ResourceLink
                  title="SEC Company Registration"
                  description="Register a lending/financing company"
                  href="https://www.sec.gov.ph/online-services/sec-e-fast/"
                />
                <ResourceLink
                  title="BSP Consumer Protection"
                  description="Financial consumer protection framework"
                  href="https://www.bsp.gov.ph/SitePages/Regulations/ConsumerProtection.aspx"
                />
              </div>
            </div>

            <div className="mt-6 p-4 rounded-lg bg-muted/50 border">
              <h4 className="font-medium text-sm mb-2">Disclaimer</h4>
              <p className="text-xs text-muted-foreground">
                These links are provided for informational purposes only. Loona is a record-keeping tool
                and does not provide legal or financial advice. Users should consult with qualified
                legal and financial professionals for compliance guidance specific to their situation.
                Regulations may change; always verify with official sources.
              </p>
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </div>
  )
}
