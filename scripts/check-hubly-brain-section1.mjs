#!/usr/bin/env node
/** @deprecated use scripts/check-section1-hubly-brain.mjs */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = spawnSync(process.execPath, [path.join(root, 'scripts/check-section1-hubly-brain.mjs')], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(r.status == null ? 1 : r.status);
