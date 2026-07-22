# Production Readiness Gate

**No release should ship while this gate is red.**

Shown live in **Hubly HQ → Release Gate**.

## Critical checklist

| Gate | Meaning |
|---|---|
| ✅ AI Gateway healthy | HublyAI configured (`OPENAI_API_KEY` and/or Anthropic) |
| ✅ Website publishing healthy | Publish path operational |
| ✅ Stripe healthy | Secrets + webhook processing |
| ✅ Calendar healthy | Google OAuth configured + sync path |
| ✅ Email healthy | Resend configured |
| ✅ Background jobs healthy | Execution run failure rate under threshold |
| ✅ Webhooks healthy | Stripe webhook events flowing |
| ✅ Error rate below threshold | No spike in runtime failures |
| ✅ End-to-end smoke test passed | First Customer production proof + calendar smoke |
| ✅ Brain Validation | Memory/DNA still enter via HublyAI only |

## Deploy policy

| State | Action |
|---|---|
| Any **critical offline/red** | **Block** deploy |
| Critical **warning** | **Warn** — human ack required |
| All critical green | Allow release |

OpenAI Responses transport (PR #184) remains **Release Candidate** until the live capability benchmark is green. Until then, Hubly HQ surfaces a non-blocking warning on the Responses RC row; use `OPENAI_TRANSPORT=chat` to roll back without product redeploy.

## Related

- Hubly HQ UI: `/hq`
- Edge action: `release_health` / `production_gate`
- First Customer proof: `docs/PRODUCTION_PAYMENT_PROOF.md`
- Responses benchmark: `docs/OPENAI_RESPONSES_BENCHMARK.md`
