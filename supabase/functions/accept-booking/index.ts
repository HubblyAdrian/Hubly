// ══ THE OWNER ACCEPTS A BOOKING — FROM WHICHEVER SHELL HE IS IN ═════════════════════════════
//
// ADRIAN, 2026-09-17: "YES, ACCEPTING BELONGS IN platform-home. He can SEE it, so he can ACT on
// it — the same ruling as everything else. SHARE acceptBookingRequest, DO NOT BUILD A SECOND ONE.
// Fifth instance of the two-shells hazard."
//
// ── AND THE SHARED WRITER ALREADY EXISTED ───────────────────────────────────────────────────
//
// `_shared/booking_job.ts` opens with: *"The one place a booking_request becomes a job. Three
// callers need this and, until now, only one existed: the owner clicking Accept, entirely
// client-side (acceptBookingRequest → createJob in hubly.html)."* Its `JobCreateReason` type has
// carried **"accept"** since the day it was written, and nothing has ever passed it — only the
// Stripe webhook calls in, with "payment".
//
// So this is not a new accept. It is the door onto the accept that was built for this and never
// opened: one function, idempotent on `jobs.booking_request_id`, with the unique index behind it,
// so payment and the owner cannot put the same visit on the calendar twice.
//
// ── WHAT IT WILL NOT DO ─────────────────────────────────────────────────────────────────────
//
// It never marks the booking accepted unless the JOB ACTUALLY EXISTS. A status flipped beside a
// job that was not created is the unearned checkmark on the one record a customer is waiting on
// (prohibition 3: assert the postcondition or fail). And it reports which of the outcomes
// happened — created, already there, not yours, gone — so the caller composes its sentence from
// what occurred rather than from what it hoped (the servicesTruth pattern).
//
// ── STILL OPEN, RECORDED RATHER THAN IMPLIED ────────────────────────────────────────────────
//
// public/hubly.html's `acceptBookingRequest` (its own ~250 lines around :45543) STILL has its own
// implementation: membership signups, the pipeline board, the leads board, toasts, S.jobs. It is
// the second copy and it is not fixed by this commit. Moving it onto this endpoint is the next
// step and is written down in docs/OPEN_FINDINGS.md rather than assumed.

import {
  createAdminClient,
  createUserClient,
} from "../_shared/supabase_admin.ts";
import { createJobFromBookingRequest } from "../_shared/booking_job.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return jsonRes({ ok: false, error: "POST required" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return jsonRes({ ok: false, error: "signed_out" }, 401);
    }
    const body = await req.json().catch(() => ({}));
    const reqId = String((body as Record<string, unknown>)?.booking_request_id || "").trim();
    if (!reqId) return jsonRes({ ok: false, error: "booking_request_id_required" }, 400);

    const userClient = createUserClient(authHeader);
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return jsonRes({ ok: false, error: "session_expired" }, 401);
    const uid = userData.user.id;

    const admin = createAdminClient();
    const { data: br, error: brErr } = await admin
      .from("booking_requests")
      .select("id,business_id,status,customer_name,service_name,requested_date,requested_time,is_membership_signup")
      .eq("id", reqId)
      .maybeSingle();
    if (brErr) return jsonRes({ ok: false, error: "read_failed" }, 500);
    // GONE IS ITS OWN ANSWER, not "not yours". The two are different things to be told, and a
    // booking really can be deleted out from under a card that is still on screen.
    if (!br) return jsonRes({ ok: false, error: "booking_gone" }, 404);

    // AUTHORISE BY OWNERSHIP, RE-READ HERE. Naming a booking id proves nothing; the uid comes
    // from the JWT and the owner comes from the row, and both have to agree.
    const { data: biz, error: bizErr } = await admin
      .from("businesses").select("id,owner_id").eq("id", br.business_id).maybeSingle();
    if (bizErr || !biz || !biz.owner_id || biz.owner_id !== uid) {
      return jsonRes({ ok: false, error: "not_owner" }, 403);
    }

    // ══ A MEMBERSHIP SIGNUP IS REFUSED HERE, AND SAYS WHY ═══════════════════════════════════
    //
    // A membership booking is not only a job: hubly.html's accept also writes the RECURRING PLAN
    // onto the customer (`upsertCustomer` with `recurringPlan`). The shared writer does not know
    // about plans, so accepting one here would create the visit and silently drop the repeat —
    // the owner would have a job and no membership, and the money that makes it a membership
    // would be gone with no error anywhere.
    //
    // Half-doing it is the worse option, so it is refused and named. The caller says a true
    // sentence about what did not happen. This is the first thing to close when the classic
    // accept moves onto this endpoint (docs/OPEN_FINDINGS.md).
    if ((br as Record<string, unknown>).is_membership_signup === true) {
      return jsonRes({ ok: false, error: "membership_signup_not_supported_here" }, 409);
    }

    // THE SHARED WRITER. Idempotent on jobs.booking_request_id, so an accept that races the
    // payment webhook returns the job that already exists instead of making a second one.
    const jobRes = await createJobFromBookingRequest(admin, {
      bookingRequestId: reqId,
      reason: "accept",
    });
    if (!jobRes.ok) return jsonRes({ ok: false, error: jobRes.error }, 500);

    // ONLY NOW. The status is a claim that this is on his calendar; it is written after the job
    // exists, never beside a write that may not have landed.
    const wasAccepted = String(br.status || "") === "accepted";
    if (!wasAccepted) {
      const { error: upErr } = await admin
        .from("booking_requests").update({ status: "accepted" }).eq("id", reqId);
      // The job IS created. Saying "accepted" when the row still reads pending would be a lie in
      // the other direction, so the caller is told exactly this shape.
      if (upErr) {
        return jsonRes({
          ok: true, job_id: jobRes.jobId, created: jobRes.created, status_written: false,
          customer_name: br.customer_name, service_name: br.service_name,
          date: br.requested_date, time: br.requested_time,
        });
      }
    }
    return jsonRes({
      ok: true, job_id: jobRes.jobId, created: jobRes.created, status_written: true,
      already_accepted: wasAccepted,
      customer_name: br.customer_name, service_name: br.service_name,
      date: br.requested_date, time: br.requested_time,
    });
  } catch (e) {
    return jsonRes({ ok: false, error: String((e as Error)?.message || e).slice(0, 200) }, 500);
  }
});
