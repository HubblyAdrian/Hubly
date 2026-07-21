/**
 * Phase 8 — Hubly Daily (signature morning briefing)
 *
 * Owners land on advice, not charts.
 * "Good morning. Here's what I'd work on today."
 * Plus one thing Hubly will handle.
 */

import {
  normalizeBusinessMemory,
  type HublyBusinessMemoryInput,
} from "./hubly_brain_memory.ts";
import {
  normalizeBusinessDNA,
  type HublyBusinessDNAInput,
} from "./hubly_brain_dna.ts";
import { assessBusinessHealth, type HublyBusinessHealth } from "./hubly_brain_health.ts";
import { maturityProfile, type HublyMaturityProfile } from "./hubly_brain_maturity.ts";

export type HublyDailyItem = {
  id: string;
  kind: "fact" | "action" | "alert";
  text: string;
};

export type HublyDailyBriefing = {
  version: 1;
  greeting: string;
  ownerName: string | null;
  businessName: string;
  happening: HublyDailyItem[];
  recommendation: {
    title: string;
    detail: string;
  };
  hublyWillHandle: {
    title: string;
    detail: string;
  };
  health: { overall: number; deltaWeek: number | null };
  maturity: { stage: string; label: string };
  generatedAt: string;
};

function greetWord(d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Build the Hubly Daily briefing — employee energy, not dashboard. */
export function buildHublyDaily(opts?: {
  memory?: HublyBusinessMemoryInput | null;
  dna?: HublyBusinessDNAInput | null;
  ownerName?: string | null;
  health?: HublyBusinessHealth | null;
  maturity?: HublyMaturityProfile | null;
  stats?: {
    jobsToday?: number;
    newLeads?: number;
    reviewRequestsReady?: number;
    visitorsYesterday?: number;
  } | null;
}): HublyDailyBriefing {
  const memory = normalizeBusinessMemory(opts?.memory);
  const dna = normalizeBusinessDNA(opts?.dna);
  const health = opts?.health || assessBusinessHealth({ memory, dna });
  const maturity = opts?.maturity || maturityProfile(dna.growthStage);
  const biz = memory.name || "your business";
  const owner = opts?.ownerName || null;
  const stats = opts?.stats || {};
  const jobsToday = Number(stats.jobsToday ?? 0);
  const leads = Number(stats.newLeads ?? 0);
  const reviews = Number(stats.reviewRequestsReady ?? 0);
  const visitors = Number(stats.visitorsYesterday ?? 0);
  const customers = Number(memory.currentCrm?.customerCount ?? 0);

  const happening: HublyDailyItem[] = [];
  happening.push({
    id: "jobs",
    kind: "fact",
    text: jobsToday > 0
      ? `${jobsToday} job${jobsToday === 1 ? "" : "s"} scheduled today`
      : "No jobs on the calendar yet — a quiet day to fill the pipeline",
  });
  happening.push({
    id: "leads",
    kind: leads > 0 ? "alert" : "fact",
    text: leads > 0
      ? `${leads} new lead${leads === 1 ? "" : "s"} waiting for a reply`
      : "No new leads waiting — Hubly is ready when they arrive",
  });
  happening.push({
    id: "reviews",
    kind: reviews > 0 ? "action" : "fact",
    text: reviews > 0
      ? `${reviews} review request${reviews === 1 ? "" : "s"} ready to send`
      : customers > 0
      ? "You can ask recent customers for reviews"
      : "Win a few jobs, then we'll ask for reviews",
  });
  if (visitors > 0 || memory.currentWebsite?.slug) {
    happening.push({
      id: "traffic",
      kind: "fact",
      text: visitors > 0
        ? `Your website had ${visitors} visitor${visitors === 1 ? "" : "s"} yesterday`
        : "Your website is live — share your link to start traffic",
    });
  }
  happening.push({
    id: "health",
    kind: "fact",
    text: `Business Health: ${health.overall}/100${
      health.deltaWeek != null
        ? ` (${health.deltaWeek >= 0 ? "+" : ""}${health.deltaWeek} this week)`
        : ""
    }`,
  });

  // Recommendation — Coach MVP: one clear move
  let recommendation = {
    title: "Confirm your domain",
    detail:
      "Customers trust yourbusiness.com more than a temporary link. Pick a suggestion and we'll wire DNS later.",
  };
  const marketing = health.dimensions.find((d) => d.id === "marketing");
  const reviewsDim = health.dimensions.find((d) => d.id === "reviews");
  const popular = memory.services?.find((s) => s.popular);
  if (popular?.price != null && (dna.pricing.tier === "premium" || dna.pricing.tier === "mid")) {
    recommendation = {
      title: `Raise your ${popular.name} package slightly`,
      detail:
        `Demand signals look strong for ${popular.name}. A careful bump protects margins without scaring off ${
          dna.customerProfile.idealCustomer || "your best customers"
        }.`,
    };
  } else if (reviewsDim && reviewsDim.score < 70 && customers > 0) {
    recommendation = {
      title: "Ask three customers for reviews",
      detail:
        "Reviews lift Business Health and help Customer Runtime match you to the right homeowners.",
    };
  } else if (marketing && marketing.score < 70) {
    recommendation = {
      title: "Share your booking link with past clients",
      detail:
        "A short text beats a campaign when you're launching. Fill next week's calendar first.",
    };
  } else if (maturity.stage === "launching" || maturity.stage === "idea") {
    recommendation = {
      title: "Complete your first three package photos",
      detail:
        "Owners with real work photos convert faster. I'll keep the site layout ready for them.",
    };
  }

  const hublyWillHandle = {
    title: "One thing I'll handle today",
    detail: memory.currentWebsite?.slug
      ? "I'll keep your homepage SEO and service highlights aligned with your Business DNA as details change."
      : "I'll finish shaping your website and marketplace profile so you're ready for your first customer.",
  };

  const greet = owner
    ? `${greetWord()}, ${owner}.`
    : `${greetWord()}.`;

  return {
    version: 1,
    greeting: greet,
    ownerName: owner,
    businessName: biz,
    happening: happening.slice(0, 6),
    recommendation,
    hublyWillHandle,
    health: { overall: health.overall, deltaWeek: health.deltaWeek },
    maturity: { stage: maturity.stage, label: maturity.label },
    generatedAt: new Date().toISOString(),
  };
}

export const HublyDaily = { build: buildHublyDaily };
export default HublyDaily;
