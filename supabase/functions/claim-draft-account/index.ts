// Upgrade an Instant Site draft auth user to a real email+password login.
// Uses the service role so email_confirm sticks immediately (no "check your inbox"
// limbo where JWT still shows draft-*@accounts.myhubly.app).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Key resolution goes through _shared/supabase_admin.ts: it THROWS on a missing
// key instead of continuing with "", reads the plural SUPABASE_PUBLISHABLE_KEYS
// the platform actually injects, and never sends a non-JWT sb_secret_ key as a
// Bearer token (PostgREST rejects those as "Invalid JWT").
import { createAdminClient, createUserClient } from "../_shared/supabase_admin.ts";

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
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return jsonRes({ error: "Sign in required" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const businessId = body?.business_id ? String(body.business_id) : null;

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

    if (!supabaseUrl) {
      return jsonRes({ error: "Auth isn’t configured on the server yet." }, 500);
    }

    const userClient = createUserClient(authHeader);
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonRes({ error: "Your session expired — refresh and try again." }, 401);
    }
    const user = userData.user;

    const admin = createAdminClient();
    const { data: updated, error: updErr } = await admin.auth.admin.updateUserById(user.id, {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        ...(user.user_metadata || {}),
        draft_auth: false,
        claimed_at: new Date().toISOString(),
      },
    });
    if (updErr) {
      const msg = updErr.message || "Could not save account";
      // Duplicate email etc. — surface cleanly to the owner.
      return jsonRes({ error: msg }, 400);
    }

    if (businessId) {
      const { data: biz, error: bizFindErr } = await admin
        .from("businesses")
        .select("id,owner_id")
        .eq("id", businessId)
        .maybeSingle();
      if (!bizFindErr && biz?.owner_id === user.id) {
        // Null the draft_token in the same breath as claim-draft-business (which
        // clears it on claim): once a business has an owner, the anonymous write
        // credential must stop existing, not merely be refused by every RPC's
        // owner_id guard. Belt AND suspenders — closes the loose end where a claimed
        // business kept a live-looking token.
        await admin.from("businesses").update({ email, draft_token: null }).eq("id", businessId);
      }
    }

    return jsonRes({
      ok: true,
      user: {
        id: updated?.user?.id || user.id,
        email: updated?.user?.email || email,
      },
    });
  } catch (e) {
    console.error("claim-draft-account", e);
    return jsonRes({ error: (e as Error)?.message || "Could not save account" }, 500);
  }
});
