/**
 * HublyBookingFrames — industry booking wizard frames.
 */
(function (global) {
  const FRAME_FILES = [
    'detailing.json',
    'windows.json',
    'cleaning.json',
    'hvac.json',
    'landscaping.json',
    'spa.json',
    'pressure_washing.json',
    'photography.json',
  ];

  const ALIASES = {
    windows: 'windows',
    'window-cleaning': 'windows',
    window_cleaning: 'windows',
    detailing: 'detailing',
    auto_detailing: 'detailing',
    cleaning: 'cleaning',
    'house-cleaning': 'cleaning',
    house_cleaning: 'cleaning',
    hvac: 'hvac',
    landscaping: 'landscaping',
    'lawn-care': 'landscaping',
    lawn_care: 'landscaping',
    spa: 'spa',
    pressure_washing: 'pressure_washing',
    'pressure-washing': 'pressure_washing',
    photography: 'photography',
  };

  const byId = {};
  let ready = false;
  let loadPromise = null;
  const listeners = [];

  function recipeId(businessType) {
    const raw = String(businessType || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_');
    if (!raw) return '';
    if (byId[raw]) return raw;
    if (ALIASES[raw]) return ALIASES[raw];
    const dashed = raw.replace(/_/g, '-');
    if (ALIASES[dashed]) return ALIASES[dashed];
    if (global.HublySmartQuote && HublySmartQuote.recipeId) {
      const r = HublySmartQuote.recipeId(raw);
      if (byId[r]) return r;
    }
    // Never invent another industry — return the resolved key even if still loading.
    return ALIASES[raw] || raw;
  }

  async function fetchFrame(file) {
    const res = await fetch('/booking-frames/' + file, { cache: 'no-cache' });
    if (!res.ok) throw new Error('Failed to load ' + file);
    return res.json();
  }

  async function loadAll() {
    if (ready) return Object.values(byId);
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      const results = await Promise.all(
        FRAME_FILES.map(async (file) => {
          try {
            return await fetchFrame(file);
          } catch (e) {
            console.error('HublyBookingFrames load failed', file, e);
            return null;
          }
        })
      );
      results.filter(Boolean).forEach((f) => {
        byId[f.id] = f;
      });
      ready = true;
      listeners.splice(0).forEach((fn) => {
        try {
          fn();
        } catch (e) {}
      });
      return Object.values(byId);
    })();
    return loadPromise;
  }

  function whenReady(fn) {
    if (ready) {
      try {
        fn();
      } catch (e) {}
      return;
    }
    listeners.push(fn);
    loadAll();
  }

  function get(id) {
    const rid = recipeId(id);
    return (rid && byId[rid]) || null;
  }

  function isReady() {
    return ready;
  }

  /** Build owner bookingWizard state from frame + current services/addons. */
  function seedWizard(opts) {
    const o = opts || {};
    const wantedId = recipeId(o.businessType);
    const frame = get(o.businessType);
    if (!frame) {
      console.warn('HublyBookingFrames: no frame for', o.businessType, '→', wantedId);
      return {
        frameId: wantedId || 'custom',
        headline: '',
        blurb: '',
        servicePrompt: '',
        trustLines: [],
        sidebarIncludes: [],
        benefitOptions: [],
        ownerTips: [],
        ctaLabel: 'Book now',
        packagesTitle: 'Packages',
        helpBlurb: '',
        reviewTrust: '',
        cancelBlurb: '',
        whereOptions: [],
        infoFields: [],
        studioAddress: '',
        whereNote: '',
        services: [],
        addons: [],
        done: false,
      };
    }
    const existing = o.existing && typeof o.existing === 'object' ? o.existing : null;
    // If the saved wizard belongs to another industry, re-seed chrome from this frame.
    if (existing && existing.frameId && existing.frameId === frame.id) {
      return Object.assign({}, frameDefaults(frame), existing, {
        frameId: frame.id,
        benefitOptions: (existing.benefitOptions && existing.benefitOptions.length
          ? existing.benefitOptions
          : frameDefaults(frame).benefitOptions
        ).slice(),
        ownerTips: (existing.ownerTips && existing.ownerTips.length
          ? existing.ownerTips
          : frameDefaults(frame).ownerTips
        ).slice(),
        ctaLabel: existing.ctaLabel || frameDefaults(frame).ctaLabel,
        packagesTitle: existing.packagesTitle || frameDefaults(frame).packagesTitle,
      });
    }
    const services = (o.services || []).map((s, i) => ({
      id: s.id || 'svc-' + i,
      name: s.name || 'Service',
      desc: s.desc || s.description || '',
      price: Number(s.price != null ? s.price : s.defaultPrice) || 0,
      dur: s.dur || s.duration || '',
      image: s.imgUrl || s.image || (Array.isArray(s.photos) && s.photos[0]) || '',
      popular: !!s.popular,
    }));
    const addons = (o.addons || []).map((a, i) => ({
      id: a.id || 'addon-' + i,
      name: a.name || 'Add-on',
      price: Number(a.price) || 0,
      enabled: a.enabled !== false,
    }));
    return Object.assign(frameDefaults(frame), {
      frameId: frame.id,
      services: services.length ? services : [],
      addons,
      done: false,
    });
  }

  function frameDefaults(frame) {
    const benefits = (frame.benefitOptions || frame.sidebarIncludes || []).slice();
    return {
      frameId: frame.id,
      headline: frame.headline || '',
      blurb: frame.blurb || '',
      servicePrompt: frame.servicePrompt || 'Choose a service',
      trustLines: (frame.trustLines || []).slice(),
      sidebarIncludes: (frame.sidebarIncludes || []).slice(),
      benefitOptions: benefits,
      ownerTips: (frame.ownerTips || []).slice(),
      ctaLabel: frame.ctaLabel || 'Book now',
      packagesTitle: frame.packagesTitle || 'Packages',
      helpBlurb: frame.helpBlurb || '',
      reviewTrust: frame.reviewTrust || '',
      cancelBlurb: frame.cancelBlurb || '',
      whereOptions: (frame.whereOptions || []).map((w) => Object.assign({}, w)),
      infoFields: (frame.infoFields || []).map((f) => Object.assign({}, f)),
      studioAddress: frame.studioAddress || '',
      whereNote: frame.whereNote || '',
    };
  }

  loadAll();

  global.HublyBookingFrames = {
    ALIASES,
    recipeId,
    loadAll,
    whenReady,
    get,
    isReady,
    seedWizard,
    list: () => Object.values(byId),
  };
})(typeof window !== 'undefined' ? window : global);
