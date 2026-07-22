// supabase/functions/analyze-photos/index.ts
// Vision analysis guided by Business Blueprint knowledge (not hardcoded industries).
// Model calls go through HublyAI only — never direct Anthropic/OpenAI.
// Optional business_id: merge enrichment into Memory extras + soft DNA patches.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  Hubly,
  HublyAIConfigError,
  HublyAIProviderError,
  type HublyContentPart,
} from "../_shared/hubly_ai.ts";
import { extractJsonObject, loadBusinessMemoryDna } from "../_shared/hubly_brain_edge.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_PHOTOS = 8;

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

function buildSystemPrompt(blueprint: Record<string, unknown> | null) {
  const name = (blueprint as { name?: string } | null)?.name || "local service";
  const knowledge = (blueprint as { knowledge?: { galleryRules?: string[] } } | null)?.knowledge;
  const galleryRules = (knowledge?.galleryRules || []).join("; ");
  const expect = ((blueprint as { customerExpectations?: string[] } | null)?.customerExpectations || [])
    .join(", ");
  const mode = (blueprint as { gallery?: { mode?: string } } | null)?.gallery?.mode || "portfolio";

  return `You review photos a ${name} business owner just uploaded for their new
website, during onboarding. You're looking at real job/work photos, not stock
images — expect phone-camera quality, not professional shoots.

When Business Memory or Business DNA are provided, treat Memory as facts and DNA as identity — stay consistent with both.

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

function softDnaPatches(analysis: Record<string, unknown>): Record<string, unknown> | null {
  const quality = String(analysis.business_quality || "").toLowerCase();
  const audience = String(analysis.audience || "").toLowerCase();
  const hints = Array.isArray(analysis.suggested_service_hints)
    ? analysis.suggested_service_hints.map(String).filter(Boolean).slice(0, 5)
    : [];

  const patch: Record<string, unknown> = {};
  if (quality === "luxury" || quality === "value" || quality === "mixed") {
    patch.pricing = { tier: quality === "luxury" ? "premium" : quality === "value" ? "value" : "mixed" };
  }
  if (audience === "residential" || audience === "commercial" || audience === "mixed") {
    const ideal = audience === "residential"
      ? "Local homeowners"
      : audience === "commercial"
      ? "Local commercial clients"
      : "Residential and commercial clients";
    const traits = audience === "mixed"
      ? ["residential", "commercial"]
      : [audience];
    patch.customerProfile = { idealCustomer: ideal, traits };
  }
  if (hints.length) {
    patch.services = { focus: hints };
  }
  return Object.keys(patch).length ? patch : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const { photos, blueprint, business_type, business_id } = body || {};

    if (!Array.isArray(photos) || !photos.length) {
      return jsonRes({ error: "photos array is required" }, 400);
    }
    if (photos.length > MAX_PHOTOS) {
      return jsonRes({ error: `Max ${MAX_PHOTOS} photos per analysis call.` }, 400);
    }

    if (!Hubly.isConfigured("openai")) {
      return jsonRes({
        error: "AI isn't configured yet. Add an OPENAI_API_KEY secret.",
      }, 500);
    }

    const businessId = String(business_id || "").trim();
    let memory: unknown = null;
    let dna: unknown = null;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("SUPABASE_SECRET_KEYS");
    const supabase = (businessId && supabaseUrl && serviceKey)
      ? createClient(supabaseUrl, serviceKey)
      : null;

    if (supabase && businessId) {
      const loaded = await loadBusinessMemoryDna(supabase, businessId);
      memory = loaded.memory;
      dna = loaded.dna;
    }

    const content: HublyContentPart[] = [
      {
        type: "text",
        text: `You are looking at ${photos.length} photos for a ${
          blueprint?.name || business_type || "local service"
        } business, indexed 0 to ${photos.length - 1}.`,
      },
    ];
    photos.forEach((p: { media_type?: string; data?: string }, i: number) => {
      content.push({ type: "text", text: `Photo index ${i}:` });
      content.push({
        type: "image",
        mediaType: p.media_type || "image/jpeg",
        data: String(p.data || ""),
      });
    });

    let result;
    try {
      result = await Hubly.photoAnalysis({
        feature: "analyze-photos",
        system: buildSystemPrompt(blueprint && typeof blueprint === "object" ? blueprint : null),
        memory: memory as any,
        dna: dna as any,
        jsonMode: true,
        maxTokens: 1400,
        messages: [{ role: "user", content }],
      });
    } catch (e) {
      console.error("analyze-photos HublyAI error:", e);
      if (e instanceof HublyAIConfigError) {
        return jsonRes({ error: e.message }, 500);
      }
      if (e instanceof HublyAIProviderError) {
        return jsonRes({ error: "Photo analysis is temporarily unavailable." }, 502);
      }
      return jsonRes({ error: "Photo analysis is temporarily unavailable." }, 502);
    }

    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(extractJsonObject(String(result.text || "")));
    } catch (_e) {
      console.error("Failed to parse AI JSON:", result.text);
      return jsonRes({ error: "AI returned an unexpected format. Try again." }, 502);
    }

    let memoryUpdated = false;
    let dnaUpdated = false;

    if (supabase && businessId) {
      try {
        const { data: memRow } = await supabase
          .from("business_memories")
          .select("memory")
          .eq("business_id", businessId)
          .maybeSingle();
        const prevMem = (memRow?.memory && typeof memRow.memory === "object")
          ? memRow.memory as Record<string, unknown>
          : {};
        const prevExtras = (prevMem.extras && typeof prevMem.extras === "object")
          ? prevMem.extras as Record<string, unknown>
          : {};
        const nextMem = {
          ...prevMem,
          extras: {
            ...prevExtras,
            photoAnalysis: {
              ...analysis,
              updatedAt: new Date().toISOString(),
            },
          },
          updatedAt: new Date().toISOString(),
        };
        const { error: memErr } = await supabase.from("business_memories").upsert(
          { business_id: businessId, memory: nextMem, updated_at: new Date().toISOString() },
          { onConflict: "business_id" },
        );
        if (!memErr) memoryUpdated = true;
        else console.error("analyze-photos memory upsert:", memErr);

        const dnaPatch = softDnaPatches(analysis);
        if (dnaPatch) {
          const { data: dnaRow } = await supabase
            .from("business_dna")
            .select("dna")
            .eq("business_id", businessId)
            .maybeSingle();
          if (dnaRow?.dna && typeof dnaRow.dna === "object") {
            const prevDna = dnaRow.dna as Record<string, unknown>;
            const nextDna = {
              ...prevDna,
              pricing: {
                ...((prevDna.pricing && typeof prevDna.pricing === "object")
                  ? prevDna.pricing as Record<string, unknown>
                  : {}),
                ...((dnaPatch.pricing as Record<string, unknown>) || {}),
              },
              customerProfile: {
                ...((prevDna.customerProfile && typeof prevDna.customerProfile === "object")
                  ? prevDna.customerProfile as Record<string, unknown>
                  : {}),
                ...((dnaPatch.customerProfile as Record<string, unknown>) || {}),
              },
              services: {
                ...((prevDna.services && typeof prevDna.services === "object" &&
                    !Array.isArray(prevDna.services))
                  ? prevDna.services as Record<string, unknown>
                  : {}),
                ...((dnaPatch.services as Record<string, unknown>) || {}),
              },
            };
            const { error: dnaErr } = await supabase
              .from("business_dna")
              .update({ dna: nextDna, updated_at: new Date().toISOString() })
              .eq("business_id", businessId);
            if (!dnaErr) dnaUpdated = true;
            else console.error("analyze-photos dna update:", dnaErr);
          }
        }
      } catch (persistErr) {
        console.error("analyze-photos persist enrichment failed:", persistErr);
      }
    }

    return jsonRes({ ok: true, analysis, memoryUpdated, dnaUpdated });
  } catch (e) {
    console.error("analyze-photos error:", e);
    return jsonRes({ error: "Something went wrong. Please try again." }, 500);
  }
});
