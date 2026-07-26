# Module 8 — 📣 Marketing · Planning

**Branch:** `cursor/operate-marketing-2662`  
**Architecture (required first):** [MARKETING_ARCHITECTURE.md](./MARKETING_ARCHITECTURE.md)  
**Stage:** 1 — Operating System  
**Rules:** #14 HublyDS · #15 ownership · #16 E2E journey  
**Locked modules (do not modify):** Home · Inbox · Jobs · Leads · Customers · Pipeline · Storefront OS

## Implementation plan

1. Lock Storefront OS after #250.  
2. Ship MARKETING_ARCHITECTURE.md + Rules #15/#16 updates.  
3. Replace thin `renderMarketing` with full OS using HublyDS + `S.marketingOs` ownership.  
4. Tabs per architecture; audiences reference Customers/Leads only.  
5. Service CTAs reference Storefront catalog ids.  
6. Stage 2 placeholders for Meta/Twilio/Resend.  
7. Validator + MAT (+ E2E journey check) + CMV (+ Storefront).  
8. PR → approval → merge → 🔒 OS.
