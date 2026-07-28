/**
 * Adobe IMS OAuth helpers for Lightroom Connected App.
 * Credentials: ADOBE_CLIENT_ID / ADOBE_CLIENT_SECRET from Deno.env only.
 * Never hardcode secrets. Never return tokens to the browser.
 */

import { randomSecret, sanitizeReturnTo, appBaseUrl } from "./google_calendar_security.ts";

export const ADOBE_PROVIDER_ID = "adobe_lightroom";

/** Default Lightroom partner scopes (Adobe Lightroom Services docs). */
export const ADOBE_DEFAULT_SCOPES =
  "openid,AdobeID,lr_partner_apis,lr_partner_rendition_apis,offline_access";

export function adobeClientId(): string | null {
  const v = Deno.env.get("ADOBE_CLIENT_ID")?.trim();
  return v || null;
}

export function adobeClientSecret(): string | null {
  const v = Deno.env.get("ADOBE_CLIENT_SECRET")?.trim();
  return v || null;
}

export function adobeConfigured(): boolean {
  return !!(adobeClientId() && adobeClientSecret());
}

export function adobeImsHost(): string {
  const host = (Deno.env.get("ADOBE_IMS_HOST") || "ims-na1.adobelogin.com").trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  return host || "ims-na1.adobelogin.com";
}

export function adobeScopes(): string {
  return (Deno.env.get("ADOBE_OAUTH_SCOPES") || ADOBE_DEFAULT_SCOPES).trim() ||
    ADOBE_DEFAULT_SCOPES;
}

export function adobeOAuthRedirectUri(supabaseUrl: string): string {
  const override = Deno.env.get("ADOBE_OAUTH_REDIRECT_URI")?.trim();
  if (override) return override;
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/adobe-oauth-callback`;
}

export function adobeAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes?: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: opts.scopes || adobeScopes(),
    state: opts.state,
  });
  return `https://${adobeImsHost()}/ims/authorize/v2?${params}`;
}

export type AdobeTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

export async function exchangeAdobeAuthCode(opts: {
  code: string;
  redirectUri: string;
}): Promise<{ ok: true; data: AdobeTokenResponse } | { ok: false; error: string }> {
  const clientId = adobeClientId();
  const clientSecret = adobeClientSecret();
  if (!clientId || !clientSecret) {
    return { ok: false, error: "Adobe isn’t configured (ADOBE_CLIENT_ID / ADOBE_CLIENT_SECRET)." };
  }
  const res = await fetch(`https://${adobeImsHost()}/ims/token/v3`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code: opts.code,
      redirect_uri: opts.redirectUri,
    }),
  });
  const json = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok || !json.access_token) {
    console.error("adobe token exchange", json?.error || res.status);
    return {
      ok: false,
      error: String(json?.error_description || json?.error || "Could not complete Adobe sign-in"),
    };
  }
  return {
    ok: true,
    data: {
      access_token: String(json.access_token),
      refresh_token: json.refresh_token ? String(json.refresh_token) : undefined,
      expires_in: Number(json.expires_in) || 3600,
      token_type: json.token_type ? String(json.token_type) : undefined,
      scope: json.scope ? String(json.scope) : undefined,
    },
  };
}

export async function refreshAdobeAccessToken(opts: {
  refreshToken: string;
}): Promise<{ ok: true; data: AdobeTokenResponse } | { ok: false; error: string }> {
  const clientId = adobeClientId();
  const clientSecret = adobeClientSecret();
  if (!clientId || !clientSecret) {
    return { ok: false, error: "Adobe isn’t configured." };
  }
  const res = await fetch(`https://${adobeImsHost()}/ims/token/v3`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: opts.refreshToken,
    }),
  });
  const json = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok || !json.access_token) {
    console.error("adobe token refresh", json?.error || res.status);
    return {
      ok: false,
      error: String(json?.error_description || json?.error || "Could not refresh Adobe token"),
    };
  }
  return {
    ok: true,
    data: {
      access_token: String(json.access_token),
      refresh_token: json.refresh_token ? String(json.refresh_token) : opts.refreshToken,
      expires_in: Number(json.expires_in) || 3600,
      scope: json.scope ? String(json.scope) : undefined,
    },
  };
}

export async function fetchAdobeProfile(accessToken: string): Promise<{
  userId: string;
  email: string | null;
  displayName: string | null;
}> {
  const res = await fetch(`https://${adobeImsHost()}/ims/profile/v1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    // Fallback userinfo endpoint
    const ui = await fetch(`https://${adobeImsHost()}/ims/userinfo/v2`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!ui.ok) return { userId: "", email: null, displayName: null };
    const info = await ui.json().catch(() => ({})) as Record<string, unknown>;
    return {
      userId: String(info.sub || info.userId || ""),
      email: info.email ? String(info.email).toLowerCase() : null,
      displayName: info.name ? String(info.name) : null,
    };
  }
  const info = await res.json().catch(() => ({})) as Record<string, unknown>;
  return {
    userId: String(info.userId || info.sub || ""),
    email: info.email ? String(info.email).toLowerCase() : null,
    displayName: info.displayName
      ? String(info.displayName)
      : (info.name ? String(info.name) : null),
  };
}

export async function revokeAdobeToken(token: string): Promise<void> {
  const clientId = adobeClientId();
  if (!clientId || !token) return;
  try {
    await fetch(`https://${adobeImsHost()}/ims/revoke`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token,
        client_id: clientId,
      }),
    });
  } catch (e) {
    console.warn("adobe revoke", e);
  }
}

export { randomSecret, sanitizeReturnTo, appBaseUrl };
