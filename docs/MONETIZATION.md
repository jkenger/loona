# Loona Monetization Plan

## Target Market

**Solo/Private Lenders** - Individuals lending their own money, typically managing 10-100+ loans.

### Key Characteristics
- Price-sensitive but value organization
- Payments collected externally (cash, GCash, Maya, bank transfer)
- Loona is for **recording** transactions, not processing them
- Main value: tracking, organization, reducing defaults

---

## Pricing Model: Freemium with Loan Limits

### Tiers

| Tier | Price | Active Loans | Agents | Features |
|------|-------|--------------|--------|----------|
| **Free** | ₱0 | Up to 10 | 0 | Basic tracking, dashboard |
| **Pro** | ₱499/mo | Up to 50 | Up to 3 | + Agents, commission tracking |
| **Unlimited** | ₱999/mo | Unlimited | Unlimited | + Export, priority support |

### Why This Model

1. **Low barrier to entry** - Free tier builds trust and habit
2. **Natural upgrade path** - 10 loans is enough to see value, not enough to run a business
3. **Predictable pricing** - No surprises, easy to budget
4. **Affordable** - ₱499-999/mo is minimal compared to risk of lost money from poor tracking

---

## Feature Matrix

| Feature | Free | Pro | Unlimited |
|---------|------|-----|-----------|
| Loan tracking | ✓ | ✓ | ✓ |
| Payment recording | ✓ | ✓ | ✓ |
| Contact management | ✓ | ✓ | ✓ |
| Dashboard & analytics | ✓ | ✓ | ✓ |
| Payment calendar | ✓ | ✓ | ✓ |
| Active loan limit | 10 | 50 | Unlimited |
| Agent accounts | - | Up to 3 | Unlimited |
| Commission tracking | - | ✓ | ✓ |
| Agent loan creation | - | ✓ | ✓ |
| Export reports (CSV/PDF) | - | - | ✓ |
| Priority support | - | - | ✓ |
| API access | - | - | ✓ |

---

## Future Paid Add-ons

These can be added as premium features or usage-based charges:

### SMS/Email Reminders
- Payment due reminders sent to borrowers
- ₱1-2 per SMS, free email
- Could be included in higher tiers

### Document Generation
- Loan contracts, promissory notes
- Payment receipts
- ₱5-10 per document or included in paid tiers

### Credit Scoring Integration
- Integration with credit bureaus
- Risk assessment for new borrowers
- Premium feature for Unlimited tier

### Payment Gateway Integration
- Direct collection via GCash/Maya
- Would enable transaction-based revenue
- Convenience feature, not core to MVP

---

## Implementation Phases

### Phase 1: Soft Limits (Current)
- No payment required
- Track usage metrics
- Understand actual user behavior

### Phase 2: Usage Tracking
- Add subscription status to user model
- Track active loan counts
- Show usage in dashboard/settings

### Phase 3: Payment Integration
- Integrate payment provider (PayMongo, Xendit, or GCash)
- Implement plan selection UI
- Add billing management

### Phase 4: Enforcement
- Enforce limits for free tier
- Grace period for existing users
- Grandfather early adopters

---

## Key Metrics to Track

Before implementing paid plans, track:

1. **Active loans per user** - Validate tier thresholds
2. **Agent usage** - How many lenders use agents?
3. **Feature usage** - What features drive value?
4. **Retention** - Are users coming back?
5. **Loan volume** - Total ₱ managed through platform

---

## Competitive Positioning

**Value Proposition:**
> "₱499/mo to never lose track of who owes you money"

**Risk framing:**
- One missed ₱5,000 payment = 10 months of Pro subscription
- Peace of mind and organization
- Professional image with borrowers

---

## Alternative Models Considered

### Per-Loan Pricing
| Active Loans | Price |
|--------------|-------|
| 1-10 | Free |
| 11-50 | ₱299/mo |
| 51-100 | ₱599/mo |
| 100+ | ₱999/mo |

*Pros:* Scales naturally with business
*Cons:* More complex, users might game it

### Transaction Fee (0.5-1%)
*Not viable* - Payments are recorded externally, not processed through Loona.

### Per-Agent Seat Pricing
*Considered* - Could work as add-on but most solo lenders have 0-3 agents.

---

## Notes

- Start with generous free tier to build user base
- Gather data before finalizing pricing
- Consider annual discount (2 months free)
- Grandfather early beta users
