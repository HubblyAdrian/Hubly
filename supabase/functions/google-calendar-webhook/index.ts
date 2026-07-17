// Google Calendar push notifications (events.watch).
// verify_jwt is off — Google has no Hubly JWT.
// Auth: X-Goog-Channel-ID + X-Goog-Channel-Token + X-Goog-Resource-ID must match DB.
// Always respond 200; never do work on unverified headers.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  processInboundGoogleSync,
  resolveWatchChannel,
  tryWebhookDebounce,
} from "../_shared/google_calendar_inbound.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {
    const channelId = req.headers.get("X-Goog-Channel-ID") || "";
    const resourceState = (req.headers.get("X-Goog-Resource-State") || "").toLowerCase();
    const channelToken = req.headers.get("X-Goog-Channel-Token") || "";
    const resourceId = req.headers.get("X-Goog-Resource-ID") || "";

    // Initial sync handshake — acknowledge only
    if (resourceState === "sync") {
      return new Response("", { status: 200 });
    }

    // Require all three identity headers before any DB/Google work
    if (!channelId || !channelToken || !resourceId) {
      return new Response("", { status: 200 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS");
    if (!supabaseUrl || !serviceKey) {
      return new Response("", { status: 200 });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const matched = await resolveWatchChannel(admin, {
      channelId,
      channelToken,
      resourceId,
    });
    if (!matched?.business_id) {
      return new Response("", { status: 200 });
    }

    const businessId = matched.business_id;

    // Coalesce burst notifications (Google often fans out)
    const shouldRun = await tryWebhookDebounce(admin, businessId, 15);
    if (!shouldRun) {
      return new Response("", { status: 200 });
    }

    if (resourceState === "exists" || resourceState === "not_exists" || !resourceState) {
      try {
        await processInboundGoogleSync(admin, { businessId });
      } catch (e) {
        console.warn("webhook inbound sync", e);
      }
    }

    return new Response("", { status: 200 });
  } catch (e) {
    console.error("google-calendar-webhook", e);
    return new Response("", { status: 200 });
  }
});
