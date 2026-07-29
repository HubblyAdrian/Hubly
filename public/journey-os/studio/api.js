/**
 * Hubly Studio API client — invokes studio-api Edge Function.
 */
(function (global) {
  'use strict';

  function bizId() {
    var st = global.S || {};
    return st.businessId || st.bizId || (global.currentBusiness && currentBusiness.id) || null;
  }

  function invoke(path, opts) {
    opts = opts || {};
    var method = opts.method || 'GET';
    var body = opts.body;
    var qs = opts.query || {};
    var id = bizId();
    if (id) qs.business_id = id;
    var q = Object.keys(qs)
      .filter(function (k) { return qs[k] != null && qs[k] !== ''; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(String(qs[k])); })
      .join('&');
    var url = 'studio-api/' + String(path || '').replace(/^\//, '') + (q ? '?' + q : '');

    var db = global._hublyDb || global.supabaseClient || (global.supabase && global.supabase);
    if (db && db.functions && typeof db.functions.invoke === 'function') {
      return db.functions.invoke(url.replace(/\?.*$/, ''), {
        method: method,
        body: method === 'GET' ? undefined : Object.assign({ business_id: id }, body || {}),
        headers: q ? undefined : undefined
      }).then(function (res) {
        if (res.error) throw res.error;
        return res.data;
      }).catch(function (err) {
        // Fallback: path-style invoke may fail — try body-only
        return Promise.reject(err);
      });
    }

    // Offline / Stage-1 local fallback
    return Promise.resolve({ _local: true, error: 'studio_api_unavailable' });
  }

  /** Prefer fetch through supabase functions URL when available */
  function request(path, opts) {
    opts = opts || {};
    var method = (opts.method || 'GET').toUpperCase();
    var body = opts.body || {};
    var id = bizId();
    if (id) body.business_id = id;

    var client = global.supabase || global._hublySupabase;
    if (client && client.functions && typeof client.functions.invoke === 'function') {
      var fnPath = String(path || '').replace(/^\//, '');
      // supabase-js invoke uses function name only; pass path in body for router-less APIs
      return client.functions.invoke('studio-api', {
        method: method === 'GET' ? 'POST' : method,
        body: Object.assign({ _method: method, _path: '/' + fnPath }, method === 'GET' ? { business_id: id } : body)
      }).then(function (res) {
        if (res.error) throw new Error(res.error.message || 'studio-api error');
        return res.data;
      }).catch(function () {
        return localFallback(path, method, body);
      });
    }
    return localFallback(path, method, body);
  }

  function localFallback(path, method, body) {
    var st = global.S || {};
    if (!st.studioOs || typeof st.studioOs !== 'object') st.studioOs = { projects: [], queue: [], assets: [], brandKit: null, settings: {} };
    var os = st.studioOs;
    var p = String(path || '').replace(/^\//, '');

    if (p === 'dashboard' && method === 'GET') {
      return Promise.resolve({
        _local: true,
        settings: os.settings || {},
        recentProjects: os.projects || [],
        queue: os.queue || [],
        socialAccounts: os.socialAccounts || []
      });
    }
    if (p === 'projects' && method === 'GET') {
      return Promise.resolve({ _local: true, projects: os.projects || [] });
    }
    if (p === 'projects' && method === 'POST') {
      var proj = {
        id: 'loc_' + Math.random().toString(36).slice(2, 9),
        title: body.title || 'Untitled project',
        status: 'draft',
        format_primary: body.format_primary || 'instagram_post',
        platform: body.platform || 'instagram',
        style: body.style || 'bold',
        tone: body.tone || 'expert',
        prompt: body.prompt || '',
        canvas: body.canvas || {},
        last_edited_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };
      os.projects = os.projects || [];
      os.projects.unshift(proj);
      return Promise.resolve({ _local: true, project: proj });
    }
    if (p.indexOf('projects/') === 0 && method === 'PATCH') {
      var pid = p.split('/')[1];
      var found = (os.projects || []).find(function (x) { return x.id === pid; });
      if (found) Object.assign(found, body, { last_edited_at: new Date().toISOString() });
      return Promise.resolve({ _local: true, project: found });
    }
    if (p === 'queue' && method === 'GET') {
      return Promise.resolve({ _local: true, queue: os.queue || [] });
    }
    if (p === 'queue' && method === 'POST') {
      var item = {
        id: 'q_' + Math.random().toString(36).slice(2, 9),
        title: body.title,
        caption: body.caption || '',
        channels: body.channels || [],
        scheduled_at: body.scheduled_at || null,
        status: body.status || 'draft',
        project_id: body.project_id || null
      };
      os.queue = os.queue || [];
      os.queue.unshift(item);
      return Promise.resolve({ _local: true, item: item });
    }
    if (p === 'brand-kit' && method === 'GET') {
      return Promise.resolve({
        _local: true,
        brandKit: os.brandKit || {
          logos: [],
          colors: [
            { name: 'Hubly Orange', hex: '#D9632D' },
            { name: 'Dark Navy', hex: '#1E293B' },
            { name: 'Warm White', hex: '#FCFCFC' },
            { name: 'Accent Orange', hex: '#D97706' },
            { name: 'Light Gray', hex: '#F8FAFC' },
            { name: 'Success Green', hex: '#10B981' }
          ],
          typography: { heading: 'Plus Jakarta Sans', body: 'DM Sans' },
          voice_tones: [
            { id: 'professional', label: 'Professional', status: 'active', blurb: 'Expert technical guidance, high quality standards.' },
            { id: 'friendly', label: 'Friendly & Warm', status: 'active', blurb: 'Local neighborhood helper tone.' },
            { id: 'direct', label: 'Clear & Direct', status: 'supporting', blurb: 'Straightforward quotes and checklists.' }
          ]
        }
      });
    }
    if (p === 'brand-kit' && (method === 'PUT' || method === 'PATCH')) {
      os.brandKit = Object.assign({}, os.brandKit || {}, body);
      return Promise.resolve({ _local: true, brandKit: os.brandKit });
    }
    if (p === 'templates' && method === 'GET') {
      return Promise.resolve({
        _local: true,
        templates: [
          { id: 't1', title: 'Premium Heat Checkup', category: 'print', format: 'print_flyer', featured: true },
          { id: 't2', title: "Mrs. Miller's Review Post", category: 'social', format: 'instagram_post', featured: true },
          { id: 't3', title: 'Emergency Leak Special', category: 'local', format: 'google_business', featured: true },
          { id: 't4', title: 'Kitchen Restoration Classic', category: 'social', format: 'instagram_post', featured: false },
          { id: 't5', title: 'A/C Tune-Up Seasonal Offer', category: 'email', format: 'email_header', featured: false },
          { id: 't6', title: 'Referral Rewards Banner', category: 'print', format: 'print_flyer', featured: false }
        ]
      });
    }
    if (p === 'settings' && method === 'GET') {
      return Promise.resolve({
        _local: true,
        settings: os.settings || {
          enabled: true,
          storage_used_bytes: 4509715660,
          storage_quota_bytes: 10737418240,
          canva_linked: false
        }
      });
    }
    return Promise.resolve({ _local: true, ok: true });
  }

  global.HublyStudioApi = {
    request: request,
    bizId: bizId,
    localFallback: localFallback
  };
})(typeof window !== 'undefined' ? window : globalThis);
