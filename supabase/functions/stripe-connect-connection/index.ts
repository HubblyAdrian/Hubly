// Status / disconnect / Express dashboard login for the owner's Stripe Connect account.
// POST body: { action: "status" | "disconnect" | "dashboard", business_id }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createConnectLoginLink,
  retrieveAccount,
  stripeConfigured,
  stripeLivemode,
} from "../_shared/stripe.ts";
import { createAdminClient } from "../_shared/supabase_admin.ts";

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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) {
      return jsonRes({ error: "Auth isn’t configured on the server yet." }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "status").trim().toLowerCase();
    const businessId = String(body?.business_id || "").trim();
    if (!businessId) return jsonRes({ error: "business_id required" }, 400);
    if (action !== "status" && action !== "disconnect" && action !== "dashboard") {
      return jsonRes({ error: "action must be status, disconnect, or dashboard" }, 400);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonRes({ error: "Your session expired — refresh and try again." }, 401);
    }
    const user = userData.user;

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return jsonRes({ error: "Auth isn’t configured on the server yet." }, 500);
    }
    const { data: biz, error: bizErr } = await admin
      .from("businesses")
      .select("id,owner_id")
      .eq("id", businessId)
      .maybeSingle();
    if (bizErr || !biz || biz.owner_id !== user.id) {
      return jsonRes({ error: "Business not found" }, 404);
    }

    const configured = stripeConfigured();
    const { data: conn } = await admin
      .from("stripe_connect_accounts")
      .select(
        "id,stripe_account_id,charges_enabled,payouts_enabled,details_submitted,email,connected_at,updated_at,last_error",
      )
      .eq("business_id", businessId)
      .maybeSingle();

    if (action === "disconnect") {
      if (conn?.id) {
        await admin.from("stripe_connect_accounts").delete().eq("id", conn.id);
      }
      // Note: we do not delete the Stripe Express account remotely — owner can reuse via new onboard.
      return jsonRes({
        ok: true,
        connected: false,
        configured,
        livemode: configured ? stripeLivemode() : null,
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
      });
    }

    if (action === "dashboard") {
      if (!conn?.stripe_account_id) {
        return jsonRes({ error: "Connect Stripe first" }, 400);
      }
      if (!configured) {
        return jsonRes({ error: "Stripe isn’t configured on the server yet.", code: "not_configured" }, 503);
      }
      const link = await createConnectLoginLink(conn.stripe_account_id);
      return jsonRes({ ok: true, url: link.url });
    }

    // status — refresh from Stripe when possible
    let charges = !!conn?.charges_enabled;
    let payouts = !!conn?.payouts_enabled;
    let details = !!conn?.details_submitted;
    let email = conn?.email || null;
    let lastError = conn?.last_error || null;

    if (conn?.stripe_account_id && configured) {
      try {
        const acct = await retrieveAccount(conn.stripe_account_id);
        charges = !!acct.charges_enabled;
        payouts = !!acct.payouts_enabled;
        details = !!acct.details_submitted;
        email = acct.email || email;
        lastError = null;
        await admin.from("stripe_connect_accounts").update({
          charges_enabled: charges,
          payouts_enabled: payouts,
          details_submitted: details,
          email,
          updated_at: new Date().toISOString(),
          last_error: null,
        }).eq("id", conn.id);
      } catch (e) {
        lastError = (e as Error)?.message || "Could not refresh Stripe status";
        console.warn("stripe status refresh", e);
      }
    }

    return jsonRes({
      ok: true,
      configured,
      livemode: configured ? stripeLivemode() : null,
      connected: !!conn?.stripe_account_id,
      stripe_account_id: conn?.stripe_account_id || null,
      charges_enabled: charges,
      payouts_enabled: payouts,
      details_submitted: details,
      email,
      connected_at: conn?.connected_at || null,
      updated_at: conn?.updated_at || null,
      last_error: lastError,
      ready_to_charge: !!(conn?.stripe_account_id && charges),
    });
  } catch (e) {
    console.error("stripe-connect-connection", e);
    return jsonRes({ error: (e as Error)?.message || "Could not load Stripe status" }, 500);
  }
});
