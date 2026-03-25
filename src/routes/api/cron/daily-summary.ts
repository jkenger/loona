import { createFileRoute } from '@tanstack/react-router'
import { sendDailySummaries } from '@/server/daily-summary'

export const Route = createFileRoute('/api/cron/daily-summary')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const cronSecret = process.env.CRON_SECRET
        if (!cronSecret) {
          return new Response(
            JSON.stringify({ error: 'CRON_SECRET not configured' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }

        const headerSecret = request.headers.get('X-Cron-Secret')
        if (headerSecret !== cronSecret) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } },
          )
        }

        const result = await sendDailySummaries()

        return new Response(
          JSON.stringify({ success: true, ...result, timestamp: new Date().toISOString() }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      },
    },
  },
})
