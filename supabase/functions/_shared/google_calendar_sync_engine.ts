/**
 * Hubly ↔ Google Calendar Sync Engine
 *
 * Source of truth:
 * - Hubly Jobs (linked via hubly_job_id / google_event_id) → Hubly wins unless Google is newer
 * - Personal Google events (no hubly link) → Google wins → google_calendar_events only (never jobs)
 *
 * Conflict: compare last_hubly_update vs Google event.updated (last_google_update).
 * Loops: etag match, hubly_push_at window, sync_origin='google' skips Hubly timestamp bump.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ensureGoogleAccessToken,
  pushHublyJobToGoogle,
  updateHublyJobOnGoogle,
  deleteHublyJobOnGoogle,
  zonedParts,
  type GoogleCalendarConnection,
} from "./google_calendar_sync.ts";

export type SyncStatus =
  | "idle"
  | "pending"
  | "synced"
  | "conflict"
  | "error"
  | "local_only";

export type ConflictWinner = "hubly" | "google" | "equal";

type GCalDateTime = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

export type GCalEvent = {
  id?: string;
  status?: string;
  etag?: string;
  summary?: string;
  description?: string;
  location?: string;
  updated?: string;
  start?: GCalDateTime;
  end?: GCalDateTime;
  extendedProperties?: { private?: Record<string, string> };
};

type LinkedJob = {
  id: string;
  hubly_job_id?: string | null;
  google_event_id?: string | null;
  google_etag?: string | null;
  hubly_push_at?: string | null;
  last_synced_at?: string | null;
  last_google_update?: string | null;
  last_hubly_update?: string | null;
  sync_status?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  duration_hours?: number | null;
  address?: string | null;
  notes?: string | null;
  status?: string | null;
  customer_name?: string | null;
  service_name?: string | null;
  phone?: string | null;
};

const LOOP_GUARD_MS = 30_000;

export function resolveConflict(
  lastHublyUpdate: string | Date | null | undefined,
  lastGoogleUpdate: string | Date | null | undefined,
): ConflictWinner {
  const h = lastHublyUpdate ? new Date(lastHublyUpdate).getTime() : 0;
  const g = lastGoogleUpdate ? new Date(lastGoogleUpdate).getTime() : 0;
  if (!Number.isFinite(h) || h <= 0) {
    if (!Number.isFinite(g) || g <= 0) return "equal";
    return "google";
  }
  if (!Number.isFinite(g) || g <= 0) return "hubly";
  if (h > g) return "hubly";
  if (g > h) return "google";
  return "equal";
}

function parseEventSchedule(ev: GCalEvent, businessTz: string) {
  if (!ev?.start) return null;
  if (ev.start.date) {
    return {
      date: String(ev.start.date).slice(0, 10),
      time: "08:00:00",
      durationHours: 10,
    };
  }
  if (!ev.start.dateTime) return null;
  const start = new Date(ev.start.dateTime);
  const end = ev.end?.dateTime
    ? new Date(ev.end.dateTime)
    : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  if (!Number.isFinite(start.getTime())) return null;
  const tz = businessTz || ev.start.timeZone || "UTC";
  const startParts = zonedParts(start, tz);
  const endParts = zonedParts(end, tz);
  let durMin = endParts.mins - startParts.mins;
  if (endParts.date !== startParts.date || durMin <= 0) {
    durMin = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
  }
  return {
    date: startParts.date,
    time: `${startParts.time}:00`,
    durationHours: Math.max(0.25, Math.round((durMin / 60) * 100) / 100),
  };
}

function extractNotesFromDescription(desc: string | null | undefined) {
  const raw = String(desc || "");
  if (!raw.trim()) return null;
  const m = raw.match(/Notes:\s*\n([\s\S]*?)(?:\n\nCreated by Hubly\s*$|$)/i);
  if (m) return m[1].trim() || null;
  if (/^Customer:/m.test(raw) && /Created by Hubly/i.test(raw)) return null;
  return raw.trim();
}

function isPersonalGoogleEvent(ev: GCalEvent): boolean {
  return !String(ev.extendedProperties?.private?.hublyJobId || "").trim();
}

const JOB_SYNC_SELECT =
  "id,hubly_job_id,google_event_id,google_etag,hubly_push_at,last_synced_at,last_google_update,last_hubly_update,sync_status,scheduled_date,scheduled_time,duration_hours,address,notes,status,customer_name,service_name,phone";

async function findLinkedJob(
  admin: SupabaseClient,
  businessId: string,
  ev: GCalEvent,
): Promise<LinkedJob | null> {
  const hublyJobId = String(ev.extendedProperties?.private?.hublyJobId || "").trim();
  if (hublyJobId) {
    const { data } = await admin
      .from("jobs")
      .select(JOB_SYNC_SELECT)
      .eq("business_id", businessId)
      .eq("id", hublyJobId)
      .maybeSingle();
    if (data) return data as LinkedJob;
  }
  const gid = String(ev.id || "").trim();
  if (!gid) return null;
  const { data } = await admin
    .from("jobs")
    .select(JOB_SYNC_SELECT)
    .eq("business_id", businessId)
    .eq("google_event_id", gid)
    .maybeSingle();
  return (data as LinkedJob) || null;
}

async function markJobSynced(
  admin: SupabaseClient,
  jobId: string,
  businessId: string,
  patch: Record<string, unknown>,
) {
  await admin
    .from("jobs")
    .update({
      ...patch,
      last_synced_at: new Date().toISOString(),
      sync_status: "synced",
    })
    .eq("id", jobId)
    .eq("business_id", businessId);
}

/**
 * Hubly → Google: create event for a new job.
 */
export async function syncEnginePushCreate(
  admin: SupabaseClient,
  opts: { businessId: string; jobId: string },
) {
  const result = await pushHublyJobToGoogle(admin, opts);
  if (result.google_event_id && (result.created || result.reason === "found_existing")) {
    await markJobSynced(admin, opts.jobId, opts.businessId, {
      google_event_id: result.google_event_id,
      hubly_job_id: opts.jobId,
      // last_hubly_update already set by trigger on create
    });
  } else if (result.skipped && result.reason === "not_connected") {
    await admin
      .from("jobs")
      .update({ sync_status: "local_only", hubly_job_id: opts.jobId })
      .eq("id", opts.jobId);
  }
  return result;
}

/**
 * Hubly → Google: update existing event (Hubly is writing).
 * Never creates — missing google_event_id returns needs_create for the caller.
 */
export async function syncEnginePushUpdate(
  admin: SupabaseClient,
  opts: { businessId: string; jobId: string },
) {
  const result = await updateHublyJobOnGoogle(admin, opts);
  if (result.updated || result.reason === "already_linked") {
    await markJobSynced(admin, opts.jobId, opts.businessId, {
      hubly_job_id: opts.jobId,
    });
  }
  return result;
}

/**
 * Hubly → Google: delete event.
 */
export async function syncEnginePushDelete(
  admin: SupabaseClient,
  opts: { businessId: string; jobId?: string; googleEventId?: string | null },
) {
  const result = await deleteHublyJobOnGoogle(admin, opts);
  if (opts.jobId) {
    try {
      await admin
        .from("jobs")
        .update({
          sync_status: "idle",
          last_synced_at: new Date().toISOString(),
          google_etag: null,
          sync_origin: "google", // don't bump last_hubly_update
        })
        .eq("id", opts.jobId)
        .eq("business_id", opts.businessId);
    } catch (_) {
      /* job may already be deleted */
    }
  }
  return result;
}

export type ApplyOutcome =
  | "updated"
  | "cancelled"
  | "skipped"
  | "pushed_hubly"
  | "personal_skip";

/**
 * Google → Hubly for a single event, with conflict resolution.
 * Personal events (no hublyJobId): skipped here — import sync owns those.
 * Linked jobs: newest timestamp wins; never creates jobs.
 */
export async function syncEngineApplyGoogleEvent(
  admin: SupabaseClient,
  opts: { businessId: string; event: GCalEvent; businessTz: string },
): Promise<ApplyOutcome> {
  const { businessId, event: ev, businessTz } = opts;

  // Personal Google events → Google is SoT (handled by google_calendar_events import)
  if (isPersonalGoogleEvent(ev) && !ev.id) return "personal_skip";

  const job = await findLinkedJob(admin, businessId, ev);

  // No linked Hubly job: personal (or unknown) event — do not create a job
  if (!job) {
    if (isPersonalGoogleEvent(ev)) return "personal_skip";
    return "skipped";
  }

  const etag = String(ev.etag || "").trim();
  const googleUpdated = ev.updated || null;

  // Loop / no-op guards
  if (etag && job.google_etag && etag === job.google_etag) return "skipped";
  if (job.hubly_push_at) {
    const pushed = new Date(job.hubly_push_at).getTime();
    if (Number.isFinite(pushed) && Date.now() - pushed < LOOP_GUARD_MS) return "skipped";
  }
  if (
    googleUpdated &&
    job.last_synced_at &&
    new Date(googleUpdated).getTime() <= new Date(job.last_synced_at).getTime() &&
    etag &&
    job.google_etag === etag
  ) {
    return "skipped";
  }

  const winner = resolveConflict(job.last_hubly_update, googleUpdated || job.last_google_update);

  // Hubly is newer → keep Hubly, push to Google (reconcile), do not apply Google
  if (winner === "hubly") {
    try {
      if (!job.google_event_id) {
        await syncEnginePushCreate(admin, { businessId, jobId: job.id });
      } else {
        await syncEnginePushUpdate(admin, { businessId, jobId: job.id });
      }
      return "pushed_hubly";
    } catch (e) {
      console.warn("syncEngine conflict hubly push", e);
      await admin
        .from("jobs")
        .update({ sync_status: "conflict" })
        .eq("id", job.id);
      return "skipped";
    }
  }

  // equal + etag already handled; treat equal as skip unless cancelled
  if (winner === "equal" && ev.status !== "cancelled") {
    if (etag) {
      await admin
        .from("jobs")
        .update({
          google_etag: etag,
          last_google_update: googleUpdated,
          last_synced_at: new Date().toISOString(),
          sync_status: "synced",
          sync_origin: "google",
        })
        .eq("id", job.id);
    }
    return "skipped";
  }

  // Google wins (or cancelled)
  if (ev.status === "cancelled") {
    await admin
      .from("jobs")
      .update({
        status: "cancelled",
        google_etag: etag || job.google_etag || null,
        last_google_update: googleUpdated,
        last_synced_at: new Date().toISOString(),
        sync_status: "synced",
        sync_origin: "google",
      })
      .eq("id", job.id)
      .eq("business_id", businessId);
    return "cancelled";
  }

  const sched = parseEventSchedule(ev, businessTz);
  if (!sched) return "skipped";

  const location = ev.location != null ? String(ev.location).trim() : null;
  const notesFromG = extractNotesFromDescription(ev.description);

  const payload: Record<string, unknown> = {
    scheduled_date: sched.date,
    scheduled_time: sched.time,
    duration_hours: sched.durationHours,
    google_event_id: String(ev.id || job.google_event_id || ""),
    google_etag: etag || null,
    hubly_job_id: job.id,
    last_google_update: googleUpdated,
    last_synced_at: new Date().toISOString(),
    sync_status: "synced",
    sync_origin: "google",
  };
  if (location !== null) payload.address = location || null;
  if (notesFromG !== null) payload.notes = notesFromG || null;
  if (job.status === "cancelled" || job.status === "canceled") {
    payload.status = "scheduled";
  }

  await admin.from("jobs").update(payload).eq("id", job.id).eq("business_id", businessId);
  return "updated";
}

/**
 * Full Sync Engine pass for a business:
 * 1) Import personal Google events (Google SoT) via existing importer
 * 2) Reconcile linked Hubly jobs via incremental/inbound apply
 */
export async function syncEngineRun(
  admin: SupabaseClient,
  opts: {
    businessId: string;
    /** Optional preloaded events; otherwise caller runs inbound list */
    events?: GCalEvent[];
    businessTz?: string;
  },
): Promise<{
  ok: true;
  updated: number;
  cancelled: number;
  skipped: number;
  pushed_hubly: number;
  personal_skip: number;
}> {
  const { data: biz } = await admin
    .from("businesses")
    .select("timezone")
    .eq("id", opts.businessId)
    .maybeSingle();
  const businessTz = opts.businessTz || String(biz?.timezone || "America/Denver");

  let updated = 0;
  let cancelled = 0;
  let skipped = 0;
  let pushed_hubly = 0;
  let personal_skip = 0;

  for (const ev of opts.events || []) {
    try {
      const outcome = await syncEngineApplyGoogleEvent(admin, {
        businessId: opts.businessId,
        event: ev,
        businessTz,
      });
      if (outcome === "updated") updated++;
      else if (outcome === "cancelled") cancelled++;
      else if (outcome === "pushed_hubly") pushed_hubly++;
      else if (outcome === "personal_skip") personal_skip++;
      else skipped++;
    } catch (e) {
      console.warn("syncEngineApplyGoogleEvent", e);
      skipped++;
    }
  }

  return { ok: true, updated, cancelled, skipped, pushed_hubly, personal_skip };
}

// Re-export token helper for watch registration callers
export { ensureGoogleAccessToken, type GoogleCalendarConnection };
