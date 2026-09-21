/**
 * Commerce product import — the DECISIONS, as a pure function.
 *
 * ══ WHY THIS IS A SEPARATE MODULE ═══════════════════════════════════════════════════════════
 *
 * The logic it replaces lived inside `Deno.serve` in commerce-api/index.ts, which means it could
 * not be imported, could not be called, and could not be tested without a database and a live
 * function. Two defects lived in there undisturbed (below). Moving the DECISIONS out — and
 * leaving persistence, authorisation and the HTTP contract exactly where they were — makes the
 * behaviour assertable by `scripts/check-the-import-never-drops-a-row.mjs` with no network.
 *
 * **commerce-api remains the write boundary.** This module decides; it never touches a table.
 *
 * ══ DEFECT 1 — A DUPLICATE NAME WAS DISCARDED WITHOUT A WORD ════════════════════════════════
 *
 * `commerce_products` carries `unique (business_id, slug)`, the slug is derived from the name,
 * and the import loop was:
 *
 *     const { data, error } = await admin.from("commerce_products").insert(row)…;
 *     if (!error && data) inserted.push(data);
 *
 * A failed insert vanished. The response said `imported: N` and nothing said that anything had
 * been dropped or why. Two rows called "House Salad" — a lunch one and a dinner one — go in, one
 * comes out, and the count looks like a success.
 *
 * That is prohibition 6: a state change the owner asked for completing without visible truth.
 * The slug also collides on CASE and PUNCTUATION, not just exact repeats: `House Salad`,
 * `house salad` and `HOUSE SALAD!` all produce `house-salad`.
 *
 * **What this does instead, and what it deliberately does NOT do.** It does not auto-suffix
 * (`house-salad-2`), because inventing a second product the owner did not ask for is a guess, and
 * on a re-import it would silently double the catalogue. It does not update the existing product
 * either, because overwriting something that is already live is the more expensive wrong answer.
 * It **reports**: the row is skipped, with the reason, the slug they collided on, and the id of
 * the product already holding it. The caller decides. A caller who genuinely wants both supplies
 * an explicit distinct `slug` — an escape hatch the endpoint already honoured.
 *
 * ══ DEFECT 2 — IMPORTED PRODUCTS WERE BORN UNSELLABLE ═══════════════════════════════════════
 *
 * The import wrote `inventory: 0` and never wrote `track_inventory`, so the column default
 * (`true`) applied. Checkout then refuses:
 *
 *     } else if (!isStockless && product.track_inventory !== false && product.inventory != null) {
 *       if (Number(product.inventory) < qty) return empty("insufficient_stock", …);
 *
 * So every imported product was `have 0, want 1` the moment its owner published it. The failure
 * is invisible at import time and surfaces later, to a customer, as an item that cannot be
 * bought.
 *
 * **The generic rule, which is not about any trade: counting stock is a DECISION, and silence is
 * not that decision.** If the caller says nothing about stock, the product is not stock-tracked
 * (`track_inventory: false`, `inventory: null` — null being "we do not count this", which is also
 * what the deduction path already skips on). If the caller gives a quantity, tracking is on with
 * that quantity, so a genuinely inventory-controlled product imports exactly as before.
 */

export type ImportSkipReason =
  | "missing_name"
  | "duplicate_in_request"
  | "duplicate_existing"
  | "invalid_price"
  | "over_row_limit";

export type PlannedCreate = {
  sourceIndex: number;
  name: string;
  slug: string;
  /** The insert payload, minus `business_id` — the server owns that. */
  row: Record<string, unknown>;
};

export type PlannedSkip = {
  sourceIndex: number;
  name: string | null;
  slug: string | null;
  reason: ImportSkipReason;
  /** A sentence a person can act on. Never just a code. */
  detail: string;
  existingProductId?: string;
  conflictsWithSourceIndex?: number;
};

export type ImportPlan = {
  create: PlannedCreate[];
  skipped: PlannedSkip[];
};

export const IMPORT_ROW_LIMIT = 500;

/**
 * Deterministic slug. The endpoint's own `slugify` falls back to `item-${Date.now()}` for a name
 * with no alphanumerics, which is not reproducible and can collide with itself inside one
 * request; here the fallback is the row's own index, which is unique within a request by
 * construction.
 */
export function importSlug(name: string, index: number): string {
  const s = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return s || `item-${index}`;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Decide what an import should create and what it must refuse, without touching the database.
 *
 * @param rows            raw caller rows, unvalidated
 * @param existingSlugs   slug → product id, for products this business already has
 */
export function planProductImport(
  rows: unknown,
  opts: { existingSlugs?: Record<string, string> } = {},
): ImportPlan {
  const list = Array.isArray(rows) ? rows : [];
  const existing = opts.existingSlugs || {};
  const create: PlannedCreate[] = [];
  const skipped: PlannedSkip[] = [];
  /** slug → sourceIndex, for collisions WITHIN this request. */
  const plannedSlugs: Record<string, number> = {};

  list.forEach((rawUnknown, sourceIndex) => {
    const raw = (rawUnknown || {}) as Record<string, unknown>;

    if (sourceIndex >= IMPORT_ROW_LIMIT) {
      skipped.push({
        sourceIndex, name: raw.name != null ? String(raw.name) : null, slug: null,
        reason: "over_row_limit",
        detail: `Only the first ${IMPORT_ROW_LIMIT} rows of an import are processed; this row was ` +
          `row ${sourceIndex + 1}. Send the rest as a second import.`,
      });
      return;
    }

    const name = String(raw.name ?? "").trim();
    if (!name) {
      // WAS A SILENT `continue`. A row with no name is a real thing the caller sent and got
      // nothing back for — the same defect as the duplicate, one line up.
      skipped.push({
        sourceIndex, name: null, slug: null,
        reason: "missing_name",
        detail: "This row has no product name, so there is nothing to create.",
      });
      return;
    }

    // PRICE: a missing price is 0, which is the column's own default and the existing behaviour.
    // An UNREADABLE price is refused rather than silently becoming 0 — "$12 or so" must not
    // publish as free.
    let priceCents = 0;
    if (raw.price_cents != null && raw.price_cents !== "") {
      const c = num(raw.price_cents);
      if (c == null || c < 0) {
        skipped.push({
          sourceIndex, name, slug: null, reason: "invalid_price",
          detail: `"${String(raw.price_cents)}" is not a price I can read for "${name}". ` +
            `Send price_cents as a whole number of cents, or omit it.`,
        });
        return;
      }
      priceCents = Math.round(c);
    } else if (raw.price != null && raw.price !== "") {
      const d = num(raw.price);
      if (d == null || d < 0) {
        skipped.push({
          sourceIndex, name, slug: null, reason: "invalid_price",
          detail: `"${String(raw.price)}" is not a price I can read for "${name}". ` +
            `Send price as a number of dollars, or omit it.`,
        });
        return;
      }
      priceCents = Math.round(d * 100);
    }

    const slug = String(raw.slug || "").trim()
      ? importSlug(String(raw.slug), sourceIndex)
      : importSlug(name, sourceIndex);

    const clashWith = plannedSlugs[slug];
    if (clashWith != null) {
      skipped.push({
        sourceIndex, name, slug, reason: "duplicate_in_request",
        conflictsWithSourceIndex: clashWith,
        detail: `"${name}" produces the same web address (${slug}) as row ${clashWith + 1} in this ` +
          `same import, and a business cannot have two products at one address. Nothing was ` +
          `changed. Give one of them a different name, or send an explicit distinct slug if they ` +
          `are genuinely two products.`,
      });
      return;
    }
    if (existing[slug]) {
      skipped.push({
        sourceIndex, name, slug, reason: "duplicate_existing",
        existingProductId: existing[slug],
        detail: `"${name}" would take the web address (${slug}) of a product this business ` +
          `already has. Nothing was changed and the existing product was not overwritten. ` +
          `Update that product instead, or give this one a different name.`,
      });
      return;
    }

    // ── STOCK: counting is a decision; silence is not that decision. See the header. ──
    const invRaw = raw.inventory != null && raw.inventory !== ""
      ? num(raw.inventory)
      : (raw.stock != null && raw.stock !== "" ? num(raw.stock) : null);
    const saidTrack = raw.track_inventory != null;
    const track = saidTrack ? raw.track_inventory !== false : invRaw != null;

    plannedSlugs[slug] = sourceIndex;
    create.push({
      sourceIndex, name, slug,
      row: {
        name,
        slug,
        description: String(raw.description ?? ""),
        short_description: String(raw.short_description ?? raw.shortDescription ?? ""),
        price_cents: priceCents,
        sku: raw.sku ? String(raw.sku) : null,
        // DRAFT IS THE DEFAULT AND STAYS THE DEFAULT. Nothing an import creates reaches a
        // customer until somebody publishes it.
        status: raw.status ? String(raw.status) : "draft",
        product_type: String(raw.product_type ?? raw.type ?? "physical"),
        inventory: invRaw,
        track_inventory: track,
        // Provenance rides through so a caller can record WHERE a row came from. Generic: it is
        // the column's own purpose, and nothing here knows about any particular caller.
        ...(raw.metadata && typeof raw.metadata === "object" ? { metadata: raw.metadata } : {}),
      },
    });
  });

  return { create, skipped };
}
