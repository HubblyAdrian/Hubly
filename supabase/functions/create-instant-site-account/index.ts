// Create a real Instant Site owner account early (email + password step).
// Uses the service role so email_confirm sticks immediately — no "check your inbox" limbo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function isDraftAuthEmail(email: string) {
  return /^draft-.+@accounts\.myhubly\.app$/i.test(String(email || ""));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const biz = String(body?.biz || "").trim().slice(0, 120);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonRes({ error: "Enter a valid email" }, 400);
    }
    if (isDraftAuthEmail(email)) {
      return jsonRes({ error: "Use your real email — not a draft address" }, 400);
    }
    if (password.length < 8) {
      return jsonRes({ error: "Password must be at least 8 characters" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return jsonRes({ error: "Auth isn’t configured on the server yet." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        instant_site: true,
        business_name: biz || null,
        created_via: "instant_site_soft_login",
      },
    });
    if (error) {
      const msg = error.message || "Could not create account";
      if (/already|registered|exists|duplicate/i.test(msg)) {
        return jsonRes({ ok: true, exists: true, user: { email } });
      }
      return jsonRes({ error: msg }, 400);
    }

    return jsonRes({
      ok: true,
      created: true,
      user: { id: data.user?.id || null, email: data.user?.email || email },
    });
  } catch (e) {
    console.error("create-instant-site-account", e);
    return jsonRes({ error: (e as Error)?.message || "Could not create account" }, 500);
  }
});
