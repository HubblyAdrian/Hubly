/**
 * Lead pipeline stage destinations.
 * Persisted on businesses.meta.pipeline.stageDefs so the app (and any
 * backend reader of meta) knows where a custom stage should send leads.
 *
 * Roles:
 *   open  — stays on the Leads board
 *   quote — quote / proposal column (default landing for Quick Quote leads)
 *   won   — drop here → Jobs & Calendar (convertsToJobs)
 *   lost  — closed lost (optional lost reason)
 */

export const LEAD_STAGE_ROLES = Object.freeze(['open', 'quote', 'won', 'lost']);

export const DEFAULT_LEAD_STAGE_DEFS = Object.freeze([
  { id: 'new', label: 'New', tone: 'purple', role: 'open' },
  { id: 'quote_sent', label: 'Quote Sent', tone: 'orange', role: 'quote' },
  { id: 'won', label: 'Won → Jobs', tone: 'green', role: 'won' },
  { id: 'lost', label: 'Lost', tone: 'red', role: 'lost' },
]);

export function inferLeadStageRole(stage = {}) {
  const role = String(stage.role || '').trim().toLowerCase();
  if (LEAD_STAGE_ROLES.includes(role)) return role;
  if (stage.convertsToJobs || stage.id === 'won') return 'won';
  if (stage.isLost || stage.id === 'lost' || /lost/i.test(String(stage.label || ''))) return 'lost';
  if (stage.id === 'quote_sent' || /quote/i.test(String(stage.label || ''))) return 'quote';
  return 'open';
}

export function normalizeLeadStageDef(stage = {}, opts = {}) {
  const id = String(stage.id || '').trim() || opts.fallbackId || 'stage';
  const label = String(stage.label || 'Stage').trim() || 'Stage';
  const tone = stage.tone || 'purple';
  const role = inferLeadStageRole({ ...stage, id, label });
  return {
    id,
    label,
    tone,
    role,
    convertsToJobs: role === 'won',
    isLost: role === 'lost',
  };
}

export function slugifyLeadStageId(label, existingIds = []) {
  const base =
    String(label || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 24) || 'stage';
  let id = base;
  let n = 2;
  const taken = new Set((existingIds || []).map(String));
  while (taken.has(id)) {
    id = `${base}_${n}`;
    n += 1;
  }
  return id;
}

/**
 * Normalize a full stageDefs list: unique won/lost, always keep one won route.
 */
export function normalizeLeadStageDefs(stageDefs) {
  const list = Array.isArray(stageDefs) && stageDefs.length
    ? stageDefs.map((s, i) => normalizeLeadStageDef(s, { fallbackId: `stage_${i + 1}` }))
    : DEFAULT_LEAD_STAGE_DEFS.map((s) => normalizeLeadStageDef(s));

  let seenWon = false;
  let seenLost = false;
  const out = list.map((s) => {
    if (s.role === 'won') {
      if (seenWon) return { ...s, role: 'open', convertsToJobs: false, isLost: false };
      seenWon = true;
      return s;
    }
    if (s.role === 'lost') {
      if (seenLost) return { ...s, role: 'open', convertsToJobs: false, isLost: false };
      seenLost = true;
      return s;
    }
    return s;
  });

  if (!out.some((s) => s.role === 'won')) {
    const won = normalizeLeadStageDef({
      id: 'won',
      label: 'Won → Jobs',
      tone: 'green',
      role: 'won',
    });
    const lostIdx = out.findIndex((s) => s.role === 'lost');
    if (lostIdx >= 0) out.splice(lostIdx, 0, won);
    else out.push(won);
  }

  return out;
}

/** Where the system should send a lead dropped on this stage. */
export function leadStageDropRoute(stageId, stageDefs) {
  const stages = normalizeLeadStageDefs(stageDefs);
  const st = stages.find((s) => s.id === stageId);
  if (!st) return { action: 'unknown', stageId };
  if (st.role === 'won' || st.convertsToJobs) {
    return { action: 'convert_to_jobs', stageId: st.id, role: 'won' };
  }
  if (st.role === 'lost' || st.isLost) {
    return { action: 'mark_lost', stageId: st.id, role: 'lost' };
  }
  return { action: 'move_stage', stageId: st.id, role: st.role || 'open' };
}

export function applyLeadStageRole(stageDefs, stageId, role) {
  const nextRole = LEAD_STAGE_ROLES.includes(role) ? role : 'open';
  return normalizeLeadStageDefs(
    (stageDefs || []).map((s) => {
      if (s.id !== stageId) {
        if (nextRole === 'won' && (s.role === 'won' || s.convertsToJobs)) {
          return { ...s, role: 'open', convertsToJobs: false };
        }
        if (nextRole === 'lost' && (s.role === 'lost' || s.isLost || s.id === 'lost')) {
          return { ...s, role: 'open', isLost: false };
        }
        return s;
      }
      return { ...s, role: nextRole, convertsToJobs: nextRole === 'won', isLost: nextRole === 'lost' };
    })
  );
}
