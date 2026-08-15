/**
 * A supabase-js-shaped client backed by REAL PostgreSQL.
 *
 * The in-memory FakeDb proves the engine's logic. This proves the engine against
 * an actual database: real CHECK constraints, the real partial unique index
 * (a real 23505), real `date`/`time`/`jsonb`/`numeric` round-tripping, and real
 * NULL semantics. Those are exactly the things a hand-written fake cannot be
 * trusted about, and exactly where a deployment surprise would come from.
 *
 * It implements only the query surface one_off_session_engine.ts actually uses.
 * Anything it does not implement throws loudly rather than silently no-oping.
 */

import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

type Row = Record<string, unknown>;
type Err = { message: string; code?: string } | null;

function isPlainObject(v: unknown): boolean {
  return !!v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v);
}

/** jsonb columns arrive as JS objects/arrays; postgres wants them as JSON text. */
function encode(v: unknown): unknown {
  if (Array.isArray(v) || isPlainObject(v)) return JSON.stringify(v);
  return v;
}

/** Postgres error → the { data, error } shape supabase-js returns. */
// deno-lint-ignore no-explicit-any
function toError(e: any): Err {
  const code = e?.fields?.code || e?.code;
  return { message: String(e?.message || e), code: code ? String(code) : undefined };
}

class PgQuery implements PromiseLike<{ data: unknown; error: Err }> {
  private wheres: string[] = [];
  private params: unknown[] = [];
  private mode: "select" | "insert" | "update" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private patch: Row | null = null;
  private orderBy: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;

  constructor(private client: Client, private table: string) {}

  private p(v: unknown): string {
    this.params.push(encode(v));
    return `$${this.params.length}`;
  }

  select(_cols?: string) { return this; }
  insert(payload: Row | Row[]) { this.mode = "insert"; this.payload = payload; return this; }
  update(patch: Row) { this.mode = "update"; this.patch = patch; return this; }
  delete() { this.mode = "delete"; return this; }

  eq(col: string, val: unknown) { this.wheres.push(`"${col}" = ${this.p(val)}`); return this; }
  neq(col: string, val: unknown) { this.wheres.push(`("${col}" is distinct from ${this.p(val)})`); return this; }
  in(col: string, vals: unknown[]) {
    if (!vals?.length) { this.wheres.push("false"); return this; }
    this.wheres.push(`"${col}" = any(${this.p(vals)})`);
    return this;
  }
  ilike(col: string, val: string) { this.wheres.push(`"${col}" ilike ${this.p(val)}`); return this; }
  gte(col: string, val: unknown) { this.wheres.push(`"${col}" >= ${this.p(val)}`); return this; }
  lte(col: string, val: unknown) { this.wheres.push(`"${col}" <= ${this.p(val)}`); return this; }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = col; this.orderAsc = opts?.ascending !== false; return this;
  }
  limit(n: number) { this.limitN = n; return this; }

  private sql(): string {
    const where = this.wheres.length ? ` where ${this.wheres.join(" and ")}` : "";
    if (this.mode === "insert") {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload!];
      const cols = Object.keys(rows[0]);
      const values = rows.map((r) =>
        `(${cols.map((c) => this.p(r[c])).join(", ")})`
      ).join(", ");
      return `insert into public."${this.table}" (${cols.map((c) => `"${c}"`).join(", ")}) values ${values} returning *`;
    }
    if (this.mode === "update") {
      const sets = Object.keys(this.patch!).map((c) => `"${c}" = ${this.p(this.patch![c])}`).join(", ");
      return `update public."${this.table}" set ${sets}${where} returning *`;
    }
    if (this.mode === "delete") {
      return `delete from public."${this.table}"${where} returning *`;
    }
    const order = this.orderBy ? ` order by "${this.orderBy}" ${this.orderAsc ? "asc" : "desc"}` : "";
    const lim = this.limitN != null ? ` limit ${Number(this.limitN)}` : "";
    return `select * from public."${this.table}"${where}${order}${lim}`;
  }

  private async run(): Promise<{ data: Row[] | null; error: Err }> {
    // Params are collected while the SQL string is built, so build first.
    let text: string;
    try { text = this.sql(); } catch (e) { return { data: null, error: toError(e) }; }
    try {
      const res = await this.client.queryObject<Row>({ text, args: this.params });
      return { data: res.rows, error: null };
    } catch (e) {
      return { data: null, error: toError(e) };
    }
  }

  async maybeSingle() {
    const { data, error } = await this.run();
    if (error) return { data: null, error };
    return { data: data && data.length ? data[0] : null, error: null };
  }

  async single() {
    const { data, error } = await this.run();
    if (error) return { data: null, error };
    if (!data || !data.length) return { data: null, error: { message: "no rows", code: "PGRST116" } };
    return { data: data[0], error: null };
  }

  then<R1 = { data: unknown; error: Err }, R2 = never>(
    onfulfilled?: ((v: { data: unknown; error: Err }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled as never, onrejected);
  }
}

export function pgSupabaseClient(client: Client) {
  return {
    from(table: string) { return new PgQuery(client, table); },
    rpc() { throw new Error("pg adapter: rpc() is not implemented — the engine must not need it"); },
    // deno-lint-ignore no-explicit-any
  } as any;
}

export async function connect(url: string): Promise<Client> {
  const client = new Client(url);
  await client.connect();
  return client;
}
