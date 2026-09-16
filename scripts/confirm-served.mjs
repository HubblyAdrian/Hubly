#!/usr/bin/env node
/**
 * A ONE-SHOT FETCH IS NOT A CONFIRMATION.
 *
 *   node scripts/confirm-served.mjs <url> <marker> [<marker> …]
 *   node scripts/confirm-served.mjs https://myhubly.app/ "hcRenderMyDay" "Nothing on your calendar"
 *
 * 2026-09-16: a served-bytes confirmation fetched ONCE, landed mid-rollout, and reported the OLD
 * copy — for a change that had in fact shipped. The opposite is equally possible and worse: a
 * single fetch can catch the new bytes from one edge while others still serve the old, and be
 * quoted as "confirmed".
 *
 * So the confirm POLLS until every marker is present or the cap is hit, and it REPORTS HOW MANY
 * FETCHES IT TOOK. One fetch means it was already live; eight means the rollout was in flight and
 * the first answer would have been wrong. Either way the number is in the output, so nobody has to
 * wonder whether the confirmation raced.
 *
 * It also reports markers that must be ABSENT — prefix one with "!" — because "the new string is
 * there" and "the old string is gone" are different claims and a rollout can satisfy one first.
 *
 * Exit: 0 every marker settled · 1 the cap was hit · 2 cannot run.
 */
const [, , url, ...markers] = process.argv;
if (!url || !markers.length) {
  console.error('usage: confirm-served.mjs <url> <marker> [!<marker-that-must-be-absent>] …');
  process.exit(2);
}
const CAP = Number(process.env.CONFIRM_CAP || 40);
const GAP_MS = Number(process.env.CONFIRM_GAP_MS || 4000);
const want = markers.map((m) => (m.startsWith("!") ? { s: m.slice(1), present: false } : { s: m, present: true }));

let fetches = 0, bytes = 0, last = [];
const t0 = Date.now();
while (fetches < CAP) {
  fetches++;
  let body;
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) { console.error(`  fetch ${fetches}: HTTP ${r.status}`); await new Promise((z) => setTimeout(z, GAP_MS)); continue; }
    body = await r.text();
  } catch (e) {
    console.error(`  fetch ${fetches}: ${String(e.message).slice(0, 80)}`);
    await new Promise((z) => setTimeout(z, GAP_MS)); continue;
  }
  bytes = body.length;
  last = want.map((w) => ({ ...w, ok: body.includes(w.s) === w.present }));
  if (last.every((w) => w.ok)) {
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`CONFIRMED after ${fetches} fetch(es) in ${secs}s · ${bytes} bytes · ${url}`);
    for (const w of last) console.log(`  ${w.present ? "present" : "absent "}  ${JSON.stringify(w.s.slice(0, 70))}`);
    if (fetches > 1) console.log(`  NOTE: the first ${fetches - 1} fetch(es) disagreed — a one-shot confirm would have been wrong.`);
    process.exit(0);
  }
  await new Promise((z) => setTimeout(z, GAP_MS));
}
console.error(`NOT CONFIRMED after ${fetches} fetch(es) · ${bytes} bytes · ${url}`);
for (const w of last) console.error(`  ${w.ok ? "ok " : "NO "} ${w.present ? "present" : "absent "}  ${JSON.stringify(w.s.slice(0, 70))}`);
process.exit(1);
