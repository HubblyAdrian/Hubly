// Claim an unowned draft business.
//
// A stranger talks to Hubly, a real site appears in seconds, and it belongs to
// nobody — a businesses row with a draft_token and owner_id NULL. Six such rows
// sit live in production right now, unreachable by the people who made them,
// because nothing has ever bridged "I built this" to "I have an account".
//
// claim-draft-account does not do this. It upgrades an existing draft AUTH USER
// to email+password and only ever touches businesses.email — it never sets
// owner_id, and requires ownership it was not designed to grant. It is left
// alone; this is the missing piece, not a rewrite of that one.
//
// TWO INDEPENDENT FACTS ARE REQUIRED, and neither claims anything alone:
//
//   1. A valid draft session  -> you are the person who built this.
//      Proven by an assertion from /api/draft-session, which is the only thing
//      that can read the httpOnly cookie (host-only on myhubly.app, so this
//      function never sees it).
//   2. Control of the email    -> the address is really yours.
//      Proven by Supabase's own magic link; this function never decides that.
//
// start  records the binding, before any email is sent
// finish consumes it, for a user Supabase has already verified

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyClaimAssertion } from "../_shared/draft_grant.ts";

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return jsonRes({ error: "POST required" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SECRET_KEYS");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return jsonRes({ error: "Auth isn’t configured on the server yet." }, 500);
  }
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim();

    // ── START ────────────────────────────────────────────────────────────────
    // Record that this email may claim this business. Deliberately does NOT send
    // the email: the client calls supabase.auth.signInWithOtp itself, so Supabase
    // owns verification end to end and this function never handles a token that
    // could log anyone in.
    if (action === "start") {
      const email = String(body?.email || "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return jsonRes({ error: "Enter a valid email" }, 400);

      // Identity of the business comes ONLY from the verified assertion. A
      // business_id sent alongside it is ignored — otherwise anyone could claim
      // any draft by naming it.
      const assertion = await verifyClaimAssertion(String(body?.assertion || ""));
      if (!assertion) {
        return jsonRes({ error: "This build session has expired. Refresh and try again.", code: "no_session" }, 400);
      }

      const { data: biz, error: bizErr } = await admin
        .from("businesses")
        .select("id,owner_id,name,slug")
        .eq("id", assertion.businessId)
        .maybeSingle();
      if (bizErr || !biz) return jsonRes({ error: "That draft no longer exists." }, 404);

      // Already owned: stop. Not an error the user caused, and the message must
      // not reveal whose it is.
      if (biz.owner_id) {
        return jsonRes({ error: "This site has already been claimed.", code: "already_claimed" }, 409);
      }

      // One open claim per (business, email). Re-requesting the link should not
      // pile up rows, and a second email for the same pair is the same claim.
      await admin.from("draft_claims")
        .delete()
        .eq("business_id", biz.id)
        .is("claimed_at", null)
        .eq("email", email);

      const { error: insErr } = await admin.from("draft_claims").insert({
        business_id: biz.id,
        email,
      });
      if (insErr) {
        console.error("[claim-draft] insert failed", insErr.message);
        return jsonRes({ error: "Could not start the claim. Try again." }, 500);
      }

      return jsonRes({ ok: true, businessName: biz.name || null, slug: biz.slug || null });
    }

    // ── FINISH ───────────────────────────────────────────────────────────────
    // The user is back from the magic link and Supabase has verified them. The
    // email is read from the VERIFIED session, never from the request body —
    // that is the whole security of this step.
    if (action === "finish") {
      const authHeader = req.headers.get("Authorization") || "";
      if (!authHeader.toLowerCase().startsWith("bearer ")) {
        return jsonRes({ error: "Sign in required", code: "no_session" }, 401);
      }
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user?.email) {
        return jsonRes({ error: "Your session expired — open the link again.", code: "no_session" }, 401);
      }
      const user = userData.user;
      const email = String(user.email).trim().toLowerCase();

      // The newest open, unexpired claim for this verified address. Nothing the
      // client says is consulted.
      const { data: claim } = await admin
        .from("draft_claims")
        .select("id,business_id,expires_at")
        .eq("email", email)
        .is("claimed_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!claim) return jsonRes({ ok: true, claimed: false, reason: "no_pending_claim" });

      // Only ever claims a business that is STILL unowned. The guard is in the
      // update itself, not a prior read, so two links raced against each other
      // cannot both succeed.
      const { data: updated, error: updErr } = await admin
        .from("businesses")
        .update({ owner_id: user.id, email })
        .eq("id", claim.business_id)
        .is("owner_id", null)
        .select("id,slug,name")
        .maybeSingle();

      if (updErr) {
        console.error("[claim-draft] owner_id update failed", updErr.message);
        return jsonRes({ error: "Could not finish the claim." }, 500);
      }
      if (!updated) {
        // Someone else got there first. Spend the claim so it cannot be retried.
        await admin.from("draft_claims")
          .update({ claimed_at: new Date().toISOString(), claimed_by: user.id })
          .eq("id", claim.id);
        return jsonRes({ ok: true, claimed: false, reason: "already_claimed" });
      }

      // Spend the claim. draft_token is cleared in the same breath: the site now
      // has an owner, so the anonymous write credential must stop working —
      // patch_business_in_progress already refuses a claimed row, and this makes
      // the token useless rather than merely ineffective.
      await admin.from("draft_claims")
        .update({ claimed_at: new Date().toISOString(), claimed_by: user.id })
        .eq("id", claim.id);
      await admin.from("businesses").update({ draft_token: null }).eq("id", updated.id);

      console.info("[claim-draft] claimed", JSON.stringify({
        business_id: updated.id, slug: updated.slug, user_id: user.id,
      }));

      return jsonRes({
        ok: true,
        claimed: true,
        businessId: updated.id,
        slug: updated.slug,
        name: updated.name,
      });
    }

    return jsonRes({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("claim-draft-business", e);
    return jsonRes({ error: (e as Error)?.message || "Could not process the claim." }, 500);
  }
});
