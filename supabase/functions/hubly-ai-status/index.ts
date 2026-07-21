// supabase/functions/hubly-ai-status/index.ts
// Hubly Runtime status + dry-run buildBusiness sample. No provider calls.
import { Hubly } from "../_shared/hubly_ai.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const status = Hubly.status();
    const sample = await Hubly.buildBusiness("I own Austin Home Cleaning.", {
      persist: false,
      recordHistory: false,
    });
    return new Response(
      JSON.stringify({
        ok: true,
        ...status,
        sampleBuildBusiness: {
          prompt: sample.prompt,
          understanding: {
            primaryGoal: sample.understanding.intent.primaryGoal,
            outcomes: sample.understanding.intent.requestedOutcomes,
          },
          executionPlan: sample.executionPlan,
          progress: sample.progress.map((e) => ({
            state: e.state,
            capability: e.capability,
            message: e.message,
          })),
          results: sample.orchestration.results.map((r) => ({
            capability: r.capability,
            ok: r.ok,
            skipped: r.skipped || false,
            detail: r.detail,
          })),
          status: sample.orchestration.status,
          durationMs: sample.orchestration.durationMs,
        },
        migration: {
          phase: "7.5-hubly-runtime",
          foundationChecklist: status.foundationChecklist,
          website_builder: "NOT migrated — Memory scaffold only",
          next: ["Business DNA", "Migrate Website Builder onto Runtime"],
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
