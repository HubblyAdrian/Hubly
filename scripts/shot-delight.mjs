#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const demo = path.join(root, "artifacts/experience-first/delight-prototype.html");
const outDir = "/opt/cursor/artifacts/delight-sprint";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 860 }, deviceScaleFactor: 2 });
await page.goto("file://" + demo, { waitUntil: "networkidle" });
await page.locator("#scene-create").screenshot({ path: path.join(outDir, "01-create-website-hero.png") });
await page.locator("#scene-home").screenshot({ path: path.join(outDir, "02-home-business-hero.png") });
await browser.close();
console.log("Wrote", outDir);
