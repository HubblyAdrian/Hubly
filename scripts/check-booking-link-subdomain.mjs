#!/usr/bin/env node
/**
 * Booking / profile links are https://{slug}.myhubly.app
 * Phase 6.5 made `/` always serve platform-home.html — that broke subdomains.
 * Assert business subdomains get hubly.html, apex still gets the platform home.
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
const platformMarker = 'platform-home';

const apex = await hit('myhubly.app', '/');
assert(
  String(apex.body || '').includes('Get Done') ||
    String(apex.body || '').toLowerCase().includes('marketplace') ||
    fs.readFileSync(path.join(root, 'public/platform-home.html'), 'utf8').slice(0, 200) ===
      String(apex.body || '').slice(0, 200),
  'apex / should serve platform-home.html'
);
assert(!String(apex.body || '').includes(hublyMarker) || String(apex.body || '').includes('Get Done'), 'apex should not be owner SPA only');

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

if (failed) process.exit(1);
console.log('OK booking link subdomain routing checks passed');
