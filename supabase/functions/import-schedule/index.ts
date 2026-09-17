// IMPORT A SCHEDULE FROM A PICTURE — the same door we already use for a price list.
//
// Adrian, 2026-09-16: "Import from a calendar, and FROM A SCREENSHOT, the same door we already use
// for a lead." A screenshot of a calendar, a paper diary, a text from a customer, a competitor's
// booking confirmation — the owner has his week somewhere, and retyping it is the reason My Day
// stays empty.
//
// ── IT PROPOSES. IT NEVER WRITES. ────────────────────────────────────────────────────────
//
// This function returns what it READ and writes nothing. Every job it finds is shown to the owner
// and created only when he says so, through create_business_job — the writer that already exists.
// The reason is the standing one: a model reading a blurry photo of a diary WILL occasionally
// produce a customer who does not exist, at a time nobody booked, and a job is a commitment
// someone will be driven to. "A job offers, it never publishes" applies with more force here than
// it does to a service, because the failure ends with an owner at a stranger's door.
//
// ── AND IT REPORTS WHAT IT COULD NOT READ ────────────────────────────────────────────────
//
// `unreadable` carries the rows the model saw but could not resolve into a date or a service. An
// importer that silently drops the three it could not parse and reports the seven it could is the
// empty-reader defect wearing a helpful face: the owner believes his week is in, and three visits
// are missing. Saying "I got seven of ten, here are the three I could not read" is the whole
// difference.
import { HublyAI, extractJson } from "../_shared/hubly_ai.ts";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

const SYSTEM = `You read a picture of someone's work schedule OR their to-do list, and report ONLY
what is actually in it.

Return JSON: {"jobs":[...],"tasks":[...],"unreadable":[...],"warnings":[...]}

Each job: {"customer_name":string|null,"service_name":string|null,"scheduled_date":"YYYY-MM-DD"|null,
"scheduled_time":"HH:MM"|null,"address":string|null,"amount":number|null,"notes":string|null,
"source_text":string}

Each task: {"title":string,"due_date":"YYYY-MM-DD"|null,"due_time":"HH:MM"|null,"source_text":string}

WHICH IS IT — and this decides who a row is ABOUT, so get it right rather than fast:
- A JOB is work for a CUSTOMER. A name, a service, an address or a price means a job.
- A TASK is his own errand: "order glass cleaner", "call the accountant", "invoice Dave", "gym".
  No customer, nothing to turn up at someone's house for.
- WHEN IT IS GENUINELY AMBIGUOUS, IT IS A TASK. A task sits quietly on his day; a job is a
  commitment someone is expecting him at, and inventing one of those is the expensive error.
  ("A default that destroys work is never acceptable" — the cheap direction wins the tie.)
- ONE ROW GOES IN ONE LIST. Never both.

RULES, and they are absolute:
- REPORT ONLY WHAT IS WRITTEN. Never infer a customer, a service, a price or an address that is not
  visibly there. A field you cannot read is null. A null field is a correct answer.
- source_text is the literal text you read for that row, verbatim. It is how a person checks you.
- NEVER GUESS A YEAR. If the picture shows "Thu 18" with no year, put the date you can justify and
  say so in warnings; if you cannot justify one, scheduled_date is null and the row goes in
  unreadable instead.
- scheduled_time is 24-hour HH:MM. If the picture says "2" with no AM/PM, you do not know which it
  is: time is null and the row goes in unreadable with the reason. Twelve hours wrong is a missed
  appointment.
- unreadable: [{"source_text":string,"why":string}] — every row you saw and could not resolve. Do
  not omit them. A row you dropped silently is worse than one you reported as unclear.
- If the picture is not a schedule or a list at all, return {"jobs":[],"tasks":[],"unreadable":[],"warnings":["not a schedule"]}.
- Never invent a row to make the list look complete.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const files = Array.isArray(body?.files) ? body.files : [];
    if (!files.length) {
      return new Response(JSON.stringify({ error: "Nothing to read." }),
        { status: 400, headers: { ...CORS, "content-type": "application/json" } });
    }

    const content: Array<Record<string, unknown>> = [{
      type: "text",
      text: "Read this schedule and report only what is written in it. Today's date is "
        + new Date().toISOString().slice(0, 10) + ", which you may use to resolve a weekday or a "
        + "bare day-of-month — say in warnings when you did.",
    }];
    let hasPdf = false;
    for (const f of files) {
      const media = String(f?.media_type || "");
      const data = String(f?.data || "");
      if (!data) continue;
      if (media === "application/pdf") {
        hasPdf = true;
        content.push({ type: "document", source: { type: "base64", media_type: media, data } });
      } else if (media.startsWith("image/")) {
        content.push({ type: "image", source: { type: "base64", media_type: media, data } });
      }
    }
    if (content.length === 1) {
      return new Response(JSON.stringify({ error: "Nothing readable to import." }),
        { status: 400, headers: { ...CORS, "content-type": "application/json" } });
    }

    let rawText = "";
    try {
      const ai = await HublyAI.complete({
        feature: "import-schedule",
        task: "quote",
        provider: hasPdf ? "claude" : undefined,
        system: SYSTEM,
        messages: [{ role: "user", content }],
        maxTokens: 4000,
        jsonMode: true,
      });
      rawText = String(ai.text || "").trim();
    } catch (err) {
      console.error("import-schedule HublyAI error:", err);
      return new Response(JSON.stringify({ error: "Reading a schedule is temporarily unavailable." }),
        { status: 502, headers: { ...CORS, "content-type": "application/json" } });
    }

    let parsed: Record<string, unknown>;
    try { parsed = extractJson(rawText) as Record<string, unknown>; }
    catch {
      console.error("import-schedule: unparseable JSON:", rawText.slice(0, 400));
      return new Response(JSON.stringify({ error: "That came back in a shape I could not read. Try again." }),
        { status: 502, headers: { ...CORS, "content-type": "application/json" } });
    }

    // THE SHAPE IS ENFORCED HERE, not trusted from the model. A date that is not a date and a time
    // that is not a time are dropped into `unreadable` rather than passed on to a writer that would
    // throw on the cast — the same lesson as `'4 pm'::time` raising 22007 inside update_business_job.
    const rawJobs = Array.isArray(parsed?.jobs) ? parsed.jobs as Record<string, unknown>[] : [];
    const unreadable = Array.isArray(parsed?.unreadable)
      ? (parsed.unreadable as Record<string, unknown>[]).map((u) => ({
          source_text: String(u?.source_text || "").slice(0, 200),
          why: String(u?.why || "could not be read").slice(0, 200),
        }))
      : [];
    const jobs: Record<string, unknown>[] = [];
    for (const j of rawJobs) {
      const date = String(j?.scheduled_date || "");
      const time = String(j?.scheduled_time || "");
      const okDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
      const okTime = time === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
      if (!okDate || !okTime) {
        unreadable.push({
          source_text: String(j?.source_text || "").slice(0, 200),
          why: !okDate ? "no date I could pin down" : "the time was not a time I could read",
        });
        continue;
      }
      const amt = Number(j?.amount);
      jobs.push({
        customer_name: j?.customer_name ? String(j.customer_name).slice(0, 120) : null,
        service_name: j?.service_name ? String(j.service_name).slice(0, 120) : null,
        scheduled_date: date,
        scheduled_time: time || null,
        address: j?.address ? String(j.address).slice(0, 200) : null,
        amount: Number.isFinite(amt) && amt > 0 ? amt : null,
        notes: j?.notes ? String(j.notes).slice(0, 400) : null,
        source_text: String(j?.source_text || "").slice(0, 200),
      });
    }

    // ══ AND THE TASKS, THROUGH THE SAME DOOR ═══════════════════════════════════════════════
    //
    // Adrian: "screenshot/paste for TASKS". A photo of a to-do list is the same gesture as a photo
    // of a schedule — hand me the thing you already have — so it is the SAME endpoint, the same
    // review step and the same "nothing is on your day yet" promise. A second door would be a
    // second prompt, a second reviewer and a second idea of what a row means.
    //
    // A TASK'S SHAPE IS SMALLER AND SO IS ITS GATE. A job needs a date or it is unreadable,
    // because a job is a commitment at a time. A task with no date is a perfectly good task —
    // "order glass cleaner" is real whether or not he said when — so an undated task is KEPT,
    // and only a task with no title at all is dropped.
    const rawTasks = Array.isArray(parsed?.tasks) ? parsed.tasks as Record<string, unknown>[] : [];
    const tasks: Record<string, unknown>[] = [];
    for (const t of rawTasks) {
      const title = String(t?.title || "").trim();
      if (!title) {
        unreadable.push({ source_text: String(t?.source_text || "").slice(0, 200), why: "no title I could read" });
        continue;
      }
      const due = String(t?.due_date || "");
      const dueTime = String(t?.due_time || "");
      const okDue = due === "" || /^\d{4}-\d{2}-\d{2}$/.test(due);
      const okDueTime = dueTime === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime);
      tasks.push({
        title: title.slice(0, 200),
        // A DATE THAT IS NOT A DATE BECOMES NO DATE, never a bad cast into the writer. The task
        // survives; only the unreadable part of it is dropped, and the row says so.
        due_date: okDue && due ? due : null,
        due_time: okDueTime && dueTime ? dueTime : null,
        source_text: String(t?.source_text || "").slice(0, 200),
      });
      if (!okDue && due) unreadable.push({ source_text: title.slice(0, 200), why: "kept, but the date was not a date I could read" });
    }

    return new Response(JSON.stringify({
      jobs, tasks, unreadable,
      warnings: Array.isArray(parsed?.warnings) ? (parsed.warnings as unknown[]).map(String) : [],
    }), { headers: { ...CORS, "content-type": "application/json" } });
  } catch (e) {
    console.error("import-schedule threw:", e);
    return new Response(JSON.stringify({ error: "That could not be read just now." }),
      { status: 500, headers: { ...CORS, "content-type": "application/json" } });
  }
});
