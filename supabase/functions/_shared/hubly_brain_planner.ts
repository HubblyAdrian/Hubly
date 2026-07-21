/**
 * Hubly Brain — Planner + Executor stubs (Phases 7.3 / 7.4)
 *
 * Conversation → Understanding → Business Memory → Planner
 * → Capability Registry (skills) → Executors → Hubly Platform
 *
 * CRITICAL SEPARATION:
 * - Understanding reads language and writes structured facts into Memory.
 * - Memory is the single source of truth.
 * - The Planner reasons ONLY from structured Memory.
 * - The Planner must NEVER inspect raw user conversation.
 * - The Planner selects capabilities (skills).
 * - Executors perform work — the model never writes the DB directly.
 */

import {
  normalizeBusinessMemory,
  type HublyBusinessMemory,
  type HublyBusinessMemoryInput,
} from "./hubly_brain_memory.ts";
import { getSkill, listSkills, type HublySkillId } from "./hubly_brain_skills.ts";

export type HublyPlanStep = {
  skill: HublySkillId;
  why: string;
  status: "pending" | "ready" | "blocked";
};

export type HublyPlan = {
  goal: string;
  skills: HublySkillId[];
  steps: HublyPlanStep[];
  status: "proposed" | "approved" | "executing" | "done";
  /** Skills mentioned that are not executable yet */
  blocked: HublySkillId[];
  /** Confirms planner input was memory-only */
  source: "business_memory";
};

export type HublyExecutionResult = {
  plan: HublyPlan;
  ran: Array<{ skill: HublySkillId; ok: boolean; detail: string }>;
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

function outcomesToSkills(outcomes: string[]): Array<{ skill: HublySkillId; why: string }> {
  const wanted: Array<{ skill: HublySkillId; why: string }> = [];
  const add = (skill: HublySkillId, why: string) => {
    if (!wanted.some((w) => w.skill === skill)) wanted.push({ skill, why });
  };

  for (const o of outcomes) {
    switch (o) {
      case "website":
        add("buildWebsite", "Memory requests a website");
        add("publishWebsite", "Memory requests a publishable site");
        break;
      case "crm":
        add("createCrm", "Memory requests CRM");
        break;
      case "booking":
        add("createBookingFlow", "Memory requests booking");
        break;
      case "calendar":
        add("scheduleJob", "Memory requests calendar / scheduling");
        break;
      case "quotes":
        add("generateQuote", "Memory requests quotes");
        break;
      case "payments":
        add("sendInvoice", "Memory requests payments / invoicing");
        break;
      case "marketing":
        add("generateCampaign", "Memory requests marketing");
        break;
      case "dashboard":
        add("buildDashboard", "Memory requests an owner dashboard");
        break;
      case "services":
        add("createService", "Memory requests a service catalog");
        break;
      case "memberships":
        add("createMembership", "Memory requests memberships");
        break;
      case "photos":
        add("analyzePhotos", "Memory requests photo analysis");
        break;
      case "coaching":
        add("coachBusiness", "Memory requests coaching");
        break;
      case "full_business_system":
        add("buildWebsite", "Full system: website");
        add("createCrm", "Full system: CRM");
        add("createBookingFlow", "Full system: booking");
        add("scheduleJob", "Full system: calendar");
        add("generateQuote", "Full system: quotes");
        add("buildDashboard", "Full system: dashboard");
        add("generateCampaign", "Full system: marketing");
        break;
      default:
        break;
    }
  }
  return wanted;
}

/**
 * Propose a plan from structured Business Memory only.
 * Do not pass raw conversation here — run Understanding first.
 */
export function proposePlanFromMemory(
  memoryInput?: HublyBusinessMemoryInput | null,
): HublyPlan {
  const memory = normalizeBusinessMemory(memoryInput);
  const intent = readStructuredIntent(memory);
  const outcomes = [...(intent.requestedOutcomes || [])];

  // Derive outcomes from other structured memory fields when intent is thin.
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

  const wanted = outcomesToSkills(outcomes);

  // Structured goal string for the plan — from memory, not raw chat.
  const goal =
    (intent.goals && intent.goals[0]) ||
    (typeof memory.goals === "string" ? memory.goals : null) ||
    (Array.isArray(memory.goals) && memory.goals[0] ? String(memory.goals[0]) : null) ||
    (memory.name ? `Grow ${memory.name}` : "Help grow this business");

  if (!wanted.length && memory.name) {
    wanted.push({ skill: "coachBusiness", why: "Memory has a business but no requested outcomes yet" });
  }

  const steps: HublyPlanStep[] = wanted.map(({ skill, why }) => {
    const meta = getSkill(skill);
    return {
      skill,
      why,
      status: meta?.executable ? "ready" : "blocked",
    };
  });

  const skills = steps.map((s) => s.skill);
  const blocked = steps.filter((s) => s.status === "blocked").map((s) => s.skill);

  return {
    goal,
    skills,
    steps,
    status: "proposed",
    blocked,
    source: "business_memory",
  };
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

/** Phase 7.4 stub — does not mutate product data. */
export function executePlanStub(plan: HublyPlan): HublyExecutionResult {
  const ran: HublyExecutionResult["ran"] = [];
  const skipped: HublyExecutionResult["skipped"] = [];
  for (const step of plan.steps) {
    const skill = getSkill(step.skill);
    if (!skill?.executable) {
      skipped.push({
        skill: step.skill,
        reason: "Skill not executable yet — Phase 7.4 executor pending",
      });
      continue;
    }
    ran.push({ skill: step.skill, ok: true, detail: "Executed (stub)" });
  }
  return {
    plan: { ...plan, status: skipped.length && !ran.length ? "proposed" : "done" },
    ran,
    skipped,
  };
}

export const HublyPlanner = {
  /** Preferred — memory only */
  proposeFromMemory: proposePlanFromMemory,
  /** @deprecated */
  proposeFromText: proposePlanFromText,
  listAvailableSkills: listSkills,
  executeStub: executePlanStub,
};

export default HublyPlanner;
