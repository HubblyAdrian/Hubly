// supabase/functions/hubly-find-pro/index.ts
// Phase 7.8 — Customer Runtime entry: Hubly.findPro(prompt)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Hubly } from "../_shared/hubly_ai.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonRes({ ok: false, error: "POST required" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const prompt = String(body?.prompt || body?.conversation || "").trim();
    if (!prompt) return jsonRes({ ok: false, error: "prompt required" }, 400);

    const dryRun = body?.dry_run === true;
    let supabase = null as ReturnType<typeof createClient> | null;
    const authHeader = req.headers.get("Authorization") || "";

    if (!dryRun) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
      if (!supabaseUrl || !anonKey) {
        return jsonRes({ ok: false, error: "Server isn’t configured yet." }, 500);
      }
      // Match can run publicly; attach auth when present for persistence later
      supabase = createClient(supabaseUrl, anonKey, authHeader
        ? { global: { headers: { Authorization: authHeader } } }
        : undefined);
    }

    const progress: Array<{ state: string; message: string }> = [];
    const result = await Hubly.findPro(prompt, {
      city: body?.city ? String(body.city) : null,
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
