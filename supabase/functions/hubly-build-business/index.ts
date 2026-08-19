// supabase/functions/hubly-build-business/index.ts
// Phase 7.7 — Public Runtime entry: Hubly.buildBusiness(prompt)
// Website capability can create/publish Instant Site from Memory + DNA.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Hubly } from "../_shared/hubly_ai.ts";
// Supabase key resolution goes through _shared/supabase_admin.ts. It THROWS on a
// missing key instead of continuing with "" (nine call sites used to 401 quietly
// and be logged), reads the plural SUPABASE_PUBLISHABLE_KEYS the platform
// actually injects rather than the singular name that is set nowhere, and never
// sends a non-JWT sb_secret_ key as a Bearer token -- PostgREST rejects those as
// "Invalid JWT", which looks exactly like the empty-key 401 in a log.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonRes({ ok: false, error: "POST required" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const prompt = String(body?.prompt || body?.conversation || "").trim();
    if (!prompt) return jsonRes({ ok: false, error: "prompt required" }, 400);

    const dryRun = body?.dry_run === true || body?.persist === false;
    let businessId = String(body?.business_id || body?.businessId || "").trim() || null;

    // Typed from the HELPER, not from a local createClient import: this file and
    // _shared/supabase_admin.ts pin different supabase-js versions, and their
    // SupabaseClient generics are not assignable to each other.
    let supabase = null as ReturnType<typeof createUserClient> | null;
    let ownerId: string | null = null;
    const authHeader = req.headers.get("Authorization") || "";

    if (!dryRun || businessId) {
      if (!authHeader.toLowerCase().startsWith("bearer ")) {
        return jsonRes({ ok: false, error: "Sign in required to persist a run" }, 401);
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      if (!supabaseUrl) {
        return jsonRes({ ok: false, error: "Server isn’t configured yet." }, 500);
      }
      supabase = createUserClient(authHeader);
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user) {
        return jsonRes({ ok: false, error: "Your session expired — refresh and try again." }, 401);
      }
      ownerId = userData.user.id;
      if (businessId) {
        const { data: owned } = await supabase
          .from("businesses")
          .select("id")
          .eq("id", businessId)
          .eq("owner_id", ownerId)
          .maybeSingle();
        if (!owned) return jsonRes({ ok: false, error: "Business not found for this account" }, 403);
      }
    }

    const progress: Array<{ state: string; capability: string | null; message: string }> = [];
    const result = await Hubly.buildBusiness(prompt, {
      businessId,
      ownerId,
      memory: body?.memory && typeof body.memory === "object" ? body.memory : null,
      dna: body?.dna && typeof body.dna === "object" ? body.dna : null,
      supabase,
      persist: !dryRun,
      recordHistory: !dryRun,
      maxRetries: typeof body?.max_retries === "number" ? body.max_retries : 1,
      onProgress: (e) => {
        progress.push({
          state: String(e.state),
          capability: e.capability,
          message: e.message,
        });
      },
    });

    return jsonRes({
      ok: true,
      phase: "8",
      dryRun,
      runId: result.runId,
      prompt: result.prompt,
      understanding: {
        primaryGoal: result.understanding.intent.primaryGoal,
        outcomes: result.understanding.intent.requestedOutcomes,
      },
      memory: result.orchestration.memory,
      dna: result.dna,
      website: result.website,
      identity: result.identity || null,
      timeline: result.timeline || null,
      health: result.health || null,
      domain: result.domain || null,
      maturity: result.maturity || null,
      creativeDirector: result.creativeDirector || null,
      daily: result.daily || null,
      executionPlan: result.executionPlan,
      confidence: result.confidence,
      clarifyingQuestions: result.clarifyingQuestions,
      progress: result.progress.map((e) => ({
        state: e.state,
        capability: e.capability,
        message: e.message,
        at: e.at,
      })),
      results: result.orchestration.results.map((r) => ({
        capability: r.capability,
        ok: r.ok,
        skipped: r.skipped || false,
        detail: r.detail,
        effects: r.effects || null,
      })),
      status: result.orchestration.status,
      durationMs: result.orchestration.durationMs,
      historyId: result.orchestration.historyId || null,
      liveStream: progress,
    });
  } catch (e) {
    console.error("hubly-build-business", e);
    return jsonRes({
      ok: false,
      error: e instanceof Error ? e.message : "buildBusiness failed",
    }, 500);
  }
});
