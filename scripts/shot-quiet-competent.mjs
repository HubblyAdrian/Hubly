#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const demo = path.join(root, "artifacts/experience-first/quiet-competent-prototype.html");
const outDir = "/opt/cursor/artifacts/quiet-competent";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
await page.goto("file://" + demo, { waitUntil: "networkidle" });
await page.locator("#scene-workspace").screenshot({ path: path.join(outDir, "01-hubly-workspace.png") });
await page.locator("#scene-recent").screenshot({ path: path.join(outDir, "02-recent-work-discover.png") });
await browser.close();
console.log("Wrote", outDir);
