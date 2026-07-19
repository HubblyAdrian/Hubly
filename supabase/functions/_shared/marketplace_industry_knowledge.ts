/**
 * Industry knowledge packs for AI Concierge.
 * Conversation framework is shared; only knowledge changes per industry.
 */

export type IndustrySlug =
  | "detailing"
  | "windows"
  | "house-cleaning"
  | "hvac"
  | "lawn-care"
  | "spa"
  | "pressure-washing"
  | "photography";

export type CustomerPreferences = {
  budget_conscious: boolean;
  fastest_appointment: boolean;
  premium_quality: boolean;
  eco_friendly: boolean;
  mobile_only: boolean;
  weekend_preferred: boolean;
};

export type IndustryPack = {
  slug: IndustrySlug;
  industry: string;
  /** Why we recommend a service for a signal */
  serviceReasons: Record<string, string>;
  /** Why we recommend an add-on */
  addOnReasons: Record<string, string>;
  /** Rough duration hints by service key */
  durationHints: Record<string, string>;
  /** Follow-ups that improve matching (service / provider / appointment) */
  usefulFollowUps: {
    service?: string[];
    provider?: string[];
    appointment?: string[];
  };
};

export const EMPTY_PREFERENCES: CustomerPreferences = {
  budget_conscious: false,
  fastest_appointment: false,
  premium_quality: false,
  eco_friendly: false,
  mobile_only: false,
  weekend_preferred: false,
};

const PACKS: Record<IndustrySlug, IndustryPack> = {
  detailing: {
    slug: "detailing",
    industry: "Auto Detailing",
    serviceReasons: {
      "Interior Detail":
        "smoke and cabin odors usually settle into the seats, carpet, and headliner — an interior detail reaches those surfaces",
      "Exterior Detail":
        "paint, glass, and trim need a dedicated exterior detail when the cabin isn’t the main issue",
      "Full Detail":
        "both the cabin and exterior need attention for a complete reset",
    },
    addOnReasons: {
      "Odor Removal":
        "smoke usually needs a dedicated odor treatment beyond a normal vacuum and wipe-down",
      "Shampoo Extraction":
        "extraction pulls residue out of fabric and carpet so the odor doesn’t return as quickly",
      "Ozone treatment":
        "ozone can help neutralize odor molecules that linger in soft surfaces",
      "Pet hair removal":
        "pet hair typically adds extra labor and helps restore the interior properly",
      "Ceramic coating":
        "ceramic helps protect fresh paintwork and makes future washes easier",
    },
    durationHints: {
      "Interior Detail": "Estimated 3–5 hours",
      "Exterior Detail": "Estimated 2–4 hours",
      "Full Detail": "Estimated 5–8 hours",
    },
    usefulFollowUps: {
      appointment: ["When would you like it done?", "This week or flexible?"],
      provider: ["What city is the vehicle in?", "Do you need mobile service?"],
      service: ["Interior, exterior, or both?"],
    },
  },
  windows: {
    slug: "windows",
    industry: "Window Cleaning",
    serviceReasons: {
      "Interior + Exterior Window Cleaning":
        "neglected glass usually needs both sides for a clear finish",
      "Interior Window Cleaning": "interior-only work when the outside isn’t the issue",
      "Exterior Window Cleaning": "exterior-only when the outside is the priority",
    },
    addOnReasons: {
      "Screen cleaning":
        "dirty screens redeposit dust onto freshly cleaned glass",
      "Track & sill detail":
        "tracks and sills hold grit that shows right after a clean",
    },
    durationHints: {
      "Interior + Exterior Window Cleaning": "Estimated 2–4 hours for a typical home",
      "Interior Window Cleaning": "Estimated 1–2 hours",
      "Exterior Window Cleaning": "Estimated 1–3 hours",
    },
    usefulFollowUps: {
      service: ["About how many windows?", "One or two stories?"],
      appointment: ["When would you like it?"],
      provider: ["What city is the home in?"],
    },
  },
  "pressure-washing": {
    slug: "pressure-washing",
    industry: "Pressure Washing",
    serviceReasons: {
      "Driveway Oil Stain Removal":
        "oil stains need targeted treatment — a general wash alone often won’t lift them",
      "Pressure Washing": "surface dirt and grime clear best with a proper pressure wash",
    },
    addOnReasons: {
      "Degreaser / oil treatment":
        "because you mentioned oil stains, a degreasing treatment before pressure washing gives a much better result",
      Sidewalk: "sidewalks next to the driveway often show the same grime once the concrete is clean",
      "House wash": "soft-washing the house walls keeps the whole exterior consistent",
    },
    durationHints: {
      "Driveway Oil Stain Removal": "Estimated 1–3 hours",
      "Pressure Washing": "Estimated 1–3 hours",
    },
    usefulFollowUps: {
      appointment: ["When would you like it?"],
      provider: ["What city?"],
      service: ["Just the driveway, or sidewalks too?"],
    },
  },
  hvac: {
    slug: "hvac",
    industry: "HVAC",
    serviceReasons: {
      "AC Diagnostic / Repair":
        "when cooling stops, a diagnostic finds the failure before parts or refrigerant guesses",
      "HVAC Service": "routine service keeps the system efficient and reliable",
    },
    addOnReasons: {
      "Filter replacement": "a dirty filter is a common reason for weak airflow and strain",
      "Tune-up": "a tune-up catches small issues before they become no-cool emergencies",
    },
    durationHints: {
      "AC Diagnostic / Repair": "Estimated 1–2 hours on site",
      "HVAC Service": "Estimated 1–2 hours",
    },
    usefulFollowUps: {
      appointment: ["How soon do you need someone?"],
      provider: ["What city?"],
      service: ["Is it not cooling at all, or just weak?"],
    },
  },
  "house-cleaning": {
    slug: "house-cleaning",
    industry: "House Cleaning",
    serviceReasons: {
      "Deep Clean":
        "when a home has been neglected or you’re moving, a deep clean covers the build-up a standard clean skips",
      "House Cleaning": "regular cleaning keeps the home maintained without a full reset",
    },
    addOnReasons: {
      "Inside oven": "ovens hold grease that a standard clean usually skips",
      "Inside fridge": "fridge interiors need dedicated time beyond counters and floors",
      Windows: "interior windows are an easy add when you’re already doing a deep clean",
    },
    durationHints: {
      "Deep Clean": "Estimated 4–7 hours",
      "House Cleaning": "Estimated 2–4 hours",
    },
    usefulFollowUps: {
      service: ["How many bedrooms?"],
      appointment: ["When would you like it?"],
      provider: ["What city?"],
    },
  },
  "lawn-care": {
    slug: "lawn-care",
    industry: "Lawn Care",
    serviceReasons: {
      "Lawn Mowing": "regular mowing is the base service for keeping the yard tidy",
    },
    addOnReasons: {
      Edging: "edging gives a finished look along sidewalks and beds",
      Cleanup: "cleanup hauls clippings so you don’t have to",
    },
    durationHints: {
      "Lawn Mowing": "Estimated 45–90 minutes for a typical lot",
    },
    usefulFollowUps: {
      service: ["One-time or recurring?"],
      appointment: ["When would you like the first visit?"],
      provider: ["What city?"],
    },
  },
  photography: {
    slug: "photography",
    industry: "Photography",
    serviceReasons: {
      "Wedding Photography":
        "weddings need a photographer who can cover long timelines and key moments",
      "Photography Session": "a focused session is the right fit for portraits or smaller shoots",
    },
    addOnReasons: {
      "Second shooter": "a second shooter covers angles you can’t get with one camera",
      "Engagement session": "engagement sessions help you get comfortable before the wedding day",
      "Edited gallery": "edited galleries are how most clients actually share and print photos",
    },
    durationHints: {
      "Wedding Photography": "Typically 6–10 hours of coverage",
      "Photography Session": "Estimated 1–2 hours",
    },
    usefulFollowUps: {
      appointment: ["What date is the event?"],
      provider: ["What city / venue area?"],
      service: ["How many hours of coverage?"],
    },
  },
  spa: {
    slug: "spa",
    industry: "Spa",
    serviceReasons: {
      Massage: "massage is the right fit when you want targeted recovery or relaxation",
    },
    addOnReasons: {},
    durationHints: {
      Massage: "Estimated 60–90 minutes",
    },
    usefulFollowUps: {
      appointment: ["When would you like to come in?"],
      provider: ["What city?"],
      service: ["60 or 90 minutes?"],
    },
  },
};

export function getIndustryPack(category: string | null | undefined): IndustryPack | null {
  if (!category) return null;
  const key = String(category).toLowerCase() as IndustrySlug;
  return PACKS[key] || null;
}

/** Infer soft preferences from conversation — never ask for these explicitly. */
export function detectPreferences(text: string): CustomerPreferences {
  const t = text.toLowerCase();
  return {
    budget_conscious: /budget|cheap|affordable|lowest|inexpensive|cost.?conscious|save money/i.test(t),
    fastest_appointment:
      /asap|today|tonight|urgent|as soon|right away|same.?day|emergency|stopped working/i.test(t),
    premium_quality:
      /premium|best|high.?end|top.?notch|luxury|quality|thorough|professional|meticulous/i.test(t),
    eco_friendly: /eco|green|non.?toxic|organic|environment|biodegradable/i.test(t),
    mobile_only: /mobile|come to me|at my (home|house|place)|on.?site|they come/i.test(t),
    weekend_preferred: /weekend|saturday|sunday/i.test(t),
  };
}

export function mergePreferences(
  a: CustomerPreferences,
  b: Partial<CustomerPreferences> | null | undefined,
): CustomerPreferences {
  if (!b) return a;
  return {
    budget_conscious: !!(a.budget_conscious || b.budget_conscious),
    fastest_appointment: !!(a.fastest_appointment || b.fastest_appointment),
    premium_quality: !!(a.premium_quality || b.premium_quality),
    eco_friendly: !!(a.eco_friendly || b.eco_friendly),
    mobile_only: !!(a.mobile_only || b.mobile_only),
    weekend_preferred: !!(a.weekend_preferred || b.weekend_preferred),
  };
}

export function reasonForService(category: string | null, service: string | null): string | null {
  const pack = getIndustryPack(category);
  if (!pack || !service) return null;
  if (pack.serviceReasons[service]) return pack.serviceReasons[service];
  // fuzzy
  for (const [k, v] of Object.entries(pack.serviceReasons)) {
    if (service.toLowerCase().includes(k.toLowerCase().split(" ")[0])) return v;
  }
  return null;
}

export function reasonForAddOn(category: string | null, addOn: string): string | null {
  const pack = getIndustryPack(category);
  if (!pack) return null;
  if (pack.addOnReasons[addOn]) return pack.addOnReasons[addOn];
  for (const [k, v] of Object.entries(pack.addOnReasons)) {
    if (addOn.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(addOn.toLowerCase())) {
      return v;
    }
  }
  return null;
}

export function durationForService(category: string | null, service: string | null): string | null {
  const pack = getIndustryPack(category);
  if (!pack || !service) return null;
  if (pack.durationHints[service]) return pack.durationHints[service];
  for (const [k, v] of Object.entries(pack.durationHints)) {
    if (service.toLowerCase().includes(k.toLowerCase().slice(0, 8))) return v;
  }
  return null;
}

export type FollowUpContext = {
  hasCity: boolean;
  hasWhen: boolean;
  hasServiceClarity: boolean;
  /** Raw conversation — used to skip questions we already know */
  rawText?: string;
  propertyType?: "residential" | "commercial" | null;
  vehicleType?: string | null;
  /** Client already shared geolocation / zip */
  hasLocationPermission?: boolean;
  /** Single-city provider context (future) */
  singleCityKnown?: boolean;
};

/** Never ask what we already know. Only keep Qs that change service/provider/appointment. */
export function filterSmartFollowUps(
  questions: string[],
  opts: FollowUpContext,
): string[] {
  const raw = (opts.rawText || "").toLowerCase();
  const obviousResidential =
    opts.propertyType === "residential" ||
    /\b(driveway|my home|my house|residential|lawn|yard|garage|backyard|front yard)\b/i.test(raw);
  const obviousCommercial =
    opts.propertyType === "commercial" ||
    /\b(office|storefront|commercial|warehouse|restaurant)\b/i.test(raw);
  const vehicleKnown = !!(opts.vehicleType || /\b(truck|suv|van|sedan|coupe|car)\b/i.test(raw));

  const out: string[] = [];
  for (const q of questions) {
    const ql = q.toLowerCase();
    if (/how did you hear|newsletter|rate your|anything else|feedback/i.test(ql)) continue;

    // Skip known answers
    if (/residential|commercial/i.test(ql) && (obviousResidential || obviousCommercial)) continue;
    if (/suv or truck|truck or suv|what (kind|type) of (vehicle|car)/i.test(ql) && vehicleKnown) {
      continue;
    }
    if (/zip|postal code/i.test(ql) && (opts.hasCity || opts.hasLocationPermission)) continue;
    if (/service area|which (city|area)/i.test(ql) && (opts.hasCity || opts.singleCityKnown)) {
      continue;
    }
    if (/availability preference|when are you free/i.test(ql) && opts.hasWhen) continue;

    const isAppointment = /when|soon|timing|date|week|asap|schedule|appointment|need it/i.test(ql);
    const isProvider = /city|where|area|location|mobile|come to|zip|neighborhood/i.test(ql);
    const isService =
      /how many|stories|interior|exterior|both|bedrooms?|screens?|coverage|hours|driveway|sidewalk|cooling|one-time|recurring|suv or truck|vehicle/i
        .test(ql);
    if (!isAppointment && !isProvider && !isService) continue;
    if (isAppointment && opts.hasWhen) continue;
    if (isProvider && opts.hasCity && !/mobile/i.test(ql)) continue;
    if (isService && opts.hasServiceClarity && /interior, exterior|interior or exterior/i.test(ql)) {
      continue;
    }
    out.push(q);
    if (out.length >= 2) break;
  }
  return out;
}

export function timingLabel(when: string | null | undefined, text: string): string | null {
  const t = (when || "") + " " + text;
  if (/asap|today|tonight|urgent|same.?day/i.test(t)) return "Service needed ASAP";
  if (/this week/i.test(t)) return "Service needed this week";
  if (/next week/i.test(t)) return "Service needed next week";
  if (/weekend|saturday|sunday/i.test(t)) return "Weekend preferred";
  if (/flexible/i.test(t)) return "Timing flexible";
  if (/\d{4}-\d{2}-\d{2}/.test(t)) return `Service on ${t.match(/\d{4}-\d{2}-\d{2}/)?.[0]}`;
  return null;
}

export function preferenceLabels(prefs: CustomerPreferences): string[] {
  const labels: string[] = [];
  if (prefs.mobile_only) labels.push("Mobile service");
  if (prefs.fastest_appointment) labels.push("Soonest availability");
  if (prefs.budget_conscious) labels.push("Budget-conscious");
  if (prefs.premium_quality) labels.push("Premium quality");
  if (prefs.eco_friendly) labels.push("Eco-friendly");
  if (prefs.weekend_preferred) labels.push("Weekend preferred");
  return labels;
}
