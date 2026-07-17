// Status + disconnect for the owner's Google Calendar connection.
// Never returns refresh_token or access_token to the client.
// POST body: { action: "status" | "disconnect" | "request_access", business_id }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { deleteGoogleEventsForBusiness } from "../_shared/google_calendar_sync.ts";
import { stopGoogleCalendarWatch } from "../_shared/google_calendar_inbound.ts";
import { googleCalendarAccessForEmail } from "../_shared/google_calendar_security.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return jsonRes({ error: "POST required" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return jsonRes({ error: "Sign in required" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return jsonRes({ error: "Auth isn’t configured on the server yet." }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "status").trim().toLowerCase();
    const businessId = String(body?.business_id || "").trim();
    if (!businessId) return jsonRes({ error: "business_id required" }, 400);
    if (action !== "status" && action !== "disconnect" && action !== "request_access") {
      return jsonRes({ error: "action must be status, disconnect, or request_access" }, 400);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonRes({ error: "Your session expired — refresh and try again." }, 401);
    }
    const user = userData.user;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: biz, error: bizErr } = await admin
      .from("businesses")
      .select("id,owner_id")
      .eq("id", businessId)
      .maybeSingle();
    if (bizErr || !biz || biz.owner_id !== user.id) {
      return jsonRes({ error: "Business not found" }, 404);
    }

    const access = googleCalendarAccessForEmail(user.email);
    const accessMeta = {
      access_mode: access.mode,
      can_connect: access.allowed,
      early_access: access.mode === "testing",
    };

    if (action === "request_access") {
      const notifyTo =
        (Deno.env.get("GOOGLE_CALENDAR_ACCESS_NOTIFY_EMAIL") || "").trim() ||
        (Deno.env.get("RESEND_FROM_EMAIL") || "").trim();
      const resendKey = (Deno.env.get("RESEND_API_KEY") || "").trim();
      const ownerEmail = String(user.email || "").trim();
      console.log("gcal early access request", {
        business_id: businessId,
        owner_id: user.id,
        owner_email: ownerEmail,
      });
      if (resendKey && notifyTo && ownerEmail) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              from: Deno.env.get("RESEND_FROM_EMAIL") || notifyTo,
              to: [notifyTo],
              subject: `Google Calendar early access: ${ownerEmail}`,
              text: `Hubly owner requested Google Calendar early access.\n\nEmail: ${ownerEmail}\nUser id: ${user.id}\nBusiness id: ${businessId}\n\nAdd them under Google Cloud → OAuth consent → Test users, and to GOOGLE_CALENDAR_TEST_USERS.`,
            }),
          });
        } catch (e) {
          console.warn("early access notify email", e);
        }
      }
      return jsonRes({
        ok: true,
        requested: true,
        ...accessMeta,
        message: access.allowed
          ? "You’re already on the early-access list — tap Connect Google Calendar."
          : "You’re on the list. We’ll unlock Connect for your account as soon as Google clears you.",
      });
    }

    const { data: conn } = await admin
      .from("google_calendar_connections")
      .select(
        action === "disconnect"
          ? "id,google_user_id,google_email,google_picture_url,calendar_id,calendar_summary,connected_at,last_sync_at,last_inbound_at,watch_expiration,refresh_token"
          : "id,google_user_id,google_email,google_picture_url,calendar_id,calendar_summary,connected_at,last_sync_at,last_inbound_at,watch_expiration,last_error",
      )
      .eq("business_id", businessId)
      .maybeSingle();

    if (action === "status") {
      if (!conn) {
        return jsonRes({
          ok: true,
          connected: false,
          google_user_id: null,
          google_email: null,
          google_picture_url: null,
          calendar_id: null,
          calendar_name: null,
          connected_at: null,
          last_sync_at: null,
          last_inbound_at: null,
          watch_active: false,
          last_error: null,
          ...accessMeta,
        });
      }
      const calId = String(conn.calendar_id || "primary");
      const calendarName =
        String(conn.calendar_summary || "").trim() ||
        (calId === "primary" || calId.includes("@") ? "Primary calendar" : calId);
      const watchActive = !!(
        conn.watch_expiration &&
        new Date(conn.watch_expiration).getTime() > Date.now()
      );
      return jsonRes({
        ok: true,
        connected: true,
        google_user_id: conn.google_user_id,
        google_email: conn.google_email,
        google_picture_url: conn.google_picture_url || null,
        calendar_id: conn.calendar_id,
        calendar_name: calendarName,
        connected_at: conn.connected_at,
        last_sync_at: conn.last_sync_at,
        last_inbound_at: conn.last_inbound_at || null,
        watch_active: watchActive,
        last_error: conn.last_error || null,
        ...accessMeta,
      });
    }

    // disconnect
    try {
      await stopGoogleCalendarWatch(admin, { businessId });
    } catch (e) {
      console.warn("stop watch on disconnect", e);
    }
    if (conn?.refresh_token) {
      try {
        await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: conn.refresh_token }),
        });
      } catch (e) {
        console.warn("revoke token", e);
      }
    }
    if (conn?.id) {
      const { error: delErr } = await admin
        .from("google_calendar_connections")
        .delete()
        .eq("id", conn.id)
        .eq("owner_id", user.id);
      if (delErr) {
        console.error("disconnect delete", delErr);
        return jsonRes({ error: "Could not disconnect" }, 500);
      }
    }
    await deleteGoogleEventsForBusiness(admin, businessId);

    return jsonRes({
      ok: true,
      connected: false,
      google_user_id: null,
      google_email: null,
      google_picture_url: null,
      calendar_id: null,
      calendar_name: null,
      connected_at: null,
      last_sync_at: null,
      last_inbound_at: null,
      watch_active: false,
      last_error: null,
      ...accessMeta,
    });
  } catch (e) {
    console.error("google-calendar-connection", e);
    return jsonRes({ error: (e as Error)?.message || "Could not load calendar connection" }, 500);
  }
});
