/**
 * AI intake for marketplace — conversational, minimal questions.
 * Goal: shortest path to confident provider matching (not a search form).
 */

const MODEL = "claude-haiku-4-5-20251001";

export type IntakeMessage = { role: "user" | "assistant"; content: string };

export type IntakeResult = {
  reply: string;
  ready_to_match: boolean;
  confidence: number; // 0–1
  need: {
    category: string | null;
    service_text: string | null;
    city: string | null;
    when: string | null;
    residential: boolean | null;
    scope: string | null;
    notes: string | null;
  };
  follow_ups: string[]; // remaining questions if any
  suggested_prompts?: string[];
};

function extractJson(rawText: string): string {
  const start = rawText.indexOf("{");
  const end = rawText.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return rawText;
  return rawText.slice(start, end + 1);
}

const SYSTEM = `You are Hubly's booking concierge. Customers describe a job in plain language. You help them get booked — you do NOT help them search a directory.

Philosophy:
- Never ask them to browse categories, maps, or long lists.
- Detect the service automatically from their words.
- Ask the fewest follow-up questions needed (max 3, prefer 0–2).
- Stop as soon as you have enough confidence to match providers (confidence >= 0.72).
- Prefer booking language: "schedule", "book", "get this done" — never "get quotes" or "request an estimate".

Known Hubly categories (pick closest):
detailing, windows, house-cleaning, hvac, lawn-care, spa, pressure-washing, photography

Return ONLY valid JSON (no markdown) with this shape:
{
  "reply": "short conversational reply to the customer",
  "ready_to_match": true|false,
  "confidence": 0.0-1.0,
  "need": {
    "category": "windows"|null,
    "service_text": "short job summary"|null,
    "city": "city if known"|null,
    "when": "YYYY-MM-DD or asap or flexible"|null,
    "residential": true|false|null,
    "scope": "e.g. exterior only"|null,
    "notes": "other useful detail"|null
  },
  "follow_ups": ["optional next question", "..."]
}

Rules for ready_to_match:
- true when you know category (or clear service_text) AND (city OR when OR residential/scope) OR confidence >= 0.8 from a clear single-sentence ask.
- If they only said "I need my windows cleaned" with no city/timing, ask 1–2 quick questions then ready_to_match can still become true after their answer.
- Keep reply warm, short, and action-oriented.`;

export async function runMarketplaceIntake(opts: {
  messages: IntakeMessage[];
  cityHint?: string | null;
}): Promise<IntakeResult> {
  const apiKey = (Deno.env.get("ANTHROPIC_API_KEY") || "").trim();
  if (!apiKey) {
    // Deterministic fallback without AI — still AI-first UX structure
    return heuristicIntake(opts.messages, opts.cityHint);
  }

  const userBlock = opts.messages
    .map((m) => `${m.role === "user" ? "Customer" : "Hubly"}: ${m.content}`)
    .join("\n");
  const hint = opts.cityHint ? `\nCustomer city hint: ${opts.cityHint}` : "";

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 900,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Conversation so far:\n${userBlock}${hint}\n\nReturn the JSON object now.`,
        },
      ],
    }),
  });

  if (!anthropicRes.ok) {
    console.error("marketplace intake anthropic", anthropicRes.status, await anthropicRes.text());
    return heuristicIntake(opts.messages, opts.cityHint);
  }

  const data = await anthropicRes.json();
  const rawText = (data.content || [])
    .filter((c: { type: string }) => c.type === "text")
    .map((c: { text: string }) => c.text)
    .join("\n")
    .trim();

  try {
    const parsed = JSON.parse(extractJson(rawText));
    return normalizeIntakeResult(parsed, opts.messages, opts.cityHint);
  } catch (e) {
    console.error("marketplace intake parse", e, rawText);
    return heuristicIntake(opts.messages, opts.cityHint);
  }
}

function normalizeIntakeResult(
  parsed: Record<string, unknown>,
  messages: IntakeMessage[],
  cityHint?: string | null,
): IntakeResult {
  const needIn = (parsed.need && typeof parsed.need === "object"
    ? parsed.need
    : {}) as Record<string, unknown>;
  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
  let ready = !!parsed.ready_to_match || confidence >= 0.72;
  const need = {
    category: needIn.category ? String(needIn.category) : null,
    service_text: needIn.service_text ? String(needIn.service_text) : null,
    city: needIn.city ? String(needIn.city) : (cityHint || null),
    when: needIn.when ? String(needIn.when) : null,
    residential: typeof needIn.residential === "boolean" ? needIn.residential : null,
    scope: needIn.scope ? String(needIn.scope) : null,
    notes: needIn.notes ? String(needIn.notes) : null,
  };
  if (!need.service_text) {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    need.service_text = lastUser?.content?.slice(0, 160) || null;
  }
  if (!need.category && !need.service_text) ready = false;

  const follow_ups = Array.isArray(parsed.follow_ups)
    ? parsed.follow_ups.map((q) => String(q)).filter(Boolean).slice(0, 3)
    : [];

  return {
    reply: String(parsed.reply || "Got it — a couple quick questions so we can book the right pro."),
    ready_to_match: ready,
    confidence,
    need,
    follow_ups: ready ? [] : follow_ups,
  };
}

/** Offline / no-key path — still short and booking-oriented. */
function heuristicIntake(messages: IntakeMessage[], cityHint?: string | null): IntakeResult {
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const t = lastUser.toLowerCase();
  let category: string | null = null;
  if (/window/.test(t)) category = "windows";
  else if (/detail|truck|car wash|ceramic/.test(t)) category = "detailing";
  else if (/photo|wedding|portrait/.test(t)) category = "photography";
  else if (/\bac\b|hvac|air condition|furnace/.test(t)) category = "hvac";
  else if (/lawn|mow|yard/.test(t)) category = "lawn-care";
  else if (/pressure|driveway|oil stain|power wash/.test(t)) category = "pressure-washing";
  else if (/clean(ing)?|maid/.test(t)) category = "house-cleaning";
  else if (/spa|massage/.test(t)) category = "spa";

  const askedResidential = messages.some((m) => /residential|commercial/i.test(m.content));
  const answeredTiming = /\b(tomorrow|today|asap|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})\b/i
    .test(lastUser);
  const hasCity = !!(cityHint || /\bin\s+[A-Z][a-z]+/.test(lastUser));

  if (!category) {
    return {
      reply: "Happy to help — what do you need done? (windows, detailing, cleaning, HVAC, etc.)",
      ready_to_match: false,
      confidence: 0.2,
      need: {
        category: null,
        service_text: lastUser.slice(0, 160) || null,
        city: cityHint || null,
        when: null,
        residential: null,
        scope: null,
        notes: null,
      },
      follow_ups: ["What service do you need?"],
      suggested_prompts: [
        "I need my windows cleaned",
        "My truck needs detailing",
        "I need a wedding photographer",
        "My AC stopped working",
        "My driveway has oil stains",
      ],
    };
  }

  const follow_ups: string[] = [];
  if (!askedResidential && (category === "windows" || category === "house-cleaning")) {
    follow_ups.push("Is this residential or commercial?");
  }
  if (category === "windows" && !/interior|exterior|both/.test(t)) {
    follow_ups.push("Interior, exterior, or both?");
  }
  if (!answeredTiming) follow_ups.push("When would you like it?");
  if (!hasCity) follow_ups.push("What city is the job in?");

  const ready = follow_ups.length <= 1;
  return {
    reply: ready
      ? "Great — I’ll find your best matches to get this booked."
      : "Great. A couple quick questions.",
    ready_to_match: ready,
    confidence: ready ? 0.78 : 0.55,
    need: {
      category,
      service_text: lastUser.slice(0, 160),
      city: cityHint || null,
      when: answeredTiming ? (/\basap\b/i.test(t) ? "asap" : null) : null,
      residential: /commercial/i.test(t) ? false : (/residential/i.test(t) ? true : null),
      scope: /both/i.test(t) ? "both" : (/interior/i.test(t) ? "interior" : (/exterior/i.test(t) ? "exterior" : null)),
      notes: null,
    },
    follow_ups: follow_ups.slice(0, 2),
  };
}

export const INTAKE_SUGGESTED_PROMPTS = [
  "I need my windows cleaned",
  "My truck needs detailing",
  "I need a wedding photographer",
  "My AC stopped working",
  "My driveway has oil stains",
];
