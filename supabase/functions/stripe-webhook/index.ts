// Stripe webhooks — First Customer payment lifecycle.
// verify_jwt = false; authenticity via Stripe-Signature.
// Events: account.updated, checkout.session.*, charge.refunded
// On paid: booking_requests + CRM + linked jobs. Fail hard so Stripe retries.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyStripeWebhook } from "../_shared/stripe.ts";

type Admin = ReturnType<typeof createClient>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function metaOf(obj: Record<string, unknown>): Record<string, string> {
  const m = (obj.metadata || {}) as Record<string, string>;
  return m && typeof m === "object" ? m : {};
}

async function claimEvent(admin: Admin, eventId: string, type: string): Promise<boolean> {
  if (!eventId) return true;
  const { error } = await admin.from("stripe_webhook_events").insert({
    id: eventId,
    type,
  });
  if (!error) return true;
  // Duplicate primary key → already processed
  if (String(error.code || "") === "23505" || /duplicate/i.test(String(error.message || ""))) {
    return false;
  }
  console.error("stripe_webhook_events insert", error);
  throw new Error("idempotency insert failed");
}

async function upsertCrmFromBooking(
  admin: Admin,
  row: {
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
  },
) {
  const name = String(row.customer_name || "").trim();
  if (!name || !row.business_id) return;
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

  const payload = {
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

  if (existing?.id) {
    const { error } = await admin.from("customers").update(payload).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await admin.from("customers").insert({
      ...payload,
      business_id: row.business_id,
      customer_type: "one_off",
    });
    if (error) throw error;
  }
}

async function markJobsPaidForRequest(
  admin: Admin,
  bookingRequestId: string,
  opts: {
    amountCents: number;
    chargeKind: string;
    paidAt: string;
    paymentIntentId: string | null;
  },
) {
  const amountDollars = opts.amountCents > 0 ? opts.amountCents / 100 : null;
  const isDeposit = opts.chargeKind === "deposit";
  const payNotes = isDeposit
    ? `Stripe deposit paid${amountDollars != null ? ` ($${amountDollars.toFixed(2)})` : ""}; balance due on service`
    : "Paid in full via Stripe";

  const { data: linked, error: linkErr } = await admin
    .from("jobs")
    .select("id")
    .eq("booking_request_id", bookingRequestId);
  if (linkErr) throw linkErr;

  if (linked?.length) {
    const { error } = await admin
      .from("jobs")
      .update({
        paid: true,
        pay_method: "Card (Stripe)",
        pay_notes: payNotes,
        paid_at: opts.paidAt,
        amount: amountDollars,
      })
      .eq("booking_request_id", bookingRequestId);
    if (error) throw error;
    return;
  }

  // Fallback: accepted request may have created a job before booking_request_id existed
  const { data: req } = await admin
    .from("booking_requests")
    .select("business_id,customer_name,service_name,requested_date,status")
    .eq("id", bookingRequestId)
    .maybeSingle();
  if (!req || req.status !== "accepted") return;

  let q = admin
    .from("jobs")
    .select("id")
    .eq("business_id", req.business_id)
    .eq("customer_name", req.customer_name)
    .eq("from_booking", true)
    .order("created_at", { ascending: false })
    .limit(1);
  if (req.service_name) q = q.eq("service_name", req.service_name);
  if (req.requested_date) q = q.eq("scheduled_date", req.requested_date);
  const { data: jobs, error: jErr } = await q;
  if (jErr) throw jErr;
  const jobId = jobs?.[0]?.id;
  if (!jobId) return;
  const { error } = await admin
    .from("jobs")
    .update({
      paid: true,
      pay_method: "Card (Stripe)",
      pay_notes: payNotes,
      paid_at: opts.paidAt,
      amount: amountDollars,
      booking_request_id: bookingRequestId,
    })
    .eq("id", jobId);
  if (error) throw error;
}

async function markBookingPaid(
  admin: Admin,
  opts: {
    bookingId: string | null;
    sessionId: string | null;
    amountTotal: number;
    currency: string;
    paymentIntentId: string | null;
    chargeKind: string;
    marketplaceBookingId: string | null;
  },
) {
  const paidAt = new Date().toISOString();
  const patch = {
    payment_status: "paid",
    amount_paid_cents: opts.amountTotal || null,
    currency: opts.currency || "usd",
    stripe_checkout_session_id: opts.sessionId || null,
    stripe_payment_intent_id: opts.paymentIntentId,
    paid_at: paidAt,
    charge_kind: opts.chargeKind || null,
  };

  let bookingId = opts.bookingId;
  if (bookingId) {
    const { data, error } = await admin
      .from("booking_requests")
      .update(patch)
      .eq("id", bookingId)
      .select(
        "id,business_id,customer_name,customer_phone,customer_email,service_name,vehicle_type,vehicle_year,vehicle_make,vehicle_model,vehicle_color,status",
      )
      .maybeSingle();
    if (error) throw error;
    if (data) {
      await upsertCrmFromBooking(admin, data);
      await markJobsPaidForRequest(admin, data.id, {
        amountCents: opts.amountTotal,
        chargeKind: opts.chargeKind,
        paidAt,
        paymentIntentId: opts.paymentIntentId,
      });
    }
  } else if (opts.sessionId) {
    const { data, error } = await admin
      .from("booking_requests")
      .update(patch)
      .eq("stripe_checkout_session_id", opts.sessionId)
      .select(
        "id,business_id,customer_name,customer_phone,customer_email,service_name,vehicle_type,vehicle_year,vehicle_make,vehicle_model,vehicle_color,status",
      )
      .maybeSingle();
    if (error) throw error;
    if (data) {
      bookingId = data.id;
      await upsertCrmFromBooking(admin, data);
      await markJobsPaidForRequest(admin, data.id, {
        amountCents: opts.amountTotal,
        chargeKind: opts.chargeKind,
        paidAt,
        paymentIntentId: opts.paymentIntentId,
      });
    }
  }

  if (opts.marketplaceBookingId) {
    const { error: mbErr } = await admin.from("marketplace_bookings").update({
      payment_status: "paid",
      amount_paid_cents: opts.amountTotal || 0,
      updated_at: paidAt,
    }).eq("id", opts.marketplaceBookingId);
    if (mbErr) throw mbErr;
  }
}

async function markBookingStatus(
  admin: Admin,
  opts: {
    bookingId: string | null;
    sessionId: string | null;
    paymentIntentId: string | null;
    marketplaceBookingId: string | null;
    status: "failed" | "refunded";
  },
) {
  const patch: Record<string, unknown> = { payment_status: opts.status };
  if (opts.status === "failed") {
    // Keep paid_at null; clear pending checkout semantics
  }
  if (opts.status === "refunded") {
    patch.paid_at = null;
  }

  if (opts.bookingId) {
    const { error } = await admin.from("booking_requests").update(patch).eq("id", opts.bookingId);
    if (error) throw error;
    if (opts.status === "refunded") {
      await admin
        .from("jobs")
        .update({
          paid: false,
          pay_notes: "Refunded via Stripe",
          paid_at: null,
        })
        .eq("booking_request_id", opts.bookingId);
    }
  } else if (opts.sessionId) {
    const { data, error } = await admin
      .from("booking_requests")
      .update(patch)
      .eq("stripe_checkout_session_id", opts.sessionId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (opts.status === "refunded" && data?.id) {
      await admin
        .from("jobs")
        .update({
          paid: false,
          pay_notes: "Refunded via Stripe",
          paid_at: null,
        })
        .eq("booking_request_id", data.id);
    }
  } else if (opts.paymentIntentId) {
    const { data, error } = await admin
      .from("booking_requests")
      .update(patch)
      .eq("stripe_payment_intent_id", opts.paymentIntentId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (opts.status === "refunded" && data?.id) {
      await admin
        .from("jobs")
        .update({
          paid: false,
          pay_notes: "Refunded via Stripe",
          paid_at: null,
        })
        .eq("booking_request_id", data.id);
    }
  }

  if (opts.marketplaceBookingId) {
    const { error } = await admin.from("marketplace_bookings").update({
      payment_status: opts.status,
      updated_at: new Date().toISOString(),
    }).eq("id", opts.marketplaceBookingId);
    if (error) throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "stripe-signature, content-type",
      },
    });
  }
  if (req.method !== "POST") {
    return new Response("POST required", { status: 405 });
  }

  const rawBody = await req.text();
  const secret = (Deno.env.get("STRIPE_WEBHOOK_SECRET") || "").trim();

  let event: { id?: string; type: string; data: { object: Record<string, unknown> } };
  try {
    event = await verifyStripeWebhook(rawBody, req.headers.get("stripe-signature"), secret);
  } catch (e) {
    console.error("stripe webhook signature", e);
    return json({ error: "Invalid signature" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Server misconfigured" }, 500);
  }
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const eventId = String(event.id || "");
    const claimed = await claimEvent(admin, eventId, event.type);
    if (!claimed) {
      return json({ received: true, duplicate: true });
    }

    if (event.type === "account.updated") {
      const acct = event.data.object;
      const stripeAccountId = String(acct.id || "");
      if (stripeAccountId) {
        const { error } = await admin.from("stripe_connect_accounts").update({
          charges_enabled: !!acct.charges_enabled,
          payouts_enabled: !!acct.payouts_enabled,
          details_submitted: !!acct.details_submitted,
          email: (acct.email as string) || null,
          updated_at: new Date().toISOString(),
          last_error: null,
        }).eq("stripe_account_id", stripeAccountId);
        if (error) throw error;
      }
    }

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object;
      const meta = metaOf(session);
      const bookingId = String(
        meta.hubly_booking_request_id || meta.booking_request_id || "",
      ).trim() || null;
      const marketplaceBookingId = String(
        meta.hubly_marketplace_booking_id || meta.marketplace_booking_id || "",
      ).trim() || null;
      const sessionId = String(session.id || "") || null;
      const paymentStatus = String(session.payment_status || "");
      const amountTotal = Number(session.amount_total) || 0;
      const currency = String(session.currency || "usd");
      const pi = typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent as { id?: string } | null)?.id || null;
      const chargeKind = String(meta.hubly_charge_kind || "full").toLowerCase() === "deposit"
        ? "deposit"
        : "full";

      if (paymentStatus === "paid" || paymentStatus === "no_payment_required" ||
        event.type === "checkout.session.async_payment_succeeded") {
        await markBookingPaid(admin, {
          bookingId,
          sessionId,
          amountTotal,
          currency,
          paymentIntentId: pi,
          chargeKind,
          marketplaceBookingId,
        });
      } else if (paymentStatus === "unpaid") {
        await markBookingStatus(admin, {
          bookingId,
          sessionId,
          paymentIntentId: pi,
          marketplaceBookingId,
          status: "failed",
        });
      }
    }

    if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      const session = event.data.object;
      const meta = metaOf(session);
      const bookingId = String(
        meta.hubly_booking_request_id || meta.booking_request_id || "",
      ).trim() || null;
      const marketplaceBookingId = String(
        meta.hubly_marketplace_booking_id || meta.marketplace_booking_id || "",
      ).trim() || null;
      const sessionId = String(session.id || "") || null;
      const pi = typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent as { id?: string } | null)?.id || null;
      await markBookingStatus(admin, {
        bookingId,
        sessionId,
        paymentIntentId: pi,
        marketplaceBookingId,
        status: "failed",
      });
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object;
      const pi = typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : (charge.payment_intent as { id?: string } | null)?.id || null;
      const meta = metaOf(charge);
      const bookingId = String(
        meta.hubly_booking_request_id || meta.booking_request_id || "",
      ).trim() || null;
      const marketplaceBookingId = String(
        meta.hubly_marketplace_booking_id || meta.marketplace_booking_id || "",
      ).trim() || null;
      await markBookingStatus(admin, {
        bookingId,
        sessionId: null,
        paymentIntentId: pi,
        marketplaceBookingId,
        status: "refunded",
      });
    }

    return json({ received: true });
  } catch (e) {
    console.error("stripe-webhook handler", e);
    // Delete claim so Stripe retry can reprocess after transient failures
    try {
      const eventId = String((event && event.id) || "");
      if (eventId) {
        await admin.from("stripe_webhook_events").delete().eq("id", eventId);
      }
    } catch (_) { /* ignore */ }
    return json({ error: "Handler failed" }, 500);
  }
});
