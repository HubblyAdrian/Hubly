// Google OAuth redirect target. Exchanges code for tokens, stores them, redirects to Hubly.
// Must be registered as an Authorized redirect URI in Google Cloud Console.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { syncGoogleCalendarForBusiness } from "../_shared/google_calendar_sync.ts";
import {
  processInboundGoogleSync,
  registerGoogleCalendarWatch,
} from "../_shared/google_calendar_inbound.ts";
import { appBaseUrl, sanitizeReturnTo } from "../_shared/google_calendar_security.ts";

function redirectUri(supabaseUrl: string) {
  const override = Deno.env.get("GOOGLE_OAUTH_REDIRECT_URI")?.trim();
  if (override) return override;
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/google-calendar-oauth-callback`;
}

function redirectTo(returnTo: string, params: Record<string, string>) {
  const safe = sanitizeReturnTo(returnTo, appBaseUrl());
  let target: URL;
  try {
    target = new URL(safe);
  } catch {
    target = new URL(appBaseUrl());
  }
  for (const [k, v] of Object.entries(params)) {
    target.searchParams.set(k, v);
  }
  if (!target.pathname || target.pathname === "/") {
    target.pathname = "/app";
  }
  return Response.redirect(target.toString(), 302);
}

Deno.serve(async (req: Request) => {
  const fallback = appBaseUrl() + "/app";

  try {
    if (req.method !== "GET") {
      return new Response("GET required", { status: 405 });
    }

    const url = new URL(req.url);
    const err = url.searchParams.get("error");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS");
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")?.trim();
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")?.trim();

    if (!supabaseUrl || !serviceKey || !clientId || !clientSecret) {
      return redirectTo(fallback, {
        gcal_oauth: "error",
        gcal_msg: "Google Calendar isn’t configured on the server",
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    if (err) {
      return redirectTo(fallback, {
        gcal_oauth: "error",
        gcal_msg: err === "access_denied"
          ? "access_denied — add your Google account as an OAuth test user in Google Cloud Console"
          : `Google error: ${err}`,
      });
    }
    if (!code || !state) {
      return redirectTo(fallback, {
        gcal_oauth: "error",
        gcal_msg: "Missing authorization code",
      });
    }

    const { data: row, error: stateErr } = await admin
      .from("google_calendar_oauth_states")
      .select("*")
      .eq("state", state)
      .maybeSingle();

    // One-time use
    if (row?.id) {
      await admin.from("google_calendar_oauth_states").delete().eq("id", row.id);
    }

    if (stateErr || !row) {
      return redirectTo(fallback, {
        gcal_oauth: "error",
        gcal_msg: "Sign-in expired — try Connect again",
      });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return redirectTo(sanitizeReturnTo(row.return_to, fallback), {
        gcal_oauth: "error",
        gcal_msg: "Sign-in expired — try Connect again",
      });
    }

    const safeReturn = sanitizeReturnTo(row.return_to, fallback);

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri(supabaseUrl),
        grant_type: "authorization_code",
      }),
    });
    const tokenJson = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson.access_token) {
      console.error("oauth token exchange", tokenJson?.error);
      return redirectTo(safeReturn, {
        gcal_oauth: "error",
        gcal_msg: "Could not complete Google sign-in",
      });
    }

    const accessToken = String(tokenJson.access_token);
    const refreshToken = tokenJson.refresh_token ? String(tokenJson.refresh_token) : "";
    const expiresIn = Number(tokenJson.expires_in) || 3600;

    let googleUserId = "";
    let googleEmail = "";
    let googlePictureUrl = "";
    const userInfoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (userInfoRes.ok) {
      const info = await userInfoRes.json().catch(() => ({}));
      googleUserId = String(info.sub || "");
      googleEmail = String(info.email || "").toLowerCase();
      googlePictureUrl = String(info.picture || "").trim();
    }

    let calendarId = "primary";
    let calendarSummary = "Primary calendar";
    const calRes = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList/primary",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (calRes.ok) {
      const cal = await calRes.json().catch(() => ({}));
      if (cal?.id) calendarId = String(cal.id);
      if (cal?.summary) calendarSummary = String(cal.summary);
      if (!googleEmail && typeof cal?.id === "string" && cal.id.includes("@")) {
        googleEmail = String(cal.id).toLowerCase();
      }
    }

    // No access_token in query strings — userinfo only
    if (!googleUserId) {
      return redirectTo(safeReturn, {
        gcal_oauth: "error",
        gcal_msg: "Could not identify your Google account",
      });
    }

    let refresh = refreshToken;
    if (!refresh) {
      const { data: existing } = await admin
        .from("google_calendar_connections")
        .select("refresh_token")
        .eq("business_id", row.business_id)
        .maybeSingle();
      refresh = String(existing?.refresh_token || "");
    }
    if (!refresh) {
      return redirectTo(safeReturn, {
        gcal_oauth: "error",
        gcal_msg:
          "Google did not return a refresh token — disconnect in Google Account permissions and try again",
      });
    }

    const now = new Date();
    const payload = {
      business_id: row.business_id,
      owner_id: row.owner_id,
      google_user_id: googleUserId,
      google_email: googleEmail || null,
      google_picture_url: googlePictureUrl || null,
      calendar_id: calendarId,
      calendar_summary: calendarSummary || null,
      refresh_token: refresh,
      access_token: accessToken,
      access_token_expires_at: new Date(now.getTime() + expiresIn * 1000).toISOString(),
      connected_at: now.toISOString(),
      last_error: null,
      updated_at: now.toISOString(),
    };

    const { error: upsertErr } = await admin
      .from("google_calendar_connections")
      .upsert(payload, { onConflict: "business_id" });

    if (upsertErr) {
      console.error("upsert connection", upsertErr);
      return redirectTo(safeReturn, {
        gcal_oauth: "error",
        gcal_msg: "Could not save Google Calendar connection",
      });
    }

    try {
      await syncGoogleCalendarForBusiness(admin, { businessId: row.business_id });
    } catch (syncErr) {
      console.warn("post-connect sync", syncErr);
    }
    try {
      await processInboundGoogleSync(admin, { businessId: row.business_id });
    } catch (inErr) {
      console.warn("post-connect inbound", inErr);
    }
    try {
      await registerGoogleCalendarWatch(admin, {
        businessId: row.business_id,
        supabaseUrl,
      });
    } catch (watchErr) {
      console.warn("post-connect watch", watchErr);
    }

    await admin
      .from("google_calendar_oauth_states")
      .delete()
      .lt("expires_at", now.toISOString());

    return redirectTo(safeReturn, {
      gcal_oauth: "connected",
      gcal_msg: googleEmail || "Google Calendar connected",
    });
  } catch (e) {
    console.error("google-calendar-oauth-callback", e);
    return redirectTo(fallback, {
      gcal_oauth: "error",
      gcal_msg: "Something went wrong connecting Google Calendar",
    });
  }
});
