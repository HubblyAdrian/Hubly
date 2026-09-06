// THE single "resolve-or-create the canonical CRM customer" implementation.
//
// There is exactly ONE customer identity resolver in this codebase and this is
// it. `crm_from_booking.ts` used to carry a second one that disagreed with this
// one in three ways — different precedence, raw-string phone comparison, and an
// unguarded name match — and two resolvers that disagree IS the bug class.
// Aligning them would have left the class open, so the other one now calls this.
// If you are about to write a third, don't: add to this one.
//
// PRECEDENCE (business-scoped, no fuzzy matching, no guessing):
//   normalised phone -> email -> CREATE
//
// NAME IS NEVER A MATCH KEY, under any condition. It used to be, guarded by
// "only when no phone/email was supplied AND exactly one candidate matches",
// and that guard is not sufficient: two different people called John Smith, one
// of them walking in with no contact details, merge into one record. The guard
// made it rare, not safe, and the failure is silent and unrecoverable — one
// person's history, vehicle and notes attached to another person.
//
// STATUS NOTE (2026-09-06): #44 is a real merge path with ZERO OBSERVED
// INSTANCES, demonstrated by reading the code, not by finding it in data. The
// four duplicate rows in production were hand-entered through the owner CRM UI
// (public/hubly.html), which does no identity resolution and is deliberately
// out of scope — an owner who types two customers with the same email chose to
// keep them apart, and resolving that would be the very merge this file exists
// to prevent.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * THE phone normaliser. One named export, used by every phone comparison and
 * every phone write in the codebase.
 *
 * Not an inline expression, and not two copies. When five copies of `money()`
 * existed, all five were wrong the same way and the storefront quoted a price
 * it did not charge. A phone rule is worse: `+1 (555) 010-0123` and
 * `5550100123` are different strings, so a unique index on raw phone text is
 * worthless and a raw-string lookup silently fails to find the person it is
 * looking at.
 *
 * Returns the last 10 digits, or "" when there are fewer than MIN_PHONE_DIGITS.
 * The last-10 rule deliberately makes "+1 801 555 1234" and "(801) 555-1234"
 * the same customer.
 */
export const MIN_PHONE_DIGITS = 7;

export function normalisePhone(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length < MIN_PHONE_DIGITS) return "";
  return digits.slice(-10);
}

/** True when this contact carries an identifier we are willing to match on. */
export function hasStrongIdentifier(phone?: unknown, email?: unknown): boolean {
  return !!normalisePhone(phone) || !!String(email ?? "").trim();
}

export type CrmCustomerContact = {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

export type CrmCustomerResult = {
  customer: Record<string, unknown> | null;
  error: string | null;
  /** How the row was arrived at — for callers that want to log or branch. */
  matchedBy: "phone" | "email" | "created" | "none";
  /** True when the lookup found MORE than one candidate and had to choose. */
  ambiguous: boolean;
};

// A business's customer list is fetched to compare normalised phones in JS,
// because the stored format varies and Postgres cannot index what we have not
// normalised. Bounded so a large list cannot become an unbounded read.
const SCAN_LIMIT = 2000;

/**
 * Resolve an existing `customers` row for this business by normalised phone,
 * then email, or create one.
 *
 * SURVIVES EXISTING DUPLICATES (R6). Every lookup here is a bounded select that
 * reads `error` and handles multiple matches EXPLICITLY, choosing the oldest by
 * `created_at`. It never uses `.maybeSingle()` on a non-unique column.
 *
 * That matters more than it looks. `.maybeSingle()` raises PGRST116 when two
 * rows match; supabase-js returns that as `{ data: null, error }` rather than
 * throwing, and the old code destructured `{ data }` and discarded `error`. So
 * the moment two rows shared an email, the lookup silently stopped finding
 * anyone and every subsequent booking for that address inserted another row —
 * forever, for that email. Duplicates compounded instead of self-correcting.
 * There are four such rows in production right now, and the owner CRM will keep
 * making more, by design. Deterministic multi-row handling is what makes
 * leaving that surface alone survivable.
 */
export async function resolveOrCreateCrmCustomer(
  admin: SupabaseClient,
  businessId: string,
  contact: CrmCustomerContact,
): Promise<CrmCustomerResult> {
  const phone = String(contact.phone || "").trim();
  const email = String(contact.email || "").trim().toLowerCase();
  const name = String(contact.name || "").trim();
  if (!name) return { customer: null, error: "customer_name_required", matchedBy: "none", ambiguous: false };
  if (!businessId) return { customer: null, error: "business_id_required", matchedBy: "none", ambiguous: false };

  const phone10 = normalisePhone(phone);
  let customer: Record<string, unknown> | null = null;
  let matchedBy: CrmCustomerResult["matchedBy"] = "created";
  let ambiguous = false;

  /** Oldest-first, so a repeated call always resolves to the same row. */
  function oldest(rows: Record<string, unknown>[]): Record<string, unknown> {
    return [...rows].sort((a, b) =>
      String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""))
    )[0];
  }

  // 1. PHONE, normalised on both sides. Authoritative.
  if (phone10) {
    const { data, error } = await admin
      .from("customers")
      .select("*")
      .eq("business_id", businessId)
      .limit(SCAN_LIMIT);
    if (error) {
      // A failed read is NOT "nobody matched". Refusing here is the honest
      // answer: inserting now would create a duplicate of a row we simply
      // could not see. (STATE: a denied read and an empty one look identical.)
      return { customer: null, error: `customer_lookup_failed: ${error.message}`, matchedBy: "none", ambiguous: false };
    }
    const hits = (data || []).filter(
      (c: Record<string, unknown>) => normalisePhone(c.phone) === phone10,
    );
    if (hits.length) {
      ambiguous = hits.length > 1;
      customer = oldest(hits);
      matchedBy = "phone";
    }
  }

  // 2. EMAIL, case-insensitive. Authoritative. Bounded, multi-row explicit.
  if (!customer && email) {
    const { data, error } = await admin
      .from("customers")
      .select("*")
      .eq("business_id", businessId)
      .ilike("email", email)
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) {
      return { customer: null, error: `customer_lookup_failed: ${error.message}`, matchedBy: "none", ambiguous: false };
    }
    const hits = data || [];
    if (hits.length) {
      ambiguous = hits.length > 1;
      customer = hits[0]; // ordered oldest-first by the query itself
      matchedBy = "email";
    }
  }

  // 3. NO NAME STEP. A contact with neither a usable phone nor an email is a
  //    NEW ROW, every time. Never guess (R3).
  if (!customer) {
    const { data: inserted, error: custErr } = await admin
      .from("customers")
      .insert({
        business_id: businessId,
        name,
        // Written through the normaliser's source value, not a reformat: we
        // store what the person gave us and compare normalised.
        phone: phone || null,
        email: email || null,
        customer_type: "one_off",
      })
      .select()
      .single();
    if (custErr || !inserted) {
      return {
        customer: null,
        error: custErr?.message || "customer_create_failed",
        matchedBy: "none",
        ambiguous: false,
      };
    }
    customer = inserted;
    matchedBy = "created";
  }

  return { customer, error: null, matchedBy, ambiguous };
}

/**
 * IDENTITY-FIELD MERGE RULE (R4). Fill blanks only, never overwrite.
 *
 * Scope is deliberately narrow: `phone`, `email`, `name`. If a stored identity
 * field is non-empty and the incoming value differs, THE STORED ONE WINS and
 * the incoming value is not written. A booking that arrives with a different
 * phone is evidence we may be looking at a different person, and quietly
 * rewriting the record is how one customer's contact details end up on
 * another's history.
 *
 * This does NOT govern `preferred_service`, `vehicle_*` or `notes`. A
 * customer's current vehicle and latest service are legitimately new
 * information and freezing them at the first booking would be a worse bug than
 * the one this fixes. Callers update those normally.
 *
 * Returns only the keys that should actually be written — `{}` when there is
 * nothing to fill.
 */
export function identityFillOnly(
  existing: Record<string, unknown>,
  incoming: { name?: string | null; phone?: string | null; email?: string | null },
): Record<string, string> {
  const patch: Record<string, string> = {};
  const blank = (v: unknown) => String(v ?? "").trim() === "";
  const inName = String(incoming.name ?? "").trim();
  const inPhone = String(incoming.phone ?? "").trim();
  const inEmail = String(incoming.email ?? "").trim().toLowerCase();
  if (inName && blank(existing.name)) patch.name = inName;
  if (inPhone && blank(existing.phone)) patch.phone = inPhone;
  if (inEmail && blank(existing.email)) patch.email = inEmail;
  return patch;
}
