// Create, update, or delete a Hubly job on Google via the Sync Engine.
// POST { business_id, job_id, action?: "create" | "update" | "delete", google_event_id? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  syncEnginePushCreate,
  syncEnginePushUpdate,
  syncEnginePushDelete,
} from "../_shared/google_calendar_sync_engine.ts";

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
    const businessId = String(body?.business_id || "").trim();
    const jobId = String(body?.job_id || "").trim();
    const googleEventId = body?.google_event_id != null ? String(body.google_event_id) : undefined;
    const action = String(body?.action || "create").trim().toLowerCase();
    if (!businessId) {
      return jsonRes({ error: "business_id required" }, 400);
    }
    if (action !== "delete" && !jobId) {
      return jsonRes({ error: "business_id and job_id required" }, 400);
    }
    if (action === "delete" && !jobId && !googleEventId) {
      return jsonRes({ error: "job_id or google_event_id required" }, 400);
    }
    if (action !== "create" && action !== "update" && action !== "delete") {
      return jsonRes({ error: "action must be create, update, or delete" }, 400);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonRes({ error: "Your session expired — refresh and try again." }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: biz, error: bizErr } = await admin
      .from("businesses")
      .select("id,owner_id")
      .eq("id", businessId)
      .maybeSingle();
    if (bizErr || !biz || biz.owner_id !== userData.user.id) {
      return jsonRes({ error: "Business not found" }, 404);
    }

    if (action === "delete") {
      const result = await syncEnginePushDelete(admin, {
        businessId,
        jobId: jobId || undefined,
        googleEventId,
      });
      return jsonRes(result);
    }

    if (action === "update") {
      const updated = await syncEnginePushUpdate(admin, { businessId, jobId });
      if (updated?.skipped && updated.reason === "no_google_event_id") {
        const created = await syncEnginePushCreate(admin, { businessId, jobId });
        return jsonRes({ ...created, via: "create_after_missing_link" });
      }
      return jsonRes(updated);
    }

    const result = await syncEnginePushCreate(admin, { businessId, jobId });
    return jsonRes(result);
  } catch (e) {
    console.error("google-calendar-push-job", e);
    return jsonRes({ error: (e as Error)?.message || "Could not sync job to Google" }, 500);
  }
});
