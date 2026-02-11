import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { SkeletonStatsPage } from "@/components/ui/skeleton"
import { getAgentDashboard } from "@/server/agents"
import { getAgentCommissionPrograms } from "@/server/commission-settings"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AccessDenied } from "@/components/access-denied"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { formatCurrencyCompact } from "@/lib/utils"
import { PageHeader, PageContent } from "@/components/ui/page-header"
import type { CommissionProgramConfig } from "@/lib/constants/commission-defaults"
import {
  TrendUp,
  Receipt,
  Wallet,
  Star,
  CaretDown,
  Trophy,
  CurrencyCircleDollar,
  CheckCircle,
  ShieldCheck,
  CalendarBlank,
  ClipboardText,
} from "@phosphor-icons/react"

export const Route = createFileRoute("/_dashboard/agent/earnings")({
  loader: async ({ context }) => {
    const { session } = context as {
      session: { user: { role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.AGENT)) {
      return { dashboard: null, programs: null, unauthorized: true }
    }
    const [dashboard, programs] = await Promise.all([
      getAgentDashboard(),
      getAgentCommissionPrograms(),
    ])
    return { dashboard, programs, unauthorized: false }
  },
  pendingComponent: SkeletonStatsPage,
  component: AgentEarningsPage,
})

function AgentEarningsPage() {
  const { dashboard, programs, unauthorized } = Route.useLoaderData()

  if (unauthorized || !dashboard) {
    return (
      <AccessDenied
        title="Agent Portal"
        message="You need to be an agent to access this portal."
        homeLink="/dashboard"
        homeLinkLabel="Go to Dashboard"
      />
    )
  }

  const totalEarned = parseFloat(dashboard.totalCommissionEarned)
  const pending = parseFloat(dashboard.pendingCommission)
  const paid = totalEarned - pending

  // Build a map from agentId (relationship ID) to program config
  const programMap = new Map(
    (programs ?? []).map((p) => [p.agentId, p])
  )

  return (
    <div>
      <PageHeader
        badge="Agent Portal"
        section="Earnings"
        title="Earnings"
        subtitle="Your commissions and program details"
      />
      <PageContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-2 md:gap-4">
          <Card className="p-0">
            <div className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-1 md:pb-2">
              <p className="text-xs md:text-sm font-medium">Earned</p>
              <TrendUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
            </div>
            <div className="p-3 md:p-4 pt-0">
              <div className="text-lg md:text-2xl font-bold">
                {formatCurrencyCompact(totalEarned)}
              </div>
            </div>
          </Card>

          <Card className="p-0">
            <div className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-1 md:pb-2">
              <p className="text-xs md:text-sm font-medium">Paid</p>
              <Receipt className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
            </div>
            <div className="p-3 md:p-4 pt-0">
              <div className="text-lg md:text-2xl font-bold">
                {formatCurrencyCompact(paid)}
              </div>
            </div>
          </Card>

          <Card className="p-0 border-amber-500/50 bg-amber-50 dark:bg-amber-950">
            <div className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-1 md:pb-2">
              <p className="text-xs md:text-sm font-medium">Pending</p>
              <Wallet className="h-3.5 w-3.5 md:h-4 md:w-4 text-amber-500" />
            </div>
            <div className="p-3 md:p-4 pt-0">
              <div className="text-lg md:text-2xl font-bold text-amber-500">
                {formatCurrencyCompact(pending)}
              </div>
            </div>
          </Card>
        </div>

        {/* Per-lender sections */}
        {dashboard.relationships.length > 0 ? (
          <div className="space-y-6">
            {dashboard.relationships.map((rel) => {
              const program = programMap.get(rel.id)
              return (
                <LenderSection
                  key={rel.id}
                  rel={rel}
                  program={program ?? null}
                />
              )
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ClipboardText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-1">No earnings yet</h3>
              <p className="text-muted-foreground text-sm">
                Once a lender adds you as their agent, your earnings will appear here.
              </p>
            </CardContent>
          </Card>
        )}
      </PageContent>
    </div>
  )
}

// ---- Per-lender section ----

interface LenderRelationship {
  id: string
  lenderName: string
  lenderEmail: string
  commissionRate: string
  totalCollected: string
  totalCommissionEarned: string
  pendingCommission: string
}

interface Program {
  agentId: string
  lenderName: string
  tier: number | null
  commissionRate: string
  config: CommissionProgramConfig
}

function LenderSection({
  rel,
  program,
}: {
  rel: LenderRelationship
  program: Program | null
}) {
  const [showAdvance, setShowAdvance] = useState(false)
  const [showRules, setShowRules] = useState(false)

  const earned = parseFloat(rel.totalCommissionEarned)
  const relPending = parseFloat(rel.pendingCommission)

  const tier = program?.tier ?? null
  const config = program?.config
  const currentTierConfig =
    tier !== null && config
      ? config.tiers.find((t) => t.tier === tier)
      : null

  const maxTier = config ? Math.max(...config.tiers.map((t) => t.tier)) : 0
  const canAdvance = tier !== null && config && config.tiers.length > 0 && tier < maxTier

  // Commission type description
  let commissionDesc: string
  if (tier !== null && currentTierConfig) {
    if (currentTierConfig.commissionType === "fixed") {
      commissionDesc = `₱${currentTierConfig.flatAmount} per collection`
    } else if (currentTierConfig.commissionType === "percentage") {
      commissionDesc = `${currentTierConfig.percentageRate}% of collected`
    } else {
      commissionDesc = `${currentTierConfig.percentageRate}% or ₱${currentTierConfig.flatAmount}`
    }
  } else {
    commissionDesc = `${rel.commissionRate}% of collected`
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-4 sm:p-5 space-y-4">
        {/* Header: lender name + tier badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm sm:text-base truncate">
              {rel.lenderName}
            </p>
            <p className="text-xs text-muted-foreground">{commissionDesc}</p>
          </div>
          {tier !== null && currentTierConfig ? (
            <Badge variant="default" className="shrink-0 gap-1">
              <Star className="h-3 w-3" weight="fill" />
              Tier {tier} — {currentTierConfig.name}
            </Badge>
          ) : (
            <Badge variant="secondary" className="shrink-0">
              {rel.commissionRate}%
            </Badge>
          )}
        </div>

        {/* Collected / Earned / Pending amounts */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Collected</p>
            <p className="font-semibold">{formatCurrencyCompact(rel.totalCollected)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Earned</p>
            <p className="font-semibold">{formatCurrencyCompact(earned)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Pending</p>
            <p className="font-semibold text-primary">
              {formatCurrencyCompact(relPending)}
            </p>
          </div>
        </div>

        {/* Tier progression — horizontal step indicator */}
        {tier !== null && config && config.tiers.length > 1 && (
          <div className="flex items-center gap-1">
            {config.tiers.map((t, i) => {
              const isCurrent = t.tier === tier
              const isPast = t.tier < tier!
              return (
                <div key={t.tier} className="flex items-center gap-1 flex-1">
                  <div
                    className={`flex items-center justify-center h-7 w-full rounded text-xs font-medium transition-colors ${
                      isCurrent
                        ? "bg-primary text-primary-foreground"
                        : isPast
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isPast ? (
                      <CheckCircle className="h-3.5 w-3.5" weight="fill" />
                    ) : (
                      <span>{t.name}</span>
                    )}
                  </div>
                  {i < config.tiers.length - 1 && (
                    <div
                      className={`h-0.5 w-2 shrink-0 ${
                        isPast ? "bg-primary/40" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Collapsible: How to advance */}
        {canAdvance && config && (
          <div className="border-t pt-3">
            <button
              onClick={() => setShowAdvance((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              <Trophy className="h-3.5 w-3.5 text-primary" />
              How to advance
              <CaretDown
                className={`h-3 w-3 ml-auto transition-transform ${showAdvance ? "rotate-180" : ""}`}
              />
            </button>
            {showAdvance && (
              <div className="grid gap-2 sm:grid-cols-3 mt-3">
                <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5">
                  <TrendUp className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium">{config.promotionCriteria.months} months</p>
                    <p className="text-[11px] text-muted-foreground">active period</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5">
                  <CurrencyCircleDollar className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium">{config.promotionCriteria.minCollections} collections</p>
                    <p className="text-[11px] text-muted-foreground">successful</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5">
                  <CheckCircle className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium">{config.promotionCriteria.minOnTimeRate}%</p>
                    <p className="text-[11px] text-muted-foreground">on-time rate</p>
                  </div>
                </div>
                {config.demotionRules && (
                  <p className="text-[11px] text-muted-foreground sm:col-span-3">
                    <span className="font-medium">Note:</span> {config.demotionRules}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Collapsible: Rules & Payout */}
        {config && (config.agentRules.length > 0 || config.payoutSchedule) && (
          <div className={`${canAdvance ? "" : "border-t pt-3"}`}>
            <button
              onClick={() => setShowRules((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Rules & Payout
              <CaretDown
                className={`h-3 w-3 ml-auto transition-transform ${showRules ? "rotate-180" : ""}`}
              />
            </button>
            {showRules && (
              <div className="mt-3 space-y-3">
                {config.agentRules.length > 0 && (
                  <ul className="space-y-1.5">
                    {config.agentRules.map((rule, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs text-muted-foreground"
                      >
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[10px] font-medium shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {config.payoutSchedule && (
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                    <CalendarBlank className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <p className="text-xs font-semibold">{config.payoutSchedule}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Payouts processed {config.payoutSchedule.toLowerCase()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
