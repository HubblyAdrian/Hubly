# D — what the job matcher does today

**Measured 2026-09-15, before a line was changed.** Nothing in this document is a fix.

## The transcript

```
owner: change the driveway job to 3 PM
Hubly: I couldn't find a job matching "driveway job." Which job do you mean?
owner: change the driveway to 3 PM
Hubly: (worked)
```

He has **one** job and it was printed three lines above.

## The matcher, verbatim

`supabase/functions/_shared/hubly_capability_registry.ts`, `business.updateJob`:

```js
const needle = which.toLowerCase();
const words = needle.match(/[a-z0-9]{3,}/g) || [];
const hit = (j) => {
  const hay = [j.customer_name, j.service_name, j.address].filter(Boolean).join(" ").toLowerCase();
  if (!hay) return false;
  if (hay.includes(needle)) return true;                       // whole phrase as a substring
  return words.length > 0 && words.every((w) => hay.includes(w));  // else EVERY word, ≥3 chars
};
```

## What it actually does — run, not read

The shipping predicate over plausible haystacks for one driveway job:

| `which` | tokens it requires | result against every haystack |
|---|---|---|
| `driveway job` | `driveway`, **`job`** | **no match** |
| `the driveway job` | **`the`**, `driveway`, **`job`** | **no match** |
| `driveway appointment` | `driveway`, **`appointment`** | **no match** |
| `my driveway booking` | `driveway`, **`booking`** | **no match** |
| **`the driveway`** | **`the`**, `driveway` | **no match** |
| `driveway` | `driveway` | match |

**The cause is `words.every`.** Every token of ≥3 characters must appear in the haystack, and the
haystack is only `customer_name + service_name + address` — which never contains the word "job",
because "job" is **our** noun for the row, not a word in it.

**Worse than reported, and this is the part that matters: `the driveway` fails too.** `the` is three
characters, so it is a required token. Adrian's successful rephrase — bare `driveway` — is the
**only** one of the six natural phrasings that works. A stopword and a category noun are the same
bug, and a list of "our nouns" that omits articles would have fixed five of six and left the most
natural phrasing broken.

## (b) and (c): the sentence he got came from the wrong branch

Two refusal branches exist, and **the correct one was not the one that fired.**

- **`ambiguous`** (2+ matches) — *already correct today.* It names up to four candidates.
- **`no_match`** (0 matches) — what fired:
  > `Nothing on this business matches "${which}". Say which job they mean; do not guess one.`

That is a **disambiguation question asked with zero candidates.** It names nothing, because there is
nothing to name, and it asks him to choose between an empty set. It also does not tell him what he
*does* have — which, with one job printed three lines above, is the whole answer.

So Adrian's reading is right and the location is precise: **the rule "an ambiguous name is refused
with the candidates named" was never violated by the ambiguous branch — the no-match branch asked
the ambiguous branch's question without its evidence.** (c)'s fix — making "name the candidates" a
*precondition* of refusing — is what makes that state unreachable by construction, rather than a
second sentence to remember to write.

## What is NOT measured here, and why

**His actual row.** The database went into scheduled maintenance at ~21:40Z (`503 … estimated
completion Tue, 15 Sep 2026 21:45:00 GMT`) before I could read the real `customer_name` /
`service_name` / `address` for the driveway job. So the haystacks above are *plausible*
reconstructions, not his record.

**This nearly became a false report.** Two queries returned empty output, and the obvious reading
was "there are no driveway jobs." The empty reader was telling me about **itself** — a 503, not an
absence (Lesson 86). The measurement above stands regardless, because it is a property of the
matcher and not of his row: **no haystack containing "driveway" can match `driveway job`**, since
the required token `job` is not in any of the three fields the matcher reads. The row would change
which haystack applies; it cannot change the outcome.

**What the row WOULD change:** whether he has exactly one job (his report says one; the count is
unverified until the DB is back), and therefore whether the correct behaviour on the fixed matcher
is "act and name what you acted on" or "ask, with candidates".
