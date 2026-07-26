# Module 3 — 📅 Jobs & Calendar · Stage 1 OS

**Branch:** `cursor/operate-jobs-calendar-2662`  
**Stage in scope:** Stage 1 — Operating System only  
**Locked modules (do not modify):** 🏠 Home · 📥 Inbox OS  
**Checklist:** `docs/operate/JOBS_CHECKLIST.md` (Stage 1 complete · Stage 2 deferred)

---

## Implementation

1. `renderJobs` / `handleJobsAct` in Journey OS — calendar, jobs list, route, availability, team, workspace.
2. `#v-jobs` / `#jos-jobs-root` + `switchV('jobs')` — Home/Inbox untouched.
3. Hubly-data calendar (day/week/month/agenda), drag reschedule, resize duration, status colors.
4. Job workspace: overview, checklist, photos, notes, products, invoice, timeline + job actions.
5. Search, filters, bulk actions, metrics, AI prompts, notifications, loading/empty/error, responsive CSS.
6. Validator Jobs gate + self QA smoke.

## Files

| File | Change |
|------|--------|
| `docs/operate/JOBS_CHECKLIST.md` | Stage 1 ✅ · Stage 2 ⏸ |
| `public/journey-os/journey.js` | `renderJobs` + `handleJobsAct` |
| `public/journey-os/operate-pixel.css` | Jobs styles |
| `public/hubly.html` | Jobs mount / switchV |
| `public/journey-os/ceo-demo.js` | Jobs/team seed |
| `scripts/check-customer-journey-os.mjs` | Jobs gate |
| `docs/operate/MODULE_STATUS.md` | Maturity board |

## Next step

PR → approval → merge → lock Jobs as **🔒 OS** (Stage 2 integrations remain deferred).
