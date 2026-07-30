/**
 * Hubly Studio — creative OS (replaces Operate Marketing tab).
 * Screens: Home · AI Creator · Projects · Templates · Brand Kit · Publish · Analytics
 * Project Workspace (not a canvas editor) — Canva owns visual editing via Customize Design.
 * Campaign Engine is the marketing brain; AI writes from structured plans.
 */
(function (global) {
  'use strict';

  var NAV = [
    ['home', 'Home', '⌂'],
    ['ai', 'AI Creator', '✦', true],
    ['projects', 'Projects', '▦'],
    ['templates', 'Templates', '▤'],
    ['photos', 'Photos', '▣'],
    ['brand', 'Brand Kit', '◉'],
    ['elements', 'Elements', '◇'],
    ['uploads', 'Uploads', '☁'],
    ['publish', 'Publish', '✈'],
    ['analytics', 'Analytics', '◔'],
    ['settings', 'Studio Settings', '⚙']
  ];

  var BLANK_FORMATS = [
    { id: 'instagram_post', label: 'Instagram Post', size: '1080×1080', tone: 'ig' },
    { id: 'facebook_post', label: 'Facebook Post', size: '1200×630', tone: 'fb' },
    { id: 'instagram_story', label: 'Story', size: '1080×1920', tone: 'story' },
    { id: 'print_flyer', label: 'Flyer', size: '8.5×11', tone: 'print' },
    { id: 'google_business', label: 'Google Business', size: '720×720', tone: 'gmb' },
    { id: 'email_header', label: 'Email Header', size: '600×200', tone: 'email' }
  ];

  var CAMPAIGN_GOALS = [
    { id: 'get_more_reviews', title: 'Get More Reviews', sub: 'Turn happy jobs into public social proof.' },
    { id: 'fill_tomorrow_schedule', title: "Fill Tomorrow's Schedule", sub: 'Convert open capacity into booked jobs.' },
    { id: 'promote_service', title: 'Promote Ceramic Coatings', sub: 'Or any featured service — Hubly builds the package.' },
    { id: 'win_back_customers', title: 'Win Back Old Customers', sub: 'Re-engage past customers who went quiet.' },
    { id: 'seasonal_promotion', title: 'Seasonal Promotion', sub: 'Calendar-timed campaigns for your trade.' },
    { id: 'membership_drive', title: 'Membership Drive', sub: 'Grow recurring plans and maintenance memberships.' }
  ];

  var AI_OBJECTIVES = [
    { id: 'carousel', title: 'Carousel from Job Photos', sub: 'Turn raw photos of your install into a sequence post.' },
    { id: 'before_after', title: 'Before/After Job Highlight', sub: 'Perfect comparison layout with review citation.' },
    { id: 'referral', title: 'Referral Campaign Poster', sub: 'Generate a print-ready poster encouraging word of mouth.' },
    { id: 'gmb', title: 'Google Business Update', sub: 'Optimized update with map photo placement.' },
    { id: 'review', title: 'Review Spotlight Post', sub: 'Highlight a fresh 5-star customer review.' }
  ];

  var GOAL_TO_PLAYBOOK = {
    get_more_reviews: 'dt_review_spotlight',
    fill_tomorrow_schedule: 'dt_fill_schedule',
    promote_service: 'dt_ceramic',
    win_back_customers: 'dt_win_back',
    seasonal_promotion: 'dt_seasonal',
    membership_drive: 'hs_membership',
    book_more_jobs: 'dt_before_after',
    referral: 'hs_referral'
  };

  var V1_CHANNEL = 'email';

  function el(id) { return document.getElementById(id); }
  function S() { return global.S || {}; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function toast(msg) {
    if (typeof global.toast === 'function') return global.toast(msg);
    try { console.log('[Hubly Studio]', msg); } catch (e) {}
  }
  function api() { return global.HublyStudioApi; }

  function ensureStudioOs() {
    var st = S();
    if (!st.studioOs || typeof st.studioOs !== 'object') st.studioOs = {};
    var os = st.studioOs;
    if (!Array.isArray(os.projects)) os.projects = [];
    if (!Array.isArray(os.queue)) os.queue = [];
    if (!Array.isArray(os.assets)) os.assets = [];
    if (!os.settings || typeof os.settings !== 'object') {
      os.settings = {
        enabled: true,
        storage_used_bytes: 0,
        storage_quota_bytes: 10737418240,
        canva_linked: false
      };
    }
    if (!os.ui || typeof os.ui !== 'object') os.ui = { screen: 'home', editorTool: 'ai', editorProjectId: null };
    if (!os.elements || typeof os.elements !== 'object') os.elements = { favorites: [], cat: 'all' };
    if (!Array.isArray(os.elements.favorites)) os.elements.favorites = [];
    return os;
  }

  /** Persist studioOs into business.meta only — never call saveStorefront (that opens Website editor). */
  function persistStudioMeta() {
    try {
      clearTimeout(persistStudioMeta._t);
      persistStudioMeta._t = setTimeout(function () {
        try {
          var biz = global.currentBusiness;
          var db = global.db;
          if (!biz || !biz.id || !db || typeof global.buildBizMeta !== 'function') return;
          var meta = global.buildBizMeta();
          db.from('businesses').update({ meta: meta }).eq('id', biz.id).then(function (res) {
            if (!res || res.error) return;
            biz.meta = meta;
          }).catch(function () {});
        } catch (e) {}
      }, 450);
    } catch (e) {}
  }

  function leaveStudio() {
    try {
      var os = ensureStudioOs();
      if (os.ui) {
        os.ui.screen = 'home';
        os.ui.editorProjectId = null;
      }
    } catch (e) {}
    try { setMode(false); } catch (e) {}
    try {
      if (typeof global.switchV === 'function') {
        var dash = document.querySelector('[data-v="dashboard"]');
        if (dash) {
          global.switchV(dash);
          return;
        }
      }
    } catch (e) {}
    try { setMode(false); } catch (e2) {}
  }

  /** Factual business inputs for Campaign Engine (Memory / storefront — not DNA). */
  function bizContext() {
    var st = S();
    var website = st.website || {};
    var services = [];
    try {
      var cat = st.service_catalog || website.service_catalog || st.services || [];
      if (Array.isArray(cat)) {
        services = cat.map(function (s) {
          return (s && (s.name || s.title || s.label)) || '';
        }).filter(Boolean).slice(0, 12);
      }
    } catch (e) {}
    var review = null;
    try {
      var list = [];
      if (st.reviewsOs && Array.isArray(st.reviewsOs.reviews)) list = st.reviewsOs.reviews;
      else if (Array.isArray(website.manualReviews)) list = website.manualReviews;
      else if (Array.isArray(st.manualReviews)) list = st.manualReviews;
      var withQuote = list.filter(function (r) { return r && (r.quote || r.text || r.body); });
      if (withQuote.length) {
        var r = withQuote[0];
        review = {
          stars: Number(r.stars || r.rating || 5) || 5,
          quote: String(r.quote || r.text || r.body || '').trim(),
          author: String(r.author || r.customer_name || r.name || 'Customer').trim()
        };
      }
    } catch (e) {}
    var jobsList = [];
    try {
      jobsList = typeof global.jobs === 'function' ? global.jobs() : (st.jobs || []);
    } catch (e) {}
    var completed = (jobsList || []).filter(function (j) { return j && j.status === 'completed'; }).length;
    return {
      business_name: bizName(),
      phone: st.phone || '',
      city: st.city || '',
      services: services,
      service_focus: services[0] || null,
      latest_review: review,
      has_logo: !!(st.logoUrl || st.logo_url),
      job_photos_count: Array.isArray(st.portfolio) ? st.portfolio.length : (st.job_photos_count || 0),
      has_before_after: Array.isArray(st.portfolio) ? st.portfolio.length >= 2 : false,
      completed_jobs_week: completed || 0,
      has_membership: !!(st.membershipsOs || st.memberships)
    };
  }

  function reviewLine(project) {
    var pkg = (project && project.canvas && project.canvas.package) || {};
    var brief = (project && project.canvas && project.canvas.brief) || (project && project.brief) || {};
    var fromPkg = pkg.review || null;
    var fromBrief = brief.review_text || (brief.assets && brief.assets.review) || null;
    var ctx = bizContext().latest_review;
    var quote = (fromPkg && fromPkg.quote) || fromBrief || (ctx && ctx.quote) || '';
    var author = (fromPkg && fromPkg.author) || (ctx && ctx.author) || 'Customer';
    var stars = (fromPkg && fromPkg.stars) || (ctx && ctx.stars) || 5;
    if (!quote) {
      quote = 'Great experience with ' + bizName() + ' — highly recommend.';
      author = 'Happy customer';
    }
    return { stars: stars, quote: quote, author: author };
  }

  function currentProject() {
    var os = ensureStudioOs();
    return (os.projects || []).find(function (p) { return p.id === os.ui.editorProjectId; }) || null;
  }

  function refreshWorkspace(opts) {
    opts = opts || {};
    var root = ownRoot();
    if (!root) return;
    setMode(true);
    var os = ensureStudioOs();
    os.ui.screen = 'editor';
    if (opts.tab) os.ui.workspaceTab = opts.tab;
    if (opts.page) os.ui.workspacePage = opts.page;
    renderEditor(root, currentProject());
    wireRoot(root);
  }

  function ownRoot() {
    var host = el('v-studio') || el('v-marketing');
    var root = el('jos-studio-root') || el('jos-marketing-root');
    if (!root && host) {
      root = document.createElement('div');
      root.id = 'jos-studio-root';
      host.innerHTML = '';
      host.appendChild(root);
    }
    return root;
  }

  function setMode(on) {
    var app = el('p-app');
    if (!app) return;
    app.classList.toggle('jos-studio-mode', !!on);
    app.classList.toggle('jos-marketing-mode', !!on); // keep legacy chrome hooks
  }

  function bizName() {
    return S().biz || S().businessName || 'Your business';
  }
  function ownerFirst() {
    var n = S().ownerName || S().ownerFirst || '';
    if (!n && S().biz) n = String(S().biz).split(/\s+/)[0];
    if (n.indexOf(' ') > -1) n = n.split(' ')[0];
    return n || 'there';
  }
  function initials() {
    var a = ownerFirst().charAt(0) || 'H';
    var b = (bizName().replace(/^the\s+/i, '').charAt(0) || 'B');
    return (a + b).toUpperCase();
  }

  function gb(n) {
    var v = Number(n) || 0;
    return (v / 1073741824).toFixed(1);
  }

  function relativeEdit(iso) {
    if (!iso) return 'Just now';
    var t = new Date(iso).getTime();
    if (isNaN(t)) return 'Recently';
    var h = Math.round((Date.now() - t) / 3600000);
    if (h < 1) return 'Edited just now';
    if (h < 24) return 'Edited ' + h + ' hour' + (h === 1 ? '' : 's') + ' ago';
    var d = Math.round(h / 24);
    return 'Edited ' + d + ' day' + (d === 1 ? '' : 's') + ' ago';
  }

  function shell(active, bodyHtml) {
    var os = ensureStudioOs();
    var settings = os.settings || {};
    var used = gb(settings.storage_used_bytes || 0);
    var quota = gb(settings.storage_quota_bytes || 10737418240);
    var pct = Math.min(100, Math.round(((settings.storage_used_bytes || 0) / (settings.storage_quota_bytes || 1)) * 100));
    var nav = NAV.map(function (n) {
      var on = n[0] === active ? ' on' : '';
      var badge = n[3] ? '<span class="hs-nav-new">NEW</span>' : '';
      return '<button type="button" class="hs-nav-item' + on + '" data-hs-act="nav" data-hs-screen="' + n[0] + '">' +
        '<span class="hs-nav-ico" aria-hidden="true">' + n[2] + '</span>' +
        '<span class="hs-nav-lbl">' + esc(n[1]) + '</span>' + badge +
        '</button>';
    }).join('');

    return '<div class="hs-shell">' +
      '<header class="hs-mobile-bar" aria-label="Studio mobile navigation">' +
      '<button type="button" class="hs-mobile-menu" data-hs-act="toggle-nav" aria-label="Open Studio menu" aria-expanded="false">' +
      '<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span></button>' +
      '<div class="hs-mobile-brand"><strong>Studio</strong> <span>by <span class="hs-wm-hub">hub</span><span class="hs-wm-ly">ly</span></span></div>' +
      '<button type="button" class="hs-mobile-leave" data-hs-act="leave-studio" aria-label="Back to Hubly">← Hubly</button>' +
      '</header>' +
      '<button type="button" class="hs-nav-backdrop" data-hs-act="close-nav" aria-label="Close Studio menu" tabindex="-1"></button>' +
      '<aside class="hs-sidebar" id="hs-sidebar" aria-label="Studio navigation">' +
      '<button type="button" class="hs-back-hubly" data-hs-act="leave-studio" aria-label="Back to Hubly">' +
      '<span aria-hidden="true">←</span> Back to Hubly</button>' +
      '<div class="hs-brand">' +
      '<div class="hs-brand-mark">H</div>' +
      '<div class="hs-brand-txt"><strong>Studio</strong><span>BY <span class="hs-wm-hub">hub</span><span class="hs-wm-ly">ly</span></span></div>' +
      '</div>' +
      '<nav class="hs-nav">' + nav + '</nav>' +
      '<div class="hs-sidebar-foot">' +
      '<div class="hs-storage"><span>Cloud Storage</span><strong>' + used + ' / ' + quota + ' GB</strong>' +
      '<div class="hs-storage-bar"><i style="width:' + pct + '%"></i></div></div>' +
      '<button type="button" class="hs-canva-badge" data-hs-act="nav" data-hs-screen="settings">' +
      (ensureStudioOs().settings && ensureStudioOs().settings.canva_linked ? 'Canva connected' : 'Connect Canva') +
      '</button>' +
      '<button type="button" class="hs-user" data-hs-act="go-settings">' +
      '<span class="hs-avatar">' + esc(initials()) + '</span>' +
      '<span class="hs-user-meta"><strong>' + esc(ownerFirst()) + ' · ' + esc(bizName().split(/\s+/).slice(0, 2).join(' ')) + '</strong>' +
      '<span>' + esc(bizName()) + '</span></span></button>' +
      '</div></aside>' +
      '<main class="hs-main">' + bodyHtml + '</main>' +
      '</div>';
  }

  function closeStudioNav(root) {
    var shellEl = (root || ownRoot()) && (root || ownRoot()).querySelector('.hs-shell');
    if (!shellEl) return;
    shellEl.classList.remove('hs-nav-open');
    var btn = shellEl.querySelector('.hs-mobile-menu');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function toggleStudioNav(root) {
    var shellEl = root && root.querySelector('.hs-shell');
    if (!shellEl) return;
    var open = shellEl.classList.toggle('hs-nav-open');
    var btn = shellEl.querySelector('.hs-mobile-menu');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function renderHome(root) {
    var os = ensureStudioOs();
    var hour = new Date().getHours();
    var greet = hour < 12 ? 'Good morning' : (hour < 17 ? 'Good afternoon' : 'Good evening');
    var completedYest = (typeof global.jobs === 'function' ? global.jobs() : (S().jobs || []))
      .filter(function (j) { return j && j.status === 'completed'; }).length;
    if (!completedYest) completedYest = 4;

    var formats = BLANK_FORMATS.map(function (f) {
      return '<button type="button" class="hs-blank-card" data-hs-act="blank" data-hs-format="' + f.id + '">' +
        '<span class="hs-blank-ico tone-' + f.tone + '"></span>' +
        '<strong>' + esc(f.label) + '</strong>' +
        '<span>' + esc(f.size) + '</span></button>';
    }).join('');

    var recent = (os.projects || []).slice(0, 4);
    if (!recent.length) {
      recent = [
        { id: 'demo1', title: 'Ceramic Coating Spotlight', format_primary: 'instagram_post', last_edited_at: new Date(Date.now() - 7200000).toISOString(), _placeholder: true },
        { id: 'demo2', title: 'Before/After: Full Detail', format_primary: 'instagram_post', last_edited_at: new Date(Date.now() - 86400000).toISOString(), _placeholder: true }
      ];
    }
    var recentHtml = recent.map(function (p) {
      return '<button type="button" class="hs-recent-row" data-hs-act="open-project" data-hs-id="' + esc(p.id) + '"' + (p._placeholder ? ' data-hs-placeholder="1"' : '') + '>' +
        '<span class="hs-recent-thumb"></span>' +
        '<span class="hs-recent-meta"><strong>' + esc(p.title) + '</strong><span>' + esc((p.format_primary || '').replace(/_/g, ' ')) + ' · ' + esc(relativeEdit(p.last_edited_at)) + '</span></span>' +
        '<span class="hs-meatball" aria-hidden="true">⋯</span></button>';
    }).join('');

    var queue = (os.queue || []).slice(0, 4);
    var queueHtml = queue.length
      ? queue.map(function (q) {
        var st = q.status === 'published' ? 'ready' : (q.status === 'ready' ? 'ready' : 'draft');
        return '<div class="hs-queue-row">' +
          '<div><strong>' + esc(q.scheduled_at || 'Unscheduled') + '</strong> <span class="hs-pill ' + st + '">' + esc(q.status || 'draft') + '</span>' +
          '<p>' + esc(q.title || q.caption || 'Email campaign') + '</p></div></div>';
      }).join('')
      : '<div class="hs-queue-row"><div><strong>Queue empty</strong><p class="hs-muted">Publish a campaign by email — nothing is faked here.</p>' +
        '<button type="button" class="hs-link" data-hs-act="nav" data-hs-screen="publish">Open Publish →</button></div></div>';

    var recsMount = '<div id="hs-rec-mount" class="hs-rec-row"><div class="hs-muted">Loading recommendations…</div></div>';

    var body =
      '<header class="hs-page-head">' +
      '<div><h1>' + esc(greet) + ', ' + esc(ownerFirst()) + '.</h1>' +
      '<p>You completed ' + completedYest + ' jobs recently. Pick a recommendation — generate, optionally polish visuals, publish by email.</p></div>' +
      '</header>' +
      '<div class="hs-ai-search">' +
      '<input type="text" id="hs-home-prompt" placeholder="What will you create today? Or pick a recommendation below…">' +
      '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="ai-draft">+ Generate Campaign</button>' +
      '</div>' +
      '<section class="hs-section"><h2><span class="hs-spark">✦</span> Recommended for you</h2>' +
      '<p class="hs-muted hs-section-sub">Based on Hubly jobs, reviews, photos, and posting cadence — not external data.</p>' +
      recsMount + '</section>' +
      '<section class="hs-section"><h2>Start from a blank canvas</h2>' +
      '<div class="hs-blank-row">' + formats + '</div></section>' +
      '<div class="hs-home-split">' +
      '<section class="hs-section"><h2>Recent Projects</h2><div class="hs-card">' + recentHtml + '</div></section>' +
      '<section class="hs-section"><h2>Email Publish Queue</h2><div class="hs-card">' + queueHtml + '</div></section>' +
      '</div>';

    root.innerHTML = shell('home', body);
    var mount = root.querySelector('#hs-rec-mount');
    var Api = api();
    function paintRecs(list) {
      if (!mount) return;
      var rows = (list && list.length) ? list : [
        { title: 'Review Spotlight', reason: 'New 5-star review ready', playbook_id: 'dt_review_spotlight', goal_id: 'get_more_reviews' },
        { title: 'Before & After Reveal', reason: 'Job photos available', playbook_id: 'dt_before_after', goal_id: 'book_more_jobs' },
        { title: 'Promote Ceramic Coatings', reason: 'Service in your catalog', playbook_id: 'dt_ceramic', goal_id: 'promote_service' }
      ];
      mount.innerHTML = rows.slice(0, 3).map(function (r) {
        return '<article class="hs-rec-card">' +
          '<div class="hs-rec-media tone-referral"></div>' +
          '<div class="hs-rec-body"><strong>' + esc(r.title) + '</strong><span>' + esc(r.reason || 'Recommended') + ' · Email</span>' +
          '<button type="button" class="hs-link" data-hs-act="campaign-goal" data-hs-goal="' + esc(r.goal_id || '') + '" data-hs-playbook="' + esc(r.playbook_id || '') + '">Generate →</button></div></article>';
      }).join('');
    }
    if (Api) {
      Api.request('recommend', { method: 'GET' }).then(function (res) {
        paintRecs((res && (res.recommendations || res.suggestions)) || []);
      }).catch(function () { paintRecs([]); });
    } else paintRecs([]);
  }

  function renderAiCreator(root) {
    var goals = CAMPAIGN_GOALS.map(function (o) {
      return '<button type="button" class="hs-obj-card hs-goal-card" data-hs-act="campaign-goal" data-hs-goal="' + o.id + '">' +
        '<strong>' + esc(o.title) + '</strong><span>' + esc(o.sub) + '</span><span class="hs-obj-arrow">↗</span></button>';
    }).join('');

    var objectives = AI_OBJECTIVES.map(function (o) {
      return '<button type="button" class="hs-obj-card" data-hs-act="objective" data-hs-obj="' + o.id + '">' +
        '<strong>' + esc(o.title) + '</strong><span>' + esc(o.sub) + '</span><span class="hs-obj-arrow">↗</span></button>';
    }).join('');

    var body =
      '<header class="hs-page-head hs-page-head-row">' +
      '<div><h1>AI Creative Partner</h1>' +
      '<p>Pick a campaign goal — Hubly builds the full package. Visual polish is optional.</p></div>' +
      '<div class="hs-head-actions">' +
      '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="studio-guide">? Studio Guide</button>' +
      '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="blank" data-hs-format="instagram_post">+ Create Custom</button>' +
      '</div></header>' +
      '<section class="hs-section"><h2><span class="hs-spark">✦</span> Start with a campaign goal</h2>' +
      '<p class="hs-muted hs-section-sub">Hubly is the marketing brain. You get graphics, captions, email, SMS, Google Business, and schedule ideas — then customize visuals if you want.</p>' +
      '<div class="hs-obj-row">' + goals + '</div></section>' +
      '<div class="hs-ai-layout">' +
      '<div class="hs-ai-prompt-card">' +
      '<div class="hs-ai-active"><span class="hs-spark">✦</span> ' + esc(bizName()) + ' AI assistant active</div>' +
      '<textarea id="hs-ai-prompt" rows="4">Create an Instagram Post showcasing our latest completed job, highlighted with a 5-star review.</textarea>' +
      '<div class="hs-ai-prompt-foot">' +
      '<div class="hs-attach-pills"><span>2 Job Photos Attached</span><span>★ 5-Star Review Linked</span></div>' +
      '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="generate-layout">✦ Generate Campaign</button>' +
      '</div></div>' +
      '<aside class="hs-ai-settings">' +
      '<h3>AI Settings</h3>' +
      '<div class="hs-setting-block"><span class="hs-lbl">Active Brand Profile</span>' +
      '<div class="hs-brand-pill"><span class="hs-dot"></span> ' + esc(bizName()) + '</div></div>' +
      '<div class="hs-setting-block"><span class="hs-lbl">Target Platform</span><div class="hs-pills" data-hs-group="platform">' +
      [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['google_maps', 'Google Maps'], ['print', 'Print Flyer']].map(function (p, i) {
        return '<button type="button" class="hs-pill-tog' + (i === 0 ? ' on' : '') + '" data-hs-act="set-platform" data-val="' + p[0] + '">' + p[1] + '</button>';
      }).join('') + '</div></div>' +
      '<div class="hs-setting-block"><span class="hs-lbl">Creative Style</span><div class="hs-pills">' +
      [['professional', 'Professional'], ['bold', 'Bold'], ['minimalist', 'Minimalist'], ['luxury', 'Luxury']].map(function (p, i) {
        return '<button type="button" class="hs-pill-tog' + (i === 1 ? ' on' : '') + '" data-hs-act="set-style" data-val="' + p[0] + '">' + p[1] + '</button>';
      }).join('') + '</div></div>' +
      '<div class="hs-setting-block"><span class="hs-lbl">Copywriting Tone</span><div class="hs-pills">' +
      [['helpful', 'Helpful'], ['energetic', 'Energetic'], ['friendly', 'Friendly'], ['expert', 'Expert']].map(function (p, i) {
        return '<button type="button" class="hs-pill-tog' + (i === 3 ? ' on' : '') + '" data-hs-act="set-tone" data-val="' + p[0] + '">' + p[1] + '</button>';
      }).join('') + '</div></div>' +
      '</aside></div>' +
      '<section class="hs-section"><h2>Or choose a suggested objective</h2>' +
      '<div class="hs-obj-row">' + objectives + '</div></section>';

    root.innerHTML = shell('ai', body);
  }

  function renderTemplates(root) {
    var Api = api();
    var body =
      '<header class="hs-page-head hs-page-head-row">' +
      '<div><h1>Template Gallery</h1>' +
      '<p>Hubly templates for home services, plus AI campaigns. Prefer goals in AI Creator over browsing.</p></div>' +
      '<div class="hs-head-actions">' +
      '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="nav" data-hs-screen="ai">✦ Campaign Goals</button>' +
      '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="blank" data-hs-format="instagram_post">+ Create Custom</button>' +
      '</div></header>' +
      '<div class="hs-tpl-sources">' +
      '<button type="button" class="hs-cat on" data-hs-act="tpl-source" data-hs-source="hubly">Hubly Templates</button>' +
      '<button type="button" class="hs-cat" data-hs-act="tpl-source" data-hs-source="ai">AI Generated Campaigns</button>' +
      '<button type="button" class="hs-cat" data-hs-act="tpl-source" data-hs-source="canva">Design Library</button>' +
      '</div>' +
      '<div class="hs-search-bar">' +
      '<input type="search" id="hs-tpl-search" placeholder="Search templates (e.g. clogged drain, spring promotion)…">' +
      '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="tpl-filters">Filters</button></div>' +
      '<div class="hs-cat-pills">' +
      ['All Designs', 'Before & After', 'Review Highlight', 'Membership', 'Holiday', 'Referral', 'Seasonal'].map(function (c, i) {
        return '<button type="button" class="hs-cat' + (i === 0 ? ' on' : '') + '" data-hs-act="tpl-cat">' + esc(c) + '</button>';
      }).join('') + '</div>' +
      '<div id="hs-tpl-mount" class="hs-tpl-mount"><div class="hs-muted">Loading templates…</div></div>';

    root.innerHTML = shell('templates', body);
    var mount = root.querySelector('#hs-tpl-mount');
    function paint(templates, sources) {
      sources = sources || {};
      var featured = (templates || []).filter(function (t) { return t.featured; });
      var rest = (templates || []).filter(function (t) { return !t.featured; });
      var canvaNote = sources.canva
        ? ''
        : '<p class="hs-muted hs-tiny">Design library templates connect when your creative engine is linked — Hubly templates work now.</p>';
      mount.innerHTML =
        '<section class="hs-section"><h2>Featured Hubly layouts</h2>' + canvaNote +
        '<div class="hs-tpl-grid">' + (featured.length ? featured : templates).slice(0, 6).map(function (t) {
          return '<button type="button" class="hs-tpl-card" data-hs-act="use-template" data-hs-id="' + esc(t.id) + '" data-hs-title="' + esc(t.title) + '" data-hs-format="' + esc(t.format || 'instagram_post') + '">' +
            '<div class="hs-tpl-thumb"></div><strong>' + esc(t.title) + '</strong><span>' + esc((t.format || t.category || t.source || '').replace(/_/g, ' ')) + '</span></button>';
        }).join('') + '</div></section>' +
        '<section class="hs-section"><h2>Complete Library</h2>' +
        '<div class="hs-tpl-wide">' + (rest.length ? rest : templates).slice(0, 6).map(function (t) {
          return '<button type="button" class="hs-tpl-wide-card" data-hs-act="use-template" data-hs-id="' + esc(t.id) + '" data-hs-title="' + esc(t.title) + '" data-hs-format="' + esc(t.format || 'instagram_post') + '">' +
            '<div class="hs-tpl-thumb wide"></div><strong>' + esc(t.title) + '</strong></button>';
        }).join('') + '</div></section>';
    }
    if (Api) {
      Api.request('templates', { method: 'GET' }).then(function (res) {
        paint((res && res.templates) || [], (res && res.sources) || {});
      }).catch(function () { paint([]); });
    } else paint([]);
  }

  function defaultBrandKit() {
    var st = S();
    var primary = st.color || '#D9632D';
    var navy = '#141B2B';
    return {
      logos: st.logoUrl ? [{ id: 'primary', label: 'Primary', url: st.logoUrl, role: 'primary' }] : [],
      colors: [
        { id: 'primary', name: 'Primary', hex: primary },
        { id: 'navy', name: 'Dark Navy', hex: navy },
        { id: 'surface', name: 'Warm White', hex: '#FCFCFC' },
        { id: 'accent', name: 'Accent', hex: '#D9632D' },
        { id: 'muted', name: 'Light Gray', hex: '#F8FAFC' },
        { id: 'success', name: 'Success Green', hex: '#10B981' }
      ],
      typography: { heading: 'Plus Jakarta Sans', body: 'DM Sans' },
      voice_tones: [
        { id: 'professional', label: 'Professional', status: 'active', blurb: 'Expert technical guidance, high quality standards.' },
        { id: 'friendly', label: 'Friendly & Warm', status: 'active', blurb: 'Local neighborhood helper tone.' },
        { id: 'direct', label: 'Clear & Direct', status: 'supporting', blurb: 'Straightforward quotes and checklists.' }
      ]
    };
  }

  function ensureBrandKit() {
    var os = ensureStudioOs();
    if (!os.brandKit || typeof os.brandKit !== 'object') os.brandKit = defaultBrandKit();
    var kit = os.brandKit;
    if (!Array.isArray(kit.colors) || !kit.colors.length) kit.colors = defaultBrandKit().colors;
    if (!Array.isArray(kit.voice_tones) || !kit.voice_tones.length) kit.voice_tones = defaultBrandKit().voice_tones;
    if (!kit.typography || typeof kit.typography !== 'object') kit.typography = defaultBrandKit().typography;
    if (!Array.isArray(kit.logos)) kit.logos = [];
    // Memory facts win for primary logo + primary color when present
    var st = S();
    if (st.logoUrl) {
      var primaryLogo = kit.logos.find(function (l) { return l.role === 'primary'; });
      if (primaryLogo) primaryLogo.url = st.logoUrl;
      else kit.logos.unshift({ id: 'primary', label: 'Primary', url: st.logoUrl, role: 'primary' });
    }
    if (st.color && kit.colors[0]) {
      kit.colors[0].hex = st.color;
      kit.colors[0].name = kit.colors[0].name || 'Primary';
    }
    return kit;
  }

  function saveBrandKit(opts) {
    opts = opts || {};
    var kit = ensureBrandKit();
    var os = ensureStudioOs();
    os.brandKit = kit;
    // Sync factual Memory fields (logo + brand color) — not voice/DNA
    try {
      var primary = (kit.colors || []).find(function (c) { return c.id === 'primary'; }) || (kit.colors || [])[0];
      if (primary && primary.hex) S().color = primary.hex;
      var logo = (kit.logos || []).find(function (l) { return l.role === 'primary'; }) || (kit.logos || [])[0];
      if (logo && logo.url) S().logoUrl = logo.url;
    } catch (e) {}
    persistStudioMeta();
    var Api = api();
    if (Api) {
      Api.request('brand-kit', {
        method: 'PUT',
        body: {
          logos: kit.logos || [],
          colors: kit.colors || [],
          typography: kit.typography || {},
          voice_tones: kit.voice_tones || []
        }
      }).catch(function () {});
    }
    // Quiet-save brand_color + logo_url onto the business when possible
    try {
      var biz = global.currentBusiness;
      var db = global.db;
      if (biz && biz.id && db) {
        var patch = {};
        if (S().color) patch.brand_color = S().color;
        if (S().logoUrl && /^https?:\/\//i.test(String(S().logoUrl))) patch.logo_url = S().logoUrl;
        if (Object.keys(patch).length) {
          db.from('businesses').update(patch).eq('id', biz.id).then(function (res) {
            if (!res || res.error) return;
            Object.assign(biz, patch);
          }).catch(function () {});
        }
      }
    } catch (e) {}
    if (opts.toast !== false) toast(opts.message || 'Brand Kit saved');
  }

  function applyBrandToDrafts() {
    var kit = ensureBrandKit();
    var os = ensureStudioOs();
    var primary = (kit.colors || [])[0];
    var logo = (kit.logos || []).find(function (l) { return l.role === 'primary'; }) || (kit.logos || [])[0];
    var n = 0;
    (os.projects || []).forEach(function (p) {
      if (!p || p.status === 'published') return;
      p.canvas = p.canvas || {};
      p.canvas.brand = {
        primary_color: primary && primary.hex,
        logo_url: logo && logo.url,
        heading_font: kit.typography && kit.typography.heading,
        body_font: kit.typography && kit.typography.body,
        voice: (kit.voice_tones || []).filter(function (v) { return v.status === 'active'; }).map(function (v) { return v.label; })
      };
      n++;
    });
    persistStudioMeta();
    toast(n ? ('Applied Brand Kit to ' + n + ' draft' + (n === 1 ? '' : 's')) : 'No drafts to update — create a campaign first');
  }

  function renderBrandKit(root) {
    var Api = api();
    var body =
      '<header class="hs-page-head hs-page-head-row">' +
      '<div><h1>Brand Kit</h1><p>Edit logos, colors, type, and voice — Studio keeps campaigns on-brand.</p></div>' +
      '<div class="hs-head-actions">' +
      '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="brand-save">Save Brand Kit</button>' +
      '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="apply-brand">Apply to All Drafts</button>' +
      '</div></header>' +
      '<div id="hs-brand-mount" class="hs-brand-mount"><div class="hs-muted">Loading brand kit…</div></div>' +
      '<input type="file" id="hs-brand-logo-file" accept="image/*" hidden>';
    root.innerHTML = shell('brand', body);
    var mount = root.querySelector('#hs-brand-mount');

    function paint(kitIn) {
      var os = ensureStudioOs();
      if (kitIn && typeof kitIn === 'object') {
        os.brandKit = Object.assign(ensureBrandKit(), kitIn);
        // Prefer live Memory logo/color when kit came empty from API
        if ((!kitIn.colors || !kitIn.colors.length) && S().color) os.brandKit.colors[0].hex = S().color;
        if ((!kitIn.logos || !kitIn.logos.length) && S().logoUrl) {
          os.brandKit.logos = [{ id: 'primary', label: 'Primary', url: S().logoUrl, role: 'primary' }];
        }
      }
      var kit = ensureBrandKit();
      var colors = kit.colors;
      var tones = kit.voice_tones;
      var ty = kit.typography || {};
      var logos = kit.logos || [];
      var primaryLogo = logos.find(function (l) { return l.role === 'primary'; }) || logos[0];
      var logoUrl = (primaryLogo && primaryLogo.url) || S().logoUrl || '';
      var init = (bizName().charAt(0) || 'H').toUpperCase();
      var fontOpts = ['Plus Jakarta Sans', 'DM Sans', 'Inter', 'Poppins', 'Montserrat', 'Nunito', 'Oswald', 'Roboto Slab'];

      function fontSelect(which, current) {
        return '<select class="hs-brand-select" data-hs-act="brand-type" data-hs-type="' + which + '">' +
          fontOpts.map(function (f) {
            return '<option value="' + esc(f) + '"' + (f === current ? ' selected' : '') + '>' + esc(f) + '</option>';
          }).join('') + '</select>';
      }

      mount.innerHTML =
        '<div class="hs-brand-grid">' +
        '<div class="hs-brand-col">' +
        '<section class="hs-card hs-pad"><div class="hs-between"><h3>Logo Assets</h3>' +
        '<button type="button" class="hs-link green" data-hs-act="upload-logo">Upload New</button></div>' +
        '<div class="hs-logo-row">' +
        '<button type="button" class="hs-logo-swatch light" data-hs-act="upload-logo" title="Change primary logo">' +
        (logoUrl ? '<img src="' + esc(logoUrl) + '" alt="">' : '<span class="hs-logo-mark">' + esc(init) + '</span>') +
        '<strong>' + esc(bizName()) + '</strong><small>Primary · click to change</small></button>' +
        '<button type="button" class="hs-logo-swatch dark" data-hs-act="upload-logo">' +
        (logoUrl ? '<img src="' + esc(logoUrl) + '" alt="">' : '<span class="hs-logo-mark">' + esc(init) + '</span>') +
        '<strong>' + esc(bizName()) + '</strong><small>On dark</small></button>' +
        '<button type="button" class="hs-logo-swatch light" data-hs-act="upload-logo">' +
        (logoUrl ? '<img class="hs-logo-icon" src="' + esc(logoUrl) + '" alt="">' : '<span class="hs-logo-mark only">' + esc(init) + '</span>') +
        '<small>Icon · click to change</small></button>' +
        '</div>' +
        (logoUrl ? '<button type="button" class="hs-link hs-tiny" data-hs-act="brand-logo-clear">Remove logo</button>' : '') +
        '</section>' +
        '<section class="hs-card hs-pad"><div class="hs-between"><h3>Brand Color Palette</h3>' +
        '<button type="button" class="hs-link" data-hs-act="brand-color-add">+ Add color</button></div>' +
        '<div class="hs-color-row hs-color-edit-row">' +
        colors.map(function (c, i) {
          return '<div class="hs-color hs-color-edit" data-hs-color-i="' + i + '">' +
            '<label class="hs-color-swatch-wrap"><input type="color" value="' + esc(c.hex || '#D9632D') + '" data-hs-act="brand-color-hex" data-hs-color-i="' + i + '">' +
            '<i style="background:' + esc(c.hex || '#D9632D') + '"></i></label>' +
            '<input type="text" class="hs-color-name" value="' + esc(c.name || 'Color') + '" data-hs-act="brand-color-name" data-hs-color-i="' + i + '" maxlength="24">' +
            '<input type="text" class="hs-color-hex" value="' + esc(c.hex || '') + '" data-hs-act="brand-color-hex-text" data-hs-color-i="' + i + '" maxlength="7">' +
            '<button type="button" class="hs-color-del" data-hs-act="brand-color-del" data-hs-color-i="' + i + '" title="Remove" aria-label="Remove color">×</button>' +
            '</div>';
        }).join('') + '</div>' +
        '<p class="hs-muted hs-tiny">Primary color syncs to your Hubly website brand color.</p></section>' +
        '<section class="hs-card hs-pad"><h3>Brand Typography</h3><div class="hs-type-row">' +
        '<div><label class="hs-lbl tiny">Headlines</label>' + fontSelect('heading', ty.heading || 'Plus Jakarta Sans') +
        '<p class="hs-muted hs-tiny">Titles and callouts</p></div>' +
        '<div><label class="hs-lbl tiny">Body</label>' + fontSelect('body', ty.body || 'DM Sans') +
        '<p class="hs-muted hs-tiny">Paragraphs and details</p></div>' +
        '</div></section></div>' +
        '<div class="hs-brand-col narrow">' +
        '<section class="hs-card hs-pad"><div class="hs-between"><h3>Brand Copywriting Voice</h3>' +
        '<button type="button" class="hs-link" data-hs-act="brand-voice-add">+ Add</button></div>' +
        tones.map(function (tone, i) {
          return '<div class="hs-voice' + (tone.status === 'active' ? ' on' : '') + '">' +
            '<div class="hs-between"><input type="text" class="hs-voice-label" value="' + esc(tone.label || '') + '" data-hs-act="brand-voice-label" data-hs-voice-i="' + i + '">' +
            '<button type="button" class="hs-pill ' + (tone.status === 'active' ? 'ready' : 'draft') + '" data-hs-act="brand-voice-toggle" data-hs-voice-i="' + i + '">' +
            esc(tone.status === 'active' ? 'Active' : 'Supporting') + '</button></div>' +
            '<textarea class="hs-voice-blurb" rows="2" data-hs-act="brand-voice-blurb" data-hs-voice-i="' + i + '">' + esc(tone.blurb || '') + '</textarea>' +
            '<button type="button" class="hs-link hs-tiny" data-hs-act="brand-voice-del" data-hs-voice-i="' + i + '">Remove</button></div>';
        }).join('') +
        '<p class="hs-muted hs-tiny">Voice guides Studio copy — kept in Brand Kit (not mixed into Business Memory facts).</p></section>' +
        '<section class="hs-card hs-pad"><h3>Quick Brand Templates</h3>' +
        [['Standard Dispatch Before/After', 'Instagram Square'], ['Emergency Repair Promo', 'Direct Mailer Flyer'], ['Seasonal Maintenance Offer', 'Facebook Landscape'], ['Review Spotlight', 'Instagram Story']].map(function (x) {
          return '<button type="button" class="hs-brand-tpl" data-hs-act="quick-draft" data-hs-title="' + esc(x[0]) + '"><span class="hs-recent-thumb"></span><span><strong>' + esc(x[0]) + '</strong><span>' + esc(x[1]) + '</span></span></button>';
        }).join('') + '</section></div></div>';
    }

    paint(ensureBrandKit());
    if (Api) {
      Api.request('brand-kit', { method: 'GET' }).then(function (res) {
        if (res && res.brandKit && (res.brandKit.colors || res.brandKit.logos || res.brandKit.voice_tones)) {
          paint(res.brandKit);
        }
      }).catch(function () {});
    }
  }

  function readLogoFile(file, done) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var dataUrl = reader.result;
      function finish(url) {
        var kit = ensureBrandKit();
        var primary = kit.logos.find(function (l) { return l.role === 'primary'; });
        if (primary) primary.url = url;
        else kit.logos.unshift({ id: 'primary', label: 'Primary', url: url, role: 'primary' });
        try { S().logoUrl = url; } catch (e) {}
        saveBrandKit({ message: 'Logo updated' });
        render();
        if (typeof done === 'function') done(url);
      }
      if (typeof global.uploadBrandAsset === 'function') {
        Promise.resolve(global.uploadBrandAsset('logo', dataUrl)).then(function (hosted) {
          finish(hosted || dataUrl);
        }).catch(function () { finish(dataUrl); });
      } else {
        finish(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  }

  function publishCampaignEmail(project) {
    var os = ensureStudioOs();
    var title = (project && project.title) || 'Studio campaign';
    var Api2 = api();
    var pkg = (project && project.canvas && project.canvas.package) || {};
    var email = pkg.email || {};
    var toEmail = window.prompt('V1 publishes by Email. Recipient email:', (S().ownerEmail || S().email || ''));
    if (!toEmail) {
      toast('Publish cancelled — email required for V1');
      return;
    }
    toast('Publishing via Email…');
    function queuedLocal(status, message) {
      var item = {
        id: 'q_' + Date.now(),
        title: title,
        channels: ['email'],
        status: status || 'ready',
        project_id: project && project.id,
        caption: (email.body || (project && project.prompt) || title).slice(0, 200),
        to_email: toEmail,
        scheduled_at: 'Ready to send',
        published_at: status === 'published' ? new Date().toISOString() : null
      };
      os.queue = os.queue || [];
      os.queue.unshift(item);
      if (project) project.status = status === 'published' ? 'published' : (project.status || 'ready');
      persistStudioMeta();
      toast(message || 'Saved to publish queue');
      if ((os.ui.screen || '') === 'publish') render();
    }
    if (!Api2) {
      queuedLocal('ready', 'Email provider unavailable — queued as ready in Hubly');
      return;
    }
    Api2.request('publish', {
      method: 'POST',
      body: {
        project_id: project && project.id,
        title: title,
        to_email: toEmail,
        subject: email.subject || title,
        body: email.body || (project && project.prompt) || title,
        business_name: bizName()
      }
    }).then(function (res) {
      if (res && res.item) {
        os.queue = os.queue || [];
        os.queue.unshift(res.item);
      } else if (!(res && res.ok)) {
        // Ensure something lands in the queue so Publish Center is not empty theater
        os.queue = os.queue || [];
        if (!os.queue.some(function (q) { return q.project_id === (project && project.id) && q.title === title; })) {
          os.queue.unshift({
            id: 'q_' + Date.now(),
            title: title,
            channels: ['email'],
            status: (res && res.error === 'Provider not configured') ? 'ready' : 'draft',
            project_id: project && project.id,
            to_email: toEmail,
            scheduled_at: 'Ready to send'
          });
        }
      }
      if (project && res && res.ok) project.status = 'published';
      persistStudioMeta();
      if (res && res.error === 'Provider not configured') {
        toast(res.message || 'Email provider not configured — queued as ready in Hubly');
      } else if (res && res.ok) {
        toast('Published by email');
      } else {
        toast((res && res.message) || (res && res.error) || 'Publish saved to queue');
      }
      if ((ensureStudioOs().ui.screen || '') === 'publish') render();
    }).catch(function () {
      queuedLocal('ready', 'Could not reach publish API — queued locally');
    });
  }

  function queueItemsByDay(year, month) {
    var map = {};
    (ensureStudioOs().queue || []).forEach(function (q) {
      var raw = q.published_at || q.scheduled_at || q.created_at;
      var dt = raw ? new Date(raw) : null;
      if (!dt || isNaN(dt.getTime())) return;
      if (dt.getFullYear() !== year || dt.getMonth() !== month) return;
      var d = dt.getDate();
      if (!map[d]) map[d] = [];
      map[d].push(q);
    });
    return map;
  }

  function renderPublish(root) {
    var os = ensureStudioOs();
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var now = new Date();
    var monthLabel = months[now.getMonth()] + ' ' + now.getFullYear();
    var y = now.getFullYear(), m = now.getMonth();
    var byDay = queueItemsByDay(y, m);
    var days = [];
    var first = new Date(y, m, 1);
    var startPad = (first.getDay() + 6) % 7;
    var dim = new Date(y, m + 1, 0).getDate();
    var today = now.getDate();
    for (var i = 0; i < startPad; i++) days.push({ n: '', muted: true });
    for (var d = 1; d <= dim; d++) {
      days.push({ n: d, today: d === today, items: byDay[d] || [] });
    }

    var cal = days.map(function (c) {
      var posts = (c.items || []).slice(0, 2).map(function (q) {
        return '<div class="hs-cal-post"><span class="hs-cal-thumb"></span><span>' +
          esc((q.title || 'Email').slice(0, 18)) + (q.title && q.title.length > 18 ? '…' : '') +
          '<br>' + esc(q.status === 'published' ? 'Sent' : 'Email') + '</span></div>';
      }).join('');
      return '<div class="hs-cal-cell' + (c.today ? ' today' : '') + (c.muted ? ' muted' : '') + '">' +
        (c.n ? '<span class="hs-cal-n">' + c.n + (c.today ? ' <i>TODAY</i>' : '') + '</span>' : '') +
        posts +
        '</div>';
    }).join('');

    var accounts = [
      { provider: 'email', label: 'Email (V1)', handle: S().ownerEmail || S().email || 'Resend', status: 'v1' },
      { provider: 'instagram', label: 'Instagram', handle: '@' + (S().slug || 'yourbiz'), status: 'not_connected' },
      { provider: 'facebook', label: 'Facebook Page', handle: bizName(), status: 'not_connected' },
      { provider: 'google_business', label: 'Google Business', handle: bizName(), status: 'not_connected' }
    ];

    var queue = os.queue || [];
    var drafts = (os.projects || []).filter(function (p) { return p && p.status !== 'published'; }).slice(0, 6);

    var queueHtml = queue.length
      ? queue.slice(0, 8).map(function (q) {
        return '<div class="hs-pub-q">' +
          '<span class="hs-recent-thumb"></span>' +
          '<div><strong>' + esc(q.title || 'Campaign') + '</strong>' +
          '<span>' + esc((q.channels || ['email']).join(', ')) +
          ' · ' + esc(q.status || 'ready') +
          (q.to_email ? (' · ' + q.to_email) : '') +
          (q.scheduled_at ? (' · ' + esc(q.scheduled_at)) : '') +
          '</span></div>' +
          (q.project_id
            ? '<button type="button" class="hs-link" data-hs-act="open-project" data-hs-id="' + esc(q.project_id) + '">Open</button>'
            : '') +
          '</div>';
      }).join('')
      : '<p class="hs-muted hs-tiny">Queue is empty — publish a campaign by email and it shows up here. No demo posts.</p>';

    var draftHtml = drafts.length
      ? drafts.map(function (p) {
        return '<div class="hs-pub-q">' +
          '<span class="hs-recent-thumb"></span>' +
          '<div><strong>' + esc(p.title || 'Draft') + '</strong>' +
          '<span>' + esc(p.status || 'draft') + ' · ' + esc(relativeEdit(p.last_edited_at)) + '</span></div>' +
          '<button type="button" class="hs-btn hs-btn-brand hs-btn-sm" data-hs-act="publish-project" data-hs-id="' + esc(p.id) + '">Publish Email</button>' +
          '</div>';
      }).join('')
      : '<p class="hs-muted hs-tiny">No draft campaigns yet — generate one in AI Creator first.</p>';

    var body =
      '<header class="hs-page-head hs-page-head-row">' +
      '<div><h1>Publish Center</h1>' +
      '<p>V1 publishes by <strong>Email</strong>. Social networks stay disconnected until you connect them in Apps — Hubly never fakes a send.</p></div>' +
      '<div class="hs-head-actions">' +
      '<div class="hs-month-pill">' + esc(monthLabel) + '</div>' +
      '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="publish-now">✈ Publish Email</button>' +
      '</div></header>' +
      '<div class="hs-el-intro hs-card hs-pad">' +
      '<strong>What Publish does today</strong>' +
      '<p class="hs-muted">Sends (or queues) a campaign email via your Email provider. Instagram / Facebook / Google scheduling is deferred — connect in Apps when ready. The calendar only shows real queue activity.</p>' +
      '</div>' +
      '<div class="hs-publish-grid">' +
      '<section class="hs-card hs-cal-wrap"><div class="hs-between hs-cal-legend"><h3>Activity this month</h3>' +
      '<span class="hs-muted hs-tiny">' + (Object.keys(byDay).length ? 'From your email queue' : 'No sends yet this month') + '</span></div>' +
      '<div class="hs-cal-head">' +
      ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(function (d) { return '<span>' + d + '</span>'; }).join('') +
      '</div><div class="hs-cal-grid">' + cal + '</div></section>' +
      '<aside class="hs-publish-side">' +
      '<section class="hs-card hs-pad"><h3>Channels</h3>' +
      accounts.map(function (a) {
        var pill = a.status === 'v1' ? 'V1 live' : 'Not connected';
        var cls = a.status === 'v1' ? 'ready' : 'draft';
        return '<div class="hs-acct-row"><span class="hs-acct-ico">' + esc(a.label.charAt(0)) + '</span>' +
          '<div><strong>' + esc(a.label) + '</strong><span>' + esc(a.handle || '') + '</span></div>' +
          '<span class="hs-pill ' + cls + '">' + esc(pill) + '</span></div>';
      }).join('') +
      '<p class="hs-muted hs-tiny">Connect social accounts in Apps — Studio never marks them Connected without credentials.</p></section>' +
      '<section class="hs-card hs-pad"><div class="hs-between"><h3>Ready to publish</h3>' +
      '<button type="button" class="hs-link" data-hs-act="nav" data-hs-screen="projects">All projects</button></div>' +
      draftHtml + '</section>' +
      '<section class="hs-card hs-pad"><h3>Email publish queue</h3>' + queueHtml + '</section>' +
      '</aside></div>';

    root.innerHTML = shell('publish', body);
  }

  function daysAgo(n) {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d;
  }

  function inRange(iso, since) {
    if (!iso) return false;
    var t = new Date(iso).getTime();
    return !isNaN(t) && t >= since.getTime();
  }

  /** Hubly-owned Studio analytics — counters + activity only (no fake reach/revenue). */
  function buildStudioAnalytics(periodDays) {
    var days = periodDays || 30;
    var since = daysAgo(days);
    var os = ensureStudioOs();
    var projects = os.projects || [];
    var queue = os.queue || [];

    var created = projects.filter(function (p) {
      return inRange(p.created_at || p.last_edited_at, since);
    });
    var publishedQ = queue.filter(function (q) {
      return (q.status === 'published') && inRange(q.published_at || q.created_at || q.scheduled_at, since);
    });
    var readyQ = queue.filter(function (q) { return q.status === 'ready' || q.status === 'queued'; });
    var drafts = projects.filter(function (p) { return p && p.status !== 'published'; });
    var publishedProjects = projects.filter(function (p) { return p && p.status === 'published'; });

    var weeks = Math.max(1, days / 7);
    var pubCount = publishedQ.length || publishedProjects.filter(function (p) {
      return inRange(p.last_edited_at || p.created_at, since);
    }).length;
    var freq = pubCount === 0
      ? 'No publishes yet'
      : ((pubCount / weeks).toFixed(1) + ' / week');

    var publishRate = created.length
      ? Math.round((pubCount / created.length) * 100) + '%'
      : (pubCount ? '—' : '0%');

    // Daily series for last N days (capped display at 14 bars for readability)
    var seriesDays = Math.min(days, 14);
    var series = [];
    for (var i = seriesDays - 1; i >= 0; i--) {
      var dayStart = daysAgo(i);
      var dayEnd = daysAgo(i - 1);
      var c = projects.filter(function (p) {
        var t = new Date(p.created_at || p.last_edited_at).getTime();
        return !isNaN(t) && t >= dayStart.getTime() && t < dayEnd.getTime();
      }).length;
      var pcount = queue.filter(function (q) {
        if (q.status !== 'published') return false;
        var t = new Date(q.published_at || q.created_at).getTime();
        return !isNaN(t) && t >= dayStart.getTime() && t < dayEnd.getTime();
      }).length;
      series.push({
        label: (dayStart.getMonth() + 1) + '/' + dayStart.getDate(),
        created: c,
        published: pcount
      });
    }

    var byGoal = {};
    projects.forEach(function (p) {
      var g = (p.metadata && (p.metadata.goal_id || p.metadata.playbook_id)) || 'other';
      if (!byGoal[g]) byGoal[g] = { goal: g, created: 0, published: 0 };
      byGoal[g].created += 1;
      if (p.status === 'published') byGoal[g].published += 1;
    });
    var goalRows = Object.keys(byGoal).map(function (k) { return byGoal[k]; })
      .sort(function (a, b) { return b.created - a.created; })
      .slice(0, 6);

    var GOAL_LABELS = {
      get_more_reviews: 'Get More Reviews',
      fill_tomorrow_schedule: "Fill Tomorrow's Schedule",
      promote_service: 'Promote a Service',
      win_back_customers: 'Win Back Customers',
      seasonal_promotion: 'Seasonal Promotion',
      membership_drive: 'Membership Drive',
      book_more_jobs: 'Book More Jobs',
      referral: 'Referral',
      other: 'Other / blank'
    };

    var activity = [];
    projects.slice(0, 12).forEach(function (p) {
      activity.push({
        at: p.last_edited_at || p.created_at,
        kind: p.status === 'published' ? 'published' : 'created',
        title: p.title || 'Campaign',
        id: p.id
      });
    });
    queue.slice(0, 12).forEach(function (q) {
      activity.push({
        at: q.published_at || q.created_at || q.scheduled_at,
        kind: q.status === 'published' ? 'email_sent' : 'queued',
        title: q.title || 'Email publish',
        id: q.project_id
      });
    });
    activity = activity.filter(function (a) { return a.at; }).sort(function (a, b) {
      return new Date(b.at).getTime() - new Date(a.at).getTime();
    }).slice(0, 10);

    var insights = [];
    if (!projects.length) {
      insights.push({ tone: 'warn', text: 'No campaigns yet — generate one from AI Creator to start the counters.' });
    } else if (pubCount === 0) {
      insights.push({ tone: 'warn', text: 'You have ' + drafts.length + ' draft' + (drafts.length === 1 ? '' : 's') + ' but nothing published. Open Publish Center and send by email.' });
    } else if (created.length && pubCount / Math.max(1, created.length) < 0.3) {
      insights.push({ tone: 'tip', text: 'Publish rate is ' + publishRate + ' in this period — finish drafts in Publish to improve frequency.' });
    } else {
      insights.push({ tone: 'ok', text: 'Publishing cadence is ' + freq + '. Keep attaching real job photos and reviews before each send.' });
    }
    if (readyQ.length) {
      insights.push({ tone: 'tip', text: readyQ.length + ' item' + (readyQ.length === 1 ? '' : 's') + ' waiting in the email queue (provider may need RESEND_API_KEY).' });
    }

    return {
      period_days: days,
      metrics: {
        campaigns_created: created.length || projects.length,
        campaigns_published: pubCount,
        drafts: drafts.length,
        ready_queue: readyQ.length,
        publish_rate: publishRate,
        posting_frequency: freq
      },
      series: series,
      by_goal: goalRows.map(function (r) {
        return {
          goal_id: r.goal,
          label: GOAL_LABELS[r.goal] || r.goal,
          created: r.created,
          published: r.published
        };
      }),
      activity: activity,
      insights: insights,
      deferred: ['reach', 'clicks', 'quotes', 'bookings', 'revenue_attribution']
    };
  }

  function paintAnalytics(root, data) {
    var mount = root.querySelector('#hs-analytics-body');
    if (!mount || !data) return;
    var m = data.metrics || {};
    var maxBar = 1;
    (data.series || []).forEach(function (s) {
      maxBar = Math.max(maxBar, s.created || 0, s.published || 0);
    });

    var kpis = [
      ['CREATED', m.campaigns_created != null ? m.campaigns_created : '—', 'Campaigns started'],
      ['PUBLISHED', m.campaigns_published != null ? m.campaigns_published : '—', 'Email sends / published'],
      ['DRAFTS', m.drafts != null ? m.drafts : '—', 'Still open'],
      ['QUEUE', m.ready_queue != null ? m.ready_queue : '—', 'Ready to send'],
      ['PUBLISH RATE', m.publish_rate || '—', 'Published ÷ created'],
      ['FREQUENCY', m.posting_frequency || '—', 'Pace this period']
    ];

    var seriesHtml = (data.series || []).map(function (s) {
      var ch = Math.round(((s.created || 0) / maxBar) * 100);
      var ph = Math.round(((s.published || 0) / maxBar) * 100);
      return '<div class="hs-an-bar" title="' + esc(s.label) + ': ' + s.created + ' created, ' + s.published + ' published">' +
        '<div class="hs-an-bar-stack">' +
        '<i class="created" style="height:' + ch + '%"></i>' +
        '<i class="published" style="height:' + ph + '%"></i>' +
        '</div><span>' + esc(s.label) + '</span></div>';
    }).join('');

    var goalsHtml = (data.by_goal && data.by_goal.length)
      ? data.by_goal.map(function (g) {
        var pct = g.created ? Math.round((g.published / g.created) * 100) : 0;
        return '<div class="hs-an-goal">' +
          '<div class="hs-between"><strong>' + esc(g.label) + '</strong><span>' + g.published + '/' + g.created + ' published</span></div>' +
          '<div class="hs-an-goal-track"><i style="width:' + pct + '%"></i></div></div>';
      }).join('')
      : '<p class="hs-muted hs-tiny">Generate campaigns with goals to see this breakdown.</p>';

    var activityHtml = (data.activity && data.activity.length)
      ? data.activity.map(function (a) {
        var kindLabel = a.kind === 'email_sent' || a.kind === 'published' ? 'Published' : (a.kind === 'queued' ? 'Queued' : 'Created');
        return '<button type="button" class="hs-an-act" ' +
          (a.id ? 'data-hs-act="open-project" data-hs-id="' + esc(a.id) + '"' : 'data-hs-act="nav" data-hs-screen="publish"') + '>' +
          '<span class="hs-pill ' + (kindLabel === 'Published' ? 'ready' : 'draft') + '">' + esc(kindLabel) + '</span>' +
          '<strong>' + esc(a.title) + '</strong>' +
          '<span>' + esc(relativeEdit(a.at)) + '</span></button>';
      }).join('')
      : '<p class="hs-muted hs-tiny">Activity shows up as you create and publish campaigns.</p>';

    var insightsHtml = (data.insights || []).map(function (ins) {
      return '<div class="hs-an-insight tone-' + esc(ins.tone || 'tip') + '">' + esc(ins.text) + '</div>';
    }).join('');

    mount.innerHTML =
      '<div class="hs-an-kpi-grid">' + kpis.map(function (k) {
        return '<div class="hs-kpi hs-an-kpi"><span>' + esc(k[0]) + '</span><strong>' + esc(String(k[1])) + '</strong>' +
          '<em>' + esc(k[2]) + '</em></div>';
      }).join('') + '</div>' +
      '<div class="hs-an-grid">' +
      '<section class="hs-card hs-pad">' +
      '<div class="hs-between"><h3>Activity</h3><span class="hs-muted hs-tiny"><i class="hs-leg created"></i> Created · <i class="hs-leg published"></i> Published</span></div>' +
      '<div class="hs-an-chart">' + (seriesHtml || '<p class="hs-muted">No dated activity in this range.</p>') + '</div>' +
      '</section>' +
      '<section class="hs-card hs-pad"><h3>By campaign goal</h3>' + goalsHtml + '</section>' +
      '</div>' +
      '<div class="hs-an-grid">' +
      '<section class="hs-card hs-pad"><h3>Recent activity</h3><div class="hs-an-feed">' + activityHtml + '</div></section>' +
      '<section class="hs-card hs-pad"><h3>Insights</h3>' + insightsHtml +
      '<div class="hs-btn-row">' +
      '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="nav" data-hs-screen="publish">Open Publish</button>' +
      '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="nav" data-hs-screen="ai">Generate campaign</button>' +
      '</div>' +
      '<p class="hs-muted hs-tiny hs-an-deferred">Not in V1 (and never faked): reach, clicks, quotes requested, bookings, revenue attribution.</p>' +
      '</section></div>';
  }

  function renderAnalytics(root) {
    var os = ensureStudioOs();
    if (!os.ui.analyticsDays) os.ui.analyticsDays = 30;
    var days = os.ui.analyticsDays;
    var body =
      '<header class="hs-page-head hs-page-head-row">' +
      '<div><h1>Analytics</h1>' +
      '<p>Studio performance from your real campaigns and email publishes — not vanity social metrics.</p></div>' +
      '<div class="hs-head-actions hs-an-range">' +
      [7, 30, 90].map(function (d) {
        return '<button type="button" class="hs-btn hs-btn-ghost' + (days === d ? ' on' : '') + '" data-hs-act="an-range" data-hs-days="' + d + '">Last ' + d + ' days</button>';
      }).join('') +
      '</div></header>' +
      '<div id="hs-analytics-body"><div class="hs-muted">Loading analytics…</div></div>';
    root.innerHTML = shell('analytics', body);

    var local = buildStudioAnalytics(days);
    paintAnalytics(root, local);

    var Api = api();
    if (Api) {
      Api.request('analytics', { method: 'GET', body: { period_days: days } }).then(function (res) {
        if (!res || res.error) return;
        // Merge API counters when present; keep rich local activity/goals
        if (res.metrics) {
          local.metrics.campaigns_created = res.metrics.campaigns_created != null ? res.metrics.campaigns_created : local.metrics.campaigns_created;
          local.metrics.campaigns_published = res.metrics.campaigns_published != null ? res.metrics.campaigns_published : local.metrics.campaigns_published;
          if (res.metrics.posting_frequency) local.metrics.posting_frequency = res.metrics.posting_frequency;
          if (res.metrics.drafts != null) local.metrics.drafts = res.metrics.drafts;
          if (res.metrics.ready_queue != null) local.metrics.ready_queue = res.metrics.ready_queue;
          if (res.metrics.publish_rate) local.metrics.publish_rate = res.metrics.publish_rate;
        }
        if (Array.isArray(res.series) && res.series.length) local.series = res.series;
        if (Array.isArray(res.by_goal) && res.by_goal.length) local.by_goal = res.by_goal;
        if (Array.isArray(res.activity) && res.activity.length) local.activity = res.activity;
        if (Array.isArray(res.insights) && res.insights.length) local.insights = res.insights;
        paintAnalytics(root, local);
      }).catch(function () {});
    }
  }

  function renderProjects(root) {
    var os = ensureStudioOs();
    var list = (os.projects || []).map(function (p) {
      return '<button type="button" class="hs-recent-row" data-hs-act="open-project" data-hs-id="' + esc(p.id) + '">' +
        '<span class="hs-recent-thumb"></span>' +
        '<span class="hs-recent-meta"><strong>' + esc(p.title) + '</strong><span>' + esc(p.status) + ' · ' + esc(relativeEdit(p.last_edited_at)) + '</span></span></button>';
    }).join('') || '<div class="hs-empty"><strong>No projects yet</strong><p>Create from AI Creator or a blank canvas.</p>' +
      '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="nav" data-hs-screen="ai">Open AI Creator</button></div>';

    root.innerHTML = shell('projects',
      '<header class="hs-page-head hs-page-head-row"><div><h1>Projects</h1><p>Your Studio drafts and published sets.</p></div>' +
      '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="blank" data-hs-format="instagram_post">+ New Project</button></header>' +
      '<div class="hs-card">' + list + '</div>');
  }

  var ELEMENT_CATS = [
    { id: 'all', label: 'All' },
    { id: 'badges', label: 'Badges' },
    { id: 'cta', label: 'CTAs' },
    { id: 'offers', label: 'Offers' },
    { id: 'proof', label: 'Social proof' },
    { id: 'frames', label: 'Frames' }
  ];

  /** Campaign package graphics — Hubly attaches these to projects; Canva owns freeform drawing. */
  var ELEMENT_LIBRARY = [
    { id: 'badge_5star', cat: 'badges', label: '5-Star Badge', blurb: 'Review highlight stamp', glyph: '★', tone: 'brand' },
    { id: 'badge_licensed', cat: 'badges', label: 'Licensed & Insured', blurb: 'Trust mark for local ads', glyph: '✓', tone: 'navy' },
    { id: 'badge_local', cat: 'badges', label: 'Locally Owned', blurb: 'Neighborhood business chip', glyph: '⌂', tone: 'teal' },
    { id: 'badge_same_day', cat: 'badges', label: 'Same-Day Available', blurb: 'Urgency for open slots', glyph: '⚡', tone: 'brand' },
    { id: 'cta_book', cat: 'cta', label: 'Book Now Bar', blurb: 'Primary booking CTA strip', glyph: '→', tone: 'brand' },
    { id: 'cta_call', cat: 'cta', label: 'Call Today', blurb: 'Phone-forward CTA', glyph: '☎', tone: 'navy' },
    { id: 'cta_quote', cat: 'cta', label: 'Free Quote', blurb: 'Lead-gen CTA chip', glyph: '$', tone: 'teal' },
    { id: 'cta_text', cat: 'cta', label: 'Text to Book', blurb: 'SMS-friendly CTA', glyph: '💬', tone: 'brand' },
    { id: 'offer_pct', cat: 'offers', label: '% Off Stamp', blurb: 'Percent discount burst', glyph: '%', tone: 'brand' },
    { id: 'offer_seasonal', cat: 'offers', label: 'Seasonal Special', blurb: 'Calendar promo ribbon', glyph: '☀', tone: 'teal' },
    { id: 'offer_member', cat: 'offers', label: 'Members Save', blurb: 'Membership upsell chip', glyph: '◆', tone: 'navy' },
    { id: 'offer_bundle', cat: 'offers', label: 'Package Deal', blurb: 'Bundle / combo stamp', glyph: '+', tone: 'brand' },
    { id: 'proof_stars', cat: 'proof', label: 'Star Row', blurb: '★★★★★ under headlines', glyph: '★★★★★', tone: 'brand' },
    { id: 'proof_quote', cat: 'proof', label: 'Quote Frame', blurb: 'Review quote card frame', glyph: '“”', tone: 'navy' },
    { id: 'proof_count', cat: 'proof', label: 'Jobs Completed', blurb: 'Social proof counter', glyph: '#', tone: 'teal' },
    { id: 'frame_before_after', cat: 'frames', label: 'Before / After Split', blurb: 'Two-panel photo frame', glyph: '▥', tone: 'navy' },
    { id: 'frame_story', cat: 'frames', label: 'Story Safe Zone', blurb: 'Vertical story margins', glyph: '▮', tone: 'teal' },
    { id: 'frame_email', cat: 'frames', label: 'Email Header Band', blurb: '600px email masthead', glyph: '▬', tone: 'brand' }
  ];

  function ensureElementsState() {
    var os = ensureStudioOs();
    if (!os.elements || typeof os.elements !== 'object') os.elements = { favorites: [], cat: 'all' };
    if (!Array.isArray(os.elements.favorites)) os.elements.favorites = [];
    if (!os.elements.cat) os.elements.cat = 'all';
    return os.elements;
  }

  function findElement(id) {
    return ELEMENT_LIBRARY.find(function (e) { return e.id === id; }) || null;
  }

  function attachElementToProject(project, elementId) {
    var elDef = findElement(elementId);
    if (!project || !elDef) return false;
    project.canvas = project.canvas || {};
    project.canvas.package = project.canvas.package || {};
    var list = project.canvas.package.elements || [];
    if (list.some(function (x) { return x && x.id === elDef.id; })) return true;
    list.push({
      id: elDef.id,
      label: elDef.label,
      cat: elDef.cat,
      glyph: elDef.glyph,
      tone: elDef.tone,
      attached_at: new Date().toISOString()
    });
    project.canvas.package.elements = list;
    project.last_edited_at = new Date().toISOString();
    return true;
  }

  function renderElements(root) {
    var st = ensureElementsState();
    var os = ensureStudioOs();
    var cat = st.cat || 'all';
    var openProj = currentProject();
    var cats = ELEMENT_CATS.map(function (c) {
      return '<button type="button" class="hs-cat' + (cat === c.id ? ' on' : '') + '" data-hs-act="el-cat" data-hs-cat="' + c.id + '">' + esc(c.label) + '</button>';
    }).join('');

    var items = ELEMENT_LIBRARY.filter(function (e) {
      return cat === 'all' || cat === 'favorites' || e.cat === cat;
    });
    if (cat === 'favorites') {
      items = ELEMENT_LIBRARY.filter(function (e) { return st.favorites.indexOf(e.id) >= 0; });
    }

    var cards = items.map(function (e) {
      var fav = st.favorites.indexOf(e.id) >= 0;
      return '<article class="hs-el-card tone-' + esc(e.tone || 'brand') + '">' +
        '<button type="button" class="hs-el-fav' + (fav ? ' on' : '') + '" data-hs-act="el-fav" data-hs-el="' + esc(e.id) + '" title="Favorite" aria-label="Favorite">★</button>' +
        '<div class="hs-el-glyph" aria-hidden="true">' + esc(e.glyph) + '</div>' +
        '<strong>' + esc(e.label) + '</strong>' +
        '<span>' + esc(e.blurb) + '</span>' +
        '<div class="hs-el-acts">' +
        '<button type="button" class="hs-btn hs-btn-brand hs-btn-sm" data-hs-act="el-attach" data-hs-el="' + esc(e.id) + '">' +
        (openProj ? 'Add to campaign' : 'Use in campaign') + '</button>' +
        '</div></article>';
    }).join('') || '<div class="hs-empty"><strong>No favorites yet</strong><p>Star elements you reuse often.</p></div>';

    var favCount = st.favorites.length;
    var body =
      '<header class="hs-page-head hs-page-head-row">' +
      '<div><h1>Elements</h1>' +
      '<p>Campaign-ready graphics Hubly can attach to packages — badges, CTAs, offers, and frames. Visual freehand drawing stays in Customize Design.</p></div>' +
      (openProj
        ? '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="open-project" data-hs-id="' + esc(openProj.id) + '">Open current campaign</button>'
        : '') +
      '</header>' +
      '<div class="hs-el-intro hs-card hs-pad">' +
      '<strong>What Elements are for</strong>' +
      '<p class="hs-muted">Pick a badge or CTA → Hubly attaches it to a campaign package. Open Project Workspace to see it on the Assets list and preview chips. This is not a Canva draw tool.</p>' +
      '</div>' +
      '<div class="hs-el-toolbar">' +
      '<div class="hs-cats">' + cats +
      '<button type="button" class="hs-cat' + (cat === 'favorites' ? ' on' : '') + '" data-hs-act="el-cat" data-hs-cat="favorites">Favorites' +
      (favCount ? ' (' + favCount + ')' : '') + '</button></div></div>' +
      '<div class="hs-el-grid">' + cards + '</div>';

    root.innerHTML = shell('elements', body);
  }

  function refreshStorageFromAssets() {
    var os = ensureStudioOs();
    var used = (os.assets || []).reduce(function (sum, a) { return sum + (Number(a.bytes) || 0); }, 0);
    os.settings = os.settings || {};
    os.settings.storage_used_bytes = used;
  }

  function jobPhotoList() {
    var st = S();
    var urls = [];
    function push(u, label) {
      if (!u || typeof u !== 'string') return;
      if (urls.some(function (x) { return x.url === u; })) return;
      urls.push({ id: 'job_' + urls.length, url: u, name: label || ('Job photo ' + (urls.length + 1)), source: 'jobs' });
    }
    (st.portfolioUrls || []).forEach(function (u, i) { push(u, 'Portfolio ' + (i + 1)); });
    try {
      var pairs = st.galleryPairs || (st.website && st.website.galleryPairs) || [];
      (pairs || []).forEach(function (p, i) {
        if (p && p.before) push(p.before, 'Before ' + (i + 1));
        if (p && p.after) push(p.after, 'After ' + (i + 1));
      });
    } catch (e) {}
    try {
      var jobsList = typeof global.jobs === 'function' ? global.jobs() : (st.jobs || []);
      (jobsList || []).slice(0, 20).forEach(function (j) {
        var photos = (j && (j.photos || j.job_photos || j.media)) || [];
        if (Array.isArray(photos)) {
          photos.forEach(function (ph, i) {
            var u = typeof ph === 'string' ? ph : (ph && (ph.url || ph.src));
            push(u, (j.customer_name || j.title || 'Job') + ' · ' + (i + 1));
          });
        }
      });
    } catch (e) {}
    return urls;
  }

  function attachMediaToProject(project, asset) {
    if (!project || !asset || !asset.url) return false;
    project.canvas = project.canvas || {};
    project.canvas.package = project.canvas.package || {};
    var media = project.canvas.package.media || [];
    if (media.some(function (m) { return m && m.url === asset.url; })) return true;
    media.push({
      id: asset.id,
      url: asset.url,
      name: asset.name || 'Upload',
      kind: asset.kind || 'upload',
      attached_at: new Date().toISOString()
    });
    project.canvas.package.media = media;
    // Prefer first attached photo in preview slots when empty
    if (!project.canvas.package.photo_url) project.canvas.package.photo_url = asset.url;
    project.last_edited_at = new Date().toISOString();
    return true;
  }

  function renderUploads(root) {
    var os = ensureStudioOs();
    var assets = os.assets || [];
    var openProj = currentProject();
    var cards = assets.map(function (a) {
      return '<article class="hs-media-card">' +
        '<div class="hs-media-thumb">' +
        (a.url ? '<img src="' + esc(a.url) + '" alt="">' : '<span class="hs-media-ph">☁</span>') +
        '</div>' +
        '<div class="hs-media-meta"><strong>' + esc(a.name || 'Upload') + '</strong>' +
        '<span>' + esc(a.kind || 'upload') + (a.bytes ? (' · ' + Math.max(1, Math.round(a.bytes / 1024)) + ' KB') : '') + '</span></div>' +
        '<div class="hs-media-acts">' +
        '<button type="button" class="hs-btn hs-btn-brand hs-btn-sm" data-hs-act="media-attach" data-hs-asset-id="' + esc(a.id) + '">' +
        (openProj ? 'Add to campaign' : 'Use in campaign') + '</button>' +
        '<button type="button" class="hs-link hs-tiny" data-hs-act="media-delete" data-hs-asset-id="' + esc(a.id) + '">Remove</button>' +
        '</div></article>';
    }).join('');

    var body =
      '<header class="hs-page-head hs-page-head-row">' +
      '<div><h1>Uploads</h1>' +
      '<p>Your Studio media library — logos, job shots, and files you bring in for campaigns. Job photos already in Hubly also live under Photos.</p></div>' +
      '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="media-upload">+ Upload files</button></header>' +
      '<input type="file" id="hs-uploads-file" accept="image/*" multiple hidden>' +
      '<div class="hs-el-intro hs-card hs-pad">' +
      '<strong>What Uploads are for</strong>' +
      '<p class="hs-muted">Drop brand or job images here. Attach them to a campaign package, or start a new campaign from a file. This is your file library — not Templates or AI Creator.</p>' +
      '</div>' +
      '<div class="hs-upload-drop" data-hs-act="media-upload" role="button" tabindex="0">' +
      '<strong>Click to upload</strong><span>PNG, JPG, WEBP · stored in Studio for campaigns</span></div>' +
      (assets.length
        ? '<div class="hs-media-grid">' + cards + '</div>'
        : '<div class="hs-empty hs-card hs-pad"><strong>No uploads yet</strong><p>Upload a logo, before/after shot, or promo image to use across campaigns.</p>' +
          '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="media-upload">Upload your first file</button></div>');

    root.innerHTML = shell('uploads', body);

    // Soft-hydrate from API
    var Api = api();
    if (Api && !os._assetsHydrated) {
      Api.request('assets', { method: 'GET' }).then(function (res) {
        if (res && Array.isArray(res.assets) && res.assets.length) {
          os.assets = res.assets;
          os._assetsHydrated = true;
          refreshStorageFromAssets();
          if ((ensureStudioOs().ui.screen || '') === 'uploads') render();
        }
      }).catch(function () {});
    }
  }

  function renderPhotos(root) {
    var photos = jobPhotoList();
    var openProj = currentProject();
    var cards = photos.map(function (a) {
      return '<article class="hs-media-card">' +
        '<div class="hs-media-thumb"><img src="' + esc(a.url) + '" alt=""></div>' +
        '<div class="hs-media-meta"><strong>' + esc(a.name) + '</strong><span>From Hubly jobs / portfolio</span></div>' +
        '<div class="hs-media-acts">' +
        '<button type="button" class="hs-btn hs-btn-brand hs-btn-sm" data-hs-act="photo-attach" data-hs-photo-url="' + esc(a.url) + '" data-hs-photo-name="' + esc(a.name) + '">' +
        (openProj ? 'Add to campaign' : 'Use in campaign') + '</button></div></article>';
    }).join('');

    var body =
      '<header class="hs-page-head hs-page-head-row">' +
      '<div><h1>Photos</h1>' +
      '<p>Job and portfolio photos already in Hubly — ready for before/after and review campaigns.</p></div>' +
      '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="nav" data-hs-screen="uploads">Go to Uploads</button></header>' +
      '<div class="hs-el-intro hs-card hs-pad">' +
      '<strong>Photos vs Uploads</strong>' +
      '<p class="hs-muted">Photos pulls media Hubly already knows from jobs and portfolio. Uploads is where you add new files into Studio.</p></div>' +
      (photos.length
        ? '<div class="hs-media-grid">' + cards + '</div>'
        : '<div class="hs-empty hs-card hs-pad"><strong>No job photos yet</strong><p>Complete jobs with photos, or add portfolio images on your website — they show up here. Or upload files in Uploads.</p>' +
          '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="nav" data-hs-screen="uploads">Open Uploads</button></div>');

    root.innerHTML = shell('photos', body);
  }

  function ingestUploadFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    toast(files.length === 1 ? 'Uploading…' : ('Uploading ' + files.length + ' files…'));
    var os = ensureStudioOs();
    var pending = files.length;
    files.forEach(function (file) {
      var reader = new FileReader();
      reader.onload = function () {
        var dataUrl = reader.result;
        function finish(url) {
          var asset = {
            id: 'up_' + Math.random().toString(36).slice(2, 9),
            name: file.name || 'Upload',
            kind: 'upload',
            url: url,
            bytes: file.size || 0,
            created_at: new Date().toISOString()
          };
          os.assets = os.assets || [];
          os.assets.unshift(asset);
          refreshStorageFromAssets();
          var Api = api();
          if (Api) {
            Api.request('assets', {
              method: 'POST',
              body: { name: asset.name, kind: 'upload', url: url, bytes: asset.bytes }
            }).then(function (res) {
              if (res && res.asset && res.asset.id) asset.id = res.asset.id;
              persistStudioMeta();
            }).catch(function () { persistStudioMeta(); });
          } else persistStudioMeta();
          pending -= 1;
          if (pending <= 0) {
            toast(files.length === 1 ? 'Upload added' : (files.length + ' uploads added'));
            render();
          }
        }
        if (typeof global.uploadBrandAsset === 'function') {
          Promise.resolve(global.uploadBrandAsset('studio', dataUrl)).then(function (hosted) {
            finish(hosted || dataUrl);
          }).catch(function () { finish(dataUrl); });
        } else finish(dataUrl);
      };
      reader.readAsDataURL(file);
    });
  }

  function studioBizId() {
    var st = S();
    return st.businessId || st.bizId || (global.currentBusiness && global.currentBusiness.id) || null;
  }

  function openAppsMarketplace(appId) {
    try { setMode(false); } catch (e) {}
    try {
      if (appId) {
        try { sessionStorage.setItem('hubly_apps_focus', appId); } catch (e2) {}
      }
      if (typeof global.switchV === 'function') {
        var ni = document.querySelector('[data-v="apps"]');
        if (ni) {
          global.switchV(ni);
          return;
        }
      }
    } catch (e) {}
    toast('Open Apps to manage connections');
  }

  function canvaStatusSync() {
    var os = ensureStudioOs();
    var settings = os.settings || {};
    var CA = global.HublyConnectedApps;
    var bizId = studioBizId();
    var installed = !!(CA && bizId && typeof CA.isInstalled === 'function' && CA.isInstalled(bizId, 'canva'));
    return {
      linked: !!settings.canva_linked,
      installed: installed,
      accountLabel: settings.canva_account_label || null,
      health: settings.canva_linked ? 'healthy' : 'disconnected'
    };
  }

  function refreshCanvaStatus(done) {
    var facade = global.CanvaConnectedApp ||
      (global.HublyConnectedApps && typeof global.HublyConnectedApps.getFacade === 'function'
        ? global.HublyConnectedApps.getFacade('canva')
        : null);
    var base = canvaStatusSync();
    if (!facade || typeof facade.status !== 'function') {
      if (typeof done === 'function') done(base);
      return Promise.resolve(base);
    }
    return Promise.resolve(facade.status({ businessId: studioBizId() })).then(function (res) {
      var data = (res && res.data) || {};
      var connected = !!(data.connected || (res && res.status === 'connected'));
      var st = {
        linked: connected,
        installed: base.installed,
        accountLabel: data.accountLabel || null,
        health: data.health || (connected ? 'healthy' : 'disconnected'),
        message: (res && res.message) || ''
      };
      var os = ensureStudioOs();
      os.settings = os.settings || {};
      // Only set canva_linked true when provider reports connected — never fake it
      if (connected) {
        os.settings.canva_linked = true;
        if (st.accountLabel) os.settings.canva_account_label = st.accountLabel;
      } else if (os.settings.canva_linked && data.health === 'not_configured') {
        os.settings.canva_linked = false;
      }
      if (typeof done === 'function') done(st);
      return st;
    }).catch(function () {
      if (typeof done === 'function') done(base);
      return base;
    });
  }

  function connectCanvaFromStudio() {
    var CA = global.HublyConnectedApps;
    var bizId = studioBizId();
    var facade = global.CanvaConnectedApp ||
      (CA && typeof CA.getFacade === 'function' ? CA.getFacade('canva') : null);
    toast('Connecting Canva…');
    try {
      if (CA && bizId && typeof CA.install === 'function') CA.install(bizId, 'canva');
    } catch (e) {}
    if (facade && typeof facade.connectAndRedirect === 'function') {
      Promise.resolve(facade.connectAndRedirect({ businessId: bizId })).catch(function () {
        openAppsMarketplace('canva');
      });
      return;
    }
    if (facade && typeof facade.connect === 'function') {
      Promise.resolve(facade.connect({ businessId: bizId })).then(function (res) {
        if (res && res.ok && res.data && res.data.authorizeUrl) {
          try { global.location.href = res.data.authorizeUrl; } catch (e) {}
          return;
        }
        toast((res && res.message) || 'Canva isn’t ready yet — open Apps to finish connecting.');
        openAppsMarketplace('canva');
      }).catch(function () {
        openAppsMarketplace('canva');
      });
      return;
    }
    openAppsMarketplace('canva');
  }

  function disconnectCanvaFromStudio() {
    var CA = global.HublyConnectedApps;
    var bizId = studioBizId();
    var facade = global.CanvaConnectedApp ||
      (CA && typeof CA.getFacade === 'function' ? CA.getFacade('canva') : null);
    function finish() {
      var os = ensureStudioOs();
      os.settings = os.settings || {};
      os.settings.canva_linked = false;
      os.settings.canva_account_label = null;
      persistStudioSettings({ canva_linked: false });
      toast('Canva disconnected from Studio');
      render();
    }
    if (facade && typeof facade.disconnect === 'function') {
      Promise.resolve(facade.disconnect({ businessId: bizId })).finally(function () {
        try { if (CA && bizId) CA.uninstall(bizId, 'canva'); } catch (e) {}
        finish();
      });
      return;
    }
    try { if (CA && bizId) CA.uninstall(bizId, 'canva'); } catch (e) {}
    finish();
  }

  function persistStudioSettings(patch) {
    var os = ensureStudioOs();
    os.settings = Object.assign(os.settings || {}, patch || {});
    persistStudioMeta();
    var Api = api();
    if (Api) {
      Api.request('settings', { method: 'PATCH', body: Object.assign({}, os.settings, patch || {}) }).catch(function () {});
    }
  }

  function renderStudioSettings(root) {
    var os = ensureStudioOs();
    os.settings = os.settings || {};
    var settings = os.settings;
    if (!settings.preferences || typeof settings.preferences !== 'object') {
      settings.preferences = {
        default_publish_channel: 'email',
        open_workspace_after_generate: true,
        show_ai_creator_badge: true
      };
    }
    var prefs = settings.preferences;
    var used = gb(settings.storage_used_bytes || 0);
    var quota = gb(settings.storage_quota_bytes || 10737418240);
    var pct = Math.min(100, Math.round(((settings.storage_used_bytes || 0) / (settings.storage_quota_bytes || 1)) * 100));
    var canva = canvaStatusSync();

    var body =
      '<header class="hs-page-head hs-page-head-row">' +
      '<div><h1>Studio Settings</h1>' +
      '<p>Storage, Canva connection, and how Studio behaves for this business.</p></div>' +
      '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="settings-refresh">Refresh status</button></header>' +
      '<div class="hs-settings-grid">' +
      '<section class="hs-card hs-pad hs-settings-canva" id="hs-settings-canva">' +
      '<div class="hs-between"><h3>Canva · visual polish</h3>' +
      '<span class="hs-pill ' + (canva.linked ? 'ready' : 'draft') + '" id="hs-canva-pill">' +
      (canva.linked ? 'Connected' : 'Not connected') + '</span></div>' +
      '<p class="hs-muted">Customize Design opens Canva for optional visual editing, then returns to your Hubly campaign. Hubly never fakes a Connected status.</p>' +
      '<div class="hs-settings-canva-status" id="hs-canva-status-line">' +
      (canva.linked
        ? ('<strong>Account:</strong> ' + esc(canva.accountLabel || 'Canva linked'))
        : '<strong>Status:</strong> Not connected — campaigns still work; Customize Design needs Canva.') +
      '</div>' +
      '<div class="hs-btn-row" id="hs-canva-actions">' +
      (canva.linked
        ? '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="canva-disconnect">Disconnect Canva</button>' +
          '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="canva-manage">Manage in Apps</button>'
        : '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="canva-connect">Connect Canva</button>' +
          '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="canva-manage">Open Apps</button>') +
      '</div>' +
      '<p class="hs-muted hs-tiny">If Hubly’s Canva app credentials aren’t configured yet, Connect will open Apps and explain what’s missing — we won’t pretend it worked.</p>' +
      '</section>' +
      '<section class="hs-card hs-pad">' +
      '<h3>Cloud storage</h3>' +
      '<div class="hs-settings-storage"><strong>' + used + ' / ' + quota + ' GB</strong>' +
      '<div class="hs-storage-bar light"><i style="width:' + pct + '%"></i></div>' +
      '<p class="hs-muted hs-tiny">Uploads and Studio assets for this business.</p>' +
      '<button type="button" class="hs-link" data-hs-act="nav" data-hs-screen="uploads">Manage uploads →</button></div>' +
      '</section>' +
      '<section class="hs-card hs-pad">' +
      '<h3>Publish</h3>' +
      '<p class="hs-muted">V1 channel is <strong>Email</strong>. Social networks connect in Apps when you’re ready.</p>' +
      '<label class="hs-settings-check"><input type="checkbox" data-hs-act="settings-pref" data-hs-pref="default_publish_channel" data-hs-pref-bool="0" checked disabled> Default publish channel: Email</label>' +
      '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="nav" data-hs-screen="publish">Open Publish Center</button>' +
      '</section>' +
      '<section class="hs-card hs-pad">' +
      '<h3>Studio preferences</h3>' +
      '<label class="hs-settings-check"><input type="checkbox" data-hs-act="settings-pref" data-hs-pref="open_workspace_after_generate"' +
      (prefs.open_workspace_after_generate !== false ? ' checked' : '') + '> Open Project Workspace after generating a campaign</label>' +
      '<label class="hs-settings-check"><input type="checkbox" data-hs-act="settings-pref" data-hs-pref="show_ai_creator_badge"' +
      (prefs.show_ai_creator_badge !== false ? ' checked' : '') + '> Show NEW badge on AI Creator</label>' +
      '<label class="hs-settings-check"><input type="checkbox" data-hs-act="settings-enabled"' +
      (settings.enabled !== false ? ' checked' : '') + '> Studio enabled for this business</label>' +
      '</section>' +
      '</div>';

    root.innerHTML = shell('settings', body);

    refreshCanvaStatus(function (st) {
      var pill = root.querySelector('#hs-canva-pill');
      var line = root.querySelector('#hs-canva-status-line');
      var acts = root.querySelector('#hs-canva-actions');
      if (pill) {
        pill.textContent = st.linked ? 'Connected' : 'Not connected';
        pill.className = 'hs-pill ' + (st.linked ? 'ready' : 'draft');
      }
      if (line) {
        line.innerHTML = st.linked
          ? ('<strong>Account:</strong> ' + esc(st.accountLabel || 'Canva linked'))
          : ('<strong>Status:</strong> Not connected' + (st.message ? (' — ' + esc(st.message)) : ''));
      }
      if (acts) {
        acts.innerHTML = st.linked
          ? '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="canva-disconnect">Disconnect Canva</button>' +
            '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="canva-manage">Manage in Apps</button>'
          : '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="canva-connect">Connect Canva</button>' +
            '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="canva-manage">Open Apps</button>';
      }
    });
  }

  function renderSimple(root, screen, title, sub) {
    root.innerHTML = shell(screen,
      '<header class="hs-page-head"><h1>' + esc(title) + '</h1><p>' + esc(sub) + '</p></header>' +
      '<div class="hs-card hs-pad"><p class="hs-muted">Use AI Creator goals or Templates, then open a Project Workspace.</p>' +
      '<div class="hs-btn-row">' +
      '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="nav" data-hs-screen="ai">AI Creator</button>' +
      '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="nav" data-hs-screen="templates">Browse Templates</button>' +
      '</div></div>');
  }

  function renderEditor(root, project) {
    var os = ensureStudioOs();
    project = project || os.projects.find(function (p) { return p.id === os.ui.editorProjectId; }) || {
      id: 'draft',
      title: 'Campaign Project',
      status: 'draft',
      canvas: { headline: 'Complete Kitchen Renovation' },
      format_primary: 'instagram_post',
      export_status: 'none',
      canva_design_id: null
    };
    os.ui.editorProjectId = project.id;
    os.ui.workspaceTab = os.ui.workspaceTab || 'overview';
    var tab = os.ui.workspaceTab;
    var headline = (project.canvas && project.canvas.headline) || project.title || 'Campaign preview';
    var pkg = (project.canvas && project.canvas.package) || {};
    var planMeta = project.metadata || {};
    var channels = (pkg.captions || []).map(function (c) { return c.channel; });
    if (!channels.length) channels = [project.platform || 'instagram'];
    var pages = [
      { id: 'instagram_post', label: 'Instagram Post' },
      { id: 'facebook_feed', label: 'Facebook Feed' },
      { id: 'instagram_story', label: 'Instagram Story' },
      { id: 'google_business', label: 'Google Business' },
      { id: 'email_header', label: 'Email' }
    ];
    var activePage = os.ui.workspacePage || project.format_primary || 'instagram_post';

    var sideNav = [
      ['overview', 'Campaign Overview'],
      ['brief', 'Campaign Brief'],
      ['assets', 'Assets'],
      ['versions', 'Versions'],
      ['comments', 'Comments'],
      ['ai', 'AI Suggestions'],
      ['exports', 'Export History']
    ].map(function (t) {
      var disabled = t[0] === 'comments' ? ' disabled' : '';
      return '<button type="button" class="hs-ws-nav' + (tab === t[0] ? ' on' : '') + disabled + '" data-hs-act="workspace-tab" data-hs-tab="' + t[0] + '"' +
        (t[0] === 'comments' ? ' title="Coming soon"' : '') + '>' + esc(t[1]) +
        (t[0] === 'comments' ? ' <em>soon</em>' : '') + '</button>';
    }).join('');

    var leftBody = '';
    if (tab === 'assets') {
      var attached = ((project.canvas && project.canvas.package && project.canvas.package.elements) || []);
      var mediaAtt = ((project.canvas && project.canvas.package && project.canvas.package.media) || []);
      leftBody = '<div class="hs-ws-panel"><h3>Assets</h3><p class="hs-muted">Job photos, uploads, logo, reviews, and Elements on this campaign.</p>' +
        '<ul class="hs-ws-list"><li>Brand logo</li><li>Job photos</li><li>Review quote</li></ul>' +
        (mediaAtt.length
          ? '<div class="hs-lbl tiny">Media</div><div class="hs-attach-pills">' +
            mediaAtt.map(function (m) { return '<span>' + esc(m.name || 'Photo') + '</span>'; }).join('') +
            '</div>'
          : '<p class="hs-muted hs-tiny">No uploads attached — open Uploads or Photos.</p>') +
        (attached.length
          ? '<div class="hs-lbl tiny">Elements</div><div class="hs-attach-pills">' +
            attached.map(function (a) { return '<span>' + esc(a.glyph || '◇') + ' ' + esc(a.label || a.id) + '</span>'; }).join('') +
            '</div>'
          : '<p class="hs-muted hs-tiny">No Elements yet — open the Elements tab to attach badges and CTAs.</p>') +
        '<div class="hs-btn-row">' +
        '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="nav" data-hs-screen="uploads">Uploads</button>' +
        '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="nav" data-hs-screen="photos">Photos</button>' +
        '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="nav" data-hs-screen="elements">Elements</button>' +
        '</div></div>';
    } else if (tab === 'brief') {
      var brief = (project.canvas && project.canvas.brief) || project.brief || null;
      leftBody = '<div class="hs-ws-panel"><h3>Campaign Brief</h3>' +
        (brief
          ? '<dl class="hs-brief-dl">' +
            '<div><dt>Campaign</dt><dd>' + esc(brief.campaign || project.title) + '</dd></div>' +
            '<div><dt>Goal</dt><dd>' + esc(brief.goal || '') + '</dd></div>' +
            '<div><dt>Channel</dt><dd>' + esc(brief.channel || V1_CHANNEL) + '</dd></div>' +
            '<div><dt>Tone</dt><dd>' + esc(brief.tone || '') + '</dd></div>' +
            '<div><dt>CTA</dt><dd>' + esc(brief.cta || '') + '</dd></div>' +
            '</dl><p class="hs-muted hs-tiny">AI Writer uses this brief only — strategy stays in the Campaign Engine.</p>'
          : '<p class="hs-muted">Brief is created when you generate from a playbook.</p>') +
        '</div>';
    } else if (tab === 'versions') {
      leftBody = '<div class="hs-ws-panel"><h3>Versions</h3><p class="hs-muted">Hubly keeps version history as you generate and return from visual edits.</p>' +
        '<div class="hs-ws-version on"><strong>v1 · Created in Hubly</strong><span>' + esc(relativeEdit(project.last_edited_at || project.created_at)) + '</span></div></div>';
    } else if (tab === 'ai') {
      var alts = (pkg.headlines && pkg.headlines.length)
        ? pkg.headlines
        : [headline, bizName() + ' — ' + headline, headline + (S().city ? (' in ' + S().city) : '')].filter(Boolean);
      leftBody = '<div class="hs-ws-panel hs-ai-panel"><h3>AI Suggestions</h3>' +
        '<p class="hs-muted hs-tiny">From your Campaign Engine package + business facts. Tap a headline to apply.</p>' +
        '<div class="hs-lbl tiny">Headlines</div>' +
        alts.map(function (a, i) {
          return '<button type="button" class="hs-alt' + ((a === headline || i === 0) ? ' on' : '') + '" data-hs-act="set-headline" data-hs-text="' + esc(a) + '">' + esc(a) + '</button>';
        }).join('') +
        '<div class="hs-lbl tiny">Quick commands</div><div class="hs-cmd-wrap">' +
        ['Make headline punchier', 'Rewrite for expert authority', 'Vary caption 5 times'].map(function (c) {
          return '<button type="button" class="hs-cmd" data-hs-act="ai-cmd" data-hs-cmd="' + esc(c) + '">' + esc(c) + '</button>';
        }).join('') + '</div></div>';
    } else if (tab === 'exports') {
      leftBody = '<div class="hs-ws-panel"><h3>Export History</h3>' +
        '<p class="hs-muted">Status: <strong>' + esc(project.export_status || 'none') + '</strong></p>' +
        '<p class="hs-muted">Exports appear after you customize visuals and Hubly pulls finished files.</p></div>';
    } else {
      leftBody = '<div class="hs-ws-panel"><h3>Campaign Overview</h3>' +
        '<p>' + esc((project.prompt || 'Structured campaign package ready for publish.').slice(0, 280)) + '</p>' +
        '<div class="hs-lbl tiny">Channels</div><div class="hs-attach-pills">' +
        channels.map(function (c) { return '<span>' + esc(String(c)) + '</span>'; }).join('') +
        '</div>' +
        (pkg.schedule_suggestions && pkg.schedule_suggestions.length
          ? '<div class="hs-lbl tiny">Schedule ideas</div><ul class="hs-ws-list">' +
            pkg.schedule_suggestions.slice(0, 3).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>'
          : '') +
        '</div>';
    }

    var pageChips = pages.map(function (p) {
      return '<button type="button" class="hs-page-chip' + (activePage === p.id ? ' on' : '') + '" data-hs-act="workspace-page" data-hs-page="' + p.id + '">' +
        '<span class="hs-page-thumb"></span>' + esc(p.label) + '</button>';
    }).join('');

    var rev = reviewLine(project);
    var starStr = '★★★★★'.slice(0, Math.min(5, Math.max(1, Math.round(rev.stars || 5))));
    var phone = S().phone || bizContext().phone || '';
    var pageLabel = (pages.find(function (p) { return p.id === activePage; }) || {}).label || 'Preview';
    var caption = '';
    try {
      var caps = pkg.captions || [];
      var matchCap = caps.find(function (c) {
        return c && String(c.channel || '').indexOf(String(activePage).split('_')[0]) === 0;
      });
      caption = (matchCap && matchCap.text) || (caps[0] && caps[0].text) || '';
    } catch (e) {}

    root.innerHTML =
      '<div class="hs-workspace-shell hs-editor-shell">' +
      '<aside class="hs-ws-left">' +
      '<div class="hs-ws-back">' +
      '<button type="button" class="hs-link" data-hs-act="close-editor">← Projects</button></div>' +
      '<nav class="hs-ws-sidenav" aria-label="Project sections">' + sideNav + '</nav>' +
      leftBody +
      '</aside>' +
      '<div class="hs-canvas-wrap">' +
      '<header class="hs-editor-top">' +
      '<div class="hs-editor-title"><strong id="hs-editor-title">' + esc(project.title) + '</strong>' +
      '<span class="hs-pill ' + (project.status === 'ready' ? 'ready' : 'draft') + '">' + esc(project.status || 'draft') + '</span></div>' +
      '<div class="hs-head-actions">' +
      '<button type="button" class="hs-btn hs-btn-ghost hs-btn-back-hubly" data-hs-act="leave-studio">← Back to Hubly</button>' +
      '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="publish-email">✈ Publish Email</button>' +
      '<button type="button" class="hs-btn hs-btn-brand hs-btn-customize" data-hs-act="customize-design">Customize Design</button>' +
      '</div></header>' +
      '<div class="hs-ws-mobile-strip" aria-label="Workspace sections">' +
      '<div class="hs-ws-mobile-scroll">' + sideNav + '</div></div>' +
      '<div class="hs-canvas hs-preview-canvas">' +
      '<div class="hs-design hs-design-preview hs-page-' + esc(activePage) + '" id="hs-design">' +
      '<div class="hs-design-photos">' +
      (pkg.photo_url
        ? '<div class="hs-ph before has-img"><img src="' + esc(pkg.photo_url) + '" alt=""></div><div class="hs-ph after"></div>'
        : '<div class="hs-ph before"></div><div class="hs-ph after"></div>') +
      '<span class="hs-biz-pill">' + esc(bizName()) + '</span></div>' +
      '<div class="hs-design-headline">' +
      '<h2 id="hs-canvas-headline" contenteditable="true" spellcheck="false">' + esc(headline) + '</h2></div>' +
      '<div class="hs-design-review">' + starStr + ' <em>“' + esc(rev.quote) + '” — ' + esc(rev.author) + '</em></div>' +
      (caption ? '<p class="hs-design-caption">' + esc(caption.slice(0, 180)) + '</p>' : '') +
      '<div class="hs-design-cta"><span>NEED SERVICE?</span><strong>' +
      (phone ? ('Call ' + esc(phone)) : esc((pkg.cta || 'Book now'))) + '</strong></div>' +
      (function () {
        var els = pkg.elements || [];
        if (!els.length) return '';
        return '<div class="hs-design-elements">' + els.slice(0, 4).map(function (a) {
          return '<span class="hs-el-chip tone-' + esc(a.tone || 'brand') + '">' + esc(a.glyph || '◇') + ' ' + esc(a.label || '') + '</span>';
        }).join('') + '</div>';
      })() +
      '<div class="hs-preview-note">Showing ' + esc(pageLabel) + ' · Campaign Engine package (playbook). Visual polish opens in Customize Design.</div>' +
      '</div></div>' +
      '<footer class="hs-pages-bar"><span class="hs-lbl tiny">PAGES IN SET</span><div class="hs-pages-row">' + pageChips + '</div>' +
      '<span class="hs-export-pill">Export: ' + esc(project.export_status || 'none') +
      (project.canva_design_id ? ' · Design linked' : '') + '</span></footer>' +
      '</div>' +
      '<aside class="hs-props hs-ws-meta">' +
      '<h3>Campaign</h3>' +
      '<label>Campaign Name<input type="text" id="hs-ws-name" value="' + esc(project.title) + '" readonly></label>' +
      '<label>Status<input type="text" value="' + esc(project.status || 'draft') + '" readonly></label>' +
      '<div class="hs-lbl">Channels</div><div class="hs-attach-pills">' +
      channels.map(function (c) { return '<span>' + esc(String(c)) + '</span>'; }).join('') + '</div>' +
      '<label>Publish Date<input type="text" value="Not scheduled" readonly></label>' +
      '<label>Brand Kit<input type="text" value="' + esc(bizName()) + '" readonly></label>' +
      '<div class="hs-lbl">Assets Used</div><p class="hs-muted hs-tiny">Logo · Job photos · Review</p>' +
      '<div class="hs-lbl">AI Summary</div><p class="hs-muted hs-tiny">' +
      esc((planMeta.summary || project.prompt || 'Campaign package generated from Hubly playbooks.').slice(0, 160)) + '</p>' +
      '<div class="hs-lbl">Performance Goals</div><p class="hs-muted hs-tiny">Campaigns created · Campaigns published · Posting frequency</p>' +
      '<div class="hs-ws-cta-block">' +
      '<button type="button" class="hs-btn hs-btn-brand hs-btn-block" data-hs-act="customize-design">Customize Design</button>' +
      '<p class="hs-muted hs-tiny">Hubly stays open. Visual edit is one step — you return to this project.</p>' +
      '</div></aside></div>';

    // Soft-hydrate workspace from API when available
    var Api = api();
    if (Api && project.id && String(project.id).indexOf('loc_') !== 0 && String(project.id).indexOf('demo') !== 0) {
      Api.request('projects/' + project.id + '/workspace', { method: 'GET' }).then(function (res) {
        if (!res || res.error || !res.project) return;
        var idx = (os.projects || []).findIndex(function (p) { return p.id === res.project.id; });
        if (idx >= 0) os.projects[idx] = Object.assign({}, os.projects[idx], res.project);
        if (res.campaignPlan && os.projects[idx]) {
          os.projects[idx].canvas = os.projects[idx].canvas || {};
          os.projects[idx].canvas.package = res.campaignPlan.package || os.projects[idx].canvas.package;
        }
      }).catch(function () {});
    }
  }

  function openEditorFor(project, opts) {
    opts = opts || {};
    var root = ownRoot();
    if (!root) return;
    setMode(true);
    var os = ensureStudioOs();
    var nextId = project && project.id;
    var switching = !!(nextId && nextId !== os.ui.editorProjectId);
    os.ui.screen = 'editor';
    os.ui.editorProjectId = nextId || os.ui.editorProjectId;
    // Only reset workspace chrome when opening a different project (tab clicks must stick).
    if (switching || opts.resetWorkspace) {
      os.ui.workspaceTab = 'overview';
      os.ui.workspacePage = (project && project.format_primary) || 'instagram_post';
    }
    if (opts.tab) os.ui.workspaceTab = opts.tab;
    if (opts.page) os.ui.workspacePage = opts.page;
    if (!os.ui.workspaceTab) os.ui.workspaceTab = 'overview';
    renderEditor(root, project || currentProject());
    wireRoot(root);
  }

  function createProject(opts, thenOpen) {
    opts = opts || {};
    var Api = api();
    var payload = {
      title: opts.title || (bizName() + ' — ' + (opts.format || 'instagram_post').replace(/_/g, ' ')),
      format_primary: opts.format || 'instagram_post',
      platform: opts.platform || 'instagram',
      style: opts.style || 'bold',
      tone: opts.tone || 'expert',
      prompt: opts.prompt || '',
      canvas: opts.canvas || { headline: opts.headline || opts.title || 'Campaign preview' },
      metadata: opts.metadata || {},
      campaign_plan_id: opts.campaign_plan_id || null
    };
    function done(project) {
      var os = ensureStudioOs();
      if (project && !(os.projects || []).some(function (p) { return p.id === project.id; })) {
        os.projects.unshift(project);
      }
      persistStudioMeta();
      if (thenOpen !== false) openEditorFor(project, { resetWorkspace: true });
      else render();
    }
    if (Api) {
      Api.request('projects', { method: 'POST', body: payload }).then(function (res) {
        done((res && res.project) || payload);
      }).catch(function () {
        done(Object.assign({ id: 'loc_' + Date.now(), last_edited_at: new Date().toISOString(), status: 'draft' }, payload));
      });
    } else {
      done(Object.assign({ id: 'loc_' + Date.now(), last_edited_at: new Date().toISOString(), status: 'draft' }, payload));
    }
  }

  function generateCampaign(goalId, extra) {
    extra = extra || {};
    var Api = api();
    var goal = CAMPAIGN_GOALS.find(function (g) { return g.id === goalId; });
    var ctx = bizContext();
    toast('Building campaign package…');
    var focus = extra.service_focus || ctx.service_focus || null;
    if (goalId === 'promote_service' && !focus) focus = (ctx.services && ctx.services[0]) || 'Featured service';
    var body = {
      goal_id: goalId,
      playbook_id: GOAL_TO_PLAYBOOK[goalId] || null,
      business_name: ctx.business_name,
      phone: ctx.phone,
      city: ctx.city,
      services: ctx.services,
      create_project: true,
      service_focus: goalId === 'promote_service' ? focus : (extra.service_focus || null),
      latest_review: ctx.latest_review || null,
      has_before_after: !!ctx.has_before_after,
      job_photos_count: ctx.job_photos_count || 0,
      completed_jobs_week: ctx.completed_jobs_week || 0,
      has_logo: ctx.has_logo,
      has_membership: ctx.has_membership
    };
    function fallbackLocal() {
      var title = (goal && goal.title) || 'Campaign';
      var rev = ctx.latest_review;
      var headlines = [title];
      if (ctx.city) headlines.push(title + ' in ' + ctx.city);
      if (focus) headlines.push(focus + ' — book with ' + ctx.business_name);
      createProject({
        title: title,
        prompt: 'Campaign goal: ' + goalId + ' for ' + ctx.business_name,
        headline: title,
        metadata: { goal_id: goalId },
        canvas: {
          headline: title,
          package: {
            headlines: headlines,
            captions: [{ channel: 'instagram', text: title + ' — ' + ctx.business_name + (ctx.phone ? (' · ' + ctx.phone) : '') }],
            review: rev || null,
            cta: ctx.phone ? ('Call ' + ctx.phone) : 'Book now',
            email: { subject: title, body: title + '\n\n' + ctx.business_name + (ctx.phone ? ('\n' + ctx.phone) : '') },
            schedule_suggestions: ['Tomorrow 12:00 PM — peak local engagement window']
          },
          brief: {
            campaign: title,
            goal: goalId,
            channel: V1_CHANNEL,
            business_name: ctx.business_name,
            service_name: focus,
            review_text: rev && rev.quote,
            cta: 'Book now'
          }
        }
      });
    }
    if (!Api) return fallbackLocal();
    Api.request('campaign/plan', { method: 'POST', body: body }).then(function (res) {
      if (res && res.project) {
        var os = ensureStudioOs();
        var project = res.project;
        if (res.campaignPlan) {
          project.canvas = project.canvas || {};
          project.canvas.package = res.campaignPlan.package;
          if (ctx.latest_review && project.canvas.package && !project.canvas.package.review) {
            project.canvas.package.review = ctx.latest_review;
          }
          project.canvas.headline = (res.campaignPlan.package && res.campaignPlan.package.headlines && res.campaignPlan.package.headlines[0]) || project.title;
          project.prompt = res.campaignPlan.ai_brief || project.prompt;
        }
        if (res.brief) {
          project.canvas = project.canvas || {};
          project.canvas.brief = res.brief;
          project.brief = res.brief;
        }
        if (!(os.projects || []).some(function (p) { return p.id === project.id; })) {
          os.projects.unshift(project);
        }
        persistStudioMeta();
        openEditorFor(project, { resetWorkspace: true });
        return;
      }
      if (res && res.campaignPlan) {
        var plan = res.campaignPlan;
        if (ctx.latest_review && plan.package && !plan.package.review) plan.package.review = ctx.latest_review;
        return createProject({
          title: plan.title,
          prompt: plan.ai_brief,
          headline: (plan.package && plan.package.headlines && plan.package.headlines[0]) || plan.title,
          metadata: { goal_id: plan.goal_id, playbook_id: plan.playbook_id },
          canvas: { headline: plan.title, package: plan.package, brief: res.brief || null }
        });
      }
      fallbackLocal();
    }).catch(function () { fallbackLocal(); });
  }

  function handleAct(act, t, root) {
    var os = ensureStudioOs();
    if (act === 'toggle-nav') {
      return toggleStudioNav(root);
    }
    if (act === 'close-nav') {
      return closeStudioNav(root);
    }
    if (act === 'leave-studio') {
      closeStudioNav(root);
      return leaveStudio();
    }
    if (act === 'nav') {
      os.ui.screen = t.getAttribute('data-hs-screen') || 'home';
      closeStudioNav(root);
      return render();
    }
    if (act === 'go-settings') {
      os.ui.screen = 'settings';
      closeStudioNav(root);
      return render();
    }
    if (act === 'canva-connect') {
      connectCanvaFromStudio();
      return;
    }
    if (act === 'canva-disconnect') {
      disconnectCanvaFromStudio();
      return;
    }
    if (act === 'canva-manage') {
      openAppsMarketplace('canva');
      return;
    }
    if (act === 'settings-refresh') {
      toast('Refreshing connection status…');
      return render();
    }
    if (act === 'settings-enabled') {
      persistStudioSettings({ enabled: !!t.checked });
      toast(t.checked ? 'Studio enabled' : 'Studio disabled for this business');
      return;
    }
    if (act === 'settings-pref') {
      var key = t.getAttribute('data-hs-pref');
      if (!key) return;
      os.settings = os.settings || {};
      os.settings.preferences = os.settings.preferences || {};
      os.settings.preferences[key] = !!t.checked;
      persistStudioSettings({ preferences: os.settings.preferences });
      return;
    }
    if (act === 'blank') {
      return createProject({ format: t.getAttribute('data-hs-format') || 'instagram_post' });
    }
    if (act === 'ai-draft') {
      var prompt = (el('hs-home-prompt') || {}).value || '';
      return createProject({ prompt: prompt, title: prompt ? prompt.slice(0, 48) : 'AI Draft' });
    }
    if (act === 'quick-draft' || act === 'objective' || act === 'use-template') {
      return createProject({
        title: t.getAttribute('data-hs-title') || t.getAttribute('data-hs-obj') || 'Studio draft',
        format: t.getAttribute('data-hs-format') || 'instagram_post'
      });
    }
    if (act === 'generate-layout') {
      var p = (el('hs-ai-prompt') || {}).value || '';
      var goalFromPrompt = /review/i.test(p) ? 'get_more_reviews'
        : /refer/i.test(p) ? 'referral'
        : /member/i.test(p) ? 'membership_drive'
        : /schedule|tomorrow|open slot/i.test(p) ? 'fill_tomorrow_schedule'
        : /before|after|job/i.test(p) ? 'book_more_jobs'
        : 'get_more_reviews';
      return generateCampaign(goalFromPrompt);
    }
    if (act === 'campaign-goal') {
      var g = t.getAttribute('data-hs-goal') || 'book_more_jobs';
      var pb = t.getAttribute('data-hs-playbook');
      if (pb) GOAL_TO_PLAYBOOK[g] = pb;
      return generateCampaign(g);
    }
    if (act === 'open-project') {
      if (t.getAttribute('data-hs-placeholder') === '1') {
        return createProject({ title: t.querySelector('strong') ? t.querySelector('strong').textContent : 'New project' });
      }
      var id = t.getAttribute('data-hs-id');
      var proj = (os.projects || []).find(function (x) { return x.id === id; });
      if (proj) return openEditorFor(proj);
      toast('Project not found');
      return;
    }
    if (act === 'close-editor') {
      os.ui.screen = 'projects';
      os.ui.editorProjectId = null;
      return render();
    }
    if (act === 'workspace-tab') {
      var tabId = t.getAttribute('data-hs-tab') || 'overview';
      if (tabId === 'comments' || t.classList.contains('disabled')) {
        toast('Comments coming soon');
        return;
      }
      return refreshWorkspace({ tab: tabId });
    }
    if (act === 'workspace-page') {
      return refreshWorkspace({ page: t.getAttribute('data-hs-page') || 'instagram_post' });
    }
    if (act === 'customize-design') {
      var projC = os.projects.find(function (p) { return p.id === os.ui.editorProjectId; });
      if (!projC) return toast('Open a project first');
      var ApiC = api();
      var correlation = String(projC.id || '').slice(0, 50);
      toast('Preparing visual editor…');
      if (ApiC && String(projC.id).indexOf('loc_') !== 0) {
        ApiC.request('projects/' + projC.id + '/customize', {
          method: 'POST',
          body: { correlation_state: correlation }
        }).then(function (res) {
          if (res && res.edit_url) {
            try { window.open(res.edit_url, '_blank', 'noopener'); } catch (e) {}
            toast('Edit in the visual editor — you will return to this Hubly project.');
            return;
          }
          toast((res && res.message) || 'Visual editor not connected yet. Your Hubly project is ready — connect the creative engine in Apps.');
        }).catch(function () {
          toast('Visual editor not connected yet. Connect via Apps — Hubly keeps your campaign package.');
        });
      } else {
        toast('Visual editor not connected yet. Connect via Apps — Hubly keeps your campaign package.');
      }
      return;
    }
    if (act === 'set-headline') {
      var text = t.getAttribute('data-hs-text') || '';
      var h = el('hs-canvas-headline');
      if (h) h.textContent = text;
      var proj2 = currentProject();
      if (proj2) {
        proj2.canvas = proj2.canvas || {};
        proj2.canvas.headline = text;
        proj2.canvas.package = proj2.canvas.package || {};
        var hl = proj2.canvas.package.headlines || [];
        if (text && hl.indexOf(text) === -1) hl.unshift(text);
        proj2.canvas.package.headlines = hl;
        persistStudioMeta();
        var Api = api();
        if (Api && String(proj2.id).indexOf('loc_') !== 0 && String(proj2.id).indexOf('demo') !== 0) {
          Api.request('projects/' + proj2.id, { method: 'PATCH', body: { canvas: proj2.canvas } }).catch(function () {});
        }
      }
      root.querySelectorAll('.hs-alt').forEach(function (a) { a.classList.remove('on'); });
      t.classList.add('on');
      return;
    }
    if (act === 'ai-cmd' || act === 'editor-ask') {
      var cmd = t.getAttribute('data-hs-cmd') || '';
      var projAi = currentProject();
      if (!projAi) {
        toast('Open a campaign project first');
        return;
      }
      projAi.canvas = projAi.canvas || {};
      projAi.canvas.package = projAi.canvas.package || {};
      var heads = (projAi.canvas.package.headlines || [projAi.title || 'Campaign']).slice();
      var base = heads[0] || projAi.title || 'Campaign';
      if (/punchier/i.test(cmd)) {
        heads = [base.replace(/\.$/, '') + ' — Book This Week', base.toUpperCase() === base ? base : (base + '!'), 'Don\'t Wait — ' + base];
      } else if (/authority|expert/i.test(cmd)) {
        heads = ['Trusted ' + bizName() + ': ' + base, base + ' by Local Pros', 'Expert Results from ' + bizName()];
      } else if (/caption|vary/i.test(cmd)) {
        var caps = [];
        for (var i = 1; i <= 5; i++) {
          caps.push({ channel: 'instagram', text: base + ' · Option ' + i + ' — ' + bizName() + (S().phone ? (' · ' + S().phone) : '') });
        }
        projAi.canvas.package.captions = caps;
        persistStudioMeta();
        refreshWorkspace({ tab: 'ai' });
        toast('Generated 5 caption variations from your campaign package');
        return;
      } else {
        heads = [base, bizName() + ' — ' + base, base + (S().city ? (' in ' + S().city) : '')];
      }
      projAi.canvas.package.headlines = heads.filter(Boolean);
      projAi.canvas.headline = heads[0];
      persistStudioMeta();
      refreshWorkspace({ tab: 'ai' });
      toast('Updated headlines from your campaign package');
      return;
    }
    if (act === 'publish-email' || act === 'publish-queue' || act === 'publish-project' || act === 'publish-now') {
      var proj3 = null;
      if (act === 'publish-project') {
        var pid = t.getAttribute('data-hs-id');
        proj3 = (os.projects || []).find(function (p) { return p.id === pid; });
      } else if (act === 'publish-now') {
        proj3 = currentProject() || (os.projects || []).find(function (p) { return p && p.status !== 'published'; }) || null;
        if (!proj3) {
          toast('Create a campaign in AI Creator first — then publish by email here.');
          os.ui.screen = 'ai';
          return render();
        }
      } else {
        proj3 = (os.projects || []).find(function (p) { return p.id === os.ui.editorProjectId; });
      }
      if (!proj3) {
        toast('Open or select a campaign to publish');
        return;
      }
      publishCampaignEmail(proj3);
      return;
    }
    if (act === 'an-range') {
      var d = parseInt(t.getAttribute('data-hs-days'), 10) || 30;
      ensureStudioOs().ui.analyticsDays = d;
      return render();
    }
    if (act === 'schedule-post') {
      toast('Social scheduling is deferred until Instagram/Facebook are connected in Apps. V1 publishes by Email.');
      return;
    }
    if (act === 'share-link') {
      toast('Share link — available after project publish');
      return;
    }
    if (act === 'studio-guide') {
      toast('Studio Guide — pick a campaign goal, review the package in Project Workspace, Customize Design if needed, then Publish in Hubly.');
      return;
    }
    if (act === 'tpl-source') {
      root.querySelectorAll('.hs-tpl-sources .hs-cat').forEach(function (c) { c.classList.remove('on'); });
      t.classList.add('on');
      if (t.getAttribute('data-hs-source') === 'ai') {
        os.ui.screen = 'ai';
        return render();
      }
      if (t.getAttribute('data-hs-source') === 'canva') {
        toast('Design library connects when the creative engine is linked in Apps.');
      }
      return;
    }
    if (act === 'apply-brand') {
      applyBrandToDrafts();
      return;
    }
    if (act === 'brand-save') {
      saveBrandKit({ message: 'Brand Kit saved' });
      return;
    }
    if (act === 'upload-logo') {
      var fileInput = el('hs-brand-logo-file');
      if (!fileInput) {
        toast('Logo upload unavailable — refresh Studio');
        return;
      }
      fileInput.onchange = function () {
        var f = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        if (!f) return;
        toast('Uploading logo…');
        readLogoFile(f);
      };
      fileInput.click();
      return;
    }
    if (act === 'brand-logo-clear') {
      var kitClear = ensureBrandKit();
      kitClear.logos = [];
      try { S().logoUrl = null; } catch (e) {}
      saveBrandKit({ message: 'Logo removed' });
      return render();
    }
    if (act === 'brand-color-add') {
      ensureBrandKit().colors.push({ id: 'c_' + Date.now(), name: 'New color', hex: '#D9632D' });
      saveBrandKit({ toast: false });
      return render();
    }
    if (act === 'brand-color-del') {
      var di = parseInt(t.getAttribute('data-hs-color-i'), 10);
      var kitDel = ensureBrandKit();
      if (kitDel.colors.length <= 1) {
        toast('Keep at least one brand color');
        return;
      }
      if (!isNaN(di)) kitDel.colors.splice(di, 1);
      saveBrandKit({ message: 'Color removed' });
      return render();
    }
    if (act === 'brand-color-hex' || act === 'brand-color-hex-text' || act === 'brand-color-name') {
      var ci = parseInt(t.getAttribute('data-hs-color-i'), 10);
      var kitC = ensureBrandKit();
      if (isNaN(ci) || !kitC.colors[ci]) return;
      if (act === 'brand-color-name') {
        kitC.colors[ci].name = t.value || kitC.colors[ci].name;
      } else {
        var hex = String(t.value || '').trim();
        if (act === 'brand-color-hex-text' && hex && hex.charAt(0) !== '#') hex = '#' + hex;
        if (/^#[0-9A-Fa-f]{6}$/.test(hex) || act === 'brand-color-hex') {
          kitC.colors[ci].hex = hex;
          var sw = t.closest('.hs-color-edit');
          if (sw) {
            var chip = sw.querySelector('i');
            if (chip) chip.style.background = hex;
            var hexField = sw.querySelector('.hs-color-hex');
            var colorField = sw.querySelector('input[type=color]');
            if (hexField && act !== 'brand-color-hex-text') hexField.value = hex;
            if (colorField && act !== 'brand-color-hex') colorField.value = hex;
          }
        }
      }
      saveBrandKit({ toast: false });
      return;
    }
    if (act === 'brand-type') {
      var which = t.getAttribute('data-hs-type') || 'heading';
      ensureBrandKit().typography[which] = t.value;
      saveBrandKit({ toast: false });
      return;
    }
    if (act === 'brand-voice-toggle') {
      var vi = parseInt(t.getAttribute('data-hs-voice-i'), 10);
      var kitV = ensureBrandKit();
      if (!isNaN(vi) && kitV.voice_tones[vi]) {
        kitV.voice_tones[vi].status = kitV.voice_tones[vi].status === 'active' ? 'supporting' : 'active';
        saveBrandKit({ toast: false });
        return render();
      }
      return;
    }
    if (act === 'brand-voice-label' || act === 'brand-voice-blurb') {
      var vj = parseInt(t.getAttribute('data-hs-voice-i'), 10);
      var kitVb = ensureBrandKit();
      if (!isNaN(vj) && kitVb.voice_tones[vj]) {
        if (act === 'brand-voice-label') kitVb.voice_tones[vj].label = t.value;
        else kitVb.voice_tones[vj].blurb = t.value;
        saveBrandKit({ toast: false });
      }
      return;
    }
    if (act === 'brand-voice-add') {
      ensureBrandKit().voice_tones.push({
        id: 'v_' + Date.now(),
        label: 'New voice',
        status: 'supporting',
        blurb: 'Describe how this voice should sound in campaigns.'
      });
      saveBrandKit({ toast: false });
      return render();
    }
    if (act === 'brand-voice-del') {
      var vd = parseInt(t.getAttribute('data-hs-voice-i'), 10);
      var kitVd = ensureBrandKit();
      if (kitVd.voice_tones.length <= 1) {
        toast('Keep at least one voice');
        return;
      }
      if (!isNaN(vd)) kitVd.voice_tones.splice(vd, 1);
      saveBrandKit({ message: 'Voice removed' });
      return render();
    }
    if (act === 'el-cat') {
      ensureElementsState().cat = t.getAttribute('data-hs-cat') || 'all';
      return render();
    }
    if (act === 'el-fav') {
      var elId = t.getAttribute('data-hs-el');
      var est = ensureElementsState();
      var ix = est.favorites.indexOf(elId);
      if (ix >= 0) est.favorites.splice(ix, 1);
      else if (elId) est.favorites.push(elId);
      persistStudioMeta();
      return render();
    }
    if (act === 'el-attach') {
      var attachId = t.getAttribute('data-hs-el');
      var elDef = findElement(attachId);
      if (!elDef) {
        toast('Element not found');
        return;
      }
      var projEl = currentProject();
      if (projEl && attachElementToProject(projEl, attachId)) {
        persistStudioMeta();
        toast('Added “' + elDef.label + '” to ' + (projEl.title || 'campaign'));
        openEditorFor(projEl, { tab: 'assets' });
        return;
      }
      // No open project — create a campaign draft with this element attached
      createProject({
        title: bizName() + ' — ' + elDef.label,
        prompt: 'Campaign using element: ' + elDef.label,
        headline: elDef.label,
        canvas: {
          headline: elDef.label,
          package: {
            headlines: [elDef.label, bizName() + ' · ' + elDef.label],
            captions: [{ channel: 'instagram', text: elDef.label + ' — ' + bizName() }],
            elements: [{
              id: elDef.id,
              label: elDef.label,
              cat: elDef.cat,
              glyph: elDef.glyph,
              tone: elDef.tone,
              attached_at: new Date().toISOString()
            }],
            schedule_suggestions: ['Tomorrow 12:00 PM — peak local engagement window']
          }
        }
      });
      return;
    }
    if (act === 'media-upload') {
      var upInput = el('hs-uploads-file');
      if (!upInput) {
        // Ensure uploads screen is mounted with the file input
        ensureStudioOs().ui.screen = 'uploads';
        render();
        upInput = el('hs-uploads-file');
      }
      if (!upInput) {
        toast('Upload control unavailable — refresh Studio');
        return;
      }
      upInput.onchange = function () {
        var list = upInput.files;
        upInput.value = '';
        ingestUploadFiles(list);
      };
      upInput.click();
      return;
    }
    if (act === 'media-delete') {
      var delId = t.getAttribute('data-hs-asset-id');
      var osDel = ensureStudioOs();
      osDel.assets = (osDel.assets || []).filter(function (a) { return a.id !== delId; });
      refreshStorageFromAssets();
      persistStudioMeta();
      var ApiDel = api();
      if (ApiDel && delId && String(delId).indexOf('up_') !== 0) {
        ApiDel.request('assets/' + delId, { method: 'DELETE' }).catch(function () {});
      }
      toast('Removed from Uploads');
      return render();
    }
    if (act === 'media-attach' || act === 'photo-attach') {
      var asset = null;
      if (act === 'media-attach') {
        var aid = t.getAttribute('data-hs-asset-id');
        asset = (ensureStudioOs().assets || []).find(function (a) { return a.id === aid; });
      } else {
        asset = {
          id: 'photo_' + Date.now(),
          url: t.getAttribute('data-hs-photo-url'),
          name: t.getAttribute('data-hs-photo-name') || 'Job photo',
          kind: 'job_photo'
        };
      }
      if (!asset || !asset.url) {
        toast('Media not found');
        return;
      }
      var projM = currentProject();
      if (projM && attachMediaToProject(projM, asset)) {
        persistStudioMeta();
        toast('Added media to ' + (projM.title || 'campaign'));
        openEditorFor(projM, { tab: 'assets' });
        return;
      }
      createProject({
        title: bizName() + ' — ' + (asset.name || 'Photo campaign'),
        prompt: 'Campaign from uploaded media',
        headline: asset.name || 'Photo spotlight',
        canvas: {
          headline: asset.name || 'Photo spotlight',
          package: {
            headlines: [asset.name || 'Photo spotlight'],
            captions: [{ channel: 'instagram', text: (asset.name || 'New work') + ' — ' + bizName() }],
            media: [{ id: asset.id, url: asset.url, name: asset.name, kind: asset.kind || 'upload', attached_at: new Date().toISOString() }],
            photo_url: asset.url,
            schedule_suggestions: ['Tomorrow 12:00 PM — peak local engagement window']
          }
        }
      });
      return;
    }
    if (act === 'set-platform' || act === 'set-style' || act === 'set-tone') {
      var group = t.parentElement;
      if (group) group.querySelectorAll('.hs-pill-tog').forEach(function (b) { b.classList.remove('on'); });
      t.classList.add('on');
      return;
    }
    if (act === 'tpl-cat') {
      root.querySelectorAll('.hs-cat').forEach(function (c) { c.classList.remove('on'); });
      t.classList.add('on');
      return;
    }
    if (act === 'noop') return;
  }

  function wireRoot(root) {
    if (!root) return;
    if (root._hsBound) return;
    root._hsBound = true;
    root.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-hs-act]') : null;
      if (!t || !root.contains(t)) return;
      var tag = (t.tagName || '').toLowerCase();
      // Native fields use change/input — don't steal focus or block the picker.
      if (tag === 'select' || tag === 'textarea') return;
      if (tag === 'input' && t.type !== 'button' && t.type !== 'submit') return;
      var act = t.getAttribute('data-hs-act') || '';
      if (!act) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        handleAct(act, t, root);
      } catch (err) {
        console.warn('Hubly Studio action failed', act, err);
        toast('That action failed — try again');
      }
    });
    root.addEventListener('change', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-hs-act]') : null;
      if (!t || !root.contains(t)) return;
      var act = t.getAttribute('data-hs-act') || '';
      if (!act) return;
      try {
        handleAct(act, t, root);
      } catch (err) {
        console.warn('Hubly Studio change failed', act, err);
      }
    });
    root.addEventListener('input', function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      var act = t.getAttribute('data-hs-act') || '';
      if (!act || (act.indexOf('brand-') !== 0 && act !== 'set-headline')) return;
      if (act === 'brand-color-hex') return; // color picker fires change
      try {
        handleAct(act, t, root);
      } catch (err) {}
    });
    root.addEventListener('blur', function (e) {
      if (e.target && e.target.id === 'hs-canvas-headline') {
        var proj = currentProject();
        if (proj) {
          proj.canvas = proj.canvas || {};
          proj.canvas.headline = e.target.textContent || '';
          if (proj.canvas.package) proj.canvas.package.headlines = proj.canvas.package.headlines || [];
          persistStudioMeta();
        }
      }
    }, true);
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeStudioNav(root);
    });
  }

  function renderScreen(root) {
    var os = ensureStudioOs();
    var screen = os.ui.screen || 'home';
    if (screen === 'editor') return renderEditor(root);
    if (screen === 'ai') return renderAiCreator(root);
    if (screen === 'templates') return renderTemplates(root);
    if (screen === 'brand') return renderBrandKit(root);
    if (screen === 'publish') return renderPublish(root);
    if (screen === 'analytics') return renderAnalytics(root);
    if (screen === 'projects') return renderProjects(root);
    if (screen === 'photos') return renderPhotos(root);
    if (screen === 'elements') return renderElements(root);
    if (screen === 'uploads') return renderUploads(root);
    if (screen === 'settings') {
      return renderStudioSettings(root);
    }
    return renderHome(root);
  }

  function render() {
    var root = ownRoot();
    if (!root) return;
    setMode(true);
    try {
      if (typeof global.HublyJourneyOS?.updateChrome === 'function') {
        global.HublyJourneyOS.updateChrome('studio');
      }
    } catch (e) {}
    try {
      renderScreen(root);
      wireRoot(root);
      // hydrate from API
      var Api = api();
      var os = ensureStudioOs();
      if (Api && !os._hydrated) {
        Api.request('dashboard', { method: 'GET' }).then(function (res) {
          if (!res || res.error) return;
          os._hydrated = true;
          if (res.settings) os.settings = Object.assign(os.settings || {}, res.settings);
          if (Array.isArray(res.recentProjects) && res.recentProjects.length) {
            os.projects = res.recentProjects;
          }
          if (Array.isArray(res.queue)) os.queue = res.queue;
          if (Array.isArray(res.socialAccounts)) os.socialAccounts = res.socialAccounts;
          if ((os.ui.screen || 'home') === 'home') {
            renderScreen(root);
            wireRoot(root);
          }
        }).catch(function () {});
      }
    } catch (err) {
      console.warn('Hubly Studio', err);
      root.innerHTML = '<div class="hs-shell"><div class="hs-main hs-pad"><strong>Studio could not load</strong><p>Refresh and try again.</p>' +
        '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="nav" data-hs-screen="home">Retry</button></div></div>';
      wireRoot(root);
    }
  }

  function openStudio(screen) {
    ensureStudioOs().ui.screen = screen || 'home';
    try {
      var ni = document.querySelector('[data-v="studio"]') || document.querySelector('[data-v="marketing"]');
      if (ni && typeof global.switchV === 'function') {
        global.switchV(ni);
        return;
      }
    } catch (e) {}
    render();
  }

  var apiExport = {
    render: render,
    setMode: setMode,
    ensureState: ensureStudioOs,
    open: openStudio,
    openEditor: openEditorFor,
    openWorkspace: openEditorFor,
    createProject: createProject,
    generateCampaign: generateCampaign
  };
  global.HublyStudio = apiExport;
  if (global.HublyJourneyOS) {
    global.HublyJourneyOS.renderStudio = render;
    global.HublyJourneyOS.setStudioMode = setMode;
    global.HublyJourneyOS.openStudio = openStudio;
  }
})(typeof window !== 'undefined' ? window : this);
