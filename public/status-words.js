/* ══ THE STATUS VOCABULARY, IN ONE PLACE ═══════════════════════════════════════════════════════
 *
 * FOUND BY MEASUREMENT, 2026-09-18. The two-of-everything audit's second signal — the same
 * user-visible SENTENCE appearing verbatim in both shells — returned 17 hits with zero noise, and the
 * most important was this: `'Not sent yet'`, `'Waiting on them'`, `'They said yes'`, `'They said no'`
 * existed TWICE, hand-maintained, in `public/hubly.html` (renderQuotesFromRecord) and
 * `public/platform-home.html` (HC_STATUS_WORDS.quote). A user-visible vocabulary duplicated by hand
 * means the two shells can disagree about what a quote's status is CALLED, to the same owner, about
 * the same record.
 *
 * ══ WHY A SERVED FILE IS SAFE HERE, WHICH IT WOULD NOT HAVE BEEN IN SEPTEMBER ══════════════════
 *
 * A new root-level script is exactly the shape of the 2026-09-16 scar: `public/contact-pick.js`
 * deployed, was missing from `api/router.js`'s hand-written list of three, and the catch-all answered
 * it with 3 MB of hubly.html — no 404, a silent parse failure, and everything it defined `undefined`
 * in BOTH shells. Two things closed that:
 *   · `api/router.js` now DERIVES from `fs.existsSync` + `isFile()` instead of a list (router.js:237);
 *   · `scripts/check-root-scripts-are-served.mjs` fails if a root script is not served AS a script.
 * So the failure mode that made this dangerous is guarded, and the vocabulary can live in one place.
 *
 * ══ THE KEYS ARE THE DATABASE'S, THE WORDS ARE OURS ═══════════════════════════════════════════
 *
 * `quotes.status` carries a CHECK constraint, so these five keys are the values the column can hold —
 * not five somebody imagined. `check-status-words-are-one-vocabulary` asserts the key set still equals
 * the constraint, so a sixth status added in SQL cannot leave a word missing and read as blank.
 *
 * DEFENSIVE BY DESIGN: a shell that loads this before its own code reads `window.HUBLY_STATUS_WORDS`.
 * If this file somehow does not arrive, a reader that falls back to the raw status shows `sent` rather
 * than nothing — an ugly word beats an empty cell, and it is visibly wrong instead of invisibly blank.
 */
(function () {
  var W = typeof window !== "undefined" ? window : globalThis;
  W.HUBLY_STATUS_WORDS = {
    quote: {
      draft: "Not sent yet",
      sent: "Waiting on them",
      accepted: "They said yes",
      declined: "They said no",
      expired: "Ran out",
    },
  };
})();
