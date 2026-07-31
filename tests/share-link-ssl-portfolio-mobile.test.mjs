import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");
const journey = fs.readFileSync(path.join(root, "public/journey-os/journey.js"), "utf8");
const studio = fs.readFileSync(path.join(root, "public/journey-os/hubly-studio.js"), "utf8");

test("share / copy links always use https://{slug}.myhubly.app — never dead alternate hosts", () => {
  assert.match(html, /function getHublyDomain\(\)\s*\{[\s\S]*?return 'myhubly\.app'/);
  assert.match(html, /function publicProfileHref[\s\S]*?return 'https:\/\/'\+publicProfileHost/);
  assert.match(html, /function normalizePublicSiteHref/);
  assert.match(html, /hubly\.site/);
  assert.doesNotMatch(journey, /\.hubly\.site/);
  assert.doesNotMatch(journey, /'\.hubly\.site'/);
  assert.match(journey, /function storefrontPublicUrl\(\)\s*\{[\s\S]*?return storefrontUrl\(\)/);
  assert.match(journey, /storefrontSlug\(\) \+ '\.myhubly\.app'/);
  const copyHome = journey.slice(
    journey.indexOf("act === 'home-copy-site'"),
    journey.indexOf("act === 'stripe'")
  );
  assert.match(copyHome, /normalizePublicSiteHref|publicProfileHref|storefrontUrl/);
  assert.doesNotMatch(copyHome, /hubly\.site/);
  assert.match(html, /isArchitectSlug[\s\S]*?getHublyDomain\(\)/);
});

test("mobile portfolio Add photos uses body-mounted file input in tap stack", () => {
  const ensure = html.slice(
    html.indexOf("function ensureWsPeFileInputs"),
    html.indexOf("function pickProfileLogo")
  );
  assert.match(ensure, /ed-port-file/);
  assert.match(ensure, /handleEdPortfolio/);
  assert.match(ensure, /multiple/);
  assert.match(ensure, /document\.body\.appendChild/);
  assert.match(ensure, /\.heic/);
  const pick = html.slice(
    html.indexOf("function pickGalleryPhotosForAlbum"),
    html.indexOf("function openAddGalleryAlbumFlow")
  );
  assert.match(pick, /ensureWsPeFileInputs/);
  assert.match(pick, /\.heic|showPicker/);
  // Must click before closing pop so Safari keeps the user gesture
  const clickAt = Math.max(pick.indexOf("inp.click()"), pick.indexOf("showPicker"));
  const closeAt = pick.indexOf("closeWsPePop");
  assert.ok(clickAt >= 0 && closeAt > clickAt);
});

test("greeting never says Good morning in the middle of the night", () => {
  const tod = journey.slice(
    journey.indexOf("function timeOfDayGreeting"),
    journey.indexOf("function syncAskFab")
  );
  assert.match(tod, /h >= 5 && h < 12/);
  assert.match(tod, /Good evening/);
  assert.doesNotMatch(tod, /if \(h < 12\) return 'Good morning'/);
  const daily = html.slice(
    html.indexOf("function buildLocalHublyDaily"),
    html.indexOf("async function renderHublyDaily")
  );
  assert.match(daily, /businessHourNow/);
  assert.match(daily, /h>=5&&h<12/);
  assert.match(studio, /hour >= 5 && hour < 12/);
});
