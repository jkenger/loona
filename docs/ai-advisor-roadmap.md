# AI Advisor — Roadmap

## Current State (MVP)
- Claude-powered read-only chatbot on lender dashboard
- 7 tools: portfolio summary, loan details, borrower profile, overdue report, penalty summary, collection trends, loan recommendation
- Streaming SSE responses with tool use
- Conversation persistence (DB-backed)
- Floating bubble UI, full-screen on mobile

---

## Tier 1 — High Impact, Build Next

### 1. Write Actions (Mutations)
Transform from analyst to assistant that can act on the lender's behalf.

**Examples:**
- "Record Juan's payment of ₱2,000 via GCash" → records payment
- "Approve Maria's loan" → disburses loan
- "Waive the penalty on loan X" → waives penalty

**Implementation:**
- New tools: `record_payment`, `disburse_loan`, `waive_penalty`, `create_contact`, etc.
- Confirmation flow — advisor proposes the action with details, user must confirm before execution
- Audit trail — all mutations logged with `source: "advisor"` in audit_logs
- Guarded by same permission checks as manual UI actions

### 2. Proactive Alerts / Daily Digest
Push insights instead of waiting for the lender to ask.

**Examples:**
- "3 payments due tomorrow, 2 borrowers are historically late"
- "Collection rate dropped 15% vs last month"
- "Juan has been overdue 14 days — consider follow-up"
- Weekly portfolio health summary

**Implementation:**
- Morning digest: cron job builds summary, stores as a pinned advisor message
- Real-time alerts: triggered on events (payment overdue, loan completed, penalty generated)
- Notification preferences in lender settings
- Could surface as a badge on the advisor bubble or a pinned card at the top of chat

### 3. Natural Language Search
Let lenders query their data conversationally without knowing exact names/IDs.

**Examples:**
- "Show me all borrowers in Quezon City with active loans over ₱50k"
- "Who has the worst on-time rate?"
- "List loans maturing this month"

**Implementation:**
- New tool `search_data` that accepts natural language filters
- Translates to Drizzle queries with dynamic where clauses
- Support filtering by: city, loan amount range, status, tier, on-time rate, date ranges
- Paginated results for large datasets

---

## Tier 2 — Differentiators

### 4. Multi-Advisor Personas
Specialized advisors for different workflows. Schema already supports this (`advisors.name`, `advisors.systemPrompt`).

**Persona ideas:**
- **Collections Agent** — overdue follow-ups, generates SMS/message templates, prioritizes by severity
- **Risk Analyst** — DTI analysis, tier assessment, approval/denial recommendations
- **Portfolio Strategist** — growth planning, capital allocation, rate optimization

**Implementation:**
- Settings UI to create/configure advisors with custom names and system prompts
- Each advisor gets its own tool subset (e.g., Collections Agent doesn't need `get_loan_recommendation`)
- Advisor selector in chat header

### 5. Document Generation
Generate lending documents and communications from chat.

**Examples:**
- "Draft a demand letter for Juan's overdue loan"
- "Generate a collection summary report for March"
- "Write follow-up messages for all borrowers due this week"
- "Create a loan comparison for Maria's renewal options"

**Implementation:**
- New tools that output formatted documents (markdown → PDF)
- Template library for common documents (demand letters, reminders, reports)
- Batch generation for multiple borrowers
- Copy-to-clipboard or download as PDF

### 6. Conversation Memory & Context
Advisor remembers across conversations and learns lender preferences.

**Examples:**
- "Last time you asked about Juan, he had 2 overdue — he's now caught up"
- Knows lender typically approves under ₱20k without collateral
- Remembers lender's risk tolerance and communication style

**Implementation:**
- `advisor_notes` table — key insights extracted and persisted
- Lender preference profile built from conversation patterns
- Cross-conversation context injection in system prompt
- "What do you know about [borrower]?" pulls from notes + data

---

## Tier 3 — Advanced

### 7. Predictive Analytics
Data-driven forecasting and risk scoring.

**Features:**
- Default probability per borrower (based on payment history patterns)
- Cash flow forecasting: "You'll need ₱X more capital by June at current rates"
- Seasonal trend analysis: "Collections historically dip in December"
- Portfolio concentration risk: "40% of your outstanding is in 3 borrowers"

**Implementation:**
- Statistical models running on payment history data
- New tools: `predict_default_risk`, `forecast_cash_flow`, `analyze_trends`
- Visual charts in chat responses (future)

### 8. Batch Operations via Chat
Operate on multiple records at once through natural language.

**Examples:**
- "Send payment reminders to all borrowers due this week"
- "Compare my top 5 borrowers by profitability"
- "What if I raised rates by 1% on new loans?" → simulation
- "Mark all penalties over 30 days as waived"

**Implementation:**
- Batch confirmation UI — shows affected records, user approves
- Simulation mode for "what if" scenarios (no mutations, just projections)
- Rate limiting and safety checks for batch mutations

### 9. Voice Input
Lower the barrier for lenders working from phones in the field.

**Implementation:**
- Web Speech API for voice-to-text in the chat input
- Works offline for transcription, sends text to advisor
- Language support: English + Tagalog
- Push-to-talk button alongside the text input

---

## Priority Sequence
1. **Proactive alerts** — immediate value without lender needing to ask
2. **Write actions** — transforms advisor from analyst to assistant
3. **Document generation** — saves hours of manual work
4. **Multi-persona** — specialization for different workflows
5. **Natural language search** — power user feature
6. **Conversation memory** — makes advisor feel intelligent
7. **Predictive analytics** — advanced insights
8. **Batch operations** — efficiency at scale
9. **Voice input** — accessibility
