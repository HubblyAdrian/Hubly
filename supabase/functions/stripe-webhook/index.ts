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
//   400 "Invalid signature" — the signature check runs BEFORE any Supabase client is built, so the probe never reached key resolution.
//
// TO PROVE IT
//   Replay a real Stripe event with a valid STRIPE_WEBHOOK_SECRET signature (Stripe CLI `stripe trigger`), and confirm the event is recorded rather than 500ing.
//
// A file that looks migrated and was never verified is worse than one that
// obviously still reads legacy vars: the second is greppable, the first looks
// done. Delete this banner only when the check above has actually been run.
// ============================================================================

// Stripe webhooks — account.updated + checkout.session.completed.
// verify_jwt = false; authenticity via Stripe-Signature.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyStripeWebhook } from "../_shared/stripe.ts";
// Supabase key resolution goes through _shared/supabase_admin.ts. It THROWS on a
// missing key instead of continuing with "" (nine call sites used to 401 quietly
// and be logged), reads the plural SUPABASE_PUBLISHABLE_KEYS the platform
// actually injects rather than the singular name that is set nowhere, and never
// sends a non-JWT sb_secret_ key as a Bearer token -- PostgREST rejects those as
// "Invalid JWT", which looks exactly like the empty-key 401 in a log.
import { createAdminClient } from "../_shared/supabase_admin.ts";

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
  if (!supabaseUrl) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500 });
  }
  const admin = createAdminClient();

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

        // A paid booking is committed work, so it becomes a job here rather than
        // waiting for the owner to click Accept on something the customer has
        // already paid for. Until now this handler stamped payment fields and
        // stopped: the money moved, the business had no job, nothing on the
        // calendar, and no way to know the session existed.
        //
        // Idempotent on jobs.booking_request_id, so the reconcile sweep and a
        // Stripe redelivery of this same event are both safe.
        try {
          const { createJobFromBookingRequest } = await import("../_shared/booking_job.ts");
          const jobRes = await createJobFromBookingRequest(admin, {
            bookingRequestId: bookingId,
            reason: "payment",
            amountDollars: amountTotal ? amountTotal / 100 : null,
          });
          if (!jobRes.ok) {
            // Do NOT fail the webhook. The payment is recorded and Stripe must
            // not retry purely because job creation had a bad moment — the
            // reconcile sweep exists to pick this up. Logged loudly so it is
            // visible rather than silent.
            console.error("[stripe-webhook] paid but job not created", bookingId, jobRes.error);
          }
        } catch (e) {
          console.error("[stripe-webhook] job creation threw", bookingId, (e as Error)?.message);
        }
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
