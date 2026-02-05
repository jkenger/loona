import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { PageHeader, PageContent } from "@/components/ui/page-header"
import { AccessDenied } from "@/components/access-denied"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { listUsers, adminBanUser, adminUnbanUser, adminSetRole } from "@/server/admin"
import {
  MagnifyingGlass,
  DotsThree,
  Prohibit,
  CheckCircle,
  UserGear,
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react"
import { format } from "date-fns"

export const Route = createFileRoute("/_dashboard/admin/users")({
  loader: async ({ context }) => {
    const { session } = context as {
      session: { user: { id: string; role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.ADMIN)) {
      return { data: null, unauthorized: true, currentUserId: "" }
    }
    const data = await listUsers({ data: { limit: 20, offset: 0 } })
    return { data, unauthorized: false, currentUserId: session.user.id }
  },
  component: UsersPage,
})

function UsersPage() {
  const { data: initialData, unauthorized, currentUserId } = Route.useLoaderData()
  const router = useRouter()

  const [users, setUsers] = useState(initialData?.users ?? [])
  const [total, setTotal] = useState(initialData?.total ?? 0)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [loading, setLoading] = useState(false)
  const limit = 20

  // Ban dialog state
  const [banDialogOpen, setBanDialogOpen] = useState(false)
  const [banTarget, setBanTarget] = useState<{ id: string; name: string } | null>(null)
  const [banReason, setBanReason] = useState("")

  // Role dialog state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [roleTarget, setRoleTarget] = useState<{
    id: string
    name: string
    role: string | null
  } | null>(null)
  const [selectedRoles, setSelectedRoles] = useState<Record<string, boolean>>({
    lender: false,
    agent: false,
    admin: false,
  })

  if (unauthorized) {
    return (
      <AccessDenied
        message="Only admins can access this page."
        homeLink="/dashboard"
        homeLinkLabel="Go to Dashboard"
      />
    )
  }

  const fetchUsers = async (newOffset: number, newSearch?: string, newRoleFilter?: string) => {
    setLoading(true)
    try {
      const result = await listUsers({
        data: {
          limit,
          offset: newOffset,
          search: newSearch ?? search,
          roleFilter: newRoleFilter ?? roleFilter,
        },
      })
      setUsers(result.users)
      setTotal(result.total)
      setOffset(newOffset)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    fetchUsers(0, search, roleFilter)
  }

  const handleRoleFilterChange = (value: string | null) => {
    if (!value) return
    const newFilter = value === "all" ? "" : value
    setRoleFilter(newFilter)
    fetchUsers(0, search, newFilter)
  }

  const handleBan = async () => {
    if (!banTarget) return
    await adminBanUser({ data: { userId: banTarget.id, banReason: banReason || undefined } })
    setBanDialogOpen(false)
    setBanTarget(null)
    setBanReason("")
    fetchUsers(offset)
    router.invalidate()
  }

  const handleUnban = async (userId: string) => {
    await adminUnbanUser({ data: { userId } })
    fetchUsers(offset)
    router.invalidate()
  }

  const openRoleDialog = (u: { id: string; name: string; role: string | null }) => {
    const roles = u.role?.split(",").map((r) => r.trim()) ?? []
    setSelectedRoles({
      lender: roles.includes("lender"),
      agent: roles.includes("agent"),
      admin: roles.includes("admin"),
    })
    setRoleTarget(u)
    setRoleDialogOpen(true)
  }

  const handleSetRole = async () => {
    if (!roleTarget) return
    const newRole = Object.entries(selectedRoles)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(",")
    if (!newRole) return
    await adminSetRole({ data: { userId: roleTarget.id, role: newRole } })
    setRoleDialogOpen(false)
    setRoleTarget(null)
    fetchUsers(offset)
    router.invalidate()
  }

  const showingFrom = total === 0 ? 0 : offset + 1
  const showingTo = Math.min(offset + limit, total)

  return (
    <div>
      <PageHeader
        badge="Admin Portal"
        section="Users"
        title="User Management"
        subtitle="Manage platform users"
      />
      <PageContent>
        {/* Filter Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-sm">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-9"
                />
              </div>
              <Select value={roleFilter || "all"} onValueChange={handleRoleFilterChange}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="lender">Lender</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleSearch}>Search</Button>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className={loading ? "opacity-50 pointer-events-none" : ""}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Email</th>
                  <th className="text-left p-3 font-medium">Role</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Joined</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium">{u.name}</td>
                    <td className="p-3 text-muted-foreground">{u.email}</td>
                    <td className="p-3">
                      <div className="flex gap-1 flex-wrap">
                        {u.role?.split(",").map((r) => (
                          <Badge key={r.trim()} variant="secondary">
                            {r.trim()}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">
                      {u.banned ? (
                        <Badge variant="destructive">Banned</Badge>
                      ) : (
                        <Badge variant="outline">Active</Badge>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {format(new Date(u.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="p-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="inline-flex items-center justify-center h-8 w-8 rounded hover:bg-muted transition-colors"
                        >
                          <DotsThree className="h-4 w-4" weight="bold" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {u.banned ? (
                            <DropdownMenuItem
                              onClick={() => handleUnban(u.id)}
                              className="cursor-pointer"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Unban User
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => {
                                setBanTarget({ id: u.id, name: u.name })
                                setBanDialogOpen(true)
                              }}
                              className="cursor-pointer"
                              disabled={u.id === currentUserId}
                            >
                              <Prohibit className="h-4 w-4 mr-2" />
                              Ban User
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => openRoleDialog(u)}
                            className="cursor-pointer"
                          >
                            <UserGear className="h-4 w-4 mr-2" />
                            Set Role
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between p-3 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {showingFrom}-{showingTo} of {total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => fetchUsers(Math.max(0, offset - limit))}
                >
                  <CaretLeft className="h-4 w-4 mr-1" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + limit >= total}
                  onClick={() => fetchUsers(offset + limit)}
                >
                  Next
                  <CaretRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </PageContent>

      {/* Ban Confirmation Dialog */}
      <AlertDialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ban {banTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately revoke all their sessions. They will not be
              able to log in until unbanned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ban-reason">Reason (optional)</Label>
            <Textarea
              id="ban-reason"
              placeholder="Reason for banning..."
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setBanTarget(null)
                setBanReason("")
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleBan}>
              Ban User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Set Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Role for {roleTarget?.name}</DialogTitle>
            <DialogDescription>
              Select the roles for this user. At least one role is required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {(["lender", "agent", "admin"] as const).map((role) => (
              <label key={role} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={selectedRoles[role]}
                  onCheckedChange={(checked) =>
                    setSelectedRoles((prev) => ({
                      ...prev,
                      [role]: !!checked,
                    }))
                  }
                />
                <span className="text-sm capitalize">{role}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRoleDialogOpen(false)
                setRoleTarget(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSetRole}
              disabled={!Object.values(selectedRoles).some(Boolean)}
            >
              Save Roles
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
