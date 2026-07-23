/**
 * Node mirror of hubly_brain_workspace_memory.ts — Section 6 behavioral proofs.
 */
export const HUBLY_WORKSPACE_MEMORY_VERSION = 2;
export const WORKSPACE_MEMORY_OWNER = 'hubly_brain';

const WORKSPACE_STORE = new Map();

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}
function getPath(obj, path) {
  const parts = path.split('.').filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}
function setPath(obj, path, value) {
  const parts = path.split('.').filter(Boolean);
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== 'object' || Array.isArray(cur[p])) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}
function valuesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function defaultImportance(path) {
  if (/sidebarOrder|defaultLanding|hiddenModules|hiddenTools|pinnedActions|dashboardLayout/.test(path)) {
    return 'high';
  }
  if (/favoritePages|workingStyle/.test(path)) return 'medium';
  if (/aiSuggestions|tips|notes/.test(path)) return 'low';
  return 'medium';
}
function asStringArray(v) {
  if (!Array.isArray(v)) return null;
  const out = v.map((x) => String(x || '').trim()).filter(Boolean);
  return out.length ? out : null;
}

function ensureShape(w) {
  w.sidebarOrder = w.sidebarOrder ?? ['jobs', 'customers', 'calendar', 'website', 'marketing'];
  w.dashboardLayout = w.dashboardLayout ?? ['today', 'pipeline', 'revenue'];
  w.hiddenModules = w.hiddenModules ?? [];
  w.hiddenTools = w.hiddenTools ?? w.hiddenModules;
  w.favoritePages = w.favoritePages ?? [];
  w.pinnedActions = w.pinnedActions ?? [];
  w.workingStyle = w.workingStyle ?? {
    defaultLanding: 'jobs',
    density: 'comfortable',
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
  if (w.hiddenModules?.length && (!w.hiddenTools || !w.hiddenTools.length)) {
    w.hiddenTools = [...w.hiddenModules];
  }
  if (w.hiddenTools?.length && (!w.hiddenModules || !w.hiddenModules.length)) {
    w.hiddenModules = [...w.hiddenTools];
  }
  return w;
}

export function normalizeWorkspaceMemory(input) {
  const i = input || {};
  const hidden = asStringArray(i.hiddenModules) || asStringArray(i.hiddenTools);
  return ensureShape({
    version: HUBLY_WORKSPACE_MEMORY_VERSION,
    memoryVersion: typeof i.memoryVersion === 'number' ? i.memoryVersion : 0,
    sidebarOrder: asStringArray(i.sidebarOrder),
    dashboardLayout: asStringArray(i.dashboardLayout),
    hiddenModules: hidden,
    hiddenTools: hidden,
    favoritePages: asStringArray(i.favoritePages),
    pinnedActions: asStringArray(i.pinnedActions),
    workingStyle: i.workingStyle && typeof i.workingStyle === 'object' ? { ...i.workingStyle } : null,
    aiSuggestions: Array.isArray(i.aiSuggestions) ? deepClone(i.aiSuggestions) : null,
    navigation: i.navigation && typeof i.navigation === 'object' ? { ...i.navigation } : null,
    history: Array.isArray(i.history) ? i.history.slice(-40) : null,
    preferences: i.preferences && typeof i.preferences === 'object' ? { ...i.preferences } : null,
    changelog: Array.isArray(i.changelog) ? deepClone(i.changelog) : null,
    versionHistory: Array.isArray(i.versionHistory) ? deepClone(i.versionHistory) : null,
    factMeta: i.factMeta && typeof i.factMeta === 'object' ? { ...i.factMeta } : null,
    updatedAt: i.updatedAt ? String(i.updatedAt) : new Date().toISOString(),
  });
}

export function suggestWorkspaceUpdate(suggestion) {
  if (!suggestion?.path) throw new Error('Workspace suggestion requires path');
  if (!suggestion.expertId) throw new Error('Workspace suggestion requires expertId');
  return {
    ...suggestion,
    importance: suggestion.importance || defaultImportance(suggestion.path),
    confidence: typeof suggestion.confidence === 'number' ? suggestion.confidence : 80,
    source: suggestion.source || 'ai_inference',
  };
}

export function commitWorkspaceUpdates(base, suggestions, opts = {}) {
  const workspace = normalizeWorkspaceMemory(base);
  const at = opts.at || new Date().toISOString();
  const changes = [];
  for (const raw of suggestions) {
    const s = suggestWorkspaceUpdate(raw);
    const previous = getPath(workspace, s.path);
    if (valuesEqual(previous, s.value)) continue;
    setPath(workspace, s.path, s.value);
    if (s.path === 'hiddenModules') setPath(workspace, 'hiddenTools', s.value);
    if (s.path === 'hiddenTools') setPath(workspace, 'hiddenModules', s.value);
    workspace.memoryVersion = (workspace.memoryVersion || 0) + 1;
    const change = {
      id: newId('wschg'),
      at,
      path: s.path,
      previous: previous === undefined ? null : deepClone(previous),
      next: deepClone(s.value),
      reason: s.reason,
      expertId: s.expertId,
      importance: s.importance || defaultImportance(s.path),
      confidence: s.confidence ?? 80,
      source: s.source || 'ai_inference',
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
      { at, action: 'commit', detail: `${s.path}: ${s.reason}` },
    ].slice(-40);
  }
  if (changes.length) {
    workspace.versionHistory = [
      ...(workspace.versionHistory || []),
      {
        version: workspace.memoryVersion,
        at,
        summary: opts.summary || changes.map((c) => `${c.path}: ${c.reason}`).join('; ').slice(0, 400),
      },
    ].slice(-200);
  }
  workspace.updatedAt = at;
  return { workspace: ensureShape(workspace), changes, committedBy: WORKSPACE_MEMORY_OWNER };
}

export function extractWorkspaceSuggestionsFromRequest(request, current) {
  const text = String(request || '').trim();
  const lower = text.toLowerCase();
  const out = [];
  const expertId = WORKSPACE_MEMORY_OWNER;
  const cur = normalizeWorkspaceMemory(current);

  const above = lower.match(
    /(?:put|move|place)\s+([a-z0-9 _-]+?)\s+above\s+([a-z0-9 _-]+?)(?:\s+in\s+the\s+sidebar)?[.!]?$/i,
  );
  if (above && !/dashboard/i.test(text)) {
    const a = above[1].trim().replace(/\s+/g, '_');
    const b = above[2].trim().replace(/\s+/g, '_');
    const order = [...(cur.sidebarOrder || [])];
    if (!order.includes(a)) order.push(a);
    if (!order.includes(b)) order.push(b);
    const ia = order.indexOf(a);
    order.splice(ia, 1);
    const newIb = order.indexOf(b);
    order.splice(newIb, 0, a);
    out.push(suggestWorkspaceUpdate({
      path: 'sidebarOrder', value: order,
      reason: `Owner asked to put ${a} above ${b} in the sidebar`,
      expertId, importance: 'high', confidence: 94, source: 'user',
    }));
  }

  const hide = lower.match(/hide\s+(?:the\s+)?([a-z0-9 _-]+?)(?:\s+tools?|\s+module|\s+page)?(?:\s+for now)?[.!]?$/i);
  if (hide || /hide\s+marketing/i.test(text)) {
    const rawName = hide?.[1] || 'marketing';
    const name = rawName.replace(/\s+/g, '_').replace(/_?tools?$/, '').replace(/_?module$/, '');
    const next = [...new Set([...(cur.hiddenModules || []), name])];
    out.push(suggestWorkspaceUpdate({
      path: 'hiddenModules', value: next,
      reason: `Owner asked to hide ${name}`,
      expertId, importance: 'high', confidence: 93, source: 'user',
    }));
  }

  const pin = lower.match(/pin\s+(?:the\s+)?(.+?)[.!]?$/i);
  if (pin) {
    const action = pin[1].trim().replace(/\s+/g, '_');
    const next = [...new Set([...(cur.pinnedActions || []), action])];
    out.push(suggestWorkspaceUpdate({
      path: 'pinnedActions', value: next,
      reason: `Owner pinned ${action}`,
      expertId, importance: 'high', confidence: 92, source: 'user',
    }));
  }

  const fav = lower.match(/(?:favorite|favourite|star)\s+(?:the\s+)?([a-z0-9 _-]+?)(?:\s+page)?[.!]?$/i);
  if (fav) {
    const page = fav[1].trim().replace(/\s+/g, '_');
    const next = [...new Set([...(cur.favoritePages || []), page])];
    out.push(suggestWorkspaceUpdate({
      path: 'favoritePages', value: next,
      reason: `Owner favorited ${page}`,
      expertId, importance: 'medium', confidence: 90, source: 'user',
    }));
  }

  const dash = lower.match(
    /(?:put|move|show)\s+([a-z0-9 _-]+?)\s+above\s+([a-z0-9 _-]+?)(?:\s+on\s+the\s+dashboard)?[.!]?$/i,
  );
  if (dash && /dashboard/i.test(text)) {
    const a = dash[1].trim().replace(/\s+/g, '_');
    const b = dash[2].trim().replace(/\s+/g, '_');
    const order = [...(cur.dashboardLayout || [])];
    if (!order.includes(a)) order.push(a);
    if (!order.includes(b)) order.push(b);
    const ia = order.indexOf(a);
    order.splice(ia, 1);
    const newIb = order.indexOf(b);
    order.splice(newIb, 0, a);
    out.push(suggestWorkspaceUpdate({
      path: 'dashboardLayout', value: order,
      reason: `Owner asked to show ${a} above ${b} on the dashboard`,
      expertId, importance: 'high', confidence: 91, source: 'user',
    }));
  }

  return out;
}

export function commitWorkspaceAiSuggestion(base, entry) {
  const workspace = normalizeWorkspaceMemory(base);
  const at = entry.at || new Date().toISOString();
  const full = {
    id: newId('wsai'),
    at,
    suggestion: entry.suggestion,
    status: entry.status,
    reason: entry.reason,
    expertId: entry.expertId,
    confidence: entry.confidence,
  };
  return commitWorkspaceUpdates(workspace, [
    suggestWorkspaceUpdate({
      path: 'aiSuggestions',
      value: [...(workspace.aiSuggestions || []), full],
      reason: `Workspace AI suggestion ${entry.status}: ${entry.suggestion}`.slice(0, 200),
      expertId: entry.expertId,
      importance: 'low',
      confidence: entry.confidence,
      source: 'ai_inference',
    }),
  ], { at, summary: `AI workspace suggestion ${entry.status}` });
}

export function isWorkspaceRetrievalQuestion(request) {
  const r = String(request || '').toLowerCase();
  return /what does my workspace|my workspace look|sidebar order|why did we hide|pinned actions|favorite pages|how do i like to work|workspace preferences|what'?s hidden/.test(r);
}

export function queryWorkspaceMemory(input, question) {
  const w = normalizeWorkspaceMemory(input);
  const q = String(question || '').toLowerCase();

  if (/what does my workspace|my workspace look|how do i like to work|workspace preferences/.test(q)) {
    return {
      answer:
        `Your workspace: sidebar ${(w.sidebarOrder || []).join(' → ')}. ` +
        `Dashboard ${(w.dashboardLayout || []).join(' → ')}. ` +
        `Hidden: ${(w.hiddenModules || []).join(', ') || 'nothing'}. ` +
        `Pinned: ${(w.pinnedActions || []).join(', ') || 'none'}. ` +
        `Favorites: ${(w.favoritePages || []).join(', ') || 'none'}. ` +
        `Default landing: ${w.workingStyle?.defaultLanding || 'jobs'}.`,
      fromWorkspaceMemory: true,
      usedChatHistory: false,
      paths: ['sidebarOrder', 'dashboardLayout', 'hiddenModules', 'pinnedActions', 'favoritePages', 'workingStyle'],
      confidence: 92,
    };
  }

  if (/why did we hide|what'?s hidden|hidden tools|hidden modules/.test(q)) {
    const hideChanges = (w.changelog || []).filter((c) =>
      c.path === 'hiddenModules' || c.path === 'hiddenTools'
    );
    const latest = hideChanges[hideChanges.length - 1];
    const hidden = w.hiddenModules || [];
    return {
      answer:
        `Hidden tools: ${hidden.join(', ') || 'none'}. ` +
        (latest
          ? `We hid them because: ${latest.reason} (${latest.at}, ${latest.expertId}).`
          : 'No hide-reasoning stored yet.'),
      fromWorkspaceMemory: true,
      usedChatHistory: false,
      paths: ['hiddenModules', 'changelog'],
      changes: hideChanges.slice(-5),
      confidence: 93,
    };
  }

  if (/sidebar/.test(q)) {
    return {
      answer: `Sidebar order: ${(w.sidebarOrder || []).join(' → ')}.`,
      fromWorkspaceMemory: true,
      usedChatHistory: false,
      paths: ['sidebarOrder'],
      confidence: 90,
    };
  }

  return {
    answer: 'I checked Workspace Memory — ask about sidebar, dashboard, hidden tools, pins, or favorites.',
    fromWorkspaceMemory: true,
    usedChatHistory: false,
    paths: [],
    confidence: 50,
  };
}

export function persistWorkspaceMemoryLocal(businessId, workspace) {
  const normalized = normalizeWorkspaceMemory(workspace);
  WORKSPACE_STORE.set(String(businessId), deepClone(normalized));
  return deepClone(normalized);
}

export function loadWorkspaceMemoryLocal(businessId) {
  const m = WORKSPACE_STORE.get(String(businessId));
  return m ? deepClone(m) : null;
}

export function clearWorkspaceMemoryStoreForTests() {
  WORKSPACE_STORE.clear();
}

export function brainApplyWorkspaceMessage(workspace, request, businessId) {
  const suggestions = extractWorkspaceSuggestionsFromRequest(request, workspace);
  const result = suggestions.length
    ? commitWorkspaceUpdates(workspace, suggestions, { summary: `Owner workspace: ${String(request).slice(0, 120)}` })
    : { workspace: normalizeWorkspaceMemory(workspace), changes: [], committedBy: WORKSPACE_MEMORY_OWNER };
  if (businessId) persistWorkspaceMemoryLocal(businessId, result.workspace);
  return result;
}
