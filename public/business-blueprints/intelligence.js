/**
 * Hubly Blueprint Intelligence — Living Blueprints moat
 *
 * Knowledge compounds:
 *   Official → AI Generated → Owner edits → Bookings/Reviews/Revenue
 *   → Blueprint improves → Community Learned → Hubly Optimized → Official
 *
 * Example: if enough electricians remove "Generator Repair", future
 * electrical blueprints stop including it automatically.
 */
(function (global) {
  /** Seeded community lessons (demo + cold-start until live signals accumulate). */
  const SEED_SIGNALS = {
    electrical: [
      { type: 'service_removed', key: 'Generator Repair', hits: 200, note: 'Community rarely offers generator repair on homepage' },
      { type: 'service_removed', key: 'Commercial High Voltage', hits: 80, note: 'Most Hubly electricians are residential / light commercial' },
    ],
    plumbing: [
      { type: 'service_removed', key: 'Pipe Relining', hits: 120, note: 'Specialist service — rarely a starter homepage offer' },
      { type: 'cta_changed', key: 'Call for leaks', hits: 90, note: 'Leak urgency CTA outperforms generic Book' },
    ],
    painting: [
      { type: 'service_removed', key: 'Industrial Coatings', hits: 60, note: 'Home painters rarely lead with industrial' },
    ],
    junk_removal: [
      { type: 'service_removed', key: 'Hazardous Waste', hits: 150, note: 'Liability — keep off default homepage catalog' },
    ],
  };

  const SUPPRESS_THRESHOLD = 50; // hits before future blueprints drop a service

  function loadLocal() {
    try {
      return JSON.parse(localStorage.getItem('hubly_blueprint_signals') || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function saveLocal(map) {
    try {
      localStorage.setItem('hubly_blueprint_signals', JSON.stringify(map));
    } catch (e) {}
  }

  function recordLocal(industry, signalType, signalKey, meta) {
    const ind = String(industry || '').toLowerCase().replace(/\s+/g, '_');
    const key = String(signalKey || '').trim();
    if (!ind || !key) return null;
    const map = loadLocal();
    map[ind] = map[ind] || {};
    const id = signalType + '::' + key.toLowerCase();
    const prev = map[ind][id] || { type: signalType, key, hits: 0, meta: {} };
    prev.hits += 1;
    prev.meta = Object.assign({}, prev.meta, meta || {}, { lastAt: new Date().toISOString() });
    map[ind][id] = prev;
    saveLocal(map);
    return prev;
  }

  function signalsFor(industry) {
    const ind = String(industry || '').toLowerCase().replace(/\s+/g, '_');
    const out = [];
    (SEED_SIGNALS[ind] || []).forEach((s) => {
      out.push({
        type: s.type,
        key: s.key,
        hits: s.hits,
        source: 'seed',
        note: s.note,
      });
    });
    const local = loadLocal()[ind] || {};
    Object.keys(local).forEach((id) => {
      const s = local[id];
      out.push({
        type: s.type,
        key: s.key,
        hits: s.hits || 1,
        source: 'local',
        note: (s.meta && s.meta.note) || null,
      });
    });
    return out;
  }

  function suppressedServices(industry) {
    return signalsFor(industry)
      .filter((s) => s.type === 'service_removed' && s.hits >= SUPPRESS_THRESHOLD)
      .map((s) => String(s.key).toLowerCase());
  }

  /** Apply community learnings onto a blueprint (mutates copy). */
  function applyToBlueprint(blueprint, industry) {
    if (!blueprint || typeof blueprint !== 'object') return { blueprint, applied: [] };
    const bp = JSON.parse(JSON.stringify(blueprint));
    const ind = industry || bp.id || (bp.identity && bp.identity.slug) || '';
    const applied = [];
    const suppress = new Set(suppressedServices(ind));
    if (suppress.size && bp.services && Array.isArray(bp.services.catalog)) {
      const before = bp.services.catalog.length;
      bp.services.catalog = bp.services.catalog.filter((item) => {
        const name = String(item && item.name || '').toLowerCase();
        const hit = [...suppress].some((s) => name === s || name.includes(s) || s.includes(name));
        if (hit) applied.push({ type: 'service_removed', key: item.name });
        return !hit;
      });
      // Never leave an empty catalog
      if (!bp.services.catalog.length && before) {
        bp.services.catalog = blueprint.services.catalog.slice(0, 3);
        applied.length = 0;
      }
    }
    // Preferred CTAs from community
    const ctaSignals = signalsFor(ind).filter((s) => s.type === 'cta_changed' && s.hits >= 40);
    if (ctaSignals.length && bp.website && bp.website.sectionCopy) {
      const top = ctaSignals.sort((a, b) => b.hits - a.hits)[0];
      if (top && top.key) {
        bp.website.sectionCopy.footerCtaTitle = top.key;
        applied.push({ type: 'cta_changed', key: top.key });
      }
    }

    const prevSource = (bp._meta && bp._meta.source) || 'ai_generated';
    if (applied.length) {
      bp._meta = Object.assign({}, bp._meta || {}, {
        source: prevSource === 'official' ? 'hubly_optimized' : prevSource === 'ai_generated' ? 'community_learned' : prevSource,
        communityApplied: applied,
        intelligenceAt: new Date().toISOString(),
      });
    }
    return { blueprint: bp, applied };
  }

  function buildReasoning(opts) {
    const o = opts || {};
    const source = o.source || 'ai_generated';
    const industry = o.industry || o.id || 'local service';
    const official = !!o.hadOfficial;
    const applied = o.communityApplied || [];
    const confidence = o.confidence != null ? o.confidence : 84;
    const inputs = [];
    if (!official) inputs.push('No official ' + industry + ' blueprint exists');
    else inputs.push('Official ' + industry + ' blueprint available');
    if (o.seedId) inputs.push('Trade seed: ' + o.seedId);
    inputs.push('Home service heuristics');
    if (o.dnaHints) inputs.push('Business DNA');
    if (applied.length) inputs.push(applied.length + ' community learning(s) applied');
    if (o.signalCount) inputs.push(o.signalCount + ' industry signals observed');

    let recommendation = 'Monitor owner edits for Hybrid evolution.';
    if (confidence < 75) recommendation = 'Ask clarifying questions before publish.';
    else if (applied.some((a) => a.type === 'service_removed')) {
      recommendation = 'Community suppressed weak services — confirm catalog with owner if needed.';
    } else if (!official) {
      recommendation = 'Review emergency / urgency wording and CTAs for this trade.';
    } else if (source === 'hybrid') {
      recommendation = 'Owner edits detected — consider promoting patterns into official blueprint.';
    }

    return {
      why: official
        ? 'Using official blueprint for highest quality; Living Blueprint loop still records learnings.'
        : 'Generated a Living Blueprint so Hubly can support this business without waiting on a handcrafted file.',
      inputs,
      recommendation,
      confidence,
      source,
      communityApplied: applied,
      livingPath: [
        'official_or_generated',
        'owner_edits',
        'customer_behavior',
        'bookings_reviews_revenue',
        'blueprint_improves',
        'promote_to_official',
      ],
      forHqOnly: true,
    };
  }

  global.HublyBlueprintIntelligence = {
    SUPPRESS_THRESHOLD,
    SEED_SIGNALS,
    recordLocal,
    signalsFor,
    suppressedServices,
    applyToBlueprint,
    buildReasoning,
  };
})(typeof window !== 'undefined' ? window : globalThis);
