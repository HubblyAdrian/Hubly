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

  let customer: Record<string, unknown> | null = null;

  // Phone match: real customers vary in stored format, so fetch this
  // business's customers and compare on last-10 digits (mirrors
  // findExistingCustomerMatch()).
  const digits = phone.replace(/\D/g, "").slice(-10);
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
  if (!customer && email) {
    const { data } = await admin
      .from("customers")
      .select("*")
      .eq("business_id", businessId)
      .ilike("email", email)
      .maybeSingle();
    customer = data || null;
  }
  if (!customer && name) {
    const { data } = await admin
      .from("customers")
      .select("*")
      .eq("business_id", businessId)
      .ilike("name", name)
      .maybeSingle();
    customer = data || null;
  }
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
