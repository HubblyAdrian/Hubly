/**
 * Hubly — Business Maturity (not a new Brain layer)
 *
 * Lives as DNA.growthStage. Adapts which capabilities feel right
 * and how Coach / Living Business behave — without inventing architecture.
 *
 * Stages: Idea → Launching → Growing → Scaling → Multi-location → Enterprise
 */

import {
  evolveBusinessDNA,
  normalizeBusinessDNA,
  type HublyBusinessDNA,
  type HublyBusinessDNAInput,
} from "./hubly_brain_dna.ts";
import type { HublyBusinessMemoryInput } from "./hubly_brain_memory.ts";
import { normalizeBusinessMemory } from "./hubly_brain_memory.ts";
import type { HublyCapabilityId } from "./hubly_brain_capabilities.ts";

export const HUBLY_MATURITY_STAGES = [
  "idea",
  "launching",
  "growing",
  "scaling",
  "multi_location",
  "enterprise",
] as const;

export type HublyMaturityStage = (typeof HUBLY_MATURITY_STAGES)[number];

export type HublyMaturityProfile = {
  stage: HublyMaturityStage;
  label: string;
  summary: string;
  /** Capabilities that should stay simple / preferred at this stage */
  preferCapabilities: HublyCapabilityId[];
  /** Capabilities that unlock as the business matures */
  unlockCapabilities: HublyCapabilityId[];
  coachFocus: string[];
};

const LABELS: Record<HublyMaturityStage, string> = {
  idea: "Idea",
  launching: "Launching",
  growing: "Growing",
  scaling: "Scaling",
  multi_location: "Multi-location",
  enterprise: "Enterprise",
};

const PROFILES: Record<HublyMaturityStage, Omit<HublyMaturityProfile, "stage" | "label">> = {
  idea: {
    summary: "Validate the offer — simple brand, site, and booking.",
    preferCapabilities: ["understanding", "branding", "website", "booking", "domain"],
    unlockCapabilities: [],
    coachFocus: ["Clarify ideal customer", "Publish a simple site", "Get first bookings"],
  },
  launching: {
    summary: "Simple website, CRM, pricing — go live without complexity.",
    preferCapabilities: [
      "understanding", "branding", "website", "booking", "crm", "payments", "domain", "marketplace", "dashboard",
    ],
    unlockCapabilities: [],
    coachFocus: ["First customers", "Reviews", "Confirm domain", "Simple pricing"],
  },
  growing: {
    summary: "Fill the calendar — marketing, reviews, retention.",
    preferCapabilities: [
      "website", "booking", "crm", "marketing", "coaching", "marketplace", "dashboard",
    ],
    unlockCapabilities: ["marketing", "quotes"],
    coachFocus: ["Raise review volume", "Fill slow days", "Refine pricing", "Repeat customers"],
  },
  scaling: {
    summary: "Hiring, routes, automation, advanced reporting.",
    preferCapabilities: ["crm", "booking", "dashboard", "coaching", "calendar", "marketing"],
    unlockCapabilities: ["calendar", "quotes", "payments"],
    coachFocus: ["Hiring plan", "Route efficiency", "Team coaching", "Automation"],
  },
  multi_location: {
    summary: "Multi-site ops — shared DNA, local Memory facts.",
    preferCapabilities: ["crm", "dashboard", "coaching", "marketing", "calendar"],
    unlockCapabilities: ["calendar", "marketing"],
    coachFocus: ["Location consistency", "Local SEO", "Manager playbooks"],
  },
  enterprise: {
    summary: "Systems of record + autonomous growth loops.",
    preferCapabilities: ["coaching", "dashboard", "crm", "marketing"],
    unlockCapabilities: ["marketing", "calendar", "quotes"],
    coachFocus: ["Org-wide Health", "Brand standards", "Autonomous growth"],
  },
};

/** Normalize legacy / free-form stage strings into the canonical set. */
export function normalizeMaturityStage(raw?: string | null): HublyMaturityStage {
  const s = String(raw || "").toLowerCase().trim().replace(/[-\s]+/g, "_");
  if (!s) return "launching";
  if (s === "just_started" || s === "startup" || s === "new") return "launching";
  if (s === "started" || s === "early") return "growing";
  if (s === "multi-location" || s === "multilocation" || s === "multi_loc") return "multi_location";
  if ((HUBLY_MATURITY_STAGES as readonly string[]).includes(s)) return s as HublyMaturityStage;
  if (/scale|hiring|fleet/.test(s)) return "scaling";
  if (/grow/.test(s)) return "growing";
  if (/idea|concept|planning/.test(s)) return "idea";
  if (/enterprise|corp/.test(s)) return "enterprise";
  return "launching";
}

export function maturityProfile(stage?: string | null): HublyMaturityProfile {
  const st = normalizeMaturityStage(stage);
  const p = PROFILES[st];
  return {
    stage: st,
    label: LABELS[st],
    summary: p.summary,
    preferCapabilities: [...p.preferCapabilities],
    unlockCapabilities: [...p.unlockCapabilities],
    coachFocus: [...p.coachFocus],
  };
}

/** Infer maturity from Memory facts + DNA — interpretive, stored on DNA.growthStage. */
export function inferMaturity(opts?: {
  memory?: HublyBusinessMemoryInput | null;
  dna?: HublyBusinessDNAInput | null;
}): HublyMaturityProfile {
  const memory = normalizeBusinessMemory(opts?.memory);
  const dna = normalizeBusinessDNA(opts?.dna);
  if (dna.growthStage) return maturityProfile(dna.growthStage);
  if (memory.businessStage) return maturityProfile(memory.businessStage);

  const hasSite = !!(memory.currentWebsite?.slug || memory.currentWebsite?.published);
  const customers = Number(memory.currentCrm?.customerCount || 0);
  const goals = dna.goals.map((g) => g.kind);

  if (!memory.name && !hasSite) return maturityProfile("idea");
  if (goals.includes("hire") || goals.includes("expand")) return maturityProfile("scaling");
  if (customers >= 25 || (hasSite && customers >= 5)) return maturityProfile("growing");
  return maturityProfile("launching");
}

/** Write normalized stage onto DNA (identity) — never into Memory facts blob as strategy. */
export function applyMaturityToDNA(
  dna?: HublyBusinessDNAInput | null,
  stage?: string | null,
): HublyBusinessDNA {
  const profile = maturityProfile(stage || normalizeBusinessDNA(dna).growthStage);
  return evolveBusinessDNA(dna, {
    growthStage: profile.stage,
    source: "system",
  });
}

export const HublyMaturity = {
  stages: HUBLY_MATURITY_STAGES,
  normalize: normalizeMaturityStage,
  profile: maturityProfile,
  infer: inferMaturity,
  applyToDNA: applyMaturityToDNA,
};

export default HublyMaturity;
