import { createFileRoute } from '@tanstack/react-router'
import { sendAgentActivityDigests } from '@/server/digest'

export const Route = createFileRoute('/api/cron/digest')({
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

        const result = await sendAgentActivityDigests()

        return new Response(
          JSON.stringify({
            success: true,
            lendersNotified: result.lendersNotified,
            totalPayments: result.totalPayments,
            timestamp: new Date().toISOString(),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      },
    },
  },
})
