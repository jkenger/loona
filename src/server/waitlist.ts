import { createServerFn } from "@tanstack/react-start"
import { db, waitlist } from "@/lib/db"
import { z } from "zod"

const joinWaitlistSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
})

export const joinWaitlist = createServerFn()
  .inputValidator(joinWaitlistSchema)
  .handler(async ({ data }) => {
    await db.insert(waitlist).values({ email: data.email }).onConflictDoNothing()
    return { success: true }
  })
