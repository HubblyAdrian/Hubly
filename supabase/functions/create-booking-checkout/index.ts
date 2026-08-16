// Create a Stripe Checkout Session for a booking deposit / full payment.
// Inserts (or updates) booking_requests with service role, then returns { url }.
// Public clients may call this without an owner JWT.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { priceBooking, applyPercentDiscountCents } from "../_shared/booking_price.ts";
import { buildPaymentSummary } from "../_shared/booking_engine.ts";
import { getService } from "../_shared/service_engine.ts";
import { getBusinessMeta } from "../_shared/hubly_business_meta.ts";
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

    const booking = body?.booking && typeof body.booking === "object" ? body.booking : {};
    const bookingRequestId = String(body?.booking_request_id || "").trim() || null;
    const marketplaceBookingId = String(
      body?.marketplace_booking_id ||
        (booking as Record<string, unknown>).marketplace_booking_id ||
        "",
    ).trim() || null;

    let chargeKind = String(body?.charge_kind || "deposit").trim().toLowerCase();
    if (chargeKind !== "deposit" && chargeKind !== "full") {
      return jsonRes({ error: "charge_kind must be deposit or full" }, 400);
    }

    // ── PRICE CHANNEL ───────────────────────────────────────────────────────
    // The server prices the booking. The client sends ids and answers; it does
    // not send money. Until this block existed, `amount_dollars` from the
    // request body WAS the charge, so any booking could be completed for $1
    // from dev tools — with or without a discount code.
    //
    // ACCEPT-AND-IGNORE WINDOW: this deploy still reads the client figure, but
    // only to log it against the computed one. A browser cached from before
    // this ships still sends it, and hard-rejecting would fail live checkouts
    // mid-flow. The field is removed the deploy after — see the console.warn
    // below for how to tell a stale client from an exploit.
    const clientAmountCents = dollarsToCents(body?.amount_dollars) ||
      Math.round(Number(body?.amount_cents) || 0);
    let amountCents = 0;

    const successUrl = sanitizeAppReturnUrl(body?.success_url);
    const cancelUrl = sanitizeAppReturnUrl(body?.cancel_url || body?.success_url);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: biz, error: bizErr } = await admin
      .from("businesses")
      .select("id,name")
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

    let customerName = String(booking.customer_name || body?.customer_name || "").trim();
    let customerPhone = String(booking.customer_phone || body?.customer_phone || "").trim();
    let customerEmail = String(booking.customer_email || body?.customer_email || "").trim() ||
      null;
    let serviceName = String(booking.service_name || body?.service_name || "Booking").trim() ||
      "Booking";

    // ── Website booking: price it here, from stored config ──────────────────
    // The marketplace path below already derives its own amount from
    // marketplace_bookings (written server-side by createBooking), so it is
    // untouched. This branch is the one that used to trust the browser.
    if (!marketplaceBookingId) {
      const { data: bizRow } = await admin
        .from("businesses")
        .select("id,business_type,meta,brand_color,name")
        .eq("id", businessId)
        .maybeSingle();
      if (!bizRow) return jsonRes({ error: "Business not found" }, 404);
      const bizMeta = getBusinessMeta(bizRow);

      const priced = priceBooking(bizRow as Record<string, unknown>, bizMeta, {
        service_id: String(body?.service_id || (booking as Record<string, unknown>).service_id || ""),
        addon_ids: Array.isArray(body?.addon_ids) ? body.addon_ids.map(String) : [],
        addon_names: Array.isArray(body?.addon_names) ? body.addon_names.map(String) : [],
        answers: (body?.answers && typeof body.answers === "object") ? body.answers : {},
        vehicle_tier: body?.vehicle_tier ? String(body.vehicle_tier) : null,
      });
      if (!priced.ok) {
        // A page loaded BEFORE this deploy still posts amount_dollars and no
        // service_id. It must not be charged the browser's figure (that is the
        // hole this closes), but a customer standing at the payment step needs
        // a next step rather than a dead error — so say what happened and that
        // their details survive a refresh.
        const stale = priced.error === "service_id required";
        return jsonRes({
          error: stale
            ? "This page is out of date. Refresh and your details will still be here."
            : "Could not price this booking",
          code: stale ? "stale_client" : priced.error,
        }, 400);
      }

      // Discounts are still resolved client-side today (Phases 2-5). The
      // percentage is accepted, the ARITHMETIC is not: it is applied here, in
      // cents, rounded exactly as the client rounds it so Review and receipt
      // agree to the penny. Server-side code lookup lands with the discount work.
      const discPct = Number(body?.discount_percent) || 0;
      const totalCents = applyPercentDiscountCents(priced.subtotal_cents, discPct);

      // The package's own payment override, if it set one. toBookingDto does not
      // carry `payment`, so read the full service record for it — this is what
      // makes per-package terms (e494e91) apply to a real website booking.
      const fullSvc = getService(bizRow as Record<string, unknown>, priced.service_id);
      const summary = buildPaymentSummary(bizRow as Record<string, unknown>, totalCents, {
        service: fullSvc ? { payment: fullSvc.payment ?? null } : null,
      });
      amountCents = chargeKind === "full" ? totalCents : summary.charge_now_cents;

      // Nothing owed, or below Stripe's minimum: do not open a checkout and do
      // not round up. The caller completes the booking as pay-in-person.
      if (!summary.requires_checkout || amountCents < 50) {
        return jsonRes({
          ok: true,
          no_payment_required: true,
          reason: amountCents <= 0 ? "zero_total" : "below_minimum",
          computed_cents: amountCents,
          service_name: priced.service_name,
        });
      }
      serviceName = priced.service_name || serviceName;

      // One-deploy accept-and-ignore window. Logged with enough to tell a stale
      // client (small, explainable drift — a rounding penny, an old price) from
      // an exploit (a figure far below the computed one, often a round number).
      if (clientAmountCents > 0 && clientAmountCents !== amountCents) {
        console.warn("[price-channel] client/server amount mismatch", JSON.stringify({
          at: new Date().toISOString(),
          business_id: businessId,
          service_id: priced.service_id,
          service_name: priced.service_name,
          charge_kind: chargeKind,
          client_cents: clientAmountCents,
          server_cents: amountCents,
          delta_cents: clientAmountCents - amountCents,
          ratio: amountCents > 0 ? Number((clientAmountCents / amountCents).toFixed(4)) : null,
          subtotal_cents: priced.subtotal_cents,
          discount_percent: discPct,
          line_items: priced.line_items,
        }));
      }
    }

    // Phase 4/5 — derive checkout from marketplace Booking Engine when present
    if (marketplaceBookingId) {
      const { data: mBook, error: mErr } = await admin
        .from("marketplace_bookings")
        .select(
          "id,business_id,payment_status,payment_rule,price_cents,deposit_cents,service_name,customer_name,customer_email,customer_phone,status",
        )
        .eq("id", marketplaceBookingId)
        .maybeSingle();
      if (mErr || !mBook || mBook.business_id !== businessId) {
        return jsonRes({ error: "Marketplace booking not found" }, 404);
      }
      if (mBook.payment_status === "paid") {
        return jsonRes({ error: "This booking is already paid", code: "already_paid" }, 409);
      }
      if (String(mBook.status) === "cancelled") {
        return jsonRes({ error: "This booking was cancelled", code: "cancelled" }, 409);
      }

      const rule = String(mBook.payment_rule || "").toLowerCase();
      chargeKind = rule === "pay_in_full" || rule === "full" ? "full" : "deposit";
      const price = Math.round(Number(mBook.price_cents) || 0);
      const deposit = Math.round(Number(mBook.deposit_cents) || 0);
      amountCents = chargeKind === "full"
        ? price
        : (deposit > 0 ? deposit : Math.max(50, Math.round(price * 0.25)));
      if (!amountCents || amountCents < 50) {
        return jsonRes({ error: "Booking has no payable amount", code: "no_amount" }, 400);
      }

      customerName = customerName || String(mBook.customer_name || "").trim();
      customerEmail = customerEmail || String(mBook.customer_email || "").trim() || null;
      customerPhone = customerPhone || String(mBook.customer_phone || "").trim();
      serviceName = String(mBook.service_name || serviceName).trim() || "Booking";

      await admin.from("marketplace_bookings").update({
        payment_status: "pending",
        updated_at: new Date().toISOString(),
      }).eq("id", marketplaceBookingId);
    }

    if (!amountCents || amountCents < 50) {
      return jsonRes({ error: "Amount too small for online payment" }, 400);
    }
    if (amountCents > 50000000) {
      return jsonRes({ error: "Amount too large" }, 400);
    }

    let reqId = bookingRequestId;
    // Set only when adopting a lead row that is still 'abandoned' — see below.
    let promoteFromAbandoned = false;
    if (reqId) {
      const { data: existing, error: exErr } = await admin
        .from("booking_requests")
        .select("id,business_id,payment_status,status")
        .eq("id", reqId)
        .maybeSingle();
      if (exErr || !existing || existing.business_id !== businessId) {
        return jsonRes({ error: "Booking not found" }, 404);
      }
      if (existing.payment_status === "paid") {
        return jsonRes({ error: "This booking is already paid", code: "already_paid" }, 409);
      }
      // The website flow now hands us the lead row written at step 3 so the lead
      // BECOMES the booking instead of a second row being inserted beside it.
      // That row is still 'abandoned', and neither the update below nor the
      // webhook touches `status` — so without this it would end up paid but
      // never a real booking.
      //
      // Promote ONLY from 'abandoned'. A row that is already pending/accepted
      // must not be dragged backwards by a retry of checkout.
      promoteFromAbandoned = String(existing.status || "") === "abandoned";
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
        deposit_cents: chargeKind === "deposit" ? amountCents : null,
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

    const bizLabel = String((biz as { name?: string }).name || "Hubly").trim() || "Hubly";
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
      // Same state the freshly-inserted path above starts in: a real pending
      // booking awaiting payment. Only ever applied to an 'abandoned' row.
      ...(promoteFromAbandoned ? { status: "pending" } : {}),
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
