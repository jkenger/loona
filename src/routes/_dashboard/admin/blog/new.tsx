import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
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
import { hasRole, ROLES } from "@/lib/constants/roles"
import { getCategories, getTags, createPost } from "@/server/blog"
import { TiptapEditor } from "@/components/blog/tiptap-editor"
import { toast } from "sonner"
import { FloppyDisk, PaperPlaneTilt, Spinner } from "@phosphor-icons/react"

export const Route = createFileRoute("/_dashboard/admin/blog/new")({
  loader: async ({ context }) => {
    const { session } = context as {
      session: { user: { role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.ADMIN)) {
      return { categories: [], tags: [], unauthorized: true }
    }
    const [categories, tags] = await Promise.all([getCategories(), getTags()])
    return { categories, tags, unauthorized: false }
  },
  component: NewPostPage,
})

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function NewPostPage() {
  const { categories, tags, unauthorized } = Route.useLoaderData()
  const router = useRouter()

  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [slugEdited, setSlugEdited] = useState(false)
  const [excerpt, setExcerpt] = useState("")
  const [content, setContent] = useState("")
  const [categoryId, setCategoryId] = useState<string>("")
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  if (unauthorized) {
    return (
      <AccessDenied
        message="Only admins can access this page."
        homeLink="/dashboard"
        homeLinkLabel="Go to Dashboard"
      />
    )
  }

  const handleTitleChange = (value: string) => {
    setTitle(value)
    if (!slugEdited) {
      setSlug(slugify(value))
    }
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
      await createPost({
        data: {
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
        status === "published" ? "Post published!" : "Draft saved!"
      )
      router.navigate({ to: "/admin/blog" })
    } catch (e: any) {
      toast.error(e.message || "Failed to save post")
    } finally {
      setSaving(false)
    }
  }

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  return (
    <div>
      <PageHeader
        badge="Admin Portal"
        section="Blog"
        title="New Post"
        subtitle="Create a new blog post"
        actions={
          <div className="flex gap-2">
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
              Publish
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
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Post title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value)
                      setSlugEdited(true)
                    }}
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
                <TiptapEditor content={content} onChange={setContent} />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-4">
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
          </div>
        </div>
      </PageContent>
    </div>
  )
}
