import type Anthropic from "@anthropic-ai/sdk"

export interface LunaTool {
  definition: Anthropic.Tool
  execute: (input: any, lenderId: string) => Promise<ToolExecutionResult>
}

export interface ToolExecutionResult {
  result: string
  contextCard?: ContextCard
}

export type ContextCardType =
  | "overdue_loans_table"
  | "loan_detail"
  | "contact_detail"
  | "payment_history"
  | "portfolio_stats"
  | "payment_confirmation"
  | "payment_preview"
  | "borrower_list"
  | "upcoming_payments"

export interface ContextCard {
  type: ContextCardType
  title: string
  data: any
}

import { getOverdueLoans, getLoanDetails, searchLoans } from "./query-loans"
import { searchContacts, getContactProfile } from "./query-contacts"
import { getRecentPayments, getPaymentsByLoan } from "./query-payments"
import { getPortfolioOverview, getCollectionRate } from "./portfolio-stats"
import { preparePaymentTool, confirmPaymentTool } from "./record-payment"

export const toolRegistry: Record<string, LunaTool> = {
  get_overdue_loans: getOverdueLoans,
  get_loan_details: getLoanDetails,
  search_loans: searchLoans,
  search_contacts: searchContacts,
  get_contact_profile: getContactProfile,
  get_recent_payments: getRecentPayments,
  get_payments_by_loan: getPaymentsByLoan,
  get_portfolio_overview: getPortfolioOverview,
  get_collection_rate: getCollectionRate,
  prepare_payment: preparePaymentTool,
  confirm_payment: confirmPaymentTool,
}

export function getToolDefinitions(): Anthropic.Tool[] {
  return Object.values(toolRegistry).map((t) => t.definition)
}

export async function executeTool(
  toolName: string,
  input: any,
  lenderId: string,
): Promise<ToolExecutionResult> {
  const tool = toolRegistry[toolName]
  if (!tool) return { result: `Unknown tool: ${toolName}` }
  try {
    return await tool.execute(input, lenderId)
  } catch (error: any) {
    return { result: `Error executing ${toolName}: ${error.message}` }
  }
}
