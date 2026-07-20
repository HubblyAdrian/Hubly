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

// Architecture locked — same destinations
ok(html.includes('href="/get-done"'), 'customer /get-done');
ok(html.includes('href="/marketplace"'), 'keep /marketplace');
ok(html.includes('href="/signup"'), 'keep /signup');
ok(html.includes('href="/login"'), 'keep /login');
ok(html.includes('id="paths"'), 'paths section');
ok(html.includes('id="industries"'), 'industries section');
ok(html.includes('id="how"'), 'journey section');
ok(html.includes('id="grow"'), 'business section');
ok(html.includes('id="readiness"'), 'readiness section');
ok(html.includes('Ask Hubly'), 'Ask Hubly remains');

// Craft rules
ok(html.includes('Get Matched'), 'hero owns Get Matched');
ok(!/nav-acts[\s\S]{0,400}Get Matched/i.test(html), 'header must not duplicate Get Matched');
ok(html.includes('Start Free') || html.includes('For businesses'), 'business CTA in chrome');
ok(!/Hubly Pro/i.test(html), 'no Hubly Pro branding');
ok(html.includes('How Can We Help?'), 'customer card copy');
ok(html.includes('Join Marketplace'), 'marketplace card');
ok(html.includes('Run Your Business'), 'business card without Pro');
ok(html.includes('Verified Professionals'), 'trust: verified');
ok(html.includes('Secure Payments'), 'trust: payments');
ok(!/20,000\+\s*Happy/i.test(html), 'no fabricated homeowner count');
ok(html.includes('hubly-wordmark-on-dark'), 'brand wordmark');
ok(html.includes('ai-demo') || html.includes('Hubly understands'), 'AI understanding demo');
ok(html.includes('photo-1604014237800'), 'home-services hero imagery');

if (failed) process.exit(1);
console.log('OK homepage craftsmanship checks passed');
