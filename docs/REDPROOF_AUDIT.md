# The red-proof audit — the checks we have ruled from

**Run:** `node scripts/audit-redproofs.mjs` · `--list` · `--only=<check>` · `--tier=fast|slow`
**Date:** 2026-09-14 · **Ruled:** red-proof only the checks we have actually ruled from.

A check's green is worth exactly what its red is worth. Fifteen checks were the evidence for a
DECISION this week — a fix ruled done, a defect ruled absent, a number quoted. The harness
breaks the thing each one asserts, **in the real file**, and requires the check to say so.

**Result: 15 of 15 red-proved.** Four were passing for the wrong reason and are fixed. Two were
RED on main before the audit began, and both were real.

---

## 1. Two defects found by RUNNING them, before any mutation

| check | what it said |
|---|---|
| `check-owner-id-invariant` | **`website.moveSection` was dead for every claimed owner.** Wired 2026-09-13, it reads the injected owner and was never added to `DRAFT_INJECTED_ACTIONS` — so it saw `null` and every move was refused on a claimed business, the only kind whose owner is signed in and moving sections. Third time this exact omission has shipped (`places.add`, `business.setHours`, this). Fixed `81a48c8`, deployed. |
| `check-denominator-rule` | **Two rates in `measure-fragment-links.mjs` printed with no `account_kind` split** — mine, written the same week the rule was enforced. Both now go through `rateLine()`, one denominator item per clickable link so a single page with forty links cannot read as a corpus rate, and fixtures dropped before anything is counted. |

Neither needed a mutation. They needed someone to run the check.

## 2. Four were passing for the wrong reason

### `check-one-voluntary-addition` — a text match, not a decision
Leg 1 matched the string `hcVoluntary > 0) return false` inside the gate's body. The audit put
`return true;` at the top of the gate — short-circuit line still present, now unreachable — and
it stayed green. **The gate is now extracted and EXECUTED** against four states (slot free ·
slot taken · last thing said was a question · nothing said). A text assertion about a line is
not an assertion about a decision.

### `check-destructive-confirm` — a comment counted as a call
The test was `span.includes("refuseIfClassicSite(")`, and every call site carries the comment
`// THE CLASSIC-SITE GATE — see refuseIfClassicSite().` Renaming the real call left it green:
it was reading the comment that points at the gate. **Comments and strings are now stripped and
an invocation is required** (`await gate(` / `= gate(`). An action whose gate was deleted while
its explanatory comment survived would have passed.

### `check-no-directives-to-owners` — a regex that lost half the file, and a rule with no check
The scan was ``/`([^`]{20,500})`/g``, which pairs backticks in document order. **One nested
template anywhere flips the parity of everything after it**, so half the module's sentences were
read as the gaps *between* literals. Proved by appending a sentence that the scanned-sentence
count went UP for and no net saw. Single- and double-quoted strings were never scanned at all.
**Replaced with a lexer** (comments, all three quote styles, escapes, `${}` nesting), with the
parity trap and a double-quoted directive as permanent fixtures.

**And the gap it opened:** the mutation was `Click the Publish button in the top right` — and
**"Hubly never points at a control it cannot see" had no check anywhere in the repo.** A hard
CLAUDE.md prohibition, enforced by nothing. It is now **net 3** over the same sentences. No
existing sentence violates it; the rule was being followed and merely unguarded.

### `check-two-store-readers` — a marker satisfied by a label
The classic store's marker was the substring `/service_catalog/`. The reader SELECTS the literal
`'meta.service_catalog'` as its `source` column — so **the store's name is present in a reader
that has stopped reading it**, and two successive mutations left it green. **Every marker is now
an access path** (`(b.meta::jsonb)->'service_catalog'`, `from public.settings_business_hours`):
something that appears only when the store is actually read. A check satisfied by a label is
satisfied by a lie about where a row came from — the very defect it exists to catch, one level up.

## 3. Five "stayed green" verdicts were MY error, not the check's

Recorded because a false accusation against a check costs the same as a false green: someone
stops trusting an instrument that was working.

| check | my mutation | why it proved nothing |
|---|---|---|
| `check-paginated-aggregate` | summed a `.from().select()` | scoped, on purpose, to the three paginated **rpc** readers |
| `check-computed-and-dropped` | a bare `const verifiedPlaced` | leg 1 is `…Counts/Results/Totals/Stats` objects, leg 2 functions that await a **placer** |
| `check-denominator-rule` | a fixture printing a rate | in scope means **reads the corpus**; the fixture mentioned neither `businesses` nor `account_kind` |
| `check-capability-reachable` | renamed an **action** | the unit is the capability **group** (`name` + `actions`) |
| `check-destructive-confirm` | guessed the gate's name | it is `refuseIfClassicSite`; the harness threw rather than reporting a verdict, which is correct |

**And four mutations hit a COMMENT rather than code** — the comment naming `refuseIfClassicSite`,
the two `p_owner_id:` mentions explaining the rule, the header line naming `composeServicesTruth`,
plus an SQL `--` line. `swapInCode` / `swapAllInCode` now mask comments before finding an anchor.
The symmetry is the finding: **I read a comment as code four times, and found a check doing exactly
the same thing.**

## 4. One gap recorded and NOT closed

**`browser-rig`'s click witness has no assertion of its own.** Making `landed` always `1` left
every assertion green: 2c ("a covered control does not report a landed click") is satisfied by
Playwright's own actionability error before the rig's `window.__rigClicked` counter is ever read.
The witness is the thing that catches a click that lands nowhere while the browser reports
success — and nothing tests it. The check is red-provable through the settle loop instead
(assertions 3/3b/3c), which is what the mutation now breaks. **Naming it rather than pretending
it is covered.**

## 5. What is NOT in this audit

The ruling was to red-proof the checks **we have ruled from** — not all 109. The other 94 are
unaudited, and a green from one of them is worth what its red is worth, which nobody has measured.
Adding a check to the ruled-from set means adding it to `SET` in `scripts/audit-redproofs.mjs`
with the ruling it gated and a mutation that breaks what it asserts.
