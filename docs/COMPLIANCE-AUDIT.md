# Compliance Audit — Loona Lending Management App

**Date:** February 8, 2026
**Scope:** Regulatory compliance review against Philippine lending laws
**Status:** Documented — pending remediation

---

## Applicable Regulations

| Law | Description |
|-----|-------------|
| **RA 3765** | Truth in Lending Act — requires full disclosure of credit terms and EIR |
| **RA 9474** | Lending/Financing Company Regulation Act — licensing, rate caps |
| **RA 10173** | Data Privacy Act — personal data handling, consent, retention |
| **RA 7394** | Consumer Protection Act — borrower rights |
| **SEC MC 19-2019** | Interest rate caps for registered lending companies (6% monthly) |
| **BSP Circular 905** | EIR computation standards |

---

## Interest Rate Model

Loona uses **flat/simple interest** — interest is calculated on the full principal for the entire term:

```
totalInterest = principal × (rate / 100) × termMonths
totalToRepay  = principal + totalInterest
paymentAmount = totalToRepay / numberOfPayments
```

This is standard practice in Philippine informal and microfinance lending. The **Effective Interest Rate (EIR)** is separately calculated using the IRR method (Newton-Raphson) on the actual payment cash flows, which correctly shows the true annualized cost. Both the nominal flat rate and EIR are disclosed in the Disclosure Statement, satisfying RA 3765 requirements.

**Verdict:** Flat rate + EIR disclosure is compliant.

---

## Findings

### Critical

#### 1. No Duplicate Payment Prevention
- **Location:** `src/server/payments.ts` — `recordPayment` function
- **Risk:** Same payment can be recorded twice, creating accounting errors and incorrect commission payouts
- **Recommendation:** Add idempotency check — reject payments with identical loan, amount, and timestamp within 60 seconds
- **Regulation:** General accounting integrity

#### 2. No Interest Rate Hard Ceiling
- **Location:** `src/server/loans.ts:14` — validation allows `interestRate` up to 100% monthly (13,000% annually)
- **Risk:** Courts will void contracts with unconscionable rates. Even with disclosure, rates this high create legal liability.
- **Recommendation:** Hard cap at ~10% monthly. Require explicit borrower acknowledgment above 4% monthly (48% p.a.).
- **Regulation:** Civil Code Art. 1409 (unconscionable contracts), SEC MC 19-2019

#### 3. Data Privacy Act Non-Compliance (RA 10173)
- **Location:** Entire app — no consent tracking, retention policy, or deletion mechanism
- **Risk:** Collecting and processing borrower personal information (name, phone, address, email) without documented consent violates RA 10173
- **Recommendation:**
  - Add consent tracking fields to schema (`consentDate`, `consentType`)
  - Add data privacy notice to Disclosure Statement
  - Implement data deletion request mechanism
  - Define and document data retention policy
- **Regulation:** RA 10173 Articles III, VI

---

### High

#### 4. Missing Penalty/Default Charge Disclosure
- **Location:** `src/routes/_dashboard/loans/$loanId/disclosure.tsx` — Credit Terms table
- **Risk:** RA 3765 Section 3 requires disclosure of ALL charges including late payment penalties, default charges, and prepayment penalties. Currently only regular payment amounts are shown.
- **Recommendation:** Add rows for late payment penalty, default/acceleration penalty, and prepayment policy

#### 5. Attorney's Fees Clause Excessive
- **Location:** Promissory note default clauses — 25% attorney's fees with PHP 5,000 minimum
- **Risk:** Philippine courts regularly reduce attorney's fees above 10-15% as unconscionable (e.g., *Andres v. Manufacturers Hanover*, G.R. 117935)
- **Recommendation:** Reduce to 10-15% or reference actual negotiated counsel fees

#### 6. Agent-Created Loans Missing Payment Schedule
- **Location:** `src/server/loans.ts:779` — schedule generated only on approval, not creation
- **Risk:** No schedule means no disclosure can be generated, violating RA 3765 requirement for disclosure before disbursement
- **Recommendation:** Generate payment schedule immediately when loan is created

#### 7. No Payment Allocation Method Documented
- **Location:** `src/server/payments.ts` — `recordPayment` function
- **Risk:** When payment is received, there's no documented order of allocation (penalties -> interest -> principal). RA 3765 requires clear payment allocation disclosure.
- **Recommendation:** Define and disclose allocation order, add to Disclosure Statement

---

### Medium

#### 8. No Overpayment Handling
- **Location:** `src/server/payments.ts`
- **Risk:** If payment exceeds remaining balance, it's accepted without refund logic. Commission is also calculated on the full overpayment amount.
- **Recommendation:** Cap accepted amount to remaining balance, or flag overpayment for manual review

#### 9. Payment Date Not Validated
- **Location:** `src/server/payments.ts:24`
- **Risk:** Future-dated payments can be recorded
- **Recommendation:** Reject payment dates in the future

#### 10. Missing Right-to-Rescind Clause
- **Location:** `src/routes/_dashboard/loans/$loanId/disclosure.tsx` — Borrower's Acknowledgment
- **Risk:** Borrowers may have limited rescission rights that should be disclosed
- **Recommendation:** Add clause about borrower's right to rescind within applicable period

#### 11. Exclusive Venue Clause May Be Unenforceable
- **Location:** Promissory note venue clause
- **Risk:** Exclusive venue clauses that disadvantage the borrower may violate RA 7394 Section 29
- **Recommendation:** Change to non-exclusive venue or allow borrower's residence as alternative

#### 12. Co-Maker Liability Type Unclear
- **Location:** Promissory note co-maker section
- **Risk:** Doesn't clearly state whether co-maker is a guarantor (secondary liability) or solidary debtor (primary liability)
- **Recommendation:** Add explicit language: "Co-maker acts as solidary debtor, not as guarantor"

#### 13. Missing Negotiable Instrument Status
- **Location:** `src/routes/_dashboard/loans/$loanId/promissory-note.tsx`
- **Risk:** Promissory note doesn't state whether it's negotiable or non-negotiable per RA 2031
- **Recommendation:** Add: "This is a NON-NEGOTIABLE promissory note"

#### 14. No Interest Computation Method in Promissory Note
- **Location:** Promissory note interest clause
- **Risk:** States "interest at X% per month" but doesn't specify computation method (flat rate on full principal)
- **Recommendation:** Add: "Interest shall be computed as a flat rate on the original principal amount for the full loan term"

#### 15. Semi-Monthly Payment Count Approximation
- **Location:** `src/lib/utils/eir.ts:61` — uses `termMonths * 2`
- **Risk:** Slight EIR inaccuracy for semi-monthly frequency
- **Recommendation:** Align with actual payment schedule generation logic

#### 16. No Agent License/Credential Verification
- **Location:** `src/server/agents.ts` — `createAgent` function
- **Risk:** If lender is a registered lending company under RA 9474, agents may need to be licensed
- **Recommendation:** Add optional license tracking fields

#### 17. No Loan Modification Audit Trail
- **Location:** Database schema — no amendments table
- **Risk:** If loan terms are modified, there's no record of original vs. amended terms
- **Recommendation:** Add `loanAmendments` table with before/after snapshots

#### 18. Commission Config Changes Not Tracked
- **Location:** `commissionSettings` table
- **Risk:** No audit trail when commission tiers/rules change
- **Recommendation:** Add `changedBy`, `changedAt`, `previousConfig` tracking

---

### Low

#### 19. No Minimum Loan Term Requirement
- **Location:** `src/server/loans.ts:15` — allows `termMonths = 1`
- **Risk:** Very short terms with high rates can produce extreme effective rates
- **Recommendation:** Consider minimum term of 1-3 months

#### 20. No Maximum Principal Limit
- **Location:** `src/server/loans.ts:13` — no cap on principal
- **Risk:** No affordability check or concentration limit per borrower
- **Recommendation:** Add optional lender-configurable max loan amount

#### 21. No Disbursement Confirmation Before Loan Activation
- **Location:** Loan creation flow
- **Risk:** No system confirmation that borrower signed disclosure/promissory note before funds were released
- **Recommendation:** Add required checkbox or signature date tracking

---

## What's Working Well

| Area | Details |
|------|---------|
| **Disclosure Statement** | Comprehensive credit terms table, bilingual (English/Filipino), EIR calculation, borrower acknowledgment, signature blocks |
| **EIR Calculation** | Correct IRR method using Newton-Raphson, properly annualized, handles all payment frequencies |
| **Promissory Note** | Essential legal elements present — unconditional promise, specified sum, parties identified, signature blocks, co-maker undertaking |
| **Auth & Authorization** | Server functions verify session, role-based access (lender/agent/admin), ownership checks on resources |
| **Audit Logging** | All significant actions logged with user, timestamp, IP, and metadata |
| **Agent Permissions** | Granular controls — `canCreateLoans`, `canRecordPayments`, status tracking |
| **Payment Schedule** | Correct generation for all frequencies (daily, weekly, biweekly, semi-monthly, monthly) |

---

## Remediation Priority

| Phase | Items | Target |
|-------|-------|--------|
| **Phase 1** | Duplicate payment prevention, interest rate ceiling, penalty disclosure | Before production |
| **Phase 2** | Data Privacy Act compliance, payment allocation documentation, attorney's fees | Before scaling |
| **Phase 3** | Promissory note improvements (negotiability, computation method, co-maker), venue clause | Ongoing |
| **Phase 4** | Agent licensing, loan amendments tracking, disbursement confirmation | Future |

---

## Disclaimer

This audit is a technical code review, not legal advice. Consult a Philippine fintech/securities lawyer before deploying with real borrowers. Key areas requiring legal counsel:

- Classification of lender users (personal lender vs. lending company under RA 9474)
- Data Privacy Act compliance implementation specifics
- Enforceability of promissory note clauses in target jurisdictions
- Whether agent operations trigger SEC registration requirements
