/**
 * The one place a booking_request becomes a job.
 *
 * Three callers need this and, until now, only one existed: the owner clicking
 * Accept, entirely client-side (acceptBookingRequest → createJob in hubly.html).
 * Payment is about to become a second creator (the Stripe webhook) and a
 * reconcile sweep a third. Three independent implementations of "turn this
 * booking into work on the calendar" would drift the moment one is edited, and
 * two of them running for the same booking would put the same session on the
 * business's calendar twice.
 *
 * So: one function, idempotent on jobs.booking_request_id, called by all three.
 *
 * IDEMPOTENCY IS ENFORCED IN TWO PLACES, on purpose:
 *   1. a SELECT before the insert — the common path, and the one that returns a
 *      useful jobId to a caller that lost the race;
 *   2. the partial unique index jobs_booking_request_id_unique — the actual
 *      guarantee, because the SELECT and the INSERT are not atomic and the
 *      webhook and the reconcile sweep genuinely can arrive together.
 * A 23505 on that index is therefore an EXPECTED outcome, not an error, and is
 * handled by re-reading the winner's row.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveOrCreateCrmCustomer } from "./crm_customer.ts";
import { syncEnginePushCreate } from "./google_calendar_sync_engine.ts";
import { getCatalog } from "./service_engine.ts";

/** Why the job is being created. Recorded for support, never used for logic. */
export type JobCreateReason = "payment" | "reconcile" | "accept";

export type CreateJobResult =
  | { ok: true; jobId: string; created: boolean; customerId: string | null }
  | { ok: false; error: string };

type BookingRequestRow = {
  id: string;
  business_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  service_name: string | null;
  requested_date: string | null;
  requested_time: string | null;
  address: string | null;
  notes: string | null;
  status: string | null;
  deposit_cents: number | null;
  amount_paid_cents: number | null;
  vehicle_type: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
};

const BR_COLUMNS =
  "id,business_id,customer_name,customer_phone,customer_email,service_name," +
  "requested_date,requested_time,address,notes,status,deposit_cents," +
  "amount_paid_cents,vehicle_type,vehicle_year,vehicle_make,vehicle_model,vehicle_color";

/**
 * Resolve a service id from the stored catalog by exact name.
 *
 * booking_requests only ever stored the service NAME, never its id. An exact
 * match against the business's own catalog is a real reference rather than a
 * guess; anything short of exact resolves to null and the job keeps the freeform
 * name. Never invent a service_id — a wrong one mislabels revenue.
 */
function resolveServiceIdByName(
  business: Record<string, unknown>,
  serviceName: string | null,
): string | null {
  const wanted = String(serviceName || "").trim().toLowerCase();
  if (!wanted) return null;
  try {
    const catalog = getCatalog(business);
    const hit = (catalog.services || []).find(
      (s) => String(s?.name || "").trim().toLowerCase() === wanted,
    );
    return hit?.id ? String(hit.id) : null;
  } catch {
    return null;
  }
}

/** Vehicle label, matching the client's formatVehicleLabel shape closely enough. */
function vehicleLabel(br: BookingRequestRow): string | null {
  const bits = [br.vehicle_year, br.vehicle_make, br.vehicle_model]
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  if (!bits.length) return String(br.vehicle_type || "").trim() || null;
  return bits.join(" ");
}

/**
 * Create the job for a booking request, or return the one that already exists.
 *
 * Does NOT decide whether the booking deserves a job — that judgement (paid?
 * owed nothing? owner accepted?) belongs to the caller, because it differs per
 * caller. This function's contract is narrower and therefore safe to share:
 * given a booking request, ensure exactly one job exists for it.
 */
export async function createJobFromBookingRequest(
  admin: SupabaseClient,
  opts: { bookingRequestId: string; reason: JobCreateReason; amountDollars?: number | null },
): Promise<CreateJobResult> {
  const reqId = String(opts.bookingRequestId || "").trim();
  if (!reqId) return { ok: false, error: "booking_request_id_required" };

  const { data: brRow, error: brErr } = await admin
    .from("booking_requests")
    .select(BR_COLUMNS)
    .eq("id", reqId)
    .maybeSingle();
  if (brErr) return { ok: false, error: `booking_request_read_failed: ${brErr.message}` };
  if (!brRow) return { ok: false, error: "booking_request_not_found" };
  // Via `unknown`: the select uses a runtime column string, so supabase-js types
  // the result loosely and a direct cast is rejected.
  const br = brRow as unknown as BookingRequestRow;

  // ── 1. Already done? ──────────────────────────────────────────────────────
  const existing = await admin
    .from("jobs")
    .select("id,customer_id")
    .eq("booking_request_id", reqId)
    .maybeSingle();
  if (existing.data?.id) {
    return {
      ok: true,
      jobId: String(existing.data.id),
      created: false,
      customerId: existing.data.customer_id ? String(existing.data.customer_id) : null,
    };
  }

  // ── 2. Customer ───────────────────────────────────────────────────────────
  // The job needs an owner. resolveOrCreateCrmCustomer carries the #185
  // identity policy (never name-merge two different people), so it is reused
  // rather than re-implemented here.
  const { customer, error: custErr } = await resolveOrCreateCrmCustomer(
    admin,
    br.business_id,
    {
      name: br.customer_name || br.customer_phone || "Customer",
      phone: br.customer_phone || "",
      email: br.customer_email || "",
    },
  );
  if (custErr && !customer) {
    // A missing customer must not cost the business the job. Proceed without
    // the link rather than dropping paid work on the floor — the name, phone
    // and email still land on the job row itself.
    console.warn("[booking_job] customer resolve failed", reqId, custErr);
  }

  // ── 3. Service ────────────────────────────────────────────────────────────
  const { data: bizRow } = await admin
    .from("businesses")
    .select("id,business_type,meta")
    .eq("id", br.business_id)
    .maybeSingle();
  const serviceId = bizRow
    ? resolveServiceIdByName(bizRow as Record<string, unknown>, br.service_name)
    : null;

  // ── 4. Insert ─────────────────────────────────────────────────────────────
  // Column-for-column the same shape the owner-side createJob() writes, so a
  // job created by payment is indistinguishable from one created by Accept.
  const payload: Record<string, unknown> = {
    business_id: br.business_id,
    booking_request_id: reqId,
    customer_id: customer?.id ?? null,
    customer_name: (customer?.name as string) || br.customer_name || "",
    service_name: br.service_name || null,
    service_id: serviceId,
    scheduled_date: br.requested_date || null,
    scheduled_time: br.requested_time || null,
    address: br.address || null,
    amount: opts.amountDollars != null && Number.isFinite(opts.amountDollars)
      ? opts.amountDollars
      : null,
    notes: br.notes || null,
    status: "scheduled",
    from_booking: true,
    phone: (customer?.phone as string) || br.customer_phone || null,
    email: (customer?.email as string) || br.customer_email || null,
    vehicle: vehicleLabel(br),
    vehicle_color: br.vehicle_color || null,
    deposit_cents: br.deposit_cents ?? null,
  };

  const ins = await admin.from("jobs").insert(payload).select("id,customer_id").single();

  let jobId: string;
  let created = true;
  if (ins.error) {
    // 23505 = unique_violation. Another caller won the race between our SELECT
    // and this INSERT — which is the index doing exactly its job. Read theirs.
    const isDuplicate = String((ins.error as { code?: string }).code || "") === "23505";
    if (!isDuplicate) return { ok: false, error: `job_insert_failed: ${ins.error.message}` };
    const winner = await admin
      .from("jobs")
      .select("id,customer_id")
      .eq("booking_request_id", reqId)
      .maybeSingle();
    if (!winner.data?.id) return { ok: false, error: "job_insert_conflict_unresolved" };
    jobId = String(winner.data.id);
    created = false;
  } else {
    jobId = String(ins.data.id);
  }

  // ── 5. Calendar ───────────────────────────────────────────────────────────
  // Only for a job we actually created — pushing again for a job someone else
  // just made would duplicate the Google event. Best-effort: a Calendar
  // problem never unmakes work that is already on the business's books.
  if (created) {
    try {
      await syncEnginePushCreate(admin, { businessId: br.business_id, jobId });
    } catch (e) {
      console.warn("[booking_job] calendar push failed", jobId, (e as Error)?.message);
    }
  }

  // ── 6. Mark the request accepted ──────────────────────────────────────────
  // Only from a state that is not already terminal, so a reconcile sweep can
  // never drag a cancelled or completed booking back to accepted.
  if (br.status === "pending" || br.status === "abandoned") {
    const { error: updErr } = await admin
      .from("booking_requests")
      .update({ status: "accepted" })
      .eq("id", reqId)
      .in("status", ["pending", "abandoned"]);
    if (updErr) console.warn("[booking_job] status update failed", reqId, updErr.message);
  }

  console.info(
    "[booking_job]",
    JSON.stringify({ reason: opts.reason, booking_request_id: reqId, job_id: jobId, created }),
  );
  return {
    ok: true,
    jobId,
    created,
    customerId: customer?.id ? String(customer.id) : null,
  };
}
