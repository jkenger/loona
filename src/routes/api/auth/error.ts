import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/auth/error')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url)
        const error = url.searchParams.get('error') || 'unknown'
        return new Response(null, {
          status: 302,
          headers: { location: `/login?error=${encodeURIComponent(error)}` },
        })
      },
    },
  },
})
