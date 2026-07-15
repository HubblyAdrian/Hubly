/**
 * HublyBlueprints — Industry Engine (Runtime Spec v1.0)
 *
 * Never ask "What industry is this?"
 * Always ask "What does the Blueprint say?"
 *
 * Runtime stays ignorant. Blueprints teach behavior.
 */
(function (global) {
  const HUBLY_RUNTIME_VERSION =
    (global.HublyBlueprintValidator && global.HublyBlueprintValidator.HUBLY_RUNTIME_VERSION) || '1.0';

  /** Manifest: file names under /business-blueprints/ */
  const BLUEPRINT_FILES = [
    'detailing.json',
    'window-cleaning.json',
    'pressure-washing.json',
    'lawn-care.json',
    'house-cleaning.json',
    'photography.json',
    'hvac.json',
    'spa.json',
  ];

  const byId = {};
  let ready = false;
  let loadPromise = null;
  const listeners = [];

  function deepMerge(base, over) {
    if (!over || typeof over !== 'object') return base;
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    Object.keys(over).forEach((k) => {
      const v = over[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && base && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        out[k] = deepMerge(base[k] || {}, v);
      } else {
        out[k] = v;
      }
    });
    return out;
  }

  function validateOrWarn(bp) {
    const V = global.HublyBlueprintValidator;
    if (!V) {
      console.warn('HublyBlueprints: validator missing — accepting unverified blueprint', bp && bp.id);
      return true;
    }
    const result = V.validateBlueprint(bp, { runtimeVersion: HUBLY_RUNTIME_VERSION });
    if (!result.ok) {
      console.error('HublyBlueprints: rejected invalid blueprint', bp && bp.id, result.errors);
      return false;
    }
    return true;
  }

  async function fetchBlueprint(file) {
    const res = await fetch('/business-blueprints/' + file, { cache: 'no-cache' });
    if (!res.ok) throw new Error('Failed to load ' + file + ' (' + res.status + ')');
    return res.json();
  }

  async function loadAll() {
    if (ready) return Object.values(byId);
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      const results = await Promise.all(
        BLUEPRINT_FILES.map(async (file) => {
          try {
            const bp = await fetchBlueprint(file);
            if (validateOrWarn(bp)) return bp;
          } catch (e) {
            console.error('HublyBlueprints: load failed', file, e);
          }
          return null;
        })
      );
      results.filter(Boolean).forEach((bp) => {
        byId[bp.id] = bp;
      });
      ready = true;
      listeners.splice(0).forEach((fn) => {
        try { fn(Object.values(byId)); } catch (e) { console.warn(e); }
      });
      return Object.values(byId);
    })();
    return loadPromise;
  }

  function whenReady(fn) {
    if (ready) fn(Object.values(byId));
    else listeners.push(fn);
  }

  function get(id) {
    if (!id) return null;
    if (byId[id]) return byId[id];
    const aliases = {
      'window-cleaning': 'windows',
      window_cleaning: 'windows',
      'pressure-washing': 'pressure_washing',
      'lawn-care': 'landscaping',
      lawn_care: 'landscaping',
      'house-cleaning': 'cleaning',
      house_cleaning: 'cleaning',
    };
    const mapped = aliases[id] || aliases[String(id).replace(/_/g, '-')];
    return mapped ? byId[mapped] || null : null;
  }

  function list() {
    return Object.values(byId).slice().sort((a, b) => {
      const order = BLUEPRINT_FILES;
      const ai = order.indexOf((a.identity && a.identity.slug ? a.identity.slug : a.id) + '.json');
      // Prefer manifest order by matching file via slug/id map
      const fileFor = (bp) => {
        const slug = (bp.identity && bp.identity.slug) || bp.id;
        const hit = BLUEPRINT_FILES.find((f) => f === slug + '.json' || f.replace(/\.json$/, '').replace(/-/g, '_') === bp.id);
        return hit ? BLUEPRINT_FILES.indexOf(hit) : 999;
      };
      return fileFor(a) - fileFor(b);
    });
  }

  function getDefaultId() {
    return byId.detailing ? 'detailing' : Object.keys(byId)[0] || 'detailing';
  }

  function getSpecialty(bp, specialtyId) {
    const specs = (bp && bp.identity && bp.identity.specialties) || [];
    if (!specs.length) return null;
    if (specialtyId) {
      const hit = specs.find((s) => s.id === specialtyId);
      if (hit) return hit;
    }
    return specs.find((s) => s.default) || specs[0] || null;
  }

  /** Resolve blueprint + optional specialty overrides into one object. */
  function resolve(typeId, specialtyId) {
    const base = get(typeId) || get(getDefaultId());
    if (!base) return null;
    const spec = getSpecialty(base, specialtyId);
    if (!spec || !spec.overrides || !Object.keys(spec.overrides).length) {
      return Object.assign({}, base, { _specialtyId: spec ? spec.id : null });
    }
    const merged = deepMerge(base, spec.overrides);
    merged.id = base.id;
    merged._specialtyId = spec.id;
    return merged;
  }

  function hasCapability(typeId, key) {
    const bp = typeof typeId === 'object' ? typeId : get(typeId);
    if (!bp || !bp.capabilities) return false;
    return !!bp.capabilities[key];
  }

  function serviceNames(typeId) {
    const bp = typeof typeId === 'object' ? typeId : get(typeId);
    const catalog = (bp && bp.services && bp.services.catalog) || [];
    return catalog.map((s) => s.name).filter(Boolean);
  }

  function catalog(typeId, specialtyId) {
    const bp =
      typeof typeId === 'object' ? typeId : resolve(typeId, specialtyId != null ? specialtyId : null);
    return ((bp && bp.services && bp.services.catalog) || []).slice();
  }

  function defaultAddons(typeId, specialtyId) {
    const bp =
      typeof typeId === 'object' ? typeId : resolve(typeId, specialtyId != null ? specialtyId : null);
    return ((bp && bp.booking && bp.booking.defaultAddons) || []).slice();
  }

  function sectionCopy(typeId) {
    const bp = typeof typeId === 'object' ? typeId : get(typeId);
    return (bp && bp.website && bp.website.sectionCopy) || {};
  }

  function emptyIcon(typeId) {
    const bp = typeof typeId === 'object' ? typeId : get(typeId);
    return (bp && bp.website && bp.website.emptyIcon) || '◆';
  }

  function seedImages(typeId) {
    const bp = typeof typeId === 'object' ? typeId : get(typeId);
    return ((bp && bp.gallery && bp.gallery.seedImages) || []).slice();
  }

  function synonyms(typeId) {
    const bp = typeof typeId === 'object' ? typeId : get(typeId);
    return ((bp && bp.identity && bp.identity.synonyms) || []).slice();
  }

  function defaultLayout(typeId) {
    const bp = typeof typeId === 'object' ? typeId : get(typeId);
    return (bp && bp.website && bp.website.defaultLayout) || 'clean-modern';
  }

  function homepagePriority(typeId) {
    const bp = typeof typeId === 'object' ? typeId : get(typeId);
    return (bp && bp.homepage && bp.homepage.priority) || [];
  }

  function bookingBlueprint(typeId) {
    const bp = typeof typeId === 'object' ? typeId : get(typeId);
    return (bp && bp.booking) || { mode: 'appointments', steps: [] };
  }

  function performanceFlags(typeId) {
    const bp = typeof typeId === 'object' ? typeId : get(typeId);
    return (bp && bp.performance && bp.performance.flags) || {};
  }

  function aiGuidance(typeId) {
    const bp = typeof typeId === 'object' ? typeId : resolve(typeId);
    if (!bp) return null;
    return {
      id: bp.id,
      name: (bp.identity && bp.identity.name) || bp.id,
      knowledge: bp.knowledge || {},
      customerJourney: bp.customerJourney || [],
      decisionFactors: bp.decisionFactors || [],
      customerExpectations: bp.customerExpectations || [],
      trustSignals: (bp.website && bp.website.trustSignals) || [],
      serviceCatalog: catalog(bp),
      gallery: bp.gallery || {},
      homepagePriority: homepagePriority(bp),
      defaultLayout: defaultLayout(bp),
      recommendedStyles: (bp.website && bp.website.recommendedStyles) || [],
      bookingMode: (bp.booking && bp.booking.mode) || 'appointments',
      capabilities: bp.capabilities || {},
      sectionCopy: sectionCopy(bp),
      emptyIcon: emptyIcon(bp),
      galleryMode: (bp.gallery && bp.gallery.mode) || 'before_after',
    };
  }

  /** Picker cards for Creative Director — driven only by Blueprint identity. */
  function listForPicker() {
    return list().map((bp) => ({
      id: bp.id,
      label: (bp.identity && bp.identity.name) || bp.id,
      hint: (bp.identity && (bp.identity.hint || bp.identity.description)) || '',
      img: (bp.identity && bp.identity.pickerImage) || '',
    }));
  }

  function composeSystemPrompt(typeId) {
    const g = aiGuidance(typeId);
    if (!g) return 'You write website copy for a local service business.';
    const k = g.knowledge;
    return [
      `You write website copy for a ${g.name} business.`,
      `Brand voice: ${k.brandVoice || ''}`,
      `Customer psychology: ${k.customerPsychology || ''}`,
      `Buying behavior: ${k.buyingBehavior || ''}`,
      `Decision factors customers care about: ${(g.decisionFactors || []).join(', ')}`,
      `Customer expectations for the experience: ${(g.customerExpectations || []).join(', ')}`,
      `Homepage priority (lead with these): ${(g.homepagePriority || []).join(' → ')}`,
      `Trust signals: ${(g.trustSignals || []).join(', ')}`,
      `Copy rules: ${(k.copyRules || []).join('; ')}`,
      `Gallery rules: ${(k.galleryRules || []).join('; ')}`,
      'Never invent awards, years-in-business, or fake customer counts.',
      'Short sentences. No agency filler.',
      `Stay inside the ${g.name} category — never import auto detailing, car-wash, or unrelated trade language.`,
    ].filter(Boolean).join('\n');
  }

  global.HublyBlueprints = {
    HUBLY_RUNTIME_VERSION,
    BLUEPRINT_FILES,
    loadAll,
    whenReady,
    isReady: () => ready,
    get,
    list,
    listForPicker,
    getDefaultId,
    getSpecialty,
    resolve,
    hasCapability,
    serviceNames,
    catalog,
    defaultAddons,
    sectionCopy,
    emptyIcon,
    seedImages,
    synonyms,
    defaultLayout,
    homepagePriority,
    bookingBlueprint,
    performanceFlags,
    aiGuidance,
    composeSystemPrompt,
  };

  // Kick off load in browser
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => { loadAll().catch((e) => console.error(e)); });
    } else {
      loadAll().catch((e) => console.error(e));
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
