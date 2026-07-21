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
ok(html.includes('Get it done'), 'hero owns Get it done CTA');
ok(!/nav-acts[\s\S]{0,400}Get it done/i.test(html), 'header must not duplicate Get it done');
ok(!/\|\s*'help'\s*\)/.test(html) && !/\|\|\s*'help'/.test(html), 'empty CTA must not seed fake "help" prompt');
ok(html.includes("'/get-done'") || html.includes('"/get-done"'), 'empty CTA can open clean Get Done');
ok(html.includes('Start Free'), 'business CTA in chrome');
ok(!/\bHubly Pro\b/i.test(html), 'no Hubly Pro branding');
ok(html.includes('Join Marketplace'), 'marketplace path in For Businesses');
ok(html.includes('Run Your Business'), 'run business path in For Businesses');
ok(html.includes('Receive booking requests from customers already looking'), 'marketplace copy');
ok(html.includes('Websites, bookings, CRM, scheduling, payments, AI'), 'run business copy');
ok(html.includes('adapts to you'), 'industries adapts headline');
ok(html.includes('Optimized Blueprint'), 'blueprint badges');
ok(html.includes('Don’t see your business') || html.includes("Don't see your business"), 'custom business CTA');
ok(html.includes('Let’s Build It Together') || html.includes("Let's Build It Together"), 'build together CTA');
ok(html.includes('ind-feature-grid'), 'featured blueprint cards');
ok(html.includes('ind-build'), 'custom blueprint banner');
ok(html.includes('Verified Professionals'), 'trust: verified');
ok(html.includes('Secure Payments'), 'trust: payments');
ok(!/20,000\+\s*Happy/i.test(html), 'no fabricated homeowner count');
ok(html.includes('hubly-lockup') || html.includes('hubly-wordmark'), 'brand wordmark');
ok(html.includes('ai-demo') || html.includes('Hubly understands'), 'AI understanding demo');
ok(html.includes('photo-1604014237800'), 'home-services hero imagery');
ok(html.includes('How Hubly works'), 'how section labeling');

// Live AI demo — one workflow connected by motion
ok(html.includes('ai-flow'), 'unified AI flow stage');
ok(html.includes('ai-beam'), 'motion connector beam');
ok(html.includes('ai-result-card'), 'match result payoff card');
ok(html.includes('runBeamThenMatch'), 'beam then match sequence');
ok(html.includes('★★★★★') || html.includes('result-rating'), 'rating in match payoff');
ok(html.includes('Book Now'), 'Book Now payoff CTA');
ok(!/conveyor-arrow/.test(html), 'no arrow connectors');
ok(!/phone-bezel/.test(html), 'not a phone mockup stack');
ok(!/We found someone/.test(html), 'no stage labels — motion tells story');
ok(!/min-height:100svh/.test(html) && !/max-height:100svh/.test(html), 'hero is shorter than full viewport');
ok(/\.hero\{[\s\S]*?min-height:0/.test(html), 'hero height follows content');
ok(/\.hero-float\{[\s\S]*?align-self:start/.test(html), 'Hubly understands sits toward the top');
ok(/height:460px/.test(html), 'AI float stack is compact');
ok(/\.nav\{[^}]*position:fixed/.test(html), 'nav overlays hero (no grey band)');
ok(/nav-acts[\s\S]{0,200}btn-brand[\s\S]{0,80}Start Free/.test(html), 'Start Free is brand orange CTA');
ok(/\.hero-inner\{[\s\S]*?align-items:start/.test(html), 'hero content sits higher');

ok(/height:184px/.test(html), 'result shell height locked');
ok(html.includes('hideMatchCard') || html.includes('waiting'), 'match card hidden between cycles');
ok(html.includes('hideMatchCard') || html.includes("classList.remove('show'"), 'previous match is fully hidden (no dim ghost)');
ok(!/Keep last match faintly visible/.test(html), 'no dimmed shadow match during Searching');
ok(/transition-delay:\.55s/.test(html) || html.includes('result-cta'), 'Book Now staggers in as payoff');
ok(!/chip-more/.test(html), 'no + More competing egress in hero');
ok(!/caret/.test(html), 'no dropdown caret on hero CTA');
ok(!/\.paths-grid/.test(html), 'dead path-card CSS removed');
ok(!/<span class="caret"/.test(html), 'no caret markup');
ok(html.includes('ai-result waiting') || html.includes("classList.add('waiting')"), 'match shell starts waiting/hidden');
ok(!/ai-result-card\.dim/.test(html) && !/classList\.add\('dim'\)/.test(html), 'no dim ghost match CSS/JS');
ok(!/\.ai-result-card\{opacity:1!important/.test(html), 'reduced-motion must not force match card visible');

// Ask Hubly bubble
ok(html.includes('ask-fab'), 'Ask Hubly chatbot bubble');
ok(html.includes('id="askFab"'), 'Ask Hubly FAB id');
ok(!/id="askCard"/.test(html), 'Ask Hubly not in conveyor card');
ok(html.includes('translateX'), 'chat slides from the right');
ok(/askFloat[\s\S]{0,120}hidden/.test(html), 'chat hidden by default');
ok(html.includes('setOpen(false)'), 'chat forced closed on load');
ok(!/Talk to Hubly/.test(html), 'no competing Talk to Hubly CTA');

const heroBlock = html.match(/<section class="hero"[\s\S]*?<\/section>/)?.[0] || '';
ok(/Get it done/.test(heroBlock), 'Get it done in hero');
ok(!/Get Matched/.test(heroBlock), 'old Get Matched label removed from hero');
ok(!/<button[^>]*class="[^"]*btn-brand[^"]*"[^>]*>[^<]*Ask/i.test(heroBlock), 'Ask Hubly is not a brand button');

const primaryNav = html.match(/<nav class="nav-links"[^>]*>[\s\S]*?<\/nav>/i)?.[0] || '';
ok(!/Marketplace/i.test(primaryNav), 'Marketplace not in primary nav');

if (failed) process.exit(1);
console.log('OK homepage craftsmanship checks passed');
