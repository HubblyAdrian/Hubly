// supabase/functions/import-offers/index.ts
// Extract packages / add-ons from pasted text, screenshots, or PDFs.
// Trade-aware: detailing vehicle tiers, photography sessions, etc.

import { HublyAI, extractJson } from "../_shared/hubly_ai.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
/** Practical payload ceiling — do not artificially cap menus to a handful of packages. */
const MAX_FILES = 25;
const MAX_TEXT = 40000;

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

function parseAiJson(rawText: string) {
  const cleaned = rawText.replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned);
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
      ? body.catalog_hints.map((x: any) => String(x || "")).filter(Boolean)
      : [];

    if (!text && !files.length) {
      return new Response(JSON.stringify({ error: "Paste a price list or upload a photo/PDF." }), {
        status: 400,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    const content: any[] = [];
    if (text) {
      content.push({
        type: "text",
        text: `Price list / menu text from the owner:\n\n${text}`,
      });
    }
    let hasPdf = false;
    files.forEach((f: any, i: number) => {
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
        hasPdf = true;
        content.push({
          type: "document",
          mediaType: "application/pdf",
          data,
        });
      } else {
        content.push({
          type: "text",
          text: `[Unsupported file type ${media} — ignored]`,
        });
      }
    });

    if (!content.length) {
      return new Response(JSON.stringify({ error: "Nothing readable to import." }), {
        status: 400,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    let rawText = "";
    try {
      const ai = await HublyAI.complete({
        feature: "import-offers",
        task: "quote",
        // PDF document blocks are Claude-native — keep provider honest.
        provider: hasPdf ? "claude" : undefined,
        system: buildSystemPrompt({
          tradeName,
          specialty,
          vehicleDetails,
          catalogHints,
        }),
        messages: [{ role: "user", content }],
        maxTokens: 8000,
        jsonMode: true,
      });
      rawText = String(ai.text || "").trim();
    } catch (err) {
      console.error("import-offers HublyAI error:", err);
      return new Response(JSON.stringify({ error: "Offer import is temporarily unavailable." }), {
        status: 502,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    let parsed: any;
    try {
      parsed = parseAiJson(rawText);
    } catch (e) {
      console.error("Failed to parse AI JSON:", rawText);
      return new Response(JSON.stringify({ error: "AI returned an unexpected format. Try again." }), {
        status: 502,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    const packages = Array.isArray(parsed?.packages) ? parsed.packages : [];
    const addons = Array.isArray(parsed?.addons) ? parsed.addons : [];
    const membershipCandidates = Array.isArray(parsed?.membershipCandidates)
      ? parsed.membershipCandidates
      : [];
    const warnings = Array.isArray(parsed?.warnings) ? parsed.warnings.map(String) : [];

    return new Response(
      JSON.stringify({
        ok: true,
        business_type: businessType,
        packages,
        addons,
        membershipCandidates,
        warnings,
      }),
      { headers: { ...CORS, "content-type": "application/json" } },
    );
  } catch (e) {
    console.error("import-offers error:", e);
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), {
      status: 500,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }
});
