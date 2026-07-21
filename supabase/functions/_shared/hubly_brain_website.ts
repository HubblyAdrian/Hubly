/**
 * Hubly Runtime — Website capability helpers (Phase 7.7)
 *
 * Website is a visual expression of Business DNA, grounded in Memory facts.
 * Generation never starts from "Build a website."
 * Executor owns all DB writes — model never writes directly.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  formatBusinessMemory,
  normalizeBusinessMemory,
  type HublyBusinessMemory,
  type HublyBusinessMemoryInput,
  type HublyMemoryService,
} from "./hubly_brain_memory.ts";
import {
  formatBusinessDNA,
  normalizeBusinessDNA,
  type HublyBusinessDNA,
  type HublyBusinessDNAInput,
} from "./hubly_brain_dna.ts";

export type HublyWebsiteCopy = {
  heroHeadline: string;
  heroHeadlineOptions: string[];
  heroSub: string;
  about: string;
  faq: Array<{ q: string; a: string }>;
  seoTitle: string;
  seoDescription: string;
  whyChoose: Array<{ label: string }>;
  servicesTitle: string;
  servicesSub: string;
  galleryTitle: string;
  gallerySub: string;
  reviewsTitle: string;
  reviewsSub: string;
  ctaText: string;
  accentColor: string;
};

export type HublyPublishedWebsite = {
  businessId: string;
  slug: string;
  publicPath: string;
  website: Record<string, unknown>;
  serviceCatalog: { version: 1; services: HublyMemoryService[] };
  copy: HublyWebsiteCopy;
  usedAi: boolean;
};

export function slugifyBusinessName(name: string): string {
  return String(name || "my-business")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40) || "my-business";
}

export function industryToBusinessType(industry?: string | null): string {
  const low = String(industry || "").toLowerCase();
  if (/clean|maid|janitor/.test(low)) return "house_cleaning";
  if (/detail|car wash|ceramic/.test(low)) return "auto_detailing";
  if (/hvac|air condition|furnace/.test(low)) return "hvac";
  if (/lawn|landscap|mow/.test(low)) return "lawn_care";
  if (/pressure|power\s*wash/.test(low)) return "pressure_washing";
  if (/window|glass/.test(low)) return "window_cleaning";
  if (/photo/.test(low)) return "photography";
  if (/spa|massage|wellness/.test(low)) return "spa";
  return "house_cleaning";
}

export function defaultServicesForIndustry(industry?: string | null): HublyMemoryService[] {
  const type = industryToBusinessType(industry);
  if (type === "auto_detailing") {
    return [
      { name: "Exterior Detail", price: 150, dur: 90, desc: "Wash, clay, polish, protect" },
      { name: "Interior Detail", price: 175, dur: 120, desc: "Deep clean seats, carpets, surfaces" },
      { name: "Ceramic Coating", price: 800, dur: 240, desc: "Long-term paint protection", popular: true },
    ];
  }
  if (type === "lawn_care") {
    return [
      { name: "Lawn Mowing", price: 55, dur: 45, desc: "Weekly or biweekly cut", popular: true },
      { name: "Edging & Cleanup", price: 35, dur: 30, desc: "Clean edges and blow-off" },
    ];
  }
  // Default: home cleaning
  return [
    { name: "Standard Clean", price: 140, dur: 120, desc: "Kitchen, baths, floors, surfaces", popular: true },
    { name: "Deep Clean", price: 220, dur: 180, desc: "Detailed clean for move-in or refresh" },
    { name: "Recurring Clean", price: 120, dur: 100, desc: "Weekly or biweekly maintenance" },
  ];
}

function servicesFromMemory(memory: HublyBusinessMemory, dna: HublyBusinessDNA): HublyMemoryService[] {
  if (memory.services?.length) return memory.services;
  const focus = dna.services.idealJobs || dna.services.focus;
  if (focus?.length) {
    return focus.map((name, i) => ({
      name,
      popular: i === 0,
      desc: `Featured ${name.toLowerCase()} service`,
    }));
  }
  return defaultServicesForIndustry(memory.industry);
}

/** Deterministic DNA-informed copy — used when AI is unavailable or as fallback. */
export function buildWebsiteCopyFromMemoryDna(
  memoryInput?: HublyBusinessMemoryInput | null,
  dnaInput?: HublyBusinessDNAInput | null,
): HublyWebsiteCopy {
  const memory = normalizeBusinessMemory(memoryInput);
  const dna = normalizeBusinessDNA(dnaInput);
  const name = memory.name || "Your Business";
  const city = memory.city || memory.serviceArea?.cities?.[0] || "your area";
  const tone = dna.brand.preferredTone || dna.personality.preferredTone || "Friendly";
  const premium = dna.pricing.tier === "premium" || dna.pricing.tier === "luxury" ||
    dna.brand.salesStyle === "Premium";
  const ideal = dna.customerProfile.idealCustomer || "local homeowners";
  const advantage = dna.identity.competitiveAdvantage || "reliable local service";
  const focus = dna.services.idealJobs?.[0] || dna.services.focus?.[0] ||
    memory.services?.[0]?.name || "quality work";
  const personality = (dna.brand.personality || dna.personality.traits || ["Professional"]).join(", ");

  const heroHeadline = premium
    ? `${name}\nPremium ${focus} for ${ideal}`
    : `${name}\n${advantage === "Convenience" ? "We come to you" : `Trusted ${focus} in ${city}`}`;

  const heroSub = premium
    ? `${tone} service built for ${ideal}. ${focus} done right.`
    : `Book online. Get ${focus.toLowerCase()} done right — ${tone.toLowerCase()} and local.`;

  const about = [
    `Hi — welcome to ${name}. We serve ${ideal} in ${city} with a ${personality.toLowerCase()} approach.`,
    `People hire us for ${focus.toLowerCase()} because of ${advantage.toLowerCase()}. Our goal is simple: make booking easy and deliver work you'd proudly recommend.`,
    dna.identity.longTermVision
      ? `We're building toward ${dna.identity.longTermVision.toLowerCase()}.`
      : `Whether it's a one-time job or recurring service, we're here when you need us.`,
  ].join("\n\n");

  const whyChoose = [
    { label: advantage.slice(0, 28) || "Local & trusted" },
    { label: premium ? "Premium finish" : "Clear pricing" },
    { label: "Easy booking" },
    { label: tone === "Friendly" ? "Friendly team" : "Pro standard" },
    { label: focus.slice(0, 28) },
  ];

  const faq = [
    { q: `What areas does ${name} serve?`, a: `We primarily serve ${city} and nearby neighborhoods.` },
    { q: "How do I book?", a: "Use the booking form on this site — pick a service and preferred time." },
    { q: `Do you offer ${focus}?`, a: `Yes — ${focus} is one of our featured services.` },
    { q: "How does pricing work?", a: premium
      ? "We quote based on the job so you get a premium result without surprises."
      : "You'll see clear package options, and we'll confirm details before we start." },
    { q: "What makes you different?", a: `${advantage}. We focus on ${ideal}.` },
    { q: "Can I request a recurring schedule?", a: "Yes — ask for recurring when you book and we'll set a cadence that fits." },
  ];

  return {
    heroHeadline,
    heroHeadlineOptions: [
      heroHeadline.replace(/\n/g, " "),
      `${focus} done right in ${city}`,
      premium ? `Premium care for ${ideal}` : `Book ${name} today`,
      advantage === "Convenience" ? "We come to you" : `Why neighbors choose ${name}`,
    ],
    heroSub,
    about,
    faq,
    seoTitle: `${name} | ${focus} in ${city}`.slice(0, 60),
    seoDescription: `${name} offers ${focus.toLowerCase()} for ${ideal} in ${city}. ${advantage}. Book online.`.slice(0, 155),
    whyChoose,
    servicesTitle: "Services",
    servicesSub: `Built around what ${ideal} actually need.`,
    galleryTitle: "Our work",
    gallerySub: "Real jobs. Real results.",
    reviewsTitle: "Reviews",
    reviewsSub: `What ${ideal} say about ${name}.`,
    ctaText: premium ? "Request a Quote" : "Book Now",
    accentColor: memory.currentWebsite?.accentColor || "#D9632D",
  };
}

export function websiteMetaFromCopy(
  copy: HublyWebsiteCopy,
  opts?: { layoutId?: string | null },
): Record<string, unknown> {
  return {
    heroHeadline: copy.heroHeadline.replace(/\n/g, " "),
    heroHeadlineOptions: copy.heroHeadlineOptions,
    heroSub: copy.heroSub,
    aboutHtml: copy.about.split(/\n\n/).map((p) => `<p>${escapeHtml(p)}</p>`).join(""),
    aboutText: copy.about,
    faq: copy.faq,
    seoTitle: copy.seoTitle,
    seoDescription: copy.seoDescription,
    whyChooseUs: copy.whyChoose,
    servicesTitle: copy.servicesTitle,
    servicesSub: copy.servicesSub,
    galleryTitle: copy.galleryTitle,
    gallerySub: copy.gallerySub,
    reviewsTitle: copy.reviewsTitle,
    reviewsSub: copy.reviewsSub,
    ctaText: copy.ctaText,
    accentColor: copy.accentColor,
    layoutId: opts?.layoutId || "classic",
    bookingStyle: "embedded",
    runtimeSource: "hubly_website_executor_v1",
  };
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** System prompt: answer DNA questions — never "build a website from a prompt." */
export function websiteBuilderSystemPrompt(): string {
  return `You are Hubly's Website capability.
You do NOT take orders like "build a website."
You express Business DNA visually and convert visitors using Memory facts.

Answer through copy:
- Who is this business?
- Who are they serving?
- Why do customers hire them?
- What makes them different?
- What emotions should the website create?
- What actions should visitors take?

Return ONLY valid JSON:
{
  "hero_headline_options": [string, string, string, string],
  "hero_subhead": string,
  "about": string,
  "faq": [{"q": string, "a": string}],
  "seo_title": string,
  "seo_description": string,
  "why_choose": [{"label": string}],
  "services_title": string,
  "services_sub": string,
  "gallery_title": string,
  "gallery_sub": string,
  "reviews_title": string,
  "reviews_sub": string,
  "cta_text": string
}

Rules: short sentences, no fake awards or invented years, stay true to Memory facts, match DNA tone/personality.`;
}

export function parseWebsiteAiJson(raw: string): Partial<HublyWebsiteCopy> | null {
  try {
    const cleaned = raw.replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
    const g = JSON.parse(cleaned);
    return {
      heroHeadline: Array.isArray(g.hero_headline_options) && g.hero_headline_options[0]
        ? String(g.hero_headline_options[0])
        : undefined,
      heroHeadlineOptions: Array.isArray(g.hero_headline_options)
        ? g.hero_headline_options.map(String)
        : undefined,
      heroSub: g.hero_subhead != null ? String(g.hero_subhead) : undefined,
      about: g.about != null ? String(g.about) : undefined,
      faq: Array.isArray(g.faq)
        ? g.faq.map((x: { q?: string; a?: string }) => ({ q: String(x.q || ""), a: String(x.a || "") }))
        : undefined,
      seoTitle: g.seo_title != null ? String(g.seo_title) : undefined,
      seoDescription: g.seo_description != null ? String(g.seo_description) : undefined,
      whyChoose: Array.isArray(g.why_choose)
        ? g.why_choose.map((x: { label?: string }) => ({ label: String(x.label || "") }))
        : undefined,
      servicesTitle: g.services_title != null ? String(g.services_title) : undefined,
      servicesSub: g.services_sub != null ? String(g.services_sub) : undefined,
      galleryTitle: g.gallery_title != null ? String(g.gallery_title) : undefined,
      gallerySub: g.gallery_sub != null ? String(g.gallery_sub) : undefined,
      reviewsTitle: g.reviews_title != null ? String(g.reviews_title) : undefined,
      reviewsSub: g.reviews_sub != null ? String(g.reviews_sub) : undefined,
      ctaText: g.cta_text != null ? String(g.cta_text) : undefined,
    };
  } catch {
    return null;
  }
}

export function mergeWebsiteCopy(
  base: HublyWebsiteCopy,
  patch: Partial<HublyWebsiteCopy> | null,
): HublyWebsiteCopy {
  if (!patch) return base;
  return {
    heroHeadline: patch.heroHeadline || base.heroHeadline,
    heroHeadlineOptions: patch.heroHeadlineOptions?.length
      ? patch.heroHeadlineOptions
      : base.heroHeadlineOptions,
    heroSub: patch.heroSub || base.heroSub,
    about: patch.about || base.about,
    faq: patch.faq?.length ? patch.faq : base.faq,
    seoTitle: patch.seoTitle || base.seoTitle,
    seoDescription: patch.seoDescription || base.seoDescription,
    whyChoose: patch.whyChoose?.length ? patch.whyChoose : base.whyChoose,
    servicesTitle: patch.servicesTitle || base.servicesTitle,
    servicesSub: patch.servicesSub || base.servicesSub,
    galleryTitle: patch.galleryTitle || base.galleryTitle,
    gallerySub: patch.gallerySub || base.gallerySub,
    reviewsTitle: patch.reviewsTitle || base.reviewsTitle,
    reviewsSub: patch.reviewsSub || base.reviewsSub,
    ctaText: patch.ctaText || base.ctaText,
    accentColor: patch.accentColor || base.accentColor,
  };
}

export async function allocateUniqueSlug(
  client: SupabaseClient,
  preferred: string,
  excludeBusinessId?: string | null,
): Promise<string> {
  const base = slugifyBusinessName(preferred);
  for (let i = 0; i < 40; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const q = client.from("businesses").select("id").eq("slug", slug).maybeSingle();
    const { data } = await q;
    if (!data || (excludeBusinessId && data.id === excludeBusinessId)) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function publishBusinessWebsite(opts: {
  supabase: SupabaseClient;
  businessId?: string | null;
  ownerId?: string | null;
  memory: HublyBusinessMemoryInput;
  dna: HublyBusinessDNAInput;
  copy: HublyWebsiteCopy;
  usedAi?: boolean;
}): Promise<HublyPublishedWebsite> {
  const memory = normalizeBusinessMemory(opts.memory);
  const dna = normalizeBusinessDNA(opts.dna);
  const name = memory.name || "My Business";
  const services = servicesFromMemory(memory, dna);
  const serviceCatalog = { version: 1 as const, services };
  const website = websiteMetaFromCopy(opts.copy);
  const businessType = industryToBusinessType(memory.industry);
  const city = memory.city || memory.serviceArea?.cities?.[0] || null;
  const cities = memory.serviceArea?.cities?.length
    ? memory.serviceArea.cities
    : (city ? [city] : []);

  let businessId = opts.businessId || null;
  let slug: string;

  if (businessId) {
    slug = await allocateUniqueSlug(opts.supabase, memory.currentWebsite?.slug || name, businessId);
    const { data: existing } = await opts.supabase
      .from("businesses")
      .select("id, meta")
      .eq("id", businessId)
      .maybeSingle();
    if (!existing) throw new Error("Business not found");
    const prevMeta = (existing.meta && typeof existing.meta === "object")
      ? existing.meta as Record<string, unknown>
      : {};
    const meta = {
      ...prevMeta,
      website,
      service_catalog: serviceCatalog,
      businessType,
      businessProfile: {
        ...((prevMeta.businessProfile as object) || {}),
        businessName: name,
        industry: memory.industry || null,
        onboardingPriority: memory.onboardingPriority || null,
      },
    };
    const { error } = await opts.supabase.from("businesses").update({
      name,
      slug,
      business_type: businessType,
      phone: memory.phone || null,
      email: memory.email || null,
      city,
      service_area_cities: cities,
      about: opts.copy.about,
      brand_color: opts.copy.accentColor,
      tagline: opts.copy.heroSub.slice(0, 120),
      meta,
      gen_hero_headline: opts.copy.heroHeadlineOptions[0] || opts.copy.heroHeadline,
      gen_hero_headline_options: opts.copy.heroHeadlineOptions,
      gen_hero_subhead: opts.copy.heroSub,
      gen_about: opts.copy.about,
      gen_faq: opts.copy.faq,
      gen_seo_title: opts.copy.seoTitle,
      gen_seo_description: opts.copy.seoDescription,
      gen_why_choose: opts.copy.whyChoose,
    }).eq("id", businessId);
    if (error) throw new Error(error.message);
  } else {
    if (!opts.ownerId) throw new Error("ownerId required to create a business website");
    slug = await allocateUniqueSlug(opts.supabase, name);
    const meta = {
      website,
      service_catalog: serviceCatalog,
      businessType,
      businessProfile: {
        businessName: name,
        industry: memory.industry || null,
        onboardingPriority: memory.onboardingPriority || null,
      },
    };
    const { data, error } = await opts.supabase.from("businesses").insert({
      owner_id: opts.ownerId,
      name,
      slug,
      business_type: businessType,
      phone: memory.phone || null,
      email: memory.email || null,
      city,
      service_area_cities: cities,
      about: opts.copy.about,
      brand_color: opts.copy.accentColor,
      tagline: opts.copy.heroSub.slice(0, 120),
      meta,
      gen_hero_headline: opts.copy.heroHeadlineOptions[0] || opts.copy.heroHeadline,
      gen_hero_headline_options: opts.copy.heroHeadlineOptions,
      gen_hero_subhead: opts.copy.heroSub,
      gen_about: opts.copy.about,
      gen_faq: opts.copy.faq,
      gen_seo_title: opts.copy.seoTitle,
      gen_seo_description: opts.copy.seoDescription,
      gen_why_choose: opts.copy.whyChoose,
    }).select("id, slug").single();
    if (error) throw new Error(error.message);
    businessId = data.id;
    slug = data.slug;
  }

  return {
    businessId: businessId!,
    slug,
    publicPath: `/${slug}`,
    website,
    serviceCatalog,
    copy: opts.copy,
    usedAi: !!opts.usedAi,
  };
}

export function websitePromptBlocks(
  memory: HublyBusinessMemoryInput,
  dna: HublyBusinessDNAInput,
): string {
  return [
    formatBusinessMemory(memory),
    "",
    formatBusinessDNA(dna),
    "",
    "Write the website as a visual expression of DNA using only Memory facts.",
  ].join("\n");
}

export const HublyWebsiteRuntime = {
  slugify: slugifyBusinessName,
  industryToBusinessType,
  defaultServicesForIndustry,
  buildCopy: buildWebsiteCopyFromMemoryDna,
  websiteMetaFromCopy,
  systemPrompt: websiteBuilderSystemPrompt,
  parseAi: parseWebsiteAiJson,
  mergeCopy: mergeWebsiteCopy,
  allocateUniqueSlug,
  publish: publishBusinessWebsite,
  promptBlocks: websitePromptBlocks,
};

export default HublyWebsiteRuntime;
