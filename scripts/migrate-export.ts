/**
 * Kapita → Loona Migration: Export Script
 *
 * Exports data from Kapita database to JSON files for import into Loona.
 *
 * Usage:
 *   # Using environment variable
 *   KAPITA_DATABASE_URL="postgresql://..." npx tsx scripts/migrate-export.ts
 *
 *   # Or create .env.kapita file with DATABASE_URL and use:
 *   npx tsx scripts/migrate-export.ts --env .env.kapita
 *
 * Output files will be created in loona/scripts/migration-data/
 */

import { drizzle } from "drizzle-orm/neon-http"
import { neon } from "@neondatabase/serverless"
import { isNotNull, sql } from "drizzle-orm"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
import {
  pgTable,
  text,
  varchar,
  decimal,
  integer,
  timestamp,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core"

// ============================================================================
// Parse arguments
// ============================================================================

const args = process.argv.slice(2)
let envFile = ".env.kapita"

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--env" && args[i + 1]) {
    envFile = args[i + 1]
  }
}

// Load environment
const envPath = path.resolve(process.cwd(), envFile)
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8")
  envContent.split("\n").forEach((line) => {
    const [key, ...valueParts] = line.split("=")
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join("=").trim().replace(/^["']|["']$/g, "")
    }
  })
  console.log(`Loaded environment from: ${envFile}`)
}

// Get database URL
const DATABASE_URL = process.env.KAPITA_DATABASE_URL || process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error("❌ No database URL found!")
  console.error("   Set KAPITA_DATABASE_URL environment variable or create .env.kapita file")
  process.exit(1)
}

const sqlClient = neon(DATABASE_URL)
const db = drizzle(sqlClient)

const OUTPUT_DIR = path.join(__dirname, "migration-data")

// ============================================================================
// Define Kapita schema inline (to avoid import issues)
// ============================================================================

const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull(),
  password: text("password"),
})

const userProfiles = pgTable("user_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  createdByLenderId: text("created_by_lender_id"),
  createdByAgentId: text("created_by_agent_id"),
  phoneNumber: varchar("phone_number", { length: 15 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  facebookProfile: text("facebook_profile"),
})

const loanProposals = pgTable("loan_proposals", {
  id: text("id").primaryKey(),
  borrowerId: text("borrower_id"),
  createdBy: text("created_by"),
  amountNeeded: decimal("amount_needed", { precision: 12, scale: 2 }).notNull(),
  purpose: text("purpose").notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).notNull(),
  termMonths: decimal("term_months", { precision: 5, scale: 2 }).notNull(),
  paymentFrequency: varchar("payment_frequency", { length: 20 }),
})

const activeLoans = pgTable("active_loans", {
  id: text("id").primaryKey(),
  loanProposalId: text("loan_proposal_id").notNull(),
  borrowerId: text("borrower_id"),
  principal: decimal("principal", { precision: 12, scale: 2 }).notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).notNull(),
  termMonths: decimal("term_months", { precision: 5, scale: 2 }).notNull(),
  paymentFrequency: varchar("payment_frequency", { length: 20 }).notNull(),
  paymentAmount: decimal("payment_amount", { precision: 12, scale: 2 }).notNull(),
  totalToRepay: decimal("total_to_repay", { precision: 12, scale: 2 }).notNull(),
  amountPaid: decimal("amount_paid", { precision: 12, scale: 2 }).notNull(),
  remainingBalance: decimal("remaining_balance", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  startedAt: timestamp("started_at").notNull(),
  maturityDate: timestamp("maturity_date"),
  completedAt: timestamp("completed_at"),
  createdByAgentId: text("created_by_agent_id"),
  metadata: jsonb("metadata"),
})

const paymentScheduleItems = pgTable("payment_schedule_items", {
  id: text("id").primaryKey(),
  loanId: text("loan_id").notNull(),
  dueDate: timestamp("due_date").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }),
  cumulativePaid: decimal("cumulative_paid", { precision: 12, scale: 2 }),
  paidAt: timestamp("paid_at"),
  lastPaymentAt: timestamp("last_payment_at"),
})

const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  activeLoanId: text("active_loan_id").notNull(),
  borrowerId: text("borrower_id"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull(),
  paidAt: timestamp("paid_at"),
  recordedByAgentId: text("recorded_by_agent_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull(),
})

const lenderAgents = pgTable("lender_agents", {
  id: text("id").primaryKey(),
  agentUserId: text("agent_user_id").notNull(),
  lenderId: text("lender_id").notNull(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }),
  status: varchar("status", { length: 20 }).notNull(),
  totalPaymentsCollected: decimal("total_payments_collected", { precision: 12, scale: 2 }).notNull(),
  totalCommissionEarned: decimal("total_commission_earned", { precision: 12, scale: 2 }).notNull(),
  totalCommissionPaid: decimal("total_commission_paid", { precision: 12, scale: 2 }).notNull(),
})

const agentCommissions = pgTable("agent_commissions", {
  id: text("id").primaryKey(),
  lenderAgentId: text("lender_agent_id").notNull(),
  paymentId: text("payment_id").notNull(),
  paymentAmount: decimal("payment_amount", { precision: 12, scale: 2 }).notNull(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull(),
  commissionAmount: decimal("commission_amount", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  paidAt: timestamp("paid_at"),
  paidBy: text("paid_by"),
})

// ============================================================================
// Export Functions
// ============================================================================

async function exportUsers() {
  console.log("Exporting users...")
  const users = await db.select().from(user)
  console.log(`  Found ${users.length} users`)
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    emailVerified: u.emailVerified,
    image: u.image,
    role: u.role,
    createdAt: u.createdAt,
  }))
}

async function exportAccounts() {
  console.log("Exporting accounts...")
  const accounts = await db.select().from(account)
  console.log(`  Found ${accounts.length} accounts`)
  return accounts.map((a) => ({
    id: a.id,
    accountId: a.accountId,
    providerId: a.providerId,
    userId: a.userId,
    password: a.password,
  }))
}

async function exportContacts() {
  console.log("Exporting user profiles as contacts...")

  const profiles = await db
    .select()
    .from(userProfiles)
    .where(isNotNull(userProfiles.createdByLenderId))

  const users = await db.select().from(user)
  const userMap = new Map(users.map((u) => [u.id, u]))

  console.log(`  Found ${profiles.length} member profiles`)

  return profiles.map((p) => {
    const u = userMap.get(p.userId)
    return {
      id: p.id,
      lenderId: p.createdByLenderId!,
      name: u?.name || "Unknown",
      phone: p.phoneNumber,
      email: u?.email || null,
      address: p.address,
      city: p.city,
      facebookProfile: p.facebookProfile,
      notes: null,
      createdByAgentId: p.createdByAgentId,
      originalUserId: p.userId,
    }
  })
}

async function exportLoans(contactMap: Map<string, string>) {
  console.log("Exporting active loans...")

  const loans = await db.select().from(activeLoans)
  const proposals = await db.select().from(loanProposals)
  const proposalMap = new Map(proposals.map((p) => [p.id, p]))

  console.log(`  Found ${loans.length} active loans`)

  return loans.map((loan) => {
    const proposal = proposalMap.get(loan.loanProposalId)

    const contactId = loan.borrowerId
      ? contactMap.get(loan.borrowerId) || loan.borrowerId
      : loan.borrowerId || ""

    let frequency = loan.paymentFrequency
    if (frequency === "bi-weekly") frequency = "biweekly"
    if (frequency === "semi-monthly") frequency = "semimonthly"

    let status = loan.status
    if (!["pending_disbursement", "active", "completed", "defaulted"].includes(status)) {
      status = "active"
    }

    const metadata = loan.metadata as {
      collateralDescription?: string
      coMaker?: { name: string; phone?: string; relationship?: string }
    } | null

    return {
      id: loan.id,
      lenderId: proposal?.createdBy || "",
      contactId,
      principal: loan.principal,
      interestRate: loan.interestRate,
      termMonths: Math.round(parseFloat(loan.termMonths)),
      paymentFrequency: frequency,
      paymentAmount: loan.paymentAmount,
      totalToRepay: loan.totalToRepay,
      amountPaid: loan.amountPaid,
      remainingBalance: loan.remainingBalance,
      purpose: proposal?.purpose || null,
      collateralDescription: metadata?.collateralDescription || null,
      coMakerName: metadata?.coMaker?.name || null,
      coMakerPhone: metadata?.coMaker?.phone || null,
      coMakerRelationship: metadata?.coMaker?.relationship || null,
      status,
      startDate: loan.startedAt,
      maturityDate: loan.maturityDate,
      completedAt: loan.completedAt,
      createdByAgentId: loan.createdByAgentId,
      assignedAgentId: null,
      createdAt: loan.startedAt,
      originalBorrowerId: loan.borrowerId,
    }
  })
}

async function exportScheduleItems() {
  console.log("Exporting payment schedule items...")

  const items = await db.select().from(paymentScheduleItems)
  console.log(`  Found ${items.length} schedule items`)

  return items.map((item) => {
    let status = item.status
    if (!["pending", "paid", "partial", "overdue"].includes(status)) {
      status = "pending"
    }

    return {
      id: item.id,
      loanId: item.loanId,
      dueDate: item.dueDate,
      amount: item.amount,
      status,
      paidAmount: item.paidAmount || item.cumulativePaid || "0",
      paidAt: item.paidAt || item.lastPaymentAt,
    }
  })
}

async function exportPayments() {
  console.log("Exporting payments...")

  const paymentRecords = await db.select().from(payments)
  console.log(`  Found ${paymentRecords.length} payments`)

  return paymentRecords.map((p) => {
    let method = p.paymentMethod
    if (method === "bank_transfer") method = "bank"
    if (!["cash", "gcash", "maya", "bank"].includes(method)) {
      method = "cash"
    }

    return {
      id: p.id,
      loanId: p.activeLoanId,
      scheduleItemId: null,
      amount: p.amount,
      method,
      paidAt: p.paidAt || p.createdAt,
      recordedByAgentId: p.recordedByAgentId,
      notes: p.notes,
    }
  })
}

async function exportAgents() {
  console.log("Exporting lender agents...")

  const agents = await db.select().from(lenderAgents)
  console.log(`  Found ${agents.length} agent relationships`)

  return agents.map((a) => ({
    id: a.id,
    agentUserId: a.agentUserId,
    lenderId: a.lenderId,
    commissionRate: a.commissionRate || "5.00",
    status: a.status,
    totalCollected: a.totalPaymentsCollected,
    totalCommissionEarned: a.totalCommissionEarned,
    totalCommissionPaid: a.totalCommissionPaid,
  }))
}

async function exportCommissions() {
  console.log("Exporting agent commissions...")

  const commissions = await db.select().from(agentCommissions)
  console.log(`  Found ${commissions.length} commission records`)

  return commissions.map((c) => ({
    id: c.id,
    agentId: c.lenderAgentId,
    paymentId: c.paymentId,
    paymentAmount: c.paymentAmount,
    commissionRate: c.commissionRate,
    commissionAmount: c.commissionAmount,
    status: c.status,
    paidAt: c.paidAt,
    paidBy: c.paidBy,
  }))
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("\n📤 Kapita → Loona Migration: Export\n")
  console.log(`Database: ${DATABASE_URL.replace(/:[^:@]+@/, ":***@")}\n`)

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  try {
    const users = await exportUsers()
    const accounts = await exportAccounts()
    const contacts = await exportContacts()

    const contactMap = new Map<string, string>()
    contacts.forEach((c) => {
      contactMap.set(c.originalUserId, c.id)
    })

    const loans = await exportLoans(contactMap)
    const scheduleItems = await exportScheduleItems()
    const paymentRecords = await exportPayments()
    const agents = await exportAgents()
    const commissions = await exportCommissions()

    const writeJson = (filename: string, data: unknown) => {
      const filepath = path.join(OUTPUT_DIR, filename)
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
      console.log(`  Written: ${filename}`)
    }

    console.log("\nWriting export files...")
    writeJson("users.json", users)
    writeJson("accounts.json", accounts)
    writeJson("contacts.json", contacts)
    writeJson("loans.json", loans)
    writeJson("schedule-items.json", scheduleItems)
    writeJson("payments.json", paymentRecords)
    writeJson("agents.json", agents)
    writeJson("commissions.json", commissions)

    const summary = {
      exportedAt: new Date().toISOString(),
      sourceDatabase: DATABASE_URL.replace(/:[^:@]+@/, ":***@"),
      counts: {
        users: users.length,
        accounts: accounts.length,
        contacts: contacts.length,
        loans: loans.length,
        scheduleItems: scheduleItems.length,
        payments: paymentRecords.length,
        agents: agents.length,
        commissions: commissions.length,
      },
    }
    writeJson("_summary.json", summary)

    console.log("\n✅ Export completed successfully!")
    console.log(`   Output directory: ${OUTPUT_DIR}`)
    console.log("\nNext step: Run migrate-import.ts with Loona database")
  } catch (error) {
    console.error("\n❌ Export failed:", error)
    process.exit(1)
  }
}

main()
