#!/usr/bin/env node
/**
 * Guard the /get-done conversation pattern:
 * Hubly asks (left / .hubly); the customer answers (right / .user).
 * Follow-up chips must never submit Hubly's question text as a user turn.
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

ok(html.includes('function showFollowUps'), 'showFollowUps exists');
ok(html.includes('answerChoicesForFollowUp'), 'follow-ups map to answer choices');
ok(html.includes('looksLikeHublyQuestion'), 'detect Hubly questions');

// Regression: chip click used to do submitNeed(q) with the question string
const followFn = html.match(/function showFollowUps\([\s\S]*?\n  function /);
ok(!!followFn, 'can isolate showFollowUps');
if (followFn) {
  const body = followFn[0];
  ok(!/submitNeed\(\s*q\s*\)/.test(body), 'do not submitNeed(q) — q is Hubly\'s question');
  ok(!/input\.value\s*=\s*q/.test(body), 'do not put Hubly questions into the composer as sends');
  ok(/submitNeed\(\s*a\s*\)/.test(body), 'answer chips may submitNeed(a)');
}

ok(html.includes("className = 'bubble ' + (role === 'user' ? 'user' : 'hubly')"), 'role → bubble class');

if (failed) process.exit(1);
console.log('OK get-done talking pattern checks passed');
