/**
 * Commerce inventory helpers — reduce stock on paid orders, append logs, low-stock signal.
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

// deno-lint-ignore no-explicit-any
type Admin = any;

export async function applyOrderInventoryDeduction(
  admin: Admin,
  opts: {
    businessId: string;
    orderId: string;
    items: Array<{ product_id?: string | null; qty: number; title?: string }>;
    actorUserId?: string | null;
  },
): Promise<{ logs: InventoryLogRow[]; lowStock: LowStockEvent[] }> {
  const logs: InventoryLogRow[] = [];
  const lowStock: LowStockEvent[] = [];

  for (const item of opts.items) {
    const productId = String(item.product_id || "").trim();
    if (!productId) continue;
    const qty = Math.max(1, Number(item.qty) || 1);

    const { data: product, error } = await admin
      .from("commerce_products")
      .select("id,name,sku,inventory,track_inventory,low_stock_at,business_id")
      .eq("id", productId)
      .eq("business_id", opts.businessId)
      .maybeSingle();
    if (error || !product) continue;
    if (!product.track_inventory || product.inventory == null) continue;

    const before = Number(product.inventory) || 0;
    const after = Math.max(0, before - qty);
    const { error: upErr } = await admin
      .from("commerce_products")
      .update({ inventory: after, updated_at: new Date().toISOString() })
      .eq("id", productId)
      .eq("business_id", opts.businessId);
    if (upErr) continue;

    const log: InventoryLogRow = {
      business_id: opts.businessId,
      product_id: productId,
      before_qty: before,
      after_qty: after,
      delta: after - before,
      reason: "order.paid",
      order_id: opts.orderId,
      actor_user_id: opts.actorUserId || null,
    };
    logs.push(log);
    await admin.from("commerce_inventory_logs").insert(log);

    const lowAt = Number(product.low_stock_at) || 5;
    if (after <= lowAt) {
      lowStock.push({
        businessId: opts.businessId,
        productId,
        sku: product.sku,
        name: product.name,
        afterQty: after,
        lowStockAt: lowAt,
      });
    }
  }

  return { logs, lowStock };
}
