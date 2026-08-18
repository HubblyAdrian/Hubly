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
import { findAction, buildCapabilitiesPromptBlock, HUBLY_CAPABILITY_REGISTRY, rebuildDocumentFromRecord, documentHasOwnerEdits, type RecordChange, uploadDraftLogo, uploadDraftPhoto, uploadDraftHeroImage, applyDirectDocumentPatch, uploadAndPatchDocumentImage } from "../_shared/hubly_capability_registry.ts";
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

// The client renders every interimMessage and then `reply`. When the model
// announces a capability in one round ("Building the full page now, it'll
// appear in a moment") and then opens its final turn with the same sentence,
// the owner sees it twice, verbatim, seconds apart. It reads like the request
// fired twice.
//
// Deduped at the boundary rather than by asking the model not to repeat
// itself: the model cannot know what the client already displayed, and a rule
// it must carry across rounds is a rule it will eventually drop. Compared on
// normalised text so casing or trailing punctuation still collapses.
function normalizeForDedupe(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").replace(/[.!\u2026]+$/g, "").trim();
}

function dedupeConversationMessages(interim: string[], reply: string): { interim: string[]; reply: string } {
  const seen = new Set<string>();
  const keptInterim: string[] = [];
  for (const m of interim) {
    const key = normalizeForDedupe(m);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keptInterim.push(m);
  }
  const replyKey = normalizeForDedupe(reply);
  // The reply is dropped rather than the interim: the interim arrived first,
  // and was true when it arrived.
  return { interim: keptInterim, reply: replyKey && seen.has(replyKey) ? "" : reply };
}

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

// Legacy (pre-document-generation) template-picker directions — restored
// verbatim from main, not rewritten. Used only in LEGACY_WEBSITE_SECTION
// below, when HUBLY_DOCUMENT_GENERATION_ENABLED is off, so real businesses
// on the un-flagged path keep exactly the flow they have today; the
// underlying business.updateDraft heroHeadline/heroSubhead/layout/seoTitle
// fields this depends on were never removed from the capability registry,
// only superseded in the prompt by the newer document-generation text.
const LEGACY_LAYOUT_DIRECTIONS = `- premium-dark ("Premium Dark") — upscale, moody, dark
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

type ConversationContextName = "dashboard" | "customer" | "operate";

// Per docs/HUBLY_CONVERSATION_CONTEXT_MODEL.md Section 6: two enforcement
// points, not one. This list is the prompt-level advertisement (used below
// to filter what buildCapabilitiesPromptBlock shows); the SAME list is
// checked again at dispatch time, right before findAction() is ever called,
// so a context is bounded structurally — never just by what the prompt
// happened to omit.
const CONTEXT_CAPABILITY_ALLOWLIST: Record<ConversationContextName, string[]> = {
  dashboard: ["website", "online_presence", "business"],
  customer: ["booking"],
  // The authenticated owner operating their live business. First capability: storefront.
  // Booking-config / marketplace / services will join this same context later.
  operate: ["storefront"],
};


function getAllowedCapabilities(context: ConversationContextName) {
  const allow = new Set(CONTEXT_CAPABILITY_ALLOWLIST[context]);
  return HUBLY_CAPABILITY_REGISTRY.filter((c) => allow.has(c.name));
}

// Real AI website generation — merged to main but deliberately shipped
// dark. Nothing in this whole feature (generation, the styling layer, the
// designRationale prompting, the benchmark) has ever been exercised by a
// real customer; every verification pass has been a manual/test-harness
// call. A global, explicit env flag (not a per-business rollout tier,
// which wasn't scoped or asked for) is the deliberate switch for turning
// it on for real traffic, kept separate from the decision to merge the
// code. Unset/anything other than "true" = off, the safe default.
const DOCUMENT_GENERATION_ENABLED = (Deno.env.get("HUBLY_DOCUMENT_GENERATION_ENABLED") || "").trim() === "true";
const GATED_WEBSITE_ACTIONS = new Set(["generateDocument", "patchDocument"]);

/** Second half of the "advertise or don't" gate — strips the gated actions
 *  out of what the model is even told exists, same discipline as
 *  CONTEXT_CAPABILITY_ALLOWLIST already applies at the whole-capability
 *  level. Shallow-copies the "website" capability so the shared, global
 *  HUBLY_CAPABILITY_REGISTRY is never mutated. */
function withDocumentGenerationGate(capabilities: typeof HUBLY_CAPABILITY_REGISTRY) {
  if (DOCUMENT_GENERATION_ENABLED) return capabilities;
  return capabilities.map((c) =>
    c.name === "website" ? { ...c, actions: c.actions.filter((a) => !GATED_WEBSITE_ACTIONS.has(a.name)) } : c
  );
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
      : context === "operate"
      ? `You are Hubly, operating this business owner's live online Store for them. They talk to you in plain language — you make the real change to their catalog. Never require technical words like "SKU", "variant", or "publish status"; translate what they say into the right action. You are the same Hubly that also handles their website, booking, and business — but in this conversation your job is their Store, and only their Store.`
      : `You are Hubly — a conversational business partner, not a piece of software someone has to learn. You are the primary interface to the Hubly platform: every capability Hubly has should feel reachable by simply telling you what's needed, in plain conversation.

You are general-purpose. You are not an onboarding wizard and you must not behave like one. People may open a conversation with you for many different reasons — "I need help with my business", "help me build a website", "I want more customers", "I need a storefront", "help me price my services", or anything else. Respond to what the person actually asked for. Never force a scripted sequence of questions.

NOBODY COMES TO HUBLY BECAUSE THEY WANT SOFTWARE. They come because they need something accomplished — a website, a way to get booked, more customers, a storefront. Hear the actual goal underneath the literal request, not just the request itself: "I need a website" means "I want an online presence," not "open the website builder." Website, booking, CRM, marketing, reviews, storefront — none of these are the product. They're capabilities you reach for, quietly, whenever one genuinely serves the goal in front of you. Never organize a conversation around one of them by name, and never let the person experience Hubly as a set of modules to pick from. The requested outcome is the center of every conversation, from the first message. Business Understanding is what you naturally pick up while helping — it is never the reason you ask a question. If a question doesn't directly help move that outcome forward, don't ask it.

YOU ARE IN A CREATIVE SESSION, NOT CONFIGURING SOFTWARE. "capability", "action", "invoke" are internal machinery — they exist so you can do real things, they are never how you think or talk. Don't narrate them ("let me invoke the website capability") and don't think in their names either. Think the way a designer sitting next to someone thinks: we're designing, we're building, we're refining, we're publishing, we're growing. The person should feel like they're sitting beside someone building with them, not operating them.`;

  const learningSection =
    context === "customer"
      ? `LEARNING ABOUT THIS CUSTOMER
The conversation may already know something before you say anything — a click on a specific service or package, or details from a returning customer. Only ask for what's still unknown; never re-ask something already established. If nothing is known yet, ask naturally what they're looking for.`
      : context === "operate"
      ? `OPERATING THE STORE
You can: list what they're selling, create products, edit a product's name/price/description/stock, add and change variants (options like a "12-pack" or a "5 Gallon" size, each with its own price and stock), publish or hide products, organize products into collections, and turn the store on or set its headline.

SAFE BY DEFAULT — never assume "sell it" means "publish it". A product you create starts as a hidden DRAFT that customers cannot see. Only publish it (create it live, or setProductVisibility) when the owner EXPLICITLY says to put it on their store / make it available / start selling it. If they just say "add a soap for $49.99", create the draft and tell them it's saved but hidden, and that you'll publish it whenever they're ready. If they say "add a $49.99 soap and put it on my store", create it live.

NEVER GUESS WHICH ITEM. Before editing, publishing, hiding, or adding/changing a variant, know the exact catalog (listCatalog). If the name the owner used matches more than one product/collection/variant — or none — do NOT change anything: ask which one they mean, or say it doesn't exist and show what does. (The actions enforce this too, but ask naturally rather than letting an action bounce back.)

When they ask what they're selling, list the catalog plainly. Keep replies short — the owner sees the result on screen, so a few words is usually enough; don't narrate machinery. Only the Store is yours to operate in this conversation — if they ask about their website, booking, customers, or anything else, say that lives in another part of Hubly and you'll help with it there; never pretend to change it here.`
      : `LEARNING ABOUT A BUSINESS
Don't introduce Hubly capabilities, features, or a list of things you can help with until the person has described a real problem or goal in their own words — never infer one from their industry alone ("plumbing companies often need more calls" is not evidence; the person actually saying business is slow is).

When a question genuinely is the right move (see PRIORITY ORDER below — this is priority 3, the fallback, not the default), ask exactly ONE — the single question that would most change what you can create or do next. No fixed order and no script: don't default to the same question every time (e.g. never reflexively ask "are you just getting started?"). Optimize for discovering why they actually came to Hubly today — "what's the biggest challenge you're dealing with right now?" is often more valuable than a demographic fact like how long they've been in business — but choose based on the actual conversation in front of you, not a template.

You can also accept a website, a Google Business Profile link, a Facebook or Instagram page, uploaded photos or screenshots, or simply "starting from scratch" — all valid, never insist on one over another.

BUILDING A WEBSITE, LIVE — the one outcome you can fully build right now
INTRODUCTION VS REQUEST — get this right before you build anything.
Describing themselves is an INTRODUCTION. Stating what they want is a REQUEST.
  "I run a mobile dog grooming business in Lehi"            -> introduction -> offer choices
  "I want a website for my dog grooming business"           -> request -> build now
  "I need a storefront"                                      -> request -> build now
  "I run a dog grooming business and I don't have a website" -> request (they named the gap) -> build now
The test is whether they have expressed a WANT, not whether they said the word "website". "I run X" alone is an introduction. "I run X and I need / want / don't have Y" is a request for Y — build it.
When you are genuinely torn, ASK. One wrong build costs more than one question.
When it is an introduction, DO NOT ask permission — a yes/no question invites "no". Offer choices instead, which assumes you are doing something and asks only which: "Nice — dog grooming in Lehi. Want me to build you a website, set up online booking, or both?" Name back what they actually told you, then offer two or three real things you can do.
DO NOT open by asking for their business name. It is a form field, and they will wonder why you need it before you have shown them anything. Once they pick a direction, derive a name from what they said and build — ask for the real name later, or never, if they volunteer it while you work.
The moment it IS a request, build immediately with business.startDraft — no clarifying questions first, no asking what they would like it to look like. Anything you say before something appears on screen is a reason for them to leave. Refinement happens once they are looking at something real: that is when questions become welcome instead of expensive.
Never reply with advice about their website (headline suggestions, what a homepage "could" say, what would "work well" for their industry) while no site exists. Advice about a thing that does not exist is the worst answer available: it costs them a turn, shows them nothing, and is the reason people leave. On a REQUEST, build it and improve it with them. On an INTRODUCTION, offer choices — that is not advice, it is the next step. Either way, nothing that reads like consulting.
Inspiration comes AFTER something exists, never before it. Once a site is on screen you may ask once — like walking into a design studio: "Do you already have a website you like, a screenshot, a Pinterest board, or would you like me to suggest a few directions?" If they have something, that's what website.analyze is for, and you rebuild from it. Asking this BEFORE a site exists is the mistake that loses people: they answer a question instead of seeing their business. The very first time you ask (only that one turn — never again after), ALSO set a top-level "askInspiration":true in your JSON response. This is what shows real upload/link/"find inspiration for me" options on screen instead of the person having to type an answer — never set it on any other turn, and never on a turn where no site exists yet.

When a website.analyze result comes back real, let it actually shape what you build — not just which direction you happen to propose. Look at what genuinely came back in that CAPABILITY RESULT: a real brandColors entry becomes the brandColor you pass to business.startDraft/updateDraft, instead of a generic pick; real headline text (headlines) is a real signal for the heroHeadline you write — let it anchor your own words rather than defaulting to a generic line, though you should still write it yourself, not paste it verbatim if it doesn't fit their business; a real services list seeds business.setServices directly, not industry guesswork. Brand color, headline text, and services are the only three things actually read — only ever describe something as "from your reference" or "pulled from your site" for those three, never for anything else (font pairing, layout structure, imagery style are NOT captured by this, so never say or imply they were, even in passing — "matches their layout" or "captures the same feel" are claims you can't back up here). If the analyze result came back with none of those three meaningfully present — a failed fetch, an empty result, a screenshot with nothing legible — say so plainly and fall back to your own judgment the same way you would with no reference at all; never imply real inspiration shaped something it didn't.

${DOCUMENT_GENERATION_ENABLED ? `There is no template or direction to pick anymore — don't propose "a few directions" and don't describe archetypes. Website building now works like this: gather just enough (a real business name if you have it — "Your Business" as an honest placeholder is fine if you don't yet — the business type, and anything real from website.analyze above) and then build it for real:
${draftBusiness ? `- A draft already exists (${draftBusiness.url}). If no document exists yet on it, call website.generateDocument now. If one already exists, never call generateDocument again this conversation — any change, however small, goes through website.patchDocument instead (see below). business.updateDraft is still how name/tagline/about/phone/email/businessType/brandColor get captured as real business facts, independent of the page — but its heroHeadline/heroSubhead/layout fields no longer do anything meaningful once a document exists; don't set them.` : `- Call business.startDraft the moment you have a real or placeholder business name, in the SAME reply. Then call website.generateDocument in that same reply too — don't wait for a follow-up turn. Never call business.startDraft again this conversation.`}

website.generateDocument takes one thing: a rich "brief" — write it yourself, in full sentences, covering everything you actually know: the real business name and type, city, tone, and — critically — any REAL brandColors/headline text/services from a website.analyze result, cited as real (see above; only those three fields are real from analysis, never claim more). The richer the brief, the better the real page it produces — don't under-write it to save a sentence.

Once a document exists, EVERY change — a headline edit, a color change, adding or removing a section, moving something — goes through website.patchDocument with a plain-language instruction ("make the headline larger", "remove the FAQ section"). Never call generateDocument again to make an edit; that regenerates the whole page instead of changing the one thing asked for, which is the opposite of what should happen.` : `If not, propose 2-3 REAL, genuinely different visual directions from this actual list — describe each in your own words by its real character, never as "Option A/B/C" or a template name dump:
${LEGACY_LAYOUT_DIRECTIONS}
Whenever you propose directions like this, ALSO include a top-level "concepts" array in your JSON response — one entry per direction you just described, in the same order: {"id":"<the real layout id>","name":"<its real name>","character":"<a short phrase, your own words>"}. This is what puts something to actually look at on screen instead of just a paragraph to read — never omit it when you're presenting directions to choose from, and never include it any other time. Because the cards themselves carry the name and character, your "message" on this turn should be almost nothing — "A few directions:" or similar — never restate each one's description again in prose too; that's the exact redundancy showing real progress is supposed to replace.

The instant a direction is picked, build it for real — don't wait for a business name first. A real site with placeholder content beats a perfect question every time:
${draftBusiness ? `- A draft already exists (${draftBusiness.url}) — use business.updateDraft for anything new: name, tagline, about, contact info, a drafted headline/subhead, or a changed direction (layout). Never call business.startDraft again this conversation.` : `- Call business.startDraft the moment a direction is picked, in the SAME reply, even if you don't know the business name yet — use their real name if you already have it, otherwise pass "Your Business" as a placeholder (this is expected, not dishonest — a real, live, editable site with placeholder content is exactly right at this stage). Then keep calling business.updateDraft as you learn more (a real name replaces the placeholder the instant they give it, headline, subhead, about, contact info) — every real detail should show up there within the same reply it's learned.`}

Write real headline/subhead/about copy yourself (this is conversational value, priority 1) and pass it straight into business.updateDraft's heroHeadline/heroSubhead/about — don't just describe what you'd write, actually write it and put it on the site. Always include seoTitle too ("<Business Name> | <what they actually do>") — businessType only recognizes a handful of fixed categories (detailing, pressure_washing, landscaping, cleaning, photography, hvac, windows) and silently mislabels anything outside that list, so seoTitle is what keeps the real page title accurate for everything else. Only set businessType when it genuinely matches one of those categories — never force a fit.`}

The moment you know what services they offer — even roughly, even just one — call business.setServices with the complete real list (name, and price/description whenever actually given); this is a real business fact independent of the page, and feeds future generation/edits. seoTitle still matters — pass it via business.updateDraft ("<Business Name> | <what they actually do>") since businessType only recognizes a handful of fixed categories and silently mislabels anything outside that list.

The moment you know what services they offer — even roughly, even just one — call business.setServices with the complete real list (name, and price/description whenever actually given). Real service cards appear on the live site immediately; this is one of the highest-value single moments in the whole conversation, so don't wait to have all of them before calling it, and call it again with the fuller list as you learn more. Phone/email, once given, go straight into business.updateDraft's phone/email — they show up in the site's real contact line. There is no real place for business hours to live yet — never ask about them, and never invent a footer showing hours that don't actually exist anywhere.

Once services are set, ask if they already have a logo to upload — a real image file, not a description. This is the one thing you cannot build yourself in conversation (you can't invoke logo upload — the person has to attach the actual file), so when you ask this ONE time, ALSO set a top-level "askLogo":true on that reply so a real upload option appears on screen. Never ask again after the first time. Until they upload one, the header already shows their initials automatically — that's real and correct, not a gap to apologize for.

For every other outcome (booking, CRM, marketing, storefront), there is no live build yet — create real value in conversation (a draft, a plan, honest advice) and say plainly that the live workspace will show it once that part is built. Never imply something is appearing visually when it isn't.

WHEN IN DOUBT, SHOW PROGRESS OVER ASKING. If you're weighing another question against building/updating something real with what you already have, build it. An imperfect real draft is always the better move than a well-phrased question — they can refine a draft, but a conversation that feels like an interview loses them. This outranks the usual "ask exactly one question" guidance whenever the two conflict.

WHAT YOU JUST BUILT IS A STRUCTURE, NOT A FINISHED SITE. It has no logo, no photographs, no prices and no reviews — every one of those is a real gap a visitor would notice immediately. Never call it "your website" or "your new site" as though it were done. Say what it actually is and name what is missing, in the owner's own words: "That's the structure. It needs your logo, your photos and your prices — want to start with the logo?" Naming the gaps is not apologising, and it is not underselling the work. An owner who is told the truth about what they are looking at trusts the next thing you say.

While you're building or refining, keep what you say almost silent — a few words, or nothing at all ("On it." / "Done — take a look." / no message at all is fine too). The change on screen is the explanation. Don't narrate what you're about to do or describe what changed in prose — they can see it.

AFTER THE BUILD, YOU LEAD. The owner should never have to ask "what now?". Walk the gaps in this order, one at a time: logo, then photos, then services and prices.
- One gap per message. Never a list, never a menu of options, never "would you like A, B or C?".
- Every step is skippable and you say so: "or skip it and we'll do photos".
- After each change, say what visibly changed on the page, then move to the next gap unprompted.
- When a gap is already filled, skip it silently. Do not congratulate them on it.
- When they go off-list, follow them, finish what they asked, then return to where you were.
ONLY OFFER WHAT HUBLY CAN ACTUALLY DO. Logo, photos, services, prices, page copy, booking and the enquiry form are real. You have NO phone scripts, no ad copy, no email campaigns, no SMS, no social posting, no background colour or font control yet. If you find yourself proposing something outside that list, you are inventing a feature that does not exist — stop and return to the next gap. Never imply something is being built or will appear in the workspace unless it actually is (see PRIORITY ORDER and HONESTY above).`;

  // Selective, deterministic — never the whole Knowledge Base. Only meaningful
  // against Business Understanding today (its signals are keyed to that
  // schema's fields) — skipped honestly for "customer" rather than run
  // against a schema it wasn't built for. See _shared/hubly_capability_knowledge_loader.ts.
  const capabilityKnowledgeBlock =
    context === "customer" || context === "operate"
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
  const allowedCapabilities = withDocumentGenerationGate(getAllowedCapabilities(context));
  const capabilitiesBlock = allowedCapabilities.length
    ? buildCapabilitiesPromptBlock(allowedCapabilities)
    : "(No capabilities are registered for this context yet.)";

  return `${intro}

TONE
Warm, direct, and competent — like sitting down with an experienced designer, not filling out a form or reading a brochure. No corporate filler. Never say "as an AI". Keep it short — usually 1-3 sentences, often less. A reply that reads like documentation has already failed, no matter how accurate it is. When something you built is visible on screen, let it speak for itself rather than describing it back in words.

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
To invoke a capability action: {"action":"invoke","capability":"<capability name>","capabilityAction":"<action name>","args":{...matching that action's parameters...},"message":"<almost always a few words or empty — never a paragraph, see 'keep what you say almost silent' above>","understanding":{"patch":{...}}}
To reply normally: {"action":"reply","message":"<your full reply to the person>","understanding":{"patch":{...}},"concepts":[{"id":"...","name":"...","character":"..."}]}

"understanding" is optional on both — include it only when you learned something new this turn, matching the categories above (${adapter.categories.join(", ")}). "concepts" is optional and only ever appears on a "reply" — include it only when you're presenting real visual directions to choose from (see BUILDING A WEBSITE, LIVE above), omit it every other turn. "askInspiration" is optional, boolean, only on a "reply", only on the one turn you first ask about inspiration for a website. "askLogo" is the same shape, only on the one turn you first ask about an existing logo.

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
  const context: ConversationContextName =
    body?.context === "customer" ? "customer" : body?.context === "operate" ? "operate" : "dashboard";
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

  // Operate context: the authenticated owner operating their own claimed business. Verify
  // the owner's token AND that they own businessId before any storefront action can run.
  // The token becomes the write credential the storefront handlers use against the
  // owner-gated commerce-api — structural context, never shown to the model (same
  // treatment as booking's businessId / business's draftToken).
  let ownerToken: string | null = null;
  if (context === "operate") {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
    const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
    if (!token || !businessId || !supabaseUrl || !serviceKey) {
      return jsonRes({ ok: false, error: "This action needs you to be signed in to your business." }, 401);
    }
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { authorization: `Bearer ${token}`, apikey: serviceKey },
    });
    const userJson = await userRes.json().catch(() => null);
    const userId = userRes.ok && userJson?.id ? String(userJson.id) : null;
    if (!userId) return jsonRes({ ok: false, error: "You're not signed in." }, 401);
    const bizRes = await fetch(
      `${supabaseUrl}/rest/v1/businesses?id=eq.${encodeURIComponent(businessId)}&select=owner_id&limit=1`,
      { headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey } },
    );
    const bizRows = await bizRes.json().catch(() => null);
    const ownerId = Array.isArray(bizRows) && bizRows[0] ? String(bizRows[0].owner_id || "") : "";
    if (!ownerId || ownerId !== userId) {
      return jsonRes({ ok: false, error: "You don't have access to this business's store." }, 403);
    }
    ownerToken = token;
  }

  // Storefront Builder inputs (operate/storefront surface): the current storefront layout the
  // owner is editing + brand context, threaded to generate/patchStorefront. Never persisted here.
  const storefrontState = body?.storefrontState;
  const storeContext = body?.storeContext;

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
  // Seeded with entryIntent itself (Patch Zero) — entryIntent already floors
  // currentUnderstanding for THIS turn's prompt/dispatch, but a client only
  // ever sends it once (its first turn); if it weren't also included in the
  // returned patch, the client would never persist it into its own
  // accumulated understanding, and it would silently vanish on turn two even
  // though the model correctly acted on it here.
  let turnPatch: Record<string, unknown> = entryIntent ? adapter.merge({}, entryIntent) : {};
  // "Let me take a look..."-style lines said before the final reply this
  // turn, in order — the client can render these as a natural pacing beat
  // ahead of the final message.
  const interimMessages: string[] = [];
  // RE-RENDER IS AN EVENT, NOT A DECISION. Handlers that write real content
  // to the business record report it as raw.recordChange; this collects those
  // across the turn so exactly ONE rebuild fires at the end, however many
  // handlers ran. The model is never asked whether to rebuild, so the guard
  // against calling generateDocument twice stays intact.
  const recordChanges = new Set<string>();
  // #188: the customer-safe confirmation payload from a successful
  // booking.create this turn (WebsiteBookingConfirmation, see
  // hubly_booking_execution.ts) — the ONLY piece of a capability result's
  // `raw` that ever leaves this function. The rest of `raw` (job/customer
  // internal ids, the membership object, etc.) stays server-side; the
  // browser renders its confirmation card from this alone, never from the
  // model's own reply text.
  let bookingConfirmation: unknown = null;
  // The claim grant for a business created THIS turn. Curated onto the response
  // exactly like bookingConfirmation, and for the same reason: `raw` stays
  // server-side. This is the ONLY draft field that leaves — never draftToken,
  // which is a permanent bearer credential for an unclaimed business.
  let draftGrant: string | null = null;
  // Storefront Builder — the layout produced by generate/patchStorefront, surfaced to the
  // editor so it can apply it to the live preview and publish it. Presentation only.
  let storefrontAstOut: unknown = undefined;

  // Logo upload is client-triggered, not model-decided — see uploadDraftLogo's
  // own comment for why. Dispatched directly here, then folded into history
  // as a normal CAPABILITY RESULT so the model narrates it exactly like any
  // capability it did choose to invoke — same convention, different trigger.
  const logoUpload =
    body?.logoUpload && typeof body.logoUpload === "object" && typeof body.logoUpload.imageBase64 === "string"
      ? { imageBase64: body.logoUpload.imageBase64, mediaType: String(body.logoUpload.mediaType || "image/png") }
      : null;
  if (logoUpload) {
    const logoResult = await uploadDraftLogo(
      draftBusiness?.id || "",
      draftBusiness?.draftToken || "",
      logoUpload.imageBase64,
      logoUpload.mediaType,
    );
    actions.push({ capability: "business", capabilityAction: "setLogo", args: {}, ok: !!logoResult.ok, real: !!logoResult.real });
    history.push({
      role: "system",
      content: `CAPABILITY RESULT for business.setLogo: ${JSON.stringify(logoResult)}\nOnly report what "summary" and "raw" actually show. Do not claim anything beyond this.`,
    });
  }

  // Same shape as logoUpload, and for the same reason: the bytes come straight
  // from the client and never through the model. A photo lands in storage and
  // in portfolio_photos, which loadBusinessRecord reads -- so it reaches the
  // generator, and its recordChange rebuilds the page around it.
  const photoUpload =
    body?.photoUpload && typeof body.photoUpload === "object" && typeof body.photoUpload.imageBase64 === "string"
      ? { imageBase64: body.photoUpload.imageBase64, mediaType: String(body.photoUpload.mediaType || "image/jpeg") }
      : null;
  if (photoUpload && draftBusiness?.id && draftBusiness?.draftToken) {
    const photoResult = await uploadDraftPhoto(
      draftBusiness.id,
      draftBusiness.draftToken,
      photoUpload.imageBase64,
      photoUpload.mediaType,
    );
    actions.push({ capability: "business", capabilityAction: "addPhoto", args: {}, ok: !!photoResult.ok, real: !!photoResult.real, summary: photoResult.summary });
    try {
      const rc = (photoResult as { raw?: { recordChange?: unknown } })?.raw?.recordChange;
      if (Array.isArray(rc)) for (const c of rc) if (typeof c === "string") recordChanges.add(c);
    } catch (_e) { /* never fail a turn on instrumentation */ }
  }

  // Inline canvas edit — click headline/subhead/hero-image directly inside
  // the live preview and save. Same registry action(s) as chat
  // (business.updateDraft / the same image-upload path as the logo), same
  // security — just a different trigger. Short-circuits before the model
  // loop entirely: the person already supplied the exact value themselves
  // (typed it, or picked a file), so there's nothing for the model to
  // decide. No chat message, no LLM call — the canvas update is the whole
  // response.
  const DIRECT_EDIT_TEXT_FIELDS = new Set(["heroHeadline", "heroSubhead"]);
  const directEdit =
    body?.directEdit && typeof body.directEdit === "object" &&
    typeof body.directEdit.field === "string" && DIRECT_EDIT_TEXT_FIELDS.has(body.directEdit.field) &&
    typeof body.directEdit.value === "string"
      ? { field: String(body.directEdit.field), value: String(body.directEdit.value) }
      : null;
  const directImageEdit =
    body?.directImageEdit && typeof body.directImageEdit === "object" &&
    body.directImageEdit.field === "heroImage" && typeof body.directImageEdit.imageBase64 === "string"
      ? { imageBase64: String(body.directImageEdit.imageBase64), mediaType: String(body.directImageEdit.mediaType || "image/png") }
      : null;

  // Same short-circuit family, generalized to any node in a Hubly Document
  // instead of the three hardcoded legacy fields above — a click already
  // supplies the exact target id and new value, so there's nothing for a
  // model to decide here either.
  const DIRECT_DOC_OPS = new Set(["update_text", "update_attrs"]);
  const directDocumentPatch =
    body?.directDocumentPatch && typeof body.directDocumentPatch === "object" &&
    typeof body.directDocumentPatch.op === "string" && DIRECT_DOC_OPS.has(body.directDocumentPatch.op) &&
    typeof body.directDocumentPatch.id === "string" && body.directDocumentPatch.id
      ? {
          op: String(body.directDocumentPatch.op),
          id: String(body.directDocumentPatch.id),
          ...(typeof body.directDocumentPatch.text === "string" ? { text: String(body.directDocumentPatch.text) } : {}),
          ...(body.directDocumentPatch.attrs && typeof body.directDocumentPatch.attrs === "object" ? { attrs: body.directDocumentPatch.attrs } : {}),
        }
      : null;
  // Image replacement needs a real upload before it's a patch — same
  // click-already-supplies-everything shape, one extra real step.
  const directDocumentImageEdit =
    body?.directDocumentImageEdit && typeof body.directDocumentImageEdit === "object" &&
    typeof body.directDocumentImageEdit.id === "string" && body.directDocumentImageEdit.id &&
    typeof body.directDocumentImageEdit.imageBase64 === "string"
      ? {
          id: String(body.directDocumentImageEdit.id),
          imageBase64: String(body.directDocumentImageEdit.imageBase64),
          mediaType: String(body.directDocumentImageEdit.mediaType || "image/png"),
        }
      : null;

  if (directEdit || directImageEdit || directDocumentPatch || directDocumentImageEdit) {
    if (!draftBusiness) {
      return jsonRes({ ok: false, error: "no_draft_to_edit" }, 400);
    }
    // Click-to-edit only ever operates on an already-generated document, so
    // this path can't structurally be reached while the feature is dark —
    // but checked explicitly anyway, same discipline as the other two
    // enforcement points, not relying on that precondition alone.
    if ((directDocumentPatch || directDocumentImageEdit) && !DOCUMENT_GENERATION_ENABLED) {
      return jsonRes({ ok: false, error: "document_generation_disabled" }, 400);
    }
    let result: { ok: boolean; real: boolean; summary: string; raw?: unknown; error?: string };
    let actionName: string;
    let isDocumentAction = false;
    if (directEdit) {
      actionName = "updateDraft";
      const found = findAction("business", "updateDraft");
      result = found
        ? await found.handler({ draftId: draftBusiness.id, draftToken: draftBusiness.draftToken, [directEdit.field]: directEdit.value })
        : { ok: false, real: false, summary: "That action is not available.", error: "unknown_action" };
    } else if (directImageEdit) {
      actionName = "setHeroImage";
      result = await uploadDraftHeroImage(draftBusiness.id, draftBusiness.draftToken, directImageEdit.imageBase64, directImageEdit.mediaType);
    } else if (directDocumentImageEdit) {
      isDocumentAction = true;
      actionName = "patchDocument";
      result = await uploadAndPatchDocumentImage(draftBusiness.id, draftBusiness.draftToken, directDocumentImageEdit.id, directDocumentImageEdit.imageBase64, directDocumentImageEdit.mediaType);
    } else {
      isDocumentAction = true;
      actionName = "patchDocument";
      result = await applyDirectDocumentPatch(draftBusiness.id, draftBusiness.draftToken, directDocumentPatch!);
    }
    return jsonRes({
      ok: true,
      reply: "",
      messages: incoming,
      actions: [{ capability: isDocumentAction ? "website" : "business", capabilityAction: actionName, args: {}, ok: !!result.ok, real: !!result.real }],
      interimMessages: [],
      draftBusiness,
    });
  }

  try {
    for (let round = 0; round < MAX_CAPABILITY_ROUNDS; round++) {
      const ai = await HublyAI.chat({
        feature: "hubly-conversation",
        system: buildSystemPrompt(context, adapter.merge(currentUnderstanding, turnPatch), latestUserMessage, draftBusiness),
        messages: history,
        jsonMode: true,
        // 900 was survivable while this decision was "pick a capability and
        // fill two obvious fields". It stopped being survivable once
        // startDraft began asking the model to choose a palette from an
        // annotated list of eight AND reason about what the business should
        // lead with: gpt-5.5 is a REASONING model, hidden reasoning tokens
        // come out of this same budget, and an exhausted budget returns an
        // empty completion that fails JSON.parse and surfaces as a 502.
        //
        // Exactly the failure hubly_ai.ts already documents twice --
        // hubly-intent-classify needed 600 minimum for a THREE-field JSON,
        // and document_generate hit it at a 6000-token cap. The tells were
        // that "hello" returned 200 while every build request failed, and
        // that two of three builds in one round succeeded: an outage does
        // not pick and choose, a marginal token budget does.
        maxTokens: 2500,
        reasoningEffort: "low",
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
        // Third enforcement point, same discipline as the two documented
        // above: generateDocument/patchDocument are structurally blocked
        // here regardless of what the prompt advertised or what a decision
        // requests, whenever the feature is shipped dark.
        const isGatedDocAction = capabilityName === "website" && GATED_WEBSITE_ACTIONS.has(actionName);
        const found = allowedInContext && !(isGatedDocAction && !DOCUMENT_GENERATION_ENABLED) ? findAction(capabilityName, actionName) : undefined;
        // businessId is structural context, not something the model was ever
        // shown a real value for — it must never be trusted to transcribe a
        // UUID correctly. The engine injects the real one whenever it's known,
        // overriding whatever placeholder the model put in its own args.
        const dispatchArgs: Record<string, unknown> = { ...(decision.args || {}) };
        if (capabilityName === "booking" && businessId) {
          dispatchArgs.businessId = businessId;
          // Structural, engine-decided execution target — never something
          // the model sees or controls (same treatment as businessId just
          // above). "customer" is the Website Concierge context today; the
          // only other context able to reach "booking" at all is a future
          // Marketplace context, not yet defined (see
          // CONTEXT_CAPABILITY_ALLOWLIST) — until one exists, "customer"
          // unambiguously means a business's own website.
          dispatchArgs.bookingChannel = context === "customer" ? "website" : "marketplace";
        }
        // Storefront actions run as the authenticated owner: inject the verified businessId
        // and the owner's token (the write credential for commerce-api). Neither is ever
        // shown to the model; _ownerToken is redacted from the actions log below.
        if (capabilityName === "storefront" && businessId) {
          dispatchArgs.businessId = businessId;
          if (ownerToken) dispatchArgs._ownerToken = ownerToken;
          // Storefront Builder: the current storefront layout the owner is editing + brand
          // context, injected so generate/patchStorefront work on the live config. Never
          // shown to the model; omitted from the actions log below.
          if (storefrontState !== undefined) dispatchArgs._storefrontAst = storefrontState;
          if (storeContext && typeof storeContext === "object") {
            dispatchArgs._businessName = (storeContext as Record<string, unknown>).businessName;
            dispatchArgs._accent = (storeContext as Record<string, unknown>).accent;
          }
        }
        // Same treatment as booking's businessId above: the model never sees
        // the real draftId/draftToken, so it can never be trusted to
        // transcribe them — the engine injects the real ones whenever a
        // draft already exists, overriding any placeholder the model put in.
        const NEEDS_DRAFT_INJECTION =
          (capabilityName === "business" && (actionName === "updateDraft" || actionName === "setServices")) ||
          (capabilityName === "website" && (actionName === "generateDocument" || actionName === "patchDocument"));
        if (NEEDS_DRAFT_INJECTION && draftBusiness) {
          dispatchArgs.draftId = draftBusiness.id;
          dispatchArgs.draftToken = draftBusiness.draftToken;
        }
        // Real page generation can run well past what a single request
        // should block on (confirmed live: 100-150+s, right at/over
        // Supabase's function timeout). generateDocument specifically runs
        // as a background task instead of being awaited here — the
        // capability result returned THIS turn is honestly "started", not
        // "done" (see its description in the registry, which the model
        // reads and is expected to say something honest about, like
        // "building now" rather than declaring it finished). The client
        // polls business_documents (already publicly readable) until the
        // real version appears.
        let result;
        if (capabilityName === "website" && actionName === "generateDocument" && found) {
          const bgTask = found.handler(dispatchArgs);
          bgTask.catch((e) => console.error("background generateDocument failed", e));
          try {
            // EdgeRuntime is a Supabase Edge Functions / Deno Deploy global,
            // not in the standard lib types.
            // deno-lint-ignore no-explicit-any
            const rt = (globalThis as any).EdgeRuntime;
            if (rt && typeof rt.waitUntil === "function") rt.waitUntil(bgTask);
          } catch (_e) { /* best effort — bgTask still runs either way, just not guaranteed past response if this fails */ }
          result = {
            ok: true,
            real: false,
            summary: "Real page generation started in the background — this takes about a minute to produce a complete, real page. It will appear as soon as it's ready.",
            raw: { status: "building" },
          };
        } else {
          result = found
            ? await found.handler(dispatchArgs)
            : {
              ok: false,
              real: false,
              summary: allowedInContext
                ? "That capability or action does not exist."
                : "That capability is not available in this conversation.",
              error: allowedInContext ? "unknown_capability_action" : "capability_not_allowed_in_context",
            };
        }

        // Capture the real draft identity the moment it exists — startDraft
        // returns it fresh; updateDraft just confirms it's still the same
        // draft. Either way, the response below must carry the current,
        // real value forward so the client can keep threading it.
        if (capabilityName === "business" && result.ok && result.real && result.raw) {
          const raw = result.raw as any;
          if (actionName === "startDraft" && raw.id && raw.draftToken && raw.slug) {
            draftBusiness = { id: String(raw.id), slug: String(raw.slug), draftToken: String(raw.draftToken), url: String(raw.url || "") };
          } else if ((actionName === "updateDraft" || actionName === "setServices") && draftBusiness && raw.id) {
            draftBusiness = { ...draftBusiness, url: String(raw.url || draftBusiness.url) };
          }
        }

        try {
          const rc = (result as { raw?: { recordChange?: unknown } } | null)?.raw?.recordChange;
          if (Array.isArray(rc)) for (const c of rc) if (typeof c === "string") recordChanges.add(c);
        } catch (_e) { /* instrumentation must never fail a turn */ }

        actions.push({
          capability: capabilityName,
          capabilityAction: actionName,
          // draftToken is a write credential, not display data — never echo
          // it back inside the actions log even though the client already
          // has it (draftBusiness below is the one legitimate place it travels).
          args: (() => {
            if (!dispatchArgs.draftToken && !dispatchArgs._ownerToken && dispatchArgs._storefrontAst === undefined) return dispatchArgs;
            const a: Record<string, unknown> = { ...dispatchArgs };
            if (a.draftToken) a.draftToken = "[redacted]";
            if (a._ownerToken) a._ownerToken = "[redacted]";
            if (a._storefrontAst !== undefined) a._storefrontAst = "[omitted]";
            return a;
          })(),
          ok: !!result.ok,
          real: !!result.real,
        });

        // #188: pluck ONLY the confirmation payload out of a successful
        // website booking — never the whole raw result.
        if (
          capabilityName === "booking" && actionName === "create" &&
          result.ok && result.real && result.raw &&
          typeof result.raw === "object" && "confirmation" in (result.raw as Record<string, unknown>)
        ) {
          bookingConfirmation = (result.raw as Record<string, unknown>).confirmation;
        }

        // A draft was created this turn — hand the browser its 10-minute claim
        // grant so it can be exchanged for an httpOnly cookie. Reads ONLY
        // draftGrant out of raw; draftToken sits beside it in the same object
        // and must never be surfaced.
        if (
          result.ok && result.real && result.raw &&
          typeof result.raw === "object" &&
          "draftGrant" in (result.raw as Record<string, unknown>)
        ) {
          const g = (result.raw as Record<string, unknown>).draftGrant;
          if (typeof g === "string" && g) draftGrant = g;
        }

        // Storefront Builder — surface the generated/patched layout to the editor.
        if (
          capabilityName === "storefront" &&
          (actionName === "generateStorefront" || actionName === "patchStorefront") &&
          result.ok && result.raw && typeof result.raw === "object" &&
          "storefrontAst" in (result.raw as Record<string, unknown>)
        ) {
          storefrontAstOut = (result.raw as Record<string, unknown>).storefrontAst;
        }

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
      // Real layout ids/names the model actually named this turn — never
      // synthesized here. Malformed or missing entries are dropped rather
      // than guessed at.
      const concepts = Array.isArray(decision?.concepts)
        ? decision.concepts
            .filter((c: any) => c && typeof c.id === "string" && typeof c.name === "string")
            .map((c: any) => ({ id: c.id, name: c.name, character: typeof c.character === "string" ? c.character : "" }))
            .slice(0, 4)
        : [];
      // THE LOOP CLOSES HERE. Real content landed on the record this turn, so the
      // page is rebuilt from it -- once, in the background, whatever combination of
      // handlers ran. Fire-and-forget for the same reason generateDocument is: a
      // real generation runs well past what a request should block on.
      //
      // rebuildDocumentFromRecord refuses if the owner has hand-edited the page,
      // and downgrades to a cheap re-render for cosmetic-only changes.
      // THE LOOP CLOSES HERE. Real content landed on the record this turn, so the
      // page is rebuilt from it -- once, in the background, whatever combination of
      // handlers ran.
      //
      // The owner-edit check runs SYNCHRONOUSLY, before this turn replies, because
      // a skip has to be something the owner is told rather than something logged
      // where nobody looks. Refusing to overwrite their edits is right; refusing
      // silently is the swallow-failure shape from KNOWN_ISSUES -- they would add
      // services later, the record would update, the page would not, and there
      // would be no signal at all.
      let rebuildSkippedNote = "";
      if (recordChanges.size && draftBusiness?.id && draftBusiness?.draftToken) {
        const changes = [...recordChanges] as RecordChange[];
        const contentful = changes.some((c) => c !== "cosmetic");
        const ownerEdited = contentful ? await documentHasOwnerEdits(draftBusiness.id) : false;
        if (ownerEdited) {
          rebuildSkippedNote =
            " Your page has manual edits, so I have not rebuilt it — the new details are saved on your record. Want me to rebuild the page around them?";
        } else {
          const rebuild = rebuildDocumentFromRecord(draftBusiness.id, draftBusiness.draftToken, changes)
            .then((r) => console.log(`record rebuild [${draftBusiness.id}] ${changes.join(",")} -> ${r.status}${r.detail ? " (" + r.detail + ")" : ""}`))
            .catch((e) => console.error("record rebuild failed", e));
          try {
            const rt = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
            if (rt && typeof rt.waitUntil === "function") rt.waitUntil(rebuild);
          } catch (_e) { /* best effort — it still runs, just not guaranteed past the response */ }
        }
      }

      const deduped = dedupeConversationMessages(interimMessages, finalText);
      return jsonRes({
        ok: true,
        // rebuildSkippedNote is empty unless a rebuild was refused over the
        // owner's manual edits, in which case they are told and offered one.
        reply: (deduped.reply || "") + rebuildSkippedNote,
        messages: history,
        actions,
        interimMessages: deduped.interim,
        ...(concepts.length ? { concepts } : {}),
        ...(decision?.askInspiration === true ? { askInspiration: true } : {}),
        ...(decision?.askLogo === true ? { askLogo: true } : {}),
        ...(adapter.isEmpty(turnPatch) ? {} : { understanding: { patch: turnPatch } }),
        ...(draftBusiness ? { draftBusiness } : {}),
        ...(bookingConfirmation ? { bookingConfirmation } : {}),
        ...(draftGrant ? { draftGrant } : {}),
        ...(storefrontAstOut !== undefined ? { storefrontAst: storefrontAstOut } : {}),
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
      ...(bookingConfirmation ? { bookingConfirmation } : {}),
      ...(draftGrant ? { draftGrant } : {}),
        ...(storefrontAstOut !== undefined ? { storefrontAst: storefrontAstOut } : {}),
    });
  } catch (err) {
    console.error("hubly-conversation error:", err);
    return jsonRes({ ok: false, error: "Hubly Conversation is temporarily unavailable." }, 502);
  }
});
