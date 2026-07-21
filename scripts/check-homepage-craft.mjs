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

// Craft rules — AI business partner story (layout locked; messaging updated)
ok(html.includes('Build My Business'), 'hero owns Build My Business CTA');
ok(html.includes('id="heroHelpCta"') || html.includes('I Need Help'), 'hero owns I Need Help CTA');
ok(!/nav-acts[\s\S]{0,400}I Need Help/i.test(html), 'header must not duplicate I Need Help');
ok(!/\|\s*'help'\s*\)/.test(html) && !/\|\|\s*'help'/.test(html), 'empty CTA must not seed fake "help" prompt');
ok(html.includes("'/signup'") || html.includes('"/signup"'), 'empty CTA can open Instant Site');
ok(html.includes("'/get-done'") || html.includes('"/get-done"'), 'empty help CTA can open Get Done');
ok(html.includes('function goHelp'), 'help path routing helper');
ok(html.includes('I Need Help'), 'homeowner path CTA');
ok(html.includes('Get Help'), 'Get Help nav/footer language');
ok(html.includes('easiest way to start and run'), 'hero promise line under lead');
ok(html.includes('focus on your customers'), 'transformation subheadline');
ok(!/\bHubly Pro\b/i.test(html), 'no Hubly Pro branding');
ok(html.includes('Let Hubly') && html.includes('build your business'), 'build-business path in For Businesses');
ok(html.includes('Find a Pro') || html.includes('find the right pro'), 'homeowner path language');
ok(html.includes('Start Getting Jobs') || html.includes('start getting jobs'), 'jobs path without Marketplace label');
ok(!/\bJoin Marketplace\b/i.test(html), 'no Join Marketplace customer language');
ok(!/\bMarketplace\b/i.test(html.replace(/href="\/marketplace"/g, '')), 'Marketplace word not in customer copy');
ok(html.includes('Businesses Hubly already'), 'industries understands headline');
ok(html.includes('If your business isn’t here') || html.includes("If your business isn't here"), 'learn-with-you industries subtext');
ok(html.includes('Built around your business'), 'signature brand message');
ok(html.includes('Optimized Blueprint'), 'blueprint badges');
ok(html.includes('Don’t see your business') || html.includes("Don't see your business"), 'custom business CTA');
ok(html.includes('Your Business'), 'Your Business card/banner');
ok(html.includes('ind-feature-grid'), 'featured blueprint cards');
ok(html.includes('ind-build'), 'custom blueprint banner');
ok(html.includes('Verified Professionals'), 'trust: verified');
ok(html.includes('Secure Payments'), 'trust: payments');
ok(!/20,000\+\s*Happy/i.test(html), 'no fabricated homeowner count');
ok(html.includes('hubly-lockup') || html.includes('hubly-wordmark'), 'brand wordmark');
ok(html.includes('ai-demo') || html.includes('Hubly understands'), 'AI understanding demo');
ok(html.includes('photo-1604014237800'), 'home-services hero imagery');
ok(html.includes('How Hubly builds your business'), 'how section labeling');
ok(html.includes('Everything your business needs'), 'features as outcomes not software pitch');
ok(html.includes('No setup. No templates. No complicated software.'), 'anti-software framing');

// Live AI demo — one workflow connected by motion
ok(html.includes('ai-flow'), 'unified AI flow stage');
ok(html.includes('ai-beam'), 'motion connector beam');
ok(html.includes('ai-result-card'), 'match result payoff card');
ok(html.includes('runBeamThenMatch'), 'beam then match sequence');
ok(html.includes('★★★★★') || html.includes('result-rating'), 'rating in match payoff');
ok(html.includes('Ready.') || html.includes('Start booking customers'), 'build-ready payoff CTA');
ok(html.includes('Understanding your business'), 'demo progress: understanding');
ok(html.includes('Creating your website'), 'demo progress: website');
ok(!/conveyor-arrow/.test(html), 'no arrow connectors');
ok(!/phone-bezel/.test(html), 'not a phone mockup stack');
ok(!/We found someone/.test(html), 'no stage labels — motion tells story');
ok(!/min-height:100svh/.test(html) && !/max-height:100svh/.test(html), 'hero is shorter than full viewport');
ok(/\.hero\{[\s\S]*?min-height:0/.test(html), 'hero height follows content');
ok(/\.hero-float\{[\s\S]*?align-self:start/.test(html), 'Hubly understands sits toward the top');
ok(/height:460px/.test(html), 'AI float stack is compact');
ok(/\.nav\{[^}]*position:fixed/.test(html), 'nav overlays hero (no grey band)');
ok(/nav-acts[\s\S]{0,200}btn-brand[\s\S]{0,80}Build My Business/.test(html), 'Build My Business is brand orange CTA');
ok(/\.hero-inner\{[\s\S]*?align-items:start/.test(html), 'hero content sits higher');

ok(/height:184px/.test(html), 'result shell height locked');
ok(html.includes('hideMatchCard') || html.includes('waiting'), 'match card hidden between cycles');
ok(html.includes('hideMatchCard') || html.includes("classList.remove('show'"), 'previous match is fully hidden (no dim ghost)');
ok(!/Keep last match faintly visible/.test(html), 'no dimmed shadow match during Searching');
ok(/transition-delay:\.55s/.test(html) || html.includes('result-cta'), 'payoff CTA staggers in');
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
ok(/Build My Business/.test(heroBlock), 'Build My Business in hero');
ok(/I Need Help/.test(heroBlock), 'I Need Help secondary in hero');
ok(/heroHelpCta/.test(heroBlock), 'help CTA is a first-class hero control');
ok(/Tell Hubly about your business/.test(heroBlock), 'hero headline tells Hubly');
ok(/easiest way to start and run/.test(heroBlock), 'promise line in hero');
ok(!/Get Matched/.test(heroBlock), 'old Get Matched label removed from hero');
ok(!/<button[^>]*class="[^"]*btn-brand[^"]*"[^>]*>[^<]*Ask/i.test(heroBlock), 'Ask Hubly is not a brand button');

const primaryNav = html.match(/<nav class="nav-links"[^>]*>[\s\S]*?<\/nav>/i)?.[0] || '';
ok(!/Marketplace/i.test(primaryNav), 'Marketplace not in primary nav');
ok(/Get Help/.test(primaryNav), 'Get Help in primary nav');

if (failed) process.exit(1);
console.log('OK homepage craftsmanship checks passed');
