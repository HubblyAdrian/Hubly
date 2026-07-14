// supabase/functions/creative-director/index.ts
// Talk-first Creative Director — one Claude turn per owner message.
// Returns a short Hubly reply plus structured fields the client applies
// to Blueprints / preview. No DB writes (works before soft account).

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "claude-haiku-4-5-20251001";

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

function extractJson(rawText: string): string {
  const cleaned = String(rawText || "")
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return cleaned;
  return cleaned.slice(start, end + 1);
}

function buildSystemPrompt(ctx: {
  beatId: string;
  beatLabel: string;
  beatGoal: string;
  blueprintIds: string[];
  state: Record<string, unknown>;
}) {
  const ids = (ctx.blueprintIds || []).join(", ") || "detailing, photography, landscaping, windows, hvac, spa, house_cleaning, pressure_washing";
  return `You are Hubly's Creative Director — a calm, sharp designer building a one-page website by talking with the owner. Talk first, form last. Same energy as designing Hubly itself: collaborative, plain English, no agency jargon.

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
   - If they also named the company ("build a site for AquaSpeed Detailing"), set business_name to only the company
   - If there is no company name yet and beat is name: advance=false and ask what the business is called
   - Preview should already feel like that trade; acknowledge it and keep moving
6. Stay inside their trade once known. Never leak detailing / cars / driveway language into photography (or any unmatched trade).
7. On the photos/look beat, invite logo + photo upload ("Upload logo" / "Upload photos" buttons exist). Set ask_upload accordingly.
8. Only set advance=true when the owner actually answered the beat (or gave enough to move on). Mood chip ids: dusk, bright, workshop, photo. Booking modes: appointments, quote, call.
9. Prefer blueprint_id from the allowed list. If unsure, leave it null and ask a clarifying who/what question.
10. Owners can jump ahead in plain language ("use Soft dusk", "portrait and family sessions", "Austin TX appointments") — apply those fields even if they are mid-flow.

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
    "mood": "dusk"|"bright"|"workshop"|"photo"|null,
    "services_line": string|null,
    "booking_mode": "appointments"|"quote"|"call"|null,
    "city": string|null,
    "ask_upload": "logo"|"photos"|"both"|null
  }
}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const {
      beat_id,
      beat_label,
      beat_goal,
      messages,
      state,
      blueprint_ids,
      owner_message,
    } = body || {};

    if (!owner_message || !String(owner_message).trim()) {
      return jsonRes({ error: "owner_message is required" }, 400);
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return jsonRes({ error: "AI isn't configured yet. Add an ANTHROPIC_API_KEY secret." }, 500);
    }

    const history = Array.isArray(messages)
      ? messages
          .slice(-16)
          .map((m: any) => ({
            role: m.side === "owner" || m.role === "user" ? "user" : "assistant",
            content: String(m.text || m.content || "").slice(0, 800),
          }))
          .filter((m: any) => m.content)
      : [];

    // Ensure the latest owner turn is present even if the client already
    // omitted it from history (they may send it only as owner_message).
    const last = history[history.length - 1];
    if (!last || last.role !== "user" || last.content !== String(owner_message).trim()) {
      history.push({ role: "user", content: String(owner_message).trim().slice(0, 800) });
    }

    const system = buildSystemPrompt({
      beatId: String(beat_id || "name"),
      beatLabel: String(beat_label || "Hello"),
      beatGoal: String(beat_goal || "Learn about the business and move the site draft forward."),
      blueprintIds: Array.isArray(blueprint_ids) ? blueprint_ids.map(String) : [],
      state: state && typeof state === "object" ? state : {},
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
        max_tokens: 700,
        system,
        messages: history.length ? history : [{ role: "user", content: String(owner_message).trim() }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("creative-director Anthropic error:", anthropicRes.status, errText);
      return jsonRes({ error: "Creative Director is temporarily unavailable." }, 502);
    }

    const data = await anthropicRes.json();
    const rawText = (data.content || [])
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n")
      .trim();

    let parsed: any;
    try {
      parsed = JSON.parse(extractJson(rawText));
    } catch (e) {
      console.error("creative-director JSON parse failed:", rawText);
      return jsonRes({ error: "AI returned an unexpected format. Try again." }, 502);
    }

    const apply = parsed.apply && typeof parsed.apply === "object" ? parsed.apply : {};
    return jsonRes({
      reply: String(parsed.reply || "").trim() || "Got it — tell me a little more in your own words.",
      advance: !!parsed.advance,
      apply: {
        business_name: apply.business_name || null,
        blueprint_id: apply.blueprint_id || null,
        who_text: apply.who_text || null,
        headline: apply.headline || null,
        story: apply.story || null,
        mood: apply.mood || null,
        services_line: apply.services_line || null,
        booking_mode: apply.booking_mode || null,
        city: apply.city || null,
        ask_upload: apply.ask_upload || null,
      },
      model: MODEL,
    });
  } catch (e) {
    console.error("creative-director failed:", e);
    return jsonRes({ error: "Creative Director failed." }, 500);
  }
});
