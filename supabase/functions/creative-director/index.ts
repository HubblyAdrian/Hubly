// supabase/functions/creative-director/index.ts
// Talk-first Creative Director — one Hubly turn per owner message.
// Returns a short Hubly reply plus structured fields the client applies
// to Blueprints / preview. No DB writes (works before soft account).
// Editor beat also accepts an inspiration screenshot (vision).
// Model calls go through HublyAI only — never direct Anthropic/OpenAI.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  Hubly,
  HublyAIConfigError,
  HublyAIProviderError,
  type HublyContentPart,
  type HublyMessage,
} from "../_shared/hubly_ai.ts";
import { extractJsonObject, loadBusinessMemoryDna } from "../_shared/hubly_brain_edge.ts";

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

function parseDataUrl(raw: string | null | undefined): { mediaType: string; data: string } | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  const m = s.match(/^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!m) return null;
  const mediaType = m[1].toLowerCase() === "image/jpg" ? "image/jpeg" : m[1].toLowerCase();
  const data = m[2].replace(/\s+/g, "");
  // Cap ~1.6MB base64 ≈ reasonable edge payload
  if (data.length < 80 || data.length > 2_200_000) return null;
  return { mediaType, data };
}

function buildEditorSystemPrompt(ctx: {
  beatGoal: string;
  blueprintIds: string[];
  state: Record<string, unknown>;
  hasInspiration: boolean;
}) {
  const ids =
    (ctx.blueprintIds || []).join(", ") ||
    "detailing, photography, landscaping, windows, hvac, spa, house_cleaning, pressure_washing";
  const inspireBlock = ctx.hasInspiration
    ? `
INSPIRATION SCREENSHOT
The owner attached a screenshot of a site/app they like. Study layout, density, darkness, CTA placement, and services presentation — then restyle THEIR Hubly draft toward that vibe.
Do NOT copy logos, brand names, phone numbers, addresses, or photos from the screenshot.
Pick the closest Hubly layout_id and composition. Prefer a booking-led services composition for Square/GlossGenius-style booking UIs.
Set accent_color to a hex that matches their CTA/accent energy (orange, blue, etc.).
`
    : "";
  return `You are Hubly AI inside the website editor. The owner already has a draft site open. Help them change it in plain English — same energy as designing Hubly itself: direct, visual, no jargon.

When Business Memory or Business DNA are provided, treat Memory as facts and DNA as identity/voice — DNA is critical for the signature Creative Director experience. Never invent beyond Memory facts.

GOAL
${ctx.beatGoal || "Apply visual and copy changes to their live draft."}

CURRENT SITE STATE:
${JSON.stringify(ctx.state || {}, null, 2)}

BLUEPRINT IDS (only if they ask to switch trade):
${ids}
${inspireBlock}
RULES
1. Reply under 280 characters. Warm and specific about what you changed or will change. Never say "as an AI". Never say "hero" — say "first screen" or "big photo".
2. Fill editor_* fields for anything they asked. Leave unused fields null.
3. hero_media_placement: "left" | "right" | "full" — for requests like photo on the right, left, whole first screen, full-bleed, background.
4. composition: "portfolio" | "services" | "classic" — portfolio-first / packages-first / balanced.
5. layout_id: only if they want a clearly different skin/look AND you know a layout id from state or common Hubly layouts (premium-dark, editorial, clean-modern, neon-nights, clear-view, bold-impact, estate-green, garage-industrial, chrome-velocity, aurora-gradient). Prefer null and set cycle_layout=true to let the client rotate.
6. cycle_hero_photo / open_photo_picker / regenerate_copy / start_fresh_site / cycle_layout: booleans.
7. headline / hero_sub: write tight conversion copy for their trade when they ask to rewrite.
8. accent_color: "#RRGGBB" when they want a different accent, or when an inspiration screenshot shows a clear CTA color.
9. advance is always false in the editor.

Your ENTIRE response must be this JSON object and NOTHING else:
{
  "reply": string,
  "advance": false,
  "apply": {
    "business_name": null,
    "blueprint_id": string|null,
    "who_text": null,
    "headline": string|null,
    "story": string|null,
    "mood": null,
    "services_line": null,
    "booking_mode": null,
    "city": null,
    "ask_upload": "logo"|"photos"|"both"|null,
    "hero_media_placement": "left"|"right"|"full"|null,
    "composition": "portfolio"|"services"|"classic"|null,
    "layout_id": string|null,
    "cycle_layout": boolean,
    "cycle_hero_photo": boolean,
    "open_photo_picker": boolean,
    "regenerate_copy": boolean,
    "start_fresh_site": boolean,
    "hero_sub": string|null,
    "accent_color": string|null
  }
}`;
}

function buildSystemPrompt(ctx: {
  beatId: string;
  beatLabel: string;
  beatGoal: string;
  blueprintIds: string[];
  state: Record<string, unknown>;
  hasInspiration: boolean;
}) {
  if (String(ctx.beatId || "") === "editor") {
    return buildEditorSystemPrompt(ctx);
  }
  const ids = (ctx.blueprintIds || []).join(", ") || "detailing, photography, landscaping, windows, hvac, spa, house_cleaning, pressure_washing";
  return `You are Hubly's Creative Director — a calm, sharp designer building a one-page website by talking with the owner. Talk first, form last. Same energy as designing Hubly itself: collaborative, plain English, no agency jargon.

When Business Memory or Business DNA are provided, treat Memory as facts and DNA as identity/voice — DNA is critical for the signature Creative Director experience. Never invent beyond Memory facts.

CURRENT BEAT
- id: ${ctx.beatId}
- label: ${ctx.beatLabel}
- goal: ${ctx.beatGoal}

KNOWN STATE (may be empty):
${JSON.stringify(ctx.state || {}, null, 2)}

AVAILABLE BLUEPRINT IDS (pick only from this list when confident):
${ids}

RULES
1. Your reply is short chat (under 320 characters). Warm, direct. Never say "as an AI".
2. Never use the word "hero" — say "first screen" or "big line".
3. If the owner asks a question, ANSWER it first, set advance=false, and gently re-ask the current beat.
4. If the business name clearly names a trade (e.g. "Thomas Photography"), set blueprint_id immediately and do NOT re-ask what industry they are — ask who they serve instead when on the who beat.
5. FREE-FORM BUILD REQUESTS — if they say anything like "build me a detailing website", "make me a photography site", "I need a lawn care page", "create an HVAC website":
   - Set blueprint_id from the trade (must be from the allowed list)
   - Do NOT put that whole sentence in business_name
   - Leave business_name null unless they clearly named a shop
6. Only set business_name when they clearly give a shop/company name.
7. For city: only if explicitly mentioned.

Your ENTIRE response must be this JSON object and NOTHING else:
{
  "reply": string,
  "advance": boolean,
  "apply": {
    "business_name": string|null,
    "blueprint_id": string|null,
    "who_text": string|null,
    "headline": string|null,
    "story": string|null,
    "mood": string|null,
    "services_line": string|null,
    "booking_mode": "appointments"|"quote"|"call"|null,
    "city": string|null,
    "ask_upload": "logo"|"photos"|"both"|null,
    "hero_media_placement": null,
    "composition": null,
    "layout_id": null,
    "cycle_layout": false,
    "cycle_hero_photo": false,
    "open_photo_picker": false,
    "regenerate_copy": false,
    "start_fresh_site": false,
    "hero_sub": null,
    "accent_color": null
  }
}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const {
      beat_id,
      beat_label,
      beat_goal,
      messages,
      state,
      blueprint_ids,
      owner_message,
      inspiration_image,
      business_id,
    } = body || {};

    const inspiration = parseDataUrl(inspiration_image);
    const msg = String(owner_message || "").trim();
    if (!msg && !inspiration) {
      return jsonRes({ error: "owner_message or inspiration_image is required" }, 400);
    }

    if (!Hubly.isConfigured("openai") && !Hubly.isConfigured("claude")) {
      return jsonRes({
        error: "AI isn't configured yet. Add an OPENAI_API_KEY or ANTHROPIC_API_KEY secret.",
      }, 500);
    }

    let memory: unknown = null;
    let dna: unknown = null;
    const businessId = String(business_id || "").trim();
    if (businessId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
        Deno.env.get("SUPABASE_SECRET_KEYS");
      if (supabaseUrl && serviceKey) {
        const supabase = createClient(supabaseUrl, serviceKey);
        const loaded = await loadBusinessMemoryDna(supabase, businessId);
        memory = loaded.memory;
        dna = loaded.dna;
      }
    }

    const history: HublyMessage[] = Array.isArray(messages)
      ? messages
          .slice(-16)
          .map((m: { side?: string; role?: string; text?: string; content?: string }) => ({
            role: (m.side === "owner" || m.role === "user" ? "user" : "assistant") as
              | "user"
              | "assistant",
            content: String(m.text || m.content || "").slice(0, 800),
          }))
          .filter((m: HublyMessage) => typeof m.content === "string" && m.content)
      : [];

    const ownerText =
      msg ||
      (inspiration
        ? "I uploaded a screenshot of a website I like. Restyle my Hubly site toward this vibe — dark/light, service list vs portfolio, where the Book button sits — without copying their brand or photos."
        : "");

    const last = history[history.length - 1];
    if (!last || last.role !== "user" || last.content !== ownerText) {
      if (inspiration) {
        const parts: HublyContentPart[] = [
          { type: "image", mediaType: inspiration.mediaType, data: inspiration.data },
          { type: "text", text: ownerText.slice(0, 1200) },
        ];
        history.push({ role: "user", content: parts });
      } else {
        history.push({ role: "user", content: ownerText.slice(0, 800) });
      }
    } else if (inspiration && last.role === "user" && typeof last.content === "string") {
      const parts: HublyContentPart[] = [
        { type: "image", mediaType: inspiration.mediaType, data: inspiration.data },
        { type: "text", text: ownerText.slice(0, 1200) },
      ];
      history[history.length - 1] = { role: "user", content: parts };
    }

    const system = buildSystemPrompt({
      beatId: String(beat_id || "name"),
      beatLabel: String(beat_label || "Hello"),
      beatGoal: String(
        beat_goal ||
          (inspiration
            ? "Restyle the owner’s Hubly draft to match the vibe of the inspiration screenshot."
            : "Learn about the business and move the site draft forward."),
      ),
      blueprintIds: Array.isArray(blueprint_ids) ? blueprint_ids.map(String) : [],
      state: state && typeof state === "object" ? state : {},
      hasInspiration: !!inspiration,
    });

    let result;
    try {
      result = await Hubly.creativeDirector({
        feature: "creative-director",
        system,
        memory: memory as any,
        dna: dna as any,
        jsonMode: true,
        maxTokens: inspiration ? 900 : 700,
        messages: history.length ? history : [{ role: "user", content: ownerText }],
      });
    } catch (e) {
      console.error("creative-director HublyAI error:", e);
      if (e instanceof HublyAIConfigError) {
        return jsonRes({ error: e.message }, 500);
      }
      if (e instanceof HublyAIProviderError) {
        return jsonRes({ error: "Creative Director is temporarily unavailable." }, 502);
      }
      return jsonRes({ error: "Creative Director is temporarily unavailable." }, 502);
    }

    const rawText = String(result.text || "").trim();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(extractJsonObject(rawText));
    } catch (_e) {
      console.error("creative-director JSON parse failed:", rawText);
      return jsonRes({ error: "AI returned an unexpected format. Try again." }, 502);
    }

    const apply = parsed.apply && typeof parsed.apply === "object"
      ? parsed.apply as Record<string, unknown>
      : {};
    const place = apply.hero_media_placement;
    const composition = apply.composition;
    let accent = apply.accent_color || apply.accentColor || null;
    if (typeof accent === "string") {
      const hex = accent.trim();
      accent = /^#([0-9a-fA-F]{6})$/.test(hex) ? hex : null;
    } else accent = null;

    return jsonRes({
      reply: String(parsed.reply || "").trim() || "Got it — tell me a little more in your own words.",
      advance: beat_id === "editor" ? false : !!parsed.advance,
      apply: {
        business_name: apply.business_name || null,
        blueprint_id: apply.blueprint_id || null,
        who_text: apply.who_text || null,
        headline: apply.headline || null,
        story: apply.story || apply.hero_sub || null,
        mood: apply.mood || null,
        services_line: apply.services_line || null,
        booking_mode: apply.booking_mode || null,
        city: apply.city || null,
        ask_upload: apply.ask_upload || null,
        hero_media_placement:
          place === "left" || place === "right" || place === "full" ? place : null,
        composition:
          composition === "portfolio" || composition === "services" || composition === "classic"
            ? composition
            : null,
        layout_id: apply.layout_id || null,
        cycle_layout: !!apply.cycle_layout,
        cycle_hero_photo: !!apply.cycle_hero_photo,
        open_photo_picker: !!apply.open_photo_picker,
        regenerate_copy: !!apply.regenerate_copy,
        start_fresh_site: !!apply.start_fresh_site,
        hero_sub: apply.hero_sub || null,
        accent_color: accent,
      },
      model: result.model,
    });
  } catch (e) {
    console.error("creative-director failed:", e);
    return jsonRes({ error: "Creative Director failed." }, 500);
  }
});
