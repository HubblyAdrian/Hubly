/**
 * Hubly Campaign Engine — marketing knowledge + structured Campaign Plans / Briefs.
 *
 * Layers:
 *   Business Context → Campaign Engine → Recommendation Engine → Project Workspace
 *
 * AI is the writer, not the strategist. Strategy comes from playbooks.
 * Memory (facts) and DNA (identity) stay separate in plan inputs.
 * Canva is a renderer — not part of this module.
 */

import {
  buildCampaignBrief,
  V1_PUBLISH_CHANNEL,
  type CampaignBrief,
} from "./hubly_studio_campaign_brief.ts";

export type { CampaignBrief };
export { V1_PUBLISH_CHANNEL };

export type CampaignChannel =
  | "instagram"
  | "facebook"
  | "google_business"
  | "email"
  | "sms"
  | "print";

export type CampaignGoalId =
  | "get_more_reviews"
  | "fill_tomorrow_schedule"
  | "promote_service"
  | "win_back_customers"
  | "seasonal_promotion"
  | "membership_drive"
  | "book_more_jobs"
  | "referral";

export type IndustryId =
  | "home_services"
  | "pressure_washing"
  | "hvac"
  | "plumbing"
  | "photography"
  | "landscaping"
  | "detailing"
  | "cleaning";

export type RequiredAssetKey =
  | "logo"
  | "before_after"
  | "job_photos"
  | "review"
  | "offer"
  | "coupon"
  | "video"
  | "membership_details"
  | "service_list"
  | "hours"
  | "phone"
  | "address";

export type CampaignPackage = {
  captions: { channel: CampaignChannel; text: string }[];
  headlines: string[];
  hashtags: string[];
  email: { subject: string; body: string };
  sms: string;
  google_business_post: string;
  schedule_suggestions: string[];
};

/** Structured plan — source of truth before AI expands copy/visuals. */
export type CampaignPlan = {
  playbook_id: string;
  goal_id: CampaignGoalId | string;
  industry_id: IndustryId | string;
  title: string;
  objective: string;
  channels: CampaignChannel[];
  required_assets: { key: RequiredAssetKey; required: boolean; notes?: string }[];
  messaging_strategy: string;
  cta: string;
  timing: {
    season: string;
    month: number;
    suggest_at: string;
    schedule_hints: string[];
  };
  template_refs: { source: "hubly" | "canva"; id: string }[];
  offer: { type: string; summary: string };
  audience: string;
  ai_brief: string;
  business_inputs: Record<string, unknown>;
  dna_inputs: Record<string, unknown>;
  package: CampaignPackage;
  trigger_id?: string | null;
};

export type BusinessCampaignContext = {
  industry?: string | null;
  business_name?: string | null;
  city?: string | null;
  services?: string[];
  phone?: string | null;
  offer_summary?: string | null;
  completed_jobs_week?: number;
  open_slots_tomorrow?: number;
  days_since_facebook_post?: number | null;
  days_since_gbp_update?: number | null;
  latest_review?: { stars?: number; quote?: string; author?: string } | null;
  job_photos_count?: number;
  has_before_after?: boolean;
  has_logo?: boolean;
  has_membership?: boolean;
  /** Interpretive — from DNA, never mixed into Memory */
  dna?: {
    tone?: string | null;
    brand_personality?: string | null;
    ideal_customer?: string | null;
  } | null;
  now?: Date;
  goal_id?: string | null;
  playbook_id?: string | null;
  service_focus?: string | null;
};

type PlaybookSeed = {
  id: string;
  industry_id: string;
  goal_id: string;
  title: string;
  season: string;
  audience: string;
  channels: CampaignChannel[];
  offer_type: string;
  cta: string;
  messaging_strategy: string;
  /** @deprecated Prefer prompt_template — kept for older call sites */
  ai_prompt: string;
  /**
   * Writer template — may ONLY reference Campaign Brief schema placeholders.
   * Never open-ended strategy ("come up with a marketing campaign").
   */
  prompt_template: string;
  template_refs: { source: "hubly" | "canva"; id: string }[];
  priority: number;
  assets: { key: RequiredAssetKey; required: boolean; notes?: string }[];
};

const DEFAULT_PROMPT_TEMPLATE =
  "Write {channel} copy for the {campaign} campaign for {business_name}. Goal: {goal}. Tone: {tone}. Service: {service_name}. Offer: {offer}. Review: {review_text}. CTA: {cta}. Use only these facts; do not invent a new campaign.";

function withPrompt(seed: Omit<PlaybookSeed, "prompt_template"> & { prompt_template?: string }): PlaybookSeed {
  return {
    ...seed,
    prompt_template: seed.prompt_template || DEFAULT_PROMPT_TEMPLATE,
  };
}

const GOALS: { id: CampaignGoalId; label: string; description: string }[] = [
  { id: "get_more_reviews", label: "Get More Reviews", description: "Turn happy customers into public social proof." },
  { id: "fill_tomorrow_schedule", label: "Fill Tomorrow's Schedule", description: "Convert open capacity into booked jobs fast." },
  { id: "promote_service", label: "Promote a Service", description: "Feature a specific offer (e.g. ceramic coatings)." },
  { id: "win_back_customers", label: "Win Back Old Customers", description: "Re-engage past customers who have gone quiet." },
  { id: "seasonal_promotion", label: "Seasonal Promotion", description: "Ride the calendar with timely local offers." },
  { id: "membership_drive", label: "Membership Drive", description: "Grow recurring memberships and maintenance plans." },
  { id: "book_more_jobs", label: "Book More Jobs", description: "General demand generation for core services." },
  { id: "referral", label: "Referral Campaign", description: "Ask happy customers to send neighbors your way." },
];

const INDUSTRY_ALIASES: Record<string, IndustryId> = {
  "pressure washing": "pressure_washing",
  "pressure wash": "pressure_washing",
  "power washing": "pressure_washing",
  softwash: "pressure_washing",
  hvac: "hvac",
  heating: "hvac",
  cooling: "hvac",
  plumbing: "plumbing",
  plumber: "plumbing",
  photography: "photography",
  photographer: "photography",
  landscaping: "landscaping",
  "lawn care": "landscaping",
  detailing: "detailing",
  "mobile detailing": "detailing",
  "auto detailing": "detailing",
  cleaning: "cleaning",
  "home services": "home_services",
};

/** Embedded catalog mirrors SQL seed — used when DB rows are unavailable. */
const _PLAYBOOK_SEEDS: Array<Omit<PlaybookSeed, "prompt_template"> & { prompt_template?: string }> = [
  // ── Detailing-first (V1 success metric: mobile detailer) ──
  {
    id: "dt_review_spotlight",
    industry_id: "detailing",
    goal_id: "get_more_reviews",
    title: "Review Spotlight",
    season: "any",
    audience: "existing_customers",
    channels: ["email", "instagram", "facebook"],
    offer_type: "none",
    cta: "Book your detail",
    messaging_strategy: "Lead with the customer quote; thank them; invite neighbors.",
    ai_prompt: DEFAULT_PROMPT_TEMPLATE,
    prompt_template: DEFAULT_PROMPT_TEMPLATE,
    template_refs: [{ source: "hubly", id: "review_highlight" }],
    priority: 100,
    assets: [
      { key: "review", required: true },
      { key: "logo", required: true },
    ],
  },
  {
    id: "dt_before_after",
    industry_id: "detailing",
    goal_id: "book_more_jobs",
    title: "Before & After Reveal",
    season: "any",
    audience: "local_prospects",
    channels: ["email", "instagram", "facebook"],
    offer_type: "none",
    cta: "Book this detail",
    messaging_strategy: "Side-by-side proof; short outcome headline; soft CTA.",
    ai_prompt: DEFAULT_PROMPT_TEMPLATE,
    prompt_template: DEFAULT_PROMPT_TEMPLATE,
    template_refs: [{ source: "hubly", id: "before_after" }],
    priority: 95,
    assets: [
      { key: "before_after", required: true },
      { key: "logo", required: true },
    ],
  },
  {
    id: "dt_fill_schedule",
    industry_id: "detailing",
    goal_id: "fill_tomorrow_schedule",
    title: "Open Slots Tomorrow",
    season: "any",
    audience: "local_prospects",
    channels: ["email", "sms"],
    offer_type: "percent_off",
    cta: "Claim a slot",
    messaging_strategy: "Urgency without panic; limited openings tomorrow.",
    ai_prompt: DEFAULT_PROMPT_TEMPLATE,
    prompt_template: DEFAULT_PROMPT_TEMPLATE,
    template_refs: [{ source: "hubly", id: "seasonal_offer" }],
    priority: 90,
    assets: [
      { key: "offer", required: true },
      { key: "phone", required: true },
    ],
  },
  {
    id: "dt_ceramic",
    industry_id: "detailing",
    goal_id: "promote_service",
    title: "Promote Ceramic Coatings",
    season: "any",
    audience: "local_prospects",
    channels: ["email", "instagram"],
    offer_type: "none",
    cta: "Ask about ceramic",
    messaging_strategy: "Name ceramic coating; one benefit; proof; clear CTA.",
    ai_prompt: DEFAULT_PROMPT_TEMPLATE,
    prompt_template: DEFAULT_PROMPT_TEMPLATE,
    template_refs: [{ source: "hubly", id: "seasonal_offer" }],
    priority: 88,
    assets: [
      { key: "logo", required: true },
      { key: "job_photos", required: false },
    ],
  },
  {
    id: "dt_win_back",
    industry_id: "detailing",
    goal_id: "win_back_customers",
    title: "Win Back Past Customers",
    season: "any",
    audience: "past_customers",
    channels: ["email", "sms"],
    offer_type: "percent_off",
    cta: "Book your return detail",
    messaging_strategy: "Warm, personal; exclusive win-back offer.",
    ai_prompt: DEFAULT_PROMPT_TEMPLATE,
    prompt_template: DEFAULT_PROMPT_TEMPLATE,
    template_refs: [{ source: "hubly", id: "membership_promotion" }],
    priority: 85,
    assets: [{ key: "offer", required: true }],
  },
  {
    id: "dt_seasonal",
    industry_id: "detailing",
    goal_id: "seasonal_promotion",
    title: "Seasonal Detail Special",
    season: "any",
    audience: "local_prospects",
    channels: ["email", "instagram"],
    offer_type: "percent_off",
    cta: "Book seasonal special",
    messaging_strategy: "Seasonal timing; curb appeal / paint protection framing.",
    ai_prompt: DEFAULT_PROMPT_TEMPLATE,
    prompt_template: DEFAULT_PROMPT_TEMPLATE,
    template_refs: [{ source: "hubly", id: "seasonal_offer" }],
    priority: 80,
    assets: [
      { key: "logo", required: true },
      { key: "offer", required: false },
    ],
  },
  {
    id: "hs_review_spotlight",
    industry_id: "home_services",
    goal_id: "get_more_reviews",
    title: "Review Spotlight",
    season: "any",
    audience: "existing_customers",
    channels: ["email", "instagram", "facebook", "google_business"],
    offer_type: "none",
    cta: "Leave a review",
    messaging_strategy: "Lead with the customer quote; keep branding quiet; one clear review CTA.",
    ai_prompt: DEFAULT_PROMPT_TEMPLATE,
    template_refs: [{ source: "hubly", id: "review_highlight" }],
    priority: 100,
    assets: [
      { key: "review", required: true },
      { key: "logo", required: true },
    ],
  },
  {
    id: "hs_before_after",
    industry_id: "home_services",
    goal_id: "book_more_jobs",
    title: "Before & After Highlight",
    season: "any",
    audience: "local_prospects",
    channels: ["email", "instagram", "facebook", "google_business"],
    offer_type: "none",
    cta: "Book this service",
    messaging_strategy: "Side-by-side proof; short outcome headline; soft CTA.",
    ai_prompt: DEFAULT_PROMPT_TEMPLATE,
    template_refs: [{ source: "hubly", id: "before_after" }],
    priority: 95,
    assets: [
      { key: "before_after", required: true },
      { key: "logo", required: true },
    ],
  },
  {
    id: "hs_fill_schedule",
    industry_id: "home_services",
    goal_id: "fill_tomorrow_schedule",
    title: "Open Slots Tomorrow",
    season: "any",
    audience: "local_prospects",
    channels: ["email", "facebook", "instagram", "sms", "google_business"],
    offer_type: "percent_off",
    cta: "Claim a slot",
    messaging_strategy: "Urgency without panic; limited openings; same-day or next-day focus.",
    ai_prompt: DEFAULT_PROMPT_TEMPLATE,
    template_refs: [{ source: "hubly", id: "seasonal_offer" }],
    priority: 90,
    assets: [
      { key: "offer", required: true },
      { key: "phone", required: true },
    ],
  },
  {
    id: "hs_win_back",
    industry_id: "home_services",
    goal_id: "win_back_customers",
    title: "We Miss You",
    season: "any",
    audience: "past_customers",
    channels: ["email", "sms", "facebook"],
    offer_type: "percent_off",
    cta: "Book your return visit",
    messaging_strategy: "Warm, personal; reference last service season; exclusive win-back offer.",
    ai_prompt: DEFAULT_PROMPT_TEMPLATE,
    template_refs: [{ source: "hubly", id: "membership_promotion" }],
    priority: 85,
    assets: [{ key: "offer", required: true }],
  },
  {
    id: "hs_referral",
    industry_id: "home_services",
    goal_id: "referral",
    title: "Referral Rewards",
    season: "any",
    audience: "existing_customers",
    channels: ["email", "sms", "instagram", "print"],
    offer_type: "referral_reward",
    cta: "Refer a neighbor",
    messaging_strategy: "Thank existing customers; make the reward crystal clear.",
    ai_prompt: DEFAULT_PROMPT_TEMPLATE,
    template_refs: [{ source: "hubly", id: "referral_campaign" }],
    priority: 80,
    assets: [
      { key: "offer", required: true },
      { key: "logo", required: true },
    ],
  },
  {
    id: "hs_membership",
    industry_id: "home_services",
    goal_id: "membership_drive",
    title: "Membership Drive",
    season: "any",
    audience: "existing_customers",
    channels: ["email", "facebook", "instagram", "google_business"],
    offer_type: "membership",
    cta: "Join the plan",
    messaging_strategy: "Benefits over price; peace of mind; what members get each year.",
    ai_prompt: DEFAULT_PROMPT_TEMPLATE,
    template_refs: [{ source: "hubly", id: "membership_promotion" }],
    priority: 75,
    assets: [{ key: "membership_details", required: true }],
  },
  {
    id: "hs_holiday",
    industry_id: "home_services",
    goal_id: "seasonal_promotion",
    title: "Holiday Campaign",
    season: "holiday",
    audience: "local_prospects",
    channels: ["instagram", "facebook", "email", "google_business"],
    offer_type: "percent_off",
    cta: "Book for the holidays",
    messaging_strategy: "Seasonal warmth; gift-of-service framing; deadline for holiday week.",
    ai_prompt: DEFAULT_PROMPT_TEMPLATE,
    template_refs: [{ source: "hubly", id: "holiday_campaign" }],
    priority: 70,
    assets: [
      { key: "logo", required: true },
      { key: "offer", required: false },
    ],
  },
  {
    id: "hs_promote_service",
    industry_id: "home_services",
    goal_id: "promote_service",
    title: "Service Spotlight",
    season: "any",
    audience: "local_prospects",
    channels: ["instagram", "facebook", "google_business", "email"],
    offer_type: "none",
    cta: "Learn more / Book",
    messaging_strategy: "Name the service; proof; one benefit; clear CTA.",
    ai_prompt: DEFAULT_PROMPT_TEMPLATE,
    template_refs: [{ source: "hubly", id: "seasonal_offer" }],
    priority: 88,
    assets: [
      { key: "logo", required: true },
      { key: "job_photos", required: false },
      { key: "offer", required: false },
    ],
  },
  {
    id: "pw_spring_clean",
    industry_id: "pressure_washing",
    goal_id: "seasonal_promotion",
    title: "Spring Cleaning",
    season: "spring",
    audience: "local_prospects",
    channels: ["instagram", "facebook", "google_business", "email"],
    offer_type: "percent_off",
    cta: "Book spring cleaning",
    messaging_strategy: "Fresh start; curb appeal; luxury spring cleaning tone.",
    ai_prompt: DEFAULT_PROMPT_TEMPLATE,
    template_refs: [{ source: "hubly", id: "seasonal_offer" }],
    priority: 100,
    assets: [
      { key: "offer", required: true },
      { key: "logo", required: true },
      { key: "before_after", required: false },
    ],
  },
  {
    id: "hvac_summer_tune",
    industry_id: "hvac",
    goal_id: "seasonal_promotion",
    title: "Summer Tune-Up",
    season: "summer",
    audience: "existing_customers",
    channels: ["email", "sms", "facebook", "google_business"],
    offer_type: "percent_off",
    cta: "Book tune-up",
    messaging_strategy: "Comfort + bill savings; book before heat wave.",
    ai_prompt: DEFAULT_PROMPT_TEMPLATE,
    template_refs: [{ source: "hubly", id: "seasonal_offer" }],
    priority: 100,
    assets: [{ key: "offer", required: true }],
  },
  {
    id: "photo_holiday_family",
    industry_id: "photography",
    goal_id: "seasonal_promotion",
    title: "Holiday Family Photos",
    season: "holiday",
    audience: "local_prospects",
    channels: ["instagram", "facebook", "email"],
    offer_type: "none",
    cta: "Reserve your spot",
    messaging_strategy: "Warm family moments; card-ready images; book early.",
    ai_prompt: DEFAULT_PROMPT_TEMPLATE,
    template_refs: [{ source: "hubly", id: "holiday_campaign" }],
    priority: 95,
    assets: [{ key: "job_photos", required: true }],
  },
];

export const EMBEDDED_PLAYBOOKS: PlaybookSeed[] = _PLAYBOOK_SEEDS.map(withPrompt);

type TriggerSeed = {
  id: string;
  playbook_id: string;
  goal_id: string;
  title: string;
  rule_kind: string;
  threshold: number;
  priority: number;
};

const EMBEDDED_TRIGGERS: TriggerSeed[] = [
  {
    id: "trig_no_fb_7",
    playbook_id: "hs_fill_schedule",
    goal_id: "fill_tomorrow_schedule",
    title: "No Facebook post for 7 days",
    rule_kind: "no_facebook_post_days",
    threshold: 7,
    priority: 80,
  },
  {
    id: "trig_jobs_10",
    playbook_id: "hs_before_after",
    goal_id: "book_more_jobs",
    title: "10+ completed jobs this week",
    rule_kind: "completed_jobs_week",
    threshold: 10,
    priority: 90,
  },
  {
    id: "trig_review_5",
    playbook_id: "hs_review_spotlight",
    goal_id: "get_more_reviews",
    title: "New 5-star review",
    rule_kind: "new_five_star_review",
    threshold: 1,
    priority: 100,
  },
  {
    id: "trig_gbp_30",
    playbook_id: "hs_before_after",
    goal_id: "book_more_jobs",
    title: "No Google Business update 30 days",
    rule_kind: "no_gbp_update_days",
    threshold: 30,
    priority: 85,
  },
  {
    id: "trig_open_tomorrow",
    playbook_id: "hs_fill_schedule",
    goal_id: "fill_tomorrow_schedule",
    title: "Open slots tomorrow",
    rule_kind: "open_slots_tomorrow",
    threshold: 1,
    priority: 95,
  },
];

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

export function listCampaignGoals() {
  return GOALS.slice();
}

export function normalizeIndustry(raw?: string | null): IndustryId {
  if (!raw) return "detailing"; // V1 success metric: mobile detailer
  const key = String(raw).trim().toLowerCase();
  if ((Object.values(INDUSTRY_ALIASES) as string[]).includes(key)) return key as IndustryId;
  for (const [alias, id] of Object.entries(INDUSTRY_ALIASES)) {
    if (key.includes(alias)) return id;
  }
  if (/detail/.test(key)) return "detailing";
  return "home_services";
}

function seasonForMonth(month: number): string {
  return MONTH_SEASON[month] || "any";
}

function findPlaybook(
  playbooks: PlaybookSeed[],
  opts: { id?: string | null; goal_id?: string | null; industry_id: string; season: string },
): PlaybookSeed {
  if (opts.id) {
    const hit = playbooks.find((p) => p.id === opts.id);
    if (hit) return hit;
  }
  const byGoalIndustry = playbooks
    .filter(
      (p) =>
        (!opts.goal_id || p.goal_id === opts.goal_id) &&
        (p.industry_id === opts.industry_id || p.industry_id === "home_services"),
    )
    .sort((a, b) => {
      const aInd = a.industry_id === opts.industry_id ? 0 : 1;
      const bInd = b.industry_id === opts.industry_id ? 0 : 1;
      if (aInd !== bInd) return aInd - bInd;
      const aSeason = a.season === opts.season || a.season === "any" ? 0 : 1;
      const bSeason = b.season === opts.season || b.season === "any" ? 0 : 1;
      if (aSeason !== bSeason) return aSeason - bSeason;
      return b.priority - a.priority;
    });
  return byGoalIndustry[0] || playbooks[0];
}

function evaluateTriggers(ctx: BusinessCampaignContext): TriggerSeed | null {
  const hits: TriggerSeed[] = [];
  for (const t of EMBEDDED_TRIGGERS) {
    if (t.rule_kind === "new_five_star_review" && (ctx.latest_review?.stars || 0) >= 5) {
      hits.push(t);
    }
    if (
      t.rule_kind === "completed_jobs_week" &&
      (ctx.completed_jobs_week || 0) >= t.threshold
    ) {
      hits.push(t);
    }
    if (
      t.rule_kind === "open_slots_tomorrow" &&
      (ctx.open_slots_tomorrow || 0) >= t.threshold
    ) {
      hits.push(t);
    }
    if (
      t.rule_kind === "no_facebook_post_days" &&
      ctx.days_since_facebook_post != null &&
      ctx.days_since_facebook_post >= t.threshold
    ) {
      hits.push(t);
    }
    if (
      t.rule_kind === "no_gbp_update_days" &&
      ctx.days_since_gbp_update != null &&
      ctx.days_since_gbp_update >= t.threshold
    ) {
      hits.push(t);
    }
  }
  hits.sort((a, b) => b.priority - a.priority);
  return hits[0] || null;
}

function buildPackage(plan: {
  title: string;
  cta: string;
  biz: string;
  city: string;
  offer: string;
  review?: { quote?: string; author?: string } | null;
  service?: string | null;
  channels: CampaignChannel[];
  phone?: string | null;
}): CampaignPackage {
  const service = plan.service || "our services";
  const loc = plan.city ? ` in ${plan.city}` : "";
  const offerBit = plan.offer ? ` ${plan.offer}` : "";
  const reviewLine = plan.review?.quote
    ? `"${plan.review.quote}"${plan.review.author ? ` — ${plan.review.author}` : ""}`
    : "";

  const captionBase = reviewLine
    ? `${reviewLine}\n\nThank you for trusting ${plan.biz}${loc}. ${plan.cta}!`
    : `${plan.biz}${loc}: ${plan.title}.${offerBit} ${plan.cta}.`;

  const captions = plan.channels
    .filter((c) => c === "instagram" || c === "facebook")
    .map((channel) => ({ channel, text: captionBase }));

  return {
    captions,
    headlines: [
      plan.title,
      `${plan.biz} — ${service}`,
      offerBit.trim() ? `${offerBit.trim()} · ${plan.cta}` : plan.cta,
    ].filter(Boolean),
    hashtags: [
      "#LocalBusiness",
      "#HomeServices",
      "#HublyStudio",
      plan.city ? `#${plan.city.replace(/\s+/g, "")}` : "#YourCity",
    ],
    email: {
      subject: `${plan.title} from ${plan.biz}`,
      body: `Hi there,\n\n${captionBase}\n\n${plan.phone ? `Call or text ${plan.phone}.\n\n` : ""}— ${plan.biz}`,
    },
    sms: `${plan.biz}: ${plan.title}.${offerBit} ${plan.cta}${plan.phone ? ` ${plan.phone}` : ""}`.slice(
      0,
      160,
    ),
    google_business_post: `${plan.title}${offerBit}. Serving customers${loc}. ${plan.cta}.`,
    schedule_suggestions: [
      "Tomorrow 12:00 PM — peak local engagement window",
      "Thursday 9:00 AM — catch early planners",
      "Saturday 10:00 AM — weekend DIY audience",
    ],
  };
}

/**
 * Build a structured Campaign Plan from knowledge + business context.
 * Does not call LLMs — returns the plan object AI/copy layers consume next.
 */
export function buildCampaignPlan(
  ctx: BusinessCampaignContext,
  playbooks: PlaybookSeed[] = EMBEDDED_PLAYBOOKS,
): CampaignPlan {
  const now = ctx.now || new Date();
  const month = now.getMonth() + 1;
  const season = seasonForMonth(month);
  const industry_id = normalizeIndustry(ctx.industry);

  let trigger = null as TriggerSeed | null;
  let playbook_id = ctx.playbook_id || null;
  let goal_id = ctx.goal_id || null;

  if (!playbook_id && !goal_id) {
    trigger = evaluateTriggers(ctx);
    if (trigger) {
      playbook_id = trigger.playbook_id;
      goal_id = trigger.goal_id;
    }
  }
  if (!goal_id) goal_id = "book_more_jobs";

  const playbook = findPlaybook(playbooks, {
    id: playbook_id,
    goal_id,
    industry_id,
    season,
  });

  const biz = ctx.business_name || "Your business";
  const city = ctx.city || "";
  const offer = ctx.offer_summary || "";
  const title =
    playbook.goal_id === "promote_service" && ctx.service_focus
      ? `Promote ${ctx.service_focus}`
      : playbook.title;

  const business_inputs: Record<string, unknown> = {
    business_name: biz,
    city: city || null,
    industry: industry_id,
    services: ctx.services || [],
    phone: ctx.phone || null,
    offer_summary: offer || null,
    completed_jobs_week: ctx.completed_jobs_week ?? 0,
    open_slots_tomorrow: ctx.open_slots_tomorrow ?? 0,
    job_photos_count: ctx.job_photos_count ?? 0,
    has_before_after: !!ctx.has_before_after,
    has_logo: ctx.has_logo !== false,
    has_membership: !!ctx.has_membership,
    latest_review: ctx.latest_review || null,
    service_focus: ctx.service_focus || null,
  };

  const dna_inputs: Record<string, unknown> = {
    tone: ctx.dna?.tone || null,
    brand_personality: ctx.dna?.brand_personality || null,
    ideal_customer: ctx.dna?.ideal_customer || null,
  };

  const package_ = buildPackage({
    title,
    cta: playbook.cta,
    biz,
    city,
    offer,
    review: ctx.latest_review,
    service: ctx.service_focus || (ctx.services && ctx.services[0]),
    channels: playbook.channels,
    phone: ctx.phone,
  });

  const toneNote = ctx.dna?.tone ? ` Tone: ${ctx.dna.tone}.` : "";
  // Writer brief — filled from playbook prompt_template (Brief schema only). No strategic invention.
  const ai_brief = [
    `Campaign: ${title}`,
    `Playbook: ${playbook.id}`,
    `Goal: ${playbook.goal_id}`,
    `Industry: ${industry_id}`,
    `Audience: ${playbook.audience}`,
    `Business: ${biz}${city ? ` (${city})` : ""}`,
    offer ? `Offer: ${offer}` : null,
    ctx.service_focus ? `Service focus: ${ctx.service_focus}` : null,
    ctx.latest_review?.quote ? `Review: ${ctx.latest_review.quote}` : null,
    `CTA: ${playbook.cta}`,
    `Writer: ${playbook.prompt_template || playbook.ai_prompt}${toneNote}`,
    "Use only the facts above. Do not invent a new campaign type.",
  ]
    .filter(Boolean)
    .join("\n");

  // V1 primary channel is email — ensure package always has email copy
  const channels = playbook.channels.includes("email")
    ? playbook.channels
    : (["email", ...playbook.channels] as CampaignChannel[]);

  return {
    playbook_id: playbook.id,
    goal_id: playbook.goal_id,
    industry_id,
    title,
    objective: GOALS.find((g) => g.id === playbook.goal_id)?.description || playbook.messaging_strategy,
    channels,
    required_assets: playbook.assets,
    messaging_strategy: playbook.messaging_strategy,
    cta: playbook.cta,
    timing: {
      season: playbook.season === "any" ? season : playbook.season,
      month,
      suggest_at: now.toISOString(),
      schedule_hints: package_.schedule_suggestions,
    },
    template_refs: playbook.template_refs,
    offer: {
      type: playbook.offer_type,
      summary: offer || (playbook.offer_type === "none" ? "" : playbook.offer_type),
    },
    audience: playbook.audience,
    ai_brief,
    business_inputs,
    dna_inputs,
    package: package_,
    trigger_id: trigger?.id || null,
  };
}

export function suggestCampaigns(
  ctx: BusinessCampaignContext,
  limit = 6,
): { goal_id: string; playbook_id: string; title: string; reason: string; priority: number }[] {
  const industry_id = normalizeIndustry(ctx.industry);
  const now = ctx.now || new Date();
  const season = seasonForMonth(now.getMonth() + 1);
  const trigger = evaluateTriggers(ctx);
  const out: { goal_id: string; playbook_id: string; title: string; reason: string; priority: number }[] = [];

  if (trigger) {
    const pb = EMBEDDED_PLAYBOOKS.find((p) => p.id === trigger.playbook_id);
    if (pb) {
      out.push({
        goal_id: trigger.goal_id,
        playbook_id: pb.id,
        title: pb.title,
        reason: trigger.title,
        priority: trigger.priority + 50,
      });
    }
  }

  for (const pb of EMBEDDED_PLAYBOOKS) {
    if (pb.industry_id !== industry_id && pb.industry_id !== "home_services") continue;
    if (out.some((x) => x.playbook_id === pb.id)) continue;
    const seasonalBoost = pb.season === season || pb.season === "any" ? 10 : 0;
    out.push({
      goal_id: pb.goal_id,
      playbook_id: pb.id,
      title: pb.title,
      reason: pb.season === season ? `In season (${season})` : "Proven playbook for your trade",
      priority: pb.priority + seasonalBoost + (pb.industry_id === industry_id ? 20 : 0),
    });
  }

  return out.sort((a, b) => b.priority - a.priority).slice(0, limit);
}

export function hublyTemplateCatalog() {
  return [
    { id: "before_after", title: "Before & After", category: "proof", format: "instagram_post", source: "hubly" },
    { id: "review_highlight", title: "Review Highlight", category: "social", format: "instagram_post", source: "hubly" },
    { id: "membership_promotion", title: "Membership Promotion", category: "growth", format: "facebook_post", source: "hubly" },
    { id: "holiday_campaign", title: "Holiday Campaign", category: "seasonal", format: "instagram_post", source: "hubly" },
    { id: "referral_campaign", title: "Referral Campaign", category: "growth", format: "print_flyer", source: "hubly" },
    { id: "seasonal_offer", title: "Seasonal Offer", category: "seasonal", format: "instagram_post", source: "hubly" },
  ];
}

/** Map a Campaign Plan → Campaign Brief for the AI Writer (V1 contract). */
export function planToCampaignBrief(
  plan: CampaignPlan,
  opts?: { logo_url?: string | null; photo_url?: string | null },
): CampaignBrief {
  const goalLabel = GOALS.find((g) => g.id === plan.goal_id)?.label || String(plan.goal_id);
  const playbook = EMBEDDED_PLAYBOOKS.find((p) => p.id === plan.playbook_id);
  return buildCampaignBrief({
    campaign: plan.title,
    goal: goalLabel,
    tone: (plan.dna_inputs.tone as string) || "Professional",
    offer: plan.offer.summary || null,
    business_name: String(plan.business_inputs.business_name || "Your business"),
    service_name: (plan.business_inputs.service_focus as string) ||
      (Array.isArray(plan.business_inputs.services) && (plan.business_inputs.services as string[])[0]) ||
      null,
    cta: plan.cta,
    playbook_id: plan.playbook_id,
    prompt_template: playbook?.prompt_template || DEFAULT_PROMPT_TEMPLATE,
    review_text: (plan.business_inputs.latest_review as { quote?: string } | null)?.quote || null,
    assets: {
      review: (plan.business_inputs.latest_review as { quote?: string } | null)?.quote || null,
      logo: opts?.logo_url || null,
      photo: opts?.photo_url || null,
    },
  });
}

