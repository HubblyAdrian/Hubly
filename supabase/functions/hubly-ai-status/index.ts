// supabase/functions/hubly-ai-status/index.ts
// Read-only Hubly Brain status. Does not call providers or change feature routing.
import { HublyBrain } from "../_shared/hubly_ai.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const status = HublyBrain.status();
    // Demonstrate Separation: Conversation → Understanding → Memory → Plan → Execute (dry)
    const turn = HublyBrain.ingest("Build software for my detailing business");
    const exec = await HublyBrain.execute(turn.plan, {
      memory: turn.memory,
      persist: false,
    });
    return new Response(
      JSON.stringify({
        ok: true,
        ...status,
        sampleIngest: {
          understanding: {
            primaryGoal: turn.understanding.intent.primaryGoal,
            outcomes: turn.understanding.intent.requestedOutcomes,
            signals: turn.understanding.signals,
          },
          memoryKeys: Object.keys(turn.memory).filter((k) => {
            const v = (turn.memory as Record<string, unknown>)[k];
            return v != null && v !== "" && k !== "version" && k !== "updatedAt";
          }),
          plan: {
            goal: turn.plan.goal,
            skills: turn.plan.skills,
            source: turn.plan.source,
            blocked: turn.plan.blocked,
          },
          executeDryRun: {
            ran: exec.ran.map((r) => ({ skill: r.skill, ok: r.ok, detail: r.detail })),
            skipped: exec.skipped,
            persisted: exec.persisted,
          },
        },
        migration: {
          phase: "7.4-executors-foundation",
          foundationChecklist: status.foundationChecklist,
          claude_direct_calls: "still active — migrate Website Builder next",
          openai_reasoning_model: HublyBrain.reasoningModel(),
          next: ["Migrate Website Builder onto Brain pipeline", "Row-level CRM/job executors"],
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
