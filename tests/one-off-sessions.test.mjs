/**
 * One-Off Sessions — behavior + wiring proofs.
 *
 * The behavioral half runs the REAL production logic: one_off_session_core.mjs is
 * the same module the Deno edge functions import, so slot generation, deposit
 * math, validation, lifecycle and seat allocation are exercised here rather than
 * re-implemented in a test-only copy.
 *
 * The wiring half proves the parts that can only be verified structurally in this
 * repo (SQL constraints, Edge Function authorization, webhook routing, routes,
 * catalog lockstep) — the same discipline as tests/commerce-engine.test.mjs and
 * tests/storefront_conformance.mjs.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const core = await import(join(root, 'supabase/functions/_shared/one_off_session_core.mjs'));

const migration = read('supabase/migrations/20260815120000_one_off_sessions.sql');
/** The migration with `--` comments stripped. Static analysis of what the file
 *  DOES must never be fooled by prose that happens to mention SQL keywords. */
const migrationSql = migration.replace(/^\s*--.*$/gm, '');
const engine = read('supabase/functions/_shared/one_off_session_engine.ts');
const api = read('supabase/functions/one-off-sessions/index.ts');
const checkout = read('supabase/functions/create-booking-checkout/index.ts');
const webhook = read('supabase/functions/stripe-webhook/index.ts');
const router = read('api/router.js');
const config = read('supabase/config.toml');
const registry = read('supabase/functions/_shared/hubly_capability_registry.ts');
const conversation = read('supabase/functions/hubly-conversation/index.ts');
const storefrontTs = read('supabase/functions/_shared/storefront_ast.ts');
const storefrontJs = read('public/journey-os/commerce/storefront-ast.js');
const storePage = read('public/journey-os/commerce/store-page.js');
const hubly = read('public/hubly.html');
const journey = read('public/journey-os/journey.js');
const sessionPage = read('public/session.html');

/** The brief's own worked example, used across several tests. */
const MINI_SESSIONS = {
  name: 'Fall Mini Sessions',
  session_date: '2026-08-20',
  start_time: '08:00',
  end_time: '14:00',
  appointment_duration_minutes: 20,
  buffer_minutes: 0,
  capacity_per_slot: 1,
  price_cents: 15000,
  payment_mode: 'deposit',
  deposit_type: 'flat',
  deposit_cents: 5000,
  status: 'published',
};

/* ────────────────────────── slot generation ────────────────────────── */

describe('Slot generation', () => {
  it('8 AM–2 PM at 20 minutes produces 18 slots, 8:00 through 1:40', () => {
    const slots = core.generateSessionSlots(MINI_SESSIONS);
    assert.equal(slots.length, 18);
    assert.equal(slots[0].time, '08:00');
    assert.equal(slots[0].label, '8:00 AM');
    assert.equal(slots[1].time, '08:20');
    assert.equal(slots[2].time, '08:40');
    assert.equal(slots[17].time, '13:40');
    assert.equal(slots[17].label, '1:40 PM');
  });

  it('never offers a slot whose appointment would run past the end time', () => {
    // 08:00–09:00 at 25 minutes fits two (8:00, 8:25); a third would end at 9:15.
    const slots = core.generateSessionSlots({
      start_time: '08:00', end_time: '09:00', appointment_duration_minutes: 25, buffer_minutes: 0,
    });
    assert.deepEqual(slots.map((s) => s.time), ['08:00', '08:25']);
  });

  it('buffer pushes the next start without extending the appointment', () => {
    const slots = core.generateSessionSlots({
      start_time: '09:00', end_time: '12:00', appointment_duration_minutes: 30, buffer_minutes: 15,
    });
    assert.deepEqual(slots.map((s) => s.time), ['09:00', '09:45', '10:30', '11:15']);
    assert.equal(slots[0].end_time, '09:30');
  });

  it('returns no slots for a window that cannot hold one appointment', () => {
    assert.equal(core.generateSessionSlots({
      start_time: '08:00', end_time: '08:10', appointment_duration_minutes: 20,
    }).length, 0);
    assert.equal(core.generateSessionSlots({
      start_time: '14:00', end_time: '08:00', appointment_duration_minutes: 20,
    }).length, 0);
  });

  // Found by running the engine against real PostgreSQL: a `date` column comes
  // back as a JS Date from a direct driver, and reading it via toISOString()
  // moves the session to the previous day anywhere east of UTC.
  it('reads a calendar date correctly whatever shape it arrives in', () => {
    assert.equal(core.toDateOnly('2099-08-20'), '2099-08-20');
    assert.equal(core.toDateOnly('2099-08-20T00:00:00.000Z'), '2099-08-20');
    // A Date at LOCAL midnight is that local day, in every timezone.
    assert.equal(core.toDateOnly(new Date(2099, 7, 20, 0, 0, 0)), '2099-08-20');
    assert.equal(core.toDateOnly(new Date(2099, 7, 20, 23, 59, 0)), '2099-08-20');
    assert.equal(core.toDateOnly(null), '');
    assert.equal(core.toDateOnly('not a date'), '');
    assert.equal(core.toDateOnly(new Date('nonsense')), '');
  });

  it('validates a session whose date arrived as a Date object', () => {
    const fromDb = { ...MINI_SESSIONS, session_date: new Date(2026, 7, 20, 0, 0, 0) };
    // This is what publishSession does: re-validate the STORED row.
    assert.deepEqual(core.validateSessionDraft(fromDb), []);
  });

  it('parses 12-hour times the way an owner or the AI might send them', () => {
    assert.equal(core.parseTimeToMinutes('8:00 AM'), 480);
    assert.equal(core.parseTimeToMinutes('2:00 PM'), 840);
    assert.equal(core.parseTimeToMinutes('12:00 AM'), 0);
    assert.equal(core.parseTimeToMinutes('12:30 PM'), 750);
    assert.equal(core.parseTimeToMinutes('08:00:00'), 480);
    assert.equal(core.parseTimeToMinutes('nonsense'), null);
  });
});

/* ────────────────────────── payment math ────────────────────────── */

describe('Payment configuration', () => {
  it('flat deposit charges the deposit today and leaves the balance', () => {
    const p = core.resolveSessionPayment(MINI_SESSIONS);
    assert.equal(p.charge_now_cents, 5000);
    assert.equal(p.deposit_cents, 5000);
    assert.equal(p.balance_due_cents, 10000);
    assert.equal(p.requires_checkout, true);
    assert.match(core.describeSessionPayment(p), /\$50 deposit due today.*\$100 at your session/);
  });

  it('percentage deposit is computed off the real price', () => {
    const p = core.resolveSessionPayment({
      price_cents: 15000, payment_mode: 'deposit', deposit_type: 'percentage', deposit_percentage: 25,
    });
    assert.equal(p.charge_now_cents, 3750);
    assert.equal(p.balance_due_cents, 11250);
  });

  it('full payment charges the whole price and leaves no balance', () => {
    const p = core.resolveSessionPayment({ price_cents: 15000, payment_mode: 'full' });
    assert.equal(p.charge_now_cents, 15000);
    assert.equal(p.balance_due_cents, 0);
  });

  it('no-payment sessions never open checkout', () => {
    const p = core.resolveSessionPayment({ price_cents: 15000, payment_mode: 'none' });
    assert.equal(p.charge_now_cents, 0);
    assert.equal(p.requires_checkout, false);
  });

  it('clamps a deposit that exceeds the price rather than overcharging', () => {
    const p = core.resolveSessionPayment({
      price_cents: 15000, payment_mode: 'deposit', deposit_type: 'flat', deposit_cents: 20000,
    });
    assert.equal(p.charge_now_cents, 15000);
  });

  it('does not open checkout below Stripe\'s real minimum', () => {
    const p = core.resolveSessionPayment({
      price_cents: 100, payment_mode: 'deposit', deposit_type: 'flat', deposit_cents: 25,
    });
    assert.equal(p.charge_now_cents, 25);
    assert.equal(p.requires_checkout, false);
    assert.equal(p.below_stripe_minimum, true);
  });
});

/* ────────────────────────── validation (§17) ────────────────────────── */

describe('Backend validation', () => {
  const bad = (patch) => core.validateSessionDraft({ ...MINI_SESSIONS, ...patch });

  it('accepts the worked example', () => {
    assert.deepEqual(core.validateSessionDraft(MINI_SESSIONS), []);
  });

  it('rejects an end time before the start time', () => {
    assert.match(bad({ end_time: '07:00' }).join(' '), /end time has to be after/i);
  });

  it('rejects a negative price', () => {
    assert.match(bad({ price_cents: -100 }).join(' '), /can't be negative/i);
  });

  it('rejects a deposit larger than the total', () => {
    assert.match(bad({ deposit_cents: 20000 }).join(' '), /deposit can't be more than/i);
  });

  it('rejects an appointment longer than the session window', () => {
    assert.match(bad({ appointment_duration_minutes: 600 }).join(' '), /longer than the whole session window/i);
  });

  it('rejects a payment mode with no price', () => {
    assert.match(bad({ price_cents: null }).join(' '), /needs a price/i);
  });

  it('rejects a missing name and a missing date', () => {
    assert.match(bad({ name: '' }).join(' '), /name is required/i);
    assert.match(bad({ session_date: 'August 20' }).join(' '), /session date/i);
  });

  it('rejects a configuration that produces no slots', () => {
    const errs = core.validateSessionDraft({
      ...MINI_SESSIONS, start_time: '08:00', end_time: '08:15', appointment_duration_minutes: 10,
      // 08:00–08:15 with 10-minute appointments and a 20-minute buffer: the first
      // slot fits, the second cannot — so this one must NOT be rejected.
      buffer_minutes: 20,
    });
    assert.deepEqual(errs, []);
    assert.equal(core.generateSessionSlots({
      start_time: '08:00', end_time: '08:15', appointment_duration_minutes: 10, buffer_minutes: 20,
    }).length, 1);
  });

  it('rejects nonsense capacity and percentage values', () => {
    assert.match(bad({ capacity_per_slot: 0 }).join(' '), /at least 1/i);
    assert.match(bad({ deposit_type: 'percentage', deposit_percentage: 150, deposit_cents: null }).join(' '), /more than 100/i);
  });
});

/* ────────────────────────── availability + concurrency ────────────────────────── */

describe('Availability and double-booking', () => {
  it('counts booked and remaining from real bookings only', () => {
    const bookings = [
      { slot_time: '08:00', seat_no: 0, status: 'confirmed' },
      { slot_time: '08:20', seat_no: 0, status: 'pending_payment' },
      { slot_time: '08:40', seat_no: 0, status: 'cancelled' },
    ];
    const a = core.computeSessionAvailability(MINI_SESSIONS, bookings);
    assert.equal(a.slot_count, 18);
    assert.equal(a.total_spots, 18);
    assert.equal(a.booked, 2);
    assert.equal(a.remaining, 16);
    assert.equal(a.slots.find((s) => s.time === '08:00').available, false);
    // A cancelled booking releases its seat — same rule the partial unique index enforces.
    assert.equal(a.slots.find((s) => s.time === '08:40').available, true);
  });

  it('a capacity-1 slot has exactly one seat, so two bookers cannot both take it', () => {
    // nextFreeSeat is the whole concurrency mechanism: the winner takes seat 0 and
    // the loser is told there is no seat left, rather than silently double-booking.
    assert.equal(core.nextFreeSeat([], 1), 0);
    assert.equal(core.nextFreeSeat([0], 1), null);
  });

  it('multi-capacity slots hand out distinct seats and then run out', () => {
    assert.equal(core.nextFreeSeat([], 3), 0);
    assert.equal(core.nextFreeSeat([0], 3), 1);
    assert.equal(core.nextFreeSeat([0, 1], 3), 2);
    assert.equal(core.nextFreeSeat([0, 1, 2], 3), null);
    // Order doesn't matter, and a freed middle seat is reused.
    assert.equal(core.nextFreeSeat([2, 0], 3), 1);
  });

  it('honours a whole-session total capacity below the slot count', () => {
    const a = core.computeSessionAvailability({ ...MINI_SESSIONS, total_capacity: 5 }, [
      { slot_time: '08:00', seat_no: 0, status: 'confirmed' },
    ]);
    assert.equal(a.total_spots, 5);
    assert.equal(a.remaining, 4);
  });

  it('marks a session sold out once every spot is taken', () => {
    const bookings = core.generateSessionSlots(MINI_SESSIONS)
      .map((s) => ({ slot_time: s.time, seat_no: 0, status: 'confirmed' }));
    const a = core.computeSessionAvailability(MINI_SESSIONS, bookings);
    assert.equal(a.remaining, 0);
    assert.equal(a.sold_out, true);
  });

  it('a real conflicting hold on the calendar removes only the overlapping slots', () => {
    // 10:00–11:00 busy: 10:00, 10:20 and 10:40 overlap; 09:40 and 11:00 do not.
    const a = core.computeSessionAvailability(MINI_SESSIONS, [], {
      busyWindows: [{ start_minutes: 600, end_minutes: 660 }],
    });
    const at = (t) => a.slots.find((s) => s.time === t);
    assert.equal(at('09:40').available, true);
    assert.equal(at('10:00').available, false);
    assert.equal(at('10:00').conflicted, true);
    assert.equal(at('10:40').available, false);
    assert.equal(at('11:00').available, true);
  });
});

/* ────────────────────────── lifecycle ────────────────────────── */

describe('Session lifecycle', () => {
  it('only a published session is bookable', () => {
    assert.equal(core.sessionBookingBlockReason({ status: 'published' }), null);
    for (const status of ['draft', 'sold_out', 'closed', 'cancelled', 'completed']) {
      assert.ok(core.sessionBookingBlockReason({ status }), `${status} must block booking`);
    }
  });

  it('a closed session refuses new bookings through the customer projection', () => {
    const a = core.computeSessionAvailability({ ...MINI_SESSIONS, status: 'closed' }, [], { forCustomer: true });
    assert.ok(a.slots.every((s) => !s.available));
    assert.match(a.block_reason, /no longer accepting/i);
  });

  it('allows only sensible status transitions', () => {
    assert.equal(core.canTransitionSession('draft', 'published'), true);
    assert.equal(core.canTransitionSession('published', 'closed'), true);
    assert.equal(core.canTransitionSession('closed', 'published'), true);
    // Historical sessions are never revived or deleted.
    assert.equal(core.canTransitionSession('cancelled', 'published'), false);
    assert.equal(core.canTransitionSession('completed', 'published'), false);
    assert.equal(core.canTransitionSession('draft', 'sold_out'), false);
  });

  it('a promotion never shows a stale Book CTA for an inactive session', () => {
    assert.deepEqual(core.sessionPromotionState({ status: 'published' }), { state: 'active', cta: 'Book Your Session', linkable: true });
    assert.equal(core.sessionPromotionState({ status: 'sold_out' }).cta, 'Sold Out');
    assert.equal(core.sessionPromotionState({ status: 'sold_out' }).linkable, false);
    assert.equal(core.sessionPromotionState({ status: 'closed' }).linkable, false);
    assert.equal(core.sessionPromotionState({ status: 'cancelled' }).linkable, false);
    assert.equal(core.sessionPromotionState({ status: 'draft' }).linkable, false);
  });
});

/* ────────────────────────── link + industry ────────────────────────── */

describe('Booking link and industry-agnostic naming', () => {
  it('builds a business-subdomain link that exposes no internal id', () => {
    const url = core.buildSessionBookingUrl('todds', 'aB3-xyz_9', { domain: 'myhubly.app' });
    assert.equal(url, 'https://todds.myhubly.app/session/aB3-xyz_9');
    assert.equal(core.buildSessionBookingUrl('todds', ''), null);
  });

  it('the same primitive carries different industry copy', () => {
    assert.equal(core.sessionTerminology('photography').noun, 'Mini Session');
    assert.equal(core.sessionTerminology('detailing').noun, 'Wash Day');
    assert.equal(core.sessionTerminology('lawn-care').noun, 'Neighborhood Service Day');
    // An unknown industry falls back to neutral wording, never a photography default.
    assert.equal(core.sessionTerminology('taxidermy').noun, 'Session');
    assert.equal(core.sessionTerminology(null).noun, 'Session');
  });

  it('confirmation codes avoid ambiguous characters', () => {
    let seed = 0;
    const code = core.sessionConfirmationCode(() => ((seed = (seed * 9301 + 49297) % 233280) / 233280));
    assert.equal(code.length, 8);
    assert.match(code, /^S[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{7}$/);
  });
});

/* ────────────────────────── database ────────────────────────── */

describe('Database schema and RLS', () => {
  it('creates both session tables', () => {
    assert.match(migration, /create table if not exists public\.one_off_sessions/);
    assert.match(migration, /create table if not exists public\.one_off_session_bookings/);
  });

  it('enforces the §17 rules in the database, not only in app code', () => {
    assert.match(migration, /one_off_sessions_window_ordered check \(end_time > start_time\)/);
    assert.match(migration, /one_off_sessions_appointment_fits/);
    assert.match(migration, /one_off_sessions_deposit_not_over_price/);
    assert.match(migration, /one_off_sessions_paid_needs_price/);
    assert.match(migration, /price_cents integer check \(price_cents is null or price_cents >= 0\)/);
  });

  it('makes double-booking physically impossible via a partial unique index', () => {
    assert.match(
      migration,
      /create unique index if not exists one_off_session_bookings_seat_uniq[\s\S]*?on public\.one_off_session_bookings\(session_id, slot_time, seat_no\)[\s\S]*?where status <> 'cancelled'/,
    );
  });

  it('defaults to draft and link-only', () => {
    assert.match(migration, /status text not null default 'draft'/);
    assert.match(migration, /visibility text not null default 'link_only'/);
  });

  it('links jobs to sessions so the calendar block is findable and excludable', () => {
    assert.match(migration, /alter table public\.jobs\s*\n\s*add column if not exists one_off_session_id uuid/);
    assert.match(migration, /jobs_one_off_session_id_idx/);
  });

  it('enables RLS with owner-only policies and NO anon policy', () => {
    assert.match(migration, /alter table public\.one_off_sessions enable row level security/);
    assert.match(migration, /alter table public\.one_off_session_bookings enable row level security/);
    assert.match(migration, /owns_business\(business_id\)/);
    assert.doesNotMatch(migration, /to anon/);
  });

  it('never deletes historical sessions on close or cancel', () => {
    assert.doesNotMatch(engine, /from\("one_off_sessions"\)\s*\.delete\(\)/);
  });

  // Deployment gate: this migration ships to a live database with real
  // businesses on it. It must only ever ADD, and it must survive being run
  // twice (a retried `supabase db push` is a normal thing to happen).
  it('is additive — it drops or rewrites nothing that belongs to another feature', () => {
    const destructive = [
      /drop\s+table/i,
      /drop\s+column/i,
      /drop\s+schema/i,
      /truncate/i,
      /\bdelete\s+from\b/i,
      /alter\s+column[\s\S]{0,60}type/i,
      /drop\s+constraint/i,
    ];
    for (const re of destructive) {
      assert.doesNotMatch(migrationSql, re, `migration must not contain ${re}`);
    }
    // The only UPDATE it may do is none at all — it backfills no existing rows.
    assert.doesNotMatch(migrationSql, /^\s*update\s+public\./im);
  });

  it('is idempotent — every object is created defensively', () => {
    const creates = migrationSql.match(/create\s+(table|index|unique index|trigger|policy|or replace function)/gi) || [];
    assert.ok(creates.length >= 8, `expected several create statements, saw ${creates.length}`);
    // Tables / indexes / columns guard with IF NOT EXISTS.
    for (const m of migrationSql.match(/create\s+table[^\n]*/gi) || []) {
      assert.match(m, /if not exists/i, m);
    }
    for (const m of migrationSql.match(/create\s+(unique\s+)?index[^\n]*/gi) || []) {
      assert.match(m, /if not exists/i, m);
    }
    for (const m of migrationSql.match(/add\s+column[^\n]*/gi) || []) {
      assert.match(m, /if not exists/i, m);
    }
    // Policies and triggers can't use IF NOT EXISTS, so each must be preceded
    // by its own DROP ... IF EXISTS.
    const policies = migrationSql.match(/create\s+policy\s+"([^"]+)"/gi) || [];
    for (const p of policies) {
      const name = p.match(/"([^"]+)"/)[1];
      assert.match(migrationSql, new RegExp(`drop policy if exists "${name}"`, 'i'), `policy "${name}" needs a drop-if-exists`);
    }
    const triggers = migrationSql.match(/create\s+trigger\s+(\w+)/gi) || [];
    for (const t of triggers) {
      const name = t.split(/\s+/).pop();
      assert.match(migrationSql, new RegExp(`drop trigger if exists ${name}`, 'i'), `trigger ${name} needs a drop-if-exists`);
    }
    assert.match(migrationSql, /create or replace function/i);
  });

  it('only touches its own tables plus one additive column on jobs', () => {
    // Every table this migration writes DDL against.
    const touched = new Set(
      [...migrationSql.matchAll(/(?:create table if not exists|alter table)\s+public\.(\w+)/gi)].map((m) => m[1]),
    );
    assert.deepEqual(
      [...touched].sort(),
      ['jobs', 'one_off_session_bookings', 'one_off_sessions'],
    );
    // …and on jobs, additively only.
    const jobsBlock = migrationSql.slice(migrationSql.indexOf('alter table public.jobs'));
    assert.match(jobsBlock.slice(0, 200), /add column if not exists one_off_session_id uuid/);
  });
});

/* ────────────────────────── calendar ────────────────────────── */

describe('Calendar blocking', () => {
  it('the block is one real jobs row using the existing Blocked primitive', () => {
    assert.match(engine, /const BLOCK_CUSTOMER_NAME = "Blocked"/);
    assert.match(engine, /customer_name: BLOCK_CUSTOMER_NAME/);
    // The literal must match what the app's calendar reads back as isBlock.
    assert.match(hubly, /isBlock: j\.customer_name==='Blocked'/);
  });

  it('publishing creates the hold and closing/cancelling releases it', () => {
    assert.match(engine, /export async function publishSession[\s\S]*?await syncCalendarBlock\(admin, published\)/);
    assert.match(engine, /export async function closeSession[\s\S]*?await releaseCalendarBlock\(admin, session\)/);
    assert.match(engine, /export async function cancelSession[\s\S]*?await releaseCalendarBlock\(admin, session\)/);
  });

  it('session availability excludes the session\'s OWN block, not other jobs', () => {
    assert.match(
      engine,
      /loadSessionDayConflicts[\s\S]*?if \(String\(j\.one_off_session_id \|\| ""\) === String\(session\.id\)\) continue;/,
    );
    // Cancelled jobs are skipped, same as jobBlocks() in the availability engine.
    assert.match(engine, /if \(status === "cancelled" \|\| status === "canceled"\) continue;/);
  });

  it('reuses the existing availability engine rather than forking it', () => {
    // Nothing in this feature re-implements normal booking availability; the block
    // is a jobs row, which both existing availability paths already read.
    const availability = read('supabase/functions/_shared/marketplace_availability.ts');
    assert.match(availability, /function jobBlocks/);
    // Session availability is its own derived grid over its own bookings — it
    // must not re-enter the normal-booking availability machinery (which would
    // see the session's own block and make every slot unbookable).
    assert.doesNotMatch(engine, /\.rpc\(\s*"get_busy_windows"/);
    assert.doesNotMatch(engine, /listAppointmentSlots\(/);
    assert.doesNotMatch(engine, /getAvailability\(/);
  });
});

/* ────────────────────────── Google Calendar ────────────────────────── */

describe('Google Calendar', () => {
  it('uses the existing sync engine and stores one event id per session', () => {
    assert.match(engine, /import \{ syncEnginePushCreate, syncEnginePushDelete \} from "\.\/google_calendar_sync_engine\.ts"/);
    assert.match(migration, /google_event_id text/);
  });

  it('never creates a Google event per generated slot', () => {
    // One push for the block, one per REAL booked appointment — never per slot.
    const pushes = engine.match(/syncEnginePushCreate\(/g) || [];
    assert.ok(pushes.length <= 4, `unexpected number of Google pushes: ${pushes.length}`);
    assert.doesNotMatch(engine, /slots[\s\S]{0,80}syncEnginePushCreate/);
  });

  it('a missing Google connection never fails the session', () => {
    assert.match(engine, /catch \(_e\) \{ \/\* no-op — see §8: no Google connection means Hubly still works \*\/ \}/);
  });
});

/* ────────────────────────── Stripe ────────────────────────── */

describe('Stripe payments', () => {
  it('reuses create-booking-checkout and Connect, with no second integration', () => {
    assert.match(checkout, /one_off_session_booking_id/);
    assert.match(checkout, /createDestinationCheckout/);
    assert.match(checkout, /hubly_one_off_session_booking_id/);
    assert.doesNotMatch(engine, /api\.stripe\.com/);
    assert.doesNotMatch(api, /api\.stripe\.com/);
  });

  it('derives the amount server-side from the session, never from the request', () => {
    assert.match(checkout, /const sPayment = resolveSessionPayment\(sessionRow\)/);
    assert.match(checkout, /const sAmount = sPayment\.charge_now_cents/);
  });

  it('refuses to charge an already-paid or cancelled booking', () => {
    assert.match(checkout, /already_paid/);
    assert.match(checkout, /This booking was released/);
  });

  it('confirms a booking only from the webhook, never a success screen', () => {
    assert.match(webhook, /hubly_one_off_session_booking_id/);
    assert.match(webhook, /finalizeSessionBookingPayment/);
    assert.match(engine, /export async function finalizeSessionBookingPayment[\s\S]*?status: "confirmed"[\s\S]*?payment_status: "paid"/);
    // The page polls the database; it never sets a confirmed state locally.
    assert.match(sessionPage, /public_booking_status/);
    assert.doesNotMatch(sessionPage, /status\s*=\s*['"]confirmed['"]/);
  });

  it('finalize is idempotent so a replayed webhook cannot duplicate the job', () => {
    assert.match(engine, /if \(booking\.payment_status === "paid" && booking\.job_id\) return \{ ok: true \};/);
    assert.match(engine, /if \(!booking\.job_id\) \{/);
  });

  it('a failed webhook returns 500 so Stripe retries', () => {
    assert.match(webhook, /session booking update failed[\s\S]{0,120}status: 500/);
  });

  it('an abandoned checkout releases the held seat', () => {
    assert.match(webhook, /checkout\.session\.expired/);
    assert.match(webhook, /releaseAbandonedSessionBooking/);
    assert.match(engine, /export async function releaseAbandonedSessionBooking[\s\S]*?if \(booking\.payment_status === "paid" \|\| booking\.status === "confirmed"\) return \{ ok: false \};/);
  });

  it('a business subdomain is a valid Stripe return host', () => {
    const stripe = read('supabase/functions/_shared/stripe.ts');
    assert.match(stripe, /host\.endsWith\("\.myhubly\.app"\) \|\| host\.endsWith\("\.hubly\.app"\)/);
  });
});

/* ────────────────────────── API + privacy ────────────────────────── */

describe('API authorization and privacy', () => {
  it('checks business ownership before every owner action', () => {
    assert.match(api, /const \{ data: userData, error: userErr \} = await userClient\.auth\.getUser\(\)/);
    assert.match(api, /if \(!biz \|\| biz\.owner_id !== userId\) return json\(\{ error: "Forbidden" \}, 403\)/);
  });

  it('exposes a deny-by-default public action list', () => {
    assert.match(api, /const PUBLIC_ACTIONS = new Set\(\[[\s\S]*?\]\)/);
    // Every mutating owner action must be absent from that list.
    const publicList = api.slice(api.indexOf('const PUBLIC_ACTIONS'), api.indexOf('*/', api.indexOf('const PUBLIC_ACTIONS')));
    for (const owner of ['"create"', '"update"', '"publish"', '"close"', '"cancel"', '"bookings"']) {
      assert.ok(!publicList.includes(owner), `${owner} must not be public`);
    }
    assert.match(api, /if \(PUBLIC_ACTIONS\.has\(action\)\) return json\(\{ error: "unknown_action" \}, 400\)/);
  });

  it('the public read is resolved by token only and hides drafts', () => {
    assert.match(api, /getSessionByToken\(admin, String\(body\?\.token \|\| ""\)\)/);
    assert.match(api, /if \(!session \|\| String\(session\.status\) === "draft"\)/);
  });

  it('the public projection never leaks business internals', () => {
    const payload = engine.slice(engine.indexOf('export async function publicSessionPayload'));
    const body = payload.slice(0, payload.indexOf('\n}\n'));
    assert.doesNotMatch(body, /business_id:/);
    assert.doesNotMatch(body, /owner_id/);
    assert.doesNotMatch(body, /booking_token/);
    assert.doesNotMatch(body, /\bid:/);
  });

  it('checkout opens server-side so the page never learns the business id', () => {
    assert.match(api, /async function openSessionCheckout/);
    assert.doesNotMatch(sessionPage, /business_id/);
  });

  it('a booking id from another session cannot be paid through this link', () => {
    assert.match(api, /\.eq\("id", bookingId\)\s*\n\s*\.eq\("session_id", session\.id\)/);
  });

  it('the token is real randomness, not derived from any id', () => {
    assert.match(engine, /crypto\.getRandomValues\(bytes\)/);
    assert.match(migration, /booking_token text not null unique/);
  });

  it('the AI can never write structural columns by naming them', () => {
    const writable = engine.slice(engine.indexOf('const WRITABLE_FIELDS'), engine.indexOf('] as const'));
    for (const field of ['status', 'booking_token', 'business_id', 'calendar_block_job_id', 'google_event_id']) {
      assert.ok(!writable.includes(`"${field}"`), `${field} must not be directly writable`);
    }
  });

  it('is registered with in-function auth', () => {
    assert.match(config, /\[functions\.one-off-sessions\]\s*\nverify_jwt = false/);
  });
});

/* ────────────────────────── does not pollute normal booking ────────────────────────── */

describe('Normal booking is untouched', () => {
  it('a session never becomes a Service Engine service', () => {
    const serviceEngine = read('supabase/functions/_shared/service_engine.ts');
    assert.doesNotMatch(serviceEngine, /one_off_session/);
    // The engine reads the catalog but never writes it.
    assert.match(engine, /import \{ getService \} from "\.\/service_engine\.ts"/);
    assert.doesNotMatch(engine, /buildCatalogWritePayload|service_catalog/);
  });

  it('the booking engine and website booking path were not modified', () => {
    const bookingEngine = read('supabase/functions/_shared/booking_engine.ts');
    const websiteBooking = read('supabase/functions/_shared/hubly_booking_execution.ts');
    assert.doesNotMatch(bookingEngine, /one_off_session/);
    assert.doesNotMatch(websiteBooking, /one_off_session/);
  });

  it('a session booking does not also create a competing booking_requests lead', () => {
    const sessionBranch = checkout.slice(
      checkout.indexOf('if (oneOffSessionBookingId) {'),
      checkout.indexOf('let customerName ='),
    );
    assert.doesNotMatch(sessionBranch, /from\("booking_requests"\)/);
  });
});

/* ────────────────────────── website promotion ────────────────────────── */

describe('Website promotion', () => {
  it('the promo banner gained a closed link-target list on both sides', () => {
    assert.match(storefrontTs, /export const PROMO_LINK_TYPES = \[[\s\S]*?"oneOffSession",[\s\S]*?\] as const/);
    assert.match(storefrontJs, /var PROMO_LINK_TYPES = \['none', 'page', 'booking', 'service', 'oneOffSession', 'url'\]/);
    // Server and client catalogs must agree on the promoBanner config keys.
    for (const key of ['linkType', 'linkTarget']) {
      assert.ok(storefrontTs.includes(key), `server catalog missing ${key}`);
      assert.ok(storefrontJs.includes(key), `client catalog missing ${key}`);
    }
  });

  it('the banner stores a reference, never copied session content', () => {
    assert.match(storefrontTs, /never copy the session's date, price, or URL into the banner text/i);
    // linkTarget is an id; nothing about the session is duplicated into the AST.
    assert.doesNotMatch(storefrontTs, /sessionName|sessionDate|sessionPrice/);
  });

  it('the renderer resolves live session state and drops the CTA when unbookable', () => {
    assert.match(storePage, /function resolvePromoLink/);
    assert.match(storePage, /known\.linkable \? known\.url : null/);
    assert.match(storePage, /action: 'public_promotions'/);
  });

  it('only sessions the owner actually promoted are returned', () => {
    assert.match(api, /return promo\.storefront === true && String\(s\.status\) !== "draft";/);
  });

  it('the editor offers One-Off Session as a link target', () => {
    assert.match(hubly, /oneOffSession:'One-Off Session'/);
    assert.match(hubly, /async function sfLoadSessionsForPicker/);
  });
});

/* ────────────────────────── customer experience ────────────────────────── */

describe('Customer booking page', () => {
  it('is served at /session/<token> and kept out of search', () => {
    assert.ok(existsSync(join(root, 'public/session.html')));
    assert.match(router, /urlPath\.startsWith\('\/session\/'\)/);
    assert.match(router, /X-Robots-Tag', 'noindex, nofollow'/);
    assert.match(sessionPage, /<meta name="robots" content="noindex, nofollow">/);
  });

  it('reads the token from the path, never an internal id', () => {
    assert.match(sessionPage, /location\.pathname\|\|''\)\.match\(\/\\\/session\\\/\(\[\^\/\?#\]\+\)\//);
  });

  it('follows the §22 hierarchy: identity, session, when/where, times, price, details, pay', () => {
    const order = ['bizHtml', 'heroHtml', 'slotsHtml', 'detailsHtml'];
    let cursor = -1;
    for (const fn of order) {
      const at = sessionPage.indexOf('function ' + fn);
      assert.ok(at > cursor, `${fn} out of order`);
      cursor = at;
    }
  });

  it('booked slots are not selectable', () => {
    assert.match(sessionPage, /\(s\.available\?'':' disabled'\)/);
  });

  it('refreshes the grid when a slot is lost to a race', () => {
    assert.match(sessionPage, /res\.code==='slot_taken'\|\|res\.code==='calendar_conflict'\|\|res\.code==='sold_out'/);
  });

  it('offers Add to Calendar from the real confirmed booking', () => {
    assert.match(sessionPage, /Add to Calendar/);
    assert.match(sessionPage, /BEGIN:VCALENDAR/);
  });
});

/* ────────────────────────── provider UI ────────────────────────── */

describe('Provider UI', () => {
  it('ships a Sessions surface wired into Operate', () => {
    assert.ok(existsSync(join(root, 'public/journey-os/one-off-sessions.js')));
    assert.match(hubly, /one-off-sessions\.js\?v=sessions-1/);
    assert.match(hubly, /'reviews','memberships','sessions','store'/);
    assert.match(hubly, /<div id="v-sessions" class="body hidden">/);
    assert.match(hubly, /data-v="sessions"/);
    assert.match(journey, /sessions: function \(\)[\s\S]*?HublyOneOffSessions\?\.render/);
  });

  it('surfaces every §18 section on the detail screen', () => {
    const ui = read('public/journey-os/one-off-sessions.js');
    for (const heading of ['Overview', 'Availability', 'Bookings', 'Sharing', 'Website', 'Calendar']) {
      assert.match(ui, new RegExp(`<h3>${heading}</h3>`), `missing ${heading} section`);
    }
    assert.match(ui, /Copy link|data-oos-act="copy"/);
  });

  it('holds no business logic of its own', () => {
    const ui = read('public/journey-os/one-off-sessions.js');
    // It may format money it was given; it must never derive slots, deposits or
    // availability itself — those come from the API and nowhere else.
    assert.doesNotMatch(ui, /generateSessionSlots|slot_count\s*=|remaining\s*=\s*[^=]/);
    // Clearing a field in an outgoing payload is fine; DOING the deposit math is not.
    assert.doesNotMatch(ui, /deposit_percentage\s*\/\s*100|\*\s*\(.*\/\s*100\)/);
  });
});

/* ────────────────────────── AI ────────────────────────── */

describe('AI actions', () => {
  it('registers a sessions capability with every required action', () => {
    assert.match(registry, /name: "sessions"/);
    for (const action of [
      'create', 'update', 'publish', 'close', 'cancel', 'get', 'list',
      'getBookingLink', 'configurePayment', 'addWebsitePromotion', 'removeWebsitePromotion', 'listBookings',
    ]) {
      assert.match(registry, new RegExp(`name: "${action}"`), `missing action ${action}`);
    }
  });

  it('is reachable from the owner conversation with an injected, verified businessId', () => {
    assert.match(conversation, /operate: \["storefront", "sessions"\]/);
    assert.match(conversation, /if \(capabilityName === "sessions" && businessId\) \{[\s\S]*?dispatchArgs\.businessId = businessId;/);
  });

  it('asks the model for what it can genuinely extract and nothing more', () => {
    const create = registry.slice(registry.indexOf('name: "create",\n      description:\n        "Create a One-Off Session'));
    const required = create.slice(create.indexOf('required: ['), create.indexOf(']', create.indexOf('required: [')) + 1);
    assert.equal(required, 'required: ["name", "date", "startTime", "endTime", "durationMinutes"]');
    // Location and deposit are optional — the AI must not block on them.
    assert.ok(!required.includes('location'));
    assert.ok(!required.includes('depositAmount'));
  });

  it('never publishes in the same breath as creating', () => {
    assert.match(registry, /Create a One-Off Session as a DRAFT[\s\S]*?never publish in the same breath/);
    assert.match(registry, /only call this when the person has explicitly confirmed/);
  });

  it('delegates every rule to the backend rather than enforcing it in the handler', () => {
    const capability = registry.slice(registry.indexOf('name: "sessions"'));
    // No slot/deposit math and no direct table access in the AI layer.
    assert.doesNotMatch(capability, /from\("one_off_session/);
    assert.doesNotMatch(capability, /generateSessionSlots/);
    assert.match(capability, /callSessionsApi/);
  });

  it('is honest about what cancel does not do', () => {
    assert.match(registry, /No refunds were issued — Hubly can't refund automatically/);
  });
});
