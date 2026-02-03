import { createServerFn } from "@tanstack/react-start"
import { db, loans, paymentSchedule, contacts, payments } from "@/lib/db"
import { eq, desc } from "drizzle-orm"
import { requireAuth } from "./session"
import { createAuditLogger } from "./audit"
import { z } from "zod"

// Validation schemas
const createLoanSchema = z.object({
  contactId: z.string().min(1, "Contact is required"),
  principal: z.number().positive("Principal must be positive"),
  interestRate: z.number().min(0).max(100),
  termMonths: z.number().int().positive(),
  paymentFrequency: z.enum(["daily", "weekly", "biweekly", "semimonthly", "monthly"]),
  startDate: z.string().transform((s) => new Date(s)),
  // Optional fields
  purpose: z.string().optional(),
  collateralDescription: z.string().optional(),
  coMakerName: z.string().optional(),
  coMakerPhone: z.string().optional(),
  coMakerRelationship: z.string().optional(),
})

// Server functions
export const getLoans = createServerFn().handler(async () => {
  const session = await requireAuth()

  const result = await db
    .select({
      id: loans.id,
      principal: loans.principal,
      interestRate: loans.interestRate,
      termMonths: loans.termMonths,
      paymentFrequency: loans.paymentFrequency,
      paymentAmount: loans.paymentAmount,
      totalToRepay: loans.totalToRepay,
      amountPaid: loans.amountPaid,
      remainingBalance: loans.remainingBalance,
      status: loans.status,
      startDate: loans.startDate,
      maturityDate: loans.maturityDate,
      createdAt: loans.createdAt,
      contactName: contacts.name,
      contactId: contacts.id,
    })
    .from(loans)
    .innerJoin(contacts, eq(loans.contactId, contacts.id))
    .where(eq(loans.lenderId, session.user.id))
    .orderBy(desc(loans.createdAt))

  return result.map((l) => ({
    ...l,
    startDate: l.startDate?.toISOString() ?? null,
    maturityDate: l.maturityDate?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
  }))
})

export const getLoan = createServerFn<{ data: string }>().handler(
  async (ctx) => {
    const session = await requireAuth()
    const id = ctx.data

    const result = await db.query.loans.findFirst({
      where: eq(loans.id, id),
      with: {
        contact: true,
        schedule: {
          orderBy: paymentSchedule.dueDate,
        },
        payments: {
          orderBy: (payments, { desc }) => [desc(payments.paidAt)],
        },
        assignedAgent: {
          with: {
            agentUser: true,
          },
        },
      },
    })

    if (!result) {
      throw new Error("Loan not found")
    }

    // Allow access if user is the lender OR the assigned agent
    const isLender = result.lenderId === session.user.id
    const isAssignedAgent = result.assignedAgent?.agentUser?.id === session.user.id

    if (!isLender && !isAssignedAgent) {
      throw new Error("Loan not found")
    }

    return {
      ...result,
      startDate: result.startDate?.toISOString() ?? null,
      maturityDate: result.maturityDate?.toISOString() ?? null,
      completedAt: result.completedAt?.toISOString() ?? null,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
      contact: {
        ...result.contact,
        createdAt: result.contact.createdAt.toISOString(),
        updatedAt: result.contact.updatedAt.toISOString(),
      },
      schedule: result.schedule.map((s) => ({
        ...s,
        dueDate: s.dueDate.toISOString(),
        paidAt: s.paidAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      })),
      payments: result.payments.map((p) => ({
        ...p,
        paidAt: p.paidAt.toISOString(),
        createdAt: p.createdAt.toISOString(),
      })),
      assignedAgent: result.assignedAgent
        ? {
            id: result.assignedAgent.id,
            name: result.assignedAgent.agentUser.name,
            email: result.assignedAgent.agentUser.email,
          }
        : null,
      // Include viewer context for UI permissions
      isLender,
    }
  }
)

export const createLoan = createServerFn<{
  data: z.input<typeof createLoanSchema>
}>().handler(async (ctx) => {
  const session = await requireAuth()
  const data = createLoanSchema.parse(ctx.data)
  const log = createAuditLogger(session.user)

  // Verify contact ownership
  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.id, data.contactId),
  })

  if (!contact || contact.lenderId !== session.user.id) {
    throw new Error("Contact not found")
  }

  // Calculate loan terms
  const principal = data.principal
  const interestRate = data.interestRate
  const termMonths = data.termMonths
  const totalInterest = principal * (interestRate / 100) * termMonths
  const totalToRepay = principal + totalInterest

  // Calculate payment schedule
  const paymentsCount = calculatePaymentsCount(termMonths, data.paymentFrequency)
  const paymentAmount = totalToRepay / paymentsCount

  // Calculate maturity date
  const maturityDate = new Date(data.startDate)
  maturityDate.setMonth(maturityDate.getMonth() + termMonths)

  // Create loan
  const [loan] = await db
    .insert(loans)
    .values({
      lenderId: session.user.id,
      contactId: data.contactId,
      principal: principal.toString(),
      interestRate: interestRate.toString(),
      termMonths,
      paymentFrequency: data.paymentFrequency,
      paymentAmount: paymentAmount.toFixed(2),
      totalToRepay: totalToRepay.toFixed(2),
      remainingBalance: totalToRepay.toFixed(2),
      status: "active",
      startDate: data.startDate,
      maturityDate,
      // Optional fields
      purpose: data.purpose || null,
      collateralDescription: data.collateralDescription || null,
      coMakerName: data.coMakerName || null,
      coMakerPhone: data.coMakerPhone || null,
      coMakerRelationship: data.coMakerRelationship || null,
    })
    .returning()

  // Generate payment schedule
  const scheduleItems = generatePaymentSchedule(
    loan.id,
    data.startDate,
    paymentsCount,
    paymentAmount,
    data.paymentFrequency
  )

  await db.insert(paymentSchedule).values(scheduleItems)

  log("loan.create", "loan", loan.id, {
    contactId: data.contactId,
    contactName: contact.name,
    principal,
    termMonths,
  })

  return {
    ...loan,
    startDate: loan.startDate?.toISOString() ?? null,
    maturityDate: loan.maturityDate?.toISOString() ?? null,
    createdAt: loan.createdAt.toISOString(),
    updatedAt: loan.updatedAt.toISOString(),
  }
})

export const disburseLoan = createServerFn<{ data: string }>().handler(
  async (ctx) => {
    const session = await requireAuth()
    const id = ctx.data

    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, id),
    })

    if (!loan || loan.lenderId !== session.user.id) {
      throw new Error("Loan not found")
    }

    if (loan.status !== "pending_disbursement") {
      throw new Error("Loan is not pending disbursement")
    }

    const [updated] = await db
      .update(loans)
      .set({
        status: "active",
        startDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(loans.id, id))
      .returning()

    return { success: true, loan: updated }
  }
)

// Helper functions
function calculatePaymentsCount(
  termMonths: number,
  frequency: "daily" | "weekly" | "biweekly" | "semimonthly" | "monthly"
): number {
  switch (frequency) {
    case "daily":
      return termMonths * 30
    case "weekly":
      return termMonths * 4
    case "biweekly":
      return termMonths * 2
    case "semimonthly":
      return termMonths * 2
    case "monthly":
    default:
      return termMonths
  }
}

function generatePaymentSchedule(
  loanId: string,
  startDate: Date,
  paymentsCount: number,
  paymentAmount: number,
  frequency: "daily" | "weekly" | "biweekly" | "semimonthly" | "monthly"
) {
  const schedule = []
  const currentDate = new Date(startDate)

  for (let i = 0; i < paymentsCount; i++) {
    // Move to next payment date
    switch (frequency) {
      case "daily":
        currentDate.setDate(currentDate.getDate() + 1)
        break
      case "weekly":
        currentDate.setDate(currentDate.getDate() + 7)
        break
      case "biweekly":
        currentDate.setDate(currentDate.getDate() + 14)
        break
      case "semimonthly":
        // 1st and 15th of each month pattern
        if (currentDate.getDate() < 15) {
          currentDate.setDate(15)
        } else {
          currentDate.setDate(1)
          currentDate.setMonth(currentDate.getMonth() + 1)
        }
        break
      case "monthly":
        currentDate.setMonth(currentDate.getMonth() + 1)
        break
    }

    schedule.push({
      loanId,
      dueDate: new Date(currentDate),
      amount: paymentAmount.toFixed(2),
    })
  }

  return schedule
}

export const deleteLoan = createServerFn<{ data: string }>().handler(
  async (ctx) => {
    const session = await requireAuth()
    const id = ctx.data
    const log = createAuditLogger(session.user)

    // Get the loan with payments count
    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, id),
      with: {
        payments: true,
        contact: true,
      },
    })

    if (!loan || loan.lenderId !== session.user.id) {
      throw new Error("Loan not found")
    }

    // Check if loan has any payments
    if (loan.payments.length > 0) {
      throw new Error(
        `Cannot delete loan with ${loan.payments.length} payment${loan.payments.length !== 1 ? "s" : ""}. Delete payments first.`
      )
    }

    // Delete schedule items first (foreign key constraint)
    await db.delete(paymentSchedule).where(eq(paymentSchedule.loanId, id))

    // Delete the loan
    await db.delete(loans).where(eq(loans.id, id))

    log("loan.delete", "loan", id, {
      contactName: loan.contact.name,
      principal: loan.principal,
    })

    return { success: true }
  }
)
