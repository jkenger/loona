import { createAuthClient } from "better-auth/react"
import { adminClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  // No baseURL - uses current origin automatically (works for any deployment)
  plugins: [adminClient()],
})

export const {
  signIn,
  signOut,
  useSession,
  getSession,
} = authClient

// Password reset - call API directly since method names vary by version
export async function requestPasswordReset({ email, redirectTo }: { email: string; redirectTo?: string }) {
  const res = await fetch('/api/auth/request-password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, redirectTo }),
  })
  const data = await res.json()
  if (!res.ok) {
    return { error: { message: data.message || 'Failed to send reset email' } }
  }
  return { data }
}

export async function resetPassword({ newPassword, token }: { newPassword: string; token: string }) {
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newPassword, token }),
  })
  const data = await res.json()
  if (!res.ok) {
    return { error: { message: data.message || 'Failed to reset password' } }
  }
  return { data }
}

export async function changePassword({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) {
  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  const data = await res.json()
  if (!res.ok) {
    return { error: { message: data.message || 'Failed to change password' } }
  }
  return { data }
}

export async function updateUserName({ name }: { name: string }) {
  const res = await fetch('/api/auth/update-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  const data = await res.json()
  if (!res.ok) {
    return { error: { message: data.message || 'Failed to update profile' } }
  }
  return { data }
}
