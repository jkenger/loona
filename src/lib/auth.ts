import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin } from "better-auth/plugins"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import { db } from "./db"
import * as schema from "./db/schema"
import { sendEmail, passwordResetEmail, welcomeEmail } from "./email"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const emailContent = welcomeEmail(user.name || 'there')
          sendEmail({ to: user.email, ...emailContent }).catch((err) => {
            console.error('[Email] Welcome email failed for', user.email, err)
          })
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    resetPasswordTokenExpiresIn: 3600, // 1 hour — must match passwordResetEmail template text
    sendResetPassword: async ({ user, url }) => {
      try {
        const emailContent = passwordResetEmail({
          name: user.name || 'User',
          resetUrl: url,
        })
        await sendEmail({
          to: user.email,
          ...emailContent,
        })
      } catch (err) {
        console.error('[Email] Password reset failed for', user.email, err)
      }
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "lender",
        input: false,
      },
      hasCompletedOnboarding: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  plugins: [
    admin({ defaultRole: "lender", adminRoles: ["admin"] }),
    tanstackStartCookies(), // Must be last plugin
  ],
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
