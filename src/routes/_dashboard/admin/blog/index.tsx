import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
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
import { getAdminPosts } from "@/server/blog"
import {
  MagnifyingGlass,
  Plus,
  PencilSimple,
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react"
import { format } from "date-fns"

export const Route = createFileRoute("/_dashboard/admin/blog/")({
  loader: async ({ context }) => {
    const { session } = context as {
      session: { user: { role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.ADMIN)) {
      return { data: null, unauthorized: true }
    }
    const data = await getAdminPosts({ data: { limit: 20, offset: 0, status: "all" } })
    return { data, unauthorized: false }
  },
  component: BlogPostsPage,
})

function BlogPostsPage() {
  const { data: initialData, unauthorized } = Route.useLoaderData()
  const router = useRouter()

  const [posts, setPosts] = useState(initialData?.posts ?? [])
  const [total, setTotal] = useState(initialData?.total ?? 0)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(false)
  const limit = 20

  if (unauthorized || !initialData) {
    return (
      <AccessDenied
        message="Only admins can access this page."
        homeLink="/dashboard"
        homeLinkLabel="Go to Dashboard"
      />
    )
  }

  const fetchPosts = async (newOffset: number, newSearch?: string, newStatus?: string) => {
    setLoading(true)
    try {
      const data = await getAdminPosts({
        data: {
          limit,
          offset: newOffset,
          status: (newStatus ?? statusFilter) as "draft" | "published" | "all",
          search: newSearch ?? (search || undefined),
        },
      })
      setPosts(data.posts)
      setTotal(data.total)
      setOffset(newOffset)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        badge="Admin Portal"
        section="Blog"
        title="Blog Posts"
        subtitle="Manage blog content"
        actions={
          <div className="flex gap-2">
            <Link to="/admin/blog/categories">
              <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                Categories & Tags
              </Button>
            </Link>
            <Link to="/admin/blog/new">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                New Post
              </Button>
            </Link>
          </div>
        }
      />
      <PageContent>
        <Card>
          <CardContent className="p-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search posts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") fetchPosts(0, search)
                  }}
                  className="pl-9"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val)
                  fetchPosts(0, search, val)
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Title</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium hidden sm:table-cell">Category</th>
                    <th className="pb-2 font-medium hidden md:table-cell">Author</th>
                    <th className="pb-2 font-medium hidden md:table-cell">Updated</th>
                    <th className="pb-2 font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody className={loading ? "opacity-50" : ""}>
                  {posts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        No posts found
                      </td>
                    </tr>
                  ) : (
                    posts.map((post) => (
                      <tr key={post.id} className="border-b last:border-0">
                        <td className="py-3 pr-3">
                          <Link
                            to="/admin/blog/$postId"
                            params={{ postId: post.id }}
                            className="font-medium hover:text-primary transition-colors"
                          >
                            {post.title}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            /{post.slug}
                          </p>
                        </td>
                        <td className="py-3 pr-3">
                          <Badge
                            variant={
                              post.status === "published" ? "default" : "secondary"
                            }
                          >
                            {post.status}
                          </Badge>
                        </td>
                        <td className="py-3 pr-3 hidden sm:table-cell">
                          {post.category?.name ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-3 hidden md:table-cell">
                          {post.author?.name ?? "Unknown"}
                        </td>
                        <td className="py-3 pr-3 hidden md:table-cell text-muted-foreground">
                          {format(new Date(post.updatedAt), "MMM d, yyyy")}
                        </td>
                        <td className="py-3">
                          <Link
                            to="/admin/blog/$postId"
                            params={{ postId: post.id }}
                          >
                            <Button variant="ghost" size="icon-sm">
                              <PencilSimple className="h-4 w-4" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > limit && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {offset + 1}–{Math.min(offset + limit, total)} of{" "}
                  {total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset === 0 || loading}
                    onClick={() => fetchPosts(Math.max(0, offset - limit))}
                  >
                    <CaretLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset + limit >= total || loading}
                    onClick={() => fetchPosts(offset + limit)}
                  >
                    <CaretRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </PageContent>
    </div>
  )
}
