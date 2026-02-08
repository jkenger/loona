import { createFileRoute, useRouter, Link } from '@tanstack/react-router'
import {
  getAgents,
  createAgent,
  updateAgent,
  payCommission,
  resetAgentPassword,
} from '@/server/agents'
import { getCommissionSettings } from '@/server/commission-settings'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  UsersThree,
  Plus,
  Spinner,
  CurrencyCircleDollar,
  User,
  Copy,
  Check,
  Warning,
  Envelope,
  NotePencil,
  Key,
  CalendarBlank,
  X,
} from '@phosphor-icons/react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CommissionProgramConfig } from '@/lib/constants/commission-defaults'
import { commissionTypeLabel } from '@/lib/constants/commission-defaults'
import { Switch } from '@/components/ui/switch'
import { SkeletonTablePage } from '@/components/ui/skeleton'
import { AccessDenied } from '@/components/access-denied'
import { hasRole, ROLES } from '@/lib/constants/roles'
import { PageHeader, PageContent } from '@/components/ui/page-header'
import { format } from 'date-fns'

export const Route = createFileRoute('/_dashboard/agents/')({
  loader: async ({ context }) => {
    const { session } = context as {
      session: { user: { role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      return {
        agents: [],
        commissionConfig: null as CommissionProgramConfig | null,
        unauthorized: true,
      }
    }
    const [agents, commissionConfig] = await Promise.all([
      getAgents(),
      getCommissionSettings(),
    ])
    return { agents, commissionConfig, unauthorized: false }
  },
  pendingComponent: SkeletonTablePage,
  component: AgentsPage,
})

type CreatedAgent = {
  agentEmail: string
  agentName: string
  generatedPassword: string | null
  isNewUser: boolean
}

type Agent = Awaited<ReturnType<typeof getAgents>>[number]

function AgentsPage() {
  const router = useRouter()
  const { agents, commissionConfig, unauthorized } = Route.useLoaderData()

  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdAgent, setCreatedAgent] = useState<CreatedAgent | null>(null)
  const [copied, setCopied] = useState(false)
  const [payingCommission, setPayingCommission] = useState(false)
  const [agentToPayCommission, setAgentToPayCommission] =
    useState<Agent | null>(null)

  // Reset password state
  const [resetPasswordAgent, setResetPasswordAgent] = useState<Agent | null>(
    null,
  )
  const [resettingPassword, setResettingPassword] = useState(false)
  const [newPassword, setNewPassword] = useState<{
    name: string
    email: string
    password: string
  } | null>(null)
  const [passwordCopied, setPasswordCopied] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [commissionRate, setCommissionRate] = useState('5')

  if (unauthorized) {
    return (
      <AccessDenied
        message="Only lenders can access the agents management page."
        homeLink="/dashboard"
        homeLinkLabel="Go to Dashboard"
      />
    )
  }

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await createAgent({
        data: {
          name,
          email,
          commissionRate: parseFloat(commissionRate),
        },
      })

      setShowAddDialog(false)
      setName('')
      setEmail('')
      setCommissionRate('5')

      if (result.isNewUser && result.generatedPassword) {
        setCreatedAgent({
          agentEmail: result.agentEmail,
          agentName: result.agentName,
          generatedPassword: result.generatedPassword,
          isNewUser: result.isNewUser,
        })
        toast.success('Agent added - credentials shown below')
      } else {
        toast.success('Agent added successfully')
      }

      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add agent')
      setError(err instanceof Error ? err.message : 'Failed to add agent')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyCredentials = () => {
    if (createdAgent?.generatedPassword) {
      const text = `Email: ${createdAgent.agentEmail}\nPassword: ${createdAgent.generatedPassword}`
      navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Credentials copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handlePayCommission = async () => {
    if (!agentToPayCommission) return
    setPayingCommission(true)
    try {
      await payCommission({ data: agentToPayCommission.id })
      toast.success('Commission paid successfully')
      setAgentToPayCommission(null)
      router.invalidate()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to pay commission',
      )
    } finally {
      setPayingCommission(false)
    }
  }

  const handleToggleStatus = async (agent: Agent) => {
    const newStatus = agent.status === 'active' ? 'suspended' : 'active'
    try {
      await updateAgent({
        data: {
          id: agent.id,
          status: newStatus,
        },
      })
      toast.success(
        `Agent ${newStatus === 'active' ? 'activated' : 'suspended'}`,
      )
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update agent')
    }
  }

  const handleToggleLoanCreation = async (
    agentId: string,
    canCreateLoans: boolean,
  ) => {
    try {
      await updateAgent({ data: { id: agentId, canCreateLoans } })
      toast.success(
        canCreateLoans ? 'Loan creation enabled' : 'Loan creation disabled',
      )
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update agent')
    }
  }

  const handleToggleRecordPayments = async (
    agentId: string,
    canRecordPayments: boolean,
  ) => {
    try {
      await updateAgent({ data: { id: agentId, canRecordPayments } })
      toast.success(
        canRecordPayments
          ? 'Payment recording enabled'
          : 'Payment recording disabled',
      )
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update agent')
    }
  }

  const handleChangeTier = async (agentId: string, tier: number | null) => {
    try {
      await updateAgent({ data: { id: agentId, tier } })
      toast.success(
        tier !== null
          ? `Tier updated to ${tier}`
          : 'Switched to basic commission',
      )
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update tier')
    }
  }

  const handleResetPassword = async () => {
    if (!resetPasswordAgent) return
    setResettingPassword(true)
    try {
      const result = await resetAgentPassword({ data: resetPasswordAgent.id })
      setResetPasswordAgent(null)
      setNewPassword({
        name: result.agentName,
        email: result.agentEmail,
        password: result.newPassword,
      })
      toast.success('Password reset successfully')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to reset password',
      )
    } finally {
      setResettingPassword(false)
    }
  }

  const handleCopyNewPassword = () => {
    if (newPassword) {
      const text = `Email: ${newPassword.email}\nNew Password: ${newPassword.password}`
      navigator.clipboard.writeText(text)
      setPasswordCopied(true)
      toast.success('Credentials copied to clipboard')
      setTimeout(() => setPasswordCopied(false), 2000)
    }
  }

  // Keep selectedAgent in sync with latest data after invalidation
  const currentSelected = selectedAgent
    ? (agents.find((a) => a.id === selectedAgent.id) ?? null)
    : null

  const selectedTierConfig =
    currentSelected && currentSelected.tier !== null && commissionConfig
      ? commissionConfig.tiers.find((t) => t.tier === currentSelected.tier)
      : null

  return (
    <div>
      <PageHeader
        badge="Lender Portal"
        section="Agents"
        title="Agents"
        subtitle="Manage your collection agents"
        actions={
          <Button className="gap-2" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4" weight="bold" />
            Add Agent
          </Button>
        }
      />
      <PageContent>
        {agents.length > 0 ? (
          <div
            className={`grid gap-6 items-start transition-[grid-template-columns] duration-200 ease-in-out ${currentSelected ? 'grid-cols-1 lg:grid-cols-[1fr_380px]' : 'grid-cols-1'}`}
          >
            {/* Agent Table */}
            <div className="min-w-0">
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Name</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium hidden md:table-cell">
                          Tier
                        </th>
                        <th className="text-left p-3 font-medium hidden md:table-cell">
                          Loans
                        </th>
                        <th className="text-left p-3 font-medium hidden lg:table-cell">
                          Collected
                        </th>
                        <th className="text-left p-3 font-medium hidden lg:table-cell">
                          Pending
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {agents.map((agent) => {
                        const isSelected = currentSelected?.id === agent.id
                        const tierConfig = commissionConfig?.tiers.find(
                          (t) => t.tier === agent.tier,
                        )
                        return (
                          <tr
                            key={agent.id}
                            className={`border-b last:border-0 cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-primary/5 border-l-2 border-l-primary'
                                : 'hover:bg-muted/30'
                            }`}
                            onClick={() =>
                              setSelectedAgent(isSelected ? null : agent)
                            }
                          >
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                  <User className="h-4 w-4 text-primary" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium truncate">
                                    {agent.agentName}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {agent.agentEmail}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge
                                variant={
                                  agent.status === 'active'
                                    ? 'secondary'
                                    : agent.status === 'terminated'
                                      ? 'destructive'
                                      : 'outline'
                                }
                                className={
                                  agent.status === 'suspended'
                                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-600'
                                    : ''
                                }
                              >
                                {agent.status}
                              </Badge>
                            </td>
                            <td className="p-3 hidden md:table-cell">
                              {agent.tier === null ? (
                                <div>
                                  <p className="text-muted-foreground">Basic</p>
                                  <p className="text-xs text-muted-foreground/70">
                                    {agent.commissionRate}%
                                  </p>
                                </div>
                              ) : tierConfig ? (
                                <div>
                                  <p className="text-muted-foreground">
                                    Tier {tierConfig.tier} — {tierConfig.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground/70">
                                    {tierConfig.commissionType === 'fixed' &&
                                      `PHP ${tierConfig.flatAmount}`}
                                    {tierConfig.commissionType ===
                                      'percentage' &&
                                      `${tierConfig.percentageRate}%`}
                                    {tierConfig.commissionType ===
                                      'higher_of' &&
                                      `${tierConfig.percentageRate}% or PHP ${tierConfig.flatAmount}`}
                                  </p>
                                </div>
                              ) : (
                                <div>
                                  <p className="text-muted-foreground">
                                    Tier {agent.tier}
                                  </p>
                                  <p className="text-xs text-muted-foreground/70">
                                    {agent.commissionRate}%
                                  </p>
                                </div>
                              )}
                            </td>
                            <td className="p-3 hidden md:table-cell">
                              {agent.assignedLoansCount}
                            </td>
                            <td className="p-3 hidden lg:table-cell">
                              {formatCurrency(agent.totalCollected)}
                            </td>
                            <td className="p-3 hidden lg:table-cell">
                              <span
                                className={
                                  parseFloat(agent.pendingCommission) > 0
                                    ? 'text-primary font-medium'
                                    : ''
                                }
                              >
                                {formatCurrency(agent.pendingCommission)}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Side Panel */}
            {currentSelected && (
              <div>
                <Card className="lg:sticky lg:top-[72px] lg:max-h-[calc(100vh-104px)] overflow-y-auto">
                  <div className="p-5 space-y-5">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">
                            {currentSelected.agentName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {currentSelected.agentEmail}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            currentSelected.status === 'active'
                              ? 'secondary'
                              : currentSelected.status === 'terminated'
                                ? 'destructive'
                                : 'outline'
                          }
                          className={
                            currentSelected.status === 'suspended'
                              ? 'border-amber-500/30 bg-amber-500/10 text-amber-600'
                              : ''
                          }
                        >
                          {currentSelected.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setSelectedAgent(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {currentSelected.status === 'active' ? (
                      <>
                        {/* Commission */}
                        <div className="border-t pt-4 space-y-3">
                          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                            Commission
                          </p>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              Commission Rate
                            </span>
                            <span className="font-medium">
                              {currentSelected.commissionRate}%
                            </span>
                          </div>
                          {commissionConfig &&
                            commissionConfig.tiers.length > 0 && (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm">
                                    Use Tiered Commission
                                  </span>
                                  <Switch
                                    checked={currentSelected.tier !== null}
                                    onCheckedChange={(checked) =>
                                      handleChangeTier(
                                        currentSelected.id,
                                        checked ? 1 : null,
                                      )
                                    }
                                  />
                                </div>
                                {currentSelected.tier !== null && (
                                  <>
                                    <Select
                                      value={String(currentSelected.tier)}
                                      onValueChange={(val) =>
                                        val &&
                                        handleChangeTier(
                                          currentSelected.id,
                                          parseInt(val),
                                        )
                                      }
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue>
                                          {(value) => {
                                            const t = commissionConfig.tiers.find((t) => String(t.tier) === value)
                                            return t ? `Tier ${t.tier} — ${t.name}` : value
                                          }}
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        {commissionConfig.tiers.map((t) => (
                                          <SelectItem
                                            key={t.tier}
                                            value={String(t.tier)}
                                          >
                                            Tier {t.tier} — {t.name}
                                          </SelectItem>
                                        ))}
                                        <div className="border-t mt-1 pt-1 px-2 pb-1">
                                          <Link
                                            to="/agents/commission-settings"
                                            search={{ tab: 'tiers' }}
                                            className="flex items-center gap-1.5 text-xs text-primary hover:underline py-1.5"
                                          >
                                            <Plus className="h-3 w-3" />
                                            Add more tiers
                                          </Link>
                                        </div>
                                      </SelectContent>
                                    </Select>
                                    {selectedTierConfig && (
                                      <div className="text-sm space-y-1">
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">
                                            Commission Type
                                          </span>
                                          <span className="font-medium">
                                            {commissionTypeLabel(
                                              selectedTierConfig.commissionType,
                                            )}
                                          </span>
                                        </div>
                                        {selectedTierConfig.flatAmount > 0 && (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">
                                              Flat Amount
                                            </span>
                                            <span className="font-medium">
                                              {formatCurrency(
                                                selectedTierConfig.flatAmount,
                                              )}
                                            </span>
                                          </div>
                                        )}
                                        {selectedTierConfig.percentageRate >
                                          0 && (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">
                                              Percentage Rate
                                            </span>
                                            <span className="font-medium">
                                              {
                                                selectedTierConfig.percentageRate
                                              }
                                              %
                                            </span>
                                          </div>
                                        )}
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">
                                            Portfolio Cap
                                          </span>
                                          <span className="font-medium">
                                            {selectedTierConfig.portfolioCap}{' '}
                                            loans
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </>
                            )}
                          <Link
                            to="/agents/commission-settings"
                            search={{ tab: undefined }}
                            className="text-xs text-primary hover:underline"
                          >
                            Commission settings &rarr;
                          </Link>
                        </div>

                        {/* Performance */}
                        <div className="border-t pt-4 space-y-3">
                          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                            Performance
                          </p>
                          <div className="text-sm space-y-2">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Total Collected
                              </span>
                              <span className="font-medium">
                                {formatCurrency(currentSelected.totalCollected)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Commission Earned
                              </span>
                              <span className="font-medium">
                                {formatCurrency(
                                  currentSelected.totalCommissionEarned,
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Commission Paid
                              </span>
                              <span className="font-medium">
                                {formatCurrency(
                                  currentSelected.totalCommissionPaid,
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Pending Payout
                              </span>
                              <span
                                className={`font-medium ${parseFloat(currentSelected.pendingCommission) > 0 ? 'text-primary' : ''}`}
                              >
                                {formatCurrency(
                                  currentSelected.pendingCommission,
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Assigned Loans
                              </span>
                              <span className="font-medium">
                                {currentSelected.assignedLoansCount}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Permissions */}
                        <div className="border-t pt-4 space-y-3">
                          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                            Permissions
                          </p>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <CurrencyCircleDollar className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">Record Payments</span>
                              </div>
                              <Switch
                                checked={currentSelected.canRecordPayments}
                                onCheckedChange={(checked) =>
                                  handleToggleRecordPayments(
                                    currentSelected.id,
                                    checked,
                                  )
                                }
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <NotePencil className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">Create Loans</span>
                              </div>
                              <Switch
                                checked={currentSelected.canCreateLoans}
                                onCheckedChange={(checked) =>
                                  handleToggleLoanCreation(
                                    currentSelected.id,
                                    checked,
                                  )
                                }
                              />
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="border-t pt-4 space-y-3">
                          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                            Actions
                          </p>
                          <div className="space-y-2">
                            {parseFloat(currentSelected.pendingCommission) >
                              0 && (
                              <Button
                                className="w-full gap-2"
                                size="sm"
                                onClick={() =>
                                  setAgentToPayCommission(currentSelected)
                                }
                              >
                                <CurrencyCircleDollar className="h-4 w-4" />
                                Pay Commission
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              className="w-full gap-2"
                              size="sm"
                              onClick={() =>
                                setResetPasswordAgent(currentSelected)
                              }
                            >
                              <Key className="h-4 w-4" />
                              Reset Password
                            </Button>
                            <Button
                              variant="outline"
                              className="w-full"
                              size="sm"
                              onClick={() =>
                                handleToggleStatus(currentSelected)
                              }
                            >
                              Suspend Agent
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Suspended / Terminated banner */}
                        <div className="border-t pt-4">
                          <div
                            className={`rounded-lg p-3 flex gap-2.5 border ${currentSelected.status === 'suspended' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-destructive/10 border-destructive/20'}`}
                          >
                            <Warning
                              className={`h-4 w-4 shrink-0 mt-0.5 ${currentSelected.status === 'suspended' ? 'text-amber-600' : 'text-destructive'}`}
                            />
                            <div className="text-sm">
                              <p
                                className={`font-medium ${currentSelected.status === 'suspended' ? 'text-amber-600' : 'text-destructive'}`}
                              >
                                {currentSelected.status === 'suspended'
                                  ? 'Agent Suspended'
                                  : 'Agent Terminated'}
                              </p>
                              <p className="text-muted-foreground text-xs mt-0.5">
                                {currentSelected.status === 'suspended'
                                  ? 'This agent cannot collect payments or create loans while suspended.'
                                  : 'This agent has been terminated and no longer has access.'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Performance (read-only) */}
                        <div className="border-t pt-4 space-y-3">
                          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                            Performance
                          </p>
                          <div className="text-sm space-y-2">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Total Collected
                              </span>
                              <span className="font-medium">
                                {formatCurrency(currentSelected.totalCollected)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Pending Payout
                              </span>
                              <span
                                className={`font-medium ${parseFloat(currentSelected.pendingCommission) > 0 ? 'text-primary' : ''}`}
                              >
                                {formatCurrency(
                                  currentSelected.pendingCommission,
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="border-t pt-4 space-y-3">
                          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                            Actions
                          </p>
                          <div className="space-y-2">
                            {parseFloat(currentSelected.pendingCommission) >
                              0 && (
                              <Button
                                className="w-full gap-2"
                                size="sm"
                                onClick={() =>
                                  setAgentToPayCommission(currentSelected)
                                }
                              >
                                <CurrencyCircleDollar className="h-4 w-4" />
                                Pay Commission
                              </Button>
                            )}
                            {currentSelected.status === 'suspended' && (
                              <Button
                                className="w-full"
                                size="sm"
                                onClick={() =>
                                  handleToggleStatus(currentSelected)
                                }
                              >
                                Activate Agent
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              className="w-full gap-2"
                              size="sm"
                              onClick={() =>
                                setResetPasswordAgent(currentSelected)
                              }
                            >
                              <Key className="h-4 w-4" />
                              Reset Password
                            </Button>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Footer */}
                    <div className="border-t pt-4">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarBlank className="h-3.5 w-3.5" />
                        Joined{' '}
                        {format(
                          new Date(currentSelected.createdAt),
                          'MMMM d, yyyy',
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 md:py-12">
              <UsersThree className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-1">No agents yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Add agents to help you manage loan collections
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Agent
              </Button>
            </CardContent>
          </Card>
        )}
      </PageContent>

      {/* Add Agent Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Agent</DialogTitle>
            <DialogDescription>
              Enter the agent's details. If they don't have an account, one will
              be created.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddAgent} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Agent's Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Juan dela Cruz"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Agent's Email</Label>
              <div className="relative">
                <Envelope className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="agent@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="commissionRate">Commission Rate</Label>
              <div className="relative">
                <Input
                  id="commissionRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  placeholder="5"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                  className="pr-12"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  %
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                This is the agent's default commission rate. You can switch to
                tiered commission later.
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner className="h-4 w-4 animate-spin mr-2" />
                    Adding...
                  </>
                ) : (
                  'Add Agent'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Credentials Display Dialog */}
      <Dialog
        open={!!createdAgent && !!createdAgent.generatedPassword}
        onOpenChange={(open) => {
          if (!open) {
            setCreatedAgent(null)
            setCopied(false)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Warning className="h-5 w-5 text-primary" />
              Agent Account Created
            </DialogTitle>
            <DialogDescription>
              Share these credentials with {createdAgent?.agentName}. The
              password cannot be recovered later.
            </DialogDescription>
          </DialogHeader>
          {createdAgent && (
            <div className="bg-muted rounded-lg p-4 font-mono text-sm space-y-2">
              <div>
                <span className="text-muted-foreground">Email: </span>
                <span className="font-semibold">{createdAgent.agentEmail}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Password: </span>
                <span className="font-semibold">
                  {createdAgent.generatedPassword}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleCopyCredentials} className="gap-2">
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Credentials
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCreatedAgent(null)
                setCopied(false)
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Commission Confirmation Dialog */}
      <Dialog
        open={!!agentToPayCommission}
        onOpenChange={(open) => !open && setAgentToPayCommission(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Commission Payment</DialogTitle>
            <DialogDescription>
              Review the commission details before proceeding with payment.
            </DialogDescription>
          </DialogHeader>
          {agentToPayCommission && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 p-3 rounded bg-secondary">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">
                    {agentToPayCommission.agentName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {agentToPayCommission.agentEmail}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Commission Rate</span>
                  <span className="font-medium">
                    {agentToPayCommission.commissionRate}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Collected</span>
                  <span className="font-medium">
                    {formatCurrency(agentToPayCommission.totalCollected)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-semibold">Amount to Pay</span>
                  <span className="font-bold text-lg text-primary">
                    {formatCurrency(agentToPayCommission.pendingCommission)}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAgentToPayCommission(null)}
              disabled={payingCommission}
            >
              Cancel
            </Button>
            <Button onClick={handlePayCommission} disabled={payingCommission}>
              {payingCommission ? (
                <>
                  <Spinner className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <CurrencyCircleDollar className="h-4 w-4 mr-2" />
                  Confirm Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Confirmation Dialog */}
      <Dialog
        open={!!resetPasswordAgent}
        onOpenChange={(open) => !open && setResetPasswordAgent(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Agent Password</DialogTitle>
            <DialogDescription>
              This will generate a new password for the agent. You will need to
              share the new credentials with them.
            </DialogDescription>
          </DialogHeader>
          {resetPasswordAgent && (
            <div className="flex items-center gap-3 p-3 rounded bg-secondary">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{resetPasswordAgent.agentName}</p>
                <p className="text-sm text-muted-foreground">
                  {resetPasswordAgent.agentEmail}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetPasswordAgent(null)}
              disabled={resettingPassword}
            >
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={resettingPassword}>
              {resettingPassword ? (
                <>
                  <Spinner className="h-4 w-4 animate-spin mr-2" />
                  Resetting...
                </>
              ) : (
                <>
                  <Key className="h-4 w-4 mr-2" />
                  Reset Password
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Password Display Dialog */}
      <Dialog
        open={!!newPassword}
        onOpenChange={(open) => {
          if (!open) {
            setNewPassword(null)
            setPasswordCopied(false)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Warning className="h-5 w-5 text-primary" />
              Password Reset Complete
            </DialogTitle>
            <DialogDescription>
              Share these credentials with {newPassword?.name}. The password
              cannot be recovered later.
            </DialogDescription>
          </DialogHeader>
          {newPassword && (
            <div className="bg-muted rounded-lg p-4 font-mono text-sm space-y-2">
              <div>
                <span className="text-muted-foreground">Email: </span>
                <span className="font-semibold">{newPassword.email}</span>
              </div>
              <div>
                <span className="text-muted-foreground">New Password: </span>
                <span className="font-semibold">{newPassword.password}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleCopyNewPassword} className="gap-2">
              {passwordCopied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Credentials
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setNewPassword(null)
                setPasswordCopied(false)
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}
