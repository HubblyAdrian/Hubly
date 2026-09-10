// supabase/functions/hubly-find-pro/index.ts
// Phase 7.8 — Customer Runtime entry: Hubly.findPro(prompt)
import { requireSecretKey } from "../_shared/supabase_admin.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Hubly } from "../_shared/hubly_ai.ts";
import { createUserClient } from "../_shared/supabase_admin.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}


// ── CLOSED 2026-09-09. This endpoint was reachable by anyone on the internet. ──────────
// verify_jwt = false in config.toml AND no check in the handler, so the only thing
// resembling authorisation here was a CORS header. One unauthenticated GET ran three
// model calls (think + buildBusiness + findPro) — roughly a signup's worth of spend —
// and wrote a hubly_brain_executions row, because that log write is not gated by the
// persist:false flag this passes. It created no business rows; persist:false does hold.
//
// The invocation logs showed ZERO hits in 24 hours, so nothing had walked through it.
// Unexploited is not the same as safe, and we now know exactly what one hit costs.
// Service key only: this is a diagnostic surface, it has no anonymous audience.
function opsAuthorised(req: Request): boolean {
  let expected = "";
  try { expected = requireSecretKey().key; } catch { return false; }
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const cron = (Deno.env.get("HUBLY_CRON_SECRET") || "").trim();
  const header = (req.headers.get("x-hubly-cron-secret") || "").trim();
  return (!!expected && bearer === expected) || (!!cron && (header === cron || bearer === cron));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (!opsAuthorised(req)) return new Response(JSON.stringify({ ok: false, error: "unauthorised" }), { status: 401, headers: { ...CORS, "content-type": "application/json" } });
  if (req.method !== "POST") return jsonRes({ ok: false, error: "POST required" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const prompt = String(body?.prompt || body?.conversation || "").trim();
    if (!prompt) return jsonRes({ ok: false, error: "prompt required" }, 400);

    const dryRun = body?.dry_run === true;
    // Typed from the HELPER, not from a local createClient import: this file and
    // _shared/supabase_admin.ts pin different supabase-js versions, and their
    // SupabaseClient generics are not assignable to each other.
    let supabase = null as ReturnType<typeof createUserClient> | null;
    const authHeader = req.headers.get("Authorization") || "";

    if (!dryRun) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      if (!supabaseUrl) {
        return jsonRes({ ok: false, error: "Server isn’t configured yet." }, 500);
      }
      // Match can run publicly; attach auth when present for persistence later
      supabase = createUserClient(authHeader);
    }

    const progress: Array<{ state: string; message: string }> = [];
    const result = await Hubly.findPro(prompt, {
      city: body?.city ? String(body.city) : null,
      zip: body?.zip ? String(body.zip) : null,
      customerMemory: body?.customer_memory || body?.customerMemory || null,
      customerProfile: body?.customer_profile || body?.customerProfile || null,
      supabase: dryRun ? null : supabase,
      onProgress: (e) => progress.push({ state: String(e.state), message: e.message }),
    });

    return jsonRes({
      ok: true,
      phase: "7.8",
      dryRun,
      runId: result.runId,
      prompt: result.prompt,
      customerMemory: result.customerMemory,
      customerProfile: result.customerProfile,
      need: result.need,
      recommendations: result.recommendations,
      matches: result.matches,
      progress: result.progress.map((e) => ({
        state: e.state,
        message: e.message,
        at: e.at,
      })),
      liveStream: progress,
      matchPayload: result.matchPayload || null,
    });
  } catch (e) {
    console.error("hubly-find-pro", e);
    return jsonRes({
      ok: false,
      error: e instanceof Error ? e.message : "findPro failed",
    }, 500);
  }
});
