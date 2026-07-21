/**
 * Hubly Brain — Planner (Phase 7.3 / 7.5)
 *
 * Conversation → Understanding → Business Memory → Planner
 * → Execution Plan → Orchestrator → Executors → Platform
 *
 * CRITICAL SEPARATION:
 * - Understanding reads language and writes structured facts into Memory.
 * - Memory is the single source of truth.
 * - The Planner reasons ONLY from structured Memory.
 * - The Planner must NEVER inspect raw user conversation.
 * - The Planner decides WHAT (capabilities + dependsOn).
 * - The Orchestrator decides HOW (order, parallel, retries) — Planner never thinks about execution.
 */

import {
  normalizeBusinessMemory,
  type HublyBusinessMemory,
  type HublyBusinessMemoryInput,
} from "./hubly_brain_memory.ts";
import { getSkill, listSkills, type HublySkillId } from "./hubly_brain_skills.ts";
import {
  getCapability,
  skillToCapability,
  type HublyCapabilityId,
} from "./hubly_brain_capabilities.ts";
import {
  normalizeExecutionPlan,
  type HublyExecutionPlan,
  type HublyExecutionPlanStep,
} from "./hubly_brain_execution_plan.ts";
import {
  normalizeBusinessDNA,
  type HublyBusinessDNAInput,
} from "./hubly_brain_dna.ts";

/** @deprecated Prefer HublyExecutionPlan — kept for ingest / status compat. */
export type HublyPlanStep = {
  skill: HublySkillId;
  why: string;
  status: "pending" | "ready" | "blocked";
  capability?: HublyCapabilityId;
};

/** @deprecated Prefer HublyExecutionPlan. */
export type HublyPlan = {
  goal: string;
  skills: HublySkillId[];
  steps: HublyPlanStep[];
  status: "proposed" | "approved" | "executing" | "done";
  blocked: HublySkillId[];
  source: "business_memory";
  /** Phase 7.5 — canonical Execution Plan for the Orchestrator */
  executionPlan?: HublyExecutionPlan;
};

export type HublyExecutionResult = {
  plan: HublyPlan;
  ran: Array<{
    skill: HublySkillId;
    ok: boolean;
    detail: string;
    effects?: Record<string, unknown>;
  }>;
  skipped: Array<{ skill: HublySkillId; reason: string }>;
};

type StructuredIntent = {
  primaryGoal?: string | null;
  requestedOutcomes?: string[] | null;
  goals?: string[] | null;
};

function readStructuredIntent(memory: HublyBusinessMemory): StructuredIntent {
  const extras = memory.extras && typeof memory.extras === "object" ? memory.extras : {};
  const intent = (extras as Record<string, unknown>).intent;
  if (intent && typeof intent === "object") {
    const i = intent as Record<string, unknown>;
    return {
      primaryGoal: typeof i.primaryGoal === "string" ? i.primaryGoal : null,
      requestedOutcomes: Array.isArray(i.requestedOutcomes)
        ? i.requestedOutcomes.map(String)
        : null,
      goals: Array.isArray(i.goals) ? i.goals.map(String) : null,
    };
  }
  return {
    primaryGoal: null,
    requestedOutcomes: null,
    goals: Array.isArray(memory.goals)
      ? memory.goals.map(String)
      : memory.goals
      ? [String(memory.goals)]
      : null,
  };
}

type WantedCap = { capability: HublyCapabilityId; why: string; priority?: number };

function outcomesToCapabilities(outcomes: string[]): WantedCap[] {
  const wanted: WantedCap[] = [];
  const add = (capability: HublyCapabilityId, why: string, priority?: number) => {
    if (!wanted.some((w) => w.capability === capability)) {
      wanted.push({ capability, why, priority });
    }
  };

  for (const o of outcomes) {
    switch (o) {
      case "website":
        add("branding", "Website needs brand first", 1);
        add("website", "Memory requests a website", 2);
        break;
      case "crm":
        add("crm", "Memory requests CRM");
        break;
      case "booking":
        add("booking", "Memory requests booking");
        break;
      case "calendar":
        add("calendar", "Memory requests calendar / scheduling");
        break;
      case "quotes":
        add("quotes", "Memory requests quotes");
        break;
      case "payments":
        add("crm", "Payments need CRM");
        add("payments", "Memory requests payments / invoicing");
        break;
      case "marketing":
        add("marketing", "Memory requests marketing");
        break;
      case "dashboard":
        add("dashboard", "Memory requests an owner dashboard");
        break;
      case "services":
        add("services", "Memory requests a service catalog");
        break;
      case "memberships":
        add("payments", "Memory requests memberships / payments");
        break;
      case "photos":
        add("website", "Memory requests photo-backed website");
        break;
      case "coaching":
        add("coaching", "Memory requests coaching");
        break;
      case "full_business_system":
        // Canonical Runtime shape — Planner WHAT only; Orchestrator owns HOW.
        // Magical build: conversation → company (website, booking, CRM, payments, domain, customer profile).
        add("understanding", "Always understand first", 1);
        add("branding", "Full system: brand", 1);
        add("website", "Full system: website", 2);
        add("crm", "Full system: CRM", 2);
        add("booking", "Full system: booking", 2);
        add("payments", "Full system: payments", 3);
        add("dashboard", "Full system: dashboard", 3);
        add("marketplace", "Full system: customer-facing profile", 4);
        add("domain", "Full system: Business Launch (domain/DNS/SSL)", 4);
        break;
      case "domain":
        add("domain", "Business Launch: domain / DNS / SSL");
        break;
      case "marketplace":
        add("marketplace", "Memory requests customer-facing profile");
        break;
      default:
        break;
    }
  }
  return wanted;
}

function toExecutionPlan(goal: string, wanted: WantedCap[]): HublyExecutionPlan {
  // Always lead with understanding when building anything.
  if (!wanted.some((w) => w.capability === "understanding")) {
    wanted = [{ capability: "understanding", why: "Structure conversation into Memory", priority: 0 }, ...wanted];
  }

  const steps: HublyExecutionPlanStep[] = wanted.map((w, i) => {
    const cap = getCapability(w.capability);
    return {
      id: w.capability,
      capability: w.capability,
      priority: w.priority ?? i + 1,
      dependsOn: [...(cap?.defaultDependsOn || [])],
      why: w.why,
    };
  });

  return normalizeExecutionPlan({
    version: 1,
    goal,
    steps,
    source: "business_memory",
  });
}

function executionPlanToLegacy(plan: HublyExecutionPlan): HublyPlan {
  const steps: HublyPlanStep[] = [];
  for (const s of plan.steps) {
    const cap = getCapability(s.capability);
    const skill = (cap?.skills[0] || "understandBusiness") as HublySkillId;
    const meta = getSkill(skill);
    steps.push({
      skill,
      why: s.why || cap?.description || s.capability,
      status: cap?.executable ? "ready" : "blocked",
      capability: s.capability,
    });
  }
  return {
    goal: plan.goal,
    skills: steps.map((s) => s.skill),
    steps,
    status: "proposed",
    blocked: steps.filter((s) => s.status === "blocked").map((s) => s.skill),
    source: "business_memory",
    executionPlan: plan,
  };
}

/**
 * Propose an Execution Plan from structured Business Memory + Business DNA.
 * Do not pass raw conversation here — run Understanding first.
 * Planner reads DNA for identity/goals; Memory for facts. Never combines them.
 * Planner never thinks about execution ordering beyond dependsOn / priority.
 */
export function proposeExecutionPlanFromMemory(
  memoryInput?: HublyBusinessMemoryInput | null,
  dnaInput?: HublyBusinessDNAInput | null,
): HublyExecutionPlan {
  const memory = normalizeBusinessMemory(memoryInput);
  const dna = normalizeBusinessDNA(dnaInput);
  const intent = readStructuredIntent(memory);
  const outcomes = [...(intent.requestedOutcomes || [])];

  if (!outcomes.length) {
    if (memory.currentWebsite == null && memory.name) outcomes.push("website");
    if (memory.services?.length) outcomes.push("services");
    if (memory.onboardingPriority === "bookings") {
      outcomes.push("booking", "marketing");
    }
    if (memory.onboardingPriority === "run") {
      outcomes.push("dashboard", "crm", "calendar");
    }
    if (memory.onboardingPriority === "grow") {
      outcomes.push("marketing", "website", "booking");
    }
  }

  if (intent.primaryGoal === "build_business_system" && !outcomes.includes("full_business_system")) {
    outcomes.push("full_business_system");
  }

  // DNA goals bias WHAT (still not HOW).
  for (const g of dna.goals) {
    if (g.kind === "hire" || g.kind === "expand") {
      outcomes.push("coaching", "dashboard");
    }
    if (g.kind === "premium") outcomes.push("website");
    if (g.kind === "bookings" || g.kind === "repeat") outcomes.push("booking", "marketing");
    if (g.kind === "increase_revenue") outcomes.push("marketing", "quotes");
  }
  if (dna.pricing.tier === "premium" || dna.pricing.tier === "luxury") {
    if (!outcomes.includes("website")) outcomes.push("website");
  }
  if (dna.services.idealJobs?.length && !outcomes.includes("website")) {
    outcomes.push("website");
  }

  const seenOut = new Set<string>();
  const uniqOutcomes = outcomes.filter((o) => {
    if (seenOut.has(o)) return false;
    seenOut.add(o);
    return true;
  });

  let wanted = outcomesToCapabilities(uniqOutcomes);

  // Premium DNA → branding earlier
  if (dna.brand.personality?.length || dna.pricing.tier === "premium" || dna.pricing.tier === "luxury") {
    if (!wanted.some((w) => w.capability === "branding")) {
      wanted.unshift({ capability: "branding", why: "DNA brand identity should lead", priority: 1 });
    } else {
      wanted = wanted.map((w) =>
        w.capability === "branding" ? { ...w, priority: 1, why: w.why || "DNA brand identity" } : w
      );
    }
  }

  const goalFromDna = dna.goals[0]?.label || null;
  const goal =
    goalFromDna ||
    (intent.goals && intent.goals[0]) ||
    (typeof memory.goals === "string" ? memory.goals : null) ||
    (Array.isArray(memory.goals) && memory.goals[0] ? String(memory.goals[0]) : null) ||
    (memory.name ? `Build ${memory.name}` : "Build this business");

  if (!wanted.length && memory.name) {
    wanted.push({ capability: "coaching", why: "Memory has a business but no requested outcomes yet" });
  }

  return toExecutionPlan(goal, wanted);
}

/**
 * Propose a plan from structured Business Memory + DNA.
 * Returns legacy HublyPlan + embedded executionPlan for Orchestrator.
 */
export function proposePlanFromMemory(
  memoryInput?: HublyBusinessMemoryInput | null,
  dnaInput?: HublyBusinessDNAInput | null,
): HublyPlan {
  return executionPlanToLegacy(proposeExecutionPlanFromMemory(memoryInput, dnaInput));
}

/**
 * @deprecated Planner must not read raw conversation.
 * Use Understanding → Memory → proposePlanFromMemory instead.
 */
export function proposePlanFromText(
  _goal: string,
  memory?: HublyBusinessMemoryInput | null,
): HublyPlan {
  console.warn(
    "HublyPlanner.proposePlanFromText is deprecated — planner must not inspect raw conversation. Use Understanding then proposePlanFromMemory.",
  );
  return proposePlanFromMemory(memory);
}

/**
 * @deprecated Prefer HublyOrchestrator.orchestrate — sync stub only.
 */
export function executePlanStub(plan: HublyPlan): HublyExecutionResult {
  const ran: HublyExecutionResult["ran"] = [];
  const skipped: HublyExecutionResult["skipped"] = [];
  for (const step of plan.steps) {
    const skill = getSkill(step.skill);
    const capId = step.capability || skillToCapability(step.skill);
    const cap = capId ? getCapability(capId) : null;
    if (!cap?.executable && !skill?.executable) {
      skipped.push({
        skill: step.skill,
        reason: "Capability not executable yet — Runtime migration pending",
      });
      continue;
    }
    ran.push({
      skill: step.skill,
      ok: true,
      detail: "Executed (stub — use Hubly.buildBusiness / Orchestrator)",
    });
  }
  return {
    plan: { ...plan, status: skipped.length && !ran.length ? "proposed" : "done" },
    ran,
    skipped,
  };
}

export const HublyPlanner = {
  proposeFromMemory: proposePlanFromMemory,
  proposeExecutionPlanFromMemory,
  /** @deprecated */
  proposeFromText: proposePlanFromText,
  listAvailableSkills: listSkills,
  executeStub: executePlanStub,
};

export default HublyPlanner;
