// supabase/functions/chatbot-message/index.ts
// Customer-facing AI chatbot -- one call per conversation turn. No
// streaming: the client resends the full message history each time,
// this function returns the next assistant reply plus structured
// metadata (topics, fallback/handoff classification) in one JSON
// response, same "one AI call, multiple structured fields" pattern as
// draft-customer-message. This is the only writer to
// chatbot_conversations/chatbot_messages -- it uses the service role
// key, which is why those tables have no public RLS policies.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "claude-haiku-4-5-20251001";
const MAX_MESSAGES_PER_CONVERSATION = 30;
const MAX_CONVERSATIONS_PER_HOUR = 20;

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
}

// Claude sometimes writes a natural-language sentence before the JSON
// (or a code fence around it) despite the system prompt saying not to
// -- rather than assume the whole response is clean JSON, pull out
// whatever's between the first { and last }, so a prose preamble
// doesn't turn into a hard failure.
function extractJson(rawText: string): string {
  const start = rawText.indexOf("{");
  const end = rawText.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return rawText;
  return rawText.slice(start, end + 1);
}

function redirectReply(bizName: string, phone: string, email: string) {
  const contact = [phone, email].filter(Boolean).join(" or ");
  return {
    reply: contact
      ? `I don't have that specific info, but you can reach ${bizName} directly at ${contact}.`
      : `I don't have that specific info -- please reach out to ${bizName} directly and they can help.`,
    topics: [],
    handoff: { type: "redirect_contact", service_name: null, customer_name: null, customer_phone: null, customer_email: null },
  };
}

function buildSystemPrompt(biz: any, services: any[], faq: any[], hours: any, cities: string[], isPro: boolean) {
  const servicesBlock = services.length
    ? services.map((s) => `- ${s.name}: $${s.price}${s.description ? " -- " + s.description : ""}`).join("\n")
    : "(no services configured yet)";
  const faqBlock = faq.length ? faq.map((f: any) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n") : "(no FAQ configured yet)";
  const hoursBlock = hours
    ? Object.entries(hours).map(([d, h]: [string, any]) => `${d}: ${h.closed ? "closed" : `${h.open}-${h.close}`}`).join(", ")
    : "(hours not configured yet)";
  const citiesBlock = cities.length ? cities.join(", ") : "(not configured -- do not claim any specific coverage area)";

  const consentInstruction = isPro
    ? `If a question genuinely needs a real person to answer -- something outside what you can determine from the data above, or a special request -- your reply field may ask: "Great question -- let me have ${biz.name} reach back out. What's the best way to reach you?" (still inside the required JSON object below, never as plain unwrapped text). Only ask this when there's a real reason to follow up, never by default and never more than once per conversation. Once the customer replies with contact info, extract it into the handoff fields below and thank them -- all of this still goes inside the JSON structure.`
    : `You do not have the ability to arrange follow-up. For anything outside the data above, your reply field should tell the customer to contact ${biz.name} directly using the phone/email below -- as JSON, never as plain unwrapped text.`;

  return `You are a helpful assistant for ${biz.name}, a mobile detailing business. Answer customer questions using ONLY the real business data below -- never invent a service, price, hours, or coverage area that isn't listed here. If something isn't covered, say so honestly.

SERVICES:
${servicesBlock}

FAQ:
${faqBlock}

HOURS:
${hoursBlock}

CITIES SERVED:
${citiesBlock}

CONTACT (for redirects): phone ${biz.phone || "(not set)"}, email ${biz.email || "(not set)"}

WHAT YOU DO:
1. Answer general questions (hours, service area, pricing, what's included) directly from the data above.
2. Help the customer pick the right real service for their vehicle/needs -- never invent a price or a service that isn't listed. If they're ready to book a specific configured service, set handoff.type to "book_service" with the exact service name.
3. ${consentInstruction}

Your ENTIRE response must be the JSON object below and NOTHING else -- no introductory sentence, no explanation, no markdown code fence, no restating the reply as plain text before or after the JSON. The customer-facing message belongs ONLY inside the "reply" field. Do not write it twice.
{
  "reply": string (natural, friendly -- this is a chat, not an essay. Keep it under 400 characters unless the customer specifically asked for a detailed breakdown),
  "topics": array of short lowercase snake_case tags relevant to this message (e.g. ["pricing","ceramic_coating"]),
  "handoff": {
    "type": one of the following -- match the CURRENT turn to exactly one:
      - null: an ordinary Q&A turn, nothing else applies
      - "redirect_contact": you don't know the answer and are pointing the customer to the business's OWN contact info (the CONTACT line above). Not related to the Pro follow-up flow at all.
      - "consent_capture": THIS turn is part of the Pro follow-up flow specifically -- use it both when YOU are asking the follow-up question ("What's the best way to reach you?") and when the customer is ANSWERING it with their contact info. Never use redirect_contact for either of those two turns.
      - "book_service": the customer is ready to book a specific real configured service.
    "service_name": string or null (exact name from SERVICES above, only when type is "book_service"),
    "customer_name": string or null (only when type is "consent_capture" and the customer just gave it),
    "customer_phone": string or null,
    "customer_email": string or null
  }
}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const { business_id, conversation_id, messages, mark_resulted_in_booking } = body || {};

    if (!business_id) {
      console.error("chatbot-message rejected: business_id missing. Full body:", JSON.stringify(body));
      return jsonRes({ error: "business_id is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      console.error("chatbot-message rejected: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from function env.");
      return jsonRes({ error: "Chatbot isn't configured yet on the server." }, 500);
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    // Booking-completion signal from the handoff flow -- no AI call,
    // just the one write the anonymous client otherwise has no path to
    // make (chatbot_conversations has no public RLS policy at all).
    if (mark_resulted_in_booking) {
      if (!conversation_id) {
        console.error("chatbot-message rejected: mark_resulted_in_booking sent without conversation_id. business_id:", business_id);
        return jsonRes({ error: "conversation_id is required" }, 400);
      }
      const { error } = await supabase
        .from("chatbot_conversations")
        .update({ resulted_in_booking: true, ended_at: new Date().toISOString() })
        .eq("id", conversation_id)
        .eq("business_id", business_id);
      if (error) {
        console.error("chatbot-message: mark_resulted_in_booking update failed:", error.message, "conversation_id:", conversation_id, "business_id:", business_id);
        return jsonRes({ error: error.message }, 500);
      }
      return jsonRes({ ok: true });
    }

    if (!Array.isArray(messages) || !messages.length) {
      console.error("chatbot-message rejected: messages missing or empty. business_id:", business_id, "messages:", JSON.stringify(messages));
      return jsonRes({ error: "messages must be a non-empty array" }, 400);
    }
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "customer" || !String(lastMsg.content || "").trim()) {
      console.error("chatbot-message rejected: last message not a valid customer message. business_id:", business_id, "lastMsg:", JSON.stringify(lastMsg), "messages.length:", messages.length);
      return jsonRes({ error: "the last message must be from the customer" }, 400);
    }

    const { data: biz, error: bizError } = await supabase
      .from("businesses")
      .select("name, phone, email, tier, meta, service_area_cities")
      .eq("id", business_id)
      .single();
    if (bizError || !biz) {
      console.error("chatbot-message rejected: business not found. business_id:", business_id, "bizError:", bizError?.message);
      return jsonRes({ error: "Business not found." }, 404);
    }

    const meta = typeof biz.meta === "string" ? JSON.parse(biz.meta || "{}") : (biz.meta || {});
    const faq = Array.isArray(meta?.website?.faq) ? meta.website.faq : [];
    const hours = meta?.hours || null;
    const cities = Array.isArray(biz.service_area_cities) ? biz.service_area_cities : [];
    const isPro = biz.tier === "pro";

    const { data: services } = await supabase
      .from("services")
      .select("name, price, description")
      .eq("business_id", business_id)
      .order("sort_order");

    // Rate limits -- checked before any AI call, so a rejection never
    // spends a token. Reuses the same redirect_contact shape a genuine
    // "I don't know" reply would use, so the client needs no special
    // rate-limited UI path.
    if (!conversation_id) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("chatbot_conversations")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business_id)
        .gte("started_at", oneHourAgo);
      if ((count || 0) >= MAX_CONVERSATIONS_PER_HOUR) {
        return jsonRes({ conversation_id: null, ...redirectReply(biz.name, biz.phone, biz.email) });
      }
    } else {
      const { data: existingConv } = await supabase
        .from("chatbot_conversations")
        .select("id, business_id")
        .eq("id", conversation_id)
        .single();
      if (!existingConv || existingConv.business_id !== business_id) {
        console.error("chatbot-message rejected: conversation_id/business_id mismatch. conversation_id:", conversation_id, "sent business_id:", business_id, "existingConv.business_id:", existingConv?.business_id);
        return jsonRes({ error: "conversation_id does not belong to this business" }, 400);
      }
      const { count } = await supabase
        .from("chatbot_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversation_id);
      if ((count || 0) >= MAX_MESSAGES_PER_CONVERSATION) {
        await supabase.from("chatbot_conversations").update({ ended_at: new Date().toISOString() }).eq("id", conversation_id);
        return jsonRes({ conversation_id, ...redirectReply(biz.name, biz.phone, biz.email) });
      }
    }

    let convId = conversation_id;
    if (!convId) {
      const { data: newConv, error: convError } = await supabase
        .from("chatbot_conversations")
        .insert({ business_id })
        .select("id")
        .single();
      if (convError || !newConv) {
        console.error("chatbot-message: failed to create conversation row. business_id:", business_id, "convError:", convError?.message);
        return jsonRes({ error: "Could not start conversation." }, 500);
      }
      convId = newConv.id;
    }

    await supabase.from("chatbot_messages").insert({ conversation_id: convId, role: "customer", content: lastMsg.content });

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      console.error("chatbot-message rejected: ANTHROPIC_API_KEY missing from function env. business_id:", business_id);
      return jsonRes({ error: "AI isn't configured yet. Add an ANTHROPIC_API_KEY secret." }, 500);
    }

    const systemPrompt = buildSystemPrompt(biz, services || [], faq, hours, cities, isPro);
    const anthropicMessages = messages.map((m: any) => ({
      role: m.role === "customer" ? "user" : "assistant",
      content: m.content,
    }));

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1536, system: systemPrompt, messages: anthropicMessages }),
    });

    if (!anthropicRes.ok) {
      console.error("Anthropic API error:", anthropicRes.status, await anthropicRes.text());
      return jsonRes({ error: "The chatbot is temporarily unavailable." }, 502);
    }

    const data = await anthropicRes.json();
    const rawText = (data.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n").trim();

    let parsed;
    try {
      parsed = JSON.parse(extractJson(rawText));
    } catch (e) {
      // The model occasionally skips the JSON structure entirely and
      // just answers in plain prose -- when that happens the content
      // itself is usually still a perfectly good customer-facing
      // answer, just unwrapped. Use it as the reply rather than
      // surfacing a hard error to a real customer; topics/handoff are
      // skipped for this one turn (safe defaults) rather than guessed.
      console.error("Failed to parse AI JSON, falling back to raw text as reply:", rawText);
      if (!rawText) {
        return jsonRes({ error: "The chatbot returned an unexpected response. Try again." }, 502);
      }
      parsed = { reply: rawText, topics: [], handoff: { type: null } };
    }

    const reply = String(parsed.reply || "").trim();
    const topics = Array.isArray(parsed.topics) ? parsed.topics : [];
    const handoff = parsed.handoff || { type: null };

    await supabase.from("chatbot_messages").insert({ conversation_id: convId, role: "assistant", content: reply });

    const { data: convRow } = await supabase.from("chatbot_conversations").select("topics").eq("id", convId).single();
    const existingTopics = Array.isArray(convRow?.topics) ? convRow.topics : [];
    const mergedTopics = Array.from(new Set([...existingTopics, ...topics]));
    const updatePayload: Record<string, unknown> = { topics: mergedTopics };

    if (isPro && handoff?.type === "consent_capture" && (handoff.customer_name || handoff.customer_phone || handoff.customer_email)) {
      updatePayload.consented_to_followup = true;
      if (handoff.customer_name) updatePayload.customer_name = handoff.customer_name;
      if (handoff.customer_phone) updatePayload.customer_phone = handoff.customer_phone;
      if (handoff.customer_email) updatePayload.customer_email = handoff.customer_email;
    }
    await supabase.from("chatbot_conversations").update(updatePayload).eq("id", convId);

    return jsonRes({ conversation_id: convId, reply, topics: mergedTopics, handoff });
  } catch (e) {
    console.error("chatbot-message error:", e);
    return jsonRes({ error: "Something went wrong. Please try again." }, 500);
  }
});
