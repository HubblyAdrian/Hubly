/**
 * Hubly Customer Runtime — Customer Memory (Phase 7.8)
 *
 * Parallel to Business Memory:
 *   Business Memory = what is true about the business
 *   Customer Memory  = what is true about the customer / job
 *
 * Never combine with Customer Profile (identity). Never invent Business DNA.
 */

export const HUBLY_CUSTOMER_MEMORY_VERSION = 1 as const;

export type HublyCustomerMemory = {
  version: typeof HUBLY_CUSTOMER_MEMORY_VERSION;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  property?: {
    type?: string | null;
    notes?: string | null;
    hasPets?: boolean | null;
  } | null;
  job?: {
    service?: string | null;
    category?: string | null;
    description?: string | null;
    when?: string | null;
    urgency?: string | null;
  } | null;
  bookingHistory?: Array<{
    businessId?: string | null;
    service?: string | null;
    at?: string | null;
    status?: string | null;
  }> | null;
  notes?: string | null;
  updatedAt?: string | null;
};

export type HublyCustomerMemoryInput = Partial<HublyCustomerMemory>;

function asString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

export function normalizeCustomerMemory(
  input?: HublyCustomerMemoryInput | null,
): HublyCustomerMemory {
  const raw = input && typeof input === "object" ? input : {};
  const property = raw.property && typeof raw.property === "object" ? raw.property : null;
  const job = raw.job && typeof raw.job === "object" ? raw.job : null;
  return {
    version: HUBLY_CUSTOMER_MEMORY_VERSION,
    name: asString(raw.name),
    phone: asString(raw.phone),
    email: asString(raw.email),
    address: asString(raw.address),
    city: asString(raw.city),
    property: property
      ? {
        type: asString(property.type),
        notes: asString(property.notes),
        hasPets: typeof property.hasPets === "boolean" ? property.hasPets : null,
      }
      : null,
    job: job
      ? {
        service: asString(job.service),
        category: asString(job.category),
        description: asString(job.description),
        when: asString(job.when),
        urgency: asString(job.urgency),
      }
      : null,
    bookingHistory: Array.isArray(raw.bookingHistory)
      ? raw.bookingHistory
        .filter((x) => x && typeof x === "object")
        .map((x) => ({
          businessId: asString((x as Record<string, unknown>).businessId),
          service: asString((x as Record<string, unknown>).service),
          at: asString((x as Record<string, unknown>).at),
          status: asString((x as Record<string, unknown>).status),
        }))
      : null,
    notes: asString(raw.notes),
    updatedAt: asString(raw.updatedAt) || new Date().toISOString(),
  };
}

export function mergeCustomerMemory(
  base?: HublyCustomerMemoryInput | null,
  patch?: HublyCustomerMemoryInput | null,
): HublyCustomerMemory {
  const a = normalizeCustomerMemory(base);
  const b = normalizeCustomerMemory(patch);
  return normalizeCustomerMemory({
    ...a,
    ...Object.fromEntries(
      Object.entries(b).filter(([k, v]) => {
        if (k === "version") return false;
        if (v == null || v === "") return false;
        if (Array.isArray(v) && !v.length) return false;
        if (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length) return false;
        return true;
      }),
    ),
    property: { ...(a.property || {}), ...(b.property || {}) },
    job: { ...(a.job || {}), ...(b.job || {}) },
    updatedAt: new Date().toISOString(),
  });
}

/** Infer factual Customer Memory from free-form request language. */
export function inferCustomerMemoryFromConversation(
  conversation: string,
  prior?: HublyCustomerMemoryInput | null,
): HublyCustomerMemory {
  const text = String(conversation || "").trim();
  const low = text.toLowerCase();
  const patch: HublyCustomerMemoryInput = { job: {}, property: {} };

  let service: string | null = null;
  if (/pressure\s*wash|power\s*wash|driveway/.test(low)) service = "Pressure washing";
  else if (/window/.test(low)) service = "Window cleaning";
  else if (/clean|maid|housekeep/.test(low)) service = "House cleaning";
  else if (/detail|ceramic|car wash/.test(low)) service = "Auto detailing";
  else if (/lawn|mow|landscap/.test(low)) service = "Lawn care";
  else if (/hvac|ac |air condition|furnace/.test(low)) service = "HVAC";
  if (service) {
    patch.job!.service = service;
    patch.job!.category = service;
  }
  patch.job!.description = text.slice(0, 500);

  const cityMatch = text.match(/\bin\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\b/);
  if (cityMatch?.[1] && !/I|My|The|Need|Someone|Someone/.test(cityMatch[1])) {
    patch.city = cityMatch[1];
  }

  if (/asap|today|urgent|right away/.test(low)) {
    patch.job!.when = "asap";
    patch.job!.urgency = "high";
  } else if (/weekend/.test(low)) {
    patch.job!.when = "weekend";
  } else if (/flexible/.test(low)) {
    patch.job!.when = "flexible";
  }

  if (/pet|dog|cat/.test(low)) patch.property!.hasPets = true;
  if (/driveway|garage|home|house|condo|apartment/.test(low)) {
    patch.property!.type = /condo|apartment/.test(low) ? "apartment" : "home";
  }

  return mergeCustomerMemory(prior, patch);
}

export function formatCustomerMemory(memory?: HublyCustomerMemoryInput | null): string {
  const m = normalizeCustomerMemory(memory);
  return [
    "HUBLY CUSTOMER MEMORY (facts — what is true about this customer/job):",
    JSON.stringify(m, null, 2),
  ].join("\n");
}

export const HublyCustomerMemoryApi = {
  version: HUBLY_CUSTOMER_MEMORY_VERSION,
  normalize: normalizeCustomerMemory,
  merge: mergeCustomerMemory,
  inferFromConversation: inferCustomerMemoryFromConversation,
  format: formatCustomerMemory,
};

export default HublyCustomerMemoryApi;
