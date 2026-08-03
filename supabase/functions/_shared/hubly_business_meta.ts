// supabase/functions/_shared/hubly_business_meta.ts
//
// The single place that understands businesses.meta's storage format.
// `meta` is a Postgres `text` column (confirmed via information_schema),
// so every raw `.select()` returns it as a JSON string, not a parsed
// object — but a large number of readers across the booking/marketplace/
// studio call chain treated it as already-parsed, silently reading
// `undefined` for every field (or, worse, in a few write paths, spreading
// the raw string into an object and corrupting it before writing back).
//
// Every reader of a business row's `meta` field should go through this
// function instead of accessing `.meta` directly. One bug fixed once,
// not the same bug found again in a new file later.

export function getBusinessMeta(business: { meta?: unknown } | null | undefined): Record<string, unknown> {
  const raw = business?.meta;
  if (raw == null) return {};
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      // Malformed JSON in storage — treat as unknown, never throw and
      // never let a bad row take down an entire request.
      return {};
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}
