/**
 * Hubly Intent Router — Phase 1 (SHADOW MODE).
 *
 * Turns "what the person said" into a capability PLAN. It never executes, never
 * grants a permission, and in Phase 1 nothing acts on its output: it runs
 * alongside the existing routing so we can measure disagreement on real traffic
 * before changing behaviour.
 *
 * THE AUTHORIZATION RULE (non-negotiable):
 *   The router RECOMMENDS capabilities. It cannot grant itself any.
 *   Dispatch independently re-verifies, in this order, every time:
 *     requested capability → business capability → entitlement → context → action auth → execute
 *   A plan is a request, never a credential.
 *
 * Deliberately PURE: no database, no network, no model call. The caller supplies
 * BusinessContext; this file only decides. That makes the whole thing testable
 * offline with no API key, which is why the scenario matrix can run in CI.
 *
 * The model may later refine classification (see `classifierHint`), but it is an
 * input to scoring — never the authority, and never able to add a capability the
 * intent registry didn't already declare.
 */

import type { BusinessDna } from "./hubly_business_dna.ts";
import { tradeSellsProducts } from "./hubly_business_dna.ts";

/* ────────────────────────── inputs ────────────────────────── */

export type ActorKind = "anonymous" | "owner" | "customer";
export type SurfaceId =
  | "landing" | "website" | "store" | "sessions" | "calendar"
  | "jobs" | "leads" | "marketplace" | "operate" | null;

export type BusinessState = {
  hasWebsiteDocument: boolean;
  hasStorefrontAst: boolean;
  serviceCount: number;
  productCount: number;
  photoCount: number;
  hasLogo: boolean;
  hasBrandColor: boolean;
  hasStripeConnect: boolean;
  hasGoogleCalendar: boolean;
  openSessionCount: number;
  upcomingJobCount: number;
  customerCount: number;
  /** Quoted / enquired and never booked — the real audience for follow-up. */
  unbookedLeadCount: number;
  marketplaceProvider: "none" | "draft" | "pending" | "live";
};

export type BusinessContext = {
  id: string;
  identity: { name: string | null; businessType: string | null; accent: string | null; city: string | null };
  dna: BusinessDna | null;
  entitlements: { tier: "starter" | "pro"; capabilities: Record<string, boolean> };
  state: BusinessState;
};

export type RouterInput = {
  utterance: string;
  history?: { role: "user" | "assistant"; content: string }[];
  actor: { kind: ActorKind };
  business: BusinessContext | null;
  surfaceHint?: SurfaceId;
  intentSeed?: IntentId | null;
  /** Optional prior from hubly-intent-classify. A nudge, never a decision. */
  classifierHint?: { intent: "business" | "marketplace" | "ambiguous"; confidence: number } | null;
};

/* ────────────────────────── intent registry ────────────────────────── */

export type IntentId =
  | "create_website" | "refine_website" | "apply_design_reference"
  | "create_storefront" | "refine_storefront"
  | "enable_commerce" | "create_product" | "design_product_store"
  | "create_one_off_session" | "modify_session" | "publish_session" | "promote_session" | "session_status"
  | "configure_booking" | "reschedule_appointment"
  | "find_pro" | "join_marketplace"
  | "create_followup" | "daily_briefing"
  | "lead_query" | "revenue_report"
  | "grow_demand" | "build_my_business" | "unclear";

export type IntentDef = {
  id: IntentId;
  label: string;
  capabilities: string[];
  primary: string;
  consequential: boolean;
  actorKinds: ActorKind[];
  /** Surfaced as a landing-page prompt (§J) when executable for the actor. */
  landingPrompt?: boolean;
  composite?: IntentId[];
  /** Scored, weighted phrases. Longer phrases win over bare keywords. */
  match: { phrases: string[]; weight: number }[];
  /** Surfaces where this intent is a touch more likely. A prior, capped. */
  surfaceAffinity?: SurfaceId[];
};

const W_STRONG = 10, W_MED = 6, W_WEAK = 3;

export const INTENTS: IntentDef[] = [
  {
    id: "create_website", label: "Build my website", capabilities: ["business", "website"],
    primary: "website", consequential: false, actorKinds: ["anonymous", "owner"], landingPrompt: true,
    surfaceAffinity: ["website", "landing"],
    match: [
      { phrases: ["build me a website", "build my website", "make me a website", "create a website", "i need a website", "want a website"], weight: W_STRONG },
      { phrases: ["website", "web site", "homepage", "web page"], weight: W_WEAK },
    ],
  },
  {
    id: "refine_website", label: "Change my website", capabilities: ["website"],
    primary: "website", consequential: false, actorKinds: ["owner"],
    surfaceAffinity: ["website"],
    match: [
      { phrases: ["make it more", "make the hero", "change the", "make my website", "更"], weight: W_MED },
      { phrases: ["premium", "bolder", "cleaner", "warmer", "modern", "minimal"], weight: W_WEAK },
    ],
  },
  {
    id: "apply_design_reference", label: "Use a site as inspiration", capabilities: ["website"],
    primary: "website", consequential: false, actorKinds: ["anonymous", "owner"],
    surfaceAffinity: ["website"],
    match: [
      { phrases: ["as inspiration", "like this site", "like this website", "make it feel like", "look like this", "inspired by"], weight: W_STRONG },
      { phrases: ["inspiration", "reference", "screenshot"], weight: W_WEAK },
    ],
  },
  {
    id: "create_storefront", label: "Build my storefront", capabilities: ["business", "website"],
    primary: "website", consequential: false, actorKinds: ["anonymous", "owner"],
    match: [
      { phrases: ["need a storefront", "build my storefront", "create a storefront", "want a storefront", "my storefront"], weight: W_STRONG },
      { phrases: ["storefront", "shop front", "public page", "online presence"], weight: W_WEAK },
    ],
  },
  {
    id: "refine_storefront", label: "Change my storefront", capabilities: ["website"],
    primary: "website", consequential: false, actorKinds: ["owner"],
    match: [{ phrases: ["change my storefront", "update my storefront"], weight: W_MED }],
  },
  {
    id: "enable_commerce", label: "Start selling products", capabilities: ["storefront"],
    primary: "storefront", consequential: false, actorKinds: ["owner"], landingPrompt: true,
    surfaceAffinity: ["store"],
    match: [
      { phrases: ["want to sell", "start selling", "i sell", "sell products", "sell merch", "sell prints", "sell shirts"], weight: W_STRONG },
      { phrases: ["store", "shop", "products", "merch", "prints", "inventory"], weight: W_WEAK },
    ],
  },
  {
    id: "create_product", label: "Add a product", capabilities: ["storefront"],
    primary: "storefront", consequential: false, actorKinds: ["owner"],
    surfaceAffinity: ["store"],
    match: [{ phrases: ["add a product", "create a product", "new product", "add a "], weight: W_MED }],
  },
  {
    id: "design_product_store", label: "Design my product store", capabilities: ["storefront"],
    primary: "storefront", consequential: false, actorKinds: ["owner"],
    surfaceAffinity: ["store"],
    match: [{ phrases: ["design my store", "build my store", "lay out my store", "design the store"], weight: W_STRONG }],
  },
  {
    id: "create_one_off_session", label: "Create a One-Off Session", capabilities: ["sessions", "calendar", "payments"],
    primary: "sessions", consequential: false, actorKinds: ["owner"], landingPrompt: true,
    surfaceAffinity: ["sessions", "calendar"],
    match: [
      { phrases: ["mini sessions", "mini session", "wash day", "service day", "one-off session", "open up", "i'm doing", "im doing", "i am doing"], weight: W_STRONG },
      { phrases: ["sessions", "event", "slots", "back to back"], weight: W_WEAK },
    ],
  },
  {
    id: "modify_session", label: "Change a session", capabilities: ["sessions"],
    primary: "sessions", consequential: false, actorKinds: ["owner"],
    surfaceAffinity: ["sessions"],
    match: [{ phrases: ["make them $", "change the deposit", "extend it", "make them ", "make the deposit"], weight: W_MED }],
  },
  {
    id: "publish_session", label: "Publish a session", capabilities: ["sessions", "calendar"],
    primary: "sessions", consequential: true, actorKinds: ["owner"],
    match: [{ phrases: ["publish it", "publish the session", "go live", "make it live"], weight: W_STRONG }],
  },
  {
    id: "promote_session", label: "Put my session on my website", capabilities: ["sessions", "storefront"],
    primary: "sessions", consequential: false, actorKinds: ["owner"],
    match: [
      { phrases: ["on my website", "on my site", "put my mini sessions", "promote my session", "add it to my website"], weight: W_STRONG },
    ],
  },
  {
    id: "session_status", label: "How many spots are left?", capabilities: ["sessions"],
    primary: "sessions", consequential: false, actorKinds: ["owner"],
    match: [{ phrases: ["spots left", "how many spots", "who booked", "how many booked"], weight: W_STRONG }],
  },
  {
    id: "configure_booking", label: "Set up booking", capabilities: ["booking"],
    primary: "booking", consequential: false, actorKinds: ["anonymous", "owner"], landingPrompt: true,
    match: [{ phrases: ["set up booking", "take bookings", "let people book", "booking page"], weight: W_STRONG }],
  },
  {
    id: "reschedule_appointment", label: "Move an appointment", capabilities: ["jobs", "calendar"],
    primary: "jobs", consequential: true, actorKinds: ["owner"],
    surfaceAffinity: ["jobs", "calendar"],
    match: [
      { phrases: ["move ", "reschedule", "push ", "change ", "shift "], weight: W_MED },
      { phrases: ["appointment", "'s appointment", "booking to", "job to"], weight: W_MED },
    ],
  },
  {
    id: "find_pro", label: "Find a pro", capabilities: ["marketplace"],
    primary: "marketplace", consequential: false, actorKinds: ["anonymous", "customer"],
    surfaceAffinity: ["marketplace"],
    match: [
      { phrases: ["i need someone to", "looking for someone", "find someone to", "who can", "need a pro"], weight: W_STRONG },
    ],
  },
  {
    id: "join_marketplace", label: "Join Marketplace", capabilities: ["marketplace", "business"],
    primary: "marketplace", consequential: false, actorKinds: ["owner"], landingPrompt: true,
    surfaceAffinity: ["marketplace"],
    match: [
      { phrases: ["get jobs through hubly", "get more jobs", "join the marketplace", "get leads from hubly", "jobs through hubly"], weight: W_STRONG },
    ],
  },
  {
    id: "create_followup", label: "Follow up with leads", capabilities: ["automation", "crm"],
    primary: "automation", consequential: true, actorKinds: ["owner"], landingPrompt: true,
    surfaceAffinity: ["leads"],
    match: [
      { phrases: ["follow up with", "follow-up with", "chase up", "reach out to everyone", "remind everyone"], weight: W_STRONG },
      { phrases: ["didn't book", "did not book", "never booked", "unconverted"], weight: W_MED },
    ],
  },
  {
    id: "daily_briefing", label: "What needs my attention?", capabilities: ["automation"],
    primary: "automation", consequential: false, actorKinds: ["owner"],
    match: [{ phrases: ["what needs my attention", "what should i do today", "brief me"], weight: W_STRONG }],
  },
  {
    id: "lead_query", label: "Who hasn't booked?", capabilities: ["crm"],
    primary: "crm", consequential: false, actorKinds: ["owner"],
    surfaceAffinity: ["leads"],
    match: [
      { phrases: ["who hasn't booked", "who has not booked", "who didn't book", "which customers", "who got a quote"], weight: W_STRONG },
    ],
  },
  {
    id: "revenue_report", label: "How much did I make?", capabilities: ["reporting"],
    primary: "reporting", consequential: false, actorKinds: ["owner"],
    match: [{ phrases: ["how much did i make", "how much have i made", "revenue this", "what did i earn"], weight: W_STRONG }],
  },
  {
    id: "grow_demand", label: "I need more customers", capabilities: [],
    primary: "diagnostic", consequential: false, actorKinds: ["owner"], landingPrompt: true,
    match: [
      { phrases: ["more customers", "more business", "more leads", "grow my business", "slow right now", "need more work"], weight: W_STRONG },
    ],
  },
  {
    id: "build_my_business", label: "Build my business", capabilities: ["business"],
    primary: "business", consequential: false, actorKinds: ["anonymous", "owner"], landingPrompt: true,
    composite: ["create_website", "configure_booking"],
    match: [{ phrases: ["build my business", "set up my business", "get me started", "build me a business"], weight: W_STRONG }],
  },
  {
    id: "unclear", label: "", capabilities: [], primary: "none",
    consequential: false, actorKinds: ["anonymous", "owner", "customer"], match: [],
  },
];

const BY_ID = new Map(INTENTS.map((i) => [i.id, i]));
export function getIntent(id: IntentId): IntentDef | undefined { return BY_ID.get(id); }

/* ────────────────────────── preconditions ────────────────────────── */

export type MissingRequirement = {
  id: string;
  capability: string;
  blocking: boolean;
  question?: string;
  because?: string;
  defaultApplied?: { value: unknown; source: "dna" | "state" | "convention" };
};

export type PreconditionResult =
  | { id: string; status: "satisfied" }
  | { id: string; status: "resolvable"; missing: MissingRequirement }
  | { id: string; status: "unavailable"; reason: string; enablePath?: IntentId };


/** What comes after "sell"/"selling". "I want to sell prints" → "prints";
 *  "I want to sell." → null. Under-specification is its own kind of ambiguity:
 *  the INTENT is clear, the OBJECT is missing, and no default can invent it. */
function sellSubject(utterance: string): string | null {
  const m = norm(utterance).match(/\bsell(?:ing)?\s+([a-z][a-z\s'-]{1,40})/);
  if (!m) return null;
  const subject = m[1].replace(/\b(stuff|things|things online|online|on my store|it)\b/g, "").trim();
  return subject.length >= 3 ? subject : null;
}

/* ────────────────────────── output ────────────────────────── */

export type PlannedStep = { capability: string; action: string; note?: string };

export type Ask = { question: string; resolves: string; because: string };

export type CapabilityPlan = {
  intent: IntentId;
  confidence: number;
  capabilities: string[];
  steps: PlannedStep[];
  preconditions: PreconditionResult[];
  missing_requirements: MissingRequirement[];
  requires_confirmation: boolean;
  confirmation?: { summary: string; consequences: string[] };
  /** AT MOST ONE. A questionnaire is unrepresentable by construction. */
  ask: Ask | null;
  rationale: string;
  fallback?: "converse" | "clarify" | "decline";
  /** grow_demand: the diagnosis behind the recommended action. Never a dead end. */
  diagnosis?: { finding: string; recommended: IntentId; alternatives: IntentId[] };
};

/* ────────────────────────── classification ────────────────────────── */

function norm(s: string): string {
  return String(s || "").toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
}

export type Candidate = { id: IntentId; score: number; hits: string[] };

/** Deterministic, offline, explainable. The model can refine later; it cannot
 *  introduce an intent that isn't in the registry. */
export function scoreIntents(input: RouterInput): Candidate[] {
  const text = norm(input.utterance);
  const out: Candidate[] = [];

  for (const def of INTENTS) {
    if (def.id === "unclear") continue;
    if (!def.actorKinds.includes(input.actor.kind)) continue;

    let score = 0;
    const hits: string[] = [];
    for (const group of def.match) {
      // Longest-match-wins within a group. "mini session" is a substring of
      // "mini sessions" — counting both double-scored the intent and made
      // "put my mini sessions on my website" resolve to CREATING a session.
      // Caught by the scenario matrix; this is why the matrix exists.
      const matched = group.phrases
        .filter((phrase) => text.includes(phrase))
        .sort((a, b) => b.length - a.length);
      const counted: string[] = [];
      for (const phrase of matched) {
        if (counted.some((longer) => longer.includes(phrase))) continue;
        counted.push(phrase);
        score += group.weight;
        hits.push(phrase);
      }
    }
    if (score === 0) continue;

    // Surface is a PRIOR, deliberately capped below any strong phrase match so it
    // can break a tie but never overrule what the person actually said. This one
    // cap is the fix for `if (S._edHubTab === 'store')`.
    if (input.surfaceHint && def.surfaceAffinity?.includes(input.surfaceHint)) score += 2;

    // A landing-page prompt click is a strong prior — the person picked it.
    if (input.intentSeed === def.id) score += W_STRONG;

    // hubly-intent-classify's business/marketplace split, reused as a nudge.
    if (input.classifierHint && input.classifierHint.confidence >= 0.7) {
      const isMkt = def.capabilities.includes("marketplace");
      if (input.classifierHint.intent === "marketplace" && isMkt) score += 3;
      if (input.classifierHint.intent === "business" && isMkt) score -= 3;
    }

    out.push({ id: def.id, score, hits });
  }
  return out.sort((a, b) => b.score - a.score);
}

function confidenceFrom(cands: Candidate[]): number {
  if (!cands.length) return 0;
  const top = cands[0].score;
  const second = cands[1]?.score ?? 0;
  const sep = top === 0 ? 0 : (top - second) / top;
  return Math.max(0, Math.min(0.99, 0.55 + 0.4 * sep + Math.min(0.1, top / 100)));
}

/* ────────────────────────── precondition engine ────────────────────────── */

const CAP_FLAG: Record<string, string> = { storefront: "storefront", website: "website" };

function commercePrecondition(b: BusinessContext): PreconditionResult {
  const enabled = b.entitlements.capabilities[CAP_FLAG.storefront] === true;
  if (enabled) return { id: "commerce.enabled", status: "satisfied" };
  // NEVER "unavailable" just because the flag is off. A capability the business
  // could have is offered, not hidden — that is the whole Store-routing decision.
  if (b.entitlements.tier === "starter" && !tradeSellsProducts(b.dna)) {
    return {
      id: "commerce.enabled", status: "resolvable",
      missing: {
        id: "commerce.enabled", capability: "storefront", blocking: false,
        defaultApplied: { value: "offer_enable", source: "convention" },
        because: "Store isn't switched on yet; Hubly can enable it in this turn.",
      },
    };
  }
  return {
    id: "commerce.enabled", status: "resolvable",
    missing: {
      id: "commerce.enabled", capability: "storefront", blocking: false,
      defaultApplied: { value: "offer_enable", source: tradeSellsProducts(b.dna) ? "dna" : "convention" },
      because: "Store isn't switched on yet; Hubly can enable it in this turn.",
    },
  };
}

/**
 * Evaluate an intent against real state.
 *
 * BUILD-FIRST IS ENFORCED HERE, not in prompt text: a requirement may only become
 * a question when no default and no inference exists. If a default exists it is
 * applied and reported, never asked.
 */
export function evaluatePreconditions(intent: IntentId, input: RouterInput): PreconditionResult[] {
  const b = input.business;
  const res: PreconditionResult[] = [];
  const need = (id: string, ok: boolean) => res.push(ok ? { id, status: "satisfied" } : { id, status: "resolvable", missing: { id, capability: "business", blocking: true } });

  if (!b) {
    if (intent === "find_pro") return [{ id: "none", status: "satisfied" }];
    // Anonymous with no draft yet: the name is the one genuine blocker.
    res.push({
      id: "identity.name", status: "resolvable",
      missing: {
        id: "identity.name", capability: "business", blocking: true,
        question: "What's the business called?",
        because: "Nothing is stored yet — Hubly can't name a business it has never heard of.",
      },
    });
    return res;
  }

  const st = b.state;
  switch (intent) {
    case "create_website":
    case "create_storefront":
    case "build_my_business": {
      need("identity.name", !!b.identity.name);
      res.push(
        b.identity.businessType
          ? { id: "identity.businessType", status: "satisfied" }
          : {
              id: "identity.businessType", status: "resolvable",
              missing: {
                id: "identity.businessType", capability: "business", blocking: true,
                question: "What kind of work do you do?",
                because: "No business type stored, and Hubly must never guess an industry.",
              },
            },
      );
      // Content: real services, else the trade's own examples as a DRAFT to confirm.
      res.push(
        st.serviceCount > 0
          ? { id: "content.minimum", status: "satisfied" }
          : {
              id: "content.minimum", capability: "website", status: "resolvable",
              missing: {
                id: "content.minimum", capability: "website", blocking: false,
                defaultApplied: { value: b.dna?.exampleServices?.slice(0, 4) ?? [], source: "dna" },
                because: "No services stored; the trade's typical services seed a first draft to confirm.",
              },
            } as PreconditionResult,
      );
      res.push(
        b.identity.accent || st.hasBrandColor
          ? { id: "brand.accent", status: "satisfied" }
          : { id: "brand.accent", status: "resolvable", missing: { id: "brand.accent", capability: "website", blocking: false, defaultApplied: { value: "dna.recommendedStyles", source: "dna" } } },
      );
      break;
    }
    case "refine_website":
    case "apply_design_reference":
      res.push(
        st.hasWebsiteDocument
          ? { id: "website.exists", status: "satisfied" }
          : { id: "website.exists", status: "unavailable", reason: "There's no website yet to change.", enablePath: "create_website" },
      );
      break;

    case "enable_commerce":
    case "create_product": {
      res.push(commercePrecondition(b));
      // "I want to sell." — intent clear, object missing. This is the one
      // genuinely useful question in the Store flow, and it replaces the
      // "physical, digital, or a mix?" interview entirely.
      const subject = sellSubject(input.utterance);
      res.push(
        subject || st.productCount > 0
          ? { id: "product.subject", status: "satisfied" }
          : {
              id: "product.subject", status: "resolvable",
              missing: {
                id: "product.subject", capability: "storefront", blocking: true,
                question: "What would you like to sell?",
                because: "Nothing names what they're selling, and Hubly must never invent a product.",
              },
            },
      );
      break;
    }

    case "design_product_store":
      res.push(commercePrecondition(b));
      res.push(
        st.productCount > 0
          ? { id: "product.exists", status: "satisfied" }
          : { id: "product.exists", status: "unavailable", reason: "There are no products to merchandise yet.", enablePath: "create_product" },
      );
      break;

    case "create_one_off_session": {
      const t = norm(input.utterance);
      const hasDate = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\b|\b\d{4}-\d{2}-\d{2}\b|\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|next \w+day/.test(t);
      const hasWindow = /\d{1,2}\s*(am|pm)?\s*(to|-|–|until)\s*\d{1,2}\s*(am|pm)?/.test(t);
      res.push(hasDate ? { id: "session.date", status: "satisfied" } : { id: "session.date", status: "resolvable", missing: { id: "session.date", capability: "sessions", blocking: true, question: "What day are you running them?", because: "A session is a specific date; there's no sensible default." } });
      res.push(hasWindow ? { id: "session.window", status: "satisfied" } : { id: "session.window", status: "resolvable", missing: { id: "session.window", capability: "sessions", blocking: true, question: "What hours?", because: "The window defines the slots; no default is safe." } });
      res.push({ id: "session.duration", status: "resolvable", missing: { id: "session.duration", capability: "sessions", blocking: false, defaultApplied: { value: 20, source: b.dna ? "dna" : "convention" } } });
      res.push({ id: "session.capacity", status: "resolvable", missing: { id: "session.capacity", capability: "sessions", blocking: false, defaultApplied: { value: 1, source: "convention" } } });
      res.push({ id: "session.payment", status: "resolvable", missing: { id: "session.payment", capability: "payments", blocking: false, defaultApplied: { value: "none_until_priced", source: "convention" } } });
      break;
    }

    case "promote_session":
      res.push(
        st.openSessionCount === 1
          ? { id: "session.target", status: "satisfied" }
          : st.openSessionCount === 0
          ? { id: "session.target", status: "unavailable", reason: "There's no open session to promote.", enablePath: "create_one_off_session" }
          : { id: "session.target", status: "resolvable", missing: { id: "session.target", capability: "sessions", blocking: true, question: "Which session — you have a few open?", because: "More than one open session; picking for them could promote the wrong one." } },
      );
      break;

    case "publish_session":
      res.push(st.openSessionCount > 0 ? { id: "session.target", status: "satisfied" } : { id: "session.target", status: "unavailable", reason: "There's no draft session to publish.", enablePath: "create_one_off_session" });
      break;

    case "reschedule_appointment":
      res.push(st.upcomingJobCount > 0 ? { id: "job.exists", status: "satisfied" } : { id: "job.exists", status: "unavailable", reason: "There are no upcoming appointments." });
      break;

    case "join_marketplace":
      need("identity.name", !!b.identity.name);
      res.push(st.serviceCount > 0 ? { id: "content.services", status: "satisfied" } : { id: "content.services", status: "resolvable", missing: { id: "content.services", capability: "business", blocking: true, question: "What services should we list?", because: "Marketplace matches on real services." } });
      res.push(b.identity.city ? { id: "provider.area", status: "satisfied" } : { id: "provider.area", status: "resolvable", missing: { id: "provider.area", capability: "marketplace", blocking: true, question: "What area do you cover?", because: "Marketplace matching is geographic; there is no safe default." } });
      break;

    case "create_followup":
      res.push(st.unbookedLeadCount > 0 ? { id: "audience.nonEmpty", status: "satisfied" } : { id: "audience.nonEmpty", status: "unavailable", reason: "Nobody matches that yet — no unconverted leads." });
      break;

    default:
      res.push({ id: "none", status: "satisfied" });
  }
  return res;
}

/* ────────────────────────── grow_demand ────────────────────────── */

/** Diagnosis → recommendation → an EXECUTABLE next step. Never a dead-end report. */
function diagnoseGrowth(b: BusinessContext): { finding: string; recommended: IntentId; alternatives: IntentId[] } {
  const st = b.state;
  if (st.unbookedLeadCount > 0) {
    return {
      finding: `${st.unbookedLeadCount} ${st.unbookedLeadCount === 1 ? "lead" : "leads"} asked about you and never booked.`,
      recommended: "create_followup",
      alternatives: st.hasWebsiteDocument ? ["join_marketplace"] : ["create_website", "join_marketplace"],
    };
  }
  if (!st.hasWebsiteDocument) {
    return { finding: "There's no website yet, so there's nowhere for interest to land.", recommended: "create_website", alternatives: ["join_marketplace"] };
  }
  if (st.marketplaceProvider === "none") {
    return { finding: "You have a site but you're not in Marketplace, so Hubly can't send you work.", recommended: "join_marketplace", alternatives: ["create_followup"] };
  }
  return { finding: "The basics are in place — the next lever is staying in front of past customers.", recommended: "create_followup", alternatives: ["create_one_off_session"] };
}

/* ────────────────────────── plan builder ────────────────────────── */

const STEP_HINTS: Partial<Record<IntentId, PlannedStep[]>> = {
  create_website: [{ capability: "website", action: "generateDocument" }],
  refine_website: [{ capability: "website", action: "patchDocument" }],
  apply_design_reference: [{ capability: "website", action: "analyze" }, { capability: "website", action: "patchDocument" }],
  create_storefront: [{ capability: "website", action: "generateDocument", note: "Business Storefront — services/gallery/reviews/booking, NOT the product store" }],
  enable_commerce: [{ capability: "storefront", action: "configureStore" }, { capability: "storefront", action: "createProduct" }],
  create_product: [{ capability: "storefront", action: "createProduct" }],
  design_product_store: [{ capability: "storefront", action: "generateStorefront" }],
  create_one_off_session: [{ capability: "sessions", action: "create" }],
  modify_session: [{ capability: "sessions", action: "update" }],
  publish_session: [{ capability: "sessions", action: "publish" }],
  promote_session: [{ capability: "sessions", action: "addWebsitePromotion", note: "one action, two backends, one storefrontAst back" }],
  session_status: [{ capability: "sessions", action: "get" }],
  reschedule_appointment: [{ capability: "jobs", action: "reschedule" }],
  find_pro: [{ capability: "marketplace", action: "intake" }, { capability: "marketplace", action: "match" }],
  join_marketplace: [{ capability: "marketplace", action: "providerDraft" }],
  create_followup: [{ capability: "automation", action: "createFollowup" }],
  lead_query: [{ capability: "crm", action: "listUnbooked" }],
  revenue_report: [{ capability: "reporting", action: "revenue" }],
  daily_briefing: [{ capability: "automation", action: "dailyBriefing" }],
};

export function buildPlan(input: RouterInput): CapabilityPlan {
  const cands = scoreIntents(input);
  const AMBIGUOUS_MARGIN = 0.15;

  if (!cands.length) {
    return {
      intent: "unclear", confidence: 0, capabilities: [], steps: [], preconditions: [],
      missing_requirements: [], requires_confirmation: false, ask: null,
      rationale: "no intent matched", fallback: "converse",
    };
  }

  const conf = confidenceFrom(cands);
  const top = cands[0];
  const second = cands[1];

  // Genuine ambiguity asks ONE useful question rather than flipping a coin.
  if (second && top.score > 0 && (top.score - second.score) / top.score < AMBIGUOUS_MARGIN && conf < 0.72) {
    const a = getIntent(top.id)!, bIntent = getIntent(second.id)!;
    return {
      intent: "unclear", confidence: conf, capabilities: [], steps: [],
      preconditions: [], missing_requirements: [], requires_confirmation: false,
      ask: {
        question: `Do you mean ${a.label.toLowerCase()}, or ${bIntent.label.toLowerCase()}?`,
        resolves: "intent",
        because: `"${input.utterance.trim()}" fits both about equally.`,
      },
      rationale: `ambiguous: ${top.id}(${top.score}) vs ${second.id}(${second.score})`,
      fallback: "clarify",
    };
  }

  const def = getIntent(top.id)!;
  const pre = evaluatePreconditions(top.id, input);
  const missing = pre.flatMap((p) => (p.status === "resolvable" ? [p.missing] : []));
  const unavailable = pre.find((p) => p.status === "unavailable") as
    Extract<PreconditionResult, { status: "unavailable" }> | undefined;

  // grow_demand: diagnose, recommend, and hand back an executable step.
  if (top.id === "grow_demand" && input.business) {
    const d = diagnoseGrowth(input.business);
    const rec = getIntent(d.recommended)!;
    return {
      intent: "grow_demand", confidence: conf,
      capabilities: rec.capabilities, steps: STEP_HINTS[d.recommended] ?? [],
      preconditions: evaluatePreconditions(d.recommended, input),
      missing_requirements: [], requires_confirmation: true,
      confirmation: { summary: `${d.finding} I'd start with: ${rec.label.toLowerCase()}.`, consequences: rec.consequential ? ["This contacts real customers."] : [] },
      ask: null, diagnosis: d,
      rationale: `diagnostic → ${d.recommended}`,
    };
  }

  // Unavailable → redirect to the enabling intent, never a dead end.
  if (unavailable) {
    const alt = unavailable.enablePath ? getIntent(unavailable.enablePath) : null;
    return {
      intent: alt ? alt.id : top.id, confidence: conf,
      capabilities: alt ? alt.capabilities : [], steps: alt ? STEP_HINTS[alt.id] ?? [] : [],
      preconditions: pre, missing_requirements: missing, requires_confirmation: false,
      ask: null,
      rationale: `${top.id} unavailable (${unavailable.reason})${alt ? ` → ${alt.id}` : ""}`,
      fallback: alt ? undefined : "decline",
    };
  }

  // THE ONE QUESTION. Only a blocking requirement with no default may ask, and
  // only the first one — the schema cannot express a second.
  const blocker = missing.find((m) => m.blocking && m.question);
  const ask: Ask | null = blocker
    ? { question: blocker.question!, resolves: blocker.id, because: blocker.because ?? "no default is safe here" }
    : null;

  return {
    intent: top.id,
    confidence: conf,
    capabilities: def.capabilities,
    steps: ask ? [] : STEP_HINTS[top.id] ?? [],
    preconditions: pre,
    missing_requirements: missing,
    requires_confirmation: def.consequential && !ask,
    confirmation: def.consequential && !ask ? { summary: def.label, consequences: ["This is a real, customer-visible action."] } : undefined,
    ask,
    rationale: `${top.id} score=${top.score} hits=[${top.hits.slice(0, 3).join("|")}]`,
  };
}

/** Landing-page prompts (§J) — generated from the registry, never hand-written. */
export function landingPrompts(actor: ActorKind): { id: IntentId; label: string }[] {
  return INTENTS.filter((i) => i.landingPrompt && i.actorKinds.includes(actor))
    .map((i) => ({ id: i.id, label: i.label }));
}
