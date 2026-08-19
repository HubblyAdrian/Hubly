// Polling / on-demand Google → Hubly sync (+ renew push watch).
// POST { business_id }
// Safe fallback when webhooks are unavailable; never creates Hubly jobs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
// Supabase key resolution goes through _shared/supabase_admin.ts. It THROWS on a
// missing key instead of continuing with "" (nine call sites used to 401 quietly
// and be logged), reads the plural SUPABASE_PUBLISHABLE_KEYS the platform
// actually injects rather than the singular name that is set nowhere, and never
// sends a non-JWT sb_secret_ key as a Bearer token -- PostgREST rejects those as
// "Invalid JWT", which looks exactly like the empty-key 401 in a log.
import { createAdminClient, createUserClient } from "../_shared/supabase_admin.ts";
  processInboundGoogleSync,
  ensureGoogleCalendarWatch,
} from "../_shared/google_calendar_inbound.ts";

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
    if (!supabaseUrl) {
      return jsonRes({ error: "Auth isn’t configured on the server yet." }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const businessId = String(body?.business_id || "").trim();
    if (!businessId) return jsonRes({ error: "business_id required" }, 400);

    const userClient = createUserClient(authHeader);
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonRes({ error: "Your session expired — refresh and try again." }, 401);
    }

    const admin = createAdminClient();
    const { data: biz, error: bizErr } = await admin
      .from("businesses")
      .select("id,owner_id")
      .eq("id", businessId)
      .maybeSingle();
    if (bizErr || !biz || biz.owner_id !== userData.user.id) {
      return jsonRes({ error: "Business not found" }, 404);
    }

    let watch: { ok?: boolean; renewed?: boolean; reason?: string } = {};
    try {
      watch = await ensureGoogleCalendarWatch(admin, { businessId, supabaseUrl });
    } catch (e) {
      console.warn("ensure watch", e);
      watch = { ok: false, reason: (e as Error)?.message };
    }

    const inbound = await processInboundGoogleSync(admin, { businessId });
    return jsonRes({
      ...inbound,
      watch_ok: !!watch.ok,
      watch_renewed: !!watch.renewed,
      watch_reason: watch.reason || null,
    });
  } catch (e) {
    console.error("google-calendar-inbound-sync", e);
    return jsonRes({ error: (e as Error)?.message || "Could not sync from Google" }, 500);
  }
});
