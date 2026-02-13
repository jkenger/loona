import { createFileRoute } from '@tanstack/react-router'
import { db, blogPosts } from '@/lib/db'
import { eq, desc } from 'drizzle-orm'
import { SITE_URL } from '@/lib/constants/seo'

export const Route = createFileRoute('/api/sitemap')({
  server: {
    handlers: {
      GET: async () => {
        const staticRoutes = [
          { loc: '/', priority: '1.0', changefreq: 'weekly' },
          { loc: '/blog', priority: '0.8', changefreq: 'daily' },
          { loc: '/privacy', priority: '0.3', changefreq: 'monthly' },
          { loc: '/terms', priority: '0.3', changefreq: 'monthly' },
          { loc: '/login', priority: '0.4', changefreq: 'monthly' },
        ]

        const posts = await db.query.blogPosts.findMany({
          where: eq(blogPosts.status, 'published'),
          columns: { slug: true, updatedAt: true },
          orderBy: [desc(blogPosts.publishedAt)],
        })

        const urls = staticRoutes
          .map(
            (r) => `  <url>
    <loc>${SITE_URL}${r.loc}</loc>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`,
          )
          .concat(
            posts.map(
              (p) => `  <url>
    <loc>${SITE_URL}/blog/${p.slug}</loc>
    <lastmod>${p.updatedAt.toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`,
            ),
          )

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

        return new Response(xml, {
          status: 200,
          headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})
