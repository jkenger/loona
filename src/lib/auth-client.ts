import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  // No baseURL - uses current origin automatically (works for any deployment)
})

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  forgetPassword,
  resetPassword,
} = authClient
