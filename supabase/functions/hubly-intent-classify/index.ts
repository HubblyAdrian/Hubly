// supabase/functions/hubly-intent-classify/index.ts
//
// Intent Classifier — the one thing standing between a single landing-page
// input and two completely different conversations (business road:
// hubly-conversation, already built; marketplace road: hubly-marketplace-
// conversation, not built yet). Per hubly-intent-routed-conversation-spec:
// this is its own edge function, called once by the client before the
// first message goes into either road — not a branch inside
// hubly-conversation, which stays untouched.
//
// Single-purpose, cheap/fast model, structured output only. Does not talk
// to the person — the client (or the road it routes into) owns all
// user-facing language. First-turn only: once a client has a route for a
// conversation, it never calls this again for that thread.
//
// Rules this file exists to satisfy:
// - Real classification, not a keyword table (see spec 1.1 — plenty of real
//   openers give no lexical signal for which road they belong on).
// - Never guess past what the message actually supports. Low confidence or
//   genuine ambiguity routes to "ask", not to a coin-flip road.
// - intentHint (landing-page card click) is a weak prior only — it can
//   lower the confidence bar when it agrees with the classifier, and must
//   never override a classifier result that disagrees with it.

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

type Intent = "business" | "marketplace" | "ambiguous";
type Route = "business" | "marketplace" | "ask";

const CONFIDENCE_THRESHOLD = 0.75;
const HINT_AGREEMENT_THRESHOLD = 0.65;

// Fixed, not model-generated — the classifier is single-purpose/structured-
// output-only per spec 1.1; this is the one line it needs when it can't
// decide, in Hubly's normal voice, never a form.
const CLARIFYING_QUESTION =
  "Are you looking to grow your own business, or looking to hire someone for a job?";

const SYSTEM_PROMPT = `You are classifying the opening message of a conversation on Hubly, a platform that is BOTH (a) an all-in-one business operating system for home service businesses (websites, booking, CRM, marketing) and (b) a marketplace where homeowners find and book home service pros (detailing, cleaning, landscaping, pressure washing, etc).

Classify the message as one of:
- "business" — they run or want to run a home service business and need Hubly's tools.
- "marketplace" — they are a homeowner/customer who needs a service done.
- "ambiguous" — genuinely could be either, or the message gives no real signal.

Do not guess past what the message actually supports. "ambiguous" with low confidence is correct and expected for vague openers ("I need help", "hi") — it is not a failure to return this.

Return ONLY this JSON, nothing else: {"intent":"business"|"marketplace"|"ambiguous","confidence":<0-1>,"reasoning":"<one sentence, internal only, never shown to the user>"}`;

function isIntent(v: unknown): v is Intent {
  return v === "business" || v === "marketplace" || v === "ambiguous";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonRes({ ok: false, error: "POST required" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return jsonRes({ ok: false, error: "message_required" }, 400);

  const intentHint: Intent | null = isIntent(body?.intentHint) && body.intentHint !== "ambiguous" ? body.intentHint : null;

  if (!HublyAI.isConfigured("openai")) {
    // Fail honest, not silent — never default to a guessed road.
    return jsonRes({ ok: false, error: "Intent classification is not configured yet." }, 503);
  }

  try {
    const ai = await HublyAI.chat({
      feature: "hubly-intent-classify",
      task: "lightweight",
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: message }],
      jsonMode: true,
      // gpt-5-mini (the "lightweight" task route) is a reasoning-tier model —
      // it spends part of this budget on internal reasoning tokens before any
      // visible output, so a small budget here doesn't mean truncated JSON,
      // it means an empty completion. 600 was the minimum that reliably left
      // room for the few visible tokens this schema actually needs.
      maxTokens: 600,
    });

    let parsed: any;
    try {
      parsed = JSON.parse(extractJson(String(ai.text || "")));
    } catch {
      parsed = null;
    }

    const intent: Intent = isIntent(parsed?.intent) ? parsed.intent : "ambiguous";
    const confidenceRaw = Number(parsed?.confidence);
    const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0;

    let route: Route;
    if (intent !== "ambiguous" && confidence >= CONFIDENCE_THRESHOLD) {
      route = intent;
    } else if (
      intent !== "ambiguous" &&
      intentHint === intent &&
      confidence >= HINT_AGREEMENT_THRESHOLD
    ) {
      route = intent;
    } else {
      route = "ask";
    }

    return jsonRes({
      ok: true,
      intent,
      confidence,
      route,
      ...(route === "ask" ? { clarifyingQuestion: CLARIFYING_QUESTION } : {}),
    });
  } catch (err) {
    console.error("hubly-intent-classify error:", err);
    // Fail toward asking, never toward a guessed road.
    return jsonRes({
      ok: true,
      intent: "ambiguous",
      confidence: 0,
      route: "ask",
      clarifyingQuestion: CLARIFYING_QUESTION,
      degraded: true,
    });
  }
});
