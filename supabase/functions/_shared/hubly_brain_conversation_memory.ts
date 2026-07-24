/**
 * Hubly Brain — Conversation Memory turns (chat log surface)
 *
 * Stores raw conversation turns for session continuity.
 * Section 10 working memory lives in `hubly_brain_conversation_intelligence.ts`
 * (goals, projects, threads, commitments) — not here.
 */

export const HUBLY_CONVERSATION_MEMORY_VERSION = 1 as const;

export type HublyConversationTurn = {
  role: "owner" | "hubly" | "system";
  text: string;
  at?: string | null;
};

export type HublyConversationMemory = {
  version: typeof HUBLY_CONVERSATION_MEMORY_VERSION;
  sessionId?: string | null;
  turns: HublyConversationTurn[];
  summary?: string | null;
  tone?: string | null;
  pendingTasks?: string[] | null;
  longTermGoals?: string[] | null;
  context?: Record<string, unknown> | null;
  updatedAt?: string | null;
};

export type HublyConversationMemoryInput = Partial<HublyConversationMemory> & {
  turns?: Array<Partial<HublyConversationTurn> | HublyConversationTurn> | null;
};

export function normalizeConversationMemory(
  input?: HublyConversationMemoryInput | null,
): HublyConversationMemory {
  const i = input || {};
  const turns = (Array.isArray(i.turns) ? i.turns : [])
    .map((t) => ({
      role: (t?.role === "owner" || t?.role === "system" ? t.role : "hubly") as HublyConversationTurn["role"],
      text: String(t?.text || "").trim(),
      at: t?.at ? String(t.at) : null,
    }))
    .filter((t) => t.text)
    .slice(-80);
  return {
    version: HUBLY_CONVERSATION_MEMORY_VERSION,
    sessionId: i.sessionId ? String(i.sessionId) : null,
    turns,
    summary: i.summary ? String(i.summary).trim() : null,
    tone: i.tone ? String(i.tone).trim() : null,
    pendingTasks: Array.isArray(i.pendingTasks)
      ? i.pendingTasks.map((x) => String(x).trim()).filter(Boolean)
      : null,
    longTermGoals: Array.isArray(i.longTermGoals)
      ? i.longTermGoals.map((x) => String(x).trim()).filter(Boolean)
      : null,
    context: i.context && typeof i.context === "object" ? { ...i.context } : null,
    updatedAt: i.updatedAt ? String(i.updatedAt) : new Date().toISOString(),
  };
}

export function appendConversationTurn(
  mem: HublyConversationMemoryInput | null | undefined,
  turn: HublyConversationTurn,
): HublyConversationMemory {
  const base = normalizeConversationMemory(mem);
  return normalizeConversationMemory({
    ...base,
    turns: [...base.turns, { ...turn, at: turn.at || new Date().toISOString() }],
    updatedAt: new Date().toISOString(),
  });
}

export function summarizeConversationLocal(mem: HublyConversationMemoryInput | null | undefined): string {
  const m = normalizeConversationMemory(mem);
  if (m.summary) return m.summary;
  const ownerBits = m.turns.filter((t) => t.role === "owner").slice(-4).map((t) => t.text);
  if (!ownerBits.length) return "No conversation yet.";
  return `Recent owner points: ${ownerBits.join(" · ")}`;
}

export function formatConversationMemory(mem?: HublyConversationMemoryInput | null): string {
  const m = normalizeConversationMemory(mem);
  const lines = ["Conversation Memory:"];
  if (m.summary) lines.push(`Summary: ${m.summary}`);
  if (m.tone) lines.push(`Tone: ${m.tone}`);
  if (m.pendingTasks?.length) lines.push(`Pending: ${m.pendingTasks.join("; ")}`);
  if (m.longTermGoals?.length) lines.push(`Goals: ${m.longTermGoals.join("; ")}`);
  const recent = m.turns.slice(-6);
  if (recent.length) {
    lines.push("Recent turns:");
    recent.forEach((t) => lines.push(`- ${t.role}: ${t.text}`));
  }
  return lines.join("\n");
}

export const HublyConversationMemoryApi = {
  normalize: normalizeConversationMemory,
  append: appendConversationTurn,
  summarizeLocal: summarizeConversationLocal,
  format: formatConversationMemory,
};
