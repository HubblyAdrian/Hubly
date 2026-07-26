/**
 * Hubly Journey OS — Operate UI render helpers (vanilla, no modules).
 * Uses global S + optional: escapeHtml, fmtDateLong, fmtMoney, toast, switchV,
 * viewCustomer, viewLead, openM, askAI, previewProfile, openSmartQuote, goStripeConnect.
 */
(function (global) {
  'use strict';

  var PIPE_STAGES = [
    { id: 'new_inquiry', label: 'New Inquiry', dot: 'new' },
    { id: 'incomplete_quote', label: 'Incomplete Quote', dot: 'incomplete' },
    { id: 'quoted', label: 'Quoted', dot: 'quoted' },
    { id: 'booked', label: 'Booked', dot: 'booked' },
    { id: 'completed', label: 'Completed', dot: 'completed' },
    { id: 'returning', label: 'Returning Customer', dot: 'returning' },
    { id: 'membership', label: 'Membership', dot: 'membership' }
  ];
  var PROFILE_TABS = ['Overview', 'Jobs', 'Bookings', 'Reviews', 'Notes', 'History', 'Files', 'Activity'];
  var ASK_CHIPS = ['Who should I follow up with today?', 'Draft a win-back text', 'What membership should I offer?', 'Summarize this week’s revenue', 'Who needs a rebook nudge?'];
  var POPULAR_ASKS = [
    { t: 'Recover abandoned bookings', s: 'Draft follow-ups for unfinished starts.' },
    { t: 'Price my packages', s: 'Clearer tiers from quotes and jobs.' },
    { t: 'Ask for reviews', s: 'Completed jobs ready for a review ask.' },
    { t: 'Fill tomorrow’s open slots', s: 'Match capacity with warm leads.' },
    { t: 'Membership upsell list', s: 'Customers with 3+ jobs, not recurring.' },
    { t: 'Rewrite my booking CTA', s: 'Make Book Now convert better.' }
  ];

  function S() { return global.S || {}; }
  function esc(v) {
    if (typeof global.escapeHtml === 'function') return global.escapeHtml(v);
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function money(n) {
    if (typeof global.fmtMoney === 'function') return global.fmtMoney(n);
    if (global.HublySmartQuote && HublySmartQuote.formatMoney) return HublySmartQuote.formatMoney(n);
    var x = Number(n); return Number.isFinite(x) ? ('$' + x.toFixed(x % 1 ? 2 : 0)) : '';
  }
  function dateLong(ds) {
    if (!ds) return '';
    if (typeof global.fmtDateLong === 'function') { try { return global.fmtDateLong(String(ds).slice(0, 10)); } catch (e) {} }
    try { return new Date(String(ds).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
    catch (e) { return String(ds).slice(0, 10); }
  }
  function toast(msg) { if (typeof global.toast === 'function') global.toast(msg); }
  function el(id) { return document.getElementById(id); }
  function hasTwilio() { var st = S(); return !!(st.twilio || st.twilioReady || st.smsReady || st.messaging?.twilio || st.integrations?.twilio); }
  function initials(name) {
    var p = String(name || '?').trim().split(/\s+/).filter(Boolean);
    return !p.length ? '?' : (p.length === 1 ? p[0].slice(0, 2) : (p[0][0] + p[p.length - 1][0])).toUpperCase();
  }
  function ask(q) {
    var text = String(q || '').trim(); if (!text) return;
    if (typeof global.askAI === 'function') return global.askAI(text);
    var input = el('ai-question-input') || el('jos-ask-input'); if (input) input.value = text;
    toast('Ask Hubly: ' + text);
  }
  function copyText(t) {
    t = String(t || ''); if (!t) return;
    function ok() { toast('Message copied'); }
    function fb() { try { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); ok(); } catch (e) { toast(t); } }
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(t).then(ok).catch(fb); else fb();
  }
  function page(kicker, title, sub, actions, body) {
    return '<div class="jos-page"><div class="jos-head"><div><div class="jos-kicker">' + esc(kicker) + '</div><h1>' + esc(title) + '</h1><p>' + sub + '</p></div>' +
      (actions ? '<div class="jos-head-actions">' + actions + '</div>' : '') + '</div>' + body + '</div>';
  }
  function btn(act, label, cls) { return '<button type="button" class="jos-btn ' + (cls || 'jos-btn-sm') + '" data-jos-act="' + esc(act) + '">' + esc(label) + '</button>'; }
  function tile(ico, title, body, act, cta) {
    return '<div class="jos-tile"><div class="jos-tile-ico">' + ico + '</div><h3>' + esc(title) + '</h3><p>' + esc(body) + '</p><div class="jos-mt">' + btn(act, cta) + '</div></div>';
  }
  function srcKind(raw, lead) {
    var s = String(raw || lead?.source || '').toLowerCase();
    var notes = String(lead?.notes || lead?.sourceDetail || '').toLowerCase();
    var blob = s + ' ' + notes;
    if (/google|gmb|maps/.test(blob)) return 'google';
    if (/facebook|fb|meta/.test(blob)) return 'facebook';
    if (/instagram|ig\b/.test(blob)) return 'instagram';
    if (s === 'booking' || s === 'hubly' || /hubly/.test(notes)) return 'hubly';
    if (s === 'website' || /website|landing/.test(notes)) return 'website';
    if (s === 'chat') return 'chat';
    if (s === 'quote' || s === 'smart_quote') return 'quote';
    if (s === 'abandoned') return 'abandoned';
    if (s === 'membership') return 'membership';
    return 'manual';
  }
  var SRC_LABEL = { google: 'Google', facebook: 'Facebook', instagram: 'Instagram', hubly: 'Hubly', website: 'Website', chat: 'Chat', quote: 'Quote', abandoned: 'Abandoned', membership: 'Membership', manual: 'Manual' };
  var SRC_LETTER = { google: 'G', facebook: 'f', instagram: 'Ig', hubly: 'h', website: 'W', chat: '💬', quote: 'Q', abandoned: '…', membership: 'M', manual: '+' };
  function srcLabel(k) { return SRC_LABEL[k] || 'Manual'; }
  function srcIco(k) { return '<span class="jos-src-ico ' + esc(k) + '" title="' + esc(srcLabel(k)) + '">' + (SRC_LETTER[k] || '+') + '</span>'; }
  function vehicleOf(o) { return o?.vehicle || o?.vehicleLabel || o?.car || (o?.answers && (o.answers.vehicle || o.answers.vehicle_type)) || ''; }
  function collectLeads() { try { return typeof global.collectPipelineLeads === 'function' ? (global.collectPipelineLeads() || []) : []; } catch (e) { return []; } }
  function jobs() { return Array.isArray(S().jobs) ? S().jobs : []; }
  function customers() { return Array.isArray(S().customers) ? S().customers : []; }
  function quotes() { var st = S(); return Array.isArray(st.smartQuotes) && st.smartQuotes.length ? st.smartQuotes : (Array.isArray(st.quotes) ? st.quotes : []); }
  function jobActive(j) { return j && !j.isBlock && j.status !== 'pending'; }

  function mapLeadStage(lead) {
    var stage = String(lead.stage || '').toLowerCase(), role = '';
    try { if (typeof global.leadStageById === 'function') role = global.leadStageById(lead.stage)?.role || ''; } catch (e) {}
    if (lead.source === 'membership' || lead.isMembershipSignup) return 'membership';
    if (lead.isReturning || lead.isRecurring) return 'returning';
    if (role === 'won' || stage === 'won') {
      var match = jobs().find(function (j) { return j.customer === lead.name || (lead.phone && j.phone === lead.phone); });
      return match && match.status === 'completed' ? 'completed' : 'booked';
    }
    if (role === 'quote' || stage === 'quote_sent' || /quote/.test(stage)) {
      var notes = String(lead.notes || '');
      if ((/\[QUOTE_STATUS:draft\]/i.test(notes) && !/\[QUOTE_STATUS:sent\]/i.test(notes)) || lead.source === 'abandoned') return 'incomplete_quote';
      return 'quoted';
    }
    if (stage === 'incomplete' || lead.source === 'abandoned') return 'incomplete_quote';
    return 'new_inquiry';
  }

  function demoPipelineCards() {
    return [
      { id: 'd1', stageId: 'new_inquiry', name: 'Alex Rivera', source: 'google', service: 'Full detail' },
      { id: 'd2', stageId: 'incomplete_quote', name: 'Sam Chen', source: 'website', service: 'Exterior wash', vehicle: 'SUV', amount: 89 },
      { id: 'd3', stageId: 'quoted', name: 'Jordan Lee', source: 'instagram', service: 'Interior + ceramic', vehicle: 'Sedan', amount: 249 },
      { id: 'd4', stageId: 'booked', name: 'Taylor Brooks', source: 'hubly', service: 'Mobile detail', date: dateLong(new Date().toISOString().slice(0, 10)) },
      { id: 'd5', stageId: 'completed', name: 'Casey Morgan', source: 'facebook', service: 'Paint correction', amount: 420 },
      { id: 'd6', stageId: 'returning', name: 'Riley Quinn', source: 'hubly', service: 'Monthly wash', vehicle: 'Truck' },
      { id: 'd7', stageId: 'membership', name: 'Morgan Avery', source: 'membership', service: 'Shine Club', amount: 79 }
    ];
  }

  function buildPipelineCards() {
    var cards = [];
    collectLeads().forEach(function (lead) {
      cards.push({ id: lead.key || lead.id, leadKey: lead.key, customerId: lead.matchedCustomer?.id || null, stageId: mapLeadStage(lead), name: lead.name || 'Lead', source: srcKind(lead.source, lead), service: lead.service || '', vehicle: vehicleOf(lead), amount: lead.amount, date: lead.date || (lead.createdAt ? String(lead.createdAt).slice(0, 10) : ''), meta: lead });
    });
    quotes().forEach(function (q) {
      if (!q || q.status === 'booked') return;
      var id = 'sq:' + (q.id || Math.random().toString(36).slice(2, 7));
      if (cards.some(function (c) { return c.id === id; })) return;
      cards.push({ id: id, quoteId: q.id, stageId: (!q.status || q.status === 'draft' || q.status === 'incomplete') ? 'incomplete_quote' : 'quoted', name: q.customerName || 'Quote', source: 'quote', service: (q.packageNames && q.packageNames[0]) || 'Smart Quote', vehicle: vehicleOf(q), amount: q.amount, date: (q.updatedAt || q.createdAt || '').slice(0, 10), meta: q });
    });
    jobs().filter(jobActive).forEach(function (j) {
      var stageId = j.status === 'completed' ? 'completed' : 'booked';
      if (j.isMembershipSignup || /membership/i.test(String(j.service || ''))) stageId = 'membership';
      else {
        var cust = customers().find(function (c) { return c.name === j.customer || (j.phone && c.phone === j.phone); });
        if (cust && (cust.customerType === 'recurring' || cust.isReturning)) stageId = 'returning';
      }
      cards.push({ id: 'job:' + (j.id || j.reqId), jobId: j.id, customerName: j.customer, stageId: stageId, name: j.customer || 'Customer', source: j.fromBooking ? 'hubly' : srcKind(j.source, j), service: j.service || '', vehicle: vehicleOf(j), amount: j.amount, date: j.date || '', meta: j });
    });
    return cards.length ? cards : demoPipelineCards();
  }

  function openCard(card) {
    if (!card) return;
    if (card.leadKey && typeof global.viewLead === 'function') return global.viewLead(card.leadKey);
    if (card.customerId && typeof global.viewCustomer === 'function') return global.viewCustomer(card.customerId);
    if (card.customerName) {
      var c = customers().find(function (x) { return x.name === card.customerName; });
      if (c) return HublyJourneyOS.openCustomerProfile(c.id);
    }
    if (card.quoteId && typeof global.openSmartQuote === 'function') return global.openSmartQuote();
    toast('Open ' + (card.name || 'item'));
  }

  function pipeCardHtml(card) {
    var kind = card.source || 'manual', bits = [];
    if (card.stageId === 'quoted' || card.stageId === 'incomplete_quote') { if (card.service) bits.push(card.service); if (card.vehicle) bits.push(card.vehicle); }
    else if (card.stageId === 'booked' || card.stageId === 'completed') { if (card.date) bits.push(String(card.date).length === 10 ? dateLong(card.date) : card.date); if (card.service) bits.push(card.service); }
    else { if (card.service) bits.push(card.service); if (card.vehicle) bits.push(card.vehicle); }
    var meta = bits.filter(Boolean).join(' · ');
    return '<div class="jos-pipe-card" data-jos-card="' + esc(card.id) + '" role="button" tabindex="0"><div class="jos-between"><div class="jos-pipe-name">' + esc(card.name) + '</div>' + srcIco(kind) + '</div>' +
      (meta ? '<div class="jos-pipe-meta">' + esc(meta) + '</div>' : '') +
      '<div class="jos-pipe-foot"><span class="jos-src">' + esc(srcLabel(kind)) + '</span>' +
      (card.amount != null && Number.isFinite(Number(card.amount)) ? '<span class="jos-pipe-amt">' + esc(money(card.amount)) + '</span>' : '') + '</div></div>';
  }

  function renderPipeline() {
    var root = el('jos-pipeline-root'); if (!root) return;
    var cards = buildPipelineCards(); root._josCards = cards;
    root.innerHTML = page('Operate · Pipeline', 'Customer pipeline', 'Inquiries to membership — click a card for details.',
      btn('manual-lead', '+ Manual lead', 'jos-btn-ink jos-btn-sm') + btn('smart-quote', 'Quick Quote', 'jos-btn-brand jos-btn-sm'),
      '<div class="jos-pipe">' + PIPE_STAGES.map(function (st) {
        var rows = cards.filter(function (c) { return c.stageId === st.id; });
        return '<div class="jos-pipe-col" data-stage="' + esc(st.id) + '"><div class="jos-pipe-h"><div class="jos-pipe-title"><span class="jos-pipe-dot ' + esc(st.dot) + '"></span>' + esc(st.label) +
          '<span class="jos-pipe-count">' + rows.length + '</span></div><div class="jos-pipe-sub">' + rows.length + ' in stage</div></div><div class="jos-pipe-body">' +
          (rows.length ? rows.map(pipeCardHtml).join('') : '<div class="jos-pipe-empty">No cards yet</div>') + '</div></div>';
      }).join('') + '</div>');
    bindRoot(root);
  }

  function demoOpportunities() {
    return [
      { tag: 'Recover', title: 'Recover abandoned booking', body: 'Someone started Exterior Wash and left at vehicle size.', impact: 'Recover ~$90', message: 'Still interested in the exterior wash? I can save your spot.', phone: '' },
      { tag: 'Membership', title: 'Launch a monthly Shine Club', body: 'Customers with 3+ visits convert well to plans.', impact: 'Predictable MRR', message: 'Want first dibs on Saturday slots with a membership?', phone: '' },
      { tag: 'Birthday', title: 'Birthday win-back this week', body: 'Two customers have birthdays — send a short thank-you.', impact: 'Warm retention', message: 'Happy birthday! Enjoy 10% off your next visit.', phone: '' },
      { tag: 'Pricing', title: 'Raise mid-tier clarity', body: 'Quotes stall when options feel similar.', impact: 'Higher close rate', message: '', phone: '' }
    ];
  }
  function buildOpportunities() {
    var out = [];
    (S().abandonedLeads || []).slice(0, 4).forEach(function (r) {
      var name = r.customer_name || r.customer_phone || 'Customer';
      out.push({ tag: 'Recover', title: 'Finish booking with ' + name, body: (r.service_name || 'Service') + ' was started but not booked.', impact: 'Win back a warm lead', message: 'Hi ' + name.split(' ')[0] + ' — still want help finishing your ' + (r.service_name || 'booking') + '? I can hold a time this week.', phone: r.customer_phone || '' });
    });
    customers().filter(function (c) { return c.customerType !== 'recurring'; }).slice(0, 3).forEach(function (c) {
      var done = jobs().filter(function (j) { return j.customer === c.name && j.status === 'completed'; });
      if (done.length >= 2) out.push({ tag: 'Membership', title: 'Invite ' + c.name + ' to a plan', body: done.length + ' completed jobs — ready for recurring.', impact: 'Stabilize monthly revenue', message: 'Hey ' + (c.name || '').split(' ')[0] + ' — want priority scheduling with a membership?', phone: c.phone || '', customerId: c.id });
    });
    jobs().filter(function (j) { return j.status === 'completed'; }).slice(0, 4).forEach(function (j) {
      out.push({ tag: 'Rebook', title: 'Rebook ' + (j.customer || 'customer'), body: (j.service || 'Last service') + (j.date ? ' · ' + dateLong(j.date) : ''), impact: 'Fill next open slot', message: 'Hi ' + String(j.customer || '').split(' ')[0] + ' — ready for another ' + (j.service || 'visit') + '?', phone: j.phone || '' });
    });
    customers().forEach(function (c) {
      if (c.birthday || c.dob) out.push({ tag: 'Birthday', title: 'Wish ' + c.name + ' happy birthday', body: 'A short note keeps you top of mind.', impact: 'Relationship + referral', message: 'Happy birthday ' + (c.name || '').split(' ')[0] + '! 10% off your next visit.', phone: c.phone || '', customerId: c.id });
    });
    if (quotes().some(function (q) { return q.status === 'draft' || q.status === 'sent'; })) {
      out.push({ tag: 'Pricing', title: 'Tighten quote follow-ups', body: 'Open quotes waiting — nudge with a clearer package.', impact: 'Lift quote close rate', message: 'Quick check-in on your quote — want me to hold the mid-tier this week?', phone: '' });
    }
    out.push({ tag: 'Upsell', title: 'Offer add-ons on next booked job', body: 'Suggest interior protection when confirming.', impact: '+ average ticket', message: 'Before we start — want to add interior protection?', phone: '' });
    if (out.length < 4) out = out.concat(demoOpportunities());
    return out.slice(0, 9);
  }
  function renderOpportunities() {
    var root = el('jos-opportunities-root'); if (!root) return;
    var items = buildOpportunities(); root._josOpps = items;
    root.innerHTML = page('Operate · Opportunities', 'Follow-ups that pay', 'Recover, upsell, rebook, and membership nudges from live jobs & customers.', '',
      '<div class="jos-opp-grid">' + items.map(function (o, i) {
        var send = hasTwilio() ? btn('opp-send', 'Send', 'jos-btn-brand jos-btn-sm') : btn('opp-copy', 'Copy message', 'jos-btn-brand jos-btn-sm');
        return '<div class="jos-opp" data-jos-opp="' + i + '"><div class="jos-opp-tag">' + esc(o.tag) + '</div><div class="jos-opp-title">' + esc(o.title) + '</div><div class="jos-opp-body">' + esc(o.body) +
          '</div><div class="jos-opp-impact">' + esc(o.impact) + '</div><div class="jos-opp-actions">' + send +
          (o.customerId ? btn('opp-cust', 'View') : '') + btn('opp-ask', 'Ask Hubly', 'jos-btn-ghost jos-btn-sm') + '</div></div>';
      }).join('') + '</div>');
    bindRoot(root);
  }

  function buildActivity() {
    var items = [];
    quotes().slice(0, 6).forEach(function (q) {
      items.push({ kind: 'quote', ico: 'Q', t: (q.status === 'sent' ? 'Quote sent' : 'Quote draft') + ' · ' + (q.customerName || 'Customer'), s: money(q.amount || 0) + (q.updatedAt ? ' · ' + dateLong(String(q.updatedAt).slice(0, 10)) : ''), at: q.updatedAt || q.createdAt || '' });
    });
    jobs().filter(function (j) { return !j.isBlock; }).slice(0, 10).forEach(function (j) {
      items.push({ kind: 'book', ico: j.status === 'completed' ? '✓' : '📅', t: (j.status === 'pending' ? 'Booking request' : (j.status === 'completed' ? 'Job completed' : 'Job booked')) + ' · ' + (j.customer || ''), s: (j.service || '') + (j.date ? ' · ' + dateLong(j.date) : ''), at: j.createdAt || j.date || '' });
    });
    (S().chatConversations || []).slice(0, 4).forEach(function (c) {
      items.push({ kind: 'ai', ico: 'AI', t: 'Chat lead · ' + (c.customer_name || c.customer_phone || 'Visitor'), s: 'Website chatbot', at: c.started_at || c.created_at || '' });
    });
    items.push({ kind: 'email', ico: '@', t: 'Ask Hubly stood by for follow-ups', s: 'AI action · morning briefing ready', at: new Date().toISOString() });
    if (items.length < 5) items = items.concat([{ kind: 'ai', ico: 'AI', t: 'Hubly drafted 3 follow-up texts', s: 'AI action', at: '' }, { kind: 'email', ico: '@', t: 'Quote email opened', s: 'Jordan Lee · Full detail', at: '' }, { kind: 'book', ico: '📅', t: 'New booking confirmed', s: 'Demo customer · Tomorrow 10:00', at: '' }]);
    items.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    return items.slice(0, 24);
  }
  function renderActivity() {
    var root = el('jos-activity-root'); if (!root) return;
    root.innerHTML = page('Operate · Activity', 'What’s happening', 'AI actions, emails, bookings, and quotes across your business.', '',
      '<div class="jos-activity">' + buildActivity().map(function (a) {
        return '<div class="jos-act"><div class="jos-act-ico ' + esc(a.kind) + '">' + esc(a.ico) + '</div><div><div class="jos-act-t">' + esc(a.t) + '</div><div class="jos-act-s">' + esc(a.s) + '</div></div></div>';
      }).join('') + '</div>');
    bindRoot(root);
  }

  function renderAskHubly() {
    var root = el('jos-ask-root'); if (!root) return;
    var recent = (S().askHistory || S().aiHistory || []).slice(0, 5);
    if (!recent.length) recent = [{ t: 'Who should I follow up with?', s: 'Yesterday' }, { t: 'Rewrite my homepage headline', s: '2 days ago' }, { t: 'Suggest a membership price', s: 'This week' }];
    function askItem(t, s, ico) { return '<div class="jos-ask-item" data-jos-ask="' + esc(t) + '"><div>' + ico + '</div><div><strong>' + esc(t) + '</strong><span>' + esc(s) + '</span></div></div>'; }
    root.innerHTML = '<div class="jos-page jos-ask"><div class="jos-ask-hero"><img class="hubly-mark" src="/assets/hubly-wordmark-on-dark.png" alt="hubly" onerror="this.style.display=\'none\'">' +
      '<h1>Ask Hubly</h1><p>Your operating partner for follow-ups, pricing, and growth — one thread above every feature.</p>' +
      '<div class="jos-ask-prompt"><input id="jos-ask-input" type="text" placeholder="Ask anything about your business…" onkeydown="if(event.key===\'Enter\'){window.HublyJourneyOS&&HublyJourneyOS._askFromInput()}">' +
      btn('ask-submit', 'Ask', 'jos-btn-brand') + '</div><div class="jos-ask-chips">' + ASK_CHIPS.map(function (c) { return '<button type="button" class="jos-ask-chip" data-jos-ask="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div></div>' +
      '<div class="jos-ask-grid"><div class="jos-ask-section"><h2>Popular asks</h2><div class="jos-ask-list">' + POPULAR_ASKS.map(function (p) { return askItem(p.t, p.s, '⚡'); }).join('') + '</div></div>' +
      '<div class="jos-stack"><div class="jos-ask-section"><h2>Recent conversations</h2><div class="jos-ask-list">' + recent.map(function (r) { return askItem(r.t || r.q || r.question || 'Conversation', r.s || r.when || 'Recent', '💬'); }).join('') + '</div></div>' +
      '<div class="jos-ask-section"><h2>Impact</h2><div class="jos-ask-stats">' +
      [['Open leads', collectLeads().length], ['Active jobs', jobs().filter(jobActive).length], ['Customers', customers().length], ['Quotes', quotes().length]].map(function (x) {
        return '<div class="jos-ask-stat"><div class="v">' + x[1] + '</div><div class="l">' + x[0] + '</div></div>';
      }).join('') + '</div></div></div></div></div>';
    bindRoot(root);
  }

  function renderMarketing() {
    var root = el('jos-marketing-root'); if (!root) return;
    root.innerHTML = page('Operate · Marketing', 'Get found & booked', 'Share your site, run simple campaigns, and keep the booking link warm.', btn('preview', 'Open website', 'jos-btn-brand jos-btn-sm'),
      '<div class="jos-mkt-banner"><div class="jos-kicker">This week</div><h2 style="font-size:18px;font-weight:800;margin:0 0 6px">Share your booking link with 5 past customers</h2><p>Warm traffic converts faster than cold ads.</p><div class="jos-mt">' + btn('ask-share', 'Draft the message', 'jos-btn-brand jos-btn-sm') + '</div></div><div class="jos-grid">' +
      tile('📣', 'Campaigns', 'Win-back, review asks, seasonal promos.', 'ask', 'Plan a campaign') + tile('🔗', 'Booking link', 'Copy and share your live Hubly page.', 'copy-link', 'Copy link') +
      tile('📸', 'Social kit', 'Captions and CTAs for IG & Facebook.', 'ask', 'Make social kit') + tile('⭐', 'Review drive', 'Ask happy customers while the job is fresh.', 'go-reviews', 'Open reviews') + '</div>');
    bindRoot(root);
  }

  function membershipPlans() {
    var st = S(), plans = st.memberships || st.website?.memberships || st.website?.membershipPlans || [];
    if (Array.isArray(plans) && plans.length) return plans;
    var recurring = customers().filter(function (c) { return c.customerType === 'recurring'; });
    if (recurring.length) return [{ name: 'Recurring plan', price: recurring[0].recurringAmount || 99, cadence: '/mo', includes: ['Priority scheduling', 'Member pricing'] }];
    return [{ name: 'Essentials', price: 79, cadence: '/mo', includes: ['1 visit / month', 'Member-only slots'] }, { name: 'Shine Club', price: 129, cadence: '/mo', includes: ['2 visits / month', 'Interior refresh', 'Priority booking'] }];
  }
  function renderMemberships() {
    var root = el('jos-memberships-root'); if (!root) return;
    var plans = membershipPlans(), members = customers().filter(function (c) { return c.customerType === 'recurring'; }).length;
    root.innerHTML = page('Operate · Memberships', 'Recurring revenue', members + ' active members · plans customers can join from your site.', btn('ask-mem', 'Improve plans', 'jos-btn-brand jos-btn-sm'),
      '<div class="jos-kpi-row"><div class="jos-kpi"><div class="jos-kpi-lbl">Members</div><div class="jos-kpi-v brand">' + members + '</div></div><div class="jos-kpi"><div class="jos-kpi-lbl">Plans</div><div class="jos-kpi-v">' + plans.length + '</div></div></div><div class="jos-grid">' +
      plans.map(function (p) {
        var inc = (p.includes || p.perks || []).slice(0, 4).map(function (x) { return '<li style="font-size:13px;margin:4px 0;color:#444">✓ ' + esc(x) + '</li>'; }).join('');
        return '<div class="jos-mem-card"><div class="jos-kicker">Plan</div><h3 style="font-size:18px;font-weight:800">' + esc(p.name || 'Membership') + '</h3><div class="jos-mem-price">' + esc(money(p.price || p.amount || 0)) + '<small>' + esc(p.cadence || '/mo') + '</small></div><ul style="list-style:none;padding:0;margin:8px 0 12px">' + (inc || '<li class="jos-muted">Customize in Website editor</li>') + '</ul>' + btn('ask-mem', 'Edit with Hubly', 'jos-btn-ink jos-btn-sm') + '</div>';
      }).join('') + '</div>');
    bindRoot(root);
  }

  function renderReportsPage() {
    var root = el('jos-reports-root'); if (!root) return;
    var completed = jobs().filter(function (j) { return j.status === 'completed' && !j.isBlock; });
    var rev = completed.reduce(function (s, j) { return s + (parseFloat(j.amount) || 0); }, 0);
    var pending = jobs().filter(function (j) { return j.status === 'pending'; }).length;
    var booked = jobs().filter(function (j) { return jobActive(j) && j.status !== 'completed'; }).length;
    root.innerHTML = page('Operate · Reports', 'Performance', 'Revenue and pipeline health at a glance.', btn('go-money', 'Full money view'),
      '<div class="jos-kpi-row"><div class="jos-kpi"><div class="jos-kpi-lbl">Completed revenue</div><div class="jos-kpi-v brand">' + esc(money(rev) || '$0') + '</div></div><div class="jos-kpi"><div class="jos-kpi-lbl">Completed jobs</div><div class="jos-kpi-v">' + completed.length + '</div></div><div class="jos-kpi"><div class="jos-kpi-lbl">Booked ahead</div><div class="jos-kpi-v">' + booked + '</div></div><div class="jos-kpi"><div class="jos-kpi-lbl">Needs review</div><div class="jos-kpi-v">' + pending + '</div></div></div>' +
      '<div class="jos-grid-2"><div class="jos-tile"><h3>Lead → book</h3><p>Open leads converting into Jobs.</p><div class="jos-report-bar"><i style="width:' + Math.min(100, 20 + collectLeads().length * 8) + '%"></i></div></div><div class="jos-tile"><h3>Quote velocity</h3><p>' + quotes().length + ' quotes in play.</p><div class="jos-report-bar"><i style="width:' + Math.min(100, 15 + quotes().length * 10) + '%"></i></div></div></div>');
    bindRoot(root);
  }

  function renderGrowth() {
    var root = el('jos-growth-root'); if (!root) return;
    root.innerHTML = '<div class="jos-page"><div class="jos-growth-hero"><h2>Grow with Hubly</h2><p>Fill the calendar, raise ticket size, and turn one-time jobs into members.</p><div class="jos-dash-actions">' +
      btn('ask-growth', 'What should I do next?', 'jos-btn-brand jos-btn-sm') + '<button type="button" class="jos-btn jos-btn-sm" style="background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.2);color:#fff" data-jos-act="stripe">Connect Stripe</button></div></div><div class="jos-grid">' +
      tile('📈', 'Capacity', 'Open slots this week vs demand.', 'ask-growth', 'Fill open slots') + tile('💎', 'Ticket size', 'Add-ons and mid-tier packaging.', 'ask-growth', 'Raise ticket size') +
      tile('🔁', 'Retention', 'Rebooks and memberships.', 'go-mem', 'View memberships') + tile('🌐', 'Presence', 'Website + booking polish.', 'preview', 'Open website') + '</div></div>';
    bindRoot(root);
  }

  function renderBizReviews() {
    var root = el('jos-reviews-root'); if (!root) return;
    var manual = S().website?.manualReviews || S().manualReviews || [];
    var rating = S().website?.reviewRating || S().reviewRating || 5;
    var cards = (manual.length ? manual : [{ name: 'Alex P.', text: 'Showed up on time and the finish looked brand new.', rating: 5 }, { name: 'Sam R.', text: 'Easy booking and clear communication.', rating: 5 }, { name: 'Jordan M.', text: 'Will book again — already told two neighbors.', rating: 5 }]).slice(0, 6);
    root.innerHTML = page('Operate · Reviews', 'Social proof', '<span class="jos-review-stars">' + '★'.repeat(Math.round(Number(rating) || 5)) + '</span> · ' + esc(String(S().website?.reviewCount || cards.length)) + ' reviews',
      btn('ask-review', 'Ask for reviews', 'jos-btn-brand jos-btn-sm'),
      '<div class="jos-grid">' + cards.map(function (r) {
        return '<div class="jos-tile"><div class="jos-review-stars">' + '★'.repeat(Number(r.rating) || 5) + '</div><p style="margin:8px 0;font-size:14px">“' + esc(r.text || r.body || '') + '”</p><div class="jos-muted">— ' + esc(r.name || r.author || 'Customer') + '</div></div>';
      }).join('') + '</div>');
    bindRoot(root);
  }

  function renderSettingsHub() {
    var root = el('jos-settings-root'); if (!root) return;
    var cards = [
      { ico: '🏢', t: 'Business', s: 'Manage your business details and team.', links: 'Business Information · Brand · Team · Locations', act: 'go-editor' },
      { ico: '🌐', t: 'Website', s: 'Manage your website, domain and SEO.', links: 'Domain · SEO · Homepage · Pages', act: 'go-editor' },
      { ico: '📅', t: 'Booking', s: 'Configure booking experience and policies.', links: 'Availability · Questions · Policies · Calendar Sync', act: 'go-editor' },
      { ico: '💳', t: 'Payments', s: 'Manage payments, taxes and invoices.', links: 'Stripe · Taxes · Invoices · Payment Methods', act: 'stripe' },
      { ico: '🔌', t: 'Integrations', s: 'Connect Hubly with the tools you already use.', links: 'Google Calendar · Twilio · Google Business', act: 'go-jobs' },
      { ico: '🔔', t: 'Notifications', s: 'Manage how you and your team get notified.', links: 'Email · SMS · Push · In-App', act: 'go-ask' },
      { ico: '✨', t: 'AI', s: 'Configure AI tools and automation.', links: 'Business Coach · Automation · Knowledge Base', act: 'go-ask' },
      { ico: '👤', t: 'Account', s: 'Manage your account and subscription.', links: 'Billing · Subscription · Security', act: 'go-settings' }
    ];
    root.innerHTML = page('Settings', 'Settings', 'Manage your business, preferences and integrations.', '',
      '<div class="jos-grid jos-settings-grid">' + cards.map(function (c) {
        return '<button type="button" class="jos-tile jos-settings-card" data-jos-act="' + esc(c.act) + '"><div class="jos-tile-ico">' + c.ico + '</div><h3>' + esc(c.t) + '</h3><p>' + esc(c.s) + '</p><div class="jos-muted jos-mt" style="font-size:12px">' + esc(c.links) + '</div></button>';
      }).join('') + '</div>');
    bindRoot(root);
  }

  function renderLeadsList() {
    var root = el('jos-leads-root'); if (!root) return;
    var leads = collectLeads();
    if (!leads.length) {
      leads = demoPipelineCards().filter(function (c) { return /new_inquiry|quoted|incomplete/.test(c.stageId); })
        .map(function (c, i) { return { key: 'demo:' + i, name: c.name, source: c.source, stage: c.stageId, service: c.service, vehicle: c.vehicle, createdAt: c.date, amount: c.amount }; });
    }
    function stageLbl(lead) {
      try { var st = typeof global.leadStageById === 'function' && global.leadStageById(lead.stage); if (st?.label) return st.label; } catch (e) {}
      var mid = mapLeadStage(lead), pipe = PIPE_STAGES.find(function (s) { return s.id === mid || s.id === lead.stage; });
      return (pipe && pipe.label) || lead.stage || 'New';
    }
    root.innerHTML = '<div class="jos-head"><div><div class="jos-kicker">CRM · Leads</div><h1>Leads</h1><p>Name, source, status, service, vehicle, date.</p></div><div class="jos-head-actions">' + btn('manual-lead', '+ Manual lead', 'jos-btn-ink jos-btn-sm') + '</div></div>' +
      '<div class="jos-crm-layout"><div class="jos-table-wrap"><table class="jos-table"><thead><tr><th>Name</th><th>Source</th><th>Status</th><th>Service</th><th>Vehicle</th><th>Date</th></tr></thead><tbody>' +
      leads.map(function (l) {
        var kind = srcKind(l.source, l), when = l.createdAt ? (dateLong(String(l.createdAt).slice(0, 10)) || (typeof global.leadRelativeTime === 'function' ? global.leadRelativeTime(l.createdAt) : String(l.createdAt).slice(0, 10))) : '—';
        return '<tr data-jos-lead="' + esc(l.key || '') + '"><td><strong>' + esc(l.name || 'Lead') + '</strong></td><td><span class="jos-src">' + srcIco(kind) + ' ' + esc(srcLabel(kind)) + '</span></td><td><span class="jos-pill quote">' + esc(stageLbl(l)) + '</span></td><td>' + esc(l.service || '—') + '</td><td>' + esc(vehicleOf(l) || '—') + '</td><td>' + esc(when) + '</td></tr>';
      }).join('') + '</tbody></table></div><div class="jos-side"><div class="jos-side-empty">Select a lead — details open in the panel below.</div></div></div>';
    bindRoot(root);
    el('v-leads')?.classList.add('jos-enhanced');
  }

  function ensureProfileShell() {
    var shell = el('jos-customer-profile'); if (shell) return shell;
    shell = document.createElement('div'); shell.id = 'jos-customer-profile'; shell.className = 'jos-profile';
    shell.innerHTML = '<div class="jos-profile-panel" role="dialog" aria-modal="true"><div class="jos-profile-top"><div class="jos-profile-top-row"><div class="jos-profile-av" id="jos-cp-av">?</div><div style="min-width:0;flex:1"><div class="jos-profile-name" id="jos-cp-name">Customer</div><div class="jos-profile-meta" id="jos-cp-meta"></div></div>' +
      '<button type="button" class="jos-profile-close" data-jos-act="close-profile" aria-label="Close">×</button></div><div class="jos-profile-tabs" id="jos-cp-tabs"></div></div><div class="jos-profile-body" id="jos-cp-body"></div></div>';
    document.body.appendChild(shell);
    shell.addEventListener('click', function (e) { if (e.target === shell) closeCustomerProfile(); });
    bindRoot(shell); return shell;
  }
  function closeCustomerProfile() { el('jos-customer-profile')?.classList.remove('open'); }
  function aiCustomerSummary(c, completed, booked) {
    if (completed.length >= 3) return c.name + ' is a repeat customer with ' + completed.length + ' completed jobs' + (c.customerType === 'recurring' ? ' and an active membership' : ' — strong candidate for a membership') + (booked.length ? '. Next visit is already on the books.' : '. A friendly rebook nudge would help.');
    if (completed.length) return c.name + ' completed ' + completed.length + ' job' + (completed.length === 1 ? '' : 's') + '. Follow up while the experience is fresh.';
    return c.name + ' is in your CRM' + (c.preferredService ? ' with interest in ' + c.preferredService : '') + '. Hubly can draft a first-visit confirmation or quote when you’re ready.';
  }
  function listJobs(list, empty) {
    if (!list.length) return '<div class="jos-empty">' + esc(empty) + '</div>';
    return '<div class="jos-stack">' + list.map(function (j) {
      return '<div class="jos-card jos-card-tight"><div class="jos-between"><strong>' + esc(j.service || 'Job') + '</strong><span class="jos-pill booked">' + esc(j.status || '') + '</span></div><div class="jos-muted jos-mt">' + esc((j.date ? dateLong(j.date) : '—') + (j.amount != null ? ' · ' + money(j.amount) : '')) + '</div></div>';
    }).join('') + '</div>';
  }
  function renderProfileTab(c, tab) {
    var body = el('jos-cp-body'); if (!body || !c) return;
    var custJobs = jobs().filter(function (j) { return j.customer === c.name && !j.isBlock; });
    var completed = custJobs.filter(function (j) { return j.status === 'completed'; });
    var booked = custJobs.filter(function (j) { return j.status !== 'completed' && j.status !== 'pending'; });
    var lifetime = completed.reduce(function (s, j) { return s + (parseFloat(j.amount) || 0); }, 0);
    var avg = completed.length ? lifetime / completed.length : 0;
    if (tab === 'Overview') {
      body.innerHTML = '<div class="jos-kpi-row"><div class="jos-kpi"><div class="jos-kpi-lbl">Lifetime</div><div class="jos-kpi-v brand">' + esc(money(lifetime) || '$0') + '</div></div><div class="jos-kpi"><div class="jos-kpi-lbl">Completed</div><div class="jos-kpi-v">' + completed.length + '</div></div><div class="jos-kpi"><div class="jos-kpi-lbl">Avg ticket</div><div class="jos-kpi-v">' + esc(money(avg) || '$0') + '</div></div><div class="jos-kpi"><div class="jos-kpi-lbl">Upcoming</div><div class="jos-kpi-v">' + booked.length + '</div></div></div>' +
        '<div class="jos-profile-ai"><div class="sk">Hubly summary</div><p>' + esc(aiCustomerSummary(c, completed, booked)) + '</p><div class="jos-mt">' + btn('ask-cust', 'Ask about this customer', 'jos-btn-brand jos-btn-sm') + '</div></div>' +
        '<div class="jos-card"><div class="jos-between"><strong>Preferred service</strong><span>' + esc(c.preferredService || '—') + '</span></div><div class="jos-between jos-mt"><strong>Vehicle</strong><span>' + esc(c.vehicle || '—') + '</span></div><div class="jos-between jos-mt"><strong>Type</strong><span>' + esc(c.customerType === 'recurring' ? 'Membership / recurring' : 'One-time') + '</span></div></div>';
    } else if (tab === 'Jobs') body.innerHTML = listJobs(completed, 'No completed jobs yet.');
    else if (tab === 'Bookings') body.innerHTML = listJobs(booked.concat(custJobs.filter(function (j) { return j.status === 'pending'; })), 'No upcoming bookings.');
    else if (tab === 'Reviews') body.innerHTML = '<div class="jos-card"><p>Review asks land here. ' + btn('ask-review', 'Draft a review ask') + '</p></div>';
    else if (tab === 'Notes') {
      var notes = []; if (c.notes) notes.push({ when: 'Saved note', text: c.notes });
      notes.push({ when: 'Hubly', text: aiCustomerSummary(c, completed, booked) });
      body.innerHTML = notes.map(function (n) { return '<div class="jos-note-row"><div class="when">' + esc(n.when) + '</div><div style="margin-top:4px;font-size:13px">' + esc(n.text) + '</div></div>'; }).join('');
    } else if (tab === 'History' || tab === 'Activity') {
      var tl = custJobs.slice().sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
      body.innerHTML = tl.length ? '<div class="jos-timeline">' + tl.map(function (j) {
        return '<div class="jos-tl-item"><div class="jos-tl-dot"></div><div><div class="jos-tl-t">' + esc((j.status || 'job') + ' · ' + (j.service || 'Service')) + '</div><div class="jos-tl-s">' + esc((j.date ? dateLong(j.date) : '') + (j.amount != null ? ' · ' + money(j.amount) : '')) + '</div></div></div>';
      }).join('') + '</div>' : '<div class="jos-empty">No history yet.</div>';
    } else if (tab === 'Files') body.innerHTML = '<div class="jos-file-row"><strong>Quotes & receipts</strong><div class="jos-muted jos-mt">Files attached to jobs appear here.</div></div><div class="jos-file-row">' + btn('smart-quote', 'Create Quick Quote') + '</div>';
    else body.innerHTML = '<div class="jos-empty">Nothing here yet.</div>';
    bindRoot(body);
  }
  function openCustomerProfile(id, tab) {
    var c = customers().find(function (x) { return String(x.id) === String(id); });
    if (!c) { toast('Customer not found'); return; }
    var shell = ensureProfileShell();
    S().activeCustId = c.id; S()._josProfileTab = tab || 'Overview'; shell._josCustId = c.id;
    el('jos-cp-av').textContent = initials(c.name); el('jos-cp-name').textContent = c.name || 'Customer';
    el('jos-cp-meta').textContent = [c.phone, c.email].filter(Boolean).join(' · ') || 'No contact info';
    el('jos-cp-tabs').innerHTML = PROFILE_TABS.map(function (t) {
      return '<button type="button" class="jos-profile-tab' + ((S()._josProfileTab || 'Overview') === t ? ' on' : '') + '" data-jos-tab="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('');
    renderProfileTab(c, S()._josProfileTab || 'Overview'); shell.classList.add('open');
  }

  function enhanceDashboard() {
    var root = el('jos-dash-root'), dash = el('v-dashboard'); if (!root && !dash) return;
    var leadsN = collectLeads().length, pending = jobs().filter(function (j) { return j.status === 'pending'; }).length;
    var todayStr = typeof global.dateStr === 'function' ? global.dateStr(new Date()) : new Date().toISOString().slice(0, 10);
    var today = jobs().filter(function (j) { return jobActive(j) && j.date === todayStr; }).length;
    var hour = new Date().getHours(), greet = hour < 12 ? 'Good morning' : (hour < 18 ? 'Good afternoon' : 'Good evening');
    var html = '<div class="jos-dash"><div class="jos-dash-brief"><div class="sk">Morning briefing</div><h2>' + esc(greet) + ', ' + esc(S().biz || 'your business') + '</h2>' +
      '<p>Here’s the highest-leverage path for today — follow-ups first, then open slots.</p><div class="jos-dash-row">' +
      '<div class="jos-dash-panel"><div class="lbl">Attention</div><div class="t">' + (pending ? pending + ' need review' : (leadsN ? leadsN + ' open leads' : 'Inbox clear')) + '</div><div class="s">Clear Needs Review before new outreach.</div></div>' +
      '<div class="jos-dash-panel"><div class="lbl">Today</div><div class="t">' + today + ' on the calendar</div><div class="s">Confirm early; upsell when confirming.</div></div>' +
      '<div class="jos-dash-panel"><div class="lbl">Recommendation</div><div class="t">Nudge warm quotes</div><div class="s">Ask Hubly to draft follow-ups.</div></div></div><div class="jos-dash-actions">' +
      btn('ask-brief', 'Ask Hubly what’s next', 'jos-btn-brand jos-btn-sm') + '<button type="button" class="jos-btn jos-btn-sm" style="background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.2);color:#fff" data-jos-act="go-leads">Open leads</button></div></div></div>';
    if (root) { root.innerHTML = html; bindRoot(root); return; }
    var existing = dash.querySelector('.jos-dash');
    if (!existing) {
      var wrap = document.createElement('div'); wrap.innerHTML = html; var node = wrap.firstChild;
      var hero = dash.querySelector('.dash-hero, .dash-ops-hero');
      if (hero?.parentNode) hero.parentNode.insertBefore(node, hero.nextSibling); else dash.insertBefore(node, dash.firstChild);
      bindRoot(node);
    } else { existing.outerHTML = html; bindRoot(dash.querySelector('.jos-dash')); }
  }

  function switchNav(v) {
    var nav = document.querySelector('[data-v="' + v + '"]');
    if (nav && typeof global.switchV === 'function') global.switchV(nav);
  }
  function onSwitchView(v) {
    var map = { pipeline: renderPipeline, opportunities: renderOpportunities, activity: renderActivity, ask: renderAskHubly, 'ask-hubly': renderAskHubly, marketing: renderMarketing, memberships: renderMemberships, reports: renderReportsPage, growth: renderGrowth, reviews: renderBizReviews, settings: renderSettingsHub, leads: renderLeadsList, dashboard: enhanceDashboard };
    if (map[v]) try { map[v](); } catch (e) { console.warn('HublyJourneyOS', v, e); }
  }

  function bindRoot(root) {
    if (!root || root._josBound) return; root._josBound = true;
    root.addEventListener('click', function (e) {
      var t = e.target.closest('[data-jos-act],[data-jos-ask],[data-jos-card],[data-jos-opp],[data-jos-lead],[data-jos-tab]'); if (!t) return;
      if (t.hasAttribute('data-jos-card')) {
        var cards = el('jos-pipeline-root')?._josCards || [];
        return openCard(cards.find(function (c) { return String(c.id) === String(t.getAttribute('data-jos-card')); }));
      }
      if (t.hasAttribute('data-jos-lead')) { var key = t.getAttribute('data-jos-lead'); if (key && typeof global.viewLead === 'function') global.viewLead(key); return; }
      if (t.hasAttribute('data-jos-tab')) {
        var tab = t.getAttribute('data-jos-tab'); S()._josProfileTab = tab;
        var cust = customers().find(function (c) { return String(c.id) === String(el('jos-customer-profile')?._josCustId); }); if (!cust) return;
        root.querySelectorAll('.jos-profile-tab').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-jos-tab') === tab); });
        return renderProfileTab(cust, tab);
      }
      if (t.hasAttribute('data-jos-ask')) return ask(t.getAttribute('data-jos-ask'));
      var act = t.getAttribute('data-jos-act'); if (!act) return;
      var oppEl = t.closest('[data-jos-opp]');
      var opp = oppEl && el('jos-opportunities-root')?._josOpps ? el('jos-opportunities-root')._josOpps[+oppEl.getAttribute('data-jos-opp')] : null;
      if (act === 'opp-copy' && opp) return copyText(opp.message || opp.title);
      if (act === 'opp-send' && opp) { if (opp.phone) location.href = 'sms:' + String(opp.phone).replace(/\D/g, '') + '?&body=' + encodeURIComponent(opp.message || ''); else copyText(opp.message || ''); return; }
      if (act === 'opp-cust' && opp?.customerId) return openCustomerProfile(opp.customerId);
      if (act === 'opp-ask' && opp) return ask(opp.title);
      if (act === 'ask-submit' || act === 'ask-brief') return HublyJourneyOS._askFromInput(act === 'ask-brief' ? 'What should I focus on this morning?' : null);
      if (act === 'manual-lead') return typeof global.openM === 'function' ? global.openM('m-new-lead') : toast('Add lead');
      if (act === 'smart-quote') return typeof global.openSmartQuote === 'function' ? global.openSmartQuote() : toast('Quick Quote');
      if (act === 'preview') return typeof global.previewProfile === 'function' ? global.previewProfile() : null;
      if (act === 'stripe') return typeof global.goStripeConnect === 'function' ? global.goStripeConnect() : ask('Connect Stripe');
      if (act === 'copy-link') return copyText(location.origin + '/' + (S().slug || ''));
      if (act === 'ask-share') return ask('Draft a message to share my booking link with past customers');
      if (act === 'ask-mem') return ask('Improve my membership plans');
      if (act === 'ask-growth') return ask('What should I do next to grow?');
      if (act === 'ask-review') return ask('Who should I ask for a review?');
      if (act === 'ask-cust') return ask('Summarize next best action for ' + (el('jos-cp-name')?.textContent || 'this customer'));
      if (act === 'ask') return ask('Plan a simple marketing campaign for this week');
      if (act === 'go-reviews') return switchNav('reviews');
      if (act === 'go-mem') return switchNav('memberships');
      if (act === 'go-money') return switchNav('reports');
      if (act === 'go-leads') return switchNav('leads');
      if (act === 'go-jobs') return switchNav('jobs');
      if (act === 'go-editor') return switchNav('editor');
      if (act === 'go-ask') return switchNav('ask');
      if (act === 'go-settings') return switchNav('settings');
      if (act === 'close-profile') return closeCustomerProfile();
    });
  }

  var HublyJourneyOS = {
    renderPipeline: renderPipeline,
    renderOpportunities: renderOpportunities,
    renderActivity: renderActivity,
    renderAskHubly: renderAskHubly,
    renderMarketing: renderMarketing,
    renderMemberships: renderMemberships,
    renderReportsPage: renderReportsPage,
    renderGrowth: renderGrowth,
    renderBizReviews: renderBizReviews,
    renderSettingsHub: renderSettingsHub,
    renderLeadsList: renderLeadsList,
    openCustomerProfile: openCustomerProfile,
    closeCustomerProfile: closeCustomerProfile,
    enhanceDashboard: enhanceDashboard,
    onSwitchView: onSwitchView,
    _askFromInput: function (preset) {
      var input = el('jos-ask-input') || el('ai-question-input');
      ask(preset || (input && input.value) || '');
      if (input && !preset) input.value = '';
    }
  };
  global.HublyJourneyOS = HublyJourneyOS;
})(typeof window !== 'undefined' ? window : this);
