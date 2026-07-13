// supabase/functions/generate-site/index.ts
// Takes the ~7 inputs a detailer provides (name, description, service area,
// socials, brand color — photos are uploaded directly to storage by the
// client) and asks Claude to generate the rest of the site's copy:
// hero headline/subhead, about section, FAQ, SEO meta, and a "why choose us"
// list. Saves the result directly onto the businesses row.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You write website copy for mobile car detailing businesses. You are given
basic facts about a real business and must generate the rest of a premium,
conversion-focused one-page website's content.

Voice: confident, warm, plain-spoken — like a business owner talking to a
neighbor, not a marketing agency. Short sentences. No filler words like
"unparalleled" or "premier" or "state-of-the-art". Never invent facts not
given to you (no fake awards, fake years-in-business, fake customer counts)
— if you need a specific number and none was given, describe it qualitatively
instead ("a growing base of regulars" not "500+ happy customers").

Respond with ONLY valid JSON, no markdown fences, no preamble, matching
exactly this shape:
{
  "hero_headline_options": [string] (exactly 4 items, each max 8 words, punchy,
    can use a line break as \n -- vary the angle across the 4: e.g. one
    benefit-led, one convenience-led, one trust-led, one urgency-led. Do not
    just reword the same idea four times),
  "hero_subhead": string (1 sentence, max 22 words),
  "about": string (2-3 short paragraphs, first person as the owner, separated by \n\n),
  "faq": [ {"q": string, "a": string} ]  (exactly 6 items, real questions a customer would actually have),
  "seo_title": string (max 60 characters, include business name and city),
  "seo_description": string (max 155 characters),
  "why_choose": [ {"label": string (max 4 words)} ] (exactly 5 items)
}`;

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

    const facts = {
      business_name,
      description: description || "(not provided — infer a plausible, modest description of a mobile detailing business)",
      service_area_cities: service_area_cities || [],
      social_links: social_links || {},
      owner_first_name: owner_first_name || null,
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
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
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

    // gen_hero_headline stays the single "definitive value" every existing
    // caller (the onboarding choke-point's null-check, backfill/re-sync)
    // already reads -- defaults to the first option so those flows are
    // unaffected. The client overwrites it with the user's actual pick via
    // a direct businesses.update() once they choose one (see
    // confirmObHeadlineChoice() in hubly.html).
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
      console.error("DB update error:", updateError);
      return new Response(JSON.stringify({ error: "Generated content but couldn't save it." }), {
        status: 500,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    // hero_headline kept for backward compatibility with existing callers
    // (applyGenerateSitePayload) that read a single string; new callers use
    // hero_headline_options for the picker UI.
    const responseGenerated = { ...generated, hero_headline: headlineOptions[0] || null };

    return new Response(JSON.stringify({ ok: true, generated: responseGenerated }), {
      headers: { ...CORS, "content-type": "application/json" },
    });
  } catch (e) {
    console.error("generate-site error:", e);
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), {
      status: 500,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }
});
