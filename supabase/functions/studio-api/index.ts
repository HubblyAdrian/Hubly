/**
 * Hubly Studio API — owner CRUD for projects, pages, brand kit, assets, publish queue.
 * Campaign Engine: goals, suggestions, structured Campaign Plans (marketing brain).
 * Auth: business owner JWT. Service-role after ownership check.
 *
 * Routes:
 * GET/PATCH     /settings
 * GET/PUT       /brand-kit
 * GET/POST      /projects
 * GET/PATCH/DELETE /projects/:id
 * GET/POST      /projects/:id/pages
 * PATCH         /projects/:id/pages/:pageId
 * GET           /projects/:id/workspace
 * POST          /projects/:id/customize  (Canva — Provider not configured until OAuth)
 * GET           /projects/:id/versions | exports
 * GET/POST      /assets
 * DELETE        /assets/:id
 * GET           /templates
 * GET           /campaign/goals | /campaign/suggest
 * POST          /campaign/plan
 * GET/POST      /campaign/plans
 * GET           /campaign/plans/:id
 * GET/POST      /queue
 * PATCH/DELETE  /queue/:id
 * GET/PUT       /social-accounts
 * GET           /dashboard  (home summary)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildCampaignPlan,
  hublyTemplateCatalog,
  listCampaignGoals,
  suggestCampaigns,
  type BusinessCampaignContext,
  type CampaignPlan,
} from "../_shared/hubly_campaign_engine.ts";

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

  // Global templates catalog — Hubly templates + DB catalog; Canva templates when Connect is live
  if (methodOverride === "GET" && resource === "templates" && !id) {
    const hubly = hublyTemplateCatalog().map((t) => ({
      ...t,
      featured: true,
      published: true,
    }));
    const { data, error } = await admin
      .from("studio_templates")
      .select("*")
      .eq("published", true)
      .order("featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(100);
    if (error) return json({ error: error.message, templates: hubly });
    const merged = [...hubly, ...(data || []).map((t) => ({ ...t, source: t.business_id ? "business" : "hubly" }))];
    return json({
      templates: merged,
      sources: {
        hubly: true,
        canva: false, // Connect Brand Templates when CanvaProvider is configured
        ai_generated: true,
      },
    });
  }

  // Campaign goals catalog — public to authenticated owners (also available pre-auth for UI)
  if (methodOverride === "GET" && resource === "campaign" && id === "goals") {
    return json({ goals: listCampaignGoals() });
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
          metadata: (body as { metadata?: object }).metadata || {},
          campaign_plan_id: (body as { campaign_plan_id?: string }).campaign_plan_id || null,
          canva_design_id: (body as { canva_design_id?: string }).canva_design_id || null,
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
      await admin.from("studio_project_versions").insert({
        business_id: businessId,
        project_id: project.id,
        version_number: 1,
        label: "Created in Hubly Studio",
        source: "hubly",
        snapshot: { title, format_primary: format },
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
        "canva_design_id",
        "campaign_plan_id",
        "export_status",
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

    // ── project workspace / Canva customize / versions / exports ──
    if (resource === "projects" && id && sub === "workspace" && method === "GET") {
      const { data: project, error } = await admin
        .from("studio_projects")
        .select("*")
        .eq("business_id", businessId)
        .eq("id", id)
        .maybeSingle();
      if (error) return json({ error: error.message }, 400);
      if (!project) return json({ error: "not_found" }, 404);
      const [{ data: pages }, { data: versions }, { data: exports }, { data: assets }] =
        await Promise.all([
          admin.from("studio_project_pages").select("*").eq("project_id", id).order("sort_order"),
          admin
            .from("studio_project_versions")
            .select("*")
            .eq("project_id", id)
            .order("version_number", { ascending: false })
            .limit(20),
          admin
            .from("studio_project_exports")
            .select("*")
            .eq("project_id", id)
            .order("created_at", { ascending: false })
            .limit(20),
          admin.from("studio_assets").select("*").eq("business_id", businessId).limit(40),
        ]);
      let plan = null;
      if (project.campaign_plan_id) {
        const { data: planRow } = await admin
          .from("campaign_plans")
          .select("*")
          .eq("id", project.campaign_plan_id)
          .maybeSingle();
        plan = planRow;
      }
      return json({
        project,
        pages: pages || [],
        versions: versions || [],
        exports: exports || [],
        assets: assets || [],
        campaignPlan: plan,
        canva: {
          linked: false,
          design_id: project.canva_design_id || null,
          status: "Provider not configured",
        },
      });
    }

    if (resource === "projects" && id && sub === "customize" && method === "POST") {
      // Production-First: Canva Connect OAuth required — do not simulate edit URLs
      const { data: project } = await admin
        .from("studio_projects")
        .select("*")
        .eq("business_id", businessId)
        .eq("id", id)
        .maybeSingle();
      if (!project) return json({ error: "not_found" }, 404);
      const canvaConfigured = !!(Deno.env.get("CANVA_CLIENT_ID") && Deno.env.get("CANVA_CLIENT_SECRET"));
      if (!canvaConfigured) {
        return json({
          error: "Provider not configured",
          message: "Connect Canva via Apps to customize designs. Hubly keeps your project ready.",
          project_id: id,
          correlation_state: String((body as { correlation_state?: string }).correlation_state || id.slice(0, 50)),
        }, 503);
      }
      return json({
        error: "not_implemented",
        message: "Canva Connect design create/edit_url lands in a follow-up once OAuth is live.",
        project_id: id,
      }, 501);
    }

    if (resource === "projects" && id && sub === "versions" && method === "GET") {
      const { data, error } = await admin
        .from("studio_project_versions")
        .select("*")
        .eq("business_id", businessId)
        .eq("project_id", id)
        .order("version_number", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ versions: data || [] });
    }

    if (resource === "projects" && id && sub === "exports" && method === "GET") {
      const { data, error } = await admin
        .from("studio_project_exports")
        .select("*")
        .eq("business_id", businessId)
        .eq("project_id", id)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ exports: data || [] });
    }

    // ── Campaign Engine ──
    if (resource === "campaign" && id === "suggest" && method === "GET") {
      const { data: biz } = await admin
        .from("businesses")
        .select("id,name,meta")
        .eq("id", businessId)
        .maybeSingle();
      const meta = (biz?.meta || {}) as Record<string, unknown>;
      const memory = (meta.memory || meta.businessMemory || {}) as Record<string, unknown>;
      const dna = (meta.dna || meta.businessDna || {}) as Record<string, unknown>;
      const ctx: BusinessCampaignContext = {
        industry: (memory.industry as string) || (meta.industry as string) || null,
        business_name: (biz?.name as string) || null,
        city: (memory.city as string) || null,
        dna: {
          tone: (dna.tone as string) || null,
          brand_personality: (dna.personality as string) || null,
          ideal_customer: (dna.idealCustomer as string) || null,
        },
      };
      return json({ suggestions: suggestCampaigns(ctx), goals: listCampaignGoals() });
    }

    if (resource === "campaign" && id === "plan" && method === "POST") {
      const b = body as Record<string, unknown>;
      const { data: biz } = await admin
        .from("businesses")
        .select("id,name,meta")
        .eq("id", businessId)
        .maybeSingle();
      const meta = (biz?.meta || {}) as Record<string, unknown>;
      const memory = (b.business_inputs as Record<string, unknown>) ||
        (meta.memory as Record<string, unknown>) ||
        {};
      const dnaRaw = (b.dna_inputs as Record<string, unknown>) ||
        (meta.dna as Record<string, unknown>) ||
        {};

      const ctx: BusinessCampaignContext = {
        industry: (b.industry as string) || (memory.industry as string) || null,
        business_name: (b.business_name as string) || (biz?.name as string) || null,
        city: (b.city as string) || (memory.city as string) || null,
        phone: (b.phone as string) || (memory.phone as string) || null,
        services: (b.services as string[]) || [],
        offer_summary: (b.offer_summary as string) || null,
        completed_jobs_week: Number(b.completed_jobs_week) || 0,
        open_slots_tomorrow: Number(b.open_slots_tomorrow) || 0,
        days_since_facebook_post: b.days_since_facebook_post != null
          ? Number(b.days_since_facebook_post)
          : null,
        days_since_gbp_update: b.days_since_gbp_update != null
          ? Number(b.days_since_gbp_update)
          : null,
        latest_review: (b.latest_review as BusinessCampaignContext["latest_review"]) || null,
        job_photos_count: Number(b.job_photos_count) || 0,
        has_before_after: !!b.has_before_after,
        has_logo: b.has_logo !== false,
        has_membership: !!b.has_membership,
        goal_id: (b.goal_id as string) || null,
        playbook_id: (b.playbook_id as string) || null,
        service_focus: (b.service_focus as string) || null,
        dna: {
          tone: (dnaRaw.tone as string) || null,
          brand_personality: (dnaRaw.brand_personality as string) ||
            (dnaRaw.personality as string) ||
            null,
          ideal_customer: (dnaRaw.ideal_customer as string) ||
            (dnaRaw.idealCustomer as string) ||
            null,
        },
      };

      const plan: CampaignPlan = buildCampaignPlan(ctx);

      const row = {
        business_id: businessId,
        playbook_id: plan.playbook_id,
        goal_id: plan.goal_id,
        industry_id: plan.industry_id,
        title: plan.title,
        status: "ready",
        objective: plan.objective,
        channels: plan.channels,
        required_assets: plan.required_assets,
        messaging_strategy: plan.messaging_strategy,
        cta: plan.cta,
        timing: plan.timing,
        template_refs: plan.template_refs,
        offer: plan.offer,
        audience: plan.audience,
        ai_brief: plan.ai_brief,
        business_inputs: plan.business_inputs,
        dna_inputs: plan.dna_inputs,
        package: plan.package,
        metadata: { trigger_id: plan.trigger_id || null },
        updated_at: new Date().toISOString(),
      };

      const { data: saved, error } = await admin
        .from("campaign_plans")
        .insert(row)
        .select("*")
        .single();

      // If tables not migrated yet, still return structured plan (Production honesty on persist)
      if (error) {
        return json({
          plan,
          persisted: false,
          warning: error.message,
        }, 200);
      }

      // Optionally create Studio project from plan
      let project = null;
      if ((b.create_project as boolean) !== false) {
        const format = String(b.format_primary || "instagram_post");
        const { data: proj, error: pErr } = await admin
          .from("studio_projects")
          .insert({
            business_id: businessId,
            title: plan.title,
            format_primary: format,
            platform: plan.channels.includes("instagram") ? "instagram" : (plan.channels[0] || "instagram"),
            style: (b.style as string) || "bold",
            tone: (plan.dna_inputs.tone as string) || "expert",
            prompt: plan.ai_brief,
            source: { campaign_plan: true, playbook_id: plan.playbook_id },
            canvas: {
              headline: plan.package.headlines[0] || plan.title,
              package: plan.package,
            },
            metadata: { campaign_plan_id: saved.id },
            campaign_plan_id: saved.id,
            status: "draft",
          })
          .select("*")
          .single();
        if (!pErr && proj) {
          project = proj;
          await admin.from("campaign_plans").update({ project_id: proj.id }).eq("id", saved.id);
          await admin.from("studio_project_pages").insert({
            business_id: businessId,
            project_id: proj.id,
            format,
            label: format.replace(/_/g, " "),
            width: 1080,
            height: 1080,
            sort_order: 0,
          });
          await admin.from("studio_project_versions").insert({
            business_id: businessId,
            project_id: proj.id,
            version_number: 1,
            label: "Campaign plan generated",
            source: "hubly",
            snapshot: { plan_id: saved.id, title: plan.title },
          });
        }
      }

      return json({ plan: saved, campaignPlan: plan, project }, 201);
    }

    if (resource === "campaign" && id === "plans" && method === "GET" && !sub) {
      const { data, error } = await admin
        .from("campaign_plans")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return json({ error: error.message }, 400);
      return json({ plans: data || [] });
    }

    if (resource === "campaign" && id === "plans" && sub && method === "GET") {
      const { data, error } = await admin
        .from("campaign_plans")
        .select("*")
        .eq("business_id", businessId)
        .eq("id", sub)
        .maybeSingle();
      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ error: "not_found" }, 404);
      return json({ plan: data });
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
