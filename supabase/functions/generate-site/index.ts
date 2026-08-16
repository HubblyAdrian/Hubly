// supabase/functions/generate-site/index.ts
// Generates website copy from Business Blueprint knowledge + business facts.
// Runtime stays industry-ignorant: all voice/psychology comes from `blueprint`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { HublyAI, extractJson } from "../_shared/hubly_ai.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

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

/** Mirrors NEUTRAL_BLUEPRINT_ID in public/business-blueprints/registry.js. The
 *  client builds `blueprint`, so this id is part of that cross-file contract. */
const NEUTRAL_BLUEPRINT_ID = "generic";

function buildSystemPrompt(blueprint: any) {
  // "Industry not known" arrives two ways: no blueprint at all, or the neutral
  // blueprint. Both must land here. Routing the neutral one through the branch
  // below would render "You write copy for a Business business" and "Stay inside
  // the Business category" — an industry claim made out of a placeholder name.
  //
  // This is the LEAST grounded case, so it needs the MOST protection. It used to
  // have the least: the "stay inside the category" guardrail existed only in the
  // blueprint branch, leaving the unknown-industry path with nothing to stop it
  // drifting into whatever trade the model felt like, auto detailing included.
  const isNeutral = !blueprint ||
    typeof blueprint !== "object" ||
    blueprint.id === NEUTRAL_BLUEPRINT_ID;
  if (isNeutral) {
    return `You write website copy for a local business. You are given basic facts
about a real business and must generate premium, conversion-focused one-page
website content.

Voice: confident, warm, plain-spoken — like a business owner talking to a
neighbor, not a marketing agency. Short sentences. No filler.

CRITICAL: The industry is NOT KNOWN. Do not guess one, and do not adopt one from
any example anywhere in these instructions — in particular never use auto
detailing, car wash, vehicle, driveway, lawn, or any other specific trade's
language, services or imagery. Write only from the facts given below. Where a
fact is missing, write around it: never invent awards, years-in-business,
customer counts, services, prices, or a description of what this business does.

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
specific number and none was given, describe it qualitatively. A fact given as
null below was not provided: write around it, do not fill it in.

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

    // ── AUTHORIZATION ──────────────────────────────────────────────────────
    // This function writes with the service-role key, which bypasses RLS, so it
    // has to authorize for itself. It previously did not: `business_id` came
    // from the request body and was never checked against the caller.
    //
    // verify_jwt does NOT cover this. It only proves the caller holds *some*
    // JWT signed by this project — and the anon key is exactly that, published
    // in the page source and valid until 2036. So the effective control before
    // this block was "possess a public string", while the write reached any
    // business's live site copy: hero headline, about, FAQ, SEO title and
    // description. Cross-tenant write, unauthenticated in practice.
    //
    // Runs BEFORE the model call on purpose — an unauthorized caller must not
    // be able to spend an OpenAI request either.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) {
      console.error("generate-site misconfigured: missing Supabase env");
      return jsonRes({ error: "Server misconfigured" }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return jsonRes({ error: "Sign in to generate website copy." }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      // The anon key parses as a JWT but resolves to no user, so it lands here.
      return jsonRes({ error: "Your session expired — refresh and try again." }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: ownedBiz, error: bizErr } = await supabase
      .from("businesses")
      .select("id,owner_id")
      .eq("id", business_id)
      .maybeSingle();
    // Same response for "no such business" and "not yours" — do not confirm the
    // existence of another owner's business id.
    if (bizErr || !ownedBiz || ownedBiz.owner_id !== userData.user.id) {
      return jsonRes({ error: "Business not found" }, 404);
    }
    // ── end authorization ──────────────────────────────────────────────────

    const facts = {
      business_name,
      business_type: business_type || null,
      // Was: `(not provided — infer a plausible, modest description of a ${industryLabel} business)`.
      // An instruction to invent, sitting inside a block the model is told is
      // BUSINESS FACTS. A description we were not given is null, and the system
      // prompt tells the model to write around a missing fact rather than fill it.
      description: description || null,
      service_area_cities: service_area_cities || [],
      social_links: social_links || {},
      owner_first_name: owner_first_name || null,
      customer_journey: blueprint?.customerJourney || [],
      recommended_services: (blueprint?.serviceCatalog || []).map((s: any) => s.name).filter(Boolean),
    };

    let rawText = "";
    try {
      const ai = await HublyAI.complete({
        feature: "generate-site",
        task: "website_builder",
        system: buildSystemPrompt(blueprint),
        messages: [{ role: "user", content: `BUSINESS FACTS:\n${JSON.stringify(facts, null, 2)}` }],
        maxTokens: 2000,
        jsonMode: true,
      });
      rawText = String(ai.text || "").trim();
    } catch (err) {
      console.error("generate-site HublyAI error:", err);
      return new Response(JSON.stringify({ error: "AI generation is temporarily unavailable." }), {
        status: 502,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    let generated;
    try {
      generated = JSON.parse(extractJson(rawText));
    } catch (e) {
      console.error("Failed to parse AI JSON:", rawText);
      return new Response(JSON.stringify({ error: "AI returned an unexpected format. Try again." }), {
        status: 502,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    // `supabase` (service role) and the ownership check both happen above, before
    // the model call. Do not re-create the client here: the write below must only
    // ever be reachable through the authorization block.
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
