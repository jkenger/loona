import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { db, loanApplications, user } from "@/lib/db"
import { eq, and, desc } from "drizzle-orm"
import { requireAuth } from "./session"

// ============================================================================
// Generate application link (lender only)
// ============================================================================

export const getApplicationFormToken = createServerFn().handler(async () => {
  const session = await requireAuth()
  const lenderId = session.user.id

  // Check if lender already has a token (reuse it)
  const existing = await db.query.loanApplications.findFirst({
    where: eq(loanApplications.lenderId, lenderId),
    orderBy: desc(loanApplications.createdAt),
  })

  // Return the lender's formToken prefix — we use lenderId as the token for simplicity
  // This way each lender has a stable shareable link
  return { token: lenderId }
})

// ============================================================================
// Get lender info for public form (no auth)
// ============================================================================

export const getApplicationFormInfo = createServerFn()
  .inputValidator(z.string())
  .handler(async ({ data: lenderId }) => {
    const lender = await db.query.user.findFirst({
      where: eq(user.id, lenderId),
    })

    if (!lender) return null

    return {
      lenderName: lender.name,
      lenderImage: lender.image,
    }
  })

// ============================================================================
// Submit application (public, no auth)
// ============================================================================

const submitApplicationSchema = z.object({
  lenderId: z.string().min(1),
  applicantName: z.string().min(2, "Name is required"),
  applicantPhone: z.string().optional(),
  applicantEmail: z.string().email("Valid email required"),
  applicantAddress: z.string().optional(),
  applicantCity: z.string().optional(),
  requestedAmount: z.number().positive("Amount must be positive"),
  requestedTermMonths: z.number().int().positive().optional(),
  purpose: z.string().optional(),
  monthlyIncome: z.number().min(0).optional(),
  otherIncome: z.number().min(0).optional(),
})

// Simple in-memory rate limit: max 3 applications per IP per day
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 3
const RATE_WINDOW = 24 * 60 * 60 * 1000 // 24 hours

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

export const submitLoanApplication = createServerFn()
  .inputValidator(submitApplicationSchema)
  .handler(async ({ data, context }) => {
    // Rate limit by IP
    const ip = (context as any)?.request?.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim()
      ?? (context as any)?.request?.headers?.get?.("x-real-ip")
      ?? "unknown"
    if (!checkRateLimit(ip)) {
      throw new Error("Too many applications. Please try again later.")
    }

    // Verify lender exists
    const lender = await db.query.user.findFirst({
      where: eq(user.id, data.lenderId),
    })
    if (!lender) throw new Error("Invalid application link")

    // Prevent duplicate pending applications from the same email
    if (data.applicantEmail) {
      const existing = await db.query.loanApplications.findFirst({
        where: and(
          eq(loanApplications.lenderId, data.lenderId),
          eq(loanApplications.applicantEmail, data.applicantEmail.toLowerCase()),
          eq(loanApplications.status, "pending"),
        ),
      })
      if (existing) {
        throw new Error("You already have a pending application. Please wait for it to be reviewed.")
      }
    }

    const id = crypto.randomUUID()

    await db.insert(loanApplications).values({
      id,
      lenderId: data.lenderId,
      applicantName: data.applicantName,
      applicantPhone: data.applicantPhone || null,
      applicantEmail: data.applicantEmail || null,
      applicantAddress: data.applicantAddress || null,
      applicantCity: data.applicantCity || null,
      requestedAmount: data.requestedAmount.toFixed(2),
      requestedTermMonths: data.requestedTermMonths || null,
      purpose: data.purpose || null,
      monthlyIncome: data.monthlyIncome?.toFixed(2) ?? null,
      otherIncome: data.otherIncome?.toFixed(2) ?? null,
      formToken: id, // unique per application
    })

    return { success: true, applicationId: id }
  })

// ============================================================================
// Get applications (lender only)
// ============================================================================

export const getLoanApplications = createServerFn().handler(async () => {
  const session = await requireAuth()

  const applications = await db.query.loanApplications.findMany({
    where: eq(loanApplications.lenderId, session.user.id),
    orderBy: desc(loanApplications.createdAt),
  })

  return applications.map((app) => ({
    ...app,
    requestedAmount: app.requestedAmount,
    monthlyIncome: app.monthlyIncome,
    otherIncome: app.otherIncome,
    createdAt: app.createdAt.toISOString(),
    reviewedAt: app.reviewedAt?.toISOString() ?? null,
  }))
})

// ============================================================================
// Review application (approve/reject, lender only)
// ============================================================================

const reviewSchema = z.object({
  applicationId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().optional(),
})

export const reviewLoanApplication = createServerFn()
  .inputValidator(reviewSchema)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const app = await db.query.loanApplications.findFirst({
      where: and(
        eq(loanApplications.id, data.applicationId),
        eq(loanApplications.lenderId, session.user.id),
      ),
    })

    if (!app) throw new Error("Application not found")
    if (app.status !== "pending") throw new Error("Application already reviewed")

    if (data.action === "reject") {
      await db.update(loanApplications).set({
        status: "rejected",
        rejectionReason: data.rejectionReason || null,
        reviewedAt: new Date(),
      }).where(eq(loanApplications.id, data.applicationId))

      return { success: true, action: "rejected" }
    }

    // Approve — mark as approved (lender will create the loan manually via wizard)
    await db.update(loanApplications).set({
      status: "approved",
      reviewedAt: new Date(),
    }).where(eq(loanApplications.id, data.applicationId))

    return {
      success: true,
      action: "approved",
      applicant: {
        name: app.applicantName,
        phone: app.applicantPhone,
        email: app.applicantEmail,
        address: app.applicantAddress,
        city: app.applicantCity,
        requestedAmount: app.requestedAmount,
        requestedTermMonths: app.requestedTermMonths,
        purpose: app.purpose,
        monthlyIncome: app.monthlyIncome,
        otherIncome: app.otherIncome,
      },
    }
  })

// ============================================================================
// Revert application back to pending (undo approve/reject)
// ============================================================================

export const revertLoanApplication = createServerFn()
  .inputValidator(z.string())
  .handler(async ({ data: applicationId }) => {
    const session = await requireAuth()

    const app = await db.query.loanApplications.findFirst({
      where: and(
        eq(loanApplications.id, applicationId),
        eq(loanApplications.lenderId, session.user.id),
      ),
    })

    if (!app) throw new Error("Application not found")
    if (app.status === "pending") throw new Error("Application is already pending")

    await db.update(loanApplications).set({
      status: "pending",
      reviewedAt: null,
      rejectionReason: null,
    }).where(eq(loanApplications.id, applicationId))

    return { success: true }
  })
