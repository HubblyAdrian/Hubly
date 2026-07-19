/**
 * Job understanding — infer industry, service, add-ons, priority, preferences.
 * Hubly should understand the job before asking anything.
 */

import {
  detectPreferences,
  durationForService,
  EMPTY_PREFERENCES,
  filterSmartFollowUps,
  mergePreferences,
  preferenceLabels,
  reasonForAddOn,
  reasonForService,
  timingLabel,
  type CustomerPreferences,
} from "./marketplace_industry_knowledge.ts";

export type JobUnderstanding = {
  industry: string | null;
  category: string | null;
  service: string | null;
  add_ons: string[];
  possible_add_ons: string[];
  priority: string | null;
  vehicle_type: string | null;
  property_type: "residential" | "commercial" | null;
  understanding_summary: string | null;
  known: string[];
  missing: string[];
  /** Natural-language why for the primary recommendation */
  advisor_reason: string | null;
  /** Why lines for each recommended add-on */
  add_on_reasons: Record<string, string>;
  duration_estimate: string | null;
  preferences: CustomerPreferences;
  /** Bullets for "Did we get this right?" */
  confirmation_bullets: string[];
};

export type JobConfirmation = {
  headline: string;
  bullets: string[];
  /** Structured Your Booking card (preferred UI) */
  summary: {
    title: string;
    rows: Array<{ label: string; value: string }>;
    pending: Array<{ label: string; value: string }>;
  } | null;
  actions: Array<"Looks good" | "Edit" | "Add another service" | "Continue">;
  pre_match_summary: string;
};

const EMPTY_JOB: JobUnderstanding = {
  industry: null,
  category: null,
  service: null,
  add_ons: [],
  possible_add_ons: [],
  priority: null,
  vehicle_type: null,
  property_type: null,
  understanding_summary: null,
  known: [],
  missing: [],
  advisor_reason: null,
  add_on_reasons: {},
  duration_estimate: null,
  preferences: { ...EMPTY_PREFERENCES },
  confirmation_bullets: [],
};

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function enrichJob(job: JobUnderstanding, rawText: string, cityHint?: string | null): JobUnderstanding {
  const prefs = mergePreferences(detectPreferences(rawText), job.preferences);
  const advisor_reason = job.advisor_reason ||
    reasonForService(job.category, job.service);
  const add_on_reasons: Record<string, string> = { ...job.add_on_reasons };
  for (const a of job.add_ons) {
    if (!add_on_reasons[a]) {
      const r = reasonForAddOn(job.category, a);
      if (r) add_on_reasons[a] = r;
    }
  }
  const duration_estimate = job.duration_estimate ||
    durationForService(job.category, job.service);

  const hasCity = !!(cityHint || /\bin\s+[A-Z][a-z]+/.test(rawText));
  const hasWhen = !!timingLabel(null, rawText);
  const hasServiceClarity = !!job.service;
  const missing = filterSmartFollowUps(job.missing, {
    hasCity,
    hasWhen,
    hasServiceClarity,
  });

  const confirmation_bullets = buildConfirmationBullets({
    ...job,
    preferences: prefs,
    duration_estimate,
  }, rawText);

  return {
    ...job,
    preferences: prefs,
    advisor_reason,
    add_on_reasons,
    duration_estimate,
    missing,
    confirmation_bullets,
  };
}

export function buildConfirmationBullets(
  job: JobUnderstanding,
  rawText = "",
): string[] {
  const bullets: string[] = [];
  if (job.service) bullets.push(job.service);
  for (const a of job.add_ons) bullets.push(a);
  if (job.duration_estimate) bullets.push(job.duration_estimate);
  const timing = timingLabel(null, rawText);
  if (timing) bullets.push(timing);
  for (const p of preferenceLabels(job.preferences)) {
    if (!bullets.includes(p)) bullets.push(p);
  }
  if (job.vehicle_type && !bullets.some((b) => b.toLowerCase().includes(job.vehicle_type!))) {
    bullets.push(`${job.vehicle_type[0].toUpperCase()}${job.vehicle_type.slice(1)}`);
  }
  return bullets.slice(0, 6);
}

export function buildJobConfirmation(
  job: JobUnderstanding,
  rawText = "",
  opts?: { when?: string | null; city?: string | null },
): JobConfirmation {
  // Lazy import avoided — build summary inline to keep job module free of cycles
  const bullets = job.confirmation_bullets.length
    ? job.confirmation_bullets
    : buildConfirmationBullets(job, rawText);
  const lines = bullets.map((b) => `• ${b}`).join("\n");
  const timing = (() => {
    const t = (opts?.when || "") + " " + rawText;
    if (/asap|today|tonight|urgent|same.?day/i.test(t)) return "ASAP";
    if (/this week/i.test(t)) return "This week";
    if (/next week/i.test(t)) return "Next week";
    if (/weekend|saturday|sunday/i.test(t)) return "Weekend";
    if (/flexible/i.test(t)) return "Flexible";
    return null;
  })();
  const rows: Array<{ label: string; value: string }> = [];
  if (job.vehicle_type) {
    rows.push({
      label: "Vehicle",
      value: job.vehicle_type.charAt(0).toUpperCase() + job.vehicle_type.slice(1),
    });
  }
  if (job.service) rows.push({ label: "Service", value: job.service });
  for (const a of job.add_ons) rows.push({ label: "Recommended add-on", value: a });
  if (job.property_type) {
    rows.push({
      label: "Property",
      value: job.property_type.charAt(0).toUpperCase() + job.property_type.slice(1),
    });
  }
  if (job.preferences.mobile_only) rows.push({ label: "Service style", value: "Mobile service" });
  if (timing) rows.push({ label: "Preferred time", value: timing });
  if (opts?.city) rows.push({ label: "Location", value: opts.city });

  return {
    headline: "Your Booking",
    bullets,
    summary: {
      title: "Your Booking",
      rows,
      pending: [
        { label: "Appointment", value: "To be selected" },
        { label: "Provider", value: "To be selected" },
      ],
    },
    actions: ["Looks good", "Edit", "Add another service", "Continue"],
    pre_match_summary: `Your Booking\n${lines}`,
  };
}

/** Deterministic understanding from customer text (works without LLM). */
export function understandJobFromText(raw: string, cityHint?: string | null): JobUnderstanding {
  const text = String(raw || "").trim();
  const t = normalize(text);
  if (!t) return { ...EMPTY_JOB, preferences: { ...EMPTY_PREFERENCES } };

  let job: JobUnderstanding = { ...EMPTY_JOB, preferences: { ...EMPTY_PREFERENCES } };

  // —— Auto detailing / odor ——
  if (
    /smoke|smells? like|cigarette|cigar|odor|odour|stink|stinks|musty cabin/i.test(t) &&
    /truck|car|suv|van|vehicle|auto|cab|interior/i.test(t)
  ) {
    const vehicle = /truck/i.test(t)
      ? "truck"
      : (/suv/i.test(t) ? "suv" : (/van/i.test(t) ? "van" : (/car/i.test(t) ? "car" : "vehicle")));
    const missing: string[] = [];
    if (!/\b(today|tomorrow|asap|this week|next week|flexible|\d{4}-\d{2}-\d{2})\b/i.test(t)) {
      missing.push("When would you like it done?");
    }
    if (!cityHint && !/\bin\s+[A-Z][a-z]+/.test(text)) {
      missing.push("What city is the vehicle in?");
    }
    job = {
      ...EMPTY_JOB,
      industry: "Auto Detailing",
      category: "detailing",
      service: "Interior Detail",
      add_ons: ["Odor Removal"],
      possible_add_ons: ["Shampoo Extraction", "Ozone treatment"],
      priority: "Interior over Exterior",
      vehicle_type: vehicle,
      understanding_summary:
        `Used ${vehicle} with smoke odor → Interior Detail + Odor Removal (interior first)`,
      known: [
        "Industry: Auto Detailing",
        "Service: Interior Detail",
        "Add-on: Odor Removal",
        "Priority: Interior over Exterior",
        `Vehicle: ${vehicle}`,
      ],
      missing,
      preferences: { ...EMPTY_PREFERENCES },
      advisor_reason: null,
      add_on_reasons: {},
      duration_estimate: null,
      confirmation_bullets: [],
    };
    return enrichJob(job, text, cityHint);
  }

  if (
    /detail|detailing|ceramic|paint correction|car wash|truck wash/i.test(t) ||
    (/\b(truck|car|suv|van)\b/i.test(t) && /clean|wash|filthy|dirty|mud/i.test(t))
  ) {
    const vehicle = /truck/i.test(t)
      ? "truck"
      : (/suv/i.test(t) ? "suv" : (/van/i.test(t) ? "van" : (/car/i.test(t) ? "car" : null)));
    const wantsInterior = /interior|inside|cabin|seats|carpet/i.test(t);
    const wantsExterior = /exterior|outside|wash|wax|paint|ceramic/i.test(t);
    let service = "Full Detail";
    let priority: string | null = null;
    if (wantsInterior && !wantsExterior) {
      service = "Interior Detail";
      priority = "Interior over Exterior";
    } else if (wantsExterior && !wantsInterior) {
      service = "Exterior Detail";
      priority = "Exterior over Interior";
    }
    const missing: string[] = [];
    if (!wantsInterior && !wantsExterior) missing.push("Interior, exterior, or both?");
    if (!cityHint && !/\bin\s+[A-Z][a-z]+/.test(text)) missing.push("What city?");
    if (!/\b(today|tomorrow|asap|this week|flexible)\b/i.test(t)) {
      missing.push("When would you like it?");
    }
    job = {
      ...EMPTY_JOB,
      industry: "Auto Detailing",
      category: "detailing",
      service,
      add_ons: [],
      possible_add_ons: ["Ceramic coating", "Engine bay clean"],
      priority,
      vehicle_type: vehicle,
      understanding_summary: vehicle ? `${vehicle} detailing → ${service}` : `Auto detailing → ${service}`,
      known: ["Industry: Auto Detailing", `Service: ${service}`],
      missing,
      preferences: { ...EMPTY_PREFERENCES },
      advisor_reason: null,
      add_on_reasons: {},
      duration_estimate: null,
      confirmation_bullets: [],
    };
    return enrichJob(job, text, cityHint);
  }

  if (/window/i.test(t)) {
    const yearsDirty = /\b(\d+)\s*years?\b/.test(t) || /haven't|havent|never|long time|ages/i.test(t);
    const hasScope = /interior|exterior|both/i.test(t);
    const scope = hasScope
      ? (/both|interior and exterior|exterior and interior/i.test(t)
        ? "Interior + Exterior"
        : (/interior/i.test(t) ? "Interior" : "Exterior"))
      : "Interior + Exterior";
    const service = `${scope} Window Cleaning`;
    const missing: string[] = [];
    // Only ask what changes matching/booking — skip screen (optional add-on)
    if (!/\b(one|1|two|2|three|3)[\s-]*(story|stories|floor)/i.test(t) &&
      !/\b(\d{1,3})\s*(windows?|panes?)\b/i.test(t)) {
      missing.push("About how many windows?");
    }
    if (!cityHint && !/\bin\s+[A-Z][a-z]+/.test(text)) missing.push("What city?");
    if (!/\b(today|tomorrow|asap|this week|flexible)\b/i.test(t)) {
      missing.push("Need it this week?");
    }
    job = {
      ...EMPTY_JOB,
      industry: "Window Cleaning",
      category: "windows",
      service,
      add_ons: /screen/i.test(t) ? ["Screen cleaning"] : [],
      possible_add_ons: ["Screen cleaning", "Track & sill detail"],
      priority: yearsDirty ? "Thorough deep clean (long-neglected)" : null,
      property_type: /commercial|office|storefront/i.test(t) ? "commercial" : "residential",
      understanding_summary: `Window cleaning → ${scope}` + (yearsDirty ? " (deep clean)" : ""),
      known: ["Industry: Window Cleaning", `Service: ${service}`],
      missing,
      preferences: { ...EMPTY_PREFERENCES },
      advisor_reason: null,
      add_on_reasons: {},
      duration_estimate: null,
      confirmation_bullets: [],
    };
    return enrichJob(job, text, cityHint);
  }

  if (/\bac\b|hvac|air condition|furnace|heater|no cool|not cooling/i.test(t)) {
    const emergency = /stopped|not work|broken|no cool|emergency|tonight/i.test(t);
    job = {
      ...EMPTY_JOB,
      industry: "HVAC",
      category: "hvac",
      service: emergency ? "AC Diagnostic / Repair" : "HVAC Service",
      add_ons: [],
      possible_add_ons: ["Filter replacement", "Tune-up"],
      priority: emergency ? "Diagnose & restore cooling ASAP" : null,
      property_type: /commercial/i.test(t) ? "commercial" : "residential",
      understanding_summary: emergency ? "AC → diagnostic/repair" : "HVAC service",
      known: ["Industry: HVAC", `Service: ${emergency ? "AC Diagnostic / Repair" : "HVAC Service"}`],
      missing: [
        ...(!cityHint ? ["What city?"] : []),
        ...(!/\b(today|tomorrow|asap|this week)\b/i.test(t) ? ["How soon do you need someone?"] : []),
      ],
      preferences: {
        ...EMPTY_PREFERENCES,
        fastest_appointment: emergency,
      },
      advisor_reason: null,
      add_on_reasons: {},
      duration_estimate: null,
      confirmation_bullets: [],
    };
    return enrichJob(job, text, cityHint);
  }

  if (/pressure|power wash|driveway|oil stain|sidewalk|concrete/i.test(t)) {
    const oil = /oil stain|oil/i.test(t);
    job = {
      ...EMPTY_JOB,
      industry: "Pressure Washing",
      category: "pressure-washing",
      service: oil ? "Driveway Oil Stain Removal" : "Pressure Washing",
      add_ons: oil ? ["Degreaser / oil treatment"] : [],
      possible_add_ons: ["Sidewalk", "House wash"],
      priority: oil ? "Stain treatment over general wash" : null,
      property_type: "residential",
      understanding_summary: oil ? "Driveway oil stains → degreaser + wash" : "Pressure washing",
      known: ["Industry: Pressure Washing", `Service: ${oil ? "Driveway Oil Stain Removal" : "Pressure Washing"}`],
      missing: [
        ...(!cityHint ? ["What city?"] : []),
        ...(!/\b(today|tomorrow|asap|this week|flexible)\b/i.test(t)
          ? ["When would you like it?"]
          : []),
      ],
      preferences: { ...EMPTY_PREFERENCES },
      advisor_reason: null,
      add_on_reasons: {},
      duration_estimate: null,
      confirmation_bullets: [],
    };
    return enrichJob(job, text, cityHint);
  }

  if (
    /house clean|maid|apartment clean|deep clean|move.?out clean/i.test(t) ||
    (/clean(ing)?/i.test(t) && /home|house|apartment/i.test(t))
  ) {
    const deep = /deep|move.?out|haven't|years/i.test(t);
    job = {
      ...EMPTY_JOB,
      industry: "House Cleaning",
      category: "house-cleaning",
      service: deep ? "Deep Clean" : "House Cleaning",
      add_ons: [],
      possible_add_ons: ["Inside oven", "Inside fridge", "Windows"],
      priority: deep ? "Deep clean over standard maintenance" : null,
      property_type: "residential",
      understanding_summary: deep ? "Home → Deep Clean" : "Home → House Cleaning",
      known: ["Industry: House Cleaning", `Service: ${deep ? "Deep Clean" : "House Cleaning"}`],
      missing: [
        ...(!/\b(\d+)\s*(bed|br|bedroom)/i.test(t) ? ["How many bedrooms?"] : []),
        ...(!cityHint ? ["What city?"] : []),
      ],
      preferences: { ...EMPTY_PREFERENCES },
      advisor_reason: null,
      add_on_reasons: {},
      duration_estimate: null,
      confirmation_bullets: [],
    };
    return enrichJob(job, text, cityHint);
  }

  if (/photo|photographer|wedding|portrait|headshot/i.test(t)) {
    const wedding = /wedding/i.test(t);
    job = {
      ...EMPTY_JOB,
      industry: "Photography",
      category: "photography",
      service: wedding ? "Wedding Photography" : "Photography Session",
      add_ons: [],
      possible_add_ons: wedding ? ["Second shooter", "Engagement session"] : ["Edited gallery"],
      understanding_summary: wedding ? "Wedding Photography" : "Photography session",
      known: ["Industry: Photography", `Service: ${wedding ? "Wedding Photography" : "Photography Session"}`],
      missing: [
        ...(!/\b(20\d{2}|\d{1,2}\/\d{1,2}|january|february|march|april|may|june|july|august|september|october|november|december)/i
          .test(t)
          ? ["What date is the event?"]
          : []),
        ...(!cityHint ? ["What city / venue area?"] : []),
      ],
      preferences: { ...EMPTY_PREFERENCES },
      advisor_reason: null,
      add_on_reasons: {},
      duration_estimate: null,
      confirmation_bullets: [],
    };
    return enrichJob(job, text, cityHint);
  }

  if (/lawn|mow|yard|grass|landscap/i.test(t)) {
    job = {
      ...EMPTY_JOB,
      industry: "Lawn Care",
      category: "lawn-care",
      service: "Lawn Mowing",
      add_ons: [],
      possible_add_ons: ["Edging", "Cleanup"],
      property_type: "residential",
      understanding_summary: "Lawn care → mowing",
      known: ["Industry: Lawn Care", "Service: Lawn Mowing"],
      missing: [
        ...(!cityHint ? ["What city?"] : []),
        ...(!/\b(today|tomorrow|asap|this week|weekly)\b/i.test(t)
          ? ["One-time or recurring?"]
          : []),
      ],
      preferences: { ...EMPTY_PREFERENCES },
      advisor_reason: null,
      add_on_reasons: {},
      duration_estimate: null,
      confirmation_bullets: [],
    };
    return enrichJob(job, text, cityHint);
  }

  return enrichJob({
    ...EMPTY_JOB,
    missing: ["What do you need done?"],
    preferences: detectPreferences(text),
  }, text, cityHint);
}

export function mergeJobUnderstanding(
  base: JobUnderstanding,
  overlay: Partial<JobUnderstanding> | null | undefined,
): JobUnderstanding {
  if (!overlay) return base;
  return {
    industry: overlay.industry ?? base.industry,
    category: overlay.category ?? base.category,
    service: overlay.service ?? base.service,
    add_ons: overlay.add_ons?.length ? overlay.add_ons : base.add_ons,
    possible_add_ons: overlay.possible_add_ons?.length
      ? overlay.possible_add_ons
      : base.possible_add_ons,
    priority: overlay.priority ?? base.priority,
    vehicle_type: overlay.vehicle_type ?? base.vehicle_type,
    property_type: overlay.property_type ?? base.property_type,
    understanding_summary: overlay.understanding_summary ?? base.understanding_summary,
    known: overlay.known?.length ? overlay.known : base.known,
    missing: overlay.missing?.length ? overlay.missing : base.missing,
    advisor_reason: overlay.advisor_reason ?? base.advisor_reason,
    add_on_reasons: overlay.add_on_reasons && Object.keys(overlay.add_on_reasons).length
      ? overlay.add_on_reasons
      : base.add_on_reasons,
    duration_estimate: overlay.duration_estimate ?? base.duration_estimate,
    preferences: mergePreferences(base.preferences, overlay.preferences),
    confirmation_bullets: overlay.confirmation_bullets?.length
      ? overlay.confirmation_bullets
      : base.confirmation_bullets,
  };
}

export function serviceTextFromJob(job: JobUnderstanding, fallback?: string | null): string {
  if (job.service) {
    const bits = [job.service];
    if (job.add_ons.length) bits.push(`+ ${job.add_ons.join(", ")}`);
    if (job.vehicle_type) bits.push(`(${job.vehicle_type})`);
    if (job.priority) bits.push(`— ${job.priority}`);
    return bits.join(" ");
  }
  return fallback || "";
}

/**
 * Short advisor reply — every sentence has a purpose.
 * Philosophy: reduce uncertainty; try to END the conversation.
 */
export function buildAdvisorReply(job: JobUnderstanding): string {
  if (!job.service && !job.industry) {
    return "What do you need done?";
  }

  const serviceLine = job.add_ons.length
    ? `I'd recommend a ${job.service} with ${job.add_ons.join(" and ")}.`
    : `I'd recommend a ${job.service}.`;

  const parts: string[] = [serviceLine];

  const reason = job.advisor_reason;
  if (reason) {
    // Keep Why to one short line
    const short = reason.length > 110 ? reason.slice(0, 107).trim() + "…" : reason;
    parts.push(`Why? ${short.charAt(0).toUpperCase()}${short.slice(1).replace(/\.$/, "")}.`);
  }

  if (job.missing.length === 1) {
    parts.push("");
    parts.push(job.missing[0].endsWith("?") ? job.missing[0] : `${job.missing[0]}?`);
  } else if (job.missing.length >= 2) {
    parts.push("");
    parts.push("A couple quick questions...");
    for (const q of job.missing.slice(0, 2)) {
      parts.push(`• ${q.replace(/\?$/, "")}?`);
    }
  }

  return parts.join("\n");
}
