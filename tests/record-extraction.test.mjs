/**
 * The facts someone typed must reach the record without a model choosing to.
 *
 * WHY THIS TEST EXISTS
 *
 * There was no extraction step. A phone number, an address, opening hours or a
 * service area reached the business record only if the model happened to invoke
 * `updateDraft` on some turn. When it went straight
 * `startDraft -> generateDocument -> setServices`, everything but the name was
 * gone — and the same shape of message produced different results on different
 * runs, because the model made a different choice.
 *
 * Measured 2026-08-19: one message carrying eleven distinct facts produced a
 * record holding the name and nothing else.
 *
 * These tests cover TIER A only — the pattern layer, which is the half that
 * cannot decline to run. Tier B is a model call and is verified live against
 * the deployed function, not here.
 *
 * The tests that matter most are the NEGATIVE ones. A pattern layer that
 * over-matches is worse than none: a wrong phone number on a real business's
 * website is a customer calling a stranger.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mod = join(root, 'supabase/functions/_shared/hubly_extract.ts');

function deno(expr) {
  try {
    return execFileSync('deno', ['eval', '--quiet', `import * as m from "${mod}";\n${expr}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    assert.fail('Could not run under Deno:\n' + String(err.stderr || err.message));
  }
}

const pattern = (text) => JSON.parse(deno(`console.log(JSON.stringify(m.extractByPattern(${JSON.stringify(text)})));`));
const priced = (text) => JSON.parse(deno(`console.log(JSON.stringify(m.extractPricedServices(${JSON.stringify(text)})));`));

describe('record extraction — patterns', () => {
  it('captures the message that lost everything', () => {
    // VERBATIM the message that produced a record holding only the name.
    const msg =
      'Build me a website for Hollybrook Gutter Guards in Ogden. Phone 801-555-0512. ' +
      'Email hello@hollybrook.com. We are at 44 Main Street, Ogden UT 84401. ' +
      'Open Monday to Friday 8am-5pm. We serve Ogden, Layton and Roy. ' +
      'Gutter guards $9 a foot, cleaning $180.';
    const f = pattern(msg);
    assert.equal(f.phone, '801-555-0512');
    assert.equal(f.email, 'hello@hollybrook.com');
    assert.equal(f.postalCode, '84401');
    assert.equal(f.state, 'Utah');
  });

  it('reads the phone shapes people actually type', () => {
    const cases = [
      ['Phone 801-555-0301.', '801-555-0301'],
      ['call us on (801) 555 0301', '801-555-0301'],
      ['801.555.0301 is the number', '801-555-0301'],
      ['+1 801 555 0301', '801-555-0301'],
      ['reach me at 8015550301', '801-555-0301'],
    ];
    for (const [text, expect] of cases) {
      assert.equal(pattern(text).phone, expect, `failed on: ${text}`);
    }
  });

  it('does NOT invent a phone number out of prices or long digit runs', () => {
    // THE ASSERTION THAT MATTERS MOST. A wrong number is a customer calling a
    // stranger; a missing one is a blank field.
    const noPhone = [
      'Full tear-off and replacement from $9,800 and repairs from $450.',
      'Order reference 80155503012024 for the deposit.',
      'We have completed 1055 jobs since 2019.',
      'Invoice total $18015550301',
    ];
    for (const text of noPhone) {
      assert.equal(pattern(text).phone, undefined, `wrongly found a phone in: ${text}`);
    }
  });

  it('only accepts a postcode when something says it is one', () => {
    // Five digits is also a price, a year and a square footage.
    assert.equal(pattern('Ogden UT 84401').postalCode, '84401');
    assert.equal(pattern('zip 84401').postalCode, '84401');
    assert.equal(pattern('Full replacement from $9,800').postalCode, undefined);
    assert.equal(pattern('we cleaned 12000 square feet').postalCode, undefined);
    assert.equal(pattern('trading since 84401 jobs completed').postalCode, undefined);
  });

  it('reads the state from either form, and not from a stray capital pair', () => {
    assert.equal(pattern('Bountiful, Utah').state, 'Utah');
    assert.equal(pattern('44 Main Street, Ogden UT 84401').state, 'Utah');
    // Two capitals are also initials.
    assert.equal(pattern('J M Plumbing and Heating').state, undefined);
  });

  it('extracts priced services, and requires a currency symbol', () => {
    const got = priced('Sweep and inspection $189, cap replacement from $340, liner repair from $900.');
    assert.deepEqual(got.map((s) => s.price), [189, 340, 900]);
    assert.ok(got[0].name.toLowerCase().includes('sweep'), `bad name: ${got[0].name}`);

    // A number in a sentence is not a price.
    assert.deepEqual(priced('Sweep and inspection 189 times last year.'), []);
    // Thousands separators survive.
    assert.equal(priced('Full tear-off from $9,800.')[0].price, 9800);
  });

  it('patterns beat the model pass on the fields both can produce', () => {
    // mergeFacts puts patterns last on purpose: a regex cannot hallucinate a
    // phone number, and a model can.
    const out = JSON.parse(deno(
      'console.log(JSON.stringify(m.mergeFacts({ phone: "801-555-0301" }, { phone: "555-555-5555", city: "Ogden" })));',
    ));
    assert.equal(out.phone, '801-555-0301');
    assert.equal(out.city, 'Ogden', 'the pass must still supply what patterns cannot');
  });

  it('returns nothing rather than something for an empty or factless message', () => {
    assert.deepEqual(pattern(''), {});
    assert.deepEqual(pattern('   '), {});
    assert.deepEqual(pattern('I want a website that feels warm and friendly.'), {});
  });
});
