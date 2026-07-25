#!/usr/bin/env node
/** Capture living-prototype screenshots for Experience-First PRs. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const demo = path.join(root, "artifacts/experience-first/living-prototype.html");
const outDir = "/opt/cursor/artifacts/experience-first";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 820 }, deviceScaleFactor: 2 });
await page.goto("file://" + demo, { waitUntil: "networkidle" });

await page.locator("#scene-discovery").screenshot({
  path: path.join(outDir, "01-discovery-live-studio.png"),
});
await page.locator("#scene-reveal").screenshot({
  path: path.join(outDir, "02-reveal-i-built-your-business.png"),
});

await browser.close();
console.log("Wrote screenshots to", outDir);
