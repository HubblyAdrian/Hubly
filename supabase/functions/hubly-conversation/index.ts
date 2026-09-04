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
import { dedupeConversationMessages } from "../_shared/hubly_dedupe.ts";
import { extractByPattern, extractPricedServices, extractRecordFacts, mergeFacts, mergePricedServices, messageHasPriceSignal } from "../_shared/hubly_extract.ts";
import { adminHeaders, requireSecretKey } from "../_shared/supabase_admin.ts";
import { reportAllowlistDrops } from "../_shared/hubly_allowlist.ts";
import { findAction, buildCapabilitiesPromptBlock, HUBLY_CAPABILITY_REGISTRY, applyExtractedFacts, startDocumentBuildJob, dispatchDocumentBuild, latestDocumentBuildJob, rebuildDocumentFromRecord, documentHasOwnerEdits, applyContactHoursToFreeform, composeContactHoursTruth, applyOwnerRecordEdit, applyOwnerDesignEdit, applyOwnerStyleEdit, applyOwnerSectionMove, applyOwnerNodeMove, applyOwnerNodeDelete, restampFreeformPage, readOwnerDesignKnobs, type OwnerRecordEdit, type RecordChange, uploadDraftLogo, uploadDraftPhoto, uploadDraftHeroImage, applyDirectDocumentPatch, uploadAndPatchDocumentImage, applyDirectFreeformEdit, uploadAndPatchFreeformImage, planFreeformRegeneration, resolveOwnerSelection, type OwnerSelectionContext } from "../_shared/hubly_capability_registry.ts";
import { type NodeAddress } from "../_shared/hubly_freeform.ts";
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

/** Ownership check for a read-only owner request (the design controls opening).
 *  Reads through the service role and compares owner_id to the VERIFIED uid — the same
 *  authorise-by-ownership rule the writers use, applied to a read, so the knob inventory
 *  of someone else's page is never returned. */
async function ownsBusiness(businessId: string, ownerUid: string): Promise<boolean> {
  try {
    const url = (Deno.env.get("SUPABASE_URL") || "").trim();
    if (!url) return false;
    const r = await fetch(`${url}/rest/v1/businesses?id=eq.${encodeURIComponent(businessId)}&select=owner_id&limit=1`, { headers: adminHeaders() });
    if (!r.ok) return false;
    const rows = await r.json().catch(() => null);
    const row = Array.isArray(rows) ? rows[0] : null;
    return !!row && String(row.owner_id || "") === String(ownerUid);
  } catch { return false; }
}

/** Owner-facing names for the record fields, for the change read-back (guard 2).
 *  "phone is now …" not "phone: …" — the sentence is spoken to a person. */
const OWNER_FACT_LABEL: Record<string, string> = {
  phone: "your phone number",
  email: "your email",
  address: "your address",
  city: "your city",
  state: "your state",
  serviceAreaCities: "your service area",
  travelRadiusMiles: "your travel radius",
  yearsInBusiness: "your years in business",
  hoursNote: "your hours note",
};

/**
 * IS THIS MESSAGE WORTH AN EXTRACTION PASS?
 *
 * The old answer was `length >= 25 && gaps.missing`, and both halves were wrong.
 *
 * `gaps.missing` asked WHICH FIELDS ARE EMPTY when the real question is DOES THIS
 * MESSAGE CONTAIN A FACT. It also silently made facts uncapturable once six other
 * fields filled — measured across the corpus, 0 of 149 businesses have ever closed
 * it, so it protected nothing and would have started dropping hours, hours notes
 * and prose-stated services the moment one did. Gone.
 *
 * The 25-character floor dropped every short fact: "Sat 9-1", "801-555-0134",
 * "I do lawn care in provo".
 *
 * WHY THIS ENUMERATES THE HARMLESS SIDE. The obvious replacement — a list of things
 * that look like a fact — was measured against 125 real messages and lost 52 of
 * them, because the highest-value facts (a city, a service list) are prose with no
 * money, no digits, no "@". A second attempt listing first-person assertion
 * phrasings ("I run", "we do") lost 28, missing "Im looking to", "I give lessons in
 * lehi utah", "I'm a nail tech". Both failed the same way and it is the same way
 * the anchor count, the price scan and the hours detector failed before them: a
 * list of forms undercounts the fact, because the fact wears a form nobody listed.
 *
 * So this enumerates the side where being wrong is cheap. An acknowledgement cannot
 * carry a fact; everything else might. A missing entry in this list costs one
 * wasted pass (~670 tokens, low effort); a missing entry in the other list costs a
 * fact the owner stated and a page that ships without it. Measured cost of the
 * inversion: 122 of 125 messages fire vs 93 today (+31%), and it drops nothing.
 */
const ACK_ONLY = new Set([
  "y", "yes", "yep", "yeah", "ya", "ok", "okay", "k", "kk", "sure", "thanks", "thank you", "ty",
  "no", "nope", "nah", "done", "perfect", "great", "nice", "cool", "looks good", "love it",
  "like it", "do it", "go ahead", "sounds good", "please do", "that works", "correct", "right",
  "yes please", "no thanks", "continue", "next", "stop", "wait", "hi", "hello", "hey",
]);
function worthExtracting(message: string): boolean {
  const raw = String(message || "").trim();
  if (!raw) return false;
  // An acknowledgement is the one shape that cannot carry a fact — but only when it
  // is the WHOLE message. "yes, and my number is 801-555-0134" is not an ack.
  const norm = raw.toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, " ").replace(/\s+/g, " ").trim();
  return !ACK_ONLY.has(norm);
}

/**
 * What the post-build ask must be BUILT FROM: the services actually on record.
 *
 * The ask-gate used to read NOTHING. `event === "post_build"` injected one fixed
 * instruction — "name the services and ask what they charge for each" — whatever
 * the record held, and the conversation model never sees the business record
 * (buildBusinessRecordBlock is only ever assembled for document GENERATION). So
 * an owner who opened with "Prices: Chimney Sweep $180, Cap Install $240, Level 2
 * Inspection $320" had all three saved with their prices, watched them appear on
 * the page, and was then asked what he charges. Measured live 2026-09-02 on two
 * drafts: one got the flat re-ask, the other "are those prices still $180, $240
 * and $320?" — same gate, same state, and which one an owner got was luck.
 *
 * Asking for what someone just gave is the worst version of not listening, so
 * the ask is now composed from what is known (the standing rule: never ask for
 * what you were told). Fails OPEN in the honest direction — if the read fails we
 * cannot claim prices are on record, so we fall back to the unpriced ask.
 */
async function selectServicesForAsk(businessId: string): Promise<{ names: string[]; unpriced: string[]; known: boolean }> {
  try {
    const url = (Deno.env.get("SUPABASE_URL") || "").trim();
    if (!url) return { names: [], unpriced: [], known: false };
    const res = await fetch(`${url}/rest/v1/services?select=name,price&business_id=eq.${businessId}`, { headers: adminHeaders() });
    if (!res.ok) return { names: [], unpriced: [], known: false };
    const rows = await res.json();
    if (!Array.isArray(rows)) return { names: [], unpriced: [], known: false };
    const named = rows.map((r) => ({ name: String(r?.name || "").trim(), price: Number(r?.price) }))
      .filter((r) => r.name);
    return {
      names: named.map((r) => r.name),
      // A price of 0 is "not stated", not free — the same reading the extractor uses.
      unpriced: named.filter((r) => !(isFinite(r.price) && r.price > 0)).map((r) => r.name),
      known: true,
    };
  } catch {
    return { names: [], unpriced: [], known: false };
  }
}

/**
 * Persist ONE display turn — the person's message and Hubly's final reply — to
 * business_conversations, so the conversation survives a reload (Block 3).
 *
 * DISPLAY turn, not model context: `history`/the returned `messages` is truncated
 * to MAX_HISTORY and padded with injected system CAPABILITY RESULT lines, so it
 * is the wrong thing to store. We store what the person actually saw: their own
 * message (a string or a photo-parts array, kept verbatim) and the final
 * natural-language reply. Interim status and the build-steps card are never
 * persisted.
 *
 * The RPC allocates seq itself under a per-business lock, so this is safe against
 * two tabs or a retry. service_role only; the browser never reaches it. Awaited
 * before the response so a recycled isolate can't drop the write; a failure here
 * is logged, never fatal to the reply.
 */
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

// Real AI website generation, behind one global env flag. Unset/anything other
// than "true" = off, the safe default.
//
// IT IS CURRENTLY ON. `HUBLY_DOCUMENT_GENERATION_ENABLED` is set to "true" in
// production — verified on 2026-08-20 against the platform secrets API, whose
// hash for this variable matches sha256("true") exactly. This comment used to
// say the feature was "shipped dark" and that nothing here had ever been
// exercised by a real customer; both stopped being true when the flag was
// turned on, and the comment kept saying it. A comment describing a state the
// system has left is worse than no comment, because it is read as current.
//
// If you turn the flag off, say so HERE. The three enforcement points below are
// only as honest as this line.
const DOCUMENT_GENERATION_ENABLED = (Deno.env.get("HUBLY_DOCUMENT_GENERATION_ENABLED") || "").trim() === "true";
// Every website action that creates or rewrites a stored page. setChrome is
// here because it re-renders a Document, so it is meaningless without one;
// newPage because it generates a whole freeform page, which is the single most
// expensive and most destructive thing this capability can do.
//
// ADDING A WEBSITE ACTION? It is NOT gated unless its name is in this set, and
// nothing used to say so — newPage was advertised, dispatchable and reachable
// with the flag off. The audit below now names anything that falls through.
// setDesignKnob is gated for the same reason setChrome is: it rewrites a STORED page and
// is meaningless without one. It is much cheaper and fully reversible, so the argument for
// leaving it live is real — but "the deployment has page generation switched off" and "the
// owner can still restyle the page" should not both be true, and an ungated action would
// be advertised to the model in a deployment that has no pages to change.
const GATED_WEBSITE_ACTIONS = new Set(["generateDocument", "patchDocument", "setChrome", "newPage", "setDesignKnob", "restyleElement"]);

/**
 * Actions the engine injects the RESOLVED SELECTION into — the chip in the composer,
 * checked against the stored page (see resolveOwnerSelection) before it gets here.
 *
 * Its own list rather than a rider on DRAFT_INJECTED_ACTIONS, because the two answer
 * different questions: that one is "does this need the draft's credentials", this one
 * is "does this act on the thing the owner has selected". restyleElement REFUSES
 * without it (there is no element to change and it will not pick one); patchDocument
 * narrows to it when present and edits the whole page when it is not, which is the
 * behaviour that existed before the chip.
 */
const SELECTION_INJECTED_ACTIONS = new Set([
  "website.restyleElement",
  "website.patchDocument",
]);

/**
 * Actions the engine injects the real draftId/draftToken into. The model never
 * sees those values, so an action absent from this set reaches its handler with
 * nothing and returns "missing_draft" — indistinguishable, from the outside,
 * from "this conversation has no draft business". That is exactly what
 * `website.newPage` did: picked correctly by the model on the first attempt,
 * and answered with a confident, wrong "there isn't a draft business connected
 * to this conversation."
 */
const DRAFT_INJECTED_ACTIONS = new Set([
  "business.updateDraft",
  "business.setServices",
  "website.generateDocument",
  "website.patchDocument",
  "website.newPage",
  // Found by the audit below on the day it was written, and seen failing in a
  // real conversation: the model called setChrome, got no credentials, and told
  // the owner "I couldn't change the header controls in this conversation".
  // Its handler reads args.draftId but its argsSchema does not declare one,
  // which is why a schema-only check reported it as fine.
  "website.setChrome",
  // Design knobs (2026-09-02). Needs draftId + draftToken + the verified ownerUid: a
  // knob writes into the STORED page, so it takes the claimed-owner branch of
  // create_business_document and is meaningless — and correctly refused — without a
  // verified owner. Same shape as setChrome: the handler reads draftId, the schema
  // doesn't declare it, so only the source-based audit below would have caught a miss.
  "website.setDesignKnob",
  // Restyle-the-selected-element (2026-09-04). Same shape as setDesignKnob: the
  // handler reads draftId/draftToken/ownerUid, the schema declares none of them, so
  // only the source-based audit below would catch a miss. It writes a new document
  // version, so it is meaningless — and correctly refused — without a verified owner.
  "website.restyleElement",
]);

/**
 * BOOT-TIME AUDIT OF THE TWO ALLOW-LISTS ABOVE.
 *
 * Both are hardcoded name lists, and both have silently dropped a new entry.
 * Running the check at module load rather than per request means the warning
 * appears before anyone reaches the broken path, and costs one pass over a
 * registry of ~25 actions per isolate.
 *
 * "Needs a draft" is detected from the handler's own SOURCE, not from its
 * argsSchema. Schema alone is not enough: `website.setChrome` does not declare
 * draftId as an argument but its handler reads `args?.draftId` and refuses
 * without it — so a schema-only check would have reported it as fine.
 */
function auditConversationAllowlists(): void {
  const needsDraft: string[] = [];
  const needsOwner: string[] = [];
  const websiteActions: string[] = [];
  for (const cap of HUBLY_CAPABILITY_REGISTRY) {
    for (const action of cap.actions) {
      const id = `${cap.name}.${action.name}`;
      if (cap.name === "website") websiteActions.push(action.name);
      let source = "";
      try { source = action.handler.toString(); } catch { /* not inspectable; skip */ }
      const reads = /draftToken/.test(source) || /draftId/.test(source);
      // startDraft CREATES the draft, so it legitimately mentions both while
      // needing neither injected.
      if (reads && id !== "business.startDraft" && !DRAFT_INJECTED_ACTIONS.has(id)) needsDraft.push(id);
      // THE OWNER SIDE, and it needs its own check because the invariant in
      // callBusinessRpc structurally cannot see it. That guard only asks whether the
      // p_owner_id KEY is present; a handler that reads an owner which was never
      // injected produces null, the key is present, and the write is refused on a
      // claimed business exactly as before — silently. An accidental null and a
      // deliberate pre-claim null are indistinguishable at the RPC. So the place to
      // catch it is here, where "this handler wants an owner" and "the engine injects
      // one for this action" can actually be compared. (OPEN_FINDINGS #20.)
      if (/injectedOwnerUid/.test(source) && !DRAFT_INJECTED_ACTIONS.has(id)) needsOwner.push(id);
    }
  }
  reportAllowlistDrops({
    list: "DRAFT_INJECTED_ACTIONS",
    dropped: needsDraft,
    consequence: "the handler gets no draftId/draftToken and answers 'missing_draft', which reads to the owner as 'you have no draft business'",
    fixAt: "hubly-conversation/index.ts DRAFT_INJECTED_ACTIONS",
  });
  reportAllowlistDrops({
    list: "DRAFT_INJECTED_ACTIONS (owner side)",
    dropped: needsOwner,
    consequence: "the handler reads an owner uid that is never injected, so it is always null and every write it makes is refused on a CLAIMED business — the failure is silent, and the p_owner_id invariant cannot see it",
    fixAt: "hubly-conversation/index.ts DRAFT_INJECTED_ACTIONS",
  });

  // Anything on `website` that is not gated stays fully live when the feature
  // flag is off. Some of these are correct (analyze reads a URL and writes
  // nothing); the point is that the list is printed rather than assumed.
  reportAllowlistDrops({
    list: "GATED_WEBSITE_ACTIONS",
    dropped: websiteActions.filter((a) => !GATED_WEBSITE_ACTIONS.has(a)),
    consequence: "advertised to the model and dispatchable even with HUBLY_DOCUMENT_GENERATION_ENABLED off — confirm each one is genuinely safe to leave ungated",
    fixAt: "hubly-conversation/index.ts GATED_WEBSITE_ACTIONS",
  });
}
auditConversationAllowlists();

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

// The truthful services read-back (findings #3 + #5). Composed from what
// applyServicesToFreeform ACTUALLY did — names, prices, and the place — so the
// acknowledgement is true because the patch happened, never in place of it.
type ServicesPlacementLike = {
  status: string;
  placed: { name: string; price?: number }[];
  missing?: string[];
  inserted?: string[];
  descNeeded?: string[];
  noSection?: boolean;
  lostEdits?: number;
  where?: string;
  detail?: string;
  paths?: { anchor: number; legacy: number; inserted: number };
  retroAnchored?: number;
  leakedAttrText?: number;
};
function fmtSvcPrice(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}
/** "A, B and C" / "A, B and N more" — named, not counted, until the tail. */
function andList(items: string[], overflowAfter = 3): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length <= overflowAfter) return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
  const more = items.length - overflowAfter;
  return items.slice(0, overflowAfter).join(", ") + ` and ${more} more`;
}
/** The rebuild offer — LAST RESORT, only when there is genuinely no services section
 *  to add an entry to. It names the cost (a full regenerate, and how many of the
 *  owner's edits it would lose) BEFORE any yes, so the owner agrees to a price they
 *  were told — never the past-tense "those edits didn't carry across" after the fact. */
function rebuildLastResort(placement: ServicesPlacementLike): string {
  const lost = placement.lostEdits || 0;
  const editCost = lost > 0
    ? ` — that starts the page over from scratch and loses the ${lost} edit${lost === 1 ? "" : "s"} you've made so far`
    : ` — that starts the page over from scratch`;
  return `Your page doesn't have a services section to add them to. The only way to add them is to rebuild the whole page${editCost}. If you want that, say so and I'll show you exactly what it would replace before doing it.`;
}
function composeServicesTruth(placement: ServicesPlacementLike, url: string): string {
  const priced = (placement.placed || []).filter((p) => typeof p.price === "number");
  const wherePhrase = placement.where === "services section" ? "in the services section" : "on your page";
  const missing = placement.missing || [];
  const inserted = new Set(placement.inserted || []);

  if (placement.status === "failed") {
    return `I saved those to your record, but couldn't update the page just now — so don't take them as showing yet. Try again in a moment.`;
  }
  if (placement.status === "none_on_page") {
    // Nothing landed. The ONLY reason a service can't be added is that there is no
    // section to clone an entry into (noSection) — then, and only then, the rebuild
    // offer, with its cost named up front.
    if (placement.noSection) return `I saved those to your record, but ${rebuildLastResort(placement)}`;
    return `I saved those to your record, but couldn't place them on the page — say so plainly rather than claiming they're showing.`;
  }
  if (placement.status === "no_prices") {
    // Names are on the page; no prices were given. Let the model ask for them —
    // don't override with a price read-back that has no prices to read.
    return "";
  }
  // placed / partial — at least one price landed. Read back what ACTUALLY happened:
  // both the prices updated in place and any newly ADDED entries (the "added" claim
  // comes from the placement result, never ahead of it).
  const readback = andList(priced.map((p) => `${p.name} ${fmtSvcPrice(p.price as number)}`));
  const addedNames = priced.map((p) => p.name).filter((n) => inserted.has(n));
  const addedClause = addedNames.length
    ? ` I added ${andList(addedNames)} as ${addedNames.length === 1 ? "a new entry" : "new entries"} in that section.`
    : "";
  // The where-clause is only additive when it names a specific place (the services
  // section). When it is the generic "on your page", appending it duplicates the
  // "on your page now" we just said ("…on your page now, on your page.") — so drop it.
  const whereClause = placement.where === "services section" ? `, ${wherePhrase}` : "";
  const landedLine = `${readback} ${priced.length === 1 ? "is" : "are"} on your page now${whereClause}.${addedClause}`;
  if (placement.status === "partial" && missing.length) {
    // A service the page has no cloneable entry for (rare). Say so honestly — no
    // rebuild bait (a rebuild wouldn't obviously help place one service, and it
    // would destroy the rest).
    const missWord = andList(missing);
    return `${landedLine} I couldn't add ${missWord} to the page as it's built, so ${missing.length === 1 ? "it isn't" : "they aren't"} showing yet.`;
  }
  // An entry was added into a section that carries a one-line blurb per item, but no
  // description was given — the page is telling us one belongs, so ASK for it (a
  // single question; the new card renders clean in the meantime, blurb hidden).
  const descNeeded = placement.descNeeded || [];
  if (descNeeded.length) {
    const ask = descNeeded.length === 1
      ? ` Your other items each have a one-line description — what should ${descNeeded[0]}'s be?`
      : ` Your other items each have a one-line description — want to add one for ${andList(descNeeded)}? Just tell me and I'll put them in.`;
    return `${landedLine}${ask}`;
  }
  return landedLine;
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

/**
 * WHAT THE OWNER HAS SELECTED, IN WORDS THE MODEL CAN USE.
 *
 * Present only when a selection actually RESOLVED against the stored page, so the
 * model is never told about a target its writers cannot reach. It states the one rule
 * that is easy to get backwards: a target changes the SCOPE of an instruction, never
 * the grounding rule. "Make this more premium" is a look and it proceeds; "add a
 * testimonial here" is still a question about who said it, target or no target.
 */
function buildSelectionBlock(sel: OwnerSelectionContext | null): string {
  if (!sel) return "";
  return `

THE SELECTED ELEMENT — the owner has one part of their page selected right now
They clicked it, and the composer is showing a chip that says: **${sel.name}**${sel.text ? `\nIt currently reads: ${JSON.stringify(sel.text)}` : ""}

- THIS TURN'S INSTRUCTION IS ABOUT THAT ELEMENT unless they plainly say otherwise. "Make this bigger", "make this feel more premium", "shorten this" all mean ${sel.name} — not the page.
- HOW IT LOOKS -> website.restyleElement. HOW IT READS -> website.patchDocument (already narrowed to this element; you do not need to say which part).
- Pass the name back EXACTLY as written above in restyleElement's \`element\` argument. It is checked, and a mismatch changes nothing and asks instead. Never invent or reword it.
- A TARGET CHANGES THE SCOPE, NOT THE RULES. You still never invent content: "make this more premium" is a look and you just do it, but "add a testimonial here" is someone's words you were not given — ask who said it and write nothing. Same for a price, a guarantee, a rating, a claim about their work.
- WHEN THE WORDS AND THE SELECTION DISAGREE, ASK — do not guess. "Make all the headings bigger" while one heading is selected is genuinely ambiguous: ask, in one short question, whether they mean ${sel.name} or every heading, and change nothing until they answer. Restyling the wrong thing is worse than one extra question.
- Refer to it by that name when you speak, so they can see you meant the thing they clicked. Never describe where it is on screen or name a control — you cannot see their screen.`;
}

function buildSystemPrompt(
  context: ConversationContextName,
  currentUnderstanding: BusinessUnderstandingPatch | CustomerUnderstandingPatch,
  latestUserMessage: string | null,
  draftBusiness: { id: string; slug: string; url: string } | null,
  selection: OwnerSelectionContext | null,
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
${draftBusiness ? `- A draft already exists (${draftBusiness.url}). If no document exists yet on it, call website.generateDocument now. If one already exists, never call generateDocument again this conversation — any change, however small, goes through website.patchDocument instead (see below). business.updateDraft is still how name/tagline/about/phone/email/businessType/brandColor get captured as real business facts, independent of the page — but its heroHeadline/heroSubhead/layout fields no longer do anything meaningful once a document exists; don't set them.` : `- Call business.startDraft the moment you have a real or placeholder business name, in the SAME reply. Then call website.generateDocument in that same reply too — don't wait for a follow-up turn. Never call business.startDraft again this conversation.
- SOMEONE DESCRIBING WHAT THEY DO IS THE GO-AHEAD TO BUILD — that sentence-to-website moment is the whole product. On a message like "I do mobile detailing in Lehi" you BUILD, immediately, in that turn. NEVER ask whether to build ("want me to build you a website?"), and NEVER offer building as one option among others ("build a website, or tighten your packages and pricing first?" is exactly the wrong move — it is a menu, it is forbidden, and it puts a question in front of the one moment that matters). Nothing about services, packages, pricing, or styling is mentioned before the page exists — all of that comes AFTER the build. Before the build there is exactly one thing you do: build.`}

website.generateDocument takes one thing: a rich "brief" — write it yourself, in full sentences, covering everything you actually know: the real business name and type, city, tone, and — critically — any REAL brandColors/headline text/services from a website.analyze result, cited as real (see above; only those three fields are real from analysis, never claim more). The richer the brief, the better the real page it produces — don't under-write it to save a sentence.

Once a document exists, be honest about the two kinds of change and route each correctly — DO NOT promise a change you can't make. CONTENT changes go through website.patchDocument with a plain-language instruction: the words, a price, a phone/email/address, or swapping an image ("make the headline warmer", "change the sourdough to $12"). These change the one thing and nothing else. A change to the LOOK — colour, font, spacing, or the layout/structure (adding, removing or reordering sections) — CANNOT be done as a small edit, and you must never imply it can. When someone asks for a look change, say plainly what you can change directly, then offer the real path: a redesign. website.newPage rebuilds the page in a different look on their say-so — it asks first and tells them what hand-edits would be remade. So: never promise a colour, font, spacing or layout change through patchDocument (it will do nothing), and never call generateDocument again to edit.` : `If not, propose 2-3 REAL, genuinely different visual directions from this actual list — describe each in your own words by its real character, never as "Option A/B/C" or a template name dump:
${LEGACY_LAYOUT_DIRECTIONS}
Whenever you propose directions like this, ALSO include a top-level "concepts" array in your JSON response — one entry per direction you just described, in the same order: {"id":"<the real layout id>","name":"<its real name>","character":"<a short phrase, your own words>"}. This is what puts something to actually look at on screen instead of just a paragraph to read — never omit it when you're presenting directions to choose from, and never include it any other time. Because the cards themselves carry the name and character, your "message" on this turn should be almost nothing — "A few directions:" or similar — never restate each one's description again in prose too; that's the exact redundancy showing real progress is supposed to replace.

The instant a direction is picked, build it for real — don't wait for a business name first. A real site with placeholder content beats a perfect question every time:
${draftBusiness ? `- A draft already exists (${draftBusiness.url}) — use business.updateDraft for anything new: name, tagline, about, contact info, a drafted headline/subhead, or a changed direction (layout). Never call business.startDraft again this conversation.` : `- Call business.startDraft the moment a direction is picked, in the SAME reply, even if you don't know the business name yet — use their real name if you already have it, otherwise pass "Your Business" as a placeholder (this is expected, not dishonest — a real, live, editable site with placeholder content is exactly right at this stage). Then keep calling business.updateDraft as you learn more (a real name replaces the placeholder the instant they give it, headline, subhead, about, contact info) — every real detail should show up there within the same reply it's learned.`}

Write real headline/subhead/about copy yourself (this is conversational value, priority 1) and pass it straight into business.updateDraft's heroHeadline/heroSubhead/about — don't just describe what you'd write, actually write it and put it on the site. Always include seoTitle too ("<Business Name> | <what they actually do>") — businessType only recognizes a handful of fixed categories (detailing, pressure_washing, landscaping, cleaning, photography, hvac, windows) and silently mislabels anything outside that list, so seoTitle is what keeps the real page title accurate for everything else. Only set businessType when it genuinely matches one of those categories — never force a fit.`}

The moment you know what services they offer — even roughly, even just one — call business.setServices with the complete real list (name, and price/description whenever actually given); this is a real business fact independent of the page, and feeds future generation/edits. seoTitle still matters — pass it via business.updateDraft ("<Business Name> | <what they actually do>") since businessType only recognizes a handful of fixed categories and silently mislabels anything outside that list.

The moment you know what services they offer — even roughly, even just one — call business.setServices with the complete real list (name, and price/description whenever actually given). Real service cards appear on the live site immediately; this is one of the highest-value single moments in the whole conversation, so don't wait to have all of them before calling it, and call it again with the fuller list as you learn more. Phone/email, once given, go straight into business.updateDraft's phone/email — they show up in the site's real contact line. There is no real place for business hours to live yet — never ask about them, and never invent a footer showing hours that don't actually exist anywhere.

Once prices are set, ask for ONE photo of their actual work — on its own turn, one plain ask, only after real value is already on the page. This is the single highest-leverage thing an owner can add: a real photograph is what makes a site look like a real business instead of a template, and almost no one ever sends one, so this ask matters. Frame it as the reward and say what it GETS them, never what button to press: e.g. "Send me one photo of your actual work — a finished cut, a car you detailed, a room you built — and I'll put it straight on the page. It's the one thing that turns this from a template into your business." Set "askedFor":"photos" on that turn, so the image they send next is understood as their work, no menu. CRUCIAL: this one draft photo does NOT need an account and you do NOT attach the account door to it — it goes on the draft for free, because a real photo on the page is worth far more than a gate, and getting owners to send work photos is a thing we are actively trying to fix. Ask this ONE time; if they pass, drop it gracefully and never nag.

Once services are set (and after the work-photo ask above — one ask per turn, photo first), ask if they already have a logo — a real image file, not a description. This is the one thing you cannot build yourself in conversation (the person has to send the actual file), so when you ask this ONE time, set "askedFor":"logo" on that reply — then whatever image they send next is understood as their logo, no menu. Never ask again after the first time. Until they send one, the header already shows their initials automatically — that's real and correct, not a gap to apologize for.

For every other outcome (booking, CRM, marketing, storefront), there is no live build yet — create real value in conversation (a draft, a plan, honest advice) and say plainly that the live workspace will show it once that part is built. Never imply something is appearing visually when it isn't.

WHEN IN DOUBT, SHOW PROGRESS OVER ASKING. If you're weighing another question against building/updating something real with what you already have, build it. An imperfect real draft is always the better move than a well-phrased question — they can refine a draft, but a conversation that feels like an interview loses them. This outranks the usual "ask exactly one question" guidance whenever the two conflict.

WHAT YOU JUST BUILT IS THEIR SITE — a real first draft, and you call it theirs ("that's your site"), not "a structure." It is early: no logo yet, no photographs yet, and the address is RESERVED, not live, until they make an account. Be confident and honest at once — it's yours, it's a draft, here's what we can do with it. Do NOT oversell it as finished, and do NOT lead by listing what it lacks: the useful move is to show how much they can change for free just by talking, and let an account be the thing that brings their own photos, their logo, and the live address. An owner who is told the truth — reserved address included — trusts the next thing you say, and the truth is the strongest reason to sign up.

While you're building or refining, keep what you say almost silent — a few words, or nothing at all. NOTHING IS ANNOUNCED BEFORE IT HAPPENS, and nothing claims a result you cannot know yet. The line you write beside an action is spoken BEFORE that action has run, so it can only ever be a promise: "On it.", "Doing that now", "Adding it" all state as fact something that has not occurred, and when the action then fails the person has been told two opposite things in one turn. "Done — take a look." is the same error pointed the other way: it claims an outcome you have not seen. So the safe move, and the usual one, is SAY NOTHING there — the empty message is a real and good answer, and the change on screen is the explanation. If a word is genuinely wanted, it acknowledges only the request ("Right — leaf removal, $85."), never the outcome. What actually happened is reported AFTERWARDS, once, from the real result. Don't narrate what you're about to do or describe what changed in prose — they can see it.

WHEN AN ACTION FAILS, THE ANSWER IS NEVER "DO IT YOURSELF SOMEWHERE ELSE." You cannot see their screen. You do not know what is on it, what it is called, or whether it exists — so you NEVER name or describe a control, a screen, a panel, a menu, a tab or "the editor", not as help, not as a workaround, not as an apology. This holds everywhere, not just for accounts: saying "add it underneath the Saturday hours in the editor" sends someone hunting for something you invented, which is worse than the failure itself. When you could not do it, say plainly that you could not do it yet, in one sentence, and stop. Either you act, or you say what you will do — never directions to a thing you cannot see.

THE ONE EXCEPTION — the first website.generateDocument call. That page takes about a minute to appear and the screen is empty the whole time, so silence there is a dead minute a new customer stares at. On THAT turn ONLY, your "reply" field IS four or five sentences saying what you're about to build for THIS specific business and why — your design judgment, in plain language, in your own voice. Real example for a photographer: "Photographers live or die on the work itself, so I'm leading with your pictures rather than a headline. A warm, quiet palette so the images carry the colour. Packages people can scan in five seconds. Booking one tap away from anywhere on the page." A roofer, a baker, a plumber must each read completely differently — this is about their trade and what you know of them, never a paragraph that would fit any business. Hard rules: judgment only, NEVER a claim about the world you can't back up ("this is what photographers in your state are doing" is forbidden — you don't have that data, and it's the first thing they'd read). In your voice, not a spec sheet ("leading with your pictures," never "hero: full-bleed image"). Four or five sentences — a wall of text is worse than silence. This is your INTENT, written before the generator runs; it can differ from the exact page that lands, and that's fine — never claim it as finished fact.
DURING THE BUILD, SPEAK ONLY ABOUT THEIR BUSINESS AND THE LOOK — NEVER ABOUT HUBLY'S MACHINERY. Forbidden, every time: "structure," "sections," "the layout," "services are now real on the page," "once it appears," or any description of how the page is assembled — those are internals that mean nothing to a photographer or a plumber. Forbidden: pre-announcing a flaw or a gap before they have seen anything ("the first visible gap will be your logo"). Forbidden: asking for ANYTHING — no file, no logo, no photo, no upload — while the build runs; there is nothing to add it to yet, and asking for work before delivering value is exactly backwards. Nothing transactional at all during the build. The ONLY thing you say is your design judgment about THEIR trade and the look you're giving it and why it suits them — like "Barbershops need to feel sharp before anyone reads a word, so I'm giving Ironside a bold, high-contrast look." If a sentence would still make sense on a different business's build, delete it.
PLACEMENT, and it matters: on this first-build turn the narration goes in "reply" and NOWHERE else. Put NOTHING in interimMessages on this turn, and do NOT also say "building it now" — the narration already says you're building. And do NOT ask about a logo or set askLogo on this turn: the page does not exist yet, so there is nothing to add a logo to. The logo ask, and every other next step, waits for your NEXT turn, after the page has actually appeared. The instant the page exists, go back to near-silent for every edit.

WHAT'S FREE AND WHAT NEEDS AN ACCOUNT — you know the line and you never blur it. Offering something gated without the account in the same breath is promising then blocking, which is worse than staying quiet.
- FREE, right now, no account: changing the page by TALKING to you — reorder sections ("lead with the wedding work"), change the tone ("make it warmer"), rewrite any copy, regenerate the whole thing. Conversational regeneration is the free loop that proves the product; it is NEVER gated and you offer it freely.
- NEEDS AN ACCOUNT (all unlocked the moment they CLAIM the site): editing the page DIRECTLY — touching the words or the photos on the page itself — sending a logo file, and the address going live. IMPORTANT: until they claim, the page is NOT directly editable at all — there is no click-to-edit, no tap-a-photo-to-swap-it. So NEVER imply they can "tap", "click", or "touch" anything on the page to change it; that affordance does not exist yet and saying it would be the promising-then-blocking trap. Say the honest line plainly, once, where they'll see it: "This is your site. Claim it and you can change anything on it — the words, the photos, all of it." Not "sample" — it's theirs, they just can't touch it directly yet. And in the same breath, the free loop that DOES work now: changing it by talking to you ("make it warmer", "lead with the detailing", "shorter headline"). (The ONE thing that's free without an account: a single photo of their WORK — see the work-photo ask above — which goes on the draft for free.)
- THE RULE: never offer a gated thing on its own. Not "send me your logo" (that needs an account — you'd be promising then blocking). Instead carry the door in the same sentence, as the reward: "want your own photos and logo on it, and the address live? that takes an account — about ten seconds." Free suggestions stand alone; gated ones always arrive with the account attached.
- WHEN THEY SAY YES, OPEN THE DOOR — do not send them looking for it. The instant they agree to an account (or ask how to make one), set "openAccount":true on your reply; the door opens for them in that same moment. NEVER name or point at a control — never "use the sign-up button", "tap the button at the top", "the button on this page". You cannot see their screen and the control may not be where you think; describing one is a broken promise to someone who already said yes. You ACT (openAccount) and say what will happen in plain words: e.g. "Opening it now — Google, or a six-digit email code. About ten seconds." The making-an-account act is the same shape as every future in-thread action: you drive the interface, they don't hunt for it.

ONCE THE PAGE HAS APPEARED — and NEVER before — YOUR FIRST MESSAGE IS ABOUT SERVICES, not styling. The trigger is the page EXISTING (a document is now on the draft), not the conversation starting: before the page exists you are building, not asking, and you say nothing about services or pricing. The instant the page is there, a Book button with nothing behind it is the one thing that wastes a visit, so your first message is the question that fills it. Ask about the SPECIFIC things you already know, never an abstract "tell me what you do and what you charge" (that's a form wearing a chat bubble). Ask it as ONE plain question — NEVER a menu, NEVER "A or B", NEVER "would you like…" (you just violated this by offering "build a website or tighten your pricing" — do not). Two cases:
- SERVICES ARE ON THE PAGE BUT UNPRICED (the common case): name them back and ask the prices. "I've got full detail, interior only and ceramic coating on there — what do you charge for each?" (use their REAL service names). The FIRST time you ask about prices this conversation, add the photo offer once — "— tell me, or send a photo of your price list and I'll fill it in." If you've ALREADY offered the photo earlier in this conversation, leave it off and just ask the plain question. Naming the actual services proves you were listening, and the answer is just a few numbers. Then call setServices with what they say.
- NO SERVICES YET: "What are the main things people book you for — and what do you charge?" — plus the one-time photo offer, but only if you haven't made it yet this conversation ("tell me, or send a photo of your price list and I'll fill it in"). Then call setServices as they answer.
OFFER THE PRICE-LIST PHOTO ONCE PER CONVERSATION — the first time you ask about prices, and never again. Most operators already have the prices written down (a sign, a Square setup, a photo), and showing beats typing; it costs them nothing and needs no account. But repeating the SAME canned line one turn later — "tell me, or send a photo of your price list and I'll fill it in" right after you already said it — reads like a broken record, not someone who's listening. So every LATER price ask is JUST the plain question ("what do you charge for each?") with no photo offer tacked on. Do NOT mention an account for the photo. If they send a price-list photo (dropped, pasted, or attached — whatever their device does), the prices come back extracted and you'll set and read them back — same as if they typed. Say "send" or "a photo", never "drop" (a phone can't drop).
On the turn where you ASK either of those, set "askedFor":"services" so the product can notice if their answer never gets recorded and re-ask.
Capture bare numbers as prices — "full detail is 175", "interiors 110" — the person will not type dollar signs when they talk. After they answer, read it back plainly ("Full detail $175, interior only $110 — done") so a mis-hear is easy to catch. Do NOT explain the plumbing: never "that turns your Book button on" — the owner thinks about getting work, not buttons. If a reason surfaces at all, make it theirs ("then people can actually book you"), but the question rarely needs one.
ONLY once services (and prices where they gave them) are real do you fall back to leading with a free styling change ("want it warmer?"). Then, once and separately, offer the account as what unlocks their own photos, their logo, and the live address.
- One thing per message. Never a list, never a menu, never "would you like A, B or C?".
- Everything is skippable and you say so.
- After each change, say what visibly changed, then offer the next free move unprompted.
- Never open with a request for a file, and never imply the page is deficient without one.
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
${buildSelectionBlock(selection)}

Photos or screenshots someone attaches are visible to you directly in the conversation — look at them and describe honestly what you can actually see. That doesn't require a capability call. If a file arrives and you were NOT waiting on anything specific (you hadn't just asked for services, a logo, or photos), ask ONE open question — "what would you like me to do with this?" — never a menu of options, and then act on whatever they say ("these are my prices" → set services; "make it look like this" → use it as a reference; "that's my logo" → treat it as the logo).

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

"understanding" is optional on both — include it only when you learned something new this turn, matching the categories above (${adapter.categories.join(", ")}). "concepts" is optional and only ever appears on a "reply" — include it only when you're presenting real visual directions to choose from (see BUILDING A WEBSITE, LIVE above), omit it every other turn. "askInspiration" is optional, boolean, only on a "reply", only on the one turn you first ask about inspiration for a website. "openAccount" is optional, boolean, only on a "reply": set it true the moment the person agrees to make an account (or asks how) — it opens the account door for them. You NEVER describe where a button is; you set this flag and the door opens. "askedFor" is optional, one of "services"|"hours"|"area"|"phone"|"logo"|"photos", only on a "reply": set it on the turn where you ASK the person for that thing. It does two jobs: the product notices if their answer never gets recorded and re-asks, AND — crucially — a FILE the person then sends is treated as the ANSWER to that ask, routed with no menu (a price-list photo for "services", the logo for "logo", work photos for "photos"). Set it whenever you ask for any of these — always. (This replaces the old askLogo flag: for a logo, set "askedFor":"logo".)

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
  // A structured DIRECT EDIT (the manual form, click-to-edit, an image/doc patch)
  // is not a chat turn and carries no messages — it must not be rejected by the
  // chat-turn guard. Without this, the panel's messages:[] 400'd here, ~530 lines
  // before the directRecordEdit handler ever ran, so EVERY manual save failed with
  // "messages_required" and the owner saw "That didn't save" (found live 2026-09-01).
  // designKnobs (the read the controls open from) and designEdit (turning one) are the
  // same shape: structured owner actions with no chat turn. They belong on this list for
  // the same reason the panel's edits do — this guard sits ~500 lines before their
  // handler, so an omission here is invisible at the call site and reads to the owner as
  // "that didn't save".
  const anyDirectEdit = !!(body && (body.directRecordEdit || body.directEdit || body.directImageEdit ||
    body.directDocumentPatch || body.directDocumentImageEdit || body.directFreeformEdit || body.directFreeformImageEdit ||
    body.designKnobs === true || body.designEdit || body.styleEdit || body.sectionMove || body.nodeMove || body.nodeDelete ||
    body.restampPage === true));
  if (!incoming.length && !anyDirectEdit) return jsonRes({ ok: false, error: "messages_required" }, 400);

  // POST-BUILD HAND-OFF. The client asks the MODEL for the first message after a build
  // (services-first) rather than composing a menu client-side. Inject a system-event turn
  // so the model takes exactly this turn; the client never persists this line to the
  // visible transcript, so it only steers this one reply.
  if (body?.event === "post_build") {
    // COMPOSED FROM THE RECORD, not fixed. See selectServicesForAsk for the
    // failure this replaces: the gate read nothing and asked for prices the
    // owner had already given, on the very turn after they were saved.
    const postBuildId = body?.draftBusiness?.id ? String(body.draftBusiness.id) : "";
    const svc = postBuildId ? await selectServicesForAsk(postBuildId) : { names: [], unpriced: [], known: false };
    const list = (xs: string[]) => xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1];
    let ask: string;
    if (!svc.known || !svc.names.length) {
      // Nothing on record (or we could not read it): the honest ask is the open one.
      ask = "There are NO services on record, so ask what people mainly book them for and what they charge. Set askedFor:\"services\".";
    } else if (svc.unpriced.length) {
      // Some are priced and some are not — ask ONLY about the ones genuinely missing a
      // price, by name. Asking about the priced ones is asking for what they gave.
      const priced = svc.names.filter((n) => !svc.unpriced.includes(n));
      ask = (priced.length ? `These services are on record WITH prices already, so never ask about them: ${list(priced)}. ` : "") +
        `These have NO price yet: ${list(svc.unpriced)}. Ask about the UNPRICED ones only, by name. Do not restate or ask them to confirm a price that is already on record. Set askedFor:"services".`;
    } else {
      // Every service is priced. There is nothing to ask here, and asking anyway —
      // even as "are those still right?" — is asking for what they just gave.
      ask = `Every service is on record WITH its price (${list(svc.names)}) and they are on the page. Do NOT ask about services or prices at all, and do NOT read the prices back or ask them to confirm — they gave you these and they can see them. Instead say in one short sentence that the page is theirs, and ask about the next thing that is genuinely missing (their own work photos are usually it). Set askedFor to that thing, not "services".`;
    }
    incoming.push({
      role: "user",
      content: `[SYSTEM EVENT: the website just finished building and is now on screen. This is your first post-build turn — give your post-build first message NOW. ${ask} ONE plain question, NEVER a menu or bullet list, nothing about styling or accounts.]`,
    });
  }

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
    if (!token || !businessId || !supabaseUrl) {
      return jsonRes({ ok: false, error: "This action needs you to be signed in to your business." }, 401);
    }
    // The CALLER's token stays in Authorization -- that is whose identity is
    // being checked. apikey carries our own credential, and adminHeaders throws
    // if we have none rather than sending an empty one and reading the 401 as
    // "this person is not signed in", which is a different and wrong answer.
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { ...adminHeaders(), authorization: `Bearer ${token}` },
    });
    const userJson = await userRes.json().catch(() => null);
    const userId = userRes.ok && userJson?.id ? String(userJson.id) : null;
    if (!userId) return jsonRes({ ok: false, error: "You're not signed in." }, 401);
    const bizRes = await fetch(
      `${supabaseUrl}/rest/v1/businesses?id=eq.${encodeURIComponent(businessId)}&select=owner_id&limit=1`,
      { headers: adminHeaders() },
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

  // The verified owner of a CLAIMED business, from the caller's JWT — the authority
  // that lets facts stated in chat reach the record after claim (the draft-token
  // writers refuse a claimed row; the record RPCs authorise by owner_id = this uid
  // instead, mirroring create_business_document). Resolved LAZILY and memoized:
  // getOwnerUid() makes AT MOST one /auth/v1/user call, and only when a code path
  // actually needs an owner — an anonymous visitor (the hot path) never triggers
  // it, because every guard short-circuits on the draft token first. Latency in
  // this flow is a product problem, so the anon path pays nothing.
  let _ownerUidCache: string | null | undefined;
  const getOwnerUid = async (): Promise<string | null> => {
    if (_ownerUidCache === undefined) _ownerUidCache = await resolveOwnerUid();
    return _ownerUidCache;
  };

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
  // PRIOR turns only, snapshotted before this turn appends anything.
  //
  // `history` is mutated during the turn: every interim message is pushed at
  // the invoke site and finalText is pushed before the response is built. So
  // handing `history` to the dedupe compared each candidate against ITSELF,
  // scored 1.0, and suppressed it — the transcript went completely silent on
  // any turn that invoked a capability. Caught by reading the rendered thread,
  // not the function's return value: the dedupe was working exactly as
  // written, on the wrong input.
  const priorAssistantSaid: string[] = incoming
    .filter((m) => m.role === "assistant" && typeof m.content === "string")
    .map((m) => m.content as string);
  // Fixed for the whole turn, including any internal capability rounds
  // below — those are server-internal continuations of this one user
  // message, not new input, so the relevance signal shouldn't shift mid-turn.
  const lastIncomingUser = [...incoming].reverse().find((m) => m.role === "user");
  const latestUserMessage = typeof lastIncomingUser?.content === "string" ? lastIncomingUser.content : null;

  // ── THE SELECTED ELEMENT ───────────────────────────────────────────────────
  //
  // The owner clicked something on their own page and the composer shows a chip for
  // it; this turn's instruction is about THAT element. What arrives is a claim made by
  // a frame — label, node address, and the name the chip is showing — and it is checked
  // against the STORED page before the model is told anything (resolveOwnerSelection),
  // because the canvas holds the page as it was when that frame mounted.
  //
  // RESOLVED HERE, ONCE, rather than inside each handler: the prompt block and both
  // capabilities need the same answer, and computing it twice is how a model comes to
  // be told about a target its writer cannot reach. One document read, and only on a
  // turn that actually carries a selection.
  const rawSelection = body?.selection && typeof body.selection === "object" ? body.selection as Record<string, unknown> : null;
  let selection: OwnerSelectionContext | null = null;
  if (rawSelection && draftBusiness) {
    const r = await resolveOwnerSelection(draftBusiness.id, await getOwnerUid(), {
      label: typeof rawSelection.label === "string" ? rawSelection.label : null,
      on: rawSelection.on === "section" ? "section" : "element",
      node: (rawSelection.node && typeof rawSelection.node === "object" ? rawSelection.node : null) as NodeAddress | null,
      name: typeof rawSelection.name === "string" ? rawSelection.name : "",
    });
    // A SELECTION THAT DID NOT RESOLVE IS NOT A SELECTION. Rather than fall through to
    // a page-wide edit — the one thing having a target is supposed to prevent — the
    // turn carries none, and when the cause is that the page moved underneath, the
    // model is told to SAY so. Falling through silently would restyle the wrong thing,
    // which is exactly the failure this feature was asked to avoid.
    selection = r.ok ? r : null;
    if (!r.ok) {
      console.warn(`selection did not resolve (${r.error}) — this turn runs with no target`);
      if (r.error === "no_match" || r.error === "changed") {
        history.push({
          role: "system",
          content:
            "CAPABILITY RESULT for website.selection: the part of the page the owner had selected is NO LONGER THERE — the page has changed since they selected it — so this turn has NO target. " +
            "Tell them plainly that their selection is out of date and ask them to select it again. Do NOT apply their request to the page as a whole, and do not name or describe any control.",
        });
      }
    }
  }
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

  // DETERMINISTIC EXTRACTION — computed now, applied the moment there is a row.
  //
  // Facts someone literally typed must not depend on whether a model chose to
  // call a function. Until this existed there was no extraction step at all: a
  // phone number, an address, opening hours or a service area reached the
  // record only if the model happened to invoke updateDraft, and when it went
  // straight startDraft -> generateDocument -> setServices they were gone. One
  // real message carrying eleven distinct facts produced a record holding the
  // name and nothing else.
  //
  // THE TIMING IS THE WHOLE PROBLEM. The turn that carries the facts is almost
  // always the turn that CREATES the business, so there is no row to write to
  // when the message arrives. The first version of this ran here and did
  // nothing at all for exactly that reason — gated on a draft that startDraft
  // had not created yet.
  //
  // So: extract now (pure, no row needed), and apply at the first moment a row
  // exists — either immediately below, or the instant startDraft returns one,
  // which is necessarily before generateDocument can be dispatched.
  let pendingFacts: Awaited<ReturnType<typeof extractRecordFacts>> = {};
  let pendingPricedServices: ReturnType<typeof extractPricedServices> = [];
  // A price appears in the intake message. Held so that if extraction still wrote
  // no priced service, that miss is recorded as a countable row (see below) rather
  // than surfacing days later as a bare page.
  const intakePriceSignal = messageHasPriceSignal(latestUserMessage || "");
  if (latestUserMessage && latestUserMessage.trim()) {
    const pattern = extractByPattern(latestUserMessage);
    pendingPricedServices = extractPricedServices(latestUserMessage);
    // Is the schema'd pass worth a model call? Asked of the MESSAGE — see
    // worthExtracting for why this no longer consults the record at all.
    const worthAPass = worthExtracting(latestUserMessage);
    const passed = worthAPass ? await extractRecordFacts(latestUserMessage, draftBusiness?.id) : {};
    pendingFacts = mergeFacts(pattern, passed);
    // Services from the SAME model pass that read the rest of the record, unioned
    // with the regex floor. This is what turns "Prices: Express Wash $60, ..." into
    // structured services BEFORE the page builds — the regex alone missed it (no
    // delimiter) and the record stayed empty, so the page shipped priceless, the
    // anchor pass had nothing to stamp, and Hubly asked for a price it was just
    // given. One understanding, both writes (brief + record), same turn.
    pendingPricedServices = mergePricedServices(pendingPricedServices, passed.services || []);
  }

  /** Applies whatever was extracted, once. Safe to call more than once. */
  let factsApplied = false;
  // GUARD 2, same seam as photoTruth/servicesTruth: when extraction REPLACES a fact
  // the owner already had (a corrected phone, a new email), the reply must name the
  // change and the new value. Composed from what the write actually did, so it can
  // neither claim a change that didn't happen nor forget one that did. Appended
  // rather than substituted — a turn can both change the phone and place a service.
  //
  // DECLARED HERE, above flushExtractedFacts, and that placement is load-bearing:
  // the flush ASSIGNS this and is called further up the handler than the other
  // truth variables are declared. Sitting it beside them put it in the temporal
  // dead zone at the moment of the call, so every turn that CHANGED a fact threw a
  // ReferenceError and returned 500 — after the write had already landed. The
  // record therefore updated correctly on every attempt while the caller got a
  // dead connection, which is exactly the shape that reads as "working" from the
  // database and as "failed" from the product. Verified by reading the RESPONSE,
  // not the row (2026-09-02).
  let recordChangeTruth = "";
  // The new VALUES on their own. The suppression test below has to be "is the new
  // value already visible", not "did the model use my exact wording" — the model
  // said "your number is now 970-555-0177" while this line read "your phone number
  // is now 970-555-0177", so a phrase match let both through and the owner was told
  // the same thing twice in one breath. The value is what guard 2 exists to make
  // visible; if it is already there, this stays quiet. One acknowledgement per action.
  let recordChangeValues: string[] = [];

  const flushExtractedFacts = async (id: string, token: string) => {
    if (factsApplied || !id) return;
    // Check for facts FIRST — a turn with nothing to write never resolves the
    // owner (no /auth/v1/user call on the empty hot path).
    if (!Object.keys(pendingFacts).length && !pendingPricedServices.length) return;
    const ownerUid = await getOwnerUid();
    if (!token && !ownerUid) return;   // no credential at all
    factsApplied = true;
    const applied = await applyExtractedFacts(id, token, pendingFacts, pendingPricedServices, ownerUid, latestUserMessage || "");
    for (const c of applied.recordChange) recordChanges.add(c);
    // A FACT WRITE ALWAYS PRODUCES A TRUTH — success or failure. The old code
    // returned silently when nothing was written, so a REFUSED write (e.g. a
    // claimed business on the dead draft path) told the model nothing, and the
    // model filled the void with "Done — it's on your site" — a success it never
    // earned. Now every outcome is reported to the model, once, at this seam
    // (covers phone/email/hours/services and anything added later).
    if (applied.written.length) {
      // Told to the MODEL as a capability result, the same convention the logo
      // upload uses — so the reply reflects what was saved rather than asking for
      // something the person already gave.
      actions.push({ capability: "business", capabilityAction: "recordFacts", args: {}, ok: true, real: true });
      history.push({
        role: "system",
        content:
          `CAPABILITY RESULT for business.recordFacts: saved from what they typed — ${applied.written.join(", ")}. ` +
          `Do NOT ask for any of these again. Mention them only if it is natural to; never list them back.`,
      });
    }
    if (applied.failed.length) {
      // Attempted and REFUSED. Say so plainly; never claim it was saved.
      actions.push({ capability: "business", capabilityAction: "recordFacts", args: {}, ok: false, real: true });
      history.push({
        role: "system",
        content:
          `CAPABILITY RESULT for business.recordFacts: FAILED to save ${applied.failed.join(", ")} — the write was refused. ` +
          `Do NOT tell them it is saved or on their site. Say plainly you could not save it just now and you're looking into it; ` +
          `do not invent a reason or a workaround.`,
      });
    }
    // GUARD 3 — SKIPPED STOPS BEING SILENT.
    //
    // `skipped` has always existed and has never been told to anyone: a fact the
    // owner stated that we deliberately did not write just vanished. That is the
    // one place left where a fact write disappears without a trace, so it is now
    // reported exactly the way `failed` is. Two shapes reach here: already set and
    // unchanged (nothing to do, and the model must not re-ask), and an overwrite
    // REFUSED because the new value isn't in this message (guard 1) — which the
    // owner has to hear, because from their side they just corrected something.
    if (applied.skipped.length) {
      history.push({
        role: "system",
        content:
          `CAPABILITY RESULT for business.recordFacts: NOT written — ${applied.skipped.join("; ")}. ` +
          `Anything marked "already set, unchanged" is on record: do NOT ask for it again and do not announce it. ` +
          `Anything marked "kept …" was NOT changed — if they were trying to change it, say plainly that you didn't ` +
          `catch the new value and ask them for it; never claim the change was made.`,
      });
    }
    // GUARD 2 — a REPLACEMENT is named, with the value, in the reply.
    if (applied.changed.length) {
      recordChangeTruth = applied.changed
        .map((c) => `${OWNER_FACT_LABEL[c.key] || c.key} is now ${c.to}`)
        .join(", ");
      recordChangeValues = applied.changed.map((c) => c.to).filter(Boolean);
      history.push({
        role: "system",
        content:
          `CAPABILITY RESULT for business.recordFacts: CHANGED an existing fact — ${
            applied.changed.map((c) => `${c.key}: "${c.from}" -> "${c.to}"`).join("; ")
          }. This replaced something they already had, so SAY SO in your reply, naming the new value ` +
          `(e.g. "your number is now 801-555-0134"). A change they can see is a change they can correct; ` +
          `a silent one is not.`,
      });
    }
  };

  if (draftBusiness?.id) {
    // flushExtractedFacts self-guards (no facts -> returns before resolving the
    // owner; picks the token or the verified owner as the credential).
    await flushExtractedFacts(draftBusiness.id, draftBusiness.draftToken);
  }

  // RESUME A STALLED BUILD.
  //
  // Two triggers, one path. The client sends { retryBuild: true } when the
  // person clicks Retry on a stalled build; and ANY turn for a business whose
  // last job is stuck past its window kicks the same resume, because the most
  // likely next thing after "nothing appeared" is the person typing again, and
  // making them ask twice for the same page is its own failure.
  //
  // The stored brief is what makes this honest: the retry rebuilds the page
  // that was asked for, not a new page from whatever the conversation has since
  // drifted to. A retry that quietly produces something different is not a
  // retry.
  let buildResumed: { jobId: string; expectedBy: string | null } | null = null;
  if (draftBusiness?.id && draftBusiness?.draftToken && DOCUMENT_GENERATION_ENABLED) {
    const explicitRetry = body?.retryBuild === true;
    const job = await latestDocumentBuildJob(draftBusiness.id, "website");
    const stalled = !!job && job.status === "running" && job.expiredAt;
    // NEVER RESTART A HEALTHY IN-FLIGHT BUILD, even when Retry is clicked.
    //
    // The first version resumed on `explicitRetry && status !== "succeeded"`,
    // which includes a job that is running perfectly well and simply has not
    // finished yet. Clicking Retry then started a SECOND build racing the
    // first: two model calls, two documents, and whichever landed last won.
    // The client's own four-minute ceiling can fire over a slow-but-fine build,
    // so this was reachable without anybody doing anything wrong.
    //
    // A retry is for a build that is dead — stalled past its window, or failed.
    // A running one inside its window is answered by waiting.
    const resumable = stalled || (explicitRetry && !!job && job.status === "failed");
    const stillHealthy = !!job && job.status === "running" && !job.expiredAt;
    // Three attempts, then stop and say so. A loop that retries forever is how
    // a silent failure becomes an expensive silent failure.
    if (job && resumable && job.brief && job.attempts < 3) {
      const restarted = await startDocumentBuildJob(draftBusiness.id, "website", job.brief, job.id);
      dispatchDocumentBuild({
        draftId: draftBusiness.id,
        draftToken: draftBusiness.draftToken,
        brief: job.brief,
        jobId: restarted?.jobId || job.id,
        // Carried ACROSS the service boundary because the save at the far end needs
        // it (OPEN_FINDINGS #20). Safe to pass: hubly-document-build compares the
        // presented credential against our secret key on both headers before its
        // handler runs, so only we can reach it — the same trust level
        // create_business_document itself requires, being service_role-only.
        ownerUid: await getOwnerUid(),
      });
      buildResumed = { jobId: restarted?.jobId || job.id, expectedBy: restarted?.expectedBy || null };
      actions.push({ capability: "website", capabilityAction: "resumeDocumentBuild", args: {}, ok: true, real: true });
      history.push({
        role: "system",
        content:
          "CAPABILITY RESULT for website.resumeDocumentBuild: the previous page build never finished and has been restarted from the original brief. " +
          "Tell the owner plainly that the first attempt did not complete and you are rebuilding now — do not pretend this is the first attempt, and do not claim the page is ready.",
      });
    } else if (explicitRetry && stillHealthy) {
      // Asked to retry something that is still genuinely working. Say so rather
      // than silently doing nothing, which reads as the button being broken.
      history.push({
        role: "system",
        content:
          "CAPABILITY RESULT for website.resumeDocumentBuild: NOT restarted — the original build is still running and has not passed its expected finish time. " +
          "Tell the owner it is still going and will appear shortly. Do not claim a new build was started.",
      });
    } else if (job && resumable && job.attempts >= 3) {
      history.push({
        role: "system",
        content:
          "CAPABILITY RESULT for website.resumeDocumentBuild: the page build has now failed " + job.attempts +
          " times and was NOT restarted again. Say so honestly, apologise briefly, and ask what they would like to do — do not promise a page is coming.",
      });
    }
  }

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
      // The claimed owner. Without it the logo saved and the page re-render was
      // REFUSED, so a signed-in owner was told every time that their page "may
      // still show the initials". OPEN_FINDINGS #20.
      await getOwnerUid(),
    );
    actions.push({ capability: "business", capabilityAction: "setLogo", args: {}, ok: !!logoResult.ok, real: !!logoResult.real });
    history.push({
      role: "system",
      content: `CAPABILITY RESULT for business.setLogo: ${JSON.stringify(logoResult)}\nOnly report what "summary" and "raw" actually show. Do not claim anything beyond this.`,
    });
  }

  // FIX 4: the deterministic, truthful reply for a photo-upload turn (set below).
  // When set, it REPLACES the model's composed reply, because the model cannot see
  // the image bytes and used to hedge ("I don't see the photo") over a real
  // placement. The truth is what uploadDraftPhoto actually did to the page.
  let photoTruth = "";
  // Same mechanism, one seam over (findings #3 + #5): when setServices patches a
  // freeform page, the read-back is the ACTUAL placement — names, prices, and the
  // place — not the model's paraphrase (which dropped the numbers). Set below from
  // the setServices result; when set, it replaces the model's composed reply.
  let servicesTruth = "";

  // Same shape as logoUpload, and for the same reason: the bytes come straight
  // from the client and never through the model. A photo lands in storage and is
  // PLACED on the freeform page synchronously by uploadDraftPhoto (freeform pages
  // have no async update path), so the reply can tell the truth about it.
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
      await getOwnerUid(),
    );
    actions.push({ capability: "business", capabilityAction: "addPhoto", args: {}, ok: !!photoResult.ok, real: !!photoResult.real, summary: photoResult.summary });
    try {
      const rc = (photoResult as { raw?: { recordChange?: unknown } })?.raw?.recordChange;
      if (Array.isArray(rc)) for (const c of rc) if (typeof c === "string") recordChanges.add(c);
    } catch (_e) { /* never fail a turn on instrumentation */ }
    // FIX 4 — the confirmation is the ACTUAL placement result, not the model's
    // guess. uploadDraftPhoto placed the photo on the freeform page synchronously
    // (or reported honestly that it couldn't), and its summary is the owner-facing
    // truth. Use it verbatim as the reply, so the page and the words agree — the
    // model can no longer say "I don't see the photo" over a real success.
    photoTruth = String(photoResult.summary || "").trim();
    // Loud + countable: record whether the placement actually landed on the page.
    try {
      const place = (photoResult as { raw?: { placement?: string } })?.raw?.placement || "unknown";
      const landed = place === "placed" || place === "swapped";
      if (!landed) console.error(`photo placement [${draftBusiness.id}] -> ${place} [DID NOT LAND]`);
      const u = (Deno.env.get("SUPABASE_URL") || "").trim();
      if (u) await fetch(`${u}/rest/v1/rpc/record_rebuild_outcome`, {
        method: "POST", headers: { ...adminHeaders(), "content-type": "application/json" },
        body: JSON.stringify({ p_business_id: draftBusiness.id, p_changes: "photo-placement", p_status: place, p_detail: photoResult.error || null, p_landed: landed }),
      });
    } catch (_e) { /* telemetry must never fail the turn */ }
  }

  // Inline canvas edit — click headline/subhead/hero-image directly inside
  // the live preview and save. Same registry action(s) as chat
  // (business.updateDraft / the same image-upload path as the logo), same
  // security — just a different trigger. Short-circuits before the model
  // loop entirely: the person already supplied the exact value themselves
  // (typed it, or picked a file), so there's nothing for the model to
  // decide. No LLM call — but it does answer, because "the canvas update is
  // the whole response" was only ever true for the edits you can see land.
  // A document patch or a dropped image can change something off-screen, or
  // fail, and a person who gets no reply cannot tell which. See the
  // humanNote comment on the return below.
  const DIRECT_EDIT_TEXT_FIELDS = new Set(["heroHeadline", "heroSubhead"]);
  const DIRECT_EDIT_LABELS: Record<string, string> = {
    heroHeadline: "your headline",
    heroSubhead: "your subheading",
  };
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
  // FREEFORM click-to-edit. A LABEL, not a node id: a freeform page has no
  // tree to look an id up in, and one label may legitimately match several
  // elements (a phone number stated in three places changes in all three).
  const directFreeformEdit =
    body?.directFreeformEdit && typeof body.directFreeformEdit === "object" &&
    typeof body.directFreeformEdit.label === "string" && body.directFreeformEdit.label &&
    typeof body.directFreeformEdit.text === "string"
      ? {
          label: String(body.directFreeformEdit.label),
          text: String(body.directFreeformEdit.text),
          ...(typeof body.directFreeformEdit.prevText === "string"
            ? { prevText: String(body.directFreeformEdit.prevText) }
            : {}),
        }
      : null;
  const directFreeformImageEdit =
    body?.directFreeformImageEdit && typeof body.directFreeformImageEdit === "object" &&
    typeof body.directFreeformImageEdit.label === "string" && body.directFreeformImageEdit.label &&
    typeof body.directFreeformImageEdit.imageBase64 === "string"
      ? {
          label: String(body.directFreeformImageEdit.label),
          imageBase64: String(body.directFreeformImageEdit.imageBase64),
          mediaType: String(body.directFreeformImageEdit.mediaType || "image/png"),
        }
      : null;
  // The MANUAL FORM edit — a signed-in owner changing a fact through a form, not
  // the assistant. Owner-verified, no model; runs the same placement + version as
  // the chat path (see applyOwnerRecordEdit).
  const directRecordEdit: OwnerRecordEdit | null =
    body?.directRecordEdit && typeof body.directRecordEdit === "object" &&
    typeof body.directRecordEdit.kind === "string"
      ? (body.directRecordEdit as OwnerRecordEdit)
      : null;

  // An authenticated owner editing a CLAIMED business is authorised by OWNERSHIP,
  // not by the draft token — which create_business_document no longer accepts once
  // owner_id is set. Resolve the caller's verified user id from a real user JWT
  // (the client sends its access token as Authorization when signed in); the
  // anon/publishable key isn't a JWT and resolves to null. The RPC then enforces
  // that this uid actually owns the business, so a forged id can't write.
  async function resolveOwnerUid(): Promise<string | null> {
    const tok = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!tok || !tok.startsWith("eyJ")) return null; // not a user JWT (anon/publishable key)
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
    if (!supabaseUrl) return null;
    try {
      const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { ...adminHeaders(), authorization: `Bearer ${tok}` },
      });
      const j = await r.json().catch(() => null);
      return r.ok && j?.id ? String(j.id) : null;
    } catch {
      return null;
    }
  }

  // DESIGN KNOBS. A structured, model-free owner edit like directRecordEdit — the
  // control sets one CSS variable in the stored page, which is a new document version,
  // which Undo reverses. `designKnobs` with no op is the READ the controls open from:
  // it returns only the knobs that actually bind on this page, so a control is never
  // shown for something it cannot move.
  if (body?.designKnobs === true || (body?.designEdit && typeof body.designEdit === "object")) {
    if (!draftBusiness) return jsonRes({ ok: false, error: "no_business" }, 400);
    const ownerUid = await getOwnerUid();
    if (!ownerUid) return jsonRes({ ok: false, error: "not_signed_in", reply: "You need to be signed in to change this." }, 401);
    if (body?.designKnobs === true) {
      if (!(await ownsBusiness(draftBusiness.id, ownerUid))) return jsonRes({ ok: false, error: "not_owner" }, 403);
      const r = await readOwnerDesignKnobs(draftBusiness.id);
      return jsonRes({ ok: r.ok, ...(r.knobs ? { design: r.knobs } : {}), ...(r.error ? { error: r.error } : {}), messages: incoming, actions: [], interimMessages: [] });
    }
    const e = body.designEdit as { knob: string; value?: string; op?: "set" | "reset" };
    const result = await applyOwnerDesignEdit(draftBusiness.id, draftBusiness.draftToken, ownerUid, {
      knob: e.knob as Parameters<typeof applyOwnerDesignEdit>[3]["knob"],
      value: e.value,
      op: e.op === "reset" ? "reset" : "set",
    });
    return jsonRes({
      ok: result.ok,
      reply: result.summary || "",
      messages: incoming,
      actions: [{ capability: "website", capabilityAction: "designKnob", args: { knob: e.knob, op: e.op || "set" }, ok: !!result.ok, real: !!result.real }],
      interimMessages: [],
      ...(result.error ? { error: result.error } : {}),
    });
  }

  // STYLE ONE ELEMENT — the contextual toolbar's save. Structured and model-free,
  // exactly like directRecordEdit and designEdit: the owner clicked a control on a
  // specific element, so there is nothing for a model to interpret.
  if (body?.styleEdit && typeof body.styleEdit === "object") {
    if (!draftBusiness) return jsonRes({ ok: false, error: "no_business" }, 400);
    const ownerUid = await getOwnerUid();
    if (!ownerUid) return jsonRes({ ok: false, error: "not_signed_in", reply: "You need to be signed in to change this." }, 401);
    const e = body.styleEdit as { label: string; on?: "element" | "section" | "page"; style: Record<string, string> };
    const result = await applyOwnerStyleEdit(draftBusiness.id, draftBusiness.draftToken, ownerUid, {
      label: String(e.label || ""),
      on: e.on === "section" ? "section" : e.on === "page" ? "page" : "element",
      style: (e.style && typeof e.style === "object") ? e.style : {},
    });
    return jsonRes({
      ok: result.ok,
      reply: result.summary || "",
      messages: incoming,
      actions: [{ capability: "website", capabilityAction: "styleElement", args: { label: e.label, on: e.on || "element" }, ok: !!result.ok, real: !!result.real }],
      interimMessages: [],
      ...(result.error ? { error: result.error } : {}),
    });
  }

  // UPGRADE THIS PAGE IN PLACE — the door restampFreeformPage never had.
  //
  // The pass has existed and worked for a while with ZERO callers, so the editor's
  // newer marks (section containers, recorded knob counts) reached only pages built
  // since they shipped: measured 2026-09-03, exactly 1 stored page of 138 carried
  // section stamps. That is a feature shipped for one test business.
  //
  // THE REAL RECORD IS NOT OPTIONAL. restampFreeformPage re-injects the page runtime,
  // and its defaults are `businessName: "this business"` and `slug: ""` — which would
  // rewrite every booking link on the page to `https://.myhubly.app/?book=1` and put
  // "this business" in the chat widget. The row is read here and passed in.
  if (body?.restampPage === true) {
    if (!draftBusiness) return jsonRes({ ok: false, error: "no_business" }, 400);
    const ownerUid = await getOwnerUid();
    if (!ownerUid) return jsonRes({ ok: false, error: "not_signed_in", reply: "You need to be signed in to update your page." }, 401);
    const bizRow = await (async () => {
      try {
        const url = (Deno.env.get("SUPABASE_URL") || "").trim();
        if (!url) return null;
        const res = await fetch(
          `${url}/rest/v1/businesses?id=eq.${encodeURIComponent(draftBusiness.id)}&select=owner_id,name,slug,brand_color&limit=1`,
          { headers: adminHeaders() },
        );
        if (!res.ok) return null;
        const rows = await res.json().catch(() => null);
        return Array.isArray(rows) ? rows[0] : null;
      } catch { return null; }
    })();
    if (!bizRow || String(bizRow.owner_id || "") !== String(ownerUid)) {
      return jsonRes({ ok: false, error: "not_owner", reply: "You don't have access to edit this business." }, 403);
    }
    // ASSERT THE VALUES WE ARE ABOUT TO BAKE IN. Re-injecting the runtime without a
    // slug writes booking links to `https://.myhubly.app` on every card — better to
    // decline the upgrade than to publish dead booking links across the page.
    if (!String(bizRow.slug || "").trim()) {
      return jsonRes({ ok: false, error: "no_slug", reply: "I couldn't update your page just now — its address is missing from your record." });
    }
    const r = await restampFreeformPage(draftBusiness.id, draftBusiness.draftToken, ownerUid, {
      businessName: String(bizRow.name || ""),
      slug: String(bizRow.slug || ""),
      accent: String(bizRow.brand_color || ""),
    });
    // Distinct answers, because "nothing to do" and "it failed" are different facts
    // and the client shows different things for them.
    return jsonRes({
      ok: !!r.ok,
      upgraded: !!(r.ok && !r.skipped && r.version),
      skipped: r.skipped || null,
      version: r.version || null,
      sections: r.sections ?? null,
      ...(r.error ? { error: r.error } : {}),
    }, r.ok ? 200 : 200);
  }

  // MOVE ANY NODE — the drag, and the arrows, which are now the same operation at
  // different grain. Structured and model-free: the owner dragged a specific block to
  // a specific place and there is nothing to interpret.
  if (body?.nodeMove && typeof body.nodeMove === "object") {
    if (!draftBusiness) return jsonRes({ ok: false, error: "no_business" }, 400);
    const ownerUid = await getOwnerUid();
    if (!ownerUid) return jsonRes({ ok: false, error: "not_signed_in", reply: "Sign in to move this." }, 401);
    const m = body.nodeMove as { node?: unknown; ref?: unknown; place?: string };
    const place = m.place === "before" ? "before" : m.place === "after" ? "after" : null;
    if (!place || !m.node || !m.ref) return jsonRes({ ok: false, error: "invalid_address", reply: "Can't move that" }, 400);
    const result = await applyOwnerNodeMove(draftBusiness.id, draftBusiness.draftToken, ownerUid, {
      node: m.node as never, ref: m.ref as never, place,
    });
    return jsonRes({
      ok: result.ok,
      reply: result.summary || "",
      messages: incoming,
      actions: [{ capability: "website", capabilityAction: "moveNode", args: { place }, ok: !!result.ok, real: !!result.real }],
      interimMessages: [],
      ...(result.raw ? { moveResult: result.raw } : {}),
      ...(result.error ? { error: result.error } : {}),
    });
  }

  // REMOVE A NODE.
  if (body?.nodeDelete && typeof body.nodeDelete === "object") {
    if (!draftBusiness) return jsonRes({ ok: false, error: "no_business" }, 400);
    const ownerUid = await getOwnerUid();
    if (!ownerUid) return jsonRes({ ok: false, error: "not_signed_in", reply: "Sign in to change this." }, 401);
    const result = await applyOwnerNodeDelete(draftBusiness.id, draftBusiness.draftToken, ownerUid, body.nodeDelete as never);
    return jsonRes({
      ok: result.ok,
      reply: result.summary || "",
      messages: incoming,
      actions: [{ capability: "website", capabilityAction: "deleteNode", args: {}, ok: !!result.ok, real: !!result.real }],
      interimMessages: [],
      ...(result.error ? { error: result.error } : {}),
    });
  }

  // MOVE A SECTION — the up/down arrows on the section toolbar. Structured and
  // model-free for the same reason as styleEdit: the owner pointed at a specific
  // band and pressed a direction, and there is nothing to interpret.
  if (body?.sectionMove && typeof body.sectionMove === "object") {
    if (!draftBusiness) return jsonRes({ ok: false, error: "no_business" }, 400);
    const ownerUid = await getOwnerUid();
    if (!ownerUid) return jsonRes({ ok: false, error: "not_signed_in", reply: "You need to be signed in to move a section." }, 401);
    const m = body.sectionMove as { label?: string; dir?: string };
    const dir = m.dir === "up" ? "up" : m.dir === "down" ? "down" : null;
    if (!dir) return jsonRes({ ok: false, error: "invalid_direction", reply: "I couldn't tell which way to move that section." }, 400);
    const result = await applyOwnerSectionMove(draftBusiness.id, draftBusiness.draftToken, ownerUid, {
      label: String(m.label || ""), dir,
    });
    return jsonRes({
      ok: result.ok,
      reply: result.summary || "",
      messages: incoming,
      actions: [{ capability: "website", capabilityAction: "moveSection", args: { label: m.label, dir }, ok: !!result.ok, real: !!result.real }],
      interimMessages: [],
      ...(result.raw ? { moveResult: result.raw } : {}),
      ...(result.error ? { error: result.error } : {}),
    });
  }

  if (directRecordEdit) {
    if (!draftBusiness) return jsonRes({ ok: false, error: "no_business" }, 400);
    const ownerUid = await getOwnerUid();
    if (!ownerUid) return jsonRes({ ok: false, error: "not_signed_in", reply: "You need to be signed in to edit this." }, 401);
    const result = await applyOwnerRecordEdit(draftBusiness.id, draftBusiness.draftToken, ownerUid, directRecordEdit);
    return jsonRes({
      ok: result.ok,
      reply: result.summary || "",
      messages: incoming,
      actions: [{ capability: "business", capabilityAction: "recordEdit", args: {}, ok: !!result.ok, real: !!result.real }],
      interimMessages: [],
      ...(result.error ? { error: result.error } : {}),
    });
  }

  if (directEdit || directImageEdit || directDocumentPatch || directDocumentImageEdit || directFreeformEdit || directFreeformImageEdit) {
    if (!draftBusiness) {
      return jsonRes({ ok: false, error: "no_draft_to_edit" }, 400);
    }
    const ownerUid = await getOwnerUid();   // memoized; one call per turn at most
    // Click-to-edit only ever operates on an already-generated document, so
    // this path can't structurally be reached while the feature is dark —
    // but checked explicitly anyway, same discipline as the other two
    // enforcement points, not relying on that precondition alone.
    // The freeform shapes belong here too. This guard listed only the two AST
    // ones, so a click-to-edit on a freeform page reached the server and wrote a
    // new version with the feature flag off — the flag turned off generation and
    // left editing running.
    if ((directDocumentPatch || directDocumentImageEdit || directFreeformEdit || directFreeformImageEdit) && !DOCUMENT_GENERATION_ENABLED) {
      return jsonRes({ ok: false, error: "document_generation_disabled" }, 400);
    }
    let result: { ok: boolean; real: boolean; summary: string; humanNote?: string; raw?: unknown; error?: string };
    let actionName: string;
    let isDocumentAction = false;
    if (directEdit) {
      actionName = "updateDraft";
      const found = findAction("business", "updateDraft");
      result = found
        ? await found.handler({ draftId: draftBusiness.id, draftToken: draftBusiness.draftToken, [directEdit.field]: directEdit.value })
        : { ok: false, real: false, summary: "That action is not available.", error: "unknown_action" };
      // updateDraft serves the model too, so its summary names DB columns and a
      // URL. The click knows exactly which field it changed; say that instead.
      if (result.ok) {
        result = { ...result, humanNote: `Done — ${DIRECT_EDIT_LABELS[directEdit.field] || "that"} updated.` };
      }
    } else if (directImageEdit) {
      actionName = "setHeroImage";
      result = await uploadDraftHeroImage(draftBusiness.id, draftBusiness.draftToken, directImageEdit.imageBase64, directImageEdit.mediaType);
    } else if (directDocumentImageEdit) {
      isDocumentAction = true;
      actionName = "patchDocument";
      result = await uploadAndPatchDocumentImage(draftBusiness.id, draftBusiness.draftToken, directDocumentImageEdit.id, directDocumentImageEdit.imageBase64, directDocumentImageEdit.mediaType, ownerUid);
    } else if (directFreeformImageEdit) {
      isDocumentAction = true;
      actionName = "patchDocument";
      result = await uploadAndPatchFreeformImage(draftBusiness.id, draftBusiness.draftToken, directFreeformImageEdit.label, directFreeformImageEdit.imageBase64, directFreeformImageEdit.mediaType, ownerUid);
    } else if (directFreeformEdit) {
      isDocumentAction = true;
      actionName = "patchDocument";
      result = await applyDirectFreeformEdit(draftBusiness.id, draftBusiness.draftToken, directFreeformEdit, ownerUid);
    } else {
      isDocumentAction = true;
      actionName = "patchDocument";
      result = await applyDirectDocumentPatch(draftBusiness.id, draftBusiness.draftToken, directDocumentPatch!, ownerUid);
    }
    // SAY WHAT HAPPENED. This path used to return reply: "" unconditionally and
    // throw away the summary it had already computed, so a real edit landed and
    // nothing acknowledged it. Silent success rather than silent failure, but
    // from the person's side those are the same thing — you did something, the
    // product said nothing, and you are left guessing whether it took.
    //
    // humanNote is what to say; summary is what to log. Failures fall back to
    // summary because their summaries are already written for a person
    // ("That edit could not be applied safely — nothing changed."). Success
    // must set humanNote, because its summary carries a version number and a
    // URL and reads like a receipt.
    return jsonRes({
      ok: true,
      reply: result.humanNote || result.summary || "",
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
        system: buildSystemPrompt(context, adapter.merge(currentUnderstanding, turnPatch), latestUserMessage, draftBusiness, selection),
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
        // THE INTERIM LINE IS SPOKEN BEFORE THE CAPABILITY HAS RUN, so it is a
        // PROMISE, not a result — and until now it was published whatever
        // happened next. Live on evergreen (2026-09-02): the model said "Done."
        // here, website.patchDocument then failed with patch_no_effect, and the
        // owner got "Done." and "nothing on the page changed" in the same turn —
        // two composers contradicting each other in one breath.
        //
        // So the line is HELD and only published if this invoke succeeded. On a
        // failure the reply carries the honest account alone; there is nothing
        // for the interim to add except a contradiction. The model's own history
        // still records what it said, so its next turn knows.
        const said = String(decision.message || "").trim();
        let heldInterimIndex = -1;
        if (said) {
          history.push({ role: "assistant", content: said });
          heldInterimIndex = interimMessages.push(said) - 1;
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
        // Membership of DRAFT_INJECTED_ACTIONS — see the audit at module load,
        // which names any action that needs a draft and is missing from it.
        const NEEDS_DRAFT_INJECTION = DRAFT_INJECTED_ACTIONS.has(`${capabilityName}.${actionName}`);
        if (NEEDS_DRAFT_INJECTION && draftBusiness) {
          dispatchArgs.draftId = draftBusiness.id;
          dispatchArgs.draftToken = draftBusiness.draftToken;
          // The verified owner (so a model-invoked write reaches a CLAIMED record —
          // the class fix: extraction had the owner, the model path didn't), and the
          // current user message (so the writer can GROUND each value: a phone or
          // price the model lifted from earlier in the transcript is refused, not
          // written). Both structural; redacted from the logged args below.
          dispatchArgs.ownerUid = await getOwnerUid();
          dispatchArgs._userMessage = latestUserMessage || "";
        }
        // THE SELECTED ELEMENT, INJECTED — never transcribed. The model is told the
        // element's NAME (so it can talk about it and say it back as a checksum) and
        // nothing else: the label, the node address and the fingerprint are structural,
        // exactly like draftId, and for the same reason — a model asked to reproduce an
        // address will eventually reproduce a different one, and the cost of that here
        // is a live page restyled in the wrong place. Redacted from the actions log below.
        if (SELECTION_INJECTED_ACTIONS.has(`${capabilityName}.${actionName}`) && selection) {
          dispatchArgs._selection = selection;
        }
        // Real page generation can run well past what a single request
        // should block on (confirmed live: 100-150+s, right at/over
        // Supabase's function timeout). generateDocument specifically runs
        // as a background task instead of being awaited here — the
        // capability result returned THIS turn is honestly "started", not
        // "done" (see its description in the registry, which the model
        // reads and is expected to say something honest about, like
        // "building now" rather than declaring it finished). The client
        // polls until the real version appears — through
        // get_public_business_document(slug, tag), NOT the table. The table
        // stopped being anon-readable when its unconditional `using (true)`
        // SELECT policy was dropped; the RPC is the only public route, and it
        // returns exactly (rendered_html, version), never the document column
        // in either format.
        let result;
        if (capabilityName === "website" && actionName === "generateDocument" && found) {
          // NOT waitUntil. See dispatchDocumentBuild for the whole argument, in
          // short: waitUntil rode the REQUEST isolate, the runtime recycles a
          // request isolate the moment it responds, and three of eight real
          // builds on 2026-08-18 were lost that way with no error and no trace.
          //
          // The job row is written and AWAITED first, so a build that never
          // arrives is still a build somebody recorded asking for. Everything
          // after this point can die without the loss becoming invisible.
          const buildBrief = String(dispatchArgs.brief || "").trim();
          const job = await startDocumentBuildJob(draftBusiness!.id, "website", buildBrief);
          dispatchDocumentBuild({
            draftId: draftBusiness!.id,
            draftToken: draftBusiness!.draftToken,
            brief: buildBrief,
            jobId: job?.jobId,
            ownerUid: await getOwnerUid(),
          });
          result = {
            ok: true,
            real: false,
            summary: "Real page generation started in the background — this takes about a minute to produce a complete, real page. It will appear as soon as it's ready.",
            raw: { status: "building", buildJobId: job?.jobId || null, expectedBy: job?.expectedBy || null },
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

        // THE OUTCOME IS NOW KNOWN — so the held promise is either earned or
        // dropped. Never both spoken and contradicted (see the hold above).
        // Removed outright rather than blanked: an empty slot is not a message, and
        // the call site below is guarded to pass `interimMessages` literally (see
        // tests/conversation-dedupe.test.mjs — the guard exists so nobody swaps
        // `history` back in), so the array itself is what has to be right. Safe to
        // splice: the held index is opened and resolved inside one loop pass, and
        // later pushes only ever append.
        if (heldInterimIndex >= 0 && !result?.ok) {
          console.warn(`interim line dropped — ${capabilityName}.${actionName} failed (${result?.error || "no error given"}); the reply carries the honest account`);
          interimMessages.splice(heldInterimIndex, 1);
        }

        // Capture the real draft identity the moment it exists — startDraft
        // returns it fresh; updateDraft just confirms it's still the same
        // draft. Either way, the response below must carry the current,
        // real value forward so the client can keep threading it.
        if (capabilityName === "business" && result.ok && result.real && result.raw) {
          const raw = result.raw as any;
          if (actionName === "startDraft" && raw.id && raw.draftToken && raw.slug) {
            draftBusiness = { id: String(raw.id), slug: String(raw.slug), draftToken: String(raw.draftToken), url: String(raw.url || "") };
            // THE FIRST MOMENT THERE IS A ROW TO WRITE TO.
            //
            // The turn carrying the facts is almost always the turn that creates
            // the business, so extraction has nowhere to put anything until
            // exactly here. Awaited, and placed before the loop can reach
            // generateDocument, because a fact written after the build lands on
            // a row the page was already rendered from.
            await flushExtractedFacts(draftBusiness.id, draftBusiness.draftToken);
            // COUNTABLE MISS. The intake message stated a price but extraction wrote
            // no structured priced service — the exact failure that shipped Summit
            // Auto Detail's page priceless and then asked for a price already given.
            // Record it now, at the one intake moment, so the miss rate is a row we
            // can watch rather than something Adrian finds on a bare page days later.
            // NOT a claim about a person — an internal signal about our extraction.
            const intakePricedCount = pendingPricedServices.filter((s) => typeof s.price === "number").length;
            if (intakePriceSignal && intakePricedCount === 0) {
              const u = (Deno.env.get("SUPABASE_URL") || "").trim();
              if (u) await fetch(`${u}/rest/v1/rpc/record_price_extraction_miss`, {
                method: "POST", headers: { ...adminHeaders(), "content-type": "application/json" },
                body: JSON.stringify({ p_business_id: draftBusiness.id, p_had_signal: true, p_structured: 0, p_detail: `intake; names=${pendingPricedServices.length} priced=0` }),
              }).catch(() => {});
            }
          } else if ((actionName === "updateDraft" || actionName === "setServices") && draftBusiness && raw.id) {
            draftBusiness = { ...draftBusiness, url: String(raw.url || draftBusiness.url) };
          }
        }

        try {
          const rc = (result as { raw?: { recordChange?: unknown } } | null)?.raw?.recordChange;
          if (Array.isArray(rc)) for (const c of rc) if (typeof c === "string") recordChanges.add(c);
        } catch (_e) { /* instrumentation must never fail a turn */ }

        // setServices on a FREEFORM page: the page was patched synchronously in the
        // handler. Compose the read-back from what ACTUALLY landed (names + prices +
        // where), and record a countable outcome — the same discipline as the photo
        // path. This is what makes findings #3 (prices never read back) and #5 ("on
        // the site" doesn't say where) true instead of hopeful.
        if (capabilityName === "business" && actionName === "setServices" && result?.ok) {
          try {
            const placement = (result.raw as { services?: ServicesPlacementLike } | undefined)?.services;
            const url = String((result.raw as { url?: string } | undefined)?.url || (draftBusiness?.url || ""));
            if (placement && placement.status !== "not_freeform") {
              const truth = composeServicesTruth(placement, url);
              if (truth) servicesTruth = truth;
              // Loud + countable: a price that saved but didn't appear is a row we
              // can query, never a silence.
              const landed = placement.status === "placed" || placement.status === "partial" || placement.status === "no_prices";
              if (!landed) console.error(`services placement [${draftBusiness?.id}] -> ${placement.status} [DID NOT LAND]`);
              // Record which placement path ran (anchor vs the legacy heading
              // matcher) so we can watch the legacy path fall out of use as anchored
              // pages replace pre-anchor ones (finding #8).
              const p = placement.paths;
              const pathBit = p ? `paths anchor=${p.anchor} legacy=${p.legacy} inserted=${p.inserted ?? 0}` : "";
              // How many anchors had to be stamped at PATCH time because the page
              // arrived unanchored (services came after the build). This is the
              // retroactive-stamp gap made countable: watch it stay high while old
              // pre-anchor pages dominate, then fall as build-time capture lands.
              const retroBit = placement.retroAnchored ? `retroAnchored=${placement.retroAnchored}` : "";
              // Loud + countable: our own markup leaking into visible text is a hard
              // invariant breach, recorded on the row so it can never ship silently.
              const leakBit = placement.leakedAttrText ? `LEAKED_ATTR_TEXT=${placement.leakedAttrText}` : "";
              const insBit = (placement.inserted || []).length ? `inserted=${(placement.inserted || []).join(",")}` : "";
              const missBit = (placement.missing || []).length ? `missing=${(placement.missing || []).join(",")}` : "";
              const detail = [pathBit, retroBit, leakBit, insBit, missBit].filter(Boolean).join("; ") || placement.detail || null;
              const u = (Deno.env.get("SUPABASE_URL") || "").trim();
              if (u && draftBusiness?.id) await fetch(`${u}/rest/v1/rpc/record_rebuild_outcome`, {
                method: "POST", headers: { ...adminHeaders(), "content-type": "application/json" },
                body: JSON.stringify({ p_business_id: draftBusiness.id, p_changes: "services-placement", p_status: placement.status, p_detail: detail, p_landed: landed }),
              });
            }
          } catch (_e) { /* the read-back is best-effort; never fail the turn on it */ }
        }

        actions.push({
          capability: capabilityName,
          capabilityAction: actionName,
          // draftToken is a write credential, not display data — never echo
          // it back inside the actions log even though the client already
          // has it (draftBusiness below is the one legitimate place it travels).
          args: (() => {
            if (!dispatchArgs.draftToken && !dispatchArgs._ownerToken && dispatchArgs._storefrontAst === undefined
                && dispatchArgs.ownerUid === undefined && dispatchArgs._userMessage === undefined
                && dispatchArgs._selection === undefined) return dispatchArgs;
            const a: Record<string, unknown> = { ...dispatchArgs };
            if (a.draftToken) a.draftToken = "[redacted]";
            if (a._ownerToken) a._ownerToken = "[redacted]";
            if (a._storefrontAst !== undefined) a._storefrontAst = "[omitted]";
            if (a.ownerUid !== undefined) a.ownerUid = "[redacted]";       // verified identity, not display data
            if (a._userMessage !== undefined) a._userMessage = "[omitted]"; // structural (grounding), not display data
            // The selection is a label, a node path and a fingerprint — structural, and
            // long. Keep the NAME, because that is the one part worth reading back in a
            // log ("which element did this turn act on"), and drop the rest.
            if (a._selection !== undefined) a._selection = (a._selection as { name?: string })?.name || "[omitted]";
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
      // CONTACT / HOURS placement runs SYNCHRONOUSLY (like setServices), so this
      // turn can read back exactly what landed on the page — the background rebuild
      // below fires after the reply and can't. It is a targeted patch (insert the
      // block / update an anchor), safe to run even on an owner-edited page, and it
      // writes a 'patch' version so Undo reverses it. We then drop contact/hours
      // from recordChanges so the background rebuild doesn't re-place them.
      let contactHoursTruth = "";
      if ((recordChanges.has("contact") || recordChanges.has("hours")) && draftBusiness?.id) {
        try {
          const ch = await applyContactHoursToFreeform(draftBusiness.id, draftBusiness.draftToken, await getOwnerUid());
          contactHoursTruth = composeContactHoursTruth(ch);
          const landed = ch.status === "patched";
          const line = `contact/hours placement [${draftBusiness.id}] -> ${ch.status} (${ch.detail})${landed ? "" : " [DID NOT LAND]"}`;
          if (ch.status === "failed") console.error(line); else console.log(line);
          try {
            const u = (Deno.env.get("SUPABASE_URL") || "").trim();
            if (u) await fetch(`${u}/rest/v1/rpc/record_rebuild_outcome`, {
              method: "POST", headers: { ...adminHeaders(), "content-type": "application/json" },
              body: JSON.stringify({ p_business_id: draftBusiness.id, p_changes: "contact-hours-placement", p_status: ch.status, p_detail: ch.detail || null, p_landed: landed }),
            });
          } catch (_e) { /* telemetry must never fail the turn */ }
        } catch (e) { console.error("contact/hours placement failed", e); }
        recordChanges.delete("contact");
        recordChanges.delete("hours");
      }

      let rebuildSkippedNote = "";
      if (recordChanges.size && draftBusiness?.id && draftBusiness?.draftToken) {
        const changes = [...recordChanges] as RecordChange[];
        const contentful = changes.some((c) => c !== "cosmetic");
        const ownerEdited = contentful ? await documentHasOwnerEdits(draftBusiness.id) : false;
        if (ownerEdited) {
          rebuildSkippedNote =
            " Your page has manual edits, so I have not rebuilt it — the new details are saved on your record. Want me to rebuild the page around them?";
        } else {
          const rebuild = rebuildDocumentFromRecord(draftBusiness.id, draftBusiness.draftToken, changes, await getOwnerUid())
            .then(async (r) => {
              // Did a NEW version actually result? Only these three states produce one.
              const landed = ["rebuilt", "rerendered", "patched"].includes(r.status);
              const line = `record rebuild [${draftBusiness.id}] ${changes.join(",")} -> ${r.status}${r.detail ? " (" + r.detail + ")" : ""}${landed ? "" : " [DID NOT LAND]"}`;
              if (landed) console.log(line); else console.error(line);
              // LOUD + COUNTABLE. A rebuild that was triggered but produced no new
              // version is the invisible failure (a photo that stores and never
              // appears). Record every outcome so "how often did a rebuild not
              // land" is a query, same discipline as planner_fallback_events.
              try {
                const u = (Deno.env.get("SUPABASE_URL") || "").trim();
                if (u) await fetch(`${u}/rest/v1/rpc/record_rebuild_outcome`, {
                  method: "POST",
                  headers: { ...adminHeaders(), "content-type": "application/json" },
                  body: JSON.stringify({ p_business_id: draftBusiness.id, p_changes: changes.join(","), p_status: r.status, p_detail: r.detail || null, p_landed: landed }),
                });
              } catch (_e) { /* telemetry must never fail the turn */ }
            })
            .catch((e) => console.error("record rebuild failed", e));
          try {
            const rt = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
            if (rt && typeof rt.waitUntil === "function") rt.waitUntil(rebuild);
          } catch (_e) { /* best effort — it still runs, just not guaranteed past the response */ }
        }
      }

      const deduped = dedupeConversationMessages(interimMessages, finalText, priorAssistantSaid);
      // rebuildSkippedNote is empty unless a rebuild was refused over the
      // owner's manual edits, in which case they are told and offered one.
      // FIX 4: on a photo-upload turn, the truth about what landed on the page
      // OVERRIDES whatever the model composed — the model can't see the image and
      // used to deny a real placement. photoTruth is uploadDraftPhoto's own
      // owner-facing summary of what it actually did. servicesTruth is the same
      // for a freeform setServices turn: the price read-back is what the patch
      // actually did (findings #3 + #5), so it replaces the model's paraphrase
      // which dropped the numbers and the location.
      // contactHoursTruth is the page read-back for hours/contact — it overrides a
      // vague model reply when it's the only truth, and is appended when another
      // truth (services/photo) already leads.
      const primaryReply = photoTruth || servicesTruth || contactHoursTruth || deduped.reply || "";
      const extraTruth = (contactHoursTruth && primaryReply !== contactHoursTruth) ? " " + contactHoursTruth : "";
      // A REPLACED fact is named whatever else the turn did. Appended, never
      // substituted: the model's reply may be answering something else entirely,
      // and the change still has to be visible (guard 2). Only when the model
      // hasn't already stated the new value itself.
      const valuesAlreadyStated = recordChangeValues.length > 0 &&
        recordChangeValues.every((v) => primaryReply.includes(v));
      const changeTruth = (recordChangeTruth && !valuesAlreadyStated)
        ? ` Noted — ${recordChangeTruth}.`
        : "";
      const finalReply = primaryReply + extraTruth + changeTruth + rebuildSkippedNote;
      // NOTE: the "offer the price-list photo ONCE per conversation" rule is enforced on the
      // CLIENT (hcOncePhotoOffer), not here: the first ask is a post_build turn whose reply is
      // never threaded back into `messages`, so this handler can't see it to know the offer was
      // already made. The client displays every reply, so it is the one place that can.
      // NOTE: the transcript is written by the CLIENT, not here — it stores what
      // the person actually saw as Hubly's voice (on a build turn that's the
      // narration in interimMessages, not this reply field, which is the
      // exhausted-rounds fallback). See platform-home.html hcPersist.
      return jsonRes({
        ok: true,
        reply: finalReply,
        messages: history,
        actions,
        interimMessages: deduped.interim,
        ...(concepts.length ? { concepts } : {}),
        ...(decision?.askInspiration === true ? { askInspiration: true } : {}),
        ...(decision?.askLogo === true ? { askLogo: true } : {}),
        ...(decision?.openAccount === true ? { openAccount: true } : {}),
        ...(["services", "hours", "area", "phone", "logo", "photos"].includes(decision?.askedFor) ? { askedFor: decision.askedFor } : {}),
        ...(adapter.isEmpty(turnPatch) ? {} : { understanding: { patch: turnPatch } }),
        ...(draftBusiness ? { draftBusiness } : {}),
        ...(buildResumed ? { buildResumed } : {}),
        ...(bookingConfirmation ? { bookingConfirmation } : {}),
        ...(draftGrant ? { draftGrant } : {}),
        ...(storefrontAstOut !== undefined ? { storefrontAst: storefrontAstOut } : {}),
      });
    }

    // Exhausted capability rounds without a final natural-language reply —
    // stop honestly instead of looping forever.
    const exhaustedReply = "I've gathered what I can for now — what would you like to do next?";
    return jsonRes({
      ok: true,
      reply: exhaustedReply,
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
    // The message, not the stack. A 502 with no detail is a bug you debug by
    // guessing; this one cost a round of bisecting-by-deploy to find. Message
    // only, and only the first 300 characters -- an exception string can carry
    // a query or a payload fragment, and this response is public.
    return jsonRes({
      ok: false,
      error: "Hubly Conversation is temporarily unavailable.",
      detail: String((err as { message?: unknown })?.message ?? err).slice(0, 300),
      // The upstream HTTP status when there is one. A number, never a body:
      // "OpenAI is temporarily unavailable" is true of a 429 quota exhaustion,
      // a 500, and a 401 from a rotated key, and those are three completely
      // different problems that took a deploy each to tell apart.
      ...(typeof (err as { status?: unknown })?.status === "number" ? { upstreamStatus: (err as { status: number }).status } : {}),
    }, 502);
  }
});
