# Hubly Studio — Implementation Spec

**Status:** In progress · replaces Operate **Marketing** tab  
**Branch:** `cursor/hubly-studio-0640`  
**Design refs:** `docs/designs/` (Dashboard · Studio Home · AI Creator · Templates · Editor · Brand Kit · Publish · Analytics)

## Product

Hubly Studio is the creative OS for home-service owners: turn completed jobs into local marketing posts (Instagram, Facebook, Google Business, print) using Brand Kit + AI + (later) Canva SDK.

**Brand promise fit:** Studio learns how *this* business markets — Memory (facts: logo, phone, jobs) vs DNA (voice, style) stay separate.

## Runtime (important)

Hubly Operate is **vanilla JS** under `public/journey-os/` (see `docs/operate/COMMERCE_ENGINE.md`). Studio ships the same way:

| Layer | Path |
|-------|------|
| UI | `public/journey-os/hubly-studio.js` + `hubly-studio.css` |
| State | `S.studioOs` (+ durable tables via API) |
| Backend | `supabase/migrations/*_hubly_studio.sql` · `supabase/functions/studio-api` |
| Nav | Replaces `data-v="marketing"` → `studio` |

Mockups use Next.js/Tailwind language; **tokens and layout match those designs** (brand `#D9632D`, dark Studio chrome, Outfit-like UI via Plus Jakarta Sans). A separate Next.js app would fork auth/session from Operate and is out of scope.

## Screens (build order)

1. **Operate Dashboard** — Studio promo banner + nav label **Studio** (NEW badge) · entry to Studio Home  
2. **Studio shell** — dark sidebar (Home · AI Creator · Projects · Templates · Photos · Brand Kit · Elements · Uploads · Publish · Analytics · Settings)  
3. **Studio Home** — greeting, AI draft prompt, blank formats, AI recommendations, recent projects, publish queue  
4. **Editor** — tool rail · AI Suite / Elements · canvas · properties · pages-in-set · Publish to Queue  
5. Later: Templates · Brand Kit · Publish Center · Analytics (shell routes exist)

## Backend ownership (Rule #15)

Studio owns: projects, pages, assets, brand kit, templates (catalog), publish queue, connected social account *links*, analytics snapshots.

Does **not** own: Customers, Jobs, Reviews, Revenue/Stripe, Website Memory/DNA. Reads those for generation context.

Canva stays Connected Apps / Creative Engine — Studio calls capabilities; missing credentials → honest “Provider not configured”.

## Data model (V1)

- `studio_settings` — per-business (storage quota, canva linked flag)  
- `studio_projects` — design projects  
- `studio_project_pages` — formats in a set (ig_post, fb_feed, story, flyer, …)  
- `studio_assets` — uploaded / job-linked media refs  
- `studio_brand_kit` — logos, colors, fonts, voice tones (JSON)  
- `studio_templates` — platform catalog (optional seed)  
- `studio_publish_queue` — scheduled posts  
- `studio_social_accounts` — IG/FB/GMB connection status (no fake “Connected” without provider)  
- `studio_analytics_snapshots` — optional cached metrics  

## Stage honesty

- **Stage 1:** Full Studio OS UI + CRUD persistence. Generate Layout / Publish queue local. Social “Connected” only when Connected Apps report real links.  
- **Stage 2:** Live Canva SDK, Meta/Google publish, engagement analytics.

## Success

Owner opens **Studio** (was Marketing), lands on Studio Home matching designs, opens Editor, saves a project via `studio-api`, sees it on Home/Publish queue. Dashboard “Open Studio” launches the same surface.
