/**
 * Commerce checkout core — the server-authoritative purchase path.
 *
 * computeAuthoritativeOrder(): the guest cart sends only product/variant IDs + quantities.
 * The server RELOADS the real Commerce products/variants and computes prices, titles,
 * availability, and totals itself — client-submitted prices/names/totals are never trusted.
 * Rejects products that aren't purchasable, invalid quantities, and insufficient stock.
 *
 * finalizePaidCommerceOrder(): run on successful payment (Stripe webhook). Marks the order
 * paid (idempotent), resolves/creates the canonical CRM customer via the shared #185 resolver
 * and stamps commerce_orders.customer_id, then deducts inventory (variant-aware, atomic).
 * Never creates a second customer or checkout system.
 */
import { resolveOrCreateCrmCustomer } from "./crm_customer.ts";
import { applyOrderInventoryDeduction } from "./hubly_commerce_inventory.ts";
import { resolveShippingProvider } from "./hubly_provider_shipping.ts";

// deno-lint-ignore no-explicit-any
type Admin = any;

export type LineItemInput = { product_id: string; variant_id?: string | null; qty: number };

export type ComputedOrderItem = {
  product_id: string;
  variant_id: string | null;
  bundle_id: null;
  title: string;
  sku: string | null;
  qty: number;
  unit_price_cents: number;
  total_cents: number;
};

export type ComputedOrder = {
  ok: boolean;
  error?: string;
  detail?: string;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  shipping_method: string;
  fulfillment: string;
  items: ComputedOrderItem[];
};

/**
 * Reload real Commerce data and compute the authoritative order. `lineItems` carries only
 * ids + quantities; anything else the client sends is ignored.
 */
export async function computeAuthoritativeOrder(
  admin: Admin,
  businessId: string,
  lineItems: LineItemInput[],
  opts?: { shippingMode?: string; shippingRateCents?: number },
): Promise<ComputedOrder> {
  const empty = (error: string, detail?: string): ComputedOrder => ({
    ok: false, error, detail, subtotal_cents: 0, shipping_cents: 0, total_cents: 0,
    shipping_method: "pickup", fulfillment: "unfulfilled", items: [],
  });
  if (!businessId) return empty("business_id_required");
  if (!Array.isArray(lineItems) || !lineItems.length) return empty("cart_empty");
  if (lineItems.length > 100) return empty("too_many_items");

  const items: ComputedOrderItem[] = [];
  for (const raw of lineItems) {
    const productId = String(raw?.product_id || "").trim();
    if (!productId) return empty("invalid_item", "missing product_id");
    const qtyNum = Number(raw?.qty);
    if (!Number.isInteger(qtyNum) || qtyNum < 1 || qtyNum > 999) {
      return empty("invalid_quantity", `product ${productId} qty=${raw?.qty}`);
    }
    const qty = qtyNum;

    const { data: product } = await admin
      .from("commerce_products")
      .select("id,name,sku,price_cents,product_type,status,inventory,track_inventory,visibility,business_id")
      .eq("id", productId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (!product) return empty("product_not_found", productId);
    // Only publicly purchasable products (active + website-visible) may be bought.
    const vis = (product.visibility || {}) as Record<string, unknown>;
    if (product.status !== "active" || vis.website === false) {
      return empty("product_unavailable", product.name || productId);
    }

    const isStockless = product.product_type === "gift_card" || product.product_type === "digital";
    let unitPrice = Number(product.price_cents) || 0;
    let title = String(product.name || "Item");
    let sku: string | null = product.sku ?? null;
    let variantId: string | null = null;

    const rawVariant = raw?.variant_id ? String(raw.variant_id).trim() : "";
    if (rawVariant) {
      const { data: variant } = await admin
        .from("commerce_product_variants")
        .select("id,name,sku,price_cents,inventory,product_id,business_id")
        .eq("id", rawVariant)
        .eq("product_id", productId)
        .eq("business_id", businessId)
        .maybeSingle();
      if (!variant) return empty("variant_not_found", rawVariant);
      variantId = variant.id;
      if (variant.price_cents != null) unitPrice = Number(variant.price_cents) || 0;
      if (variant.name) title = `${title} — ${variant.name}`;
      if (variant.sku) sku = variant.sku;
      if (!isStockless && variant.inventory != null && Number(variant.inventory) < qty) {
        return empty("insufficient_stock", `${title} (have ${variant.inventory}, want ${qty})`);
      }
    } else if (!isStockless && product.track_inventory !== false && product.inventory != null) {
      if (Number(product.inventory) < qty) {
        return empty("insufficient_stock", `${title} (have ${product.inventory}, want ${qty})`);
      }
    }

    items.push({
      product_id: productId, variant_id: variantId, bundle_id: null,
      title, sku, qty, unit_price_cents: unitPrice, total_cents: unitPrice * qty,
    });
  }

  const subtotal = items.reduce((s, it) => s + it.total_cents, 0);
  const shipMode = String(opts?.shippingMode || "pickup");
  const shipProvider = resolveShippingProvider("hubly_builtin");
  const shipQuote = await shipProvider.quote({
    mode: shipMode as "pickup" | "flat_rate" | "local_delivery" | "free",
    subtotalCents: subtotal,
    profile: { rateCents: Number(opts?.shippingRateCents) || 0 },
  });
  const shippingCents = shipQuote.ok && shipQuote.data ? shipQuote.data.amountCents : 0;

  return {
    ok: true,
    subtotal_cents: subtotal,
    shipping_cents: shippingCents,
    total_cents: subtotal + shippingCents,
    shipping_method: shipMode,
    fulfillment: shipMode === "pickup" ? "pickup" : "unfulfilled",
    items,
  };
}

/**
 * Finalize a paid Commerce order: mark paid (idempotent), resolve the canonical CRM
 * customer (#185) onto customer_id, deduct inventory (variant-aware/atomic), convert cart.
 */
export async function finalizePaidCommerceOrder(
  admin: Admin,
  opts: { orderId: string; paymentIntentId?: string | null; sessionId?: string | null; cartId?: string | null },
): Promise<{ ok: boolean; alreadyPaid?: boolean; customerId?: string | null; shortfalls?: unknown[]; error?: string }> {
  const orderId = String(opts.orderId || "").trim();
  if (!orderId) return { ok: false, error: "order_id_required" };

  const { data: order } = await admin
    .from("commerce_orders")
    .select("id,business_id,status,customer_id,customer_name,customer_email,customer_phone")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "order_not_found" };
  if (order.status === "paid") return { ok: true, alreadyPaid: true, customerId: order.customer_id };

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: "paid", paid_at: now, updated_at: now };
  if (opts.paymentIntentId) patch.stripe_payment_intent_id = opts.paymentIntentId;
  if (opts.sessionId) patch.stripe_checkout_session_id = opts.sessionId;

  // Resolve the canonical CRM customer (#185) — non-fatal; never blocks the paid order.
  let customerId: string | null = order.customer_id || null;
  if (!customerId && (order.customer_email || order.customer_phone || order.customer_name)) {
    try {
      const { customer } = await resolveOrCreateCrmCustomer(admin, order.business_id, {
        name: order.customer_name || order.customer_email || "Customer",
        phone: order.customer_phone,
        email: order.customer_email,
      });
      if (customer?.id) customerId = customer.id as string;
    } catch (_e) { /* non-fatal */ }
  }
  if (customerId) patch.customer_id = customerId;

  const { error: upErr } = await admin
    .from("commerce_orders").update(patch).eq("id", orderId).neq("status", "paid");
  if (upErr) return { ok: false, error: upErr.message };

  // Deduct inventory (only paid orders reach here → abandoned checkouts never consume stock).
  let shortfalls: unknown[] = [];
  try {
    const { data: rows } = await admin
      .from("commerce_order_items").select("product_id,variant_id,qty,title").eq("order_id", orderId);
    const res = await applyOrderInventoryDeduction(admin, {
      businessId: order.business_id,
      orderId,
      items: (rows || []).map((i: Record<string, unknown>) => ({
        product_id: i.product_id as string, variant_id: (i.variant_id as string) || null,
        qty: Number(i.qty) || 1, title: i.title as string,
      })),
    });
    shortfalls = res.shortfalls || [];
    if (shortfalls.length) {
      await admin.from("commerce_orders")
        .update({ notes: "inventory_shortfall", updated_at: new Date().toISOString() })
        .eq("id", orderId);
    }
  } catch (_e) { /* inventory failure is logged upstream, never un-pays the order */ }

  if (opts.cartId) {
    await admin.from("commerce_carts")
      .update({ status: "converted", updated_at: new Date().toISOString() })
      .eq("id", String(opts.cartId));
  }

  return { ok: true, customerId, shortfalls };
}
