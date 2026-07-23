/**
 * Hubly Brain — Experience Director (Milestone 1 · Section 2)
 *
 * Protects the human experience. Every customer-facing Hubly response
 * must pass through applyExperienceDirector before the owner sees it.
 *
 * Experts never talk to customers — Experience Director does (as Hubly).
 */

export const EXPERIENCE_DIRECTOR_VERSION = "1.1.0" as const;

/** Hard caps — Simplicity Wins. */
export const ED_MAX_QUESTIONS = 2;
export const ED_MAX_OWNER_LINES = 3;
export const ED_MAX_HOMEPAGE_SECTIONS = 4;
export const ED_MAX_DASHBOARD_WIDGETS = 1;
export const ED_MAX_RESPONSE_CHARS = 520;

/** Technical / internal language owners should never see. */
const TECHNICAL_PATTERNS: Array<{ re: RegExp; replace: string }> = [
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

export type ExperienceDirectorInput = {
  request?: string | null;
  /** Draft lines / summaries from other experts (before owner sees them). */
  draftLines?: string[] | null;
  /** Clarifying questions proposed by other experts. */
  proposedQuestions?: string[] | null;
  /** Homepage sections Creative wants to show. */
  homepageSections?: string[] | null;
  /** Dashboard widgets Operations wants to show. */
  dashboardWidgets?: string[] | null;
  /** Critic said proceed? */
  criticOk?: boolean | null;
  confidence?: number | null;
  /** Optional already-formed draft response (fast paths). */
  draftResponse?: string | null;
};

export type ExperienceDirectorResult = {
  version: typeof EXPERIENCE_DIRECTOR_VERSION;
  ownerResponse: string;
  questions: string[];
  celebrate: boolean;
  hideDetails: boolean;
  /** Non-essential content delayed until later. */
  delayed: {
    homepageSections: string[];
    dashboardWidgets: string[];
    extraLines: string[];
    extraQuestions: string[];
  };
  shown: {
    homepageSections: string[];
    dashboardWidgets: string[];
  };
  /** What ED changed for Brain Console / evidence. */
  actions: string[];
  confidence: number;
  reviewedBy: "experience_director";
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function stripTechnicalLanguage(text: string): string {
  let out = String(text || "");
  for (const { re, replace } of TECHNICAL_PATTERNS) {
    out = out.replace(re, replace);
  }
  // Collapse doubled Hubly after replacements
  out = out.replace(/\bHubly(?:\s+Hubly)+\b/g, "Hubly");
  return out.replace(/\s{2,}/g, " ").trim();
}

export function limitQuestions(questions: string[] | null | undefined): {
  shown: string[];
  delayed: string[];
  limited: boolean;
} {
  const all = (questions || []).map((q) => stripTechnicalLanguage(String(q || "").trim())).filter(Boolean);
  const unique: string[] = [];
  for (const q of all) {
    if (!unique.some((u) => u.toLowerCase() === q.toLowerCase())) unique.push(q);
  }
  return {
    shown: unique.slice(0, ED_MAX_QUESTIONS),
    delayed: unique.slice(ED_MAX_QUESTIONS),
    limited: unique.length > ED_MAX_QUESTIONS,
  };
}

export function shouldCelebrate(request: string | null | undefined, criticOk?: boolean | null): boolean {
  if (criticOk === false) return false;
  return /build|website|luxury|launch|publish|first customer|booked|live/i.test(String(request || ""));
}

/**
 * Core Experience Director pass — pure, deterministic, testable.
 * This is the gate every customer-facing response must clear.
 */
export function applyExperienceDirector(input: ExperienceDirectorInput): ExperienceDirectorResult {
  const actions: string[] = ["reviewed"];
  const draftLines = (input.draftLines || [])
    .map((l) => stripTechnicalLanguage(String(l || "").trim()))
    .filter(Boolean);

  let extraLines: string[] = [];
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

  // Prefer plain language — if stripping changed draft lines, note it
  const rawJoined = (input.draftLines || []).join(" ");
  if (rawJoined && stripTechnicalLanguage(rawJoined) !== rawJoined.replace(/\s{2,}/g, " ").trim()) {
    actions.push("rewrote_technical_language");
  }
  if (input.draftResponse && stripTechnicalLanguage(input.draftResponse) !== String(input.draftResponse).trim()) {
    if (!actions.includes("rewrote_technical_language")) actions.push("rewrote_technical_language");
  }

  const celebrate = shouldCelebrate(input.request, input.criticOk);
  if (celebrate) actions.push("celebrate");

  const confidence = clamp(
    input.confidence != null
      ? Number(input.confidence)
      : 78,
  );

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
