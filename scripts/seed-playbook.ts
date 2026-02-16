/**
 * Seed script for Playbook Tagalog content
 *
 * Upserts Tagalog (content_tl) versions for all 6 playbook sections
 * for the demo lender account.
 *
 * Run with: npx tsx scripts/seed-playbook.ts
 */

import "dotenv/config"
import { drizzle } from "drizzle-orm/neon-http"
import { neon } from "@neondatabase/serverless"
import { eq, and } from "drizzle-orm"
import * as schema from "../src/lib/db/schema"

const { playbookSections } = schema

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

const LENDER_ID = "lender-ken-001"

// Helper: wrap plain text paragraphs in TipTap JSON
function tiptapDoc(...nodes: object[]): string {
  return JSON.stringify({ type: "doc", content: nodes })
}

function heading(level: number, text: string) {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  }
}

function paragraph(text: string) {
  return {
    type: "paragraph",
    content: [{ type: "text", text }],
  }
}

function bulletList(...items: string[]) {
  return {
    type: "bulletList",
    content: items.map((text) => ({
      type: "listItem",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    })),
  }
}

// ============================================================================
// Tagalog Content for Each Section
// ============================================================================

const TAGALOG_SECTIONS: Record<string, string> = {
  borrower_tiers: tiptapDoc(
    heading(2, "Mga Tier ng Borrower"),
    paragraph("Narito ang mga tier batay sa halaga ng loan:"),
    bulletList(
      "Tier 1 (Bagong Borrower): Hanggang P10,000 — kailangan ng valid ID at proof of income",
      "Tier 2 (Repeat Borrower): Hanggang P25,000 — may magandang payment history, walang overdue",
      "Tier 3 (Trusted Borrower): Hanggang P50,000 — 3+ natapos na loan, walang late payment",
      "Tier 4 (VIP): Hanggang P100,000 — may collateral at co-maker, na-verify ng lender"
    ),
    paragraph("Palaging i-verify ang income at kakayahang magbayad bago mag-approve ng loan.")
  ),

  qualification_checklist: tiptapDoc(
    heading(2, "Checklist para sa Qualification"),
    paragraph("Bago mag-approve ng kahit anong loan, i-verify ang mga sumusunod:"),
    bulletList(
      "Valid government ID (hindi expired)",
      "Proof of income o employment (payslip, certificate of employment, o business permit)",
      "Proof of address (utility bill o barangay clearance)",
      "Contact number at emergency contact",
      "Para sa loans na P25,000 pataas: co-maker na may sariling valid ID",
      "Para sa loans na P50,000 pataas: collateral documentation"
    ),
    paragraph("Kung hindi kumpleto ang kahit isang requirement, huwag i-proceed ang loan.")
  ),

  pricing_guide: tiptapDoc(
    heading(2, "Gabay sa Pricing"),
    paragraph("Standard na interest rates batay sa term at borrower tier:"),
    bulletList(
      "1-3 buwan: 5% bawat buwan",
      "4-6 na buwan: 4% bawat buwan",
      "7-12 buwan: 3% bawat buwan"
    ),
    paragraph("Maaaring mas mababang rate para sa Tier 3 at Tier 4 na borrowers batay sa approval ng lender."),
    paragraph("Huwag mag-offer ng custom rates nang walang approval ng lender.")
  ),

  red_flags: tiptapDoc(
    heading(2, "Mga Red Flag"),
    paragraph("Huminto at i-report sa lender kung may makita sa mga sumusunod:"),
    bulletList(
      "Hindi magbigay ng valid ID o may hinalang peke ang ID",
      "Ayaw magbigay ng contact details ng employer o personal references",
      "May existing na overdue loan satin o sa ibang lender",
      "Nagmamadali at hindi masagot nang maayos ang mga tanong",
      "Hindi match ang income sa hinihingi na loan amount",
      "Ibang tao ang pumipirma o umaattend ng verification"
    ),
    paragraph("Kapag may kahit isang red flag, huwag mag-proceed. I-escalate sa lender.")
  ),

  collection_rules: tiptapDoc(
    heading(2, "Mga Patakaran sa Collection"),
    paragraph("Mga alituntunin para sa pag-follow up ng bayad:"),
    bulletList(
      "Magpadala ng friendly reminder 2 araw bago ang due date",
      "Sa araw ng due date: magpadala ng reminder sa umaga",
      "1 araw pagkatapos ng due date: tumawag o mag-text para mag-follow up",
      "3 araw pagkatapos: mag-follow up ulit at i-notify ang lender",
      "7 araw pagkatapos: tawagan ang co-maker at i-escalate sa lender",
      "Huwag pumunta sa bahay nang walang approval ng lender"
    ),
    paragraph("Palaging maging magalang at propesyonal. Bawal ang pangha-harass o pagbabanta.")
  ),

  dos_and_donts: tiptapDoc(
    heading(2, "Mga Dapat at Hindi Dapat Gawin"),
    heading(3, "Mga Dapat Gawin"),
    bulletList(
      "Palaging maging magalang at propesyonal sa lahat ng borrower",
      "I-record agad ang mga payment sa system",
      "Panatilihing updated ang iyong lender sa status ng mga loan",
      "I-verify ang lahat ng documents bago mag-submit",
      "Mag-respond sa mga inquiry ng borrower sa loob ng 24 oras"
    ),
    heading(3, "Mga Hindi Dapat Gawin"),
    bulletList(
      "Huwag tumanggap ng cash nang walang resibo o record sa system",
      "Huwag mag-approve ng loan na hindi na-verify",
      "Huwag mag-share ng impormasyon ng borrower sa ibang tao",
      "Huwag mangako ng approval na hindi ka pa sigurado",
      "Huwag gumamit ng personal na account para sa loan transactions"
    )
  ),
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("\nSeeding Tagalog playbook content...\n")

  for (const [sectionKey, contentTl] of Object.entries(TAGALOG_SECTIONS)) {
    const existing = await db.query.playbookSections.findFirst({
      where: and(
        eq(playbookSections.lenderId, LENDER_ID),
        eq(playbookSections.sectionKey, sectionKey)
      ),
    })

    if (existing) {
      await db
        .update(playbookSections)
        .set({ contentTl, updatedAt: new Date() })
        .where(eq(playbookSections.id, existing.id))
      console.log(`  Updated: ${sectionKey}`)
    } else {
      await db.insert(playbookSections).values({
        lenderId: LENDER_ID,
        sectionKey,
        contentTl,
      })
      console.log(`  Inserted: ${sectionKey}`)
    }
  }

  console.log("\nDone! 6 Tagalog sections seeded.\n")
}

main().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
