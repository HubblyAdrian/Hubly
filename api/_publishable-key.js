/**
 * The publishable key, for the Node side, read from the SAME file the browser
 * loads — public/journey-os/hubly-public-key.js.
 *
 * The alternative was an eighth copy of the literal, which is exactly the thing
 * this change exists to remove. A value duplicated across runtimes is a value
 * that drifts across runtimes.
 *
 * An environment variable still wins when one is set, so a deployment can
 * override without a commit. Nothing sets one today (Vercel has no Supabase env
 * vars at all — checked), which is precisely why the file has to work.
 */
const fs = require('fs');
const path = require('path');

function readFromSharedFile() {
  try {
    const p = path.join(__dirname, '..', 'public', 'journey-os', 'hubly-public-key.js');
    const src = fs.readFileSync(p, 'utf8');
    const m = /HUBLY_PUBLISHABLE_KEY\s*=\s*"([^"]+)"/.exec(src);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

const key =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  readFromSharedFile();

if (!key) {
  // Loud, not silent. An absent key here degrades the router to a 401 on every
  // upstream call, which reads as "the site is down" rather than "the key is
  // missing" -- the same swallow-failure shape documented in KNOWN_ISSUES.
  console.error(
    '[hubly] No Supabase publishable key. Set SUPABASE_PUBLISHABLE_KEY or fix ' +
      'public/journey-os/hubly-public-key.js.',
  );
}

module.exports = { SUPABASE_PUBLISHABLE_KEY: key };
