// supabase/functions/draft-customer-message/index.ts
// One shared drafting function for all 3 short customer-message use
// cases in this delivery: review requests, win-back outreach, and
// weather-reschedule heads-up. Consolidated rather than 3 near-
// identical functions — same model, same JSON shape, same rules,
// just a different system prompt per purpose. Never sends anything
// itself — always returns a draft for the owner to review and send.

import { HublyAI, extractJson } from "../_shared/hubly_ai.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SHARED_RULES = `Keep it SHORT — this needs to work as a text message first, under
300 characters for the text version. Write in the business owner's
voice — warm, brief, human. Not salesy, not corporate, not
excessive emoji. This is a real message to a real person, not
marketing copy. Never invent a review platform link, promo code, or
URL — use the literal placeholder {REVIEW_LINK} exactly where a
link would go if one is relevant to this message type.`;

const PROMPTS: Record<string, string> = {
  review_request: `You draft a short review-request message for a customer whose mobile
detailing job was just completed. Reference the actual service and
vehicle naturally. ${SHARED_RULES}`,

  win_back: `You draft a short, friendly check-in message for a customer who
hasn't booked in a while. The goal is genuine reconnection, not a
hard sell — reference how long it's been in a natural way (not
"our records show it has been 47 days"), and make it easy to say yes
to booking again. No guilt-tripping tone, no fake urgency/scarcity.
${SHARED_RULES}`,

  weather_reschedule: `You draft a short heads-up message for a customer whose upcoming
mobile detailing appointment may be affected by bad weather (rain or
snow forecasted). Be direct and helpful, not alarmist — the goal is
giving them an easy way to reschedule if they'd rather not risk it,
while making clear the business is flexible either way. ${SHARED_RULES}`,

  chat_followup: `You draft a short, warm follow-up message for a
prospective customer who recently chatted with this business's AI
assistant on their website and gave permission to be contacted, but
didn't finish booking during that conversation. This is a warm,
recent lead who was actively engaged minutes or hours ago — not a
lapsed customer, so don't write a "we miss you" reconnection message.
Reference what they asked about naturally, using only the topics
provided — don't invent specific prices, availability, or details
you weren't given. The goal is to pick up right where the
conversation left off and make it easy to finish booking. No
guilt-tripping about not booking yet, no fake urgency. ${SHARED_RULES}`,
};

const RESPONSE_SHAPE = `Respond with ONLY valid JSON, no markdown fences, no preamble:
{
  "text_version": string (under 300 characters, casual),
  "email_subject": string (short, not clickbait-y),
  "email_body": string (2-4 short sentences, slightly more detail than the text version is fine)
}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const { purpose, business_name, customer_name, context } = body || {};

    if (!purpose || !PROMPTS[purpose]) {
      return new Response(
        JSON.stringify({ error: `purpose must be one of: ${Object.keys(PROMPTS).join(", ")}` }),
        { status: 400, headers: { ...CORS, "content-type": "application/json" } },
      );
    }
    if (!customer_name || !business_name) {
      return new Response(
        JSON.stringify({ error: "customer_name and business_name are required" }),
        { status: 400, headers: { ...CORS, "content-type": "application/json" } },
      );
    }

    const systemPrompt = `${PROMPTS[purpose]}\n\n${RESPONSE_SHAPE}`;
    const facts = { customer_name, business_name, ...context };

    let rawText = "";
    try {
      const ai = await HublyAI.complete({
        feature: "draft-customer-message",
        task: "marketing",
        system: systemPrompt,
        messages: [{ role: "user", content: `DETAILS:\n${JSON.stringify(facts, null, 2)}` }],
        maxTokens: 500,
        jsonMode: true,
      });
      rawText = String(ai.text || "").trim();
    } catch (err) {
      console.error("draft-customer-message HublyAI error:", err);
      return new Response(JSON.stringify({ error: "Draft generation is temporarily unavailable." }), {
        status: 502,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    let draft;
    try {
      draft = JSON.parse(extractJson(rawText));
    } catch (e) {
      console.error("Failed to parse AI JSON:", rawText);
      return new Response(JSON.stringify({ error: "AI returned an unexpected format. Try again." }), {
        status: 502,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, draft }), {
      headers: { ...CORS, "content-type": "application/json" },
    });
  } catch (e) {
    console.error("draft-customer-message error:", e);
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), {
      status: 500,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }
});
