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

test("booking brand follows live site media and clears when owner deletes", () => {
  const getters = html.slice(
    html.indexOf("function getBkBanner"),
    html.indexOf("function renderGradientPicker")
  );
  assert.match(getters, /isHttpsAssetUrl\(S\.bannerUrl\)/);
  assert.match(getters, /isHttpsAssetUrl\(S\.logoUrl\)/);
  const sync = html.slice(
    html.indexOf("function syncBookingBrandFromSiteMedia"),
    html.indexOf("async function hostPortfolioDataUrls")
  );
  assert.match(sync, /S\.bkBannerUrl=null/);
  assert.match(sync, /S\.bkLogoUrl=null/);
  const clearBanner = html.slice(
    html.indexOf("function clearHeroBanner"),
    html.indexOf("function syncWsPeLogoScaleButtons")
  );
  assert.match(clearBanner, /syncBookingBrandFromSiteMedia/);
  const clearLogo = html.slice(
    html.indexOf("function clearProfileLogo"),
    html.indexOf("function ensureWsPeFileInputs")
  );
  assert.match(clearLogo, /syncBookingBrandFromSiteMedia/);
});

test("saveStorefront does not resurrect cleared banner/logo URLs", () => {
  const save = html.slice(
    html.indexOf("async function saveStorefront"),
    html.indexOf("function setEdSaveStatus")
  );
  assert.match(save, /resolveBrandCol/);
  assert.match(save, /if\(live==null\|\|live===''\)return null/);
  // Meta must be built after booking brand sync so bk* matches live site.
  const syncAt = save.indexOf("syncBookingBrandFromSiteMedia()");
  const metaAt = save.lastIndexOf("buildPersistableBizMeta()");
  assert.ok(syncAt >= 0 && metaAt >= 0 && syncAt < metaAt);
});

test("hostPortfolioDataUrls uploads package/service photos before strip", () => {
  const host = html.slice(
    html.indexOf("async function hostPortfolioDataUrls"),
    html.indexOf("function mergePriorHttpsGalleryIntoMeta")
  );
  assert.match(host, /S\.editorSvcs/);
  assert.match(host, /remapSvc/);
  assert.match(host, /buildServiceCatalogFromEditor/);
  const pe = html.slice(
    html.indexOf("function handlePeSvcPhoto"),
    html.indexOf("function applyWsPeService")
  );
  assert.match(pe, /scheduleEditorCatalogPersist|saveStorefront/);
});

test("load reconciles booking brand from live columns after meta", () => {
  const loadBiz = html.slice(
    html.indexOf("async function loadBusiness"),
    html.indexOf("async function loadPublicProfile")
  );
  assert.match(loadBiz, /S\.bannerUrl=data\.banner_url/);
  assert.match(loadBiz, /syncBookingBrandFromSiteMedia/);
  const loadPub = html.slice(
    html.indexOf("async function loadPublicProfile"),
    html.indexOf("function isPasswordRecoveryUrl")
  );
  assert.match(loadPub, /syncBookingBrandFromSiteMedia/);
});
