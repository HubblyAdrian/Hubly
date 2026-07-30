/**
 * Hubly AI Workspace — permanent home of Hubly AI
 * Building Mode (immersive) and Operating Mode (sidebar) share this shell.
 * North star: "Let's keep building." — not "Where do I click?"
 */
(function (global) {
  'use strict';

  var MILESTONES = [
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

  var SURFACES = {
    website: { title: 'Website', chrome: 'yourbusiness.hubly.ai' },
    commerce: { title: 'Storefront', chrome: 'store · commerce' },
    products: { title: 'Products', chrome: 'catalog editor' },
    studio: { title: 'Studio', chrome: 'campaign workspace' },
    marketplace: { title: 'Marketplace', chrome: 'find a pro' },
    media: { title: 'Media', chrome: 'library' },
    customers: { title: 'Customers', chrome: 'CRM' },
    directions: { title: 'Choose a direction', chrome: 'live concepts' },
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
    var n = String(st._is && st._is.ownerName || st.ownerName || st.userName || '').trim();
    if (n) return n.split(/\s+/)[0];
    return '';
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
          text: greeting() + ' Ready when you are — tell me what you want to build or grow next.',
        },
      ];
    }
    if (!aw.activity) {
      aw.activity = [
        { label: 'Business Context', status: 'done' },
        { label: 'Brand Kit', status: 'done' },
        { label: 'Building store', status: 'on' },
        { label: 'Products next', status: 'next' },
        { label: 'Launch', status: 'next' },
      ];
    }
    if (!aw.milestoneId) aw.milestoneId = 'vision';
    if (!aw.surface) aw.surface = 'directions';
    if (!aw.mode) aw.mode = 'operating'; // building | operating
    return aw;
  }

  function markBuildingComplete() {
    try {
      localStorage.setItem('hubly_aw_built', '1');
      var st = S();
      st._aw = st._aw || {};
      st._aw.firstBuildDone = true;
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

  function setMode(mode) {
    var aw = ensureState();
    aw.mode = mode === 'building' ? 'building' : 'operating';
    document.body.classList.toggle('aw-building-mode', aw.mode === 'building');
    var app = document.getElementById('p-app');
    if (app) {
      app.classList.toggle('jos-ai-workspace-home', aw.mode === 'operating');
    }
  }

  function pushMessage(side, text) {
    var aw = ensureState();
    aw.messages.push({ side: side, text: String(text || '') });
    renderIfMounted();
  }

  function setActivity(items) {
    ensureState().activity = items || [];
    renderIfMounted();
  }

  function setSurface(surfaceId, opts) {
    var aw = ensureState();
    aw.surface = surfaceId || 'website';
    if (opts && opts.milestoneId) aw.milestoneId = opts.milestoneId;
    renderIfMounted();
  }

  function setMilestone(id) {
    ensureState().milestoneId = id;
    renderIfMounted();
  }

  function surfaceHtml(aw) {
    var surface = SURFACES[aw.surface] || SURFACES.website;
    var name = bizName();
    if (aw.surface === 'directions') {
      return (
        '<div class="aw-surface-panel">' +
        '<h2>Three directions for ' + esc(name) + '</h2>' +
        '<p>Before we build, I\'d love your opinion. Pick the direction that feels right — we\'ll make it live immediately.</p>' +
        '<div class="aw-dirs">' +
        dirCard('minimal', 'Minimal', 'Clean whitespace, quiet confidence', 'linear-gradient(160deg,#f8fafc,#cbd5e1)') +
        dirCard('luxury', 'Luxury', 'High contrast, premium presence', 'linear-gradient(135deg,#141b2b,#d9632d)') +
        dirCard('artisan', 'Artisan', 'Warm craft, handmade character', 'linear-gradient(145deg,#292524,#a8a29e)') +
        '</div></div>'
      );
    }
    if (aw.surface === 'products' || aw.surface === 'commerce') {
      return (
        '<div class="aw-surface-panel">' +
        '<h2>' + esc(surface.title) + '</h2>' +
        '<p>Your catalog is taking shape in the Live Workspace. Generate, import, or upload a PDF / screenshot — I\'ll build visible product cards next.</p>' +
        '<div class="aw-chips">' +
        '<span class="aw-chip is-on">Catalog live</span>' +
        '<span class="aw-chip">Inventory ready</span>' +
        '<span class="aw-chip">Checkout next</span>' +
        '</div></div>'
      );
    }
    if (aw.surface === 'studio') {
      return (
        '<div class="aw-surface-panel">' +
        '<h2>Studio</h2>' +
        '<p>Campaign drafts appear here — same conversation, same workspace. Tell me what you want to promote.</p>' +
        '<div class="aw-chips"><span class="aw-chip is-on">Campaign canvas</span><span class="aw-chip">Brand kit linked</span></div></div>'
      );
    }
    if (aw.surface === 'marketplace') {
      return (
        '<div class="aw-surface-panel">' +
        '<h2>Get something done</h2>' +
        '<p>Describe the job. I\'ll help you brief it and connect with trusted pros — without leaving this workspace.</p>' +
        '<div class="aw-chips"><span class="aw-chip is-on">Job brief</span><span class="aw-chip">Trusted pros</span></div></div>'
      );
    }
    return (
      '<div class="aw-surface-panel">' +
      '<h2>' + esc(name) + '</h2>' +
      '<p>Your live ' + esc(surface.title.toLowerCase()) + ' updates here as we build together. Nothing happens in secret.</p>' +
      '<div class="aw-chips">' +
      '<span class="aw-chip is-on">Live preview</span>' +
      '<span class="aw-chip">Brand applied</span>' +
      '<span class="aw-chip">Ready to tweak</span>' +
      '</div></div>'
    );
  }

  function dirCard(id, label, hint, bg) {
    return (
      '<button type="button" class="aw-dir" data-aw-dir="' + esc(id) + '">' +
      '<div class="swatch" style="background:' + bg + '"></div>' +
      '<div class="meta">' + esc(label) + '<span>' + esc(hint) + '</span></div></button>'
    );
  }

  function activityHtml(aw) {
    return (aw.activity || [])
      .map(function (a) {
        var st = a.status || 'next';
        var mark = st === 'done' ? '✓' : '';
        return (
          '<div class="aw-act is-' + esc(st) + '"><span class="mark">' + mark + '</span><span>' + esc(a.label) + '</span></div>'
        );
      })
      .join('');
  }

  function milestonesHtml(aw) {
    var hit = false;
    return MILESTONES.map(function (m) {
      var cls = 'aw-mile';
      if (m.id === aw.milestoneId) {
        cls += ' is-on';
        hit = true;
      } else if (!hit) cls += ' is-done';
      return '<span class="' + cls + '">' + esc(m.label) + '</span>';
    }).join('');
  }

  function messagesHtml(aw) {
    return (aw.messages || [])
      .map(function (m) {
        var side = m.side === 'owner' ? 'owner' : 'hubly';
        var who = side === 'owner' ? 'You' : 'Hubly';
        return '<div class="aw-msg ' + side + '"><span class="who">' + who + '</span>' + esc(m.text) + '</div>';
      })
      .join('');
  }

  function shellHtml(aw) {
    var name = bizName();
    var surface = SURFACES[aw.surface] || SURFACES.website;
    return (
      '<div class="aw-shell" data-aw-mode="' + esc(aw.mode) + '" data-hubly-ai-workspace="1">' +
      '<header class="aw-top">' +
      '<div class="aw-brand">' +
      '<img class="hubly-mark" src="assets/hubly-wordmark-on-dark.png" alt="hubly" width="110" height="26">' +
      '<span class="aw-sync" aria-live="polite"><i></i> Live Sync</span>' +
      '</div>' +
      '<div class="aw-context">Building <span>' + esc(name) + '</span></div>' +
      '</header>' +
      '<div class="aw-grid">' +
      '<section class="aw-chat" aria-label="AI Conversation">' +
      '<div class="aw-pane-head"><strong>AI Conversation</strong><em>Always Hubly</em></div>' +
      '<div class="aw-log" id="aw-log" aria-live="polite">' + messagesHtml(aw) + '</div>' +
      '<form class="aw-compose" id="aw-compose">' +
      '<div class="aw-compose-tools">' +
      '<button type="button" class="aw-tool" data-aw-tool="upload">Upload</button>' +
      '<button type="button" class="aw-tool" data-aw-tool="website">Website</button>' +
      '<button type="button" class="aw-tool" data-aw-tool="screenshot">Screenshot</button>' +
      '<button type="button" class="aw-tool" data-aw-tool="pdf">PDF</button>' +
      '<button type="button" class="aw-tool" data-aw-tool="voice">Voice</button>' +
      '</div>' +
      '<div class="aw-compose-row">' +
      '<input type="text" id="aw-input" placeholder="Ask Hubly anything…" autocomplete="off">' +
      '<button type="submit">Send</button>' +
      '</div>' +
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
      '<div class="aw-pane-head"><strong>Hubly Activity</strong><em>Always working</em></div>' +
      '<div class="aw-activity-list" id="aw-activity">' + activityHtml(aw) + '</div>' +
      '<div class="aw-milestones"><div class="label">Journey</div><div class="aw-mile-rail">' +
      milestonesHtml(aw) +
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
    }
    root.querySelectorAll('[data-aw-tool]').forEach(function (btn) {
      btn.onclick = function () {
        var tool = btn.getAttribute('data-aw-tool');
        if (tool === 'upload' || tool === 'screenshot' || tool === 'pdf') {
          if (file) {
            if (tool === 'pdf') file.setAttribute('accept', '.pdf,application/pdf');
            else if (tool === 'screenshot') file.setAttribute('accept', 'image/*');
            else file.setAttribute('accept', 'image/*,.pdf,.csv,.txt,.doc,.docx,.png,.jpg,.jpeg,.webp');
            file.click();
          }
          return;
        }
        if (tool === 'website') {
          handleOwnerTurn('Here is my website URL — please use it as context.');
          return;
        }
        if (tool === 'voice') {
          pushMessage('hubly', 'Voice is ready when your browser allows it — for now, type or upload context and I\'ll keep building with you.');
        }
      };
    });
    if (file) {
      file.onchange = function () {
        var files = Array.prototype.slice.call(file.files || []);
        if (!files.length) return;
        var names = files.map(function (f) { return f.name; });
        pushMessage('owner', 'Uploaded: ' + names.join(', '));
        pushMessage('hubly', 'Got it — I\'ll use ' + (names.length === 1 ? 'this' : 'these') + ' as Business Context for the next recommendations.');
        setActivity([
          { label: 'Business Context', status: 'done' },
          { label: 'Upload received', status: 'done' },
          { label: 'Analyzing context…', status: 'on' },
          { label: 'Next recommendation', status: 'next' },
        ]);
        file.value = '';
      };
    }
    root.querySelectorAll('[data-aw-dir]').forEach(function (btn) {
      btn.onclick = function () {
        chooseDirection(btn.getAttribute('data-aw-dir'), btn.querySelector('.meta')?.childNodes[0]?.textContent || 'that direction');
      };
    });
    var log = root.querySelector('#aw-log');
    if (log) log.scrollTop = log.scrollHeight;
  }

  function chooseDirection(id, label) {
    pushMessage('owner', String(label || id));
    pushMessage('hubly', 'Nice choice. I think this fits your audience really well. Building it live now — what would you like to change before we continue?');
    setSurface('website', { milestoneId: 'website' });
    setActivity([
      { label: 'Business Context', status: 'done' },
      { label: 'Brand Kit', status: 'done' },
      { label: 'Direction · ' + (label || id), status: 'done' },
      { label: 'Homepage generated', status: 'on' },
      { label: 'Products next', status: 'next' },
    ]);
    ensureState().chosenDirection = id;
  }

  function handleOwnerTurn(text) {
    var t = String(text || '').trim();
    if (!t) return;
    pushMessage('owner', t);
    var lower = t.toLowerCase();

    if (/storefront|store|shop|commerce|sell|product/.test(lower)) {
      pushMessage('hubly', 'Awesome. Before we build it I\'d love your opinion — I created three directions.');
      setSurface('directions', { milestoneId: 'commerce' });
      setActivity([
        { label: 'Business Context', status: 'done' },
        { label: 'Brand Kit', status: 'done' },
        { label: 'Preparing directions…', status: 'on' },
        { label: 'Products next', status: 'next' },
        { label: 'Launch', status: 'next' },
      ]);
      return;
    }
    if (/campaign|marketing|studio|christmas|instagram|email/.test(lower)) {
      pushMessage('hubly', 'Let\'s grow. I\'ll open Studio in the Live Workspace and recommend a direction.');
      setSurface('studio', { milestoneId: 'growth' });
      setActivity([
        { label: 'Business Context', status: 'done' },
        { label: 'Opening Studio', status: 'on' },
        { label: 'Campaign draft next', status: 'next' },
      ]);
      return;
    }
    if (/photograph|find (a |me )?(pro|someone)|cleaning|lawn|get .+ done|hire/.test(lower)) {
      pushMessage('hubly', 'You\'re in the right place. Describe the job — I\'ll keep a live brief on the right and help you get it done.');
      setSurface('marketplace', { milestoneId: 'media' });
      setActivity([
        { label: 'Job brief', status: 'on' },
        { label: 'Trusted pros', status: 'next' },
      ]);
      return;
    }
    if (/love it|looks great|perfect|continue|keep going|yes/.test(lower)) {
      pushMessage('hubly', 'Perfect. Let\'s build your products. I can generate them, import them, read a PDF, analyze a screenshot, or read your website — what would you prefer?');
      setSurface('products', { milestoneId: 'catalog' });
      setActivity([
        { label: 'Website live', status: 'done' },
        { label: 'Preparing products…', status: 'on' },
        { label: 'Payments next', status: 'next' },
      ]);
      return;
    }
    pushMessage('hubly', 'I\'m with you. Tell me what to build or change — or upload a screenshot, PDF, or URL and I\'ll recommend the next move.');
    setActivity([
      { label: 'Listening', status: 'on' },
      { label: 'Business Context', status: 'done' },
      { label: 'Ready to recommend', status: 'next' },
    ]);
  }

  var mountedRoot = null;

  function renderInto(root, opts) {
    opts = opts || {};
    if (!root) return null;
    var aw = ensureState();
    if (opts.mode) aw.mode = opts.mode;
    else if (hasFinishedFirstBuild()) aw.mode = 'operating';
    setMode(aw.mode);
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
      renderInto(mountedRoot, { mode: ensureState().mode });
    }
  }

  function mountOperateHome() {
    var root = document.getElementById('jos-dash-root');
    if (!root) return null;
    return renderInto(root, { mode: 'operating' });
  }

  function enhanceArchitectActivity() {
    var grid = document.querySelector('#is-step-creative-build .is-architect-grid');
    if (!grid || grid.querySelector('.is-architect-activity')) return;
    var aside = document.createElement('aside');
    aside.className = 'is-architect-activity aw-activity';
    aside.setAttribute('aria-label', 'Hubly Activity');
    aside.innerHTML =
      '<div class="aw-pane-head"><strong>Hubly Activity</strong><em>Always working</em></div>' +
      '<div class="is-architect-checklist aw-activity-list" id="is-architect-activity-list"></div>';
    grid.appendChild(aside);
    // Move checklist rendering target if present
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
    version: '1.0.0',
    milestones: MILESTONES,
    ensureState: ensureState,
    renderInto: renderInto,
    mountOperateHome: mountOperateHome,
    pushMessage: pushMessage,
    setActivity: setActivity,
    setSurface: setSurface,
    setMilestone: setMilestone,
    setMode: setMode,
    markBuildingComplete: markBuildingComplete,
    hasFinishedFirstBuild: hasFinishedFirstBuild,
    handleOwnerTurn: handleOwnerTurn,
    enhanceArchitectActivity: enhanceArchitectActivity,
  };

  document.addEventListener('DOMContentLoaded', function () {
    try { enhanceArchitectActivity(); } catch (e) {}
  });
})(typeof window !== 'undefined' ? window : globalThis);
