// Start Stripe Connect Express onboarding for the signed-in business owner.
// Returns { url } — browser should navigate there.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  appBaseUrl,
  createAccountLink,
  createExpressAccount,
  retrieveAccount,
  sanitizeAppReturnUrl,
  stripeConfigured,
} from "../_shared/stripe.ts";

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
    if (!stripeConfigured()) {
      return jsonRes({
        error: "Stripe isn’t configured yet. Add STRIPE_SECRET_KEY in Supabase secrets.",
        code: "not_configured",
      }, 503);
    }

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
    if (!businessId) return jsonRes({ error: "business_id required" }, 400);

    const returnTo = sanitizeAppReturnUrl(
      body?.return_to || body?.return_url || body?.refresh_url,
    );
    const returnUrl = (() => {
      try {
        const u = new URL(returnTo);
        u.searchParams.set("stripe_connect", "connected");
        return u.toString();
      } catch {
        return `${appBaseUrl()}/app?stripe_connect=connected`;
      }
    })();
    const refreshUrl = (() => {
      try {
        const u = new URL(returnTo);
        u.searchParams.set("stripe_connect", "refresh");
        return u.toString();
      } catch {
        return `${appBaseUrl()}/app?stripe_connect=refresh`;
      }
    })();

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

    const { data: existing } = await admin
      .from("stripe_connect_accounts")
      .select("id,stripe_account_id,charges_enabled,payouts_enabled,details_submitted,email")
      .eq("business_id", businessId)
      .maybeSingle();

    let stripeAccountId = existing?.stripe_account_id as string | undefined;
    if (!stripeAccountId) {
      const acct = await createExpressAccount({
        email: user.email || undefined,
        businessId,
        ownerId: user.id,
      });
      stripeAccountId = acct.id;
      const { error: insErr } = await admin.from("stripe_connect_accounts").insert({
        business_id: businessId,
        owner_id: user.id,
        stripe_account_id: stripeAccountId,
        charges_enabled: !!acct.charges_enabled,
        payouts_enabled: !!acct.payouts_enabled,
        details_submitted: !!acct.details_submitted,
        email: acct.email || user.email || null,
        updated_at: new Date().toISOString(),
      });
      if (insErr) {
        console.error("stripe_connect_accounts insert", insErr);
        return jsonRes({ error: "Could not save Stripe account" }, 500);
      }
    } else {
      try {
        const acct = await retrieveAccount(stripeAccountId);
        await admin.from("stripe_connect_accounts").update({
          charges_enabled: !!acct.charges_enabled,
          payouts_enabled: !!acct.payouts_enabled,
          details_submitted: !!acct.details_submitted,
          email: acct.email || existing.email || null,
          updated_at: new Date().toISOString(),
          last_error: null,
        }).eq("business_id", businessId);
      } catch (e) {
        console.warn("retrieveAccount before link", e);
      }
    }

    const link = await createAccountLink({
      accountId: stripeAccountId!,
      refreshUrl,
      returnUrl,
    });
    if (!link?.url) return jsonRes({ error: "No Stripe onboarding URL returned" }, 500);

    return jsonRes({ ok: true, url: link.url });
  } catch (e) {
    console.error("stripe-connect-onboard", e);
    return jsonRes({ error: (e as Error)?.message || "Could not start Stripe onboarding" }, 500);
  }
});
