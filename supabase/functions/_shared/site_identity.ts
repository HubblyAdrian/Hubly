import { ALLOWED_DOCUMENT_SECTIONS } from "./hubly_document.ts";

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
// 2026-08-18 by ALLOWED_DOCUMENT_SECTIONS in hubly_document.ts — a closed
// set of four, enforced by the validator. See the comment there for why:
// variety of section SET produced repetition of section CONTENT.

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
- Full-bleed statement — a section with a background wash (bg-gradient-to-b, from-brand-800) and nothing but a short, confident line of type at large size. No cards, no columns. Use it to break rhythm between two dense sections.
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
export function buildPageStructureBlock(leadWith?: unknown): string {
  const want = String(leadWith || "").trim().toLowerCase();
  const lead = LEAD_GUIDANCE[want] || LEAD_GUIDANCE.services;
  const list = ALLOWED_DOCUMENT_SECTIONS
    .map((sec) => `- ${sec.id}${sec.required ? " (REQUIRED)" : ""}: ${sec.what}`)
    .join("\n");
  return `PAGE STRUCTURE — a closed set of six. A hard limit, not a starting point.

A Hubly site is exactly six things, and two of them are not yours to build: the
LOGO and PAGE BACKGROUND are rendered around your document, and CONTACT (phone
and email) lives in the header and footer, which are also rendered for you.
Never build a section for either.

That leaves FOUR sections you may write, and no others:

${list}

${lead}

RULES — enforced by the validator, not preferences:
- Do NOT invent sections. No "Why choose us", no "Our process", no "About", no "Benefits", no "Reassurance", no "How it works", no "FAQ", no "Our promise", no separate closing call-to-action. If it is not one of the four above, it does not go on the page, and the document will be rejected.
- hero and services are required. Include service-area and reviews when the business has something real for them.
- Give each section exactly the id listed above: hero, services, service-area, reviews.
- A shorter page that says each thing ONCE beats a longer page that says one thing three times. The commonest failure here is a hero listing three benefits, then a "Why us" section repeating those three benefits, then a "Reassurance" section repeating them again. One statement, once.
- Everything you would have put in an invented section belongs INSIDE one of the four: reasons to choose this business go in the hero or beside the services they apply to, process detail goes with the service it describes, answers to common questions go with the service they concern.

Because the set of sections is fixed, the only thing that makes two businesses' pages look different is the SHAPE each section takes. That makes the layout rules below more important, not less.

${LAYOUT_BLOCK}`;
}
