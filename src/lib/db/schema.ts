import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

// ============================================================================
// Enums
// ============================================================================

export const userRoleEnum = pgEnum("user_role", ["lender", "agent", "admin"])

export const loanStatusEnum = pgEnum("loan_status", [
  "pending_disbursement",
  "active",
  "completed",
  "defaulted",
])

export const paymentFrequencyEnum = pgEnum("payment_frequency", [
  "daily",
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
])

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "gcash",
  "maya",
  "bank",
])

export const scheduleStatusEnum = pgEnum("schedule_status", [
  "pending",
  "paid",
  "partial",
  "overdue",
])

export const agentStatusEnum = pgEnum("agent_status", [
  "active",
  "suspended",
  "terminated",
])

export const commissionStatusEnum = pgEnum("commission_status", [
  "pending",
  "paid",
])

// ============================================================================
// Auth Tables (Better Auth)
// ============================================================================

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: userRoleEnum("role").default("lender"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// ============================================================================
// App Tables
// ============================================================================

// Contacts (Borrowers - simple records, NOT users)
export const contacts = pgTable("contacts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  lenderId: text("lender_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  facebookProfile: text("facebook_profile"),
  notes: text("notes"),
  createdByAgentId: text("created_by_agent_id").references(() => agents.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// Loans
export const loans = pgTable("loans", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  lenderId: text("lender_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  contactId: text("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "restrict" }),

  // Loan terms
  principal: decimal("principal", { precision: 12, scale: 2 }).notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).notNull(), // e.g., 5.00 for 5%
  termMonths: integer("term_months").notNull(),
  paymentFrequency: paymentFrequencyEnum("payment_frequency").notNull().default("monthly"),

  // Calculated values
  paymentAmount: decimal("payment_amount", { precision: 12, scale: 2 }).notNull(),
  totalToRepay: decimal("total_to_repay", { precision: 12, scale: 2 }).notNull(),

  // Denormalized for performance
  amountPaid: decimal("amount_paid", { precision: 12, scale: 2 }).notNull().default("0"),
  remainingBalance: decimal("remaining_balance", { precision: 12, scale: 2 }).notNull(),

  // Optional details
  purpose: text("purpose"),
  collateralDescription: text("collateral_description"),
  coMakerName: text("co_maker_name"),
  coMakerPhone: text("co_maker_phone"),
  coMakerRelationship: text("co_maker_relationship"),

  // Status and dates
  status: loanStatusEnum("status").notNull().default("pending_disbursement"),
  startDate: timestamp("start_date"),
  maturityDate: timestamp("maturity_date"),
  completedAt: timestamp("completed_at"),

  // Agent tracking
  createdByAgentId: text("created_by_agent_id").references(() => agents.id),
  assignedAgentId: text("assigned_agent_id").references(() => agents.id),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// Payment Schedule
export const paymentSchedule = pgTable("payment_schedule", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  loanId: text("loan_id")
    .notNull()
    .references(() => loans.id, { onDelete: "cascade" }),

  dueDate: timestamp("due_date").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  status: scheduleStatusEnum("status").notNull().default("pending"),

  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  paidAt: timestamp("paid_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// Payments
export const payments = pgTable("payments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  loanId: text("loan_id")
    .notNull()
    .references(() => loans.id, { onDelete: "cascade" }),
  scheduleItemId: text("schedule_item_id").references(() => paymentSchedule.id),

  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  method: paymentMethodEnum("method").notNull().default("cash"),

  paidAt: timestamp("paid_at").notNull().defaultNow(),
  recordedByAgentId: text("recorded_by_agent_id").references(() => agents.id),
  notes: text("notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// Agents (lender-agent relationships)
export const agents = pgTable(
  "agents",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    agentUserId: text("agent_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lenderId: text("lender_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull().default("5.00"), // 5%
    status: agentStatusEnum("status").notNull().default("active"),

    // Denormalized totals
    totalCollected: decimal("total_collected", { precision: 12, scale: 2 }).notNull().default("0"),
    totalCommissionEarned: decimal("total_commission_earned", { precision: 12, scale: 2 }).notNull().default("0"),
    totalCommissionPaid: decimal("total_commission_paid", { precision: 12, scale: 2 }).notNull().default("0"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("unique_agent_lender").on(table.agentUserId, table.lenderId),
  ]
)

// Commissions
export const commissions = pgTable(
  "commissions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    paymentId: text("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),

    paymentAmount: decimal("payment_amount", { precision: 12, scale: 2 }).notNull(),
    commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull(),
    commissionAmount: decimal("commission_amount", { precision: 12, scale: 2 }).notNull(),

    status: commissionStatusEnum("status").notNull().default("pending"),
    paidAt: timestamp("paid_at"),
    paidBy: text("paid_by").references(() => user.id),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("unique_commission_payment").on(table.paymentId),
  ]
)

// Audit Logs
export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  userEmail: text("user_email"), // Denormalized for when user is deleted
  action: text("action").notNull(), // e.g., "contact.create", "loan.delete", "payment.record"
  entityType: text("entity_type").notNull(), // e.g., "contact", "loan", "payment"
  entityId: text("entity_id"), // ID of the affected entity
  metadata: text("metadata"), // JSON string with additional context
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// ============================================================================
// Relations
// ============================================================================

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(user, {
    fields: [auditLogs.userId],
    references: [user.id],
  }),
}))

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  contacts: many(contacts),
  loans: many(loans),
  agentRelationships: many(agents, { relationName: "agentUser" }),
  lenderAgents: many(agents, { relationName: "lender" }),
  auditLogs: many(auditLogs),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}))

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  lender: one(user, {
    fields: [contacts.lenderId],
    references: [user.id],
  }),
  createdByAgent: one(agents, {
    fields: [contacts.createdByAgentId],
    references: [agents.id],
  }),
  loans: many(loans),
}))

export const loansRelations = relations(loans, ({ one, many }) => ({
  lender: one(user, {
    fields: [loans.lenderId],
    references: [user.id],
  }),
  contact: one(contacts, {
    fields: [loans.contactId],
    references: [contacts.id],
  }),
  createdByAgent: one(agents, {
    fields: [loans.createdByAgentId],
    references: [agents.id],
    relationName: "createdLoans",
  }),
  assignedAgent: one(agents, {
    fields: [loans.assignedAgentId],
    references: [agents.id],
    relationName: "assignedLoans",
  }),
  schedule: many(paymentSchedule),
  payments: many(payments),
}))

export const paymentScheduleRelations = relations(paymentSchedule, ({ one, many }) => ({
  loan: one(loans, {
    fields: [paymentSchedule.loanId],
    references: [loans.id],
  }),
  payments: many(payments),
}))

export const paymentsRelations = relations(payments, ({ one }) => ({
  loan: one(loans, {
    fields: [payments.loanId],
    references: [loans.id],
  }),
  scheduleItem: one(paymentSchedule, {
    fields: [payments.scheduleItemId],
    references: [paymentSchedule.id],
  }),
  recordedByAgent: one(agents, {
    fields: [payments.recordedByAgentId],
    references: [agents.id],
  }),
  commission: one(commissions),
}))

export const agentsRelations = relations(agents, ({ one, many }) => ({
  agentUser: one(user, {
    fields: [agents.agentUserId],
    references: [user.id],
    relationName: "agentUser",
  }),
  lender: one(user, {
    fields: [agents.lenderId],
    references: [user.id],
    relationName: "lender",
  }),
  createdContacts: many(contacts),
  createdLoans: many(loans, { relationName: "createdLoans" }),
  assignedLoans: many(loans, { relationName: "assignedLoans" }),
  recordedPayments: many(payments),
  commissions: many(commissions),
}))

export const commissionsRelations = relations(commissions, ({ one }) => ({
  agent: one(agents, {
    fields: [commissions.agentId],
    references: [agents.id],
  }),
  payment: one(payments, {
    fields: [commissions.paymentId],
    references: [payments.id],
  }),
  paidByUser: one(user, {
    fields: [commissions.paidBy],
    references: [user.id],
  }),
}))

// ============================================================================
// Types
// ============================================================================

export type User = typeof user.$inferSelect
export type NewUser = typeof user.$inferInsert

export type Contact = typeof contacts.$inferSelect
export type NewContact = typeof contacts.$inferInsert

export type Loan = typeof loans.$inferSelect
export type NewLoan = typeof loans.$inferInsert

export type PaymentScheduleItem = typeof paymentSchedule.$inferSelect
export type NewPaymentScheduleItem = typeof paymentSchedule.$inferInsert

export type Payment = typeof payments.$inferSelect
export type NewPayment = typeof payments.$inferInsert

export type Agent = typeof agents.$inferSelect
export type NewAgent = typeof agents.$inferInsert

export type Commission = typeof commissions.$inferSelect
export type NewCommission = typeof commissions.$inferInsert
