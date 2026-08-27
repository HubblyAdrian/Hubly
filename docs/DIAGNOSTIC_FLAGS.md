# Diagnostic flags (public/platform-home.html)

Query-string–gated hooks that exist only for verification. None is exposed on a normal load.

- **`?authdiag=1`** — turns on the sign-in tracer (`window.hcAuthDump`, on-page banner). Read-only.
- **`?builddiag=1`** — exposes `window.__hcClearDraft()`. It nulls the caller's own in-memory
  draft pointer (`hc.draftBusiness`) and returns only the prior business id. It exists to
  verify the draft-continuation guard **deterministically** — force its precondition
  (`hc.draftBusiness = null` on a page that still holds a live draft cookie) instead of trying
  to win the sub-second on-load race by hand. It **must stay write-only and self-scoped**: it
  never returns or exposes `hc` itself, because `hc.draftBusiness` carries the `draftToken`
  bearer credential (see KNOWN_ISSUES). Blast radius is self-inflicted — it only affects the
  caller's own page. Do not widen it to a getter or expose `hc`.
