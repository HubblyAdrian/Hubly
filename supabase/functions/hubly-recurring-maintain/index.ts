/**
 * Recurring Schedule → next occurrence — the scheduled worker that keeps
 * the schedule-as-source-of-truth model real. A recurring_schedules row
 * owns cadence/next_occurrence_date/status/service/pricing/technician;
 * this is the one place that turns "a visit is due" into one real jobs
 * row, generated only as it actually becomes due — never a batch of
 * future jobs created up front.
 *
 * Auth: Authorization: Bearer <service role> OR header
 * x-hubly-cron-secret == HUBLY_CRON_SECRET — same convention as
 * google-calendar-maintain, not a new one.
 *
 * Idempotency: generation for one occurrence is claimed with a single
 * conditional UPDATE (next_occurrence_date = new value WHERE ... AND
 * next_occurrence_date = old value AND status = 'active'). Only the run
 * that actually flips that row wins; a concurrent or retried run finds 0
 * rows matched and skips. A belt-and-suspenders existence check (is there
 * already a job for this schedule+date?) runs first too. Running this
 * function twice, or twice at once, can never create two jobs for the
 * same occurrence.
 *
 * Schedule via Supabase cron / external scheduler every 15–30 minutes —
 * see the migration that enables pg_cron/pg_net and registers the job.
 */

import { createClient  } from "https://esm.sh/@supabase/supabase-js@2";
import { syncEnginePushCreate  } from "../_shared/google_calendar_sync_engine.ts";
import { computeNextOccurrenceDate  } from "../_shared/recurring_schedule_engine.ts";
// Supabase key resolution goes through _shared/supabase_admin.ts. It THROWS on a
// missing key instead of continuing with "" (nine call sites used to 401 quietly
// and be logged), reads the plural SUPABASE_PUBLISHABLE_KEYS the platform
// actually injects rather than the singular name that is set nowhere, and never
// sends a non-JWT sb_secret_ key as a Bearer token -- PostgREST rejects those as
// "Invalid JWT", which looks exactly like the empty-key 401 in a log.
import { createAdminClient, requireSecretKey } from "../_shared/supabase_admin.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hubly-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

function authorized(req: Request, serviceKey: string): boolean {
  const cronSecret = Deno.env.get("HUBLY_CRON_SECRET")?.trim();
  const headerSecret = req.headers.get("x-hubly-cron-secret") || "";
  if (cronSecret && headerSecret && headerSecret === cronSecret) return true;

  const auth = req.headers.get("Authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token && token === serviceKey) return true;
  }
  return false;
}

// How far ahead a due occurrence is generated — not "all future visits,"
// just enough lead time for the owner to see it on Calendar and assign a
// technician before the day arrives. A schedule whose next_occurrence_date
// is further out than this is simply not touched yet; the next run picks
// it up once it's within the window.
const LOOKAHEAD_DAYS = 7;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return jsonRes({ error: "POST required" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) return jsonRes({ error: "Server misconfigured" }, 500);
  // Compare against the RESOLVED key, whichever era it comes from.
  if (!authorized(req, requireSecretKey().key)) return jsonRes({ error: "Unauthorized" }, 401);

  const admin = createAdminClient();
  const horizon = addDaysStr(todayStr(), LOOKAHEAD_DAYS);

  const { data: dueSchedules, error: loadErr } = await admin
    .from("recurring_schedules")
    .select("*")
    .eq("status", "active")
    .lte("next_occurrence_date", horizon);

  if (loadErr) return jsonRes({ ok: false, error: loadErr.message }, 500);

  let generated = 0;
  let skippedAlreadyClaimed = 0;
  let skippedJobExists = 0;
  const errors: Array<{ scheduleId: string; error: string }> = [];

  for (const schedule of dueSchedules || []) {
    try {
      const claimedDate = String(schedule.next_occurrence_date);
      const newNextDate = computeNextOccurrenceDate(
        claimedDate,
        String(schedule.frequency || ""),
        schedule.custom_interval_days ?? null,
      );

      // Belt-and-suspenders: if a job for this exact schedule+date
      // already exists (an earlier run generated it, or the first
      // occurrence created at schedule-creation time somehow matches),
      // don't generate a second one — just make sure next_occurrence_date
      // isn't stuck pointing at an already-fulfilled date.
      const { data: existingJob } = await admin
        .from("jobs")
        .select("id")
        .eq("recurring_schedule_id", schedule.id)
        .eq("scheduled_date", claimedDate)
        .maybeSingle();
      if (existingJob) {
        skippedJobExists++;
        if (newNextDate !== claimedDate) {
          await admin
            .from("recurring_schedules")
            .update({ next_occurrence_date: newNextDate })
            .eq("id", schedule.id)
            .eq("next_occurrence_date", claimedDate)
            .eq("status", "active");
        }
        continue;
      }

      // The real idempotency guarantee: only the caller that actually
      // flips next_occurrence_date away from claimedDate gets to create
      // the job. A concurrent/retried run matches 0 rows here and skips.
      const { data: claimed, error: claimErr } = await admin
        .from("recurring_schedules")
        .update({ next_occurrence_date: newNextDate })
        .eq("id", schedule.id)
        .eq("next_occurrence_date", claimedDate)
        .eq("status", "active")
        .select()
        .maybeSingle();
      if (claimErr || !claimed) {
        skippedAlreadyClaimed++;
        continue;
      }

      const payload = {
        business_id: schedule.business_id,
        customer_id: schedule.customer_id,
        customer_name: schedule.customer_name || null,
        service_name: schedule.service_name || null,
        service_id: schedule.service_id || null,
        scheduled_date: claimedDate,
        scheduled_time: schedule.preferred_time || null,
        address: schedule.address || null,
        amount: schedule.amount ?? null,
        assigned_to: schedule.assigned_to || null,
        status: "scheduled",
        from_booking: false,
        recurring_schedule_id: schedule.id,
      };
      const { data: job, error: jobErr } = await admin.from("jobs").insert(payload).select().single();
      if (jobErr || !job) {
        errors.push({ scheduleId: String(schedule.id), error: jobErr?.message || "job_create_failed" });
        continue;
      }
      generated++;

      // Best-effort, same as every other job-creation path.
      try {
        await syncEnginePushCreate(admin, { businessId: String(schedule.business_id), jobId: String(job.id) });
      } catch (_e) { /* no-op */ }
    } catch (e) {
      errors.push({ scheduleId: String(schedule.id), error: e instanceof Error ? e.message : String(e) });
    }
  }

  return jsonRes({
    ok: true,
    checked: (dueSchedules || []).length,
    generated,
    skippedAlreadyClaimed,
    skippedJobExists,
    errors,
  });
});
