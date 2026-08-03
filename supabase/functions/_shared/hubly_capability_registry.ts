// supabase/functions/_shared/hubly_capability_registry.ts
//
// The Hubly Capability Registry — owned by the Hubly platform, not by any
// one interface. This is Hubly Core infrastructure.
//
// Not the legacy hubly_brain_capabilities.ts. That file belongs to the frozen
// Legacy Brain architecture and must not be extended or reused here — this is
// a deliberately separate, new registry.
//
// Shape: a Capability is a named area of what Hubly can do (Website, Booking,
// CRM, Marketing, ...). A Capability exposes one or more named Actions — the
// concrete, callable operations within it (e.g. Website: analyze, generate,
// update, publish). Consumers (the Hubly Conversation service today; the
// dashboard, Studio, Marketplace, or a future Hubly agent tomorrow) ask
// "which capability solves this?" and then invoke one of its actions. The
// registry doesn't know or care who's asking.
//
// Rules this file exists to satisfy:
// - Every capability and action is defined in exactly one place: this file.
//   Nothing about what a capability does is duplicated anywhere else — any
//   consumer's prompt/UI text describing available capabilities is generated
//   FROM this registry, never hand-written to describe it.
// - This registry dispatches; it never implements. An action's handler either
//   calls an existing backend service (that service remains the source of
//   truth) or, if no real backend exists yet, returns an honest "not real
//   yet" result. `real` must be revisited the moment the underlying
//   capability actually gets built — a stale `real:false` is the same
//   failure mode as fabricated analysis, just delayed.
// - Adding a Hubly Core capability (or a new action on an existing one) means
//   adding one entry here. No consumer's orchestration logic should ever
//   need to change to support it.
//
// Current scope note: capability/action names below cover only what's real
// today (website analysis, and honest stopgaps for social/listing analysis).
// The mapping of these names onto the full 14-group Hubly Core list is not
// finalized — that's a product-design decision, not something to lock in
// here. New capabilities (booking, crm, marketing, ...) get added as they're
// actually built, per "build on demand," not stubbed in speculatively.

const APP_ORIGIN = (Deno.env.get("HUBLY_APP_ORIGIN") || "").trim() || "https://myhubly.app";

export type CapabilityActionArgSchema = {
  type: "object";
  properties: Record<string, { type: string; description: string }>;
  required: string[];
};

export type CapabilityActionResult = {
  ok: boolean;
  /** Did genuine backend work actually happen, or is this a best-effort/limited stopgap? */
  real: boolean;
  /** Honest, human-readable account of what happened — consumers should rely on this and nothing more. */
  summary: string;
  raw?: unknown;
  error?: string;
};

export type CapabilityAction = {
  name: string;
  description: string;
  argsSchema: CapabilityActionArgSchema;
  handler: (args: Record<string, unknown>) => Promise<CapabilityActionResult>;
};

export type Capability = {
  name: string;
  description: string;
  actions: CapabilityAction[];
};

async function callImportAnalyze(type: string, url: string): Promise<any> {
  const res = await fetch(`${APP_ORIGIN}/api/import-analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type, url }),
  });
  return await res.json().catch(() => null);
}

// Same reuse pattern as callImportAnalyze above, one function over: the
// booking capability wraps the marketplace Edge Function's real,
// already-production booking_slots/booking_create actions over HTTP,
// exactly like a real customer-facing caller would — no booking logic
// lives here, no calendar/provider logic is touched or duplicated.
async function callMarketplace(action: string, payload: Record<string, unknown>): Promise<any> {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceKey) return null;
  const res = await fetch(`${supabaseUrl}/functions/v1/marketplace`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ action, ...payload }),
  });
  return await res.json().catch(() => null);
}

function isValidUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

const urlArgSchema = (description: string): CapabilityActionArgSchema => ({
  type: "object",
  properties: { url: { type: "string", description } },
  required: ["url"],
});

const bookingArgSchema = (
  extra: Record<string, { type: string; description: string }>,
  required: string[],
): CapabilityActionArgSchema => ({
  type: "object",
  properties: {
    businessId: {
      type: "string",
      description:
        "Automatically supplied by the system before this runs — you do not know the real value and never need to. Put any placeholder here (e.g. \"current_business\"); do not decline to invoke just because you don't have a real business id.",
    },
    ...extra,
  },
  required: ["businessId", ...required],
});

/** Shared by the three social/listing actions — none have a real integration yet. */
function socialStopgapHandler(platform: "facebook" | "instagram" | "google_business") {
  return async (args: Record<string, unknown>): Promise<CapabilityActionResult> => {
    const url = String(args?.url || "").trim();
    if (!isValidUrl(url)) {
      return { ok: false, real: false, summary: "No valid URL was provided.", error: "invalid_url" };
    }
    const r = await callImportAnalyze(platform, url);
    const handle = r?.analysis?.handle || "";
    // Deliberately ignore r.analysis.note / r.analysis.queued from the legacy
    // analyzer — those claim work ("enrichment continues in Builder") that
    // never actually happens anywhere in this codebase today.
    const label = platform === "google_business" ? "Google Business" : platform === "facebook" ? "Facebook" : "Instagram";
    return {
      ok: true,
      real: false,
      summary: `No live integration exists for ${label} yet, so its content could not be read. Only the link itself was recognized${handle ? ` (handle: "${handle}")` : ""}.`,
      raw: { platform, handle, profileUrl: url },
    };
  };
}

export const HUBLY_CAPABILITY_REGISTRY: Capability[] = [
  {
    name: "website",
    description: "Build and manage a business's website.",
    actions: [
      {
        name: "analyze",
        description:
          "Fetches and reads a real, existing website: title, description, headings, service-like content, contact details, and dominant brand colors. This one is real and works today.",
        argsSchema: urlArgSchema("The business's website URL to read."),
        handler: async (args) => {
          const url = String(args?.url || "").trim();
          if (!isValidUrl(url)) {
            return { ok: false, real: false, summary: "No valid URL was provided.", error: "invalid_url" };
          }
          const r = await callImportAnalyze("website", url);
          if (!r?.ok || r.partial) {
            return {
              ok: true,
              real: false,
              summary: "The website could not be reached, so nothing was actually read from it.",
              raw: r?.analysis || null,
            };
          }
          return {
            ok: true,
            real: true,
            summary:
              "Real content was fetched and read from this website — title, description, headings, service-like list items, contact details, and dominant colors.",
            raw: r.analysis,
          };
        },
      },
      // generate / update / publish actions land here once their backend
      // capabilities exist as callable services — not stubbed speculatively.
    ],
  },
  {
    name: "online_presence",
    description: "Help a business be found — website, business listings, and social presence.",
    actions: [
      {
        name: "analyze_facebook",
        description:
          "Looks at a Facebook page URL. No live integration exists yet — this can only recognize the link itself, not read its content. Always disclose that limitation honestly.",
        argsSchema: urlArgSchema("The business's Facebook page URL."),
        handler: socialStopgapHandler("facebook"),
      },
      {
        name: "analyze_instagram",
        description:
          "Looks at an Instagram profile URL. No live integration exists yet — this can only recognize the link itself, not read its content. Always disclose that limitation honestly.",
        argsSchema: urlArgSchema("The business's Instagram profile URL."),
        handler: socialStopgapHandler("instagram"),
      },
      {
        name: "analyze_google_business",
        description:
          "Looks at a Google Business Profile URL. No live integration exists yet — this can only recognize the link itself, not read its content. Always disclose that limitation honestly.",
        argsSchema: urlArgSchema("The business's Google Business Profile URL."),
        handler: socialStopgapHandler("google_business"),
      },
    ],
  },
  {
    name: "booking",
    description:
      "Real availability and real booking creation, reused as-is from the production Marketplace booking engine — no calendar or provider logic lives here, this only wraps what already exists.",
    actions: [
      {
        name: "getAvailability",
        description:
          "Real bookable time slots for this business, computed from their actual schedule, connected calendar, and business hours. Returns real slots or an honest reason none exist yet — never invented times.",
        argsSchema: bookingArgSchema(
          {
            serviceId: { type: "string", description: "Which service to check availability for. Omit to use the business's first bookable service." },
            date: { type: "string", description: "A specific date (YYYY-MM-DD) to check. Omit to get the soonest available times." },
          },
          [],
        ),
        handler: async (args) => {
          const businessId = String(args?.businessId || "").trim();
          if (!businessId) {
            return { ok: false, real: false, summary: "No business was specified.", error: "missing_business_id" };
          }
          const r = await callMarketplace("booking_slots", {
            business_id: businessId,
            service_id: String(args?.serviceId || "").trim() || undefined,
            date: String(args?.date || "").trim() || undefined,
          });
          if (!r) {
            return { ok: false, real: false, summary: "Availability could not be checked right now.", error: "marketplace_unreachable" };
          }
          if (!r.ok) {
            // A real, honest outcome (e.g. this business isn't set up for
            // real-time booking yet) — not a client input error, so ok:true,
            // real:false, same convention as the website-couldn't-be-reached case.
            return {
              ok: true,
              real: false,
              summary: r.error === "Provider not found" || r.error === "Business not found"
                ? "This business isn't set up for real-time booking yet."
                : (r.error || "No availability could be found."),
              raw: r,
            };
          }
          const slotCount = Array.isArray(r.slots) ? r.slots.length : 0;
          return {
            ok: true,
            real: true,
            summary: slotCount
              ? `Found ${slotCount} real available time${slotCount === 1 ? "" : "s"} for ${r.service?.name || "this service"}, starting ${r.nextAvailable || "soon"}.`
              : `No real availability found for ${r.service?.name || "this service"} right now.`,
            raw: r,
          };
        },
      },
      {
        name: "create",
        description:
          "Creates a real booking — writes a real record, triggers real calendar sync and a real confirmation email. Only call this once the customer has chosen a real time from getAvailability and given their contact details.",
        argsSchema: bookingArgSchema(
          {
            serviceId: { type: "string", description: "Which service is being booked." },
            startsAt: { type: "string", description: "The exact start time the customer chose — must be a real slot from getAvailability, never invented." },
            customerName: { type: "string", description: "The customer's name." },
            customerEmail: { type: "string", description: "The customer's email, if given." },
            customerPhone: { type: "string", description: "The customer's phone, if given." },
            address: { type: "string", description: "Service address, if relevant/given." },
            notes: { type: "string", description: "Any special requests or notes the customer mentioned." },
          },
          ["serviceId", "startsAt", "customerName"],
        ),
        handler: async (args) => {
          const businessId = String(args?.businessId || "").trim();
          const serviceId = String(args?.serviceId || "").trim();
          const startsAt = String(args?.startsAt || "").trim();
          const customerName = String(args?.customerName || "").trim();
          if (!businessId || !serviceId || !startsAt || !customerName) {
            return { ok: false, real: false, summary: "Missing required booking details.", error: "missing_required_args" };
          }
          const r = await callMarketplace("booking_create", {
            business_id: businessId,
            service_id: serviceId,
            starts_at: startsAt,
            customer_name: customerName,
            customer_email: String(args?.customerEmail || "").trim() || undefined,
            customer_phone: String(args?.customerPhone || "").trim() || undefined,
            address: String(args?.address || "").trim() || undefined,
            notes: String(args?.notes || "").trim() || undefined,
          });
          if (!r) {
            return { ok: false, real: false, summary: "The booking could not be created right now.", error: "marketplace_unreachable" };
          }
          if (!r.ok) {
            return { ok: true, real: false, summary: r.error || "The booking could not be created.", raw: r };
          }
          const needsCheckout = !!r.checkout?.required;
          return {
            ok: true,
            real: true,
            summary: needsCheckout
              ? `Real booking created (${r.confirmation?.status || "pending"}) — a payment of $${((r.checkout.amount_cents || 0) / 100).toFixed(2)} (${r.checkout.charge_kind}) is required to confirm it.`
              : `Real booking confirmed for ${r.confirmation?.starts_at || startsAt}.`,
            raw: r,
          };
        },
      },
    ],
  },
];

export function findCapability(name: string): Capability | undefined {
  return HUBLY_CAPABILITY_REGISTRY.find((c) => c.name === name);
}

export function findAction(capabilityName: string, actionName: string): CapabilityAction | undefined {
  return findCapability(capabilityName)?.actions.find((a) => a.name === actionName);
}

/** Generates the capability/action description block for a consumer's prompt — the ONLY place this text is produced. */
export function buildCapabilitiesPromptBlock(registry: Capability[] = HUBLY_CAPABILITY_REGISTRY): string {
  return registry
    .map((cap) => {
      const actions = cap.actions
        .map((a) => {
          const args = Object.entries(a.argsSchema.properties)
            .map(([key, spec]) => {
              const req = a.argsSchema.required.includes(key) ? ", required" : ", optional";
              return `${key} (${spec.type}${req}): ${spec.description}`;
            })
            .join("; ");
          return `  - ${a.name}(${args})\n    ${a.description}`;
        })
        .join("\n");
      return `${cap.name}: ${cap.description}\n${actions}`;
    })
    .join("\n\n");
}
