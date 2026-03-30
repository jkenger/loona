import { createFileRoute, useRouter, Link } from '@tanstack/react-router'
import { useState } from 'react'
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
  Key,
  CalendarBlank,
  GearSix,
  ChartBar,
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

  const formatDate = (iso: string | null) => {
    if (!iso) return "Never"
    const d = new Date(iso)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 0) return "Today"
    if (diff === 1) return "Yesterday"
    if (diff < 7) return `${diff}d ago`
    return format(d, "MMM d")
  }

  return (
    <Stagger className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <StaggerItem>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
            <p className="text-muted-foreground">Manage your collection agents and track performance</p>
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
      </StaggerItem>

      {/* KPI Cards */}
      <StaggerItem>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border shadow-sm p-5 relative">
            <div className="absolute top-4 right-4 h-9 w-9 rounded-lg bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center">
              <UsersThree className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" weight="bold" />
            </div>
            <p className="text-xs text-muted-foreground font-medium">Active Agents</p>
            <p className="text-2xl font-bold mt-1">{activeAgents.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">of {agents.length} total</p>
          </div>
          <div className="rounded-xl border shadow-sm p-5 relative">
            <div className="absolute top-4 right-4 h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center">
              <CurrencyCircleDollar className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" weight="bold" />
            </div>
            <p className="text-xs text-muted-foreground font-medium">Total Collected</p>
            <p className="text-2xl font-bold mt-1 text-primary">{formatCurrency(totalCollected)}</p>
          </div>
          <div className="rounded-xl border shadow-sm p-5 relative">
            <div className="absolute top-4 right-4 h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
              <Warning className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" weight="bold" />
            </div>
            <p className="text-xs text-muted-foreground font-medium">Pending Payouts</p>
            <p className={cn("text-2xl font-bold mt-1", totalPendingPayouts > 0 ? "text-amber-600 dark:text-amber-400" : "")}>
              {formatCurrency(totalPendingPayouts)}
            </p>
            {agentsWithPayouts.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">{agentsWithPayouts.length} agent{agentsWithPayouts.length > 1 ? "s" : ""}</p>
            )}
          </div>
          <div className="rounded-xl border shadow-sm p-5 relative">
            <div className="absolute top-4 right-4 h-9 w-9 rounded-lg bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
              <ChartBar className="h-4.5 w-4.5 text-green-600 dark:text-green-400" weight="bold" />
            </div>
            <p className="text-xs text-muted-foreground font-medium">Avg Collection Rate</p>
            {(() => {
              const rates = agents.filter(a => a.collectionRate > 0).map(a => a.collectionRate)
              const avg = rates.length > 0 ? Math.round(rates.reduce((s, r) => s + r, 0) / rates.length) : 0
              return <p className={cn("text-2xl font-bold mt-1", avg >= 80 ? "text-green-600 dark:text-green-400" : avg >= 50 ? "text-amber-600 dark:text-amber-400" : "text-destructive")}>{avg}%</p>
            })()}
          </div>
        </div>
      </StaggerItem>

      {/* Agent Cards */}
      <StaggerItem>
        {agents.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => {
              const isSelected = currentSelected?.id === agent.id
              const rateColor = agent.collectionRate >= 80 ? "text-green-600 dark:text-green-400" : agent.collectionRate >= 50 ? "text-amber-600 dark:text-amber-400" : "text-destructive"
              const rateBg = agent.collectionRate >= 80 ? "#16a34a" : agent.collectionRate >= 50 ? "#f59e0b" : "#dc2626"
              return (
                <div
                  key={agent.id}
                  className={cn(
                    "rounded-xl border shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md",
                    isSelected && "ring-2 ring-primary"
                  )}
                  onClick={() => setSelectedAgent(isSelected ? null : agent)}
                >
                  {/* Card Header */}
                  <div className="p-4 pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-sm font-semibold text-primary">{agent.agentName.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{agent.agentName}</p>
                          <p className="text-xs text-muted-foreground truncate">{agent.agentEmail}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant={agent.status === "active" ? "secondary" : agent.status === "terminated" ? "destructive" : "outline"}
                          className={cn("text-[10px]", agent.status === "suspended" && "border-amber-500/30 bg-amber-500/10 text-amber-600")}
                        >
                          {agent.status}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={(props) => (
                              <button {...props} onClick={(e) => e.stopPropagation()} className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                <DotsThreeVertical className="h-4 w-4" weight="bold" />
                              </button>
                            )}
                          />
                          <DropdownMenuContent align="end" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => setResetPasswordAgent(agent)}>
                              <Key className="h-4 w-4" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleStatus(agent)}>
                              <Prohibit className="h-4 w-4" />
                              {agent.status === "active" ? "Suspend" : "Activate"}
                            </DropdownMenuItem>
                            {parseFloat(agent.pendingCommission) > 0 && (
                              <DropdownMenuItem onClick={() => setAgentToPayCommission(agent)}>
                                <CurrencyCircleDollar className="h-4 w-4" />
                                Pay Commission
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Tier + permissions pills */}
                    <div className="flex items-center gap-1.5 mt-2.5">
                      {agent.tier !== null ? (
                        <span className="text-[10px] font-medium rounded-full bg-primary/10 text-primary px-2 py-0.5">Tier {agent.tier}</span>
                      ) : (
                        <span className="text-[10px] font-medium rounded-full bg-muted text-muted-foreground px-2 py-0.5">{agent.commissionRate}%</span>
                      )}
                      {agent.canRecordPayments && (
                        <span className="text-[10px] rounded-full bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 px-2 py-0.5">Payments</span>
                      )}
                      {agent.canCreateLoans && (
                        <span className="text-[10px] rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 px-2 py-0.5">Loans</span>
                      )}
                    </div>
                  </div>

                  {/* Collection rate bar */}
                  <div className="px-4 pb-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Collection Rate</span>
                      <span className={cn("font-bold", rateColor)}>{agent.collectionRate}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(agent.collectionRate, 100)}%`, background: rateBg }} />
                    </div>
                  </div>

                  {/* Metrics grid */}
                  <div className="grid grid-cols-2 gap-px bg-border">
                    <div className="bg-card px-4 py-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Collected</p>
                      <p className="text-sm font-bold mt-0.5">{formatCurrency(agent.totalCollected)}</p>
                    </div>
                    <div className="bg-card px-4 py-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">This Month</p>
                      <p className="text-sm font-bold mt-0.5 text-primary">{formatCurrency(agent.thisMonthCollected)}</p>
                    </div>
                    <div className="bg-card px-4 py-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Loans</p>
                      <p className="text-sm font-bold mt-0.5">{agent.assignedLoansCount}</p>
                    </div>
                    <div className="bg-card px-4 py-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Overdue</p>
                      <p className={cn("text-sm font-bold mt-0.5", agent.overdueCount > 0 && "text-destructive")}>{agent.overdueCount}</p>
                    </div>
                    <div className="bg-card px-4 py-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">On-Time</p>
                      <p className={cn("text-sm font-bold mt-0.5", agent.onTimeRate >= 80 ? "text-green-600 dark:text-green-400" : agent.onTimeRate >= 50 ? "text-amber-600" : "text-destructive")}>{agent.onTimeRate}%</p>
                    </div>
                    <div className="bg-card px-4 py-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Contacts</p>
                      <p className="text-sm font-bold mt-0.5">{agent.contactsManaged}</p>
                    </div>
                  </div>

                  {/* Footer: last active + pending commission */}
                  <div className="px-4 py-3 border-t flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarBlank className="h-3 w-3" />
                      Active {formatDate(agent.lastActiveAt)}
                    </div>
                    {parseFloat(agent.pendingCommission) > 0 && (
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                        {formatCurrency(agent.pendingCommission)} pending
                      </span>
                    )}
                  </div>

                  {/* Expandable detail panel */}
                  <AnimatePresence>
                    {isSelected && currentSelected && (
                      <motion.div
                        key={`detail-${agent.id}`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 bg-muted/30 border-t space-y-3" onClick={(e) => e.stopPropagation()}>
                          {/* Permissions */}
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Permissions</p>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Record Payments</span>
                              <Switch checked={currentSelected.canRecordPayments} onCheckedChange={(checked) => handleToggleRecordPayments(currentSelected.id, checked)} />
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Create Loans</span>
                              <Switch checked={currentSelected.canCreateLoans} onCheckedChange={(checked) => handleToggleLoanCreation(currentSelected.id, checked)} />
                            </div>
                          </div>
                          {commissionConfig && commissionConfig.tiers.length > 0 && (
                            <div className="pt-2 border-t space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm">Tiered Commission</span>
                                <Switch checked={currentSelected.tier !== null} onCheckedChange={(checked) => handleChangeTier(currentSelected.id, checked ? 1 : null)} />
                              </div>
                              {currentSelected.tier !== null && (
                                <Select value={String(currentSelected.tier)} onValueChange={(val) => val && handleChangeTier(currentSelected.id, parseInt(val))}>
                                  <SelectTrigger className="w-full h-8 text-sm">
                                    <SelectValue>{(value) => { const t = commissionConfig.tiers.find((t) => String(t.tier) === value); return t ? `Tier ${t.tier} — ${t.name}` : value }}</SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {commissionConfig.tiers.map((t) => (
                                      <SelectItem key={t.tier} value={String(t.tier)}>Tier {t.tier} — {t.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          )}
                          <div className="pt-2 border-t text-xs text-muted-foreground flex items-center gap-1.5">
                            <CalendarBlank className="h-3 w-3" />
                            Joined {format(new Date(currentSelected.createdAt), "MMMM d, yyyy")}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl border shadow-sm">
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
                <UsersThree className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No agents yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">Add agents to help you manage loan collections and track their performance.</p>
              <Button onClick={() => setShowAddDialog(true)} className="mt-4 gap-2">
                <Plus className="h-4 w-4" weight="bold" />
                Add Your First Agent
              </Button>
            </div>
          </div>
        )}
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
