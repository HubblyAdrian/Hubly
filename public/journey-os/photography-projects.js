/**
 * Hubly Photography Projects — Operate module
 * Independent of Jobs. Adobe Lightroom enhances; never required.
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
    { id: 'lightroom', label: 'Lightroom Album', hint: 'Optional — needs Adobe later' },
    { id: 'folder', label: 'Client Folder', hint: 'Hubly project workspace' },
    { id: 'contract', label: 'Contract' },
    { id: 'invoice', label: 'Invoice' },
    { id: 'questionnaire', label: 'Questionnaire' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'shot_list', label: 'Shot List' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'marketing', label: 'AI Marketing Workflow' }
  ];

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
  function uid() {
    return 'pp_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }
  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }
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
    var m = {
      Lead: 'lead', Booked: 'booked', Scheduled: 'scheduled', Shooting: 'shooting',
      Editing: 'editing', Proofing: 'proofing', Delivered: 'delivered', Archived: 'archived'
    };
    return m[st] || 'lead';
  }
  function storageKey() {
    var bid = S().businessId || S().bizId || 'local';
    return 'hubly_photography_projects_' + bid;
  }
  function lightroom() {
    return global.AdobeLightroomService || null;
  }

  function loadStore() {
    try {
      var raw = localStorage.getItem(storageKey());
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.projects)) return parsed;
      }
    } catch (e) {}
    return { projects: [], adobeConnected: false, adobeAccount: null };
  }

  function saveStore(store) {
    try { localStorage.setItem(storageKey(), JSON.stringify(store)); } catch (e) {}
  }

  function ensureSeed(store) {
    if (store.projects.length) return store;
    var demo = [
      seedProject({
        name: 'Elena & Marcus Wedding',
        project_type: 'Wedding',
        status: 'Editing',
        shoot_date: addDays(14),
        client_name: 'Elena Vargas',
        client_email: 'elena@email.com',
        location: 'Temecula Vineyard',
        photo_count: 1842,
        editing_progress: 62,
        revenue_cents: 480000,
        outstanding_cents: 120000,
        lightroom_status: 'synced',
        gallery_status: 'private',
        invoice_status: 'partial',
        last_sync_at: new Date(Date.now() - 3600000).toISOString()
      }),
      seedProject({
        name: 'Chen Family Session',
        project_type: 'Family',
        status: 'Scheduled',
        shoot_date: addDays(5),
        client_name: 'Priya Chen',
        location: 'Balboa Park',
        photo_count: 0,
        estimated_photos: 120,
        revenue_cents: 65000,
        outstanding_cents: 32500,
        lightroom_status: 'not_connected',
        gallery_status: 'draft',
        invoice_status: 'sent'
      }),
      seedProject({
        name: 'Northwind Product Launch',
        project_type: 'Commercial',
        status: 'Proofing',
        shoot_date: addDays(-3),
        client_name: 'Northwind Co.',
        location: 'Studio B',
        photo_count: 486,
        editing_progress: 100,
        revenue_cents: 320000,
        outstanding_cents: 0,
        lightroom_status: 'album_ready',
        gallery_status: 'published',
        invoice_status: 'paid',
        last_sync_at: new Date(Date.now() - 86400000).toISOString()
      })
    ];
    store.projects = demo;
    saveStore(store);
    return store;
  }

  function addDays(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function seedProject(partial) {
    var id = uid();
    var p = Object.assign({
      id: id,
      name: 'Untitled Project',
      project_type: 'Portrait',
      status: 'Lead',
      shoot_date: null,
      location: '',
      estimated_photos: null,
      photo_count: 0,
      notes: '',
      cover_photo_url: null,
      client_name: '',
      client_email: '',
      client_phone: '',
      client_address: '',
      client_relationship: '',
      client_mode: 'new',
      revenue_cents: 0,
      outstanding_cents: 0,
      editing_progress: 0,
      lightroom_status: 'not_connected',
      gallery_status: 'draft',
      invoice_status: 'none',
      last_sync_at: null,
      team: { lead: '', second: '', assistant: '', editor: '' },
      timeline: TIMELINE_DEFAULTS.map(function (t, i) {
        return Object.assign({}, t, {
          id: uid(),
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
        photo_count: 0,
        edited_count: 0,
        favorites: 0,
        connection_status: 'not_connected',
        last_sync_at: null,
        sync_activity: [],
        upload_queue: [],
        import_queue: [],
        export_queue: []
      },
      contracts: [],
      invoices: [],
      questionnaire: { status: 'draft', title: 'Client Questionnaire', answers: {} },
      deliverables: [
        { id: uid(), title: 'Client Gallery', kind: 'gallery', status: 'pending' },
        { id: uid(), title: 'Edited Selects', kind: 'cloud', status: 'pending' }
      ],
      marketing: MARKETING_CHANNELS.map(function (c) {
        return Object.assign({}, c, { status: 'idle', body: '' });
      }),
      activity: [],
      shot_list: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, partial || {});

    if (partial && partial.status) {
      var doneThrough = {
        Lead: 0, Booked: 1, Scheduled: 4, Shooting: 5,
        Editing: 6, Proofing: 7, Delivered: 9, Archived: 12
      };
      var n = doneThrough[partial.status] || 0;
      p.timeline.forEach(function (t, i) {
        if (i < n) {
          t.completed = true;
          t.occurred_at = new Date(Date.now() - (n - i) * 86400000).toISOString();
        }
      });
    }
    p.activity.push({
      id: uid(),
      action: 'Project created',
      detail: p.name,
      created_at: p.created_at
    });
    return p;
  }

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
    root._pp = root._pp || {
      view: 'dashboard',
      projectId: null,
      tab: 'overview',
      wizardStep: 1,
      wizard: null,
      search: '',
      statusFilter: 'all',
      dateFilter: 'all',
      photographerFilter: 'all',
      sort: 'shoot_date_desc'
    };
    return root._pp;
  }

  function projectsFiltered(store, st) {
    var list = store.projects.slice();
    var q = String(st.search || '').trim().toLowerCase();
    if (q) {
      list = list.filter(function (p) {
        return [p.name, p.client_name, p.project_type, p.location, p.status]
          .join(' ').toLowerCase().indexOf(q) !== -1;
      });
    }
    if (st.statusFilter && st.statusFilter !== 'all') {
      list = list.filter(function (p) { return p.status === st.statusFilter; });
    }
    if (st.dateFilter === 'upcoming') {
      list = list.filter(function (p) { return daysUntil(p.shoot_date) != null && daysUntil(p.shoot_date) >= 0; });
    } else if (st.dateFilter === 'past') {
      list = list.filter(function (p) { return daysUntil(p.shoot_date) != null && daysUntil(p.shoot_date) < 0; });
    } else if (st.dateFilter === 'this_month') {
      var ym = todayISO().slice(0, 7);
      list = list.filter(function (p) { return String(p.shoot_date || '').slice(0, 7) === ym; });
    }
    if (st.photographerFilter && st.photographerFilter !== 'all') {
      list = list.filter(function (p) {
        return (p.team && p.team.lead) === st.photographerFilter;
      });
    }
    var sort = st.sort || 'shoot_date_desc';
    list.sort(function (a, b) {
      if (sort === 'name') return String(a.name).localeCompare(String(b.name));
      if (sort === 'status') return String(a.status).localeCompare(String(b.status));
      if (sort === 'updated') return String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
      var ad = a.shoot_date || '';
      var bd = b.shoot_date || '';
      return sort === 'shoot_date_asc' ? ad.localeCompare(bd) : bd.localeCompare(ad);
    });
    return list;
  }

  function findProject(store, id) {
    return store.projects.find(function (p) { return p.id === id; }) || null;
  }

  function photographers(store) {
    var set = {};
    store.projects.forEach(function (p) {
      if (p.team && p.team.lead) set[p.team.lead] = true;
    });
    return Object.keys(set).sort();
  }

  /* ─── Dashboard ─────────────────────────────────────────────────────── */

  function renderDashboard(root, store, st) {
    var list = projectsFiltered(store, st);
    var photogs = photographers(store);

    var cards = list.map(function (p) {
      return '<article class="pp-card" data-pp-act="open" data-pp-id="' + esc(p.id) + '">' +
        '<div class="pp-card-cover" style="' + coverStyle(p) + '">' +
          '<span class="pp-status pp-status-' + statusTone(p.status) + '">' + esc(p.status) + '</span>' +
        '</div>' +
        '<div class="pp-card-body">' +
          '<h3 class="pp-card-title">' + esc(p.name) + '</h3>' +
          '<div class="pp-card-meta">' +
            '<span>' + esc(p.client_name || 'No client') + '</span>' +
            '<span class="pp-dot"></span>' +
            '<span>' + esc(p.project_type) + '</span>' +
          '</div>' +
          '<div class="pp-card-row">' +
            '<span class="pp-label">Shoot</span><strong>' + esc(formatDate(p.shoot_date)) + '</strong>' +
          '</div>' +
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
          '</div>' +
        '</div></article>';
    }).join('');

    return '<div class="pp-shell pp-dash">' +
      '<header class="pp-dash-head">' +
        '<div>' +
          '<p class="pp-eyebrow">Photography</p>' +
          '<h1 class="pp-title">Photography Projects</h1>' +
          '<p class="pp-sub">From booking to delivery — Lightroom stays where you edit.</p>' +
        '</div>' +
        '<button type="button" class="pp-btn pp-btn-brand pp-btn-lg" data-pp-act="new">+ New Project</button>' +
      '</header>' +
      '<div class="pp-toolbar">' +
        '<label class="pp-search"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
          '<input type="search" placeholder="Search projects, clients…" value="' + esc(st.search) + '" data-pp-field="search">' +
        '</label>' +
        '<select data-pp-field="statusFilter" aria-label="Status">' +
          '<option value="all">All statuses</option>' +
          STATUSES.map(function (s) {
            return '<option value="' + esc(s) + '"' + (st.statusFilter === s ? ' selected' : '') + '>' + esc(s) + '</option>';
          }).join('') +
        '</select>' +
        '<select data-pp-field="dateFilter" aria-label="Date">' +
          '<option value="all"' + (st.dateFilter === 'all' ? ' selected' : '') + '>Any date</option>' +
          '<option value="upcoming"' + (st.dateFilter === 'upcoming' ? ' selected' : '') + '>Upcoming</option>' +
          '<option value="this_month"' + (st.dateFilter === 'this_month' ? ' selected' : '') + '>This month</option>' +
          '<option value="past"' + (st.dateFilter === 'past' ? ' selected' : '') + '>Past</option>' +
        '</select>' +
        '<select data-pp-field="photographerFilter" aria-label="Photographer">' +
          '<option value="all">All photographers</option>' +
          photogs.map(function (n) {
            return '<option value="' + esc(n) + '"' + (st.photographerFilter === n ? ' selected' : '') + '>' + esc(n) + '</option>';
          }).join('') +
        '</select>' +
        '<select data-pp-field="sort" aria-label="Sort">' +
          '<option value="shoot_date_desc"' + (st.sort === 'shoot_date_desc' ? ' selected' : '') + '>Shoot date ↓</option>' +
          '<option value="shoot_date_asc"' + (st.sort === 'shoot_date_asc' ? ' selected' : '') + '>Shoot date ↑</option>' +
          '<option value="name"' + (st.sort === 'name' ? ' selected' : '') + '>Name</option>' +
          '<option value="status"' + (st.sort === 'status' ? ' selected' : '') + '>Status</option>' +
          '<option value="updated"' + (st.sort === 'updated' ? ' selected' : '') + '>Recently updated</option>' +
        '</select>' +
      '</div>' +
      (list.length
        ? '<div class="pp-grid">' + cards + '</div>'
        : '<div class="pp-empty">' +
            '<div class="pp-empty-art" aria-hidden="true"></div>' +
            '<h2>No projects yet</h2>' +
            '<p>Create a project to manage the shoot, gallery, invoices, and delivery — with or without Adobe Lightroom.</p>' +
            '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="new">+ New Project</button>' +
          '</div>') +
      '</div>';
  }

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

  /* ─── Wizard ────────────────────────────────────────────────────────── */

  function blankWizard() {
    return {
      name: '',
      project_type: 'Portrait',
      shoot_date: '',
      location: '',
      estimated_photos: '',
      notes: '',
      client_mode: 'new',
      client_name: '',
      client_email: '',
      client_phone: '',
      client_address: '',
      client_relationship: '',
      existing_client: '',
      team: { lead: '', second: '', assistant: '', editor: '' },
      assets: {
        lightroom: true, folder: true, contract: true, invoice: true,
        questionnaire: true, timeline: true, shot_list: true, gallery: true, marketing: true
      }
    };
  }

  function renderWizard(root, store, st) {
    var w = st.wizard || blankWizard();
    st.wizard = w;
    var step = st.wizardStep || 1;
    var clients = Array.from(new Set(store.projects.map(function (p) { return p.client_name; }).filter(Boolean)));

    var body = '';
    if (step === 1) {
      body = '<div class="pp-form-grid">' +
        field('Project Name', '<input type="text" data-pp-w="name" value="' + esc(w.name) + '" placeholder="Elena & Marcus Wedding" required>') +
        field('Project Type', '<select data-pp-w="project_type">' +
          PROJECT_TYPES.map(function (t) {
            return '<option' + (w.project_type === t ? ' selected' : '') + '>' + esc(t) + '</option>';
          }).join('') + '</select>') +
        field('Shoot Date', '<input type="date" data-pp-w="shoot_date" value="' + esc(w.shoot_date) + '">') +
        field('Location', '<input type="text" data-pp-w="location" value="' + esc(w.location) + '" placeholder="Venue or studio">') +
        field('Estimated Photos', '<input type="number" min="0" data-pp-w="estimated_photos" value="' + esc(w.estimated_photos) + '" placeholder="e.g. 800">') +
        field('Notes', '<textarea data-pp-w="notes" rows="3" placeholder="Creative direction, must-have shots…">' + esc(w.notes) + '</textarea>', true) +
        '</div>';
    } else if (step === 2) {
      body = '<div class="pp-seg">' +
        '<button type="button" class="pp-seg-btn' + (w.client_mode === 'existing' ? ' on' : '') + '" data-pp-act="wiz-client-mode" data-pp-mode="existing">Existing Client</button>' +
        '<button type="button" class="pp-seg-btn' + (w.client_mode === 'new' ? ' on' : '') + '" data-pp-act="wiz-client-mode" data-pp-mode="new">Create New Client</button>' +
        '</div>';
      if (w.client_mode === 'existing') {
        body += '<div class="pp-form-grid">' +
          field('Client', '<select data-pp-w="existing_client"><option value="">Select…</option>' +
            clients.map(function (c) {
              return '<option value="' + esc(c) + '"' + (w.existing_client === c ? ' selected' : '') + '>' + esc(c) + '</option>';
            }).join('') + '</select>', true) +
          '</div>';
      } else {
        body += '<div class="pp-form-grid">' +
          field('Name', '<input type="text" data-pp-w="client_name" value="' + esc(w.client_name) + '" placeholder="Full name">') +
          field('Email', '<input type="email" data-pp-w="client_email" value="' + esc(w.client_email) + '">') +
          field('Phone', '<input type="tel" data-pp-w="client_phone" value="' + esc(w.client_phone) + '">') +
          field('Address', '<input type="text" data-pp-w="client_address" value="' + esc(w.client_address) + '">') +
          field('Relationship', '<input type="text" data-pp-w="client_relationship" value="' + esc(w.client_relationship) + '" placeholder="Bride, agency, parent…">') +
          '</div>';
      }
    } else if (step === 3) {
      body = '<div class="pp-form-grid">' +
        field('Lead Photographer', '<input type="text" data-pp-w="team.lead" value="' + esc(w.team.lead) + '" placeholder="You">') +
        field('Second Shooter', '<input type="text" data-pp-w="team.second" value="' + esc(w.team.second) + '">') +
        field('Assistant', '<input type="text" data-pp-w="team.assistant" value="' + esc(w.team.assistant) + '">') +
        field('Editor', '<input type="text" data-pp-w="team.editor" value="' + esc(w.team.editor) + '">') +
        '</div>';
    } else {
      body = '<p class="pp-help">Choose what Hubly should prepare. Lightroom is optional — everything else works today.</p>' +
        '<div class="pp-checks">' +
        CREATE_ASSETS.map(function (a) {
          return '<label class="pp-check">' +
            '<input type="checkbox" data-pp-asset="' + a.id + '"' + (w.assets[a.id] ? ' checked' : '') + '>' +
            '<span><strong>' + esc(a.label) + '</strong>' +
            (a.hint ? '<small>' + esc(a.hint) + '</small>' : '') +
            '</span></label>';
        }).join('') +
        '</div>';
    }

    return '<div class="pp-shell pp-wizard">' +
      '<button type="button" class="pp-back" data-pp-act="wiz-cancel">← Projects</button>' +
      '<div class="pp-wizard-card">' +
        '<div class="pp-steps">' +
          [1, 2, 3, 4].map(function (n) {
            var labels = ['Details', 'Client', 'Team', 'Assets'];
            return '<div class="pp-step' + (n === step ? ' on' : '') + (n < step ? ' done' : '') + '">' +
              '<i>' + n + '</i><span>' + labels[n - 1] + '</span></div>';
          }).join('') +
        '</div>' +
        '<h2 class="pp-wizard-title">' +
          (['', 'Project Details', 'Client', 'Team', 'Create Assets'][step] || '') +
        '</h2>' +
        body +
        '<div class="pp-wizard-foot">' +
          (step > 1 ? '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="wiz-prev">Back</button>' : '<span></span>') +
          (step < 4
            ? '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="wiz-next">Continue</button>'
            : '<button type="button" class="pp-btn pp-btn-brand pp-btn-lg" data-pp-act="wiz-create">Create Project</button>') +
        '</div>' +
      '</div></div>';
  }

  function field(label, control, full) {
    return '<label class="pp-field' + (full ? ' pp-field-full' : '') + '"><span>' + esc(label) + '</span>' + control + '</label>';
  }

  /* ─── Command Center ────────────────────────────────────────────────── */

  function renderCommand(root, store, st, p) {
    var tab = st.tab || 'overview';
    var tabs = [
      ['overview', 'Overview'], ['timeline', 'Timeline'], ['lightroom', 'Lightroom'],
      ['gallery', 'Gallery'], ['contracts', 'Contracts'], ['invoices', 'Invoices'],
      ['questionnaire', 'Questionnaire'], ['deliverables', 'Deliverables'],
      ['marketing', 'Marketing'], ['notes', 'Notes'], ['activity', 'Activity']
    ];

    return '<div class="pp-shell pp-cc">' +
      '<button type="button" class="pp-back" data-pp-act="back-dash">← All projects</button>' +
      '<header class="pp-hero" style="' + coverStyle(p) + '">' +
        '<div class="pp-hero-veil"></div>' +
        '<div class="pp-hero-content">' +
          '<div class="pp-hero-top">' +
            '<span class="pp-status pp-status-' + statusTone(p.status) + '">' + esc(p.status) + '</span>' +
            '<select class="pp-status-select" data-pp-act="set-status" data-pp-id="' + esc(p.id) + '" aria-label="Change status">' +
              STATUSES.map(function (s) {
                return '<option value="' + esc(s) + '"' + (p.status === s ? ' selected' : '') + '>' + esc(s) + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
          '<h1 class="pp-hero-title">' + esc(p.name) + '</h1>' +
          '<p class="pp-hero-sub">' + esc(p.client_name || 'No client') + ' · ' + esc(p.project_type) + ' · ' + esc(formatDate(p.shoot_date)) + '</p>' +
          '<div class="pp-hero-kpis">' +
            kpi('Countdown', countdownLabel(p.shoot_date)) +
            kpi('Revenue', money(p.revenue_cents)) +
            kpi('Outstanding', money(p.outstanding_cents)) +
            kpi('Photos', String(p.photo_count || 0)) +
            kpi('Editing', (p.editing_progress || 0) + '%') +
          '</div>' +
        '</div>' +
      '</header>' +
      '<nav class="pp-tabs" role="tablist">' +
        tabs.map(function (t) {
          return '<button type="button" role="tab" class="pp-tab' + (tab === t[0] ? ' on' : '') + '" data-pp-act="tab" data-pp-tab="' + t[0] + '">' + esc(t[1]) + '</button>';
        }).join('') +
      '</nav>' +
      '<div class="pp-tab-body">' + renderTab(p, tab, store) + '</div>' +
      '</div>';
  }

  function kpi(label, value) {
    return '<div class="pp-kpi"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong></div>';
  }

  function renderTab(p, tab, store) {
    if (tab === 'timeline') return renderTimelineTab(p);
    if (tab === 'lightroom') return renderLightroomTab(p, store);
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

  function renderOverviewTab(p) {
    return '<div class="pp-panel-grid">' +
      '<section class="pp-panel">' +
        '<h3>Project</h3>' +
        '<dl class="pp-dl">' +
          '<div><dt>Location</dt><dd>' + esc(p.location || '—') + '</dd></div>' +
          '<div><dt>Type</dt><dd>' + esc(p.project_type) + '</dd></div>' +
          '<div><dt>Lead</dt><dd>' + esc((p.team && p.team.lead) || '—') + '</dd></div>' +
          '<div><dt>Est. photos</dt><dd>' + esc(String(p.estimated_photos != null ? p.estimated_photos : '—')) + '</dd></div>' +
        '</dl>' +
        '<p class="pp-muted">' + esc(p.notes || 'No notes yet.') + '</p>' +
      '</section>' +
      '<section class="pp-panel">' +
        '<h3>Client</h3>' +
        '<dl class="pp-dl">' +
          '<div><dt>Name</dt><dd>' + esc(p.client_name || '—') + '</dd></div>' +
          '<div><dt>Email</dt><dd>' + esc(p.client_email || '—') + '</dd></div>' +
          '<div><dt>Phone</dt><dd>' + esc(p.client_phone || '—') + '</dd></div>' +
          '<div><dt>Relationship</dt><dd>' + esc(p.client_relationship || '—') + '</dd></div>' +
        '</dl>' +
      '</section>' +
      '<section class="pp-panel">' +
        '<h3>Editing progress</h3>' +
        '<div class="pp-progress"><i style="width:' + (p.editing_progress || 0) + '%"></i></div>' +
        '<div class="pp-progress-meta">' +
          '<span>' + (p.editing_progress || 0) + '% complete</span>' +
          '<input type="range" min="0" max="100" value="' + (p.editing_progress || 0) + '" data-pp-act="edit-progress" data-pp-id="' + esc(p.id) + '">' +
        '</div>' +
      '</section>' +
      '<section class="pp-panel">' +
        '<h3>Quick actions</h3>' +
        '<div class="pp-btn-row">' +
          '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="tab" data-pp-tab="lightroom">Lightroom</button>' +
          '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="tab" data-pp-tab="gallery">Gallery</button>' +
          '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="tab" data-pp-tab="invoices">Invoice</button>' +
          '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="deliver" data-pp-id="' + esc(p.id) + '">Deliver</button>' +
        '</div>' +
      '</section></div>';
  }

  function renderTimelineTab(p) {
    var rows = (p.timeline || []).map(function (t, i) {
      return '<label class="pp-tl-row">' +
        '<input type="checkbox" data-pp-act="tl-toggle" data-pp-id="' + esc(p.id) + '" data-pp-tl="' + i + '"' + (t.completed ? ' checked' : '') + '>' +
        '<div class="pp-tl-main">' +
          '<input class="pp-tl-label" type="text" value="' + esc(t.label) + '" data-pp-act="tl-label" data-pp-id="' + esc(p.id) + '" data-pp-tl="' + i + '">' +
          '<input class="pp-tl-date" type="datetime-local" value="' + esc(toLocalInput(t.occurred_at)) + '" data-pp-act="tl-date" data-pp-id="' + esc(p.id) + '" data-pp-tl="' + i + '">' +
        '</div>' +
        '<input class="pp-tl-notes" type="text" placeholder="Notes" value="' + esc(t.notes || '') + '" data-pp-act="tl-notes" data-pp-id="' + esc(p.id) + '" data-pp-tl="' + i + '">' +
        '</label>';
    }).join('');
    return '<section class="pp-panel pp-panel-wide"><h3>Timeline</h3><p class="pp-muted">Everything is editable — mark complete, change labels, dates, and notes.</p><div class="pp-tl">' + rows + '</div></section>';
  }

  function toLocalInput(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      var off = d.getTimezoneOffset();
      var local = new Date(d.getTime() - off * 60000);
      return local.toISOString().slice(0, 16);
    } catch (e) { return ''; }
  }

  function renderLightroomTab(p, store) {
    var lr = p.lightroom || {};
    var connected = !!(store.adobeConnected || lr.connection_status === 'connected' || lr.connection_status === 'synced' || lr.connection_status === 'album_ready');

    if (!connected) {
      return '<section class="pp-lr-onboard">' +
        '<div class="pp-lr-mark" aria-hidden="true"></div>' +
        '<h2>Hubly works with Adobe Lightroom</h2>' +
        '<p>Keep editing in Lightroom. Hubly runs everything before and after — leads, contracts, galleries, invoices, and delivery.</p>' +
        '<p class="pp-muted">Adobe is optional. You can upload photos, publish galleries, and deliver to clients in Hubly without connecting Lightroom.</p>' +
        '<div class="pp-btn-row">' +
          '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="adobe-connect">Connect Adobe</button>' +
          '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="tab" data-pp-tab="gallery">Continue without Adobe</button>' +
        '</div>' +
        '</section>';
    }

    return '<div class="pp-panel-grid">' +
      '<section class="pp-panel">' +
        '<h3>Connection</h3>' +
        '<dl class="pp-dl">' +
          '<div><dt>Status</dt><dd>' + esc(lrLabel(p.lightroom_status)) + '</dd></div>' +
          '<div><dt>Adobe Account</dt><dd>' + esc(lr.adobe_account_email || store.adobeAccount || '—') + '</dd></div>' +
          '<div><dt>Album Name</dt><dd>' + esc(lr.album_name || '—') + '</dd></div>' +
          '<div><dt>Album ID</dt><dd>' + esc(lr.album_id || '—') + '</dd></div>' +
          '<div><dt>Photo Count</dt><dd>' + esc(String(lr.photo_count || 0)) + '</dd></div>' +
          '<div><dt>Edited</dt><dd>' + esc(String(lr.edited_count || 0)) + '</dd></div>' +
          '<div><dt>Favorites</dt><dd>' + esc(String(lr.favorites || 0)) + '</dd></div>' +
          '<div><dt>Last Sync</dt><dd>' + esc(formatRelative(lr.last_sync_at || p.last_sync_at)) + '</dd></div>' +
        '</dl>' +
        '<div class="pp-btn-row">' +
          '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="adobe-connect">Connect Adobe</button>' +
          '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="lr-create-album" data-pp-id="' + esc(p.id) + '">Create Lightroom Album</button>' +
          '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="sync" data-pp-id="' + esc(p.id) + '">Sync Photos</button>' +
          '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="lr-open">Open Lightroom</button>' +
          '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="adobe-disconnect">Disconnect</button>' +
        '</div>' +
      '</section>' +
      '<section class="pp-panel">' +
        '<h3>Recent Sync Activity</h3>' +
        queueList(lr.sync_activity, 'No sync activity yet') +
      '</section>' +
      '<section class="pp-panel"><h3>Upload Queue</h3>' + queueList(lr.upload_queue, 'Upload queue empty') + '</section>' +
      '<section class="pp-panel"><h3>Import Queue</h3>' + queueList(lr.import_queue, 'Import queue empty') + '</section>' +
      '<section class="pp-panel"><h3>Export Queue</h3>' + queueList(lr.export_queue, 'Export queue empty') + '</section>' +
      '</div>';
  }

  function queueList(items, empty) {
    if (!items || !items.length) return '<p class="pp-muted">' + esc(empty) + '</p>';
    return '<ul class="pp-queue">' + items.map(function (it) {
      return '<li><strong>' + esc(it.title || it.name || 'Item') + '</strong><span>' + esc(it.at || it.status || '') + '</span></li>';
    }).join('') + '</ul>';
  }

  function renderGalleryTab(p) {
    var g = p.gallery || {};
    return '<div class="pp-panel-grid">' +
      '<section class="pp-panel">' +
        '<h3>AI Favorites</h3>' +
        '<p class="pp-muted">' + ((g.ai_favorites && g.ai_favorites.length) ? g.ai_favorites.length + ' favorites ready' : 'AI favorites will appear after editing.') + '</p>' +
        '<div class="pp-fav-grid">' +
          [1, 2, 3, 4].map(function () { return '<div class="pp-fav-ph"></div>'; }).join('') +
        '</div>' +
      '</section>' +
      '<section class="pp-panel">' +
        '<h3>Albums</h3>' +
        '<ul class="pp-queue">' + (g.albums || []).map(function (a) {
          return '<li><strong>' + esc(a.name) + '</strong><span>' + esc(String(a.count || 0)) + ' photos</span></li>';
        }).join('') + '</ul>' +
      '</section>' +
      '<section class="pp-panel">' +
        '<h3>Client &amp; Private</h3>' +
        '<dl class="pp-dl">' +
          '<div><dt>Client Gallery</dt><dd>' + (g.client_gallery ? 'On' : 'Off') + '</dd></div>' +
          '<div><dt>Private Gallery</dt><dd>' + (g.private_gallery ? 'On' : 'Off') + '</dd></div>' +
          '<div><dt>Downloads</dt><dd>' + (g.downloads ? 'Enabled' : 'Disabled') + '</dd></div>' +
          '<div><dt>Delivery</dt><dd>' + esc(g.delivery_status || p.gallery_status) + '</dd></div>' +
          '<div><dt>Expiration</dt><dd>' + esc(g.expires_at ? formatDate(g.expires_at) : 'None') + '</dd></div>' +
        '</dl>' +
      '</section>' +
      '<section class="pp-panel">' +
        '<h3>Watermark</h3>' +
        '<label class="pp-check"><input type="checkbox" data-pp-act="gal-wm" data-pp-id="' + esc(p.id) + '"' + ((g.watermark && g.watermark.enabled) ? ' checked' : '') + '><span>Enable watermark</span></label>' +
        '<input class="pp-input" type="text" placeholder="Watermark text" value="' + esc((g.watermark && g.watermark.text) || '') + '" data-pp-act="gal-wm-text" data-pp-id="' + esc(p.id) + '">' +
        '<div class="pp-btn-row pp-mt">' +
          '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="gal-publish" data-pp-id="' + esc(p.id) + '">Publish</button>' +
          '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="gal-share" data-pp-id="' + esc(p.id) + '">Share</button>' +
          '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="gal-download" data-pp-id="' + esc(p.id) + '">Download</button>' +
          '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="gal-hide" data-pp-id="' + esc(p.id) + '">Hide</button>' +
          '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="gal-feature" data-pp-id="' + esc(p.id) + '">Feature</button>' +
        '</div>' +
      '</section></div>';
  }

  function renderContractsTab(p) {
    var list = p.contracts || [];
    return '<section class="pp-panel pp-panel-wide"><div class="pp-between"><h3>Contracts</h3>' +
      '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="contract-add" data-pp-id="' + esc(p.id) + '">+ Contract</button></div>' +
      (list.length ? '<ul class="pp-queue">' + list.map(function (c) {
        return '<li><strong>' + esc(c.title) + '</strong><span>' + esc(c.status) + '</span></li>';
      }).join('') + '</ul>' : '<p class="pp-muted">No contracts yet. Create one without leaving the project.</p>') +
      '</section>';
  }

  function renderInvoicesTab(p) {
    var list = p.invoices || [];
    return '<section class="pp-panel pp-panel-wide"><div class="pp-between"><h3>Invoices</h3>' +
      '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="invoice-add" data-pp-id="' + esc(p.id) + '">+ Invoice</button></div>' +
      '<div class="pp-hero-kpis pp-mb">' +
        kpi('Revenue', money(p.revenue_cents)) +
        kpi('Outstanding', money(p.outstanding_cents)) +
        kpi('Status', invLabel(p.invoice_status).replace('Invoice · ', '')) +
      '</div>' +
      (list.length ? '<ul class="pp-queue">' + list.map(function (inv) {
        return '<li><strong>' + esc(inv.label) + '</strong><span>' + money(inv.amount_cents) + ' · ' + esc(inv.status) + '</span></li>';
      }).join('') + '</ul>' : '<p class="pp-muted">Add a deposit or balance invoice anytime — Adobe not required.</p>') +
      '</section>';
  }

  function renderQuestionnaireTab(p) {
    var q = p.questionnaire || {};
    return '<section class="pp-panel pp-panel-wide"><div class="pp-between"><h3>' + esc(q.title || 'Questionnaire') + '</h3>' +
      '<span class="pp-pill">' + esc(q.status || 'draft') + '</span></div>' +
      '<p class="pp-muted">Collect preferences, shot lists, and family details before the shoot.</p>' +
      '<div class="pp-btn-row">' +
        '<button type="button" class="pp-btn pp-btn-brand" data-pp-act="q-send" data-pp-id="' + esc(p.id) + '">Send to client</button>' +
        '<button type="button" class="pp-btn pp-btn-ghost" data-pp-act="q-complete" data-pp-id="' + esc(p.id) + '">Mark completed</button>' +
      '</div></section>';
  }

  function renderDeliverablesTab(p) {
    var list = p.deliverables || [];
    return '<section class="pp-panel pp-panel-wide"><h3>Deliverables</h3>' +
      '<ul class="pp-queue">' + list.map(function (d, i) {
        return '<li><strong>' + esc(d.title) + '</strong>' +
          '<select data-pp-act="del-status" data-pp-id="' + esc(p.id) + '" data-pp-del="' + i + '">' +
          ['pending', 'in_progress', 'ready', 'delivered'].map(function (s) {
            return '<option value="' + s + '"' + (d.status === s ? ' selected' : '') + '>' + s + '</option>';
          }).join('') + '</select></li>';
      }).join('') + '</ul></section>';
  }

  function renderMarketingTab(p) {
    var editingDone = (p.editing_progress || 0) >= 100 || p.status === 'Proofing' || p.status === 'Delivered';
    return '<section class="pp-panel pp-panel-wide">' +
      '<h3>AI Marketing</h3>' +
      '<p class="pp-muted">' + (editingDone
        ? 'Editing looks complete — these workflows will trigger AI campaigns later.'
        : 'Once editing is complete, Hubly will help turn selects into campaigns.') + '</p>' +
      '<div class="pp-mkt-grid">' +
      (p.marketing || []).map(function (m) {
        return '<div class="pp-mkt-card">' +
          '<div class="pp-mkt-top"><strong>' + esc(m.title) + '</strong><span class="pp-pill">' + esc(m.status) + '</span></div>' +
          '<p class="pp-muted">Placeholder — AI generation comes next.</p>' +
          '<button type="button" class="pp-btn pp-btn-ghost pp-btn-sm" data-pp-act="mkt-ready" data-pp-id="' + esc(p.id) + '" data-pp-ch="' + esc(m.channel) + '">Mark ready</button>' +
          '</div>';
      }).join('') +
      '</div></section>';
  }

  function renderNotesTab(p) {
    return '<section class="pp-panel pp-panel-wide"><h3>Notes</h3>' +
      '<textarea class="pp-notes" rows="10" data-pp-act="notes" data-pp-id="' + esc(p.id) + '" placeholder="Creative notes, shot list ideas, delivery preferences…">' +
      esc(p.notes || '') + '</textarea></section>';
  }

  function renderActivityTab(p) {
    var list = (p.activity || []).slice().reverse();
    return '<section class="pp-panel pp-panel-wide"><h3>Activity</h3>' +
      (list.length ? '<ul class="pp-queue">' + list.map(function (a) {
        return '<li><strong>' + esc(a.action) + '</strong><span>' + esc(a.detail || '') + ' · ' + esc(formatRelative(a.created_at)) + '</span></li>';
      }).join('') + '</ul>' : '<p class="pp-muted">No activity yet.</p>') +
      '</section>';
  }

  /* ─── Render / actions ──────────────────────────────────────────────── */

  function renderPhotoProjects() {
    var root = ownRoot();
    if (!root) return;
    setPhotoProjectsMode(true);
    try {
      if (global.HublyJourneyOS && typeof global.HublyJourneyOS.updateChrome === 'function') {
        /* chrome updated via CHROME map if present */
      }
      var titleEl = el('bar-title');
      var subEl = el('bar-sub');
      if (titleEl) titleEl.textContent = 'Photography Projects';
      if (subEl) subEl.textContent = 'Projects from booking through delivery.';
      if (typeof global.setHublyDocTitle === 'function') global.setHublyDocTitle('Photography Projects');
    } catch (e) {}

    var store = ensureSeed(loadStore());
    var st = getState(root);
    var html = '';
    if (st.view === 'wizard') {
      html = renderWizard(root, store, st);
    } else if (st.view === 'command' && st.projectId) {
      var p = findProject(store, st.projectId);
      if (!p) {
        st.view = 'dashboard';
        st.projectId = null;
        html = renderDashboard(root, store, st);
      } else {
        html = renderCommand(root, store, st, p);
      }
    } else {
      st.view = 'dashboard';
      html = renderDashboard(root, store, st);
    }
    root.innerHTML = html;
    bindPhotoProjects(root);
  }

  function persistProject(store, project) {
    project.updated_at = new Date().toISOString();
    var i = store.projects.findIndex(function (x) { return x.id === project.id; });
    if (i >= 0) store.projects[i] = project;
    else store.projects.unshift(project);
    saveStore(store);
  }

  function addActivity(p, action, detail) {
    p.activity = p.activity || [];
    p.activity.push({ id: uid(), action: action, detail: detail || '', created_at: new Date().toISOString() });
  }

  function createFromWizard(store, w) {
    var clientName = w.client_mode === 'existing' ? w.existing_client : w.client_name;
    var p = seedProject({
      name: w.name || 'Untitled Project',
      project_type: w.project_type || 'Other',
      shoot_date: w.shoot_date || null,
      location: w.location || '',
      estimated_photos: w.estimated_photos ? Number(w.estimated_photos) : null,
      notes: w.notes || '',
      client_name: clientName || '',
      client_email: w.client_email || '',
      client_phone: w.client_phone || '',
      client_address: w.client_address || '',
      client_relationship: w.client_relationship || '',
      team: Object.assign({}, w.team),
      status: 'Lead'
    });

    if (w.assets.contract) {
      p.contracts.push({ id: uid(), title: 'Photography Agreement', status: 'draft' });
    }
    if (w.assets.invoice) {
      p.invoices.push({ id: uid(), label: 'Deposit', kind: 'deposit', status: 'draft', amount_cents: 0 });
      p.invoice_status = 'draft';
    }
    if (w.assets.questionnaire) {
      p.questionnaire = { status: 'draft', title: 'Client Questionnaire', answers: {} };
    }
    if (w.assets.shot_list) {
      p.shot_list = [{ id: uid(), title: 'Must-have shots', items: [] }];
    }
    if (w.assets.gallery) {
      p.gallery_status = 'draft';
    }
    if (w.assets.lightroom) {
      p.lightroom.album_name = p.name;
      p.lightroom_status = 'not_connected';
    }
    if (!w.assets.timeline) {
      /* keep defaults anyway — timeline is core */
    }
    if (!w.assets.marketing) {
      p.marketing = p.marketing.map(function (m) { return Object.assign({}, m, { status: 'skipped' }); });
    }

    addActivity(p, 'Project created', p.name);
    persistProject(store, p);
    return p;
  }

  function bindPhotoProjects(root) {
    if (!root._ppBound) {
      root._ppBound = true;
      root.addEventListener('click', onClick);
      root.addEventListener('change', onChange);
      root.addEventListener('input', onInput);
    }
  }

  function onClick(e) {
    var t = e.target.closest('[data-pp-act]');
    if (!t) return;
    var act = t.getAttribute('data-pp-act');
    var root = el('jos-photo-projects-root');
    if (!root) return;
    var store = ensureSeed(loadStore());
    var st = getState(root);
    var id = t.getAttribute('data-pp-id');
    var p = id ? findProject(store, id) : (st.projectId ? findProject(store, st.projectId) : null);

    if (act === 'new') {
      st.view = 'wizard';
      st.wizardStep = 1;
      st.wizard = blankWizard();
      return renderPhotoProjects();
    }
    if (act === 'wiz-cancel' || act === 'back-dash') {
      st.view = 'dashboard';
      st.projectId = null;
      st.wizard = null;
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
      if ((st.wizardStep || 1) === 1 && !(st.wizard && st.wizard.name.trim())) {
        toast('Add a project name');
        return;
      }
      st.wizardStep = Math.min(4, (st.wizardStep || 1) + 1);
      return renderPhotoProjects();
    }
    if (act === 'wiz-create') {
      var created = createFromWizard(store, st.wizard || blankWizard());
      st.view = 'command';
      st.projectId = created.id;
      st.tab = 'overview';
      st.wizard = null;
      toast('Project created');
      return renderPhotoProjects();
    }
    if (act === 'open' && id) {
      st.view = 'command';
      st.projectId = id;
      st.tab = 'overview';
      return renderPhotoProjects();
    }
    if (act === 'tab') {
      st.tab = t.getAttribute('data-pp-tab') || 'overview';
      return renderPhotoProjects();
    }
    if (act === 'gallery' && p) {
      st.view = 'command';
      st.projectId = p.id;
      st.tab = 'gallery';
      return renderPhotoProjects();
    }
    if (act === 'invoice' && p) {
      st.view = 'command';
      st.projectId = p.id;
      st.tab = 'invoices';
      return renderPhotoProjects();
    }
    if (act === 'sync' && p) {
      return syncLightroom(store, p).then(function () { renderPhotoProjects(); });
    }
    if (act === 'deliver' && p) {
      p.gallery_status = 'delivered';
      p.status = 'Delivered';
      if (p.gallery) p.gallery.delivery_status = 'delivered';
      (p.deliverables || []).forEach(function (d) {
        if (d.kind === 'gallery') d.status = 'delivered';
      });
      addActivity(p, 'Gallery delivered', 'Client delivery marked complete');
      persistProject(store, p);
      toast('Marked delivered');
      st.view = 'command';
      st.projectId = p.id;
      st.tab = 'gallery';
      return renderPhotoProjects();
    }
    if (act === 'adobe-connect') {
      return connectAdobe(store).then(function () { renderPhotoProjects(); });
    }
    if (act === 'adobe-disconnect') {
      store.adobeConnected = false;
      store.adobeAccount = null;
      store.projects.forEach(function (proj) {
        if (proj.lightroom) proj.lightroom.connection_status = 'not_connected';
        proj.lightroom_status = 'not_connected';
      });
      saveStore(store);
      toast('Adobe disconnected in Hubly');
      return renderPhotoProjects();
    }
    if (act === 'lr-create-album' && p) {
      return createAlbum(store, p).then(function () { renderPhotoProjects(); });
    }
    if (act === 'lr-open') {
      toast('Open Adobe Lightroom on your desktop to continue editing');
      return;
    }
    if (act === 'gal-publish' && p) {
      return publishGallery(store, p).then(function () { renderPhotoProjects(); });
    }
    if (act === 'gal-share' && p) {
      p.gallery_status = 'published';
      addActivity(p, 'Gallery shared', 'Share link ready');
      persistProject(store, p);
      toast('Share link ready (preview)');
      return renderPhotoProjects();
    }
    if (act === 'gal-download' && p) {
      if (p.gallery) p.gallery.downloads = true;
      persistProject(store, p);
      toast('Downloads enabled');
      return renderPhotoProjects();
    }
    if (act === 'gal-hide' && p) {
      p.gallery_status = 'private';
      if (p.gallery) p.gallery.delivery_status = 'private';
      persistProject(store, p);
      toast('Gallery hidden');
      return renderPhotoProjects();
    }
    if (act === 'gal-feature' && p) {
      addActivity(p, 'Featured selects', 'Marked for marketing');
      persistProject(store, p);
      toast('Featured for marketing');
      return renderPhotoProjects();
    }
    if (act === 'contract-add' && p) {
      p.contracts.push({ id: uid(), title: 'Photography Agreement', status: 'draft' });
      addActivity(p, 'Contract added', 'Draft');
      persistProject(store, p);
      return renderPhotoProjects();
    }
    if (act === 'invoice-add' && p) {
      p.invoices.push({ id: uid(), label: 'Balance', kind: 'balance', status: 'draft', amount_cents: p.outstanding_cents || 0 });
      p.invoice_status = 'draft';
      addActivity(p, 'Invoice added', 'Draft');
      persistProject(store, p);
      return renderPhotoProjects();
    }
    if (act === 'q-send' && p) {
      p.questionnaire.status = 'sent';
      addActivity(p, 'Questionnaire sent', p.client_email || p.client_name || '');
      persistProject(store, p);
      toast('Questionnaire marked sent');
      return renderPhotoProjects();
    }
    if (act === 'q-complete' && p) {
      p.questionnaire.status = 'completed';
      persistProject(store, p);
      return renderPhotoProjects();
    }
    if (act === 'mkt-ready' && p) {
      var ch = t.getAttribute('data-pp-ch');
      (p.marketing || []).forEach(function (m) {
        if (m.channel === ch) m.status = 'ready';
      });
      persistProject(store, p);
      return renderPhotoProjects();
    }
  }

  function onChange(e) {
    var t = e.target;
    var root = el('jos-photo-projects-root');
    if (!root) return;
    var store = ensureSeed(loadStore());
    var st = getState(root);

    if (t.hasAttribute('data-pp-field')) {
      st[t.getAttribute('data-pp-field')] = t.value;
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
    if (t.getAttribute('data-pp-act') === 'set-status') {
      var p = findProject(store, t.getAttribute('data-pp-id'));
      if (!p) return;
      p.status = t.value;
      addActivity(p, 'Status changed', p.status);
      persistProject(store, p);
      return renderPhotoProjects();
    }
    if (t.getAttribute('data-pp-act') === 'tl-toggle') {
      p = findProject(store, t.getAttribute('data-pp-id'));
      var idx = Number(t.getAttribute('data-pp-tl'));
      if (p && p.timeline[idx]) {
        p.timeline[idx].completed = !!t.checked;
        p.timeline[idx].occurred_at = t.checked ? new Date().toISOString() : null;
        persistProject(store, p);
        return renderPhotoProjects();
      }
    }
    if (t.getAttribute('data-pp-act') === 'tl-date') {
      p = findProject(store, t.getAttribute('data-pp-id'));
      idx = Number(t.getAttribute('data-pp-tl'));
      if (p && p.timeline[idx]) {
        p.timeline[idx].occurred_at = t.value ? new Date(t.value).toISOString() : null;
        persistProject(store, p);
      }
      return;
    }
    if (t.getAttribute('data-pp-act') === 'gal-wm') {
      p = findProject(store, t.getAttribute('data-pp-id'));
      if (p && p.gallery) {
        p.gallery.watermark = p.gallery.watermark || {};
        p.gallery.watermark.enabled = !!t.checked;
        persistProject(store, p);
      }
      return;
    }
    if (t.getAttribute('data-pp-act') === 'del-status') {
      p = findProject(store, t.getAttribute('data-pp-id'));
      idx = Number(t.getAttribute('data-pp-del'));
      if (p && p.deliverables[idx]) {
        p.deliverables[idx].status = t.value;
        persistProject(store, p);
        return renderPhotoProjects();
      }
    }
    if (t.getAttribute('data-pp-act') === 'edit-progress') {
      p = findProject(store, t.getAttribute('data-pp-id'));
      if (p) {
        p.editing_progress = Number(t.value) || 0;
        persistProject(store, p);
        return renderPhotoProjects();
      }
    }
  }

  function onInput(e) {
    var t = e.target;
    var root = el('jos-photo-projects-root');
    if (!root) return;
    var store = ensureSeed(loadStore());
    var st = getState(root);

    if (t.getAttribute('data-pp-field') === 'search') {
      st.search = t.value;
      clearTimeout(root._ppSearchT);
      root._ppSearchT = setTimeout(function () { renderPhotoProjects(); }, 180);
      return;
    }
    if (t.hasAttribute('data-pp-w')) {
      setWizardPath(st.wizard || (st.wizard = blankWizard()), t.getAttribute('data-pp-w'), t.value);
      return;
    }
    var act = t.getAttribute('data-pp-act');
    var p = findProject(store, t.getAttribute('data-pp-id'));
    if (!p) return;
    if (act === 'tl-label' || act === 'tl-notes') {
      var idx = Number(t.getAttribute('data-pp-tl'));
      if (p.timeline[idx]) {
        if (act === 'tl-label') p.timeline[idx].label = t.value;
        else p.timeline[idx].notes = t.value;
        persistProject(store, p);
      }
    }
    if (act === 'notes') {
      p.notes = t.value;
      persistProject(store, p);
    }
    if (act === 'gal-wm-text') {
      p.gallery = p.gallery || {};
      p.gallery.watermark = p.gallery.watermark || {};
      p.gallery.watermark.text = t.value;
      persistProject(store, p);
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

  async function connectAdobe(store) {
    var svc = lightroom();
    var bid = S().businessId || '';
    if (svc) {
      var res = await svc.connect({ businessId: bid });
      if (res && res.ok && res.data && res.data.authorizeUrl) {
        location.href = res.data.authorizeUrl;
        return;
      }
    }
    // Honest: Adobe APIs not wired. Do not fake a live Adobe session.
    toast('Adobe Lightroom isn’t connected yet. Projects, galleries, and delivery still work in Hubly.');
  }

  async function createAlbum(store, p) {
    var svc = lightroom();
    if (svc) await svc.createAlbum({ businessId: S().businessId || '', projectId: p.id, name: p.name });
    p.lightroom = p.lightroom || {};
    p.lightroom.album_name = p.name;
    p.lightroom.album_id = p.lightroom.album_id || ('local-' + p.id.slice(-6));
    addActivity(p, 'Album prepared', 'Hubly project album ready — Lightroom sync when Adobe is connected');
    persistProject(store, p);
    toast('Project album ready in Hubly. Connect Adobe to sync with Lightroom.');
  }

  async function syncLightroom(store, p) {
    var svc = lightroom();
    if (svc) await svc.syncProject({ businessId: S().businessId || '', projectId: p.id });
    addActivity(p, 'Sync requested', 'Lightroom sync requires Adobe connection');
    persistProject(store, p);
    toast('Connect Adobe to sync Lightroom. You can still upload and deliver in Hubly.');
  }

  async function publishGallery(store, p) {
    var svc = lightroom();
    if (svc) await svc.publishGallery({ businessId: S().businessId || '', projectId: p.id, galleryId: 'main' });
    p.gallery_status = 'published';
    if (p.gallery) p.gallery.delivery_status = 'published';
    addActivity(p, 'Gallery published', 'Client gallery live');
    persistProject(store, p);
    toast('Gallery published');
  }

  function syncPhotographyNav() {
    var nav = document.querySelector('.ni[data-v="photo-projects"]');
    if (!nav) return;
    var show = false;
    try {
      if (typeof global.isPhotoLedTrade === 'function') show = !!global.isPhotoLedTrade();
      else {
        var id = String((S().businessType || '')).toLowerCase();
        show = id === 'photography' || id.indexOf('photo') !== -1 || id === 'weddings';
      }
    } catch (e) {}
    nav.hidden = !show;
    nav.setAttribute('aria-hidden', show ? 'false' : 'true');
    nav.classList.toggle('jos-nav-hidden', !show);
  }

  function setPhotoProjectsModeExport(on) {
    setPhotoProjectsMode(on);
  }

  // Attach to JourneyOS when ready
  function attach() {
    global.HublyPhotographyProjects = {
      render: renderPhotoProjects,
      syncNav: syncPhotographyNav,
      setMode: setPhotoProjectsModeExport
    };
    if (global.HublyJourneyOS) {
      global.HublyJourneyOS.renderPhotoProjects = renderPhotoProjects;
      global.HublyJourneyOS.syncPhotographyNav = syncPhotographyNav;
      global.HublyJourneyOS.setPhotoProjectsMode = setPhotoProjectsModeExport;
    }
    syncPhotographyNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
  // Re-attach after journey.js if it loads later
  setTimeout(attach, 0);
  setTimeout(attach, 500);
  setTimeout(syncPhotographyNav, 800);
  setTimeout(syncPhotographyNav, 2000);

  global.addEventListener('hubly:business-loaded', syncPhotographyNav);
  global.addEventListener('hubly:blueprint-changed', syncPhotographyNav);

})(typeof window !== 'undefined' ? window : globalThis);
