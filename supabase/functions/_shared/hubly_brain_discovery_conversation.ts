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
  brandVoice?: string | null;
  visualStyle?: string | null;
  bookingStrategy?: string | null;
};

export type DiscoveryTurnInput = {
  request: string;
  seed?: string | null;
  facts?: DiscoveryFacts | null;
  history?: Array<{ role: string; text: string }> | null;
  turns?: number;
  clarificationCount?: number;
};

/** AI Business Blueprint — systems assembly plan (not an industry template). */
export type DiscoveryBusinessBlueprint = {
  designDirection?: string | null;
  idealCustomer?: string | null;
  brandVoice?: string | null;
  offer?: string | null;
  trustSignals?: string[] | null;
  competitivePosition?: string | null;
  priceLevel?: string | null;
  desiredFeeling?: string | null;
  layoutId?: string | null;
  composition?: string | null;
  accent?: string | null;
  headline?: string | null;
  heroSub?: string | null;
  ctaLabel?: string | null;
  about?: string | null;
  packages?: Array<string | { name?: string; price?: number; desc?: string }> | null;
  bookingChips?: string[] | null;
  bookingStrategy?: string | null;
  components?: {
    hero?: string | null;
    nav?: string | null;
    cta?: string | null;
    services?: string | null;
    gallery?: string | null;
    testimonials?: string | null;
    pricing?: string | null;
    faq?: string | null;
    footer?: string | null;
    booking?: string | null;
  } | null;
  sectionOrder?: string[] | null;
  strategySummary?: string | null;
  automations?: string[] | null;
};

export type DiscoveryTurnResult = {
  ok: boolean;
  reply: string;
  question: string | null;
  facts: DiscoveryFacts;
  /** Systems plan — Assemble from this; never map industry → template. */
  businessBlueprint: DiscoveryBusinessBlueprint | null;
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

const SYSTEM = `You are Hubly — ChatGPT, white-labeled as Hubly.

You are a world-class conversational AI that can see and change a live business (website, booking, packages, brand) while you talk.
You are NOT onboarding software. You are NOT a questionnaire, wizard, checklist, or setup flow.
At no point should the owner feel like they are "completing onboarding." This is a collaboration with an expert building their business.

Voice (non-negotiable):
- Sound exactly like ChatGPT: natural, sharp, warm, direct. Never robotic. Never corporate.
- Mirror their language so every reply feels: "it understood exactly what I meant."
- 2–5 sentences. Conversational paragraphs — not bullet lists, not numbered steps, not "Phase 1."
- Prefer "I already…" / "I'm putting…" over "Should I…?" / "Would you like me to…?"
- Make intelligent assumptions. Ask at most ONE question, and ONLY if the answer would change what you build.
- Never ask stacked setup questions (niche / area / stage / online vs in-person as a form).
- Never offer pill menus, multiple-choice chips, or "pick one of the following."
- Never say you are an AI model, mention OpenAI/GPT, JSON, APIs, gates, or "onboarding."
- Name what you changed on the live site so they can see progress ("homepage," "booking," "packages").

Build while talking — SYSTEMS, not templates:
- NEVER pick an industry template (no "fitness theme", "spa theme").
- First think: Ideal customer → Brand voice → Offer → Trust → Position → Price level → Desired feeling.
- Then choose a designDirection: luxury|minimal|editorial|bold|playful|corporate|modern|dark|light.
- Then pick component IDs from the catalogs below (combinations, not templates).
- buildingActions must list surfaces updating this turn: website, booking, packages, brand, crm.
- liveStatus: short studio line (e.g. "Assembling your booking + packages…").

Component catalogs (pick by id):
- hero: hero_01…hero_12 (outcome, proof, split, center, bold, editorial, consult, results, dark, light, social, quiet)
- nav: nav_01…nav_06
- cta: cta_01…cta_08
- services: svc_01…svc_06
- gallery: gal_01…gal_08
- testimonials: tst_01…tst_06
- pricing: prc_01…prc_06 (prc_03/prc_04 hide prices — high-ticket)
- faq: faq_01…faq_04
- footer: ftr_01…ftr_04
- booking: bk_01 instant | bk_02 consult-first | bk_03 quote | bk_04 package | bk_05 apply | bk_06 mobile

When website + booking + packages are clearly in place and they aren't mid-correction, set readyForThinking=true.
Prefer confidence ≥ 75 after a clear industry — stay conversational if they're refining.
As soon as industry is clear (even turn 1), return a full businessBlueprint so Hubly can assemble.

Return ONLY valid JSON:
{
  "reply": "string — ChatGPT-natural reaction + what you built/changed",
  "question": "string|null — only if it changes the build; else null",
  "facts": {
    "industry": "string|null",
    "industryId": "pressure_washing|photography|lawn_care|hvac|spa|cleaning|detailing|fitness|flight_instruction|dog_grooming|null",
    "area": "string|null",
    "stage": "early|established|null",
    "positioning": "premium|affordable|fast|local|null",
    "customer": "residential|commercial|short_term_rentals|wedding_clients|clients|null",
    "goal": "recurring_customers|more_bookings|grow_revenue|save_time|build_brand|hire_team|null",
    "operations": "solo|team|mobile|storefront|null",
    "businessName": "string|null",
    "brandVoice": "string|null — short voice note e.g. confident coach / calm luxury",
    "visualStyle": "string|null — short style note e.g. bold athletic / quiet spa",
    "bookingStrategy": "string|null — e.g. consult-first / book-session / quote-then-book"
  },
  "businessBlueprint": {
    "designDirection": "luxury|minimal|editorial|bold|playful|corporate|modern|dark|light",
    "idealCustomer": "string",
    "brandVoice": "string",
    "offer": "string — one-line offer",
    "trustSignals": ["string","string","string"],
    "competitivePosition": "string",
    "priceLevel": "low|mid|high",
    "desiredFeeling": "string",
    "layoutId": "string|null — optional Hubly layout id if you know one",
    "composition": "classic|portfolio|services|minimal|null",
    "accent": "#D9632D or fitting hex — avoid purple defaults",
    "headline": "string",
    "heroSub": "string",
    "ctaLabel": "string",
    "about": "string",
    "packages": ["string","string","string"],
    "bookingChips": ["string","string"],
    "components": {
      "hero": "hero_XX",
      "nav": "nav_XX",
      "cta": "cta_XX",
      "services": "svc_XX",
      "gallery": "gal_XX",
      "testimonials": "tst_XX",
      "pricing": "prc_XX",
      "faq": "faq_XX",
      "footer": "ftr_XX",
      "booking": "bk_XX"
    },
    "sectionOrder": ["services","reviews","gallery","about","faq"],
    "strategySummary": "string — one sentence business strategy",
    "automations": ["Booking confirmation","No-show follow-up"]
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
  } else if (/fitness|personal\s*train|trainer|coach/.test(text)) {
    facts.industry = facts.industry || "Personal Training";
    facts.industryId = facts.industryId || "fitness";
    facts.customer = facts.customer || "clients";
    facts.operations = facts.operations || "solo";
  } else if (/flight\s*instruct|pilot\s*train|cfi\b/.test(text)) {
    facts.industry = facts.industry || "Flight Instruction";
    facts.industryId = facts.industryId || "flight_instruction";
    facts.customer = facts.customer || "clients";
  } else if (/dog\s*groom|pet\s*groom|groomer/.test(text)) {
    facts.industry = facts.industry || "Dog Grooming";
    facts.industryId = facts.industryId || "dog_grooming";
    facts.customer = facts.customer || "clients";
  } else if (/detail|mobile\s*detail|car\s*wash/.test(text)) {
    facts.industry = facts.industry || "Mobile Detailing";
    facts.industryId = facts.industryId || "detailing";
  } else if (/photo|photog|wedding\s*shoot/.test(text)) {
    facts.industry = facts.industry || "Photography";
    facts.industryId = facts.industryId || "photography";
  } else if (/hvac|heat(?:ing)?|air\s*cond|furnace/.test(text)) {
    facts.industry = facts.industry || "HVAC";
    facts.industryId = facts.industryId || "hvac";
  } else if (/spa|massage|facial|wellness/.test(text)) {
    facts.industry = facts.industry || "Spa & Wellness";
    facts.industryId = facts.industryId || "spa";
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
  // Assume aggressively — only ask when it changes the build.
  if (!facts.industry) question = "What do customers hire you for day to day?";
  else if (!facts.customer && turns >= 2) {
    facts.customer = facts.customer || "clients";
  }
  if (facts.industry && turns >= 1) {
    ready = turns >= 2 || clar >= 1;
    confidence = Math.max(confidence, 78);
  }
  if (clar >= 2) ready = true;
  const buildingActions: DiscoveryTurnResult["buildingActions"] = [];
  if (facts.industry) buildingActions.push("website", "brand", "booking", "packages");
  if (ready) buildingActions.push("website", "booking", "packages", "brand", "crm");
  const uniqActions = [...new Set(buildingActions)];
  const liveStatus = facts.industry
    ? `Updating your ${facts.industry} site…`
    : "Building your website…";
  const reply = question
    ? `Got it — I'm already shaping the homepage. ${question}`
    : facts.industry
    ? `I tightened your ${facts.industry} homepage and booking around what you just said. Anything feel off?`
    : "I'm building as we go — tell me more and I'll keep shaping it.";
  const businessBlueprint: DiscoveryBusinessBlueprint | null = facts.industry
    ? {
      designDirection: /premium|luxury/.test(String(facts.positioning || ""))
        ? "luxury"
        : /fitness|train|coach/.test(String(facts.industryId || facts.industry || ""))
        ? "bold"
        : "modern",
      idealCustomer: facts.customer || "clients",
      brandVoice: facts.brandVoice || "clear and confident",
      offer: facts.positioning || facts.industry || "results-first service",
      trustSignals: ["Clear packages", "Easy booking", "Real results"],
      competitivePosition: facts.positioning || "local favorite",
      priceLevel: /premium|luxury/.test(String(facts.positioning || "")) ? "high" : "mid",
      desiredFeeling: "trust and momentum",
      headline: null,
      heroSub: null,
      ctaLabel: /consult/i.test(String(facts.bookingStrategy || "")) ? "Book a free consult" : "Book now",
      packages: ["Starter", "Popular", "Pro"],
      bookingChips: ["Consult", "Book session"],
      components: {
        hero: "hero_01",
        nav: "nav_03",
        cta: "cta_01",
        services: "svc_03",
        gallery: "gal_05",
        testimonials: "tst_01",
        pricing: "prc_02",
        faq: "faq_01",
        footer: "ftr_01",
        booking: "bk_01",
      },
      strategySummary: facts.industry
        ? `Position ${facts.industry} around clear packages and effortless booking.`
        : null,
      automations: ["Booking confirmation", "No-show follow-up"],
    }
    : null;
  return {
    ok: true,
    reply,
    question,
    facts,
    businessBlueprint,
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
      businessBlueprint: null,
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
      // GPT-5.5 rejects custom temperature; leave default.
      maxTokens: 2400,
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

    let businessBlueprint: DiscoveryBusinessBlueprint | null = null;
    const bpRaw = parsed.businessBlueprint;
    if (bpRaw && typeof bpRaw === "object") {
      businessBlueprint = bpRaw as DiscoveryBusinessBlueprint;
    } else if (facts.industry) {
      // OpenAI omitted blueprint — still assemble from facts (systems path, not template).
      businessBlueprint = {
        designDirection: facts.visualStyle || facts.positioning || "modern",
        idealCustomer: facts.customer || "clients",
        brandVoice: facts.brandVoice || null,
        offer: facts.positioning || facts.industry,
        priceLevel: /premium|luxury/i.test(String(facts.positioning || "")) ? "high" : "mid",
        bookingStrategy: facts.bookingStrategy || null,
      };
    }

    return {
      ok: true,
      reply,
      question: readyForThinking ? null : question,
      facts,
      businessBlueprint,
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
    const msg = e instanceof Error ? e.message : "openai_error";
    const detail = e && typeof e === "object" && "providerBody" in e
      ? String((e as { providerBody?: unknown }).providerBody || "").slice(0, 280)
      : "";
    const status = e && typeof e === "object" && "status" in e
      ? String((e as { status?: unknown }).status || "")
      : "";
    fb.error = [msg, status && `status=${status}`, detail].filter(Boolean).join(" | ");
    return fb;
  }
}
