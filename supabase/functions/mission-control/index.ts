// supabase/functions/mission-control/index.ts
// Hubly Mission Control — internal admin OS (staff only).
// Auth: HUBLY_MISSION_CONTROL_SECRET (fallback cron / marketplace ops secret).
// Read-first. Never returns Stripe account ids or OAuth tokens.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
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
  buildRevenue,
  buildSignups,
  buildSystemHealth,
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
    const adminEmail = String(body?.admin_email || "mission-control").trim();
    const admin = adminClient();

    const openai = !!(Deno.env.get("OPENAI_API_KEY") || "").trim();
    const claude = !!(Deno.env.get("ANTHROPIC_API_KEY") || "").trim();
    const transport = (Deno.env.get("OPENAI_TRANSPORT") || "responses").trim().toLowerCase() ||
      "responses";
    const reasoningModel = (Deno.env.get("HUBLY_AI_REASONING_MODEL") ||
      Deno.env.get("OPENAI_MODEL") ||
      "gpt-5.5").trim();

    await writeAudit(admin, {
      admin_email: adminEmail,
      action: `mc.${action}`,
      resource_type: body?.business_id ? "business" : "platform",
      resource_id: body?.business_id ? String(body.business_id) : null,
      meta: { q: body?.q || null },
    });

    switch (action) {
      case "ping":
        return jsonRes({ ok: true, app: "mission-control" });
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
        return jsonRes({
          ok: true,
          data: await buildSystemHealth(admin, {
            openai,
            claude,
            openaiTransport: transport === "chat" ? "chat" : "responses",
          }),
        });
      case "ai_health":
        return jsonRes({
          ok: true,
          data: await buildAiHealth({
            openai,
            claude,
            openaiTransport: transport === "chat" ? "chat" : "responses",
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
      default:
        return jsonRes({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("mission-control", e);
    return jsonRes({ error: "Mission Control unavailable" }, 500);
  }
});
