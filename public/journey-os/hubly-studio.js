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
    try { setMode(false); } catch (e) {}
    try {
      if (typeof global.switchV === 'function') {
        var dash = document.querySelector('[data-v="dashboard"]');
        if (dash) return global.switchV(dash);
      }
    } catch (e) {}
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
      '<aside class="hs-sidebar" aria-label="Studio navigation">' +
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
      '<div class="hs-canva-badge">Optional visual polish</div>' +
      '<button type="button" class="hs-user" data-hs-act="go-settings">' +
      '<span class="hs-avatar">' + esc(initials()) + '</span>' +
      '<span class="hs-user-meta"><strong>' + esc(ownerFirst()) + ' · ' + esc(bizName().split(/\s+/).slice(0, 2).join(' ')) + '</strong>' +
      '<span>' + esc(bizName()) + '</span></span></button>' +
      '</div></aside>' +
      '<main class="hs-main">' + bodyHtml + '</main>' +
      '</div>';
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
    if (!queue.length) {
      queue = [
        { title: 'Review Spotlight — email draft', scheduled_at: 'Ready to send', status: 'ready', _placeholder: true }
      ];
    }
    var queueHtml = queue.map(function (q) {
      var st = q.status === 'published' ? 'ready' : (q.status === 'ready' ? 'ready' : 'draft');
      return '<div class="hs-queue-row">' +
        '<div><strong>' + esc(q.scheduled_at || 'Unscheduled') + '</strong> <span class="hs-pill ' + st + '">' + esc(q.status || 'draft') + '</span>' +
        '<p>' + esc(q.title || q.caption || 'Email campaign') + '</p></div></div>';
    }).join('');

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

  function renderBrandKit(root) {
    var Api = api();
    var body =
      '<header class="hs-page-head hs-page-head-row">' +
      '<div><h1>Brand Kit</h1><p>Centralized brand management: your brand identity, always consistent</p></div>' +
      '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="apply-brand">Apply to All Drafts</button></header>' +
      '<div id="hs-brand-mount" class="hs-brand-mount"><div class="hs-muted">Loading brand kit…</div></div>';
    root.innerHTML = shell('brand', body);
    var mount = root.querySelector('#hs-brand-mount');
    function paint(kit) {
      kit = kit || {};
      var colors = (kit.colors && kit.colors.length) ? kit.colors : [
        { name: 'Hubly Orange', hex: '#D9632D' },
        { name: 'Dark Navy', hex: '#1E293B' },
        { name: 'Warm White', hex: '#FCFCFC' },
        { name: 'Accent Orange', hex: '#D97706' },
        { name: 'Light Gray', hex: '#F8FAFC' },
        { name: 'Success Green', hex: '#10B981' }
      ];
      var tones = (kit.voice_tones && kit.voice_tones.length) ? kit.voice_tones : [
        { label: 'Professional', status: 'active', blurb: 'Expert technical guidance, showcasing high quality parts & clean standards.' },
        { label: 'Friendly & Warm', status: 'active', blurb: 'Local neighborhood helper tone, focusing on customer peace of mind.' },
        { label: 'Clear & Direct', status: 'supporting', blurb: 'No complex jargon. Straightforward quotes and helpful checklist details.' }
      ];
      var ty = kit.typography || {};
      mount.innerHTML =
        '<div class="hs-brand-grid">' +
        '<div class="hs-brand-col">' +
        '<section class="hs-card hs-pad"><div class="hs-between"><h3>Logo Assets</h3><button type="button" class="hs-link green" data-hs-act="upload-logo">Upload New</button></div>' +
        '<div class="hs-logo-row">' +
        '<div class="hs-logo-swatch light"><span class="hs-logo-mark">P</span> ' + esc(bizName()) + '<small>Primary Light</small></div>' +
        '<div class="hs-logo-swatch dark"><span class="hs-logo-mark">P</span> ' + esc(bizName()) + '<small>Alternative Dark</small></div>' +
        '<div class="hs-logo-swatch light"><span class="hs-logo-mark only">P</span><small>Icon Mark</small></div>' +
        '</div></section>' +
        '<section class="hs-card hs-pad"><h3>Brand Color Palette</h3><div class="hs-color-row">' +
        colors.map(function (c) {
          return '<div class="hs-color"><i style="background:' + esc(c.hex) + '"></i><strong>' + esc(c.name) + '</strong><span>' + esc(c.hex) + '</span></div>';
        }).join('') + '</div></section>' +
        '<section class="hs-card hs-pad"><h3>Brand Typography</h3><div class="hs-type-row">' +
        '<div><strong class="hs-type-sample">' + esc(ty.heading || 'Plus Jakarta Sans') + '</strong><p>Used for headlines, titles, and callouts (Bold, ExtraBold).</p></div>' +
        '<div><strong class="hs-type-sample mono">' + esc(ty.body || 'DM Sans') + '</strong><p>Used for paragraphs, listings, captions, and details.</p></div>' +
        '</div></section></div>' +
        '<div class="hs-brand-col narrow">' +
        '<section class="hs-card hs-pad"><h3>Brand Copywriting Voice</h3>' +
        tones.map(function (t) {
          return '<div class="hs-voice' + (t.status === 'active' ? ' on' : '') + '"><div class="hs-between"><strong>' + esc(t.label) + '</strong>' +
            '<span class="hs-pill ' + (t.status === 'active' ? 'ready' : 'draft') + '">' + esc(t.status === 'active' ? 'Active' : 'Supporting') + '</span></div>' +
            '<p>' + esc(t.blurb || '') + '</p></div>';
        }).join('') + '</section>' +
        '<section class="hs-card hs-pad"><h3>Quick Brand Templates</h3>' +
        [['Standard Dispatch Before/After', 'Instagram Square'], ['Emergency Repair Promo', 'Direct Mailer Flyer'], ['Seasonal Maintenance Offer', 'Facebook Landscape'], ['Review Spotlight', 'Instagram Story']].map(function (x) {
          return '<button type="button" class="hs-brand-tpl" data-hs-act="quick-draft" data-hs-title="' + esc(x[0]) + '"><span class="hs-recent-thumb"></span><span><strong>' + esc(x[0]) + '</strong><span>' + esc(x[1]) + '</span></span></button>';
        }).join('') + '</section></div></div>';
    }
    if (Api) {
      Api.request('brand-kit', { method: 'GET' }).then(function (res) {
        paint(res && res.brandKit);
      }).catch(function () { paint(null); });
    } else paint(null);
  }

  function renderPublish(root) {
    var os = ensureStudioOs();
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var now = new Date();
    var monthLabel = months[now.getMonth()] + ' ' + now.getFullYear();
    var days = [];
    var y = now.getFullYear(), m = now.getMonth();
    var first = new Date(y, m, 1);
    var startPad = (first.getDay() + 6) % 7; // Mon=0
    var dim = new Date(y, m + 1, 0).getDate();
    var today = now.getDate();
    for (var i = 0; i < startPad; i++) days.push({ n: '', muted: true });
    for (var d = 1; d <= dim; d++) {
      days.push({ n: d, today: d === today, posts: d === today || d === 9 || d === 24 });
    }

    var cal = days.map(function (c) {
      return '<div class="hs-cal-cell' + (c.today ? ' today' : '') + (c.muted ? ' muted' : '') + '">' +
        (c.n ? '<span class="hs-cal-n">' + c.n + (c.today ? ' <i>TODAY</i>' : '') + '</span>' : '') +
        (c.posts ? '<div class="hs-cal-post"><span class="hs-cal-thumb"></span><span>' + esc(bizName().slice(0, 8)) + '…<br>12:00 PM</span></div>' : '') +
        '</div>';
    }).join('');

    var accounts = (os.socialAccounts || []).length ? os.socialAccounts : [
      { provider: 'instagram', handle: '@' + (S().slug || 'yourbiz'), status: 'not_connected' },
      { provider: 'facebook', handle: bizName(), status: 'not_connected' },
      { provider: 'google_business', handle: bizName() + ' local', status: 'not_connected' }
    ];

    var body =
      '<header class="hs-page-head hs-page-head-row">' +
      '<div><h1>Publish Center</h1><p>Schedule Post dashboard: plan, preview, and coordinate your social pipelines</p></div>' +
      '<div class="hs-head-actions">' +
      '<div class="hs-month-pill"><button type="button" data-hs-act="noop">‹</button> ' + esc(monthLabel) + ' <button type="button" data-hs-act="noop">›</button></div>' +
      '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="schedule-post">Schedule Post</button>' +
      '</div></header>' +
      '<div class="hs-publish-grid">' +
      '<section class="hs-card hs-cal-wrap"><div class="hs-cal-head">' +
      ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(function (d) { return '<span>' + d + '</span>'; }).join('') +
      '</div><div class="hs-cal-grid">' + cal + '</div></section>' +
      '<aside class="hs-publish-side">' +
      '<section class="hs-card hs-pad"><h3>Connected Accounts</h3>' +
      accounts.map(function (a) {
        var label = a.provider === 'instagram' ? 'Instagram' : (a.provider === 'facebook' ? 'Facebook Page' : 'Google Business');
        var st = a.status === 'connected' || a.status === 'sync_active' ? a.status : 'not_connected';
        var pill = st === 'not_connected' ? 'Not connected' : (st === 'sync_active' ? 'Sync Active' : 'Connected');
        return '<div class="hs-acct-row"><span class="hs-acct-ico">' + label.charAt(0) + '</span>' +
          '<div><strong>' + esc(label) + '</strong><span>' + esc(a.handle || '') + '</span></div>' +
          '<span class="hs-pill ' + (st === 'not_connected' ? 'draft' : 'ready') + '">' + esc(pill) + '</span></div>';
      }).join('') +
      '<p class="hs-muted hs-tiny">Connect accounts in Apps — Studio never fakes Connected.</p></section>' +
      '<section class="hs-card hs-pad"><h3>Publishing Queue</h3>' +
      ((os.queue || []).length ? os.queue : [
        { title: 'Winter pipeline safety Checklist', scheduled_at: 'Jul 15, 12:00 PM', channels: ['Insta', 'FB'] },
        { title: '5-Star Spotlight', scheduled_at: 'Jul 18, 9:00 AM', channels: ['Insta', 'GMB'] }
      ]).slice(0, 3).map(function (q) {
        return '<div class="hs-pub-q"><span class="hs-recent-thumb"></span><div><strong>' + esc(q.title) + '</strong>' +
          '<span>' + esc(q.scheduled_at || 'Draft') + (q.channels ? ' · ' + esc((q.channels || []).join(', ')) : '') + '</span></div></div>';
      }).join('') + '</section>' +
      '<section class="hs-card hs-pad"><h3>Best Times to Post</h3>' +
      '<p class="hs-muted">Based on your local audience — Stage 2 when analytics providers are connected.</p>' +
      '<div class="hs-bars">' +
      [40, 55, 90, 50, 45, 35].map(function (h, i) {
        return '<div class="hs-bar' + (i === 2 ? ' peak' : '') + '"><i style="height:' + h + '%"></i><span>' + ['8a', '10a', '12p', '2p', '4p', '6p'][i] + '</span></div>';
      }).join('') + '</div></section>' +
      '</aside></div>';

    root.innerHTML = shell('publish', body);
  }

  function renderAnalytics(root) {
    var body =
      '<header class="hs-page-head hs-page-head-row">' +
      '<div><h1>Analytics</h1><p>V1 counters — outcomes attribution comes after publishing is live in the field.</p></div>' +
      '<div class="hs-head-actions">' +
      '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="noop">Last 30 Days</button></div></header>' +
      '<div id="hs-analytics-mount" class="hs-kpi-row">' +
      [['CAMPAIGNS CREATED', '—'], ['CAMPAIGNS PUBLISHED', '—'], ['POSTING FREQUENCY', '—']].map(function (k) {
        return '<div class="hs-kpi"><span>' + k[0] + '</span><strong>' + k[1] + '</strong></div>';
      }).join('') + '</div>' +
      '<section class="hs-card hs-pad"><h3>What V1 tracks</h3>' +
      '<p class="hs-muted">Created · Published · Posting frequency. Reach, clicks, quotes, bookings, and revenue attribution are deferred.</p></section>';
    root.innerHTML = shell('analytics', body);
    var Api = api();
    var mount = root.querySelector('#hs-analytics-mount');
    if (Api && mount) {
      Api.request('analytics', { method: 'GET' }).then(function (res) {
        var m = (res && res.metrics) || {};
        mount.innerHTML = [
          ['CAMPAIGNS CREATED', m.campaigns_created != null ? m.campaigns_created : '—'],
          ['CAMPAIGNS PUBLISHED', m.campaigns_published != null ? m.campaigns_published : '—'],
          ['POSTING FREQUENCY', m.posting_frequency || '—']
        ].map(function (k) {
          return '<div class="hs-kpi"><span>' + k[0] + '</span><strong>' + esc(String(k[1])) + '</strong></div>';
        }).join('');
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
      leftBody = '<div class="hs-ws-panel"><h3>Assets</h3><p class="hs-muted">Job photos, logo, and reviews linked to this campaign.</p>' +
        '<ul class="hs-ws-list"><li>Brand logo</li><li>Job photos</li><li>Review quote</li></ul>' +
        '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="nav" data-hs-screen="uploads">Manage uploads</button></div>';
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
      var alts = (pkg.headlines || [headline, 'No Leak Too Large', 'Kitchen Plumbing Perfected']);
      leftBody = '<div class="hs-ws-panel hs-ai-panel"><h3>AI Suggestions</h3>' +
        '<div class="hs-lbl tiny">Headlines</div>' +
        alts.map(function (a, i) {
          return '<button type="button" class="hs-alt' + (i === 0 ? ' on' : '') + '" data-hs-act="set-headline" data-hs-text="' + esc(a) + '">' + esc(a) + '</button>';
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

    root.innerHTML =
      '<div class="hs-workspace-shell hs-editor-shell">' +
      '<aside class="hs-ws-left">' +
      '<div class="hs-ws-back">' +
      '<button type="button" class="hs-back-hubly hs-back-hubly-light" data-hs-act="leave-studio">← Back to Hubly</button>' +
      '<button type="button" class="hs-link" data-hs-act="close-editor">← Projects</button></div>' +
      '<nav class="hs-ws-sidenav" aria-label="Project sections">' + sideNav + '</nav>' +
      leftBody +
      '</aside>' +
      '<div class="hs-canvas-wrap">' +
      '<header class="hs-editor-top">' +
      '<div class="hs-editor-title"><strong id="hs-editor-title">' + esc(project.title) + '</strong>' +
      '<span class="hs-pill ' + (project.status === 'ready' ? 'ready' : 'draft') + '">' + esc(project.status || 'draft') + '</span></div>' +
      '<div class="hs-head-actions">' +
      '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="leave-studio">← Back to Hubly</button>' +
      '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="publish-email">✈ Publish Email</button>' +
      '<button type="button" class="hs-btn hs-btn-brand hs-btn-customize" data-hs-act="customize-design">Customize in Canva</button>' +
      '</div></header>' +
      '<div class="hs-canvas hs-preview-canvas">' +
      '<div class="hs-design hs-design-preview" id="hs-design">' +
      '<div class="hs-design-photos"><div class="hs-ph before"></div><div class="hs-ph after"></div>' +
      '<span class="hs-biz-pill">' + esc(bizName()) + '</span></div>' +
      '<div class="hs-design-headline">' +
      '<h2 id="hs-canvas-headline">' + esc(headline) + '</h2></div>' +
      '<div class="hs-design-review">★★★★★ <em>“Fixed our plumbing leak in record time.” — Mrs. Miller</em></div>' +
      '<div class="hs-design-cta"><span>NEED SERVICE?</span><strong>Call ' + esc(S().phone || '(555) 302-2849') + '</strong></div>' +
      '<div class="hs-preview-note">Preview · not a live canvas. Customize Design opens visual editing, then returns here.</div>' +
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
      '<div class="hs-lbl">Performance Goals</div><p class="hs-muted hs-tiny">Quotes requested · Jobs booked · Revenue influenced</p>' +
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

  function openEditorFor(project) {
    var root = ownRoot();
    if (!root) return;
    setMode(true);
    var os = ensureStudioOs();
    os.ui.screen = 'editor';
    os.ui.editorProjectId = project && project.id;
    os.ui.workspaceTab = 'overview';
    renderEditor(root, project);
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
      if (thenOpen !== false) openEditorFor(project);
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
    toast('Building campaign package…');
    var body = {
      goal_id: goalId,
      playbook_id: GOAL_TO_PLAYBOOK[goalId] || null,
      business_name: bizName(),
      create_project: true,
      service_focus: goalId === 'promote_service' ? (extra.service_focus || 'Ceramic Coatings') : null,
      latest_review: { stars: 5, quote: 'Fixed our plumbing leak in record time.', author: 'Mrs. Miller' },
      has_before_after: true,
      job_photos_count: 2,
      completed_jobs_week: 4
    };
    function fallbackLocal() {
      createProject({
        title: (goal && goal.title) || 'Campaign',
        prompt: 'Campaign goal: ' + goalId,
        headline: (goal && goal.title) || 'Campaign',
        metadata: { goal_id: goalId },
        canvas: {
          headline: (goal && goal.title) || 'Campaign',
          package: {
            headlines: [(goal && goal.title) || 'Campaign'],
            captions: [{ channel: 'instagram', text: 'Campaign from Hubly Studio' }],
            schedule_suggestions: ['Tomorrow 12:00 PM — peak local engagement window']
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
        openEditorFor(project);
        return;
      }
      if (res && res.campaignPlan) {
        var plan = res.campaignPlan;
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
    if (act === 'leave-studio') {
      return leaveStudio();
    }
    if (act === 'nav') {
      os.ui.screen = t.getAttribute('data-hs-screen') || 'home';
      return render();
    }
    if (act === 'go-settings') {
      try {
        if (typeof global.switchV === 'function') {
          var ni = document.querySelector('[data-v="settings"]');
          if (ni) return global.switchV(ni);
        }
      } catch (e) {}
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
      return render();
    }
    if (act === 'workspace-tab') {
      os.ui.workspaceTab = t.getAttribute('data-hs-tab') || 'overview';
      return openEditorFor(os.projects.find(function (p) { return p.id === os.ui.editorProjectId; }));
    }
    if (act === 'workspace-page') {
      os.ui.workspacePage = t.getAttribute('data-hs-page') || 'instagram_post';
      return openEditorFor(os.projects.find(function (p) { return p.id === os.ui.editorProjectId; }));
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
      var proj2 = os.projects.find(function (p) { return p.id === os.ui.editorProjectId; });
      if (proj2) {
        proj2.canvas = proj2.canvas || {};
        proj2.canvas.headline = text;
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
      toast('Studio AI — Stage 2 when Hubly AI credentials are configured');
      return;
    }
    if (act === 'publish-email' || act === 'publish-queue') {
      var proj3 = os.projects.find(function (p) { return p.id === os.ui.editorProjectId; });
      var title = (proj3 && proj3.title) || 'Studio campaign';
      var Api2 = api();
      var pkg = (proj3 && proj3.canvas && proj3.canvas.package) || {};
      var email = pkg.email || {};
      var toEmail = window.prompt('V1 publishes by Email. Recipient email:', (S().ownerEmail || S().email || ''));
      if (!toEmail) {
        toast('Publish cancelled — email required for V1');
        return;
      }
      toast('Publishing via Email…');
      if (Api2) {
        Api2.request('publish', {
          method: 'POST',
          body: {
            project_id: proj3 && proj3.id,
            title: title,
            to_email: toEmail,
            subject: email.subject || title,
            body: email.body || (proj3 && proj3.prompt) || title,
            business_name: bizName()
          }
        }).then(function (res) {
          if (res && res.item) os.queue.unshift(res.item);
          persistStudioMeta();
          if (res && res.error === 'Provider not configured') {
            toast(res.message || 'Email provider not configured — queued as ready in Hubly');
          } else if (res && res.ok) {
            toast('Published by email');
          } else {
            toast((res && res.message) || (res && res.error) || 'Publish saved to queue');
          }
        }).catch(function () {
          toast('Could not publish — try again');
        });
      }
      return;
    }
    if (act === 'schedule-post') {
      os.ui.screen = 'ai';
      return render();
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
    if (act === 'apply-brand' || act === 'upload-logo') {
      toast(act === 'upload-logo' ? 'Upload logo — connect brand assets storage' : 'Brand applied to open drafts locally');
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
    if (!root || root._hsBound) return;
    root._hsBound = true;
    root.addEventListener('click', function (e) {
      var t = e.target.closest('[data-hs-act]');
      if (!t || !root.contains(t)) return;
      var act = t.getAttribute('data-hs-act') || '';
      e.preventDefault();
      e.stopPropagation();
      handleAct(act, t, root);
    });
    root.addEventListener('blur', function (e) {
      if (e.target && e.target.id === 'hs-canvas-headline') {
        var os = ensureStudioOs();
        var proj = os.projects.find(function (p) { return p.id === os.ui.editorProjectId; });
        if (proj) {
          proj.canvas = proj.canvas || {};
          proj.canvas.headline = e.target.textContent || '';
          persistStudioMeta();
        }
      }
    }, true);
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
    if (screen === 'photos') return renderSimple(root, 'photos', 'Photos', 'Job photos and portfolio for Studio campaigns.');
    if (screen === 'elements') return renderSimple(root, 'elements', 'Elements', 'Graphics for campaign packages — open a project to attach assets.');
    if (screen === 'uploads') return renderSimple(root, 'uploads', 'Uploads', 'Your uploaded brand and job media.');
    if (screen === 'settings') {
      return renderSimple(root, 'settings', 'Studio Settings', 'Storage, creative engine link, and Studio preferences.');
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
