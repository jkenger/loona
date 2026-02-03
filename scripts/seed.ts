/**
 * Seed script for Loona
 *
 * Creates test data including:
 * - 1 Lender account
 * - 1 Agent account (assigned to lender)
 * - 10 Contacts (borrowers)
 * - 15 Loans with various statuses
 * - Payment schedules for all loans
 * - Payments for active/completed loans
 * - Commissions for agent-recorded payments
 *
 * Run with: npm run db:seed
 */

import "dotenv/config"
import { drizzle } from "drizzle-orm/neon-http"
import { neon } from "@neondatabase/serverless"
import { hash } from "bcryptjs"
import { eq } from "drizzle-orm"
import * as schema from "../src/lib/db/schema"

const {
  user,
  account,
  contacts,
  loans,
  paymentSchedule,
  payments,
  agents,
  commissions,
} = schema

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

// ============================================================================
// Test Data
// ============================================================================

const TEST_PASSWORD = "password123"

const LENDER = {
  id: "lender-001",
  name: "Maria Santos",
  email: "maria@example.com",
}

const AGENT = {
  id: "agent-001",
  name: "Juan Dela Cruz",
  email: "juan@example.com",
}

const CONTACTS = [
  { name: "Ana Reyes", phone: "09171234567", city: "Manila", notes: "Reliable borrower" },
  { name: "Pedro Garcia", phone: "09181234567", city: "Quezon City", email: "pedro@email.com" },
  { name: "Rosa Martinez", phone: "09191234567", city: "Makati" },
  { name: "Miguel Santos", phone: "09201234567", city: "Pasig", facebookProfile: "https://facebook.com/miguel" },
  { name: "Elena Cruz", phone: "09211234567", city: "Taguig", notes: "First-time borrower" },
  { name: "Carlos Reyes", phone: "09221234567", city: "Mandaluyong" },
  { name: "Sofia Garcia", phone: "09231234567", city: "Paranaque", email: "sofia@email.com" },
  { name: "Antonio Lopez", phone: "09241234567", city: "Las Pinas" },
  { name: "Isabella Torres", phone: "09251234567", city: "Muntinlupa" },
  { name: "Roberto Villanueva", phone: "09261234567", city: "Caloocan", notes: "Business owner" },
]

const LOAN_CONFIGS = [
  // Active loans with various terms
  { contactIdx: 0, principal: 10000, rate: 5, term: 6, frequency: "monthly", status: "active", paidMonths: 2 },
  { contactIdx: 1, principal: 25000, rate: 4, term: 12, frequency: "monthly", status: "active", paidMonths: 5, purpose: "Business", hasCollateral: true, collateral: "Motorcycle - Honda Click 150i, 2022" },
  { contactIdx: 2, principal: 5000, rate: 3, term: 3, frequency: "biweekly", status: "active", paidMonths: 1 },
  { contactIdx: 3, principal: 15000, rate: 5, term: 6, frequency: "semimonthly", status: "active", paidMonths: 3, purpose: "Medical", hasCoMaker: true, coMaker: { name: "Linda Santos", phone: "09271234567", relationship: "Spouse" } },
  { contactIdx: 4, principal: 8000, rate: 4, term: 4, frequency: "weekly", status: "active", paidMonths: 2 },

  // Completed loans
  { contactIdx: 0, principal: 5000, rate: 5, term: 3, frequency: "monthly", status: "completed", paidMonths: 3 },
  { contactIdx: 5, principal: 20000, rate: 4, term: 6, frequency: "monthly", status: "completed", paidMonths: 6, purpose: "Tuition" },
  { contactIdx: 6, principal: 12000, rate: 3, term: 4, frequency: "biweekly", status: "completed", paidMonths: 8 },

  // Pending disbursement
  { contactIdx: 7, principal: 30000, rate: 5, term: 12, frequency: "monthly", status: "pending_disbursement", paidMonths: 0, purpose: "Business", hasCollateral: true, collateral: "Land title - 100sqm lot in Bulacan" },
  { contactIdx: 8, principal: 7500, rate: 4, term: 3, frequency: "semimonthly", status: "pending_disbursement", paidMonths: 0 },

  // More active loans for variety
  { contactIdx: 9, principal: 50000, rate: 3, term: 24, frequency: "monthly", status: "active", paidMonths: 8, purpose: "Business", hasCollateral: true, collateral: "Vehicle - Toyota Vios 2020, OR/CR available", hasCoMaker: true, coMaker: { name: "Maria Villanueva", phone: "09281234567", relationship: "Wife" } },
  { contactIdx: 1, principal: 3000, rate: 5, term: 2, frequency: "weekly", status: "active", paidMonths: 4, purpose: "Emergency" },
  { contactIdx: 3, principal: 18000, rate: 4, term: 6, frequency: "monthly", status: "active", paidMonths: 1, purpose: "Rent" },
  { contactIdx: 5, principal: 10000, rate: 5, term: 4, frequency: "biweekly", status: "active", paidMonths: 3 },
  { contactIdx: 7, principal: 6000, rate: 3, term: 3, frequency: "monthly", status: "active", paidMonths: 0, purpose: "Utilities" },
]

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return crypto.randomUUID()
}

function calculatePaymentsCount(termMonths: number, frequency: string): number {
  switch (frequency) {
    case "daily": return termMonths * 30
    case "weekly": return termMonths * 4
    case "biweekly": return termMonths * 2
    case "semimonthly": return termMonths * 2
    case "monthly":
    default: return termMonths
  }
}

function getNextPaymentDate(currentDate: Date, frequency: string): Date {
  const next = new Date(currentDate)
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

function randomDate(daysAgo: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date
}

function randomPaymentMethod(): "cash" | "gcash" | "maya" | "bank" {
  const methods = ["cash", "gcash", "maya", "bank"] as const
  return methods[Math.floor(Math.random() * methods.length)]
}

// ============================================================================
// Seed Functions
// ============================================================================

async function seedUsers() {
  console.log("Creating users...")

  const hashedPassword = await hash(TEST_PASSWORD, 10)

  // Create lender
  await db.insert(user).values({
    id: LENDER.id,
    name: LENDER.name,
    email: LENDER.email,
    emailVerified: true,
    role: "lender",
  }).onConflictDoNothing()

  await db.insert(account).values({
    id: generateId(),
    accountId: LENDER.email,
    providerId: "credential",
    userId: LENDER.id,
    password: hashedPassword,
  }).onConflictDoNothing()

  // Create agent
  await db.insert(user).values({
    id: AGENT.id,
    name: AGENT.name,
    email: AGENT.email,
    emailVerified: true,
    role: "agent",
  }).onConflictDoNothing()

  await db.insert(account).values({
    id: generateId(),
    accountId: AGENT.email,
    providerId: "credential",
    userId: AGENT.id,
    password: hashedPassword,
  }).onConflictDoNothing()

  console.log(`  Created lender: ${LENDER.email}`)
  console.log(`  Created agent: ${AGENT.email}`)
}

async function seedAgentRelationship() {
  console.log("Creating agent relationship...")

  const agentId = generateId()
  await db.insert(agents).values({
    id: agentId,
    agentUserId: AGENT.id,
    lenderId: LENDER.id,
    commissionRate: "5.00",
    status: "active",
    totalCollected: "0",
    totalCommissionEarned: "0",
    totalCommissionPaid: "0",
  }).onConflictDoNothing()

  console.log(`  Created agent relationship with 5% commission`)
  return agentId
}

async function seedContacts() {
  console.log("Creating contacts...")

  const contactIds: string[] = []

  for (const contact of CONTACTS) {
    const id = generateId()
    contactIds.push(id)

    await db.insert(contacts).values({
      id,
      lenderId: LENDER.id,
      name: contact.name,
      phone: contact.phone,
      email: contact.email || null,
      city: contact.city,
      facebookProfile: contact.facebookProfile || null,
      notes: contact.notes || null,
    })
  }

  console.log(`  Created ${CONTACTS.length} contacts`)
  return contactIds
}

async function seedLoansAndPayments(contactIds: string[], agentId: string) {
  console.log("Creating loans, schedules, and payments...")

  let totalLoans = 0
  let totalPayments = 0
  let totalCommissions = 0

  for (const config of LOAN_CONFIGS) {
    const contactId = contactIds[config.contactIdx]
    const loanId = generateId()

    // Calculate loan terms
    const principal = config.principal
    const totalInterest = principal * (config.rate / 100) * config.term
    const totalToRepay = principal + totalInterest
    const paymentsCount = calculatePaymentsCount(config.term, config.frequency)
    const paymentAmount = totalToRepay / paymentsCount

    // Calculate paid amounts
    const paidPayments = config.paidMonths > 0
      ? Math.min(config.paidMonths * (paymentsCount / config.term), paymentsCount)
      : 0
    const amountPaid = config.status === "completed"
      ? totalToRepay
      : paidPayments * paymentAmount
    const remainingBalance = totalToRepay - amountPaid

    // Start date (older for completed loans, recent for active)
    const daysAgo = config.status === "completed"
      ? config.term * 30 + 30
      : Math.floor(Math.random() * 60) + 30
    const startDate = randomDate(daysAgo)
    const maturityDate = new Date(startDate)
    maturityDate.setMonth(maturityDate.getMonth() + config.term)

    // Create loan
    await db.insert(loans).values({
      id: loanId,
      lenderId: LENDER.id,
      contactId,
      principal: principal.toFixed(2),
      interestRate: config.rate.toFixed(2),
      termMonths: config.term,
      paymentFrequency: config.frequency as any,
      paymentAmount: paymentAmount.toFixed(2),
      totalToRepay: totalToRepay.toFixed(2),
      amountPaid: amountPaid.toFixed(2),
      remainingBalance: remainingBalance.toFixed(2),
      status: config.status as any,
      startDate: config.status !== "pending_disbursement" ? startDate : null,
      maturityDate: config.status !== "pending_disbursement" ? maturityDate : null,
      completedAt: config.status === "completed" ? maturityDate : null,
      purpose: config.purpose || null,
      collateralDescription: config.hasCollateral ? config.collateral : null,
      coMakerName: config.hasCoMaker ? config.coMaker?.name : null,
      coMakerPhone: config.hasCoMaker ? config.coMaker?.phone : null,
      coMakerRelationship: config.hasCoMaker ? config.coMaker?.relationship : null,
      assignedAgentId: Math.random() > 0.5 ? agentId : null, // Randomly assign some to agent
    })

    totalLoans++

    // Create payment schedule
    if (config.status !== "pending_disbursement") {
      let scheduleDate = new Date(startDate)

      for (let i = 0; i < paymentsCount; i++) {
        scheduleDate = getNextPaymentDate(scheduleDate, config.frequency)
        const scheduleId = generateId()

        const isPaid = i < paidPayments
        const isOverdue = !isPaid && scheduleDate < new Date()

        await db.insert(paymentSchedule).values({
          id: scheduleId,
          loanId,
          dueDate: new Date(scheduleDate),
          amount: paymentAmount.toFixed(2),
          status: isPaid ? "paid" : isOverdue ? "overdue" : "pending",
          paidAmount: isPaid ? paymentAmount.toFixed(2) : "0",
          paidAt: isPaid ? new Date(scheduleDate) : null,
        })

        // Create payment records for paid items
        if (isPaid) {
          const paymentId = generateId()
          const isAgentPayment = Math.random() > 0.6 // 40% recorded by agent

          await db.insert(payments).values({
            id: paymentId,
            loanId,
            scheduleItemId: scheduleId,
            amount: paymentAmount.toFixed(2),
            method: randomPaymentMethod(),
            paidAt: new Date(scheduleDate),
            recordedByAgentId: isAgentPayment ? agentId : null,
            notes: Math.random() > 0.7 ? "On time payment" : null,
          })

          totalPayments++

          // Create commission for agent-recorded payments
          if (isAgentPayment) {
            const commissionAmount = paymentAmount * 0.05 // 5% commission

            await db.insert(commissions).values({
              id: generateId(),
              agentId,
              paymentId,
              paymentAmount: paymentAmount.toFixed(2),
              commissionRate: "5.00",
              commissionAmount: commissionAmount.toFixed(2),
              status: Math.random() > 0.5 ? "paid" : "pending",
              paidAt: Math.random() > 0.5 ? new Date() : null,
              paidBy: Math.random() > 0.5 ? LENDER.id : null,
            })

            totalCommissions++
          }
        }
      }
    }
  }

  console.log(`  Created ${totalLoans} loans`)
  console.log(`  Created ${totalPayments} payments`)
  console.log(`  Created ${totalCommissions} commissions`)
}

async function updateAgentTotals(agentId: string) {
  console.log("Updating agent totals...")

  // Calculate totals from commissions
  const agentCommissions = await db.query.commissions.findMany({
    where: (c, { eq }) => eq(c.agentId, agentId),
  })

  const totalCollected = agentCommissions.reduce(
    (sum, c) => sum + parseFloat(c.paymentAmount),
    0
  )
  const totalCommissionEarned = agentCommissions.reduce(
    (sum, c) => sum + parseFloat(c.commissionAmount),
    0
  )
  const totalCommissionPaid = agentCommissions
    .filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + parseFloat(c.commissionAmount), 0)

  await db.update(agents)
    .set({
      totalCollected: totalCollected.toFixed(2),
      totalCommissionEarned: totalCommissionEarned.toFixed(2),
      totalCommissionPaid: totalCommissionPaid.toFixed(2),
    })
    .where(eq(agents.id, agentId))

  console.log(`  Total collected: ₱${totalCollected.toLocaleString()}`)
  console.log(`  Total commission earned: ₱${totalCommissionEarned.toLocaleString()}`)
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("\n🌱 Seeding Loona database...\n")

  try {
    await seedUsers()
    const agentId = await seedAgentRelationship()
    const contactIds = await seedContacts()
    await seedLoansAndPayments(contactIds, agentId)
    await updateAgentTotals(agentId)

    console.log("\n✅ Seed completed successfully!\n")
    console.log("Test accounts:")
    console.log(`  Lender: ${LENDER.email} / ${TEST_PASSWORD}`)
    console.log(`  Agent:  ${AGENT.email} / ${TEST_PASSWORD}`)
    console.log("")
  } catch (error) {
    console.error("\n❌ Seed failed:", error)
    process.exit(1)
  }
}

main()
