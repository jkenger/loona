import { createFileRoute } from "@tanstack/react-router"
import { SkeletonStatsPage } from "@/components/ui/skeleton"
import { getAgentCommissionPrograms } from "@/server/commission-settings"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AccessDenied } from "@/components/access-denied"
import { hasRole, ROLES } from "@/lib/constants/roles"
import {
  ClipboardText,
  Star,
  TrendUp,
  ShieldCheck,
  CalendarBlank,
  CurrencyCircleDollar,
  Trophy,
  ArrowRight,
  CheckCircle,
  Briefcase,
  Lightning,
} from "@phosphor-icons/react"
import type { CommissionProgramConfig } from "@/lib/constants/commission-defaults"
import { PageHeader, PageContent } from "@/components/ui/page-header"

export const Route = createFileRoute("/_dashboard/agent/commission-program")({
  loader: async ({ context }) => {
    const { session } = context as {
      session: { user: { role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.AGENT)) {
      return { programs: null, unauthorized: true }
    }
    const programs = await getAgentCommissionPrograms()
    return { programs, unauthorized: false }
  },
  pendingComponent: SkeletonStatsPage,
  component: AgentCommissionProgramPage,
})

function AgentCommissionProgramPage() {
  const { programs, unauthorized } = Route.useLoaderData()

  if (unauthorized || !programs) {
    return (
      <AccessDenied
        title="Agent Portal"
        message="You need to be an agent to access this portal."
        homeLink="/dashboard"
        homeLinkLabel="Go to Dashboard"
      />
    )
  }

  return (
    <div>
      <PageHeader
        badge="Agent Portal"
        section="Commission"
        title="Your Commission Program"
        subtitle="Everything you need to know about how you earn"
      />
      <PageContent>
        {programs.length > 0 ? (
          <div className="space-y-8">
            {programs.map((program) => (
              <LenderProgram
                key={program.agentId}
                lenderName={program.lenderName}
                tier={program.tier}
                commissionRate={program.commissionRate}
                config={program.config}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ClipboardText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-1">
                No active programs
              </h3>
              <p className="text-muted-foreground text-sm">
                You don't have any active lender relationships with commission
                programs.
              </p>
            </CardContent>
          </Card>
        )}
      </PageContent>
    </div>
  )
}

function LenderProgram({
  lenderName,
  tier,
  commissionRate,
  config,
}: {
  lenderName: string
  tier: number | null
  commissionRate: string
  config: CommissionProgramConfig
}) {
  const currentTierConfig = tier !== null
    ? config.tiers.find((t) => t.tier === tier)
    : null

  return (
    <div className="space-y-6">
      {/* Hero card — your earnings at a glance */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground font-medium">{lenderName}</p>
              <h2 className="text-2xl sm:text-3xl font-bold">
                {tier !== null && currentTierConfig ? (
                  <>Tier {tier} — {currentTierConfig.name}</>
                ) : (
                  <>Your Commission</>
                )}
              </h2>
            </div>
            {tier !== null ? (
              <Badge
                variant="default"
                className="text-sm px-3 py-1.5 self-start sm:self-auto"
              >
                <Star className="h-3.5 w-3.5 mr-1.5" weight="fill" />
                Tier {tier}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-sm px-3 py-1.5 self-start sm:self-auto">
                Basic Plan
              </Badge>
            )}
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
            <div className="bg-background/60 backdrop-blur rounded-lg p-4 border">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <CurrencyCircleDollar className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">You Earn</span>
              </div>
              <p className="text-xl font-bold">
                {tier !== null && currentTierConfig ? (
                  currentTierConfig.commissionType === "fixed"
                    ? `PHP ${currentTierConfig.flatAmount}`
                    : currentTierConfig.commissionType === "percentage"
                      ? `${currentTierConfig.percentageRate}%`
                      : `${currentTierConfig.percentageRate}% or PHP ${currentTierConfig.flatAmount}`
                ) : (
                  `${commissionRate}%`
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tier !== null && currentTierConfig ? (
                  currentTierConfig.commissionType === "higher_of"
                    ? "whichever is higher"
                    : "per collection"
                ) : (
                  "per collection"
                )}
              </p>
            </div>
            {tier !== null && currentTierConfig && (
              <>
                <div className="bg-background/60 backdrop-blur rounded-lg p-4 border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Briefcase className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Portfolio</span>
                  </div>
                  <p className="text-xl font-bold">{currentTierConfig.portfolioCap}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">max loans assigned</p>
                </div>
                {currentTierConfig.originationBonus > 0 && (
                  <div className="bg-background/60 backdrop-blur rounded-lg p-4 border col-span-2 sm:col-span-1">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Lightning className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase tracking-wider">Bonus</span>
                    </div>
                    <p className="text-xl font-bold">PHP {currentTierConfig.originationBonus}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      after {currentTierConfig.originationQualifyingPayments} payment{currentTierConfig.originationQualifyingPayments !== 1 ? "s" : ""}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Tier progression — only when tiered */}
      {tier !== null && config.tiers.length > 1 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Commission Tiers
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {config.tiers.map((t, i) => {
              const isCurrent = t.tier === tier
              const isPast = tier !== null && t.tier < tier
              return (
                <Card
                  key={t.tier}
                  className={
                    isCurrent
                      ? "border-primary ring-1 ring-primary/20"
                      : isPast
                        ? "opacity-60"
                        : ""
                  }
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isPast ? (
                          <CheckCircle className="h-5 w-5 text-green-500" weight="fill" />
                        ) : isCurrent ? (
                          <Star className="h-5 w-5 text-primary" weight="fill" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                        )}
                        <span className="font-semibold">
                          Tier {t.tier} — {t.name}
                        </span>
                      </div>
                      {isCurrent && (
                        <Badge variant="default" className="text-xs">You</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t.commissionType === "fixed" && (
                        <span>PHP {t.flatAmount} per collection</span>
                      )}
                      {t.commissionType === "percentage" && (
                        <span>{t.percentageRate}% of collected amount</span>
                      )}
                      {t.commissionType === "higher_of" && (
                        <span>{t.percentageRate}% or PHP {t.flatAmount}, whichever is higher</span>
                      )}
                      <span className="mx-1.5 text-muted-foreground/40">·</span>
                      <span>{t.portfolioCap} loans max</span>
                      {t.originationBonus > 0 && (
                        <>
                          <span className="mx-1.5 text-muted-foreground/40">·</span>
                          <span>PHP {t.originationBonus} bonus</span>
                        </>
                      )}
                    </div>
                    {/* Arrow between cards on mobile */}
                    {i < config.tiers.length - 1 && (
                      <div className="flex justify-center pt-1 md:hidden">
                        <ArrowRight className="h-4 w-4 text-muted-foreground/40 rotate-90" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* How to advance — only when tiered and not at max */}
      {tier !== null && config.tiers.length > 0 && tier < Math.max(...config.tiers.map((t) => t.tier)) && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Trophy className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">How to Advance</h3>
                <p className="text-xs text-muted-foreground">Meet these goals to level up</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                <TrendUp className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{config.promotionCriteria.months} months</p>
                  <p className="text-xs text-muted-foreground">minimum active period</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                <CurrencyCircleDollar className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{config.promotionCriteria.minCollections} collections</p>
                  <p className="text-xs text-muted-foreground">successful collections</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{config.promotionCriteria.minOnTimeRate}%</p>
                  <p className="text-xs text-muted-foreground">on-time rate</p>
                </div>
              </div>
            </div>
            {config.demotionRules && (
              <p className="text-xs text-muted-foreground border-t pt-3">
                <span className="font-medium">Note:</span> {config.demotionRules}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rules & Payout in 2-col layout */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Rules */}
        {config.agentRules.length > 0 && (
          <Card className={config.agentRules.length > 0 ? "" : "md:col-span-2"}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Rules & Guidelines</h3>
              </div>
              <ul className="space-y-2">
                {config.agentRules.map((rule, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-medium shrink-0">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{rule}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Payout */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <CalendarBlank className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Payout Schedule</h3>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <CalendarBlank className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">{config.payoutSchedule}</p>
                <p className="text-xs text-muted-foreground">Commission payouts are processed {config.payoutSchedule.toLowerCase()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
