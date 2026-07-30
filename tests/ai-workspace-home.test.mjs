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
const stateMachine = fs.readFileSync(
  path.join(root, "docs/architecture/HUBLY_AI_WORKSPACE_STATE_MACHINE.md"),
  "utf8"
);

function loadWorkspace() {
  const sandbox = {
    window: {},
    document: {
      body: { classList: { add() {}, remove() {}, toggle() {} } },
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
  sandbox.S = {};
  vm.runInNewContext(js, sandbox);
  return sandbox;
}

test("AI Workspace assets are linked from hubly.html", () => {
  assert.match(html, /ai-workspace\.css\?v=aw-2/);
  assert.match(html, /ai-workspace\.js\?v=aw-2/);
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
  assert.match(html, /What I'm doing now/);
  assert.match(html, /Current Focus/);
});

test("Workspace is the hero — center column dominates layout", () => {
  assert.match(css, /minmax\(0,1\.55fr\)/);
  assert.match(css, /Workspace is the hero/);
  assert.match(css, /jos-ai-workspace-building/);
  assert.match(css, /\.aw-point/);
  assert.match(css, /\.aw-compose-box/);
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

test("HublyAIWorkspace exposes state machine + Current Focus blocks", () => {
  const sandbox = loadWorkspace();
  const AW = sandbox.HublyAIWorkspace;
  assert.ok(AW);
  assert.equal(AW.version, "1.1.0");
  assert.equal(AW.focusBlocks.length, 10);
  assert.equal(AW.focusBlocks[0].id, "vision");
  assert.equal(AW.focusBlocks[9].id, "home");
  assert.equal(AW.milestones, AW.focusBlocks); // legacy alias
  assert.ok(AW.states.building_website);
  assert.ok(AW.states.building_campaign);
  assert.ok(AW.states.operating);
  assert.equal(typeof AW.mountOperateHome, "function");
  assert.equal(typeof AW.handleOwnerTurn, "function");
  assert.equal(typeof AW.enterBuildingMode, "function");
  assert.equal(typeof AW.enterOperatingMode, "function");
  assert.equal(typeof AW.pointAt, "function");
  assert.equal(typeof AW.transition, "function");
  AW.markBuildingComplete();
  assert.equal(AW.hasFinishedFirstBuild(), true);
});

test("Conversation re-enters Building Mode for major projects", () => {
  const sandbox = loadWorkspace();
  const AW = sandbox.HublyAIWorkspace;
  AW.markBuildingComplete();
  AW.enterOperatingMode({ message: "Operating" });
  assert.equal(AW.ensureState().mode, "operating");

  AW.handleOwnerTurn("Let's build a Christmas campaign");
  const aw = AW.ensureState();
  assert.equal(aw.mode, "building");
  assert.equal(aw.state, "building_campaign");
  assert.equal(aw.surface, "studio");
  assert.match(String(aw.doing), /Studio|campaign|Opening/i);

  AW.handleOwnerTurn("Build my storefront");
  const store = AW.ensureState();
  assert.equal(store.mode, "building");
  assert.equal(store.surface, "directions");
});

test("Recommendations carry confidence and reasoning", () => {
  const sandbox = loadWorkspace();
  const AW = sandbox.HublyAIWorkspace;
  AW.handleOwnerTurn("move booking higher");
  const msgs = AW.ensureState().messages.filter((m) => m.side === "hubly" && m.recommendation);
  assert.ok(msgs.length >= 1);
  const rec = msgs[msgs.length - 1].recommendation;
  assert.ok(rec.confidence >= 80);
  assert.ok(String(rec.reasoning).length > 20);
  assert.equal(AW.ensureState().pointTarget, "cta");
});

test("Workspace state machine design artifact exists", () => {
  assert.match(stateMachine, /Workspace State Machine/);
  assert.match(stateMachine, /Building Mode never ends/);
  assert.match(stateMachine, /Current Focus/);
  assert.match(stateMachine, /Hubly points/);
  assert.match(stateMachine, /building_campaign/);
  assert.match(stateMachine, /Operating Mode/);
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
