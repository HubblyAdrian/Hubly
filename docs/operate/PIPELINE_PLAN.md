# Module 6 — 📈 Pipeline · Planning

**Branch:** `cursor/operate-pipeline-2662`  
**Stage:** 1 — Operating System  
**Design System:** HublyDS v1 required (Rule #14)  
**Locked modules (do not modify):** Home · Inbox · Jobs · Leads · Customers OS

## Purpose

Pipeline is the sales engine — not only a Kanban board. It connects:

Lead → Qualified → Quote → Booked → Completed → Review → Membership

Cards open existing surfaces (Leads workspace, golden Customer profile, Jobs, Quotes) — never a second CRM profile.

## Implementation plan

1. Lock Customers OS on maturity board after #248 merge.  
2. Ship Design System v1 + Rule #14.  
3. Replace thin `renderPipeline` with full Pipeline OS using `HublyDS`.  
4. Stages, search, filters, board + detail sidebar, move/stage actions, AI insights.  
5. Validator gate + `mat-pipeline.mjs` + CMV (incl. Customers).  
6. PR → approval → merge → 🔒 OS.

## Expected files

| File | Change |
|------|--------|
| `docs/operate/DESIGN_SYSTEM_V1.md` | DS catalog + Rule #14 |
| `docs/operate/OPERATE_ENGINEERING_RULES.md` | Rules incl. #14 |
| `public/journey-os/design-system.js` | Shared builders |
| `public/journey-os/journey.js` | Pipeline OS (`pipe-*`) |
| `public/journey-os/operate-pixel.css` | Pipeline layout |
| `public/hubly.html` | Load design-system.js |
| `scripts/mat-pipeline.mjs` | MAT |
| `scripts/cmv-locked-modules.mjs` | + Customers |
| `docs/operate/PIPELINE_*.md` | Checklist / plan / MAT |
| `docs/operate/MODULE_STATUS.md` | Board |
