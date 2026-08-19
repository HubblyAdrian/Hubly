/**
 * Create Stripe Checkout Session for a Commerce Store order.
 * Reuses the destination Connect checkout (never fakes success) and the shared
 * server-authoritative pricing (commerce_checkout.computeAuthoritativeOrder).
 *
 * Guest path (Storefront Phase 3): the client sends `line_items` = [{product_id, variant_id?,
 * qty}] only — NO prices. The server reloads real Commerce products/variants and computes the
 * authoritative order; client-submitted prices/totals/names are never trusted. The legacy
 * `cart_id` path (persistent commerce_carts) is preserved for logged-in/portal use.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createDestinationCheckout,
  sanitizeAppReturnUrl,
  stripeConfigured,
} from "../_shared/stripe.ts";
import { computeAuthoritativeOrder, type ComputedOrderItem } from "../_shared/commerce_checkout.ts";
// Supabase key resolution goes through _shared/supabase_admin.ts. It THROWS on a
// missing key instead of continuing with "" (nine call sites used to 401 quietly
// and be logged), reads the plural SUPABASE_PUBLISHABLE_KEYS the platform
// actually injects rather than the singular name that is set nowhere, and never
// sends a non-JWT sb_secret_ key as a Bearer token -- PostgREST rejects those as
// "Invalid JWT", which looks exactly like the empty-key 401 in a log.
import { createAdminClient } from "../_shared/supabase_admin.ts";

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
      return json({ error: "Online payments aren’t available yet.", code: "not_configured", message: "Provider not configured" }, 503);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) return json({ error: "Server misconfigured" }, 500);

    const body = await req.json().catch(() => ({}));
    const businessId = String(body.business_id || "").trim();
    if (!businessId) return json({ error: "business_id required" }, 400);

    const admin = createAdminClient();

    // Stripe Connect must be ready — otherwise refuse honestly (no order, no fake success).
    const { data: connect } = await admin
      .from("stripe_connect_accounts")
      .select("stripe_account_id,charges_enabled")
      .eq("business_id", businessId)
      .maybeSingle();
    if (!connect?.stripe_account_id || !connect.charges_enabled) {
      return json({ error: "Stripe Connect is not ready for this business.", code: "not_configured", message: "Provider not configured" }, 503);
    }

    const shipMode = String(body.shipping_mode || "pickup");
    let subtotal = 0;
    let shippingCents = 0;
    let fulfillment = shipMode === "pickup" ? "pickup" : "unfulfilled";
    let itemsForOrder: ComputedOrderItem[] = [];
    let cartId = "";
    let customerIdSeed: string | null = body.customer_id || null;

    const lineItems = Array.isArray(body.line_items) ? body.line_items : null;
    if (lineItems && lineItems.length) {
      // Guest path — server-authoritative pricing from the Commerce DB.
      const computed = await computeAuthoritativeOrder(admin, businessId, lineItems, {
        shippingMode: shipMode,
        shippingRateCents: Number(body.shipping_rate_cents) || 0,
      });
      if (!computed.ok) {
        return json({ error: computed.error, code: computed.error, detail: computed.detail || null }, 400);
      }
      subtotal = computed.subtotal_cents;
      shippingCents = computed.shipping_cents;
      fulfillment = computed.fulfillment;
      itemsForOrder = computed.items;
    } else {
      // Legacy persistent-cart path.
      cartId = String(body.cart_id || "").trim();
      if (!cartId) return json({ error: "line_items or cart_id required" }, 400);
      const { data: cart } = await admin
        .from("commerce_carts").select("*, commerce_cart_items(*)")
        .eq("id", cartId).eq("business_id", businessId).eq("status", "open").maybeSingle();
      if (!cart) return json({ error: "cart_not_found" }, 404);
      const cartItems = Array.isArray(cart.commerce_cart_items) ? cart.commerce_cart_items : [];
      if (!cartItems.length) return json({ error: "cart_empty" }, 400);
      // Re-price the cart from the DB too (never trust snapshotted cart prices).
      const computed = await computeAuthoritativeOrder(
        admin, businessId,
        cartItems.map((it: Record<string, unknown>) => ({ product_id: it.product_id as string, variant_id: (it.variant_id as string) || null, qty: Number(it.qty) || 1 })),
        { shippingMode: shipMode, shippingRateCents: Number(body.shipping_rate_cents) || 0 },
      );
      if (!computed.ok) return json({ error: computed.error, code: computed.error, detail: computed.detail || null }, 400);
      subtotal = computed.subtotal_cents;
      shippingCents = computed.shipping_cents;
      fulfillment = computed.fulfillment;
      itemsForOrder = computed.items;
      customerIdSeed = cart.customer_id || customerIdSeed;
    }

    const total = subtotal + shippingCents;
    const orderNumber = `STO-${Date.now().toString().slice(-8)}`;
    const { data: order, error: orderErr } = await admin.from("commerce_orders").insert({
      business_id: businessId,
      customer_id: customerIdSeed, // canonical CRM link is stamped on payment (finalizePaidCommerceOrder)
      order_number: orderNumber,
      status: "pending",
      fulfillment,
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

    // Immutable per-line snapshot (title/sku/unit price) so the order stays correct even if
    // the owner later renames or re-prices the product.
    await admin.from("commerce_order_items").insert(itemsForOrder.map((it) => ({
      order_id: order.id,
      business_id: businessId,
      product_id: it.product_id,
      variant_id: it.variant_id,
      bundle_id: it.bundle_id,
      title: it.title,
      sku: it.sku,
      qty: it.qty,
      unit_price_cents: it.unit_price_cents,
      total_cents: it.total_cents,
    })));

    const productName = itemsForOrder.length === 1
      ? String(itemsForOrder[0].title)
      : `Store order (${itemsForOrder.length} items)`;

    const successUrl = sanitizeAppReturnUrl(body.success_url);
    const cancelUrl = sanitizeAppReturnUrl(body.cancel_url || body.success_url);
    const metadata: Record<string, string> = {
      hubly_commerce_order_id: order.id,
      hubly_business_id: businessId,
      hubly_kind: "commerce_store",
    };
    if (cartId) metadata.hubly_cart_id = cartId;

    const session = await createDestinationCheckout({
      connectedAccountId: connect.stripe_account_id,
      amountCents: total,
      currency: "usd",
      productName,
      successUrl,
      cancelUrl,
      customerEmail: body.customer_email || undefined,
      metadata,
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
