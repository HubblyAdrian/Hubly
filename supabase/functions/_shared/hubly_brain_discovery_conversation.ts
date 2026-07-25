/**
 * Hubly Brain — Create-mode Discovery conversation (OpenAI-powered).
 *
 * Every onboarding owner message should land here via think({ intent: "discovery" }).
 * Local regex gap trees are FALLBACK only when OpenAI is unavailable.
 */

export type DiscoveryFacts = {
  industry?: string | null;
  industryId?: string | null;
  area?: string | null;
  stage?: string | null;
  positioning?: string | null;
  customer?: string | null;
  goal?: string | null;
  operations?: string | null;
  businessName?: string | null;
};

export type DiscoveryTurnInput = {
  request: string;
  seed?: string | null;
  facts?: DiscoveryFacts | null;
  history?: Array<{ role: string; text: string }> | null;
  turns?: number;
  clarificationCount?: number;
};

export type DiscoveryTurnResult = {
  ok: boolean;
  reply: string;
  question: string | null;
  facts: DiscoveryFacts;
  confidence: number;
  readyForThinking: boolean;
  learningLines: string[];
  /** Surfaces Hubly is actively building this turn (customer-visible studio). */
  buildingActions: Array<"website" | "booking" | "packages" | "brand" | "crm">;
  /** Short status line for the live studio (plain text). */
  liveStatus: string | null;
  provider: string | null;
  model: string | null;
  source: "openai" | "fallback";
  error?: string | null;
};

const SYSTEM = `You are Hubly — an AI business consultant the owner just hired.

This is CREATE MODE. You are NOT a questionnaire, wizard, or scripted chatbot.
You feel like ChatGPT: natural conversation — AND you build while you talk.

Mindset every turn:
- "I'll build this for you." — not "Answer my questions."
- Work first. Make intelligent assumptions. Begin building immediately.
- Ask at most ONE question, and only when the answer would change the outcome.
- Never re-ask something already answered.
- Narrate what you're building in the reply (homepage, booking, packages, brand) — short, concrete, human.
- Keep replies 1–3 sentences. Conversational. Zero jargon. Never mention JSON/APIs/models.

When you know enough to finish (website + booking + packages), set readyForThinking=true.
Prefer confidence ≥ 75, unless they've clearly described the business in 2–3 natural turns.
learningLines are internal build notes (2–4 short bullets) — do NOT write a report tone in reply.
Completion reply should feel like finishing the build — not "form complete".

buildingActions: which visual surfaces to light up this turn (subset of website, booking, packages, brand, crm).
liveStatus: one short plain-text line for the live studio (e.g. "Drafting your homepage…").

Return ONLY valid JSON:
{
  "reply": "string — narrate building; question only if necessary",
  "question": "string|null — only if answer changes the outcome; else null",
  "facts": {
    "industry": "string|null",
    "industryId": "pressure_washing|photography|lawn_care|hvac|spa|cleaning|detailing|null",
    "area": "string|null",
    "stage": "early|established|null",
    "positioning": "premium|affordable|fast|local|null",
    "customer": "residential|commercial|short_term_rentals|wedding_clients|null",
    "goal": "recurring_customers|more_bookings|grow_revenue|save_time|build_brand|hire_team|null",
    "operations": "solo|team|mobile|storefront|null",
    "businessName": "string|null"
  },
  "confidence": 0-100,
  "readyForThinking": boolean,
  "learningLines": ["string"],
  "buildingActions": ["website","booking","packages","brand","crm"],
  "liveStatus": "string|null"
}`;

function extractJson(text: string): string {
  const raw = String(text || "").trim();
  if (!raw) return "{}";
  if (raw.startsWith("{")) return raw;
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) return fence[1].trim();
  const i = raw.indexOf("{");
  const j = raw.lastIndexOf("}");
  if (i >= 0 && j > i) return raw.slice(i, j + 1);
  return "{}";
}

function mergeFacts(prev: DiscoveryFacts | null | undefined, next: DiscoveryFacts | null | undefined): DiscoveryFacts {
  const out: DiscoveryFacts = { ...(prev || {}) };
  const n = next || {};
  for (const key of Object.keys(n) as (keyof DiscoveryFacts)[]) {
    const v = n[key];
    if (v != null && String(v).trim()) out[key] = v;
  }
  return out;
}

function buildUserPayload(input: DiscoveryTurnInput): string {
  const hist = (input.history || [])
    .slice(-16)
    .map((m) => `${m.role === "owner" || m.role === "user" ? "Owner" : "Hubly"}: ${m.text}`)
    .join("\n");
  return [
    input.seed ? `Seed from landing: ${input.seed}` : "",
    `Known facts so far: ${JSON.stringify(input.facts || {})}`,
    `Turns: ${Number(input.turns) || 0}; clarifications so far: ${Number(input.clarificationCount) || 0}`,
    hist ? `Conversation:\n${hist}` : "",
    `Latest owner message:\n${String(input.request || "").trim()}`,
    "Respond with JSON only.",
  ].filter(Boolean).join("\n\n");
}

/** Deterministic fallback — only when OpenAI is missing or errors. */
export function fallbackDiscoveryTurn(input: DiscoveryTurnInput): DiscoveryTurnResult {
  const text = String(input.request || "").toLowerCase();
  const facts = mergeFacts(input.facts, {});
  if (/lawn|mow|yard/.test(text)) {
    facts.industry = facts.industry || "Lawn Care";
    facts.industryId = facts.industryId || "lawn_care";
  } else if (/pressure|power\s*wash|soft\s*wash/.test(text)) {
    facts.industry = facts.industry || "Pressure Washing";
    facts.industryId = facts.industryId || "pressure_washing";
  } else if (/clean|maid|airbnb|turnover/.test(text)) {
    facts.industry = facts.industry || "Cleaning";
    facts.industryId = facts.industryId || "cleaning";
  }
  if (/\bin\s+[a-z]/.test(text)) {
    const m = String(input.request || "").match(/\bin\s+([A-Z][A-Za-z.\s-]{1,40})/);
    if (m) facts.area = facts.area || m[1].trim();
  }
  const turns = (Number(input.turns) || 0) + 1;
  const clar = Number(input.clarificationCount) || 0;
  let question: string | null = null;
  let ready = false;
  let confidence = 35 + turns * 12;
  if (!facts.industry) question = "What kind of work do customers hire you for?";
  else if (!facts.area) question = "Where do you mostly work — one city, or do you travel?";
  else if (!facts.customer) question = "Who do you usually serve — homeowners, businesses, or someone else?";
  else if (!facts.goal) question = "If we made one thing better soon, what would help most?";
  else {
    ready = clar >= 2 || turns >= 3;
    confidence = Math.max(confidence, 80);
  }
  if (clar >= 3) ready = true;
  const buildingActions: DiscoveryTurnResult["buildingActions"] = [];
  if (facts.industry) buildingActions.push("website", "brand");
  if (facts.area || facts.customer) buildingActions.push("booking");
  if (facts.goal || facts.customer) buildingActions.push("packages");
  if (ready) buildingActions.push("website", "booking", "packages", "brand", "crm");
  const uniqActions = [...new Set(buildingActions)];
  const liveStatus = ready
    ? "Putting the finishing touches on your business…"
    : facts.industry
    ? `Drafting your ${facts.industry} homepage…`
    : "I'll build this for you — starting with your website…";
  const reply = question
    ? `I'm already shaping your site. ${question}`
    : "I've got enough — finishing your website, booking, and packages now.";
  return {
    ok: true,
    reply,
    question,
    facts,
    confidence: Math.min(100, confidence),
    readyForThinking: ready && !question,
    learningLines: ready
      ? [
        facts.industry ? `You're building a ${facts.industry} business.` : "You're building a local service business.",
        facts.area ? `You'll focus around ${facts.area}.` : "We'll lock your service area next.",
        facts.goal ? "We'll aim the site and booking at that goal." : "We'll make booking you effortless.",
      ]
      : [],
    buildingActions: uniqActions,
    liveStatus,
    provider: null,
    model: null,
    source: "fallback",
    error: "openai_unavailable_or_error",
  };
}

export async function runDiscoveryConversationTurn(
  input: DiscoveryTurnInput,
): Promise<DiscoveryTurnResult> {
  const request = String(input.request || "").trim();
  if (!request) {
    return {
      ok: false,
      reply: "Tell me a little about the business you're building — I'll start building as soon as you do.",
      question: null,
      facts: input.facts || {},
      confidence: 0,
      readyForThinking: false,
      learningLines: [],
      buildingActions: ["website"],
      liveStatus: "Waiting for your first details…",
      provider: null,
      model: null,
      source: "fallback",
      error: "empty_request",
    };
  }

  try {
    const { HublyAI, extractJson: hublyExtractJson } = await import("./hubly_ai.ts");
    if (!HublyAI.isConfigured("openai")) {
      console.warn("discovery conversation: OPENAI_API_KEY missing — using fallback");
      return fallbackDiscoveryTurn(input);
    }

    const ai = await HublyAI.complete({
      feature: "onboarding-discovery",
      task: "chat",
      provider: "openai",
      system: SYSTEM,
      messages: [{ role: "user", content: buildUserPayload(input) }],
      maxTokens: 900,
      temperature: 0.6,
      jsonMode: true,
    });

    const raw = String(ai.text || "").trim();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(hublyExtractJson ? hublyExtractJson(raw) : extractJson(raw));
    } catch {
      parsed = JSON.parse(extractJson(raw));
    }

    const facts = mergeFacts(input.facts, (parsed.facts || {}) as DiscoveryFacts);
    const reply = String(parsed.reply || "").trim() ||
      "Tell me a little more — I'm listening.";
    const questionRaw = parsed.question == null ? null : String(parsed.question).trim();
    const question = questionRaw && questionRaw !== "null" ? questionRaw : null;
    const confidence = Math.max(0, Math.min(100, Number(parsed.confidence) || 0));
    const readyForThinking = !!parsed.readyForThinking && confidence >= 70;
    const learningLines = Array.isArray(parsed.learningLines)
      ? parsed.learningLines.map((l) => String(l || "").trim()).filter(Boolean).slice(0, 5)
      : [];
    const allowed = new Set(["website", "booking", "packages", "brand", "crm"]);
    const buildingActions = (Array.isArray(parsed.buildingActions) ? parsed.buildingActions : [])
      .map((a) => String(a || "").trim().toLowerCase())
      .filter((a): a is DiscoveryTurnResult["buildingActions"][number] => allowed.has(a));
    if (!buildingActions.length && facts.industry) buildingActions.push("website", "brand");
    if (readyForThinking) {
      for (const s of ["website", "booking", "packages", "brand", "crm"] as const) {
        if (!buildingActions.includes(s)) buildingActions.push(s);
      }
    }
    const liveStatusRaw = parsed.liveStatus == null ? null : String(parsed.liveStatus).trim();
    const liveStatus = liveStatusRaw && liveStatusRaw !== "null" ? liveStatusRaw.slice(0, 120) : null;

    return {
      ok: true,
      reply,
      question: readyForThinking ? null : question,
      facts,
      confidence,
      readyForThinking,
      learningLines,
      buildingActions,
      liveStatus,
      provider: ai.provider || "openai",
      model: ai.model || null,
      source: "openai",
      error: null,
    };
  } catch (e) {
    console.error("discovery conversation OpenAI failed", e);
    const fb = fallbackDiscoveryTurn(input);
    fb.error = e instanceof Error ? e.message : "openai_error";
    return fb;
  }
}
