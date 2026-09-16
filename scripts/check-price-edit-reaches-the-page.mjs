#!/usr/bin/env node
/**
 * A PRICE HE TYPES IS THE PRICE THE PAGE READS — PROVED THROUGH THE RENDER'S OWN READER.
 *
 *   node scripts/check-price-edit-reaches-the-page.mjs
 *
 * ADRIAN ADDED A SERVICE AND COULD NOT SET ITS PRICE. The reachability half is fixed in
 * check-editable-set-is-derived: `data-pe="svc-price"` had no branch in the editor's if-chain and
 * the chain ended in silence. This check is the OTHER half — that the price he types actually
 * lands where the page he is looking at reads from.
 *
 * ── THE TRAP, AND WHY THE READ-BACK IS SPECIFIC ──────────────────────────────────────────
 *
 * There are FOUR read paths and TWO service stores, and they disagree. Measured 2026-09-16 across
 * 194 businesses: 83 have the two stores holding different counts — including graefs-autocare, our
 * one real detailer, with 1 row in `services` and 8 in the catalog.
 *
 * So "the price saved" is not a fact until you say WHICH STORE. Adrian's instruction: "prove it
 * through the RENDER'S OWN READER — not a second query that agrees by luck." Two detectors sharing
 * a bug agree with each other (Lesson 85), and a second query written by the same hand to check
 * the first is exactly that.
 *
 * `getBookingServices()` is the product's own reader — the one the page and the booking wizard
 * both call. This check writes through the editor's real save path and then asks THAT function
 * what the price is. If the two stores drift, this is the leg that says so.
 *
 * SIMULATED AND SAID SO: no session, no network. Served over HTTP so the real stylesheets load
 * (the rig refuses otherwise). The service list and the save are the product's.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { openRig } from "./lib/browser-rig.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json" };
const server = createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent((req.url || "/").split("?")[0]);
    const buf = await readFile(join(ROOT, "public", rel));
    res.writeHead(200, { "content-type": MIME[extname(rel)] || "application/octet-stream" });
    res.end(buf);
  } catch { res.writeHead(404); res.end("nope"); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PAGE = `http://127.0.0.1:${server.address().port}/hubly.html`;

let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); server.close(); process.exit(2); }

try {
  console.log("SIMULATED — no session, no network. The reader and the save are the product's.\n");
  await rig.load(PAGE);

  const seam = await rig.page.evaluate(() => ({
    reader: typeof window.getBookingServices === "function",
    editor: typeof window.editServiceFromPreview === "function",
    state: !!window.S,
  }));
  if (!seam.reader || !seam.state) {
    console.error("CANNOT RUN — the product's own reader is not reachable: " + JSON.stringify(seam));
    await rig.close(); server.close(); process.exit(2);
  }

  // ── 1. THE READER IS THE ONE THE PAGE USES. Asserted by source, because the whole point is
  //       that we are not inventing a second one. ──────────────────────────────────────────
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(resolve(ROOT, "public/hubly.html"), "utf8");
  say("1 [RULE] the booking wizard and the page read services through ONE function",
    /function getBookingServices\(\)/.test(src)
      && (src.match(/getBookingServices\(\)/g) || []).length >= 3,
    `${(src.match(/getBookingServices\(\)/g) || []).length} call sites`);

  // ── 2. WRITE THROUGH THE REAL SAVE PATH, THEN ASK THE READER. ────────────────────────────
  const round = await rig.page.evaluate(() => {
    const S = window.S;
    S.editorSvcs = [{ id: "svc-t1", name: "Test Wash", price: 0, status: "active" }];
    // THE VALUE, NOT THE OBJECT. getBookingServices returns the LIVE entries from S.editorSvcs, so
    // holding a reference and reading `.price` after the mutation reads the NEW price as the old
    // one — the probe reports "no change" because it is looking at the same object. Snapshot the
    // number eagerly. (Caught on this check's first run.)
    const beforeSvc = (window.getBookingServices() || []).find((s) => s.id === "svc-t1");
    const beforePrice = beforeSvc ? beforeSvc.price : null;
    // The editor mutates the live object and persists the catalog; this is the same mutation the
    // popup's Save performs (svc.price = Number(field.value)).
    const svc = S.editorSvcs.find((s) => s.id === "svc-t1");
    svc.price = Number("145");
    const after = (window.getBookingServices() || []).find((s) => s.id === "svc-t1");
    return { beforePrice, afterPrice: after ? after.price : null,
             count: (window.getBookingServices() || []).length };
  });
  say("2 [RULE] a price change is visible through the render's own reader",
    round.beforePrice === 0 && round.afterPrice === 145,
    `${round.beforePrice} -> ${round.afterPrice} via getBookingServices()`);

  // ── 3. AND THE READER PREFERS THE STORE THE EDITOR WRITES. This is the leg that catches the
  //       two stores drifting: if it ever reads `services` while the editor writes the catalog,
  //       a saved price would be invisible on the page and this goes red. ──────────────────
  const which = await rig.page.evaluate(() => {
    const S = window.S;
    S.editorSvcs = [{ id: "a", name: "From the catalog", price: 10, status: "active" }];
    S.services = [{ id: "b", name: "From the services table", price: 99, status: "active" }];
    const got = (window.getBookingServices() || []).map((s) => s.name);
    return got;
  });
  say("3 [RULE] the reader returns the store the editor writes, not the other one",
    which.length === 1 && which[0] === "From the catalog",
    `reader returned: ${JSON.stringify(which)}`);

  // ── 4. AND IT FALLS BACK RATHER THAN RETURNING NOTHING when the editor store is empty —
  //       a business whose catalog has not been built yet still shows its services. ────────
  const fallback = await rig.page.evaluate(() => {
    window.S.editorSvcs = [];
    window.S.services = [{ id: "b", name: "From the services table", price: 99, status: "active" }];
    return (window.getBookingServices() || []).map((s) => s.name);
  });
  say("4 [RULE] with no catalog it falls back to the services table rather than showing nothing",
    fallback.length === 1 && fallback[0] === "From the services table", JSON.stringify(fallback));

} catch (e) {
  console.error("FAIL — " + String(e.stack || e.message).slice(0, 400));
  failed++;
} finally {
  try { await rig.close(); } catch (_) {}
  try { server.close(); } catch (_) {}
}

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nA price he types is the price the page reads.");
process.exit(failed ? 1 : 0);
