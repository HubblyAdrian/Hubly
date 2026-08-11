// #187: server-side read of the structured `memberships` table — the
// projection of the browser's [RP] notes-tag maintained by
// upsertCustomer() (hubly.html). This is the only membership read path
// the AI/edge functions use; nothing here parses customers.notes.
import type { AdminClient } from "./marketplace_provider.ts";

export type CustomerMembership = {
  id: string;
  planName: string;
  serviceName: string | null;
  cadence: string | null;
  price: number | null;
  defaultDuration: number | null;
  status: string;
  nextDueDate: string | null;
  includes: string[] | null;
};

function mapRow(row: Record<string, unknown>): CustomerMembership {
  return {
    id: String(row.id),
    planName: String(row.plan_name || "Membership"),
    serviceName: row.service_name != null ? String(row.service_name) : null,
    cadence: row.cadence != null ? String(row.cadence) : null,
    price: row.price != null ? Number(row.price) : null,
    defaultDuration: row.default_duration != null ? Number(row.default_duration) : null,
    status: String(row.status || "active"),
    nextDueDate: row.next_due_date != null ? String(row.next_due_date) : null,
    includes: Array.isArray(row.includes) ? row.includes.map((x) => String(x)) : null,
  };
}

export async function getCustomerMembership(
  admin: AdminClient,
  businessId: string,
  customerId: string,
): Promise<CustomerMembership | null> {
  if (!businessId || !customerId) return null;
  const { data, error } = await admin
    .from("memberships")
    .select("id, plan_name, service_name, cadence, price, default_duration, status, next_due_date, includes")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}
