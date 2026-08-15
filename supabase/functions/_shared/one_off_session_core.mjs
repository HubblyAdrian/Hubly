/**
 * One-Off Session — pure core logic.
 *
 * Deliberately plain ESM JavaScript with ZERO imports so the exact same file is
 * the single source of truth for three runtimes:
 *   1. the Deno edge functions (imported from one_off_session_engine.ts),
 *   2. the Node test runner (tests/one-off-sessions.test.mjs),
 *   3. anything client-side that needs the same slot/deposit math.
 *
 * Everything here is deterministic and side-effect free: slot generation,
 * deposit math, lifecycle rules, validation, seat allocation. Nothing that
 * touches the database, Stripe, or the calendar belongs in this file — that
 * lives in one_off_session_engine.ts, which is the only authority for writes.
 *
 * A One-Off Session is a TEMPORARY booking campaign layered on top of Hubly's
 * existing engines. It is never a permanent Service, and this file never
 * invents catalog data — a session may REFERENCE a Service Engine service id,
 * but it owns its own duration/price/payment configuration for the event.
 */

export const SESSION_STATUSES = [
  "draft",
  "published",
  "sold_out",
  "closed",
  "cancelled",
  "completed",
];

/** The only status a customer can actually consume a slot in. */
export const BOOKABLE_STATUS = "published";

/** Statuses whose public page still renders (with an honest closed/sold-out state). */
export const PUBLICLY_VISIBLE_STATUSES = ["published", "sold_out", "closed", "completed"];

/** Statuses that hold the provider's calendar (block exists, normal booking excluded). */
export const CALENDAR_HOLDING_STATUSES = ["published", "sold_out"];

export const SESSION_VISIBILITIES = ["link_only", "public"];
export const PAYMENT_MODES = ["none", "deposit", "full"];
export const DEPOSIT_TYPES = ["flat", "percentage"];
export const LOCATION_TYPES = ["in_person", "virtual", "customer_address"];

export const BOOKING_STATUSES = ["pending_payment", "confirmed", "cancelled"];
export const BOOKING_PAYMENT_STATUSES = ["none", "pending", "paid", "failed", "refunded"];

/** Stripe's real minimum chargeable amount (usd). Below this we never open checkout. */
export const STRIPE_MIN_CHARGE_CENTS = 50;

/** Hard ceilings — a session is an event, not an open-ended schedule. */
export const MAX_APPOINTMENT_DURATION_MINUTES = 12 * 60;
export const MAX_SLOTS_PER_SESSION = 500;
export const MAX_CAPACITY_PER_SLOT = 100;

/* ────────────────────────── time helpers ────────────────────────── */

/** "08:00" / "8:00 AM" / "08:00:00" → minutes past midnight. null when unparseable. */
export function parseTimeToMinutes(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || min > 59 || min < 0) return null;
  const ampm = (m[3] || "").toLowerCase();
  if (ampm === "am") h = h === 12 ? 0 : h;
  else if (ampm === "pm") h = h === 12 ? 12 : h + 12;
  if (h < 0 || h > 24) return null;
  const total = h * 60 + min;
  return total > 24 * 60 ? null : total;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** minutes past midnight → "HH:MM" (24h, the storage format). */
export function minutesToTime(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  return `${pad2(Math.floor(m / 60) % 24)}:${pad2(m % 60)}`;
}

/** minutes past midnight → "8:00 AM" (the customer-facing format). */
export function formatSlotLabel(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${pad2(mm)} ${ampm}`;
}

/* ────────────────────────── slot generation ────────────────────────── */

/**
 * The session's slot grid — derived, never stored.
 *
 * 8:00–14:00, 20-minute appointments, 0 buffer → 18 slots starting 8:00, 8:20,
 * … 13:40. A slot only exists when the FULL appointment fits inside the window,
 * so a trailing partial slot is never offered. Buffer is dead time AFTER each
 * appointment (it advances the next start but is not part of the appointment).
 *
 * Returns [] rather than throwing on nonsense input — validateSessionDraft() is
 * where bad configuration is reported; this stays a pure projection.
 */
export function generateSessionSlots(session) {
  const startMin = parseTimeToMinutes(session && session.start_time);
  const endMin = parseTimeToMinutes(session && session.end_time);
  const duration = Math.round(Number(session && session.appointment_duration_minutes) || 0);
  const buffer = Math.max(0, Math.round(Number(session && session.buffer_minutes) || 0));
  if (startMin == null || endMin == null) return [];
  if (endMin <= startMin) return [];
  if (!Number.isFinite(duration) || duration <= 0) return [];
  if (duration > endMin - startMin) return [];

  const step = duration + buffer;
  const slots = [];
  for (let cursor = startMin; cursor + duration <= endMin; cursor += step) {
    slots.push({
      index: slots.length,
      start_minutes: cursor,
      end_minutes: cursor + duration,
      time: minutesToTime(cursor),
      end_time: minutesToTime(cursor + duration),
      label: formatSlotLabel(cursor),
    });
    if (slots.length >= MAX_SLOTS_PER_SESSION) break;
  }
  return slots;
}

/* ────────────────────────── payment math ────────────────────────── */

/**
 * What the customer actually pays today, in integer cents.
 *
 * The backend is authoritative here — the AI may propose a deposit, but this
 * function is what a checkout is ever built from. Deposit is clamped into
 * [0, price] so a misconfigured "$200 deposit on a $150 session" can never
 * overcharge; validateSessionDraft() separately REJECTS that configuration so
 * the clamp is a safety net, not a silent correction of a saved session.
 */
export function resolveSessionPayment(session) {
  const price = Math.max(0, Math.round(Number(session && session.price_cents) || 0));
  const currency = String((session && session.currency) || "usd").toLowerCase();
  const mode = PAYMENT_MODES.includes(String(session && session.payment_mode))
    ? String(session.payment_mode)
    : "none";

  let depositCents = null;
  let chargeNow = 0;

  if (mode === "full") {
    chargeNow = price;
  } else if (mode === "deposit") {
    const depositType = DEPOSIT_TYPES.includes(String(session && session.deposit_type))
      ? String(session.deposit_type)
      : "flat";
    if (depositType === "percentage") {
      const pct = Number(session && session.deposit_percentage);
      depositCents = Number.isFinite(pct) && pct > 0 ? Math.round(price * (pct / 100)) : 0;
    } else {
      depositCents = Math.round(Number(session && session.deposit_cents) || 0);
    }
    depositCents = Math.max(0, Math.min(price, depositCents));
    chargeNow = depositCents;
  }

  const balance = Math.max(0, price - chargeNow);
  return {
    mode,
    currency,
    price_cents: price,
    deposit_cents: mode === "deposit" ? depositCents : null,
    charge_now_cents: chargeNow,
    balance_due_cents: balance,
    requires_checkout: chargeNow >= STRIPE_MIN_CHARGE_CENTS,
    /** Configured to charge but the amount is under Stripe's floor — book without payment. */
    below_stripe_minimum: chargeNow > 0 && chargeNow < STRIPE_MIN_CHARGE_CENTS,
  };
}

/** "$50 deposit due today · $100 at your session" — one honest line, never invented. */
export function describeSessionPayment(payment) {
  const money = (c) => `$${(Math.round(Number(c) || 0) / 100).toFixed(2).replace(/\.00$/, "")}`;
  if (!payment || payment.price_cents <= 0) return "No payment required to book.";
  if (payment.mode === "none") return `${money(payment.price_cents)} — paid at your session.`;
  if (payment.mode === "full") return `${money(payment.price_cents)} due today.`;
  if (payment.charge_now_cents <= 0) return `${money(payment.price_cents)} — paid at your session.`;
  return `${money(payment.charge_now_cents)} deposit due today · ${money(payment.balance_due_cents)} at your session.`;
}

/* ────────────────────────── validation ────────────────────────── */

/**
 * Every rule §17 requires, enforced server-side. Returns a list of plain-English
 * problems (empty = valid). The AI never enforces any of this; it only ever
 * receives the resulting messages.
 */
export function validateSessionDraft(input) {
  const errors = [];
  const s = input || {};

  const name = String(s.name || "").trim();
  if (!name) errors.push("A session name is required.");
  if (name.length > 120) errors.push("Session name is too long (120 characters max).");

  const date = String(s.session_date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.push("A session date (YYYY-MM-DD) is required.");
  } else if (Number.isNaN(Date.parse(`${date}T12:00:00Z`))) {
    errors.push("That session date isn't a real date.");
  }

  const startMin = parseTimeToMinutes(s.start_time);
  const endMin = parseTimeToMinutes(s.end_time);
  if (startMin == null) errors.push("A start time is required.");
  if (endMin == null) errors.push("An end time is required.");
  if (startMin != null && endMin != null && endMin <= startMin) {
    errors.push("The end time has to be after the start time.");
  }

  const duration = Number(s.appointment_duration_minutes);
  if (!Number.isFinite(duration) || duration <= 0) {
    errors.push("Appointment length must be a positive number of minutes.");
  } else if (duration > MAX_APPOINTMENT_DURATION_MINUTES) {
    errors.push("Appointment length is unrealistically long (12 hours max).");
  } else if (startMin != null && endMin != null && endMin > startMin && duration > endMin - startMin) {
    errors.push("Each appointment is longer than the whole session window.");
  }

  const buffer = Number(s.buffer_minutes ?? 0);
  if (!Number.isFinite(buffer) || buffer < 0) errors.push("Buffer minutes can't be negative.");

  const capacity = Number(s.capacity_per_slot ?? 1);
  if (!Number.isFinite(capacity) || capacity < 1 || Math.floor(capacity) !== capacity) {
    errors.push("Capacity per time slot must be a whole number of at least 1.");
  } else if (capacity > MAX_CAPACITY_PER_SLOT) {
    errors.push(`Capacity per time slot can't exceed ${MAX_CAPACITY_PER_SLOT}.`);
  }

  if (s.total_capacity != null) {
    const total = Number(s.total_capacity);
    if (!Number.isFinite(total) || total < 1 || Math.floor(total) !== total) {
      errors.push("Total capacity must be a whole number of at least 1.");
    }
  }

  if (s.price_cents != null) {
    const price = Number(s.price_cents);
    if (!Number.isFinite(price) || price < 0 || Math.floor(price) !== price) {
      errors.push("Price must be a whole number of cents and can't be negative.");
    }
  }

  const mode = String(s.payment_mode || "none");
  if (!PAYMENT_MODES.includes(mode)) {
    errors.push(`Payment mode must be one of: ${PAYMENT_MODES.join(", ")}.`);
  }
  if (mode !== "none" && !(Number(s.price_cents) > 0)) {
    errors.push("A session that collects payment needs a price.");
  }
  if (mode === "deposit") {
    const depositType = String(s.deposit_type || "flat");
    if (!DEPOSIT_TYPES.includes(depositType)) {
      errors.push(`Deposit type must be one of: ${DEPOSIT_TYPES.join(", ")}.`);
    }
    if (depositType === "flat") {
      const dep = Number(s.deposit_cents);
      if (!Number.isFinite(dep) || dep <= 0) errors.push("A deposit amount is required.");
      else if (Number(s.price_cents) > 0 && dep > Number(s.price_cents)) {
        errors.push("The deposit can't be more than the session price.");
      }
    } else {
      const pct = Number(s.deposit_percentage);
      if (!Number.isFinite(pct) || pct <= 0) errors.push("A deposit percentage is required.");
      else if (pct > 100) errors.push("The deposit percentage can't be more than 100%.");
    }
  }

  if (s.visibility != null && !SESSION_VISIBILITIES.includes(String(s.visibility))) {
    errors.push(`Visibility must be one of: ${SESSION_VISIBILITIES.join(", ")}.`);
  }
  if (s.location_type != null && !LOCATION_TYPES.includes(String(s.location_type))) {
    errors.push(`Location type must be one of: ${LOCATION_TYPES.join(", ")}.`);
  }
  if (s.status != null && !SESSION_STATUSES.includes(String(s.status))) {
    errors.push(`Status must be one of: ${SESSION_STATUSES.join(", ")}.`);
  }

  // Only worth computing once the shape above is sane, otherwise it's noise.
  if (!errors.length) {
    const slots = generateSessionSlots(s);
    if (!slots.length) errors.push("That configuration produces no bookable time slots.");
    if (slots.length >= MAX_SLOTS_PER_SESSION) {
      errors.push(`That configuration produces more than ${MAX_SLOTS_PER_SESSION} slots.`);
    }
  }

  return errors;
}

/* ────────────────────────── lifecycle ────────────────────────── */

const SESSION_TRANSITIONS = {
  draft: ["published", "cancelled"],
  published: ["sold_out", "closed", "cancelled", "completed"],
  sold_out: ["published", "closed", "cancelled", "completed"],
  closed: ["published", "cancelled", "completed"],
  cancelled: [],
  completed: [],
};

export function canTransitionSession(from, to) {
  const allowed = SESSION_TRANSITIONS[String(from)] || [];
  return allowed.includes(String(to));
}

/**
 * Only a published session consumes slots. Everything else is honest about why not.
 *
 * `now` is optional and shaped { date: "YYYY-MM-DD", minutes: <past midnight> } in
 * the SESSION's own local wall time — the same wall-clock convention every other
 * Hubly surface stores. Pass it and a session whose day has already gone is
 * reported as over regardless of the status column, so a session nobody
 * remembered to close can never take a booking for a date in the past.
 */
export function sessionBookingBlockReason(session, now) {
  const status = String((session && session.status) || "draft");
  if (status === "draft") return "This session isn't open for booking yet.";
  if (status === "sold_out") return "This session is fully booked.";
  if (status === "cancelled") return "This session was cancelled.";
  if (status === "completed") return "This session has already happened.";
  if (status !== BOOKABLE_STATUS) return "This session is no longer accepting bookings.";
  if (sessionHasPassed(session, now)) return "This session has already happened.";
  return null;
}

/** True when the session's whole window is behind us in its own local time. */
export function sessionHasPassed(session, now) {
  if (!now || !now.date) return false;
  const date = String((session && session.session_date) || "").slice(0, 10);
  if (!date) return false;
  if (date < String(now.date)) return true;
  if (date > String(now.date)) return false;
  const end = parseTimeToMinutes(session && session.end_time);
  return end != null && Number(now.minutes) >= end;
}

/** The CTA state a website promotion must reflect — never a stale "Book Now". */
export function sessionPromotionState(session) {
  const status = String((session && session.status) || "draft");
  if (status === "published") return { state: "active", cta: "Book Your Session", linkable: true };
  if (status === "sold_out") return { state: "sold_out", cta: "Sold Out", linkable: false };
  if (status === "cancelled") return { state: "cancelled", cta: "Cancelled", linkable: false };
  if (status === "completed") return { state: "completed", cta: "No longer available", linkable: false };
  if (status === "closed") return { state: "closed", cta: "No longer available", linkable: false };
  return { state: "draft", cta: "Not published yet", linkable: false };
}

/* ────────────────────────── availability projection ────────────────────────── */

/**
 * Fold real bookings into the derived slot grid.
 *
 * `bookings` are rows shaped { slot_time, seat_no, status }. Cancelled bookings
 * free their seat back up — the same rule the unique index in the migration
 * enforces, restated here so the projection and the constraint can't disagree.
 *
 * `opts.busyWindows` are real conflicting holds on the provider's calendar for
 * that day, as [{ start_minutes, end_minutes }] — the session's OWN parent
 * block is never among them (see getSessionAvailability), because the block is
 * what makes these appointments possible, not a conflict with them.
 */
export function computeSessionAvailability(session, bookings, opts) {
  const slots = generateSessionSlots(session);
  const capacity = Math.max(1, Math.round(Number(session && session.capacity_per_slot) || 1));
  const live = (bookings || []).filter((b) => String(b && b.status) !== "cancelled");
  const defaultDuration = Math.max(1, Math.round(Number(session && session.appointment_duration_minutes) || 30));

  // Seats are counted by OVERLAP, not by an exact slot_time match. A booking
  // carries the duration it was made at, so after the owner shortens
  // appointments (20 → 10 minutes) an existing 8:00 booking still correctly
  // occupies the new 8:10 slot instead of the grid quietly double-selling it.
  const takenByTime = Object.create(null);
  const occupied = live.map((b) => {
    const start = parseTimeToMinutes(b && b.slot_time);
    const dur = Math.max(1, Math.round(Number(b && b.duration_minutes) || defaultDuration));
    const key = String((b && b.slot_time) || "").slice(0, 5);
    if (!takenByTime[key]) takenByTime[key] = [];
    takenByTime[key].push(Number(b.seat_no) || 0);
    return { start, end: start == null ? null : start + dur };
  }).filter((o) => o.start != null);

  const totalCapacityRaw = session && session.total_capacity;
  const totalCapacity = Number.isFinite(Number(totalCapacityRaw)) && Number(totalCapacityRaw) > 0
    ? Math.round(Number(totalCapacityRaw))
    : null;
  const bookedCount = live.length;
  const sessionFull = totalCapacity != null && bookedCount >= totalCapacity;
  const now = opts && opts.now;
  const blockReason = sessionBookingBlockReason(session, now);
  // Provider-side reads want the true grid even for a draft/closed session; only
  // the customer-facing path passes forCustomer so the grid honestly closes.
  const forCustomer = !!(opts && opts.forCustomer);

  const busy = ((opts && opts.busyWindows) || [])
    .map((w) => ({ start: Number(w && w.start_minutes), end: Number(w && w.end_minutes) }))
    .filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start);

  const sameDay = !!(now && now.date && String((session && session.session_date) || "").slice(0, 10) === String(now.date));
  const nowMinutes = sameDay ? Number(now.minutes) : null;

  let totalSeats = 0;
  const out = slots.map((slot) => {
    const seatsTaken = occupied.filter((o) => slot.start_minutes < o.end && slot.end_minutes > o.start).length;
    totalSeats += capacity;
    const open = Math.max(0, capacity - seatsTaken);
    const conflicted = busy.some((w) => slot.start_minutes < w.end && slot.end_minutes > w.start);
    // A slot whose start has already gone by is never offered — a link shared on
    // the morning of the session must stop selling 8:00 once it's 8:05.
    const past = nowMinutes != null ? nowMinutes >= slot.start_minutes : false;
    const available = open > 0 && !sessionFull && !conflicted && !past &&
      (!forCustomer || !blockReason);
    return {
      ...slot,
      seats_total: capacity,
      seats_taken: seatsTaken,
      seats_open: open,
      /** A real conflicting hold on the provider's calendar covers this slot. */
      conflicted,
      past,
      available,
    };
  });

  // Counted from the real bookings, not from the per-slot overlap tallies —
  // one booking overlapping three slots is still one booked spot.
  const seatsTaken = live.length;
  const effectiveTotal = totalCapacity != null ? Math.min(totalCapacity, totalSeats) : totalSeats;

  return {
    slots: out,
    slot_count: out.length,
    total_spots: effectiveTotal,
    booked: seatsTaken,
    remaining: Math.max(0, effectiveTotal - seatsTaken),
    sold_out: effectiveTotal > 0 && seatsTaken >= effectiveTotal,
    block_reason: blockReason,
    /** seat numbers held at each exact slot_time — what the unique index keys on. */
    seats_by_time: takenByTime,
  };
}

/**
 * §18 — what a proposed change would do to bookings that already exist.
 *
 * Returns { blocked[], warnings[] }. `blocked` is fatal: the change is refused
 * and the message is what the owner (or the AI, verbatim) is told. `warnings`
 * are non-fatal facts the owner deserves to hear before/after the change —
 * notably that repricing NEVER rewrites what someone already paid.
 *
 * Existing bookings carry their own price_cents / deposit_cents / duration_minutes,
 * so editing the session is inherently non-retroactive. These rules exist to stop
 * the *grid* from being changed out from under a real appointment.
 */
export function assessSessionChange(session, patch, bookings) {
  const blocked = [];
  const warnings = [];
  const live = (bookings || []).filter((b) => String(b && b.status) !== "cancelled");
  if (!live.length) return { blocked, warnings };

  const next = { ...(session || {}), ...(patch || {}) };
  const changed = (key) => patch && Object.prototype.hasOwnProperty.call(patch, key) &&
    String(patch[key] ?? "") !== String((session || {})[key] ?? "");

  // 1. A booking must still land on a real slot after the change.
  if (changed("start_time") || changed("end_time") || changed("appointment_duration_minutes") ||
      changed("buffer_minutes")) {
    const times = new Set(generateSessionSlots(next).map((s) => s.time));
    const orphans = live.filter((b) => !times.has(String(b.slot_time).slice(0, 5)));
    if (orphans.length) {
      blocked.push(
        `That change would leave ${orphans.length} existing booking${orphans.length === 1 ? "" : "s"} ` +
        `(${orphans.map((b) => formatSlotLabel(parseTimeToMinutes(b.slot_time) || 0)).join(", ")}) ` +
        `outside the session's times. Move or cancel ${orphans.length === 1 ? "it" : "them"} first.`,
      );
    }
  }

  // 2. Never let the grid get finer than an appointment somebody already holds —
  //    that is what would let a new booking be sold on top of a real one.
  if (changed("appointment_duration_minutes") || changed("buffer_minutes")) {
    const step = Math.max(1, Math.round(Number(next.appointment_duration_minutes) || 0)) +
      Math.max(0, Math.round(Number(next.buffer_minutes) || 0));
    const longest = live.reduce((m, b) => Math.max(m, Math.round(Number(b.duration_minutes) || 0)), 0);
    if (longest > step) {
      blocked.push(
        `Existing bookings are ${longest} minutes long, so shortening appointments to ${next.appointment_duration_minutes} ` +
        `minutes would overlap them. Cancel those bookings first, or keep appointments at ${longest} minutes or longer.`,
      );
    }
  }

  // 3. Capacity can't drop below seats already handed out at a slot.
  if (changed("capacity_per_slot")) {
    const cap = Math.round(Number(next.capacity_per_slot) || 1);
    if (live.some((b) => Number(b.seat_no) >= cap)) {
      blocked.push(
        "That capacity is lower than the number of people already booked at one of the times.",
      );
    }
  }

  // 4. Moving the date is not a reschedule — the appointments would not follow.
  if (changed("session_date")) {
    blocked.push(
      `${live.length} booking${live.length === 1 ? " is" : "s are"} already on ${String(session.session_date).slice(0, 10)}. ` +
      `Changing the date would strand ${live.length === 1 ? "it" : "them"} — cancel and recreate the session instead.`,
    );
  }

  // 5. Non-fatal, but the owner must not be left thinking otherwise.
  if (changed("price_cents") || changed("deposit_cents") || changed("deposit_percentage") ||
      changed("payment_mode")) {
    const paid = live.filter((b) => String(b.payment_status) === "paid").length;
    warnings.push(
      `This changes the price for NEW bookings only. ${live.length} existing booking` +
      `${live.length === 1 ? "" : "s"}${paid ? ` (${paid} already paid)` : ""} keep the price ` +
      `${live.length === 1 ? "it was" : "they were"} booked at.`,
    );
  }

  if (changed("location")) {
    warnings.push(
      `${live.length} customer${live.length === 1 ? "" : "s"} already booked and ` +
      `${live.length === 1 ? "was" : "were"} told the old location — they aren't notified automatically.`,
    );
  }

  return { blocked, warnings };
}

/**
 * The lowest unused seat for a slot, or null when the slot is full.
 *
 * Seat numbers are what makes concurrency safe: the unique index on
 * (session_id, slot_time, seat_no) WHERE status <> 'cancelled' means two
 * simultaneous bookers racing for the same single-capacity slot cannot both
 * win — the loser gets a unique violation and retries the next free seat (or
 * is told the slot is gone). No advisory locks, no read-then-write window.
 */
export function nextFreeSeat(takenSeats, capacity) {
  const cap = Math.max(1, Math.round(Number(capacity) || 1));
  const taken = new Set((takenSeats || []).map((n) => Number(n)));
  for (let seat = 0; seat < cap; seat++) {
    if (!taken.has(seat)) return seat;
  }
  return null;
}

/* ────────────────────────── booking link ────────────────────────── */

/** The public URL a session is distributed by. Business subdomain, opaque token. */
export function buildSessionBookingUrl(slug, token, opts) {
  const domain = String((opts && opts.domain) || "myhubly.app");
  const cleanSlug = String(slug || "").trim();
  const cleanToken = String(token || "").trim();
  if (!cleanToken) return null;
  if (!cleanSlug) return `https://${domain}/session/${encodeURIComponent(cleanToken)}`;
  return `https://${cleanSlug}.${domain}/session/${encodeURIComponent(cleanToken)}`;
}

/**
 * A confirmation code shaped like the Booking Engine's (H + 7 chars, no
 * ambiguous glyphs) so support can read one aloud without confusion.
 * `random` is injectable purely so tests can be deterministic.
 */
export function sessionConfirmationCode(random) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rnd = typeof random === "function" ? random : Math.random;
  let out = "S";
  for (let i = 0; i < 7; i++) out += alphabet[Math.floor(rnd() * alphabet.length)];
  return out;
}

/* ────────────────────────── industry-agnostic naming ────────────────────────── */

/**
 * Blueprint-influenced SUGGESTIONS only. The engine never branches on these —
 * a photographer's "Mini Session" and a detailer's "Car Wash Day" are the same
 * primitive with different copy. An unknown business type falls back to the
 * neutral wording rather than a photography default.
 */
export const SESSION_TERMINOLOGY = {
  photography: { noun: "Mini Session", plural: "Mini Sessions", verb: "Book a session", durationHint: 20 },
  detailing: { noun: "Wash Day", plural: "Wash Days", verb: "Reserve a spot", durationHint: 45 },
  "lawn-care": { noun: "Neighborhood Service Day", plural: "Service Days", verb: "Claim a time", durationHint: 45 },
  "house-cleaning": { noun: "Cleaning Day", plural: "Cleaning Days", verb: "Book a time", durationHint: 90 },
  "pressure-washing": { noun: "Wash Event", plural: "Wash Events", verb: "Reserve a slot", durationHint: 60 },
  "window-cleaning": { noun: "Window Day", plural: "Window Days", verb: "Reserve a slot", durationHint: 45 },
  hvac: { noun: "Tune-Up Day", plural: "Tune-Up Days", verb: "Book a visit", durationHint: 60 },
  spa: { noun: "Express Day", plural: "Express Days", verb: "Book a time", durationHint: 30 },
};

export const DEFAULT_SESSION_TERMINOLOGY = {
  noun: "Session",
  plural: "Sessions",
  verb: "Book a time",
  durationHint: 30,
};

export function sessionTerminology(businessType) {
  const key = String(businessType || "").trim().toLowerCase();
  return SESSION_TERMINOLOGY[key] || DEFAULT_SESSION_TERMINOLOGY;
}
