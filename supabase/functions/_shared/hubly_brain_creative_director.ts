/**
 * Phase 8 — AI Creative Director rationales
 *
 * Hubly doesn't just generate pages — it explains its thinking.
 * Rationales are derived from Business DNA + Memory facts.
 * Not a new Brain layer — a capability surface on Website Runtime.
 */

import {
  normalizeBusinessMemory,
  type HublyBusinessMemoryInput,
} from "./hubly_brain_memory.ts";
import {
  normalizeBusinessDNA,
  type HublyBusinessDNAInput,
} from "./hubly_brain_dna.ts";

export type HublyCreativeRationale = {
  id: string;
  title: string;
  detail: string;
};

export type HublyCreativeDirectorBrief = {
  version: 1;
  headline: string;
  intro: string;
  rationales: HublyCreativeRationale[];
  closing: string;
};

/** Explain design decisions like a creative director — never “template applied.” */
export function buildCreativeDirectorBrief(opts?: {
  memory?: HublyBusinessMemoryInput | null;
  dna?: HublyBusinessDNAInput | null;
  copy?: {
    heroHeadline?: string | null;
    accentColor?: string | null;
    ctaText?: string | null;
  } | null;
}): HublyCreativeDirectorBrief {
  const memory = normalizeBusinessMemory(opts?.memory);
  const dna = normalizeBusinessDNA(opts?.dna);
  const name = memory.name || "your business";
  const ideal = dna.customerProfile.idealCustomer || "local homeowners";
  const tier = (dna.pricing.tier || "").toLowerCase();
  const personality = (dna.brand.personality || dna.personality.traits || []).filter(Boolean);
  const tone = dna.brand.preferredTone || dna.personality.preferredTone || "warm and trustworthy";
  const accent = opts?.copy?.accentColor || memory.currentWebsite?.accentColor || "#D9632D";
  const focus = dna.services.idealJobs?.[0] || dna.services.focus?.[0] ||
    memory.services?.[0]?.name || null;
  const advantage = dna.identity.competitiveAdvantage || null;
  const rationales: HublyCreativeRationale[] = [];

  rationales.push({
    id: "audience",
    title: "Who you're speaking to",
    detail: `I noticed you're targeting ${ideal}. Every screen is written for them — not a generic audience.`,
  });

  if (tier === "premium" || tier === "luxury" || /premium|luxury|white.?glove|careful/.test(
    `${ideal} ${personality.join(" ")}`.toLowerCase(),
  )) {
    rationales.push({
      id: "palette",
      title: "Color & presence",
      detail:
        `I'm using a refined palette (${accent}) so the site feels premium — quiet confidence, not loud discount energy.`,
    });
  } else if (tier === "budget") {
    rationales.push({
      id: "palette",
      title: "Color & presence",
      detail:
        `I'm keeping the look clear and approachable (${accent}) so value and trust land first.`,
    });
  } else {
    rationales.push({
      id: "palette",
      title: "Color & presence",
      detail:
        `Accent ${accent} keeps the brand recognizable while staying clean for local service trust.`,
    });
  }

  if (advantage || /convenience|come to you|mobile|easy|flexible/.test(
    `${dna.identity.mission || ""} ${advantage || ""}`.toLowerCase(),
  )) {
    rationales.push({
      id: "headline",
      title: "Headline emphasis",
      detail:
        `Your headline leans into convenience and ease — a major buying factor for ${ideal}.`,
    });
  } else if (opts?.copy?.heroHeadline) {
    rationales.push({
      id: "headline",
      title: "Headline emphasis",
      detail:
        `“${String(opts.copy.heroHeadline).replace(/\n/g, " ").slice(0, 80)}” leads with how customers should feel when they hire ${name}.`,
    });
  } else {
    rationales.push({
      id: "headline",
      title: "Headline emphasis",
      detail:
        `The first screen leads with clarity and trust — what ${name} does and why it matters.`,
    });
  }

  if (focus) {
    const popular = memory.services?.find((s) => s.popular)?.name || focus;
    rationales.push({
      id: "services",
      title: "What I highlighted",
      detail:
        `I highlighted ${popular} because it matches your focus${
          dna.pricing.tier === "premium" || dna.pricing.tier === "luxury"
            ? " and supports a higher-margin story"
            : ""
        }.`,
    });
  }

  if (personality.length) {
    rationales.push({
      id: "voice",
      title: "Voice",
      detail:
        `Tone stays ${tone} — personality: ${personality.slice(0, 3).join(", ")}. No generic template voice.`,
    });
  } else {
    rationales.push({
      id: "voice",
      title: "Voice",
      detail: `Copy stays ${tone} so ${name} sounds like a real local pro, not a brochure.`,
    });
  }

  return {
    version: 1,
    headline: "How I designed this",
    intro: `Here's my creative direction for ${name} — based on who you are, not a template.`,
    rationales: rationales.slice(0, 5),
    closing: "Tell me what to change in plain English — I'll restyle from there.",
  };
}

export const HublyCreativeDirector = { buildBrief: buildCreativeDirectorBrief };
export default HublyCreativeDirector;
