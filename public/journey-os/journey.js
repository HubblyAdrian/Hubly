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
      { id: 'conv1', customer_name: 'Alex Rivera', channel: 'sms', last_message: 'Can you fit me in for ceramic coating this week?', unread: 2, updated_at: todayStr() + 'T09:15:00', phone: '(619) 555-0133', messages: [{ dir: 'in', text: 'Hi, saw your Google listing. Do you do ceramic coating?', at: '9:02 AM' }, { dir: 'out', text: 'Yes! I have Thursday or Saturday open. What vehicle?', at: '9:05 AM' }, { dir: 'in', text: 'Can you fit me in for ceramic coating this week?', at: '9:15 AM' }] },
      { id: 'conv2', customer_name: 'Sarah Johnson', channel: 'sms', last_message: 'Perfect, see you at 9am tomorrow.', unread: 0, updated_at: todayStr() + 'T08:40:00', phone: '(619) 555-0198', messages: [{ dir: 'out', text: 'Reminder: Interior Detail tomorrow at 9:00 AM.', at: '8:30 AM' }, { dir: 'in', text: 'Perfect, see you at 9am tomorrow.', at: '8:40 AM' }] },
      { id: 'conv3', customer_name: 'Taylor Kim', channel: 'instagram', last_message: 'How much for a Model 3 interior?', unread: 1, updated_at: todayStr() + 'T07:22:00', messages: [{ dir: 'in', text: 'How much for a Model 3 interior?', at: '7:22 AM' }] },
      { id: 'conv4', customer_name: 'Jordan Lee', channel: 'chat', last_message: 'Left at vehicle size step', unread: 1, updated_at: todayStr() + 'T06:50:00', messages: [{ dir: 'in', text: 'Started booking Exterior Detail', at: '6:45 AM' }, { dir: 'sys', text: 'Left at vehicle size step', at: '6:50 AM' }] }
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
      dashboard: enhanceDashboard
    };
    if (map[v]) try { map[v](); } catch (e) { console.warn('HublyJourneyOS', v, e); }
  }

  function bindRoot(root) {
    if (!root || root._josBound) return; root._josBound = true;
    root.addEventListener('click', function (e) {
      var t = e.target.closest('[data-jos-act],[data-jos-ask],[data-jos-card],[data-jos-opp],[data-jos-lead],[data-jos-lead-row],[data-jos-lead-filter],[data-jos-cust-row],[data-jos-cust-tab],[data-jos-cust],[data-jos-tab],[data-jos-job]'); if (!t) return;
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


