/**
 * Hubly Studio — creative OS (replaces Operate Marketing tab).
 * Screens: Home · AI Creator · Templates · Editor · Brand Kit · Publish · Analytics
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

  var AI_OBJECTIVES = [
    { id: 'carousel', title: 'Carousel from Job Photos', sub: 'Turn raw photos of your install into a sequence post.' },
    { id: 'before_after', title: 'Before/After Job Highlight', sub: 'Perfect comparison layout with review citation.' },
    { id: 'referral', title: 'Referral Campaign Poster', sub: 'Generate a print-ready poster encouraging word of mouth.' },
    { id: 'gmb', title: 'Google Business Update', sub: 'Optimized update with map photo placement.' },
    { id: 'review', title: 'Review Spotlight Post', sub: 'Highlight a fresh 5-star customer review.' }
  ];

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

  function persistStudioMeta() {
    try {
      if (typeof global.saveStorefront === 'function') {
        clearTimeout(persistStudioMeta._t);
        persistStudioMeta._t = setTimeout(function () {
          try { global.saveStorefront().catch(function () {}); } catch (e) {}
        }, 500);
      } else if (typeof global.buildBizMeta === 'function' && global.currentBusiness) {
        global.currentBusiness.meta = global.buildBizMeta();
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
      '<div class="hs-brand">' +
      '<div class="hs-brand-mark">H</div>' +
      '<div class="hs-brand-txt"><strong>Studio</strong><span>BY <span class="hs-wm-hub">hub</span><span class="hs-wm-ly">ly</span></span></div>' +
      '</div>' +
      '<nav class="hs-nav">' + nav + '</nav>' +
      '<div class="hs-sidebar-foot">' +
      '<div class="hs-storage"><span>Cloud Storage</span><strong>' + used + ' / ' + quota + ' GB</strong>' +
      '<div class="hs-storage-bar"><i style="width:' + pct + '%"></i></div></div>' +
      '<div class="hs-canva-badge">Powered by Canva SDK</div>' +
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

    var recs = [
      { title: 'Share Your Kitchen Renovation', kind: 'Instagram Carousel', tone: 'kitchen' },
      { title: 'Summer A/C Tune-Up Special', kind: 'Local Facebook Ad', tone: 'ac' },
      { title: 'Referral Campaign Promotion', kind: 'Direct Mailer Print', tone: 'referral' }
    ].map(function (r) {
      return '<article class="hs-rec-card">' +
        '<div class="hs-rec-media tone-' + r.tone + '"></div>' +
        '<div class="hs-rec-body"><strong>' + esc(r.title) + '</strong><span>' + esc(r.kind) + '</span>' +
        '<button type="button" class="hs-link" data-hs-act="quick-draft" data-hs-title="' + esc(r.title) + '">Quick Draft →</button></div></article>';
    }).join('');

    var recent = (os.projects || []).slice(0, 4);
    if (!recent.length) {
      recent = [
        { id: 'demo1', title: 'Winter Pipes Checklist', format_primary: 'print_flyer', last_edited_at: new Date(Date.now() - 7200000).toISOString(), _placeholder: true },
        { id: 'demo2', title: 'Before/After: Bathroom Leak Fix', format_primary: 'instagram_post', last_edited_at: new Date(Date.now() - 86400000).toISOString(), _placeholder: true }
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
        { title: 'Check out this pristine kitchen reno…', scheduled_at: 'Today, 4:00 PM', status: 'ready', _placeholder: true },
        { title: 'Local plumbers you can trust!', scheduled_at: 'Tomorrow, 9:00 AM', status: 'draft', _placeholder: true }
      ];
    }
    var queueHtml = queue.map(function (q) {
      var st = q.status === 'ready' ? 'ready' : 'draft';
      return '<div class="hs-queue-row">' +
        '<div><strong>' + esc(q.scheduled_at || 'Unscheduled') + '</strong> <span class="hs-pill ' + st + '">' + esc(st === 'ready' ? 'Ready' : 'Draft') + '</span>' +
        '<p>' + esc(q.title || q.caption || 'Scheduled post') + '</p></div></div>';
    }).join('');

    var body =
      '<header class="hs-page-head">' +
      '<div><h1>' + esc(greet) + ', ' + esc(ownerFirst()) + '.</h1>' +
      '<p>You completed ' + completedYest + ' jobs recently. Let\'s turn today\'s work into local marketing!</p></div>' +
      '</header>' +
      '<div class="hs-ai-search">' +
      '<input type="text" id="hs-home-prompt" placeholder="What will you create today? Describe an idea or search templates…">' +
      '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="ai-draft">+ AI Draft</button>' +
      '</div>' +
      '<section class="hs-section"><h2>Start from a blank canvas</h2>' +
      '<div class="hs-blank-row">' + formats + '</div></section>' +
      '<section class="hs-section"><h2><span class="hs-spark">✦</span> AI-Powered recommendations based on recent jobs</h2>' +
      '<div class="hs-rec-row">' + recs + '</div></section>' +
      '<div class="hs-home-split">' +
      '<section class="hs-section"><h2>Recent Projects</h2><div class="hs-card">' + recentHtml + '</div></section>' +
      '<section class="hs-section"><h2>Scheduled Social Queue</h2><div class="hs-card">' + queueHtml + '</div></section>' +
      '</div>';

    root.innerHTML = shell('home', body);
  }

  function renderAiCreator(root) {
    var objectives = AI_OBJECTIVES.map(function (o) {
      return '<button type="button" class="hs-obj-card" data-hs-act="objective" data-hs-obj="' + o.id + '">' +
        '<strong>' + esc(o.title) + '</strong><span>' + esc(o.sub) + '</span><span class="hs-obj-arrow">↗</span></button>';
    }).join('');

    var body =
      '<header class="hs-page-head hs-page-head-row">' +
      '<div><h1>AI Creative Partner</h1>' +
      '<p>Describe your marketing goal and let Studio AI generate a beautiful layout from your business data.</p></div>' +
      '<div class="hs-head-actions">' +
      '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="studio-guide">? Studio Guide</button>' +
      '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="blank" data-hs-format="instagram_post">+ Create Custom</button>' +
      '</div></header>' +
      '<div class="hs-ai-layout">' +
      '<div class="hs-ai-prompt-card">' +
      '<div class="hs-ai-active"><span class="hs-spark">✦</span> ' + esc(bizName()) + ' AI assistant active</div>' +
      '<textarea id="hs-ai-prompt" rows="4">Create an Instagram Post showcasing our latest completed job, highlighted with a 5-star review.</textarea>' +
      '<div class="hs-ai-prompt-foot">' +
      '<div class="hs-attach-pills"><span>2 Job Photos Attached</span><span>★ 5-Star Review Linked</span></div>' +
      '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="generate-layout">✦ Generate Layout</button>' +
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
      '<div><h1>Template Studio</h1>' +
      '<p>Access high-quality templates tailored for plumbing, HVAC, electrical, and home services.</p></div>' +
      '<div class="hs-head-actions">' +
      '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="studio-guide">? Studio Guide</button>' +
      '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="blank" data-hs-format="instagram_post">+ Create Custom</button>' +
      '</div></header>' +
      '<div class="hs-search-bar">' +
      '<input type="search" id="hs-tpl-search" placeholder="Search templates (e.g. clogged drain, spring promotion)…">' +
      '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="tpl-filters">Filters</button></div>' +
      '<div class="hs-cat-pills">' +
      ['All Designs', 'Social Media', 'Print Flyers', 'Email Bulletins', 'Local Ads', 'Seasonal', 'Before & After'].map(function (c, i) {
        return '<button type="button" class="hs-cat' + (i === 0 ? ' on' : '') + '" data-hs-act="tpl-cat">' + esc(c) + '</button>';
      }).join('') + '</div>' +
      '<div id="hs-tpl-mount" class="hs-tpl-mount"><div class="hs-muted">Loading templates…</div></div>';

    root.innerHTML = shell('templates', body);
    var mount = root.querySelector('#hs-tpl-mount');
    function paint(templates) {
      var featured = (templates || []).filter(function (t) { return t.featured; });
      var rest = (templates || []).filter(function (t) { return !t.featured; });
      mount.innerHTML =
        '<section class="hs-section"><h2>Featured layouts this week</h2>' +
        '<div class="hs-tpl-grid">' + (featured.length ? featured : templates).slice(0, 3).map(function (t) {
          return '<button type="button" class="hs-tpl-card" data-hs-act="use-template" data-hs-id="' + esc(t.id) + '" data-hs-title="' + esc(t.title) + '" data-hs-format="' + esc(t.format || 'instagram_post') + '">' +
            '<div class="hs-tpl-thumb"></div><strong>' + esc(t.title) + '</strong><span>' + esc((t.format || t.category || '').replace(/_/g, ' ')) + '</span></button>';
        }).join('') + '</div></section>' +
        '<section class="hs-section"><h2>Complete Library</h2>' +
        '<div class="hs-tpl-wide">' + (rest.length ? rest : templates).slice(0, 6).map(function (t) {
          return '<button type="button" class="hs-tpl-wide-card" data-hs-act="use-template" data-hs-id="' + esc(t.id) + '" data-hs-title="' + esc(t.title) + '" data-hs-format="' + esc(t.format || 'instagram_post') + '">' +
            '<div class="hs-tpl-thumb wide"></div><strong>' + esc(t.title) + '</strong></button>';
        }).join('') + '</div></section>';
    }
    if (Api) {
      Api.request('templates', { method: 'GET' }).then(function (res) {
        paint((res && res.templates) || []);
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
      '<div><h1>Analytics</h1><p>Performance dashboard: monitor traction and optimize branding decisions</p></div>' +
      '<div class="hs-head-actions">' +
      '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="noop">Last 30 Days</button>' +
      '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="noop">Export Report</button></div></header>' +
      '<div class="hs-kpi-row">' +
      [['TOTAL REACH', '—', ''], ['LEADS GENERATED', '—', ''], ['ENGAGEMENT', '—', ''], ['BOOKINGS', '—', ''], ['REVENUE', '—', '']].map(function (k) {
        return '<div class="hs-kpi"><span>' + k[0] + '</span><strong>' + k[1] + '</strong><em class="hs-muted">Connect social providers for live metrics</em></div>';
      }).join('') + '</div>' +
      '<div class="hs-analytics-grid">' +
      '<section class="hs-card hs-pad"><h3>Engagement Over Time</h3><p class="hs-muted">No snapshot yet — Studio stores analytics only from real providers.</p>' +
      '<div class="hs-line-ph"></div></section>' +
      '<section class="hs-card hs-pad"><h3>Channel Breakdown</h3><p class="hs-muted">Instagram · Facebook · Google — when connected.</p></section>' +
      '</div>' +
      '<div class="hs-analytics-grid">' +
      '<section class="hs-card hs-pad"><h3>Top Performing Designs</h3><p class="hs-muted">Publish posts to populate this list.</p></section>' +
      '<section class="hs-card hs-pad"><h3><span class="hs-spark">✦</span> Studio AI Insights</h3>' +
      '<div class="hs-insight">Review spotlights often outperform generic promos for home services.</div>' +
      '<div class="hs-insight">Noon posts tend to win local engagement — confirm with your data.</div>' +
      '<div class="hs-insight">Seasonal checklists convert well on Google Business.</div></section>' +
      '</div>';
    root.innerHTML = shell('analytics', body);
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
      '<div class="hs-card hs-pad"><p class="hs-muted">Library opens in the Editor. Use AI Creator or Templates to start a design.</p>' +
      '<div class="hs-btn-row">' +
      '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="nav" data-hs-screen="ai">AI Creator</button>' +
      '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="nav" data-hs-screen="templates">Browse Templates</button>' +
      '</div></div>');
  }

  function renderEditor(root, project) {
    var os = ensureStudioOs();
    project = project || os.projects.find(function (p) { return p.id === os.ui.editorProjectId; }) || {
      id: 'draft',
      title: 'Kitchen Renovation — Instagram Post',
      canvas: { headline: 'Complete Kitchen Renovation' }
    };
    os.ui.editorProjectId = project.id;
    var tool = os.ui.editorTool || 'ai';
    var headline = (project.canvas && project.canvas.headline) || 'Complete Kitchen Renovation';
    var alts = ['No Leak Too Large', 'Kitchen Plumbing Perfected', headline];

    var tools = [
      ['templates', 'Templates'], ['photos', 'Photos'], ['text', 'Text'], ['elements', 'Elements'],
      ['uploads', 'Uploads'], ['brand', 'Brand Kit'], ['ai', 'AI Suite']
    ].map(function (t) {
      return '<button type="button" class="hs-tool' + (tool === t[0] ? ' on' : '') + '" data-hs-act="editor-tool" data-hs-tool="' + t[0] + '">' +
        '<span>' + t[1].charAt(0) + '</span><em>' + esc(t[1]) + '</em></button>';
    }).join('');

    var leftPanel = tool === 'elements'
      ? '<div class="hs-panel"><h3>Elements Library</h3>' +
        '<input type="search" placeholder="Search graphics, stickers…" class="hs-panel-search">' +
        '<div class="hs-lbl tiny">FREQUENTLY USED</div>' +
        '<button type="button" class="hs-el-card" data-hs-act="noop"><div class="hs-el-thumb"></div>Water Splash</button></div>'
      : '<div class="hs-panel hs-ai-panel"><h3>Studio AI Partner</h3>' +
        '<div class="hs-goal">Enhancing main header typography context…</div>' +
        '<div class="hs-lbl tiny">Generated alternatives</div>' +
        alts.map(function (a, i) {
          return '<button type="button" class="hs-alt' + (i === alts.length - 1 ? ' on' : '') + '" data-hs-act="set-headline" data-hs-text="' + esc(a) + '">' + esc(a) + '</button>';
        }).join('') +
        '<div class="hs-lbl tiny">AI Quick Commands</div><div class="hs-cmd-wrap">' +
        ['Make headline punchier', 'Seasonal Summer theme style', 'Rewrite for expert authority', 'Highlight discount promo code', 'Translate to Spanish', 'Vary caption 5 times'].map(function (c) {
          return '<button type="button" class="hs-cmd" data-hs-act="ai-cmd" data-hs-cmd="' + esc(c) + '">' + esc(c) + '</button>';
        }).join('') + '</div>' +
        '<div class="hs-ai-ask"><input type="text" id="hs-editor-ask" placeholder="Ask AI to make changes…">' +
        '<button type="button" class="hs-send" data-hs-act="editor-ask">➤</button></div></div>';

    var pages = [
      ['instagram_post', 'Instagram Post'],
      ['facebook_feed', 'Facebook Feed'],
      ['instagram_story', 'Instagram Story'],
      ['print_flyer', 'Print Flyer']
    ].map(function (p, i) {
      return '<button type="button" class="hs-page-chip' + (i === 0 ? ' on' : '') + '" data-hs-act="noop">' +
        '<span class="hs-page-thumb"></span>' + esc(p[1]) + '</button>';
    }).join('');

    root.innerHTML =
      '<div class="hs-editor-shell">' +
      '<aside class="hs-tool-rail">' + tools + '</aside>' +
      leftPanel +
      '<div class="hs-canvas-wrap">' +
      '<header class="hs-editor-top">' +
      '<div class="hs-editor-title"><strong id="hs-editor-title">' + esc(project.title) + '</strong>' +
      '<button type="button" data-hs-act="noop" title="Undo">↺</button>' +
      '<button type="button" data-hs-act="close-editor" title="Close">✕</button></div>' +
      '<div class="hs-head-actions">' +
      '<button type="button" class="hs-btn hs-btn-ghost" data-hs-act="share-link">Share Link</button>' +
      '<button type="button" class="hs-btn hs-btn-brand" data-hs-act="publish-queue">✈ Publish to Queue</button>' +
      '</div></header>' +
      '<div class="hs-canvas">' +
      '<div class="hs-design" id="hs-design">' +
      '<div class="hs-design-photos"><div class="hs-ph before"></div><div class="hs-ph after"></div>' +
      '<span class="hs-biz-pill">' + esc(bizName()) + '</span></div>' +
      '<div class="hs-design-headline is-selected" data-hs-act="select-text">' +
      '<span class="hs-ai-badge">AI Active</span>' +
      '<h2 id="hs-canvas-headline" contenteditable="true">' + esc(headline) + '</h2></div>' +
      '<div class="hs-design-review">★★★★★ <em>“Fixed our plumbing leak in record time.” — Mrs. Miller</em></div>' +
      '<div class="hs-design-cta"><span>NEED SERVICE?</span><strong>Call ' + esc(S().phone || '(555) 302-2849') + '</strong>' +
      '<span class="hs-qr" aria-hidden="true"></span></div>' +
      '</div></div>' +
      '<footer class="hs-pages-bar"><span class="hs-lbl tiny">PAGES IN SET</span><div class="hs-pages-row">' + pages +
      '<button type="button" class="hs-page-add" data-hs-act="noop">+</button></div></footer>' +
      '</div>' +
      '<aside class="hs-props">' +
      '<h3>Text Selected</h3>' +
      '<label>Font Family<select id="hs-font"><option>Plus Jakarta Sans</option><option>DM Sans</option><option>Outfit</option></select></label>' +
      '<div class="hs-prop-row"><label>Size<input type="number" value="22" min="8" max="96"></label>' +
      '<div class="hs-align"><button type="button" class="on" data-hs-act="noop">L</button><button type="button" data-hs-act="noop">C</button><button type="button" data-hs-act="noop">R</button></div></div>' +
      '<div class="hs-lbl">Text Color</div><div class="hs-swatches">' +
      ['#1E293B', '#D9632D', '#FFFFFF', '#D97706'].map(function (c) {
        return '<button type="button" class="hs-swatch" style="background:' + c + '" data-hs-act="noop"></button>';
      }).join('') + '</div>' +
      ['Shadow Depth', 'Letter Spacing', 'Line Height', 'Opacity'].map(function (lab, i) {
        return '<label class="hs-slider-lbl">' + lab + '<input type="range" min="0" max="100" value="' + (i === 3 ? 100 : 40) + '"></label>';
      }).join('') +
      '</aside></div>';
  }

  function openEditorFor(project) {
    var root = ownRoot();
    if (!root) return;
    var os = ensureStudioOs();
    os.ui.screen = 'editor';
    os.ui.editorProjectId = project && project.id;
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
      canvas: { headline: opts.headline || 'Complete Kitchen Renovation' }
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
        done(Object.assign({ id: 'loc_' + Date.now(), last_edited_at: new Date().toISOString() }, payload));
      });
    } else {
      done(Object.assign({ id: 'loc_' + Date.now(), last_edited_at: new Date().toISOString() }, payload));
    }
  }

  function handleAct(act, t, root) {
    var os = ensureStudioOs();
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
      return createProject({ prompt: p, title: 'AI Layout — ' + bizName(), headline: 'Complete Kitchen Renovation' });
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
      os.ui.screen = 'home';
      return render();
    }
    if (act === 'editor-tool') {
      os.ui.editorTool = t.getAttribute('data-hs-tool') || 'ai';
      return openEditorFor(os.projects.find(function (p) { return p.id === os.ui.editorProjectId; }));
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
    if (act === 'publish-queue') {
      var proj3 = os.projects.find(function (p) { return p.id === os.ui.editorProjectId; });
      var title = (proj3 && proj3.title) || 'Studio post';
      var Api2 = api();
      var item = { title: title, status: 'ready', scheduled_at: 'Today, 4:00 PM', project_id: proj3 && proj3.id, channels: ['instagram'] };
      if (Api2) {
        Api2.request('queue', { method: 'POST', body: item }).then(function (res) {
          if (res && res.item) os.queue.unshift(res.item);
          else os.queue.unshift(item);
          persistStudioMeta();
          toast('Added to Publish queue');
        }).catch(function () {
          os.queue.unshift(item);
          persistStudioMeta();
          toast('Saved to queue (local)');
        });
      } else {
        os.queue.unshift(item);
        persistStudioMeta();
        toast('Saved to queue');
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
      toast('Studio Guide — use AI Creator to draft, Editor to refine, Publish to schedule.');
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
      if (!t) return;
      var act = t.getAttribute('data-hs-act') || '';
      e.preventDefault();
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
    if (screen === 'photos') return renderSimple(root, 'photos', 'Photos', 'Job photos and portfolio for Studio designs.');
    if (screen === 'elements') return renderSimple(root, 'elements', 'Elements', 'Graphics and stickers — open in the Editor.');
    if (screen === 'uploads') return renderSimple(root, 'uploads', 'Uploads', 'Your uploaded brand and job media.');
    if (screen === 'settings') {
      return renderSimple(root, 'settings', 'Studio Settings', 'Storage, Canva link, and Studio preferences.');
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
    createProject: createProject
  };
  global.HublyStudio = apiExport;
  if (global.HublyJourneyOS) {
    global.HublyJourneyOS.renderStudio = render;
    global.HublyJourneyOS.setStudioMode = setMode;
    global.HublyJourneyOS.openStudio = openStudio;
  }
})(typeof window !== 'undefined' ? window : this);
