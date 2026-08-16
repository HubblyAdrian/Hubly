/**
 * Deposit arithmetic, shared by the two booking paths.
 *
 * Regular services (booking_engine.ts) and One-Off Sessions
 * (one_off_session_core.mjs) resolve payment from different models — different
 * field names, different rule vocabularies — but they do the same two sums:
 * turn a percentage into cents, and clamp the result into a sane range. Those
 * sums lived twice, with one copy clamping and the other not, which is how a
 * deposit larger than the price becomes possible on one path and not the other.
 *
 * Deliberately .mjs, not .ts: one_off_session_core.mjs must stay importable by
 * BOTH Deno and plain Node (that is what lets its logic be unit-tested outside
 * Deno), and it cannot import TypeScript. booking_engine.ts imports this the
 * same way it already imports other .mjs shared code.
 *
 * Pure arithmetic only. No rules, no vocabularies, no business decisions —
 * those stay with each caller, because they genuinely differ.
 */

/** Cents for `percentage`% of `priceCents`. Nonsense in → 0 out, never NaN. */
export function percentDepositCents(priceCents, percentage) {
  const price = Math.max(0, Math.round(Number(priceCents) || 0));
  const pct = Number(percentage);
  if (!Number.isFinite(pct) || pct <= 0 || price <= 0) return 0;
  return Math.round(price * (pct / 100));
}

/**
 * Hold a deposit inside [floorCents, priceCents].
 *
 * A deposit can never exceed the price — charging more up front than the thing
 * costs is always a bug. `floorCents` is the caller's, because the two paths
 * legitimately disagree: regular services enforce Stripe's 50-cent minimum
 * charge, while a session's deposit may be genuinely zero (a free session, or
 * payment_mode "none"), and forcing 50 there would invent a charge.
 *
 * When priceCents is unknown (null/0) there is nothing to clamp against, so the
 * deposit is floored only — the caller decides whether that is chargeable.
 */
export function clampDepositCents(depositCents, priceCents, opts) {
  const floor = Math.max(0, Math.round(Number(opts && opts.floorCents) || 0));
  let cents = Math.round(Number(depositCents) || 0);
  if (!Number.isFinite(cents) || cents < 0) cents = 0;
  const price = Math.round(Number(priceCents) || 0);
  if (price > 0) cents = Math.min(price, cents);
  return Math.max(floor, cents);
}
