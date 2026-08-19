/**
 * THE Supabase publishable key. One copy, for every surface that needs one.
 *
 * WHY THIS FILE EXISTS
 *
 * There were SEVEN copies of the old anon JWT, pasted inline into
 * api/router.js and six HTML pages. Seven copies is how the singular/plural
 * mismatch survived unnoticed for months: the code read
 * SUPABASE_PUBLISHABLE_KEY while the platform injected the PLURAL
 * SUPABASE_PUBLISHABLE_KEYS, so five separate "fallbacks" were dead code
 * resolving to undefined, and nothing ever failed loudly enough to notice.
 *
 * A value duplicated seven times is a value nobody owns. Change it here.
 *
 * IS IT SAFE IN THE REPO? Yes, and that is the point of a publishable key:
 * it is designed to ship to browsers, carries no privileges of its own, and
 * every table it can reach is governed by RLS. It is not a secret. The SECRET
 * key (sb_secret_…) is a different thing entirely and must never appear here,
 * in any client file, or in any commit.
 *
 * BOTH RUNTIMES. Browsers get window.HUBLY_PUBLISHABLE_KEY via a plain
 * <script src>; Node (api/router.js) reads the same file through
 * api/_publishable-key.js, which parses this one constant out of it. One
 * source of truth, two consumers, no build step.
 */
var HUBLY_PUBLISHABLE_KEY = "sb_publishable_21fYe4n9V6PypA3SAMs-7g_EHAIRqHO";

/* Browser surfaces read it off window. Guarded so this file is harmless when
   read by Node, which has no window. */
if (typeof window !== "undefined") {
  window.HUBLY_PUBLISHABLE_KEY = HUBLY_PUBLISHABLE_KEY;
}
