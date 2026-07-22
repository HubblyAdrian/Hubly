// supabase/functions/ai-advisor/index.ts
// Dashboard "Ask AI" — Hubly business coach.
// Answers ONLY from Hubly business context (Memory / DNA / Health / ops facts).
// Model calls go through HublyAI only — never direct Anthropic/OpenAI.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Hubly, HublyAIConfigError, HublyAIProviderError } from "../_shared/hubly_ai.ts";
import { loadBusinessMemoryDna } from "../_shared/hubly_brain_edge.ts";

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

const SYSTEM = `You are Hubly's Business Coach for this specific service business.

Rules (non-negotiable):
1. Answer ONLY from the Hubly business context provided (Business Memory facts, Business DNA identity, Health signals, and ops facts in the user message). Never invent customers, revenue, jobs, or reviews.
2. You are NOT a generic chatbot. No fluff, no motivational posters, no "as an AI".
3. Keep advice SHORT and actionable — a few sentences or tight bullets the owner can do today.
4. If the context is missing what you need, say what is missing and ask one clarifying question — do not invent.
5. Treat Memory as facts and DNA as identity/voice — never merge them or invent beyond Memory.
6. Match the language requested in the question when specified (English or Spanish).`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));
    const businessId = String(body?.business_id || "").trim();
    const question = String(body?.question || "").trim();

    if (!businessId) return jsonRes({ error: "business_id is required" }, 400);
    if (!question) return jsonRes({ error: "question is required" }, 400);

    if (!Hubly.isConfigured("openai") && !Hubly.isConfigured("claude")) {
      return jsonRes({
        error: "AI isn't configured yet. Add an OPENAI_API_KEY or ANTHROPIC_API_KEY secret.",
      }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("SUPABASE_SECRET_KEYS");
    if (!supabaseUrl || !serviceKey) {
      return jsonRes({ error: "Advisor isn't configured yet on the server." }, 500);
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    const { memory, dna } = await loadBusinessMemoryDna(supabase, businessId);

    const opsContext = {
      health: body?.health ?? null,
      feed_summary: body?.feed_summary ?? null,
      jobs_today: body?.jobs_today ?? null,
      unpaid: body?.unpaid ?? null,
      leads: body?.leads ?? null,
      crm_count: body?.crm_count ?? null,
      timeline_note: body?.timeline_note ?? null,
      language: body?.language ?? null,
    };

    let result;
    try {
      result = await Hubly.businessCoach({
        feature: "ai-advisor",
        system: SYSTEM,
        memory: memory as any,
        dna: dna as any,
        maxTokens: 700,
        messages: [
          {
            role: "user",
            content: `OPS CONTEXT (facts only):\n${JSON.stringify(opsContext, null, 2)}\n\nOWNER QUESTION:\n${question}`,
          },
        ],
      });
    } catch (e) {
      console.error("ai-advisor HublyAI error:", e);
      if (e instanceof HublyAIConfigError) {
        return jsonRes({ error: e.message }, 500);
      }
      if (e instanceof HublyAIProviderError) {
        return jsonRes({ error: "Advisor is temporarily unavailable." }, 502);
      }
      return jsonRes({ error: "Advisor is temporarily unavailable." }, 502);
    }

    const answer = String(result.text || "").trim();
    if (!answer) {
      return jsonRes({ error: "Advisor returned an empty reply. Try again." }, 502);
    }

    return jsonRes({
      answer,
      meta: {
        provider: result.provider,
        model: result.model,
        brain: "Hubly.businessCoach",
      },
    });
  } catch (e) {
    console.error("ai-advisor error:", e);
    return jsonRes({ error: "Something went wrong. Please try again." }, 500);
  }
});
