// A REPEAT THE OWNER DID NOT ASK FOR IS A STANDING COMMITMENT NOBODY MADE.
//
//   deno run --allow-read scripts/lib/cadence-grounding.check.ts
//
// createBooking has always carried the instruction in words — "never infer or default it" — and an
// instruction is a thing a model can forget. The owner-side path enforces it with the SAME
// mechanism that grounds time, price, address, phone and email, not a second one.
//
// STRICTER THAN THE OTHERS, ON PURPOSE: there is no partial credit. The difference between weekly
// and monthly is four times the work and four times the bill, so a message that only gestures at
// repetition ("regularly", "keep it going") grounds NOTHING and earns its own answer — "how
// often?" rather than "say that again".
//
// Exit: 0 PASS · 1 FAIL.
import { cadenceGroundedWhy, statedCadence } from "../../supabase/functions/_shared/hubly_grounding.ts";

let failed = 0;
const say = (n: string, ok: boolean, d?: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++;
};
const g = (v: string, m: string, d?: number | null) => cadenceGroundedWhy(v, m, d);

// ── 1. WHAT HE SAID IS WHAT GETS WRITTEN. ──────────────────────────────────────────────
say("1 \"every week\" grounds weekly", g("weekly", "the maple st mow is every week").ok, "");
say("1b \"every other week\" is BIWEEKLY, not weekly — the trap in the phrase",
  g("biweekly", "make that one every other week").ok && !g("weekly", "make that one every other week").ok,
  `biweekly=${g("biweekly", "every other week").ok} weekly=${g("weekly", "every other week").ok}`);
say("1c \"monthly\" and \"every quarter\" ground themselves",
  g("monthly", "put it on monthly").ok && g("quarterly", "do it every quarter").ok, "");
say("1d \"every 10 days\" grounds custom AT TEN — not at any other number",
  g("custom", "come every 10 days", 10).ok && !g("custom", "come every 10 days", 30).ok,
  `10=${g("custom", "come every 10 days", 10).ok} 30=${g("custom", "come every 10 days", 30).ok}`);

// ── 2. THE REFUSALS, WHICH ARE THE POINT. ──────────────────────────────────────────────
say("2 a cadence that is NOT in the message grounds nothing",
  !g("weekly", "change the driveway job to 3 PM").ok
    && g("weekly", "change the driveway job to 3 PM").why === "not_in_message",
  JSON.stringify(g("weekly", "change the driveway job to 3 PM")));
say("2b a message that says it repeats but not HOW OFTEN is refused as VAGUE, separately",
  !g("weekly", "make the mow recurring").ok && g("weekly", "make the mow recurring").why === "vague",
  JSON.stringify(g("weekly", "make the mow recurring")));
say("2c \"every week\" does NOT ground monthly — the wrong cadence is not partial credit",
  !g("monthly", "the mow is every week").ok, JSON.stringify(g("monthly", "the mow is every week")));
say("2d a value that is not a cadence at all is refused by name",
  g("sometimes", "every week").why === "not_a_cadence", JSON.stringify(g("sometimes", "every week")));
say("2e an empty message grounds nothing", !g("weekly", "").ok, JSON.stringify(g("weekly", "")));

// ── 3. THE READER ITSELF, so a future edit cannot quietly widen it. ────────────────────
say("3 statedCadence reads only what is stated",
  statedCadence("every other week")?.frequency === "biweekly"
    && statedCadence("fortnightly")?.frequency === "biweekly"
    && statedCadence("keep it going")=== null
    && statedCadence("every 14 days")?.customIntervalDays === 14,
  "biweekly · fortnightly · vague=null · custom 14");

// ── 4. AND BOTH DOORS GO THROUGH THE SAME WRITER. Two writers would drift on the conflict
//       rules, and the owner would get two sets of generated jobs. ─────────────────────
const reg = Deno.readTextFileSync(new URL("../../supabase/functions/_shared/hubly_capability_registry.ts", import.meta.url));
const page = Deno.readTextFileSync(new URL("../../public/platform-home.html", import.meta.url));
say("4 the talking path calls set_job_recurring and grounds the cadence first",
  /callBusinessRpc\("set_job_recurring"/.test(reg) && /cadenceGroundedWhy\(freq, userMessage/.test(reg),
  "makeJobRecurring -> set_job_recurring");
say("4b the by-hand path calls the SAME rpc, not a second writer",
  /rpc\('set_job_recurring'/.test(page), "hcMakeJobRecurring -> set_job_recurring");
say("4c and the by-hand control has NO cadence preselected",
  /\['', 'Repeats… \(not set\)'\]/.test(page),
  "a select defaulted to Weekly would be the never-default rule broken by a UI control");

// ── 5. NO SECOND ENGINE. The interval math must not be re-implemented in SQL. ──────────
const mig = Deno.readTextFileSync(new URL("../../supabase/migrations/20260916190000_set_job_recurring.sql", import.meta.url));
say("5 the writer computes NO interval math — next_occurrence_date is the job's own date",
  /next_occurrence_date\s*\n?\s*\)\s*values/.test(mig.replace(/\s+/g, " ")) || /j\.scheduled_date, j\.scheduled_date/.test(mig),
  "the cron's engine takes the first step");
// THE FIRST VERSION OF THIS LEG MATCHED ITS OWN ERROR CODE. `/interval\s*'/` hit the string
// 'needs_interval' — the word followed immediately by a quote — and reported SQL date arithmetic
// that does not exist. A check that cries wolf about the thing it guards teaches you to ignore it.
// Postgres interval literals are `interval '1 month'`: the whitespace is what makes it arithmetic.
say("5b and nothing in it adds days, weeks or months",
  !/\binterval\s+'|\+\s*\d+\s*\*\s*interval|date_trunc\s*\(\s*'month'/i.test(mig),
  "no date arithmetic in SQL");

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nA repeat is written only when the owner said how often, and one writer serves both doors.");
Deno.exit(failed ? 1 : 0);
