# D — the matching rule, for your ruling before it ships

**Nothing is shipped. This is the rule and what it does to all six phrasings.**

## The rule, in one sentence

**A word matters here in proportion to how few of the business's own rows contain it, and a
candidate's score is its single best-discriminating word — not the sum, and not all-of-them.**

```
for each query word w:
    df = how many of THIS business's rows contain w
    if df == 0:  ignore w entirely        ← "job", "the", "appointment", "booking" die here
    weight = 1 / df                       ← rarer = more discriminating
row.score = MAX(weight of each w the row contains)
candidates = every row within a whisker of the best score
```

**No stopword list. No noun list.** That was your ruling and it is the right one — a list of "our
nouns" would have repaired five of six phrasings and left `the driveway` broken, and it would have
been the twelfth hand-maintained set in Lesson 87. `job` scores nothing because it appears in none
of his rows; `the` scores nothing by the **same mechanism**, not by a second rule. The set is
derived from the rows it describes, which is shape (1) of the Lesson 87 fix.

**Why MAX and not SUM — and this caught a defect in my own first version.** Summing lets two weak
words outvote one strong one. With rows `Driveway wash` and `The job`, the query `the driveway job`
scored *The job* 2.0 (`the` + `job`) against *Driveway wash* 1.0, and **acted on the wrong row.**
MAX makes that a tie, and a tie is a question. Changing the wrong job is worse than asking.

## All six phrasings, run

**His case — one job, `Adrian / Driveway wash`:**

| `which` | today | the rule |
|---|---|---|
| `driveway job` | **none** | **act** — Driveway wash |
| `the driveway job` | **none** | **act** — Driveway wash |
| `driveway` | act | act — Driveway wash |
| `the driveway` | **none** | **act** — Driveway wash |
| `driveway appointment` | **none** | **act** — Driveway wash |
| `my driveway booking` | **none** | **act** — Driveway wash |

Six of six, against one of six today.

## The adversarial corpus — the cases that must not regress

| corpus | every phrasing does | correct? |
|---|---|---|
| two jobs, one a driveway | **act** on Driveway wash | yes |
| **two driveways** (wash + seal) | **ask**, naming both | yes — this is the case that must not become a coin flip |
| three identical `Driveway wash` rows | **ask**, naming all three | yes — the word discriminates nothing, so it cannot decide |
| a row literally named **`The job`** | `driveway job`, `the driveway job`, `the driveway` → **ask** (both named); `driveway` → act | yes, and only because of MAX |
| **no driveway at all** | **none** | yes — and (c) makes this say what he *does* have |

## (c) — naming the candidates as a precondition

Today two branches exist and **the wrong one fired**: `ambiguous` (2+) is already correct and names
up to four; `no_match` (0) borrowed its *question* without its *evidence* — "Say which job they
mean", with nothing to choose between and no word about what he has.

The fix is structural, so zero and one are unreachable by construction:

- **The refusal takes the candidate list as an argument and refuses to compose without it.** A
  refusal with fewer than two candidates cannot be built.
- **1 candidate → act**, and name what was acted on.
- **0 candidates → a different sentence entirely, and it is not a question.** It says there is no
  match *and says what he does have* — with one job on the books, that is the whole answer:
  > *"Nothing here matches "driveway job". The only job you have is Driveway wash on Sept 17 — did
  > you mean that one?"*
  >
  > (and with several: *"…The jobs you have are X, Y and Z."*)

## What I have NOT verified

- **His real row.** Still unread — the database was in a maintenance window (`503`, completion
  21:45Z) when D was measured. The table above uses plausible reconstructions; the rule's behaviour
  is a property of the scoring, not of his row, but **which** line it lands on is not confirmed.
- **Nothing is wired.** This rule exists only in a scratch harness. No change to
  `hubly_capability_registry.ts` yet, per your instruction to bring the rule first.
- **Adrian has walked none of today's work** since the envelope fix went live.
