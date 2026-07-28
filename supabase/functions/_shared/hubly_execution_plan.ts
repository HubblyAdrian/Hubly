/**
 * Hubly Core — Execution Plan
 *
 * Pipeline:
 *   Intent → Planner → Capability Resolver → Execution Plan → Event Bus → Providers
 *
 * An Execution Plan is previewable, editable, approvable, cancellable —
 * then executed. AI never jumps straight to vendors.
 */

import type { CapabilityNeed } from "./hubly_action_engine.ts";

export type ExecutionPlanStatus =
  | "draft"
  | "approved"
  | "cancelled"
  | "executing"
  | "completed"
  | "failed";

export type ExecutionPlanStep = {
  id: string;
  /** Capability language — never a vendor name in owner/AI copy. */
  capability: string;
  label: string;
  required: boolean;
  status: "planned" | "ready" | "blocked" | "not_configured" | "skipped" | "done" | "failed";
  /** Internal binding for executors only. */
  providerId?: string;
  message?: string;
};

export type ExecutionPlan = {
  id: string;
  intentId: string;
  intentLabel: string;
  businessId: string;
  projectId?: string;
  status: ExecutionPlanStatus;
  /** Capability needs in owner language. */
  needs: { label: string; capability: string; required: boolean }[];
  steps: ExecutionPlanStep[];
  /** AI / Ask Hubly preview — Intent + Capabilities only. */
  preview: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  cancelledAt?: string;
  executedAt?: string;
};

const _plans = new Map<string, ExecutionPlan>();

function newId(): string {
  return `xplan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildExecutionPlan(input: {
  intentId: string;
  intentLabel: string;
  businessId: string;
  projectId?: string;
  needs: CapabilityNeed[];
  steps: {
    capability: string;
    label: string;
    status: ExecutionPlanStep["status"];
    providerId?: string;
    message?: string;
    required?: boolean;
  }[];
}): ExecutionPlan {
  const needs = input.needs.map((n) => ({
    label: n.label,
    capability: n.capability,
    required: !!n.required,
  }));
  const steps: ExecutionPlanStep[] = input.steps.map((s, i) => ({
    id: `step_${i}_${s.capability}`,
    capability: s.capability,
    label: s.label,
    required: s.required ?? !!input.needs[i]?.required,
    status: s.status,
    providerId: s.providerId,
    message: s.message,
  }));

  const missing = steps
    .filter((s) => s.required && (s.status === "blocked" || s.status === "not_configured"))
    .map((s) => s.label);

  const preview =
    `Intent: ${input.intentLabel}.\n` +
    `Capabilities needed: ${needs.map((n) => n.label).join(", ")}.\n` +
    (missing.length
      ? `Missing: ${missing.join(", ")}. Connect apps that provide these capabilities, then Approve.\n`
      : `Ready to Approve.\n`) +
    `Status: draft (preview — nothing has run yet).`;

  const now = new Date().toISOString();
  const plan: ExecutionPlan = {
    id: newId(),
    intentId: input.intentId,
    intentLabel: input.intentLabel,
    businessId: input.businessId,
    projectId: input.projectId,
    status: "draft",
    needs,
    steps,
    preview,
    createdAt: now,
    updatedAt: now,
  };
  _plans.set(plan.id, plan);
  return plan;
}

export function getExecutionPlan(id: string): ExecutionPlan | null {
  return _plans.get(id) || null;
}

export function approveExecutionPlan(id: string): ExecutionPlan | null {
  const plan = _plans.get(id);
  if (!plan || plan.status !== "draft") return null;
  plan.status = "approved";
  plan.approvedAt = new Date().toISOString();
  plan.updatedAt = plan.approvedAt;
  plan.preview = plan.preview.replace(/Status: draft.*/, "Status: approved — ready to Execute.");
  return plan;
}

export function cancelExecutionPlan(id: string): ExecutionPlan | null {
  const plan = _plans.get(id);
  if (!plan || (plan.status !== "draft" && plan.status !== "approved")) return null;
  plan.status = "cancelled";
  plan.cancelledAt = new Date().toISOString();
  plan.updatedAt = plan.cancelledAt;
  plan.preview = plan.preview.replace(/Status:.*/, "Status: cancelled.");
  return plan;
}

export function markExecutionPlanExecuting(id: string): ExecutionPlan | null {
  const plan = _plans.get(id);
  if (!plan || plan.status !== "approved") return null;
  plan.status = "executing";
  plan.executedAt = new Date().toISOString();
  plan.updatedAt = plan.executedAt;
  plan.preview = plan.preview.replace(/Status:.*/, "Status: executing via Event Bus → Providers.");
  return plan;
}

export function markExecutionPlanCompleted(id: string, ok = true): ExecutionPlan | null {
  const plan = _plans.get(id);
  if (!plan) return null;
  plan.status = ok ? "completed" : "failed";
  plan.updatedAt = new Date().toISOString();
  plan.preview = plan.preview.replace(/Status:.*/, `Status: ${plan.status}.`);
  return plan;
}

/** Owner-facing view — strips providerIds. */
export function executionPlanForAi(plan: ExecutionPlan): {
  intent: string;
  capabilities: string[];
  status: ExecutionPlanStatus;
  preview: string;
  canApprove: boolean;
  canExecute: boolean;
} {
  return {
    intent: plan.intentLabel,
    capabilities: plan.needs.map((n) => n.label),
    status: plan.status,
    preview: plan.preview,
    canApprove: plan.status === "draft",
    canExecute: plan.status === "approved",
  };
}

export function clearExecutionPlansForTests(): void {
  _plans.clear();
}

export const HublyExecutionPlan = {
  build: buildExecutionPlan,
  get: getExecutionPlan,
  approve: approveExecutionPlan,
  cancel: cancelExecutionPlan,
  markExecuting: markExecutionPlanExecuting,
  markCompleted: markExecutionPlanCompleted,
  forAi: executionPlanForAi,
};
