/**
 * Milestone 2 · Epic 6 — Delayed Account Creation
 *
 * Saving the business — not signing up for software.
 */
export const DELAYED_ACCOUNT_VERSION = "1.0.0";
export const DELAYED_ACCOUNT_LABEL = "Delayed Account Creation";

export const SAVE_BUSINESS_HEADLINE = "I'd love to save everything we've built together.";
export const SAVE_BUSINESS_ALT = "Let's save your business.";
export const VERSION_SAVED_LINE = "Version 1.0 — Day One has been safely saved.";
export const PERSONAL_WELCOME = "This business is now yours.";
export const LAUNCH_FORWARD = "Ready? Let's launch your business.";
export const RECOVERY_LINE = "No worries. Everything we built is still here. Let's try that again.";
export const SECURITY_LINE =
  "I sent you a quick email so we can make sure nobody else can access your business.";
export const FOUNDER_MOMENT_LEAD = "Congratulations.";
export const FOUNDER_MOMENT_SUB = "Every great business starts somewhere. This is yours.";
export const LAUNCH_CTA = "Launch My Business";

export const SAVE_MANIFEST = [
  "Your website",
  "Your booking experience",
  "Your brand",
  "Your Business Memory",
  "Your conversation",
  "Your workspace",
  "Version 1.0 — Day One",
];

export const AUTH_OPTIONS = [
  { id: "google", label: "Continue with Google" },
  { id: "apple", label: "Continue with Apple" },
  { id: "email", label: "Continue with Email" },
];

export const FORBIDDEN_SAAS = [
  "Create Account",
  "Sign Up",
  "Register",
  "Account Created Successfully",
  "Create your account",
];

export const FOUNDER_CHECKLIST = [
  { id: "website", label: "Website Created" },
  { id: "booking", label: "Booking Ready" },
  { id: "strategy", label: "Business Strategy" },
  { id: "brand", label: "Brand Identity" },
  { id: "memory", label: "Business Memory" },
  { id: "v1", label: "Version 1.0 Archived" },
];

export function soundsLikeHublySave(text) {
  const t = String(text || "");
  return /save (your |the )?business|save everything|this business is now yours|day one|launch my business|officially started/i.test(
    t,
  );
}

export function hasSaasSignupLanguage(text) {
  const t = String(text || "");
  // Match SaaS CTAs as standalone phrases — not the words inside Hubly explanations.
  return (
    /\bCreate Account\b/i.test(t) ||
    /\bSign Up\b/i.test(t) ||
    /\bRegister\b(?!\s+as)/i.test(t) ||
    /\bAccount Created Successfully\b/i.test(t) ||
    /\bCreate your account\b/i.test(t)
  );
}

export function buildOwnershipCertificate(ctx = {}) {
  const owner =
    ctx.ownerName ||
    ctx.firstName ||
    (ctx.email ? String(ctx.email).split("@")[0] : null) ||
    "You";
  const prettyOwner = String(owner)
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
  return {
    owner: prettyOwner,
    business: ctx.businessName || ctx.biz || "Your Business",
    created: ctx.createdLabel || "Today",
    version: "1.0",
  };
}

export function buildFounderMoment(ctx = {}) {
  const biz = ctx.businessName || ctx.biz || "Your Business";
  return {
    lead: FOUNDER_MOMENT_LEAD,
    headline: `Today you officially started`,
    businessName: biz,
    dayOneLabel: "Day One",
    checklist: FOUNDER_CHECKLIST.map((c) => ({ ...c, done: true })),
    closing: FOUNDER_MOMENT_SUB,
    cta: LAUNCH_CTA,
  };
}

/**
 * Orchestrate delayed account save flow payload.
 */
export function orchestrateDelayedAccount(ctx = {}) {
  const certificate = buildOwnershipCertificate(ctx);
  const founderMoment = buildFounderMoment(ctx);
  const firstName = certificate.owner.split(/\s+/)[0] || "there";

  return {
    version: DELAYED_ACCOUNT_VERSION,
    headline: SAVE_BUSINESS_HEADLINE,
    altHeadline: SAVE_BUSINESS_ALT,
    manifest: [...SAVE_MANIFEST],
    authOptions: AUTH_OPTIONS.map((a) => ({ ...a })),
    versionSaved: VERSION_SAVED_LINE,
    personalWelcome: `Welcome, ${firstName}.`,
    ownershipLine: PERSONAL_WELCOME,
    certificate,
    founderMoment,
    securityLine: SECURITY_LINE,
    recoveryLine: RECOVERY_LINE,
    launchForward: LAUNCH_FORWARD,
    launchCta: LAUNCH_CTA,
    requiredBusinessFields: 0,
    preservesDraft: true,
    noDashboardFirst: true,
    signature: [certificate.business, certificate.owner, "v1"].join("::"),
  };
}

export function evaluateDelayedAccountHtml(html) {
  const h = String(html || "");
  const issues = [];
  const ok = (cond, msg) => {
    if (!cond) issues.push(msg);
    return !!cond;
  };

  const slice = (() => {
    const i = h.indexOf('id="is-step-save-business"');
    if (i < 0) return "";
    const j = h.indexOf('id="is-step-vibe"', i);
    return j > i ? h.slice(i, j) : h.slice(i, i + 40000);
  })();

  const checks = {
    saveCanvas: ok(/data-delayed-account|is-save-business|id="is-step-save-business"/.test(h), "Missing save business step"),
    saveLanguage: ok(/Let's save your business|save everything we've built|I'd love to save/i.test(h), "Missing save language"),
    noSignupCopy: ok(
      !/\bCreate Account\b|\bSign Up\b|\bAccount Created Successfully\b|\bCreate your account\b/i.test(slice) &&
        !/\bRegister\b/i.test(slice),
      "SaaS signup language in save flow",
    ),
    manifest: ok(
      SAVE_MANIFEST.every((m) => h.includes(m)) || /Business Memory|Version 1\.0 — Day One/.test(h),
      "Missing save manifest",
    ),
    authGoogle: ok(/Continue with Google/.test(h), "Missing Google"),
    authApple: ok(/Continue with Apple/.test(h), "Missing Apple"),
    authEmail: ok(/Continue with Email/.test(h), "Missing Email"),
    versionSaved: ok(/Version 1\.0 — Day One has been safely saved/.test(h), "Missing v1 confirmation"),
    ownershipCert: ok(/is-save-certificate|Owner[\s\S]{0,40}Business|certificate/.test(h), "Missing ownership certificate"),
    personalWelcome: ok(/This business is now yours|Welcome,/.test(h), "Missing personal welcome"),
    founderMoment: ok(
      /is-step-founder-moment|Congratulations\.|Today you officially started|Launch My Business/.test(h),
      "Missing Founder Moment",
    ),
    recovery: ok(/Everything we built is still here|No worries/.test(h), "Missing recovery copy"),
    security: ok(/I sent you a quick email|nobody else can access/.test(h), "Missing security copy"),
    launchForward: ok(/Let's launch your business|Launch My Business|readyForLaunch/.test(h), "Missing launch transition"),
    revealHandoff: ok(
      /isStartDelayedAccount|isRunDelayedAccount|readyForAccount[\s\S]{0,200}isStartDelayedAccount|is-reveal-forward[\s\S]{0,400}isStartDelayedAccount/.test(
        h,
      ),
      "Reveal not handing off to Delayed Account",
    ),
    draftPersist: ok(/persistInstantSiteDraft|HUBLY_IS_DRAFT|preservesDraft/.test(h), "Missing draft persistence"),
    wordmark: ok(/hubly-wordmark/.test(slice) || /is-save-brand/.test(h), "Missing Hubly brand"),
  };

  return { passed: issues.length === 0, issues, checks };
}

export const HublyDelayedAccount = {
  version: DELAYED_ACCOUNT_VERSION,
  label: DELAYED_ACCOUNT_LABEL,
  orchestrate: orchestrateDelayedAccount,
  certificate: buildOwnershipCertificate,
  founderMoment: buildFounderMoment,
  manifest: SAVE_MANIFEST,
};
