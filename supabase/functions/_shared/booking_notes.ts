/**
 * Strip Hubly's internal machine markers out of a customer-visible notes string.
 *
 * booking_requests.notes is used as a key-value store as well as a free-text
 * field: the booking flow concatenates markers like [SMS_CONSENT:yes],
 * [RETURNING:yes], [PAYNOW:$5.00|method:online], [DISCOUNT:CODE|10%|-$1.00],
 * [RPJOB:plan_x] and [DEPOSIT:$20] onto whatever the customer actually typed.
 *
 * hubly.html has stripBookingMachineTags() to hide them — but it is CLIENT-side
 * only, so every server-side and third-party renderer emits the raw string. That
 * is how an owner received an email reading
 *
 *     NOTES: [SMS_CONSENT:yes] · Where: Studio
 *
 * and how the same text reached a calendar event description via .ics, where it
 * propagates into whatever calendar imports it.
 *
 * This is the server-side half. It exists so that no renderer has to remember:
 * anything putting notes in front of a human calls this first.
 *
 * Kept deliberately in sync with stripBookingMachineTags() in public/hubly.html.
 * If a new marker is added to the booking flow it must be added in BOTH — which
 * is an argument for moving these fields to real columns (sms_consent already
 * has one) rather than growing the list.
 */

/** Every marker family the booking flow writes into notes. */
const MACHINE_MARKERS: RegExp[] = [
  /\[SMS_CONSENT:(?:yes|no)\]/gi,
  /\[SMS:(?:yes|no)\]/gi,
  /\[RETURNING:yes\]/gi,
  /\[CUST:[^\]]*\]/gi,
  /\[RPJOB:[^\]]*\]/gi,
  /\[PAYLATER:[^\]]*\]/gi,
  /\[PAYNOW:[^\]]*\]/gi,
  /\[DEPOSIT:[^\]]*\]/gi,
  /\[DISCOUNT:[^\]]*\]/gi,
  /\[STATUS:[^\]]*\]/gi,
  /\[source:[^\]]*\]/gi,
  /\[RESUME_FAILED:[^\]]*\]/gi,
];

/**
 * Customer-visible notes, with internal markers removed and the separators they
 * leave behind tidied up.
 *
 * Returns '' when nothing human-written remains — callers should treat an empty
 * result as "no notes" rather than rendering an empty Notes row.
 */
export function stripBookingMachineTags(raw: unknown): string {
  let text = String(raw ?? "");
  if (!text) return "";
  for (const re of MACHINE_MARKERS) text = text.replace(re, "");
  return text
    .replace(/\r\n/g, "\n")
    // The flow joins with ' · ', so removing a marker leaves orphaned separators
    // at the start, the end, or doubled in the middle.
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/(?:\s*[·•]\s*)+/g, " · ")
    .replace(/^\s*[·•]\s*|\s*[·•]\s*$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * A safety net for anything that renders notes without thinking.
 *
 * Returns true if a string still contains a marker — useful in tests and as an
 * assertion before sending, so a marker added to the flow and not added here
 * fails loudly instead of arriving in someone's inbox.
 */
export function hasMachineMarker(raw: unknown): boolean {
  const text = String(raw ?? "");
  return /\[[A-Za-z_]+:[^\]]*\]/.test(text);
}
