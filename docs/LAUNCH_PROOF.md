# Launch Proof

**Board for Closed Beta.** Evidence only. Inventing frozen.

| Proof | Status | Meaning |
|---|---|---|
| **AI Proof** | ✅ **PASS** | HublyAI → OpenAI Responses live: Build, Creative Director, Website, Storefront Chat, Ask Hubly |
| **Infrastructure Proof** | ✅ **PASS** | Production edges **DEPLOYED 30 / MISSING 0**; required secrets for AI path configured |
| **Revenue Proof** | □ **IN PROGRESS** | Checkout lookup ✅ (`409 not_ready`). Need Connect `charges_enabled` → pay → refund |
| **Scheduling Proof** | □ | Google Calendar OAuth · create / reschedule / cancel (Event IDs) |
| **New Owner Proof** | □ | Brand-new owner: signup → build → launch → first customer → pay → CRM → calendar → Daily |
| **Closed Beta** | □ | Invite metric **Yes** — only when every proof above is PASS |

## Mapping (legacy names)

| Was called | Now |
|---|---|
| Blocker 1 (edges) | Infrastructure Proof |
| Blocker 2 (OpenAI / secrets) | AI Proof |
| Blocker 3 (Stripe revenue) | Revenue Proof |
| Google Calendar E2E | Scheduling Proof |
| Brand-new owner E2E | New Owner Proof |

Historical evidence files may still say `blocker1` / `blocker2` / `blocker3` in filenames — that is archive naming only.

## Current focus

**Revenue Proof** — fix checkout admin client (3A), complete Devdetailing661 Stripe Connect (`charges_enabled`), then one real paid hire + refund with Stripe IDs recorded.

Do not start Scheduling Proof until Revenue Proof is PASS.

## Evidence index

| Proof | Primary evidence |
|---|---|
| AI | `docs/evidence/blocker2-openai-proof-summary.json` |
| Infrastructure | `docs/EDGE_PROBE.md`, `docs/evidence/blocker1-deploy-success.txt` |
| Revenue | `docs/evidence/blocker3-stripe-attempt.md`, `docs/evidence/blocker3a-business-not-found-root-cause.md` |
| Scheduling | `docs/CALENDAR_PROOF.md` (not yet complete) |
| New Owner | `docs/FIRST_CUSTOMER_PRODUCTION.md` (not yet complete) |
