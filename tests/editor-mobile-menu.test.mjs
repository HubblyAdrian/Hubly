import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");
const layoutCss = fs.readFileSync(path.join(root, "public/journey-os/hubly-layout.css"), "utf8");

test("website editor ships a Menu toggle that calls toggleEdSettingsRail", () => {
  assert.match(html, /id="ed-settings-rail-toggle"/);
  assert.match(html, /onclick="toggleEdSettingsRail\(event\)"/);
  assert.match(html, /class="[^"]*ed-settings-rail-toggle/);
  assert.match(html, /aria-controls="ed-settings-rail"/);
  // Menu lives next to Home so the control matches the left drawer
  const bar = html.slice(html.indexOf('class="ed-top-bar"'), html.indexOf("<!-- Collapsed rail stub"));
  assert.ok(bar.indexOf("ed-back-home") < bar.indexOf("ed-settings-rail-toggle"));
});

test("mobile canvas-mode CSS can hide the settings rail unless is-open", () => {
  // The later canvas-mode flex rule used to defeat collapse — a trailing
  // max-width:900px block must re-assert display:none without .is-open.
  const idxFlex = html.lastIndexOf(
    "#v-editor.ed-canvas-on .ed-settings-rail,\n.ed-shell.ed-canvas-mode .ed-settings-rail{\n  display:flex!important"
  );
  const idxMobileHide = html.lastIndexOf(
    "@media(max-width:900px){\n  #v-editor.ed-canvas-on .ed-settings-rail,\n  .ed-shell.ed-canvas-mode .ed-settings-rail{\n    display:none!important"
  );
  assert.ok(idxFlex > -1, "canvas-mode flex rule present");
  assert.ok(idxMobileHide > idxFlex, "mobile hide rule must come after canvas flex");
  assert.match(html, /\.ed-settings-rail\.is-open\{display:flex!important\}/);
});

test("syncEdSettingsToggleUi updates Menu toggle aria-expanded", () => {
  assert.match(html, /getElementById\('ed-settings-rail-toggle'\)/);
  assert.match(html, /setAttribute\('aria-expanded'/);
  assert.match(html, /Collapse website menu|Open website menu/);
});

test("collapsed desktop stub keeps a 44px reopen column", () => {
  assert.match(layoutCss, /grid-template-columns:\s*44px minmax\(0,\s*1fr\)\s*!important/);
  assert.doesNotMatch(
    layoutCss,
    /ed-settings-collapsed:not\(\.ed-sheet-open\)\s*\{\s*grid-template-columns:\s*0 minmax/
  );
});

test("trailing iPhone block keeps Menu above the inspector sheet", () => {
  const marker = "iPhone / narrow Website editor";
  const idx = html.lastIndexOf(marker);
  assert.ok(idx > -1, "iPhone polish block present");
  const tail = html.slice(idx);
  assert.match(tail, /z-index:5200!important/);
  assert.match(tail, /z-index:5300!important/);
  assert.match(tail, /z-index:5100!important/);
  assert.match(tail, /top:auto!important/);
  assert.match(tail, /ed-device-bar[\s\S]*display:none!important/);
  assert.match(tail, /ed-mobile-tabs[\s\S]*display:none!important/);
  assert.match(tail, /100dvh!important/);
});

test("mobile settings rail is not pinned under a phantom 54px app bar", () => {
  // App bar is hidden in the editor — drawer must start at top:0 (+ safe-area).
  assert.doesNotMatch(
    html,
    /ed-settings-rail[\s\S]{0,180}top:54px!important/
  );
  assert.match(
    html,
    /#v-editor\.ed-canvas-on \.ed-settings-rail,\n  \.ed-shell\.ed-canvas-mode \.ed-settings-rail\{\n    display:none!important;position:fixed!important;left:0!important;top:0!important/
  );
});

test("opening Menu on mobile closes the inspector sheet first", () => {
  assert.match(html, /closeEdSheet\(\)/);
  const openFn = html.slice(html.indexOf("function openEdSettingsRail"), html.indexOf("function closeEdSettingsRail"));
  assert.match(openFn, /closeEdSheet/);
  assert.match(openFn, /ed-settings-rail-open/);
});

test("layout CSS reinforces mobile bottom-sheet inspector", () => {
  assert.match(layoutCss, /max-height:\s*min\(58dvh,\s*520px\)\s*!important/);
  assert.match(layoutCss, /z-index:\s*5100\s*!important/);
});
