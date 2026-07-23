/**
 * Hubly Brain — Workspace Memory (Milestone 1)
 *
 * Separate from Business Memory.
 * Stores how the owner uses Hubly (nav, dashboard, pins) — not business facts.
 */

export const HUBLY_WORKSPACE_MEMORY_VERSION = 1 as const;

export type HublyWorkspaceMemory = {
  version: typeof HUBLY_WORKSPACE_MEMORY_VERSION;
  sidebarOrder?: string[] | null;
  dashboardLayout?: string[] | null;
  hiddenModules?: string[] | null;
  favoritePages?: string[] | null;
  pinnedActions?: string[] | null;
  navigation?: Record<string, unknown> | null;
  history?: Array<{ at: string; action: string; detail?: string | null }> | null;
  preferences?: Record<string, unknown> | null;
  updatedAt?: string | null;
};

export type HublyWorkspaceMemoryInput = Partial<HublyWorkspaceMemory>;

function asStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.map((x) => String(x || "").trim()).filter(Boolean);
  return out.length ? out : null;
}

export function normalizeWorkspaceMemory(input?: HublyWorkspaceMemoryInput | null): HublyWorkspaceMemory {
  const i = input || {};
  return {
    version: HUBLY_WORKSPACE_MEMORY_VERSION,
    sidebarOrder: asStringArray(i.sidebarOrder),
    dashboardLayout: asStringArray(i.dashboardLayout),
    hiddenModules: asStringArray(i.hiddenModules),
    favoritePages: asStringArray(i.favoritePages),
    pinnedActions: asStringArray(i.pinnedActions),
    navigation: i.navigation && typeof i.navigation === "object" ? { ...i.navigation } : null,
    history: Array.isArray(i.history)
      ? i.history.slice(-40).map((h) => ({
        at: String(h?.at || new Date().toISOString()),
        action: String(h?.action || ""),
        detail: h?.detail != null ? String(h.detail) : null,
      }))
      : null,
    preferences: i.preferences && typeof i.preferences === "object" ? { ...i.preferences } : null,
    updatedAt: i.updatedAt ? String(i.updatedAt) : new Date().toISOString(),
  };
}

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
    favoritePages: b.favoritePages ?? a.favoritePages,
    pinnedActions: b.pinnedActions ?? a.pinnedActions,
    navigation: { ...(a.navigation || {}), ...(b.navigation || {}) },
    preferences: { ...(a.preferences || {}), ...(b.preferences || {}) },
    history: [...(a.history || []), ...(b.history || [])].slice(-40),
    updatedAt: new Date().toISOString(),
  });
}

export function formatWorkspaceMemory(ws?: HublyWorkspaceMemoryInput | null): string {
  const w = normalizeWorkspaceMemory(ws);
  const lines = ["Workspace Memory (how the owner uses Hubly):"];
  if (w.sidebarOrder?.length) lines.push(`Sidebar order: ${w.sidebarOrder.join(" → ")}`);
  if (w.hiddenModules?.length) lines.push(`Hidden modules: ${w.hiddenModules.join(", ")}`);
  if (w.favoritePages?.length) lines.push(`Favorites: ${w.favoritePages.join(", ")}`);
  if (w.pinnedActions?.length) lines.push(`Pinned: ${w.pinnedActions.join(", ")}`);
  return lines.join("\n");
}

export const HublyWorkspaceMemoryApi = {
  normalize: normalizeWorkspaceMemory,
  merge: mergeWorkspaceMemory,
  format: formatWorkspaceMemory,
};
