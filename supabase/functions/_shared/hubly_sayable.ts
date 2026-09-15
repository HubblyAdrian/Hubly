// hubly_sayable.ts
//
// WHAT IS SAFE TO SAY TO A PERSON. One predicate, shared by every surface that turns model
// output into a sentence someone reads.
//
// 2026-09-15, on Adrian's own claimed site, above his week grid, rendered as a Hubly message:
//
//     {"action":"reply","message":""}
//
// Our wire format, read out loud. It got there because the model's reply is JSON, `extractJson`
// slices from the first "{" to the LAST "}" — so one stray token after a valid envelope makes
// the slice unparseable — and BOTH edge functions then fall back to "use the raw text as the
// reply". The raw text is the envelope. The client composer printed whatever it was handed.
//
// The rule this enforces is narrow and absolute: **Hubly never says its own protocol.** Not on a
// parse failure, not from a nested envelope inside a cleanly parsed one, not replayed out of the
// thread on a reload.
//
// SALVAGE, THEN SILENCE — in that order, because the two are different promises:
//   - If the envelope carries a real `message`/`reply`, that sentence is what the owner was meant
//     to hear all along. Say it. Refusing it would turn a cosmetic bug into a lost answer.
//   - If it carries nothing sayable, return "". The caller must then fall through to a sentence
//     that is TRUE about a turn that failed (the client's no-silence floor), never to the
//     envelope and never to a cheerful filler. Empty here is a handoff, not a shrug.
//
// This filters HUBLY's side only. A person may legitimately type JSON at us; changing or dropping
// what they said is a different and worse defect.

/** Does this text look like our own machine output rather than a sentence? */
export function looksLikeEnvelope(text: string): boolean {
  const t = String(text || "").trim();
  if (!t) return false;
  return /^[{[]/.test(t) || /"action"\s*:/.test(t) || /"capabilityAction"\s*:/.test(t) ||
    /"reply"\s*:/.test(t);
}

/** WHAT HAPPENED, not just what to say.
 *
 *  A SUPPRESSION THAT KEEPS NO RECORD IS INDISTINGUISHABLE FROM A DEFECT THAT NEVER RECURRED.
 *  Adrian, on the fix above: a real model parse failure cannot be forced in production, so add
 *  the one thing that WOULD tell us. Same lesson as the booking path having no failed-write
 *  record — the guard must be countable, or we are back to guessing.
 *
 *  The three outcomes are not one event:
 *    clean     ordinary text. Nothing happened, nothing recorded.
 *    salvaged  an envelope carried a real sentence; the person got it. The guard worked, and the
 *              PARSER is what needs fixing.
 *    silenced  nothing sayable. The floor speaks, and a person lost a turn. This one is a bug. */
export type SayableOutcome = "clean" | "salvaged" | "silenced";
export type SayableResult = { text: string; outcome: SayableOutcome };

export function sayable(text: unknown, keys: string[] = ["message", "reply"]): SayableResult {
  const t = String(text == null ? "" : text).trim();
  if (!t) return { text: "", outcome: "clean" };          // empty input is not a suppression
  if (!looksLikeEnvelope(t)) return { text: t, outcome: "clean" };
  for (const key of keys) {
    // Read the field out of the raw text WITHOUT requiring the whole thing to parse — the case
    // that produced this file is precisely a payload that does not parse.
    const m = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(t);
    if (!m) continue;
    try {
      const decoded = String(JSON.parse('"' + m[1] + '"') || "").trim();
      // A salvaged value that is ITSELF an envelope is not a salvage.
      if (decoded && !looksLikeEnvelope(decoded)) return { text: decoded, outcome: "salvaged" };
    } catch { /* try the next key */ }
  }
  return { text: "", outcome: "silenced" };
}

/** The sentence a person may be shown, or "" when there is none.
 *
 *  `keys` are the envelope fields that can carry a human sentence, in preference order —
 *  "message" for hubly-conversation, "reply" for the public chatbot. */
export function sayableText(text: unknown, keys: string[] = ["message", "reply"]): string {
  return sayable(text, keys).text;
}

/** Write the event. Best-effort and never throws: an instrument that can break the turn it is
 *  measuring is worse than no instrument. A failure to record is logged, never swallowed
 *  silently — the same rule the notification standard applies to delivery. */
export async function recordEnvelopeSuppression(
  // Deliberately loose: supabase-js's generic SupabaseClient does not structurally match a
  // hand-written rpc signature, and narrowing it here would cost two type errors for nothing.
  // deno-lint-ignore no-explicit-any
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => any },
  args: { businessId?: string | null; surface: string; outcome: SayableOutcome; parsed: boolean; raw: string },
): Promise<void> {
  if (args.outcome === "clean") return;
  try {
    const res = await supabase.rpc("record_envelope_suppression", {
      p_business_id: args.businessId || null,
      p_surface: args.surface,
      p_outcome: args.outcome,
      p_parsed: args.parsed,
      p_raw_len: String(args.raw || "").length,
      p_sample: String(args.raw || "").slice(0, 120),
    });
    if (res && res.error) console.error("[envelope] could not record suppression:", res.error);
  } catch (e) {
    console.error("[envelope] could not record suppression:", e);
  }
}
