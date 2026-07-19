/**
 * Job understanding — infer industry, service, add-ons, priority from plain language.
 * Hubly should understand the job before asking anything.
 */

export type JobUnderstanding = {
  industry: string | null;
  category: string | null; // Hubly marketplace category slug
  service: string | null; // primary service recommendation
  add_ons: string[]; // recommended / inferred add-ons
  possible_add_ons: string[]; // optional extras worth offering
  priority: string | null; // e.g. "Interior over Exterior"
  vehicle_type: string | null;
  property_type: "residential" | "commercial" | null;
  understanding_summary: string | null; // one-line for UI
  known: string[]; // facts we already know (for debugging / UI)
  missing: string[]; // only ask about these
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
};

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

/** Deterministic understanding from customer text (works without LLM). */
export function understandJobFromText(raw: string, cityHint?: string | null): JobUnderstanding {
  const text = String(raw || "").trim();
  const t = normalize(text);
  if (!t) return { ...EMPTY_JOB };

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
    if (!/\b(full size|crew|extended|sedan|coupe|pickup)\b/i.test(t)) {
      // optional — don't always ask
    }
    return {
      industry: "Auto Detailing",
      category: "detailing",
      service: "Interior Detail",
      add_ons: ["Odor Removal"],
      possible_add_ons: ["Shampoo Extraction", "Ozone treatment"],
      priority: "Interior over Exterior",
      vehicle_type: vehicle,
      property_type: null,
      understanding_summary:
        `Used ${vehicle} with smoke odor → Interior Detail + Odor Removal (interior first)`,
      known: [
        "Industry: Auto Detailing",
        "Service: Interior Detail",
        "Add-on: Odor Removal",
        "Possible add-on: Shampoo Extraction",
        "Priority: Interior over Exterior",
        `Vehicle: ${vehicle}`,
      ],
      missing: missing.slice(0, 2),
    };
  }

  if (/detail|detailing|ceramic|paint correction|car wash|truck wash/i.test(t) ||
    (/\b(truck|car|suv|van)\b/i.test(t) && /clean|wash|filthy|dirty|mud/i.test(t))) {
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
    if (!wantsInterior && !wantsExterior) {
      missing.push("Interior, exterior, or both?");
    }
    if (!cityHint && !/\bin\s+[A-Z][a-z]+/.test(text)) missing.push("What city?");
    if (!/\b(today|tomorrow|asap|this week|flexible)\b/i.test(t)) {
      missing.push("When would you like it?");
    }
    return {
      industry: "Auto Detailing",
      category: "detailing",
      service,
      add_ons: [],
      possible_add_ons: ["Ceramic coating", "Engine bay clean"],
      priority,
      vehicle_type: vehicle,
      property_type: null,
      understanding_summary: vehicle
        ? `${vehicle} detailing → ${service}`
        : `Auto detailing → ${service}`,
      known: [
        "Industry: Auto Detailing",
        `Service: ${service}`,
        ...(priority ? [`Priority: ${priority}`] : []),
        ...(vehicle ? [`Vehicle: ${vehicle}`] : []),
      ],
      missing: missing.slice(0, 2),
    };
  }

  // —— Windows ——
  if (/window/i.test(t)) {
    const yearsDirty = /\b(\d+)\s*years?\b/.test(t) || /haven't|havent|never|long time|ages/i.test(t);
    const hasScope = /interior|exterior|both/i.test(t);
    const scope = hasScope
      ? (/both|interior and exterior|exterior and interior/i.test(t)
        ? "Interior + Exterior"
        : (/interior/i.test(t) ? "Interior" : "Exterior"))
      : "Interior + Exterior";
    const missing: string[] = [];
    if (!/\b(\d{1,3})\s*(windows?|panes?)\b/i.test(t)) missing.push("About how many windows?");
    if (!/\b(one|1|two|2|three|3)[\s-]*(story|stories|floor)/i.test(t)) {
      missing.push("One or two stories?");
    }
    if (!/screen/i.test(t)) missing.push("Need screen cleaning too?");
    if (!cityHint && !/\bin\s+[A-Z][a-z]+/.test(text)) missing.push("What city is the home in?");
    return {
      industry: "Window Cleaning",
      category: "windows",
      service: `${scope} Window Cleaning`,
      add_ons: /screen/i.test(t) ? ["Screen cleaning"] : [],
      possible_add_ons: ["Screen cleaning", "Track & sill detail"],
      priority: yearsDirty ? "Thorough deep clean (long-neglected)" : null,
      vehicle_type: null,
      property_type: /commercial|office|storefront/i.test(t) ? "commercial" : "residential",
      understanding_summary: `Window cleaning → ${scope}` +
        (yearsDirty ? " (deep clean — neglected)" : ""),
      known: [
        "Industry: Window Cleaning",
        `Service: ${scope} Window Cleaning`,
        "Property: residential",
        ...(yearsDirty ? ["Priority: Thorough deep clean"] : []),
      ],
      missing: missing.slice(0, 3),
    };
  }

  // —— HVAC ——
  if (/\bac\b|hvac|air condition|furnace|heater|no cool|not cooling/i.test(t)) {
    const emergency = /stopped|not work|broken|no cool|emergency|tonight/i.test(t);
    return {
      industry: "HVAC",
      category: "hvac",
      service: emergency ? "AC Diagnostic / Repair" : "HVAC Service",
      add_ons: [],
      possible_add_ons: ["Filter replacement", "Tune-up"],
      priority: emergency ? "Diagnose & restore cooling ASAP" : null,
      vehicle_type: null,
      property_type: /commercial/i.test(t) ? "commercial" : "residential",
      understanding_summary: emergency
        ? "AC issue → diagnostic/repair (priority: restore cooling)"
        : "HVAC service",
      known: [
        "Industry: HVAC",
        `Service: ${emergency ? "AC Diagnostic / Repair" : "HVAC Service"}`,
        ...(emergency ? ["Priority: Restore cooling ASAP"] : []),
      ],
      missing: [
        ...(!cityHint ? ["What city?"] : []),
        ...(!/\b(today|tomorrow|asap|this week)\b/i.test(t) ? ["How soon do you need someone?"] : []),
      ].slice(0, 2),
    };
  }

  // —— Pressure washing ——
  if (/pressure|power wash|driveway|oil stain|sidewalk|concrete/i.test(t)) {
    const oil = /oil stain|oil/i.test(t);
    return {
      industry: "Pressure Washing",
      category: "pressure-washing",
      service: oil ? "Driveway Oil Stain Removal" : "Pressure Washing",
      add_ons: oil ? ["Degreaser / oil treatment"] : [],
      possible_add_ons: ["Sidewalk", "House wash"],
      priority: oil ? "Stain treatment over general wash" : null,
      vehicle_type: null,
      property_type: "residential",
      understanding_summary: oil
        ? "Driveway oil stains → pressure wash + degreaser"
        : "Pressure washing",
      known: [
        "Industry: Pressure Washing",
        `Service: ${oil ? "Driveway Oil Stain Removal" : "Pressure Washing"}`,
        ...(oil ? ["Add-on: Degreaser / oil treatment"] : []),
      ],
      missing: [
        ...(!cityHint ? ["What city?"] : []),
        ...(!/\b(today|tomorrow|asap|this week|flexible)\b/i.test(t)
          ? ["When would you like it?"]
          : []),
      ].slice(0, 2),
    };
  }

  // —— House cleaning ——
  if (/house clean|maid|apartment clean|deep clean|move.?out clean/i.test(t) ||
    (/clean(ing)?/i.test(t) && /home|house|apartment/i.test(t))) {
    const deep = /deep|move.?out|haven't|years/i.test(t);
    return {
      industry: "House Cleaning",
      category: "house-cleaning",
      service: deep ? "Deep Clean" : "House Cleaning",
      add_ons: [],
      possible_add_ons: ["Inside oven", "Inside fridge", "Windows"],
      priority: deep ? "Deep clean over standard maintenance" : null,
      vehicle_type: null,
      property_type: "residential",
      understanding_summary: deep ? "Home → Deep Clean" : "Home → House Cleaning",
      known: [
        "Industry: House Cleaning",
        `Service: ${deep ? "Deep Clean" : "House Cleaning"}`,
      ],
      missing: [
        ...(!/\b(\d+)\s*(bed|br|bedroom)/i.test(t) ? ["How many bedrooms?"] : []),
        ...(!cityHint ? ["What city?"] : []),
      ].slice(0, 2),
    };
  }

  // —— Photography ——
  if (/photo|photographer|wedding|portrait|headshot/i.test(t)) {
    const wedding = /wedding/i.test(t);
    return {
      industry: "Photography",
      category: "photography",
      service: wedding ? "Wedding Photography" : "Photography Session",
      add_ons: [],
      possible_add_ons: wedding ? ["Second shooter", "Engagement session"] : ["Edited gallery"],
      priority: null,
      vehicle_type: null,
      property_type: null,
      understanding_summary: wedding ? "Wedding Photography" : "Photography session",
      known: [
        "Industry: Photography",
        `Service: ${wedding ? "Wedding Photography" : "Photography Session"}`,
      ],
      missing: [
        ...(!/\b(20\d{2}|\d{1,2}\/\d{1,2}|january|february|march|april|may|june|july|august|september|october|november|december)/i
          .test(t)
          ? ["What date is the event?"]
          : []),
        ...(!cityHint ? ["What city / venue area?"] : []),
      ].slice(0, 2),
    };
  }

  // —— Lawn ——
  if (/lawn|mow|yard|grass|landscap/i.test(t)) {
    return {
      industry: "Lawn Care",
      category: "lawn-care",
      service: "Lawn Mowing",
      add_ons: [],
      possible_add_ons: ["Edging", "Cleanup"],
      priority: null,
      vehicle_type: null,
      property_type: "residential",
      understanding_summary: "Lawn care → mowing",
      known: ["Industry: Lawn Care", "Service: Lawn Mowing"],
      missing: [
        ...(!cityHint ? ["What city?"] : []),
        ...(!/\b(today|tomorrow|asap|this week|weekly)\b/i.test(t)
          ? ["One-time or recurring?"]
          : []),
      ].slice(0, 2),
    };
  }

  return { ...EMPTY_JOB, missing: ["What do you need done?"] };
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
  };
}

/** Build a booking-oriented service_text from structured job understanding. */
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
