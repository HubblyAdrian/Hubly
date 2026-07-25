#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const demo = path.join(root, "artifacts/experience-first/holy-shit-prototype.html");
const outDir = "/opt/cursor/artifacts/holy-shit-sprint";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
await page.goto("file://" + demo, { waitUntil: "networkidle" });
await page.locator("#scene-moments").screenshot({ path: path.join(outDir, "01-moments-live-build.png") });
await page.locator("#scene-home").screenshot({ path: path.join(outDir, "02-alive-home-activity.png") });
await browser.close();
console.log("Wrote", outDir);
