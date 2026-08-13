/**
 * Commerce API — owner CRUD for products, collections, bundles, discounts, orders.
 * Auth: business owner JWT. Service-role used after ownership check.
 *
 * Routes (method + path suffix after function name):
 * GET/POST   /products
 * PATCH/DELETE /products/:id
 * GET        /products/by-slug/:slug
 * GET        /public/storefront?business_id=  (anon — curated public catalog)
 * POST       /products/import
 * POST       /products/duplicate
 * GET/POST   /collections
 * PATCH/DELETE /collections/:id
 * POST       /collections/:id/products
 * GET/POST   /bundles
 * PATCH/DELETE /bundles/:id
 * GET        /orders
 * GET/PATCH  /orders/:id
 * POST       /orders/:id/refund  (marks refunded — Stripe refund via Payments Stage 2)
 * GET/POST   /cart  (+ add/item via body.action)
 * GET/POST   /shipping/quote
 * GET        /products/:id/images
 * POST       /products/:id/images
 * PATCH/DELETE /images/:imageId
 * GET        /products/:id/variants
 * POST       /products/:id/variants
 * PATCH/DELETE /variants/:variantId
 * GET/PATCH  /settings  (commerce_store_settings; auto-creates default row on first GET)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { applyOrderInventoryDeduction } from "../_shared/hubly_commerce_inventory.ts";
import { resolveShippingProvider } from "../_shared/hubly_provider_shipping.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

function slugify(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || `item-${Date.now()}`;
}

function pathParts(req: Request): string[] {
  const u = new URL(req.url);
  // /functions/v1/commerce-api/products/xyz
  const idx = u.pathname.indexOf("/commerce-api");
  const rest = idx >= 0 ? u.pathname.slice(idx + "/commerce-api".length) : u.pathname;
  return rest.split("/").filter(Boolean);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!supabaseUrl || !anon || !serviceKey) {
    return json({ error: "Server misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, serviceKey);

  const parts = pathParts(req);
  const resource = parts[0] || "";
  const id = parts[1] || "";
  const sub = parts[2] || "";

  // Public product slug read (anon ok)
  if (req.method === "GET" && resource === "products" && id === "by-slug" && sub) {
    const businessId = new URL(req.url).searchParams.get("business_id") || "";
    if (!businessId) return json({ error: "business_id required" }, 400);
    const { data, error } = await admin
      .from("commerce_products")
      .select("*")
      .eq("business_id", businessId)
      .eq("slug", sub)
      .eq("status", "active")
      .maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!data) return json({ error: "not_found" }, 404);
    return json({ product: data });
  }

  // Public storefront read (anon ok) — curated public catalog for one business.
  // Uses service role but returns only public-safe rows/fields: active + website-visible
  // products (never cost_cents), their images + variants, published collections, active
  // bundles, and the public subset of store settings. This is the Phase 2 public read path
  // so the customer storefront and the owner Store admin share commerce_products as SSOT.
  if (req.method === "GET" && resource === "public" && id === "storefront") {
    const reqUrl = new URL(req.url);
    const businessId = reqUrl.searchParams.get("business_id") || "";
    if (!businessId) return json({ error: "business_id required" }, 400);
    // surface=store → the dedicated /store route (gated on the store being enabled).
    // Otherwise the website embed, additionally gated on showOnWebsite.
    const surface = reqUrl.searchParams.get("surface") || "website";
    const { data: settingsRow } = await admin
      .from("commerce_store_settings").select("*").eq("business_id", businessId).maybeSingle();
    const theme = (settingsRow?.theme as Record<string, unknown>) || {};
    const settings = {
      enabled: settingsRow ? settingsRow.enabled !== false : true,
      showOnWebsite: theme.showOnWebsite !== false,
      store_path: settingsRow?.store_path || "/store",
      hero_title: settingsRow?.hero_title || null,
      hero_subtitle: settingsRow?.hero_subtitle || null,
      currency: settingsRow?.currency || "usd",
    };
    const visibleOnSurface = surface === "store"
      ? settings.enabled
      : (settings.enabled && settings.showOnWebsite);
    if (!visibleOnSurface) {
      return json({ settings, products: [], collections: [], bundles: [] });
    }
    const { data: prods } = await admin.from("commerce_products").select("*")
      .eq("business_id", businessId).eq("status", "active");
    const visible = (prods || []).filter((p: Record<string, unknown>) => {
      const v = (p.visibility as Record<string, unknown>) || {};
      return v.website !== false;
    });
    const pids = visible.map((p: Record<string, unknown>) => p.id as string);
    const imagesByProduct: Record<string, Record<string, unknown>[]> = {};
    const variantsByProduct: Record<string, Record<string, unknown>[]> = {};
    if (pids.length) {
      const { data: imgs } = await admin.from("commerce_product_images").select("*").in("product_id", pids);
      const { data: vars } = await admin.from("commerce_product_variants").select("*").in("product_id", pids);
      for (const im of (imgs || [])) (imagesByProduct[im.product_id] ||= []).push(im);
      for (const vr of (vars || [])) (variantsByProduct[vr.product_id] ||= []).push(vr);
    }
    const products = visible.map((p: Record<string, unknown>) => ({
      id: p.id, name: p.name, slug: p.slug, description: p.description, short_description: p.short_description,
      price_cents: p.price_cents, compare_at_cents: p.compare_at_cents, product_type: p.product_type,
      inventory: p.track_inventory === false ? null : p.inventory, track_inventory: p.track_inventory,
      featured: p.featured, brand: p.brand, sku: p.sku, seo: p.seo,
      metadata: { category: ((p.metadata as Record<string, unknown>) || {}).category ?? null },
      images: (imagesByProduct[p.id as string] || [])
        .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
        .map((im) => ({ url: im.url, alt: im.alt, sort_order: im.sort_order })),
      variants: (variantsByProduct[p.id as string] || [])
        .map((v) => ({ id: v.id, name: v.name, sku: v.sku, price_cents: v.price_cents, inventory: v.inventory, options: v.options })),
    }));
    const { data: colls } = await admin.from("commerce_collections")
      .select("id,name,slug,description,published,sort_order")
      .eq("business_id", businessId).eq("published", true).order("sort_order");
    // Collection membership, filtered to the public product set only.
    const publicIds = new Set(pids);
    const membershipByCollection: Record<string, string[]> = {};
    if ((colls || []).length) {
      const { data: cps } = await admin.from("commerce_collection_products")
        .select("collection_id,product_id,sort_order")
        .eq("business_id", businessId)
        .order("sort_order");
      for (const cp of (cps || [])) {
        if (!publicIds.has(cp.product_id)) continue;
        (membershipByCollection[cp.collection_id] ||= []).push(cp.product_id);
      }
    }
    const collections = (colls || []).map((c: Record<string, unknown>) => ({
      id: c.id, name: c.name, slug: c.slug, description: c.description,
      product_ids: membershipByCollection[c.id as string] || [],
    }));
    const { data: bundles } = await admin.from("commerce_bundles")
      .select("id,title,slug,description,price_cents,discount_cents,featured,status")
      .eq("business_id", businessId).eq("status", "active");
    return json({ settings, products, collections, bundles: bundles || [] });
  }

  // Owner auth for everything else
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
  const userId = userData.user.id;

  const body = ["POST", "PATCH", "DELETE"].includes(req.method)
    ? await req.json().catch(() => ({}))
    : {};
  const businessId = String(
    body.business_id || new URL(req.url).searchParams.get("business_id") || "",
  ).trim();
  if (!businessId) return json({ error: "business_id required" }, 400);

  const { data: biz } = await admin
    .from("businesses")
    .select("id,owner_id")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz || biz.owner_id !== userId) return json({ error: "Forbidden" }, 403);

  try {
    // ── Products ──────────────────────────────────────────────────────────
    if (resource === "products") {
      // Product images: GET/POST /products/:id/images
      if (id && sub === "images") {
        if (req.method === "GET") {
          const { data, error } = await admin.from("commerce_product_images").select("*")
            .eq("product_id", id).eq("business_id", businessId).order("sort_order");
          if (error) return json({ error: error.message }, 400);
          return json({ images: data || [] });
        }
        if (req.method === "POST") {
          const url = String(body.url || "").trim();
          if (!url) return json({ error: "url required" }, 400);
          const { data, error } = await admin.from("commerce_product_images").insert({
            business_id: businessId,
            product_id: id,
            url,
            alt: String(body.alt || ""),
            sort_order: Number(body.sort_order) || 0,
          }).select("*").single();
          if (error) return json({ error: error.message }, 400);
          return json({ image: data }, 201);
        }
      }
      // Product variants: GET/POST /products/:id/variants
      if (id && sub === "variants") {
        if (req.method === "GET") {
          const { data, error } = await admin.from("commerce_product_variants").select("*")
            .eq("product_id", id).eq("business_id", businessId).order("created_at");
          if (error) return json({ error: error.message }, 400);
          return json({ variants: data || [] });
        }
        if (req.method === "POST") {
          const name = String(body.name || "").trim();
          if (!name) return json({ error: "name required" }, 400);
          const row = {
            business_id: businessId,
            product_id: id,
            name,
            sku: body.sku || null,
            price_cents: body.price_cents != null
              ? Math.round(Number(body.price_cents))
              : (body.price != null ? Math.round(Number(body.price) * 100) : null),
            inventory: body.inventory != null
              ? Number(body.inventory)
              : (body.stock != null ? Number(body.stock) : null),
            options: body.options || {},
          };
          const { data, error } = await admin.from("commerce_product_variants").insert(row).select("*").single();
          if (error) return json({ error: error.message }, 400);
          return json({ variant: data }, 201);
        }
      }
      if (req.method === "GET" && !id) {
        const { data, error } = await admin
          .from("commerce_products")
          .select("*")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false });
        if (error) return json({ error: error.message }, 400);
        return json({ products: data || [] });
      }
      if (req.method === "POST" && id === "duplicate") {
        const sourceId = String(body.product_id || "").trim();
        const { data: src } = await admin.from("commerce_products").select("*")
          .eq("id", sourceId).eq("business_id", businessId).maybeSingle();
        if (!src) return json({ error: "not_found" }, 404);
        const copy = { ...src };
        delete copy.id;
        copy.name = `${src.name} (copy)`;
        copy.slug = slugify(`${src.slug}-copy-${Date.now()}`);
        copy.status = "draft";
        copy.created_at = new Date().toISOString();
        copy.updated_at = copy.created_at;
        const { data, error } = await admin.from("commerce_products").insert(copy).select("*").single();
        if (error) return json({ error: error.message }, 400);
        return json({ product: data }, 201);
      }
      if (req.method === "POST" && id === "import") {
        const rows = Array.isArray(body.rows) ? body.rows : [];
        if (!rows.length) return json({ error: "rows required" }, 400);
        const inserted = [];
        for (const raw of rows.slice(0, 500)) {
          const name = String(raw.name || "").trim();
          if (!name) continue;
          const row = {
            business_id: businessId,
            name,
            slug: slugify(raw.slug || name),
            description: String(raw.description || ""),
            short_description: String(raw.short_description || raw.shortDescription || ""),
            price_cents: Math.round(Number(raw.price_cents ?? (Number(raw.price) || 0) * 100)),
            sku: raw.sku || null,
            status: raw.status || "draft",
            product_type: raw.product_type || raw.type || "physical",
            inventory: raw.inventory != null ? Number(raw.inventory) : (raw.stock != null ? Number(raw.stock) : 0),
          };
          const { data, error } = await admin.from("commerce_products").insert(row).select("*").single();
          if (!error && data) inserted.push(data);
        }
        return json({ imported: inserted.length, products: inserted }, 201);
      }
      if (req.method === "POST" && !id) {
        const name = String(body.name || "").trim();
        if (!name) return json({ error: "name required" }, 400);
        const row = {
          business_id: businessId,
          name,
          slug: slugify(body.slug || name),
          description: String(body.description || ""),
          short_description: String(body.shortDescription || body.short_description || ""),
          price_cents: Math.round(Number(body.price_cents ?? (Number(body.price) || 0) * 100)),
          compare_at_cents: body.compare_at_cents != null
            ? Math.round(Number(body.compare_at_cents))
            : (body.compareAtPrice != null ? Math.round(Number(body.compareAtPrice) * 100) : null),
          cost_cents: body.cost_cents != null ? Math.round(Number(body.cost_cents)) : null,
          sku: body.sku || null,
          barcode: body.barcode || null,
          status: body.status || "draft",
          product_type: body.product_type || body.type || "physical",
          inventory: body.inventory != null ? Number(body.inventory) : (body.stock != null ? Number(body.stock) : 0),
          track_inventory: body.track_inventory !== false,
          low_stock_at: Number(body.low_stock_at) || 5,
          weight_grams: body.weight_grams != null ? Number(body.weight_grams) : null,
          brand: body.brand || null,
          featured: !!body.featured,
          seo: body.seo || {},
          visibility: body.visibility || undefined,
          metadata: body.metadata || {},
        };
        const { data, error } = await admin.from("commerce_products").insert(row).select("*").single();
        if (error) return json({ error: error.message }, 400);
        return json({ product: data }, 201);
      }
      if ((req.method === "PATCH" || req.method === "DELETE") && id) {
        if (req.method === "DELETE") {
          const { error } = await admin.from("commerce_products").delete()
            .eq("id", id).eq("business_id", businessId);
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true });
        }
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        const map: Record<string, string> = {
          name: "name",
          slug: "slug",
          description: "description",
          short_description: "short_description",
          shortDescription: "short_description",
          sku: "sku",
          barcode: "barcode",
          status: "status",
          product_type: "product_type",
          type: "product_type",
          brand: "brand",
          featured: "featured",
          seo: "seo",
          visibility: "visibility",
          metadata: "metadata",
          track_inventory: "track_inventory",
        };
        for (const [k, col] of Object.entries(map)) {
          if (body[k] !== undefined) patch[col] = body[k];
        }
        if (body.price != null) patch.price_cents = Math.round(Number(body.price) * 100);
        if (body.price_cents != null) patch.price_cents = Math.round(Number(body.price_cents));
        if (body.inventory != null) patch.inventory = Number(body.inventory);
        if (body.stock != null) patch.inventory = Number(body.stock);
        const { data, error } = await admin.from("commerce_products").update(patch)
          .eq("id", id).eq("business_id", businessId).select("*").single();
        if (error) return json({ error: error.message }, 400);
        return json({ product: data });
      }
    }

    // ── Collections ───────────────────────────────────────────────────────
    if (resource === "collections") {
      if (req.method === "GET" && !id) {
        const { data, error } = await admin.from("commerce_collections").select("*")
          .eq("business_id", businessId).order("sort_order");
        if (error) return json({ error: error.message }, 400);
        return json({ collections: data || [] });
      }
      if (req.method === "POST" && !id) {
        const name = String(body.name || "").trim();
        if (!name) return json({ error: "name required" }, 400);
        const { data, error } = await admin.from("commerce_collections").insert({
          business_id: businessId,
          name,
          slug: slugify(body.slug || name),
          description: String(body.description || ""),
          published: !!body.published,
        }).select("*").single();
        if (error) return json({ error: error.message }, 400);
        return json({ collection: data }, 201);
      }
      if (req.method === "POST" && id && sub === "products") {
        const productIds = Array.isArray(body.product_ids) ? body.product_ids : [];
        const rows = productIds.map((pid: string, i: number) => ({
          collection_id: id,
          product_id: pid,
          business_id: businessId,
          sort_order: i,
        }));
        if (rows.length) {
          const { error } = await admin.from("commerce_collection_products").upsert(rows);
          if (error) return json({ error: error.message }, 400);
        }
        return json({ ok: true, count: rows.length });
      }
      if ((req.method === "PATCH" || req.method === "DELETE") && id) {
        if (req.method === "DELETE") {
          const { error } = await admin.from("commerce_collections").delete()
            .eq("id", id).eq("business_id", businessId);
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true });
        }
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const k of ["name", "slug", "description", "published", "sort_order"]) {
          if (body[k] !== undefined) patch[k] = body[k];
        }
        const { data, error } = await admin.from("commerce_collections").update(patch)
          .eq("id", id).eq("business_id", businessId).select("*").single();
        if (error) return json({ error: error.message }, 400);
        return json({ collection: data });
      }
    }

    // ── Bundles ───────────────────────────────────────────────────────────
    if (resource === "bundles") {
      if (req.method === "GET" && !id) {
        const { data, error } = await admin.from("commerce_bundles").select("*")
          .eq("business_id", businessId).order("created_at", { ascending: false });
        if (error) return json({ error: error.message }, 400);
        return json({ bundles: data || [] });
      }
      if (req.method === "POST" && !id) {
        const title = String(body.title || body.name || "").trim();
        if (!title) return json({ error: "title required" }, 400);
        const { data, error } = await admin.from("commerce_bundles").insert({
          business_id: businessId,
          title,
          slug: slugify(body.slug || title),
          description: String(body.description || ""),
          price_cents: Math.round(Number(body.price_cents ?? (Number(body.price) || 0) * 100)),
          discount_cents: Math.round(Number(body.discount_cents) || 0),
          featured: !!body.featured,
          status: body.status || "draft",
        }).select("*").single();
        if (error) return json({ error: error.message }, 400);
        const products = Array.isArray(body.products) ? body.products : [];
        if (data && products.length) {
          await admin.from("commerce_bundle_products").insert(
            products.map((p: { product_id?: string; id?: string; qty?: number }) => ({
              bundle_id: data.id,
              product_id: p.product_id || p.id,
              business_id: businessId,
              qty: Math.max(1, Number(p.qty) || 1),
            })),
          );
        }
        return json({ bundle: data }, 201);
      }
      if ((req.method === "PATCH" || req.method === "DELETE") && id) {
        if (req.method === "DELETE") {
          const { error } = await admin.from("commerce_bundles").delete()
            .eq("id", id).eq("business_id", businessId);
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true });
        }
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const k of ["title", "slug", "description", "featured", "status", "price_cents", "discount_cents"]) {
          if (body[k] !== undefined) patch[k] = body[k];
        }
        if (body.price != null) patch.price_cents = Math.round(Number(body.price) * 100);
        const { data, error } = await admin.from("commerce_bundles").update(patch)
          .eq("id", id).eq("business_id", businessId).select("*").single();
        if (error) return json({ error: error.message }, 400);
        return json({ bundle: data });
      }
    }

    // ── Orders ────────────────────────────────────────────────────────────
    if (resource === "orders") {
      if (req.method === "GET" && !id) {
        const { data, error } = await admin.from("commerce_orders").select("*, commerce_order_items(*)")
          .eq("business_id", businessId).order("created_at", { ascending: false }).limit(100);
        if (error) return json({ error: error.message }, 400);
        return json({ orders: data || [] });
      }
      if (req.method === "GET" && id) {
        const { data, error } = await admin.from("commerce_orders").select("*, commerce_order_items(*)")
          .eq("id", id).eq("business_id", businessId).maybeSingle();
        if (error) return json({ error: error.message }, 400);
        if (!data) return json({ error: "not_found" }, 404);
        return json({ order: data });
      }
      if (req.method === "PATCH" && id) {
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const k of ["status", "fulfillment", "notes", "shipping_method"]) {
          if (body[k] !== undefined) patch[k] = body[k];
        }
        const { data, error } = await admin.from("commerce_orders").update(patch)
          .eq("id", id).eq("business_id", businessId).select("*").single();
        if (error) return json({ error: error.message }, 400);
        return json({ order: data });
      }
      if (req.method === "POST" && id && sub === "refund") {
        // Status-only refund mark. Live Stripe refunds stay on Payments/Revenue Stage 2.
        const { data, error } = await admin.from("commerce_orders").update({
          status: "refunded",
          fulfillment: "cancelled",
          updated_at: new Date().toISOString(),
        }).eq("id", id).eq("business_id", businessId).select("*").single();
        if (error) return json({ error: error.message }, 400);
        return json({
          order: data,
          note: "Order marked refunded. Stripe refund handler is Payments Stage 2 when configured.",
        });
      }
    }

    // ── Cart ──────────────────────────────────────────────────────────────
    if (resource === "cart") {
      const customerId = String(body.customer_id || "").trim() || null;
      const guestToken = String(body.guest_token || "").trim() || null;
      if (req.method === "GET" || (req.method === "POST" && body.action === "get")) {
        let q = admin.from("commerce_carts").select("*, commerce_cart_items(*)")
          .eq("business_id", businessId).eq("status", "open");
        if (customerId) q = q.eq("customer_id", customerId);
        else if (guestToken) q = q.eq("guest_token", guestToken);
        else return json({ error: "customer_id or guest_token required" }, 400);
        const { data } = await q.maybeSingle();
        return json({ cart: data || null });
      }
      if (req.method === "POST" && body.action === "add") {
        let cartId = String(body.cart_id || "").trim();
        if (!cartId) {
          const { data: cart, error } = await admin.from("commerce_carts").insert({
            business_id: businessId,
            customer_id: customerId,
            guest_token: guestToken,
            status: "open",
          }).select("*").single();
          if (error) return json({ error: error.message }, 400);
          cartId = cart.id;
        }
        const productId = String(body.product_id || "").trim();
        const { data: product } = await admin.from("commerce_products").select("*")
          .eq("id", productId).eq("business_id", businessId).maybeSingle();
        if (!product) return json({ error: "product_not_found" }, 404);
        const qty = Math.max(1, Number(body.qty) || 1);
        const { data: item, error } = await admin.from("commerce_cart_items").insert({
          cart_id: cartId,
          business_id: businessId,
          product_id: productId,
          title: product.name,
          qty,
          unit_price_cents: product.price_cents,
        }).select("*").single();
        if (error) return json({ error: error.message }, 400);
        return json({ cart_id: cartId, item }, 201);
      }
      if (req.method === "POST" && body.action === "merge") {
        // Merge guest cart into customer cart after login
        const fromGuest = String(body.guest_token || "").trim();
        const toCustomer = String(body.customer_id || "").trim();
        if (!fromGuest || !toCustomer) return json({ error: "guest_token and customer_id required" }, 400);
        const { data: guestCart } = await admin.from("commerce_carts").select("id")
          .eq("business_id", businessId).eq("guest_token", fromGuest).eq("status", "open").maybeSingle();
        if (!guestCart) return json({ ok: true, merged: 0 });
        let { data: custCart } = await admin.from("commerce_carts").select("id")
          .eq("business_id", businessId).eq("customer_id", toCustomer).eq("status", "open").maybeSingle();
        if (!custCart) {
          const { data: created } = await admin.from("commerce_carts").insert({
            business_id: businessId,
            customer_id: toCustomer,
            status: "open",
          }).select("id").single();
          custCart = created;
        }
        await admin.from("commerce_cart_items").update({ cart_id: custCart!.id })
          .eq("cart_id", guestCart.id);
        await admin.from("commerce_carts").update({ status: "converted" }).eq("id", guestCart.id);
        return json({ ok: true, cart_id: custCart!.id });
      }
      if ((req.method === "PATCH" || req.method === "DELETE") && id) {
        // id = cart item id
        if (req.method === "DELETE") {
          const { error } = await admin.from("commerce_cart_items").delete()
            .eq("id", id).eq("business_id", businessId);
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true });
        }
        const qty = Math.max(1, Number(body.qty) || 1);
        const { data, error } = await admin.from("commerce_cart_items").update({ qty })
          .eq("id", id).eq("business_id", businessId).select("*").single();
        if (error) return json({ error: error.message }, 400);
        return json({ item: data });
      }
    }

    // ── Product images: PATCH/DELETE /images/:imageId ─────────────────────
    if (resource === "images" && id) {
      if (req.method === "DELETE") {
        const { error } = await admin.from("commerce_product_images").delete()
          .eq("id", id).eq("business_id", businessId);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      if (req.method === "PATCH") {
        const patch: Record<string, unknown> = {};
        for (const k of ["alt", "sort_order", "url"]) {
          if (body[k] !== undefined) patch[k] = body[k];
        }
        const { data, error } = await admin.from("commerce_product_images").update(patch)
          .eq("id", id).eq("business_id", businessId).select("*").single();
        if (error) return json({ error: error.message }, 400);
        return json({ image: data });
      }
    }

    // ── Product variants: PATCH/DELETE /variants/:variantId ───────────────
    if (resource === "variants" && id) {
      if (req.method === "DELETE") {
        const { error } = await admin.from("commerce_product_variants").delete()
          .eq("id", id).eq("business_id", businessId);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      if (req.method === "PATCH") {
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const k of ["name", "sku", "options"]) {
          if (body[k] !== undefined) patch[k] = body[k];
        }
        if (body.price != null) patch.price_cents = Math.round(Number(body.price) * 100);
        if (body.price_cents != null) patch.price_cents = Math.round(Number(body.price_cents));
        if (body.inventory != null) patch.inventory = Number(body.inventory);
        if (body.stock != null) patch.inventory = Number(body.stock);
        const { data, error } = await admin.from("commerce_product_variants").update(patch)
          .eq("id", id).eq("business_id", businessId).select("*").single();
        if (error) return json({ error: error.message }, 400);
        return json({ variant: data });
      }
    }

    // ── Store settings ────────────────────────────────────────────────────
    // commerce_store_settings is the canonical per-business Store config
    // (independent of the Website service catalog). PK is business_id.
    if (resource === "settings" && !id) {
      if (req.method === "GET") {
        let { data, error } = await admin.from("commerce_store_settings").select("*")
          .eq("business_id", businessId).maybeSingle();
        if (error) return json({ error: error.message }, 400);
        if (!data) {
          const ins = await admin.from("commerce_store_settings")
            .insert({ business_id: businessId }).select("*").single();
          if (ins.error) return json({ error: ins.error.message }, 400);
          data = ins.data;
        }
        return json({ settings: data });
      }
      if (req.method === "PATCH") {
        const patch: Record<string, unknown> = {
          business_id: businessId,
          updated_at: new Date().toISOString(),
        };
        const map: Record<string, string> = {
          enabled: "enabled",
          currency: "currency",
          store_path: "store_path",
          storePath: "store_path",
          hero_title: "hero_title",
          heroTitle: "hero_title",
          hero_subtitle: "hero_subtitle",
          heroSubtitle: "hero_subtitle",
          theme: "theme",
          shipping_defaults: "shipping_defaults",
          shippingDefaults: "shipping_defaults",
        };
        for (const [k, col] of Object.entries(map)) {
          if (body[k] !== undefined) patch[col] = body[k];
        }
        const { data, error } = await admin.from("commerce_store_settings")
          .upsert(patch, { onConflict: "business_id" }).select("*").single();
        if (error) return json({ error: error.message }, 400);
        return json({ settings: data });
      }
    }

    // ── Shipping quote ────────────────────────────────────────────────────
    if (resource === "shipping" && id === "quote" && req.method === "POST") {
      const provider = resolveShippingProvider(String(body.provider || "hubly_builtin"));
      const result = await provider.quote({
        mode: body.mode || "pickup",
        subtotalCents: Number(body.subtotal_cents) || 0,
        weightGrams: body.weight_grams != null ? Number(body.weight_grams) : undefined,
        destination: body.destination || {},
        profile: { rateCents: Number(body.rate_cents) || 0, config: body.config || {} },
      });
      const shipCode = (result as { code?: string }).code;
      return json(result, result.ok ? 200 : (shipCode === "NOT_CONFIGURED" ? 503 : 400));
    }

    // Internal: apply inventory (also used from webhook)
    if (resource === "inventory" && id === "apply-order" && req.method === "POST") {
      const orderId = String(body.order_id || "").trim();
      const { data: items } = await admin.from("commerce_order_items").select("*").eq("order_id", orderId);
      const result = await applyOrderInventoryDeduction(admin, {
        businessId,
        orderId,
        items: (items || []).map((i: { product_id?: string; qty: number; title?: string }) => ({
          product_id: i.product_id,
          qty: i.qty,
          title: i.title,
        })),
        actorUserId: userId,
      });
      return json(result);
    }

    return json({ error: "not_found", path: parts }, 404);
  } catch (e) {
    console.error("commerce-api", e);
    return json({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});
