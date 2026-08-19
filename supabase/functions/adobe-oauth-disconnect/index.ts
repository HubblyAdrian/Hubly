// Status + disconnect for Adobe Lightroom Connected App.
// Never returns refresh_token or access_token to the client.
// POST body: { action: "status" | "disconnect" | "refresh", business_id }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ADOBE_PROVIDER_ID,
  adobeConfigured,
  refreshAdobeAccessToken,
  revokeAdobeToken,
} from "../_shared/adobe_oauth.ts";
// Supabase key resolution goes through _shared/supabase_admin.ts. It THROWS on a
// missing key instead of continuing with "" (nine call sites used to 401 quietly
// and be logged), reads the plural SUPABASE_PUBLISHABLE_KEYS the platform
// actually injects rather than the singular name that is set nowhere, and never
// sends a non-JWT sb_secret_ key as a Bearer token -- PostgREST rejects those as
// "Invalid JWT", which looks exactly like the empty-key 401 in a log.
import { createAdminClient, createUserClient } from "../_shared/supabase_admin.ts";

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

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "status").trim().toLowerCase();
    const businessId = String(body?.business_id || body?.businessId || "").trim();
    if (!businessId) return jsonRes({ error: "business_id required" }, 400);
    if (action !== "status" && action !== "disconnect" && action !== "refresh") {
      return jsonRes({ error: "action must be status, disconnect, or refresh" }, 400);
    }

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

    if (!adobeConfigured()) {
      return jsonRes({
        ok: true,
        configured: false,
        connected: false,
        health: "not_configured",
        message: "Provider not configured. Add ADOBE_CLIENT_ID and ADOBE_CLIENT_SECRET.",
      });
    }

    const { data: conn } = await admin
      .from("adobe_lightroom_connections")
      .select(
        "adobe_user_id,adobe_email,adobe_display_name,connected_at,last_sync_at,access_token_expires_at,refresh_token,access_token,last_error",
      )
      .eq("business_id", businessId)
      .maybeSingle();

    if (action === "status") {
      return jsonRes({
        ok: true,
        configured: true,
        connected: !!conn,
        health: conn ? "healthy" : "disconnected",
        account_label: conn?.adobe_email || conn?.adobe_display_name || null,
        adobe_account: conn?.adobe_email || conn?.adobe_display_name || null,
        adobe_user_id: conn?.adobe_user_id || null,
        connected_at: conn?.connected_at || null,
        last_sync_at: conn?.last_sync_at || null,
        token_expires_at: conn?.access_token_expires_at || null,
        last_refresh_at: conn?.last_token_refresh_at || conn?.updated_at || null,
        catalog_id: conn?.catalog_id || null,
        last_error: conn?.last_error || null,
        // Never return tokens
      });
    }

    if (action === "refresh") {
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
    }

    // disconnect
    if (conn?.access_token) await revokeAdobeToken(conn.access_token);
    if (conn?.refresh_token) await revokeAdobeToken(conn.refresh_token);

    await admin.from("adobe_lightroom_connections").delete().eq("business_id", businessId);
    await admin.from("hubly_app_connections").upsert({
      business_id: businessId,
      provider: ADOBE_PROVIDER_ID,
      status: "disconnected",
      health: "disconnected",
      account_label: null,
      last_sync_at: null,
      metadata: {},
      updated_at: new Date().toISOString(),
    }, { onConflict: "business_id,provider" });

    await admin.from("photography_project_workspaces")
      .update({
        sync_state: "unlinked",
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", businessId)
      .eq("provider", ADOBE_PROVIDER_ID);

    return jsonRes({ ok: true, disconnected: true });
  } catch (e) {
    console.error("adobe-oauth-disconnect", e);
    return jsonRes({ error: (e as Error)?.message || "Adobe connection error" }, 500);
  }
});
