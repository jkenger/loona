import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { db, documentSignatures, loans } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { requireAuth } from "./session"
import { z } from "zod"
import { createHash } from "crypto"
import { sendEmail, signingOtpEmail } from "@/lib/email"

const OTP_EXPIRY_MINUTES = 10
const OTP_MAX_ATTEMPTS = 5
const OTP_MAX_SENDS = 5

function generateOtp(): string {
  // 6-digit cryptographically random code
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return String(100000 + (buf[0] % 900000))
}

function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex")
}

function getClientInfo() {
  let ipAddress: string | null = null
  let userAgent: string | null = null
  try {
    const headers = getRequestHeaders()
    if (headers) {
      ipAddress =
        headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
        headers["x-real-ip"] ??
        null
      userAgent = headers["user-agent"] ?? null
    }
  } catch {
    // Ignore
  }
  return { ipAddress, userAgent }
}

// ============================================================================
// Authenticated (lender-only) endpoints
// ============================================================================

const getDocumentSignaturesSchema = z.object({
  loanId: z.string().min(1),
  documentType: z.enum(["disclosure", "promissory_note"]),
})

export const getDocumentSignatures = createServerFn()
  .inputValidator(getDocumentSignaturesSchema)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, data.loanId),
    })
    if (!loan || loan.lenderId !== session.user.id) {
      throw new Error("Loan not found")
    }

    const signatures = await db.query.documentSignatures.findMany({
      where: and(
        eq(documentSignatures.loanId, data.loanId),
        eq(documentSignatures.documentType, data.documentType),
      ),
    })

    return signatures.map((s) => ({
      ...s,
      signedAt: s.signedAt?.toISOString() ?? null,
      otpVerifiedAt: s.otpVerifiedAt?.toISOString() ?? null,
      otpExpiresAt: s.otpExpiresAt?.toISOString() ?? null,
      tokenUsedAt: s.tokenUsedAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
    }))
  })

const generateSigningLinkSchema = z.object({
  loanId: z.string().min(1),
  documentType: z.enum(["disclosure", "promissory_note"]),
  signerRole: z.enum(["borrower", "co_maker", "lender"]),
  docStyle: z.enum(["full", "simple"]).optional(),
})

export const generateSigningLink = createServerFn()
  .inputValidator(generateSigningLinkSchema)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, data.loanId),
      with: { contact: true },
    })
    if (!loan || loan.lenderId !== session.user.id) {
      throw new Error("Loan not found")
    }

    const signerName =
      data.signerRole === "borrower"
        ? loan.contact.name
        : data.signerRole === "co_maker"
          ? loan.coMakerName ?? "Co-maker"
          : session.user.name

    const signerEmail =
      data.signerRole === "borrower"
        ? loan.contact.email
        : data.signerRole === "co_maker"
          ? loan.coMakerEmail
          : session.user.email

    // Check for existing record for same loan+doc+role
    const existing = await db.query.documentSignatures.findFirst({
      where: and(
        eq(documentSignatures.loanId, data.loanId),
        eq(documentSignatures.documentType, data.documentType),
        eq(documentSignatures.signerRole, data.signerRole),
      ),
    })

    if (existing && existing.signingToken && !existing.otpVerifiedAt) {
      // Reuse existing token — update docStyle if changed
      if (data.docStyle && existing.docStyle !== data.docStyle) {
        await db.update(documentSignatures)
          .set({ docStyle: data.docStyle })
          .where(eq(documentSignatures.id, existing.id))
      }
      return { token: existing.signingToken }
    }

    if (existing && existing.otpVerifiedAt) {
      // Already signed — delete old so signer can re-sign
      await db.delete(documentSignatures).where(eq(documentSignatures.id, existing.id))
    }

    const token = crypto.randomUUID()

    await db.insert(documentSignatures).values({
      loanId: data.loanId,
      documentType: data.documentType,
      signerRole: data.signerRole,
      signerName,
      signerEmail,
      signingToken: token,
      docStyle: data.docStyle ?? null,
    })

    return { token }
  })

const deleteSignatureSchema = z.object({
  signatureId: z.string().min(1),
})

export const deleteSignature = createServerFn()
  .inputValidator(deleteSignatureSchema)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const sig = await db.query.documentSignatures.findFirst({
      where: eq(documentSignatures.id, data.signatureId),
      with: { loan: true },
    })

    if (!sig || sig.loan.lenderId !== session.user.id) {
      throw new Error("Signature not found")
    }

    await db.delete(documentSignatures).where(eq(documentSignatures.id, data.signatureId))
    return { success: true }
  })

// Get signing status for all documents of a loan (used in loan detail page)
export const getLoanSigningStatus = createServerFn()
  .inputValidator(z.string().min(1))
  .handler(async ({ data: loanId }) => {
    const session = await requireAuth()

    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, loanId),
    })
    if (!loan || loan.lenderId !== session.user.id) {
      throw new Error("Loan not found")
    }

    const signatures = await db.query.documentSignatures.findMany({
      where: eq(documentSignatures.loanId, loanId),
    })

    const getStatus = (docType: "disclosure" | "promissory_note") => {
      const docSigs = signatures.filter((s) => s.documentType === docType)
      const lenderSigned = docSigs.some(
        (s) => s.signerRole === "lender" && s.otpVerifiedAt
      )
      const borrowerSigned = docSigs.some(
        (s) => s.signerRole === "borrower" && s.otpVerifiedAt
      )
      const borrowerPending = docSigs.some(
        (s) => s.signerRole === "borrower" && s.signingToken && !s.otpVerifiedAt
      )

      if (lenderSigned && borrowerSigned) return "signed" as const
      if (lenderSigned && borrowerPending) return "pending" as const
      if (lenderSigned) return "lender_signed" as const
      return "unsigned" as const
    }

    return {
      disclosure: getStatus("disclosure"),
      promissory_note: getStatus("promissory_note"),
    }
  })

// Lender signs their own document via OTP (authenticated)
const initiateLenderOtpSchema = z.object({
  loanId: z.string().min(1),
  documentType: z.enum(["disclosure", "promissory_note"]),
})

export const initiateLenderOtp = createServerFn()
  .inputValidator(initiateLenderOtpSchema)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, data.loanId),
    })
    if (!loan || loan.lenderId !== session.user.id) {
      throw new Error("Loan not found")
    }

    // Find or create lender signature record
    let sig = await db.query.documentSignatures.findFirst({
      where: and(
        eq(documentSignatures.loanId, data.loanId),
        eq(documentSignatures.documentType, data.documentType),
        eq(documentSignatures.signerRole, "lender"),
      ),
    })

    if (sig && sig.otpVerifiedAt) {
      throw new Error("Already signed")
    }

    const code = generateOtp()
    const otpHash = hashOtp(code)
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

    if (sig) {
      if ((sig.otpAttempts ?? 0) >= OTP_MAX_SENDS) {
        throw new Error("Too many OTP requests. Please wait before requesting another.")
      }
      await db.update(documentSignatures)
        .set({ otpHash, otpExpiresAt, otpAttempts: 0 })
        .where(eq(documentSignatures.id, sig.id))
    } else {
      const [created] = await db.insert(documentSignatures).values({
        loanId: data.loanId,
        documentType: data.documentType,
        signerRole: "lender",
        signerName: session.user.name,
        signerEmail: session.user.email,
        otpHash,
        otpExpiresAt,
      }).returning()
      sig = created
    }

    await sendEmail({
      to: session.user.email,
      ...signingOtpEmail({
        signerName: session.user.name,
        documentType: data.documentType,
        otpCode: code,
        expiresInMinutes: OTP_EXPIRY_MINUTES,
      }),
    })

    return { sigId: sig!.id, email: maskEmail(session.user.email) }
  })

const verifyLenderOtpSchema = z.object({
  sigId: z.string().min(1),
  code: z.string().length(6),
})

export const verifyLenderOtp = createServerFn()
  .inputValidator(verifyLenderOtpSchema)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const sig = await db.query.documentSignatures.findFirst({
      where: eq(documentSignatures.id, data.sigId),
      with: { loan: true },
    })

    if (!sig || sig.loan.lenderId !== session.user.id) {
      throw new Error("Invalid request")
    }

    if (sig.otpVerifiedAt) {
      throw new Error("Already signed")
    }

    if ((sig.otpAttempts ?? 0) >= OTP_MAX_ATTEMPTS) {
      throw new Error("Too many failed attempts. Please request a new code.")
    }

    if (!sig.otpHash || !sig.otpExpiresAt || sig.otpExpiresAt < new Date()) {
      throw new Error("Code has expired. Please request a new code.")
    }

    const inputHash = hashOtp(data.code)
    if (inputHash !== sig.otpHash) {
      await db.update(documentSignatures)
        .set({ otpAttempts: (sig.otpAttempts ?? 0) + 1 })
        .where(eq(documentSignatures.id, sig.id))
      const remaining = OTP_MAX_ATTEMPTS - (sig.otpAttempts ?? 0) - 1
      throw new Error(`Invalid code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`)
    }

    const { ipAddress, userAgent } = getClientInfo()
    const now = new Date()

    await db.update(documentSignatures)
      .set({ otpVerifiedAt: now, signedAt: now, ipAddress, userAgent, otpHash: null })
      .where(eq(documentSignatures.id, sig.id))

    return { success: true }
  })

// ============================================================================
// Public (no auth) endpoints
// ============================================================================

export const getSigningDocument = createServerFn()
  .inputValidator(z.string().min(1))
  .handler(async ({ data: token }) => {
    const sig = await db.query.documentSignatures.findFirst({
      where: eq(documentSignatures.signingToken, token),
    })

    if (!sig) {
      return { error: "invalid" as const }
    }

    if (sig.otpVerifiedAt) {
      return { error: "already_signed" as const }
    }

    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, sig.loanId),
      with: {
        contact: true,
        lender: true,
        schedule: true,
      },
    })

    if (!loan) {
      return { error: "invalid" as const }
    }

    // Mark token as first opened
    if (!sig.tokenUsedAt) {
      await db.update(documentSignatures)
        .set({ tokenUsedAt: new Date() })
        .where(eq(documentSignatures.id, sig.id))
    }

    // Get co-maker signing status for this document
    const coMakerSig = await db.query.documentSignatures.findFirst({
      where: and(
        eq(documentSignatures.loanId, sig.loanId),
        eq(documentSignatures.documentType, sig.documentType),
        eq(documentSignatures.signerRole, "co_maker"),
      ),
    })

    return {
      error: null,
      sigId: sig.id,
      documentType: sig.documentType,
      signerRole: sig.signerRole,
      signerName: sig.signerName,
      signerEmail: sig.signerEmail ? maskEmail(sig.signerEmail) : null,
      docStyle: (sig.docStyle as "full" | "simple" | null) ?? "full",
      loan: {
        id: loan.id,
        principal: loan.principal,
        interestRate: loan.interestRate,
        termMonths: loan.termMonths,
        paymentFrequency: loan.paymentFrequency,
        paymentAmount: loan.paymentAmount,
        totalToRepay: loan.totalToRepay,
        startDate: loan.startDate?.toISOString() ?? null,
        maturityDate: loan.maturityDate?.toISOString() ?? null,
        collateralDescription: loan.collateralDescription,
        coMakerName: loan.coMakerName,
        coMakerEmail: loan.coMakerEmail,
        coMakerPhone: loan.coMakerPhone,
        coMakerRelationship: loan.coMakerRelationship,
        penaltyConfig: loan.penaltyConfig,
        customClauses: loan.customClauses,
        processingFeePercent: loan.processingFeePercent,
        contact: {
          name: loan.contact.name,
          address: loan.contact.address,
          city: loan.contact.city,
          phone: loan.contact.phone,
        },
        lenderName: loan.lender.name,
        schedule: loan.schedule.map((s) => ({
          id: s.id,
          dueDate: s.dueDate.toISOString(),
          amount: s.amount,
          status: s.status,
        })),
      },
      coMakerSigned: !!(coMakerSig?.otpVerifiedAt),
    }
  })

// Send OTP to the signer (public — no auth)
const initiatePublicOtpSchema = z.object({
  token: z.string().min(1),
})

export const initiatePublicOtp = createServerFn()
  .inputValidator(initiatePublicOtpSchema)
  .handler(async ({ data }) => {
    const sig = await db.query.documentSignatures.findFirst({
      where: eq(documentSignatures.signingToken, data.token),
    })

    if (!sig) throw new Error("Invalid signing link")
    if (sig.otpVerifiedAt) throw new Error("This document has already been signed")
    if (!sig.signerEmail) throw new Error("No email address on file for this signer")

    if ((sig.otpAttempts ?? 0) >= OTP_MAX_SENDS) {
      throw new Error("Too many OTP requests. Please contact your lender.")
    }

    const code = generateOtp()
    const otpHash = hashOtp(code)
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

    await db.update(documentSignatures)
      .set({ otpHash, otpExpiresAt, otpAttempts: 0 })
      .where(eq(documentSignatures.id, sig.id))

    await sendEmail({
      to: sig.signerEmail,
      ...signingOtpEmail({
        signerName: sig.signerName,
        documentType: sig.documentType,
        otpCode: code,
        expiresInMinutes: OTP_EXPIRY_MINUTES,
      }),
    })

    return { email: maskEmail(sig.signerEmail) }
  })

// Verify OTP and mark document as signed (public — no auth)
const verifyPublicOtpSchema = z.object({
  token: z.string().min(1),
  code: z.string().length(6),
})

export const verifyPublicOtp = createServerFn()
  .inputValidator(verifyPublicOtpSchema)
  .handler(async ({ data }) => {
    const sig = await db.query.documentSignatures.findFirst({
      where: eq(documentSignatures.signingToken, data.token),
    })

    if (!sig) throw new Error("Invalid signing link")
    if (sig.otpVerifiedAt) throw new Error("This document has already been signed")

    if ((sig.otpAttempts ?? 0) >= OTP_MAX_ATTEMPTS) {
      throw new Error("Too many failed attempts. Please request a new code.")
    }

    if (!sig.otpHash || !sig.otpExpiresAt || sig.otpExpiresAt < new Date()) {
      throw new Error("Code has expired. Please request a new code.")
    }

    const inputHash = hashOtp(data.code)
    if (inputHash !== sig.otpHash) {
      await db.update(documentSignatures)
        .set({ otpAttempts: (sig.otpAttempts ?? 0) + 1 })
        .where(eq(documentSignatures.id, sig.id))
      const remaining = OTP_MAX_ATTEMPTS - (sig.otpAttempts ?? 0) - 1
      throw new Error(`Invalid code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`)
    }

    const { ipAddress, userAgent } = getClientInfo()
    const now = new Date()

    await db.update(documentSignatures)
      .set({ otpVerifiedAt: now, signedAt: now, ipAddress, userAgent, otpHash: null })
      .where(eq(documentSignatures.id, sig.id))

    return { success: true, signedAt: now.toISOString() }
  })

// ============================================================================
// Helpers
// ============================================================================

function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  if (!domain) return email
  const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1)
  return `${visible}***@${domain}`
}
