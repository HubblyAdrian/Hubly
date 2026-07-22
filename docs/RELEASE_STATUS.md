# Release Status

Facts only. Evidence-backed. Updated 2026-07-22 — **Release Candidate mode entered**.

**Mode doc:** [`docs/RELEASE_CANDIDATE.md`](./RELEASE_CANDIDATE.md)  
Branch: `cursor/production-proof-mode-2662`  
Separate trackers: `docs/INFRASTRUCTURE_BLOCKERS.md` · `docs/PRODUCT_FAILURES.md` · `docs/GO_LIVE_CHECKLIST.md`

---

## Release Candidate

| Status | Evidence |
|---|---|
| **Entered** | Vision, architecture, philosophy, Build partner experience, Living Blueprints — complete in product. Inventing frozen. Allowed work: Infrastructure · Production Proof · Bug Fixes only. |

**Invite metric today:** **No** — would not confidently invite the next waitlist person.  

**Launch Proof board:** [`docs/LAUNCH_PROOF.md`](./LAUNCH_PROOF.md)

| Proof | Status |
|---|---|
| AI Proof | ✅ PASS |
| Infrastructure Proof | ✅ PASS |
| Revenue Proof | □ IN PROGRESS |
| Scheduling Proof | □ |
| New Owner Proof | □ |
| Closed Beta | □ |

---

## Product philosophy (frozen)

**Living Blueprints** — knowledge is the moat.  
Official files are a quality starting point, not the goal.  
Path: Official/AI Generated → Owner edits → Behavior → Bookings/Reviews/Revenue → Improves → Community Learned / Hubly Optimized → Promote to Official.

**Business Partner feel** — Hubly is not software waiting for instructions. Constitution: `docs/HUBLY_CONSTITUTION.md`.

Blueprint Source: Official · AI Generated · Hybrid · Community Learned · Hubly Optimized

---

## Architecture

| Status | Evidence |
|---|---|
| **Complete (frozen)** | Brain / Runtime / Memory / DNA / Planner / Orchestrator / HublyAI / Connectors. No new layers in RC. |

---

## AI Migration / Gateway

| Area | Status | Evidence |
|---|---|---|
| HublyAI façades | **PASS** (live) | CD / site / chat / Ask Hubly **200** via gpt-5.5 Responses |
| `generate-site` / creative-director | **PASS** | **200** after key rotate + json_object input fix |
| `hubly-ai-status` | Deployed | diagnose + jsonMode **200** |

---

## Website Runtime / Business Build

| Area | Status | Evidence |
|---|---|---|
| Website Runtime | Partial | Aquaspeed live; AI Review Pass in git (`website-ai-review.js`) |
| Business Build | Partial | Living Blueprint path in git; `hubly-build-business` **DEPLOYED** (400 validation); E2E not proven |
| Blueprint suite | Pass (repo) | 12/12 can build — `docs/BLUEPRINT_VALIDATION_REPORT.md` |

---

## Hubly HQ

| Status | Evidence |
|---|---|
| **Partial in prod** | `mission-control` **DEPLOYED** (401). `/hq` still serves owner shell — HQ UI not live. |

---

## Booking / Payments / CRM / Calendar

| Area | Status | Evidence |
|---|---|---|
| Booking | Partial | Aquaspeed request ok |
| Payments | Blocked | No `charges_enabled` Connect — INFRA-3 |
| CRM | Partial | `hire-crm` DEPLOYED; owner-session CRM write not proven |
| Calendar | Partial | Edges deployed; needs owner OAuth — INFRA-4 |

---

## Closed Beta

| Status | Evidence |
|---|---|
| **Not Ready** | INFRA blockers open. Product experience complete in git; production proofs incomplete. |

---

## Public Launch

| Status | Evidence |
|---|---|
| **Not Ready** | Closed Beta not ready. |

---

## Edge deploy summary

| Deployed | Missing |
|---|---|
| 30 | **0** (Blocker 1 cleared 2026-07-22T21:54Z) |

Source: `docs/EDGE_PROBE.md` (2026-07-22)

---

## Launch metric

Success = businesses launched · customers booked · payments processed · reviews collected · owners who say:

> I told Hubly about my business and it built my company.

---

## RC rule

No UX redesigns. No philosophy changes. No AI improvements. No architecture. No V2.

Clear blockers with evidence. Then invite.
