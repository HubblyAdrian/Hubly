// supabase/functions/hubly-ai-status/index.ts
// Status + OpenAI production diagnose (ops).
import { Hubly } from "../_shared/hubly_ai.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = new URL(req.url);
    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      body = await req.json().catch(() => ({}));
    }
    const action = String(
      body?.action || url.searchParams.get("action") || "status",
    ).trim();

    if (action === "diagnose_openai" || action === "diagnose") {
      const transport = body?.transport != null
        ? String(body.transport)
        : url.searchParams.get("transport");
      const model = body?.model != null
        ? String(body.model)
        : url.searchParams.get("model");
      const jsonMode = body?.jsonMode === true ||
        url.searchParams.get("jsonMode") === "1";
      const diagnose = await Hubly.diagnoseOpenAI({
        transport,
        model,
        jsonMode,
        prompt: body?.prompt != null ? String(body.prompt) : undefined,
      });
      return json({
        ok: !!diagnose.ok,
        action: "diagnose_openai",
        diagnose,
        statusSnapshot: {
          configured: Hubly.status().configured,
          openaiTransport: Hubly.openaiTransport(),
          reasoningModel: Hubly.reasoningModel(),
        },
      }, diagnose.ok ? 200 : 502);
    }

    const status = Hubly.status();
    const business = await Hubly.buildBusiness("I own Acme Home Cleaning.", {
      persist: false,
      recordHistory: false,
    });
    const customer = await Hubly.findPro(
      "I need someone to carefully pressure wash my driveway this weekend.",
      {},
    );
    return json({
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
    });
  } catch (e) {
    console.error("hubly-ai-status", e);
    return json({
      ok: false,
      error: e instanceof Error ? e.message : "status unavailable",
    }, 500);
  }
});
