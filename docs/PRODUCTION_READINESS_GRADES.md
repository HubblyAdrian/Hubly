# Production readiness grades

Evidence from repository on stack tip lineage (`cursor/final-ai-migration-2662` + RC audit branch). Grades: A–F.

| Category | Grade | Why |
|---|---|---|
| Website Runtime | **B** | `hubly_brain_website.ts` publish + copy from Memory/DNA; Instant Site path in `hubly.html`. Not A: production load/perf audit incomplete. |
| Booking Runtime | **B** | `submitBooking` → `booking_requests` + conflict/`assertSlotOpen` + marketplace engine. Not A: live First Customer E2E unchecked. |
| Payments | **C** | Connect + `create-booking-checkout` + `stripe-webhook` paid/failed/refunded shipped; **live proof empty** (`PRODUCTION_PAYMENT_PROOF.md`). |
| CRM | **B** | Auto upsert on accept (`upsertCustomer`) and paid webhook (`upsertCrmFromBooking`). Not A: no dedicated CRM stress proof. |
| Jobs | **B** | Hire lifecycle migrations + accept creates jobs; reminders/complete/review code present. Not A: production job failure rates unproven. |
| Calendar | **C** | Busy windows SQL + Google push + pending flush exist; **TZ/Google production proof open** (`CALENDAR_TRUST.md`). |
| Notifications | **B** | Owner Feed + realtime booking path; HQ alerts. Not A: push channels beyond Feed/email incomplete. |
| Emails | **C** | `api/notify.js` + hire notify wired; depends on Resend secrets — System Health can go red without them. |
| Hubly HQ | **B** | CEO Daily, Feed, Launch Queue, Funnel, Search/360, Platform/System/AI Health, Revenue, Errors, Adoption, Waitlist, Release Gate, Impersonation, **Admin Audit Log**. Not A: secret bootstrap auth; MRR estimate; migrations must be applied. |
| Publishing | **B** | Slug publish + Runtime `publishBusinessWebsite`; checklist marks dependable. Not A: custom domain connector still contract-level. |
| Connections | **C** | Stripe Connect + Google Calendar connectors exist; domain vendors are contracts not full vendor lock. |
| Business Build | **B** | `hubly-build-business` + HublyAI `buildBusiness` + executors. Not A: Responses transport unbenchmarked live. |
| Hubly Daily | **B** | Deterministic `hubly_brain_daily.ts` + dashboard render from live stats. |
| Business Health | **B** | Deterministic health after hire events (`hubly_brain_health.ts` + client refresh). |
| Owner Feed | **B** | Feed events on hire/payment lifecycle; First Customer framing docs. |
| Creative Director | **B** | HublyAI façade + Memory/DNA; craft checks. Not A: Responses RC pending. |
| Ask AI | **B** | Ops facts context + HublyAI; OpenAI-only production path. |
| Storefront Chat | **B** | Migrated to HublyAI; no direct provider calls outside gateway. |
| Photo Analysis | **B** | HublyAI vision path; Responses vision needs live benchmark. |
| Import Offers | **B** | HublyAI façade present. |
| Marketplace Intake | **C** | Intake/match code exists; marketplace is not the First Customer North Star and remains secondary/frozen for expansion. |

## Summary

No category is **A** (production-proven end-to-end). Core owner Instant Site loop is mostly **B** with **Payments** and **Calendar** at **C** due to missing live proof. Do not invent new systems — close P0 proofs.
