// Shared CRM upsert — service-role only.
// Public booking must NEVER write customers. CRM updates only after:
//   - owner accepts a booking (via hire-crm edge), or
//   - payment succeeds (stripe-webhook).

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

type Admin = {
  from: (table: string) => any;
};

export async function upsertCrmFromBooking(
  admin: Admin,
  row: CrmBookingRow,
): Promise<{ ok: boolean; customer_id?: string; error?: string }> {
  const name = String(row.customer_name || "").trim();
  if (!name || !row.business_id) {
    return { ok: false, error: "name and business_id required" };
  }
  const email = String(row.customer_email || "").trim().toLowerCase() || null;
  const phone = String(row.customer_phone || "").trim() || null;

  let existing: { id: string } | null = null;
  if (email) {
    const { data } = await admin
      .from("customers")
      .select("id")
      .eq("business_id", row.business_id)
      .ilike("email", email)
      .maybeSingle();
    existing = data;
  }
  if (!existing && phone) {
    const { data } = await admin
      .from("customers")
      .select("id")
      .eq("business_id", row.business_id)
      .eq("phone", phone)
      .maybeSingle();
    existing = data;
  }
  if (!existing) {
    const { data } = await admin
      .from("customers")
      .select("id")
      .eq("business_id", row.business_id)
      .ilike("name", name)
      .maybeSingle();
    existing = data;
  }

  const payload: Record<string, unknown> = {
    name,
    phone: phone || "",
    email: email || "",
    preferred_service: String(row.service_name || "").trim() || null,
    vehicle_type: row.vehicle_type || null,
    vehicle_year: row.vehicle_year || null,
    vehicle_make: row.vehicle_make || null,
    vehicle_model: row.vehicle_model || null,
    vehicle_color: row.vehicle_color || null,
    vehicle: row.vehicle || null,
  };
  if (row.notes != null) payload.notes = String(row.notes);
  if (row.customer_type) payload.customer_type = row.customer_type;

  if (existing?.id) {
    const { error } = await admin.from("customers").update(payload).eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, customer_id: existing.id };
  }

  const { data: inserted, error } = await admin
    .from("customers")
    .insert({
      ...payload,
      business_id: row.business_id,
      customer_type: row.customer_type || "one_off",
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, customer_id: inserted?.id };
}
