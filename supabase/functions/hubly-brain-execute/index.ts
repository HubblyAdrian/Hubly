// supabase/functions/hubly-brain-execute/index.ts
// Phase 7.4 — run Hubly Brain executors for Memory-safe skills.
// Model never writes DB; executors persist Business Memory SSOT.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { HublyBrain } from "../_shared/hubly_ai.ts";
import type { HublyPlan } from "../_shared/hubly_brain_planner.ts";

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
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return jsonRes({ ok: false, error: "Sign in required" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) {
      return jsonRes({ ok: false, error: "Server isn’t configured yet." }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonRes({ ok: false, error: "Your session expired — refresh and try again." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const businessId = String(body?.business_id || body?.businessId || "").trim();
    if (!businessId) return jsonRes({ ok: false, error: "business_id required" }, 400);

    const { data: owned, error: ownErr } = await userClient
      .from("businesses")
      .select("id")
      .eq("id", businessId)
      .eq("owner_id", userData.user.id)
      .maybeSingle();
    if (ownErr || !owned) {
      return jsonRes({ ok: false, error: "Business not found for this account" }, 403);
    }

    let memory = body?.memory && typeof body.memory === "object" ? body.memory : null;
    if (!memory) {
      const { data: row } = await userClient
        .from("business_memories")
        .select("memory")
        .eq("business_id", businessId)
        .maybeSingle();
      memory = row?.memory || null;
    }

    let plan: HublyPlan | null = null;
    if (body?.plan && typeof body.plan === "object" && Array.isArray(body.plan.steps)) {
      plan = body.plan as HublyPlan;
    } else if (body?.conversation) {
      const turn = HublyBrain.ingest(body.conversation, memory);
      memory = turn.memory;
      plan = turn.plan;
    } else {
      plan = HublyBrain.plan(memory);
    }

    const dryRun = body?.dry_run === true || body?.persist === false;
    const result = await HublyBrain.execute(plan, {
      businessId,
      memory,
      supabase: userClient,
      source: "system",
      persist: !dryRun,
    });

    return jsonRes({
      ok: true,
      phase: "7.4",
      dryRun,
      executableSkills: HublyBrain.executableSkills(),
      plan: result.plan,
      ran: result.ran,
      skipped: result.skipped,
      persisted: result.persisted,
      memory: result.memory,
    });
  } catch (e) {
    console.error("hubly-brain-execute", e);
    return jsonRes({
      ok: false,
      error: e instanceof Error ? e.message : "execute failed",
    }, 500);
  }
});
