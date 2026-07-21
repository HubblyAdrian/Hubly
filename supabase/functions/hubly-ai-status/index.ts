// supabase/functions/hubly-ai-status/index.ts
// Hubly Runtime + DNA + Website Runtime status. Dry-run buildBusiness.
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
      "I own Acme Home Cleaning.",
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
            websiteHeadline: sample.memory.currentWebsite?.headline || null,
            websitePublished: sample.memory.currentWebsite?.published || false,
          },
          dnaIdentity: {
            brand: sample.dna.brand,
            customerProfile: sample.dna.customerProfile,
            goals: sample.dna.goals,
          },
          website: sample.website,
          executionPlan: sample.executionPlan,
          confidence: sample.confidence.map((c) => ({
            capability: c.capability,
            confidence: c.confidence,
            shouldAsk: c.shouldAsk,
          })),
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
          phase: "7.7-website-runtime",
          constitution: "docs/HUBLY_CONSTITUTION.md",
          website_builder: "Migrated onto Runtime — Memory + DNA → published Instant Site",
          creative_director: "Still on Claude for editor chat until retired",
          next: ["7.8 Marketplace Runtime", "7.9 CRM Runtime", "8 Business Coach"],
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
