// supabase/functions/hubly-daily/index.ts
// Phase 8 — Hubly Daily signature briefing
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
    const ownerName = body?.owner_name || body?.ownerName || null;
    const stats = body?.stats && typeof body.stats === "object" ? body.stats : null;
    let memory = body?.memory && typeof body.memory === "object" ? body.memory : null;
    let dna = body?.dna && typeof body.dna === "object" ? body.dna : null;

    const businessId = String(body?.business_id || body?.businessId || "").trim() || null;
    const authHeader = req.headers.get("Authorization") || "";

    if (businessId && authHeader.toLowerCase().startsWith("bearer ")) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
      if (supabaseUrl && anonKey) {
        const supabase = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: memRow } = await supabase
          .from("business_memories")
          .select("memory")
          .eq("business_id", businessId)
          .maybeSingle();
        const { data: dnaRow } = await supabase
          .from("business_dna")
          .select("dna")
          .eq("business_id", businessId)
          .maybeSingle();
        if (memRow?.memory && !memory) memory = memRow.memory;
        if (dnaRow?.dna && !dna) dna = dnaRow.dna;
      }
    }

    const daily = Hubly.daily({
      memory,
      dna,
      ownerName: ownerName ? String(ownerName) : null,
      stats,
    });

    return jsonRes({
      ok: true,
      phase: "8",
      daily,
    });
  } catch (e) {
    console.error("hubly-daily", e);
    return jsonRes({
      ok: false,
      error: e instanceof Error ? e.message : "daily failed",
    }, 500);
  }
});
