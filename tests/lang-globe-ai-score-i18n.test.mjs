import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hublySrc = readFileSync(join(root, 'public/hubly.html'), 'utf8');

describe('Language globe, AI, and Hubly Score i18n', () => {
  it('exposes a hover tip on language controls', () => {
    assert.match(hublySrc, /lang-has-tip/);
    assert.match(hublySrc, /data-lang-tip=/);
    assert.match(hublySrc, /content:attr\(data-lang-tip\)/);
    assert.match(hublySrc, /id="lang-btn-app"[^>]*data-lang-tip=/);
    assert.match(hublySrc, /languageTip:'Language — switch to Spanish'/);
    assert.match(hublySrc, /languageTipEsActive:'Idioma — cambiar a inglés'/);
  });

  it('asks the AI advisor to reply in the selected language', () => {
    assert.match(hublySrc, /language:langCode/);
    assert.match(hublySrc, /Responde SIEMPRE en español/);
    assert.match(hublySrc, /Always reply in English/);
    assert.match(hublySrc, /functions\.invoke\('ai-advisor',\{body:\{/);
  });

  it('localizes Hubly Score title and checklist strings', () => {
    assert.match(hublySrc, /data-i18n="hublyScoreTitle">Hubly Score</);
    assert.match(hublySrc, /hublyScoreTitle:'Hubly Score'/);
    assert.match(hublySrc, /hublyScoreTitle:'Puntuación Hubly'/);
    assert.match(hublySrc, /hsFirstJob:'Complete your first job'/);
    assert.match(hublySrc, /hsFirstJob:'Completa tu primer trabajo'/);
    assert.match(hublySrc, /hsFirstCustomer:'Add your first customer'/);
    assert.match(hublySrc, /hsFirstCustomer:'Agrega tu primer cliente'/);
    assert.match(hublySrc, /label:t\('hsProfile'\)/);
    assert.match(hublySrc, /t\('hublyScoreOf'\)/);
    assert.match(hublySrc, /renderHublyScore==='function'\)renderHublyScore\(\)/);
  });
});
