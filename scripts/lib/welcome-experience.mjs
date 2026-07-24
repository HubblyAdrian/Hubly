/**
 * Milestone 2 · Epic 1 — Welcome Experience (Node mirror for gates)
 *
 * Front door metrics + copy constants. UI lives in public/hubly.html.
 */
export const WELCOME_VERSION = "1.0.0";
export const WELCOME_LABEL = "Welcome Experience";
export const WELCOME_PATH = "/signup";
export const FIRST_IMPRESSION_WINDOW_MS = 15000;
export const TIME_TO_FIRST_CONVERSATION_TARGET_MS = 10000;
export const ACCOUNT_FIELDS_REQUIRED = 0;

export const WELCOME_PROMPTS = [
  "I'm starting a pressure washing company.",
  "I want to grow my photography business.",
  "I clean Airbnb properties.",
  "I just launched my HVAC company.",
  "Help me redesign my website.",
  "I want more recurring customers.",
];

export const WELCOME_TRUST_OUTCOMES = [
  "Website built with AI",
  "Booking ready",
  "Business partner included",
  "Takes about 3 minutes",
];

export const WELCOME_BUSINESSES = [
  "Pressure Washing",
  "Photography",
  "Lawn Care",
  "Spa",
  "Cleaning",
  "HVAC",
];

export const WELCOME_COPY = [
  "Let's build your business.",
  "What are we building today?",
  "Tell me what you're working on.",
  "I'll take care of the rest.",
  "We can always change it later.",
  "You're not signing up.",
  "You're building something.",
];

export const WELCOME_FORBIDDEN_UI = [
  "Create your account",
  "Email",
  "Password",
  "Business name",
  "Industry",
  "Address",
  "Step 1 of",
  "progress bar",
];

export const WELCOME_FORBIDDEN_CRM = [
  "Dashboard",
  "CRM",
  "Customers",
  "Calendar",
  "Jobs",
  "Revenue",
  "Settings",
];

export function soundsLikeWelcomeHubly(text) {
  const t = String(text || "");
  return /build your business|what are we building|take care of the rest|change it later|you're building|you're not signing|tell me what you're working/i.test(t);
}

export function evaluateWelcomeHtml(html) {
  const h = String(html || "");
  const signup = (() => {
    const i = h.indexOf('id="p-signup"');
    if (i < 0) return "";
    const j = h.indexOf('id="p-onboard"', i);
    return j > i ? h.slice(i, j) : h.slice(i, i + 12000);
  })();

  const issues = [];
  const ok = (cond, msg) => {
    if (!cond) issues.push(msg);
    return !!cond;
  };

  const checks = {
    welcomeShell: ok(/welcome-shell|data-welcome-experience/.test(signup), "Missing welcome shell"),
    heroConversation: ok(/What are we building today/i.test(signup) && /Let's build your business/i.test(signup), "Missing hero conversation"),
    largeInput: ok(/id="welcome-input"/.test(signup), "Missing conversation input"),
    zeroAccountFields: ok(
      !/<input[^>]+type=["']?(email|password|tel)["']/i.test(signup) &&
        ACCOUNT_FIELDS_REQUIRED === 0 &&
        /data-account-fields=["']0["']/.test(signup),
      "Account fields still present",
    ),
    noClassicSignupCta: ok(!/su-start-instant|Create your account|Get started →/.test(signup), "Classic signup CTA remains"),
    trustOutcomes: ok(WELCOME_TRUST_OUTCOMES.every((t) => signup.includes(t)), "Trust strip incomplete"),
    inspiration: ok(
      WELCOME_BUSINESSES.every((b) => h.includes(b)) || /WELCOME_BUSINESSES/.test(h),
      "Inspiration businesses missing",
    ),
    firstImpressionTimer: ok(/is-first-impression|First Impression Timer|15000/.test(h), "First Impression Timer missing"),
    noCrmInWelcome: ok(!/\b(CRM|Dashboard|Revenue|Settings|Calendar|Jobs)\b/i.test(signup), "CRM terminology in welcome"),
    microinteractions: ok(/welcome-chip|welcome-typing|welcome-send/.test(signup), "Microinteractions missing"),
    brandMark: ok(/hub<span>ly<\/span>/.test(signup), "Hubly wordmark missing"),
  };
  return {
    passed: issues.length === 0,
    checks,
    issues,
    accountFieldsRequired: ACCOUNT_FIELDS_REQUIRED,
    firstImpressionWindowMs: FIRST_IMPRESSION_WINDOW_MS,
    timeToFirstConversationTargetMs: TIME_TO_FIRST_CONVERSATION_TARGET_MS,
  };
}

export const HublyWelcomeExperience = {
  version: WELCOME_VERSION,
  label: WELCOME_LABEL,
  path: WELCOME_PATH,
  prompts: WELCOME_PROMPTS,
  trust: WELCOME_TRUST_OUTCOMES,
  businesses: WELCOME_BUSINESSES,
  copy: WELCOME_COPY,
  evaluateHtml: evaluateWelcomeHtml,
  soundsLikeHubly: soundsLikeWelcomeHubly,
};
