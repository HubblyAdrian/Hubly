/**
 * Hubly Studio API — owner CRUD for projects, pages, brand kit, assets, publish queue.
 * Auth: business owner JWT. Service-role after ownership check.
 *
 * Routes:
 * GET/PATCH     /settings
 * GET/PUT       /brand-kit
 * GET/POST      /projects
 * GET/PATCH/DELETE /projects/:id
 * GET/POST      /projects/:id/pages
 * PATCH         /projects/:id/pages/:pageId
 * GET/POST      /assets
 * DELETE        /assets/:id
 * GET           /templates
 * GET/POST      /queue
 * PATCH/DELETE  /queue/:id
 * GET/PUT       /social-accounts
 * GET           /dashboard  (home summary)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

function pathParts(req: Request): string[] {
  const u = new URL(req.url);
  const idx = u.pathname.indexOf("/studio-api");
  const rest = idx >= 0 ? u.pathname.slice(idx + "/studio-api".length) : u.pathname;
  return rest.split("/").filter(Boolean);
}

async function resolveBusinessId(
  admin: ReturnType<typeof createClient>,
  userId: string,
  bodyBiz?: string,
  queryBiz?: string | null,
) {
  const want = bodyBiz || queryBiz || "";
  let q = admin.from("businesses").select("id").eq("owner_id", userId);
  if (want) q = q.eq("id", want);
  const { data, error } = await q.limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id as string | undefined;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!supabaseUrl || !anon || !serviceKey) {
    return json({ error: "Server misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, serviceKey);

  const partsFromUrl = pathParts(req);
  let parts = partsFromUrl;
  const bodyEarly = ["POST", "PATCH", "PUT", "DELETE"].includes(req.method)
    ? await req.json().catch(() => ({}))
    : {};
  // supabase-js invoke often hits /studio-api without a suffix — allow body._path
  if ((!parts.length || (parts.length === 0)) && (bodyEarly as { _path?: string })._path) {
    parts = String((bodyEarly as { _path: string })._path).split("/").filter(Boolean);
  }
  const methodOverride = String((bodyEarly as { _method?: string })._method || req.method).toUpperCase();
  const resource = parts[0] || "";
  const id = parts[1] || "";
  const sub = parts[2] || "";
  const subId = parts[3] || "";

  // Global templates catalog — readable without owner when published
  if (methodOverride === "GET" && resource === "templates" && !id) {
    const { data, error } = await admin
      .from("studio_templates")
      .select("*")
      .eq("published", true)
      .order("featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(100);
    if (error) return json({ error: error.message }, 400);
    return json({ templates: data || [] });
  }

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
  const userId = userData.user.id;

  const body = bodyEarly;
  const url = new URL(req.url);

  // Rebind method checks to methodOverride via local alias
  const method = methodOverride;

  let businessId: string | undefined;
  try {
    businessId = await resolveBusinessId(
      admin,
      userId,
      (body as { business_id?: string }).business_id,
      url.searchParams.get("business_id"),
    );
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
  if (!businessId) return json({ error: "No business for owner" }, 403);

  async function ensureSettings() {
    const { data } = await admin
      .from("studio_settings")
      .select("*")
      .eq("business_id", businessId!)
      .maybeSingle();
    if (data) return data;
    const { data: created, error } = await admin
      .from("studio_settings")
      .insert({ business_id: businessId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return created;
  }

  try {
    // ── settings ──
    if (resource === "settings" && method === "GET") {
      const settings = await ensureSettings();
      return json({ settings });
    }
    if (resource === "settings" && method === "PATCH") {
      await ensureSettings();
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if ((body as { enabled?: boolean }).enabled != null) patch.enabled = !!(body as { enabled: boolean }).enabled;
      if ((body as { preferences?: object }).preferences) patch.preferences = (body as { preferences: object }).preferences;
      if ((body as { canva_linked?: boolean }).canva_linked != null) {
        patch.canva_linked = !!(body as { canva_linked: boolean }).canva_linked;
      }
      const { data, error } = await admin
        .from("studio_settings")
        .update(patch)
        .eq("business_id", businessId)
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ settings: data });
    }

    // ── brand-kit ──
    if (resource === "brand-kit" && method === "GET") {
      const { data } = await admin
        .from("studio_brand_kit")
        .select("*")
        .eq("business_id", businessId)
        .maybeSingle();
      return json({
        brandKit: data || {
          business_id: businessId,
          logos: [],
          colors: [],
          typography: {},
          voice_tones: [],
        },
      });
    }
    if (resource === "brand-kit" && (method === "PUT" || method === "PATCH")) {
      const row = {
        business_id: businessId,
        logos: (body as { logos?: unknown }).logos ?? [],
        colors: (body as { colors?: unknown }).colors ?? [],
        typography: (body as { typography?: unknown }).typography ?? {},
        voice_tones: (body as { voice_tones?: unknown }).voice_tones ?? [],
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await admin
        .from("studio_brand_kit")
        .upsert(row, { onConflict: "business_id" })
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ brandKit: data });
    }

    // ── dashboard summary ──
    if (resource === "dashboard" && method === "GET") {
      const settings = await ensureSettings();
      const [{ data: projects }, { data: queue }, { data: accounts }] = await Promise.all([
        admin
          .from("studio_projects")
          .select("id,title,status,format_primary,thumbnail_url,last_edited_at")
          .eq("business_id", businessId)
          .order("last_edited_at", { ascending: false })
          .limit(8),
        admin
          .from("studio_publish_queue")
          .select("*")
          .eq("business_id", businessId)
          .order("scheduled_at", { ascending: true, nullsFirst: false })
          .limit(8),
        admin.from("studio_social_accounts").select("*").eq("business_id", businessId),
      ]);
      return json({
        settings,
        recentProjects: projects || [],
        queue: queue || [],
        socialAccounts: accounts || [],
      });
    }

    // ── projects ──
    if (resource === "projects" && method === "GET" && !id) {
      const { data, error } = await admin
        .from("studio_projects")
        .select("*")
        .eq("business_id", businessId)
        .order("last_edited_at", { ascending: false })
        .limit(100);
      if (error) return json({ error: error.message }, 400);
      return json({ projects: data || [] });
    }
    if (resource === "projects" && method === "POST" && !id) {
      const title = String((body as { title?: string }).title || "Untitled project").trim();
      const format = String((body as { format_primary?: string }).format_primary || "instagram_post");
      const dims: Record<string, [number, number]> = {
        instagram_post: [1080, 1080],
        facebook_feed: [1200, 630],
        facebook_post: [1200, 630],
        instagram_story: [1080, 1920],
        print_flyer: [1275, 1650],
        google_business: [720, 720],
        email_header: [600, 200],
      };
      const [w, h] = dims[format] || [1080, 1080];
      const { data: project, error } = await admin
        .from("studio_projects")
        .insert({
          business_id: businessId,
          title,
          format_primary: format,
          platform: (body as { platform?: string }).platform || "instagram",
          style: (body as { style?: string }).style || "bold",
          tone: (body as { tone?: string }).tone || "expert",
          prompt: (body as { prompt?: string }).prompt || "",
          source: (body as { source?: object }).source || {},
          canvas: (body as { canvas?: object }).canvas || {},
          status: "draft",
        })
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 400);
      await admin.from("studio_project_pages").insert({
        business_id: businessId,
        project_id: project.id,
        format,
        label: format.replace(/_/g, " "),
        width: w,
        height: h,
        sort_order: 0,
      });
      return json({ project }, 201);
    }
    if (resource === "projects" && id && method === "GET" && !sub) {
      const { data: project, error } = await admin
        .from("studio_projects")
        .select("*")
        .eq("business_id", businessId)
        .eq("id", id)
        .maybeSingle();
      if (error) return json({ error: error.message }, 400);
      if (!project) return json({ error: "not_found" }, 404);
      const { data: pages } = await admin
        .from("studio_project_pages")
        .select("*")
        .eq("project_id", id)
        .order("sort_order");
      return json({ project, pages: pages || [] });
    }
    if (resource === "projects" && id && method === "PATCH" && !sub) {
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        last_edited_at: new Date().toISOString(),
      };
      for (const k of [
        "title",
        "status",
        "format_primary",
        "thumbnail_url",
        "prompt",
        "platform",
        "style",
        "tone",
        "source",
        "canvas",
        "metadata",
      ]) {
        if ((body as Record<string, unknown>)[k] !== undefined) {
          patch[k] = (body as Record<string, unknown>)[k];
        }
      }
      const { data, error } = await admin
        .from("studio_projects")
        .update(patch)
        .eq("business_id", businessId)
        .eq("id", id)
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ project: data });
    }
    if (resource === "projects" && id && method === "DELETE" && !sub) {
      const { error } = await admin
        .from("studio_projects")
        .delete()
        .eq("business_id", businessId)
        .eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // project pages
    if (resource === "projects" && id && sub === "pages" && method === "GET") {
      const { data, error } = await admin
        .from("studio_project_pages")
        .select("*")
        .eq("business_id", businessId)
        .eq("project_id", id)
        .order("sort_order");
      if (error) return json({ error: error.message }, 400);
      return json({ pages: data || [] });
    }
    if (resource === "projects" && id && sub === "pages" && method === "POST") {
      const format = String((body as { format?: string }).format || "instagram_post");
      const { data, error } = await admin
        .from("studio_project_pages")
        .insert({
          business_id: businessId,
          project_id: id,
          format,
          label: (body as { label?: string }).label || format.replace(/_/g, " "),
          width: Number((body as { width?: number }).width) || 1080,
          height: Number((body as { height?: number }).height) || 1080,
          canvas: (body as { canvas?: object }).canvas || {},
          sort_order: Number((body as { sort_order?: number }).sort_order) || 0,
        })
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ page: data }, 201);
    }
    if (resource === "projects" && id && sub === "pages" && subId && method === "PATCH") {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of ["label", "width", "height", "canvas", "sort_order", "format"]) {
        if ((body as Record<string, unknown>)[k] !== undefined) {
          patch[k] = (body as Record<string, unknown>)[k];
        }
      }
      const { data, error } = await admin
        .from("studio_project_pages")
        .update(patch)
        .eq("business_id", businessId)
        .eq("project_id", id)
        .eq("id", subId)
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 400);
      await admin
        .from("studio_projects")
        .update({ last_edited_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", id);
      return json({ page: data });
    }

    // ── assets ──
    if (resource === "assets" && method === "GET") {
      const { data, error } = await admin
        .from("studio_assets")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) return json({ error: error.message }, 400);
      return json({ assets: data || [] });
    }
    if (resource === "assets" && method === "POST") {
      const urlStr = String((body as { url?: string }).url || "").trim();
      if (!urlStr) return json({ error: "url required" }, 400);
      const bytes = Number((body as { bytes?: number }).bytes) || 0;
      const { data, error } = await admin
        .from("studio_assets")
        .insert({
          business_id: businessId,
          name: (body as { name?: string }).name || "Asset",
          kind: (body as { kind?: string }).kind || "upload",
          url: urlStr,
          thumb_url: (body as { thumb_url?: string }).thumb_url || null,
          bytes,
          width: (body as { width?: number }).width ?? null,
          height: (body as { height?: number }).height ?? null,
          source: (body as { source?: object }).source || {},
        })
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 400);
      if (bytes > 0) {
        await admin.rpc; // no-op placeholder — bump usage via settings
        const settings = await ensureSettings();
        await admin
          .from("studio_settings")
          .update({
            storage_used_bytes: Number(settings.storage_used_bytes || 0) + bytes,
            updated_at: new Date().toISOString(),
          })
          .eq("business_id", businessId);
      }
      return json({ asset: data }, 201);
    }
    if (resource === "assets" && id && method === "DELETE") {
      const { data: existing } = await admin
        .from("studio_assets")
        .select("bytes")
        .eq("business_id", businessId)
        .eq("id", id)
        .maybeSingle();
      const { error } = await admin
        .from("studio_assets")
        .delete()
        .eq("business_id", businessId)
        .eq("id", id);
      if (error) return json({ error: error.message }, 400);
      if (existing?.bytes) {
        const settings = await ensureSettings();
        await admin
          .from("studio_settings")
          .update({
            storage_used_bytes: Math.max(0, Number(settings.storage_used_bytes || 0) - Number(existing.bytes)),
            updated_at: new Date().toISOString(),
          })
          .eq("business_id", businessId);
      }
      return json({ ok: true });
    }

    // ── queue ──
    if (resource === "queue" && method === "GET") {
      const { data, error } = await admin
        .from("studio_publish_queue")
        .select("*")
        .eq("business_id", businessId)
        .order("scheduled_at", { ascending: true, nullsFirst: false })
        .limit(50);
      if (error) return json({ error: error.message }, 400);
      return json({ queue: data || [] });
    }
    if (resource === "queue" && method === "POST") {
      const title = String((body as { title?: string }).title || "").trim();
      if (!title) return json({ error: "title required" }, 400);
      const { data, error } = await admin
        .from("studio_publish_queue")
        .insert({
          business_id: businessId,
          project_id: (body as { project_id?: string }).project_id || null,
          title,
          caption: (body as { caption?: string }).caption || "",
          channels: (body as { channels?: string[] }).channels || [],
          scheduled_at: (body as { scheduled_at?: string }).scheduled_at || null,
          status: (body as { status?: string }).status || "draft",
          thumbnail_url: (body as { thumbnail_url?: string }).thumbnail_url || null,
        })
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ item: data }, 201);
    }
    if (resource === "queue" && id && method === "PATCH") {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of ["title", "caption", "channels", "scheduled_at", "status", "thumbnail_url", "result", "project_id"]) {
        if ((body as Record<string, unknown>)[k] !== undefined) {
          patch[k] = (body as Record<string, unknown>)[k];
        }
      }
      // Stage 1: publishing to Meta/Google is not simulated
      if (patch.status === "publishing" || patch.status === "published") {
        return json({
          error: "Provider not configured",
          message: "Connect Instagram / Facebook / Google Business via Apps to publish live.",
        }, 503);
      }
      const { data, error } = await admin
        .from("studio_publish_queue")
        .update(patch)
        .eq("business_id", businessId)
        .eq("id", id)
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ item: data });
    }
    if (resource === "queue" && id && method === "DELETE") {
      const { error } = await admin
        .from("studio_publish_queue")
        .delete()
        .eq("business_id", businessId)
        .eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // ── social accounts ──
    if (resource === "social-accounts" && method === "GET") {
      const { data, error } = await admin
        .from("studio_social_accounts")
        .select("*")
        .eq("business_id", businessId);
      if (error) return json({ error: error.message }, 400);
      return json({ accounts: data || [] });
    }
    if (resource === "social-accounts" && (method === "PUT" || method === "POST")) {
      const provider = String((body as { provider?: string }).provider || "");
      if (!["instagram", "facebook", "google_business"].includes(provider)) {
        return json({ error: "invalid provider" }, 400);
      }
      // Do not invent Connected — default not_connected unless caller has real link
      const status = String((body as { status?: string }).status || "not_connected");
      if (status === "connected" || status === "sync_active") {
        // Honest gate: without Connected Apps OAuth, refuse fake connected
        const force = !!(body as { force_demo?: boolean }).force_demo;
        if (!force) {
          return json({
            error: "Provider not configured",
            message: "Connect this account via Apps Marketplace first.",
          }, 503);
        }
      }
      const row = {
        business_id: businessId,
        provider,
        handle: (body as { handle?: string }).handle || "",
        display_name: (body as { display_name?: string }).display_name || "",
        status,
        external_id: (body as { external_id?: string }).external_id || null,
        metadata: (body as { metadata?: object }).metadata || {},
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await admin
        .from("studio_social_accounts")
        .upsert(row, { onConflict: "business_id,provider" })
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ account: data });
    }

    return json({ error: "not_found", path: parts }, 404);
  } catch (e) {
    return json({ error: (e as Error).message || "Server error" }, 500);
  }
});
