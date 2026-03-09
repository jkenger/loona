import { createFileRoute, useRouter, Link } from '@tanstack/react-router'
import { useState, Fragment } from 'react'
import { format } from 'date-fns'
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
  CaretDown,
  GearSix,
  ChartBar,
  CheckCircle,
  DotsThreeVertical,
  Prohibit,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import type { CommissionProgramConfig } from '@/lib/constants/commission-defaults'

import { Button } from '@/components/ui/button'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'


import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { AccessDenied } from '@/components/access-denied'
import { hasRole, ROLES } from '@/lib/constants/roles'
import { Stagger, StaggerItem } from '@/components/ui/stagger'
import { cn } from '@/lib/utils'

import {
  getAgents,
  createAgent,
  updateAgent,
  payCommission,
  resetAgentPassword,
} from '@/server/agents'
import { getCommissionSettings } from '@/server/commission-settings'

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
  pendingComponent: AgentsPageSkeleton,
  component: AgentsPage,
})

function AgentsPageSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-4 w-52 mt-2" />
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-5">
          <div className="rounded-xl border shadow-sm p-5 space-y-4">
            <Skeleton className="h-5 w-36" />
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
          <div className="rounded-xl border shadow-sm p-5 space-y-3">
            <Skeleton className="h-5 w-32" />
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-xl border shadow-sm p-5 space-y-3">
            <Skeleton className="h-5 w-36" />
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

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

  // Computed stats
  const activeAgents = agents.filter((a) => a.status === 'active')
  const totalCollected = agents.reduce((sum, a) => sum + parseFloat(a.totalCollected), 0)
  const totalPendingPayouts = agents.reduce((sum, a) => sum + parseFloat(a.pendingCommission), 0)
  const agentsWithPayouts = agents.filter((a) => parseFloat(a.pendingCommission) > 0)

  return (
    <Stagger className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
          <p className="text-muted-foreground">Manage your collection agents</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/agents/commission-settings" search={{ tab: undefined }}>
            <Button variant="outline" size="icon" title="Commission Settings">
              <GearSix className="h-4 w-4" />
            </Button>
          </Link>
          <Button className="gap-2" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4" weight="bold" />
            Add Agent
          </Button>
        </div>
      </div>

      {/* Bento Grid */}
      <StaggerItem className="grid gap-5 lg:grid-cols-5">
        {/* Left Column */}
        <div className="lg:col-span-3 space-y-5">
          {/* Team Overview */}
          <div className="rounded-xl border shadow-sm">
            <div className="p-5 pb-3">
              <div className="flex items-center gap-2">
                <ChartBar className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-base font-semibold">Team Overview</h3>
              </div>
            </div>
            <div className="p-5 pt-0">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Active Agents</p>
                  <p className="text-lg font-bold">{activeAgents.length}</p>
                  <p className="text-xs text-muted-foreground">of {agents.length} total</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Collected</p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(totalCollected)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pending Payouts</p>
                  <p className={cn("text-lg font-bold", totalPendingPayouts > 0 && "text-amber-600")}>
                    {formatCurrency(totalPendingPayouts)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Agent Roster */}
          <div className="rounded-xl border shadow-sm">
            <div className="p-5 pb-3">
              <div className="flex items-center gap-2">
                <UsersThree className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-base font-semibold">Agent Roster</h3>
              </div>
            </div>
            <div className="p-5 pt-0">
              {agents.length > 0 ? (
                <div className="space-y-0">
                  {agents.map((agent) => {
                    const isSelected = currentSelected?.id === agent.id
                    const tierConfig = commissionConfig?.tiers.find(
                      (t) => t.tier === agent.tier,
                    )
                    return (
                      <Fragment key={agent.id}>
                        <div
                          className={cn(
                            "flex items-center gap-3 py-3 border-b last:border-0 -mx-5 px-5 cursor-pointer transition-colors",
                            isSelected ? "bg-primary/5" : "hover:bg-muted/50"
                          )}
                          onClick={() => setSelectedAgent(isSelected ? null : agent)}
                        >
                          <CaretDown
                            className={cn(
                              "h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0",
                              !isSelected && "-rotate-90"
                            )}
                          />
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{agent.agentName}</p>
                            <p className="text-xs text-muted-foreground truncate">{agent.agentEmail}</p>
                          </div>
                          <div className="hidden md:flex items-center gap-3 shrink-0">
                            {agent.tier === null ? (
                              <span className="text-xs text-muted-foreground">{agent.commissionRate}%</span>
                            ) : tierConfig ? (
                              <span className="text-xs text-muted-foreground">Tier {tierConfig.tier}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Tier {agent.tier}</span>
                            )}
                            <span className="text-xs text-muted-foreground">{agent.assignedLoansCount} loans</span>
                          </div>
                          <div className="hidden lg:block shrink-0 text-right min-w-[80px]">
                            <p className="text-sm font-semibold">{formatCurrency(agent.totalCollected)}</p>
                            {parseFloat(agent.pendingCommission) > 0 && (
                              <p className="text-xs text-primary">{formatCurrency(agent.pendingCommission)} pending</p>
                            )}
                          </div>
                          <Badge
                            variant={
                              agent.status === 'active'
                                ? 'secondary'
                                : agent.status === 'terminated'
                                  ? 'destructive'
                                  : 'outline'
                            }
                            className={cn(
                              "shrink-0 text-[10px]",
                              agent.status === 'suspended' && 'border-amber-500/30 bg-amber-500/10 text-amber-600'
                            )}
                          >
                            {agent.status}
                          </Badge>
                        </div>

                        {/* Expandable Detail Panel */}
                        <AnimatePresence>
                          {isSelected && currentSelected && (
                            <motion.div
                              key={`detail-${agent.id}`}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden -mx-5"
                            >
                              <div
                                className="p-5 bg-muted/30 border-b"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {currentSelected.status === 'active' ? (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Permissions & Tier */}
                                    <div className="space-y-3">
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

                                      {commissionConfig &&
                                        commissionConfig.tiers.length > 0 && (
                                          <div className="pt-3 border-t space-y-3">
                                            <div className="flex items-center justify-between">
                                              <span className="text-sm">
                                                Tiered Commission
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
                                                      const t =
                                                        commissionConfig.tiers.find(
                                                          (t) => String(t.tier) === value,
                                                        )
                                                      return t
                                                        ? `Tier ${t.tier} — ${t.name}`
                                                        : value
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
                                            )}
                                          </div>
                                        )}
                                    </div>

                                    {/* Payout & Actions */}
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                          Payout
                                        </p>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                              <DotsThreeVertical className="h-4 w-4" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                              onClick={() =>
                                                setResetPasswordAgent(currentSelected)
                                              }
                                            >
                                              <Key className="h-4 w-4 mr-2" />
                                              Reset Password
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              onClick={() =>
                                                handleToggleStatus(currentSelected)
                                              }
                                              className="text-destructive focus:text-destructive"
                                            >
                                              <Prohibit className="h-4 w-4 mr-2" />
                                              Suspend Agent
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>

                                      <div className="flex items-baseline justify-between">
                                        <span className="text-sm text-muted-foreground">
                                          Pending
                                        </span>
                                        <span
                                          className={cn(
                                            "text-lg font-semibold",
                                            parseFloat(currentSelected.pendingCommission) > 0 && 'text-primary'
                                          )}
                                        >
                                          {formatCurrency(currentSelected.pendingCommission)}
                                        </span>
                                      </div>

                                      {parseFloat(currentSelected.pendingCommission) > 0 && (
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

                                      <div className="pt-3 border-t flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                          <CalendarBlank className="h-3.5 w-3.5" />
                                          Joined{' '}
                                          {format(
                                            new Date(currentSelected.createdAt),
                                            'MMMM d, yyyy',
                                          )}
                                        </div>
                                        <Link
                                          to="/agents/commission-settings"
                                          search={{ tab: undefined }}
                                          className="text-xs text-primary hover:underline"
                                        >
                                          Commission settings &rarr;
                                        </Link>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-5">
                                    {/* Suspended / Terminated banner */}
                                    <div
                                      className={cn(
                                        "rounded-lg p-3 flex gap-2.5 border",
                                        currentSelected.status === 'suspended'
                                          ? 'bg-amber-500/10 border-amber-500/20'
                                          : 'bg-destructive/10 border-destructive/20'
                                      )}
                                    >
                                      <Warning
                                        className={cn(
                                          "h-4 w-4 shrink-0 mt-0.5",
                                          currentSelected.status === 'suspended'
                                            ? 'text-amber-600'
                                            : 'text-destructive'
                                        )}
                                      />
                                      <div className="text-sm">
                                        <p
                                          className={cn(
                                            "font-medium",
                                            currentSelected.status === 'suspended'
                                              ? 'text-amber-600'
                                              : 'text-destructive'
                                          )}
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

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      {/* Performance (read-only) */}
                                      <div className="space-y-3">
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
                                      <div className="space-y-3">
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

                                        <div className="pt-3 border-t">
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
                                    </div>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Fragment>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <UsersThree className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">No agents yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add agents to help you manage loan collections
                  </p>
                  <Button onClick={() => setShowAddDialog(true)} className="mt-4 gap-2">
                    <Plus className="h-4 w-4" />
                    Add Your First Agent
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Pending Payouts */}
          <div className={cn("rounded-xl border shadow-sm", agentsWithPayouts.length > 0 && "border-amber-300/50")}>
            <div className="p-5 pb-3">
              <div className="flex items-center gap-2">
                <CurrencyCircleDollar className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-base font-semibold">Pending Payouts</h3>
              </div>
            </div>
            <div className="p-5 pt-0">
              {agentsWithPayouts.length > 0 ? (
                <div className="space-y-0">
                  {agentsWithPayouts.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center gap-3 py-3 border-b last:border-0 hover:bg-muted/50 -mx-5 px-5 transition-colors"
                    >
                      <span className="h-2 w-2 rounded-full shrink-0 bg-amber-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{agent.agentName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(agent.totalCollected)} collected
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className="text-sm font-semibold text-amber-600">
                          {formatCurrency(agent.pendingCommission)}
                        </p>
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setAgentToPayCommission(agent)}
                        >
                          Pay
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm">All commissions paid!</p>
                </div>
              )}
            </div>
          </div>

          {/* Top Performers */}
          {agents.length > 0 && (
            <div className="rounded-xl border shadow-sm">
              <div className="p-5 pb-3">
                <div className="flex items-center gap-2">
                  <ChartBar className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-base font-semibold">Performance</h3>
                </div>
              </div>
              <div className="p-5 pt-0">
                <div className="space-y-0">
                  {[...agents]
                    .sort((a, b) => parseFloat(b.totalCollected) - parseFloat(a.totalCollected))
                    .slice(0, 5)
                    .map((agent, i) => {
                      const collected = parseFloat(agent.totalCollected)
                      const maxCollected = Math.max(...agents.map((a) => parseFloat(a.totalCollected)), 1)
                      const barWidth = (collected / maxCollected) * 100
                      return (
                        <div
                          key={agent.id}
                          className="py-3 border-b last:border-0 -mx-5 px-5"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                              <p className="text-sm font-medium truncate">{agent.agentName}</p>
                            </div>
                            <p className="text-sm font-semibold shrink-0 ml-2">{formatCurrency(collected)}</p>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden ml-6">
                            <div
                              className="h-full bg-primary/60 rounded-full transition-all duration-500"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            </div>
          )}
        </div>
      </StaggerItem>

      {/* Add Agent Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
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
    </Stagger>
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
