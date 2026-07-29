/**
 * Nightly AI Merchandising — analyzes store signals and writes commerce_merchandising_recs.
 * Auth: Authorization bearer = HUBLY_CRON_SECRET or service role.
 * Production-First: does not invent revenue; uses real order/product rows when present.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const cron = (Deno.env.get("HUBLY_CRON_SECRET") || "").trim();
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS") ?? "";
  if (!token || (token !== cron && token !== serviceKey)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl || !serviceKey) return json({ error: "Server misconfigured" }, 500);
  const admin = createClient(supabaseUrl, serviceKey);

  const body = await req.json().catch(() => ({}));
  const businessId = String(body.business_id || "").trim();

  let bizQuery = admin.from("commerce_store_settings").select("business_id").eq("enabled", true);
  if (businessId) bizQuery = bizQuery.eq("business_id", businessId);
  const { data: stores } = await bizQuery.limit(200);
  const businessIds = (stores || []).map((s: { business_id: string }) => s.business_id);
  if (!businessIds.length && businessId) businessIds.push(businessId);

  let written = 0;
  for (const bid of businessIds) {
    const { data: products } = await admin
      .from("commerce_products")
      .select("id,name,inventory,low_stock_at,price_cents,featured,status,track_inventory")
      .eq("business_id", bid)
      .eq("status", "active");

    const recs: Array<Record<string, unknown>> = [];
    for (const p of products || []) {
      if (p.track_inventory && p.inventory != null && p.inventory <= (p.low_stock_at ?? 5)) {
        recs.push({
          business_id: bid,
          product_id: p.id,
          kind: "restock",
          title: `Restock ${p.name}`,
          detail: `Inventory at ${p.inventory} (low at ${p.low_stock_at ?? 5}).`,
          payload: { inventory: p.inventory },
          status: "open",
        });
      }
      if (!p.featured && (p.price_cents || 0) >= 5000) {
        recs.push({
          business_id: bid,
          product_id: p.id,
          kind: "feature",
          title: `Feature ${p.name}`,
          detail: "Higher-ticket active product — consider featuring on /store.",
          payload: { price_cents: p.price_cents },
          status: "open",
        });
      }
    }

    if (recs.length) {
      await admin.from("commerce_merchandising_recs")
        .delete()
        .eq("business_id", bid)
        .eq("status", "open")
        .in("kind", ["restock", "feature"]);
      const { error } = await admin.from("commerce_merchandising_recs").insert(recs);
      if (!error) written += recs.length;
    }
  }

  return json({ ok: true, businesses: businessIds.length, recommendations: written });
});
