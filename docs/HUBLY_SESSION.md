# Hubly Session — Lifecycle & Handoff

**Rule #24** · Canonical module: `public/hubly-session.js`  
**Storage key:** `localStorage.hubly_session_v1`  
**Legacy key (migrated once):** `hubly_builder_session_v1`

---

## Why “Hubly Session” (not Builder Session)

One session can flow across products:

Landing → Business Builder → Marketplace → Public Ask Hubly → future surfaces

One memory. One identity before account creation.

---

## Shape

```json
{
  "id": "hs_…",
  "kind": "hubly_session",
  "status": "anonymous | importing | handed_off | upgraded",
  "createdAt": "ISO",
  "updatedAt": "ISO",
  "expiresAt": "ISO",
  "conversation": [{ "role": "user", "text": "…", "at": "ISO" }],
  "memory": [],
  "lastText": "…",
  "detected": {
    "industry": "Detailing",
    "businessName": "Shine Mobile",
    "location": "Dallas",
    "stage": "startup",
    "intent": "build_business",
    "confidence": 0.91,
    "destination": "business_builder"
  },
  "imports": {
    "website": { "url": "…", "status": "ready|partial|analyzing|detected", "analysis": {} },
    "instagram": { "url": "…", "status": "partial", "analysis": { "handle": "…" } },
    "google_business": null,
    "facebook": null
  },
  "importJobs": [],
  "importProgress": ["Reading services…"],
  "accountId": null,
  "businessId": null,
  "handedOffAt": null,
  "upgradedAt": null
}
```

---

## Lifecycle

| Event | When |
|-------|------|
| **Created** | First `understand()` / `upsertSession()` on Landing (first meaningful typing) |
| **Importing** | URL detected → `startImportPipeline()` calls `/api/import-analyze` |
| **Handed off** | Continue Building / Find someone → `markHandedOff()` + navigate with `?hs=` |
| **Consumed by Builder** | Welcome / Instant Site reads session via `toBuilderPayload()` — **does not re-infer known facts** |
| **Upgraded** | Save My Business / Create Account → `upgradeToAccount({ accountId, businessId })` — session becomes permanent owner memory |
| **Expires** | 30 days after last `updatedAt` (`expiresAt`). Next `loadSession()` deletes it |
| **Deleted** | TTL expiry, corrupt JSON, or explicit `clearSession()` |

---

## Structured handoff (required)

```
Landing upsertSession + import pipeline
  → routeUrl → /signup?q=…&hs=<id>
  → Welcome loads HublySession
  → startInstantSite consumes toBuilderPayload()
  → Discovery applyKnownFacts() + continue conversation
```

Builder receives: conversation, industry, business name, location, stage, intent, confidence, imports (website/instagram/google/facebook), memory.

---

## Import pipeline

| Source | Stage 1 behavior |
|--------|------------------|
| Website | Server fetch HTML → services, branding colors, photos count, reviews signals, phone/email |
| Instagram / Facebook / Google | Structured link + handle/listing queue (`partial`) — deeper vendor import continues in Builder |

UI status lines update live: “Reading services… / branding… / reviews… / photos…”

---

## Account creation (future wiring)

```
Save My Business → Create Account → upgradeToAccount()
  → Hubly Session → Business → Owner → Dashboard
```

Nothing is recreated. The anonymous session becomes the permanent business memory.
