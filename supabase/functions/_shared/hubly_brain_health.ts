/**
 * Hubly — Business Health (first AI-owned metric)
 *
 * One score Hubly Coach can optimize.
 * Foundation: derive from Memory facts + DNA readiness.
 * Living Business will refresh this daily from real outcomes.
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

export type HublyBusinessHealth = {
  version: 1;
  overall: number;
  deltaWeek: number | null;
  dimensions: HublyHealthDimension[];
  summary: string;
  updatedAt: string;
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Score business health from Memory facts + DNA readiness.
 * New builds start strong on setup dimensions; revenue/reviews grow over time.
 */
export function assessBusinessHealth(opts?: {
  memory?: HublyBusinessMemoryInput | null;
  dna?: HublyBusinessDNAInput | null;
  previousOverall?: number | null;
}): HublyBusinessHealth {
  const memory = normalizeBusinessMemory(opts?.memory);
  const dna = normalizeBusinessDNA(opts?.dna);

  const hasSite = !!(memory.currentWebsite?.published || memory.currentWebsite?.slug);
  const hasCrm = !!(memory.currentCrm && (memory.currentCrm.pipeline || memory.currentCrm.customerCount != null));
  const hasBooking = !!(memory.extras && typeof memory.extras === "object" &&
    (memory.extras as Record<string, unknown>).bookingFlow);
  const hasServices = !!(memory.services?.length);
  const hasBrand = !!(dna.brand.personality?.length || memory.brandVoice);
  const customerCount = Number(memory.currentCrm?.customerCount || 0);

  const revenue = clamp(
    (hasServices ? 40 : 10) +
      (hasBooking ? 25 : 0) +
      (hasSite ? 15 : 0) +
      Math.min(20, customerCount * 4),
  );
  const bookings = clamp(
    (hasBooking ? 55 : 15) + (hasServices ? 20 : 0) + (hasSite ? 15 : 0),
  );
  const marketing = clamp(
    (hasSite ? 45 : 10) +
      (hasBrand ? 25 : 0) +
      (dna.marketing.channels?.length ? 20 : 5) +
      (dna.pricing.tier === "premium" || dna.pricing.tier === "luxury" ? 10 : 0),
  );
  const reviews = clamp(
    35 + (customerCount > 0 ? Math.min(40, customerCount * 5) : 0) + (hasSite ? 15 : 0),
  );
  const retention = clamp(
    40 + (hasCrm ? 25 : 0) + (dna.goals.some((g) => g.kind === "repeat") ? 20 : 5) +
      Math.min(15, customerCount * 2),
  );
  const operations = clamp(
    (hasCrm ? 30 : 10) +
      (hasBooking ? 30 : 0) +
      (hasServices ? 20 : 0) +
      (memory.extras && (memory.extras as Record<string, unknown>).dashboard ? 20 : 5),
  );

  const dimensions: HublyHealthDimension[] = [
    { id: "revenue", label: "Revenue", score: revenue, note: hasServices ? "Services priced" : "Add services" },
    { id: "bookings", label: "Bookings", score: bookings, note: hasBooking ? "Booking ready" : "Enable booking" },
    { id: "reviews", label: "Reviews", score: reviews, note: customerCount ? "Ask for reviews" : "Win first jobs" },
    { id: "marketing", label: "Marketing", score: marketing, note: hasSite ? "Site live" : "Publish site" },
    { id: "operations", label: "Operations", score: operations, note: hasCrm ? "CRM ready" : "Stand up CRM" },
    { id: "retention", label: "Customer Retention", score: retention, note: "Grow repeat customers" },
  ];

  const overall = clamp(
    dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length,
  );
  const deltaWeek = opts?.previousOverall != null
    ? overall - opts.previousOverall
    : hasSite
    ? 6
    : null;

  return {
    version: 1,
    overall,
    deltaWeek,
    dimensions,
    summary: hasSite
      ? "Your business foundation is healthy — Coach will optimize from here."
      : "Finish launch surfaces to unlock a stronger Health score.",
    updatedAt: new Date().toISOString(),
  };
}

export const HublyBusinessHealthApi = { assess: assessBusinessHealth };
export default HublyBusinessHealthApi;
