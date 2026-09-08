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
    key: "orders",
    title: "STORE ORDERS",
    emptyLine: "STORE ORDERS: none on record. Nobody has bought anything through the store yet — say that plainly if asked, and never imply a sale.",
    read: async (admin, businessId) => {
      const { data } = await admin
        .from("commerce_orders")
        .select("id,order_number,status,fulfillment,total_cents,currency,customer_name,customer_email,customer_phone,paid_at,created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(MAX_ROWS);
      return Array.isArray(data) ? data : [];
    },
    line: (r) => [
      `${String(r.customer_name || "someone").trim()} — ${money(r.total_cents) ?? "no total on record"}`,
      `· ${String(r.status || "unknown")}`,
      r.paid_at ? `· paid ${String(r.paid_at).slice(0, 10)}` : "· not paid",
      r.fulfillment ? `· fulfilment ${String(r.fulfillment)}` : null,
      `· ${contact(r)}`,
      r.order_number ? `· order ${String(r.order_number)}` : null,
      isTestRow(r) ? "· [TEST ROW — written by our own harness, not a real customer]" : null,
    ].filter(Boolean).join(" "),
  },
  {
    // CHAT LEADS — DELIBERATELY SEPARATE FROM "leads" BELOW, NOT MERGED INTO IT.
    //
    // "Filled in half a booking form" and "asked a question and left" are different
    // signals with different confidence. A single count that means both means neither —
    // the same defect class as a number whose denominator is unstated. So they stay
    // distinct here AND in the words the assistant uses: "two people started booking and
    // stopped" is a different sentence from "one person asked about Saturday".
    //
    // A conversation that never became a booking surfaces REGARDLESS of age, timestamped,
    // for the owner to judge. The 30-minute idle threshold below decides only whether it
    // is flagged as NEEDING ACTION — it is not a hiding mechanism. In home services
    // response speed is most of conversion: someone who asked an hour ago has already
    // called the next detailer.
    key: "chat_leads",
    title: "PEOPLE WHO ASKED ON YOUR SITE AND DID NOT BOOK",
    emptyLine: "PEOPLE WHO ASKED AND DID NOT BOOK: none on record.",
    read: async (admin, businessId) => {
      const { data: convs } = await admin
        .from("chatbot_conversations")
        .select("id,started_at,customer_name,customer_phone,customer_email,resulted_in_booking")
        .eq("business_id", businessId)
        .eq("resulted_in_booking", false)
        .order("started_at", { ascending: false })
        .limit(MAX_ROWS);
      const rows = Array.isArray(convs) ? convs : [];
      if (!rows.length) return [];
      const out: Record<string, unknown>[] = [];
      for (const c of rows) {
        // What they ASKED is the first thing they said — the most useful single line
        // for deciding whether to call back. Bodies older than 90 days are gone by
        // retention, so an old conversation legitimately has no question text; say
        // that rather than implying they asked nothing.
        const { data: msgs } = await admin
          .from("chatbot_messages")
          .select("role,content,created_at")
          .eq("conversation_id", c.id)
          .order("created_at", { ascending: true });
        const list = Array.isArray(msgs) ? msgs : [];
        const firstAsk = list.find((m: any) => m.role === "customer");
        const last = list.length ? list[list.length - 1] : null;
        const lastAt = last?.created_at ? new Date(String(last.created_at)).getTime() : null;
        const idleMin = lastAt ? Math.floor((Date.now() - lastAt) / 60000) : null;
        out.push({
          asked: firstAsk?.content ? String(firstAsk.content) : null,
          transcript_aged_out: list.length === 0,
          started_at: c.started_at,
          last_activity: last?.created_at ?? null,
          idle_minutes: idleMin,
          needs_action: idleMin !== null && idleMin >= 30,
          customer_name: c.customer_name,
          customer_phone: c.customer_phone,
          customer_email: c.customer_email,
        });
      }
      return out;
    },
    line: (r) => [
      `${String(r.customer_name || "someone").trim()} asked: ` +
        (r.asked ? `"${String(r.asked).slice(0, 140)}"` : (r.transcript_aged_out ? "(what they asked is past our 90-day retention)" : "(no question recorded)")),
      `· ${String(r.started_at ?? "").slice(0, 10) || "unknown"}`,
      r.idle_minutes === null ? null : (r.needs_action ? "· NEEDS A REPLY (quiet 30+ min)" : `· still live (quiet ${r.idle_minutes} min)`),
      `· ${contact(r)}`,
      isTestRow(r) ? "· [TEST ROW — written by our own harness, not a real customer]" : null,
    ].filter(Boolean).join(" "),
  },
  {
    // PAGE TRAFFIC. The rows already existed (page_loads); nothing read them, so a quiet
    // day could only ever report the one thing that did not happen. Owner previews are
    // excluded — the owner looking at his own site is not a visitor.
    key: "traffic",
    title: "PEOPLE WHO LOOKED AT YOUR PAGE",
    emptyLine: "PEOPLE WHO LOOKED AT YOUR PAGE: none on record.",
    read: async (admin, businessId) => {
      const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
      const { data } = await admin
        .from("page_loads")
        .select("loaded_day,visitor_hash,referrer,is_owner_preview")
        .eq("business_id", businessId)
        .eq("is_owner_preview", false)
        // EXCLUDE BOTS. Measured 2026-09-08 across the whole corpus: of 135 page_loads
        // rows, 54 were device_class='bot' and 49 were owner previews — only 32 were real
        // visits. Filtering owner previews alone would have reported 86 "people", of which
        // 63% were crawlers, link unfurlers and uptime pingers.
        //
        // That is a subtler fabrication than a sparkline: a REAL number describing
        // something other than what it says. "Four people looked at your page" is a claim
        // about humans, and it has to be one.
        //
        // Honest limit: device_class is classified from the user-agent at write time
        // (PREVIEW_BOT / GENERIC_BOT in page-view/index.ts), so a crawler presenting a
        // browser UA is still counted. It catches the named ones — googlebot, bingbot,
        // slackbot, facebookexternalhit, curl, headless, puppeteer and the rest — which is
        // the bulk of it, not all of it.
        .neq("device_class", "bot")
        .gte("loaded_day", since);
      const rows = Array.isArray(data) ? data : [];
      if (!rows.length) return [];
      const byDay = new Map<string, Set<string>>();
      for (const r of rows) {
        const d = String(r.loaded_day || "").slice(0, 10);
        if (!d) continue;
        if (!byDay.has(d)) byDay.set(d, new Set());
        // No visitor_hash means we cannot tell two loads apart; count the row rather
        // than collapsing distinct people into one. Stated, not silently deduped.
        byDay.get(d)!.add(String(r.visitor_hash || `row:${r.loaded_day}:${Math.random()}`));
      }
      return [...byDay.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .slice(0, MAX_ROWS)
        .map(([day, set]) => ({ day, people: set.size }));
    },
    line: (r) => `${String(r.day)} — ${Number(r.people)} ${Number(r.people) === 1 ? "person" : "people"}`,
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
  L.push("TWO DIFFERENT KINDS OF LEAD, AND THEY MUST NOT BE ADDED TOGETHER. \"Started a booking");
  L.push("and stopped\" (RECENT LEADS) is a person who filled in part of the form. \"Asked on your");
  L.push("site and did not book\" (PEOPLE WHO ASKED) is a person who typed a question in the chat.");
  L.push("Different signals, different confidence. Say them as separate sentences — \"two people");
  L.push("started booking and stopped\" is not the same news as \"one person asked about Saturday\"");
  L.push("— and never report a single combined count, which would mean neither one.");
  L.push("");
  L.push("A CHAT LEAD MARKED \"NEEDS A REPLY\" has been quiet 30+ minutes. That flag is about");
  L.push("urgency ONLY. One that is still live is not less real and must not be omitted; one whose");
  L.push("question is past our 90-day retention still happened — say the question is not kept");
  L.push("rather than implying they asked nothing.");
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
