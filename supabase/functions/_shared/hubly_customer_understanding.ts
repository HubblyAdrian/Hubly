// supabase/functions/_shared/hubly_customer_understanding.ts
//
// Customer Understanding — the sibling schema to Business Understanding
// (hubly_business_understanding.ts), for the Website/Concierge context.
// Same mechanism, different subject: Business Understanding accumulates
// what's known about the BUSINESS; this accumulates what's known about a
// CUSTOMER and their job. Per docs/HUBLY_CONVERSATION_CONTEXT_MODEL.md
// Section 7 — there is one generic, engine-owned Understanding mechanism
// (patch, merge, never fabricate); this file is one schema plugged into it,
// not a second implementation of the mechanism itself.
//
// Same data-model discipline as Business Understanding:
// - Never contains a placeholder like "Unknown" — absence of a key IS the
//   "not yet known" state. Friendly rendering is a UI concern, never baked
//   in here.
// - Patch-based, like a CRDT or Git history: {} -> patch -> patch -> merged
//   forever. Not persisted by this file — whichever context owns
//   persistence (per its session policy) is responsible for that.

export type CustomerUnderstandingPatch = {
  customer?: { name?: string; phone?: string; email?: string };
  intent?: "booking" | "quote" | "question" | "support";
  selectedService?: { id?: string; name?: string; price?: string; duration?: string; addOns?: string[] };
  selectedPackage?: { id?: string; name?: string; price?: string };
  vehicleOrProperty?: string;
  address?: string;
  preferredDate?: string;
  preferredTime?: string;
  budget?: string;
  photos?: string[];
  specialRequests?: string;
  /** The AI's own read on where this conversation stands — not a fact the customer stated. */
  conversationStatus?: "gathering_info" | "ready_to_book" | "booked" | "abandoned";
  /** Set from a Booking capability's result once one is invoked, not guessed. */
  bookingStatus?: { status?: string; bookingId?: string };
};

export const CUSTOMER_UNDERSTANDING_CATEGORIES = [
  "customer",
  "intent",
  "selectedService",
  "selectedPackage",
  "vehicleOrProperty",
  "address",
  "preferredDate",
  "preferredTime",
  "budget",
  "photos",
  "specialRequests",
  "conversationStatus",
  "bookingStatus",
] as const;

/** Shallow-merges a new patch onto an accumulated state — identical rule to mergeUnderstandingPatch in hubly_business_understanding.ts. */
export function mergeCustomerUnderstandingPatch(
  base: CustomerUnderstandingPatch,
  patch: CustomerUnderstandingPatch | null | undefined,
): CustomerUnderstandingPatch {
  if (!patch || typeof patch !== "object") return base;
  const next: CustomerUnderstandingPatch = { ...base };
  for (const key of CUSTOMER_UNDERSTANDING_CATEGORIES) {
    const value = (patch as Record<string, unknown>)[key];
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      (next as Record<string, unknown>)[key] = value;
    } else if (value && typeof value === "object") {
      (next as Record<string, unknown>)[key] = {
        ...((base as Record<string, unknown>)[key] as object | undefined),
        ...value,
      };
    } else {
      (next as Record<string, unknown>)[key] = value;
    }
  }
  return next;
}

export function isEmptyCustomerUnderstandingPatch(patch: CustomerUnderstandingPatch | null | undefined): boolean {
  if (!patch) return true;
  return CUSTOMER_UNDERSTANDING_CATEGORIES.every((k) => (patch as Record<string, unknown>)[k] === undefined);
}
