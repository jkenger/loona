import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LoonaBrand } from '@/components/ui/loona-brand'
import { getPublishedPosts, getPublicCategories } from '@/server/blog'
import { getServerSession } from '@/server/session'
import { CaretLeft, CaretRight, CalendarBlank } from '@phosphor-icons/react'
import { format } from 'date-fns'

export const Route = createFileRoute('/blog/')({
  loader: async () => {
    const [postsData, categories, session] = await Promise.all([
      getPublishedPosts({ data: { limit: 12, offset: 0 } }),
      getPublicCategories(),
      getServerSession(),
    ])
    return { postsData, categories, session }
  },
  component: BlogListingPage,
})

function BlogListingPage() {
  const { postsData: initialData, categories, session } = Route.useLoaderData()
  const router = useRouter()

  const [posts, setPosts] = useState(initialData.posts)
  const [total, setTotal] = useState(initialData.total)
  const [offset, setOffset] = useState(0)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const limit = 12

  const fetchPosts = async (
    newOffset: number,
    categorySlug?: string | null,
  ) => {
    setLoading(true)
    try {
      const data = await getPublishedPosts({
        data: {
          limit,
          offset: newOffset,
          categorySlug: categorySlug ?? undefined,
        },
      })
      setPosts(data.posts)
      setTotal(data.total)
      setOffset(newOffset)
    } finally {
      setLoading(false)
    }
  }

  const handleCategoryFilter = (slug: string | null) => {
    setActiveCategory(slug)
    fetchPosts(0, slug)
  }

  return (
    <div className="min-h-screen bg-gradient-page">
      {/* Header */}
      <header className="bg-slate-900 text-white">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link to="/">
            <LoonaBrand size="sm" variant="white" animated={false} />
          </Link>
          {session ? (
            <Link
              to="/dashboard"
              className="text-sm text-slate-300 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              to="/login"
              className="text-sm text-slate-300 hover:text-white transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-12">
        {/* Title */}
        <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Loona Blog</h1>
          <p className="text-muted-foreground text-lg">
            Updates, tips, and insights about lending and financial monitoring
          </p>
        </div>

        {/* Category pills */}
        {categories.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-10 animate-in fade-in slide-in-from-bottom-3 duration-500 delay-150">
            <button
              type="button"
              onClick={() => handleCategoryFilter(null)}
              className={`px-3.5 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                activeCategory === null
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/50'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryFilter(cat.slug)}
                className={`px-3.5 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                  activeCategory === cat.slug
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Post grid */}
        {posts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">
              No posts published yet. Check back soon!
            </p>
          </div>
        ) : (
          <div
            className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 transition-opacity duration-300 ${loading ? 'opacity-50' : ''}`}
          >
            {posts.map((post, i) => (
              <Link
                key={post.id}
                to="/blog/$slug"
                params={{ slug: post.slug }}
                className="group block animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
                style={{ animationDelay: `${200 + i * 75}ms` }}
              >
                <article className="h-full bg-card border rounded-xl p-5 transition-all hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5">
                  {post.category && (
                    <Badge variant="secondary" className="mb-3">
                      {post.category.name}
                    </Badge>
                  )}
                  <h2 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-2">
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                      {post.excerpt}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto">
                    <span className="flex items-center gap-1">
                      <CalendarBlank className="h-3.5 w-3.5" />
                      {post.publishedAt
                        ? format(new Date(post.publishedAt), 'MMM d, yyyy')
                        : format(new Date(post.createdAt), 'MMM d, yyyy')}
                    </span>
                    {post.author && <span>by {post.author.name}</span>}
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-center gap-3 mt-10">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0 || loading}
              onClick={() =>
                fetchPosts(Math.max(0, offset - limit), activeCategory)
              }
            >
              <CaretLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {Math.floor(offset / limit) + 1} of{' '}
              {Math.ceil(total / limit)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + limit >= total || loading}
              onClick={() => fetchPosts(offset + limit, activeCategory)}
            >
              Next
              <CaretRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Loona. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
