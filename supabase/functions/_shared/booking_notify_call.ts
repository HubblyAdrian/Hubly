// ============================================================================
// CHANGED BUT NEVER EXECUTED — API key migration, 2026-08-19
//
// WHAT CHANGED
//   Supabase key resolution was moved to _shared/supabase_admin.ts
//   (createAdminClient / createUserClient / requireSecretKey / adminHeaders).
//   That helper THROWS on a missing key instead of continuing with "", reads
//   the plural SUPABASE_PUBLISHABLE_KEYS the platform actually injects, and
//   never sends a non-JWT sb_secret_ key as a Bearer token.
//
// THIS FILE WAS NOT RUN.
//   Not directly invocable. Its one caller fires on a real booking being confirmed, which this session never produced.
//
// TO PROVE IT
//   Complete a real booking end to end and confirm the owner notification is sent.
//
// A file that looks migrated and was never verified is worse than one that
// obviously still reads legacy vars: the second is greppable, the first looks
// done. Delete this banner only when the check above has actually been run.
// ============================================================================

/**
 * Send the owner (and customer) booking notification, from the code that knows
 * a booking actually became real.
 *
 * This replaces a database trigger. `booking_request_notify` fired
 * AFTER INSERT on booking_requests with no status filter — and the row is
 * inserted at step 3 as an 'abandoned' lead, so the owner was emailed "New
 * booking request" for every customer who merely reached the contact form, three
 * minutes before any payment, and again for every one of them who never booked.
 *
 * Two problems with a trigger, beyond the timing:
 *
 *   1. It is invisible. No codebase search can find a caller that lives in
 *      pg_trigger, which is how five deployed Edge Functions went unnoticed for
 *      months and how a live endpoint was deleted as dead.
 *   2. INSERT is the wrong event. A booking becomes real when it is paid, or
 *      when it is created as a pay-in-person booking — neither of which is
 *      "a row appeared".
 *
 * Called from the two places that know: createJobFromBookingRequest (payment
 * landed) and the client's submitBooking (pay-in-person completed).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
// Key resolution goes through supabase_admin.ts: THROWS on a missing key rather
// than continuing with "", and never sends a non-JWT sb_secret_ key as a Bearer
// token (PostgREST rejects those as "Invalid JWT").
import { adminHeaders } from "./supabase_admin.ts";

/**
 * Fire the notification for a booking_requests row. Best-effort by design.
 *
 * NEVER throws and never blocks the caller: an email problem must not unmake a
 * booking that is already paid for and already on the calendar. Failures are
 * logged loudly instead, because the alternative — a caller that rolls back
 * because Resend was slow — is far worse than a missing email.
 */
export async function notifyBookingReal(
  admin: SupabaseClient,
  bookingRequestId: string,
  reason: "paid" | "created",
): Promise<{ sent: boolean; reason?: string }> {
  const id = String(bookingRequestId || "").trim();
  if (!id) return { sent: false, reason: "no_id" };

  try {
    const { data: row, error } = await admin
      .from("booking_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !row) return { sent: false, reason: "row_not_found" };

    // PENDING BEFORE THE CALL — same shape as the completion trigger, so this path
    // is observable too. booking-notify flips it to sent/failed by id; a row stuck
    // at 'pending' means the call never landed (e.g. a 403 at the secret gate,
    // which is exactly the failure that was invisible here).
    let deliveryId: string | null = null;
    try {
      const { data: del } = await admin
        .from("notification_deliveries")
        .insert({
          business_id: (row as Record<string, unknown>).business_id ?? null,
          subject_type: "booking",
          subject_id: (row as Record<string, unknown>).id ?? null,
          recipient_role: "owner",
          channel: "email",
          provider: "resend",
          status: "pending",
        })
        .select("id")
        .maybeSingle();
      deliveryId = (del as { id?: string } | null)?.id ?? null;
    } catch (_e) { /* best-effort; absence just means no pending row to flip */ }

    // booking-notify still expects the trigger's payload shape ({ record }), so
    // the same function serves both callers while the trigger is being retired.
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/booking-notify`;
    // adminHeaders() throws rather than resolving to "" -- an empty key here
    // produced a 401 that this call site logged and moved past.
    const notifyHeaders = adminHeaders();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...notifyHeaders,
        "content-type": "application/json",
              },
      body: JSON.stringify({ record: row, hubly_notify_reason: reason, delivery_id: deliveryId }),
    });
    if (!res.ok) {
      const bodyText = (await res.text()).slice(0, 200);
      console.error("[booking_notify] non-2xx", id, res.status, bodyText);
      // This path CAN observe the failure, so don't leave the row 'pending' — mark
      // it failed. (A stuck 'pending' is reserved for calls that truly never landed,
      // e.g. the fire-and-forget trigger.)
      if (deliveryId) {
        try {
          await admin.from("notification_deliveries")
            .update({ status: "failed", error: `caller saw http_${res.status}`, attempted_at: new Date().toISOString() })
            .eq("id", deliveryId);
        } catch (_e) { /* keep going */ }
      }
      return { sent: false, reason: `http_${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error("[booking_notify] failed", id, (e as Error)?.message);
    return { sent: false, reason: "threw" };
  }
}
