# knob-bind-audit — does a "bound" knob actually MOVE anything?

The design-knob gate decides whether to offer a control by asking "does this knob bind
anything on this page". That question has been answered wrongly three times, each time by
a predicate that sat next to the question instead of on it:

| predicate | said | why it was wrong |
|---|---|---|
| P1 — does `var(--hubly-hero-scale)` appear in the HTML? | 106/106 pages bound | it matched the `[data-hc^="hero"]` rule **we inject** at stamp time. It was measuring its own footprint. |
| P2 — does an element match `[data-hc^="hero"]`? | 106/106 | matching the scope says nothing about whether anything **inside** it carries a wrapped `font-size`. |
| P4 — P1/P3 under jsdom | "nothing moves", for every knob | jsdom's `getComputedStyle` returns `calc(16px * var(--s,1))` verbatim and never resolves it. It cannot tell a working knob from a dead one. **Measured, not assumed.** |
| **P3 — flip the variable, diff the COMPUTED styles** | the truth | it asks the same question the owner does. |

P1 shipped. On 2026-09-02 it told a real owner **"Changed the header size."** over a page
that did not move a pixel. The gate built to enforce *bound is not moved* was caught by
*a passing measurement of the wrong thing*.

**So P3 lives here, permanently.** It needs a real cascade — a browser — for exactly the
reason `hero-fold-audit` next door needs one: the Deno edge runtime has no layout engine,
which is also why the bind counts are now recorded at stamp time rather than re-derived.

## The rule

**If you change the gate, you have to beat this harness.** A knob the gate calls bound must
move ≥1 element; a knob it calls unbound must move 0. `tests/design-knobs-bound-means-moved.test.mjs`
covers the *contract* (what is recorded, what is refused when the record is absent) and runs
in `npm test`; it deliberately does **not** try to check movement, because jsdom cannot.

## Run it

1. Export the corpus. **Re-export every time** — see the rule in `../hero-fold-audit/README.md`;
   a reused export silently measures the past, and it has already bitten twice.

   ```sh
   supabase db query --linked "
     with latest as (
       select distinct on (business_id) business_id, rendered_html
       from business_documents
       where rendered_html is not null and length(rendered_html)>0
       order by business_id, version desc
     )
     select json_agg(json_build_object('slug', b.slug, 'kind', b.account_kind,
                                       'format', 'html', 'html', l.rendered_html)) as data
     from latest l join businesses b on b.id=l.business_id;" \
     | python3 -c "import json,sys; json.dump(json.load(sys.stdin)['rows'][0]['data'], open('corpus.json','w'))"
   ```

2. Prepare (stamps each page with the CURRENT pass, and also builds the stale-stamp case):

   ```sh
   deno run --allow-read --allow-write prepare.ts
   ```

3. Serve and open, then read `window.RESULTS` / call `window.RUN()`:

   ```sh
   python3 -m http.server 8793   # then open http://localhost:8793/audit.html
   ```

## The two populations, and do not confuse them

- **Freshly stamped** — pages stamped in memory by the current pass. This tells you whether
  the pass produces working bindings. It is NOT what production has.
- **Stale-stamped** — pages carrying a `data-hubly-knobs` block written by an OLDER pass, so
  `hasDesignKnobs()` short-circuits and they are never re-stamped. **This is where the bug
  lived**, and a run over freshly-stamped pages structurally cannot see it. `prepare.ts`
  builds this case explicitly.

Measuring only the first is how "all five knobs bind 99–100% of pages" was true and useless
at the same time.

## Widths

Run at **1440 and 390**. A rule inside `@media` still targets elements; whether it wins
depends on the viewport, and an at-rule guard that skipped media bodies once made the image
knob work on desktop and do nothing on a phone.
