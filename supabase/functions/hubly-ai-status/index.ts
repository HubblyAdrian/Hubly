// supabase/functions/hubly-ai-status/index.ts
// Read-only Hubly Brain status. Does not call providers or change feature routing.
import { HublyBrain } from "../_shared/hubly_ai.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const status = HublyBrain.status();
    const samplePlan = HublyBrain.plan("Build software for my detailing business");
    return new Response(
      JSON.stringify({
        ok: true,
        ...status,
        samplePlan: {
          goal: samplePlan.goal,
          skills: samplePlan.skills,
          blocked: samplePlan.blocked,
        },
        migration: {
          phase: "7.1-business-memory",
          claude_direct_calls: "still active — do not migrate features yet",
          openai_reasoning_model: HublyBrain.reasoningModel(),
          next: ["7.2 Capability Registry", "7.3 Planner", "7.4 Executors", "Migrate Website Builder"],
        },
      }),
      { headers: { ...CORS, "content-type": "application/json" } },
    );
  } catch (e) {
    console.error("hubly-ai-status", e);
    return new Response(JSON.stringify({ ok: false, error: "status unavailable" }), {
      status: 500,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }
});
