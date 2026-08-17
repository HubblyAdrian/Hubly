/**
 * Visual identity for a newly created site — a curated palette and a section
 * order, chosen per business instead of inherited from column defaults.
 *
 * WHY EVERY SITE LOOKED THE SAME
 *
 * Not the blueprint (the AI build path never touches it) and not the generation
 * prompt (3,897 characters of format spec with zero trade words). The cause was
 * that start_business_in_progress sets no visual identity at all, so every
 * business inherited the same three column defaults:
 *
 *     brand_color   DEFAULT '#1a3a6e'                                  the navy
 *     bg_color      DEFAULT '#f0f0ee'
 *     section_order DEFAULT ARRAY['services','portfolio','reviews','about']
 *
 * and renderHublyDocument exposes exactly one knob — `--brand`. Dog grooming,
 * photography and detailing produced the same page with different words because
 * the words were the only thing that could differ.
 *
 * A CURATED PALETTE, NOT FREE HEX
 *
 * The model picks a palette by NAME from this list; it never supplies a colour.
 * Two reasons. A model choosing arbitrary hex will eventually produce something
 * genuinely ugly or illegible, and nobody is reviewing it before a stranger sees
 * their new site. And a named palette is something we can reason about later —
 * "how many businesses chose slate?" is answerable; "what colours has the model
 * invented?" is not.
 *
 * Every value here is a deliberate choice, not a generated ramp. Add to this
 * list rather than letting callers pass hex.
 */

export type SitePalette = {
  /** Stable id the model selects. Never renamed — it is stored on the row. */
  id: string;
  /** What it looks like, for the model's benefit. */
  feel: string;
  /** Businesses it suits. Guidance, never enforcement. */
  suits: string;
  brand: string;
  background: string;
};

export const SITE_PALETTES: SitePalette[] = [
  { id: "slate",     feel: "cool, calm, professional",        suits: "trades, home services, B2B, anything that wants to look dependable", brand: "#334155", background: "#f8fafc" },
  { id: "navy",      feel: "traditional, trusted, corporate", suits: "finance, legal, established local firms",                             brand: "#1a3a6e", background: "#f0f0ee" },
  { id: "forest",    feel: "natural, grounded, outdoors",     suits: "landscaping, lawn care, tree work, garden design",                    brand: "#2f5d45", background: "#f4f7f2" },
  { id: "terracotta",feel: "warm, human, handmade",           suits: "grooming, pet care, childcare, cafes, anything caring",               brand: "#c25a3a", background: "#fdf6f2" },
  { id: "sand",      feel: "soft, editorial, understated",    suits: "photography, weddings, interiors, beauty",                            brand: "#8b6f47", background: "#faf7f2" },
  { id: "ink",       feel: "high contrast, modern, sharp",    suits: "detailing, barbers, tattoo, fitness, anything bold",                  brand: "#111418", background: "#f5f5f4" },
  { id: "ocean",     feel: "clean, fresh, clinical",          suits: "cleaning, pools, dental, medical, anything about hygiene",            brand: "#1c6b8c", background: "#f2f8fb" },
  { id: "plum",      feel: "rich, premium, considered",       suits: "salons, spas, luxury services, event planning",                       brand: "#5b3a58", background: "#faf5f9" },
];

/** Section ids the site can order. Matches businesses.section_order. */
export const SITE_SECTIONS = ["services", "portfolio", "reviews", "about"] as const;
export type SiteSection = typeof SITE_SECTIONS[number];

/**
 * What the business leads with — the second half of the sameness.
 *
 * A photographer's work IS the pitch, so portfolio first. A groomer's customer
 * wants to know what you do to their dog and what it costs, so services first.
 * A new business with no reviews and no photos should not lead with either.
 */
export const SITE_LEADS: Record<string, SiteSection[]> = {
  services:  ["services", "portfolio", "reviews", "about"],
  portfolio: ["portfolio", "services", "reviews", "about"],
  about:     ["about", "services", "portfolio", "reviews"],
  reviews:   ["reviews", "services", "portfolio", "about"],
};

export function paletteById(id: unknown): SitePalette | null {
  const want = String(id || "").trim().toLowerCase();
  return SITE_PALETTES.find((p) => p.id === want) || null;
}

/** Section order for a lead choice. Unknown/absent falls back to services-first. */
export function sectionOrderFor(leadWith: unknown): SiteSection[] {
  const want = String(leadWith || "").trim().toLowerCase();
  return SITE_LEADS[want] || SITE_LEADS.services;
}

/** The palette list as prompt text, generated from the data so the two cannot drift. */
export function palettePromptList(): string {
  return SITE_PALETTES.map((p) => `"${p.id}" — ${p.feel}; suits ${p.suits}`).join("; ");
}
