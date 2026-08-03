# Hubly Capability Knowledge Base

**Status:** Knowledge document. No code changed, no new features, no backend logic duplicated. This is the audit result — what Hubly Conversation should *know* before recommending anything, not a change to what it can *do*.

**Scope discipline, matching the honesty rule already locked for Hubly Conversation and the Capability Registry:** only capabilities verified as real — Production Ready, or Partial with a real, usable core — get a full entry here. Everything Missing or Stub-only-fake is listed explicitly in Part 3, not omitted, so nothing gets silently forgotten and nothing gets silently assumed real. Every entry below was verified directly against the current codebase (Edge Functions, `_shared/` modules, `supabase/migrations/`), not against memory or prior summaries.

**What this document is not:** it is not a Capability Registry entry, and it does not make anything invokable. Today the Registry (`_shared/hubly_capability_registry.ts`) has exactly two real actions (`website.analyze`, and the honest `online_presence.analyze_*` stopgaps). Everything else described below — Studio, Marketplace, Payments, Commerce, Booking — is real, live, production backend, but **none of it is wired into the Registry yet**. This document expands what Hubly Conversation can *talk about accurately*. It does not expand what it can *invoke*. Wiring any of this into the Registry (so the engine can actually dispatch to it) is separate, future, Rule-6-gated work — not something this document authorizes.

---

## Part 1 — How to read an entry

Each capability lists: what it does, the customer problem it solves, when the AI should bring it up, the real backend powering it, what information it needs to work, which industries lean on it most, and any hard dependency on another capability. A **Status** line closes each entry — `Production Ready` means recommend it plainly; `Partial` means recommend it with the stated caveat, never past it.

Organized under the 12 groups already frozen in `hubly_core_definition.ts` — this document is the detailed backing for that file's terse `purpose`/`customerValue` fields, not a replacement for it.

---

## Part 2 — Capabilities (verified real)

### Website

**Website Generation & Publishing**
- Does: Generates a full business website (hero headline, about, FAQ, SEO title/description, "why choose us") from real business facts, and publishes it live at a Hubly subdomain, rendered through a real layout/theme system.
- Solves: A business with no web presence, or an outdated one, gets a real live site without hiring anyone.
- Recommend when: The business has no website, or an existing one is thin/outdated, and they haven't said they're happy with what they have.
- Powered by: `generate-site` Edge Function, rendered via `public/hubly.html` + `public/layouts/*.js` + `public/themes/*.js`, data on `businesses` (`gen_hero_headline`, `gen_about`, `gen_faq`, `gen_seo_*`, etc.).
- Requires: Basic business facts (name, industry, services) — the more that's known, the better the generated copy.
- Industries: All — this is Core, not industry-specific.
- Depends on: Nothing hard. Storefront and Booking are much stronger once this exists.
- **Status: Production Ready** (subdomain publishing only — see Custom Domains below for the caveat).

**Custom Domain Registration**
- Does: Checks availability and purchases a real domain, sets up DNS and SSL, against live Cloudflare/Porkbun APIs.
- Solves: A business that wants `theirname.com` instead of a Hubly subdomain.
- Recommend when: The business explicitly asks about their own domain — don't volunteer this one; it's real but not a mainstream first-conversation item.
- Powered by: `_shared/hubly_provider_cloudflare.ts`, `_shared/hubly_provider_porkbun.ts`, behind `_shared/hubly_provider_domain.ts`.
- Requires: A domain name to check, and provider API keys configured server-side.
- Industries: All.
- Depends on: Website Generation (a domain needs something to point at).
- **Status: Partial** — the backend is real and never fakes availability/success, but it's only reachable through the AI "Brain" conversational pipeline today, not a direct API. Say this is possible; don't imply it's a simple self-serve toggle.

---

### Online Presence

**Review Collection & Curation**
- Does: Sends a real review-request link tied to a specific completed job; a customer can only submit a review if that job genuinely had a request sent (enforced at the database level, not just the UI); the owner approves/rejects before anything shows publicly.
- Solves: Builds real, trustworthy social proof without the business chasing reviews manually.
- Recommend when: The business has completed jobs but few or no reviews showing on their storefront.
- Powered by: `review_submissions` table + `get_review_request_context()` RPC (security-definer, PII-safe).
- Requires: A completed job to request a review against.
- Industries: All, especially trust-sensitive ones (home services, personal care, photography).
- Depends on: Jobs (CRM) must exist and be marked complete.
- **Status: Production Ready.**

**Website Analysis**
- Does: Reads a real, existing website — title, description, headings, service-like content, contact details, dominant brand colors.
- Solves: Lets Hubly Conversation ground its advice in what a business's current site actually says, instead of guessing.
- Recommend when: A business pastes or mentions an existing website.
- Powered by: `_shared/hubly_capability_registry.ts` (`website.analyze`) → `/api/import-analyze`. **This is the one capability already wired into the Registry today.**
- Requires: A live URL.
- Industries: All.
- Depends on: Nothing.
- **Status: Production Ready.**

**Social/Listing Link Recognition**
- Does: Recognizes a Facebook, Instagram, or Google Business Profile link and extracts the handle — but cannot read the page's actual content (no live integration exists for any of the three).
- Solves: Lets the AI acknowledge a business's social presence honestly, without pretending to have analyzed it.
- Recommend when: A business shares one of these links — surface it as a link-recognition, not an analysis.
- Powered by: `_shared/hubly_capability_registry.ts` (`online_presence.analyze_facebook/instagram/google_business`) — deliberate honest stopgaps.
- Requires: A profile URL.
- Industries: All.
- Depends on: Nothing.
- **Status: Production Ready** — as a limited, honest capability. Never let this be described as reading the actual page content.

---

### Storefront

**Service Catalog (Services, Packages, Add-ons, Pricing)**
- Does: One canonical, AI-ready catalog per business — services, packages, add-ons, and pricing, all in one place.
- Solves: Gives a business a real, structured price list customers (and the AI) can act on, instead of scattered notes.
- Recommend when: A business doesn't have services/pricing set up yet, or wants to reorganize/expand their offer.
- Powered by: `_shared/service_engine.ts` (`getCatalog`, `listServices`, `toAiSummary`) → `businesses.meta.service_catalog`.
- Requires: Service names, pricing (or "quote required"), optional add-ons/packages.
- Industries: All — this is the foundation every other storefront/booking capability reads from.
- Depends on: Nothing hard.
- **Status: Production Ready.**

**Storefront Page & Booking CTA**
- Does: A real, live, customer-facing page presenting the service catalog with a working "book now" call to action.
- Solves: Turns a visitor into a booked (or paying) customer without a phone call.
- Recommend when: The business has services configured but no clear way for customers to act on them.
- Powered by: `public/hubly.html` (`#p-storefront`, `renderWebsite()`), reading the live Service Catalog.
- Requires: Service Catalog to exist.
- Industries: All.
- Depends on: Service Catalog.
- **Status: Production Ready.**

**Booking Checkout & Deposits**
- Does: A real Stripe Checkout session for a booking deposit or full payment, using Stripe Connect so the money goes to the business, not Hubly.
- Solves: Lets a business collect payment (or a deposit) at the moment of booking, reducing no-shows.
- Recommend when: A business books appointments and doesn't currently collect anything upfront.
- Powered by: `create-booking-checkout` Edge Function.
- Requires: A completed Stripe Connect onboarding (see Payments).
- Industries: Especially services with no-show risk — home services, personal care, photography.
- Depends on: Stripe Connect Onboarding, Booking.
- **Status: Production Ready** — hard-blocked (honestly, not faked) until Stripe Connect is done.

**Product Store / Commerce**
- Does: A full, separate physical-product storefront — products, variants, collections, bundles, carts, discounts, gift cards, real inventory tracking — with real Stripe checkout.
- Solves: A business that sells physical goods (not just services) gets a real e-commerce storefront.
- Recommend when: A business mentions selling physical products, merchandise, or retail items alongside services.
- Powered by: `commerce-api`, `commerce-merchandising`, `create-store-checkout` Edge Functions.
- Requires: Products with pricing; Stripe Connect for checkout.
- Industries: Retail-adjacent service businesses (photography prints, detailing products, spa retail).
- Depends on: Stripe Connect Onboarding for checkout to actually complete.
- **Status: Production Ready.**

---

### Booking

**Availability Engine**
- Does: Computes real bookable time by combining a business's own scheduled jobs, their connected Google Calendar, and their stated business hours.
- Solves: Prevents double-booking and shows customers genuinely open times, not guesses.
- Recommend when: A business is manually tracking their schedule (texts, a paper calendar, memory).
- Powered by: `_shared/marketplace_availability.ts` (`getAvailability`, `listAppointmentSlots`).
- Requires: Business hours set, and ideally a connected Google Calendar.
- Industries: All appointment-based businesses.
- Depends on: Business hours must be set for best results; Google Calendar Sync makes it materially better.
- **Status: Production Ready** for Hubly jobs + Google Calendar. Outlook is a declared source type with no real implementation — never claim Outlook support.

**Google Calendar Sync**
- Does: Full two-way sync — OAuth connect, real-time webhook push updates, and a cron job that renews watches and catches anything a webhook missed.
- Solves: A business's existing Google Calendar stays the single source of truth; nothing gets double-booked across systems.
- Recommend when: A business already lives in Google Calendar and doesn't want to switch tools.
- Powered by: `google-calendar-sync`, `google-calendar-push-job`, `google-calendar-webhook`, `google-calendar-maintain`, `google-calendar-oauth-start/callback`, `google-calendar-connection`.
- Requires: The business connects their Google account (real OAuth).
- Industries: All.
- Depends on: Nothing hard — this is what Availability depends on, not the reverse.
- **Status: Production Ready** — the most mature area of the entire backend.

**Booking Creation & Confirmation**
- Does: Creates a real booking record, triggers calendar sync, and sends a real confirmation email with a calendar attachment (`.ics`).
- Solves: A customer books, gets a real confirmation, and it's already on the business's calendar — no manual re-entry.
- Recommend when: A business takes bookings by phone/text/DM today.
- Powered by: `marketplace/index.ts` (`booking_create`), `booking-confirmed` Edge Function (Resend).
- Requires: Availability Engine, Service Catalog.
- Industries: All appointment-based businesses.
- Depends on: Availability Engine, Service Catalog.
- **Status: Production Ready.** (Note: customer-initiated reschedule/cancel of an existing booking is *not* real yet — see Part 3.)

---

### CRM

**Customer Records**
- Does: A real, relational customer database — with live updates (Postgres realtime) so the owner's dashboard reflects changes instantly.
- Solves: A business stops losing track of who their customers are and what they've bought.
- Recommend when: A business is tracking customers in a notebook, spreadsheet, or not at all.
- Powered by: `public.customers` table, real-time enabled.
- Requires: Name and at least one contact method per customer.
- Industries: All.
- Depends on: Nothing.
- **Status: Production Ready.**

**Jobs / Work Tracking**
- Does: Tracks a unit of work for a customer — status, schedule, notes — and is the backbone Availability, Calendar Sync, Reviews, and Invoicing all read from.
- Solves: A business has one real record of what work is happening, scheduled, or done.
- Recommend when: Almost always relevant once a business is past pure lead-gen — this is the operational core.
- Powered by: `public.jobs` table, real-time enabled, wired to Google Calendar sync.
- Requires: A customer and a service.
- Industries: All.
- Depends on: Customer Records, Service Catalog.
- **Status: Production Ready.**

**Leads Pipeline**
- Does: A kanban-style pipeline view over jobs that haven't been promoted to a booked/customer state yet.
- Solves: Gives a business a place to see who's interested but not yet booked.
- Recommend when: A business has inbound interest they're not tracking anywhere.
- Powered by: `public/hubly.html` (`renderLeadsBoard`, `promoteJobLeadToCustomer`), computed over the real `jobs` table.
- Requires: Nothing beyond Jobs existing.
- Industries: All, especially longer-sales-cycle businesses (home renovation, events).
- Depends on: Jobs / Work Tracking.
- **Status: Partial** — real underlying data, but no first-class "lead" record of its own; it's a filtered view, not a separate queryable entity. Fine to recommend, don't describe it as a dedicated leads database.

**Invoices**
- Does: For most businesses, an invoice persists as a specially-tagged job row (real, but not a proper invoicing schema — no line items, no invoice numbering). Photography businesses get a genuinely dedicated, well-modeled invoice table.
- Solves: Lets a business bill a customer and track whether they've paid.
- Recommend when: A business is invoicing manually or off-platform.
- Powered by: `public/hubly.html` (`createInvoice()`) for general businesses; `public.photography_project_invoices` for Photography.
- Requires: A job to invoice against.
- Industries: All (limited); Photography specifically (full-featured).
- Depends on: Jobs / Work Tracking.
- **Status: Partial** — real and functional for general businesses, but describe it plainly (bill tracking on a job), not as a formal invoicing system, outside Photography.

---

### Marketing

**Studio Campaign Engine**
- Does: AI selects a proven playbook for the business's industry and goal, then generates a full structured campaign plan — objective, channels, messaging, offer, timing.
- Solves: A business gets a real, tailored marketing plan instead of generic advice.
- Recommend when: A business says they want more customers, more bookings, or mentions an upcoming slow season/event.
- Powered by: `studio-api` (`campaign/*` routes), `_shared/hubly_campaign_engine.ts`.
- Requires: Industry and a stated goal (more bookings, more leads, seasonal push, etc.).
- Industries: All — playbooks are industry-aware.
- Depends on: Nothing hard; stronger with Business Understanding already established.
- **Status: Production Ready** as a planning/creative-package generator. It does not send or execute a campaign on its own — see Studio Email Publish for the one channel that does.

**Owner-Approved Customer Email**
- Does: Sends a real one-off email to a customer (review requests, win-back, reschedule notices) via a real email provider, always after the owner approves the content — an AI-drafting tool exists separately and never sends on its own.
- Solves: A business can reach out to customers without writing every email from scratch.
- Recommend when: A business wants to follow up with past customers, or has a specific message to send.
- Powered by: `send-customer-email` (send), `draft-customer-message` (AI draft, never sends).
- Requires: A customer with an email on file, and owner approval before sending.
- Industries: All.
- Depends on: Customer Records.
- **Status: Production Ready.**

**Studio Email Publish**
- Does: Publishes a Studio-created campaign or design via email.
- Solves: Turns a designed campaign into something that actually reaches customers' inboxes.
- Recommend when: A business has a Studio campaign ready to send.
- Powered by: `_shared/hubly_studio_publisher.ts` (`EmailStudioPublisher`).
- Requires: A recipient email and a Studio project.
- Industries: All.
- Depends on: Studio Campaign Engine.
- **Status: Production Ready** for email. Never imply Facebook, Instagram, Google Business, LinkedIn, or SMS publishing — none of those are real (Part 3).

---

### Payments

**Stripe Connect Onboarding**
- Does: Creates a real Stripe Express account for the business and walks them through a real, Stripe-hosted onboarding flow.
- Solves: Lets a business accept payments directly, with money going to their own account, not routed through Hubly manually.
- Recommend when: A business wants to collect deposits, payments, or sell products, and hasn't connected Stripe yet.
- Powered by: `stripe-connect-onboard`, `_shared/stripe.ts`.
- Requires: Basic business info Stripe needs for identity verification.
- Industries: All.
- Depends on: Nothing.
- **Status: Production Ready.** This is the hard dependency almost every payment-related capability above sits behind.

**Payment Status & Payouts**
- Does: Shows whether Stripe Connect is fully set up, and links straight into the business's real Stripe Express dashboard for payout details.
- Solves: A business can check their payment setup and see their money without leaving Hubly for the status check, or needing Hubly to maintain a separate ledger.
- Recommend when: A business asks "where's my money" or "am I set up to get paid."
- Powered by: `stripe-connect-connection`.
- Requires: Stripe Connect Onboarding completed.
- Industries: All.
- Depends on: Stripe Connect Onboarding.
- **Status: Production Ready** — by design, this is a thin passthrough to Stripe's own dashboard, not a separate Hubly ledger. Describe it that way, not as a proprietary payouts system.

---

### Marketplace

**AI Matching ("Find a Pro")**
- Does: A conversational AI understands what a consumer needs (service, timing, location, preferences) and returns a small, ranked set of real matched providers with plain-language reasons why each was suggested.
- Solves: A consumer describes a problem in their own words and gets matched to the right business, instead of searching a directory.
- Recommend when: Talking with a consumer (not a business owner) who needs to find a provider.
- Powered by: `_shared/marketplace_intake.ts` (understanding the need), `_shared/marketplace_match.ts` (ranking), `hubly-find-pro`.
- Requires: A description of the job/need from the consumer; a city helps.
- Industries: All marketplace-participating industries.
- Depends on: Marketplace Provider Profile & Score.
- **Status: Production Ready.** Note: there is no separate browsable/searchable provider directory — this AI-conversation path is the actual consumer product surface, not a fallback.

**Marketplace Provider Profile & Score**
- Does: Assembles a public-safe profile for a provider (services, photos, reviews, service area) and computes a real weighted quality score (profile completeness, photos, reviews, calendar connection, verification, completed bookings, cancellation rate).
- Solves: Gives consumers a trustworthy signal for choosing between providers, and gives a provider a concrete list of what to improve.
- Recommend when: A provider wants to know how to rank better in matching, or a consumer needs to compare providers.
- Powered by: `_shared/marketplace_provider.ts`, `_shared/marketplace_score.ts`.
- Requires: A marketplace provider profile to exist.
- Industries: All marketplace-participating industries.
- Depends on: Service Catalog, Reviews.
- **Status: Production Ready** — one caveat: the response-time factor of the score is never actually computed from real data yet (it falls back to a neutral default), so don't claim response time is being actively measured.

**AI Provider Document**
- Does: Produces one canonical, versioned, machine-readable summary of a provider — including hard rules like "never invent a service" — that any AI agent (including Hubly Conversation) can trust as ground truth.
- Solves: Keeps AI-generated claims about a provider accurate and consistent across every surface that talks about them.
- Recommend when: Not a customer-facing recommendation — this is infrastructure other AI-facing capabilities read from.
- Powered by: `_shared/marketplace_document.ts`.
- Requires: A marketplace provider profile.
- Industries: All.
- Depends on: Marketplace Provider Profile & Score, Service Catalog.
- **Status: Production Ready.**

---

### Studio

**Media Library**
- Does: Real storage for a business's logos, uploads, and job photos used across Studio.
- Solves: One real place for a business's visual assets instead of scattered files.
- Recommend when: A business wants to build a campaign or update their site and needs assets organized.
- Powered by: `studio-api` (`assets` resource) → `studio_assets` table.
- Requires: Files to upload.
- Industries: All, especially visual ones (photography, detailing, landscaping).
- Depends on: Nothing.
- **Status: Production Ready.**

**AI Photo Analysis**
- Does: Reviews uploaded photos, recommends a hero image, detects before/after pairs, and infers quality/audience signals — works even before a full account exists.
- Solves: A business doesn't have to guess which photo makes the best first impression.
- Recommend when: A business uploads photos, especially during onboarding or a site refresh.
- Powered by: `analyze-photos` Edge Function.
- Requires: At least one photo.
- Industries: Especially visual/before-after businesses (detailing, photography, landscaping, cleaning).
- Depends on: Nothing.
- **Status: Production Ready.**

**Creative Director**
- Does: A conversational, "talk-first" assistant that helps shape a business's brand/creative direction, including reacting to an inspiration screenshot.
- Solves: A business without design instincts gets real creative guidance in plain conversation.
- Recommend when: A business is unsure of their visual direction/branding.
- Powered by: `creative-director` Edge Function.
- Requires: A conversation; optionally an inspiration image.
- Industries: All, especially brand-sensitive ones.
- Depends on: Nothing.
- **Status: Production Ready.**

---

### Analytics

**AI Daily Briefing**
- Does: Takes a business's already-computed stats and writes a real AI-generated narrative summary of how the business is doing.
- Solves: An owner gets a plain-language read on their numbers instead of a spreadsheet.
- Recommend when: A business wants a quick read on how things are going, not raw numbers.
- Powered by: `hubly-daily` Edge Function.
- Requires: Stats supplied by the caller (this function doesn't compute analytics itself — see caveat below).
- Industries: All.
- Depends on: Dashboard/Reports (as the source of the stats it narrates).
- **Status: Production Ready** as a narrative layer — it narrates, it doesn't calculate.

**Dashboard / Reports**
- Does: Revenue, jobs, pipeline, customer, marketing, and review metrics, computed from real data (jobs, customers, etc.).
- Solves: Gives an owner visibility into how their business is performing.
- Recommend when: A business asks how they're doing, or hasn't looked at their numbers recently.
- Powered by: Computed client-side in `public/journey-os/journey.js`, over real source tables.
- Requires: Jobs and customers to already exist.
- Industries: All.
- Depends on: Jobs / Work Tracking, Customer Records.
- **Status: Partial** — the numbers are real, but there's no backend reporting engine behind them; it's calculated in the browser each time, not a queryable analytics service. Fine to recommend using it; don't describe it as a backend analytics platform.

---

### Integrations

**Google Calendar** — see Booking, above. **Status: Production Ready.**

**Stripe** — see Payments, above. **Status: Production Ready.**

**Adobe Lightroom**
- Does: A real, working OAuth-based integration (client → provider) for syncing with a business's Adobe Lightroom account.
- Solves: Photography businesses keep their existing editing workflow connected to Hubly.
- Recommend when: A photography business mentions using Lightroom.
- Powered by: `_shared/hubly_provider_lightroom.ts`.
- Requires: The business connects their Adobe account (real OAuth).
- Industries: Photography, specifically.
- Depends on: Nothing.
- **Status: Production Ready.**

---

## Part 3 — Not yet recommendable (verified Missing or Stub-only)

The AI should never suggest these as if they work. Listed with the real reason, not omitted, so nothing here gets rediscovered by accident later.

| Capability | Why it's not recommendable |
|---|---|
| Automations (execution) | Planning/simulation is real (via Hubly Brain); nothing ever actually executes a workflow — no execution engine exists. |
| Referrals | No referral tracking, codes, or reward ledger exist anywhere — only a lead-source label. |
| Social auto-publishing (Facebook, Instagram, Google Business, LinkedIn, SMS) | Zero real integration for any of these — only Email publishing is real. |
| Quotes | No table, no persistence, explicitly marked non-executable in the AI skill registry. |
| Team Members / Roles / Permissions | Real database tables exist but have zero readers or writers anywhere — pure dead schema. Actual "team" UI is client-memory-only, lost on reload. |
| Staff Scheduling | A config flag in onboarding data that nothing ever reads. |
| Multiple Locations | Does not exist in any form. |
| SMS / Twilio messaging | Listed in the integrations catalog but no API client, OAuth flow, or send capability exists anywhere. |
| Canva integration | Scaffolded (correctly refuses to fake success) but every single method is unimplemented — despite being listed as "installable" in the integrations catalog. |
| Most integrations catalog entries (Frame.io, Dropbox, Google Drive, Meta, Google Business Profile connect, Capture One, TikTok, Pinterest, QuickBooks, Zoom) | Catalog-listed only — no backend code exists for any of them. |
| In-app / push / SMS notifications | A preferences table exists (toggles only); nothing delivers on push or SMS. Email notifications and dashboard realtime are the only real delivery paths. |
| Public third-party API | No API keys, developer portal, or external OAuth surface exists — internal APIs (`studio-api`, `commerce-api`) are owner-authenticated only. |
| Customer-initiated booking modification (reschedule/cancel) | Only owner/job-status-side booking mutations exist; a customer cannot change their own booking through any real path today. |
| Consumer-facing browse/search marketplace directory | Deliberate design choice, not a gap — the AI-matching conversation (Part 2) is the actual consumer product surface. Worth knowing so it isn't described as missing when a business asks about it. |

---

## Part 4 — How this connects to what Hubly Conversation already does

Today, `hubly-conversation/index.ts`'s system prompt includes a "WHAT HUBLY IS BUILT AROUND" block generated from `HUBLY_CORE_DEFINITION` — 12 entries, each just a name/purpose/customer-value sentence, with no knowledge of production-readiness, required inputs, or industry fit. This document is the detailed, evidence-based backing that terse list never had. Whether and how to feed this richer knowledge into that prompt (or into a future Context Loader's Ground Truth, per `docs/HUBLY_CONVERSATION_CONTEXT_MODEL.md`) is a real next step — but it's a code change to the engine's prompt construction, which this task didn't ask for. Per the standing rule, that's a decision to bring back for approval, not something this document does on its own.
