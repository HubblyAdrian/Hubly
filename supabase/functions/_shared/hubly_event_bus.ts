/**
 * Hubly Core — Business Event Bus
 *
 * Powers Connected Apps, Creative, Marketing, Reviews, Website, CRM, Automation.
 * Publishers emit typed business events. Consumers subscribe by event and/or
 * capability — never by hardcoding provider names in workflows.
 *
 * Client Stage 1 twin: public/journey-os/hubly-events.js (Rule #17 / #18).
 * This module is the server/shared contract + capability fan-out.
 *
 * Flow:
 *   Project Delivered → Event Bus → subscribers needing creative|publishing|reviews|…
 *   → Connected Apps engine picks Canva / Meta / GBP / … by capability
 */

import {
  listConnectedAppsByCapability,
  type ConnectedAppCapability,
  type ConnectedAppProvider,
} from "./hubly_connected_apps.ts";

/** Canonical business event types — extend carefully; events are immutable history. */
export type HublyBusinessEventType =
  | "lead.created"
  | "lead.qualified"
  | "quote.sent"
  | "quote.accepted"
  | "customer.created"
  | "job.booked"
  | "job.started"
  | "job.completed"
  | "project.created"
  | "project.booked"
  | "project.editing_complete"
  | "project.delivered"
  | "gallery.published"
  | "gallery.delivered"
  | "invoice.sent"
  | "invoice.paid"
  | "payment.received"
  | "deposit.paid"
  | "review.requested"
  | "review.received"
  | "campaign.sent"
  | "app.connected"
  | "app.disconnected"
  | "creative.asset_planned"
  | "creative.asset_created"
  | "ai.action.proposed"
  | "ai.action.executed";

export type HublyBusinessEvent = {
  id: string;
  type: HublyBusinessEventType;
  at: string;
  businessId: string;
  /** Entity refs only — never full duplicated records (Rule #15). */
  payload: Record<string, unknown>;
  /** Capabilities this event typically unlocks for downstream engines. */
  capabilities?: ConnectedAppCapability[];
};

export type HublyEventHandler = (
  event: HublyBusinessEvent,
) => void | Promise<void>;

export type HublyEventSubscription = {
  id: string;
  /** Specific events, or "*" for all. */
  events: HublyBusinessEventType[] | "*";
  /**
   * Subscribe by capability need — Event Bus notifies when an event
   * declares matching capabilities. Handlers must not assume a vendor.
   */
  capabilities?: ConnectedAppCapability[];
  /** Optional engine label for logs (creative, marketing, reviews, …). */
  engine?: string;
  handler: HublyEventHandler;
};

export type HublyEventEmitResult = {
  event: HublyBusinessEvent;
  notified: number;
  /** Connected Apps that declare capabilities matching the event — informational. */
  matchingApps: { id: string; name: string; capabilities: ConnectedAppCapability[] }[];
};

const _subs = new Map<string, HublyEventSubscription>();
const _history: HublyBusinessEvent[] = [];
const MAX_HISTORY = 200;

/** Default capability hints when publishers omit them. */
export const EVENT_CAPABILITY_HINTS: Partial<
  Record<HublyBusinessEventType, ConnectedAppCapability[]>
> = {
  "project.delivered": ["creative", "publishing", "reviews", "scheduling", "messaging"],
  "gallery.delivered": ["creative", "publishing", "reviews", "messaging"],
  "gallery.published": ["publishing", "reviews"],
  "project.editing_complete": ["creative", "assets_export", "publishing"],
  "invoice.paid": ["messaging", "reviews"],
  "job.completed": ["reviews", "creative", "publishing", "messaging"],
  "review.received": ["publishing", "analytics"],
  "customer.created": ["messaging"],
  "creative.asset_created": ["publishing", "scheduling"],
  "app.connected": ["webhooks"],
};

function newId(): string {
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function subscribe(sub: HublyEventSubscription): () => void {
  _subs.set(sub.id, sub);
  return () => {
    _subs.delete(sub.id);
  };
}

export function unsubscribe(id: string): void {
  _subs.delete(id);
}

export function listSubscriptions(): HublyEventSubscription[] {
  return Array.from(_subs.values());
}

export function recentEvents(limit = 20): HublyBusinessEvent[] {
  return _history.slice(0, limit);
}

/** Test-only — product code must never clear business event history. */
export function clearEventHistoryForTests(): void {
  _history.length = 0;
}

export function clearSubscriptionsForTests(): void {
  _subs.clear();
}

function eventMatches(
  sub: HublyEventSubscription,
  event: HublyBusinessEvent,
): boolean {
  const eventOk =
    sub.events === "*" ||
    (Array.isArray(sub.events) && sub.events.includes(event.type));
  if (!eventOk) return false;
  if (!sub.capabilities || !sub.capabilities.length) return true;
  const caps = event.capabilities || [];
  if (!caps.length) return false;
  return sub.capabilities.some((c) => caps.includes(c));
}

/**
 * Emit a typed business event. Fan-out to subscribers by event + capability.
 * Returns matching Connected Apps so engines can route without hardcoding vendors.
 */
export async function emit(
  type: HublyBusinessEventType,
  opts: {
    businessId: string;
    payload?: Record<string, unknown>;
    capabilities?: ConnectedAppCapability[];
  },
): Promise<HublyEventEmitResult> {
  const capabilities =
    opts.capabilities ||
    EVENT_CAPABILITY_HINTS[type] ||
    [];
  const event: HublyBusinessEvent = Object.freeze({
    id: newId(),
    type,
    at: new Date().toISOString(),
    businessId: opts.businessId,
    payload: Object.freeze({ ...(opts.payload || {}) }),
    capabilities: capabilities.length ? [...capabilities] : undefined,
  }) as HublyBusinessEvent;

  _history.unshift(event);
  if (_history.length > MAX_HISTORY) _history.length = MAX_HISTORY;

  const matchingApps = capabilities.length
    ? capabilityMatchedApps(capabilities)
    : [];

  let notified = 0;
  for (const sub of _subs.values()) {
    if (!eventMatches(sub, event)) continue;
    notified += 1;
    try {
      await sub.handler(event);
    } catch (err) {
      console.warn("[hubly_event_bus] subscriber error", sub.id, err);
    }
  }

  return { event, notified, matchingApps };
}

export function capabilityMatchedApps(
  capabilities: ConnectedAppCapability[],
): { id: string; name: string; capabilities: ConnectedAppCapability[] }[] {
  const map = new Map<string, ConnectedAppProvider>();
  for (const cap of capabilities) {
    for (const p of listConnectedAppsByCapability(cap)) {
      map.set(p.id, p);
    }
  }
  return Array.from(map.values()).map((p) => ({
    id: p.id,
    name: p.name,
    capabilities: p.capabilities(),
  }));
}

/** Register built-in engine stubs that react by capability (no vendor names). */
export function registerDefaultEngineSubscribers(): void {
  if (_subs.has("engine.creative")) return;

  subscribe({
    id: "engine.creative",
    engine: "creative",
    events: [
      "project.delivered",
      "project.editing_complete",
      "gallery.delivered",
    ],
    capabilities: ["creative", "templates"],
    handler: async (event) => {
      // Creative Engine consumes the event; provider chosen later by Action Engine.
      void event;
    },
  });

  subscribe({
    id: "engine.publishing",
    engine: "marketing",
    events: ["project.delivered", "gallery.delivered", "creative.asset_created"],
    capabilities: ["publishing", "scheduling"],
    handler: async (event) => {
      void event;
    },
  });

  subscribe({
    id: "engine.reviews",
    engine: "reviews",
    events: ["project.delivered", "gallery.delivered", "job.completed", "invoice.paid"],
    capabilities: ["reviews"],
    handler: async (event) => {
      void event;
    },
  });

  subscribe({
    id: "engine.messaging",
    engine: "automation",
    events: ["project.delivered", "gallery.delivered", "invoice.paid", "customer.created"],
    capabilities: ["messaging"],
    handler: async (event) => {
      void event;
    },
  });
}

export const HublyEventBus = {
  emit,
  subscribe,
  unsubscribe,
  listSubscriptions,
  recentEvents,
  capabilityMatchedApps,
  registerDefaultEngineSubscribers,
  EVENT_CAPABILITY_HINTS,
  clearEventHistoryForTests,
  clearSubscriptionsForTests,
};
