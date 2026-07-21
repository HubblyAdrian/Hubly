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

// Homepage identity — AI business partner (not SaaS feature pitch)
ok(home.includes('Build My Business'), 'hero owns Build My Business CTA');
ok(home.includes('I Need Help'), 'homeowner path CTA');
ok(home.includes('Get Help'), 'Get Help path language');
ok(home.includes('id="heroHelpCta"') || home.includes('function goHelp'), 'help routing from hero');
ok(!/nav-acts[\s\S]{0,400}I Need Help/i.test(home), 'header must not duplicate I Need Help');
ok(!/Get Matched/.test(home), 'old Get Matched label removed');
ok(home.includes('easiest way to start and run'), 'hero promise line');
ok(home.includes('id="grow"'), 'For Businesses section');
ok(home.includes('Let Hubly') && /build your business/i.test(home), 'business path: build');
ok(home.includes('Start Getting Jobs') || home.includes('start getting jobs'), 'jobs path without Marketplace label');
ok(!/\bJoin Marketplace\b/i.test(home), 'no Join Marketplace customer language');
ok(home.includes('Businesses Hubly already'), 'industries understands positioning');
ok(home.includes('Built around your business'), 'signature brand message');
ok(home.includes('Your Business'), 'custom Your Business card');
ok(home.includes('Hubly learns') || home.includes('will learn') || home.includes("we'll learn") || home.includes('we’ll learn'), 'learns-your-business positioning');
ok(!/id="paths"/.test(home), 'no audience classification cards');
ok(home.includes('id="readiness"'), 'Business Readiness stays near footer');
ok(home.includes('licensing'), 'readiness future vision copy');
ok(!/\bHubly Pro\b/i.test(home), 'no Hubly Pro on homepage');
ok(!/\bMarketplace Lite\b/i.test(home), 'no Marketplace Lite on homepage');

if (failed) process.exit(1);
console.log('OK onboarding identity craftsmanship checks passed');
