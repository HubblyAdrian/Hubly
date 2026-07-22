# Release Status

Facts only. Evidence-backed. Generated 2026-07-22 (Production Proof Mode).

Branch: `cursor/production-proof-mode-2662`  
Separate trackers: `docs/INFRASTRUCTURE_BLOCKERS.md` · `docs/PRODUCT_FAILURES.md`

---

## Architecture

| Status | Evidence |
|---|---|
| **Complete** | Frozen Brain/Runtime/Memory/DNA/Planner/Orchestrator/HublyAI/Connectors in repo. No new architecture in this mode. |

---

## AI Migration

| Status | Evidence |
|---|---|
| **Partial** | HublyAI façades in repo. Live Responses benchmark not run (INFRA: no OPENAI key). |

---

## AI Gateway

| Status | Evidence |
|---|---|
| **Partial** | `generate-site` / creative-director **DEPLOYED** (`docs/EDGE_PROBE.md`). `hubly-ai-status` **MISSING**. OpenAI may be unavailable on edge (“AI generation temporarily unavailable”). |

---

## Website Runtime

| Status | Evidence |
|---|---|
| **Partial** | Code complete; Aquaspeed storefront live. Full publish proof across industries incomplete. |

---

## Business Build

| Status | Evidence |
|---|---|
| **Blocked** | `hubly-build-business` **404** — INFRA-1. Blueprint seeds PASS for 8 industries — PRODUCT report. |

---

## Blueprint Suite

| Status | Evidence |
|---|---|
| **Partial** | 8/12 required industries PASS schema+lifecycle seeds. 4 FAIL (Electrical, Plumbing, Painting, Junk Removal) — **PRODUCT** missing blueprints. `docs/BLUEPRINT_VALIDATION_REPORT.md` |

---

## Booking

| Status | Evidence |
|---|---|
| **Partial** | Aquaspeed booking request succeeds. Accept/pay/complete lifecycle not fully proven live. |

---

## Payments

| Status | Evidence |
|---|---|
| **Blocked** | No `charges_enabled` Connect account — INFRA-3. Checkout/webhook edges **DEPLOYED**. |

---

## CRM

| Status | Evidence |
|---|---|
| **Partial** | Service-role design in git (`hire-crm` + webhook). `hire-crm` **MISSING** in prod — INFRA. Public CRM write fixed in git — site deploy lag INFRA-6. |

---

## Calendar

| Status | Evidence |
|---|---|
| **Partial** | OAuth/push/maintain edges **DEPLOYED**. Google connected business missing — INFRA-4. Busy windows RPC works. |

---

## Hubly HQ

| Status | Evidence |
|---|---|
| **Blocked** | `mission-control` **MISSING** (404). UI+Proof Mode in git. |

---

## Production Proof

| Status | Evidence |
|---|---|
| **Blocked** | Payment + calendar round-trip + build edge blocked by infrastructure. |

---

## Internal Testing

| Status | Evidence |
|---|---|
| **Partial** | Repo smoke GREEN; live edge probe shows 6 MISSING. |

---

## Closed Beta

| Status | Evidence |
|---|---|
| **Not Ready** | INFRA blockers open + 4 missing industry blueprints + no live payment proof. |

---

## Public Launch

| Status | Evidence |
|---|---|
| **Not Ready** | Closed Beta not ready. |

---

## Edge deploy summary

| Deployed | Missing |
|---|---|
| 24 | 6 (`hubly-build-business`, `hubly-daily`, `hubly-ai-status`, `hubly-find-pro`, `hire-crm`, `mission-control`) |

Source: `docs/EDGE_PROBE.md`
