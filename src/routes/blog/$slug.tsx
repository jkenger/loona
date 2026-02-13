import { createFileRoute, Link } from "@tanstack/react-router"
import { Badge } from "@/components/ui/badge"
import { LoonaBrand } from "@/components/ui/loona-brand"
import { getPublishedPost } from "@/server/blog"
import { TiptapRenderer } from "@/components/blog/tiptap-renderer"
import { ArrowLeft, CalendarBlank, UserCircle } from "@phosphor-icons/react"
import { format } from "date-fns"
import { buildMeta, SITE_URL, SITE_NAME } from "@/lib/constants/seo"

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const post = await getPublishedPost({ data: { slug: params.slug } })
    return { post }
  },
  head: ({ loaderData }) => {
    const post = loaderData?.post
    if (!post) {
      return buildMeta({
        title: 'Post Not Found | Loona Blog',
        description: 'This blog post could not be found.',
        url: `${SITE_URL}/blog`,
      })
    }
    return buildMeta({
      title: `${post.title} | Loona Blog`,
      description: post.excerpt || `Read ${post.title} on the Loona Blog.`,
      url: `${SITE_URL}/blog/${post.slug}`,
      ogType: 'article',
    })
  },
  component: BlogPostPage,
})

function BlogPostPage() {
  const { post } = Route.useLoaderData()

  if (!post) {
    return (
      <div className="min-h-screen bg-gradient-page">
        <header className="bg-slate-900 text-white">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <Link to="/">
              <LoonaBrand size="sm" variant="white" animated={false} />
            </Link>
            <Link
              to="/blog"
              className="text-sm text-slate-300 hover:text-white transition-colors"
            >
              Blog
            </Link>
          </div>
        </header>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 text-center">
          <h1 className="text-2xl font-bold mb-2">Post Not Found</h1>
          <p className="text-muted-foreground mb-6">
            This post doesn't exist or has been unpublished.
          </p>
          <Link
            to="/blog"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to blog
          </Link>
        </div>
      </div>
    )
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt || '',
    url: `${SITE_URL}/blog/${post.slug}`,
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
    datePublished: (post.publishedAt || post.createdAt).toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: {
      '@type': 'Person',
      name: post.author?.name || SITE_NAME,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
  }

  return (
    <div className="min-h-screen bg-gradient-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Header */}
      <header className="bg-slate-900 text-white">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link to="/">
            <LoonaBrand size="sm" variant="white" animated={false} />
          </Link>
          <Link
            to="/blog"
            className="text-sm text-slate-300 hover:text-white transition-colors"
          >
            Blog
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
        {/* Back link */}
        <Link
          to="/blog"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 mb-8 animate-in fade-in slide-in-from-left-2 duration-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to blog
        </Link>

        {/* Post header */}
        <header className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
          {post.category && (
            <Badge variant="secondary" className="mb-3">
              {post.category.name}
            </Badge>
          )}
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {post.author && (
              <span className="flex items-center gap-1.5">
                <UserCircle className="h-4 w-4" />
                {post.author.name}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <CalendarBlank className="h-4 w-4" />
              {post.publishedAt
                ? format(new Date(post.publishedAt), "MMMM d, yyyy")
                : format(new Date(post.createdAt), "MMMM d, yyyy")}
            </span>
          </div>
          {post.postTags && post.postTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {post.postTags.map((pt) => (
                <Badge key={pt.tag.id} variant="outline" className="text-xs">
                  {pt.tag.name}
                </Badge>
              ))}
            </div>
          )}
        </header>

        {/* Content */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
          {post.content ? (
            <TiptapRenderer content={post.content} />
          ) : (
            <p className="text-muted-foreground italic">
              This post has no content yet.
            </p>
          )}
        </div>
      </article>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Loona. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
