/**
 * Shadow-mode routing comparison — Phase 1.
 *
 * The router runs beside the live system and changes NOTHING. This module answers
 * the only question Phase 1 exists to answer:
 *
 *   Where does surface-driven routing disagree with intent-driven routing,
 *   and where is the new router uncertain?
 *
 * It is pure and side-effect free. The caller decides whether to persist a record
 * (see the ai_routing_shadow_log migration) — that separation is what guarantees
 * shadow mode cannot alter behaviour even if persistence fails.
 *
 * PRIVACY: utterances are redacted before they leave this module, and are dropped
 * entirely for customer-facing conversations. Business/session identifiers are
 * logged as ids, never as names. No customer PII is recorded.
 */

import type { CapabilityPlan, RouterInput, SurfaceId } from "./hubly_intent_router.ts";
import { buildPlan } from "./hubly_intent_router.ts";

/** What the CURRENT system would do, derived from the surface alone — which is
 *  precisely the defect under measurement (`if (S._edHubTab === 'store')`). */
export const LEGACY_CONTEXT_ALLOWLIST: Record<string, string[]> = {
  dashboard: ["website", "online_presence", "business"],
  customer: ["booking"],
  operate: ["storefront", "sessions"],
};

export type LegacyContext = "dashboard" | "customer" | "operate";

/** The surface→context mapping the client uses today. */
export function legacyContextForSurface(surface: SurfaceId, actorKind: string): LegacyContext {
  if (actorKind === "customer") return "customer";
  if (surface === "store" || surface === "sessions" || surface === "operate") return "operate";
  return "dashboard";
}

export type ShadowComparison = {
  /** Redacted. Null for customer conversations. */
  utterance: string | null;
  utterance_length: number;
  surface_hint: SurfaceId;
  actor_kind: string;
  business_id: string | null;

  legacy: { context: LegacyContext; capabilities: string[] };
  router: {
    intent: string;
    confidence: number;
    capabilities: string[];
    asked: boolean;
    ask_resolves: string | null;
    requires_confirmation: boolean;
    steps: string[];
    rationale: string;
  };

  /** The headline metric. */
  agreement: "match" | "router_narrower" | "router_wider" | "disagree" | "router_unclear";
  capabilities_only_in_router: string[];
  capabilities_only_in_legacy: string[];
  why: string;

  /** Context that was available to the router — for judging whether a question was fair. */
  context_available: {
    has_business: boolean;
    has_business_type: boolean;
    has_dna: boolean;
    tier: string | null;
    enabled_capabilities: string[];
    state_summary: Record<string, number | boolean | string>;
  };
};

/** Strip anything that could identify a person. Deliberately aggressive. */
export function redactUtterance(raw: string): string {
  return String(raw || "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[phone]")
    .replace(/\b\d{1,5}\s+[A-Z][a-z]+\s+(St|Street|Ave|Avenue|Rd|Road|Ln|Lane|Blvd|Dr|Drive)\b/g, "[address]")
    .replace(/\bhttps?:\/\/\S+/g, "[url]")
    .slice(0, 400);
}

export function compareRouting(input: RouterInput): { plan: CapabilityPlan; comparison: ShadowComparison } {
  const plan = buildPlan(input);
  const legacyContext = legacyContextForSurface(input.surfaceHint ?? null, input.actor.kind);
  const legacyCaps = LEGACY_CONTEXT_ALLOWLIST[legacyContext] ?? [];
  const routerCaps = plan.capabilities;

  const onlyRouter = routerCaps.filter((c) => !legacyCaps.includes(c));
  const onlyLegacy = legacyCaps.filter((c) => !routerCaps.includes(c));

  let agreement: ShadowComparison["agreement"];
  let why: string;
  if (plan.intent === "unclear") {
    agreement = "router_unclear";
    why = plan.ask ? "router asked one clarifying question instead of guessing" : "no intent matched";
  } else if (!routerCaps.length) {
    agreement = "router_unclear";
    why = "router produced no capabilities (diagnostic or declined)";
  } else if (onlyRouter.length === 0 && onlyLegacy.length === 0) {
    agreement = "match";
    why = "identical capability sets";
  } else if (onlyRouter.length === 0) {
    agreement = "router_narrower";
    why = `router scoped to ${routerCaps.join("+")} where the surface would have allowed ${legacyCaps.join("+")}`;
  } else if (onlyRouter.every((c) => !legacyCaps.includes(c)) && routerCaps.some((c) => legacyCaps.includes(c))) {
    agreement = "router_wider";
    why = `router needs ${onlyRouter.join("+")} which this surface cannot reach — cross-capability request`;
  } else {
    agreement = "disagree";
    why = `surface-driven routing would have used ${legacyCaps.join("+")}; intent is "${plan.intent}" needing ${routerCaps.join("+")}`;
  }

  const b = input.business;
  return {
    plan,
    comparison: {
      utterance: input.actor.kind === "customer" ? null : redactUtterance(input.utterance),
      utterance_length: String(input.utterance || "").length,
      surface_hint: input.surfaceHint ?? null,
      actor_kind: input.actor.kind,
      business_id: b?.id ?? null,
      legacy: { context: legacyContext, capabilities: legacyCaps },
      router: {
        intent: plan.intent,
        confidence: Number(plan.confidence.toFixed(2)),
        capabilities: routerCaps,
        asked: !!plan.ask,
        ask_resolves: plan.ask?.resolves ?? null,
        requires_confirmation: plan.requires_confirmation,
        steps: plan.steps.map((s) => `${s.capability}.${s.action}`),
        rationale: plan.rationale,
      },
      agreement,
      capabilities_only_in_router: onlyRouter,
      capabilities_only_in_legacy: onlyLegacy,
      why,
      context_available: {
        has_business: !!b,
        has_business_type: !!b?.identity.businessType,
        has_dna: !!b?.dna,
        tier: b?.entitlements.tier ?? null,
        enabled_capabilities: b ? Object.entries(b.entitlements.capabilities).filter(([, v]) => v).map(([k]) => k) : [],
        state_summary: b
          ? {
              services: b.state.serviceCount,
              products: b.state.productCount,
              website: b.state.hasWebsiteDocument,
              open_sessions: b.state.openSessionCount,
              unbooked_leads: b.state.unbookedLeadCount,
              marketplace: b.state.marketplaceProvider,
            }
          : {},
      },
    },
  };
}

/** Human-readable, for reading a shadow run at a glance. */
export function formatComparison(c: ShadowComparison): string {
  const mark = { match: "=", router_narrower: "~", router_wider: "+", disagree: "!", router_unclear: "?" }[c.agreement];
  return [
    `${mark} "${c.utterance ?? "[customer turn — content not logged]"}"`,
    `    surface: ${c.surface_hint ?? "none"}  →  legacy: ${c.legacy.context} [${c.legacy.capabilities.join(", ")}]`,
    `    router : ${c.router.intent} (${c.router.confidence}) [${c.router.capabilities.join(", ") || "—"}]` +
      (c.router.asked ? `  ASK→${c.router.ask_resolves}` : "") +
      (c.router.requires_confirmation ? "  CONFIRM" : ""),
    `    ${c.agreement.toUpperCase()}: ${c.why}`,
  ].join("\n");
}
