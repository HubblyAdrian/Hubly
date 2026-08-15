/**
 * Business DNA — the server-side bridge between Hubly's Business Type Engine and
 * the AI's reasoning layer.
 *
 * Until this file, `public/business-blueprints/*.json` were loaded by the browser
 * only and reached ZERO OpenAI calls. Every industry Hubly "knows" — brand voice,
 * customer psychology, what a homepage should lead with, which capabilities the
 * trade actually has — was invisible to the model. That is why the Store AI could
 * run a product-commerce interview at a photographer: it had no way to know.
 *
 * Reads the generated `business_dna.json` (see scripts/generate-business-dna.mjs).
 * Deliberately small and deterministic: no network, no database, no model call.
 *
 * WHAT THIS IS NOT: it is not a source of facts about a specific business. The
 * blueprint describes the TRADE, never this owner's real services or prices —
 * `exampleServices` are industry examples and must never be presented as theirs.
 */

import dnaFile from "./business_dna.json" with { type: "json" };

export type BusinessDna = {
  id: string;
  name: string;
  slug: string;
  description: string;
  synonyms: string[];
  brandVoice: string;
  customerPsychology: string;
  buyingBehavior: string;
  homepageGoals: string[];
  trustSignals: string[];
  copyRules: string[];
  decisionFactors: string[];
  customerExpectations: string[];
  homepagePriority: string[];
  capabilities: Record<string, boolean>;
  exampleServices: string[];
};

const BLUEPRINTS = (dnaFile as { blueprints: Record<string, BusinessDna> }).blueprints;

export function listBusinessDnaIds(): string[] {
  return Object.keys(BLUEPRINTS);
}

function norm(s: unknown): string {
  return String(s || "").toLowerCase().trim().replace(/[\s_-]+/g, " ");
}

/**
 * Resolve a stored `businesses.business_type` to a blueprint.
 *
 * Matches id, slug, then synonyms ("auto detailing" → detailing), then a
 * containment check. Returns null when nothing matches — the caller must then
 * say it doesn't know the industry rather than defaulting to one. There is
 * deliberately NO fallback blueprint here: the client's registry.js defaults to
 * `detailing`, and a silent default is exactly how a photographer ends up with
 * an automotive storefront.
 */
export function resolveBusinessDna(businessType: unknown): BusinessDna | null {
  const want = norm(businessType);
  if (!want) return null;
  const all = Object.values(BLUEPRINTS);

  for (const bp of all) {
    if (norm(bp.id) === want || norm(bp.slug) === want || norm(bp.name) === want) return bp;
  }
  for (const bp of all) {
    if ((bp.synonyms || []).some((s) => norm(s) === want)) return bp;
  }
  for (const bp of all) {
    if ((bp.synonyms || []).some((s) => want.includes(norm(s)) || norm(s).includes(want))) return bp;
    if (want.includes(norm(bp.id)) || want.includes(norm(bp.name))) return bp;
  }
  return null;
}

/**
 * Does this trade genuinely sell PRODUCTS, per its own blueprint?
 *
 * This is the Product Store vs Business Storefront question, answered from
 * Hubly's own Business Type Engine instead of by interviewing the owner.
 * Photography is the instructive case: `inventory:false` but `printStore:true`
 * — photographers really do sell prints, so a Product Store is legitimate for
 * them. Detailing is `false` across the board.
 */
export function tradeSellsProducts(dna: BusinessDna | null): boolean {
  if (!dna) return false;
  const c = dna.capabilities || {};
  return !!(c.inventory || c.printStore || c.giftCards);
}

export type BusinessIdentity = {
  name?: string | null;
  businessType?: string | null;
  accent?: string | null;
};

/**
 * The BUSINESS block every AI surface should receive before it says anything.
 *
 * Identity first, inspiration second — an owner's reference should refine what
 * Hubly already knows about their trade, never replace it.
 *
 * `productCount` is the business's REAL commerce catalog size. It is passed in
 * rather than inferred so the prompt can state what is actually true today,
 * separately from what the trade is capable of.
 */
export function buildBusinessIdentityBlock(
  identity: BusinessIdentity,
  dna: BusinessDna | null,
  opts?: { productCount?: number; surface?: "storefront" | "website" },
): string {
  const lines: string[] = ["THIS BUSINESS — everything below is REAL, already known. Never ask for any of it."];

  lines.push(`Name: ${identity.name ? String(identity.name) : "(not set)"}`);

  if (dna) {
    lines.push(`Industry: ${dna.name}${dna.description ? ` — ${dna.description}` : ""}`);
    if (dna.brandVoice) lines.push(`Brand voice: ${dna.brandVoice}`);
    if (dna.customerPsychology) lines.push(`How their customers decide: ${dna.customerPsychology}`);
    if (dna.decisionFactors?.length) lines.push(`What customers care about: ${dna.decisionFactors.join(", ")}`);
    if (dna.trustSignals?.length) lines.push(`Trust signals that matter here: ${dna.trustSignals.join(", ")}`);
    if (dna.homepageGoals?.length) lines.push(`What their public page must achieve: ${dna.homepageGoals.join("; ")}`);
    if (dna.homepagePriority?.length) lines.push(`Section priority for this trade: ${dna.homepagePriority.join(" → ")}`);
    if (dna.copyRules?.length) lines.push(`Copy rules for this trade: ${dna.copyRules.join("; ")}`);
    lines.push(
      `Stay inside the ${dna.name} category — never import auto detailing, car-wash, or unrelated trade language, ` +
        `whatever examples you may have seen elsewhere in these instructions.`,
    );
  } else {
    lines.push(
      "Industry: NOT KNOWN. Do not guess one, and do not adopt an industry from any example in these " +
        "instructions. If the trade genuinely matters for what you're about to do, ask once, plainly.",
    );
  }

  if (identity.accent) lines.push(`Brand colour: ${identity.accent} — use it as theme.accent unless told otherwise.`);

  if (opts?.productCount != null) {
    const n = opts.productCount;
    lines.push(
      n > 0
        ? `Real product catalog: ${n} product${n === 1 ? "" : "s"} (listed below). Design around what is actually there.`
        : "Real product catalog: EMPTY — this business has not added a single product.",
    );
    if (n === 0) {
      lines.push(
        tradeSellsProducts(dna)
          ? `A ${dna ? dna.name.toLowerCase() + " business" : "business like this"} can genuinely sell products, but this one has none yet. ` +
            `Say so plainly and offer to add their first product — never invent a catalog, and never interview them about ` +
            `shipping, categories or product types before a single product exists.`
          : `This trade does not normally sell physical or digital products — it sells services. The Product Store is ` +
            `probably not the surface they want. Say that plainly, tell them their services, gallery, reviews and booking ` +
            `live on their Website/Storefront, and offer to take them there. Do NOT run a product-store interview.`,
      );
    }
  }

  return lines.join("\n");
}

/** Compact identity line for logging / summaries — never sent to the model. */
export function describeIdentity(identity: BusinessIdentity, dna: BusinessDna | null): string {
  return `${identity.name || "(unnamed)"} · ${dna ? dna.name : identity.businessType || "unknown industry"}`;
}
