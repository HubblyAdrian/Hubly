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
import {
  assessBusinessHealth,
  type HublyBusinessHealth,
  type HublyHealthOutcomes,
} from "./hubly_brain_health.ts";
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
    paymentsWaiting?: number;
    followUpsWaiting?: number;
    outcomes?: HublyHealthOutcomes | null;
  } | null;
}): HublyDailyBriefing {
  const memory = normalizeBusinessMemory(opts?.memory);
  const dna = normalizeBusinessDNA(opts?.dna);
  const stats = opts?.stats || {};
  const outcomes = stats.outcomes || null;
  const health = opts?.health || assessBusinessHealth({ memory, dna, outcomes });
  const maturity = opts?.maturity || maturityProfile(dna.growthStage);
  const biz = memory.name || "your business";
  const owner = opts?.ownerName || null;
  const jobsToday = Number(stats.jobsToday ?? 0);
  const leads = Number(stats.newLeads ?? 0);
  const reviews = Number(stats.reviewRequestsReady ?? 0);
  const paymentsWaiting = Number(stats.paymentsWaiting ?? 0);
  const followUps = Number(stats.followUpsWaiting ?? reviews);
  const visitors = Number(stats.visitorsYesterday ?? 0);
  const customers = Number(memory.currentCrm?.customerCount ?? 0);

  const happening: HublyDailyItem[] = [];
  happening.push({
    id: "jobs",
    kind: "fact",
    text: jobsToday > 0
      ? `${jobsToday} job${jobsToday === 1 ? "" : "s"} on today's schedule`
      : "No jobs on today's schedule yet",
  });
  happening.push({
    id: "leads",
    kind: leads > 0 ? "alert" : "fact",
    text: leads > 0
      ? `${leads} outstanding lead${leads === 1 ? "" : "s"} waiting`
      : "No outstanding leads",
  });
  happening.push({
    id: "payments",
    kind: paymentsWaiting > 0 ? "alert" : "fact",
    text: paymentsWaiting > 0
      ? `${paymentsWaiting} payment${paymentsWaiting === 1 ? "" : "s"} still waiting`
      : "No payments waiting",
  });
  happening.push({
    id: "followups",
    kind: followUps > 0 ? "action" : "fact",
    text: followUps > 0
      ? `${followUps} customer${followUps === 1 ? "" : "s"} awaiting follow-up / review`
      : "No customers awaiting follow-up",
  });
  if (visitors > 0) {
    happening.push({
      id: "traffic",
      kind: "fact",
      text: `Your website had ${visitors} visitor${visitors === 1 ? "" : "s"} yesterday`,
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

  // Recommendation — one move that improves a Health metric
  let recommendation = {
    title: "Share your booking link today",
    detail:
      "A short text to past clients fills next week faster than a campaign. Improves booking rate.",
  };
  const payDim = health.dimensions.find((d) => d.id === "payments");
  const reviewsDim = health.dimensions.find((d) => d.id === "reviews");
  const responseDim = health.dimensions.find((d) => d.id === "response");
  if (leads > 0) {
    recommendation = {
      title: `Reply to ${leads} outstanding lead${leads === 1 ? "" : "s"}`,
      detail: "Accept or message them first — response time improves Business Health.",
    };
  } else if (paymentsWaiting > 0 || (payDim && payDim.score < 60)) {
    recommendation = {
      title: "Collect waiting payments",
      detail: "Close the loop on completed work so payment success and revenue move up.",
    };
  } else if (followUps > 0 || (reviewsDim && reviewsDim.score < 70 && customers > 0)) {
    recommendation = {
      title: "Ask for a review",
      detail: "Completed jobs without a review request leave reputation (and repeats) on the table.",
    };
  } else if (responseDim && responseDim.score < 55) {
    recommendation = {
      title: "Accept new hires faster",
      detail: "Faster replies lift response time and booking rate on your next customer.",
    };
  } else if (!memory.currentWebsite?.slug) {
    recommendation = {
      title: "Finish launching your website",
      detail: "Your site is the front door — customers hire you there.",
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
    detail: leads > 0
      ? "I'll keep new hire requests visible here and send appointment reminders for today's and tomorrow's jobs."
      : memory.currentWebsite?.slug
      ? "I'll send appointment reminders and keep bookings, CRM, and reviews aligned as customers hire you."
      : "I'll finish shaping your website so you're ready for your first customer.",
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
