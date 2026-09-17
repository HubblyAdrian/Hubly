# The documented examples, ranked by what being wrong would cost

> *"Rank them by how much each would change what I build if it turned out wrong. Top = where being
> wrong costs most."* — Adrian, 2026-09-17

**The ranking is by CONSEQUENCE, not by confidence.** A shaky number that changes nothing sits below
a well-established one that a month of work rests on. Each row says how the claim was established —
**measured** (a query or a driven surface), **stated** (a person said it), or **unverifiable** — and
what specifically would have to be false.

---

### 1. `account_kind = 'market'` means a real outside business — N = 10, confirmed 4
**Established: measured, and the derivation is one string match.** `docs/MARKET_DENOMINATOR.md`.

**If wrong, everything above it moves.** Every priority, every "is anyone using this", every
decision about what to build next is a judgement over these ten rows. The derivation is a trigger
matching five email patterns; `owner_identified` is false for six of the ten, which is our own column
saying *we have not confirmed who this is*. **It has already been wrong once in this exact way** —
the lugnuts alarm read a row as a person (Lesson 96) — and once before that, when the trigger
promoted unrecognised signups to the flattering value.

**Top of the list because it is the denominator of every other claim here.** If the honest N is 4
rather than 10, half of what looks like adoption is us.

---

### 2. Classic is a supported path — four market businesses serve from `businesses.meta`
**Established: stated by Adrian on 2026-09-16, and measured — the four `owner_identified` businesses
have ZERO freeform page versions.**

**If wrong, it is the biggest wasted-work item on the list.** Everything new has to work on both
paths: quoted offers, buttons, the union readers, the drift check. If classic were in fact retiring,
half of that doubling is waste. And in the other direction — which is the live risk — treating it as
legacy silently drops our four confirmed customers out of every sweep. **That already happens:**
`check-page-facts-are-this-business` reads only `business_documents`, so those four are not scanned
for publishing a stranger's phone number at all (the confirmed L97 candidate).

---

### 3. A page rebuild would discard 403 of 623 patched versions — RE-DERIVED: 460 of 648
**Established: MEASURED 2026-09-17, because a scar note is a memory of a measurement and quoting it
instead of re-running it is how "zero public bookings" survived for months while the answer was 17.**

```
select count(*), count(distinct business_id), sum((version > 1)::int) from business_documents;
-- 648 versions · 188 businesses · 460 above version 1 · 2026-08-10 → 2026-09-17
```

**The claim holds and the numbers have moved: 460 of 648, not 403 of 623.** Same shape, 57 more
versions and 25 more of them patched — which is what two more weeks of owners editing their pages
looks like. The prohibition it supports is unchanged and better supported than when it was written.

**If wrong, it is load-bearing for a prohibition.** "No rebuild" constrains every page fix into a
targeted patch, which is slower and harder. If the real figure were small, the cheapest repair for
several open findings — the mailto links, the saltmarsh phone — becomes available. It was **exactly the shape of the "zero public bookings"
claim that turned out to be 17** — a number quoted from a scar note, never re-counted — which is why
it was re-run rather than repeated. It stays third because the CONSEQUENCE is unchanged: had it come
back small, the cheapest repair for several open findings (the mailto links, the saltmarsh phone)
would have become available, and it did not.

---

### 4. "Hubly records ~40% of facts overheard, ~80% of facts it asked for"
**Established: measured once, in a live test on 2026-08-23. N not restated. Never re-measured.**

**If wrong, the ask-first architecture loses its justification.** This one pair of numbers is why
every fact must be reached by an explicit question, why the one-ask-at-a-time rule exists, and why
"the ask is not done until the capture is confirmed". That is a lot of interaction design resting on
a single measurement from three weeks ago, before extraction was rewritten. **The ratio is probably
still directionally right and the absolute numbers are probably stale** — and the design only needs
the direction, which is why this is fourth rather than first.

---

### 5. The record/page disagreement rate: 4 of 208, all test
**Established: measured today (`scripts/measure-record-vs-page.mjs`).**

**If wrong, a bulk-correction pass gets built that nobody needs — or is not built when it is.** The
first run of that script said SEVEN contradicted phones and four were epoch-seconds timestamps read
as phone numbers. The corrected 4 is low enough that the answer is "fix four records by hand", and if
it were 40 the answer would be a pass. **The caveat that could still move it is stated in the script:
a page stating a fact in a form the matcher does not know counts as a disagreement**, and the forms
are the ones we have already seen.

---

### 6. "8 mailto: links, none on classic" — and the premise handed to me was wrong
**Established: measured today over both stores.**

**Low consequence, and it is here because the CORRECTION is the useful part.** The framing was "9
links, on classic, with the freeform path banning them", and all three parts are wrong: 8, none
classic, and the ban is in the AST validator only — while `hubly_contact.ts` *emits* mailto anchors
at two places. If the premise had been acted on, the work would have been aimed at a store that has
none of them. **It changes almost nothing about what gets built, and it changes where.**

---

### 7. The 20 single-instance check candidates
**Established: swept today, 3 verified by use — 1 confirmed, 2 rejected.**

**Lowest consequence of the real items, because it is a candidate list and it says so.** The cost of
being wrong is a wasted afternoon extending a check that was correctly scoped. The one confirmed
finding (row 2 above) is already counted there. **The more useful measurement was the negative:** the
two shells share exactly TWO function names out of 2008 and 408, so no name-matching audit can find
the two-of-everything hazard — which means this list will never contain the instances that matter
most.

---

## The two that are NOT on this list, and why

- **"Hubly has never received a public booking."** Not ranked because it is **known false**:
  `booking_requests` holds 17 rows, counted 2026-09-05. It is named here so it is never re-quoted.
- **The 2026-09-15 "nine businesses quote a price the page never shows."** Known false, real answer
  zero. Named for the same reason, and because its mechanism — two detectors sharing a broken
  formatter — is the mechanism that nearly produced row 5 today.
