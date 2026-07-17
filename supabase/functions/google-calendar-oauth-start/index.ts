// Start Google Calendar OAuth for the signed-in business owner.
// Returns { url } — the browser should navigate there.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { randomSecret, sanitizeReturnTo } from "../_shared/google_calendar_security.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Least-privilege Calendar scopes + identity for Connections UI. */
const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

function redirectUri(supabaseUrl: string) {
  const override = Deno.env.get("GOOGLE_OAUTH_REDIRECT_URI")?.trim();
  if (override) return override;
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/google-calendar-oauth-callback`;
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
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")?.trim();
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")?.trim();

    if (!supabaseUrl || !serviceKey || !anonKey) {
      return jsonRes({ error: "Auth isn’t configured on the server yet." }, 500);
    }
    if (!clientId || !clientSecret) {
      return jsonRes({
        error: "Google Calendar isn’t configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
      }, 503);
    }

    const body = await req.json().catch(() => ({}));
    const businessId = String(body?.business_id || "").trim();
    if (!businessId) return jsonRes({ error: "business_id required" }, 400);

    const returnTo = sanitizeReturnTo(body?.return_to);

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

    const state = randomSecret(32);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error: stateErr } = await admin.from("google_calendar_oauth_states").insert({
      state,
      owner_id: user.id,
      business_id: businessId,
      return_to: returnTo,
      expires_at: expiresAt,
    });
    if (stateErr) {
      console.error("oauth state insert", stateErr);
      return jsonRes({ error: "Could not start Google sign-in" }, 500);
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri(supabaseUrl),
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "false",
      state,
    });

    return jsonRes({
      ok: true,
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    });
  } catch (e) {
    console.error("google-calendar-oauth-start", e);
    return jsonRes({ error: (e as Error)?.message || "Could not start Google sign-in" }, 500);
  }
});
