import { db, contacts, loans } from "@/lib/db"
import { eq, and, sql, ilike, or, desc } from "drizzle-orm"
import type { LunaTool } from "./index"

export const searchContacts: LunaTool = {
  definition: {
    name: "search_contacts",
    description:
      "Search for borrowers/contacts by name, phone, or email. Use when the lender asks about a specific borrower or wants to find someone.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Name, phone number, or email to search for",
        },
      },
      required: ["query"],
    },
  },
  async execute(input: { query: string }, lenderId: string) {
    const pattern = `%${input.query}%`

    const rows = await db
      .select({
        id: contacts.id,
        name: contacts.name,
        phone: contacts.phone,
        email: contacts.email,
        city: contacts.city,
        tier: contacts.tier,
        onTimeRate: contacts.onTimeRate,
        activeLoans: sql<number>`count(${loans.id}) filter (where ${loans.status} = 'active')::int`,
        totalLoans: sql<number>`count(${loans.id})::int`,
      })
      .from(contacts)
      .leftJoin(loans, eq(contacts.id, loans.contactId))
      .where(
        and(
          eq(contacts.lenderId, lenderId),
          or(
            ilike(contacts.name, pattern),
            ilike(contacts.phone, pattern),
            ilike(contacts.email, pattern),
          ),
        ),
      )
      .groupBy(contacts.id)
      .orderBy(contacts.name)
      .limit(10)

    return {
      result: rows.length
        ? `Found ${rows.length} borrowers: ${rows.map((r) => `${r.name} (${r.activeLoans} active loans${r.tier ? `, ${r.tier} tier` : ""})`).join("; ")}`
        : `No borrowers found matching "${input.query}"`,
      contextCard: {
        type: "borrower_list" as const,
        title: `Borrowers — "${input.query}"`,
        data: rows,
      },
    }
  },
}

export const getContactProfile: LunaTool = {
  definition: {
    name: "get_contact_profile",
    description:
      "Get a detailed profile of a borrower including their loan history and payment behavior.",
    input_schema: {
      type: "object" as const,
      properties: {
        contactId: {
          type: "string",
          description: "Contact ID",
        },
        name: {
          type: "string",
          description: "Contact name to search for (if ID not known)",
        },
      },
      required: [],
    },
  },
  async execute(
    input: { contactId?: string; name?: string },
    lenderId: string,
  ) {
    let contactRow: any

    if (input.contactId) {
      const [row] = await db
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.id, input.contactId),
            eq(contacts.lenderId, lenderId),
          ),
        )
      contactRow = row
    } else if (input.name) {
      const [row] = await db
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.lenderId, lenderId),
            ilike(contacts.name, `%${input.name}%`),
          ),
        )
        .limit(1)
      contactRow = row
    }

    if (!contactRow) return { result: "Contact not found" }

    const loanRows = await db
      .select({
        id: loans.id,
        principal: loans.principal,
        remainingBalance: loans.remainingBalance,
        status: loans.status,
        interestRate: loans.interestRate,
        startDate: loans.startDate,
        amountPaid: loans.amountPaid,
      })
      .from(loans)
      .where(
        and(
          eq(loans.contactId, contactRow.id),
          eq(loans.lenderId, lenderId),
        ),
      )
      .orderBy(desc(loans.createdAt))

    const activeLoans = loanRows.filter((l) => l.status === "active")
    const totalBorrowed = loanRows.reduce(
      (sum, l) => sum + Number(l.principal),
      0,
    )

    return {
      result: `${contactRow.name}: ${loanRows.length} total loans (${activeLoans.length} active), ₱${totalBorrowed.toLocaleString("en-PH")} total borrowed${contactRow.tier ? `, ${contactRow.tier} tier` : ""}${contactRow.onTimeRate ? `, ${contactRow.onTimeRate}% on-time rate` : ""}.`,
      contextCard: {
        type: "contact_detail" as const,
        title: contactRow.name,
        data: {
          contact: {
            id: contactRow.id,
            name: contactRow.name,
            phone: contactRow.phone,
            email: contactRow.email,
            city: contactRow.city,
            tier: contactRow.tier,
            onTimeRate: contactRow.onTimeRate ? Number(contactRow.onTimeRate) : null,
            income: contactRow.income ? Number(contactRow.income) : null,
          },
          loans: loanRows.map((l) => ({
            id: l.id,
            principal: Number(l.principal),
            remainingBalance: Number(l.remainingBalance),
            status: l.status,
            interestRate: Number(l.interestRate),
            startDate: l.startDate,
            amountPaid: Number(l.amountPaid),
          })),
        },
      },
    }
  },
}
