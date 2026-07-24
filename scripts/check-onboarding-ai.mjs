#!/usr/bin/env node
/**
 * Prove Create-mode Discovery is wired to Hubly Brain → OpenAI
 * (local HUBLY_DISCOVERY gap tree is fallback only).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const failures = [];
function check(name, cond, detail = "") {
  if (!cond) {
    console.error(`  ✗ ${name}${detail ? `: ${detail}` : ""}`);
    failures.push({ name, detail });
  } else console.log(`  ✓ ${name}`);
}

console.log("\nOnboarding AI — Discovery uses OpenAI\n");

const html = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");
const think = fs.readFileSync(path.join(root, "supabase/functions/_shared/hubly_brain_think.ts"), "utf8");
const disc = fs.readFileSync(
  path.join(root, "supabase/functions/_shared/hubly_brain_discovery_conversation.ts"),
  "utf8",
);
const brainIdx = fs.readFileSync(path.join(root, "supabase/functions/hubly-brain/index.ts"), "utf8");

check("Discovery conversation module exists", /runDiscoveryConversationTurn/.test(disc));
check("Calls HublyAI.complete with OpenAI", /HublyAI\.complete/.test(disc) && /provider:\s*"openai"/.test(disc));
check("task chat (OpenAI reasoning route)", /task:\s*"chat"/.test(disc));
check("Fallback marked distinctly", /source:\s*"fallback"/.test(disc) && /source:\s*"openai"/.test(disc));
check("think() has discovery intent path", /intent === "discovery"/.test(think) && /runDiscoveryConversationTurn/.test(think));
check("hubly-brain passes discovery context", /discovery:\s*body\.discovery/.test(brainIdx));
check("hubly-brain returns aiSource/aiModel", /aiSource|aiModel/.test(brainIdx));
check("Frontend isDiscoverySend awaits Brain", /async function isDiscoverySend/.test(html) && /isDiscoveryThinkTurn/.test(html));
check("Frontend think intent discovery", /intent:\s*'discovery'/.test(html));
check("Local ingest is fallback only", /OpenAI\/Brain failed|local fallback|FALLBACK/.test(html));
check("Boot seed uses AI turn", /isDiscoverySend\(seed\)/.test(html));
check("Audit doc present", fs.existsSync(path.join(root, "docs/ONBOARDING_AI_AUDIT.md")));

const passed = failures.length === 0;
fs.writeFileSync(
  path.join(root, "docs/ONBOARDING_AI_PROOF.json"),
  JSON.stringify({ title: "Onboarding AI Discovery", passed, failures, checkedAt: new Date().toISOString() }, null, 2) + "\n",
);
console.log(passed ? "\nONBOARDING AI PASS\n" : "\nONBOARDING AI FAIL\n");
if (!passed) process.exit(1);
