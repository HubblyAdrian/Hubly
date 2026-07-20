import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const uiSrc = readFileSync(join(root, 'public/smart-quote/ui.js'), 'utf8');
const hublySrc = readFileSync(join(root, 'public/hubly.html'), 'utf8');

function isQuoteUnfinished(q) {
  if (!q) return false;
  if (q.emailSentAt || q.smsOpenedAt || q.status === 'sent' || q.status === 'accepted') return false;
  return q.status === 'draft' || !q.status;
}

function inferQuoteLeadStage(notes) {
  if (/\[QUOTE_STATUS:draft\]/i.test(String(notes || '')) && !/\[QUOTE_STATUS:sent\]/i.test(String(notes || ''))) {
    return 'new';
  }
  return 'quote_sent';
}

describe('unfinished quick quotes', () => {
  it('splits drafts from sent', () => {
    const quotes = [
      { id: '1', status: 'draft', customerName: 'A', amount: 100 },
      { id: '2', status: 'sent', emailSentAt: '2026-01-01', customerName: 'B', amount: 200 },
      { id: '3', status: 'draft', smsOpenedAt: '2026-01-02', customerName: 'C', amount: 150 },
    ];
    const drafts = quotes.filter(isQuoteUnfinished);
    const sent = quotes.filter((q) => !isQuoteUnfinished(q));
    assert.deepEqual(
      drafts.map((q) => q.id),
      ['1']
    );
    assert.deepEqual(
      sent.map((q) => q.id),
      ['2', '3']
    );
  });

  it('keeps draft leads in New until texted/emailed', () => {
    assert.equal(inferQuoteLeadStage('[source:smart_quote][QUOTE_STATUS:draft][QUOTE:$199.00]'), 'new');
    assert.equal(inferQuoteLeadStage('[source:smart_quote][QUOTE_STATUS:sent][QUOTE:$199.00]'), 'quote_sent');
  });
});

describe('manual text quote without Twilio', () => {
  it('ui.js wires modal copy / Messages / mark texted', () => {
    assert.match(uiSrc, /function sendQuoteSms\s*\(/);
    assert.match(uiSrc, /openM\('m-quote-sms'\)/);
    assert.match(uiSrc, /function copyQuoteSms\s*\(/);
    assert.match(uiSrc, /function openQuoteSmsApp\s*\(/);
    assert.match(uiSrc, /function confirmQuoteSmsSent\s*\(/);
    assert.match(uiSrc, /Text quote \(copy \/ Messages\)/);
    // Bug fix: cfg was undefined before
    assert.doesNotMatch(uiSrc, /quoteSmsBody\(rec,\s*money,\s*cfg\)/);
  });

  it('auto-saves unfinished quotes on Close', () => {
    assert.match(uiSrc, /allowIncomplete:\s*true/);
    assert.match(uiSrc, /Auto-save unfinished work/);
    assert.match(uiSrc, /Unfinished quote/);
    assert.match(uiSrc, /QUOTE_STATUS:/);
  });

  it('hubly.html has text modal + unfinished list chrome', () => {
    assert.match(hublySrc, /id="m-quote-sms"/);
    assert.match(hublySrc, /id="quote-sms-body"/);
    assert.match(hublySrc, /QUOTE_STATUS:draft/);
    assert.match(hublySrc, /Your quotes/);
    assert.match(hublySrc, /sq-list-h/);
  });
});
