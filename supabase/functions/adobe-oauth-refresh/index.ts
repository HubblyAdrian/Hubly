/**
 * Adobe Lightroom OAuth — refresh access token.
 * Same auth + ownership checks as adobe-oauth-disconnect action "refresh".
 * Never returns tokens to the browser.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
// Supabase key resolution goes through _shared/supabase_admin.ts. It THROWS on a
// missing key instead of continuing with "" (nine call sites used to 401 quietly
// and be logged), reads the plural SUPABASE_PUBLISHABLE_KEYS the platform
// actually injects rather than the singular name that is set nowhere, and never
// sends a non-JWT sb_secret_ key as a Bearer token -- PostgREST rejects those as
// "Invalid JWT", which looks exactly like the empty-key 401 in a log.
import { createAdminClient, createUserClient } from "../_shared/supabase_admin.ts";
  adobeConfigured,
  refreshAdobeAccessToken,
} from "../_shared/adobe_oauth.ts";

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
    if (!supabaseUrl) {
      return jsonRes({ error: "Auth isn’t configured on the server yet." }, 500);
    }

    if (!adobeConfigured()) {
      return jsonRes({
        ok: false,
        error: "Provider not configured. Add ADOBE_CLIENT_ID and ADOBE_CLIENT_SECRET.",
        code: "PROVIDER_NOT_CONFIGURED",
      }, 503);
    }

    const body = await req.json().catch(() => ({}));
    const businessId = String(body?.business_id || body?.businessId || "").trim();
    if (!businessId) return jsonRes({ error: "business_id required" }, 400);

    const userClient = createUserClient(authHeader);
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonRes({ error: "Your session expired — refresh and try again." }, 401);
    }
    const user = userData.user;

    const admin = createAdminClient();
    const { data: biz, error: bizErr } = await admin
      .from("businesses")
      .select("id,owner_id")
      .eq("id", businessId)
      .maybeSingle();
    if (bizErr || !biz || biz.owner_id !== user.id) {
      return jsonRes({ error: "Business not found" }, 404);
    }

    const { data: conn } = await admin
      .from("adobe_lightroom_connections")
      .select("refresh_token")
      .eq("business_id", businessId)
      .maybeSingle();

    if (!conn?.refresh_token) {
      return jsonRes({
        ok: false,
        error: "No Adobe refresh token — reconnect Adobe Lightroom.",
      }, 400);
    }

    const refreshed = await refreshAdobeAccessToken({ refreshToken: conn.refresh_token });
    if (!refreshed.ok) {
      await admin.from("adobe_lightroom_connections").update({
        last_error: refreshed.error,
        updated_at: new Date().toISOString(),
      }).eq("business_id", businessId);
      return jsonRes({ ok: false, error: refreshed.error }, 400);
    }

    const expiresAt = new Date(
      Date.now() + (refreshed.data.expires_in || 3600) * 1000,
    ).toISOString();
    await admin.from("adobe_lightroom_connections").update({
      access_token: refreshed.data.access_token,
      refresh_token: refreshed.data.refresh_token || conn.refresh_token,
      access_token_expires_at: expiresAt,
      last_token_refresh_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    }).eq("business_id", businessId);

    return jsonRes({ ok: true, expires_at: expiresAt });
  } catch (e) {
    console.error("[adobe-oauth-refresh]", e);
    return jsonRes({ error: (e as Error)?.message || "Could not refresh Adobe token" }, 500);
  }
});
