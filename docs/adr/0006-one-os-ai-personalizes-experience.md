# ADR 0006 — One OS; AI personalizes experience

**Status:** Accepted  
**Date:** 2026-07-25

## Context

Industry-specific products (different CRMs, navs, or “Hubly for X” shells) would fragment the platform and erase the investment in a single operating system.

Competitors ship one generic product and force owners to adapt. Hubly’s advantage is the reverse: same OS, experience reshaped per business.

## Decision

1. The Hubly OS module set is **locked** (Dashboard, Leads, Jobs & Calendar, Customers, Quick Quote, Revenue, Chats, Marketplace, Website, Stripe, Google Calendar, CRM, Payments, Messaging).
2. Engineers must **not** create industry-specific CRMs, software forks, or navigation.
3. AI personalizes **above** the OS (website, theme, booking, packages, brand voice, recommendations, dashboard focus, automations).

## Consequences

- Create mode and Brain generate experience, not alternate products.
- DNA / industry packs customize content and defaults — never replace the chassis.
- Violations are constitution failures (see `docs/HUBLY_OS.md`, Constitution principle 9).
