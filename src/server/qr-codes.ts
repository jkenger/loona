import { createServerFn } from "@tanstack/react-start"
import { db, lenderQrCodes } from "@/lib/db"
import { eq, and, asc } from "drizzle-orm"
import { requireAuth } from "./session"
import { z } from "zod"

export const getQrCodes = createServerFn().handler(async () => {
  const session = await requireAuth()
  return db.query.lenderQrCodes.findMany({
    where: eq(lenderQrCodes.lenderId, session.user.id),
    orderBy: asc(lenderQrCodes.sortOrder),
  })
})

const qrCodeInputSchema = z.object({
  label: z.string().min(1).max(50),
  imageData: z.string().min(1),
  showInEmails: z.boolean(),
  showInProfile: z.boolean(),
})

export const saveQrCode = createServerFn()
  .inputValidator(qrCodeInputSchema)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    // Get current max sort order
    const existing = await db.query.lenderQrCodes.findMany({
      where: eq(lenderQrCodes.lenderId, session.user.id),
      orderBy: asc(lenderQrCodes.sortOrder),
    })
    const sortOrder = existing.length

    const [created] = await db.insert(lenderQrCodes).values({
      lenderId: session.user.id,
      label: data.label,
      imageData: data.imageData,
      showInEmails: data.showInEmails,
      showInProfile: data.showInProfile,
      sortOrder,
    }).returning()

    return created
  })

const updateQrCodeSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(50),
  showInEmails: z.boolean(),
  showInProfile: z.boolean(),
})

export const updateQrCode = createServerFn()
  .inputValidator(updateQrCodeSchema)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await db.update(lenderQrCodes)
      .set({ label: data.label, showInEmails: data.showInEmails, showInProfile: data.showInProfile, updatedAt: new Date() })
      .where(and(eq(lenderQrCodes.id, data.id), eq(lenderQrCodes.lenderId, session.user.id)))
  })

export const deleteQrCode = createServerFn()
  .inputValidator(z.string())
  .handler(async ({ data: id }) => {
    const session = await requireAuth()
    await db.delete(lenderQrCodes)
      .where(and(eq(lenderQrCodes.id, id), eq(lenderQrCodes.lenderId, session.user.id)))
  })

export const reorderQrCodes = createServerFn()
  .inputValidator(z.array(z.string()))
  .handler(async ({ data: orderedIds }) => {
    const session = await requireAuth()
    await Promise.all(
      orderedIds.map((id, index) =>
        db.update(lenderQrCodes)
          .set({ sortOrder: index, updatedAt: new Date() })
          .where(and(eq(lenderQrCodes.id, id), eq(lenderQrCodes.lenderId, session.user.id)))
      )
    )
  })

// Public — fetch QR codes for a lender by lender ID (for share page)
export async function getPublicQrCodesForLender(lenderId: string) {
  return db.query.lenderQrCodes.findMany({
    where: and(eq(lenderQrCodes.lenderId, lenderId), eq(lenderQrCodes.showInProfile, true)),
    orderBy: asc(lenderQrCodes.sortOrder),
  })
}

// Internal — fetch email QR codes for a lender (for cron email sends)
export async function getEmailQrCodesForLender(lenderId: string) {
  return db.query.lenderQrCodes.findMany({
    where: and(eq(lenderQrCodes.lenderId, lenderId), eq(lenderQrCodes.showInEmails, true)),
    orderBy: asc(lenderQrCodes.sortOrder),
  })
}
