// supabase/functions/draft-customer-message/index.ts
// Thin façade: customer message drafts for the hire loop (review, win-back,
// weather, chat follow-up). Model calls go through HublyAI only — never
// direct Anthropic/OpenAI. Optionally injects Business Memory + DNA for voice.
// Never sends — owner always reviews before send-customer-email / SMS.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Hubly, HublyAIConfigError, HublyAIProviderError } from "../_shared/hubly_ai.ts";

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
link would go if one is relevant to this message type.
When Business Memory or Business DNA are provided, match their facts
and brand voice — never invent services, prices, or personality.`;

const PROMPTS: Record<string, string> = {
  review_request: `You draft a short review-request message for a customer whose job
was just completed. Reference the actual service and vehicle naturally.
${SHARED_RULES}`,

  win_back: `You draft a short, friendly check-in message for a customer who
hasn't booked in a while. The goal is genuine reconnection, not a
hard sell — reference how long it's been in a natural way (not
"our records show it has been 47 days"), and make it easy to say yes
to booking again. No guilt-tripping tone, no fake urgency/scarcity.
${SHARED_RULES}`,

  weather_reschedule: `You draft a short heads-up message for a customer whose upcoming
appointment may be affected by bad weather (rain or snow forecasted).
Be direct and helpful, not alarmist — the goal is giving them an easy
way to reschedule if they'd rather not risk it, while making clear the
business is flexible either way. ${SHARED_RULES}`,

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

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

function parseDraft(rawText: string): {
  text_version?: string;
  email_subject?: string;
  email_body?: string;
} | null {
  try {
    const cleaned = rawText.replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));
    const { purpose, business_name, customer_name, context, business_id } = body || {};

    if (!purpose || !PROMPTS[purpose]) {
      return jsonRes(
        { error: `purpose must be one of: ${Object.keys(PROMPTS).join(", ")}` },
        400,
      );
    }
    if (!customer_name || !business_name) {
      return jsonRes({ error: "customer_name and business_name are required" }, 400);
    }

    if (!Hubly.isConfigured("openai") && !Hubly.isConfigured("claude")) {
      return jsonRes(
        {
          error:
            "AI isn't configured yet. Add an OPENAI_API_KEY or ANTHROPIC_API_KEY secret.",
        },
        500,
      );
    }

    let memory = null;
    let dna = null;
    const businessId = String(business_id || "").trim();
    const authHeader = req.headers.get("Authorization") || "";
    if (businessId && authHeader.toLowerCase().startsWith("bearer ")) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
      if (supabaseUrl && anonKey) {
        const supabase = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: memRow } = await supabase
          .from("business_memories")
          .select("memory")
          .eq("business_id", businessId)
          .maybeSingle();
        const { data: dnaRow } = await supabase
          .from("business_dna")
          .select("dna")
          .eq("business_id", businessId)
          .maybeSingle();
        if (memRow?.memory) memory = memRow.memory;
        if (dnaRow?.dna) dna = dnaRow.dna;
      }
    }

    const systemPrompt = `${PROMPTS[purpose]}\n\n${RESPONSE_SHAPE}`;
    const facts = { customer_name, business_name, ...context };

    const result = await Hubly.customerSupport({
      feature: "draft-customer-message",
      system: systemPrompt,
      memory,
      dna,
      skills: ["respondToReview"],
      jsonMode: true,
      maxTokens: 500,
      messages: [
        {
          role: "user",
          content: `PURPOSE: ${purpose}\nDETAILS:\n${JSON.stringify(facts, null, 2)}`,
        },
      ],
    });

    const draft = parseDraft(String(result.text || ""));
    if (!draft || (!draft.text_version && !draft.email_body)) {
      console.error("draft-customer-message parse fail", result.text);
      return jsonRes({ error: "AI returned an unexpected format. Try again." }, 502);
    }

    return jsonRes({
      ok: true,
      draft: {
        text_version: draft.text_version || "",
        email_subject: draft.email_subject || "",
        email_body: draft.email_body || "",
      },
      meta: {
        provider: result.provider,
        model: result.model,
        brain: "HublyAI.customerSupport",
        memory: !!memory,
        dna: !!dna,
      },
    });
  } catch (e) {
    console.error("draft-customer-message error:", e);
    if (e instanceof HublyAIConfigError) {
      return jsonRes({ error: e.message }, 500);
    }
    if (e instanceof HublyAIProviderError) {
      return jsonRes({ error: "Draft generation is temporarily unavailable." }, 502);
    }
    return jsonRes({ error: "Something went wrong. Please try again." }, 500);
  }
});
