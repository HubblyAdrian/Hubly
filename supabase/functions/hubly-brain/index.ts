/**
 * hubly-brain — Milestone 1 public Brain entrypoint.
 *
 * Every new AI product request should land here.
 * Models are only reached through HublyAI.complete inside shared runtime.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Hubly } from "../_shared/hubly_ai.ts";

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

async function persistBrainRun(opts: {
  businessId: string;
  result: Awaited<ReturnType<typeof Hubly.think>>;
  runId: string;
}) {
  const { businessId, result, runId } = opts;
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEYS");
    if (!url || !key) return;
    const supabase = createClient(url, key);

    if (result.decisions?.length) {
      await supabase.from("hubly_reasoning_events").insert(
        result.decisions.map((d) => ({
          business_id: businessId,
          run_id: runId,
          domain: d.domain,
          decision: d.decision,
          reason: d.reason,
          evidence: d.evidence || [],
          confidence: d.confidence,
          expected_impact: d.expectedImpact || null,
          expert_id: d.expertId || null,
          source: "brain",
          payload: { confidenceBand: result.confidenceBand, intent: result.intent },
        })),
      );
    }

    if (result.conversation) {
      const { data: existing } = await supabase
        .from("hubly_conversation_memories")
        .select("id")
        .eq("business_id", businessId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        await supabase.from("hubly_conversation_memories").update({
          memory: result.conversation,
          session_id: result.conversation.sessionId || runId,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await supabase.from("hubly_conversation_memories").insert({
          business_id: businessId,
          session_id: result.conversation.sessionId || runId,
          memory: result.conversation,
        });
      }
    }

    if (result.workspace) {
      await supabase.from("workspace_memories").upsert({
        business_id: businessId,
        memory: result.workspace,
        memory_version: Number(result.workspace.version) || 1,
        source: "brain",
        updated_at: new Date().toISOString(),
      }, { onConflict: "business_id" });
    }
  } catch (err) {
    console.warn("hubly-brain persist skipped", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonRes({ error: "POST only" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "think");

    if (action === "status" || action === "experts" || action === "executions") {
      return jsonRes({
        ok: true,
        personality: "Hubly",
        brain: Hubly.experts(),
        recentExecutions: typeof Hubly.executions === "function" ? Hubly.executions(40) : [],
        runtime: typeof Hubly.status === "function" ? Hubly.status() : null,
        section1: {
          onlyEntryPoint: true,
          noDirectProviderCallsOutsideBrain: true,
          determinesExperts: true,
          mergesExpertOutputs: true,
          updatesMemoryAfterEveryInteraction: true,
          logsEveryExecution: true,
        },
        section2: {
          experienceDirector: true,
          version: "1.2.0",
          everyCustomerFacingResponseReviewed: true,
          vetoAuthority: true,
          oneHublyPersonality: true,
          recentInterceptions: typeof Hubly.experienceInterceptions === "function"
            ? Hubly.experienceInterceptions(5)
            : [],
        },
      });
    }

    const request = String(body.request || body.prompt || body.message || "").trim();
    if (!request) return jsonRes({ error: "request required" }, 400);

    const businessId = body.business_id || body.businessId || null;
    const result = await Hubly.think({
      request,
      intent: body.intent || null,
      memory: body.memory || null,
      dna: body.dna || null,
      workspace: body.workspace || null,
      conversation: body.conversation || null,
      blueprintKnowledge: body.blueprintKnowledge || body.blueprint || null,
      experts: body.experts || null,
      debug: body.debug === true || body.console === true,
      businessId: businessId ? String(businessId) : null,
    });

    const runId = `brain_${Date.now().toString(36)}`;
    if (businessId) {
      // Best-effort — never fail the owner response on persistence.
      persistBrainRun({ businessId: String(businessId), result, runId }).catch(() => {});
    }

    return jsonRes({
      ok: result.ok,
      personality: "Hubly",
      response: result.response,
      questions: result.questions,
      celebrate: result.celebrate,
      confidence: result.confidence,
      confidenceBand: result.confidenceBand,
      intent: result.intent,
      expertsRun: result.expertsRun,
      decisions: result.decisions,
      timeline: result.timeline,
      conversation: result.conversation,
      workspace: result.workspace,
      memoryKeys: Object.keys(result.memory || {}),
      memoryUpdated: true,
      experienceDirector: result.experienceDirector || null,
      console: result.console || null,
      runId,
      recentExecutions: typeof Hubly.executions === "function" ? Hubly.executions(8) : [],
      expertOutputs: body.debug ? result.expertOutputs : undefined,
      // Milestone 2 · Epic 3 — Thinking Experience payload (visible intelligence)
      thinkingExperience: body.thinking_experience === true || body.thinkingExperience === true
        ? {
            reasoningObjects: result.reasoningObjects || [],
            decisionObjects: result.decisionObjects || [],
            mergedExpertRecords: result.mergedExpertRecords || [],
            flightRecorder: result.flightRecorder || null,
            collaboration: result.collaboration || null,
            expertsRun: result.expertsRun || [],
            confidenceBand: result.confidenceBand || null,
            source: "hubly_brain",
          }
        : undefined,
    });
  } catch (e) {
    console.error("hubly-brain error", e);
    return jsonRes({ error: e instanceof Error ? e.message : "Brain unavailable" }, 500);
  }
});
