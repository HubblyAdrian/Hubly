#!/usr/bin/env node
import fs from 'fs';

const html = fs.readFileSync('public/hubly.html', 'utf8');
const home = fs.readFileSync('public/platform-home.html', 'utf8');
let failed = false;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  }
}

// Conversational Instant Site — consultant onboarding
ok(html.includes('isTalkIntro'), 'intro opener key');
ok(html.includes("Hi! I’m Hubly. Before we build anything"), 'consultant intro copy');
ok(html.includes('Tell me about your business'), 'free-form business question');
ok(html.includes('function isTalkPriorityChips'), 'priority chips helper');
ok(html.includes('function isTalkPickPriority'), 'priority pick helper');
ok(html.includes("core.push('priority')"), 'priority in progress beats');
ok(html.includes("isTalkGo('priority'"), 'flow advances to priority');
ok(html.includes('Get more bookings'), 'bookings chip');
ok(html.includes('Run my business'), 'run chip');
ok(html.includes('Grow my business'), 'grow chip');
ok(html.includes('isTalkCelebrateStarted'), 'just-started celebration');
ok(html.includes('businessProfile:{'), 'business profile memory in meta');
ok(html.includes('workLove'), 'workLove memory');
ok(html.includes('onboardingPriority'), 'onboardingPriority memory');
ok(html.includes('const HublyAI='), 'Hubly AI shared layer');
ok(html.includes('coachWelcomeBookings'), 'coach personalized for bookings');
ok(html.includes('coachWelcomeRun'), 'coach personalized for run');
ok(html.includes('coachWelcomeGrow'), 'coach personalized for grow');
ok(html.includes('function isTalkAcceptCustomBusiness'), 'custom business path accepted');
ok(html.includes('Something unique — let’s build it') || html.includes("Something unique"), 'unique business chip');
ok(!/\bHubly Pro\b/i.test(html), 'no Hubly Pro in Instant Site UI strings');
ok(!/\bMarketplace Lite\b/i.test(html), 'no Marketplace Lite in Instant Site UI strings');

// Homepage identity — compressed continuous story
ok(home.includes('One AI. Two experiences.'), 'bridge connects audiences');
ok(home.includes('Most software makes you learn how it works.'), 'brand why sentence');
ok(home.includes('Hubly learns how you work'), 'brand why payoff');
ok(home.includes('Ask Hubly'), 'Ask Hubly interface');
ok(home.includes('What do you need help with'), 'ask-first consumer hero');
ok(home.includes('Build My Business'), 'business CTA');
ok(home.includes('Finished.') || home.includes('Building website'), 'build demo reveal');
ok(home.includes('Imagine never setting up software'), 'emotional outcome');
ok(home.includes('Stop learning software'), 'closing CTA');
ok(home.includes('journey-steps') || home.includes('how-lane'), 'how merged into journeys');
ok(!/\bI Need Help\b/.test(home), 'I Need Help retired');
ok(!/\bFind Help\b/.test(home), 'Find Help replaced by Ask Hubly');
ok(home.includes('id="journeys"'), 'journey destinations');
ok(home.includes('How can Hubly help'), 'journey question');
ok(home.includes('function goHelp'), 'help routing from hero');
ok(!/Get Matched/.test(home), 'old Get Matched label removed');
ok(home.includes('id="grow"'), 'business section');
ok(home.includes('Tell Hubly about your business'), 'business path: tell Hubly');
ok(home.includes('Businesses Hubly already'), 'understands section');
ok(home.includes('These are just a few businesses Hubly already knows'), 'industries examples not limits');
ok(home.includes('Get Found by Customers') || home.includes('Get found by customers') || home.includes('Send You Customers') || home.includes('send you customers'), 'get-found not Marketplace');
ok(!/\bJoin Marketplace\b/i.test(home), 'no Join Marketplace customer language');
ok(home.includes('Built around your business'), 'signature brand message');
ok(!/id="paths"/.test(home), 'no old paths classification id');
ok(home.includes('id="readiness"'), 'Business Readiness note remains');
ok(home.includes('licensing'), 'readiness future vision copy');
ok(!/\bHubly Pro\b/i.test(home), 'no Hubly Pro on homepage');
ok(!/\bMarketplace Lite\b/i.test(home), 'no Marketplace Lite on homepage');
ok((home.match(/<section\b/g) || []).length <= 7, 'homepage compressed to fewer sections');

if (failed) process.exit(1);
console.log('OK onboarding identity craftsmanship checks passed');
