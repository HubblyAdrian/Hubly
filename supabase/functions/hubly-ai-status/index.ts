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
    const brain = typeof Hubly.experts === "function" ? Hubly.experts() : null;
    const thinkSample = typeof Hubly.think === "function"
      ? await Hubly.think({
        request: "Build me a luxury website for my lawn care company.",
        memory: { name: "Acme Lawn", industry: "Lawn care" },
        blueprintKnowledge: {
          customerPsychology: "Homeowners hire for trust and response time before price.",
          buyingBehavior: "Decide quickly when booking is obvious.",
          homepageGoals: ["Prove trust", "Make booking obvious"],
          decisionFactors: ["Trust", "Price"],
        },
        debug: true,
      })
      : null;
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
        milestone1: {
          personality: "Hubly",
          brain,
          sampleThink: thinkSample
            ? {
              intent: thinkSample.intent,
              response: thinkSample.response,
              confidence: thinkSample.confidence,
              confidenceBand: thinkSample.confidenceBand,
              expertsRun: thinkSample.expertsRun,
              decisions: (thinkSample.decisions || []).slice(0, 4),
              timeline: thinkSample.timeline,
            }
            : null,
        },
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
          maturity: business.maturity
            ? { stage: business.maturity.stage, label: business.maturity.label }
            : null,
          creativeDirector: business.creativeDirector
            ? {
              headline: business.creativeDirector.headline,
              rationales: (business.creativeDirector.rationales || []).map((r) => r.title),
            }
            : null,
          dailyGreeting: business.daily?.greeting || null,
          dailyRecommendation: business.daily?.recommendation?.title || null,
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
          phase: "8-prove-the-product",
          constitution: "docs/HUBLY_CONSTITUTION.md",
          guidingPrinciple: "Hubly should make owning a business feel as simple as describing one.",
          jobs: [
            "Build my business",
            "Get me customers",
            "Help me grow",
            "Run my business",
          ],
          next: [
            "Perfect Build + Creative Director",
            "Hubly Daily as homepage",
            "Domain purchase",
            "Living Business",
            "Living Marketplace",
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
