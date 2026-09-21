/**
 * Menu extraction — NORMALISATION, as a pure function.
 *
 * ══ WHAT THIS IS AND IS NOT ═════════════════════════════════════════════════════════════════
 *
 * It takes what a model read off a photograph or a PDF of a menu and turns it into a shape a
 * REVIEW SCREEN can render. It is not a menu system, it does not touch Commerce, and it never
 * sees a database. The extraction it normalises is produced by `import-offers`, which is the
 * same door a service price list already goes through — the menu is a second contract on one
 * extractor, not a second extractor.
 *
 * It lives in _shared, apart from the endpoint, for exactly the reason commerce_import.ts does:
 * logic inside `Deno.serve` cannot be called, so it cannot be tested, so defects live in it
 * undisturbed. `scripts/check-a-menu-is-read-not-written.mjs` executes this directly.
 *
 * ══ THE DISCIPLINE ══════════════════════════════════════════════════════════════════════════
 *
 * A missing thing stays missing. A null price stays null; an empty description stays empty;
 * an item under no clear heading keeps `section: null` rather than being sorted into the most
 * likely one. Nothing in this file can add a fact — it can only drop a malformed one, or ask
 * for more review.
 *
 * `needsReview` is the one field this WILL set on the model's behalf, and only ever upward: a
 * null price always needs a person, whatever the model claimed. Raising the review bar can cost
 * an owner a glance; lowering it can put a made-up price in front of a customer.
 */

export type MenuSize = { label: string; price: number | null };

export type MenuItem = {
  name: string;
  section: string | null;
  sectionConfidence: "high" | "medium" | "low";
  price: number | null;
  /** The words actually printed where a price should be ("Market Price"), kept verbatim. */
  priceText: string | null;
  desc: string;
  /** Present ONLY when every size is labelled and priced. */
  sizes: MenuSize[] | null;
  /** The SMALLEST PRINTED size price, when the menu priced the sizes but not the item itself.
   *  It is not a price the item has — `price` stays null, faithfully — it is the review screen's
   *  starting suggestion, shown to the owner and editable by him. Derived only from numbers the
   *  menu actually printed; never computed, rounded or guessed. */
  priceFromSizes: number | null;
  /** Sizes the menu mentioned but did not price — reported so the owner sees they existed. */
  sizesUnusable: MenuSize[] | null;
  needsReview: boolean;
  issue: string | null;
  confidence: "high" | "medium" | "low";
};

export type MenuExtraction = {
  sections: Array<{ name: string; confidence: "high" | "medium" | "low" }>;
  items: MenuItem[];
  warnings: string[];
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function conf(v: unknown): "high" | "medium" | "low" {
  const c = String(v || "").toLowerCase();
  return c === "high" || c === "medium" || c === "low" ? c : "low";
}

export function normalizeMenuExtraction(parsed: unknown): MenuExtraction {
  const p = (parsed || {}) as Record<string, unknown>;
  const items: MenuItem[] = [];

  for (const rawUnknown of (Array.isArray(p.items) ? p.items : [])) {
    const raw = (rawUnknown || {}) as Record<string, unknown>;
    const name = String(raw.name ?? "").trim();
    if (!name) continue;                       // an item with no name is not an item

    const price = num(raw.price);
    const priceText = raw.priceText ? String(raw.priceText).trim() : null;

    /* SIZES ONLY WHEN EVERY ONE OF THEM IS PRICED. A partly-priced size list is the
     * "choose your size" case wearing a structure, and promoting it to variants would be the
     * invention this contract exists to prevent. What was seen is still reported, as
     * `sizesUnusable`, so the owner knows the menu said something rather than wondering why
     * Hubly ignored it. */
    const rawSizes = (Array.isArray(raw.sizes) ? raw.sizes : [])
      .map((z) => {
        const o = (z || {}) as Record<string, unknown>;
        return { label: String(o.label ?? "").trim(), price: num(o.price) };
      })
      .filter((z) => z.label);
    const sizesUsable = rawSizes.length >= 2 && rawSizes.every((z) => z.price != null);

    const issue = raw.issue ? String(raw.issue).trim() : null;
    /* AN ITEM PRICED BY SIZE IS NOT AN ITEM WITHOUT A PRICE. Measured on the first live run: a
     * pizza whose Small/Medium/Large were all printed came back flagged "No price printed" and
     * arrived at the review unticked, because the menu gives such items no single number. The
     * menu is not ambiguous there and the owner should not have to resolve anything. */
    const pricedBySize = price == null && sizesUsable;
    const priceFromSizes = pricedBySize
      ? rawSizes.reduce((lo: number | null, z) => (lo == null || (z.price as number) < lo ? (z.price as number) : lo), null)
      : null;
    const needsReview = raw.needsReview === true || (price == null && !pricedBySize) ||
      (rawSizes.length > 0 && !sizesUsable);

    items.push({
      name,
      section: raw.section ? String(raw.section).trim() : null,
      sectionConfidence: conf(raw.sectionConfidence),
      price,
      priceText,
      desc: raw.desc ? String(raw.desc) : "",
      sizes: sizesUsable ? rawSizes : null,
      priceFromSizes,
      sizesUnusable: rawSizes.length > 0 && !sizesUsable ? rawSizes : null,
      needsReview,
      // A reason is always present when review is needed — "needs review" with no reason is a
      // question mark the owner cannot act on.
      issue: issue || (pricedBySize
        ? "Priced by size — the sizes below carry the prices."
        : price == null
        ? (priceText
          ? `The menu says "${priceText}" here, which is not a number.`
          : "No price printed.")
        : (rawSizes.length > 0 && !sizesUsable
          ? "Sizes were mentioned but not all of them had prices."
          : null)),
      confidence: conf(raw.confidence),
    });
  }

  const sections = (Array.isArray(p.sections) ? p.sections : [])
    .map((x) => {
      const o = (x || {}) as Record<string, unknown>;
      return { name: String(o.name ?? "").trim(), confidence: conf(o.confidence) };
    })
    .filter((x) => x.name);

  return {
    sections,
    items,
    warnings: (Array.isArray(p.warnings) ? p.warnings : []).map(String),
  };
}

/* NOTE ON WHAT IS DELIBERATELY NOT HERE.
 *
 * An earlier draft of this module also carried `planMenuApproval` — "if the owner approves this,
 * what gets created". It was deleted before it shipped: the review screen runs in the browser and
 * cannot import a Deno module, so the function would have had no caller in the product and the
 * browser would have carried a second copy of the same rules. Two readers of one fact is the
 * defect this repo pays for most often.
 *
 * Instead the DECISIONS ride on the item itself, decided once, here:
 *   - `sizes` present  → the menu priced every size, so variants are safe to offer
 *   - `sizesUnusable`  → sizes were seen but not priced; show them, never build them
 *   - `sectionConfidence` → the review screen offers a collection only on "high"
 * and duplicate detection belongs to the import endpoint, which already reports it
 * (`rejected[]`, with reasons) and is verified against the live unique constraint.
 */
