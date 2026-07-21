#!/usr/bin/env node
/**
 * Guard /get-done marketing shell: triptych layout + required intake IDs.
 */
import fs from 'fs';

const html = fs.readFileSync('public/get-done.html', 'utf8');
let failed = false;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  }
}

const ids = [
  'need-input', 'send-btn', 'prompts', 'thread', 'matches', 'status',
  'booking-panel', 'booking-title', 'booking-list',
  'bk-overlay', 'bk-title', 'bk-close', 'bk-steps', 'bk-body', 'bk-status',
];
for (const id of ids) {
  ok(html.includes(`id="${id}"`), `required id #${id}`);
}

ok(html.includes('Powered by AI. Backed by pros.'), 'value props rail');
ok(html.includes('Popular right now'), 'popular services rail');
ok(html.includes('Hubly AI'), 'AI card greeting');
ok(html.includes('<em>get done</em>'), 'brand-emphasized headline');
ok(html.includes('--brand:#D9632D'), 'Hubly orange brand token');
ok(html.includes('class="triptych"') || html.includes("id=\"triptych\""), 'triptych layout');
ok(html.includes('is-chatting'), 'chatting focus mode');
ok(html.includes('page-bg') || html.includes('photo-1618221195710'), 'soft-focus home interior background');
ok(html.includes('backdrop-filter'), 'glass card polish');
ok(!/#6[bB]4[eE][fF]{2}|#7[cC]3[aA][eE][dD]|purple-on/.test(html), 'no purple-theme accents');

if (failed) process.exit(1);
console.log('OK get-done UI shell checks passed');
