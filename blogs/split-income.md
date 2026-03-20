# See the Full Picture: Basic Pay + Other Income

**Category:** Product Updates

---

A borrower earns a steady salary — but they also collect rent from a small apartment. Another does freelance work on the side. Until now, you had one income field to capture all of that, which meant either lumping everything together or leaving money on the table when assessing affordability.

That single number hid the reality of how your borrowers actually earn.

## What's new

Income is now split into two fields:

- **Basic Pay** — the borrower's primary monthly salary or wage
- **Other Income** — freelance work, rental income, remittances, side business, or any supplementary earnings

Loona automatically adds them together wherever a total is needed — you never have to do the math yourself. Both fields are optional, so you can fill in just one or both depending on what information you have.

## Where it shows up

### Contact profile

The income section on each contact's profile now shows both components. When both are present, you'll see the breakdown formatted as **₱X + ₱Y = ₱Total/mo**. Click on either value to edit it inline — no need to open a separate dialog.

<!-- screenshot: Contact profile showing split income display (e.g. ₱15,000 + ₱5,000 = ₱20,000/mo) with inline edit capability -->

### Edit Contact dialog

The full Edit Contact dialog now has a two-column layout for Basic Pay and Other Income, with a computed Total displayed below when either value is present.

<!-- screenshot: Edit Contact dialog showing Basic Pay and Other Income fields side by side with the Total row below -->

### New Loan Wizard

When you create a new borrower during the loan wizard, you'll see separate Basic Pay and Other Income inputs in a two-column grid. A total appears below as soon as you enter a value.

For existing borrowers, the wizard now calculates a **DTI (Debt-to-Income) hint** using the combined income. If the ratio exceeds 30%, a color-coded warning appears:

- **Green (≤ 30%)** — Comfortable. No warning shown.
- **Amber (30–50%)** — Stretched. A gentle heads-up.
- **Red (> 50%)** — Heavy. Signals the borrower may be overleveraged.

The tooltip breaks down existing loan obligations, the proposed loan payment, and total monthly debt so you can see exactly how the number was calculated.

<!-- screenshot: New Loan Wizard — new borrower form with Basic Pay and Other Income fields, plus the Total row -->

<!-- screenshot: New Loan Wizard — DTI hint warning for an existing borrower showing the amber or red threshold -->

### Loan Estimator

The Affordability section now has separate inputs for Basic Pay and Other Income, with a read-only **Total Gross** field that updates in real time. When you pick a borrower from the contact picker, both fields auto-populate from their profile.

The DTI card shows a visual progress bar with three zones (Comfortable, Stretched, Heavy) and a full breakdown:

- **Existing obligations** — sum of all active loan payments, converted to a monthly equivalent
- **This loan** — the proposed loan's payment as a monthly equivalent
- **Total debt** — combined obligations
- **Remaining income** — gross income minus total debt (what's left for living expenses)

Each row has a tooltip explaining how the value is calculated.

<!-- screenshot: Loan Estimator — Affordability section with Basic Pay, Other Income, and Total Gross fields -->

<!-- screenshot: Loan Estimator — DTI card showing the progress bar, rating pill, and breakdown rows with tooltips -->

## How DTI uses the total

Everywhere Loona calculates a Debt-to-Income ratio, it uses the **combined gross income** (Basic Pay + Other Income). This means a borrower with ₱15,000 basic pay and ₱5,000 other income is evaluated against ₱20,000 — not just their salary.

The formula is straightforward:

> **DTI = Total Monthly Debt / Gross Monthly Income × 100**

This gives you a more accurate picture of a borrower's capacity, especially for those with multiple income streams.

## Existing contacts are unaffected

All your current contacts keep working exactly as before. Their existing income value is preserved as Basic Pay, and Other Income starts empty. There's nothing to migrate or fix — everything is backward compatible.

---

*Split income is available now for all lenders. If you have questions or feedback, reach out anytime.*
