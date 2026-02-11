# Cash Position & Financial Tracking

## Overview

Cash Position tracks how much money you have **available to lend**. It answers one question: _"How much can I still disburse?"_

---

## The Formula

```
Cash Available = Starting Capital - Total Disbursed + Total Collected
```

| Term | What it means |
|---|---|
| **Starting Capital** | The total amount of money you've put into your lending business |
| **Total Disbursed** | Sum of all loan principals you've released to borrowers |
| **Total Collected** | Sum of all payments received (principal + interest + penalties) |
| **Cash Available** | What's left in your fund to lend out |

### Example

You start with **₱500,000**. You lend out ₱200,000 across 4 loans. Borrowers have paid back ₱80,000 so far.

```
₱500,000 - ₱200,000 + ₱80,000 = ₱380,000 available
```

---

## Where it appears in Loona

| Location | What's shown |
|---|---|
| **Nav wallet (pill)** | Cash Available as a quick-glance number |
| **Wallet dropdown** | Full breakdown with expandable formula |
| **Settings > Financial** | Edit starting capital |
| **Onboarding wizard** | Set starting capital during setup |
| **Loan creation (review step)** | Warning if disbursement exceeds available cash |

---

## Key Concepts

### Starting Capital is manual

Loona doesn't know your bank balance. Starting Capital is what **you** tell it. It represents the total money you've committed to your lending fund — whether it came from savings, a business loan, or selling assets.

If you inject more money later (e.g., add ₱100K from savings), you should **update your Starting Capital** in Settings or the wallet dropdown.

### Collections recycle automatically

When borrowers pay you back, that money flows back into your available cash. You don't need to do anything — the formula handles it. A ₱50K collection immediately increases your Cash Available by ₱50K.

### Cash Available can go negative

If you disburse more than your tracked capital, your Cash Available goes negative. This means you've lent out money that isn't accounted for in the system. Loona will warn you during loan creation if this would happen, but it won't block you.

A negative balance usually means:
- You added personal funds but didn't update Starting Capital
- You're overleveraged

### Interest is profit, not new capital

When a borrower pays ₱10,000 on a loan:
- Some of that is **principal repayment** (your money coming back)
- Some is **interest earned** (your profit)

Both increase Cash Available because both represent money you now have. The distinction matters for profit tracking (Net Profit, Interest Earned cards) but not for cash position.

---

## Related Dashboard Metrics

| Metric | Formula | What it tells you |
|---|---|---|
| **Interest Earned** | `amountPaid * (totalToRepay - principal) / totalToRepay` per loan | How much profit your loans have generated |
| **Net Profit** | `Interest Earned + Penalty Income - Paid Commissions` | Your actual take-home earnings |
| **Net Collected** | `Total Collected + Penalty Income - Paid Commissions` | Total money received minus agent costs |
| **Cash Available** | `Starting Capital - Total Disbursed + Total Collected` | What you can still lend out |

---

## FAQ

**Q: Should Starting Capital include money I've already lent out?**
Yes. It's the total amount you've put into the business, not just what's sitting idle. If you started with ₱500K and already lent out ₱200K, your Starting Capital is still ₱500K.

**Q: What if I withdraw money from my lending fund for personal use?**
Reduce your Starting Capital by that amount. Loona doesn't track withdrawals automatically.

**Q: What if I have multiple sources of funding?**
Starting Capital is a single number — the total across all sources. Loona doesn't track individual funding sources.

**Q: Why is my Cash Available higher than my Starting Capital?**
Because your collections have exceeded your disbursements. You've earned profit and your fund has grown.

**Q: A borrower paid early / paid in full. Does that affect Cash Available?**
Yes. Any payment immediately increases Cash Available.
