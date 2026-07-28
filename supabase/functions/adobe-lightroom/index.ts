/**
 * Adobe Lightroom Connected App — authenticated API actions.
 * Uses stored OAuth tokens (service-role) + ADOBE_CLIENT_ID as X-API-Key.
 * Never returns access/refresh tokens to the browser.
 *
 * POST body: { action, business_id, project_id?, album_id?, ... }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAdobeLightroomService } from "../_shared/hubly_provider_lightroom.ts";
import { ADOBE_PROVIDER_ID } from "../_shared/adobe_oauth.ts";

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

function bytesToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function loadWorkspace(
  admin: ReturnType<typeof createClient>,
  projectId: string,
) {
  const { data } = await admin
    .from("photography_project_workspaces")
    .select("id,project_id,business_id,provider,external_id,display_name,sync_state,last_sync_at,metadata")
    .eq("project_id", projectId)
    .eq("provider", ADOBE_PROVIDER_ID)
    .maybeSingle();
  return data;
}

async function upsertWorkspace(
  admin: ReturnType<typeof createClient>,
  opts: {
    projectId: string;
    businessId: string;
    albumId: string;
    albumName: string;
    catalogId?: string;
    syncState: string;
    metadata?: Record<string, unknown>;
    lastSyncAt?: string | null;
  },
) {
  const existing = await loadWorkspace(admin, opts.projectId);
  const prevMeta = (existing?.metadata && typeof existing.metadata === "object")
    ? existing.metadata as Record<string, unknown>
    : {};
  const metadata = {
    ...prevMeta,
    ...(opts.metadata || {}),
    catalog_id: opts.catalogId || prevMeta.catalog_id || null,
    album_id: opts.albumId,
    album_name: opts.albumName,
  };
  const { data, error } = await admin.from("photography_project_workspaces").upsert({
    project_id: opts.projectId,
    business_id: opts.businessId,
    provider: ADOBE_PROVIDER_ID,
    external_id: opts.albumId,
    display_name: opts.albumName,
    sync_state: opts.syncState,
    last_sync_at: opts.lastSyncAt || existing?.last_sync_at || null,
    metadata,
    updated_at: new Date().toISOString(),
  }, { onConflict: "project_id,provider" }).select("*").maybeSingle();
  if (error) throw error;
  return data;
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
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return jsonRes({ error: "Auth isn’t configured on the server yet." }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim();
    const businessId = String(body?.business_id || body?.businessId || "").trim();
    if (!action) return jsonRes({ error: "action required" }, 400);
    if (!businessId) return jsonRes({ error: "business_id required" }, 400);

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

    const lr = getAdobeLightroomService();
    const projectId = String(body?.project_id || body?.projectId || "").trim();
    const albumId = String(body?.album_id || body?.albumId || "").trim();
    const assetId = String(body?.asset_id || body?.assetId || "").trim();
    const catalogId = String(body?.catalog_id || body?.catalogId || "").trim();
    const name = String(body?.name || "").trim();

    if (action === "health") {
      const res = await lr.health({ businessId, admin });
      return jsonRes({ ok: res.ok, ...res });
    }

    if (action === "status") {
      const res = await lr.status({ businessId, admin });
      return jsonRes({
        ok: res.ok,
        status: res.status,
        message: res.message,
        data: res.data,
        // Flat convenience for UI
        connected: res.data?.connected ?? false,
        adobe_account: res.data?.adobeAccount ?? null,
        token_expires_at: res.data?.tokenExpiresAt ?? null,
        last_refresh_at: res.data?.lastRefreshAt ?? null,
        catalog_id: res.data?.catalogId ?? null,
        health: res.data?.health ?? null,
        last_error: res.data?.lastError ?? null,
      });
    }

    if (action === "listAlbums") {
      const res = await lr.listAlbums({
        businessId,
        admin,
        subtype: body?.subtype ? String(body.subtype) : "project",
      });
      return jsonRes(res, res.ok ? 200 : 400);
    }

    if (action === "createAlbum") {
      if (!projectId) return jsonRes({ error: "project_id required" }, 400);
      const albumName = name || "Hubly Project";

      // Reuse linked workspace — never create duplicates.
      const ws = await loadWorkspace(admin, projectId);
      const existingAlbumId = ws?.external_id ||
        (ws?.metadata as Record<string, unknown> | null)?.album_id as string | undefined ||
        null;
      const existingCatalogId = catalogId ||
        (ws?.metadata as Record<string, unknown> | null)?.catalog_id as string | undefined ||
        null;

      const res = await lr.createAlbum({
        businessId,
        projectId,
        name: albumName,
        admin,
        existingAlbumId,
        existingCatalogId,
      });
      if (!res.ok || !res.data) return jsonRes(res, 400);

      await upsertWorkspace(admin, {
        projectId,
        businessId,
        albumId: res.data.id,
        albumName: res.data.name,
        catalogId: res.data.catalogId || existingCatalogId || undefined,
        syncState: "linked",
        metadata: {
          reused: !!res.meta?.reused,
          created_via: "adobe-lightroom:createAlbum",
        },
      });

      // Soft-update denormalized lightroom_status without overwriting other project fields.
      await admin.from("photography_projects").update({
        lightroom_status: "album_ready",
        updated_at: new Date().toISOString(),
      }).eq("id", projectId).eq("business_id", businessId);

      return jsonRes({
        ...res,
        workspace: { provider: ADOBE_PROVIDER_ID, external_id: res.data.id, sync_state: "linked" },
      });
    }

    if (action === "renameAlbum") {
      if (!albumId || !name) return jsonRes({ error: "album_id and name required" }, 400);
      const res = await lr.renameAlbum({
        businessId,
        albumId,
        name,
        catalogId: catalogId || undefined,
        admin,
      });
      if (res.ok && projectId) {
        await upsertWorkspace(admin, {
          projectId,
          businessId,
          albumId,
          albumName: name,
          catalogId: catalogId || undefined,
          syncState: "linked",
        });
      }
      return jsonRes(res, res.ok ? 200 : 400);
    }

    if (action === "listAssets" || action === "browsePhotos") {
      if (!albumId && projectId) {
        const ws = await loadWorkspace(admin, projectId);
        // Resolve linked album from workspace when browsing from a Hubly project.
        const linked = String(ws?.external_id ||
          (ws?.metadata as Record<string, unknown> | null)?.album_id || "");
        if (linked) (body as Record<string, unknown>).album_id = linked;
      }
      const browseAlbumId = albumId ||
        String((body as Record<string, unknown>).album_id || "");
      if (!browseAlbumId) return jsonRes({ error: "album_id or linked project required" }, 400);
      const res = await lr.listAssets({
        businessId,
        albumId: browseAlbumId,
        catalogId: catalogId || undefined,
        admin,
        flag: body?.flag ? String(body.flag) : undefined,
        limit: body?.limit != null ? Number(body.limit) : undefined,
      });
      if (!res.ok || !res.data) return jsonRes(res, 400);
      let assets = res.data;
      // Client-side Hubly filters (Adobe album list has limited query params).
      if (body?.favorites_only) assets = assets.filter((a) => !!a.favorite);
      if (body?.edited_only) assets = assets.filter((a) => !!a.edited);
      if (body?.min_rating != null) {
        const min = Number(body.min_rating);
        assets = assets.filter((a) => (a.rating ?? 0) >= min);
      }
      if (body?.keyword) {
        const kw = String(body.keyword).toLowerCase();
        assets = assets.filter((a) =>
          (a.keywords || []).some((k) => String(k).toLowerCase().includes(kw)) ||
          String(a.name || "").toLowerCase().includes(kw)
        );
      }
      if (body?.q) {
        const q = String(body.q).toLowerCase();
        assets = assets.filter((a) =>
          String(a.name || "").toLowerCase().includes(q) ||
          (a.keywords || []).some((k) => String(k).toLowerCase().includes(q)) ||
          String(a.camera || "").toLowerCase().includes(q)
        );
      }
      return jsonRes({ ...res, data: assets, message: `${assets.length} photo(s)` });
    }

    if (action === "getAsset" || action === "viewPhoto") {
      if (!assetId) return jsonRes({ error: "asset_id required" }, 400);
      const res = await lr.getAsset({
        businessId,
        assetId,
        catalogId: catalogId || undefined,
        admin,
      });
      return jsonRes(res, res.ok ? 200 : 400);
    }

    if (action === "getCatalog" || action === "readCatalog" || action === "syncCatalogMetadata") {
      const res = await lr.getCatalog({ businessId, admin });
      return jsonRes(res, res.ok ? 200 : 400);
    }

    if (action === "linkAlbum") {
      if (!projectId || !albumId) return jsonRes({ error: "project_id and album_id required" }, 400);
      const albumName = name || "Lightroom Album";
      await upsertWorkspace(admin, {
        projectId,
        businessId,
        albumId,
        albumName,
        catalogId: catalogId || undefined,
        syncState: "linked",
        metadata: { linked_via: "adobe-lightroom:linkAlbum" },
      });
      await admin.from("photography_projects").update({
        lightroom_status: "album_ready",
        updated_at: new Date().toISOString(),
      }).eq("id", projectId).eq("business_id", businessId);
      return jsonRes({
        ok: true,
        status: "ready",
        provider: ADOBE_PROVIDER_ID,
        message: `Linked ${albumName} to Hubly project`,
        data: { albumId, albumName, projectId },
      });
    }

    if (action === "unlinkAlbum") {
      if (!projectId) return jsonRes({ error: "project_id required" }, 400);
      const ws = await loadWorkspace(admin, projectId);
      if (!ws) {
        return jsonRes({
          ok: true,
          status: "ready",
          message: "No Lightroom album linked",
          data: { unlinked: true },
        });
      }
      await admin.from("photography_project_workspaces").update({
        sync_state: "unlinked",
        external_id: null,
        updated_at: new Date().toISOString(),
        metadata: {
          ...((ws.metadata && typeof ws.metadata === "object") ? ws.metadata as Record<string, unknown> : {}),
          unlinked_at: new Date().toISOString(),
          previous_album_id: ws.external_id,
        },
      }).eq("id", ws.id);
      await admin.from("photography_projects").update({
        lightroom_status: "not_connected",
        updated_at: new Date().toISOString(),
      }).eq("id", projectId).eq("business_id", businessId);
      return jsonRes({
        ok: true,
        status: "ready",
        provider: ADOBE_PROVIDER_ID,
        message: "Album unlinked from Hubly project (Adobe album unchanged)",
        data: { unlinked: true, previousAlbumId: ws.external_id },
      });
    }

    if (action === "downloadEditedAsset" || action === "exportFinalPhotos") {
      if (!assetId) return jsonRes({ error: "asset_id required" }, 400);
      const res = await lr.downloadEditedAsset({
        businessId,
        assetId,
        catalogId: catalogId || undefined,
        renditionType: body?.rendition_type ? String(body.rendition_type) : undefined,
        admin,
      });
      if (!res.ok || !res.data) return jsonRes(res, 400);
      // Return base64 — never expose OAuth tokens.
      return jsonRes({
        ok: true,
        status: res.status,
        provider: res.provider,
        message: res.message,
        data: {
          assetId: res.data.assetId,
          contentType: res.data.contentType,
          base64: bytesToBase64(res.data.bytes),
          renditionType: body?.rendition_type || "2048",
        },
      });
    }

    if (action === "openAlbum") {
      let openAlbumId = albumId;
      let openCatalogId = catalogId;
      if (!openAlbumId && projectId) {
        const ws = await loadWorkspace(admin, projectId);
        openAlbumId = String(ws?.external_id || "");
        openCatalogId = String(
          (ws?.metadata as Record<string, unknown> | null)?.catalog_id || catalogId || "",
        );
      }
      if (!openAlbumId) return jsonRes({ error: "album_id or linked project required" }, 400);
      const res = await lr.openAlbum({
        businessId,
        albumId: openAlbumId,
        catalogId: openCatalogId || undefined,
      });
      // Honest unsupported deep-link — still return hint for UI.
      return jsonRes({
        ...res,
        data: {
          albumId: openAlbumId,
          catalogId: openCatalogId || null,
          hint: "Open Adobe Lightroom → Connections to find this Hubly project album.",
        },
      }, 200);
    }

    if (action === "syncProject" || action === "sync") {
      if (!projectId) return jsonRes({ error: "project_id required" }, 400);
      const ws = await loadWorkspace(admin, projectId);
      const syncAlbumId = albumId || ws?.external_id ||
        String((ws?.metadata as Record<string, unknown> | null)?.album_id || "");
      const syncCatalogId = catalogId ||
        String((ws?.metadata as Record<string, unknown> | null)?.catalog_id || "");

      const res = await lr.syncProject({
        businessId,
        projectId,
        albumId: syncAlbumId || undefined,
        catalogId: syncCatalogId || undefined,
        admin,
      });
      if (!res.ok || !res.data) return jsonRes(res, 400);

      await upsertWorkspace(admin, {
        projectId,
        businessId,
        albumId: res.data.albumId || syncAlbumId,
        albumName: String(
          (ws?.display_name) ||
            (ws?.metadata as Record<string, unknown> | null)?.album_name ||
            "Lightroom Album",
        ),
        catalogId: res.data.catalogId,
        syncState: "synced",
        lastSyncAt: res.data.lastSyncAt,
        metadata: res.data.workspaceMetadata,
      });

      // Update hubly_app_connections last_sync_at only — no tokens.
      await admin.from("hubly_app_connections").upsert({
        business_id: businessId,
        provider: ADOBE_PROVIDER_ID,
        status: "connected",
        health: "healthy",
        last_sync_at: res.data.lastSyncAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: "business_id,provider" });

      return jsonRes(res);
    }

    if (action === "uploadPhotos") {
      const res = await lr.uploadPhotos({
        businessId,
        projectId: projectId || "",
        albumId: albumId || undefined,
        fileRefs: Array.isArray(body?.file_refs) ? body.file_refs.map(String) : [],
      });
      return jsonRes(res, 400);
    }

    return jsonRes({
      error: `Unknown action: ${action}`,
      supported: [
        "health",
        "status",
        "getCatalog",
        "readCatalog",
        "syncCatalogMetadata",
        "listAlbums",
        "createAlbum",
        "renameAlbum",
        "linkAlbum",
        "unlinkAlbum",
        "listAssets",
        "browsePhotos",
        "getAsset",
        "downloadEditedAsset",
        "exportFinalPhotos",
        "openAlbum",
        "syncProject",
        "uploadPhotos",
      ],
    }, 400);
  } catch (e) {
    console.error("adobe-lightroom", e);
    return jsonRes({ error: (e as Error)?.message || "Adobe Lightroom error" }, 500);
  }
});
