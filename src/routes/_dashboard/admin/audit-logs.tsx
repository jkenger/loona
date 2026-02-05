import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader, PageContent } from "@/components/ui/page-header"
import { AccessDenied } from "@/components/access-denied"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { getAuditLogs } from "@/server/admin"
import {
  MagnifyingGlass,
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react"
import { formatDistanceToNow } from "date-fns"

export const Route = createFileRoute("/_dashboard/admin/audit-logs")({
  loader: async ({ context }) => {
    const { session } = context as {
      session: { user: { role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.ADMIN)) {
      return { data: null, unauthorized: true }
    }
    const data = await getAuditLogs({ data: { limit: 20, offset: 0 } })
    return { data, unauthorized: false }
  },
  component: AuditLogsPage,
})

const ENTITY_TYPES = [
  { value: "all", label: "All Entities" },
  { value: "contact", label: "Contact" },
  { value: "loan", label: "Loan" },
  { value: "payment", label: "Payment" },
  { value: "agent", label: "Agent" },
  { value: "commission", label: "Commission" },
  { value: "user", label: "User" },
]

function actionBadgeVariant(action: string) {
  if (action.startsWith("admin.")) return "destructive" as const
  if (action.includes("delete") || action.includes("terminate"))
    return "destructive" as const
  if (action.includes("create") || action.includes("record"))
    return "default" as const
  return "secondary" as const
}

function formatMetadata(metadata: Record<string, unknown> | null): string {
  if (!metadata) return "-"
  return Object.entries(metadata)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ")
}

function AuditLogsPage() {
  const { data: initialData, unauthorized } = Route.useLoaderData()

  const [logs, setLogs] = useState(initialData?.logs ?? [])
  const [total, setTotal] = useState(initialData?.total ?? 0)
  const [offset, setOffset] = useState(0)
  const [entityType, setEntityType] = useState("")
  const [actionSearch, setActionSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const limit = 20

  if (unauthorized) {
    return (
      <AccessDenied
        message="Only admins can access this page."
        homeLink="/dashboard"
        homeLinkLabel="Go to Dashboard"
      />
    )
  }

  const fetchLogs = async (
    newOffset: number,
    newEntityType?: string,
    newAction?: string
  ) => {
    setLoading(true)
    try {
      const result = await getAuditLogs({
        data: {
          limit,
          offset: newOffset,
          entityType: (newEntityType ?? entityType) || undefined,
          action: (newAction ?? actionSearch) || undefined,
        },
      })
      setLogs(result.logs)
      setTotal(result.total)
      setOffset(newOffset)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    fetchLogs(0, entityType, actionSearch)
  }

  const handleEntityTypeChange = (value: string | null) => {
    if (!value) return
    const newType = value === "all" ? "" : value
    setEntityType(newType)
    fetchLogs(0, newType, actionSearch)
  }

  const showingFrom = total === 0 ? 0 : offset + 1
  const showingTo = Math.min(offset + limit, total)

  return (
    <div>
      <PageHeader
        badge="Admin Portal"
        section="Audit Logs"
        title="Audit Log Viewer"
        subtitle="View all platform activity"
      />
      <PageContent>
        {/* Filter Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Select
                value={entityType || "all"}
                onValueChange={handleEntityTypeChange}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All entities" />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((et) => (
                    <SelectItem key={et.value} value={et.value}>
                      {et.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative flex-1 max-w-sm">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by action..."
                  value={actionSearch}
                  onChange={(e) => setActionSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-9"
                />
              </div>
              <Button onClick={handleSearch}>Search</Button>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card className={loading ? "opacity-50 pointer-events-none" : ""}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Time</th>
                  <th className="text-left p-3 font-medium">User</th>
                  <th className="text-left p-3 font-medium">Action</th>
                  <th className="text-left p-3 font-medium">Entity</th>
                  <th className="text-left p-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(log.createdAt), {
                        addSuffix: true,
                      })}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {log.userEmail || "-"}
                    </td>
                    <td className="p-3">
                      <Badge variant={actionBadgeVariant(log.action)}>
                        {log.action}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <span className="text-muted-foreground">
                        {log.entityType}
                      </span>
                      {log.entityId && (
                        <span className="text-xs text-muted-foreground/60 ml-1">
                          ({log.entityId.slice(0, 8)}...)
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs max-w-[200px] truncate">
                      {formatMetadata(log.metadata)}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-8 text-center text-muted-foreground"
                    >
                      No audit logs found
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
                  onClick={() => fetchLogs(Math.max(0, offset - limit))}
                >
                  <CaretLeft className="h-4 w-4 mr-1" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + limit >= total}
                  onClick={() => fetchLogs(offset + limit)}
                >
                  Next
                  <CaretRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </PageContent>
    </div>
  )
}
