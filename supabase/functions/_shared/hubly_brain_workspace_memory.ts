/**
 * Hubly Brain — Workspace Memory (Milestone 1 · Section 6)
 *
 * Business Memory  = what Hubly knows about the business.
 * Workspace Memory = what Hubly knows about how the owner likes to work.
 *
 * Foundation for the future Workspace Expert (Milestone 10).
 * This section does NOT personalize CRM — it stores workspace preferences only.
 *
 * Ownership:
 * - Experts may READ and SUGGEST updates.
 * - Hubly Brain alone COMMITS updates.
 * - No expert writes Workspace Memory directly.
 */

export const HUBLY_WORKSPACE_MEMORY_VERSION = 2 as const;
export const WORKSPACE_MEMORY_OWNER = "hubly_brain" as const;

export type WorkspaceImportance = "low" | "medium" | "high" | "critical";
export type WorkspaceSource = "user" | "ai_inference" | "external_integration";

export type HublyWorkspaceFactMeta = {
  importance: WorkspaceImportance;
  confidence: number;
  source: WorkspaceSource;
  lastVerified: string;
};

export type HublyWorkspaceChange = {
  id: string;
  at: string;
  path: string;
  previous: unknown;
  next: unknown;
  reason: string;
  expertId: string;
  importance: WorkspaceImportance;
  confidence: number;
  source: WorkspaceSource;
  memoryVersion: number;
};

export type HublyWorkspaceSuggestion = {
  path: string;
  value: unknown;
  reason: string;
  expertId: string;
  importance?: WorkspaceImportance;
  confidence?: number;
  source?: WorkspaceSource;
};

export type HublyWorkspaceAiSuggestion = {
  id: string;
  at: string;
  suggestion: string;
  status: "suggested" | "accepted" | "dismissed";
  reason: string;
  expertId: string;
  confidence: number;
};

export type HublyWorkspaceVersionSnapshot = {
  version: number;
  at: string;
  summary: string;
};

/**
 * Canonical Workspace Memory — how the owner prefers to work inside Hubly.
 */
export type HublyWorkspaceMemory = {
  /** Schema version */
  version: typeof HUBLY_WORKSPACE_MEMORY_VERSION;
  /** Content version — increments on every Brain commit */
  memoryVersion: number;
  /** Sidebar / nav item order (e.g. jobs, customers, calendar). */
  sidebarOrder?: string[] | null;
  /** Dashboard widget / card order. */
  dashboardLayout?: string[] | null;
  /** Modules/tools the owner hid. */
  hiddenModules?: string[] | null;
  /** Alias used in docs — same as hiddenModules. */
  hiddenTools?: string[] | null;
  favoritePages?: string[] | null;
  pinnedActions?: string[] | null;
  /** Soft working-style prefs (density, default landing, etc.). */
  workingStyle?: {
    defaultLanding?: string | null;
    density?: "comfortable" | "compact" | string | null;
    showTips?: boolean | null;
    notes?: string | null;
  } | null;
  /** Future Workspace Expert suggestions — stored, not auto-applied. */
  aiSuggestions?: HublyWorkspaceAiSuggestion[] | null;
  navigation?: Record<string, unknown> | null;
  history?: Array<{ at: string; action: string; detail?: string | null }> | null;
  preferences?: Record<string, unknown> | null;
  changelog?: HublyWorkspaceChange[] | null;
  versionHistory?: HublyWorkspaceVersionSnapshot[] | null;
  factMeta?: Record<string, HublyWorkspaceFactMeta> | null;
  updatedAt?: string | null;
};

export type HublyWorkspaceMemoryInput = Partial<HublyWorkspaceMemory>;

function asStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.map((x) => String(x || "").trim()).filter(Boolean);
  return out.length ? out : null;
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function getPath(obj: unknown, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".").filter(Boolean);
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== "object" || Array.isArray(cur[p])) {
      cur[p] = {};
    }
    cur = cur[p] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function defaultImportance(path: string): WorkspaceImportance {
  if (/sidebarOrder|defaultLanding/.test(path)) return "high";
  if (/hiddenModules|hiddenTools|pinnedActions|dashboardLayout/.test(path)) return "high";
  if (/favoritePages|workingStyle/.test(path)) return "medium";
  if (/aiSuggestions|tips|notes/.test(path)) return "low";
  return "medium";
}

function ensureShape(w: HublyWorkspaceMemory): HublyWorkspaceMemory {
  w.sidebarOrder = w.sidebarOrder ?? ["jobs", "customers", "calendar", "website", "marketing"];
  w.dashboardLayout = w.dashboardLayout ?? ["today", "pipeline", "revenue"];
  w.hiddenModules = w.hiddenModules ?? [];
  w.hiddenTools = w.hiddenTools ?? w.hiddenModules;
  w.favoritePages = w.favoritePages ?? [];
  w.pinnedActions = w.pinnedActions ?? [];
  w.workingStyle = w.workingStyle ?? {
    defaultLanding: "jobs",
    density: "comfortable",
    showTips: true,
    notes: null,
  };
  w.aiSuggestions = w.aiSuggestions ?? [];
  w.navigation = w.navigation ?? {};
  w.history = w.history ?? [];
  w.preferences = w.preferences ?? {};
  w.changelog = w.changelog ?? [];
  w.versionHistory = w.versionHistory ?? [];
  w.factMeta = w.factMeta ?? {};
  // Keep aliases in sync
  if (w.hiddenModules?.length && (!w.hiddenTools || !w.hiddenTools.length)) {
    w.hiddenTools = [...w.hiddenModules];
  }
  if (w.hiddenTools?.length && (!w.hiddenModules || !w.hiddenModules.length)) {
    w.hiddenModules = [...w.hiddenTools];
  }
  return w;
}

export function normalizeWorkspaceMemory(
  input?: HublyWorkspaceMemoryInput | null,
): HublyWorkspaceMemory {
  const i = input || {};
  const hidden = asStringArray(i.hiddenModules) || asStringArray(i.hiddenTools);
  const memory: HublyWorkspaceMemory = {
    version: HUBLY_WORKSPACE_MEMORY_VERSION,
    memoryVersion: typeof i.memoryVersion === "number" ? i.memoryVersion : 0,
    sidebarOrder: asStringArray(i.sidebarOrder),
    dashboardLayout: asStringArray(i.dashboardLayout),
    hiddenModules: hidden,
    hiddenTools: hidden,
    favoritePages: asStringArray(i.favoritePages),
    pinnedActions: asStringArray(i.pinnedActions),
    workingStyle: i.workingStyle && typeof i.workingStyle === "object"
      ? { ...i.workingStyle }
      : null,
    aiSuggestions: Array.isArray(i.aiSuggestions) ? deepClone(i.aiSuggestions) : null,
    navigation: i.navigation && typeof i.navigation === "object" ? { ...i.navigation } : null,
    history: Array.isArray(i.history)
      ? i.history.slice(-40).map((h) => ({
        at: String(h?.at || new Date().toISOString()),
        action: String(h?.action || ""),
        detail: h?.detail != null ? String(h.detail) : null,
      }))
      : null,
    preferences: i.preferences && typeof i.preferences === "object" ? { ...i.preferences } : null,
    changelog: Array.isArray(i.changelog) ? deepClone(i.changelog) : null,
    versionHistory: Array.isArray(i.versionHistory) ? deepClone(i.versionHistory) : null,
    factMeta: i.factMeta && typeof i.factMeta === "object" ? { ...i.factMeta } : null,
    updatedAt: i.updatedAt ? String(i.updatedAt) : new Date().toISOString(),
  };
  return ensureShape(memory);
}

/** Shallow merge without changelog (use commit for audited updates). */
export function mergeWorkspaceMemory(
  base?: HublyWorkspaceMemoryInput | null,
  patch?: HublyWorkspaceMemoryInput | null,
): HublyWorkspaceMemory {
  const a = normalizeWorkspaceMemory(base);
  const b = normalizeWorkspaceMemory(patch);
  return normalizeWorkspaceMemory({
    ...a,
    ...b,
    sidebarOrder: b.sidebarOrder ?? a.sidebarOrder,
    dashboardLayout: b.dashboardLayout ?? a.dashboardLayout,
    hiddenModules: b.hiddenModules ?? a.hiddenModules,
    hiddenTools: b.hiddenTools ?? a.hiddenTools,
    favoritePages: b.favoritePages ?? a.favoritePages,
    pinnedActions: b.pinnedActions ?? a.pinnedActions,
    workingStyle: { ...(a.workingStyle || {}), ...(b.workingStyle || {}) },
    navigation: { ...(a.navigation || {}), ...(b.navigation || {}) },
    preferences: { ...(a.preferences || {}), ...(b.preferences || {}) },
    history: [...(a.history || []), ...(b.history || [])].slice(-40),
    aiSuggestions: b.aiSuggestions?.length ? b.aiSuggestions : a.aiSuggestions,
    changelog: a.changelog,
    versionHistory: a.versionHistory,
    factMeta: { ...(a.factMeta || {}), ...(b.factMeta || {}) },
    memoryVersion: Math.max(a.memoryVersion || 0, b.memoryVersion || 0),
    updatedAt: new Date().toISOString(),
  });
}

/** Experts suggest — never write. Brain commits. */
export function suggestWorkspaceUpdate(suggestion: HublyWorkspaceSuggestion): HublyWorkspaceSuggestion {
  if (!suggestion?.path) throw new Error("Workspace suggestion requires path");
  if (!suggestion.expertId) throw new Error("Workspace suggestion requires expertId");
  return {
    ...suggestion,
    importance: suggestion.importance || defaultImportance(suggestion.path),
    confidence: typeof suggestion.confidence === "number" ? suggestion.confidence : 80,
    source: suggestion.source || "ai_inference",
  };
}

export type CommitWorkspaceResult = {
  workspace: HublyWorkspaceMemory;
  changes: HublyWorkspaceChange[];
  committedBy: typeof WORKSPACE_MEMORY_OWNER;
};

/** Hubly Brain commits workspace preference updates. */
export function commitWorkspaceUpdates(
  base: HublyWorkspaceMemoryInput | null | undefined,
  suggestions: HublyWorkspaceSuggestion[],
  opts?: { at?: string; summary?: string },
): CommitWorkspaceResult {
  const workspace = normalizeWorkspaceMemory(base);
  const at = opts?.at || new Date().toISOString();
  const changes: HublyWorkspaceChange[] = [];
  const root = workspace as unknown as Record<string, unknown>;

  for (const raw of suggestions) {
    const s = suggestWorkspaceUpdate(raw);
    const previous = getPath(workspace, s.path);
    if (valuesEqual(previous, s.value)) continue;

    setPath(root, s.path, s.value);
    // Keep hidden aliases aligned
    if (s.path === "hiddenModules") setPath(root, "hiddenTools", s.value);
    if (s.path === "hiddenTools") setPath(root, "hiddenModules", s.value);

    workspace.memoryVersion = (workspace.memoryVersion || 0) + 1;
    const change: HublyWorkspaceChange = {
      id: newId("wschg"),
      at,
      path: s.path,
      previous: previous === undefined ? null : deepClone(previous),
      next: deepClone(s.value),
      reason: s.reason,
      expertId: s.expertId,
      importance: s.importance || defaultImportance(s.path),
      confidence: s.confidence ?? 80,
      source: s.source || "ai_inference",
      memoryVersion: workspace.memoryVersion,
    };
    changes.push(change);
    workspace.changelog = [...(workspace.changelog || []), change].slice(-500);
    workspace.factMeta = {
      ...(workspace.factMeta || {}),
      [s.path]: {
        importance: change.importance,
        confidence: change.confidence,
        source: change.source,
        lastVerified: at,
      },
    };
    workspace.history = [
      ...(workspace.history || []),
      { at, action: "commit", detail: `${s.path}: ${s.reason}` },
    ].slice(-40);
  }

  if (changes.length) {
    workspace.versionHistory = [
      ...(workspace.versionHistory || []),
      {
        version: workspace.memoryVersion,
        at,
        summary: opts?.summary ||
          changes.map((c) => `${c.path}: ${c.reason}`).join("; ").slice(0, 400),
      },
    ].slice(-200);
  }

  workspace.updatedAt = at;
  return { workspace: ensureShape(workspace), changes, committedBy: WORKSPACE_MEMORY_OWNER };
}

/** Extract owner workspace preferences from natural language. */
export function extractWorkspaceSuggestionsFromRequest(
  request: string,
  current?: HublyWorkspaceMemoryInput | null,
): HublyWorkspaceSuggestion[] {
  const text = String(request || "").trim();
  const lower = text.toLowerCase();
  const out: HublyWorkspaceSuggestion[] = [];
  const expertId = WORKSPACE_MEMORY_OWNER;
  const cur = normalizeWorkspaceMemory(current);

  // "Put Jobs above Customers in the sidebar"
  const above = lower.match(
    /(?:put|move|place)\s+([a-z0-9 _-]+?)\s+above\s+([a-z0-9 _-]+?)(?:\s+in\s+the\s+sidebar)?[.!]?$/i,
  );
  if (above && !/dashboard/i.test(text)) {
    const a = above[1].trim().replace(/\s+/g, "_");
    const b = above[2].trim().replace(/\s+/g, "_");
    const order = [...(cur.sidebarOrder || [])];
    const ensure = (id: string) => {
      if (!order.includes(id)) order.push(id);
    };
    ensure(a);
    ensure(b);
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia >= 0 && ib >= 0) {
      order.splice(ia, 1);
      const newIb = order.indexOf(b);
      order.splice(newIb, 0, a);
    }
    out.push(suggestWorkspaceUpdate({
      path: "sidebarOrder",
      value: order,
      reason: `Owner asked to put ${a} above ${b} in the sidebar`,
      expertId,
      importance: "high",
      confidence: 94,
      source: "user",
    }));
  }

  // "Hide the Marketing tools for now" / "hide marketing"
  const hide = lower.match(/hide\s+(?:the\s+)?([a-z0-9 _-]+?)(?:\s+tools?|\s+module|\s+page)?(?:\s+for now)?[.!]?$/i);
  if (hide || /hide\s+marketing/i.test(text)) {
    const rawName = hide?.[1] || "marketing";
    const name = rawName.replace(/\s+/g, "_").replace(/_?tools?$/, "").replace(/_?module$/, "");
    const next = [...new Set([...(cur.hiddenModules || []), name])];
    out.push(suggestWorkspaceUpdate({
      path: "hiddenModules",
      value: next,
      reason: `Owner asked to hide ${name}`,
      expertId,
      importance: "high",
      confidence: 93,
      source: "user",
    }));
  }

  // "Pin Create Quote" / "pin booking"
  const pin = lower.match(/pin\s+(?:the\s+)?(.+?)[.!]?$/i);
  if (pin) {
    const action = pin[1].trim().replace(/\s+/g, "_");
    const next = [...new Set([...(cur.pinnedActions || []), action])];
    out.push(suggestWorkspaceUpdate({
      path: "pinnedActions",
      value: next,
      reason: `Owner pinned ${action}`,
      expertId,
      importance: "high",
      confidence: 92,
      source: "user",
    }));
  }

  // "Favorite the calendar page"
  const fav = lower.match(/(?:favorite|favourite|star)\s+(?:the\s+)?([a-z0-9 _-]+?)(?:\s+page)?[.!]?$/i);
  if (fav) {
    const page = fav[1].trim().replace(/\s+/g, "_");
    const next = [...new Set([...(cur.favoritePages || []), page])];
    out.push(suggestWorkspaceUpdate({
      path: "favoritePages",
      value: next,
      reason: `Owner favorited ${page}`,
      expertId,
      importance: "medium",
      confidence: 90,
      source: "user",
    }));
  }

  // "Show pipeline above revenue on the dashboard"
  const dash = lower.match(
    /(?:put|move|show)\s+([a-z0-9 _-]+?)\s+above\s+([a-z0-9 _-]+?)(?:\s+on\s+the\s+dashboard)?[.!]?$/i,
  );
  if (dash && /dashboard/i.test(text)) {
    const a = dash[1].trim().replace(/\s+/g, "_");
    const b = dash[2].trim().replace(/\s+/g, "_");
    const order = [...(cur.dashboardLayout || [])];
    if (!order.includes(a)) order.push(a);
    if (!order.includes(b)) order.push(b);
    const ia = order.indexOf(a);
    order.splice(ia, 1);
    const newIb = order.indexOf(b);
    order.splice(newIb, 0, a);
    out.push(suggestWorkspaceUpdate({
      path: "dashboardLayout",
      value: order,
      reason: `Owner asked to show ${a} above ${b} on the dashboard`,
      expertId,
      importance: "high",
      confidence: 91,
      source: "user",
    }));
  }

  // Default landing
  const land = lower.match(/(?:start|open|land)\s+(?:on\s+)?(?:the\s+)?([a-z0-9 _-]+?)(?:\s+page)?(?:\s+by default)?[.!]?$/i);
  if (land && /default|start on|open on|land on/i.test(text)) {
    const page = land[1].trim().replace(/\s+/g, "_");
    out.push(suggestWorkspaceUpdate({
      path: "workingStyle.defaultLanding",
      value: page,
      reason: `Owner wants to land on ${page} by default`,
      expertId,
      importance: "high",
      confidence: 88,
      source: "user",
    }));
  }

  return out;
}

export function commitWorkspaceAiSuggestion(
  base: HublyWorkspaceMemoryInput | null | undefined,
  entry: Omit<HublyWorkspaceAiSuggestion, "id" | "at"> & { at?: string },
): CommitWorkspaceResult {
  const workspace = normalizeWorkspaceMemory(base);
  const at = entry.at || new Date().toISOString();
  const full: HublyWorkspaceAiSuggestion = {
    id: newId("wsai"),
    at,
    suggestion: entry.suggestion,
    status: entry.status,
    reason: entry.reason,
    expertId: entry.expertId,
    confidence: entry.confidence,
  };
  return commitWorkspaceUpdates(workspace, [
    suggestWorkspaceUpdate({
      path: "aiSuggestions",
      value: [...(workspace.aiSuggestions || []), full],
      reason: `Workspace AI suggestion ${entry.status}: ${entry.suggestion}`.slice(0, 200),
      expertId: entry.expertId,
      importance: "low",
      confidence: entry.confidence,
      source: "ai_inference",
    }),
  ], { at, summary: `AI workspace suggestion ${entry.status}` });
}

export function isWorkspaceRetrievalQuestion(request: string): boolean {
  const r = String(request || "").toLowerCase();
  return /what does my workspace|my workspace look|sidebar order|why did we hide|pinned actions|favorite pages|how do i like to work|workspace preferences|what'?s hidden/.test(r);
}

export type HublyWorkspaceQueryResult = {
  answer: string;
  fromWorkspaceMemory: true;
  usedChatHistory: false;
  paths: string[];
  changes?: HublyWorkspaceChange[];
  confidence: number;
};

/** Answer from Workspace Memory — not chat logs, not Business Memory. */
export function queryWorkspaceMemory(
  input: HublyWorkspaceMemoryInput | null | undefined,
  question: string,
): HublyWorkspaceQueryResult {
  const w = normalizeWorkspaceMemory(input);
  const q = String(question || "").toLowerCase();

  if (/what does my workspace|my workspace look|how do i like to work|workspace preferences/.test(q)) {
    return {
      answer:
        `Your workspace: sidebar ${ (w.sidebarOrder || []).join(" → ") }. ` +
        `Dashboard ${ (w.dashboardLayout || []).join(" → ") }. ` +
        `Hidden: ${ (w.hiddenModules || []).join(", ") || "nothing" }. ` +
        `Pinned: ${ (w.pinnedActions || []).join(", ") || "none" }. ` +
        `Favorites: ${ (w.favoritePages || []).join(", ") || "none" }. ` +
        `Default landing: ${w.workingStyle?.defaultLanding || "jobs"}.`,
      fromWorkspaceMemory: true,
      usedChatHistory: false,
      paths: ["sidebarOrder", "dashboardLayout", "hiddenModules", "pinnedActions", "favoritePages", "workingStyle"],
      confidence: 92,
    };
  }

  if (/why did we hide|what'?s hidden|hidden tools|hidden modules/.test(q)) {
    const hideChanges = (w.changelog || []).filter((c) =>
      c.path === "hiddenModules" || c.path === "hiddenTools"
    );
    const latest = hideChanges[hideChanges.length - 1];
    const hidden = w.hiddenModules || [];
    if (!hidden.length && !latest) {
      return {
        answer: "Nothing is hidden in Workspace Memory right now.",
        fromWorkspaceMemory: true,
        usedChatHistory: false,
        paths: ["hiddenModules"],
        confidence: 80,
      };
    }
    return {
      answer:
        `Hidden tools: ${hidden.join(", ") || "none"}. ` +
        (latest
          ? `We hid them because: ${latest.reason} (${latest.at}, ${latest.expertId}).`
          : "No hide-reasoning stored yet."),
      fromWorkspaceMemory: true,
      usedChatHistory: false,
      paths: ["hiddenModules", "changelog"],
      changes: hideChanges.slice(-5),
      confidence: 93,
    };
  }

  if (/sidebar/.test(q)) {
    return {
      answer: `Sidebar order: ${(w.sidebarOrder || []).join(" → ")}.`,
      fromWorkspaceMemory: true,
      usedChatHistory: false,
      paths: ["sidebarOrder"],
      confidence: 90,
    };
  }

  if (/pinned/.test(q)) {
    return {
      answer: `Pinned actions: ${(w.pinnedActions || []).join(", ") || "none"}.`,
      fromWorkspaceMemory: true,
      usedChatHistory: false,
      paths: ["pinnedActions"],
      confidence: 90,
    };
  }

  return {
    answer: "I checked Workspace Memory — ask about sidebar, dashboard, hidden tools, pins, or favorites.",
    fromWorkspaceMemory: true,
    usedChatHistory: false,
    paths: [],
    confidence: 50,
  };
}

export function formatWorkspaceMemory(ws?: HublyWorkspaceMemoryInput | null): string {
  const w = normalizeWorkspaceMemory(ws);
  const lines = [
    "HUBLY WORKSPACE MEMORY (how the owner likes to work — separate from Business Memory):",
    `memoryVersion: ${w.memoryVersion}`,
  ];
  if (w.sidebarOrder?.length) lines.push(`Sidebar order: ${w.sidebarOrder.join(" → ")}`);
  if (w.dashboardLayout?.length) lines.push(`Dashboard: ${w.dashboardLayout.join(" → ")}`);
  if (w.hiddenModules?.length) lines.push(`Hidden tools: ${w.hiddenModules.join(", ")}`);
  if (w.favoritePages?.length) lines.push(`Favorites: ${w.favoritePages.join(", ")}`);
  if (w.pinnedActions?.length) lines.push(`Pinned: ${w.pinnedActions.join(", ")}`);
  if (w.workingStyle?.defaultLanding) lines.push(`Default landing: ${w.workingStyle.defaultLanding}`);
  return lines.join("\n");
}

const WORKSPACE_STORE = new Map<string, HublyWorkspaceMemory>();

export function persistWorkspaceMemoryLocal(
  businessId: string,
  workspace: HublyWorkspaceMemoryInput,
): HublyWorkspaceMemory {
  const normalized = normalizeWorkspaceMemory(workspace);
  WORKSPACE_STORE.set(String(businessId), deepClone(normalized));
  return deepClone(normalized);
}

export function loadWorkspaceMemoryLocal(businessId: string): HublyWorkspaceMemory | null {
  const m = WORKSPACE_STORE.get(String(businessId));
  return m ? deepClone(m) : null;
}

export function clearWorkspaceMemoryStoreForTests(): void {
  WORKSPACE_STORE.clear();
}

export const HublyWorkspaceMemoryApi = {
  version: HUBLY_WORKSPACE_MEMORY_VERSION,
  owner: WORKSPACE_MEMORY_OWNER,
  normalize: normalizeWorkspaceMemory,
  merge: mergeWorkspaceMemory,
  format: formatWorkspaceMemory,
  suggest: suggestWorkspaceUpdate,
  commit: commitWorkspaceUpdates,
  extractFromRequest: extractWorkspaceSuggestionsFromRequest,
  commitAiSuggestion: commitWorkspaceAiSuggestion,
  query: queryWorkspaceMemory,
  isRetrievalQuestion: isWorkspaceRetrievalQuestion,
  persistLocal: persistWorkspaceMemoryLocal,
  loadLocal: loadWorkspaceMemoryLocal,
  clearStoreForTests: clearWorkspaceMemoryStoreForTests,
  empty(): HublyWorkspaceMemory {
    return normalizeWorkspaceMemory({});
  },
};

export default HublyWorkspaceMemoryApi;
