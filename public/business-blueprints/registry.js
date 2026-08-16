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

  /**
   * The NEUTRAL blueprint — what Hubly is when it does not know the trade.
   *
   * Before this existed, every unknown/absent business_type resolved to
   * `detailing`, which is how a photographer ended up being sold ceramic
   * coatings. "We don't know yet" is a real state and it needs its own answer.
   *
   * Rules for anything added here:
   *   - No trade nouns. Not one. No vehicles, homes, lawns, shoots, sessions.
   *   - No service catalog. An empty catalog is correct; a borrowed one is a lie.
   *   - No seed imagery. Stock photos of somebody else's trade are the same bug.
   *   - Capabilities: only the ones every blueprint shares. Trade-specific flags
   *     are explicitly false so `blueprintHasCapability` cannot leak a trade.
   *
   * Deliberately NOT in `byId` and NOT in the file manifest: it must never
   * appear in `list()`, `listForPicker()`, or any callback given the loaded set.
   * It is reachable only through `get('generic')` / `getDefaultId()`.
   */
  const NEUTRAL_BLUEPRINT_ID = 'generic';
  const NEUTRAL_BLUEPRINT = Object.freeze({
    id: NEUTRAL_BLUEPRINT_ID,
    neutral: true,
    version: '1.0',
    runtimeMinVersion: '1.0',
    identity: {
      name: 'Business',
      slug: NEUTRAL_BLUEPRINT_ID,
      description: 'Industry not known yet.',
      hint: '',
      synonyms: [],
      specialties: [],
    },
    knowledge: {
      brandVoice: 'Plain and direct. No jargon, because we do not know the field yet.',
      customerPsychology: 'Not known. Do not assume what this customer cares about.',
      buyingBehavior: 'Not known.',
      copyRules: [
        'The industry is NOT known. Do not guess one and do not adopt one from any example.',
        'Use no nouns, services, or imagery belonging to any specific trade.',
        'Write only from facts the owner has actually given.',
      ],
      galleryRules: ['Show only media the owner uploaded. Never seed stock imagery.'],
    },
    // Only what every blueprint shares. Everything trade-specific is false on purpose.
    capabilities: {
      appointments: true,
      estimates: true,
      memberships: true,
      portfolio: true,
      staffScheduling: false,
      clientGalleries: false,
      contracts: false,
      dirtySurcharge: false,
      emergencyBanner: false,
      giftCards: false,
      inventory: false,
      lightroom: false,
      printStore: false,
      projects: false,
      stickyPhone: false,
      vehicleDetails: false,
    },
    customerJourney: ['Finds the business', 'Asks about the work', 'Books', 'Pays', 'Comes back'],
    decisionFactors: ['Clear pricing', 'Easy to reach', 'Does what was promised'],
    customerExpectations: ['A straight answer', 'A time that holds', 'No surprises on the bill'],
    successMetrics: ['Booked jobs', 'Repeat customers', 'Reviews'],
    businessLifecycle: [{ id: 'setup', label: 'Getting set up' }],
    homepage: { priority: ['hero', 'services', 'about', 'reviews', 'contact'] },
    website: {
      defaultLayout: 'clean-modern',
      recommendedStyles: [],
      trustSignals: [],
      sections: { required: ['hero', 'contact'], recommended: ['services', 'about'], optional: ['gallery', 'reviews'] },
      sectionCopy: {
        servicesTitle: 'What we offer',
        servicesSub: 'Add what you do and we will lay it out.',
        galleryTitle: 'Our work',
        gallerySub: 'Add photos of real work you have done.',
        reviewsTitle: 'What customers say',
        reviewsSub: 'Reviews from people you have worked with.',
      },
      emptyIcon: '◆',
    },
    booking: { mode: 'appointments', steps: ['service', 'time', 'details', 'confirm'], defaultAddons: [] },
    services: { catalog: [] },
    gallery: { mode: 'showcase', seedImages: [] },
    growth: { weeklyGoals: [] },
    decisionRules: {},
    playbooks: [],
    automation: {},
    dashboard: {},
    performance: { flags: {} },
  });

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
    if (id === NEUTRAL_BLUEPRINT_ID) return NEUTRAL_BLUEPRINT;
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

  /**
   * What to use when the trade is not known.
   *
   * This used to return 'detailing'. It was the single most damaging line in the
   * Industry Engine: every unresolved business_type — including one that had
   * simply not been asked yet — silently became an auto-detailing business, and
   * the whole runtime (catalog, copy, capabilities, AI prompt) followed.
   * The answer to "which trade?" when nobody has said is not a trade.
   */
  function getDefaultId() {
    return NEUTRAL_BLUEPRINT_ID;
  }

  /** True when the blueprint in hand is the "we don't know the trade" one. */
  function isNeutral(typeIdOrBp) {
    const bp = typeof typeIdOrBp === 'object' ? typeIdOrBp : get(typeIdOrBp);
    return !!(bp && bp.id === NEUTRAL_BLUEPRINT_ID);
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
    // Neutral blueprint: say we don't know the trade. Never name one, and never
    // emit the "stay inside the X category" line with a placeholder name in it.
    if (g.id === NEUTRAL_BLUEPRINT_ID) {
      return [
        'You write website copy for a local business.',
        'The industry is NOT KNOWN. Do not guess one, and do not adopt an industry from any',
        'example anywhere in these instructions — especially not auto detailing or car wash.',
        `Copy rules: ${(k.copyRules || []).join('; ')}`,
        'Write only from facts the owner has actually supplied. If the trade genuinely matters',
        'for what you are about to write, ask once, plainly.',
        'Never invent awards, years-in-business, or fake customer counts.',
        'Short sentences. No agency filler.',
      ].join('\n');
    }
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
    NEUTRAL_BLUEPRINT_ID,
    loadAll,
    whenReady,
    isReady: () => ready,
    get,
    list,
    listForPicker,
    getDefaultId,
    isNeutral,
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
