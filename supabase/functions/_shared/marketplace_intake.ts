/**
 * AI Concierge v2 — experienced service advisor.
 * Understand → explain why → ask only gaps → confirm job → match.
 */

import {
  detectPreferences,
  durationForService,
  filterSmartFollowUps,
  mergePreferences,
  reasonForAddOn,
  reasonForService,
  timingLabel,
} from "./marketplace_industry_knowledge.ts";
import {
  buildAdvisorReply,
  buildConfirmationBullets,
  buildJobConfirmation,
  mergeJobUnderstanding,
  serviceTextFromJob,
  understandJobFromText,
  type JobConfirmation,
  type JobUnderstanding,
} from "./marketplace_job.ts";

const MODEL = "claude-haiku-4-5-20251001";

export type IntakeMessage = { role: "user" | "assistant"; content: string };

export type IntakeNeed = {
  category: string | null;
  service_text: string | null;
  city: string | null;
  when: string | null;
  residential: boolean | null;
  scope: string | null;
  notes: string | null;
  service: string | null;
  add_ons: string[];
  possible_add_ons: string[];
  priority: string | null;
  preferences: JobUnderstanding["preferences"];
  duration_estimate: string | null;
  vehicle_type: string | null;
};

export type IntakeResult = {
  reply: string;
  /** True when customer should see "Did we get this right?" before matching */
  ready_to_confirm: boolean;
  /** @deprecated use ready_to_confirm — kept false until client confirms */
  ready_to_match: boolean;
  confidence: number;
  need: IntakeNeed;
  job: JobUnderstanding;
  confirmation: JobConfirmation | null;
  follow_ups: string[];
  suggested_prompts?: string[];
};

function extractJson(rawText: string): string {
  const start = rawText.indexOf("{");
  const end = rawText.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return rawText;
  return rawText.slice(start, end + 1);
}

const SYSTEM = `You are Hubly's AI concierge v2 — an experienced local service advisor.
You educate and guide. You do NOT classify and dump. You are not a search engine.

Core rules:
1. UNDERSTAND the job (industry, service, add-ons, priority) from natural language.
2. RECOMMEND with a short WHY — educate, never hard-upsell.
   Bad: "We detected Interior Detail."
   Good: "Based on what you described, I'd recommend an Interior Detail with Odor Removal because smoke usually settles into the seats, carpet, and headliner."
3. Ask ONLY missing questions that change: which service, which provider, or which appointment. Max 2.
4. Soft preferences (budget, ASAP, premium, eco, mobile, weekend) — infer silently; never quiz for them.
5. When enough is known, set ready_to_confirm=true (customer will confirm before matching). Do NOT skip confirmation.
6. Booking language only — never "quotes" / "estimates".
7. Same conversation framework for every industry; only knowledge changes.

Example — "I just bought a used truck and it smells like smoke."
Infer detailing / Interior Detail / Odor Removal / Interior over Exterior.
Reply explains why, then only city or timing if missing.

Return ONLY valid JSON:
{
  "reply": "advisor recommendation with why + only missing questions",
  "ready_to_confirm": true|false,
  "confidence": 0.0-1.0,
  "job": {
    "industry": "Auto Detailing",
    "category": "detailing",
    "service": "Interior Detail",
    "add_ons": ["Odor Removal"],
    "possible_add_ons": ["Shampoo Extraction"],
    "priority": "Interior over Exterior",
    "vehicle_type": "truck"|null,
    "property_type": "residential"|"commercial"|null,
    "advisor_reason": "smoke usually settles into seats, carpet, and headliner",
    "add_on_reasons": {"Odor Removal": "smoke needs more than a vacuum and wipe-down"},
    "duration_estimate": "Estimated 3–5 hours",
    "understanding_summary": "...",
    "known": ["..."],
    "missing": ["What city is the truck in?"],
    "preferences": {
      "budget_conscious": false,
      "fastest_appointment": false,
      "premium_quality": false,
      "eco_friendly": false,
      "mobile_only": false,
      "weekend_preferred": false
    }
  },
  "need": {
    "category": "detailing",
    "service_text": "Interior Detail + Odor Removal (truck)",
    "city": null,
    "when": null,
    "residential": null,
    "scope": "interior",
    "notes": "smoke odor"
  },
  "follow_ups": ["short chips only for true gaps"]
}`;

function jobFromParsed(raw: unknown): Partial<JobUnderstanding> | null {
  if (!raw || typeof raw !== "object") return null;
  const j = raw as Record<string, unknown>;
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
  const prefsIn = (j.preferences && typeof j.preferences === "object"
    ? j.preferences
    : {}) as Record<string, unknown>;
  const reasonsIn = (j.add_on_reasons && typeof j.add_on_reasons === "object"
    ? j.add_on_reasons
    : {}) as Record<string, unknown>;
  const add_on_reasons: Record<string, string> = {};
  for (const [k, v] of Object.entries(reasonsIn)) {
    add_on_reasons[k] = String(v);
  }
  return {
    industry: j.industry != null ? String(j.industry) : null,
    category: j.category != null ? String(j.category) : null,
    service: j.service != null ? String(j.service) : null,
    add_ons: arr(j.add_ons),
    possible_add_ons: arr(j.possible_add_ons),
    priority: j.priority != null ? String(j.priority) : null,
    vehicle_type: j.vehicle_type != null ? String(j.vehicle_type) : null,
    property_type: j.property_type === "commercial"
      ? "commercial"
      : (j.property_type === "residential" ? "residential" : null),
    understanding_summary: j.understanding_summary != null
      ? String(j.understanding_summary)
      : null,
    known: arr(j.known),
    missing: arr(j.missing),
    advisor_reason: j.advisor_reason != null
      ? String(j.advisor_reason)
      : null,
    add_on_reasons,
    duration_estimate: j.duration_estimate != null ? String(j.duration_estimate) : null,
    preferences: {
      budget_conscious: !!prefsIn.budget_conscious,
      fastest_appointment: !!prefsIn.fastest_appointment,
      premium_quality: !!prefsIn.premium_quality,
      eco_friendly: !!prefsIn.eco_friendly,
      mobile_only: !!prefsIn.mobile_only,
      weekend_preferred: !!prefsIn.weekend_preferred,
    },
    confirmation_bullets: arr(j.confirmation_bullets),
  };
}

function finalizeJob(job: JobUnderstanding, allUser: string, cityHint?: string | null): JobUnderstanding {
  const prefs = mergePreferences(detectPreferences(allUser), job.preferences);
  const advisor_reason = job.advisor_reason || reasonForService(job.category, job.service);
  const add_on_reasons = { ...job.add_on_reasons };
  for (const a of job.add_ons) {
    if (!add_on_reasons[a]) {
      const r = reasonForAddOn(job.category, a);
      if (r) add_on_reasons[a] = r;
    }
  }
  const duration_estimate = job.duration_estimate ||
    durationForService(job.category, job.service);
  const hasCity = !!(cityHint || /\bin\s+[A-Z][a-z]+/.test(allUser));
  const hasWhen = !!timingLabel(null, allUser);
  const missing = filterSmartFollowUps(job.missing, {
    hasCity,
    hasWhen,
    hasServiceClarity: !!job.service,
  });
  const withPrefs = {
    ...job,
    preferences: prefs,
    advisor_reason,
    add_on_reasons,
    duration_estimate,
    missing,
  };
  return {
    ...withPrefs,
    confirmation_bullets: buildConfirmationBullets(withPrefs, allUser),
  };
}

function needFromJob(
  job: JobUnderstanding,
  needIn: Record<string, unknown>,
  cityHint?: string | null,
): IntakeNeed {
  const category = (needIn.category ? String(needIn.category) : null) || job.category;
  const service = (needIn.service ? String(needIn.service) : null) || job.service;
  const add_ons = Array.isArray(needIn.add_ons)
    ? needIn.add_ons.map((x) => String(x)).filter(Boolean)
    : job.add_ons;
  const possible_add_ons = Array.isArray(needIn.possible_add_ons)
    ? needIn.possible_add_ons.map((x) => String(x)).filter(Boolean)
    : job.possible_add_ons;
  const priority = (needIn.priority ? String(needIn.priority) : null) || job.priority;
  const service_text = needIn.service_text
    ? String(needIn.service_text)
    : serviceTextFromJob(job) || null;
  let residential: boolean | null = typeof needIn.residential === "boolean"
    ? needIn.residential
    : null;
  if (residential == null && job.property_type === "residential") residential = true;
  if (residential == null && job.property_type === "commercial") residential = false;

  return {
    category,
    service_text,
    city: needIn.city ? String(needIn.city) : (cityHint || null),
    when: needIn.when ? String(needIn.when) : null,
    residential,
    scope: needIn.scope
      ? String(needIn.scope)
      : (job.priority?.toLowerCase().includes("interior") &&
          !job.priority?.toLowerCase().includes("exterior over")
        ? "interior"
        : null),
    notes: needIn.notes ? String(needIn.notes) : null,
    service,
    add_ons,
    possible_add_ons,
    priority,
    preferences: job.preferences,
    duration_estimate: job.duration_estimate,
    vehicle_type: job.vehicle_type,
  };
}

export async function runMarketplaceIntake(opts: {
  messages: IntakeMessage[];
  cityHint?: string | null;
}): Promise<IntakeResult> {
  const allUser = opts.messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  const heuristicJob = understandJobFromText(allUser, opts.cityHint);

  const apiKey = (Deno.env.get("ANTHROPIC_API_KEY") || "").trim();
  if (!apiKey) {
    return heuristicIntake(opts.messages, opts.cityHint, heuristicJob);
  }

  const userBlock = opts.messages
    .map((m) => `${m.role === "user" ? "Customer" : "Hubly"}: ${m.content}`)
    .join("\n");
  const hint = opts.cityHint ? `\nCustomer city hint: ${opts.cityHint}` : "";
  const seed = heuristicJob.category
    ? `\nHeuristic seed (refine, don't ignore):\n${
      JSON.stringify({
        industry: heuristicJob.industry,
        category: heuristicJob.category,
        service: heuristicJob.service,
        add_ons: heuristicJob.add_ons,
        possible_add_ons: heuristicJob.possible_add_ons,
        priority: heuristicJob.priority,
        advisor_reason: heuristicJob.advisor_reason,
        duration_estimate: heuristicJob.duration_estimate,
        preferences: heuristicJob.preferences,
      })
    }`
    : "";

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1400,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content:
            `Conversation so far:\n${userBlock}${hint}${seed}\n\nAdvise like an experienced pro, then return JSON.`,
        },
      ],
    }),
  });

  if (!anthropicRes.ok) {
    console.error("marketplace intake anthropic", anthropicRes.status, await anthropicRes.text());
    return heuristicIntake(opts.messages, opts.cityHint, heuristicJob);
  }

  const data = await anthropicRes.json();
  const rawText = (data.content || [])
    .filter((c: { type: string }) => c.type === "text")
    .map((c: { text: string }) => c.text)
    .join("\n")
    .trim();

  try {
    const parsed = JSON.parse(extractJson(rawText));
    return normalizeIntakeResult(parsed, opts.messages, opts.cityHint, heuristicJob);
  } catch (e) {
    console.error("marketplace intake parse", e, rawText);
    return heuristicIntake(opts.messages, opts.cityHint, heuristicJob);
  }
}

function normalizeIntakeResult(
  parsed: Record<string, unknown>,
  messages: IntakeMessage[],
  cityHint: string | null | undefined,
  heuristicJob: JobUnderstanding,
): IntakeResult {
  const allUser = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  const needIn = (parsed.need && typeof parsed.need === "object"
    ? parsed.need
    : {}) as Record<string, unknown>;
  let job = mergeJobUnderstanding(heuristicJob, jobFromParsed(parsed.job));
  job = finalizeJob(job, allUser, cityHint);
  const need = needFromJob(job, needIn, cityHint);
  if (!need.service_text) {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    need.service_text = serviceTextFromJob(job, lastUser?.content?.slice(0, 200)) || null;
  }

  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
  let readyConfirm = !!parsed.ready_to_confirm || !!parsed.ready_to_match || confidence >= 0.72;
  if (job.category && job.service && job.missing.length === 0) readyConfirm = true;
  if (job.category && job.service && messages.filter((m) => m.role === "user").length >= 2) {
    readyConfirm = true;
  }
  if (!job.service && !need.service_text) readyConfirm = false;

  const follow_ups = readyConfirm
    ? []
    : filterSmartFollowUps(
      Array.isArray(parsed.follow_ups) && parsed.follow_ups.length
        ? parsed.follow_ups.map((q) => String(q)).filter(Boolean)
        : job.missing,
      {
        hasCity: !!need.city,
        hasWhen: !!need.when || !!timingLabel(null, allUser),
        hasServiceClarity: !!job.service,
      },
    );

  let reply = String(parsed.reply || "").trim();
  // Prefer advisor voice if model returned a classification-y reply
  if (!reply || /^we detected/i.test(reply)) {
    reply = buildAdvisorReply(job);
  }

  const confirmation = readyConfirm ? buildJobConfirmation(job, allUser) : null;

  return {
    reply,
    ready_to_confirm: readyConfirm,
    ready_to_match: false, // client must confirm first
    confidence: confidence || (job.service ? 0.78 : 0.3),
    need,
    job,
    confirmation,
    follow_ups,
  };
}

function heuristicIntake(
  messages: IntakeMessage[],
  cityHint: string | null | undefined,
  seeded?: JobUnderstanding,
): IntakeResult {
  const allUser = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  let job = seeded || understandJobFromText(allUser, cityHint);
  const turn = messages.filter((m) => m.role === "user").length;

  const answeredTiming = /\b(today|tomorrow|asap|this week|next week|flexible|\d{4}-\d{2}-\d{2})\b/i
    .test(allUser);
  const hasCity = !!(cityHint || /\bin\s+[A-Z][a-z]+/.test(allUser));
  job.missing = filterSmartFollowUps(job.missing, {
    hasCity,
    hasWhen: answeredTiming,
    hasServiceClarity: !!job.service,
  });
  job = finalizeJob(job, allUser, cityHint);

  const need = needFromJob(job, {
    when: answeredTiming ? (/\basap\b/i.test(allUser) ? "asap" : "this week") : null,
    city: cityHint,
  }, cityHint);

  const readyConfirm = !!(job.category && job.service) &&
    (job.missing.length === 0 || turn >= 2);

  return {
    reply: buildAdvisorReply(job),
    ready_to_confirm: readyConfirm,
    ready_to_match: false,
    confidence: job.service ? (readyConfirm ? 0.86 : 0.72) : 0.25,
    need,
    job,
    confirmation: readyConfirm ? buildJobConfirmation(job, allUser) : null,
    follow_ups: readyConfirm ? [] : job.missing.slice(0, 2),
    suggested_prompts: job.category ? undefined : [
      "I just bought a used truck and it smells like smoke",
      "My windows haven't been cleaned in years",
      "My AC stopped working",
      "My driveway has oil stains",
      "I need a wedding photographer",
    ],
  };
}

export const INTAKE_SUGGESTED_PROMPTS = [
  "I just bought a used truck and it smells like smoke",
  "My windows haven't been cleaned in years",
  "My AC stopped working",
  "My driveway has oil stains",
  "I need a wedding photographer",
];
