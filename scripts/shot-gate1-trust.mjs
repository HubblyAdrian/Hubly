#!/usr/bin/env node
/** Gate 1 trust proof — fitness Create must not open detailing booking/website. */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.HUBLY_BASE || "http://127.0.0.1:4173";
const outDir = "/opt/cursor/artifacts/ceo-demo";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
const notes = { base, steps: [], fails: [] };

function fail(msg) {
  notes.fails.push(msg);
  console.error("FAIL:", msg);
}

await page.goto(base + "/demo", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(outDir, "19-gate1-demo-start.png") });
notes.steps.push("demo start");

// Jump Create → reveal with fitness studio applied (same surfaces a customer reaches).
const applied = await page.evaluate(async () => {
  const S = window.S;
  if (!S) return { ok: false, reason: "no S" };
  S._ceoDemo = true;
  S._accountClaimed = true;
  const pack =
    typeof HUBLY_HOLY_SHIT !== "undefined"
      ? HUBLY_HOLY_SHIT.inferPack("I'm an independent fitness trainer.")
      : null;
  S._is = S._is || {};
  S._is.discovery = S._is.discovery || {};
  S._is.discovery.holyPack = pack;
  S._is.discovery.holyShitComplete = true;
  S._is.discovery.studio = {
    phase: "website",
    heroTitle: "FitFocus Training",
    logoName: "FitFocus Training",
    heroSub: pack?.rewrite || "Transformations that stick — not another gym pitch.",
    cta: "Book now",
    ctaElevated: true,
    logo: true,
    logoMark: pack?.logo || "PT",
    bookingOn: true,
    packagesOn: true,
    brandOn: true,
    pkgChips: pack?.packages || ["1:1 Coaching", "Transformation Plan", "Accountability"],
    bookingChips: pack?.booking || ["Consult", "Book session"],
    sections: { about: true, services: true, reviews: true },
  };
  if (typeof HublyBlueprints !== "undefined") {
    try {
      await HublyBlueprints.loadAll();
    } catch (e) {}
  }
  if (typeof isApplyCreateStudioToBusiness === "function") isApplyCreateStudioToBusiness();
  if (typeof isRevealRenderReadyCards === "function") isRevealRenderReadyCards({ live: S._is.discovery.studio });
  if (typeof isShowStep === "function") isShowStep("reveal");
  document.getElementById("p-onboard")?.classList.add("active", "is-active");
  document.getElementById("is-shell") && (document.getElementById("is-shell").style.display = "flex");
  return {
    ok: true,
    businessType: S.businessType,
    hero: S.website?.heroHeadline,
    sub: S.website?.heroSub,
    services: (S.services || []).map((s) => s.name),
    bpId: typeof getActiveBlueprint === "function" ? getActiveBlueprint()?.id : null,
    vehicle: typeof blueprintHas === "function" ? !!blueprintHas("vehicleDetails") : null,
  };
});
notes.applied = applied;
if (!applied?.ok) fail("could not apply create studio");
if (applied?.businessType === "detailing") fail("businessType still detailing");
if (applied?.vehicle) fail("vehicleDetails still on for fitness create");
if (/showroom|ride|vehicle/i.test(String(applied?.hero || "") + String(applied?.sub || ""))) {
  fail("website copy still vehicle/detailing: " + applied.hero + " / " + applied.sub);
}
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(outDir, "20-gate1-reveal.png"), fullPage: false });
notes.steps.push("reveal");

// Open booking from reveal
await page.evaluate(() => {
  if (typeof isRevealOpenSurface === "function") isRevealOpenSurface("booking");
});
await page.waitForTimeout(1200);
const booking = await page.evaluate(() => {
  const title =
    document.getElementById("bk-step-1-title-txt")?.textContent ||
    document.getElementById("bk-step-1-title")?.textContent ||
    "";
  const sub = document.getElementById("bk-step-1-sub")?.textContent || "";
  const body = (document.getElementById("p-booking")?.innerText || "").slice(0, 1200);
  return {
    title,
    sub,
    businessType: window.S?.businessType,
    trade: window.HublyBookingSQ?.getCfg?.()?.trade,
    hasRide: /ride dialed|vehicle type|sedan|coupe/i.test(title + " " + sub + " " + body),
    hasSpaLeak: /quiet rooms|licensed practitioners|facial|massage/i.test(body),
    hasSession: /book your session|choose your package|coaching|transformation/i.test(
      title + " " + sub + " " + body,
    ),
    snippet: (title + " | " + sub).trim(),
  };
});
notes.booking = booking;
if (booking.hasRide) fail("booking still feels like detailing: " + booking.snippet);
if (booking.hasSpaLeak) fail("booking still leaking spa chrome: quiet rooms / facial");
if (!booking.hasSession && /ride|vehicle/i.test(booking.snippet)) fail("booking headline wrong: " + booking.snippet);
await page.screenshot({ path: path.join(outDir, "21-gate1-booking.png"), fullPage: false });
notes.steps.push("booking");

// Website
await page.evaluate(() => {
  if (typeof isReturnToRevealFromPreview === "function") isReturnToRevealFromPreview();
});
await page.waitForTimeout(400);
await page.evaluate(() => {
  if (typeof isRevealOpenSurface === "function") isRevealOpenSurface("website");
});
await page.waitForTimeout(1200);
const site = await page.evaluate(() => {
  const text = (document.getElementById("p-storefront")?.innerText || "").slice(0, 2000);
  return {
    hero: window.S?.website?.heroHeadline,
    sub: window.S?.website?.heroSub,
    hasShowroom: /showroom-clean|your driveway|vehicle/i.test(text),
    hasSpaLeak: /gift cards|memberships|licensed(?!\s)/i.test(text) && /spa|facial|massage/i.test(text),
    trust: (window.S?.website?.trustStats || []).map((t) => t.value || t).join(" · "),
    hasOutcome: /transformation|coaching|book now|fitfocus|personal training/i.test(text),
    services: (window.S?.services || []).map((s) => s.name),
  };
});
notes.site = site;
if (site.hasShowroom) fail("website still showing detailing copy");
if (/gift cards|quiet rooms/i.test(site.trust || "")) fail("website trust still spa defaults: " + site.trust);
await page.screenshot({ path: path.join(outDir, "22-gate1-website.png"), fullPage: false });
notes.steps.push("website");

// Home
await page.evaluate(() => {
  if (typeof isReturnToRevealFromPreview === "function") isReturnToRevealFromPreview();
});
await page.waitForTimeout(300);
await page.evaluate(() => {
  if (typeof isRevealContinueToWorkspace === "function") isRevealContinueToWorkspace();
});
await page.waitForTimeout(1200);
const home = await page.evaluate(() => {
  return {
    ready: document.getElementById("dash-ready-line")?.textContent || "",
    stand: document.getElementById("dash-stand-line")?.textContent || "",
    mods: document.getElementById("dash-ops-modules")?.innerText || "",
    customers: (window.S?.customers || []).length,
    businessType: window.S?.businessType,
  };
});
notes.home = home;
if (/website live|booking ready/i.test(home.ready + home.mods)) fail("Home still telling instead of showing");
if (home.customers > 0) fail("CRM faked customers");
await page.screenshot({ path: path.join(outDir, "23-gate1-home.png"), fullPage: false });
notes.steps.push("home");

// CRM
await page.evaluate(() => {
  const n = document.querySelector("#p-app [data-v=customers]");
  if (n && typeof switchV === "function") switchV(n);
  else n?.click();
});
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(outDir, "24-gate1-crm.png"), fullPage: false });
notes.steps.push("crm");

fs.writeFileSync(path.join(outDir, "gate1-trust-v2-notes.json"), JSON.stringify(notes, null, 2));
console.log(JSON.stringify(notes, null, 2));
await browser.close();
if (notes.fails.length) process.exit(1);
console.log("GATE1 TRUST SHOTS OK →", outDir);
