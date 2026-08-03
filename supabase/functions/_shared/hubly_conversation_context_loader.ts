// supabase/functions/_shared/hubly_conversation_context_loader.ts
//
// The Context Loader — the ONLY place that touches a data source on
// behalf of Hubly Conversation. Per docs/HUBLY_CONVERSATION_CONTEXT_MODEL.md:
// the engine should know nothing about where data comes from. It requests
// a Conversation Context and reasons over the four things a Context
// Loader returns: Ground Truth, Session Understanding, Capabilities, and
// Policies. Adding a new experience means adding a new Context Loader —
// never changing the engine.
//
// This file defines that contract, plus the first real loader
// (loadConciergeContext), extracted from chatbot-message/index.ts's
// inline knowledge-gathering block. It is not yet wired into
// hubly-conversation's engine (that's a later migration step — see
// docs/HUBLY_CONVERSATION_MULTI_CONTEXT_MIGRATION.md Part 4) and
// chatbot-message has not been repointed at it in production yet either.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { toAiSummary } from "./service_engine.ts";
import { findAction } from "./hubly_capability_registry.ts";

// --- The Conversation Context contract -------------------------------

export type CapabilityId = string; // "<capabilityName>.<actionName>", e.g. "booking.create"

export type ConversationContextPolicies = {
  /** null = no rate limiting applies to this context (e.g. an authenticated-owner context). */
  rateLimit: { maxMessagesPerConversation: number; maxConversationsPerHour: number } | null;
  /** null = tier gating doesn't apply to this context. */
  tierGating: { tier: string; isPro: boolean } | null;
  /**
   * Describes intent only — no shared persistence adapter exists yet
   * (Migration Plan Part 4, Step 2). `table` names where this context's
   * conversations persist TODAY, outside this loader, so the intent is
   * traceable back to real code, not invented.
   */
  persistence: { enabled: boolean; table?: string } | null;
};

export type ConversationContext<GroundTruth = unknown, SessionUnderstanding = unknown> = {
  /** Real, already-known data this context's answers must be grounded in. Loaded fresh, never accumulated. */
  groundTruth: GroundTruth;
  /** Patch-based accumulation about whoever the engine is currently talking to. null where no accumulation mechanism exists yet — never fabricated to fill the shape. */
  sessionUnderstanding: SessionUnderstanding | null;
  /** Already filtered against the live Capability Registry — every id here is real and invocable today, not aspirational. */
  capabilities: CapabilityId[];
  policies: ConversationContextPolicies;
};

export type ContextLoaderResult<GroundTruth = unknown, SessionUnderstanding = unknown> =
  | { ok: true; context: ConversationContext<GroundTruth, SessionUnderstanding> }
  | { ok: false; error: string };

/** A Context Loader is any function matching this shape — one per experience. */
export type ContextLoader<Input, GroundTruth = unknown, SessionUnderstanding = unknown> = (
  input: Input,
) => Promise<ContextLoaderResult<GroundTruth, SessionUnderstanding>>;

/**
 * Filters a context's intended capability allow-list down to what's
 * actually real today, by checking each id against the live Capability
 * Registry. This is the dispatch-level enforcement point described in
 * HUBLY_CONVERSATION_CONTEXT_MODEL.md Section 6 — a context can only ever
 * end up with capabilities that genuinely exist, never an aspirational
 * name that happens to also be in its allow-list.
 */
export function resolveCapabilities(allowList: CapabilityId[]): CapabilityId[] {
  return allowList.filter((id) => {
    const [capabilityName, actionName] = id.split(".");
    return !!findAction(capabilityName, actionName);
  });
}

// --- Concierge context: Ground Truth shape ----------------------------

export type ConciergeGroundTruth = {
  business: { name: string; phone: string; email: string };
  services: ReturnType<typeof toAiSummary>;
  faq: Array<{ q: string; a: string }>;
  hours: Record<string, { open?: string; close?: string; closed?: boolean }> | null;
  cities: string[];
};

// The capability set Concierge is meant to reach once these Registry
// entries exist (docs/AI_CONCIERGE_DESIGN.md Section 6, Items 2 and 5).
// Every id is resolved against the live registry in resolveCapabilities()
// below, so this list is honest today even though none of them are
// registered yet — capabilities will start appearing here the moment
// they're added to the Registry, with zero change needed in this file.
const CONCIERGE_CAPABILITY_ALLOWLIST: CapabilityId[] = [
  "storefront.getServices",
  "booking.getAvailability",
  "booking.create",
  "crm.captureLead",
];

/**
 * Loads the Concierge Conversation Context for one business — the same
 * data chatbot-message/index.ts currently hand-assembles inline (business
 * row, FAQ, hours, service area, service catalog summary). Ground Truth
 * only: this loader does not touch chatbot_conversations/chatbot_messages
 * (that's session state, not ground truth) and does not implement rate
 * limiting or persistence — it only describes those policies, per the
 * Context Loader contract. sessionUnderstanding is null: no visitor-need
 * accumulation mechanism exists yet (HUBLY_CONVERSATION_CONTEXT_MODEL.md
 * Section 7), so this loader doesn't invent one to fill the shape.
 */
export async function loadConciergeContext(
  supabase: SupabaseClient,
  businessId: string,
): Promise<ContextLoaderResult<ConciergeGroundTruth, null>> {
  const { data: biz, error } = await supabase
    .from("businesses")
    .select("name, phone, email, tier, meta, service_area_cities")
    .eq("id", businessId)
    .single();
  if (error || !biz) {
    return { ok: false, error: "Business not found." };
  }

  const meta = typeof biz.meta === "string" ? JSON.parse(biz.meta || "{}") : (biz.meta || {});
  const faq = Array.isArray(meta?.website?.faq) ? meta.website.faq : [];
  const hours = meta?.hours || null;
  const cities = Array.isArray(biz.service_area_cities) ? biz.service_area_cities : [];
  const isPro = biz.tier === "pro";
  const services = toAiSummary({ ...biz, meta }, "website");

  return {
    ok: true,
    context: {
      groundTruth: {
        business: { name: biz.name, phone: biz.phone, email: biz.email },
        services,
        faq,
        hours,
        cities,
      },
      sessionUnderstanding: null,
      capabilities: resolveCapabilities(CONCIERGE_CAPABILITY_ALLOWLIST),
      policies: {
        rateLimit: { maxMessagesPerConversation: 30, maxConversationsPerHour: 20 },
        tierGating: { tier: biz.tier, isPro },
        persistence: { enabled: true, table: "chatbot_conversations" },
      },
    },
  };
}
