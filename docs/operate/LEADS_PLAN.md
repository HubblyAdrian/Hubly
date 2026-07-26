# Module 4 — 🧲 Leads · Stage 1 OS

**Branch:** `cursor/operate-leads-2662`  
**Stage in scope:** Stage 1 — Operating System only  
**Locked modules (do not modify):** 🏠 Home · 📥 Inbox OS · 📅 Jobs OS  
**Checklist:** `docs/operate/LEADS_CHECKLIST.md` (Stage 1 complete · Stage 2 deferred)

---

## Implementation

1. `renderLeads` / `handleLeadsAct` in Journey OS — list, workspace, sidebar, filters, add modal.
2. `#v-leads` / `#jos-leads-root` + `switchV('leads')` via `renderLeadsList` alias — Home/Inbox/Jobs untouched.
3. Normalize pipeline.manual + abandoned leads (`ensureLeadsOsState`).
4. Tabs: New / Quotes / Waiting / Lost / AI Qualified.
5. Workspace: Overview, Conversation, Quote, Estimate, Tasks, Notes, Files + lead actions + AI prompts.
6. Search, filter drawer, context menu, permissions matrix, empty/error/responsive CSS.
7. Validator Leads gate + self QA smoke.

## Files

| File | Change |
|------|--------|
| `docs/operate/LEADS_CHECKLIST.md` | Stage 1 ✅ · Stage 2 ⏸ |
| `docs/operate/LEADS_PLAN.md` | This plan |
| `public/journey-os/journey.js` | `renderLeads` + `handleLeadsAct` |
| `public/journey-os/operate-pixel.css` | `.jos-leads-*` styles |
| `public/journey-os/ceo-demo.js` | Enriched leads seed |
| `scripts/check-customer-journey-os.mjs` | Leads gate |
| `docs/operate/MODULE_STATUS.md` | Maturity board |
| `docs/operate/README.md` | Checklist table |

## Next step

Self QA → **MAT** → PR → approval → merge → lock Leads as **🔒 OS** (Stage 2 integrations remain deferred).
