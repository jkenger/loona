/**
 * Kapita → Loona: Focused Migration
 *
 * Migrates data for specific lenders only, ensuring all related data is included.
 *
 * Usage:
 *   KAPITA_DATABASE_URL="..." LOONA_DATABASE_URL="..." npx tsx scripts/migrate-focused.ts
 *
 * Options:
 *   --dry-run    Preview without writing
 *   --verbose    Show detailed output
 */

import { drizzle } from "drizzle-orm/neon-http"
import { neon } from "@neondatabase/serverless"
import { eq, inArray, sql } from "drizzle-orm"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ============================================================================
// Configuration - EDIT THESE
// ============================================================================

const TARGET_LENDER_EMAILS = [
  "johnkger@gmail.com",
  "nhesgervacio26@gmail.com",
  "johnkgervacio@gmail.com",
]

// ============================================================================
// Parse arguments and load environment
// ============================================================================

const args = process.argv.slice(2)
const DRY_RUN = args.includes("--dry-run")
const VERBOSE = args.includes("--verbose") || args.includes("-v")

// Load .env files
function loadEnv(filename: string) {
  const envPath = path.resolve(process.cwd(), filename)
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8")
    content.split("\n").forEach((line) => {
      const [key, ...valueParts] = line.split("=")
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "")
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value
        }
      }
    })
  }
}

loadEnv(".env.kapita")
loadEnv(".env")

const KAPITA_URL = process.env.KAPITA_DATABASE_URL
const LOONA_URL = process.env.LOONA_DATABASE_URL || process.env.DATABASE_URL

if (!KAPITA_URL) {
  console.error("❌ KAPITA_DATABASE_URL not set")
  process.exit(1)
}
if (!LOONA_URL) {
  console.error("❌ LOONA_DATABASE_URL or DATABASE_URL not set")
  process.exit(1)
}

// ============================================================================
// Database connections
// ============================================================================

const kapitaDb = drizzle(neon(KAPITA_URL))
const loonaDb = drizzle(neon(LOONA_URL))

// Helper to create IN clause
function inList(values: string[]) {
  if (values.length === 0) return sql`(NULL)` // Empty list returns nothing
  return sql`(${sql.join(values.map(v => sql`${v}`), sql`, `)})`
}

// ============================================================================
// Raw SQL queries for Kapita (source)
// ============================================================================

async function fetchKapitaData() {
  console.log("\n📤 Fetching data from Kapita...\n")

  // 1. Get target lender users
  const lenders = await kapitaDb.execute(sql`
    SELECT id, name, email, email_verified, image, role, created_at
    FROM "user"
    WHERE email IN ${inList(TARGET_LENDER_EMAILS)}
  `)
  console.log(`  Lenders: ${lenders.rows.length}`)

  if (lenders.rows.length === 0) {
    throw new Error("No target lenders found!")
  }

  const lenderIds = lenders.rows.map((r: any) => r.id)
  if (VERBOSE) {
    lenders.rows.forEach((r: any) => console.log(`    - ${r.email} (${r.id})`))
  }

  // 2. Get accounts for lenders
  const accounts = await kapitaDb.execute(sql`
    SELECT id, account_id, provider_id, user_id, password
    FROM account
    WHERE user_id IN ${inList(lenderIds)}
  `)
  console.log(`  Accounts: ${accounts.rows.length}`)

  // 3. Get agents for these lenders
  const agents = await kapitaDb.execute(sql`
    SELECT id, agent_user_id, lender_id, commission_rate, status,
           total_payments_collected, total_commission_earned, total_commission_paid
    FROM lender_agents
    WHERE lender_id IN ${inList(lenderIds)}
  `)
  console.log(`  Agents: ${agents.rows.length}`)

  // Get agent user IDs to also import them
  const agentUserIds = agents.rows.map((r: any) => r.agent_user_id)

  // 4. Get agent users
  let agentUsers: any[] = []
  let agentAccounts: any[] = []
  if (agentUserIds.length > 0) {
    const agentUsersResult = await kapitaDb.execute(sql`
      SELECT id, name, email, email_verified, image, role, created_at
      FROM "user"
      WHERE id IN ${inList(agentUserIds)}
    `)
    agentUsers = agentUsersResult.rows as any[]

    const agentAccountsResult = await kapitaDb.execute(sql`
      SELECT id, account_id, provider_id, user_id, password
      FROM account
      WHERE user_id IN ${inList(agentUserIds)}
    `)
    agentAccounts = agentAccountsResult.rows as any[]
    console.log(`  Agent users: ${agentUsers.length}`)
  }

  // 5. Get user profiles (members/borrowers) created by these lenders
  const profiles = await kapitaDb.execute(sql`
    SELECT up.id, up.user_id, up.created_by_lender_id, up.created_by_agent_id,
           up.phone_number, up.address, up.city, up.facebook_profile,
           u.name, u.email
    FROM user_profiles up
    JOIN "user" u ON u.id = up.user_id
    WHERE up.created_by_lender_id IN ${inList(lenderIds)}
  `)
  console.log(`  Members/Contacts (by lender): ${profiles.rows.length}`)

  // 6. Get loan proposals created by these lenders
  const proposals = await kapitaDb.execute(sql`
    SELECT id, borrower_id, created_by, amount_needed, purpose,
           interest_rate, term_months, payment_frequency
    FROM loan_proposals
    WHERE created_by IN ${inList(lenderIds)}
  `)
  console.log(`  Loan proposals: ${proposals.rows.length}`)

  const proposalIds = proposals.rows.map((r: any) => r.id)

  // 7. Get active loans for these proposals
  let loans: any[] = []
  if (proposalIds.length > 0) {
    const loansResult = await kapitaDb.execute(sql`
      SELECT id, loan_proposal_id, borrower_id, principal, interest_rate,
             term_months, payment_frequency, payment_amount, total_to_repay,
             amount_paid, remaining_balance, status, started_at, maturity_date,
             completed_at, created_by_agent_id, metadata
      FROM active_loans
      WHERE loan_proposal_id IN ${inList(proposalIds)}
    `)
    loans = loansResult.rows as any[]
  }
  console.log(`  Active loans: ${loans.length}`)

  const loanIds = loans.map((r: any) => r.id)

  // 7b. Get additional borrowers from loans who aren't in profiles
  const borrowerIdsInLoans = [...new Set(loans.map((l: any) => l.borrower_id).filter(Boolean))]
  const profileBorrowerIds = new Set(profiles.rows.map((p: any) => p.user_id))
  const missingBorrowerIds = borrowerIdsInLoans.filter(id => !profileBorrowerIds.has(id))

  let additionalBorrowers: any[] = []
  if (missingBorrowerIds.length > 0) {
    const borrowersResult = await kapitaDb.execute(sql`
      SELECT u.id, u.name, u.email,
             up.phone_number, up.address, up.city, up.facebook_profile
      FROM "user" u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.id IN ${inList(missingBorrowerIds)}
    `)
    additionalBorrowers = borrowersResult.rows as any[]
    console.log(`  Additional borrowers (from loans): ${additionalBorrowers.length}`)
  }

  // 8. Get payment schedule items
  let scheduleItems: any[] = []
  if (loanIds.length > 0) {
    const scheduleResult = await kapitaDb.execute(sql`
      SELECT id, loan_id, due_date, amount, status, paid_amount, cumulative_paid,
             paid_at, last_payment_at
      FROM payment_schedule_items
      WHERE loan_id IN ${inList(loanIds)}
    `)
    scheduleItems = scheduleResult.rows as any[]
  }
  console.log(`  Schedule items: ${scheduleItems.length}`)

  // 9. Get payments
  let payments: any[] = []
  if (loanIds.length > 0) {
    const paymentsResult = await kapitaDb.execute(sql`
      SELECT id, active_loan_id, amount, payment_method, paid_at,
             recorded_by_agent_id, notes, created_at
      FROM payments
      WHERE active_loan_id IN ${inList(loanIds)}
    `)
    payments = paymentsResult.rows as any[]
  }
  console.log(`  Payments: ${payments.length}`)

  const paymentIds = payments.map((r: any) => r.id)
  const agentIds = agents.rows.map((r: any) => r.id)

  // 10. Get commissions
  let commissions: any[] = []
  if (paymentIds.length > 0 && agentIds.length > 0) {
    const commissionsResult = await kapitaDb.execute(sql`
      SELECT id, lender_agent_id, payment_id, payment_amount, commission_rate,
             commission_amount, status, paid_at, paid_by
      FROM agent_commissions
      WHERE payment_id IN ${inList(paymentIds)}
        AND lender_agent_id IN ${inList(agentIds)}
    `)
    commissions = commissionsResult.rows as any[]
  }
  console.log(`  Commissions: ${commissions.length}`)

  return {
    lenders: lenders.rows as any[],
    accounts: accounts.rows as any[],
    agentUsers,
    agentAccounts,
    agents: agents.rows as any[],
    profiles: profiles.rows as any[],
    additionalBorrowers,
    proposals: proposals.rows as any[],
    loans,
    scheduleItems,
    payments,
    commissions,
  }
}

// ============================================================================
// Transform and import to Loona
// ============================================================================

async function importToLoona(data: Awaited<ReturnType<typeof fetchKapitaData>>) {
  console.log("\n📥 Importing to Loona...\n")

  if (DRY_RUN) {
    console.log("🔍 DRY RUN MODE - No changes will be made\n")
  }

  // Build mappings
  const borrowerToContactMap = new Map<string, string>() // borrower user ID → contact ID
  const proposalToLoanMap = new Map<string, any>() // proposal ID → loan data

  data.proposals.forEach((p: any) => {
    proposalToLoanMap.set(p.id, p)
  })

  // 1. Import lender users
  console.log(`  Importing ${data.lenders.length} lenders...`)
  if (!DRY_RUN) {
    for (const u of data.lenders) {
      await loonaDb.execute(sql`
        INSERT INTO "user" (id, name, email, email_verified, image, role, created_at, updated_at)
        VALUES (${u.id}, ${u.name}, ${u.email}, ${u.email_verified}, ${u.image}, 'lender', ${u.created_at}, NOW())
        ON CONFLICT (id) DO NOTHING
      `)
    }
  }

  // 2. Import lender accounts
  console.log(`  Importing ${data.accounts.length} lender accounts...`)
  if (!DRY_RUN) {
    for (const a of data.accounts) {
      await loonaDb.execute(sql`
        INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
        VALUES (${a.id}, ${a.account_id}, ${a.provider_id}, ${a.user_id}, ${a.password}, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `)
    }
  }

  // 3. Import agent users
  console.log(`  Importing ${data.agentUsers.length} agent users...`)
  if (!DRY_RUN) {
    for (const u of data.agentUsers) {
      await loonaDb.execute(sql`
        INSERT INTO "user" (id, name, email, email_verified, image, role, created_at, updated_at)
        VALUES (${u.id}, ${u.name}, ${u.email}, ${u.email_verified}, ${u.image}, 'agent', ${u.created_at}, NOW())
        ON CONFLICT (id) DO NOTHING
      `)
    }
  }

  // 4. Import agent accounts
  console.log(`  Importing ${data.agentAccounts.length} agent accounts...`)
  if (!DRY_RUN) {
    for (const a of data.agentAccounts) {
      await loonaDb.execute(sql`
        INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
        VALUES (${a.id}, ${a.account_id}, ${a.provider_id}, ${a.user_id}, ${a.password}, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `)
    }
  }

  // 5. Import agents (lender-agent relationships)
  console.log(`  Importing ${data.agents.length} agent relationships...`)
  if (!DRY_RUN) {
    for (const a of data.agents) {
      await loonaDb.execute(sql`
        INSERT INTO agents (id, agent_user_id, lender_id, commission_rate, status,
                           total_collected, total_commission_earned, total_commission_paid, created_at)
        VALUES (${a.id}, ${a.agent_user_id}, ${a.lender_id}, ${a.commission_rate || "5.00"}, ${a.status},
                ${a.total_payments_collected}, ${a.total_commission_earned}, ${a.total_commission_paid}, NOW())
        ON CONFLICT (id) DO NOTHING
      `)
    }
  }

  // Build agent user ID → agent relationship ID map
  const agentUserToRelationshipMap = new Map<string, string>()
  data.agents.forEach((a: any) => {
    agentUserToRelationshipMap.set(a.agent_user_id, a.id)
  })

  // 6. Import contacts (from user profiles)
  console.log(`  Importing ${data.profiles.length} contacts from profiles...`)
  if (!DRY_RUN) {
    for (const p of data.profiles) {
      const agentRelationshipId = p.created_by_agent_id
        ? agentUserToRelationshipMap.get(p.created_by_agent_id)
        : null

      await loonaDb.execute(sql`
        INSERT INTO contacts (id, lender_id, name, phone, email, address, city, facebook_profile,
                             notes, created_by_agent_id, created_at, updated_at)
        VALUES (${p.id}, ${p.created_by_lender_id}, ${p.name}, ${p.phone_number}, ${p.email},
                ${p.address}, ${p.city}, ${p.facebook_profile}, NULL, ${agentRelationshipId}, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `)

      // Map borrower user ID to contact ID
      borrowerToContactMap.set(p.user_id, p.id)
    }
  } else {
    // Still need to build the map for dry run counts
    data.profiles.forEach((p: any) => {
      borrowerToContactMap.set(p.user_id, p.id)
    })
  }

  // 6b. Import additional borrowers as contacts (assign to lender based on their loans)
  console.log(`  Importing ${data.additionalBorrowers.length} additional contacts from loans...`)

  // Build borrower → lender mapping from loans
  const borrowerToLenderMap = new Map<string, string>()
  data.loans.forEach((loan: any) => {
    if (loan.borrower_id) {
      const proposal = proposalToLoanMap.get(loan.loan_proposal_id)
      if (proposal?.created_by) {
        borrowerToLenderMap.set(loan.borrower_id, proposal.created_by)
      }
    }
  })

  if (!DRY_RUN) {
    for (const b of data.additionalBorrowers) {
      const lenderId = borrowerToLenderMap.get(b.id)
      if (!lenderId) {
        console.warn(`    ⚠️ Cannot find lender for borrower ${b.id} (${b.name})`)
        continue
      }

      const contactId = crypto.randomUUID()
      await loonaDb.execute(sql`
        INSERT INTO contacts (id, lender_id, name, phone, email, address, city, facebook_profile,
                             notes, created_by_agent_id, created_at, updated_at)
        VALUES (${contactId}, ${lenderId}, ${b.name}, ${b.phone_number}, ${b.email},
                ${b.address}, ${b.city}, ${b.facebook_profile}, NULL, NULL, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `)

      borrowerToContactMap.set(b.id, contactId)
    }
  } else {
    // Still build the map for dry run
    data.additionalBorrowers.forEach((b: any) => {
      const lenderId = borrowerToLenderMap.get(b.id)
      if (lenderId) {
        const contactId = `temp-${b.id}` // Temporary ID for dry run
        borrowerToContactMap.set(b.id, contactId)
      }
    })
  }

  // 7. Import loans
  const importedLoanIds = new Set<string>()
  console.log(`  Importing ${data.loans.length} loans...`)

  for (const loan of data.loans) {
    const proposal = proposalToLoanMap.get(loan.loan_proposal_id)
    const contactId = borrowerToContactMap.get(loan.borrower_id)

    if (!contactId) {
      console.warn(`    ⚠️ Skipping loan ${loan.id} - no contact for borrower ${loan.borrower_id}`)
      continue
    }

    // Parse metadata for collateral and co-maker
    let collateralDescription = null
    let coMakerName = null
    let coMakerPhone = null
    let coMakerRelationship = null

    if (loan.metadata) {
      const meta = typeof loan.metadata === "string" ? JSON.parse(loan.metadata) : loan.metadata
      collateralDescription = meta.collateralDescription || null
      if (meta.coMaker) {
        coMakerName = meta.coMaker.name || null
        coMakerPhone = meta.coMaker.phone || null
        coMakerRelationship = meta.coMaker.relationship || null
      }
    }

    // Map payment frequency
    let frequency = loan.payment_frequency
    if (frequency === "bi-weekly") frequency = "biweekly"
    if (frequency === "semi-monthly") frequency = "semimonthly"

    // Map status
    let status = loan.status
    if (!["pending_disbursement", "active", "completed", "defaulted"].includes(status)) {
      status = "active"
    }

    // Map agent IDs
    const createdByAgentId = loan.created_by_agent_id
      ? agentUserToRelationshipMap.get(loan.created_by_agent_id)
      : null

    if (!DRY_RUN) {
      await loonaDb.execute(sql`
        INSERT INTO loans (id, lender_id, contact_id, principal, interest_rate, term_months,
                          payment_frequency, payment_amount, total_to_repay, amount_paid,
                          remaining_balance, purpose, collateral_description, co_maker_name,
                          co_maker_phone, co_maker_relationship, status, start_date, maturity_date,
                          completed_at, created_by_agent_id, assigned_agent_id, created_at, updated_at)
        VALUES (${loan.id}, ${proposal?.created_by}, ${contactId}, ${loan.principal}, ${loan.interest_rate},
                ${Math.round(parseFloat(loan.term_months))}, ${frequency}, ${loan.payment_amount},
                ${loan.total_to_repay}, ${loan.amount_paid}, ${loan.remaining_balance},
                ${proposal?.purpose}, ${collateralDescription}, ${coMakerName}, ${coMakerPhone},
                ${coMakerRelationship}, ${status}, ${loan.started_at}, ${loan.maturity_date},
                ${loan.completed_at}, ${createdByAgentId}, NULL, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `)
    }

    importedLoanIds.add(loan.id)
  }

  console.log(`    ✓ ${importedLoanIds.size} loans will be imported`)

  // 8. Import payment schedule (only for imported loans)
  const validScheduleItems = data.scheduleItems.filter((item: any) => importedLoanIds.has(item.loan_id))
  console.log(`  Importing ${validScheduleItems.length} schedule items (skipping ${data.scheduleItems.length - validScheduleItems.length} for missing loans)...`)

  if (!DRY_RUN) {
    for (const item of validScheduleItems) {
      let status = item.status
      if (!["pending", "paid", "partial", "overdue"].includes(status)) {
        status = "pending"
      }

      await loonaDb.execute(sql`
        INSERT INTO payment_schedule (id, loan_id, due_date, amount, status, paid_amount, paid_at, created_at)
        VALUES (${item.id}, ${item.loan_id}, ${item.due_date}, ${item.amount}, ${status},
                ${item.paid_amount || item.cumulative_paid || "0"}, ${item.paid_at || item.last_payment_at}, NOW())
        ON CONFLICT (id) DO NOTHING
      `)
    }
  }

  // 9. Import payments (only for imported loans)
  const validPayments = data.payments.filter((p: any) => importedLoanIds.has(p.active_loan_id))
  console.log(`  Importing ${validPayments.length} payments (skipping ${data.payments.length - validPayments.length} for missing loans)...`)

  const importedPaymentIds = new Set<string>()
  if (!DRY_RUN) {
    for (const p of validPayments) {
      let method = p.payment_method
      if (method === "bank_transfer") method = "bank"
      if (!["cash", "gcash", "maya", "bank"].includes(method)) {
        method = "cash"
      }

      const agentId = p.recorded_by_agent_id
        ? agentUserToRelationshipMap.get(p.recorded_by_agent_id)
        : null

      await loonaDb.execute(sql`
        INSERT INTO payments (id, loan_id, schedule_item_id, amount, method, paid_at,
                             recorded_by_agent_id, notes, created_at)
        VALUES (${p.id}, ${p.active_loan_id}, NULL, ${p.amount}, ${method},
                ${p.paid_at || p.created_at}, ${agentId}, ${p.notes}, NOW())
        ON CONFLICT (id) DO NOTHING
      `)

      importedPaymentIds.add(p.id)
    }
  } else {
    validPayments.forEach((p: any) => importedPaymentIds.add(p.id))
  }

  // 10. Import commissions (only for imported payments)
  const validCommissions = data.commissions.filter((c: any) => importedPaymentIds.has(c.payment_id))
  console.log(`  Importing ${validCommissions.length} commissions (skipping ${data.commissions.length - validCommissions.length} for missing payments)...`)

  if (!DRY_RUN) {
    for (const c of validCommissions) {
      await loonaDb.execute(sql`
        INSERT INTO commissions (id, agent_id, payment_id, payment_amount, commission_rate,
                                commission_amount, status, paid_at, paid_by, created_at)
        VALUES (${c.id}, ${c.lender_agent_id}, ${c.payment_id}, ${c.payment_amount},
                ${c.commission_rate}, ${c.commission_amount}, ${c.status}, ${c.paid_at}, ${c.paid_by}, NOW())
        ON CONFLICT (id) DO NOTHING
      `)
    }
  }

  // Summary
  console.log("\n📊 Migration Summary:")
  console.log("─".repeat(40))
  console.log(`  Lenders:        ${data.lenders.length}`)
  console.log(`  Agents:         ${data.agents.length}`)
  console.log(`  Contacts:       ${data.profiles.length + data.additionalBorrowers.length}`)
  console.log(`  Loans:          ${importedLoanIds.size} / ${data.loans.length}`)
  console.log(`  Schedule items: ${validScheduleItems.length} / ${data.scheduleItems.length}`)
  console.log(`  Payments:       ${validPayments.length} / ${data.payments.length}`)
  console.log(`  Commissions:    ${validCommissions.length} / ${data.commissions.length}`)
  console.log("─".repeat(40))
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("\n🔄 Kapita → Loona: Focused Migration\n")
  console.log(`Target lenders: ${TARGET_LENDER_EMAILS.join(", ")}`)
  console.log(`Kapita DB: ${KAPITA_URL.replace(/:[^:@]+@/, ":***@")}`)
  console.log(`Loona DB:  ${LOONA_URL.replace(/:[^:@]+@/, ":***@")}`)

  if (DRY_RUN) {
    console.log("\n🔍 DRY RUN MODE")
  }

  try {
    const data = await fetchKapitaData()
    await importToLoona(data)

    if (DRY_RUN) {
      console.log("\n🔍 DRY RUN COMPLETE - No changes were made")
      console.log("   Remove --dry-run flag to perform actual migration")
    } else {
      console.log("\n✅ Migration completed successfully!")
    }
  } catch (error) {
    console.error("\n❌ Migration failed:", error)
    process.exit(1)
  }
}

main()
