#!/usr/bin/env node
/**
 * Fast Customer Journey OS gate.
 * - Completes in <10s (hard fail at 30s)
 * - Never hangs on catastrophic regex over hubly.html
 * - Always exits 0 (pass) or 1 (fail)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TIMEOUT_MS = 30_000;
const started = Date.now();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
let current = "boot";

const timer = setTimeout(() => {
  console.error(`TIMEOUT after ${TIMEOUT_MS}ms while checking: ${current}`);
  process.exit(1);
}, TIMEOUT_MS);
timer.unref?.();

function mark(label) {
  current = label;
  console.log(`… ${label}`);
}

function ok(name, cond) {
  if (!cond) {
    console.error(`FAIL ${name}`);
    failures.push(name);
  } else {
    console.log(`OK ${name}`);
  }
}

function read(rel) {
  mark(`read ${rel}`);
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return "";
  return fs.readFileSync(abs, "utf8");
}

function has(hay, needle) {
  return hay.indexOf(needle) !== -1;
}

/** Sequential order check without catastrophic regex. */
function inOrder(hay, parts) {
  let from = 0;
  for (const part of parts) {
    const i = hay.indexOf(part, from);
    if (i === -1) return false;
    from = i + part.length;
  }
  return true;
}

/** Pull a bounded slice around the app nav to keep scans cheap. */
function navSlice(html) {
  const start = html.indexOf('id="app-nav"');
  const alt = html.indexOf("class=\"app-nav\"");
  const at = start !== -1 ? start : alt;
  if (at === -1) return html.slice(0, Math.min(html.length, 200_000));
  return html.slice(at, Math.min(html.length, at + 120_000));
}

try {
  mark("exists journey.css");
  ok("files", fs.existsSync(path.join(root, "public/journey-os/journey.css")));

  const px = read("public/journey-os/operate-pixel.css");
  ok(
    "operate-pixel.css",
    has(px, "#p-app.jos-pixel") && has(px, "--jos-sidebar")
  );

  const router = read("api/router.js");
  ok("router", has(router, "journey-os/"));

  const hubly = read("public/hubly.html");
  const nav = navSlice(hubly);

  mark("check screenshot nav");
  ok(
    "screenshot nav",
    has(nav, 'ni-lbl">Home<') &&
      has(nav, 'ni-lbl">Inbox<') &&
      has(nav, 'ni-lbl">Storefront<') &&
      has(nav, 'ni-lbl">Revenue<') &&
      has(nav, 'ni-lbl">Ask Hubly<') &&
      has(nav, 'ni-lbl">Settings<')
  );

  mark("check nav order");
  ok(
    "nav order",
    inOrder(nav, [
      "Home",
      "Inbox",
      "Jobs",
      "Leads",
      "Customers",
      "Pipeline",
      "Storefront",
      "Marketing",
      "Reviews",
      "Memberships",
      "Revenue",
      "Reports",
      "Ask Hubly",
      "Settings",
    ])
  );

  const jjs = read("public/journey-os/journey.js");
  mark("check pixel shell (Home)");
  ok(
    "pixel shell",
    has(hubly, "jos-pixel") &&
      has(hubly, "operate-pixel.css") &&
      has(jjs, "enhanceDashboard") &&
      has(jjs, "renderHomeDashboard") &&
      has(jjs, "wireGlobalChrome") &&
      has(jjs, "openQuickNew")
  );

  mark("check views (Home)");
  ok(
    "views",
    has(hubly, 'id="v-dashboard"') &&
      has(hubly, 'id="jos-dash-root"') &&
      has(hubly, 'id="jos-global-search"') &&
      has(hubly, "jos-bar-bell") &&
      has(hubly, 'id="jos-bar-ask"')
  );

  mark("check api");
  ok(
    "api",
    has(jjs, "renderPipeline") &&
      has(jjs, "openCustomerProfile") &&
      has(jjs, "openQuickNew")
  );

  const home = read("public/platform-home.html");
  mark("check landing");
  ok(
    "landing",
    has(hubly, "Build your business") && has(home, "Build your business")
  );

  mark("check script link");
  ok("script", has(hubly, "journey-os/journey.js"));

  const ceo = read("public/journey-os/ceo-demo.js");
  mark("check ceo demo");
  ok(
    "ceo demo",
    has(hubly, "/demo") &&
      has(hubly, "p-ceo-demo") &&
      has(hubly, "startCeoDemoMode") &&
      has(ceo, "Pro Shine Detailing")
  );

  mark("check create live build");
  ok(
    "create live build",
    has(hubly, "I'm building this live so you can watch it take shape") &&
      has(hubly, "isRunCreativeBuildExperience")
  );

  mark("check brand accent");
  ok("brand accent", has(px, "#D9632D") && !has(px, "#6366F1"));

  mark("check home part1");
  ok(
    "home part1",
    has(jjs, "enhanceDashboard") &&
      has(jjs, "AI Morning Brief") &&
      has(jjs, "Revenue Today") &&
      has(jjs, "Messages Waiting") &&
      has(jjs, "Growth Score") &&
      has(jjs, "hubly_home_layout_v1") &&
      has(jjs, "runGlobalSearch") &&
      has(jjs, "jos-qa-tile") &&
      has(jjs, "Reschedule")
  );

  mark("check home css");
  ok(
    "home css",
    has(px, "jos-kpi-hover") &&
      has(px, "jos-qa-grid") &&
      has(px, "jos-weather") &&
      has(px, "jos-route-map") &&
      has(px, "jos-search-pop")
  );

  const ms = Date.now() - started;
  mark("done");
  clearTimeout(timer);
  if (failures.length) {
    console.error(`FAIL (${failures.length}) in ${ms}ms`);
    process.exit(1);
  }
  console.log(`PASS in ${ms}ms`);
  process.exit(0);
} catch (err) {
  clearTimeout(timer);
  console.error(`ERROR while checking: ${current}`);
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
}
