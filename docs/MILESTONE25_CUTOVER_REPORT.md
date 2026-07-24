# Milestone 2.5 — Cutover Report (Founder Sign-Off)

**Purpose:** Single document for founder sign-off before Milestone 3.  
**Rule:** Engineer gates prove wiring. This report proves the **customer** journey on live production.

> Milestone 2.5 is complete only when a brand-new customer can go from hubly.app to a fully launched business without ever realizing there was an old product.

---

## Status legend

| Mark | Meaning |
|------|---------|
| ✅ | Verified on **live hubly.app** by founder |
| 🟡 | Wired in cutover branch / gates — **not yet founder-verified live** |
| ❌ | Failed or old product still appears |
| ⬜ | Not run |

---

## Product surface matrix

| Area | Old Removed | New Live | Verified (live) |
|------|:-----------:|:--------:|:---------------:|
| Landing | 🟡 | 🟡 Welcome at `/` | ⬜ |
| Signup | 🟡 | 🟡 Welcome conversation | ⬜ |
| Discovery | 🟡 | 🟡 Business Conversation | ⬜ |
| Thinking | 🟡 | 🟡 Thinking Canvas | ⬜ |
| Creative Build | 🟡 | 🟡 Collaborative build | ⬜ |
| Reveal | 🟡 | 🟡 Business Reveal | ⬜ |
| Save Business | 🟡 | 🟡 Delayed account | ⬜ |
| Launch | 🟡 | 🟡 Launch Experience | ⬜ |
| Business Home | 🟡 | 🟡 Home (not Dashboard) | ⬜ |
| Creative Workspace | 🟡 | 🟡 Edit with Hubly | ⬜ |
| Advanced Studio | 🟡 | 🟡 Escape hatch only | ⬜ |
| Hubly Daily | 🟡 | 🟡 Morning brief | ⬜ |
| Living Business | 🟡 | 🟡 Evolution + journal | ⬜ |

**Old Removed** = primary path no longer presents the old surface.  
**New Live** = designed surface is what production serves after cutover deploy.  
**Verified** = founder completed the Phase E test on live hubly.app.

When every **Verified** cell is ✅, Phase E can be signed.

---

## Phase E test rollup

| Test | Name | Live result |
|-----:|------|:-----------:|
| 1 | Brand New User (incognito → Home) | ⬜ |
| 2 | Returning User → Business Home + morning voice | ⬜ |
| 3 | Edit Website → Creative Workspace (not old editor) | ⬜ |
| 4 | Ask Hubly — one thread, one partner | ⬜ |
| 5 | “Add arrival windows” → Plan → Preview → Approval → Deploy | ⬜ |
| 6 | Refresh mid-flow — resume | ⬜ |
| 7 | Mobile — same product | ⬜ |
| 8 | Speed — conversation / preview / home | ⬜ |

Detail checklist: [`MILESTONE25_FOUNDER_CERTIFICATION.md`](./MILESTONE25_FOUNDER_CERTIFICATION.md)

---

## Wiring evidence (engineer — not founder done)

| Gate | Result |
|------|--------|
| `npm run milestone1` | See `docs/MILESTONE1_RELEASE_GATE.json` |
| `npm run milestone15` | See `docs/MILESTONE15_RELEASE_GATE.json` |
| `npm run milestone2` | See `docs/MILESTONE2_RELEASE_GATE.json` |
| `npm run check:m25-cutover` | See `docs/MILESTONE25_CUTOVER_PROOF.md` |
| `npm run milestone25` | See `docs/MILESTONE25_RELEASE_GATE.json` |

These can all be green while Phase E is still ⬜. **That is expected.** Do not close the milestone on wiring alone.

---

## Dead code (before delete)

Inventory (no deletes until founder asks):  
[`MILESTONE25_DEAD_CODE_INVENTORY.md`](./MILESTONE25_DEAD_CODE_INVENTORY.md)

| Mark | Count (approx.) |
|------|----------------:|
| Delete candidates | 31 |
| Archive | 10 |
| Still Required (auth / Advanced Studio / ops) | 30 |

---

## Founder decision

| Decision | |
|----------|--|
| ☐ Hold — Phase E not run on live hubly.app | |
| ☐ Hold — one or more Verified cells failed | |
| ☐ **PASS** — all Verified cells ✅ + Phase E signed | → close Milestone 2.5, begin Milestone 3 |

| Field | Value |
|-------|-------|
| Founder | |
| Date (UTC) | |
| Production commit / deploy | |
| Notes | |
