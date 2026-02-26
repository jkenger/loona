import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import { getPenaltySettings, savePenaltySettings } from "@/server/penalty-settings"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
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
  Warning,
  Gavel,
  Clock,
  ShieldCheck,
  Info,
  FileText,
  CurrencyCircleDollar,
  ChartBar,
} from "@phosphor-icons/react"
import type { PenaltyConfig } from "@/lib/constants/penalty-defaults"

export const Route = createFileRoute("/_dashboard/settings/penalty-settings")({
  loader: async ({ context }) => {
    const { session } = context as {
      session: { user: { role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      return { config: null, unauthorized: true }
    }
    const config = await getPenaltySettings()
    return { config, unauthorized: false }
  },
  pendingComponent: SkeletonFormPage,
  component: PenaltySettingsPage,
})

function PenaltySettingsPage() {
  const { config: initialConfig, unauthorized } = Route.useLoaderData()
  const router = useRouter()
  const [config, setConfig] = useState<PenaltyConfig>(initialConfig!)
  const [isSaving, setIsSaving] = useState(false)

  if (unauthorized || !initialConfig) {
    return (
      <AccessDenied
        message="Only lenders can manage penalty settings."
        homeLink="/agent"
        homeLinkLabel="Go to Agent Portal"
      />
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await savePenaltySettings({ data: config })
      toast.success("Penalty settings saved")
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }

  const update = (partial: Partial<PenaltyConfig>) =>
    setConfig((prev) => ({ ...prev, ...partial }))

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
            <span>Penalty Rules</span>
            <span className="text-blue-300/40">·</span>
            <span>{format(new Date(), "EEEE, MMMM d, yyyy")}</span>
          </div>

          <div className="border-l-4 border-primary pl-4">
            <h1 className="text-4xl font-bold tracking-tight">Penalty Settings</h1>
            <p className="text-blue-200/70">
              Configure late fees and penalty interest for overdue payments
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-8 pb-8 space-y-6 relative">
        <div className="max-w-2xl space-y-6">
          {/* Master Toggle */}
          <Card className="shadow-lg">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2">
                <Warning className="h-5 w-5 text-destructive" />
                Penalty System
              </CardTitle>
              <CardDescription>
                When enabled, overdue payments will generate penalty suggestions that you can apply or waive
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex items-center justify-between p-3 rounded border bg-muted/30">
                <div>
                  <p className="font-medium">Enable Penalties</p>
                  <p className="text-sm text-muted-foreground">
                    {config.enabled
                      ? "Penalties are active — overdue payments will generate suggestions"
                      : "Penalties are disabled — no fees will be suggested"}
                  </p>
                </div>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(enabled) => update({ enabled })}
                />
              </div>

              {config.enabled && (
                <div className="space-y-2">
                  <Label>Grace Period (days)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="90"
                    value={config.gracePeriodDays}
                    onChange={(e) =>
                      update({ gracePeriodDays: parseInt(e.target.value) || 0 })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of days after the due date before any penalties apply
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {config.enabled && (
            <>
              {/* Late Fee */}
              <Card className="shadow-lg">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Gavel className="h-5 w-5 text-primary" />
                    Late Fee
                  </CardTitle>
                  <CardDescription>
                    One-time fee charged when a payment becomes overdue past the grace period
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Enable Late Fee</Label>
                    <Switch
                      checked={config.lateFee.enabled}
                      onCheckedChange={(enabled) =>
                        update({ lateFee: { ...config.lateFee, enabled } })
                      }
                    />
                  </div>

                  {config.lateFee.enabled && (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Fee Type</Label>
                          <Select
                            value={config.lateFee.type}
                            onValueChange={(type) => {
                              if (type) update({ lateFee: { ...config.lateFee, type: type as "fixed" | "percentage" } })
                            }}
                          >
                            <SelectTrigger>
                              {config.lateFee.type === "fixed" ? "Fixed Amount" : "Percentage"}
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed">Fixed Amount</SelectItem>
                              <SelectItem value="percentage">Percentage of Overdue</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>
                            {config.lateFee.type === "fixed" ? "Amount (₱)" : "Percentage (%)"}
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step={config.lateFee.type === "fixed" ? "1" : "0.1"}
                            value={config.lateFee.amount}
                            onChange={(e) =>
                              update({
                                lateFee: {
                                  ...config.lateFee,
                                  amount: parseFloat(e.target.value) || 0,
                                },
                              })
                            }
                          />
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Daily Penalty Interest */}
              <Card className="shadow-lg">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Daily Penalty Interest
                  </CardTitle>
                  <CardDescription>
                    Interest that accrues daily on the overdue amount
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Enable Daily Penalty Interest</Label>
                    <Switch
                      checked={config.dailyPenaltyInterest.enabled}
                      onCheckedChange={(enabled) =>
                        update({
                          dailyPenaltyInterest: { ...config.dailyPenaltyInterest, enabled },
                        })
                      }
                    />
                  </div>

                  {config.dailyPenaltyInterest.enabled && (
                    <>
                      <div className="space-y-2">
                        <Label>Rate Per Day (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="10"
                          step="0.01"
                          value={config.dailyPenaltyInterest.ratePerDay}
                          onChange={(e) =>
                            update({
                              dailyPenaltyInterest: {
                                ...config.dailyPenaltyInterest,
                                ratePerDay: parseFloat(e.target.value) || 0,
                              },
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Maximum Days</Label>
                        <Input
                          type="number"
                          min="1"
                          max="365"
                          value={config.dailyPenaltyInterest.maxDays}
                          onChange={(e) =>
                            update({
                              dailyPenaltyInterest: {
                                ...config.dailyPenaltyInterest,
                                maxDays: parseInt(e.target.value) || 1,
                              },
                            })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Maximum number of days daily interest can accrue
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Penalty Cap */}
              <Card className="shadow-lg">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Penalty Cap
                  </CardTitle>
                  <CardDescription>
                    Maximum total penalties that can be applied to a single loan
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Cap Type</Label>
                      <Select
                        value={config.penaltyCap.type}
                        onValueChange={(type) => {
                          if (type) update({ penaltyCap: { ...config.penaltyCap, type: type as "fixed" | "percentage" } })
                        }}
                      >
                        <SelectTrigger>
                          {config.penaltyCap.type === "fixed"
                            ? "Fixed Amount"
                            : "Percentage of Principal"}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage of Principal</SelectItem>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>
                        {config.penaltyCap.type === "fixed" ? "Max Amount (₱)" : "Max Percentage (%)"}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step={config.penaltyCap.type === "fixed" ? "1" : "1"}
                        value={config.penaltyCap.amount}
                        onChange={(e) =>
                          update({
                            penaltyCap: {
                              ...config.penaltyCap,
                              amount: parseFloat(e.target.value) || 0,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Commission on Penalties */}
              <Card className="shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Commission on Penalties</p>
                      <p className="text-sm text-muted-foreground">
                        Whether agent commissions apply to penalty collections
                      </p>
                    </div>
                    <Switch
                      checked={config.commissionOnPenalties}
                      onCheckedChange={(commissionOnPenalties) =>
                        update({ commissionOnPenalties })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Where penalties appear */}
          {config.enabled && (
            <Card className="shadow-lg border-blue-200 dark:border-blue-900">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                  <div className="space-y-3">
                    <p className="font-medium text-sm">Where these rules apply</p>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>
                          <span className="font-medium text-foreground">Disclosure Statement</span> — Late fee and penalty interest details will appear in rows 13–14 of every new disclosure you generate.
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CurrencyCircleDollar className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>
                          <span className="font-medium text-foreground">Loan Detail Page</span> — Overdue payments will show pending penalties with Apply/Waive buttons. Applied penalties add to the loan balance.
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <ChartBar className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>
                          <span className="font-medium text-foreground">Dashboard</span> — Pending penalties are generated automatically when you visit your dashboard. Nothing is charged until you manually apply it.
                        </span>
                      </div>
                    </div>
                    <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                      These amounts are <span className="font-medium">monthly equivalents</span>. For non-monthly loans (weekly, bi-weekly, daily), penalty amounts are automatically scaled down per installment so total exposure stays fair.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Save */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving ? (
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
  )
}
