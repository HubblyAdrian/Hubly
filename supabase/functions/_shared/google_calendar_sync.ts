// Shared Google Calendar helpers: token refresh, event import, and Hubly→Google job push.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type GoogleCalendarConnection = {
  id: string;
  business_id: string;
  owner_id: string;
  calendar_id: string | null;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
};

export type SyncResult = {
  ok: true;
  imported: number;
  upserted: number;
  removed: number;
  skipped: number;
  last_sync_at: string;
  window: { time_min: string; time_max: string };
};

type GCalDateTime = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

type GCalEvent = {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  updated?: string;
  start?: GCalDateTime;
  end?: GCalDateTime;
  extendedProperties?: { private?: Record<string, string> };
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Format a Date in a given IANA timezone as local calendar parts. */
export function zonedParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  );
  let hour = Number(parts.hour);
  // Some environments emit 24:00 for midnight
  if (hour === 24) hour = 0;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${pad2(hour)}:${pad2(Number(parts.minute) || 0)}`,
    mins: hour * 60 + (Number(parts.minute) || 0),
  };
}

export async function ensureGoogleAccessToken(
  admin: SupabaseClient,
  conn: GoogleCalendarConnection,
): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")?.trim();
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Google Calendar isn’t configured (missing client credentials).");
  }

  const expiresAt = conn.access_token_expires_at
    ? new Date(conn.access_token_expires_at).getTime()
    : 0;
  if (conn.access_token && expiresAt > Date.now() + 60_000) {
    return conn.access_token;
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) {
    console.error("google token refresh", tokenJson);
    throw new Error("Google access expired — reconnect Google Calendar in Settings.");
  }

  const accessToken = String(tokenJson.access_token);
  const expiresIn = Number(tokenJson.expires_in) || 3600;
  const accessExpires = new Date(Date.now() + expiresIn * 1000).toISOString();

  await admin
    .from("google_calendar_connections")
    .update({
      access_token: accessToken,
      access_token_expires_at: accessExpires,
      ...(tokenJson.refresh_token
        ? { refresh_token: String(tokenJson.refresh_token) }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id);

  if (tokenJson.refresh_token) {
    conn.refresh_token = String(tokenJson.refresh_token);
  }
  conn.access_token = accessToken;
  conn.access_token_expires_at = accessExpires;

  return accessToken;
}

function parseEventWindow(
  ev: GCalEvent,
  businessTz: string,
): {
  allDay: boolean;
  startAt: string | null;
  endAt: string | null;
  localDate: string;
  localStartTime: string | null;
  durationHours: number;
} | null {
  if (!ev?.start) return null;

  // All-day: start.date / end.date (end exclusive)
  if (ev.start.date) {
    const startDate = String(ev.start.date).slice(0, 10);
    const endExclusive = String(ev.end?.date || startDate).slice(0, 10);
    const startMs = Date.parse(`${startDate}T00:00:00Z`);
    let endMs = Date.parse(`${endExclusive}T00:00:00Z`);
    if (!Number.isFinite(startMs)) return null;
    if (!Number.isFinite(endMs) || endMs <= startMs) endMs = startMs + 24 * 60 * 60 * 1000;
    // One DB row per Google event; client expands multi-day all-day across dates
    return {
      allDay: true,
      startAt: new Date(startMs).toISOString(),
      endAt: new Date(endMs).toISOString(),
      localDate: startDate,
      localStartTime: "08:00:00",
      durationHours: 10,
    };
  }

  if (!ev.start.dateTime) return null;
  const start = new Date(ev.start.dateTime);
  const end = ev.end?.dateTime
    ? new Date(ev.end.dateTime)
    : new Date(start.getTime() + 60 * 60 * 1000);
  if (!Number.isFinite(start.getTime())) return null;

  const tz = businessTz || ev.start.timeZone || "UTC";
  const startParts = zonedParts(start, tz);
  const endParts = zonedParts(end, tz);
  let durMin = endParts.mins - startParts.mins;
  // Cross-midnight or multi-day timed: use absolute ms
  if (endParts.date !== startParts.date || durMin <= 0) {
    durMin = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
  }
  const durationHours = Math.max(0.25, Math.round((durMin / 60) * 100) / 100);

  return {
    allDay: false,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    localDate: startParts.date,
    localStartTime: `${startParts.time}:00`,
    durationHours,
  };
}

async function fetchAllEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<GCalEvent[]> {
  const events: GCalEvent[] = [];
  let pageToken: string | undefined;
  const cal = encodeURIComponent(calendarId || "primary");
  let pages = 0;
  const MAX_PAGES = 20;

  do {
    pages++;
    if (pages > MAX_PAGES) break;
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${cal}/events`,
    );
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("showDeleted", "true");
    url.searchParams.set("maxResults", "250");
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", timeMax);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("calendar.events.list", json?.error?.message || res.status);
      throw new Error(json?.error?.message || "Could not fetch Google Calendar events");
    }
    const items = Array.isArray(json.items) ? json.items : [];
    events.push(...items);
    pageToken = json.nextPageToken || undefined;
  } while (pageToken);

  return events;
}

/**
 * Import events from the owner's primary Google Calendar into google_calendar_events.
 * Upserts by google_event_id (no duplicates). Removes local rows in-window that vanished.
 */
export async function syncGoogleCalendarForBusiness(
  admin: SupabaseClient,
  opts: {
    businessId: string;
    /** Optional ISO bounds; defaults to -30d … +90d */
    timeMin?: string;
    timeMax?: string;
  },
): Promise<SyncResult> {
  const businessId = opts.businessId;
  const { data: conn, error: connErr } = await admin
    .from("google_calendar_connections")
    .select(
      "id,business_id,owner_id,calendar_id,refresh_token,access_token,access_token_expires_at",
    )
    .eq("business_id", businessId)
    .maybeSingle();

  if (connErr || !conn?.refresh_token) {
    throw new Error("Google Calendar is not connected");
  }

  const { data: biz } = await admin
    .from("businesses")
    .select("id,timezone")
    .eq("id", businessId)
    .maybeSingle();
  const businessTz = String(biz?.timezone || "America/Denver");

  const now = Date.now();
  const timeMin = opts.timeMin || new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = opts.timeMax || new Date(now + 90 * 24 * 60 * 60 * 1000).toISOString();

  const accessToken = await ensureGoogleAccessToken(admin, conn as GoogleCalendarConnection);
  const calendarId = conn.calendar_id || "primary";
  const remote = await fetchAllEvents(accessToken, calendarId, timeMin, timeMax);

  const keepIds = new Set<string>();
  const rows: Record<string, unknown>[] = [];
  let skipped = 0;
  const syncedAt = new Date().toISOString();

  for (const ev of remote) {
    const gid = String(ev.id || "").trim();
    if (!gid) {
      skipped++;
      continue;
    }
    // Skip events Hubly itself created — they already appear as Hubly jobs
    if (ev.extendedProperties?.private?.hublyJobId) {
      skipped++;
      continue;
    }
    // Cancelled / deleted → drop locally (don't upsert; cleanup removes them)
    if (ev.status === "cancelled") {
      continue;
    }
    const win = parseEventWindow(ev, businessTz);
    if (!win) {
      skipped++;
      continue;
    }
    keepIds.add(gid);
    rows.push({
      business_id: businessId,
      google_event_id: gid,
      calendar_id: calendarId,
      summary: ev.summary || null,
      description: ev.description || null,
      location: ev.location || null,
      html_link: ev.htmlLink || null,
      status: ev.status || "confirmed",
      all_day: win.allDay,
      start_at: win.startAt,
      end_at: win.endAt,
      local_date: win.localDate,
      local_start_time: win.localStartTime,
      duration_hours: win.durationHours,
      google_updated_at: ev.updated || null,
      synced_at: syncedAt,
    });
  }

  let upserted = 0;
  // Upsert in chunks
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error: upErr } = await admin
      .from("google_calendar_events")
      .upsert(chunk, { onConflict: "business_id,google_event_id" });
    if (upErr) {
      console.error("google_calendar_events upsert", upErr);
      throw new Error("Could not save Google events");
    }
    upserted += chunk.length;
  }

  // Remove local events in the sync window that are no longer on Google (or cancelled)
  const { data: existing } = await admin
    .from("google_calendar_events")
    .select("id,google_event_id,start_at,local_date")
    .eq("business_id", businessId);

  const toRemove: string[] = [];
  const windowStart = new Date(timeMin).getTime();
  const windowEnd = new Date(timeMax).getTime();
  for (const row of existing || []) {
    const gid = String(row.google_event_id || "");
    if (keepIds.has(gid)) continue;
    // Only remove if it falls inside the synced window
    let inWindow = false;
    if (row.start_at) {
      const t = new Date(row.start_at).getTime();
      inWindow = t >= windowStart && t <= windowEnd;
    } else if (row.local_date) {
      const t = Date.parse(`${row.local_date}T12:00:00Z`);
      inWindow = t >= windowStart && t <= windowEnd;
    }
    if (inWindow) toRemove.push(row.id);
  }

  let removed = 0;
  if (toRemove.length) {
    const { error: delErr } = await admin
      .from("google_calendar_events")
      .delete()
      .in("id", toRemove);
    if (delErr) {
      console.error("google_calendar_events cleanup", delErr);
    } else {
      removed = toRemove.length;
    }
  }

  // Also explicitly delete cancelled event ids if still present
  const cancelledIds = remote
    .filter((e) => e.status === "cancelled" && e.id)
    .map((e) => String(e.id));
  if (cancelledIds.length) {
    await admin
      .from("google_calendar_events")
      .delete()
      .eq("business_id", businessId)
      .in("google_event_id", cancelledIds);
  }

  await admin
    .from("google_calendar_connections")
    .update({ last_sync_at: syncedAt, updated_at: syncedAt })
    .eq("id", conn.id);

  return {
    ok: true,
    imported: rows.length,
    upserted,
    removed,
    skipped,
    last_sync_at: syncedAt,
    window: { time_min: timeMin, time_max: timeMax },
  };
}

export async function deleteGoogleEventsForBusiness(
  admin: SupabaseClient,
  businessId: string,
) {
  await admin.from("google_calendar_events").delete().eq("business_id", businessId);
}

function mapsSearchUrl(address: string) {
  const addr = String(address || "").trim();
  if (!addr) return "";
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(addr);
}

/** Normalize "09:00", "09:00:00", "9:00 AM" → "HH:MM:SS" or null. */
function normalizeTime24(raw: string | null | undefined): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  const ampm = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = Number(ampm[2]);
    const sec = Number(ampm[3] || 0);
    const ap = ampm[4].toUpperCase();
    if (ap === "PM" && h < 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
  }
  const parts = s.split(":");
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  const sec = parts[2] != null ? Number(parts[2]) : 0;
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return `${pad2(h)}:${pad2(m)}:${pad2(Number.isFinite(sec) ? sec : 0)}`;
}

function buildJobEventBody(job: {
  id: string;
  customer_name?: string | null;
  service_name?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  duration_hours?: number | null;
}, timeZone: string) {
  const date = String(job.scheduled_date || "").slice(0, 10);
  const time = normalizeTime24(job.scheduled_time);
  if (!date || !time) return null;

  const hours = Math.max(0.25, Number(job.duration_hours) || 2);
  const [hh, mm, ss] = time.split(":").map(Number);
  const startMins = hh * 60 + mm;
  const endMins = startMins + Math.round(hours * 60);
  const endH = Math.floor(endMins / 60) % 24;
  const endM = endMins % 60;
  // Multi-day overflow: keep same calendar date for simplicity (rare for jobs)
  const endTime = `${pad2(endH)}:${pad2(endM)}:${pad2(ss || 0)}`;

  const jobName = String(job.service_name || "Job").trim() || "Job";
  const customer = String(job.customer_name || "").trim();
  const phone = String(job.phone || "").trim();
  const address = String(job.address || "").trim();
  const notes = String(job.notes || "").trim();
  const maps = mapsSearchUrl(address);

  const descLines = [
    customer ? `Customer: ${customer}` : "",
    phone ? `Phone: ${phone}` : "",
    address ? `Address: ${address}` : "",
    maps ? `Maps: ${maps}` : "",
    notes ? `Notes:\n${notes}` : "",
    "",
    "Created by Hubly",
  ].filter(Boolean);

  const summary = customer ? `${jobName} — ${customer}` : jobName;

  return {
    summary,
    description: descLines.join("\n"),
    location: address || undefined,
    start: { dateTime: `${date}T${time}`, timeZone },
    end: { dateTime: `${date}T${endTime}`, timeZone },
    extendedProperties: {
      private: { hublyJobId: String(job.id) },
    },
  };
}

export type PushJobResult = {
  ok: true;
  skipped?: boolean;
  reason?: string;
  created?: boolean;
  google_event_id: string | null;
  html_link?: string | null;
};

/**
 * Create a Google Calendar event for a Hubly job.
 * Never duplicates: uses jobs.google_event_id and private hublyJobId property.
 */
export async function pushHublyJobToGoogle(
  admin: SupabaseClient,
  opts: { businessId: string; jobId: string },
): Promise<PushJobResult> {
  const { businessId, jobId } = opts;

  const { data: job, error: jobErr } = await admin
    .from("jobs")
    .select(
      "id,business_id,customer_name,service_name,phone,address,notes,scheduled_date,scheduled_time,duration_hours,google_event_id,status",
    )
    .eq("id", jobId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (jobErr || !job) throw new Error("Job not found");

  if (job.google_event_id) {
    return {
      ok: true,
      skipped: true,
      reason: "already_linked",
      created: false,
      google_event_id: job.google_event_id,
    };
  }

  const { data: conn } = await admin
    .from("google_calendar_connections")
    .select(
      "id,business_id,owner_id,calendar_id,refresh_token,access_token,access_token_expires_at",
    )
    .eq("business_id", businessId)
    .maybeSingle();

  if (!conn?.refresh_token) {
    return {
      ok: true,
      skipped: true,
      reason: "not_connected",
      google_event_id: null,
    };
  }

  const { data: biz } = await admin
    .from("businesses")
    .select("id,timezone")
    .eq("id", businessId)
    .maybeSingle();
  const timeZone = String(biz?.timezone || "America/Denver");

  const body = buildJobEventBody(job, timeZone);
  if (!body) {
    return {
      ok: true,
      skipped: true,
      reason: "missing_schedule",
      google_event_id: null,
    };
  }

  const accessToken = await ensureGoogleAccessToken(admin, conn as GoogleCalendarConnection);
  const calendarId = encodeURIComponent(conn.calendar_id || "primary");

  // Dedupe: event already created but google_event_id never saved
  const findUrl = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
  );
  findUrl.searchParams.set("privateExtendedProperty", `hublyJobId=${jobId}`);
  findUrl.searchParams.set("maxResults", "1");
  findUrl.searchParams.set("showDeleted", "false");

  const findRes = await fetch(findUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const findJson = await findRes.json().catch(() => ({}));
  if (findRes.ok && Array.isArray(findJson.items) && findJson.items[0]?.id) {
    const existingId = String(findJson.items[0].id);
    await admin
      .from("jobs")
      .update({ google_event_id: existingId })
      .eq("id", jobId)
      .eq("business_id", businessId);
    return {
      ok: true,
      skipped: true,
      reason: "found_existing",
      created: false,
      google_event_id: existingId,
      html_link: findJson.items[0].htmlLink || null,
    };
  }

  const createRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  const created = await createRes.json().catch(() => ({}));
  if (!createRes.ok || !created?.id) {
    console.error("calendar.events.insert", created);
    throw new Error(created?.error?.message || "Could not create Google Calendar event");
  }

  const googleEventId = String(created.id);
  const nowIso = new Date().toISOString();
  const { error: updErr } = await admin
    .from("jobs")
    .update({
      google_event_id: googleEventId,
      google_etag: created.etag ? String(created.etag) : null,
      hubly_push_at: nowIso,
    })
    .eq("id", jobId)
    .eq("business_id", businessId);
  if (updErr) {
    console.error("jobs.google_event_id update", updErr);
    // Event exists on Google — still return id so caller can retry store
  }

  return {
    ok: true,
    created: true,
    google_event_id: googleEventId,
    html_link: created.htmlLink || null,
  };
}

export type UpdateJobResult = {
  ok: true;
  skipped?: boolean;
  reason?: string;
  updated?: boolean;
  google_event_id: string | null;
  html_link?: string | null;
};

/**
 * Update an existing Google Calendar event for a Hubly job.
 * Uses jobs.google_event_id only — never creates a new event.
 */
export async function updateHublyJobOnGoogle(
  admin: SupabaseClient,
  opts: { businessId: string; jobId: string },
): Promise<UpdateJobResult> {
  const { businessId, jobId } = opts;

  const { data: job, error: jobErr } = await admin
    .from("jobs")
    .select(
      "id,business_id,customer_name,service_name,phone,address,notes,scheduled_date,scheduled_time,duration_hours,google_event_id,status",
    )
    .eq("id", jobId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (jobErr || !job) throw new Error("Job not found");

  const googleEventId = String(job.google_event_id || "").trim();
  if (!googleEventId) {
    return {
      ok: true,
      skipped: true,
      reason: "no_google_event_id",
      updated: false,
      google_event_id: null,
    };
  }

  const { data: conn } = await admin
    .from("google_calendar_connections")
    .select(
      "id,business_id,owner_id,calendar_id,refresh_token,access_token,access_token_expires_at",
    )
    .eq("business_id", businessId)
    .maybeSingle();

  if (!conn?.refresh_token) {
    return {
      ok: true,
      skipped: true,
      reason: "not_connected",
      updated: false,
      google_event_id: googleEventId,
    };
  }

  const { data: biz } = await admin
    .from("businesses")
    .select("id,timezone")
    .eq("id", businessId)
    .maybeSingle();
  const timeZone = String(biz?.timezone || "America/Denver");

  const body = buildJobEventBody(job, timeZone);
  if (!body) {
    return {
      ok: true,
      skipped: true,
      reason: "missing_schedule",
      updated: false,
      google_event_id: googleEventId,
    };
  }

  const accessToken = await ensureGoogleAccessToken(admin, conn as GoogleCalendarConnection);
  const calendarId = encodeURIComponent(conn.calendar_id || "primary");
  const eventPath = encodeURIComponent(googleEventId);

  const patchRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventPath}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  const patched = await patchRes.json().catch(() => ({}));
  if (!patchRes.ok) {
    console.error("calendar.events.patch", patched);
    // 404 = event deleted on Google — do not create a replacement
    if (patchRes.status === 404) {
      return {
        ok: true,
        skipped: true,
        reason: "event_not_found",
        updated: false,
        google_event_id: googleEventId,
      };
    }
    throw new Error(patched?.error?.message || "Could not update Google Calendar event");
  }

  const nowIso = new Date().toISOString();
  await admin
    .from("jobs")
    .update({
      google_etag: patched.etag ? String(patched.etag) : null,
      hubly_push_at: nowIso,
    })
    .eq("id", jobId)
    .eq("business_id", businessId);

  return {
    ok: true,
    updated: true,
    google_event_id: String(patched.id || googleEventId),
    html_link: patched.htmlLink || null,
  };
}

export type DeleteJobResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  deleted?: boolean;
  google_event_id: string | null;
};

/**
 * Delete the Google Calendar event for a Hubly job.
 * 404 / missing id → skipped ok. Token/API failures → ok:false (caller may retry).
 */
export async function deleteHublyJobOnGoogle(
  admin: SupabaseClient,
  opts: { businessId: string; jobId?: string; googleEventId?: string | null },
): Promise<DeleteJobResult> {
  try {
    const businessId = String(opts.businessId || "").trim();
    const jobId = opts.jobId ? String(opts.jobId).trim() : "";
    let googleEventId = String(opts.googleEventId || "").trim();

    if (!businessId) {
      return { ok: false, skipped: true, reason: "missing_business", google_event_id: null };
    }

    if (!googleEventId && jobId) {
      const { data: job } = await admin
        .from("jobs")
        .select("id,google_event_id")
        .eq("id", jobId)
        .eq("business_id", businessId)
        .maybeSingle();
      googleEventId = String(job?.google_event_id || "").trim();
    }

    if (!googleEventId) {
      return { ok: true, skipped: true, reason: "no_google_event_id", google_event_id: null };
    }

    const { data: conn } = await admin
      .from("google_calendar_connections")
      .select(
        "id,business_id,owner_id,calendar_id,refresh_token,access_token,access_token_expires_at",
      )
      .eq("business_id", businessId)
      .maybeSingle();

    if (!conn?.refresh_token) {
      return {
        ok: true,
        skipped: true,
        reason: "not_connected",
        google_event_id: googleEventId,
      };
    }

    let accessToken: string;
    try {
      accessToken = await ensureGoogleAccessToken(admin, conn as GoogleCalendarConnection);
    } catch (e) {
      console.warn("deleteHublyJobOnGoogle token", e);
      return {
        ok: false,
        skipped: true,
        reason: "token_error",
        google_event_id: googleEventId,
      };
    }

    const calendarId = encodeURIComponent(conn.calendar_id || "primary");
    const eventPath = encodeURIComponent(googleEventId);

    const delRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventPath}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    // 204 success, 404 already gone — both fine
    if (!delRes.ok && delRes.status !== 404) {
      const errBody = await delRes.json().catch(() => ({}));
      console.warn("calendar.events.delete", delRes.status, errBody?.error?.message);
      return {
        ok: false,
        skipped: true,
        reason: "google_error",
        google_event_id: googleEventId,
      };
    }

    if (jobId) {
      try {
        await admin
          .from("jobs")
          .update({ google_event_id: null })
          .eq("id", jobId)
          .eq("business_id", businessId);
      } catch (e) {
        console.warn("clear google_event_id", e);
      }
    }

    return {
      ok: true,
      deleted: delRes.status !== 404,
      google_event_id: googleEventId,
    };
  } catch (e) {
    console.warn("deleteHublyJobOnGoogle", e);
    return {
      ok: false,
      skipped: true,
      reason: (e as Error)?.message || "delete_error",
      google_event_id: opts.googleEventId ? String(opts.googleEventId) : null,
    };
  }
}
