/**
 * WHAT THE BUSINESS IS ACTUALLY DOING — the operational read path.
 *
 * WHY THIS EXISTS
 *
 * Until 2026-09-05 the assistant could not see a single booking. Measured
 * (OPEN_FINDINGS #27): 22 of its 23 capability actions BUILD the presentation, one
 * reads free slots, and the only record it was ever handed — `BusinessRecord` — is
 * 18 fields of services, photos, hours and contact details. Every one is a
 * presentation fact. Austin Graef reported the consequence himself: a booking
 * arrives, he gets an email, and Hubly's assistant says nothing.
 *
 * That is the difference between "runs the business" and "a chat box beside a
 * website editor", which is a thing our competitors also have.
 *
 * DELIBERATELY GENERAL, NOT A BOOKING SPECIAL CASE
 *
 * This is step one of a larger direction: the owner's home becomes chat plus
 * generated views ("show me my schedule this week", "what jobs do I have"). So the
 * shape here is a REGISTRY OF SLICES — each slice is a named reader returning rows
 * plus an honest empty reason. Adding invoices, or memberships, or revenue is one
 * reader and one line in SLICES, not a rewrite of the caller. The tab machinery and
 * the view system are deliberately NOT here; this only has to not make them a
 * rewrite.
 *
 * READ ONLY, ON PURPOSE
 *
 * Nothing here accepts, declines, reschedules or messages. Operational awareness
 * first; operational action is a separate, deliberate decision.
 *
 * SECURITY — the settled rule, and nothing else
 *
 * Every entry point takes a `ownerUid` that the CALLER has already verified against
 * a real user JWT (`resolveOwnerUid()` → /auth/v1/user), and this module re-checks
 * that the uid owns THIS business before reading a row. It never consults
 * `context`: that is a caller-declared string off the request body — a public chat
 * widget can send "dashboard" — and `scripts/check-owner-id-invariant.mjs` check 3
 * fails the build if anyone reaches for it. See STATE.md.
 *
 * NEVER INVENT — the same discipline as buildBusinessRecordBlock
 *
 * A slice with no rows prints an explicit "none on record". It never prints a
 * plausible-sounding summary, never estimates, never rounds a count. Everything in
 * a sentence the assistant says — a name, a date, a service, a price — comes from a
 * column or it is not said.
 */

// deno-lint-ignore no-explicit-any
type Admin = any;

export type OperationalRow = Record<string, unknown>;

export type OperationalSlice = {
  /** Stable key. Also the capability action name — one word, one concept. */
  key: string;
  /** How this reads in the block heading, to the model. */
  title: string;
  /** Printed verbatim when there are no rows. Must be honest and calm. */
  emptyLine: string;
  rows: OperationalRow[];
  /** Set when the read itself failed — distinct from "there are none". */
  error?: string;
};

export type OperationalState = {
  businessId: string;
  businessName: string | null;
  asOf: string;
  slices: OperationalSlice[];
  /** True only when ownership was proven. Nothing is read otherwise. */
  authorised: boolean;
  reason?: "not_owner" | "no_business" | "no_owner";
};

const MAX_ROWS = 8;

/** Today in the business's own terms. Dates are stored as plain YYYY-MM-DD. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A row written by our own verification harness, not by a person.
 *  #29: `notes` carries structured machine tags ([SMS_CONSENT:yes], [RETURNING:yes]),
 *  and the harness stamps [TEST]. Marked rather than hidden — hiding an owner's own
 *  data from them is its own kind of lie — so the assistant can say which is which
 *  instead of announcing a test booking as a real one. */
function isTestRow(r: OperationalRow): boolean {
  if (/\[TEST\]/i.test(String(r?.notes ?? ""))) return true;
  // NANP RESERVED-FOR-FICTION RANGE. 555-0100 through 555-0199 are set aside by the
  // North American Numbering Plan for fictional use and can never belong to a real
  // person. Recognising them is a general rule, not a hack about one harness — and
  // it is load-bearing here: the [TEST] note tag was only added on 2026-09-05, so
  // rows written before it carry no tag. Without this, the first thing this feature
  // would have told Austin Graef is that he has five leads from "Test Customer".
  // (#29 — this is the cheapest form of the test_actors idea; the durable answer is
  // still a derived view.)
  const phone = String(r?.customer_phone ?? r?.phone ?? "").replace(/\D/g, "");
  if (/^1?\d{3}555010\d$/.test(phone) || /^1?\d{3}55501\d\d$/.test(phone)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// THE SLICES. Add one reader here and it appears in the block and the capability.
// ---------------------------------------------------------------------------

type SliceDef = {
  key: string;
  title: string;
  emptyLine: string;
  read: (admin: Admin, businessId: string) => Promise<OperationalRow[]>;
  /** One row, rendered for the model as DATA. Never prose, never a guess. */
  line: (r: OperationalRow) => string;
};

const money = (cents: unknown): string | null => {
  const n = Number(cents);
  return Number.isFinite(n) && n > 0 ? `$${(n / 100).toFixed(2).replace(/\.00$/, "")}` : null;
};

const when = (d: unknown, t: unknown): string => {
  const date = String(d ?? "").trim();
  const time = String(t ?? "").trim();
  if (!date) return "no date on record";
  return time ? `${date} ${time}` : date;
};

const contact = (r: OperationalRow): string => {
  const bits = [r.customer_phone, r.customer_email, r.phone, r.email]
    .map((x) => String(x ?? "").trim()).filter(Boolean);
  return bits.length ? bits.join(" · ") : "no contact on record";
};

export const SLICES: SliceDef[] = [
  {
    key: "bookings",
    title: "BOOKINGS",
    emptyLine: "BOOKINGS: none on record. Do not say they have bookings, and do not estimate a number.",
    read: async (admin, businessId) => {
      const { data } = await admin
        .from("booking_requests")
        .select("id,customer_name,customer_phone,customer_email,service_name,requested_date,requested_time,address,status,amount_due_cents,amount_required_cents,notes,created_at")
        .eq("business_id", businessId)
        .neq("status", "abandoned")
        .order("created_at", { ascending: false })
        .limit(MAX_ROWS);
      return Array.isArray(data) ? data : [];
    },
    line: (r) => {
      const price = money(r.amount_due_cents) ?? money(r.amount_required_cents);
      return [
        `${String(r.customer_name || "someone").trim()} — ${String(r.service_name || "a service").trim()}`,
        `for ${when(r.requested_date, r.requested_time)}`,
        price ? `· ${price}` : null,
        `· status ${String(r.status || "unknown")}`,
        `· ${contact(r)}`,
        r.address ? `· ${String(r.address).trim()}` : null,
        isTestRow(r) ? "· [TEST ROW — written by our own harness, not a real customer]" : null,
      ].filter(Boolean).join(" ");
    },
  },
  {
    key: "jobs",
    title: "UPCOMING JOBS",
    emptyLine: "UPCOMING JOBS: none on record. Do not describe a schedule they do not have.",
    read: async (admin, businessId) => {
      const { data } = await admin
        .from("jobs")
        .select("id,customer_name,service_name,scheduled_date,scheduled_time,address,status,amount,phone,email,notes,duration_hours")
        .eq("business_id", businessId)
        .gte("scheduled_date", todayISO())
        .order("scheduled_date", { ascending: true })
        .limit(MAX_ROWS);
      return Array.isArray(data) ? data : [];
    },
    line: (r) => {
      const amt = Number(r.amount);
      return [
        `${String(r.customer_name || "someone").trim()} — ${String(r.service_name || "a job").trim()}`,
        `on ${when(r.scheduled_date, r.scheduled_time)}`,
        Number.isFinite(amt) && amt > 0 ? `· $${amt}` : null,
        `· status ${String(r.status || "unknown")}`,
        `· ${contact(r)}`,
        isTestRow(r) ? "· [TEST ROW — written by our own harness, not a real customer]" : null,
      ].filter(Boolean).join(" ");
    },
  },
  {
    key: "leads",
    title: "RECENT LEADS (started a booking and did not finish)",
    emptyLine: "RECENT LEADS: none on record.",
    read: async (admin, businessId) => {
      const { data } = await admin
        .from("booking_requests")
        .select("id,customer_name,customer_phone,customer_email,service_name,requested_date,requested_time,notes,created_at")
        .eq("business_id", businessId)
        .eq("status", "abandoned")
        .order("created_at", { ascending: false })
        .limit(MAX_ROWS);
      return Array.isArray(data) ? data : [];
    },
    line: (r) => [
      `${String(r.customer_name || "someone").trim()} — ${String(r.service_name || "a service").trim()}`,
      `· started ${String(r.created_at ?? "").slice(0, 10) || "unknown"}`,
      `· ${contact(r)}`,
      isTestRow(r) ? "· [TEST ROW — written by our own harness, not a real customer]" : null,
    ].filter(Boolean).join(" "),
  },
];

// ---------------------------------------------------------------------------
// LOAD
// ---------------------------------------------------------------------------

/**
 * Read the operational state of ONE business for a VERIFIED owner.
 *
 * `ownerUid` must already have been resolved from a real user JWT by the caller.
 * Ownership of this specific business is re-checked here, so a verified owner of
 * business A cannot read business B.
 */
export async function loadOperationalState(
  admin: Admin,
  businessId: string,
  ownerUid: string | null,
  only?: string[],
): Promise<OperationalState> {
  const asOf = new Date().toISOString();
  const base: OperationalState = { businessId, businessName: null, asOf, slices: [], authorised: false };

  if (!ownerUid) return { ...base, reason: "no_owner" };
  if (!businessId) return { ...base, reason: "no_business" };

  const { data: biz } = await admin
    .from("businesses")
    .select("id,name,owner_id")
    .eq("id", businessId)
    .maybeSingle();

  if (!biz) return { ...base, reason: "no_business" };
  // THE GATE. Verified identity is not enough — it must own THIS business.
  if (String(biz.owner_id || "") !== String(ownerUid)) return { ...base, reason: "not_owner" };

  const wanted = only && only.length ? SLICES.filter((s) => only.includes(s.key)) : SLICES;
  // IN PARALLEL. The slices do not depend on each other, and this sits in front of
  // every owner turn — sequential reads made the added latency the sum of all of
  // them instead of the slowest one. Measured from outside the datacenter before
  // this change: ~790ms for four sequential round trips.
  const slices: OperationalSlice[] = await Promise.all(
    wanted.map(async (def) => {
      try {
        const rows = await def.read(admin, businessId);
        return { key: def.key, title: def.title, emptyLine: def.emptyLine, rows };
      } catch (e) {
        // A failed read is NOT "none". Saying "no bookings" when the query broke is
        // the same defect as a green checkmark nobody earned.
        return {
          key: def.key, title: def.title, emptyLine: def.emptyLine, rows: [] as OperationalRow[],
          error: String((e as Error)?.message || e).slice(0, 200),
        };
      }
    }),
  );
  return { businessId, businessName: biz.name ? String(biz.name) : null, asOf, slices, authorised: true };
}

// ---------------------------------------------------------------------------
// RENDER FOR THE MODEL
// ---------------------------------------------------------------------------

/** One row, by slice key — so a capability result and the context block can never
 *  describe the same row two different ways. */
export function renderRow(key: string, r: OperationalRow): string {
  const def = SLICES.find((s) => s.key === key);
  return def ? def.line(r) : JSON.stringify(r);
}

/**
 * The block, in the same register as buildBusinessRecordBlock: DATA, not prose,
 * with empty sections printed explicitly rather than omitted — a missing heading is
 * ambiguous and "none on record" is not.
 *
 * A BLOCK, NOT A TOOL CALL, on purpose. A capability round costs a model round out
 * of MAX_CAPABILITY_ROUNDS and several seconds of silence; a block is simply
 * present. The owner should not have to ask whether he has bookings.
 */
export function buildOperationalStateBlock(state: OperationalState): string {
  if (!state.authorised) return "";
  const L: string[] = [];
  L.push("WHAT THIS BUSINESS IS ACTUALLY DOING RIGHT NOW — live operational state.");
  L.push("");
  L.push("This is DATA read from the business's own records this turn, not a paraphrase and not");
  L.push("a memory. It is the ONLY source you may use to state anything about bookings, jobs or");
  L.push("leads. Anything marked \"none on record\" is genuinely none: do not soften it, do not");
  L.push("estimate, do not say \"a few\" or \"several\", and never invent a customer, a date or an");
  L.push("amount. A row marked [TEST ROW] was written by our own verification harness — if you");
  L.push("mention it at all, say so; never present it as a real customer.");
  L.push("");
  L.push("WHEN TO USE IT. If there is anything here the owner has not already been told about in");
  L.push("this conversation, LEAD WITH IT in plain words — who, what, when, how much, and how to");
  L.push("reach them. Name real names and real dates. They should not have to ask whether they");
  L.push("have bookings. If every section is empty, do NOT announce that unprompted; just answer");
  L.push("what they actually asked.");
  L.push("");
  L.push("You can READ this. You cannot yet accept, decline, reschedule or message anyone — if");
  L.push("they ask for that, say plainly that you can't do it yet rather than implying you did.");
  L.push("");

  for (const s of state.slices) {
    if (s.error) {
      L.push(`${s.title}: could not be read this turn (${s.error}). Say you could not check rather than saying there are none.`);
      L.push("");
      continue;
    }
    if (!s.rows.length) {
      L.push(s.emptyLine);
      L.push("");
      continue;
    }
    L.push(`${s.title} (${s.rows.length}${s.rows.length === MAX_ROWS ? ", most recent" : ""}):`);
    for (const r of s.rows) L.push(`- ${renderRow(s.key, r)}`);
    L.push("");
  }
  return L.join("\n").trimEnd();
}

/** A one-line version for turns where the full block is not worth its tokens.
 *  Counts only — never a name, never an amount, so it cannot leak or mislead. */
export function buildOperationalSummaryLine(state: OperationalState): string {
  if (!state.authorised) return "";
  const bits = state.slices.map((s) => `${s.rows.length} ${s.key}`);
  return `OPERATIONAL STATE (counts only, ask for detail): ${bits.join(", ")}.`;
}
