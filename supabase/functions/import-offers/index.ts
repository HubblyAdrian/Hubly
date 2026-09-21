// supabase/functions/import-offers/index.ts
// Extract packages / add-ons from pasted text, screenshots, or PDFs.
// Trade-aware: detailing vehicle tiers, photography sessions, etc.

import { HublyAI, extractJson } from "../_shared/hubly_ai.ts";
import { normalizeMenuExtraction } from "../_shared/menu_extraction.ts";

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


/* ══ MENU MODE — THE SAME DOOR, A DIFFERENT SHAPE OF ANSWER ═══════════════════════════════════
 *
 * A menu arrives exactly as a price list does: a photo or a PDF the owner just handed over. So
 * this is a second CONTRACT on the existing extractor, not a second extractor — same transport,
 * same file handling, same PDF-goes-to-claude rule, same "never invent a price" discipline.
 *
 * What differs is only the shape of what comes back. A service price list is a flat list of
 * packages; a menu has SECTIONS and, sometimes, SIZES. Those two map onto Commerce collections
 * and Commerce variants, which already exist — so the extraction names them and stops there.
 *
 * NOTHING HERE WRITES ANYTHING. This function has never had a database client and still does
 * not; it reads a file and returns a structure for a person to review.
 */
function buildMenuSystemPrompt(businessName: string) {
  return `You read a menu that a business owner has just handed over${businessName ? ` (${businessName})` : ""},
and you report FAITHFULLY what is printed on it. You are not writing a menu; you are transcribing one.

THE ONE RULE THAT MATTERS: never invent anything. Not a price, not a description, not a section,
not an ingredient, and never an allergen or dietary claim of any kind — not even a reassuring one.
If the menu does not say it, it does not exist. A missing thing is reported as missing; it is never
filled in with something plausible.

PRICES
- A clear number becomes "price" (14.00 for "$14", 8.5 for "$8.50").
- Text where a price should be — "Market Price", "MP", "seasonal", "ask your server" — is NOT a
  price. Set price to null, put the words you actually read in "priceText" EXACTLY as printed, set
  needsReview true, and say why in "issue".
- No price shown at all: price null, priceText null, needsReview true, issue "No price printed".

SECTIONS
- A menu heading above a group of items is that group's "section" ("Appetizers", "Pizza").
- Only set a section you can actually see. If an item sits under no clear heading, set section to
  null and sectionConfidence "low" — do NOT sort it into whichever section seems likely.

SIZES
- Only when the menu clearly prints named sizes AND a price for each: "Small $14 Medium $17".
  Report them in "sizes" as {label, price} in the order printed.
- Words like "choose your size", or sizes with no prices, are NOT sizes. Leave sizes null, set
  needsReview true, and say what you saw in "issue".

DESCRIPTIONS
- Copy the printed description. If there is none, use an empty string. Never write one yourself.

UNREADABLE TEXT
- If you cannot read an item confidently, still report it with whatever you can read, confidence
  "low", needsReview true, and an issue saying what was unclear. Do not drop it and do not guess it.

Respond with ONLY valid JSON (no markdown fences):
{
  "sections": [ { "name": string, "confidence": "high" | "medium" | "low" } ],
  "items": [
    {
      "name": string,
      "section": string | null,
      "sectionConfidence": "high" | "medium" | "low",
      "price": number | null,
      "priceText": string | null,
      "desc": string,
      "sizes": [ { "label": string, "price": number | null } ] | null,
      "needsReview": boolean,
      "issue": string | null,
      "confidence": "high" | "medium" | "low"
    }
  ],
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
    // "offers" (the original, unchanged) or "menu". Anything unrecognised stays offers, so an
    // older caller cannot be given a shape it does not expect.
    const mode = String(body?.mode || "offers") === "menu" ? "menu" : "offers";
    const businessName = String(body?.business_name || "");

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
        system: mode === "menu"
          ? buildMenuSystemPrompt(businessName)
          : buildSystemPrompt({
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

    if (mode === "menu") {
      // The normalisation is a pure function in _shared so it can be exercised without an AI
      // call, a network or a database — the same reason commerce_import.ts exists.
      const menu = normalizeMenuExtraction(parsed);
      return new Response(
        JSON.stringify({ ok: true, mode: "menu", ...menu }),
        { headers: { ...CORS, "content-type": "application/json" } },
      );
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
