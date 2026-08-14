// Storefront Builder — closed-loop conformance test (fast, no network, no browser).
//
// The Storefront's capability catalog is the single contract shared by four consumers. This test
// fails the moment any of them drifts out of lockstep:
//   1. server catalog   — supabase/functions/_shared/storefront_ast.ts (STOREFRONT_BLOCK_CATALOG)
//   2. client mirror     — public/journey-os/commerce/storefront-ast.js (HublyStorefrontAst.CATALOG)
//   3. renderer          — public/journey-os/commerce/store-page.js (blockHtml switch cases)
//   4. AI + manual editor — both are generated from the client mirror, so (2) covers them.
//
// It also checks the theme option lists (style/font/density) match between server and client.
// Run: node tests/storefront_conformance.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const fails = [];
const eq = (label, a, b) => {
  const sa = [...a].sort(), sb = [...b].sort();
  const missing = sa.filter((x) => !sb.includes(x));
  const extra = sb.filter((x) => !sa.includes(x));
  if (missing.length || extra.length) fails.push(`${label}: missing [${missing}] extra [${extra}]`);
  else console.log(`OK · ${label} (${sa.length})`);
};

// --- 1. server catalog keys (parse the Record<...> block) ---
const ts = read('supabase/functions/_shared/storefront_ast.ts');
const catBlock = ts.slice(ts.indexOf('STOREFRONT_BLOCK_CATALOG'));
const serverKeys = [...catBlock.slice(0, catBlock.indexOf('\n};')).matchAll(/^\s{2}(\w+):\s*\{/gm)].map((m) => m[1]);

// --- 2. client mirror (load the module) ---
globalThis.window = globalThis;
await import(path.join(ROOT, 'public/journey-os/commerce/storefront-ast.js'));
const A = globalThis.HublyStorefrontAst;
const clientKeys = A.BLOCK_TYPES;

// --- 3. renderer blockHtml switch cases ---
const sp = read('public/journey-os/commerce/store-page.js');
const bh = sp.slice(sp.indexOf('function blockHtml'));
const rendererKeys = [...bh.slice(0, bh.indexOf('\n  function ')).matchAll(/case '(\w+)':/g)].map((m) => m[1]);

// --- theme option lists (server constants vs client) ---
const serverList = (name) => {
  const m = ts.match(new RegExp(name + '\\s*=\\s*\\[([^\\]]*)\\]'));
  return m ? m[1].match(/"(\w+)"/g).map((s) => s.replace(/"/g, '')) : [];
};

eq('server catalog == client mirror', serverKeys, clientKeys);
eq('client mirror == renderer cases', clientKeys, rendererKeys);
eq('theme styles server == client', serverList('THEME_STYLES'), A.THEME_STYLES);
eq('theme fonts server == client', serverList('THEME_FONTS'), A.THEME_FONTS);
eq('theme densities server == client', serverList('THEME_DENSITIES'), A.THEME_DENSITIES);

if (fails.length) { console.error('\n==== CONFORMANCE FAILED ===='); fails.forEach((f) => console.error('  FAIL · ' + f)); process.exit(1); }
console.log('\n==== STOREFRONT CONFORMANCE: all consumers in lockstep ====');
