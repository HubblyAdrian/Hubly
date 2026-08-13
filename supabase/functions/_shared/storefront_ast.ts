/**
 * Storefront AST — the presentation config for a business's standalone Store (/store).
 *
 * This is the Storefront analog of the Website AST (HublyWebsiteAst): a versioned JSON page
 * of BLOCKS drawn from a CLOSED capability catalog. The catalog is the contract in both
 * directions: it's the only vocabulary the AI may emit (so it can never invent a block the
 * renderer can't draw), and it's exactly what the /store renderer knows how to render.
 *
 * Commerce is the single source of truth. Blocks store only REFERENCES to Commerce
 * (`productIds`, `collectionId`) — never product names/prices/images. Those are resolved
 * against the live Commerce catalog at render time, so edits/deletes in Commerce flow through
 * automatically. This module holds zero product data.
 */

export type StorefrontBlockType =
  | "storeHero"
  | "featuredProducts"
  | "productGrid"
  | "collectionGrid"
  | "featuredCollection"
  | "bestSellers"
  | "promoBanner"
  | "brandStory"
  | "cta"
  | "footer";

type FieldSpec = { kind: "string" | "number" | "boolean" | "productIds" | "collectionId"; default?: unknown };

type BlockSpec = {
  variants: string[];
  config: Record<string, FieldSpec>;
};

// The closed catalog. To add a Storefront capability, add it here AND in the renderer —
// nowhere else. The AI is told exactly this list and nothing outside it validates.
export const STOREFRONT_BLOCK_CATALOG: Record<StorefrontBlockType, BlockSpec> = {
  storeHero: {
    variants: ["standard", "tall", "compact"],
    config: { headline: { kind: "string" }, sub: { kind: "string" }, showSearch: { kind: "boolean", default: false } },
  },
  featuredProducts: {
    variants: ["standard", "large", "compact"],
    config: { title: { kind: "string", default: "Featured" }, productIds: { kind: "productIds" } },
  },
  productGrid: {
    variants: ["standard", "large"],
    config: { title: { kind: "string", default: "Shop all" }, collectionId: { kind: "collectionId" }, columns: { kind: "number", default: 4 } },
  },
  collectionGrid: {
    variants: ["standard"],
    config: { title: { kind: "string", default: "Shop by category" } },
  },
  featuredCollection: {
    variants: ["standard", "banner"],
    config: { title: { kind: "string" }, collectionId: { kind: "collectionId" } },
  },
  bestSellers: {
    variants: ["standard", "large"],
    config: { title: { kind: "string", default: "Best sellers" }, productIds: { kind: "productIds" } },
  },
  promoBanner: {
    variants: ["standard", "bold"],
    config: { text: { kind: "string" }, ctaText: { kind: "string" } },
  },
  brandStory: {
    variants: ["standard"],
    config: { title: { kind: "string" }, body: { kind: "string" } },
  },
  cta: {
    variants: ["standard"],
    config: { title: { kind: "string" }, buttonText: { kind: "string", default: "Shop now" } },
  },
  footer: {
    variants: ["standard"],
    config: { text: { kind: "string" } },
  },
};

const THEME_STYLES = ["clean", "premium", "bold", "minimal", "warm"] as const;
export type StorefrontThemeStyle = (typeof THEME_STYLES)[number];

export type StorefrontBlock = {
  id: string;
  type: StorefrontBlockType;
  order: number;
  visible: boolean;
  variant: string;
  config: Record<string, unknown>;
};

export type StorefrontAst = {
  version: 1;
  theme: { style: StorefrontThemeStyle; accent: string | null };
  blocks: StorefrontBlock[];
};

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
function rid(): string { return "b_" + Math.random().toString(36).slice(2, 9); }

/** Sanitize/validate an AST against the catalog. Unknown block types are DROPPED (the AI can
 *  never smuggle in an unsupported block); invalid variants/fields are coerced to defaults. */
export function validateStorefrontAst(raw: unknown): { ok: boolean; ast: StorefrontAst; warnings: string[] } {
  const warnings: string[] = [];
  const obj = (raw && typeof raw === "object") ? raw as Record<string, unknown> : {};
  const themeRaw = (obj.theme && typeof obj.theme === "object") ? obj.theme as Record<string, unknown> : {};
  const style = THEME_STYLES.includes(themeRaw.style as StorefrontThemeStyle) ? themeRaw.style as StorefrontThemeStyle : "clean";
  const accent = typeof themeRaw.accent === "string" && HEX.test(themeRaw.accent) ? themeRaw.accent : null;

  const rawBlocks = Array.isArray(obj.blocks) ? obj.blocks : [];
  const blocks: StorefrontBlock[] = [];
  rawBlocks.forEach((b, i) => {
    if (!b || typeof b !== "object") return;
    const rb = b as Record<string, unknown>;
    const type = String(rb.type || "") as StorefrontBlockType;
    const spec = STOREFRONT_BLOCK_CATALOG[type];
    if (!spec) { warnings.push(`dropped unknown block "${type}"`); return; }
    const variant = spec.variants.includes(String(rb.variant)) ? String(rb.variant) : spec.variants[0];
    const inConfig = (rb.config && typeof rb.config === "object") ? rb.config as Record<string, unknown> : {};
    const config: Record<string, unknown> = {};
    for (const [key, fs] of Object.entries(spec.config)) {
      const v = inConfig[key];
      if (fs.kind === "string") config[key] = v != null ? String(v).slice(0, 600) : (fs.default ?? "");
      else if (fs.kind === "number") config[key] = v != null && isFinite(Number(v)) ? Number(v) : (fs.default ?? 0);
      else if (fs.kind === "boolean") config[key] = v === true || v === "true" || (v == null ? (fs.default ?? false) : false);
      else if (fs.kind === "productIds") config[key] = Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean).slice(0, 24) : [];
      else if (fs.kind === "collectionId") config[key] = v != null && String(v).trim() ? String(v).trim() : null;
    }
    blocks.push({
      id: typeof rb.id === "string" && rb.id ? String(rb.id) : rid(),
      type,
      order: isFinite(Number(rb.order)) ? Number(rb.order) : 10 + i,
      visible: rb.visible !== false,
      variant,
      config,
    });
  });
  blocks.sort((a, b) => a.order - b.order).forEach((b, i) => { b.order = 10 + i; });

  return { ok: blocks.length > 0, ast: { version: 1, theme: { style, accent }, blocks }, warnings };
}

/** A concise catalog description for the AI generation/patch prompt — derived from the SAME
 *  catalog the validator enforces, so the model is told exactly what it may build. */
const BLOCK_PURPOSE: Record<StorefrontBlockType, string> = {
  storeHero: "top banner with headline/subheadline",
  featuredProducts: "a highlighted row of specific products you choose (productIds)",
  productGrid: "a grid of many products, optionally limited to one collection",
  collectionGrid: "cards linking to each collection/category",
  featuredCollection: "spotlight one collection",
  bestSellers: "a row of the store's best/top products",
  promoBanner: "a promotional message strip",
  brandStory: "an about / why-buy-from-us narrative",
  cta: "a call-to-action band",
  footer: "footer/contact",
};

export function storefrontCatalogPromptBlock(): string {
  const lines = (Object.entries(STOREFRONT_BLOCK_CATALOG) as [StorefrontBlockType, BlockSpec][]).map(([type, spec]) => {
    const cfg = Object.entries(spec.config).map(([k, f]) => `${k}:${f.kind}`).join(", ");
    return `- ${type} — ${BLOCK_PURPOSE[type]}. variants: [${spec.variants.join(", ")}]; config: {${cfg}}`;
  });
  return `STOREFRONT BLOCKS (the ONLY blocks that exist — never invent another type, variant, or config field):\n${lines.join("\n")}\n` +
    `Variant meaning: for product blocks (featuredProducts, productGrid, bestSellers) "large" = bigger cards, "compact" = smaller cards, "standard" = default; for storeHero "tall" = bigger, "compact" = shorter.\n` +
    `productIds and collectionId MUST be real ids from the provided catalog; never invent ids and never put product names or prices anywhere — the renderer resolves ids against live Commerce.`;
}

/** Deterministic default storefront from the real catalog — the graceful fallback used when
 *  there's no saved storefront yet or the AI is unavailable. No product data is copied in;
 *  only ids are referenced. */
export function buildDefaultStorefront(
  ctx: { businessName?: string; accent?: string | null; products: Array<{ id: string; status?: string; featured?: boolean }>; collections: Array<{ id: string }> },
): StorefrontAst {
  const active = ctx.products.filter((p) => (p.status || "active") === "active");
  const featured = active.filter((p) => p.featured).map((p) => p.id);
  const featIds = (featured.length ? featured : active.map((p) => p.id)).slice(0, 4);
  const blocks: StorefrontBlock[] = [];
  let order = 10;
  const add = (type: StorefrontBlockType, config: Record<string, unknown>, variant?: string) => {
    const spec = STOREFRONT_BLOCK_CATALOG[type];
    blocks.push({ id: rid(), type, order: order++, visible: true, variant: variant || spec.variants[0], config });
  };
  add("storeHero", { headline: ctx.businessName ? `${ctx.businessName} Store` : "Shop", sub: "Supplies and products from our team.", showSearch: false });
  if (featIds.length) add("featuredProducts", { title: "Featured", productIds: featIds });
  if (ctx.collections.length) add("collectionGrid", { title: "Shop by category" });
  add("productGrid", { title: "Shop all", collectionId: null, columns: 4 });
  add("footer", { text: ctx.businessName || "" });
  return { version: 1, theme: { style: "clean", accent: ctx.accent || null }, blocks };
}
