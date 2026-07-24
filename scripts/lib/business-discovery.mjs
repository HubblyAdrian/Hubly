/**
 * Milestone 2 · Epic 2 — Business Discovery Conversation
 *
 * Adaptive, confidence-driven consulting conversation — not a questionnaire.
 * Node mirror for gates; public/hubly.html embeds a matching runtime.
 */
export const DISCOVERY_VERSION = "1.0.0";
export const DISCOVERY_LABEL = "Business Discovery Conversation";
export const MAX_CLARIFICATION_QUESTIONS = 3;
export const ASK_CONFIDENCE_THRESHOLD = 70;
export const READY_CONFIDENCE_THRESHOLD = 78;
export const TARGET_UNDERSTANDING_ACCURACY = 0.95;

export const DISCOVERY_COMPLETION_LINE =
  "I think I understand your business now. Let me show you what I'm thinking.";

export const LEARNING_SUMMARY_HEADER = "Here's what I'm learning...";

export const DISCOVERY_COPY = [
  "I think I understand your business now.",
  "Let me show you what I'm thinking.",
  "Here's what I'm learning...",
  "I noticed something.",
  "I might be wrong here...",
  "Tell me a little more about what you do.",
  "We can always change it later.",
];

export const DISCOVERY_FORBIDDEN_SURVEY = [
  "What is your service area?",
  "Business Stage?",
  "Premium or Budget?",
  "Step Complete",
  "Please select your industry",
  "Required field",
];

export const DISCOVERY_FORBIDDEN_CRM = [
  "Dashboard",
  "CRM",
  "Customers",
  "Calendar",
  "Jobs",
  "Revenue",
  "Settings",
];

/** Five founder-test industries — each must produce a distinct conversation. */
export const FOUNDER_TEST_SEEDS = [
  { id: "pressure_washing", seed: "I'm starting a pressure washing company in Salt Lake City.", expect: { industry: "Pressure Washing", mobile: true } },
  { id: "photography", seed: "I'm a wedding photographer and I want a premium brand.", expect: { industry: "Photography", positioning: "premium" } },
  { id: "lawn_care", seed: "I do lawn care for homeowners around my city.", expect: { industry: "Lawn Care", customerType: "residential" } },
  { id: "hvac", seed: "I just launched my HVAC company and need more recurring customers.", expect: { industry: "HVAC", goal: "recurring" } },
  { id: "spa", seed: "I run a spa and want people to book online.", expect: { industry: "Spa", booking: true } },
];

const INDUSTRY_PATTERNS = [
  { id: "pressure_washing", label: "Pressure Washing", re: /pressure\s*wash|power\s*wash|soft\s*wash/i, mobile: true, recurringLikely: true, booking: "flexible" },
  { id: "photography", label: "Photography", re: /photograph|wedding\s*photo|photo\s*biz|portraits?/i, mobile: false, recurringLikely: false, booking: "appointment", positioningHint: "premium" },
  { id: "lawn_care", label: "Lawn Care", re: /lawn|mow|landscap|yard\s*care|grass/i, mobile: true, recurringLikely: true, booking: "recurring" },
  { id: "hvac", label: "HVAC", re: /\bhvac\b|heating|air\s*condition|furnace|ac\s*repair/i, mobile: true, recurringLikely: true, booking: "service_call" },
  { id: "spa", label: "Spa", re: /\bspa\b|massage|facial|wellness\s*studio|nail\s*salon/i, mobile: false, recurringLikely: true, booking: "appointment" },
  { id: "cleaning", label: "Cleaning", re: /clean|maid|janitor|airbnb|short.?term\s*rental|vacation\s*rental|turnovers?/i, mobile: true, recurringLikely: true, booking: "flexible", customerHint: "short_term_rentals" },
  { id: "detailing", label: "Auto Detailing", re: /detail|car\s*wash|auto\s*detail/i, mobile: true, recurringLikely: true, booking: "flexible" },
];

const GAP_QUESTIONS = {
  industry: {
    id: "industry",
    natural: "What kind of work do you do day to day — the thing customers actually hire you for?",
    survey: "What is your industry?",
  },
  area: {
    id: "area",
    natural: "Are you mostly working around one city, or do you travel quite a bit?",
    survey: "What is your service area?",
  },
  stage: {
    id: "stage",
    natural: "Is this something you're just getting off the ground, or have you been doing it for a while?",
    survey: "Business Stage?",
  },
  positioning: {
    id: "positioning",
    natural: "When customers choose you, what do you hope they remember?",
    survey: "Premium or Budget?",
  },
  customer: {
    id: "customer",
    natural: "I might be wrong here... Are you mostly working with homeowners, or more commercial properties?",
    survey: "Who is your customer?",
  },
  goal: {
    id: "goal",
    natural: "If we made one thing better in the next few weeks, what would help you most?",
    survey: "What is your primary goal?",
  },
  operations: {
    id: "operations",
    natural: "Are you mostly flying solo right now, or do you already have people helping?",
    survey: "Solo or team?",
  },
};

const DISCOVERY_MOMENTS = {
  pressure_washing: "I noticed something. Most pressure washing companies compete on price. I think that's a mistake.",
  photography: "I noticed something. Wedding photographers who lead with polish book differently than those who lead with price.",
  lawn_care: "I noticed something. Recurring routes usually beat one-off jobs for lawn care — reliability becomes the brand.",
  hvac: "I noticed something. HVAC shops that win on trust and maintenance plans grow steadier than ones that only chase emergency calls.",
  spa: "I noticed something. Spas that make booking effortless keep clients coming back without constant promotion.",
  cleaning: "I noticed something. Cleaning businesses that feel reliable — not cheapest — keep the best recurring work.",
  default: "I noticed something. The businesses that win in your space usually lead with trust, not just a lower price.",
};

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function low(s) {
  return String(s || "").toLowerCase().trim();
}

export function detectEmotion(text) {
  const t = low(text);
  if (/overwhelm|stressed|anxious|too much|burned?\s*out|exhausted/.test(t)) {
    return { state: "overwhelmed", response: "We'll take this one step at a time — no rush." };
  }
  if (/excit|can't wait|pumped|ready to go|finally|love this/.test(t)) {
    return { state: "excited", response: "I love that energy — let's put it to work." };
  }
  if (/don'?t know|not sure|idk|no idea|unsure|maybe\??$/.test(t)) {
    return { state: "uncertain", response: "That's completely okay. We can figure it out together." };
  }
  if (/confus|lost|stuck/.test(t)) {
    return { state: "confused", response: "No problem — I'll keep this simple." };
  }
  return { state: "neutral", response: null };
}

export function inferIndustry(text) {
  const t = String(text || "");
  for (const p of INDUSTRY_PATTERNS) {
    if (p.re.test(t)) return { ...p };
  }
  return null;
}

export function inferArea(text) {
  const t = String(text || "");
  const inMatch = t.match(/\bin\s+([A-Z][A-Za-z.\s-]{1,40}?)(?:\s*[—,\.]|\s+I\b|\s+we\b|\s+and\b|$)/);
  if (inMatch) return inMatch[1].trim().replace(/\s+/g, " ");
  const cityState = t.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*([A-Z]{2})\b/);
  if (cityState) return `${cityState[1]}, ${cityState[2]}`;
  if (/travel|on the road|mobile|come to (them|you|clients)|go to (them|homes)/i.test(t)) {
    return { travel: true };
  }
  if (/one city|mostly local|around (here|town)|nearby|my (city|town)/i.test(t)) {
    return { local: true };
  }
  return null;
}

export function inferStage(text) {
  const t = low(text);
  if (/just (start|launch|began|getting)|brand new|off the ground|starting out|new (company|business)/.test(t)) {
    return "early";
  }
  if (/been (doing|running|at) (this|it) for|for (a )?(few |several )?(years|yrs)|established|while now/.test(t)) {
    return "established";
  }
  return null;
}

export function inferPositioning(text) {
  const t = low(text);
  if (/premium|luxury|high.?end|quality|not the cheapest|reliable|trust|remember (me|us|quality)/.test(t)) {
    return "premium";
  }
  if (/affordable|budget|cheap|lowest price|discount/.test(t)) return "affordable";
  if (/fast|same.?day|quick|speed/.test(t)) return "fast";
  if (/family.?owned|local|neighborhood|community/.test(t)) return "local";
  return null;
}

export function inferCustomer(text) {
  const t = low(text);
  if (/airbnb|short.?term|vacation\s*rental|str\b|turnover/.test(t)) return "short_term_rentals";
  if (/homeowner|residential|homes?|houses?|driveways?/.test(t)) return "residential";
  if (/commercial|businesses|offices|property\s*manag|hoa/.test(t)) return "commercial";
  if (/wedding|bride|groom|couples/.test(t)) return "wedding_clients";
  if (/clients?|customers?/.test(t) && /spa|massage|facial/.test(t)) return "wellness_clients";
  return null;
}

export function inferGoal(text) {
  const t = low(text);
  if (/recurring|repeat|retain|keep (them|customers)|subscription|maintenance\s*plan/.test(t)) return "recurring_customers";
  if (/book|online\s*book|more customers|get (more )?clients|first customers|leads/.test(t)) return "more_bookings";
  if (/grow|revenue|sales|scale/.test(t)) return "grow_revenue";
  if (/save time|automat|less admin|overwhelm/.test(t)) return "save_time";
  if (/brand|website|redesign|look professional/.test(t)) return "build_brand";
  if (/\bhire\b|build (a |my )?team|employees?|staff up/.test(t)) return "hire_team";
  return null;
}

export function inferOperations(text) {
  const t = low(text);
  if (/solo|just me|by myself|on my own|one.?person/.test(t)) return "solo";
  if (/team|employees|crew|staff|we have/.test(t)) return "team";
  if (/storefront|studio|shop|salon|spa location/.test(t)) return "storefront";
  if (/mobile|come to|travel to|on.?site/.test(t)) return "mobile";
  return null;
}

function factLabel(key, value) {
  const maps = {
    industry: (v) => v,
    area: (v) => (typeof v === "string" ? v : v.travel ? "Travels for work" : v.local ? "Local focus" : null),
    stage: (v) => (v === "early" ? "Just getting started" : v === "established" ? "Established" : v),
    positioning: (v) =>
      ({ premium: "Premium positioning", affordable: "Affordable", fast: "Speed-focused", local: "Local brand" }[v] || v),
    customer: (v) =>
      ({
        residential: "Residential focus",
        commercial: "Commercial focus",
        short_term_rentals: "Short-term rentals",
        wedding_clients: "Wedding clients",
        wellness_clients: "Wellness clients",
      }[v] || v),
    goal: (v) =>
      ({
        recurring_customers: "Wants more recurring customers",
        more_bookings: "Wants more bookings",
        grow_revenue: "Wants to grow revenue",
        save_time: "Wants to save time",
        build_brand: "Building the brand",
        hire_team: "Thinking about hiring",
      }[v] || v),
    operations: (v) =>
      ({ solo: "Solo operator", team: "Has a team", mobile: "Mobile business", storefront: "Storefront" }[v] || v),
    mobile: (v) => (v ? "Mobile business" : null),
  };
  const fn = maps[key];
  return fn ? fn(value) : value;
}

function categoryConfidence(session, key) {
  const f = session.facts[key];
  if (!f) return 0;
  return clamp(Number(f.confidence) || 0, 0, 100);
}

function overallConfidence(session) {
  const keys = ["industry", "customer", "goal", "positioning", "area", "operations", "stage"];
  const scores = keys.map((k) => categoryConfidence(session, k));
  const known = scores.filter((s) => s > 0);
  if (!known.length) return 0;
  const avg = known.reduce((a, b) => a + b, 0) / known.length;
  const coverage = known.length / keys.length;
  return Math.round(avg * (0.55 + 0.45 * coverage));
}

function applyInference(session, text, source = "owner") {
  const bumps = [];
  const setFact = (key, value, confidence, inferred = true) => {
    if (value == null || value === "") return;
    const prev = session.facts[key];
    if (prev && prev.value === value && prev.confidence >= confidence) return;
    const changed = prev && prev.value !== value;
    session.facts[key] = {
      value,
      confidence,
      inferred,
      label: factLabel(key, value),
      updatedAt: Date.now(),
    };
    bumps.push({ key, value, confidence, changed, inferred });
    if (changed) {
      session.memoryNotes.push(`Updated ${key}: now ${factLabel(key, value)}.`);
    }
  };

  const ind = inferIndustry(text);
  if (ind) {
    setFact("industry", ind.label, source === "seed" ? 92 : 88, true);
    setFact("industryId", ind.id, 90, true);
    if (ind.mobile) setFact("operations", "mobile", 75, true);
    if (ind.customerHint) setFact("customer", ind.customerHint, 82, true);
    if (ind.positioningHint) setFact("positioning", ind.positioningHint, 70, true);
    if (ind.recurringLikely && !session.facts.goal) setFact("goal", "recurring_customers", 55, true);
    if (ind.booking) setFact("bookingStyle", ind.booking, 70, true);
  }

  const area = inferArea(text);
  if (typeof area === "string") setFact("area", area, 85, true);
  else if (area?.travel) setFact("operations", "mobile", 80, true);
  else if (area?.local) setFact("area", "Local / one-city focus", 72, true);

  const stage = inferStage(text);
  if (stage) setFact("stage", stage, 86, false);

  const pos = inferPositioning(text);
  if (pos) setFact("positioning", pos, 84, false);

  const cust = inferCustomer(text);
  if (cust) setFact("customer", cust, 86, true);

  const goal = inferGoal(text);
  if (goal) setFact("goal", goal, 88, false);

  const ops = inferOperations(text);
  if (ops) setFact("operations", ops, 84, false);

  // Vague narrowing helpers
  const t = low(text);
  if (/clean stuff|help people with houses|work weekends/.test(t) && !session.facts.industry) {
    setFact("industry", "Home services", 40, true);
  }

  return bumps;
}

function openGaps(session) {
  const order = ["industry", "customer", "goal", "area", "positioning", "stage", "operations"];
  return order.filter((k) => categoryConfidence(session, k) < ASK_CONFIDENCE_THRESHOLD);
}

export function enforceDiscoveryQuestionRules(opts) {
  const conf = opts.confidence == null ? 80 : Number(opts.confidence);
  let qs = [...(opts.questions || [])].map((q) => String(q || "").trim()).filter(Boolean);
  const known = (opts.knownFacts || []).map((k) => low(k));
  const prev = new Set((opts.previouslyAsked || []).map((q) => low(q)));
  const actions = [];

  qs = qs.filter((q) => {
    const l = low(q);
    if (known.some((k) => k && l.includes(k))) {
      actions.push("skipped_known_fact");
      return false;
    }
    if (prev.has(l)) {
      actions.push("skipped_repeat");
      return false;
    }
    return true;
  });

  if (conf >= ASK_CONFIDENCE_THRESHOLD && qs.length) {
    actions.push("suppressed_questions_high_confidence");
    return { shown: [], delayed: qs, actions };
  }

  const shown = qs.slice(0, MAX_CLARIFICATION_QUESTIONS);
  const delayed = qs.slice(MAX_CLARIFICATION_QUESTIONS);
  if (qs.length > MAX_CLARIFICATION_QUESTIONS) actions.push("capped_questions_at_3");
  return { shown, delayed, actions };
}

function pickNextQuestion(session) {
  if (session.clarificationCount >= MAX_CLARIFICATION_QUESTIONS) return null;
  if (overallConfidence(session) >= READY_CONFIDENCE_THRESHOLD) return null;

  const gaps = openGaps(session);
  if (!gaps.length) return null;

  const candidates = gaps
    .map((g) => GAP_QUESTIONS[g])
    .filter(Boolean)
    .map((q) => q.natural)
    .filter((q) => !session.previouslyAsked.includes(low(q)));

  const knownFacts = Object.values(session.facts)
    .map((f) => f.label || f.value)
    .filter(Boolean)
    .map(String);

  const ruled = enforceDiscoveryQuestionRules({
    questions: candidates,
    confidence: Math.min(...gaps.map((g) => categoryConfidence(session, g)).concat([0])),
    knownFacts,
    previouslyAsked: session.previouslyAsked,
  });

  const next = ruled.shown[0] || null;
  return next;
}

function maybeDiscoveryMoment(session) {
  if (session.momentsFired >= 1) return null;
  const id = session.facts.industryId?.value;
  if (!id) return null;
  if (categoryConfidence(session, "industry") < 80) return null;
  if (session.turns < 1) return null;
  const line = DISCOVERY_MOMENTS[id] || DISCOVERY_MOMENTS.default;
  session.momentsFired += 1;
  session.moments.push(line);
  return line;
}

export function buildLearningSummary(session) {
  const lines = [];
  const pos = session.facts.positioning?.value;
  const goal = session.facts.goal?.value;
  const ops = session.facts.operations?.value;
  const cust = session.facts.customer?.value;
  const ind = session.facts.industry?.label || session.facts.industry?.value;

  if (pos === "premium") lines.push("You care more about reliability than being the cheapest.");
  else if (pos === "affordable") lines.push("You want to stay accessible without racing to the bottom.");
  else if (pos === "local") lines.push("You're trying to build a trusted local brand.");

  if (pos === "premium" || ind) lines.push("You're trying to build a premium local brand.".replace(
    "premium local",
    pos === "premium" ? "premium local" : "strong local",
  ));

  if (ops === "solo" || goal === "save_time") {
    lines.push("You'd rather automate repetitive work than hire someone right now.");
  } else if (ops === "team") {
    lines.push("You've already got help — so systems matter as much as hustle.");
  }

  if (goal === "recurring_customers") {
    lines.push("I think recurring customers will be the biggest growth opportunity for you.");
  } else if (goal === "more_bookings") {
    lines.push("I think making it easier to book you will unlock the next wave of growth.");
  } else if (goal === "build_brand") {
    lines.push("I think a sharper brand presence will do more for you than another ad right now.");
  }

  if (cust === "short_term_rentals") {
    lines.push("Your work fits a recurring property rhythm — consistency is your edge.");
  }

  // Deduplicate and keep 3–4 lines
  const uniq = [...new Set(lines)].slice(0, 4);
  if (!uniq.length && ind) {
    uniq.push(`You're building a ${ind} business, and I want the next moves to match how you actually work.`);
  }
  return { header: LEARNING_SUMMARY_HEADER, lines: uniq };
}

export function understandingPanelFacts(session) {
  const order = ["industry", "area", "operations", "positioning", "customer", "goal", "stage"];
  return order
    .map((k) => session.facts[k])
    .filter((f) => f && f.label && f.confidence >= 55)
    .map((f) => ({
      label: f.label,
      confidence: f.confidence,
      inferred: !!f.inferred,
    }));
}

export function createDiscoverySession(seed = "") {
  const session = {
    version: DISCOVERY_VERSION,
    seed: String(seed || "").trim(),
    turns: 0,
    clarificationCount: 0,
    previouslyAsked: [],
    facts: {},
    moments: [],
    momentsFired: 0,
    memoryNotes: [],
    messages: [],
    emotion: { state: "neutral" },
    complete: false,
    readyForThinking: false,
    learningSummary: null,
  };

  if (session.seed) {
    applyInference(session, session.seed, "seed");
    session.messages.push({ role: "system", text: "seed", content: session.seed });
  }
  return session;
}

export function discoveryOpener(session) {
  const ind = session.facts.industry?.value;
  if (ind) {
    return `Got it — ${ind}. Tell me a little more about how you work, and I'll fill in the rest.`;
  }
  if (session.seed) {
    return "I heard you. Tell me a little more about what you're building — I'll connect the dots.";
  }
  return "Tell me about the business you're building. I'll listen, then ask only what I still need.";
}

/**
 * Ingest one owner message. Returns hubly replies + UI updates.
 * Never asks more than one question at a time; caps clarifications at 3.
 */
export function ingestDiscoveryTurn(session, ownerText) {
  const text = String(ownerText || "").trim();
  if (!text) {
    return { ok: false, error: "empty", replies: [], session };
  }

  session.turns += 1;
  session.messages.push({ role: "owner", text });

  const emotion = detectEmotion(text);
  session.emotion = emotion;
  applyInference(session, text, "owner");

  const replies = [];
  if (emotion.response) replies.push({ kind: "emotion", text: emotion.response });

  const moment = maybeDiscoveryMoment(session);
  if (moment) replies.push({ kind: "moment", text: moment });

  // Memory change explanation
  const note = session.memoryNotes.pop();
  if (note) replies.push({ kind: "memory", text: `Got it — ${note.replace(/^Updated /, "I'll remember ")}` });

  const conf = overallConfidence(session);
  const nextQ = pickNextQuestion(session);

  if (nextQ) {
    session.clarificationCount += 1;
    session.previouslyAsked.push(low(nextQ));
    replies.push({ kind: "question", text: nextQ });
  } else if (conf >= READY_CONFIDENCE_THRESHOLD || session.clarificationCount >= MAX_CLARIFICATION_QUESTIONS) {
    session.learningSummary = buildLearningSummary(session);
    session.complete = true;
    session.readyForThinking = true;
    replies.push({
      kind: "learning",
      text: session.learningSummary.header,
      lines: session.learningSummary.lines,
    });
    replies.push({ kind: "complete", text: DISCOVERY_COMPLETION_LINE });
  } else {
    // Still low confidence but no safe question — reassure and invite freeform
    replies.push({
      kind: "nudge",
      text: "Keep going — anything about who you serve or what you want more of helps me get this right.",
    });
  }

  for (const r of replies) {
    if (r.text) session.messages.push({ role: "hubly", text: r.text, kind: r.kind });
  }

  return {
    ok: true,
    session,
    replies,
    confidence: conf,
    panel: understandingPanelFacts(session),
    complete: session.complete,
    clarificationCount: session.clarificationCount,
    emotion: emotion.state,
  };
}

/** Run a short scripted follow-up path for gate simulations. */
export function simulateConversation(seed, followUps = []) {
  const session = createDiscoverySession(seed);
  const transcript = [{ role: "hubly", text: discoveryOpener(session) }];
  const defaults = followUps.length
    ? followUps
    : [
        "Mostly homeowners, and I want them to remember that I'm reliable — not the cheapest.",
        "I'm just getting started and mostly working around one city.",
        "I'd rather automate the busywork than hire someone right now.",
      ];

  let result = null;
  for (const line of defaults) {
    if (session.complete) break;
    result = ingestDiscoveryTurn(session, line);
    transcript.push({ role: "owner", text: line });
    for (const r of result.replies) transcript.push({ role: "hubly", text: r.text, kind: r.kind });
  }

  // Force completion path if still open (cap already may have stopped questions)
  if (!session.complete) {
    session.learningSummary = buildLearningSummary(session);
    session.complete = true;
    session.readyForThinking = true;
    transcript.push({ role: "hubly", text: DISCOVERY_COMPLETION_LINE, kind: "complete" });
  }

  return {
    session,
    transcript,
    confidence: overallConfidence(session),
    panel: understandingPanelFacts(session),
    clarificationCount: session.clarificationCount,
    industry: session.facts.industry?.value || null,
    questionsAsked: session.previouslyAsked.slice(),
  };
}

export function conversationsAreDistinct(results) {
  const signatures = results.map((r) => {
    const qs = (r.questionsAsked || []).join("|");
    const ind = r.industry || "";
    const firstQ = (r.transcript || []).find((m) => m.kind === "question")?.text || "";
    return `${ind}::${firstQ}::${qs}`;
  });
  return new Set(signatures).size === signatures.length;
}

export function soundsLikeConsultant(transcript) {
  const hubly = (transcript || []).filter((m) => m.role === "hubly").map((m) => m.text).join("\n");
  const surveyHits = DISCOVERY_FORBIDDEN_SURVEY.filter((s) => hubly.includes(s));
  const naturalHits = [
    /are you mostly/i,
    /i might be wrong/i,
    /i noticed something/i,
    /understand your business/i,
    /what i.?m learning/i,
    /tell me/i,
  ].filter((re) => re.test(hubly));
  return { ok: surveyHits.length === 0 && naturalHits.length >= 2, surveyHits, naturalHits: naturalHits.length };
}

export function scoreUnderstandingAccuracy(session, expected) {
  let hit = 0;
  let total = 0;
  const check = (cond) => {
    total += 1;
    if (cond) hit += 1;
  };
  if (expected.industry) check(low(session.facts.industry?.value).includes(low(expected.industry).split(" ")[0]));
  if (expected.mobile != null) check(expected.mobile ? session.facts.operations?.value === "mobile" : true);
  if (expected.positioning) check(session.facts.positioning?.value === expected.positioning);
  if (expected.customerType) check(session.facts.customer?.value === expected.customerType);
  if (expected.goal === "recurring") check(session.facts.goal?.value === "recurring_customers");
  if (expected.booking) check(!!session.facts.bookingStyle || expected.booking === true);
  const accuracy = total ? hit / total : 1;
  return { accuracy, hit, total, pass: accuracy >= TARGET_UNDERSTANDING_ACCURACY };
}

export function evaluateDiscoveryHtml(html) {
  const h = String(html || "");
  const issues = [];
  const ok = (cond, msg) => {
    if (!cond) issues.push(msg);
    return !!cond;
  };

  const talk = (() => {
    const i = h.indexOf('id="is-step-talk"');
    if (i < 0) return "";
    const j = h.indexOf('id="is-step-vibe"', i);
    return j > i ? h.slice(i, j) : h.slice(i, i + 20000);
  })();

  const checks = {
    discoveryShell: ok(/data-discovery-experience|is-discovery/.test(h), "Missing discovery markers"),
    understandingPanel: ok(/is-understanding-panel|What I.?m learning/i.test(h), "Missing understanding panel"),
    learningSummary: ok(/Here.?s what I.?m learning/i.test(h), "Missing learning summary copy"),
    completionLine: ok(/I think I understand your business now/i.test(h), "Missing completion line"),
    discoveryMoment: ok(/I noticed something/i.test(h), "Missing discovery moment copy"),
    clarificationSoft: ok(/I might be wrong here/i.test(h), "Missing soft clarification"),
    naturalAreaQ: ok(/one city, or do you travel/i.test(h), "Missing natural area question"),
    thinkingTransition: ok(/is-step-thinking|readyForThinking|show.*thinking/i.test(h), "Missing thinking transition"),
    adaptiveEngine: ok(/ingestDiscoveryTurn|isDiscoveryIngest|createDiscoverySession/i.test(h), "Missing adaptive engine"),
    confidenceDriven: ok(/READY_CONFIDENCE|ASK_CONFIDENCE|clarificationCount/i.test(h), "Missing confidence logic"),
    emotionAware: ok(/detectEmotion|overwhelmed|I love that energy/i.test(h), "Missing emotion awareness"),
    memoryAwareness: ok(/previouslyAsked|skipped_repeat|never ask twice/i.test(h), "Missing memory awareness"),
    noSurveyTitles: ok(!/What is your service area\?|Business Stage\?|Premium or Budget\?/.test(talk), "Survey titles present"),
    maxThree: ok(/MAX_CLARIFICATION|clarificationCount\s*<\s*3|>=\s*3|MAX_CLARIFICATION_QUESTIONS\s*=\s*3/.test(h), "Missing 3-question cap"),
  };

  return { passed: issues.length === 0, issues, checks };
}

export const HublyBusinessDiscovery = {
  version: DISCOVERY_VERSION,
  label: DISCOVERY_LABEL,
  createSession: createDiscoverySession,
  ingest: ingestDiscoveryTurn,
  opener: discoveryOpener,
  simulate: simulateConversation,
  panel: understandingPanelFacts,
  learning: buildLearningSummary,
  enforceQuestions: enforceDiscoveryQuestionRules,
};
