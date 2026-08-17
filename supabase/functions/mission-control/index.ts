// supabase/functions/mission-control/index.ts
// Hubly HQ — internal platform OS (staff only). Edge id remains mission-control.
// Auth: HUBLY_MISSION_CONTROL_SECRET (fallback cron / marketplace ops secret).
// Read-first. Never returns Stripe account ids or OAuth tokens.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  addWaitlistEntry,
  buildAdoption,
  buildAiHealth,
  buildBusiness360,
  buildCeoDaily,
  buildErrors,
  buildFunnel,
  buildLaunchQueue,
  buildNotifications,
  buildOverview,
  buildPlatformFeed,
  buildPlatformHealth,
  buildProofMode,
  buildReleaseHealth,
  buildAiLearning,
  recordBlueprintSignal,
  recordProofStep,
  buildRevenue,
  buildSignups,
  buildSystemHealth,
  createImpersonationSession,
  inviteWaitlistBatch,
  listAdminAuditLog,
  listWaitlist,
  recordSmokeRun,
  writeAudit,
} from "../_shared/mission_control.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hubly-mission-control",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

function authorized(req: Request): boolean {
  const secret =
    (Deno.env.get("HUBLY_MISSION_CONTROL_SECRET") || "").trim() ||
    (Deno.env.get("HUBLY_MARKETPLACE_OPS_SECRET") || "").trim() ||
    (Deno.env.get("HUBLY_CRON_SECRET") || "").trim();
  if (!secret) return false;
  const header = (req.headers.get("x-hubly-mission-control") || "").trim();
  if (header && header === secret) return true;
  const auth = req.headers.get("Authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ") && auth.slice(7).trim() === secret) {
    return true;
  }
  return false;
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!url || !key) throw new Error("Supabase service role not configured");
  return createClient(url, key);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return jsonRes({ error: "POST only" }, 405);

  if (!authorized(req)) {
    return jsonRes({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "overview").trim();
    const adminEmail = String(body?.admin_email || "hubly-hq").trim();
    const admin = adminClient();

    const openai = !!(Deno.env.get("OPENAI_API_KEY") || "").trim();
    const claude = !!(Deno.env.get("ANTHROPIC_API_KEY") || "").trim();
    const transportRaw = (Deno.env.get("OPENAI_TRANSPORT") || "responses").trim().toLowerCase();
    const transport = transportRaw === "chat" || transportRaw === "chat_completions"
      ? "chat"
      : "responses";
    const reasoningModel = (Deno.env.get("HUBLY_AI_REASONING_MODEL") ||
      Deno.env.get("OPENAI_MODEL") ||
      "gpt-5.5").trim();

    const envHealth = { openai, claude, openaiTransport: transport };

    await writeAudit(admin, {
      admin_email: adminEmail,
      action: `hq.${action}`,
      resource_type: body?.business_id ? "business" : "platform",
      resource_id: body?.business_id ? String(body.business_id) : null,
      meta: { q: body?.q || null },
    });

    switch (action) {
      case "ping":
        return jsonRes({ ok: true, app: "hubly-hq" });
      case "ceo_daily":
        return jsonRes({ ok: true, data: await buildCeoDaily(admin) });
      case "overview":
        return jsonRes({ ok: true, data: await buildOverview(admin) });
      case "feed":
        return jsonRes({
          ok: true,
          data: { feed: await buildPlatformFeed(admin, Number(body?.limit) || 50) },
        });
      case "signups":
        return jsonRes({
          ok: true,
          data: { rows: await buildSignups(admin, String(body?.q || "")) },
        });
      case "funnel":
        return jsonRes({ ok: true, data: await buildFunnel(admin) });
      case "launch_queue":
        return jsonRes({ ok: true, data: { queue: await buildLaunchQueue(admin) } });
      case "business": {
        const id = String(body?.business_id || "").trim();
        if (!id) return jsonRes({ error: "business_id required" }, 400);
        const data = await buildBusiness360(admin, id);
        if ((data as { error?: string }).error) {
          return jsonRes({ error: (data as { error: string }).error }, 404);
        }
        return jsonRes({ ok: true, data });
      }
      case "system_health":
        return jsonRes({ ok: true, data: await buildSystemHealth(admin, envHealth) });
      case "platform_health":
        return jsonRes({ ok: true, data: await buildPlatformHealth(admin, envHealth) });
      case "release_health":
      case "production_gate":
        return jsonRes({ ok: true, data: await buildReleaseHealth(admin, envHealth) });
      case "ai_health":
        return jsonRes({
          ok: true,
          data: await buildAiHealth({
            ...envHealth,
            reasoningModel,
          }),
        });
      case "errors":
        return jsonRes({ ok: true, data: await buildErrors(admin) });
      case "revenue":
        return jsonRes({ ok: true, data: await buildRevenue(admin) });
      case "adoption":
        return jsonRes({ ok: true, data: await buildAdoption(admin) });
      case "notifications":
        return jsonRes({ ok: true, data: await buildNotifications(admin) });
      case "waitlist":
        return jsonRes({
          ok: true,
          data: await listWaitlist(admin, body?.status ? String(body.status) : undefined),
        });
      case "waitlist_add": {
        const data = await addWaitlistEntry(admin, {
          email: String(body?.email || ""),
          name: body?.name ? String(body.name) : undefined,
          business_idea: body?.business_idea ? String(body.business_idea) : undefined,
          industry: body?.industry ? String(body.industry) : undefined,
          city: body?.city ? String(body.city) : undefined,
        });
        if ((data as { error?: string }).error) {
          return jsonRes({ error: (data as { error: string }).error }, 400);
        }
        return jsonRes({ ok: true, data });
      }
      case "waitlist_invite": {
        const data = await inviteWaitlistBatch(admin, {
          ids: Array.isArray(body?.ids) ? body.ids.map(String) : undefined,
          limit: Number(body?.limit) || 10,
          batch_id: body?.batch_id ? String(body.batch_id) : undefined,
          admin_email: adminEmail,
        });
        if ((data as { error?: string }).error) {
          return jsonRes({ error: (data as { error: string }).error }, 400);
        }
        return jsonRes({ ok: true, data });
      }
      case "impersonate": {
        const data = await createImpersonationSession(admin, {
          business_id: String(body?.business_id || ""),
          admin_email: adminEmail,
          reason: body?.reason ? String(body.reason) : undefined,
          hours: Number(body?.hours) || 2,
        });
        if ((data as { error?: string }).error) {
          return jsonRes({ error: (data as { error: string }).error }, 400);
        }
        return jsonRes({ ok: true, data });
      }
      case "audit_log":
        return jsonRes({
          ok: true,
          data: await listAdminAuditLog(admin, Number(body?.limit) || 100),
        });
      case "proof_mode":
        return jsonRes({ ok: true, data: await buildProofMode(admin) });
      case "ai_learning":
      case "living_blueprints":
        return jsonRes({ ok: true, data: await buildAiLearning(admin) });
      case "blueprint_signal": {
        const data = await recordBlueprintSignal(admin, {
          industry: String(body?.industry || ""),
          signal_type: String(body?.signal_type || ""),
          signal_key: String(body?.signal_key || ""),
          weight: body?.weight != null ? Number(body.weight) : 1,
          meta: body?.meta && typeof body.meta === "object" ? body.meta : {},
          admin_email: adminEmail,
        });
        if ((data as { error?: string }).error) {
          return jsonRes({ error: (data as { error: string }).error }, 400);
        }
        return jsonRes({ ok: true, data });
      }
      case "proof_step": {
        const data = await recordProofStep(admin, {
          vertical: String(body?.vertical || ""),
          step: String(body?.step || ""),
          result: String(body?.result || "pending"),
          business_id: body?.business_id ? String(body.business_id) : undefined,
          business_name: body?.business_name ? String(body.business_name) : undefined,
          notes: body?.notes != null ? String(body.notes) : undefined,
          admin_email: adminEmail,
        });
        if ((data as { error?: string }).error) {
          return jsonRes({ error: (data as { error: string }).error }, 400);
        }
        return jsonRes({ ok: true, data });
      }
      case "smoke_report": {
        const checks = Array.isArray(body?.checks) ? body.checks : [];
        const failed = Array.isArray(body?.failed_ids)
          ? body.failed_ids.map(String)
          : checks.filter((c: { ok?: boolean }) => c && c.ok === false).map((c: { id?: string }) =>
            String(c.id || "unknown")
          );
        const passed = body?.passed === true || (body?.passed !== false && failed.length === 0);
        const data = await recordSmokeRun(admin, {
          passed,
          checks,
          failed_ids: failed,
          environment: body?.environment ? String(body.environment) : undefined,
          commit_sha: body?.commit_sha ? String(body.commit_sha) : undefined,
          reported_by: adminEmail,
        });
        if ((data as { error?: string }).error) {
          return jsonRes({ error: (data as { error: string }).error }, 400);
        }
        return jsonRes({ ok: true, data });
      }
      default:
        return jsonRes({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("hubly-hq", e);
    return jsonRes({ error: "Hubly HQ unavailable" }, 500);
  }
});
