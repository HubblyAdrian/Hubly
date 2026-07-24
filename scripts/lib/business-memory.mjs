/**
 * Node mirror of hubly_brain_memory.ts — Section 5 behavioral proofs.
 */
export const HUBLY_BUSINESS_MEMORY_VERSION = 2;
export const BUSINESS_MEMORY_OWNER = 'hubly_brain';

const MEMORY_STORE = new Map();

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
  if (/business\.name|owner\.name|name$/.test(path)) return 'critical';
  if (/industry|positioning|targetAudience|businessStage|goals/.test(path)) return 'high';
  if (/website|packages|hero|brand\.|strategy/.test(path)) return 'medium';
  if (/holiday|promo|temporary|notes/.test(path)) return 'low';
  return 'medium';
}

function ensureNested(m) {
  m.owner = m.owner || { name: m.ownerName || null, preferredName: null, role: null, preferredCommunicationStyle: null };
  m.business = m.business || {
    name: m.name || null,
    industry: m.industry || null,
    serviceArea: m.serviceArea || m.city || null,
    description: null,
    yearsInBusiness: null,
    businessGoals: Array.isArray(m.goals) ? m.goals : m.goals ? [String(m.goals)] : null,
    businessStage: m.businessStage || null,
  };
  m.brand = m.brand || {
    personality: null,
    tone: typeof m.brandVoice === 'string' ? m.brandVoice : null,
    positioning: null,
    targetAudience: null,
    visualDirection: null,
    preferredCreativeDirection: null,
  };
  m.servicesBlock = m.servicesBlock || {
    current: (m.services || []).map((s) => (typeof s === 'string' ? s : s.name)).filter(Boolean),
    removed: [],
    planned: [],
    recommended: [],
  };
  m.websiteHistory = m.websiteHistory || {
    versions: [],
    currentHeroHeadline: m.currentWebsite?.headline || null,
    currentPackages: null,
    bookingFlow: null,
    approvedAiChanges: [],
    rejectedAiChanges: [],
  };
  m.strategyHistory = m.strategyHistory || [];
  m.goalsBlock = m.goalsBlock || { business: [], revenue: [], growth: [], personal: [], futurePlans: [] };
  m.aiHistory = m.aiHistory || [];
  m.connectedServices = m.connectedServices || {
    stripe: null,
    googleCalendar: null,
    googleBusinessProfile: null,
    website: null,
    marketplace: null,
    crm: null,
    integrations: [],
  };
  m.changelog = m.changelog || [];
  m.versionHistory = m.versionHistory || [];
  m.factMeta = m.factMeta || {};
  if (m.business?.name) m.name = m.business.name;
  if (m.business?.industry) m.industry = m.business.industry;
  if (m.business?.businessStage) m.businessStage = m.business.businessStage;
  if (m.owner?.name) m.ownerName = m.owner.name;
  return m;
}

export function normalizeBusinessMemory(input) {
  const raw = input && typeof input === 'object' ? input : {};
  const memory = {
    version: HUBLY_BUSINESS_MEMORY_VERSION,
    memoryVersion: typeof raw.memoryVersion === 'number' ? raw.memoryVersion : 0,
    owner: raw.owner ? { ...raw.owner } : null,
    business: raw.business ? { ...raw.business } : null,
    brand: raw.brand ? { ...raw.brand } : null,
    servicesBlock: raw.servicesBlock ? { ...raw.servicesBlock } : null,
    websiteHistory: raw.websiteHistory ? deepClone(raw.websiteHistory) : null,
    strategyHistory: Array.isArray(raw.strategyHistory) ? deepClone(raw.strategyHistory) : null,
    goalsBlock: raw.goalsBlock ? { ...raw.goalsBlock } : null,
    aiHistory: Array.isArray(raw.aiHistory) ? deepClone(raw.aiHistory) : null,
    connectedServices: raw.connectedServices ? { ...raw.connectedServices } : null,
    changelog: Array.isArray(raw.changelog) ? deepClone(raw.changelog) : null,
    versionHistory: Array.isArray(raw.versionHistory) ? deepClone(raw.versionHistory) : null,
    factMeta: raw.factMeta ? { ...raw.factMeta } : null,
    name: raw.name || null,
    industry: raw.industry || null,
    services: raw.services || null,
    brandVoice: raw.brandVoice || null,
    goals: raw.goals || null,
    currentWebsite: raw.currentWebsite || null,
    businessStage: raw.businessStage || null,
    ownerName: raw.ownerName || null,
    city: raw.city || null,
    previousConversations: raw.previousConversations || null,
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
  return ensureNested(memory);
}

export function suggestMemoryUpdate(suggestion) {
  if (!suggestion?.path) throw new Error('Memory suggestion requires path');
  if (!suggestion.expertId) throw new Error('Memory suggestion requires expertId');
  return {
    ...suggestion,
    importance: suggestion.importance || defaultImportance(suggestion.path),
    confidence: typeof suggestion.confidence === 'number' ? suggestion.confidence : 80,
    source: suggestion.source || 'ai_inference',
  };
}

export function commitMemoryUpdates(base, suggestions, opts = {}) {
  const memory = normalizeBusinessMemory(base);
  const at = opts.at || new Date().toISOString();
  const changes = [];
  for (const raw of suggestions) {
    const s = suggestMemoryUpdate(raw);
    const previous = getPath(memory, s.path);
    if (valuesEqual(previous, s.value)) continue;
    setPath(memory, s.path, s.value);
    memory.memoryVersion = (memory.memoryVersion || 0) + 1;
    const change = {
      id: newId('memchg'),
      at,
      path: s.path,
      previous: previous === undefined ? null : deepClone(previous),
      next: deepClone(s.value),
      reason: s.reason,
      expertId: s.expertId,
      importance: s.importance || defaultImportance(s.path),
      confidence: s.confidence ?? 80,
      source: s.source || 'ai_inference',
      memoryVersion: memory.memoryVersion,
    };
    changes.push(change);
    memory.changelog = [...(memory.changelog || []), change].slice(-500);
    memory.factMeta = {
      ...(memory.factMeta || {}),
      [s.path]: {
        importance: change.importance,
        confidence: change.confidence,
        source: change.source,
        lastVerified: at,
      },
    };
  }
  if (changes.length) {
    memory.versionHistory = [
      ...(memory.versionHistory || []),
      {
        version: memory.memoryVersion,
        at,
        summary: opts.summary || changes.map((c) => `${c.path}: ${c.reason}`).join('; ').slice(0, 400),
      },
    ].slice(-200);
  }
  memory.updatedAt = at;
  ensureNested(memory);
  return { memory, changes, committedBy: BUSINESS_MEMORY_OWNER };
}

export function extractMemorySuggestionsFromRequest(request) {
  const text = String(request || '').trim();
  const lower = text.toLowerCase();
  const out = [];
  const expertId = BUSINESS_MEMORY_OWNER;

  if (/starting\s+a\s+.+?(?:business|company)/i.test(text) || /i'?m\s+starting/i.test(text)) {
    let industry = 'local service';
    if (/pressure\s*wash/i.test(text)) industry = 'pressure washing';
    else {
      const m = text.match(/starting\s+a\s+(.+?)\s+(?:business|company)/i);
      if (m) industry = m[1].replace(/\b(business|company)\b/gi, '').trim();
    }
    out.push(suggestMemoryUpdate({
      path: 'business.industry', value: industry,
      reason: 'Owner stated they are starting this kind of business',
      expertId, importance: 'critical', confidence: 95, source: 'user',
    }));
    out.push(suggestMemoryUpdate({
      path: 'business.businessStage', value: 'starting',
      reason: 'Owner is starting a new business',
      expertId, importance: 'high', confidence: 92, source: 'user',
    }));
    out.push(suggestMemoryUpdate({
      path: 'business.description', value: text,
      reason: 'Owner described the business they are building',
      expertId, importance: 'high', confidence: 90, source: 'user',
    }));
    out.push(suggestMemoryUpdate({
      path: 'brand.positioning',
      value: `Local ${industry} business building trust with clear packages and proof`,
      reason: 'Initial positioning inferred from starting a new local service business',
      expertId, importance: 'high', confidence: 70, source: 'ai_inference',
    }));
    out.push(suggestMemoryUpdate({
      path: 'brand.targetAudience', value: 'local residential customers',
      reason: 'Default audience for a new local service until owner narrows it',
      expertId, importance: 'high', confidence: 65, source: 'ai_inference',
    }));
  }

  if (/focus on commercial|commercial properties|commercial clients|b2b/i.test(text)) {
    out.push(suggestMemoryUpdate({
      path: 'brand.targetAudience', value: 'commercial properties',
      reason: 'Owner asked to focus on commercial properties',
      expertId, importance: 'high', confidence: 94, source: 'user',
    }));
    out.push(suggestMemoryUpdate({
      path: 'brand.positioning',
      value: 'Commercial-first pressure washing for property managers and businesses',
      reason: 'Positioning updated because owner shifted focus to commercial properties',
      expertId, importance: 'high', confidence: 88, source: 'user',
    }));
    out.push(suggestMemoryUpdate({
      path: 'business.description',
      value: 'Pressure washing business focused on commercial properties',
      reason: 'Business description updated after commercial focus',
      expertId, importance: 'high', confidence: 90, source: 'user',
    }));
  }

  if (/stop offering|no longer offer|don'?t offer/i.test(text)) {
    const m = text.match(/(?:stop offering|no longer offer|don'?t offer)\s+(.+?)[.!]?$/i);
    const service = (m?.[1] || 'that service').trim();
    out.push(suggestMemoryUpdate({
      path: 'servicesBlock.removed', value: [service],
      reason: `Owner asked to stop offering ${service}`,
      expertId, importance: 'high', confidence: 93, source: 'user',
    }));
  }

  if (/don'?t like luxury|no luxury|not luxury/i.test(text)) {
    out.push(suggestMemoryUpdate({
      path: 'brand.preferredCreativeDirection',
      value: 'practical and trustworthy — not luxury',
      reason: 'Owner rejected luxury branding',
      expertId, importance: 'high', confidence: 95, source: 'user',
    }));
  }

  const inCity = text.match(/\bin\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})\.?$/);
  if (inCity) {
    const city = inCity[1].trim();
    out.push(suggestMemoryUpdate({
      path: 'city', value: city,
      reason: `Owner named their city: ${city}`,
      expertId, importance: 'high', confidence: 92, source: 'user',
    }));
    out.push(suggestMemoryUpdate({
      path: 'serviceArea', value: city,
      reason: `Service area inferred from city: ${city}`,
      expertId, importance: 'high', confidence: 88, source: 'user',
    }));
  }

  if (/apartment complex|target customers are/i.test(text)) {
    out.push(suggestMemoryUpdate({
      path: 'brand.targetAudience',
      value: /apartment/i.test(text) ? 'apartment complexes' : 'stated target customers',
      reason: 'Owner stated target customers',
      expertId, importance: 'high', confidence: 96, source: 'user',
    }));
  }

  return out;
}

export function commitStrategyVersion(base, strategy) {
  const memory = normalizeBusinessMemory(base);
  const at = strategy.at || new Date().toISOString();
  const version = (memory.strategyHistory?.length || 0) + 1;
  const entry = {
    version,
    at,
    positioning: strategy.positioning ?? null,
    homepageStrategy: strategy.homepageStrategy ?? null,
    pricingStrategy: strategy.pricingStrategy ?? null,
    bookingStrategy: strategy.bookingStrategy ?? null,
    growthStrategy: strategy.growthStrategy ?? null,
    reason: strategy.reason ?? 'Strategy recommendation',
    expertId: strategy.expertId || 'strategy',
    confidence: strategy.confidence ?? 80,
  };
  const suggestions = [
    suggestMemoryUpdate({
      path: 'strategyHistory',
      value: [...(memory.strategyHistory || []), entry],
      reason: entry.reason,
      expertId: entry.expertId,
      importance: 'high',
      confidence: entry.confidence,
      source: 'ai_inference',
    }),
  ];
  if (entry.positioning) {
    suggestions.push(suggestMemoryUpdate({
      path: 'brand.positioning',
      value: entry.positioning,
      reason: entry.reason,
      expertId: entry.expertId,
      importance: 'high',
      confidence: entry.confidence,
      source: 'ai_inference',
    }));
  }
  return commitMemoryUpdates(memory, suggestions, { at, summary: `Strategy v${version}` });
}

export function commitAiHistoryEntry(base, entry) {
  const memory = normalizeBusinessMemory(base);
  const at = entry.at || new Date().toISOString();
  const full = {
    id: newId('aihist'),
    at,
    recommendation: entry.recommendation,
    status: entry.status,
    reasoning: entry.reasoning,
    confidence: entry.confidence,
    expertId: entry.expertId,
    edits: entry.edits ?? null,
  };
  const suggestions = [
    suggestMemoryUpdate({
      path: 'aiHistory',
      value: [...(memory.aiHistory || []), full],
      reason: `AI ${entry.status}: ${entry.recommendation}`.slice(0, 200),
      expertId: entry.expertId,
      importance: 'medium',
      confidence: entry.confidence,
      source: 'ai_inference',
    }),
  ];
  if (entry.status === 'approved') {
    suggestions.push(suggestMemoryUpdate({
      path: 'websiteHistory.approvedAiChanges',
      value: [
        ...(memory.websiteHistory?.approvedAiChanges || []),
        { at, change: entry.recommendation, reason: entry.reasoning, expertId: entry.expertId },
      ],
      reason: 'Approved AI change',
      expertId: entry.expertId,
      importance: 'high',
      confidence: entry.confidence,
      source: 'user',
    }));
  }
  if (entry.status === 'rejected') {
    suggestions.push(suggestMemoryUpdate({
      path: 'websiteHistory.rejectedAiChanges',
      value: [
        ...(memory.websiteHistory?.rejectedAiChanges || []),
        { at, change: entry.recommendation, reason: entry.reasoning, expertId: entry.expertId },
      ],
      reason: 'Rejected AI change',
      expertId: entry.expertId,
      importance: 'high',
      confidence: entry.confidence,
      source: 'user',
    }));
  }
  return commitMemoryUpdates(memory, suggestions, { at, summary: `AI history ${entry.status}` });
}

export function isMemoryRetrievalQuestion(request) {
  const r = String(request || '').toLowerCase();
  return /what kind of business|what changed|why did we (change|remove)|branding direction|what (services|goals)|working toward|approved branding|our positioning/.test(r);
}

export function queryBusinessMemory(memoryInput, question) {
  const m = normalizeBusinessMemory(memoryInput);
  const q = String(question || '').toLowerCase();

  if (/what kind of business|what business are we building/.test(q)) {
    return {
      answer:
        `We're building a ${m.business?.industry || 'business'} business (${m.business?.businessStage || 'early'}). ` +
        `Target audience: ${m.brand?.targetAudience || 'n/a'}. Positioning: ${m.brand?.positioning || 'n/a'}.`,
      fromMemory: true,
      usedChatHistory: false,
      paths: ['business.industry', 'brand.targetAudience', 'brand.positioning'],
      confidence: 90,
    };
  }

  if (/why did we change (our )?positioning|why.*positioning/.test(q)) {
    const posChanges = (m.changelog || []).filter((c) => c.path === 'brand.positioning');
    const latest = posChanges[posChanges.length - 1];
    if (!latest) {
      return {
        answer: "I don't have a stored positioning change yet in Business Memory.",
        fromMemory: true, usedChatHistory: false, paths: ['changelog'], confidence: 40,
      };
    }
    return {
      answer:
        `We changed positioning because: ${latest.reason}. ` +
        `Previous: ${JSON.stringify(latest.previous)}. Now: ${JSON.stringify(latest.next)}. ` +
        `(Recorded ${latest.at}, suggested by ${latest.expertId}, committed by Hubly Brain.)`,
      fromMemory: true,
      usedChatHistory: false,
      paths: ['brand.positioning', 'changelog'],
      changes: posChanges,
      confidence: 92,
    };
  }

  if (/what changed (this week|last month|recently)|show me what changed/.test(q)) {
    const recent = m.changelog || [];
    const lines = recent.slice(-12).map((c) =>
      `• ${c.path}: ${c.reason} (${c.at.slice(0, 10)}, ${c.expertId}, ${c.importance})`
    );
    return {
      answer: recent.length
        ? `Here's what changed in Business Memory:\n${lines.join('\n')}`
        : 'No Business Memory updates in that window yet.',
      fromMemory: true,
      usedChatHistory: false,
      paths: ['changelog'],
      changes: recent,
      confidence: 93,
    };
  }

  if (/branding direction|approved/.test(q)) {
    const approved = m.websiteHistory?.approvedAiChanges || [];
    return {
      answer:
        `Approved branding direction: tone=${m.brand?.tone || 'n/a'}, ` +
        `creative=${m.brand?.preferredCreativeDirection || 'n/a'}, ` +
        `positioning=${m.brand?.positioning || 'n/a'}. ` +
        `Approved AI changes: ${approved.length ? approved.map((a) => a.change).join('; ') : 'none yet'}.`,
      fromMemory: true,
      usedChatHistory: false,
      paths: ['brand', 'websiteHistory.approvedAiChanges'],
      confidence: 88,
    };
  }

  if (/goals|working toward/.test(q)) {
    const g = m.goalsBlock;
    return {
      answer:
        `Business goals: ${(g?.business || []).join('; ') || 'not set'}. ` +
        `Revenue: ${(g?.revenue || []).join('; ') || 'not set'}.`,
      fromMemory: true,
      usedChatHistory: false,
      paths: ['goalsBlock'],
      confidence: 87,
    };
  }

  return {
    answer: 'I checked Business Memory but need a more specific question.',
    fromMemory: true,
    usedChatHistory: false,
    paths: [],
    confidence: 50,
  };
}

export function persistBusinessMemoryLocal(businessId, memory) {
  const normalized = normalizeBusinessMemory(memory);
  MEMORY_STORE.set(String(businessId), deepClone(normalized));
  return deepClone(normalized);
}

export function loadBusinessMemoryLocal(businessId) {
  const m = MEMORY_STORE.get(String(businessId));
  return m ? deepClone(m) : null;
}

export function clearBusinessMemoryStoreForTests() {
  MEMORY_STORE.clear();
}

/** Apply owner message through Brain commit path (no experts write). */
export function brainApplyOwnerMessage(memory, request, businessId) {
  const suggestions = extractMemorySuggestionsFromRequest(request);
  const result = suggestions.length
    ? commitMemoryUpdates(memory, suggestions, { summary: `Owner: ${String(request).slice(0, 120)}` })
    : { memory: normalizeBusinessMemory(memory), changes: [], committedBy: BUSINESS_MEMORY_OWNER };
  if (businessId) persistBusinessMemoryLocal(businessId, result.memory);
  return result;
}
