// Quick-add-a-lead-from-pasted-text — small, cheap structured extraction,
// deliberately separate from the document-generation pipeline (different
// task tier, different failure posture: this must fail fast and honestly
// so the caller can fall back to the existing regex parser, never block).
//
// Two different strengths of "don't invent a value":
// - phone/email: mechanically verified against the source text after the
//   model responds. A value that doesn't literally trace back to the pasted
//   text is discarded, regardless of what the model returned — a
//   structural guarantee, not a prompting one.
// - name/service: prompt discipline only. Legitimate paraphrase ("need
//   someone for my lawn" -> "Lawn Mowing") can't be mechanically verified
//   the same way. This is a real, weaker guarantee and callers should not
//   treat it as equivalent to the phone/email check.

import { HublyAI } from "./hubly_ai.ts";

export type LeadExtractResult = {
  ok: boolean;
  timedOut?: boolean;
  fields?: {
    name: string | null;
    phone: string | null;
    email: string | null;
    service: string | null;
    notes: string | null;
  };
  looksLikeLead?: boolean;
  reason?: string;
  error?: string;
};

const EXTRACT_TIMEOUT_MS = 8000;

const SYSTEM_PROMPT = `You extract lead contact info from a pasted message (a text, an Instagram DM, an email — anything). This is real customer data, not a writing task.

Return a JSON object with exactly these keys:
{"name": string|null, "phone": string|null, "email": string|null, "service": string|null, "notes": string|null, "looksLikeLead": boolean, "reason": string}

Rules:
- Every field must come from the pasted text itself — verbatim or a direct, obvious paraphrase (e.g. "need my lawn done" -> service: "Lawn Mowing" is fine; inventing a service that was never mentioned is not).
- If a field genuinely is not present in the text, its value is null. Never guess, never fill in a plausible-sounding placeholder, never invent a name, phone number, or email that is not actually there.
- "notes" is a short, real summary of anything else relevant in the message (timing, address, what they asked) — null if there's nothing beyond name/phone/email/service.
- "looksLikeLead" is false if the pasted text doesn't read like a real customer inquiry (e.g. random text, a recipe, spam) — set it false rather than extracting fields that don't make sense in that case.
- "reason" is one short honest sentence explaining your looksLikeLead judgment.
- Output ONLY the JSON object, nothing else.`;

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

export async function extractLeadFromText(text: string): Promise<LeadExtractResult> {
  const raw = String(text || "").trim();
  if (!raw) return { ok: false, error: "empty_text" };

  let aiResult;
  try {
    aiResult = await withTimeout(
      HublyAI.complete({
        feature: "lead-extract",
        task: "lead_extract",
        system: SYSTEM_PROMPT,
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

  return {
    ok: true,
    fields: {
      name: parsed?.name != null && String(parsed.name).trim() ? String(parsed.name).trim() : null,
      phone,
      email,
      service: parsed?.service != null && String(parsed.service).trim() ? String(parsed.service).trim() : null,
      notes: parsed?.notes != null && String(parsed.notes).trim() ? String(parsed.notes).trim() : null,
    },
    looksLikeLead: parsed?.looksLikeLead !== false,
    reason: parsed?.reason != null ? String(parsed.reason).trim() : "",
  };
}
