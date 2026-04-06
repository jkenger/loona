import { createFileRoute } from '@tanstack/react-router'
import { db, lenderQrCodes } from '@/lib/db'
import { eq, and, asc } from 'drizzle-orm'
import { getServerSession } from '@/server/session'

export const Route = createFileRoute('/api/qr-upload')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const session = await getServerSession()
        if (!session) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const body = await request.json() as {
          label: string
          imageData: string
          showInEmails: boolean
          showInProfile: boolean
        }

        if (!body.label?.trim() || !body.imageData) {
          return new Response(JSON.stringify({ error: 'Missing fields' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const existing = await db.query.lenderQrCodes.findMany({
          where: eq(lenderQrCodes.lenderId, session.user.id),
          orderBy: asc(lenderQrCodes.sortOrder),
        })

        const [created] = await db.insert(lenderQrCodes).values({
          lenderId: session.user.id,
          label: body.label.trim(),
          imageData: body.imageData,
          showInEmails: body.showInEmails,
          showInProfile: body.showInProfile,
          sortOrder: existing.length,
        }).returning()

        return new Response(JSON.stringify(created), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
