// supabase/functions/_shared/hubly_business_understanding.ts
//
// The shape of "what Hubly has learned about a business" — the AI's evolving
// mental model, and the seed of Business DNA. Platform-owned, like the
// Capability Registry: any future consumer (not just Hubly Conversation) can
// import this same type.
//
// Not persisted yet — no database table. Today this is accumulated
// CLIENT-SIDE, patch by patch, the same way a CRDT or a Git history merges:
// {} → patch → patch → patch → merged forever. The conversation service only
// ever emits or receives a PATCH (only what changed this turn) — it never
// resends the full state, and the server never reconstructs or stores it.
//
// IMPORTANT — this data model must stay factual and neutral:
// - Never contains a string like "Unknown" or any placeholder value. The
//   ABSENCE of a key IS the "not yet known" state. Friendly customer-facing
//   language ("Still learning", "Not discussed yet", "Connected") is applied
//   by whatever renders this — never baked into the data itself.
// - `scheduling.current_system` / `crm.current_system` / `payments.current_system`
//   record what the business SAID they currently use (a fact learned in
//   conversation) — they are NOT a claim that Hubly is connected to that
//   system. A future real integration is a different, separate signal and
//   must not be conflated with "the owner mentioned a tool's name."

export type BusinessUnderstandingPatch = {
  business?: { name?: string };
  industry?: string;
  services?: string[];
  website?: { status?: "found" | "not_found"; url?: string };
  brand?: { colors?: string[] };
  scheduling?: { current_system?: string };
  crm?: { current_system?: string };
  payments?: { current_system?: string };
  goals?: string[];
};

export const UNDERSTANDING_CATEGORIES = [
  "business",
  "industry",
  "services",
  "website",
  "brand",
  "scheduling",
  "crm",
  "payments",
  "goals",
] as const;

/** Shallow-merges a new patch onto an accumulated state — same rule a client applies across turns. */
export function mergeUnderstandingPatch(
  base: BusinessUnderstandingPatch,
  patch: BusinessUnderstandingPatch | null | undefined,
): BusinessUnderstandingPatch {
  if (!patch || typeof patch !== "object") return base;
  const next: BusinessUnderstandingPatch = { ...base };
  for (const key of UNDERSTANDING_CATEGORIES) {
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

export function isEmptyPatch(patch: BusinessUnderstandingPatch | null | undefined): boolean {
  if (!patch) return true;
  return UNDERSTANDING_CATEGORIES.every((k) => (patch as Record<string, unknown>)[k] === undefined);
}
