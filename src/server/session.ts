import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { auth } from "@/lib/auth"

/**
 * Get the current session from request headers
 * Use this in server functions to authenticate requests
 */
export const getServerSession = createServerFn().handler(async () => {
  const headers = getRequestHeaders()
  if (!headers) return null

  const session = await auth.api.getSession({ headers: new Headers(headers) })
  return session
})

/**
 * Require authentication - throws if no session
 */
export const requireAuth = async () => {
  const session = await getServerSession()
  if (!session) {
    throw new Error("Unauthorized")
  }
  return session
}
