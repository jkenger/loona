# Vehicle Loan Module + Codebase Reorganization

## Context

Loona currently handles personal loans only. The lender needs a separate **vehicle loan** portfolio with its own borrower pool and vehicle-specific data (make, model, year, plate). Before adding the new module, we reorganize the codebase into module-based folders so both portfolios have a clean home.

## Design Decisions

- **Fully separate tables** — `vehicleContacts`, `vehicleLoans`, `vehiclePaymentSchedule`, `vehiclePayments`
- **Basic vehicle fields on loan** — `vehicleMake`, `vehicleModel`, `vehicleYear`, `vehiclePlateNumber`
- **Separate contact pool** — vehicle borrowers distinct from personal loan contacts
- **Reuse existing enums** — `loanStatusEnum`, `paymentFrequencyEnum`, `paymentMethodEnum`, `scheduleStatusEnum`
- **Reorganize first** — server files into `shared/`, `personal/`, `vehicle/` folders; routes into `/personal/` and `/vehicle/` prefixes
- **Skip for V1** — penalties, commissions, agent portal, documents, overdue cron, dashboard stats for vehicle loans

---

## Phase 0: Codebase Reorganization

### 0a. Server directory restructure

Create folders: `src/server/shared/`, `src/server/personal/`

**Move to `src/server/shared/`:**

| File            | Imported by                                               |
| --------------- | --------------------------------------------------------- |
| `session.ts`    | ~15 files (all server files + route layouts + auth pages) |
| `audit.ts`      | ~10 server files                                          |
| `dashboard.ts`  | dashboard/index.tsx                                       |
| `onboarding.ts` | \_dashboard.tsx, welcome.tsx                              |
| `admin.ts`      | admin routes                                              |

**Move to `src/server/personal/`:**

| File                     | Imported by                        |
| ------------------------ | ---------------------------------- |
| `loans.ts`               | 9 route files + agent pages        |
| `contacts.ts`            | 6 route files                      |
| `payments.ts`            | 4 files (routes + components)      |
| `penalties.ts`           | penalty-items.tsx component        |
| `penalty-settings.ts`    | 3 route files                      |
| `penalty-generation.ts`  | payments.ts, overdue-processing.ts |
| `commissions.ts`         | agent pages                        |
| `commission-settings.ts` | 3 route files                      |
| `agents.ts`              | 9 route files                      |
| `agent-portal.ts`        | \_dashboard.tsx, agents.ts         |
| `overdue-processing.ts`  | cron endpoint                      |

**Import updates needed:**

- Server-to-server: relative paths change (e.g., `"./session"` -> `"../shared/session"`)
- Route-to-server: alias paths change (e.g., `"@/server/loans"` -> `"@/server/personal/loans"`)
- ~48 files total need import path updates

### 0b. Route directory restructure

Move personal loan routes under `/personal/` prefix:

```
src/routes/_dashboard/personal/
  contacts/index.tsx, new.tsx, $contactId.tsx    (was: _dashboard/contacts/)
  loans/index.tsx, new-wizard.tsx, $loanId/...   (was: _dashboard/loans/)
  payments/index.tsx                              (was: _dashboard/payments/)
```

**Navigation link updates** — all `to="/loans"` -> `to="/personal/loans"`, etc:

- ~18 occurrences of `/loans` links across 8 files
- ~10 occurrences of `/contacts` links across 6 files
- ~4 occurrences of `/payments` links

**Unchanged routes** (stay at current level):

- `dashboard/` — main dashboard (cross-portfolio)
- `agents/` — agent management (cross-portfolio)
- `settings/` — lender settings (cross-portfolio)
- `agent/` — agent portal
- `admin/` — admin portal

**`_dashboard.tsx` nav update:**

```ts
{ name: "Contacts", href: "/personal/contacts", ... },
{ name: "Loans", href: "/personal/loans", ... },
{ name: "Payments", href: "/personal/payments", ... },
```

### 0c. Verification

- `npx tsc --noEmit` — no type errors after all moves
- All existing pages load at new URLs
- `routeTree.gen.ts` auto-regenerates

---

## Phase 1: Schema & Migration

**File:** `src/lib/db/schema.ts`

### New tables

**`vehicleContacts`** — mirrors `contacts`, no `createdByAgentId`

- id, lenderId (FK -> user), name, phone, email, address, city, facebookProfile, notes, createdAt, updatedAt

**`vehicleLoans`** — mirrors `loans` + 4 vehicle columns

- id, lenderId (FK -> user), vehicleContactId (FK -> vehicleContacts)
- **Vehicle:** vehicleMake (text, required), vehicleModel (text, required), vehicleYear (int, optional), vehiclePlateNumber (text, optional)
- **Terms:** principal, interestRate, termMonths, paymentFrequency, paymentAmount, totalToRepay
- **Denormalized:** amountPaid (default "0"), remainingBalance
- **Optional:** purpose, collateralDescription, coMakerName/Phone/Relationship
- **Status:** status (loanStatusEnum, default "active"), startDate, maturityDate, completedAt
- **Agent (future):** createdByAgentId, assignedAgentId
- createdAt, updatedAt

**`vehiclePaymentSchedule`** — mirrors `paymentSchedule`

- id, vehicleLoanId (FK -> vehicleLoans), dueDate, amount, status (scheduleStatusEnum), paidAmount, paidAt, createdAt

**`vehiclePayments`** — mirrors `payments`

- id, vehicleLoanId (FK -> vehicleLoans), scheduleItemId (FK -> vehiclePaymentSchedule)
- amount, method (paymentMethodEnum), paidAt, notes
- Reversal: reversedAt, reversedBy, reversalReason
- createdAt

### Relations

- `vehicleContactsRelations` -> lender (one), vehicleLoans (many)
- `vehicleLoansRelations` -> lender (one), vehicleContact (one), schedule (many), payments (many)
- `vehiclePaymentScheduleRelations` -> vehicleLoan (one)
- `vehiclePaymentsRelations` -> vehicleLoan (one), scheduleItem (one)
- Update `userRelations` to add `vehicleContacts: many()`, `vehicleLoans: many()`

### Types

Export `VehicleContact`, `VehicleLoan`, `VehiclePaymentScheduleItem`, `VehiclePayment` (+ `New*` insert types).

### Migration

`npx drizzle-kit generate` then `npx drizzle-kit migrate`

---

## Phase 2: Shared Utility Extraction

**New file:** `src/server/shared/loan-utils.ts`

Extract from `src/server/personal/loans.ts`:

- `calculatePaymentsCount(termMonths, frequency)` -> returns number
- `generateScheduleDates(startDate, paymentsCount, paymentAmount, frequency)` -> returns `{ dueDate, amount }[]`

Both `personal/loans.ts` and `vehicle/loans.ts` import these, then map results to add their respective FK.

---

## Phase 3: Vehicle Server Functions

### `src/server/vehicle/contacts.ts`

| Function                       | Pattern source                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| `getVehicleContacts()`         | `getContacts()` — joins vehicleLoans for loan counts                                     |
| `getVehicleContact(id)`        | `getContact()` — with vehicleLoans + schedule                                            |
| `searchVehicleContacts(query)` | `searchContacts()` — name/phone/email ilike                                              |
| `createVehicleContact(data)`   | `createContact()` — Zod: name (req), phone, email, address, city, facebookProfile, notes |
| `updateVehicleContact(data)`   | `updateContact()` — partial update                                                       |
| `deleteVehicleContact(id)`     | `deleteContact()` — blocked if has vehicle loans                                         |

### `src/server/vehicle/loans.ts`

| Function                            | Pattern source                                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| `getVehicleLoans()`                 | `getLoans()` — joins vehicleContacts for borrower name                                             |
| `getVehicleLoan(id)`                | `getLoan()` — with contact, schedule, payments (no penalties)                                      |
| `createVehicleContactAndLoan(data)` | `createContactAndLoan()` — discriminated union: new/existing contact + vehicle fields + loan terms |
| `deleteVehicleLoan(id)`             | Same pattern — blocked if has payments                                                             |

Vehicle-specific Zod fields: `vehicleMake` (required), `vehicleModel` (required), `vehicleYear` (optional), `vehiclePlateNumber` (optional)

### `src/server/vehicle/payments.ts`

| Function                       | Pattern source                                          |
| ------------------------------ | ------------------------------------------------------- |
| `getVehiclePayments()`         | `getPayments()` — joins vehicleLoans + vehicleContacts  |
| `getUpcomingVehiclePayments()` | `getUpcomingPayments()` — next 30 days, no penalty data |
| `recordVehiclePayment(data)`   | `recordPayment()` — no commission creation              |
| `reverseVehiclePayment(data)`  | `reversePayment()` — no commission reversal             |

### `src/server/shared/audit.ts`

Add audit actions: `vehicle_contact.create/update/delete`, `vehicle_loan.create/delete`, `vehicle_payment.record/reverse`
Add entity types: `vehicle_contact`, `vehicle_loan`, `vehicle_payment`

---

## Phase 4: RecordPaymentDialog Refactor

**File:** `src/components/record-payment-dialog.tsx`

Add optional `onRecordPayment` callback prop:

```ts
onRecordPayment?: (data: {
  loanId: string; scheduleItemId: string; amount: number;
  method: "cash" | "gcash" | "maya" | "bank"; paidAt: string; notes?: string;
}) => Promise<unknown>
```

If provided -> use callback. If not -> fall back to existing `recordPayment()` import. **Zero breaking changes** to existing callers.

---

## Phase 5: Vehicle Routes & UI

### Vehicle Contacts (`src/routes/_dashboard/vehicle/contacts/`)

| File             | Clone of                           | Key differences                                                            |
| ---------------- | ---------------------------------- | -------------------------------------------------------------------------- |
| `index.tsx`      | `personal/contacts/index.tsx`      | Uses `getVehicleContacts()`, links to `/vehicle/contacts/*`                |
| `new.tsx`        | `personal/contacts/new.tsx`        | Uses `createVehicleContact()`, redirects to `/vehicle/contacts/$contactId` |
| `$contactId.tsx` | `personal/contacts/$contactId.tsx` | Uses vehicle contact server fns, "New Vehicle Loan" links to wizard        |

### Vehicle Loans (`src/routes/_dashboard/vehicle/loans/`)

| File                | Clone of                           | Key differences                                                                                                                                |
| ------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.tsx`         | `personal/loans/index.tsx`         | Uses `getVehicleLoans()`, shows vehicle info (make/model/plate) on cards                                                                       |
| `new-wizard.tsx`    | `personal/loans/new-wizard.tsx`    | **5 steps**: Borrower -> Vehicle Info -> Loan Terms -> Review -> Done. Vehicle step has make/model/year/plate fields. No documents on success. |
| `$loanId/index.tsx` | `personal/loans/$loanId/index.tsx` | Uses `getVehicleLoan()`, vehicle info card at top, RecordPaymentDialog with callback, no penalties/approval/documents                          |

---

## Phase 6: Navigation

**File:** `src/routes/_dashboard.tsx`

Import `Car` from `@phosphor-icons/react`. Final `lenderNavigation`:

```ts
{ name: "Dashboard", href: "/dashboard", icon: House, exact: true },
{ name: "Contacts", href: "/personal/contacts", icon: Users },
{ name: "Loans", href: "/personal/loans", icon: CurrencyCircleDollar },
{ name: "Payments", href: "/personal/payments", icon: Receipt },
{ name: "V-Contacts", href: "/vehicle/contacts", icon: Car },
{ name: "V-Loans", href: "/vehicle/loans", icon: Car },
{ name: "Agents", href: "/agents", icon: UsersThree },
```

---

## Implementation Order

| Step | What                                                               | Depends on |
| ---- | ------------------------------------------------------------------ | ---------- |
| 0a   | Create `src/server/shared/` and `src/server/personal/`, move files | --         |
| 0b   | Update all server-to-server imports (relative paths)               | 0a         |
| 0c   | Update all route-to-server imports (`@/server/` paths)             | 0a         |
| 0d   | Move route files: contacts/, loans/, payments/ -> personal/        | --         |
| 0e   | Update all navigation links (`/loans` -> `/personal/loans`, etc.)  | 0d         |
| 0f   | Update `_dashboard.tsx` nav hrefs                                  | 0d         |
| 0g   | Verify: `npx tsc --noEmit`                                         | 0a-0f      |
| 1    | Schema: 4 new tables + relations + types in `schema.ts`            | 0g         |
| 2    | Migration: generate + migrate                                      | 1          |
| 3    | Extract `shared/loan-utils.ts` from `personal/loans.ts`            | 0g         |
| 4    | Audit types update                                                 | 0g         |
| 5    | `vehicle/contacts.ts` server functions                             | 1          |
| 6    | `vehicle/loans.ts` server functions                                | 1, 3       |
| 7    | `vehicle/payments.ts` server functions                             | 1, 3       |
| 8    | Refactor `RecordPaymentDialog` callback prop                       | --         |
| 9    | Vehicle contact routes (index, new, $contactId)                    | 5          |
| 10   | Vehicle loan routes (index, new-wizard, $loanId)                   | 6, 7, 8    |
| 11   | Final navigation update with vehicle items                         | 9, 10      |
| 12   | `npx tsc --noEmit` + manual verification                           | All        |

---

## Skipped for V1

- Penalties / penalty settings for vehicle loans
- Commission generation on vehicle payments
- Agent portal vehicle routes
- Promissory note / disclosure documents
- Dashboard stats integration
- Overdue processing cron integration

---

## Files Summary

### Phase 0 -- Reorganization (move + update imports)

| Source                              | Destination                                  |
| ----------------------------------- | -------------------------------------------- |
| `src/server/session.ts`             | `src/server/shared/session.ts`               |
| `src/server/audit.ts`               | `src/server/shared/audit.ts`                 |
| `src/server/dashboard.ts`           | `src/server/shared/dashboard.ts`             |
| `src/server/onboarding.ts`          | `src/server/shared/onboarding.ts`            |
| `src/server/admin.ts`               | `src/server/shared/admin.ts`                 |
| `src/server/loans.ts`               | `src/server/personal/loans.ts`               |
| `src/server/contacts.ts`            | `src/server/personal/contacts.ts`            |
| `src/server/payments.ts`            | `src/server/personal/payments.ts`            |
| `src/server/penalties.ts`           | `src/server/personal/penalties.ts`           |
| `src/server/penalty-settings.ts`    | `src/server/personal/penalty-settings.ts`    |
| `src/server/penalty-generation.ts`  | `src/server/personal/penalty-generation.ts`  |
| `src/server/commissions.ts`         | `src/server/personal/commissions.ts`         |
| `src/server/commission-settings.ts` | `src/server/personal/commission-settings.ts` |
| `src/server/agents.ts`              | `src/server/personal/agents.ts`              |
| `src/server/agent-portal.ts`        | `src/server/personal/agent-portal.ts`        |
| `src/server/overdue-processing.ts`  | `src/server/personal/overdue-processing.ts`  |
| `src/routes/_dashboard/contacts/`   | `src/routes/_dashboard/personal/contacts/`   |
| `src/routes/_dashboard/loans/`      | `src/routes/_dashboard/personal/loans/`      |
| `src/routes/_dashboard/payments/`   | `src/routes/_dashboard/personal/payments/`   |

Import updates: ~48 files across routes, components, and server files.

### New Files -- Vehicle Module

| File                                                    | Purpose                                                    |
| ------------------------------------------------------- | ---------------------------------------------------------- |
| `src/lib/db/schema.ts`                                  | Add 4 tables, 4 relations, update userRelations, add types |
| `src/server/shared/loan-utils.ts`                       | Extracted schedule generation helpers                      |
| `src/server/vehicle/contacts.ts`                        | 6 CRUD functions                                           |
| `src/server/vehicle/loans.ts`                           | 4 functions                                                |
| `src/server/vehicle/payments.ts`                        | 4 functions                                                |
| `src/components/record-payment-dialog.tsx`              | Add `onRecordPayment` callback prop                        |
| `src/routes/_dashboard/vehicle/contacts/index.tsx`      | List page                                                  |
| `src/routes/_dashboard/vehicle/contacts/new.tsx`        | Create form                                                |
| `src/routes/_dashboard/vehicle/contacts/$contactId.tsx` | Detail page                                                |
| `src/routes/_dashboard/vehicle/loans/index.tsx`         | List page                                                  |
| `src/routes/_dashboard/vehicle/loans/new-wizard.tsx`    | 5-step wizard                                              |
| `src/routes/_dashboard/vehicle/loans/$loanId/index.tsx` | Loan detail                                                |

---

## Verification Checklist

1. After Phase 0: `npx tsc --noEmit` passes, all existing pages work at `/personal/*` URLs
2. After Phase 1-2: 4 new tables in DB, no existing tables altered
3. After all phases: `npx tsc --noEmit` -- no type errors
4. Create vehicle contact -> appears in `/vehicle/contacts`
5. Create vehicle loan via wizard (5 steps) -> detail page shows vehicle info + schedule
6. Record payment -> schedule/loan balances update
7. Reverse payment -> balances revert
8. Nav: 7 items visible on desktop, all in mobile dropdown
