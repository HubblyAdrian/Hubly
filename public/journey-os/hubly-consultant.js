/**
 * Hubly Consultant — conversation pattern for Building Mode
 *
 * Understand → Recommend → Build → Show → Feedback → Improve → Continue
 *
 * Filter before every feature:
 * "Does this feel like one intelligent business partner, or another software module?"
 */
(function (global) {
  'use strict';

  var PATTERN = Object.freeze([
    'understand',
    'recommend',
    'build',
    'show',
    'feedback',
    'improve',
    'continue',
  ]);

  function S() {
    return global.S || (global.S = {});
  }

  function ensure() {
    var st = S();
    st._consultant = st._consultant || {
      phase: 'understand',
      contextUploads: [],
      lastRecommendation: null,
      lastBuild: null,
    };
    return st._consultant;
  }

  /** Prefer uploads / URL / screenshots over more questions. */
  function encourageContext(phase) {
    var lines = {
      understand: 'If you have a website, screenshot, PDF, logo, Canva, or Figma export — drop it here. That’s faster than answering ten questions.',
      recommend: 'Want a sharper recommendation? Share a site URL or a screenshot of a brand you love.',
      build: 'Uploading a logo or menu PDF lets me build from your real materials.',
      improve: 'Paste a screenshot of what feels off — I’ll point at the workspace and fix it.',
    };
    return lines[phase] || lines.understand;
  }

  /**
   * Decide if discovery should skip the questionnaire and enter Building Mode.
   * Rule: never ask multiple setup questions before showing progress.
   */
  function shouldSkipQuestionnaire(discoverySession) {
    if (!discoverySession) return false;
    var facts = discoverySession.facts || {};
    var hasIndustry = !!(facts.industry && facts.industry.confidence >= 70);
    var seed = String(discoverySession.seed || '').trim();
    var richSeed = seed.length >= 24 && hasIndustry;
    var overall = 0;
    try {
      var keys = ['industry', 'customer', 'goal', 'area', 'stage'];
      var scores = keys.map(function (k) {
        return Number(facts[k] && facts[k].confidence) || 0;
      }).filter(function (n) { return n > 0; });
      if (scores.length) {
        overall = Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length);
      }
    } catch (e) {}
    return richSeed || overall >= 72 || (hasIndustry && seed.length >= 12);
  }

  function firstRecommendation(discoverySession) {
    var ind = (discoverySession && discoverySession.facts && discoverySession.facts.industry && discoverySession.facts.industry.value) || 'your business';
    var goal = discoverySession && discoverySession.facts && discoverySession.facts.goal && discoverySession.facts.goal.value;
    var choice = 'Build your website first';
    var reasoning = 'A clear site with an obvious book path is the fastest way for local customers to trust and hire you.';
    var confidence = 91;
    if (goal === 'more_bookings' || goal === 'recurring_customers') {
      choice = 'Lead with booking on the homepage';
      reasoning = 'Your goal is customers — trust plus a booking CTA above the fold converts faster than a long brochure.';
      confidence = 94;
    } else if (goal === 'build_brand') {
      choice = 'Start with brand direction, then the homepage';
      reasoning = 'Brand-first presence makes every later page feel intentional — especially for premium local work.';
      confidence = 90;
    }
    return {
      choice: choice,
      confidence: confidence,
      reasoning: reasoning,
      industry: ind,
      nextSurface: 'website',
      message: 'I understand ' + ind + '. I recommend we ' + choice.toLowerCase() + ' — then you’ll see it in the Live Workspace. ' + reasoning,
    };
  }

  function setPhase(phase) {
    ensure().phase = PATTERN.indexOf(phase) >= 0 ? phase : 'understand';
    return ensure().phase;
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Build website / creative brief from upload or text via OpenAI (HublyAI edge).
   * Production-First: fails honestly when provider is not configured.
   */
  async function buildFromContext(opts) {
    opts = opts || {};
    var st = S();
    var bizId = (global.currentBusiness && global.currentBusiness.id) || st.businessId || opts.businessId || null;
    var db = global.db || (global.HublySupabase && global.HublySupabase.client) || null;
    if (!db || typeof db.functions === 'undefined' || typeof db.functions.invoke !== 'function') {
      return {
        ok: false,
        error: 'not_configured',
        message: 'Provider not configured — Hubly can’t call AI until Supabase + OpenAI keys exist.',
      };
    }

    var inspiration = opts.inspirationImage || null;
    var ownerMessage = String(opts.message || opts.prompt || '').trim();
    var files = opts.files || [];

    if (!inspiration && files.length) {
      var img = files.find(function (f) { return /^image\//.test(f.type || ''); });
      if (img) {
        try { inspiration = await fileToDataUrl(img); } catch (e) {}
      }
    }

    ensure().contextUploads = (ensure().contextUploads || []).concat(
      (files || []).map(function (f) { return f.name; })
    );

    setPhase('build');

    /* Prefer creative-director when we have a visual; generate-site when we have a business id + facts */
    if (inspiration) {
      try {
        var cd = await db.functions.invoke('creative-director', {
          body: {
            business_id: bizId,
            owner_message: ownerMessage || 'Rebuild the homepage from this inspiration. Recommend layout, colors, and CTA placement. Return concrete changes.',
            inspiration_image: inspiration,
            surface: opts.surface || 'website',
          },
        });
        if (cd.error || (cd.data && cd.data.error)) {
          var msg = (cd.data && cd.data.error) || (cd.error && cd.error.message) || 'AI unavailable';
          if (/not configured|API_KEY|isn't configured/i.test(String(msg))) {
            return { ok: false, error: 'not_configured', message: 'Provider not configured' };
          }
          return { ok: false, error: 'ai_failed', message: String(msg) };
        }
        setPhase('show');
        ensure().lastBuild = { kind: 'creative_director', data: cd.data };
        return { ok: true, kind: 'creative_director', data: cd.data };
      } catch (e) {
        return { ok: false, error: 'ai_failed', message: String(e && e.message || e) };
      }
    }

    if (bizId) {
      try {
        var gs = await db.functions.invoke('generate-site', {
          body: {
            business_id: bizId,
            business_name: st.biz || opts.businessName || 'Your Business',
            description: ownerMessage || st.about || st.tag || '',
            service_area_cities: st.serviceAreaCities || (st.city ? [st.city] : []),
            business_type: st.businessType || null,
            context_notes: ownerMessage,
            inspiration_image: inspiration || undefined,
            blueprint: (typeof global.HublyBlueprints !== 'undefined' && global.HublyBlueprints.aiGuidance)
              ? global.HublyBlueprints.aiGuidance(st.businessType)
              : null,
          },
        });
        if (gs.error || (gs.data && gs.data.error)) {
          var gmsg = (gs.data && gs.data.error) || (gs.error && gs.error.message) || 'AI unavailable';
          if (/not configured|API_KEY|isn't configured/i.test(String(gmsg))) {
            return { ok: false, error: 'not_configured', message: 'Provider not configured' };
          }
          return { ok: false, error: 'ai_failed', message: String(gmsg) };
        }
        setPhase('show');
        ensure().lastBuild = { kind: 'generate_site', data: gs.data };
        return { ok: true, kind: 'generate_site', data: gs.data };
      } catch (e2) {
        return { ok: false, error: 'ai_failed', message: String(e2 && e2.message || e2) };
      }
    }

    return {
      ok: false,
      error: 'need_context',
      message: 'Share a screenshot, logo, PDF, or website — or keep talking and I’ll build as soon as we have a business to attach it to.',
    };
  }

  global.HublyConsultant = {
    version: '1.0.0',
    pattern: PATTERN,
    ensure: ensure,
    setPhase: setPhase,
    shouldSkipQuestionnaire: shouldSkipQuestionnaire,
    firstRecommendation: firstRecommendation,
    encourageContext: encourageContext,
    buildFromContext: buildFromContext,
    fileToDataUrl: fileToDataUrl,
  };
})(typeof window !== 'undefined' ? window : globalThis);
