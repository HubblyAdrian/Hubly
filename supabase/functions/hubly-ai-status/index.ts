// supabase/functions/hubly-ai-status/index.ts
// Hubly Runtime + DNA status. Dry-run buildBusiness. No provider calls.
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
    const sample = await Hubly.buildBusiness(
      "I own Acme Detailing in Phoenix. Luxury mobile detailing for high-income homeowners. Ideal jobs are ceramic coatings. Avoid cheap customers. Goal: hire first employee. Busy in spring.",
      { persist: false, recordHistory: false },
    );
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
          memoryFacts: {
            name: sample.memory.name,
            industry: sample.memory.industry,
            city: sample.memory.city,
          },
          dnaIdentity: {
            brand: sample.dna.brand,
            customerProfile: sample.dna.customerProfile,
            goals: sample.dna.goals,
            pricing: sample.dna.pricing,
            identity: sample.dna.identity,
            operations: sample.dna.operations,
          },
          executionPlan: sample.executionPlan,
          confidence: sample.confidence.map((c) => ({
            capability: c.capability,
            confidence: c.confidence,
            reason: c.reason,
            missing: c.missing,
            clarifyingQuestions: c.clarifyingQuestions,
            shouldAsk: c.shouldAsk,
          })),
          clarifyingQuestions: sample.clarifyingQuestions,
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
          phase: "7.6-business-dna",
          foundationChecklist: status.foundationChecklist,
          website_builder: "NOT migrated — next is 7.7 proof",
          architecture: "FROZEN after DNA — migrate capabilities, do not invent new core layers",
          next: ["7.7 Website Builder → Runtime", "7.8 CRM → Runtime", "7.9 Marketplace Profile → Runtime"],
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
