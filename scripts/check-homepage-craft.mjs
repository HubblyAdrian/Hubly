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

// Nav should not force Marketplace vs Hubly choice up front
const primaryNav = html.match(/<nav class="nav-links"[^>]*>[\s\S]*?<\/nav>/i)?.[0] || '';
ok(!/Marketplace/i.test(primaryNav), 'Marketplace not in primary nav');

if (failed) process.exit(1);
console.log('OK homepage craftsmanship checks passed');
