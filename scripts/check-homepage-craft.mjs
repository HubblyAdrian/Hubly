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

ok(html.includes('href="/get-done"'), 'keep /get-done');
ok(html.includes('href="/marketplace"'), 'keep /marketplace');
ok(html.includes('href="/signup"'), 'keep /signup');
ok(html.includes('href="/login"'), 'keep /login');
ok(html.includes('id="journeys"'), 'journey destinations section');
ok(html.includes('id="industries"'), 'businesses Hubly understands section');
ok(html.includes('id="how"'), 'how Hubly works anchor');
ok(html.includes('id="trust"'), 'trust section');
ok(html.includes('id="grow"'), 'business outcome anchor');
ok(html.includes('id="imagine"'), 'emotional outcome section');
ok(html.includes('id="readiness"'), 'readiness note');
ok(html.includes('Ask Hubly'), 'Ask Hubly remains');

ok(!/id="paths"/.test(html), 'old id=paths classification removed');
ok(!/What brings you to Hubly/i.test(html), 'no self-classify headline');
ok(!/How Can We Help\?/.test(html), 'no old How Can We Help? architecture string');

// Compressed story order
const order = ['id="journeys"', 'id="how"', 'id="transform"', 'id="trust"', 'id="industries"', 'id="imagine"', 'id="grow"', 'id="start"', 'id="readiness"'];
let last = -1;
for (const key of order) {
  const i = html.indexOf(key);
  ok(i > last, `section order: ${key}`);
  last = i;
}

const sectionCount = (html.match(/<section\b/g) || []).length;
ok(sectionCount <= 7, `compressed section count (${sectionCount} <= 7)`);

ok(html.includes('One AI. Two experiences.'), 'bridge sentence connects audiences');
ok(html.includes('Helping homeowners get work done and helping local businesses grow.'), 'company one-liner');
ok(html.includes('Most software makes you learn how it works.'), 'brand why sentence');
ok(html.includes('Hubly learns how you work'), 'brand why payoff');
ok(html.includes('Ask Hubly'), 'Ask Hubly as the interface');
ok(html.includes('What do you need help with') || html.includes('Tell Hubly about your business'), 'hero path copy');
ok(html.includes('Build My Business'), 'business journey CTA');
ok(html.includes('journey-dest-primary'), 'Build path visually primary');
ok(html.includes('id="transform"') || html.includes('Before Hubly'), 'transformation before/after');
ok(html.includes('After one conversation'), 'after-conversation payoff');
ok(!/\bI Need Help\b/.test(html), 'I Need Help retired');
ok(!/\bFind Help\b/.test(html), 'Find Help replaced by Ask Hubly');
ok(html.includes('journey-dest'), 'journey destination cards');
ok(html.includes('How can Hubly help'), 'journey question after hero');
ok(html.includes('journey-steps') || html.includes('how-lane'), 'how steps merged into journeys');
ok(html.includes('Stop learning software'), 'closing emotional CTA');
ok(html.includes('Start growing your business'), 'closing growth CTA');
ok(html.includes('Businesses already built with') || html.includes('Businesses Already Built'), 'proven businesses framing');
ok(html.includes('These are just a few'), 'industries examples not limits');
ok(html.includes('path-tabs') || html.includes('data-path="help"'), 'hero path switcher');
ok(html.includes('View All') || html.includes('Need inspiration') || html.includes('Popular trades'), 'optional browse in hero');
ok(!/\|\s*'help'\s*\)/.test(html) && !/\|\|\s*'help'/.test(html), 'empty CTA must not seed fake "help" prompt');
ok(html.includes("'/get-done'") || html.includes('"/get-done"'), 'empty help CTA can open Get Done');
ok(html.includes('function goHelp'), 'help path routing helper');
ok(!/\bHubly Pro\b/i.test(html), 'no Hubly Pro branding');
ok(html.includes('Tell Hubly about your business'), 'business path promise');
ok(html.includes('Get Found by Customers') || html.includes('Get found by customers') || html.includes('Send You Customers') || html.includes('send you customers'), 'get-found language not Marketplace');
ok(!/\bJoin Marketplace\b/i.test(html), 'no Join Marketplace customer language');
ok(!/\bMarketplace\b/i.test(html.replace(/href="\/marketplace"/g, '')), 'Marketplace word not in customer copy');
ok(html.includes('Built around your business'), 'signature brand message');
ok(html.includes('ind-feature-grid') || html.includes('ind-compact-grid'), 'service cards remain');
ok(html.includes('ind-build') || html.includes('Your Business'), 'your-business card');
ok(html.includes('Verified Professionals'), 'trust: verified');
ok(html.includes('Secure Payments'), 'trust: payments');
ok(!/20,000\+\s*Happy/i.test(html), 'no fabricated homeowner count');
ok(html.includes('hubly-lockup') || html.includes('hubly-wordmark'), 'brand wordmark');
ok(html.includes('ai-demo'), 'AI building demo');
ok(html.includes('photo-1604014237800'), 'home-services hero imagery');
ok(html.includes('Before Hubly') || html.includes('Imagine never setting up'), 'business outcomes');
ok(html.includes('No setup. No templates. No complicated software.'), 'anti-software framing');
ok(html.includes('licensing'), 'readiness future vision copy');

ok(html.includes('ai-flow'), 'unified AI flow stage');
ok(html.includes('ai-beam'), 'motion connector beam');
ok(html.includes('ai-result-card'), 'result payoff card');
ok(html.includes('runBeamThenMatch'), 'beam then reveal sequence');
ok(html.includes('result-rating'), 'result rating slot');
ok(html.includes('Ready.') || html.includes('Website published'), 'build-ready payoff');
ok(html.includes('Creating website') || html.includes('Creating website…'), 'demo build: website');
ok(html.includes('understand:') || html.includes('Pressure Washing'), 'demo understand phase');
ok(html.includes('Website published') || html.includes('Website published…'), 'demo build: publish');
ok(html.includes('pushTags') || html.includes('Understanding your business'), 'two-phase demo reveal');
ok(!/conveyor-arrow/.test(html), 'no arrow connectors');
ok(!/phone-bezel/.test(html), 'not a phone mockup stack');
ok(!/We found someone/.test(html), 'no stage labels — motion tells story');
ok(!/min-height:100svh/.test(html) && !/max-height:100svh/.test(html), 'hero is shorter than full viewport');
ok(/\.hero\{[\s\S]*?min-height:0/.test(html), 'hero height follows content');
ok(/\.hero-float\{[\s\S]*?align-self:start/.test(html), 'AI demo sits toward the top');
ok(/height:460px/.test(html), 'AI float stack is compact');
ok(/\.nav\{[^}]*position:fixed/.test(html), 'nav overlays hero (no grey band)');
ok(/nav-acts[\s\S]{0,200}btn-brand[\s\S]{0,80}Build My Business/.test(html), 'Build My Business is brand orange CTA in chrome');
ok(/\.hero-inner\{[\s\S]*?align-items:start/.test(html), 'hero content sits higher');
ok(/min-height:min\(92vh/.test(html) || /min-height:min\(92vh,920px\)/.test(html), 'final CTA fills viewport');

ok(/height:184px/.test(html), 'result shell height locked');
ok(html.includes('hideMatchCard') || html.includes('waiting'), 'result card hidden between cycles');
ok(html.includes('hideMatchCard') || html.includes("classList.remove('show'"), 'previous result is fully hidden (no dim ghost)');
ok(!/Keep last match faintly visible/.test(html), 'no dimmed shadow match during Searching');
ok(/transition-delay:\.55s/.test(html) || html.includes('result-cta'), 'payoff CTA staggers in');
ok(!/chip-more/.test(html), 'no + More competing egress in hero');
ok(!/caret/.test(html), 'no dropdown caret on hero CTA');
ok(!/\.paths-grid/.test(html), 'dead path-card CSS removed');
ok(!/<span class="caret"/.test(html), 'no caret markup');
ok(html.includes('ai-result waiting') || html.includes("classList.add('waiting')"), 'match shell starts waiting/hidden');
ok(!/ai-result-card\.dim/.test(html) && !/classList\.add\('dim'\)/.test(html), 'no dim ghost match CSS/JS');
ok(!/\.ai-result-card\{opacity:1!important/.test(html), 'reduced-motion must not force match card visible');

ok(html.includes('ask-fab'), 'Ask Hubly chatbot bubble');
ok(html.includes('id="askFab"'), 'Ask Hubly FAB id');
ok(!/id="askCard"/.test(html), 'Ask Hubly not in conveyor card');
ok(html.includes('translateX'), 'chat slides from the right');
ok(/askFloat[\s\S]{0,120}hidden/.test(html), 'chat hidden by default');
ok(html.includes('setOpen(false)'), 'chat forced closed on load');
ok(!/Talk to Hubly/.test(html), 'no competing Talk to Hubly CTA');

const heroBlock = html.match(/<section class="hero"[\s\S]*?<\/section>/)?.[0] || '';
ok(/Tell Hubly about your business/.test(heroBlock), 'business-primary hero headline');
ok(/Ask Hubly/.test(heroBlock), 'Ask Hubly available in hero');
ok(/Build My Business/.test(heroBlock), 'Build My Business path in hero');
ok(/Most software makes you learn how it works/.test(heroBlock), 'brand why in hero');
ok(!/Get Matched/.test(heroBlock), 'old Get Matched label removed from hero');

const primaryNav = html.match(/<nav class="nav-links"[^>]*>[\s\S]*?<\/nav>/i)?.[0] || '';
ok(!/Marketplace/i.test(primaryNav), 'Marketplace not in primary nav');
ok(/Ask Hubly/.test(primaryNav), 'Ask Hubly in primary nav');

if (failed) process.exit(1);
console.log('OK homepage craftsmanship checks passed');
