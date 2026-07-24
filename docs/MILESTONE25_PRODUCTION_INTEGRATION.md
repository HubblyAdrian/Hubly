# Milestone 2.5 — Production Integration

**Goal:** Replace every old screen users hit on hubly.app with the Milestone 2 experience.  
**Not a proof milestone.** Users must feel the new journey in production.

> Your guess was right: Milestones 1 / 1.5 / 2 mostly built the **engine**.  
> Production still drives the **old car** because that stack never landed on `main`.

---

## Audit — What hubly.app shows today

### There is no React app

Production is a **Vercel-routed multi-HTML site**. The owner SPA is one file: `public/hubly.html` (vanilla JS). No React Router, no Vite, no Next.

| URL | Server file | What mounts |
|-----|-------------|-------------|
| `hubly.app/` | `public/platform-home.html` | Old Platform Entry marketing (Phase 6.5) |
| `hubly.app/signup` | `public/hubly.html` | **On `main`:** old auth-shell signup (“Let’s build your site” + Get started) |
| `hubly.app/login` | `public/hubly.html` | Sign-in form |
| `hubly.app/onboarding` | `public/hubly.html` | Instant Site / Creative Director shell |
| `hubly.app/app` | `public/hubly.html` | **Old Dashboard** (`#p-app` → `goDash`) |

### What React page renders?

**None.** `#p-signup`, `#p-onboard`, `#p-app` are DOM pages toggled by `showP()`.

### Route tree (production)

```
api/router.js
├── /                        → platform-home.html     ← OLD marketing
├── /signup                  → hubly.html #p-signup   ← OLD on main · M2 Welcome only on unmerged branches
├── /login                   → hubly.html #p-signin
├── /onboarding              → hubly.html #p-onboard + #is-shell
├── /app · /dashboard        → hubly.html #p-app      ← OLD dashboard (jobs/CRM/editor)
├── /get-done                → get-done.html
├── /marketplace · /pro · /enter → other landings
└── {slug}.(my)hubly.app/*   → hubly.html storefront
```

### In-SPA map (`HUBLY_PAGE_ROUTES`)

| Page id | Path | Role |
|---------|------|------|
| `p-landing` | `/` | In-SPA marketing (only after client nav; refresh reloads platform-home) |
| `p-signup` | `/signup` | Front door |
| `p-signin` | `/login` | Auth |
| `p-onboard` | `/onboarding` | Instant Site shell |
| `p-app` | `/app` | Classic dashboard |

---

## 1. Connected to production vs not

### On production `main` today

| Milestone | Connected? | What users actually get |
|-----------|------------|-------------------------|
| **M1 Hubly Brain** | Partially | Edge functions / brain modules may deploy independently; **UI does not express M1 as a journey** |
| **M1.5 Builder Engine** | Backend/scripts | `supabase/functions/_shared/hubly_brain_*` + `scripts/lib/*` gates — **not the Instant Site UI** |
| **M2 Experience** | **Not on main** | Lives only on stacked draft PRs `#211`→`#223` |

**Smoking gun:** `origin/main` `#p-signup` is still the old auth shell:

> “Let’s build your site” · **Get started →** · `startInstantSite()`

The Welcome Experience (`data-welcome-experience`, Thinking Canvas, Business Home, …) exists on `cursor/milestone2-experience-epic12-2662` and **has never been merged to `main`**.

### On the Epic 12 branch (this stack) — wired inside `hubly.html`, still not production until merge

| Epic | Surface | Reachable after Welcome? |
|-----:|---------|--------------------------|
| 1 | Welcome (`#p-signup`) | Yes — `/signup` |
| 2 | Discovery (`#is-step-talk`) | Yes |
| 3 | Thinking (`#is-step-thinking`) | Yes |
| 4 | Creative Build | Yes |
| 5 | Reveal | Yes |
| 6 | Delayed Account / Founder Moment | Yes |
| 7 | Launch | Yes |
| 8 | Business Home | Yes — *inside Instant Site only* |
| 9 | Creative Workspace | Yes — from Home |
| 10 | Hubly Daily | Yes — before Home |
| 11 | Living Business | Yes — from Home |
| 12 | Polish | Yes — from Living Business |

### Still “engine only” (modules / proofs / unreachable as primary UX)

| Artifact | Status |
|----------|--------|
| `scripts/lib/*-experience.mjs`, `scripts/check-m2-epic*.mjs`, `docs/MILESTONE2_EPIC*_PROOF.md` | Gate mirrors — not rendered |
| `scripts/lib/business-builder.mjs` + Builder Epic gates | Milestone 1.5 certification — not signup UI |
| Legacy `#cd-shell` Creative Director | Superseded (`startCreativeDirector` → Instant Site) |
| Legacy `obs-*` form wizard | Hidden unless `cd-building` |
| `#is-step-vibe` / `email` / `build` / `discover` / `photos` | Old Instant Site path — not fresh M2 |
| `#is-step-inspire` | Markup only — **unreachable** |
| Classic `#p-app` Dashboard | **Still the real home after login** via `loadBusiness` → `goDash()` |

---

## 2. Is M2 replacing `/signup`?

**Intended:** Yes — Welcome **is** `#p-signup` / `/signup` (conversation front door, not account form).

**Reality on hubly.app:** No — production still serves the old signup shell because M2 PRs are open drafts stacked on each other / Milestone 1.5, **not merged to `main`**.

After merge, Welcome still lives *separately* from:

- Apex `/` (`platform-home.html`)
- Returning-user `/app` (classic dashboard)

So even with Welcome merged, the product is split: **onboarding = M2 soft shell**, **daily life = old car**.

---

## 3. Unreachable / not production-primary (your guess)

Screens that **exist** on the M2 branch but are **not** what returning users get from `/app`:

| Screen | Exists? | Production-primary? |
|--------|---------|---------------------|
| ThinkingCanvas (`#is-step-thinking`) | Yes | Only mid Instant Site |
| Creative Build | Yes | Only mid Instant Site |
| BusinessReveal | Yes | Only mid Instant Site |
| LaunchExperience | Yes | Only mid Instant Site |
| BusinessHome | Yes | **Not** `/app` — login still opens Dashboard |
| CreativeWorkspace | Yes | Not the Website editor in `#p-app` |
| Hubly Daily / Living / Polish | Yes | Soft-shell only |

Root cause of “signup still feels old” on hubly.app:

1. **M2 never shipped to `main`**
2. Even on the branch, **post-login home is still `goDash()` → `#p-app`**

---

## 4. Migration plan — replace the car

### Phase A — Ship the stack (unblock)

1. Merge / squash **Milestone 1 → 1.5 → 2** onto `main` (PR chain `#211`…`#223` currently bases on each other, not `main`).
2. Deploy Vercel from `main`.
3. Smoke: hard refresh `hubly.app/signup` → Welcome composer (not “Let’s build your site”).

### Phase B — Front door (this branch starts it)

| Old | New |
|-----|-----|
| `platform-home.html` at `/` | Welcome Experience at `/` (legacy marketing at `/platform`) |
| Old `/signup` auth shell | Welcome (already on M2 branch) |
| `/signup?q=` ignored | Prefill / continue into Discovery |
| In-SPA `p-landing` Get started skipping Welcome | Always Welcome first |

### Phase C — Journey stays M2 (already on branch)

Welcome → Discovery → Thinking → Creative Build → Reveal → Delayed Account → Launch → Daily → Business Home → Creative Workspace / Evolution.

Retire primary use of: vibe → email → build → discover; `#cd-shell`; claim-account-first flows.

### Phase D — Daily product = Business Home (this branch)

| Old | New |
|-----|-----|
| `loadBusiness` → `goDash()` → Dashboard | → **Business Home** (+ morning Hubly Daily) |
| Website editor in `#p-app` | **Creative Workspace** as primary edit |
| Dashboard as default | Classic Dashboard as **escape hatch** (“Classic workspace”) only |

Persist `meta.m2Experience = true` (or `hubly_m2_home`) when Launch / Business Home first opens so returning sessions stay on the new home.

### Phase E — Founder acceptance (production)

A stranger on hubly.app can:

1. Land on Welcome  
2. Describe a business  
3. Watch Thinking + Build + Reveal  
4. Save / launch  
5. See Daily → Business Home  
6. Edit in Creative Workspace  
7. Sign out, sign in → **still** Business Home (not classic Dashboard)

Only then is Milestone 2 **actually** finished.

---

## Release gate for 2.5 (product, not proofs)

- [ ] M2 stack on `main` and deployed  
- [ ] `/` and `/signup` show Welcome  
- [ ] `?q=` seeds the conversation  
- [ ] Full journey completable without classic wizard  
- [ ] `/app` / login resume → Business Home (+ Daily)  
- [ ] Creative Workspace reachable as primary edit  
- [ ] Classic Dashboard not the default landing  

---

## What this branch changes immediately

See commit on `cursor/milestone25-production-integration-2662`:

1. Apex `/` → `hubly.html` Welcome front door; legacy marketing at `/platform`  
2. Welcome consumes `?q=` from platform CTAs  
3. Returning owners with M2 flag open **Business Home** instead of classic Dashboard  
4. Launch / Home set the M2 home flag  
5. Escape hatch to classic Dashboard from Business Home  
