#!/usr/bin/env node
/**
 * MIGRATE INLINED base64 IMAGES OUT OF businesses.meta INTO STORAGE.
 *
 *   node scripts/migrate-inlined-images-to-storage.mjs            # DRY RUN (default)
 *   node scripts/migrate-inlined-images-to-storage.mjs --apply    # actually writes
 *
 * WHY THIS EXISTS
 *
 * `uploadBrandAsset` passed `upsert:true`, which needs a SELECT on storage.objects that
 * migration 20260818030000_storage_no_enumeration.sql correctly removed. From 2026-08-18
 * every client-side brand-asset upload failed, and every caller silently kept the base64
 * instead (OPEN_FINDINGS #64). The upload path is fixed as of 2026-09-07; this cleans up
 * what accumulated:
 *
 *   aquaspeed                 meta.logoUrl                      23,887   <- STALE DUPLICATE
 *   devdetailing661           meta.logoUrl                      37,207   <- STALE DUPLICATE
 *   devdetailing661           meta.website.ownerPhotoUrl       136,375   <- upload
 *   bucket-mobile-detailing   meta.website.profileHeroImage     14,803   <- upload
 *   bucket-mobile-detailing   meta.website.ownerPhotoUrl        60,779   <- upload
 *   bucket-mobile-detailing   meta.website.profileSheetImage   420,855   <- upload
 *
 * 6 images, 3 businesses, 693,906 bytes. All three are REAL OUTSIDE OWNERS -- none is an
 * adriansmithee account -- and the most recent sign-in among them is 2026-07-20, so the
 * repair pass in hubly.html (which only runs when an owner opens the editor and saves)
 * will not reach them. That is why this script exists rather than waiting.
 *
 * TWO OF THE SIX NEED NO UPLOAD. aquaspeed and devdetailing661 both already have a real
 * https URL in the `logo_url` COLUMN, so `meta.logoUrl` is a stale duplicate of an image
 * that is already hosted. Those are a rewrite to the existing URL -- no upload, no failure
 * mode, and they run FIRST to validate the mechanism before anything touches Bucket.
 *
 * ── THE RACE, STATED RATHER THAN IMPLIED ──────────────────────────────────────────────
 *
 * This is a read-modify-write of `businesses.meta` with NO compare-and-swap. The hash-CAS
 * RPC designed in OPEN_FINDINGS #57/#58 does not exist yet, and CAS-by-URL-filter is
 * IMPOSSIBLE for exactly these businesses: a PostgREST `.eq()` value dies between 24,000
 * and 26,000 characters, and bucket's meta is 515,856. So:
 *
 *   - the window is narrowed, not closed: meta is re-read immediately before the write and
 *     the business is ABORTED if it changed since the first read;
 *   - that reduces the exposure from minutes (upload time) to milliseconds (write time);
 *   - it is NOT atomic. If an owner saves in that millisecond window, their save is lost.
 *
 * Mitigation beyond the code: all three owners last signed in seven weeks ago, and this
 * should be run at a quiet hour. Do not run it during a demo.
 *
 * ── SECRETS ───────────────────────────────────────────────────────────────────────────
 *
 * The service-role key is read from the environment ONLY. It is never printed, never
 * written to a file, never passed as an argument, and never included in any output. Set it
 * for the length of one run:
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-inlined-images-to-storage.mjs
 *
 * Do NOT use `supabase secrets set` or put it in a file. A key that reaches terminal
 * scrollback is compromised.
 */
// The npm package, not the esm.sh URL: scripts/ run under NODE, which cannot
// import an https: specifier. @supabase/supabase-js is already in node_modules.
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const BACKUP_DIR = path.resolve("backups/meta-" + new Date().toISOString().slice(0, 10));

/** Cheapest first. Bucket LAST, deliberately. */
const TARGETS = ["aquaspeed", "devdetailing661", "bucket-mobile-detailing"];

/** Every meta path that can hold an image, with the storage `kind` used for its filename. */
const FIELDS = [
  { path: ["logoUrl"],                      kind: "logo",          columnFallback: "logo_url" },
  { path: ["bannerUrl"],                    kind: "banner",        columnFallback: "banner_url" },
  { path: ["website", "ownerPhotoUrl"],     kind: "owner" },
  { path: ["website", "profileHeroImage"],  kind: "profile-hero" },
  { path: ["website", "profileSheetImage"], kind: "profile-sheet" },
];

const get = (o, p) => p.reduce((a, k) => (a && typeof a === "object" ? a[k] : undefined), o);
const set = (o, p, v) => { let a = o; for (let i = 0; i < p.length - 1; i++) { if (typeof a[p[i]] !== "object" || !a[p[i]]) a[p[i]] = {}; a = a[p[i]]; } a[p[p.length - 1]] = v; };
const isData = (v) => typeof v === "string" && v.startsWith("data:image/");
const isHttps = (v) => typeof v === "string" && /^https?:\/\//i.test(v);
const kb = (n) => (n / 1024).toFixed(1) + "KB";

function dataUrlToBuffer(dataUrl) {
  const comma = dataUrl.indexOf(",");
  const meta = dataUrl.slice(0, comma);
  const b64 = dataUrl.slice(comma + 1);
  const mime = (meta.match(/data:([^;]+)/) || [])[1] || "image/jpeg";
  return { buf: Buffer.from(b64, "base64"), mime };
}

function fail(msg) { console.error(`  ✗ ${msg}`); }

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment.");
    console.error("Never pass a key as an argument and never write it to a file.");
    process.exit(2);
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  console.log(APPLY ? "*** APPLY MODE — THIS WRITES ***\n" : "DRY RUN — nothing will be written. Use --apply to write.\n");

  const summary = [];

  for (const slug of TARGETS) {
    console.log(`━━ ${slug}`);
    const { data: biz, error } = await admin
      .from("businesses").select("id,slug,owner_id,meta,logo_url,banner_url").eq("slug", slug).maybeSingle();
    if (error || !biz) { fail(`could not read business: ${error?.message || "not found"}`); continue; }

    const rawBefore = typeof biz.meta === "string" ? biz.meta : JSON.stringify(biz.meta || {});
    const bytesBefore = rawBefore.length;

    // ── S1. BACK UP FIRST. No backup, no migration for this business. ──────────────────
    const backupPath = path.join(BACKUP_DIR, `${slug}.meta.json`);
    if (APPLY) {
      try {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        fs.writeFileSync(backupPath, rawBefore, "utf8");
        const verify = fs.readFileSync(backupPath, "utf8");
        if (verify.length !== bytesBefore) throw new Error("backup size mismatch");
        console.log(`   backup  ${backupPath} (${kb(bytesBefore)}) ✓`);
      } catch (e) {
        fail(`BACKUP FAILED (${e.message}) — skipping ${slug} entirely, nothing written`);
        continue;
      }
    } else {
      console.log(`   backup  would write ${backupPath} (${kb(bytesBefore)})`);
    }

    let meta;
    try { meta = JSON.parse(rawBefore); }
    catch (e) { fail(`meta is not valid JSON (${e.message}) — skipping`); continue; }

    const plan = [];
    for (const f of FIELDS) {
      const v = get(meta, f.path);
      if (!isData(v)) continue;
      const column = f.columnFallback ? biz[f.columnFallback] : null;
      plan.push({
        field: f.path.join("."), kind: f.kind, bytes: v.length,
        action: isHttps(column) ? "REWRITE" : "UPLOAD",
        target: isHttps(column) ? column : null,
      });
    }

    if (!plan.length) { console.log("   nothing to do — no data: URIs in meta\n"); continue; }

    for (const p of plan) {
      console.log(`   ${p.action.padEnd(7)} ${p.field.padEnd(28)} ${String(p.bytes).padStart(7)} bytes` +
        (p.action === "REWRITE" ? `  -> existing column URL (no upload)` : `  -> upload as '${p.kind}'`));
    }

    if (!APPLY) {
      const saved = plan.reduce((a, p) => a + p.bytes, 0);
      console.log(`   would go ${kb(bytesBefore)} -> ~${kb(bytesBefore - saved)}\n`);
      summary.push({ slug, planned: plan.length, bytesBefore });
      continue;
    }

    // ── S4. PER-IMAGE failure. One failure never abandons the others. ──────────────────
    let changed = 0, failed = 0;
    for (const p of plan) {
      const field = FIELDS.find((f) => f.path.join(".") === p.field);
      const value = get(meta, field.path);
      if (p.action === "REWRITE") {
        set(meta, field.path, p.target);
        changed++; console.log(`   ✓ ${p.field} -> existing hosted URL`);
        continue;
      }
      try {
        const { buf, mime } = dataUrlToBuffer(value);
        const ext = mime.includes("png") ? "png" : "jpg";
        const objectPath = `${biz.owner_id}/${p.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
        // NO upsert — the option that caused #64. Paths are unique by construction.
        const up = await admin.storage.from("brand-assets").upload(objectPath, buf, { contentType: mime });
        if (up.error) throw new Error(up.error.message);
        const { data: pub } = admin.storage.from("brand-assets").getPublicUrl(objectPath);
        if (!isHttps(pub?.publicUrl)) throw new Error("no public URL returned");
        set(meta, field.path, pub.publicUrl);
        changed++; console.log(`   ✓ ${p.field} -> ${pub.publicUrl.slice(0, 62)}…`);
      } catch (e) {
        // S4: LEAVE THE BASE64. Never blank an owner's working image to satisfy a rule.
        failed++; fail(`${p.field}: upload failed (${e.message}) — base64 LEFT IN PLACE`);
      }
    }

    if (!changed) { console.log(`   no field migrated; leaving ${slug} untouched\n`); continue; }

    // ── S5. Re-read immediately before writing. Abort if anything changed. ─────────────
    const { data: fresh, error: reErr } = await admin
      .from("businesses").select("meta").eq("id", biz.id).maybeSingle();
    if (reErr || !fresh) { fail(`re-read failed — NOT writing ${slug}`); continue; }
    const freshRaw = typeof fresh.meta === "string" ? fresh.meta : JSON.stringify(fresh.meta || {});
    if (freshRaw !== rawBefore) {
      fail(`meta CHANGED since read (${kb(bytesBefore)} -> ${kb(freshRaw.length)}) — ABORTING ${slug}. ` +
           `Uploaded objects are orphaned but harmless; re-run.`);
      continue;
    }

    const nextRaw = JSON.stringify(meta);
    const { error: upErr } = await admin.from("businesses").update({ meta: nextRaw }).eq("id", biz.id);
    if (upErr) { fail(`write failed (${upErr.message}) — ${slug} unchanged`); continue; }

    console.log(`   WROTE  ${kb(bytesBefore)} -> ${kb(nextRaw.length)}  (${changed} migrated, ${failed} left as base64)\n`);
    summary.push({ slug, bytesBefore, bytesAfter: nextRaw.length, changed, failed });
  }

  // ── S7. Verify from the DATA, not from what this script believes it did. ────────────
  console.log("━━ verification (corpus scan, independent of what the script thinks it did)");
  const { data: rows, error: scanErr } = await admin
    .from("businesses").select("slug,meta").in("slug", TARGETS);
  if (scanErr) { fail(`verification scan failed: ${scanErr.message}`); process.exit(1); }
  let remaining = 0, totalBytes = 0;
  for (const r of rows || []) {
    const raw = typeof r.meta === "string" ? r.meta : JSON.stringify(r.meta || {});
    const n = (raw.match(/data:image\//g) || []).length;
    remaining += n; totalBytes += raw.length;
    console.log(`   ${r.slug.padEnd(26)} ${kb(raw.length).padStart(9)}   data URIs remaining: ${n}`);
  }
  console.log(`\n   TOTAL meta across the three: ${kb(totalBytes)}   data URIs remaining: ${remaining}`);
  console.log(remaining === 0
    ? "   SUCCESS — the corpus scan returns zero."
    : "   NOT DONE — re-run, or investigate the failures above.");
  if (!APPLY) console.log("\n(DRY RUN — nothing above was written.)");
}

main().catch((e) => { console.error("fatal:", e.message); process.exit(1); });
