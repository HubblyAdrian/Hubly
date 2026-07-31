import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");

test("signOut clears owner + draft credentials and skips auto-resume", () => {
  const fn = html.slice(html.indexOf("async function signOut"), html.indexOf("function getHublyDomain"));
  assert.match(fn, /_intentionalSignOut\s*=\s*true/);
  assert.match(fn, /clearStoredAuthCredentials|clearOwnerLogin/);
  assert.match(fn, /skipDraftResume:\s*true/);
  assert.match(html, /function clearOwnerLogin\(/);
  assert.match(html, /function clearStoredAuthCredentials\(/);
});

test("resume helpers refuse to run after intentional sign-out", () => {
  assert.match(html, /async function tryRestoreDraftSession[\s\S]*?_intentionalSignOut[\s\S]*?return false/);
  assert.match(html, /async function resumeDraftSessionIfNeeded[\s\S]*?_intentionalSignOut[\s\S]*?return false/);
  assert.match(html, /skipDraftResume&&!S\._intentionalSignOut/);
});

test("website editor ships a Back to Home control", () => {
  assert.match(html, /id="ed-back-home"/);
  assert.match(html, /onclick="leaveWebsiteEditorToHome\(\)"/);
  assert.match(html, /function leaveWebsiteEditorToHome\(/);
  const leave = html.slice(
    html.indexOf("function leaveWebsiteEditorToHome"),
    html.indexOf("function setOwnerPreview")
  );
  assert.match(leave, /switchV/);
  assert.doesNotMatch(leave, /p-landing/);
});

test("browser Back while logged in does not open marketing landing", () => {
  const pop = html.slice(
    html.indexOf("window.addEventListener('popstate'"),
    html.indexOf("function preferM2ExperienceHome")
  );
  assert.match(pop, /dest==='p-landing'/);
  assert.match(pop, /leaveWebsiteEditorToHome|p-app/);
  assert.match(pop, /currentUser/);
});
