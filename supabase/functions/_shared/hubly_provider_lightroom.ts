/**
 * AdobeLightroomProvider — Connected App (editing) for Hubly Core.
 *
 * Layers:
 *   AdobeOAuthService → AdobeHttpClient → AdobeLightroomClient → this Provider → Hubly
 *
 * Production-First:
 * - Real Adobe Lightroom Services API only (see ADOBE_LIGHTROOM_API_COMPATIBILITY.md)
 * - Missing credentials → PROVIDER_NOT_CONFIGURED
 * - Unsupported Adobe ops → UNSUPPORTED_OPERATION
 * - Deferred Hubly ops → NOT_IMPLEMENTED (never fake success)
 * - Hubly remains system of record for Photography Projects
 */

import {
  envTruthy,
  providerError,
  providerNotConfigured,
  providerOk,
  type HublyProviderResult,
} from "./hubly_providers.ts";
import {
  registerConnectedApp,
  type ConnectedAppAction,
  type ConnectedAppCapability,
  type ConnectedAppHealth,
  type ConnectedAppPermission,
  type ConnectedAppProvider,
  type ConnectedAppStatus,
} from "./hubly_connected_apps.ts";
import type {
  ExternalWorkspaceProvider,
  ProjectWorkspace,
} from "./hubly_project_workspace.ts";
import {
  getAdobeOAuthService,
  type AdobeAccessContext,
  type AdobeOAuthService,
} from "./adobe_oauth.ts";
import {
  AdobeLightroomClient,
  LR_MASTER_CONTENT_TYPES,
  createLightroomClient,
  type LrAlbum,
  type LrAsset,
} from "./adobe_lightroom_client.ts";
import { adobePublicHealth } from "./adobe_http_client.ts";

export type LightroomAlbum = {
  id: string;
  name: string;
  photoCount?: number;
  subtype?: string;
  catalogId?: string;
};

export type LightroomAsset = {
  id: string;
  name?: string;
  favorite?: boolean;
  edited?: boolean;
  rating?: number;
  flag?: string;
  url?: string;
  captureDate?: string;
  keywords?: string[];
  camera?: string;
  lens?: string;
  width?: number;
  height?: number;
  gps?: { latitude?: number; longitude?: number; altitude?: number };
};

export type LightroomSyncResult = {
  projectId: string;
  albumId?: string;
  catalogId?: string;
  imported: number;
  exported: number;
  favorites: number;
  edited: number;
  photoCount: number;
  lastSyncAt: string;
  /** Workspace metadata patch only — never Hubly project fields. */
  workspaceMetadata: Record<string, unknown>;
  /** Patches for photography_projects.workspace.local_uploads matched by lightroom_asset_id. */
  mediaPatches?: LightroomMediaPatch[];
};

export type LightroomMediaPatch = {
  id: string;
  lightroom_asset_id?: string;
  lightroom_upload_status?: string;
  lightroom_uploaded_at?: string;
  lightroom_upload_error?: string | null;
  lightroom_sha256?: string;
  lightroom_edited?: boolean;
  lightroom_favorite?: boolean;
  lightroom_rating?: number | null;
  lightroom_flag?: string | null;
  lightroom_synced_at?: string;
};

export type LightroomUploadItemResult = {
  hublyMediaId: string;
  name?: string;
  lightroomAssetId?: string;
  status:
    | "uploaded"
    | "skipped_duplicate"
    | "already_uploaded"
    | "failed"
    | "unsupported"
    | "skipped";
  error?: string;
};

export type LightroomUploadResult = {
  uploaded: number;
  skipped: number;
  failed: number;
  albumId: string;
  catalogId: string;
  results: LightroomUploadItemResult[];
  mediaPatches: LightroomMediaPatch[];
};

export type LightroomConnectionStatus = {
  connected: boolean;
  health: ConnectedAppHealth;
  adobeAccount: string | null;
  adobeUserId: string | null;
  tokenExpiresAt: string | null;
  lastRefreshAt: string | null;
  catalogId: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  message: string;
};

export type LightroomConnection = {
  connected: boolean;
  accountEmail?: string;
  adobeUserId?: string;
};

const MISSING_ADOBE = ["ADOBE_CLIENT_ID", "ADOBE_CLIENT_SECRET"] as const;

type AdminLike = Parameters<AdobeOAuthService["getValidAccessToken"]>[0];

function unsupported(detail: string, meta?: Record<string, unknown>) {
  return providerError("adobe_lightroom", "UNSUPPORTED_OPERATION", detail, {
    retryable: false,
    meta,
  });
}

function notImpl(detail: string, meta?: Record<string, unknown>) {
  return providerError("adobe_lightroom", "NOT_IMPLEMENTED", detail, {
    retryable: false,
    meta,
  });
}

function toAlbum(a: LrAlbum, catalogId?: string): LightroomAlbum {
  return {
    id: a.id,
    name: a.name,
    photoCount: a.photoCount,
    subtype: a.subtype,
    catalogId,
  };
}

function toAsset(a: LrAsset): LightroomAsset {
  return {
    id: a.id,
    name: a.name,
    favorite: a.favorite,
    edited: a.edited,
    rating: a.rating,
    flag: a.flag,
    captureDate: a.captureDate,
    keywords: a.keywords || [],
    camera: a.camera,
    lens: a.lens,
    width: a.width,
    height: a.height,
    gps: a.gps,
  };
}

/**
 * Capability-facing interface. Runtime / Edge Functions depend on this,
 * not on Adobe SDK details.
 */
export interface LightroomProvider {
  readonly id: string;
  isConfigured(): boolean;
  missingEnv(): string[];
  connect(opts: { businessId: string; returnTo?: string }): Promise<
    HublyProviderResult<{ authorizeUrl: string }>
  >;
  disconnect(opts: { businessId: string }): Promise<HublyProviderResult<{ disconnected: true }>>;
  refreshToken(opts: { businessId: string }): Promise<
    HublyProviderResult<{ expiresAt?: string }>
  >;
  createAlbum(opts: {
    businessId: string;
    projectId: string;
    name: string;
    admin: AdminLike;
  }): Promise<HublyProviderResult<LightroomAlbum>>;
  renameAlbum(opts: {
    businessId: string;
    albumId: string;
    name: string;
    catalogId?: string;
    admin: AdminLike;
  }): Promise<HublyProviderResult<LightroomAlbum>>;
  listAlbums(opts: {
    businessId: string;
    admin: AdminLike;
    subtype?: string;
  }): Promise<HublyProviderResult<LightroomAlbum[]>>;
  listAssets(opts: {
    businessId: string;
    albumId: string;
    catalogId?: string;
    admin: AdminLike;
  }): Promise<HublyProviderResult<LightroomAsset[]>>;
  getAsset(opts: {
    businessId: string;
    assetId: string;
    catalogId?: string;
    admin: AdminLike;
  }): Promise<HublyProviderResult<LightroomAsset>>;
  downloadEditedAsset(opts: {
    businessId: string;
    assetId: string;
    catalogId?: string;
    renditionType?: string;
    admin: AdminLike;
  }): Promise<HublyProviderResult<{ assetId: string; contentType: string | null; bytes: ArrayBuffer }>>;
  syncProject(opts: {
    businessId: string;
    projectId: string;
    albumId?: string;
    catalogId?: string;
    admin: AdminLike;
  }): Promise<HublyProviderResult<LightroomSyncResult>>;
  uploadPhotos(opts: {
    businessId: string;
    projectId: string;
    albumId?: string;
    catalogId?: string;
    fileRefs: string[];
    admin: AdminLike;
    /** Optional pre-loaded Hubly media items (from photography_projects.workspace.local_uploads). */
    mediaItems?: HublyMediaUploadItem[];
  }): Promise<HublyProviderResult<LightroomUploadResult>>;
  openAlbum(opts: {
    businessId: string;
    albumId: string;
    catalogId?: string;
  }): Promise<HublyProviderResult<{ albumId: string; hint: string }>>;
  publishGallery(opts: {
    businessId: string;
    projectId: string;
    galleryId: string;
  }): Promise<HublyProviderResult<{ shareUrl?: string }>>;
  archiveProject(opts: {
    businessId: string;
    projectId: string;
  }): Promise<HublyProviderResult<{ archived: true }>>;
}

/** Hubly Media tab item shape used for Lightroom upload. */
export type HublyMediaUploadItem = {
  id: string;
  name?: string;
  type?: string;
  mime?: string;
  url?: string;
  previewUrl?: string;
  size?: number;
  isRaw?: boolean;
  lightroom_asset_id?: string;
  lightroom_upload_status?: string;
  lightroom_sha256?: string;
};

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function resolveMasterContentType(item: HublyMediaUploadItem, headerType?: string | null): string | null {
  const candidates = [
    headerType,
    item.type,
    item.mime,
  ].map((x) => String(x || "").toLowerCase().split(";")[0].trim()).filter(Boolean);

  const name = String(item.name || "").toLowerCase();
  if (/\.jpe?g$/i.test(name)) candidates.push("image/jpeg");
  if (/\.png$/i.test(name)) candidates.push("image/png");
  if (/\.tiff?$/i.test(name)) candidates.push("image/tiff");
  if (/\.dng$/i.test(name)) candidates.push("image/dng");
  if (/\.mp4$/i.test(name)) candidates.push("video/mp4");
  // Stored RAW previews are JPEG under brand-assets.
  if (item.isRaw || /\.(nef|cr2|cr3|arw|orf|rw2|raw)$/i.test(name)) {
    candidates.push("image/jpeg");
  }

  for (const c of candidates) {
    if ((LR_MASTER_CONTENT_TYPES as readonly string[]).includes(c)) return c;
    if (c === "image/jpg") return "image/jpeg";
  }
  return null;
}

function isDurableHttpUrl(url: string | undefined | null): boolean {
  const u = String(url || "");
  return /^https?:\/\//i.test(u);
}

export class AdobeLightroomService
  implements LightroomProvider, ExternalWorkspaceProvider, ConnectedAppProvider
{
  readonly id = "adobe_lightroom" as const;
  readonly name = "Adobe Lightroom";
  private oauth: AdobeOAuthService;

  constructor(oauth?: AdobeOAuthService) {
    this.oauth = oauth || getAdobeOAuthService();
  }

  missingEnv(): string[] {
    const missing: string[] = [];
    for (const key of MISSING_ADOBE) {
      if (!envTruthy(key)) missing.push(key);
    }
    return missing;
  }

  isConfigured(): boolean {
    return this.missingEnv().length === 0;
  }

  private notReady<T = never>(): HublyProviderResult<T> {
    return providerNotConfigured(this.id, this.missingEnv()) as HublyProviderResult<T>;
  }

  private async session(
    admin: AdminLike,
    businessId: string,
  ): Promise<
    | { ok: true; ctx: AdobeAccessContext; client: AdobeLightroomClient }
    | { ok: false; result: HublyProviderResult<never> }
  > {
    if (!this.isConfigured()) return { ok: false, result: this.notReady() };
    try {
      const ctx = await this.oauth.getValidAccessToken(admin, businessId);
      return { ok: true, ctx, client: createLightroomClient(ctx.accessToken) };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/not configured/i.test(msg)) return { ok: false, result: this.notReady() };
      return {
        ok: false,
        result: providerError(this.id, "ADOBE_AUTH_FAILED", msg, { retryable: true }),
      };
    }
  }

  private async resolveCatalogId(
    admin: AdminLike,
    businessId: string,
    client: AdobeLightroomClient,
    ctx: AdobeAccessContext,
    override?: string,
  ): Promise<{ ok: true; catalogId: string } | { ok: false; result: HublyProviderResult<never> }> {
    if (override) return { ok: true, catalogId: override };
    if (ctx.catalogId) return { ok: true, catalogId: ctx.catalogId };
    const cat = await client.getCatalog();
    if (!cat.ok || !cat.data?.id) {
      return {
        ok: false,
        result: providerError(
          this.id,
          "ADOBE_CATALOG_FAILED",
          cat.error || "Could not load Lightroom catalog",
          { retryable: true },
        ),
      };
    }
    await this.oauth.saveCatalogId(admin, businessId, cat.data.id);
    return { ok: true, catalogId: cat.data.id };
  }

  /* ─── OAuth surface (Edge owns CSRF; provider documents entry) ─── */

  async connect(opts: {
    businessId: string;
    returnTo?: string;
  }): Promise<HublyProviderResult<{ authorizeUrl: string }>> {
    if (!this.isConfigured()) return this.notReady();
    if (!opts.businessId) {
      return providerError(this.id, "BUSINESS_REQUIRED", "businessId is required to connect Adobe", {
        retryable: false,
      });
    }
    return providerOk(
      this.id,
      { authorizeUrl: "" },
      "Adobe OAuth is live — invoke Edge Function adobe-oauth-start with business_id.",
      {
        edgeFunction: "adobe-oauth-start",
        businessId: opts.businessId,
        returnTo: opts.returnTo || null,
      },
    );
  }

  async disconnect(opts: {
    businessId: string;
  }): Promise<HublyProviderResult<{ disconnected: true }>> {
    if (!this.isConfigured()) return this.notReady();
    return providerOk(
      this.id,
      { disconnected: true as const },
      "Invoke Edge Function adobe-oauth-disconnect with action=disconnect.",
      { edgeFunction: "adobe-oauth-disconnect", businessId: opts.businessId },
    );
  }

  async refreshToken(opts: {
    businessId: string;
    admin?: AdminLike;
  }): Promise<HublyProviderResult<{ expiresAt?: string }>> {
    if (!this.isConfigured()) return this.notReady();
    if (!opts.admin) {
      return providerOk(
        this.id,
        { expiresAt: undefined },
        "Invoke Edge Function adobe-oauth-refresh to rotate the access token.",
        { edgeFunction: "adobe-oauth-refresh", businessId: opts.businessId },
      );
    }
    try {
      const ctx = await this.oauth.getValidAccessToken(opts.admin, opts.businessId);
      return providerOk(this.id, { expiresAt: ctx.expiresAt || undefined }, "Adobe token valid");
    } catch (e) {
      return providerError(
        this.id,
        "ADOBE_REFRESH_FAILED",
        e instanceof Error ? e.message : String(e),
        { retryable: true },
      );
    }
  }

  /* ─── Step 1: Health / Status ─── */

  async health(opts?: {
    businessId?: string;
    admin?: AdminLike;
  }): Promise<HublyProviderResult<ConnectedAppHealth>> {
    // Always probe public Lightroom health (no secrets).
    const probe = await adobePublicHealth();
    if (!probe.ok) {
      return providerOk(
        this.id,
        "error" as const,
        `Lightroom API health check failed (${probe.status})`,
        { adobeHealth: probe.data },
      );
    }
    if (!this.isConfigured()) {
      return providerOk(this.id, "not_configured" as const, "Lightroom API reachable — Hubly credentials missing");
    }
    if (opts?.businessId && opts?.admin) {
      const session = await this.session(opts.admin, opts.businessId);
      if (!session.ok) {
        return providerOk(this.id, "disconnected" as const, session.result.message);
      }
      const cat = await session.client.getCatalog();
      if (!cat.ok) {
        return providerOk(this.id, "error" as const, cat.error || "Token rejected by Lightroom");
      }
      return providerOk(this.id, "healthy" as const, "Adobe Lightroom connected and catalog reachable");
    }
    return providerOk(this.id, "healthy" as const, "Lightroom API healthy — credentials configured");
  }

  async status(opts: {
    businessId: string;
    projectId?: string;
    admin?: AdminLike;
  }): Promise<HublyProviderResult<ConnectedAppStatus & LightroomConnectionStatus>> {
    if (!this.isConfigured()) {
      const payload: ConnectedAppStatus & LightroomConnectionStatus = {
        connected: false,
        health: "not_configured",
        adobeAccount: null,
        adobeUserId: null,
        tokenExpiresAt: null,
        lastRefreshAt: null,
        catalogId: null,
        connectedAt: null,
        lastSyncAt: null,
        lastError: null,
        message: "Add ADOBE_CLIENT_ID and ADOBE_CLIENT_SECRET to connect Lightroom.",
      };
      return providerOk(this.id, payload, "Lightroom not configured");
    }

    if (!opts.admin) {
      const payload: ConnectedAppStatus & LightroomConnectionStatus = {
        connected: false,
        health: "disconnected",
        adobeAccount: null,
        adobeUserId: null,
        tokenExpiresAt: null,
        lastRefreshAt: null,
        catalogId: null,
        connectedAt: null,
        lastSyncAt: null,
        lastError: null,
        message: "Pass service-role admin to status() or call adobe-lightroom action=status.",
      };
      return providerOk(this.id, payload, "Status requires server context");
    }

    const conn = await this.oauth.getConnection(opts.admin, opts.businessId);
    if (!conn) {
      const payload: ConnectedAppStatus & LightroomConnectionStatus = {
        connected: false,
        health: "disconnected",
        adobeAccount: null,
        adobeUserId: null,
        tokenExpiresAt: null,
        lastRefreshAt: null,
        catalogId: null,
        connectedAt: null,
        lastSyncAt: null,
        lastError: null,
        message: "Adobe Lightroom is not connected.",
      };
      return providerOk(this.id, payload, "Lightroom disconnected");
    }

    // Verify token against live catalog.
    let health: ConnectedAppHealth = "healthy";
    let verifyError: string | null = null;
    let catalogId = conn.catalog_id || null;
    try {
      const ctx = await this.oauth.getValidAccessToken(opts.admin, opts.businessId);
      const client = createLightroomClient(ctx.accessToken);
      const cat = await client.getCatalog();
      if (!cat.ok || !cat.data?.id) {
        health = "error";
        verifyError = cat.error || "Catalog verify failed";
      } else {
        catalogId = cat.data.id;
        if (catalogId !== conn.catalog_id) {
          await this.oauth.saveCatalogId(opts.admin, opts.businessId, catalogId);
        }
      }
    } catch (e) {
      health = "error";
      verifyError = e instanceof Error ? e.message : String(e);
    }

    const adobeAccount = conn.adobe_email || conn.adobe_display_name || null;
    const payload: ConnectedAppStatus & LightroomConnectionStatus = {
      connected: true,
      health,
      adobeAccount,
      adobeUserId: conn.adobe_user_id,
      tokenExpiresAt: conn.access_token_expires_at,
      lastRefreshAt: conn.last_token_refresh_at || conn.updated_at || null,
      catalogId,
      connectedAt: conn.connected_at,
      lastSyncAt: conn.last_sync_at,
      lastError: verifyError || conn.last_error,
      message: health === "healthy"
        ? `Connected as ${adobeAccount || conn.adobe_user_id}`
        : (verifyError || "Adobe connection needs attention"),
      accountLabel: adobeAccount || undefined,
    };
    return providerOk(this.id, payload, payload.message);
  }

  /* ─── Step 2: Albums ─── */

  async listAlbums(opts: {
    businessId: string;
    admin: AdminLike;
    subtype?: string;
  }): Promise<HublyProviderResult<LightroomAlbum[]>> {
    const session = await this.session(opts.admin, opts.businessId);
    if (!session.ok) return session.result as HublyProviderResult<LightroomAlbum[]>;
    const cat = await this.resolveCatalogId(
      opts.admin,
      opts.businessId,
      session.client,
      session.ctx,
    );
    if (!cat.ok) return cat.result as HublyProviderResult<LightroomAlbum[]>;

    const res = await session.client.listAlbums(cat.catalogId, {
      subtype: opts.subtype || "project",
    });
    if (!res.ok || !res.data) {
      return providerError(this.id, "ADOBE_LIST_ALBUMS_FAILED", res.error || "listAlbums failed", {
        retryable: true,
      });
    }
    return providerOk(
      this.id,
      res.data.map((a) => toAlbum(a, cat.catalogId)),
      `Found ${res.data.length} Lightroom album(s)`,
      { catalogId: cat.catalogId },
    );
  }

  async createAlbum(opts: {
    businessId: string;
    projectId: string;
    name: string;
    admin: AdminLike;
    /** Existing workspace external_id — reuse instead of creating duplicates. */
    existingAlbumId?: string | null;
    existingCatalogId?: string | null;
  }): Promise<HublyProviderResult<LightroomAlbum>> {
    const session = await this.session(opts.admin, opts.businessId);
    if (!session.ok) return session.result as HublyProviderResult<LightroomAlbum>;
    const cat = await this.resolveCatalogId(
      opts.admin,
      opts.businessId,
      session.client,
      session.ctx,
      opts.existingCatalogId || undefined,
    );
    if (!cat.ok) return cat.result as HublyProviderResult<LightroomAlbum>;

    // Reuse linked workspace album — do not create duplicates.
    if (opts.existingAlbumId) {
      const existing = await session.client.getAlbum(cat.catalogId, opts.existingAlbumId);
      if (existing.ok && existing.data) {
        return providerOk(
          this.id,
          toAlbum(existing.data, cat.catalogId),
          "Reused existing Lightroom album for this project",
          { reused: true, catalogId: cat.catalogId },
        );
      }
    }

    const created = await session.client.createProjectAlbum({
      catalogId: cat.catalogId,
      name: opts.name,
      remoteId: opts.projectId,
    });
    if (!created.ok || !created.data) {
      return providerError(
        this.id,
        "ADOBE_CREATE_ALBUM_FAILED",
        created.error || "createAlbum failed",
        { retryable: true },
      );
    }
    return providerOk(
      this.id,
      toAlbum(created.data, cat.catalogId),
      `Created Lightroom album “${created.data.name}”`,
      { reused: false, catalogId: cat.catalogId },
    );
  }

  async renameAlbum(opts: {
    businessId: string;
    albumId: string;
    name: string;
    catalogId?: string;
    admin: AdminLike;
  }): Promise<HublyProviderResult<LightroomAlbum>> {
    const session = await this.session(opts.admin, opts.businessId);
    if (!session.ok) return session.result as HublyProviderResult<LightroomAlbum>;
    const cat = await this.resolveCatalogId(
      opts.admin,
      opts.businessId,
      session.client,
      session.ctx,
      opts.catalogId,
    );
    if (!cat.ok) return cat.result as HublyProviderResult<LightroomAlbum>;

    const res = await session.client.renameAlbum({
      catalogId: cat.catalogId,
      albumId: opts.albumId,
      name: opts.name,
    });
    if (!res.ok || !res.data) {
      return providerError(
        this.id,
        "ADOBE_RENAME_ALBUM_FAILED",
        res.error ||
          "renameAlbum failed — Adobe only allows updates for project albums created by this app",
        { retryable: true },
      );
    }
    return providerOk(this.id, toAlbum(res.data, cat.catalogId), `Renamed album to “${opts.name}”`);
  }

  /* ─── Step 3: Assets ─── */

  async listAssets(opts: {
    businessId: string;
    albumId: string;
    catalogId?: string;
    admin: AdminLike;
    /** Optional Adobe flag filter (pick / rejected / etc.). */
    flag?: string;
    limit?: number;
  }): Promise<HublyProviderResult<LightroomAsset[]>> {
    const session = await this.session(opts.admin, opts.businessId);
    if (!session.ok) return session.result as HublyProviderResult<LightroomAsset[]>;
    const cat = await this.resolveCatalogId(
      opts.admin,
      opts.businessId,
      session.client,
      session.ctx,
      opts.catalogId,
    );
    if (!cat.ok) return cat.result as HublyProviderResult<LightroomAsset[]>;

    const res = await session.client.listAlbumAssets(cat.catalogId, opts.albumId, {
      flag: opts.flag,
      limit: opts.limit,
    });
    if (!res.ok || !res.data) {
      return providerError(this.id, "ADOBE_LIST_ASSETS_FAILED", res.error || "listAssets failed", {
        retryable: true,
      });
    }
    return providerOk(
      this.id,
      res.data.map(toAsset),
      `${res.data.length} asset(s) in album`,
      { catalogId: cat.catalogId, albumId: opts.albumId },
    );
  }

  /** Hubly Action: readCatalog — GET /v2/catalog */
  async getCatalog(opts: {
    businessId: string;
    admin: AdminLike;
  }): Promise<HublyProviderResult<{ id: string; name?: string; created?: string; updated?: string }>> {
    const session = await this.session(opts.admin, opts.businessId);
    if (!session.ok) {
      return session.result as HublyProviderResult<{ id: string; name?: string; created?: string; updated?: string }>;
    }
    const res = await session.client.getCatalog();
    if (!res.ok || !res.data) {
      return providerError(this.id, "ADOBE_CATALOG_FAILED", res.error || "Could not read catalog", {
        retryable: true,
      });
    }
    // Cache catalog id via resolve path used elsewhere.
    await this.resolveCatalogId(
      opts.admin,
      opts.businessId,
      session.client,
      session.ctx,
      res.data.id,
    );
    return providerOk(this.id, {
      id: res.data.id,
      name: res.data.name,
      created: res.data.created,
      updated: res.data.updated,
    }, "Catalog loaded");
  }

  async getAsset(opts: {
    businessId: string;
    assetId: string;
    catalogId?: string;
    admin: AdminLike;
  }): Promise<HublyProviderResult<LightroomAsset>> {
    const session = await this.session(opts.admin, opts.businessId);
    if (!session.ok) return session.result as HublyProviderResult<LightroomAsset>;
    const cat = await this.resolveCatalogId(
      opts.admin,
      opts.businessId,
      session.client,
      session.ctx,
      opts.catalogId,
    );
    if (!cat.ok) return cat.result as HublyProviderResult<LightroomAsset>;

    const res = await session.client.getAsset(cat.catalogId, opts.assetId);
    if (!res.ok || !res.data) {
      return providerError(this.id, "ADOBE_GET_ASSET_FAILED", res.error || "getAsset failed", {
        retryable: true,
      });
    }
    return providerOk(this.id, toAsset(res.data), "Asset loaded");
  }

  async downloadEditedAsset(opts: {
    businessId: string;
    assetId: string;
    catalogId?: string;
    renditionType?: string;
    admin: AdminLike;
  }): Promise<HublyProviderResult<{ assetId: string; contentType: string | null; bytes: ArrayBuffer }>> {
    const session = await this.session(opts.admin, opts.businessId);
    if (!session.ok) {
      return session.result as HublyProviderResult<
        { assetId: string; contentType: string | null; bytes: ArrayBuffer }
      >;
    }
    const cat = await this.resolveCatalogId(
      opts.admin,
      opts.businessId,
      session.client,
      session.ctx,
      opts.catalogId,
    );
    if (!cat.ok) {
      return cat.result as HublyProviderResult<
        { assetId: string; contentType: string | null; bytes: ArrayBuffer }
      >;
    }

    const res = await session.client.getRendition({
      catalogId: cat.catalogId,
      assetId: opts.assetId,
      renditionType: opts.renditionType || "2048",
    });
    if (!res.ok || !res.data) {
      return providerError(
        this.id,
        "ADOBE_RENDITION_FAILED",
        res.error ||
          "Rendition not available — Adobe may need the master uploaded and renditions generated first",
        { retryable: true },
      );
    }
    return providerOk(
      this.id,
      {
        assetId: res.data.assetId,
        contentType: res.data.contentType,
        bytes: res.data.bytes,
      },
      "Rendition downloaded",
      { renditionType: res.data.renditionType },
    );
  }

  async uploadPhotos(opts: {
    businessId: string;
    projectId: string;
    albumId?: string;
    catalogId?: string;
    fileRefs: string[];
    admin: AdminLike;
    mediaItems?: HublyMediaUploadItem[];
  }): Promise<HublyProviderResult<LightroomUploadResult>> {
    if (!opts.projectId) {
      return providerError(this.id, "PROJECT_REQUIRED", "projectId is required to upload to Lightroom", {
        retryable: false,
      });
    }
    if (!opts.admin) {
      return providerError(this.id, "ADMIN_REQUIRED", "upload requires service-role admin", {
        retryable: false,
      });
    }

    const session = await this.session(opts.admin, opts.businessId);
    if (!session.ok) return session.result as HublyProviderResult<LightroomUploadResult>;

    const cat = await this.resolveCatalogId(
      opts.admin,
      opts.businessId,
      session.client,
      session.ctx,
      opts.catalogId,
    );
    if (!cat.ok) return cat.result as HublyProviderResult<LightroomUploadResult>;

    const albumId = opts.albumId;
    if (!albumId) {
      return providerError(
        this.id,
        "ALBUM_REQUIRED",
        "Link a Lightroom album to this project before uploading.",
        { retryable: false },
      );
    }

    // Precondition: entitlement + storage (official upload guide).
    const account = await session.client.getAccount();
    if (!account.ok || !account.data?.id) {
      return providerError(
        this.id,
        "ADOBE_ACCOUNT_FAILED",
        account.error || "Could not read Adobe Lightroom account",
        { retryable: true },
      );
    }
    const entitlement = String(account.data.entitlementStatus || "").toLowerCase();
    if (entitlement && entitlement !== "subscriber" && entitlement !== "trial") {
      return providerError(
        this.id,
        "ADOBE_NOT_ENTITLED",
        "This Adobe account needs an active Lightroom subscription or trial to accept uploads.",
        { retryable: false, meta: { entitlementStatus: entitlement } },
      );
    }
    const used = account.data.storageUsed ?? 0;
    const limit = account.data.storageLimit;
    if (typeof limit === "number" && limit > 0 && used >= limit) {
      return providerError(
        this.id,
        "ADOBE_STORAGE_FULL",
        "Adobe Lightroom storage is full — free space in Lightroom, then try again.",
        { retryable: false, meta: { used, limit } },
      );
    }

    const mediaItems = Array.isArray(opts.mediaItems) ? opts.mediaItems.slice() : [];
    const refs = (opts.fileRefs || []).map(String).filter(Boolean);
    const selected = refs.length
      ? mediaItems.filter((m) => refs.includes(String(m.id)))
      : mediaItems;

    if (!selected.length) {
      return providerError(
        this.id,
        "NO_MEDIA",
        "No Hubly photos selected to upload. Add photos in Media first.",
        { retryable: false },
      );
    }

    const importedBy = session.ctx.adobeUserId || account.data.id;
    const results: LightroomUploadItemResult[] = [];
    const mediaPatches: LightroomMediaPatch[] = [];
    let uploaded = 0;
    let skipped = 0;
    let failed = 0;
    const newlyUploadedIds: string[] = [];

    for (const item of selected) {
      const hublyMediaId = String(item.id || "");
      const name = item.name || hublyMediaId || "photo";

      if (item.lightroom_asset_id && item.lightroom_upload_status === "uploaded") {
        skipped += 1;
        results.push({
          hublyMediaId,
          name,
          lightroomAssetId: item.lightroom_asset_id,
          status: "already_uploaded",
        });
        continue;
      }

      const sourceUrl = isDurableHttpUrl(item.url)
        ? item.url!
        : (isDurableHttpUrl(item.previewUrl) ? item.previewUrl! : "");
      if (!sourceUrl) {
        failed += 1;
        const err = "Photo has no stored file URL — re-upload in Media, then try again.";
        results.push({ hublyMediaId, name, status: "failed", error: err });
        mediaPatches.push({
          id: hublyMediaId,
          lightroom_upload_status: "failed",
          lightroom_upload_error: err,
        });
        continue;
      }

      try {
        const fetchRes = await fetch(sourceUrl);
        if (!fetchRes.ok) {
          throw new Error(`Could not download Hubly media (${fetchRes.status})`);
        }
        const headerType = fetchRes.headers.get("content-type");
        const contentType = resolveMasterContentType(item, headerType);
        if (!contentType) {
          failed += 1;
          const err =
            "Unsupported file type for Lightroom. Use JPEG, PNG, TIFF, DNG, or MP4.";
          results.push({ hublyMediaId, name, status: "unsupported", error: err });
          mediaPatches.push({
            id: hublyMediaId,
            lightroom_upload_status: "unsupported",
            lightroom_upload_error: err,
          });
          continue;
        }

        const bytes = await fetchRes.arrayBuffer();
        if (!bytes.byteLength) {
          throw new Error("Empty file");
        }
        if (typeof limit === "number" && limit > 0 && used + bytes.byteLength > limit) {
          failed += 1;
          const err = "Not enough Adobe Lightroom storage for this file.";
          results.push({ hublyMediaId, name, status: "failed", error: err });
          mediaPatches.push({
            id: hublyMediaId,
            lightroom_upload_status: "failed",
            lightroom_upload_error: err,
          });
          continue;
        }

        const sha256 = await sha256Hex(bytes);
        const subtype = contentType.startsWith("video/") ? "video" as const : "image" as const;

        const created = await session.client.createAsset({
          catalogId: cat.catalogId,
          subtype,
          fileName: name,
          importedBy,
          sha256,
        });

        if (!created.ok || !created.data?.assetId) {
          // HTTP 412 = duplicate SHA-256 in catalog — skip master upload, still try album link if possible.
          if (created.status === 412) {
            skipped += 1;
            const msg = "Already in Lightroom catalog (duplicate detected).";
            results.push({
              hublyMediaId,
              name,
              status: "skipped_duplicate",
              error: msg,
            });
            mediaPatches.push({
              id: hublyMediaId,
              lightroom_upload_status: "skipped_duplicate",
              lightroom_upload_error: msg,
              lightroom_sha256: sha256,
            });
            console.warn("adobe upload duplicate", { projectId: opts.projectId, hublyMediaId, sha256 });
            continue;
          }
          throw new Error(created.error || `Create asset failed (${created.status})`);
        }

        const assetId = created.data.assetId;
        const master = await session.client.uploadMaster({
          catalogId: cat.catalogId,
          assetId,
          bytes,
          contentType,
        });
        if (!master.ok) {
          if (master.status === 413) {
            throw new Error("Adobe Lightroom storage is full (or file too large).");
          }
          if (master.status === 415) {
            throw new Error("Adobe rejected this file type — use JPEG, PNG, TIFF, DNG, or MP4.");
          }
          throw new Error(master.error || `Upload master failed (${master.status})`);
        }

        const linked = await session.client.addAssetToAlbum({
          catalogId: cat.catalogId,
          albumId,
          assetId,
          remoteIdPrefix: `hubly-${opts.projectId}`,
        });
        if (!linked.ok) {
          throw new Error(linked.error || "Uploaded to catalog but could not add to album");
        }

        uploaded += 1;
        newlyUploadedIds.push(assetId);
        const uploadedAt = new Date().toISOString();
        results.push({
          hublyMediaId,
          name,
          lightroomAssetId: assetId,
          status: "uploaded",
        });
        mediaPatches.push({
          id: hublyMediaId,
          lightroom_asset_id: assetId,
          lightroom_upload_status: "uploaded",
          lightroom_uploaded_at: uploadedAt,
          lightroom_upload_error: null,
        });
        console.log("adobe upload ok", {
          projectId: opts.projectId,
          hublyMediaId,
          assetId,
          bytes: bytes.byteLength,
        });
      } catch (e) {
        failed += 1;
        const err = e instanceof Error ? e.message : String(e);
        console.error("adobe upload failed", { projectId: opts.projectId, hublyMediaId, err });
        results.push({ hublyMediaId, name, status: "failed", error: err });
        mediaPatches.push({
          id: hublyMediaId,
          lightroom_upload_status: "failed",
          lightroom_upload_error: err,
        });
      }
    }

    const data: LightroomUploadResult = {
      uploaded,
      skipped,
      failed,
      albumId,
      catalogId: cat.catalogId,
      results,
      mediaPatches,
    };

    const ok = uploaded > 0 || (skipped > 0 && failed === 0);
    const message = uploaded
      ? `Uploaded ${uploaded} photo(s) to Lightroom` +
        (skipped ? ` · ${skipped} skipped` : "") +
        (failed ? ` · ${failed} failed` : "")
      : failed
      ? `Could not upload to Lightroom (${failed} failed` + (skipped ? `, ${skipped} skipped` : "") + ")"
      : skipped
      ? `Nothing new to upload (${skipped} already in Lightroom)`
      : "No photos uploaded";

    if (ok) {
      return providerOk(this.id, data, message, {
        adobeEndpoints: [
          "PUT /v2/catalogs/{catalog_id}/assets/{asset_id}",
          "PUT /v2/catalogs/{catalog_id}/assets/{asset_id}/master",
          "PUT /v2/catalogs/{catalog_id}/albums/{album_id}/assets",
        ],
        newlyUploadedIds,
      });
    }
    return {
      ok: false,
      status: "error" as const,
      provider: this.id,
      message,
      data,
      error: {
        code: "ADOBE_UPLOAD_FAILED",
        detail: message,
        retryable: true,
      },
      meta: {
        adobeEndpoints: [
          "PUT /v2/catalogs/{catalog_id}/assets/{asset_id}",
          "PUT /v2/catalogs/{catalog_id}/assets/{asset_id}/master",
          "PUT /v2/catalogs/{catalog_id}/albums/{album_id}/assets",
        ],
      },
    };
  }

  async openAlbum(opts: {
    businessId: string;
    albumId: string;
    catalogId?: string;
  }): Promise<HublyProviderResult<{ albumId: string; hint: string }>> {
    // No documented Lightroom deep-link URI for partner project albums.
    return unsupported(
      "Adobe does not document a deep-link URI to open a specific album. Open Adobe Lightroom → Connections to find this Hubly project album.",
      {
        albumId: opts.albumId,
        catalogId: opts.catalogId || null,
        hint: "Open Adobe Lightroom desktop or lightroom.adobe.com → Connections",
      },
    );
  }

  /* ─── Step 5: Sync (Hubly = system of record) ─── */

  async syncProject(opts: {
    businessId: string;
    projectId: string;
    albumId?: string;
    catalogId?: string;
    admin: AdminLike;
    mediaItems?: HublyMediaUploadItem[];
  }): Promise<HublyProviderResult<LightroomSyncResult>> {
    const session = await this.session(opts.admin, opts.businessId);
    if (!session.ok) return session.result as HublyProviderResult<LightroomSyncResult>;
    const cat = await this.resolveCatalogId(
      opts.admin,
      opts.businessId,
      session.client,
      session.ctx,
      opts.catalogId,
    );
    if (!cat.ok) return cat.result as HublyProviderResult<LightroomSyncResult>;

    const albumId = opts.albumId;
    if (!albumId) {
      return providerError(
        this.id,
        "ALBUM_REQUIRED",
        "Create or link a Lightroom album before syncing.",
        { retryable: false },
      );
    }

    const assetsRes = await session.client.listAlbumAssets(cat.catalogId, albumId);
    if (!assetsRes.ok || !assetsRes.data) {
      await this.oauth.touchSync(opts.admin, opts.businessId, assetsRes.error || "sync failed");
      return providerError(
        this.id,
        "ADOBE_SYNC_FAILED",
        assetsRes.error || "Could not list album assets",
        { retryable: true },
      );
    }

    const assets = assetsRes.data;
    const favorites = assets.filter((a) => a.favorite).length;
    const edited = assets.filter((a) => a.edited).length;
    const lastSyncAt = new Date().toISOString();

    // Match Hubly media by stored Lightroom asset ID first, then filename.
    const mediaItems = Array.isArray(opts.mediaItems) ? opts.mediaItems : [];
    const byLrId = new Map<string, HublyMediaUploadItem>();
    const byName = new Map<string, HublyMediaUploadItem[]>();
    for (const m of mediaItems) {
      if (m.lightroom_asset_id) byLrId.set(String(m.lightroom_asset_id), m);
      const key = String(m.name || "").toLowerCase();
      if (!key) continue;
      const list = byName.get(key) || [];
      list.push(m);
      byName.set(key, list);
    }

    const mediaPatches: LightroomMediaPatch[] = [];
    for (const a of assets) {
      let hubly = byLrId.get(a.id) || null;
      if (!hubly) {
        const nameKey = String(a.name || "").toLowerCase();
        const candidates = nameKey ? (byName.get(nameKey) || []) : [];
        hubly = candidates.find((c) => !c.lightroom_asset_id) || candidates[0] || null;
      }
      if (!hubly) continue;
      mediaPatches.push({
        id: hubly.id,
        lightroom_asset_id: a.id,
        lightroom_edited: a.edited,
        lightroom_favorite: a.favorite,
        lightroom_rating: a.rating ?? null,
        lightroom_flag: a.flag || null,
        lightroom_synced_at: lastSyncAt,
        // Preserve upload status if already uploaded; otherwise mark linked via sync.
        lightroom_upload_status: hubly.lightroom_upload_status === "uploaded"
          ? "uploaded"
          : (hubly.lightroom_asset_id ? hubly.lightroom_upload_status : "synced"),
      });
    }

    // Metadata only — never overwrite Hubly project name/status/gallery/invoices.
    const workspaceMetadata: Record<string, unknown> = {
      lightroom_sync: {
        catalog_id: cat.catalogId,
        album_id: albumId,
        photo_count: assets.length,
        favorites,
        edited,
        assets: assets.map((a) => ({
          id: a.id,
          name: a.name || null,
          favorite: a.favorite,
          edited: a.edited,
          flag: a.flag || null,
          rating: a.rating ?? null,
          captureDate: a.captureDate || null,
          keywords: a.keywords || [],
          camera: a.camera || null,
          lens: a.lens || null,
          width: a.width ?? null,
          height: a.height ?? null,
          gps: a.gps || null,
        })),
        synced_at: lastSyncAt,
      },
    };

    await this.oauth.touchSync(opts.admin, opts.businessId, null);

    const data: LightroomSyncResult = {
      projectId: opts.projectId,
      albumId,
      catalogId: cat.catalogId,
      imported: assets.length,
      exported: 0,
      favorites,
      edited,
      photoCount: assets.length,
      lastSyncAt,
      workspaceMetadata,
      mediaPatches,
    };

    return providerOk(
      this.id,
      data,
      `Synced ${assets.length} photo(s) · ${favorites} favorite(s) · ${edited} edited — Hubly project fields unchanged`,
      { hublySystemOfRecord: true, mediaMatched: mediaPatches.length },
    );
  }

  async publishGallery(_opts: {
    businessId: string;
    projectId: string;
    galleryId: string;
  }): Promise<HublyProviderResult<{ shareUrl?: string }>> {
    return providerOk(
      this.id,
      { shareUrl: undefined },
      "Gallery publish uses Hubly delivery. Adobe export is optional.",
      { adobeRequired: false },
    );
  }

  async archiveProject(_opts: {
    businessId: string;
    projectId: string;
  }): Promise<HublyProviderResult<{ archived: true }>> {
    return providerOk(
      this.id,
      { archived: true as const },
      "Project archived in Hubly. Adobe archive sync is optional and not wired.",
      { adobeRequired: false },
    );
  }

  /* ─── ExternalWorkspaceProvider ─── */

  async connectWorkspace(opts: {
    businessId: string;
    projectId: string;
    returnTo?: string;
  }): Promise<HublyProviderResult<{ authorizeUrl?: string; workspace?: ProjectWorkspace }>> {
    const connected = await this.connect({
      businessId: opts.businessId,
      returnTo: opts.returnTo,
    });
    if (!connected.ok) {
      return connected as HublyProviderResult<{ authorizeUrl?: string; workspace?: ProjectWorkspace }>;
    }
    return providerOk(
      this.id,
      {
        authorizeUrl: connected.data?.authorizeUrl,
        workspace: {
          id: "",
          projectId: opts.projectId,
          businessId: opts.businessId,
          provider: "adobe_lightroom",
          syncState: "pending",
          metadata: { via: "AdobeLightroomService.connectWorkspace" },
        },
      },
      "Adobe Lightroom connection started",
    );
  }

  async disconnectWorkspace(opts: {
    businessId: string;
    projectId: string;
    workspaceId?: string;
  }): Promise<HublyProviderResult<{ disconnected: true }>> {
    return this.disconnect({ businessId: opts.businessId });
  }

  async syncWorkspace(opts: {
    businessId: string;
    projectId: string;
    workspaceId?: string;
    albumId?: string;
    catalogId?: string;
    admin?: AdminLike;
  }): Promise<HublyProviderResult<ProjectWorkspace>> {
    if (!opts.admin) {
      return providerError(
        this.id,
        "ADMIN_REQUIRED",
        "syncWorkspace requires service-role admin context",
        { retryable: false },
      );
    }
    const synced = await this.syncProject({
      businessId: opts.businessId,
      projectId: opts.projectId,
      albumId: opts.albumId,
      catalogId: opts.catalogId,
      admin: opts.admin,
    });
    if (!synced.ok) return synced as HublyProviderResult<ProjectWorkspace>;
    return providerOk(
      this.id,
      {
        id: opts.workspaceId || "",
        projectId: opts.projectId,
        businessId: opts.businessId,
        provider: "adobe_lightroom",
        externalId: synced.data?.albumId || null,
        syncState: "synced",
        lastSyncAt: synced.data?.lastSyncAt || new Date().toISOString(),
        metadata: synced.data?.workspaceMetadata || {},
      },
      "Lightroom Connected App synced",
    );
  }

  /* ─── ConnectedAppProvider ─── */

  permissions(): ConnectedAppPermission[] {
    return [
      { id: "catalog:read", label: "Read catalogs", required: true },
      { id: "assets:read", label: "Read photos", required: true },
      { id: "assets:write", label: "Upload / sync photos", required: true },
    ];
  }

  capabilities(): ConnectedAppCapability[] {
    return ["editing", "assets_import", "assets_export"];
  }

  actions(): ConnectedAppAction[] {
    return [
      { id: "create_album", label: "Create Lightroom Album", capability: "editing" },
      { id: "upload_photos", label: "Upload to Lightroom", capability: "assets_export" },
      { id: "sync_photos", label: "Sync Photos", capability: "assets_import" },
      { id: "open_lightroom", label: "Open Lightroom", capability: "editing" },
    ];
  }

  async sync(opts: {
    businessId: string;
    projectId?: string;
    albumId?: string;
    catalogId?: string;
    admin?: AdminLike;
  }): Promise<HublyProviderResult<{ lastSyncAt: string }>> {
    if (!opts.projectId) {
      return providerError(this.id, "PROJECT_REQUIRED", "projectId required to sync Lightroom", {
        retryable: false,
      });
    }
    if (!opts.admin) {
      return providerError(this.id, "ADMIN_REQUIRED", "sync requires service-role admin", {
        retryable: false,
      });
    }
    const res = await this.syncProject({
      businessId: opts.businessId,
      projectId: opts.projectId,
      albumId: opts.albumId,
      catalogId: opts.catalogId,
      admin: opts.admin,
    });
    if (!res.ok) return res as HublyProviderResult<{ lastSyncAt: string }>;
    return providerOk(
      this.id,
      { lastSyncAt: res.data?.lastSyncAt || new Date().toISOString() },
      "Lightroom sync complete",
    );
  }
}

let _singleton: AdobeLightroomService | null = null;

export function getAdobeLightroomService(): AdobeLightroomService {
  if (!_singleton) {
    _singleton = new AdobeLightroomService();
    registerConnectedApp(_singleton);
  }
  return _singleton;
}

/** Convenience aliases matching the product API surface. */
export const AdobeLightroom = {
  connect: (opts: { businessId: string; returnTo?: string }) =>
    getAdobeLightroomService().connect(opts),
  disconnect: (opts: { businessId: string }) =>
    getAdobeLightroomService().disconnect(opts),
  refreshToken: (opts: { businessId: string }) =>
    getAdobeLightroomService().refreshToken(opts),
  health: (opts?: { businessId?: string; admin?: AdminLike }) =>
    getAdobeLightroomService().health(opts),
  status: (opts: { businessId: string; admin?: AdminLike }) =>
    getAdobeLightroomService().status(opts),
  createAlbum: (opts: {
    businessId: string;
    projectId: string;
    name: string;
    admin: AdminLike;
    existingAlbumId?: string | null;
    existingCatalogId?: string | null;
  }) => getAdobeLightroomService().createAlbum(opts),
  renameAlbum: (opts: {
    businessId: string;
    albumId: string;
    name: string;
    admin: AdminLike;
    catalogId?: string;
  }) => getAdobeLightroomService().renameAlbum(opts),
  listAlbums: (opts: { businessId: string; admin: AdminLike; subtype?: string }) =>
    getAdobeLightroomService().listAlbums(opts),
  listAssets: (opts: {
    businessId: string;
    albumId: string;
    admin: AdminLike;
    catalogId?: string;
  }) => getAdobeLightroomService().listAssets(opts),
  getAsset: (opts: {
    businessId: string;
    assetId: string;
    admin: AdminLike;
    catalogId?: string;
  }) => getAdobeLightroomService().getAsset(opts),
  downloadEditedAsset: (opts: {
    businessId: string;
    assetId: string;
    admin: AdminLike;
    catalogId?: string;
    renditionType?: string;
  }) => getAdobeLightroomService().downloadEditedAsset(opts),
  syncProject: (opts: {
    businessId: string;
    projectId: string;
    admin: AdminLike;
    albumId?: string;
    catalogId?: string;
    mediaItems?: HublyMediaUploadItem[];
  }) => getAdobeLightroomService().syncProject(opts),
  uploadPhotos: (opts: {
    businessId: string;
    projectId: string;
    albumId?: string;
    catalogId?: string;
    fileRefs: string[];
    admin: AdminLike;
    mediaItems?: HublyMediaUploadItem[];
  }) => getAdobeLightroomService().uploadPhotos(opts),
  openAlbum: (opts: { businessId: string; albumId: string; catalogId?: string }) =>
    getAdobeLightroomService().openAlbum(opts),
  publishGallery: (opts: {
    businessId: string;
    projectId: string;
    galleryId: string;
  }) => getAdobeLightroomService().publishGallery(opts),
  archiveProject: (opts: { businessId: string; projectId: string }) =>
    getAdobeLightroomService().archiveProject(opts),
};
