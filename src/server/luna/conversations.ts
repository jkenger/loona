import { createServerFn } from "@tanstack/react-start"
import { db, lunaConversations, lunaMessages } from "@/lib/db"
import { eq, desc, and } from "drizzle-orm"
import { requireAuth } from "../session"
import { z } from "zod"

export const getConversations = createServerFn().handler(async () => {
  const session = await requireAuth()

  return db
    .select({
      id: lunaConversations.id,
      title: lunaConversations.title,
      lastMessageAt: lunaConversations.lastMessageAt,
      createdAt: lunaConversations.createdAt,
    })
    .from(lunaConversations)
    .where(eq(lunaConversations.lenderId, session.user.id))
    .orderBy(desc(lunaConversations.lastMessageAt))
    .limit(50)
})

export const getConversation = createServerFn()
  .inputValidator(z.object({ conversationId: z.string() }))
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const [conversation] = await db
      .select()
      .from(lunaConversations)
      .where(
        and(
          eq(lunaConversations.id, data.conversationId),
          eq(lunaConversations.lenderId, session.user.id),
        ),
      )

    if (!conversation) throw new Error("Conversation not found")

    const messages = await db
      .select()
      .from(lunaMessages)
      .where(eq(lunaMessages.conversationId, data.conversationId))
      .orderBy(lunaMessages.createdAt)

    return { conversation, messages }
  })

export const createConversation = createServerFn()
  .inputValidator(z.object({ title: z.string().optional() }))
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const [conversation] = await db
      .insert(lunaConversations)
      .values({
        lenderId: session.user.id,
        title: data.title ?? null,
      })
      .returning()

    return conversation
  })

export const deleteConversation = createServerFn()
  .inputValidator(z.object({ conversationId: z.string() }))
  .handler(async ({ data }) => {
    const session = await requireAuth()

    await db
      .delete(lunaConversations)
      .where(
        and(
          eq(lunaConversations.id, data.conversationId),
          eq(lunaConversations.lenderId, session.user.id),
        ),
      )

    return { success: true }
  })

export const updateConversationTitle = createServerFn()
  .inputValidator(z.object({ conversationId: z.string(), title: z.string() }))
  .handler(async ({ data }) => {
    const session = await requireAuth()

    await db
      .update(lunaConversations)
      .set({ title: data.title })
      .where(
        and(
          eq(lunaConversations.id, data.conversationId),
          eq(lunaConversations.lenderId, session.user.id),
        ),
      )

    return { success: true }
  })
