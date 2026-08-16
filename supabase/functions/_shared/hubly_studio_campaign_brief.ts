/**
 * Campaign Brief — structured output of the Campaign Engine for the AI Writer.
 *
 * Prompt template rule (V1 frozen):
 * prompt_template must only reference fields defined in this schema.
 * It must never contain open-ended strategic instructions.
 * Strategy is owned exclusively by the Campaign Engine.
 */

/** V1 publish channel — Email only. Multi-provider later. */
export const V1_PUBLISH_CHANNEL = "email" as const;

export type CampaignBriefAssets = {
  review: string | null;
  logo: string | null;
  photo: string | null;
};

/**
 * Canonical Campaign Brief schema.
 * Placeholders allowed in prompt_template: keys of this object + nested asset keys.
 */
export type CampaignBrief = {
  campaign: string;
  goal: string;
  channel: typeof V1_PUBLISH_CHANNEL;
  /** NULL when Business DNA has no tone. Never invent one — it silently sets
   *  the brand voice of everything generated downstream. */
  tone: string | null;
  offer: string | null;
  /** NULL when the business has no name on record. Never a placeholder. */
  business_name: string | null;
  service_name: string | null;
  review_text: string | null;
  cta: string;
  playbook_id: string;
  assets: CampaignBriefAssets;
  /** Filled template — writer-ready; no strategic invention */
  prompt_template: string;
};

/** Allowed placeholder names for playbook prompt_template strings. */
export const CAMPAIGN_BRIEF_PLACEHOLDERS = [
  "campaign",
  "goal",
  "channel",
  "tone",
  "offer",
  "business_name",
  "service_name",
  "review_text",
  "cta",
  "playbook_id",
  "logo",
  "photo",
  "review",
] as const;

const PLACEHOLDER_RE = /\{([a-z_]+)\}/gi;

/**
 * Reject prompt templates that introduce open-ended strategy or unknown fields.
 */
export function validatePromptTemplate(template: string): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const lower = template.toLowerCase();
  const banned = [
    "come up with",
    "invent a campaign",
    "create a marketing campaign",
    "think of a",
    "decide the strategy",
    "choose the best campaign",
    "figure out what to promote",
  ];
  for (const b of banned) {
    if (lower.includes(b)) {
      errors.push(`prompt_template must not contain strategic instruction: "${b}"`);
    }
  }
  const allowed = new Set(CAMPAIGN_BRIEF_PLACEHOLDERS.map((p) => p.toLowerCase()));
  let m: RegExpExecArray | null;
  const re = new RegExp(PLACEHOLDER_RE.source, "gi");
  while ((m = re.exec(template)) !== null) {
    const key = m[1].toLowerCase();
    if (!allowed.has(key)) {
      errors.push(`Unknown placeholder {${m[1]}} — not in Campaign Brief schema`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/** Rendered into a prompt slot we genuinely cannot fill. Deliberately not a
 *  plausible value: a writer must never mistake it for a real business fact. */
export const UNKNOWN_SLOT = "(not provided — do not invent one)";

export function fillPromptTemplate(
  template: string,
  brief: Omit<CampaignBrief, "prompt_template">,
): string {
  const map: Record<string, string> = {
    campaign: brief.campaign,
    goal: brief.goal,
    channel: brief.channel,
    // An unknown slot renders as an explicit marker, not as a fake value and
    // not as an empty string that reads like a typo. The writer is told the
    // fact is missing so it can work around it instead of inventing one.
    tone: brief.tone || UNKNOWN_SLOT,
    offer: brief.offer || "",
    business_name: brief.business_name || UNKNOWN_SLOT,
    service_name: brief.service_name || "",
    review_text: brief.review_text || brief.assets.review || "",
    cta: brief.cta,
    playbook_id: brief.playbook_id,
    logo: brief.assets.logo || "",
    photo: brief.assets.photo || "",
    review: brief.assets.review || "",
  };
  return template.replace(PLACEHOLDER_RE, (_, key: string) => {
    const v = map[key.toLowerCase()];
    return v == null ? "" : v;
  });
}

export function buildCampaignBrief(input: {
  campaign: string;
  goal: string;
  tone?: string | null;
  offer?: string | null;
  business_name: string | null;
  service_name?: string | null;
  cta: string;
  playbook_id: string;
  prompt_template: string;
  assets?: Partial<CampaignBriefAssets>;
  review_text?: string | null;
}): CampaignBrief {
  const assets: CampaignBriefAssets = {
    review: input.assets?.review ?? input.review_text ?? null,
    logo: input.assets?.logo ?? null,
    photo: input.assets?.photo ?? null,
  };
  const base: Omit<CampaignBrief, "prompt_template"> = {
    campaign: input.campaign,
    goal: input.goal,
    channel: V1_PUBLISH_CHANNEL,
    tone: input.tone || null,
    offer: input.offer ?? null,
    business_name: input.business_name,
    service_name: input.service_name ?? null,
    review_text: input.review_text ?? assets.review,
    cta: input.cta,
    playbook_id: input.playbook_id,
    assets,
  };
  const check = validatePromptTemplate(input.prompt_template);
  const safeTemplate = check.ok
    ? input.prompt_template
    : "Write {channel} copy for {campaign} for {business_name}. Tone: {tone}. CTA: {cta}. Use only the facts provided; do not invent a new campaign type.";
  return {
    ...base,
    prompt_template: fillPromptTemplate(safeTemplate, base),
  };
}
