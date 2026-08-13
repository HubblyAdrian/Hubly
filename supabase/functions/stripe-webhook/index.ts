// Stripe webhooks — account.updated + checkout.session.completed.
// verify_jwt = false; authenticity via Stripe-Signature.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyStripeWebhook } from "../_shared/stripe.ts";

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

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = await verifyStripeWebhook(rawBody, req.headers.get("stripe-signature"), secret);
  } catch (e) {
    console.error("stripe webhook signature", e);
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500 });
  }
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    if (event.type === "account.updated") {
      const acct = event.data.object;
      const stripeAccountId = String(acct.id || "");
      if (stripeAccountId) {
        await admin.from("stripe_connect_accounts").update({
          charges_enabled: !!acct.charges_enabled,
          payouts_enabled: !!acct.payouts_enabled,
          details_submitted: !!acct.details_submitted,
          email: (acct.email as string) || null,
          updated_at: new Date().toISOString(),
          last_error: null,
        }).eq("stripe_account_id", stripeAccountId);
      }
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const meta = (session.metadata || {}) as Record<string, string>;
      const bookingId = String(
        meta.hubly_booking_request_id || meta.booking_request_id || "",
      ).trim();
      const sessionId = String(session.id || "");
      const paymentStatus = String(session.payment_status || "");
      const amountTotal = Number(session.amount_total) || 0;
      const currency = String(session.currency || "usd");
      const pi = typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent as { id?: string } | null)?.id || null;

      const marketplaceBookingId = String(
        meta.hubly_marketplace_booking_id || meta.marketplace_booking_id || "",
      ).trim();

      if (bookingId && (paymentStatus === "paid" || paymentStatus === "no_payment_required")) {
        await admin.from("booking_requests").update({
          payment_status: "paid",
          amount_paid_cents: amountTotal || null,
          currency,
          stripe_checkout_session_id: sessionId || null,
          stripe_payment_intent_id: pi,
          paid_at: new Date().toISOString(),
        }).eq("id", bookingId);
      } else if (sessionId) {
        await admin.from("booking_requests").update({
          payment_status: paymentStatus === "unpaid" ? "pending_checkout" : "paid",
          amount_paid_cents: amountTotal || null,
          currency,
          stripe_payment_intent_id: pi,
          paid_at: paymentStatus === "paid" ? new Date().toISOString() : null,
        }).eq("stripe_checkout_session_id", sessionId);
      }

      // Commerce Engine — finalize the paid store order (paid → CRM #185 → inventory).
      const commerceOrderId = String(
        meta.hubly_commerce_order_id || meta.commerce_order_id || "",
      ).trim();
      if (
        commerceOrderId &&
        (paymentStatus === "paid" || paymentStatus === "no_payment_required")
      ) {
        try {
          const { finalizePaidCommerceOrder } = await import("../_shared/commerce_checkout.ts");
          const fin = await finalizePaidCommerceOrder(admin, {
            orderId: commerceOrderId,
            paymentIntentId: pi,
            sessionId: sessionId || null,
            cartId: String(meta.hubly_cart_id || "").trim() || null,
          });
          if (!fin.ok) {
            console.error("stripe-webhook finalize commerce order", fin.error);
            return new Response(JSON.stringify({ error: "commerce order update failed" }), {
              status: 500,
              headers: { "content-type": "application/json" },
            });
          }
        } catch (finErr) {
          console.error("stripe-webhook finalize commerce order", finErr);
          return new Response(JSON.stringify({ error: "commerce order update failed" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      }

      // Phase 4 — mark marketplace Booking Engine payment paid
      if (
        marketplaceBookingId &&
        (paymentStatus === "paid" || paymentStatus === "no_payment_required")
      ) {
        const { error: mbErr } = await admin.from("marketplace_bookings").update({
          payment_status: "paid",
          amount_paid_cents: amountTotal || 0,
          updated_at: new Date().toISOString(),
        }).eq("id", marketplaceBookingId);
        if (mbErr) {
          console.error("stripe-webhook marketplace_bookings", mbErr);
          return new Response(JSON.stringify({ error: "marketplace booking update failed" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      }
    }

    // Commerce — payment_intent.succeeded (backup path when metadata has order id)
    if (event.type === "payment_intent.succeeded") {
      const piObj = event.data.object;
      const meta = (piObj.metadata || {}) as Record<string, string>;
      const commerceOrderId = String(
        meta.hubly_commerce_order_id || meta.commerce_order_id || "",
      ).trim();
      const piId = String(piObj.id || "");
      if (commerceOrderId) {
        // Backup finalize path — idempotent (finalize no-ops if the order is already paid).
        try {
          const { finalizePaidCommerceOrder } = await import("../_shared/commerce_checkout.ts");
          await finalizePaidCommerceOrder(admin, { orderId: commerceOrderId, paymentIntentId: piId });
        } catch (finErr) {
          console.error("stripe-webhook pi finalize commerce order", finErr);
        }
      }
    }

    if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.failed") {
      const piObj = event.data.object;
      const meta = (piObj.metadata || {}) as Record<string, string>;
      const commerceOrderId = String(
        meta.hubly_commerce_order_id || meta.commerce_order_id || "",
      ).trim();
      if (commerceOrderId) {
        await admin.from("commerce_orders").update({
          notes: "payment_failed",
          updated_at: new Date().toISOString(),
        }).eq("id", commerceOrderId).eq("status", "pending");
      }
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object;
      const pi = typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : (charge.payment_intent as { id?: string } | null)?.id || null;
      if (pi) {
        await admin.from("commerce_orders").update({
          status: "refunded",
          fulfillment: "cancelled",
          updated_at: new Date().toISOString(),
        }).eq("stripe_payment_intent_id", pi);
      }
    }

    // Recognized but handled elsewhere / Stage 2 subscribers (email, memberships)
    if (
      event.type === "invoice.paid" ||
      event.type === "customer.subscription.updated"
    ) {
      // Revenue / Memberships engines own these; acknowledge receipt only.
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("stripe-webhook handler", e);
    return new Response(JSON.stringify({ error: "Handler failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
