/**
 * Commerce inventory helpers — reduce stock on paid orders, append logs, low-stock signal.
 *
 * Variant-aware: a line with variant_id decrements that variant's stock; otherwise the
 * product's stock. Overselling/race protection: an optimistic compare-and-swap
 * (UPDATE ... WHERE inventory = <observed>) with a few retries, so concurrent deductions
 * can never drive stock below zero or double-consume beyond real stock. Insufficient stock
 * at payment time (a rare checkout→pay race) is reported as a shortfall — never clamped
 * silently and never negative. Only paid orders call this, so abandoned checkouts never
 * consume inventory.
 */

export type InventoryLogRow = {
  business_id: string;
  product_id: string;
  variant_id?: string | null;
  before_qty: number | null;
  after_qty: number | null;
  delta: number;
  reason: string;
  order_id?: string | null;
  actor_user_id?: string | null;
};

export type LowStockEvent = {
  businessId: string;
  productId: string;
  sku?: string | null;
  name?: string | null;
  afterQty: number;
  lowStockAt: number;
};

export type InventoryShortfall = {
  productId: string;
  variantId?: string | null;
  requested: number;
  available: number | null;
  reason: string;
};

// deno-lint-ignore no-explicit-any
type Admin = any;

/**
 * Atomically decrement `table`.inventory for one row by `qty` using optimistic CAS.
 * Returns ok=true (with before/after) on success, ok=true+skipped for untracked (null)
 * inventory, or ok=false with a reason (not_found / insufficient / contention).
 */
async function atomicDecrement(
  admin: Admin,
  table: "commerce_products" | "commerce_product_variants",
  id: string,
  businessId: string,
  qty: number,
): Promise<{ ok: boolean; before?: number; after?: number; skipped?: boolean; reason?: string; available?: number | null }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: row } = await admin
      .from(table)
      .select("inventory")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();
    if (!row) return { ok: false, reason: "not_found" };
    if (row.inventory == null) return { ok: true, skipped: true }; // untracked → unlimited
    const before = Number(row.inventory) || 0;
    if (before < qty) return { ok: false, reason: "insufficient", available: before };
    const after = before - qty;
    const { data: updated } = await admin
      .from(table)
      .update({ inventory: after, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("business_id", businessId)
      .eq("inventory", before) // compare-and-swap: only if nobody changed it
      .select("id");
    if (updated && updated.length) return { ok: true, before, after };
    // CAS miss → someone else changed it; re-read and retry.
  }
  return { ok: false, reason: "contention" };
}

export async function applyOrderInventoryDeduction(
  admin: Admin,
  opts: {
    businessId: string;
    orderId: string;
    items: Array<{ product_id?: string | null; variant_id?: string | null; qty: number; title?: string }>;
    actorUserId?: string | null;
  },
): Promise<{ logs: InventoryLogRow[]; lowStock: LowStockEvent[]; shortfalls: InventoryShortfall[] }> {
  const logs: InventoryLogRow[] = [];
  const lowStock: LowStockEvent[] = [];
  const shortfalls: InventoryShortfall[] = [];

  for (const item of opts.items) {
    const productId = String(item.product_id || "").trim();
    if (!productId) continue;
    const variantId = item.variant_id ? String(item.variant_id).trim() : "";
    const qty = Math.max(1, Number(item.qty) || 1);

    // Parent product is always needed (for logs + product-level track/low-stock).
    const { data: product } = await admin
      .from("commerce_products")
      .select("id,name,sku,inventory,track_inventory,low_stock_at,business_id")
      .eq("id", productId)
      .eq("business_id", opts.businessId)
      .maybeSingle();
    if (!product) continue;

    if (variantId) {
      const res = await atomicDecrement(admin, "commerce_product_variants", variantId, opts.businessId, qty);
      if (res.skipped) continue; // variant inventory untracked
      if (!res.ok) {
        shortfalls.push({ productId, variantId, requested: qty, available: res.available ?? null, reason: res.reason || "error" });
        continue;
      }
      const log: InventoryLogRow = {
        business_id: opts.businessId, product_id: productId, variant_id: variantId,
        before_qty: res.before ?? null, after_qty: res.after ?? null, delta: (res.after ?? 0) - (res.before ?? 0),
        reason: "order.paid", order_id: opts.orderId, actor_user_id: opts.actorUserId || null,
      };
      logs.push(log);
      await admin.from("commerce_inventory_logs").insert(log);
      continue;
    }

    // Product-level line.
    if (!product.track_inventory || product.inventory == null) continue;
    const res = await atomicDecrement(admin, "commerce_products", productId, opts.businessId, qty);
    if (res.skipped) continue;
    if (!res.ok) {
      shortfalls.push({ productId, variantId: null, requested: qty, available: res.available ?? null, reason: res.reason || "error" });
      continue;
    }
    const log: InventoryLogRow = {
      business_id: opts.businessId, product_id: productId, variant_id: null,
      before_qty: res.before ?? null, after_qty: res.after ?? null, delta: (res.after ?? 0) - (res.before ?? 0),
      reason: "order.paid", order_id: opts.orderId, actor_user_id: opts.actorUserId || null,
    };
    logs.push(log);
    await admin.from("commerce_inventory_logs").insert(log);

    const lowAt = Number(product.low_stock_at) || 5;
    if ((res.after ?? 0) <= lowAt) {
      lowStock.push({
        businessId: opts.businessId, productId, sku: product.sku, name: product.name,
        afterQty: res.after ?? 0, lowStockAt: lowAt,
      });
    }
  }

  return { logs, lowStock, shortfalls };
}
