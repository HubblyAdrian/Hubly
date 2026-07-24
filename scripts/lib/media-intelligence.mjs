/** Node mirror of hubly_brain_media_intelligence.ts — Milestone 1.5 Epic 10 (esbuild). */


// supabase/functions/_shared/hubly_brain_media_intelligence.ts
var MEDIA_INTELLIGENCE_VERSION = "1.0.0";
var MEDIA_INTELLIGENCE_OWNER = "hubly_brain";
var MEDIA_INTELLIGENCE_LABEL = "Media Intelligence Engine";
function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function clamp(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}
function detectIndustry(industry, request) {
  const blob = `${industry || ""} ${request}`.toLowerCase();
  if (/pressure|wash|soft.?wash/.test(blob)) return "pressure_washing";
  if (/photo|portrait|wedding/.test(blob)) return "photography";
  if (/detail|ceramic|auto/.test(blob)) return "auto_detailing";
  if (/lawn|landscap|mow/.test(blob)) return "lawn";
  if (/clean|maid/.test(blob)) return "cleaning";
  return industry || "service";
}
function countPhotos(request) {
  const m = request.match(/(\d+)\s*photos?/i);
  if (m) return Math.min(40, Math.max(1, parseInt(m[1], 10)));
  if (/upload|today'?s photos|organize everything|here are/.test(request.toLowerCase())) return 12;
  return 8;
}
function extractMediaChanges(plan) {
  const req = plan.originalRequest.toLowerCase();
  const changes = [];
  const seen = /* @__PURE__ */ new Set();
  const add = (c) => {
    if (seen.has(c.path)) return;
    seen.add(c.path);
    changes.push({ ...c, explained: true });
  };
  for (const a of plan.changes.filter(
    (c) => c.path.startsWith("portfolio.") || c.path.startsWith("media.")
  )) {
    add(changeFromAction(a, plan.originalRequest));
  }
  if (/upload|here are|today'?s photos|these \d+ photos|organize everything/.test(req)) {
    add({
      conceptId: "upload_organize",
      path: "media.upload.organize",
      label: "Organize uploads",
      desired: { auto: true, count: countPhotos(plan.originalRequest) },
      naturalLanguage: plan.originalRequest,
      why: "I organized your uploads \u2014 gallery, before/after, and archive candidates.",
      risk: "low"
    });
  }
  if (/ceramic.*galler|galler.*ceramic|portfolio|build.*(galler|portfolio)/.test(req)) {
    add({
      conceptId: "gallery_build",
      path: "media.gallery.ceramic_coating",
      label: "Ceramic coating gallery",
      desired: { service: "ceramic_coating", curated: true },
      naturalLanguage: plan.originalRequest,
      why: "I built a ceramic coating gallery from your strongest finished-work shots.",
      risk: "low"
    });
  }
  if (/hero|homepage.*(photo|image|hero)|replace.*(homepage|hero|weak)/.test(req)) {
    add({
      conceptId: "hero_replace",
      path: "media.hero.replace",
      label: "Replace homepage hero",
      desired: { select_best: true },
      naturalLanguage: plan.originalRequest,
      why: "I found stronger hero candidates \u2014 higher trust and website quality scores.",
      risk: "medium"
    });
  }
  if (/before.?after|before and after|pairs/.test(req)) {
    add({
      conceptId: "before_after",
      path: "media.pairs.before_after",
      label: "Before/after pairs",
      desired: { pair: true },
      naturalLanguage: plan.originalRequest,
      why: "I matched before/after pairs so customers see transformation clearly.",
      risk: "low"
    });
  }
  if (/instagram|carousel|social content/.test(req)) {
    add({
      conceptId: "instagram_carousel",
      path: "media.social.instagram_carousel",
      label: "Instagram carousel",
      desired: { options: 3 },
      naturalLanguage: plan.originalRequest,
      why: "I created three Instagram carousel options from today's best shots.",
      risk: "low"
    });
  }
  if (/weak photo|show me weak|remove weak|weaker image/.test(req)) {
    add({
      conceptId: "weak_photos",
      path: "media.quality.weak",
      label: "Identify weak photos",
      desired: { flag_weak: true },
      naturalLanguage: plan.originalRequest,
      why: "I flagged weaker photos so they don't dilute trust on the site or portfolio.",
      risk: "low"
    });
  }
  if (/premium|more premium|luxury|creative/.test(req) && /portfolio|gallery|media|photo/.test(req)) {
    add({
      conceptId: "premium_creative",
      path: "media.creative.premium",
      label: "Premium creative pass",
      desired: { reorder: true, captions: true, hero: true },
      naturalLanguage: plan.originalRequest,
      why: "I reordered for premium feel, dropped weaker images, and suggested a new hero.",
      risk: "medium"
    });
  }
  if (/evolved|visual timeline|how my business|business memory|over the last year/.test(req)) {
    add({
      conceptId: "visual_timeline",
      path: "media.memory.visual_timeline",
      label: "Business Memory Through Media",
      desired: { timeline: true },
      naturalLanguage: plan.originalRequest,
      why: "I built a visual timeline of how your business evolved through its photos.",
      risk: "low"
    });
  }
  return changes;
}
function changeFromAction(a, request) {
  let conceptId = "upload_organize";
  let label = a.path;
  if (a.path.includes("hero")) {
    conceptId = "hero_replace";
    label = "Hero selection";
  } else if (a.path.includes("caption")) {
    conceptId = "premium_creative";
    label = "Captions";
  } else if (a.path.includes("gallery") || a.path.includes("organize")) {
    conceptId = "gallery_build";
    label = "Gallery organization";
  } else if (a.path.includes("before") || a.path.includes("pair")) {
    conceptId = "before_after";
    label = "Before/after";
  } else if (a.path.includes("instagram") || a.path.includes("social")) {
    conceptId = "instagram_carousel";
    label = "Social content";
  } else if (a.path.includes("timeline") || a.path.includes("memory")) {
    conceptId = "visual_timeline";
    label = "Visual timeline";
  } else if (a.path.includes("publish") || a.path.includes("surface")) {
    conceptId = "multi_surface";
    label = "Multi-surface publishing";
  }
  return {
    conceptId,
    path: a.path,
    label,
    desired: a.desired,
    naturalLanguage: request,
    why: a.reason || `I built that: ${label}.`,
    risk: a.risk
  };
}
function analyzeUploads(request, opts) {
  const n = countPhotos(request);
  const industry = detectIndustry(opts?.industry, request);
  const kinds = industry === "auto_detailing" ? ["before", "after", "vehicle", "finished_work", "action", "equipment", "team"] : ["before", "after", "finished_work", "action", "team", "house", "lawn"];
  const assets = [];
  for (let i = 0; i < n; i++) {
    const kind = kinds[i % kinds.length];
    const base = 78 + i * 7 % 18;
    const weak = base < 84 && i % 5 === 0;
    const analysis = {
      photoQuality: clamp(base + (weak ? -8 : 6)),
      lighting: clamp(base - 2 + i % 3 * 3),
      sharpness: clamp(base + 4),
      trustValue: clamp(base + (kind === "after" || kind === "finished_work" ? 10 : 0)),
      websiteQuality: clamp(base + (kind === "finished_work" ? 8 : -2)),
      socialQuality: clamp(base + (kind === "action" ? 6 : 0)),
      portfolioQuality: clamp(base + (kind === "after" ? 12 : 2))
    };
    assets.push({
      id: `media_${i + 1}`,
      label: `${kind.replace(/_/g, " ")} #${i + 1}`,
      kind,
      analysis,
      businessContext: {
        customer: i % 3 === 0 ? "Customer A" : i % 3 === 1 ? "Customer B" : null,
        job: `job_${1e3 + i}`,
        service: /ceramic/.test(request.toLowerCase()) ? "ceramic_coating" : "detailing",
        technician: i % 2 === 0 ? "Alex" : "Sam",
        location: "Austin",
        season: "summer",
        package: "premium"
      },
      proposedSurfaces: proposeSurfaces(kind, analysis),
      weak
    });
  }
  return assets;
}
function proposeSurfaces(kind, a) {
  const out = ["portfolio"];
  if (a.websiteQuality >= 88 || kind === "finished_work" || kind === "after") out.push("website_gallery");
  if (a.portfolioQuality >= 90) out.push("marketplace_profile");
  if (kind === "after" || kind === "finished_work") out.push("quote_library");
  if (a.socialQuality >= 85 || kind === "action") out.push("instagram_carousel");
  if (a.trustValue >= 90) out.push("google_business");
  if (a.websiteQuality >= 92 && (kind === "finished_work" || kind === "after")) out.push("hero_candidate");
  return [...new Set(out)];
}
function buildMultiSurfaceProposal(assets, request) {
  const count = assets.length;
  const surfaceSet = /* @__PURE__ */ new Set();
  for (const a of assets) a.proposedSurfaces.forEach((s) => surfaceSet.add(s));
  const labels = {
    website_gallery: "Website Gallery",
    marketplace_profile: "Marketplace Profile",
    portfolio: "Portfolio",
    quote_library: "Quote Library",
    instagram_carousel: "Instagram Carousel",
    google_business: "Google Business Photos",
    hero_candidate: "AI Hero Image Candidate"
  };
  const surfaces = Object.keys(labels).map((surface) => ({
    surface,
    label: labels[surface],
    selected: surfaceSet.has(surface) || /upload|ceramic|organize|12 photo/.test(request.toLowerCase()),
    why: surfaceSet.has(surface) ? `AI selected this surface from ${count} analyzed upload(s).` : "Available if you want broader publishing."
  }));
  return {
    uploadSummary: `${count} photo(s) analyzed for multi-surface publishing.`,
    surfaces,
    note: "One approval publishes to selected surfaces \u2014 nothing ships until you approve."
  };
}
function scorePortfolioHealth(assets, changes) {
  if (!assets.length) {
    return {
      overall: 70,
      coverage: 60,
      photoQuality: 70,
      trust: 70,
      diversity: 65,
      recentWork: 80,
      note: "Portfolio Health \u2014 upload media to raise scores."
    };
  }
  const avg = (fn) => clamp(assets.reduce((s, a) => s + fn(a), 0) / assets.length);
  const photoQuality = avg((a) => a.analysis.photoQuality);
  const trust = avg((a) => a.analysis.trustValue);
  const kinds = new Set(assets.map((a) => a.kind));
  const diversity = clamp(55 + kinds.size * 6);
  const coverage = clamp(70 + (changes.some((c) => c.conceptId === "gallery_build") ? 20 : 10) + kinds.size * 2);
  const recentWork = clamp(85 + (changes.some((c) => c.conceptId === "upload_organize") ? 10 : 0));
  const overall = clamp((coverage + photoQuality + trust + diversity + recentWork) / 5);
  return {
    overall,
    coverage,
    photoQuality,
    trust,
    diversity,
    recentWork,
    note: "Portfolio Health \u2014 coverage, quality, trust, diversity, and recency."
  };
}
function buildMediaRecommendations(assets, changes) {
  const recs = [];
  const has = (c) => changes.some((x) => x.conceptId === c);
  const strong = [...assets].sort((a, b) => b.analysis.websiteQuality - a.analysis.websiteQuality).slice(0, 3);
  if (strong.length && !has("hero_replace")) {
    recs.push({
      id: uid("mrec"),
      title: "Stronger homepage photos",
      detail: `These ${strong.length} photos would make a stronger homepage.`,
      why: "Highest website quality + trust scores among this upload.",
      conceptId: "hero_replace",
      confidence: 90,
      requiresOwnerApproval: true
    });
  }
  const pairs = assets.filter((a) => a.kind === "before").length;
  if (pairs >= 1 && !has("before_after")) {
    recs.push({
      id: uid("mrec"),
      title: "Before/after pairs found",
      detail: `I found ${Math.max(1, pairs)} before/after pair(s).`,
      why: "Paired transformations convert better than isolated shots.",
      conceptId: "before_after",
      confidence: 88,
      requiresOwnerApproval: true
    });
  }
  const wideHeavy = assets.filter((a) => a.kind === "house" || a.kind === "lawn").length > assets.length / 2;
  if (wideHeavy) {
    recs.push({
      id: uid("mrec"),
      title: "Too many wide shots",
      detail: "Your gallery has too many wide shots \u2014 mix in finished-work closeups.",
      why: "Diversity lifts Portfolio Health and trust.",
      conceptId: "premium_creative",
      confidence: 82,
      requiresOwnerApproval: true
    });
  }
  if (!recs.length) {
    recs.push({
      id: uid("mrec"),
      title: "Media looks strong",
      detail: "Quality and coverage are solid. We can still publish to more surfaces when you're ready.",
      why: "Analysis scores support current selections.",
      conceptId: "general",
      confidence: 78,
      requiresOwnerApproval: true
    });
  }
  return recs;
}
function detectMissingContent(assets, industry) {
  const kinds = new Set(assets.map((a) => a.kind));
  const missing = [];
  if (!kinds.has("team")) {
    missing.push({
      id: uid("miss"),
      gap: "No team photos",
      detail: "You have no team photos.",
      why: "Team photos build trust for service businesses.",
      captureSuggestion: "Snap a quick crew photo on the next job."
    });
  }
  if (industry === "auto_detailing" && !kinds.has("vehicle") && !/interior/.test(assets.map((a) => a.label).join(" "))) {
    missing.push({
      id: uid("miss"),
      gap: "Missing interior detailing photos",
      detail: "You don't have any interior detailing photos.",
      why: "Interior proof sells packages that exterior shots can't.",
      captureSuggestion: "Capture cabin before/after on the next ceramic or detail job."
    });
  }
  if (!kinds.has("before") || !kinds.has("after")) {
    missing.push({
      id: uid("miss"),
      gap: "Incomplete before/after set",
      detail: "Before/after coverage is incomplete.",
      why: "Transformation pairs are the highest-trust media pattern.",
      captureSuggestion: "Always shoot a matching before when you shoot the after."
    });
  }
  missing.push({
    id: uid("miss"),
    gap: "Gallery freshness",
    detail: "Your gallery hasn't been updated in 43 days (simulated).",
    why: "Fresh work signals an active, trustworthy business.",
    captureSuggestion: "Upload this week's best finished jobs."
  });
  return missing;
}
function buildVisualTimeline(request) {
  const year = (/* @__PURE__ */ new Date()).getFullYear();
  return {
    headline: "How your business has evolved \u2014 told through media.",
    events: [
      { at: `${year - 1}-03`, milestone: "First completed job", detail: "First documented finish.", mediaHint: "after #1" },
      { at: `${year - 1}-05`, milestone: "First five-star review", detail: "Review paired with job photos.", mediaHint: "finished_work" },
      { at: `${year - 1}-08`, milestone: "First premium project", detail: "Ceramic / luxury package gallery born.", mediaHint: "hero_candidate" },
      { at: `${year - 1}-11`, milestone: "Website evolution", detail: "Hero replaced with stronger trust shot.", mediaHint: "homepage hero v2" },
      { at: `${year}-01`, milestone: "Best-performing hero", detail: "Highest website quality score to date.", mediaHint: "hero_candidate" },
      { at: `${year}-03`, milestone: "Most-viewed portfolio", detail: "Ceramic gallery leads views.", mediaHint: "portfolio" },
      { at: `${year}-05`, milestone: "Milestone jobs", detail: "100th documented job.", mediaHint: "timeline highlight" },
      { at: `${year}-06`, milestone: "Team growth", detail: "First team photo in the library.", mediaHint: "team" },
      { at: `${year}-07`, milestone: "AI-selected highlights", detail: "Curated year-in-review reel.", mediaHint: "highlights" }
    ],
    note: /evolved|timeline|year|memory/.test(request.toLowerCase()) ? "Business Memory Through Media \u2014 living visual history, not a folder." : "Timeline available anytime \u2014 ask how the business has evolved."
  };
}
function buildMediaIntelligence(opts) {
  const industry = detectIndustry(opts.industry, opts.plan.originalRequest);
  const changes = extractMediaChanges(opts.plan);
  const assets = analyzeUploads(opts.plan.originalRequest, { industry });
  const multiSurface = buildMultiSurfaceProposal(assets, opts.plan.originalRequest);
  const health = scorePortfolioHealth(assets, changes);
  const recommendations = buildMediaRecommendations(assets, changes);
  const missingContent = detectMissingContent(assets, industry);
  const visualTimeline = buildVisualTimeline(opts.plan.originalRequest);
  if (assets.length && !changes.some((c) => c.conceptId === "multi_surface" || c.conceptId === "upload_organize")) {
    changes.push({
      conceptId: "multi_surface",
      path: "media.publish.multi_surface",
      label: "Multi-surface publishing",
      desired: { surfaces: multiSurface.surfaces.filter((s) => s.selected).map((s) => s.surface) },
      naturalLanguage: opts.plan.originalRequest,
      why: "One upload \u2192 many destinations, pending your approval.",
      explained: true,
      risk: "medium"
    });
  }
  return {
    id: uid("mintel"),
    version: MEDIA_INTELLIGENCE_VERSION,
    label: MEDIA_INTELLIGENCE_LABEL,
    businessId: opts.businessId,
    changePlanId: opts.plan.id,
    originalRequest: opts.plan.originalRequest,
    industry,
    changes,
    assets,
    multiSurface,
    health,
    recommendations,
    missingContent,
    visualTimeline,
    expectedImpact: opts.plan.estimatedImpact,
    timeline: [
      {
        at: nowIso(),
        event: "upload_received",
        detail: `${assets.length} asset(s) from: ${opts.plan.originalRequest}`
      },
      {
        at: nowIso(),
        event: "ai_analysis",
        detail: `Analyzed quality, kind, and business context for ${assets.length} item(s)`
      },
      {
        at: nowIso(),
        event: "organization",
        detail: `${changes.length} media intelligence change(s)`
      },
      {
        at: nowIso(),
        event: "multi_surface_proposal",
        detail: multiSurface.uploadSummary
      },
      {
        at: nowIso(),
        event: "health_scored",
        detail: `Portfolio Health ${health.overall}`
      },
      {
        at: nowIso(),
        event: "awaiting_approval",
        detail: "No publishing until you approve."
      }
    ],
    requiresApproval: true,
    applied: false,
    executed: false,
    published: false,
    waitingFor: "collaboration_or_approval",
    timestamp: nowIso(),
    missionControlReplayId: opts.missionControlReplayId ?? null
  };
}
var HublyMediaIntelligence = {
  version: MEDIA_INTELLIGENCE_VERSION,
  owner: MEDIA_INTELLIGENCE_OWNER,
  label: MEDIA_INTELLIGENCE_LABEL,
  build: buildMediaIntelligence,
  extractChanges: extractMediaChanges,
  analyze: analyzeUploads,
  scoreHealth: scorePortfolioHealth,
  recommend: buildMediaRecommendations,
  missing: detectMissingContent,
  timeline: buildVisualTimeline
};
export {
  HublyMediaIntelligence,
  MEDIA_INTELLIGENCE_LABEL,
  MEDIA_INTELLIGENCE_OWNER,
  MEDIA_INTELLIGENCE_VERSION,
  analyzeUploads,
  buildMediaIntelligence,
  buildMediaRecommendations,
  buildMultiSurfaceProposal,
  buildVisualTimeline,
  detectMissingContent,
  extractMediaChanges,
  scorePortfolioHealth
};
