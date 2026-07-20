#!/usr/bin/env node
import fs from 'fs';

const files = ['hubly.html', 'public/hubly.html'];
const required = [
  'nav-menu-btn',
  'nav-drawer-close',
  'app-nav-backdrop',
  'nav-drawer-open',
  'openMobileNav',
  'closeMobileNav',
  'toggleMobileNav',
  'isMobileNavLayout',
  'hamburger + slide-out drawer',
];
const forbidden = [
  'bottom tab bar instead of side nav',
  'flex-direction:row;align-items:stretch;justify-content:space-around',
];

let failed = false;
for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  for (const needle of required) {
    if (!html.includes(needle)) {
      console.error(`FAIL ${file}: missing ${needle}`);
      failed = true;
    }
  }
  for (const needle of forbidden) {
    if (html.includes(needle)) {
      console.error(`FAIL ${file}: still has bottom-tab pattern: ${needle}`);
      failed = true;
    }
  }
  // Mobile drawer should slide from the right, not sit as a bottom bar
  if (!html.includes('transform:translateX(105%)')) {
    console.error(`FAIL ${file}: missing off-canvas translate`);
    failed = true;
  }
  if (!html.includes('onclick="toggleMobileNav()"')) {
    console.error(`FAIL ${file}: hamburger not wired`);
    failed = true;
  }
  if (!html.includes('try{closeMobileNav();}catch(e){}')) {
    console.error(`FAIL ${file}: switchV should close drawer`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log('OK mobile nav drawer checks passed');
