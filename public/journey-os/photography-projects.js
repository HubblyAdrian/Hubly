/**
 * Hubly Media — visual asset manager & job workspace (Operate).
 * Every Hubly business gets Media. Industry capabilities unlock tools:
 * Lightroom (optional photo edit), galleries, before/after, property albums,
 * job docs, Canva (optional design). Hubly owns media without integrations.
 * Supabase is SSOT for project records; localStorage only caches UI prefs.
 * Table names remain photography_* for compatibility — product label is Media.
 */
(function (global) {
  'use strict';

  var PROJECT_TYPES = [
    'Wedding', 'Portrait', 'Family', 'Sports', 'Commercial',
    'Product', 'Real Estate', 'Graduation', 'Event', 'Other'
  ];
  var STATUSES = [
    'Lead', 'Booked', 'Scheduled', 'Shooting', 'Editing', 'Proofing', 'Delivered', 'Archived'
  ];
  var TIMELINE_DEFAULTS_PHOTO = [
    { event_key: 'booking', label: 'Booking' },
    { event_key: 'contract_sent', label: 'Contract Sent' },
    { event_key: 'contract_signed', label: 'Contract Signed' },
    { event_key: 'deposit_paid', label: 'Deposit Paid' },
    { event_key: 'shoot_scheduled', label: 'Shoot Scheduled' },
    { event_key: 'shoot_completed', label: 'Shoot Completed' },
    { event_key: 'editing_started', label: 'Editing Started' },
    { event_key: 'editing_complete', label: 'Editing Complete' },
    { event_key: 'gallery_delivered', label: 'Gallery Delivered' },
    { event_key: 'final_payment', label: 'Final Payment' },
    { event_key: 'review_requested', label: 'Review Requested' },
    { event_key: 'referral_sent', label: 'Referral Sent' }
  ];
  var TIMELINE_DEFAULTS_JOB = [
    { event_key: 'booking', label: 'Booking' },
    { event_key: 'contract_sent', label: 'Contract Sent' },
    { event_key: 'contract_signed', label: 'Contract Signed' },
    { event_key: 'deposit_paid', label: 'Deposit Paid' },
    { event_key: 'job_scheduled', label: 'Job Scheduled' },
    { event_key: 'job_started', label: 'Job Started' },
    { event_key: 'job_completed', label: 'Job Completed' },
    { event_key: 'media_ready', label: 'Media Ready' },
    { event_key: 'delivered', label: 'Deliverables Sent' },
    { event_key: 'final_payment', label: 'Final Payment' },
    { event_key: 'review_requested', label: 'Review Requested' },
    { event_key: 'referral_sent', label: 'Referral Sent' }
  ];
  var TIMELINE_DEFAULTS = TIMELINE_DEFAULTS_JOB;
  var MARKETING_CHANNELS = [
    { channel: 'instagram', title: 'Instagram' },
    { channel: 'facebook', title: 'Facebook' },
    { channel: 'pinterest', title: 'Pinterest' },
    { channel: 'blog', title: 'Blog' },
    { channel: 'website', title: 'Website' },
    { channel: 'email', title: 'Email Campaign' },
    { channel: 'review_request', title: 'Review Request' },
    { channel: 'referral', title: 'Referral Campaign' },
    { channel: 'before_after', title: 'Before & After Carousel' }
  ];
  var CREATE_ASSETS = [
    { id: 'lightroom', label: 'Lightroom', hint: 'Connected App — optional until Adobe connects' },
    { id: 'folder', label: 'Client Folder', hint: 'Hubly project workspace' },
    { id: 'contract', label: 'Contract' },
    { id: 'invoice', label: 'Invoice' },
    { id: 'questionnaire', label: 'Questionnaire' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'shot_list', label: 'Shot List' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'marketing', label: 'Marketing Workflow' },
    { id: 'canva', label: 'Canva', hint: 'Connected App — Creative Engine' }
  ];
  var POST_EDIT_PIPELINE = [
    'Gallery Created',
    'Invoice Sent',
    'Instagram Generated',
    'Blog Generated',
    'Google Business Updated',
    'Review Sent',
    'Referral Campaign',
    'Anniversary Reminder'
  ];

  var WORKSPACE_PROVIDERS = (global.HublyConnectedApps && global.HublyConnectedApps.list)
    ? global.HublyConnectedApps.list().map(function (a) {
      return { id: a.id, label: a.name, role: a.role, available: a.id === 'adobe_lightroom' || a.id === 'canva' };
    })
    : [
      { id: 'adobe_lightroom', label: 'Adobe Lightroom', role: 'Editing', available: true },
      { id: 'canva', label: 'Canva', role: 'Creative', available: true },
      { id: 'frame_io', label: 'Frame.io', role: 'Review', available: false },
      { id: 'dropbox', label: 'Dropbox', role: 'Storage', available: false },
      { id: 'google_drive', label: 'Google Drive', role: 'Storage', available: false }
    ];

  var _cache = { businessId: null, projects: [], loaded: false, loading: null };

  function el(id) { return document.getElementById(id); }
  function S() { return global.S || {}; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function publishBus(type, payload) {
    try {
      if (global.HublyEvents && typeof global.HublyEvents.publish === 'function') {
        global.HublyEvents.publish(type, Object.assign({ businessId: businessId() }, payload || {}));
      }
    } catch (_) {}
  }

  function toast(msg) {
    try { if (typeof global.toast === 'function') global.toast(msg); } catch (e) {}
  }
  function money(cents) {
    var n = (Number(cents) || 0) / 100;
    return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function daysUntil(dateStr) {
    if (!dateStr) return null;
    var t = new Date(String(dateStr).slice(0, 10) + 'T12:00:00');
    var now = new Date();
    now.setHours(12, 0, 0, 0);
    return Math.round((t - now) / 86400000);
  }
  function countdownLabel(dateStr) {
    var d = daysUntil(dateStr);
    var noun = isPhotoTrade() ? 'Shoot' : 'Job';
    if (d == null) return 'No ' + noun.toLowerCase() + ' date';
    if (d === 0) return noun + ' today';
    if (d > 0) return d + ' day' + (d === 1 ? '' : 's') + ' to ' + noun.toLowerCase();
    return Math.abs(d) + ' day' + (Math.abs(d) === 1 ? '' : 's') + ' ago';
  }
  function statusTone(st) {
    return ({
      Lead: 'lead', Booked: 'booked', Scheduled: 'scheduled', Shooting: 'shooting',
      Editing: 'editing', Proofing: 'proofing', Delivered: 'delivered', Archived: 'archived'
    })[st] || 'lead';
  }
  function formatDate(d) {
    if (!d) return 'TBD';
    try {
      return new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric'
      });
    } catch (e) { return String(d); }
  }
  function formatRelative(iso) {
    if (!iso) return 'Never';
    var ms = Date.now() - new Date(iso).getTime();
    if (ms < 60000) return 'Just now';
    if (ms < 3600000) return Math.floor(ms / 60000) + 'm ago';
    if (ms < 86400000) return Math.floor(ms / 3600000) + 'h ago';
    return Math.floor(ms / 86400000) + 'd ago';
  }
  function workspaceId() {
    return 'ws_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }
  function businessId() {
    try {
      // Prefer window/global — hubly.html now exposes currentBusiness as a var.
      if (global.currentBusiness && global.currentBusiness.id) {
        return String(global.currentBusiness.id);
      }
    } catch (e) {}
    try {
      // Lexical fallback if another script still holds a let binding.
      if (typeof currentBusiness !== 'undefined' && currentBusiness && currentBusiness.id) {
        return String(currentBusiness.id);
      }
    } catch (e2) {}
    try {
      if (global.HublyJourney && typeof global.HublyJourney.getActiveBusinessId === 'function') {
        var fromJourney = global.HublyJourney.getActiveBusinessId();
        if (fromJourney) return String(fromJourney);
      }
    } catch (e3) {}
    var st = S() || {};
    return st.businessId || st.bizId || (st.business && st.business.id) || null;
  }
  /** brand-assets RLS requires first path folder = auth.uid() (same as uploadBrandAsset). */
  function authOwnerId() {
    try {
      if (global.currentUser && global.currentUser.id) return String(global.currentUser.id);
    } catch (e) {}
    try {
      if (typeof currentUser !== 'undefined' && currentUser && currentUser.id) return String(currentUser.id);
    } catch (e2) {}
    return null;
  }
  function isDurableMediaUrl(url) {
    var u = String(url || '');
    return !!(u && u.indexOf('blob:') !== 0 && u.indexOf('data:') !== 0);
  }
  function isSignedIn() {
    try {
      if (global.currentUser && (global.currentUser.id || global.currentUser.email)) return true;
    } catch (e) {}
    try {
      if (typeof currentUser !== 'undefined' && currentUser && (currentUser.id || currentUser.email)) return true;
    } catch (e2) {}
    try {
      if (S().userId || S().uid) return true;
    } catch (e3) {}
    return false;
  }
  /**
   * Soft guard only — owners are already in Hubly Operate.
   * Never send them to Hubly login from Projects create.
   * Adobe / Lightroom sign-in is a separate Connect Adobe flow.
   */
  function ensureBusinessForSave() {
    if (businessId()) return true;
    toast('Couldn\u2019t find your business yet — refresh the page, then try again.');
    return false;
  }
  async function dbClient() {
    if (typeof global.waitForDb === 'function') return global.waitForDb(8000);
    return global._hublyDb || (global.window && global.window._hublyDb) || null;
  }

  /* ─── Capabilities + trade profile (features gate — module is core) ─── */

  function businessCapabilities() {
    var biz = global.currentBusiness || {};
    var caps = Object.assign({}, S().capabilities || {}, biz.capabilities || {});
    return caps;
  }
  function hasCapability(key) {
    // Media is a core Hubly module — always on.
    if (key === 'projects') return true;
    if (typeof global.hasBusinessCapability === 'function') {
      try { return !!global.hasBusinessCapability(key); } catch (e) {}
    }
    var caps = businessCapabilities();
    if (caps && caps[key] === true) return true;
    try {
      if (typeof global.blueprintHas === 'function' && global.blueprintHas(key)) return true;
    } catch (e2) {}
    return false;
  }
  function hasProjectsCapability() {
    return true;
  }
  function tradeId() {
    var biz = global.currentBusiness || {};
    return String(S().businessType || biz.business_type || biz.type || '').toLowerCase();
  }
  function isPhotoTrade() {
    try {
      if (typeof global.isPhotoLedTrade === 'function' && global.isPhotoLedTrade()) return true;
    } catch (e) {}
    var id = tradeId();
    return id === 'photography' || id.indexOf('photo') >= 0 || id === 'weddings' || id === 'wedding' ||
      id.indexOf('video') >= 0;
  }
  function isDetailTrade() {
    var id = tradeId();
    return id.indexOf('detail') >= 0 || id.indexOf('ceramic') >= 0 || id === 'auto';
  }
  function isWindowTrade() {
    return tradeId().indexOf('window') >= 0;
  }
  function isPressureWashTrade() {
    var id = tradeId();
    return id.indexOf('pressure') >= 0 || id.indexOf('powerwash') >= 0 || id.indexOf('power wash') >= 0;
  }
  function hasLightroomCapability() {
    return hasCapability('lightroom') || isPhotoTrade();
  }
  /** Industry-adaptive workspace profile — same module, different tools. */
  function projectWorkspaceProfile() {
    if (isPhotoTrade()) {
      return {
        industry: 'photography',
        eyebrow: 'Media',
        title: 'Media',
        subtitle: 'Hubly’s visual asset manager — upload, organize, deliver. Lightroom and Canva are optional.',
        dateLabel: 'Shoot',
        projectTypes: PROJECT_TYPES.slice(),
        defaultType: 'Wedding',
        emptyHint: 'Create a job album — upload photos here. Connect Adobe Lightroom anytime for pro editing.',
        teamFilterLabel: 'Photographers',
        quickPlaceholder: 'Johnson Wedding',
        quickHint: 'Name it, add media, done — about 30 seconds.',
        mediaLabel: 'Photos',
        deliverables: [
          { id: 'd_gallery', title: 'Gallery', kind: 'gallery', status: 'pending' },
          { id: 'd_album', title: 'Album', kind: 'album', status: 'pending' },
          { id: 'd_prints', title: 'Prints', kind: 'prints', status: 'pending' },
          { id: 'd_invoice', title: 'Invoice', kind: 'invoice', status: 'pending' }
        ],
        afterConnect: [
          'Create Lightroom Album', 'Upload RAW Photos', 'Sync Edited Images',
          'Deliver Galleries', 'Create Canva graphics', 'Publish Website', 'Request Reviews'
        ],
        features: { galleries: true, lightroom: true, beforeAfter: false, propertyAlbums: false, jobDocs: false }
      };
    }
    if (isDetailTrade()) {
      return {
        industry: 'detailing',
        eyebrow: 'Media',
        title: 'Media',
        subtitle: 'Hubly’s visual asset manager — upload, organize, deliver. Lightroom and Canva are optional.',
        dateLabel: 'Job',
        projectTypes: ['Ceramic Coating', 'Full Detail', 'Paint Correction', 'Interior', 'Fleet', 'Other'],
        defaultType: 'Ceramic Coating',
        emptyHint: 'Create a project for a job — upload before/after media and deliver marketing assets.',
        teamFilterLabel: 'Technicians',
        quickPlaceholder: 'Johnson Ceramic Coating',
        quickHint: 'Name it, add media, done — about 30 seconds.',
        mediaLabel: 'Photos',
        deliverables: [
          { id: 'd_gallery', title: 'Gallery', kind: 'gallery', status: 'pending' },
          { id: 'd_ba', title: 'Before / After', kind: 'before_after', status: 'pending' },
          { id: 'd_mkt', title: 'Marketing', kind: 'marketing', status: 'pending' },
          { id: 'd_social', title: 'Social', kind: 'social', status: 'pending' },
          { id: 'd_invoice', title: 'Invoice', kind: 'invoice', status: 'pending' }
        ],
        afterConnect: [
          'Upload before & after photos', 'Generate Before / After graphics in Canva',
          'Publish to social', 'Update Google Business', 'Request Reviews'
        ],
        features: { galleries: true, lightroom: false, beforeAfter: true, propertyAlbums: false, jobDocs: true }
      };
    }
    if (isWindowTrade()) {
      return {
        industry: 'windows',
        eyebrow: 'Media',
        title: 'Media',
        subtitle: 'Hubly’s visual asset manager — upload, organize, deliver. Lightroom and Canva are optional.',
        dateLabel: 'Job',
        projectTypes: ['Residential', 'Commercial', 'New Construction', 'Other'],
        defaultType: 'Residential',
        emptyHint: 'Create a property project — document the job and share albums with the client.',
        teamFilterLabel: 'Crew',
        quickPlaceholder: '123 Oak St Windows',
        quickHint: 'Name it, add media, done — about 30 seconds.',
        mediaLabel: 'Photos',
        deliverables: [
          { id: 'd_album', title: 'Property Album', kind: 'gallery', status: 'pending' },
          { id: 'd_docs', title: 'Job Documentation', kind: 'docs', status: 'pending' },
          { id: 'd_invoice', title: 'Invoice', kind: 'invoice', status: 'pending' }
        ],
        afterConnect: [
          'Upload property photos', 'Build property album', 'Share with client', 'Create Canva graphics'
        ],
        features: { galleries: true, lightroom: false, beforeAfter: true, propertyAlbums: true, jobDocs: true }
      };
    }
    if (isPressureWashTrade()) {
      return {
        industry: 'pressure_wash',
        eyebrow: 'Media',
        title: 'Media',
        subtitle: 'Hubly’s visual asset manager — upload, organize, deliver. Lightroom and Canva are optional.',
        dateLabel: 'Job',
        projectTypes: ['Driveway', 'House Wash', 'Roof', 'Commercial Lot', 'Other'],
        defaultType: 'House Wash',
        emptyHint: 'Create a project to document the job — before/after and client delivery.',
        teamFilterLabel: 'Crew',
        quickPlaceholder: 'Smith House Wash',
        quickHint: 'Name it, add media, done — about 30 seconds.',
        mediaLabel: 'Photos',
        deliverables: [
          { id: 'd_docs', title: 'Job Documentation', kind: 'docs', status: 'pending' },
          { id: 'd_ba', title: 'Before / After', kind: 'before_after', status: 'pending' },
          { id: 'd_gallery', title: 'Gallery', kind: 'gallery', status: 'pending' },
          { id: 'd_invoice', title: 'Invoice', kind: 'invoice', status: 'pending' }
        ],
        afterConnect: [
          'Upload job photos', 'Build before/after set', 'Share documentation', 'Request Reviews'
        ],
        features: { galleries: true, lightroom: false, beforeAfter: true, propertyAlbums: false, jobDocs: true }
      };
    }
    return {
      industry: 'home_service',
      eyebrow: 'Media',
      title: 'Media',
      subtitle: 'Hubly’s visual asset manager — upload, organize, deliver. Lightroom and Canva are optional.',
      dateLabel: 'Job',
      projectTypes: ['Residential', 'Commercial', 'Maintenance', 'Other'],
      defaultType: 'Residential',
      emptyHint: 'Create a project — connect Canva, Drive, and more as you go.',
      teamFilterLabel: 'Team',
      quickPlaceholder: 'Johnson Job',
      quickHint: 'Name it, add media, done — about 30 seconds.',
      mediaLabel: 'Media',
      deliverables: [
        { id: 'd_gallery', title: 'Gallery', kind: 'gallery', status: 'pending' },
        { id: 'd_mkt', title: 'Marketing', kind: 'marketing', status: 'pending' },
        { id: 'd_social', title: 'Social', kind: 'social', status: 'pending' },
        { id: 'd_invoice', title: 'Invoice', kind: 'invoice', status: 'pending' }
      ],
      afterConnect: [
        'Upload job photos', 'Create Canva graphics', 'Share with client', 'Request Reviews'
      ],
      features: { galleries: true, lightroom: false, beforeAfter: true, propertyAlbums: false, jobDocs: true }
    };
  }
  function createAssetsForProfile() {
    var profile = projectWorkspaceProfile();
    var assets = CREATE_ASSETS.filter(function (a) {
      if (a.id === 'lightroom') return hasLightroomCapability() || profile.features.lightroom;
      if (a.id === 'shot_list') return isPhotoTrade();
      return true;
    });
    return assets;
  }
  function visibleConnectedProviders() {
    return WORKSPACE_PROVIDERS.filter(function (prov) {
      if (prov.id === 'adobe_lightroom') return hasLightroomCapability();
      if (prov.id === 'canva') return true;
      if (prov.id === 'frame_io') return isPhotoTrade();
      return true;
    });
  }

  /* ─── UI prefs only (localStorage) ──────────────────────────────────── */

  function prefsKey() {
    return 'hubly_pp_ui_prefs_' + (businessId() || 'anon');
  }
  function loadPrefs() {
    try {
      var raw = localStorage.getItem(prefsKey());
      if (raw) {
        var p = JSON.parse(raw);
        if (p && typeof p === 'object') return p;
      }
    } catch (e) {}
    return {};
  }
  function savePrefs(partial) {
    var next = Object.assign(loadPrefs(), partial || {});
    try { localStorage.setItem(prefsKey(), JSON.stringify(next)); } catch (e) {}
    return next;
  }

  /* ─── Workspace helpers (nested state in Supabase row) ──────────────── */

  function defaultWorkspace(partial) {
    return Object.assign({
      team: { lead: '', second: '', assistant: '', editor: '' },
      timeline: timelineDefaults(),
      gallery: {
        ai_favorites: [],
        albums: [{ name: 'All Media', count: 0 }, { name: 'Selects', count: 0 }],
        client_gallery: true,
        private_gallery: true,
        downloads: false,
        watermark: { enabled: true, text: '' },
        delivery_status: 'draft',
        expires_at: null
      },
      lightroom: {
        adobe_account_email: null,
        album_name: null,
        album_id: null,
        catalog_id: null,
        photo_count: 0,
        edited_count: 0,
        favorites: 0,
        connection_status: 'not_connected',
        last_sync_at: null,
        sync_activity: [],
        upload_queue: [],
        import_queue: [],
        export_queue: [],
        post_edit_pipeline: []
      },
      contracts: [],
      invoices: [],
      questionnaire: { status: 'draft', title: 'Client Questionnaire', answers: {} },
      deliverables: (function () {
        try { return projectWorkspaceProfile().deliverables.slice(); }
        catch (e) {
          return [
            { id: 'd_gallery', title: 'Gallery', kind: 'gallery', status: 'pending' },
            { id: 'd_mkt', title: 'Marketing', kind: 'marketing', status: 'pending' }
          ];
        }
      })(),
      marketing: MARKETING_CHANNELS.map(function (c) {
        return Object.assign({}, c, { status: 'idle', body: '' });
      }),
      activity: [],
      shot_list: [],
      local_uploads: [],
      workspaces: []
    }, partial || {});
  }

  function timelineDefaults() {
    var src = isPhotoTrade() ? TIMELINE_DEFAULTS_PHOTO : TIMELINE_DEFAULTS_JOB;
    return src.map(function (t, i) {
      return Object.assign({}, t, {
        id: 'tl_' + i,
        completed: false,
        occurred_at: null,
        notes: '',
        sort_order: i
      });
    });
  }

  function getWorkspace(p, provider) {
    var list = (p && p.workspaces) || [];
    return list.find(function (w) { return w.provider === provider; }) || null;
  }

  function upsertWorkspaceLocal(p, patch) {
    p.workspaces = p.workspaces || [];
    var i = p.workspaces.findIndex(function (w) { return w.provider === patch.provider; });
    var next = Object.assign(
      i >= 0 ? p.workspaces[i] : { id: workspaceId(), provider: patch.provider, sync_state: 'pending' },
      patch
    );
    if (i >= 0) p.workspaces[i] = next;
    else p.workspaces.push(next);
    p.workspace = p.workspace || defaultWorkspace();
    p.workspace.workspaces = p.workspaces;
    return next;
  }

  function rowToProject(row) {
    if (!row) return null;
    var ws = defaultWorkspace(row.workspace || {});
    return {
      id: row.id,
      business_id: row.business_id,
      name: row.name,
      project_type: row.project_type,
      status: row.status,
      shoot_date: row.shoot_date,
      location: row.location || '',
      estimated_photos: row.estimated_photos,
      photo_count: row.photo_count || 0,
      notes: row.notes || '',
      cover_photo_url: row.cover_photo_url,
      client_name: row.client_name || '',
      client_email: row.client_email || '',
      client_phone: row.client_phone || '',
      client_address: row.client_address || '',
      client_relationship: row.client_relationship || '',
      revenue_cents: row.revenue_cents || 0,
      outstanding_cents: row.outstanding_cents || 0,
      editing_progress: row.editing_progress || 0,
      lightroom_status: row.lightroom_status || 'not_connected',
      gallery_status: row.gallery_status || 'draft',
      invoice_status: row.invoice_status || 'none',
      last_sync_at: row.last_sync_at,
      workspaces: Array.isArray(ws.workspaces) ? ws.workspaces : [],
      workspace: ws,
      team: ws.team,
      timeline: ws.timeline,
      gallery: ws.gallery,
      lightroom: ws.lightroom,
      contracts: ws.contracts,
      invoices: ws.invoices,
      questionnaire: ws.questionnaire,
      deliverables: ws.deliverables,
      marketing: ws.marketing,
      activity: ws.activity,
      shot_list: ws.shot_list,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  function projectToRow(p) {
    var ws = Object.assign(defaultWorkspace(), p.workspace || {}, {
      team: p.team || (p.workspace && p.workspace.team),
      timeline: p.timeline || (p.workspace && p.workspace.timeline),
      gallery: p.gallery || (p.workspace && p.workspace.gallery),
      lightroom: p.lightroom || (p.workspace && p.workspace.lightroom),
      contracts: p.contracts || (p.workspace && p.workspace.contracts) || [],
      invoices: p.invoices || (p.workspace && p.workspace.invoices) || [],
      questionnaire: p.questionnaire || (p.workspace && p.workspace.questionnaire),
      deliverables: p.deliverables || (p.workspace && p.workspace.deliverables),
      marketing: p.marketing || (p.workspace && p.workspace.marketing),
      activity: p.activity || (p.workspace && p.workspace.activity) || [],
      shot_list: p.shot_list || (p.workspace && p.workspace.shot_list) || [],
      local_uploads: (p.workspace && p.workspace.local_uploads) || [],
      workspaces: p.workspaces || (p.workspace && p.workspace.workspaces) || []
    });
    return {
      name: p.name,
      project_type: p.project_type || 'Other',
      status: p.status || 'Lead',
      shoot_date: p.shoot_date || null,
      location: p.location || null,
      estimated_photos: p.estimated_photos != null ? Number(p.estimated_photos) : null,
      photo_count: Number(p.photo_count) || 0,
      notes: p.notes || null,
      cover_photo_url: p.cover_photo_url || null,
      client_name: p.client_name || null,
      client_email: p.client_email || null,
      client_phone: p.client_phone || null,
      client_address: p.client_address || null,
      client_relationship: p.client_relationship || null,
      revenue_cents: Number(p.revenue_cents) || 0,
      outstanding_cents: Number(p.outstanding_cents) || 0,
      editing_progress: Number(p.editing_progress) || 0,
      lightroom_status: p.lightroom_status || 'not_connected',
      gallery_status: p.gallery_status || 'draft',
      invoice_status: p.invoice_status || 'none',
      last_sync_at: p.last_sync_at || null,
      workspace: ws
    };
  }

  function addActivity(p, action, detail) {
    p.activity = p.activity || [];
    p.activity.push({
      id: 'act_' + Date.now().toString(36),
      action: action,
      detail: detail || '',
      created_at: new Date().toISOString()
    });
    p.workspace = p.workspace || defaultWorkspace();
    p.workspace.activity = p.activity;
  }

  /* ─── Supabase SSOT ─────────────────────────────────────────────────── */

  async function loadProjectsFromSupabase(force) {
    var bid = businessId();
    if (!bid) {
      _cache = { businessId: null, projects: [], loaded: true, loading: null };
      return [];
    }
    if (!force && _cache.loaded && _cache.businessId === bid) return _cache.projects;
    if (_cache.loading && _cache.businessId === bid) return _cache.loading;

    _cache.businessId = bid;
    _cache.loading = (async function () {
      var db = await dbClient();
      if (!db) throw new Error('Hubly could not reach the database.');
      var res = await db.from('photography_projects')
        .select('*')
        .eq('business_id', bid)
        .order('updated_at', { ascending: false });
      if (res.error) throw res.error;
      var list = (res.data || []).map(rowToProject);
      var ids = list.map(function (p) { return p.id; });
      if (ids.length) {
        var wsRes = await db.from('photography_project_workspaces')
          .select('*')
          .in('project_id', ids);
        if (!wsRes.error && wsRes.data) {
          var byProject = {};
          (wsRes.data || []).forEach(function (w) {
            byProject[w.project_id] = byProject[w.project_id] || [];
            byProject[w.project_id].push({
              id: w.id,
              provider: w.provider,
              external_id: w.external_id,
              display_name: w.display_name,
              sync_state: w.sync_state,
              last_sync_at: w.last_sync_at,
              metadata: w.metadata || {}
            });
          });
          list.forEach(function (p) {
            p.workspaces = byProject[p.id] || p.workspaces || [];
            p.workspace = p.workspace || defaultWorkspace();
            p.workspace.workspaces = p.workspaces;
            var lrWs = getWorkspace(p, 'adobe_lightroom');
            if (lrWs) {
              p.lightroom_status = mapSyncToLightroomStatus(lrWs.sync_state);
              p.last_sync_at = lrWs.last_sync_at || p.last_sync_at;
              p.lightroom = Object.assign({}, p.lightroom || {}, {
                album_name: lrWs.display_name || (lrWs.metadata && lrWs.metadata.album_name),
                album_id: lrWs.external_id,
                catalog_id: lrWs.metadata && lrWs.metadata.catalog_id,
                adobe_account_email: lrWs.metadata && lrWs.metadata.adobe_account_email,
                connection_status: lrWs.sync_state === 'linked' || lrWs.sync_state === 'synced' ? 'connected' : 'not_connected',
                last_sync_at: lrWs.last_sync_at,
                photo_count: (lrWs.metadata && lrWs.metadata.photo_count) || 0,
                edited_count: (lrWs.metadata && lrWs.metadata.edited_count) || 0,
                favorites: (lrWs.metadata && lrWs.metadata.favorites_count) || 0,
                sync_activity: (lrWs.metadata && lrWs.metadata.sync_activity) || [],
                upload_queue: (lrWs.metadata && lrWs.metadata.upload_queue) || [],
                import_queue: (lrWs.metadata && lrWs.metadata.import_queue) || [],
                export_queue: (lrWs.metadata && lrWs.metadata.export_queue) || []
              });
            }
          });
        }
      }
      _cache.projects = list;
      _cache.loaded = true;
      _cache.loading = null;
      return list;
    })();

    try {
      return await _cache.loading;
    } catch (err) {
      _cache.loading = null;
      _cache.loaded = false;
      console.warn('Projects load failed', err);
      throw err;
    }
  }

  function mapSyncToLightroomStatus(state) {
    return ({
      unlinked: 'not_connected',
      pending: 'album_ready',
      linked: 'connected',
      syncing: 'syncing',
      synced: 'synced',
      error: 'error'
    })[state] || 'not_connected';
  }

  async function insertProject(p) {
    var bid = businessId();
    if (!bid) {
      throw new Error('Couldn\u2019t find your business yet — refresh the page, then try again.');
    }
    var db = await dbClient();
    if (!db) throw new Error('Hubly could not reach the database.');
    var row = projectToRow(p);
    row.business_id = bid;
    var res = await db.from('photography_projects').insert(row).select('*').single();
    if (res.error) throw res.error;
    var created = rowToProject(res.data);
    created.workspaces = p.workspaces || [];
    // Lightroom link is optional — only seed when the business has Lightroom.
    if (hasLightroomCapability()) {
      upsertWorkspaceLocal(created, {
        provider: 'adobe_lightroom',
        display_name: created.name,
        sync_state: 'pending',
        metadata: { album_name: created.name }
      });
      await upsertExternalWorkspace(db, created, getWorkspace(created, 'adobe_lightroom'));
    }
    await insertActivityRow(db, created, 'Project created', created.name);
    _cache.projects = [created].concat(_cache.projects.filter(function (x) { return x.id !== created.id; }));
    _cache.loaded = true;
    _cache.businessId = bid;
    return created;
  }

  async function updateProject(p) {
    var bid = businessId();
    if (!bid || !p.id) throw new Error('Project save failed — missing business or id.');
    var db = await dbClient();
    if (!db) throw new Error('Hubly could not reach the database.');
    var row = projectToRow(p);
    var res = await db.from('photography_projects')
      .update(row)
      .eq('id', p.id)
      .eq('business_id', bid)
      .select('*')
      .single();
    if (res.error) throw res.error;
    var updated = rowToProject(res.data);
    updated.workspaces = p.workspaces || [];
    var lr = getWorkspace(updated, 'adobe_lightroom');
    if (lr) await upsertExternalWorkspace(db, updated, lr);
    (updated.workspaces || []).forEach(function (w) {
      if (w.provider !== 'adobe_lightroom') {
        upsertExternalWorkspace(db, updated, w).catch(function () {});
      }
    });
    _cache.projects = _cache.projects.map(function (x) {
      return x.id === updated.id ? updated : x;
    });
    return updated;
  }

  async function persistProject(p) {
    if (p.id && !String(p.id).startsWith('pp_') && !String(p.id).startsWith('ws_')) return updateProject(p);
    // UUIDs from Supabase don't start with pp_
    if (p.id && /^[0-9a-f-]{36}$/i.test(String(p.id))) return updateProject(p);
    return insertProject(p);
  }

  async function upsertExternalWorkspace(db, p, ws) {
    if (!ws || !ws.provider) return null;
    try {
      var payload = {
        project_id: p.id,
        business_id: p.business_id || businessId(),
        provider: ws.provider,
        external_id: ws.external_id || null,
        display_name: ws.display_name || p.name,
        sync_state: ws.sync_state || 'pending',
        last_sync_at: ws.last_sync_at || null,
        metadata: Object.assign({}, ws.metadata || {}, {
          album_name: (p.lightroom && p.lightroom.album_name) || ws.display_name || p.name,
          connection_status: p.lightroom_status || 'not_connected'
        })
      };
      var res = await db.from('photography_project_workspaces')
        .upsert(payload, { onConflict: 'project_id,provider' })
        .select('*')
        .maybeSingle();
      if (res.error) throw res.error;
      if (res.data) {
        upsertWorkspaceLocal(p, {
          id: res.data.id,
          provider: res.data.provider,
          external_id: res.data.external_id,
          display_name: res.data.display_name,
          sync_state: res.data.sync_state,
          last_sync_at: res.data.last_sync_at,
          metadata: res.data.metadata || {}
        });
      }
      return res.data;
    } catch (e) {
      console.warn('External workspace upsert', e);
      return null;
    }
  }

  async function insertActivityRow(db, p, action, detail) {
    try {
      await db.from('photography_project_activity').insert({
        project_id: p.id,
        business_id: p.business_id || businessId(),
        action: action,
        detail: detail || null
      });
    } catch (e) {}
  }

  function findProject(id) {
    return _cache.projects.find(function (p) { return p.id === id; }) || null;
  }

  /* ─── View state ────────────────────────────────────────────────────── */

  function ownRoot() {
    var view = el('v-photo-projects');
    var root = el('jos-photo-projects-root');
    if (!view || !root) return null;
    view.classList.add('jos-pixel-owned');
    return root;
  }
  function setPhotoProjectsMode(on) {
    var app = el('p-app');
    if (!app) return;
    if (on) {
      app.classList.add('jos-pixel');
      try { document.body.classList.add('jos-pixel'); } catch (e) {}
    }
    app.classList.toggle('jos-photo-projects-mode', !!on);
    try {
      if (typeof global.renderHublyCoach === 'function') global.renderHublyCoach();
    } catch (e2) {}
    try {
      var fab = el('jos-ask-fab');
      if (fab) fab.classList.toggle('hidden', !!on);
    } catch (e3) {}
  }
  function getState(root) {
    var prefs = loadPrefs();
    root._pp = root._pp || {
      view: 'dashboard',
      projectId: null,
      tab: prefs.lastTab || 'overview',
      lrPanel: prefs.lrPanel || 'overview',
      wizardStep: 1,
      wizard: null,
      search: prefs.search || '',
      statusFilter: prefs.statusFilter || 'all',
      dateFilter: prefs.dateFilter || 'all',
      photographerFilter: prefs.photographerFilter || 'all',
      sort: prefs.sort || 'shoot_date_desc',
      quickOpen: false,
      quick: { name: '', files: [] },
      error: null
    };
    return root._pp;
  }
  function persistUiPrefs(st) {
    savePrefs({
      search: st.search,
      statusFilter: st.statusFilter,
      dateFilter: st.dateFilter,
      photographerFilter: st.photographerFilter,
      sort: st.sort,
      lastTab: st.tab,
      lrPanel: st.lrPanel
    });
  }

  function projectsFiltered(list, st) {
    var out = list.slice();
    var q = String(st.search || '').trim().toLowerCase();
    if (q) {
      out = out.filter(function (p) {
        return [p.name, p.client_name, p.project_type, p.location, p.status]
          .join(' ').toLowerCase().indexOf(q) !== -1;
      });
    }
    if (st.statusFilter && st.statusFilter !== 'all') {
      out = out.filter(function (p) { return p.status === st.statusFilter; });
    }
    if (st.dateFilter === 'upcoming') {
      out = out.filter(function (p) { return daysUntil(p.shoot_date) != null && daysUntil(p.shoot_date) >= 0; });
    } else if (st.dateFilter === 'past') {
      out = out.filter(function (p) { return daysUntil(p.shoot_date) != null && daysUntil(p.shoot_date) < 0; });
    } else if (st.dateFilter === 'this_month') {
      var ym = todayISO().slice(0, 7);
      out = out.filter(function (p) { return String(p.shoot_date || '').slice(0, 7) === ym; });
    }
    if (st.photographerFilter && st.photographerFilter !== 'all') {
      out = out.filter(function (p) { return (p.team && p.team.lead) === st.photographerFilter; });
    }
    var sort = st.sort || 'shoot_date_desc';
    out.sort(function (a, b) {
      if (sort === 'name') return String(a.name).localeCompare(String(b.name));
      if (sort === 'status') return String(a.status).localeCompare(String(b.status));
      if (sort === 'updated') return String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
      var ad = a.shoot_date || '';
      var bd = b.shoot_date || '';
      return sort === 'shoot_date_asc' ? ad.localeCompare(bd) : bd.localeCompare(ad);
    });
    return out;
  }

  function photographers(list) {
    var set = {};
    list.forEach(function (p) { if (p.team && p.team.lead) set[p.team.lead] = true; });
    return Object.keys(set).sort();
  }

  function metrics(list) {
    var active = list.filter(function (p) { return p.status !== 'Archived'; });
    return {
      projects: active.length,
      editing: active.filter(function (p) { return p.status === 'Editing' || p.status === 'Proofing'; }).length,
      awaiting: active.filter(function (p) {
        return p.status === 'Proofing' || p.gallery_status === 'published' || p.gallery_status === 'private';
      }).filter(function (p) { return p.status !== 'Delivered'; }).length,
      revenue: active.reduce(function (s, p) { return s + (Number(p.revenue_cents) || 0); }, 0),
      images: active.reduce(function (s, p) { return s + (Number(p.photo_count) || 0); }, 0)
    };
  }

  /* ─── Labels / cover ────────────────────────────────────────────────── */

  function coverStyle(p) {
    if (p.cover_photo_url) return 'background-image:url(' + JSON.stringify(String(p.cover_photo_url)) + ')';
    var hues = {
      Wedding: 'linear-gradient(135deg,#1a1a1a 0%,#4a3f35 45%,#c4a484 100%)',
      Portrait: 'linear-gradient(135deg,#0f172a 0%,#334155 50%,#94a3b8 100%)',
      Family: 'linear-gradient(135deg,#1c1917 0%,#44403c 50%,#a8a29e 100%)',
      Sports: 'linear-gradient(135deg,#111827 0%,#1e3a5f 50%,#38bdf8 100%)',
      Commercial: 'linear-gradient(135deg,#18181b 0%,#3f3f46 55%,#D9632D 100%)',
      Product: 'linear-gradient(135deg,#0c0a09 0%,#292524 50%,#e7e5e4 100%)',
      'Real Estate': 'linear-gradient(135deg,#14532d 0%,#166534 40%,#bbf7d0 100%)',
      Graduation: 'linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#c4b5fd 100%)',
      Event: 'linear-gradient(135deg,#431407 0%,#9a3412 45%,#fdba74 100%)',
      Other: 'linear-gradient(135deg,#141B2B 0%,#2a3348 55%,#D9632D 100%)'
    };
    return 'background-image:' + (hues[p.project_type] || hues.Other);
  }
  function lrLabel(s) {
    return ({
      not_connected: 'Lightroom · Off',
      connected: 'Lightroom · On',
      album_ready: 'Lightroom · Album',
      syncing: 'Lightroom · Syncing',
      synced: 'Lightroom · Synced',
      error: 'Lightroom · Error'
    })[s] || 'Lightroom';
  }
  function galLabel(s) {
    return ({ draft: 'Gallery · Draft', private: 'Gallery · Private', published: 'Gallery · Live', delivered: 'Gallery · Delivered', expired: 'Gallery · Expired' })[s] || 'Gallery';
  }
  function invLabel(s) {
    return ({ none: 'Invoice · —', draft: 'Invoice · Draft', sent: 'Invoice · Sent', partial: 'Invoice · Partial', paid: 'Invoice · Paid', overdue: 'Invoice · Overdue' })[s] || 'Invoice';
  }

  /* ─── Dashboard ─────────────────────────────────────────────────────── */

  function renderDashboard(root, list, st) {
    var profile = projectWorkspaceProfile();
    var filtered = projectsFiltered(list, st);
    var photogs = photographers(list);
    var m = metrics(list);

    var cards = filtered.map(function (p) {
      return '<article class="pp-card" data-pp-act="open" data-pp-id="' + esc(p.id) + '">' +
        '<div class="pp-card-cover" style="' + coverStyle(p) + '">' +
          '<span class="pp-status pp-status-' + statusTone(p.status) + '">' + esc(p.status) + '</span>' +
        '</div>' +
        '<div class="pp-card-body">' +
          '<h3 class="pp-card-title">' + esc(p.name) + '</h3>' +
          '<div class="pp-card-meta"><span>' + esc(p.client_name || 'No client') + '</span><span class="pp-dot"></span><span>' + esc(p.project_type) + '</span></div>' +
          '<div class="pp-card-row"><span class="pp-label">' + esc(projectWorkspaceProfile().dateLabel) + '</span><strong>' + esc(formatDate(p.shoot_date)) + '</strong></div>' +
          '<div class="pp-card-pills">' +
            (hasLightroomCapability() ? '<span class="pp-pill">' + esc(lrLabel(p.lightroom_status)) + '</span>' : '') +
            '<span class="pp-pill">' + esc(galLabel(p.gallery_status)) + '</span>' +
            '<span class="pp-pill">' + esc(invLabel(p.invoice_status)) + '</span>' +
          '</div>' +
          '<div class="pp-card-stats">' +
            '<div><span class="pp-label">Assets</span><strong>' + esc(String(p.photo_count || 0)) + '</strong></div>' +
            '<div><span class="pp-label">Last sync</span><strong>' + esc(formatRelative(p.last_sync_at)) + '</strong></div>' +
          '</div>' +
          '<div class="pp-card-actions" onclick="event.stopPropagation()">' +
            '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="open" data-pp-id="' + esc(p.id) + '">Open</button>' +
            '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="gallery" data-pp-id="' + esc(p.id) + '">Gallery</button>' +
            '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="invoice" data-pp-id="' + esc(p.id) + '">Invoice</button>' +
            '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="deliver" data-pp-id="' + esc(p.id) + '">Deliver</button>' +
            (hasLightroomCapability() && getWorkspace(p, 'adobe_lightroom') &&
              (getWorkspace(p, 'adobe_lightroom').sync_state === 'linked' || getWorkspace(p, 'adobe_lightroom').sync_state === 'synced')
              ? '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="sync" data-pp-id="' + esc(p.id) + '">Sync Lightroom</button>'
              : '') +
          '</div></div></article>';
    }).join('');

    return '<div class="pp-shell pp-dash">' +
      '<header class="pp-dash-head pp-dash-head--actions">' +
        '<div class="pp-dash-actions">' +
          '<button type="button" class="pp-btn pp-btn-ghost pp-btn-lg" data-pp-act="quick">Quick add</button>' +
          '<button type="button" class="pp-btn pp-btn-brand pp-btn-lg" data-pp-act="new">+ New job</button>' +
        '</div></header>' +
      '<div class="pp-metrics">' +
        metric('Jobs', String(m.projects)) +
        metric('In progress', String(m.editing)) +
        metric('Awaiting Delivery', String(m.awaiting)) +
        metric('Revenue', money(m.revenue)) +
        metric('Assets', Number(m.images).toLocaleString()) +
      '</div>' +
      '<div class="pp-toolbar">' +
        '<label class="pp-search"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
          '<input type="search" placeholder="Search media, clients…" value="' + esc(st.search) + '" data-pp-field="search"></label>' +
        '<select data-pp-field="statusFilter" aria-label="Status"><option value="all">All statuses</option>' +
          STATUSES.map(function (s) { return '<option value="' + esc(s) + '"' + (st.statusFilter === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') +
        '</select>' +
        '<select data-pp-field="dateFilter" aria-label="Date">' +
          '<option value="all"' + (st.dateFilter === 'all' ? ' selected' : '') + '>Any date</option>' +
          '<option value="upcoming"' + (st.dateFilter === 'upcoming' ? ' selected' : '') + '>Upcoming</option>' +
          '<option value="this_month"' + (st.dateFilter === 'this_month' ? ' selected' : '') + '>This month</option>' +
          '<option value="past"' + (st.dateFilter === 'past' ? ' selected' : '') + '>Past</option></select>' +
        '<select data-pp-field="photographerFilter" aria-label="Team"><option value="all">All ' + esc(profile.teamFilterLabel.toLowerCase()) + '</option>' +
          photogs.map(function (n) { return '<option value="' + esc(n) + '"' + (st.photographerFilter === n ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') +
        '</select>' +
        '<select data-pp-field="sort" aria-label="Sort">' +
          '<option value="shoot_date_desc"' + (st.sort === 'shoot_date_desc' ? ' selected' : '') + '>' + esc(profile.dateLabel) + ' date ↓</option>' +
          '<option value="shoot_date_asc"' + (st.sort === 'shoot_date_asc' ? ' selected' : '') + '>' + esc(profile.dateLabel) + ' date ↑</option>' +
          '<option value="name"' + (st.sort === 'name' ? ' selected' : '') + '>Name</option>' +
          '<option value="status"' + (st.sort === 'status' ? ' selected' : '') + '>Status</option>' +
          '<option value="updated"' + (st.sort === 'updated' ? ' selected' : '') + '>Recently updated</option></select>' +
      '</div>' +
      (st.error ? '<div class="pp-banner-error">' + esc(st.error) + '</div>' : '') +
      (filtered.length
        ? '<div class="pp-grid">' + cards + '</div>'
        : '<div class="pp-empty"><div class="pp-empty-art" aria-hidden="true"></div>' +
          '<h2>No projects yet</h2>' +
          '<p>' + esc(profile.emptyHint) + '</p>' +
          '<div class="pp-btn-row" style="justify-content:center">' +
          '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="quick">Quick add</button>' +
          '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="new">+ New job</button></div></div>') +
      (st.quickOpen ? renderQuickModal(st) : '') +
      '</div>';
  }

  function metric(label, value) {
    return '<div class="pp-metric"><span class="pp-metric-label">' + esc(label) + '</span><strong class="pp-metric-value">' + esc(value) + '</strong></div>';
  }

  function renderQuickModal(st) {
    var q = st.quick || { name: '', files: [] };
    var profile = projectWorkspaceProfile();
    return '<div class="pp-modal-bg" data-pp-act="quick-close">' +
      '<div class="pp-modal" onclick="event.stopPropagation()">' +
        '<div class="pp-modal-h"><h2>Quick add</h2><button type="button" class="pp-icon-x" data-pp-act="quick-close" aria-label="Close">×</button></div>' +
        '<p class="pp-muted">' + esc(profile.quickHint || 'Name it, add media, done — about 30 seconds.') + ' Saved to Hubly immediately.</p>' +
        '<label class="pp-field pp-field-full"><span>Project Name</span>' +
          '<input type="text" data-pp-quick="name" value="' + esc(q.name) + '" placeholder="' + esc(profile.quickPlaceholder || 'Project name') + '" autofocus></label>' +
        '<label class="pp-field pp-field-full"><span>Upload media</span>' +
          '<input type="file" accept="image/*,video/*" multiple data-pp-quick-files>' +
          '<small class="pp-muted">' + (q.files && q.files.length ? q.files.length + ' selected' : 'Optional — add later from the project') + '</small></label>' +
        '<div class="pp-wizard-foot">' +
          '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="quick-close">Cancel</button>' +
          '<button type="button" class="pp-btn pp-btn-brand pp-btn-lg" data-pp-act="quick-create">Done</button>' +
        '</div></div></div>';
  }

  /* ─── Wizard ────────────────────────────────────────────────────────── */

  function blankWizard() {
    var profile = projectWorkspaceProfile();
    var lrOn = hasLightroomCapability();
    return {
      name: '', project_type: profile.defaultType || 'Residential', shoot_date: '', location: '', estimated_photos: '', notes: '',
      client_mode: 'new', client_name: '', client_email: '', client_phone: '', client_address: '',
      client_relationship: '', existing_client: '',
      team: { lead: '', second: '', assistant: '', editor: '' },
      assets: {
        lightroom: lrOn, folder: true, contract: true, invoice: true,
        questionnaire: true, timeline: true, shot_list: isPhotoTrade(), gallery: true, marketing: true, canva: true
      }
    };
  }
  function field(label, control, full) {
    return '<label class="pp-field' + (full ? ' pp-field-full' : '') + '"><span>' + esc(label) + '</span>' + control + '</label>';
  }
  function renderWizard(root, list, st) {
    var w = st.wizard || blankWizard();
    st.wizard = w;
    var step = st.wizardStep || 1;
    var profile = projectWorkspaceProfile();
    var types = profile.projectTypes || PROJECT_TYPES;
    var clients = Array.from(new Set(list.map(function (p) { return p.client_name; }).filter(Boolean)));
    var body = '';
    if (step === 1) {
      body = '<div class="pp-form-grid">' +
        field('Project Name', '<input type="text" data-pp-w="name" value="' + esc(w.name) + '" placeholder="Johnson Ceramic Coating">') +
        field('Project Type', '<select data-pp-w="project_type">' + types.map(function (t) {
          return '<option' + (w.project_type === t ? ' selected' : '') + '>' + esc(t) + '</option>';
        }).join('') + '</select>') +
        field(profile.dateLabel + ' Date', '<input type="date" data-pp-w="shoot_date" value="' + esc(w.shoot_date) + '">') +
        field('Location', '<input type="text" data-pp-w="location" value="' + esc(w.location) + '">') +
        field('Notes', '<textarea data-pp-w="notes" rows="3">' + esc(w.notes) + '</textarea>', true) + '</div>';
    } else if (step === 2) {
      body = '<div class="pp-seg">' +
        '<button type="button" class="pp-seg-btn' + (w.client_mode === 'existing' ? ' on' : '') + '" data-pp-act="wiz-client-mode" data-pp-mode="existing">Existing Client</button>' +
        '<button type="button" class="pp-seg-btn' + (w.client_mode === 'new' ? ' on' : '') + '" data-pp-act="wiz-client-mode" data-pp-mode="new">Create New Client</button></div>';
      if (w.client_mode === 'existing') {
        body += '<div class="pp-form-grid">' + field('Client', '<select data-pp-w="existing_client"><option value="">Select…</option>' +
          clients.map(function (c) { return '<option value="' + esc(c) + '"' + (w.existing_client === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') +
          '</select>', true) + '</div>';
      } else {
        body += '<div class="pp-form-grid">' +
          field('Name', '<input type="text" data-pp-w="client_name" value="' + esc(w.client_name) + '">') +
          field('Email', '<input type="email" data-pp-w="client_email" value="' + esc(w.client_email) + '">') +
          field('Phone', '<input type="tel" data-pp-w="client_phone" value="' + esc(w.client_phone) + '">') +
          field('Address', '<input type="text" data-pp-w="client_address" value="' + esc(w.client_address) + '">') +
          field('Relationship', '<input type="text" data-pp-w="client_relationship" value="' + esc(w.client_relationship) + '">') + '</div>';
      }
    } else {
      body = '<div class="pp-form-grid">' +
        field('Lead', '<input type="text" data-pp-w="team.lead" value="' + esc(w.team.lead) + '">') +
        field('Second', '<input type="text" data-pp-w="team.second" value="' + esc(w.team.second) + '">') +
        field('Assistant', '<input type="text" data-pp-w="team.assistant" value="' + esc(w.team.assistant) + '">') +
        field('Editor / Creative', '<input type="text" data-pp-w="team.editor" value="' + esc(w.team.editor) + '">') + '</div>' +
        '<p class="pp-help pp-mt">Hubly prepares contracts, invoices, timeline, gallery, and marketing for this project automatically. Next you\u2019ll land on Media to drop photos.</p>';
    }
    return '<div class="pp-shell pp-wizard"><button type="button" class="pp-back" data-pp-act="wiz-cancel">← Media</button>' +
      '<div class="pp-wizard-card"><div class="pp-steps">' +
      [1, 2, 3].map(function (n) {
        var labels = ['Details', 'Client', 'Team'];
        return '<div class="pp-step' + (n === step ? ' on' : '') + (n < step ? ' done' : '') + '"><i>' + n + '</i><span>' + labels[n - 1] + '</span></div>';
      }).join('') + '</div>' +
      '<h2 class="pp-wizard-title">' + (['', 'Project Details', 'Client', 'Team'][step] || '') + '</h2>' + body +
      '<div class="pp-wizard-foot">' +
      (step > 1 ? '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="wiz-prev">Back</button>' : '<span></span>') +
      (step < 3
        ? '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="wiz-next">Continue</button>'
        : '<button type="button" class="pp-btn pp-btn-brand pp-btn-lg" data-pp-act="wiz-create">Create job</button>') +
      '</div></div></div>';
  }

  /* ─── Command Center ────────────────────────────────────────────────── */

  function kpi(label, value) {
    return '<div class="pp-kpi"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong></div>';
  }
  function renderCommand(root, st, p) {
    var tab = st.tab || 'media';
    // Media-first center of work. Lightroom is a first-class tab for photo-led businesses.
    var tabs = [
      ['overview', 'Overview'],
      ['media', 'Media'],
      ['client', 'Client'],
      ['deliverables', 'Deliverables'],
      ['creative', 'Creative']
    ];
    if (hasLightroomCapability()) tabs.splice(2, 0, ['lightroom', 'Lightroom']);
    tabs.push(['timeline', 'Timeline'], ['activity', 'Activity'], ['assistant', 'AI Assistant']);
    // Legacy tab ids still resolve in renderTab.
    if (tab === 'apps' || tab === 'gallery' || tab === 'contracts' ||
        tab === 'invoices' || tab === 'questionnaire' || tab === 'files' ||
        tab === 'marketing' || tab === 'notes') {
      if (tab === 'apps') tab = hasLightroomCapability() ? 'lightroom' : 'creative';
      else if (tab === 'gallery') tab = 'media';
      else if (tab === 'contracts' || tab === 'invoices' || tab === 'questionnaire' || tab === 'files') tab = 'deliverables';
      else if (tab === 'marketing' || tab === 'notes') tab = 'assistant';
      st.tab = tab;
    }
    return '<div class="pp-shell pp-cc"><button type="button" class="pp-back" data-pp-act="back-dash">← All media</button>' +
      '<header class="pp-hero" style="' + coverStyle(p) + '"><div class="pp-hero-veil"></div><div class="pp-hero-content">' +
      '<div class="pp-hero-top"><span class="pp-status pp-status-' + statusTone(p.status) + '">' + esc(p.status) + '</span>' +
      '<select class="pp-status-select" data-pp-act="set-status" data-pp-id="' + esc(p.id) + '">' +
      STATUSES.map(function (s) { return '<option value="' + esc(s) + '"' + (p.status === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') +
      '</select></div>' +
      '<p class="pp-eyebrow pp-hero-eyebrow">Media</p>' +
      '<h1 class="pp-hero-title">' + esc(p.name) + '</h1>' +
      '<p class="pp-hero-sub">' + esc(p.client_name || 'No client') + ' · ' + esc(p.project_type) + ' · ' + esc(formatDate(p.shoot_date)) + '</p>' +
      '<div class="pp-hero-kpis">' +
      kpi('Countdown', countdownLabel(p.shoot_date)) +
      kpi('Revenue', money(p.revenue_cents)) +
      kpi('Outstanding', money(p.outstanding_cents)) +
      kpi('Media', String(p.photo_count || ((p.local_uploads || []).length) || 0)) +
      kpi('Progress', (p.editing_progress || 0) + '%') +
      '</div></div></header>' +
      '<nav class="pp-tabs" role="tablist">' + tabs.map(function (t) {
        return '<button type="button" role="tab" class="pp-tab' + (tab === t[0] ? ' on' : '') + '" data-pp-act="tab" data-pp-tab="' + t[0] + '">' + esc(t[1]) + '</button>';
      }).join('') + '</nav>' +
      '<div class="pp-tab-body">' + renderTab(p, tab) + '</div></div>';
  }

  function renderTab(p, tab) {
    if (tab === 'timeline') return renderTimelineTab(p);
    if (tab === 'creative') return renderCreativeTab(p);
    if (tab === 'lightroom') return renderLightroomTab(p);
    if (tab === 'media' || tab === 'gallery') return renderMediaTab(p);
    if (tab === 'client') return renderClientTab(p);
    if (tab === 'files' || tab === 'contracts' || tab === 'invoices' || tab === 'questionnaire') return renderFilesTab(p);
    if (tab === 'deliverables') return renderDeliverablesTab(p);
    if (tab === 'activity') return renderActivityTab(p);
    if (tab === 'assistant' || tab === 'marketing' || tab === 'notes') return renderAiAssistantTab(p);
    if (tab === 'apps') return hasLightroomCapability() ? renderLightroomTab(p) : renderCreativeTab(p);
    return renderOverviewTab(p);
  }

  function workspaceSummary(p) {
    var linked = (p.workspaces || []).filter(function (w) {
      return w.sync_state === 'linked' || w.sync_state === 'synced' || w.sync_state === 'pending';
    });
    if (!linked.length) return '';
    if (linked.length === 1) {
      var lab = WORKSPACE_PROVIDERS.find(function (x) { return x.id === linked[0].provider; });
      return (lab ? lab.label : linked[0].provider);
    }
    return linked.length + ' apps';
  }

  function renderOverviewTab(p) {
    var profile = projectWorkspaceProfile();
    var uploads = (p.workspace && p.workspace.local_uploads) || p.local_uploads || [];
    var dels = (p.deliverables && p.deliverables.length) ? p.deliverables : profile.deliverables;
    return '<div class="pp-panel-grid">' +
      '<section class="pp-panel"><h3>Project</h3><dl class="pp-dl">' +
      '<div><dt>Location</dt><dd>' + esc(p.location || '—') + '</dd></div>' +
      '<div><dt>Type</dt><dd>' + esc(p.project_type) + '</dd></div>' +
      '<div><dt>Lead</dt><dd>' + esc((p.team && p.team.lead) || '—') + '</dd></div></dl>' +
      '<p class="pp-muted">' + esc(p.notes || 'No notes yet.') + '</p></section>' +
      '<section class="pp-panel"><h3>Client</h3><dl class="pp-dl">' +
      '<div><dt>Name</dt><dd>' + esc(p.client_name || '—') + '</dd></div>' +
      '<div><dt>Email</dt><dd>' + esc(p.client_email || '—') + '</dd></div>' +
      '<div><dt>Phone</dt><dd>' + esc(p.client_phone || '—') + '</dd></div></dl>' +
      '<button type="button" class="pp-btn pp-btn-ghost pp-btn-sm" data-pp-act="tab" data-pp-tab="client">Open client</button></section>' +
      '<section class="pp-panel"><h3>Media</h3><dl class="pp-dl">' +
      '<div><dt>Assets</dt><dd>' + esc(String(p.photo_count || uploads.length || 0)) + '</dd></div>' +
      '<div><dt>Last sync</dt><dd>' + esc(formatRelative(p.last_sync_at)) + '</dd></div></dl>' +
      '<button type="button" class="pp-btn pp-btn-brand pp-btn-sm" data-pp-act="tab" data-pp-tab="media">Add media</button></section>' +
      '<section class="pp-panel"><h3>Deliverables</h3><ul class="pp-queue">' +
      dels.map(function (d) {
        return '<li><strong>' + esc(d.title) + '</strong><span>' + esc(d.status || 'pending') + '</span></li>';
      }).join('') + '</ul></section>' +
      '<section class="pp-panel"><h3>Progress</h3><div class="pp-progress"><i style="width:' + (p.editing_progress || 0) + '%"></i></div>' +
      '<div class="pp-progress-meta"><span>' + (p.editing_progress || 0) + '% complete</span>' +
      '<input type="range" min="0" max="100" value="' + (p.editing_progress || 0) + '" data-pp-act="edit-progress" data-pp-id="' + esc(p.id) + '"></div></section>' +
      '<section class="pp-panel"><h3>Quick actions</h3><div class="pp-btn-row">' +
      '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="tab" data-pp-tab="media">Upload media</button>' +
      '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="tab" data-pp-tab="creative">Creative</button>' +
      '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="deliver" data-pp-id="' + esc(p.id) + '">Deliver</button></div></section></div>';
  }

  function renderClientTab(p) {
    return '<section class="pp-panel pp-panel-wide"><h3>Client</h3><dl class="pp-dl">' +
      '<div><dt>Name</dt><dd>' + esc(p.client_name || '—') + '</dd></div>' +
      '<div><dt>Email</dt><dd>' + esc(p.client_email || '—') + '</dd></div>' +
      '<div><dt>Phone</dt><dd>' + esc(p.client_phone || '—') + '</dd></div>' +
      '<div><dt>Location</dt><dd>' + esc(p.location || '—') + '</dd></div></dl>' +
      '<p class="pp-muted">' + esc(p.notes || 'Notes about this client appear here.') + '</p></section>';
  }

  function renderTimelineTab(p) {
    var rows = (p.timeline || []).map(function (t, i) {
      return '<label class="pp-tl-row"><input type="checkbox" data-pp-act="tl-toggle" data-pp-id="' + esc(p.id) + '" data-pp-tl="' + i + '"' + (t.completed ? ' checked' : '') + '>' +
        '<div class="pp-tl-main"><input class="pp-tl-label" type="text" value="' + esc(t.label) + '" data-pp-act="tl-label" data-pp-id="' + esc(p.id) + '" data-pp-tl="' + i + '">' +
        '<input class="pp-tl-date" type="datetime-local" value="' + esc(toLocalInput(t.occurred_at)) + '" data-pp-act="tl-date" data-pp-id="' + esc(p.id) + '" data-pp-tl="' + i + '"></div>' +
        '<input class="pp-tl-notes" type="text" placeholder="Notes" value="' + esc(t.notes || '') + '" data-pp-act="tl-notes" data-pp-id="' + esc(p.id) + '" data-pp-tl="' + i + '"></label>';
    }).join('');
    return '<section class="pp-panel pp-panel-wide"><h3>Timeline</h3><p class="pp-muted">Everything is editable.</p><div class="pp-tl">' + rows + '</div></section>';
  }
  function toLocalInput(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      var local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
      return local.toISOString().slice(0, 16);
    } catch (e) { return ''; }
  }

  function renderConnectedAppsTab(p) {
    var profile = projectWorkspaceProfile();
    var lr = p.lightroom || {};
    var lrWs = getWorkspace(p, 'adobe_lightroom');
    var adobeConnected = lrWs && (lrWs.sync_state === 'linked' || lrWs.sync_state === 'synced');
    var showLr = hasLightroomCapability();
    var providersList = visibleConnectedProviders();

    var hero = '<section class="pp-lr-hero">' +
      '<div class="pp-lr-hero-copy">' +
        '<p class="pp-eyebrow">Connected Apps</p>' +
        '<h2>Optional tools that extend Hubly Media</h2>' +
        '<p class="pp-lr-lead">Hubly already owns media for ' + esc(p.name) + '.</p>' +
        '<p>Connect Canva' + (showLr ? ' or Adobe Lightroom' : '') +
        ' when you want advanced editing — never required to upload, organize, or deliver.</p>' +
        '<div class="pp-btn-row">' +
          '<button type="button" class="pp-btn pp-btn-brand pp-btn-lg" data-pp-act="tab" data-pp-tab="media">Open Media</button>' +
          '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="canva-connect">Connect Canva</button>' +
          (showLr ? '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="adobe-connect">Connect Adobe</button>' : '') +
        '</div>' +
      '</div>' +
      '<div class="pp-lr-hero-side">' +
        '<div class="pp-lr-twin">' +
          '<div><span class="pp-label">Hubly Media</span><strong>' + esc(p.name) + '</strong><small>Primary record</small></div>' +
          '<div class="pp-lr-twin-join" aria-hidden="true">↔</div>' +
          '<div><span class="pp-label">Optional apps</span><strong>' + esc(workspaceSummary(p) || 'None yet') + '</strong><small>Enhance when ready</small></div>' +
        '</div>' +
      '</div></section>';

    var providers = '<section class="pp-panel pp-panel-wide"><h3>Connected Apps</h3>' +
      '<p class="pp-muted">Same Media module — tools appear based on your business capabilities.</p>' +
      '<div class="pp-ws-grid">' +
      providersList.map(function (prov) {
        var w = getWorkspace(p, prov.id);
        var connected = w && (w.sync_state === 'linked' || w.sync_state === 'synced' || w.sync_state === 'pending');
        var mark = connected ? '\u2713 Connected' : (prov.available ? '\u25cb Connect' : '\u25cb Soon');
        var act = connectActionForProvider(prov.id);
        return '<div class="pp-ws-card' + (connected ? ' on' : '') + '">' +
          '<div class="pp-mkt-top"><strong>' + esc(prov.label) + '</strong><span class="pp-pill">' + esc(prov.role) + '</span></div>' +
          '<p class="pp-muted">' + esc(mark) + '</p>' +
          (act
            ? '<button type="button" class="pp-btn pp-btn-ghost pp-btn-sm" data-pp-act="' + act + '" data-pp-provider="' + esc(prov.id) + '">' + (connected ? 'Manage' : 'Connect') + '</button>'
            : '<button type="button" class="pp-btn pp-btn-ghost pp-btn-sm" disabled>Soon</button>') +
          '</div>';
      }).join('') +
      '</div></section>';

    var lrDetail = (showLr && adobeConnected)
      ? '<section class="pp-panel pp-panel-wide"><h3>Adobe Lightroom</h3><dl class="pp-dl">' +
        '<div><dt>Status</dt><dd>' + esc(lrLabel(p.lightroom_status)) + '</dd></div>' +
        '<div><dt>Album</dt><dd>' + esc(lr.album_name || (lrWs && lrWs.display_name) || '\u2014') + '</dd></div>' +
        '<div><dt>Photos</dt><dd>' + esc(String(((lrWs && lrWs.metadata && lrWs.metadata.lightroom_sync) || {}).photo_count != null
          ? lrWs.metadata.lightroom_sync.photo_count
          : '\u2014')) + '</dd></div>' +
        '<div><dt>Favorites</dt><dd>' + esc(String(((lrWs && lrWs.metadata && lrWs.metadata.lightroom_sync) || {}).favorites != null
          ? lrWs.metadata.lightroom_sync.favorites
          : '\u2014')) + '</dd></div>' +
        '<div><dt>Last Sync</dt><dd>' + esc(formatRelative((lrWs && lrWs.last_sync_at) || p.last_sync_at)) + '</dd></div></dl>' +
        '<div class="pp-btn-row">' +
        '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="lr-create-album" data-pp-id="' + esc(p.id) + '">' +
          ((lrWs && lrWs.external_id) ? 'Reuse Lightroom Album' : 'Create Lightroom Album') + '</button>' +
        '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="lr-open" data-pp-id="' + esc(p.id) + '">Open Album</button>' +
        '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="sync" data-pp-id="' + esc(p.id) + '">Sync Album</button>' +
        '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="adobe-disconnect">Disconnect</button></div></section>'
      : '';

    var after = '<section class="pp-panel pp-panel-wide pp-lr-after">' +
      '<h3>What happens after you connect?</h3>' +
      '<ul class="pp-lr-checklist">' +
      (profile.afterConnect || []).map(function (item) {
        return '<li><span class="pp-check-ico" aria-hidden="true">\u2713</span><span>' + esc(item) + '</span></li>';
      }).join('') +
      '</ul></section>';

    return hero + providers + lrDetail + after;
  }

  function connectActionForProvider(providerId) {
    // Prefer facade registry — plugins register facades instead of editing this switch forever.
    if (providerId === 'adobe_lightroom' && !hasLightroomCapability()) return '';
    var facade = global.HublyConnectedApps && global.HublyConnectedApps.getFacade
      ? global.HublyConnectedApps.getFacade(providerId)
      : null;
    if (providerId === 'canva' || (facade && providerId === 'canva')) return 'canva-connect';
    if (providerId === 'adobe_lightroom' || (facade && providerId === 'adobe_lightroom')) return 'adobe-connect';
    if (facade && typeof facade.connect === 'function') return 'connect-app';
    return '';
  }

  function lightroomSyncMeta(p) {
    var lrWs = getWorkspace(p, 'adobe_lightroom');
    var meta = ((lrWs && lrWs.metadata) || {}).lightroom_sync || {};
    return {
      ws: lrWs,
      meta: meta,
      assets: Array.isArray(meta.assets) ? meta.assets : [],
      photoCount: meta.photo_count != null ? meta.photo_count : (p.photo_count || 0),
      favorites: meta.favorites != null ? meta.favorites : 0,
      edited: meta.edited != null ? meta.edited : 0,
      albumName: (lrWs && lrWs.display_name) || (p.lightroom && p.lightroom.album_name) || null,
      albumId: (lrWs && lrWs.external_id) || meta.album_id || null,
      catalogId: meta.catalog_id || ((lrWs && lrWs.metadata) || {}).catalog_id || null,
      lastSync: (lrWs && lrWs.last_sync_at) || meta.synced_at || p.last_sync_at || null,
      linked: !!(lrWs && (lrWs.sync_state === 'linked' || lrWs.sync_state === 'synced'))
    };
  }

  function renderLightroomTab(p) {
    var root = el('jos-photo-projects-root');
    var st = root ? getState(root) : { lrPanel: 'overview' };
    var panel = st.lrPanel || 'overview';
    var sync = lightroomSyncMeta(p);
    var adobeStatus = (st.adobeStatus && st.adobeStatus.data) || st.adobeStatus || {};
    var connected = !!(adobeStatus.connected || sync.linked);
    var account = adobeStatus.accountLabel || adobeStatus.adobeAccount || '—';

    var panels = [
      ['overview', 'Overview'],
      ['albums', 'Albums'],
      ['photos', 'Photos'],
      ['metadata', 'Metadata'],
      ['exports', 'Exports'],
      ['sync', 'Sync'],
      ['settings', 'Settings']
    ];

    var nav = '<nav class="pp-lr-panels" role="tablist">' + panels.map(function (x) {
      return '<button type="button" class="pp-lr-panel-btn' + (panel === x[0] ? ' on' : '') +
        '" data-pp-act="lr-panel" data-pp-panel="' + x[0] + '">' + esc(x[1]) + '</button>';
    }).join('') + '</nav>';

    var body = '';
    if (panel === 'albums') body = renderLrAlbumsPanel(p, sync);
    else if (panel === 'photos') body = renderLrPhotosPanel(p, sync, st);
    else if (panel === 'metadata') body = renderLrMetadataPanel(p, sync, st);
    else if (panel === 'exports') body = renderLrExportsPanel(p, sync);
    else if (panel === 'sync') body = renderLrSyncPanel(p, sync, adobeStatus);
    else if (panel === 'settings') body = renderLrSettingsPanel(p, sync, adobeStatus);
    else body = renderLrOverviewPanel(p, sync, adobeStatus, connected, account);

    return '<section class="pp-panel pp-panel-wide pp-lr-workspace">' +
      '<div class="pp-between">' +
        '<div><p class="pp-kicker">Adobe Lightroom · optional</p><h3>' + esc(p.name) + '</h3>' +
        '<p class="pp-muted">Hubly Media works without Adobe. When connected: upload to a linked album, edit in Lightroom, then <strong>Sync Now</strong> to pull updates back.</p></div>' +
        '<div class="pp-btn-row">' +
          (connected
            ? '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="sync" data-pp-id="' + esc(p.id) + '">Sync Now</button>' +
              (sync.albumId
                ? '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="lr-upload" data-pp-id="' + esc(p.id) + '">Upload to Lightroom</button>'
                : '')
            : '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="adobe-connect">Connect Adobe (optional)</button>' +
              '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="tab" data-pp-tab="media">Continue in Hubly Media</button>') +
        '</div></div>' +
      nav + '<div class="pp-lr-panel-body">' + body + '</div></section>';
  }

  function renderLrOverviewPanel(p, sync, adobeStatus, connected, account) {
    var hublyMedia = ((p.workspace && p.workspace.local_uploads) || p.local_uploads || []).length;
    var adobeCount = (sync.meta && sync.meta.photo_count != null) ? sync.meta.photo_count : null;
    var photoLabel = adobeCount != null
      ? String(adobeCount)
      : (hublyMedia ? (hublyMedia + ' in Hubly Media') : '0');
    var autoUpload = !!(p.workspace && p.workspace.auto_upload_to_lightroom);
    return '<div class="pp-lr-status-card">' +
      '<div class="pp-lr-status-grid">' +
        '<div><span class="pp-label">Hubly Project</span><strong>' + esc(p.name) + '</strong></div>' +
        '<div><span class="pp-label">Adobe</span><strong>' + (connected ? '✓ Connected' : '○ Not connected') + '</strong>' +
          '<small>' + esc(account) + '</small></div>' +
        '<div><span class="pp-label">Album</span><strong>' + esc(sync.albumName || 'Not linked') + '</strong></div>' +
        '<div><span class="pp-label">Last Sync</span><strong>' + esc(formatRelative(sync.lastSync)) + '</strong></div>' +
        '<div><span class="pp-label">Lightroom photos</span><strong>' + esc(photoLabel) + '</strong>' +
          (adobeCount == null && hublyMedia
            ? '<small>Not synced from Adobe yet</small>' : '') + '</div>' +
        '<div><span class="pp-label">Edited</span><strong>' + esc(String(sync.edited)) + '</strong></div>' +
        '<div><span class="pp-label">Favorites</span><strong>' + esc(String(sync.favorites)) + '</strong></div>' +
      '</div>' +
      '<ol class="pp-muted pp-mt pp-workflow-steps">' +
        '<li>Upload and organize photos in <strong>Hubly Media</strong> anytime — no Adobe required.</li>' +
        '<li><em>Optional:</em> Connect Adobe and link a Lightroom album for pro editing.</li>' +
        '<li>Upload Hubly photos → Lightroom, edit there, then <strong>Sync Now</strong>.</li>' +
        '<li>Publish Hubly client galleries from Hubly Media.</li>' +
      '</ol>' +
      '<label class="pp-auto-upload pp-mt"><input type="checkbox" data-pp-act="lr-auto-upload" data-pp-id="' +
        esc(p.id) + '"' + (autoUpload ? ' checked' : '') +
        (connected && sync.albumId ? '' : ' disabled') +
        '> Automatically upload new photos to Lightroom</label>' +
      '<div class="pp-btn-row pp-mt">' +
        '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="lr-create-album" data-pp-id="' + esc(p.id) + '">' +
          (sync.albumId ? 'Reuse Lightroom Project' : 'Create Lightroom Project') + '</button>' +
        '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="sync" data-pp-id="' + esc(p.id) + '">Sync Now</button>' +
        (connected && sync.albumId
          ? '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="lr-upload" data-pp-id="' + esc(p.id) + '">Upload to Lightroom</button>'
          : '') +
        '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="lr-open" data-pp-id="' + esc(p.id) + '">Open Lightroom Project</button>' +
      '</div></div>';
  }

  function renderLrAlbumsPanel(p, sync) {
    return '<div class="pp-btn-row">' +
      '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="lr-create-album" data-pp-id="' + esc(p.id) + '">Create Lightroom Project</button>' +
      '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="lr-list-albums" data-pp-id="' + esc(p.id) + '">List Albums</button>' +
      '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="lr-rename-album" data-pp-id="' + esc(p.id) + '"' +
        (sync.albumId ? '' : ' disabled') + '>Rename Album</button>' +
      '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="lr-unlink-album" data-pp-id="' + esc(p.id) + '"' +
        (sync.linked ? '' : ' disabled') + '>Unlink Album</button>' +
      '</div>' +
      '<dl class="pp-dl pp-mt">' +
      '<div><dt>Linked album</dt><dd>' + esc(sync.albumName || '—') + '</dd></div>' +
      '<div><dt>Album id</dt><dd>' + esc(sync.albumId || '—') + '</dd></div>' +
      '<div><dt>Catalog</dt><dd>' + esc(sync.catalogId || '—') + '</dd></div></dl>' +
      '<div id="pp-lr-albums-list" class="pp-mt"><p class="pp-muted">Tap List Albums to load Adobe project albums, then link one to this Hubly job.</p></div>';
  }

  function renderLrPhotosPanel(p, sync, st) {
    var filter = (st && st.lrPhotoFilter) || 'all';
    var assets = sync.assets.slice();
    if (filter === 'favorites') assets = assets.filter(function (a) { return a.favorite; });
    if (filter === 'edited') assets = assets.filter(function (a) { return a.edited; });
    if (filter === 'rated') assets = assets.filter(function (a) { return (a.rating || 0) >= 3; });
    var filters = [
      ['all', 'All'],
      ['favorites', 'Favorites'],
      ['edited', 'Edited'],
      ['rated', '3★+']
    ];
    return '<div class="pp-btn-row">' +
      filters.map(function (f) {
        return '<button type="button" class="pp-btn pp-btn-sm ' + (filter === f[0] ? 'pp-btn-brand' : 'pp-btn-ghost') +
          '" data-pp-act="lr-photo-filter" data-pp-filter="' + f[0] + '">' + f[1] + '</button>';
      }).join('') +
      '<button type="button" class="pp-btn pp-btn-ghost pp-btn-sm" data-pp-act="lr-browse-photos" data-pp-id="' + esc(p.id) + '">Browse Photos</button>' +
      '<button type="button" class="pp-btn pp-btn-ghost pp-btn-sm" data-pp-act="sync" data-pp-id="' + esc(p.id) + '">Refresh Sync</button>' +
      '</div>' +
      (assets.length
        ? '<div class="pp-media-grid pp-mt">' + assets.map(function (a) {
          return '<article class="pp-media-tile" data-pp-act="lr-view-photo" data-pp-asset="' + esc(a.id) + '" data-pp-id="' + esc(p.id) + '">' +
            '<div class="pp-media-thumb"><span class="pp-media-kind">' +
            (a.favorite ? '★ ' : '') + (a.edited ? 'Edited' : 'Photo') + '</span></div>' +
            '<p class="pp-media-name">' + esc(a.name || a.id) +
            (a.rating != null ? ' · ' + a.rating + '★' : '') + '</p></article>';
        }).join('') + '</div>'
        : '<p class="pp-muted pp-mt">No synced photos yet — Sync Now or Browse Photos after linking an album.</p>');
  }

  function renderLrMetadataPanel(p, sync, st) {
    var selectedId = st && st.lrSelectedAsset;
    var asset = sync.assets.find(function (a) { return a.id === selectedId; }) || sync.assets[0];
    if (!asset) {
      return '<p class="pp-muted">Sync the album first, then select a photo to inspect rating, flags, keywords, EXIF, and capture info.</p>';
    }
    return '<dl class="pp-dl">' +
      '<div><dt>Name</dt><dd>' + esc(asset.name || asset.id) + '</dd></div>' +
      '<div><dt>Favorite</dt><dd>' + (asset.favorite ? 'Yes' : 'No') + '</dd></div>' +
      '<div><dt>Edited</dt><dd>' + (asset.edited ? 'Yes' : 'Original') + '</dd></div>' +
      '<div><dt>Rating</dt><dd>' + esc(asset.rating != null ? String(asset.rating) : '—') + '</dd></div>' +
      '<div><dt>Flag</dt><dd>' + esc(asset.flag || '—') + '</dd></div>' +
      '<div><dt>Keywords</dt><dd>' + esc((asset.keywords || []).join(', ') || '—') + '</dd></div>' +
      '<div><dt>Capture</dt><dd>' + esc(asset.captureDate || '—') + '</dd></div>' +
      '<div><dt>Camera</dt><dd>' + esc(asset.camera || '—') + '</dd></div>' +
      '<div><dt>Lens</dt><dd>' + esc(asset.lens || '—') + '</dd></div>' +
      '<div><dt>Dimensions</dt><dd>' + esc(
        (asset.width && asset.height) ? (asset.width + ' × ' + asset.height) : '—'
      ) + '</dd></div>' +
      '<div><dt>GPS</dt><dd>' + esc(
        asset.gps && (asset.gps.latitude != null)
          ? (asset.gps.latitude + ', ' + asset.gps.longitude)
          : '—'
      ) + '</dd></div></dl>' +
      '<button type="button" class="pp-btn pp-btn-ghost pp-btn-sm" data-pp-act="lr-view-photo" data-pp-asset="' +
      esc(asset.id) + '" data-pp-id="' + esc(p.id) + '">Refresh from Adobe</button>';
  }

  function renderLrExportsPanel(p, sync) {
    var edited = sync.assets.filter(function (a) { return a.edited; });
    var uploads = ((p.workspace && p.workspace.local_uploads) || p.local_uploads || []);
    var pending = uploads.filter(function (u) {
      return mediaKind(u) === 'photo' &&
        !(u.lightroom_asset_id && u.lightroom_upload_status === 'uploaded');
    }).length;
    return '<p class="pp-muted">Upload Hubly Media into the linked Lightroom album, or export Adobe renditions back into Hubly. Publish Hubly gallery is client delivery only.</p>' +
      (pending
        ? '<p class="pp-muted">' + esc(String(pending)) + ' Hubly photo(s) not in Lightroom yet.</p>'
        : '<p class="pp-muted">All Hubly photos are uploaded (or none pending).</p>') +
      '<div class="pp-btn-row">' +
      '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="lr-upload" data-pp-id="' + esc(p.id) + '"' +
        (sync.albumId ? '' : ' disabled title="Link a Lightroom album first"') +
        '>Upload to Lightroom</button>' +
      '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="gal-publish" data-pp-id="' + esc(p.id) + '">Publish Hubly gallery</button>' +
      '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="deliver" data-pp-id="' + esc(p.id) + '">Deliver to Client</button>' +
      '</div>' +
      (edited.length
        ? '<ul class="pp-queue pp-mt">' + edited.slice(0, 24).map(function (a) {
          return '<li><strong>' + esc(a.name || a.id) + '</strong>' +
            '<span class="pp-btn-row">' +
            '<button type="button" class="pp-btn pp-btn-ghost pp-btn-sm" data-pp-act="lr-export" data-pp-asset="' + esc(a.id) +
            '" data-pp-rendition="2048" data-pp-id="' + esc(p.id) + '">JPEG</button>' +
            '<button type="button" class="pp-btn pp-btn-ghost pp-btn-sm" data-pp-act="lr-export" data-pp-asset="' + esc(a.id) +
            '" data-pp-rendition="full" data-pp-id="' + esc(p.id) + '">Full</button>' +
            '<button type="button" class="pp-btn pp-btn-ghost pp-btn-sm" data-pp-act="lr-export" data-pp-asset="' + esc(a.id) +
            '" data-pp-rendition="thumbnail" data-pp-id="' + esc(p.id) + '">Thumb</button></span></li>';
        }).join('') + '</ul>'
        : '<p class="pp-muted pp-mt">No edited photos in the last sync yet.</p>');
  }

  function renderLrSyncPanel(p, sync, adobeStatus) {
    return renderLrOverviewPanel(p, sync, adobeStatus, !!(adobeStatus.connected || sync.linked),
      adobeStatus.accountLabel || adobeStatus.adobeAccount || '—') +
      '<p class="pp-muted pp-mt"><strong>Sync</strong> pulls Adobe edits into Hubly (matched by Lightroom asset ID when known). <strong>Upload to Lightroom</strong> pushes Hubly Media into the linked album.</p>';
  }

  function renderLrSettingsPanel(p, sync, adobeStatus) {
    return '<dl class="pp-dl">' +
      '<div><dt>Adobe user</dt><dd>' + esc(adobeStatus.accountLabel || adobeStatus.adobeAccount || '—') + '</dd></div>' +
      '<div><dt>Token expires</dt><dd>' + esc(adobeStatus.tokenExpiresAt ? formatRelative(adobeStatus.tokenExpiresAt) : '—') + '</dd></div>' +
      '<div><dt>Catalog</dt><dd>' + esc(adobeStatus.catalogId || sync.catalogId || '—') + '</dd></div>' +
      '<div><dt>Health</dt><dd>' + esc(adobeStatus.health || '—') + '</dd></div></dl>' +
      '<div class="pp-btn-row">' +
      '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="adobe-connect">Connect / Reconnect Adobe</button>' +
      '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="adobe-refresh">Refresh Authentication</button>' +
      '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="lr-catalog">Read Catalog</button>' +
      '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="adobe-disconnect">Disconnect Adobe Account</button>' +
      '</div>';
  }

  function renderCreativeTab(p) {
    var HubCA = global.HublyConnectedApps;
    var apps = (HubCA && HubCA.creativeApps) ? HubCA.creativeApps() : [];
    var kinds = (HubCA && HubCA.marketingKinds) ? HubCA.marketingKinds() : [];
    var planned = ((p.workspace && p.workspace.creative_requests) || []).slice().reverse();

    var dynamicActions = [];
    apps.forEach(function (a) {
      (a.actions || []).forEach(function (act) {
        if (act.capability === 'creative' || act.capability === 'templates') {
          dynamicActions.push({
            id: act.id,
            label: act.label,
            providerId: a.id,
            providerName: a.name
          });
        }
      });
    });
    if (!dynamicActions.length) {
      dynamicActions = kinds.map(function (k) {
        return { id: k.id, label: k.label, providerId: 'canva', providerName: 'Canva' };
      });
    }

    var actions = '<div class="pp-mkt-grid pp-mt">' +
      dynamicActions.map(function (k) {
        return '<div class="pp-mkt-card">' +
          '<div class="pp-mkt-top"><strong>' + esc(k.label) + '</strong><span class="pp-pill">' + esc(k.providerName || '') + '</span></div>' +
          '<p class="pp-muted">Uses media from this project + your brand.</p>' +
          '<button type="button" class="pp-btn pp-btn-brand pp-btn-sm" data-pp-act="creative-create" data-pp-id="' + esc(p.id) +
          '" data-pp-kind="' + esc(k.id) + '" data-pp-provider="' + esc(k.providerId || 'canva') + '">Create</button>' +
          '</div>';
      }).join('') + '</div>';

    var lrCta = hasLightroomCapability()
      ? '<div class="pp-btn-row pp-mt"><button type="button" class="pp-btn pp-btn-ghost" data-pp-act="tab" data-pp-tab="lightroom">Open Lightroom workspace</button></div>'
      : '';

    return '<section class="pp-panel pp-panel-wide">' +
      '<h3>Creative</h3>' +
      '<p class="pp-muted">Media first \u2014 then design. Connect Canva under <strong>Apps</strong>. Lightroom lives in its own tab.</p>' +
      '<div class="pp-btn-row">' +
      '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="tab" data-pp-tab="media">Open Media</button>' +
      '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="open-apps">Open Apps</button>' +
      '</div>' + lrCta +
      '<h3 class="pp-mt">Create Marketing Asset</h3>' +
      '<p class="pp-muted">Hubly sends project photos, brand colors, and copy to Canva \u2014 you never start from a blank canvas.</p>' +
      actions +
      (planned.length
        ? '<h3 class="pp-mt">Planned on this project</h3><ul class="pp-queue">' + planned.map(function (r) {
          return '<li><strong>' + esc(r.kind || 'Asset') + '</strong><span>' + esc(r.status || 'planned') + ' \u00b7 ' + esc(formatRelative(r.at)) + '</span></li>';
        }).join('') + '</ul>'
        : '') +
      '</section>';
  }

  function queueList(items, empty) {
    if (!items || !items.length) return '<p class="pp-muted">' + esc(empty) + '</p>';
    return '<ul class="pp-queue">' + items.map(function (it) {
      return '<li><strong>' + esc(it.title || it.name || 'Item') + '</strong><span>' + esc(it.at || it.status || '') + '</span></li>';
    }).join('') + '</ul>';
  }

  function mediaKind(item) {
    var t = String((item && (item.type || item.mime)) || '').toLowerCase();
    var n = String((item && item.name) || '').toLowerCase();
    if (t.indexOf('video') === 0 || /\.(mp4|mov|webm|m4v)$/.test(n)) return 'video';
    if (t.indexOf('image') === 0 || /\.(jpe?g|png|gif|webp|heic|raw|dng|cr2|cr3|nef|arw|orf|rw2)$/.test(n)) return 'photo';
    return 'doc';
  }

  function isRawPhotoName(name) {
    return /\.(nef|cr2|cr3|dng|arw|orf|rw2|raw)$/i.test(String(name || ''));
  }

  /** Largest embedded JPEG inside a RAW container (NEF/CR2/DNG…). Browser cannot render RAW itself. */
  function extractEmbeddedJpegFromBuffer(buffer) {
    var bytes = new Uint8Array(buffer);
    var bestStart = -1;
    var bestLen = 0;
    var limit = Math.min(bytes.length - 1, bytes.length);
    for (var i = 0; i < limit; i++) {
      if (bytes[i] !== 0xff || bytes[i + 1] !== 0xd8) continue;
      for (var j = i + 2; j < bytes.length - 1; j++) {
        if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
          var len = j - i + 2;
          // Prefer larger previews; ignore tiny EXIF thumbnails under ~2KB.
          if (len > bestLen && len >= 2048) {
            bestLen = len;
            bestStart = i;
          }
          i = j + 1;
          break;
        }
        // Cap runaway scans per SOI (malformed)
        if (j - i > 8 * 1024 * 1024) break;
      }
    }
    if (bestStart < 0) return null;
    return new Blob([bytes.subarray(bestStart, bestStart + bestLen)], { type: 'image/jpeg' });
  }

  async function buildMediaPreview(file) {
    var name = file && file.name ? file.name : '';
    var mime = (file && file.type) || '';
    if (mime.indexOf('image/') === 0 && !isRawPhotoName(name)) {
      try {
        return { previewUrl: URL.createObjectURL(file), previewSource: 'browser', previewBlob: null, isRaw: false };
      } catch (e) {
        return { previewUrl: '', previewSource: 'none', previewBlob: null, isRaw: false };
      }
    }
    if (isRawPhotoName(name) || /nef|dng|cr2|raw/i.test(mime)) {
      try {
        // NEF/CR2 often keep the large preview near the end — scan head then tail.
        var chunk = 16 * 1024 * 1024;
        var headEnd = Math.min(file.size, chunk);
        var jpeg = extractEmbeddedJpegFromBuffer(await file.slice(0, headEnd).arrayBuffer());
        if (!jpeg && file.size > chunk) {
          var tailStart = Math.max(0, file.size - chunk);
          jpeg = extractEmbeddedJpegFromBuffer(await file.slice(tailStart, file.size).arrayBuffer());
        }
        if (!jpeg && file.size > chunk * 2) {
          // Middle pass for odd containers
          var mid = Math.floor(file.size / 2);
          var midStart = Math.max(0, mid - Math.floor(chunk / 2));
          jpeg = extractEmbeddedJpegFromBuffer(
            await file.slice(midStart, Math.min(file.size, midStart + chunk)).arrayBuffer()
          );
        }
        if (jpeg) {
          return {
            previewUrl: URL.createObjectURL(jpeg),
            previewSource: 'raw_embedded',
            previewBlob: jpeg,
            isRaw: true
          };
        }
      } catch (eRaw) {}
      return { previewUrl: '', previewSource: 'raw_none', previewBlob: null, isRaw: true };
    }
    return { previewUrl: '', previewSource: 'none', previewBlob: null, isRaw: false };
  }

  function renderMediaTile(item) {
    var kind = mediaKind(item);
    // Never use ephemeral blob:/data: URLs from persisted workspace — they die on refresh.
    var preview = (isDurableMediaUrl(item.previewUrl) && item.previewUrl) ||
      (isDurableMediaUrl(item.url) && item.url) || '';
    var isRaw = !!(item.isRaw || isRawPhotoName(item.name));
    var lrStatus = String(item.lightroom_upload_status || '');
    var lrBadge = '';
    if (lrStatus === 'uploaded' || item.lightroom_asset_id) {
      lrBadge = '<span class="pp-lr-badge is-ok" title="In Lightroom">LR</span>';
    } else if (lrStatus === 'uploading') {
      lrBadge = '<span class="pp-lr-badge is-busy" title="Uploading to Lightroom">…</span>';
    } else if (lrStatus === 'failed' || lrStatus === 'unsupported') {
      lrBadge = '<span class="pp-lr-badge is-err" title="' + esc(item.lightroom_upload_error || 'Upload failed') + '">!</span>';
    }
    var label = kind === 'video' ? 'Video' : kind === 'doc' ? 'File' : (isRaw && !preview ? 'RAW · no preview' : isRaw ? 'RAW' : 'Photo');
    var inner = preview && kind === 'photo'
      ? '<img src="' + esc(preview) + '" alt="' + esc(item.name || 'Photo') + '" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling&&(this.nextElementSibling.hidden=false)">' +
        '<span class="pp-media-kind" hidden>' + esc(isRaw ? 'RAW · no preview' : 'Photo') + '</span>'
      : '<span class="pp-media-kind">' + esc(label) + '</span>';
    return '<article class="pp-media-tile kind-' + kind + (isRaw ? ' is-raw' : '') + '" title="' + esc(item.name || '') + '">' +
      '<div class="pp-media-thumb">' + inner +
      (isRaw ? '<span class="pp-raw-badge">RAW</span>' : '') +
      lrBadge +
      '</div>' +
      '<p class="pp-media-name">' + esc(item.name || 'Untitled') + '</p></article>';
  }

  function renderMediaTab(p) {
    var uploads = ((p.workspace && p.workspace.local_uploads) || p.local_uploads || []).slice();
    var photos = uploads.filter(function (u) { return mediaKind(u) === 'photo'; });
    var videos = uploads.filter(function (u) { return mediaKind(u) === 'video'; });
    var docs = uploads.filter(function (u) { return mediaKind(u) === 'doc'; });
    var total = uploads.length || p.photo_count || 0;
    var missingPreview = photos.filter(function (u) {
      return !isDurableMediaUrl(u.previewUrl) && !isDurableMediaUrl(u.url);
    }).length;

    function section(title, items, empty) {
      return '<section class="pp-media-section">' +
        '<div class="pp-between"><h3>' + esc(title) + '</h3><span class="pp-pill">' + esc(String(items.length)) + '</span></div>' +
        (items.length
          ? '<div class="pp-media-grid">' + items.map(renderMediaTile).join('') + '</div>'
          : '<p class="pp-muted">' + esc(empty) + '</p>') +
        '</section>';
    }

    return '<section class="pp-panel pp-panel-wide pp-media-hero">' +
      '<div class="pp-between">' +
        '<div><h3>Media</h3><p class="pp-muted">Upload, organize, and deliver photos and videos in Hubly. Lightroom sync is optional when Adobe is connected.</p></div>' +
        '<span class="pp-pill">' + esc(String(total)) + ' assets</span>' +
      '</div>' +
      '<div class="pp-btn-row pp-mt">' +
        '<label class="pp-btn pp-btn-brand pp-btn-lg pp-file-btn">+ Upload Photos' +
          '<input type="file" accept="image/*,.heic,.raw,.dng,.cr2,.nef" multiple data-pp-media-files data-pp-id="' + esc(p.id) + '" data-pp-kind="photo" hidden></label>' +
        '<label class="pp-btn pp-btn-ghost pp-btn-lg pp-file-btn">+ Upload Videos' +
          '<input type="file" accept="video/*" multiple data-pp-media-files data-pp-id="' + esc(p.id) + '" data-pp-kind="video" hidden></label>' +
        '<label class="pp-btn pp-btn-ghost pp-file-btn">+ Files' +
          '<input type="file" accept="image/*,video/*,.pdf,.doc,.docx" multiple capture="environment" data-pp-media-files data-pp-id="' + esc(p.id) + '" data-pp-kind="any" hidden></label>' +
        '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="media-import-drive" data-pp-id="' + esc(p.id) + '">Import from Google Drive</button>' +
      '</div>' +
      '<div class="pp-dropzone' + (total ? '' : ' is-empty') + '" data-pp-dropzone data-pp-id="' + esc(p.id) + '">' +
        '<strong>Drag &amp; drop here</strong>' +
        '<span>Photos, videos, or documents — or use the buttons above.</span>' +
      '</div>' +
      (missingPreview
        ? '<p class="pp-muted pp-mt">Some photos have no stored preview — re-upload them once so Hubly can save thumbnails (especially NEF/RAW).</p>'
        : '') +
      '</section>' +
      section('Photos', photos, 'No photos yet — upload or drag them in.') +
      section('Videos', videos, 'No videos yet.') +
      section('Documents', docs, 'No documents yet.') +
      (isPhotoTrade() || projectWorkspaceProfile().features.galleries
        ? '<section class="pp-panel pp-panel-wide"><div class="pp-between"><h3>Galleries &amp; delivery</h3>' +
          '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="gal-publish" data-pp-id="' + esc(p.id) + '">Publish Hubly gallery</button></div>' +
          '<p class="pp-muted"><strong>Galleries:</strong> Publish creates a <strong>Hubly client gallery</strong> from your media. Adobe Lightroom is optional — use Upload to Lightroom on the Lightroom tab only if you want pro edits synced back.</p></section>'
        : '');
  }

  function renderFilesTab(p) {
    return '<div class="pp-panel-grid">' +
      '<div class="pp-panel-wide">' + renderContractsTab(p) + '</div>' +
      '<div class="pp-panel-wide">' + renderInvoicesTab(p) + '</div>' +
      '<div class="pp-panel-wide">' + renderQuestionnaireTab(p) + '</div></div>';
  }

  function renderAiAssistantTab(p) {
    return '<div class="pp-panel-grid">' +
      '<section class="pp-panel pp-panel-wide"><h3>AI Assistant</h3>' +
      '<p class="pp-muted">Ask Hubly to organize media, draft updates, or kick off creative from this project.</p>' +
      '<div class="pp-btn-row">' +
      '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="tab" data-pp-tab="media">Start with media</button>' +
      '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="tab" data-pp-tab="creative">Create marketing asset</button>' +
      '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="deliver" data-pp-id="' + esc(p.id) + '">Prepare delivery</button>' +
      '</div></section>' +
      renderMarketingTab(p) +
      renderNotesTab(p) +
      '</div>';
  }

  function renderGalleryTab(p) {
    return renderMediaTab(p);
  }

  function renderContractsTab(p) {
    var list = p.contracts || [];
    return '<section class="pp-panel pp-panel-wide"><div class="pp-between"><h3>Contracts</h3>' +
      '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="contract-add" data-pp-id="' + esc(p.id) + '">+ Contract</button></div>' +
      (list.length ? '<ul class="pp-queue">' + list.map(function (c) {
        return '<li><strong>' + esc(c.title) + '</strong><span>' + esc(c.status) + '</span></li>';
      }).join('') + '</ul>' : '<p class="pp-muted">No contracts yet.</p>') + '</section>';
  }
  function renderInvoicesTab(p) {
    var list = p.invoices || [];
    return '<section class="pp-panel pp-panel-wide"><div class="pp-between"><h3>Invoices</h3>' +
      '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="invoice-add" data-pp-id="' + esc(p.id) + '">+ Invoice</button></div>' +
      '<div class="pp-hero-kpis pp-mb">' + kpi('Revenue', money(p.revenue_cents)) + kpi('Outstanding', money(p.outstanding_cents)) + '</div>' +
      (list.length ? '<ul class="pp-queue">' + list.map(function (inv) {
        return '<li><strong>' + esc(inv.label) + '</strong><span>' + money(inv.amount_cents) + ' · ' + esc(inv.status) + '</span></li>';
      }).join('') + '</ul>' : '<p class="pp-muted">Add a deposit or balance anytime.</p>') + '</section>';
  }
  function renderQuestionnaireTab(p) {
    var q = p.questionnaire || {};
    return '<section class="pp-panel pp-panel-wide"><div class="pp-between"><h3>' + esc(q.title || 'Questionnaire') + '</h3><span class="pp-pill">' + esc(q.status || 'draft') + '</span></div>' +
      '<div class="pp-btn-row"><button type="button" class="pp-btn pp-btn-brand" data-pp-act="q-send" data-pp-id="' + esc(p.id) + '">Send to client</button>' +
      '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="q-complete" data-pp-id="' + esc(p.id) + '">Mark completed</button></div></section>';
  }
  function renderDeliverablesTab(p) {
    return '<section class="pp-panel pp-panel-wide"><h3>Deliverables</h3><ul class="pp-queue">' + (p.deliverables || []).map(function (d, i) {
      return '<li><strong>' + esc(d.title) + '</strong><select data-pp-act="del-status" data-pp-id="' + esc(p.id) + '" data-pp-del="' + i + '">' +
        ['pending', 'in_progress', 'ready', 'delivered'].map(function (s) {
          return '<option value="' + s + '"' + (d.status === s ? ' selected' : '') + '>' + s + '</option>';
        }).join('') + '</select></li>';
    }).join('') + '</ul></section>';
  }
  function renderMarketingTab(p) {
    var editingDone = (p.editing_progress || 0) >= 100 || p.status === 'Proofing' || p.status === 'Delivered';
    return '<section class="pp-panel pp-panel-wide"><h3>Marketing</h3>' +
      '<p class="pp-muted">' + (editingDone
        ? 'Media looks ready — kick off campaigns from Creative or Apps.'
        : 'When media is ready on this project, Hubly can generate campaigns automatically.') + '</p>' +
      '<div class="pp-mkt-grid">' + (p.marketing || []).map(function (m) {
        return '<div class="pp-mkt-card"><div class="pp-mkt-top"><strong>' + esc(m.title) + '</strong><span class="pp-pill">' + esc(m.status) + '</span></div>' +
          '<p class="pp-muted">Placeholder — AI generation comes next.</p>' +
          '<button type="button" class="pp-btn pp-btn-ghost pp-btn-sm" data-pp-act="mkt-ready" data-pp-id="' + esc(p.id) + '" data-pp-ch="' + esc(m.channel) + '">Mark ready</button></div>';
      }).join('') + '</div></section>';
  }
  function renderNotesTab(p) {
    return '<section class="pp-panel pp-panel-wide"><h3>Notes</h3><textarea class="pp-notes" rows="10" data-pp-act="notes" data-pp-id="' + esc(p.id) + '">' + esc(p.notes || '') + '</textarea></section>';
  }
  function renderActivityTab(p) {
    var list = (p.activity || []).slice().reverse();
    return '<section class="pp-panel pp-panel-wide"><h3>Activity</h3>' +
      (list.length ? '<ul class="pp-queue">' + list.map(function (a) {
        return '<li><strong>' + esc(a.action) + '</strong><span>' + esc(a.detail || '') + ' · ' + esc(formatRelative(a.created_at)) + '</span></li>';
      }).join('') + '</ul>' : '<p class="pp-muted">No activity yet.</p>') + '</section>';
  }

  /* ─── Render ────────────────────────────────────────────────────────── */

  function applyProjectsChrome() {
    setPhotoProjectsMode(true);
    var profile = projectWorkspaceProfile();
    try {
      var titleEl = el('bar-title'), subEl = el('bar-sub');
      if (titleEl) titleEl.textContent = 'Media';
      if (subEl) subEl.textContent = profile.subtitle;
      if (typeof global.setHublyDocTitle === 'function') global.setHublyDocTitle('Media');
    } catch (e) {}
    // Keep Home (and every other Operate body) fully out of the way — no bleed / flash.
    try {
      document.querySelectorAll('#p-app .body[id^="v-"]').forEach(function (node) {
        if (node.id === 'v-photo-projects') return;
        node.classList.add('hidden');
      });
      var home = el('v-dashboard') || el('v-home');
      if (home) home.classList.add('hidden');
    } catch (e2) {}
  }

  function paintProjectsView(root, list, st, opts) {
    opts = opts || {};
    var html = '';
    if (st.view === 'wizard') html = renderWizard(root, list, st);
    else if (st.view === 'command' && st.projectId) {
      var p = findProject(st.projectId);
      if (!p) {
        st.view = 'dashboard';
        st.projectId = null;
        html = renderDashboard(root, list, st);
      } else {
        html = renderCommand(root, st, p);
      }
    } else {
      st.view = 'dashboard';
      html = renderDashboard(root, list, st);
    }
    // Soft paints skip enter animations so tab / save updates don't flash.
    if (opts.soft) {
      html = html.replace('class="pp-shell', 'class="pp-shell pp-shell-static');
    }
    root.innerHTML = html;
    bindPhotoProjects(root);
  }

  /** Swap only the active tab + body — no full shell rebuild, no Home flash. */
  function switchCommandTab(tabId) {
    var root = el('jos-photo-projects-root');
    if (!root) return;
    var st = getState(root);
    var shell = root.querySelector('.pp-cc');
    var p = st.projectId ? findProject(st.projectId) : null;
    if (!shell || !p || st.view !== 'command') {
      st.tab = tabId || 'media';
      return paintProjectsView(root, _cache.projects || [], st, { soft: true });
    }

    var tab = tabId || 'media';
    // Legacy remaps (same as renderCommand).
    if (tab === 'apps') tab = hasLightroomCapability() ? 'lightroom' : 'creative';
    else if (tab === 'gallery') tab = 'media';
    else if (tab === 'contracts' || tab === 'invoices' || tab === 'questionnaire' || tab === 'files') tab = 'deliverables';
    else if (tab === 'marketing' || tab === 'notes') tab = 'assistant';
    st.tab = tab;
    persistUiPrefs(st);

    shell.querySelectorAll('.pp-tab').forEach(function (btn) {
      var on = btn.getAttribute('data-pp-tab') === tab;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var body = shell.querySelector('.pp-tab-body');
    if (body) body.innerHTML = renderTab(p, tab);
  }

  async function renderPhotoProjects(opts) {
    opts = opts || {};
    var root = ownRoot();
    if (!root) return;
    applyProjectsChrome();

    var st = getState(root);
    var soft = !!opts.soft;
    var hasCache = !!(_cache.loaded && _cache.businessId === businessId());

    // Never blank the UI when we already have something painted / cached.
    if (!hasCache && !root.querySelector('.pp-shell')) {
      root.innerHTML = '<div class="pp-shell pp-shell-static" style="background:var(--pp-bg);min-height:100vh"><div class="pp-empty"><p class="pp-muted">Loading projects…</p></div></div>';
    }

    var list = [];
    try {
      list = await loadProjectsFromSupabase(!!opts.force);
      st.error = null;
    } catch (err) {
      st.error = (err && err.message) || 'Could not load projects from Hubly.';
      list = _cache.projects || [];
    }

    try {
      paintProjectsView(root, list, st, { soft: soft || hasCache });
    } catch (paintErr) {
      console.warn('Projects paint failed', paintErr);
      st.error = (paintErr && paintErr.message) || 'Could not render media.';
      root.innerHTML = '<div class="pp-shell pp-shell-static" style="background:var(--pp-bg);min-height:100vh">' +
        '<div class="pp-empty"><h2>Couldn\u2019t open Media</h2>' +
        '<p class="pp-muted">' + esc(st.error) + '</p>' +
        '<div class="pp-btn-row" style="justify-content:center">' +
        '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="new">+ New job</button></div></div></div>';
      try { bindPhotoProjects(root); } catch (e2) {}
    }
  }

  /** Soft re-paint from cache (tabs, saves, wizard steps) — no loading flash. */
  function refreshProjectsView() {
    var root = el('jos-photo-projects-root') || ownRoot();
    if (!root) return;
    applyProjectsChrome();
    var st = getState(root);
    paintProjectsView(root, _cache.projects || [], st, { soft: true });
  }

  function buildProjectFromWizard(w) {
    var clientName = w.client_mode === 'existing' ? w.existing_client : w.client_name;
    var ws = defaultWorkspace({
      team: Object.assign({}, w.team),
      activity: [{ id: 'act_new', action: 'Project created', detail: w.name || 'Untitled Project', created_at: new Date().toISOString() }]
    });
    if (w.assets.contract) ws.contracts.push({ id: 'c1', title: 'Service Agreement', status: 'draft' });
    if (w.assets.invoice) ws.invoices.push({ id: 'i1', label: 'Deposit', kind: 'deposit', status: 'draft', amount_cents: 0 });
    if (w.assets.shot_list) ws.shot_list = [{ id: 's1', title: 'Must-have shots', items: [] }];
    if (w.assets.lightroom) {
      ws.lightroom.album_name = w.name || 'Untitled Project';
      ws.lightroom.connection_status = 'not_connected';
    }
    if (!w.assets.marketing) {
      ws.marketing = ws.marketing.map(function (m) { return Object.assign({}, m, { status: 'skipped' }); });
    }
    var p = {
      name: w.name || 'Untitled Project',
      project_type: w.project_type || 'Other',
      status: 'Lead',
      shoot_date: w.shoot_date || null,
      location: w.location || '',
      estimated_photos: w.estimated_photos ? Number(w.estimated_photos) : null,
      notes: w.notes || '',
      client_name: clientName || '',
      client_email: w.client_email || '',
      client_phone: w.client_phone || '',
      client_address: w.client_address || '',
      client_relationship: w.client_relationship || '',
      team: ws.team,
      timeline: ws.timeline,
      gallery: ws.gallery,
      lightroom: ws.lightroom,
      contracts: ws.contracts,
      invoices: ws.invoices,
      questionnaire: ws.questionnaire,
      deliverables: ws.deliverables,
      marketing: ws.marketing,
      activity: ws.activity,
      shot_list: ws.shot_list,
      workspace: ws,
      invoice_status: w.assets.invoice ? 'draft' : 'none',
      gallery_status: w.assets.gallery ? 'draft' : 'draft',
      lightroom_status: 'not_connected'
    };
    upsertWorkspaceLocal(p, {
      provider: 'adobe_lightroom',
      display_name: p.name,
      sync_state: w.assets.lightroom ? 'pending' : 'unlinked',
      metadata: { album_name: p.name }
    });
    return p;
  }

  async function createQuickProject(st) {
    var name = String((st.quick && st.quick.name) || '').trim();
    if (!name) { toast('Add a project name'); return null; }
    var fileCount = (st.quick && st.quick.files && st.quick.files.length) || 0;
    var ws = defaultWorkspace({
      local_uploads: (st.quick.files || []).map(function (f) {
        return { name: f.name, size: f.size, type: f.type };
      }),
      activity: [{
        id: 'act_q',
        action: 'Quick Project created',
        detail: fileCount ? fileCount + ' photos attached (metadata)' : 'Created in ~30 seconds',
        created_at: new Date().toISOString()
      }],
      lightroom: Object.assign(defaultWorkspace().lightroom, { album_name: name })
    });
    var p = {
      name: name,
      project_type: 'Other',
      status: 'Lead',
      photo_count: fileCount,
      estimated_photos: fileCount || null,
      workspace: ws,
      team: ws.team,
      timeline: ws.timeline,
      gallery: ws.gallery,
      lightroom: ws.lightroom,
      contracts: [],
      invoices: [],
      questionnaire: ws.questionnaire,
      deliverables: ws.deliverables,
      marketing: ws.marketing,
      activity: ws.activity,
      lightroom_status: 'not_connected'
    };
    upsertWorkspaceLocal(p, {
      provider: 'adobe_lightroom',
      display_name: name,
      sync_state: 'pending',
      metadata: { album_name: name, photo_count: fileCount }
    });
    return persistProject(p);
  }

  /* ─── Events ────────────────────────────────────────────────────────── */

  function bindPhotoProjects(root) {
    if (!root._ppBound) {
      root._ppBound = true;
      root.addEventListener('click', onClick);
      root.addEventListener('change', onChange);
      root.addEventListener('input', onInput);
      root.addEventListener('dragover', function (e) {
        var zone = e.target.closest('[data-pp-dropzone]');
        if (!zone) return;
        e.preventDefault();
        zone.classList.add('is-drag');
      });
      root.addEventListener('dragleave', function (e) {
        var zone = e.target.closest('[data-pp-dropzone]');
        if (!zone) return;
        zone.classList.remove('is-drag');
      });
      root.addEventListener('drop', function (e) {
        var zone = e.target.closest('[data-pp-dropzone]');
        if (!zone) return;
        e.preventDefault();
        zone.classList.remove('is-drag');
        var id = zone.getAttribute('data-pp-id');
        var files = e.dataTransfer && e.dataTransfer.files
          ? Array.prototype.slice.call(e.dataTransfer.files)
          : [];
        ingestMediaFiles(id, files, 'any');
      });
    }
  }

  async function saveAndRefresh(p, st) {
    try {
      await persistProject(p);
      st.error = null;
    } catch (err) {
      st.error = (err && err.message) || 'Could not save project.';
      toast(st.error);
    }
    // Soft refresh — keep shell, avoid Home flash / fade replay.
    return refreshProjectsView();
  }

  async function onClick(e) {
    var t = e.target.closest('[data-pp-act]');
    if (!t) return;
    var act = t.getAttribute('data-pp-act');
    var root = el('jos-photo-projects-root');
    if (!root) return;
    var st = getState(root);
    var id = t.getAttribute('data-pp-id');
    var p = id ? findProject(id) : (st.projectId ? findProject(st.projectId) : null);

    if (act === 'new') {
      st.view = 'wizard'; st.wizardStep = 1; st.wizard = blankWizard(); st.quickOpen = false;
      return refreshProjectsView();
    }
    if (act === 'quick') {
      st.quickOpen = true; st.quick = { name: '', files: [] };
      return refreshProjectsView();
    }
    if (act === 'quick-close') {
      st.quickOpen = false;
      return refreshProjectsView();
    }
    if (act === 'quick-create') {
      if (!ensureBusinessForSave()) return;
      try {
        var createdQ = await createQuickProject(st);
        if (!createdQ) return;
        st.quickOpen = false;
        st.view = 'command';
        st.projectId = createdQ.id;
        st.tab = 'media';
        toast('Project saved — add more media anytime');
        return refreshProjectsView();
      } catch (err) {
        toast((err && err.message) || 'Could not create project');
        return;
      }
    }
    if (act === 'wiz-cancel' || act === 'back-dash') {
      st.view = 'dashboard'; st.projectId = null; st.wizard = null;
      return refreshProjectsView();
    }
    if (act === 'wiz-client-mode') {
      st.wizard.client_mode = t.getAttribute('data-pp-mode') || 'new';
      return refreshProjectsView();
    }
    if (act === 'wiz-prev') {
      st.wizardStep = Math.max(1, (st.wizardStep || 1) - 1);
      return refreshProjectsView();
    }
    if (act === 'wiz-next') {
      if ((st.wizardStep || 1) === 1 && !(st.wizard && String(st.wizard.name || '').trim())) {
        toast('Add a project name'); return;
      }
      st.wizardStep = Math.min(3, (st.wizardStep || 1) + 1);
      return refreshProjectsView();
    }
    if (act === 'wiz-create') {
      if (!ensureBusinessForSave()) return;
      try {
        var created = await persistProject(buildProjectFromWizard(st.wizard || blankWizard()));
        st.view = 'command'; st.projectId = created.id; st.tab = 'media'; st.wizard = null;
        toast('Project created — drop your media here');
        return refreshProjectsView();
      } catch (err) {
        toast((err && err.message) || 'Could not create project');
        return;
      }
    }
    if (act === 'open' && id) {
      st.view = 'command'; st.projectId = id; st.tab = 'media'; persistUiPrefs(st);
      return refreshProjectsView();
    }
    if (act === 'tab') {
      var nextTab = t.getAttribute('data-pp-tab') || 'overview';
      if (nextTab === 'lightroom') {
        // Never block the tab on Adobe catalog verify — that call can take tens of seconds.
        switchCommandTab('lightroom');
        refreshLightroomStatusInBackground(st);
        return;
      }
      return switchCommandTab(nextTab);
    }
    if (act === 'lr-panel') {
      st.lrPanel = t.getAttribute('data-pp-panel') || 'overview';
      persistUiPrefs(st);
      return switchCommandTab('lightroom');
    }
    if (act === 'lr-photo-filter') {
      st.lrPhotoFilter = t.getAttribute('data-pp-filter') || 'all';
      return switchCommandTab('lightroom');
    }
    if (act === 'gallery' && p) {
      st.view = 'command'; st.projectId = p.id; st.tab = 'media'; persistUiPrefs(st);
      return switchCommandTab('media');
    }
    if (act === 'invoice' && p) {
      st.view = 'command'; st.projectId = p.id; st.tab = 'deliverables'; persistUiPrefs(st);
      return switchCommandTab('deliverables');
    }
    if (act === 'sync' && p) {
      var svc = global.AdobeLightroomService;
      var lrWsSync = getWorkspace(p, 'adobe_lightroom');
      var syncRes = null;
      if (svc && svc.syncProject) {
        syncRes = await svc.syncProject({
          businessId: businessId(),
          projectId: p.id,
          albumId: (lrWsSync && lrWsSync.external_id) || undefined,
          catalogId: (lrWsSync && lrWsSync.metadata && lrWsSync.metadata.catalog_id) || undefined,
        });
      }
      var syncMeta = Object.assign({}, (lrWsSync || {}).metadata || {});
      if (syncRes && syncRes.ok && syncRes.data && syncRes.data.workspaceMetadata) {
        Object.assign(syncMeta, syncRes.data.workspaceMetadata);
      } else {
        syncMeta.last_sync_request = new Date().toISOString();
      }
      if (syncRes && syncRes.data && Array.isArray(syncRes.data.mediaPatches)) {
        applyLightroomMediaPatches(p, syncRes.data.mediaPatches);
      }
      upsertWorkspaceLocal(p, {
        provider: 'adobe_lightroom',
        display_name: (p.lightroom && p.lightroom.album_name) || (lrWsSync && lrWsSync.display_name) || p.name,
        external_id: (syncRes && syncRes.data && syncRes.data.albumId) || (lrWsSync && lrWsSync.external_id) || null,
        sync_state: (syncRes && syncRes.ok) ? 'synced' : 'pending',
        last_sync_at: (syncRes && syncRes.data && syncRes.data.lastSyncAt) || null,
        metadata: syncMeta
      });
      addActivity(p, 'Sync ' + ((syncRes && syncRes.ok) ? 'complete' : 'requested'),
        (syncRes && syncRes.message) || 'Adobe Lightroom Connected App');
      return saveAndRefresh(p, st);
    }
    if (act === 'deliver' && p) {
      p.gallery_status = 'delivered';
      p.status = 'Delivered';
      if (p.gallery) p.gallery.delivery_status = 'delivered';
      (p.deliverables || []).forEach(function (d) { if (d.kind === 'gallery') d.status = 'delivered'; });
      addActivity(p, 'Gallery delivered', 'Client delivery marked complete');
      publishBus('gallery.delivered', { projectId: p.id, galleryId: 'main' });
      publishBus('project.delivered', { projectId: p.id });
      st.view = 'command'; st.projectId = p.id; st.tab = 'gallery';
      toast('Marked delivered');
      return saveAndRefresh(p, st);
    }
    if (act === 'adobe-connect') {
      // Adobe Lightroom sign-in — NOT Hubly login. Owner is already in Hubly.
      if (!hasLightroomCapability()) {
        toast('Lightroom unlocks for photography businesses. Open Apps to connect Canva instead.');
        return;
      }
      var svcC = global.AdobeLightroomService;
      var bizId = businessId() || '';
      if (!bizId) {
        toast('Couldn\u2019t find your business yet — refresh, then connect Lightroom.');
        return;
      }
      if (!svcC) {
        toast('Adobe Lightroom isn\u2019t ready yet. Media still works in Hubly.');
        return;
      }
      toast('Opening Adobe to sign in to Lightroom\u2026');
      var connectRes = await (svcC.connectAndRedirect
        ? svcC.connectAndRedirect({
          businessId: bizId,
          projectId: (p && p.id) || st.projectId || undefined,
        })
        : svcC.connect({
          businessId: bizId,
          projectId: (p && p.id) || st.projectId || undefined,
        }));
      if (connectRes && connectRes.ok && connectRes.data && connectRes.data.authorizeUrl) {
        if (p) {
          upsertWorkspaceLocal(p, {
            provider: 'adobe_lightroom',
            display_name: 'Adobe Lightroom',
            sync_state: 'pending',
            metadata: Object.assign({}, (getWorkspace(p, 'adobe_lightroom') || {}).metadata || {}, {
              connect_started_at: new Date().toISOString(),
            }),
          });
          addActivity(p, 'Adobe connect started', 'Continue in Adobe to link Lightroom');
          await saveAndRefresh(p, st);
        }
        if (!svcC.connectAndRedirect) {
          try { global.location.href = connectRes.data.authorizeUrl; } catch (e) {}
        }
        return;
      }
      if (connectRes && connectRes.code === 'PROVIDER_NOT_CONFIGURED') {
        toast('Adobe Lightroom isn\u2019t configured yet (missing Adobe credentials).');
        return;
      }
      toast((connectRes && connectRes.message) || 'Could not start Adobe Lightroom sign-in.');
      return;
    }
    if (act === 'canva-connect' || act === 'connect-app') {
      var connectId = act === 'canva-connect'
        ? 'canva'
        : (t.getAttribute('data-pp-provider') || 'canva');
      var facadeC = (global.HublyConnectedApps && global.HublyConnectedApps.getFacade)
        ? global.HublyConnectedApps.getFacade(connectId)
        : null;
      var canva = facadeC || (connectId === 'canva' ? global.CanvaConnectedApp : null);
      if (canva && canva.connect) {
        await canva.connect({ businessId: businessId() || '', projectId: (p && p.id) || st.projectId });
      } else {
        toast('Need: connect this app from the Apps Marketplace. Creative plans still save on the project.');
      }
      if (p) {
        var metaC = (global.HublyConnectedApps && global.HublyConnectedApps.get)
          ? global.HublyConnectedApps.get(connectId)
          : null;
        upsertWorkspaceLocal(p, {
          provider: connectId,
          display_name: (metaC && metaC.name) || connectId,
          sync_state: 'pending',
          metadata: { role: (metaC && metaC.role) || 'connected' }
        });
        addActivity(p, 'App connect requested', (metaC && metaC.name) || connectId);
        return saveAndRefresh(p, st);
      }
      return;
    }
    if (act === 'creative-create' && p) {
      var kind = t.getAttribute('data-pp-kind') || 'instagram_carousel';
      var providerId = t.getAttribute('data-pp-provider') || '';
      var brand = {
        name: (S().biz || S().businessName || ''),
        primaryColor: S().color || '#D9632D',
        logoUrl: S().logoUrl || null
      };
      var res = null;
      if (global.HublyConnectedApps && global.HublyConnectedApps.createMarketingAsset) {
        res = await global.HublyConnectedApps.createMarketingAsset({
          businessId: businessId(),
          projectId: p.id,
          providerId: providerId || undefined,
          capability: 'creative',
          kind: kind,
          title: p.name + ' · ' + kind,
          brand: brand,
          photoUrls: []
        });
      }
      p.workspace = p.workspace || defaultWorkspace();
      p.workspace.creative_requests = p.workspace.creative_requests || [];
      var boundId = (res && res.provider) || providerId || null;
      p.workspace.creative_requests.push({
        kind: kind,
        status: (res && res.ok) ? 'created' : 'planned',
        capability: 'creative',
        provider: boundId,
        at: new Date().toISOString(),
        message: res && res.message
      });
      if (boundId) {
        var providerMeta = (global.HublyConnectedApps && global.HublyConnectedApps.get)
          ? global.HublyConnectedApps.get(boundId)
          : null;
        upsertWorkspaceLocal(p, {
          provider: boundId,
          display_name: (providerMeta && providerMeta.name) || boundId,
          sync_state: 'pending',
          metadata: { last_creative_kind: kind, role: 'creative' }
        });
      }
      publishBus((res && res.ok) ? 'creative.asset_created' : 'creative.asset_planned', {
        projectId: p.id,
        kind: kind,
        capability: 'creative'
      });
      addActivity(p, 'Creative asset requested', 'Need: Marketing Graphics · ' + kind);
      toast((res && res.message) || 'Need: Marketing Graphics — request saved on the project');
      st.tab = 'creative';
      return saveAndRefresh(p, st);
    }
    if (act === 'adobe-refresh') {
      var svcR = global.AdobeLightroomService;
      if (!svcR || !svcR.refreshAuthentication) {
        toast('Adobe Lightroom isn\u2019t ready yet.');
        return;
      }
      var ref = await svcR.refreshAuthentication({ businessId: businessId() || '' });
      toast((ref && ref.message) || 'Authentication refreshed');
      await ensureAdobeStatus(st, true);
      return switchCommandTab('lightroom');
    }
    if (act === 'lr-catalog') {
      var svcCat = global.AdobeLightroomService;
      if (!svcCat) return;
      var catRes = await (svcCat.readCatalog || svcCat.syncCatalogMetadata).call(svcCat, {
        businessId: businessId() || ''
      });
      toast((catRes && catRes.message) || (catRes && catRes.data && catRes.data.id
        ? ('Catalog ' + catRes.data.id)
        : 'Catalog check finished'));
      await ensureAdobeStatus(st, true);
      return switchCommandTab('lightroom');
    }
    if (act === 'lr-list-albums' && p) {
      var svcL = global.AdobeLightroomService;
      if (!svcL || !svcL.listAlbums) return;
      var listed = await svcL.listAlbums({ businessId: businessId() || '', subtype: 'project' });
      var albums = (listed && listed.data) || [];
      st.lrAlbums = albums;
      var host = el('pp-lr-albums-list') || document.getElementById('pp-lr-albums-list');
      if (host) {
        host.innerHTML = albums.length
          ? '<ul class="pp-queue">' + albums.map(function (a) {
            return '<li><strong>' + esc(a.name || a.id) + '</strong>' +
              '<button type="button" class="pp-btn pp-btn-ghost pp-btn-sm" data-pp-act="lr-link-album" data-pp-id="' +
              esc(p.id) + '" data-pp-album="' + esc(a.id) + '" data-pp-album-name="' + esc(a.name || '') +
              '">Link to project</button></li>';
          }).join('') + '</ul>'
          : '<p class="pp-muted">No project albums found in Adobe.</p>';
      } else {
        toast((listed && listed.message) || (albums.length + ' album(s)'));
      }
      return;
    }
    if (act === 'lr-link-album' && p) {
      var svcLink = global.AdobeLightroomService;
      if (!svcLink || !svcLink.linkAlbum) return;
      await svcLink.linkAlbum({
        businessId: businessId() || '',
        projectId: p.id,
        albumId: t.getAttribute('data-pp-album'),
        name: t.getAttribute('data-pp-album-name') || p.name
      });
      return saveAndRefresh(p, st);
    }
    if (act === 'lr-unlink-album' && p) {
      var svcUn = global.AdobeLightroomService;
      if (!svcUn || !svcUn.unlinkAlbum) return;
      await svcUn.unlinkAlbum({ businessId: businessId() || '', projectId: p.id });
      return saveAndRefresh(p, st);
    }
    if (act === 'lr-rename-album' && p) {
      var syncM = lightroomSyncMeta(p);
      if (!syncM.albumId) { toast('Link an album first'); return; }
      var newName = '';
      try { newName = global.prompt('Rename Lightroom album', syncM.albumName || p.name) || ''; } catch (e) {}
      newName = String(newName).trim();
      if (!newName) return;
      var svcRn = global.AdobeLightroomService;
      if (!svcRn || !svcRn.renameAlbum) return;
      await svcRn.renameAlbum({
        businessId: businessId() || '',
        projectId: p.id,
        albumId: syncM.albumId,
        catalogId: syncM.catalogId || undefined,
        name: newName
      });
      return saveAndRefresh(p, st);
    }
    if (act === 'lr-browse-photos' && p) {
      var syncB = lightroomSyncMeta(p);
      var svcB = global.AdobeLightroomService;
      if (!svcB || !svcB.browsePhotos) return;
      var browsed = await svcB.browsePhotos({
        businessId: businessId() || '',
        projectId: p.id,
        albumId: syncB.albumId || undefined,
        catalogId: syncB.catalogId || undefined,
        favoritesOnly: st.lrPhotoFilter === 'favorites',
        editedOnly: st.lrPhotoFilter === 'edited',
        minRating: st.lrPhotoFilter === 'rated' ? 3 : undefined
      });
      if (browsed && browsed.ok && Array.isArray(browsed.data)) {
        p.workspace = p.workspace || defaultWorkspace();
        var lrWsB = getWorkspace(p, 'adobe_lightroom') || {};
        var metaB = Object.assign({}, lrWsB.metadata || {});
        metaB.lightroom_sync = Object.assign({}, metaB.lightroom_sync || {}, {
          photo_count: browsed.data.length,
          favorites: browsed.data.filter(function (a) { return a.favorite; }).length,
          edited: browsed.data.filter(function (a) { return a.edited; }).length,
          assets: browsed.data,
          synced_at: new Date().toISOString()
        });
        upsertWorkspaceLocal(p, {
          provider: 'adobe_lightroom',
          display_name: syncB.albumName || p.name,
          external_id: syncB.albumId,
          sync_state: 'synced',
          last_sync_at: new Date().toISOString(),
          metadata: metaB
        });
        return saveAndRefresh(p, st);
      }
      toast((browsed && browsed.message) || 'Could not browse photos');
      return;
    }
    if (act === 'lr-view-photo' && p) {
      var assetId = t.getAttribute('data-pp-asset');
      st.lrSelectedAsset = assetId;
      st.lrPanel = 'metadata';
      var svcV = global.AdobeLightroomService;
      if (svcV && svcV.viewPhoto && assetId) {
        var viewed = await svcV.viewPhoto({
          businessId: businessId() || '',
          assetId: assetId,
          catalogId: lightroomSyncMeta(p).catalogId || undefined
        });
        if (viewed && viewed.ok && viewed.data) {
          var syncV = lightroomSyncMeta(p);
          var assetsV = syncV.assets.slice();
          var idxV = assetsV.findIndex(function (a) { return a.id === assetId; });
          if (idxV >= 0) assetsV[idxV] = Object.assign({}, assetsV[idxV], viewed.data);
          else assetsV.push(viewed.data);
          var lrWsV = getWorkspace(p, 'adobe_lightroom') || {};
          var metaV = Object.assign({}, lrWsV.metadata || {});
          metaV.lightroom_sync = Object.assign({}, metaV.lightroom_sync || {}, { assets: assetsV });
          upsertWorkspaceLocal(p, {
            provider: 'adobe_lightroom',
            metadata: metaV,
            sync_state: (lrWsV && lrWsV.sync_state) || 'linked'
          });
          await persistProject(p);
        }
      }
      return switchCommandTab('lightroom');
    }
    if (act === 'lr-export' && p) {
      var exportId = t.getAttribute('data-pp-asset');
      var rendition = t.getAttribute('data-pp-rendition') || '2048';
      var svcE = global.AdobeLightroomService;
      if (!svcE || !svcE.exportFinalPhotos || !exportId) return;
      toast('Exporting final photo\u2026');
      var exp = await svcE.exportFinalPhotos({
        businessId: businessId() || '',
        assetId: exportId,
        catalogId: lightroomSyncMeta(p).catalogId || undefined,
        renditionType: rendition
      });
      if (exp && exp.ok && exp.data && exp.data.base64) {
        try {
          var bin = atob(exp.data.base64);
          var bytes = new Uint8Array(bin.length);
          for (var bi = 0; bi < bin.length; bi++) bytes[bi] = bin.charCodeAt(bi);
          var blob = new Blob([bytes], { type: exp.data.contentType || 'image/jpeg' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = (exportId || 'photo') + '-' + rendition + '.jpg';
          a.click();
          setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 2000);
          toast('Exported final photo');
        } catch (eExp) {
          toast('Export received but download failed');
        }
      } else {
        toast((exp && exp.message) || 'Could not export photo');
      }
      return;
    }
    if (act === 'lr-upload' && p) {
      return uploadProjectMediaToLightroom(p, st, {});
    }
    if (act === 'lr-auto-upload' && p) {
      p.workspace = p.workspace || defaultWorkspace();
      p.workspace.auto_upload_to_lightroom = !!t.checked;
      addActivity(p, 'Lightroom auto-upload', p.workspace.auto_upload_to_lightroom ? 'On' : 'Off');
      return saveAndRefresh(p, st);
    }
    if (act === 'adobe-disconnect') {
      p = p || findProject(st.projectId);
      var svcD = global.AdobeLightroomService;
      if (svcD && svcD.disconnectAccount) {
        await svcD.disconnectAccount({ businessId: businessId() || '' });
      } else if (svcD && svcD.disconnect) {
        await svcD.disconnect({ businessId: businessId() || '' });
      }
      if (p) {
        upsertWorkspaceLocal(p, {
          provider: 'adobe_lightroom',
          sync_state: 'unlinked'
        });
        p.lightroom_status = 'not_connected';
        addActivity(p, 'Workspace disconnected', 'Adobe Lightroom');
        st.adobeStatus = null;
        return saveAndRefresh(p, st);
      }
      toast('Adobe Lightroom disconnected');
      return;
    }
    if (act === 'lr-create-album' && p) {
      var svcA = global.AdobeLightroomService;
      var existingWs = getWorkspace(p, 'adobe_lightroom');
      var createRes = null;
      if (svcA && svcA.createAlbum) {
        createRes = await svcA.createAlbum({
          businessId: businessId() || '',
          projectId: p.id,
          name: p.name,
        });
      }
      p.lightroom = p.lightroom || {};
      var albumName = (createRes && createRes.data && createRes.data.name) || p.name;
      var albumId = (createRes && createRes.data && createRes.data.id) ||
        (existingWs && existingWs.external_id) || null;
      p.lightroom.album_name = albumName;
      if (albumId) p.lightroom.album_id = albumId;
      upsertWorkspaceLocal(p, {
        provider: 'adobe_lightroom',
        display_name: albumName,
        external_id: albumId,
        sync_state: albumId ? 'linked' : 'pending',
        metadata: Object.assign({}, (existingWs || {}).metadata || {}, {
          album_name: albumName,
          album_id: albumId,
          catalog_id: (createRes && createRes.data && createRes.data.catalogId) ||
            ((existingWs && existingWs.metadata) || {}).catalog_id || null,
          reused: !!(createRes && createRes.meta && createRes.meta.reused),
        })
      });
      p.lightroom_status = albumId ? 'album_ready' : 'not_connected';
      addActivity(p, albumId ? 'Lightroom album linked' : 'Lightroom prepare failed',
        (createRes && createRes.message) || albumName);
      return saveAndRefresh(p, st);
    }
    if (act === 'lr-open') {
      p = p || findProject(st.projectId);
      var svcO = global.AdobeLightroomService;
      var openWs = p ? getWorkspace(p, 'adobe_lightroom') : null;
      if (svcO && svcO.openAlbum) {
        await svcO.openAlbum({
          businessId: businessId() || '',
          projectId: p && p.id,
          albumId: openWs && openWs.external_id,
          catalogId: openWs && openWs.metadata && openWs.metadata.catalog_id,
        });
      } else {
        toast('Open Adobe Lightroom → Connections to find this Hubly project album.');
      }
      return;
    }
    if (act === 'gal-publish' && p) {
      var svcP = global.AdobeLightroomService;
      var pubRes = svcP ? await svcP.publishGallery({ businessId: businessId() || '', projectId: p.id, galleryId: 'main' }) : null;
      p.gallery_status = 'published';
      if (p.gallery) p.gallery.delivery_status = 'published';
      addActivity(p, 'Hubly gallery published', 'Client gallery ready in Hubly — not sent to Adobe Lightroom');
      toast((pubRes && pubRes.message) || 'Hubly gallery published — not uploaded to Adobe Lightroom');
      return saveAndRefresh(p, st);
    }
    if (act === 'gal-share' && p) {
      p.gallery_status = 'published';
      addActivity(p, 'Gallery shared', 'Share link ready');
      return saveAndRefresh(p, st);
    }
    if (act === 'gal-download' && p) {
      if (p.gallery) p.gallery.downloads = true;
      return saveAndRefresh(p, st);
    }
    if (act === 'gal-hide' && p) {
      p.gallery_status = 'private';
      if (p.gallery) p.gallery.delivery_status = 'private';
      return saveAndRefresh(p, st);
    }
    if (act === 'gal-feature' && p) {
      addActivity(p, 'Featured selects', 'Marked for marketing');
      return saveAndRefresh(p, st);
    }
    if (act === 'contract-add' && p) {
      p.contracts.push({ id: 'c_' + Date.now(), title: 'Service Agreement', status: 'draft' });
      addActivity(p, 'Contract added', 'Draft');
      return saveAndRefresh(p, st);
    }
    if (act === 'invoice-add' && p) {
      p.invoices.push({ id: 'i_' + Date.now(), label: 'Balance', kind: 'balance', status: 'draft', amount_cents: p.outstanding_cents || 0 });
      p.invoice_status = 'draft';
      addActivity(p, 'Invoice added', 'Draft');
      return saveAndRefresh(p, st);
    }
    if (act === 'q-send' && p) {
      p.questionnaire.status = 'sent';
      addActivity(p, 'Questionnaire sent', p.client_email || p.client_name || '');
      return saveAndRefresh(p, st);
    }
    if (act === 'q-complete' && p) {
      p.questionnaire.status = 'completed';
      return saveAndRefresh(p, st);
    }
    if (act === 'mkt-ready' && p) {
      var ch = t.getAttribute('data-pp-ch');
      (p.marketing || []).forEach(function (m) { if (m.channel === ch) m.status = 'ready'; });
      return saveAndRefresh(p, st);
    }
    if (act === 'media-import-drive' && p) {
      toast('Google Drive import — connect Drive from Apps, then import into this project.');
      return openAppsView();
    }
    if (act === 'open-apps') {
      return openAppsView();
    }
  }

  function openAppsView() {
    try {
      var appsNav = document.querySelector('.ni[data-v="apps"]');
      if (appsNav && typeof global.switchV === 'function') {
        global.switchV(appsNav);
        return;
      }
    } catch (e) {}
    toast('Open Apps from the sidebar to connect tools.');
  }

  function applyLightroomMediaPatches(p, patches) {
    if (!p || !patches || !patches.length) return;
    p.workspace = p.workspace || defaultWorkspace();
    p.local_uploads = p.local_uploads || p.workspace.local_uploads || [];
    var byId = {};
    patches.forEach(function (patch) {
      if (patch && patch.id) byId[String(patch.id)] = patch;
    });
    p.local_uploads.forEach(function (item) {
      var patch = byId[String(item.id || '')];
      if (!patch) return;
      Object.keys(patch).forEach(function (k) {
        if (k === 'id') return;
        item[k] = patch[k];
      });
    });
    p.workspace.local_uploads = p.local_uploads;
  }

  /**
   * Upload Hubly Media photos to the linked Lightroom album.
   * Uploads pending items one-by-one for progress toasts; skips already-uploaded.
   */
  async function uploadProjectMediaToLightroom(p, st, opts) {
    opts = opts || {};
    var svcUp = global.AdobeLightroomService;
    if (!svcUp || !(svcUp.uploadToLightroom || svcUp.uploadPhotos)) {
      toast('Adobe Lightroom isn’t ready yet.');
      return;
    }
    var sync = lightroomSyncMeta(p);
    var albumId = sync.albumId || (getWorkspace(p, 'adobe_lightroom') || {}).external_id;
    if (!albumId) {
      toast('Link a Lightroom album before uploading.');
      return switchCommandTab('lightroom');
    }
    p.workspace = p.workspace || defaultWorkspace();
    p.local_uploads = p.local_uploads || p.workspace.local_uploads || [];
    var pending = p.local_uploads.filter(function (u) {
      if (mediaKind(u) !== 'photo') return false;
      if (u.lightroom_asset_id && u.lightroom_upload_status === 'uploaded') return false;
      if (!isDurableMediaUrl(u.url) && !isDurableMediaUrl(u.previewUrl)) return false;
      return true;
    });
    if (opts.onlyIds && opts.onlyIds.length) {
      var only = {};
      opts.onlyIds.forEach(function (id) { only[String(id)] = true; });
      pending = pending.filter(function (u) { return only[String(u.id)]; });
    }
    if (!pending.length) {
      if (!opts.silent) toast('Nothing new to upload — all eligible photos are already in Lightroom.');
      return;
    }

    st.lrUploadProgress = { total: pending.length, done: 0, failed: 0, uploaded: 0 };
    if (!opts.silent) toast('Uploading ' + pending.length + ' photo(s) to Lightroom…');
    switchCommandTab(st.tab === 'lightroom' ? 'lightroom' : 'media');

    var uploadFn = svcUp.uploadToLightroom || svcUp.uploadPhotos;
    var i;
    for (i = 0; i < pending.length; i++) {
      var item = pending[i];
      item.lightroom_upload_status = 'uploading';
      item.lightroom_upload_error = null;
      p.workspace.local_uploads = p.local_uploads;
      if (st.tab === 'media' || st.tab === 'lightroom') switchCommandTab(st.tab);

      var upRes = await uploadFn.call(svcUp, {
        businessId: businessId() || '',
        projectId: p.id,
        albumId: albumId,
        catalogId: sync.catalogId || undefined,
        fileRefs: [item.id],
        silent: true
      });

      if (upRes && upRes.data && Array.isArray(upRes.data.mediaPatches)) {
        applyLightroomMediaPatches(p, upRes.data.mediaPatches);
      } else if (upRes && upRes.ok && upRes.data && upRes.data.results && upRes.data.results[0]) {
        var r0 = upRes.data.results[0];
        if (r0.lightroomAssetId) {
          item.lightroom_asset_id = r0.lightroomAssetId;
          item.lightroom_upload_status = 'uploaded';
          item.lightroom_uploaded_at = new Date().toISOString();
          item.lightroom_upload_error = null;
        }
      } else if (!upRes || !upRes.ok) {
        item.lightroom_upload_status = 'failed';
        item.lightroom_upload_error = (upRes && upRes.message) || 'Upload failed';
        st.lrUploadProgress.failed += 1;
      }

      if (item.lightroom_upload_status === 'uploaded' || item.lightroom_upload_status === 'skipped_duplicate' ||
          item.lightroom_upload_status === 'already_uploaded') {
        st.lrUploadProgress.uploaded += 1;
      } else if (item.lightroom_upload_status === 'failed' || item.lightroom_upload_status === 'unsupported') {
        st.lrUploadProgress.failed += 1;
      }
      st.lrUploadProgress.done += 1;
      p.workspace.local_uploads = p.local_uploads;
      if (!opts.silent && pending.length > 1) {
        toast('Lightroom upload ' + st.lrUploadProgress.done + '/' + st.lrUploadProgress.total);
      }
    }

    addActivity(p, 'Uploaded to Lightroom',
      st.lrUploadProgress.uploaded + ' ok · ' + st.lrUploadProgress.failed + ' failed');
    if (!opts.silent) {
      toast(
        (st.lrUploadProgress.uploaded ? (st.lrUploadProgress.uploaded + ' uploaded to Lightroom') : 'Upload finished') +
        (st.lrUploadProgress.failed ? (' · ' + st.lrUploadProgress.failed + ' failed') : '')
      );
    }
    st.lrUploadProgress = null;
    return saveAndRefresh(p, st);
  }

  async function ensureAdobeStatus(st, force, opts) {
    st = st || {};
    opts = opts || {};
    if (!force && st.adobeStatus && st.adobeStatus._at && (Date.now() - st.adobeStatus._at) < 30000) {
      return st.adobeStatus;
    }
    var svc = global.AdobeLightroomService;
    if (!svc || !svc.viewConnectionStatus) return null;
    try {
      var res = await svc.viewConnectionStatus({
        businessId: businessId() || '',
        quick: !!opts.quick,
      });
      st.adobeStatus = Object.assign({}, res || {}, { _at: Date.now(), _quick: !!opts.quick });
      return st.adobeStatus;
    } catch (e) {
      return null;
    }
  }

  /** Open Lightroom tab instantly; hydrate Adobe status without blocking the click. */
  function refreshLightroomStatusInBackground(st) {
    st = st || {};
    if (st._lrStatusBusy) return;
    st._lrStatusBusy = true;
    var hadCache = !!(st.adobeStatus && st.adobeStatus.data);
    // Fast DB status first (no Adobe catalog round-trip), then optional full verify.
    ensureAdobeStatus(st, !hadCache, { quick: true }).then(function () {
      if (st.tab === 'lightroom') switchCommandTab('lightroom');
      return ensureAdobeStatus(st, true, { quick: false });
    }).then(function () {
      if (st.tab === 'lightroom') switchCommandTab('lightroom');
    }).catch(function () { /* keep cached UI */ }).then(function () {
      st._lrStatusBusy = false;
    });
  }

  async function ingestMediaFiles(projectId, fileList, kindHint) {
    var root = el('jos-photo-projects-root');
    if (!root) return;
    var st = getState(root);
    var p = findProject(projectId);
    if (!p || !fileList || !fileList.length) return;
    if (!ensureBusinessForSave()) return;

    p.workspace = p.workspace || defaultWorkspace();
    p.local_uploads = p.local_uploads || p.workspace.local_uploads || [];
    var db = await dbClient();
    var ownerId = authOwnerId();
    var bid = businessId() || 'anon';
    var added = 0;
    var rawNoPreview = 0;
    var uploadFail = 0;
    var stored = 0;

    for (var i = 0; i < fileList.length; i++) {
      var file = fileList[i];
      if (!file) continue;
      var preview = await buildMediaPreview(file);
      if (preview.isRaw && preview.previewSource === 'raw_none') rawNoPreview += 1;
      var item = {
        id: 'up_' + Date.now().toString(36) + '_' + i,
        name: file.name || ('file-' + (i + 1)),
        size: file.size || 0,
        type: file.type || kindHint || 'application/octet-stream',
        previewUrl: '',
        previewSource: preview.previewSource || 'none',
        isRaw: !!preview.isRaw,
        url: '',
        added_at: new Date().toISOString()
      };
      // Store browser-safe JPEG/PNG in brand-assets under auth.uid() (RLS). Full RAW files are
      // rejected by the bucket — upload the extracted preview instead so tiles survive refresh.
      if (db && db.storage && ownerId) {
        try {
          var uploadBlob = null;
          var uploadName = file.name || 'file';
          var contentType = file.type || undefined;
          if (preview.isRaw && preview.previewBlob) {
            uploadBlob = preview.previewBlob;
            uploadName = String(file.name || 'raw').replace(/\.[^.]+$/, '') + '_preview.jpg';
            contentType = 'image/jpeg';
          } else if (!preview.isRaw && file.type && file.type.indexOf('image/') === 0) {
            uploadBlob = file;
          }
          // brand-assets only allows image/* — skip video/docs for storage previews.
          if (uploadBlob && contentType && contentType.indexOf('image/') !== 0 &&
              !(preview.isRaw && preview.previewBlob)) {
            uploadBlob = null;
          }
          if (uploadBlob) {
            // Path must start with auth.uid() — businessId fails RLS silently.
            var path = ownerId + '/projects/' + (bid || 'biz') + '/' + p.id + '/' +
              Date.now() + '_' + String(uploadName).replace(/[^\w.\-]+/g, '_');
            var up = await db.storage.from('brand-assets').upload(path, uploadBlob, {
              upsert: false,
              contentType: contentType || 'image/jpeg'
            });
            if (!up.error) {
              var pub = db.storage.from('brand-assets').getPublicUrl(path);
              item.url = (pub && pub.data && pub.data.publicUrl) || '';
              if (item.url) {
                item.previewUrl = item.url;
                stored += 1;
              }
            } else {
              uploadFail += 1;
              try { console.warn('Projects media upload failed', up.error); } catch (eLog) {}
            }
          }
        } catch (eUp) {
          uploadFail += 1;
          try { console.warn('Projects media upload exception', eUp); } catch (eLog2) {}
        }
      } else if (!ownerId) {
        uploadFail += 1;
      }
      // Session-only blob for immediate UI if storage failed — stripped before persist below.
      if (!item.previewUrl && preview.previewUrl) {
        item.previewUrl = preview.previewUrl;
      }
      p.local_uploads.push(item);
      added += 1;
    }
    // Never persist ephemeral blob:/data: URLs — they blank out after refresh.
    p.local_uploads.forEach(function (u) {
      if (!isDurableMediaUrl(u.previewUrl)) u.previewUrl = isDurableMediaUrl(u.url) ? u.url : '';
      if (!isDurableMediaUrl(u.url)) u.url = '';
    });
    p.workspace.local_uploads = p.local_uploads;
    p.photo_count = p.local_uploads.length;
    addActivity(p, 'Media added', added + ' file' + (added === 1 ? '' : 's'));
    var msg = added + ' file' + (added === 1 ? '' : 's') + ' added to Media';
    if (stored) msg += ' · ' + stored + ' preview' + (stored === 1 ? '' : 's') + ' saved';
    if (rawNoPreview) {
      msg += ' · ' + rawNoPreview + ' RAW without embedded preview';
    }
    if (uploadFail && !stored) {
      msg += ' · previews not stored — stay signed in and re-upload';
    } else if (uploadFail) {
      msg += ' · ' + uploadFail + ' preview store failed';
    }
    toast(msg);
    st.view = 'command';
    st.projectId = p.id;
    st.tab = 'media';
    await saveAndRefresh(p, st);

    // Optional automation: push new photos to linked Lightroom album in the background.
    if (p.workspace && p.workspace.auto_upload_to_lightroom && stored) {
      var newIds = p.local_uploads.slice(-added).map(function (u) { return u.id; });
      uploadProjectMediaToLightroom(p, st, { onlyIds: newIds, silent: false }).catch(function () {});
    }
    return;
  }

  function onChange(e) {
    var t = e.target;
    var root = el('jos-photo-projects-root');
    if (!root) return;
    var st = getState(root);
    var p, idx;

    if (t.hasAttribute('data-pp-field')) {
      st[t.getAttribute('data-pp-field')] = t.value;
      persistUiPrefs(st);
      return refreshProjectsView();
    }
    if (t.hasAttribute('data-pp-w')) {
      setWizardPath(st.wizard || (st.wizard = blankWizard()), t.getAttribute('data-pp-w'), t.value);
      return;
    }
    if (t.hasAttribute('data-pp-asset')) {
      var w = st.wizard || (st.wizard = blankWizard());
      w.assets[t.getAttribute('data-pp-asset')] = !!t.checked;
      return;
    }
    if (t.hasAttribute('data-pp-quick-files')) {
      st.quick = st.quick || { name: '', files: [] };
      st.quick.files = Array.prototype.slice.call(t.files || []);
      return refreshProjectsView();
    }
    if (t.hasAttribute('data-pp-media-files')) {
      var mediaId = t.getAttribute('data-pp-id');
      var files = Array.prototype.slice.call(t.files || []);
      t.value = '';
      return ingestMediaFiles(mediaId, files, t.getAttribute('data-pp-kind') || 'any');
    }
    if (t.getAttribute('data-pp-act') === 'set-status') {
      p = findProject(t.getAttribute('data-pp-id'));
      if (!p) return;
      p.status = t.value;
      if (p.status === 'Editing' || p.status === 'Proofing') {
        addActivity(p, 'Status changed', p.status);
      }
      if ((p.editing_progress || 0) >= 100 || p.status === 'Proofing') {
        addActivity(p, 'Post-edit pipeline armed', POST_EDIT_PIPELINE.join(' → '));
      }
      addActivity(p, 'Status changed', p.status);
      return saveAndRefresh(p, st);
    }
    if (t.getAttribute('data-pp-act') === 'tl-toggle') {
      p = findProject(t.getAttribute('data-pp-id'));
      idx = Number(t.getAttribute('data-pp-tl'));
      if (p && p.timeline[idx]) {
        p.timeline[idx].completed = !!t.checked;
        p.timeline[idx].occurred_at = t.checked ? new Date().toISOString() : null;
        return saveAndRefresh(p, st);
      }
    }
    if (t.getAttribute('data-pp-act') === 'tl-date') {
      p = findProject(t.getAttribute('data-pp-id'));
      idx = Number(t.getAttribute('data-pp-tl'));
      if (p && p.timeline[idx]) {
        p.timeline[idx].occurred_at = t.value ? new Date(t.value).toISOString() : null;
        return saveAndRefresh(p, st);
      }
    }
    if (t.getAttribute('data-pp-act') === 'gal-wm') {
      p = findProject(t.getAttribute('data-pp-id'));
      if (p && p.gallery) {
        p.gallery.watermark = p.gallery.watermark || {};
        p.gallery.watermark.enabled = !!t.checked;
        return saveAndRefresh(p, st);
      }
    }
    if (t.getAttribute('data-pp-act') === 'lr-auto-upload') {
      p = findProject(t.getAttribute('data-pp-id'));
      if (p) {
        p.workspace = p.workspace || defaultWorkspace();
        p.workspace.auto_upload_to_lightroom = !!t.checked;
        return saveAndRefresh(p, st);
      }
    }
    if (t.getAttribute('data-pp-act') === 'del-status') {
      p = findProject(t.getAttribute('data-pp-id'));
      idx = Number(t.getAttribute('data-pp-del'));
      if (p && p.deliverables[idx]) {
        p.deliverables[idx].status = t.value;
        return saveAndRefresh(p, st);
      }
    }
    if (t.getAttribute('data-pp-act') === 'edit-progress') {
      p = findProject(t.getAttribute('data-pp-id'));
      if (p) {
        p.editing_progress = Number(t.value) || 0;
        if (p.editing_progress >= 100) {
          addActivity(p, 'Editing finished', 'Media ready for gallery → creative → marketing');
        }
        return saveAndRefresh(p, st);
      }
    }
  }

  function onInput(e) {
    var t = e.target;
    var root = el('jos-photo-projects-root');
    if (!root) return;
    var st = getState(root);
    if (t.getAttribute('data-pp-field') === 'search') {
      st.search = t.value;
      persistUiPrefs(st);
      clearTimeout(root._ppSearchT);
      root._ppSearchT = setTimeout(function () { refreshProjectsView(); }, 180);
      return;
    }
    if (t.hasAttribute('data-pp-quick')) {
      st.quick = st.quick || { name: '', files: [] };
      st.quick[t.getAttribute('data-pp-quick')] = t.value;
      return;
    }
    if (t.hasAttribute('data-pp-w')) {
      setWizardPath(st.wizard || (st.wizard = blankWizard()), t.getAttribute('data-pp-w'), t.value);
      return;
    }
    var act = t.getAttribute('data-pp-act');
    var p = findProject(t.getAttribute('data-pp-id'));
    if (!p) return;
    if (act === 'tl-label' || act === 'tl-notes') {
      var idx = Number(t.getAttribute('data-pp-tl'));
      if (p.timeline[idx]) {
        if (act === 'tl-label') p.timeline[idx].label = t.value;
        else p.timeline[idx].notes = t.value;
        clearTimeout(root._ppSaveT);
        root._ppSaveT = setTimeout(function () { saveAndRefresh(p, st); }, 500);
      }
    }
    if (act === 'notes') {
      p.notes = t.value;
      clearTimeout(root._ppSaveT);
      root._ppSaveT = setTimeout(function () { saveAndRefresh(p, st); }, 500);
    }
    if (act === 'gal-wm-text') {
      p.gallery = p.gallery || {};
      p.gallery.watermark = p.gallery.watermark || {};
      p.gallery.watermark.text = t.value;
      clearTimeout(root._ppSaveT);
      root._ppSaveT = setTimeout(function () { saveAndRefresh(p, st); }, 500);
    }
  }

  function setWizardPath(obj, path, value) {
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] = cur[parts[i]] || {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }

  /* ─── Nav / exports ─────────────────────────────────────────────────── */

  function syncProjectsNav() {
    var nav = document.querySelector('.ni[data-v="photo-projects"], .ni[data-v="projects"]');
    if (!nav) return;
    // Media is a core Hubly module — always visible.
    nav.hidden = false;
    nav.setAttribute('aria-hidden', 'false');
    nav.classList.remove('jos-nav-hidden');
    var lbl = nav.querySelector('.ni-lbl');
    if (lbl) lbl.textContent = 'Media';
    nav.setAttribute('title', 'Media');
  }
  // Back-compat alias
  function syncPhotographyNav() { return syncProjectsNav(); }

  function openQuickProject() {
    var nav = document.querySelector('.ni[data-v="photo-projects"], .ni[data-v="projects"]');
    if (nav && typeof global.switchV === 'function') global.switchV(nav);
    setTimeout(function () {
      var root = el('jos-photo-projects-root');
      if (!root) return;
      var st = getState(root);
      st.quickOpen = true;
      st.quick = { name: '', files: [] };
      st.view = 'dashboard';
      refreshProjectsView();
    }, 60);
  }

  function attach() {
    var api = {
      render: renderPhotoProjects,
      remount: function () { return renderPhotoProjects({ force: true }); },
      refresh: refreshProjectsView,
      switchTab: switchCommandTab,
      syncNav: syncProjectsNav,
      setMode: setPhotoProjectsMode,
      openQuick: openQuickProject,
      openQuickProject: openQuickProject,
      hasCapability: hasProjectsCapability,
      hasLightroom: hasLightroomCapability,
      reload: function () { return loadProjectsFromSupabase(true); }
    };
    // Public name: HublyMedia. Legacy aliases kept for existing call sites.
    global.HublyMedia = api;
    global.HublyProjects = api;
    global.HublyPhotographyProjects = api;
    if (global.HublyJourneyOS) {
      global.HublyJourneyOS.renderPhotoProjects = renderPhotoProjects;
      global.HublyJourneyOS.renderProjects = renderPhotoProjects;
      global.HublyJourneyOS.syncPhotographyNav = syncProjectsNav;
      global.HublyJourneyOS.syncProjectsNav = syncProjectsNav;
      global.HublyJourneyOS.setPhotoProjectsMode = setPhotoProjectsMode;
      global.HublyJourneyOS.setProjectsMode = setPhotoProjectsMode;
      global.HublyJourneyOS.openPhotographyQuickProject = openQuickProject;
      global.HublyJourneyOS.openProjectsQuick = openQuickProject;
    }
    syncProjectsNav();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
  else attach();
  setTimeout(attach, 0);
  setTimeout(attach, 500);
  setTimeout(syncProjectsNav, 800);
  setTimeout(syncProjectsNav, 2000);
  global.addEventListener('hubly:business-loaded', function () {
    _cache.loaded = false;
    syncProjectsNav();
  });
  global.addEventListener('hubly:blueprint-changed', syncProjectsNav);
})(typeof window !== 'undefined' ? window : globalThis);
