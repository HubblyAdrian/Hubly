# Milestone 2.5 — Production Cutover

**Not integration. Cutover.**

Retire the old product. Launch the one we designed.  
Until a stranger can complete the full journey on hubly.app without seeing old onboarding, old dashboard, or old editor — Milestones 1 / 1.5 / 2 are **not** finished.

```
Pretend you've never seen Hubly before.
Delete every assumption about how the old product worked.
Your job is not to preserve the old UX.
Your job is to make the designed product the only product users experience.
```

---

## Four phases

### Phase A — Merge Everything ✅

Merge onto `main` (not cherry-pick, not copy):

```
Milestone 1 → Milestone 1.5 → Milestone 2 → Milestone 2.5
```

**Release Gate**

| Check | Command |
|-------|---------|
| No merge conflicts | This branch merges `origin/main` cleanly |
| Milestone 1 | `npm run milestone1` |
| Milestone 1.5 | `npm run milestone15` |
| Milestone 2 | `npm run milestone2` |
| Cutover wiring | `npm run check:m25-cutover` |
| Production build | Vercel serves `public/hubly.html` |

### Phase B — Replace Every Old Experience

Do not add the new experience beside the old one.

| Old | New | Cutover action |
|-----|-----|----------------|
| Landing (`platform-home` at `/`) | Welcome Experience | `/` → Welcome; brochure at `/platform` only |
| Signup auth shell | Conversation (Welcome) | `#p-signup` is Welcome only |
| Old onboarding / CD wizard | Discovery → Thinking → Build | Instant Site M2 path; CD is not primary |
| Success / claim screen | Reveal → Save → Launch | M2 steps |
| Dashboard as home | Business Home | `goDash()` → Business Home always |
| Website editor as primary | Creative Workspace | Home “Edit with Hubly” → CW |
| Classic dashboard escape | **Advanced Studio** | CW → Advanced Studio → optional pixel editor |

**Escape hatch (intentional only):**

```
Business Home
  → Edit with Hubly
  → Creative Workspace
  → Need pixel-perfect control?
  → Advanced Studio
```

Users must never accidentally fall into the old experience.

### Phase C — Production Walkthrough

Gates can pass and still fail cutover.

A stranger visits hubly.app and completes:

1. Visit hubly.app  
2. Describe business  
3. Discovery  
4. Thinking  
5. Creative Build  
6. Reveal  
7. Save Business  
8. Launch  
9. Business Home  
10. Edit Website (Creative Workspace)  
11. Hubly Daily  
12. Living Business  

If any step falls back to the old product → **Milestone 2.5 fails.**

### Phase D — Delete Dead Code

No dual products:

- ❌ Old Dashboard + New Home  
- ❌ Old Signup + New Welcome  
- ❌ Old Editor + Creative Workspace as equals  

Yes:

- Business Home  
- Creative Workspace  
- Conversation  
- Hubly Daily  
- Living Business  
- Advanced Studio (escape hatch only)

Archived / removed:

- Root stale `hubly.html` twin (router never served it)  
- Classic dashboard as post-login home  
- Marketing Instant Site skip past Welcome  

---

## Cutover status on this branch

| Phase | Status |
|-------|--------|
| A Merge main into stack | Done on `cursor/milestone25-production-cutover-2662` |
| B Replace experiences | Done in wiring (Welcome `/`, Business Home `/app`, Advanced Studio hatch) |
| C Walkthrough on live hubly.app | **Blocked until this PR merges to `main` and deploys** |
| D Dead code | Root twin removed; old home path retired |

---

## Commands

```bash
npm run milestone1
npm run milestone15
npm run milestone2
npm run check:m25-cutover
npm run milestone25
```
