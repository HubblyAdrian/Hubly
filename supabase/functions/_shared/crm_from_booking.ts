// Shared CRM upsert — service-role only.
// Public booking must NEVER write customers. CRM updates only after:
//   - owner accepts a booking (via hire-crm edge), or
//   - payment succeeds (stripe-webhook).
//
// IDENTITY IS NOT DECIDED HERE. This file used to carry its own resolver, and
// it disagreed with the one in crm_customer.ts in three ways that all made it
// the more dangerous of the two:
//
//   1. precedence was email -> phone -> name (the other was phone -> email);
//   2. phone was compared as RAW TEXT (`.eq("phone", phone)`), so
//      "+1 (555) 010-0123" never matched "5550100123";
//   3. it fell through to a NAME match even when an email or phone HAD been
//      supplied and had not matched — the exact case the other resolver
//      deliberately refused, because a supplied-but-non-matching identifier is
//      positive evidence this is a DIFFERENT person. It then overwrote the
//      matched row's phone and email with the incoming booking's values.
//
// Two resolvers that disagree is the bug class; aligning them would have left
// the class open. So this file now calls resolveOrCreateCrmCustomer and owns
// only its OWN columns.
import {
  identityFillOnly,
  resolveOrCreateCrmCustomer,
} from "./crm_customer.ts";

export type CrmBookingRow = {
  business_id: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  service_name?: string | null;
  vehicle_type?: string | null;
  vehicle_year?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_color?: string | null;
  vehicle?: string | null;
  notes?: string | null;
  customer_type?: string | null;
};

// deno-lint-ignore no-explicit-any
type Admin = any;

export async function upsertCrmFromBooking(
  admin: Admin,
  row: CrmBookingRow,
): Promise<{ ok: boolean; customer_id?: string; error?: string }> {
  const name = String(row.customer_name || "").trim();
  if (!name || !row.business_id) {
    return { ok: false, error: "name and business_id required" };
  }

  // ── IDENTITY: the one resolver, and nothing else ────────────────────────
  const res = await resolveOrCreateCrmCustomer(admin, row.business_id, {
    name,
    phone: row.customer_phone ?? null,
    email: row.customer_email ?? null,
  });
  if (res.error || !res.customer) {
    return { ok: false, error: res.error || "customer_resolve_failed" };
  }
  const existing = res.customer;
  const customerId = String(existing.id || "");
  // A row we just created already holds the identity fields and the booking's
  // own columns are all we have left to write.
  const justCreated = res.matchedBy === "created";

  // ── THIS FILE'S OWN COLUMNS ─────────────────────────────────────────────
  // Updated normally, NOT fill-blanks-only: a customer's current vehicle and
  // latest service are legitimately new information every time they book, and
  // freezing them at the first booking would be a worse bug than the merge
  // this change fixes. R4 governs identity fields only, and they are handled
  // by identityFillOnly below.
  const payload: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    const s = typeof v === "string" ? v.trim() : v;
    if (s !== null && s !== undefined && s !== "") payload[k] = s;
  };
  set("preferred_service", row.service_name);
  set("vehicle_type", row.vehicle_type);
  set("vehicle_year", row.vehicle_year);
  set("vehicle_make", row.vehicle_make);
  set("vehicle_model", row.vehicle_model);
  set("vehicle_color", row.vehicle_color);
  set("vehicle", row.vehicle);
  if (row.customer_type) payload.customer_type = row.customer_type;

  // NOTES — FLAGGED, NOT FIXED (deliberate, 2026-09-06).
  // The previous code did `if (row.notes != null) payload.notes = String(row.notes)`,
  // which OVERWRITES whatever the owner had typed about this customer with the
  // note attached to the newest booking. That destroys owner-authored data and
  // it is a real defect — but it is not this change's defect, and folding it in
  // would make an identity diff into a data-retention diff. Behaviour is left
  // EXACTLY as it was. Fix it deliberately, with its own decision about whether
  // notes append, or move to a per-booking field.
  if (row.notes != null) payload.notes = String(row.notes);

  // ── IDENTITY FIELDS: fill blanks only, never overwrite (R4) ─────────────
  if (!justCreated) {
    Object.assign(
      payload,
      identityFillOnly(existing, {
        name,
        phone: row.customer_phone ?? null,
        email: row.customer_email ?? null,
      }),
    );
  }

  if (!Object.keys(payload).length) return { ok: true, customer_id: customerId };

  const { error } = await admin.from("customers").update(payload).eq("id", customerId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, customer_id: customerId };
}
