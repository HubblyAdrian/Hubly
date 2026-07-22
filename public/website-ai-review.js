/**
 * Hubly Website AI Review Pass
 *
 * Every generated website reviews itself before publishing.
 * Questions:
 *   Does this feel like the right trade?
 *   Would I hire this company?
 *   Is pricing believable?
 *   Is the CTA strong?
 *   Is SEO good?
 *
 * If score < 90 → regenerate weak sections (no customer workflow change).
 */
(function (global) {
  const PASS_SCORE = 90;

  function tradeTokens(bp) {
    const name = (bp && bp.identity && bp.identity.name) || '';
    const syn = (bp && bp.identity && bp.identity.synonyms) || [];
    const slug = (bp && bp.identity && bp.identity.slug) || (bp && bp.id) || '';
    return [name, slug, ...syn]
      .join(' ')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3);
  }

  function blobFromSite(site, biz, services) {
    const w = site || {};
    const parts = [
      w.heroHeadline,
      w.heroSub,
      w.aboutText,
      w.servicesTitle,
      w.servicesSub,
      w.galleryTitle,
      w.reviewsTitle,
      w.footerCtaTitle,
      w.seoTitle,
      w.seoDescription,
      biz,
      (services || []).map((s) => s.name + ' ' + (s.desc || '')).join(' '),
    ];
    return parts.filter(Boolean).join(' ').toLowerCase();
  }

  function scoreFeelLikeTrade(blob, tokens) {
    if (!tokens.length) return { score: 70, note: 'No trade tokens to match' };
    const hits = tokens.filter((t) => blob.includes(t)).length;
    const ratio = hits / Math.min(tokens.length, 6);
    const score = Math.round(55 + ratio * 45);
    return {
      score: Math.min(100, score),
      note: hits ? `Matched ${hits} trade signal(s)` : 'Copy feels generic for this trade',
      weak: score < 80,
    };
  }

  function scoreHireable(site, bp) {
    const w = site || {};
    let score = 50;
    const notes = [];
    if (w.heroSub && String(w.heroSub).length >= 24) { score += 12; notes.push('hero sub present'); }
    else { notes.push('hero sub thin'); }
    if (w.aboutText && String(w.aboutText).length >= 40) score += 10;
    if ((bp && bp.website && (bp.website.trustSignals || []).length) || (w.whyTitle)) score += 10;
    if (w.reviewsTitle || w.reviewsSub) score += 8;
    if (w.footerCtaTitle || w.heroCta) score += 10;
    return { score: Math.min(100, score), note: notes.join('; ') || 'hire signals', weak: score < 80 };
  }

  function scorePricing(services) {
    const list = (services || []).filter((s) => s && (s.price != null && s.price !== ''));
    if (!list.length) return { score: 72, note: 'No prices yet — quote-led is ok', weak: false };
    let ok = 0;
    list.forEach((s) => {
      const n = Number(String(s.price).replace(/[^0-9.]/g, ''));
      if (Number.isFinite(n) && n >= 29 && n <= 15000) ok += 1;
    });
    const ratio = ok / list.length;
    const score = Math.round(50 + ratio * 50);
    return {
      score,
      note: `${ok}/${list.length} prices look believable`,
      weak: score < 80,
    };
  }

  function scoreCta(site, bp) {
    const w = site || {};
    const cta = String(w.footerCtaTitle || w.heroCta || (bp && bp.website && bp.website.sectionCopy && bp.website.sectionCopy.footerCtaTitle) || '').trim();
    let score = 40;
    if (cta.length >= 4) score += 30;
    if (cta.length >= 10) score += 15;
    if (/book|call|quote|schedule|hire|get/i.test(cta)) score += 15;
    if (/click here|learn more|submit/i.test(cta)) score -= 20;
    return {
      score: Math.max(0, Math.min(100, score)),
      note: cta ? `CTA: “${cta}”` : 'Missing strong CTA',
      weak: score < 80,
    };
  }

  function scoreSeo(site, biz) {
    const w = site || {};
    const title = String(w.seoTitle || '').trim();
    const desc = String(w.seoDescription || '').trim();
    let score = 40;
    if (title.length >= 20 && title.length <= 70) score += 25;
    else if (title.length > 8) score += 10;
    if (desc.length >= 70 && desc.length <= 160) score += 25;
    else if (desc.length >= 40) score += 12;
    if (biz && title.toLowerCase().includes(String(biz).toLowerCase().slice(0, 12))) score += 10;
    return {
      score: Math.min(100, score),
      note: `SEO title ${title.length} chars · desc ${desc.length} chars`,
      weak: score < 80,
    };
  }

  function review(opts) {
    const o = opts || {};
    const site = o.website || {};
    const bp = o.blueprint || null;
    const services = o.services || [];
    const biz = o.biz || '';
    const blob = blobFromSite(site, biz, services);
    const tokens = tradeTokens(bp);

    const dimensions = {
      feel_like_trade: scoreFeelLikeTrade(blob, tokens),
      would_hire: scoreHireable(site, bp),
      pricing_believable: scorePricing(services),
      cta_strong: scoreCta(site, bp),
      seo_good: scoreSeo(site, biz),
    };

    const values = Object.values(dimensions).map((d) => d.score);
    const score = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const weakSections = Object.keys(dimensions).filter((k) => dimensions[k].weak);

    return {
      score,
      pass: score >= PASS_SCORE,
      threshold: PASS_SCORE,
      dimensions,
      weakSections,
      summary:
        score >= PASS_SCORE
          ? `AI Review Pass ${score}/100 — ready to publish`
          : `AI Review ${score}/100 — regenerating: ${weakSections.join(', ') || 'weak sections'}`,
    };
  }

  /** Apply targeted regenerations for weak dimensions using blueprint copy. */
  function regenerateWeak(site, bp, reviewResult, services) {
    const w = Object.assign({}, site || {});
    const weak = (reviewResult && reviewResult.weakSections) || [];
    const sc = (bp && bp.website && bp.website.sectionCopy) || {};
    const name = (bp && bp.identity && bp.identity.name) || 'service';
    const changed = [];

    if (weak.includes('feel_like_trade') || weak.includes('would_hire')) {
      if (sc.heroSubFallback) { w.heroSub = sc.heroSubFallback; changed.push('heroSub'); }
      if (sc.servicesTitle) { w.servicesTitle = sc.servicesTitle; changed.push('servicesTitle'); }
      if (sc.servicesSub) { w.servicesSub = sc.servicesSub; changed.push('servicesSub'); }
      if (sc.whyTitle) { w.whyTitle = sc.whyTitle; changed.push('whyTitle'); }
      if (sc.whySub) { w.whySub = sc.whySub; changed.push('whySub'); }
      if (!w.heroHeadline || String(w.heroHeadline).length < 8) {
        w.heroHeadline = `${name} done right`;
        changed.push('heroHeadline');
      }
    }
    if (weak.includes('cta_strong')) {
      const cta = sc.footerCtaTitle || `Book ${name}`;
      w.footerCtaTitle = cta;
      w.heroCta = w.heroCta || cta;
      changed.push('cta');
    }
    if (weak.includes('seo_good')) {
      const biz = w._bizName || name;
      w.seoTitle = `${biz} | ${name}`.slice(0, 60);
      w.seoDescription = (sc.heroSubFallback || `Professional ${String(name).toLowerCase()} — clear packages, easy booking.`).slice(0, 155);
      changed.push('seo');
    }
    if (weak.includes('pricing_believable') && Array.isArray(services)) {
      // Soft-clamp extreme outliers for display honesty (does not invent prices)
      services.forEach((s) => {
        const n = Number(String(s.price || '').replace(/[^0-9.]/g, ''));
        if (Number.isFinite(n) && n > 0 && n < 20) s.price = '49';
        if (Number.isFinite(n) && n > 25000) s.price = '999';
      });
      changed.push('pricing_clamp');
    }
    return { website: w, changed };
  }

  /** Full pass: review → maybe regen → re-review. */
  function runPass(opts) {
    const first = review(opts);
    if (first.pass) {
      return { ...first, regenerated: false, attempts: 1, final: first };
    }
    const fixed = regenerateWeak(opts.website, opts.blueprint, first, opts.services);
    const second = review({
      ...opts,
      website: fixed.website,
    });
    return {
      ...second,
      regenerated: true,
      attempts: 2,
      before: first,
      changed: fixed.changed,
      final: second,
      website: fixed.website,
      summary: second.pass
        ? `AI Review Pass ${second.score}/100 after regenerating ${fixed.changed.join(', ')}`
        : `AI Review ${second.score}/100 after regen — publishing with notes`,
    };
  }

  global.HublyWebsiteAIReview = {
    PASS_SCORE,
    review,
    regenerateWeak,
    runPass,
  };
})(typeof window !== 'undefined' ? window : globalThis);
