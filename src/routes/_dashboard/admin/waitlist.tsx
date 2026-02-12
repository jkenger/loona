import { createFileRoute, useRouter } from "@tanstack/react-router"
import { SkeletonTablePage } from "@/components/ui/skeleton"
import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader, PageContent } from "@/components/ui/page-header"
import { AccessDenied } from "@/components/access-denied"
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
import { hasRole, ROLES } from "@/lib/constants/roles"
import { getWaitlistEntries, approveWaitlistEntry, deleteWaitlistEntry } from "@/server/admin"
import {
  MagnifyingGlass,
  CheckCircle,
  Trash,
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react"
import { format } from "date-fns"
import { toast } from "sonner"

export const Route = createFileRoute("/_dashboard/admin/waitlist")({
  loader: async ({ context }) => {
    const { session } = context as {
      session: { user: { id: string; role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.ADMIN)) {
      return { data: null, unauthorized: true }
    }
    const data = await getWaitlistEntries({ data: { limit: 20, offset: 0 } })
    return { data, unauthorized: false }
  },
  pendingComponent: SkeletonTablePage,
  component: WaitlistPage,
})

function WaitlistPage() {
  const { data: initialData, unauthorized } = Route.useLoaderData()
  const router = useRouter()

  const [entries, setEntries] = useState(initialData?.entries ?? [])
  const [total, setTotal] = useState(initialData?.total ?? 0)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const limit = 20

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; email: string } | null>(null)

  if (unauthorized) {
    return (
      <AccessDenied
        message="Only admins can access this page."
        homeLink="/dashboard"
        homeLinkLabel="Go to Dashboard"
      />
    )
  }

  const fetchEntries = async (newOffset: number, newSearch?: string) => {
    setLoading(true)
    try {
      const result = await getWaitlistEntries({
        data: {
          limit,
          offset: newOffset,
          search: newSearch ?? search,
        },
      })
      setEntries(result.entries)
      setTotal(result.total)
      setOffset(newOffset)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    fetchEntries(0, search)
  }

  const handleApprove = async (id: string) => {
    try {
      await approveWaitlistEntry({ data: { id } })
      toast.success("Entry approved and email sent")
      fetchEntries(offset)
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve")
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteWaitlistEntry({ data: deleteTarget.id })
      toast.success("Entry deleted")
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
      fetchEntries(offset)
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  const showingFrom = total === 0 ? 0 : offset + 1
  const showingTo = Math.min(offset + limit, total)

  return (
    <div>
      <PageHeader
        badge="Admin Portal"
        section="Waitlist"
        title="Waitlist Management"
        subtitle="View and approve beta signups"
      />
      <PageContent>
        {/* Search Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-sm">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-9"
                />
              </div>
              <Button onClick={handleSearch}>Search</Button>
            </div>
          </CardContent>
        </Card>

        {/* Waitlist Table */}
        <Card className={loading ? "opacity-50 pointer-events-none" : ""}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Email</th>
                  <th className="text-left p-3 font-medium">Signed Up</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium">{entry.email}</td>
                    <td className="p-3 text-muted-foreground">
                      {format(new Date(entry.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="p-3">
                      {entry.approvedAt ? (
                        <Badge variant="default">Approved</Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!entry.approvedAt && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApprove(entry.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDeleteTarget({ id: entry.id, email: entry.email })
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      No waitlist entries found
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
                  onClick={() => fetchEntries(Math.max(0, offset - limit))}
                >
                  <CaretLeft className="h-4 w-4 mr-1" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + limit >= total}
                  onClick={() => fetchEntries(offset + limit)}
                >
                  Next
                  <CaretRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </PageContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete waitlist entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteTarget?.email}</strong> from the waitlist. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteTarget(null)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
