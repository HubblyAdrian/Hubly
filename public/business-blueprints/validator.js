/**
 * Hubly Blueprint Validator (Runtime Spec v1.0 §7)
 * Fail closed: invalid blueprints are rejected by the registry.
 */
(function (global) {
  const HUBLY_RUNTIME_VERSION = '1.0';

  const REQUIRED_TOP = [
    'id', 'version', 'runtimeMinVersion', 'identity', 'knowledge', 'capabilities',
    'customerJourney', 'decisionFactors', 'customerExpectations', 'successMetrics',
    'businessLifecycle', 'homepage', 'website', 'booking', 'services', 'gallery',
    'growth', 'decisionRules', 'playbooks', 'automation', 'dashboard', 'performance',
  ];

  function isNonEmptyString(v) {
    return typeof v === 'string' && v.trim().length > 0;
  }

  function isStringArray(v) {
    return Array.isArray(v) && v.every((x) => typeof x === 'string');
  }

  function semverOk(v) {
    return typeof v === 'string' && /^\d+\.\d+(\.\d+)?$/.test(v);
  }

  function compareSemver(a, b) {
    const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
    const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < 3; i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d) return d;
    }
    return 0;
  }

  function validateBlueprint(bp, opts) {
    const errors = [];
    const runtimeVersion = (opts && opts.runtimeVersion) || HUBLY_RUNTIME_VERSION;

    if (!bp || typeof bp !== 'object') {
      return { ok: false, errors: ['Blueprint must be an object'] };
    }

    REQUIRED_TOP.forEach((k) => {
      if (bp[k] === undefined || bp[k] === null) errors.push(`Missing required section: ${k}`);
    });

    if (bp.id && !isNonEmptyString(bp.id)) errors.push('id must be a non-empty string');
    if (bp.version && !semverOk(bp.version)) errors.push('version must be semver-like (e.g. 1.0)');
    if (bp.runtimeMinVersion && !semverOk(bp.runtimeMinVersion)) {
      errors.push('runtimeMinVersion must be semver-like');
    }
    if (bp.runtimeMinVersion && compareSemver(runtimeVersion, bp.runtimeMinVersion) < 0) {
      errors.push(`Runtime ${runtimeVersion} is older than blueprint runtimeMinVersion ${bp.runtimeMinVersion}`);
    }

    const idty = bp.identity || {};
    if (!isNonEmptyString(idty.name)) errors.push('identity.name required');
    if (!isNonEmptyString(idty.slug)) errors.push('identity.slug required');
    if (idty.specialties != null && !Array.isArray(idty.specialties)) {
      errors.push('identity.specialties must be an array');
    }
    if (idty.synonyms != null && !isStringArray(idty.synonyms)) {
      errors.push('identity.synonyms must be a string array when present');
    }

    const knowledge = bp.knowledge || {};
    ['brandVoice', 'customerPsychology', 'buyingBehavior'].forEach((k) => {
      if (!isNonEmptyString(knowledge[k])) errors.push(`knowledge.${k} required`);
    });

    if (bp.capabilities && typeof bp.capabilities !== 'object') {
      errors.push('capabilities must be an object');
    }

    if (!isStringArray(bp.customerJourney) || !bp.customerJourney.length) {
      errors.push('customerJourney must be a non-empty string array');
    }
    if (!isStringArray(bp.decisionFactors) || !bp.decisionFactors.length) {
      errors.push('decisionFactors must be a non-empty string array');
    }
    if (!isStringArray(bp.customerExpectations) || !bp.customerExpectations.length) {
      errors.push('customerExpectations must be a non-empty string array');
    }
    if (!isStringArray(bp.successMetrics) || !bp.successMetrics.length) {
      errors.push('successMetrics must be a non-empty string array');
    }

    if (!Array.isArray(bp.businessLifecycle) || !bp.businessLifecycle.length) {
      errors.push('businessLifecycle must be a non-empty array');
    }

    const homepage = bp.homepage || {};
    if (!isStringArray(homepage.priority) || !homepage.priority.length) {
      errors.push('homepage.priority must be a non-empty string array');
    }

    const website = bp.website || {};
    if (!website.sections || typeof website.sections !== 'object') {
      errors.push('website.sections required');
    } else {
      ['required', 'optional', 'recommended'].forEach((tier) => {
        if (!isStringArray(website.sections[tier])) {
          errors.push(`website.sections.${tier} must be a string array`);
        }
      });
      if (!website.sections.required || !website.sections.required.length) {
        errors.push('website.sections.required must be non-empty');
      }
    }
    if (!isNonEmptyString(website.defaultLayout)) {
      errors.push('website.defaultLayout required');
    }
    if (website.sectionCopy != null && typeof website.sectionCopy !== 'object') {
      errors.push('website.sectionCopy must be an object when present');
    }
    if (website.emptyIcon != null && !isNonEmptyString(website.emptyIcon)) {
      errors.push('website.emptyIcon must be a non-empty string when present');
    }

    const booking = bp.booking || {};
    if (!isNonEmptyString(booking.mode)) errors.push('booking.mode required');
    if (!Array.isArray(booking.steps) || !booking.steps.length) {
      errors.push('booking.steps must be a non-empty array');
    }

    const services = bp.services || {};
    if (!Array.isArray(services.catalog) || !services.catalog.length) {
      errors.push('services.catalog must be a non-empty array');
    } else {
      services.catalog.forEach((item, i) => {
        if (!item || !isNonEmptyString(item.name)) {
          errors.push(`services.catalog[${i}].name required`);
        }
      });
    }

    if (!bp.gallery || typeof bp.gallery !== 'object') errors.push('gallery required');
    else if (bp.gallery.seedImages != null && !isStringArray(bp.gallery.seedImages)) {
      errors.push('gallery.seedImages must be a string array when present');
    }
    if (!bp.growth || typeof bp.growth !== 'object') errors.push('growth required');
    else {
      if (!isStringArray(bp.growth.weeklyGoals)) errors.push('growth.weeklyGoals must be a string array');
      if (!isStringArray(bp.growth.businessHealth)) errors.push('growth.businessHealth must be a string array');
    }

    if (!Array.isArray(bp.decisionRules)) errors.push('decisionRules must be an array');
    if (!Array.isArray(bp.playbooks)) errors.push('playbooks must be an array');
    if (!bp.automation || typeof bp.automation !== 'object') errors.push('automation required');
    if (!bp.dashboard || !Array.isArray(bp.dashboard.widgets)) {
      errors.push('dashboard.widgets must be an array');
    }
    if (!bp.performance || typeof bp.performance !== 'object') errors.push('performance required');

    return { ok: errors.length === 0, errors };
  }

  function assertValid(bp, opts) {
    const result = validateBlueprint(bp, opts);
    if (!result.ok) {
      const msg = `Invalid Blueprint${bp && bp.id ? ` "${bp.id}"` : ''}: ${result.errors.join('; ')}`;
      throw new Error(msg);
    }
    return result;
  }

  global.HublyBlueprintValidator = {
    HUBLY_RUNTIME_VERSION,
    REQUIRED_TOP,
    validateBlueprint,
    assertValid,
    compareSemver,
  };
})(typeof window !== 'undefined' ? window : globalThis);
