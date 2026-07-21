/**
 * Hubly Brain — Executors (Phase 7.4)
 *
 * Planner selects skills. Executors perform work through Memory / platform APIs.
 * The model never writes the database directly.
 *
 * Safe skills (executable:true) write structured Memory SSOT only.
 * Website Builder and destructive CRM/job/payment skills stay gated until migrated.
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  mergeBusinessMemory,
  normalizeBusinessMemory,
  type HublyBusinessMemory,
  type HublyBusinessMemoryInput,
} from "./hubly_brain_memory.ts";
import { getSkill, type HublySkillId } from "./hubly_brain_skills.ts";
import type { HublyExecutionResult, HublyPlan } from "./hubly_brain_planner.ts";

export type HublyExecutorContext = {
  /** Owner business — required to persist Memory SSOT */
  businessId?: string | null;
  /** Prior / working memory */
  memory?: HublyBusinessMemoryInput | null;
  /** Auth'd user client (RLS) or service client after ownership check */
  supabase?: SupabaseClient | null;
  /** Persistence source tag for business_memories */
  source?: "system" | "ingest" | "understanding" | "client";
  /** When false, run skills but skip DB upsert (dry run / status demos) */
  persist?: boolean;
};

export type HublyExecutorOutcome = HublyExecutionResult & {
  memory: HublyBusinessMemory;
  persisted: boolean;
};

type SkillRunner = (args: {
  memory: HublyBusinessMemory;
  stepWhy: string;
  ctx: HublyExecutorContext;
}) => Promise<{ memory: HublyBusinessMemory; detail: string; effects?: Record<string, unknown> }>;

function adminOrThrow(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!supabaseUrl || !serviceKey) throw new Error("Server isn’t configured yet.");
  return createClient(supabaseUrl, serviceKey);
}

/** Persist canonical Memory to business_memories (executor path — never the model). */
export async function persistBusinessMemory(
  businessId: string,
  memory: HublyBusinessMemoryInput,
  opts?: {
    supabase?: SupabaseClient | null;
    source?: HublyExecutorContext["source"];
  },
): Promise<{ ok: boolean; error?: string }> {
  const normalized = normalizeBusinessMemory(memory);
  const client = opts?.supabase || adminOrThrow();
  const source = opts?.source || "system";
  const { error } = await client.from("business_memories").upsert(
    {
      business_id: businessId,
      memory: normalized,
      memory_version: normalized.version,
      source,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

const runUnderstandBusiness: SkillRunner = async ({ memory, stepWhy }) => {
  const next = mergeBusinessMemory(memory, {
    notes: memory.notes
      ? `${memory.notes}\n[understandBusiness] ${stepWhy}`.slice(0, 4000)
      : `[understandBusiness] ${stepWhy}`,
    extras: {
      ...(memory.extras && typeof memory.extras === "object" ? memory.extras : {}),
      lastUnderstoodAt: new Date().toISOString(),
    },
  });
  return {
    memory: next,
    detail: "Merged understanding into Business Memory SSOT",
    effects: { memoryKeys: Object.keys(next).filter((k) => (next as Record<string, unknown>)[k] != null) },
  };
};

const runCreateCrm: SkillRunner = async ({ memory }) => {
  const next = mergeBusinessMemory(memory, {
    currentCrm: {
      ...(memory.currentCrm && typeof memory.currentCrm === "object" ? memory.currentCrm : {}),
      pipeline: memory.currentCrm?.pipeline || "lead → booked → completed",
      customerCount: memory.currentCrm?.customerCount ?? 0,
      notes: memory.currentCrm?.notes || "CRM scaffolded via Hubly Brain executor",
    },
    extras: {
      ...(memory.extras && typeof memory.extras === "object" ? memory.extras : {}),
      crmReady: true,
      crmScaffoldedAt: new Date().toISOString(),
    },
  });
  return {
    memory: next,
    detail: "CRM structure recorded in Business Memory (platform tables later)",
    effects: { currentCrm: next.currentCrm },
  };
};

const runCreateBookingFlow: SkillRunner = async ({ memory }) => {
  const next = mergeBusinessMemory(memory, {
    extras: {
      ...(memory.extras && typeof memory.extras === "object" ? memory.extras : {}),
      bookingFlow: {
        enabled: true,
        intake: ["name", "phone", "service", "preferred_time"],
        scaffoldedAt: new Date().toISOString(),
      },
    },
  });
  return {
    memory: next,
    detail: "Booking flow preferences stored in Business Memory",
    effects: { bookingFlow: (next.extras as Record<string, unknown>)?.bookingFlow },
  };
};

const runBuildDashboard: SkillRunner = async ({ memory }) => {
  const next = mergeBusinessMemory(memory, {
    extras: {
      ...(memory.extras && typeof memory.extras === "object" ? memory.extras : {}),
      dashboard: {
        views: ["today", "jobs", "customers", "money"],
        scaffoldedAt: new Date().toISOString(),
      },
    },
  });
  return {
    memory: next,
    detail: "Owner dashboard preferences stored in Business Memory",
    effects: { dashboard: (next.extras as Record<string, unknown>)?.dashboard },
  };
};

const runCoachBusiness: SkillRunner = async ({ memory, stepWhy }) => {
  const next = mergeBusinessMemory(memory, {
    extras: {
      ...(memory.extras && typeof memory.extras === "object" ? memory.extras : {}),
      coach: {
        lastFocus: stepWhy || memory.onboardingPriority || "growth",
        at: new Date().toISOString(),
      },
    },
  });
  return {
    memory: next,
    detail: "Coaching focus recorded in Business Memory (no model DB write)",
    effects: { coach: (next.extras as Record<string, unknown>)?.coach },
  };
};

const EXECUTORS: Partial<Record<HublySkillId, SkillRunner>> = {
  understandBusiness: runUnderstandBusiness,
  createCrm: runCreateCrm,
  createBookingFlow: runCreateBookingFlow,
  buildDashboard: runBuildDashboard,
  coachBusiness: runCoachBusiness,
};

export function executableSkillIds(): HublySkillId[] {
  return (Object.keys(EXECUTORS) as HublySkillId[]).filter((id) => getSkill(id)?.executable);
}

/**
 * Run a plan through real executors.
 * Skips skills that are not executable or have no runner.
 * Persists Memory when businessId is set and persist !== false.
 */
export async function executePlan(
  plan: HublyPlan,
  ctx: HublyExecutorContext = {},
): Promise<HublyExecutorOutcome> {
  let memory = normalizeBusinessMemory(ctx.memory);
  const ran: HublyExecutionResult["ran"] = [];
  const skipped: HublyExecutionResult["skipped"] = [];

  for (const step of plan.steps) {
    const skill = getSkill(step.skill);
    if (!skill?.executable) {
      skipped.push({
        skill: step.skill,
        reason: "Skill not executable yet — Website Builder / platform migration pending",
      });
      continue;
    }
    const runner = EXECUTORS[step.skill];
    if (!runner) {
      skipped.push({
        skill: step.skill,
        reason: "Marked executable but no executor registered",
      });
      continue;
    }
    try {
      const result = await runner({ memory, stepWhy: step.why, ctx });
      memory = result.memory;
      ran.push({
        skill: step.skill,
        ok: true,
        detail: result.detail,
        effects: result.effects,
      });
    } catch (e) {
      ran.push({
        skill: step.skill,
        ok: false,
        detail: e instanceof Error ? e.message : "Executor failed",
      });
    }
  }

  let persisted = false;
  const shouldPersist = ctx.persist !== false && !!ctx.businessId && ran.some((r) => r.ok);
  if (shouldPersist && ctx.businessId) {
    const write = await persistBusinessMemory(ctx.businessId, memory, {
      supabase: ctx.supabase,
      source: ctx.source || "system",
    });
    persisted = write.ok;
    if (!write.ok) {
      skipped.push({
        skill: "understandBusiness",
        reason: `Memory persist failed: ${write.error || "unknown"}`,
      });
    }
  }

  const nextPlan: HublyPlan = {
    ...plan,
    status: ran.some((r) => r.ok) ? "done" : skipped.length ? "proposed" : plan.status,
  };

  return {
    plan: nextPlan,
    ran,
    skipped,
    memory,
    persisted,
  };
}

/** Sync helper for dry-run demos (status probe). */
export async function executePlanDryRun(
  plan: HublyPlan,
  memory?: HublyBusinessMemoryInput | null,
): Promise<HublyExecutorOutcome> {
  return executePlan(plan, { memory, persist: false });
}

export const HublyExecutors = {
  executePlan,
  executePlanDryRun,
  persistBusinessMemory,
  executableSkillIds,
  runners: EXECUTORS,
};

export default HublyExecutors;
