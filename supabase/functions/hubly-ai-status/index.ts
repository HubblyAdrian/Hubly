// supabase/functions/hubly-ai-status/index.ts
// Status: magical Build + Customer Runtime + Identity / Timeline / Health.
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
    const business = await Hubly.buildBusiness("I own Acme Home Cleaning.", {
      persist: false,
      recordHistory: false,
    });
    const customer = await Hubly.findPro(
      "I need someone to carefully pressure wash my driveway this weekend.",
      {},
    );
    return new Response(
      JSON.stringify({
        ok: true,
        ...status,
        sampleBuildBusiness: {
          prompt: business.prompt,
          memoryName: business.memory.name,
          progressTail: business.progress.map((e) => e.message),
          identity: business.identity,
          health: business.health
            ? { overall: business.health.overall, deltaWeek: business.health.deltaWeek }
            : null,
          timelineHeadline: business.timeline?.headline || null,
          domainPreferred: business.domain?.preferred || null,
          website: business.website,
          capabilitiesRun: business.orchestration.results
            .filter((r) => r.ok)
            .map((r) => r.capability),
        },
        sampleFindPro: {
          prompt: customer.prompt,
          customerMemory: {
            city: customer.customerMemory.city,
            service: customer.customerMemory.job?.service,
          },
          customerProfile: {
            prefersPremium: customer.customerProfile.prefersPremium,
            caresAboutCarefulness: customer.customerProfile.caresAboutCarefulness,
            booksOnWeekends: customer.customerProfile.booksOnWeekends,
          },
          need: customer.need,
          progress: customer.progress.map((e) => e.message),
        },
        migration: {
          phase: "living-business-build-ux",
          constitution: "docs/HUBLY_CONSTITUTION.md",
          next: [
            "Living Business",
            "Living Customer",
            "Living Marketplace",
            "Business Health → proactive Coach",
          ],
        },
      }),
      { headers: { ...CORS, "content-type": "application/json" } },
    );
  } catch (e) {
    console.error("hubly-ai-status", e);
    return new Response(JSON.stringify({
      ok: false,
      error: e instanceof Error ? e.message : "status unavailable",
    }), {
      status: 500,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }
});
