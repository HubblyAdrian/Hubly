#!/usr/bin/env node
/**
 * Production edge probe — DEPLOYED vs MISSING (infrastructure).
 * Does not treat auth/validation errors as product failures.
 *
 * Usage: node scripts/probe-production-edges.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SUPA = process.env.SUPABASE_URL || 'https://rtwxxkxpkqdrhclkozma.supabase.co';
const ANON =
  process.env.SUPABASE_ANON_KEY ||
  (() => {
    const html = fs.readFileSync(path.join(ROOT, 'public/mission-control.html'), 'utf8');
    return html.match(/['"](eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)['"]/)?.[1];
  })();

const dirs = fs
  .readdirSync(path.join(ROOT, 'supabase/functions'))
  .filter((d) => d !== '_shared' && fs.existsSync(path.join(ROOT, 'supabase/functions', d, 'index.ts')));

const rows = [];
for (const fn of dirs.sort()) {
  const url = `${SUPA}/functions/v1/${fn}`;
  let status = 0;
  let body = '';
  try {
    const res = await fetch(url, {
      method: fn === 'google-calendar-oauth-callback' ? 'GET' : 'POST',
      headers: {
        apikey: ANON,
        Authorization: 'Bearer ' + ANON,
        'Content-Type': 'application/json',
      },
      body: fn === 'google-calendar-oauth-callback' ? undefined : '{}',
      redirect: 'manual',
    });
    status = res.status;
    body = (await res.text()).slice(0, 160).replace(/\n/g, ' ');
  } catch (e) {
    status = 0;
    body = e.message;
  }
  const missing =
    status === 404 && (/NOT_FOUND|Requested function was not found/i.test(body) || body === '');
  rows.push({
    function: fn,
    http: status,
    deploy: missing ? 'MISSING' : 'DEPLOYED',
    body,
  });
}

const missing = rows.filter((r) => r.deploy === 'MISSING');
const deployed = rows.filter((r) => r.deploy === 'DEPLOYED');

const md = [];
md.push('# Production Edge Probe');
md.push('');
md.push(`Generated: ${new Date().toISOString()}`);
md.push(`Project: \`${SUPA}\``);
md.push('');
md.push(`DEPLOYED: **${deployed.length}** · MISSING: **${missing.length}**`);
md.push('');
md.push('| Function | Deploy | HTTP | Body |');
md.push('|---|---|---|---|');
for (const r of rows) {
  md.push(`| \`${r.function}\` | **${r.deploy}** | ${r.http} | ${r.body.replace(/\|/g, '/').slice(0, 100)} |`);
}
md.push('');
md.push('## Classification');
md.push('');
md.push('- **MISSING (404 NOT_FOUND)** = Infrastructure blocker (not a product bug).');
md.push('- **DEPLOYED with 400/401/302/503** = Endpoint exists; auth/validation working as designed.');
md.push('');

fs.mkdirSync(path.join(ROOT, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'artifacts/edge-probe.json'), JSON.stringify({ rows, missing: missing.map((m) => m.function) }, null, 2));
fs.writeFileSync(path.join(ROOT, 'artifacts/EDGE_PROBE.md'), md.join('\n'));
fs.writeFileSync(path.join(ROOT, 'docs/EDGE_PROBE.md'), md.join('\n'));
console.log(md.join('\n'));
process.exit(missing.length ? 2 : 0);
