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
      body: JSON.stringify({ record: row, hubly_notify_reason: reason }),
    });
    if (!res.ok) {
      console.error("[booking_notify] non-2xx", id, res.status, (await res.text()).slice(0, 200));
      return { sent: false, reason: `http_${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error("[booking_notify] failed", id, (e as Error)?.message);
    return { sent: false, reason: "threw" };
  }
}
