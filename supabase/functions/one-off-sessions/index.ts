/**
 * One-Off Sessions API — the single server-side entry point for the feature.
 *
 * Two clearly separated halves, and nothing crosses between them:
 *
 *   PUBLIC (no auth, resolved by the opaque booking_token only)
 *     public_get            — the narrow customer projection for /session/<token>
 *     public_book           — reserve a seat (concurrency-safe, see the engine)
 *     public_checkout       — open Stripe Checkout without leaking the business id
 *     public_booking_status — what the DATABASE says after a Stripe redirect
 *     public_promotions     — promo-safe state for storefront banners referencing a session
 *
 *   OWNER (Supabase JWT; businesses.owner_id must match — the same check
 *   commerce-api does, and the same service-role-after-ownership pattern)
 *     create · get · list · update · publish · close · cancel · availability
 *     bookings · cancel_booking · configure_payment · booking_link
 *     promotion_set · promotion_remove
 *
 * A public caller can never name a session by id, never enumerate sessions, and
 * never receive business internals — §3 and §25 are structural here, not a UI
 * convention. All writes go through _shared/one_off_session_engine.ts; this file
 * is transport, authorization, and shape only.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  bookSessionSlot,
  cancelSession,
  cancelSessionBooking,
  closeSession,
  createSession,
  getSessionAvailability,
  getSessionById,
  getSessionByToken,
  listSessions,
  publicBookingConfirmation,
  publicSessionPayload,
  publishSession,
  releaseAbandonedSessionBooking,
  sessionBookingUrl,
  sessionSummary,
  toCents,
  updateSession,
  type SessionRow,
} from "../_shared/one_off_session_engine.ts";
import { sessionPromotionState, toDateOnly } from "../_shared/one_off_session_core.mjs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

/** Actions that are reachable with no credentials at all. Anything not listed
 *  here requires a verified owner — a deny-by-default list, not an allow-all
 *  with exceptions. */
const PUBLIC_ACTIONS = new Set([
  "public_get",
  "public_book",
  "public_checkout",
  "public_booking_status",
  "public_promotions",
]);

/**
 * Open Stripe Checkout for a session booking WITHOUT the browser ever learning
 * the business id (§25). The public page holds only its opaque token and the
 * booking id it was just issued; this resolves both server-side and calls the
 * existing create-booking-checkout function — the same one every other Hubly
 * booking payment goes through. No second Stripe integration, and no business
 * identifier crosses into the page.
 */
async function openSessionCheckout(opts: {
  businessId: string;
  bookingId: string;
  returnUrl: string;
}): Promise<Record<string, unknown> | null> {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceKey) return null;
  const res = await fetch(`${supabaseUrl}/functions/v1/create-booking-checkout`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({
      business_id: opts.businessId,
      one_off_session_booking_id: opts.bookingId,
      success_url: opts.returnUrl,
      cancel_url: opts.returnUrl,
    }),
  });
  return await res.json().catch(() => null);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!supabaseUrl || !anon || !serviceKey) return json({ error: "Server misconfigured" }, 500);

  const admin = createClient(supabaseUrl, serviceKey);
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "").trim();
  if (!action) return json({ error: "action required" }, 400);

  try {
    /* ───────────────────── public half ───────────────────── */

    if (action === "public_get") {
      const session = await getSessionByToken(admin, String(body?.token || ""));
      // A draft session must not be reachable even by someone holding the link.
      if (!session || String(session.status) === "draft") {
        return json({ ok: false, error: "not_found" }, 404);
      }
      return json({ ok: true, ...(await publicSessionPayload(admin, session)) });
    }

    if (action === "public_book") {
      const session = await getSessionByToken(admin, String(body?.token || ""));
      if (!session || String(session.status) === "draft") {
        return json({ ok: false, error: "not_found" }, 404);
      }
      const result = await bookSessionSlot(admin, session, {
        slot_time: String(body?.slot_time || ""),
        customer: {
          name: String(body?.name || ""),
          email: body?.email ? String(body.email) : null,
          phone: body?.phone ? String(body.phone) : null,
        },
        answers: (body?.answers && typeof body.answers === "object") ? body.answers : {},
      });
      if (!result.ok) return json({ ok: false, error: result.error, code: result.code }, 409);
      // Only the booking id crosses back — the customer needs it to open
      // checkout, and it is useless without the token it was issued against.
      return json({
        ok: true,
        booking_id: String(result.data.booking.id),
        requires_payment: result.data.requires_payment,
        charge_now_cents: result.data.payment.charge_now_cents,
        confirmation: result.data.confirmation,
      });
    }

    if (action === "public_checkout") {
      const session = await getSessionByToken(admin, String(body?.token || ""));
      if (!session) return json({ ok: false, error: "not_found" }, 404);
      const bookingId = String(body?.booking_id || "").trim();
      // The booking must belong to THIS token's session — a booking id from
      // somewhere else can never be paid for through this link.
      const { data: booking } = await admin
        .from("one_off_session_bookings")
        .select("id,session_id,status,payment_status")
        .eq("id", bookingId)
        .eq("session_id", session.id)
        .maybeSingle();
      if (!booking) return json({ ok: false, error: "booking_not_found" }, 404);
      if (booking.payment_status === "paid") return json({ ok: false, error: "already_paid" }, 409);
      const out = await openSessionCheckout({
        businessId: String(session.business_id),
        bookingId,
        returnUrl: String(body?.return_url || ""),
      });
      if (!out?.url) {
        // Checkout could not be opened, so nothing will ever expire this
        // booking — release the seat now rather than leaving it held by a
        // customer who has no way to pay. Only ever touches a still-unpaid
        // booking (releaseAbandonedSessionBooking refuses anything else).
        await releaseAbandonedSessionBooking(admin, bookingId);
        return json({
          ok: false,
          error: String(out?.error || "checkout_unavailable"),
          released: true,
        }, 502);
      }
      return json({ ok: true, url: out.url });
    }

    if (action === "public_booking_status") {
      // The customer's page polls this after returning from Stripe. It reports
      // ONLY what the database says — the success redirect never confirms a
      // booking, the webhook does (§9).
      const session = await getSessionByToken(admin, String(body?.token || ""));
      if (!session) return json({ ok: false, error: "not_found" }, 404);
      const { data: booking } = await admin
        .from("one_off_session_bookings")
        .select("*")
        .eq("id", String(body?.booking_id || ""))
        .eq("session_id", session.id)
        .maybeSingle();
      if (!booking) return json({ ok: false, error: "booking_not_found" }, 404);
      if (String(booking.status) !== "confirmed") {
        return json({ ok: true, status: String(booking.status) });
      }
      const confirmation = await publicBookingConfirmation(admin, session, booking);
      return json({ ok: true, status: "confirmed", confirmation });
    }

    if (action === "public_promotions") {
      // Storefront promo banners hold only a session id. This returns the
      // promo-safe state for those ids so a banner can never show a stale
      // "Book Now" (§12) — and returns nothing at all for a session that
      // isn't promoted, so it can't be used to enumerate a business.
      const businessId = String(body?.business_id || "").trim();
      const ids = Array.isArray(body?.session_ids)
        ? body.session_ids.map((x: unknown) => String(x)).filter(Boolean).slice(0, 20)
        : [];
      if (!businessId || !ids.length) return json({ ok: true, sessions: [] });
      const { data } = await admin
        .from("one_off_sessions")
        .select("id,name,status,session_date,booking_token,website_promotion,business_id")
        .eq("business_id", businessId)
        .in("id", ids);
      const rows = (data || []).filter((s: Record<string, unknown>) => {
        const promo = (s.website_promotion || {}) as Record<string, unknown>;
        // A draft is not public in any form — a banner flagged for a session the
        // owner hasn't published yet must render as a plain strip, never as
        // "Not published yet" leaking the session's internal state to visitors.
        return promo.storefront === true && String(s.status) !== "draft";
      });
      const sessions = [];
      for (const s of rows) {
        const state = sessionPromotionState(s);
        sessions.push({
          id: String(s.id),
          name: String(s.name || ""),
          date: toDateOnly(s.session_date),
          state: state.state,
          cta: state.cta,
          linkable: state.linkable,
          url: state.linkable ? await sessionBookingUrl(admin, s as SessionRow) : null,
        });
      }
      return json({ ok: true, sessions });
    }

    // Defensive: every public action returns above. One that reaches here is a
    // bug in this file, and must never fall through into the owner half.
    if (PUBLIC_ACTIONS.has(action)) return json({ error: "unknown_action" }, 400);

    /* ───────────────────── owner half ───────────────────── */

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const businessId = String(body?.business_id || "").trim();
    if (!businessId) return json({ error: "business_id required" }, 400);
    const { data: biz } = await admin
      .from("businesses")
      .select("id,owner_id")
      .eq("id", businessId)
      .maybeSingle();
    if (!biz || biz.owner_id !== userId) return json({ error: "Forbidden" }, 403);

    const sessionId = String(body?.session_id || "").trim();
    const needsSession = [
      "get", "update", "publish", "close", "cancel", "availability",
      "bookings", "cancel_booking", "configure_payment", "booking_link",
      "promotion_set", "promotion_remove",
    ];
    let session: SessionRow | null = null;
    if (needsSession.includes(action)) {
      if (!sessionId) return json({ error: "session_id required" }, 400);
      session = await getSessionById(admin, businessId, sessionId);
      if (!session) return json({ error: "not_found" }, 404);
    }

    if (action === "create") {
      const result = await createSession(admin, businessId, body?.session || body || {});
      if (!result.ok) return json({ ok: false, error: result.error, code: result.code }, 400);
      return json({ ok: true, session: await sessionSummary(admin, result.data) });
    }

    if (action === "list") {
      const statuses = Array.isArray(body?.statuses)
        ? body.statuses.map((s: unknown) => String(s))
        : undefined;
      const rows = await listSessions(admin, businessId, { statuses });
      const sessions = [];
      for (const row of rows) sessions.push(await sessionSummary(admin, row));
      return json({ ok: true, sessions });
    }

    if (action === "get") {
      return json({ ok: true, session: await sessionSummary(admin, session!) });
    }

    if (action === "update") {
      const result = await updateSession(admin, businessId, sessionId, body?.session || body?.patch || body || {});
      if (!result.ok) return json({ ok: false, error: result.error, code: result.code }, 400);
      // Warnings are facts the owner must hear (repricing isn't retroactive; a
      // moved location doesn't notify anyone) — never swallowed.
      return json({
        ok: true,
        session: await sessionSummary(admin, result.data.session),
        warnings: result.data.warnings,
      });
    }

    if (action === "configure_payment") {
      // Dollars are accepted from the UI/AI and converted here — storage is
      // always integer cents, one conversion point, never two.
      const patch: Record<string, unknown> = {};
      if (body?.payment_mode != null) patch.payment_mode = String(body.payment_mode);
      if (body?.price != null) patch.price_cents = toCents(body.price);
      if (body?.price_cents != null) patch.price_cents = Math.round(Number(body.price_cents));
      if (body?.deposit != null) {
        patch.deposit_type = "flat";
        patch.deposit_cents = toCents(body.deposit);
      }
      if (body?.deposit_cents != null) {
        patch.deposit_type = "flat";
        patch.deposit_cents = Math.round(Number(body.deposit_cents));
      }
      if (body?.deposit_percentage != null) {
        patch.deposit_type = "percentage";
        patch.deposit_percentage = Number(body.deposit_percentage);
      }
      const result = await updateSession(admin, businessId, sessionId, patch);
      if (!result.ok) return json({ ok: false, error: result.error, code: result.code }, 400);
      return json({
        ok: true,
        session: await sessionSummary(admin, result.data.session),
        warnings: result.data.warnings,
      });
    }

    if (action === "publish") {
      const result = await publishSession(admin, businessId, sessionId);
      if (!result.ok) return json({ ok: false, error: result.error, code: result.code }, 400);
      return json({ ok: true, session: await sessionSummary(admin, result.data) });
    }

    if (action === "close") {
      const result = await closeSession(admin, businessId, sessionId);
      if (!result.ok) return json({ ok: false, error: result.error, code: result.code }, 400);
      return json({ ok: true, session: await sessionSummary(admin, result.data) });
    }

    if (action === "cancel") {
      const result = await cancelSession(admin, businessId, sessionId);
      if (!result.ok) return json({ ok: false, error: result.error, code: result.code }, 400);
      return json({
        ok: true,
        session: await sessionSummary(admin, result.data.session),
        cancelled_bookings: result.data.cancelled_bookings,
      });
    }

    if (action === "availability") {
      const availability = await getSessionAvailability(admin, session!);
      return json({ ok: true, availability });
    }

    if (action === "bookings") {
      const { data } = await admin
        .from("one_off_session_bookings")
        .select("*")
        .eq("session_id", sessionId)
        .eq("business_id", businessId)
        .order("slot_time", { ascending: true });
      return json({ ok: true, bookings: data || [] });
    }

    if (action === "cancel_booking") {
      // One customer's booking, not the whole session. The seat returns to the
      // grid and the session leaves sold_out if that seat was why it was full.
      const result = await cancelSessionBooking(admin, businessId, String(body?.booking_id || ""));
      if (!result.ok) return json({ ok: false, error: result.error, code: result.code }, 400);
      return json({
        ok: true,
        booking: result.data.booking,
        // What a human still owes this customer. Hubly issues no refund itself —
        // never let a caller infer that money moved.
        refund_due_cents: result.data.refund_due_cents,
        session: await sessionSummary(admin, (await getSessionById(admin, businessId, sessionId))!),
      });
    }

    if (action === "booking_link") {
      return json({ ok: true, url: await sessionBookingUrl(admin, session!) });
    }

    if (action === "promotion_set" || action === "promotion_remove") {
      const on = action === "promotion_set";
      const promo = on ? { storefront: true, set_at: new Date().toISOString() } : {};
      const { data, error } = await admin
        .from("one_off_sessions")
        .update({ website_promotion: promo })
        .eq("id", sessionId)
        .eq("business_id", businessId)
        .select("*")
        .single();
      if (error) return json({ ok: false, error: error.message }, 400);
      return json({ ok: true, session: await sessionSummary(admin, data as SessionRow) });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("one-off-sessions", e);
    return json({ error: (e as Error)?.message || "request_failed" }, 500);
  }
});
