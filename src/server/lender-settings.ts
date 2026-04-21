import { createServerFn } from "@tanstack/react-start"
import { db, lenderSettings, loans, cashTransactions } from "@/lib/db"
import { eq, sql, desc } from "drizzle-orm"
import { requireAuth } from "./session"
import { createAuditLogger } from "./audit"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { z } from "zod"
import {
  parseLenderConfig,
  lenderConfigSchema,
} from "@/lib/constants/lender-defaults"

// ============================================================================
// Lender Settings Server Functions
// ============================================================================

/**
 * Get lender settings for the current lender (or defaults if none saved)
 */
export const getLenderSettings = createServerFn().handler(async () => {
  const session = await requireAuth()

  if (!hasRole(session.user.role, ROLES.LENDER)) {
    throw new Error("Forbidden: Lender access required")
  }

  const row = await db.query.lenderSettings.findFirst({
    where: eq(lenderSettings.lenderId, session.user.id),
  })

  return parseLenderConfig(row?.config ?? null)
})

/**
 * Lightweight cash position data for the nav wallet display
 */
export const getCashPosition = createServerFn().handler(async () => {
  const session = await requireAuth()

  if (!hasRole(session.user.role, ROLES.LENDER)) {
    return null
  }

  const row = await db.query.lenderSettings.findFirst({
    where: eq(lenderSettings.lenderId, session.user.id),
  })
  const config = parseLenderConfig(row?.config ?? null)

  if (config.initialCapital === 0) {
    return { initialCapital: 0, totalDisbursed: "0", totalCollected: "0", totalDeposits: "0", totalExpenses: "0", cashAvailable: 0 }
  }

  const [loanTotals, txTotals] = await Promise.all([
    db.select({
      totalDisbursed: sql<string>`coalesce(sum(${loans.principal}), 0)`,
      totalCollected: sql<string>`coalesce(sum(${loans.amountPaid}), 0)`,
    }).from(loans).where(eq(loans.lenderId, session.user.id)),

    db.select({
      totalDeposits: sql<string>`coalesce(sum(case when ${cashTransactions.type} = 'deposit' then ${cashTransactions.amount} else 0 end), 0)`,
      totalExpenses: sql<string>`coalesce(sum(case when ${cashTransactions.type} = 'expense' then ${cashTransactions.amount} else 0 end), 0)`,
    }).from(cashTransactions).where(eq(cashTransactions.lenderId, session.user.id)),
  ])

  const totalDisbursed = loanTotals[0]?.totalDisbursed ?? "0"
  const totalCollected = loanTotals[0]?.totalCollected ?? "0"
  const totalDeposits = txTotals[0]?.totalDeposits ?? "0"
  const totalExpenses = txTotals[0]?.totalExpenses ?? "0"

  const cashAvailable =
    config.initialCapital
    - parseFloat(totalDisbursed)
    + parseFloat(totalCollected)
    + parseFloat(totalDeposits)
    - parseFloat(totalExpenses)

  return { initialCapital: config.initialCapital, totalDisbursed, totalCollected, totalDeposits, totalExpenses, cashAvailable }
})

// ============================================================================
// Cash Transactions
// ============================================================================

export const getCashTransactions = createServerFn().handler(async () => {
  const session = await requireAuth()
  if (!hasRole(session.user.role, ROLES.LENDER)) throw new Error("Forbidden")

  const rows = await db
    .select()
    .from(cashTransactions)
    .where(eq(cashTransactions.lenderId, session.user.id))
    .orderBy(desc(cashTransactions.transactionDate))

  return rows.map((r) => ({
    ...r,
    transactionDate: r.transactionDate.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }))
})

export const addCashTransaction = createServerFn()
  .inputValidator(z.object({
    type: z.enum(["deposit", "expense"]),
    amount: z.number().positive(),
    description: z.string().min(1),
    transactionDate: z.string(),
  }))
  .handler(async ({ data }) => {
    const session = await requireAuth()
    if (!hasRole(session.user.role, ROLES.LENDER)) throw new Error("Forbidden")

    const [row] = await db.insert(cashTransactions).values({
      lenderId: session.user.id,
      type: data.type,
      amount: data.amount.toString(),
      description: data.description,
      transactionDate: new Date(data.transactionDate),
    }).returning()

    return { ...row, transactionDate: row.transactionDate.toISOString(), createdAt: row.createdAt.toISOString() }
  })

export const deleteCashTransaction = createServerFn()
  .inputValidator(z.string())
  .handler(async ({ data: id }) => {
    const session = await requireAuth()
    if (!hasRole(session.user.role, ROLES.LENDER)) throw new Error("Forbidden")

    const row = await db.query.cashTransactions.findFirst({ where: eq(cashTransactions.id, id) })
    if (!row || row.lenderId !== session.user.id) throw new Error("Not found")

    await db.delete(cashTransactions).where(eq(cashTransactions.id, id))
    return { success: true }
  })

/**
 * Save lender settings for the current lender (upsert)
 */
export const saveLenderSettings = createServerFn()
  .inputValidator(lenderConfigSchema)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    if (!hasRole(session.user.role, ROLES.LENDER)) {
      throw new Error("Forbidden: Lender access required")
    }

    const configJson = JSON.stringify(data)

    // Upsert: check if row exists
    const existing = await db.query.lenderSettings.findFirst({
      where: eq(lenderSettings.lenderId, session.user.id),
    })

    if (existing) {
      await db
        .update(lenderSettings)
        .set({ config: configJson, updatedAt: new Date() })
        .where(eq(lenderSettings.id, existing.id))
    } else {
      await db.insert(lenderSettings).values({
        lenderId: session.user.id,
        config: configJson,
      })
    }

    const log = createAuditLogger(session.user)
    log("lender.updateSettings", "lender_settings", session.user.id)

    return { success: true }
  })
