import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");

test("owner app view persist/restore helpers exist", () => {
  assert.match(html, /const HUBLY_OWNER_APP_VIEWS\s*=\s*new Set\(/);
  assert.match(html, /function persistOwnerAppView\(/);
  assert.match(html, /function readPersistedOwnerAppView\(/);
  assert.match(html, /function restoreOwnerAppView\(/);
  assert.match(html, /function parseOwnerAppViewHash\(/);
  assert.match(html, /sessionStorage\.setItem\('hubly_app_view_v1'/);
});

test("loadBusiness restores last Operate section instead of forcing Home", () => {
  const fn = html.slice(
    html.indexOf("async function loadBusiness"),
    html.indexOf("async function loadBusiness") + 4500
  );
  assert.match(fn, /openOperateHome\(\{restore:\s*true\}\)/);
  assert.doesNotMatch(fn, /else\s*\{\s*goDash\(\);\s*\}/);
});

test("intentional Home clears restore (goDash / leave editor / Create exit)", () => {
  const goDash = html.slice(
    html.indexOf("function goDash("),
    html.indexOf("function leaveWebsiteEditorToHome")
  );
  assert.match(goDash, /forceDashboard:\s*true/);

  const leave = html.slice(
    html.indexOf("function leaveWebsiteEditorToHome"),
    html.indexOf("function setOwnerPreview")
  );
  assert.match(leave, /persistOwnerAppView\('dashboard'\)/);

  assert.match(html, /isRevealContinueToWorkspace[\s\S]*?forceDashboard:\s*true/);
  assert.match(html, /function isEnterBusinessHome[\s\S]*?forceDashboard:\s*true/);
});

test("switchV and website hub persist the active section", () => {
  const switchV = html.slice(
    html.indexOf("function switchV(el)"),
    html.indexOf("function mountEdChrome")
  );
  assert.match(switchV, /persistOwnerAppView\(v\)/);

  const hub = html.slice(
    html.indexOf("function switchWebsiteHubTab"),
    html.indexOf("function jumpToEdSection")
  );
  assert.match(hub, /persistOwnerAppView\('editor'/);
});

test("syncHublyRoute keeps Operate section hash on /app", () => {
  const fn = html.slice(
    html.indexOf("function syncHublyRoute"),
    html.indexOf("function showP")
  );
  assert.match(fn, /ownerAppViewHash/);
  assert.match(fn, /readPersistedOwnerAppView|parseOwnerAppViewHash/);
  assert.doesNotMatch(fn, /dirty=cur!==route\.path\|\|!!location\.hash/);
});

test("openOperateHome restores by default and skipRoute preserves URL", () => {
  const fn = html.slice(
    html.indexOf("function openOperateHome"),
    html.indexOf("const HUBLY_OWNER_APP_VIEWS")
  );
  assert.match(fn, /skipRoute:\s*true/);
  assert.match(fn, /wantRestore\s*=\s*opts\.restore!==false/);
  assert.match(fn, /restoreOwnerAppView/);
});
