# hero-fold-audit

An **on-demand** tool (not a service, not a scheduled job) for measuring generated-page
layout across the stored corpus.

## RULE: re-export the corpus before EVERY run

Re-pull `corpus.json` from the database at the start of every sweep. Never reuse an old
export. **New pages are the most diagnostic ones** — they are the only pages produced by
the *current* prompt, and they are exactly the ones a stale export omits. On 2026-08-23 a
sweep ran on a 106-page export while the DB had 108; the two missing pages were the two a
human was staring at, missing *because they were new*. A stale corpus quietly measures the
past. After exporting, verify the count matches
`select count(distinct business_id) from business_documents where rendered_html is not null`.

## Signatures this sweep measures

Run every signature at BOTH 1440 (desktop) and 390 (phone) and report counts separately —
a signature that fails at one width only is the most useful thing the sweep can tell you
(min-content collapse is desktop-only; page horizontal-overflow is phone-only).

- **CTA above the fold** — is the primary hero action fully visible on first load.
- **CTA text contrast** — nav/hero button text vs its resolved background (computed styles).
- **Squeezed / min-content columns** — a text column collapsed to ~one-word width inside a
  multi-column grid/flex (canvas-measure longest word vs available width). Desktop-only class.
- **Body-copy negative letter-spacing** — negative `letter-spacing` on paragraphs/li/leads
  (NOT display type, which is a style choice). Static; run `letter-spacing-check.py`.
- **Page horizontal overflow** — document wider than the viewport.

The earlier hero-specific measures (nav→hero gap, headline height as a share of the hero)
also live here.

It exists because there is **no server-side way** to check "CTA above the fold": the fold
is a layout fact (fonts, wrapping, image sizes, viewport) and the Deno edge runtime has no
layout engine. The only real check is rendering in a browser. This renders each stored
`rendered_html` in an iframe at a fixed viewport and measures the DOM.

If we find ourselves running this weekly, that's the signal to revisit and build something
real. Until then it's a script you run by hand.

## Run it

1. Export the corpus (latest doc per business) to `corpus.json` in this folder.
   **Re-run this export EVERY time — the corpus is live and grows.** A reused
   `corpus.json` silently undercounts: on 2026-08-23 a sweep ran on a 106-page export
   while the DB already had 108, and the exact page a human reported broken
   (`sebastian-flight-instruction`, created that day) was simply not in it.

   ```sh
   supabase db query --linked "
     with latest as (
       select distinct on (business_id) business_id, rendered_html
       from business_documents
       where rendered_html is not null and length(rendered_html)>0
       order by business_id, version desc
     )
     select json_agg(json_build_object('slug', b.slug, 'html', l.rendered_html)) as data
     from latest l join businesses b on b.id=l.business_id;" \
     | python3 -c "import json,sys; json.dump(json.load(sys.stdin)['rows'][0]['data'], open('corpus.json','w'))"
   ```

2. Serve this folder and open the harness in a browser:

   ```sh
   python3 -m http.server 8777
   # then open http://localhost:8777/harness.html
   ```

3. The page renders every stored site in a 1440×900 iframe and, when the status line
   reads `DONE <n>`, leaves the per-page results on `window.RESULTS` (an array of
   `{slug, headlineH, heroH, vh, ratio_hero, ratio_fold}`). Read/aggregate from the
   console, e.g. distribution of `ratio_hero`, or `RESULTS.filter(r => r.ratio_fold > 0.5)`.

## Caveats

- **Desktop only.** The iframe is 1440×900. A true 390×844 phone (soft keyboard, real
  address bar) cannot be reproduced here — headline share and below-fold rates are all
  understated for mobile. Treat mobile numbers as "at least this bad."
- External hero images delay iframe `onload`; a full 100-page run takes ~1–2 minutes.
- Only claimed/published businesses render their real page from a live subdomain; this
  tool sidesteps that by rendering the stored `rendered_html` directly, so it covers the
  whole corpus regardless of claim status.
