import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import {
  getAdminPost,
  getCategories,
  getTags,
  updatePost,
  deletePost,
} from "@/server/blog"
import { TiptapEditor } from "@/components/blog/tiptap-editor"
import { toast } from "sonner"
import {
  FloppyDisk,
  PaperPlaneTilt,
  Trash,
  Spinner,
  EyeSlash,
} from "@phosphor-icons/react"

export const Route = createFileRoute("/_dashboard/admin/blog/$postId")({
  loader: async ({ context, params }) => {
    const { session } = context as {
      session: { user: { role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.ADMIN)) {
      return { post: null, categories: [], tags: [], unauthorized: true }
    }
    const [post, categories, tags] = await Promise.all([
      getAdminPost({ data: { id: params.postId } }),
      getCategories(),
      getTags(),
    ])
    return { post, categories, tags, unauthorized: false }
  },
  component: EditPostPage,
})

function EditPostPage() {
  const { post, categories, tags, unauthorized } = Route.useLoaderData()
  const router = useRouter()

  const [title, setTitle] = useState(post?.title ?? "")
  const [slug, setSlug] = useState(post?.slug ?? "")
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "")
  const [content, setContent] = useState(post?.content ?? "")
  const [categoryId, setCategoryId] = useState(post?.categoryId ?? "")
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    post?.postTags?.map((pt) => pt.tag.id) ?? []
  )
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (unauthorized) {
    return (
      <AccessDenied
        message="Only admins can access this page."
        homeLink="/dashboard"
        homeLinkLabel="Go to Dashboard"
      />
    )
  }

  if (!post) {
    return (
      <div>
        <PageHeader
          badge="Admin Portal"
          section="Blog"
          title="Post Not Found"
        />
        <PageContent>
          <p className="text-muted-foreground">This post does not exist.</p>
        </PageContent>
      </div>
    )
  }

  const handleSave = async (status: "draft" | "published") => {
    if (!title.trim()) {
      toast.error("Title is required")
      return
    }
    if (!slug.trim()) {
      toast.error("Slug is required")
      return
    }

    setSaving(true)
    try {
      await updatePost({
        data: {
          id: post.id,
          title: title.trim(),
          slug: slug.trim(),
          excerpt: excerpt.trim() || undefined,
          content: content || undefined,
          categoryId: categoryId || null,
          tagIds: selectedTagIds,
          status,
        },
      })
      toast.success(
        status === "published"
          ? post.status === "published"
            ? "Post updated!"
            : "Post published!"
          : "Draft saved!"
      )
      router.navigate({ to: "/admin/blog" })
    } catch (e: any) {
      toast.error(e.message || "Failed to save post")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deletePost({ data: { id: post.id } })
      toast.success("Post deleted")
      router.navigate({ to: "/admin/blog" })
    } catch (e: any) {
      toast.error(e.message || "Failed to delete post")
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    )
  }

  return (
    <div>
      <PageHeader
        badge="Admin Portal"
        section="Blog"
        title="Edit Post"
        subtitle={post.title}
        actions={
          <div className="flex gap-2">
            {post.status === "published" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSave("draft")}
                disabled={saving}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                {saving ? (
                  <Spinner className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <EyeSlash className="h-4 w-4 mr-1" />
                )}
                Unpublish
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSave("draft")}
                disabled={saving}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                {saving ? (
                  <Spinner className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <FloppyDisk className="h-4 w-4 mr-1" />
                )}
                Save Draft
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => handleSave("published")}
              disabled={saving}
            >
              {saving ? (
                <Spinner className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <PaperPlaneTilt className="h-4 w-4 mr-1" />
              )}
              {post.status === "published" ? "Update" : "Publish"}
            </Button>
          </div>
        }
      />
      <PageContent>
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Main content */}
          <div className="space-y-6">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Post title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="post-url-slug"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="excerpt">Excerpt</Label>
                  <Textarea
                    id="excerpt"
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                    placeholder="Brief summary of the post..."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <Label className="mb-2 block">Content</Label>
                <TiptapEditor
                  content={content}
                  onChange={setContent}
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Label>Status:</Label>
                  <Badge
                    variant={
                      post.status === "published" ? "default" : "secondary"
                    }
                  >
                    {post.status}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No category</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tags</Label>
                  {tags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No tags created yet
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag.id)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                            selectedTagIds.includes(tag.id)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/50 text-muted-foreground border-transparent hover:border-border"
                          }`}
                        >
                          {tag.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash className="h-4 w-4 mr-1" />
                  Delete Post
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{post.title}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
