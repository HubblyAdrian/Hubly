# Payment proof business (P0 #2)

**Rule:** Never run payment proof on pay-later businesses.

## Candidate inventory (production, 2026-07-22)

| Business | Slug | payment_setting | Stripe Connect charges_enabled |
|---|---|---|---|
| Aquaspeed | aquaspeed | **later** | **NO** — disqualified |
| Devdetailing661 | devdetailing661 | **deposit** | **NO** — Connect incomplete |
| Others | * | later | NO |

### Evidence

- Supabase `businesses.payment_setting`: only `devdetailing661` = `deposit`
- Supabase `stripe_connect_accounts` (anon): `[]`
- Stripe MCP `GetAccounts` on Hubly `acct_1TubAAEEmwNmC4XD`: **empty list**
- Stripe PaymentIntents / Charges: **empty**

## Selected business for payment proof

**NONE — BLOCKED**

There is **no** production business with:

1. Stripe Connect complete  
2. `charges_enabled = true`  
3. Card payments enabled (deposit/full)

## Required before payment proof

1. Owner completes Stripe Connect for **Devdetailing661** (preferred — already `deposit`) **or** another business switched to deposit/full.  
2. Verify `stripe_connect_accounts.charges_enabled = true` and Stripe Dashboard connected account.  
3. Document here:

| Field | Value |
|---|---|
| Business name | |
| Business id | |
| Slug | |
| payment_setting | deposit / full |
| Stripe Connect account id | |
| charges_enabled | true |
| Operator | |
| Date (UTC) | |

4. Only then run A–D in `PRODUCTION_PAYMENT_PROOF.md`.
