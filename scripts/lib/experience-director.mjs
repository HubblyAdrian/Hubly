/**
 * Node-portable Experience Director rules (Section 2 behavioral evidence).
 * Keep in sync with supabase/functions/_shared/hubly_brain_experience_director.ts
 * The Section 2 check verifies constants match between both files.
 */

export const EXPERIENCE_DIRECTOR_VERSION = "1.1.0";

export const ED_MAX_QUESTIONS = 2;
export const ED_MAX_OWNER_LINES = 3;
export const ED_MAX_HOMEPAGE_SECTIONS = 4;
export const ED_MAX_DASHBOARD_WIDGETS = 1;
export const ED_MAX_RESPONSE_CHARS = 520;

const TECHNICAL_PATTERNS = [
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
];

function clamp(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function stripTechnicalLanguage(text) {
  let out = String(text || "");
  for (const { re, replace } of TECHNICAL_PATTERNS) {
    out = out.replace(re, replace);
  }
  out = out.replace(/\bHubly(?:\s+Hubly)+\b/g, "Hubly");
  return out.replace(/\s{2,}/g, " ").trim();
}

export function limitQuestions(questions) {
  const all = (questions || []).map((q) => stripTechnicalLanguage(String(q || "").trim())).filter(Boolean);
  const unique = [];
  for (const q of all) {
    if (!unique.some((u) => u.toLowerCase() === q.toLowerCase())) unique.push(q);
  }
  return {
    shown: unique.slice(0, ED_MAX_QUESTIONS),
    delayed: unique.slice(ED_MAX_QUESTIONS),
    limited: unique.length > ED_MAX_QUESTIONS,
  };
}

export function shouldCelebrate(request, criticOk) {
  if (criticOk === false) return false;
  return /build|website|luxury|launch|publish|first customer|booked|live/i.test(String(request || ""));
}

export function applyExperienceDirector(input = {}) {
  const actions = ["reviewed"];
  const draftLines = (input.draftLines || [])
    .map((l) => stripTechnicalLanguage(String(l || "").trim()))
    .filter(Boolean);

  let extraLines = [];
  let ownerLines = draftLines;
  if (ownerLines.length > ED_MAX_OWNER_LINES) {
    extraLines = ownerLines.slice(ED_MAX_OWNER_LINES);
    ownerLines = ownerLines.slice(0, ED_MAX_OWNER_LINES);
    actions.push(`delayed_${extraLines.length}_extra_lines`);
  }

  let response = String(input.draftResponse || "").trim();
  if (response) {
    response = stripTechnicalLanguage(response);
  } else if (ownerLines.length) {
    response = ownerLines.join(" ");
  } else {
    response = "I've got a direction — tell me anything I should know before I build.";
    actions.push("fallback_response");
  }

  if (response.length > ED_MAX_RESPONSE_CHARS) {
    response = response.slice(0, ED_MAX_RESPONSE_CHARS - 1).trimEnd() + "…";
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
  }

  const rawJoined = (input.draftLines || []).join(" ");
  if (rawJoined && stripTechnicalLanguage(rawJoined) !== rawJoined.replace(/\s{2,}/g, " ").trim()) {
    actions.push("rewrote_technical_language");
  }
  if (input.draftResponse && stripTechnicalLanguage(input.draftResponse) !== String(input.draftResponse).trim()) {
    if (!actions.includes("rewrote_technical_language")) actions.push("rewrote_technical_language");
  }

  const celebrate = shouldCelebrate(input.request, input.criticOk);
  if (celebrate) actions.push("celebrate");

  const confidence = clamp(input.confidence != null ? Number(input.confidence) : 78);

  return {
    version: EXPERIENCE_DIRECTOR_VERSION,
    ownerResponse: response,
    questions: q.shown,
    celebrate,
    hideDetails: true,
    delayed: {
      homepageSections: delayedSections,
      dashboardWidgets: delayedWidgets,
      extraLines,
      extraQuestions: q.delayed,
    },
    shown: {
      homepageSections: shownSections,
      dashboardWidgets: shownWidgets,
    },
    actions,
    confidence,
    reviewedBy: "experience_director",
  };
}

export const HublyExperienceDirector = {
  version: EXPERIENCE_DIRECTOR_VERSION,
  apply: applyExperienceDirector,
  stripTechnicalLanguage,
  limitQuestions,
  shouldCelebrate,
  caps: {
    maxQuestions: ED_MAX_QUESTIONS,
    maxOwnerLines: ED_MAX_OWNER_LINES,
    maxHomepageSections: ED_MAX_HOMEPAGE_SECTIONS,
    maxDashboardWidgets: ED_MAX_DASHBOARD_WIDGETS,
    maxResponseChars: ED_MAX_RESPONSE_CHARS,
  },
};
