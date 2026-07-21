/**
 * Hubly Runtime — Progress Bus (Phase 7.5)
 *
 * Central progress event system. Executors / Orchestrator emit; UI subscribes.
 * Nothing polls random endpoints.
 */

import type { HublyCapabilityId } from "./hubly_brain_capabilities.ts";

export type HublyProgressState =
  | "queued"
  | "running"
  | "waiting"
  | "retrying"
  | "completed"
  | "failed"
  | "cancelled";

/** Pipeline-level phases for live UX ("Nice to meet you…", "Learning…", "Done."). */
export type HublyPipelinePhase =
  | "greeting"
  | "understanding"
  | "planning"
  | "executing"
  | "done"
  | "failed"
  | "cancelled"
  | "memory"
  | "profile";

export type HublyProgressEvent = {
  runId: string;
  at: string;
  /** Capability node, or null for pipeline-level events */
  capability: HublyCapabilityId | null;
  state: HublyProgressState | HublyPipelinePhase;
  message: string;
  attempt?: number;
  error?: string;
  meta?: Record<string, unknown>;
};

export type HublyProgressListener = (event: HublyProgressEvent) => void;

export class HublyProgressBus {
  readonly runId: string;
  private listeners = new Set<HublyProgressListener>();
  private events: HublyProgressEvent[] = [];

  constructor(runId?: string) {
    this.runId = runId || crypto.randomUUID();
  }

  subscribe(listener: HublyProgressListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(
    partial: Omit<HublyProgressEvent, "runId" | "at"> & { at?: string },
  ): HublyProgressEvent {
    const event: HublyProgressEvent = {
      runId: this.runId,
      at: partial.at || new Date().toISOString(),
      capability: partial.capability,
      state: partial.state,
      message: partial.message,
      attempt: partial.attempt,
      error: partial.error,
      meta: partial.meta,
    };
    this.events.push(event);
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.warn("HublyProgressBus listener error", e);
      }
    }
    return event;
  }

  history(): HublyProgressEvent[] {
    return this.events.map((e) => ({ ...e }));
  }

  clearListeners(): void {
    this.listeners.clear();
  }
}

export function createProgressBus(runId?: string): HublyProgressBus {
  return new HublyProgressBus(runId);
}

export default HublyProgressBus;
