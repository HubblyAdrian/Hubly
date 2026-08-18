/**
 * Moves logos stored as `data:` URIs in businesses.logo_url into Storage.
 *
 * WHY
 *
 * hostBrandImage in public/hubly.html used to end `return hosted || dataUrl`:
 * three silent upload attempts, then the raw data URL, which callers wrote
 * into businesses.logo_url. Those rows render fine on the classic site and are
 * DROPPED by the Document renderer — isValidMediaSrc allows only the storage
 * and unsplash origins — so the owner's logo silently becomes an initials
 * monogram the moment their site changes format.
 *
 * The writer is fixed. This moves the rows it already produced.
 *
 * WHAT IT DOES NOT DO
 *
 * It never invents or re-encodes an image: the bytes are decoded from the
 * existing data URI and uploaded unchanged. If the upload fails, the row is
 * left exactly as it was — a broken-on-Document logo is still better than no
 * logo, and a half-migrated row is worse than either.
 *
 * Usage:
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
 *   deno run --allow-net --allow-env scripts/migrate-data-uri-logos.ts [--apply]
 *
 * Without --apply it reports what it would do and changes nothing.
 */

const URL_ = Deno.env.get("SUPABASE_URL");
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!URL_ || !KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  Deno.exit(1);
}
const APPLY = Deno.args.includes("--apply");
const H = { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": "application/json" };

const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
  "image/webp": "webp", "image/svg+xml": "svg", "image/gif": "gif",
};

function decodeDataUri(uri: string): { bytes: Uint8Array; mediaType: string } | null {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(uri);
  if (!m) return null;
  const mediaType = m[1].toLowerCase();
  const isB64 = !!m[2];
  const raw = m[3];
  try {
    if (isB64) {
      const bin = atob(raw);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { bytes, mediaType };
    }
    return { bytes: new TextEncoder().encode(decodeURIComponent(raw)), mediaType };
  } catch {
    return null;
  }
}

const rows = await (await fetch(
  `${URL_}/rest/v1/businesses?select=id,slug,owner_id,logo_url&logo_url=like.data:*`,
  { headers: H },
)).json();

console.log(`data: URI logos found: ${rows.length}${APPLY ? "" : "   (dry run — pass --apply to migrate)"}`);

for (const b of rows) {
  const decoded = decodeDataUri(b.logo_url);
  if (!decoded) {
    console.log(`  ${b.slug}: could not decode the data URI — left unchanged`);
    continue;
  }
  const ext = EXT[decoded.mediaType] || "png";
  // Same folder convention the storage write policies enforce for owners, and
  // the same one the server-side uploader already uses for drafts.
  const path = `${b.owner_id || "unclaimed"}/logo-migrated-${b.id}.${ext}`;
  console.log(`  ${b.slug}: ${decoded.bytes.length} bytes ${decoded.mediaType} -> brand-assets/${path}`);
  if (!APPLY) continue;

  const up = await fetch(`${URL_}/storage/v1/object/brand-assets/${path}`, {
    method: "POST",
    headers: { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": decoded.mediaType, "x-upsert": "true" },
    body: decoded.bytes,
  });
  if (!up.ok) {
    console.log(`     upload FAILED (${up.status}) — row left unchanged`);
    continue;
  }
  const publicUrl = `${URL_}/storage/v1/object/public/brand-assets/${path}`;

  // Read it back before touching the row. Writing a URL we have not confirmed
  // serves bytes would replace one broken logo with a different broken logo.
  const check = await fetch(publicUrl);
  if (!check.ok || Number(check.headers.get("content-length") || 0) === 0) {
    console.log(`     uploaded but not readable (${check.status}) — row left unchanged`);
    continue;
  }

  const patch = await fetch(`${URL_}/rest/v1/businesses?id=eq.${b.id}`, {
    method: "PATCH",
    headers: { ...H, Prefer: "return=representation" },
    body: JSON.stringify({ logo_url: publicUrl }),
  });
  console.log(patch.ok ? `     migrated, verified readable (${check.headers.get("content-length")} bytes)` : `     row update FAILED (${patch.status})`);
}
