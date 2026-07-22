# Production payment proof (First Customer blocker #1)

> Not a test flow. A real end-to-end payment through Hubly Runtime.

Use this checklist once before declaring First Customer complete.
Do not move to Business Running until every box is checked in **live** mode.

## Preconditions

- [ ] Stripe Connect account for a real Hubly business is **charges_enabled** in **live** mode  
- [ ] Edge secrets set: `STRIPE_SECRET_KEY` (live), `STRIPE_WEBHOOK_SECRET` (live endpoint)  
- [ ] Webhook endpoint subscribed to:
  - `account.updated`
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.expired`
  - `checkout.session.async_payment_failed`
  - `charge.refunded`
- [ ] Migration `20260722020000_first_customer_payments.sql` applied  
- [ ] Business website published with deposit or full payment enabled  

## Proof run (one real hire)

### A. Success

1. Customer books a real service and pays deposit or full on Stripe Checkout (live card).  
2. Confirm without Hubly admin / SQL:
   - [ ] `booking_requests.payment_status = paid`  
   - [ ] Customer appears / updates in CRM  
   - [ ] Owner Feed shows “Payment received”  
   - [ ] Business Health payment / revenue moved  
   - [ ] Customer received payment receipt email  
   - [ ] Owner notified (email or Feed)  
3. Owner accepts booking in Hubly:
   - [ ] Job created with Card (Stripe) paid  
   - [ ] Calendar / Google updated (if connected)  
   - [ ] Receipt available in Hubly  

### B. Failure / cancel

1. Start checkout and cancel, or use a declining card path.  
2. Confirm:
   - [ ] `payment_status = failed` (or remains unpaid — never “paid”)  
   - [ ] Owner Feed can show failed/canceled payment  
   - [ ] No CRM fake “paid” enrichment  

### C. Expire

1. Abandon a Checkout Session until Stripe sends `checkout.session.expired`.  
2. Confirm:
   - [ ] Request not marked paid  
   - [ ] `payment_status = failed` after webhook  

### D. Refund

1. Refund the successful live charge in Stripe Dashboard (or API).  
2. Confirm webhook `charge.refunded`:
   - [ ] `payment_status = refunded`  
   - [ ] Linked job no longer treated as paid  
   - [ ] Owner Feed shows refund  

## Pass criteria

All of A–D pass with **zero** manual database edits and **zero** admin rescue.

Record:

| Field | Value |
|---|---|
| Business id / name | |
| Booking request id | |
| Stripe Checkout session | |
| PaymentIntent | |
| Date (UTC) | |
| Operator | |

When this page is fully checked, mark First Customer payment proof done in `LAUNCH_CHECKLIST.md`.
