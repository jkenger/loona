import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  getCategories,
  getTags,
  createCategory,
  deleteCategory,
  createTag,
  deleteTag,
} from "@/server/blog"
import { toast } from "sonner"
import { Plus, Trash, Spinner } from "@phosphor-icons/react"
import type { BlogCategory, BlogTag } from "@/lib/db/schema"

export const Route = createFileRoute("/_dashboard/admin/blog/categories")({
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
  component: CategoriesPage,
})

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function CategoriesPage() {
  const {
    categories: initialCategories,
    tags: initialTags,
    unauthorized,
  } = Route.useLoaderData()

  const [categories, setCategories] = useState<BlogCategory[]>(initialCategories)
  const [tags, setTags] = useState<BlogTag[]>(initialTags)

  // Category form
  const [catName, setCatName] = useState("")
  const [catDesc, setCatDesc] = useState("")
  const [catSaving, setCatSaving] = useState(false)

  // Tag form
  const [tagName, setTagName] = useState("")
  const [tagSaving, setTagSaving] = useState(false)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "category" | "tag"
    id: string
    name: string
  } | null>(null)

  if (unauthorized) {
    return (
      <AccessDenied
        message="Only admins can access this page."
        homeLink="/dashboard"
        homeLinkLabel="Go to Dashboard"
      />
    )
  }

  const handleCreateCategory = async () => {
    if (!catName.trim()) return
    setCatSaving(true)
    try {
      const cat = await createCategory({
        data: {
          name: catName.trim(),
          slug: slugify(catName.trim()),
          description: catDesc.trim() || undefined,
        },
      })
      setCategories((prev) => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))
      setCatName("")
      setCatDesc("")
      toast.success("Category created")
    } catch (e: any) {
      toast.error(e.message || "Failed to create category")
    } finally {
      setCatSaving(false)
    }
  }

  const handleCreateTag = async () => {
    if (!tagName.trim()) return
    setTagSaving(true)
    try {
      const tag = await createTag({
        data: {
          name: tagName.trim(),
          slug: slugify(tagName.trim()),
        },
      })
      setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))
      setTagName("")
      toast.success("Tag created")
    } catch (e: any) {
      toast.error(e.message || "Failed to create tag")
    } finally {
      setTagSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      if (deleteTarget.type === "category") {
        await deleteCategory({ data: { id: deleteTarget.id } })
        setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      } else {
        await deleteTag({ data: { id: deleteTarget.id } })
        setTags((prev) => prev.filter((t) => t.id !== deleteTarget.id))
      }
      toast.success(`${deleteTarget.type === "category" ? "Category" : "Tag"} deleted`)
    } catch (e: any) {
      toast.error(e.message || "Failed to delete")
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div>
      <PageHeader
        badge="Admin Portal"
        section="Blog"
        title="Categories & Tags"
        subtitle="Organize your blog content"
      />
      <PageContent>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Categories */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">
              {/* Create form */}
              <div className="space-y-2 p-3 rounded bg-muted/30 border">
                <div className="space-y-1.5">
                  <Label htmlFor="cat-name" className="text-xs">Name</Label>
                  <Input
                    id="cat-name"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="Category name"
                    className="h-8 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateCategory()
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cat-desc" className="text-xs">Description (optional)</Label>
                  <Input
                    id="cat-desc"
                    value={catDesc}
                    onChange={(e) => setCatDesc(e.target.value)}
                    placeholder="Brief description"
                    className="h-8 text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleCreateCategory}
                  disabled={catSaving || !catName.trim()}
                >
                  {catSaving ? (
                    <Spinner className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 mr-1" />
                  )}
                  Add Category
                </Button>
              </div>

              {/* List */}
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No categories yet
                </p>
              ) : (
                <div className="divide-y">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">{cat.name}</p>
                        <p className="text-xs text-muted-foreground">
                          /{cat.slug}
                          {cat.description && ` — ${cat.description}`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setDeleteTarget({
                            type: "category",
                            id: cat.id,
                            name: cat.name,
                          })
                        }
                      >
                        <Trash className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">
              {/* Create form */}
              <div className="space-y-2 p-3 rounded bg-muted/30 border">
                <div className="space-y-1.5">
                  <Label htmlFor="tag-name" className="text-xs">Name</Label>
                  <Input
                    id="tag-name"
                    value={tagName}
                    onChange={(e) => setTagName(e.target.value)}
                    placeholder="Tag name"
                    className="h-8 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateTag()
                    }}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleCreateTag}
                  disabled={tagSaving || !tagName.trim()}
                >
                  {tagSaving ? (
                    <Spinner className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 mr-1" />
                  )}
                  Add Tag
                </Button>
              </div>

              {/* List */}
              {tags.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No tags yet
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 pt-2">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted border text-sm"
                    >
                      <span>{tag.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            type: "tag",
                            id: tag.id,
                            name: tag.name,
                          })
                        }
                        className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                      >
                        <Trash className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageContent>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.type === "category" ? "Category" : "Tag"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"?
              {deleteTarget?.type === "category" &&
                " Posts using this category will become uncategorized."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
