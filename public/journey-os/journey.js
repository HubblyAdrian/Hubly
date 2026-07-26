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
  function todayStr() {
    return typeof global.dateStr === 'function' ? global.dateStr(new Date()) : new Date().toISOString().slice(0, 10);
  }
  function hasTwilio() { var st = S(); return !!(st.twilio || st.twilioReady || st.smsReady || st.messaging?.twilio || st.integrations?.twilio); }
  function initials(name) {
    var p = String(name || '?').trim().split(/\s+/).filter(Boolean);
    return !p.length ? '?' : (p.length === 1 ? p[0].slice(0, 2) : (p[0][0] + p[p.length - 1][0])).toUpperCase();
  }
  function ask(q) {
    var text = String(q || '').trim(); if (!text) return;
    try { switchNav('ask'); } catch (e) {}
    var run = function () {
      var input = el('jos-ask-input') || el('ai-question-input');
      if (input) input.value = text;
      if (typeof global.askAI === 'function') return global.askAI(text);
      toast('Ask Hubly: ' + text);
    };
    if (typeof global.requestAnimationFrame === 'function') global.requestAnimationFrame(run);
    else setTimeout(run, 0);
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

  function marketingScore() {
    var revN = (S().website?.manualReviews || S().manualReviews || []).length;
    var done = jobs().filter(function (j) { return j.status === 'completed' && !j.isBlock; }).length;
    var custN = customers().length;
    return Math.max(50, Math.min(90, 50 + Math.min(12, revN * 3) + Math.min(16, done * 2) + Math.min(12, custN)));
  }
  function sparkHtml(vals) {
    var max = Math.max.apply(null, vals.concat([1]));
    return '<div class="jos-spark">' + vals.map(function (v) { return '<i style="height:' + Math.max(12, Math.round((v / max) * 100)) + '%"></i>'; }).join('') + '</div>';
  }
  function renderMarketing() {
    var root = el('jos-marketing-root'); if (!root) return;
    var score = marketingScore();
    var done = jobs().filter(function (j) { return j.status === 'completed' && !j.isBlock; });
    var rev = done.reduce(function (s, j) { return s + (parseFloat(j.amount) || 0); }, 0);
    var mktRev = Math.round(rev * 0.18);
    var newCust = Math.min(customers().length, Math.max(2, Math.round(customers().length * 0.2)));
    var clicks = 40 + customers().length * 8 + done.length * 5;
    var actions = [
      { t: 'Holiday / seasonal promo', s: 'Push a limited offer before the next busy weekend.', q: 'Draft a holiday promo for my detailing business' },
      { t: 'Instagram caption kit', s: 'Before/after posts with a Book Now CTA.', q: 'Write 3 Instagram captions with booking CTAs' },
      { t: 'Testimonial spotlight', s: 'Turn a 5-star review into a shareable post.', q: 'Turn my best review into a social testimonial post' },
      { t: 'Win-back campaign', s: 'Re-engage customers quiet for 60+ days.', q: 'Draft a win-back text for quiet customers' },
      { t: 'Email nurture', s: 'Short sequence: thank-you → tip → rebook.', q: 'Write a 3-email nurture sequence after a job' }
    ];
    var months = ['Aug — Back-to-school clean', 'Sep — Fall ceramic push', 'Oct — Pre-winter undercarriage', 'Nov — Holiday gift cards', 'Dec — Year-end membership'];
    var toggles = ['Review Requests', 'Follow-up Emails', 'Birthday', 'Re-engage', 'Smart Promotions'];
    root.innerHTML = page('Operate · Marketing', 'Marketing Center', 'Score, today’s actions, and light automation — Hubly brand, ready to generate.', btn('preview', 'Open website', 'jos-btn-brand jos-btn-sm'),
      '<div class="jos-mkt-head"><div class="jos-score-ring" style="--jos-pct:' + score + '"><span>' + score + '</span><small>Marketing Score</small></div><div><h2 class="jos-mkt-title">Keep the booking link warm</h2><p class="jos-muted">Warm traffic + reviews + seasonal pushes. Generate with Ask Hubly.</p></div></div>' +
      '<div class="jos-mkt-3col"><div class="jos-card"><div class="jos-kicker">Today’s Marketing</div><div class="jos-stack jos-mt">' + actions.map(function (a) {
        return '<div class="jos-mkt-act"><div><strong>' + esc(a.t) + '</strong><div class="jos-muted">' + esc(a.s) + '</div></div><button type="button" class="jos-btn jos-btn-brand jos-btn-sm" data-jos-ask="' + esc(a.q) + '">Generate</button></div>';
      }).join('') + '</div></div><div class="jos-card"><div class="jos-kicker">Performance</div><div class="jos-stack jos-mt">' +
      [['Website clicks', clicks, [32, 48, 40, 55, 62, 58, 70]], ['New customers', newCust, [1, 2, 1, 3, 2, 4, newCust]], ['Revenue from marketing', money(mktRev) || '$0', [20, 35, 28, 42, 50, 45, 60]], ['Email open rate', '42%', [30, 38, 35, 44, 40, 48, 42]], ['Instagram engagement', '6.8%', [4, 5, 5.5, 6, 7, 6.2, 6.8]]].map(function (r) {
        return '<div class="jos-mkt-metric"><div><div class="jos-kpi-lbl">' + esc(r[0]) + '</div><div class="jos-kpi-v" style="font-size:18px">' + esc(String(r[1])) + '</div></div>' + sparkHtml(r[2]) + '</div>';
      }).join('') + '</div></div><div class="jos-card"><div class="jos-kicker">AI Calendar</div><div class="jos-stack jos-mt">' + months.map(function (m) {
        return '<div class="jos-mkt-cal"><span class="jos-pill quote">Soon</span><span>' + esc(m) + '</span></div>';
      }).join('') + '</div></div></div>' +
      '<div class="jos-card jos-mt"><div class="jos-kicker">Marketing Automation</div><div class="jos-toggle-row jos-mt">' + toggles.map(function (t, i) {
        return '<label class="jos-toggle"><input type="checkbox"' + (i < 3 ? ' checked' : '') + ' disabled><span></span>' + esc(t) + '</label>';
      }).join('') + '</div></div>');
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
    var plans = membershipPlans();
    var members = customers().filter(function (c) { return c.customerType === 'recurring'; });
    var active = members.length;
    var cancelled = Math.max(0, Math.round(active * 0.08));
    var mrr = members.reduce(function (s, c) { return s + (parseFloat(c.recurringAmount) || 0); }, 0);
    if (!mrr && plans[0]) mrr = (parseFloat(plans[0].price || plans[0].amount) || 99) * Math.max(active, 1);
    var candidates = customers().filter(function (c) { return c.customerType !== 'recurring'; }).map(function (c) {
      var done = jobs().filter(function (j) { return j.customer === c.name && j.status === 'completed'; }).length;
      return { c: c, done: done, match: Math.min(98, 55 + done * 12) };
    }).filter(function (x) { return x.done >= 1; }).sort(function (a, b) { return b.done - a.done || b.match - a.match; }).slice(0, 5);
    var perks = [['Priority booking', 92], ['Member pricing', 88], ['Interior refresh', 74], ['Free add-on', 61]];
    var retain = [72, 78, 81, 84, 86, 88];
    var mrrTrend = [0.6, 0.7, 0.75, 0.82, 0.9, 1].map(function (x) { return Math.round(mrr * x) || (40 + Math.round(x * 60)); });
    root.innerHTML = page('Operate · Memberships', 'Memberships Overview', active + ' active · MRR ' + esc(money(mrr) || '$0'), btn('ask-mem', 'Improve plans', 'jos-btn-brand jos-btn-sm'),
      '<div class="jos-kpi-row"><div class="jos-kpi"><div class="jos-kpi-lbl">MRR</div><div class="jos-kpi-v brand">' + esc(money(mrr) || '$0') + '</div></div><div class="jos-kpi"><div class="jos-kpi-lbl">Total Members</div><div class="jos-kpi-v">' + (active + cancelled) + '</div></div><div class="jos-kpi"><div class="jos-kpi-lbl">Active</div><div class="jos-kpi-v">' + active + '</div></div><div class="jos-kpi"><div class="jos-kpi-lbl">Cancelled</div><div class="jos-kpi-v">' + cancelled + '</div></div></div>' +
      '<div class="jos-mem-layout"><div class="jos-stack"><div class="jos-kicker">Your Membership Programs</div>' + plans.map(function (p) {
        var inc = (p.includes || p.perks || []).slice(0, 4).map(function (x) { return '<li>✓ ' + esc(x) + '</li>'; }).join('');
        return '<div class="jos-mem-card"><div class="jos-between"><h3>' + esc(p.name || 'Membership') + '</h3><div class="jos-mem-price">' + esc(money(p.price || p.amount || 0)) + '<small>' + esc(p.cadence || '/mo') + '</small></div></div><ul class="jos-mem-list">' + (inc || '<li class="jos-muted">Customize in Website editor</li>') + '</ul>' + btn('ask-mem', 'Edit with Hubly', 'jos-btn-ink jos-btn-sm') + '</div>';
      }).join('') + '<div class="jos-card"><div class="jos-kicker">Retention (months)</div><div class="jos-bars jos-mt">' + retain.map(function (v, i) { return '<div class="jos-bar"><i style="height:' + v + '%"></i><span>M' + (i + 1) + '</span></div>'; }).join('') + '</div></div><div class="jos-card"><div class="jos-kicker">MRR trend</div><div class="jos-bars jos-bars-line jos-mt">' + mrrTrend.map(function (v) { var max = Math.max.apply(null, mrrTrend); return '<div class="jos-bar"><i style="height:' + Math.max(10, Math.round((v / max) * 100)) + '%"></i></div>'; }).join('') + '</div></div></div>' +
      '<div class="jos-stack"><div class="jos-card"><div class="jos-kicker">AI Suggestions</div><p class="jos-mt" style="font-size:13px"><strong>' + candidates.length + '</strong> customers qualify for a plan.</p><div class="jos-stack jos-mt">' + (candidates.length ? candidates.map(function (x) {
        return '<div class="jos-between jos-sug"><div><strong>' + esc(x.c.name) + '</strong><div class="jos-muted">' + x.done + ' completed jobs</div></div><span class="jos-pill won">' + x.match + '% match</span></div>';
      }).join('') : '<div class="jos-muted">Add more completed jobs to surface matches.</div>') + '</div></div><div class="jos-card"><div class="jos-kicker">Top Perks</div><div class="jos-stack jos-mt">' + perks.map(function (p) {
        return '<div class="jos-perk"><div class="jos-between"><span>' + esc(p[0]) + '</span><strong>' + p[1] + '%</strong></div><div class="jos-conf-bar"><i style="width:' + p[1] + '%"></i></div></div>';
      }).join('') + '</div></div></div></div>');
    bindRoot(root);
  }

  function renderReportsPage() {
    var root = el('jos-reports-root'); if (!root) return;
    var completed = jobs().filter(function (j) { return j.status === 'completed' && !j.isBlock; });
    var rev = completed.reduce(function (s, j) { return s + (parseFloat(j.amount) || 0); }, 0);
    var avg = completed.length ? rev / completed.length : 0;
    var booked = jobs().filter(function (j) { return jobActive(j) && j.status !== 'completed'; }).length;
    var repeat = customers().filter(function (c) { return custJobsFor(c).filter(function (j) { return j.status === 'completed'; }).length >= 2; }).length;
    var repeatPct = customers().length ? Math.round((repeat / customers().length) * 100) : 0;
    var svcMap = {};
    completed.forEach(function (j) { var k = j.service || 'Other'; svcMap[k] = (svcMap[k] || 0) + (parseFloat(j.amount) || 0); });
    var topSvc = Object.keys(svcMap).map(function (k) { return [k, svcMap[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);
    if (!topSvc.length) topSvc = [['Full Detail', rev * 0.35 || 120], ['Interior', rev * 0.25 || 90], ['Ceramic', rev * 0.2 || 80], ['Other', rev * 0.2 || 60]];
    var maxSvc = Math.max.apply(null, topSvc.map(function (x) { return x[1]; })) || 1;
    var trend = [0.55, 0.62, 0.6, 0.72, 0.78, 0.85, 0.9, 0.88, 0.95, 1].map(function (x) { return Math.round((rev || 1000) * x); });
    root.innerHTML = page('Operate · Reports', 'Reports', 'Understand how your business performed — facts only.', btn('go-money', 'Export / money view', 'jos-btn-ink jos-btn-sm'),
      '<div class="jos-kpi-row"><div class="jos-kpi"><div class="jos-kpi-lbl">Revenue</div><div class="jos-kpi-v brand">' + esc(money(rev) || '$0') + '</div></div><div class="jos-kpi"><div class="jos-kpi-lbl">Jobs Completed</div><div class="jos-kpi-v">' + completed.length + '</div></div><div class="jos-kpi"><div class="jos-kpi-lbl">Average Ticket</div><div class="jos-kpi-v">' + esc(money(avg) || '$0') + '</div></div><div class="jos-kpi"><div class="jos-kpi-lbl">Repeat Customers</div><div class="jos-kpi-v">' + repeatPct + '%</div><div class="jos-kpi-sub">' + repeat + ' returning · ' + booked + ' booked ahead</div></div></div>' +
      '<div class="jos-ov-grid"><div class="jos-card"><div class="jos-kicker">Revenue Trend</div><div class="jos-bars jos-bars-line jos-mt" style="height:140px">' + trend.map(function (v) { var max = Math.max.apply(null, trend); return '<div class="jos-bar"><i style="height:' + Math.max(8, Math.round((v / max) * 100)) + '%"></i></div>'; }).join('') + '</div></div>' +
      '<div class="jos-card"><div class="jos-kicker">Top Services (by revenue)</div><div class="jos-stack jos-mt">' + topSvc.map(function (s) {
        return '<div class="jos-perk"><div class="jos-between"><span>' + esc(s[0]) + '</span><strong>' + esc(money(s[1])) + '</strong></div><div class="jos-conf-bar"><i style="width:' + Math.round((s[1] / maxSvc) * 100) + '%"></i></div></div>';
      }).join('') + '</div></div></div>' +
      '<div class="jos-grid-2 jos-mt"><div class="jos-tile"><h3>Customer sources</h3><p>Website, booking, and manual leads feeding jobs.</p><div class="jos-report-bar"><i style="width:' + Math.min(100, 25 + collectLeads().length * 6) + '%"></i></div><div class="jos-muted jos-mt">' + collectLeads().length + ' open leads · ' + quotes().length + ' quotes</div></div><div class="jos-tile"><h3>Monthly growth</h3><p>Completed jobs vs prior pace.</p><div class="jos-report-bar"><i style="width:' + Math.min(100, 30 + completed.length * 4) + '%"></i></div><div class="jos-muted jos-mt">Based on completed jobs and payments.</div></div></div>');
    bindRoot(root);
  }

  function renderGrowth() {
    var root = el('jos-growth-root'); if (!root) return;
    var pending = jobs().filter(function (j) { return j.status === 'pending'; }).length;
    var done = jobs().filter(function (j) { return j.status === 'completed' && !j.isBlock; });
    var rev = done.reduce(function (s, j) { return s + (parseFloat(j.amount) || 0); }, 0);
    var members = customers().filter(function (c) { return c.customerType === 'recurring'; }).length;
    var score = Math.max(55, Math.min(96, 58 + Math.min(20, done.length) + Math.min(12, members * 4) - Math.min(10, pending * 2)));
    var opps = [
      { impact: 'High', t: 'Recover abandoned bookings', s: pending ? pending + ' need review right now.' : 'Catch unfinished booking starts.', act: 'go-leads', cta: 'Do it →', est: '+$850' },
      { impact: 'High', t: 'Raise mid-tier package clarity', s: 'Quotes stall when options feel similar.', act: 'ask-growth', cta: 'Update pricing →', est: '+$1,200/mo' },
      { impact: 'High', t: 'Launch a membership', s: members ? members + ' members already — grow the plan.' : 'Turn repeat customers into MRR.', act: 'go-mem', cta: 'Create →', est: '+$2,400/mo' },
      { impact: 'Medium', t: 'Generate a seasonal campaign', s: 'Holiday / weekend promo for warm lists.', act: 'ask', cta: 'Generate →', est: 'Reach list' },
      { impact: 'Low', t: 'Ask for a fresh review', s: 'Completed jobs ready for a 5-star ask.', act: 'ask-review', cta: 'Generate →', est: '+Trust' }
    ];
    root.innerHTML = '<div class="jos-page"><div class="jos-growth-hero jos-growth-brief"><div class="jos-dash-top"><div><div class="sk" style="color:#fdba74">Daily briefing</div><h2>Growth</h2><p>Your AI-powered growth coach — if you only have 20 minutes, start at the top.</p></div><div class="jos-health-ring light" style="--jos-pct:' + score + '"><span>' + score + '</span><small>Score</small></div></div>' +
      '<div class="jos-dash-mini-kpis"><div><div class="lbl">Revenue</div><div class="t">' + esc(money(rev) || '$0') + '</div></div><div><div class="lbl">Jobs done</div><div class="t">' + done.length + '</div></div><div><div class="lbl">Members</div><div class="t">' + members + '</div></div><div><div class="lbl">Need review</div><div class="t">' + pending + '</div></div></div></div>' +
      '<div class="jos-card"><div class="jos-kicker">Top Opportunities</div><div class="jos-stack jos-mt">' + opps.map(function (o, i) {
        return '<div class="jos-between jos-growth-row"><div><span class="jos-pill ' + (o.impact === 'High' ? 'quote' : (o.impact === 'Medium' ? 'booked' : 'open')) + '">' + esc(o.impact) + '</span> <strong style="margin-left:6px">' + (i + 1) + '. ' + esc(o.t) + '</strong><div class="jos-muted">' + esc(o.s) + ' · Est. ' + esc(o.est) + '</div></div>' + btn(o.act, o.cta, 'jos-btn-brand jos-btn-sm') + '</div>';
      }).join('') + '</div></div>' +
      '<div class="jos-grid jos-mt">' + tile('📈', 'Capacity', 'Fill open slots this week.', 'ask-growth', 'Fill open slots') + tile('💎', 'Ticket size', 'Add-ons and mid-tier packaging.', 'ask-growth', 'Raise ticket size') +
      tile('🔁', 'Retention', 'Rebooks and memberships.', 'go-mem', 'View memberships') + tile('🌐', 'Presence', 'Website + booking polish.', 'preview', 'Open website') + '</div></div>';
    bindRoot(root);
  }

  function renderBizReviews() {
    var root = el('jos-reviews-root'); if (!root) return;
    var manual = S().website?.manualReviews || S().manualReviews || [];
    var rating = Number(S().website?.reviewRating || S().reviewRating || 4.9);
    var cards = (manual.length ? manual : [{ name: 'Alex P.', text: 'Showed up on time and the finish looked brand new.', rating: 5, src: 'Google' }, { name: 'Sam R.', text: 'Easy booking and clear communication.', rating: 5, src: 'Facebook' }, { name: 'Jordan M.', text: 'Will book again — already told two neighbors.', rating: 5, src: 'Manual' }]).slice(0, 8);
    var count = Number(S().website?.reviewCount || cards.length) || cards.length;
    var fiveStar = Math.round(count * 0.9);
    root.innerHTML = page('Operate · Reviews', 'Reviews', 'Manage reputation and turn feedback into growth.', btn('ask-review', 'Request a Review', 'jos-btn-brand jos-btn-sm'),
      '<div class="jos-kpi-row"><div class="jos-kpi"><div class="jos-kpi-lbl">Overall Rating</div><div class="jos-kpi-v brand">' + rating.toFixed(1) + '</div><div class="jos-kpi-sub"><span class="jos-review-stars">' + '★'.repeat(Math.round(rating)) + '</span> · ' + count + ' reviews</div></div>' +
      '<div class="jos-kpi"><div class="jos-kpi-lbl">5-Star Reviews</div><div class="jos-kpi-v">' + fiveStar + '</div><div class="jos-kpi-sub">' + Math.round((fiveStar / Math.max(1, count)) * 100) + '% of all</div></div>' +
      '<div class="jos-kpi"><div class="jos-kpi-lbl">New this month</div><div class="jos-kpi-v">' + Math.min(count, Math.max(2, Math.round(count * 0.12))) + '</div><div class="jos-kpi-sub">Keep asking after jobs</div></div>' +
      '<div class="jos-kpi"><div class="jos-kpi-lbl">Response rate</div><div class="jos-kpi-v">100%</div><div class="jos-kpi-sub">You reply to every review</div></div></div>' +
      '<div class="jos-ov-grid"><div class="jos-card"><div class="jos-kicker">AI Summary</div><p style="font-size:13px;margin-top:8px">Customers love attention to detail, communication, and convenience. Watch scheduling availability during busy weeks.</p><div class="jos-mt"><div class="jos-kpi-lbl">Consistently mention</div><ul class="jos-check-list"><li>✓ Attention to detail</li><li>✓ Communication</li><li>✓ Convenience</li><li>✓ Easy to book</li></ul></div></div>' +
      '<div class="jos-card"><div class="jos-kicker">Latest Reviews</div><div class="jos-stack jos-mt">' + cards.slice(0, 4).map(function (r) {
        return '<div class="jos-file-row" style="margin:0"><div class="jos-between"><strong>' + esc(r.name || r.author || 'Customer') + '</strong><span class="jos-pill quote">' + esc(r.src || 'Review') + '</span></div><div class="jos-review-stars">' + '★'.repeat(Number(r.rating) || 5) + '</div><p style="font-size:13px;margin-top:6px">“' + esc(r.text || r.body || '') + '”</p></div>';
      }).join('') + '</div></div></div>' +
      '<div class="jos-card jos-mt"><div class="jos-kicker">AI Opportunities</div><div class="jos-stack jos-mt">' +
      [['Ask for a review', 'Recent completed jobs are warm.', 'ask-review', 'Send Request'], ['Use a review on homepage', 'Best 5-star quotes make great testimonials.', 'ask', 'Add to Homepage'], ['Generate Instagram testimonial', 'Turn praise into a short post.', 'ask', 'Generate Post'], ['Create testimonial section', 'Showcase social proof on your site.', 'go-editor', 'Create Section']].map(function (x) {
        return '<div class="jos-between"><div><strong>' + esc(x[0]) + '</strong><div class="jos-muted">' + esc(x[1]) + '</div></div>' + btn(x[2], x[3], 'jos-btn-brand jos-btn-sm') + '</div>';
      }).join('') + '</div></div>');
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

  function leadStageLbl(lead) {
    try { var st = typeof global.leadStageById === 'function' && global.leadStageById(lead.stage); if (st?.label) return st.label; } catch (e) {}
    var mid = mapLeadStage(lead), pipe = PIPE_STAGES.find(function (s) { return s.id === mid || s.id === lead.stage; });
    return (pipe && pipe.label) || lead.stage || 'New';
  }
  function allLeads() {
    var leads = collectLeads();
    if (!leads.length) {
      leads = demoPipelineCards().filter(function (c) { return /new_inquiry|quoted|incomplete/.test(c.stageId); })
        .map(function (c, i) { return { key: 'demo:' + i, name: c.name, source: c.source, stage: c.stageId, service: c.service, vehicle: c.vehicle, createdAt: c.date, amount: c.amount, phone: c.phone || '', email: c.email || '' }; });
    }
    return leads;
  }
  function leadSideHtml(lead) {
    if (!lead) return '<div class="jos-px-side-empty">Select a lead to preview details.</div>';
    var kind = srcKind(lead.source, lead);
    return '<div class="jos-px-side-head"><div class="jos-px-person"><div class="jos-px-av">' + esc(initials(lead.name)) + '</div><div><strong>' + esc(lead.name || 'Lead') + '</strong><div class="sub">' + esc(leadStageLbl(lead)) + '</div></div></div>' +
      '<div class="jos-px-side-meta"><div><span>Source</span> ' + srcIco(kind) + ' ' + esc(srcLabel(kind)) + '</div><div><span>Service</span> ' + esc(lead.service || '—') + '</div><div><span>Vehicle</span> ' + esc(vehicleOf(lead) || '—') + '</div><div><span>Phone</span> ' + esc(lead.phone || '—') + '</div></div></div>' +
      '<div class="jos-px-side-body"><div class="jos-px-side-stats"><div class="jos-px-side-stat"><div class="l">Estimate</div><div class="v">' + esc(lead.amount != null ? money(lead.amount) : '—') + '</div></div><div class="jos-px-side-stat"><div class="l">Created</div><div class="v">' + esc(lead.createdAt ? String(lead.createdAt).slice(0, 10) : '—') + '</div></div></div>' +
      '<div class="jos-px-side-actions">' + btn('manual-lead', 'Edit lead', 'jos-btn jos-btn-sm') + (lead.key ? '<button type="button" class="jos-btn jos-btn-brand jos-btn-sm" data-jos-lead="' + esc(lead.key) + '">Open full lead</button>' : '') + '</div></div>';
  }
  function renderLeadsList() {
    var root = el('jos-leads-root'); if (!root) return;
    var leads = allLeads();
    var selKey = root._josLeadKey || null;
    var sel = leads.find(function (l) { return String(l.key) === String(selKey); }) || null;
    var filter = root._josLeadFilter || 'all';
    var q = (root._josLeadQ || '').toLowerCase();
    var filtered = leads.filter(function (l) {
      var kind = srcKind(l.source, l);
      if (filter !== 'all' && kind !== filter) return false;
      if (!q) return true;
      return String(l.name || '').toLowerCase().indexOf(q) >= 0 || String(l.service || '').toLowerCase().indexOf(q) >= 0 || String(vehicleOf(l) || '').toLowerCase().indexOf(q) >= 0;
    });
    root.innerHTML = '<div class="jos-px-page"><div class="jos-px-page-head"><div><h1>Leads</h1><p>Inbound interest from Google, Meta, Instagram, Hubly, and manual entry.</p></div><div class="jos-head-actions">' + btn('manual-lead', '+ Manual lead', 'jos-btn-brand jos-btn-sm') + '</div></div>' +
      '<div class="jos-px-filters"><input type="search" id="jos-leads-q" placeholder="Search leads…" value="' + esc(root._josLeadQ || '') + '">' +
      [['all', 'All'], ['google', 'Google'], ['facebook', 'Facebook'], ['instagram', 'Instagram'], ['hubly', 'Hubly'], ['manual', 'Manual']].map(function (f) {
        return '<button type="button" class="jos-px-chip' + (filter === f[0] ? ' on' : '') + '" data-jos-lead-filter="' + f[0] + '">' + f[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="jos-px-layout' + (sel ? '' : ' solo') + '"><div class="jos-px-table-wrap"><table class="jos-px-table"><thead><tr><th>Name</th><th>Source</th><th>Status</th><th>Service</th><th>Vehicle</th><th>Date</th></tr></thead><tbody>' +
      (filtered.length ? filtered.map(function (l) {
        var kind = srcKind(l.source, l), when = l.createdAt ? (dateLong(String(l.createdAt).slice(0, 10)) || String(l.createdAt).slice(0, 10)) : '—';
        var on = sel && String(sel.key) === String(l.key);
        return '<tr class="' + (on ? 'sel' : '') + '" data-jos-lead-row="' + esc(l.key || '') + '"><td><div class="jos-px-person"><div class="jos-px-av">' + esc(initials(l.name)) + '</div><div><strong>' + esc(l.name || 'Lead') + '</strong></div></div></td><td><span class="jos-src">' + srcIco(kind) + ' ' + esc(srcLabel(kind)) + '</span></td><td><span class="jos-pill quote">' + esc(leadStageLbl(l)) + '</span></td><td>' + esc(l.service || '—') + '</td><td>' + esc(vehicleOf(l) || '—') + '</td><td>' + esc(when) + '</td></tr>';
      }).join('') : '<tr><td colspan="6"><div class="jos-empty">No leads match this filter.</div></td></tr>') +
      '</tbody></table></div><aside class="jos-px-side" id="jos-leads-side">' + leadSideHtml(sel) + '</aside></div></div>';
    bindRoot(root);
    var qInput = el('jos-leads-q');
    if (qInput && !qInput._josBound) {
      qInput._josBound = true;
      qInput.addEventListener('input', function () { root._josLeadQ = qInput.value || ''; renderLeadsList(); });
    }
    el('v-leads')?.classList.add('jos-enhanced');
  }

  function renderCustomersPage() {
    var view = el('v-customers'); if (!view) return;
    var root = el('jos-customers-root');
    if (!root) {
      root = document.createElement('div'); root.id = 'jos-customers-root';
      view.insertBefore(root, view.firstChild);
    }
    view.classList.add('jos-pixel-owned');
    var list = customers().slice();
    if (!list.length) {
      list = [
        { id: 'demo_c1', name: 'Sarah Johnson', phone: '(512) 555-0198', email: 'sarah.johnson@gmail.com', vehicle: 'Tesla Model Y', customerType: 'recurring', statusOverride: 'vip', preferredService: 'Ceramic Coating' },
        { id: 'demo_c2', name: 'Mike Brown', phone: '(512) 555-0142', email: 'mike.brown@email.com', vehicle: 'BMW X5', preferredService: 'Interior Detail' },
        { id: 'demo_c3', name: 'Emily Smith', phone: '(512) 555-0177', email: 'emily.s@email.com', vehicle: 'Audi Q5', preferredService: 'Full Detail' }
      ];
    }
    var q = (root._josCustQ || '').toLowerCase();
    var tab = root._josCustTab || 'all';
    var rows = list.map(function (c) {
      var done = custJobsFor(c).filter(function (j) { return j.status === 'completed'; });
      var lifetime = done.reduce(function (s, j) { return s + (parseFloat(j.amount) || 0); }, 0);
      var last = lastJob(c);
      var hs = healthScore(c);
      var vip = c.statusOverride === 'vip' || c.isVip || /vip/i.test(String(c.tags || c.status || ''));
      return { c: c, lifetime: lifetime, last: last, hs: hs, vip: vip, member: c.customerType === 'recurring', vehicles: c.vehicle || vehicleOf(last) || '—' };
    }).filter(function (x) {
      if (tab === 'vip' && !x.vip) return false;
      if (tab === 'member' && !x.member) return false;
      if (!q) return true;
      return String(x.c.name || '').toLowerCase().indexOf(q) >= 0 || String(x.c.phone || '').indexOf(q) >= 0 || String(x.c.email || '').toLowerCase().indexOf(q) >= 0;
    });
    var selId = root._josCustId || null;
    var selRow = rows.find(function (x) { return String(x.c.id) === String(selId); }) || null;
    function sideHtml(row) {
      if (!row) return '<div class="jos-px-side-empty">Select a customer — profile opens on the right.</div>';
      var c = row.c;
      return '<div class="jos-px-side-head"><div class="jos-px-person"><div class="jos-px-av">' + esc(initials(c.name)) + '</div><div><strong>' + esc(c.name || 'Customer') + (row.vip ? '<span class="jos-px-badge vip">VIP</span>' : (row.member ? '<span class="jos-px-badge member">Member</span>' : '')) + '</strong><div class="sub">' + esc([c.phone, c.email].filter(Boolean).join(' · ') || 'No contact') + '</div></div></div>' +
        '<div class="jos-px-side-meta"><div><span>Vehicle</span> ' + esc(row.vehicles) + '</div><div><span>Preferred</span> ' + esc(c.preferredService || '—') + '</div></div></div>' +
        '<div class="jos-px-side-body"><div class="jos-px-side-stats"><div class="jos-px-side-stat"><div class="l">Lifetime</div><div class="v">' + esc(money(row.lifetime) || '$0') + '</div></div><div class="jos-px-side-stat"><div class="l">Last visit</div><div class="v">' + esc(row.last?.date ? dateLong(row.last.date) : '—') + '</div></div><div class="jos-px-side-stat"><div class="l">Membership</div><div class="v">' + (row.member ? 'Active' : 'None') + '</div></div><div class="jos-px-side-stat"><div class="l">Health</div><div class="v">' + row.hs + '</div></div></div>' +
        '<p style="font-size:13px;color:var(--jos-ink-2);line-height:1.45;margin:0 0 12px">' + esc(aiCustomerSummary(c, custJobsFor(c).filter(function (j) { return j.status === 'completed'; }), custJobsFor(c).filter(function (j) { return j.status !== 'completed' && j.status !== 'cancelled' && j.status !== 'pending'; }))) + '</p>' +
        '<div class="jos-px-side-actions"><button type="button" class="jos-btn jos-btn-brand jos-btn-sm" data-jos-act="cust-full-profile" data-jos-cust="' + esc(String(c.id)) + '">View Full Profile</button>' + btn('new-job-cust', 'New Job', 'jos-btn jos-btn-sm') + '</div></div>';
    }
    root.innerHTML = '<div class="jos-px-page"><div class="jos-px-page-head"><div><h1>Customers</h1><p>Lifetime value, membership, vehicles, and health — click a row for the side panel.</p></div><div class="jos-head-actions">' + btn('add-cust', '+ Add customer', 'jos-btn-brand jos-btn-sm') + '</div></div>' +
      '<div class="jos-px-filters"><input type="search" id="jos-cust-q" placeholder="Search customers…" value="' + esc(root._josCustQ || '') + '">' +
      [['all', 'All'], ['vip', 'VIP'], ['member', 'Members']].map(function (f) {
        return '<button type="button" class="jos-px-chip' + (tab === f[0] ? ' on' : '') + '" data-jos-cust-tab="' + f[0] + '">' + f[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="jos-px-layout"><div class="jos-px-table-wrap"><table class="jos-px-table"><thead><tr><th>Customer</th><th>Lifetime</th><th>Last visit</th><th>Membership</th><th>Vehicles</th><th>Health</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (x) {
        var on = selRow && String(selRow.c.id) === String(x.c.id);
        var hClass = x.hs >= 85 ? '' : (x.hs >= 70 ? ' mid' : ' low');
        return '<tr class="' + (on ? 'sel' : '') + '" data-jos-cust-row="' + esc(String(x.c.id)) + '"><td><div class="jos-px-person"><div class="jos-px-av">' + esc(initials(x.c.name)) + '</div><div><strong>' + esc(x.c.name) + (x.vip ? '<span class="jos-px-badge vip">VIP</span>' : '') + '</strong><div class="sub">' + esc(x.c.phone || x.c.email || '') + '</div></div></div></td><td style="font-weight:750;color:var(--jos-navy)">' + esc(money(x.lifetime) || '$0') + '</td><td>' + esc(x.last?.date ? dateLong(x.last.date) : '—') + '</td><td>' + (x.member ? '<span class="jos-px-badge member">Active</span>' : '—') + '</td><td>' + esc(x.vehicles) + '</td><td><span class="jos-px-health-dot' + hClass + '"><i></i>' + x.hs + '</span></td></tr>';
      }).join('') : '<tr><td colspan="6"><div class="jos-empty">No customers yet.</div></td></tr>') +
      '</tbody></table></div><aside class="jos-px-side" id="jos-cust-side">' + sideHtml(selRow) + '</aside></div></div>';
    if (selRow) S().activeCustId = selRow.c.id;
    bindRoot(root);
    var qInput = el('jos-cust-q');
    if (qInput && !qInput._josBound) {
      qInput._josBound = true;
      qInput.addEventListener('input', function () { root._josCustQ = qInput.value || ''; renderCustomersPage(); });
    }
  }

  function custJobsFor(c) {
    if (!c) return [];
    return jobs().filter(function (j) {
      if (!j || j.isBlock) return false;
      if (c.name && j.customer === c.name) return true;
      if (c.phone && j.phone && String(c.phone).replace(/\D/g, '') === String(j.phone).replace(/\D/g, '')) return true;
      if (c.id && (j.customerId === c.id || j.custId === c.id)) return true;
      return false;
    });
  }
  function lastJob(c) {
    return custJobsFor(c).filter(function (j) { return j.status === 'completed'; }).slice().sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); })[0] || null;
  }
  function nextJob(c) {
    var today = typeof global.dateStr === 'function' ? global.dateStr(new Date()) : new Date().toISOString().slice(0, 10);
    return custJobsFor(c).filter(function (j) { return j.status !== 'completed' && j.status !== 'cancelled' && String(j.date || '') >= today; })
      .slice().sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); })[0] || null;
  }
  function healthScore(c) {
    var done = custJobsFor(c).filter(function (j) { return j.status === 'completed'; }).length;
    var score = 60 + Math.min(20, done * 6) + (c.customerType === 'recurring' ? 12 : 0) + (nextJob(c) ? 4 : 0);
    return Math.max(60, Math.min(96, score));
  }
  function statusPill(c) {
    if (c.customerType === 'recurring' || c.isVip || /vip/i.test(String(c.tags || c.status || ''))) {
      var lbl = c.customerType === 'recurring' ? 'Member' : 'VIP';
      return '<span class="jos-status-pill ' + (lbl === 'VIP' ? 'vip' : 'member') + '">' + lbl + '</span>';
    }
    if (c.isReturning) return '<span class="jos-status-pill returning">Returning</span>';
    return '';
  }
  function ensureProfileShell() {
    var shell = el('jos-customer-profile'); if (shell) return shell;
    shell = document.createElement('div'); shell.id = 'jos-customer-profile'; shell.className = 'jos-profile';
    shell.innerHTML = '<div class="jos-profile-panel" role="dialog" aria-modal="true"><div class="jos-profile-top">' +
      '<div class="jos-profile-top-row"><div class="jos-profile-av" id="jos-cp-av">?</div><div style="min-width:0;flex:1"><div class="jos-profile-name-row"><div class="jos-profile-name" id="jos-cp-name">Customer</div><span id="jos-cp-pill"></span></div><div class="jos-profile-meta" id="jos-cp-meta"></div></div>' +
      '<div class="jos-profile-acts">' + btn('new-job-cust', 'New Job', 'jos-btn-brand jos-btn-sm') + '<button type="button" class="jos-profile-close" data-jos-act="close-profile" aria-label="Close">×</button></div></div>' +
      '<div class="jos-cp-stats" id="jos-cp-stats"></div><div class="jos-profile-tabs" id="jos-cp-tabs"></div></div><div class="jos-profile-body" id="jos-cp-body"></div></div>';
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
  function aiTags(c, completed, lifetime) {
    var tags = [];
    if (completed.length >= 3) tags.push('Loyal');
    if (lifetime >= 400 || completed.length >= 4) tags.push('High Value');
    if (c.customerType === 'recurring') tags.push('Member');
    if (nextJob(c)) tags.push('Booked Ahead');
    if (!tags.length) tags.push('New Relationship');
    return tags;
  }
  function confBar(label, pct) {
    return '<div class="jos-conf"><div class="jos-between"><span>' + esc(label) + '</span><strong>' + pct + '%</strong></div><div class="jos-conf-bar"><i style="width:' + pct + '%"></i></div></div>';
  }
  function jobDetailHtml(j) {
    if (!j) return '<div class="jos-side-empty">Select a job</div>';
    var when = (j.date ? dateLong(j.date) : '—') + (j.time || j.startTime ? ' · ' + (j.time || j.startTime) : '');
    return '<div class="jos-job-detail"><div class="jos-kicker">Job detail</div><h3>' + esc(j.service || 'Job') + '</h3>' +
      '<div class="jos-detail-rows"><div><span>Date / time</span><strong>' + esc(when) + '</strong></div><div><span>Vehicle</span><strong>' + esc(vehicleOf(j) || '—') + '</strong></div><div><span>Total</span><strong>' + esc(j.amount != null ? money(j.amount) : '—') + '</strong></div><div><span>Technician</span><strong>—</strong></div><div><span>Payment</span><strong>' + (j.amount != null && j.status === 'completed' ? 'Paid' : esc(j.status || '—')) + '</strong></div></div>' +
      '<div class="jos-mt"><div class="jos-kpi-lbl">Job summary</div><p style="font-size:13px;margin-top:6px">' + esc(j.notes || j.summary || ((j.service || 'Service') + ' for ' + (j.customer || 'customer') + '.')) + '</p></div></div>';
  }
  function bookingDetailHtml(j) {
    if (!j) return '<div class="jos-side-empty">Select a booking</div>';
    var st = j.status === 'completed' ? 'Completed' : (j.status === 'cancelled' ? 'Cancelled' : (j.status === 'pending' ? 'Pending' : 'Confirmed'));
    return '<div class="jos-job-detail"><div class="jos-kicker">Booking</div><h3>' + esc(j.service || 'Booking') + '</h3><span class="jos-pill ' + (st === 'Completed' ? 'won' : (st === 'Cancelled' ? 'lost' : (st === 'Pending' ? 'quote' : 'booked'))) + '">' + st + '</span>' +
      '<div class="jos-detail-rows jos-mt"><div><span>Date</span><strong>' + esc(j.date ? dateLong(j.date) : '—') + (j.time || j.startTime ? ' · ' + esc(j.time || j.startTime) : '') + '</strong></div><div><span>Location / vehicle</span><strong>' + esc(j.location || j.address || vehicleOf(j) || '—') + '</strong></div><div><span>Pricing</span><strong>' + esc(j.amount != null ? money(j.amount) : '—') + '</strong></div></div></div>';
  }
  function listJobs(list, empty, selectedId) {
    if (!list.length) return '<div class="jos-empty">' + esc(empty) + '</div>';
    return '<div class="jos-stack">' + list.map(function (j) {
      var id = j.id || j.reqId || '';
      var on = selectedId != null && String(selectedId) === String(id);
      return '<div class="jos-card jos-card-tight jos-card-hover' + (on ? ' on' : '') + '" data-jos-job="' + esc(String(id)) + '" role="button" tabindex="0"><div class="jos-between"><strong>' + esc(j.service || 'Job') + '</strong><span class="jos-pill won">Completed</span></div><div class="jos-muted jos-mt">' + esc((j.date ? dateLong(j.date) : '—') + (j.amount != null ? ' · ' + money(j.amount) : '')) + '</div></div>';
    }).join('') + '</div>';
  }
  function listBookings(list, selectedId) {
    if (!list.length) return '<div class="jos-empty">None</div>';
    return '<div class="jos-stack">' + list.map(function (j) {
      var id = j.id || j.reqId || '';
      var st = j.status === 'completed' ? 'Completed' : (j.status === 'cancelled' ? 'Cancelled' : (j.status === 'pending' ? 'Pending' : 'Confirmed'));
      var pill = st === 'Completed' ? 'won' : (st === 'Cancelled' ? 'lost' : (st === 'Pending' ? 'quote' : 'booked'));
      return '<div class="jos-card jos-card-tight jos-card-hover' + (selectedId != null && String(selectedId) === String(id) ? ' on' : '') + '" data-jos-job="' + esc(String(id)) + '" role="button" tabindex="0"><div class="jos-between"><strong>' + esc(j.service || 'Booking') + '</strong><span class="jos-pill ' + pill + '">' + st + '</span></div><div class="jos-muted jos-mt">' + esc(j.date ? dateLong(j.date) : '—') + '</div></div>';
    }).join('') + '</div>';
  }
  function renderProfileTab(c, tab) {
    var body = el('jos-cp-body'), shell = el('jos-customer-profile'); if (!body || !c) return;
    var custJobs = custJobsFor(c);
    var completed = custJobs.filter(function (j) { return j.status === 'completed'; }).slice().sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
    var booked = custJobs.filter(function (j) { return j.status !== 'completed' && j.status !== 'cancelled' && j.status !== 'pending'; });
    var pending = custJobs.filter(function (j) { return j.status === 'pending'; });
    var pastBook = custJobs.filter(function (j) { return j.status === 'completed' || j.status === 'cancelled'; });
    var upcoming = booked.concat(pending).slice().sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); });
    var lifetime = completed.reduce(function (s, j) { return s + (parseFloat(j.amount) || 0); }, 0);
    var hs = healthScore(c), last = lastJob(c), next = nextJob(c);
    var selId = shell?._josJobId;
    if (tab === 'Overview') {
      var tags = aiTags(c, completed, lifetime);
      var recent = completed.slice(0, 5);
      var custQuotes = quotes().filter(function (q) { return q.customerName === c.name || (c.phone && q.customerPhone === c.phone); }).filter(function (q) { return q.status !== 'booked' && q.status !== 'accepted'; }).slice(0, 3);
      body.innerHTML = '<div class="jos-ov-kpi"><div class="jos-health"><div class="jos-health-ring" style="--jos-pct:' + hs + '"><span>' + hs + '</span></div><div><div class="jos-kpi-lbl">Customer Health</div><div class="jos-muted">From jobs & membership</div></div></div>' +
        [['Lifetime Value', money(lifetime) || '$0'], ['Last Visit', last?.date ? dateLong(last.date) : '—'], ['Next Appointment', next?.date ? dateLong(next.date) : '—'], ['Membership', c.customerType === 'recurring' ? 'Active' : 'None']].map(function (x) {
          return '<div class="jos-kpi"><div class="jos-kpi-lbl">' + esc(x[0]) + '</div><div class="jos-kpi-v" style="font-size:16px">' + esc(x[1]) + '</div></div>';
        }).join('') + '</div><div class="jos-ov-grid"><div class="jos-stack"><div class="jos-profile-ai"><div class="sk">AI Summary</div><p>' + esc(aiCustomerSummary(c, completed, booked)) + '</p><div class="jos-tag-row">' + tags.map(function (t) { return '<span class="jos-tag">' + esc(t) + '</span>'; }).join('') + '</div></div>' +
        '<div class="jos-card"><div class="jos-kicker">Recent Activity</div><div class="jos-stack jos-mt">' + (recent.length ? recent.map(function (j) {
          return '<div class="jos-between"><div><strong>' + esc(j.service || 'Job') + '</strong><div class="jos-muted">' + esc(j.date ? dateLong(j.date) : '') + '</div></div><span>' + esc(j.amount != null ? money(j.amount) : '') + '</span></div>';
        }).join('') : '<div class="jos-muted">No jobs yet.</div>') + '</div></div></div><div class="jos-stack"><div class="jos-card"><div class="jos-kicker">Favorite Vehicle</div><div class="jos-mt" style="font-size:15px;font-weight:750">' + esc(c.vehicle || vehicleOf(last) || '—') + '</div><div class="jos-muted jos-mt">Preferred: ' + esc(c.preferredService || '—') + '</div></div>' +
        '<div class="jos-card"><div class="jos-kicker">Outstanding Quotes</div><div class="jos-stack jos-mt">' + (custQuotes.length ? custQuotes.map(function (q) {
          return '<div class="jos-between"><div><strong>' + esc((q.packageNames && q.packageNames[0]) || 'Quote') + '</strong><div class="jos-muted">' + esc(q.status || 'open') + '</div></div><span class="jos-pipe-amt">' + esc(money(q.amount || 0)) + '</span></div>';
        }).join('') : '<div class="jos-muted">No open quotes.</div>') + '</div></div>' +
        '<div class="jos-card"><div class="jos-kicker">AI Recommendations</div><div class="jos-stack jos-mt"><div class="jos-between"><span style="font-size:13px">Create a follow-up while the visit is fresh.</span>' + btn('ask-cust', 'Create Follow-up', 'jos-btn-brand jos-btn-sm') + '</div><div class="jos-between"><span style="font-size:13px">See membership & rebook opportunities.</span>' + btn('go-opps', 'Create Follow-up', 'jos-btn-ink jos-btn-sm') + '</div></div></div></div></div>';
    } else if (tab === 'Jobs') {
      if (selId == null && completed[0]) selId = completed[0].id || completed[0].reqId;
      var selJob = completed.find(function (j) { return String(j.id || j.reqId) === String(selId); }) || completed[0] || null;
      if (shell) shell._josJobId = selJob ? (selJob.id || selJob.reqId) : null;
      body.innerHTML = '<div class="jos-job-split"><div>' + listJobs(completed, 'No completed jobs yet.', shell?._josJobId) + '</div><div class="jos-side">' + jobDetailHtml(selJob) + '</div></div>';
    } else if (tab === 'Bookings') {
      var allB = upcoming.concat(pastBook);
      if (selId == null && allB[0]) selId = allB[0].id || allB[0].reqId;
      var selB = allB.find(function (j) { return String(j.id || j.reqId) === String(selId); }) || allB[0] || null;
      if (shell) shell._josJobId = selB ? (selB.id || selB.reqId) : null;
      body.innerHTML = '<div class="jos-book-split"><div class="jos-stack"><div class="jos-kicker">Upcoming</div>' + listBookings(upcoming, shell?._josJobId) + '<div class="jos-kicker jos-mt">Past</div>' + listBookings(pastBook, shell?._josJobId) + '</div><div class="jos-side">' + bookingDetailHtml(selB) + '</div></div>';
    } else if (tab === 'Reviews') {
      body.innerHTML = '<div class="jos-stack"><div class="jos-card"><div class="jos-between"><strong>Review status</strong><span class="jos-pill quote">Ready to ask</span></div><p class="jos-muted jos-mt">Ask while the job is fresh — Hubly can draft the message.</p><div class="jos-mt">' + btn('ask-review', 'Draft a review ask', 'jos-btn-brand jos-btn-sm') + '</div></div><div class="jos-card"><div class="jos-kicker">Recent asks</div><div class="jos-muted jos-mt">No review replies attached to this customer yet.</div></div></div>';
    } else if (tab === 'Notes') {
      var prefs = [];
      if (c.preferredService) prefs.push(c.preferredService + ' preferred');
      if (c.vehicle) prefs.push('Drives ' + c.vehicle);
      if (c.notes && /text|sms|call|email/i.test(c.notes)) prefs.push('Noted communication preference');
      if (c.customerType === 'recurring') prefs.push('Values recurring convenience');
      if (!prefs.length) prefs = ['Prefers clear scheduling', 'Responds to short texts'];
      var learned = [c.name + ' books ' + (c.preferredService || 'detailing') + ' services.', (c.vehicle ? 'Vehicle on file: ' + c.vehicle + '.' : 'Vehicle details still light.'), completed.length ? completed.length + ' completed visits on record.' : 'Still early in the relationship.'];
      body.innerHTML = '<div class="jos-ai-notes"><h3>AI Notes</h3><div class="jos-card jos-mt"><div class="jos-kicker">Customer Summary</div><p style="font-size:13px;margin-top:8px">' + esc(aiCustomerSummary(c, completed, booked)) + '</p></div>' +
        '<div class="jos-card"><div class="jos-kicker">Preferences</div><ul class="jos-check-list">' + prefs.map(function (p) { return '<li>✓ ' + esc(p) + '</li>'; }).join('') + '</ul></div>' +
        '<div class="jos-card"><div class="jos-kicker">AI Recommendations</div><p style="font-size:13px;margin-top:8px">' + esc(c.customerType === 'recurring' ? 'Keep member slots priority and confirm 24h ahead.' : 'Offer a membership after the next completed visit.') + '</p><div class="jos-mt">' + btn('ask-cust', 'Ask Hubly', 'jos-btn-brand jos-btn-sm') + '</div></div>' +
        '<div class="jos-card"><div class="jos-kicker">Things Hubly Has Learned</div><ul class="jos-learn-list">' + learned.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
        '<div class="jos-card"><div class="jos-kicker">Confidence</div><div class="jos-stack jos-mt">' + confBar('Service Preferences', Math.min(94, 55 + completed.length * 8)) + confBar('Communication', c.phone || c.email ? 78 : 52) + confBar('Vehicle', c.vehicle || vehicleOf(last) ? 86 : 48) + '</div></div></div>';
    } else if (tab === 'History') {
      var nodes = [];
      quotes().filter(function (q) { return q.customerName === c.name; }).forEach(function (q) {
        nodes.push({ ico: 'Q', kind: 'quote', t: 'Quote', s: money(q.amount || 0) + ' · ' + (q.status || 'draft'), at: q.createdAt || q.updatedAt || '' });
      });
      custJobs.forEach(function (j) {
        if (j.fromBooking || j.source === 'website') nodes.push({ ico: 'W', kind: 'web', t: 'Website Visit', s: 'Led to ' + (j.service || 'booking'), at: j.createdAt || j.date || '' });
        if (j.status === 'pending' || jobActive(j)) nodes.push({ ico: 'B', kind: 'book', t: 'Booked', s: (j.service || '') + (j.date ? ' · ' + dateLong(j.date) : ''), at: j.createdAt || j.date || '' });
        if (j.status === 'completed') {
          nodes.push({ ico: '$', kind: 'paid', t: 'Paid', s: (j.service || '') + (j.amount != null ? ' · ' + money(j.amount) : ''), at: j.date || j.createdAt || '' });
          if (parseFloat(j.amount) >= 200) nodes.push({ ico: '*', kind: 'review', t: 'Review', s: 'Strong job — good moment to ask', at: j.date || '' });
        }
        if (j.isMembershipSignup || /membership/i.test(String(j.service || ''))) nodes.push({ ico: 'M', kind: 'mem', t: 'Membership', s: j.service || 'Plan started', at: j.date || j.createdAt || '' });
      });
      if (c.customerType === 'recurring') nodes.push({ ico: 'M', kind: 'mem', t: 'Membership', s: 'Active recurring plan', at: c.createdAt || '' });
      if (!nodes.length) {
        nodes = custJobs.slice().sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); }).map(function (j) {
          return { ico: '·', kind: 'book', t: (j.status || 'job') + ' · ' + (j.service || 'Service'), s: (j.date ? dateLong(j.date) : '') + (j.amount != null ? ' · ' + money(j.amount) : ''), at: j.date || '' };
        });
      }
      nodes.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
      body.innerHTML = '<div class="jos-card"><h3 style="font-size:15px;font-weight:800;margin-bottom:10px">Customer Timeline</h3>' + (nodes.length ? '<div class="jos-timeline">' + nodes.map(function (n) {
        return '<div class="jos-tl-item"><div class="jos-tl-ico ' + esc(n.kind) + '">' + esc(n.ico) + '</div><div><div class="jos-tl-t">' + esc(n.t) + '</div><div class="jos-tl-s">' + esc(n.s) + (n.at ? ' · ' + esc(String(n.at).slice(0, 10)) : '') + '</div></div></div>';
      }).join('') + '</div>' : '<div class="jos-empty">No history yet.</div>') + '</div>';
    } else if (tab === 'Files') {
      body.innerHTML = '<div class="jos-stack"><div class="jos-file-row"><strong>Quotes & receipts</strong><div class="jos-muted jos-mt">PDFs and photos attached to jobs appear here.</div></div><div class="jos-file-row"><strong>Quick Quote</strong><div class="jos-muted jos-mt">Create a new quote for this customer.</div><div class="jos-mt">' + btn('smart-quote', 'Create Quick Quote', 'jos-btn-brand jos-btn-sm') + '</div></div></div>';
    } else if (tab === 'Activity') {
      var acts = custJobs.slice().sort(function (a, b) { return String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')); }).slice(0, 12);
      body.innerHTML = acts.length ? '<div class="jos-activity">' + acts.map(function (j) {
        return '<div class="jos-act"><div class="jos-act-ico ' + (j.status === 'completed' ? 'book' : 'quote') + '">' + (j.status === 'completed' ? '✓' : '·') + '</div><div><div class="jos-act-t">' + esc((j.status || 'job') + ' · ' + (j.service || 'Service')) + '</div><div class="jos-act-s">' + esc((j.date ? dateLong(j.date) : '') + (j.amount != null ? ' · ' + money(j.amount) : '')) + '</div></div></div>';
      }).join('') + '</div>' : '<div class="jos-empty">No activity yet.</div>';
    } else body.innerHTML = '<div class="jos-empty">Nothing here yet.</div>';
    bindRoot(body);
  }
  function openCustomerProfile(id, tab) {
    var c = customers().find(function (x) { return String(x.id) === String(id); });
    if (!c) { toast('Customer not found'); return; }
    var shell = ensureProfileShell();
    S().activeCustId = c.id; S()._josProfileTab = tab || 'Overview'; shell._josCustId = c.id; shell._josJobId = null;
    el('jos-cp-av').textContent = initials(c.name); el('jos-cp-name').textContent = c.name || 'Customer';
    el('jos-cp-pill').innerHTML = statusPill(c);
    el('jos-cp-meta').textContent = [c.phone, c.email].filter(Boolean).join(' · ') || 'No contact info';
    var done = custJobsFor(c).filter(function (j) { return j.status === 'completed'; });
    var spent = done.reduce(function (s, j) { return s + (parseFloat(j.amount) || 0); }, 0);
    var since = c.createdAt || c.customerSince || (done.length ? done.slice().sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); })[0].date : null);
    var last = lastJob(c);
    el('jos-cp-stats').innerHTML = [['Customer since', since ? dateLong(String(since).slice(0, 10)) : '—'], ['Total spent', money(spent) || '$0'], ['Jobs', String(done.length)], ['Last service', last?.date ? dateLong(last.date) : '—'], ['Membership', c.customerType === 'recurring' ? 'Active' : 'None']].map(function (x) {
      return '<div class="jos-cp-stat"><div class="l">' + esc(x[0]) + '</div><div class="v">' + esc(x[1]) + '</div></div>';
    }).join('');
    el('jos-cp-tabs').innerHTML = PROFILE_TABS.map(function (t) {
      return '<button type="button" class="jos-profile-tab' + ((S()._josProfileTab || 'Overview') === t ? ' on' : '') + '" data-jos-tab="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('');
    renderProfileTab(c, S()._josProfileTab || 'Overview'); shell.classList.add('open');
  }

  function ownPixelView(viewId, rootId) {
    var view = el(viewId), root = el(rootId);
    if (!view) return root;
    view.classList.add('jos-pixel-owned');
    Array.prototype.slice.call(view.children).forEach(function (ch) { if (ch.id !== rootId) ch.remove(); });
    if (!root) { root = document.createElement('div'); root.id = rootId; view.appendChild(root); }
    return root;
  }

  function conversations() {
    var st = S();
    return Array.isArray(st.conversations) && st.conversations.length ? st.conversations : (Array.isArray(st.chatConversations) ? st.chatConversations : []);
  }

  function demoConversations() {
    return [
      { id: 'conv1', customer_name: 'Alex Rivera', channel: 'sms', last_message: 'Can you fit me in for ceramic coating this week?', unread: 2, updated_at: todayStr() + 'T09:15:00', phone: '(619) 555-0133', priority: 'high', isLead: true, needsAttention: true, messages: [{ dir: 'in', text: 'Hi, saw your Google listing. Do you do ceramic coating?', at: '9:02 AM' }, { dir: 'out', text: 'Yes! I have Thursday or Saturday open. What vehicle?', at: '9:05 AM' }, { dir: 'in', text: 'Can you fit me in for ceramic coating this week?', at: '9:15 AM' }] },
      { id: 'conv2', customer_name: 'Sarah Johnson', channel: 'sms', last_message: 'Perfect, see you at 9am tomorrow.', unread: 0, updated_at: todayStr() + 'T08:40:00', phone: '(619) 555-0198', vip: true, messages: [{ dir: 'out', text: 'Reminder: Interior Detail tomorrow at 9:00 AM.', at: '8:30 AM' }, { dir: 'in', text: 'Perfect, see you at 9am tomorrow.', at: '8:40 AM' }] },
      { id: 'conv3', customer_name: 'Taylor Kim', channel: 'instagram', last_message: 'How much for a Model 3 interior?', unread: 1, updated_at: todayStr() + 'T07:22:00', vehicle: 'Tesla Model 3', needsAttention: true, messages: [{ dir: 'in', text: 'How much for a Model 3 interior?', at: '7:22 AM' }] },
      { id: 'conv4', customer_name: 'Jordan Lee', channel: 'chat', last_message: 'Left at vehicle size step', unread: 1, updated_at: todayStr() + 'T06:50:00', aiMode: 'ai', needsAttention: true, messages: [{ dir: 'in', text: 'Started booking Exterior Detail', at: '6:45 AM' }, { dir: 'sys', text: 'Left at vehicle size step', at: '6:50 AM' }] },
      { id: 'conv5', customer_name: 'Emily Wilson', channel: 'email', email: 'emily@example.com', last_message: 'Can you send the ceramic quote as a PDF?', unread: 1, updated_at: todayStr() + 'T10:05:00', needsAttention: true, messages: [{ dir: 'in', text: 'Can you send the ceramic quote as a PDF?', at: '10:05 AM', attachment: 'request.pdf' }] },
      { id: 'conv6', customer_name: 'Chris Park', channel: 'facebook', last_message: 'Do you detail trucks at the office park?', unread: 0, updated_at: todayStr() + 'T11:20:00', messages: [{ dir: 'in', text: 'Do you detail trucks at the office park?', at: '11:18 AM' }, { dir: 'out', text: 'Yes — mobile service available in Mission Valley.', at: '11:20 AM' }] },
      { id: 'conv7', customer_name: 'Website Visitor', channel: 'ai', last_message: 'AI could not confirm vehicle size', unread: 1, updated_at: todayStr() + 'T12:01:00', aiFailed: true, needsAttention: true, aiMode: 'ai', messages: [{ dir: 'in', text: 'I want an exterior detail tomorrow', at: '11:58 AM' }, { dir: 'sys', text: 'AI could not confirm vehicle size', at: '12:01 PM' }] }
    ];
  }

  function channelCounts(convs) {
    var counts = { chat: 0, sms: 0, email: 0, facebook: 0, instagram: 0, needs: 0 };
    (convs || []).forEach(function (c) {
      var ch = String(c.channel || 'chat').toLowerCase();
      if (ch === 'website' || ch === 'web') ch = 'chat';
      if (counts[ch] == null) counts.chat += (c.unread || 0);
      else counts[ch] += (c.unread || 0);
      if ((c.unread || 0) > 0 || c.needsAttention) counts.needs++;
    });
    return counts;
  }

  function homeScores() {
    var done = jobs().filter(function (j) { return j.status === 'completed' && !j.isBlock; }).length;
    var members = customers().filter(function (c) { return c.customerType === 'recurring'; }).length;
    var pending = jobs().filter(function (j) { return j.status === 'pending'; }).length;
    var leads = collectLeads().length;
    var rating = Number(S().website?.reviewRating || 4.9);
    var revenue = Math.max(55, Math.min(99, 70 + Math.min(25, done * 2)));
    var reviews = Math.max(50, Math.min(99, Math.round(rating * 18)));
    var marketing = Math.max(48, Math.min(96, 62 + Math.min(20, leads)));
    var leadResp = Math.max(45, Math.min(98, 88 - Math.min(30, pending * 4)));
    var membership = Math.max(40, Math.min(97, 50 + members * 8));
    var overall = Math.round((revenue + reviews + marketing + leadResp + membership) / 5);
    return { overall: overall, revenue: revenue, reviews: reviews, marketing: marketing, leadResp: leadResp, membership: membership };
  }

  function homeLayout() {
    try { return JSON.parse(localStorage.getItem('hubly_home_layout_v1') || 'null'); } catch (e) { return null; }
  }

  function saveHomeLayout(layout) {
    try { localStorage.setItem('hubly_home_layout_v1', JSON.stringify(layout || {})); } catch (e) {}
  }

  function sparkSvg(vals, color) {
    vals = vals || [12, 18, 14, 22, 20, 28, 26];
    var max = Math.max.apply(null, vals) || 1;
    var w = 120, h = 28, step = w / Math.max(1, vals.length - 1);
    var pts = vals.map(function (v, i) { return (i * step).toFixed(1) + ',' + (h - (v / max) * (h - 4) - 2).toFixed(1); }).join(' ');
    return '<svg class="jos-spark" viewBox="0 0 ' + w + ' ' + h + '" width="120" height="28" aria-hidden="true"><polyline fill="none" stroke="' + (color || '#D9632D') + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" points="' + pts + '"/></svg>';
  }

  var CHROME = {
    dashboard: { title: 'Home', sub: 'Good morning — let\u2019s grow your business today.' },
    chats: { title: 'Inbox', sub: 'Every conversation in one place.' },
    jobs: { title: 'Jobs & Calendar', sub: 'Schedule, routes, and today\u2019s work.' },
    leads: { title: 'Leads', sub: 'Capture and convert new demand.' },
    customers: { title: 'Customers', sub: 'People, vehicles, and history.' },
    pipeline: { title: 'Pipeline', sub: 'Move every job from inquiry to booked.' },
    editor: { title: 'Storefront', sub: 'Your booking site and pages.' },
    marketing: { title: 'Marketing', sub: 'Campaigns that fill the calendar.' },
    reviews: { title: 'Reviews', sub: 'Reputation and request flows.' },
    memberships: { title: 'Memberships', sub: 'Recurring revenue plans.' },
    money: { title: 'Revenue', sub: 'Payments, invoices, and cash flow.' },
    reports: { title: 'Reports', sub: 'Performance across the business.' },
    ask: { title: 'Ask Hubly', sub: 'Your operating partner for follow-ups, pricing, and growth.' },
    settings: { title: 'Settings', sub: 'Business, team, and integrations.' }
  };
  function updateChrome(v) {
    var c = CHROME[v] || { title: v, sub: '' };
    var titleEl = el('bar-title'), subEl = el('bar-sub');
    if (titleEl) titleEl.textContent = c.title;
    if (subEl) subEl.textContent = c.sub;
    if (typeof global.setHublyDocTitle === 'function') global.setHublyDocTitle(c.title);
  }

  function enhanceDashboard() {
    var root = ownPixelView('v-dashboard', 'jos-dash-root');
    if (!root) return;
    updateChrome('dashboard');
    root.classList.add('jos-home-root');
    try {
      renderHomeDashboard(root);
    } catch (err) {
      console.warn('HublyJourneyOS Home', err);
      root.innerHTML = '<div class="jos-page jos-home-page"><div class="jos-empty jos-error-state"><strong>Home could not load</strong><p class="jos-muted">Refresh or Ask Hubly for help.</p><div class="jos-mt">' +
        btn('go-ask', 'Ask Hubly', 'jos-btn-brand jos-btn-sm') +
        ' <button type="button" class="jos-btn jos-btn-sm" onclick="HublyJourneyOS.enhanceDashboard()">Retry</button></div></div></div>';
      bindRoot(root);
    }
  }

  function canViewRevenue() {
    var st = S();
    var role = String(st.role || st.userRole || st.ownerRole || 'owner').toLowerCase();
    if (st.permissions && st.permissions.revenue === false) return false;
    if (role === 'staff' || role === 'tech' || role === 'viewer') return false;
    return true;
  }

  function renderHomeDashboard(root) {
    root.innerHTML = '<div class="jos-page jos-home-page"><div class="jos-home-loading" aria-live="polite">Loading Home…</div></div>';
    var today = todayStr();
    var allJobs = jobs().filter(function (j) { return !j.isBlock && j.status !== 'cancelled'; });
    var todayJobs = allJobs.filter(function (j) { return j.date === today; });
    var demoSched = false;
    var ceoDemo = !!S()._ceoDemo;
    if (!todayJobs.length && ceoDemo) {
      demoSched = true;
      todayJobs = [
        { id: 'demo_j1', customer: 'Sarah Johnson', service: 'Interior Detail', time: '9:00 AM', amount: 260, status: 'confirmed', address: 'La Jolla, CA', phone: '(619) 555-0198' },
        { id: 'demo_j2', customer: 'Mike Brown', service: 'Exterior Detail', time: '1:00 PM', amount: 180, status: 'confirmed', address: 'Pacific Beach, CA', phone: '(619) 555-0142' },
        { id: 'demo_j3', customer: 'Chris Park', service: 'Paint Correction', time: '4:00 PM', amount: 450, status: 'in_progress', address: 'Mission Valley, CA', phone: '(619) 555-0177' }
      ];
    }
    var completedToday = todayJobs.filter(function (j) { return j.status === 'completed'; });
    var running = todayJobs.filter(function (j) { return j.status === 'in_progress' || j.status === 'running'; });
    var upcoming = todayJobs.filter(function (j) { return j.status !== 'completed' && j.status !== 'in_progress' && j.status !== 'running'; });
    var late = todayJobs.filter(function (j) { return j.isLate || j.status === 'late'; }).length;
    var pending = jobs().filter(function (j) { return j.status === 'pending'; }).length;
    var todayRev = jobs().filter(function (j) { return j.status === 'completed' && j.date === today; }).reduce(function (s, j) { return s + (parseFloat(j.amount) || 0); }, 0);
    if (!todayRev && ceoDemo) todayRev = todayJobs.reduce(function (s, j) { return s + (parseFloat(j.amount) || 0); }, 0) * 0.35 || 845;
    var yest = new Date(); yest.setDate(yest.getDate() - 1);
    var yestStr = typeof global.dateStr === 'function' ? global.dateStr(yest) : yest.toISOString().slice(0, 10);
    var yestRev = jobs().filter(function (j) { return j.status === 'completed' && j.date === yestStr; }).reduce(function (s, j) { return s + (parseFloat(j.amount) || 0); }, 0);
    if (!yestRev && ceoDemo) yestRev = Math.round(todayRev * 0.88);
    var weekRev = jobs().filter(function (j) { return j.status === 'completed' && !j.isBlock; }).slice(0, 14).reduce(function (s, j) { return s + (parseFloat(j.amount) || 0); }, 0);
    if (!weekRev && ceoDemo) weekRev = Math.round(todayRev * 5.2);
    var month = today.slice(0, 7);
    var monthRev = jobs().filter(function (j) { return j.status === 'completed' && String(j.date || '').slice(0, 7) === month; }).reduce(function (s, j) { return s + (parseFloat(j.amount) || 0); }, 0);
    if (!monthRev && ceoDemo) monthRev = Math.round(todayRev * 18);
    var outstanding = quotes().filter(function (q) { return q.status === 'sent' || q.status === 'draft'; }).reduce(function (s, q) { return s + (parseFloat(q.amount) || 0); }, 0);
    if (!outstanding && ceoDemo) outstanding = 1240;
    var deposits = Math.round(todayRev * 0.22) || (ceoDemo ? 180 : 0);
    var revDelta = yestRev ? Math.round(((todayRev - yestRev) / yestRev) * 100) : (ceoDemo ? 12 : 0);
    var convs = conversations().length ? conversations() : (ceoDemo ? demoConversations() : []);
    var ch = channelCounts(convs);
    var msgsWaiting = convs.reduce(function (s, c) { return s + (c.unread || 0); }, 0);
    if (!msgsWaiting && ceoDemo) msgsWaiting = ch.needs || 5;
    var scores = homeScores();
    var hour = new Date().getHours(), greet = hour < 12 ? 'Good morning' : (hour < 18 ? 'Good afternoon' : 'Good evening');
    var owner = S().ownerName || 'Adrian';
    if (typeof owner === 'string' && owner.indexOf('@') > -1) owner = owner.split('@')[0];
    if (owner.indexOf(' ') > -1) owner = owner.split(' ')[0];
    var layout = homeLayout() || { tab: 'dashboard', widgets: { weather: true, route: true, upcoming: true, notifs: true, activity: true, brief: true, schedule: true, quick: true } };
    if (!layout.widgets) layout.widgets = { weather: true, route: true, upcoming: true, notifs: true, activity: true, brief: true, schedule: true, quick: true };
    var tab = root._josHomeTab || layout.tab || 'dashboard';
    root._josHomeTab = tab;
    var W = layout.widgets;
    var sparkRev = [yestRev * 0.7, yestRev * 0.85, yestRev, todayRev * 0.6, todayRev * 0.8, todayRev * 0.9, todayRev].map(function (n) { return Math.max(8, Math.round(n / 40)); });
    var openLeads = collectLeads().length;
    var reviewsNew = Math.min(6, (S().website?.manualReviews || []).length || 2);

    var schedRows = todayJobs.slice(0, 8).map(function (j) {
      var addr = j.address || j.location || '';
      var maps = addr ? 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(addr) : '';
      var tel = j.phone ? 'tel:' + String(j.phone).replace(/[^\d+]/g, '') : '';
      var st = j.status === 'in_progress' || j.status === 'running' ? 'info' : (j.status === 'completed' ? 'ok' : 'warn');
      var stLbl = j.status === 'in_progress' || j.status === 'running' ? 'In Progress' : (j.status === 'completed' ? 'Done' : 'Scheduled');
      return '<div class="jos-sched-row jos-sched-rich" data-jos-job-id="' + esc(j.id || '') + '">' +
        '<div class="time">' + esc(j.time || j.startTime || '—') + '</div>' +
        '<div class="jos-sched-body"><div class="who">' + esc(j.customer || 'Customer') + '</div>' +
        '<div class="svc">' + esc(j.service || 'Job') + (addr ? ' · ' + esc(addr) : '') + '</div></div>' +
        '<span class="jos-pill ' + st + '">' + esc(stLbl) + '</span>' +
        '<div class="jos-sched-acts">' +
        (tel ? '<a class="jos-btn jos-btn-sm" href="' + esc(tel) + '">Call</a>' : '') +
        (maps ? '<a class="jos-btn jos-btn-sm" href="' + esc(maps) + '" target="_blank" rel="noopener">Directions</a>' : '') +
        '<button type="button" class="jos-btn jos-btn-brand jos-btn-sm" data-jos-act="start-job" data-jos-job-id="' + esc(j.id || '') + '">Start Job</button>' +
        '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="reschedule-job" data-jos-job-id="' + esc(j.id || '') + '">Reschedule</button>' +
        '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="go-jobs">Open</button>' +
        '</div></div>';
    }).join('');

    var activity = buildActivity().slice(0, 8);
    if (!activity.length) {
      activity = [
        { ico: '$', kind: 'paid', t: 'Payment received', s: 'Sarah Johnson · $260' },
        { ico: '★', kind: 'review', t: 'New Google review', s: '5 stars · Emily Wilson' },
        { ico: 'L', kind: 'quote', t: 'New lead from Website', s: 'Alex Rivera · Ceramic Coating' },
        { ico: 'B', kind: 'book', t: 'Job booked', s: 'Mike Brown · Exterior Detail' },
        { ico: 'M', kind: 'mem', t: 'Membership renewed', s: 'Sarah Johnson · Pro Plan' }
      ];
    }
    var actRows = activity.map(function (a) {
      return '<button type="button" class="jos-act-row jos-act-btn" data-jos-act="' + esc(a.kind === 'paid' ? 'go-money' : (a.kind === 'review' ? 'go-reviews' : (a.kind === 'quote' ? 'go-leads' : (a.kind === 'mem' ? 'go-mem' : 'go-jobs')))) + '">' +
        '<div class="jos-act-ico">' + esc(a.ico) + '</div><div><div class="jos-act-t">' + esc(a.t) + '</div><div class="jos-act-s">' + esc(a.s) + '</div></div></button>';
    }).join('');

    var notifs = [
      { act: 'go-leads', t: 'New lead', s: 'Alex Rivera asked about ceramic coating', ago: '2m' },
      { act: 'go-jobs', t: 'New booking', s: 'Mike Brown confirmed for 1:00 PM', ago: '18m' },
      { act: 'go-money', t: 'Payment', s: 'Stripe deposited $1,240', ago: '1h' },
      { act: 'go-reviews', t: 'Review', s: 'Emily left a 5-star Google review', ago: '3h' },
      { act: 'go-chats', t: 'Message', s: '3 conversations need a reply', ago: 'now' },
      { act: 'ask-brief', t: 'AI alert', s: 'You are 22 minutes behind schedule', ago: 'now' }
    ];
    var notifHtml = notifs.map(function (n) {
      return '<button type="button" class="jos-notif-row" data-jos-act="' + esc(n.act) + '"><div><strong>' + esc(n.t) + '</strong><div class="jos-muted">' + esc(n.s) + '</div></div><span class="jos-muted">' + esc(n.ago) + '</span></button>';
    }).join('');

    var briefActions = [
      ['go-leads', 'Recover Leads'],
      ['ask', 'Publish Campaign'],
      ['ask-review', 'Reply Review'],
      ['go-editor', 'Update Website'],
      ['ask-growth', 'Raise Prices'],
      ['go-ask', 'Ask Hubly']
    ];

    var quickActions = [
      ['new-job-cust', 'New Job'],
      ['manual-lead', 'New Lead'],
      ['add-cust', 'New Customer'],
      ['smart-quote', 'New Quote'],
      ['new-invoice', 'New Invoice'],
      ['ask', 'New Campaign'],
      ['go-mem', 'New Membership'],
      ['go-ask', 'Ask Hubly']
    ];

    var tabs = [['dashboard', 'Dashboard'], ['today', 'Today'], ['activity', 'Activity Feed'], ['ai', 'AI Insights']];
    var tabsHtml = '<div class="jos-tabs jos-home-tabs">' + tabs.map(function (t) {
      return '<button type="button" class="jos-tab' + (tab === t[0] ? ' on' : '') + '" data-jos-home-tab="' + t[0] + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div>';

    var kpiRow = '<div class="jos-grid-4 jos-home-kpis">' +
      '<div class="jos-kpi jos-kpi-rich" data-jos-act="go-money" tabindex="0">' +
        '<div class="jos-kpi-top"><div class="lbl">Revenue Today</div><span class="jos-kpi-ico">$</span></div>' +
        '<div class="v">' + esc(canViewRevenue() ? money(todayRev) : '•••') + '</div>' +
        '<div class="s">' + (revDelta >= 0 ? '↗ ' : '↘ ') + Math.abs(revDelta) + '% vs yesterday</div>' +
        sparkSvg(sparkRev) +
        '<div class="jos-kpi-hover"><div class="jos-kicker">Today breakdown</div>' +
        '<div class="jos-hover-row"><span>Yesterday</span><strong>' + esc(canViewRevenue() ? money(yestRev) : 'Hidden') + '</strong></div>' +
        '<div class="jos-hover-row"><span>This week</span><strong>' + esc(money(weekRev)) + '</strong></div>' +
        '<div class="jos-hover-row"><span>This month</span><strong>' + esc(money(monthRev)) + '</strong></div>' +
        '<div class="jos-hover-row"><span>Pending deposits</span><strong>' + esc(money(deposits)) + '</strong></div>' +
        '<div class="jos-hover-row"><span>Outstanding invoices</span><strong>' + esc(money(outstanding)) + '</strong></div>' +
        '<div class="jos-hover-row"><span>Goal</span><strong>' + esc(money(Math.round(todayRev * 1.15) || 1500)) + '</strong></div></div></div>' +
      '<div class="jos-kpi jos-kpi-rich" data-jos-act="go-jobs" tabindex="0">' +
        '<div class="jos-kpi-top"><div class="lbl">Jobs Today</div><span class="jos-kpi-ico">J</span></div>' +
        '<div class="v">' + todayJobs.length + '</div>' +
        '<div class="s">' + completedToday.length + ' done · ' + upcoming.length + ' upcoming · ' + running.length + ' running' + (late ? ' · ' + late + ' late' : '') + '</div>' +
        sparkSvg([2, 3, 4, 3, 5, 6, todayJobs.length], '#2563EB') +
        '<div class="jos-kpi-hover"><div class="jos-kicker">Today\'s work</div>' +
        todayJobs.slice(0, 4).map(function (j) { return '<div class="jos-hover-row"><span>' + esc(j.time || '') + ' ' + esc(j.service || '') + '</span><strong>' + esc(j.customer || '') + '</strong></div>'; }).join('') +
        '</div></div>' +
      '<div class="jos-kpi jos-kpi-rich" data-jos-act="go-chats" tabindex="0">' +
        '<div class="jos-kpi-top"><div class="lbl">Messages Waiting</div><span class="jos-kpi-ico">✉</span></div>' +
        '<div class="v">' + msgsWaiting + '</div>' +
        '<div class="s">' + ch.needs + ' need attention</div>' +
        sparkSvg([1, 2, 2, 3, 2, 4, msgsWaiting], '#B84E1F') +
        '<div class="jos-kpi-hover"><div class="jos-kicker">By channel</div>' +
        '<div class="jos-hover-row"><span>Website chat</span><strong>' + ch.chat + '</strong></div>' +
        '<div class="jos-hover-row"><span>SMS</span><strong>' + ch.sms + '</strong></div>' +
        '<div class="jos-hover-row"><span>Email</span><strong>' + ch.email + '</strong></div>' +
        '<div class="jos-hover-row"><span>Facebook</span><strong>' + ch.facebook + '</strong></div>' +
        '<div class="jos-hover-row"><span>Instagram</span><strong>' + ch.instagram + '</strong></div>' +
        '<div class="jos-hover-row"><span>AI needs attention</span><strong>' + ch.needs + '</strong></div></div></div>' +
      '<div class="jos-kpi jos-kpi-rich" data-jos-act="go-reports" tabindex="0">' +
        '<div class="jos-kpi-top"><div class="lbl">Growth Score</div><span class="jos-kpi-ico">↑</span></div>' +
        '<div class="v">' + scores.overall + '</div>' +
        '<div class="s">' + (scores.overall >= 85 ? 'Excellent' : (scores.overall >= 70 ? 'Great' : 'Needs attention')) + ' · +4 this week</div>' +
        sparkSvg([scores.overall - 12, scores.overall - 8, scores.overall - 5, scores.overall - 2, scores.overall], '#15803D') +
        '<div class="jos-kpi-hover"><div class="jos-kicker">Score breakdown</div>' +
        '<div class="jos-hover-row"><span>Revenue</span><strong>' + scores.revenue + '</strong></div>' +
        '<div class="jos-hover-row"><span>Reviews</span><strong>' + scores.reviews + '</strong></div>' +
        '<div class="jos-hover-row"><span>Marketing</span><strong>' + scores.marketing + '</strong></div>' +
        '<div class="jos-hover-row"><span>Lead response</span><strong>' + scores.leadResp + '</strong></div>' +
        '<div class="jos-hover-row"><span>Membership</span><strong>' + scores.membership + '</strong></div>' +
        '<p class="jos-muted jos-mt">AI: Increase response speed to gain ~6 points.</p></div></div></div>';

    var mainDash =
      '<div class="jos-card jos-sched-card' + (W.schedule === false ? ' jos-widget-hidden' : '') + '" data-jos-widget="schedule"><div class="jos-between"><div class="jos-kicker">Today\'s Schedule</div>' + btn('go-jobs', 'Open calendar', 'jos-btn jos-btn-sm') + '</div>' +
      (schedRows || '<div class="jos-empty">No jobs on the calendar today. ' + btn('new-job-cust', 'Book a job', 'jos-btn-brand jos-btn-sm') + '</div>') +
      (demoSched ? '<p class="jos-muted jos-mt">Demo schedule for CEO walkthrough — your live jobs appear here.</p>' : '') + '</div>' +
      '<div class="jos-brief' + (W.brief === false ? ' jos-widget-hidden' : '') + '" data-jos-widget="brief"><div class="sk">AI Morning Brief</div><h2>' + esc(greet) + ', ' + esc(owner) + '.</h2>' +
      '<p><strong>Revenue:</strong> Yesterday ' + esc(money(yestRev)) + ' (' + (revDelta >= 0 ? '+' : '') + revDelta + '%). Today on pace for ' + esc(money(todayRev)) + '.</p>' +
      '<p><strong>Jobs:</strong> ' + todayJobs.length + ' today · ' + completedToday.length + ' done · ' + upcoming.length + ' upcoming' + (late ? ' · ' + late + ' late' : '') + '.</p>' +
      '<p><strong>Leads:</strong> ' + openLeads + ' open · <strong>Messages:</strong> ' + msgsWaiting + ' waiting · <strong>Reviews:</strong> ' + reviewsNew + ' new.</p>' +
      '<p><strong>Marketing:</strong> Father\'s Day promo is ready. Ceramic coating converts 3× better — move it higher on Storefront?</p>' +
      '<div class="jos-brief-actions">' + briefActions.map(function (a) { return btn(a[0], a[1], a[0] === 'go-leads' ? 'jos-btn-brand jos-btn-sm' : 'jos-btn jos-btn-sm'); }).join('') + '</div></div>' +
      '<div class="jos-card' + (W.activity === false ? ' jos-widget-hidden' : '') + '" data-jos-widget="activity"><div class="jos-between"><div class="jos-kicker">Recent Activity</div><button type="button" class="jos-btn jos-btn-sm" data-jos-home-tab="activity">View all</button></div><div class="jos-act-list">' + (actRows || '<div class="jos-empty">No activity yet</div>') + '</div></div>' +
      '<div class="jos-card' + (W.quick === false ? ' jos-widget-hidden' : '') + '" data-jos-widget="quick"><div class="jos-kicker">Quick Actions</div><div class="jos-qa-grid">' + quickActions.map(function (q) {
        return '<button type="button" class="jos-qa-tile" data-jos-act="' + esc(q[0]) + '"><span>+</span>' + esc(q[1]) + '</button>';
      }).join('') + '</div></div>';

    var rail =
      '<div class="jos-card' + (W.weather === false ? ' jos-widget-hidden' : '') + '" data-jos-widget="weather"><div class="jos-kicker">Weather</div><div class="jos-weather"><div class="jos-weather-temp">72°F</div><div><strong>Sunny</strong><div class="jos-muted">0% rain · Wind 6 mph · Sunset 7:48 PM</div></div></div>' +
      '<div class="jos-weather-alert ok">Rain warning: None — roads dry all day</div>' +
      '<p class="jos-muted jos-mt">AI: Great day for mobile detailing. No rain risk for afternoon jobs. Prefer exterior work before 4 PM wind pickup.</p></div>' +
      '<div class="jos-card' + (W.route === false ? ' jos-widget-hidden' : '') + '" data-jos-widget="route"><div class="jos-kicker">Today\'s Route</div><div class="jos-route-map" aria-hidden="true"><div class="jos-route-line"></div><i>1</i><i>2</i><i>3</i></div>' +
      '<div class="jos-muted jos-mt">' + Math.max(1, todayJobs.length) + ' stops · 32.4 miles</div><div class="jos-mt">' + btn('go-jobs', 'View Route', 'jos-btn-brand jos-btn-sm') + '</div></div>' +
      '<div class="jos-card' + (W.upcoming === false ? ' jos-widget-hidden' : '') + '" data-jos-widget="upcoming"><div class="jos-kicker">Upcoming Jobs</div><div class="jos-stack jos-mt">' +
      (todayJobs.length ? todayJobs.slice(0, 4).map(function (j) {
        return '<button type="button" class="jos-between jos-act-btn" data-jos-act="go-jobs" style="padding:6px 0"><div><strong style="font-size:13px">' + esc(j.customer) + '</strong><div class="jos-muted">' + esc(j.service) + '</div></div><span class="jos-muted">' + esc(j.time) + '</span></button>';
      }).join('') : '<div class="jos-empty">No upcoming jobs</div>') + '</div><div class="jos-mt">' + btn('go-jobs', 'View All Jobs', 'jos-btn jos-btn-sm') + '</div></div>' +
      '<div class="jos-card jos-notif-panel' + (W.notifs === false ? ' jos-widget-hidden' : '') + '" id="jos-home-notifs" data-jos-widget="notifs"><div class="jos-between"><div class="jos-kicker">Notifications</div><span class="jos-pill hot">' + notifs.length + '</span></div><div class="jos-stack jos-mt">' + notifHtml + '</div></div>';

    var customizeHtml = '<div class="jos-customize" id="jos-home-customize"><div class="jos-between"><div class="jos-kicker">Customize dashboard</div>' + btn('save-home-layout', 'Save layout', 'jos-btn-brand jos-btn-sm') + '</div>' +
      '<div class="jos-customize-grid">' +
      [['schedule', 'Schedule'], ['brief', 'AI Brief'], ['activity', 'Activity'], ['quick', 'Quick Actions'], ['weather', 'Weather'], ['route', 'Route'], ['upcoming', 'Upcoming'], ['notifs', 'Notifications']].map(function (w) {
        return '<label><input type="checkbox" data-jos-widget-toggle="' + w[0] + '"' + (W[w[0]] === false ? '' : ' checked') + '> ' + w[1] + '</label>';
      }).join('') + '</div></div>';

    var body = '';
    if (tab === 'today') {
      body = '<div class="jos-stack">' + kpiRow + '<div class="jos-card"><div class="jos-kicker">Today only</div>' + (schedRows || '<div class="jos-empty">Nothing scheduled</div>') + '</div></div>';
    } else if (tab === 'activity') {
      body = '<div class="jos-card"><div class="jos-kicker">Activity Feed</div><div class="jos-act-list jos-mt">' + actRows + '</div></div>';
    } else if (tab === 'ai') {
      body = '<div class="jos-brief"><div class="sk">AI Insights</div><h2>What Hubly wants you to do</h2>' +
        '<p>Lead response score is ' + scores.leadResp + '. Replying within 5 minutes to Alex could close a $650 ceramic job.</p>' +
        '<p>Membership score is ' + scores.membership + '. ' + customers().filter(function (c) { return c.customerType !== 'recurring'; }).length + ' customers are membership-ready.</p>' +
        '<div class="jos-brief-actions">' + btn('go-chats', 'Reply now', 'jos-btn-brand jos-btn-sm') + btn('go-mem', 'Offer memberships', 'jos-btn jos-btn-sm') + btn('ask-brief', 'Full brief', 'jos-btn jos-btn-sm') + '</div></div>';
    } else {
      body = kpiRow + '<div class="jos-home-main"><div class="jos-stack">' + mainDash + '</div><div class="jos-stack">' + rail + '</div></div>';
    }

    root.innerHTML =
      '<div class="jos-page jos-home-page">' +
      '<div class="jos-page-head"><div><h1>' + esc(greet) + ', ' + esc(owner) + '</h1>' +
      '<p>What should you focus on today at ' + esc(S().biz || 'your business') + '?</p></div>' +
      '<div class="jos-page-actions">' + btn('go-ask', 'Ask Hubly', 'jos-btn-brand jos-btn-sm') + btn('toggle-notifs', 'Notifications', 'jos-btn jos-btn-sm') + btn('toggle-customize', 'Customize', 'jos-btn jos-btn-sm') + '</div></div>' +
      customizeHtml + tabsHtml + body + '</div>';

    bindRoot(root);
    if (!root._josHomeBound) {
      root._josHomeBound = true;
      root.addEventListener('click', function (e) {
        var tabBtn = e.target.closest('[data-jos-home-tab]');
        if (tabBtn) {
          root._josHomeTab = tabBtn.getAttribute('data-jos-home-tab');
          var cur = homeLayout() || {};
          cur.tab = root._josHomeTab;
          saveHomeLayout(cur);
          enhanceDashboard();
          return;
        }
        if (e.target.closest('[data-jos-act="toggle-notifs"]')) {
          root.classList.toggle('jos-notifs-open');
          openNotifPop();
          var panel = el('jos-home-notifs');
          if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          e.stopPropagation();
          return;
        }
        if (e.target.closest('[data-jos-act="toggle-customize"]')) {
          root.classList.toggle('jos-customize-on');
          e.stopPropagation();
          return;
        }
        if (e.target.closest('[data-jos-act="save-home-layout"]')) {
          var next = homeLayout() || {};
          next.tab = root._josHomeTab || 'dashboard';
          next.widgets = next.widgets || {};
          root.querySelectorAll('[data-jos-widget-toggle]').forEach(function (inp) {
            next.widgets[inp.getAttribute('data-jos-widget-toggle')] = !!inp.checked;
          });
          saveHomeLayout(next);
          root.classList.remove('jos-customize-on');
          toast('Dashboard layout saved');
          enhanceDashboard();
          e.stopPropagation();
          return;
        }
        if (e.target.closest('[data-jos-act="start-job"]')) {
          toast('Job started — timer running');
          e.stopPropagation();
          return switchNav('jobs');
        }
        if (e.target.closest('[data-jos-act="reschedule-job"]')) {
          toast('Opening calendar to reschedule…');
          e.stopPropagation();
          return switchNav('jobs');
        }
      });
    }
    wireGlobalChrome(notifs);
  }

  function runGlobalSearch(q) {
    q = String(q || '').trim().toLowerCase();
    var hits = [];
    if (!q) {
      hits.push({ act: 'go-ask', t: 'Ask Hubly', s: 'Type a question or search customers, jobs, leads…' });
      return hits;
    }
    customers().forEach(function (c) {
      var blob = ((c.name || '') + ' ' + (c.phone || '') + ' ' + (c.email || '')).toLowerCase();
      if (blob.indexOf(q) > -1) hits.push({ act: 'go-customers', t: c.name || 'Customer', s: 'Customer · ' + (c.phone || c.email || 'Profile'), custId: c.id });
    });
    collectLeads().forEach(function (l) {
      var blob = ((l.name || l.customer || '') + ' ' + (l.service || '') + ' ' + (l.source || '')).toLowerCase();
      if (blob.indexOf(q) > -1) hits.push({ act: 'go-leads', t: l.name || l.customer || 'Lead', s: 'Lead · ' + (l.service || l.source || 'Open') });
    });
    jobs().filter(function (j) { return !j.isBlock; }).forEach(function (j) {
      var blob = ((j.customer || '') + ' ' + (j.service || '') + ' ' + (j.address || '')).toLowerCase();
      if (blob.indexOf(q) > -1) hits.push({ act: 'go-jobs', t: (j.customer || 'Job') + ' · ' + (j.service || ''), s: 'Job · ' + (j.date || '') + ' ' + (j.time || '') });
    });
    (conversations().length ? conversations() : demoConversations()).forEach(function (c) {
      var blob = ((c.customer_name || c.name || '') + ' ' + (c.last_message || '') + ' ' + (c.channel || '')).toLowerCase();
      if (blob.indexOf(q) > -1) hits.push({ act: 'go-chats', t: c.customer_name || c.name || 'Conversation', s: 'Message · ' + (c.channel || 'chat') });
    });
    (S().services || []).forEach(function (svc) {
      var name = typeof svc === 'string' ? svc : (svc.name || svc.title || '');
      if (String(name).toLowerCase().indexOf(q) > -1) hits.push({ act: 'go-editor', t: name, s: 'Service · Storefront' });
    });
    ((S().website && S().website.manualReviews) || []).forEach(function (r) {
      var blob = ((r.name || r.author || '') + ' ' + (r.text || r.body || '')).toLowerCase();
      if (blob.indexOf(q) > -1) hits.push({ act: 'go-reviews', t: r.name || r.author || 'Review', s: 'Review · ' + (r.rating || 5) + ' stars' });
    });
    if (!hits.length) hits.push({ act: 'go-ask', t: 'No matches for “' + q + '”', s: 'Ask Hubly to help find it' });
    return hits.slice(0, 12);
  }

  function ensureSearchPop() {
    var pop = el('jos-search-pop');
    if (pop) return pop;
    pop = document.createElement('div');
    pop.id = 'jos-search-pop';
    pop.className = 'jos-search-pop';
    document.body.appendChild(pop);
    pop.addEventListener('click', function (e) {
      var hit = e.target.closest('[data-jos-act]');
      if (!hit) return;
      var act = hit.getAttribute('data-jos-act');
      var cid = hit.getAttribute('data-jos-cust');
      pop.classList.remove('open');
      if (cid) return openCustomerProfile(cid);
      if (act === 'go-customers') return switchNav('customers');
      if (act === 'go-leads') return switchNav('leads');
      if (act === 'go-jobs') return switchNav('jobs');
      if (act === 'go-chats') return switchNav('chats');
      if (act === 'go-reviews') return switchNav('reviews');
      if (act === 'go-editor') return switchNav('editor');
      if (act === 'go-ask') return switchNav('ask');
    });
    return pop;
  }

  function openSearchPop(q) {
    var input = el('jos-global-search');
    var pop = ensureSearchPop();
    var hits = runGlobalSearch(q);
    var groups = {};
    hits.forEach(function (h) {
      var g = h.act === 'go-customers' ? 'Customers' : (h.act === 'go-leads' ? 'Leads' : (h.act === 'go-jobs' ? 'Jobs' : (h.act === 'go-chats' ? 'Messages' : (h.act === 'go-reviews' ? 'Reviews' : (h.act === 'go-editor' ? 'Services' : 'Hubly')))));
      (groups[g] = groups[g] || []).push(h);
    });
    pop.innerHTML = Object.keys(groups).map(function (g) {
      return '<div class="jos-search-sec">' + esc(g) + '</div>' + groups[g].map(function (h) {
        return '<button type="button" class="jos-search-hit" data-jos-act="' + esc(h.act) + '"' + (h.custId != null ? ' data-jos-cust="' + esc(String(h.custId)) + '"' : '') + '><strong>' + esc(h.t) + '</strong><span>' + esc(h.s) + '</span></button>';
      }).join('');
    }).join('') || '<div class="jos-search-empty">Start typing to search</div>';
    if (input) {
      var r = input.getBoundingClientRect();
      pop.style.top = (r.bottom + 8) + 'px';
      pop.style.left = Math.max(12, Math.min(r.left, window.innerWidth - 432)) + 'px';
    }
    pop.classList.add('open');
  }

  function ensureNotifPop() {
    var pop = el('jos-notif-pop');
    if (pop) return pop;
    pop = document.createElement('div');
    pop.id = 'jos-notif-pop';
    pop.className = 'jos-notif-pop';
    document.body.appendChild(pop);
    bindRoot(pop);
    return pop;
  }

  function openNotifPop() {
    var bell = document.querySelector('.jos-bar-bell');
    var pop = ensureNotifPop();
    var items = [
      { act: 'go-leads', t: 'New lead', s: 'Alex Rivera asked about ceramic coating' },
      { act: 'go-jobs', t: 'New booking', s: 'Mike Brown confirmed for 1:00 PM' },
      { act: 'go-money', t: 'Payment', s: 'Stripe deposited $1,240' },
      { act: 'go-reviews', t: 'Review', s: 'Emily left a 5-star Google review' },
      { act: 'go-chats', t: 'Message', s: '3 conversations need a reply' },
      { act: 'ask-brief', t: 'AI alert', s: 'You are 22 minutes behind schedule' }
    ];
    pop.innerHTML = items.map(function (n) {
      return '<button type="button" data-jos-act="' + esc(n.act) + '"><strong style="display:block;font-size:13px">' + esc(n.t) + '</strong><span class="jos-muted">' + esc(n.s) + '</span></button>';
    }).join('');
    if (bell) {
      var r = bell.getBoundingClientRect();
      pop.style.top = (r.bottom + 8) + 'px';
      pop.style.left = Math.max(12, Math.min(r.right - 360, window.innerWidth - 380)) + 'px';
    }
    pop.classList.toggle('open');
  }

  function wireGlobalChrome(notifs) {
    var search = el('jos-global-search');
    if (search) {
      search.placeholder = 'Search customers, jobs, messages… ⌘K';
      if (!search._josWired) {
        search._josWired = true;
        search.addEventListener('focus', function () { openSearchPop(search.value); });
        search.addEventListener('input', function () { openSearchPop(search.value); });
        document.addEventListener('keydown', function (e) {
          if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k') {
            e.preventDefault();
            search.focus();
            openSearchPop(search.value);
          }
          if (e.key === 'Escape') {
            el('jos-search-pop')?.classList.remove('open');
            el('jos-notif-pop')?.classList.remove('open');
          }
        });
      }
    }
    var bell = document.querySelector('.jos-bar-bell');
    if (bell) {
      bell.setAttribute('data-count', String((notifs && notifs.length) || 6));
      if (!bell._josWired) {
        bell._josWired = true;
        bell.addEventListener('click', function (e) {
          e.stopPropagation();
          openNotifPop();
          var dash = el('jos-dash-root');
          if (dash) {
            dash.classList.add('jos-notifs-open');
            var panel = el('jos-home-notifs');
            if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        });
      }
    }
    if (!document._josPopDismiss) {
      document._josPopDismiss = true;
      document.addEventListener('click', function (e) {
        if (!e.target.closest('#jos-search-pop') && !e.target.closest('#jos-global-search') && !e.target.closest('.jos-bar-search')) {
          el('jos-search-pop')?.classList.remove('open');
        }
        if (!e.target.closest('#jos-notif-pop') && !e.target.closest('.jos-bar-bell')) {
          el('jos-notif-pop')?.classList.remove('open');
        }
      });
    }
  }

  function ensureQuickPop() {
    var pop = el('jos-quick-pop');
    if (pop) return pop;
    pop = document.createElement('div');
    pop.id = 'jos-quick-pop';
    pop.className = 'jos-quick-pop';
    pop.innerHTML = [['new-job-cust', '+ Job'], ['manual-lead', '+ Lead'], ['add-cust', '+ Customer'], ['smart-quote', '+ Quote'], ['new-invoice', '+ Invoice'], ['ask', '+ Campaign'], ['go-mem', '+ Membership'], ['go-ask', 'Ask Hubly']].map(function (x) {
      return '<button type="button" data-jos-act="' + esc(x[0]) + '">' + esc(x[1]) + '</button>';
    }).join('');
    document.body.appendChild(pop);
    bindRoot(pop);
    document.addEventListener('click', function (e) {
      if (!pop.classList.contains('open')) return;
      if (!pop.contains(e.target) && e.target.id !== 'jos-bar-new' && !e.target.closest('#jos-bar-new')) pop.classList.remove('open');
    });
    return pop;
  }

  function openQuickNew() {
    var pop = ensureQuickPop();
    pop.classList.toggle('open');
  }



  var INBOX_TABS = [
    ['all', 'All Conversations'],
    ['chat', 'Website Chat'],
    ['sms', 'SMS'],
    ['email', 'Email'],
    ['facebook', 'Facebook'],
    ['instagram', 'Instagram'],
    ['ai', 'AI Conversations'],
    ['needs', 'Needs Attention'],
    ['archived', 'Archived']
  ];
  var INBOX_TEMPLATES = [
    { id: 'greet', label: 'Greeting', body: 'Hi {{name}} — thanks for reaching out to {{biz}}. How can I help today?' },
    { id: 'quote', label: 'Quote follow-up', body: 'Hi {{name}}, just checking if you had a chance to review the quote. Happy to answer any questions.' },
    { id: 'book', label: 'Book slot', body: 'Hi {{name}}, I have openings this week. Want me to hold a time for your {{service}}?' },
    { id: 'thanks', label: 'Thanks', body: 'Appreciate you, {{name}}! Reply anytime if you need anything else.' }
  ];

  function normalizeChannel(ch) {
    ch = String(ch || 'chat').toLowerCase();
    if (ch === 'website' || ch === 'web' || ch === 'live') return 'chat';
    if (ch === 'fb' || ch === 'messenger') return 'facebook';
    if (ch === 'ig' || ch === 'dm') return 'instagram';
    return ch;
  }
  function channelLabel(ch) {
    return ({ chat: 'Website Chat', sms: 'SMS', email: 'Email', facebook: 'Facebook', instagram: 'Instagram', ai: 'AI' })[normalizeChannel(ch)] || 'Chat';
  }
  function channelIco(ch) {
    return ({ chat: 'W', sms: 'S', email: '@', facebook: 'f', instagram: 'Ig', ai: 'AI' })[normalizeChannel(ch)] || '•';
  }
  function inboxTime(raw) {
    if (!raw) return '';
    try {
      var d = new Date(raw);
      if (!isNaN(d.getTime())) {
        var now = new Date();
        if (d.toDateString() === now.toDateString()) {
          return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        }
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } catch (e) {}
    return String(raw).slice(11, 16) || String(raw);
  }
  function enrichConversation(c) {
    c = Object.assign({}, c || {});
    c.channel = normalizeChannel(c.channel);
    c.customer_name = c.customer_name || c.name || 'Visitor';
    c.last_message = c.last_message || c.lastMessage || '';
    c.unread = Number(c.unread || 0);
    c.messages = Array.isArray(c.messages) ? c.messages.slice() : [];
    c.notes = Array.isArray(c.notes) ? c.notes.slice() : (c.notes ? [c.notes] : []);
    c.attachments = Array.isArray(c.attachments) ? c.attachments : [];
    var blob = (c.last_message + ' ' + c.messages.map(function (m) { return m.text || m.content || ''; }).join(' ')).toLowerCase();
    if (c.priority == null) {
      if (c.vip || /vip/.test(blob)) c.priority = 'high';
      else if (c.unread > 0 || /price|quote|book|coating|urgent|asap/.test(blob)) c.priority = 'med';
      else c.priority = 'low';
    }
    if (c.intent == null) {
      if (/book|schedule|appointment|thursday|saturday/.test(blob)) c.intent = 'Ready to book';
      else if (/price|how much|quote|cost/.test(blob)) c.intent = 'Pricing';
      else if (/cancel|refund|complaint/.test(blob)) c.intent = 'At risk';
      else c.intent = 'Browsing';
    }
    if (c.sentiment == null) {
      if (/perfect|thanks|great|love/.test(blob)) c.sentiment = 'Positive';
      else if (/cancel|angry|upset|refund/.test(blob)) c.sentiment = 'Negative';
      else c.sentiment = 'Neutral';
    }
    if (c.isLead == null) c.isLead = /price|quote|book|coating|detail/.test(blob) || c.unread > 0;
    if (c.needsAttention == null) c.needsAttention = c.unread > 0 || c.priority === 'high' || c.aiFailed || c.channel === 'ai';
    if (c.aiMode == null) c.aiMode = c.channel === 'chat' || c.channel === 'ai' ? 'ai' : 'human';
    if (c.archived == null) c.archived = !!c.archived;
    return c;
  }
  function inboxConversations() {
    var list = conversations();
    if (!list.length) list = demoConversations();
    return list.map(enrichConversation);
  }
  function matchCustomer(conv) {
    var name = String(conv.customer_name || '').toLowerCase();
    var phone = String(conv.phone || conv.customer_phone || '').replace(/\D/g, '');
    var email = String(conv.email || conv.customer_email || '').toLowerCase();
    return customers().find(function (c) {
      if (name && String(c.name || '').toLowerCase() === name) return true;
      if (phone && String(c.phone || '').replace(/\D/g, '') === phone) return true;
      if (email && String(c.email || '').toLowerCase() === email) return true;
      return false;
    }) || null;
  }
  function integrationStatus() {
    var st = S();
    return {
      twilio: !!(st.twilioConnected || st.smsProvider === 'twilio' || st.integrations?.twilio),
      resend: !!(st.resendConnected || st.emailProvider === 'resend' || st.integrations?.resend),
      meta: !!(st.metaConnected || st.facebookConnected || st.instagramConnected || st.integrations?.meta)
    };
  }

  function renderInbox() {
    var root = ownPixelView('v-chats', 'jos-inbox-root');
    if (!root) return;
    updateChrome('chats');
    try {
      renderInboxPage(root);
    } catch (err) {
      console.warn('HublyJourneyOS Inbox', err);
      root.innerHTML = '<div class="jos-page"><div class="jos-empty jos-error-state"><strong>Inbox could not load</strong><p class="jos-muted">Refresh and try again.</p><div class="jos-mt"><button type="button" class="jos-btn jos-btn-brand jos-btn-sm" onclick="HublyJourneyOS.renderInbox()">Retry</button></div></div></div>';
    }
  }

  function renderInboxPage(root) {
    var tab = root._josInboxTab || 'all';
    var q = String(root._josInboxQ || '').trim().toLowerCase();
    var filter = root._josInboxFilter || 'all';
    var all = inboxConversations();
    var selectedId = root._josInboxId || (all[0] && all[0].id) || null;
    var integ = integrationStatus();

    var filtered = all.filter(function (c) {
      if (tab === 'archived') return !!c.archived;
      if (c.archived && tab !== 'archived') return false;
      if (tab === 'needs') return !!c.needsAttention;
      if (tab === 'ai') return c.channel === 'ai' || c.aiMode === 'ai';
      if (tab !== 'all' && normalizeChannel(c.channel) !== tab) return false;
      if (filter === 'unread' && !(c.unread > 0)) return false;
      if (filter === 'priority' && c.priority === 'low') return false;
      if (filter === 'leads' && !c.isLead) return false;
      if (!q) return true;
      var cust = matchCustomer(c);
      var vehicle = cust ? String(cust.vehicle || cust.vehicles || '') : String(c.vehicle || '');
      var msgBlob = c.messages.map(function (m) { return m.text || m.content || ''; }).join(' ');
      var hay = [c.customer_name, c.phone, c.customer_phone, c.email, c.customer_email, c.last_message, vehicle, msgBlob].join(' ').toLowerCase();
      return hay.indexOf(q) > -1;
    });

    if (selectedId && !filtered.some(function (c) { return String(c.id) === String(selectedId); })) {
      selectedId = filtered[0] ? filtered[0].id : null;
      root._josInboxId = selectedId;
    }
    var sel = filtered.find(function (c) { return String(c.id) === String(selectedId); }) || null;
    var cust = sel ? matchCustomer(sel) : null;

    var tabsHtml = '<div class="jos-tabs jos-inbox-tabs">' + INBOX_TABS.map(function (t) {
      var count = all.filter(function (c) {
        if (t[0] === 'all') return !c.archived;
        if (t[0] === 'archived') return !!c.archived;
        if (t[0] === 'needs') return !c.archived && c.needsAttention;
        if (t[0] === 'ai') return !c.archived && (c.channel === 'ai' || c.aiMode === 'ai');
        return !c.archived && normalizeChannel(c.channel) === t[0];
      }).length;
      return '<button type="button" class="jos-tab' + (tab === t[0] ? ' on' : '') + '" data-jos-inbox-tab="' + t[0] + '">' + esc(t[1]) + (count ? ' <span class="jos-tab-count">' + count + '</span>' : '') + '</button>';
    }).join('') + '</div>';

    var listHtml = filtered.length ? filtered.map(function (c) {
      var on = sel && String(sel.id) === String(c.id);
      return '<button type="button" class="jos-list-card' + (on ? ' on' : '') + '" data-jos-inbox-id="' + esc(String(c.id)) + '">' +
        '<div class="jos-between"><div class="t">' + esc(c.customer_name) + '</div><span class="jos-muted">' + esc(inboxTime(c.updated_at)) + '</span></div>' +
        '<div class="s">' + esc(c.last_message || 'No messages yet') + '</div>' +
        '<div class="meta"><span class="jos-ch-ico" title="' + esc(channelLabel(c.channel)) + '">' + esc(channelIco(c.channel)) + '</span>' +
        '<span class="jos-pill ' + (c.priority === 'high' ? 'hot' : (c.priority === 'med' ? 'warn' : 'info')) + '">AI ' + esc(c.priority) + '</span>' +
        (c.unread ? '<span class="jos-pill hot">' + c.unread + ' new</span>' : '') +
        '</div></button>';
    }).join('') : '<div class="jos-empty">No conversations in this view.' + (q ? ' Clear search to see more.' : '') + '</div>';

    var timeline = '';
    if (sel) {
      var msgs = sel.messages.length ? sel.messages : [{ dir: 'in', text: sel.last_message || '…', at: inboxTime(sel.updated_at) }];
      timeline = msgs.map(function (m) {
        var dir = m.dir === 'out' || m.role === 'assistant' || m.role === 'business' ? 'out' : (m.dir === 'sys' || m.role === 'system' ? 'sys' : 'in');
        var text = m.text || m.content || '';
        if (dir === 'sys') return '<div class="jos-chat-sys">' + esc(text) + '</div>';
        return '<div class="jos-chat-bubble ' + dir + '">' + esc(text) +
          (m.image ? '<div class="jos-chat-attach">🖼 Image attached</div>' : '') +
          (m.voice ? '<div class="jos-chat-attach">🎤 Voice note' + (m.voiceDuration ? ' · ' + esc(m.voiceDuration) : '') + '</div>' : '') +
          (m.attachment ? '<div class="jos-chat-attach">📎 ' + esc(m.attachment) + '</div>' : '') +
          '<div class="jos-muted" style="font-size:10px;margin-top:4px">' + esc(m.at || '') + '</div></div>';
      }).join('');
      (sel.attachments || []).forEach(function (a) {
        timeline += '<div class="jos-chat-sys">Attachment: ' + esc(a.name || a) + '</div>';
      });
    }

    var templatesHtml = INBOX_TEMPLATES.map(function (t) {
      return '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="inbox-template" data-jos-template="' + esc(t.id) + '">' + esc(t.label) + '</button>';
    }).join('');

    var channelTools = '';
    if (sel) {
      var ch = normalizeChannel(sel.channel);
      if (ch === 'chat') {
        channelTools = '<div class="jos-inbox-tools"><div class="jos-kicker">Website Chat</div><div class="jos-btn-row">' +
          btn('inbox-ai-takeover', 'AI Takeover', sel.aiMode === 'ai' ? 'jos-btn-brand jos-btn-sm' : 'jos-btn jos-btn-sm') +
          btn('inbox-human-takeover', 'Human Takeover', sel.aiMode === 'human' ? 'jos-btn-brand jos-btn-sm' : 'jos-btn jos-btn-sm') +
          btn('inbox-booking', 'Booking', 'jos-btn jos-btn-sm') +
          btn('smart-quote', 'Quote', 'jos-btn jos-btn-sm') +
          '</div></div>';
      } else if (ch === 'sms') {
        channelTools = '<div class="jos-inbox-tools"><div class="jos-kicker">SMS · Twilio ' + (integ.twilio ? 'connected' : 'not connected') + '</div><div class="jos-btn-row">' +
          btn('inbox-sms-open', 'Open Messages', 'jos-btn-brand jos-btn-sm') +
          btn('inbox-schedule-sms', 'Schedule SMS', 'jos-btn jos-btn-sm') +
          btn('inbox-ai-rewrite', 'AI Rewrite', 'jos-btn jos-btn-sm') +
          (integ.twilio ? '' : btn('inbox-connect-twilio', 'Connect Twilio', 'jos-btn jos-btn-sm')) +
          '</div></div>';
      } else if (ch === 'email') {
        channelTools = '<div class="jos-inbox-tools"><div class="jos-kicker">Email · Resend ' + (integ.resend ? 'connected' : 'ready via platform') + '</div><div class="jos-btn-row">' +
          btn('inbox-email-reply', 'Reply', 'jos-btn-brand jos-btn-sm') +
          btn('inbox-ai-draft', 'AI Draft', 'jos-btn jos-btn-sm') +
          btn('inbox-schedule-email', 'Schedule Email', 'jos-btn jos-btn-sm') +
          btn('inbox-attach', 'Attachments', 'jos-btn jos-btn-sm') +
          '</div></div>';
      } else if (ch === 'facebook') {
        channelTools = '<div class="jos-inbox-tools"><div class="jos-kicker">Facebook Messenger · Meta ' + (integ.meta ? 'connected' : 'not connected') + '</div><div class="jos-btn-row">' +
          btn('inbox-send', 'Reply', 'jos-btn-brand jos-btn-sm') +
          btn('inbox-ai-reply', 'AI Reply', 'jos-btn jos-btn-sm') +
          btn('inbox-match-customer', 'Match Customer', 'jos-btn jos-btn-sm') +
          (integ.meta ? '' : btn('inbox-connect-meta', 'Connect Meta', 'jos-btn jos-btn-sm')) +
          '</div></div>';
      } else if (ch === 'instagram') {
        channelTools = '<div class="jos-inbox-tools"><div class="jos-kicker">Instagram DM · Meta ' + (integ.meta ? 'connected' : 'not connected') + '</div><div class="jos-btn-row">' +
          btn('inbox-send', 'Reply', 'jos-btn-brand jos-btn-sm') +
          btn('inbox-match-customer', 'Match Customer', 'jos-btn jos-btn-sm') +
          btn('inbox-booking', 'Booking Shortcut', 'jos-btn jos-btn-sm') +
          (integ.meta ? '' : btn('inbox-connect-meta', 'Connect Meta', 'jos-btn jos-btn-sm')) +
          '</div></div>';
      }
    }

    var chatHtml = sel ? (
      '<div class="jos-card jos-inbox-thread">' +
        '<div class="jos-between"><div><div class="jos-kicker">' + esc(channelLabel(sel.channel)) + '</div><h3 style="margin:4px 0 0">' + esc(sel.customer_name) + '</h3></div>' +
        '<div class="jos-btn-row">' + btn('inbox-archive', sel.archived ? 'Unarchive' : 'Archive', 'jos-btn jos-btn-sm') + btn('inbox-ai-reply', 'AI Reply', 'jos-btn-brand jos-btn-sm') + '</div></div>' +
        '<div class="jos-ai jos-mt"><div class="sk">AI</div><p style="font-size:13px;margin-top:6px"><strong>Intent:</strong> ' + esc(sel.intent) + ' · <strong>Sentiment:</strong> ' + esc(sel.sentiment) + (sel.isLead ? ' · Lead detected' : '') + '</p>' +
        '<div class="jos-btn-row jos-mt">' + btn('inbox-ai-summary', 'AI Summary', 'jos-btn jos-btn-sm') + btn('inbox-suggested', 'Suggested Actions', 'jos-btn jos-btn-sm') + '</div></div>' +
        channelTools +
        '<div class="jos-chat-stream jos-mt">' + timeline + '</div>' +
        '<div class="jos-inbox-templates jos-mt"><div class="jos-kicker">Templates</div><div class="jos-btn-row jos-mt">' + templatesHtml + '</div></div>' +
        '<div class="jos-chat-input jos-mt"><input id="jos-inbox-reply" type="text" placeholder="Reply…" value="' + esc(root._josInboxDraft || '') + '">' +
        '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="inbox-attach" title="Attachments">📎</button>' +
        '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="inbox-image" title="Images">🖼</button>' +
        '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="inbox-voice" title="Voice note">🎤</button>' +
        '<button type="button" class="jos-btn jos-btn-brand jos-btn-sm" data-jos-act="inbox-send">Send</button></div>' +
        '<div class="jos-mt"><div class="jos-kicker">Internal Notes</div>' +
        '<div class="jos-notes">' + (sel.notes.length ? sel.notes.map(function (n) { return '<div class="jos-note">' + esc(typeof n === 'string' ? n : (n.text || '')) + '</div>'; }).join('') : '<div class="jos-muted">No internal notes yet</div>') + '</div>' +
        '<div class="jos-chat-input jos-mt"><input id="jos-inbox-note" type="text" placeholder="Add internal note…">' +
        '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="inbox-note">Add note</button></div></div>' +
      '</div>'
    ) : '<div class="jos-empty">Select a conversation</div>';

    var spent = 0, jobCount = 0, vehicles = '', membership = 'None';
    if (cust) {
      spent = jobs().filter(function (j) { return j.customer === cust.name && j.status === 'completed'; }).reduce(function (s, j) { return s + (parseFloat(j.amount) || 0); }, 0);
      jobCount = jobs().filter(function (j) { return j.customer === cust.name && !j.isBlock; }).length;
      vehicles = cust.vehicle || cust.vehicles || cust.property || '—';
      membership = cust.customerType === 'recurring' ? ('Active' + (cust.membershipPlan ? ' · ' + cust.membershipPlan : '')) : 'None';
    }

    var sideHtml = sel ? (
      '<div class="jos-stack">' +
        '<div class="jos-card"><div class="jos-kicker">Customer Info</div><h3 style="margin:8px 0 4px">' + esc(sel.customer_name) + '</h3>' +
        '<div class="jos-muted">' + esc(sel.phone || sel.customer_phone || 'No phone') + '</div>' +
        '<div class="jos-muted">' + esc(sel.email || sel.customer_email || 'No email') + '</div>' +
        '<div class="jos-mt">' + (cust ? '<button type="button" class="jos-btn jos-btn-brand jos-btn-sm" data-jos-act="cust-full-profile" data-jos-cust="' + esc(String(cust.id)) + '">View profile</button>' : btn('inbox-match-customer', 'Match / Add customer', 'jos-btn-brand jos-btn-sm')) + '</div></div>' +
        '<div class="jos-card"><div class="jos-kicker">Lifetime Revenue</div><div class="jos-kpi-v brand jos-mt">' + esc(money(spent) || '$0') + '</div><div class="jos-muted">' + jobCount + ' jobs</div></div>' +
        '<div class="jos-card"><div class="jos-kicker">Membership</div><p class="jos-mt">' + esc(membership) + '</p></div>' +
        '<div class="jos-card"><div class="jos-kicker">Vehicles / Properties</div><p class="jos-mt">' + esc(vehicles || '—') + '</p></div>' +
        '<div class="jos-ai"><div class="sk">AI Summary</div><p style="font-size:13px;margin-top:6px">' + esc(sel.customer_name) + ' is showing <strong>' + esc(sel.intent) + '</strong> intent with <strong>' + esc(sel.sentiment).toLowerCase() + '</strong> sentiment. Priority: ' + esc(sel.priority) + '.</p>' +
        '<div class="jos-btn-row jos-mt">' + btn('inbox-ai-summary', 'Refresh summary', 'jos-btn jos-btn-sm') + btn('inbox-ai-reply', 'Draft reply', 'jos-btn-brand jos-btn-sm') + '</div></div>' +
        '<div class="jos-card"><div class="jos-kicker">Quick Actions</div><div class="jos-stack jos-mt">' +
        btn('new-job-cust', 'New Job', 'jos-btn jos-btn-sm') +
        btn('smart-quote', 'New Quote', 'jos-btn jos-btn-sm') +
        btn('inbox-booking', 'Send booking link', 'jos-btn jos-btn-sm') +
        btn('go-leads', 'Open Leads', 'jos-btn jos-btn-sm') +
        '</div></div>' +
        (tab === 'needs' || sel.needsAttention ? '<div class="jos-card"><div class="jos-kicker">Needs Attention</div><ul class="jos-inbox-ul"><li>High priority: ' + (sel.priority === 'high' ? 'Yes' : 'No') + '</li><li>Waiting: ' + (sel.unread ? 'Yes (' + sel.unread + ')' : 'No') + '</li><li>AI failed: ' + (sel.aiFailed ? 'Yes' : 'No') + '</li><li>VIP: ' + (sel.vip ? 'Yes' : 'No') + '</li></ul></div>' : '') +
      '</div>'
    ) : '<div class="jos-empty">Customer details appear here</div>';

    var needsPanel = '';
    if (tab === 'needs') {
      var high = all.filter(function (c) { return !c.archived && c.priority === 'high'; }).length;
      var waiting = all.filter(function (c) { return !c.archived && c.unread > 0; }).length;
      var failed = all.filter(function (c) { return !c.archived && c.aiFailed; }).length;
      var vip = all.filter(function (c) { return !c.archived && c.vip; }).length;
      needsPanel = '<div class="jos-grid-4 jos-mt" style="margin-bottom:12px">' +
        [['High Priority Leads', high], ['Waiting Customers', waiting], ['AI Failed', failed], ['VIP Customers', vip]].map(function (x) {
          return '<div class="jos-kpi"><div class="lbl">' + esc(x[0]) + '</div><div class="v">' + x[1] + '</div></div>';
        }).join('') + '</div>';
    }

    root.innerHTML =
      '<div class="jos-page jos-inbox-page">' +
      '<div class="jos-page-head"><div><h1>Inbox</h1><p>Unified conversations across chat, SMS, email, and social.</p></div>' +
      '<div class="jos-page-actions">' + btn('go-ask', 'Ask Hubly', 'jos-btn-brand jos-btn-sm') + btn('inbox-refresh', 'Refresh', 'jos-btn jos-btn-sm') + '</div></div>' +
      tabsHtml + needsPanel +
      '<div class="jos-inbox-toolbar">' +
        '<label class="jos-inbox-search"><input id="jos-inbox-search" type="search" placeholder="Search customer, phone, email, vehicle, message…" value="' + esc(root._josInboxQ || '') + '"></label>' +
        '<select id="jos-inbox-filter" class="jos-inbox-filter">' +
          [['all', 'All'], ['unread', 'Unread'], ['priority', 'Priority'], ['leads', 'Leads']].map(function (f) {
            return '<option value="' + f[0] + '"' + (filter === f[0] ? ' selected' : '') + '>' + f[1] + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +
      '<div class="jos-split jos-inbox-split"><div class="jos-stack jos-inbox-list">' + listHtml + '</div><div>' + chatHtml + '</div><div class="jos-stack">' + sideHtml + '</div></div>' +
      '</div>';

    bindRoot(root);
    if (!root._josInboxBound) {
      root._josInboxBound = true;
      root.addEventListener('click', function (e) {
        var tabBtn = e.target.closest('[data-jos-inbox-tab]');
        if (tabBtn) {
          root._josInboxTab = tabBtn.getAttribute('data-jos-inbox-tab');
          renderInbox();
          e.stopPropagation();
          return;
        }
        var idBtn = e.target.closest('[data-jos-inbox-id]');
        if (idBtn) {
          root._josInboxId = idBtn.getAttribute('data-jos-inbox-id');
          var st = S();
          var convs = Array.isArray(st.conversations) ? st.conversations : [];
          convs.forEach(function (c) {
            if (String(c.id) === String(root._josInboxId)) c.unread = 0;
          });
          renderInbox();
          e.stopPropagation();
        }
      });
      root.addEventListener('input', function (e) {
        if (e.target && e.target.id === 'jos-inbox-search') {
          root._josInboxQ = e.target.value;
          clearTimeout(root._josInboxSearchT);
          root._josInboxSearchT = setTimeout(function () { renderInbox(); }, 160);
        }
        if (e.target && e.target.id === 'jos-inbox-reply') root._josInboxDraft = e.target.value;
      });
      root.addEventListener('change', function (e) {
        if (e.target && e.target.id === 'jos-inbox-filter') {
          root._josInboxFilter = e.target.value;
          renderInbox();
        }
      });
    }
    updateInboxBadge();
  }

  function updateInboxBadge() {
    var badge = el('nav-inbox-badge');
    if (!badge) return;
    var n = inboxConversations().filter(function (c) { return !c.archived && (c.unread > 0 || c.needsAttention); }).length;
    badge.textContent = String(n);
    badge.classList.toggle('hidden', !n);
  }

  function selectedInboxConv() {
    var root = el('jos-inbox-root');
    if (!root) return null;
    var id = root._josInboxId;
    return inboxConversations().find(function (c) { return String(c.id) === String(id); }) || null;
  }

  function mutateInboxConv(mutator) {
    var root = el('jos-inbox-root');
    var sel = selectedInboxConv();
    if (!sel) return null;
    var st = S();
    if (!Array.isArray(st.conversations) || !st.conversations.length) st.conversations = inboxConversations();
    var live = st.conversations.find(function (c) { return String(c.id) === String(sel.id); });
    if (!live) {
      live = Object.assign({}, sel);
      st.conversations.unshift(live);
    }
    mutator(live);
    if (root) renderInbox();
    return live;
  }

  function handleInboxAct(act, t) {
    var root = el('jos-inbox-root');
    var sel = selectedInboxConv();
    var draftEl = el('jos-inbox-reply');
    var draft = draftEl ? draftEl.value : (root && root._josInboxDraft) || '';

    if (act === 'inbox-refresh') { toast('Inbox refreshed'); return renderInbox(); }
    if (act === 'inbox-send') {
      if (!sel) return toast('Select a conversation');
      if (!String(draft || '').trim()) return toast('Type a reply first');
      mutateInboxConv(function (c) {
        c.messages = c.messages || [];
        c.messages.push({ dir: 'out', text: String(draft).trim(), at: 'Just now' });
        c.last_message = String(draft).trim();
        c.unread = 0;
        c.aiMode = 'human';
        c.updated_at = new Date().toISOString();
      });
      if (root) root._josInboxDraft = '';
      toast('Message sent');
      return;
    }
    if (act === 'inbox-note') {
      var noteEl = el('jos-inbox-note');
      var note = noteEl ? noteEl.value : '';
      if (!String(note || '').trim()) return toast('Add a note first');
      mutateInboxConv(function (c) {
        c.notes = c.notes || [];
        c.notes.push(String(note).trim());
      });
      toast('Note saved');
      return;
    }
    if (act === 'inbox-template') {
      var tid = t.getAttribute('data-jos-template');
      var tpl = INBOX_TEMPLATES.find(function (x) { return x.id === tid; });
      if (!tpl) return;
      var body = tpl.body
        .replace(/\{\{name\}\}/g, (sel && sel.customer_name) || 'there')
        .replace(/\{\{biz\}\}/g, S().biz || 'Hubly')
        .replace(/\{\{service\}\}/g, 'detail');
      if (draftEl) draftEl.value = body;
      if (root) root._josInboxDraft = body;
      toast('Template inserted');
      return;
    }
    if (act === 'inbox-attach') {
      mutateInboxConv(function (c) {
        c.messages = c.messages || [];
        c.messages.push({ dir: 'out', text: 'Shared an attachment', attachment: 'estimate.pdf', at: 'Just now' });
        c.last_message = 'Shared an attachment';
      });
      toast('Attachment added to timeline');
      return;
    }
    if (act === 'inbox-image') {
      mutateInboxConv(function (c) {
        c.messages = c.messages || [];
        c.messages.push({ dir: 'out', text: 'Shared a photo', image: true, at: 'Just now' });
        c.last_message = 'Shared a photo';
      });
      toast('Image added to timeline');
      return;
    }
    if (act === 'inbox-voice') {
      mutateInboxConv(function (c) {
        c.messages = c.messages || [];
        c.messages.push({ dir: 'out', text: 'Voice note', voice: true, voiceDuration: '0:12', at: 'Just now' });
        c.last_message = 'Voice note';
      });
      toast('Voice note added to timeline');
      return;
    }
    if (act === 'inbox-archive') {
      mutateInboxConv(function (c) { c.archived = !c.archived; });
      toast(sel && sel.archived ? 'Conversation restored' : 'Conversation archived');
      return;
    }
    if (act === 'inbox-ai-takeover') {
      mutateInboxConv(function (c) { c.aiMode = 'ai'; c.channel = c.channel || 'chat'; });
      toast('AI is handling this chat');
      return;
    }
    if (act === 'inbox-human-takeover') {
      mutateInboxConv(function (c) { c.aiMode = 'human'; });
      toast('You took over this chat');
      return;
    }
    if (act === 'inbox-booking') {
      var link = location.origin + '/' + (S().slug || 'book');
      copyText('Book online: ' + link);
      if (draftEl) draftEl.value = 'You can book here anytime: ' + link;
      if (root) root._josInboxDraft = draftEl ? draftEl.value : '';
      toast('Booking link ready');
      return;
    }
    if (act === 'inbox-sms-open') {
      if (!sel) return;
      var phone = String(sel.phone || sel.customer_phone || '').replace(/\D/g, '');
      if (phone) location.href = 'sms:' + phone + (draft ? '?&body=' + encodeURIComponent(draft) : '');
      else toast('No phone on this conversation');
      return;
    }
    if (act === 'inbox-schedule-sms') {
      toast('SMS scheduled for later today');
      mutateInboxConv(function (c) {
        c.notes = c.notes || [];
        c.notes.push('Scheduled SMS: ' + (draft || '(template pending)'));
      });
      return;
    }
    if (act === 'inbox-schedule-email') {
      toast('Email scheduled for later today');
      mutateInboxConv(function (c) {
        c.notes = c.notes || [];
        c.notes.push('Scheduled email: ' + (draft || '(draft pending)'));
      });
      return;
    }
    if (act === 'inbox-email-reply') {
      if (!sel) return;
      var em = sel.email || sel.customer_email;
      if (em) location.href = 'mailto:' + encodeURIComponent(em) + (draft ? '?body=' + encodeURIComponent(draft) : '');
      else toast('No email on this conversation');
      return;
    }
    if (act === 'inbox-ai-rewrite' || act === 'inbox-ai-draft' || act === 'inbox-ai-reply') {
      var prompt = 'Draft a concise, friendly reply to ' + ((sel && sel.customer_name) || 'this customer') +
        ' about: ' + ((sel && sel.last_message) || 'their message');
      ask(prompt);
      return;
    }
    if (act === 'inbox-ai-summary') {
      ask('Summarize this conversation with ' + ((sel && sel.customer_name) || 'the customer') +
        ' and recommend the next best action. Last message: ' + ((sel && sel.last_message) || ''));
      return;
    }
    if (act === 'inbox-suggested') {
      ask('Suggest 3 next actions for this Inbox conversation with ' + ((sel && sel.customer_name) || 'the customer'));
      return;
    }
    if (act === 'inbox-match-customer') {
      if (sel && matchCustomer(sel)) {
        var matched = matchCustomer(sel);
        return openCustomerProfile(matched.id);
      }
      return typeof global.openM === 'function' ? global.openM('m-new-cust') : toast('Add customer');
    }
    if (act === 'inbox-connect-twilio' || act === 'inbox-connect-meta') {
      toast(act === 'inbox-connect-twilio' ? 'Open Settings to connect Twilio' : 'Open Settings to connect Meta');
      return switchNav('settings');
    }
  }

  var JOBS_TABS = [['calendar', 'Calendar'], ['jobs', 'Jobs'], ['route', 'Route'], ['availability', 'Availability'], ['team', 'Team']];
  var JOBS_CAL_VIEWS = [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['agenda', 'Agenda']];
  var JOBS_LIST_VIEWS = [['upcoming', 'Upcoming'], ['in_progress', 'In Progress'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['recurring', 'Recurring']];
  var DEFAULT_CHECKLIST = ['Confirm arrival window', 'Protect interiors', 'Complete service steps', 'Final walkthrough', 'Collect payment / tip'];
  var DEFAULT_TEAM = [
    { id: 'tech_adrian', name: 'Adrian Lopez', role: 'Owner' },
    { id: 'tech_maya', name: 'Maya Chen', role: 'Technician' },
    { id: 'tech_luis', name: 'Luis Ortega', role: 'Technician' }
  ];

  function ensureJobsOsState() {
    var st = S();
    if (!Array.isArray(st.jobs)) st.jobs = [];
    if (!Array.isArray(st.team) || !st.team.length) st.team = DEFAULT_TEAM.slice();
    if (!st.availability) {
      st.availability = {
        hours: { mon: '8:00 AM – 6:00 PM', tue: '8:00 AM – 6:00 PM', wed: '8:00 AM – 6:00 PM', thu: '8:00 AM – 6:00 PM', fri: '8:00 AM – 6:00 PM', sat: '9:00 AM – 4:00 PM', sun: 'Closed' },
        blocked: [todayStr()],
        holidays: ['2026-12-25', '2026-01-01'],
        vacation: [],
        manual: []
      };
    }
    if (!Array.isArray(st.jobNotifications)) st.jobNotifications = [];
    st.jobs.forEach(function (j, idx) {
      if (!j.id) j.id = 'job_auto_' + idx;
      if (!j.status) j.status = 'scheduled';
      if (!j.address) j.address = (j.location || (S().city ? S().city : 'San Diego, CA'));
      if (!j.assignedTo) j.assignedTo = (st.team[idx % st.team.length] || st.team[0]).name;
      if (j.depositStatus == null) j.depositStatus = j.status === 'completed' ? 'paid' : (parseFloat(j.amount) >= 300 ? 'due' : 'none');
      if (j.deposit == null) j.deposit = j.depositStatus === 'none' ? 0 : Math.round((parseFloat(j.amount) || 0) * 0.25);
      if (!Array.isArray(j.checklist) || !j.checklist.length) {
        j.checklist = DEFAULT_CHECKLIST.map(function (label, i) {
          return { id: 'cl_' + j.id + '_' + i, label: label, done: j.status === 'completed' };
        });
      }
      if (!Array.isArray(j.photos)) j.photos = { before: [], after: [] };
      if (!j.photos.before) j.photos.before = [];
      if (!j.photos.after) j.photos.after = [];
      if (!Array.isArray(j.internalNotes)) j.internalNotes = j.notes ? [String(j.notes)] : [];
      if (!Array.isArray(j.customerNotes)) j.customerNotes = [];
      if (!Array.isArray(j.voiceNotes)) j.voiceNotes = [];
      if (!Array.isArray(j.products)) j.products = j.status === 'completed' || j.status === 'in_progress' ? [{ name: 'Interior cleaner', qty: 1, cost: 12, notes: '' }] : [];
      if (!Array.isArray(j.tags)) j.tags = j.fromBooking ? ['booking'] : ['manual'];
      if (!j.durationMin) j.durationMin = 120;
      if (!Array.isArray(j.timeline) || !j.timeline.length) {
        j.timeline = [
          { type: 'created', label: 'Job Created', at: (j.date || todayStr()) + ' 08:00' },
          { type: 'scheduled', label: 'Scheduled', at: (j.date || todayStr()) + ' ' + (j.time || '9:00 AM') }
        ];
        if (j.status === 'in_progress' || j.status === 'completed') j.timeline.push({ type: 'started', label: 'Started', at: (j.date || todayStr()) + ' ' + (j.time || '9:00 AM') });
        if (j.status === 'completed') j.timeline.push({ type: 'completed', label: 'Completed', at: (j.date || todayStr()) + ' end' });
        if (j.depositStatus === 'paid') j.timeline.push({ type: 'paid', label: 'Paid', at: (j.date || todayStr()) + ' paid' });
      }
      if (j.recurring == null) j.recurring = /membership|recurring/i.test(String(j.service || '')) || false;
      if (j.routeOrder == null) j.routeOrder = idx + 1;
      if (!j.invoice) j.invoice = null;
    });
    return st;
  }

  function jobsAll() {
    ensureJobsOsState();
    return (S().jobs || []).filter(function (j) { return !j.isBlock; });
  }
  function jobsTeam() { ensureJobsOsState(); return S().team || DEFAULT_TEAM; }
  function findJob(id) { return jobsAll().find(function (j) { return String(j.id) === String(id); }) || null; }
  function jobStatusTone(st) {
    st = String(st || '').toLowerCase();
    if (st === 'completed' || st === 'paid') return 'ok';
    if (st === 'in_progress' || st === 'running') return 'info';
    if (st === 'cancelled') return 'hot';
    if (st === 'paused' || st === 'pending') return 'warn';
    return 'warn';
  }
  function parseJobMinutes(time) {
    var m = String(time || '9:00 AM').match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!m) return 9 * 60;
    var h = parseInt(m[1], 10), min = parseInt(m[2], 10), ap = (m[3] || '').toUpperCase();
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return h * 60 + min;
  }
  function formatJobMinutes(mins) {
    var h = Math.floor(mins / 60), m = mins % 60, ap = h >= 12 ? 'PM' : 'AM';
    var hh = h % 12; if (!hh) hh = 12;
    return hh + ':' + String(m).padStart(2, '0') + ' ' + ap;
  }
  function addDaysStr(ds, n) {
    var d = new Date(String(ds).slice(0, 10) + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function startOfWeek(ds) {
    var d = new Date(String(ds).slice(0, 10) + 'T12:00:00');
    var day = d.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  }
  function checklistProgress(j) {
    var list = j.checklist || [];
    if (!list.length) return 0;
    return Math.round(100 * list.filter(function (c) { return c.done; }).length / list.length);
  }
  function pushJobTimeline(j, type, label) {
    j.timeline = j.timeline || [];
    j.timeline.push({ type: type, label: label, at: new Date().toLocaleString() });
  }
  function pushJobNotif(type, text) {
    var st = S();
    st.jobNotifications = st.jobNotifications || [];
    st.jobNotifications.unshift({ type: type, text: text, at: new Date().toISOString() });
    st.jobNotifications = st.jobNotifications.slice(0, 20);
  }
  function filterJobsList(root) {
    var all = jobsAll();
    var q = String(root._josJobsQ || '').toLowerCase();
    var status = root._josJobsStatus || 'all';
    var employee = root._josJobsEmployee || 'all';
    var service = root._josJobsService || 'all';
    var route = root._josJobsRoute || 'all';
    var date = root._josJobsDateFilter || 'all';
    var listView = root._josJobsListView || 'upcoming';
    var today = todayStr();
    return all.filter(function (j) {
      if (listView === 'upcoming' && !(['scheduled', 'pending', 'confirmed'].indexOf(j.status) > -1)) return false;
      if (listView === 'in_progress' && !(j.status === 'in_progress' || j.status === 'paused' || j.status === 'running')) return false;
      if (listView === 'completed' && j.status !== 'completed') return false;
      if (listView === 'cancelled' && j.status !== 'cancelled') return false;
      if (listView === 'recurring' && !j.recurring) return false;
      if (status !== 'all' && j.status !== status) return false;
      if (employee !== 'all' && j.assignedTo !== employee) return false;
      if (service !== 'all' && j.service !== service) return false;
      if (route === 'today' && j.date !== today) return false;
      if (date === 'today' && j.date !== today) return false;
      if (date === 'week') {
        var ws = startOfWeek(today), we = addDaysStr(ws, 6);
        if (j.date < ws || j.date > we) return false;
      }
      if (!q) return true;
      var hay = [j.customer, j.address, j.service, j.assignedTo, j.vehicle, j.phone].join(' ').toLowerCase();
      return hay.indexOf(q) > -1;
    }).sort(function (a, b) { return String(a.date).localeCompare(String(b.date)) || parseJobMinutes(a.time) - parseJobMinutes(b.time); });
  }

  function renderJobs() {
    var root = ownPixelView('v-jobs', 'jos-jobs-root');
    if (!root) return;
    updateChrome('jobs');
    root.innerHTML = '<div class="jos-page jos-jobs-page"><div class="jos-home-loading">Loading Jobs & Calendar…</div></div>';
    try { renderJobsPage(root); }
    catch (err) {
      console.warn('HublyJourneyOS Jobs', err);
      root.innerHTML = '<div class="jos-page"><div class="jos-empty jos-error-state"><strong>Jobs could not load</strong><p class="jos-muted">Refresh and try again.</p><div class="jos-mt"><button type="button" class="jos-btn jos-btn-brand jos-btn-sm" onclick="HublyJourneyOS.renderJobs()">Retry</button></div></div></div>';
    }
  }

  function renderJobsPage(root) {
    ensureJobsOsState();
    var tab = root._josJobsTab || 'calendar';
    var calView = root._josCalView || 'week';
    var anchor = root._josCalAnchor || todayStr();
    var selectedId = root._josJobId || null;
    var workspaceTab = root._josJobWorkspace || 'overview';
    var loading = !!root._josJobsLoading;
    var all = jobsAll();
    var today = todayStr();
    var selected = selectedId ? findJob(selectedId) : null;
    if (selectedId && !selected) { selectedId = null; root._josJobId = null; }

    var weekJobs = all.filter(function (j) {
      var ws = startOfWeek(today), we = addDaysStr(ws, 6);
      return j.date >= ws && j.date <= we && j.status !== 'cancelled';
    });
    var metrics = {
      today: all.filter(function (j) { return j.date === today && j.status !== 'cancelled'; }).length,
      week: weekJobs.length,
      completed: all.filter(function (j) { return j.status === 'completed'; }).length,
      inProgress: all.filter(function (j) { return j.status === 'in_progress' || j.status === 'paused'; }).length,
      cancelled: all.filter(function (j) { return j.status === 'cancelled'; }).length,
      revToday: all.filter(function (j) { return j.date === today && j.status === 'completed'; }).reduce(function (s, j) { return s + (parseFloat(j.amount) || 0); }, 0),
      util: Math.min(100, Math.round((weekJobs.length / Math.max(1, jobsTeam().length * 5)) * 100))
    };

    var notifs = (S().jobNotifications || []).slice(0, 4);
    if (!notifs.length) {
      notifs = [
        { type: 'upcoming', text: 'Upcoming job soon' },
        { type: 'late', text: metrics.inProgress ? 'A job may be running late' : 'No late jobs' },
        { type: 'completed', text: metrics.completed + ' completed jobs on record' },
        { type: 'cancelled', text: metrics.cancelled + ' cancelled' }
      ];
    }

    var overbooked = all.filter(function (j) { return j.date === today && j.status !== 'cancelled'; }).length > 6;
    var delayed = all.filter(function (j) { return j.status === 'in_progress' && parseJobMinutes(j.time) + (j.durationMin || 120) < parseJobMinutes(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })); }).length;

    var tabsHtml = '<div class="jos-tabs">' + JOBS_TABS.map(function (t) {
      return '<button type="button" class="jos-tab' + (tab === t[0] ? ' on' : '') + '" data-jos-jobs-tab="' + t[0] + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div>';

    var metricsHtml = '<div class="jos-grid-4 jos-jobs-metrics">' +
      [['Jobs Today', metrics.today], ['This Week', metrics.week], ['Completed', metrics.completed], ['In Progress', metrics.inProgress], ['Cancelled', metrics.cancelled], ['Revenue Today', money(metrics.revToday) || '$0'], ['Utilization', metrics.util + '%']].slice(0, 4).map(function (x) {
        return '<div class="jos-kpi"><div class="lbl">' + esc(x[0]) + '</div><div class="v" style="font-size:22px">' + esc(String(x[1])) + '</div></div>';
      }).join('') + '</div>' +
      '<div class="jos-grid-3 jos-mt">' +
      [['Cancelled', metrics.cancelled], ['Revenue Today', money(metrics.revToday) || '$0'], ['Utilization', metrics.util + '%']].map(function (x) {
        return '<div class="jos-kpi"><div class="lbl">' + esc(x[0]) + '</div><div class="v" style="font-size:20px">' + esc(String(x[1])) + '</div></div>';
      }).join('') + '</div>';

    var aiHtml = '<div class="jos-ai jos-mt"><div class="sk">AI Operations</div>' +
      (overbooked ? '<p class="jos-mt"><strong>Overbooked warning:</strong> Today has ' + metrics.today + ' jobs — consider reassigning.</p>' : '<p class="jos-mt">Schedule looks manageable today.</p>') +
      (delayed ? '<p><strong>Delay detection:</strong> ' + delayed + ' job(s) may be running late.</p>' : '') +
      '<p><strong>Route suggestion:</strong> Run north-to-south for today’s stops to cut drive time.</p>' +
      '<p><strong>Schedule suggestion:</strong> Keep 30 minutes between ceramic jobs.</p>' +
      '<div class="jos-btn-row jos-mt">' + btn('jobs-ai-summary', 'Daily Summary', 'jos-btn-brand jos-btn-sm') + btn('jobs-ai-route', 'Route Suggestions', 'jos-btn jos-btn-sm') + btn('jobs-ai-schedule', 'Schedule Suggestions', 'jos-btn jos-btn-sm') + '</div></div>';

    var notifHtml = '<div class="jos-card jos-mt"><div class="jos-kicker">Notifications</div><div class="jos-stack jos-mt">' + notifs.map(function (n) {
      return '<div class="jos-between"><span>' + esc(n.text) + '</span><span class="jos-pill info">' + esc(n.type || 'alert') + '</span></div>';
    }).join('') + '</div></div>';

    var body = '';
    if (loading) body = '<div class="jos-home-loading">Loading ' + esc(tab) + '…</div>';
    else if (tab === 'calendar') body = renderJobsCalendar(root, calView, anchor, selectedId);
    else if (tab === 'jobs') body = renderJobsListPanel(root, selectedId);
    else if (tab === 'route') body = renderJobsRoute(root);
    else if (tab === 'availability') body = renderJobsAvailability();
    else body = renderJobsTeam(root);

    var details = selected ? renderJobWorkspace(root, selected, workspaceTab) : '<div class="jos-card jos-jobs-details"><div class="jos-empty">' + (all.length ? 'Select a job to open the workspace' : 'No jobs yet — create your first job') + '</div><div class="jos-mt">' + btn('jobs-create', 'Create Job', 'jos-btn-brand jos-btn-sm') + '</div></div>';

    root.innerHTML =
      '<div class="jos-page jos-jobs-page">' +
      '<div class="jos-page-head"><div><h1>Jobs & Calendar</h1><p>Schedule, manage, and track every job from Hubly data.</p></div>' +
      '<div class="jos-page-actions jos-jobs-actions">' +
        btn('jobs-create', '+ New Job', 'jos-btn-brand jos-btn-sm') +
        btn('jobs-convert-quote', 'Convert Quote', 'jos-btn jos-btn-sm') +
        btn('jobs-export', 'Export', 'jos-btn jos-btn-sm') +
        btn('go-ask', 'Ask Hubly', 'jos-btn jos-btn-sm') +
      '</div></div>' +
      '<div class="jos-jobs-toolbar">' +
        '<label class="jos-inbox-search"><input id="jos-jobs-search" type="search" placeholder="Search customer, address, service, employee…" value="' + esc(root._josJobsQ || '') + '"></label>' +
        '<select id="jos-jobs-filter-status" class="jos-inbox-filter"><option value="all">Status</option>' + ['scheduled', 'in_progress', 'paused', 'completed', 'cancelled', 'pending'].map(function (s) { return '<option value="' + s + '"' + ((root._josJobsStatus || 'all') === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
        '<select id="jos-jobs-filter-employee" class="jos-inbox-filter"><option value="all">Employee</option>' + jobsTeam().map(function (t) { return '<option value="' + esc(t.name) + '"' + ((root._josJobsEmployee || 'all') === t.name ? ' selected' : '') + '>' + esc(t.name) + '</option>'; }).join('') + '</select>' +
        '<select id="jos-jobs-filter-service" class="jos-inbox-filter"><option value="all">Service</option>' + Array.from(new Set(all.map(function (j) { return j.service; }).filter(Boolean))).map(function (s) { return '<option value="' + esc(s) + '"' + ((root._josJobsService || 'all') === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select>' +
        '<select id="jos-jobs-filter-date" class="jos-inbox-filter"><option value="all">Date</option><option value="today"' + ((root._josJobsDateFilter || '') === 'today' ? ' selected' : '') + '>Today</option><option value="week"' + ((root._josJobsDateFilter || '') === 'week' ? ' selected' : '') + '>This week</option></select>' +
        '<select id="jos-jobs-filter-route" class="jos-inbox-filter"><option value="all">Route</option><option value="today"' + ((root._josJobsRoute || '') === 'today' ? ' selected' : '') + '>Today\'s route</option></select>' +
      '</div>' +
      tabsHtml + metricsHtml + aiHtml +
      '<div class="jos-jobs-bulk jos-mt">' +
        '<label class="jos-muted"><input type="checkbox" id="jos-jobs-bulk-toggle"> Bulk select</label> ' +
        btn('jobs-bulk-assign', 'Assign Employee', 'jos-btn jos-btn-sm') +
        btn('jobs-bulk-status', 'Change Status', 'jos-btn jos-btn-sm') +
        btn('jobs-export', 'Export', 'jos-btn jos-btn-sm') +
        btn('jobs-bulk-delete', 'Delete', 'jos-btn jos-btn-sm') +
      '</div>' +
      '<div class="jos-jobs-layout jos-mt"><div class="jos-jobs-main">' + body + '</div><div class="jos-jobs-side">' + details + notifHtml + '</div></div>' +
      '</div>';

    bindRoot(root);
    wireJobsRoot(root);
  }

  function wireJobsRoot(root) {
    if (root._josJobsBound) return;
    root._josJobsBound = true;
    root.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-jos-jobs-tab]');
      if (tab) { root._josJobsTab = tab.getAttribute('data-jos-jobs-tab'); root._josJobsLoading = true; renderJobs(); setTimeout(function () { root._josJobsLoading = false; renderJobs(); }, 120); e.stopPropagation(); return; }
      var cv = e.target.closest('[data-jos-cal-view]');
      if (cv) { root._josCalView = cv.getAttribute('data-jos-cal-view'); renderJobs(); e.stopPropagation(); return; }
      var lv = e.target.closest('[data-jos-jobs-list]');
      if (lv) { root._josJobsListView = lv.getAttribute('data-jos-jobs-list'); renderJobs(); e.stopPropagation(); return; }
      var jobEl = e.target.closest('[data-jos-job-id]');
      if (jobEl && !e.target.closest('[data-jos-act]')) { root._josJobId = jobEl.getAttribute('data-jos-job-id'); root._josJobWorkspace = 'overview'; renderJobs(); e.stopPropagation(); return; }
      var day = e.target.closest('[data-jos-cal-day]');
      if (day) { root._josCalAnchor = day.getAttribute('data-jos-cal-day'); root._josCalView = 'day'; renderJobs(); e.stopPropagation(); return; }
      var ws = e.target.closest('[data-jos-job-ws]');
      if (ws) { root._josJobWorkspace = ws.getAttribute('data-jos-job-ws'); renderJobs(); e.stopPropagation(); return; }
    });
    root.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'jos-jobs-search') {
        root._josJobsQ = e.target.value;
        clearTimeout(root._josJobsSearchT);
        root._josJobsSearchT = setTimeout(function () { renderJobs(); }, 150);
      }
    });
    root.addEventListener('change', function (e) {
      var id = e.target && e.target.id;
      if (id === 'jos-jobs-filter-status') root._josJobsStatus = e.target.value;
      if (id === 'jos-jobs-filter-employee') root._josJobsEmployee = e.target.value;
      if (id === 'jos-jobs-filter-service') root._josJobsService = e.target.value;
      if (id === 'jos-jobs-filter-date') root._josJobsDateFilter = e.target.value;
      if (id === 'jos-jobs-filter-route') root._josJobsRoute = e.target.value;
      if (id && id.indexOf('jos-jobs-filter') === 0) renderJobs();
      if (e.target && e.target.getAttribute('data-jos-check')) {
        var jid = e.target.getAttribute('data-jos-job');
        var cid = e.target.getAttribute('data-jos-check');
        var job = findJob(jid);
        if (job) {
          job.checklist.forEach(function (c) { if (String(c.id) === String(cid)) c.done = !!e.target.checked; });
          renderJobs();
        }
      }
      if (e.target && e.target.classList && e.target.classList.contains('jos-job-bulk')) {
        root._josBulk = root._josBulk || {};
        root._josBulk[e.target.getAttribute('data-jos-job-id')] = !!e.target.checked;
      }
    });
    root.addEventListener('dragstart', function (e) {
      var card = e.target.closest('[data-jos-job-id][draggable="true"]');
      if (!card || !e.dataTransfer) return;
      e.dataTransfer.setData('text/plain', card.getAttribute('data-jos-job-id'));
      root._josDragJob = card.getAttribute('data-jos-job-id');
    });
    root.addEventListener('dragover', function (e) {
      if (e.target.closest('[data-jos-cal-day], [data-jos-drop-slot]')) e.preventDefault();
    });
    root.addEventListener('drop', function (e) {
      var day = e.target.closest('[data-jos-cal-day]');
      var slot = e.target.closest('[data-jos-drop-slot]');
      var id = root._josDragJob || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
      var job = findJob(id);
      if (!job) return;
      e.preventDefault();
      if (day) { job.date = day.getAttribute('data-jos-cal-day'); pushJobTimeline(job, 'scheduled', 'Rescheduled by drag'); pushJobNotif('upcoming', job.customer + ' moved on calendar'); toast('Job moved'); renderJobs(); }
      if (slot) { job.time = slot.getAttribute('data-jos-drop-slot'); pushJobTimeline(job, 'scheduled', 'Time adjusted'); toast('Job time updated'); renderJobs(); }
    });
  }

  function renderJobsCalendar(root, calView, anchor, selectedId) {
    var views = '<div class="jos-btn-row">' + JOBS_CAL_VIEWS.map(function (v) {
      return '<button type="button" class="jos-btn jos-btn-sm' + (calView === v[0] ? ' jos-btn-brand' : '') + '" data-jos-cal-view="' + v[0] + '">' + v[1] + '</button>';
    }).join('') +
      btn('jobs-cal-prev', 'Previous', 'jos-btn jos-btn-sm') +
      btn('jobs-cal-today', 'Today', 'jos-btn jos-btn-sm') +
      btn('jobs-cal-next', 'Next', 'jos-btn jos-btn-sm') +
      btn('jobs-create', 'Create Job', 'jos-btn-brand jos-btn-sm') +
      '</div>';
    var all = jobsAll().filter(function (j) { return j.status !== 'cancelled'; });
    var html = '<div class="jos-card"><div class="jos-between"><div class="jos-kicker">Calendar · ' + esc(calView) + ' · ' + esc(anchor) + '</div>' + views + '</div>';
    if (!all.length) html += '<div class="jos-empty jos-mt">No calendar events yet. Create a job to populate the calendar.</div>';
    else if (calView === 'month') {
      var start = startOfWeek(anchor.slice(0, 8) + '01');
      html += '<div class="jos-cal-month jos-mt">';
      for (var i = 0; i < 35; i++) {
        var ds = addDaysStr(start, i);
        var dayJobs = all.filter(function (j) { return j.date === ds; });
        html += '<button type="button" class="jos-cal-day' + (ds === todayStr() ? ' today' : '') + '" data-jos-cal-day="' + ds + '"><div class="d">' + ds.slice(8) + '</div>' +
          dayJobs.slice(0, 3).map(function (j) {
            return '<div class="jos-cal-pill ' + jobStatusTone(j.status) + '" draggable="true" data-jos-job-id="' + esc(j.id) + '">' + esc((j.time || '').replace(' AM', 'a').replace(' PM', 'p')) + ' ' + esc((j.customer || '').split(' ')[0]) + '</div>';
          }).join('') + '</button>';
      }
      html += '</div>';
    } else if (calView === 'agenda') {
      html += '<div class="jos-stack jos-mt">' + all.slice().sort(function (a, b) { return String(a.date).localeCompare(b.date); }).slice(0, 20).map(function (j) {
        return jobCardHtml(j, selectedId, true);
      }).join('') + '</div>';
    } else if (calView === 'day') {
      html += '<div class="jos-cal-dayview jos-mt">';
      for (var h = 8; h <= 17; h++) {
        var label = formatJobMinutes(h * 60);
        var slotJobs = all.filter(function (j) { return j.date === anchor && Math.floor(parseJobMinutes(j.time) / 60) === h; });
        html += '<div class="jos-cal-slot" data-jos-drop-slot="' + esc(label) + '"><div class="t">' + esc(label) + '</div><div class="slot">' +
          (slotJobs.length ? slotJobs.map(function (j) {
            return '<div class="jos-cal-event ' + jobStatusTone(j.status) + '" draggable="true" data-jos-job-id="' + esc(j.id) + '"><strong>' + esc(j.customer) + '</strong><div class="jos-muted">' + esc(j.service) + ' · ' + esc(j.durationMin) + 'm</div><div class="jos-btn-row jos-mt">' + btn('jobs-edit', 'Edit', 'jos-btn jos-btn-sm') + btn('jobs-resize', '+30m', 'jos-btn jos-btn-sm') + '</div></div>';
          }).join('') : '<span class="jos-muted">Drop job here</span>') +
          '</div></div>';
      }
      html += '</div>';
    } else {
      var ws = startOfWeek(anchor);
      var days = []; for (var d = 0; d < 7; d++) days.push(addDaysStr(ws, d));
      html += '<div class="jos-cal-week jos-mt"><div class="jos-cal-week-head"><div></div>' + days.map(function (ds) {
        return '<button type="button" class="jos-cal-week-h' + (ds === todayStr() ? ' today' : '') + '" data-jos-cal-day="' + ds + '">' + esc(ds.slice(5)) + '</button>';
      }).join('') + '</div>';
      for (var hour = 8; hour <= 16; hour += 2) {
        html += '<div class="jos-cal-week-row"><div class="t">' + esc(formatJobMinutes(hour * 60)) + '</div>';
        days.forEach(function (ds) {
          var cellJobs = all.filter(function (j) { return j.date === ds && Math.floor(parseJobMinutes(j.time) / 60) >= hour && Math.floor(parseJobMinutes(j.time) / 60) < hour + 2; });
          html += '<div class="jos-cal-week-cell" data-jos-cal-day="' + ds + '" data-jos-drop-slot="' + esc(formatJobMinutes(hour * 60)) + '">' +
            cellJobs.map(function (j) {
              return '<div class="jos-cal-pill ' + jobStatusTone(j.status) + '" draggable="true" data-jos-job-id="' + esc(j.id) + '">' + esc(j.customer.split(' ')[0]) + '</div>';
            }).join('') + '</div>';
        });
        html += '</div>';
      }
      html += '</div>';
    }
    html += '<p class="jos-muted jos-mt">Drag jobs onto days/slots to reschedule. Use +30m to resize duration. Color = status.</p></div>';
    return html;
  }

  function jobCardHtml(j, selectedId, withBulk) {
    var on = selectedId && String(selectedId) === String(j.id);
    return '<div class="jos-card jos-job-card' + (on ? ' on' : '') + '" data-jos-job-id="' + esc(j.id) + '" draggable="true">' +
      (withBulk || true ? '<label class="jos-bulk-check"><input type="checkbox" class="jos-job-bulk" data-jos-job-id="' + esc(j.id) + '"></label>' : '') +
      '<div class="jos-between"><strong>' + esc(j.customer || 'Customer') + '</strong><span class="jos-pill ' + jobStatusTone(j.status) + '">' + esc(j.status) + '</span></div>' +
      '<div class="jos-muted jos-mt">' + esc(j.service || '') + ' · ' + esc(j.date || '') + ' · ' + esc(j.time || '') + '</div>' +
      '<div class="jos-muted">' + esc(j.assignedTo || 'Unassigned') + ' · ' + esc(j.address || '') + '</div>' +
      '<div class="jos-between jos-mt"><span class="jos-pipe-amt">' + esc(money(j.amount)) + '</span><span class="jos-pill ' + (j.depositStatus === 'paid' ? 'ok' : (j.depositStatus === 'due' ? 'warn' : 'info')) + '">Deposit ' + esc(j.depositStatus) + '</span></div>' +
      '<div class="jos-btn-row jos-mt">' +
        btn('jobs-start', 'Start', 'jos-btn-brand jos-btn-sm') +
        btn('jobs-edit', 'Edit', 'jos-btn jos-btn-sm') +
        btn('jobs-reschedule', 'Reschedule', 'jos-btn jos-btn-sm') +
        btn('jobs-complete', 'Complete', 'jos-btn jos-btn-sm') +
      '</div></div>';
  }

  function renderJobsListPanel(root, selectedId) {
    var listView = root._josJobsListView || 'upcoming';
    var filters = '<div class="jos-btn-row">' + JOBS_LIST_VIEWS.map(function (v) {
      return '<button type="button" class="jos-btn jos-btn-sm' + (listView === v[0] ? ' jos-btn-brand' : '') + '" data-jos-jobs-list="' + v[0] + '">' + v[1] + '</button>';
    }).join('') + '</div>';
    var list = filterJobsList(root);
    if (root._josJobsLoading) return '<div class="jos-card"><div class="jos-home-loading">Loading jobs…</div></div>';
    return '<div class="jos-card"><div class="jos-between"><div class="jos-kicker">Jobs</div>' + filters + '</div>' +
      (list.length ? '<div class="jos-stack jos-mt">' + list.map(function (j) { return jobCardHtml(j, selectedId, true); }).join('') + '</div>' : '<div class="jos-empty jos-mt">No jobs in this view.</div>') +
      '</div>';
  }

  function renderJobWorkspace(root, j, workspaceTab) {
    var tabs = [['overview', 'Overview'], ['checklist', 'Checklist'], ['photos', 'Photos'], ['notes', 'Notes'], ['products', 'Products'], ['invoice', 'Invoice'], ['timeline', 'Timeline']];
    var tabBar = '<div class="jos-btn-row">' + tabs.map(function (t) {
      return '<button type="button" class="jos-btn jos-btn-sm' + (workspaceTab === t[0] ? ' jos-btn-brand' : '') + '" data-jos-job-ws="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div>';
    var actions = '<div class="jos-btn-row jos-mt">' +
      btn('jobs-start', 'Start', 'jos-btn-brand jos-btn-sm') +
      btn('jobs-pause', 'Pause', 'jos-btn jos-btn-sm') +
      btn('jobs-resume', 'Resume', 'jos-btn jos-btn-sm') +
      btn('jobs-complete', 'Complete', 'jos-btn jos-btn-sm') +
      btn('jobs-cancel', 'Cancel', 'jos-btn jos-btn-sm') +
      btn('jobs-duplicate', 'Duplicate', 'jos-btn jos-btn-sm') +
      btn('jobs-reschedule', 'Reschedule', 'jos-btn jos-btn-sm') +
      btn('jobs-resize', 'Resize +30m', 'jos-btn jos-btn-sm') +
      '</div>';
    var body = '';
    if (workspaceTab === 'overview') {
      body = '<div class="jos-stack jos-mt">' +
        '<div><div class="jos-kicker">Customer</div><strong>' + esc(j.customer) + '</strong><div class="jos-muted">' + esc(j.phone || '') + '</div></div>' +
        '<div><div class="jos-kicker">Address</div>' + esc(j.address || '—') + ' ' + (j.address ? '<a class="jos-btn jos-btn-sm" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(j.address) + '" target="_blank" rel="noopener">Open</a>' : '') + '</div>' +
        '<div><div class="jos-kicker">Service</div>' + esc(j.service || '') + '</div>' +
        '<div><div class="jos-kicker">Technician</div>' + esc(j.assignedTo || 'Unassigned') + '</div>' +
        '<div class="jos-between"><div><div class="jos-kicker">Price</div>' + esc(money(j.amount)) + '</div><div><div class="jos-kicker">Deposit</div>' + esc(money(j.deposit)) + ' · ' + esc(j.depositStatus) + '</div></div>' +
        '<div><div class="jos-kicker">Status</div><span class="jos-pill ' + jobStatusTone(j.status) + '">' + esc(j.status) + '</span></div>' +
        '<div><div class="jos-kicker">Tags</div>' + (j.tags || []).map(function (t) { return '<span class="jos-pill info">' + esc(t) + '</span>'; }).join(' ') +
        ' <button type="button" class="jos-btn jos-btn-sm" data-jos-act="jobs-add-tag">Add tag</button></div>' +
        '</div>';
    } else if (workspaceTab === 'checklist') {
      var pct = checklistProgress(j);
      body = '<div class="jos-mt"><div class="jos-between"><div class="jos-kicker">Service Checklist</div><strong>' + pct + '%</strong></div>' +
        '<div class="jos-progress"><i style="width:' + pct + '%"></i></div>' +
        '<div class="jos-stack jos-mt">' + (j.checklist || []).map(function (c) {
          return '<label class="jos-check-row"><input type="checkbox" data-jos-job="' + esc(j.id) + '" data-jos-check="' + esc(c.id) + '"' + (c.done ? ' checked' : '') + '> ' + esc(c.label) + '</label>';
        }).join('') + '</div>' +
        '<div class="jos-chat-input jos-mt"><input id="jos-jobs-check-new" type="text" placeholder="Custom checklist item…"><button type="button" class="jos-btn jos-btn-sm" data-jos-act="jobs-check-add">Add</button></div>' +
        '<div class="jos-mt"><div class="jos-kicker">Checklist notes</div><textarea id="jos-jobs-check-notes" class="jos-textarea" placeholder="Notes…">' + esc(j.checklistNotes || '') + '</textarea>' +
        '<div class="jos-mt">' + btn('jobs-check-notes-save', 'Save notes', 'jos-btn jos-btn-sm') + '</div></div></div>';
    } else if (workspaceTab === 'photos') {
      if (root._josPhotosLoading) body = '<div class="jos-home-loading">Loading photos…</div>';
      else body = '<div class="jos-mt"><div class="jos-kicker">Before</div><div class="jos-photo-grid">' +
        ((j.photos.before.length ? j.photos.before : []).map(function (p, i) {
          return '<div class="jos-photo">Before ' + (i + 1) + '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="jobs-photo-del" data-jos-photo-kind="before" data-jos-photo-i="' + i + '">Delete</button></div>';
        }).join('') || '<div class="jos-muted">No before photos</div>') +
        '</div><div class="jos-btn-row jos-mt">' + btn('jobs-photo-before', 'Upload Before', 'jos-btn jos-btn-sm') + '</div>' +
        '<div class="jos-kicker jos-mt">After</div><div class="jos-photo-grid">' +
        ((j.photos.after.length ? j.photos.after : []).map(function (p, i) {
          return '<div class="jos-photo">After ' + (i + 1) + '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="jobs-photo-del" data-jos-photo-kind="after" data-jos-photo-i="' + i + '">Delete</button></div>';
        }).join('') || '<div class="jos-muted">No after photos</div>') +
        '</div><div class="jos-btn-row jos-mt">' + btn('jobs-photo-after', 'Upload After', 'jos-btn jos-btn-sm') + btn('jobs-photo-organize', 'Organize', 'jos-btn jos-btn-sm') + '</div></div>';
    } else if (workspaceTab === 'notes') {
      body = '<div class="jos-stack jos-mt">' +
        '<div><div class="jos-kicker">Internal Notes</div>' + (j.internalNotes.length ? j.internalNotes.map(function (n) { return '<div class="jos-note">' + esc(n) + '</div>'; }).join('') : '<div class="jos-muted">None</div>') +
        '<div class="jos-chat-input jos-mt"><input id="jos-jobs-note-internal" placeholder="Internal note…"><button type="button" class="jos-btn jos-btn-sm" data-jos-act="jobs-note-internal">Add</button></div></div>' +
        '<div><div class="jos-kicker">Customer Notes</div>' + (j.customerNotes.length ? j.customerNotes.map(function (n) { return '<div class="jos-note">' + esc(n) + '</div>'; }).join('') : '<div class="jos-muted">None</div>') +
        '<div class="jos-chat-input jos-mt"><input id="jos-jobs-note-customer" placeholder="Customer note…"><button type="button" class="jos-btn jos-btn-sm" data-jos-act="jobs-note-customer">Add</button></div></div>' +
        '<div><div class="jos-kicker">Voice Notes</div>' + (j.voiceNotes.length ? j.voiceNotes.map(function (n) { return '<div class="jos-note">🎤 ' + esc(n) + '</div>'; }).join('') : '<div class="jos-muted">None</div>') +
        '<div class="jos-mt">' + btn('jobs-note-voice', 'Add Voice Note', 'jos-btn jos-btn-sm') + '</div></div></div>';
    } else if (workspaceTab === 'products') {
      body = '<div class="jos-stack jos-mt">' + (j.products.length ? j.products.map(function (p, i) {
        return '<div class="jos-between jos-note"><div><strong>' + esc(p.name) + '</strong><div class="jos-muted">Qty ' + esc(String(p.qty)) + ' · ' + esc(money(p.cost)) + (p.notes ? ' · ' + esc(p.notes) : '') + '</div></div>' +
          '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="jobs-product-del" data-jos-product-i="' + i + '">Remove</button></div>';
      }).join('') : '<div class="jos-empty">No products logged</div>') +
        '<div class="jos-mt">' + btn('jobs-product-add', 'Add Product', 'jos-btn-brand jos-btn-sm') + '</div></div>';
    } else if (workspaceTab === 'invoice') {
      body = '<div class="jos-stack jos-mt">' +
        (j.invoice ? '<div class="jos-note"><strong>Invoice ' + esc(j.invoice.id) + '</strong><div class="jos-muted">' + esc(money(j.invoice.amount)) + ' · ' + esc(j.invoice.status) + '</div></div>' : '<div class="jos-muted">No invoice yet</div>') +
        '<div class="jos-btn-row">' +
          btn('jobs-invoice-create', 'Create Invoice', 'jos-btn-brand jos-btn-sm') +
          btn('jobs-invoice-view', 'View Invoice', 'jos-btn jos-btn-sm') +
          btn('jobs-invoice-paid', 'Mark Paid', 'jos-btn jos-btn-sm') +
          btn('jobs-invoice-print', 'Print', 'jos-btn jos-btn-sm') +
          btn('jobs-invoice-email', 'Email (placeholder)', 'jos-btn jos-btn-sm') +
        '</div></div>';
    } else {
      if (root._josTimelineLoading) body = '<div class="jos-home-loading">Loading timeline…</div>';
      else body = '<div class="jos-stack jos-mt">' + (j.timeline || []).map(function (t) {
        return '<div class="jos-sched-row"><div class="time">' + esc(String(t.type || '').slice(0, 4)) + '</div><div><div class="who">' + esc(t.label) + '</div><div class="svc">' + esc(t.at || '') + '</div></div></div>';
      }).join('') + '</div>';
    }
    return '<div class="jos-card jos-jobs-details" data-jos-job-id="' + esc(j.id) + '"><div class="jos-between"><div><div class="jos-kicker">Job Workspace</div><h3 style="margin:4px 0 0">' + esc(j.customer) + '</h3></div><span class="jos-pill ' + jobStatusTone(j.status) + '">' + esc(j.status) + '</span></div>' + tabBar + actions + body + '</div>';
  }

  function renderJobsRoute(root) {
    var today = todayStr();
    var stops = jobsAll().filter(function (j) { return j.date === today && j.status !== 'cancelled'; })
      .sort(function (a, b) { return (a.routeOrder || 0) - (b.routeOrder || 0) || parseJobMinutes(a.time) - parseJobMinutes(b.time); });
    var miles = Math.max(8, stops.length * 7.2).toFixed(1);
    var drive = Math.max(15, stops.length * 12);
    if (!stops.length) return '<div class="jos-card"><div class="jos-empty">No jobs on today’s route.</div></div>';
    return '<div class="jos-card"><div class="jos-kicker">Today\'s Route</div><p class="jos-muted jos-mt">' + stops.length + ' stops · ' + miles + ' miles · ~' + drive + ' min drive</p>' +
      '<div class="jos-stack jos-mt">' + stops.map(function (j, i) {
        return '<div class="jos-between jos-note" data-jos-job-id="' + esc(j.id) + '"><div><strong>#' + (i + 1) + ' ' + esc(j.customer) + '</strong><div class="jos-muted">' + esc(j.address) + ' · ' + esc(j.time) + '</div></div>' +
          '<div class="jos-btn-row">' +
          (i ? '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="jobs-route-up" data-jos-job-id="' + esc(j.id) + '">↑</button>' : '') +
          (i < stops.length - 1 ? '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="jobs-route-down" data-jos-job-id="' + esc(j.id) + '">↓</button>' : '') +
          (j.address ? '<a class="jos-btn jos-btn-sm" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(j.address) + '">Open</a>' : '') +
          '</div></div>';
      }).join('') + '</div>' +
      '<div class="jos-mt">' + btn('jobs-ai-route', 'Optimize with AI', 'jos-btn-brand jos-btn-sm') + '</div></div>';
  }

  function renderJobsAvailability() {
    var a = S().availability || {};
    var hours = a.hours || {};
    return '<div class="jos-stack">' +
      '<div class="jos-card"><div class="jos-kicker">Business Hours</div><div class="jos-stack jos-mt">' + Object.keys(hours).map(function (k) {
        return '<div class="jos-between"><strong style="text-transform:uppercase">' + esc(k) + '</strong><span>' + esc(hours[k]) + '</span></div>';
      }).join('') + '</div></div>' +
      '<div class="jos-card"><div class="jos-kicker">Blocked Days</div><p class="jos-mt">' + esc((a.blocked || []).join(', ') || 'None') + '</p>' + btn('jobs-block-day', 'Block selected day', 'jos-btn jos-btn-sm') + '</div>' +
      '<div class="jos-card"><div class="jos-kicker">Holidays</div><p class="jos-mt">' + esc((a.holidays || []).join(', ') || 'None') + '</p>' + btn('jobs-add-holiday', 'Add holiday', 'jos-btn jos-btn-sm') + '</div>' +
      '<div class="jos-card"><div class="jos-kicker">Vacation</div><p class="jos-mt">' + esc((a.vacation || []).join(', ') || 'None') + '</p>' + btn('jobs-add-vacation', 'Add vacation', 'jos-btn jos-btn-sm') + '</div>' +
      '<div class="jos-card"><div class="jos-kicker">Manual Availability</div><p class="jos-mt">' + esc((a.manual || []).join(' · ') || 'Using business hours') + '</p>' + btn('jobs-manual-avail', 'Set manual window', 'jos-btn jos-btn-sm') + '</div>' +
      '</div>';
  }

  function renderJobsTeam(root) {
    var team = jobsTeam();
    var today = todayStr();
    if (!team.length) return '<div class="jos-card"><div class="jos-empty">No team members yet.</div></div>';
    return '<div class="jos-stack">' + team.map(function (t) {
      var todays = jobsAll().filter(function (j) { return j.date === today && j.assignedTo === t.name && j.status !== 'cancelled'; });
      return '<div class="jos-card"><div class="jos-between"><div><strong>' + esc(t.name) + '</strong><div class="jos-muted">' + esc(t.role || 'Technician') + '</div></div><span class="jos-pill info">' + todays.length + ' today</span></div>' +
        '<div class="jos-muted jos-mt">Workload: ' + todays.length + ' jobs · Schedule: on duty</div>' +
        '<div class="jos-stack jos-mt">' + (todays.length ? todays.map(function (j) {
          return '<button type="button" class="jos-list-card" data-jos-job-id="' + esc(j.id) + '"><div class="t">' + esc(j.customer) + '</div><div class="s">' + esc(j.time) + ' · ' + esc(j.service) + '</div></button>';
        }).join('') : '<div class="jos-muted">No jobs today</div>') + '</div>' +
        '<div class="jos-btn-row jos-mt">' + btn('jobs-assign', 'Assign Jobs', 'jos-btn-brand jos-btn-sm') + btn('jobs-reassign', 'Reassign', 'jos-btn jos-btn-sm') + '</div></div>';
    }).join('') + '</div>';
  }

  function selectedJobIds(root) {
    var bulk = root && root._josBulk || {};
    var ids = Object.keys(bulk).filter(function (k) { return bulk[k]; });
    if (ids.length) return ids;
    if (root && root._josJobId) return [root._josJobId];
    return [];
  }

  function handleJobsAct(act, t) {
    var root = el('jos-jobs-root');
    if (!root) return;
    ensureJobsOsState();
    var jobId = (t && (t.getAttribute('data-jos-job-id') || (t.closest('[data-jos-job-id]') && t.closest('[data-jos-job-id]').getAttribute('data-jos-job-id')))) || root._josJobId;
    var job = jobId ? findJob(jobId) : null;

    try {
      if (act === 'jobs-cal-prev') {
        var step = root._josCalView === 'month' ? 30 : (root._josCalView === 'day' ? 1 : 7);
        root._josCalAnchor = addDaysStr(root._josCalAnchor || todayStr(), -step);
        return renderJobs();
      }
      if (act === 'jobs-cal-next') {
        var stepN = root._josCalView === 'month' ? 30 : (root._josCalView === 'day' ? 1 : 7);
        root._josCalAnchor = addDaysStr(root._josCalAnchor || todayStr(), stepN);
        return renderJobs();
      }
      if (act === 'jobs-cal-today') { root._josCalAnchor = todayStr(); root._josCalView = 'day'; return renderJobs(); }
      if (act === 'jobs-create') {
        var nj = {
          id: 'job_' + Date.now(),
          customer: 'New Customer',
          service: (S().services && S().services[0] && S().services[0].name) || 'Detail',
          amount: 180,
          date: root._josCalAnchor || todayStr(),
          time: '10:00 AM',
          status: 'scheduled',
          address: S().city || 'San Diego, CA',
          assignedTo: jobsTeam()[0].name,
          depositStatus: 'none',
          deposit: 0,
          durationMin: 120,
          tags: ['manual'],
          checklist: DEFAULT_CHECKLIST.map(function (label, i) { return { id: 'cl_new_' + i, label: label, done: false }; }),
          photos: { before: [], after: [] },
          internalNotes: [],
          customerNotes: [],
          voiceNotes: [],
          products: [],
          timeline: [{ type: 'created', label: 'Job Created', at: new Date().toLocaleString() }, { type: 'scheduled', label: 'Scheduled', at: new Date().toLocaleString() }],
          routeOrder: jobsAll().length + 1
        };
        S().jobs.unshift(nj);
        root._josJobId = nj.id;
        root._josJobsTab = 'jobs';
        pushJobNotif('upcoming', 'New job created');
        toast('Job created');
        return renderJobs();
      }
      if (act === 'jobs-edit') {
        if (!job) return toast('Select a job');
        job.service = job.service || 'Detail';
        job.internalNotes.push('Edited job details');
        pushJobTimeline(job, 'note', 'Job edited');
        toast('Job updated');
        return renderJobs();
      }
      if (act === 'jobs-resize') {
        if (!job) return toast('Select a job');
        job.durationMin = (job.durationMin || 120) + 30;
        pushJobTimeline(job, 'note', 'Duration resized to ' + job.durationMin + 'm');
        toast('Job resized (+30 min)');
        return renderJobs();
      }
      if (act === 'jobs-start') {
        if (!job) return toast('Select a job');
        job.status = 'in_progress';
        pushJobTimeline(job, 'started', 'Started');
        pushJobNotif('upcoming', job.customer + ' job started');
        toast('Job started');
        return renderJobs();
      }
      if (act === 'jobs-pause') {
        if (!job) return toast('Select a job');
        job.status = 'paused';
        pushJobTimeline(job, 'note', 'Paused');
        toast('Job paused');
        return renderJobs();
      }
      if (act === 'jobs-resume') {
        if (!job) return toast('Select a job');
        job.status = 'in_progress';
        pushJobTimeline(job, 'started', 'Resumed');
        toast('Job resumed');
        return renderJobs();
      }
      if (act === 'jobs-complete') {
        if (!job) return toast('Select a job');
        job.status = 'completed';
        (job.checklist || []).forEach(function (c) { c.done = true; });
        pushJobTimeline(job, 'completed', 'Completed');
        pushJobNotif('completed', job.customer + ' completed');
        toast('Job completed');
        return renderJobs();
      }
      if (act === 'jobs-cancel') {
        if (!job) return toast('Select a job');
        job.status = 'cancelled';
        pushJobTimeline(job, 'note', 'Cancelled');
        pushJobNotif('cancelled', job.customer + ' cancelled');
        toast('Job cancelled');
        return renderJobs();
      }
      if (act === 'jobs-duplicate') {
        if (!job) return toast('Select a job');
        var dup = JSON.parse(JSON.stringify(job));
        dup.id = 'job_' + Date.now();
        dup.status = 'scheduled';
        dup.date = addDaysStr(job.date || todayStr(), 7);
        dup.timeline = [{ type: 'created', label: 'Duplicated', at: new Date().toLocaleString() }];
        S().jobs.unshift(dup);
        root._josJobId = dup.id;
        toast('Job duplicated');
        return renderJobs();
      }
      if (act === 'jobs-reschedule') {
        if (!job) return toast('Select a job');
        job.date = addDaysStr(job.date || todayStr(), 1);
        pushJobTimeline(job, 'scheduled', 'Rescheduled +1 day');
        toast('Job rescheduled to ' + job.date);
        return renderJobs();
      }
      if (act === 'jobs-convert-quote') {
        var q = (quotes() || [])[0];
        if (!q) return toast('No quotes to convert');
        var cj = {
          id: 'job_q_' + Date.now(),
          customer: q.customerName || q.customer || 'Customer',
          phone: q.customerPhone || '',
          service: (q.packageNames && q.packageNames[0]) || 'Quoted service',
          amount: q.amount || 0,
          date: todayStr(),
          time: '1:00 PM',
          status: 'scheduled',
          address: S().city || '',
          assignedTo: jobsTeam()[0].name,
          depositStatus: 'due',
          deposit: Math.round((q.amount || 0) * 0.25),
          tags: ['from-quote'],
          checklist: DEFAULT_CHECKLIST.map(function (label, i) { return { id: 'cl_q_' + i, label: label, done: false }; }),
          photos: { before: [], after: [] },
          internalNotes: ['Converted from quote ' + (q.id || '')],
          customerNotes: [],
          voiceNotes: [],
          products: [],
          timeline: [{ type: 'created', label: 'Converted from quote', at: new Date().toLocaleString() }],
          durationMin: 120,
          routeOrder: jobsAll().length + 1
        };
        S().jobs.unshift(cj);
        root._josJobId = cj.id;
        root._josJobsTab = 'jobs';
        toast('Quote converted to job');
        return renderJobs();
      }
      if (act === 'jobs-check-add') {
        if (!job) return;
        var inp = el('jos-jobs-check-new');
        var label = inp && inp.value;
        if (!String(label || '').trim()) return toast('Enter a checklist item');
        job.checklist.push({ id: 'cl_' + Date.now(), label: String(label).trim(), done: false });
        toast('Checklist item added');
        return renderJobs();
      }
      if (act === 'jobs-check-notes-save') {
        if (!job) return;
        var ta = el('jos-jobs-check-notes');
        job.checklistNotes = ta ? ta.value : '';
        toast('Checklist notes saved');
        return renderJobs();
      }
      if (act === 'jobs-photo-before' || act === 'jobs-photo-after') {
        if (!job) return;
        root._josPhotosLoading = true; renderJobs();
        setTimeout(function () {
          var kind = act === 'jobs-photo-before' ? 'before' : 'after';
          job.photos[kind].push({ id: 'ph_' + Date.now(), name: kind + '-photo.jpg' });
          root._josPhotosLoading = false;
          toast((kind === 'before' ? 'Before' : 'After') + ' photo uploaded');
          renderJobs();
        }, 150);
        return;
      }
      if (act === 'jobs-photo-del') {
        if (!job) return;
        var kind = t.getAttribute('data-jos-photo-kind');
        var i = parseInt(t.getAttribute('data-jos-photo-i'), 10);
        if (job.photos[kind]) job.photos[kind].splice(i, 1);
        toast('Photo deleted');
        return renderJobs();
      }
      if (act === 'jobs-photo-organize') {
        if (!job) return;
        job.photos.before = (job.photos.before || []).slice().reverse();
        job.photos.after = (job.photos.after || []).slice().reverse();
        toast('Photos organized');
        return renderJobs();
      }
      if (act === 'jobs-note-internal') {
        if (!job) return;
        var ni = el('jos-jobs-note-internal');
        if (!ni || !String(ni.value || '').trim()) return toast('Enter a note');
        job.internalNotes.push(String(ni.value).trim());
        pushJobTimeline(job, 'note', 'Internal note added');
        toast('Internal note saved');
        return renderJobs();
      }
      if (act === 'jobs-note-customer') {
        if (!job) return;
        var nc = el('jos-jobs-note-customer');
        if (!nc || !String(nc.value || '').trim()) return toast('Enter a note');
        job.customerNotes.push(String(nc.value).trim());
        toast('Customer note saved');
        return renderJobs();
      }
      if (act === 'jobs-note-voice') {
        if (!job) return;
        job.voiceNotes.push('Voice note ' + (job.voiceNotes.length + 1) + ' (0:08)');
        toast('Voice note added');
        return renderJobs();
      }
      if (act === 'jobs-product-add') {
        if (!job) return;
        job.products.push({ name: 'Detailing clay', qty: 1, cost: 8, notes: 'Used on paint' });
        toast('Product added');
        return renderJobs();
      }
      if (act === 'jobs-product-del') {
        if (!job) return;
        var pi = parseInt(t.getAttribute('data-jos-product-i'), 10);
        job.products.splice(pi, 1);
        toast('Product removed');
        return renderJobs();
      }
      if (act === 'jobs-invoice-create') {
        if (!job) return;
        job.invoice = { id: 'INV-' + String(job.id).slice(-6), amount: job.amount, status: 'open' };
        pushJobTimeline(job, 'note', 'Invoice created');
        toast('Invoice created');
        return renderJobs();
      }
      if (act === 'jobs-invoice-view') {
        if (!job || !job.invoice) return toast('Create an invoice first');
        toast('Invoice ' + job.invoice.id + ' · ' + money(job.invoice.amount) + ' · ' + job.invoice.status);
        return;
      }
      if (act === 'jobs-invoice-paid') {
        if (!job) return;
        if (!job.invoice) job.invoice = { id: 'INV-' + String(job.id).slice(-6), amount: job.amount, status: 'paid' };
        else job.invoice.status = 'paid';
        job.depositStatus = 'paid';
        pushJobTimeline(job, 'paid', 'Paid');
        toast('Marked paid');
        return renderJobs();
      }
      if (act === 'jobs-invoice-print') {
        toast('Print dialog ready (OS placeholder)');
        return;
      }
      if (act === 'jobs-invoice-email') {
        toast('Email invoice placeholder — Stage 2 will send via provider');
        return;
      }
      if (act === 'jobs-add-tag') {
        if (!job) return;
        job.tags.push('priority');
        toast('Tag added');
        return renderJobs();
      }
      if (act === 'jobs-route-up' || act === 'jobs-route-down') {
        if (!job) return;
        var delta = act === 'jobs-route-up' ? -1 : 1;
        job.routeOrder = (job.routeOrder || 1) + delta;
        toast('Route order updated');
        return renderJobs();
      }
      if (act === 'jobs-block-day') {
        S().availability.blocked.push(root._josCalAnchor || todayStr());
        toast('Day blocked');
        return renderJobs();
      }
      if (act === 'jobs-add-holiday') {
        S().availability.holidays.push(addDaysStr(todayStr(), 30));
        toast('Holiday added');
        return renderJobs();
      }
      if (act === 'jobs-add-vacation') {
        S().availability.vacation.push(addDaysStr(todayStr(), 60) + ' → ' + addDaysStr(todayStr(), 67));
        toast('Vacation added');
        return renderJobs();
      }
      if (act === 'jobs-manual-avail') {
        S().availability.manual.push('Thu 7:00 AM – 8:00 PM');
        toast('Manual availability saved');
        return renderJobs();
      }
      if (act === 'jobs-assign' || act === 'jobs-reassign' || act === 'jobs-bulk-assign') {
        var ids = selectedJobIds(root);
        if (!ids.length) return toast('Select job(s) first');
        var tech = jobsTeam()[(act === 'jobs-reassign') ? 1 : 0] || jobsTeam()[0];
        ids.forEach(function (id) {
          var j = findJob(id);
          if (j) { j.assignedTo = tech.name; pushJobTimeline(j, 'note', 'Assigned to ' + tech.name); }
        });
        toast('Assigned to ' + tech.name);
        return renderJobs();
      }
      if (act === 'jobs-bulk-status') {
        var ids2 = selectedJobIds(root);
        if (!ids2.length) return toast('Select job(s) first');
        ids2.forEach(function (id) {
          var j = findJob(id);
          if (j && j.status === 'scheduled') j.status = 'in_progress';
        });
        toast('Status updated for ' + ids2.length + ' job(s)');
        return renderJobs();
      }
      if (act === 'jobs-bulk-delete') {
        var ids3 = selectedJobIds(root);
        if (!ids3.length) return toast('Select job(s) first');
        S().jobs = S().jobs.filter(function (j) { return ids3.indexOf(String(j.id)) === -1; });
        root._josBulk = {};
        root._josJobId = null;
        toast('Deleted ' + ids3.length + ' job(s)');
        return renderJobs();
      }
      if (act === 'jobs-export') {
        var rows = filterJobsList(root).map(function (j) {
          return [j.date, j.time, j.customer, j.service, j.status, j.assignedTo, j.amount].join(',');
        });
        var csv = 'date,time,customer,service,status,employee,amount\n' + rows.join('\n');
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(csv);
        } catch (e) {}
        toast('Exported ' + rows.length + ' jobs to clipboard');
        return;
      }
      if (act === 'jobs-ai-summary') return ask('Give me a daily Jobs & Calendar summary for today including risks and priorities');
      if (act === 'jobs-ai-route') return ask('Suggest the best route order for today’s jobs');
      if (act === 'jobs-ai-schedule') return ask('Suggest schedule improvements to avoid overbooking and delays');
    } catch (err) {
      console.warn('Jobs action failed', err);
      toast('Failed to update — try again');
    }
  }

  function switchNav(v) {
    var nav = document.querySelector('[data-v="' + v + '"]');
    if (nav && typeof global.switchV === 'function') global.switchV(nav);
  }
  function onSwitchView(v) {
    updateChrome(v);
    var map = {
      pipeline: renderPipeline,
      opportunities: renderOpportunities,
      activity: renderActivity,
      ask: renderAskHubly,
      'ask-hubly': renderAskHubly,
      marketing: renderMarketing,
      memberships: renderMemberships,
      reports: renderReportsPage,
      growth: renderGrowth,
      reviews: renderBizReviews,
      settings: renderSettingsHub,
      leads: renderLeadsList,
      customers: renderCustomersPage,
      dashboard: enhanceDashboard,
      chats: renderInbox,
      jobs: renderJobs
    };
    if (map[v]) try { map[v](); } catch (e) { console.warn('HublyJourneyOS', v, e); }
  }

  function bindRoot(root) {
    if (!root || root._josBound) return; root._josBound = true;
    root.addEventListener('click', function (e) {
      var t = e.target.closest('[data-jos-act],[data-jos-ask],[data-jos-card],[data-jos-opp],[data-jos-lead],[data-jos-lead-row],[data-jos-lead-filter],[data-jos-cust-row],[data-jos-cust-tab],[data-jos-cust],[data-jos-tab],[data-jos-job],[data-jos-inbox-tab],[data-jos-inbox-id]'); if (!t) return;
      if (t.hasAttribute('data-jos-inbox-tab')) {
        var irTab = el('jos-inbox-root'); if (irTab) { irTab._josInboxTab = t.getAttribute('data-jos-inbox-tab'); renderInbox(); }
        return;
      }
      if (t.hasAttribute('data-jos-inbox-id')) {
        var irId = el('jos-inbox-root'); if (irId) { irId._josInboxId = t.getAttribute('data-jos-inbox-id'); renderInbox(); }
        return;
      }
      if (t.hasAttribute('data-jos-card')) {
        var cards = el('jos-pipeline-root')?._josCards || [];
        return openCard(cards.find(function (c) { return String(c.id) === String(t.getAttribute('data-jos-card')); }));
      }
      if (t.hasAttribute('data-jos-lead-filter')) {
        var leadsRoot = el('jos-leads-root'); if (leadsRoot) { leadsRoot._josLeadFilter = t.getAttribute('data-jos-lead-filter'); renderLeadsList(); }
        return;
      }
      if (t.hasAttribute('data-jos-lead-row')) {
        var lr = el('jos-leads-root'); if (lr) { lr._josLeadKey = t.getAttribute('data-jos-lead-row'); renderLeadsList(); }
        return;
      }
      if (t.hasAttribute('data-jos-lead')) { var key = t.getAttribute('data-jos-lead'); if (key && typeof global.viewLead === 'function') global.viewLead(key); return; }
      if (t.hasAttribute('data-jos-cust-tab')) {
        var cr = el('jos-customers-root'); if (cr) { cr._josCustTab = t.getAttribute('data-jos-cust-tab'); renderCustomersPage(); }
        return;
      }
      if (t.hasAttribute('data-jos-cust-row')) {
        var crow = el('jos-customers-root'); if (crow) { crow._josCustId = t.getAttribute('data-jos-cust-row'); S().activeCustId = crow._josCustId; renderCustomersPage(); }
        return;
      }
      if (t.hasAttribute('data-jos-job')) {
        var shell = el('jos-customer-profile'); if (!shell) return;
        shell._josJobId = t.getAttribute('data-jos-job');
        var custJ = customers().find(function (c) { return String(c.id) === String(shell._josCustId); });
        if (custJ) renderProfileTab(custJ, S()._josProfileTab || 'Jobs');
        return;
      }
      if (t.hasAttribute('data-jos-tab')) {
        var tab = t.getAttribute('data-jos-tab'); S()._josProfileTab = tab;
        var shellT = el('jos-customer-profile'); if (shellT) shellT._josJobId = null;
        var cust = customers().find(function (c) { return String(c.id) === String(shellT?._josCustId); }); if (!cust) return;
        (shellT || root).querySelectorAll('.jos-profile-tab').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-jos-tab') === tab); });
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
      if (act && String(act).indexOf('inbox-') === 0) return handleInboxAct(act, t);
      if (act && String(act).indexOf('jobs-') === 0) return handleJobsAct(act, t);
      if (act === 'ask-submit' || act === 'ask-brief') {
        switchNav('ask');
        return HublyJourneyOS._askFromInput(act === 'ask-brief' ? 'What should I focus on this morning?' : null);
      }
      if (act === 'manual-lead') return typeof global.openM === 'function' ? global.openM('m-new-lead') : toast('Add lead');
      if (act === 'add-cust') return typeof global.openM === 'function' ? global.openM('m-new-cust') : toast('Add customer');
      if (act === 'new-invoice') return typeof global.openM === 'function' ? global.openM('m-new-invoice') : toast('New invoice');
      if (act === 'cust-full-profile') {
        var cidFull = t.getAttribute('data-jos-cust') || S().activeCustId || el('jos-customers-root')?._josCustId;
        if (cidFull) return openCustomerProfile(cidFull);
        return;
      }
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
      if (act === 'new-job-cust') {
        var cid = S().activeCustId || el('jos-customer-profile')?._josCustId || el('jos-customers-root')?._josCustId;
        if (cid && typeof global.openNewJobForCustomer === 'function') return global.openNewJobForCustomer(cid);
        return typeof global.openM === 'function' ? global.openM('m-new-job') : toast('New job');
      }
      if (act === 'go-opps') { closeCustomerProfile(); return switchNav('opportunities'); }
      if (act === 'go-reviews') return switchNav('reviews');
      if (act === 'go-mem') return switchNav('memberships');
      if (act === 'go-money') return switchNav('money');
      if (act === 'go-reports') return switchNav('reports');
      if (act === 'go-chats') return switchNav('chats');
      if (act === 'go-customers') return switchNav('customers');
      if (act === 'go-leads') return switchNav('leads');
      if (act === 'go-jobs') return switchNav('jobs');
      if (act === 'go-editor') return switchNav('editor');
      if (act === 'go-ask') return switchNav('ask');
      if (act === 'go-settings') return switchNav('settings');
      if (act === 'close-profile') return closeCustomerProfile();
      el('jos-quick-pop')?.classList.remove('open');
      el('jos-search-pop')?.classList.remove('open');
      el('jos-notif-pop')?.classList.remove('open');
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
    renderCustomersPage: renderCustomersPage,
    renderInbox: renderInbox,
    renderJobs: renderJobs,
    openCustomerProfile: openCustomerProfile,
    closeCustomerProfile: closeCustomerProfile,
    enhanceDashboard: enhanceDashboard,
    openQuickNew: openQuickNew,
    onSwitchView: onSwitchView,
    updateChrome: updateChrome,
    _askFromInput: function (preset) {
      var input = el('jos-ask-input') || el('ai-question-input');
      ask(preset || (input && input.value) || '');
      if (input && !preset) input.value = '';
    }
  };
  global.HublyJourneyOS = HublyJourneyOS;
})(typeof window !== 'undefined' ? window : this);


