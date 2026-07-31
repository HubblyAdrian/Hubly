import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");

test("brand auto-save refuses data URLs and posts slim https meta to Supabase", () => {
  assert.match(html, /function buildPersistableBizMeta/);
  assert.match(html, /function isHttpsAssetUrl/);
  assert.match(html, /function isPersistedHublyBusiness/);
  assert.match(html, /function syncBookingBrandFromSiteMedia/);
  const auto = html.slice(
    html.indexOf("async function autoSaveBrandField"),
    html.indexOf("function sidebarLogoClick")
  );
  assert.match(auto, /refused non-https|Never write data/);
  assert.match(auto, /buildPersistableBizMeta/);
  assert.match(auto, /waitForDb/);
  assert.doesNotMatch(auto, /payload\.meta=buildBizMeta\(\)/);
});

test("hero and booking banners upload to Storage then save banner_url", () => {
  const banner = html.slice(
    html.indexOf("function handleEdBanner"),
    html.indexOf("function handleObBanner")
  );
  assert.match(banner, /hostBrandImage\('banner'/);
  assert.match(banner, /isHttpsAssetUrl\(url\)/);
  assert.match(banner, /autoSaveBrandField\('banner_url'/);
  assert.match(banner, /syncBookingBrandFromSiteMedia/);
  const bk = html.slice(
    html.indexOf("function handleBkBanner"),
    html.indexOf("function selBkBg")
  );
  assert.match(bk, /hostBrandImage\('bk-banner'/);
  assert.match(bk, /autoSaveBrandField\('banner_url'/);
});

test("quiet website persist uses waitForDb and persistable meta", () => {
  const save = html.slice(
    html.indexOf("async function saveStorefront"),
    html.indexOf("function setEdSaveStatus")
  );
  assert.match(save, /buildPersistableBizMeta/);
  assert.match(save, /waitForDb\(12000\)/);
  assert.match(save, /isPersistedHublyBusiness/);
  assert.match(save, /syncBookingBrandFromSiteMedia/);
  assert.match(html, /function scheduleWebsitePersist[\s\S]*?isPersistedHublyBusiness/);
});

test("uploadBrandAsset authenticates and shrinks oversized phone photos", () => {
  const up = html.slice(
    html.indexOf("async function uploadBrandAsset"),
    html.indexOf("async function hostBrandImage")
  );
  assert.match(up, /auth\.getSession/);
  assert.match(up, /compressImageDataUrl/);
  assert.match(up, /brand-assets/);
  assert.match(up, /waitForDb/);
});
