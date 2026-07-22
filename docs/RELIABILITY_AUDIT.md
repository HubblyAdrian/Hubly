# Reliability audit (V1)

Run before closed beta. Goal: **no silent failures**.

| Area | Status | Notes |
|---|---|---|
| Loading states | ☐ | Storefront, dashboard, Instant Site |
| Empty states | ☐ | Feed, jobs, CRM, HQ waitlist |
| Errors | ☐ | User-visible; never swallow hire/pay failures |
| Retries | ☐ | Calendar pending flush, notify, webhooks |
| Permissions | ☐ | RLS + HQ secret |
| Race conditions | ☐ | Double book, double pay, accept races |
| Webhook idempotency | ☐ | `stripe_webhook_events` |
| Logging | ☐ | Edge + notify |
| Monitoring | ☐ | Hubly HQ System / Release Gate |
| Performance | ☐ | First paint / booking |
| Mobile | ☐ | Book + pay + owner accept |
| Accessibility | ☐ | Critical flows |

Outcome: every failure is visible in Hubly HQ Error Center or Platform Feed.
