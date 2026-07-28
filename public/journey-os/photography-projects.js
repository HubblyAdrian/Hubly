/**
 * Hubly Photography Projects — Operate module
 * Independent of Jobs. Supabase is SSOT for project records.
 * localStorage may ONLY cache UI preferences (sort, filters, tab).
 *
 * Connected Apps (product): Projects attach providers (Lightroom, Canva,
 * Dropbox, Drive, …). Internal rows may live in photography_project_workspaces.
 * Hubly Core owns the Connected Apps + Creative engines — reusable by every industry.
 * Gated by businesses.capabilities.projects (not trade heuristics).
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
  var TIMELINE_DEFAULTS = [
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
    { id: 'marketing', label: 'AI Marketing Workflow' },
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
    if (d == null) return 'No shoot date';
    if (d === 0) return 'Shoot today';
    if (d > 0) return d + ' day' + (d === 1 ? '' : 's') + ' to shoot';
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
    return (global.currentBusiness && global.currentBusiness.id) ||
      S().businessId || S().bizId || null;
  }
  async function dbClient() {
    if (typeof global.waitForDb === 'function') return global.waitForDb(8000);
    return global._hublyDb || (global.window && global.window._hublyDb) || null;
  }

  /* ─── Capabilities (Runtime-style) ──────────────────────────────────── */

  function businessCapabilities() {
    var biz = global.currentBusiness || {};
    var caps = Object.assign({}, S().capabilities || {}, biz.capabilities || {});
    return caps;
  }
  function hasCapability(key) {
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
    return hasCapability('projects');
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
      timeline: TIMELINE_DEFAULTS.map(function (t, i) {
        return Object.assign({}, t, {
          id: 'tl_' + i,
          completed: false,
          occurred_at: null,
          notes: '',
          sort_order: i
        });
      }),
      gallery: {
        ai_favorites: [],
        albums: [{ name: 'All Photos', count: 0 }, { name: 'Selects', count: 0 }],
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
      deliverables: [
        { id: 'd_gallery', title: 'Client Gallery', kind: 'gallery', status: 'pending' },
        { id: 'd_selects', title: 'Edited Selects', kind: 'cloud', status: 'pending' }
      ],
      marketing: MARKETING_CHANNELS.map(function (c) {
        return Object.assign({}, c, { status: 'idle', body: '' });
      }),
      activity: [],
      shot_list: [],
      local_uploads: [],
      workspaces: []
    }, partial || {});
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
      console.warn('Photography projects load failed', err);
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
    if (!bid) throw new Error('Sign in and open a business to save projects.');
    var db = await dbClient();
    if (!db) throw new Error('Hubly could not reach the database.');
    var row = projectToRow(p);
    row.business_id = bid;
    var res = await db.from('photography_projects').insert(row).select('*').single();
    if (res.error) throw res.error;
    var created = rowToProject(res.data);
    created.workspaces = p.workspaces || [];
    // Ensure a pending Lightroom Connected App link exists (optional until connected).
    upsertWorkspaceLocal(created, {
      provider: 'adobe_lightroom',
      display_name: created.name,
      sync_state: 'pending',
      metadata: { album_name: created.name }
    });
    await upsertExternalWorkspace(db, created, getWorkspace(created, 'adobe_lightroom'));
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
  }
  function getState(root) {
    var prefs = loadPrefs();
    root._pp = root._pp || {
      view: 'dashboard',
      projectId: null,
      tab: prefs.lastTab || 'overview',
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
      lastTab: st.tab
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
          '<div class="pp-card-row"><span class="pp-label">Shoot</span><strong>' + esc(formatDate(p.shoot_date)) + '</strong></div>' +
          '<div class="pp-card-pills">' +
            '<span class="pp-pill">' + esc(lrLabel(p.lightroom_status)) + '</span>' +
            '<span class="pp-pill">' + esc(galLabel(p.gallery_status)) + '</span>' +
            '<span class="pp-pill">' + esc(invLabel(p.invoice_status)) + '</span>' +
          '</div>' +
          '<div class="pp-card-stats">' +
            '<div><span class="pp-label">Photos</span><strong>' + esc(String(p.photo_count || 0)) + '</strong></div>' +
            '<div><span class="pp-label">Last sync</span><strong>' + esc(formatRelative(p.last_sync_at)) + '</strong></div>' +
          '</div>' +
          '<div class="pp-card-actions" onclick="event.stopPropagation()">' +
            '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="open" data-pp-id="' + esc(p.id) + '">Open</button>' +
            '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="sync" data-pp-id="' + esc(p.id) + '">Sync Lightroom</button>' +
            '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="gallery" data-pp-id="' + esc(p.id) + '">Gallery</button>' +
            '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="invoice" data-pp-id="' + esc(p.id) + '">Invoice</button>' +
            '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="deliver" data-pp-id="' + esc(p.id) + '">Deliver</button>' +
          '</div></div></article>';
    }).join('');

    return '<div class="pp-shell pp-dash">' +
      '<header class="pp-dash-head">' +
        '<div><p class="pp-eyebrow">Photography</p><h1 class="pp-title">Photography Projects</h1>' +
        '<p class="pp-sub">Open the project — Connected Apps (Lightroom, Canva, Drive…) sync to Hubly.</p></div>' +
        '<div class="pp-dash-actions">' +
          '<button type="button" class="pp-btn pp-btn-ghost pp-btn-lg" data-pp-act="quick">Quick Project</button>' +
          '<button type="button" class="pp-btn pp-btn-brand pp-btn-lg" data-pp-act="new">+ New Project</button>' +
        '</div></header>' +
      '<div class="pp-metrics">' +
        metric('Projects', String(m.projects)) +
        metric('Editing', String(m.editing)) +
        metric('Awaiting Delivery', String(m.awaiting)) +
        metric('Revenue', money(m.revenue)) +
        metric('Images', Number(m.images).toLocaleString()) +
      '</div>' +
      '<div class="pp-toolbar">' +
        '<label class="pp-search"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
          '<input type="search" placeholder="Search projects, clients…" value="' + esc(st.search) + '" data-pp-field="search"></label>' +
        '<select data-pp-field="statusFilter" aria-label="Status"><option value="all">All statuses</option>' +
          STATUSES.map(function (s) { return '<option value="' + esc(s) + '"' + (st.statusFilter === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') +
        '</select>' +
        '<select data-pp-field="dateFilter" aria-label="Date">' +
          '<option value="all"' + (st.dateFilter === 'all' ? ' selected' : '') + '>Any date</option>' +
          '<option value="upcoming"' + (st.dateFilter === 'upcoming' ? ' selected' : '') + '>Upcoming</option>' +
          '<option value="this_month"' + (st.dateFilter === 'this_month' ? ' selected' : '') + '>This month</option>' +
          '<option value="past"' + (st.dateFilter === 'past' ? ' selected' : '') + '>Past</option></select>' +
        '<select data-pp-field="photographerFilter" aria-label="Photographer"><option value="all">All photographers</option>' +
          photogs.map(function (n) { return '<option value="' + esc(n) + '"' + (st.photographerFilter === n ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') +
        '</select>' +
        '<select data-pp-field="sort" aria-label="Sort">' +
          '<option value="shoot_date_desc"' + (st.sort === 'shoot_date_desc' ? ' selected' : '') + '>Shoot date ↓</option>' +
          '<option value="shoot_date_asc"' + (st.sort === 'shoot_date_asc' ? ' selected' : '') + '>Shoot date ↑</option>' +
          '<option value="name"' + (st.sort === 'name' ? ' selected' : '') + '>Name</option>' +
          '<option value="status"' + (st.sort === 'status' ? ' selected' : '') + '>Status</option>' +
          '<option value="updated"' + (st.sort === 'updated' ? ' selected' : '') + '>Recently updated</option></select>' +
      '</div>' +
      (st.error ? '<div class="pp-banner-error">' + esc(st.error) + '</div>' : '') +
      (filtered.length
        ? '<div class="pp-grid">' + cards + '</div>'
        : '<div class="pp-empty"><div class="pp-empty-art" aria-hidden="true"></div>' +
          '<h2>No projects yet</h2>' +
          '<p>Create a project in about 30 seconds — or run the full wizard. Adobe Lightroom is optional.</p>' +
          '<div class="pp-btn-row" style="justify-content:center">' +
          '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="quick">Quick Project</button>' +
          '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="new">+ New Project</button></div></div>') +
      (st.quickOpen ? renderQuickModal(st) : '') +
      '</div>';
  }

  function metric(label, value) {
    return '<div class="pp-metric"><span class="pp-metric-label">' + esc(label) + '</span><strong class="pp-metric-value">' + esc(value) + '</strong></div>';
  }

  function renderQuickModal(st) {
    var q = st.quick || { name: '', files: [] };
    return '<div class="pp-modal-bg" data-pp-act="quick-close">' +
      '<div class="pp-modal" onclick="event.stopPropagation()">' +
        '<div class="pp-modal-h"><h2>Quick Project</h2><button type="button" class="pp-icon-x" data-pp-act="quick-close" aria-label="Close">×</button></div>' +
        '<p class="pp-muted">Name it, add photos, done — about 30 seconds. Saved to Hubly immediately.</p>' +
        '<label class="pp-field pp-field-full"><span>Project Name</span>' +
          '<input type="text" data-pp-quick="name" value="' + esc(q.name) + '" placeholder="Johnson Wedding" autofocus></label>' +
        '<label class="pp-field pp-field-full"><span>Upload Photos</span>' +
          '<input type="file" accept="image/*" multiple data-pp-quick-files>' +
          '<small class="pp-muted">' + (q.files && q.files.length ? q.files.length + ' selected' : 'Optional — add later from the project') + '</small></label>' +
        '<div class="pp-wizard-foot">' +
          '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="quick-close">Cancel</button>' +
          '<button type="button" class="pp-btn pp-btn-brand pp-btn-lg" data-pp-act="quick-create">Done</button>' +
        '</div></div></div>';
  }

  /* ─── Wizard ────────────────────────────────────────────────────────── */

  function blankWizard() {
    return {
      name: '', project_type: 'Portrait', shoot_date: '', location: '', estimated_photos: '', notes: '',
      client_mode: 'new', client_name: '', client_email: '', client_phone: '', client_address: '',
      client_relationship: '', existing_client: '',
      team: { lead: '', second: '', assistant: '', editor: '' },
      assets: {
        lightroom: true, folder: true, contract: true, invoice: true,
        questionnaire: true, timeline: true, shot_list: true, gallery: true, marketing: true, canva: true
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
    var clients = Array.from(new Set(list.map(function (p) { return p.client_name; }).filter(Boolean)));
    var body = '';
    if (step === 1) {
      body = '<div class="pp-form-grid">' +
        field('Project Name', '<input type="text" data-pp-w="name" value="' + esc(w.name) + '" placeholder="Elena & Marcus Wedding">') +
        field('Project Type', '<select data-pp-w="project_type">' + PROJECT_TYPES.map(function (t) {
          return '<option' + (w.project_type === t ? ' selected' : '') + '>' + esc(t) + '</option>';
        }).join('') + '</select>') +
        field('Shoot Date', '<input type="date" data-pp-w="shoot_date" value="' + esc(w.shoot_date) + '">') +
        field('Location', '<input type="text" data-pp-w="location" value="' + esc(w.location) + '">') +
        field('Estimated Photos', '<input type="number" min="0" data-pp-w="estimated_photos" value="' + esc(w.estimated_photos) + '">') +
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
    } else if (step === 3) {
      body = '<div class="pp-form-grid">' +
        field('Lead Photographer', '<input type="text" data-pp-w="team.lead" value="' + esc(w.team.lead) + '">') +
        field('Second Shooter', '<input type="text" data-pp-w="team.second" value="' + esc(w.team.second) + '">') +
        field('Assistant', '<input type="text" data-pp-w="team.assistant" value="' + esc(w.team.assistant) + '">') +
        field('Editor', '<input type="text" data-pp-w="team.editor" value="' + esc(w.team.editor) + '">') + '</div>';
    } else {
      body = '<p class="pp-help">Hubly prepares the project OS. Connect Adobe Lightroom, Canva, Dropbox, and more later — the Project stays primary.</p><div class="pp-checks">' +
        CREATE_ASSETS.map(function (a) {
          return '<label class="pp-check"><input type="checkbox" data-pp-asset="' + a.id + '"' + (w.assets[a.id] ? ' checked' : '') + '>' +
            '<span><strong>' + esc(a.label) + '</strong>' + (a.hint ? '<small>' + esc(a.hint) + '</small>' : '') + '</span></label>';
        }).join('') + '</div>';
    }
    return '<div class="pp-shell pp-wizard"><button type="button" class="pp-back" data-pp-act="wiz-cancel">← Projects</button>' +
      '<div class="pp-wizard-card"><div class="pp-steps">' +
      [1, 2, 3, 4].map(function (n) {
        var labels = ['Details', 'Client', 'Team', 'Assets'];
        return '<div class="pp-step' + (n === step ? ' on' : '') + (n < step ? ' done' : '') + '"><i>' + n + '</i><span>' + labels[n - 1] + '</span></div>';
      }).join('') + '</div>' +
      '<h2 class="pp-wizard-title">' + (['', 'Project Details', 'Client', 'Team', 'Create Assets'][step] || '') + '</h2>' + body +
      '<div class="pp-wizard-foot">' +
      (step > 1 ? '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="wiz-prev">Back</button>' : '<span></span>') +
      (step < 4
        ? '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="wiz-next">Continue</button>'
        : '<button type="button" class="pp-btn pp-btn-brand pp-btn-lg" data-pp-act="wiz-create">Create Project</button>') +
      '</div></div></div>';
  }

  /* ─── Command Center ────────────────────────────────────────────────── */

  function kpi(label, value) {
    return '<div class="pp-kpi"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong></div>';
  }
  function renderCommand(root, st, p) {
    var tab = st.tab || 'overview';
    var tabs = [
      ['overview', 'Overview'], ['timeline', 'Timeline'], ['lightroom', 'Connected Apps'],
      ['creative', 'Creative'], ['gallery', 'Gallery'], ['contracts', 'Contracts'], ['invoices', 'Invoices'],
      ['questionnaire', 'Questionnaire'], ['deliverables', 'Deliverables'],
      ['marketing', 'Marketing'], ['notes', 'Notes'], ['activity', 'Activity']
    ];
    return '<div class="pp-shell pp-cc"><button type="button" class="pp-back" data-pp-act="back-dash">← All projects</button>' +
      '<header class="pp-hero" style="' + coverStyle(p) + '"><div class="pp-hero-veil"></div><div class="pp-hero-content">' +
      '<div class="pp-hero-top"><span class="pp-status pp-status-' + statusTone(p.status) + '">' + esc(p.status) + '</span>' +
      '<select class="pp-status-select" data-pp-act="set-status" data-pp-id="' + esc(p.id) + '">' +
      STATUSES.map(function (s) { return '<option value="' + esc(s) + '"' + (p.status === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') +
      '</select></div>' +
      '<h1 class="pp-hero-title">' + esc(p.name) + '</h1>' +
      '<p class="pp-hero-sub">' + esc(p.client_name || 'No client') + ' · ' + esc(p.project_type) + ' · ' + esc(formatDate(p.shoot_date)) +
      (workspaceSummary(p) ? ' · ' + esc(workspaceSummary(p)) : '') + '</p>' +
      '<div class="pp-hero-kpis">' +
      kpi('Countdown', countdownLabel(p.shoot_date)) +
      kpi('Revenue', money(p.revenue_cents)) +
      kpi('Outstanding', money(p.outstanding_cents)) +
      kpi('Photos', String(p.photo_count || 0)) +
      kpi('Editing', (p.editing_progress || 0) + '%') +
      '</div></div></header>' +
      '<nav class="pp-tabs" role="tablist">' + tabs.map(function (t) {
        return '<button type="button" role="tab" class="pp-tab' + (tab === t[0] ? ' on' : '') + '" data-pp-act="tab" data-pp-tab="' + t[0] + '">' + esc(t[1]) + '</button>';
      }).join('') + '</nav>' +
      '<div class="pp-tab-body">' + renderTab(p, tab) + '</div></div>';
  }

  function renderTab(p, tab) {
    if (tab === 'timeline') return renderTimelineTab(p);
    if (tab === 'lightroom') return renderConnectedAppsTab(p);
    if (tab === 'creative') return renderCreativeTab(p);
    if (tab === 'gallery') return renderGalleryTab(p);
    if (tab === 'contracts') return renderContractsTab(p);
    if (tab === 'invoices') return renderInvoicesTab(p);
    if (tab === 'questionnaire') return renderQuestionnaireTab(p);
    if (tab === 'deliverables') return renderDeliverablesTab(p);
    if (tab === 'marketing') return renderMarketingTab(p);
    if (tab === 'notes') return renderNotesTab(p);
    if (tab === 'activity') return renderActivityTab(p);
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
    return '<div class="pp-panel-grid"><section class="pp-panel"><h3>Project</h3><dl class="pp-dl">' +
      '<div><dt>Location</dt><dd>' + esc(p.location || '—') + '</dd></div>' +
      '<div><dt>Type</dt><dd>' + esc(p.project_type) + '</dd></div>' +
      '<div><dt>Lead</dt><dd>' + esc((p.team && p.team.lead) || '—') + '</dd></div>' +
      '<div><dt>Connected Apps</dt><dd>' + esc(workspaceSummary(p) || 'None connected') + '</dd></div></dl>' +
      '<p class="pp-muted">' + esc(p.notes || 'No notes yet.') + '</p></section>' +
      '<section class="pp-panel"><h3>Client</h3><dl class="pp-dl">' +
      '<div><dt>Name</dt><dd>' + esc(p.client_name || '—') + '</dd></div>' +
      '<div><dt>Email</dt><dd>' + esc(p.client_email || '—') + '</dd></div>' +
      '<div><dt>Phone</dt><dd>' + esc(p.client_phone || '—') + '</dd></div></dl></section>' +
      '<section class="pp-panel"><h3>Editing progress</h3><div class="pp-progress"><i style="width:' + (p.editing_progress || 0) + '%"></i></div>' +
      '<div class="pp-progress-meta"><span>' + (p.editing_progress || 0) + '% complete</span>' +
      '<input type="range" min="0" max="100" value="' + (p.editing_progress || 0) + '" data-pp-act="edit-progress" data-pp-id="' + esc(p.id) + '"></div></section>' +
      '<section class="pp-panel"><h3>Quick actions</h3><div class="pp-btn-row">' +
      '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="tab" data-pp-tab="lightroom">Lightroom</button>' +
      '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="tab" data-pp-tab="gallery">Gallery</button>' +
      '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="deliver" data-pp-id="' + esc(p.id) + '">Deliver</button></div></section></div>';
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
    var lr = p.lightroom || {};
    var lrWs = getWorkspace(p, 'adobe_lightroom');
    var adobeConnected = lrWs && (lrWs.sync_state === 'linked' || lrWs.sync_state === 'synced');

    var hero = '<section class="pp-lr-hero">' +
      '<div class="pp-lr-hero-copy">' +
        '<p class="pp-eyebrow">Connected Apps</p>' +
        '<h2>Connect the tools you already use</h2>' +
        '<p class="pp-lr-lead">Hubly stays the home for ' + esc(p.name) + '.</p>' +
        '<p>Connect Adobe Lightroom, Canva, Dropbox, and more — then keep working inside this project.</p>' +
        '<div class="pp-btn-row">' +
          '<button type="button" class="pp-btn pp-btn-brand pp-btn-lg" data-pp-act="adobe-connect">Connect Adobe</button>' +
          '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="canva-connect">Connect Canva</button>' +
          '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="tab" data-pp-tab="creative">Open Creative</button>' +
        '</div>' +
      '</div>' +
      '<div class="pp-lr-hero-side">' +
        '<div class="pp-lr-twin">' +
          '<div><span class="pp-label">Hubly Project</span><strong>' + esc(p.name) + '</strong><small>Primary record</small></div>' +
          '<div class="pp-lr-twin-join" aria-hidden="true">↔</div>' +
          '<div><span class="pp-label">Connected Apps</span><strong>' + esc(workspaceSummary(p) || 'None yet') + '</strong><small>Editing · Creative · Storage</small></div>' +
        '</div>' +
      '</div></section>';

    var providers = '<section class="pp-panel pp-panel-wide"><h3>Connected Apps</h3>' +
      '<p class="pp-muted">A project can connect multiple apps. Actions come from each app\u2019s capabilities.</p>' +
      '<div class="pp-ws-grid">' +
      WORKSPACE_PROVIDERS.map(function (prov) {
        var w = getWorkspace(p, prov.id);
        var connected = w && (w.sync_state === 'linked' || w.sync_state === 'synced' || w.sync_state === 'pending');
        var mark = connected ? '\u2713 Connected' : (prov.available ? '\u25cb Connect' : '\u25cb Soon');
        var act = connectActionForProvider(prov.id);
        return '<div class="pp-ws-card' + (connected ? ' on' : '') + '">' +
          '<div class="pp-mkt-top"><strong>' + esc(prov.label) + '</strong><span class="pp-pill">' + esc(prov.role) + '</span></div>' +
          '<p class="pp-muted">' + esc(mark) + '</p>' +
          (act
            ? '<button type="button" class="pp-btn pp-btn-ghost pp-btn-sm" data-pp-act="' + act + '">' + (connected ? 'Manage' : 'Connect') + '</button>'
            : '<button type="button" class="pp-btn pp-btn-ghost pp-btn-sm" disabled>Soon</button>') +
          '</div>';
      }).join('') +
      '</div></section>';

    var lrDetail = adobeConnected
      ? '<section class="pp-panel pp-panel-wide"><h3>Adobe Lightroom</h3><dl class="pp-dl">' +
        '<div><dt>Status</dt><dd>' + esc(lrLabel(p.lightroom_status)) + '</dd></div>' +
        '<div><dt>Album</dt><dd>' + esc(lr.album_name || '\u2014') + '</dd></div>' +
        '<div><dt>Last Sync</dt><dd>' + esc(formatRelative((lrWs && lrWs.last_sync_at) || p.last_sync_at)) + '</dd></div></dl>' +
        '<div class="pp-btn-row">' +
        '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="lr-create-album" data-pp-id="' + esc(p.id) + '">Create Lightroom Album</button>' +
        '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="sync" data-pp-id="' + esc(p.id) + '">Sync Photos</button>' +
        '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="adobe-disconnect">Disconnect</button></div></section>'
      : '';

    var after = '<section class="pp-panel pp-panel-wide pp-lr-after">' +
      '<h3>What happens after you connect?</h3>' +
      '<ul class="pp-lr-checklist">' +
      ['Create Lightroom Album', 'Upload RAW Photos', 'Sync Edited Images', 'Deliver Galleries',
        'Create Canva graphics', 'Publish Website', 'Request Reviews'].map(function (item) {
        return '<li><span class="pp-check-ico" aria-hidden="true">\u2713</span><span>' + esc(item) + '</span></li>';
      }).join('') +
      '</ul></section>';

    return hero + providers + lrDetail + after;
  }

  function connectActionForProvider(providerId) {
    if (providerId === 'canva') return 'canva-connect';
    if (providerId === 'adobe_lightroom') return 'adobe-connect';
    return '';
  }

  function renderCreativeTab(p) {
    var HubCA = global.HublyConnectedApps;
    var apps = (HubCA && HubCA.creativeApps) ? HubCA.creativeApps() : [];
    var kinds = (HubCA && HubCA.marketingKinds) ? HubCA.marketingKinds() : [];
    var planned = ((p.workspace && p.workspace.creative_requests) || []).slice().reverse();

    // Dynamic actions from every creative Connected App (not Canva-hardcoded UI).
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

    var appCards = '<div class="pp-ws-grid">' +
      (apps.length ? apps : [
        { id: 'canva', name: 'Canva', role: 'Creative' },
        { id: 'adobe_lightroom', name: 'Adobe Lightroom', role: 'Editing' },
        { id: 'frame_io', name: 'Frame.io', role: 'Review' }
      ]).map(function (a) {
        var w = getWorkspace(p, a.id);
        var connected = w && (w.sync_state === 'linked' || w.sync_state === 'synced' || w.sync_state === 'pending');
        var connectAct = connectActionForProvider(a.id);
        return '<div class="pp-ws-card' + (connected ? ' on' : '') + '">' +
          '<div class="pp-mkt-top"><strong>' + esc(a.name) + '</strong><span class="pp-pill">' + (connected ? '\u2713 Connected' : '\u25cb Connect') + '</span></div>' +
          '<p class="pp-muted">' + esc(a.role || 'Creative') + '</p>' +
          (connectAct
            ? '<button type="button" class="pp-btn pp-btn-ghost pp-btn-sm" data-pp-act="' + connectAct + '">' + (connected ? 'Manage' : 'Connect') + '</button>'
            : '<button type="button" class="pp-btn pp-btn-ghost pp-btn-sm" disabled>Soon</button>') +
          '</div>';
      }).join('') + '</div>';

    var actions = '<div class="pp-mkt-grid pp-mt">' +
      dynamicActions.map(function (k) {
        return '<div class="pp-mkt-card">' +
          '<div class="pp-mkt-top"><strong>' + esc(k.label) + '</strong><span class="pp-pill">' + esc(k.providerName || '') + '</span></div>' +
          '<p class="pp-muted">Routed through Connected Apps capabilities.</p>' +
          '<button type="button" class="pp-btn pp-btn-brand pp-btn-sm" data-pp-act="creative-create" data-pp-id="' + esc(p.id) +
          '" data-pp-kind="' + esc(k.id) + '" data-pp-provider="' + esc(k.providerId || 'canva') + '">Create</button>' +
          '</div>';
      }).join('') + '</div>';

    return '<section class="pp-panel pp-panel-wide">' +
      '<h3>Creative</h3>' +
      '<p class="pp-muted">Creative Engine is Hubly Core \u2014 every industry can use it. Providers plug in through Connected Apps.</p>' +
      appCards +
      '<h3 class="pp-mt">Create Marketing Asset</h3>' +
      '<p class="pp-muted">Hubly sends project photos, brand colors, and copy to the creative Connected App \u2014 you never start from a blank canvas.</p>' +
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

  function renderGalleryTab(p) {
    var g = p.gallery || {};
    return '<div class="pp-panel-grid"><section class="pp-panel"><h3>AI Favorites</h3>' +
      '<p class="pp-muted">' + ((g.ai_favorites && g.ai_favorites.length) ? g.ai_favorites.length + ' favorites ready' : 'AI favorites appear after editing.') + '</p>' +
      '<div class="pp-fav-grid">' + [1, 2, 3, 4].map(function () { return '<div class="pp-fav-ph"></div>'; }).join('') + '</div></section>' +
      '<section class="pp-panel"><h3>Albums</h3><ul class="pp-queue">' + (g.albums || []).map(function (a) {
        return '<li><strong>' + esc(a.name) + '</strong><span>' + esc(String(a.count || 0)) + ' photos</span></li>';
      }).join('') + '</ul></section>' +
      '<section class="pp-panel"><h3>Client &amp; Private</h3><dl class="pp-dl">' +
      '<div><dt>Client Gallery</dt><dd>' + (g.client_gallery ? 'On' : 'Off') + '</dd></div>' +
      '<div><dt>Private Gallery</dt><dd>' + (g.private_gallery ? 'On' : 'Off') + '</dd></div>' +
      '<div><dt>Downloads</dt><dd>' + (g.downloads ? 'Enabled' : 'Disabled') + '</dd></div>' +
      '<div><dt>Delivery</dt><dd>' + esc(g.delivery_status || p.gallery_status) + '</dd></div></dl></section>' +
      '<section class="pp-panel"><h3>Watermark</h3>' +
      '<label class="pp-check"><input type="checkbox" data-pp-act="gal-wm" data-pp-id="' + esc(p.id) + '"' + ((g.watermark && g.watermark.enabled) ? ' checked' : '') + '><span>Enable watermark</span></label>' +
      '<input class="pp-input" type="text" placeholder="Watermark text" value="' + esc((g.watermark && g.watermark.text) || '') + '" data-pp-act="gal-wm-text" data-pp-id="' + esc(p.id) + '">' +
      '<div class="pp-btn-row pp-mt">' +
      '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="gal-publish" data-pp-id="' + esc(p.id) + '">Publish</button>' +
      '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="gal-share" data-pp-id="' + esc(p.id) + '">Share</button>' +
      '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="gal-download" data-pp-id="' + esc(p.id) + '">Download</button>' +
      '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="gal-hide" data-pp-id="' + esc(p.id) + '">Hide</button>' +
      '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="gal-feature" data-pp-id="' + esc(p.id) + '">Feature</button></div></section></div>';
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
      }).join('') + '</ul>' : '<p class="pp-muted">Add a deposit or balance anytime — Adobe not required.</p>') + '</section>';
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
    return '<section class="pp-panel pp-panel-wide"><h3>AI Marketing</h3>' +
      '<p class="pp-muted">' + (editingDone
        ? 'Editing looks complete — these workflows will fire from Connected Apps later.'
        : 'When editing finishes on this project, Hubly can generate campaigns automatically.') + '</p>' +
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

  async function renderPhotoProjects() {
    var root = ownRoot();
    if (!root) return;
    setPhotoProjectsMode(true);
    try {
      var titleEl = el('bar-title'), subEl = el('bar-sub');
      if (titleEl) titleEl.textContent = 'Photography Projects';
      if (subEl) subEl.textContent = 'Open the project — Connected Apps sync editors, creative, and files to Hubly.';
      if (typeof global.setHublyDocTitle === 'function') global.setHublyDocTitle('Photography Projects');
    } catch (e) {}

    var st = getState(root);
    if (!hasProjectsCapability()) {
      root.innerHTML = '<div class="pp-shell"><div class="pp-empty"><h2>Projects capability not enabled</h2>' +
        '<p>Enable <code>capabilities.projects</code> on this business to use Photography Projects.</p></div></div>';
      return;
    }

    root.innerHTML = '<div class="pp-shell"><div class="pp-empty"><p class="pp-muted">Loading projects…</p></div></div>';
    var list = [];
    try {
      list = await loadProjectsFromSupabase(false);
      st.error = null;
    } catch (err) {
      st.error = (err && err.message) || 'Could not load projects from Hubly.';
      list = _cache.projects || [];
    }

    var html = '';
    if (st.view === 'wizard') html = renderWizard(root, list, st);
    else if (st.view === 'command' && st.projectId) {
      var p = findProject(st.projectId);
      if (!p) { st.view = 'dashboard'; st.projectId = null; html = renderDashboard(root, list, st); }
      else html = renderCommand(root, st, p);
    } else {
      st.view = 'dashboard';
      html = renderDashboard(root, list, st);
    }
    root.innerHTML = html;
    bindPhotoProjects(root);
  }

  function buildProjectFromWizard(w) {
    var clientName = w.client_mode === 'existing' ? w.existing_client : w.client_name;
    var ws = defaultWorkspace({
      team: Object.assign({}, w.team),
      activity: [{ id: 'act_new', action: 'Project created', detail: w.name || 'Untitled Project', created_at: new Date().toISOString() }]
    });
    if (w.assets.contract) ws.contracts.push({ id: 'c1', title: 'Photography Agreement', status: 'draft' });
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
    return renderPhotoProjects();
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
      return renderPhotoProjects();
    }
    if (act === 'quick') {
      st.quickOpen = true; st.quick = { name: '', files: [] };
      return renderPhotoProjects();
    }
    if (act === 'quick-close') {
      st.quickOpen = false;
      return renderPhotoProjects();
    }
    if (act === 'quick-create') {
      try {
        var createdQ = await createQuickProject(st);
        if (!createdQ) return;
        st.quickOpen = false;
        st.view = 'command';
        st.projectId = createdQ.id;
        st.tab = 'overview';
        toast('Project saved');
        return renderPhotoProjects();
      } catch (err) {
        toast((err && err.message) || 'Could not create project');
        return;
      }
    }
    if (act === 'wiz-cancel' || act === 'back-dash') {
      st.view = 'dashboard'; st.projectId = null; st.wizard = null;
      return renderPhotoProjects();
    }
    if (act === 'wiz-client-mode') {
      st.wizard.client_mode = t.getAttribute('data-pp-mode') || 'new';
      return renderPhotoProjects();
    }
    if (act === 'wiz-prev') {
      st.wizardStep = Math.max(1, (st.wizardStep || 1) - 1);
      return renderPhotoProjects();
    }
    if (act === 'wiz-next') {
      if ((st.wizardStep || 1) === 1 && !(st.wizard && String(st.wizard.name || '').trim())) {
        toast('Add a project name'); return;
      }
      st.wizardStep = Math.min(4, (st.wizardStep || 1) + 1);
      return renderPhotoProjects();
    }
    if (act === 'wiz-create') {
      try {
        var created = await persistProject(buildProjectFromWizard(st.wizard || blankWizard()));
        st.view = 'command'; st.projectId = created.id; st.tab = 'overview'; st.wizard = null;
        toast('Project created');
        return renderPhotoProjects();
      } catch (err) {
        toast((err && err.message) || 'Could not create project');
        return;
      }
    }
    if (act === 'open' && id) {
      st.view = 'command'; st.projectId = id; st.tab = 'overview'; persistUiPrefs(st);
      return renderPhotoProjects();
    }
    if (act === 'tab') {
      st.tab = t.getAttribute('data-pp-tab') || 'overview';
      persistUiPrefs(st);
      return renderPhotoProjects();
    }
    if (act === 'gallery' && p) {
      st.view = 'command'; st.projectId = p.id; st.tab = 'gallery'; persistUiPrefs(st);
      return renderPhotoProjects();
    }
    if (act === 'invoice' && p) {
      st.view = 'command'; st.projectId = p.id; st.tab = 'invoices'; persistUiPrefs(st);
      return renderPhotoProjects();
    }
    if (act === 'sync' && p) {
      var svc = global.AdobeLightroomService;
      if (svc && svc.syncWorkspace) {
        await svc.syncWorkspace({ businessId: businessId(), projectId: p.id });
      } else if (svc) {
        await svc.syncProject({ businessId: businessId(), projectId: p.id });
      }
      upsertWorkspaceLocal(p, {
        provider: 'adobe_lightroom',
        display_name: (p.lightroom && p.lightroom.album_name) || p.name,
        sync_state: 'pending',
        metadata: Object.assign({}, (getWorkspace(p, 'adobe_lightroom') || {}).metadata || {}, { last_sync_request: new Date().toISOString() })
      });
      addActivity(p, 'Sync requested', 'Adobe Lightroom Connected App — connection required for live sync');
      return saveAndRefresh(p, st);
    }
    if (act === 'deliver' && p) {
      p.gallery_status = 'delivered';
      p.status = 'Delivered';
      if (p.gallery) p.gallery.delivery_status = 'delivered';
      (p.deliverables || []).forEach(function (d) { if (d.kind === 'gallery') d.status = 'delivered'; });
      addActivity(p, 'Gallery delivered', 'Client delivery marked complete');
      st.view = 'command'; st.projectId = p.id; st.tab = 'gallery';
      toast('Marked delivered');
      return saveAndRefresh(p, st);
    }
    if (act === 'adobe-connect') {
      var svcC = global.AdobeLightroomService;
      if (svcC) await svcC.connect({ businessId: businessId() || '' });
      else toast('Adobe Lightroom isn’t connected yet. Projects still work in Hubly.');
      return;
    }
    if (act === 'canva-connect') {
      var canva = global.CanvaConnectedApp;
      if (canva && canva.connect) await canva.connect({ businessId: businessId() || '', projectId: (p && p.id) || st.projectId });
      else toast('Canva isn’t connected yet. Creative plans still save on the project.');
      if (p) {
        upsertWorkspaceLocal(p, {
          provider: 'canva',
          display_name: 'Canva',
          sync_state: 'pending',
          metadata: { role: 'creative' }
        });
        addActivity(p, 'Canva connect requested', 'Creative Connected App');
        return saveAndRefresh(p, st);
      }
      return;
    }
    if (act === 'creative-create' && p) {
      var kind = t.getAttribute('data-pp-kind') || 'instagram_carousel';
      var providerId = t.getAttribute('data-pp-provider') || 'canva';
      var providerMeta = (global.HublyConnectedApps && global.HublyConnectedApps.get)
        ? global.HublyConnectedApps.get(providerId)
        : null;
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
          providerId: providerId,
          kind: kind,
          title: p.name + ' · ' + kind,
          brand: brand,
          photoUrls: []
        });
      }
      p.workspace = p.workspace || defaultWorkspace();
      p.workspace.creative_requests = p.workspace.creative_requests || [];
      p.workspace.creative_requests.push({
        kind: kind,
        status: (res && res.ok) ? 'created' : 'planned',
        provider: providerId,
        at: new Date().toISOString(),
        message: res && res.message
      });
      upsertWorkspaceLocal(p, {
        provider: providerId,
        display_name: (providerMeta && providerMeta.name) || providerId,
        sync_state: 'pending',
        metadata: { last_creative_kind: kind, role: 'creative' }
      });
      addActivity(p, 'Creative asset requested', kind + ' via ' + ((providerMeta && providerMeta.name) || providerId));
      toast((res && res.message) || 'Creative request saved on the project');
      st.tab = 'creative';
      return saveAndRefresh(p, st);
    }
    if (act === 'adobe-disconnect') {
      p = p || findProject(st.projectId);
      if (!p) { toast('Open a project first'); return; }
      upsertWorkspaceLocal(p, {
        provider: 'adobe_lightroom',
        sync_state: 'unlinked'
      });
      p.lightroom_status = 'not_connected';
      addActivity(p, 'Workspace disconnected', 'Adobe Lightroom');
      toast('Adobe workspace will unlink when OAuth is wired.');
      return saveAndRefresh(p, st);
    }
    if (act === 'lr-create-album' && p) {
      var svcA = global.AdobeLightroomService;
      if (svcA) await svcA.createAlbum({ businessId: businessId() || '', projectId: p.id, name: p.name });
      p.lightroom = p.lightroom || {};
      p.lightroom.album_name = p.name;
      var extId = 'pending-' + String(p.id).replace(/-/g, '').slice(-8);
      upsertWorkspaceLocal(p, {
        provider: 'adobe_lightroom',
        display_name: p.name,
        external_id: extId,
        sync_state: 'pending',
        metadata: { album_name: p.name, album_id: extId }
      });
      p.lightroom_status = 'album_ready';
      addActivity(p, 'Lightroom prepared', 'Connected App ready — connect Adobe to sync RAWs');
      toast('Lightroom prepared on the project. Connect Adobe to sync.');
      return saveAndRefresh(p, st);
    }
    if (act === 'lr-open') {
      toast('Open Adobe Lightroom on your desktop — Hubly keeps the Connected App link here.');
      return;
    }
    if (act === 'gal-publish' && p) {
      var svcP = global.AdobeLightroomService;
      if (svcP) await svcP.publishGallery({ businessId: businessId() || '', projectId: p.id, galleryId: 'main' });
      p.gallery_status = 'published';
      if (p.gallery) p.gallery.delivery_status = 'published';
      addActivity(p, 'Gallery published', 'Client gallery live');
      toast('Gallery published');
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
      p.contracts.push({ id: 'c_' + Date.now(), title: 'Photography Agreement', status: 'draft' });
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
      return renderPhotoProjects();
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
      return renderPhotoProjects();
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
          addActivity(p, 'Editing finished', 'Connected Apps ready for gallery → creative → marketing');
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
      root._ppSearchT = setTimeout(function () { renderPhotoProjects(); }, 180);
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

  function syncPhotographyNav() {
    var nav = document.querySelector('.ni[data-v="photo-projects"]');
    if (!nav) return;
    var show = hasProjectsCapability();
    nav.hidden = !show;
    nav.setAttribute('aria-hidden', show ? 'false' : 'true');
    nav.classList.toggle('jos-nav-hidden', !show);
  }

  function openQuickProject() {
    var nav = document.querySelector('.ni[data-v="photo-projects"]');
    if (nav && typeof global.switchV === 'function') global.switchV(nav);
    setTimeout(function () {
      var root = el('jos-photo-projects-root');
      if (!root) return;
      var st = getState(root);
      st.quickOpen = true;
      st.quick = { name: '', files: [] };
      st.view = 'dashboard';
      renderPhotoProjects();
    }, 60);
  }

  function attach() {
    global.HublyPhotographyProjects = {
      render: renderPhotoProjects,
      syncNav: syncPhotographyNav,
      setMode: setPhotoProjectsMode,
      openQuickProject: openQuickProject,
      hasCapability: hasProjectsCapability,
      reload: function () { return loadProjectsFromSupabase(true); }
    };
    if (global.HublyJourneyOS) {
      global.HublyJourneyOS.renderPhotoProjects = renderPhotoProjects;
      global.HublyJourneyOS.syncPhotographyNav = syncPhotographyNav;
      global.HublyJourneyOS.setPhotoProjectsMode = setPhotoProjectsMode;
      global.HublyJourneyOS.openPhotographyQuickProject = openQuickProject;
    }
    syncPhotographyNav();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
  else attach();
  setTimeout(attach, 0);
  setTimeout(attach, 500);
  setTimeout(syncPhotographyNav, 800);
  setTimeout(syncPhotographyNav, 2000);
  global.addEventListener('hubly:business-loaded', function () {
    _cache.loaded = false;
    syncPhotographyNav();
  });
  global.addEventListener('hubly:blueprint-changed', syncPhotographyNav);
})(typeof window !== 'undefined' ? window : globalThis);
