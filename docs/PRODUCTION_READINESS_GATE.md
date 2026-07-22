# Production Readiness Gate

Shown live in **Hubly HQ → Release Gate**.

Critical checks include AI gateway, publishing, Stripe, calendar, email, jobs, webhooks, Brain validation, and **end-to-end smoke** (`hubly_smoke_runs`).

If `scripts/smoke-release.mjs` fails (or no recent green smoke within 36h), Release Gate deploy level is **blocked** (RED).

```bash
node scripts/smoke-release.mjs
REPORT_SMOKE=1 HUBLY_MISSION_CONTROL_SECRET=… node scripts/smoke-release.mjs
```

## Gate checklist

| Check | Notes |
|---|---|
| AI Gateway healthy | `OPENAI_API_KEY` present |
| Website publishing healthy | Publishing connector/system health |
| Stripe healthy | Connect / webhook health signal |
| Calendar healthy | Google calendar connector signal |
| Email healthy | Resend / notify configured |
| Background jobs healthy | Execution runs |
| Webhooks healthy | Stripe webhook signal |
| Error rate below threshold | Derived from jobs health |
| End-to-end smoke test passed | `smoke-release.mjs` → `smoke_report` |
| Brain Validation | OpenAI production path |
| OpenAI Responses RC | Warning until live benchmark green |
