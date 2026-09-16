// A JOB'S TIME IS GROUNDED IN WHAT HE ACTUALLY SAID, OR IT IS NOT WRITTEN.
//
//   deno run --allow-read scripts/lib/time-grounding.check.ts
//
// WHY. Until 2026-09-16 `addJob` and `updateJob` grounded the address against the owner's own
// message, grounded the price against it, and passed `scheduled_time` STRAIGHT THROUGH to a raw
// `::time` cast. The one field that can send a person to a customer at the wrong hour was the
// only one nothing checked. A wrong address is embarrassing; a wrong time is a missed
// appointment, and he hears about it from the customer.
//
// RED-PROOFED IN THE DIRECTION THAT SAYS "THIS IS FINE" FIRST (Lesson 89). Every leg below that
// matters is a REFUSAL leg: the failure mode here is not "we refused a good time" (that costs a
// question), it is "we accepted a time he never said" (that costs the appointment, silently).
//
// THE LIMIT, STATED: this checks that the VALUE came from him. It cannot check that the model
// attached it to the right job or the right field — "move the 3pm to 4pm" names two times and no
// grounding rule can say which is the new one. That is the matcher's job and the reply's
// read-back. What this makes impossible is a time nobody said.
//
// Exit: 0 PASS · 1 FAIL.
import { ambiguousHours, normalizeTimeValue, statedTimes, timeGroundedWhy } from "../../supabase/functions/_shared/hubly_grounding.ts";

let failed = 0;
const say = (n: string, ok: boolean, d?: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`);
  if (!ok) failed++;
};
const g = (v: string, m: string, ctx?: { priorAsk?: string; priorOwnerSaid?: string }) => timeGroundedWhy(v, m, ctx);

// ── 1. NO TIME AT ALL IN THE MESSAGE. The plainest fabrication and it must be refused. ──────
say("1 a message with no time at all grounds nothing",
  !g("14:00", "add a job for window cleaning").ok && g("14:00", "add a job for window cleaning").why === "no_time_in_message",
  JSON.stringify(g("14:00", "add a job for window cleaning")));
say("1b and neither does an empty message",
  !g("09:00", "").ok, JSON.stringify(g("09:00", "")));

// ── 2. A BARE HOUR IS TWELVE HOURS OF DOUBT. "2" is 02:00 or 14:00 and we do not get to pick. ─
say("2 a bare \"2\" does NOT ground 14:00",
  !g("14:00", "Thursday at 2 to do the driveway").ok && g("14:00", "Thursday at 2 to do the driveway").why === "ambiguous_hour",
  JSON.stringify(g("14:00", "Thursday at 2 to do the driveway")));
say("2b and it does not ground 02:00 either — the refusal is not a preference for AM",
  !g("02:00", "Thursday at 2 to do the driveway").ok, JSON.stringify(g("02:00", "Thursday at 2 to do the driveway")));
say("2c \"2 PM\" DOES ground 14:00",
  g("14:00", "move it to 2 PM").ok, JSON.stringify(g("14:00", "move it to 2 PM")));
say("2d and \"2 PM\" does not ground 02:00",
  !g("02:00", "move it to 2 PM").ok, JSON.stringify(g("02:00", "move it to 2 PM")));
say("2e the ask can name the hour it could not settle",
  g("14:00", "Thursday at 2").ambiguousHour === 2, JSON.stringify(g("14:00", "Thursday at 2")));

// ── 3. TWELVE. The one place "add 12 for PM" is wrong twice. ─────────────────────────────────
say("3 \"12 PM\" is noon, not midnight and not 24:00", g("12:00", "at 12 PM").ok && !g("00:00", "at 12 PM").ok,
  `12:00=${g("12:00", "at 12 PM").ok} 00:00=${g("00:00", "at 12 PM").ok}`);
say("3b \"12 AM\" is midnight, not noon", g("00:00", "at 12 AM").ok && !g("12:00", "at 12 AM").ok,
  `00:00=${g("00:00", "at 12 AM").ok} 12:00=${g("12:00", "at 12 AM").ok}`);
say("3c \"noon\" and \"midnight\" are read as written",
  g("12:00", "put it at noon").ok && g("00:00", "put it at midnight").ok, "noon -> 12:00, midnight -> 00:00");

// ── 4. A DIFFERENT JOB'S TIME. Out of window is out of reach. ────────────────────────────────
// The owner's previous message counts ONLY when Hubly's turn in between was a question. A time
// two turns back, or one behind a STATEMENT, cannot ground anything.
say("4 a time from a message Hubly did not interrupt with a question is out of reach",
  !g("15:00", "and change the window washing one", { priorAsk: "Driveway is now set for September 17 at 3:00 PM.", priorOwnerSaid: "the driveway is at 3:00 PM" }).ok,
  JSON.stringify(g("15:00", "and change the window washing one", { priorAsk: "Driveway is now set for September 17 at 3:00 PM.", priorOwnerSaid: "the driveway is at 3:00 PM" })));
say("4b a bare hour does not borrow a DIFFERENT hour that Hubly offered",
  !g("16:00", "make it 4", { priorAsk: "Should that be at 8:00 PM or 2:00 PM?" }).ok,
  JSON.stringify(g("16:00", "make it 4", { priorAsk: "Should that be at 8:00 PM or 2:00 PM?" })));
say("4c and when Hubly offered TWO times with the same hour, a bare hour stays ambiguous",
  !g("08:00", "i meant 8", { priorAsk: "Should that be at 8:00 AM or 8:00 PM?" }).ok,
  JSON.stringify(g("08:00", "i meant 8", { priorAsk: "Should that be at 8:00 AM or 8:00 PM?" })));

// ── 5. THE TWO REAL SPLITS, FROM THE CORPUS. The guard must not break what worked. ───────────
// hubly-classic-fixture seq 42-43: Hubly offered the two times, he picked one by its hour.
say("5 \"i meant 8\" grounds 20:00 when Hubly offered 8:00 PM or 2:00 PM",
  g("20:00", "i meant 8", { priorAsk: "I see two times there — should the window washing job on Sept 17 be at 8:00 PM or 2:00 PM?", priorOwnerSaid: "add a job for window washing at 8:00 PM on sept 17 at 2:00 PM" }).ok,
  "the walk's one correct disambiguation still lands");
// canyon-ridge-tree-care seq 18-20: HE said the time; OUR question split the statement.
say("5b \"window cleaning\" grounds 14:00 when he said 2:00 PM and Hubly asked what the job was",
  g("14:00", "window cleaning", { priorAsk: "What’s the job for?", priorOwnerSaid: "add a job for tomorrow at 2:00 PM" }).ok,
  "our own split does not cost him the time");
say("5c but the SAME message grounds nothing when Hubly's last turn was not a question",
  !g("14:00", "window cleaning", { priorAsk: "Tree removal $850 is on your page now.", priorOwnerSaid: "add a job for tomorrow at 2:00 PM" }).ok,
  "the widening is the question, not the history");

// ── 6. A VALUE POSTGRES WOULD THROW ON IS REFUSED BEFORE IT GETS THERE. ──────────────────────
// `'4 pm'::time` raises 22007. It used to reach the database and blow up the call rather than
// be refused, so a malformed time was an exception instead of a question.
say("6 an unreadable time value is refused, not passed to the cast",
  !g("sometime tomorrow", "make it sometime tomorrow").ok && g("sometime tomorrow", "x").why === "unparseable",
  JSON.stringify(g("sometime tomorrow", "x")));
say("6b normalizeTimeValue accepts only what `::time` accepts",
  normalizeTimeValue("4 pm") === "16:00" && normalizeTimeValue("16:00") === "16:00"
    && normalizeTimeValue("12 am") === "00:00" && normalizeTimeValue("25:00") === null
    && normalizeTimeValue("afternoon") === null,
  `4 pm->${normalizeTimeValue("4 pm")} 12 am->${normalizeTimeValue("12 am")} 25:00->${normalizeTimeValue("25:00")}`);

// ── 7. THE READERS THEMSELVES, so a future edit cannot quietly widen them. ───────────────────
say("7 a 24-hour clock reading is unambiguous; a 1-12 colon time without a meridiem is not",
  statedTimes("at 20:00").has("20:00") && statedTimes("at 9:30").size === 0,
  `20:00 -> ${[...statedTimes("at 20:00")]}, 9:30 -> ${[...statedTimes("at 9:30")] || "(none)"}`);
say("7b an hour with a meridiem is not also counted as ambiguous",
  !ambiguousHours("at 2 PM").has(2) && ambiguousHours("at 2").has(2),
  `"2 PM" -> ${[...ambiguousHours("at 2 PM")]}, "2" -> ${[...ambiguousHours("at 2")]}`);

// ── 8. AND THE WRITERS ACTUALLY USE IT. A guard nothing calls is a comment. ──────────────────
const reg = Deno.readTextFileSync(new URL("../../supabase/functions/_shared/hubly_capability_registry.ts", import.meta.url));
say("8 addJob sends the grounded time, not the model's string",
  /scheduled_time:\s*sendTime,/.test(reg) && !/scheduled_time:\s*str\("scheduled_time"\),/.test(reg),
  "addJob -> sendTime");
say("8b updateJob sends the grounded time, not the model's string",
  /p_scheduled_time:\s*sendTime \|\| null,/.test(reg) && !/p_scheduled_time:\s*str\("scheduled_time"\) \|\| null,/.test(reg),
  "updateJob -> sendTime");
say("8c a time-only turn that is refused ASKS instead of reporting no_change",
  /error:\s*"time_ungrounded"/.test(reg) && /Ask which one they mean/.test(reg),
  "refusal asks which hour");

console.log(failed ? `\n${failed} assertion(s) failed.` : `\nA time is grounded in what he said, or it is not written.`);
Deno.exit(failed ? 1 : 0);
