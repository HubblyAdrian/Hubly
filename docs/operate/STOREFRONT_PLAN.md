# Module 7 — 🌐 Storefront · Planning

**Branch:** `cursor/operate-storefront-2662`  
**Stage:** 1 — Operating System  
**Design System:** HublyDS v1 (Rule #14)  
**Data ownership:** Service Catalog + website presentation (Rule #15)  
**Locked modules (do not modify):** Home · Inbox · Jobs · Leads · Customers · Pipeline OS

## Purpose

Storefront is the public face of the business and the acquisition surface:

Website · Booking · Service Catalog · Pricing · Gallery · Reviews (read) · SEO · Domain · Analytics (OS/demo)

## Implementation plan

1. Lock Pipeline OS docs after #249 merge.  
2. Add Rule #15 / DATA_OWNERSHIP.md.  
3. Mount `#jos-storefront-root` under `#v-editor`; `ownPixelView` + gate legacy editor init when pixel-owned.  
4. `renderStorefront` / `handleStorefrontAct` (`sf-*`) using HublyDS.  
5. Own Service Catalog in `S.editorSvcs` / `S.services` (OS seed); sync mirrors for booking preview.  
6. Tabs: Website, Booking, Services, Pricing, Gallery, Reviews (read), SEO, Domain, Analytics.  
7. Preview via existing `previewProfile` / booking preview when available.  
8. Validator + MAT + CMV (+ Pipeline).  
9. PR → approval → merge → 🔒 OS.
