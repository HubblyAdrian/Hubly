/**
 * Hubly Brain — Experience Director (Milestone 1 · Section 2)
 *
 * First-class expert. Protects the customer experience.
 * Does NOT generate websites, strategies, or CRM actions.
 * Every customer-facing Hubly response must pass through here before return.
 *
 * Authority: veto power over customer-facing complexity.
 * Personality: one Hubly — calm, confident, proactive, conversational, never robotic.
 */
export const EXPERIENCE_DIRECTOR_VERSION = "1.2.0";
/** Hard caps — Simplicity Wins (Release Gate). */
export const ED_MAX_QUESTIONS = 3;
export const ED_MAX_OWNER_LINES = 3;
export const ED_MAX_HOMEPAGE_SECTIONS = 4;
export const ED_MAX_DASHBOARD_WIDGETS = 1;
export const ED_MAX_WEBSITE_SETTINGS_EXPOSED = 0; // settings become conversation, never a settings dump
export const ED_MAX_RESPONSE_CHARS = 520;
export const ED_COMPLEXITY_VETO_THRESHOLD = 70;
/** Hubly personality — Experience Director is the guardian. */
export const HUBLY_PERSONALITY = {
    voice: "one_business_partner",
    traits: ["calm", "confident", "proactive", "conversational", "helpful"],
    never: ["robotic", "overly_technical", "multi_ai", "settings_dump"],
};
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
    { re: /\bas an AI\b/gi, replace: "" },
    { re: /\bI am an AI\b/gi, replace: "I'm Hubly" },
    { re: /\bmultiple (?:AI|systems|agents)\b/gi, replace: "Hubly" },
];
const ROBOTIC_PATTERNS = [
    /as an ai/i,
    /i am (?:an )?ai/i,
    /language model/i,
    /according to my (?:training|programming)/i,
    /i cannot (?:feel|experience)/i,
    /certainly[!.,]/i,
    /absolutely[!.,]?\s+i(?:'d| would) be happy to/i,
];
const INTERCEPTION_LOG = [];
const MAX_INTERCEPTIONS = 200;
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
export function enforceHublyPersonality(text) {
    let out = stripTechnicalLanguage(text);
    let fixed = out !== String(text || "").trim();
    for (const re of ROBOTIC_PATTERNS) {
        if (re.test(out)) {
            out = out.replace(re, "").replace(/\s{2,}/g, " ").trim();
            fixed = true;
        }
    }
    // Never sound like multiple systems
    if (/research expert|creative director|strategy expert|our (?:ai|agents)/i.test(out)) {
        out = out
            .replace(/research expert|creative director|strategy expert/gi, "Hubly")
            .replace(/our (?:ai|agents)/gi, "I")
            .replace(/\s{2,}/g, " ")
            .trim();
        fixed = true;
    }
    return { text: out, fixed };
}
export function limitQuestions(questions) {
    const all = (questions || []).map((q) => stripTechnicalLanguage(String(q || "").trim())).filter(Boolean);
    const unique = [];
    for (const q of all) {
        if (!unique.some((u) => u.toLowerCase() === q.toLowerCase()))
            unique.push(q);
    }
    return {
        shown: unique.slice(0, ED_MAX_QUESTIONS),
        delayed: unique.slice(ED_MAX_QUESTIONS),
        limited: unique.length > ED_MAX_QUESTIONS,
    };
}
export function shouldCelebrate(request, criticOk) {
    if (criticOk === false)
        return false;
    return /build|website|luxury|launch|publish|first customer|booked|live/i.test(String(request || ""));
}
/**
 * Evaluate whether a draft feels like software vs a business partner.
 * Higher scores = more risk / more problems.
 */
export function evaluateExperience(input) {
    const questions = (input.proposedQuestions || []).length;
    const settings = (input.websiteSettings || []).length;
    const widgets = (input.dashboardWidgets || []).length;
    const sections = (input.homepageSections || []).length;
    const draft = String(input.draftResponse || (input.draftLines || []).join(" "));
    const unnecessaryQuestions = clamp((questions / 10) * 100);
    const unnecessaryUiExposure = clamp(((settings + widgets) / 20) * 100);
    const complexity = clamp(questions * 6 + settings * 4 + widgets * 5 + sections * 3 + (draft.length > 600 ? 20 : 0));
    let clarity = 85;
    if (draft.length > 600)
        clarity -= 25;
    if (/LLM|API|JSON|orchestrat|pipeline|token/i.test(draft))
        clarity -= 20;
    clarity = clamp(clarity);
    let conversationalQuality = 80;
    if (settings > 5)
        conversationalQuality -= 40;
    if (questions > ED_MAX_QUESTIONS)
        conversationalQuality -= 20;
    if (ROBOTIC_PATTERNS.some((re) => re.test(draft)))
        conversationalQuality -= 30;
    conversationalQuality = clamp(conversationalQuality);
    let emotionalTone = 75;
    if (shouldCelebrate(input.request, input.criticOk))
        emotionalTone = 90;
    if (ROBOTIC_PATTERNS.some((re) => re.test(draft)))
        emotionalTone -= 25;
    emotionalTone = clamp(emotionalTone);
    const softwareFeelRisk = clamp((complexity * 0.35) +
        (unnecessaryUiExposure * 0.25) +
        (unnecessaryQuestions * 0.2) +
        ((100 - conversationalQuality) * 0.2));
    return {
        complexity,
        clarity,
        conversationalQuality,
        emotionalTone,
        unnecessaryQuestions,
        unnecessaryUiExposure,
        softwareFeelRisk,
    };
}
/** Convert a settings dump into one calm conversational prompt. */
export function settingsToConversation(settings) {
    const n = settings.length;
    if (n <= 0)
        return "";
    const sample = settings.slice(0, 3).join(", ");
    return `I noticed there are a lot of site options (${n}). Instead of a settings wall, let's pick the one that matters most right now — starting with ${sample}${n > 3 ? ", and the rest when you're ready" : ""}.`;
}
export function listExperienceInterceptions(limit = 40) {
    const n = Math.max(1, Math.min(200, limit));
    return INTERCEPTION_LOG.slice(-n).map((r) => ({
        ...r,
        actions: [...r.actions],
        before: { ...r.before },
        after: { ...r.after },
    }));
}
export function clearExperienceInterceptionsForTests() {
    INTERCEPTION_LOG.length = 0;
}
/**
 * Core Experience Director pass — pure, deterministic, testable.
 * Vetoes complexity, enforces one Hubly personality, logs interceptions.
 */
export function applyExperienceDirector(input) {
    const actions = ["reviewed"];
    const evaluation = evaluateExperience(input);
    const before = {
        response: String(input.draftResponse || (input.draftLines || []).join(" ") || ""),
        questionCount: (input.proposedQuestions || []).length,
        settingCount: (input.websiteSettings || []).length,
        widgetCount: (input.dashboardWidgets || []).length,
        sectionCount: (input.homepageSections || []).length,
    };
    let vetoed = false;
    let vetoReason = null;
    if (evaluation.softwareFeelRisk >= ED_COMPLEXITY_VETO_THRESHOLD || evaluation.complexity >= ED_COMPLEXITY_VETO_THRESHOLD) {
        vetoed = true;
        vetoReason = "Overly complex customer-facing interaction — simplified to one Hubly conversation.";
        actions.push("vetoed_complexity");
    }
    const draftLines = (input.draftLines || [])
        .map((l) => enforceHublyPersonality(String(l || "").trim()).text)
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
        const personality = enforceHublyPersonality(response);
        response = personality.text;
        if (personality.fixed)
            actions.push("enforced_hubly_personality");
    }
    else if (ownerLines.length) {
        response = ownerLines.join(" ");
    }
    else {
        response = "I've got a direction — tell me anything I should know before I build.";
        actions.push("fallback_response");
    }
    // Website settings dump → conversation (never expose settings panel to owner)
    const allSettings = (input.websiteSettings || []).map((s) => String(s || "").trim()).filter(Boolean);
    let delayedSettings = [];
    if (allSettings.length > ED_MAX_WEBSITE_SETTINGS_EXPOSED) {
        delayedSettings = allSettings;
        const convo = settingsToConversation(allSettings);
        response = response ? `${response} ${convo}` : convo;
        actions.push(`converted_${allSettings.length}_settings_to_conversation`);
        vetoed = true;
        vetoReason = vetoReason || `Rejected ${allSettings.length} exposed website settings — converted to conversation.`;
    }
    if (response.length > ED_MAX_RESPONSE_CHARS) {
        response = response.slice(0, ED_MAX_RESPONSE_CHARS - 1).trimEnd() + "…";
        actions.push("truncated_response");
    }
    const q = limitQuestions(input.proposedQuestions);
    if (q.limited)
        actions.push(`limited_questions_to_${ED_MAX_QUESTIONS}`);
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
        vetoReason = vetoReason || `Hid ${delayedWidgets.length} dashboard widgets — one recommendation only.`;
    }
    const rawJoined = (input.draftLines || []).join(" ");
    if (rawJoined && stripTechnicalLanguage(rawJoined) !== rawJoined.replace(/\s{2,}/g, " ").trim()) {
        actions.push("rewrote_technical_language");
    }
    if (input.draftResponse && stripTechnicalLanguage(input.draftResponse) !== String(input.draftResponse).trim()) {
        if (!actions.includes("rewrote_technical_language"))
            actions.push("rewrote_technical_language");
    }
    const celebrate = shouldCelebrate(input.request, input.criticOk);
    if (celebrate) {
        actions.push("celebrate");
        if (!/nice work|great|congratulations|you did it|proud/i.test(response)) {
            response = `${response} Nice work — this is a real milestone.`.trim();
        }
    }
    const after = {
        response,
        questionCount: q.shown.length,
        settingCount: 0,
        widgetCount: shownWidgets.length,
        sectionCount: shownSections.length,
    };
    const modified = before.response.trim() !== after.response.trim() ||
        before.questionCount !== after.questionCount ||
        before.settingCount !== after.settingCount ||
        before.widgetCount !== after.widgetCount ||
        before.sectionCount !== after.sectionCount ||
        actions.length > 1;
    if (modified)
        actions.push("modified_response");
    const result = {
        version: EXPERIENCE_DIRECTOR_VERSION,
        ownerResponse: response,
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
            extraQuestions: q.delayed,
        },
        shown: {
            homepageSections: shownSections,
            dashboardWidgets: shownWidgets,
            websiteSettings: [],
        },
        actions,
        confidence: clamp(input.confidence != null ? Number(input.confidence) : 78),
        reviewedBy: "experience_director",
        personality: HUBLY_PERSONALITY,
        interception: { before, after, modified },
    };
    const logEntry = {
        id: `ed_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        at: new Date().toISOString(),
        modified,
        vetoed,
        actions: [...actions],
        before,
        after,
    };
    INTERCEPTION_LOG.push(logEntry);
    while (INTERCEPTION_LOG.length > MAX_INTERCEPTIONS)
        INTERCEPTION_LOG.shift();
    return result;
}
/** Review freeform customer-facing text (chat / coach replies) through ED. */
export function reviewCustomerFacingText(text, opts) {
    return applyExperienceDirector({
        request: opts?.request || null,
        draftResponse: text,
        confidence: opts?.confidence ?? 80,
        criticOk: true,
    });
}
export const HublyExperienceDirector = {
    version: EXPERIENCE_DIRECTOR_VERSION,
    apply: applyExperienceDirector,
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
        complexityVetoThreshold: ED_COMPLEXITY_VETO_THRESHOLD,
    },
};
