/**
 * AI Concierge intake — service advisor, not a search form.
 * Reduce customer decisions; recommend scope; ask only what booking needs.
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
Customers talk like humans. You make most of the decisions for them and get them booked.

Philosophy (non-negotiable):
- You are NOT a search engine, directory, or quote marketplace.
- Never ask them to pick a category, browse a map, or compare dozens of businesses.
- Infer the service and a sensible scope from what they said.
- Sound like a calm pro who already knows what to do — not a form.
- Prefer booking language: "schedule", "book", "get this done". Never "get quotes" / "estimate".
- Ask the fewest follow-ups needed (max 3, prefer 1–2). Every question must improve matching or booking confidence.
- Stop and set ready_to_match=true as soon as confidence >= 0.72.

Concierge style for reply:
- Acknowledge the situation in one short line.
- Recommend a concrete scope when you can (e.g. "I'd recommend exterior and interior window cleaning").
- Then: "A couple quick questions..." with only the missing pieces.
Example:
Customer: "My windows haven't been cleaned in like 5 years."
Reply: "I can help with that. Based on what you described, I'd recommend an exterior and interior window cleaning.\\n\\nA couple quick questions...\\n• Approximately how many windows?\\n• Is the home one or two stories?\\n• Do you need screen cleaning too?"

Known Hubly categories (pick closest):
detailing, windows, house-cleaning, hvac, lawn-care, spa, pressure-washing, photography

Return ONLY valid JSON (no markdown):
{
  "reply": "conversational advisor reply (may include short bullets)",
  "ready_to_match": true|false,
  "confidence": 0.0-1.0,
  "need": {
    "category": "windows"|null,
    "service_text": "short job summary including recommended scope"|null,
    "city": "city if known"|null,
    "when": "YYYY-MM-DD or asap or flexible"|null,
    "residential": true|false|null,
    "scope": "e.g. interior + exterior"|null,
    "notes": "other useful detail"|null
  },
  "follow_ups": ["optional next question as a short chip", "..."]
}

ready_to_match rules:
- true when category (or clear service_text) is known AND you have enough to recommend providers: preferably city OR when OR residential/scope detail, OR confidence >= 0.8 from a clear ask.
- After 1–2 answered follow-ups, prefer ready_to_match=true over more questions.
- follow_ups should be answerable as quick chips (short phrases), not long forms.`;

export async function runMarketplaceIntake(opts: {
  messages: IntakeMessage[];
  cityHint?: string | null;
}): Promise<IntakeResult> {
  const apiKey = (Deno.env.get("ANTHROPIC_API_KEY") || "").trim();
  if (!apiKey) {
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
      max_tokens: 1000,
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
    need.service_text = lastUser?.content?.slice(0, 200) || null;
  }
  if (!need.category && !need.service_text) ready = false;

  const follow_ups = Array.isArray(parsed.follow_ups)
    ? parsed.follow_ups.map((q) => String(q)).filter(Boolean).slice(0, 3)
    : [];

  return {
    reply: String(
      parsed.reply ||
        "I can help with that. A couple quick questions so I can recommend the right pro.",
    ),
    ready_to_match: ready,
    confidence,
    need,
    follow_ups: ready ? [] : follow_ups,
  };
}

/** Offline / no-key path — still concierge-shaped. */
function heuristicIntake(messages: IntakeMessage[], cityHint?: string | null): IntakeResult {
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const t = lastUser.toLowerCase();
  const allUser = messages.filter((m) => m.role === "user").map((m) => m.content).join(" \n ");
  const allT = allUser.toLowerCase();

  let category: string | null = null;
  if (/window/.test(t) || /window/.test(allT)) category = "windows";
  else if (/detail|truck|car wash|ceramic/.test(t)) category = "detailing";
  else if (/photo|wedding|portrait/.test(t)) category = "photography";
  else if (/\bac\b|hvac|air condition|furnace/.test(t)) category = "hvac";
  else if (/lawn|mow|yard/.test(t)) category = "lawn-care";
  else if (/pressure|driveway|oil stain|power wash/.test(t)) category = "pressure-washing";
  else if (/clean(ing)?|maid/.test(t)) category = "house-cleaning";
  else if (/spa|massage/.test(t)) category = "spa";

  const answeredTiming = /\b(tomorrow|today|asap|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2}|this week|next week|flexible)\b/i
    .test(allT);
  const hasCity = !!(cityHint || /\bin\s+[A-Z][a-z]+/.test(allUser));
  const hasStories = /\b(one|1|two|2|three|3)[\s-]*(story|stories|floor)/i.test(allT);
  const hasWindowCount = /\b(\d{1,3})\s*(windows?|panes?)\b/i.test(allT) ||
    /\b(about|around|approx)\b.{0,12}\b\d{1,3}\b/i.test(allT);
  const hasScope = /interior|exterior|both|screens?/i.test(allT);
  const yearsDirty = /\b(\d+)\s*years?\b/.test(t) || /haven't|havent|never|long time|ages/i.test(t);

  if (!category) {
    return {
      reply: "I can help — tell me what you need done, in plain words.",
      ready_to_match: false,
      confidence: 0.2,
      need: {
        category: null,
        service_text: lastUser.slice(0, 200) || null,
        city: cityHint || null,
        when: null,
        residential: null,
        scope: null,
        notes: null,
      },
      follow_ups: ["Windows cleaned", "Car detailing", "House cleaning", "AC / HVAC"],
      suggested_prompts: [
        "My windows haven't been cleaned in years",
        "My truck needs detailing",
        "I need a wedding photographer",
        "My AC stopped working",
        "My driveway has oil stains",
      ],
    };
  }

  if (category === "windows") {
    const scope = hasScope
      ? (/both|interior and exterior|exterior and interior/i.test(allT)
        ? "interior + exterior"
        : (/interior/i.test(allT) ? "interior" : (/exterior/i.test(allT) ? "exterior" : "interior + exterior")))
      : "interior + exterior";
    const follow_ups: string[] = [];
    if (!hasWindowCount) follow_ups.push("About how many windows?");
    if (!hasStories) follow_ups.push("One or two stories?");
    if (!/screen/i.test(allT)) follow_ups.push("Need screen cleaning too?");
    if (!answeredTiming) follow_ups.push("When would you like it?");
    if (!hasCity) follow_ups.push("What city is the home in?");

    const turn = messages.filter((m) => m.role === "user").length;
    const ready = follow_ups.length === 0 || (turn >= 2 && follow_ups.length <= 2) ||
      (hasScope && (hasWindowCount || hasStories || answeredTiming));

    const reply = ready
      ? `Perfect — I'll find pros who are a strong fit for ${scope} residential window cleaning and get you booked.`
      : (yearsDirty
        ? `I can help with that. Based on what you described, I'd recommend an ${scope} window cleaning.\n\nA couple quick questions...\n${
          follow_ups.slice(0, 3).map((q) => `• ${q}`).join("\n")
        }`
        : `I can help with that. I'd recommend ${scope} window cleaning for a thorough refresh.\n\nA couple quick questions...\n${
          follow_ups.slice(0, 3).map((q) => `• ${q}`).join("\n")
        }`);

    return {
      reply,
      ready_to_match: ready,
      confidence: ready ? 0.82 : 0.58,
      need: {
        category: "windows",
        service_text: `${scope} residential window cleaning`,
        city: cityHint || null,
        when: answeredTiming ? (/\basap\b/i.test(allT) ? "asap" : null) : null,
        residential: true,
        scope,
        notes: yearsDirty ? "Windows neglected for years — thorough clean" : null,
      },
      follow_ups: ready ? [] : follow_ups.slice(0, 3),
    };
  }

  // Generic categories
  const follow_ups: string[] = [];
  if ((category === "house-cleaning" || category === "pressure-washing") &&
    !/residential|commercial|home|house|office/i.test(allT)) {
    follow_ups.push("Is this residential or commercial?");
  }
  if (!answeredTiming) follow_ups.push("When would you like it?");
  if (!hasCity) follow_ups.push("What city is the job in?");

  const ready = follow_ups.length <= 1 || messages.filter((m) => m.role === "user").length >= 2;
  const label = category.replace(/-/g, " ");
  return {
    reply: ready
      ? `Got it — I'll recommend the best ${label} pros for your job.`
      : `I can help with that. For ${label}, a couple quick questions...\n${
        follow_ups.slice(0, 2).map((q) => `• ${q}`).join("\n")
      }`,
    ready_to_match: ready,
    confidence: ready ? 0.78 : 0.55,
    need: {
      category,
      service_text: lastUser.slice(0, 200),
      city: cityHint || null,
      when: answeredTiming ? (/\basap\b/i.test(allT) ? "asap" : null) : null,
      residential: /commercial/i.test(allT) ? false : (/residential|home|house/i.test(allT) ? true : null),
      scope: null,
      notes: null,
    },
    follow_ups: ready ? [] : follow_ups.slice(0, 2),
  };
}

export const INTAKE_SUGGESTED_PROMPTS = [
  "My windows haven't been cleaned in years",
  "My truck needs detailing",
  "I need a wedding photographer",
  "My AC stopped working",
  "My driveway has oil stains",
];
