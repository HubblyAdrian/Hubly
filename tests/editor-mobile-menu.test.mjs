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
  assert.match(html, /onclick="toggleEdSettingsRail\(\)"/);
  assert.match(html, /class="[^"]*ed-settings-rail-toggle/);
  assert.match(html, /aria-controls="ed-settings-rail"/);
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
