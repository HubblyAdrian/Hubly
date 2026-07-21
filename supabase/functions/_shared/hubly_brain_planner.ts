/**
 * Hubly Brain — Planner + Executor stubs (Phases 7.3 / 7.4)
 *
 * Conversation → Business Understanding → Business Memory → Planner
 * → Capability Registry (skills) → Executors → product surfaces
 *
 * The Planner decides which skills to run.
 * Executors perform work — never let the model write the DB directly.
 *
 * These are structural stubs for Phase 7.1. Real planning/execution lands later.
 */

import type { HublyBusinessMemory } from "./hubly_brain_memory.ts";
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
};

export type HublyExecutionResult = {
  plan: HublyPlan;
  ran: Array<{ skill: HublySkillId; ok: boolean; detail: string }>;
  skipped: Array<{ skill: HublySkillId; reason: string }>;
};

/** Keyword heuristic planner — replaced by LLM Planner in Phase 7.3. */
export function proposePlanFromText(
  goal: string,
  _memory?: HublyBusinessMemory | null,
): HublyPlan {
  const g = String(goal || "").trim();
  const low = g.toLowerCase();
  const wanted: Array<{ skill: HublySkillId; why: string }> = [];

  const add = (skill: HublySkillId, why: string) => {
    if (!wanted.some((w) => w.skill === skill)) wanted.push({ skill, why });
  };

  add("understandBusiness", "Always ground the plan in who this business is");

  if (/website|site|landing|page|online presence/.test(low) || /build.*(business|software|system)/.test(low)) {
    add("buildWebsite", "Need a customer-facing Instant Site");
    add("publishWebsite", "Make the site live when ready");
  }
  if (/crm|customer|client list|pipeline/.test(low) || /build.*(business|software|system)/.test(low)) {
    add("createCrm", "Need a place to track customers and jobs");
  }
  if (/book|appoint|schedul|calendar/.test(low) || /build.*(business|software|system)/.test(low)) {
    add("createBookingFlow", "Need booking / intake");
    add("scheduleJob", "Need calendar / job scheduling");
  }
  if (/quote|estimat|pric/.test(low) || /build.*(business|software|system)/.test(low)) {
    add("generateQuote", "Need quotes / estimates");
  }
  if (/invoice|pay|stripe|deposit/.test(low)) {
    add("sendInvoice", "Need payments / invoicing");
  }
  if (/market|campaign|social|email blast|grow/.test(low)) {
    add("generateCampaign", "Need marketing to grow");
  }
  if (/coach|advice|help me run|grow my business/.test(low)) {
    add("coachBusiness", "Owner wants guidance, not just tools");
  }
  if (/photo|gallery|portfolio|image/.test(low)) {
    add("analyzePhotos", "Owner media should shape the brand");
  }
  if (/dashboard|ops|run my business/.test(low) || /build.*(business|software|system)/.test(low)) {
    add("buildDashboard", "Need an owner ops surface");
  }
  if (/service|package|menu|offer/.test(low)) {
    add("createService", "Need a service catalog");
  }
  if (/membership|subscription|recurring/.test(low)) {
    add("createMembership", "Need recurring memberships");
  }

  // Default "build my business" stack if only understanding was matched
  if (wanted.length <= 1 && /build|start|launch|set up|setup/.test(low)) {
    add("buildWebsite", "Core: website");
    add("createCrm", "Core: CRM");
    add("createBookingFlow", "Core: booking");
    add("generateQuote", "Core: quotes");
    add("buildDashboard", "Core: dashboard");
    add("generateCampaign", "Core: marketing");
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
    goal: g || "Help grow this business",
    skills,
    steps,
    status: "proposed",
    blocked,
  };
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
  proposeFromText: proposePlanFromText,
  listAvailableSkills: listSkills,
  executeStub: executePlanStub,
};

export default HublyPlanner;
