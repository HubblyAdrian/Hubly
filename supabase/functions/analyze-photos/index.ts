// supabase/functions/analyze-photos/index.ts
// Vision analysis guided by Business Blueprint knowledge (not hardcoded industries).
// Milestone 1: all model calls go through HublyAI (never raw providers).

import { HublyAI, extractJson } from "../_shared/hubly_ai.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_PHOTOS = 8;

function buildSystemPrompt(blueprint: any) {
  const name = blueprint?.name || "local service";
  const galleryRules = (blueprint?.knowledge?.galleryRules || []).join("; ");
  const expect = (blueprint?.customerExpectations || []).join(", ");
  const mode = blueprint?.gallery?.mode || "portfolio";

  return `You review photos a ${name} business owner just uploaded for their new
website, during onboarding. You're looking at real job/work photos, not stock
images — expect phone-camera quality, not professional shoots.

Gallery mode for this business: ${mode}.
Gallery rules: ${galleryRules || "Prefer clear subject, good light, honest representation."}
Customer expectations: ${expect || "Trustworthy, high-quality presentation."}

For each photo, give a short, plain assessment. Be genuinely useful, not
flattering — if a photo is dark, blurry, or a bad crop, say so briefly.
Most uploaded phone photos are fine for a gallery even if not perfect for
a hero banner — don't be harsh, just honest.

Then:
1. Recommend ONE photo (by index) as the best hero/banner candidate —
   the one that would look best large, full-width, first thing a visitor
   sees. Prioritize: clear subject, decent lighting, not too cluttered.
2. Try to spot before/after pairs when the gallery mode is before_after —
   only report a pair if reasonably confident. Otherwise return [].

Also infer (best effort, for Creative Director recommendations):
- business_quality: "luxury" | "value" | "mixed" | "unclear"
- audience: "residential" | "commercial" | "mixed" | "unclear"
- suggested_service_hints: string[] (max 5 short labels visible in photos)

Respond with ONLY valid JSON, no markdown fences, no preamble, matching
exactly this shape:
{
  "photos": [
    { "index": 0, "quality_note": string (max 12 words, plain and specific),
      "suitable_for_hero": boolean, "suitable_for_gallery": boolean }
  ],
  "hero_recommendation_index": number | null,
  "detected_pairs": [ { "before_index": number, "after_index": number, "confidence": "high" | "medium" } ],
  "business_quality": "luxury" | "value" | "mixed" | "unclear",
  "audience": "residential" | "commercial" | "mixed" | "unclear",
  "suggested_service_hints": [string]
}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const { photos, blueprint, business_type } = body || {};

    if (!Array.isArray(photos) || !photos.length) {
      return new Response(JSON.stringify({ error: "photos array is required" }), {
        status: 400,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }
    if (photos.length > MAX_PHOTOS) {
      return new Response(
        JSON.stringify({ error: `Max ${MAX_PHOTOS} photos per analysis call.` }),
        { status: 400, headers: { ...CORS, "content-type": "application/json" } },
      );
    }

    const content: any[] = [
      {
        type: "text",
        text: `You are looking at ${photos.length} photos for a ${blueprint?.name || business_type || "local service"} business, indexed 0 to ${photos.length - 1}.`,
      },
    ];
    photos.forEach((ph: any, i: number) => {
      content.push({ type: "text", text: `Photo index ${i}:` });
      content.push({
        type: "image",
        mediaType: ph.media_type || "image/jpeg",
        data: ph.data,
      });
    });

    let rawText = "";
    try {
      const ai = await HublyAI.photoAnalysis({
        feature: "analyze-photos",
        system: buildSystemPrompt(blueprint),
        messages: [{ role: "user", content }],
        maxTokens: 1400,
        jsonMode: true,
      });
      rawText = String(ai.text || "").trim();
    } catch (err) {
      console.error("analyze-photos HublyAI error:", err);
      return new Response(JSON.stringify({ error: "Photo analysis is temporarily unavailable." }), {
        status: 502,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    let analysis;
    try {
      analysis = JSON.parse(extractJson(rawText));
    } catch (e) {
      console.error("Failed to parse AI JSON:", rawText);
      return new Response(JSON.stringify({ error: "AI returned an unexpected format. Try again." }), {
        status: 502,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, analysis }), {
      headers: { ...CORS, "content-type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-photos error:", e);
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), {
      status: 500,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }
});
