/**
 * Hubly Brain — Business Understanding
 *
 * Separate from Business Memory:
 * - Understanding interprets language and business intent.
 * - Memory stores structured facts and evolves over time.
 *
 * Flow:
 *   Conversation → Understanding → (writes) Business Memory → Planner
 *
 * The Planner must never inspect raw conversation.
 * Understanding is the only layer allowed to read free-form language.
 */

import {
  mergeBusinessMemory,
  normalizeBusinessMemory,
  type HublyBusinessMemory,
  type HublyBusinessMemoryInput,
} from "./hubly_brain_memory.ts";

export type HublyConversationTurn = {
  role?: string;
  content?: string;
  text?: string;
  side?: string;
};

/** Structured outcomes the planner may select skills from — never raw chat. */
export type HublyRequestedOutcome =
  | "website"
  | "crm"
  | "booking"
  | "calendar"
  | "quotes"
  | "payments"
  | "marketing"
  | "dashboard"
  | "services"
  | "memberships"
  | "photos"
  | "coaching"
  | "full_business_system";

export type HublyBusinessIntent = {
  /** Machine-stable primary intent */
  primaryGoal:
    | "build_business_system"
    | "build_website"
    | "grow_business"
    | "run_operations"
    | "get_bookings"
    | "improve_marketing"
    | "coach"
    | "unknown";
  /** Human-readable structured goals (not raw utterances) */
  goals: string[];
  /** Platform outcomes Understanding inferred from language */
  requestedOutcomes: HublyRequestedOutcome[];
};

export type HublyBusinessUnderstanding = {
  intent: HublyBusinessIntent;
  /** Facts to merge into Business Memory */
  memoryPatch: HublyBusinessMemoryInput;
  /** Debug signals — what Understanding noticed */
  signals: string[];
};

function turnsToText(input: string | HublyConversationTurn[] | null | undefined): string {
  if (typeof input === "string") return input.trim();
  if (!Array.isArray(input)) return "";
  return input
    .map((t) => String(t?.content || t?.text || "").trim())
    .filter(Boolean)
    .join("\n");
}

function detectIndustry(low: string): string | null {
  if (/\bdetail(ing|er)?\b|ceramic coating|car wash/.test(low)) return "detailing";
  if (/\bhvac\b|air condition|furnace|heat pump/.test(low)) return "hvac";
  if (/\bclean(ing|er)?\b|maid|janitor/.test(low)) return "cleaning";
  if (/\blawn\b|landscap|mow/.test(low)) return "lawn";
  if (/\bwindow\b|glass clean|squeegee/.test(low)) return "windows";
  if (/\bphoto(graphy|grapher)?\b|wedding shoot|portrait/.test(low)) return "photography";
  if (/\bspa\b|massage|wellness|facial/.test(low)) return "spa";
  if (/\bpressure\s*wash|power\s*wash/.test(low)) return "pressure_washing";
  if (/\bchristmas light|knife sharpen|golf cart|boat detail|chimney|piano tun|drone inspect/.test(low)) {
    return "custom";
  }
  return null;
}

function detectOutcomes(low: string): HublyRequestedOutcome[] {
  const out = new Set<HublyRequestedOutcome>();
  if (/website|site|landing|online presence|instant site/.test(low)) out.add("website");
  if (/crm|customer list|client list|pipeline/.test(low)) out.add("crm");
  if (/book|appoint|intake/.test(low)) out.add("booking");
  if (/calendar|schedul/.test(low)) out.add("calendar");
  if (/quote|estimat/.test(low)) out.add("quotes");
  if (/invoice|payment|stripe|deposit/.test(low)) out.add("payments");
  if (/market|campaign|social|ads|grow (my |the )?business/.test(low)) out.add("marketing");
  if (/dashboard|ops|run my business/.test(low)) out.add("dashboard");
  if (/service|package|menu|offer|pricing/.test(low)) out.add("services");
  if (/membership|subscription|recurring/.test(low)) out.add("memberships");
  if (/photo|gallery|portfolio/.test(low)) out.add("photos");
  if (/coach|advice|help me (run|grow)/.test(low)) out.add("coaching");
  if (/build (me )?(my )?(business|software|system|platform)|set up my business|launch my business/.test(low)) {
    out.add("full_business_system");
    out.add("website");
    out.add("crm");
    out.add("booking");
    out.add("calendar");
    out.add("quotes");
    out.add("dashboard");
    out.add("marketing");
  }
  return [...out];
}

function detectPrimaryGoal(
  low: string,
  outcomes: HublyRequestedOutcome[],
): HublyBusinessIntent["primaryGoal"] {
  if (outcomes.includes("full_business_system") || /build.*(business|software|system)/.test(low)) {
    return "build_business_system";
  }
  if (outcomes.includes("website") && outcomes.length <= 2) return "build_website";
  if (outcomes.includes("coaching") || /coach|advice/.test(low)) return "coach";
  if (outcomes.includes("marketing") || /grow/.test(low)) return "grow_business";
  if (outcomes.includes("booking") || /get (more )?bookings|customers/.test(low)) return "get_bookings";
  if (outcomes.includes("dashboard") || /run my business|operations/.test(low)) return "run_operations";
  if (outcomes.includes("marketing")) return "improve_marketing";
  return outcomes.length ? "grow_business" : "unknown";
}

function goalsFromIntent(
  primary: HublyBusinessIntent["primaryGoal"],
  outcomes: HublyRequestedOutcome[],
): string[] {
  const goals: string[] = [];
  const map: Record<string, string> = {
    build_business_system: "Stand up a full Hubly business system",
    build_website: "Build and publish a website",
    grow_business: "Grow the business",
    run_operations: "Run day-to-day operations",
    get_bookings: "Get more bookings",
    improve_marketing: "Improve marketing",
    coach: "Receive business coaching",
    unknown: "Clarify what the owner needs next",
  };
  goals.push(map[primary] || map.unknown);
  for (const o of outcomes) {
    if (o === "full_business_system") continue;
    goals.push(`Enable ${o}`);
  }
  return [...new Set(goals)];
}

/**
 * Interpret conversation into structured intent + memory facts.
 * This is the only Brain step that reads raw language.
 */
export function understandConversation(
  conversation: string | HublyConversationTurn[],
  priorMemory?: HublyBusinessMemoryInput | null,
): HublyBusinessUnderstanding {
  const prior = normalizeBusinessMemory(priorMemory);
  const text = turnsToText(conversation);
  const low = text.toLowerCase();
  const signals: string[] = [];

  const outcomes = detectOutcomes(low);
  if (outcomes.length) signals.push(`outcomes:${outcomes.join(",")}`);

  const industry = detectIndustry(low);
  if (industry) signals.push(`industry:${industry}`);

  const primaryGoal = detectPrimaryGoal(low, outcomes);
  signals.push(`primaryGoal:${primaryGoal}`);

  const intent: HublyBusinessIntent = {
    primaryGoal,
    goals: goalsFromIntent(primaryGoal, outcomes),
    requestedOutcomes: outcomes,
  };

  // Extract a simple business name if they said “my business is X” / “called X”
  let name: string | null = null;
  const nameMatch = text.match(
    /(?:business (?:is|called|named)|(?:i(?:'m| am) |we(?:'re| are) )(?:called|named))\s+([A-Z][\w'& ]{1,40})/i,
  );
  if (nameMatch?.[1]) {
    name = nameMatch[1].trim().replace(/[.,!?].*$/, "");
    signals.push("name:inferred");
  }

  let businessStage: string | null = null;
  if (/just started|brand new|starting out|getting started|first year/.test(low)) {
    businessStage = "just_started";
    signals.push("stage:just_started");
  } else if (/\d+\s*years?|established|been .+ year/.test(low)) {
    businessStage = "established";
    signals.push("stage:established");
  }

  const memoryPatch: HublyBusinessMemoryInput = {
    name: name || prior.name || null,
    industry: industry && industry !== "custom" ? industry : (prior.industry || (industry === "custom" ? "custom" : null)),
    businessStage: businessStage || prior.businessStage || null,
    workLove: !prior.workLove && text.length > 3 && text.length < 160 ? text.slice(0, 160) : prior.workLove,
    goals: intent.goals,
    onboardingPriority:
      primaryGoal === "get_bookings"
        ? "bookings"
        : primaryGoal === "run_operations"
        ? "run"
        : primaryGoal === "grow_business" || primaryGoal === "build_business_system"
        ? "grow"
        : prior.onboardingPriority || null,
    extras: {
      ...(prior.extras && typeof prior.extras === "object" ? prior.extras : {}),
      /** Structured planner input — never raw conversation */
      intent: {
        primaryGoal: intent.primaryGoal,
        requestedOutcomes: intent.requestedOutcomes,
        goals: intent.goals,
        understoodAt: new Date().toISOString(),
      },
    },
  };

  return { intent, memoryPatch, signals };
}

/** Apply Understanding onto Memory — Memory remains the SSOT. */
export function applyUnderstandingToMemory(
  priorMemory: HublyBusinessMemoryInput | null | undefined,
  understanding: HublyBusinessUnderstanding,
): HublyBusinessMemory {
  return mergeBusinessMemory(priorMemory, understanding.memoryPatch);
}

export const HublyUnderstanding = {
  understand: understandConversation,
  applyToMemory: applyUnderstandingToMemory,
};

export default HublyUnderstanding;
