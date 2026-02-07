let validated = false

export function validateEnv() {
  if (validated) return
  validated = true

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required")
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn("[env] RESEND_API_KEY not set — emails will be skipped")
  }

  if (!process.env.FROM_EMAIL || process.env.FROM_EMAIL.includes("resend.dev")) {
    console.warn("[env] FROM_EMAIL not set or using Resend test domain — verify your domain at resend.com/domains")
  }

  if (!process.env.BETTER_AUTH_URL) {
    console.warn("[env] BETTER_AUTH_URL not set — defaulting to https://loona.app")
  }
}
