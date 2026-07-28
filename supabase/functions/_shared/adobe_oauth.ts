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

/** Row shape for adobe_lightroom_connections (tokens never leave the server). */
export type AdobeConnectionRow = {
  id?: string;
  business_id: string;
  owner_id: string;
  adobe_user_id: string;
  adobe_email: string | null;
  adobe_display_name: string | null;
  refresh_token: string | null;
  access_token: string | null;
  access_token_expires_at: string | null;
  last_token_refresh_at?: string | null;
  catalog_id?: string | null;
  scopes?: string[] | null;
  connected_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  updated_at?: string | null;
};

export type AdobeAccessContext = {
  accessToken: string;
  expiresAt: string | null;
  lastRefreshAt: string | null;
  accountEmail: string | null;
  accountDisplayName: string | null;
  adobeUserId: string;
  catalogId: string | null;
  connectedAt: string | null;
  connection: AdobeConnectionRow;
};

type AdminClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: AdobeConnectionRow | null; error: unknown }>;
      };
    };
    update: (payload: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<{ error: unknown }>;
    };
  };
};

/**
 * AdobeOAuthService — IMS token vault + refresh.
 * Shared by Lightroom (and later Express / Photoshop / Frame.io).
 */
export class AdobeOAuthService {
  isConfigured(): boolean {
    return adobeConfigured();
  }

  missingEnv(): string[] {
    const missing: string[] = [];
    if (!adobeClientId()) missing.push("ADOBE_CLIENT_ID");
    if (!adobeClientSecret()) missing.push("ADOBE_CLIENT_SECRET");
    return missing;
  }

  async getConnection(
    admin: AdminClient,
    businessId: string,
  ): Promise<AdobeConnectionRow | null> {
    const { data, error } = await admin
      .from("adobe_lightroom_connections")
      .select(
        "id,business_id,owner_id,adobe_user_id,adobe_email,adobe_display_name,refresh_token,access_token,access_token_expires_at,last_token_refresh_at,catalog_id,scopes,connected_at,last_sync_at,last_error,updated_at",
      )
      .eq("business_id", businessId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /**
   * Returns a usable access token, refreshing when within 60s of expiry.
   * Never returns tokens to the browser — Edge / provider only.
   */
  async getValidAccessToken(
    admin: AdminClient,
    businessId: string,
  ): Promise<AdobeAccessContext> {
    if (!this.isConfigured()) {
      throw new Error("Provider not configured. Add ADOBE_CLIENT_ID and ADOBE_CLIENT_SECRET.");
    }
    const conn = await this.getConnection(admin, businessId);
    if (!conn?.access_token && !conn?.refresh_token) {
      throw new Error("Adobe Lightroom is not connected. Connect Adobe first.");
    }

    const expiresMs = conn.access_token_expires_at
      ? new Date(conn.access_token_expires_at).getTime()
      : 0;
    const needsRefresh = !conn.access_token || !expiresMs || expiresMs < Date.now() + 60_000;

    if (needsRefresh) {
      if (!conn.refresh_token) {
        throw new Error("Adobe access expired — reconnect Adobe Lightroom.");
      }
      const refreshed = await refreshAdobeAccessToken({ refreshToken: conn.refresh_token });
      if (!refreshed.ok) {
        await admin.from("adobe_lightroom_connections").update({
          last_error: refreshed.error,
          updated_at: new Date().toISOString(),
        }).eq("business_id", businessId);
        throw new Error(refreshed.error);
      }
      const expiresAt = new Date(
        Date.now() + (refreshed.data.expires_in || 3600) * 1000,
      ).toISOString();
      const now = new Date().toISOString();
      await admin.from("adobe_lightroom_connections").update({
        access_token: refreshed.data.access_token,
        refresh_token: refreshed.data.refresh_token || conn.refresh_token,
        access_token_expires_at: expiresAt,
        last_token_refresh_at: now,
        last_error: null,
        updated_at: now,
      }).eq("business_id", businessId);

      conn.access_token = refreshed.data.access_token;
      conn.refresh_token = refreshed.data.refresh_token || conn.refresh_token;
      conn.access_token_expires_at = expiresAt;
      conn.last_token_refresh_at = now;
      conn.last_error = null;
    }

    return {
      accessToken: String(conn.access_token),
      expiresAt: conn.access_token_expires_at,
      lastRefreshAt: conn.last_token_refresh_at || conn.updated_at || null,
      accountEmail: conn.adobe_email,
      accountDisplayName: conn.adobe_display_name,
      adobeUserId: conn.adobe_user_id,
      catalogId: conn.catalog_id || null,
      connectedAt: conn.connected_at,
      connection: conn,
    };
  }

  async saveCatalogId(
    admin: AdminClient,
    businessId: string,
    catalogId: string,
  ): Promise<void> {
    if (!catalogId) return;
    await admin.from("adobe_lightroom_connections").update({
      catalog_id: catalogId,
      updated_at: new Date().toISOString(),
    }).eq("business_id", businessId);
  }

  async touchSync(
    admin: AdminClient,
    businessId: string,
    lastError: string | null = null,
  ): Promise<void> {
    await admin.from("adobe_lightroom_connections").update({
      last_sync_at: new Date().toISOString(),
      last_error: lastError,
      updated_at: new Date().toISOString(),
    }).eq("business_id", businessId);
  }
}

let _oauthSingleton: AdobeOAuthService | null = null;

export function getAdobeOAuthService(): AdobeOAuthService {
  if (!_oauthSingleton) _oauthSingleton = new AdobeOAuthService();
  return _oauthSingleton;
}

export { randomSecret, sanitizeReturnTo, appBaseUrl };
