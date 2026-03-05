import type Anthropic from "@anthropic-ai/sdk"
import { db, loans, contacts, paymentSchedule, payments, penalties, agents } from "@/lib/db"
import { eq, ne, gt, gte, lt, lte, ilike, inArray, and, sql, desc, asc, SQL, type Column } from "drizzle-orm"
import type { PgTable } from "drizzle-orm/pg-core"

// ============================================================================
// Table Registry — whitelist of queryable tables, columns, and joins
// ============================================================================

type ColumnType = "text" | "number" | "date" | "enum"

interface ColumnDef {
  ref: Column
  type: ColumnType
  enumValues?: string[]
  description?: string
}

interface JoinDef {
  fromColumn: Column
  toTable: PgTable
  toColumn: Column
}

interface TableDef {
  table: PgTable
  description: string
  columns: Record<string, ColumnDef>
  lenderId: { type: "direct"; column: Column } | { type: "via"; joinTable: string }
  joins: Record<string, JoinDef>
}

const TABLE_REGISTRY: Record<string, TableDef> = {
  loans: {
    table: loans,
    description: "All loans issued by this lender",
    columns: {
      id: { ref: loans.id, type: "text" },
      contactId: { ref: loans.contactId, type: "text", description: "Borrower's contact ID" },
      principal: { ref: loans.principal, type: "number", description: "Loan amount in PHP" },
      interestRate: { ref: loans.interestRate, type: "number", description: "Interest rate %" },
      termMonths: { ref: loans.termMonths, type: "number" },
      paymentFrequency: { ref: loans.paymentFrequency, type: "enum", enumValues: ["daily", "weekly", "biweekly", "semimonthly", "monthly"] },
      paymentAmount: { ref: loans.paymentAmount, type: "number", description: "Amount per payment period" },
      totalToRepay: { ref: loans.totalToRepay, type: "number" },
      status: { ref: loans.status, type: "enum", enumValues: ["pending_disbursement", "active", "completed", "defaulted", "pending_approval", "rejected"] },
      amountPaid: { ref: loans.amountPaid, type: "number" },
      interestEarned: { ref: loans.interestEarned, type: "number" },
      remainingBalance: { ref: loans.remainingBalance, type: "number" },
      purpose: { ref: loans.purpose, type: "text" },
      startDate: { ref: loans.startDate, type: "date" },
      maturityDate: { ref: loans.maturityDate, type: "date" },
      createdAt: { ref: loans.createdAt, type: "date" },
    },
    lenderId: { type: "direct", column: loans.lenderId },
    joins: {
      contacts: { fromColumn: loans.contactId, toTable: contacts, toColumn: contacts.id },
    },
  },

  contacts: {
    table: contacts,
    description: "Borrower profiles with contact info, income, and tier",
    columns: {
      id: { ref: contacts.id, type: "text" },
      name: { ref: contacts.name, type: "text" },
      phone: { ref: contacts.phone, type: "text" },
      email: { ref: contacts.email, type: "text" },
      address: { ref: contacts.address, type: "text" },
      city: { ref: contacts.city, type: "text" },
      tier: { ref: contacts.tier, type: "text", description: "Borrower tier: new/returning/established/loyal" },
      onTimeRate: { ref: contacts.onTimeRate, type: "number", description: "On-time payment rate 0-100" },
      income: { ref: contacts.income, type: "number", description: "Monthly income in PHP" },
      otherIncome: { ref: contacts.otherIncome, type: "number" },
      createdAt: { ref: contacts.createdAt, type: "date" },
    },
    lenderId: { type: "direct", column: contacts.lenderId },
    joins: {},
  },

  payment_schedule: {
    table: paymentSchedule,
    description: "Individual payment due dates and their status (pending/paid/partial/overdue)",
    columns: {
      id: { ref: paymentSchedule.id, type: "text" },
      loanId: { ref: paymentSchedule.loanId, type: "text" },
      dueDate: { ref: paymentSchedule.dueDate, type: "date" },
      amount: { ref: paymentSchedule.amount, type: "number", description: "Amount due" },
      paidAmount: { ref: paymentSchedule.paidAmount, type: "number" },
      status: { ref: paymentSchedule.status, type: "enum", enumValues: ["pending", "paid", "partial", "overdue"] },
      paidAt: { ref: paymentSchedule.paidAt, type: "date" },
    },
    lenderId: { type: "via", joinTable: "loans" },
    joins: {
      loans: { fromColumn: paymentSchedule.loanId, toTable: loans, toColumn: loans.id },
    },
  },

  payments: {
    table: payments,
    description: "Actual payment records (cash, GCash, Maya, bank)",
    columns: {
      id: { ref: payments.id, type: "text" },
      loanId: { ref: payments.loanId, type: "text" },
      amount: { ref: payments.amount, type: "number" },
      method: { ref: payments.method, type: "enum", enumValues: ["cash", "gcash", "maya", "bank"] },
      type: { ref: payments.type, type: "enum", enumValues: ["credit", "debit"] },
      paidAt: { ref: payments.paidAt, type: "date" },
      createdAt: { ref: payments.createdAt, type: "date" },
    },
    lenderId: { type: "via", joinTable: "loans" },
    joins: {
      loans: { fromColumn: payments.loanId, toTable: loans, toColumn: loans.id },
    },
  },

  penalties: {
    table: penalties,
    description: "Penalty records (late fees, daily interest) with status tracking",
    columns: {
      id: { ref: penalties.id, type: "text" },
      loanId: { ref: penalties.loanId, type: "text" },
      penaltyType: { ref: penalties.penaltyType, type: "enum", enumValues: ["late_fee", "daily_interest"] },
      amount: { ref: penalties.amount, type: "number" },
      status: { ref: penalties.status, type: "enum", enumValues: ["pending", "applied", "waived"] },
      appliedAt: { ref: penalties.appliedAt, type: "date" },
      waivedAt: { ref: penalties.waivedAt, type: "date" },
      createdAt: { ref: penalties.createdAt, type: "date" },
    },
    lenderId: { type: "via", joinTable: "loans" },
    joins: {
      loans: { fromColumn: penalties.loanId, toTable: loans, toColumn: loans.id },
    },
  },

  agents: {
    table: agents,
    description: "Collection agents with commission tracking",
    columns: {
      id: { ref: agents.id, type: "text" },
      commissionRate: { ref: agents.commissionRate, type: "number" },
      status: { ref: agents.status, type: "enum", enumValues: ["active", "suspended", "terminated"] },
      totalCollected: { ref: agents.totalCollected, type: "number" },
      totalCommissionEarned: { ref: agents.totalCommissionEarned, type: "number" },
      totalCommissionPaid: { ref: agents.totalCommissionPaid, type: "number" },
      createdAt: { ref: agents.createdAt, type: "date" },
    },
    lenderId: { type: "direct", column: agents.lenderId },
    joins: {},
  },
}

// Chained join paths: payment_schedule/payments/penalties -> loans -> contacts
const CHAINED_JOINS: Record<string, Record<string, string>> = {
  payment_schedule: { contacts: "loans" },
  payments: { contacts: "loans" },
  penalties: { contacts: "loans" },
}

// ============================================================================
// Tool Schemas
// ============================================================================

export const queryDataTool: Anthropic.Tool = {
  name: "query_data",
  description: `Query the lender's data with structured filters, sorting, aggregation, and grouping.
Available tables: loans, contacts, payment_schedule, payments, penalties, agents.
Joins are automatic — e.g. querying payment_schedule can include contacts.name for borrower names.
Date values use ISO format (YYYY-MM-DD). Use "today" for the current date.
All queries are automatically scoped to this lender's data.`,
  input_schema: {
    type: "object" as const,
    properties: {
      table: {
        type: "string",
        enum: ["loans", "contacts", "payment_schedule", "payments", "penalties", "agents"],
        description: "The primary table to query",
      },
      select: {
        type: "array",
        items: { type: "string" },
        description: "Columns to return. Use 'table.column' for joined tables (e.g. 'contacts.name'). Omit to return all primary table columns.",
      },
      filters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            column: { type: "string", description: "Column name, optionally prefixed with table (e.g. 'status' or 'contacts.name')" },
            op: { type: "string", enum: ["eq", "neq", "gt", "gte", "lt", "lte", "like", "in"] },
            value: {},
          },
          required: ["column", "op", "value"],
        },
        description: "Filter conditions (AND). For dates use ISO format or 'today'.",
      },
      sort: {
        type: "array",
        items: {
          type: "object",
          properties: {
            column: { type: "string" },
            direction: { type: "string", enum: ["asc", "desc"] },
          },
          required: ["column"],
        },
      },
      limit: { type: "number", description: "Max rows (default 50, max 100)" },
      aggregations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            fn: { type: "string", enum: ["count", "sum", "avg", "min", "max"] },
            column: { type: "string", description: "Column to aggregate. Use '*' with count." },
            alias: { type: "string", description: "Name for the result field" },
          },
          required: ["fn", "column"],
        },
        description: "Aggregate functions. When used, only aggregation results + groupBy columns are returned.",
      },
      groupBy: {
        type: "array",
        items: { type: "string" },
        description: "Columns to group by. Use 'month(column)' to group by month (e.g. 'month(dueDate)').",
      },
    },
    required: ["table"],
  },
}

export const describeDataTool: Anthropic.Tool = {
  name: "describe_data",
  description: "Get available tables and their columns, types, and relationships. Use this to understand what data you can query.",
  input_schema: {
    type: "object" as const,
    properties: {
      table: { type: "string", description: "Get details for a specific table. Omit for an overview of all tables." },
    },
    required: [],
  },
}

// ============================================================================
// describe_data implementation
// ============================================================================

export function describeData(tableName?: string): string {
  if (tableName) {
    const def = TABLE_REGISTRY[tableName]
    if (!def) return JSON.stringify({ error: `Unknown table: ${tableName}` })

    return JSON.stringify({
      table: tableName,
      description: def.description,
      columns: Object.fromEntries(
        Object.entries(def.columns).map(([name, col]) => [
          name,
          {
            type: col.type,
            ...(col.enumValues ? { values: col.enumValues } : {}),
            ...(col.description ? { description: col.description } : {}),
          },
        ])
      ),
      joins: Object.keys(def.joins),
    })
  }

  return JSON.stringify({
    tables: Object.fromEntries(
      Object.entries(TABLE_REGISTRY).map(([name, def]) => [
        name,
        {
          description: def.description,
          columns: Object.keys(def.columns),
          joins: Object.keys(def.joins),
        },
      ])
    ),
  })
}

// ============================================================================
// query_data implementation
// ============================================================================

interface QueryInput {
  table: string
  select?: string[]
  filters?: { column: string; op: string; value: unknown }[]
  sort?: { column: string; direction?: string }[]
  limit?: number
  aggregations?: { fn: string; column: string; alias?: string }[]
  groupBy?: string[]
}

export async function executeQueryData(input: QueryInput, lenderId: string): Promise<string> {
  const tableDef = TABLE_REGISTRY[input.table]
  if (!tableDef) return JSON.stringify({ error: `Unknown table: ${input.table}` })

  try {
    // Track which joins we need
    const neededJoins = new Set<string>()

    // Always add lenderId enforcement join if via another table
    if (tableDef.lenderId.type === "via") {
      neededJoins.add(tableDef.lenderId.joinTable)
    }

    // Resolve a "table.column" or "column" reference
    const resolveColumn = (ref: string): { column: Column; tableName: string; colName: string; type: ColumnType } | null => {
      const parts = ref.split(".")
      let tName: string
      let cName: string

      if (parts.length === 2) {
        tName = parts[0]
        cName = parts[1]
      } else {
        tName = input.table
        cName = parts[0]
      }

      // If referencing another table, mark the join
      if (tName !== input.table) {
        // Check for chained join (e.g. payment_schedule -> contacts needs loans first)
        const chain = CHAINED_JOINS[input.table]?.[tName]
        if (chain) {
          neededJoins.add(chain) // intermediate table
        }
        neededJoins.add(tName)
      }

      const targetDef = TABLE_REGISTRY[tName]
      if (!targetDef) return null
      const colDef = targetDef.columns[cName]
      if (!colDef) return null

      return { column: colDef.ref, tableName: tName, colName: cName, type: colDef.type }
    }

    // ---- Build SELECT ----
    const isAggregation = input.aggregations && input.aggregations.length > 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selectMap: Record<string, any> = {}

    if (isAggregation) {
      // Aggregation mode: only agg results + groupBy columns
      for (const agg of input.aggregations!) {
        const alias = agg.alias || `${agg.fn}_${agg.column}`
        if (agg.column === "*") {
          selectMap[alias] = sql<number>`count(*)::int`
        } else {
          const resolved = resolveColumn(agg.column)
          if (!resolved) return JSON.stringify({ error: `Unknown column in aggregation: ${agg.column}` })
          switch (agg.fn) {
            case "count":
              selectMap[alias] = sql<number>`count(${resolved.column})::int`
              break
            case "sum":
              selectMap[alias] = sql<string>`coalesce(sum(${resolved.column}), 0)`
              break
            case "avg":
              selectMap[alias] = sql<string>`coalesce(avg(${resolved.column}), 0)`
              break
            case "min":
              selectMap[alias] = sql<string>`min(${resolved.column})`
              break
            case "max":
              selectMap[alias] = sql<string>`max(${resolved.column})`
              break
            default:
              return JSON.stringify({ error: `Unknown aggregation function: ${agg.fn}` })
          }
        }
      }

      // Add groupBy columns to select
      if (input.groupBy) {
        for (const gb of input.groupBy) {
          const dateFunc = parseeDateFunction(gb)
          if (dateFunc) {
            const resolved = resolveColumn(dateFunc.column)
            if (!resolved) return JSON.stringify({ error: `Unknown groupBy column: ${dateFunc.column}` })
            selectMap[dateFunc.alias] = sql`to_char(date_trunc(${dateFunc.unit}, ${resolved.column}), 'YYYY-MM')`
          } else {
            const resolved = resolveColumn(gb)
            if (!resolved) return JSON.stringify({ error: `Unknown groupBy column: ${gb}` })
            selectMap[gb.includes(".") ? gb : resolved.colName] = resolved.column
          }
        }
      }
    } else if (input.select && input.select.length > 0) {
      // Specific columns
      for (const col of input.select) {
        const resolved = resolveColumn(col)
        if (!resolved) return JSON.stringify({ error: `Unknown column: ${col}` })
        const key = col.includes(".") ? col.replace(".", "_") : resolved.colName
        selectMap[key] = resolved.column
      }
    } else {
      // All columns from primary table
      for (const [name, colDef] of Object.entries(tableDef.columns)) {
        selectMap[name] = colDef.ref
      }
    }

    // ---- Build WHERE conditions ----
    const conditions: SQL[] = []

    // Enforce lenderId
    if (tableDef.lenderId.type === "direct") {
      conditions.push(eq(tableDef.lenderId.column, lenderId))
    } else {
      // Via join — lenderId is on the joined table (always loans)
      conditions.push(eq(loans.lenderId, lenderId))
    }

    // User filters
    if (input.filters) {
      for (const f of input.filters) {
        const resolved = resolveColumn(f.column)
        if (!resolved) return JSON.stringify({ error: `Unknown filter column: ${f.column}` })

        let value: unknown = f.value
        // Handle "today" date placeholder
        if (typeof value === "string" && value.toLowerCase() === "today") {
          value = new Date()
        }
        // Coerce date strings to Date objects for timestamp columns
        if (resolved.type === "date" && typeof value === "string") {
          value = new Date(value)
        }

        const condition = buildCondition(resolved.column, f.op, value)
        if (!condition) return JSON.stringify({ error: `Invalid filter op: ${f.op}` })
        conditions.push(condition)
      }
    }

    // ---- Build query ----
    let query = db.select(selectMap).from(tableDef.table).$dynamic()

    // Apply joins
    const joinedTables = new Set<string>()
    for (const joinTableName of neededJoins) {
      if (joinedTables.has(joinTableName)) continue

      // Find the join definition — could be on primary table or chained
      let joinDef = tableDef.joins[joinTableName]
      if (!joinDef) {
        // Try chained: find which table has the join to this target
        const chain = CHAINED_JOINS[input.table]?.[joinTableName]
        if (chain) {
          // First ensure the intermediate is joined
          if (!joinedTables.has(chain)) {
            const intermediateDef = tableDef.joins[chain]
            if (intermediateDef) {
              query = query.innerJoin(intermediateDef.toTable, eq(intermediateDef.fromColumn, intermediateDef.toColumn))
              joinedTables.add(chain)
            }
          }
          // Now join the target from the intermediate
          const intermediateTableDef = TABLE_REGISTRY[chain]
          joinDef = intermediateTableDef?.joins[joinTableName]
        }
      }

      if (joinDef) {
        query = query.innerJoin(joinDef.toTable, eq(joinDef.fromColumn, joinDef.toColumn))
        joinedTables.add(joinTableName)
      }
    }

    // Apply WHERE
    if (conditions.length > 0) {
      query = query.where(and(...conditions))
    }

    // Apply GROUP BY
    if (isAggregation && input.groupBy) {
      const groupExprs = input.groupBy.map((gb) => {
        const dateFunc = parseeDateFunction(gb)
        if (dateFunc) {
          const resolved = resolveColumn(dateFunc.column)
          return sql`date_trunc(${dateFunc.unit}, ${resolved!.column})`
        }
        const resolved = resolveColumn(gb)
        return resolved!.column
      })
      query = query.groupBy(...groupExprs)
    }

    // Apply ORDER BY
    if (input.sort && input.sort.length > 0) {
      const orderCols = input.sort.map((s) => {
        // Check if sorting by an aggregation alias (exists in selectMap but not a registry column)
        const resolved = resolveColumn(s.column)
        if (resolved) {
          return s.direction === "asc" ? asc(resolved.column) : desc(resolved.column)
        }
        // Fallback: try selectMap alias (for aggregation results)
        if (s.column in selectMap) {
          return s.direction === "asc" ? asc(selectMap[s.column]) : desc(selectMap[s.column])
        }
        return null
      }).filter(Boolean) as SQL[]
      if (orderCols.length > 0) {
        query = query.orderBy(...orderCols)
      }
    }

    // Apply LIMIT
    const limit = Math.min(input.limit ?? 50, 100)
    query = query.limit(limit)

    // Execute
    const rows = await query

    // Serialize dates and decimals
    const serialized = rows.map((row) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out: Record<string, any> = {}
      for (const [key, val] of Object.entries(row)) {
        if (val instanceof Date) {
          out[key] = val.toISOString()
        } else {
          out[key] = val
        }
      }
      return out
    })

    return JSON.stringify({ rows: serialized, count: serialized.length })
  } catch (err) {
    return JSON.stringify({ error: `Query failed: ${err instanceof Error ? err.message : String(err)}` })
  }
}

// Parse "month(dueDate)" or "week(createdAt)" style expressions
function parseeDateFunction(expr: string): { unit: string; column: string; alias: string } | null {
  const match = expr.match(/^(month|week|year|day)\((.+)\)$/)
  if (!match) return null
  return { unit: match[1], column: match[2], alias: `${match[1]}_${match[2]}` }
}

function buildCondition(column: Column, op: string, value: unknown): SQL | null {
  switch (op) {
    case "eq": return eq(column, value)
    case "neq": return ne(column, value)
    case "gt": return gt(column, value)
    case "gte": return gte(column, value)
    case "lt": return lt(column, value)
    case "lte": return lte(column, value)
    case "like": return ilike(column, `%${value}%`)
    case "in": return Array.isArray(value) ? inArray(column, value) : null
    default: return null
  }
}
