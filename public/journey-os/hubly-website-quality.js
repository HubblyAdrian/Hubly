/**
 * Hubly Website Quality — Sprint 3
 *
 * Not templates. Launch-worthy sites.
 * Build → Critique → Improve → Measure → Recommend → Improve again
 *
 * Internal scores (not public): Design · Trust · Mobile · Conversion · Brand · Speed
 * Self Review after every major build: Improve · Ignore · Compare
 */
(function (global) {
  'use strict';

  var DIMENSIONS = Object.freeze(['design', 'trust', 'mobile', 'conversion', 'brand', 'speed']);

  function S() {
    return global.S || (global.S = {});
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, Number(n) || 0));
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /**
   * Score a live website object (creativeBuild.live or AW surface state).
   * Evidence-based — lower trust when no reviews/proof; lower conversion when many CTAs.
   */
  function score(live, opts) {
    opts = opts || {};
    live = live || {};
    var theme = String(live.theme || opts.theme || 'minimal');
    var ctaCount = 1;
    if (live.ctaSecondary) ctaCount++;
    if (live.nav && live.nav.length > 6) ctaCount++;
    if ((live.chips || []).filter(function (c) { return /book|buy|shop|quote/i.test(c.label || ''); }).length > 2) {
      ctaCount += 1;
    }

    var hasTrust = !!(live.reviews && live.reviews.length) || !!(live.trustBadges && live.trustBadges.length)
      || (live.chips || []).some(function (c) { return /review|trust|guarantee|proof|before/i.test(c.label || ''); });
    var hasProof = !!(live.portfolio || live.proof) || (live.chips || []).some(function (c) { return /proof|gallery|portfolio|before/i.test(c.label || ''); });
    var hasPackages = !!(live.packages && live.packages.length);
    var heroSpecific = !!(live.heroSub && !/taking shape|local — built|built with care/i.test(live.heroSub));
    var singleCta = ctaCount <= 1;
    var leanNav = !(live.nav && live.nav.length > 5);

    var scores = {
      design: 78,
      trust: 70,
      mobile: 92,
      conversion: 80,
      brand: 82,
      speed: 94,
    };

    if (theme === 'minimal' || theme === 'classic' || theme === 'bold' || theme === 'luxury') scores.design += 8;
    if (heroSpecific) scores.design += 4;
    if (leanNav) scores.design += 2; else scores.design -= 6;

    if (hasTrust) scores.trust += 14;
    if (hasProof) scores.trust += 8;
    if (!hasTrust && !hasProof) scores.trust -= 8;

    if (singleCta) scores.conversion += 10; else scores.conversion -= 12;
    if (hasPackages) scores.conversion += 4;
    if (live.cta) scores.conversion += 2;

    if (/bold|luxury|classic/.test(theme)) scores.brand += 6;
    if (heroSpecific) scores.brand += 4;

    scores.mobile += leanNav ? 4 : -4;
    scores.speed += (live.packages && live.packages.length > 6) ? -6 : 2;

    Object.keys(scores).forEach(function (k) {
      scores[k] = clamp(scores[k], 40, 99);
    });

    var overall = Math.round(
      DIMENSIONS.reduce(function (a, k) { return a + scores[k]; }, 0) / DIMENSIONS.length
    );

    var weakest = DIMENSIONS.slice().sort(function (a, b) { return scores[a] - scores[b]; })[0];
    var findings = buildFindings(scores, {
      ctaCount: ctaCount,
      singleCta: singleCta,
      hasTrust: hasTrust,
      hasProof: hasProof,
      leanNav: leanNav,
      heroSpecific: heroSpecific,
    });

    return {
      scores: scores,
      overall: overall,
      weakest: weakest,
      findings: findings,
      ctaCount: ctaCount,
      live: live,
    };
  }

  function buildFindings(scores, flags) {
    var out = [];
    if (!flags.singleCta) {
      out.push({
        id: 'simplify_cta',
        dimension: 'conversion',
        severity: 'high',
        title: 'Too many asks on the homepage',
        detail: 'Your homepage is asking visitors to do ' + flags.ctaCount + ' different things. I think we should simplify that.',
        improve: 'one_cta',
      });
    }
    if (scores.trust < 80) {
      out.push({
        id: 'add_trust',
        dimension: 'trust',
        severity: 'high',
        title: 'Trust could be stronger',
        detail: 'I\'d add reviews, a simple guarantee, or proof photos above the fold — local visitors decide on trust first.',
        improve: 'trust_strip',
      });
    }
    if (!flags.leanNav) {
      out.push({
        id: 'lean_nav',
        dimension: 'design',
        severity: 'med',
        title: 'Navigation is crowded',
        detail: 'Fewer nav items help people find Book or Shop faster.',
        improve: 'lean_nav',
      });
    }
    if (!flags.heroSpecific) {
      out.push({
        id: 'hero_copy',
        dimension: 'brand',
        severity: 'med',
        title: 'Hero copy feels generic',
        detail: 'I\'d make the subtitle specific to who you serve and what makes you different.',
        improve: 'hero_specific',
      });
    }
    if (scores.mobile < 90) {
      out.push({
        id: 'mobile',
        dimension: 'mobile',
        severity: 'med',
        title: 'Mobile hierarchy',
        detail: 'On a phone, the CTA and trust line should land without scrolling past noise.',
        improve: 'mobile_cta',
      });
    }
    if (!out.length) {
      out.push({
        id: 'polish',
        dimension: 'design',
        severity: 'low',
        title: 'Small polish available',
        detail: 'Spacing and type hierarchy can still get tighter — Apple-level calm.',
        improve: 'polish_spacing',
      });
    }
    return out.slice(0, 3);
  }

  /** Apply one improvement to live preview object (mutates). */
  function applyImprovement(live, improveId, opts) {
    opts = opts || {};
    live = live || {};
    live.chips = live.chips || [];
    live.nav = live.nav || ['Services', 'About', 'Reviews', 'Book'];
    var biz = opts.biz || live.heroTitle || 'Your business';
    var industry = opts.industry || '';

    if (improveId === 'one_cta' || improveId === 'simplify_cta' || improveId === 'mobile_cta') {
      live.ctaSecondary = null;
      live.cta = live.cta || (opts.cta || 'Book now');
      live.nav = (live.nav || []).filter(function (n) {
        return !/shop|buy|blog|gallery|faq|contact/i.test(n) || /book|review/i.test(n);
      }).slice(0, 4);
      if (live.nav.indexOf('Book') < 0 && live.nav.indexOf('Inquire') < 0) live.nav.push('Book');
      pushChip(live, 'One clear CTA', true);
    }
    if (improveId === 'trust_strip' || improveId === 'add_trust') {
      live.trustBadges = live.trustBadges || ['Licensed & insured', '5★ local reviews', 'Satisfaction guarantee'];
      live.reviews = live.reviews || [
        { quote: 'Showed up on time and the place looked incredible.', who: 'Local customer' },
      ];
      pushChip(live, 'Trust strip', true);
    }
    if (improveId === 'lean_nav') {
      live.nav = ['Services', 'Reviews', 'Book'].slice();
      pushChip(live, 'Lean nav', true);
    }
    if (improveId === 'hero_specific') {
      var area = opts.city || '';
      live.heroSub = area
        ? (industry ? industry + ' in ' + area + ' — clear pricing, easy booking.' : 'Serving ' + area + ' with care you can book today.')
        : (industry ? 'Built for people who want ' + industry.toLowerCase() + ' done right — no runaround.' : 'Clear offer. Real proof. Easy next step.');
      pushChip(live, 'Specific hero', true);
    }
    if (improveId === 'polish_spacing') {
      live.quality = live.quality || {};
      live.quality.spacing = 'premium';
      live.quality.motion = 'subtle';
      pushChip(live, 'Premium spacing', true);
    }
    live.quality = live.quality || {};
    live.quality.lastImprove = improveId;
    live.quality.updatedAt = new Date().toISOString();
    return live;
  }

  function pushChip(live, label, on) {
    if (!live.chips.some(function (c) { return c.label === label; })) {
      live.chips.push({ label: label, on: !!on });
    }
  }

  /** Self-review payload for chat + UI. */
  function selfReview(live, opts) {
    opts = opts || {};
    var report = score(live, opts);
    var top = report.findings[0];
    var lines = report.findings.map(function (f, i) {
      return (i + 1) + '. ' + f.title + ' — ' + f.detail;
    });

    return {
      report: report,
      headline: 'I reviewed your website.',
      intro: top
        ? 'Before we move on… I noticed something. ' + top.detail
        : 'Before we move on… I reviewed what we built.',
      findings: report.findings,
      lines: lines,
      message: [
        'I reviewed your website.',
        '',
        top ? 'Before we move on… I noticed something.' : 'Before we move on…',
        top ? top.detail : lines[0],
        '',
        'Three things that would make it stronger:',
        lines.join('\n'),
        '',
        'I think we can improve ' + labelDim(report.weakest) + ' first.',
      ].join('\n'),
      actions: [
        { id: 'improve', label: 'Improve', improve: top && top.improve },
        { id: 'ignore', label: 'Ignore' },
        { id: 'compare', label: 'Compare' },
      ],
      weakest: report.weakest,
      scores: report.scores,
      overall: report.overall,
    };
  }

  function labelDim(d) {
    return ({
      design: 'Design',
      trust: 'Trust',
      mobile: 'Mobile',
      conversion: 'Conversion',
      brand: 'Brand',
      speed: 'Speed',
    })[d] || d;
  }

  /** HTML for internal score strip + self-review actions (not a public badge wall). */
  function reviewHtml(review) {
    if (!review || !review.scores) return '';
    var scores = review.scores;
    var rows = DIMENSIONS.map(function (k) {
      var v = scores[k];
      var weak = k === review.weakest ? ' is-weak' : '';
      return '<div class="wq-score' + weak + '"><span>' + esc(labelDim(k)) + '</span><strong>' + esc(String(v)) + '</strong></div>';
    }).join('');
    var acts = (review.actions || []).map(function (a) {
      return '<button type="button" class="wq-act" data-wq-act="' + esc(a.id) + '" data-wq-improve="' +
        esc(a.improve || '') + '">' + esc(a.label) + '</button>';
    }).join('');
    return (
      '<div class="wq-review" data-website-quality="1">' +
      '<div class="wq-review-head"><strong>Self Review</strong><em>Internal · Overall ' + esc(String(review.overall)) + '</em></div>' +
      '<div class="wq-scores">' + rows + '</div>' +
      '<p class="wq-intro">' + esc((review.findings[0] && review.findings[0].detail) || review.intro) + '</p>' +
      '<div class="wq-acts">' + acts + '</div></div>'
    );
  }

  /** Premium site mock HTML for Architect / Workspace. */
  function siteHtml(live, opts) {
    opts = opts || {};
    live = live || {};
    var biz = opts.biz || live.heroTitle || 'Your business';
    var theme = String(live.theme || 'minimal');
    var themeClass = theme === 'bold' || theme === 'luxury' ? 'is-bold'
      : theme === 'classic' || theme === 'warm' ? 'is-classic' : 'is-minimal';
    var premium = live.quality && live.quality.spacing === 'premium';
    var nav = (live.nav && live.nav.length ? live.nav : ['Services', 'Reviews', 'About', 'Book'])
      .map(function (n) { return '<span>' + esc(n) + '</span>'; }).join('');
    var pkgs = (live.packages || []).map(function (p) {
      return '<div class="wq-pkg"><strong>' + esc(p.name || p) + '</strong><span>' + esc(p.sub || '') + '</span></div>';
    }).join('');
    var trust = '';
    if (live.trustBadges && live.trustBadges.length) {
      trust += '<div class="wq-trust-badges">' + live.trustBadges.map(function (b) {
        return '<span>' + esc(b) + '</span>';
      }).join('') + '</div>';
    }
    if (live.reviews && live.reviews.length) {
      trust += '<div class="wq-reviews">' + live.reviews.map(function (r) {
        return '<blockquote>“' + esc(r.quote) + '”<cite>' + esc(r.who || '') + '</cite></blockquote>';
      }).join('') + '</div>';
    }
    var cta = esc(live.cta || 'Book now');
    var pointCta = opts.pointTarget === 'cta' ? ' aw-point' : '';
    var pointLogo = opts.pointTarget === 'logo' ? ' aw-point' : '';

    return (
      '<div class="wq-site ' + themeClass + (premium ? ' is-premium' : '') + '" data-wq-site="1">' +
      '<div class="wq-nav"><div class="wq-brand' + pointLogo + '">' + esc(biz) + '</div><div class="wq-links">' + nav + '</div></div>' +
      '<div class="wq-hero">' +
      '<p class="wq-kicker">Built with Hubly</p>' +
      '<h3>' + esc(live.heroTitle || biz) + '</h3>' +
      '<p class="wq-sub">' + esc(live.heroSub || 'Clear offer. Real proof. Easy next step.') + '</p>' +
      '<span class="wq-cta' + pointCta + '" data-aw-node="cta">' + cta + '</span>' +
      '</div>' +
      (trust ? '<div class="wq-trust">' + trust + '</div>' : '') +
      (pkgs ? '<div class="wq-section"><div class="wq-label">Packages</div><div class="wq-pkgs">' + pkgs + '</div></div>' : '') +
      '</div>'
    );
  }

  /** Run self-review on Instant Site creative build + optional auto-prompt. */
  function reviewCreativeBuild(experience) {
    if (!experience || !experience.live) return null;
    var review = selfReview(experience.live, {
      theme: experience.chosenDirection || experience.live.theme,
    });
    experience.quality = review.report;
    experience.selfReview = review;
    return review;
  }

  function handleReviewAction(act, improveId, experience) {
    act = String(act || '');
    if (act === 'ignore') {
      return { ok: true, message: 'Understood — we\'ll leave it for now. You can ask me to review again anytime.' };
    }
    if (act === 'compare') {
      return { ok: true, compare: true, message: 'I\'ll split the workspace so you can compare the current site with the improved version.' };
    }
    if (act === 'improve') {
      var live = (experience && experience.live) || (S()._aw && S()._aw.live) || {};
      applyImprovement(live, improveId || (experience && experience.selfReview && experience.selfReview.actions[0] && experience.selfReview.actions[0].improve) || 'trust_strip', {
        biz: (global.S && global.S.biz) || live.heroTitle,
        industry: experience && experience.industryLabel,
        city: global.S && global.S.city,
      });
      if (experience) {
        experience.live = live;
        experience.selfReview = selfReview(live, { theme: live.theme });
        experience.quality = experience.selfReview.report;
      }
      return {
        ok: true,
        improved: true,
        live: live,
        review: experience && experience.selfReview,
        message: 'Updated. Watch the Live Workspace — then I\'ll re-score so we can keep improving.',
      };
    }
    return { ok: false };
  }

  global.HublyWebsiteQuality = {
    version: '1.0.0',
    DIMENSIONS: DIMENSIONS,
    score: score,
    selfReview: selfReview,
    applyImprovement: applyImprovement,
    reviewHtml: reviewHtml,
    siteHtml: siteHtml,
    reviewCreativeBuild: reviewCreativeBuild,
    handleReviewAction: handleReviewAction,
    labelDim: labelDim,
  };
})(typeof window !== 'undefined' ? window : globalThis);
