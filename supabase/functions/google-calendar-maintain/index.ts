/**
 * Maintenance worker for Google Calendar at scale.
 * Auth: Authorization: Bearer <service role> OR header x-hubly-cron-secret == HUBLY_CRON_SECRET
 *
 * Jobs:
 * 1) Delete expired OAuth CSRF states
 * 2) Renew watches expiring within 24h (batched)
 * 3) Poll stale connections (no inbound in 6h) as webhook fallback
 *
 * Schedule via Supabase cron / external scheduler every 15–30 minutes.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ensureGoogleCalendarWatch,
  processInboundGoogleSync,
} from "../_shared/google_calendar_inbound.ts";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return jsonRes({ error: "POST required" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS");
    if (!supabaseUrl || !serviceKey) {
      return jsonRes({ error: "Server misconfigured" }, 500);
    }
    if (!authorized(req, serviceKey)) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const renewLimit = Math.min(Number(body?.renew_limit) || 40, 100);
    const pollLimit = Math.min(Number(body?.poll_limit) || 25, 80);
    const staleHours = Math.min(Math.max(Number(body?.stale_hours) || 6, 1), 48);

    const admin = createClient(supabaseUrl, serviceKey);
    const now = Date.now();

    // 1) CSRF state cleanup
    const { count: statesDeleted } = await admin
      .from("google_calendar_oauth_states")
      .delete({ count: "exact" })
      .lt("expires_at", new Date(now).toISOString());

    // 2) Renew watches
    const renewBefore = new Date(now + 24 * 60 * 60 * 1000).toISOString();
    const { data: renewRows } = await admin
      .from("google_calendar_connections")
      .select("business_id,watch_expiration,watch_channel_token")
      .or(
        `watch_channel_id.is.null,watch_channel_token.is.null,watch_expiration.is.null,watch_expiration.lt.${renewBefore}`,
      )
      .limit(renewLimit);

    let renewed = 0;
    let renewFailed = 0;
    for (const row of renewRows || []) {
      try {
        const r = await ensureGoogleCalendarWatch(admin, {
          businessId: row.business_id,
          supabaseUrl,
        });
        if (r.ok && r.renewed) renewed++;
        else if (!r.ok) renewFailed++;
      } catch (_) {
        renewFailed++;
      }
    }

    // 3) Poll stale tenants (webhook fallback)
    const staleBefore = new Date(now - staleHours * 60 * 60 * 1000).toISOString();
    const { data: staleRows } = await admin
      .from("google_calendar_connections")
      .select("business_id,last_inbound_at")
      .or(`last_inbound_at.is.null,last_inbound_at.lt.${staleBefore}`)
      .order("last_inbound_at", { ascending: true, nullsFirst: true })
      .limit(pollLimit);

    let polled = 0;
    let pollSkippedLocked = 0;
    for (const row of staleRows || []) {
      try {
        const inbound = await processInboundGoogleSync(admin, {
          businessId: row.business_id,
        });
        if (inbound.locked) pollSkippedLocked++;
        else polled++;
      } catch (e) {
        console.warn("maintain poll", row.business_id, e);
      }
    }

    return jsonRes({
      ok: true,
      oauth_states_deleted: statesDeleted ?? 0,
      watches_renewed: renewed,
      watches_failed: renewFailed,
      inbound_polled: polled,
      inbound_locked: pollSkippedLocked,
    });
  } catch (e) {
    console.error("google-calendar-maintain", e);
    return jsonRes({ error: (e as Error)?.message || "Maintain failed" }, 500);
  }
});
