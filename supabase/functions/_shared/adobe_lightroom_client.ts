/**
 * AdobeLightroomClient — Lightroom Services path helpers only.
 * Does not manage OAuth; callers pass an authenticated AdobeHttpClient.
 *
 * @see docs/architecture/ADOBE_LIGHTROOM_API_COMPATIBILITY.md
 * @see https://developer.adobe.com/lightroom/lightroom-api-docs/
 */

import {
  AdobeHttpClient,
  adobePublicHealth,
  type AdobeHttpResult,
} from "./adobe_http_client.ts";
import { adobeClientId } from "./adobe_oauth.ts";

export type LrCatalog = {
  id: string;
  name?: string;
  created?: string;
  updated?: string;
  raw?: unknown;
};

export type LrAlbum = {
  id: string;
  name: string;
  subtype?: string;
  serviceId?: string;
  created?: string;
  updated?: string;
  photoCount?: number;
  raw?: unknown;
};

export type LrAsset = {
  id: string;
  name?: string;
  subtype?: string;
  favorite: boolean;
  edited: boolean;
  rating?: number;
  flag?: string;
  captureDate?: string;
  updated?: string;
  keywords?: string[];
  camera?: string;
  lens?: string;
  width?: number;
  height?: number;
  gps?: { latitude?: number; longitude?: number; altitude?: number };
  raw?: unknown;
};

export type LrRendition = {
  assetId: string;
  renditionType: string;
  contentType: string | null;
  bytes: ArrayBuffer;
};

/** RFC-4122 UUID without hyphens (Adobe album/asset id convention). */
export function adobeUuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  // Fallback
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function resourcesOf(data: unknown): unknown[] {
  if (!data || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.resources)) return d.resources;
  if (Array.isArray(data)) return data as unknown[];
  return [];
}

function mapAlbum(row: unknown): LrAlbum | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const payload = (r.payload || {}) as Record<string, unknown>;
  const id = String(r.id || "");
  if (!id) return null;
  return {
    id,
    name: String(payload.name || r.name || "Untitled"),
    subtype: r.subtype ? String(r.subtype) : undefined,
    serviceId: r.serviceId ? String(r.serviceId) : undefined,
    created: r.created ? String(r.created) : undefined,
    updated: r.updated ? String(r.updated) : undefined,
    raw: row,
  };
}

function isFavorite(payload: Record<string, unknown>): boolean {
  const flag = String(payload.flag || "").toLowerCase();
  return flag === "pick" || flag === "flagged";
}

function isEdited(payload: Record<string, unknown>, row: Record<string, unknown>): boolean {
  if (payload.develop && typeof payload.develop === "object") return true;
  const links = (row.links || {}) as Record<string, unknown>;
  if (links["/rels/xmp/develop"] || links.xmp_develop || links.develop) return true;
  return false;
}

function asStringArray(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map((v) => {
      if (typeof v === "string") return v;
      if (v && typeof v === "object" && "value" in (v as object)) {
        return String((v as { value: unknown }).value);
      }
      return String(v);
    }).filter(Boolean);
  }
  if (typeof val === "string") {
    return val.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function pickKeywords(xmp: Record<string, unknown>, payload: Record<string, unknown>): string[] {
  const candidates = [
    xmp.subject,
    xmp.keywords,
    xmp.Keyword,
    xmp["dc:subject"],
    (xmp.dc && typeof xmp.dc === "object" ? (xmp.dc as Record<string, unknown>).subject : null),
    payload.keywords,
    payload.subject,
  ];
  const out: string[] = [];
  const seen: Record<string, boolean> = {};
  for (const c of candidates) {
    for (const k of asStringArray(c)) {
      const key = k.toLowerCase();
      if (!seen[key]) {
        seen[key] = true;
        out.push(k);
      }
    }
  }
  return out;
}

function pickCameraLens(xmp: Record<string, unknown>, payload: Record<string, unknown>) {
  const exif = (xmp.exif || xmp.EXIF || payload.exif || {}) as Record<string, unknown>;
  const tiff = (xmp.tiff || xmp.TIFF || {}) as Record<string, unknown>;
  const camera = String(
    exif.Model || exif.model || tiff.Model || xmp.Model || payload.camera || "",
  ) || undefined;
  const lens = String(
    exif.LensModel || exif.Lens || exif.lensModel || xmp.LensModel || payload.lens || "",
  ) || undefined;
  return { camera, lens };
}

function pickDimensions(xmp: Record<string, unknown>, payload: Record<string, unknown>, importSource: Record<string, unknown>) {
  const exif = (xmp.exif || xmp.EXIF || {}) as Record<string, unknown>;
  const w = Number(
    importSource.width || payload.width || exif.PixelXDimension || xmp.PixelXDimension || 0,
  );
  const h = Number(
    importSource.height || payload.height || exif.PixelYDimension || xmp.PixelYDimension || 0,
  );
  return {
    width: Number.isFinite(w) && w > 0 ? w : undefined,
    height: Number.isFinite(h) && h > 0 ? h : undefined,
  };
}

function mapAsset(row: unknown): LrAsset | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  // Album-asset responses nest the catalog asset under `asset` sometimes.
  const nested = (r.asset && typeof r.asset === "object") ? r.asset as Record<string, unknown> : r;
  const payload = (nested.payload || r.payload || {}) as Record<string, unknown>;
  const id = String(nested.id || r.id || "");
  if (!id) return null;
  const importSource = (payload.importSource || {}) as Record<string, unknown>;
  const xmp = (payload.xmp && typeof payload.xmp === "object")
    ? payload.xmp as Record<string, unknown>
    : {};
  const location = (payload.location && typeof payload.location === "object")
    ? payload.location as Record<string, unknown>
    : null;
  const cam = pickCameraLens(xmp, payload);
  const dims = pickDimensions(xmp, payload, importSource);
  return {
    id,
    name: importSource.fileName
      ? String(importSource.fileName)
      : (payload.name ? String(payload.name) : undefined),
    subtype: nested.subtype ? String(nested.subtype) : undefined,
    favorite: isFavorite(payload),
    edited: isEdited(payload, nested),
    rating: typeof payload.rating === "number" ? payload.rating : undefined,
    flag: payload.flag ? String(payload.flag) : undefined,
    captureDate: payload.captureDate ? String(payload.captureDate) : undefined,
    updated: nested.updated ? String(nested.updated) : undefined,
    keywords: pickKeywords(xmp, payload),
    camera: cam.camera,
    lens: cam.lens,
    width: dims.width,
    height: dims.height,
    gps: location
      ? {
        latitude: typeof location.latitude === "number" ? location.latitude : undefined,
        longitude: typeof location.longitude === "number" ? location.longitude : undefined,
        altitude: typeof location.altitude === "number" ? location.altitude : undefined,
      }
      : undefined,
    raw: row,
  };
}

export class AdobeLightroomClient {
  readonly http: AdobeHttpClient;

  constructor(http: AdobeHttpClient) {
    this.http = http;
  }

  static async publicHealth() {
    return adobePublicHealth();
  }

  /** GET /v2/catalog — customer's single catalog. */
  async getCatalog(): Promise<AdobeHttpResult<LrCatalog>> {
    const res = await this.http.get<Record<string, unknown>>("/catalog");
    if (!res.ok || !res.data) {
      return { ...res, data: null, error: res.error || "Could not load Lightroom catalog" };
    }
    const id = String(res.data.id || "");
    if (!id) {
      return { ...res, ok: false, data: null, error: "Catalog id missing from Adobe response" };
    }
    const payload = (res.data.payload || {}) as Record<string, unknown>;
    return {
      ...res,
      data: {
        id,
        name: payload.name ? String(payload.name) : undefined,
        created: res.data.created ? String(res.data.created) : undefined,
        updated: res.data.updated ? String(res.data.updated) : undefined,
        raw: res.data,
      },
    };
  }

  /** GET /v2/catalogs/{catalog_id}/albums */
  async listAlbums(
    catalogId: string,
    opts?: { subtype?: string },
  ): Promise<AdobeHttpResult<LrAlbum[]>> {
    const res = await this.http.get<unknown>(`/catalogs/${encodeURIComponent(catalogId)}/albums`, {
      subtype: opts?.subtype,
    });
    if (!res.ok) return { ...res, data: null };
    const albums = resourcesOf(res.data).map(mapAlbum).filter(Boolean) as LrAlbum[];
    return { ...res, data: albums };
  }

  /** GET /v2/catalogs/{catalog_id}/albums/{album_id} */
  async getAlbum(
    catalogId: string,
    albumId: string,
  ): Promise<AdobeHttpResult<LrAlbum>> {
    const res = await this.http.get<unknown>(
      `/catalogs/${encodeURIComponent(catalogId)}/albums/${encodeURIComponent(albumId)}`,
    );
    if (!res.ok) return { ...res, data: null };
    const album = mapAlbum(res.data);
    if (!album) return { ...res, ok: false, data: null, error: "Album not found" };
    return { ...res, data: album };
  }

  /**
   * PUT /v2/catalogs/{catalog_id}/albums/{album_id}
   * Partner project album — subtype=project, serviceId=API key.
   */
  async createProjectAlbum(opts: {
    catalogId: string;
    name: string;
    albumId?: string;
    remoteId?: string;
    viewHref?: string;
    editHref?: string;
  }): Promise<AdobeHttpResult<LrAlbum>> {
    const albumId = opts.albumId || adobeUuid();
    const apiKey = adobeClientId();
    if (!apiKey) {
      return {
        ok: false,
        status: 503,
        data: null,
        rawText: "",
        headers: new Headers(),
        error: "ADOBE_CLIENT_ID required",
      };
    }
    const now = new Date().toISOString();
    const body: Record<string, unknown> = {
      subtype: "project",
      serviceId: apiKey,
      payload: {
        userCreated: now,
        userUpdated: now,
        name: opts.name,
        publishInfo: {
          version: 3,
          created: now,
          updated: now,
          remoteId: opts.remoteId || undefined,
          remoteLinks: {
            ...(opts.viewHref ? { view: { href: opts.viewHref } } : {}),
            ...(opts.editHref ? { edit: { href: opts.editHref } } : {}),
          },
        },
      },
    };

    const res = await this.http.put<unknown>(
      `/catalogs/${encodeURIComponent(opts.catalogId)}/albums/${encodeURIComponent(albumId)}`,
      body,
    );
    if (!res.ok) return { ...res, data: null };

    // PUT may return empty body — re-fetch or synthesize.
    if (res.data) {
      const mapped = mapAlbum(res.data);
      if (mapped) return { ...res, data: mapped };
    }
    return {
      ...res,
      data: {
        id: albumId,
        name: opts.name,
        subtype: "project",
        serviceId: apiKey,
      },
    };
  }

  /**
   * POST /v2/catalogs/{catalog_id}/albums/{album_id}
   * Update album created by same client (project / project_set).
   */
  async renameAlbum(opts: {
    catalogId: string;
    albumId: string;
    name: string;
  }): Promise<AdobeHttpResult<LrAlbum>> {
    const now = new Date().toISOString();
    const apiKey = adobeClientId();
    const body = {
      subtype: "project",
      serviceId: apiKey,
      payload: {
        name: opts.name,
        userUpdated: now,
      },
    };
    const res = await this.http.post<unknown>(
      `/catalogs/${encodeURIComponent(opts.catalogId)}/albums/${encodeURIComponent(opts.albumId)}`,
      body,
    );
    if (!res.ok) return { ...res, data: null };
    if (res.data) {
      const mapped = mapAlbum(res.data);
      if (mapped) return { ...res, data: mapped };
    }
    return {
      ...res,
      data: { id: opts.albumId, name: opts.name, subtype: "project" },
    };
  }

  /** GET /v2/catalogs/{catalog_id}/albums/{album_id}/assets */
  async listAlbumAssets(
    catalogId: string,
    albumId: string,
    opts?: { limit?: number; flag?: string },
  ): Promise<AdobeHttpResult<LrAsset[]>> {
    const res = await this.http.get<unknown>(
      `/catalogs/${encodeURIComponent(catalogId)}/albums/${encodeURIComponent(albumId)}/assets`,
      {
        limit: opts?.limit,
        flag: opts?.flag,
      },
    );
    if (!res.ok) return { ...res, data: null };
    const assets = resourcesOf(res.data).map(mapAsset).filter(Boolean) as LrAsset[];
    return { ...res, data: assets };
  }

  /** GET /v2/catalogs/{catalog_id}/assets/{asset_id} */
  async getAsset(
    catalogId: string,
    assetId: string,
  ): Promise<AdobeHttpResult<LrAsset>> {
    const res = await this.http.get<unknown>(
      `/catalogs/${encodeURIComponent(catalogId)}/assets/${encodeURIComponent(assetId)}`,
    );
    if (!res.ok) return { ...res, data: null };
    const asset = mapAsset(res.data);
    if (!asset) return { ...res, ok: false, data: null, error: "Asset not found" };
    return { ...res, data: asset };
  }

  /**
   * GET /v2/catalogs/{catalog_id}/assets/{asset_id}/renditions/{rendition_type}
   * Default type 2048 (common preview size in Adobe samples).
   */
  async getRendition(opts: {
    catalogId: string;
    assetId: string;
    renditionType?: string;
  }): Promise<AdobeHttpResult<LrRendition>> {
    const type = opts.renditionType || "2048";
    const res = await this.http.request<ArrayBuffer>(
      "GET",
      `/catalogs/${encodeURIComponent(opts.catalogId)}/assets/${encodeURIComponent(opts.assetId)}/renditions/${encodeURIComponent(type)}`,
      { binary: true },
    );
    if (!res.ok || !res.data) return { ...res, data: null };
    return {
      ...res,
      data: {
        assetId: opts.assetId,
        renditionType: type,
        contentType: res.headers.get("content-type"),
        bytes: res.data,
      },
    };
  }
}

export function createLightroomClient(accessToken: string): AdobeLightroomClient {
  return new AdobeLightroomClient(new AdobeHttpClient({ accessToken }));
}
