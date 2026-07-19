/**
 * AI Concierge intake — understand the job first, then ask only what's missing.
 */

import {
  mergeJobUnderstanding,
  serviceTextFromJob,
  understandJobFromText,
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
};

export type IntakeResult = {
  reply: string;
  ready_to_match: boolean;
  confidence: number;
  need: IntakeNeed;
  job: JobUnderstanding;
  follow_ups: string[];
  suggested_prompts?: string[];
};

function extractJson(rawText: string): string {
  const start = rawText.indexOf("{");
  const end = rawText.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return rawText;
  return rawText.slice(start, end + 1);
}

const SYSTEM = `You are Hubly's AI concierge — a knowledgeable local service advisor.
Your superpower is UNDERSTANDING THE JOB from messy human language, then asking only what is still missing.

Philosophy:
- Infer industry, primary service, add-ons, and priority BEFORE asking questions.
- Never ask the customer to choose a category from a list.
- Never sound like a search form. You already know what they need.
- Prefer booking language. Never "get quotes" / "estimate".
- Max 2 follow-up questions (prefer 0–1). Only ask about true gaps (city, timing, size, confirmation of an add-on).
- ready_to_match=true when confidence >= 0.72 OR industry+service are clear and only soft gaps remain.

Example — Customer: "I just bought a used truck and it smells like smoke."
You MUST infer:
- industry: Auto Detailing
- category: detailing
- service: Interior Detail
- add_ons: ["Odor Removal"]
- possible_add_ons: ["Shampoo Extraction"]
- priority: Interior over Exterior
Reply like:
"Got it — smoke odor in a used truck usually needs an interior detail with odor removal (not a wash). I'd prioritize the interior over the exterior.\\n\\nOne quick thing — what city is the truck in?"

Example — Customer: "My windows haven't been cleaned in like 5 years."
Infer Interior + Exterior Window Cleaning, residential, deep-clean priority; ask only missing size/stories/timing.

Known categories: detailing, windows, house-cleaning, hvac, lawn-care, spa, pressure-washing, photography

Return ONLY valid JSON:
{
  "reply": "advisor reply that states what you understood, then only missing questions",
  "ready_to_match": true|false,
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
    "understanding_summary": "short internal summary",
    "known": ["Industry: Auto Detailing", "Service: Interior Detail", "..."],
    "missing": ["What city is the truck in?"]
  },
  "need": {
    "category": "detailing",
    "service_text": "Interior Detail + Odor Removal (truck) — Interior over Exterior",
    "city": null,
    "when": null,
    "residential": null,
    "scope": "interior",
    "notes": "smoke odor"
  },
  "follow_ups": ["chip-friendly short questions only for missing fields"]
}`;

function emptyNeed(): IntakeNeed {
  return {
    category: null,
    service_text: null,
    city: null,
    when: null,
    residential: null,
    scope: null,
    notes: null,
    service: null,
    add_ons: [],
    possible_add_ons: [],
    priority: null,
  };
}

function jobFromParsed(raw: unknown): Partial<JobUnderstanding> | null {
  if (!raw || typeof raw !== "object") return null;
  const j = raw as Record<string, unknown>;
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
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
  };
}

function buildReplyFromJob(job: JobUnderstanding): string {
  if (!job.service && !job.industry) {
    return "I can help — tell me what you need done, in plain words.";
  }
  const lines: string[] = [];
  if (job.category === "detailing" && job.add_ons.includes("Odor Removal")) {
    lines.push(
      `Got it — ${job.vehicle_type || "vehicle"} smoke odor usually needs an interior detail with odor removal, not just a wash. I'd prioritize the interior over the exterior.`,
    );
  } else if (job.service) {
    lines.push(
      `Got it — based on what you described, I'd recommend ${job.service}` +
        (job.add_ons.length ? ` with ${job.add_ons.join(" and ")}` : "") +
        ".",
    );
  }
  if (job.possible_add_ons.length && job.missing.length) {
    lines.push(
      `Optional later: ${job.possible_add_ons.slice(0, 2).join(" or ")}.`,
    );
  }
  if (job.missing.length) {
    lines.push("");
    lines.push(
      job.missing.length === 1
        ? `One quick thing — ${job.missing[0].replace(/\?$/, "")}?`
        : `A couple quick questions...\n${job.missing.slice(0, 2).map((q) => `• ${q}`).join("\n")}`,
    );
  } else {
    lines.push("I'll find the best pros for this and get you booked.");
  }
  return lines.join("\n");
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
    ? `\nHeuristic seed (you may refine, don't ignore clear signals):\n${
      JSON.stringify({
        industry: heuristicJob.industry,
        category: heuristicJob.category,
        service: heuristicJob.service,
        add_ons: heuristicJob.add_ons,
        possible_add_ons: heuristicJob.possible_add_ons,
        priority: heuristicJob.priority,
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
      max_tokens: 1200,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content:
            `Conversation so far:\n${userBlock}${hint}${seed}\n\nUnderstand the job fully, then return JSON.`,
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
  const needIn = (parsed.need && typeof parsed.need === "object"
    ? parsed.need
    : {}) as Record<string, unknown>;
  const job = mergeJobUnderstanding(heuristicJob, jobFromParsed(parsed.job));
  const need = needFromJob(job, needIn, cityHint);
  if (!need.service_text) {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    need.service_text = serviceTextFromJob(job, lastUser?.content?.slice(0, 200)) || null;
  }

  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
  let ready = !!parsed.ready_to_match || confidence >= 0.72;
  // If we clearly understand industry+service, don't block on soft gaps forever
  if (job.category && job.service && (need.city || need.when || messages.length >= 2)) {
    ready = true;
  }
  if (!need.category && !need.service_text && !job.service) ready = false;

  const follow_ups = ready
    ? []
    : (Array.isArray(parsed.follow_ups) && parsed.follow_ups.length
      ? parsed.follow_ups.map((q) => String(q)).filter(Boolean).slice(0, 2)
      : job.missing.slice(0, 2));

  let reply = String(parsed.reply || "").trim();
  if (!reply) reply = buildReplyFromJob(job);

  return {
    reply,
    ready_to_match: ready,
    confidence: confidence || (job.service ? 0.75 : 0.3),
    need,
    job,
    follow_ups,
  };
}

function heuristicIntake(
  messages: IntakeMessage[],
  cityHint: string | null | undefined,
  seeded?: JobUnderstanding,
): IntakeResult {
  const allUser = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  const job = seeded || understandJobFromText(allUser, cityHint);
  const turn = messages.filter((m) => m.role === "user").length;

  // Absorb answers from later turns into missing list
  const answeredTiming = /\b(today|tomorrow|asap|this week|next week|flexible|\d{4}-\d{2}-\d{2})\b/i
    .test(allUser);
  const hasCity = !!(cityHint || /\bin\s+[A-Z][a-z]+/.test(allUser));
  job.missing = job.missing.filter((q) => {
    const ql = q.toLowerCase();
    if (/city|where|area|vehicle in|home in|job in/.test(ql) && hasCity) return false;
    if (/when|soon|timing|like it/.test(ql) && answeredTiming) return false;
    if (/interior, exterior|interior or exterior/.test(ql) && /interior|exterior|both/i.test(allUser)) {
      return false;
    }
    if (/how many windows|bedrooms|stories/.test(ql) && turn >= 2 && /\d/.test(allUser)) {
      return false;
    }
    return true;
  });

  const need = needFromJob(job, {
    when: answeredTiming ? (/\basap\b/i.test(allUser) ? "asap" : "flexible") : null,
    city: cityHint,
  }, cityHint);

  const ready = !!(job.category && job.service) &&
    (job.missing.length === 0 || turn >= 2 || (!!need.city && !!job.service));

  return {
    reply: buildReplyFromJob(job),
    ready_to_match: ready,
    confidence: job.service ? (ready ? 0.84 : 0.7) : 0.25,
    need,
    job,
    follow_ups: ready ? [] : job.missing.slice(0, 2),
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
