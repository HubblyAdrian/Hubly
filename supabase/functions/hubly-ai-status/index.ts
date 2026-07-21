// supabase/functions/hubly-ai-status/index.ts
// Status: Website Runtime + Customer Runtime foundations.
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
          websiteHeadline: business.memory.currentWebsite?.headline || null,
          progressTail: business.progress.slice(-8).map((e) => e.message),
          website: business.website,
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
          phase: "7.8-customer-runtime",
          constitution: "docs/HUBLY_CONSTITUTION.md",
          next: ["7.9 Self-growing CRM", "8.0 AI Business Coach", "8.1 Autonomous Growth"],
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
