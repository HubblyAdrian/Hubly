#!/usr/bin/env node
/**
 * Sync Connected Apps catalog SSOT → client + server copies.
 * Source of truth: hubly-core/connected-apps-catalog.json
 *
 * Run: node scripts/sync-connected-apps-catalog.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ssotPath = join(root, 'hubly-core/connected-apps-catalog.json');
const publicJson = join(root, 'public/journey-os/connected-apps-catalog.json');
const sharedJson = join(root, 'supabase/functions/_shared/connected_apps_catalog.json');
const generatedJs = join(root, 'public/journey-os/connected-apps-catalog.generated.js');

const raw = readFileSync(ssotPath, 'utf8');
const data = JSON.parse(raw);
if (!data.apps || !Array.isArray(data.apps)) {
  console.error('Invalid catalog: missing apps[]');
  process.exit(1);
}

mkdirSync(dirname(publicJson), { recursive: true });
mkdirSync(dirname(sharedJson), { recursive: true });

// Byte-identical copies of SSOT (tests assert equality).
writeFileSync(publicJson, raw);
writeFileSync(sharedJson, raw);

const js =
  '/** AUTO-GENERATED from hubly-core/connected-apps-catalog.json — do not edit. */\n' +
  '(function (global) {\n' +
  "  'use strict';\n" +
  '  global.HUBLY_CONNECTED_APPS_CATALOG = ' +
  JSON.stringify(data) +
  ';\n' +
  '})(typeof window !== \'undefined\' ? window : globalThis);\n';

writeFileSync(generatedJs, js);
console.log('Synced Connected Apps catalog → public + _shared + generated.js (' + data.apps.length + ' apps)');
