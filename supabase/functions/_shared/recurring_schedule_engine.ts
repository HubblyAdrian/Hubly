// Recurring Schedule → next occurrence — the schedule-as-source-of-truth
// model: a recurring_schedules row owns cadence/next_occurrence_date/
// status/service/pricing/technician; each actual visit is still one real
// jobs row, created only as it's actually due (see hubly-recurring-maintain,
// the scheduled worker that calls generateDueOccurrences below). This file
// holds the pure interval math, shared between that worker and anywhere a
// schedule's next date needs to be computed at creation time
// (hubly_booking_execution.ts, journey.js's createRecurringScheduleRow via
// its own mirrored logic — see that file's own comment for why browser code
// can't literally import this Deno module).

export type RecurringFrequency = "weekly" | "biweekly" | "monthly" | "quarterly" | "custom";
export const VALID_FREQUENCIES: RecurringFrequency[] = ["weekly", "biweekly", "monthly", "quarterly", "custom"];

/** One step forward from `fromDateStr` (YYYY-MM-DD) by the schedule's own
 *  cadence. Mirrors recurringJobDates()'s per-step math exactly
 *  (public/journey-os/journey.js) — same month-overflow clamping (Jan 31 +
 *  1 month lands on Feb 28, never rolls into March), not a re-derived rule. */
export function computeNextOccurrenceDate(
  fromDateStr: string,
  frequency: string,
  customIntervalDays?: number | null,
): string {
  const base = new Date(`${String(fromDateStr || "").slice(0, 10)}T12:00:00`);
  if (isNaN(base.getTime())) return fromDateStr;
  const freq = String(frequency || "").trim().toLowerCase();

  if (freq === "weekly") {
    const d = new Date(base.getTime());
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }
  if (freq === "biweekly") {
    const d = new Date(base.getTime());
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  }
  if (freq === "custom") {
    const days = Math.max(1, Number(customIntervalDays) || 7);
    const d = new Date(base.getTime());
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }
  if (freq === "monthly" || freq === "quarterly") {
    const monthStep = freq === "monthly" ? 1 : 3;
    const targetMonth = base.getMonth() + monthStep;
    const lastDayOfTargetMonth = new Date(base.getFullYear(), targetMonth + 1, 0).getDate();
    const d = new Date(base.getFullYear(), targetMonth, Math.min(base.getDate(), lastDayOfTargetMonth), 12);
    return d.toISOString().slice(0, 10);
  }
  // Unknown frequency — never invent a cadence, just don't advance.
  return fromDateStr;
}
