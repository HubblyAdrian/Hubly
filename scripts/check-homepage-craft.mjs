#!/usr/bin/env node
import fs from 'fs';

const html = fs.readFileSync('public/platform-home.html', 'utf8');
let failed = false;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  }
}

// Architecture locked — destinations still reachable
ok(html.includes('href="/get-done"'), 'keep /get-done');
ok(html.includes('href="/marketplace"'), 'keep /marketplace');
ok(html.includes('href="/signup"'), 'keep /signup');
ok(html.includes('href="/login"'), 'keep /login');
ok(html.includes('id="industries"'), 'industries section');
ok(html.includes('id="how"'), 'how Hubly works section');
ok(html.includes('id="trust"'), 'trust section');
ok(html.includes('id="grow"'), 'business section');
ok(html.includes('id="readiness"'), 'readiness section');
ok(html.includes('Ask Hubly'), 'Ask Hubly remains');

// No audience classification cards
ok(!/id="paths"/.test(html), 'audience path cards removed');
ok(!/What brings you to Hubly/i.test(html), 'no self-classify headline');
ok(!/How Can We Help\?/.test(html), 'no customer path card in architecture row');

// Order: hero → how → industries → trust → grow
const order = ['id="how"', 'id="industries"', 'id="trust"', 'id="grow"', 'id="readiness"'];
let last = -1;
for (const key of order) {
  const i = html.indexOf(key);
  ok(i > last, `section order: ${key}`);
  last = i;
}

// Craft rules
ok(html.includes('Get Matched'), 'hero owns Get Matched');
ok(!/nav-acts[\s\S]{0,400}Get Matched/i.test(html), 'header must not duplicate Get Matched');
ok(html.includes('Start Free'), 'business CTA in chrome');
ok(!/\bHubly Pro\b/i.test(html), 'no Hubly Pro branding');
ok(html.includes('Join Marketplace'), 'marketplace path in For Businesses');
ok(html.includes('Run Your Business'), 'run business path in For Businesses');
ok(html.includes('Receive booking requests from customers already looking'), 'marketplace copy');
ok(html.includes('Websites, bookings, CRM, scheduling, payments, AI.'), 'run business copy');
ok(html.includes('Verified Professionals'), 'trust: verified');
ok(html.includes('Secure Payments'), 'trust: payments');
ok(!/20,000\+\s*Happy/i.test(html), 'no fabricated homeowner count');
ok(html.includes('hubly-lockup') || html.includes('hubly-wordmark'), 'brand wordmark');
ok(html.includes('ai-demo') || html.includes('Hubly understands'), 'AI understanding demo');
ok(html.includes('photo-1604014237800'), 'home-services hero imagery');
ok(html.includes('How Hubly works'), 'how section labeling');

// Hero freeze craft — locked stage, one primary CTA, supporting Ask Hubly
ok(html.includes('max-height:calc(100svh - var(--nav-h))'), 'hero height locked');
ok(html.includes('height:228px'), 'AI card height locked');
ok(html.includes('width:248px'), 'phone enlarged ~18%');
ok(html.includes('phone-sheet.show'), 'booking card fades in');
ok(html.includes('We found someone'), 'conveyor: found someone stage');
ok(html.includes('phone-photo'), 'photo supports booking, does not fill phone');
ok(html.includes('phoneWhen'), 'phone shows availability/when');
ok(html.includes('phonePrice'), 'phone shows price');
ok(html.includes('Thinking…'), 'deliberate AI timing copy');
ok(html.includes('Searching nearby'), 'searching beat in story');
ok(html.includes('ask-fab'), 'Ask Hubly chatbot bubble');
ok(html.includes('id="askFab"'), 'Ask Hubly FAB id');
ok(!/id="askCard"/.test(html), 'Ask Hubly not in conveyor card');
ok(!/Need help\?/.test(html), 'no Ask Hubly invitation card copy in hero');
ok(html.includes('translateX'), 'chat slides from the right');
ok(/askFloat[\s\S]{0,120}hidden/.test(html), 'chat hidden by default');
ok(html.includes('setOpen(false)'), 'chat forced closed on load');
ok(!/Talk to Hubly/.test(html), 'no competing Talk to Hubly CTA');
ok(!/@media\(min-width:1100px\)\{\.ask-fab\{display:none\}\}/.test(html), 'FAB visible on desktop');
ok((html.match(/btn-brand/g) || []).length >= 1, 'brand CTA exists');
// Only one primary orange CTA in hero ask-pill (Get Matched)
const heroBlock = html.match(/<section class="hero"[\s\S]*?<\/section>/)?.[0] || '';
ok(/Get Matched/.test(heroBlock), 'Get Matched in hero');
ok(!/btn-brand[\s\S]{0,80}Talk/i.test(heroBlock), 'no second brand CTA in hero');
ok(!/<button[^>]*class="[^"]*btn-brand[^"]*"[^>]*>[^<]*Ask/i.test(heroBlock), 'Ask Hubly is not a brand button');
ok(!/id="askCard"[\s\S]*?btn-brand/.test(heroBlock), 'Ask card has no brand CTA');

// Nav should not force Marketplace vs Hubly choice up front
const primaryNav = html.match(/<nav class="nav-links"[^>]*>[\s\S]*?<\/nav>/i)?.[0] || '';
ok(!/Marketplace/i.test(primaryNav), 'Marketplace not in primary nav');

if (failed) process.exit(1);
console.log('OK homepage craftsmanship checks passed');
