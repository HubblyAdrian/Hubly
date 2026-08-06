// supabase/functions/lead-extract/index.ts
//
// Quick-add-a-lead-from-pasted-text — paste a text/DM, get back structured
// fields. Deliberately fails fast and honestly (never a fake success) so
// the client can fall back to its existing regex-only contact parser
// instead of blocking the whole paste-to-add flow on one bad model call.

import { extractLeadFromText } from "../_shared/hubly_lead_extract.ts";
import { HublyAI } from "../_shared/hubly_ai.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonRes({ ok: false, error: "POST required" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const text = typeof body?.text === "string" ? body.text : "";
  if (!text.trim()) return jsonRes({ ok: false, error: "text_required" }, 400);

  if (!HublyAI.isConfigured("openai")) {
    return jsonRes({ ok: false, error: "not_configured" }, 200);
  }

  try {
    const result = await extractLeadFromText(text);
    return jsonRes(result, 200);
  } catch (err) {
    console.error("lead-extract error:", err);
    return jsonRes({ ok: false, error: "unexpected_error" }, 200);
  }
});
