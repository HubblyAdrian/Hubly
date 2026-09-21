# Hubly Studio × Canva Connect — Integration Architecture Plan

**Status:** Planning only (no implementation in this document)  
**Sources:** Official Canva Developer documentation at [canva.dev](https://www.canva.dev/docs/connect/) only  
**Goal:** Studio feels native to Hubly; Canva is the pixel editing engine — Production-First, Connected Apps pattern.

---

## 1. Verdict: which Canva product Hubly should use

| Product | What it is | Role for Hubly Studio |
|--------|------------|------------------------|
| **Canva Connect APIs** | REST APIs (`https://api.canva.com/rest/v1/…`) that let *your* product create designs, upload assets, export, and open Canva’s editor | **Primary integration.** This is how Studio brings Canva into Hubly. |
| **Canva Connect SDKs / client libraries** | Official helpers around Connect (OAuth, typed clients where published) | Use for auth + REST calls from Hubly edge/backends — not a separate “embed editor” SDK. |
| **Canva Apps SDK** (`@canva/design`, Design Editing `openDesign`, etc.) | Build plugins that run *inside* Canva’s editor | **Not** the Studio shell. Optional later: a Hubly Brand Kit / autofill helper *inside* Canva when the owner is already editing. |
| **Canva Apps SDK Design Editing APIs** | Programmatic edit of the open design *while the user is in Canva* | Wrong layer for Hubly’s Operate UI. Do not treat as “embed Canva canvas in Hubly.” |

**Critical constraint (official):** Connect does **not** provide an iframe or SDK that embeds the full Canva canvas inside a third-party app. The supported editing UX is:

1. Hubly creates / lists designs via Connect.
2. Hubly sends the user to a temporary **`urls.edit_url`** (Edit in Canva).
3. After editing, Canva **returns** the user to Hubly via **Return Navigation** (`correlation_state` → `correlation_jwt`).

**Native-feeling Studio** therefore means:

- Hubly owns: Home, AI Creator, Templates browse, Brand Kit UX, Projects, Publish queue, Analytics chrome, previews, job context.
- Canva owns: the actual design canvas (via Edit in Canva + return).
- Preview in Studio uses Canva **thumbnails** / **view_url** / **export** URLs — not a fake local canvas pretending to be Canva.

Reference patterns in Canva docs: commercial “Edit in Canva” apps (e.g. Nourish / Realty-style Connect integrations) and the [Return navigation guide](https://www.canva.dev/docs/connect/return-navigation-guide/).

---

## 2. Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Hubly Operate / Studio                   │
│  Home · AI Creator · Templates · Brand Kit · Projects ·      │
│  Publish · Analytics · preview thumbnails · Connected Apps   │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                │  Connected App: Canva       │  Return URL
                │  (OAuth + capability)       │  + correlation_jwt
                ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│              Hubly edge (studio-api / CanvaProvider)         │
│  Token store · scope checks · job polling · map design IDs   │
│  → Hubly projects / assets / publish queue                   │
└───────────────┬─────────────────────────────────────────────┘
                │  REST https://api.canva.com/rest/v1/...
                ▼
┌─────────────────────────────────────────────────────────────┐
│                     Canva Connect                            │
│  OAuth · Designs · Assets · Autofill · Exports · Folders ·   │
│  Webhooks · User capabilities · JWKS (return nav)            │
└───────────────┬─────────────────────────────────────────────┘
                │  edit_url / view_url (user browser)
                ▼
┌─────────────────────────────────────────────────────────────┐
│              Canva editor (hosted by Canva)                  │
│  Optional: Hubly Apps SDK app via ?app_id= on edit URL       │
└─────────────────────────────────────────────────────────────┘
```

**Production-First:** Until `CANVA_CLIENT_ID` / `CANVA_CLIENT_SECRET` (and per-user tokens) exist, Studio must show **Provider not configured** — never simulate successful Canva create/export/edit.

**Connected Apps:** AI / Coach must not name “Canva” as a tool choice for “I want more customers.” Canva is the Creative Engine behind Studio when the owner has connected it.

---

## 3. Concern → official API / SDK map

### 3.1 Authentication

| Need | Official approach |
|------|-------------------|
| Connect an owner’s Canva account | **OAuth 2.0 Authorization Code** with **PKCE** (S256) |
| Tokens | Access + refresh; refresh via token endpoint; introspect / revoke as needed |
| Acting on designs | Access token must act **on behalf of the user** for design/asset/export APIs |
| Scopes | Request only what Studio needs; **write scopes do not imply read** — request both where required |

**Documented scopes Hubly Studio will need (minimum set):**

| Scope | Purpose |
|-------|---------|
| `design:meta:read` | List / get design metadata, thumbnails, edit/view URLs |
| `design:content:write` | Create designs |
| `design:content:read` | Read design content where required by later APIs |
| `asset:read` / `asset:write` | List/upload assets |
| Brand template / autofill scopes (as listed in Brand Templates + Autofill docs) | Template list, dataset, autofill jobs — **Enterprise-gated** |
| Export-related scopes (per Create design export job docs) | Export jobs |
| Folder scopes (optional) | Keep Hubly designs in a dedicated Canva folder |
| Webhook registration scopes (optional) | Collaboration / design update events |

**Hubly implementation notes (plan only):**

- Register a Connect integration in the Canva Developer Portal; configure **return URL(s)** for Return Navigation.
- Store tokens server-side per Hubly business/owner (never in browser as long-lived secrets).
- Use Connected Apps status: connected / needs reconnect / not configured.
- Follow Canva’s [brand guidelines for Connect buttons](https://www.canva.dev/docs/connect/) (“Connect Canva” / “Edit in Canva”).

---

### 3.2 Embedded editing (what “native editor” actually means)

| Approach | Official support | Hubly decision |
|----------|------------------|----------------|
| Iframe / embedded canvas SDK in Hubly | **Not provided** by Connect | Do not build |
| Open `urls.edit_url` → Canva editor → return to Hubly | **Supported** (Return Navigation) | **Primary** |
| Open `urls.view_url` for read-only | Supported; ~30-day temporary URLs | Preview / review |
| Append `correlation_state` (≤ 50 chars, URL-safe) to edit/view URL | Required for reliable return | Encode Hubly project id / studio route |
| Validate `correlation_jwt` with JWKS `GET /v1/connect/keys` | Required | Server-side only |
| Optional `app_id` on edit URL | Opens a specific Apps SDK app inside Canva | Phase 2+ Brand Kit helper |

**Return Navigation flow (official):**

1. Studio calls Create/Get/List design → receives `urls.edit_url`.
2. Hubly appends `?correlation_state=<opaque>` (or `&` if query exists).
3. User edits in Canva.
4. Canva redirects to Hubly’s configured return URL with `correlation_jwt`.
5. Hubly verifies JWT (issuer, expiry, signature via JWKS); reads `design_id`, `correlation_state`.
6. Studio refreshes design meta / thumbnail / triggers export.

**UI implication:** Studio “Editor” screen should be a **project workspace** (preview, AI suggestions, brand, publish) with a primary **Edit in Canva** CTA — not a local fabric/canvas that mirrors Canva tools.

---

### 3.3 Design creation

| Need | Official API |
|------|----------------|
| Create blank or sized design | `POST /v1/designs` |
| Custom social sizes | Create with **custom** width/height (Connect design types include `custom`) |
| Seed from uploaded asset | Create design with `asset_id` (per Create design docs) |
| Get one design | `GET /v1/designs/{id}` |
| List / search owner designs | `GET /v1/designs` (`design:meta:read`, continuation, ownership filters) |
| Unused blank designs | Docs: unused blank designs may be cleaned up (~7 days) — persist Hubly project linkage and encourage save/edit |

**Rate limits (examples from docs):** list designs ~100 req/min/user — design list/sync should be paginated and cached in Hubly.

---

### 3.4 Templates

| Need | Official approach | Constraint |
|------|-------------------|------------|
| Brand Templates list/get | Brand Templates APIs under Connect | Tied to Canva **Brand** / team templates |
| Field dataset for a template | Get Brand Template dataset | Required before autofill |
| Fill template → new design | `POST /v1/autofills` + **poll autofill job** | **Autofill requires Canva Enterprise** (docs: paid plans may have limited trial in development) |
| Public “Canva template gallery” as Hubly’s catalog | Not a free unlimited Connect substitute for Brand Autofill | Hubly can curate **Hubly templates** that map to Brand Template IDs the business owns, or fall back to Create design + asset |

**Plan for Hubly Studio Templates screen:**

1. **Path A (Enterprise-connected teams):** Browse Brand Templates → Autofill with Memory facts (business name, phone, offer) + DNA-driven copy from Hubly → result design id → preview → Edit in Canva.
2. **Path B (non-Enterprise):** Create design (blank/custom size) ± uploaded asset; Hubly AI writes captions/copy in Studio; visual edit still Edit in Canva. Do **not** fake Autofill success.
3. Keep Hubly’s own template cards as UX; each card resolves to either Brand Template id or create-design preset (size + starter asset).

---

### 3.5 Asset uploads

| Need | Official API |
|------|----------------|
| Upload binary (job photos, logos) | `POST /v1/asset-uploads` (octet-stream; asset name via documented Base64 header) |
| Upload by URL | Asset upload-by-URL variant (per Asset upload docs) |
| Job status | Poll asset upload job until success/failure |
| Use in designs | Pass resulting `asset_id` into Create design / autofill fields |
| Scopes | `asset:write` (upload), `asset:read` (list/get as needed) |

**Hubly flow:** Owner picks job photo from Hubly (Business/Customer Memory context) → edge uploads to Canva → store Canva `asset_id` on Studio project → create or autofill design.

---

### 3.6 Exports

| Need | Official API |
|------|----------------|
| Start export | `POST /v1/exports` (design id + format: jpg, png, pdf, …) |
| Poll | Export job status until complete |
| Download | Temporary export URLs (docs: on the order of ~24 hours — treat as ephemeral; Hubly must copy into Hubly storage for Publish) |
| Failures | Premium-element / permission failures — surface honestly |
| Rate limits | Respect documented per-user limits; queue Studio exports |

**Hubly Publish:** Social scheduling remains Hubly’s job. Canva export → Hubly media store → publish executors. Do not claim Canva auto-posted unless a separate provider exists.

---

### 3.7 Resize / multi-format (Instagram vs Story vs Flyer)

| Need | Official approach |
|------|-------------------|
| Programmatic resize | **Resize** API (Connect) |
| Gate | **Get user capabilities** — only call resize if the user’s plan/capabilities allow it |
| Fallback | Create separate designs per size, or prompt user to resize in Canva editor |

---

### 3.8 Folders, webhooks, analytics (supporting)

| Feature | Use in Studio |
|---------|----------------|
| Folders API | Create “Hubly Studio” folder; move new designs there for owner clarity |
| Webhooks | Design updated / collaboration events → refresh Studio project thumbnails |
| Design insights / analytics APIs (if in Connect catalog for the integration) | Feed Studio Analytics when scopes and product access allow — else Hubly-only metrics on publishes |

---

### 3.9 Optional: Canva Apps SDK (inside Canva only)

Use **only** if Hubly wants in-editor helpers (inject Brand Kit colors, pull Hubly Memory fields) while the owner is already in Canva.

- Open via `edit_url` + `app_id`.
- Uses `@canva/design` / App UI — **not** a replacement for Connect.
- Does not embed Canva into Hubly Operate.

---

## 4. Recommended end-to-end Studio flows

### Flow A — Connect once

1. Studio → Connected Apps → Connect Canva (OAuth + PKCE).
2. Store tokens; mark CanvaProvider healthy.
3. Optionally create Hubly folder in Canva.

### Flow B — AI Creator → design

1. Owner describes offer / picks job photo in Hubly.
2. Upload asset (asset upload job).
3. If Enterprise + Brand Template: Autofill job → design id.  
   Else: `POST /v1/designs` with size + optional asset.
4. Show thumbnail in Studio project.
5. CTA: **Edit in Canva** (return navigation).
6. On return: refresh meta; optional auto-export PNG for Publish queue.

### Flow C — Templates

1. List Brand Templates (if available) or Hubly presets.
2. Autofill or create.
3. Same edit / export path as B.

### Flow D — Publish

1. Export job → download → Hubly storage.
2. Hubly Publish / social capabilities (separate providers).
3. Studio Analytics tracks Hubly-side publish outcomes; Canva-side insights only if officially available for the account.

---

## 5. What Hubly owns vs Canva owns

| Layer | Owner |
|-------|--------|
| Studio IA, copy, Brand Kit UI, AI prompts, project list | Hubly |
| Business Memory facts / Business DNA tone for autofill inputs | Hubly (Memory vs DNA stay separate) |
| OAuth app registration, return URL, token vault | Hubly |
| Canvas editing tools, fonts, Canva elements | Canva |
| Final raster/PDF bytes for social | Canva export → Hubly storage |
| Posting to Instagram / Facebook / etc. | Hubly capabilities / providers — not Canva Connect by default |

---

## 6. Phased implementation plan (no code in this doc)

### Phase 0 — Prerequisites

- Canva Developer Portal: Connect integration, redirect URIs, return navigation URL, brand assets for buttons.
- Secrets: `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, return URL config.
- Confirm whether target customers are on **Canva Enterprise** (Autofill) or not — product copy and Templates path depend on this.
- Align Connected App permissions labels with real Connect scopes (current stub names like `design:read` should map to official `design:meta:read` / `design:content:*`).

### Phase 1 — Auth + design round-trip (MVP “editing engine”)

1. OAuth authorize + PKCE + token refresh in edge/`CanvaProvider`.
2. Create design (`POST /v1/designs`) for Studio project sizes.
3. Persist `canva_design_id` on Hubly studio project.
4. Get design → show thumbnail in Studio.
5. Edit in Canva with `correlation_state` + return handler verifying `correlation_jwt` via `GET /v1/connect/keys`.
6. Replace local mock “canvas editor” as the source of truth for pixels — keep Hubly chrome as project shell.

### Phase 2 — Assets + exports

1. Asset upload jobs from Hubly media / job photos.
2. Create design from `asset_id`.
3. Export jobs → Hubly storage → Publish queue.
4. Honest errors for premium elements / missing scopes.

### Phase 3 — Templates / Autofill

1. Brand Templates list + dataset.
2. Autofill jobs when Enterprise capability present.
3. Capability check UX when Autofill unavailable (Path B).
4. Map Hubly template cards → Brand Template IDs or create-design presets.

### Phase 4 — Scale & polish

1. Folders for organization.
2. Webhooks for thumbnail freshness.
3. Resize API gated by Get user capabilities.
4. Optional Apps SDK companion app for Brand Kit inside Canva.
5. Design list sync for Projects (`GET /v1/designs`).

---

## 7. Explicit non-goals (from docs + product rules)

- Do **not** iframe the Canva editor or reimplement Canva tools in Hubly.
- Do **not** use Apps SDK Design Editing as Studio’s primary architecture.
- Do **not** simulate Autofill, export, or OAuth success without credentials / Enterprise access.
- Do **not** merge Business DNA into Memory when sending autofill field values — facts vs identity stay separate inputs.
- Do **not** treat Canva as the social publisher unless a separate documented product path is adopted later.

---

## 8. Official doc index used for this plan

Primary hubs (Canva Developer docs):

- Canva Connect overview / getting started  
- Authentication (OAuth, PKCE, scopes, tokens)  
- Return navigation guide + Connect JWKS (`/v1/connect/keys`)  
- Designs: create, get, list  
- Asset uploads (and upload jobs)  
- Design export jobs  
- Brand Templates + Autofill jobs (Enterprise)  
- Resize + Get user capabilities  
- Folders, webhooks (supporting)  
- Canva Apps SDK (optional in-Canva only; distinct from Connect)

Canonical host: `https://www.canva.dev/docs/connect/` (and Apps docs under `https://www.canva.dev/docs/apps/`).

---

## 9. Summary recommendation

**Use Canva Connect APIs as Hubly Studio’s creative backend.** Authenticate with OAuth + PKCE; create and list designs; upload assets; export asynchronously; use Brand Templates + Autofill only when Enterprise allows. **Editing is Edit-in-Canva + Return Navigation**, not an embedded SDK. Optionally add an Apps SDK app later for in-Canva Brand Kit — never as a substitute for Connect.

That is the only architecture that matches official Canva documentation while keeping Studio feeling like Hubly.
