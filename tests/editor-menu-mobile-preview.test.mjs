import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");

test("mobile app drawer opens from the left to match the hamburger", () => {
  const mobile = html.slice(html.lastIndexOf("/* App: hamburger"));
  assert.match(mobile, /left:0;right:auto/);
  assert.match(mobile, /transform:translateX\(-105%\)/);
  assert.doesNotMatch(mobile.slice(0, 800), /transform:translateX\(105%\)/);
  assert.match(html, /body\.nav-drawer-open[\s\S]{0,400}transform:translateX\(0\)!important/);
});

test("editor Menu toggle sits with Home on the left (before URL / Save)", () => {
  const bar = html.slice(
    html.indexOf('class="ed-top-bar"'),
    html.indexOf('id="ed-settings-rail-scrim"') > 0
      ? html.indexOf("<!-- Collapsed rail stub")
      : html.indexOf('id="ed-settings-rail"')
  );
  const homeIdx = bar.indexOf("ed-back-home");
  const menuIdx = bar.indexOf("ed-settings-rail-toggle");
  const actionsIdx = bar.indexOf("ed-top-actions");
  assert.ok(homeIdx > -1 && menuIdx > homeIdx, "Menu follows Home");
  assert.ok(actionsIdx > menuIdx, "Save actions come after Menu");
  assert.doesNotMatch(
    bar.slice(actionsIdx),
    /ed-settings-rail-toggle/,
    "Menu is not inside ed-top-actions (right cluster)"
  );
});

test("inline edit defaults to caret focus without forced select-all", () => {
  const start = html.slice(
    html.indexOf("function startWsPeInlineEdit"),
    html.indexOf("function finishWsPeInlineEdit")
  );
  assert.match(start, /opts\.selectAll===true/);
  assert.doesNotMatch(start, /opts\.selectAll!==false/);
  assert.match(html, /startWsPeInlineEdit\(target,\{selectAll:false\}\)/);
  assert.doesNotMatch(html, /startWsPeInlineEdit\([^)]*selectAll:true/);
});

test("narrow viewports default the website editor to phone preview", () => {
  assert.match(html, /function preferEdPhonePreview/);
  assert.match(html, /function ensureEdPhonePreviewDefault/);
  assert.match(html, /matchMedia\('\(max-width:900px\)'\)\.matches/);
  assert.match(html, /S\.edPreviewDevice='phone'/);
  assert.match(html, /ensureEdPhonePreviewDefault\(\);applyEdPreviewDevice/);
  // Full-bleed phone canvas on real phones (no inset 390px frame)
  assert.match(html, /On a real phone the device already IS mobile/);
  assert.match(html, /\.ed-prev\.ed-preview-phone[\s\S]{0,280}max-width:none!important/);
});

test("public booking surfaces get phone-first layout rules", () => {
  assert.match(html, /Public booking \+ landing — phone-first/);
  assert.match(html, /\.ws-bk-svc-grid\{grid-template-columns:1fr/);
  assert.match(html, /\.ws-bk-site\.ws-bk-list \.ws-bk-svc-card\{flex-direction:column\}/);
  assert.match(html, /\.bk-prog-lbl\{display:none\}/);
  assert.match(html, /\.booking-shell\{height:100dvh/);
});
