import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");
const css = fs.readFileSync(path.join(root, "public/journey-os/ai-workspace.css"), "utf8");
const js = fs.readFileSync(path.join(root, "public/journey-os/ai-workspace.js"), "utf8");

test("AI Workspace assets are linked from hubly.html", () => {
  assert.match(html, /ai-workspace\.css\?v=aw-1/);
  assert.match(html, /ai-workspace\.js\?v=aw-1/);
  assert.match(html, /data-hubly-ai-workspace="building"/);
  assert.match(html, /is-architect-activity/);
  assert.match(html, /Ask Hubly anything/);
});

test("Building Mode is three panes: conversation, live workspace, activity", () => {
  assert.match(css, /jos-ai-workspace-home/);
  assert.match(css, /\.aw-grid/);
  assert.match(html, /Hubly Activity/);
  assert.match(html, /aria-label="AI Conversation"/);
  assert.match(html, /aria-label="Live Workspace"/);
  assert.match(html, /aria-label="Hubly Activity"/);
});

test("Operating Mode simplifies sidebar to core engines", () => {
  assert.match(css, /data-v="dashboard"/);
  assert.match(css, /data-v="editor"/);
  assert.match(css, /data-v="store"/);
  assert.match(css, /data-v="customers"/);
  assert.match(css, /data-v="photo-projects"/);
  assert.match(css, /data-v="studio"/);
  assert.match(css, /data-v="growth"/);
  assert.match(css, /data-v="settings"/);
});

test("HublyAIWorkspace module exposes mount + journey milestones", () => {
  const sandbox = {
    window: {},
    document: {
      addEventListener() {},
      getElementById() { return null; },
      querySelector() { return null; },
      contains() { return false; },
    },
    localStorage: {
      _m: {},
      getItem(k) { return this._m[k] ?? null; },
      setItem(k, v) { this._m[k] = String(v); },
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(js, sandbox);
  const AW = sandbox.HublyAIWorkspace;
  assert.ok(AW);
  assert.equal(AW.version, "1.0.0");
  assert.equal(AW.milestones.length, 10);
  assert.equal(AW.milestones[0].id, "vision");
  assert.equal(AW.milestones[9].id, "home");
  assert.equal(typeof AW.mountOperateHome, "function");
  assert.equal(typeof AW.handleOwnerTurn, "function");
  AW.markBuildingComplete();
  assert.equal(AW.hasFinishedFirstBuild(), true);
});

test("journey Home mounts AI Workspace when available", () => {
  const journey = fs.readFileSync(path.join(root, "public/journey-os/journey.js"), "utf8");
  assert.match(journey, /HublyAIWorkspace\.mountOperateHome/);
  assert.match(journey, /jos-ai-workspace-home/);
});

test("openOperateHome enters AI Workspace home", () => {
  assert.match(html, /jos-ai-workspace-home/);
  assert.match(html, /HublyAIWorkspace\.mountOperateHome/);
  assert.match(html, /markBuildingComplete/);
});
