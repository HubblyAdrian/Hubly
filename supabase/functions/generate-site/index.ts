// supabase/functions/generate-site/index.ts
// Thin Website Runtime façade — copy generation via Hubly.generateWebsite.
// Model calls go through HublyAI only — never direct Anthropic/OpenAI.
// Preserves the legacy Instant Site response contract (ok + generated JSON).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Hubly, HublyAIConfigError, HublyAIProviderError } from "../_shared/hubly_ai.ts";
import { extractJsonObject, loadBusinessMemoryDna } from "../_shared/hubly_brain_edge.ts";
import { websiteBuilderSystemPrompt } from "../_shared/hubly_brain_website.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const JSON_SHAPE = `Respond with ONLY valid JSON, no markdown fences, no preamble, matching
exactly this shape:
{
  "hero_headline_options": [string] (exactly 4 items, each max 8 words, punchy,
    can use a line break as \\n -- vary the angle across the 4: e.g. one
    benefit-led, one convenience-led, one trust-led, one urgency-led. Do not
    just reword the same idea four times),
  "hero_subhead": string (1 sentence, max 22 words),
  "about": string (2-3 short paragraphs, first person as the owner, separated by \\n\\n),
  "faq": [ {"q": string, "a": string} ]  (exactly 6 items, real questions a customer would actually have),
  "seo_title": string (max 60 characters, include business name and city),
  "seo_description": string (max 155 characters),
  "why_choose": [ {"label": string (max 4 words)} ] (exactly 5 items),
  "services_title": string (short section title for offerings),
  "services_sub": string (1 sentence under services),
  "gallery_title": string (e.g. Portfolio or Before & After — match the Blueprint gallery mode),
  "gallery_sub": string (1 sentence under gallery),
  "reviews_title": string,
  "reviews_sub": string
}`;

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

function buildSystemPrompt(blueprint: Record<string, unknown> | null) {
  const base = websiteBuilderSystemPrompt();
  if (!blueprint || typeof blueprint !== "object") {
    return `${base}

Legacy Instant Site contract — ${JSON_SHAPE}`;
  }

  const k = (blueprint.knowledge || {}) as Record<string, unknown>;
  const name = String(blueprint.name || "local service");
  const galleryMode = blueprint.galleryMode ||
    (blueprint.gallery as { mode?: string } | undefined)?.mode ||
    "before_after";
  const sectionCopy = blueprint.sectionCopy || {};
  return `${base}

You write website copy for a ${name} business. You are given basic facts
about a real business and must generate the rest of a premium, conversion-focused
one-page website's content.

Brand voice: ${k.brandVoice || "Confident, warm, plain-spoken."}
Customer psychology: ${k.customerPsychology || ""}
Buying behavior: ${k.buyingBehavior || ""}
Decision factors: ${((blueprint.decisionFactors as string[]) || []).join(", ")}
Customer expectations: ${((blueprint.customerExpectations as string[]) || []).join(", ")}
Homepage priority (lead with these): ${((blueprint.homepagePriority as string[]) || []).join(" → ")}
Trust signals: ${((blueprint.trustSignals as string[]) || []).join(", ")}
Copy rules: ${((k.copyRules as string[]) || []).join("; ")}
Gallery rules: ${((k.galleryRules as string[]) || []).join("; ")}
Gallery mode: ${galleryMode}
Suggested section chrome (prefer these phrasings unless a better fit appears): ${JSON.stringify(sectionCopy)}
Service catalog context: ${JSON.stringify(blueprint.serviceCatalog || [])}

CRITICAL: Stay inside the ${name} category. Never use auto detailing, car wash,
vehicle, driveway, or unrelated trade language unless this Blueprint is Auto Detailing.
Never invent awards, years-in-business, or fake customer counts — if you need a
specific number and none was given, describe it qualitatively.

${JSON_SHAPE}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const {
      business_id,
      business_name,
      description,
      service_area_cities,
      social_links,
      owner_first_name,
      business_type,
      blueprint,
    } = body || {};

    if (!business_id || !business_name) {
      return jsonRes({ error: "business_id and business_name are required" }, 400);
    }

    if (!Hubly.isConfigured("openai")) {
      return jsonRes({
        error:
          "AI isn't configured yet. Use local Website Runtime, or add an OPENAI_API_KEY secret.",
      }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { memory, dna } = await loadBusinessMemoryDna(supabase, String(business_id));

    const industryLabel = blueprint?.name || business_type || "local service";
    const facts = {
      business_name,
      business_type: business_type || null,
      description: description ||
        `(not provided — infer a plausible, modest description of a ${industryLabel} business)`,
      service_area_cities: service_area_cities || [],
      social_links: social_links || {},
      owner_first_name: owner_first_name || null,
      customer_journey: blueprint?.customerJourney || [],
      recommended_services: (blueprint?.serviceCatalog || [])
        .map((s: { name?: string }) => s.name)
        .filter(Boolean),
    };

    let result;
    try {
      result = await Hubly.generateWebsite({
        feature: "generate-site",
        system: buildSystemPrompt(blueprint && typeof blueprint === "object" ? blueprint : null),
        memory: memory as any,
        dna: dna as any,
        jsonMode: true,
        maxTokens: 2000,
        messages: [{
          role: "user",
          content: `BUSINESS FACTS:\n${JSON.stringify(facts, null, 2)}`,
        }],
      });
    } catch (e) {
      console.error("generate-site HublyAI error:", e);
      if (e instanceof HublyAIConfigError) {
        return jsonRes({
          error:
            `${e.message} Prefer local Website Runtime (Hubly.buildBusiness / runWebsite) when AI is unavailable.`,
        }, 500);
      }
      if (e instanceof HublyAIProviderError) {
        return jsonRes({
          error:
            "AI generation is temporarily unavailable. Prefer local Website Runtime.",
        }, 502);
      }
      return jsonRes({
        error:
          "AI generation is temporarily unavailable. Prefer local Website Runtime.",
      }, 502);
    }

    let generated: Record<string, unknown>;
    try {
      generated = JSON.parse(extractJsonObject(String(result.text || "")));
    } catch (_e) {
      console.error("Failed to parse AI JSON:", result.text);
      return jsonRes({
        error:
          "AI returned an unexpected format. Prefer local Website Runtime, or try again.",
      }, 502);
    }

    if (!generated || typeof generated !== "object") {
      return jsonRes({
        error:
          "AI returned an unexpected format. Prefer local Website Runtime, or try again.",
      }, 502);
    }

    const headlineOptions: string[] = Array.isArray(generated.hero_headline_options)
      ? generated.hero_headline_options.map(String)
      : [];

    const { error: updateError } = await supabase
      .from("businesses")
      .update({
        gen_hero_headline: headlineOptions[0] || null,
        gen_hero_headline_options: headlineOptions,
        gen_hero_subhead: generated.hero_subhead || null,
        gen_about: generated.about || null,
        gen_faq: generated.faq || [],
        gen_seo_title: generated.seo_title || null,
        gen_seo_description: generated.seo_description || null,
        gen_why_choose: generated.why_choose || [],
      })
      .eq("id", business_id);

    if (updateError) {
      console.error("Failed to save generated site copy:", updateError);
      return jsonRes({ error: "Could not save generated copy." }, 500);
    }

    return jsonRes({ ok: true, generated });
  } catch (e) {
    console.error(e);
    return jsonRes({ error: "Unexpected error" }, 500);
  }
});
