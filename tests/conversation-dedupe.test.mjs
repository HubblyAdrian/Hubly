/**
 * The dedupe must remove REPEATS. It must never remove the only thing said.
 *
 * WHY THIS TEST EXISTS
 *
 * dedupeConversationMessages shipped on 2026-08-18 to stop the builder saying
 * "I'm building your page" three times in a row. It was verified by measuring
 * the similarity scores — photos repeat 0.97, unrelated 0.00-0.17, threshold
 * 0.6 sitting in open space between them. Every one of those numbers was
 * correct and the feature was still broken, because the CALL SITE handed it
 * `history`, the live array that the same turn had already appended both its
 * interim messages and its finalText to. Each candidate was compared against
 * itself, scored 1.0, and was dropped. The chat pane went silent on every turn
 * that invoked a capability — the page updated and Hubly said nothing at all.
 *
 * It was caught by reading the rendered transcript in a browser and finding two
 * user messages and zero assistant messages. Measuring the threshold could not
 * have caught it, because the threshold was never the problem.
 *
 * So the assertions below are about the OUTCOME — what survives — starting
 * with the self-comparison case, since that is the shape that actually shipped.
 * They run the REAL exported function under Deno rather than re-implementing
 * it, for the same reason the vocabulary test does.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const modulePath = join(root, 'supabase/functions/_shared/hubly_dedupe.ts');
const callSite = readFileSync(join(root, 'supabase/functions/hubly-conversation/index.ts'), 'utf8');

/** Run one dedupe call for real and return its result. */
function dedupe(interim, reply, priorSaid) {
  const expr =
    'console.log(JSON.stringify(m.dedupeConversationMessages(' +
    JSON.stringify(interim) + ',' + JSON.stringify(reply) + ',' + JSON.stringify(priorSaid) + ')));';
  let out;
  try {
    out = execFileSync('deno', ['eval', '--quiet', `import * as m from "${modulePath}";\n${expr}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    assert.fail(
      'Could not run the dedupe under Deno. This test must not be skipped — it guards a bug that ' +
      'silenced the entire builder transcript.\n' + String(err.stderr || err.message),
    );
  }
  return JSON.parse(out.trim());
}

describe('builder transcript dedupe', () => {
  it('given prior turns only, a turn that produced text keeps its text', () => {
    // THE CONTRACT. Same inputs as the bug, but with priorSaid holding what the
    // assistant said BEFORE this turn — which is all the call site may pass.
    const interim = ['Building the page now.'];
    const reply = 'Done — your page is up.';

    const out = dedupe(interim, reply, ['What would you like it to say?']);
    assert.deepEqual(out.interim, interim);
    assert.equal(out.reply, reply);
  });

  it('characterises the bug: contaminated priorSaid silences the turn', () => {
    // Deliberately asserting the BROKEN behaviour, because it cannot be fixed
    // defensively — a message identical to one in priorSaid is exactly what the
    // dedupe exists to drop, so the function has no way to tell "the assistant
    // repeated itself" from "the caller handed me my own output."
    //
    // That makes the call site the only place this can be got right, which is
    // why the structural assertion below is not belt-and-braces: it is the
    // actual guard. This test's job is to keep the danger documented and
    // visible, so nobody reads the contract test above and concludes the
    // function is safe against any input.
    const interim = ['Building the page now.'];
    const reply = 'Done — your page is up.';
    const contaminated = [...interim, reply];

    const out = dedupe(interim, reply, contaminated);
    assert.deepEqual(out.interim, [], 'the failure mode has changed — re-read the call site guard');
    assert.equal(out.reply, '', 'the failure mode has changed — re-read the call site guard');
  });

  it('says something on every turn, whatever the prior history', () => {
    // The invariant that matters to a person looking at the screen: a turn that
    // produced text must show text. Anything else is a silent build.
    const cases = [
      [[], 'Done — the section is in.'],
      [['Building the page now.'], 'Building the page now.'],
      [['I added your prices.'], 'I added your hours.'],
      [['Working on the site.', 'Putting the page together.'], 'Creating your website now.'],
    ];
    for (const [interim, reply] of cases) {
      const out = dedupe(interim, reply, ['Something said two turns ago.']);
      assert.ok(
        out.interim.length > 0 || out.reply,
        `turn went completely silent: interim=${JSON.stringify(interim)} reply=${JSON.stringify(reply)}`,
      );
    }
  });

  it('still removes the repeat it was built for', () => {
    // Calibration — a dedupe that never drops anything passes the two tests
    // above and is not a dedupe. These are the two real repeats observed in the
    // builder: near-verbatim (0.97) and same-statement-different-words (0.40,
    // which only the progress-announcement rule catches).
    const verbatim = dedupe([], 'Drop your photos here and I will put them on the page.', [
      'Drop your photos here and I will put them on the page.',
    ]);
    assert.equal(verbatim.reply, '', 'near-verbatim repeat survived');

    const reworded = dedupe([], "Building the page now — it'll appear in a moment.", [
      'Building the first version now.',
    ]);
    assert.equal(reworded.reply, '', 'reworded build announcement survived');

    const unrelated = dedupe([], 'Your hours are saved.', ['Building the first version now.']);
    assert.equal(unrelated.reply, 'Your hours are saved.', 'an unrelated message was wrongly dropped');
  });

  it('the call site passes prior turns only, not the live history', () => {
    // The structural half. The two arrays differ by exactly what this turn
    // appended, so a future edit that swaps them back reintroduces the silence
    // without changing a single line of the dedupe itself.
    assert.ok(
      /dedupeConversationMessages\(interimMessages, finalText, priorAssistantSaid\)/.test(callSite),
      'dedupeConversationMessages must be called with the pre-turn snapshot (priorAssistantSaid), not `history` — ' +
        "`history` has this turn's own messages pushed into it and makes every message its own duplicate.",
    );
    assert.ok(
      /const priorAssistantSaid[\s\S]{0,120}=\s*incoming\s*[\s\S]{0,80}\.filter/.test(callSite),
      'priorAssistantSaid must be derived from `incoming` (pre-turn), not from the mutated `history`.',
    );
  });
});
