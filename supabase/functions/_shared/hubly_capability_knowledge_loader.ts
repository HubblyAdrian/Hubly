// supabase/functions/_shared/hubly_capability_knowledge_loader.ts
//
// Selects the slice of the Hubly Capability Knowledge Base relevant to THIS
// turn — current Business Understanding plus the latest user message — so
// the system prompt stays small and stable no matter how large the
// Knowledge Base grows. As the Knowledge Base grows, this file does not
// need to change; only hubly_capability_knowledge_base.ts does.
//
// Deliberately deterministic, not a second AI call: scoring is keyword and
// data-driven, same principle as the Hubly Planner (one reasoning engine in
// the platform; everything downstream of it is deterministic).
//
// This has no awareness of the Capability Registry — it selects KNOWLEDGE
// for the model to reason over, never anything to invoke.

import {
  HUBLY_CAPABILITY_KNOWLEDGE_BASE,
  type CapabilityKnowledgeEntry,
} from "./hubly_capability_knowledge_base.ts";
import type { BusinessUnderstandingPatch } from "./hubly_business_understanding.ts";

export type CapabilityKnowledgeLoaderInput = {
  understanding: BusinessUnderstandingPatch;
  /** The latest user-authored message text, if any. Non-string content (e.g. images) yields no keyword signal. */
  userMessage: string | null;
};

// Hard cap — this is what actually keeps the prompt small and stable as the
// Knowledge Base grows from 30 entries to 300. Never load more than this
// many, regardless of how many entries score above zero.
const MAX_LOADED_CAPABILITIES = 6;

// When too little scores above zero (e.g. an early, generic turn), backfill
// with a small set of foundational entries rather than returning nothing —
// these are the capabilities almost every business needs early.
const FOUNDATIONAL_IDS = ["website.generation", "storefront.serviceCatalog", "booking.creation"];
const MIN_BEFORE_BACKFILL = 3;

function scoreEntry(entry: CapabilityKnowledgeEntry, input: CapabilityKnowledgeLoaderInput): number {
  let score = 0;

  const text = (input.userMessage || "").toLowerCase();
  if (text) {
    for (const keyword of entry.triggerKeywords) {
      if (text.includes(keyword)) score += 3;
    }
  }

  const industry = String(input.understanding.industry || "").toLowerCase();
  if (industry && !entry.industries.includes("all")) {
    const matches = entry.industries.some((i) => industry.includes(i) || i.includes(industry));
    if (matches) score += 2;
  }

  if (entry.relevantWhenMissing) {
    for (const key of entry.relevantWhenMissing) {
      if ((input.understanding as Record<string, unknown>)[key] == null) score += 1;
    }
  }

  return score;
}

/** Returns at most MAX_LOADED_CAPABILITIES entries, ranked by relevance to this turn. */
export function selectRelevantCapabilityKnowledge(
  input: CapabilityKnowledgeLoaderInput,
): CapabilityKnowledgeEntry[] {
  const scored = HUBLY_CAPABILITY_KNOWLEDGE_BASE
    .map((entry) => ({ entry, score: scoreEntry(entry, input) }))
    .sort((a, b) => b.score - a.score);

  const selected = scored.filter((s) => s.score > 0).slice(0, MAX_LOADED_CAPABILITIES).map((s) => s.entry);

  if (selected.length < MIN_BEFORE_BACKFILL) {
    const already = new Set(selected.map((e) => e.id));
    for (const id of FOUNDATIONAL_IDS) {
      if (selected.length >= MAX_LOADED_CAPABILITIES) break;
      if (already.has(id)) continue;
      const fallback = HUBLY_CAPABILITY_KNOWLEDGE_BASE.find((e) => e.id === id);
      if (fallback) {
        selected.push(fallback);
        already.add(id);
      }
    }
  }

  return selected;
}

/** Renders selected entries into the prompt block — the ONLY place this text is produced. */
export function buildCapabilityKnowledgePromptBlock(entries: CapabilityKnowledgeEntry[]): string {
  if (!entries.length) {
    return "(Nothing specifically relevant loaded this turn — rely on general judgment and the capabilities list below.)";
  }
  return entries
    .map((e) => {
      const status = e.status === "partial" ? `Partial — ${e.statusNote}` : "Production ready.";
      return `- ${e.name}: ${e.whatItDoes} Solves: ${e.customerProblem} Recommend when: ${e.recommendWhen} (${status})`;
    })
    .join("\n");
}
