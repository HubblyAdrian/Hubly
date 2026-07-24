# Milestone 2.5 — Production Cutover

**Not integration. Cutover.**

Retire the old product. Launch the one we designed.

```
Pretend you've never seen Hubly before.
Delete every assumption about how the old product worked.
Your job is not to preserve the old UX.
Your job is to make the designed product the only product users experience.
```

### Definition of done (founder, not engineer)

> Milestone 2.5 is complete **only** when a brand-new customer can go from **hubly.app** to a fully launched business **without ever realizing there was an old product**.

Merge passed and gates green are **necessary but not sufficient**.  
**Phase E — Founder Certification** is the finish line.

---

## Five phases

### Phase A — Merge Everything ✅

```
Milestone 1 → Milestone 1.5 → Milestone 2 → Milestone 2.5
```

| Check | Command |
|-------|---------|
| No merge conflicts | Branch merges with `main` |
| Milestone 1 | `npm run milestone1` |
| Milestone 1.5 | `npm run milestone15` |
| Milestone 2 | `npm run milestone2` |
| Cutover wiring | `npm run check:m25-cutover` |

### Phase B — Replace Every Old Experience ✅

| Old | New |
|-----|-----|
| Landing | Welcome Experience |
| Signup | Conversation (Welcome) |
| Onboarding | Discovery → Thinking → Build |
| Success | Reveal → Save → Launch |
| Dashboard home | Business Home |
| Website editor default | Creative Workspace |
| Classic dashboard escape | **Advanced Studio** only |

```
Business Home → Edit with Hubly → Creative Workspace
  → Need pixel-perfect control? → Advanced Studio
```

### Phase C — Production Walkthrough (wiring) 🟡

Code path supports the stranger journey. **Live verification is Phase E.**

### Phase D — Dead Code Discipline 🟡

Inventory produced — **no mass delete until founder asks**:

- [`MILESTONE25_DEAD_CODE_INVENTORY.md`](./MILESTONE25_DEAD_CODE_INVENTORY.md) — Delete / Archive / Still Required

### Phase E — Founder Certification ⬜ **THE ONLY THING THAT MATTERS**

Live production tests on hubly.app:

1. Brand new user (incognito) — full journey, zero old surfaces  
2. Returning user → Business Home + morning voice  
3. Edit Website → Creative Workspace (not old editor)  
4. Ask Hubly — one thread  
5. “Add arrival windows” → Plan → Preview → Approval → Deploy  
6. Refresh mid-flow — resume  
7. Mobile — same product  
8. Speed — conversation / preview / home  

**Docs:**

| Doc | Role |
|-----|------|
| [`MILESTONE25_FOUNDER_CERTIFICATION.md`](./MILESTONE25_FOUNDER_CERTIFICATION.md) | Tests 1–8 + signature |
| [`MILESTONE25_CUTOVER_REPORT.md`](./MILESTONE25_CUTOVER_REPORT.md) | Sign-off matrix (Old Removed / New Live / Verified) |

Until Phase E is signed on **live hubly.app**, do **not** begin Milestone 3.

---

## Commands

```bash
npm run milestone25          # A–D wiring gates
npm run check:m25-cutover    # cutover wiring only
```

Phase E has no substitute script. It requires a human on production.

---

## Cutover status

| Phase | Status |
|-------|--------|
| A Merge | ✅ |
| B Replace experiences | ✅ |
| C Walkthrough wiring | 🟡 |
| D Dead-code inventory | 🟡 (report ready; deletes pending) |
| E Founder Certification | ⬜ **blocked on live hubly.app** |
