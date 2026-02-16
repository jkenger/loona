# Vehicle Loan Module

## Context

Loona currently handles personal loans only. One specific business user needs a **vehicle loan** portfolio with vehicle-specific data (make, model, year, plate). This is not a feature every lender needs — most personal/micro lenders will never use it. The module must be fully isolated so the core personal loan path stays clean for public launch.

## Design Decisions

- **Fully separate tables** — `vehicleContacts`, `vehicleLoans`, `vehiclePaymentSchedule`, `vehiclePayments`
- **Separate contact pool** — vehicle borrowers are distinct from personal loan contacts (different portfolio, different business)
- **Lender feature flag** — `vehicleLoansEnabled` in `lenderSettings` config. Nav items + routes only appear when enabled. Off by default.
- **Reuse existing enums** — `loanStatusEnum`, `paymentFrequencyEnum`, `paymentMethodEnum`, `scheduleStatusEnum`
- **No file moves** — existing server files and routes stay where they are; vehicle code is purely additive
- **No URL changes** — existing routes (`/loans`, `/contacts`, `/payments`) are untouched
- **Shared utilities** — extract `calculatePaymentsCount` + `generateScheduleDates` from `loans.ts` so vehicle code doesn't duplicate date logic
- **Skip for V1** — penalties, commissions, agent portal, documents, overdue cron, dashboard stats for vehicle loans

### Why separate tables?

Vehicle loans are a niche feature for one business. Mixing a `loanType` discriminator into the core `loans` table means every lender carries schema they don't use, core queries gain filters they don't need, and the feature can't be cleanly removed later. Separate tables keep the personal loan path pristine — zero changes to existing queries, zero risk to public users.

The tradeoff is some duplicated server functions. Shared utility extraction (`loan-utils.ts`) minimizes this — the core calculation and schedule logic is written once, and the vehicle server functions are thin wrappers around those utilities.

---

## Phase 1: Feature Flag

### `src/lib/constants/lender-defaults.ts`

Add `vehicleLoansEnabled` to the lender config:

```ts
export interface LenderConfig {
  initialCapital: number
  vehicleLoansEnabled: boolean
}

export const lenderConfigSchema = z.object({
  initialCapital: z.number().min(0).max(999_999_999),
  vehicleLoansEnabled: z.boolean(),
})

export const DEFAULT_LENDER_CONFIG: LenderConfig = {
  initialCapital: 0,
  vehicleLoansEnabled: false,
}
```

### `src/routes/_dashboard.tsx`

Read the flag from route context. Conditionally include "Vehicle" nav items only when `vehicleLoansEnabled` is `true`.

### `src/routes/_dashboard/settings/index.tsx`

Add a toggle in lender settings: "Enable Vehicle Loans". Saves to `lenderSettings.config`.

---

## Phase 2: Schema & Migration

**File:** `src/lib/db/schema.ts`

### New tables

**`vehicleContacts`** — mirrors `contacts`, no `createdByAgentId`

| Column          | Type        | Required | Notes              |
| --------------- | ----------- | -------- | ------------------ |
| id              | text (UUID) | yes      | PK                 |
| lenderId        | text (FK)   | yes      | -> user.id, cascade |
| name            | text        | yes      |                    |
| phone           | text        | no       |                    |
| email           | text        | no       |                    |
| address         | text        | no       |                    |
| city            | text        | no       |                    |
| facebookProfile | text        | no       |                    |
| notes           | text        | no       |                    |
| createdAt       | timestamp   | yes      | defaultNow         |
| updatedAt       | timestamp   | yes      | defaultNow         |

**`vehicleLoans`** — mirrors `loans` + 4 vehicle columns, no agent fields

| Column              | Type              | Required | Notes                            |
| ------------------- | ----------------- | -------- | -------------------------------- |
| id                  | text (UUID)       | yes      | PK                               |
| lenderId            | text (FK)         | yes      | -> user.id, cascade              |
| vehicleContactId    | text (FK)         | yes      | -> vehicleContacts.id, restrict  |
| vehicleMake         | text              | yes      | e.g., "Honda"                    |
| vehicleModel        | text              | yes      | e.g., "Click 150i"              |
| vehicleYear         | integer           | no       | e.g., 2022                       |
| vehiclePlateNumber  | text              | no       | e.g., "ABC 1234"                |
| principal           | decimal(12,2)     | yes      |                                  |
| interestRate        | decimal(5,2)      | yes      | % per month                      |
| termMonths          | integer           | yes      |                                  |
| paymentFrequency    | paymentFrequencyEnum | yes   | default "monthly"                |
| paymentAmount       | decimal(12,2)     | yes      | calculated                       |
| totalToRepay        | decimal(12,2)     | yes      | calculated                       |
| amountPaid          | decimal(12,2)     | yes      | default "0"                      |
| interestEarned      | decimal(12,2)     | yes      | default "0"                      |
| remainingBalance    | decimal(12,2)     | yes      |                                  |
| purpose             | text              | no       |                                  |
| collateralDescription | text            | no       |                                  |
| coMakerName         | text              | no       |                                  |
| coMakerPhone        | text              | no       |                                  |
| coMakerRelationship | text              | no       |                                  |
| status              | loanStatusEnum    | yes      | default "active"                 |
| startDate           | timestamp         | no       |                                  |
| maturityDate        | timestamp         | no       |                                  |
| completedAt         | timestamp         | no       |                                  |
| createdAt           | timestamp         | yes      | defaultNow                       |
| updatedAt           | timestamp         | yes      | defaultNow                       |

**`vehiclePaymentSchedule`** — mirrors `paymentSchedule`

| Column         | Type              | Required | Notes                          |
| -------------- | ----------------- | -------- | ------------------------------ |
| id             | text (UUID)       | yes      | PK                             |
| vehicleLoanId  | text (FK)         | yes      | -> vehicleLoans.id, cascade    |
| dueDate        | timestamp         | yes      |                                |
| amount         | decimal(12,2)     | yes      |                                |
| status         | scheduleStatusEnum | yes     | default "pending"              |
| paidAmount     | decimal(12,2)     | yes      | default "0"                    |
| paidAt         | timestamp         | no       |                                |
| createdAt      | timestamp         | yes      | defaultNow                     |

**`vehiclePayments`** — mirrors `payments`, no agent/commission fields

| Column          | Type              | Required | Notes                          |
| --------------- | ----------------- | -------- | ------------------------------ |
| id              | text (UUID)       | yes      | PK                             |
| vehicleLoanId   | text (FK)         | yes      | -> vehicleLoans.id, cascade    |
| scheduleItemId  | text (FK)         | no       | -> vehiclePaymentSchedule.id   |
| amount          | decimal(12,2)     | yes      |                                |
| method          | paymentMethodEnum  | yes     | default "cash"                 |
| paidAt          | timestamp         | yes      | defaultNow                     |
| notes           | text              | no       |                                |
| reversedAt      | timestamp         | no       |                                |
| reversedBy      | text (FK)         | no       | -> user.id                     |
| reversalReason  | text              | no       |                                |
| createdAt       | timestamp         | yes      | defaultNow                     |

### Relations

```ts
export const vehicleContactsRelations = relations(vehicleContacts, ({ one, many }) => ({
  lender: one(user, { fields: [vehicleContacts.lenderId], references: [user.id] }),
  vehicleLoans: many(vehicleLoans),
}))

export const vehicleLoansRelations = relations(vehicleLoans, ({ one, many }) => ({
  lender: one(user, { fields: [vehicleLoans.lenderId], references: [user.id] }),
  vehicleContact: one(vehicleContacts, { fields: [vehicleLoans.vehicleContactId], references: [vehicleContacts.id] }),
  schedule: many(vehiclePaymentSchedule),
  payments: many(vehiclePayments),
}))

export const vehiclePaymentScheduleRelations = relations(vehiclePaymentSchedule, ({ one, many }) => ({
  vehicleLoan: one(vehicleLoans, { fields: [vehiclePaymentSchedule.vehicleLoanId], references: [vehicleLoans.id] }),
  payments: many(vehiclePayments),
}))

export const vehiclePaymentsRelations = relations(vehiclePayments, ({ one }) => ({
  vehicleLoan: one(vehicleLoans, { fields: [vehiclePayments.vehicleLoanId], references: [vehicleLoans.id] }),
  scheduleItem: one(vehiclePaymentSchedule, { fields: [vehiclePayments.scheduleItemId], references: [vehiclePaymentSchedule.id] }),
}))
```

Update `userRelations` — add `vehicleContacts: many(vehicleContacts)`, `vehicleLoans: many(vehicleLoans)`.

### Types

```ts
export type VehicleContact = typeof vehicleContacts.$inferSelect
export type NewVehicleContact = typeof vehicleContacts.$inferInsert
export type VehicleLoan = typeof vehicleLoans.$inferSelect
export type NewVehicleLoan = typeof vehicleLoans.$inferInsert
export type VehiclePaymentScheduleItem = typeof vehiclePaymentSchedule.$inferSelect
export type NewVehiclePaymentScheduleItem = typeof vehiclePaymentSchedule.$inferInsert
export type VehiclePayment = typeof vehiclePayments.$inferSelect
export type NewVehiclePayment = typeof vehiclePayments.$inferInsert
```

### Migration

```
npx drizzle-kit generate
npx drizzle-kit migrate
```

---

## Phase 3: Shared Utility Extraction

**New file:** `src/server/loan-utils.ts`

Extract from `src/server/loans.ts` (lines 338-402):

```ts
export function calculatePaymentsCount(
  termMonths: number,
  frequency: "daily" | "weekly" | "biweekly" | "semimonthly" | "monthly"
): number

export function generateScheduleDates(
  startDate: Date,
  paymentsCount: number,
  paymentAmount: number,
  frequency: "daily" | "weekly" | "biweekly" | "semimonthly" | "monthly"
): Array<{ dueDate: Date; amount: string }>
```

`loans.ts` imports these instead of its inline copies. `vehicle/loans.ts` also imports them. This is the only change to `loans.ts` — a pure refactor, no behavior change.

---

## Phase 4: Vehicle Server Functions

### `src/server/vehicle/contacts.ts`

| Function                       | Pattern source                          |
| ------------------------------ | --------------------------------------- |
| `getVehicleContacts()`         | `getContacts()` — joins vehicleLoans for loan counts |
| `getVehicleContact(id)`        | `getContact()` — with vehicleLoans + schedule |
| `searchVehicleContacts(query)` | `searchContacts()` — name/phone/email ilike |
| `createVehicleContact(data)`   | `createContact()` — Zod: name (req), phone, email, address, city, facebookProfile, notes |
| `updateVehicleContact(data)`   | `updateContact()` — partial update |
| `deleteVehicleContact(id)`     | `deleteContact()` — blocked if has vehicle loans |

### `src/server/vehicle/loans.ts`

| Function                            | Pattern source                          |
| ----------------------------------- | --------------------------------------- |
| `getVehicleLoans()`                 | `getLoans()` — joins vehicleContacts for borrower name, includes vehicle info |
| `getVehicleLoan(id)`                | `getLoan()` — with contact, schedule, payments (no penalties) |
| `createVehicleContactAndLoan(data)` | `createContactAndLoan()` — discriminated union: new/existing contact + vehicle fields + loan terms. Uses `calculatePaymentsCount` + `generateScheduleDates` from `loan-utils.ts`. |
| `deleteVehicleLoan(id)`             | `deleteLoan()` — blocked if has payments |

Vehicle-specific Zod fields: `vehicleMake` (required), `vehicleModel` (required), `vehicleYear` (optional), `vehiclePlateNumber` (optional)

### `src/server/vehicle/payments.ts`

| Function                       | Pattern source                          |
| ------------------------------ | --------------------------------------- |
| `getVehiclePayments()`         | `getPayments()` — joins vehicleLoans + vehicleContacts |
| `getUpcomingVehiclePayments()` | `getUpcomingPayments()` — next 30 days  |
| `recordVehiclePayment(data)`   | `recordPayment()` — no commission creation |
| `reverseVehiclePayment(data)`  | `reversePayment()` — no commission reversal |

### `src/server/audit.ts`

Add audit actions: `vehicle_contact.create/update/delete`, `vehicle_loan.create/delete`, `vehicle_payment.record/reverse`

Add entity types: `vehicle_contact`, `vehicle_loan`, `vehicle_payment`

---

## Phase 5: RecordPaymentDialog Refactor

**File:** `src/components/record-payment-dialog.tsx`

Add optional `onRecordPayment` callback prop:

```ts
onRecordPayment?: (data: {
  loanId: string; scheduleItemId: string; amount: number;
  method: "cash" | "gcash" | "maya" | "bank"; paidAt: string; notes?: string;
}) => Promise<unknown>
```

If provided, use the callback. If not, fall back to existing `recordPayment()` import. **Zero breaking changes** to existing callers. Vehicle loan detail passes `recordVehiclePayment` as the callback.

---

## Phase 6: Vehicle Routes & UI

### Route structure

```
src/routes/_dashboard/vehicle/
  contacts/
    index.tsx              — vehicle contact list
    new.tsx                — create vehicle contact
    $contactId.tsx         — vehicle contact detail
  loans/
    index.tsx              — vehicle loan list
    new-wizard.tsx         — 5-step creation wizard
    $loanId/
      index.tsx            — vehicle loan detail
```

### Vehicle Contacts

| File             | Clone of                 | Key differences                            |
| ---------------- | ------------------------ | ------------------------------------------ |
| `index.tsx`      | `contacts/index.tsx`     | Uses `getVehicleContacts()`, vehicle links  |
| `new.tsx`        | `contacts/new.tsx`       | Uses `createVehicleContact()`              |
| `$contactId.tsx` | `contacts/$contactId.tsx`| Uses vehicle contact/loan server fns       |

### Vehicle Loans

| File                | Clone of                 | Key differences                            |
| ------------------- | ------------------------ | ------------------------------------------ |
| `index.tsx`         | `loans/index.tsx`        | Uses `getVehicleLoans()`, shows make/model/plate on cards |
| `new-wizard.tsx`    | `loans/new-wizard.tsx`   | **5 steps**: Borrower -> Vehicle Info -> Loan Terms -> Review -> Done. Vehicle step has make/model/year/plate fields. |
| `$loanId/index.tsx` | `loans/$loanId/index.tsx`| Vehicle info card at top. RecordPaymentDialog with `onRecordPayment` callback. No penalties/approval/documents. |

---

## Phase 7: Navigation & Settings UI

**File:** `src/routes/_dashboard.tsx`

Import `Car` from `@phosphor-icons/react`. Build `lenderNavigation` dynamically based on feature flag:

```ts
const lenderNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: House, exact: true },
  { name: "Contacts", href: "/contacts", icon: Users, exact: false },
  { name: "Loans", href: "/loans", icon: CurrencyCircleDollar, exact: false },
  { name: "Payments", href: "/payments", icon: Receipt, exact: false },
  // Vehicle items — only when enabled
  ...(vehicleLoansEnabled ? [
    { name: "V-Contacts", href: "/vehicle/contacts", icon: Car, exact: false },
    { name: "V-Loans", href: "/vehicle/loans", icon: Car, exact: false },
  ] : []),
  { name: "Agents", href: "/agents", icon: UsersThree, exact: false },
]
```

The `vehicleLoansEnabled` flag is already available in route context via `lenderSettings` (loaded in the `_dashboard` layout loader).

**File:** `src/routes/_dashboard/settings/index.tsx`

Add a "Vehicle Loans" section with a toggle switch:

```
Vehicle Loans
Enable the vehicle loan portfolio for managing vehicle financing.
[Toggle: Off]
```

When toggled on, the nav items appear on next page load.

---

## Implementation Order

| Step | What                                                                     | Depends on |
| ---- | ------------------------------------------------------------------------ | ---------- |
| 1    | Feature flag: update `lender-defaults.ts` + settings UI toggle           | --         |
| 2    | Schema: 4 new tables + relations + types in `schema.ts`                  | --         |
| 3    | Migration: `drizzle-kit generate` + `drizzle-kit migrate`                | 2          |
| 4    | Extract `loan-utils.ts` from `loans.ts`                                  | --         |
| 5    | Audit types update                                                       | --         |
| 6    | `vehicle/contacts.ts` — 6 CRUD functions                                 | 2          |
| 7    | `vehicle/loans.ts` — 4 functions (uses `loan-utils.ts`)                  | 2, 4       |
| 8    | `vehicle/payments.ts` — 4 functions                                      | 2          |
| 9    | Refactor `RecordPaymentDialog` — add `onRecordPayment` callback          | --         |
| 10   | Vehicle contact routes (index, new, $contactId)                          | 6          |
| 11   | Vehicle loan routes (index, new-wizard, $loanId)                         | 7, 8, 9    |
| 12   | Navigation update — conditional vehicle nav items based on feature flag   | 1, 10, 11  |
| 13   | `npx tsc --noEmit` + manual verification                                | All        |

---

## Skipped for V1

- Penalties / penalty settings for vehicle loans
- Commission generation on vehicle payments
- Agent portal vehicle routes
- Promissory note / disclosure documents
- Dashboard stats integration (vehicle portfolio summary)
- Overdue processing cron integration

---

## Files Summary

### Modified files

| File                                               | Change                                   |
| -------------------------------------------------- | ---------------------------------------- |
| `src/lib/db/schema.ts`                             | Add 4 tables, 4 relations, update userRelations, add types |
| `src/lib/constants/lender-defaults.ts`             | Add `vehicleLoansEnabled` to config      |
| `src/server/loans.ts`                              | Import from `loan-utils.ts` (refactor only) |
| `src/server/audit.ts`                              | Add vehicle audit actions + entity types |
| `src/components/record-payment-dialog.tsx`         | Add `onRecordPayment` callback prop      |
| `src/routes/_dashboard.tsx`                        | Conditional vehicle nav items            |
| `src/routes/_dashboard/settings/index.tsx`         | Vehicle loans toggle in settings         |

### New files

| File                                                    | Purpose                                 |
| ------------------------------------------------------- | --------------------------------------- |
| `src/server/loan-utils.ts`                              | Extracted `calculatePaymentsCount` + `generateScheduleDates` |
| `src/server/vehicle/contacts.ts`                        | 6 CRUD functions                        |
| `src/server/vehicle/loans.ts`                           | 4 functions                             |
| `src/server/vehicle/payments.ts`                        | 4 functions                             |
| `src/routes/_dashboard/vehicle/contacts/index.tsx`      | Contact list page                       |
| `src/routes/_dashboard/vehicle/contacts/new.tsx`        | Create contact form                     |
| `src/routes/_dashboard/vehicle/contacts/$contactId.tsx` | Contact detail page                     |
| `src/routes/_dashboard/vehicle/loans/index.tsx`         | Loan list page                          |
| `src/routes/_dashboard/vehicle/loans/new-wizard.tsx`    | 5-step creation wizard                  |
| `src/routes/_dashboard/vehicle/loans/$loanId/index.tsx` | Loan detail page                        |

**Total: 7 modified files, 10 new files.** Zero existing queries modified. Zero URL changes. Core personal loan path untouched.

---

## Verification Checklist

1. Feature flag off (default): no vehicle nav items, vehicle routes return 404 or redirect
2. Feature flag on: "V-Contacts" and "V-Loans" appear in nav
3. After migration: 4 new tables in DB, no existing tables altered
4. After all phases: `npx tsc --noEmit` passes
5. Create vehicle contact -> appears in `/vehicle/contacts`
6. Create vehicle loan via wizard (5 steps) -> detail page shows vehicle info + schedule
7. Record payment on vehicle loan -> schedule and balance update
8. Reverse payment on vehicle loan -> balances revert
9. Personal loan pages (`/loans`, `/contacts`, `/payments`) are completely unaffected
10. Settings page shows vehicle loans toggle
11. Toggle off -> vehicle nav items disappear, feature hidden
