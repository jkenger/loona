import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  pgEnum,
  unique,
  jsonb,
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
  "pending_approval",
  "rejected",
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

export const penaltyTypeEnum = pgEnum("penalty_type", ["late_fee", "daily_interest"])
export const penaltyStatusEnum = pgEnum("penalty_status", ["pending", "applied", "waived"])

export const paymentTypeEnum = pgEnum("payment_type", ["credit", "debit"])

export const blogPostStatusEnum = pgEnum("blog_post_status", ["draft", "published"])

// ============================================================================
// Auth Tables (Better Auth)
// ============================================================================

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // Using text for role to support multiple comma-separated roles (e.g., "lender,agent")
  role: text("role").default("lender"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  hasCompletedOnboarding: boolean("has_completed_onboarding").notNull().default(false),
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
  impersonatedBy: text("impersonated_by"),
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
  interestEarned: decimal("interest_earned", { precision: 12, scale: 2 }).notNull().default("0"),
  remainingBalance: decimal("remaining_balance", { precision: 12, scale: 2 }).notNull(),

  // Optional details
  purpose: text("purpose"),
  collateralDescription: text("collateral_description"),
  coMakerName: text("co_maker_name"),
  coMakerPhone: text("co_maker_phone"),
  coMakerRelationship: text("co_maker_relationship"),

  // Status and dates
  status: loanStatusEnum("status").notNull().default("pending_disbursement"),
  rejectionReason: text("rejection_reason"),
  startDate: timestamp("start_date"),
  maturityDate: timestamp("maturity_date"),
  completedAt: timestamp("completed_at"),

  // Customizable promissory note clauses (JSON)
  customClauses: text("custom_clauses"),

  // Renewal tracking
  renewedFromLoanId: text("renewed_from_loan_id"),

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
  type: paymentTypeEnum("type").notNull().default("credit"),
  reversesPaymentId: text("reverses_payment_id"),

  paidAt: timestamp("paid_at").notNull().defaultNow(),
  recordedByAgentId: text("recorded_by_agent_id").references(() => agents.id),
  notes: text("notes"),

  // Cascade payment allocations: [{ scheduleItemId, applied, prevPaidAmount }]
  cascadeAllocations: jsonb("cascade_allocations").$type<
    { scheduleItemId: string; applied: number; prevPaidAmount: number }[]
  >(),

  // Reversal fields (soft delete)
  reversedAt: timestamp("reversed_at"),
  reversedBy: text("reversed_by").references(() => user.id),
  reversalReason: text("reversal_reason"),

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
    canCreateLoans: boolean("can_create_loans").notNull().default(false),
    canRecordPayments: boolean("can_record_payments").notNull().default(true),

    // Denormalized totals
    totalCollected: decimal("total_collected", { precision: 12, scale: 2 }).notNull().default("0"),
    totalCommissionEarned: decimal("total_commission_earned", { precision: 12, scale: 2 }).notNull().default("0"),
    totalCommissionPaid: decimal("total_commission_paid", { precision: 12, scale: 2 }).notNull().default("0"),

    tier: integer("tier"),

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

// Commission Settings (lender-wide program config)
export const commissionSettings = pgTable("commission_settings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  lenderId: text("lender_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" })
    .unique(),
  config: text("config").notNull(), // JSON blob
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// Lender Settings (lender-wide config: initial capital, etc.)
export const lenderSettings = pgTable("lender_settings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  lenderId: text("lender_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" })
    .unique(),
  config: text("config").notNull(), // JSON blob
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// Penalty Settings (lender-wide penalty config)
export const penaltySettings = pgTable("penalty_settings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  lenderId: text("lender_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" })
    .unique(),
  config: text("config").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// Penalties (ledger of all penalty decisions)
export const penalties = pgTable("penalties", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  loanId: text("loan_id").notNull().references(() => loans.id, { onDelete: "cascade" }),
  scheduleItemId: text("schedule_item_id").notNull().references(() => paymentSchedule.id, { onDelete: "cascade" }),
  penaltyType: penaltyTypeEnum("penalty_type").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  status: penaltyStatusEnum("status").notNull().default("pending"),
  appliedAt: timestamp("applied_at"),
  waivedAt: timestamp("waived_at"),
  decidedBy: text("decided_by").references(() => user.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

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

// Waitlist (public beta signups)
export const waitlist = pgTable("waitlist", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// Playbook Sections (lender lending handbook)
export const playbookSections = pgTable(
  "playbook_sections",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    lenderId: text("lender_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sectionKey: text("section_key").notNull(),
    content: text("content"), // TipTap JSON stored as text
    contentTl: text("content_tl"), // TipTap JSON — Tagalog version
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("unique_lender_section").on(table.lenderId, table.sectionKey),
  ]
)

// Blog Categories
export const blogCategories = pgTable("blog_categories", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// Blog Tags
export const blogTags = pgTable("blog_tags", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// Blog Posts
export const blogPosts = pgTable("blog_posts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  authorId: text("author_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  categoryId: text("category_id").references(() => blogCategories.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt"),
  content: text("content"), // Tiptap JSON stored as text
  status: blogPostStatusEnum("status").notNull().default("draft"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// Blog Post Tags (many-to-many)
export const blogPostTags = pgTable(
  "blog_post_tags",
  {
    postId: text("post_id")
      .notNull()
      .references(() => blogPosts.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => blogTags.id, { onDelete: "cascade" }),
  },
  (table) => [
    unique("unique_post_tag").on(table.postId, table.tagId),
  ]
)

// ============================================================================
// Relations
// ============================================================================

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(user, {
    fields: [auditLogs.userId],
    references: [user.id],
  }),
}))

export const userRelations = relations(user, ({ one, many }) => ({
  sessions: many(session),
  accounts: many(account),
  contacts: many(contacts),
  loans: many(loans),
  agentRelationships: many(agents, { relationName: "agentUser" }),
  lenderAgents: many(agents, { relationName: "lender" }),
  auditLogs: many(auditLogs),
  commissionSettings: one(commissionSettings),
  penaltySettings: one(penaltySettings),
  lenderSettings: one(lenderSettings),
  blogPosts: many(blogPosts),
  playbookSections: many(playbookSections),
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
  renewedFrom: one(loans, {
    fields: [loans.renewedFromLoanId],
    references: [loans.id],
    relationName: "renewals",
  }),
  renewals: many(loans, { relationName: "renewals" }),
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
  penalties: many(penalties),
}))

export const paymentScheduleRelations = relations(paymentSchedule, ({ one, many }) => ({
  loan: one(loans, {
    fields: [paymentSchedule.loanId],
    references: [loans.id],
  }),
  payments: many(payments),
  penalties: many(penalties),
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
  reversesPayment: one(payments, {
    fields: [payments.reversesPaymentId],
    references: [payments.id],
    relationName: "reversals",
  }),
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

export const commissionSettingsRelations = relations(commissionSettings, ({ one }) => ({
  lender: one(user, {
    fields: [commissionSettings.lenderId],
    references: [user.id],
  }),
}))

export const penaltySettingsRelations = relations(penaltySettings, ({ one }) => ({
  lender: one(user, { fields: [penaltySettings.lenderId], references: [user.id] }),
}))

export const lenderSettingsRelations = relations(lenderSettings, ({ one }) => ({
  lender: one(user, { fields: [lenderSettings.lenderId], references: [user.id] }),
}))

export const penaltiesRelations = relations(penalties, ({ one }) => ({
  loan: one(loans, { fields: [penalties.loanId], references: [loans.id] }),
  scheduleItem: one(paymentSchedule, { fields: [penalties.scheduleItemId], references: [paymentSchedule.id] }),
  decidedByUser: one(user, { fields: [penalties.decidedBy], references: [user.id] }),
}))

export const playbookSectionsRelations = relations(playbookSections, ({ one }) => ({
  lender: one(user, { fields: [playbookSections.lenderId], references: [user.id] }),
}))

export const blogCategoriesRelations = relations(blogCategories, ({ many }) => ({
  posts: many(blogPosts),
}))

export const blogTagsRelations = relations(blogTags, ({ many }) => ({
  postTags: many(blogPostTags),
}))

export const blogPostsRelations = relations(blogPosts, ({ one, many }) => ({
  author: one(user, {
    fields: [blogPosts.authorId],
    references: [user.id],
  }),
  category: one(blogCategories, {
    fields: [blogPosts.categoryId],
    references: [blogCategories.id],
  }),
  postTags: many(blogPostTags),
}))

export const blogPostTagsRelations = relations(blogPostTags, ({ one }) => ({
  post: one(blogPosts, {
    fields: [blogPostTags.postId],
    references: [blogPosts.id],
  }),
  tag: one(blogTags, {
    fields: [blogPostTags.tagId],
    references: [blogTags.id],
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

export type CommissionSettingsRow = typeof commissionSettings.$inferSelect
export type NewCommissionSettingsRow = typeof commissionSettings.$inferInsert

export type PenaltySettingsRow = typeof penaltySettings.$inferSelect
export type PenaltyRow = typeof penalties.$inferSelect

export type LenderSettingsRow = typeof lenderSettings.$inferSelect
export type NewLenderSettingsRow = typeof lenderSettings.$inferInsert

export type PlaybookSection = typeof playbookSections.$inferSelect

export type BlogCategory = typeof blogCategories.$inferSelect
export type BlogTag = typeof blogTags.$inferSelect
export type BlogPost = typeof blogPosts.$inferSelect
export type BlogPostTag = typeof blogPostTags.$inferSelect
