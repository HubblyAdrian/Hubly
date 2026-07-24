#!/usr/bin/env node
/**
 * Booking / profile links are https://{slug}.myhubly.app
 * Milestone 2.5 — apex `/` serves Welcome (hubly.html); legacy marketing at /platform.
 * Business subdomains must still get hubly.html storefront — never platform marketing.
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const require = createRequire(import.meta.url);
const router = require(path.join(root, 'api/router.js'));
const { isBusinessSubdomain } = router;

let failed = false;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  }
}

assert(typeof isBusinessSubdomain === 'function', 'isBusinessSubdomain exported');
assert(isBusinessSubdomain({ headers: { host: 'bucket-mobile-detailing.myhubly.app' } }), 'slug.myhubly.app is business');
assert(isBusinessSubdomain({ headers: { host: 'acme.hubly.app' } }), 'slug.hubly.app is business');
assert(isBusinessSubdomain({ headers: { 'x-forwarded-host': 'acme.myhubly.app, vercel.com' } }), 'x-forwarded-host works');
assert(!isBusinessSubdomain({ headers: { host: 'myhubly.app' } }), 'apex is not business');
assert(!isBusinessSubdomain({ headers: { host: 'www.myhubly.app' } }), 'www is not business');
assert(!isBusinessSubdomain({ headers: { host: 'localhost' } }), 'localhost is not business');

function mockRes() {
  const r = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    },
  };
  return r;
}

async function hit(host, url = '/') {
  const res = mockRes();
  await router({ url, headers: { host } }, res);
  return res;
}

const hublyMarker = 'id="p-storefront"';
const welcomeMarker = 'data-welcome-experience';

const apex = await hit('myhubly.app', '/');
assert(
  String(apex.body || '').includes(welcomeMarker) || String(apex.body || '').includes(hublyMarker),
  'apex / should serve hubly.html Welcome (M2.5)'
);

const platform = await hit('myhubly.app', '/platform');
assert(
  String(platform.body || '').includes('Get Done') ||
    String(platform.body || '').toLowerCase().includes('marketplace') ||
    fs.readFileSync(path.join(root, 'public/platform-home.html'), 'utf8').slice(0, 200) ===
      String(platform.body || '').slice(0, 200),
  '/platform should serve legacy platform-home.html'
);

const sub = await hit('bucket-mobile-detailing.myhubly.app', '/');
assert(String(sub.body || '').includes(hublyMarker), 'business subdomain / must serve hubly.html (p-storefront)');
assert(
  !String(sub.body || '').includes('id="platform-home"') &&
    !/Platform Entry|Choose your path/i.test(String(sub.body || '').slice(0, 2500)),
  'business subdomain must not serve platform landing'
);

const hublySrc = fs.readFileSync(path.join(root, 'public/hubly.html'), 'utf8');
assert(hublySrc.includes('function getSlugFromHost'), 'client still resolves slug from host');
assert(hublySrc.includes('function publicProfileHref'), 'copy link still builds subdomain URL');
assert(hublySrc.includes("return 'https://'+publicProfileHost(slug)"), 'copied link is https subdomain');
assert(hublySrc.includes('function openProductionBusinessHome'), 'M2.5 production Business Home wiring');
assert(hublySrc.includes('function preferM2ExperienceHome'), 'M2.5 prefers Business Home over classic Dashboard');

if (failed) process.exit(1);
console.log('OK booking link subdomain + M2.5 production routing checks passed');
