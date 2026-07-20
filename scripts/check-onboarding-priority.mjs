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
ok(html.includes('What kind of work do you love doing most?'), 'love-doing trade question');
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
ok(!/\bHubly Pro\b/i.test(html), 'no Hubly Pro in Instant Site UI strings');
ok(!/\bMarketplace Lite\b/i.test(html), 'no Marketplace Lite in Instant Site UI strings');

// Homepage identity
ok(home.includes('Get Matched'), 'hero owns Get Matched');
ok(!/nav-acts[\s\S]{0,400}Get Matched/i.test(home), 'header must not duplicate Get Matched');
ok(home.includes('Start Free'), 'header business CTA');
ok(home.includes('We’ll help you get booked'), 'outcome-led business copy');
ok(home.includes('id="readiness"'), 'Business Readiness stays near footer');
ok(home.includes('licensing'), 'readiness future vision copy');
ok(!/Hubly Pro/i.test(home), 'no Hubly Pro on homepage');
ok(!/Marketplace Lite/i.test(home), 'no Marketplace Lite on homepage');

if (failed) process.exit(1);
console.log('OK onboarding identity craftsmanship checks passed');
