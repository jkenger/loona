/**
 * Seed script for Loona
 *
 * Creates lender-focused demo data for project showcase:
 * - 1 Lender account (Ken Gervacio)
 * - 1 Agent account (Juan Dela Cruz)
 * - 12 Contacts (Filipino borrowers)
 * - 15 Loans (8 active, 2 overdue, 3 completed, 2 pending)
 * - Payment schedules, payments, and commissions
 *
 * Run with: npm run db:seed
 */

import "dotenv/config"
import { drizzle } from "drizzle-orm/neon-http"
import { neon } from "@neondatabase/serverless"
import { hashPassword } from "better-auth/crypto"
import { eq } from "drizzle-orm"
import * as schema from "../src/lib/db/schema"

const {
  user,
  account,
  session,
  verification,
  contacts,
  loans,
  paymentSchedule,
  payments,
  agents,
  commissions,
  commissionSettings,
  lenderSettings,
  penaltySettings,
  penalties,
  auditLogs,
} = schema

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

// ============================================================================
// Constants
// ============================================================================

const TEST_PASSWORD = "password123"
const TODAY = new Date()

const LENDER = {
  id: "lender-ken-001",
  name: "Ken Gervacio",
  email: "johnkgervacio@gmail.com",
}

const AGENT = {
  id: "agent-juan-001",
  name: "Juan Dela Cruz",
  email: "juan@example.com",
}

const BORROWERS = [
  { name: "Ana Reyes", phone: "09171234567", city: "Manila", email: "ana.reyes@gmail.com", notes: "Reliable borrower, always on time" },
  { name: "Pedro Garcia", phone: "09181234567", city: "Quezon City", facebookProfile: "https://facebook.com/pedrogarcia" },
  { name: "Rosa Martinez", phone: "09191234567", city: "Makati", email: "rosa.martinez@yahoo.com" },
  { name: "Miguel Santos", phone: "09201234567", city: "Pasig", notes: "Sari-sari store owner" },
  { name: "Elena Cruz", phone: "09211234567", city: "Taguig", email: "elena.cruz@gmail.com", notes: "First-time borrower" },
  { name: "Carlos Reyes", phone: "09221234567", city: "Mandaluyong", facebookProfile: "https://facebook.com/carlosreyes" },
  { name: "Sofia Garcia", email: "sofia.garcia@gmail.com", city: "Paranaque" },
  { name: "Antonio Lopez", phone: "09241234567", city: "Las Pinas", notes: "Referred by Pedro Garcia" },
  { name: "Isabella Torres", phone: "09251234567", city: "Muntinlupa", email: "isabella.t@gmail.com" },
  { name: "Roberto Villanueva", phone: "09261234567", city: "Caloocan", notes: "Trucking business owner" },
  { name: "Maria Fernandez", phone: "09271234567", city: "Marikina" },
  { name: "Jose Ramos", phone: "09281234567", city: "San Juan", email: "jose.ramos@yahoo.com", notes: "Government employee" },
]

// ============================================================================
// Loan Configurations
// ============================================================================

interface LoanConfig {
  contactIdx: number
  principal: number
  rate: number
  termMonths: number
  frequency: "daily" | "weekly" | "biweekly" | "semimonthly" | "monthly"
  status: "active" | "completed" | "pending_disbursement"
  paidItems: number
  startDaysAgo: number
  assignToAgent: boolean
  purpose?: string
  collateral?: string
  coMaker?: { name: string; phone: string; relationship: string }
}

// 15 loans: 10 active (2 with overdue items), 3 completed, 2 pending
// ~60% assigned to agent (9 of 15)
const LOAN_CONFIGS: LoanConfig[] = [
  // ── Active loans (8 regular) ──────────────────────────────────────────
  {
    contactIdx: 0, principal: 10000, rate: 5, termMonths: 6, frequency: "monthly",
    status: "active", paidItems: 3, startDaysAgo: 95, assignToAgent: true,
    purpose: "Home improvement",
  },
  {
    contactIdx: 1, principal: 25000, rate: 4, termMonths: 12, frequency: "monthly",
    status: "active", paidItems: 5, startDaysAgo: 160, assignToAgent: true,
    purpose: "Business capital", collateral: "Motorcycle - Honda Click 150i, 2022",
  },
  {
    contactIdx: 3, principal: 15000, rate: 5, termMonths: 6, frequency: "semimonthly",
    status: "active", paidItems: 6, startDaysAgo: 95, assignToAgent: false,
    purpose: "Medical expenses",
    coMaker: { name: "Linda Santos", phone: "09351234567", relationship: "Spouse" },
  },
  {
    contactIdx: 9, principal: 50000, rate: 3, termMonths: 12, frequency: "monthly",
    status: "active", paidItems: 8, startDaysAgo: 250, assignToAgent: true,
    purpose: "Truck repair", collateral: "Vehicle - Isuzu Elf 2019, OR/CR available",
    coMaker: { name: "Maria Villanueva", phone: "09361234567", relationship: "Wife" },
  },
  {
    contactIdx: 1, principal: 20000, rate: 5, termMonths: 6, frequency: "biweekly",
    status: "active", paidItems: 4, startDaysAgo: 65, assignToAgent: true,
    purpose: "Inventory restocking",
  },
  {
    contactIdx: 5, principal: 7000, rate: 4, termMonths: 3, frequency: "monthly",
    status: "active", paidItems: 1, startDaysAgo: 40, assignToAgent: false,
  },
  {
    contactIdx: 8, principal: 18000, rate: 5, termMonths: 6, frequency: "monthly",
    status: "active", paidItems: 5, startDaysAgo: 155, assignToAgent: true,
  },
  {
    contactIdx: 11, principal: 6000, rate: 3, termMonths: 3, frequency: "monthly",
    status: "active", paidItems: 2, startDaysAgo: 65, assignToAgent: false,
    purpose: "Tuition",
  },

  // ── Active loans with overdue items (2) ───────────────────────────────
  // Rosa: biweekly, 2 paid then stopped → 1 item overdue
  {
    contactIdx: 2, principal: 5000, rate: 3, termMonths: 4, frequency: "biweekly",
    status: "active", paidItems: 2, startDaysAgo: 55, assignToAgent: true,
  },
  // Elena: monthly, 1 paid then stopped → 2 items overdue
  {
    contactIdx: 4, principal: 8000, rate: 4, termMonths: 4, frequency: "monthly",
    status: "active", paidItems: 1, startDaysAgo: 105, assignToAgent: true,
  },

  // ── Completed loans (3) ───────────────────────────────────────────────
  {
    contactIdx: 0, principal: 5000, rate: 5, termMonths: 3, frequency: "monthly",
    status: "completed", paidItems: 3, startDaysAgo: 200, assignToAgent: true,
  },
  {
    contactIdx: 6, principal: 12000, rate: 3, termMonths: 4, frequency: "biweekly",
    status: "completed", paidItems: 8, startDaysAgo: 180, assignToAgent: false,
  },
  {
    contactIdx: 10, principal: 8000, rate: 4, termMonths: 2, frequency: "monthly",
    status: "completed", paidItems: 2, startDaysAgo: 120, assignToAgent: true,
  },

  // ── Pending disbursement (2) ──────────────────────────────────────────
  {
    contactIdx: 7, principal: 30000, rate: 5, termMonths: 12, frequency: "monthly",
    status: "pending_disbursement", paidItems: 0, startDaysAgo: 0, assignToAgent: false,
    purpose: "Business expansion", collateral: "Land title - 100sqm lot in Bulacan",
  },
  {
    contactIdx: 11, principal: 15000, rate: 4, termMonths: 6, frequency: "semimonthly",
    status: "pending_disbursement", paidItems: 0, startDaysAgo: 0, assignToAgent: false,
    purpose: "Emergency fund",
  },
]

// ============================================================================
// Helpers
// ============================================================================

function generateId(): string {
  return crypto.randomUUID()
}

function getPaymentsCount(termMonths: number, frequency: string): number {
  const multiplier: Record<string, number> = {
    daily: 30, weekly: 4, biweekly: 2, semimonthly: 2, monthly: 1,
  }
  return termMonths * (multiplier[frequency] ?? 1)
}

function addPaymentInterval(date: Date, frequency: string): Date {
  const next = new Date(date)
  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1)
      break
    case "weekly":
      next.setDate(next.getDate() + 7)
      break
    case "biweekly":
      next.setDate(next.getDate() + 14)
      break
    case "semimonthly":
      if (next.getDate() < 15) {
        next.setDate(15)
      } else {
        next.setDate(1)
        next.setMonth(next.getMonth() + 1)
      }
      break
    case "monthly":
      next.setMonth(next.getMonth() + 1)
      break
  }
  return next
}

function daysAgo(n: number): Date {
  const d = new Date(TODAY)
  d.setDate(d.getDate() - n)
  d.setHours(9, 0, 0, 0)
  return d
}

const PAYMENT_METHODS = ["cash", "gcash", "maya", "bank"] as const

function pickMethod(seed: number): "cash" | "gcash" | "maya" | "bank" {
  return PAYMENT_METHODS[seed % PAYMENT_METHODS.length]
}

// ============================================================================
// Clear Database
// ============================================================================

async function clearDatabase() {
  console.log("Clearing database...")

  // Delete in reverse dependency order; blog + waitlist tables left alone
  await db.delete(commissions)
  await db.delete(payments)
  await db.delete(penalties)
  await db.delete(paymentSchedule)
  await db.delete(loans)
  await db.delete(contacts)
  await db.delete(agents)
  await db.delete(commissionSettings)
  await db.delete(lenderSettings)
  await db.delete(penaltySettings)
  await db.delete(auditLogs)
  await db.delete(session)
  await db.delete(account)
  await db.delete(verification)
  await db.delete(user)

  console.log("  Done (blog tables preserved)")
}

// ============================================================================
// Seed Functions
// ============================================================================

async function seedUsers() {
  console.log("Creating users...")

  const hashedPassword = await hashPassword(TEST_PASSWORD)

  await db.insert(user).values({
    id: LENDER.id,
    name: LENDER.name,
    email: LENDER.email,
    emailVerified: true,
    role: "lender",
    hasCompletedOnboarding: true,
  })

  await db.insert(account).values({
    id: generateId(),
    accountId: LENDER.id,
    providerId: "credential",
    userId: LENDER.id,
    password: hashedPassword,
  })

  await db.insert(user).values({
    id: AGENT.id,
    name: AGENT.name,
    email: AGENT.email,
    emailVerified: true,
    role: "agent",
  })

  await db.insert(account).values({
    id: generateId(),
    accountId: AGENT.id,
    providerId: "credential",
    userId: AGENT.id,
    password: hashedPassword,
  })

  console.log(`  Lender: ${LENDER.email}`)
  console.log(`  Agent:  ${AGENT.email}`)
}

async function seedAgent(): Promise<string> {
  console.log("Creating agent relationship...")

  const agentId = generateId()
  await db.insert(agents).values({
    id: agentId,
    agentUserId: AGENT.id,
    lenderId: LENDER.id,
    commissionRate: "5.00",
    status: "active",
    tier: 1,
    canRecordPayments: true,
    canCreateLoans: true,
    totalCollected: "0",
    totalCommissionEarned: "0",
    totalCommissionPaid: "0",
  })

  console.log("  Tier 1, 5% commission, canRecordPayments + canCreateLoans")
  return agentId
}

async function seedContacts(): Promise<string[]> {
  console.log("Creating contacts...")

  const ids: string[] = []
  for (const b of BORROWERS) {
    const id = generateId()
    ids.push(id)
    await db.insert(contacts).values({
      id,
      lenderId: LENDER.id,
      name: b.name,
      phone: b.phone ?? null,
      email: b.email ?? null,
      city: b.city,
      facebookProfile: (b as any).facebookProfile ?? null,
      notes: b.notes ?? null,
    })
  }

  console.log(`  ${BORROWERS.length} contacts`)
  return ids
}

async function seedLoansAndPayments(contactIds: string[], agentId: string) {
  console.log("Creating loans, schedules, and payments...")

  let loanCount = 0
  let paymentCount = 0
  let commissionCount = 0

  for (let li = 0; li < LOAN_CONFIGS.length; li++) {
    const cfg = LOAN_CONFIGS[li]
    const contactId = contactIds[cfg.contactIdx]
    const loanId = generateId()

    // Financial calculations
    const totalInterest = cfg.principal * (cfg.rate / 100) * cfg.termMonths
    const totalToRepay = cfg.principal + totalInterest
    const paymentsCount = getPaymentsCount(cfg.termMonths, cfg.frequency)
    const paymentAmount = totalToRepay / paymentsCount

    const amountPaid = cfg.status === "completed"
      ? totalToRepay
      : cfg.paidItems * paymentAmount
    const remainingBalance = totalToRepay - amountPaid

    const interestPerPayment = totalInterest / paymentsCount
    const interestEarned = cfg.status === "completed"
      ? totalInterest
      : cfg.paidItems * interestPerPayment

    // Dates
    const startDate = cfg.startDaysAgo > 0 ? daysAgo(cfg.startDaysAgo) : null
    let maturityDate: Date | null = null
    if (startDate) {
      maturityDate = new Date(startDate)
      maturityDate.setMonth(maturityDate.getMonth() + cfg.termMonths)
    }

    await db.insert(loans).values({
      id: loanId,
      lenderId: LENDER.id,
      contactId,
      principal: cfg.principal.toFixed(2),
      interestRate: cfg.rate.toFixed(2),
      termMonths: cfg.termMonths,
      paymentFrequency: cfg.frequency,
      paymentAmount: paymentAmount.toFixed(2),
      totalToRepay: totalToRepay.toFixed(2),
      amountPaid: amountPaid.toFixed(2),
      interestEarned: interestEarned.toFixed(2),
      remainingBalance: remainingBalance.toFixed(2),
      status: cfg.status,
      startDate,
      maturityDate,
      completedAt: cfg.status === "completed" ? maturityDate : null,
      purpose: cfg.purpose ?? null,
      collateralDescription: cfg.collateral ?? null,
      coMakerName: cfg.coMaker?.name ?? null,
      coMakerPhone: cfg.coMaker?.phone ?? null,
      coMakerRelationship: cfg.coMaker?.relationship ?? null,
      assignedAgentId: cfg.assignToAgent ? agentId : null,
    })
    loanCount++

    // Skip schedule for pending loans
    if (cfg.status === "pending_disbursement" || !startDate) continue

    let scheduleDate = new Date(startDate)

    for (let i = 0; i < paymentsCount; i++) {
      scheduleDate = addPaymentInterval(scheduleDate, cfg.frequency)
      const scheduleId = generateId()
      const isPaid = i < cfg.paidItems
      const isOverdue = !isPaid && new Date(scheduleDate) < TODAY

      await db.insert(paymentSchedule).values({
        id: scheduleId,
        loanId,
        dueDate: new Date(scheduleDate),
        amount: paymentAmount.toFixed(2),
        status: isPaid ? "paid" : isOverdue ? "overdue" : "pending",
        paidAmount: isPaid ? paymentAmount.toFixed(2) : "0",
        paidAt: isPaid ? new Date(scheduleDate) : null,
      })

      if (isPaid) {
        const paymentId = generateId()
        // ~40% of all payments recorded by agent:
        // 60% of loans are agent-assigned; within those, ~67% are agent-recorded
        const isAgentPayment = cfg.assignToAgent && (li + i) % 3 < 2

        await db.insert(payments).values({
          id: paymentId,
          loanId,
          scheduleItemId: scheduleId,
          amount: paymentAmount.toFixed(2),
          method: pickMethod(li * 7 + i * 3),
          paidAt: new Date(scheduleDate),
          recordedByAgentId: isAgentPayment ? agentId : null,
          notes: (li + i) % 8 === 0 ? "On time" : null,
        })
        paymentCount++

        if (isAgentPayment) {
          const commissionAmt = paymentAmount * 0.05
          await db.insert(commissions).values({
            id: generateId(),
            agentId,
            paymentId,
            paymentAmount: paymentAmount.toFixed(2),
            commissionRate: "5.00",
            commissionAmount: commissionAmt.toFixed(2),
            status: "pending",
          })
          commissionCount++
        }
      }
    }
  }

  console.log(`  ${loanCount} loans`)
  console.log(`  ${paymentCount} payments`)
  console.log(`  ${commissionCount} commissions`)
}

async function recomputeAgentTotals(agentId: string) {
  console.log("Recomputing agent totals...")

  const rows = await db.query.commissions.findMany({
    where: (c, { eq }) => eq(c.agentId, agentId),
  })

  const totalCollected = rows.reduce((s, c) => s + parseFloat(c.paymentAmount), 0)
  const totalEarned = rows.reduce((s, c) => s + parseFloat(c.commissionAmount), 0)
  const totalPaid = rows
    .filter((c) => c.status === "paid")
    .reduce((s, c) => s + parseFloat(c.commissionAmount), 0)

  await db.update(agents)
    .set({
      totalCollected: totalCollected.toFixed(2),
      totalCommissionEarned: totalEarned.toFixed(2),
      totalCommissionPaid: totalPaid.toFixed(2),
    })
    .where(eq(agents.id, agentId))

  console.log(`  Collected: P${totalCollected.toLocaleString()}`)
  console.log(`  Commission earned: P${totalEarned.toLocaleString()}`)
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("\nSeeding Loona database...\n")

  try {
    await clearDatabase()
    await seedUsers()
    const agentId = await seedAgent()
    const contactIds = await seedContacts()
    await seedLoansAndPayments(contactIds, agentId)
    await recomputeAgentTotals(agentId)

    console.log("\nSeed completed!\n")
    console.log("Test accounts:")
    console.log(`  Lender: ${LENDER.email} / ${TEST_PASSWORD}`)
    console.log(`  Agent:  ${AGENT.email} / ${TEST_PASSWORD}`)
    console.log("")
  } catch (error) {
    console.error("\nSeed failed:", error)
    process.exit(1)
  }
}

main()
