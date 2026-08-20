/**
 * Every page that uses the publishable key must actually LOAD it.
 *
 * WHY THIS TEST EXISTS
 *
 * This is the fourth member of the allow-list family documented in
 * docs/KNOWN_ISSUES.md ("A hardcoded list that silently drops unknown entries").
 * The other three are code; this one was a one-off script that was never
 * committed, so there is nothing to add a log line to — the durable form of
 * "log the drop" for a build-time check is a test that NAMES what fell through.
 *
 * THE ORIGINAL BUG, WHICH THIS TEST IS SHAPED TO CATCH
 *
 * A guard checked `if 'hubly-public-key.js' not in page`. The insertion had
 * added a COMMENT mentioning the filename, so the condition was false on every
 * page whether or not the <script> tag was there. Six pages shipped blank, and
 * the static check passed them — it matched its own comment.
 *
 * So this test does not search for the filename. It requires a real
 * `<script src=...hubly-public-key.js...></script>` tag, and it separately
 * proves the naive check would have been fooled, so the distinction cannot be
 * quietly refactored away.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');

/** A real script tag, not a mention. */
const TAG_RE = /<script\b[^>]*\bsrc\s*=\s*["'][^"']*hubly-public-key\.js[^"']*["'][^>]*>/i;
/** The naive check that shipped six blank pages. */
const NAIVE_RE = /hubly-public-key\.js/;
/** Uses the key at runtime, so it needs the tag. */
const USES_KEY_RE = /HUBLY_PUBLISHABLE_KEY/;

function pages() {
  return readdirSync(publicDir)
    .filter((f) => f.endsWith('.html'))
    .map((f) => ({ name: f, html: readFileSync(join(publicDir, f), 'utf8') }));
}

describe('publishable key script tag', () => {
  it('every page that uses the key loads it, and names any that do not', () => {
    const missing = pages()
      .filter((p) => USES_KEY_RE.test(p.html) && !TAG_RE.test(p.html))
      .map((p) => p.name);
    // The failure message IS the log line: what fell through, and where.
    assert.deepEqual(
      missing,
      [],
      `allowlist-drop [publishable-key-tag] ${missing.length} page(s) reference ` +
        `HUBLY_PUBLISHABLE_KEY with no <script src=...hubly-public-key.js>: ${missing.join(', ')} ` +
        `| consequence: window.HUBLY_PUBLISHABLE_KEY is undefined, every Supabase call 401s, the page renders blank ` +
        `| fix at: add the tag to public/<page>.html`,
    );
  });

  it('finds the pages at all — a check that checks nothing passes too', () => {
    // Guards the "0 of 0 passed" failure mode: if the glob or the regex stops
    // matching, the test above goes green while proving nothing.
    const using = pages().filter((p) => USES_KEY_RE.test(p.html));
    assert.ok(using.length >= 6, `expected at least 6 pages using the key, found ${using.length}`);
  });

  it('rejects a page where only a COMMENT mentions the file', () => {
    // The exact shape that fooled the original guard.
    const decoy = `<!-- loads hubly-public-key.js -->\n<script>console.log(window.HUBLY_PUBLISHABLE_KEY);</script>`;
    assert.ok(NAIVE_RE.test(decoy), 'the naive filename check is fooled by the comment');
    assert.ok(!TAG_RE.test(decoy), 'the tag check is not');
  });

  it('accepts a real tag in the shapes actually used', () => {
    for (const tag of [
      '<script src="/journey-os/hubly-public-key.js"></script>',
      "<script src='journey-os/hubly-public-key.js'></script>",
      '<script defer src="/journey-os/hubly-public-key.js?v=2"></script>',
    ]) {
      assert.ok(TAG_RE.test(tag), `should accept: ${tag}`);
    }
  });
});
