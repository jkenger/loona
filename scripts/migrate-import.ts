/**
 * Kapita → Loona Migration: Import Script
 *
 * Imports data from JSON files (created by migrate-export.ts) into Loona database.
 *
 * Usage:
 *   # Using environment variable
 *   LOONA_DATABASE_URL="postgresql://..." npx tsx scripts/migrate-import.ts
 *
 *   # Or use default .env file
 *   npx tsx scripts/migrate-import.ts
 *
 *   # Or specify env file
 *   npx tsx scripts/migrate-import.ts --env .env.production
 *
 * Options:
 *   --dry-run      Preview changes without writing to database
 *   --skip-auth    Skip importing users/accounts (if already exists)
 *   --env FILE     Load environment from specific file
 *   --verbose, -v  Show details about skipped records
 */

import { drizzle } from "drizzle-orm/neon-http"
import { neon } from "@neondatabase/serverless"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Parse command line arguments first
const args = process.argv.slice(2)
const DRY_RUN = args.includes("--dry-run")
const SKIP_AUTH = args.includes("--skip-auth")
const VERBOSE = args.includes("--verbose") || args.includes("-v")

let envFile = ".env"
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
const DATABASE_URL = process.env.LOONA_DATABASE_URL || process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error("❌ No database URL found!")
  console.error("   Set LOONA_DATABASE_URL environment variable or ensure .env has DATABASE_URL")
  process.exit(1)
}

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

const sqlClient = neon(DATABASE_URL)
const db = drizzle(sqlClient, { schema })

const INPUT_DIR = path.join(__dirname, "migration-data")

// ============================================================================
// Types (matching export types)
// ============================================================================

interface ExportedUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  role: string | null
  createdAt: string
}

interface ExportedAccount {
  id: string
  accountId: string
  providerId: string
  userId: string
  password: string | null
}

interface ExportedContact {
  id: string
  lenderId: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  facebookProfile: string | null
  notes: string | null
  createdByAgentId: string | null
  originalUserId: string
}

interface ExportedLoan {
  id: string
  lenderId: string
  contactId: string
  principal: string
  interestRate: string
  termMonths: number
  paymentFrequency: string
  paymentAmount: string
  totalToRepay: string
  amountPaid: string
  remainingBalance: string
  purpose: string | null
  collateralDescription: string | null
  coMakerName: string | null
  coMakerPhone: string | null
  coMakerRelationship: string | null
  status: string
  startDate: string | null
  maturityDate: string | null
  completedAt: string | null
  createdByAgentId: string | null
  assignedAgentId: string | null
  createdAt: string
  originalBorrowerId: string | null
}

interface ExportedScheduleItem {
  id: string
  loanId: string
  dueDate: string
  amount: string
  status: string
  paidAmount: string
  paidAt: string | null
}

interface ExportedPayment {
  id: string
  loanId: string
  scheduleItemId: string | null
  amount: string
  method: string
  paidAt: string
  recordedByAgentId: string | null
  notes: string | null
}

interface ExportedAgent {
  id: string
  agentUserId: string
  lenderId: string
  commissionRate: string
  status: string
  totalCollected: string
  totalCommissionEarned: string
  totalCommissionPaid: string
}

interface ExportedCommission {
  id: string
  agentId: string
  paymentId: string
  paymentAmount: string
  commissionRate: string
  commissionAmount: string
  status: string
  paidAt: string | null
  paidBy: string | null
}

// ============================================================================
// Helper Functions
// ============================================================================

function readJson<T>(filename: string): T {
  const filepath = path.join(INPUT_DIR, filename)
  if (!fs.existsSync(filepath)) {
    throw new Error(`File not found: ${filepath}`)
  }
  return JSON.parse(fs.readFileSync(filepath, "utf-8"))
}

function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null
  return new Date(dateStr)
}

// ============================================================================
// Import Functions
// ============================================================================

async function importUsers(users: ExportedUser[]): Promise<number> {
  if (SKIP_AUTH) {
    console.log("  Skipping users (--skip-auth)")
    return 0
  }

  // Filter out borrowers - in Loona, borrowers are contacts not users
  const nonBorrowerUsers = users.filter((u) => u.role !== "borrower")
  const skippedBorrowers = users.filter((u) => u.role === "borrower")

  console.log(`  Importing ${nonBorrowerUsers.length} users (skipping ${skippedBorrowers.length} borrowers - they become contacts)...`)

  if (VERBOSE && skippedBorrowers.length > 0) {
    console.log("    Skipped borrower users:")
    skippedBorrowers.forEach((u) => {
      console.log(`      - ${u.email} (${u.name})`)
    })
  }
  if (DRY_RUN) return nonBorrowerUsers.length

  let imported = 0
  for (const u of nonBorrowerUsers) {
    try {
      // Map role - only lender, agent, admin are valid in Loona
      let role: "lender" | "agent" | "admin" = "lender"
      if (u.role === "agent") role = "agent"
      if (u.role === "admin") role = "admin"

      await db.insert(user).values({
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: u.emailVerified,
        image: u.image,
        role,
        createdAt: new Date(u.createdAt),
        updatedAt: new Date(),
      }).onConflictDoNothing()
      imported++
    } catch (error) {
      console.warn(`    Warning: Failed to import user ${u.email}:`, error)
    }
  }
  return imported
}

async function importAccounts(
  accounts: ExportedAccount[],
  validUserIds: Set<string>
): Promise<number> {
  if (SKIP_AUTH) {
    console.log("  Skipping accounts (--skip-auth)")
    return 0
  }

  // Only import accounts for non-borrower users
  const validAccounts = accounts.filter((a) => validUserIds.has(a.userId))
  const skipped = accounts.length - validAccounts.length

  console.log(`  Importing ${validAccounts.length} accounts (skipping ${skipped} borrower accounts)...`)
  if (DRY_RUN) return validAccounts.length

  let imported = 0
  for (const a of validAccounts) {
    try {
      await db.insert(account).values({
        id: a.id,
        accountId: a.accountId,
        providerId: a.providerId,
        userId: a.userId,
        password: a.password,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoNothing()
      imported++
    } catch (error) {
      console.warn(`    Warning: Failed to import account ${a.id}:`, error)
    }
  }
  return imported
}

async function importAgents(agentData: ExportedAgent[]): Promise<number> {
  console.log(`  Importing ${agentData.length} agents...`)
  if (DRY_RUN) return agentData.length

  let imported = 0
  for (const a of agentData) {
    try {
      await db.insert(agents).values({
        id: a.id,
        agentUserId: a.agentUserId,
        lenderId: a.lenderId,
        commissionRate: a.commissionRate,
        status: a.status as "active" | "suspended" | "terminated",
        totalCollected: a.totalCollected,
        totalCommissionEarned: a.totalCommissionEarned,
        totalCommissionPaid: a.totalCommissionPaid,
      }).onConflictDoNothing()
      imported++
    } catch (error) {
      console.warn(`    Warning: Failed to import agent ${a.id}:`, error)
    }
  }
  return imported
}

async function importContacts(
  contactData: ExportedContact[],
  agentMap: Map<string, string>,
  validUserIds: Set<string>
): Promise<number> {
  // Filter contacts to only those with valid lender IDs
  const validContacts = contactData.filter((c) => validUserIds.has(c.lenderId))
  const skippedContacts = contactData.filter((c) => !validUserIds.has(c.lenderId))

  console.log(`  Importing ${validContacts.length} contacts (skipping ${skippedContacts.length} with missing lenders)...`)

  if (VERBOSE && skippedContacts.length > 0) {
    console.log("    Skipped contacts (missing lender):")
    // Group by lender ID
    const byLender = new Map<string, ExportedContact[]>()
    skippedContacts.forEach((c) => {
      if (!byLender.has(c.lenderId)) byLender.set(c.lenderId, [])
      byLender.get(c.lenderId)!.push(c)
    })
    byLender.forEach((contacts, lenderId) => {
      console.log(`      Lender ${lenderId}: ${contacts.length} contacts`)
      contacts.slice(0, 5).forEach((c) => {
        console.log(`        - ${c.name} (${c.email || c.phone || 'no contact'})`)
      })
      if (contacts.length > 5) {
        console.log(`        ... and ${contacts.length - 5} more`)
      }
    })
  }
  if (DRY_RUN) return validContacts.length

  let imported = 0
  for (const c of validContacts) {
    try {
      // Map agent user ID to agent relationship ID
      const agentId = c.createdByAgentId
        ? agentMap.get(c.createdByAgentId)
        : null

      await db.insert(contacts).values({
        id: c.id,
        lenderId: c.lenderId,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        city: c.city,
        facebookProfile: c.facebookProfile,
        notes: c.notes,
        createdByAgentId: agentId,
      }).onConflictDoNothing()
      imported++
    } catch (error) {
      console.warn(`    Warning: Failed to import contact ${c.name}:`, error)
    }
  }
  return imported
}

async function importLoans(
  loanData: ExportedLoan[],
  agentMap: Map<string, string>,
  validUserIds: Set<string>,
  validContactIds: Set<string>
): Promise<number> {
  // Filter loans to only those with valid lender and contact IDs
  const validLoans = loanData.filter(
    (l) => validUserIds.has(l.lenderId) && validContactIds.has(l.contactId)
  )
  const skippedLoans = loanData.filter(
    (l) => !validUserIds.has(l.lenderId) || !validContactIds.has(l.contactId)
  )

  console.log(`  Importing ${validLoans.length} loans (skipping ${skippedLoans.length} with missing lenders/contacts)...`)

  if (VERBOSE && skippedLoans.length > 0) {
    console.log("    Skipped loans:")
    // Group by reason
    const missingLender = skippedLoans.filter((l) => !validUserIds.has(l.lenderId))
    const missingContact = skippedLoans.filter((l) => validUserIds.has(l.lenderId) && !validContactIds.has(l.contactId))

    if (missingLender.length > 0) {
      console.log(`      Missing lender (${missingLender.length} loans):`)
      const byLender = new Map<string, ExportedLoan[]>()
      missingLender.forEach((l) => {
        if (!byLender.has(l.lenderId)) byLender.set(l.lenderId, [])
        byLender.get(l.lenderId)!.push(l)
      })
      byLender.forEach((loans, lenderId) => {
        const total = loans.reduce((sum, l) => sum + parseFloat(l.principal), 0)
        console.log(`        Lender ${lenderId}: ${loans.length} loans, ₱${total.toLocaleString()} principal`)
      })
    }

    if (missingContact.length > 0) {
      console.log(`      Missing contact (${missingContact.length} loans):`)
      missingContact.slice(0, 5).forEach((l) => {
        console.log(`        - Loan ${l.id.slice(0, 8)}... (₱${parseFloat(l.principal).toLocaleString()}, contact: ${l.contactId.slice(0, 8)}...)`)
      })
      if (missingContact.length > 5) {
        console.log(`        ... and ${missingContact.length - 5} more`)
      }
    }
  }
  if (DRY_RUN) return validLoans.length

  let imported = 0
  for (const l of validLoans) {
    try {
      // Map agent user IDs to agent relationship IDs
      const createdByAgentId = l.createdByAgentId
        ? agentMap.get(l.createdByAgentId)
        : null
      const assignedAgentId = l.assignedAgentId
        ? agentMap.get(l.assignedAgentId)
        : null

      await db.insert(loans).values({
        id: l.id,
        lenderId: l.lenderId,
        contactId: l.contactId,
        principal: l.principal,
        interestRate: l.interestRate,
        termMonths: l.termMonths,
        paymentFrequency: l.paymentFrequency as "daily" | "weekly" | "biweekly" | "semimonthly" | "monthly",
        paymentAmount: l.paymentAmount,
        totalToRepay: l.totalToRepay,
        amountPaid: l.amountPaid,
        remainingBalance: l.remainingBalance,
        purpose: l.purpose,
        collateralDescription: l.collateralDescription,
        coMakerName: l.coMakerName,
        coMakerPhone: l.coMakerPhone,
        coMakerRelationship: l.coMakerRelationship,
        status: l.status as "pending_disbursement" | "active" | "completed" | "defaulted",
        startDate: parseDate(l.startDate),
        maturityDate: parseDate(l.maturityDate),
        completedAt: parseDate(l.completedAt),
        createdByAgentId,
        assignedAgentId,
      }).onConflictDoNothing()
      imported++
    } catch (error) {
      console.warn(`    Warning: Failed to import loan ${l.id}:`, error)
    }
  }
  return imported
}

async function importScheduleItems(
  items: ExportedScheduleItem[],
  validLoanIds: Set<string>
): Promise<number> {
  const validItems = items.filter((item) => validLoanIds.has(item.loanId))
  const skipped = items.length - validItems.length

  console.log(`  Importing ${validItems.length} schedule items (skipping ${skipped} with missing loans)...`)
  if (DRY_RUN) return validItems.length

  let imported = 0
  for (const item of validItems) {
    try {
      await db.insert(paymentSchedule).values({
        id: item.id,
        loanId: item.loanId,
        dueDate: new Date(item.dueDate),
        amount: item.amount,
        status: item.status as "pending" | "paid" | "partial" | "overdue",
        paidAmount: item.paidAmount,
        paidAt: parseDate(item.paidAt),
      }).onConflictDoNothing()
      imported++
    } catch (error) {
      console.warn(`    Warning: Failed to import schedule item ${item.id}:`, error)
    }
  }
  return imported
}

async function importPayments(
  paymentData: ExportedPayment[],
  agentMap: Map<string, string>,
  validLoanIds: Set<string>
): Promise<number> {
  const validPayments = paymentData.filter((p) => validLoanIds.has(p.loanId))
  const skipped = paymentData.length - validPayments.length

  console.log(`  Importing ${validPayments.length} payments (skipping ${skipped} with missing loans)...`)
  if (DRY_RUN) return validPayments.length

  let imported = 0
  for (const p of validPayments) {
    try {
      // Map agent user ID to agent relationship ID
      const agentId = p.recordedByAgentId
        ? agentMap.get(p.recordedByAgentId)
        : null

      await db.insert(payments).values({
        id: p.id,
        loanId: p.loanId,
        scheduleItemId: p.scheduleItemId,
        amount: p.amount,
        method: p.method as "cash" | "gcash" | "maya" | "bank",
        paidAt: new Date(p.paidAt),
        recordedByAgentId: agentId,
        notes: p.notes,
      }).onConflictDoNothing()
      imported++
    } catch (error) {
      console.warn(`    Warning: Failed to import payment ${p.id}:`, error)
    }
  }
  return imported
}

async function importCommissions(
  commissionData: ExportedCommission[],
  validPaymentIds: Set<string>,
  validAgentIds: Set<string>
): Promise<number> {
  const validCommissions = commissionData.filter(
    (c) => validPaymentIds.has(c.paymentId) && validAgentIds.has(c.agentId)
  )
  const skipped = commissionData.length - validCommissions.length

  console.log(`  Importing ${validCommissions.length} commissions (skipping ${skipped} with missing payments/agents)...`)
  if (DRY_RUN) return validCommissions.length

  let imported = 0
  for (const c of validCommissions) {
    try {
      await db.insert(commissions).values({
        id: c.id,
        agentId: c.agentId,
        paymentId: c.paymentId,
        paymentAmount: c.paymentAmount,
        commissionRate: c.commissionRate,
        commissionAmount: c.commissionAmount,
        status: c.status as "pending" | "paid",
        paidAt: parseDate(c.paidAt),
        paidBy: c.paidBy,
      }).onConflictDoNothing()
      imported++
    } catch (error) {
      console.warn(`    Warning: Failed to import commission ${c.id}:`, error)
    }
  }
  return imported
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("\n📥 Kapita → Loona Migration: Import\n")
  console.log(`Database: ${DATABASE_URL.replace(/:[^:@]+@/, ":***@")}\n`)

  if (DRY_RUN) {
    console.log("🔍 DRY RUN MODE - No changes will be made\n")
  }

  // Check for input files
  const summaryPath = path.join(INPUT_DIR, "_summary.json")
  if (!fs.existsSync(summaryPath)) {
    console.error(`❌ Export files not found at: ${INPUT_DIR}`)
    console.error("   Run migrate-export.ts first from Kapita directory")
    process.exit(1)
  }

  const summary = readJson<{
    exportedAt: string
    counts: Record<string, number>
  }>("_summary.json")
  console.log(`Found export from: ${summary.exportedAt}`)
  console.log(`Counts: ${JSON.stringify(summary.counts)}\n`)

  try {
    // Read all data files
    const users = readJson<ExportedUser[]>("users.json")
    const accounts = readJson<ExportedAccount[]>("accounts.json")
    const contactData = readJson<ExportedContact[]>("contacts.json")
    const loanData = readJson<ExportedLoan[]>("loans.json")
    const scheduleData = readJson<ExportedScheduleItem[]>("schedule-items.json")
    const paymentData = readJson<ExportedPayment[]>("payments.json")
    const agentData = readJson<ExportedAgent[]>("agents.json")
    const commissionData = readJson<ExportedCommission[]>("commissions.json")

    // Build agent user ID → agent relationship ID map
    // This is needed because Kapita stores agent user IDs, but Loona references agent relationship IDs
    const agentMap = new Map<string, string>()
    agentData.forEach((a) => {
      agentMap.set(a.agentUserId, a.id)
    })

    console.log("Starting import...\n")

    // Show analysis of what will be skipped
    if (VERBOSE) {
      console.log("📋 Data Analysis:\n")

      // Find missing lenders (users referenced in contacts/loans but not in users)
      const allUserIds = new Set(users.map((u) => u.id))
      const referencedLenderIds = new Set([
        ...contactData.map((c) => c.lenderId),
        ...loanData.map((l) => l.lenderId),
      ])
      const missingLenderIds = [...referencedLenderIds].filter((id) => !allUserIds.has(id))

      if (missingLenderIds.length > 0) {
        console.log(`  ⚠️  Missing lenders (${missingLenderIds.length} IDs referenced but not in export):`)
        missingLenderIds.forEach((id) => {
          const contactCount = contactData.filter((c) => c.lenderId === id).length
          const loanCount = loanData.filter((l) => l.lenderId === id).length
          console.log(`      - ${id}`)
          console.log(`        Referenced by: ${contactCount} contacts, ${loanCount} loans`)
        })
        console.log("")
      }

      // Show borrowers being converted
      const borrowerUsers = users.filter((u) => u.role === "borrower")
      if (borrowerUsers.length > 0) {
        console.log(`  ℹ️  Borrowers to skip (${borrowerUsers.length} - they become contacts in Loona):`)
        borrowerUsers.slice(0, 5).forEach((u) => {
          console.log(`      - ${u.email} (${u.name})`)
        })
        if (borrowerUsers.length > 5) {
          console.log(`      ... and ${borrowerUsers.length - 5} more`)
        }
        console.log("")
      }

      // Show lenders being imported
      const lenderUsers = users.filter((u) => u.role === "lender" || u.role === "admin")
      console.log(`  ✓  Lenders/Admins to import (${lenderUsers.length}):`)
      lenderUsers.forEach((u) => {
        console.log(`      - ${u.email} (${u.name}) [${u.role}]`)
      })
      console.log("")
    }

    // Import in order (respecting foreign key constraints)
    // Build set of valid (non-borrower) user IDs for account filtering
    const validUserIds = new Set(
      users.filter((u) => u.role !== "borrower").map((u) => u.id)
    )

    // Build set of valid contact IDs (contacts with valid lenders)
    const validContactIds = new Set(
      contactData.filter((c) => validUserIds.has(c.lenderId)).map((c) => c.id)
    )

    // Build set of valid loan IDs (loans with valid lenders and contacts)
    const validLoanIds = new Set(
      loanData
        .filter((l) => validUserIds.has(l.lenderId) && validContactIds.has(l.contactId))
        .map((l) => l.id)
    )

    // Build set of valid payment IDs (payments with valid loans)
    const validPaymentIds = new Set(
      paymentData.filter((p) => validLoanIds.has(p.loanId)).map((p) => p.id)
    )

    // Build set of valid agent IDs
    const validAgentIds = new Set(agentData.map((a) => a.id))

    const results = {
      users: await importUsers(users),
      accounts: await importAccounts(accounts, validUserIds),
      agents: await importAgents(agentData),
      contacts: await importContacts(contactData, agentMap, validUserIds),
      loans: await importLoans(loanData, agentMap, validUserIds, validContactIds),
      scheduleItems: await importScheduleItems(scheduleData, validLoanIds),
      payments: await importPayments(paymentData, agentMap, validLoanIds),
      commissions: await importCommissions(commissionData, validPaymentIds, validAgentIds),
    }

    console.log("\n📊 Import Summary:")
    console.log("─".repeat(40))
    Object.entries(results).forEach(([key, count]) => {
      console.log(`  ${key.padEnd(15)} ${count}`)
    })
    console.log("─".repeat(40))

    if (DRY_RUN) {
      console.log("\n🔍 DRY RUN COMPLETE - No changes were made")
      console.log("   Remove --dry-run flag to perform actual import")
    } else {
      console.log("\n✅ Import completed successfully!")
    }
  } catch (error) {
    console.error("\n❌ Import failed:", error)
    process.exit(1)
  }
}

main()
