/**
 * A small in-memory stand-in for a Supabase/PostgREST client, built to run the
 * REAL One-Off Session engine (and everything it imports — the Google Calendar
 * sync engine, the CRM customer resolver, portal tokens, booking notifications)
 * without a database.
 *
 * It is deliberately NOT a generic mock. It enforces the parts of
 * 20260815120000_one_off_sessions.sql that the engine's correctness actually
 * depends on:
 *
 *   * the partial unique index on (session_id, slot_time, seat_no)
 *     WHERE status <> 'cancelled'  — the double-booking guarantee, reported
 *     with Postgres error code 23505 exactly as PostgREST would,
 *   * NOT NULL / CHECK constraints on the session columns,
 *   * defaults (id, timestamps, status, currency, jsonb defaults).
 *
 * If the engine ever stops relying on the index and starts hand-rolling its own
 * "is this seat free" logic, these tests fail — which is the point.
 */

type Row = Record<string, unknown>;

export type DbError = { message: string; code?: string } | null;

let counter = 0;
function uuid(prefix = "id"): string {
  counter += 1;
  return `${prefix}-${String(counter).padStart(6, "0")}`;
}

/** Column defaults that the migration declares, applied on insert. */
const DEFAULTS: Record<string, () => Row> = {
  one_off_sessions: () => ({
    id: uuid("sess"),
    status: "draft",
    visibility: "link_only",
    appointment_duration_minutes: 30,
    buffer_minutes: 0,
    location_type: "in_person",
    capacity_per_slot: 1,
    total_capacity: null,
    currency: "usd",
    payment_mode: "none",
    booking_questions: [],
    website_promotion: {},
    meta: {},
    calendar_block_job_id: null,
    google_event_id: null,
    published_at: null,
    closed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  one_off_session_bookings: () => ({
    id: uuid("bk"),
    seat_no: 0,
    answers: {},
    status: "pending_payment",
    payment_status: "none",
    amount_paid_cents: 0,
    currency: "usd",
    job_id: null,
    customer_id: null,
    paid_at: null,
    confirmed_at: null,
    cancelled_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  jobs: () => ({ id: uuid("job"), status: "scheduled", google_event_id: null, one_off_session_id: null }),
  customers: () => ({ id: uuid("cust"), created_at: new Date().toISOString() }),
  businesses: () => ({ id: uuid("biz") }),
  portal_access_tokens: () => ({ id: uuid("tok") }),
  recurring_schedules: () => ({ id: uuid("rec") }),
  marketplace_customers: () => ({ id: uuid("mcust") }),
};

/** The CHECK constraints the migration declares, in the same order. */
function checkSessionConstraints(row: Row): string | null {
  const num = (v: unknown) => (v == null ? null : Number(v));
  if (!row.business_id) return "null value in column business_id violates not-null constraint";
  if (!row.name) return "null value in column name violates not-null constraint";
  if (!row.session_date) return "null value in column session_date violates not-null constraint";
  if (!row.start_time || !row.end_time) return "null value in column start_time/end_time violates not-null constraint";
  if (!row.booking_token) return "null value in column booking_token violates not-null constraint";

  const toMin = (t: unknown) => {
    const m = String(t || "").match(/^(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const s = toMin(row.start_time);
  const e = toMin(row.end_time);
  if (s == null || e == null || e <= s) return 'new row violates check constraint "one_off_sessions_window_ordered"';
  const dur = num(row.appointment_duration_minutes) ?? 30;
  if (e - s < dur) return 'new row violates check constraint "one_off_sessions_appointment_fits"';
  if (dur <= 0 || dur > 720) return "violates check constraint on appointment_duration_minutes";
  const buffer = num(row.buffer_minutes) ?? 0;
  if (buffer < 0) return "violates check constraint on buffer_minutes";
  const cap = num(row.capacity_per_slot) ?? 1;
  if (cap < 1 || cap > 100) return "violates check constraint on capacity_per_slot";
  const price = num(row.price_cents);
  if (price != null && price < 0) return "violates check constraint on price_cents";
  const dep = num(row.deposit_cents);
  if (dep != null && price != null && dep > price) {
    return 'new row violates check constraint "one_off_sessions_deposit_not_over_price"';
  }
  const pct = num(row.deposit_percentage);
  if (pct != null && (pct <= 0 || pct > 100)) return "violates check constraint on deposit_percentage";
  if (String(row.payment_mode || "none") !== "none" && !(Number(price) > 0)) {
    return 'new row violates check constraint "one_off_sessions_paid_needs_price"';
  }
  const statuses = ["draft", "published", "sold_out", "closed", "cancelled", "completed"];
  if (!statuses.includes(String(row.status))) return "violates check constraint on status";
  return null;
}

function checkBookingConstraints(row: Row): string | null {
  if (!row.session_id) return "null value in column session_id violates not-null constraint";
  if (!row.business_id) return "null value in column business_id violates not-null constraint";
  if (!row.slot_date || !row.slot_time) return "null value in slot_date/slot_time violates not-null constraint";
  if (!row.customer_name) return "null value in column customer_name violates not-null constraint";
  if (!(Number(row.duration_minutes) > 0)) return "violates check constraint on duration_minutes";
  if (Number(row.seat_no) < 0) return "violates check constraint on seat_no";
  if (!["pending_payment", "confirmed", "cancelled"].includes(String(row.status))) {
    return "violates check constraint on status";
  }
  if (!["none", "pending", "paid", "failed", "refunded"].includes(String(row.payment_status))) {
    return "violates check constraint on payment_status";
  }
  return null;
}

export class FakeDb {
  tables: Record<string, Row[]> = {};
  /** Every write, in order — lets a test assert what the engine actually did. */
  writes: Array<{ table: string; op: string; row?: Row; patch?: Row }> = [];

  seed(table: string, rows: Row[]) {
    this.tables[table] = (this.tables[table] || []).concat(rows.map((r) => ({ ...r })));
  }
  rows(table: string): Row[] {
    return this.tables[table] || (this.tables[table] = []);
  }

  /** The migration's partial unique index, enforced for real. */
  private seatIndexViolation(row: Row): boolean {
    if (String(row.status) === "cancelled") return false;
    return this.rows("one_off_session_bookings").some((r) =>
      String(r.status) !== "cancelled" &&
      String(r.session_id) === String(row.session_id) &&
      String(r.slot_time) === String(row.slot_time) &&
      Number(r.seat_no) === Number(row.seat_no) &&
      String(r.id) !== String(row.id)
    );
  }

  insert(table: string, payload: Row | Row[]): { data: Row[] | null; error: DbError } {
    const list = Array.isArray(payload) ? payload : [payload];
    const inserted: Row[] = [];
    for (const p of list) {
      const row: Row = { ...(DEFAULTS[table]?.() || { id: uuid(table) }), ...p };
      const violation = table === "one_off_sessions"
        ? checkSessionConstraints(row)
        : table === "one_off_session_bookings"
        ? checkBookingConstraints(row)
        : null;
      if (violation) return { data: null, error: { message: violation, code: "23514" } };
      if (table === "one_off_session_bookings" && this.seatIndexViolation(row)) {
        return {
          data: null,
          error: {
            message:
              'duplicate key value violates unique constraint "one_off_session_bookings_seat_uniq"',
            code: "23505",
          },
        };
      }
      this.rows(table).push(row);
      this.writes.push({ table, op: "insert", row });
      inserted.push(row);
    }
    return { data: inserted, error: null };
  }

  update(table: string, patch: Row, matches: Row[]): { data: Row[] | null; error: DbError } {
    const out: Row[] = [];
    for (const row of matches) {
      const next = { ...row, ...patch, updated_at: new Date().toISOString() };
      const violation = table === "one_off_sessions"
        ? checkSessionConstraints(next)
        : table === "one_off_session_bookings"
        ? checkBookingConstraints(next)
        : null;
      if (violation) return { data: null, error: { message: violation, code: "23514" } };
      if (table === "one_off_session_bookings" && this.seatIndexViolation(next)) {
        return {
          data: null,
          error: { message: "duplicate key value violates unique constraint", code: "23505" },
        };
      }
      Object.assign(row, next);
      this.writes.push({ table, op: "update", patch, row });
      out.push(row);
    }
    return { data: out, error: null };
  }

  delete(table: string, matches: Row[]): { data: Row[]; error: DbError } {
    const list = this.rows(table);
    for (const row of matches) {
      const i = list.indexOf(row);
      if (i >= 0) list.splice(i, 1);
      this.writes.push({ table, op: "delete", row });
    }
    return { data: matches, error: null };
  }
}

type Filter = (row: Row) => boolean;

class Query implements PromiseLike<{ data: unknown; error: DbError }> {
  private filters: Filter[] = [];
  private orderKey: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private pendingPatch: Row | null = null;
  private mode: "select" | "insert" | "update" | "delete" = "select";
  private insertPayload: Row | Row[] | null = null;
  private wantRows = false;

  constructor(private db: FakeDb, private table: string) {}

  private matches(): Row[] {
    let rows = this.db.rows(this.table).filter((r) => this.filters.every((f) => f(r)));
    if (this.orderKey) {
      const k = this.orderKey;
      rows = [...rows].sort((a, b) =>
        String(a[k] ?? "").localeCompare(String(b[k] ?? "")) * (this.orderAsc ? 1 : -1)
      );
    }
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    return rows;
  }

  select(_cols?: string) {
    this.wantRows = true;
    if (this.mode === "select") this.mode = "select";
    return this;
  }
  insert(payload: Row | Row[]) {
    this.mode = "insert";
    this.insertPayload = payload;
    return this;
  }
  update(patch: Row) {
    this.mode = "update";
    this.pendingPatch = patch;
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push((r) => String(r[col] ?? "") === String(val ?? ""));
    return this;
  }
  neq(col: string, val: unknown) {
    this.filters.push((r) => String(r[col] ?? "") !== String(val ?? ""));
    return this;
  }
  in(col: string, vals: unknown[]) {
    const set = new Set((vals || []).map((v) => String(v)));
    this.filters.push((r) => set.has(String(r[col] ?? "")));
    return this;
  }
  ilike(col: string, val: string) {
    const needle = String(val || "").replace(/%/g, "").toLowerCase();
    this.filters.push((r) => String(r[col] ?? "").toLowerCase() === needle);
    return this;
  }
  gte(col: string, val: unknown) {
    this.filters.push((r) => String(r[col] ?? "") >= String(val ?? ""));
    return this;
  }
  lte(col: string, val: unknown) {
    this.filters.push((r) => String(r[col] ?? "") <= String(val ?? ""));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderKey = col;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }

  private run(): { data: Row[] | null; error: DbError } {
    if (this.mode === "insert") return this.db.insert(this.table, this.insertPayload!);
    if (this.mode === "update") return this.db.update(this.table, this.pendingPatch!, this.matches());
    if (this.mode === "delete") return this.db.delete(this.table, this.matches());
    return { data: this.matches(), error: null };
  }

  async maybeSingle() {
    const { data, error } = this.run();
    if (error) return { data: null, error };
    return { data: data && data.length ? data[0] : null, error: null };
  }
  async single() {
    const { data, error } = this.run();
    if (error) return { data: null, error };
    if (!data || !data.length) {
      return { data: null, error: { message: "no rows returned", code: "PGRST116" } };
    }
    return { data: data[0], error: null };
  }
  then<R1 = { data: unknown; error: DbError }, R2 = never>(
    onfulfilled?: ((v: { data: unknown; error: DbError }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    const { data, error } = this.run();
    return Promise.resolve({ data, error }).then(onfulfilled, onrejected);
  }
}

/** A client shaped like the parts of supabase-js the engine actually uses. */
export function fakeClient(db: FakeDb) {
  return {
    from(table: string) {
      return new Query(db, table);
    },
    // The engine never calls rpc(); present so an accidental future call is loud.
    rpc() {
      throw new Error("fake client: rpc() is not implemented — the engine must not need it");
    },
    // deno-lint-ignore no-explicit-any
  } as any;
}
