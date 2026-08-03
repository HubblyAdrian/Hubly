// supabase/functions/hubly-conversation/index.ts
//
// Hubly Conversation — the canonical, general-purpose conversational interface
// to Hubly V4. This is Hubly Core (capability group 10 — AI).
//
// This service is ONE CONSUMER of the Hubly Capability Registry
// (_shared/hubly_capability_registry.ts) — it does not own it, and it
// contains zero capability-specific logic. It asks "which capability solves
// this?", invokes one of that capability's actions, and reports back exactly
// what happened. All business logic lives in the registry's action handlers,
// which call existing backend services.
//
// Rules this file exists to satisfy:
// - Built directly on HublyAI (hubly_ai.ts). Never the legacy Brain / think()
//   pipeline — that path does not reach a real model and is frozen Legacy
//   architecture (see "V4 Reset", 2026-08-03).
// - Stateless orchestration: the caller threads the full message history on
//   every turn; this function persists nothing today. `businessId` is
//   accepted and threaded through so Business Memory / DNA can be wired in
//   later (via HublyAICallOpts.memory / .dna) without changing this contract.
// - Public contract stays minimal and stable: the client only ever sees
//   `reply` and `actions`. `messages` is opaque — resent verbatim, never
//   parsed structurally beyond `role`, so internal orchestration (e.g. how a
//   capability result gets threaded back to the model) can change without
//   breaking any consumer.
// - Not an onboarding script. The same endpoint serves "I need help with my
//   business", "help me build a website", "I want more customers", etc. —
//   any future Hubly Core capability becomes reachable by registering it in
//   the Capability Registry, not by changing this file.
// - Honesty over intelligence: a capability action either produced real work
//   or it didn't. The model is never allowed to claim more than an action
//   result actually contains.

import { HublyAI, type HublyMessage } from "../_shared/hubly_ai.ts";
import { findAction, buildCapabilitiesPromptBlock } from "../_shared/hubly_capability_registry.ts";

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

const MAX_CAPABILITY_ROUNDS = 4;
const MAX_HISTORY = 40;

function buildSystemPrompt(): string {
  return `You are Hubly — a conversational business partner, not a piece of software someone has to learn. You are the primary interface to the Hubly platform: every capability Hubly has should feel reachable by simply telling you what's needed, in plain conversation.

You are general-purpose. You are not an onboarding wizard and you must not behave like one. People may open a conversation with you for many different reasons — "I need help with my business", "help me build a website", "I want more customers", "I need a storefront", "help me price my services", or anything else. Respond to what the person actually asked for. Never force a scripted sequence of questions.

TONE
Warm, direct, and competent — like sitting down with a good consultant, not filling out a form. Short paragraphs. No corporate filler. Never say "as an AI".

LEARNING ABOUT A BUSINESS
When it's useful to understand the business before helping (e.g. someone asks for general help, or wants recommendations), you can ask them to paste a website, a Google Business Profile link, a Facebook or Instagram page, upload photos or screenshots, or simply say they're starting from scratch. All of those are valid — never insist on one over another.

Whenever you've just gathered new information (from a capability result, or from what someone told you directly), briefly reflect back what you now understand in plain language, then ask permission before going further — for example "Would it be okay if I showed you what I found?" or "Want me to walk you through what I'm seeing?". Earn the right to advise; don't just start advising. This applies any time you've just learned something new, not only at the very start of a conversation.

ABSOLUTE RULE — HONESTY OVER APPEARING INTELLIGENT
You must never imply that analysis happened unless it actually happened. If a capability result says something could not be read, say so plainly and explain what would need to change for you to read it (e.g. "there's no live connection to Instagram yet, so I can't read what's actually on the page — connecting it in the future will let me look at it properly"). Never invent findings, never say something is "being processed" or "continuing in the background" unless a real process is genuinely running. Trust matters more than sounding capable.

HUBLY CAPABILITIES AVAILABLE TO YOU
${buildCapabilitiesPromptBlock()}

Photos or screenshots someone attaches are visible to you directly in the conversation — look at them and describe honestly what you can actually see. That doesn't require a capability call.

RESPONSE FORMAT — YOU MUST ALWAYS REPLY WITH ONLY THIS JSON SHAPE, NOTHING ELSE:
To invoke a capability action: {"action":"invoke","capability":"<capability name>","capabilityAction":"<action name>","args":{...matching that action's parameters...},"message":"<what you say to the person while this runs, e.g. 'Let me take a look at that...'>"}
To reply normally: {"action":"reply","message":"<your full reply to the person>"}

Only invoke a capability when someone has actually given you something to act on (e.g. a URL, an explicit request). Never invoke one speculatively.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonRes({ ok: false, error: "POST required" }, 405);

  if (!HublyAI.isConfigured("openai")) {
    return jsonRes({ ok: false, error: "Hubly Conversation is not configured yet." }, 503);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const incoming: HublyMessage[] = Array.isArray(body?.messages) ? body.messages : [];
  if (!incoming.length) return jsonRes({ ok: false, error: "messages_required" }, 400);

  // Reserved for future Business Memory / DNA wiring — accepted and threaded
  // through, unused today. Adding it later means passing it into
  // HublyAI.chat({ memory, dna, ... }) below, not changing this contract.
  const businessId = body?.businessId ? String(body.businessId) : null;

  let history: HublyMessage[] = incoming.slice(-MAX_HISTORY);
  const actions: Array<{ capability: string; capabilityAction: string; args: unknown; ok: boolean; real: boolean }> = [];

  try {
    for (let round = 0; round < MAX_CAPABILITY_ROUNDS; round++) {
      const ai = await HublyAI.chat({
        feature: "hubly-conversation",
        system: buildSystemPrompt(),
        messages: history,
        jsonMode: true,
        maxTokens: 900,
        businessId,
      });

      const rawText = String(ai.text || "").trim();
      let decision: any;
      try {
        decision = JSON.parse(extractJson(rawText));
      } catch {
        // Model didn't return the expected JSON shape — fail open honestly
        // rather than pretending structure that isn't there.
        decision = { action: "reply", message: rawText || "Sorry, could you say that again?" };
      }

      if (decision?.action === "invoke" && decision.capability && decision.capabilityAction) {
        const said = String(decision.message || "").trim();
        if (said) history.push({ role: "assistant", content: said });

        // Pure dispatch by name — no capability-specific logic here. If it
        // doesn't exist in the registry, that's reported honestly like any
        // other result, not special-cased.
        const capabilityName = String(decision.capability);
        const actionName = String(decision.capabilityAction);
        const found = findAction(capabilityName, actionName);
        const result = found
          ? await found.handler(decision.args || {})
          : { ok: false, real: false, summary: "That capability or action does not exist.", error: "unknown_capability_action" };

        actions.push({
          capability: capabilityName,
          capabilityAction: actionName,
          args: decision.args || {},
          ok: !!result.ok,
          real: !!result.real,
        });

        history.push({
          role: "system",
          content: `CAPABILITY RESULT for ${capabilityName}.${actionName}: ${JSON.stringify(result)}\nOnly report what "summary" and "raw" actually show. Do not claim anything beyond this.`,
        });
        continue;
      }

      const finalText =
        String(decision?.message || decision?.reply || rawText || "").trim() ||
        "I'm here — what would you like help with?";
      history.push({ role: "assistant", content: finalText });
      return jsonRes({ ok: true, reply: finalText, messages: history, actions });
    }

    // Exhausted capability rounds without a final natural-language reply —
    // stop honestly instead of looping forever.
    return jsonRes({
      ok: true,
      reply: "I've gathered what I can for now — what would you like to do next?",
      messages: history,
      actions,
    });
  } catch (err) {
    console.error("hubly-conversation error:", err);
    return jsonRes({ ok: false, error: "Hubly Conversation is temporarily unavailable." }, 502);
  }
});
