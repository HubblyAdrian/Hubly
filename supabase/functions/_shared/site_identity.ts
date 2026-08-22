
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

// ---------------------------------------------------------------------------
// Page structure — the third and largest half of the sameness.
//
// The Hubly Document has no section types. renderHublyDocument is a generic
// recursive walker over semantic tags, and `section_order` appears nowhere in
// it — that column drives the OTHER website system (generate-site, hubly.html).
// So on the AI path a "section" is nothing more than a <section> the model
// chose to write, and structure is decided entirely by the prompt.
//
// That is why every AI site had the same three sections whatever the trade:
// the format spec described tags and utility classes and never once said the
// page could contain anything other than services, reviews and about. The
// model wasn't ignoring guidance; there wasn't any.
//
// A vocabulary costs nothing to extend — no renderer branch, no validator
// entry, no theme work — because these are generic tags, not components. The
// only things that cost are the five reserved elements in HUBLY_RESERVED_TAGS.
// Add ideas here freely; add reserved elements very reluctantly.
// ---------------------------------------------------------------------------

// SECTION_IDEAS (fourteen ideas, pick five to eight) was replaced on
// 2026-08-18, first by a closed set of four and then — the same day, once real
// business data began reaching the generator — by the Content Value Rule in
// hubly_document.ts, which caps nothing and instead requires each section to
// carry something a visitor can use.

/**
 * What the business leads with, as a prompt instruction.
 *
 * Derived from businesses.section_order[0] so the choice startDraft already
 * made drives BOTH website systems from one stored value, rather than the AI
 * path silently ignoring it (which is what happened until 2026-08-17).
 */
const LEAD_GUIDANCE: Record<string, string> = {
  services:  "Lead with what this business does and what it costs — that is what its customers want first.",
  portfolio: "Lead with the work itself. For this business the work IS the pitch, so show it before explaining it.",
  about:     "Lead with who this business is. Trust is the barrier here, so establish the person before the service.",
  reviews:   "Lead with proof from real customers, before any claim the business makes about itself.",
};

/**
 * How a section is BUILT, as opposed to what it is about.
 *
 * Choosing different sections did not produce different pages. Grooming,
 * photography and detailing each picked a distinct set — 13-21% overlap — and
 * all three still looked identical, because every section came out the same
 * shape: heading and paragraph on the left, a grid of bordered cards on the
 * right. The model had one way to render anything, so structural variety
 * collapsed back into one page.
 *
 * A card grid is the safe default and the model reaches for it when nothing
 * else is named. So the alternatives have to be named, and — critically — the
 * classes that make them possible have to be in the prompt's styling list.
 * Half of these were impossible until 2026-08-17: aspect-*, object-cover,
 * relative/absolute/inset-0 and the gradient tokens were all accepted by the
 * validator and never mentioned to the model, which is why a photography hero
 * asked for an image frame and got `min-h-screen` — a full-viewport grey box —
 * as the only height token it had ever been offered.
 */
const LAYOUT_BLOCK = `SECTION LAYOUT — vary the SHAPE, not just the subject.

The fastest way to make three different businesses look like one template is to
give every section the same shape. A heading, a paragraph, and a row of bordered
cards is the default your instincts will reach for. It is fine ONCE on a page.
It is not fine four times.

Shapes available with the class vocabulary above:
- Full-bleed statement — a background wash (bg-gradient-to-b, from-brand-800) behind a short, confident line of type. HERO ONLY: anywhere else it is a section carrying no concrete content, which the validator rejects.
- Text over image — a relative section, an absolute inset-0 image or placeholder behind it, a scrim, and the copy on top. This is the strongest hero shape for a visual trade.
- Two-column split — copy in one column, a single proportioned image (aspect-[4/3], object-cover) in the other. Not three cards; one image.
- Numbered process strip — a horizontal row of steps with big numerals and no card chrome, connected by spacing rather than boxes. Right for how-it-works.
- Alternating stack — image left / text right, then text left / image right, repeating. Right for services where each item deserves its own room.
- Wide comparison — a two-column table-like block (before/after, us/them, tier A/tier B) built from a grid, not from cards.
- List with dividers — plain rows separated by border-b, no boxes at all. Right for FAQ and for long service lists.
- Card grid — the default. Genuinely right for a set of 3-6 peer items with no natural order.

RULES
- Use at least THREE different shapes on a page. A page where every section is a card grid has failed even if the sections themselves are well chosen.
- The hero should not be the same shape as the section under it.
- Cards are for peer items. If the things are not peers, do not put them in cards.
- Photographs and placeholders: give the frame an aspect-* class. Never min-h-screen on a picture frame.`;

/** The structural vocabulary as prompt text. `leadWith` comes from section_order[0]. */
/**
 * THE PALETTE BLOCK.
 *
 * The generation prompt used to say NOTHING about colour, and brand_color was
 * never shown to the model — so it free-fell into its own prior for "tasteful
 * small business website": warm off-white background with a serif. Measured
 * across stored pages, the soft/editorial trades (books, coffee, cafés,
 * florists) clustered on cream while the model varied on its own for harder
 * trades — but the variation was luck, not instruction.
 *
 * Nav experiments failed because "put the brand wherever" gave the model nothing
 * to compute from. Colour is different: the trade is a real source. So this
 * instructs POSITIVELY (decide from the business) and names the specific,
 * diagnosable failure (cream + serif) so the model can recognise and avoid it.
 */
export function buildPaletteBlock(): string {
  return `PALETTE — decided by the business, then committed to.

The palette comes from what this business actually IS: the trade, the materials
it works in, the place it's in, and the light people associate with it. A
barbershop is not a bakery. A tattoo studio is not a florist. A plumber is not a
yoga studio. Decide the palette from the business in front of you, then commit to
it — carry one deliberate scheme through the background, the type and the accents
so the whole page reads as one considered thing, not a template with the name
swapped in.

Let the trade pull you somewhere specific: dark and high-contrast, metal and
concrete, saturated and loud, cool and clinical, earthy and matte, bright and
fresh — whatever THIS business genuinely is. The background is a decision, not a
canvas colour; a black barbershop, a deep-green grocer, an oxblood tattoo studio,
a stark-white gallery are all more honest than the same off-white every time.

NAME THE FAILURE, because it is specific and it is the thing to avoid: warm
off-white (cream, ivory, #faf…, #fff…f0) paired with a serif is the internet's
default for "tasteful small business website," and reaching for it makes every
Hubly page look like every other Hubly page regardless of trade. Do NOT default
to it. Use it only when THIS particular business genuinely calls for it (a
patisserie, a stationer, a wedding florist might) — never as the safe choice
because nothing else came to mind.`;
}

export function buildPageStructureBlock(leadWith?: unknown): string {
  const want = String(leadWith || "").trim().toLowerCase();
  const lead = LEAD_GUIDANCE[want] || LEAD_GUIDANCE.services;
  return `PAGE STRUCTURE — decided by the business, not by a quota.

There is NO limit on how many sections a page may have. Five, seven, nine — the
right number is however many the business has real things to say. A business
with three services, a service area and real photos earns more sections than one
with a name and a phone number, and it should get them.

What every section must do instead is EARN ITS PLACE.

THE CONTENT VALUE RULE — enforced by the validator, not a preference:
A section must carry at least one concrete thing a visitor can use — a price, a
duration or distance, a list of two or more items, a comparison table, an
expandable question, a real photo, or a working Hubly element. Headings and
paragraphs about the business are NOT enough, however well written.

The hero is the one exception: its job is to be a statement.

- If a section would only contain prose, do not build it. Fold what it says into
  a section that carries something real.
- If there is nothing real for a section yet — no reviews on record, no photos,
  no prices — DELETE THE SECTION. Do not write copy explaining that it is empty.
  "Reviews will appear here once we connect them" is a section that occupies a
  real customer's page to say nothing, and it will be rejected.
- Do not pad. Two sections that each carry something beat five where three are
  atmosphere.

${lead}

CHROME IS NOT A SECTION. Navigation, the logo, contact details, the footer, the
booking CTA in the header, site controls, the chatbot and the service-area map
are all rendered AROUND your document. Never spend a section on them and never
rebuild them yourself.

${LAYOUT_BLOCK}`;
}
