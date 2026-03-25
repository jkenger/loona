import { createFileRoute, useRouter, Link } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { getCommissionSettings, saveCommissionSettings } from "@/server/commission-settings"
import { Button, buttonVariants } from "@/components/ui/button"
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
  CurrencyDollar,
} from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import type {
  CommissionProgramConfig,
  CommissionTier,
  CommissionType,
} from "@/lib/constants/commission-defaults"

const validTabs = ["rules", "payout", "tiers", "promotion"] as const

export const Route = createFileRoute("/_dashboard/agents/commission-settings")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: validTabs.includes(search.tab as (typeof validTabs)[number])
      ? (search.tab as SectionId)
      : undefined,
  }),
  loader: async ({ context }) => {
    const { session } = context as { session: { user: { role: string | null } } }
    if (!hasRole(session.user.role, ROLES.LENDER)) return { config: null, unauthorized: true }
    const config = await getCommissionSettings()
    return { config, unauthorized: false }
  },
  pendingComponent: SettingsSkeleton,
  component: CommissionSettingsPage,
})

function SettingsSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-4xl mx-auto space-y-6">
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <Skeleton className="h-48 w-full rounded-xl hidden lg:block" />
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}

// ---- Shared components ----

function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border bg-card", className)}>{children}</div>
}

function SectionHeader({ icon: IconComp, title, description, action }: { icon: Icon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <IconComp className="h-4.5 w-4.5 text-muted-foreground" weight="bold" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

function SettingRow({ label, description, children, border = true }: { label: string; description?: string; children: React.ReactNode; border?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 px-5 py-3.5", border && "border-t")}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

// ---- Nav sections ----

const basicSections = [
  { id: "rules", label: "Rules & Guidelines", icon: ShieldCheck },
  { id: "payout", label: "Payout Schedule", icon: CalendarBlank },
] as const

const advancedSections = [
  { id: "tiers", label: "Commission Tiers", icon: Stack },
  { id: "promotion", label: "Promotion & Demotion", icon: TrendUp },
] as const

type SectionId = "rules" | "payout" | "tiers" | "promotion"

// ---- Main page ----

function CommissionSettingsPage() {
  const router = useRouter()
  const { config: initialConfig, unauthorized } = Route.useLoaderData()
  const { tab } = Route.useSearch()
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState<SectionId>(tab ?? "rules")
  const [advancedOpen, setAdvancedOpen] = useState(tab === "tiers" || tab === "promotion")

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
    return <AccessDenied message="Only lenders can access commission settings." homeLink="/dashboard" homeLinkLabel="Go to Dashboard" />
  }

  const updateTier = (index: number, updates: Partial<CommissionTier>) => {
    setConfig((prev) => ({ ...prev, tiers: prev.tiers.map((t, i) => (i === index ? { ...t, ...updates } : t)) }))
  }

  const enableTiers = () => {
    setConfig((prev) => ({
      ...prev,
      tiers: prev.tiers.length > 0 ? prev.tiers : [{
        name: "Starter", tier: 1, commissionType: "fixed" as CommissionType,
        flatAmount: 50, percentageRate: 0, portfolioCap: 10,
        originationBonus: 100, originationQualifyingPayments: 3,
      }],
    }))
  }

  const disableTiers = () => {
    setConfig((prev) => ({ ...prev, tiers: [] }))
    if (activeSection === "promotion") setActiveSection("tiers")
  }

  const addTier = () => {
    if (config.tiers.length >= 3) return
    const n = config.tiers.length + 1
    setConfig((prev) => ({
      ...prev,
      tiers: [...prev.tiers, {
        name: `Tier ${n}`, tier: n, commissionType: "fixed" as CommissionType,
        flatAmount: 50, percentageRate: 0, portfolioCap: 10,
        originationBonus: 100, originationQualifyingPayments: 3,
      }],
    }))
  }

  const removeTier = (index: number) => {
    if (config.tiers.length <= 1) return
    setConfig((prev) => ({ ...prev, tiers: prev.tiers.filter((_, i) => i !== index).map((t, i) => ({ ...t, tier: i + 1 })) }))
  }

  const addRule = () => setConfig((prev) => ({ ...prev, agentRules: [...prev.agentRules, ""] }))
  const updateRule = (index: number, value: string) => setConfig((prev) => ({ ...prev, agentRules: prev.agentRules.map((r, i) => (i === index ? value : r)) }))
  const removeRule = (index: number) => setConfig((prev) => ({ ...prev, agentRules: prev.agentRules.filter((_, i) => i !== index) }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveCommissionSettings({ data: { ...config, agentRules: config.agentRules.filter((r) => r.trim() !== "") } })
      toast.success("Commission settings saved")
      router.invalidate()
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to save") }
    finally { setSaving(false) }
  }

  // Nav button helper
  const NavBtn = ({ section, isActive }: { section: { id: string; label: string; icon: Icon }; isActive: boolean }) => {
    const IconComp = section.icon
    return (
      <button
        onClick={() => setActiveSection(section.id as SectionId)}
        className={cn(
          "flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <IconComp className="h-4 w-4 shrink-0" weight={isActive ? "fill" : "regular"} />
        {section.label}
      </button>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link to="/agents" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3">
            <ArrowLeft className="h-3.5 w-3.5" />
            Agents
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Commission Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure your agent commission program.</p>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="lg:hidden overflow-x-auto -mx-4 px-4">
        <div className="flex items-center gap-1 pb-2">
          {basicSections.map((s) => <NavBtn key={s.id} section={s} isActive={activeSection === s.id} />)}
          <span className="text-border mx-1">|</span>
          {advancedSections.filter((s) => s.id !== "promotion" || tiersEnabled).map((s) => <NavBtn key={s.id} section={s} isActive={activeSection === s.id} />)}
        </div>
      </div>

      {/* Content */}
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        {/* Desktop sidebar */}
        <nav className="hidden lg:block sticky top-[72px] self-start">
          <div className="rounded-xl border bg-card p-2 space-y-0.5">
            {basicSections.map((s) => <NavBtn key={s.id} section={s} isActive={activeSection === s.id} />)}

            <div className="border-t my-1.5 mx-1" />

            <button
              onClick={() => setAdvancedOpen((prev) => !prev)}
              className="flex items-center justify-between w-full px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors rounded-lg"
            >
              Advanced
              <CaretDown className={cn("h-3.5 w-3.5 transition-transform", showAdvanced && "rotate-180")} />
            </button>
            {showAdvanced && (
              <div className="space-y-0.5">
                {advancedSections.filter((s) => s.id !== "promotion" || tiersEnabled).map((s) => <NavBtn key={s.id} section={s} isActive={activeSection === s.id} />)}
              </div>
            )}

            <div className="border-t my-1.5 mx-1" />

            <div className="space-y-1.5 pt-1">
              <Button onClick={handleSave} disabled={saving} className="w-full gap-2" size="sm">
                {saving ? <><Spinner className="h-4 w-4 animate-spin" />Saving...</> : "Save Settings"}
              </Button>
              <Link to="/agents" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}>Cancel</Link>
            </div>
          </div>
        </nav>

        {/* Section content */}
        <div className="space-y-6">
          {activeSection === "rules" && (
            <Section>
              <SectionHeader
                icon={ShieldCheck}
                title="Agent Rules & Guidelines"
                description="Rules that agents must follow"
                action={<Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={addRule}><Plus className="h-3.5 w-3.5" />Add Rule</Button>}
              />
              <div className="px-5 pb-5 space-y-2">
                {config.agentRules.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">No rules defined yet.</p>
                )}
                {config.agentRules.map((rule, index) => (
                  <div key={index} className="flex gap-2">
                    <span className="text-xs text-muted-foreground pt-2.5 min-w-[1.5rem]">{index + 1}.</span>
                    <Input value={rule} onChange={(e) => updateRule(index, e.target.value)} placeholder="Enter rule..." className="flex-1 h-8 text-sm" />
                    <Button variant="ghost" size="sm" onClick={() => removeRule(index)} className="text-destructive hover:text-destructive h-8 w-8 p-0">
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {activeSection === "payout" && (
            <Section>
              <SectionHeader icon={CalendarBlank} title="Payout Schedule" description="How often commissions are paid out" />
              <div className="px-5 pb-5">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Schedule</Label>
                  <Input value={config.payoutSchedule} onChange={(e) => setConfig((prev) => ({ ...prev, payoutSchedule: e.target.value }))} placeholder="e.g. Monthly" className="h-8 text-sm max-w-xs" />
                </div>
              </div>
            </Section>
          )}

          {activeSection === "tiers" && (
            <>
              <Section>
                <SectionHeader icon={Stack} title="Commission Tiers" description="Override flat rates with structured tiers" />
                <SettingRow label="Enable Tiered Commission" description="Define tier-based rates, caps, and bonuses">
                  <Switch checked={tiersEnabled} onCheckedChange={(checked) => checked ? enableTiers() : disableTiers()} />
                </SettingRow>

                {!tiersEnabled && (
                  <div className="px-5 pb-4">
                    <div className="flex gap-2.5 p-3 rounded-lg bg-muted/40">
                      <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">All agents use their <span className="font-medium text-foreground">basic commission rate</span> — the flat percentage set when adding each agent.</p>
                    </div>
                  </div>
                )}
                <div className="h-1" />
              </Section>

              {tiersEnabled && (
                <Section>
                  <SectionHeader
                    icon={CurrencyDollar}
                    title="Tier Configuration"
                    description="Define each tier's rates and limits"
                    action={config.tiers.length < 3 ? <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={addTier}><Plus className="h-3.5 w-3.5" />Add Tier</Button> : undefined}
                  />
                  <div className="px-5 pb-5 space-y-4">
                    {config.tiers.map((tier, index) => (
                      <div key={index} className="rounded-lg border p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold">Tier {tier.tier}</h4>
                          {config.tiers.length > 1 && (
                            <Button variant="ghost" size="sm" onClick={() => removeTier(index)} className="text-destructive hover:text-destructive h-8 w-8 p-0">
                              <Trash className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Tier Name</Label>
                            <Input value={tier.name} onChange={(e) => updateTier(index, { name: e.target.value })} className="h-8 text-sm" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Commission Type</Label>
                            <Select value={tier.commissionType} onValueChange={(val) => updateTier(index, { commissionType: val as CommissionType })}>
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue>{(value) => {
                                  const labels: Record<string, string> = { fixed: "Fixed Amount", higher_of: "% or Fixed (higher)", percentage: "Percentage" }
                                  return labels[value as string] ?? value
                                }}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="fixed">Fixed Amount</SelectItem>
                                <SelectItem value="higher_of">% or Fixed (whichever is higher)</SelectItem>
                                <SelectItem value="percentage">Percentage</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {(tier.commissionType === "fixed" || tier.commissionType === "higher_of") && (
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Flat Amount (₱)</Label>
                              <Input type="number" min="0" value={tier.flatAmount} onChange={(e) => updateTier(index, { flatAmount: parseFloat(e.target.value) || 0 })} className="h-8 text-sm" />
                            </div>
                          )}
                          {(tier.commissionType === "percentage" || tier.commissionType === "higher_of") && (
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Percentage Rate (%)</Label>
                              <Input type="number" min="0" max="100" step="0.5" value={tier.percentageRate} onChange={(e) => updateTier(index, { percentageRate: parseFloat(e.target.value) || 0 })} className="h-8 text-sm" />
                            </div>
                          )}
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Portfolio Cap (max loans)</Label>
                            <Input type="number" min="1" value={tier.portfolioCap} onChange={(e) => updateTier(index, { portfolioCap: parseInt(e.target.value) || 1 })} className="h-8 text-sm" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Origination Bonus (₱)</Label>
                            <Input type="number" min="0" value={tier.originationBonus} onChange={(e) => updateTier(index, { originationBonus: parseFloat(e.target.value) || 0 })} className="h-8 text-sm" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Qualifying Payments for Bonus</Label>
                            <Input type="number" min="0" value={tier.originationQualifyingPayments} onChange={(e) => updateTier(index, { originationQualifyingPayments: parseInt(e.target.value) || 0 })} className="h-8 text-sm" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}

          {activeSection === "promotion" && tiersEnabled && (
            <>
              <Section>
                <SectionHeader icon={TrendUp} title="Promotion Criteria" description="Requirements for tier advancement" />
                <div className="px-5 pb-5">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Min Months Active</Label>
                      <Input type="number" min="1" value={config.promotionCriteria.months} onChange={(e) => setConfig((prev) => ({ ...prev, promotionCriteria: { ...prev.promotionCriteria, months: parseInt(e.target.value) || 1 } }))} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Min Collections</Label>
                      <Input type="number" min="1" value={config.promotionCriteria.minCollections} onChange={(e) => setConfig((prev) => ({ ...prev, promotionCriteria: { ...prev.promotionCriteria, minCollections: parseInt(e.target.value) || 1 } }))} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Min On-Time Rate (%)</Label>
                      <Input type="number" min="0" max="100" value={config.promotionCriteria.minOnTimeRate} onChange={(e) => setConfig((prev) => ({ ...prev, promotionCriteria: { ...prev.promotionCriteria, minOnTimeRate: parseFloat(e.target.value) || 0 } }))} className="h-8 text-sm" />
                    </div>
                  </div>
                </div>
              </Section>

              <Section>
                <SectionHeader icon={TrendUp} title="Demotion Rules" description="Conditions for tier demotion" />
                <div className="px-5 pb-5">
                  <Textarea
                    rows={3}
                    value={config.demotionRules}
                    onChange={(e) => setConfig((prev) => ({ ...prev, demotionRules: e.target.value }))}
                    placeholder="e.g. On-time collection rate drops below 70% for 2 consecutive months..."
                    className="text-sm"
                  />
                </div>
              </Section>
            </>
          )}

          {/* Mobile save */}
          <div className="flex justify-end gap-3 pt-2 lg:hidden">
            <Link to="/agents" className={buttonVariants({ variant: "outline" })}>Cancel</Link>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <><Spinner className="h-4 w-4 animate-spin" />Saving...</> : "Save Settings"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
