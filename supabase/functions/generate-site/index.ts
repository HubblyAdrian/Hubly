// supabase/functions/generate-site/index.ts
// Generates website copy from Business Blueprint knowledge + business facts.
// Runtime stays industry-ignorant: all voice/psychology comes from `blueprint`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "claude-haiku-4-5-20251001";

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

function buildSystemPrompt(blueprint: any) {
  if (!blueprint || typeof blueprint !== "object") {
    return `You write website copy for a local service business. You are given
basic facts about a real business and must generate premium, conversion-focused
one-page website content.

Voice: confident, warm, plain-spoken — like a business owner talking to a
neighbor, not a marketing agency. Short sentences. No filler. Never invent
awards, years-in-business, or fake customer counts.

${JSON_SHAPE}`;
  }

  const k = blueprint.knowledge || {};
  const name = blueprint.name || "local service";
  const galleryMode = blueprint.galleryMode || blueprint.gallery?.mode || "before_after";
  const sectionCopy = blueprint.sectionCopy || {};
  return `You write website copy for a ${name} business. You are given basic facts
about a real business and must generate the rest of a premium, conversion-focused
one-page website's content.

Brand voice: ${k.brandVoice || "Confident, warm, plain-spoken."}
Customer psychology: ${k.customerPsychology || ""}
Buying behavior: ${k.buyingBehavior || ""}
Decision factors: ${(blueprint.decisionFactors || []).join(", ")}
Customer expectations: ${(blueprint.customerExpectations || []).join(", ")}
Homepage priority (lead with these): ${(blueprint.homepagePriority || []).join(" → ")}
Trust signals: ${(blueprint.trustSignals || []).join(", ")}
Copy rules: ${(k.copyRules || []).join("; ")}
Gallery rules: ${(k.galleryRules || []).join("; ")}
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
      return new Response(JSON.stringify({ error: "business_id and business_name are required" }), {
        status: 400,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI isn't configured yet. Add an ANTHROPIC_API_KEY secret." }),
        { status: 500, headers: { ...CORS, "content-type": "application/json" } },
      );
    }

    const industryLabel = blueprint?.name || business_type || "local service";
    const facts = {
      business_name,
      business_type: business_type || null,
      description: description || `(not provided — infer a plausible, modest description of a ${industryLabel} business)`,
      service_area_cities: service_area_cities || [],
      social_links: social_links || {},
      owner_first_name: owner_first_name || null,
      customer_journey: blueprint?.customerJourney || [],
      recommended_services: (blueprint?.serviceCatalog || []).map((s: any) => s.name).filter(Boolean),
    };

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: buildSystemPrompt(blueprint),
        messages: [{ role: "user", content: `BUSINESS FACTS:\n${JSON.stringify(facts, null, 2)}` }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, errText);
      return new Response(JSON.stringify({ error: "AI generation is temporarily unavailable." }), {
        status: 502,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    const data = await anthropicRes.json();
    const rawText = (data.content || [])
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n")
      .trim();

    let generated;
    try {
      const cleaned = rawText.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
      generated = JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse AI JSON:", rawText);
      return new Response(JSON.stringify({ error: "AI returned an unexpected format. Try again." }), {
        status: 502,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const headlineOptions: string[] = Array.isArray(generated.hero_headline_options)
      ? generated.hero_headline_options
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
      return new Response(JSON.stringify({ error: "Could not save generated copy." }), {
        status: 500,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, generated }), {
      headers: { ...CORS, "content-type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }
});
