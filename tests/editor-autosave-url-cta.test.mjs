import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");

test("mobile site link is a compact single-row ellipsis + Copy (not a huge crushed column)", () => {
  const marker = "Compact link row under Home/Menu";
  assert.match(html, new RegExp(marker));
  const block = html.slice(html.indexOf(marker), html.indexOf(marker) + 1800);
  assert.match(block, /flex-direction:row!important/);
  assert.match(block, /flex-wrap:nowrap!important/);
  assert.match(block, /text-overflow:ellipsis!important/);
  assert.match(block, /white-space:nowrap!important/);
  assert.match(block, /max-height:44px/);
  // Label must not claim width:100% in a row flex (that crushed the URL)
  assert.doesNotMatch(block, /ed-site-url-label[\s\S]{0,120}width:100%/);
  assert.match(html, /function updateEdSiteUrlBar[\s\S]*?normalizePublicSiteHref|function updateEdSiteUrlBar[\s\S]*?publicProfileHref/);
  assert.match(html, /Your link/);
});

test("Book Now CTA opens a text editor pop instead of inline contenteditable", () => {
  const inline = html.slice(
    html.indexOf("const WS_PE_INLINE_TYPES"),
    html.indexOf("function isWsPeInlineType")
  );
  assert.doesNotMatch(inline, /'cta'/);
  assert.doesNotMatch(inline, /'cta-secondary'/);
  assert.match(html, /Book Now button/);
  assert.match(html, /function liveWsPeCta/);
  assert.match(html, /function applyWsPeCtaSave/);
  assert.match(html, /pe==='cta'\|\|pe==='cta-secondary'/);
});

test("website changes auto-save quietly and replace Save & publish chrome", () => {
  assert.match(html, /function scheduleWebsitePersist/);
  assert.match(html, /function setEdSaveStatus/);
  assert.match(html, /id="ed-save-status"/);
  assert.match(html, /saveStorefront\(\{quiet:true\}\)/);
  assert.match(html, /#v-editor \.ed-top-actions \.btn-save-main\{display:none!important\}/);
  assert.match(html, /async function saveStorefront\(opts\)/);
  assert.match(html, /S\._saveStorefrontQueued/);
});

test("photo and portfolio edits persist without a manual publish tap", () => {
  assert.match(html, /function removeEdPort[\s\S]*?scheduleWebsitePersist/);
  assert.match(html, /function handleEdOwnerPhoto[\s\S]*?hostBrandImage\('owner'/);
  assert.match(html, /function handleEdOwnerPhoto[\s\S]*?scheduleWebsitePersist/);
  assert.match(html, /function applyCtaText[\s\S]*?scheduleWebsitePersist/);
  assert.match(html, /function onWebsiteFieldChange[\s\S]*?scheduleWebsitePersist/);
});
