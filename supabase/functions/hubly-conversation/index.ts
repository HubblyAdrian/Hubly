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
//   `reply`, `actions`, `interimMessages`, and `understanding`. `messages` is
//   opaque — resent verbatim, never parsed structurally beyond `role`, so
//   internal orchestration can change without breaking any consumer.
// - Experience 1's opening line is the one deterministic exception to "the
//   model decides everything" — fixed exact text, no model call, but ONLY
//   when the very first message is a generic conversation starter ("I need
//   help with my business", "hi", etc.) with nothing real to respond to yet.
//   If the first message is an actual question or business content, it
//   skips the canned line and goes straight to the model, which answers it
//   naturally while still beginning Business Understanding normally. Every
//   turn after the first is fully open regardless — no other scripted flow
//   anywhere in this file.
// - Business Understanding is patch-based, like a CRDT or Git history: the
//   client sends its current accumulated state each turn (so the model knows
//   what's already established and never re-emits it), and the response
//   returns only what changed THIS turn. The server never stores or merges
//   this itself — the client owns the accumulated state. This accumulated
//   state is the seed of Business DNA.
// - Not an onboarding script. The same endpoint serves "I need help with my
//   business", "help me build a website", "I want more customers", etc. —
//   any future Hubly Core capability becomes reachable by registering it in
//   the Capability Registry, not by changing this file.
// - Honesty over intelligence: a capability action either produced real work
//   or it didn't, and an understanding patch either reflects something
//   genuinely learned or it isn't emitted. The model is never allowed to
//   claim more than a result actually contains — this now extends to
//   Business Understanding too: e.g. a business mentioning they use a tool
//   is a fact worth recording; it is never recorded or displayed as Hubly
//   being "connected" to that tool.

import { HublyAI, type HublyMessage } from "../_shared/hubly_ai.ts";
import { findAction, buildCapabilitiesPromptBlock } from "../_shared/hubly_capability_registry.ts";
import {
  selectRelevantCapabilityKnowledge,
  buildCapabilityKnowledgePromptBlock,
} from "../_shared/hubly_capability_knowledge_loader.ts";
import {
  type BusinessUnderstandingPatch,
  UNDERSTANDING_CATEGORIES,
  mergeUnderstandingPatch,
  isEmptyPatch,
} from "../_shared/hubly_business_understanding.ts";

// Experience 1's opening line is fixed, not model-generated — this is the
// first thing anyone ever sees from Hubly, too important to leave to
// per-turn variance. Returned only when the first message is a generic
// opener with nothing specific to respond to (see isGenericOpener below).
// Every turn after this one belongs entirely to the model — no scripted
// flow beyond it.
const DETERMINISTIC_OPENING =
  "I'd love to help.\n\nBefore I make recommendations or build anything, I'd like to learn about your business.\n\nYou can paste a website, your Google Business Profile, Facebook page, Instagram, upload screenshots, or simply tell me you're starting from scratch.";

// A first message counts as a "generic opener" only if it's one of a small
// set of content-free ways people start this conversation — not a real
// question or any actual business content, which the model should answer
// directly instead. Deliberately a plain pattern check, not a second model
// call: the architecture allows exactly one reasoning engine in this stack,
// and this distinction is simple enough not to need one.
const GENERIC_OPENER_PATTERNS: RegExp[] = [
  /^\s*(hi|hey|hello)(\s+there)?[.,!]?\s*$/i,
  /^\s*i'?d?\s*(need|want|like\s+(some\s+)?)\s*help(\s+with\s+(my|our)\s+business)?[.,!?]*\s*$/i,
  /^\s*(can|could)\s+you\s+help(\s+me)?(\s+with\s+(my|our)\s+business)?[.,!?]*\s*$/i,
  /^\s*help(\s+me)?(\s+with\s+(my|our)\s+business)?[.,!?]*\s*$/i,
  /^\s*(let'?s|lets)\s+get\s+started[.,!?]*\s*$/i,
];

function isGenericOpener(content: unknown): boolean {
  if (typeof content !== "string") return false;
  return GENERIC_OPENER_PATTERNS.some((re) => re.test(content));
}

// Mirrors BusinessUnderstandingPatch in hubly_business_understanding.ts
// exactly — that's a compile-time-only type with no runtime form to derive
// this from, so it's hand-kept in sync. If that type changes, update this too.
const UNDERSTANDING_SCHEMA = `{
  "business"?: { "name"?: string },
  "industry"?: string,
  "services"?: string[],
  "website"?: { "status"?: "found" | "not_found", "url"?: string },
  "brand"?: { "colors"?: string[] },
  "scheduling"?: { "current_system"?: string },
  "crm"?: { "current_system"?: string },
  "payments"?: { "current_system"?: string },
  "goals"?: string[]
}`;

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

function buildSystemPrompt(currentUnderstanding: BusinessUnderstandingPatch, latestUserMessage: string | null): string {
  const knownSoFar = isEmptyPatch(currentUnderstanding)
    ? "Nothing yet — this is the start of understanding this business."
    : JSON.stringify(currentUnderstanding, null, 2);

  // Selective, deterministic — never the whole Knowledge Base. This is what
  // keeps the prompt small and stable as the Knowledge Base grows; see
  // _shared/hubly_capability_knowledge_loader.ts.
  const relevantCapabilities = selectRelevantCapabilityKnowledge({
    understanding: currentUnderstanding,
    userMessage: latestUserMessage,
  });

  return `You are Hubly — a conversational business partner, not a piece of software someone has to learn. You are the primary interface to the Hubly platform: every capability Hubly has should feel reachable by simply telling you what's needed, in plain conversation.

You are general-purpose. You are not an onboarding wizard and you must not behave like one. People may open a conversation with you for many different reasons — "I need help with my business", "help me build a website", "I want more customers", "I need a storefront", "help me price my services", or anything else. Respond to what the person actually asked for. Never force a scripted sequence of questions.

TONE
Warm, direct, and competent — like sitting down with a good consultant, not filling out a form. Short paragraphs. No corporate filler. Never say "as an AI".

LEARNING ABOUT A BUSINESS
When it's useful to understand the business before helping (e.g. someone asks for general help, or wants recommendations), you can ask them to paste a website, a Google Business Profile link, a Facebook or Instagram page, upload photos or screenshots, or simply say they're starting from scratch. All of those are valid — never insist on one over another.

Whenever you've just gathered new information (from a capability result, or from what someone told you directly), reflect it back naturally and move forward — do NOT stop and ask permission to share it (never "would it be okay if I showed you what I found?" or similar). Just say what you noticed, then keep the conversation moving, e.g. "I took a look at your site. Here's what I noticed — [...]. What's the biggest challenge you're trying to solve right now?" Findings are shared immediately, not gated behind a question. Only ask a real question when you genuinely need the person's input to proceed — for example after a capability could NOT read something, redirect naturally instead ("I can't read that yet — is there a website I could look at instead?").

ABSOLUTE RULE — HONESTY OVER APPEARING INTELLIGENT
You must never imply that analysis happened unless it actually happened. If a capability result says something could not be read, say so plainly and explain what would need to change for you to read it (e.g. "there's no live connection to Instagram yet, so I can't read what's actually on the page — connecting it in the future will let me look at it properly"). Never invent findings, never say something is "being processed" or "continuing in the background" unless a real process is genuinely running. Trust matters more than sounding capable.

CAPABILITY KNOWLEDGE RELEVANT TO THIS CONVERSATION
This is knowledge about what Hubly genuinely offers, selected for what's come up so far — NOT a list of things you can invoke (see the next section for that). Use it to recommend the right thing at the right moment, with the right caveat when one is noted. Never recommend something outside this list without genuine evidence it's relevant; if nothing here fits, just help in conversation:
${buildCapabilityKnowledgePromptBlock(relevantCapabilities)}

HUBLY CAPABILITIES YOU CAN ACTUALLY INVOKE RIGHT NOW
This is the only list of things you can actually DO. Never claim, promise, or imply you can do something from the list above unless it also appears here:
${buildCapabilitiesPromptBlock()}

Photos or screenshots someone attaches are visible to you directly in the conversation — look at them and describe honestly what you can actually see. That doesn't require a capability call.

RECOMMENDING A CAPABILITY
Never recommend or invoke a capability just because it exists. Only bring one up when it genuinely helps with what the person actually said they need. If nothing in your available capabilities is relevant to what they're asking, don't force one in — just help them in conversation.

BUSINESS UNDERSTANDING — YOUR EVOLVING MENTAL MODEL OF THIS BUSINESS
Alongside your reply, you maintain a shared, structured understanding of this business across categories: business, industry, services, website, brand, scheduling, crm, payments, goals. This becomes visible to the person as "What I've Learned" and, eventually, Business DNA.

What's already known about this business (do not repeat any of this — only report NEW or CHANGED information):
${knownSoFar}

Every patch you emit MUST match this exact schema — no other fields, no different nesting:
${UNDERSTANDING_SCHEMA}

Rules for understanding patches:
- Only include a category in your patch if you learned something NEW or CHANGED this turn. Never re-send something already listed above.
- Never guess or fabricate a value. "industry" and "goals" often require your own judgment from context — that's fine, but only when there's real evidence for it (e.g. a business offering "drain cleaning" and "water heater repair" genuinely supports "industry": "Plumbing"). Don't infer without evidence.
- "scheduling.current_system" / "crm.current_system" / "payments.current_system" record a tool the business told you they currently use — a fact, not a claim that Hubly is connected to it. Never write these unless the person or a capability result genuinely stated it.
- "services" and "goals" are arrays that REPLACE the previous value entirely, not merge with it — whenever you include one, write out the complete current list (everything already known plus whatever's new), never just the new item.
- "website", "brand", "scheduling", "crm", and "payments" are objects that are shallow-merged onto what's already known — you only need to include the field(s) that are new or changed within them, not the whole object.
- "business" only ever holds "name" — richer context you learn about the business (what they do, where, how long, etc.) belongs in your conversational reply, never invented as extra fields here.
- If nothing new was learned this turn, omit "understanding" entirely from your response.

RESPONSE FORMAT — YOU MUST ALWAYS REPLY WITH ONLY THIS JSON SHAPE, NOTHING ELSE:
To invoke a capability action: {"action":"invoke","capability":"<capability name>","capabilityAction":"<action name>","args":{...matching that action's parameters...},"message":"<what you say to the person while this runs, e.g. 'Let me take a look at that...'>","understanding":{"patch":{...}}}
To reply normally: {"action":"reply","message":"<your full reply to the person>","understanding":{"patch":{...}}}

"understanding" is optional on both — include it only when you learned something new this turn, matching the categories above (${UNDERSTANDING_CATEGORIES.join(", ")}).

Only invoke a capability when someone has actually given you something to act on (e.g. a URL, an explicit request). Never invoke one speculatively.`;
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

  const incoming: HublyMessage[] = Array.isArray(body?.messages) ? body.messages : [];
  if (!incoming.length) return jsonRes({ ok: false, error: "messages_required" }, 400);

  // The deterministic opening needs no model call at all, so it must never
  // be gated behind provider configuration — check for it before the
  // isConfigured guard below, not after. Only takes this path when there's
  // no prior Hubly reply AND the first message is a generic opener with
  // nothing real to respond to yet — otherwise it falls through to the
  // model below, same as any other turn.
  if (!incoming.some((m) => m.role === "assistant") && isGenericOpener(incoming[0]?.content)) {
    const history = [...incoming, { role: "assistant" as const, content: DETERMINISTIC_OPENING }];
    return jsonRes({ ok: true, reply: DETERMINISTIC_OPENING, messages: history, actions: [], interimMessages: [] });
  }

  if (!HublyAI.isConfigured("openai")) {
    return jsonRes({ ok: false, error: "Hubly Conversation is not configured yet." }, 503);
  }

  // Reserved for future Business Memory / DNA wiring — accepted and threaded
  // through, unused today. Adding it later means passing it into
  // HublyAI.chat({ memory, dna, ... }) below, not changing this contract.
  const businessId = body?.businessId ? String(body.businessId) : null;

  // The client's current accumulated Business Understanding — this server
  // never stores it. Fed into the prompt so the model knows what's already
  // known and only emits a patch for what's new.
  const currentUnderstanding: BusinessUnderstandingPatch =
    body?.understanding && typeof body.understanding === "object" ? body.understanding : {};

  let history: HublyMessage[] = incoming.slice(-MAX_HISTORY);
  // Fixed for the whole turn, including any internal capability rounds
  // below — those are server-internal continuations of this one user
  // message, not new input, so the relevance signal shouldn't shift mid-turn.
  const lastIncomingUser = [...incoming].reverse().find((m) => m.role === "user");
  const latestUserMessage = typeof lastIncomingUser?.content === "string" ? lastIncomingUser.content : null;
  const actions: Array<{ capability: string; capabilityAction: string; args: unknown; ok: boolean; real: boolean }> = [];
  // Patches emitted across internal capability rounds within this one request
  // accumulate into a single consolidated patch for the response — the client
  // only sees one round-trip per call, so it should only see one patch too.
  let turnPatch: BusinessUnderstandingPatch = {};
  // "Let me take a look..."-style lines said before the final reply this
  // turn, in order — the client can render these as a natural pacing beat
  // ahead of the final message.
  const interimMessages: string[] = [];

  try {
    for (let round = 0; round < MAX_CAPABILITY_ROUNDS; round++) {
      const ai = await HublyAI.chat({
        feature: "hubly-conversation",
        system: buildSystemPrompt(mergeUnderstandingPatch(currentUnderstanding, turnPatch), latestUserMessage),
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

      if (decision?.understanding?.patch && typeof decision.understanding.patch === "object") {
        turnPatch = mergeUnderstandingPatch(turnPatch, decision.understanding.patch);
      }

      if (decision?.action === "invoke" && decision.capability && decision.capabilityAction) {
        const said = String(decision.message || "").trim();
        if (said) {
          history.push({ role: "assistant", content: said });
          interimMessages.push(said);
        }

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
      return jsonRes({
        ok: true,
        reply: finalText,
        messages: history,
        actions,
        interimMessages,
        ...(isEmptyPatch(turnPatch) ? {} : { understanding: { patch: turnPatch } }),
      });
    }

    // Exhausted capability rounds without a final natural-language reply —
    // stop honestly instead of looping forever.
    return jsonRes({
      ok: true,
      reply: "I've gathered what I can for now — what would you like to do next?",
      messages: history,
      actions,
      interimMessages,
      ...(isEmptyPatch(turnPatch) ? {} : { understanding: { patch: turnPatch } }),
    });
  } catch (err) {
    console.error("hubly-conversation error:", err);
    return jsonRes({ ok: false, error: "Hubly Conversation is temporarily unavailable." }, 502);
  }
});
