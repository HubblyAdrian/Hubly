// Visitor-counter beacon. hubly.html fires it once when a PUBLIC site mounts. It writes one
// row per load (deduped to one device/business/day) and, on the FIRST non-owner, non-bot,
// HUMAN load of a MARKET site, alerts the platform owner — once, ever.
//
// Owner-ness is DERIVED SERVER-SIDE, not trusted from the page: session-of-owner > sticky
// device-hash > client hint > visitor. Preview fetchers (iMessage/WhatsApp/Slack/etc.) are
// filtered by UA and an unknown/missing UA is treated as NON-human. Fails silently to the
// page (always 204) and loudly in our logs. Stores no raw IP.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireSecretKey } from "../_shared/supabase_admin.ts";

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").trim();
const RESEND_KEY = (Deno.env.get("RESEND_API_KEY") || "").trim();
const RESEND_FROM = (Deno.env.get("RESEND_FROM_EMAIL") || "Hubly <notifications@notifications.myhubly.app>").trim();
const OWNER_EMAIL = (Deno.env.get("PLATFORM_OWNER_EMAIL") || "").trim();
const PUBLIC_DOMAIN = (Deno.env.get("HUBLY_PUBLIC_DOMAIN") || "myhubly.app").trim();
const SALT = (Deno.env.get("PAGE_LOAD_SALT") || "").trim();

// allow-headers MUST list every header supabase-js attaches to functions.invoke — it sends
// `apikey` and `x-client-info` in addition to authorization/content-type. Omit either and the
// browser's CORS preflight is rejected and the fetch throws BEFORE reaching us (curl, which
// does no preflight, still works — which is exactly how this hid). This is the documented default.
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS" };
const done = () => new Response(null, { status: 204, headers: CORS });

// Preview/link-unfurl fetchers and generic bots. An owner sharing their link fires these
// FIRST — they must never count as the human visitor. Unknown/missing UA is NOT human either.
const PREVIEW_BOT = /facebookexternalhit|whatsapp|slackbot|twitterbot|applebot|discordbot|linkedinbot|telegrambot|googlebot|bingbot|embedly|pinterest|redditbot|vkshare|skypeuripreview|quora link|developers\.google\.com\/\+\/web\/snippet|nuzzel|w3c_validator/i;
const GENERIC_BOT = /\bbot\b|crawl|spider|slurp|scrap|preview|fetch|monitor|headless|phantom|puppeteer|lighthouse|curl|wget|python-requests|go-http|okhttp|axios|node-fetch|libwww|httpclient/i;
function deviceClass(ua: string): string {
  const s = (ua || "").toLowerCase();
  if (!s) return "unknown";
  if (PREVIEW_BOT.test(s) || GENERIC_BOT.test(s)) return "bot";
  if (/ipad|tablet|playbook|silk|kindle/.test(s)) return "tablet";
  if (/mobi|android|iphone|ipod|iemobile|blackberry/.test(s)) return "mobile";
  if (/mozilla\/5\.0/.test(s) && /(chrome|crios|firefox|fxios|safari|edg|opr|version)/.test(s)) return "desktop";
  return "unknown";   // unrecognized ⇒ unknown, never human
}
const HUMAN = new Set(["mobile", "tablet", "desktop"]);

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function escapeHtml(s: string) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const businessId = String(body?.business_id || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(businessId)) return done();

    const ua = req.headers.get("user-agent") || "";
    const dev = deviceClass(ua);
    const referrer = (String(body?.referrer || "") || req.headers.get("referer") || "").slice(0, 300) || null;
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
    const day = new Date().toISOString().slice(0, 10);
    const visitorHash = await sha256hex(`${SALT}|${ip}|${ua}|${businessId}|${day}`);

    const key = requireSecretKey().key;
    const admin = createClient(SUPABASE_URL, key, { auth: { persistSession: false } });

    // RATE GUARD (public, unauthenticated endpoint). LIMIT: 60 rows per business_id per rolling
    // 60 seconds. ON EXCEED: the load is DROPPED SILENTLY — no row, no alert, still HTTP 204 to
    // the page. Coarse anti-inflation only; a real site's traffic never approaches this, and the
    // daily dedup already caps a single device to one row/day.
    const { count: recent } = await admin.from("page_loads").select("id", { count: "exact", head: true })
      .eq("business_id", businessId).gte("loaded_at", new Date(Date.now() - 60_000).toISOString());
    if ((recent || 0) > 60) return done();

    const { data: biz } = await admin.from("businesses")
      .select("id,name,slug,owner_id,account_kind,first_visitor_at").eq("id", businessId).maybeSingle();
    if (!biz) return done();

    // ── OWNER DERIVATION (server-side first; the page is the LAST word, not the first) ──────
    let isOwner = false; let ownerDecision = "visitor";
    // 1. Session belongs to the owner of this business → owner, whatever the client claimed.
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (token) {
      try { const { data } = await admin.auth.getUser(token); if (data?.user?.id && data.user.id === biz.owner_id) { isOwner = true; ownerDecision = "server_auth"; } } catch { /* not a user token */ }
    }
    // 2. Sticky: this device (visitor_hash) has been seen as the owner on this business before.
    if (!isOwner) {
      const { data: prior } = await admin.from("page_loads").select("id")
        .eq("business_id", businessId).eq("visitor_hash", visitorHash).eq("is_owner_preview", true).limit(1).maybeSingle();
      if (prior) { isOwner = true; ownerDecision = "sticky_hash"; }
    }
    // 3. Client hint, last: builder/edit-mode load the page flagged.
    if (!isOwner && body?.is_owner_preview === true) { isOwner = true; ownerDecision = "client_hint"; }

    // WRITE the row. loaded_day is passed EXPLICITLY (the same `day` the visitor_hash used) so the
    // row's day and the hash's day are identical by construction — never the column's current_date
    // default, which is the DB timezone and could disagree at a day boundary and silently break dedup.
    // A unique-violation (23505) is the dedup index doing its job = "on conflict do nothing", SILENT:
    // it is expected, not a failure, and must never console.error — training ourselves to ignore loud
    // logs would destroy their value everywhere. console.error is reserved for writes that ACTUALLY failed.
    const { error } = await admin.from("page_loads").insert({
      business_id: businessId, loaded_day: day, referrer, device_class: dev,
      is_owner_preview: isOwner, owner_decision: ownerDecision, visitor_hash: visitorHash,
    });
    if (error && (error as { code?: string }).code !== "23505") console.error("page-view insert failed", error.message);

    // ── FIRST non-owner, HUMAN load of a MARKET site → alert once ──────────────────────────
    if (HUMAN.has(dev) && !isOwner && biz.account_kind === "market" && !biz.first_visitor_at) {
      await fireFirstVisitorAlert(admin, biz as Record<string, unknown>, referrer);
    }
    return done();
  } catch (e) {
    console.error("page-view threw", (e as Error)?.message);   // loud in our logs
    return done();                                             // never break the page
  }
});

// ORDERING (chosen, not accidental): claim first_visitor_at ATOMICALLY first — so concurrent
// loads can never double-fire — then write a 'pending' delivery, send, and flip sent/failed.
// If the process dies between the marker and the send, the alert is LOST, but DETECTABLE: the
// marker is set with a first_visitor delivery stuck at 'pending' (or none). We choose
// lost-but-visible over a possible double-send. (Same visible-failure pattern as booking notify.)
async function fireFirstVisitorAlert(admin: ReturnType<typeof createClient>, biz: Record<string, unknown>, referrer: string | null) {
  const { data: claimed } = await admin.from("businesses")
    .update({ first_visitor_at: new Date().toISOString() }).eq("id", biz.id).is("first_visitor_at", null)
    .select("id").maybeSingle();
  if (!claimed) return;   // someone else claimed it first — exactly once

  const { data: del } = await admin.from("notification_deliveries").insert({
    business_id: biz.id, subject_type: "first_visitor", subject_id: biz.id, recipient_role: "owner",
    channel: "email", provider: "resend", status: "pending",
  }).select("id").maybeSingle();
  const delId = (del as { id?: string } | null)?.id || null;

  const name = String(biz.name || "(a site)");
  const url = `https://${String(biz.slug || "")}.${PUBLIC_DOMAIN}`;
  const src = referrer ? `from ${referrer}` : "direct / unknown source (a texted or saved link looks like this)";
  const when = new Date().toISOString();
  let sent = false, provErr: string | null = null, provId: string | null = null;
  if (RESEND_KEY && OWNER_EMAIL) {
    try {
      const html = `<p><b>Someone just opened ${escapeHtml(name)} — the first visitor who isn't the owner.</b></p>`
        + `<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p><p>${escapeHtml(when)} · ${escapeHtml(src)}</p>`
        + `<p>Reach out — this is the first sign anyone outside has looked at a Hubly site.</p>`;
      const r = await fetch("https://api.resend.com/emails", { method: "POST",
        headers: { authorization: `Bearer ${RESEND_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ from: RESEND_FROM, to: [OWNER_EMAIL], subject: `First visitor: ${name}`, html }) });
      const t = await r.text(); if (!r.ok) provErr = `resend ${r.status}: ${t.slice(0, 160)}`; else { sent = true; try { provId = JSON.parse(t).id || null; } catch { /* */ } }
    } catch (e) { provErr = (e as Error)?.message || "threw"; }
  } else provErr = "not_configured (RESEND_API_KEY / PLATFORM_OWNER_EMAIL)";

  if (delId) {
    try {
      await admin.from("notification_deliveries").update({
        recipient: OWNER_EMAIL || null, provider_message_id: provId,
        status: sent ? "sent" : "failed", error: provErr, attempted_at: new Date().toISOString(),
      }).eq("id", delId);
    } catch (e) { console.error("first_visitor delivery flip failed", (e as Error)?.message); }
  }
  if (!sent) console.error("first_visitor alert send failed", name, provErr);   // loud
}
