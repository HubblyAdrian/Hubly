// supabase/functions/hubly-conversation/index.ts
//
// Hubly Conversation — the canonical, general-purpose conversational interface
// to Hubly V4. This is Hubly Core (capability group 10 — AI).
//
// Rules this file exists to satisfy:
// - Built directly on HublyAI (hubly_ai.ts). Never the legacy Brain / think()
//   pipeline — that path does not reach a real model and is frozen Legacy
//   architecture (see docs discussion, 2026-08-03 "V4 Reset").
// - Stateless orchestration: the caller threads the full message history on
//   every turn; this function persists nothing today. `businessId` is accepted
//   and threaded through so Business Memory / DNA can be wired in later
//   (via HublyAICallOpts.memory / .dna) without changing this contract.
// - Not an onboarding script. The same endpoint serves "I need help with my
//   business", "help me build a website", "I want more customers", etc. —
//   any future Hubly Core capability should be reachable through this same
//   conversation loop by adding a tool, not by branching the architecture.
// - Honesty over intelligence: a tool call either produced real analysis or
//   it didn't. The model is never allowed to claim more than a tool result
//   actually contains.

import { HublyAI, type HublyMessage } from "../_shared/hubly_ai.ts";

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

function extractJson(rawText: string): string {
  const cleaned = String(rawText || "")
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return cleaned;
  return cleaned.slice(start, end + 1);
}

const APP_ORIGIN = (Deno.env.get("HUBLY_APP_ORIGIN") || "").trim() || "https://myhubly.app";
const MAX_TOOL_ROUNDS = 4;
const MAX_HISTORY = 40;

// ---- Tools this conversation can invoke -----------------------------------
// Each tool wraps an EXISTING backend capability. No duplicate implementations —
// this file never re-parses HTML or re-implements analysis, it only calls out
// to the one canonical analyzer (api/import-analyze.js) and reports honestly
// on what came back.

async function callImportAnalyze(type: string, url: string): Promise<any> {
  const res = await fetch(`${APP_ORIGIN}/api/import-analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type, url }),
  });
  return await res.json().catch(() => null);
}

async function runTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const url = String(args?.url || "").trim();

  if (name === "analyze_website") {
    if (!/^https?:\/\//i.test(url)) return { ok: false, error: "invalid_url" };
    const r = await callImportAnalyze("website", url);
    if (!r?.ok || r.partial) {
      return {
        ok: true,
        real: false,
        summary: "The website could not be reached, so nothing was actually read from it.",
        raw: r?.analysis || null,
      };
    }
    return {
      ok: true,
      real: true,
      summary: "Real content was fetched and read from this website — title, description, headings, service-like list items, contact details, and dominant colors.",
      raw: r.analysis,
    };
  }

  if (name === "analyze_social_profile") {
    const platform = String(args?.platform || "").trim().toLowerCase();
    const type = platform === "instagram" ? "instagram" : platform === "facebook" ? "facebook" : "google_business";
    if (!/^https?:\/\//i.test(url)) return { ok: false, error: "invalid_url" };
    const r = await callImportAnalyze(type, url);
    const handle = r?.analysis?.handle || "";
    // Deliberately ignore r.analysis.note / r.analysis.queued from the legacy
    // analyzer — those claim work ("enrichment continues in Builder") that
    // never actually happens anywhere in this codebase today. Report only
    // what genuinely occurred: the link was recognized, nothing more.
    return {
      ok: true,
      real: false,
      summary: `No live integration exists for ${platform} yet, so its content could not be read. Only the link itself was recognized${handle ? ` (handle: "${handle}")` : ""}.`,
      raw: { platform, handle, profileUrl: url },
    };
  }

  return { ok: false, error: "unknown_tool" };
}

const SYSTEM_PROMPT = `You are Hubly — a conversational business partner, not a piece of software someone has to learn. You are the primary interface to the Hubly platform: every capability Hubly has should feel reachable by simply telling you what's needed, in plain conversation.

You are general-purpose. You are not an onboarding wizard and you must not behave like one. People may open a conversation with you for many different reasons — "I need help with my business", "help me build a website", "I want more customers", "I need a storefront", "help me price my services", or anything else. Respond to what the person actually asked for. Never force a scripted sequence of questions.

TONE
Warm, direct, and competent — like sitting down with a good consultant, not filling out a form. Short paragraphs. No corporate filler. Never say "as an AI".

LEARNING ABOUT A BUSINESS
When it's useful to understand the business before helping (e.g. someone asks for general help, or wants recommendations), you can ask them to paste a website, a Google Business Profile link, a Facebook or Instagram page, upload photos or screenshots, or simply say they're starting from scratch. All of those are valid — never insist on one over another.

Whenever you've just gathered new information (from a tool result, or from what someone told you directly), briefly reflect back what you now understand in plain language, then ask permission before going further — for example "Would it be okay if I showed you what I found?" or "Want me to walk you through what I'm seeing?". Earn the right to advise; don't just start advising. This applies any time you've just learned something new, not only at the very start of a conversation.

ABSOLUTE RULE — HONESTY OVER APPEARING INTELLIGENT
You must never imply that analysis happened unless it actually happened. If a tool result says something could not be read, say so plainly and explain what would need to change for you to read it (e.g. "there's no live connection to Instagram yet, so I can't read what's actually on the page — connecting it in the future will let me look at it properly"). Never invent findings, never say something is "being processed" or "continuing in the background" unless a real process is genuinely running. Trust matters more than sounding capable.

TOOLS AVAILABLE TO YOU
- analyze_website(url): Fetches and reads a real website — title, description, headings, service-like content, contact details, brand colors. This one is real and works.
- analyze_social_profile(platform, url): platform is "instagram", "facebook", or "google_business". Today this can only recognize the link/handle itself — it cannot read what's actually on the page, because no live integration exists for these yet. Always be upfront about that limitation when you use it.
- Photos or screenshots someone attaches are visible to you directly in the conversation — look at them and describe honestly what you can actually see.

RESPONSE FORMAT — YOU MUST ALWAYS REPLY WITH ONLY THIS JSON SHAPE, NOTHING ELSE:
To call a tool: {"action":"tool","tool":"analyze_website"|"analyze_social_profile","args":{...matching the tool's parameters...},"message":"<what you say to the person while this runs, e.g. 'Let me take a look at that...'>"}
To reply normally: {"action":"reply","message":"<your full reply to the person>"}

Only call a tool when someone has actually given you a URL to look at, or attached something to analyze. Never call a tool speculatively.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonRes({ ok: false, error: "POST required" }, 405);

  if (!HublyAI.isConfigured("openai")) {
    return jsonRes({ ok: false, error: "Hubly Conversation is not configured yet." }, 503);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const incoming: HublyMessage[] = Array.isArray(body?.messages) ? body.messages : [];
  if (!incoming.length) return jsonRes({ ok: false, error: "messages_required" }, 400);

  // Reserved for future Business Memory / DNA wiring — accepted and threaded
  // through, unused today. Adding it later means passing it into
  // HublyAI.chat({ memory, dna, ... }) below, not changing this contract.
  const businessId = body?.businessId ? String(body.businessId) : null;

  let history: HublyMessage[] = incoming.slice(-MAX_HISTORY);
  const actions: Array<{ tool: string; args: unknown; ok: boolean; real: boolean }> = [];

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const ai = await HublyAI.chat({
        feature: "hubly-conversation",
        system: SYSTEM_PROMPT,
        messages: history,
        jsonMode: true,
        maxTokens: 900,
        businessId,
      });

      const rawText = String(ai.text || "").trim();
      let decision: any;
      try {
        decision = JSON.parse(extractJson(rawText));
      } catch {
        // Model didn't return the expected JSON shape — fail open honestly
        // rather than pretending structure that isn't there.
        decision = { action: "reply", message: rawText || "Sorry, could you say that again?" };
      }

      if (decision?.action === "tool" && decision.tool) {
        const said = String(decision.message || "").trim();
        if (said) history.push({ role: "assistant", content: said });

        const result = await runTool(String(decision.tool), decision.args || {});
        actions.push({
          tool: String(decision.tool),
          args: decision.args || {},
          ok: !!result.ok,
          real: !!result.real,
        });

        history.push({
          role: "system",
          content: `TOOL RESULT for ${decision.tool}: ${JSON.stringify(result)}\nOnly report what "summary" and "raw" actually show. Do not claim anything beyond this.`,
        });
        continue;
      }

      const finalText =
        String(decision?.message || decision?.reply || rawText || "").trim() ||
        "I'm here — what would you like help with?";
      history.push({ role: "assistant", content: finalText });
      return jsonRes({ ok: true, reply: finalText, messages: history, actions });
    }

    // Exhausted tool rounds without a final natural-language reply — stop
    // honestly instead of looping forever.
    return jsonRes({
      ok: true,
      reply: "I've gathered what I can for now — what would you like to do next?",
      messages: history,
      actions,
    });
  } catch (err) {
    console.error("hubly-conversation error:", err);
    return jsonRes({ ok: false, error: "Hubly Conversation is temporarily unavailable." }, 502);
  }
});
