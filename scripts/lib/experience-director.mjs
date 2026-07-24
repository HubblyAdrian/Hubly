/** Node mirror of hubly_brain_experience_director.ts — Section 2 + Identity (esbuild). */


// scripts/lib/identity-system.mjs
var HUBLY_IDENTITY_VERSION = "1.0.0";
var HUBLY_IS = [
  "calm",
  "confident",
  "curious",
  "helpful",
  "honest",
  "professional",
  "optimistic"
];
var HUBLY_NEVER = [
  "pushy",
  "arrogant",
  "robotic",
  "overly casual",
  "salesy"
];
var HUBLY_CONSTITUTION = [
  {
    id: "tell_the_truth",
    title: "Tell the truth",
    principle: "Tell the truth."
  },
  {
    id: "dont_pretend",
    title: "Don't pretend to know",
    principle: "Don't pretend to know."
  },
  {
    id: "explain_reasoning",
    title: "Explain reasoning",
    principle: "Explain reasoning."
  },
  {
    id: "respect_owner",
    title: "Respect the owner's decisions",
    principle: "Respect the owner's decisions."
  },
  {
    id: "prefer_simplicity",
    title: "Prefer simplicity",
    principle: "Prefer simplicity."
  },
  {
    id: "dont_overwhelm",
    title: "Don't overwhelm",
    principle: "Don't overwhelm."
  },
  {
    id: "build_confidence",
    title: "Build confidence, not dependency",
    principle: "Build confidence, not dependency."
  },
  {
    id: "recommend_dont_pressure",
    title: "Recommend, don't pressure",
    principle: "Recommend, don't pressure."
  },
  {
    id: "protect_the_business",
    title: "Protect the business",
    principle: "Protect the business."
  },
  {
    id: "leave_better_off",
    title: "Leave the owner better off",
    principle: "Leave the owner better off than before."
  }
];
var PUSHY_PATTERNS = [
  /\bact now\b/i,
  /\blimited[- ]time\b/i,
  /\byou (?:must|have to|need to) (?:buy|upgrade|pay)\b/i,
  /\bdon'?t miss out\b/i
];
var ARROGANT_PATTERNS = [
  /\bobviously\b/i,
  /\bas anyone (?:knows|can see)\b/i,
  /\byou'?re doing it wrong\b/i
];
var ROBOTIC_STATUS = [
  /^\s*feature created\.?\s*$/i,
  /^\s*booking rules updated\.?\s*$/i,
  /^\s*low review count detected\.?\s*$/i,
  /^\s*error\.?\s*$/i
];
var FAKE_CONFIDENCE = [
  /\bi(?:'m| am) (?:100%|completely) (?:sure|certain)\b/i,
  /\bthere(?:'s| is) no doubt\b/i,
  /\bguaranteed to\b/i
];
var JARGON = [
  { re: /\bCTA\b/g, replace: "Book button" },
  { re: /\bUX\b/g, replace: "experience" },
  { re: /\bAPI\b/g, replace: "connection" },
  { re: /\bLLM\b/gi, replace: "Hubly" },
  { re: /\bOpenAI\b/gi, replace: "Hubly" },
  { re: /\bAnthropic\b/gi, replace: "Hubly" }
];
function detectVoiceMode(opts) {
  if (opts?.mode) return opts.mode;
  const draft = String(opts?.draft || "");
  const r = `${opts?.request || ""} ${draft}`.toLowerCase();
  if (/^\s*error\.?\s*$/i.test(draft) || /i looked at this again|better approach|i was wrong|correction|changed my mind/.test(r)) {
    return "correction";
  }
  if (/^\s*feature created\.?\s*$/i.test(draft) || /^\s*booking rules updated\.?\s*$/i.test(draft) || /\bsettings (?:saved|updated)\b/i.test(draft) || /\bi (?:built|updated|created|added|changed) your\b/.test(r) || /\bbuilder\b/.test(r)) {
    return "builder";
  }
  if (/^\s*low review count detected\.?\s*$/i.test(draft) || /\breview|coach|grow|recommend asking|meaningful difference\b/.test(r)) {
    return "coaching";
  }
  if (opts?.celebrate || /first booking|published|connected|congratulations|celebrate/.test(r)) {
    return "celebration";
  }
  return "default";
}
function applyBuilderVoice(text) {
  let out = String(text || "").trim();
  const before = out;
  out = out.replace(/^\s*Feature created\.?\s*$/i, "I built that for you.");
  out = out.replace(
    /^\s*Booking rules updated\.?\s*$/i,
    "I updated your booking rules so customers can no longer schedule same-day appointments."
  );
  out = out.replace(/\bFeature created\b/gi, "I built that for you");
  out = out.replace(
    /\bBooking rules updated\b/gi,
    "I updated your booking rules so customers can no longer schedule same-day appointments"
  );
  out = out.replace(/\bSettings (?:saved|updated)\b/gi, "I saved those changes for you");
  return { text: out.trim(), changed: out !== before };
}
function applyCoachingVoice(text) {
  let out = String(text || "").trim();
  const before = out;
  out = out.replace(
    /^\s*Low review count detected\.?\s*$/i,
    "I think asking three recent customers for reviews would make a meaningful difference."
  );
  out = out.replace(
    /\bLow review count detected\b/gi,
    "I think asking three recent customers for reviews would make a meaningful difference"
  );
  out = out.replace(/\bMetric (?:alert|anomaly)\b/gi, "I noticed something worth improving");
  return { text: out.trim(), changed: out !== before };
}
function celebrationMessage(kind, detail) {
  switch (kind) {
    case "first_booking":
      return "Your first booking is in \u2014 that's the start of real momentum.";
    case "first_review":
      return "You earned your first review. That kind of proof builds trust fast.";
    case "revenue_10k":
      return "You've crossed $10k in revenue. That's a milestone worth noticing.";
    case "website_published":
      return "Your website is live. Customers can find you and book.";
    case "calendar_connected":
      return "Your calendar is connected \u2014 scheduling just got simpler.";
    case "customers_100":
      return "100 customers. You've built something people keep choosing.";
    default:
      return detail ? `Nice progress \u2014 ${detail}` : "That's a real win for the business.";
  }
}
function applyCelebrationVoice(text, kind) {
  const raw = String(text || "").trim();
  if (kind) {
    const msg = celebrationMessage(kind);
    if (!raw || /^(congrats|great job|awesome)[!.,]*$/i.test(raw)) {
      return { text: msg, changed: true };
    }
  }
  let out = raw;
  const before = out;
  out = out.replace(/\b🎉\b/g, "").replace(/\b!!!+\b/g, ".");
  out = out.replace(/\bAMAZING!!!?\b/gi, "That's a real win");
  return { text: out.replace(/\s{2,}/g, " ").trim(), changed: out !== before };
}
function applyCorrectionVoice(text) {
  let out = String(text || "").trim();
  const before = out;
  if (/^\s*Error\.?\s*$/i.test(out)) {
    out = "I looked at this again and I think there's a better approach.";
  } else {
    out = out.replace(/^\s*Error\.?\s*/i, "I looked at this again \u2014 ");
  }
  out = out.replace(/\bFailed to (?:process|execute)\b/gi, "I couldn't finish that the way I hoped");
  if (/changed my mind|better approach/i.test(out) && !/because|why|looked at this again/i.test(out)) {
    out = `I looked at this again and I think there's a better approach. ${out}`;
  }
  return { text: out.trim(), changed: out !== before };
}
function stripJargon(text) {
  let out = String(text || "");
  for (const { re, replace } of JARGON) out = out.replace(re, replace);
  return out.replace(/\s{2,}/g, " ").trim();
}
function evaluateAgainstConstitution(text) {
  const t = String(text || "");
  const low = t.toLowerCase();
  const violations = [];
  const actions = [];
  const fail = (id, reason) => {
    const p = HUBLY_CONSTITUTION.find((c) => c.id === id);
    if (p) {
      violations.push({ principleId: p.id, principle: p.principle, reason });
      actions.push(`violation:${id}`);
    }
  };
  if (FAKE_CONFIDENCE.some((re) => re.test(t))) {
    fail("dont_pretend", "Faked certainty");
    fail("tell_the_truth", "Overstated certainty");
  }
  if (/as an ai|language model|i cannot feel/i.test(t)) {
    fail("build_confidence", "Broke the one-partner identity");
  }
  if (PUSHY_PATTERNS.some((re) => re.test(t))) {
    fail("recommend_dont_pressure", "Pressured the owner");
  }
  if (/(?:here are|list of) (?:\d{2,}|ten|twelve|fifteen) (?:things|options|recommendations)/i.test(t)) {
    fail("dont_overwhelm", "Too many recommendations at once");
    fail("prefer_simplicity", "Complexity over simplicity");
  }
  if (/you (?:must|have to) (?:accept|approve|do this)/i.test(t)) {
    fail("respect_owner", "Did not leave room for the owner's decision");
  }
  if (/^\s*error\.?\s*$/i.test(t) || /\bstack trace\b/i.test(t)) {
    fail("leave_better_off", "Left the owner with a raw error");
  }
  if (/\bi recommend\b/i.test(t) && !/\bbecause\b|\bso that\b|\bthis (?:should|will|can)\b|\bimpact\b|\bwhy\b/i.test(t)) {
    fail("explain_reasoning", "Recommendation without expected impact / why");
  }
  if (/fake reviews|hide fees from customers|ghost customers/i.test(low)) {
    fail("protect_the_business", "Suggestion could harm the business or customers");
  }
  const principlesChecked = HUBLY_CONSTITUTION.map((c) => c.id);
  const score = Math.max(0, Math.round(100 - violations.length / principlesChecked.length * 100));
  return {
    ok: violations.length === 0,
    score,
    violations,
    principlesChecked: [...principlesChecked],
    actions
  };
}
function applyHublyIdentity(draft, opts) {
  const actions = [];
  let text = stripJargon(String(draft || "").trim());
  if (text !== String(draft || "").trim()) actions.push("stripped_jargon");
  if (ROBOTIC_STATUS.some((re) => re.test(text)) || /\bfeature created\b|\bbooking rules updated\b/i.test(text)) {
    if (/error/i.test(text) && /^\s*error\.?\s*$/i.test(text)) {
      const c = applyCorrectionVoice(text);
      text = c.text;
      if (c.changed) actions.push("correction_voice");
    } else if (/review count detected/i.test(text)) {
      const c = applyCoachingVoice(text);
      text = c.text;
      if (c.changed) actions.push("coaching_voice");
    } else {
      const b = applyBuilderVoice(text);
      text = b.text;
      if (b.changed) actions.push("builder_voice");
    }
  }
  const mode = detectVoiceMode({
    mode: opts?.mode,
    request: opts?.request,
    draft: text,
    celebrate: opts?.celebrate
  });
  if (mode === "builder" && !actions.includes("builder_voice")) {
    const b = applyBuilderVoice(text);
    text = b.text;
    if (b.changed) actions.push("builder_voice");
  } else if (mode === "coaching" && !actions.includes("coaching_voice")) {
    const c = applyCoachingVoice(text);
    text = c.text;
    if (c.changed) actions.push("coaching_voice");
  } else if (mode === "celebration") {
    const c = applyCelebrationVoice(text, opts?.celebrationKind);
    text = c.text;
    if (c.changed) actions.push("celebration_voice");
  } else if (mode === "correction" && !actions.includes("correction_voice")) {
    const c = applyCorrectionVoice(text);
    text = c.text;
    if (c.changed) actions.push("correction_voice");
  }
  for (const re of PUSHY_PATTERNS) {
    if (re.test(text)) {
      text = text.replace(re, "").replace(/\s{2,}/g, " ").trim();
      actions.push("removed_pushy");
    }
  }
  for (const re of ARROGANT_PATTERNS) {
    if (re.test(text)) {
      text = text.replace(re, "").replace(/\s{2,}/g, " ").trim();
      actions.push("removed_arrogant");
    }
  }
  for (const re of FAKE_CONFIDENCE) {
    if (re.test(text)) {
      text = text.replace(re, "I think").replace(/\s{2,}/g, " ").trim();
      actions.push("tempered_fake_confidence");
    }
  }
  if (!text) {
    text = "I'm putting together a clear next step for your business.";
    actions.push("identity_fallback");
  }
  let constitution = evaluateAgainstConstitution(text);
  if (constitution.violations.some((v) => v.principleId === "explain_reasoning")) {
    if (/\bi recommend\b/i.test(text) && !/\bbecause\b/i.test(text)) {
      text = `${text.replace(/\.*$/, "")} \u2014 because it should move the business forward with less friction.`;
      actions.push("added_why_for_constitution");
      constitution = evaluateAgainstConstitution(text);
    }
  }
  if (constitution.violations.some((v) => v.principleId === "leave_better_off")) {
    const c = applyCorrectionVoice(text);
    text = c.text;
    actions.push("constitution_correction_voice");
    constitution = evaluateAgainstConstitution(text);
  }
  if (constitution.violations.some((v) => v.principleId === "recommend_dont_pressure")) {
    text = text.replace(/\bact now\b/gi, "").replace(/\blimited[- ]time offer\b/gi, "option").replace(/\s{2,}/g, " ").trim();
    if (!text) text = "Here's a recommendation when you're ready \u2014 no pressure.";
    actions.push("constitution_removed_pressure");
    constitution = evaluateAgainstConstitution(text);
  }
  actions.push("evaluated_constitution");
  return {
    text,
    voiceMode: mode,
    constitution,
    actions,
    rewrites: [...actions],
    identityVersion: HUBLY_IDENTITY_VERSION
  };
}

// supabase/functions/_shared/hubly_brain_experience_director.ts
var EXPERIENCE_DIRECTOR_VERSION = "1.2.0";
var ED_MAX_QUESTIONS = 3;
var ED_MAX_OWNER_LINES = 3;
var ED_MAX_HOMEPAGE_SECTIONS = 4;
var ED_MAX_DASHBOARD_WIDGETS = 1;
var ED_MAX_WEBSITE_SETTINGS_EXPOSED = 0;
var ED_MAX_RESPONSE_CHARS = 520;
var ED_COMPLEXITY_VETO_THRESHOLD = 70;
var HUBLY_PERSONALITY = {
  voice: "one_business_partner",
  identityVersion: HUBLY_IDENTITY_VERSION,
  traits: [...HUBLY_IS],
  never: [...HUBLY_NEVER, "overly_technical", "multi_ai", "settings_dump"],
  constitution: true
};
var TECHNICAL_PATTERNS = [
  { re: /\bLLM\b/gi, replace: "Hubly" },
  { re: /\bOpenAI\b/gi, replace: "Hubly" },
  { re: /\bAnthropic\b/gi, replace: "Hubly" },
  { re: /\bGPT-?\d[\w.-]*/gi, replace: "Hubly" },
  { re: /\bClaude\b/gi, replace: "Hubly" },
  { re: /\bAPI\b/g, replace: "connection" },
  { re: /\bJSON\b/gi, replace: "details" },
  { re: /\bhero(?:\s+section)?\b/gi, replace: "first screen" },
  { re: /\bCTA\b/g, replace: "Book button" },
  { re: /\bUX\b/g, replace: "experience" },
  { re: /\bUI\b/g, replace: "screen" },
  { re: /\borchestrat(?:e|or|ion)\b/gi, replace: "plan" },
  { re: /\bprompt\b/gi, replace: "note" },
  { re: /\btoken(?:s)?\b/gi, replace: "words" },
  { re: /\binference\b/gi, replace: "thinking" },
  { re: /\bmodel\b/gi, replace: "Hubly" },
  { re: /\bexpert(?:s)?\b/gi, replace: "Hubly" },
  { re: /\bpipeline\b/gi, replace: "process" },
  { re: /\bas an AI\b/gi, replace: "" },
  { re: /\bI am an AI\b/gi, replace: "I'm Hubly" },
  { re: /\bmultiple (?:AI|systems|agents)\b/gi, replace: "Hubly" }
];
var ROBOTIC_PATTERNS = [
  /as an ai/i,
  /i am (?:an )?ai/i,
  /language model/i,
  /according to my (?:training|programming)/i,
  /i cannot (?:feel|experience)/i,
  /certainly[!.,]/i,
  /absolutely[!.,]?\s+i(?:'d| would) be happy to/i
];
var INTERCEPTION_LOG = [];
var MAX_INTERCEPTIONS = 200;
function clamp(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}
function stripTechnicalLanguage(text) {
  let out = String(text || "");
  for (const { re, replace } of TECHNICAL_PATTERNS) {
    out = out.replace(re, replace);
  }
  out = out.replace(/\bHubly(?:\s+Hubly)+\b/g, "Hubly");
  return out.replace(/\s{2,}/g, " ").trim();
}
function enforceHublyPersonality(text) {
  let out = stripTechnicalLanguage(text);
  let fixed = out !== String(text || "").trim();
  for (const re of ROBOTIC_PATTERNS) {
    if (re.test(out)) {
      out = out.replace(re, "").replace(/\s{2,}/g, " ").trim();
      fixed = true;
    }
  }
  if (/research expert|creative director|strategy expert|our (?:ai|agents)/i.test(out)) {
    out = out.replace(/research expert|creative director|strategy expert/gi, "Hubly").replace(/our (?:ai|agents)/gi, "I").replace(/\s{2,}/g, " ").trim();
    fixed = true;
  }
  return { text: out, fixed };
}
function limitQuestions(questions) {
  const all = (questions || []).map((q) => stripTechnicalLanguage(String(q || "").trim())).filter(Boolean);
  const unique = [];
  for (const q of all) {
    if (!unique.some((u) => u.toLowerCase() === q.toLowerCase())) unique.push(q);
  }
  return {
    shown: unique.slice(0, ED_MAX_QUESTIONS),
    delayed: unique.slice(ED_MAX_QUESTIONS),
    limited: unique.length > ED_MAX_QUESTIONS
  };
}
function shouldCelebrate(request, criticOk) {
  if (criticOk === false) return false;
  return /build|website|luxury|launch|publish|first customer|booked|live/i.test(String(request || ""));
}
function evaluateExperience(input) {
  const questions = (input.proposedQuestions || []).length;
  const settings = (input.websiteSettings || []).length;
  const widgets = (input.dashboardWidgets || []).length;
  const sections = (input.homepageSections || []).length;
  const draft = String(input.draftResponse || (input.draftLines || []).join(" "));
  const unnecessaryQuestions = clamp(questions / 10 * 100);
  const unnecessaryUiExposure = clamp((settings + widgets) / 20 * 100);
  const complexity = clamp(
    questions * 6 + settings * 4 + widgets * 5 + sections * 3 + (draft.length > 600 ? 20 : 0)
  );
  let clarity = 85;
  if (draft.length > 600) clarity -= 25;
  if (/LLM|API|JSON|orchestrat|pipeline|token/i.test(draft)) clarity -= 20;
  clarity = clamp(clarity);
  let conversationalQuality = 80;
  if (settings > 5) conversationalQuality -= 40;
  if (questions > ED_MAX_QUESTIONS) conversationalQuality -= 20;
  if (ROBOTIC_PATTERNS.some((re) => re.test(draft))) conversationalQuality -= 30;
  conversationalQuality = clamp(conversationalQuality);
  let emotionalTone = 75;
  if (shouldCelebrate(input.request, input.criticOk)) emotionalTone = 90;
  if (ROBOTIC_PATTERNS.some((re) => re.test(draft))) emotionalTone -= 25;
  emotionalTone = clamp(emotionalTone);
  const softwareFeelRisk = clamp(
    complexity * 0.35 + unnecessaryUiExposure * 0.25 + unnecessaryQuestions * 0.2 + (100 - conversationalQuality) * 0.2
  );
  return {
    complexity,
    clarity,
    conversationalQuality,
    emotionalTone,
    unnecessaryQuestions,
    unnecessaryUiExposure,
    softwareFeelRisk
  };
}
function settingsToConversation(settings) {
  const n = settings.length;
  if (n <= 0) return "";
  const sample = settings.slice(0, 3).join(", ");
  return `I noticed there are a lot of site options (${n}). Instead of a settings wall, let's pick the one that matters most right now \u2014 starting with ${sample}${n > 3 ? ", and the rest when you're ready" : ""}.`;
}
function listExperienceInterceptions(limit = 40) {
  const n = Math.max(1, Math.min(200, limit));
  return INTERCEPTION_LOG.slice(-n).map((r) => ({
    ...r,
    actions: [...r.actions],
    before: { ...r.before },
    after: { ...r.after }
  }));
}
function clearExperienceInterceptionsForTests() {
  INTERCEPTION_LOG.length = 0;
}
function applyExperienceDirector(input) {
  const actions = ["reviewed"];
  const evaluation = evaluateExperience(input);
  const before = {
    response: String(input.draftResponse || (input.draftLines || []).join(" ") || ""),
    questionCount: (input.proposedQuestions || []).length,
    settingCount: (input.websiteSettings || []).length,
    widgetCount: (input.dashboardWidgets || []).length,
    sectionCount: (input.homepageSections || []).length
  };
  let vetoed = false;
  let vetoReason = null;
  if (evaluation.softwareFeelRisk >= ED_COMPLEXITY_VETO_THRESHOLD || evaluation.complexity >= ED_COMPLEXITY_VETO_THRESHOLD) {
    vetoed = true;
    vetoReason = "Overly complex customer-facing interaction \u2014 simplified to one Hubly conversation.";
    actions.push("vetoed_complexity");
  }
  const draftLines = (input.draftLines || []).map((l) => enforceHublyPersonality(String(l || "").trim()).text).filter(Boolean);
  let extraLines = [];
  let ownerLines = draftLines;
  if (ownerLines.length > ED_MAX_OWNER_LINES) {
    extraLines = ownerLines.slice(ED_MAX_OWNER_LINES);
    ownerLines = ownerLines.slice(0, ED_MAX_OWNER_LINES);
    actions.push(`delayed_${extraLines.length}_extra_lines`);
  }
  let response = String(input.draftResponse || "").trim();
  if (response) {
    const personality = enforceHublyPersonality(response);
    response = personality.text;
    if (personality.fixed) actions.push("enforced_hubly_personality");
  } else if (ownerLines.length) {
    response = ownerLines.join(" ");
  } else {
    response = "I've got a direction \u2014 tell me anything I should know before I build.";
    actions.push("fallback_response");
  }
  let identity = applyHublyIdentity(response, {
    request: input.request,
    celebrate: shouldCelebrate(input.request, input.criticOk)
  });
  response = identity.text;
  actions.push(...identity.actions.map((a) => `identity_${a}`));
  if (!identity.constitution.ok) actions.push("constitution_violations_detected");
  const allSettings = (input.websiteSettings || []).map((s) => String(s || "").trim()).filter(Boolean);
  let delayedSettings = [];
  if (allSettings.length > ED_MAX_WEBSITE_SETTINGS_EXPOSED) {
    delayedSettings = allSettings;
    const convo = settingsToConversation(allSettings);
    response = response ? `${response} ${convo}` : convo;
    actions.push(`converted_${allSettings.length}_settings_to_conversation`);
    vetoed = true;
    vetoReason = vetoReason || `Rejected ${allSettings.length} exposed website settings \u2014 converted to conversation.`;
  }
  if (response.length > ED_MAX_RESPONSE_CHARS) {
    response = response.slice(0, ED_MAX_RESPONSE_CHARS - 1).trimEnd() + "\u2026";
    actions.push("truncated_response");
  }
  const q = limitQuestions(input.proposedQuestions);
  if (q.limited) actions.push(`limited_questions_to_${ED_MAX_QUESTIONS}`);
  const allSections = (input.homepageSections || []).map((s) => String(s || "").trim()).filter(Boolean);
  const shownSections = allSections.slice(0, ED_MAX_HOMEPAGE_SECTIONS);
  const delayedSections = allSections.slice(ED_MAX_HOMEPAGE_SECTIONS);
  if (delayedSections.length) {
    actions.push(`show_${shownSections.length}_of_${allSections.length}_homepage_sections`);
  }
  const allWidgets = (input.dashboardWidgets || []).map((s) => String(s || "").trim()).filter(Boolean);
  const shownWidgets = allWidgets.slice(0, ED_MAX_DASHBOARD_WIDGETS);
  const delayedWidgets = allWidgets.slice(ED_MAX_DASHBOARD_WIDGETS);
  if (delayedWidgets.length) {
    actions.push(`show_${shownWidgets.length}_of_${allWidgets.length}_dashboard_widgets`);
    vetoed = true;
    vetoReason = vetoReason || `Hid ${delayedWidgets.length} dashboard widgets \u2014 one recommendation only.`;
  }
  const rawJoined = (input.draftLines || []).join(" ");
  if (rawJoined && stripTechnicalLanguage(rawJoined) !== rawJoined.replace(/\s{2,}/g, " ").trim()) {
    actions.push("rewrote_technical_language");
  }
  if (input.draftResponse && stripTechnicalLanguage(input.draftResponse) !== String(input.draftResponse).trim()) {
    if (!actions.includes("rewrote_technical_language")) actions.push("rewrote_technical_language");
  }
  const celebrate = shouldCelebrate(input.request, input.criticOk);
  if (celebrate) {
    actions.push("celebrate");
    if (!/nice work|great|congratulations|you did it|proud/i.test(response)) {
      response = `${response} Nice work \u2014 this is a real milestone.`.trim();
    }
  }
  const after = {
    response,
    questionCount: q.shown.length,
    settingCount: 0,
    widgetCount: shownWidgets.length,
    sectionCount: shownSections.length
  };
  const modified = before.response.trim() !== after.response.trim() || before.questionCount !== after.questionCount || before.settingCount !== after.settingCount || before.widgetCount !== after.widgetCount || before.sectionCount !== after.sectionCount || actions.length > 1;
  if (modified) actions.push("modified_response");
  identity = applyHublyIdentity(response, {
    request: input.request,
    celebrate
  });
  response = identity.text;
  after.response = response;
  const constitution = evaluateAgainstConstitution(response);
  const checks = [
    { name: "identity_system", ok: true, detail: `v${HUBLY_IDENTITY_VERSION}` },
    {
      name: "hubly_constitution",
      ok: constitution.ok,
      detail: constitution.ok ? "all principles satisfied" : constitution.violations.map((v) => v.principleId).join(",")
    }
  ];
  const result = {
    version: EXPERIENCE_DIRECTOR_VERSION,
    ownerResponse: response,
    finalResponse: response,
    questions: q.shown,
    celebrate,
    hideDetails: true,
    vetoed,
    vetoReason,
    evaluation,
    delayed: {
      homepageSections: delayedSections,
      dashboardWidgets: delayedWidgets,
      websiteSettings: delayedSettings,
      extraLines,
      extraQuestions: q.delayed
    },
    shown: {
      homepageSections: shownSections,
      dashboardWidgets: shownWidgets,
      websiteSettings: []
    },
    actions,
    confidence: clamp(input.confidence != null ? Number(input.confidence) : 78),
    reviewedBy: "experience_director",
    personality: HUBLY_PERSONALITY,
    identity: {
      ...identity,
      constitution: {
        ...constitution,
        principlesChecked: constitution.principlesChecked
      }
    },
    checks,
    interception: { before, after, modified }
  };
  const logEntry = {
    id: `ed_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    at: (/* @__PURE__ */ new Date()).toISOString(),
    modified,
    vetoed,
    actions: [...actions],
    before,
    after
  };
  INTERCEPTION_LOG.push(logEntry);
  while (INTERCEPTION_LOG.length > MAX_INTERCEPTIONS) INTERCEPTION_LOG.shift();
  return result;
}
function reviewCustomerFacingText(text, opts) {
  return applyExperienceDirector({
    request: opts?.request || null,
    draftResponse: text,
    confidence: opts?.confidence ?? 80,
    criticOk: true
  });
}
var ExperienceDirector = {
  version: EXPERIENCE_DIRECTOR_VERSION,
  evaluate: applyExperienceDirector,
  apply: applyExperienceDirector,
  reviewText: reviewCustomerFacingText
};
var HublyExperienceDirector = {
  version: EXPERIENCE_DIRECTOR_VERSION,
  apply: applyExperienceDirector,
  evaluate: applyExperienceDirector,
  reviewText: reviewCustomerFacingText,
  stripTechnicalLanguage,
  enforceHublyPersonality,
  limitQuestions,
  shouldCelebrate,
  evaluateExperience,
  settingsToConversation,
  listInterceptions: listExperienceInterceptions,
  clearInterceptionsForTests: clearExperienceInterceptionsForTests,
  personality: HUBLY_PERSONALITY,
  caps: {
    maxQuestions: ED_MAX_QUESTIONS,
    maxOwnerLines: ED_MAX_OWNER_LINES,
    maxHomepageSections: ED_MAX_HOMEPAGE_SECTIONS,
    maxDashboardWidgets: ED_MAX_DASHBOARD_WIDGETS,
    maxWebsiteSettingsExposed: ED_MAX_WEBSITE_SETTINGS_EXPOSED,
    maxResponseChars: ED_MAX_RESPONSE_CHARS,
    complexityVetoThreshold: ED_COMPLEXITY_VETO_THRESHOLD
  }
};
export {
  ED_COMPLEXITY_VETO_THRESHOLD,
  ED_MAX_DASHBOARD_WIDGETS,
  ED_MAX_HOMEPAGE_SECTIONS,
  ED_MAX_OWNER_LINES,
  ED_MAX_QUESTIONS,
  ED_MAX_RESPONSE_CHARS,
  ED_MAX_WEBSITE_SETTINGS_EXPOSED,
  EXPERIENCE_DIRECTOR_VERSION,
  ExperienceDirector,
  HUBLY_PERSONALITY,
  HublyExperienceDirector,
  applyExperienceDirector,
  clearExperienceInterceptionsForTests,
  enforceHublyPersonality,
  evaluateExperience,
  limitQuestions,
  listExperienceInterceptions,
  reviewCustomerFacingText,
  settingsToConversation,
  shouldCelebrate,
  stripTechnicalLanguage
};
