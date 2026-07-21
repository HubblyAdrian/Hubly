// supabase/functions/hubly-ai-status/index.ts
// Read-only HublyAI layer status. Does not call providers or change feature routing.
import { HublyAI } from "../_shared/hubly_ai.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const status = HublyAI.status();
    return new Response(
      JSON.stringify({
        ok: true,
        layer: "HublyAI",
        ...status,
        migration: {
          phase: "abstraction",
          claude_direct_calls: "still active until each feature migrates",
          openai: "connected via HublyAI; not default",
        },
      }),
      { headers: { ...CORS, "content-type": "application/json" } },
    );
  } catch (e) {
    console.error("hubly-ai-status", e);
    return new Response(JSON.stringify({ ok: false, error: "status unavailable" }), {
      status: 500,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }
});
