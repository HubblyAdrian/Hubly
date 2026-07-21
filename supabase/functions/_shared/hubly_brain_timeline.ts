/**
 * Hubly signature surface — Business Timeline
 *
 * Every AI action is recorded as the story of the business.
 * Owners see what Hubly has done and what it recommends next —
 * not a dashboard-first experience.
 */

export type HublyTimelineKind = "action" | "recommendation" | "milestone" | "learning";

export type HublyTimelineEvent = {
  id: string;
  at: string;
  kind: HublyTimelineKind;
  title: string;
  detail?: string | null;
  capability?: string | null;
  meta?: Record<string, unknown> | null;
};

export type HublyBusinessTimeline = {
  version: 1;
  businessId?: string | null;
  events: HublyTimelineEvent[];
  headline: string;
  nextUp: HublyTimelineEvent[];
};

function eid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function timelineEvent(
  partial: Omit<HublyTimelineEvent, "id" | "at"> & { id?: string; at?: string },
): HublyTimelineEvent {
  return {
    id: partial.id || eid("evt"),
    at: partial.at || new Date().toISOString(),
    kind: partial.kind,
    title: partial.title,
    detail: partial.detail ?? null,
    capability: partial.capability ?? null,
    meta: partial.meta ?? null,
  };
}

/** Build a launch timeline from a completed build run. */
export function buildLaunchTimeline(opts: {
  businessId?: string | null;
  businessName?: string | null;
  completed: Array<{ capability: string; detail?: string | null }>;
  domainPreferred?: string | null;
  recommendations?: string[];
}): HublyBusinessTimeline {
  const name = opts.businessName || "your business";
  const events: HublyTimelineEvent[] = [
    timelineEvent({
      kind: "milestone",
      title: `${name} is live`,
      detail: "Hubly built your company from conversation",
      capability: null,
    }),
  ];

  const labels: Record<string, string> = {
    understanding: "Understood your business",
    branding: "Created your brand",
    website: "Website created",
    booking: "Booking enabled",
    crm: "CRM generated",
    payments: "Payments prepared",
    dashboard: "Dashboard ready",
    marketplace: "Customer profile prepared",
    domain: "Domain found",
    coaching: "Growth focus set",
  };

  for (const c of opts.completed) {
    events.push(timelineEvent({
      kind: "action",
      title: labels[c.capability] || `${c.capability} completed`,
      detail: c.detail || null,
      capability: c.capability,
    }));
  }

  if (opts.domainPreferred) {
    events.push(timelineEvent({
      kind: "action",
      title: `Domain ready: ${opts.domainPreferred}`,
      detail: "One-click purchase coming soon",
      capability: "domain",
    }));
  }

  const nextUp = (opts.recommendations || [
    "Ask three happy customers for reviews",
    "Confirm your preferred domain",
    "Share your booking link with past clients",
  ]).map((title) =>
    timelineEvent({
      kind: "recommendation",
      title,
      detail: "Hubly will keep watching what changes",
    })
  );

  return {
    version: 1,
    businessId: opts.businessId || null,
    events,
    headline: `Here's what Hubly has done for ${name}`,
    nextUp,
  };
}

export const HublyTimeline = {
  event: timelineEvent,
  buildLaunch: buildLaunchTimeline,
};

export default HublyTimeline;
