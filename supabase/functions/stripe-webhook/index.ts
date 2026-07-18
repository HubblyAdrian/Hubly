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
