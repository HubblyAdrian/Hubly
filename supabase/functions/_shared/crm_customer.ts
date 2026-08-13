// The single, shared "resolve-or-create the canonical CRM customer"
// implementation. Extracted verbatim from the Website Concierge booking
// path (hubly_booking_execution.ts) so there is exactly ONE customer
// resolution algorithm across every booking entry point — Website
// Concierge and Marketplace alike. This is a refactor: the precedence and
// the insert shape are identical to what createWebsiteBookingJob() did
// inline before, so existing behavior is unchanged.
//
// Precedence (business-scoped, no fuzzy matching, no guessing):
//   phone (last-10 digits) -> email (case-insensitive) -> name -> create
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type CrmCustomerContact = {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

/**
 * Resolve an existing CRM `customers` row for this business by
 * phone -> email -> name, or create one. Returns { customer, error }:
 * `customer` is the real row (never a clone), or null with `error` set
 * when a hard insert failure occurred. Never guesses or fuzzy-matches.
 */
export async function resolveOrCreateCrmCustomer(
  admin: SupabaseClient,
  businessId: string,
  contact: CrmCustomerContact,
): Promise<{ customer: Record<string, unknown> | null; error: string | null }> {
  const phone = String(contact.phone || "").trim();
  const email = String(contact.email || "").trim().toLowerCase();
  const name = String(contact.name || "").trim();
  if (!name) return { customer: null, error: "customer_name_required" };

  // #185 canonical identity policy. A supplied-but-non-matching phone or
  // email is positive evidence this is a DIFFERENT person, so we must
  // never fall through to a name match in that case — otherwise two
  // people who share a name but have different phones get merged.
  let customer: Record<string, unknown> | null = null;
  const digits = phone.replace(/\D/g, "").slice(-10);
  // A phone (>=7 digits, same threshold findExistingCustomerMatch uses) or
  // an email counts as a strong identifier. Its presence suppresses the
  // name fallthrough below even if it doesn't match anyone.
  const hasStrongId = digits.length >= 7 || !!email;

  // 1. Phone: exact last-10 match (authoritative). Real customers vary in
  // stored format, so fetch this business's customers and compare digits.
  if (digits.length >= 7) {
    const { data } = await admin
      .from("customers")
      .select("*")
      .eq("business_id", businessId);
    customer =
      (data || []).find(
        (c: Record<string, unknown>) =>
          String(c.phone || "").replace(/\D/g, "").slice(-10) === digits,
      ) || null;
  }
  // 2. Email: exact case-insensitive match (authoritative).
  if (!customer && email) {
    const { data } = await admin
      .from("customers")
      .select("*")
      .eq("business_id", businessId)
      .ilike("email", email)
      .maybeSingle();
    customer = data || null;
  }
  // 3. Name-only match ONLY when no phone/email was supplied at all, AND
  // exactly one candidate exists (never guess between same-name people).
  if (!customer && !hasStrongId && name) {
    const { data } = await admin
      .from("customers")
      .select("*")
      .eq("business_id", businessId)
      .ilike("name", name)
      .limit(2);
    if ((data || []).length === 1) customer = data![0];
  }
  // 4. Otherwise (incl. supplied-but-unmatched phone/email) -> create new.
  if (!customer) {
    const { data: inserted, error: custErr } = await admin
      .from("customers")
      .insert({
        business_id: businessId,
        name,
        phone: phone || null,
        email: email || null,
        customer_type: "one_off",
      })
      .select()
      .single();
    if (custErr || !inserted) {
      return { customer: null, error: custErr?.message || "customer_create_failed" };
    }
    customer = inserted;
  }
  return { customer, error: null };
}
