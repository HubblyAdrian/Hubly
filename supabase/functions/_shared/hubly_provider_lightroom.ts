/**
 * AdobeLightroomService — vendor boundary for Adobe Lightroom Classic / Cloud.
 *
 * Hubly is the OS around Lightroom. Photographers edit in Adobe;
 * Hubly manages everything before and after.
 *
 * Production-First:
 * - Interface + honest "Provider not configured" until Adobe credentials exist
 * - NEVER simulate successful Adobe API calls
 * - Projects work fully without Adobe — Lightroom enhances, never required
 *
 * UI must call through this service (or an Edge Function that uses it).
 * Do not call Adobe APIs from browser components.
 */

import {
  envTruthy,
  providerError,
  providerNotConfigured,
  providerOk,
  type HublyProviderResult,
} from "./hubly_providers.ts";

export type LightroomAlbum = {
  id: string;
  name: string;
  photoCount?: number;
};

export type LightroomAsset = {
  id: string;
  name?: string;
  favorite?: boolean;
  edited?: boolean;
  url?: string;
};

export type LightroomSyncResult = {
  projectId: string;
  albumId?: string;
  imported: number;
  exported: number;
  favorites: number;
  lastSyncAt: string;
};

export type LightroomConnection = {
  connected: boolean;
  accountEmail?: string;
  adobeUserId?: string;
};

const MISSING_ADOBE = [
  "ADOBE_CLIENT_ID",
  "ADOBE_CLIENT_SECRET",
] as const;

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
  }): Promise<HublyProviderResult<LightroomAlbum>>;
  renameAlbum(opts: {
    businessId: string;
    albumId: string;
    name: string;
  }): Promise<HublyProviderResult<LightroomAlbum>>;
  listAlbums(opts: { businessId: string }): Promise<HublyProviderResult<LightroomAlbum[]>>;
  syncProject(opts: {
    businessId: string;
    projectId: string;
  }): Promise<HublyProviderResult<LightroomSyncResult>>;
  uploadPhotos(opts: {
    businessId: string;
    projectId: string;
    albumId?: string;
    fileRefs: string[];
  }): Promise<HublyProviderResult<{ queued: number }>>;
  downloadEditedPhotos(opts: {
    businessId: string;
    projectId: string;
    albumId?: string;
  }): Promise<HublyProviderResult<{ assets: LightroomAsset[] }>>;
  listAssets(opts: {
    businessId: string;
    albumId: string;
  }): Promise<HublyProviderResult<LightroomAsset[]>>;
  getFavorites(opts: {
    businessId: string;
    albumId: string;
  }): Promise<HublyProviderResult<LightroomAsset[]>>;
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

/**
 * Adobe Lightroom vendor implementation.
 * Methods return PROVIDER_NOT_CONFIGURED until Adobe OAuth secrets exist.
 * When credentials are present, real Adobe API wiring lands here — not in the UI.
 */
export class AdobeLightroomService implements LightroomProvider {
  readonly id = "adobe_lightroom";

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

  async connect(_opts: {
    businessId: string;
    returnTo?: string;
  }): Promise<HublyProviderResult<{ authorizeUrl: string }>> {
    if (!this.isConfigured()) return this.notReady();
    // Future: build Adobe IMS authorize URL → Edge Function oauth-callback
    // Production callback pattern matches Google Calendar:
    // https://{project}.supabase.co/functions/v1/adobe-oauth-callback
    return providerError(
      this.id,
      "ADOBE_OAUTH_NOT_IMPLEMENTED",
      "Adobe Lightroom OAuth is designed but not wired yet. Projects still work without Adobe.",
      { retryable: false },
    );
  }

  async disconnect(_opts: {
    businessId: string;
  }): Promise<HublyProviderResult<{ disconnected: true }>> {
    if (!this.isConfigured()) return this.notReady();
    return providerError(
      this.id,
      "ADOBE_OAUTH_NOT_IMPLEMENTED",
      "Adobe disconnect is not wired yet.",
      { retryable: false },
    );
  }

  async refreshToken(_opts: {
    businessId: string;
  }): Promise<HublyProviderResult<{ expiresAt?: string }>> {
    if (!this.isConfigured()) return this.notReady();
    return providerError(
      this.id,
      "ADOBE_OAUTH_NOT_IMPLEMENTED",
      "Adobe token refresh is not wired yet.",
      { retryable: false },
    );
  }

  async createAlbum(_opts: {
    businessId: string;
    projectId: string;
    name: string;
  }): Promise<HublyProviderResult<LightroomAlbum>> {
    if (!this.isConfigured()) return this.notReady();
    return providerError(
      this.id,
      "ADOBE_API_NOT_IMPLEMENTED",
      "Create Lightroom album is not wired yet.",
      { retryable: false },
    );
  }

  async renameAlbum(_opts: {
    businessId: string;
    albumId: string;
    name: string;
  }): Promise<HublyProviderResult<LightroomAlbum>> {
    if (!this.isConfigured()) return this.notReady();
    return providerError(
      this.id,
      "ADOBE_API_NOT_IMPLEMENTED",
      "Rename Lightroom album is not wired yet.",
      { retryable: false },
    );
  }

  async listAlbums(_opts: {
    businessId: string;
  }): Promise<HublyProviderResult<LightroomAlbum[]>> {
    if (!this.isConfigured()) return this.notReady();
    return providerError(
      this.id,
      "ADOBE_API_NOT_IMPLEMENTED",
      "List Lightroom albums is not wired yet.",
      { retryable: false },
    );
  }

  async syncProject(_opts: {
    businessId: string;
    projectId: string;
  }): Promise<HublyProviderResult<LightroomSyncResult>> {
    if (!this.isConfigured()) return this.notReady();
    return providerError(
      this.id,
      "ADOBE_API_NOT_IMPLEMENTED",
      "Sync project with Lightroom is not wired yet.",
      { retryable: false },
    );
  }

  async uploadPhotos(_opts: {
    businessId: string;
    projectId: string;
    albumId?: string;
    fileRefs: string[];
  }): Promise<HublyProviderResult<{ queued: number }>> {
    if (!this.isConfigured()) return this.notReady();
    return providerError(
      this.id,
      "ADOBE_API_NOT_IMPLEMENTED",
      "Upload to Lightroom is not wired yet.",
      { retryable: false },
    );
  }

  async downloadEditedPhotos(_opts: {
    businessId: string;
    projectId: string;
    albumId?: string;
  }): Promise<HublyProviderResult<{ assets: LightroomAsset[] }>> {
    if (!this.isConfigured()) return this.notReady();
    return providerError(
      this.id,
      "ADOBE_API_NOT_IMPLEMENTED",
      "Download edited photos is not wired yet.",
      { retryable: false },
    );
  }

  async listAssets(_opts: {
    businessId: string;
    albumId: string;
  }): Promise<HublyProviderResult<LightroomAsset[]>> {
    if (!this.isConfigured()) return this.notReady();
    return providerError(
      this.id,
      "ADOBE_API_NOT_IMPLEMENTED",
      "List Lightroom assets is not wired yet.",
      { retryable: false },
    );
  }

  async getFavorites(_opts: {
    businessId: string;
    albumId: string;
  }): Promise<HublyProviderResult<LightroomAsset[]>> {
    if (!this.isConfigured()) return this.notReady();
    return providerError(
      this.id,
      "ADOBE_API_NOT_IMPLEMENTED",
      "Get Lightroom favorites is not wired yet.",
      { retryable: false },
    );
  }

  async publishGallery(_opts: {
    businessId: string;
    projectId: string;
    galleryId: string;
  }): Promise<HublyProviderResult<{ shareUrl?: string }>> {
    // Gallery publish is a Hubly capability — Adobe may enhance later.
    // Without Adobe, Hubly still publishes its own client gallery.
    return providerOk(
      this.id,
      { shareUrl: undefined },
      "Gallery publish uses Hubly delivery. Adobe export is optional and not wired yet.",
      { adobeRequired: false },
    );
  }

  async archiveProject(_opts: {
    businessId: string;
    projectId: string;
  }): Promise<HublyProviderResult<{ archived: true }>> {
    // Archiving in Hubly never requires Adobe. Optional Adobe archive lands later.
    return providerOk(
      this.id,
      { archived: true as const },
      "Project archived in Hubly. Adobe archive sync is optional and not wired yet.",
      { adobeRequired: false },
    );
  }
}

let _singleton: AdobeLightroomService | null = null;

export function getAdobeLightroomService(): AdobeLightroomService {
  if (!_singleton) _singleton = new AdobeLightroomService();
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
  createAlbum: (opts: { businessId: string; projectId: string; name: string }) =>
    getAdobeLightroomService().createAlbum(opts),
  renameAlbum: (opts: { businessId: string; albumId: string; name: string }) =>
    getAdobeLightroomService().renameAlbum(opts),
  listAlbums: (opts: { businessId: string }) =>
    getAdobeLightroomService().listAlbums(opts),
  syncProject: (opts: { businessId: string; projectId: string }) =>
    getAdobeLightroomService().syncProject(opts),
  uploadPhotos: (opts: {
    businessId: string;
    projectId: string;
    albumId?: string;
    fileRefs: string[];
  }) => getAdobeLightroomService().uploadPhotos(opts),
  downloadEditedPhotos: (opts: {
    businessId: string;
    projectId: string;
    albumId?: string;
  }) => getAdobeLightroomService().downloadEditedPhotos(opts),
  listAssets: (opts: { businessId: string; albumId: string }) =>
    getAdobeLightroomService().listAssets(opts),
  getFavorites: (opts: { businessId: string; albumId: string }) =>
    getAdobeLightroomService().getFavorites(opts),
  publishGallery: (opts: {
    businessId: string;
    projectId: string;
    galleryId: string;
  }) => getAdobeLightroomService().publishGallery(opts),
  archiveProject: (opts: { businessId: string; projectId: string }) =>
    getAdobeLightroomService().archiveProject(opts),
};
