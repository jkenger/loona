import { createFileRoute, useRouter } from "@tanstack/react-router"
import { getAgents, createAgent, updateAgent, payCommission } from "@/server/agents"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  UsersThree,
  Plus,
  Spinner,
  CurrencyCircleDollar,
  X,
  User,
  Copy,
  Check,
  Warning,
  Envelope,
  Percent,
} from "@phosphor-icons/react"
import { Skeleton } from "@/components/ui/skeleton"
import { AccessDenied } from "@/components/access-denied"
import { hasRole, ROLES } from "@/lib/constants/roles"

export const Route = createFileRoute("/_dashboard/agents/")({
  loader: async ({ context }) => {
    const { session } = context as { session: { user: { role: string | null } } }
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      return { agents: [], unauthorized: true }
    }
    const agents = await getAgents()
    return { agents, unauthorized: false }
  },
  pendingComponent: AgentsPageSkeleton,
  component: AgentsPage,
})

function AgentsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        ))}
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

function AgentsPage() {
  const router = useRouter()
  const { agents, unauthorized } = Route.useLoaderData()

  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [createdAgent, setCreatedAgent] = useState<CreatedAgent | null>(null)
  const [copied, setCopied] = useState(false)

  // Form state
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [commissionRate, setCommissionRate] = useState("5")

  if (unauthorized) {
    return (
      <AccessDenied
        message="Only lenders can access the agents management page."
        homeLink="/agent"
        homeLinkLabel="Go to Agent Portal"
      />
    )
  }

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await createAgent({
        data: {
          name,
          email,
          commissionRate: parseFloat(commissionRate),
        },
      })

      setShowAddForm(false)
      setName("")
      setEmail("")
      setCommissionRate("5")

      // Show credentials if new user was created
      if (result.isNewUser && result.generatedPassword) {
        setCreatedAgent({
          agentEmail: result.agentEmail,
          agentName: result.agentName,
          generatedPassword: result.generatedPassword,
          isNewUser: result.isNewUser,
        })
        toast.success("Agent added - credentials shown below")
      } else {
        toast.success("Agent added successfully")
      }

      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add agent")
      setError(err instanceof Error ? err.message : "Failed to add agent")
    } finally {
      setLoading(false)
    }
  }

  const handleCopyCredentials = () => {
    if (createdAgent?.generatedPassword) {
      const text = `Email: ${createdAgent.agentEmail}\nPassword: ${createdAgent.generatedPassword}`
      navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success("Credentials copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCloseCredentials = () => {
    setCreatedAgent(null)
    setCopied(false)
  }

  const handlePayCommission = async (agentId: string) => {
    try {
      await payCommission({ data: agentId })
      toast.success("Commission paid successfully")
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to pay commission")
    }
  }

  const handleToggleStatus = async (agentId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "suspended" : "active"
    try {
      await updateAgent({
        data: {
          id: agentId,
          status: newStatus,
        },
      })
      toast.success(`Agent ${newStatus === "active" ? "activated" : "suspended"}`)
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update agent")
    }
  }

  const statusColors: Record<string, string> = {
    active: "secondary",
    suspended: "outline",
    terminated: "destructive",
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Agents</h1>
          <p className="text-muted-foreground">Manage your collection agents</p>
        </div>
        <Button className="gap-2" onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4" weight="bold" />
          Add Agent
        </Button>
      </div>

      {/* Credentials Modal */}
      {createdAgent && createdAgent.generatedPassword && (
        <Card className="border-primary bg-primary/5">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Warning className="h-5 w-5 text-primary" />
                <CardTitle>Agent Account Created</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={handleCloseCredentials}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>
              Share these credentials with {createdAgent.agentName}. The password cannot be recovered later.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            <div className="bg-background rounded p-4 font-mono text-sm space-y-2">
              <div>
                <span className="text-muted-foreground">Email: </span>
                <span className="font-semibold">{createdAgent.agentEmail}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Password: </span>
                <span className="font-semibold">{createdAgent.generatedPassword}</span>
              </div>
            </div>
            <div className="flex gap-3">
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
              <Button variant="outline" onClick={handleCloseCredentials}>
                Done
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Agent Form */}
      {showAddForm && (
        <Card className="border-primary">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Add New Agent</CardTitle>
                <CardDescription>
                  Enter the agent's details. If they don't have an account, one will be created automatically.
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <form onSubmit={handleAddAgent} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
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
                <div className="space-y-2 sm:col-span-2">
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
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  </div>
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
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
                    "Add Agent"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Agents List */}
      {agents.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{agent.agentName}</CardTitle>
                      <CardDescription className="text-xs">
                        {agent.agentEmail}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={statusColors[agent.status] as any}>
                    {agent.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Commission Rate</p>
                    <p className="font-semibold">{agent.commissionRate}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Assigned Loans</p>
                    <p className="font-semibold">{agent.assignedLoansCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Collected</p>
                    <p className="font-semibold">{formatCurrency(agent.totalCollected)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Pending Payout</p>
                    <p className="font-semibold text-primary">
                      {formatCurrency(agent.pendingCommission)}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  {parseFloat(agent.pendingCommission) > 0 && (
                    <Button
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={() => handlePayCommission(agent.id)}
                    >
                      <CurrencyCircleDollar className="h-4 w-4" />
                      Pay Commission
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleStatus(agent.id, agent.status)}
                  >
                    {agent.status === "active" ? "Suspend" : "Activate"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 md:py-12">
            <UsersThree className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No agents yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Add agents to help you manage loan collections
            </p>
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Agent
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}
