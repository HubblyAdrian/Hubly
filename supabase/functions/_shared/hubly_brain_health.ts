/**
 * Hubly — Business Health (first AI-owned metric)
 *
 * One score Hubly Coach can optimize.
 * Foundation: Memory + DNA readiness, then real hire outcomes
 * (leads → booking → payment → job → completion → review → repeat).
 */

import {
  normalizeBusinessMemory,
  type HublyBusinessMemoryInput,
} from "./hubly_brain_memory.ts";
import {
  normalizeBusinessDNA,
  type HublyBusinessDNAInput,
} from "./hubly_brain_dna.ts";

export type HublyHealthDimension = {
  id: string;
  label: string;
  score: number;
  note?: string | null;
};

/** Outcome rates from the First Customer / revenue loop (0–1 unless noted). */
export type HublyHealthOutcomes = {
  leadsCreated?: number;
  bookingRate?: number;
  paymentSuccessRate?: number;
  jobCompletionRate?: number;
  reviewRate?: number;
  repeatCustomerRate?: number;
  /** Dollars earned through Hubly (paid jobs). */
  revenue?: number;
  /** Average hours to accept a hire request; null when unknown. */
  responseTimeHours?: number | null;
};

export type HublyBusinessHealth = {
  version: 1;
  overall: number;
  deltaWeek: number | null;
  dimensions: HublyHealthDimension[];
  outcomes: HublyHealthOutcomes | null;
  summary: string;
  updatedAt: string;
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function rateScore(rate: number | undefined, empty: number): number {
  if (rate == null || !Number.isFinite(rate)) return empty;
  return clamp(rate * 100);
}

/**
 * Score business health from Memory facts + DNA readiness + hire outcomes.
 * New builds start strong on setup dimensions; revenue/reviews grow over time.
 */
export function assessBusinessHealth(opts?: {
  memory?: HublyBusinessMemoryInput | null;
  dna?: HublyBusinessDNAInput | null;
  previousOverall?: number | null;
  outcomes?: HublyHealthOutcomes | null;
}): HublyBusinessHealth {
  const memory = normalizeBusinessMemory(opts?.memory);
  const dna = normalizeBusinessDNA(opts?.dna);
  const outcomes = opts?.outcomes && typeof opts.outcomes === "object"
    ? opts.outcomes
    : null;

  const hasSite = !!(memory.currentWebsite?.published || memory.currentWebsite?.slug);
  const hasCrm = !!(memory.currentCrm && (memory.currentCrm.pipeline || memory.currentCrm.customerCount != null));
  const hasBooking = !!(memory.extras && typeof memory.extras === "object" &&
    (memory.extras as Record<string, unknown>).bookingFlow);
  const hasServices = !!(memory.services?.length);
  const hasBrand = !!(dna.brand.personality?.length || memory.brandVoice);
  const customerCount = Number(memory.currentCrm?.customerCount || 0);
  const leads = Number(outcomes?.leadsCreated ?? 0);
  const revenueDollars = Number(outcomes?.revenue ?? 0);

  let revenue = clamp(
    (hasServices ? 40 : 10) +
      (hasBooking ? 25 : 0) +
      (hasSite ? 15 : 0) +
      Math.min(20, customerCount * 4),
  );
  let bookings = clamp(
    (hasBooking ? 55 : 15) + (hasServices ? 20 : 0) + (hasSite ? 15 : 0),
  );
  let marketing = clamp(
    (hasSite ? 45 : 10) +
      (hasBrand ? 25 : 0) +
      (dna.marketing.channels?.length ? 20 : 5) +
      (dna.pricing.tier === "premium" || dna.pricing.tier === "luxury" ? 10 : 0),
  );
  let reviews = clamp(
    35 + (customerCount > 0 ? Math.min(40, customerCount * 5) : 0) + (hasSite ? 15 : 0),
  );
  let retention = clamp(
    40 + (hasCrm ? 25 : 0) + (dna.goals.some((g) => g.kind === "repeat") ? 20 : 5) +
      Math.min(15, customerCount * 2),
  );
  let operations = clamp(
    (hasCrm ? 30 : 10) +
      (hasBooking ? 30 : 0) +
      (hasServices ? 20 : 0) +
      (memory.extras && (memory.extras as Record<string, unknown>).dashboard ? 20 : 5),
  );

  // When hire outcomes exist, prefer them — Coach optimizes real money loops.
  if (outcomes) {
    if (outcomes.paymentSuccessRate != null || revenueDollars > 0) {
      revenue = clamp(
        rateScore(outcomes.paymentSuccessRate, 35) * 0.55 +
          Math.min(45, Math.log10(Math.max(1, revenueDollars + 1)) * 18),
      );
    }
    if (outcomes.bookingRate != null || leads > 0) {
      bookings = clamp(
        rateScore(outcomes.bookingRate, 40) * 0.7 +
          Math.min(30, leads * 3),
      );
    }
    if (outcomes.reviewRate != null) {
      reviews = rateScore(outcomes.reviewRate, reviews);
    }
    if (outcomes.repeatCustomerRate != null) {
      retention = rateScore(outcomes.repeatCustomerRate, retention);
    }
    if (outcomes.jobCompletionRate != null || outcomes.responseTimeHours != null) {
      const completion = rateScore(outcomes.jobCompletionRate, 50);
      const response =
        outcomes.responseTimeHours == null
          ? 55
          : clamp(100 - Math.min(70, Number(outcomes.responseTimeHours) * 8));
      operations = clamp(completion * 0.55 + response * 0.45);
    }
    marketing = clamp(
      marketing * 0.55 +
        rateScore(outcomes.bookingRate, 40) * 0.25 +
        rateScore(outcomes.reviewRate, 35) * 0.2,
    );
  }

  const dimensions: HublyHealthDimension[] = [
    {
      id: "revenue",
      label: "Revenue",
      score: revenue,
      note: revenueDollars > 0
        ? `$${Math.round(revenueDollars)} earned`
        : hasServices
        ? "Services priced"
        : "Add services",
    },
    {
      id: "bookings",
      label: "Bookings",
      score: bookings,
      note: outcomes?.bookingRate != null
        ? `${Math.round(outcomes.bookingRate * 100)}% booking rate`
        : hasBooking
        ? "Booking ready"
        : "Enable booking",
    },
    {
      id: "leads",
      label: "Leads",
      score: clamp(leads > 0 ? Math.min(95, 40 + leads * 6) : (hasSite ? 45 : 20)),
      note: leads > 0 ? `${leads} lead${leads === 1 ? "" : "s"} created` : "Awaiting first leads",
    },
    {
      id: "payments",
      label: "Payments",
      score: rateScore(outcomes?.paymentSuccessRate, hasBooking ? 50 : 25),
      note: outcomes?.paymentSuccessRate != null
        ? `${Math.round(outcomes.paymentSuccessRate * 100)}% paid`
        : "Track deposits & full payments",
    },
    {
      id: "completion",
      label: "Job completion",
      score: rateScore(outcomes?.jobCompletionRate, 40),
      note: outcomes?.jobCompletionRate != null
        ? `${Math.round(outcomes.jobCompletionRate * 100)}% completed`
        : "Complete jobs in Hubly",
    },
    {
      id: "reviews",
      label: "Reviews",
      score: reviews,
      note: outcomes?.reviewRate != null
        ? `${Math.round(outcomes.reviewRate * 100)}% review rate`
        : customerCount
        ? "Ask for reviews"
        : "Win first jobs",
    },
    {
      id: "retention",
      label: "Repeat customers",
      score: retention,
      note: outcomes?.repeatCustomerRate != null
        ? `${Math.round(outcomes.repeatCustomerRate * 100)}% repeat`
        : "Grow repeat customers",
    },
    {
      id: "response",
      label: "Response time",
      score: outcomes?.responseTimeHours == null
        ? clamp(hasBooking ? 55 : 30)
        : clamp(100 - Math.min(70, Number(outcomes.responseTimeHours) * 8)),
      note: outcomes?.responseTimeHours == null
        ? "Accept hires quickly"
        : `${Number(outcomes.responseTimeHours).toFixed(1)}h avg reply`,
    },
    {
      id: "marketing",
      label: "Marketing",
      score: marketing,
      note: hasSite ? "Site live" : "Publish site",
    },
    {
      id: "operations",
      label: "Operations",
      score: operations,
      note: hasCrm ? "CRM ready" : "Stand up CRM",
    },
  ];

  const overall = clamp(
    dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length,
  );
  const deltaWeek = opts?.previousOverall != null
    ? overall - opts.previousOverall
    : hasSite
    ? 6
    : null;

  let summary = hasSite
    ? "Your business foundation is healthy — Coach will optimize from here."
    : "Finish launch surfaces to unlock a stronger Health score.";
  if (outcomes && (leads > 0 || revenueDollars > 0)) {
    summary =
      "Health now tracks your hire loop — leads, bookings, payments, jobs, reviews, and repeats.";
  }

  return {
    version: 1,
    overall,
    deltaWeek,
    dimensions,
    outcomes: outcomes || null,
    summary,
    updatedAt: new Date().toISOString(),
  };
}

export const HublyBusinessHealthApi = { assess: assessBusinessHealth };
export default HublyBusinessHealthApi;
