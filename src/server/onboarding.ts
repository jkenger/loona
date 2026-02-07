import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"
import { requireAuth } from "@/server/session"

/**
 * Mark the current user's onboarding as complete
 */
export const completeOnboarding = createServerFn().handler(async () => {
  const session = await requireAuth()

  await db
    .update(user)
    .set({ hasCompletedOnboarding: true })
    .where(eq(user.id, session.user.id))

  return { success: true }
})

/**
 * Check onboarding status directly from DB (bypasses session cookie cache)
 */
export const getOnboardingStatus = createServerFn().handler(async () => {
  const session = await requireAuth()

  const result = await db
    .select({ hasCompletedOnboarding: user.hasCompletedOnboarding })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  return result[0]?.hasCompletedOnboarding ?? false
})
