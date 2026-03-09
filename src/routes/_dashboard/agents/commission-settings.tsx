import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import {
  getCommissionSettings,
  saveCommissionSettings,
} from "@/server/commission-settings"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AccessDenied } from "@/components/access-denied"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Spinner,
  Plus,
  Trash,
  ArrowLeft,
  Stack,
  TrendUp,
  ShieldCheck,
  CalendarBlank,
  Info,
  CaretDown,
} from "@phosphor-icons/react"
import { Switch } from "@/components/ui/switch"
import { Link } from "@tanstack/react-router"
import type {
  CommissionProgramConfig,
  CommissionTier,
  CommissionType,
} from "@/lib/constants/commission-defaults"

const validTabs = ["rules", "payout", "tiers", "promotion"] as const

export const Route = createFileRoute(
  "/_dashboard/agents/commission-settings",
)({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: validTabs.includes(search.tab as (typeof validTabs)[number])
      ? (search.tab as SectionId)
      : undefined,
  }),
  loader: async ({ context }) => {
    const { session } = context as {
      session: { user: { role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      return { config: null, unauthorized: true }
    }
    const config = await getCommissionSettings()
    return { config, unauthorized: false }
  },
  pendingComponent: SettingsSkeleton,
  component: CommissionSettingsPage,
})

function SettingsSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-4 w-48" />
      </div>
      {[1, 2, 3].map((i) => (
        <Card key={i} className="shadow-sm">
          <CardHeader className="p-4 pb-2">
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

const basicSections = [
  { id: "rules", label: "Rules & Guidelines", icon: ShieldCheck },
  { id: "payout", label: "Payout Schedule", icon: CalendarBlank },
] as const

const advancedSections = [
  { id: "tiers", label: "Commission Tiers", icon: Stack },
  { id: "promotion", label: "Promotion & Demotion", icon: TrendUp },
] as const

type SectionId = "rules" | "payout" | "tiers" | "promotion"

function CommissionSettingsPage() {
  const router = useRouter()
  const { config: initialConfig, unauthorized } = Route.useLoaderData()

  const { tab } = Route.useSearch()
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState<SectionId>(tab ?? "rules")
  const [advancedOpen, setAdvancedOpen] = useState(tab === "tiers" || tab === "promotion")

  // Auto-expand advanced when an advanced section is selected
  const isAdvancedSection = activeSection === "tiers" || activeSection === "promotion"
  const showAdvanced = advancedOpen || isAdvancedSection
  const [config, setConfig] = useState<CommissionProgramConfig>(
    initialConfig ?? {
      tiers: [],
      promotionCriteria: { months: 3, minCollections: 15, minOnTimeRate: 85 },
      demotionRules: "",
      agentRules: [],
      payoutSchedule: "Monthly",
    },
  )

  const tiersEnabled = config.tiers.length > 0

  if (unauthorized || !initialConfig) {
    return (
      <AccessDenied
        message="Only lenders can access commission settings."
        homeLink="/dashboard"
        homeLinkLabel="Go to Dashboard"
      />
    )
  }

  const updateTier = (index: number, updates: Partial<CommissionTier>) => {
    setConfig((prev) => ({
      ...prev,
      tiers: prev.tiers.map((t, i) => (i === index ? { ...t, ...updates } : t)),
    }))
  }

  const enableTiers = () => {
    setConfig((prev) => ({
      ...prev,
      tiers: prev.tiers.length > 0 ? prev.tiers : [
        {
          name: "Starter",
          tier: 1,
          commissionType: "fixed" as CommissionType,
          flatAmount: 50,
          percentageRate: 0,
          portfolioCap: 10,
          originationBonus: 100,
          originationQualifyingPayments: 3,
        },
      ],
    }))
  }

  const disableTiers = () => {
    setConfig((prev) => ({
      ...prev,
      tiers: [],
    }))
    // If currently viewing a tier-only section, go back to tiers
    if (activeSection === "promotion") {
      setActiveSection("tiers")
    }
  }

  const addTier = () => {
    if (config.tiers.length >= 3) return
    const nextTierNum = config.tiers.length + 1
    setConfig((prev) => ({
      ...prev,
      tiers: [
        ...prev.tiers,
        {
          name: `Tier ${nextTierNum}`,
          tier: nextTierNum,
          commissionType: "fixed" as CommissionType,
          flatAmount: 50,
          percentageRate: 0,
          portfolioCap: 10,
          originationBonus: 100,
          originationQualifyingPayments: 3,
        },
      ],
    }))
  }

  const removeTier = (index: number) => {
    if (config.tiers.length <= 1) return
    setConfig((prev) => ({
      ...prev,
      tiers: prev.tiers
        .filter((_, i) => i !== index)
        .map((t, i) => ({ ...t, tier: i + 1 })),
    }))
  }

  const addRule = () => {
    setConfig((prev) => ({
      ...prev,
      agentRules: [...prev.agentRules, ""],
    }))
  }

  const updateRule = (index: number, value: string) => {
    setConfig((prev) => ({
      ...prev,
      agentRules: prev.agentRules.map((r, i) => (i === index ? value : r)),
    }))
  }

  const removeRule = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      agentRules: prev.agentRules.filter((_, i) => i !== index),
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Filter out empty rules
      const cleaned = {
        ...config,
        agentRules: config.agentRules.filter((r) => r.trim() !== ""),
      }
      await saveCommissionSettings({ data: cleaned })
      toast.success("Commission settings saved")
      router.invalidate()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save settings",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Commission Settings
          </h1>
          <p className="text-muted-foreground">
            Configure your agent commission program
          </p>
        </div>
        <Link
          to="/agents"
          className={buttonVariants({ variant: "outline" }) + " gap-2"}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Agents
        </Link>
      </div>

      {/* Mobile tabs */}
      <div className="lg:hidden border-b bg-card -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
        <div>
          <div className="flex items-center gap-1 overflow-x-auto py-2 -mb-px">
            {basicSections.map((section) => {
              const Icon = section.icon
              const isActive = activeSection === section.id
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" weight={isActive ? "fill" : "regular"} />
                  {section.label}
                </button>
              )
            })}
            <span className="text-border mx-1">|</span>
            {advancedSections
              .filter((s) => s.id !== "promotion" || tiersEnabled)
              .map((section) => {
                const Icon = section.icon
                const isActive = activeSection === section.id
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" weight={isActive ? "fill" : "regular"} />
                    {section.label}
                  </button>
                )
              })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div>
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          {/* Desktop sidebar */}
          <nav className="hidden lg:block sticky top-[72px] self-start">
            <Card className="shadow-sm overflow-hidden">
              <div className="p-2 space-y-0.5">
                {basicSections.map((section) => {
                  const Icon = section.icon
                  const isActive = activeSection === section.id
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" weight={isActive ? "fill" : "regular"} />
                      {section.label}
                    </button>
                  )
                })}
              </div>

              <div className="border-t mx-2" />

              <div className="p-2">
                <button
                  onClick={() => setAdvancedOpen((prev) => !prev)}
                  className="flex items-center justify-between w-full px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors rounded-md"
                >
                  Advanced
                  <CaretDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                </button>
                {showAdvanced && (
                  <div className="space-y-0.5 mt-0.5">
                    {advancedSections
                      .filter((s) => s.id !== "promotion" || tiersEnabled)
                      .map((section) => {
                        const Icon = section.icon
                        const isActive = activeSection === section.id
                        return (
                          <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                              isActive
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            <Icon className="h-4 w-4 shrink-0" weight={isActive ? "fill" : "regular"} />
                            {section.label}
                          </button>
                        )
                      })}
                  </div>
                )}
              </div>

              <div className="border-t mx-2" />

              <div className="p-2 space-y-1.5">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full gap-2"
                  size="sm"
                >
                  {saving ? (
                    <>
                      <Spinner className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Settings"
                  )}
                </Button>
                <Link
                  to="/agents"
                  className={buttonVariants({ variant: "outline", size: "sm" }) + " w-full"}
                >
                  Cancel
                </Link>
              </div>
            </Card>
          </nav>

          {/* Section content */}
          <div className="space-y-6">
            {activeSection === "tiers" && (
              <TiersSection
                config={config}
                tiersEnabled={tiersEnabled}
                enableTiers={enableTiers}
                disableTiers={disableTiers}
                updateTier={updateTier}
                addTier={addTier}
                removeTier={removeTier}
              />
            )}

            {activeSection === "promotion" && tiersEnabled && (
              <PromotionSection config={config} setConfig={setConfig} />
            )}

            {activeSection === "rules" && (
              <RulesSection
                config={config}
                addRule={addRule}
                updateRule={updateRule}
                removeRule={removeRule}
              />
            )}

            {activeSection === "payout" && (
              <PayoutSection config={config} setConfig={setConfig} />
            )}

            {/* Save button on mobile */}
            <div className="flex justify-end gap-3 pt-2 lg:hidden">
              <Link
                to="/agents"
                className={buttonVariants({ variant: "outline" })}
              >
                Cancel
              </Link>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="gap-2"
              >
                {saving ? (
                  <>
                    <Spinner className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Settings"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ========================================================================== */
/* Section Components                                                         */
/* ========================================================================== */

function TiersSection({
  config,
  tiersEnabled,
  enableTiers,
  disableTiers,
  updateTier,
  addTier,
  removeTier,
}: {
  config: CommissionProgramConfig
  tiersEnabled: boolean
  enableTiers: () => void
  disableTiers: () => void
  updateTier: (index: number, updates: Partial<CommissionTier>) => void
  addTier: () => void
  removeTier: (index: number) => void
}) {
  return (
    <div className="space-y-6">
      {/* Master toggle */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Enable Tiered Commission</p>
              <p className="text-xs text-muted-foreground">
                Override the basic flat rate with tier-based commission structures
              </p>
            </div>
            <Switch
              checked={tiersEnabled}
              onCheckedChange={(checked) => checked ? enableTiers() : disableTiers()}
            />
          </div>
        </CardContent>
      </Card>

      {!tiersEnabled ? (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex gap-2.5">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                All agents are using their <span className="font-medium text-foreground">basic commission rate</span> — the flat percentage you set when adding each agent. Enable tiered commission above to create structured tiers with fixed amounts, percentage rates, and portfolio caps.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Commission Tiers</CardTitle>
                <CardDescription>
                  Define the commission structure for each tier level
                </CardDescription>
              </div>
              {config.tiers.length < 3 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={addTier}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Tier
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            {config.tiers.map((tier, index) => (
          <div
            key={index}
            className="p-4 rounded-lg border space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Tier {tier.tier}</h3>
              {config.tiers.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTier(index)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tier Name</Label>
                <Input
                  value={tier.name}
                  onChange={(e) =>
                    updateTier(index, { name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Commission Type</Label>
                <Select
                  value={tier.commissionType}
                  onValueChange={(val) =>
                    updateTier(index, {
                      commissionType: val as CommissionType,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(value) => {
                        const labels: Record<string, string> = {
                          fixed: "Fixed Amount",
                          higher_of: "% or Fixed (whichever is higher)",
                          percentage: "Percentage",
                        }
                        return labels[value as string] ?? value
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                    <SelectItem value="higher_of">
                      % or Fixed (whichever is higher)
                    </SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(tier.commissionType === "fixed" ||
                tier.commissionType === "higher_of") && (
                <div className="space-y-2">
                  <Label>Flat Amount (PHP)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={tier.flatAmount}
                    onChange={(e) =>
                      updateTier(index, {
                        flatAmount: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              )}

              {(tier.commissionType === "percentage" ||
                tier.commissionType === "higher_of") && (
                <div className="space-y-2">
                  <Label>Percentage Rate (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={tier.percentageRate}
                    onChange={(e) =>
                      updateTier(index, {
                        percentageRate: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Portfolio Cap (max loans)</Label>
                <Input
                  type="number"
                  min="1"
                  value={tier.portfolioCap}
                  onChange={(e) =>
                    updateTier(index, {
                      portfolioCap: parseInt(e.target.value) || 1,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Origination Bonus (PHP)</Label>
                <Input
                  type="number"
                  min="0"
                  value={tier.originationBonus}
                  onChange={(e) =>
                    updateTier(index, {
                      originationBonus: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Qualifying Payments for Bonus</Label>
                <Input
                  type="number"
                  min="0"
                  value={tier.originationQualifyingPayments}
                  onChange={(e) =>
                    updateTier(index, {
                      originationQualifyingPayments:
                        parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
          </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function PromotionSection({
  config,
  setConfig,
}: {
  config: CommissionProgramConfig
  setConfig: React.Dispatch<React.SetStateAction<CommissionProgramConfig>>
}) {
  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle>Promotion Criteria</CardTitle>
          <CardDescription>
            Requirements for agents to advance to the next tier
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Minimum Months Active</Label>
              <Input
                type="number"
                min="1"
                value={config.promotionCriteria.months}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    promotionCriteria: {
                      ...prev.promotionCriteria,
                      months: parseInt(e.target.value) || 1,
                    },
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Minimum Collections</Label>
              <Input
                type="number"
                min="1"
                value={config.promotionCriteria.minCollections}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    promotionCriteria: {
                      ...prev.promotionCriteria,
                      minCollections: parseInt(e.target.value) || 1,
                    },
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Minimum On-Time Rate (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={config.promotionCriteria.minOnTimeRate}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    promotionCriteria: {
                      ...prev.promotionCriteria,
                      minOnTimeRate: parseFloat(e.target.value) || 0,
                    },
                  }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle>Demotion Rules</CardTitle>
          <CardDescription>
            Conditions under which an agent may be demoted to a lower tier
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <Textarea
            rows={3}
            value={config.demotionRules}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                demotionRules: e.target.value,
              }))
            }
            placeholder="e.g. On-time collection rate drops below 70% for 2 consecutive months..."
          />
        </CardContent>
      </Card>
    </div>
  )
}

function RulesSection({
  config,
  addRule,
  updateRule,
  removeRule,
}: {
  config: CommissionProgramConfig
  addRule: () => void
  updateRule: (index: number, value: string) => void
  removeRule: (index: number) => void
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Agent Rules & Guidelines</CardTitle>
            <CardDescription>
              Rules that agents must follow
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={addRule}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Rule
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        {config.agentRules.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No rules defined. Click "Add Rule" to add one.
          </p>
        )}
        {config.agentRules.map((rule, index) => (
          <div key={index} className="flex gap-2">
            <span className="text-sm text-muted-foreground pt-2.5 min-w-[1.5rem]">
              {index + 1}.
            </span>
            <Input
              value={rule}
              onChange={(e) => updateRule(index, e.target.value)}
              placeholder="Enter rule..."
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeRule(index)}
              className="text-destructive hover:text-destructive shrink-0"
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function PayoutSection({
  config,
  setConfig,
}: {
  config: CommissionProgramConfig
  setConfig: React.Dispatch<React.SetStateAction<CommissionProgramConfig>>
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="p-4 pb-2">
        <CardTitle>Payout Schedule</CardTitle>
        <CardDescription>
          How often accumulated commissions are paid out
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <Input
          value={config.payoutSchedule}
          onChange={(e) =>
            setConfig((prev) => ({
              ...prev,
              payoutSchedule: e.target.value,
            }))
          }
          placeholder="e.g. Monthly"
        />
      </CardContent>
    </Card>
  )
}
