# Agent Commission Model v1.0

> Experimental system — Tier 1 & 2 only. Tier 3 reserved for future.

## Overview

Agents serve two roles:
1. **Originator** — find and refer new borrowers from their personal network
2. **Collector** — ensure referred borrowers pay on time

Payments go directly to the lender (ewallet/bank). Agents never handle funds.

---

## Commission Structure

### Collection Commission (ongoing)

Earned per successful, verified collection.

| Tier | Name | Rate | Portfolio Cap |
|------|------|------|---------------|
| 1 | Probationary | Fixed ₱50 per collection | Up to 10 loans |
| 2 | Trusted | 3% of collected amount OR ₱50, whichever is higher | Up to 20 loans |
| 3 | Senior (future) | TBD — up to 4% ceiling | TBD |

**"Whichever is higher" examples (Tier 2):**

| Loan Size | ~Monthly Payment | 3% | Flat ₱50 | Agent Earns |
|-----------|-----------------|-----|----------|-------------|
| ₱3,000 | ~₱620 | ₱18.60 | ₱50 | **₱50** (flat wins) |
| ₱5,000 | ~₱1,033 | ₱31 | ₱50 | **₱50** (flat wins) |
| ₱10,000 | ~₱2,067 | ₱62 | ₱50 | **₱62** (% wins) |
| ₱15,000 | ~₱3,100 | ₱93 | ₱50 | **₱93** (% wins) |
| ₱20,000 | ~₱4,133 | ₱124 | ₱50 | **₱124** (% wins) |
| ₱30,000 | ~₱6,200 | ₱186 | ₱50 | **₱186** (% wins) |

*Estimates assume ~4% monthly interest, 6-month term, monthly payments.*

### Origination Bonus (one-time per referral)

| Tier | Bonus | Paid When |
|------|-------|-----------|
| 1 | ₱100 per qualified referral | After borrower's 3rd successful payment |
| 2 | ₱200 per qualified referral | After borrower's 2nd successful payment |

**Why delayed payment:** Protects lender from bad referrals. Agent is incentivized to refer borrowers who actually pay, not just anyone.

**Disqualified if:** Borrower defaults before the qualifying payment count is met.

---

## Tier Progression

### Tier 1 → Tier 2 Criteria (ALL must be met)

- Minimum **3 months** active as agent
- At least **15 successful collections** completed
- **85%+ on-time collection rate** on assigned portfolio (borrowers paying on or before due date)
- **Zero** referred borrowers who defaulted within first 2 months of their loan
- No complaints from borrowers about agent conduct

### Demotion (Tier 2 → Tier 1)

- On-time collection rate drops below **70% for 2 consecutive months**
- Demotion effective the following month
- Can re-qualify for Tier 2 after meeting original criteria again

### Termination

- Mishandling of cash (if cash collection is ever permitted)
- Making unauthorized promises to borrowers (extensions, reduced amounts, waivers)
- Misrepresenting loan terms to potential borrowers
- Any fraud or dishonesty

---

## Agent Rules & Boundaries

1. **No fund handling** — All payments must go directly to the lender via ewallet or bank transfer. Cash is accepted only as last resort and must be remitted same-day with proof.
2. **No authority to modify terms** — Agents cannot promise payment extensions, reduced amounts, interest waivers, or any changes to loan terms. Only the lender can approve modifications.
3. **Respectful communication** — Agents must follow the lender's tone and approach when communicating with borrowers. No harassment, threats, or inappropriate contact.
4. **Transparency** — Agents must not misrepresent loan terms, interest rates, or any conditions to potential or existing borrowers.
5. **Confidentiality** — Borrower information must not be shared with anyone outside the lending relationship.

---

## Payout

- Commission is computed automatically per verified collection
- Origination bonus is computed after qualifying payment count is met
- Payout schedule: **Monthly** (lender pays accumulated commission on a set date)
- Lender confirms and triggers payout manually

---

## App-wide Settings (Loona)

These values are configured once and apply to ALL agents:

| Setting | Tier 1 Value | Tier 2 Value |
|---------|-------------|-------------|
| Collection commission type | Fixed | Percentage or fixed (whichever is higher) |
| Fixed amount per collection | ₱50 | ₱50 (floor) |
| Percentage rate | — | 3% |
| Origination bonus | ₱100 | ₱200 |
| Origination qualifying payments | 3 | 2 |
| Portfolio cap | 10 loans | 20 loans |
| Probation period (months) | 3 | — |
| Min collections for promotion | 15 | — |
| Min on-time rate for promotion | 85% | — |

---

## Monthly Income Estimates (Agent)

### Tier 1 — Managing 10 loans, monthly collections
- Collection: 10 × ₱50 = **₱500/month**
- Origination: ~1-2 new referrals/month × ₱100 = **₱100-200/month** (after qualifying)
- **Total: ~₱600-700/month**

### Tier 2 — Managing 15 loans, monthly collections
- Collection: 15 × ~₱93 avg = **~₱1,395/month**
- Origination: ~2-3 new referrals/month × ₱200 = **₱400-600/month** (after qualifying)
- **Total: ~₱1,800-2,000/month**

### Lender Cost (% of interest income)
- Average loan ₱17.5k at 4% monthly = ₱700/month interest income
- Tier 1 cost: ₱50/collection = ~7% of interest income per loan
- Tier 2 cost: ~₱93/collection = ~13% of interest income per loan
- Well within sustainable margins

---

## Tier 3 (Future — Notes)

Reserved for when the system is proven and the portfolio grows. Possible direction:
- 3.5-4% of collected amount OR ₱75 floor
- 25+ loan portfolio
- Quarterly performance bonuses
- Referral bonus increase to ₱300
- Possibly handle delinquent/hard collections at premium rate
- Requires 6+ months at Tier 2 with 90%+ on-time rate
