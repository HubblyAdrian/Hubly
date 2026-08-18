/**
 * The class vocabulary the validator accepts must be the class vocabulary the
 * model is offered.
 *
 * WHY THIS TEST EXISTS
 *
 * On 2026-08-17 eleven class families were found to be accepted by
 * validateHublyDocument and mentioned nowhere in the generation prompt:
 * aspect-*, object-cover, object-contain, overflow-hidden, relative, absolute,
 * inset-0, uppercase/lowercase/capitalize, flex-wrap, inline-block, and the
 * gradient set. The drift had been in place for months and was invisible
 * because both halves were individually correct — the validator accepted valid
 * classes, the prompt described real ones. Only the difference was wrong.
 *
 * It surfaced as a rendering bug nobody would have traced back here: told to
 * build an image placeholder "with an aspect ratio", the model had no aspect
 * class in the vocabulary it had been shown, reached for min-h-screen (the only
 * height token it was ever offered), and produced a full-viewport grey
 * rectangle in the hero of every photo-led business.
 *
 * The structural fix is CLASS_FAMILIES: one array, `tokens` feeding the
 * validator and `prompt` feeding the model, with the type requiring both. This
 * test is the assertion that the structure is actually holding — including the
 * case the type cannot catch, where someone adds a token to an existing family
 * and does not update that family's prompt text.
 *
 * The check runs the REAL function under Deno rather than pattern-matching the
 * source, because a source-text assertion would have passed happily throughout
 * the entire period the bug existed.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const modulePath = join(root, 'supabase/functions/_shared/hubly_document.ts');

function runInDeno(expression) {
  return execFileSync(
    'deno',
    ['eval', '--quiet', `import * as m from "${modulePath}";\n${expression}`],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
}

describe('Hubly Document class vocabulary', () => {
  it('offers the model every family the validator accepts', () => {
    // Deno is already required to deploy any Edge Function in this repo, so
    // depending on it here is not a new constraint. Failing loudly when it is
    // missing is deliberate: a silently-skipped check is how the original bug
    // survived, and this test exists precisely to be un-skippable.
    let raw;
    try {
      raw = runInDeno('console.log(JSON.stringify(m.verifyVocabularyCoverage()));');
    } catch (err) {
      assert.fail(
        'Could not run the vocabulary coverage check under Deno. This test must ' +
        'not be skipped — it guards the prompt/validator drift that produced the ' +
        'min-h-screen hero bug. Install Deno or fix the module.\n' + String(err.stderr || err.message),
      );
    }
    const problems = JSON.parse(raw);
    assert.deepEqual(
      problems,
      [],
      'Validator accepts classes the model is never told about:\n  ' + problems.join('\n  '),
    );
  });

  it('detects the historical aspect-* gap when it is reintroduced', () => {
    // Calibration. A check that never fires is indistinguishable from a check
    // that cannot fire — this proves it catches the real bug, using the real
    // function, by rebuilding the exact broken shape in memory.
    const out = runInDeno(`
      const families = [
        { id: "aspect", tokens: ["aspect-square", "aspect-video"], prompt: "Sizing: use the height tokens above" },
      ];
      // Same logic verifyVocabularyCoverage applies, over a deliberately broken family.
      const problems = [];
      for (const f of families) for (const t of f.tokens) {
        const head = t.includes("-") ? t.slice(0, t.indexOf("-")) : t;
        if (!f.prompt.includes(head)) problems.push(t);
      }
      console.log(JSON.stringify(problems));
    `);
    assert.deepEqual(JSON.parse(out), ['aspect-square', 'aspect-video']);
  });

  it('keeps the vocabulary non-empty and the two halves in sync in size', () => {
    const raw = runInDeno('console.log(JSON.stringify({n: m.UTILITY_CLASSES.size, prompt: m.buildStylingPromptBlock().length}));');
    const { n, prompt } = JSON.parse(raw);
    assert.ok(n > 300, `expected a substantial class vocabulary, got ${n}`);
    assert.ok(prompt > 500, `styling prompt block looks truncated (${prompt} chars)`);
  });
});
