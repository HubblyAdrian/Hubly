/**
 * Studio Recommendation Engine (V1).
 * May only use Hubly-owned data via Business Context + internal calendar/playbooks.
 * No weather, competitors, local events, attribution, or revenue predictions.
 */

import type { StudioBusinessContext } from "./hubly_studio_business_context.ts";

export type StudioRecommendation = {
  playbook_id: string;
  goal_id: string;
  title: string;
  reason: string;
  priority: number;
  channel: "email";
};

type PlaybookRef = {
  id: string;
  goal_id: string;
  title: string;
  industry_id: string;
  season: string;
  priority: number;
};

const MONTH_SEASON: Record<number, string> = {
  1: "winter",
  2: "winter",
  3: "spring",
  4: "spring",
  5: "spring",
  6: "summer",
  7: "summer",
  8: "summer",
  9: "fall",
  10: "fall",
  11: "fall",
  12: "holiday",
};

/** Detailing-first + shared home-service playbooks for V1 recommendations. */
export const V1_RECOMMENDATION_PLAYBOOKS: PlaybookRef[] = [
  {
    id: "dt_review_spotlight",
    goal_id: "get_more_reviews",
    title: "Review Spotlight",
    industry_id: "detailing",
    season: "any",
    priority: 100,
  },
  {
    id: "dt_before_after",
    goal_id: "book_more_jobs",
    title: "Before & After Reveal",
    industry_id: "detailing",
    season: "any",
    priority: 95,
  },
  {
    id: "dt_fill_schedule",
    goal_id: "fill_tomorrow_schedule",
    title: "Open Slots Tomorrow",
    industry_id: "detailing",
    season: "any",
    priority: 90,
  },
  {
    id: "dt_ceramic",
    goal_id: "promote_service",
    title: "Promote Ceramic Coatings",
    industry_id: "detailing",
    season: "any",
    priority: 88,
  },
  {
    id: "dt_win_back",
    goal_id: "win_back_customers",
    title: "Win Back Past Customers",
    industry_id: "detailing",
    season: "any",
    priority: 85,
  },
  {
    id: "dt_seasonal",
    goal_id: "seasonal_promotion",
    title: "Seasonal Detail Special",
    industry_id: "detailing",
    season: "any",
    priority: 80,
  },
  {
    id: "hs_review_spotlight",
    goal_id: "get_more_reviews",
    title: "Review Spotlight",
    industry_id: "home_services",
    season: "any",
    priority: 70,
  },
  {
    id: "hs_before_after",
    goal_id: "book_more_jobs",
    title: "Before & After Highlight",
    industry_id: "home_services",
    season: "any",
    priority: 65,
  },
];

function scoreFromContext(
  ctx: StudioBusinessContext,
  pb: PlaybookRef,
): { priority: number; reason: string } | null {
  const season = MONTH_SEASON[ctx.season_month] || "any";
  let priority = pb.priority;
  let reason = "Proven playbook for your business";

  const industryMatch =
    pb.industry_id === ctx.industry || pb.industry_id === "home_services";
  if (!industryMatch) return null;
  if (pb.industry_id === ctx.industry) priority += 25;

  if (pb.season === season || pb.season === "any") {
    if (pb.season === season) {
      priority += 15;
      reason = `In season (${season})`;
    }
  } else {
    priority -= 20;
  }

  // Owned-data triggers only
  if (
    pb.goal_id === "get_more_reviews" &&
    ctx.latest_review &&
    ctx.latest_review.stars >= 5
  ) {
    priority += 50;
    reason = "New 5-star review ready to spotlight";
  }
  if (pb.goal_id === "book_more_jobs" && ctx.has_before_after) {
    priority += 40;
    reason = "Before/after job photos available";
  }
  if (pb.goal_id === "book_more_jobs" && ctx.completed_jobs_week >= 3) {
    priority += 20;
    reason = `${ctx.completed_jobs_week} jobs completed this week — share the proof`;
  }
  if (pb.goal_id === "fill_tomorrow_schedule" && ctx.open_slots_tomorrow >= 1) {
    priority += 45;
    reason = "Open capacity tomorrow";
  }
  if (
    pb.goal_id === "fill_tomorrow_schedule" &&
    ctx.days_since_last_studio_publish != null &&
    ctx.days_since_last_studio_publish >= 7
  ) {
    priority += 30;
    reason = "No Studio publish in 7+ days";
  }
  if (pb.goal_id === "promote_service" && ctx.service_focus) {
    priority += 35;
    reason = `Promote ${ctx.service_focus}`;
  }
  if (
    pb.goal_id === "promote_service" &&
    ctx.services.some((s) => /ceramic|coating/i.test(s))
  ) {
    priority += 25;
    reason = "Ceramic / coating service in your catalog";
  }
  if (pb.goal_id === "win_back_customers" && ctx.active_promotions.length) {
    priority += 15;
    reason = "Active promotion ready for win-back";
  }
  if (pb.goal_id === "seasonal_promotion" && ctx.active_promotions.length) {
    priority += 10;
    reason = "Existing promotion + seasonal window";
  }

  return { priority, reason };
}

/**
 * Rank recommendations from Business Context + internal playbooks only.
 */
export function recommendCampaigns(
  ctx: StudioBusinessContext,
  limit = 5,
): StudioRecommendation[] {
  const scored: StudioRecommendation[] = [];
  for (const pb of V1_RECOMMENDATION_PLAYBOOKS) {
    const hit = scoreFromContext(ctx, pb);
    if (!hit) continue;
    scored.push({
      playbook_id: pb.id,
      goal_id: pb.goal_id,
      title: pb.title,
      reason: hit.reason,
      priority: hit.priority,
      channel: "email",
    });
  }
  scored.sort((a, b) => b.priority - a.priority);
  // Dedupe by goal — one best per goal
  const seen = new Set<string>();
  const out: StudioRecommendation[] = [];
  for (const r of scored) {
    if (seen.has(r.goal_id)) continue;
    seen.add(r.goal_id);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}
