// SCRATCH — delete after use.
//
// Exists only so an A/B/C comparison can hold the MODEL constant while varying
// the architecture. It calls the same gpt-5.5 through the same HublyAI layer the
// real pipeline uses, with a caller-supplied system prompt and no document AST,
// no LAYOUT_BLOCK and no class vocabulary. Without this the comparison would be
// "our pipeline vs a different model", which answers nothing.
//
// Service-key gated: it takes an arbitrary prompt and spends money.
import { HublyAI } from "../_shared/hubly_ai.ts";


Deno.serve(async (req) => {
  // Gated on HUBLY_CRON_SECRET rather than the service key: the cron secret is
  // in the vault and readable via SQL, so this can be driven from a laptop
  // without the service key ever leaving the platform.
  const secret = (Deno.env.get("HUBLY_CRON_SECRET") || "").trim();
  const given = (req.headers.get("x-hubly-cron-secret") || "").trim();
  if (!secret || given !== secret) return new Response("forbidden", { status: 403 });

  const b = await req.json().catch(() => ({}));
  const ai = await HublyAI.complete({
    feature: "scratch-freeform",
    task: "document_generate",
    system: String(b.system || ""),
    messages: [{ role: "user", content: String(b.user || "") }],
    jsonMode: false,
    maxTokens: Number(b.maxTokens) || 16000,
  });
  return new Response(JSON.stringify({ text: ai.text, model: ai.model, provider: ai.provider }), {
    headers: { "content-type": "application/json" },
  });
});
