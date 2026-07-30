/**
 * Hubly AI Workspace — permanent home
 * Workspace is the product. Conversation guides it.
 * Building Mode is recurring — never a one-time onboarding.
 * Design: docs/architecture/HUBLY_AI_WORKSPACE_STATE_MACHINE.md
 */
(function (global) {
  'use strict';

  /** Current Focus building blocks (not "milestones") */
  var FOCUS_BLOCKS = [
    { id: 'vision', label: 'Vision' },
    { id: 'website', label: 'Website' },
    { id: 'commerce', label: 'Commerce' },
    { id: 'catalog', label: 'Products' },
    { id: 'media', label: 'Media' },
    { id: 'customers', label: 'Customers' },
    { id: 'payments', label: 'Payments' },
    { id: 'launch', label: 'Launch' },
    { id: 'growth', label: 'Growth' },
    { id: 'home', label: 'Home' },
  ];

  var STATES = {
    idle: { mode: 'operating', surface: 'home', focusId: 'home' },
    building_website: { mode: 'building', surface: 'directions', focusId: 'website' },
    reviewing_website: { mode: 'building', surface: 'website', focusId: 'website' },
    building_commerce: { mode: 'building', surface: 'commerce', focusId: 'commerce' },
    building_products: { mode: 'building', surface: 'products', focusId: 'catalog' },
    reviewing_products: { mode: 'building', surface: 'products', focusId: 'catalog' },
    building_campaign: { mode: 'building', surface: 'studio', focusId: 'growth' },
    marketplace_match: { mode: 'building', surface: 'marketplace', focusId: 'media' },
    launching: { mode: 'building', surface: 'website', focusId: 'launch' },
    operating: { mode: 'operating', surface: 'home', focusId: 'home' },
  };

  var SURFACES = {
    home: { title: 'Home', chrome: 'hubly · live workspace' },
    website: { title: 'Website', chrome: 'yourbusiness.hubly.ai' },
    commerce: { title: 'Storefront', chrome: 'storefront builder' },
    products: { title: 'Products', chrome: 'product editor' },
    studio: { title: 'Studio', chrome: 'campaign canvas' },
    marketplace: { title: 'Marketplace', chrome: 'get something done' },
    media: { title: 'Media', chrome: 'library' },
    customers: { title: 'Customers', chrome: 'CRM' },
    directions: { title: 'Directions', chrome: 'live concepts' },
    compare: { title: 'Compare', chrome: 'two directions' },
  };

  function S() {
    return global.S || (global.S = {});
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function bizName() {
    var st = S();
    return String(st.biz || st.businessName || (st._is && st._is.biz) || 'your business').trim() || 'your business';
  }

  function ownerFirst() {
    var st = S();
    var n = String((st._is && st._is.ownerName) || st.ownerName || st.userName || '').trim();
    return n ? n.split(/\s+/)[0] : '';
  }

  function greeting() {
    var h = new Date().getHours();
    var part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    var first = ownerFirst();
    return first ? part + ', ' + first + '.' : part + '.';
  }

  function ensureState() {
    var st = S();
    st._aw = st._aw || {};
    var aw = st._aw;
    if (!aw.messages) {
      aw.messages = [
        {
          side: 'hubly',
          text: greeting() + ' The workspace is ready. Tell me what you want to build — I\'ll change the center live.',
        },
      ];
    }
    if (!aw.activity) {
      aw.activity = [
        { label: 'Waiting for your next move', status: 'on' },
      ];
    }
    if (!aw.doing) aw.doing = 'Ready when you are…';
    if (!aw.focusId) aw.focusId = 'vision';
    if (!aw.surface) aw.surface = 'home';
    if (!aw.state) aw.state = hasFinishedFirstBuild() ? 'operating' : 'idle';
    if (!aw.mode) aw.mode = STATES[aw.state] ? STATES[aw.state].mode : 'operating';
    if (!aw.pointTarget) aw.pointTarget = null;
    return aw;
  }

  function markBuildingComplete() {
    try {
      localStorage.setItem('hubly_aw_built', '1');
      ensureState().firstBuildDone = true;
    } catch (e) {}
  }

  function hasFinishedFirstBuild() {
    try {
      if (S()._aw && S()._aw.firstBuildDone) return true;
      if (localStorage.getItem('hubly_aw_built') === '1') return true;
      if (localStorage.getItem('hubly_m2_home') === '1') return true;
      if (S()._is && S()._is.readyForBusinessHome) return true;
      if (global.currentBusiness && (global.currentBusiness.id || global.currentBusiness.slug)) return true;
    } catch (e) {}
    return false;
  }

  function applyMode(mode) {
    var aw = ensureState();
    aw.mode = mode === 'building' ? 'building' : 'operating';
    var app = document.getElementById('p-app');
    if (app) {
      /* Permanent home chrome. Recurring Building Mode stays in-app (cinematic, no sidebar).
         Instant Site first-build owns body.aw-building-mode separately — never hide #p-app here. */
      app.classList.add('jos-ai-workspace-home');
      app.classList.toggle('jos-ai-workspace-building', aw.mode === 'building');
    }
    if (aw.mode === 'operating') {
      try { document.body.classList.remove('aw-building-mode'); } catch (e) {}
    }
  }

  function enterBuildingMode(project, opts) {
    opts = opts || {};
    var aw = ensureState();
    aw.project = project || aw.project || 'website';
    var map = {
      website: 'building_website',
      storefront: 'building_commerce',
      commerce: 'building_commerce',
      products: 'building_products',
      campaign: 'building_campaign',
      studio: 'building_campaign',
      marketplace: 'marketplace_match',
      launch: 'launching',
    };
    var next = opts.state || map[aw.project] || 'building_website';
    transition(next, { doing: opts.doing || 'Entering Building Mode…' });
  }

  function enterOperatingMode(opts) {
    opts = opts || {};
    markBuildingComplete();
    transition('operating', {
      doing: opts.doing || 'Running your business…',
      message: opts.message || 'You\'re in Operating Mode. Start a major project anytime — I\'ll bring back Building Mode.',
    });
  }

  function transition(stateId, opts) {
    opts = opts || {};
    var aw = ensureState();
    var def = STATES[stateId] || STATES.operating;
    aw.state = stateId;
    aw.mode = def.mode;
    aw.surface = opts.surface || def.surface;
    aw.focusId = opts.focusId || def.focusId;
    if (opts.doing) aw.doing = opts.doing;
    if (opts.activity) aw.activity = opts.activity;
    if (opts.pointTarget !== undefined) aw.pointTarget = opts.pointTarget;
    applyMode(aw.mode);
    if (opts.message) {
      pushMessage('hubly', opts.message, opts.recommendation || null, { silentRender: true });
    }
    renderIfMounted();
    return aw;
  }

  function setDoing(phrase) {
    ensureState().doing = String(phrase || 'Working…');
    renderIfMounted();
  }

  function setActivity(items) {
    ensureState().activity = items || [];
    renderIfMounted();
  }

  function setSurface(surfaceId, opts) {
    opts = opts || {};
    var aw = ensureState();
    aw.surface = surfaceId || aw.surface;
    if (opts.focusId) aw.focusId = opts.focusId;
    if (opts.state) aw.state = opts.state;
    if (opts.doing) aw.doing = opts.doing;
    renderIfMounted();
  }

  function pointAt(target) {
    ensureState().pointTarget = target || null;
    renderIfMounted();
    setTimeout(function () {
      var aw = ensureState();
      if (aw.pointTarget === target) {
        aw.pointTarget = null;
        renderIfMounted();
      }
    }, 2400);
  }

  function pushMessage(side, text, recommendation, opts) {
    opts = opts || {};
    var aw = ensureState();
    aw.messages.push({
      side: side,
      text: String(text || ''),
      recommendation: recommendation || null,
    });
    if (!opts.silentRender) renderIfMounted();
  }

  function recHtml(rec) {
    if (!rec) return '';
    return (
      '<div class="aw-rec" data-aw-rec="1">' +
      '<p class="aw-rec-why">' + esc(rec.reasoning || '') + '</p>' +
      '<div class="aw-rec-meta"><span>' + esc(rec.choice || 'Recommendation') + '</span>' +
      '<span class="aw-conf">Confidence <b>' + esc(String(rec.confidence != null ? rec.confidence : '—')) + '%</b></span>' +
      '</div></div>'
    );
  }

  function messagesHtml(aw) {
    return (aw.messages || [])
      .map(function (m) {
        var side = m.side === 'owner' ? 'owner' : 'hubly';
        var who = side === 'owner' ? 'You' : 'Hubly';
        return (
          '<div class="aw-msg ' + side + '"><span class="who">' + who + '</span>' +
          esc(m.text) + recHtml(m.recommendation) + '</div>'
        );
      })
      .join('');
  }

  function focusHtml(aw) {
    var hit = false;
    return FOCUS_BLOCKS.map(function (m) {
      var cls = 'aw-focus-chip';
      if (m.id === aw.focusId) {
        cls += ' is-on';
        hit = true;
      } else if (!hit) cls += ' is-done';
      return '<span class="' + cls + '">' + esc(m.label) + '</span>';
    }).join('');
  }

  function activityHtml(aw) {
    return (aw.activity || [])
      .map(function (a) {
        var st = a.status || 'next';
        var mark = st === 'done' ? '✓' : '';
        return (
          '<div class="aw-act is-' + esc(st) + '"><span class="mark">' + mark + '</span><span>' +
          esc(a.label) + '</span></div>'
        );
      })
      .join('');
  }

  function dirCard(id, label, hint, bg, isRec) {
    return (
      '<button type="button" class="aw-dir' + (isRec ? ' is-rec' : '') + '" data-aw-dir="' + esc(id) + '">' +
      '<div class="swatch" style="background:' + bg + '"></div>' +
      '<div class="meta">' + esc(label) + '<span>' + esc(hint) + '</span></div></button>'
    );
  }

  function surfaceHtml(aw) {
    var name = bizName();
    var point = aw.pointTarget;

    if (aw.surface === 'directions') {
      return (
        '<div class="aw-surface-panel">' +
        '<h2>Three directions for ' + esc(name) + '</h2>' +
        '<p>Before we build, I\'d love your opinion. Pick one — the Live Workspace becomes that storefront immediately.</p>' +
        '<div class="aw-dirs">' +
        dirCard('minimal', 'Minimal', 'Clean whitespace, quiet confidence', 'linear-gradient(160deg,#f8fafc,#cbd5e1)', true) +
        dirCard('luxury', 'Luxury', 'High contrast, premium presence', 'linear-gradient(135deg,#141b2b,#d9632d)', false) +
        dirCard('artisan', 'Artisan', 'Warm craft, handmade character', 'linear-gradient(145deg,#292524,#a8a29e)', false) +
        '</div></div>'
      );
    }

    if (aw.surface === 'compare') {
      return (
        '<div class="aw-surface-panel">' +
        '<h2>Compare two homepage directions</h2>' +
        '<p>The conversation splits the workspace — choose what feels right.</p>' +
        '<div class="aw-split">' +
        '<div class="aw-site-mock"><div class="nav"><span class="aw-logo">Minimal</span><span>Book</span></div>' +
        '<div class="hero"><h3>' + esc(name) + '</h3><p>Quiet confidence. Clear path to book.</p><span class="aw-cta">Book now</span></div></div>' +
        '<div class="aw-site-mock"><div class="nav"><span class="aw-logo">Bold</span><span>Book</span></div>' +
        '<div class="hero" style="background:linear-gradient(135deg,#d9632d,#141b2b)"><h3>' + esc(name) + '</h3><p>High energy. Unmistakable CTA.</p><span class="aw-cta">Book now</span></div></div>' +
        '</div></div>'
      );
    }

    if (aw.surface === 'website' || aw.surface === 'home') {
      var ctaCls = point === 'cta' ? ' aw-point' : '';
      var logoCls = point === 'logo' ? ' aw-point' : '';
      return (
        '<div class="aw-surface-panel">' +
        '<div class="aw-site-mock">' +
        '<div class="nav"><span class="aw-logo' + logoCls + '">' + esc(name) + '</span><span>Services · Reviews · About</span></div>' +
        '<div class="hero"><h3>Built with you — live</h3>' +
        '<p>This is the real workspace surface. When I change something, you\'ll see it move.</p>' +
        '<span class="aw-cta' + ctaCls + '" data-aw-node="cta">Book now</span></div></div>' +
        '<div class="aw-chips"><span class="aw-chip is-on">Live website</span><span class="aw-chip">Trust first</span></div></div>'
      );
    }

    if (aw.surface === 'commerce') {
      if (global.HublyCommerceRuntime && typeof global.HublyCommerceRuntime.workspaceHtml === 'function') {
        return global.HublyCommerceRuntime.workspaceHtml({ mode: 'storefront' });
      }
      return (
        '<div class="aw-surface-panel">' +
        '<h2>Storefront Builder</h2>' +
        '<p>The center morphed because you asked to build a storefront — no navigation, no modal.</p>' +
        '<div class="aw-chips"><span class="aw-chip is-on">Storefront live</span><span class="aw-chip">Catalog next</span></div></div>'
      );
    }

    if (aw.surface === 'products') {
      if (global.HublyCommerceRuntime && typeof global.HublyCommerceRuntime.workspaceHtml === 'function') {
        return global.HublyCommerceRuntime.workspaceHtml({ mode: 'products' });
      }
      return (
        '<div class="aw-surface-panel">' +
        '<h2>Product editor</h2>' +
        '<p>Generate, import, read a PDF, analyze a screenshot, or use your website — products appear here as we go.</p>' +
        '<div class="aw-chips"><span class="aw-chip is-on">Editor ready</span><span class="aw-chip">Inventory</span><span class="aw-chip">Checkout next</span></div></div>'
      );
    }

    if (aw.surface === 'studio') {
      return (
        '<div class="aw-surface-panel">' +
        '<h2>Studio canvas</h2>' +
        '<p>Building Mode is back for your campaign. Same conversation. Same home.</p>' +
        '<div class="aw-chips"><span class="aw-chip is-on">Campaign draft</span><span class="aw-chip">Brand kit</span></div></div>'
      );
    }

    if (aw.surface === 'marketplace') {
      return (
        '<div class="aw-surface-panel">' +
        '<h2>Get something done</h2>' +
        '<p>Job brief and trusted pro recommendations appear here — still Hubly, still one workspace.</p>' +
        '<div class="aw-chips"><span class="aw-chip is-on">Job brief</span><span class="aw-chip">Trusted pros</span></div></div>'
      );
    }

    return (
      '<div class="aw-surface-panel"><h2>' + esc(name) + '</h2>' +
      '<p>Live workspace — whatever we\'re building shows here.</p></div>'
    );
  }

  function shellHtml(aw) {
    var name = bizName();
    var surface = SURFACES[aw.surface] || SURFACES.home;
    var modeLabel = aw.mode === 'building' ? 'Building Mode' : '';
    return (
      '<div class="aw-shell" data-aw-mode="' + esc(aw.mode) + '" data-aw-state="' + esc(aw.state) + '" data-hubly-ai-workspace="1">' +
      '<header class="aw-top">' +
      '<div class="aw-brand">' +
      '<img class="hubly-mark" src="assets/hubly-wordmark-on-dark.png" alt="hubly" width="110" height="26">' +
      '<span class="aw-sync"><i></i> Live Sync</span>' +
      (modeLabel ? '<span class="aw-mode-pill">' + esc(modeLabel) + '</span>' : '') +
      '</div>' +
      '<div class="aw-context">' + (aw.mode === 'building' ? 'Building' : 'Running') + ' <span>' + esc(name) + '</span></div>' +
      '</header>' +
      '<div class="aw-grid">' +
      '<section class="aw-chat" aria-label="AI Conversation">' +
      '<div class="aw-pane-head"><strong>Conversation</strong><em>Guides the workspace</em></div>' +
      '<div class="aw-log" id="aw-log" aria-live="polite">' + messagesHtml(aw) + '</div>' +
      '<form class="aw-compose" id="aw-compose">' +
      '<div class="aw-compose-box">' +
      '<textarea id="aw-input" rows="2" placeholder="Ask Hubly anything…"></textarea>' +
      '<div class="aw-compose-bar">' +
      '<div class="aw-compose-tools">' +
      '<button type="button" class="aw-tool" data-aw-tool="upload">Upload</button>' +
      '<button type="button" class="aw-tool" data-aw-tool="website">Website</button>' +
      '<button type="button" class="aw-tool" data-aw-tool="screenshot">Screenshot</button>' +
      '<button type="button" class="aw-tool" data-aw-tool="pdf">PDF</button>' +
      '<button type="button" class="aw-tool" data-aw-tool="voice">Voice</button>' +
      '</div>' +
      '<button type="submit">Send</button>' +
      '</div></div>' +
      '<input type="file" id="aw-upload" hidden multiple accept="image/*,.pdf,.csv,.txt,.doc,.docx,.png,.jpg,.jpeg,.webp">' +
      '</form></section>' +
      '<section class="aw-live" aria-label="Live Workspace">' +
      '<div class="aw-live-chrome">' +
      '<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>' +
      '<div class="surface" id="aw-surface-chrome">' + esc(surface.chrome) + '</div>' +
      '</div>' +
      '<div class="aw-live-viewport" id="aw-surface">' + surfaceHtml(aw) + '</div>' +
      '</section>' +
      '<aside class="aw-activity" aria-label="Hubly Activity">' +
      '<div class="aw-pane-head"><strong>Hubly Activity</strong><em>What I\'m doing now</em></div>' +
      '<div class="aw-doing" id="aw-doing">' + esc(aw.doing || 'Working…') + '</div>' +
      '<div class="aw-activity-list" id="aw-activity">' + activityHtml(aw) + '</div>' +
      '<div class="aw-focus"><div class="label">Current Focus</div><div class="aw-focus-rail">' +
      focusHtml(aw) +
      '</div></div></aside>' +
      '</div></div>'
    );
  }

  function bind(root) {
    if (!root) return;
    var form = root.querySelector('#aw-compose');
    var input = root.querySelector('#aw-input');
    var file = root.querySelector('#aw-upload');

    if (form) {
      form.onsubmit = function (e) {
        e.preventDefault();
        var text = (input && input.value || '').trim();
        if (!text) return;
        if (input) input.value = '';
        handleOwnerTurn(text);
      };
      ['dragenter', 'dragover'].forEach(function (ev) {
        form.addEventListener(ev, function (e) {
          e.preventDefault();
          form.classList.add('is-drag');
        });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        form.addEventListener(ev, function (e) {
          e.preventDefault();
          form.classList.remove('is-drag');
          if (ev === 'drop' && e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
            ingestFiles(e.dataTransfer.files);
          }
        });
      });
    }

    if (input) {
      input.addEventListener('paste', function (e) {
        var items = e.clipboardData && e.clipboardData.items;
        if (!items) return;
        var files = [];
        for (var i = 0; i < items.length; i++) {
          if (items[i].kind === 'file') {
            var f = items[i].getAsFile();
            if (f) files.push(f);
          }
        }
        if (files.length) {
          e.preventDefault();
          ingestFiles(files);
        }
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          form && form.requestSubmit && form.requestSubmit();
        }
      });
    }

    root.querySelectorAll('[data-aw-tool]').forEach(function (btn) {
      btn.onclick = function () {
        var tool = btn.getAttribute('data-aw-tool');
        if (tool === 'upload' || tool === 'screenshot' || tool === 'pdf') {
          if (!file) return;
          if (tool === 'pdf') file.setAttribute('accept', '.pdf,application/pdf');
          else if (tool === 'screenshot') file.setAttribute('accept', 'image/*');
          else file.setAttribute('accept', 'image/*,.pdf,.csv,.txt,.doc,.docx,.png,.jpg,.jpeg,.webp');
          file.click();
          return;
        }
        if (tool === 'website') {
          handleOwnerTurn('Use my website as context and recommend what to build next.');
          return;
        }
        if (tool === 'voice') {
          pushMessage('hubly', 'Voice is ready when the browser allows mic access — paste, drop a file, or type and I\'ll keep the workspace moving.');
        }
      };
    });

    if (file) {
      file.onchange = function () {
        ingestFiles(file.files);
        file.value = '';
      };
    }

    root.querySelectorAll('[data-aw-dir]').forEach(function (btn) {
      btn.onclick = function () {
        var label = (btn.querySelector('.meta') && btn.querySelector('.meta').childNodes[0]
          ? btn.querySelector('.meta').childNodes[0].textContent
          : btn.getAttribute('data-aw-dir'));
        chooseDirection(btn.getAttribute('data-aw-dir'), label);
      };
    });

    var log = root.querySelector('#aw-log');
    if (log) log.scrollTop = log.scrollHeight;
  }

  function ingestFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    var names = files.map(function (f) { return f.name; });
    pushMessage('owner', 'Uploaded: ' + names.join(', '));
    setDoing('Building from your upload…');
    setActivity([
      { label: 'Upload received', status: 'done' },
      { label: 'Building from context…', status: 'on' },
      { label: 'Show in workspace', status: 'next' },
    ]);
    enterBuildingMode('website', { doing: 'Building from your upload…' });
    var Consultant = global.HublyConsultant;
    if (Consultant && typeof Consultant.buildFromContext === 'function') {
      Consultant.buildFromContext({
        files: files,
        message: 'Build the homepage from this upload. Prefer visible progress over more questions.',
        surface: 'website',
      }).then(function (result) {
        if (result && result.ok) {
          pushMessage(
            'hubly',
            'I built from your materials — the Live Workspace is updating. What should we improve?',
            {
              choice: 'Build from upload',
              confidence: 92,
              reasoning: 'Real materials beat questionnaires — screenshots, logos, and PDFs carry brand and offer context.',
            }
          );
          transition('reviewing_website', {
            surface: 'website',
            doing: 'Showing what I built…',
            activity: [
              { label: 'Built from upload', status: 'done' },
              { label: 'Waiting for your feedback…', status: 'on' },
            ],
          });
          return;
        }
        if (result && result.error === 'not_configured') {
          pushMessage('hubly', 'Provider not configured yet — your upload is saved as Business Context. I\'ll build from it as soon as AI is connected.');
          setDoing('Context saved — waiting for AI provider…');
          return;
        }
        pushMessage('hubly', (result && result.message) || 'Got it — Business Context updated. Tell me what to build next.');
        setDoing('Ready for your next goal…');
      }).catch(function () {
        pushMessage('hubly', 'Got it — Business Context updated. Tell me what to build next.');
      });
      return;
    }
    pushMessage('hubly', 'Got it — this becomes Business Context. I\'ll use it in the next recommendation.');
  }

  function chooseDirection(id, label) {
    pushMessage('owner', String(label || id));
    pushMessage(
      'hubly',
      'Nice choice. I\'m applying ' + (label || id) + ' and moving your booking button higher so customers can act fast.',
      {
        choice: String(label || id) + ' direction',
        confidence: 93,
        reasoning: 'I recommend leading with a strong book path because your goal is getting customers quickly — not browsing.',
      }
    );
    transition('reviewing_website', {
      surface: 'website',
      doing: 'Building your homepage…',
      activity: [
        { label: 'Direction chosen', status: 'done' },
        { label: 'Building your homepage…', status: 'on' },
        { label: 'Products next', status: 'next' },
      ],
      pointTarget: 'cta',
    });
    ensureState().chosenDirection = id;
    setTimeout(function () {
      pointAt('cta');
      setDoing('Moving booking button higher…');
    }, 200);
  }

  function handleOwnerTurn(text) {
    var t = String(text || '').trim();
    if (!t) return;
    pushMessage('owner', t);
    var lower = t.toLowerCase();

    if (/storefront|store|shop|commerce|sell /.test(lower)) {
      enterBuildingMode('storefront', { doing: 'Opening Storefront Builder…' });
      pushMessage(
        'hubly',
        'Awesome. Before we build it I\'d love your opinion — I created three directions. The workspace is becoming your storefront builder now.',
        {
          choice: 'Show three storefront directions',
          confidence: 91,
          reasoning: 'People choose better than they invent — three concrete directions beat open-ended design questions.',
        }
      );
      setSurface('directions', { focusId: 'commerce', state: 'building_commerce', doing: 'Preparing three directions…' });
      setActivity([
        { label: 'Entered Building Mode', status: 'done' },
        { label: 'Preparing three directions…', status: 'on' },
        { label: 'Products next', status: 'next' },
      ]);
      return;
    }

    if (/campaign|marketing|studio|christmas|holiday|promotion/.test(lower)) {
      enterBuildingMode('campaign', { doing: 'Opening Studio…' });
      pushMessage(
        'hubly',
        'Building Mode is back. Studio is opening in the center — same home, new project.',
        {
          choice: 'Open Studio canvas',
          confidence: 90,
          reasoning: 'Major creative work deserves Building Mode — no sidebar, no distraction.',
        }
      );
      setActivity([
        { label: 'Re-entered Building Mode', status: 'done' },
        { label: 'Opening Studio…', status: 'on' },
        { label: 'Campaign draft', status: 'next' },
      ]);
      return;
    }

    if (/photograph|find (a |me )?(pro|someone)|cleaning|lawn|get .+ done|hire/.test(lower)) {
      enterBuildingMode('marketplace', { doing: 'Preparing job brief…' });
      pushMessage('hubly', 'Describe the job. I\'ll keep recommendations live in the workspace — still one conversation.');
      setActivity([
        { label: 'Job brief', status: 'on' },
        { label: 'Trusted pros', status: 'next' },
      ]);
      return;
    }

    if (/compare|two directions|split/.test(lower)) {
      enterBuildingMode('website', { doing: 'Splitting the workspace…' });
      pushMessage('hubly', 'Let\'s compare two homepage directions — watch the center split.');
      setSurface('compare', { focusId: 'website', state: 'building_website', doing: 'Comparing homepage directions…' });
      return;
    }

    if (/logo larger|bigger logo/.test(lower)) {
      enterBuildingMode('website', { doing: 'Making your logo larger…' });
      transition('reviewing_website', {
        surface: 'website',
        doing: 'Making your logo larger…',
        pointTarget: 'logo',
        message: 'I made your logo larger so the brand leads the first screen.',
        recommendation: {
          choice: 'Larger logo',
          confidence: 88,
          reasoning: 'Brand-first presence builds recognition before the offer — especially for local service businesses.',
        },
      });
      return;
    }

    if (/booking (button )?higher|move booking|cta higher/.test(lower)) {
      enterBuildingMode('website', { doing: 'Moving booking button higher…' });
      transition('reviewing_website', {
        surface: 'website',
        doing: 'Moving booking button higher…',
        pointTarget: 'cta',
        message: 'I\'m moving your booking button higher.',
        recommendation: {
          choice: 'Booking above the fold',
          confidence: 94,
          reasoning: 'Trust plus an obvious book path converts faster for local businesses than burying the CTA.',
        },
      });
      return;
    }

    if (/love it|looks great|perfect|continue|keep going|^yes\b/.test(lower)) {
      pushMessage(
        'hubly',
        'Perfect. Let\'s build your products. Generate, import, PDF, screenshot, or website — what do you prefer?',
        {
          choice: 'Move to products',
          confidence: 89,
          reasoning: 'You\'re happy with the direction — momentum means shipping the catalog next, not more abstract questions.',
        }
      );
      transition('building_products', {
        doing: 'Preparing product editor…',
        activity: [
          { label: 'Website reviewed', status: 'done' },
          { label: 'Preparing product editor…', status: 'on' },
          { label: 'Payments next', status: 'next' },
        ],
      });
      return;
    }

    if (/done building|back to (home|operating)|finish building|run (my|the) business/.test(lower)) {
      enterOperatingMode({
        message: 'Back to Operating Mode. Start any major project and I\'ll re-enter Building Mode automatically.',
      });
      return;
    }

    pushMessage(
      'hubly',
      'I\'m with you. Ask me to build a storefront, campaign, or tweak the site — I\'ll morph the workspace and show my reasoning.',
      {
        choice: 'Keep building in the workspace',
        confidence: 86,
        reasoning: 'Visible progress beats menus — tell me the outcome and I\'ll change the center.',
      }
    );
    setDoing('Listening for your next goal…');
  }

  var mountedRoot = null;

  function renderInto(root, opts) {
    opts = opts || {};
    if (!root) return null;
    var aw = ensureState();
    if (opts.mode) aw.mode = opts.mode;
    if (opts.state) aw.state = opts.state;
    applyMode(aw.mode);
    if (aw.mode === 'operating') {
      try {
        var growth = document.querySelector('#app-nav [data-v="growth"]');
        if (growth) {
          growth.hidden = false;
          growth.removeAttribute('aria-hidden');
          growth.classList.remove('jos-nav-hidden');
          var lbl = growth.querySelector('.ni-lbl');
          if (lbl) lbl.textContent = 'Growth';
          growth.setAttribute('title', 'Growth');
        }
        var store = document.querySelector('#app-nav [data-v="store"] .ni-lbl');
        if (store) store.textContent = 'Commerce';
        var editor = document.querySelector('#app-nav [data-v="editor"] .ni-lbl');
        if (editor) editor.textContent = 'Website';
      } catch (e) {}
    }
    root.innerHTML = shellHtml(aw);
    root.classList.add('jos-ai-workspace-root');
    mountedRoot = root;
    bind(root);
    return root;
  }

  function renderIfMounted() {
    if (mountedRoot && document.contains(mountedRoot)) {
      renderInto(mountedRoot, { mode: ensureState().mode, state: ensureState().state });
    }
  }

  function mountOperateHome() {
    var root = document.getElementById('jos-dash-root');
    if (!root) return null;
    var aw = ensureState();
    if (aw.mode === 'building') {
      /* Recurring Building Mode can own the home surface too */
      return renderInto(root, { mode: 'building', state: aw.state });
    }
    return renderInto(root, { mode: 'operating', state: 'operating' });
  }

  function enhanceArchitectActivity() {
    var grid = document.querySelector('#is-step-creative-build .is-architect-grid');
    if (!grid || grid.querySelector('.is-architect-activity')) return;
    var aside = document.createElement('aside');
    aside.className = 'is-architect-activity aw-activity';
    aside.setAttribute('aria-label', 'Hubly Activity');
    aside.innerHTML =
      '<div class="aw-pane-head"><strong>Hubly Activity</strong><em>What I\'m doing now</em></div>' +
      '<div class="aw-doing">Building with you…</div>' +
      '<div class="is-architect-checklist aw-activity-list" id="is-architect-activity-list"></div>';
    grid.appendChild(aside);
    var old = document.getElementById('is-architect-checklist');
    if (old && old.parentNode) {
      var list = aside.querySelector('#is-architect-activity-list');
      if (list) {
        list.id = 'is-architect-checklist';
        old.remove();
      }
    }
  }

  global.HublyAIWorkspace = {
    version: '1.2.0',
    milestones: FOCUS_BLOCKS, // legacy alias
    focusBlocks: FOCUS_BLOCKS,
    states: STATES,
    ensureState: ensureState,
    transition: transition,
    enterBuildingMode: enterBuildingMode,
    enterOperatingMode: enterOperatingMode,
    renderInto: renderInto,
    mountOperateHome: mountOperateHome,
    pushMessage: pushMessage,
    setActivity: setActivity,
    setDoing: setDoing,
    setSurface: setSurface,
    setMilestone: function (id) { ensureState().focusId = id; renderIfMounted(); },
    setMode: applyMode,
    pointAt: pointAt,
    markBuildingComplete: markBuildingComplete,
    hasFinishedFirstBuild: hasFinishedFirstBuild,
    handleOwnerTurn: handleOwnerTurn,
    enhanceArchitectActivity: enhanceArchitectActivity,
  };

  document.addEventListener('DOMContentLoaded', function () {
    try { enhanceArchitectActivity(); } catch (e) {}
  });
})(typeof window !== 'undefined' ? window : globalThis);
