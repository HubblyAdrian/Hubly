// supabase/functions/analyze-photos/index.ts
// Vision analysis guided by Business Blueprint knowledge (not hardcoded industries).

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "claude-haiku-4-5-20251001";
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

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI isn't configured yet. Add an ANTHROPIC_API_KEY secret." }),
        { status: 500, headers: { ...CORS, "content-type": "application/json" } },
      );
    }

    const content: any[] = [
      {
        type: "text",
        text: `You are looking at ${photos.length} photos for a ${blueprint?.name || business_type || "local service"} business, indexed 0 to ${photos.length - 1}.`,
      },
    ];
    photos.forEach((p: any, i: number) => {
      content.push({ type: "text", text: `Photo index ${i}:` });
      content.push({
        type: "image",
        source: { type: "base64", media_type: p.media_type || "image/jpeg", data: p.data },
      });
    });

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1400,
        system: buildSystemPrompt(blueprint),
        messages: [{ role: "user", content }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, errText);
      return new Response(JSON.stringify({ error: "Photo analysis is temporarily unavailable." }), {
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

    let analysis;
    try {
      const cleaned = rawText.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
      analysis = JSON.parse(cleaned);
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
