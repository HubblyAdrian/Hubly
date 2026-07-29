/**
 * Create Stripe Checkout Session for a Commerce Store cart / order.
 * Reuses PaymentsProvider / destination Connect checkout — never fakes success.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createDestinationCheckout,
  sanitizeAppReturnUrl,
  stripeConfigured,
} from "../_shared/stripe.ts";
import { resolveShippingProvider } from "../_shared/hubly_provider_shipping.ts";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  try {
    if (!stripeConfigured()) {
      return json({
        error: "Online payments aren’t available yet.",
        code: "not_configured",
        message: "Provider not configured",
      }, 503);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS");
    if (!supabaseUrl || !serviceKey) return json({ error: "Server misconfigured" }, 500);

    const body = await req.json().catch(() => ({}));
    const businessId = String(body.business_id || "").trim();
    const cartId = String(body.cart_id || "").trim();
    if (!businessId) return json({ error: "business_id required" }, 400);
    if (!cartId) return json({ error: "cart_id required" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: connect } = await admin
      .from("stripe_connect_accounts")
      .select("stripe_account_id,charges_enabled")
      .eq("business_id", businessId)
      .maybeSingle();
    if (!connect?.stripe_account_id || !connect.charges_enabled) {
      return json({
        error: "Stripe Connect is not ready for this business.",
        code: "not_configured",
        message: "Provider not configured",
      }, 503);
    }

    const { data: cart } = await admin
      .from("commerce_carts")
      .select("*, commerce_cart_items(*)")
      .eq("id", cartId)
      .eq("business_id", businessId)
      .eq("status", "open")
      .maybeSingle();
    if (!cart) return json({ error: "cart_not_found" }, 404);
    const items = Array.isArray(cart.commerce_cart_items) ? cart.commerce_cart_items : [];
    if (!items.length) return json({ error: "cart_empty" }, 400);

    const subtotal = items.reduce(
      (s: number, it: { unit_price_cents?: number; qty?: number }) =>
        s + (Number(it.unit_price_cents) || 0) * Math.max(1, Number(it.qty) || 1),
      0,
    );

    const shipProvider = resolveShippingProvider("hubly_builtin");
    const shipMode = String(body.shipping_mode || "pickup");
    const shipQuote = await shipProvider.quote({
      mode: shipMode as "pickup" | "flat_rate" | "local_delivery" | "free",
      subtotalCents: subtotal,
      profile: { rateCents: Number(body.shipping_rate_cents) || 0 },
    });
    const shippingCents = shipQuote.ok ? shipQuote.data.amountCents : 0;
    const total = subtotal + shippingCents;

    const orderNumber = `STO-${Date.now().toString().slice(-8)}`;
    const { data: order, error: orderErr } = await admin.from("commerce_orders").insert({
      business_id: businessId,
      customer_id: cart.customer_id || body.customer_id || null,
      order_number: orderNumber,
      status: "pending",
      fulfillment: shipMode === "pickup" ? "pickup" : "unfulfilled",
      channel: String(body.channel || "website"),
      currency: "usd",
      subtotal_cents: subtotal,
      shipping_cents: shippingCents,
      total_cents: total,
      shipping_method: shipMode,
      customer_name: body.customer_name || null,
      customer_email: body.customer_email || null,
      customer_phone: body.customer_phone || null,
      shipping_address: body.shipping_address || {},
    }).select("*").single();
    if (orderErr || !order) return json({ error: orderErr?.message || "order_create_failed" }, 400);

    const orderItems = items.map((it: {
      product_id?: string;
      variant_id?: string;
      bundle_id?: string;
      title?: string;
      qty?: number;
      unit_price_cents?: number;
    }) => ({
      order_id: order.id,
      business_id: businessId,
      product_id: it.product_id || null,
      variant_id: it.variant_id || null,
      bundle_id: it.bundle_id || null,
      title: it.title || "Item",
      qty: Math.max(1, Number(it.qty) || 1),
      unit_price_cents: Number(it.unit_price_cents) || 0,
      total_cents: (Number(it.unit_price_cents) || 0) * Math.max(1, Number(it.qty) || 1),
    }));
    await admin.from("commerce_order_items").insert(orderItems);

    const productName = items.length === 1
      ? String(items[0].title || "Store order")
      : `Store order (${items.length} items)`;

    const successUrl = sanitizeAppReturnUrl(body.success_url);
    const cancelUrl = sanitizeAppReturnUrl(body.cancel_url || body.success_url);

    const session = await createDestinationCheckout({
      connectedAccountId: connect.stripe_account_id,
      amountCents: total,
      currency: "usd",
      productName,
      successUrl,
      cancelUrl,
      customerEmail: body.customer_email || undefined,
      metadata: {
        hubly_commerce_order_id: order.id,
        hubly_business_id: businessId,
        hubly_cart_id: cartId,
        hubly_kind: "commerce_store",
      },
    });

    await admin.from("commerce_orders").update({
      stripe_checkout_session_id: session.id,
      updated_at: new Date().toISOString(),
    }).eq("id", order.id);

    return json({
      url: session.url,
      session_id: session.id,
      order_id: order.id,
      order_number: order.order_number,
      total_cents: total,
    });
  } catch (e) {
    console.error("create-store-checkout", e);
    return json({ error: e instanceof Error ? e.message : "checkout_failed" }, 500);
  }
});
