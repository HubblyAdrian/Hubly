// supabase/functions/import-offers/index.ts
// Extract packages / add-ons from pasted text, screenshots, or PDFs.
// Trade-aware: detailing vehicle tiers, photography sessions, etc.
// Model calls go through HublyAI only — never direct Anthropic/OpenAI.
// Optional business_id: merge package names/prices into Memory services.

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

/** Practical payload ceiling — do not artificially cap menus to a handful of packages. */
const MAX_FILES = 25;
const MAX_TEXT = 40000;

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

function tradeExtrasHint(trade: string, vehicleDetails: boolean) {
  const t = String(trade || "").toLowerCase();
  if (vehicleDetails || t.includes("detail")) {
    return `This is auto detailing. If the menu shows different prices by vehicle size
(sedan, coupe, crossover, SUV, truck, van), put those in varPrices and set
pricingType to "vehicle". Prefer a base price from sedan (or the lowest clear tier).
Dirty-level surcharges can become add-ons.`;
  }
  if (t.includes("window")) {
    return `Window cleaning. Capture residential vs commercial in the name or description.
Stories / pane counts can go in includes or desc — do not invent prices.`;
  }
  if (t.includes("lawn") || t.includes("landscap")) {
    return `Lawn / landscape. Note one-time vs recurring in desc when clear.
Memberships: only list membershipCandidates when the source clearly says monthly/membership.`;
  }
  if (t.includes("photo")) {
    return `Photography. Duration is shoot length in hours. Deliverables (edited photos, galleries)
go in includes. Session types become package names.`;
  }
  if (t.includes("clean") || t.includes("hvac") || t.includes("pressure") || t.includes("spa")) {
    return `Capture size/room tiers in desc or separate packages when clearly priced.
Extras become add-ons.`;
  }
  return `Extract every distinct sellable package for this local trade. Do not stop early or invent a short list when the source has more.`;
}

function buildSystemPrompt(opts: {
  tradeName: string;
  specialty?: string;
  vehicleDetails: boolean;
  catalogHints: string[];
}) {
  const extras = tradeExtrasHint(opts.tradeName, opts.vehicleDetails);
  const hints = (opts.catalogHints || []).slice(0, 12).join("; ");
  return `You extract sellable packages from a local service business's existing price list
or menu (${opts.tradeName}${opts.specialty ? `, specialty: ${opts.specialty}` : ""}).

When Business Memory or Business DNA are provided, treat Memory as facts and DNA as identity — do not invent packages that contradict known Memory services unless the attached menu clearly lists them.

${extras}

Starter package names this trade often uses (for mapping only, do not invent if absent): ${hints || "n/a"}.

Rules:
- Never invent prices. If price is missing or unclear, set price to null and needsReview true.
- Duration (dur) is hours as a number (90 min → 1.5). If unknown, null + needsReview.
- Extract EVERY distinct sellable package on the list — there is no package count limit.
  If the source has 12, 20, or more packages, return all of them. Merge only exact duplicates.
- Small extras (pet hair, add ceramic top-up) → addons, not packages.
- Keep names short and customer-facing.
- confidence: high | medium | low

Respond with ONLY valid JSON (no markdown fences):
{
  "packages": [
    {
      "name": string,
      "price": number | null,
      "dur": number | null,
      "desc": string,
      "includes": string[],
      "popular": boolean,
      "needsReview": boolean,
      "pricingType": "flat" | "vehicle",
      "varPrices": { "sedan"?: number|null, "coupe"?: number|null, "crossover"?: number|null, "suv"?: number|null, "truck"?: number|null, "van"?: number|null } | null,
      "confidence": "high" | "medium" | "low"
    }
  ],
  "addons": [ { "name": string, "price": number | null, "needsReview": boolean } ],
  "membershipCandidates": [ { "name": string, "price": number | null, "cadence": "monthly" | "weekly" | null } ],
  "warnings": string[]
}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const text = String(body?.text || "").trim().slice(0, MAX_TEXT);
    const files = Array.isArray(body?.files) ? body.files.slice(0, MAX_FILES) : [];
    const tradeName = String(body?.trade_name || body?.business_type || "local service");
    const businessType = String(body?.business_type || "");
    const specialty = body?.specialty ? String(body.specialty) : "";
    const vehicleDetails = !!body?.vehicle_details;
    const catalogHints = Array.isArray(body?.catalog_hints)
      ? body.catalog_hints.map((x: unknown) => String(x || "")).filter(Boolean)
      : [];
    const businessId = String(body?.business_id || "").trim();

    if (!text && !files.length) {
      return jsonRes({ error: "Paste a price list or upload a photo/PDF." }, 400);
    }

    if (!Hubly.isConfigured("openai")) {
      return jsonRes({
        error: "AI isn't configured yet. Add an OPENAI_API_KEY secret.",
      }, 500);
    }

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

    const content: HublyContentPart[] = [];
    const warningsExtra: string[] = [];
    if (text) {
      content.push({
        type: "text",
        text: `Price list / menu text from the owner:\n\n${text}`,
      });
    }
    files.forEach((f: { media_type?: string; data?: string }, i: number) => {
      const media = String(f?.media_type || "image/jpeg");
      const data = String(f?.data || "");
      if (!data) return;
      content.push({ type: "text", text: `Uploaded file ${i + 1} (${media}):` });
      if (media.startsWith("image/")) {
        content.push({
          type: "image",
          mediaType: media,
          data,
        });
      } else if (media === "application/pdf") {
        // HublyAI multimodal path supports images; skip PDF binary and note for text extraction.
        content.push({
          type: "text",
          text: "[PDF attached — extract packages from any accompanying text]",
        });
        warningsExtra.push(
          `PDF file ${i + 1} could not be read as a document — paste text or upload a screenshot.`,
        );
      } else {
        content.push({
          type: "text",
          text: `[Unsupported file type ${media} — ignored]`,
        });
      }
    });

    if (!content.length) {
      return jsonRes({ error: "Nothing readable to import." }, 400);
    }

    const hasImages = content.some((p) => p.type === "image");
    let result;
    try {
      result = await Hubly.complete({
        feature: "import-offers",
        task: hasImages ? "photo_analysis" : "reason",
        system: buildSystemPrompt({
          tradeName,
          specialty,
          vehicleDetails,
          catalogHints,
        }),
        memory: memory as any,
        dna: dna as any,
        jsonMode: true,
        maxTokens: 8000,
        messages: [{ role: "user", content }],
      });
    } catch (e) {
      console.error("import-offers HublyAI error:", e);
      if (e instanceof HublyAIConfigError) {
        return jsonRes({ error: e.message }, 500);
      }
      if (e instanceof HublyAIProviderError) {
        return jsonRes({ error: "Offer import is temporarily unavailable." }, 502);
      }
      return jsonRes({ error: "Offer import is temporarily unavailable." }, 502);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(extractJsonObject(String(result.text || "")));
    } catch (_e) {
      console.error("Failed to parse AI JSON:", result.text);
      return jsonRes({ error: "AI returned an unexpected format. Try again." }, 502);
    }

    const packages = Array.isArray(parsed?.packages) ? parsed.packages : [];
    const addons = Array.isArray(parsed?.addons) ? parsed.addons : [];
    const membershipCandidates = Array.isArray(parsed?.membershipCandidates)
      ? parsed.membershipCandidates
      : [];
    const warnings = [
      ...(Array.isArray(parsed?.warnings) ? parsed.warnings.map(String) : []),
      ...warningsExtra,
    ];

    let memoryUpdated = false;
    if (supabase && businessId && packages.length) {
      try {
        const { data: memRow } = await supabase
          .from("business_memories")
          .select("memory")
          .eq("business_id", businessId)
          .maybeSingle();
        const prevMem = (memRow?.memory && typeof memRow.memory === "object")
          ? memRow.memory as Record<string, unknown>
          : {};
        const existingServices = Array.isArray(prevMem.services) ? prevMem.services : [];
        const existingNames = new Set(
          existingServices
            .map((s: { name?: string }) => String(s?.name || "").trim().toLowerCase())
            .filter(Boolean),
        );
        const appended = packages
          .map((p: { name?: string; price?: number | null; dur?: number | null; desc?: string }) => ({
            name: String(p?.name || "").trim(),
            price: p?.price ?? null,
            dur: p?.dur ?? null,
            desc: p?.desc != null ? String(p.desc) : null,
          }))
          .filter((s: { name: string }) => s.name && !existingNames.has(s.name.toLowerCase()));
        if (appended.length) {
          const nextMem = {
            ...prevMem,
            services: [...existingServices, ...appended],
            updatedAt: new Date().toISOString(),
          };
          const { error: memErr } = await supabase.from("business_memories").upsert(
            { business_id: businessId, memory: nextMem, updated_at: new Date().toISOString() },
            { onConflict: "business_id" },
          );
          if (!memErr) memoryUpdated = true;
          else console.error("import-offers memory upsert:", memErr);
        }
      } catch (persistErr) {
        console.error("import-offers memory merge failed:", persistErr);
      }
    }

    return jsonRes({
      ok: true,
      business_type: businessType,
      packages,
      addons,
      membershipCandidates,
      warnings,
      memoryUpdated,
    });
  } catch (e) {
    console.error("import-offers error:", e);
    return jsonRes({ error: "Something went wrong. Please try again." }, 500);
  }
});
