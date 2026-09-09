# Every invented value on the owner home — listed before anything is deleted

Read-only inventory, 2026-09-08. **Nothing has been changed.** The deletions ship with the
greeting, once the fingerprint gate is green.

## First, a correction to the premise

**The fabrications are not on the new home.** `platform-home.html`'s `hcRenderHome()` — the
front door an owner actually lands on, the one `booking-notify` now points at — contains
**none of them.** Everything it renders is derived: the greeting name from `businesses`, the
event counts and cards from `get_business_events`, the gap suggestions from
`get_my_site_gaps` (real empty fields only). Its four `spark` matches are a decorative ✦
glyph and an SVG icon, not a chart.

Every item below lives in **`public/journey-os/journey.js`**, rendered by `enhanceDashboard()`
into `hubly.html`'s `v-dashboard` — the **/app** dashboard, the shell now deprecated by
disuse. That matters for the plan: "the greeting replaces the card wall" describes a screen
the new front door has already replaced. The card wall is still reachable at `/app`.

---

## The list

### 1. The Business Score — an empty business scores 72

`journey.js:homeScores()`, rendered by the `biz-score` card (`journey.js:15535`).

```js
var rating   = Number(S().website?.reviewRating || 4.9);
var revenue  = Math.max(55, Math.min(99, 70 + Math.min(25, done * 2)));
var reviews  = Math.max(50, Math.min(99, Math.round(rating * 18)));
var marketing= Math.max(48, Math.min(96, 62 + Math.min(20, leads)));
var leadResp = Math.max(45, Math.min(98, 88 - Math.min(30, pending * 4)));
var membership = Math.max(40, Math.min(97, 50 + members * 8));
var overall  = Math.round((revenue + reviews + marketing + leadResp + membership) / 5);
```

For a business with **nothing** — no jobs, no leads, no members, no reviews:
`revenue 70, reviews 88, marketing 62, leadResp 88, membership 50` → **overall 72**.

Three separate inventions stacked:
- **Every sub-score has a floor** (55, 50, 48, 45, 40). Zero activity cannot produce a low
  number, so the score cannot say "nothing is happening".
- **`reviewRating` defaults to 4.9** when absent. A business with no reviews is scored as
  though it has 4.9 stars — the single most dishonest line on the screen.
- **`revenue` is not revenue.** It is `70 + completed_job_count * 2`, capped. The label says
  revenue; the input is a count.

The card's own caption compounds it: *"0–100 from response, reviews, website, bookings,
retention, growth, and missed opportunities"* — naming seven inputs, none of which are the
five variables above.

**What it would say instead:** nothing. There is no honest score, because there is no
measurement behind it. Delete the card and the function.

### 2. The revenue sparkline — 5 of its 7 points do not exist

`journey.js` (~line 15253):

```js
var sparkRev = [yestRev*0.7, yestRev*0.85, yestRev, todayRev*0.6, todayRev*0.8, todayRev*0.9, todayRev]
```

Two real numbers (yesterday, today) inflated into a seven-point trend with invented
coefficients. The shape of the line is decoration — it always rises into today.

**What it would say instead:** the two real figures as figures, or nothing.

### 3. `sparkSvg()` draws a hardcoded trend when given no data

`journey.js:sparkSvg(vals, color)`:

```js
vals = vals || [12, 18, 14, 22, 20, 28, 26];
```

Any caller that passes nothing gets a pleasant upward curve made of constants. This is the
generator behind the class, not just one instance — deleting a caller leaves it able to
resurface elsewhere, which is exactly what happened between the journey screen and this one.

### 4. The schedule-gap prompt invents the gap in demo mode

`journey.js:15073`:

```js
if (ctx.gapHours >= 2 || demo) {
  var gap = ctx.gapHours || (demo ? 3 : 0);
```

With `demo` true and no real gap, it asserts *"Tomorrow's schedule has a 3-hour gap"* and
offers to fill it. `demo` is `allowDemoSeed()` — `S()._ceoDemo` or the globals
`__HUBLY_MAT__` / `__HUBLY_ALLOW_DEMO_SEED__`. Not owner-reachable today, but it is one
flag away from telling an owner about a gap in a day with no appointments.

### 5. Hardcoded review platforms — connected, 32 reviews, 4.9 stars

`journey.js:4144`:

```js
google:   { connected: true, reviews: 32, rating: 4.9, lastSync: '2h ago' },
facebook: { connected: true, reviews: 14, rating: 5.0, lastSync: '2h ago' },
```

Asserts a **connected Google integration that does not exist anywhere in the codebase** —
there is no Places/Maps/`place_id` call in `supabase/functions`, and `review_submissions`
holds 0 rows. `connected: true` and `lastSync: '2h ago'` are unearned checkmarks in the
literal sense of prohibition 2.

**This is why Stage C's greeting must not mention reviews** — the data it would draw on is
this.

### 6. The one neither of us listed: 20 demo fixtures reachable from the same file

`grep -c "demo_"` in `journey.js` = **20** — named people with phone numbers and emails
(`demo_james`, "James Anderson", `(619) 555-0188`, `james.anderson@email.com`). Same
`allowDemoSeed()` gate as #4.

These are not currently rendered to an owner, so they are **not** in the delete-now set —
but they are the same hazard as #4 sitting behind the same flag, and a demo customer that
reaches a real screen is indistinguishable from a real one. Worth a decision, separately.

---

## Proposed action, for the deletion pass

**Delete the generators, not the output** — the whole point, since hiding a call leaves the
generator able to resurface:

| delete | reason |
|---|---|
| `homeScores()` and the `biz-score` card | no measurement behind any of the five inputs |
| `sparkRev` construction | 5 of 7 points invented |
| `sparkSvg()`'s `vals \|\| [12,18,…]` default | the generator behind the class |
| the `\|\| demo` branch and `(demo ? 3 : 0)` in the gap prompt | invents the gap it warns about |
| the hardcoded `platforms` block | asserts an integration that does not exist |

**Not deleted, flagged instead:** the 20 `demo_` fixtures (#6) — same flag, wider blast
radius, and a decision rather than a cleanup.

## Open question for the ruling

All of this is on **/app**, which is deprecated by disuse and which `booking-notify` no
longer points at. Two defensible readings:

1. **Delete the generators anyway** — the screen is still reachable, an owner can still land
   on it, and a fabrication that only *some* owners see is still a fabrication.
2. **Delete /app's dashboard entirely** — a bigger change that removes the surface rather
   than its inventions.

I recommend (1) now and (2) as a separate decision, because (1) is bounded and reversible
and (2) is a deprecation step that deserves its own before/after.
