# BLOCKER 3 — Stripe revenue proof attempt

**Date:** 2026-07-22T22:25:00Z  
**Branch:** `cursor/production-proof-mode-2662`  
**Status:** **BLOCKED** — no `charges_enabled` Connect business; checkout business lookup returning 404

## Preconditions (evidence)

| Check | Result | Evidence |
|---|---|---|
| Platform Stripe account | Hubly `acct_1TubAAEEmwNmC4XD` | Stripe MCP `get_stripe_account_info` |
| Connected accounts | **empty** `data: []` | Stripe MCP `GetAccounts` |
| PaymentIntents | **empty** | Stripe MCP `GetPaymentIntents` |
| Charges | **empty** | Stripe MCP `GetCharges` |
| `stripe_connect_accounts` (anon) | `[]` | REST |
| Deposit/full business | Devdetailing661 only | `id=172d4777-…`, `payment_setting=deposit` |
| Aquaspeed | `payment_setting=later` | **disqualified** |
| Storefront Devdetailing661 | **200** | `https://devdetailing661.myhubly.app/` |

## Checkout probe (before Connect)

| Call | HTTP | Body |
|---|---|---|
| `create-booking-checkout` Aquaspeed | **404** | `Business not found` |
| `create-booking-checkout` Devdetailing661 | **404** | `Business not found` |
| Expected if Connect missing | **409** | `not_ready` |

**Note:** Businesses exist via anon REST. Checkout edge returns 404 before Connect check — service-role lookup failure suspected. Diagnostic detail added in `create-booking-checkout` (`business_lookup_failed`).

## What cannot be proven yet

No PaymentIntent / Checkout Session / webhook / refund IDs exist to record.

## Required human ops to unblock

1. Deploy Stripe edges (includes checkout diagnostic):
   ```bash
   export SUPABASE_ACCESS_TOKEN='sbp_…'
   git pull origin cursor/production-proof-mode-2662
   ./scripts/deploy-stripe-proof-edges.sh
   ```
2. Sign into Hubly as **Devdetailing661** owner.  
3. Complete **Stripe Connect** onboarding until Dashboard shows **charges enabled**.  
4. Confirm in app Connections (or tell agent) — then agent continues:
   - customer checkout → pay → webhook → CRM / Health / notify / receipt  
   - refund → webhook → CRM / Health / Feed  
   - capture all Stripe IDs in this evidence file  

## Rule

Do not invent payment success. Do not mark Blocker 3 PASS without PaymentIntent + webhook event IDs.
