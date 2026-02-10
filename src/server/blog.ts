import { createServerFn } from "@tanstack/react-start"
import {
  db,
  blogPosts,
  blogCategories,
  blogTags,
  blogPostTags,
  user,
} from "@/lib/db"
import { eq, desc, and, sql, ilike, count, inArray } from "drizzle-orm"
import { requireAdmin } from "./session"
import { logAudit } from "./audit"
import { z } from "zod"

// ============================================================================
// Public Functions (no auth required)
// ============================================================================

export const getLatestPosts = createServerFn().handler(async () => {
  const posts = await db.query.blogPosts.findMany({
    where: eq(blogPosts.status, "published"),
    with: {
      category: { columns: { name: true } },
    },
    columns: {
      title: true,
      slug: true,
      excerpt: true,
      publishedAt: true,
    },
    orderBy: [desc(blogPosts.publishedAt)],
    limit: 3,
  })
  return posts
})

export const getPublishedPosts = createServerFn()
  .inputValidator(
    z.object({
      limit: z.number().min(1).max(50).default(12),
      offset: z.number().min(0).default(0),
      categorySlug: z.string().optional(),
      tagSlug: z.string().optional(),
    })
  )
  .handler(async ({ data }) => {
    const conditions = [eq(blogPosts.status, "published")]

    if (data.categorySlug) {
      const cat = await db.query.blogCategories.findFirst({
        where: eq(blogCategories.slug, data.categorySlug),
      })
      if (cat) {
        conditions.push(eq(blogPosts.categoryId, cat.id))
      } else {
        return { posts: [], total: 0 }
      }
    }

    if (data.tagSlug) {
      const tag = await db.query.blogTags.findFirst({
        where: eq(blogTags.slug, data.tagSlug),
      })
      if (tag) {
        const postIds = await db
          .select({ postId: blogPostTags.postId })
          .from(blogPostTags)
          .where(eq(blogPostTags.tagId, tag.id))
        const ids = postIds.map((r) => r.postId)
        if (ids.length === 0) return { posts: [], total: 0 }
        conditions.push(inArray(blogPosts.id, ids))
      } else {
        return { posts: [], total: 0 }
      }
    }

    const where = and(...conditions)

    const [totalResult] = await db
      .select({ count: count() })
      .from(blogPosts)
      .where(where)

    const posts = await db.query.blogPosts.findMany({
      where,
      with: {
        author: { columns: { id: true, name: true } },
        category: true,
        postTags: { with: { tag: true } },
      },
      orderBy: [desc(blogPosts.publishedAt)],
      limit: data.limit,
      offset: data.offset,
    })

    return { posts, total: totalResult.count }
  })

export const getPublishedPost = createServerFn()
  .inputValidator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const post = await db.query.blogPosts.findFirst({
      where: and(
        eq(blogPosts.slug, data.slug),
        eq(blogPosts.status, "published")
      ),
      with: {
        author: { columns: { id: true, name: true } },
        category: true,
        postTags: { with: { tag: true } },
      },
    })
    return post ?? null
  })

export const getPublicCategories = createServerFn().handler(async () => {
  return db.query.blogCategories.findMany({
    orderBy: [blogCategories.name],
  })
})

export const getPublicTags = createServerFn().handler(async () => {
  return db.query.blogTags.findMany({
    orderBy: [blogTags.name],
  })
})

// ============================================================================
// Admin Functions (requireAdmin)
// ============================================================================

export const getAdminPosts = createServerFn()
  .inputValidator(
    z.object({
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0),
      status: z.enum(["draft", "published", "all"]).default("all"),
      search: z.string().optional(),
    })
  )
  .handler(async ({ data }) => {
    await requireAdmin()

    const conditions = []
    if (data.status !== "all") {
      conditions.push(eq(blogPosts.status, data.status))
    }
    if (data.search) {
      conditions.push(ilike(blogPosts.title, `%${data.search}%`))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [totalResult] = await db
      .select({ count: count() })
      .from(blogPosts)
      .where(where)

    const posts = await db.query.blogPosts.findMany({
      where,
      with: {
        author: { columns: { id: true, name: true } },
        category: true,
      },
      orderBy: [desc(blogPosts.updatedAt)],
      limit: data.limit,
      offset: data.offset,
    })

    return { posts, total: totalResult.count }
  })

export const getAdminPost = createServerFn()
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await requireAdmin()

    const post = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.id, data.id),
      with: {
        author: { columns: { id: true, name: true } },
        category: true,
        postTags: { with: { tag: true } },
      },
    })
    return post ?? null
  })

export const createPost = createServerFn()
  .inputValidator(
    z.object({
      title: z.string().min(1),
      slug: z.string().min(1),
      excerpt: z.string().optional(),
      content: z.string().optional(),
      categoryId: z.string().nullable().optional(),
      tagIds: z.array(z.string()).optional(),
      status: z.enum(["draft", "published"]).default("draft"),
    })
  )
  .handler(async ({ data }) => {
    const session = await requireAdmin()

    const [post] = await db
      .insert(blogPosts)
      .values({
        authorId: session.user.id,
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt || null,
        content: data.content || null,
        categoryId: data.categoryId || null,
        status: data.status,
        publishedAt: data.status === "published" ? new Date() : null,
      })
      .returning()

    if (data.tagIds && data.tagIds.length > 0) {
      await db.insert(blogPostTags).values(
        data.tagIds.map((tagId) => ({ postId: post.id, tagId }))
      )
    }

    logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: data.status === "published" ? "blog.publish" : "blog.create",
      entityType: "blog_post",
      entityId: post.id,
      metadata: { title: data.title },
    })

    return post
  })

export const updatePost = createServerFn()
  .inputValidator(
    z.object({
      id: z.string(),
      title: z.string().min(1),
      slug: z.string().min(1),
      excerpt: z.string().optional(),
      content: z.string().optional(),
      categoryId: z.string().nullable().optional(),
      tagIds: z.array(z.string()).optional(),
      status: z.enum(["draft", "published"]),
    })
  )
  .handler(async ({ data }) => {
    const session = await requireAdmin()

    // Get current post to detect status changes
    const current = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.id, data.id),
    })
    if (!current) throw new Error("Post not found")

    const wasPublished = current.status === "published"
    const isNowPublished = data.status === "published"

    const [post] = await db
      .update(blogPosts)
      .set({
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt || null,
        content: data.content || null,
        categoryId: data.categoryId || null,
        status: data.status,
        publishedAt: isNowPublished && !wasPublished ? new Date() : current.publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(blogPosts.id, data.id))
      .returning()

    // Replace tags
    await db.delete(blogPostTags).where(eq(blogPostTags.postId, data.id))
    if (data.tagIds && data.tagIds.length > 0) {
      await db.insert(blogPostTags).values(
        data.tagIds.map((tagId) => ({ postId: data.id, tagId }))
      )
    }

    const action = !wasPublished && isNowPublished
      ? "blog.publish"
      : wasPublished && !isNowPublished
        ? "blog.unpublish"
        : "blog.update"

    logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action,
      entityType: "blog_post",
      entityId: post.id,
      metadata: { title: data.title },
    })

    return post
  })

export const deletePost = createServerFn()
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const session = await requireAdmin()

    const post = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.id, data.id),
    })
    if (!post) throw new Error("Post not found")

    await db.delete(blogPosts).where(eq(blogPosts.id, data.id))

    logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: "blog.delete",
      entityType: "blog_post",
      entityId: data.id,
      metadata: { title: post.title },
    })
  })

// ============================================================================
// Categories (Admin)
// ============================================================================

export const getCategories = createServerFn().handler(async () => {
  await requireAdmin()
  return db.query.blogCategories.findMany({
    orderBy: [blogCategories.name],
  })
})

export const createCategory = createServerFn()
  .inputValidator(
    z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
      description: z.string().optional(),
    })
  )
  .handler(async ({ data }) => {
    const session = await requireAdmin()

    const [category] = await db
      .insert(blogCategories)
      .values({
        name: data.name,
        slug: data.slug,
        description: data.description || null,
      })
      .returning()

    logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: "blog.create",
      entityType: "blog_category",
      entityId: category.id,
      metadata: { name: data.name },
    })

    return category
  })

export const updateCategory = createServerFn()
  .inputValidator(
    z.object({
      id: z.string(),
      name: z.string().min(1),
      slug: z.string().min(1),
      description: z.string().optional(),
    })
  )
  .handler(async ({ data }) => {
    const session = await requireAdmin()

    const [category] = await db
      .update(blogCategories)
      .set({
        name: data.name,
        slug: data.slug,
        description: data.description || null,
      })
      .where(eq(blogCategories.id, data.id))
      .returning()

    logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: "blog.update",
      entityType: "blog_category",
      entityId: category.id,
      metadata: { name: data.name },
    })

    return category
  })

export const deleteCategory = createServerFn()
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const session = await requireAdmin()
    await db.delete(blogCategories).where(eq(blogCategories.id, data.id))

    logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: "blog.delete",
      entityType: "blog_category",
      entityId: data.id,
    })
  })

// ============================================================================
// Tags (Admin)
// ============================================================================

export const getTags = createServerFn().handler(async () => {
  await requireAdmin()
  return db.query.blogTags.findMany({
    orderBy: [blogTags.name],
  })
})

export const createTag = createServerFn()
  .inputValidator(
    z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
    })
  )
  .handler(async ({ data }) => {
    const session = await requireAdmin()

    const [tag] = await db
      .insert(blogTags)
      .values({ name: data.name, slug: data.slug })
      .returning()

    logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: "blog.create",
      entityType: "blog_tag",
      entityId: tag.id,
      metadata: { name: data.name },
    })

    return tag
  })

export const deleteTag = createServerFn()
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const session = await requireAdmin()
    await db.delete(blogTags).where(eq(blogTags.id, data.id))

    logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: "blog.delete",
      entityType: "blog_tag",
      entityId: data.id,
    })
  })
