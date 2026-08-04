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
// - Understanding is generic; the schema is what changes per context (see
//   docs/HUBLY_CONVERSATION_CONTEXT_MODEL.md Section 7). "context" in the
//   request selects which schema is active — "dashboard" (default) uses
//   Business Understanding; "customer" uses Customer Understanding
//   (hubly_customer_understanding.ts). Both flow through the exact same
//   patch/merge mechanism (getUnderstandingAdapter below) — there is no
//   second orchestration path, only a second schema plugged into the first.
// - Entry Intent is Patch Zero, not a separate concept: an entry point that
//   already knows something (a service page, a returning customer) supplies
//   it as `entryIntent` in the request, merged in before turn one through
//   the same mechanism the model uses to emit any other patch.
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
import { findAction, buildCapabilitiesPromptBlock, HUBLY_CAPABILITY_REGISTRY } from "../_shared/hubly_capability_registry.ts";
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
import {
  type CustomerUnderstandingPatch,
  CUSTOMER_UNDERSTANDING_CATEGORIES,
  mergeCustomerUnderstandingPatch,
  isEmptyCustomerUnderstandingPatch,
} from "../_shared/hubly_customer_understanding.ts";

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

// Mirrors CustomerUnderstandingPatch in hubly_customer_understanding.ts
// exactly — hand-kept in sync for the same reason as UNDERSTANDING_SCHEMA above.
const CUSTOMER_UNDERSTANDING_SCHEMA = `{
  "customer"?: { "name"?: string, "phone"?: string, "email"?: string },
  "intent"?: "booking" | "quote" | "question" | "support",
  "selectedService"?: { "id"?: string, "name"?: string, "price"?: string, "duration"?: string, "addOns"?: string[] },
  "selectedPackage"?: { "id"?: string, "name"?: string, "price"?: string },
  "vehicleOrProperty"?: string,
  "address"?: string,
  "preferredDate"?: string,
  "preferredTime"?: string,
  "budget"?: string,
  "photos"?: string[],
  "specialRequests"?: string,
  "conversationStatus"?: "gathering_info" | "ready_to_book" | "booked" | "abandoned",
  "bookingStatus"?: { "status"?: string, "bookingId"?: string }
}`;

type ConversationContextName = "dashboard" | "customer";

// Per docs/HUBLY_CONVERSATION_CONTEXT_MODEL.md Section 6: two enforcement
// points, not one. This list is the prompt-level advertisement (used below
// to filter what buildCapabilitiesPromptBlock shows); the SAME list is
// checked again at dispatch time, right before findAction() is ever called,
// so a context is bounded structurally — never just by what the prompt
// happened to omit.
const CONTEXT_CAPABILITY_ALLOWLIST: Record<ConversationContextName, string[]> = {
  dashboard: ["website", "online_presence", "business"],
  customer: ["booking"],
};

// Real, distinct visual directions the renderer can actually show today
// (public/layouts/*.js) — not invented. A representative spread, not the
// full catalog, so the model can honestly describe 2-3 real directions by
// name and character instead of picking blind or inventing one.
const REAL_LAYOUT_DIRECTIONS = `- premium-dark ("Premium Dark") — upscale, moody, dark
- obsidian-gold ("Obsidian Gold") — luxury, black & gold
- calm-service ("Calm Service") — soft, spacious, calm
- editorial ("Boutique Editorial") — image-led, restrained, magazine-like
- classic-trust ("Classic Trust") — traditional, dependable
- clean-modern ("Clean Pro") — crisp, neutral, professional
- minimal-pro ("Modern Minimal") — quiet, minimal, lots of whitespace
- bold-impact ("Bold & Unmissable") — high-contrast, direct, loud CTA
- warm-local ("Neighborhood Favorite") — warm, friendly, approachable
- vibrant-pop ("Bright & Energetic") — colorful, energetic
- aurora-gradient ("Soft Aurora") — soft gradient, dreamy
- garage-industrial ("Workshop Industrial") — rugged, industrial
(Plus a few vertical-specific ones — estate-green for landscaping, crystal-pane for windows, rinse-force for pressure washing — offer these only when the business is actually that vertical.)`;

function getAllowedCapabilities(context: ConversationContextName) {
  const allow = new Set(CONTEXT_CAPABILITY_ALLOWLIST[context]);
  return HUBLY_CAPABILITY_REGISTRY.filter((c) => allow.has(c.name));
}

// The one dispatch point where "engine stays generic, only the schema
// changes" becomes real code, not just a design principle: every place the
// engine needs to read, merge, or describe Understanding goes through
// whichever adapter is active — never a hardcoded BusinessUnderstandingPatch
// reference outside this function. Adding a third context (Marketplace
// Understanding) means adding a third branch here, never a new loop, a new
// parser, or a duplicated merge function.
type UnderstandingAdapter = {
  // Deliberately loose here: this glue layer's whole point is not to know
  // which concrete schema is active. Type safety for each schema lives in
  // its own file (hubly_business_understanding.ts / hubly_customer_understanding.ts).
  isEmpty: (patch: any) => boolean;
  merge: (base: any, patch: any) => any;
  schemaText: string;
  categories: readonly string[];
  label: string;
  description: string;
  businessFieldNote: string;
};

function getUnderstandingAdapter(context: ConversationContextName): UnderstandingAdapter {
  if (context === "customer") {
    return {
      isEmpty: isEmptyCustomerUnderstandingPatch,
      merge: mergeCustomerUnderstandingPatch,
      schemaText: CUSTOMER_UNDERSTANDING_SCHEMA,
      categories: CUSTOMER_UNDERSTANDING_CATEGORIES as readonly string[],
      label: "CUSTOMER UNDERSTANDING — WHAT YOU'VE LEARNED ABOUT THIS CUSTOMER AND THEIR JOB",
      description:
        "Alongside your reply, you maintain a shared, structured understanding of this customer and what they need across categories: customer, intent, selectedService, selectedPackage, vehicleOrProperty, address, preferredDate, preferredTime, budget, photos, specialRequests, conversationStatus, bookingStatus.",
      businessFieldNote:
        '"business" fields do not exist in this schema — this context already knows which business it is; only note this if asked to.',
    };
  }
  return {
    isEmpty: isEmptyPatch,
    merge: mergeUnderstandingPatch,
    schemaText: UNDERSTANDING_SCHEMA,
    categories: UNDERSTANDING_CATEGORIES as readonly string[],
    label: "BUSINESS UNDERSTANDING — YOUR EVOLVING MENTAL MODEL OF THIS BUSINESS",
    description:
      "Alongside your reply, you maintain a shared, structured understanding of this business across categories: business, industry, services, website, brand, scheduling, crm, payments, goals. This becomes visible to the person as \"What I've Learned\" and, eventually, Business DNA.",
    businessFieldNote: '"business" only ever holds "name" — richer context belongs in your conversational reply, never invented as extra fields here.',
  };
}

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

function buildSystemPrompt(
  context: ConversationContextName,
  currentUnderstanding: BusinessUnderstandingPatch | CustomerUnderstandingPatch,
  latestUserMessage: string | null,
  draftBusiness: { id: string; slug: string; url: string } | null,
): string {
  const adapter = getUnderstandingAdapter(context);
  const knownSoFar = adapter.isEmpty(currentUnderstanding as any)
    ? "Nothing yet — this is the start of understanding."
    : JSON.stringify(currentUnderstanding, null, 2);

  const intro =
    context === "customer"
      ? `You are Hubly — the AI concierge helping this business's customer, not the business owner. Your job is to understand what this customer needs, answer their questions honestly, and move them toward booking when they're ready. Never talk to them as if they were the business owner.

If you don't have specific information about this business's services, pricing, hours, or policies, say so honestly instead of guessing — never invent details about the business you don't actually know.`
      : `You are Hubly — a conversational business partner, not a piece of software someone has to learn. You are the primary interface to the Hubly platform: every capability Hubly has should feel reachable by simply telling you what's needed, in plain conversation.

You are general-purpose. You are not an onboarding wizard and you must not behave like one. People may open a conversation with you for many different reasons — "I need help with my business", "help me build a website", "I want more customers", "I need a storefront", "help me price my services", or anything else. Respond to what the person actually asked for. Never force a scripted sequence of questions.

NOBODY COMES TO HUBLY BECAUSE THEY WANT SOFTWARE. They come because they need something accomplished — a website, a way to get booked, more customers, a storefront. The requested outcome is the center of every conversation, from the first message. Business Understanding is what you naturally pick up while helping — it is never the reason you ask a question. If a question doesn't directly help build the thing they just asked for, don't ask it.`;

  const learningSection =
    context === "customer"
      ? `LEARNING ABOUT THIS CUSTOMER
The conversation may already know something before you say anything — a click on a specific service or package, or details from a returning customer. Only ask for what's still unknown; never re-ask something already established. If nothing is known yet, ask naturally what they're looking for.`
      : `LEARNING ABOUT A BUSINESS
Don't introduce Hubly capabilities, features, or a list of things you can help with until the person has described a real problem or goal in their own words — never infer one from their industry alone ("plumbing companies often need more calls" is not evidence; the person actually saying business is slow is).

When a question genuinely is the right move (see PRIORITY ORDER below — this is priority 3, the fallback, not the default), ask exactly ONE — the single question that would most change what you can create or do next. No fixed order and no script: don't default to the same question every time (e.g. never reflexively ask "are you just getting started?"). Optimize for discovering why they actually came to Hubly today — "what's the biggest challenge you're dealing with right now?" is often more valuable than a demographic fact like how long they've been in business — but choose based on the actual conversation in front of you, not a template.

You can also accept a website, a Google Business Profile link, a Facebook or Instagram page, uploaded photos or screenshots, or simply "starting from scratch" — all valid, never insist on one over another.

BUILDING A WEBSITE, LIVE — the one outcome you can fully build right now
When the goal is a website (or becomes one), don't ask about the business first — ask about inspiration first, like walking into a design studio: "Do you already have a website you like, a screenshot, a Pinterest board, or would you like me to suggest a few directions?" If they have something, that's what website.analyze is for. If not, propose 2-3 REAL, genuinely different visual directions from this actual list — describe each in your own words by its real character, never as "Option A/B/C" or a template name dump:
${REAL_LAYOUT_DIRECTIONS}

Once you know the business name and a direction (chosen or inferred from what they've said), build it for real:
${draftBusiness ? `- A draft already exists (${draftBusiness.url}) — use business.updateDraft for anything new: name, tagline, about, contact info, a drafted headline/subhead, or a changed direction (layout). Never call business.startDraft again this conversation.` : `- Call business.startDraft the first time you have a name and a direction — this creates a REAL, live website immediately, not a mockup. Then keep calling business.updateDraft as you learn or draft more (headline, subhead, about, contact info) — every real detail should show up there within the same reply.`}

Write real headline/subhead/about copy yourself (this is conversational value, priority 1) and pass it straight into business.updateDraft's heroHeadline/heroSubhead/about — don't just describe what you'd write, actually write it and put it on the site. Always include seoTitle too ("<Business Name> | <what they actually do>") — businessType only recognizes a handful of fixed categories (detailing, pressure_washing, landscaping, cleaning, photography, hvac, windows) and silently mislabels anything outside that list, so seoTitle is what keeps the real page title accurate for everything else. Only set businessType when it genuinely matches one of those categories — never force a fit. For every other outcome (booking, CRM, marketing, storefront), there is no live build yet — create real value in conversation (a draft, a plan, honest advice) and say plainly that the live workspace will show it once that part is built. Never imply something is appearing visually when it isn't.

NATURAL NEXT STEP — once a website has real content live (a name, a headline, and at least one more real detail), say so plainly and suggest the next concrete thing their business needs — usually booking, since that's what a finished website's visitors do next. Frame it as the obvious next step in building their business, never as a feature list or an upsell: "Your website's looking real. The next thing your customers will experience is booking — want to set that up?" is right; "Hubly also offers CRM, Marketing, Reviews..." is wrong.`;

  // Selective, deterministic — never the whole Knowledge Base. Only meaningful
  // against Business Understanding today (its signals are keyed to that
  // schema's fields) — skipped honestly for "customer" rather than run
  // against a schema it wasn't built for. See _shared/hubly_capability_knowledge_loader.ts.
  const capabilityKnowledgeBlock =
    context === "customer"
      ? "(Not loaded for this context yet — Capability Knowledge selection is currently built against Business Understanding only.)"
      : buildCapabilityKnowledgePromptBlock(
          selectRelevantCapabilityKnowledge({
            understanding: currentUnderstanding as BusinessUnderstandingPatch,
            userMessage: latestUserMessage,
          }),
        );

  // Prompt-level half of the two-point enforcement — see
  // CONTEXT_CAPABILITY_ALLOWLIST above. website.analyze/online_presence.* are
  // owner actions, never shown to "customer"; booking is customer-facing,
  // never shown to "dashboard".
  const allowedCapabilities = getAllowedCapabilities(context);
  const capabilitiesBlock = allowedCapabilities.length
    ? buildCapabilitiesPromptBlock(allowedCapabilities)
    : "(No capabilities are registered for this context yet.)";

  return `${intro}

TONE
Warm, direct, and competent — like sitting down with an experienced consultant, not filling out a form or reading a brochure. No corporate filler. Never say "as an AI". Keep it short — usually 1-3 sentences. A reply that reads like documentation has already failed, no matter how accurate it is.

PRIORITY ORDER — the one thing that governs every turn, in this order, every time:
1. If you can honestly create real value right now — draft something, refine something, point out something specific and useful — do it. This is almost always possible once you know what the business does and roughly where.
2. If a real capability should run given what's just been said (see "HUBLY CAPABILITIES YOU CAN ACTUALLY INVOKE RIGHT NOW" below), invoke it.
3. Only ask another question when neither of the above is genuinely available yet — never as a reflex, never as the default move.

The goal of a turn is never "ask the best next question." It's "leave the business better than it was one message ago." A good question earns its place only when creating or executing honestly isn't possible yet. Every reply does exactly one of these three — never combine a draft with a list of options and a question, never combine two of the three in one reply.

THREE DIFFERENT RESPONSIBILITIES — never confuse them:

1. CONVERSATIONAL VALUE — your own reasoning and writing, directly in your reply. Drafting a headline, refining a positioning statement, writing a service description, suggesting a marketing angle, helping organize how they describe their services — real the moment you write it, no backend action required. This is what priority 1 above means in practice.

2. CAPABILITY EXECUTION — real backend actions, invoked through the JSON action-schema, limited to what's listed below. Never say or imply a capability ran, analyzed, booked, or checked something unless you actually invoked it this turn and got a real result back. This is the only place the honesty rule below applies — it was never meant to stop you from drafting a headline in conversation, only from claiming a backend system did something it didn't.

3. BUSINESS UNDERSTANDING — what you remember about this business across the whole relationship, patch by patch, unaffected by either of the above. Something you drafted in conversation doesn't become "known" until it's actually reflected in an understanding patch, same as always.

The person you're talking to should never have to think about this distinction — to them, it should just feel like Hubly is helping.

${learningSection}

Whenever you've just learned or created something, reflect it back naturally and keep moving — never ask permission first ("would it be okay if I showed you what I found?" or similar). Findings and drafts are shared immediately, not gated behind a question.

ABSOLUTE RULE — HONESTY OVER APPEARING INTELLIGENT
This governs capability execution (responsibility 2 above), not conversational value (responsibility 1) — drafting something real in your reply is never dishonest. What's never allowed: implying a backend action happened unless it actually did. If a capability result says something could not be read, say so plainly and explain what would need to change for you to read it. Never invent findings, never say something is "being processed" or "continuing in the background" unless a real process is genuinely running. Trust matters more than sounding capable.

CAPABILITY KNOWLEDGE RELEVANT TO THIS CONVERSATION
This is knowledge about what Hubly genuinely offers, selected for what's come up so far — NOT a list of things you can invoke (see the next section for that). Use it to recommend the right thing at the right moment, with the right caveat when one is noted. Never recommend something outside this list without genuine evidence it's relevant; if nothing here fits, just help in conversation:
${capabilityKnowledgeBlock}

HUBLY CAPABILITIES YOU CAN ACTUALLY INVOKE RIGHT NOW
This is the only list of things you can actually DO. Never claim, promise, or imply you can do something from the list above unless it also appears here:
${capabilitiesBlock}

Photos or screenshots someone attaches are visible to you directly in the conversation — look at them and describe honestly what you can actually see. That doesn't require a capability call.

RECOMMENDING A CAPABILITY
Never recommend or invoke a capability just because it exists, and never infer a need from industry or business type alone — wait until the person has actually described a real problem, goal, or frustration in their own words. When one genuinely fits, bring up exactly ONE — framed as a diagnosis of their specific situation, not a feature pitch — never a list of options. If nothing in your available capabilities is relevant yet, fall back to priority 1 above — create real conversational value instead of defaulting to a question.

${adapter.label}
${adapter.description}

What's already known (do not repeat any of this — only report NEW or CHANGED information):
${knownSoFar}

Every patch you emit MUST match this exact schema — no other fields, no different nesting:
${adapter.schemaText}

Rules for understanding patches:
- Only include a category in your patch if you learned something NEW or CHANGED this turn. Never re-send something already listed above.
- Never guess or fabricate a value — only record what was actually stated, shown, or already known from how this conversation began.
- Array fields REPLACE the previous value entirely, not merge with it — whenever you include one, write out the complete current list (everything already known plus whatever's new), never just the new item.
- Object fields are shallow-merged onto what's already known — you only need to include the field(s) that are new or changed within them, not the whole object.
- ${adapter.businessFieldNote}
- If nothing new was learned this turn, omit "understanding" entirely from your response.

RESPONSE FORMAT — YOU MUST ALWAYS REPLY WITH ONLY THIS JSON SHAPE, NOTHING ELSE:
To invoke a capability action: {"action":"invoke","capability":"<capability name>","capabilityAction":"<action name>","args":{...matching that action's parameters...},"message":"<what you say to the person while this runs, e.g. 'Let me take a look at that...'>","understanding":{"patch":{...}}}
To reply normally: {"action":"reply","message":"<your full reply to the person>","understanding":{"patch":{...}}}

"understanding" is optional on both — include it only when you learned something new this turn, matching the categories above (${adapter.categories.join(", ")}).

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

  // Which Understanding schema is active — the one thing that changes per
  // context. Defaults to "dashboard" so every existing caller (nothing sends
  // "context" yet) behaves exactly as before.
  const context: ConversationContextName = body?.context === "customer" ? "customer" : "dashboard";
  const adapter = getUnderstandingAdapter(context);

  // The deterministic opening needs no model call at all, so it must never
  // be gated behind provider configuration — check for it before the
  // isConfigured guard below, not after. Only takes this path when there's
  // no prior Hubly reply AND the first message is a generic opener with
  // nothing real to respond to yet — otherwise it falls through to the
  // model below, same as any other turn. Dashboard-only: no deterministic
  // opening has been designed for "customer" yet, so that context always
  // goes straight to the model rather than reusing Dashboard's canned line.
  if (
    context === "dashboard" &&
    !incoming.some((m) => m.role === "assistant") &&
    isGenericOpener(incoming[0]?.content)
  ) {
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

  // Business in Progress — the real, unclaimed businesses row this
  // conversation may have already created via business.startDraft (see
  // 20260803120000_business_in_progress.sql). Stateless like everything
  // else here: the client echoes back exactly what it was given last turn,
  // this function never persists it. draftToken never reaches the model —
  // it's structural context, same treatment as businessId for booking below.
  let draftBusiness: { id: string; slug: string; draftToken: string; url: string } | null =
    body?.draftBusiness &&
    typeof body.draftBusiness === "object" &&
    body.draftBusiness.id &&
    body.draftBusiness.draftToken &&
    body.draftBusiness.slug
      ? {
          id: String(body.draftBusiness.id),
          slug: String(body.draftBusiness.slug),
          draftToken: String(body.draftBusiness.draftToken),
          url: String(body.draftBusiness.url || `https://${body.draftBusiness.slug}.myhubly.app`),
        }
      : null;

  // Entry Intent is Patch Zero — applied as the floor, before whatever the
  // client's own accumulated understanding merges on top. This ordering
  // matters: if a client mistakenly resent entryIntent on a later turn, real
  // accumulated understanding still wins, since it's merged AFTER, never before.
  const entryIntent = body?.entryIntent && typeof body.entryIntent === "object" ? body.entryIntent : null;
  const clientUnderstanding =
    body?.understanding && typeof body.understanding === "object" ? body.understanding : {};
  const currentUnderstanding = adapter.merge(
    entryIntent ? adapter.merge({}, entryIntent) : {},
    clientUnderstanding,
  );

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
  let turnPatch: Record<string, unknown> = {};
  // "Let me take a look..."-style lines said before the final reply this
  // turn, in order — the client can render these as a natural pacing beat
  // ahead of the final message.
  const interimMessages: string[] = [];

  try {
    for (let round = 0; round < MAX_CAPABILITY_ROUNDS; round++) {
      const ai = await HublyAI.chat({
        feature: "hubly-conversation",
        system: buildSystemPrompt(context, adapter.merge(currentUnderstanding, turnPatch), latestUserMessage, draftBusiness),
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
        turnPatch = adapter.merge(turnPatch, decision.understanding.patch);
      }

      if (decision?.action === "invoke" && decision.capability && decision.capabilityAction) {
        const said = String(decision.message || "").trim();
        if (said) {
          history.push({ role: "assistant", content: said });
          interimMessages.push(said);
        }

        // Pure dispatch by name — no capability-specific logic here. If it
        // doesn't exist in the registry, that's reported honestly like any
        // other result, not special-cased. Dispatch-level half of the
        // two-point enforcement (see CONTEXT_CAPABILITY_ALLOWLIST): checked
        // here regardless of what the prompt advertised, so this context is
        // structurally bounded even if a decision somehow requests something
        // outside it.
        const capabilityName = String(decision.capability);
        const actionName = String(decision.capabilityAction);
        const allowedInContext = CONTEXT_CAPABILITY_ALLOWLIST[context].includes(capabilityName);
        const found = allowedInContext ? findAction(capabilityName, actionName) : undefined;
        // businessId is structural context, not something the model was ever
        // shown a real value for — it must never be trusted to transcribe a
        // UUID correctly. The engine injects the real one whenever it's known,
        // overriding whatever placeholder the model put in its own args.
        const dispatchArgs: Record<string, unknown> = { ...(decision.args || {}) };
        if (capabilityName === "booking" && businessId) {
          dispatchArgs.businessId = businessId;
        }
        // Same treatment as booking's businessId above: the model never sees
        // the real draftId/draftToken, so it can never be trusted to
        // transcribe them — the engine injects the real ones whenever a
        // draft already exists, overriding any placeholder the model put in.
        if (capabilityName === "business" && actionName === "updateDraft" && draftBusiness) {
          dispatchArgs.draftId = draftBusiness.id;
          dispatchArgs.draftToken = draftBusiness.draftToken;
        }
        const result = found
          ? await found.handler(dispatchArgs)
          : {
            ok: false,
            real: false,
            summary: allowedInContext
              ? "That capability or action does not exist."
              : "That capability is not available in this conversation.",
            error: allowedInContext ? "unknown_capability_action" : "capability_not_allowed_in_context",
          };

        // Capture the real draft identity the moment it exists — startDraft
        // returns it fresh; updateDraft just confirms it's still the same
        // draft. Either way, the response below must carry the current,
        // real value forward so the client can keep threading it.
        if (capabilityName === "business" && result.ok && result.real && result.raw) {
          const raw = result.raw as any;
          if (actionName === "startDraft" && raw.id && raw.draftToken && raw.slug) {
            draftBusiness = { id: String(raw.id), slug: String(raw.slug), draftToken: String(raw.draftToken), url: String(raw.url || "") };
          } else if (actionName === "updateDraft" && draftBusiness && raw.id) {
            draftBusiness = { ...draftBusiness, url: String(raw.url || draftBusiness.url) };
          }
        }

        actions.push({
          capability: capabilityName,
          capabilityAction: actionName,
          // draftToken is a write credential, not display data — never echo
          // it back inside the actions log even though the client already
          // has it (draftBusiness below is the one legitimate place it travels).
          args: dispatchArgs.draftToken ? { ...dispatchArgs, draftToken: "[redacted]" } : dispatchArgs,
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
        ...(adapter.isEmpty(turnPatch) ? {} : { understanding: { patch: turnPatch } }),
        ...(draftBusiness ? { draftBusiness } : {}),
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
      ...(adapter.isEmpty(turnPatch) ? {} : { understanding: { patch: turnPatch } }),
      ...(draftBusiness ? { draftBusiness } : {}),
    });
  } catch (err) {
    console.error("hubly-conversation error:", err);
    return jsonRes({ ok: false, error: "Hubly Conversation is temporarily unavailable." }, 502);
  }
});
