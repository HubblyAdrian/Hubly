import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");
const layoutCss = fs.readFileSync(path.join(root, "public/journey-os/hubly-layout.css"), "utf8");

test("Website AI FAB is retired on web and mobile", () => {
  assert.match(html, /#ed-ai-fab,\s*\n?\.ed-ai-fab\{display:none!important\}/);
  assert.match(html, /function syncEdAiFab\(\)\{[\s\S]*?fab\.classList\.add\('hidden'\)/);
  assert.doesNotMatch(
    html.slice(html.indexOf("function syncEdAiFab"), html.indexOf("function syncEdAiFab") + 500),
    /fab\.classList\.toggle\('hidden'/
  );
});

test("floating Style / AI context bar no longer opens", () => {
  const show = html.slice(
    html.indexOf("function showWsPeContextBar"),
    html.indexOf("function hideWsPeContextBar")
  );
  assert.match(show, /hideWsPeContextBar\(\)/);
  assert.doesNotMatch(show, /classList\.add\('is-open'\)/);
  assert.match(layoutCss, /#ws-pe-context-bar\s*\{[\s\S]*?display:\s*none\s*!important/);
});

test("package cards expose inline name, price, and hours targets", () => {
  const card = html.slice(
    html.indexOf("function wsServiceCardHtml"),
    html.indexOf("function wsPageEl")
  );
  assert.match(card, /data-pe="svc-name"/);
  assert.match(card, /data-pe="svc-price"/);
  assert.match(card, /data-pe="svc-dur"/);
  assert.match(html, /'svc-name','svc-price','svc-dur'/);
});

test("inline edits focus the caret and persist catalog to booking", () => {
  assert.match(html, /function wsPeSelectAllContents\(/);
  assert.match(html, /opts\.selectAll===true/);
  assert.match(html, /scheduleEditorCatalogPersist/);
  assert.match(html, /HublyBookingWizardUI\.syncServicesOut/);
  const commit = html.slice(
    html.indexOf("function commitWsPeInlineValue"),
    html.indexOf("function bindWsPeInlineHandlers")
  );
  assert.match(commit, /pe==='svc-price'/);
  assert.match(commit, /pe==='svc-dur'/);
  assert.match(commit, /scheduleEditorCatalogPersist/);
});

test("hours and package hub field edits schedule a backend save", () => {
  assert.match(html, /function applyWsPeHours\(\)\{[\s\S]*?saveStorefront\(\)/);
  assert.match(html, /function updatePkgHubField[\s\S]*?scheduleEditorCatalogPersist/);
});
