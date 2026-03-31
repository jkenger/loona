import Anthropic from "@anthropic-ai/sdk"
import { db, loans, contacts, paymentSchedule, user } from "@/lib/db"
import { eq, and, sql } from "drizzle-orm"
import { getToolDefinitions } from "./tools"
import type { LunaMessage } from "@/lib/db"

const anthropic = new Anthropic()

export async function buildSystemPrompt(lenderId: string): Promise<string> {
  // Fetch lender name
  const [lender] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, lenderId))

  // Fetch high-level portfolio stats
  const [stats] = await db
    .select({
      activeLoans: sql<number>`count(*) filter (where ${loans.status} = 'active')::int`,
      totalContacts: sql<number>`0::int`, // placeholder, computed below
      outstandingBalance: sql<string>`coalesce(sum(${loans.remainingBalance}) filter (where ${loans.status} = 'active'), 0)::text`,
      overdueCount: sql<number>`0::int`, // placeholder
    })
    .from(loans)
    .where(eq(loans.lenderId, lenderId))

  const [contactCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contacts)
    .where(eq(contacts.lenderId, lenderId))

  const [overdueStats] = await db
    .select({
      count: sql<number>`count(*)::int`,
      amount: sql<string>`coalesce(sum(${paymentSchedule.amount} - ${paymentSchedule.paidAmount}), 0)::text`,
    })
    .from(paymentSchedule)
    .innerJoin(loans, eq(paymentSchedule.loanId, loans.id))
    .where(
      and(
        eq(loans.lenderId, lenderId),
        eq(paymentSchedule.status, "overdue"),
      ),
    )

  const today = new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const fmt = (n: number) =>
    `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`

  return `You are Luna, an AI lending advisor for ${lender?.name ?? "the lender"}'s portfolio on Loona — a lending management platform for Philippine micro-lenders.

Today is ${today}.

Portfolio snapshot:
- ${stats.activeLoans} active loans across ${contactCount.count} borrowers
- ${fmt(Number(stats.outstandingBalance))} outstanding balance
- ${overdueStats.count} overdue payments totaling ${fmt(Number(overdueStats.amount))}

Guidelines:
- Be concise, helpful, and professional. Speak like a knowledgeable lending advisor.
- Format PHP amounts with ₱ symbol and proper formatting (e.g. ₱5,000.00).
- Use Filipino greetings when appropriate (Magandang umaga/hapon/gabi).
- When asked about data, use your tools to look it up — don't guess.
- For record_payment: ALWAYS look up the loan details first to get the correct loanId and scheduleItemId. Confirm the amount and method with the lender before recording.
- Keep responses brief. Use bullet points for lists.
- If you're unsure about something, say so rather than guessing.`
}

export function buildAnthropicMessages(
  messages: LunaMessage[],
): Anthropic.MessageParam[] {
  const result: Anthropic.MessageParam[] = []

  let i = 0
  while (i < messages.length) {
    const msg = messages[i]

    if (msg.role === "user") {
      result.push({ role: "user", content: msg.content })
      i++
    } else if (msg.role === "assistant") {
      result.push({ role: "assistant", content: msg.content })
      i++
    } else if (msg.role === "tool_call") {
      // Collect consecutive tool_call blocks into one assistant message
      const toolUseBlocks: Anthropic.ContentBlockParam[] = []
      while (i < messages.length && messages[i].role === "tool_call") {
        const tc = messages[i]
        toolUseBlocks.push({
          type: "tool_use",
          id: tc.toolCallId!,
          name: tc.toolName!,
          input: JSON.parse(tc.content),
        })
        i++
      }

      // Collect the corresponding tool_result messages
      const toolResultBlocks: Anthropic.ToolResultBlockParam[] = []
      while (i < messages.length && messages[i].role === "tool_result") {
        const tr = messages[i]
        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: tr.toolCallId!,
          content: tr.content,
        })
        i++
      }

      result.push({ role: "assistant", content: toolUseBlocks })
      if (toolResultBlocks.length > 0) {
        result.push({ role: "user", content: toolResultBlocks })
      }
    } else {
      // Skip unexpected roles
      i++
    }
  }

  return result
}

export function getAnthropicToolDefinitions(): Anthropic.Tool[] {
  return getToolDefinitions()
}

export { anthropic }
