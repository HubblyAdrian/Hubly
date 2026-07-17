// Google → Hubly inbound sync: authenticated webhooks + polling.
// Single-flight locks + Sync Engine conflict resolution.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ensureGoogleAccessToken,
  type GoogleCalendarConnection,
} from "./google_calendar_sync.ts";
import {
  syncEngineApplyGoogleEvent,
  type GCalEvent,
} from "./google_calendar_sync_engine.ts";
import { randomSecret, timingSafeEqual } from "./google_calendar_security.ts";

function webhookAddress(supabaseUrl: string) {
  const override = Deno.env.get("GOOGLE_CALENDAR_WEBHOOK_URL")?.trim();
  if (override) return override;
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/google-calendar-webhook`;
}

export type InboundApplyResult = {
  updated: number;
  cancelled: number;
  skipped: number;
  pushed_hubly?: number;
  locked?: boolean;
};

async function acquireSyncLock(admin: SupabaseClient, businessId: string, ttl = 45) {
  const { data, error } = await admin.rpc("try_acquire_gcal_sync_lock", {
    p_business_id: businessId,
    p_ttl_seconds: ttl,
  });
  if (error) {
    console.warn("try_acquire_gcal_sync_lock", error);
    // Fail open only if RPC missing (pre-migration); otherwise deny.
    if (/does not exist|Could not find/i.test(String(error.message || ""))) return true;
    return false;
  }
  return !!data;
}

async function releaseSyncLock(admin: SupabaseClient, businessId: string) {
  try {
    await admin.rpc("release_gcal_sync_lock", { p_business_id: businessId });
  } catch (e) {
    console.warn("release_gcal_sync_lock", e);
  }
}

export async function tryWebhookDebounce(
  admin: SupabaseClient,
  businessId: string,
  minSeconds = 15,
): Promise<boolean> {
  const { data, error } = await admin.rpc("try_gcal_webhook_debounce", {
    p_business_id: businessId,
    p_min_seconds: minSeconds,
  });
  if (error) {
    console.warn("try_gcal_webhook_debounce", error);
    return true;
  }
  return !!data;
}

async function listEventsPage(
  accessToken: string,
  calendarId: string,
  params: URLSearchParams,
): Promise<{ items: GCalEvent[]; nextPageToken?: string; nextSyncToken?: string; reset?: boolean }> {
  const cal = encodeURIComponent(calendarId || "primary");
  const url = `https://www.googleapis.com/calendar/v3/calendars/${cal}/events?${params}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const json = await res.json().catch(() => ({}));
  if (res.status === 410) return { items: [], reset: true };
  if (!res.ok) {
    console.error("inbound events.list", json?.error?.message || res.status);
    throw new Error(json?.error?.message || "Could not list Google Calendar changes");
  }
  return {
    items: Array.isArray(json.items) ? json.items : [],
    nextPageToken: json.nextPageToken,
    nextSyncToken: json.nextSyncToken,
  };
}

const MAX_INBOUND_PAGES = 20;

/**
 * Incremental (or initial) Google → Hubly job sync via Sync Engine.
 * Never creates jobs. Personal events are skipped (import path owns them).
 */
export async function processInboundGoogleSync(
  admin: SupabaseClient,
  opts: { businessId: string; force?: boolean },
): Promise<InboundApplyResult & { ok: true; sync_token?: string | null }> {
  const businessId = opts.businessId;

  const locked = await acquireSyncLock(admin, businessId, 45);
  if (!locked && !opts.force) {
    return { ok: true, updated: 0, cancelled: 0, skipped: 0, pushed_hubly: 0, locked: true };
  }

  try {
    const { data: conn, error: connErr } = await admin
      .from("google_calendar_connections")
      .select(
        "id,business_id,owner_id,calendar_id,refresh_token,access_token,access_token_expires_at,sync_token",
      )
      .eq("business_id", businessId)
      .maybeSingle();

    if (connErr || !conn?.refresh_token) {
      return { ok: true, updated: 0, cancelled: 0, skipped: 0, pushed_hubly: 0 };
    }

    const { data: biz } = await admin
      .from("businesses")
      .select("id,timezone")
      .eq("id", businessId)
      .maybeSingle();
    const businessTz = String(biz?.timezone || "America/Denver");
    const accessToken = await ensureGoogleAccessToken(admin, conn as GoogleCalendarConnection);
    const calendarId = conn.calendar_id || "primary";

    let syncToken = conn.sync_token || null;

    const runList = async (useToken: string | null) => {
      const all: GCalEvent[] = [];
      let pageToken: string | undefined;
      let tokenOut: string | null = null;
      let pages = 0;
      do {
        pages++;
        if (pages > MAX_INBOUND_PAGES) break;
        const params = new URLSearchParams();
        params.set("maxResults", "250");
        if (useToken) {
          params.set("syncToken", useToken);
        } else {
          params.set("showDeleted", "true");
          params.set("singleEvents", "true");
          const now = Date.now();
          params.set("timeMin", new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString());
          params.set("timeMax", new Date(now + 90 * 24 * 60 * 60 * 1000).toISOString());
          params.set("orderBy", "startTime");
        }
        if (pageToken) params.set("pageToken", pageToken);
        const page = await listEventsPage(accessToken, calendarId, params);
        if (page.reset) return { reset: true as const, items: [] as GCalEvent[], nextSyncToken: null };
        all.push(...page.items);
        pageToken = page.nextPageToken;
        if (page.nextSyncToken) tokenOut = page.nextSyncToken;
      } while (pageToken);
      return { reset: false as const, items: all, nextSyncToken: tokenOut };
    };

    let result = await runList(syncToken);
    if (result.reset) {
      syncToken = null;
      await admin
        .from("google_calendar_connections")
        .update({ sync_token: null, updated_at: new Date().toISOString() })
        .eq("id", conn.id);
      result = await runList(null);
    }

    let updated = 0;
    let cancelled = 0;
    let skipped = 0;
    let pushed_hubly = 0;

    for (const ev of result.items) {
      try {
        const outcome = await syncEngineApplyGoogleEvent(admin, {
          businessId,
          event: ev,
          businessTz,
        });
        if (outcome === "updated") updated++;
        else if (outcome === "cancelled") cancelled++;
        else if (outcome === "pushed_hubly") pushed_hubly++;
        else skipped++;
      } catch (e) {
        console.warn("syncEngineApplyGoogleEvent", e);
        skipped++;
      }
    }

    const nextSyncToken = result.nextSyncToken || syncToken;
    const nowIso = new Date().toISOString();
    await admin
      .from("google_calendar_connections")
      .update({
        sync_token: nextSyncToken,
        last_inbound_at: nowIso,
        last_error: null,
        updated_at: nowIso,
      })
      .eq("id", conn.id);

    return { ok: true, updated, cancelled, skipped, pushed_hubly, sync_token: nextSyncToken };
  } catch (e) {
    const msg = (e as Error)?.message || "inbound_sync_failed";
    try {
      await admin
        .from("google_calendar_connections")
        .update({ last_error: msg.slice(0, 500), updated_at: new Date().toISOString() })
        .eq("business_id", businessId);
    } catch (_) {
      /* ignore */
    }
    throw e;
  } finally {
    if (locked || opts.force) await releaseSyncLock(admin, businessId);
  }
}

export async function registerGoogleCalendarWatch(
  admin: SupabaseClient,
  opts: { businessId: string; supabaseUrl: string },
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { data: conn } = await admin
      .from("google_calendar_connections")
      .select(
        "id,business_id,owner_id,calendar_id,refresh_token,access_token,access_token_expires_at,watch_channel_id,watch_resource_id",
      )
      .eq("business_id", opts.businessId)
      .maybeSingle();
    if (!conn?.refresh_token) return { ok: false, reason: "not_connected" };

    if (conn.watch_channel_id && conn.watch_resource_id) {
      try {
        await stopGoogleCalendarWatch(admin, {
          businessId: opts.businessId,
          soft: true,
        });
      } catch (_) {
        /* ignore */
      }
    }

    const accessToken = await ensureGoogleAccessToken(admin, conn as GoogleCalendarConnection);
    const calendarId = encodeURIComponent(conn.calendar_id || "primary");
    const channelId = `hubly-${crypto.randomUUID()}`;
    const channelToken = randomSecret(32);
    const expiration = String(Date.now() + 6 * 24 * 60 * 60 * 1000);

    const watchRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/watch`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          id: channelId,
          type: "web_hook",
          address: webhookAddress(opts.supabaseUrl),
          token: channelToken,
          expiration,
        }),
      },
    );
    const watchJson = await watchRes.json().catch(() => ({}));
    if (!watchRes.ok) {
      console.warn("events.watch failed (polling still works)", watchJson?.error?.message);
      await admin
        .from("google_calendar_connections")
        .update({
          last_error: String(watchJson?.error?.message || "watch_failed").slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", conn.id);
      return { ok: false, reason: watchJson?.error?.message || "watch_failed" };
    }

    await admin
      .from("google_calendar_connections")
      .update({
        watch_channel_id: String(watchJson.id || channelId),
        watch_resource_id: String(watchJson.resourceId || ""),
        watch_channel_token: channelToken,
        watch_expiration: watchJson.expiration
          ? new Date(Number(watchJson.expiration)).toISOString()
          : new Date(Number(expiration)).toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conn.id);

    return { ok: true };
  } catch (e) {
    console.warn("registerGoogleCalendarWatch", e);
    return { ok: false, reason: (e as Error)?.message || "watch_error" };
  }
}

export async function stopGoogleCalendarWatch(
  admin: SupabaseClient,
  opts: { businessId: string; soft?: boolean },
): Promise<void> {
  const { data: conn } = await admin
    .from("google_calendar_connections")
    .select(
      "id,refresh_token,access_token,access_token_expires_at,watch_channel_id,watch_resource_id,owner_id,business_id,calendar_id",
    )
    .eq("business_id", opts.businessId)
    .maybeSingle();
  if (!conn?.watch_channel_id || !conn?.watch_resource_id) {
    if (!opts.soft && conn?.id) {
      await admin
        .from("google_calendar_connections")
        .update({
          watch_channel_id: null,
          watch_resource_id: null,
          watch_channel_token: null,
          watch_expiration: null,
          sync_token: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conn.id);
    }
    return;
  }

  try {
    if (conn.refresh_token) {
      const accessToken = await ensureGoogleAccessToken(admin, conn as GoogleCalendarConnection);
      await fetch("https://www.googleapis.com/calendar/v3/channels/stop", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          id: conn.watch_channel_id,
          resourceId: conn.watch_resource_id,
        }),
      });
    }
  } catch (e) {
    console.warn("channels.stop", e);
  }

  await admin
    .from("google_calendar_connections")
    .update({
      watch_channel_id: null,
      watch_resource_id: null,
      watch_channel_token: null,
      watch_expiration: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id);
}

/** Renew watch if missing or expiring within 24h. */
export async function ensureGoogleCalendarWatch(
  admin: SupabaseClient,
  opts: { businessId: string; supabaseUrl: string },
) {
  const { data: conn } = await admin
    .from("google_calendar_connections")
    .select("watch_channel_id,watch_expiration,watch_channel_token")
    .eq("business_id", opts.businessId)
    .maybeSingle();
  const exp = conn?.watch_expiration ? new Date(conn.watch_expiration).getTime() : 0;
  const needsSecret = !conn?.watch_channel_token;
  const needs = needsSecret || !conn?.watch_channel_id || !exp ||
    exp < Date.now() + 24 * 60 * 60 * 1000;
  if (!needs) return { ok: true, renewed: false };
  const reg = await registerGoogleCalendarWatch(admin, opts);
  return { ...reg, renewed: true };
}

/**
 * Look up an active watch channel by Google headers.
 * Requires channel id + token + resource id to match.
 */
export async function resolveWatchChannel(
  admin: SupabaseClient,
  headers: {
    channelId: string;
    channelToken: string;
    resourceId: string;
  },
): Promise<{ business_id: string } | null> {
  const channelId = String(headers.channelId || "").trim();
  const channelToken = String(headers.channelToken || "").trim();
  const resourceId = String(headers.resourceId || "").trim();
  if (!channelId || !channelToken || !resourceId) return null;

  const { data: conn } = await admin
    .from("google_calendar_connections")
    .select("business_id,watch_channel_id,watch_channel_token,watch_resource_id")
    .eq("watch_channel_id", channelId)
    .maybeSingle();

  if (!conn?.business_id) return null;
  if (String(conn.watch_resource_id || "") !== resourceId) return null;
  if (!timingSafeEqual(String(conn.watch_channel_token || ""), channelToken)) return null;

  return { business_id: String(conn.business_id) };
}
