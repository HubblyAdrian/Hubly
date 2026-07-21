// supabase/functions/hubly-ai-status/index.ts
// Read-only Hubly Brain status + foundation rules. Does not call providers.
import { HublyBrain, HUBLY_BRAIN_RULES } from "../_shared/hubly_ai.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const status = HublyBrain.status();
    const trace = HublyBrain.inspect("Build software for my detailing business");
    return new Response(
      JSON.stringify({
        ok: true,
        ...status,
        rules: HUBLY_BRAIN_RULES,
        sampleTrace: {
          id: trace.id,
          at: trace.at,
          pipeline: trace.pipeline,
          understanding: {
            primaryGoal: (trace.understanding as { intent?: { primaryGoal?: string } })?.intent
              ?.primaryGoal,
            outcomes: (trace.understanding as { intent?: { requestedOutcomes?: string[] } })?.intent
              ?.requestedOutcomes,
          },
          memoryKeys: trace.memoryKeys,
          selectedCapabilities: trace.selectedCapabilities,
          planGoal: (trace.plan as { goal?: string })?.goal,
          planSource: (trace.plan as { source?: string })?.source,
          execution: trace.execution,
          notes: trace.notes,
        },
        migration: {
          phase: "foundation-locked",
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
