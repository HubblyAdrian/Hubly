# Hubly Product Inventory

**As of:** 2026-07-25  
**Source of truth:** `main` branch code in this repo (not roadmap docs, not unmerged PR polish).  
**Rule:** Only what a paying customer can use today. Partial means implemented enough to click, with clear limits. Planned work is omitted.

---

## 1. Authentication

**Status:** Partial

**Features:**

| Feature | Status | Notes |
|---------|--------|-------|
| Sign up | Complete (Create-path) | No classic email/password signup form. Account is created via Instant Site / draft account (`create-instant-site-account`, `claim-draft-account`) during Create / Save Business. |
| Login | Complete | `/login` → email + password → Supabase `signInWithPassword` → load business. |
| Forgot password | Complete | Reset email via Supabase `resetPasswordForEmail`; recovery hash → set new password. |
| Social login | Partial | Google/Apple OAuth exists on **delayed account save** during Create. Not the primary login screen. On OAuth failure, UI can continue with a **simulated** local identity. |
| Team members | Not Started | No invites, roles, or multi-seat product. |

**Known limitations:**

- “Remember me” checkbox on login is not wired.
- Draft/owner credentials can be persisted in browser storage for silent re-auth (including password) — security risk.
- Instant Site accounts are auto email-confirmed via service role (no confirmation UX).
- No magic link login.
- No team/org accounts.

---

## 2. AI Create Experience

**Status:** Partial

**Customer flow (entry: `/signup` / Welcome — not `/demo` on `main`):**

| Beat | Status | What exists today |
|------|--------|-------------------|
| Landing | Complete | Platform home + Welcome Experience front door (`/signup`, `/welcome`). |
| AI conversation | Partial | Discovery chat runs. On `main`, turns are processed by **local** `HUBLY_DISCOVERY` (regex / gap tree), not a live OpenAI chat loop. |
| Website generation | Partial | Studio + blueprint/thinking packs write hero, sections, services into real website state; layouts/themes from blueprint system. |
| Booking generation | Partial | Booking chrome / packages / CTA applied into existing Book Now system — not a unique AI-authored booking engine per business. |
| Packages | Partial | Industry packs supply package names; prices/meta filled by heuristics. |
| Branding | Partial | Logo mark (often initials), palette/CTA/hero rewrites from packs + local conversation heuristics. |
| Reveal | Partial | Scripted Thinking + Reveal experience (`HUBLY_THINKING` / reveal orchestration) with industry packs; can open previews and continue into Home. |
| Enter Hubly / Home | Complete (path) | Continues into Operate Home after save/claim (or draft paths). |

**What's actually powered by OpenAI (when `OPENAI_API_KEY` is set on edge)?**

- `hubly-brain` edge function exists; Create **Thinking** best-effort calls `HublyAI.think` (`intent: build_business`) and may enrich the scripted experience if the call returns quickly.
- Other AI surfaces (website editor `creative-director`, `generate-site`, chatbot, drafts, marketplace intake) use OpenAI via shared `HublyAI` — see §14.
- Discovery conversation on `main` is **not** the OpenAI ChatGPT-style loop (local `HUBLY_DISCOVERY`).

**What's still hardcoded?**

- Industry “holy shit” / thinking packs (insights, package lists, aha copy, expert timeline theater).
- Local discovery question/reply tree.
- Assumed business names (`My {industry}`, `{industry} — {city}`).
- Package pricing heuristics.
- Much of Reveal / Thinking stage copy.

**What assumptions does the AI / Create make?**

- Trade from keywords (pressure washing, lawn, fitness, cleaning, photography, etc.); unknown → generic local service.
- Owner-operator / common residential setup is assumed in pack copy.
- Positioning and packages chosen without asking for rates.
- Prefers assume-and-build over long questionnaires (in pack design).

**What isn't finished?**

- Live OpenAI discovery conversation as the default Create chat (on `main`).
- Thinking/Reveal is largely orchestrated theater, not live multi-agent research.
- Voice input on Welcome is “coming soon.”
- No CEO `/demo` route on `main` (exists only on unmerged work — not inventory’d as shipped).
- Brand/logo quality is often initials + assumed name.

---

## 3. Dashboard / Home

**Status:** Partial

**What widgets exist?**

- Greeting + public site URL (copy).
- Website preview card (Open / Share → live storefront preview).
- Ops modules: shortcuts into Booking preview, Website, CRM (and related ops shortcuts depending on state).
- “Recent Work” / activity-style feed (often Create-seeded or local).
- One recommendation + Discover cards (pack/static-driven copy in many Create exits).
- Classic KPI / Hubly Daily / Ask dock **exist in the page** but Operate Home CSS often **hides** them from the first view.
- Focus cards (Stripe / Import / Share) exist; often hidden until relevant.

**What is interactive?**

- Open website, open booking preview, navigate to CRM/customers.
- Copy site link.
- Keep / Undo / Apply on recommendation-style controls (behavior varies; often routes to Ask AI or copy).

**What is placeholder / theatrical?**

- “While you were away” / Recent Work frequently reflects seeded Create activity, not proven overnight AI ops.
- Discover / one-rec cards often use hardcoded industry pack copy.
- Ask Hubly dock depends on `ai-advisor` edge (called from client; **no `ai-advisor` source in this repo’s `supabase/functions/`**).

---

## 4. CRM

**Status:** Partial → strong on basics

**Can customers (owners):**

| Capability | Status |
|------------|--------|
| Add customers | Complete |
| Edit customers | Complete (name, status, type, phone, email, service, notes, vehicle fields, etc.) |
| Notes | Complete |
| Timeline | Partial — jobs history is real; chatbot transcript merge is limited / tiered |
| Photos (per customer) | Not Started |
| Messages (in CRM drawer) | Not Started as CRM chat — outreach drafts live elsewhere |
| AI summaries (per customer) | Not Started |

**Also real:** search/tabs/range KPIs, VIP heuristics, recurring membership tooling, paste-contact import patterns, promote job → customer.

**Missing:**

- Customer photo albums
- In-CRM messaging threads
- AI customer digests
- Full CSV import product (focus label ≠ importer)
- Team-shared CRM permissions

---

## 5. Jobs & Calendar

**Status:** Partial

**Features:**

| Feature | Status |
|---------|--------|
| Jobs | Complete — list, filters, detail, add, amount, address, Maps link |
| Calendar | Complete — month + week views; click slot to add |
| Drag & drop (jobs on calendar) | Not Started — leads board and website section order drag exist; calendar jobs do not |
| Google Calendar sync | Partial — full OAuth/sync edge suite; UI is **early access** gated |
| Statuses | Partial — pending / scheduled / completed / cancelled (and accept flows); not a rich field-ops status model |
| Checklists (on jobs) | Not Started |
| Photos (on jobs) | Not Started |

**Missing:** calendar drag-reschedule; job checklists; job photos; customer self-serve reschedule; open (non-gated) Google Calendar for all users.

---

## 6. Booking

**Status:** Partial (core Book Now works)

**Features:**

| Feature | Status |
|---------|--------|
| Instant booking | Complete — public multi-step Book Now |
| Deposits | Complete — deposit / full / pay later / choice; settings in editor |
| Full payment | Complete — Stripe Checkout path via `create-booking-checkout` (Connect destination) |
| Packages | Complete |
| Add-ons | Complete |
| Confirmation | Partial — UI confirmation + email paths (`booking-confirmed` / notify); reliability depends on Resend/env |
| Reschedule | Partial — **owner** can reschedule jobs; **customer** self-serve reschedule Not Started |
| Cancel | Partial — **owner** cancel; **customer** self-serve cancel Not Started |

**Customer booking page:** Complete as public Book Now on the business site / booking flow (Smart Quote fields when trade requires them).

**Business booking page:** Complete as owner configuration inside Website editor (packages, payment/deposit, branding). Standalone booking-wizard page is retired / leftover.

**Missing:**

- Customer manage-booking portal (cancel/reschedule links)
- Proven live PaymentIntent E2E in production artifacts (wiring exists; ops proof has been weak)
- Twilio booking SMS
- Remainder-after-deposit automation as a finished product loop

---

## 7. Website

**Status:** Partial → usable for subdomain publish

| Capability | Status |
|------------|--------|
| Generated by AI? | Partial — Create + `generate-site` / creative-director / blueprint packs generate and restyle; not a full multi-page CMS generator |
| Manual editor? | Complete — Website editor hub (copy, services, gallery, section order, preview, Save & publish) |
| AI editor? | Complete (env-dependent) — plain-English + screenshot restyle via `creative-director` |
| Pages? | Partial — single long-scroll storefront, not multi-page sites |
| SEO? | Partial — title + meta description on publish; no full SEO suite |
| Publishing? | Complete — Save & publish to Hubly subdomain (`*.myhubly.app`) |
| Custom domain? | Prototype — Cloudflare/Porkbun provider code exists; **no owner connect-domain UI** in app |
| Themes / layouts? | Complete — theme + layout registries |
| Blocks? | Partial — sections/composition, not a freeform block builder |

**Missing:** custom domain UI; multi-page; rich SEO (OG/sitemap/schema); true block marketplace.

---

## 8. Quotes

**Status:** Partial

**Features:**

- Owner **Quick Quote / Smart Quote** UI — Complete as a client-side pricing tool (trade recipes, packages, add-ons, custom fields).
- Email send via `send-customer-email` — Complete when Resend configured.
- SMS send — Not Started (UI: “Twilio coming”; copy/open Messages workaround).
- Persistence — Partial (**localStorage**, not cloud quote records).
- Customer-facing standalone quote link / accept / pay — Not Started as its own product (Book Now reuses SQ math).

**Missing:** server-persisted quotes; Twilio send; shareable quote acceptance; cross-device sync.

---

## 9. Revenue

**Status:** Partial

**Features:**

- Money view: MTD, week bars, invoices unpaid/paid, mark paid, receipts, new invoice — Complete as Hubly job/invoice ledger.
- Reports (revenue/jobs/customers/recurring, by service, period compare) — Complete on Hubly data.
- Invoice “Send” — Partial (opens `sms:` / `mailto:` / share; not Stripe Invoicing).

**Stripe integration:**

- Stripe Connect onboard / connection / disconnect — Complete (code + UI).
- Booking Checkout to connected account — Complete (code); production payment proof has been incomplete in prior RC notes.

**Reports:** Hubly-internal job/invoice reports — Complete. Stripe payout/balance as source of truth — Not Started.

**Missing:** Stripe Invoicing; payout dashboard; closed-loop deposit remainder collection; SaaS subscription billing product (if intended) not inventoried as owner-facing here.

---

## 10. Messaging

**Status:** Partial

| Channel | Status |
|---------|--------|
| SMS | Not Started — consent captured; no Twilio send |
| Email | Complete (env-dependent) — Resend via edge + Vercel notify/support routes |
| Chat | Complete — public storefront chatbot (`chatbot-message`) |
| Inbox | Partial — Chats view lists conversations / leads; not a full two-way omnichannel reply product |

**Missing:** Twilio SMS; automated reminders; full in-app reply across SMS/email; quote SMS auto-send.

---

## 11. Marketplace

**Status:** Partial / live prototype

| Side | Status |
|------|--------|
| Customer side | Partial — `/get-done` AI intake → match → request/book paths |
| Provider side | Partial — `/marketplace/join|login|home` (marketplace-lite) |
| Matching | Partial — AI intake + deterministic ranking (not a liquid marketplace) |
| Payments | Partial — can route into booking checkout / Connect; density and E2E paid proof weak |
| Ops | Partial — `/marketplace-ops` internal control center |

**Missing:** dense provider catalogs, verification maturity, reliable Match→slot→pay at scale, polished two-sided UX.

---

## 12. Integrations

| Integration | Status | Notes |
|-------------|--------|-------|
| Stripe | Partial | Connect + Checkout + webhook code complete; treat live paid E2E as not fully proven |
| Google Calendar | Partial | Full sync suite; **early access** gate for owners |
| Resend | Partial → near ready | Email sending wired; requires env secrets |
| Twilio | Not Started | Explicit “coming” in UI |
| OpenAI | Partial | Used by edge AI when key present; Create discovery on `main` is still local |
| Supabase | Production Ready | Auth, DB, Storage, Realtime, Edge |
| Vercel | Production Ready | Hosting + `/api/*` routes |
| Cloudflare / Porkbun | Prototype | Domain provider helpers; not customer product |
| Weather (Open-Meteo) | Production Ready | `/api/weather` proxy |

---

## 13. Mobile

**Status:** Partial

| Question | Answer |
|----------|--------|
| Responsive? | Yes — extensive CSS breakpoints |
| Mobile optimized? | Partial — booking/site usable; not a dedicated mobile product pass |
| Native app? | No |
| PWA? | No |

**Missing:** native apps; PWA install; systematic mobile QA.

---

## 14. AI

### Production (wired in code; works when secrets/deploy are healthy)

- Website AI editor (`creative-director`)
- Site generation helpers (`generate-site`)
- Photo analysis (`analyze-photos`)
- Customer message drafts (`draft-customer-message`)
- Storefront chatbot (`chatbot-message`)
- Price-list import (`import-offers`)
- Marketplace intake (OpenAI inside `marketplace` function)
- `hubly-build-business`, `hubly-find-pro`, `hubly-daily` edge surfaces
- Hubly Brain think endpoint (`hubly-brain`) — used for enrichment / brain intents when called

### Experimental

- Full Brain pipeline / experts / memory / DNA / brain console (internal inspection)
- Create Thinking “expert theater” with optional brain merge
- Dashboard Ask Hubly → `ai-advisor` (**client calls it; function source not in this repo**)
- Hubly Coach FAB = setup checklist UI, not an LLM coach

### Not working as a finished product (explicitly incomplete)

- Twilio-powered AI outreach send
- Create Discovery as live ChatGPT on `main` (local tree instead)
- Per-customer AI CRM summaries

---

## 15. Production Readiness

| Area | Status |
|------|--------|
| Security | Partial — Supabase auth + RLS on many tables; CORS often open; plaintext creds in browser storage for draft re-auth; early-access gates for GCal |
| Logging | Partial — `console` / edge logs; no central APM |
| Error handling | Partial — user toasts + JSON errors; many swallowed warns |
| Performance | Partial — very large monolithic `hubly.html`; dual old/new surfaces remain |
| Monitoring | Not Started as product practice (no Sentry-class tooling in repo) |
| Accessibility | Partial — spotty `aria`; not systematic |
| Backups | Not in repo (rely on Supabase platform) |
| Rate limiting | Partial — chatbot limits; not platform-wide |
| Environment management | Partial — Vercel + Supabase secrets; anon keys embedded in client |
| Deployment | Partial — Vercel + Supabase Edge; cutover/founder certification historically incomplete |

**Known production blockers:**

1. Paid booking E2E not confidently proven in prior RC validation.
2. Google Calendar not generally available.
3. No SMS.
4. Create conversation quality on `main` is not true OpenAI chat.
5. Marketplace not commercially dense.
6. Auth credential storage practices are not launch-grade.
7. Monolith / dual UI debt.

---

## 16. MVP Readiness

| Question | Answer |
|----------|--------|
| Can someone sign up today? | **Yes** — via Create / draft account paths + login. |
| Can they build a business? | **Mostly yes** — Create builds website, packages, booking config into the workspace. Quality varies; discovery chat on `main` is local, not ChatGPT. |
| Can they publish a website? | **Yes** — to a Hubly subdomain. Custom domain: no owner UI. |
| Can they connect Stripe? | **Yes** — Connect UI + edges (success depends on Stripe account/platform config). |
| Can they connect Google Calendar? | **Only if early-access allowlisted.** |
| Can they accept a booking? | **Yes** — especially pay-later / request. Card pay path exists; treat live charge proof as **not solid**. |
| Can they complete a job? | **Yes** — mark completed in Jobs. |
| Can they get paid? | **Partial** — online via Stripe Checkout when Connect works; otherwise mark invoice paid manually. |
| Can they run their business entirely inside Hubly? | **No.** |

### Remaining blockers (honest)

1. **Closed money loop** — reliable live paid bookings + payouts proven in production.  
2. **Communications** — no SMS; email-only automation.  
3. **Calendar for everyone** — GCal still early access.  
4. **Create trust** — real OpenAI conversation + publishable site quality without hand-holding (Gate 1 validation still required).  
5. **Marketplace** — not a complete two-sided business yet.  
6. **Hardening** — auth storage, monitoring, a11y, monolith risk.  
7. **No stranger validation** — product % claims without unassisted user sessions are guesses.

---

## How to use this document

- **Exists** = Complete rows above.  
- **MVP-critical gaps** = §16 blockers 1–4.  
- **Polish** = motion, initials logo, Discover theater, pixel taste.  
- **Can wait** = Marketplace density, native apps, multi-page CMS, team seats — unless your launch thesis depends on them.

Update this file only when customer-usable reality changes — not when a PR is opened.
