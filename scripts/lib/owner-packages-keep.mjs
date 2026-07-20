/**
 * Pure helpers for Instant Site / import-offers package retention.
 * Mirrored in hubly.html (ownerHasNamedPackages, shouldKeepOwnerPackages,
 * promotePkgDraftToServicesIfNeeded, mapImportedPackageToDraft).
 * Keep behavior in sync when changing either side.
 */

export function ownerHasNamedPackages(S) {
  if ((S.services || []).some((s) => s && String(s.name || '').trim())) return true;
  if ((S.editorSvcs || []).some((s) => s && String(s.name || '').trim())) return true;
  if ((S._is?.pkgDraft || []).some((s) => s && String(s.name || '').trim())) return true;
  return false;
}

export function shouldKeepOwnerPackages(S) {
  return ownerHasNamedPackages(S);
}

/** Decide whether applyCdBlueprint should call seedOnboardServicesFromType. */
export function shouldSeedServices({ seedServices, keepOwner }) {
  if (seedServices === true) return true;
  if (seedServices === false) return false;
  return !keepOwner;
}

/**
 * Promote Instant Site pkgDraft → S.services (mutates a shallow copy of state).
 * Returns { promoted, S }.
 */
export function promotePkgDraftToServices(S) {
  const next = {
    ...S,
    _is: { ...(S._is || {}) },
    services: Array.isArray(S.services) ? S.services.slice() : [],
  };
  const draft = (next._is.pkgDraft || []).filter((p) => p && String(p.name || '').trim());
  if (!draft.length) return { promoted: false, S: next };
  if ((next.services || []).some((s) => s && String(s.name || '').trim())) {
    return { promoted: true, S: next };
  }
  next.services = draft.map((p, i) => {
    const price = Number(p.price);
    return {
      name: String(p.name).trim(),
      price: Number.isFinite(price) ? price : 0,
      dur: p.dur || '',
      desc: p.desc || '',
      imgUrl: p.imgUrl || null,
      photos: p.imgUrl ? [p.imgUrl] : [],
      popular: !!p.popular || i === 0,
      showPrice: true,
      pricingType: p.pricingType === 'variable' || p.pricingType === 'vehicle' ? 'variable' : 'flat',
      varPrices: p.varPrices || {},
      includes: p.includes || '',
      includesList: String(p.includes || '')
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean),
    };
  });
  next._is.servicesMode = 'now';
  next._servicesDraft = false;
  return { promoted: true, S: next };
}

export function mapImportedPackageToDraft(p, i, blank = { imgUrl: '', dur: '2' }) {
  const includesArr = Array.isArray(p?.includes) ? p.includes : p?.includes ? [String(p.includes)] : [];
  const includes = includesArr.map((x) => String(x || '').trim()).filter(Boolean).join('\n');
  const tiers = ['sedan', 'coupe', 'crossover', 'suv', 'truck', 'van'];
  const raw = p?.varPrices && typeof p.varPrices === 'object' ? p.varPrices : {};
  const varPrices = {};
  tiers.forEach((k) => {
    const v = raw[k];
    varPrices[k] = v == null || v === '' ? '' : String(v);
  });
  const hasVehicle =
    p?.pricingType === 'vehicle' ||
    p?.pricingType === 'variable' ||
    tiers.some((k) => varPrices[k] !== '');
  let price = p?.price != null && p.price !== '' ? String(p.price) : '';
  if (hasVehicle && !price && varPrices.sedan) price = String(varPrices.sedan);
  const desc =
    String(p?.desc || '').trim() || (includesArr.length ? includesArr.slice(0, 4).join(' · ') : '');
  return {
    name: String(p?.name || '').trim() || `Package ${i + 1}`,
    price,
    dur: p?.dur != null && p.dur !== '' ? String(p.dur) : blank.dur || '2',
    desc,
    includes,
    imgUrl: blank.imgUrl || '',
    popular: !!p?.popular || i === 0,
    pricingType: hasVehicle ? 'variable' : 'flat',
    varPrices,
    needsReview: !!p?.needsReview || p?.price == null || p?.confidence === 'low',
  };
}

/** Simulate Instant Site build package step after import. */
export function resolveBuildPackages(S, { seedStarterNames = ['Starter Wash', 'Full Detail'] } = {}) {
  let state = { ...S, _is: { ...(S._is || {}) } };
  const { promoted, S: afterPromote } = promotePkgDraftToServices(state);
  state = afterPromote;
  const keep = shouldKeepOwnerPackages(state);
  const seed = shouldSeedServices({ seedServices: !keep, keepOwner: keep });
  if (seed) {
    state.services = seedStarterNames.map((name, i) => ({
      name,
      price: 99 + i * 50,
      dur: '2',
      desc: 'Blueprint starter',
    }));
  }
  return { keep, seed, promoted, services: state.services };
}
