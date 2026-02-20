import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import { getTierConfigs, saveTierConfigs } from "@/server/tier-configs"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AccessDenied } from "@/components/access-denied"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { SkeletonFormPage } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  Spinner,
  ArrowLeft,
  Star,
  Crown,
  Medal,
  UserCircle,
  CaretDown,
} from "@phosphor-icons/react"
import type { PenaltyConfig } from "@/lib/constants/penalty-defaults"
import {
  type BorrowerTier,
  getTierLabel,
  getTierRequirementLabel,
} from "@/lib/constants/tier-defaults"
import { cn } from "@/lib/utils"

type TierConfigState = {
  tier: BorrowerTier
  interestRate: number
  penaltyConfig: PenaltyConfig
}

export const Route = createFileRoute("/_dashboard/settings/member-tiers")({
  loader: async ({ context }) => {
    const { session } = context as {
      session: { user: { role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      return { configs: null, unauthorized: true }
    }
    const configs = await getTierConfigs()
    return { configs, unauthorized: false }
  },
  pendingComponent: SkeletonFormPage,
  component: MemberTiersPage,
})

const TIER_ICONS: Record<BorrowerTier, typeof Star> = {
  new: UserCircle,
  returning: Medal,
  established: Star,
  loyal: Crown,
}

const TIER_COLORS: Record<BorrowerTier, string> = {
  new: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  returning: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  established: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  loyal: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
}

const TIER_BORDER_COLORS: Record<BorrowerTier, string> = {
  new: "border-l-gray-400",
  returning: "border-l-green-500",
  established: "border-l-blue-500",
  loyal: "border-l-purple-500",
}

function MemberTiersPage() {
  const { configs: initialConfigs, unauthorized } = Route.useLoaderData()
  const router = useRouter()
  const [configs, setConfigs] = useState<TierConfigState[]>(initialConfigs ?? [])
  const [isSaving, setIsSaving] = useState(false)
  const [openPenalty, setOpenPenalty] = useState<BorrowerTier | null>(null)

  if (unauthorized || !initialConfigs) {
    return (
      <AccessDenied
        message="Only lenders can manage member tier settings."
        homeLink="/agent"
        homeLinkLabel="Go to Agent Portal"
      />
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await saveTierConfigs({ data: configs })
      toast.success("Member tier settings saved")
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }

  const updateConfig = (tier: BorrowerTier, partial: Partial<TierConfigState>) => {
    setConfigs((prev) =>
      prev.map((c) => (c.tier === tier ? { ...c, ...partial } : c))
    )
  }

  const updatePenalty = (tier: BorrowerTier, partial: Partial<PenaltyConfig>) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.tier === tier
          ? { ...c, penaltyConfig: { ...c.penaltyConfig, ...partial } }
          : c
      )
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-[hsl(215_45%_14%)] text-white pt-6 lg:pt-8 pb-16">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 space-y-4">
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 text-sm text-blue-200/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Link>

          <div className="flex items-center gap-2 text-sm text-blue-200/70">
            <span>Settings</span>
            <span className="text-blue-300/40">·</span>
            <span>Member Tiers</span>
            <span className="text-blue-300/40">·</span>
            <span>{format(new Date(), "EEEE, MMMM d, yyyy")}</span>
          </div>

          <div className="border-l-4 border-primary pl-4">
            <h1 className="text-4xl font-bold tracking-tight">Member Tiers</h1>
            <p className="text-blue-200/70">
              Configure interest rates, grace periods, and penalty rules per borrower tier
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-8 pb-8 space-y-6 relative">
        <div className="max-w-2xl space-y-6">
          {configs.map((config) => {
            const Icon = TIER_ICONS[config.tier]
            const isOpen = openPenalty === config.tier

            return (
              <Card
                key={config.tier}
                className={cn("shadow-lg border-l-4", TIER_BORDER_COLORS[config.tier])}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Icon className="h-5 w-5" />
                      {getTierLabel(config.tier)}
                    </CardTitle>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        TIER_COLORS[config.tier]
                      )}
                    >
                      {getTierRequirementLabel(config.tier)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  {/* Interest Rate + Grace Period */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Interest Rate (% / month)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="15"
                        step="0.5"
                        value={config.interestRate}
                        onChange={(e) =>
                          updateConfig(config.tier, {
                            interestRate: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Grace Period (days)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="90"
                        value={config.penaltyConfig.gracePeriodDays}
                        onChange={(e) =>
                          updatePenalty(config.tier, {
                            gracePeriodDays: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Penalty Config (collapsible) */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setOpenPenalty(isOpen ? null : config.tier)}
                      className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full p-2 rounded border bg-muted/30"
                    >
                      <CaretDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          isOpen && "rotate-180"
                        )}
                      />
                      Penalty Rules
                      <span className="ml-auto text-xs">
                        {config.penaltyConfig.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </button>
                    {isOpen && <div className="space-y-4 pt-4">
                      {/* Enable toggle */}
                      <div className="flex items-center justify-between">
                        <Label>Enable Penalties</Label>
                        <Switch
                          checked={config.penaltyConfig.enabled}
                          onCheckedChange={(enabled) =>
                            updatePenalty(config.tier, { enabled })
                          }
                        />
                      </div>

                      {config.penaltyConfig.enabled && (
                        <>
                          {/* Late Fee */}
                          <div className="space-y-3 p-3 rounded border bg-muted/20">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm">Late Fee</Label>
                              <Switch
                                checked={config.penaltyConfig.lateFee.enabled}
                                onCheckedChange={(enabled) =>
                                  updatePenalty(config.tier, {
                                    lateFee: { ...config.penaltyConfig.lateFee, enabled },
                                  })
                                }
                              />
                            </div>
                            {config.penaltyConfig.lateFee.enabled && (
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                  <Label className="text-xs">Type</Label>
                                  <Select
                                    value={config.penaltyConfig.lateFee.type}
                                    onValueChange={(type) => {
                                      if (type)
                                        updatePenalty(config.tier, {
                                          lateFee: {
                                            ...config.penaltyConfig.lateFee,
                                            type: type as "fixed" | "percentage",
                                          },
                                        })
                                    }}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      {config.penaltyConfig.lateFee.type === "fixed"
                                        ? "Fixed"
                                        : "Percentage"}
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                                      <SelectItem value="percentage">Percentage</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">
                                    {config.penaltyConfig.lateFee.type === "fixed"
                                      ? "Amount"
                                      : "Percentage"}
                                  </Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="1"
                                    className="h-8 text-xs"
                                    value={config.penaltyConfig.lateFee.amount}
                                    onChange={(e) =>
                                      updatePenalty(config.tier, {
                                        lateFee: {
                                          ...config.penaltyConfig.lateFee,
                                          amount: parseFloat(e.target.value) || 0,
                                        },
                                      })
                                    }
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Daily Penalty Interest */}
                          <div className="space-y-3 p-3 rounded border bg-muted/20">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm">Daily Penalty Interest</Label>
                              <Switch
                                checked={config.penaltyConfig.dailyPenaltyInterest.enabled}
                                onCheckedChange={(enabled) =>
                                  updatePenalty(config.tier, {
                                    dailyPenaltyInterest: {
                                      ...config.penaltyConfig.dailyPenaltyInterest,
                                      enabled,
                                    },
                                  })
                                }
                              />
                            </div>
                            {config.penaltyConfig.dailyPenaltyInterest.enabled && (
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                  <Label className="text-xs">Rate / Day (%)</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    max="10"
                                    step="0.01"
                                    className="h-8 text-xs"
                                    value={config.penaltyConfig.dailyPenaltyInterest.ratePerDay}
                                    onChange={(e) =>
                                      updatePenalty(config.tier, {
                                        dailyPenaltyInterest: {
                                          ...config.penaltyConfig.dailyPenaltyInterest,
                                          ratePerDay: parseFloat(e.target.value) || 0,
                                        },
                                      })
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Max Days</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    max="365"
                                    className="h-8 text-xs"
                                    value={config.penaltyConfig.dailyPenaltyInterest.maxDays}
                                    onChange={(e) =>
                                      updatePenalty(config.tier, {
                                        dailyPenaltyInterest: {
                                          ...config.penaltyConfig.dailyPenaltyInterest,
                                          maxDays: parseInt(e.target.value) || 1,
                                        },
                                      })
                                    }
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Penalty Cap */}
                          <div className="space-y-3 p-3 rounded border bg-muted/20">
                            <Label className="text-sm">Penalty Cap</Label>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Cap Type</Label>
                                <Select
                                  value={config.penaltyConfig.penaltyCap.type}
                                  onValueChange={(type) => {
                                    if (type)
                                      updatePenalty(config.tier, {
                                        penaltyCap: {
                                          ...config.penaltyConfig.penaltyCap,
                                          type: type as "fixed" | "percentage",
                                        },
                                      })
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    {config.penaltyConfig.penaltyCap.type === "fixed"
                                      ? "Fixed"
                                      : "% of Principal"}
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="percentage">% of Principal</SelectItem>
                                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">
                                  {config.penaltyConfig.penaltyCap.type === "fixed"
                                    ? "Max Amount"
                                    : "Max %"}
                                </Label>
                                <Input
                                  type="number"
                                  min="0"
                                  className="h-8 text-xs"
                                  value={config.penaltyConfig.penaltyCap.amount}
                                  onChange={(e) =>
                                    updatePenalty(config.tier, {
                                      penaltyCap: {
                                        ...config.penaltyConfig.penaltyCap,
                                        amount: parseFloat(e.target.value) || 0,
                                      },
                                    })
                                  }
                                />
                              </div>
                            </div>
                          </div>

                          {/* Commission on Penalties */}
                          <div className="flex items-center justify-between p-3 rounded border bg-muted/20">
                            <Label className="text-sm">Commission on Penalties</Label>
                            <Switch
                              checked={config.penaltyConfig.commissionOnPenalties}
                              onCheckedChange={(commissionOnPenalties) =>
                                updatePenalty(config.tier, { commissionOnPenalties })
                              }
                            />
                          </div>
                        </>
                      )}
                    </div>}
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {/* Save */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving ? (
                <>
                  <Spinner className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save All"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
