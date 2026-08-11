// Quick-add-a-lead-from-pasted-text — small, cheap structured extraction,
// deliberately separate from the document-generation pipeline (different
// task tier, different failure posture: this must fail fast and honestly
// so the caller can fall back to the existing regex parser, never block).
//
// Three different strengths of "don't invent a value":
// - phone/email: mechanically verified against the source text after the
//   model responds. A value that doesn't literally trace back to the pasted
//   text is discarded, regardless of what the model returned — a
//   structural guarantee, not a prompting one.
// - serviceId/industryFields keys: mechanically verified against the real
//   lists the caller supplied (this business's actual Service Engine
//   catalog, and the active Blueprint's actual intake field vocabulary) —
//   a serviceId or field key that isn't literally in the list sent is
//   discarded, same structural guarantee as phone/email, just checked
//   against a caller-supplied allowlist instead of the source text.
// - name/notes/industryField values: prompt discipline only. This is a
//   real, weaker guarantee and callers should not treat it as equivalent
//   to the two checks above.

import { HublyAI } from "./hubly_ai.ts";

export type LeadExtractResult = {
  ok: boolean;
  timedOut?: boolean;
  fields?: {
    name: string | null;
    phone: string | null;
    email: string | null;
    serviceId: string | null;
    industryFields: Record<string, string>;
    notes: string | null;
  };
  looksLikeLead?: boolean;
  reason?: string;
  error?: string;
};

export type LeadExtractCatalogEntry = { id: string; name: string };
export type LeadExtractFieldSpec = { key: string; label: string };

// Was 8000 — measured against the live deployed function: a real service
// catalog + industry-field vocabulary in the prompt (needed so the model
// can honestly match/decline instead of inventing) reliably pushed
// response time past 8s and into a false "timeout" fallback. 16s still
// fails open (falls back to the client's regex parser) if something is
// genuinely stuck, it's just no longer tripping on ordinary latency.
const EXTRACT_TIMEOUT_MS = 16000;

function buildSystemPrompt(services: LeadExtractCatalogEntry[], industryFields: LeadExtractFieldSpec[]): string {
  const serviceList = services.length
    ? services.map((s) => `- id:"${s.id}" name:"${s.name}"`).join("\n")
    : "(this business has no services configured yet — serviceId must always be null)";
  const fieldList = industryFields.length
    ? industryFields.map((f) => `- key:"${f.key}" label:"${f.label}"`).join("\n")
    : "(no industry-specific fields apply to this business type — industryFields must always be {})";

  return `You extract lead contact info from a pasted message (a text, an Instagram DM, an email — anything). This is real customer data, not a writing task.

Return a JSON object with exactly these keys:
{"name": string|null, "phone": string|null, "email": string|null, "serviceId": string|null, "industryFields": object, "notes": string|null, "looksLikeLead": boolean, "reason": string}

This business's REAL services (pick serviceId from this list ONLY, or null):
${serviceList}

This business type's REAL extra intake fields (fill "industryFields" using ONLY these keys, or leave it {}):
${fieldList}

Rules:
- name/phone/email/notes must come from the pasted text itself — verbatim or a direct, obvious paraphrase.
- serviceId: only set this to one of the exact ids listed above, and only when the pasted text clearly, confidently identifies that specific service. If the text mentions something service-like but you are not confident it maps to one of the listed services, leave serviceId null — do NOT pick the closest guess, and do NOT invent an id that isn't in the list.
- industryFields: only include keys from the list above, only when that specific detail is actually stated in the text (e.g. a vehicle year/make/model, a lot size, a property type). Never invent a value for a field just because it's common for this type of business. Omit any key you're not extracting.
- If a field genuinely is not present in the text, its value is null (or omitted, for industryFields). Never guess, never fill in a plausible-sounding placeholder, never invent a name, phone number, or email that is not actually there.
- "notes" is a short, real summary of anything else relevant in the message (timing, address, what they asked) — null if there's nothing beyond the fields above.
- "looksLikeLead" is false if the pasted text doesn't read like a real customer inquiry (e.g. random text, a recipe, spam) — set it false rather than extracting fields that don't make sense in that case.
- "reason" is one short honest sentence explaining your looksLikeLead judgment.
- Output ONLY the JSON object, nothing else.`;
}

function normalizePhoneDigits(raw: string): string {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits;
}

/** Structural check: does this phone number's digits actually appear,
 *  in order, somewhere in the source text? Rejects anything the model
 *  invented that isn't traceable to what was pasted. */
function phoneAppearsInSource(phone: string, sourceText: string): boolean {
  const phoneDigits = normalizePhoneDigits(phone);
  if (phoneDigits.length < 7) return false;
  const sourceDigits = String(sourceText || "").replace(/\D/g, "");
  return sourceDigits.includes(phoneDigits);
}

function emailAppearsInSource(email: string, sourceText: string): boolean {
  const e = String(email || "").trim().toLowerCase();
  if (!e || !e.includes("@")) return false;
  return String(sourceText || "").toLowerCase().includes(e);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("lead_extract_timeout")), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export async function extractLeadFromText(
  text: string,
  services: LeadExtractCatalogEntry[] = [],
  industryFields: LeadExtractFieldSpec[] = [],
): Promise<LeadExtractResult> {
  const raw = String(text || "").trim();
  if (!raw) return { ok: false, error: "empty_text" };

  let aiResult;
  try {
    aiResult = await withTimeout(
      HublyAI.complete({
        feature: "lead-extract",
        task: "lead_extract",
        system: buildSystemPrompt(services, industryFields),
        messages: [{ role: "user", content: raw }],
        jsonMode: true,
      }),
      EXTRACT_TIMEOUT_MS,
    );
  } catch (e) {
    const timedOut = e instanceof Error && e.message === "lead_extract_timeout";
    return { ok: false, timedOut, error: timedOut ? "timeout" : String(e instanceof Error ? e.message : e) };
  }

  const responseText = String(aiResult.text || "").trim();
  if (!responseText) return { ok: false, error: "empty_completion" };

  let parsed: any;
  try {
    const cleaned = responseText.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, error: "unparseable_json" };
  }

  const rawPhone = parsed?.phone != null ? String(parsed.phone).trim() : "";
  const rawEmail = parsed?.email != null ? String(parsed.email).trim() : "";
  const phone = rawPhone && phoneAppearsInSource(rawPhone, raw) ? normalizePhoneDigits(rawPhone) : null;
  const email = rawEmail && emailAppearsInSource(rawEmail, raw) ? rawEmail : null;

  // Structural guarantee, same discipline as phone/email above: a
  // serviceId only survives if it's literally one of the ids this
  // business actually has — the model can't hand back an id that was
  // never in the list it was given (Service Engine stays the single
  // source of truth, never a second lead-side service concept).
  const rawServiceId = parsed?.serviceId != null ? String(parsed.serviceId).trim() : "";
  const serviceId = rawServiceId && services.some((s) => s.id === rawServiceId) ? rawServiceId : null;

  const validFieldKeys = new Set(industryFields.map((f) => f.key));
  const extractedIndustryFields: Record<string, string> = {};
  if (parsed?.industryFields && typeof parsed.industryFields === "object") {
    for (const [k, v] of Object.entries(parsed.industryFields as Record<string, unknown>)) {
      if (!validFieldKeys.has(k)) continue; // not a field this business type actually has
      const sv = v != null ? String(v).trim() : "";
      if (sv) extractedIndustryFields[k] = sv;
    }
  }

  return {
    ok: true,
    fields: {
      name: parsed?.name != null && String(parsed.name).trim() ? String(parsed.name).trim() : null,
      phone,
      email,
      serviceId,
      industryFields: extractedIndustryFields,
      notes: parsed?.notes != null && String(parsed.notes).trim() ? String(parsed.notes).trim() : null,
    },
    looksLikeLead: parsed?.looksLikeLead !== false,
    reason: parsed?.reason != null ? String(parsed.reason).trim() : "",
  };
}
