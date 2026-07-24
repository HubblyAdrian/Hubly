#!/usr/bin/env node
/** Alias — Milestone 2 Epic 0 canonical gate is check-m2-epic0.mjs */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const r = spawnSync(process.execPath, ["scripts/check-m2-epic0.mjs"], { cwd: root, stdio: "inherit" });
process.exit(r.status ?? 1);
