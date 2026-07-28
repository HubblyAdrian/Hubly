// Start Adobe Lightroom OAuth for the signed-in business owner.
// Returns { ok, url } — the browser should navigate there.
// Credentials: ADOBE_CLIENT_ID / ADOBE_CLIENT_SECRET from Deno.env only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  adobeAuthorizeUrl,
  adobeClientId,
  adobeClientSecret,
  adobeConfigured,
  adobeOAuthRedirectUri,
  adobeScopes,
  randomSecret,
  sanitizeReturnTo,
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
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const clientId = adobeClientId();
    const clientSecret = adobeClientSecret();

    if (!supabaseUrl || !serviceKey || !anonKey) {
      return jsonRes({ error: "Auth isn’t configured on the server yet." }, 500);
    }
    if (!adobeConfigured() || !clientId || !clientSecret) {
      return jsonRes({
        error: "Adobe Lightroom isn’t configured yet. Add ADOBE_CLIENT_ID and ADOBE_CLIENT_SECRET.",
        code: "PROVIDER_NOT_CONFIGURED",
      }, 503);
    }

    const body = await req.json().catch(() => ({}));
    const businessId = String(body?.business_id || body?.businessId || "").trim();
    if (!businessId) return jsonRes({ error: "business_id required" }, 400);
    const projectId = String(body?.project_id || body?.projectId || "").trim() || null;
    const returnTo = sanitizeReturnTo(body?.return_to || body?.returnTo);

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
    const { error: stateErr } = await admin.from("adobe_oauth_states").insert({
      state,
      owner_id: user.id,
      business_id: businessId,
      return_to: returnTo,
      project_id: projectId,
      expires_at: expiresAt,
    });
    if (stateErr) {
      console.error("adobe oauth state insert", stateErr);
      return jsonRes({ error: "Could not start Adobe sign-in" }, 500);
    }

    // Mark Connected App pending (no tokens here — tokens stay in adobe_lightroom_connections).
    await admin.from("hubly_app_connections").upsert({
      business_id: businessId,
      provider: "adobe_lightroom",
      status: "pending",
      health: "disconnected",
      updated_at: new Date().toISOString(),
    }, { onConflict: "business_id,provider" });

    const redirectUri = adobeOAuthRedirectUri(supabaseUrl);
    const url = adobeAuthorizeUrl({
      clientId,
      redirectUri,
      state,
      scopes: adobeScopes(),
    });

    return jsonRes({ ok: true, url, redirect_uri: redirectUri });
  } catch (e) {
    console.error("adobe-oauth-start", e);
    return jsonRes({ error: (e as Error)?.message || "Could not start Adobe sign-in" }, 500);
  }
});
