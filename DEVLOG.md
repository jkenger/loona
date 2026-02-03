# Loona Development Log

## 2026-02-02 - Initial Setup & Core Implementation

### Summary
First day of development for Loona, a clean-slate rebuild of Kapita. Set up the full project structure with TanStack Start, PostgreSQL (Neon), Drizzle ORM, and Better Auth.

---

### Completed

#### Phase 1: Project Setup ✅
- [x] TanStack Start project initialized (by user)
- [x] shadcn/ui components configured (by user)
- [x] Drizzle ORM + Neon PostgreSQL configured
- [x] Better Auth with TanStack Start integration
- [x] Database schema pushed to Neon

#### Phase 2: Core Data Layer ✅
- [x] Complete database schema (7 tables):
  - `user` - Better Auth users with role field
  - `session`, `account`, `verification` - Better Auth tables
  - `contacts` - Borrowers (simple records, not users)
  - `loans` - Loan records with denormalized balances
  - `payment_schedule` - Individual payment schedule items
  - `payments` - Payment records
  - `agents` - Lender-agent relationships
  - `commissions` - Commission tracking per payment
- [x] Drizzle relations configured
- [x] Type exports for all tables

#### Phase 3: Contacts & Loans ✅
- [x] Contacts CRUD server functions
- [x] Contacts list page with search
- [x] New contact form
- [x] Contact detail page with loan history
- [x] Loans CRUD server functions
- [x] Loan creation wizard with:
  - Contact selection
  - Loan terms (principal, interest, term, frequency)
  - Auto-calculated payment schedule
  - Real-time summary preview
- [x] Loan list page with progress bars
- [x] Loan detail page with schedule view

#### Phase 4: Payments ✅
- [x] Payment recording server function
- [x] Upcoming/overdue payments query
- [x] Payments page with:
  - Record payment form
  - Upcoming & overdue section
  - Payment history
- [x] Automatic loan balance updates
- [x] Schedule item status updates (paid/partial)

#### Phase 5: Dashboard ✅
- [x] Dashboard stats server function
- [x] Dashboard page with:
  - Metric cards (total loans, contacts, expected, overdue)
  - Portfolio summary
  - Upcoming payments (7 days)

#### Phase 6: Agent System ✅
- [x] Agent CRUD server functions
- [x] Agents page (lender view) with:
  - Add agent by email
  - Commission rate management
  - Suspend/activate agents
  - Pay commission button
- [x] Commission calculation on payment recording
- [x] Agent portal server functions (dashboard, loans)

#### Infrastructure ✅
- [x] Auth layouts (`_auth` for login/signup)
- [x] Dashboard layout (`_dashboard` with sidebar)
- [x] Mobile-responsive sidebar with hamburger menu
- [x] 404 Not Found page
- [x] Role constants and helpers

---

### Issues Resolved

1. **TanStack Start Server Functions API**
   - Initial `.validator()` chaining didn't work
   - Fixed by moving validation inside handler with Zod

2. **Session Helper**
   - `getWebRequest()` and `getHeaders()` not available
   - Fixed with `getRequestHeaders()` from `@tanstack/react-start/server`

3. **Better Auth API Route**
   - Multiple attempts with Nitro routes failed
   - `createAPIFileRoute` pattern deprecated
   - **Solution**: Use `createFileRoute` with `server.handlers` pattern
   - File: `/src/routes/api/auth/$.ts`
   - Export: `Route` (not `APIRoute`)

4. **Cookie Handling**
   - Added `tanstackStartCookies()` plugin to Better Auth config

---

#### Phase 6: Agent Portal ✅
- [x] Agent portal routes (`/agent/*`)
  - Agent dashboard page (`/agent/`) - Stats, lender relationships, recent payments
  - Agent loans view (`/agent/loans`) - All loans from assigned lenders
  - Agent commissions page (`/agent/commissions`) - Earnings breakdown by lender
- [x] Role-based navigation in sidebar
  - Lenders see: Dashboard, Contacts, Loans, Payments, Agents
  - Agents see: Dashboard, Loans, Commissions
  - Role badges shown in user section

---

### Not Yet Implemented

#### Additional Features (Post-MVP)
- [x] Loan status: Simplified to `active` → `completed` (auto on full payment)
- [x] Overdue detection: Runs on dashboard load (no cron needed)
- [x] Contact edit/delete functionality
- [x] Date range filters (payments page)
- [x] Export functionality (CSV)
- [x] Dark mode toggle in UI
- [ ] Email notifications

#### Data & Testing
- [ ] Seed script with test data
- [ ] Data migration script from Kapita (optional)

---

### File Structure Created

```
loona/
├── src/
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts       # Complete 7-table schema
│   │   │   └── index.ts        # Drizzle client
│   │   ├── auth.ts             # Better Auth server config
│   │   ├── auth-client.ts      # Better Auth client
│   │   └── constants/
│   │       └── roles.ts        # Role helpers
│   ├── server/
│   │   ├── session.ts          # Auth session helpers
│   │   ├── dashboard.ts        # Dashboard stats
│   │   ├── contacts.ts         # Contacts CRUD
│   │   ├── loans.ts            # Loans CRUD + schedule
│   │   ├── payments.ts         # Payments + balance updates
│   │   └── agents.ts           # Agent management
│   └── routes/
│       ├── __root.tsx          # Root layout + 404
│       ├── index.tsx           # Redirect handler
│       ├── api/auth/$.ts       # Better Auth handler
│       ├── _auth.tsx           # Auth layout
│       ├── _auth/
│       │   ├── login.tsx
│       │   └── signup.tsx
│       ├── _dashboard.tsx      # Dashboard layout + sidebar
│       └── _dashboard/
│           ├── dashboard/index.tsx
│           ├── contacts/
│           │   ├── index.tsx
│           │   ├── new.tsx
│           │   └── $contactId.tsx
│           ├── loans/
│           │   ├── index.tsx
│           │   ├── new.tsx
│           │   └── $loanId.tsx
│           ├── payments/index.tsx
│           └── agents/index.tsx
├── drizzle.config.ts
├── .env
└── .env.example
```

---

### Tech Stack Confirmed

| Layer | Technology |
|-------|------------|
| Framework | TanStack Start |
| Database | PostgreSQL (Neon) |
| ORM | Drizzle |
| Auth | Better Auth |
| UI | shadcn/ui + Tailwind v4 |
| Icons | Phosphor Icons |
| Validation | Zod |
| State | TanStack Router loaders |

---

### Late Update: Agent Auto-Creation

**Change**: Agents no longer need to have an existing account before being added.

- Lenders can now add agents by providing name + email
- If the agent doesn't have an account, one is created automatically
- A random 12-character password is generated
- Credentials are displayed to the lender to share with the agent
- "Copy Credentials" button for easy sharing
- If user already exists, they're just added as an agent (no new password)

**Files Updated**:
- `src/server/agents.ts` - Added auto-creation logic with bcryptjs
- `src/routes/_dashboard/agents/index.tsx` - Added name field + credentials display

---

---

## 2026-02-02 - Phase 7: Polish & UI/UX Improvements

### Summary
Completed Phase 7 (Polish) and various UI/UX improvements. The MVP is now feature-complete with professional loading states, toast notifications, and consistent form inputs.

---

### Phase 7: Polish ✅

#### Toast Notification System
- [x] Installed `sonner` toast library
- [x] Added `<Toaster>` to root layout with rich colors and close button
- [x] Replaced all `alert()` calls with proper `toast.success()` / `toast.error()`
- [x] Success toasts for: creating contacts/loans/agents, recording payments, assigning agents, copying credentials

#### Skeleton Loaders
- [x] Created reusable `Skeleton` component (`/components/ui/skeleton.tsx`)
- [x] Variants: `Skeleton`, `SkeletonCard`, `SkeletonListItem`, `SkeletonTable`, `SkeletonDashboard`
- [x] Added `pendingComponent` to key routes:
  - Dashboard
  - Loans list
  - Contacts list
  - Payments
  - Agents

#### Route Transition Progress
- [x] Created `RouteProgress` component with animated progress bar
- [x] Uses TanStack Router's `useRouterState` to detect loading
- [x] Shows at top of page during navigation with smooth CSS animation

#### Empty States
- [x] Already well-implemented across all pages (95%)
- [x] Consistent pattern: Icon + title + description + CTA button

#### Mobile Responsiveness
- [x] Already excellent throughout (95%)
- [x] Responsive grids, stacking layouts, hidden elements on mobile

---

### UI/UX Improvements (Earlier Sessions)

#### Form Input Components
- [x] `CurrencyInput` - PHP currency formatting with ₱ symbol and comma separators
- [x] `PhoneInput` - Philippine phone format (0917 123 4567)
- [x] `DatePicker` - Inline calendar display using react-day-picker v9
- [x] `Calendar` - Base calendar component with proper v9 API

#### Form Consistency
- [x] All inputs now use consistent height (h-10)
- [x] Consistent border radius across Input, Select, Button
- [x] Select components properly display selected values with icons
- [x] Fixed SelectTrigger flex alignment for icon + text

#### Dashboard Redesign
- [x] Combined Kapita's cashflow focus with Loona's portfolio view
- [x] Summary Cards: Expected, Collected, Overdue
- [x] Payment Calendar with month navigation and status indicators
- [x] Quick Actions panel
- [x] Portfolio Summary (Disbursed, Collected, Outstanding)
- [x] Forecast Card (30/60/90 days)

#### Navigation
- [x] Top navigation bar (moved from sidebar)
- [x] Role switcher for users with both lender/agent roles
- [x] User dropdown menu with portal links
- [x] Mobile hamburger menu

---

### Files Created/Updated

**New Components:**
- `src/components/ui/skeleton.tsx` - Skeleton loader components
- `src/components/ui/route-progress.tsx` - Route transition progress bar
- `src/components/ui/currency-input.tsx` - PHP currency input
- `src/components/ui/phone-input.tsx` - PH phone input
- `src/components/ui/calendar.tsx` - react-day-picker calendar
- `src/components/ui/date-picker.tsx` - Inline date picker

**Updated Routes (toast + skeletons):**
- `src/routes/__root.tsx` - Added Toaster
- `src/routes/_dashboard.tsx` - Added RouteProgress
- `src/routes/_dashboard/dashboard/index.tsx` - Skeleton + redesign
- `src/routes/_dashboard/loans/index.tsx` - Skeleton
- `src/routes/_dashboard/loans/new.tsx` - Toast + DatePicker
- `src/routes/_dashboard/contacts/index.tsx` - Skeleton
- `src/routes/_dashboard/contacts/new.tsx` - Toast + PhoneInput
- `src/routes/_dashboard/payments/index.tsx` - Skeleton + Toast
- `src/routes/_dashboard/agents/index.tsx` - Skeleton + Toast
- `src/routes/_dashboard/loans/$loanId.tsx` - Toast
- `src/routes/_dashboard/agent/payments.tsx` - Toast

**Updated Server Functions:**
- `src/server/dashboard.ts` - Calendar data, forecast, monthly stats

**Updated Styles:**
- `src/styles.css` - Added progress animation keyframes

---

### MVP Status: COMPLETE ✅

All 7 phases implemented. Loona is a fully functional loan management application.

**Core Features:**
- Authentication (login, signup, session)
- Contacts (CRUD, search)
- Loans (creation, schedule, status tracking)
- Payments (recording, balance updates, overdue detection)
- Dashboard (calendar, forecast, metrics)
- Agent System (portal, commissions)

**Polish:**
- Toast notifications
- Skeleton loaders
- Route progress indicator
- Mobile responsive
- Empty states
- Consistent form inputs

---

## 2026-02-02 - Post-MVP Features

### Summary
Implemented several post-MVP features including contact management, data export, date filtering, and dark mode.

---

### Completed Features

#### Contact Edit/Delete ✅
- [x] Edit dialog with all contact fields (name, phone, email, address, city, facebook, notes)
- [x] Delete confirmation dialog with loan check
- [x] Cannot delete contacts that have loans (must delete loans first)
- [x] Uses `updateContact` and `deleteContact` server functions

#### Loan Delete ✅
- [x] Delete button on loan detail page (lenders only)
- [x] Delete confirmation dialog with payment check
- [x] Cannot delete loans that have payments (must delete payments first)
- [x] Deletes associated schedule items automatically
- [x] Uses `deleteLoan` server function

#### Date Range Filters ✅
- [x] Added to payments page
- [x] Preset buttons: All, This Month, 30 Days, 90 Days
- [x] Client-side filtering with date-fns
- [x] Shows filtered count in header

#### Export Functionality ✅
- [x] CSV export for payment history
- [x] Exports: Date, Contact, Amount, Method, Notes
- [x] Respects current date filter
- [x] Downloads as `payments-YYYY-MM-DD.csv`

#### Dark Mode Toggle ✅
- [x] Created `ThemeProvider` context (`src/lib/theme.tsx`)
- [x] Supports light, dark, and system preferences
- [x] Persists to localStorage
- [x] Toggle button in navigation header
- [x] Toggle button in mobile menu
- [x] CSS variables already defined for dark theme

---

### Files Created/Updated

**New Files:**
- `src/lib/theme.tsx` - Theme context provider

**Updated Files:**
- `src/routes/__root.tsx` - Added ThemeProvider
- `src/routes/_dashboard.tsx` - Added theme toggle buttons
- `src/routes/_dashboard/payments/index.tsx` - Date filters + CSV export
- `src/routes/_dashboard/contacts/$contactId.tsx` - Edit/delete dialogs
- `src/routes/_dashboard/loans/$loanId.tsx` - Delete dialog
- `src/server/loans.ts` - Added deleteLoan server function

---

### Next Steps (Remaining)

1. **Email Notifications** - Alerts for overdue payments
2. **Seed Script** - Test data for development
3. **PDF Export** - For loans and payment schedules

---

## 2026-02-02 - Agent Portal Mobile Optimizations

### Summary
Fixed mobile navigation issues and optimized all agent portal pages for compact mobile viewing.

---

### Bug Fixes

#### Mobile Navigation in User Dropdown ✅
- **Issue**: Agent menu items (My Loans, My Payments, My Commissions) weren't working on mobile tap
- **Cause**: Event handling conflict between `DropdownMenuItem` with `asChild` and TanStack Router's `Link` component on touch devices
- **Solution**: Changed to `onClick` with `useNavigate()` hook for programmatic navigation
- **File**: `src/routes/_dashboard.tsx`

```tsx
// Before (not working on mobile):
<DropdownMenuItem asChild>
  <Link to="/agent/loans">My Loans</Link>
</DropdownMenuItem>

// After (works on mobile):
const navigate = useNavigate()
<DropdownMenuItem onClick={() => navigate({ to: "/agent/loans" })}>
  My Loans
</DropdownMenuItem>
```

#### Agent Detail Routes Not Rendering ✅
- **Issue**: Clicking on a contact or loan in agent portal navigated but showed blank/empty page
- **Cause**: TanStack Router file-based routing treats `contacts.tsx` as a layout route (not leaf) when `contacts/$contactId.tsx` exists. Layouts require `<Outlet />` to render children.
- **Solution**: Renamed list pages to index routes inside folders:
  - `agent/contacts.tsx` → `agent/contacts/index.tsx`
  - `agent/loans.tsx` → `agent/loans/index.tsx`
- Route tree regenerated automatically

---

### Agent Portal Mobile Compaction ✅

Made all agent pages more compact for mobile with consistent styling:

| Feature | Mobile | Desktop |
|---------|--------|---------|
| Page headers | `text-2xl` | `text-4xl` |
| Card padding | `p-3` | `p-6` |
| Stat grids | 2-3 columns | 4 columns |
| Currency display | Compact (₱10K, ₱1.5M) | Full |
| Descriptions | Hidden | Visible |
| Card spacing | `space-y-4` | `space-y-6` |

**Pages Updated:**
- `agent/index.tsx` - Dashboard with 2x2 stats, compact welcome banner
- `agent/contacts/index.tsx` - 3-column stats, compact contact cards
- `agent/contacts/$contactId.tsx` - Compact contact info and loan cards
- `agent/loans/index.tsx` - Compact loan cards with progress bars
- `agent/loans/$loanId.tsx` - Compact progress, schedule, history sections
- `agent/payments.tsx` - 3-column stats, compact payment items
- `agent/commissions.tsx` - 3-column stats, "How it works" hidden on mobile

---

### Shared Utilities ✅

Added currency formatting utilities to `src/lib/utils.ts`:

```typescript
// Full format: ₱10,000
export function formatCurrency(amount: string | number): string

// Compact format for mobile: ₱10K, ₱1.5M
export function formatCurrencyCompact(amount: string | number): string
```

All agent pages now use `formatCurrencyCompact` from shared utils instead of local definitions.

---

### Files Updated

**Routes:**
- `src/routes/_dashboard.tsx` - Fixed mobile navigation with useNavigate()
- `src/routes/_dashboard/agent/contacts/index.tsx` - Moved from `contacts.tsx`, compact styling
- `src/routes/_dashboard/agent/contacts/$contactId.tsx` - Compact mobile layout
- `src/routes/_dashboard/agent/loans/index.tsx` - Moved from `loans.tsx`, compact styling
- `src/routes/_dashboard/agent/loans/$loanId.tsx` - Compact mobile layout
- `src/routes/_dashboard/agent/payments.tsx` - Compact mobile layout
- `src/routes/_dashboard/agent/commissions.tsx` - Compact mobile layout
- `src/routes/_dashboard/agent/index.tsx` - Compact mobile layout

**Utilities:**
- `src/lib/utils.ts` - Added formatCurrency() and formatCurrencyCompact()

---

## 2026-02-02 - Legal Compliance Review (Philippines)

### Summary
Reviewed Philippine laws and regulations applicable to Loona as a loan management tool. Identified compliance requirements and features needed to ensure legal operation.

---

### Key Distinction: Tool vs. Lending Company

**Loona is a loan management tool**, not a lending company itself. This is a crucial distinction:

- **Lending Companies** (regulated by SEC under RA 9474) - entities that lend money and need registration
- **Loan Management Software** (like Loona) - tools that help lenders track their activities

However, **users** (lenders using Loona) may need to comply with lending regulations depending on their scale of operations.

---

### Applicable Philippine Laws

#### 1. Lending Company Regulation Act (RA 9474)

**Who it applies to:** Anyone engaged in the business of lending money

**Requirements:**
- SEC Certificate of Authority to operate as a Lending Company
- Minimum ₱1 million paid-up capital
- 60% Filipino ownership (unless foreign investment qualified)
- Annual audited financial statements

**Note:** Informal "5-6" lending technically requires registration if done as a business.

**Sources:**
- [SEC Registration Requirements](https://www.respicio.ph/commentaries/sec-registration-requirements-for-online-lending-platforms-philippines-1)
- [RA 9474 Full Text](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/19443)

---

#### 2. Truth in Lending Act (RA 3765)

**Who it applies to:** All creditors extending credit

**Required Disclosures (must be provided to borrowers):**
1. Cash price of property/service
2. Down payment amount
3. Difference (amount financed)
4. Itemized charges not part of credit
5. Total amount to be financed
6. **Finance charge in pesos and centavos**
7. **Annual interest rate (EIR - Effective Interest Rate)**

**Penalties:** ₱1,000-₱5,000 fine + 6 months to 1 year imprisonment

**Sources:**
- [RA 3765 Full Text](https://lawphil.net/statutes/repacts/ra1963/ra_3765_1963.html)
- [BSP Manual](https://morb.bsp.gov.ph/306-truth-in-lending-act-disclosure-requirement-2/)

---

#### 3. Data Privacy Act of 2012 (RA 10173)

**This directly applies to Loona** since we collect and store personal data (borrower contacts).

**Requirements:**
- **Privacy Policy** - Clear disclosure of what data is collected and why
- **Consent** - Explicit consent before collecting personal data
- **Data Protection Officer (DPO)** - Required for personal information controllers
- **NPC Registration** - Register with National Privacy Commission
- **Data Breach Protocol** - Notify NPC within 72 hours of breach

**NPC Circular 20-01 (Lending-Specific):**
- Inform borrowers about all phases of loan processing
- Disclose use of automated decision-making/credit scoring
- Cannot access contacts, gallery, location without valid purpose

**Penalties:** Up to ₱5 million administrative fines + criminal penalties (1-6 years imprisonment)

**Sources:**
- [NPC Guidelines](https://www.dataguidance.com/news/philippines-npc-issues-guidelines-online-lending-apps)
- [Data Privacy Guide](https://secureprivacy.ai/blog/data-privacy-act-2012-philippines-guide)

---

#### 4. Interest Rate Regulations (BSP Circular 1133)

**Caps on small loans (≤₱10,000, ≤4 months):**
- Interest rate caps set by BSP
- Penalties for exceeding caps

**Source:** [Fintech Regulations 2025](https://iclg.com/practice-areas/fintech-laws-and-regulations/philippines)

---

### Compliance Features Checklist

#### Must Have (Legal Requirements)

| Feature | Priority | Status |
|---------|----------|--------|
| Privacy Policy page | High | ❌ Not implemented |
| Terms of Service page | High | ❌ Not implemented |
| Truth in Lending Disclosure Generator | High | ❌ Not implemented |
| User Consent Flow (data collection) | High | ❌ Not implemented |
| Data Export Feature (DPA right) | Medium | ❌ Not implemented |
| Data Deletion Feature (DPA right) | Medium | ❌ Not implemented |

#### Nice to Have (Best Practices)

| Feature | Priority | Status |
|---------|----------|--------|
| Interest Rate Warning (BSP caps) | Medium | ❌ Not implemented |
| EIR Calculator (Effective Interest Rate) | Medium | ❌ Not implemented |
| Compliance Guide for Users | Low | ❌ Not implemented |
| Audit Trail (data access logs) | Low | ❌ Not implemented |

---

### Required Disclaimers

Add to the app (footer, terms page, or onboarding):

```
DISCLAIMER: Loona is a loan management tool designed to help
users track lending activities. Loona does not provide loans,
financial advice, or legal advice.

Users engaging in lending activities are responsible for
complying with all applicable Philippine laws including but
not limited to:
- Lending Company Regulation Act (RA 9474)
- Truth in Lending Act (RA 3765)
- Data Privacy Act of 2012 (RA 10173)
- BSP regulations on interest rates

For lending activities exceeding personal/informal arrangements,
users should consult with a licensed attorney and consider
SEC registration requirements.
```

---

### Truth in Lending Disclosure Feature (Planned)

Generate printable disclosure statements with:

```
TRUTH IN LENDING DISCLOSURE STATEMENT

Borrower: [Contact Name]
Date: [Loan Start Date]

1. Principal Amount:                    ₱ XX,XXX.XX
2. Finance Charges:
   - Interest (X% per month):           ₱ XX,XXX.XX
   - Processing Fee:                    ₱ XX,XXX.XX
   - Other Charges:                     ₱ XX,XXX.XX

3. Total Finance Charge:                ₱ XX,XXX.XX
4. Total Amount to be Paid:             ₱ XX,XXX.XX
5. Effective Interest Rate (EIR):       XX.XX% per annum

Payment Schedule:
[Table of due dates and amounts]

I acknowledge receipt of this disclosure statement.

_______________________          _______________
Borrower's Signature              Date
```

---

### Next Steps

1. [ ] Create Privacy Policy page (`/privacy`)
2. [ ] Create Terms of Service page (`/terms`)
3. [ ] Add disclaimer to footer and/or dashboard
4. [ ] Implement Truth in Lending disclosure generator
5. [ ] Add EIR (Effective Interest Rate) calculation to loan creation
6. [ ] Add data export functionality for user data
7. [ ] Add account deletion functionality
8. [ ] Consider NPC registration process

---

## 2026-02-03 - Loan Form Enhancement (Kapita Feature Parity)

### Summary
Enhanced the loan creation form to match Kapita's loan fields, adding purpose, collateral, and co-maker fields as optional inputs. This brings feature parity with Kapita while keeping Loona's simpler architecture.

---

### Database Schema Changes

Added new optional fields to the `loans` table:

```sql
ALTER TABLE "loans" ADD COLUMN "purpose" text;
ALTER TABLE "loans" ADD COLUMN "collateral_description" text;
ALTER TABLE "loans" ADD COLUMN "co_maker_name" text;
ALTER TABLE "loans" ADD COLUMN "co_maker_phone" text;
ALTER TABLE "loans" ADD COLUMN "co_maker_relationship" text;
```

Also added `semimonthly` to the `payment_frequency` enum.

---

### New Loan Form Fields

#### 1. Purpose (Optional)
- Quick-select buttons with common purposes:
  - 💳 Bill Payment, 💡 Utilities, 🛒 Groceries, 🏠 Rent
  - 🎓 Tuition, 🏥 Medical, 💼 Business, 🚨 Emergency
- Custom text input for other purposes
- Click selected purpose again to deselect

#### 2. Collateral (Optional)
- Checkbox to enable collateral section
- Textarea for detailed collateral description
- Example: "Vehicle - Honda Click 150, 2020 model, OR/CR available"

#### 3. Co-maker / Guarantor (Optional)
- Checkbox to enable co-maker section
- Fields:
  - Name (text)
  - Phone Number (text)
  - Relationship (text, e.g., Spouse, Parent, Friend)

---

### Payment Frequency Update

Added `semimonthly` option (1st and 15th of each month):
- Updated enum: `daily`, `weekly`, `biweekly`, `semimonthly`, `monthly`
- Schedule generation calculates proper dates for 1st/15th pattern
- UI shows as "Semi-monthly (1st & 15th)"

---

### Loan Detail Page Updates

New "Optional Details" section displays when any optional field is filled:
- Purpose card with tag icon
- Collateral card with shield icon
- Co-maker card with users icon (shows name, phone, relationship)

Cards are displayed in a 3-column grid layout.

---

### Files Updated

**Schema:**
- `src/lib/db/schema.ts` - Added 5 new loan fields + semimonthly enum value

**Server:**
- `src/server/loans.ts` - Updated validation schema and createLoan function

**Routes:**
- `src/routes/_dashboard/loans/new.tsx` - Added purpose, collateral, co-maker sections
- `src/routes/_dashboard/loans/$loanId.tsx` - Added optional details display

**Migration:**
- `drizzle/0002_reflective_peter_quill.sql` - Schema migration

---

### Kapita vs Loona Feature Comparison (Updated)

| Feature | Kapita | Loona |
|---------|--------|-------|
| Borrower selection | ✅ With stats | ✅ Basic |
| Principal amount | ✅ Slider + presets | ✅ Input |
| Interest rate | ✅ Slider + presets | ✅ Input |
| Term | ✅ Months/Days/End-date | ✅ Months |
| Payment Frequency | ✅ 4 options | ✅ 5 options |
| Start Date | ✅ | ✅ |
| **Purpose** | ✅ | ✅ (new) |
| **Collateral** | ✅ | ✅ (new) |
| **Co-maker** | ✅ | ✅ (new) |
| Funding source | ✅ | ❌ (not needed for MVP) |
| Documents | ✅ | ❌ (not needed for MVP) |

---

## 2026-02-04 - Deployment & Branding

### Summary
Attempted deployment to multiple platforms (Cloudflare, Render), added gradient UI enhancements, and implemented animated branding components with Framer Motion.

---

### Deployment Attempts

#### Cloudflare Workers ❌
- Configured `@cloudflare/vite-plugin` with TanStack Start
- Set up GitHub Actions workflow for auto-deploy
- Issues encountered:
  - `DATABASE_URL` not available during build phase
  - `BETTER_AUTH_URL` needed for auth client
- **Reverted** - Setup was too complex for initial deployment

#### Render ✅ (In Progress)
- Configured `node-server` preset for TanStack Start
- Added `render.yaml` for infrastructure-as-code
- Build command: `drizzle-kit push && vite build`
- Start command: `node .output/server/index.mjs`
- **Issue**: `@noble/ciphers` ESM compatibility with `better-auth`

---

### @noble/ciphers Compatibility Issue

**Problem**: `better-auth` imports from `@noble/ciphers/chacha.js` but newer versions of `@noble/ciphers` (v2.0.0+) changed to ESM-only and removed `.js` extension exports.

**Error:**
```
Missing "./chacha.js" specifier in "@noble/ciphers" package
```

**Attempted Fixes:**
1. Pinning `@noble/ciphers` to `0.6.0` - didn't work
2. Pinning to `0.5.3` - didn't work
3. Adding overrides in `package.json` - didn't work

**Current Fix** (in progress):
- Added Vite resolve aliases to map old paths to new:
  ```typescript
  resolve: {
    alias: {
      '@noble/ciphers/chacha.js': '@noble/ciphers/chacha',
      '@noble/ciphers/utils.js': '@noble/ciphers/utils',
    },
  },
  ```

**Sources:**
- [GitHub Issue #4531](https://github.com/better-auth/better-auth/issues/4531)
- Root cause: `@noble/ciphers@2.0.0` is ESM-only

---

### UI/UX Enhancements

#### Gradient System ✅
Added gradient utilities to `src/styles.css`:

| Class | Effect |
|-------|--------|
| `bg-gradient-page` | Subtle radial mesh gradient for backgrounds |
| `bg-gradient-primary` | Linear gradient for buttons/accents |
| `bg-gradient-sidebar` | Vertical gradient for sidebars |
| `bg-gradient-card-header` | Subtle gradient for card headers |
| `glass` | Frosted glass effect with backdrop blur |
| `border-gradient` | Gradient border using pseudo-element |
| `glow-primary` | Primary color glow shadow |

Applied to:
- Dashboard layout background
- Header with glass effect
- Auth pages

#### Decorative Circles ✅
Added floating circles to dashboard background:
- Top right: 10% opacity, large blur
- Left middle: 7% opacity
- Bottom right: 5% opacity

---

### Auth Pages Redesign ✅

#### Split-Screen Layout (Desktop)
- **Left panel**: Blue gradient with brand, features grid, decorative circles
- **Right panel**: Form with gradient background

#### Features Grid
- Track Everything (ChartLineUp icon)
- Manage Contacts (Users icon)
- Fast & Simple (Lightning icon)
- Secure & Private (ShieldCheck icon)

#### Mobile Layout
- Single column with centered branding
- Full-width form card

---

### Animated Branding (Framer Motion) ✅

**New Components** (`src/components/ui/loona-brand.tsx`):

#### `<LoonaBrand />`
Animated logo with letter-by-letter reveal animation.

```tsx
<LoonaBrand
  size="sm" | "md" | "lg" | "xl"
  variant="default" | "white" | "gradient"
  animated={true | false}
/>
```

Animation features:
- Staggered letter entrance
- Spring physics
- 3D rotation effect
- Glow pulse (white variant)

#### `<AnimatedTagline />`
Fade-in text animation with configurable delay.

#### `<FloatingCircle />`
Decorative circles with gentle up/down bobbing motion.

---

### Files Created

**Components:**
- `src/components/ui/loona-brand.tsx` - Animated brand components

**Config:**
- `render.yaml` - Render deployment config

---

### Files Updated

**Styles:**
- `src/styles.css` - Added gradient utilities, glass effect, dark mode variants

**Routes:**
- `src/routes/_auth.tsx` - Split-screen layout with animations
- `src/routes/_auth/login.tsx` - New design with gradient button
- `src/routes/_auth/signup.tsx` - New design with password requirements
- `src/routes/_dashboard.tsx` - Removed nav icon, added decorative circles

**Config:**
- `vite.config.ts` - Added resolve aliases for @noble/ciphers
- `package.json` - Added framer-motion, @noble/ciphers dependencies

---

### Dependencies Added

- `framer-motion` - Animation library for React

---

### Next Steps

1. [ ] Resolve @noble/ciphers compatibility issue
2. [ ] Complete Render deployment
3. [ ] Test animations in production
4. [ ] Add landing page with LoonaBrand component
