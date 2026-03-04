import { createServerFn } from "@tanstack/react-start"
import { db, advisors, advisorConversations, advisorMessages } from "@/lib/db"
import { eq, desc, and } from "drizzle-orm"
import { requireAuth } from "./session"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { z } from "zod"

const requireLender = async () => {
  const session = await requireAuth()
  if (!hasRole(session.user.role, ROLES.LENDER)) throw new Error("Forbidden")
  return session
}

export const getOrCreateAdvisor = createServerFn().handler(async () => {
  const session = await requireLender()
  const userId = session.user.id

  const existing = await db.query.advisors.findFirst({
    where: eq(advisors.lenderId, userId),
  })
  if (existing) return existing

  const [created] = await db
    .insert(advisors)
    .values({ lenderId: userId })
    .returning()
  return created
})

export const getConversations = createServerFn().handler(async () => {
  const session = await requireLender()

  const convos = await db.query.advisorConversations.findMany({
    where: eq(advisorConversations.lenderId, session.user.id),
    orderBy: [desc(advisorConversations.updatedAt)],
    with: {
      messages: {
        orderBy: [desc(advisorMessages.createdAt)],
        limit: 1,
      },
    },
  })

  return convos.map((c) => ({
    id: c.id,
    title: c.title,
    lastMessage: c.messages[0]?.content?.slice(0, 100) ?? null,
    updatedAt: c.updatedAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
  }))
})

export const getConversation = createServerFn()
  .inputValidator(z.string())
  .handler(async ({ data: id }) => {
    const session = await requireLender()

    const convo = await db.query.advisorConversations.findFirst({
      where: and(
        eq(advisorConversations.id, id),
        eq(advisorConversations.lenderId, session.user.id)
      ),
      with: {
        messages: {
          orderBy: [advisorMessages.createdAt],
        },
      },
    })
    if (!convo) throw new Error("Conversation not found")

    return {
      id: convo.id,
      title: convo.title,
      messages: convo.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        metadata: m.metadata,
        createdAt: m.createdAt.toISOString(),
      })),
    }
  })

export const createConversation = createServerFn()
  .inputValidator(z.object({ advisorId: z.string() }))
  .handler(async ({ data }) => {
    const session = await requireLender()

    // Verify advisor ownership
    const advisor = await db.query.advisors.findFirst({
      where: and(
        eq(advisors.id, data.advisorId),
        eq(advisors.lenderId, session.user.id)
      ),
    })
    if (!advisor) throw new Error("Advisor not found")

    const [convo] = await db
      .insert(advisorConversations)
      .values({
        advisorId: data.advisorId,
        lenderId: session.user.id,
      })
      .returning()

    return { id: convo.id, title: convo.title }
  })

export const deleteConversation = createServerFn()
  .inputValidator(z.string())
  .handler(async ({ data: id }) => {
    const session = await requireLender()

    const convo = await db.query.advisorConversations.findFirst({
      where: and(
        eq(advisorConversations.id, id),
        eq(advisorConversations.lenderId, session.user.id)
      ),
    })
    if (!convo) throw new Error("Conversation not found")

    await db.delete(advisorConversations).where(eq(advisorConversations.id, id))
    return { success: true }
  })

export const updateConversationTitle = createServerFn()
  .inputValidator(z.object({ id: z.string(), title: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    const session = await requireLender()

    const convo = await db.query.advisorConversations.findFirst({
      where: and(
        eq(advisorConversations.id, data.id),
        eq(advisorConversations.lenderId, session.user.id)
      ),
    })
    if (!convo) throw new Error("Conversation not found")

    await db
      .update(advisorConversations)
      .set({ title: data.title, updatedAt: new Date() })
      .where(eq(advisorConversations.id, data.id))

    return { success: true }
  })
