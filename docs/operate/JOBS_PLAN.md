# Module 3 — 📅 Jobs & Calendar · Planning

**Branch:** `cursor/operate-jobs-calendar-2662`  
**Stage in scope:** Stage 1 — Operating System only  
**Locked modules (do not modify):** 🏠 Home · 📥 Inbox OS

---

## Blocker before Development

`docs/operate/JOBS_CHECKLIST.md` Stage 1 items are not filled yet.

**Please paste the official Jobs & Calendar Stage 1 (Operating System) checklist** into that file (or into chat once — it will be written to the repo).

Stage 2 (Google Calendar, live maps, Twilio reminders, etc.) stays deferred until after Stage 1 merge.

---

## Proposed plan (after checklist arrives)

1. Implement `renderJobs` in Journey OS for Jobs & Calendar **OS only**.
2. Wire `#v-jobs` / `#jos-jobs-root` + `switchV('jobs')` without touching Home/Inbox.
3. In-app calendar, job list, route preview, availability, team views as specified.
4. Self QA every button/tab/modal/route; console clean; validator Inbox/Home unchanged except Jobs gate.
5. One PR → wait for approval → merge → lock Jobs Stage 1 OS.

## Expected files (pending checklist)

| File | Change |
|------|--------|
| `docs/operate/JOBS_CHECKLIST.md` | Official Stage 1 items |
| `public/journey-os/journey.js` | `renderJobs` only |
| `public/journey-os/operate-pixel.css` | Jobs styles only |
| `public/hubly.html` | Jobs mount / switchV only |
| `public/journey-os/ceo-demo.js` | Jobs seed if needed |
| `scripts/check-customer-journey-os.mjs` | Jobs gate |
| `docs/operate/MODULE_STATUS.md` | Maturity updates |

## Next step

Provide the **Jobs & Calendar Stage 1 checklist** → status moves to In Progress.
