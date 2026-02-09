# Compliance Audit — Loona Lending Management App

**Date:** February 8, 2026
**Scope:** Regulatory compliance review for personal and micro lenders in the Philippines
**Status:** Documented — pending remediation

---

## Who This Is For

Loona is built for **individual and micro lenders** — people who lend their own money to friends, family, co-workers, or small communities. These are not SEC-registered lending companies. Think of the neighborhood "5-6" lender, a sari-sari store owner extending credit, or someone helping a relative with tuition.

Even though personal lenders aren't subject to SEC lending company regulations (RA 9474, SEC MC 19-2019), basic consumer protection and disclosure laws still apply to all credit transactions in the Philippines. This audit focuses on the rules that matter for personal lenders.

---

## Rules That Apply to Personal Lenders

| Law | What It Means for You |
|-----|----------------------|
| **RA 3765** | Truth in Lending Act — you must tell borrowers the full cost of the loan before they sign (interest, fees, total amount) |
| **RA 10173** | Data Privacy Act — you need consent before storing someone's personal info (name, phone, address) |
| **RA 7394** | Consumer Protection Act — borrowers have basic rights you can't waive |
| **Civil Code** | Courts can throw out loan terms they consider unfair or exploitative, even if both parties signed |
| **BSP Circular 905** | Standard for computing the Effective Interest Rate (EIR) — the "true" annual cost of a loan |

> **Note:** RA 9474 (Lending Company Regulation Act) and SEC MC 19-2019 (6% monthly cap) apply only to registered lending/financing companies, not to individuals lending their own money. However, if you lend regularly and at scale, you may need to register. Consult a lawyer if unsure.

---

## How Interest Works in Loona

Loona uses **flat/simple interest** — the most common method in Philippine micro lending. Interest is calculated on the full principal for the entire term:

```
totalInterest = principal × (rate / 100) × termMonths
totalToRepay  = principal + totalInterest
paymentAmount = totalToRepay / numberOfPayments
```

This is how most "5-6" and paluwagan-style lending works. The borrower knows upfront exactly how much they'll pay each period and the total cost.

The app also calculates the **Effective Interest Rate (EIR)** — this shows the "true" annual cost when you account for the fact that the borrower is paying back gradually. The EIR is always higher than the flat rate because you're charging interest on money the borrower has already returned. Both the flat rate and EIR are shown on the Disclosure Statement so there are no surprises.

**Verdict:** Flat rate + EIR disclosure is compliant with RA 3765.

---

## Findings

### Critical

#### 1. ~~No Duplicate Payment Prevention~~ ✅ Fixed
- **Location:** `src/server/payments.ts` — `recordPayment` function
- **Problem:** If you accidentally tap "Record Payment" twice, it could save the same payment two times — messing up your balances and any agent commissions.
- **Fix applied:** The app now checks for a matching payment (same loan, same schedule item, same amount) recorded in the last 60 seconds. If found, it blocks the second one.

#### 2. ~~No Interest Rate Hard Ceiling~~ ✅ Fixed
- **Location:** `src/server/loans.ts` — all 5 loan creation schemas
- **Problem:** The app allowed rates up to 100% per month (that's 13,000% a year). If a borrower ever challenges a loan with rates that high, a court would almost certainly throw it out — and you lose everything, not just the interest.
- **Fix applied:** Capped at 15% per month (180% annually). Still generous for micro lending, but within a range courts are more likely to uphold. The UI warns you at 3% and 6%, and blocks anything above 15%.

#### 3. Data Privacy Act Non-Compliance (RA 10173)
- **Location:** Entire app — no consent tracking, retention policy, or deletion mechanism
- **Problem:** You're storing borrower personal info (name, phone, address) but the app doesn't track whether they agreed to that. Under RA 10173, you need their consent before keeping their data.
- **Recommendation:**
  - Track when and how each borrower gave consent
  - Add a privacy notice to the Disclosure Statement
  - Let borrowers request deletion of their data
  - Define how long you keep records after a loan is paid off

---

### High

#### 4. ~~Missing Penalty/Default Charge Disclosure~~ ✅ Fixed
- **Location:** `src/routes/_dashboard/loans/$loanId/disclosure.tsx` — Credit Terms table
- **Problem:** The Disclosure Statement didn't mention late fees, default charges, or prepayment penalties. Even though Loona doesn't charge any of these, the law (RA 3765) says you must disclose ALL charges — including saying "none" when there are none.
- **Fix applied:** Added rows 13–15 to the Credit Terms table: Late Payment Penalty (None), Default/Acceleration Charges (None), Prepayment Policy (No penalty for early repayment).

#### 5. Attorney's Fees Clause Too High
- **Location:** Promissory note default clauses — 25% attorney's fees with PHP 5,000 minimum
- **Problem:** If you ever go to court, the judge will almost certainly reduce a 25% attorney's fees clause. Courts usually allow 10–15% at most. Having an unreasonably high clause can actually work against you — it makes the whole contract look unfair.
- **Recommendation:** Lower to 10–15%, or just say "reasonable attorney's fees as determined by the court"

#### 6. Agent-Created Loans Missing Payment Schedule
- **Location:** `src/server/loans.ts:779` — schedule generated only on approval, not creation
- **Problem:** When an agent creates a loan, the payment schedule isn't generated until you approve it. That means the Disclosure Statement can't show payment dates yet — but the law says borrowers need to see the full terms before they receive money.
- **Recommendation:** Generate the payment schedule when the loan is created, not when it's approved

#### 7. No Payment Allocation Method Documented
- **Location:** `src/server/payments.ts` — `recordPayment` function
- **Problem:** When a borrower makes a partial payment, where does the money go — interest first? principal first? Right now there's no documented order, and the law says you should be clear about this.
- **Recommendation:** Pick an order (usually: penalties first, then interest, then principal) and add it to the Disclosure Statement

---

### Medium

#### 8. No Overpayment Handling
- **Location:** `src/server/payments.ts`
- **Problem:** If a borrower pays more than what they owe, the app just accepts it. Any agent commission is also calculated on the overpaid amount — so you'd be paying commission on money you need to return.
- **Recommendation:** Either cap the payment at the remaining balance, or flag it for you to review manually

#### 9. Payment Date Not Validated
- **Location:** `src/server/payments.ts:24`
- **Problem:** You can record a payment with a future date, which shouldn't be possible — a payment hasn't happened yet if it's dated tomorrow.
- **Recommendation:** Block payment dates that are in the future

#### 10. Missing Right-to-Rescind Clause
- **Location:** `src/routes/_dashboard/loans/$loanId/disclosure.tsx` — Borrower's Acknowledgment
- **Problem:** Borrowers may have the right to cancel a loan within a short period after signing. This isn't mentioned anywhere in the disclosure.
- **Recommendation:** Add a line about the borrower's right to cancel, if applicable

#### 11. Exclusive Venue Clause May Not Hold Up
- **Location:** Promissory note venue clause
- **Problem:** The promissory note says disputes must be filed in a specific court location. If that's far from where the borrower lives, a court might ignore it — consumer protection law (RA 7394) frowns on clauses that make it hard for borrowers to defend themselves.
- **Recommendation:** Either drop "exclusive" or add the borrower's city as an option

#### 12. Co-Maker Liability Type Unclear
- **Location:** Promissory note co-maker section
- **Problem:** The note doesn't clearly say what the co-maker is agreeing to. Are they a backup (guarantor — you go to them only after the borrower can't pay) or equally responsible (solidary debtor — you can collect from either one)?
- **Recommendation:** Add clear language like: "The co-maker is equally responsible for the full loan amount (solidary debtor)"

#### 13. Missing Negotiable Instrument Status
- **Location:** `src/routes/_dashboard/loans/$loanId/promissory-note.tsx`
- **Problem:** The promissory note doesn't say whether it can be passed to someone else (negotiable) or not. For personal lending, you almost certainly don't want someone else collecting on your note.
- **Recommendation:** Add: "This is a NON-NEGOTIABLE promissory note"

#### 14. No Interest Computation Method in Promissory Note
- **Location:** Promissory note interest clause
- **Problem:** The note says "interest at X% per month" but doesn't explain how it's calculated. If there's ever a dispute, the borrower could argue they expected a different calculation method.
- **Recommendation:** Add: "Interest is calculated as a flat rate on the original principal for the full loan term"

#### 15. Semi-Monthly Payment Count Approximation
- **Location:** `src/lib/utils/eir.ts:61` — uses `termMonths * 2`
- **Problem:** The EIR calculation for semi-monthly loans uses a simplified count (2 payments per month) which is slightly off from the actual schedule. Minor impact — EIR might be off by a fraction.
- **Recommendation:** Match the actual payment schedule logic for slightly more accurate EIR

#### 16. No Agent License/Credential Verification
- **Location:** `src/server/agents.ts` — `createAgent` function
- **Problem:** If you ever scale to the point where you need to register as a lending company, your agents may need licenses too. Right now there's no way to track that.
- **Recommendation:** Add optional fields for agent credentials — not urgent for personal lending

#### 17. No Loan Modification Audit Trail
- **Location:** Database schema — no amendments table
- **Problem:** If you change the terms of a loan after it's created (lower the rate, extend the term, etc.), there's no record of what the original terms were. This can cause disputes later.
- **Recommendation:** Keep a history of changes — what changed, when, and why

#### 18. Commission Config Changes Not Tracked
- **Location:** `commissionSettings` table
- **Problem:** If you change how much commission your agents earn, there's no record of the old rates. An agent could dispute their payout if you changed the rates mid-month.
- **Recommendation:** Track who changed the commission settings and when, and keep the previous config

---

### Low

#### 19. No Minimum Loan Term Requirement
- **Location:** `src/server/loans.ts:15` — allows `termMonths = 1`
- **Problem:** A 1-month loan at a high rate looks extreme on the EIR. Not illegal, but could look bad in a dispute.
- **Recommendation:** Consider setting a minimum of 1–3 months

#### 20. No Maximum Principal Limit
- **Location:** `src/server/loans.ts:13` — no cap on principal
- **Problem:** Nothing stops you from creating a ₱10 million loan. There's no check on whether the borrower can actually afford it.
- **Recommendation:** Add an optional setting where you can set your own max loan amount

#### 21. No Disbursement Confirmation Before Loan Activation
- **Location:** Loan creation flow
- **Problem:** The app doesn't confirm that the borrower actually signed the Disclosure Statement and Promissory Note before you released the money. If there's a dispute, you want proof they signed first.
- **Recommendation:** Add a checkbox or date field to confirm documents were signed before disbursement

---

## What's Working Well

| Area | What It Does |
|------|-------------|
| **Disclosure Statement** | Shows the full cost of the loan in a clear table — available in English and Filipino. Includes EIR, signature blocks, and borrower acknowledgment. This is your main proof that the borrower knew the terms. |
| **EIR Calculation** | Correctly computes the "true" annual cost using the standard IRR method. Works for all payment frequencies. |
| **Promissory Note** | Has all the essential parts — who owes what, how much, when it's due, and signature lines. Includes co-maker section. |
| **Login & Permissions** | Every action checks who you are and what you're allowed to do. Agents can only see and do what you've permitted. |
| **Audit Log** | Every important action (loan created, payment recorded, etc.) is logged with who did it and when. Useful if there's ever a question about what happened. |
| **Agent Controls** | You decide exactly what each agent can do — create loans, record payments, or both. You can deactivate them anytime. |
| **Payment Schedule** | Generates the correct number of payments for daily, weekly, bi-weekly, semi-monthly, and monthly frequencies. |

---

## Remediation Priority

| Phase | What to Fix | When |
|-------|------------|------|
| **Phase 1** ✅ | Duplicate payment prevention, interest rate ceiling, penalty disclosure | Before production — **done** |
| **Phase 2** | Data privacy consent, payment allocation order, attorney's fees clause | Before you start lending to people outside your immediate circle |
| **Phase 3** | Promissory note improvements (negotiability, computation method, co-maker clarity), venue clause | When you have time — these strengthen your documents |
| **Phase 4** | Agent licensing fields, loan modification history, disbursement confirmation | If you grow beyond personal lending |

---

## Disclaimer

This is a technical code review, not legal advice. If you're lending money to people, it's worth talking to a lawyer — even a one-time consultation can save you a lot of trouble. Key things a lawyer can help with:

- Whether you need to register as a lending company (depends on how often and how much you lend)
- How to properly handle borrower data under the Data Privacy Act
- Making sure your promissory note will actually hold up if you need to use it
- Whether having agents collect payments creates any registration requirements
