import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { getPenaltySettings, savePenaltySettings } from "@/server/penalty-settings"
import { Button } from "@/components/ui/button"
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
  Warning,
  Gavel,
  Clock,
  ShieldCheck,
  Info,
} from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"
import type { PenaltyConfig } from "@/lib/constants/penalty-defaults"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_dashboard/settings/penalty-settings")({
  loader: async ({ context }) => {
    const { session } = context as { session: { user: { role: string | null } } }
    if (!hasRole(session.user.role, ROLES.LENDER)) return { config: null, unauthorized: true }
    const config = await getPenaltySettings()
    return { config, unauthorized: false }
  },
  pendingComponent: SkeletonFormPage,
  component: PenaltySettingsPage,
})

// ---- Reusable components (same design as settings/index.tsx) ----

function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border bg-card", className)}>{children}</div>
}

function SectionHeader({ icon: IconComp, title, description }: { icon: Icon; title: string; description?: string }) {
  return (
    <div className="flex items-center gap-3 px-5 pt-5 pb-4">
      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <IconComp className="h-4.5 w-4.5 text-muted-foreground" weight="bold" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
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

// ---- Main page ----

function PenaltySettingsPage() {
  const { config: initialConfig, unauthorized } = Route.useLoaderData()
  const router = useRouter()
  const [config, setConfig] = useState<PenaltyConfig>(initialConfig!)
  const [isSaving, setIsSaving] = useState(false)

  if (unauthorized || !initialConfig) {
    return <AccessDenied message="Only lenders can manage penalty settings." homeLink="/agent" homeLinkLabel="Go to Agent Portal" />
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await savePenaltySettings({ data: config })
      toast.success("Penalty settings saved")
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  const update = (partial: Partial<PenaltyConfig>) => setConfig((prev) => ({ ...prev, ...partial }))

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link to="/settings" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-3.5 w-3.5" />
          Settings
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Penalty Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure late fees and penalty interest for overdue payments.</p>
      </div>

      {/* Master Toggle */}
      <Section>
        <SectionHeader icon={Warning} title="Penalty System" description="Generate penalty suggestions for overdue payments" />
        <SettingRow label="Enable Penalties" description={config.enabled ? "Active — overdue payments generate suggestions" : "Disabled — no fees will be suggested"}>
          <Switch checked={config.enabled} onCheckedChange={(enabled) => update({ enabled })} />
        </SettingRow>

        {config.enabled && (
          <div className="px-5 pb-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Grace Period (days)</Label>
              <Input type="number" min="0" max="90" value={config.gracePeriodDays} onChange={(e) => update({ gracePeriodDays: parseInt(e.target.value) || 0 })} className="h-8 w-32 text-sm" />
              <p className="text-[11px] text-muted-foreground">Days after due date before penalties apply</p>
            </div>
          </div>
        )}
      </Section>

      {config.enabled && (
        <>
          {/* Late Fee */}
          <Section>
            <SectionHeader icon={Gavel} title="Late Fee" description="One-time fee when a payment becomes overdue" />
            <SettingRow label="Enable Late Fee">
              <Switch checked={config.lateFee.enabled} onCheckedChange={(enabled) => update({ lateFee: { ...config.lateFee, enabled } })} />
            </SettingRow>

            {config.lateFee.enabled && (
              <div className="px-5 pb-4 pt-1">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Fee Type</Label>
                    <Select value={config.lateFee.type} onValueChange={(type) => { if (type) update({ lateFee: { ...config.lateFee, type: type as "fixed" | "percentage" } }) }}>
                      <SelectTrigger className="h-8 text-sm">{config.lateFee.type === "fixed" ? "Fixed Amount" : "Percentage"}</SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                        <SelectItem value="percentage">Percentage of Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{config.lateFee.type === "fixed" ? "Amount (₱)" : "Percentage (%)"}</Label>
                    <Input type="number" min="0" step={config.lateFee.type === "fixed" ? "1" : "0.1"} value={config.lateFee.amount} onChange={(e) => update({ lateFee: { ...config.lateFee, amount: parseFloat(e.target.value) || 0 } })} className="h-8 text-sm" />
                  </div>
                </div>
              </div>
            )}
          </Section>

          {/* Daily Penalty Interest */}
          <Section>
            <SectionHeader icon={Clock} title="Daily Penalty Interest" description="Interest accruing daily on the overdue amount" />
            <SettingRow label="Enable Daily Interest">
              <Switch checked={config.dailyPenaltyInterest.enabled} onCheckedChange={(enabled) => update({ dailyPenaltyInterest: { ...config.dailyPenaltyInterest, enabled } })} />
            </SettingRow>

            {config.dailyPenaltyInterest.enabled && (
              <div className="px-5 pb-4 pt-1 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Rate Per Day (%)</Label>
                  <Input type="number" min="0" max="10" step="0.01" value={config.dailyPenaltyInterest.ratePerDay} onChange={(e) => update({ dailyPenaltyInterest: { ...config.dailyPenaltyInterest, ratePerDay: parseFloat(e.target.value) || 0 } })} className="h-8 w-32 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Maximum Days</Label>
                  <Input type="number" min="1" max="365" value={config.dailyPenaltyInterest.maxDays} onChange={(e) => update({ dailyPenaltyInterest: { ...config.dailyPenaltyInterest, maxDays: parseInt(e.target.value) || 1 } })} className="h-8 w-32 text-sm" />
                  <p className="text-[11px] text-muted-foreground">Maximum days interest can accrue</p>
                </div>
              </div>
            )}
          </Section>

          {/* Penalty Cap */}
          <Section>
            <SectionHeader icon={ShieldCheck} title="Penalty Cap" description="Maximum total penalties per loan" />
            <div className="px-5 pb-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Cap Type</Label>
                  <Select value={config.penaltyCap.type} onValueChange={(type) => { if (type) update({ penaltyCap: { ...config.penaltyCap, type: type as "fixed" | "percentage" } }) }}>
                    <SelectTrigger className="h-8 text-sm">{config.penaltyCap.type === "fixed" ? "Fixed Amount" : "% of Principal"}</SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage of Principal</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{config.penaltyCap.type === "fixed" ? "Max Amount (₱)" : "Max Percentage (%)"}</Label>
                  <Input type="number" min="0" value={config.penaltyCap.amount} onChange={(e) => update({ penaltyCap: { ...config.penaltyCap, amount: parseFloat(e.target.value) || 0 } })} className="h-8 text-sm" />
                </div>
              </div>
            </div>

            <SettingRow label="Commission on Penalties" description="Agent commissions apply to penalty collections">
              <Switch checked={config.commissionOnPenalties} onCheckedChange={(commissionOnPenalties) => update({ commissionOnPenalties })} />
            </SettingRow>
            <div className="h-1" />
          </Section>

          {/* Info Box */}
          <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 p-4">
            <div className="flex items-start gap-3">
              <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-medium text-foreground text-xs">How penalties work</p>
                <p className="text-xs">Penalties appear in the <strong className="text-foreground">Disclosure Statement</strong>, <strong className="text-foreground">Loan Detail Page</strong>, and <strong className="text-foreground">Dashboard</strong>. They are generated automatically but nothing is charged until you manually apply.</p>
                <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2 text-[11px] text-amber-700 dark:text-amber-400">
                  Amounts shown are <strong>monthly equivalents</strong>. For non-monthly loans, penalties are automatically scaled per installment.
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Save */}
      <div className="flex justify-end pb-4">
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? <><Spinner className="h-4 w-4 animate-spin" />Saving...</> : "Save Settings"}
        </Button>
      </div>
    </div>
  )
}
