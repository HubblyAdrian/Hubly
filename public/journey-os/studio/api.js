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
        sources: { hubly: true, canva: false, ai_generated: true },
        templates: [
          { id: 'before_after', title: 'Before & After', category: 'proof', format: 'instagram_post', featured: true, source: 'hubly' },
          { id: 'review_highlight', title: 'Review Highlight', category: 'social', format: 'instagram_post', featured: true, source: 'hubly' },
          { id: 'membership_promotion', title: 'Membership Promotion', category: 'growth', format: 'facebook_post', featured: true, source: 'hubly' },
          { id: 'holiday_campaign', title: 'Holiday Campaign', category: 'seasonal', format: 'instagram_post', featured: true, source: 'hubly' },
          { id: 'referral_campaign', title: 'Referral Campaign', category: 'growth', format: 'print_flyer', featured: false, source: 'hubly' },
          { id: 'seasonal_offer', title: 'Seasonal Offer', category: 'seasonal', format: 'instagram_post', featured: false, source: 'hubly' }
        ]
      });
    }
    if (p === 'campaign/goals' && method === 'GET') {
      return Promise.resolve({
        _local: true,
        goals: [
          { id: 'get_more_reviews', label: 'Get More Reviews' },
          { id: 'fill_tomorrow_schedule', label: "Fill Tomorrow's Schedule" },
          { id: 'promote_service', label: 'Promote a Service' },
          { id: 'win_back_customers', label: 'Win Back Old Customers' },
          { id: 'seasonal_promotion', label: 'Seasonal Promotion' },
          { id: 'membership_drive', label: 'Membership Drive' }
        ]
      });
    }
    if (p === 'campaign/plan' && method === 'POST') {
      var goalId = body.goal_id || 'book_more_jobs';
      var title = body.service_focus
        ? ('Promote ' + body.service_focus)
        : (goalId === 'get_more_reviews' ? 'Review Spotlight'
          : goalId === 'fill_tomorrow_schedule' ? 'OpenSlots Tomorrow'.replace('OpenSlots', 'Open Slots')
          : goalId === 'membership_drive' ? 'Membership Drive'
          : goalId === 'win_back_customers' ? 'We Miss You'
          : goalId === 'seasonal_promotion' ? 'Seasonal Promotion'
          : 'Before & After Highlight');
      var plan = {
        playbook_id: 'local_' + goalId,
        goal_id: goalId,
        industry_id: 'home_services',
        title: title,
        objective: 'Structured local campaign plan',
        channels: ['instagram', 'facebook', 'google_business'],
        required_assets: [{ key: 'logo', required: true }],
        messaging_strategy: 'Hubly playbook-driven',
        cta: 'Book now',
        timing: { season: 'any', month: new Date().getMonth() + 1, schedule_hints: ['Tomorrow 12:00 PM'] },
        template_refs: [{ source: 'hubly', id: 'before_after' }],
        offer: { type: 'none', summary: '' },
        audience: 'local_prospects',
        ai_brief: 'Campaign: ' + title,
        business_inputs: { business_name: body.business_name || 'Your business' },
        dna_inputs: {},
        package: {
          headlines: [title],
          captions: [{ channel: 'instagram', text: title + ' — from Hubly Studio' }],
          hashtags: ['#LocalBusiness'],
          email: { subject: title, body: title },
          sms: title.slice(0, 160),
          google_business_post: title,
          schedule_suggestions: ['Tomorrow 12:00 PM — peak local engagement window']
        }
      };
      var proj = {
        id: 'loc_' + Math.random().toString(36).slice(2, 9),
        title: title,
        status: 'draft',
        format_primary: 'instagram_post',
        prompt: plan.ai_brief,
        canvas: { headline: title, package: plan.package },
        metadata: { goal_id: goalId },
        last_edited_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };
      os.projects = os.projects || [];
      os.projects.unshift(proj);
      return Promise.resolve({ _local: true, campaignPlan: plan, project: proj, persisted: false });
    }
    if (p.indexOf('projects/') === 0 && p.indexOf('/customize') > 0 && method === 'POST') {
      return Promise.resolve({
        _local: true,
        error: 'Provider not configured',
        message: 'Connect Canva via Apps to customize designs. Hubly keeps your project ready.'
      });
    }
    if (p.indexOf('projects/') === 0 && p.indexOf('/workspace') > 0 && method === 'GET') {
      var wid = p.split('/')[1];
      var wproj = (os.projects || []).find(function (x) { return x.id === wid; }) || null;
      return Promise.resolve({
        _local: true,
        project: wproj,
        pages: [],
        versions: wproj ? [{ version_number: 1, label: 'Created in Hubly Studio', source: 'hubly' }] : [],
        exports: [],
        assets: [],
        campaignPlan: null,
        canva: { linked: false, design_id: null, status: 'Provider not configured' }
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
