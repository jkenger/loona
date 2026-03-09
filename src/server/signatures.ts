import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { db, documentSignatures, loans } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { requireAuth } from "./session"
import { z } from "zod"

// ============================================================================
// Authenticated (lender-only) endpoints
// ============================================================================

const saveLenderSignatureSchema = z.object({
  loanId: z.string().min(1),
  documentType: z.enum(["disclosure", "promissory_note"]),
  signatureData: z.string().min(1),
})

export const saveLenderSignature = createServerFn()
  .inputValidator(saveLenderSignatureSchema)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, data.loanId),
    })
    if (!loan || loan.lenderId !== session.user.id) {
      throw new Error("Loan not found")
    }

    // Check for existing lender signature
    const existing = await db.query.documentSignatures.findFirst({
      where: and(
        eq(documentSignatures.loanId, data.loanId),
        eq(documentSignatures.documentType, data.documentType),
        eq(documentSignatures.signerRole, "lender"),
      ),
    })

    if (existing) {
      // Update existing
      const [updated] = await db
        .update(documentSignatures)
        .set({
          signatureData: data.signatureData,
          signedAt: new Date(),
          signerName: session.user.name,
        })
        .where(eq(documentSignatures.id, existing.id))
        .returning()
      return updated
    }

    // Create new
    const [created] = await db
      .insert(documentSignatures)
      .values({
        loanId: data.loanId,
        documentType: data.documentType,
        signerRole: "lender",
        signerName: session.user.name,
        signatureData: data.signatureData,
        signedAt: new Date(),
      })
      .returning()
    return created
  })

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
      tokenUsedAt: s.tokenUsedAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
    }))
  })

const generateSigningLinkSchema = z.object({
  loanId: z.string().min(1),
  documentType: z.enum(["disclosure", "promissory_note"]),
  signerRole: z.enum(["borrower", "co_maker"]),
  docStyle: z.enum(["full", "simple"]).optional(),
})

export const generateSigningLink = createServerFn()
  .inputValidator(generateSigningLinkSchema)
  .handler(async ({ data }) => {
    console.log("[generateSigningLink] called with:", JSON.stringify(data))
    const session = await requireAuth()

    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, data.loanId),
      with: { contact: true },
    })
    if (!loan || loan.lenderId !== session.user.id) {
      console.error("[generateSigningLink] loan not found or not owned by user", { loanId: data.loanId, userId: session.user.id })
      throw new Error("Loan not found")
    }

    const signerName =
      data.signerRole === "borrower"
        ? loan.contact.name
        : loan.coMakerName ?? "Co-maker"

    // Check for existing unused token for same loan+doc+role
    const existing = await db.query.documentSignatures.findFirst({
      where: and(
        eq(documentSignatures.loanId, data.loanId),
        eq(documentSignatures.documentType, data.documentType),
        eq(documentSignatures.signerRole, data.signerRole),
      ),
    })

    if (existing && existing.signingToken && !existing.tokenUsedAt) {
      // Update docStyle if changed, then reuse existing token
      if (data.docStyle && existing.docStyle !== data.docStyle) {
        await db.update(documentSignatures)
          .set({ docStyle: data.docStyle })
          .where(eq(documentSignatures.id, existing.id))
      }
      return { token: existing.signingToken }
    }

    if (existing && existing.tokenUsedAt) {
      // Already signed — delete old and create fresh if re-signing needed
      await db.delete(documentSignatures).where(eq(documentSignatures.id, existing.id))
    }

    const token = crypto.randomUUID()

    await db.insert(documentSignatures).values({
      loanId: data.loanId,
      documentType: data.documentType,
      signerRole: data.signerRole,
      signerName,
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
        (s) => s.signerRole === "lender" && s.signatureData
      )
      const borrowerSigned = docSigs.some(
        (s) => s.signerRole === "borrower" && s.signatureData
      )
      const borrowerPending = docSigs.some(
        (s) => s.signerRole === "borrower" && s.signingToken && !s.tokenUsedAt
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

    if (sig.tokenUsedAt) {
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

    // Get all signatures for this document (including lender's)
    const allSignatures = await db.query.documentSignatures.findMany({
      where: and(
        eq(documentSignatures.loanId, sig.loanId),
        eq(documentSignatures.documentType, sig.documentType),
      ),
    })

    return {
      error: null,
      documentType: sig.documentType,
      signerRole: sig.signerRole,
      signerName: sig.signerName,
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
        coMakerPhone: loan.coMakerPhone,
        coMakerRelationship: loan.coMakerRelationship,
        penaltyConfig: loan.penaltyConfig,
        customClauses: loan.customClauses,
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
      signatures: allSignatures
        .filter((s) => s.signatureData)
        .map((s) => ({
          signerRole: s.signerRole,
          signerName: s.signerName,
          signatureData: s.signatureData,
          signedAt: s.signedAt?.toISOString() ?? null,
        })),
    }
  })

const submitBorrowerSignatureSchema = z.object({
  token: z.string().min(1),
  signatureData: z.string().min(1),
  coMakerSignatureData: z.string().optional(), // co-maker signs on the same page
})

export const submitBorrowerSignature = createServerFn()
  .inputValidator(submitBorrowerSignatureSchema)
  .handler(async ({ data }) => {
    const sig = await db.query.documentSignatures.findFirst({
      where: eq(documentSignatures.signingToken, data.token),
    })

    if (!sig) {
      throw new Error("Invalid signing link")
    }

    if (sig.tokenUsedAt) {
      throw new Error("This document has already been signed")
    }

    // Get IP address from request headers
    let ipAddress: string | null = null
    try {
      const headers = getRequestHeaders()
      if (headers) {
        ipAddress =
          headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
          headers["x-real-ip"] ??
          null
      }
    } catch {
      // Ignore header errors
    }

    const now = new Date()

    // Save borrower signature
    await db
      .update(documentSignatures)
      .set({
        signatureData: data.signatureData,
        signedAt: now,
        tokenUsedAt: now,
        ipAddress,
      })
      .where(eq(documentSignatures.id, sig.id))

    // Save co-maker signature if provided
    if (data.coMakerSignatureData) {
      // Look up the loan to get co-maker name
      const loan = await db.query.loans.findFirst({
        where: eq(loans.id, sig.loanId),
      })

      if (loan?.coMakerName) {
        // Upsert co-maker signature
        const existingCoMaker = await db.query.documentSignatures.findFirst({
          where: and(
            eq(documentSignatures.loanId, sig.loanId),
            eq(documentSignatures.documentType, sig.documentType),
            eq(documentSignatures.signerRole, "co_maker"),
          ),
        })

        if (existingCoMaker) {
          await db
            .update(documentSignatures)
            .set({
              signatureData: data.coMakerSignatureData,
              signedAt: now,
              ipAddress,
            })
            .where(eq(documentSignatures.id, existingCoMaker.id))
        } else {
          await db.insert(documentSignatures).values({
            loanId: sig.loanId,
            documentType: sig.documentType,
            signerRole: "co_maker",
            signerName: loan.coMakerName,
            signatureData: data.coMakerSignatureData,
            signedAt: now,
            ipAddress,
          })
        }
      }
    }

    return { success: true }
  })
