// Create a Stripe Checkout Session for a booking deposit / full payment.
// Inserts (or updates) booking_requests with service role, then returns { url }.
// Public clients may call this without an owner JWT.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createDestinationCheckout,
  sanitizeAppReturnUrl,
  stripeConfigured,
} from "../_shared/stripe.ts";

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

function dollarsToCents(n: unknown): number {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return 0;
  return Math.round(x * 100);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return jsonRes({ error: "POST required" }, 405);

  try {
    if (!stripeConfigured()) {
      return jsonRes({
        error: "Online payments aren’t available yet.",
        code: "not_configured",
      }, 503);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS");
    if (!supabaseUrl || !serviceKey) {
      return jsonRes({ error: "Server isn’t configured yet." }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const businessId = String(body?.business_id || "").trim();
    if (!businessId) return jsonRes({ error: "business_id required" }, 400);

    const chargeKind = String(body?.charge_kind || "deposit").trim().toLowerCase();
    if (chargeKind !== "deposit" && chargeKind !== "full") {
      return jsonRes({ error: "charge_kind must be deposit or full" }, 400);
    }

    const amountCents = dollarsToCents(body?.amount_dollars) ||
      Math.round(Number(body?.amount_cents) || 0);
    if (!amountCents || amountCents < 50) {
      return jsonRes({ error: "Amount too small for online payment" }, 400);
    }
    if (amountCents > 50000000) {
      return jsonRes({ error: "Amount too large" }, 400);
    }

    const booking = body?.booking && typeof body.booking === "object" ? body.booking : {};
    const bookingRequestId = String(body?.booking_request_id || "").trim() || null;
    const marketplaceBookingId = String(
      body?.marketplace_booking_id ||
        (booking as Record<string, unknown>).marketplace_booking_id ||
        "",
    ).trim() || null;

    const successUrl = sanitizeAppReturnUrl(body?.success_url);
    const cancelUrl = sanitizeAppReturnUrl(body?.cancel_url || body?.success_url);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: biz, error: bizErr } = await admin
      .from("businesses")
      .select("id,name,biz")
      .eq("id", businessId)
      .maybeSingle();
    if (bizErr || !biz) return jsonRes({ error: "Business not found" }, 404);

    const { data: conn } = await admin
      .from("stripe_connect_accounts")
      .select("stripe_account_id,charges_enabled")
      .eq("business_id", businessId)
      .maybeSingle();
    if (!conn?.stripe_account_id || !conn.charges_enabled) {
      return jsonRes({
        error: "This business hasn’t finished connecting Stripe yet.",
        code: "not_ready",
      }, 409);
    }

    const customerName = String(booking.customer_name || body?.customer_name || "").trim();
    const customerPhone = String(booking.customer_phone || body?.customer_phone || "").trim();
    const customerEmail = String(booking.customer_email || body?.customer_email || "").trim() ||
      null;
    const serviceName = String(booking.service_name || body?.service_name || "Booking").trim() ||
      "Booking";

    // Phase 4 — link checkout to marketplace Booking Engine when present
    if (marketplaceBookingId) {
      const { data: mBook, error: mErr } = await admin
        .from("marketplace_bookings")
        .select("id,business_id,payment_status,service_name,customer_name")
        .eq("id", marketplaceBookingId)
        .maybeSingle();
      if (mErr || !mBook || mBook.business_id !== businessId) {
        return jsonRes({ error: "Marketplace booking not found" }, 404);
      }
      if (mBook.payment_status === "paid") {
        return jsonRes({ error: "This booking is already paid", code: "already_paid" }, 409);
      }
      await admin.from("marketplace_bookings").update({
        payment_status: "pending",
        updated_at: new Date().toISOString(),
      }).eq("id", marketplaceBookingId);
    }

    let reqId = bookingRequestId;
    if (reqId) {
      const { data: existing, error: exErr } = await admin
        .from("booking_requests")
        .select("id,business_id,payment_status")
        .eq("id", reqId)
        .maybeSingle();
      if (exErr || !existing || existing.business_id !== businessId) {
        return jsonRes({ error: "Booking not found" }, 404);
      }
      if (existing.payment_status === "paid") {
        return jsonRes({ error: "This booking is already paid", code: "already_paid" }, 409);
      }
    } else {
      const payload = {
        business_id: businessId,
        customer_name: customerName || "Customer",
        customer_phone: customerPhone || "",
        customer_email: customerEmail,
        service_name: serviceName,
        addons: Array.isArray(booking.addons) ? booking.addons : [],
        vehicle_type: booking.vehicle_type ?? null,
        vehicle_year: booking.vehicle_year ?? null,
        vehicle_make: booking.vehicle_make ?? null,
        vehicle_model: booking.vehicle_model ?? null,
        vehicle_color: booking.vehicle_color ?? null,
        condition: booking.condition ?? null,
        requested_date: booking.requested_date ?? null,
        requested_time: booking.requested_time ?? null,
        address: booking.address ?? null,
        notes: booking.notes ??
          (marketplaceBookingId ? `marketplace_booking_id:${marketplaceBookingId}` : null),
        status: "pending",
        payment_status: "pending_checkout",
        amount_due_cents: amountCents,
        currency: "usd",
      };
      const { data: inserted, error: insErr } = await admin
        .from("booking_requests")
        .insert(payload)
        .select("id")
        .single();
      if (insErr || !inserted?.id) {
        console.error("booking insert", insErr);
        return jsonRes({ error: "Could not create booking" }, 500);
      }
      reqId = inserted.id;
      if (marketplaceBookingId) {
        await admin.from("marketplace_bookings").update({
          booking_request_id: reqId,
          updated_at: new Date().toISOString(),
        }).eq("id", marketplaceBookingId);
      }
    }

    const bizLabel = String((biz as { name?: string; biz?: string }).name ||
      (biz as { biz?: string }).biz || "Hubly").trim() || "Hubly";
    const productName = chargeKind === "deposit"
      ? `Deposit — ${serviceName} (${bizLabel})`
      : `${serviceName} (${bizLabel})`;

    const feePct = Number(Deno.env.get("STRIPE_APPLICATION_FEE_PERCENT") || "0");
    const applicationFeeCents = feePct > 0
      ? Math.max(0, Math.round(amountCents * (feePct / 100)))
      : 0;

    const successWithParams = (() => {
      try {
        const u = new URL(successUrl);
        u.searchParams.set("stripe_pay", "success");
        u.searchParams.set("booking_request_id", reqId!);
        if (marketplaceBookingId) {
          u.searchParams.set("marketplace_booking_id", marketplaceBookingId);
        }
        return u.toString();
      } catch {
        return successUrl;
      }
    })();
    const cancelWithParams = (() => {
      try {
        const u = new URL(cancelUrl);
        u.searchParams.set("stripe_pay", "cancel");
        u.searchParams.set("booking_request_id", reqId!);
        if (marketplaceBookingId) {
          u.searchParams.set("marketplace_booking_id", marketplaceBookingId);
        }
        return u.toString();
      } catch {
        return cancelUrl;
      }
    })();

    const session = await createDestinationCheckout({
      connectedAccountId: conn.stripe_account_id,
      amountCents,
      currency: "usd",
      productName,
      successUrl: successWithParams,
      cancelUrl: cancelWithParams,
      customerEmail: customerEmail || undefined,
      applicationFeeCents: applicationFeeCents || undefined,
      metadata: {
        hubly_business_id: businessId,
        hubly_booking_request_id: reqId!,
        hubly_charge_kind: chargeKind,
        ...(marketplaceBookingId
          ? { hubly_marketplace_booking_id: marketplaceBookingId }
          : {}),
      },
    });

    await admin.from("booking_requests").update({
      payment_status: "pending_checkout",
      amount_due_cents: amountCents,
      currency: "usd",
      stripe_checkout_session_id: session.id,
    }).eq("id", reqId);

    if (!session.url) return jsonRes({ error: "No Checkout URL returned" }, 500);

    return jsonRes({
      ok: true,
      url: session.url,
      booking_request_id: reqId,
      marketplace_booking_id: marketplaceBookingId,
      checkout_session_id: session.id,
      amount_cents: amountCents,
      charge_kind: chargeKind,
    });
  } catch (e) {
    console.error("create-booking-checkout", e);
    return jsonRes({ error: (e as Error)?.message || "Could not start checkout" }, 500);
  }
});
