// Give a returning owner their draft back.
//
// A draft page is permanent at {slug}.myhubly.app, but the BUILDER session was
// in-memory only: close the tab and reopening myhubly.app was a fresh chat with
// no way back to edit or claim. The 7-day httpOnly claim cookie already carries
// the businessId; /api/draft-session (Vercel, the only thing that can read that
// cookie) turns it into a short signed claim assertion. This function turns that
// assertion back into the draft — the id, slug, url and draft_token — so the
// builder can rehydrate hc.draftBusiness and say "welcome back".
//
// WHY THE ASSERTION AND NOT THE COOKIE
//
// The cookie is httpOnly and scoped to myhubly.app; an Edge Function on
// *.supabase.co cannot read it. So Vercel reads it and vouches, HMAC-signed with
// the shared HUBLY_DRAFT_SECRET, exactly as the claim flow already does. This
// function trusts only the verified assertion — never anything sent alongside.
//
// ONLY WHILE UNCLAIMED. Once owner_id is set the draft_token is meaningless and
// this returns nothing: a claimed business is reached the normal, authenticated
// way, not by resurrecting a draft session.

import { verifyClaimAssertion } from "../_shared/draft_grant.ts";
import { createAdminClient } from "../_shared/supabase_admin.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
}

const HUBLY_DOMAIN = (Deno.env.get("HUBLY_PUBLIC_DOMAIN") || "myhubly.app").trim();

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  let body: { assertion?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }

  // Identity comes ONLY from the verified assertion.
  const assertion = await verifyClaimAssertion(String(body?.assertion || ""));
  if (!assertion) return json({ ok: false, error: "invalid_or_expired" });

  const admin = createAdminClient();
  const { data: biz, error } = await admin
    .from("businesses")
    .select("id, slug, name, owner_id, draft_token")
    .eq("id", assertion.businessId)
    .maybeSingle();

  if (error || !biz) return json({ ok: false, error: "not_found" });
  // Already claimed: no draft to resume. The owner reaches it signed in.
  if (biz.owner_id) return json({ ok: false, error: "already_claimed" });
  if (!biz.draft_token) return json({ ok: false, error: "no_draft_token" });

  // Does a page exist yet? Tells the client whether to show a preview or the
  // "still building" state.
  const { count } = await admin
    .from("business_documents")
    .select("id", { count: "exact", head: true })
    .eq("business_id", biz.id);

  return json({
    ok: true,
    draftBusiness: {
      id: biz.id,
      slug: biz.slug,
      name: biz.name,
      draftToken: biz.draft_token,
      url: `https://${biz.slug}.${HUBLY_DOMAIN}`,
    },
    hasPage: (count || 0) > 0,
  });
});
