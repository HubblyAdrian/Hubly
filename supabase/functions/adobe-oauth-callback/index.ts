// Adobe IMS OAuth redirect target. Exchanges code for tokens, stores them, redirects to Hubly.
// Register as Redirect URI in Adobe Developer Console:
//   https://{project}.supabase.co/functions/v1/adobe-oauth-callback
// verify_jwt = false (Adobe redirects without Hubly JWT; CSRF state validated here).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ADOBE_PROVIDER_ID,
  adobeOAuthRedirectUri,
  appBaseUrl,
  exchangeAdobeAuthCode,
  fetchAdobeProfile,
  sanitizeReturnTo,
} from "../_shared/adobe_oauth.ts";

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

    if (!supabaseUrl || !serviceKey) {
      return redirectTo(fallback, {
        adobe_oauth: "error",
        adobe_msg: "Adobe isn’t configured on the server",
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    if (err) {
      return redirectTo(fallback, {
        adobe_oauth: "error",
        adobe_msg: err === "access_denied"
          ? "Adobe access denied — check app scopes and consent"
          : `Adobe error: ${err}`,
      });
    }
    if (!code || !state) {
      return redirectTo(fallback, {
        adobe_oauth: "error",
        adobe_msg: "Missing authorization code",
      });
    }

    const { data: row, error: stateErr } = await admin
      .from("adobe_oauth_states")
      .select("*")
      .eq("state", state)
      .maybeSingle();

    if (row?.id) {
      await admin.from("adobe_oauth_states").delete().eq("id", row.id);
    }

    if (stateErr || !row) {
      return redirectTo(fallback, {
        adobe_oauth: "error",
        adobe_msg: "Sign-in expired — try Connect Adobe again",
      });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return redirectTo(sanitizeReturnTo(row.return_to, fallback), {
        adobe_oauth: "error",
        adobe_msg: "Sign-in expired — try Connect Adobe again",
      });
    }

    const safeReturn = sanitizeReturnTo(row.return_to, fallback);
    const redirectUri = adobeOAuthRedirectUri(supabaseUrl);

    const exchanged = await exchangeAdobeAuthCode({ code, redirectUri });
    if (!exchanged.ok) {
      return redirectTo(safeReturn, {
        adobe_oauth: "error",
        adobe_msg: exchanged.error || "Could not complete Adobe sign-in",
      });
    }

    const accessToken = exchanged.data.access_token;
    let refreshToken = exchanged.data.refresh_token || "";
    const expiresIn = exchanged.data.expires_in || 3600;
    const scopeStr = exchanged.data.scope || "";

    const profile = await fetchAdobeProfile(accessToken);
    if (!profile.userId) {
      return redirectTo(safeReturn, {
        adobe_oauth: "error",
        adobe_msg: "Could not identify your Adobe account",
      });
    }

    if (!refreshToken) {
      const { data: existing } = await admin
        .from("adobe_lightroom_connections")
        .select("refresh_token")
        .eq("business_id", row.business_id)
        .maybeSingle();
      refreshToken = String(existing?.refresh_token || "");
    }

    const now = new Date();
    const scopes = scopeStr
      ? scopeStr.split(/[,\s]+/).filter(Boolean)
      : [];

    const payload = {
      business_id: row.business_id,
      owner_id: row.owner_id,
      adobe_user_id: profile.userId,
      adobe_email: profile.email,
      adobe_display_name: profile.displayName,
      refresh_token: refreshToken || null,
      access_token: accessToken,
      access_token_expires_at: new Date(now.getTime() + expiresIn * 1000).toISOString(),
      scopes,
      connected_at: now.toISOString(),
      last_error: refreshToken
        ? null
        : "No refresh token returned — offline_access may need enabling on the Adobe API key",
      updated_at: now.toISOString(),
    };

    const { error: upsertErr } = await admin
      .from("adobe_lightroom_connections")
      .upsert(payload, { onConflict: "business_id" });

    if (upsertErr) {
      console.error("adobe upsert connection", upsertErr);
      return redirectTo(safeReturn, {
        adobe_oauth: "error",
        adobe_msg: "Could not save Adobe Lightroom connection",
      });
    }

    await admin.from("hubly_app_connections").upsert({
      business_id: row.business_id,
      provider: ADOBE_PROVIDER_ID,
      status: "connected",
      health: "healthy",
      account_label: profile.email || profile.displayName || profile.userId,
      scopes,
      last_sync_at: null,
      metadata: {
        adobe_user_id: profile.userId,
        has_refresh_token: !!refreshToken,
      },
      updated_at: now.toISOString(),
    }, { onConflict: "business_id,provider" });

    if (row.project_id) {
      await admin.from("photography_project_workspaces").upsert({
        project_id: row.project_id,
        business_id: row.business_id,
        provider: ADOBE_PROVIDER_ID,
        display_name: profile.email || "Adobe Lightroom",
        sync_state: "linked",
        metadata: {
          adobe_user_id: profile.userId,
          adobe_email: profile.email,
        },
        updated_at: now.toISOString(),
      }, { onConflict: "project_id,provider" });
    }

    await admin
      .from("adobe_oauth_states")
      .delete()
      .lt("expires_at", now.toISOString());

    return redirectTo(safeReturn, {
      adobe_oauth: "connected",
      adobe_msg: profile.email || profile.displayName || "Adobe Lightroom connected",
    });
  } catch (e) {
    console.error("adobe-oauth-callback", e);
    return redirectTo(fallback, {
      adobe_oauth: "error",
      adobe_msg: "Something went wrong connecting Adobe Lightroom",
    });
  }
});
