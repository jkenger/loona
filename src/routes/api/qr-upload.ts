import { createFileRoute } from '@tanstack/react-router'
import { db, lenderQrCodes } from '@/lib/db'
import { eq, asc } from 'drizzle-orm'
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

        const form = await request.formData()
        const imageFile = form.get('image') as File | null
        const label = (form.get('label') as string | null)?.trim()
        const showInEmails = form.get('showInEmails') === 'true'
        const showInProfile = form.get('showInProfile') === 'true'

        if (!imageFile || !label) {
          return new Response(JSON.stringify({ error: 'Missing fields' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // Convert blob to base64 data URI for storage
        const arrayBuffer = await imageFile.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString('base64')
        const imageData = `data:${imageFile.type};base64,${base64}`

        const existing = await db.query.lenderQrCodes.findMany({
          where: eq(lenderQrCodes.lenderId, session.user.id),
          orderBy: asc(lenderQrCodes.sortOrder),
        })

        const [created] = await db.insert(lenderQrCodes).values({
          lenderId: session.user.id,
          label,
          imageData,
          showInEmails,
          showInProfile,
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
