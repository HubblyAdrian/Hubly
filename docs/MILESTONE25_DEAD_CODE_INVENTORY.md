# Milestone 2.5 — Dead Code Inventory (old product surfaces)

**Scope:** Inventory only — do **not** delete anything based on this doc.  
**Branch context:** Production Cutover (Welcome `/`, Business Home `/app`, Creative Workspace primary edit, Advanced Studio escape hatch).  
**Primary files reviewed:** `public/hubly.html`, `api/router.js`, `public/platform-home.html`, sibling marketing HTML, related API/edge helpers.

### How to read classifications

| Label | Meaning |
|-------|---------|
| **Delete** | Old primary surface; no longer the designed product path. Candidate for Phase D removal once callers are gone. |
| **Archive** | Intentionally demoted (secondary URL / rare path). Keep until brochure/ops needs are retired. |
| **Still Required** | Needed for cutover product, Advanced Studio hatch, auth, ops, or shared infrastructure that M2 still calls. |

> **Escape hatch rule:** `#p-app` / `#v-editor` / classic ops nav remain **Still Required** for Advanced Studio (Business Home → Creative Workspace → Advanced Studio → optional pixel editor). Do not treat “old dashboard/editor DOM” as delete-ready.

---

## Summary counts

| Surface | Delete | Archive | Still Required | Rows |
|---------|-------:|--------:|---------------:|-----:|
| 1. Old signup | 4 | 1 | 5 | 10 |
| 2. Old onboarding | 14 | 2 | 6 | 22 |
| 3. Old dashboard | 6 | 1 | 8 | 15 |
| 4. Old editor | 2 | 0 | 7 | 9 |
| 5. Old navigation | 5 | 6 | 4 | 15 |
| **Total** | **31** | **10** | **30** | **71** |

**Practical takeaway:** Wiring already prefers the new product (`goDash` → Business Home, `/` → Welcome, editor deep-link → Creative Workspace). Most remaining risk is **large dual-DOM in `hubly.html`** (marketing twin, CD/obs wizard, vibe/email/build steps, classic `#p-app` shell) that can still be reached via resume, deep links, or intentional Advanced Studio.

---

## 1. Old signup (auth-shell “Let's build your site”, email/password as primary)

| Path / symbol | What it does | Classification | Why | Risk if deleted now |
|---------------|--------------|----------------|-----|---------------------|
| `public/hubly.html` `#p-signup` + `data-welcome-experience` (~8619) | Welcome Experience front door (`/`, `/signup`, `/welcome`) — conversation, not account form | **Still Required** | This *is* the M2 signup replacement | Breaks apex `/` and stranger walkthrough step 1 |
| `public/hubly.html` `.auth-shell` CSS (~401) + `#p-signin` / `#p-reset-password` markup (~8547–8616) | Split-pane email/password chrome for **sign-in** and password reset | **Still Required** | Returning owners still authenticate here (`/login`) | Owners cannot sign in or reset passwords |
| `public/hubly.html` `signUp()` (~12533) | Stub: “Legacy account form retired” → `startInstantSite()` | **Delete** | Dead entry; Welcome + delayed account replaced classic signup | Low — only if something still calls `signUp()` directly |
| `public/hubly.html` i18n `createAccount` / `signUpFree` / `signUpHint` (~43283+) | Copy for retired classic signup form | **Delete** | No `#p-signup` account fields remain (`data-account-fields="0"`) | Low — unused strings; sign-in foot link uses some keys |
| `public/hubly.html` Welcome logo / auth “Back to home” → `showP('p-landing')` (~8550, 8582, 8622) | Sends users to in-SPA marketing brochure instead of Welcome `/` | **Delete** (or retarget) | Cutover front door is Welcome, not `#p-landing` | Users leave Welcome for old marketing; confusing dual home |
| `scripts/check-m25-cutover.mjs` “No old auth-shell signup title” | Asserts `#p-signup` does not contain “Let's build your site” | **Still Required** | Guards against regressing to classic signup | Gate false confidence if removed without replacement |
| `api/notify-signup.js` + `vercel.json` `/api/notify-signup` | Fire-and-forget “new Hubly signup” email from launch | **Still Required** | Ops notify on launch; not the UI form | Miss owner alerts on new businesses |
| `supabase/functions/create-instant-site-account/` | Soft login / draft account for Instant Site email step | **Still Required** (for soft-email path) / **Archive** once Save Business is sole auth | Still invoked from soft-email Instant Site helpers | Soft-email / draft claim flows fail if deleted early |
| Classic title “Let's build your site” inside `#p-signup` | Old auth-shell signup H1 | **Delete** (already gone) | Verified absent by cutover gate | N/A — already removed |
| Email/password fields as **primary** signup on `#p-signup` | Old account form | **Delete** (already gone) | Replaced by Welcome + M2 Save Business | N/A — already removed |

---

## 2. Old onboarding (cd-shell Creative Director, obs-* wizard, vibe/email/build Instant Site)

| Path / symbol | What it does | Classification | Why | Risk if deleted now |
|---------------|--------------|----------------|-----|---------------------|
| `public/hubly.html` `#cd-shell` (~8665–8718) + `.cd-shell` CSS (~935+) | Talk-first Creative Director UI (“Talk first. Form last.”) | **Delete** | Cold start uses Instant Site / M2 Discovery; CD is not primary | Low for strangers; breaks any deep-link / resume that re-shows CD chrome |
| `public/hubly.html` `startCreativeDirector()` (~16187) | Redirects to `startInstantSite()` | **Delete** (after callers updated) | Alias only — CD chat no longer boots | Call sites still named CD would need retarget |
| `public/hubly.html` `cdBoot` / `cdSend` / `cdFinish` / ~34 `cd*` helpers (~23523–24188) | Full CD conversation + live preview + build handoff | **Delete** | Superseded by Discovery → Thinking → Creative Build | High if any path still sets `cd-active` or calls `cdFinish` / `goOnboard` CD branch |
| `public/hubly.html` `#p-onboard` `.ob-shell` + `#obs-welcome|type|about|photos|ask|building|headline|suc` (~9318–9409) | Legacy form wizard steps (biz type → about → photos → ask → build → success) | **Delete** | Comment admits “Legacy form steps”; Instant Site / M2 owns onboarding | Medium — `obNext`, `completeOnboard`, building interstitial still reference these IDs |
| `public/hubly.html` `obNext` / `obBack` / `completeOnboard` / `showObReveal` / `obPublish` / `claimCreativeDirectorAccount` (~24688–25361) | Drive obs-* wizard, reveal dock claim, publish | **Delete** | Old claim/success path; M2 uses Reveal → Save → Launch | Medium — claim/publish still used if CD/obs path is entered |
| `public/hubly.html` `#obs-reveal` claim sheet (~9500–9528) | “Create your login” email/password after classic reveal | **Delete** | M2 delayed account lives in `#is-step-save-business` | Medium — `obPublish` / claim flows break |
| `public/hubly.html` `#obs-suc` “Go to dashboard” (~9406) | Success CTA into classic home language | **Delete** | `goDash()` already maps to Business Home, but copy/UI is old success | Low UX debt; confusing “dashboard” wording |
| `public/hubly.html` `#is-step-vibe` / `isRenderVibe` / `isPickVibe` / `isConfirmVibe` (~9181, ~22632+) | Layout+color picker before old build | **Archive** → **Delete** after draft migration | Primary M2 path uses Creative Build, not vibe grid; still reached via `isTalkFinishIntake` / draft resume | Breaks resume of drafts stuck on `step=vibe` |
| `public/hubly.html` `#is-step-email` + `isConfirmSoftEmail` / `isSkipSoftEmail` (~9192, ~22683+) | Soft email/password before old build | **Archive** → **Delete** after Save Business is sole auth | Soft login predates delayed account; still in resume path | Breaks soft-login drafts and `create-instant-site-account` usage |
| `public/hubly.html` `#is-step-build` + `isRunBuild` (~9210, ~22247) | Checklist “Launching your company” spinner build | **Delete** | Replaced by Thinking + Creative Build experiences | Medium — legacy talk finish and some attach helpers still call it |
| `public/hubly.html` `#is-step-discover` / inspire / photos (post-build polish) (~9223–9280+) | Post-build identity confirm / inspire / media | **Archive** | Parallel to M2 Reveal/Save; may still appear on legacy Instant Site | Medium for in-flight drafts |
| `public/hubly.html` `isTalkFinishIntake()` (~22076) | Ends **legacy** talk beats → vibe (not Thinking) | **Delete** | Discovery completion uses `isDiscoveryCompleteToThinking()` instead | Package/addons commit paths that still call it break |
| `public/hubly.html` `isDiscoveryCompleteToThinking()` + `#is-step-thinking|creative-build|reveal|…` (~17016+, ~8787+) | M2 onboarding spine | **Still Required** | Designed product path | Breaks entire stranger walkthrough |
| `public/hubly.html` `#is-shell` / `startInstantSite()` (~8721, ~16192) | Host shell for Instant Site + M2 steps | **Still Required** | Business Home / CW / Daily also live under `#is-shell` | Entire M2 owner product collapses |
| `public/hubly.html` `goOnboard()` (~15356) | Seeds CD state then `startCreativeDirector()` | **Delete** or rewrite | Still assumes CD beats/`ob-biz` fields | Orphan callers get broken setup |
| `public/hubly.html` `goWebsiteSetup()` (~15306) | Fallback when business row missing | **Still Required** (until rewritten) | Safety net for draft owners without a business row | Draft owners dead-end on sign-in |
| `public/hubly.html` `ensureDeferredDraftSession()` (~24191) | Mints draft auth for deferred account | **Still Required** | Shared by Instant Site / claim flows | Builds cannot persist without session |
| `public/hubly.html` `/onboarding` → `p-onboard` routing (~11876, 11889) | SPA path into onboarding shell | **Still Required** | M2 Instant Site uses this page id | Deep links / mid-flow refresh fail |
| `#p-onboard` CSS forcing `.cd-shell` hidden when `.is-active` (~1016–1018) | Ensures Instant Site wins over CD when active | **Still Required** (until CD DOM removed) | Prevents dual chrome | Accidental CD flash if CSS removed first |
| Draft resume `isRestoreInstantSiteUiFromDraft` vibe/email branches (~12348–12358) | Restores old IS steps from localStorage | **Archive** | Needed until old drafts expire | Users mid old IS lose progress |

---

## 3. Old dashboard (`#p-app` as home, `goDash` classic, `data-v="dashboard"` default)

| Path / symbol | What it does | Classification | Why | Risk if deleted now |
|---------------|--------------|----------------|-----|---------------------|
| `public/hubly.html` `goDash()` (~12084) | Always `openProductionBusinessHome()` | **Still Required** | Cutover home entry; many CTAs still call `goDash` | Owners lose post-login destination |
| `public/hubly.html` `openProductionBusinessHome()` / `preferM2ExperienceHome()` (~11989–12042) | Mounts Business Home under `/app` | **Still Required** | Designed owner home | Breaks Home / Daily / Living Business |
| `public/hubly.html` `goClassicDashboard()` (~12079) | Deprecated alias → `openAdvancedStudio` | **Delete** (after rename) | Name is legacy; behavior is hatch | Low if callers updated to `openAdvancedStudio` |
| `public/hubly.html` `#p-app` shell + nav (`data-v="dashboard"` default active) (~9535–9550) | Classic ops shell; dashboard nav item default | **Still Required** | Advanced Studio + Jobs/Customers/Money/etc. live here | Removes escape hatch and all classic ops |
| `public/hubly.html` `#v-dashboard` + `renderDashToday` / `updateKPIs` / Hubly Daily card inside dash (~9604+, ~41613+) | Classic dashboard view (greeting, KPIs, coach) | **Archive** as primary home; **Still Required** inside Advanced Studio | Not post-login home, but still a view when hatch opens ops | Hatch opens empty app; coach/KPIs disappear |
| `public/hubly.html` `switchV()` defaulting titles/`dashboard` (~34606) | View switcher for `#p-app` | **Still Required** | Powers Advanced Studio + ops tabs | Cannot navigate Jobs/Website/etc. |
| `public/hubly.html` `openAdvancedStudio()` (~12048) | Shows `#p-app`, prefers editor nav | **Still Required** | Intentional pixel/ops escape hatch | Cutover gate fails; power users stuck |
| `public/hubly.html` `/dashboard` → `p-app` mapping (~11891) | Legacy URL alias to app shell | **Archive** | Keep redirect semantics; never treat as product home | Bookmarks to `/dashboard` 404 / wrong page |
| `public/hubly.html` `loadBusiness` → `goDash()` / CW on `openEditor` (~12628–12634) | Resume routing after auth | **Still Required** | Ensures Business Home (and CW for editor deep-link) | Login lands on wrong surface |
| Nav label “Dashboard” / bar title “Dashboard” (~9549, 9588) | Classic chrome copy | **Delete** (rename) when hatch branded “Advanced Studio” | Misleading as primary product language | Low — cosmetic until hatch UX polish |
| `obs-suc` / coach i18n “Go to dashboard” (~9406, ~44187) | Old CTA copy | **Delete** (retarget copy) | Home is Business Home | Confusing language only |
| `#p-app` as **default first paint / home** | Old product home | **Delete** (behavior already flipped) | `goDash` no longer opens classic dash first | N/A for behavior; DOM still required |
| Jobs / Customers / Money / Chats / Marketplace views under `#p-app` | Ops surfaces | **Still Required** | Real business tools; hatch + deep links | Break day-to-day ops for live owners |
| Marketing mock “Dashboard” CTA in `#p-landing` hero (~8293) | Fake product chrome in brochure | **Delete** with `#p-landing` | Reinforces old product story | Low |

---

## 4. Old editor (`#v-editor` as primary website edit)

| Path / symbol | What it does | Classification | Why | Risk if deleted now |
|---------------|--------------|----------------|-----|---------------------|
| `public/hubly.html` `#is-step-creative-workspace` + `isEnterCreativeWorkspace()` (~9055, ~18813) | Conversation-first website editing | **Still Required** | Primary “Edit with Hubly” path | Walkthrough step 10 fails |
| `public/hubly.html` Business Home “Edit with Hubly” (~9037, ~18218) | Opens Creative Workspace | **Still Required** | Designed edit entry | Owners cannot edit via M2 |
| `public/hubly.html` `#is-cw-advanced` + `isCwToggleAdvanced` / pixel CTA (~9128–9133, ~19074) | In-CW Advanced Studio panel + open pixel editor | **Still Required** | Documented escape hatch | Hatch disappears; gate regression |
| `public/hubly.html` `#v-editor` (~10247–10865) + editor CSS (`#v-editor.ed-canvas-on` …) | Pixel / hub editor (Site / Packages / Book / Quote) | **Still Required** | Advanced Studio pixel path | “Need pixel-perfect control?” dead-ends |
| `public/hubly.html` `openWebsiteEditorHub()` / `switchWebsiteHubTab()` / `mountEdChrome` (~26102+) | Opens `#p-app` + `#v-editor` hubs | **Still Required** | Shared by hatch and booking-wizard deep links | Book Now / Packages hubs break |
| `public/hubly.html` nav `data-v="editor"` “Website editor” (~9573) | Classic nav entry into `#v-editor` | **Still Required** (hatch) / rename later | Reachable from Advanced Studio shell | Hatch users lose editor tab |
| `public/hubly.html` treating `#v-editor` as **default post-login / primary edit** | Old primary website UX | **Delete** (behavior already flipped) | `loadBusiness({openEditor})` → CW | N/A if wiring stays |
| Editor deep-link wiring (`opts.openEditor` → `isEnterCreativeWorkspace`) (~12630–12632) | Cutover: editor intent opens CW | **Still Required** | Prevents accidental classic editor | Re-opens dual-product failure mode |
| Large PE / layout / preview helpers tied to `#v-editor` | Implement canvas editing | **Still Required** | Power-edit + many storefront sync paths | Site editing / preview regressions |

---

## 5. Old navigation (`#p-landing` marketing in `hubly.html`, `platform-home` as apex)

| Path / symbol | What it does | Classification | Why | Risk if deleted now |
|---------------|--------------|----------------|-----|---------------------|
| `api/router.js` apex `/` → `serveHublyHtml` (Welcome), **not** `platform-home` (~161–175) | Cutover front door | **Still Required** | Stranger starts at Welcome | Apex serves old brochure again |
| `api/router.js` `/platform`, `/home`, `/platform-home` → `public/platform-home.html` (~167–173) | Legacy Phase 6.5 platform brochure | **Archive** | Demoted off apex; still linked / bookmarked | Breaks `/platform` brochure & RC checks |
| `public/platform-home.html` (~2471 lines) | Full “Ask Hubly / Build My Business” marketing site; CTAs → `/signup` | **Archive** | Secondary marketing; CTAs already feed Welcome | Lose brochure + readiness waitlist UI |
| `public/hubly.html` `#p-landing` (~8241–8449) + `.mkt*` CSS (~221 selector lines) | **Second** marketing site embedded in SPA; historically default `class="active"` | **Delete** | Duplicate of platform brochure; not apex; conflicts with Welcome | Breaks “Back to home” links until retargeted to `/` or `/platform` |
| `public/hubly.html` `showLanding` / `mktStartFromPrompt` / `mktChat*` / `ensureMktSupportChat` (~45632, ~45829+) | In-SPA marketing helpers; CTAs now route through Welcome | **Delete** with `#p-landing` (keep CTA retarget) | Dual marketing chrome | Support chat / demo booking on brochure page |
| `public/hubly.html` `HUBLY_PAGE_ROUTES['p-landing']` → `/platform` (~11872) | Maps SPA marketing page to `/platform` path | **Archive** / **Delete** with `#p-landing` | Path also served by `platform-home.html` via router — dual implementation | Confusion: SPA vs static file for same path |
| `public/pro-landing.html` + router `/pro`, `/hubly-pro` (~188–194) | Business Experience marketing page | **Archive** | Not apex; still a public entry | `/pro` 404 |
| `public/enter.html` + router `/enter`, `/account` (~196–202) | Persona chooser (Get Done / Marketplace / Hubly login) | **Still Required** (or Archive if unused in nav) | Multi-persona entry without shared login | Account chooser vanishes |
| `public/marketplace-landing.html` + `/marketplace` | Marketplace marketing | **Still Required** | Separate product surface | Marketplace public path breaks |
| `docs/PLATFORM_ENTRY.md` claiming `/` = `platform-home.html` | Outdated architecture note | **Archive** / update | Contradicts M2.5 cutover | Docs mislead future work |
| Boot script treating `/` as owner path + removing `#p-landing` active (~8473–8477) | Avoids marketing flash on owner routes | **Still Required** until `#p-landing` removed | Prevents brochure flash | Marketing flash on `/` |
| `checkSession` marketing/`p-landing` fallbacks (~14860–14879, ~15065–15075) | Session restore still reasons about marketing page | **Delete** leftovers after Welcome-only | Apex is Welcome; leftover `p-landing` branches are dual-product | Wrong first paint for logged-out users |
| Root `hubly.html` twin | Stale duplicate of app HTML | **Delete** (already removed) | Cutover Phase D / gate asserts absence | N/A |
| `public/get-done.html` “For businesses” → `/` | Consumer → business entry | **Still Required** | Now correctly hits Welcome | Wrong funnel if retargeted to `/platform` without intent |

---

## Cross-cutting notes (not separate product surfaces)

| Item | Note |
|------|------|
| Dual `/platform` implementations | Router serves **static** `platform-home.html`; SPA can also `showP('p-landing')` with path `/platform`. Prefer one brochure. |
| Shared IDs (`ob-biz`, `ob-email`, phone preview, etc.) | Hidden obs inputs still written by Instant Site / CD helpers — delete obs UI carefully or keep stub fields. |
| `#p-onboard` hosts both dead CD/obs **and** live `#is-shell` | Do not delete `#p-onboard` when removing CD/obs. |
| Advanced Studio ≠ delete `#p-app` | Cutover requires hatch; classify **home behavior** as retired, **shell** as required. |
| Gate coverage | `npm run check:m25-cutover` proves wiring, not that dead DOM is gone — Phase D is this inventory’s follow-up. |

---

## Suggested Phase D order (inventory guidance only)

1. Retarget all `showP('p-landing')` / “Back to home” → Welcome (`p-signup` / `/`) or `/platform` static brochure.  
2. Remove or isolate `#p-landing` + `.mkt*` from `hubly.html` (largest pure-marketing duplicate).  
3. Remove CD/`obs-*` primary UI after confirming no production resume hits `cd-active` / `obNext`.  
4. Migrate or expire local drafts on `vibe`/`email`/`build`; then delete those steps + `isTalkFinishIntake` vibe branch.  
5. Keep `#p-app` / `#v-editor` / ops views; rename chrome to “Advanced Studio” when ready.  
6. Update `docs/PLATFORM_ENTRY.md` to match M2.5 routing.

---

*Generated for Milestone 2.5 Production Cutover — inventory only; no files were deleted.*
