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

// TELLING STRIPE THE TRUTH.
//
// 200 + {"received": true} is a CLAIM that we handled the event, and Stripe acts
// on it: a 2xx marks the event delivered and it is never retried. So a 200 we did
// not earn destroys the only automatic recovery the payment rail has.
//
// Found 2026-09-06 the hard way. Event evt_1UCbhQEEmwNmC4XDS4WUaH59 (payment
// intent pi_3UCbhOEEmwNmC4XD0oic1eZ4, order STO-75904418) was delivered, answered
// 200 {"received": true}, and finalised nothing. The order is still `pending`
// behind a successful charge. An earlier purchase that worked completely answered
// with the identical bytes — so our response carried no signal at all about
// whether the order had been recorded.
//
// The distinction the handler must make:
//   finalise FAILED               -> non-2xx. Stripe retries; a stuck pending
//                                    order self-heals. This is what its retry
//                                    machinery is for.
//   finalise OK, notification bad -> 200 + a loud operator alert. A notification
//                                    failure must never un-pay an order
//                                    (commerce_checkout.ts:228).
function webhookFailed(what: string) {
  return new Response(JSON.stringify({ error: what }), {
    status: 500,
    headers: { "content-type": "application/json" },
  });
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
            console.error("stripe-webhook finalize commerce order", commerceOrderId, fin.error);
            return webhookFailed("commerce order update failed");
          }
        } catch (finErr) {
          console.error("stripe-webhook finalize commerce order threw", commerceOrderId, finErr);
          return webhookFailed("commerce order update failed");
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
        // Backup finalize path. NOTE, corrected 2026-09-06: this used to say
        // "idempotent (finalize no-ops if the order is already paid)". That is true
        // only when this delivery arrives AFTER the other one has written. When both
        // deliveries of the same purchase arrive together they both read "pending",
        // both pass finalize's early return, and only the `didFlip` guard inside
        // finalize separates run-once work from run-per-delivery work. That wrong
        // comment is what let a double inventory deduction ship.
        // THE LINES THAT SWALLOWED THE SALE. Until 2026-09-06 this block threw
        // away finalize's return value — `{ok:false}` for order_not_found,
        // order_id_required or any update error was simply discarded — and its
        // catch logged and fell through to the shared 200 below. So this path,
        // the BACKUP that runs precisely when the session path was skipped,
        // reported success for every possible outcome. The session branch above
        // has always returned 500 on both; the two disagreed, and the one that
        // did not check is the one that ran.
        try {
          const { finalizePaidCommerceOrder } = await import("../_shared/commerce_checkout.ts");
          const fin = await finalizePaidCommerceOrder(admin, { orderId: commerceOrderId, paymentIntentId: piId });
          if (!fin.ok) {
            console.error("stripe-webhook pi finalize commerce order", commerceOrderId, fin.error);
            return webhookFailed("commerce order update failed");
          }
        } catch (finErr) {
          console.error("stripe-webhook pi finalize commerce order threw", commerceOrderId, finErr);
          return webhookFailed("commerce order update failed");
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
