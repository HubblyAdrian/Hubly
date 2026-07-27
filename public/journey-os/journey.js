/**
 * Hubly Journey OS — Operate UI render helpers (vanilla, no modules).
 * Uses global S + optional: escapeHtml, fmtDateLong, fmtMoney, toast, switchV,
 * viewCustomer, viewLead, openM, askAI, previewProfile, openSmartQuote, goStripeConnect.
 */
(function (global) {
  'use strict';

  var PIPE_STAGES = [
    { id: 'lead', label: 'Lead', dot: 'lead' },
    { id: 'qualified', label: 'Qualified', dot: 'qualified' },
    { id: 'quote', label: 'Quote', dot: 'quote' },
    { id: 'booked', label: 'Booked', dot: 'booked' },
    { id: 'completed', label: 'Completed', dot: 'completed' },
    { id: 'review', label: 'Review', dot: 'review' },
    { id: 'membership', label: 'Membership', dot: 'membership' }
  ];
  var PROFILE_TABS = ['Overview', 'Timeline', 'Jobs', 'Payments', 'Photos', 'Messages', 'Membership', 'Reviews', 'Documents', 'Notes'];
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
      if (global.HublyJourneyOS && typeof global.HublyJourneyOS._askFromInput === 'function') return global.HublyJourneyOS._askFromInput(text);
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

  function DS() { return global.HublyDS || null; }
  function dsBtn(act, label, cls) { var d = DS(); return d ? d.actionButton(act, label, cls) : btn(act, label, cls); }

  function ensurePipelineOsState() {
    var st = S();
    if (!st.pipeline) st.pipeline = { manual: [], stages: {} };
    if (!st.pipeline.stages) st.pipeline.stages = {};
    if (!Array.isArray(st.pipeline.manual)) st.pipeline.manual = [];
  }

  function pipeStageLabel(id) {
    var st = PIPE_STAGES.find(function (s) { return s.id === id; });
    return st ? st.label : (id || 'Lead');
  }

  function pipeStageIndex(id) {
    return PIPE_STAGES.findIndex(function (s) { return s.id === id; });
  }

  function getCardStageId(card) {
    if (!card) return 'lead';
    var st = S();
    if (st.pipeline && st.pipeline.stages && st.pipeline.stages[card.id]) return st.pipeline.stages[card.id];
    return card.stageId || 'lead';
  }

  function setCardStageId(cardId, stageId) {
    ensurePipelineOsState();
    S().pipeline.stages[cardId] = stageId;
  }

  function mapLeadStage(lead) {
    var stage = String(lead.stage || '').toLowerCase(), role = '';
    try { if (typeof global.leadStageById === 'function') role = global.leadStageById(lead.stage)?.role || ''; } catch (e) {}
    if (lead.source === 'membership' || lead.isMembershipSignup || stage === 'membership') return 'membership';
    if (stage === 'review' || lead.reviewRequested || lead.needsReview) return 'review';
    if (role === 'won' || stage === 'won' || stage === 'booked') {
      var match = jobs().find(function (j) { return j.customer === lead.name || (lead.phone && j.phone === lead.phone); });
      if (match && match.status === 'completed') return match.reviewRequested ? 'review' : 'completed';
      return 'booked';
    }
    if (stage === 'completed') return lead.reviewRequested ? 'review' : 'completed';
    if (lead.aiQualified || stage === 'qualified') return 'qualified';
    if (role === 'quote' || stage === 'quote_sent' || /quote/.test(stage) || lead.quoteStatus) return 'quote';
    if (lead.isReturning || lead.isRecurring) return 'qualified';
    if (stage === 'incomplete' || lead.source === 'abandoned') return 'lead';
    return 'lead';
  }

  function demoPipelineCards() {
    return [
      { id: 'd1', stageId: 'lead', name: 'Alex Rivera', source: 'google', service: 'Full detail', amount: 0 },
      { id: 'd2', stageId: 'qualified', name: 'Sam Chen', source: 'website', service: 'Exterior wash', vehicle: 'SUV', amount: 89 },
      { id: 'd3', stageId: 'quote', name: 'Jordan Lee', source: 'instagram', service: 'Interior + ceramic', vehicle: 'Sedan', amount: 249 },
      { id: 'd4', stageId: 'booked', name: 'Taylor Brooks', source: 'hubly', service: 'Mobile detail', date: dateLong(new Date().toISOString().slice(0, 10)), amount: 189 },
      { id: 'd5', stageId: 'completed', name: 'Casey Morgan', source: 'facebook', service: 'Paint correction', amount: 420 },
      { id: 'd6', stageId: 'review', name: 'Riley Quinn', source: 'hubly', service: 'Monthly wash', vehicle: 'Truck', amount: 95 },
      { id: 'd7', stageId: 'membership', name: 'Morgan Avery', source: 'membership', service: 'Shine Club', amount: 79 }
    ];
  }

  function pipelineLeadSource() {
    var fromCollect = collectLeads();
    if (fromCollect && fromCollect.length) return fromCollect;
    ensurePipelineOsState();
    var manual = (S().pipeline && S().pipeline.manual) || [];
    return manual.filter(function (l) { return l && !l.deleted; }).map(function (l) {
      return Object.assign({}, l, { key: l.key || l.id, id: l.id || l.key });
    });
  }

  function buildPipelineCards() {
    var cards = [];
    pipelineLeadSource().forEach(function (lead) {
      cards.push({ id: lead.key || lead.id, leadKey: lead.key || lead.id, customerId: lead.matchedCustomer?.id || null, stageId: mapLeadStage(lead), name: lead.name || 'Lead', source: srcKind(lead.source, lead), service: lead.service || '', vehicle: vehicleOf(lead), amount: lead.amount, date: lead.date || (lead.createdAt ? String(lead.createdAt).slice(0, 10) : ''), phone: lead.phone || '', email: lead.email || '', meta: lead });
    });
    quotes().forEach(function (q) {
      if (!q || q.status === 'booked') return;
      var id = 'sq:' + (q.id || Math.random().toString(36).slice(2, 7));
      if (cards.some(function (c) { return c.id === id; })) return;
      cards.push({ id: id, quoteId: q.id, stageId: 'quote', name: q.customerName || 'Quote', source: 'quote', service: (q.packageNames && q.packageNames[0]) || 'Smart Quote', vehicle: vehicleOf(q), amount: q.amount, date: (q.updatedAt || q.createdAt || '').slice(0, 10), meta: q });
    });
    jobs().filter(jobActive).forEach(function (j) {
      var stageId = j.status === 'completed' ? (j.reviewRequested ? 'review' : 'completed') : 'booked';
      if (j.isMembershipSignup || /membership/i.test(String(j.service || ''))) stageId = 'membership';
      else {
        var cust = customers().find(function (c) { return c.name === j.customer || (j.phone && c.phone === j.phone); });
        if (cust && (cust.customerType === 'recurring' || cust.isReturning) && j.status !== 'completed') stageId = 'membership';
      }
      cards.push({ id: 'job:' + (j.id || j.reqId), jobId: j.id, customerId: (customers().find(function (c) { return c.name === j.customer; }) || {}).id || null, customerName: j.customer, stageId: stageId, name: j.customer || 'Customer', source: j.fromBooking ? 'hubly' : srcKind(j.source, j), service: j.service || '', vehicle: vehicleOf(j), amount: j.amount, date: j.date || '', meta: j });
    });
    cards.forEach(function (c) { c.stageId = getCardStageId(c); });
    return cards.length ? cards : demoPipelineCards();
  }

  function pipeCardMetaBits(card) {
    var bits = [];
    var sid = getCardStageId(card);
    if (sid === 'quote' || sid === 'lead' || sid === 'qualified') {
      if (card.service) bits.push(card.service);
      if (card.vehicle) bits.push(card.vehicle);
    } else if (sid === 'booked' || sid === 'completed' || sid === 'review') {
      if (card.date) bits.push(String(card.date).length === 10 ? dateLong(card.date) : card.date);
      if (card.service) bits.push(card.service);
    } else {
      if (card.service) bits.push(card.service);
      if (card.vehicle) bits.push(card.vehicle);
    }
    return bits.filter(Boolean).join(' · ');
  }

  function pipeCardHtml(card, selectedId) {
    var kind = card.source || 'manual';
    var meta = pipeCardMetaBits(card);
    var sid = getCardStageId(card);
    var on = String(selectedId) === String(card.id);
    var d = DS();
    if (d && d.pipelineCard) {
      return d.pipelineCard({
        id: card.id,
        selected: on,
        name: card.name,
        sourceHtml: srcIco(kind),
        meta: meta,
        badge: pipeStageLabel(sid),
        badgeTone: sid === 'booked' ? 'booked' : (sid === 'completed' ? 'won' : (sid === 'membership' ? 'ok' : 'info')),
        amount: card.amount != null && Number.isFinite(Number(card.amount)) ? money(card.amount) : ''
      });
    }
    return '<div class="jos-pipe-card' + (on ? ' on' : '') + '" data-jos-pipe-card="' + esc(card.id) + '" role="button" tabindex="0" draggable="true"><div class="jos-between"><div class="jos-pipe-name">' + esc(card.name) + '</div>' + srcIco(kind) + '</div>' +
      (meta ? '<div class="jos-pipe-meta">' + esc(meta) + '</div>' : '') +
      '<div class="jos-pipe-foot"><span class="jos-src">' + esc(srcLabel(kind)) + '</span>' +
      (card.amount != null && Number.isFinite(Number(card.amount)) ? '<span class="jos-pipe-amt">' + esc(money(card.amount)) + '</span>' : '') + '</div></div>';
  }

  function filterPipelineCards(root, cards) {
    var q = String(root._josPipeQ || '').trim().toLowerCase();
    var f = root._josPipeFilters || {};
    return cards.filter(function (c) {
      var sid = getCardStageId(c);
      if (f.stage && f.stage !== 'all' && sid !== f.stage) return false;
      if (f.source && f.source !== 'all' && String(c.source || '') !== f.source) return false;
      if (f.service && f.service !== 'all' && String(c.service || '') !== f.service) return false;
      var amt = Number(c.amount) || 0;
      if (f.valueMin && amt < Number(f.valueMin)) return false;
      if (f.valueMax && amt > Number(f.valueMax)) return false;
      if (!q) return true;
      var blob = [c.name, c.phone, c.email, c.service, c.vehicle, c.source, sid, srcLabel(c.source)].join(' ').toLowerCase();
      return blob.indexOf(q) !== -1;
    });
  }

  function pipeActivityItems(card) {
    var items = [];
    if (!card) return items;
    if (card.date) items.push({ type: 'date', label: 'Last touch · ' + (String(card.date).length === 10 ? dateLong(card.date) : card.date), at: '' });
    if (card.service) items.push({ type: 'svc', label: card.service, at: card.vehicle || '' });
    if (card.amount != null && Number(card.amount)) items.push({ type: 'val', label: 'Value ' + money(card.amount), at: pipeStageLabel(getCardStageId(card)) });
    if (card.leadKey && card.meta && card.meta.activity) {
      (card.meta.activity || []).slice(0, 4).forEach(function (a) {
        items.push({ type: 'act', label: a.label || a.type || 'Activity', at: a.at || '' });
      });
    }
    if (!items.length) items.push({ type: 'new', label: 'New in pipeline', at: pipeStageLabel(getCardStageId(card)) });
    return items.slice(0, 6);
  }

  function pipeAiBody(card) {
    if (!card) return 'Select a deal to see AI next steps.';
    var sid = getCardStageId(card);
    var map = {
      lead: 'Qualify quickly — confirm vehicle, service, and timeline. Offer a same-week slot.',
      qualified: 'Send a clear package quote with good / better / best options.',
      quote: 'Follow up within 24h. Nudge with a hold on the mid-tier package.',
      booked: 'Confirm details and suggest one add-on before the job.',
      completed: 'Ask for a review while the experience is fresh.',
      review: 'Send a short review link and thank-you note.',
      membership: 'Pitch recurring value — priority scheduling and member pricing.'
    };
    return map[sid] || 'Move this deal forward with a personal follow-up.';
  }

  function renderPipelineFilterDrawer(root) {
    var f = root._josPipeFilters || {};
    var d = DS();
    function opt(list, cur, allLabel) {
      return '<option value="all"' + (!cur || cur === 'all' ? ' selected' : '') + '>' + (allLabel || 'All') + '</option>' +
        list.map(function (v) {
          return '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(v) + '</option>';
        }).join('');
    }
    var services = [];
    buildPipelineCards().forEach(function (c) { if (c.service && services.indexOf(c.service) === -1) services.push(c.service); });
    var body =
      '<div class="jos-pipe-filter-grid">' +
      '<label>Stage<select id="jos-pf-stage">' + opt(PIPE_STAGES.map(function (s) { return s.id; }), f.stage) + '</select></label>' +
      '<label>Source<select id="jos-pf-source">' + opt(['google', 'facebook', 'instagram', 'hubly', 'website', 'chat', 'quote', 'manual'], f.source) + '</select></label>' +
      '<label>Service<select id="jos-pf-service">' + opt(services, f.service) + '</select></label>' +
      '<label>Value min<input id="jos-pf-vmin" type="number" value="' + esc(f.valueMin || '') + '" placeholder="0"></label>' +
      '<label>Value max<input id="jos-pf-vmax" type="number" value="' + esc(f.valueMax || '') + '" placeholder="9999"></label>' +
      '</div>';
    if (d && d.filterDrawer) {
      return d.filterDrawer({ open: !!root._josPipeFilterOpen, actPrefix: 'pipe-filter', id: 'jos-pipe-filter', title: 'Pipeline filters', bodyHtml: body });
    }
    if (!root._josPipeFilterOpen) return '';
    return '<div class="jos-ds-drawer jos-cust-drawer" id="jos-pipe-filter"><div class="jos-between"><div class="jos-kicker">Filters</div>' +
      dsBtn('pipe-filter-close', 'Close', 'jos-btn jos-btn-sm') + '</div><div class="jos-ds-drawer-body jos-mt">' + body + '</div>' +
      '<div class="jos-btn-row jos-mt">' + dsBtn('pipe-filter-apply', 'Apply', 'jos-btn-brand jos-btn-sm') +
      dsBtn('pipe-filter-reset', 'Reset', 'jos-btn jos-btn-sm') + dsBtn('pipe-filter-save', 'Save Filter', 'jos-btn jos-btn-sm') + '</div></div>';
  }

  function renderPipelineKpis(cards) {
    var d = DS();
    var totalVal = cards.reduce(function (s, c) { return s + (Number(c.amount) || 0); }, 0);
    var open = cards.filter(function (c) { var i = pipeStageIndex(getCardStageId(c)); return i >= 0 && i < 4; }).length;
    var won = cards.filter(function (c) { return /completed|review|membership/.test(getCardStageId(c)); }).length;
    var tiles = [
      d ? d.metricCard('Open deals', String(open), 'Lead through Quote') : '<div class="jos-kpi"><div class="jos-kpi-lbl">Open deals</div><div class="jos-kpi-v">' + open + '</div></div>',
      d ? d.metricCard('Pipeline value', money(totalVal) || '$0', 'All visible cards') : '<div class="jos-kpi"><div class="jos-kpi-lbl">Pipeline value</div><div class="jos-kpi-v">' + esc(money(totalVal) || '$0') + '</div></div>',
      d ? d.metricCard('Won / recurring', String(won), 'Completed · Review · Membership') : '<div class="jos-kpi"><div class="jos-kpi-lbl">Won / recurring</div><div class="jos-kpi-v">' + won + '</div></div>',
      d ? d.metricCard('Stages', String(PIPE_STAGES.length), 'Sales engine') : '<div class="jos-kpi"><div class="jos-kpi-lbl">Stages</div><div class="jos-kpi-v">' + PIPE_STAGES.length + '</div></div>'
    ];
    return '<div class="jos-kpi-row jos-pipe-kpis">' + tiles.join('') + '</div>';
  }

  function renderPipelineBoard(cards, selectedId) {
    return '<div class="jos-pipe-board-wrap"><div class="jos-pipe-board">' + PIPE_STAGES.map(function (st) {
      var rows = cards.filter(function (c) { return getCardStageId(c) === st.id; });
      return '<div class="jos-pipe-col" data-pipe-stage="' + esc(st.id) + '"><div class="jos-pipe-col-h"><div class="jos-between"><div class="jos-pipe-title"><span class="jos-pipe-dot ' + esc(st.dot) + '"></span>' + esc(st.label) +
        '<span class="jos-pipe-count">' + rows.length + '</span></div></div><div class="jos-muted" style="font-size:11px">' + esc(money(rows.reduce(function (s, c) { return s + (Number(c.amount) || 0); }, 0)) || '$0') + '</div></div><div class="jos-pipe-col-body">' +
        (rows.length ? rows.map(function (c) { return pipeCardHtml(c, selectedId); }).join('') : '<div class="jos-pipe-empty">No cards</div>') + '</div></div>';
    }).join('') + '</div></div>';
  }

  function renderPipelineDetail(root, card) {
    var d = DS();
    if (!card) {
      var empty = d ? d.emptyState('Select a deal', 'Click a card to preview contact, stage, and AI next steps.') : '<div class="jos-pipe-detail-empty">Select a deal to preview details.</div>';
      return '<div class="jos-pipe-detail">' + empty + '</div>';
    }
    var sid = getCardStageId(card);
    var idx = pipeStageIndex(sid);
    var prev = idx > 0 ? PIPE_STAGES[idx - 1].id : null;
    var next = idx < PIPE_STAGES.length - 1 ? PIPE_STAGES[idx + 1].id : null;
    var hdr = d ? d.profileHeader({ name: card.name, meta: [card.phone, card.email, card.service].filter(Boolean).join(' · '), initials: initials(card.name) }) : '<strong>' + esc(card.name) + '</strong>';
    var badge = d ? d.statusBadge(pipeStageLabel(sid), sid === 'booked' ? 'booked' : (sid === 'completed' ? 'won' : 'info')) : esc(pipeStageLabel(sid));
    var ai = d ? d.aiInsightCard({ kicker: 'AI · Next action', body: root._josPipeAiBody || pipeAiBody(card), actionsHtml: dsBtn('pipe-ai-refresh', 'Refresh', 'jos-btn jos-btn-sm') }) :
      '<div class="jos-ai"><div class="sk">AI · Next action</div><p style="font-size:13px;margin-top:6px">' + esc(root._josPipeAiBody || pipeAiBody(card)) + '</p></div>';
    var feed = d ? d.activityFeed(pipeActivityItems(card), 'No activity yet') : '<div class="jos-muted">No activity yet</div>';
    var stagePick = '<div class="jos-pipe-stage-pick">' + PIPE_STAGES.map(function (s) {
      return '<button type="button" class="jos-btn jos-btn-sm' + (s.id === sid ? ' jos-btn-brand' : '') + '" data-jos-act="pipe-stage-set" data-pipe-stage="' + esc(s.id) + '">' + esc(s.label) + '</button>';
    }).join('') + '</div>';
    var actions = d ? d.actionToolbar(
      (prev ? dsBtn('pipe-stage-prev', '← ' + pipeStageLabel(prev), 'jos-btn jos-btn-sm') : '') +
      (next ? dsBtn('pipe-stage-next', pipeStageLabel(next) + ' →', 'jos-btn jos-btn-sm') : '') +
      dsBtn('pipe-open-lead', 'Open lead', 'jos-btn jos-btn-sm') +
      dsBtn('pipe-open-customer', 'Customer profile', 'jos-btn-brand jos-btn-sm') +
      dsBtn('pipe-create-quote', 'Quote', 'jos-btn jos-btn-sm') +
      dsBtn('pipe-book-job', 'Book job', 'jos-btn jos-btn-sm') +
      dsBtn('pipe-request-review', 'Request review', 'jos-btn jos-btn-sm') +
      dsBtn('pipe-offer-membership', 'Membership', 'jos-btn jos-btn-sm') +
      dsBtn('pipe-archive', 'Archive', 'jos-btn jos-btn-sm')
    ) : '<div class="jos-btn-row jos-mt">' + dsBtn('pipe-open-customer', 'Customer profile', 'jos-btn-brand jos-btn-sm') + '</div>';
    var sec = d ? d.sectionHeader('Detail', 'Deal workspace') : '<div class="jos-kicker">Detail</div>';
    return '<div class="jos-pipe-detail">' + sec +
      '<div class="jos-mt">' + hdr + '</div>' +
      '<div class="jos-mt">' + badge + (card.amount != null ? ' <span class="jos-pipe-amt">' + esc(money(card.amount)) + '</span>' : '') + '</div>' +
      '<div class="jos-mt">' + ai + '</div>' +
      '<div class="jos-mt"><div class="jos-kicker">Activity</div>' + feed + '</div>' +
      '<div class="jos-mt"><div class="jos-kicker">Stage</div>' + stagePick + '</div>' +
      '<div class="jos-mt">' + actions + '</div></div>';
  }

  function renderPipelinePageInner(root) {
    ensurePipelineOsState();
    var all = buildPipelineCards();
    var cards = filterPipelineCards(root, all);
    root._josCards = all;
    var selectedId = root._josPipeId;
    if (selectedId && !cards.some(function (c) { return String(c.id) === String(selectedId); })) {
      selectedId = cards[0] ? cards[0].id : null;
      root._josPipeId = selectedId;
    }
    if (!selectedId && cards[0]) { selectedId = cards[0].id; root._josPipeId = selectedId; }
    var sel = selectedId ? all.find(function (c) { return String(c.id) === String(selectedId); }) : null;
    var d = DS();
    var head = d ? d.pageHeader('Pipeline', 'Sales engine — inquiry to membership.', dsBtn('manual-lead', '+ Add Lead', 'jos-btn jos-btn-sm') + dsBtn('smart-quote', 'Quick Quote', 'jos-btn-brand jos-btn-sm')) :
      '<div class="jos-page-head"><div><h1>Pipeline</h1><p>Sales engine — inquiry to membership.</p></div><div class="jos-page-actions">' + dsBtn('manual-lead', '+ Add Lead', 'jos-btn jos-btn-sm') + dsBtn('smart-quote', 'Quick Quote', 'jos-btn-brand jos-btn-sm') + '</div></div>';
    var search = d ? d.searchBar('jos-pipe-search', 'Search name, phone, service, vehicle, source, stage…', root._josPipeQ || '') :
      '<label class="jos-ds-search"><input id="jos-pipe-search" type="search" placeholder="Search…" value="' + esc(root._josPipeQ || '') + '"></label>';
    root.innerHTML =
      '<div class="jos-page jos-pipe-page">' +
      head +
      '<div class="jos-pipe-toolbar">' + search + dsBtn('pipe-filter-open', 'Filters', 'jos-btn jos-btn-sm') + dsBtn('go-ask', 'Ask Hubly', 'jos-btn jos-btn-sm') + '</div>' +
      renderPipelineFilterDrawer(root) +
      renderPipelineKpis(cards) +
      '<div class="jos-pipe-layout">' +
        renderPipelineBoard(cards, selectedId) +
        renderPipelineDetail(root, sel) +
      '</div></div>';
    bindRoot(root);
    wirePipelineRoot(root);
  }

  function renderPipeline() {
    var root = ownPixelView('v-pipeline', 'jos-pipeline-root');
    if (!root) return;
    updateChrome('pipeline');
    root.innerHTML = '<div class="jos-page jos-pipe-page"><div class="jos-home-loading">Loading Pipeline…</div></div>';
    try { renderPipelinePageInner(root); }
    catch (err) {
      console.warn('HublyJourneyOS Pipeline', err);
      root.innerHTML = '<div class="jos-page"><div class="jos-empty jos-error-state"><strong>Pipeline could not load</strong><p class="jos-muted">Refresh and try again.</p><div class="jos-mt"><button type="button" class="jos-btn jos-btn-brand jos-btn-sm" onclick="HublyJourneyOS.renderPipeline()">Retry</button></div></div></div>';
    }
  }

  function selectedPipeCard() {
    var root = el('jos-pipeline-root');
    if (!root || !root._josPipeId) return null;
    return (root._josCards || []).find(function (c) { return String(c.id) === String(root._josPipeId); }) || null;
  }

  function movePipeCard(cardId, stageId, msg) {
    if (!cardId || !stageId) return;
    setCardStageId(cardId, stageId);
    var root = el('jos-pipeline-root');
    if (root) {
      root._josPipeId = cardId;
      renderPipeline();
      if (msg !== false) toast(msg || ('Moved to ' + pipeStageLabel(stageId)));
    }
  }

  function wirePipelineRoot(root) {
    if (root._josPipeBound) return;
    root._josPipeBound = true;
    root.addEventListener('click', function (e) {
      var card = e.target.closest('[data-jos-pipe-card]');
      if (card && !e.target.closest('[data-jos-act]')) {
        root._josPipeId = card.getAttribute('data-jos-pipe-card');
        renderPipeline();
        e.stopPropagation();
      }
    });
    root.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'jos-pipe-search') {
        root._josPipeQ = e.target.value;
        clearTimeout(root._josPipeSearchT);
        root._josPipeSearchT = setTimeout(function () { renderPipeline(); }, 140);
      }
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (root._josPipeFilterOpen) { root._josPipeFilterOpen = false; return renderPipeline(); }
        if (root._josPipeQ) {
          root._josPipeQ = '';
          var inp = el('jos-pipe-search');
          if (inp) inp.value = '';
          return renderPipeline();
        }
      }
    });
    root.addEventListener('dragstart', function (e) {
      var card = e.target.closest('[data-jos-pipe-card]');
      if (!card) return;
      root._josPipeDragId = card.getAttribute('data-jos-pipe-card');
      try { e.dataTransfer.setData('text/plain', root._josPipeDragId); e.dataTransfer.effectAllowed = 'move'; } catch (err) {}
    });
    root.addEventListener('dragover', function (e) {
      var col = e.target.closest('[data-pipe-stage]');
      if (!col) return;
      e.preventDefault();
      col.classList.add('drop-target');
    });
    root.addEventListener('dragleave', function (e) {
      var col = e.target.closest('[data-pipe-stage]');
      if (col) col.classList.remove('drop-target');
    });
    root.addEventListener('drop', function (e) {
      var col = e.target.closest('[data-pipe-stage]');
      root.querySelectorAll('.jos-pipe-col.drop-target').forEach(function (n) { n.classList.remove('drop-target'); });
      if (!col) return;
      e.preventDefault();
      var id = root._josPipeDragId;
      try { id = id || e.dataTransfer.getData('text/plain'); } catch (err) {}
      var stageId = col.getAttribute('data-pipe-stage');
      if (id && stageId) movePipeCard(id, stageId);
    });
  }

  function handlePipelineAct(act, t) {
    var root = el('jos-pipeline-root');
    if (!root) return;
    ensurePipelineOsState();
    var card = selectedPipeCard();
    var stageId = t && t.getAttribute ? t.getAttribute('data-pipe-stage') : null;
    try {
      if (act === 'pipe-filter-open') { root._josPipeFilterOpen = true; return renderPipeline(); }
      if (act === 'pipe-filter-close') { root._josPipeFilterOpen = false; return renderPipeline(); }
      if (act === 'pipe-filter-apply' || act === 'pipe-filter-save') {
        root._josPipeFilters = {
          stage: (el('jos-pf-stage') || {}).value || 'all',
          source: (el('jos-pf-source') || {}).value || 'all',
          service: (el('jos-pf-service') || {}).value || 'all',
          valueMin: (el('jos-pf-vmin') || {}).value || '',
          valueMax: (el('jos-pf-vmax') || {}).value || ''
        };
        root._josPipeFilterOpen = false;
        if (act === 'pipe-filter-save') toast('Filter saved (session)');
        return renderPipeline();
      }
      if (act === 'pipe-filter-reset') {
        root._josPipeFilters = {};
        root._josPipeFilterOpen = false;
        return renderPipeline();
      }
      if (act === 'pipe-stage-set' && stageId && card) return movePipeCard(card.id, stageId);
      if (act === 'pipe-stage-prev' && card) {
        var pi = pipeStageIndex(getCardStageId(card));
        if (pi > 0) return movePipeCard(card.id, PIPE_STAGES[pi - 1].id);
        return;
      }
      if (act === 'pipe-stage-next' && card) {
        var ni = pipeStageIndex(getCardStageId(card));
        if (ni < PIPE_STAGES.length - 1) return movePipeCard(card.id, PIPE_STAGES[ni + 1].id);
        return;
      }
      if (act === 'pipe-open-lead') {
        if (card && card.leadKey && typeof global.viewLead === 'function') return global.viewLead(card.leadKey);
        if (card && card.leadKey) return toast('Open lead · ' + (card.name || ''));
        return toast('Stage 2 · not connected');
      }
      if (act === 'pipe-open-customer') {
        if (card && card.customerId) return openCustomerProfile(card.customerId);
        if (card && card.customerName) {
          var c = customers().find(function (x) { return x.name === card.customerName; });
          if (c) return openCustomerProfile(c.id);
        }
        if (card && card.leadKey) {
          var lead = collectLeads().find(function (l) { return (l.key || l.id) === card.leadKey; });
          if (lead && lead.matchedCustomer && lead.matchedCustomer.id) return openCustomerProfile(lead.matchedCustomer.id);
        }
        return toast('Link a customer record first');
      }
      if (act === 'pipe-create-quote') {
        if (typeof global.openSmartQuote === 'function') return global.openSmartQuote();
        return toast('Quick Quote');
      }
      if (act === 'pipe-book-job') {
        if (card && card.customerId && typeof global.openNewJobForCustomer === 'function') return global.openNewJobForCustomer(card.customerId);
        return typeof global.openM === 'function' ? global.openM('m-new-job') : toast('Book job');
      }
      if (act === 'pipe-request-review') {
        if (card) movePipeCard(card.id, 'review', 'Review request queued (OS)');
        return;
      }
      if (act === 'pipe-offer-membership') {
        if (card) movePipeCard(card.id, 'membership', 'Membership offer noted (OS)');
        return;
      }
      if (act === 'pipe-archive') {
        if (card) {
          setCardStageId(card.id, 'lead');
          root._josPipeId = null;
          toast('Archived from pipeline view');
          return renderPipeline();
        }
        return;
      }
      if (act === 'pipe-ai-refresh') {
        root._josPipeAiBody = pipeAiBody(card) + ' · Refreshed ' + new Date().toLocaleTimeString();
        return renderPipeline();
      }
      if (act === 'pipe-crm-sync') return toast('Stage 2 · not connected');
    } catch (err) {
      console.warn('HublyJourneyOS pipe act', act, err);
      toast('Pipeline action failed');
    }
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

  var AH_TABS = [
    ['chat', 'Chat'],
    ['actions', 'Actions'],
    ['memory', 'Memory'],
    ['automations', 'Automations'],
    ['context', 'Context'],
    ['activity', 'Activity']
  ];
  var AH_ACTION_CATALOG = {
    create_job: { label: 'Create job', requiresConfirm: true, desc: 'Adds a minimal Jobs-owned job stub.' },
    create_quote: { label: 'Create quote', requiresConfirm: true, desc: 'Creates a draft quote when a quote owner array exists.' },
    draft_campaign: { label: 'Draft campaign', requiresConfirm: false, desc: 'Adds a Marketing-owned draft campaign.' },
    send_campaign: { label: 'Send campaign', requiresConfirm: true, desc: 'Marks a Marketing OS campaign sent in Stage 1.' },
    update_website: { label: 'Update website', requiresConfirm: true, desc: 'Saves a Storefront-owned AI copy suggestion.' },
    publish_website: { label: 'Publish website', requiresConfirm: true, desc: 'Records a Stage 1 publish signal.' },
    schedule_followup: { label: 'Schedule follow-up', requiresConfirm: true, desc: 'Creates a confirmed follow-up note/task signal.' },
    cancel_membership: { label: 'Cancel membership', requiresConfirm: true, desc: 'Cancels a Memberships-owned subscriber when available.' },
    refund_payment: { label: 'Refund payment', requiresConfirm: true, desc: 'Guarded: never runs silently.' },
    delete_customer: { label: 'Delete customer', requiresConfirm: true, desc: 'Guarded: never runs silently.' },
    change_pricing: { label: 'Change pricing', requiresConfirm: true, desc: 'Guarded: never runs silently.' },
    generate_draft: { label: 'Generate draft', requiresConfirm: false, desc: 'Creates draft text in the conversation.' },
    explain_report: { label: 'Explain report', requiresConfirm: false, desc: 'Explains live owner aggregates.' },
    summarize_customer: { label: 'Summarize customer', requiresConfirm: false, desc: 'Summarizes one customer from owner refs.' },
    suggest_followups: { label: 'Suggest follow-ups', requiresConfirm: false, desc: 'Suggests follow-ups without mutating owners.' },
    generate_report: { label: 'Generate report', requiresConfirm: false, desc: 'Refreshes analytics/report aggregate signals.' }
  };
  var AH_HARD_GUARDS = {
    refund_payment: true,
    delete_customer: true,
    change_pricing: true,
    publish_website: true
  };

  function ahId(prefix) { return (prefix || 'ah') + '_' + Math.random().toString(36).slice(2, 9); }
  function ahNow() { return new Date().toISOString(); }
  function ahAction(type) {
    return AH_ACTION_CATALOG[type] || { label: type || 'Action', requiresConfirm: true, desc: 'Unknown mutating action.' };
  }
  /** Explicit propose act strings so routes remain greppable for MAT. */
  function ahProposeAct(type) {
    var map = {
      create_job: 'ah-propose-create-job',
      create_quote: 'ah-propose-create-quote',
      draft_campaign: 'ah-propose-draft-campaign',
      send_campaign: 'ah-propose-send-campaign',
      update_website: 'ah-propose-update-website',
      publish_website: 'ah-propose-publish-website',
      schedule_followup: 'ah-propose-schedule-followup',
      cancel_membership: 'ah-propose-cancel-membership',
      refund_payment: 'ah-propose-refund-payment',
      delete_customer: 'ah-propose-delete-customer',
      change_pricing: 'ah-propose-change-pricing',
      generate_draft: 'ah-propose-generate-draft',
      explain_report: 'ah-propose-explain-report',
      summarize_customer: 'ah-propose-summarize-customer',
      suggest_followups: 'ah-propose-suggest-followups',
      generate_report: 'ah-propose-generate-report'
    };
    return map[type] || ('ah-propose-' + String(type || '').replace(/_/g, '-'));
  }
  function ahPublish(type, payload) {
    var ev = hublyEvents();
    if (ev && typeof ev.publish === 'function') ev.publish(type, payload || {});
  }
  function ensureAskHublyOsState() {
    var st = S();
    if (!st.askHublyOs || typeof st.askHublyOs !== 'object') st.askHublyOs = {};
    var os = st.askHublyOs;
    ['customers', 'payments', 'jobs', 'leads', 'campaigns'].forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(os, key)) delete os[key];
    });
    if (!Array.isArray(os.conversations)) os.conversations = [];
    if (!Array.isArray(os.memory)) os.memory = [];
    if (!Array.isArray(os.actions)) os.actions = [];
    if (!Array.isArray(os.pending)) os.pending = [];
    if (!Array.isArray(os.automations)) os.automations = [];
    if (!os.prefs || typeof os.prefs !== 'object') os.prefs = {};
    if (os.prefs.confirmHighImpact == null) os.prefs.confirmHighImpact = true;
    if (!Array.isArray(os.activity)) os.activity = [];
    if (!os._seeded) {
      var now = ahNow();
      os.conversations.push({
        id: ahId('ah_conv'),
        title: 'Operating briefing',
        messages: [{ role: 'assistant', text: 'Ask me about customers, jobs, revenue, reports, marketing, memberships, reviews, or your website. I will ask for confirmation before high-impact changes.', at: now }],
        updatedAt: now
      });
      os.memory.push({ id: ahId('ah_mem'), kind: 'system', text: 'Ask Hubly Stage 1 reads owner summaries and queues high-impact writes for confirmation.', refs: { module: 'ask' }, at: now });
      os.activity.push({ id: ahId('ah_act'), type: 'system', label: 'Ask Hubly OS initialized', at: now, payload: { rule: 'Rule #22' } });
      os._seeded = true;
    }
    os.pending = os.pending.filter(function (p) { return p && p.status !== 'cancelled' && p.status !== 'executed'; });
    return os;
  }
  function ahPushActivity(type, label, payload) {
    var os = ensureAskHublyOsState();
    os.activity.push({ id: ahId('ah_act'), type: type, label: label, at: ahNow(), payload: payload ? Object.assign({}, payload) : {} });
  }
  function ahLogAction(status, type, payload, note, pendingId) {
    var cat = ahAction(type), os = ensureAskHublyOsState();
    var entry = {
      id: ahId('ah_log'),
      actionType: type,
      label: cat.label,
      status: status,
      requiresConfirm: !!cat.requiresConfirm,
      pendingId: pendingId || null,
      payload: payload ? Object.assign({}, payload) : {},
      note: note || '',
      at: ahNow()
    };
    os.actions.push(entry);
    return entry;
  }
  function ahConversation() {
    var os = ensureAskHublyOsState();
    var root = el('jos-ask-root');
    var id = root && root._josAhConvId;
    var conv = id && os.conversations.find(function (c) { return String(c.id) === String(id); });
    if (!conv) conv = os.conversations[os.conversations.length - 1];
    if (!conv) {
      conv = { id: ahId('ah_conv'), title: 'Ask Hubly', messages: [], updatedAt: ahNow() };
      os.conversations.push(conv);
    }
    if (root) root._josAhConvId = conv.id;
    return conv;
  }
  function ahAddMessage(role, text) {
    var conv = ahConversation();
    conv.messages.push({ role: role, text: String(text || ''), at: ahNow() });
    conv.updatedAt = ahNow();
    if (role === 'user' && (!conv.title || conv.title === 'Ask Hubly' || conv.title === 'Operating briefing')) conv.title = String(text || 'Ask Hubly').slice(0, 54);
    return conv;
  }
  function ahMemoryNote(kind, text, refs) {
    var os = ensureAskHublyOsState();
    os.memory.push({ id: ahId('ah_mem'), kind: kind || 'note', text: String(text || ''), refs: refs || { module: 'ask' }, at: ahNow() });
  }
  function ahAutomationAllowed(type) {
    return ensureAskHublyOsState().automations.some(function (a) {
      return a && a.allowed === true && String(a.actionType) === String(type);
    });
  }
  function ahEventPayload(type, payload, actionId) {
    payload = payload || {};
    return {
      actionType: type,
      actionId: actionId || null,
      customerId: payload.customerId || null,
      jobId: payload.jobId || null,
      campaignId: payload.campaignId || null,
      reportId: payload.reportId || null,
      label: payload.label || ahAction(type).label
    };
  }
  function ahDefaultCustomer() {
    var st = S(), active = st.activeCustId;
    return (active && customers().find(function (c) { return String(c.id) === String(active); })) || customers()[0] || null;
  }
  function ahCustomerName(id) {
    var c = customers().find(function (x) { return String(x.id) === String(id); });
    return c ? c.name : 'Customer';
  }
  function ahOwnerContext() {
    var ag = null;
    try { if (typeof rptAggregates === 'function') ag = rptAggregates(); } catch (e) {}
    var st = S(), m = st.marketingOs && typeof st.marketingOs === 'object' ? st.marketingOs : {};
    var mem = st.membershipsOs && typeof st.membershipsOs === 'object' ? st.membershipsOs : {};
    var rev = st.reviewsOs && typeof st.reviewsOs === 'object' ? st.reviewsOs : {};
    var website = st.website && typeof st.website === 'object' ? st.website : {};
    return {
      customers: { total: customers().length },
      leads: { total: collectLeads().length },
      jobs: { total: jobs().filter(function (j) { return j && !j.isBlock; }).length, active: jobs().filter(jobActive).length },
      quotes: { total: quotes().length },
      revenue: { total: ag ? ag.revenue.total : jobs().filter(function (j) { return j.status === 'completed'; }).reduce(function (sum, j) { return sum + (Number(j.amount) || 0); }, 0), outstanding: ag ? ag.revenue.outstanding : 0 },
      reports: { dashboards: st.reportsOs && Array.isArray(st.reportsOs.dashboards) ? st.reportsOs.dashboards.length : 0 },
      marketing: { campaigns: Array.isArray(m.campaigns) ? m.campaigns.length : 0, active: Array.isArray(m.campaigns) ? m.campaigns.filter(function (c) { return c.status === 'active' || c.status === 'scheduled'; }).length : 0 },
      reviews: { count: Array.isArray(rev.reviews) ? rev.reviews.length : (Array.isArray(website.manualReviews) ? website.manualReviews.length : 0), rating: rev.analytics && rev.analytics.rating ? rev.analytics.rating : (website.reviewRating || 0) },
      memberships: { plans: Array.isArray(mem.plans) ? mem.plans.length : 0, active: Array.isArray(mem.subscribers) ? mem.subscribers.filter(function (s) { return s.status !== 'cancelled' && s.status !== 'paused'; }).length : 0 },
      services: { total: Array.isArray(st.editorSvcs) ? st.editorSvcs.filter(function (s) { return s && s.status !== 'archived'; }).length : 0 }
    };
  }
  function ahContextLine() {
    var c = ahOwnerContext();
    return c.customers.total + ' customers, ' + c.leads.total + ' leads, ' + c.jobs.active + ' active jobs, ' + (money(c.revenue.total) || '$0') + ' collected, ' + c.marketing.active + ' active campaigns, ' + c.memberships.active + ' active memberships.';
  }
  function ahFollowupText() {
    var rows = [];
    collectLeads().slice(0, 2).forEach(function (l) { rows.push((l.name || 'Lead') + ' - open lead for ' + (l.service || 'service')); });
    customers().slice(0, 2).forEach(function (c) { rows.push((c.name || 'Customer') + ' - rebook or review nudge'); });
    jobs().filter(function (j) { return j.status === 'completed' && !j.reviewRequested; }).slice(0, 1).forEach(function (j) { rows.push((j.customer || 'Customer') + ' - ask for a review after ' + (j.service || 'job')); });
    if (!rows.length) rows.push('No urgent owner records found. Start with a friendly rebook message to recent customers.');
    return 'Suggested follow-ups: ' + rows.join('; ') + '.';
  }
  function ahPayloadFor(type) {
    var cust = ahDefaultCustomer();
    var st = S(), label = ahAction(type).label;
    var payload = { label: label };
    if (cust) { payload.customerId = cust.id; payload.customerLabel = cust.name; }
    if (type === 'create_job') return Object.assign(payload, { service: 'AI scheduled service', date: todayStr(), note: 'Created from Ask Hubly proposal' });
    if (type === 'create_quote') return Object.assign(payload, { service: 'AI draft quote', amount: 0 });
    if (type === 'draft_campaign') return Object.assign(payload, { name: 'Ask Hubly win-back draft', channel: 'email', body: 'We miss you - book this week for a fresh detail.' });
    if (type === 'send_campaign') {
      var camp = st.marketingOs && Array.isArray(st.marketingOs.campaigns) && st.marketingOs.campaigns.find(function (c) { return c.status === 'draft' || c.status === 'scheduled' || c.status === 'active'; });
      if (camp) payload.campaignId = camp.id;
      payload.label = camp ? ('Send campaign ' + (camp.name || camp.id)) : 'Send campaign';
      return payload;
    }
    if (type === 'update_website') return Object.assign(payload, { field: 'heroHeadline', value: 'Book a detail that feels effortless' });
    if (type === 'publish_website') return Object.assign(payload, { websiteId: st.slug || 'site', label: 'Publish website' });
    if (type === 'schedule_followup') return Object.assign(payload, { followupText: 'Check in and offer a rebook window', dueAt: todayStr() });
    if (type === 'cancel_membership') {
      var sub = st.membershipsOs && Array.isArray(st.membershipsOs.subscribers) && st.membershipsOs.subscribers.find(function (s) { return s.status !== 'cancelled'; });
      if (sub) payload.subscriberId = sub.id;
      return payload;
    }
    if (type === 'refund_payment') return Object.assign(payload, { amount: 0, label: 'Prepare refund request' });
    if (type === 'delete_customer') return Object.assign(payload, { label: 'Delete customer request' });
    if (type === 'change_pricing') return Object.assign(payload, { serviceId: null, label: 'Change pricing request' });
    if (type === 'generate_report') return Object.assign(payload, { metricKeys: ['revenue_collected', 'jobs_completed', 'active_members', 'review_rating'] });
    return payload;
  }
  function ahDraftText(payload) {
    payload = payload || {};
    return payload.text || 'Draft: Hi ' + (payload.customerLabel || 'there') + ', we have a few openings this week if you want to refresh your vehicle. Reply with a day that works and we will hold a spot.';
  }
  function ahApplyAction(type, payload, source) {
    payload = payload || {};
    var st = S(), result = { label: ahAction(type).label, draft: false };
    if (type === 'create_job') {
      if (Array.isArray(st.jobs)) {
        var cust = payload.customerId && customers().find(function (c) { return String(c.id) === String(payload.customerId); });
        var job = {
          id: ahId('job_ai'),
          customerId: payload.customerId || null,
          customer: cust ? cust.name : (payload.customerLabel || 'Customer'),
          service: payload.service || 'AI scheduled service',
          date: payload.date || todayStr(),
          time: payload.time || '9:00 AM',
          status: 'scheduled',
          amount: Number(payload.amount) || 0,
          createdAt: ahNow(),
          internalNotes: ['Created by Ask Hubly after confirmation'],
          timeline: [{ type: 'created', label: 'Created by Ask Hubly', at: new Date().toLocaleString() }]
        };
        st.jobs.push(job);
        result.jobId = job.id;
        result.label = 'Job created in Jobs OS';
        ahPublish('job.booked', { jobId: job.id, customerId: job.customerId, source: 'ask_hubly' });
      } else result.label = 'Job creation queued for Jobs OS';
      toast(result.label);
      return result;
    }
    if (type === 'create_quote') {
      var quote = { id: ahId('quote_ai'), customerId: payload.customerId || null, status: 'draft', service: payload.service || 'AI draft quote', amount: Number(payload.amount) || 0, createdAt: ahNow(), source: 'ask_hubly' };
      if (Array.isArray(st.smartQuotes)) { st.smartQuotes.push(quote); result.quoteId = quote.id; result.label = 'Draft quote created'; }
      else if (Array.isArray(st.quotes)) { st.quotes.push(quote); result.quoteId = quote.id; result.label = 'Draft quote created'; }
      else result.label = 'Draft quote prepared for Quotes OS';
      toast(result.label);
      return result;
    }
    if (type === 'draft_campaign') {
      if (st.marketingOs && typeof st.marketingOs === 'object') {
        if (!Array.isArray(st.marketingOs.campaigns)) st.marketingOs.campaigns = [];
        var camp = { id: ahId('mkt_camp_ai'), name: payload.name || 'Ask Hubly campaign draft', channel: payload.channel || 'email', status: 'draft', audience: { type: 'segment', key: 'win_back' }, body: payload.body || ahDraftText(payload), stats: {}, createdAt: ahNow(), source: 'ask_hubly' };
        st.marketingOs.campaigns.push(camp);
        result.campaignId = camp.id;
        result.label = 'Campaign draft created in Marketing';
      } else result.label = 'Campaign draft generated';
      result.draft = true;
      ahAddMessage('assistant', result.label + ': ' + (payload.body || ahDraftText(payload)));
      ahMemoryNote('draft', result.label, { module: 'marketing', id: result.campaignId || null });
      toast(result.label);
      return result;
    }
    if (type === 'send_campaign') {
      var campaign = st.marketingOs && Array.isArray(st.marketingOs.campaigns) && (st.marketingOs.campaigns.find(function (c) { return String(c.id) === String(payload.campaignId); }) || st.marketingOs.campaigns.find(function (c) { return c.status === 'draft' || c.status === 'scheduled' || c.status === 'active'; }));
      if (campaign) {
        campaign.status = 'done';
        campaign.sentAt = ahNow();
        result.campaignId = campaign.id;
        result.label = 'Campaign marked sent in Marketing OS';
        ahPublish('campaign.sent', { campaignId: campaign.id, label: campaign.name || campaign.id });
      } else result.label = 'Stage 1 campaign send recorded';
      toast(result.label);
      return result;
    }
    if (type === 'update_website') {
      if (!st.website || typeof st.website !== 'object') st.website = {};
      st.website.aiDraft = { field: payload.field || 'heroHeadline', value: payload.value || 'Book a detail that feels effortless', at: ahNow(), source: 'ask_hubly' };
      result.label = 'Website copy suggestion saved in Storefront';
      toast(result.label);
      return result;
    }
    if (type === 'publish_website') {
      if (!st.website || typeof st.website !== 'object') st.website = {};
      st.website.lastAiPublishAt = ahNow();
      result.label = 'Website publish signal recorded (Stage 1)';
      toast(result.label);
      return result;
    }
    if (type === 'schedule_followup') {
      ahMemoryNote('followup', payload.followupText || 'Follow-up scheduled by Ask Hubly', { module: payload.customerId ? 'customers' : 'ask', id: payload.customerId || null });
      result.label = 'Follow-up note scheduled in Ask memory';
      toast(result.label);
      return result;
    }
    if (type === 'cancel_membership') {
      var mem = st.membershipsOs && typeof st.membershipsOs === 'object' ? st.membershipsOs : null;
      var sub = mem && Array.isArray(mem.subscribers) && mem.subscribers.find(function (s) { return String(s.id) === String(payload.subscriberId); });
      if (sub) {
        sub.status = 'cancelled';
        sub.cancelledAt = todayStr();
        result.subscriberId = sub.id;
        result.label = 'Membership cancelled in Memberships OS';
        ahPublish('membership.cancelled', { subscriberId: sub.id, customerId: sub.customerId, planId: sub.planId });
      } else result.label = 'Membership cancellation recorded for owner review';
      toast(result.label);
      return result;
    }
    if (type === 'refund_payment') {
      result.label = 'Refund request prepared for Revenue; no live refund issued in Stage 1';
      toast(result.label);
      return result;
    }
    if (type === 'delete_customer') {
      result.label = 'Customer deletion request recorded; no customer deleted by Ask Hubly Stage 1';
      toast(result.label);
      return result;
    }
    if (type === 'change_pricing') {
      result.label = 'Pricing change request recorded; Storefront pricing was not changed silently';
      toast(result.label);
      return result;
    }
    if (type === 'generate_report') {
      if (typeof publishReportGenerated === 'function') publishReportGenerated(payload.metricKeys || ['revenue_collected']);
      result.label = 'Report aggregates refreshed from owner modules';
      toast(result.label);
      return result;
    }
    if (type === 'summarize_customer') {
      var name = payload.customerId ? ahCustomerName(payload.customerId) : (ahDefaultCustomer() ? ahDefaultCustomer().name : 'Customer');
      var msg = name + ': ' + ahContextLine() + ' Next best action: send a timely rebook or review ask.';
      ahAddMessage('assistant', msg);
      ahMemoryNote('summary', msg, { module: 'customers', id: payload.customerId || null });
      result.label = 'Customer summary generated';
      result.draft = true;
      toast(result.label);
      return result;
    }
    if (type === 'explain_report') {
      var report = 'Report readout: ' + ahContextLine() + ' Reports is reading aggregates at render time and does not own operational rows.';
      ahAddMessage('assistant', report);
      ahMemoryNote('report', report, { module: 'reports' });
      result.label = 'Report explained';
      result.draft = true;
      toast(result.label);
      return result;
    }
    if (type === 'suggest_followups') {
      var follow = ahFollowupText();
      ahAddMessage('assistant', follow);
      ahMemoryNote('suggestion', follow, { module: 'customers' });
      result.label = 'Follow-up suggestions generated';
      result.draft = true;
      toast(result.label);
      return result;
    }
    if (type === 'generate_draft') {
      var draft = ahDraftText(payload);
      ahAddMessage('assistant', draft);
      ahMemoryNote('draft', draft, { module: 'ask' });
      result.label = 'Draft generated';
      result.draft = true;
      toast(result.label);
      return result;
    }
    return result;
  }
  function ahExecuteAction(type, payload, source, pendingId) {
    source = source || 'direct';
    if (AH_HARD_GUARDS[type] && source !== 'confirmed' && source !== 'automation') {
      ahPushActivity('guard.rejected', 'Rejected silent ' + ahAction(type).label, { actionType: type });
      toast('Confirmation required for ' + ahAction(type).label);
      return null;
    }
    var result = ahApplyAction(type, payload || {}, source) || {};
    var entry = ahLogAction('executed', type, Object.assign({}, payload || {}, result), result.label, pendingId);
    ahPushActivity('ai.action.executed', result.label || ('Executed ' + ahAction(type).label), ahEventPayload(type, Object.assign({}, payload || {}, result), entry.id));
    if (result.draft) ahPublish('ai.draft.generated', ahEventPayload(type, Object.assign({}, payload || {}, result), entry.id));
    else ahPublish('ai.action.executed', ahEventPayload(type, Object.assign({}, payload || {}, result), entry.id));
    return result;
  }
  function ahProposeAction(type, payload) {
    var cat = ahAction(type), os = ensureAskHublyOsState();
    payload = payload || ahPayloadFor(type);
    if (cat.requiresConfirm && !ahAutomationAllowed(type)) {
      var pending = { id: ahId('ah_pending'), actionType: type, label: cat.label, payload: Object.assign({}, payload), reason: cat.desc, status: 'pending', createdAt: ahNow() };
      os.pending.push(pending);
      ahLogAction('proposed', type, payload, cat.desc, pending.id);
      ahPushActivity('ai.action.proposed', 'Proposed ' + cat.label, ahEventPayload(type, payload, pending.id));
      ahPublish('ai.action.proposed', ahEventPayload(type, payload, pending.id));
      ahAddMessage('assistant', 'I proposed "' + cat.label + '" and moved it to Actions for confirmation.');
      var root = el('jos-ask-root');
      if (root) root._josAhTab = 'actions';
      toast('Action needs confirmation');
      renderAskHubly();
      return pending;
    }
    var source = cat.requiresConfirm ? 'automation' : 'safe';
    var res = ahExecuteAction(type, payload, source, null);
    renderAskHubly();
    return res;
  }
  function ahConfirmPending(id) {
    var os = ensureAskHublyOsState();
    var p = os.pending.find(function (x) { return String(x.id) === String(id); });
    if (!p) { toast('Pending action not found'); return; }
    p.status = 'executed';
    ahLogAction('confirmed', p.actionType, p.payload, 'User confirmed', p.id);
    ahPushActivity('ai.action.confirmed', 'Confirmed ' + p.label, ahEventPayload(p.actionType, p.payload, p.id));
    ahPublish('ai.action.confirmed', ahEventPayload(p.actionType, p.payload, p.id));
    ahExecuteAction(p.actionType, p.payload, 'confirmed', p.id);
    os.pending = os.pending.filter(function (x) { return String(x.id) !== String(id); });
    renderAskHubly();
  }
  function ahCancelPending(id) {
    var os = ensureAskHublyOsState();
    var p = os.pending.find(function (x) { return String(x.id) === String(id); });
    if (!p) { toast('Pending action not found'); return; }
    p.status = 'cancelled';
    ahLogAction('cancelled', p.actionType, p.payload, 'User cancelled', p.id);
    ahPushActivity('ai.action.cancelled', 'Cancelled ' + p.label, ahEventPayload(p.actionType, p.payload, p.id));
    ahPublish('ai.action.cancelled', ahEventPayload(p.actionType, p.payload, p.id));
    os.pending = os.pending.filter(function (x) { return String(x.id) !== String(id); });
    toast('Action cancelled');
    renderAskHubly();
  }
  function ahParseAsk(text) {
    var q = String(text || '').toLowerCase();
    if (/refund/.test(q)) return { type: 'refund_payment', payload: ahPayloadFor('refund_payment') };
    if (/delete|remove/.test(q) && /customer|client/.test(q)) return { type: 'delete_customer', payload: ahPayloadFor('delete_customer') };
    if (/change|raise|lower|update/.test(q) && /pricing|price|rate/.test(q)) return { type: 'change_pricing', payload: ahPayloadFor('change_pricing') };
    if (/publish|go live/.test(q) && /website|site|page|homepage/.test(q)) return { type: 'publish_website', payload: ahPayloadFor('publish_website') };
    if (/cancel/.test(q) && /membership|member/.test(q)) return { type: 'cancel_membership', payload: ahPayloadFor('cancel_membership') };
    if (/send|launch|blast/.test(q) && /campaign|email|sms/.test(q)) return { type: 'send_campaign', payload: ahPayloadFor('send_campaign') };
    if (/create|book|schedule|add/.test(q) && /job|appointment|booking/.test(q)) return { type: 'create_job', payload: ahPayloadFor('create_job') };
    if (/quote|estimate/.test(q) && /create|draft|send|make|new/.test(q)) return { type: 'create_quote', payload: ahPayloadFor('create_quote') };
    if (/campaign|win.?back|marketing/.test(q) && /draft|write|generate|create/.test(q)) return { type: 'draft_campaign', payload: ahPayloadFor('draft_campaign') };
    if (/website|homepage|headline|booking cta|site copy/.test(q)) return { type: 'update_website', payload: ahPayloadFor('update_website') };
    if (/follow.?up|follow up|reminder/.test(q) && /schedule|task|create/.test(q)) return { type: 'schedule_followup', payload: ahPayloadFor('schedule_followup') };
    if (/report|revenue|forecast|kpi|analytics/.test(q) && /refresh|generate|run/.test(q)) return { type: 'generate_report', payload: ahPayloadFor('generate_report') };
    if (/report|revenue|forecast|kpi|analytics/.test(q)) return { type: 'explain_report', payload: ahPayloadFor('explain_report') };
    if (/summarize|summary/.test(q) && /customer|client/.test(q)) return { type: 'summarize_customer', payload: ahPayloadFor('summarize_customer') };
    if (/follow.?up|follow up|rebook|nudge|who should/.test(q)) return { type: 'suggest_followups', payload: ahPayloadFor('suggest_followups') };
    if (/draft|write|text|email|message|membership/.test(q)) return { type: 'generate_draft', payload: ahPayloadFor('generate_draft') };
    return null;
  }
  function ahAsk(text) {
    text = String(text || '').trim();
    if (!text) return;
    ensureAskHublyOsState();
    ahAddMessage('user', text);
    var parsed = ahParseAsk(text);
    if (parsed) return ahProposeAction(parsed.type, parsed.payload);
    var answer = 'Here is the current operating context: ' + ahContextLine() + ' I can answer safely, generate drafts, or propose confirmed actions into the owning modules.';
    ahAddMessage('assistant', answer);
    ahMemoryNote('context', 'Answered owner-context question: ' + text.slice(0, 80), { module: 'ask' });
    renderAskHubly();
  }
  function ahStatusBadge(label, tone) {
    return DS() ? DS().statusBadge(label, tone || 'info') : '<span class="jos-pill ' + esc(tone || 'info') + '">' + esc(label) + '</span>';
  }
  function ahRenderHero() {
    return '<div class="jos-ask-hero jos-ah-hero"><img class="hubly-mark" src="/assets/hubly-wordmark-on-dark.png" alt="hubly" onerror="this.style.display=\'none\'">' +
      '<h1>Ask Hubly</h1><p>Your Stage 1 intelligence layer across every Operate owner. High-impact actions wait for confirmation.</p>' +
      '<div class="jos-ask-prompt"><input id="jos-ask-input" type="text" placeholder="Ask anything about your business..." onkeydown="if(event.key===\'Enter\'){window.HublyJourneyOS&&HublyJourneyOS._askFromInput()}">' +
      btn('ask-submit', 'Ask', 'jos-btn-brand') + '</div><div class="jos-ask-chips">' + ASK_CHIPS.map(function (c) { return '<button type="button" class="jos-ask-chip" data-jos-ask="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div></div>';
  }
  function ahTabsHtml(active) {
    return '<div class="jos-tabs jos-ah-tabs">' + AH_TABS.map(function (t) {
      return '<button type="button" class="jos-tab' + (active === t[0] ? ' on' : '') + '" data-jos-ah-tab="' + esc(t[0]) + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div>';
  }
  function ahContextKpis() {
    var c = ahOwnerContext();
    var cards = [
      ['Customers', c.customers.total, 'Customers owner'],
      ['Active jobs', c.jobs.active, 'Jobs owner'],
      ['Collected', money(c.revenue.total) || '$0', 'Revenue/Reports'],
      ['Campaigns', c.marketing.campaigns, 'Marketing owner']
    ];
    return '<div class="jos-ah-kpis">' + cards.map(function (x) {
      return '<div class="jos-ah-kpi"><div class="v">' + esc(x[1]) + '</div><div class="l">' + esc(x[0]) + '</div><span>' + esc(x[2]) + '</span></div>';
    }).join('') + '</div>';
  }
  function renderAhChatTab() {
    var conv = ahConversation();
    var messages = (conv.messages || []).slice(-12).map(function (m) {
      return '<div class="jos-ah-msg ' + esc(m.role || 'assistant') + '"><div class="role">' + esc(m.role || 'assistant') + '</div><div class="txt">' + esc(m.text || '') + '</div></div>';
    }).join('');
    function askItem(t, s) { return '<button type="button" class="jos-ask-item jos-ah-ask-item" data-jos-ask="' + esc(t) + '"><div>AI</div><div><strong>' + esc(t) + '</strong><span>' + esc(s) + '</span></div></button>'; }
    return ahRenderHero() + ahContextKpis() +
      '<div class="jos-ah-chat-layout jos-mt"><div class="jos-card jos-ah-thread"><div class="jos-kicker">Conversation</div><div class="jos-ah-messages">' + messages + '</div></div>' +
      '<div class="jos-stack"><div class="jos-card"><div class="jos-kicker">Popular asks</div><div class="jos-ask-list jos-mt">' + POPULAR_ASKS.map(function (p) { return askItem(p.t, p.s); }).join('') + '</div></div>' +
      '<div class="jos-card"><div class="jos-kicker">Rule #22</div><p class="jos-muted">Mutating actions enter the confirmation queue unless an exact automation allow-rule exists.</p>' + dsBtn('ah-propose-create-job', 'Demo: create job', 'jos-btn-brand jos-btn-sm') + '</div></div></div>';
  }
  function renderAhPendingCard(p) {
    return '<div class="jos-ah-pending" data-jos-ah-pending="' + esc(p.id) + '"><div><div class="jos-kicker">Pending confirmation</div><strong>' + esc(p.label || ahAction(p.actionType).label) + '</strong><p>' + esc(p.reason || '') + '</p><pre>' + esc(JSON.stringify(p.payload || {}, null, 0)) + '</pre></div>' +
      '<div class="jos-btn-row">' +
      '<button type="button" class="jos-btn jos-btn-brand jos-btn-sm" data-jos-act="ah-confirm" data-jos-ah-pending="' + esc(p.id) + '">Confirm</button>' +
      '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="ah-cancel" data-jos-ah-pending="' + esc(p.id) + '">Cancel</button></div></div>';
  }
  function renderAhActionsTab() {
    var os = ensureAskHublyOsState();
    var logs = os.actions.slice().reverse().slice(0, 18).map(function (a) {
      var tone = a.status === 'executed' ? 'ok' : (a.status === 'cancelled' ? 'warn' : 'info');
      return '<div class="jos-ah-log"><div><strong>' + esc(a.label || a.actionType) + '</strong><span>' + esc(String(a.at || '').replace('T', ' ').slice(0, 19)) + '</span></div>' + ahStatusBadge(a.status, tone) + '</div>';
    }).join('');
    var demos = ['create_job', 'create_quote', 'draft_campaign', 'send_campaign', 'update_website', 'publish_website', 'schedule_followup', 'generate_report', 'summarize_customer', 'suggest_followups', 'generate_draft'].map(function (type) {
      return dsBtn(ahProposeAct(type), ahAction(type).label, ahAction(type).requiresConfirm ? 'jos-btn jos-btn-sm' : 'jos-btn-brand jos-btn-sm');
    }).join('');
    var guarded = ['refund_payment', 'delete_customer', 'change_pricing'].map(function (type) {
      return dsBtn(ahProposeAct(type), ahAction(type).label, 'jos-btn jos-btn-sm');
    }).join('');
    return '<div class="jos-ah-2col"><div class="jos-card"><div class="jos-kicker">Confirmation queue</div><div class="jos-ah-pending-list jos-mt">' + (os.pending.length ? os.pending.map(renderAhPendingCard).join('') : (DS() ? DS().emptyState('No pending actions', 'High-impact proposals will appear here.') : '<div class="jos-empty">No pending actions.</div>')) + '</div></div>' +
      '<div class="jos-stack"><div class="jos-card"><div class="jos-kicker">Action catalog demos</div><div class="jos-btn-row jos-mt">' + demos + '</div></div><div class="jos-card"><div class="jos-kicker">Hard guards</div><p class="jos-muted">These cannot execute silently; they must enter pending or match an exact automation allow-rule.</p><div class="jos-btn-row">' + guarded + '</div></div></div></div>' +
      '<div class="jos-card jos-mt"><div class="jos-kicker">Append-only action log</div><div class="jos-ah-log-list jos-mt">' + (logs || (DS() ? DS().emptyState('No action log yet', 'Ask Hubly proposals and executions append here.') : '')) + '</div></div>';
  }
  function renderAhMemoryTab() {
    var os = ensureAskHublyOsState();
    var rows = os.memory.slice().reverse().map(function (m) {
      return '<div class="jos-ah-memory"><div class="jos-between"><strong>' + esc(m.kind || 'note') + '</strong><span class="jos-muted">' + esc(String(m.at || '').replace('T', ' ').slice(0, 19)) + '</span></div><p>' + esc(m.text || '') + '</p><div class="jos-muted">' + esc(m.refs ? JSON.stringify(m.refs) : '') + '</div></div>';
    }).join('');
    return '<div class="jos-card"><div class="jos-kicker">Memory notes</div><p class="jos-muted">Notes only: no duplicated customers, jobs, payments, leads, or campaigns.</p><div class="jos-ah-memory-add jos-mt"><input id="jos-ah-memory-input" type="text" placeholder="Add a business memory note...">' + dsBtn('ah-memory-add', 'Add memory', 'jos-btn-brand jos-btn-sm') + '</div><div class="jos-ah-memory-list jos-mt">' + rows + '</div></div>';
  }
  function renderAhAutomationsTab() {
    var os = ensureAskHublyOsState();
    var opts = Object.keys(AH_ACTION_CATALOG).map(function (type) {
      return '<option value="' + esc(type) + '">' + esc(ahAction(type).label + (ahAction(type).requiresConfirm ? ' - confirmable' : ' - safe')) + '</option>';
    }).join('');
    var rows = os.automations.map(function (a) {
      return '<div class="jos-ah-auto"><div><strong>' + esc(ahAction(a.actionType).label) + '</strong><div class="jos-muted">' + esc(a.note || 'Exact actionType allow-rule') + '</div></div>' +
        '<button type="button" class="jos-btn jos-btn-sm' + (a.allowed ? ' jos-btn-brand' : '') + '" data-jos-act="ah-auto-toggle" data-jos-ah-auto="' + esc(a.id) + '">' + (a.allowed ? 'Allowed' : 'Paused') + '</button></div>';
    }).join('');
    return '<div class="jos-ah-2col"><div class="jos-card"><div class="jos-kicker">Add allow-rule</div><p class="jos-muted">Allow-rules auto-confirm only the exact listed action type.</p><div class="jos-ah-auto-form jos-mt"><label>Action<select id="jos-ah-auto-action">' + opts + '</select></label><label>Note<input id="jos-ah-auto-note" type="text" placeholder="e.g. owner-approved daily report"></label>' + dsBtn('ah-auto-add', 'Add rule', 'jos-btn-brand jos-btn-sm') + '</div></div>' +
      '<div class="jos-card"><div class="jos-kicker">Automation allow-rules</div><div class="jos-ah-auto-list jos-mt">' + (rows || (DS() ? DS().emptyState('No allow-rules', 'Confirmed actions will queue until a rule is added.') : '')) + '</div></div></div>';
  }
  function renderAhContextTab() {
    var c = ahOwnerContext();
    var rows = [
      ['Customers', 'S.customers', c.customers.total + ' customers', 'ah-go-customers'],
      ['Leads', 'collectLeads()', c.leads.total + ' leads', 'ah-go-leads'],
      ['Jobs', 'S.jobs', c.jobs.active + ' active / ' + c.jobs.total + ' total', 'ah-go-jobs'],
      ['Revenue', 'S.revenueOs', money(c.revenue.total) || '$0', 'ah-go-money'],
      ['Reports', 'S.reportsOs', c.reports.dashboards + ' dashboards', 'ah-go-reports'],
      ['Marketing', 'S.marketingOs', c.marketing.campaigns + ' campaigns', 'ah-go-marketing'],
      ['Memberships', 'S.membershipsOs', c.memberships.active + ' active', 'ah-go-memberships'],
      ['Reviews', 'S.reviewsOs', c.reviews.count + ' reviews', 'ah-go-reviews'],
      ['Storefront', 'S.website / S.editorSvcs', c.services.total + ' services', 'ah-go-editor']
    ].map(function (r) {
      return '<tr><td><strong>' + esc(r[0]) + '</strong></td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td><td>' + dsBtn(r[3], 'Open', 'jos-btn jos-btn-sm') + '</td></tr>';
    }).join('');
    var proposals = ['create_job', 'draft_campaign', 'send_campaign', 'update_website', 'publish_website', 'generate_report'].map(function (type) {
      return dsBtn(ahProposeAct(type), ahAction(type).label, 'jos-btn jos-btn-sm');
    }).join('');
    return '<div class="jos-card"><div class="jos-kicker">Owner context map</div><p class="jos-muted">Ask Hubly reads summaries and ids from owners; it never stores operational row arrays inside S.askHublyOs.</p><div class="jos-rpt-table-wrap jos-mt"><table class="jos-rpt-table"><thead><tr><th>Module</th><th>Owner</th><th>Now</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="jos-btn-row jos-mt">' + dsBtn('ah-refresh-context', 'Refresh context', 'jos-btn-brand jos-btn-sm') + proposals + '</div></div>';
  }
  function renderAhActivityTab() {
    var os = ensureAskHublyOsState();
    var rows = os.activity.slice().reverse().map(function (a) {
      return '<div class="jos-ah-event"><div class="jos-ah-event-type">' + esc(a.type || 'activity') + '</div><div class="jos-muted">' + esc(String(a.at || '').replace('T', ' ').slice(0, 19)) + '</div><p>' + esc(a.label || '') + '</p>' + (a.payload ? '<pre>' + esc(JSON.stringify(a.payload || {}, null, 0)) + '</pre>' : '') + '</div>';
    }).join('');
    var ev = hublyEvents();
    var aiEvents = ev && typeof ev.recent === 'function' ? ev.recent(30).filter(function (row) { return /^ai\./.test(row.type); }) : [];
    var eventRows = aiEvents.map(function (row) {
      return '<div class="jos-ah-event"><div class="jos-ah-event-type">' + esc(row.type) + '</div><div class="jos-muted">' + esc(String(row.at || '').replace('T', ' ').slice(0, 19)) + '</div><pre>' + esc(JSON.stringify(row.payload || {}, null, 0)) + '</pre></div>';
    }).join('');
    return '<div class="jos-ah-2col"><div class="jos-card"><div class="jos-kicker">Ask Hubly activity</div><div class="jos-ah-events jos-mt">' + (rows || '') + '</div></div><div class="jos-card"><div class="jos-kicker">AI events</div><div class="jos-ah-events jos-mt">' + (eventRows || (DS() ? DS().emptyState('No AI events yet', 'Propose or execute an action to publish events.') : '')) + '</div></div></div>';
  }
  function renderAhTabBody(root, tab) {
    if (tab === 'actions') return renderAhActionsTab();
    if (tab === 'memory') return renderAhMemoryTab();
    if (tab === 'automations') return renderAhAutomationsTab();
    if (tab === 'context') return renderAhContextTab();
    if (tab === 'activity') return renderAhActivityTab();
    return renderAhChatTab();
  }
  function renderAskHubly() {
    var root = ownPixelView('v-ask', 'jos-ask-root');
    if (!root) return;
    updateChrome('ask');
    ensureAskHublyOsState();
    var tab = root._josAhTab || 'chat';
    root.innerHTML = '<div class="jos-page jos-ask jos-ah-page">' + ahTabsHtml(tab) + '<div class="jos-ah-body">' + renderAhTabBody(root, tab) + '</div></div>';
    bindRoot(root);
  }
  function handleAskHublyAct(act, t) {
    var root = el('jos-ask-root');
    ensureAskHublyOsState();
    try {
      if (act === 'ah-confirm') {
        var pid = t && (t.getAttribute('data-jos-ah-pending') || (t.closest('[data-jos-ah-pending]') && t.closest('[data-jos-ah-pending]').getAttribute('data-jos-ah-pending')));
        return ahConfirmPending(pid);
      }
      if (act === 'ah-cancel') {
        var cid = t && (t.getAttribute('data-jos-ah-pending') || (t.closest('[data-jos-ah-pending]') && t.closest('[data-jos-ah-pending]').getAttribute('data-jos-ah-pending')));
        return ahCancelPending(cid);
      }
      if (act === 'ah-memory-add') {
        var mem = el('jos-ah-memory-input');
        if (!mem || !String(mem.value || '').trim()) return toast('Enter a memory note');
        ahMemoryNote('note', mem.value.trim(), { module: 'ask' });
        ahPushActivity('memory.added', 'Memory note added', {});
        return renderAskHubly();
      }
      if (act === 'ah-auto-add') {
        var actionType = (el('jos-ah-auto-action') || {}).value || 'generate_report';
        var note = (el('jos-ah-auto-note') || {}).value || '';
        var os = ensureAskHublyOsState();
        var existing = os.automations.find(function (a) { return String(a.actionType) === String(actionType); });
        if (existing) { existing.allowed = true; existing.note = note || existing.note; toast('Allow-rule updated'); }
        else os.automations.push({ id: ahId('ah_auto'), actionType: actionType, allowed: true, note: note || 'Exact Ask Hubly allow-rule' });
        ahPushActivity('automation.allowed', 'Automation allowed for ' + ahAction(actionType).label, { actionType: actionType });
        return renderAskHubly();
      }
      if (act === 'ah-auto-toggle') {
        var aid = t && t.getAttribute('data-jos-ah-auto');
        var auto = ensureAskHublyOsState().automations.find(function (a) { return String(a.id) === String(aid); });
        if (auto) { auto.allowed = !auto.allowed; ahPushActivity('automation.toggled', (auto.allowed ? 'Allowed ' : 'Paused ') + ahAction(auto.actionType).label, { actionType: auto.actionType }); }
        return renderAskHubly();
      }
      if (act === 'ah-refresh-context') {
        ahPushActivity('context.refreshed', 'Refreshed owner context', { summary: ahContextLine() });
        toast('Context refreshed');
        return renderAskHubly();
      }
      if (act.indexOf('ah-propose-') === 0) {
        var type = act.replace('ah-propose-', '').replace(/-/g, '_');
        return ahProposeAction(type, ahPayloadFor(type));
      }
      if (act === 'ah-go-money') return switchNav('money');
      if (act === 'ah-go-reports') return switchNav('reports');
      if (act === 'ah-go-customers') return switchNav('customers');
      if (act === 'ah-go-leads') return switchNav('leads');
      if (act === 'ah-go-jobs') return switchNav('jobs');
      if (act === 'ah-go-marketing') return switchNav('marketing');
      if (act === 'ah-go-memberships') return switchNav('memberships');
      if (act === 'ah-go-reviews') return switchNav('reviews');
      if (act === 'ah-go-editor') return switchNav('editor');
      if (root) renderAskHubly();
    } catch (err) {
      console.warn('HublyJourneyOS Ask Hubly act', act, err);
      toast('Ask Hubly action failed');
    }
  }

  /* ── Settings OS (Rule #23 — config only) ───────────────────────── */
  var SET_TABS = [
    ['overview', 'Overview'],
    ['business', 'Business'],
    ['team', 'Team'],
    ['billing', 'Billing'],
    ['integrations', 'Integrations'],
    ['notifications', 'Notifications'],
    ['branding', 'Branding'],
    ['ai', 'AI'],
    ['security', 'Security'],
    ['permissions', 'Permissions']
  ];
  function setId(prefix) { return (prefix || 'set') + '_' + Math.random().toString(36).slice(2, 9); }
  function setNow() { return new Date().toISOString(); }
  function setPublish(type, payload) {
    var ev = hublyEvents();
    if (ev && typeof ev.publish === 'function') ev.publish(type, payload || {});
  }
  function ensureSettingsOsState() {
    var st = S();
    if (!st.settingsOs || typeof st.settingsOs !== 'object') st.settingsOs = {};
    var os = st.settingsOs;
    ['customers', 'payments', 'jobs', 'leads', 'campaigns', 'reviews', 'services'].forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(os, key)) delete os[key];
    });
    if (!os.business || typeof os.business !== 'object') {
      os.business = {
        name: st.businessName || st.city || 'Hubly Detail Co',
        address: '100 Harbor Drive',
        city: (String(st.city || 'San Diego, CA').split(',')[0] || 'San Diego').trim(),
        region: 'CA',
        postal: '92101',
        country: 'US',
        timeZone: 'America/Los_Angeles',
        currency: 'USD',
        taxDefault: 7.75,
        logoUrl: 'assets/hubly-wordmark.png',
        contactEmail: 'hello@hubly.test',
        contactPhone: '(619) 555-0100'
      };
    }
    if (!os.team || typeof os.team !== 'object') os.team = { users: [], invitations: [] };
    if (!Array.isArray(os.team.users)) os.team.users = [];
    if (!Array.isArray(os.team.invitations)) os.team.invitations = [];
    if (!os.team.users.length) {
      var roster = Array.isArray(st.team) ? st.team : [];
      os.team.users = (roster.length ? roster : [
        { id: 't1', name: 'Adrian Lopez', role: 'Owner' },
        { id: 't2', name: 'Maya Chen', role: 'Technician' },
        { id: 't3', name: 'Luis Ortega', role: 'Technician' }
      ]).map(function (u, i) {
        return {
          id: u.id || ('set_u_' + i),
          name: u.name || 'Team member',
          email: u.email || (String(u.name || 'user').toLowerCase().replace(/\s+/g, '.') + '@hubly.test'),
          role: u.role || 'Technician',
          status: 'active'
        };
      });
    }
    if (!os.billing || typeof os.billing !== 'object') {
      os.billing = {
        plan: 'Grow',
        status: 'active',
        paymentMethod: 'Visa ···· 4242',
        usage: { seats: os.team.users.length, jobsThisMonth: Array.isArray(st.jobs) ? st.jobs.length : 0, aiActions: 12 },
        invoices: [
          { id: 'pin_1', label: 'Hubly Grow — Jul', amount: 79, status: 'paid', at: setNow() },
          { id: 'pin_2', label: 'Hubly Grow — Jun', amount: 79, status: 'paid', at: setNow() }
        ]
      };
    }
    if (!os.integrations || typeof os.integrations !== 'object') {
      os.integrations = {
        stripe: { key: 'stripe', label: 'Stripe', status: 'os_ready', note: 'Revenue owns live payments (Rule #20).' },
        google: { key: 'google', label: 'Google', status: 'not_connected', note: 'Calendar / Business Profile — Stage 2.' },
        meta: { key: 'meta', label: 'Meta', status: 'not_connected', note: 'Ads / messaging — Stage 2.' },
        twilio: { key: 'twilio', label: 'Twilio', status: 'os_ready', note: 'SMS channel config — Stage 2 live.' },
        resend: { key: 'resend', label: 'Resend', status: 'os_ready', note: 'Email delivery — Stage 2 live.' },
        webhooks: []
      };
    }
    if (!Array.isArray(os.integrations.webhooks)) os.integrations.webhooks = [];
    if (!os.notifications || typeof os.notifications !== 'object') {
      os.notifications = { email: true, sms: true, push: false, desktop: true, ai: true };
    }
    if (!os.branding || typeof os.branding !== 'object') {
      os.branding = {
        logoUrl: 'assets/hubly-wordmark.png',
        primaryColor: '#141B2B',
        accentColor: '#D9632D',
        fontDisplay: 'Plus Jakarta Sans',
        fontBody: 'DM Sans',
        faviconUrl: '/favicon.ico',
        websiteDefaults: 'Hero first · brand mark · one CTA'
      };
    }
    if (!os.ai || typeof os.ai !== 'object') {
      os.ai = {
        tone: 'helpful_pro',
        permissions: 'propose_with_confirm',
        autoActionsDefault: false,
        memoryDefault: true,
        automationDefaults: 'exact_allow_rules'
      };
    }
    if (!os.security || typeof os.security !== 'object') {
      os.security = {
        mfaRequired: false,
        sessions: [{ id: 'sess_1', device: 'This browser', at: setNow(), current: true }],
        apiKeys: [{ id: 'key_1', label: 'Operate OS key', prefix: 'hk_os_', createdAt: setNow() }],
        auditLog: [],
        passwordPolicy: { minLength: 10, requireSymbol: true }
      };
    }
    if (!Array.isArray(os.security.sessions)) os.security.sessions = [];
    if (!Array.isArray(os.security.apiKeys)) os.security.apiKeys = [];
    if (!Array.isArray(os.security.auditLog)) os.security.auditLog = [];
    if (!os.permissions || typeof os.permissions !== 'object') {
      os.permissions = {
        roles: [
          { id: 'role_owner', name: 'Owner', modules: 'all' },
          { id: 'role_manager', name: 'Manager', modules: 'operate' },
          { id: 'role_tech', name: 'Technician', modules: 'jobs,inbox' }
        ],
        featureAccess: { askHubly: true, reports: true, marketing: true, memberships: true },
        moduleAccess: { home: true, inbox: true, jobs: true, leads: true, customers: true, pipeline: true, storefront: true, marketing: true, reviews: true, memberships: true, revenue: true, reports: true, ask: true, settings: true },
        custom: []
      };
    }
    if (!Array.isArray(os.activity)) os.activity = [];
    if (!os._seeded) {
      os.activity.push({ id: setId('set_act'), type: 'settings.seeded', label: 'Settings OS seeded (config only)', at: setNow(), payload: {} });
      os._seeded = true;
    }
    return os;
  }
  function setPushActivity(type, label, payload) {
    var os = ensureSettingsOsState();
    os.activity.unshift({ id: setId('set_act'), type: type, label: label, at: setNow(), payload: payload || {} });
    if (os.activity.length > 80) os.activity.length = 80;
  }
  function setAudit(label, payload) {
    var os = ensureSettingsOsState();
    os.security.auditLog.unshift({ id: setId('aud'), label: label, at: setNow(), payload: payload || {} });
    if (os.security.auditLog.length > 60) os.security.auditLog.length = 60;
    setPublish('settings.security.audited', { label: label });
    setPushActivity('settings.security.audited', label, payload || {});
  }
  function setMirrorTeam() {
    var os = ensureSettingsOsState();
    S().team = os.team.users.map(function (u) {
      return { id: u.id, name: u.name, role: u.role, email: u.email };
    });
  }
  function setVal(id) {
    var node = el(id);
    return node ? String(node.value || '').trim() : '';
  }
  function setChecked(id) {
    var node = el(id);
    return !!(node && node.checked);
  }
  function setTabsHtml(active) {
    return '<div class="jos-tabs jos-set-tabs">' + SET_TABS.map(function (t) {
      return '<button type="button" class="jos-tab' + (active === t[0] ? ' on' : '') + '" data-jos-set-tab="' + esc(t[0]) + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div>';
  }
  function setStatusBadge(label, tone) {
    return '<span class="jos-set-badge ' + esc(tone || 'info') + '">' + esc(label) + '</span>';
  }
  function setIntegrationStatus(status) {
    if (status === 'connected' || status === 'os_ready') return setStatusBadge(status === 'connected' ? 'Connected' : 'OS ready', 'ok');
    return setStatusBadge('Not connected', 'warn');
  }
  function renderSetOverview() {
    var os = ensureSettingsOsState();
    var d = DS();
    var cards = [
      ['Business', os.business.name, 'set-tab-business'],
      ['Team', String(os.team.users.length) + ' users', 'set-tab-team'],
      ['Billing', os.billing.plan + ' · ' + os.billing.status, 'set-tab-billing'],
      ['Integrations', 'OS stubs · Stage 2 live', 'set-tab-integrations'],
      ['AI defaults', os.ai.tone, 'set-tab-ai'],
      ['Security', os.security.mfaRequired ? 'MFA on' : 'MFA off', 'set-tab-security']
    ].map(function (c) {
      return '<button type="button" class="jos-set-tile" data-jos-act="' + esc(c[2]) + '"><div class="jos-kicker">' + esc(c[0]) + '</div><strong>' + esc(c[1]) + '</strong></button>';
    }).join('');
    return '<div class="jos-set-hero">' +
      '<img class="hubly-mark" src="assets/hubly-wordmark.png" alt="hubly">' +
      '<div><div class="jos-kicker">Control center</div><h2>Configure Hubly — never own business data</h2>' +
      '<p class="jos-muted">Rule #23: Settings stores configuration other modules read. Customers, jobs, revenue, services, reviews, and campaigns stay with their owners.</p></div></div>' +
      '<div class="jos-set-tiles jos-mt">' + cards + '</div>' +
      '<div class="jos-set-2col jos-mt"><div class="jos-card"><div class="jos-kicker">Platform readiness</div><ul class="jos-set-list"><li>Business profile + brand tokens</li><li>Team roster mirrored for Jobs</li><li>AI confirmation defaults (Rule #22)</li><li>Integrations marked OS-only until Stage 2</li></ul></div>' +
      '<div class="jos-card"><div class="jos-kicker">Forbidden copies</div><p class="jos-muted">settingsOs purges customers, payments, jobs, leads, campaigns, reviews, and services arrays if present.</p>' +
      (d ? d.emptyState('Config only', 'Open a tab to edit platform settings.') : '') + '</div></div>';
  }
  function renderSetBusiness() {
    var b = ensureSettingsOsState().business;
    return '<div class="jos-card"><div class="jos-kicker">Business</div><p class="jos-muted">Owns name, address, time zone, currency, tax defaults, logo URL, and contact info.</p>' +
      '<div class="jos-set-form jos-mt">' +
      '<label>Business name<input id="jos-set-biz-name" type="text" value="' + esc(b.name || '') + '"></label>' +
      '<label>Address<input id="jos-set-biz-address" type="text" value="' + esc(b.address || '') + '"></label>' +
      '<label>City<input id="jos-set-biz-city" type="text" value="' + esc(b.city || '') + '"></label>' +
      '<label>Region<input id="jos-set-biz-region" type="text" value="' + esc(b.region || '') + '"></label>' +
      '<label>Postal<input id="jos-set-biz-postal" type="text" value="' + esc(b.postal || '') + '"></label>' +
      '<label>Country<input id="jos-set-biz-country" type="text" value="' + esc(b.country || '') + '"></label>' +
      '<label>Time zone<input id="jos-set-biz-tz" type="text" value="' + esc(b.timeZone || '') + '"></label>' +
      '<label>Currency<input id="jos-set-biz-currency" type="text" value="' + esc(b.currency || '') + '"></label>' +
      '<label>Tax default %<input id="jos-set-biz-tax" type="number" step="0.01" value="' + esc(String(b.taxDefault != null ? b.taxDefault : '')) + '"></label>' +
      '<label>Logo URL<input id="jos-set-biz-logo" type="text" value="' + esc(b.logoUrl || '') + '"></label>' +
      '<label>Contact email<input id="jos-set-biz-email" type="email" value="' + esc(b.contactEmail || '') + '"></label>' +
      '<label>Contact phone<input id="jos-set-biz-phone" type="text" value="' + esc(b.contactPhone || '') + '"></label>' +
      '</div><div class="jos-btn-row jos-mt">' + dsBtn('set-business-save', 'Save business', 'jos-btn-brand jos-btn-sm') + '</div></div>';
  }
  function renderSetTeam() {
    var os = ensureSettingsOsState();
    var rows = os.team.users.map(function (u) {
      return '<div class="jos-set-row"><div><strong>' + esc(u.name) + '</strong><div class="jos-muted">' + esc(u.email) + ' · ' + esc(u.role) + '</div></div>' + setStatusBadge(u.status || 'active', u.status === 'invited' ? 'warn' : 'ok') + '</div>';
    }).join('');
    var invites = os.team.invitations.map(function (inv) {
      return '<div class="jos-set-row"><div><strong>' + esc(inv.email) + '</strong><div class="jos-muted">' + esc(inv.role) + ' · invited</div></div>' + setStatusBadge('Pending', 'warn') + '</div>';
    }).join('');
    return '<div class="jos-set-2col"><div class="jos-card"><div class="jos-kicker">Users</div><div class="jos-set-rows jos-mt">' + (rows || '<div class="jos-empty">No users</div>') + '</div></div>' +
      '<div class="jos-card"><div class="jos-kicker">Invite</div><div class="jos-set-form jos-mt"><label>Email<input id="jos-set-invite-email" type="email" placeholder="tech@studio.test"></label>' +
      '<label>Role<select id="jos-set-invite-role"><option>Technician</option><option>Manager</option><option>Owner</option></select></label></div>' +
      '<div class="jos-btn-row jos-mt">' + dsBtn('set-team-invite', 'Send invite', 'jos-btn-brand jos-btn-sm') + '</div>' +
      '<div class="jos-kicker jos-mt">Invitations</div><div class="jos-set-rows">' + (invites || '<p class="jos-muted">No pending invitations.</p>') + '</div></div></div>';
  }
  function renderSetBilling() {
    var b = ensureSettingsOsState().billing;
    var inv = (b.invoices || []).map(function (i) {
      return '<div class="jos-set-row"><div><strong>' + esc(i.label) + '</strong><div class="jos-muted">' + esc(String(i.at || '').slice(0, 10)) + '</div></div><strong>' + esc(money(i.amount) || ('$' + i.amount)) + '</strong></div>';
    }).join('');
    return '<div class="jos-set-2col"><div class="jos-card"><div class="jos-kicker">Subscription</div><p class="jos-muted">Platform billing only — not customer Revenue invoices (Rule #23 / #20).</p>' +
      '<div class="jos-set-form jos-mt"><label>Plan<select id="jos-set-plan"><option' + (b.plan === 'Start' ? ' selected' : '') + '>Start</option><option' + (b.plan === 'Grow' ? ' selected' : '') + '>Grow</option><option' + (b.plan === 'Scale' ? ' selected' : '') + '>Scale</option></select></label>' +
      '<label>Payment method<input id="jos-set-pay-method" type="text" value="' + esc(b.paymentMethod || '') + '"></label></div>' +
      '<div class="jos-btn-row jos-mt">' + dsBtn('set-billing-save', 'Save billing', 'jos-btn-brand jos-btn-sm') + '</div>' +
      '<div class="jos-set-kpis jos-mt"><div><span>Seats</span><strong>' + esc(String(b.usage.seats || 0)) + '</strong></div><div><span>Jobs (ref)</span><strong>' + esc(String(b.usage.jobsThisMonth || 0)) + '</strong></div><div><span>AI actions</span><strong>' + esc(String(b.usage.aiActions || 0)) + '</strong></div></div></div>' +
      '<div class="jos-card"><div class="jos-kicker">Platform invoices</div><div class="jos-set-rows jos-mt">' + inv + '</div></div></div>';
  }
  function renderSetIntegrations() {
    var os = ensureSettingsOsState();
    var keys = ['stripe', 'google', 'meta', 'twilio', 'resend'];
    var cards = keys.map(function (k) {
      var item = os.integrations[k] || { label: k, status: 'not_connected', note: '' };
      return '<div class="jos-set-card" data-jos-set-integration="' + esc(k) + '"><div class="jos-set-card-h"><strong>' + esc(item.label || k) + '</strong>' + setIntegrationStatus(item.status) + '</div><p class="jos-muted">' + esc(item.note || 'Stage 1 OS stub') + '</p><div class="jos-btn-row">' + dsBtn('set-integration-toggle', item.status === 'not_connected' ? 'Mark OS ready' : 'Mark disconnected', 'jos-btn jos-btn-sm') + '</div></div>';
    }).join('');
    var hooks = (os.integrations.webhooks || []).map(function (w) {
      return '<div class="jos-set-row"><div><strong>' + esc(w.url) + '</strong><div class="jos-muted">' + esc(w.event || 'settings.updated') + '</div></div>' + setStatusBadge('OS', 'info') + '</div>';
    }).join('');
    return '<div class="jos-card"><div class="jos-kicker">Integrations</div><p class="jos-muted">Stage 1 stores connection status only. Never claim live connected until Stage 2.</p><div class="jos-set-grid jos-mt">' + cards + '</div></div>' +
      '<div class="jos-card jos-mt"><div class="jos-kicker">Webhooks (OS)</div><div class="jos-set-form jos-mt"><label>Endpoint URL<input id="jos-set-hook-url" type="text" placeholder="https://example.test/hooks/hubly"></label>' +
      '<label>Event<select id="jos-set-hook-event"><option>settings.updated</option><option>settings.team.invited</option><option>settings.security.audited</option></select></label></div>' +
      '<div class="jos-btn-row jos-mt">' + dsBtn('set-webhook-add', 'Add webhook', 'jos-btn-brand jos-btn-sm') + '</div><div class="jos-set-rows jos-mt">' + (hooks || '<p class="jos-muted">No webhooks yet.</p>') + '</div></div>';
  }
  function renderSetNotifications() {
    var n = ensureSettingsOsState().notifications;
    function tog(id, label, on) {
      return '<label class="jos-set-toggle"><span>' + esc(label) + '</span><input id="' + esc(id) + '" type="checkbox"' + (on ? ' checked' : '') + '></label>';
    }
    return '<div class="jos-card"><div class="jos-kicker">Notifications</div><p class="jos-muted">Email · SMS · Push · Desktop · AI notifications</p><div class="jos-set-toggles jos-mt">' +
      tog('jos-set-n-email', 'Email', n.email) + tog('jos-set-n-sms', 'SMS', n.sms) + tog('jos-set-n-push', 'Push', n.push) +
      tog('jos-set-n-desktop', 'Desktop', n.desktop) + tog('jos-set-n-ai', 'AI notifications', n.ai) +
      '</div><div class="jos-btn-row jos-mt">' + dsBtn('set-notifications-save', 'Save notifications', 'jos-btn-brand jos-btn-sm') + '</div></div>';
  }
  function renderSetBranding() {
    var b = ensureSettingsOsState().branding;
    return '<div class="jos-card"><div class="jos-kicker">Branding</div><p class="jos-muted">Logo, colors, fonts, favicon, website defaults — visual tokens only. Storefront owns pages/services.</p>' +
      '<div class="jos-set-brand-preview jos-mt"><img class="hubly-mark" src="' + esc(b.logoUrl || 'assets/hubly-wordmark.png') + '" alt="hubly"><div style="width:28px;height:28px;border-radius:8px;background:' + esc(b.primaryColor || '#141B2B') + '"></div><div style="width:28px;height:28px;border-radius:8px;background:' + esc(b.accentColor || '#D9632D') + '"></div></div>' +
      '<div class="jos-set-form jos-mt"><label>Logo URL<input id="jos-set-brand-logo" type="text" value="' + esc(b.logoUrl || '') + '"></label>' +
      '<label>Primary color<input id="jos-set-brand-primary" type="text" value="' + esc(b.primaryColor || '') + '"></label>' +
      '<label>Accent color<input id="jos-set-brand-accent" type="text" value="' + esc(b.accentColor || '') + '"></label>' +
      '<label>Display font<input id="jos-set-brand-font-d" type="text" value="' + esc(b.fontDisplay || '') + '"></label>' +
      '<label>Body font<input id="jos-set-brand-font-b" type="text" value="' + esc(b.fontBody || '') + '"></label>' +
      '<label>Favicon URL<input id="jos-set-brand-favicon" type="text" value="' + esc(b.faviconUrl || '') + '"></label>' +
      '<label class="jos-set-span2">Website defaults<input id="jos-set-brand-web" type="text" value="' + esc(b.websiteDefaults || '') + '"></label></div>' +
      '<div class="jos-btn-row jos-mt">' + dsBtn('set-branding-save', 'Save branding', 'jos-btn-brand jos-btn-sm') + dsBtn('set-go-editor', 'Open Storefront', 'jos-btn jos-btn-sm') + '</div></div>';
  }
  function renderSetAi() {
    var a = ensureSettingsOsState().ai;
    return '<div class="jos-card"><div class="jos-kicker">AI Settings</div><p class="jos-muted">Global defaults. Ask Hubly owns conversations/memory/actions (Rule #22). Settings does not store customer data.</p>' +
      '<div class="jos-set-form jos-mt"><label>AI tone<select id="jos-set-ai-tone"><option value="helpful_pro"' + (a.tone === 'helpful_pro' ? ' selected' : '') + '>Helpful pro</option><option value="friendly"' + (a.tone === 'friendly' ? ' selected' : '') + '>Friendly</option><option value="concise"' + (a.tone === 'concise' ? ' selected' : '') + '>Concise</option></select></label>' +
      '<label>AI permissions<select id="jos-set-ai-perm"><option value="propose_with_confirm"' + (a.permissions === 'propose_with_confirm' ? ' selected' : '') + '>Propose with confirm</option><option value="read_only"' + (a.permissions === 'read_only' ? ' selected' : '') + '>Read only</option></select></label>' +
      '<label>Auto actions default<select id="jos-set-ai-auto"><option value="false"' + (!a.autoActionsDefault ? ' selected' : '') + '>Off (confirm)</option><option value="true"' + (a.autoActionsDefault ? ' selected' : '') + '>Allow-rules only</option></select></label>' +
      '<label>Memory default<select id="jos-set-ai-memory"><option value="true"' + (a.memoryDefault ? ' selected' : '') + '>On</option><option value="false"' + (!a.memoryDefault ? ' selected' : '') + '>Off</option></select></label>' +
      '<label class="jos-set-span2">Automation defaults<input id="jos-set-ai-automations" type="text" value="' + esc(a.automationDefaults || '') + '"></label></div>' +
      '<div class="jos-btn-row jos-mt">' + dsBtn('set-ai-save', 'Save AI settings', 'jos-btn-brand jos-btn-sm') + dsBtn('set-go-ask', 'Open Ask Hubly', 'jos-btn jos-btn-sm') + '</div></div>';
  }
  function renderSetSecurity() {
    var s = ensureSettingsOsState().security;
    var sessions = s.sessions.map(function (sess) {
      return '<div class="jos-set-row"><div><strong>' + esc(sess.device) + '</strong><div class="jos-muted">' + esc(String(sess.at || '').replace('T', ' ').slice(0, 19)) + '</div></div>' + setStatusBadge(sess.current ? 'Current' : 'Active', 'ok') + '</div>';
    }).join('');
    var keys = s.apiKeys.map(function (k) {
      return '<div class="jos-set-row"><div><strong>' + esc(k.label) + '</strong><div class="jos-muted">' + esc(k.prefix) + '••••</div></div>' + dsBtn('set-api-rotate', 'Rotate', 'jos-btn jos-btn-sm') + '</div>';
    }).join('');
    var audit = s.auditLog.slice(0, 8).map(function (a) {
      return '<div class="jos-set-event"><strong>' + esc(a.label) + '</strong><span class="jos-muted">' + esc(String(a.at || '').replace('T', ' ').slice(0, 19)) + '</span></div>';
    }).join('');
    return '<div class="jos-set-2col"><div class="jos-card"><div class="jos-kicker">Security</div><div class="jos-set-form jos-mt">' +
      '<label class="jos-set-toggle"><span>Require MFA</span><input id="jos-set-mfa" type="checkbox"' + (s.mfaRequired ? ' checked' : '') + '></label>' +
      '<label>Min password length<input id="jos-set-pw-len" type="number" min="8" value="' + esc(String(s.passwordPolicy.minLength || 10)) + '"></label>' +
      '<label class="jos-set-toggle"><span>Require symbol</span><input id="jos-set-pw-symbol" type="checkbox"' + (s.passwordPolicy.requireSymbol ? ' checked' : '') + '></label></div>' +
      '<div class="jos-btn-row jos-mt">' + dsBtn('set-security-save', 'Save security', 'jos-btn-brand jos-btn-sm') + '</div>' +
      '<div class="jos-kicker jos-mt">Sessions</div><div class="jos-set-rows">' + sessions + '</div></div>' +
      '<div class="jos-stack"><div class="jos-card"><div class="jos-kicker">API keys</div><div class="jos-set-rows jos-mt">' + keys + '</div><div class="jos-btn-row">' + dsBtn('set-api-create', 'Create key', 'jos-btn-brand jos-btn-sm') + '</div></div>' +
      '<div class="jos-card"><div class="jos-kicker">Audit log</div><div class="jos-set-events jos-mt">' + (audit || '<p class="jos-muted">No audit events yet.</p>') + '</div></div></div></div>';
  }
  function renderSetPermissions() {
    var p = ensureSettingsOsState().permissions;
    var roles = p.roles.map(function (r) {
      return '<div class="jos-set-row"><div><strong>' + esc(r.name) + '</strong><div class="jos-muted">' + esc(r.modules) + '</div></div>' + setStatusBadge('Role', 'info') + '</div>';
    }).join('');
    var modules = Object.keys(p.moduleAccess || {}).map(function (m) {
      return '<label class="jos-set-toggle"><span>' + esc(m) + '</span><input type="checkbox" data-jos-set-module="' + esc(m) + '"' + (p.moduleAccess[m] ? ' checked' : '') + '></label>';
    }).join('');
    var features = Object.keys(p.featureAccess || {}).map(function (f) {
      return '<label class="jos-set-toggle"><span>' + esc(f) + '</span><input type="checkbox" data-jos-set-feature="' + esc(f) + '"' + (p.featureAccess[f] ? ' checked' : '') + '></label>';
    }).join('');
    return '<div class="jos-set-2col"><div class="jos-card"><div class="jos-kicker">Roles</div><div class="jos-set-rows jos-mt">' + roles + '</div>' +
      '<div class="jos-set-form jos-mt"><label>Custom permission<input id="jos-set-custom-perm" type="text" placeholder="e.g. export_reports"></label></div>' +
      '<div class="jos-btn-row">' + dsBtn('set-perm-custom-add', 'Add custom permission', 'jos-btn-brand jos-btn-sm') + '</div>' +
      '<div class="jos-muted jos-mt">Custom: ' + esc((p.custom || []).join(', ') || 'none') + '</div></div>' +
      '<div class="jos-stack"><div class="jos-card"><div class="jos-kicker">Module access</div><div class="jos-set-toggles jos-mt">' + modules + '</div><div class="jos-btn-row jos-mt">' + dsBtn('set-perm-modules-save', 'Save module access', 'jos-btn-brand jos-btn-sm') + '</div></div>' +
      '<div class="jos-card"><div class="jos-kicker">Feature access</div><div class="jos-set-toggles jos-mt">' + features + '</div><div class="jos-btn-row jos-mt">' + dsBtn('set-perm-features-save', 'Save feature access', 'jos-btn-brand jos-btn-sm') + '</div></div></div></div>';
  }
  function renderSettingsTabBody(root, tab) {
    if (tab === 'business') return renderSetBusiness();
    if (tab === 'team') return renderSetTeam();
    if (tab === 'billing') return renderSetBilling();
    if (tab === 'integrations') return renderSetIntegrations();
    if (tab === 'notifications') return renderSetNotifications();
    if (tab === 'branding') return renderSetBranding();
    if (tab === 'ai') return renderSetAi();
    if (tab === 'security') return renderSetSecurity();
    if (tab === 'permissions') return renderSetPermissions();
    return renderSetOverview();
  }
  function renderSettings() {
    var root = ownPixelView('v-settings', 'jos-settings-root');
    if (!root) return;
    updateChrome('settings');
    ensureSettingsOsState();
    var tab = root._josSetTab || ensureSettingsOsState().tab || 'overview';
    root._josSetTab = tab;
    var d = DS();
    var head = d ? d.pageHeader('Settings', 'Platform control center. Configuration only — Rule #23.', dsBtn('set-refresh', 'Refresh', 'jos-btn jos-btn-sm') + dsBtn('set-go-ask', 'Ask Hubly', 'jos-btn-brand jos-btn-sm')) :
      '<div class="jos-head"><h1>Settings</h1><p class="jos-muted">Platform control center.</p></div>';
    try {
      root.innerHTML = '<div class="jos-page jos-set-page">' + head + setTabsHtml(tab) + '<div class="jos-set-body">' + renderSettingsTabBody(root, tab) + '</div></div>';
    } catch (err) {
      console.warn('HublyJourneyOS Settings render', err);
      root.innerHTML = '<div class="jos-page jos-set-page"><div class="jos-card"><strong>Settings could not load</strong><p class="jos-muted">Retry the control center.</p>' + dsBtn('set-refresh', 'Retry', 'jos-btn-brand jos-btn-sm') + '</div></div>';
    }
    bindRoot(root);
  }
  function renderSettingsHub() { return renderSettings(); }
  function handleSettingsAct(act, t) {
    var root = el('jos-settings-root');
    ensureSettingsOsState();
    try {
      if (act === 'set-refresh') return renderSettings();
      if (act.indexOf('set-tab-') === 0) {
        if (root) root._josSetTab = act.replace('set-tab-', '');
        return renderSettings();
      }
      if (act === 'set-business-save') {
        var os = ensureSettingsOsState();
        os.business.name = setVal('jos-set-biz-name') || os.business.name;
        os.business.address = setVal('jos-set-biz-address');
        os.business.city = setVal('jos-set-biz-city');
        os.business.region = setVal('jos-set-biz-region');
        os.business.postal = setVal('jos-set-biz-postal');
        os.business.country = setVal('jos-set-biz-country');
        os.business.timeZone = setVal('jos-set-biz-tz');
        os.business.currency = setVal('jos-set-biz-currency') || 'USD';
        os.business.taxDefault = Number(setVal('jos-set-biz-tax') || 0);
        os.business.logoUrl = setVal('jos-set-biz-logo') || os.business.logoUrl;
        os.business.contactEmail = setVal('jos-set-biz-email');
        os.business.contactPhone = setVal('jos-set-biz-phone');
        S().businessName = os.business.name;
        setPublish('settings.updated', { area: 'business' });
        setPushActivity('settings.updated', 'Business profile saved', { area: 'business' });
        toast('Business settings saved');
        return renderSettings();
      }
      if (act === 'set-team-invite') {
        var email = setVal('jos-set-invite-email');
        var role = setVal('jos-set-invite-role') || 'Technician';
        if (!email) return toast('Enter invite email');
        var teamOs = ensureSettingsOsState();
        teamOs.team.invitations.unshift({ id: setId('inv'), email: email, role: role, at: setNow() });
        teamOs.team.users.push({ id: setId('set_u'), name: email.split('@')[0], email: email, role: role, status: 'invited' });
        setMirrorTeam();
        teamOs.billing.usage.seats = teamOs.team.users.length;
        setPublish('settings.team.invited', { email: email, role: role });
        setPushActivity('settings.team.invited', 'Invited ' + email, { email: email, role: role });
        toast('Invitation created');
        return renderSettings();
      }
      if (act === 'set-billing-save') {
        var bill = ensureSettingsOsState().billing;
        bill.plan = setVal('jos-set-plan') || bill.plan;
        bill.paymentMethod = setVal('jos-set-pay-method') || bill.paymentMethod;
        setPublish('settings.updated', { area: 'billing' });
        setPushActivity('settings.updated', 'Billing settings saved', { plan: bill.plan });
        toast('Billing settings saved');
        return renderSettings();
      }
      if (act === 'set-integration-toggle') {
        var card = t && t.closest('[data-jos-set-integration]');
        var key = card && card.getAttribute('data-jos-set-integration');
        var integ = ensureSettingsOsState().integrations;
        if (key && integ[key]) {
          integ[key].status = integ[key].status === 'not_connected' ? 'os_ready' : 'not_connected';
          setPublish('settings.integration.toggled', { key: key, status: integ[key].status });
          setPushActivity('settings.integration.toggled', integ[key].label + ' → ' + integ[key].status, { key: key });
          toast(integ[key].label + ' updated (OS)');
        }
        return renderSettings();
      }
      if (act === 'set-webhook-add') {
        var url = setVal('jos-set-hook-url');
        var eventName = setVal('jos-set-hook-event') || 'settings.updated';
        if (!url) return toast('Enter webhook URL');
        ensureSettingsOsState().integrations.webhooks.unshift({ id: setId('hook'), url: url, event: eventName, at: setNow() });
        setPublish('settings.updated', { area: 'webhooks' });
        setPushActivity('settings.updated', 'Webhook added', { url: url });
        toast('Webhook saved (OS)');
        return renderSettings();
      }
      if (act === 'set-notifications-save') {
        var n = ensureSettingsOsState().notifications;
        n.email = setChecked('jos-set-n-email');
        n.sms = setChecked('jos-set-n-sms');
        n.push = setChecked('jos-set-n-push');
        n.desktop = setChecked('jos-set-n-desktop');
        n.ai = setChecked('jos-set-n-ai');
        setPublish('settings.updated', { area: 'notifications' });
        setPushActivity('settings.updated', 'Notifications saved', {});
        toast('Notifications saved');
        return renderSettings();
      }
      if (act === 'set-branding-save') {
        var br = ensureSettingsOsState().branding;
        br.logoUrl = setVal('jos-set-brand-logo') || br.logoUrl;
        br.primaryColor = setVal('jos-set-brand-primary') || br.primaryColor;
        br.accentColor = setVal('jos-set-brand-accent') || br.accentColor;
        br.fontDisplay = setVal('jos-set-brand-font-d') || br.fontDisplay;
        br.fontBody = setVal('jos-set-brand-font-b') || br.fontBody;
        br.faviconUrl = setVal('jos-set-brand-favicon') || br.faviconUrl;
        br.websiteDefaults = setVal('jos-set-brand-web') || br.websiteDefaults;
        setPublish('settings.updated', { area: 'branding' });
        setPushActivity('settings.updated', 'Branding saved', {});
        toast('Branding saved');
        return renderSettings();
      }
      if (act === 'set-ai-save') {
        var ai = ensureSettingsOsState().ai;
        ai.tone = setVal('jos-set-ai-tone') || ai.tone;
        ai.permissions = setVal('jos-set-ai-perm') || ai.permissions;
        ai.autoActionsDefault = setVal('jos-set-ai-auto') === 'true';
        ai.memoryDefault = setVal('jos-set-ai-memory') !== 'false';
        ai.automationDefaults = setVal('jos-set-ai-automations') || ai.automationDefaults;
        setPublish('settings.updated', { area: 'ai' });
        setPushActivity('settings.updated', 'AI settings saved', { tone: ai.tone });
        toast('AI settings saved');
        return renderSettings();
      }
      if (act === 'set-security-save') {
        var sec = ensureSettingsOsState().security;
        sec.mfaRequired = setChecked('jos-set-mfa');
        sec.passwordPolicy.minLength = Number(setVal('jos-set-pw-len') || 10);
        sec.passwordPolicy.requireSymbol = setChecked('jos-set-pw-symbol');
        setAudit('Security policy updated', { mfaRequired: sec.mfaRequired });
        setPublish('settings.updated', { area: 'security' });
        toast('Security settings saved');
        return renderSettings();
      }
      if (act === 'set-api-create') {
        ensureSettingsOsState().security.apiKeys.unshift({ id: setId('key'), label: 'Operate OS key', prefix: 'hk_os_', createdAt: setNow() });
        setAudit('API key created', {});
        toast('API key created');
        return renderSettings();
      }
      if (act === 'set-api-rotate') {
        setAudit('API key rotated', {});
        toast('API key rotated (OS)');
        return renderSettings();
      }
      if (act === 'set-perm-custom-add') {
        var custom = setVal('jos-set-custom-perm');
        if (!custom) return toast('Enter a permission key');
        var perms = ensureSettingsOsState().permissions;
        if (perms.custom.indexOf(custom) < 0) perms.custom.push(custom);
        setPublish('settings.updated', { area: 'permissions' });
        setPushActivity('settings.updated', 'Custom permission added', { key: custom });
        toast('Custom permission added');
        return renderSettings();
      }
      if (act === 'set-perm-modules-save') {
        var modOs = ensureSettingsOsState().permissions;
        Object.keys(modOs.moduleAccess || {}).forEach(function (m) { modOs.moduleAccess[m] = true; });
        setPublish('settings.updated', { area: 'module_access' });
        setPushActivity('settings.updated', 'Module access saved', {});
        toast('Module access saved');
        return renderSettings();
      }
      if (act === 'set-perm-features-save') {
        var featOs = ensureSettingsOsState().permissions;
        Object.keys(featOs.featureAccess || {}).forEach(function (f) { featOs.featureAccess[f] = true; });
        setPublish('settings.updated', { area: 'feature_access' });
        setPushActivity('settings.updated', 'Feature access saved', {});
        toast('Feature access saved');
        return renderSettings();
      }
      if (act === 'set-go-ask') return switchNav('ask');
      if (act === 'set-go-editor') return switchNav('editor');
      if (root) renderSettings();
    } catch (err) {
      console.warn('HublyJourneyOS Settings act', act, err);
      toast('Settings action failed');
    }
  }

  var MKT_TABS = [
    ['overview', 'Overview'],
    ['campaigns', 'Campaigns'],
    ['email', 'Email'],
    ['sms', 'SMS'],
    ['social', 'Social'],
    ['ads', 'Ads'],
    ['automations', 'Automations'],
    ['coupons', 'Coupons'],
    ['ai', 'AI Studio']
  ];
  var MKT_SEGMENTS = [
    ['all_customers', 'All customers'],
    ['vip', 'VIP / favorites'],
    ['members', 'Members'],
    ['win_back', 'Win-back'],
    ['open_leads', 'Open leads'],
    ['ai_qualified_leads', 'AI qualified leads']
  ];
  var MKT_CHANNEL_LABEL = { email: 'Email', sms: 'SMS', social: 'Social', meta: 'Meta Ads', multi: 'Multi-channel' };
  var MKT_STATUS_TONE = { draft: 'quote', scheduled: 'info', active: 'ok', paused: 'warn', done: 'lost' };

  function mktId(prefix) { return (prefix || 'mkt') + '_' + Math.random().toString(36).slice(2, 9); }

  function ensureMarketingOsState() {
    var st = S();
    if (!st.marketingOs || typeof st.marketingOs !== 'object') st.marketingOs = {};
    var m = st.marketingOs;
    if (!Array.isArray(m.campaigns)) {
      m.campaigns = [
        { id: 'mkt_camp_1', name: 'Spring ceramic push', channel: 'email', status: 'active', audience: { type: 'segment', key: 'members' }, serviceId: 'sf_svc_3', subject: 'Member pricing on ceramic', body: 'Book ceramic coating this month with member pricing.', scheduledAt: todayStr(), stats: { sends: 42, opens: 18, clicks: 9, attributedRevenue: 0 } },
        { id: 'mkt_camp_2', name: 'Win-back SMS', channel: 'sms', status: 'scheduled', audience: { type: 'segment', key: 'win_back' }, body: 'We miss you — 15% off your next detail. Book online anytime.', scheduledAt: todayStr(), stats: { sends: 0, clicks: 0 } },
        { id: 'mkt_camp_3', name: 'Instagram before/after', channel: 'social', status: 'draft', audience: { type: 'segment', key: 'all_customers' }, body: 'Swipe for the glow-up — Book Now link in bio.', stats: {} }
      ];
    }
    if (!Array.isArray(m.templates)) {
      m.templates = [
        { id: 'mkt_tpl_email_1', kind: 'email', name: 'Thank-you + rebook', subject: 'Thanks for trusting us', body: 'Hi {{name}}, thanks for your visit. Ready to rebook? Tap your personalized link.' },
        { id: 'mkt_tpl_email_2', kind: 'email', name: 'Seasonal promo', subject: 'Limited-time detail offer', body: 'This week only — upgrade your package and save.' },
        { id: 'mkt_tpl_sms_1', kind: 'sms', name: 'Win-back text', body: 'Hi {{name}}, it has been a while. Reply BOOK for 15% off your next visit.' },
        { id: 'mkt_tpl_sms_2', kind: 'sms', name: 'Appointment reminder', body: 'Reminder: your {{service}} is tomorrow. Reply C to confirm.' },
        { id: 'mkt_tpl_social_1', kind: 'social', name: 'Before / after post', body: 'Transformation Tuesday — Book your detail. Link in bio.' },
        { id: 'mkt_tpl_social_2', kind: 'social', name: 'Review spotlight', body: '5-star love from a happy customer. See why locals book with us.' }
      ];
    }
    if (!Array.isArray(m.automations)) {
      m.automations = [
        { id: 'review_requests', name: 'Review Requests', on: true, desc: 'Ask for a review after completed jobs.' },
        { id: 'follow_up', name: 'Follow-up Emails', on: true, desc: 'Thank-you and rebook nudges after service.' },
        { id: 'birthday', name: 'Birthday', on: true, desc: 'Birthday offer for customers with a date on file.' },
        { id: 're_engage', name: 'Re-engage', on: false, desc: 'Win-back sequence for quiet customers.' },
        { id: 'smart_promos', name: 'Smart Promotions', on: false, desc: 'AI-suggested promos based on open capacity.' }
      ];
    }
    if (!Array.isArray(m.coupons)) {
      m.coupons = [
        { id: 'mkt_cpn_1', code: 'SPRING15', label: '15% spring detail', discount: 15, type: 'pct', active: true, uses: 12 },
        { id: 'mkt_cpn_2', code: 'WELCOME25', label: '$25 off first booking', discount: 25, type: 'flat', active: true, uses: 4 }
      ];
    }
    if (!Array.isArray(m.calendar)) {
      m.calendar = [
        { id: 'mkt_cal_1', title: 'Before/after carousel', channel: 'instagram', scheduledAt: todayStr(), status: 'scheduled', body: 'Showcase paint correction results with Book Now CTA.' },
        { id: 'mkt_cal_2', title: 'Member spotlight', channel: 'facebook', scheduledAt: todayStr(), status: 'draft', body: 'Highlight Shine Club perks and priority booking.' }
      ];
    }
    if (!Array.isArray(m.ads)) {
      m.ads = [
        { id: 'mkt_ad_1', name: 'Local detail — leads', platform: 'meta', status: 'active', spend: 420, leads: 28, cpl: 15, clicks: 312, impressions: 8400 },
        { id: 'mkt_ad_2', name: 'Ceramic retargeting', platform: 'meta', status: 'paused', spend: 180, leads: 9, cpl: 20, clicks: 96, impressions: 2100 }
      ];
    }
    if (m.score == null) m.score = marketingScore();
    if (!m.toggles || typeof m.toggles !== 'object') m.toggles = {};
    m.automations.forEach(function (a) {
      if (m.toggles[a.id] == null) m.toggles[a.id] = !!a.on;
      a.on = !!m.toggles[a.id];
    });
    m.campaigns.forEach(function (c) {
      if (!c.stats) c.stats = {};
      if (c.stats.attributedRevenue == null && c.status === 'active') c.stats.attributedRevenue = mktAttributedRevenueDemo();
    });
    return m;
  }

  function marketingScore() {
    var m = S().marketingOs;
    if (m && m.score != null && m.score > 0) return Math.round(m.score);
    var revN = (S().website?.manualReviews || S().manualReviews || []).length;
    var done = jobs().filter(function (j) { return j.status === 'completed' && !j.isBlock; }).length;
    var custN = customers().length;
    return Math.max(50, Math.min(90, 50 + Math.min(12, revN * 3) + Math.min(16, done * 2) + Math.min(12, custN)));
  }

  function sparkHtml(vals) {
    var max = Math.max.apply(null, vals.concat([1]));
    return '<div class="jos-spark">' + vals.map(function (v) { return '<i style="height:' + Math.max(12, Math.round((v / max) * 100)) + '%"></i>'; }).join('') + '</div>';
  }

  function mktSegmentLabel(key) {
    var row = MKT_SEGMENTS.find(function (s) { return s[0] === key; });
    return row ? row[1] : key;
  }

  function mktLastJobDate(c) {
    var done = jobs().filter(function (j) { return j.status === 'completed' && !j.isBlock && j.customer === c.name; });
    if (!done.length) return null;
    done.sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
    return done[0].date || null;
  }

  function mktSegmentCount(key) {
    var custs = customers();
    if (key === 'all_customers') return custs.length;
    if (key === 'vip') return custs.filter(function (c) { return c.favorite || (c.tags || []).indexOf('vip') >= 0; }).length;
    if (key === 'members') return custs.filter(function (c) { return c.customerType === 'recurring' || c.isReturning || c.membership; }).length;
    if (key === 'win_back') {
      var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 60);
      var cut = cutoff.toISOString().slice(0, 10);
      return custs.filter(function (c) {
        var last = mktLastJobDate(c);
        return last && String(last).slice(0, 10) < cut;
      }).length;
    }
    if (key === 'open_leads') return pipelineLeadSource().length;
    if (key === 'ai_qualified_leads') return pipelineLeadSource().filter(function (l) { return l.aiQualified; }).length;
    return 0;
  }

  function mktSampleCustomerId(key) {
    var custs = customers();
    if (!custs.length) return null;
    if (key === 'members') {
      var mem = custs.find(function (c) { return c.customerType === 'recurring'; });
      return (mem || custs[0]).id;
    }
    if (key === 'vip') {
      var vip = custs.find(function (c) { return c.favorite; });
      return (vip || custs[0]).id;
    }
    return custs[0].id;
  }

  function mktServiceName(serviceId) {
    if (!serviceId) return '';
    ensureStorefrontOsState();
    var svc = storefrontCatalog().find(function (s) { return String(s.id) === String(serviceId); });
    return svc ? svc.name : '';
  }

  function mktAttributedRevenueDemo() {
    var done = jobs().filter(function (j) { return j.status === 'completed' && !j.isBlock; });
    var rev = done.reduce(function (s, j) { return s + (parseFloat(j.amount) || 0); }, 0);
    return Math.round(rev * 0.18) || 0;
  }

  function mktTemplates(kind) {
    return ensureMarketingOsState().templates.filter(function (t) { return !kind || t.kind === kind; });
  }

  function mktCampStatusBadge(status) {
    var d = DS();
    var lbl = String(status || 'draft').replace(/_/g, ' ');
    lbl = lbl.charAt(0).toUpperCase() + lbl.slice(1);
    return d ? d.statusBadge(lbl, MKT_STATUS_TONE[status] || 'quote') : '<span class="jos-pill ' + esc(MKT_STATUS_TONE[status] || 'quote') + '">' + esc(lbl) + '</span>';
  }

  function mktTodayActions() {
    return [
      { t: 'Holiday / seasonal promo', s: 'Push a limited offer before the next busy weekend.', q: 'Draft a holiday promo for my detailing business', act: 'mkt-ai-campaign' },
      { t: 'Instagram caption kit', s: 'Before/after posts with a Book Now CTA.', q: 'Write 3 Instagram captions with booking CTAs', act: 'mkt-ai-post' },
      { t: 'Testimonial spotlight', s: 'Turn a 5-star review into a shareable post.', q: 'Turn my best review into a social testimonial post', act: 'mkt-ai-post' },
      { t: 'Win-back campaign', s: 'Re-engage customers quiet for 60+ days.', q: 'Draft a win-back text for quiet customers', act: 'mkt-ai-sms' },
      { t: 'Email nurture', s: 'Short sequence: thank-you, tip, rebook.', q: 'Write a 3-email nurture sequence after a job', act: 'mkt-ai-email' }
    ];
  }

  function renderMktCampaignModal(root) {
    if (!root._josMktCampModal) return '';
    var d = root._josMktCampDraft || {};
    var editing = !!d.id;
    var segOpts = MKT_SEGMENTS.map(function (s) {
      return '<option value="' + esc(s[0]) + '"' + ((d.audience && d.audience.key) === s[0] || (!d.audience && s[0] === 'all_customers') ? ' selected' : '') + '>' + esc(s[1]) + ' (' + mktSegmentCount(s[0]) + ')</option>';
    }).join('');
    ensureStorefrontOsState();
    var svcOpts = '<option value="">— Optional service —</option>' + storefrontCatalog().filter(function (s) { return s.status !== 'archived'; }).map(function (s) {
      return '<option value="' + esc(String(s.id)) + '"' + (String(d.serviceId) === String(s.id) ? ' selected' : '') + '>' + esc(s.name) + '</option>';
    }).join('');
    var chOpts = ['email', 'sms', 'social', 'meta', 'multi'].map(function (c) {
      return '<option value="' + c + '"' + ((d.channel || 'email') === c ? ' selected' : '') + '>' + esc(MKT_CHANNEL_LABEL[c] || c) + '</option>';
    }).join('');
    return '<div class="jos-mkt-modal" data-jos-mkt-modal="1"><div class="jos-mkt-modal-panel">' +
      '<h3>' + (editing ? 'Edit campaign' : 'Create campaign') + '</h3>' +
      '<div class="jos-mkt-form">' +
      '<label>Name<input id="jos-mkt-camp-name" type="text" value="' + esc(d.name || '') + '"></label>' +
      '<label>Channel<select id="jos-mkt-camp-channel">' + chOpts + '</select></label>' +
      '<label>Audience<select id="jos-mkt-camp-audience">' + segOpts + '</select></label>' +
      '<label>Service (Storefront catalog)<select id="jos-mkt-camp-service">' + svcOpts + '</select></label>' +
      '<label>Subject<input id="jos-mkt-camp-subject" type="text" value="' + esc(d.subject || '') + '"></label>' +
      '<label class="jos-mkt-span2">Body<textarea id="jos-mkt-camp-body" class="jos-textarea">' + esc(d.body || '') + '</textarea></label>' +
      '<label>Schedule<input id="jos-mkt-camp-schedule" type="date" value="' + esc(String(d.scheduledAt || todayStr()).slice(0, 10)) + '"></label>' +
      '<label>Status<select id="jos-mkt-camp-status">' +
        ['draft', 'scheduled', 'active', 'paused'].map(function (s) {
          return '<option value="' + s + '"' + ((d.status || 'draft') === s ? ' selected' : '') + '>' + esc(s) + '</option>';
        }).join('') +
      '</select></label>' +
      '</div>' +
      '<div class="jos-btn-row jos-mt">' +
        dsBtn('mkt-camp-save', editing ? 'Save changes' : 'Create campaign', 'jos-btn-brand jos-btn-sm') +
        dsBtn('mkt-camp-cancel', 'Cancel', 'jos-btn jos-btn-sm') +
      '</div></div></div>';
  }

  function renderMktTemplateModal(root, kind) {
    if (!root._josMktTplModal || root._josMktTplKind !== kind) return '';
    var d = root._josMktTplDraft || {};
    var editing = !!d.id;
    return '<div class="jos-mkt-modal" data-jos-mkt-modal="1"><div class="jos-mkt-modal-panel">' +
      '<h3>' + (editing ? 'Edit' : 'New') + ' ' + esc(kind) + ' template</h3>' +
      '<div class="jos-mkt-form">' +
      '<label>Name<input id="jos-mkt-tpl-name" type="text" value="' + esc(d.name || '') + '"></label>' +
      (kind === 'email' ? '<label>Subject<input id="jos-mkt-tpl-subject" type="text" value="' + esc(d.subject || '') + '"></label>' : '') +
      '<label class="jos-mkt-span2">Body<textarea id="jos-mkt-tpl-body" class="jos-textarea">' + esc(d.body || '') + '</textarea></label>' +
      '</div>' +
      '<div class="jos-btn-row jos-mt">' +
        dsBtn('mkt-tpl-save', 'Save template', 'jos-btn-brand jos-btn-sm') +
        dsBtn('mkt-tpl-cancel', 'Cancel', 'jos-btn jos-btn-sm') +
      '</div></div></div>';
  }

  function renderMktCouponModal(root) {
    if (!root._josMktCpnModal) return '';
    var d = root._josMktCpnDraft || {};
    return '<div class="jos-mkt-modal" data-jos-mkt-modal="1"><div class="jos-mkt-modal-panel">' +
      '<h3>Create coupon</h3>' +
      '<div class="jos-mkt-form">' +
      '<label>Code<input id="jos-mkt-cpn-code" type="text" value="' + esc(d.code || '') + '" placeholder="SPRING15"></label>' +
      '<label>Label<input id="jos-mkt-cpn-label" type="text" value="' + esc(d.label || '') + '"></label>' +
      '<label>Type<select id="jos-mkt-cpn-type"><option value="pct"' + ((d.type || 'pct') === 'pct' ? ' selected' : '') + '>Percent</option><option value="flat"' + (d.type === 'flat' ? ' selected' : '') + '>Flat $</option></select></label>' +
      '<label>Discount<input id="jos-mkt-cpn-discount" type="number" min="0" value="' + esc(String(d.discount != null ? d.discount : 15)) + '"></label>' +
      '</div>' +
      '<div class="jos-btn-row jos-mt">' +
        dsBtn('mkt-coupon-save', 'Save coupon', 'jos-btn-brand jos-btn-sm') +
        dsBtn('mkt-coupon-cancel', 'Cancel', 'jos-btn jos-btn-sm') +
      '</div></div></div>';
  }

  function renderMktOverviewTab(root) {
    var m = ensureMarketingOsState();
    var score = marketingScore();
    var d = DS();
    var done = jobs().filter(function (j) { return j.status === 'completed' && !j.isBlock; });
    var mktRev = mktAttributedRevenueDemo();
    var newCust = Math.min(customers().length, Math.max(2, Math.round(customers().length * 0.2)));
    var clicks = 40 + customers().length * 8 + done.length * 5;
    var actions = mktTodayActions();
    var ring = d ? d.scoreRing(score, 'Marketing Score') : '<div class="jos-score-ring" style="--jos-pct:' + score + '"><span>' + score + '</span><small>Marketing Score</small></div>';
    var kpis = d
      ? d.metricCard('Website clicks', String(clicks), 'OS demo') +
        d.metricCard('New customers', String(newCust), 'From Customers module') +
        d.metricCard('Attributed revenue', money(mktRev) || '$0', 'Read from completed jobs') +
        d.metricCard('Active campaigns', String(m.campaigns.filter(function (c) { return c.status === 'active'; }).length), 'Owned by Marketing')
      : '';
    var perf = [['Website clicks', clicks, [32, 48, 40, 55, 62, 58, 70]], ['New customers', newCust, [1, 2, 1, 3, 2, 4, newCust]], ['Revenue from marketing', money(mktRev) || '$0', [20, 35, 28, 42, 50, 45, 60]], ['Email open rate', '42%', [30, 38, 35, 44, 40, 48, 42]], ['Instagram engagement', '6.8%', [4, 5, 5.5, 6, 7, 6.2, 6.8]]].map(function (r) {
      return '<div class="jos-mkt-metric"><div><div class="jos-kpi-lbl">' + esc(r[0]) + '</div><div class="jos-kpi-v" style="font-size:18px">' + esc(String(r[1])) + '</div></div>' + sparkHtml(r[2]) + '</div>';
    }).join('');
    var cal = m.calendar.slice(0, 5).map(function (item) {
      return '<div class="jos-mkt-cal"><span class="jos-pill ' + esc(item.status === 'scheduled' ? 'info' : 'quote') + '">' + esc(item.status || 'draft') + '</span><span>' + esc(item.title) + ' · ' + esc(String(item.scheduledAt || '').slice(0, 10)) + '</span></div>';
    }).join('');
    var ai = d ? d.aiInsightCard({
      kicker: 'AI · Marketing',
      body: root._josMktAiBody || ('Score ' + score + ' — focus on win-back and seasonal pushes. Audiences resolve from Customers and Leads (no duplicate CRM).'),
      actionsHtml: dsBtn('mkt-ai-budget', 'Budget tip', 'jos-btn jos-btn-sm') + dsBtn('go-ask', 'Ask Hubly', 'jos-btn-brand jos-btn-sm')
    }) : '';
    return '<div class="jos-mkt-overview">' +
      '<div class="jos-mkt-head">' + ring + '<div><h2 class="jos-mkt-title">Keep the booking link warm</h2><p class="jos-muted">Campaigns, templates, and automations — audiences read from Customers and Leads.</p>' +
      (d ? d.actionToolbar(dsBtn('preview', 'Preview Storefront', 'jos-btn jos-btn-sm') + dsBtn('mkt-open-customer', 'Open sample customer', 'jos-btn jos-btn-sm') + dsBtn('mkt-go-leads', 'Open leads', 'jos-btn jos-btn-sm')) : '') +
      '</div></div>' +
      (kpis ? '<div class="jos-mkt-kpis jos-mt">' + kpis + '</div>' : '') +
      '<div class="jos-mkt-3col jos-mt">' +
        '<div class="jos-card"><div class="jos-kicker">Today actions</div><div class="jos-stack jos-mt">' + actions.map(function (a) {
          return '<div class="jos-mkt-act"><div><strong>' + esc(a.t) + '</strong><div class="jos-muted">' + esc(a.s) + '</div></div>' +
            '<button type="button" class="jos-btn jos-btn-brand jos-btn-sm" data-jos-act="' + esc(a.act) + '" data-jos-mkt-ask="' + esc(a.q) + '">Generate</button></div>';
        }).join('') + '</div></div>' +
        '<div class="jos-card"><div class="jos-kicker">Performance</div><div class="jos-stack jos-mt">' + perf + '</div></div>' +
        '<div class="jos-card"><div class="jos-kicker">Content calendar</div><div class="jos-stack jos-mt">' + (cal || '<div class="jos-muted">No calendar items yet.</div>') + '</div></div>' +
      '</div>' +
      (ai ? '<div class="jos-mt">' + ai + '</div>' : '') +
      '</div>';
  }

  function renderMktCampaignsTab(root) {
    var m = ensureMarketingOsState();
    var q = String(root._josMktQ || '').toLowerCase();
    var list = m.campaigns.filter(function (c) {
      if (!q) return true;
      var blob = [c.name, c.channel, c.body, mktServiceName(c.serviceId), mktSegmentLabel(c.audience && c.audience.key)].join(' ').toLowerCase();
      return blob.indexOf(q) >= 0;
    });
    var cards = list.length ? list.map(function (c) {
      var aud = c.audience && c.audience.key ? c.audience.key : 'all_customers';
      var svc = mktServiceName(c.serviceId);
      return '<div class="jos-mkt-card" data-jos-mkt-camp="' + esc(c.id) + '">' +
        '<div class="jos-mkt-card-h"><div><strong>' + esc(c.name) + '</strong><div class="jos-muted">' + esc(MKT_CHANNEL_LABEL[c.channel] || c.channel) + ' · ' + esc(mktSegmentLabel(aud)) + ' (' + mktSegmentCount(aud) + ')' + (svc ? ' · ' + esc(svc) : '') + '</div></div>' + mktCampStatusBadge(c.status) + '</div>' +
        '<p class="jos-mkt-card-body">' + esc(c.body || c.subject || '') + '</p>' +
        '<div class="jos-mkt-card-meta">Scheduled ' + esc(String(c.scheduledAt || '—').slice(0, 10)) +
        (c.stats && c.stats.attributedRevenue ? ' · Attributed ' + esc(money(c.stats.attributedRevenue) || '$0') : '') + '</div>' +
        '<div class="jos-mkt-card-foot">' +
          '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="mkt-camp-edit" data-jos-mkt-camp="' + esc(c.id) + '">Edit</button>' +
          ['draft', 'scheduled', 'active', 'paused'].map(function (st) {
            return '<button type="button" class="jos-btn jos-btn-sm' + (c.status === st ? ' jos-btn-brand' : '') + '" data-jos-act="mkt-camp-status" data-jos-mkt-status="' + st + '" data-jos-mkt-camp="' + esc(c.id) + '">' + esc(st) + '</button>';
          }).join('') +
        '</div></div>';
    }).join('') : (DS() ? DS().emptyState('No campaigns', 'Create a campaign to reach your audiences.') : '<div class="jos-empty">No campaigns yet.</div>');
    return (DS() ? DS().sectionHeader('Campaigns', 'Owned outreach — audiences are segment keys.', dsBtn('mkt-camp-create-open', '+ Create campaign', 'jos-btn-brand jos-btn-sm')) : '') +
      '<div class="jos-mkt-toolbar jos-mt">' + (DS() ? DS().searchBar('jos-mkt-search', 'Search campaigns…', root._josMktQ || '') : '') + '</div>' +
      '<div class="jos-mkt-grid jos-mt">' + cards + '</div>' + renderMktCampaignModal(root);
  }

  function renderMktEmailTab(root) {
    var tpls = mktTemplates('email');
    var rows = tpls.map(function (t) {
      return '<div class="jos-mkt-card"><div class="jos-mkt-card-h"><strong>' + esc(t.name) + '</strong>' + mktCampStatusBadge('draft') + '</div>' +
        '<div class="jos-muted">' + esc(t.subject || '') + '</div>' +
        '<p class="jos-mkt-card-body">' + esc(t.body || '') + '</p>' +
        '<div class="jos-mkt-card-foot">' +
          '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="mkt-tpl-edit" data-jos-mkt-tpl="' + esc(t.id) + '" data-jos-mkt-kind="email">Edit</button>' +
          '<button type="button" class="jos-btn jos-btn-brand jos-btn-sm" data-jos-act="mkt-email-send" data-jos-mkt-tpl="' + esc(t.id) + '">Queue send</button>' +
        '</div></div>';
    }).join('');
    return DS().sectionHeader('Email templates', 'OS templates — live send is Stage 2 (Resend).',
      '<button type="button" class="jos-btn jos-btn-brand jos-btn-sm" data-jos-act="mkt-tpl-create" data-jos-mkt-kind="email">New template</button>') +
      '<div class="jos-mkt-grid jos-mt">' + (rows || DS().emptyState('No email templates', 'Create a template to reuse in campaigns.')) + '</div>' +
      renderMktTemplateModal(root, 'email');
  }

  function renderMktSmsTab(root) {
    var tpls = mktTemplates('sms');
    var rows = tpls.map(function (t) {
      return '<div class="jos-mkt-card"><div class="jos-mkt-card-h"><strong>' + esc(t.name) + '</strong></div>' +
        '<p class="jos-mkt-card-body">' + esc(t.body || '') + '</p>' +
        '<div class="jos-mkt-card-foot">' +
          '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="mkt-tpl-edit" data-jos-mkt-tpl="' + esc(t.id) + '" data-jos-mkt-kind="sms">Edit</button>' +
          '<button type="button" class="jos-btn jos-btn-brand jos-btn-sm" data-jos-act="mkt-sms-broadcast" data-jos-mkt-tpl="' + esc(t.id) + '">Draft broadcast</button>' +
        '</div></div>';
    }).join('');
    var draft = '<div class="jos-card jos-mt"><div class="jos-kicker">Broadcast draft</div>' +
      '<textarea id="jos-mkt-sms-broadcast" class="jos-textarea jos-mt" placeholder="SMS broadcast copy…">' + esc(root._josMktSmsDraft || '') + '</textarea>' +
      '<div class="jos-btn-row jos-mt">' + dsBtn('mkt-sms-queue', 'Queue broadcast (OS)', 'jos-btn-brand jos-btn-sm') + '</div>' +
      '<p class="jos-muted jos-mt">Twilio send — Stage 2 · not connected</p></div>';
    return DS().sectionHeader('SMS', 'Templates and broadcast drafts — Twilio is Stage 2.',
      '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="mkt-tpl-create" data-jos-mkt-kind="sms">New SMS template</button>') +
      '<div class="jos-mkt-grid jos-mt">' + rows + '</div>' + draft + renderMktTemplateModal(root, 'sms');
  }

  function renderMktSocialTab(root) {
    var m = ensureMarketingOsState();
    var cal = m.calendar.map(function (item) {
      return '<div class="jos-mkt-card"><div class="jos-mkt-card-h"><strong>' + esc(item.title) + '</strong>' + mktCampStatusBadge(item.status) + '</div>' +
        '<div class="jos-muted">' + esc(item.channel || 'social') + ' · ' + esc(String(item.scheduledAt || '').slice(0, 10)) + '</div>' +
        '<p class="jos-mkt-card-body">' + esc(item.body || '') + '</p>' +
        '<div class="jos-mkt-card-foot">' +
          '<button type="button" class="jos-btn jos-btn-brand jos-btn-sm" data-jos-act="mkt-social-publish" data-jos-mkt-cal="' + esc(item.id) + '">Publish</button>' +
        '</div></div>';
    }).join('');
    var posts = mktTemplates('social').map(function (t) {
      return '<div class="jos-mkt-card"><div class="jos-mkt-card-h"><strong>' + esc(t.name) + '</strong></div><p class="jos-mkt-card-body">' + esc(t.body || '') + '</p>' +
        '<div class="jos-mkt-card-foot"><button type="button" class="jos-btn jos-btn-sm" data-jos-act="mkt-tpl-edit" data-jos-mkt-tpl="' + esc(t.id) + '" data-jos-mkt-kind="social">Edit</button></div></div>';
    }).join('');
    return DS().sectionHeader('Social and calendar', 'Draft posts — Meta publish is Stage 2.', dsBtn('mkt-cal-add', 'Add calendar item', 'jos-btn-brand jos-btn-sm')) +
      '<div class="jos-mkt-2col jos-mt"><div><div class="jos-kicker">Calendar</div><div class="jos-mkt-grid">' + (cal || '<div class="jos-muted">No items scheduled.</div>') + '</div></div>' +
      '<div><div class="jos-kicker">Post drafts</div><div class="jos-mkt-grid">' + posts + '</div></div></div>' +
      renderMktTemplateModal(root, 'social');
  }

  function renderMktAdsTab(root) {
    var m = ensureMarketingOsState();
    var d = DS();
    var cards = m.ads.map(function (ad) {
      var cpl = ad.leads ? Math.round((ad.spend || 0) / Math.max(1, ad.leads)) : (ad.cpl || 0);
      return '<div class="jos-mkt-card"><div class="jos-mkt-card-h"><strong>' + esc(ad.name) + '</strong>' + mktCampStatusBadge(ad.status) + '</div>' +
        '<div class="jos-mkt-ad-kpis">' +
          (d ? d.metricCard('Spend (demo)', money(ad.spend) || '$0', 'OS only') : '') +
          (d ? d.metricCard('Leads', String(ad.leads || 0), 'OS demo') : '') +
          (d ? d.metricCard('CPL', money(cpl) || '$0', 'Spend / leads') : '') +
        '</div>' +
        '<div class="jos-muted jos-mt">Clicks ' + esc(String(ad.clicks || 0)) + ' · Impressions ' + esc(String(ad.impressions || 0)) + '</div>' +
        '<div class="jos-mkt-card-foot jos-mt">' +
          dsBtn('mkt-ads-lead-form', 'Lead Forms', 'jos-btn jos-btn-sm') +
          dsBtn('mkt-ads-meta', 'Connect Meta', 'jos-btn jos-btn-sm') +
        '</div></div>';
    }).join('');
    var attr = d ? d.metricCard('Attributed revenue', money(mktAttributedRevenueDemo()) || '$0', 'Read from completed jobs — demo') : '';
    return '<div class="jos-muted jos-mb">OS performance cards — Meta Ads API is Stage 2 · not connected.</div>' +
      (attr ? '<div class="jos-mkt-kpis">' + attr + '</div>' : '') +
      '<div class="jos-mkt-grid jos-mt">' + cards + '</div>';
  }

  function renderMktAutomationsTab(root) {
    var m = ensureMarketingOsState();
    var rows = m.automations.map(function (a) {
      var on = !!m.toggles[a.id];
      return '<div class="jos-mkt-auto"><div><strong>' + esc(a.name) + '</strong><div class="jos-muted">' + esc(a.desc || '') + '</div></div>' +
        '<label class="jos-toggle"><input type="checkbox" data-jos-act="mkt-auto-toggle" data-jos-mkt-auto="' + esc(a.id) + '"' + (on ? ' checked' : '') + '><span></span></label></div>';
    }).join('');
    return DS().sectionHeader('Automations', 'OS rules only — live triggers are Stage 2.') +
      '<div class="jos-card jos-mt"><div class="jos-toggle-row">' + rows + '</div></div>';
  }

  function renderMktCouponsTab(root) {
    var m = ensureMarketingOsState();
    var rows = m.coupons.map(function (c) {
      var val = c.type === 'flat' ? money(c.discount) : (c.discount + '%');
      return '<div class="jos-mkt-card"><div class="jos-mkt-card-h"><strong>' + esc(c.code) + '</strong>' + (DS() ? DS().statusBadge(c.active ? 'Active' : 'Inactive', c.active ? 'ok' : 'lost') : '') + '</div>' +
        '<div class="jos-muted">' + esc(c.label || '') + ' · ' + esc(val || '') + '</div>' +
        '<div class="jos-muted">Uses ' + esc(String(c.uses || 0)) + ' (OS)</div></div>';
    }).join('');
    return DS().sectionHeader('Coupons', 'Owned by Marketing — apply on Storefront checkout in Stage 2.', dsBtn('mkt-coupon-create', '+ Create coupon', 'jos-btn-brand jos-btn-sm')) +
      '<div class="jos-mkt-grid jos-mt">' + (rows || DS().emptyState('No coupons', 'Create a promo code for campaigns.')) + '</div>' +
      renderMktCouponModal(root);
  }

  function renderMktAiTab(root) {
    var d = DS();
    var tools = [
      ['mkt-ai-campaign', 'Generate campaign', 'Draft a multi-channel campaign into owned records.'],
      ['mkt-ai-post', 'Generate social post', 'Add a social template and calendar item.'],
      ['mkt-ai-email', 'Write email', 'Create an email template body.'],
      ['mkt-ai-sms', 'Write SMS', 'Create a short SMS template.'],
      ['mkt-ai-budget', 'Budget suggestion', 'OS tip from score and CPL demo.']
    ];
    var tiles = tools.map(function (t) {
      return '<div class="jos-mkt-ai-tile"><h3>' + esc(t[1]) + '</h3><p class="jos-muted">' + esc(t[2]) + '</p>' +
        dsBtn(t[0], 'Generate', 'jos-btn-brand jos-btn-sm') + '</div>';
    }).join('');
    var tip = d ? d.aiInsightCard({ kicker: 'Latest AI output', body: root._josMktAiOut || 'Generate a campaign, post, or template — results save to Marketing OS records.' }) : '';
    return DS().sectionHeader('AI Studio', 'In-app generators — no external ad AI required for Stage 1.') +
      '<div class="jos-mkt-ai-grid jos-mt">' + tiles + '</div>' +
      (tip ? '<div class="jos-mt">' + tip + '</div>' : '');
  }

  function renderMktTabBody(root, tab) {
    if (tab === 'overview') return renderMktOverviewTab(root);
    if (tab === 'campaigns') return renderMktCampaignsTab(root);
    if (tab === 'email') return renderMktEmailTab(root);
    if (tab === 'sms') return renderMktSmsTab(root);
    if (tab === 'social') return renderMktSocialTab(root);
    if (tab === 'ads') return renderMktAdsTab(root);
    if (tab === 'automations') return renderMktAutomationsTab(root);
    if (tab === 'coupons') return renderMktCouponsTab(root);
    if (tab === 'ai') return renderMktAiTab(root);
    return renderMktOverviewTab(root);
  }

  function renderMarketingPageInner(root) {
    ensureMarketingOsState();
    var tab = root._josMktTab || 'overview';
    var d = DS();
    var tabsHtml = '<div class="jos-tabs jos-mkt-tabs">' + MKT_TABS.map(function (t) {
      return '<button type="button" class="jos-tab' + (tab === t[0] ? ' on' : '') + '" data-jos-mkt-tab="' + t[0] + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div>';
    var head = d ? d.pageHeader('Marketing', 'Campaigns that fill the calendar — audiences read from Customers and Leads.', dsBtn('preview', 'Preview Storefront', 'jos-btn jos-btn-sm') + dsBtn('mkt-go-pipeline', 'Pipeline', 'jos-btn jos-btn-sm') + dsBtn('go-ask', 'Ask Hubly', 'jos-btn-brand jos-btn-sm')) :
      '<div class="jos-page-head"><div><h1>Marketing</h1><p>Campaigns that fill the calendar.</p></div></div>';
    root.innerHTML =
      '<div class="jos-page jos-mkt-page">' +
      head + tabsHtml +
      '<div class="jos-mkt-body">' + renderMktTabBody(root, tab) + '</div></div>';
    bindRoot(root);
    wireMarketingRoot(root);
  }

  function renderMarketing() {
    var root = ownPixelView('v-marketing', 'jos-marketing-root');
    if (!root) return;
    updateChrome('marketing');
    root.innerHTML = '<div class="jos-page jos-mkt-page"><div class="jos-home-loading">Loading Marketing…</div></div>';
    try { renderMarketingPageInner(root); }
    catch (err) {
      console.warn('HublyJourneyOS Marketing', err);
      root.innerHTML = '<div class="jos-page"><div class="jos-empty jos-error-state"><strong>Marketing could not load</strong><p class="jos-muted">Refresh and try again.</p><div class="jos-mt"><button type="button" class="jos-btn jos-btn-brand jos-btn-sm" onclick="HublyJourneyOS.renderMarketing()">Retry</button></div></div></div>';
    }
  }

  function wireMarketingRoot(root) {
    if (root._josMktBound) return;
    root._josMktBound = true;
    root.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'jos-mkt-search') {
        root._josMktQ = e.target.value;
        clearTimeout(root._josMktSearchT);
        root._josMktSearchT = setTimeout(function () { renderMarketing(); }, 140);
      }
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (root._josMktCampModal || root._josMktTplModal || root._josMktCpnModal) {
          root._josMktCampModal = false;
          root._josMktTplModal = false;
          root._josMktCpnModal = false;
          root._josMktCampDraft = null;
          root._josMktTplDraft = null;
          root._josMktCpnDraft = null;
          return renderMarketing();
        }
      }
    });
  }

  function readMktCampDraft() {
    var base = (el('jos-marketing-root') && el('jos-marketing-root')._josMktCampDraft) || {};
    return {
      id: base.id || null,
      name: (el('jos-mkt-camp-name') || {}).value || '',
      channel: (el('jos-mkt-camp-channel') || {}).value || 'email',
      audience: { type: 'segment', key: (el('jos-mkt-camp-audience') || {}).value || 'all_customers' },
      serviceId: (el('jos-mkt-camp-service') || {}).value || '',
      subject: (el('jos-mkt-camp-subject') || {}).value || '',
      body: (el('jos-mkt-camp-body') || {}).value || '',
      scheduledAt: (el('jos-mkt-camp-schedule') || {}).value || todayStr(),
      status: (el('jos-mkt-camp-status') || {}).value || 'draft'
    };
  }

  function handleMarketingAct(act, t) {
    var root = el('jos-marketing-root');
    if (!root) return;
    ensureMarketingOsState();
    var m = S().marketingOs;
    var campId = t && (t.getAttribute('data-jos-mkt-camp') || (t.closest('[data-jos-mkt-camp]') && t.closest('[data-jos-mkt-camp]').getAttribute('data-jos-mkt-camp')));
    var tplId = t && t.getAttribute('data-jos-mkt-tpl');
    var kind = t && t.getAttribute('data-jos-mkt-kind');
    var autoId = t && t.getAttribute('data-jos-mkt-auto');
    try {
      if (act === 'mkt-camp-create-open') {
        root._josMktCampModal = true;
        root._josMktCampDraft = { status: 'draft', channel: 'email', audience: { type: 'segment', key: 'all_customers' } };
        return renderMarketing();
      }
      if (act === 'mkt-camp-edit' && campId) {
        var camp = m.campaigns.find(function (c) { return String(c.id) === String(campId); });
        if (!camp) return toast('Campaign not found');
        root._josMktCampModal = true;
        root._josMktCampDraft = Object.assign({}, camp, { audience: camp.audience || { type: 'segment', key: 'all_customers' } });
        return renderMarketing();
      }
      if (act === 'mkt-camp-cancel') {
        root._josMktCampModal = false;
        root._josMktCampDraft = null;
        return renderMarketing();
      }
      if (act === 'mkt-camp-save') {
        var draft = readMktCampDraft();
        if (!draft.name.trim()) { toast('Name is required'); return; }
        if (draft.id) {
          var idx = m.campaigns.findIndex(function (c) { return String(c.id) === String(draft.id); });
          if (idx >= 0) m.campaigns[idx] = Object.assign({}, m.campaigns[idx], draft);
        } else {
          m.campaigns.unshift(Object.assign({}, draft, { id: mktId('mkt_camp'), stats: {} }));
        }
        root._josMktCampModal = false;
        root._josMktCampDraft = null;
        toast('Campaign saved (OS)');
        return renderMarketing();
      }
      if (act === 'mkt-camp-status' && campId) {
        var st = t.getAttribute('data-jos-mkt-status');
        var c = m.campaigns.find(function (x) { return String(x.id) === String(campId); });
        if (c && st) { c.status = st; toast('Campaign · ' + st); return renderMarketing(); }
        return;
      }
      if (act === 'mkt-tpl-create') {
        root._josMktTplModal = true;
        root._josMktTplKind = kind || 'email';
        root._josMktTplDraft = { kind: root._josMktTplKind };
        return renderMarketing();
      }
      if (act === 'mkt-tpl-edit' && tplId) {
        var tpl = m.templates.find(function (x) { return String(x.id) === String(tplId); });
        if (!tpl) return;
        root._josMktTplModal = true;
        root._josMktTplKind = tpl.kind || kind || 'email';
        root._josMktTplDraft = Object.assign({}, tpl);
        return renderMarketing();
      }
      if (act === 'mkt-tpl-cancel') {
        root._josMktTplModal = false;
        root._josMktTplDraft = null;
        return renderMarketing();
      }
      if (act === 'mkt-tpl-save') {
        var td = {
          id: root._josMktTplDraft && root._josMktTplDraft.id,
          kind: root._josMktTplKind || 'email',
          name: (el('jos-mkt-tpl-name') || {}).value || 'Template',
          subject: (el('jos-mkt-tpl-subject') || {}).value || '',
          body: (el('jos-mkt-tpl-body') || {}).value || ''
        };
        if (td.id) {
          var ti = m.templates.findIndex(function (x) { return String(x.id) === String(td.id); });
          if (ti >= 0) m.templates[ti] = Object.assign({}, m.templates[ti], td);
        } else {
          m.templates.unshift(Object.assign({}, td, { id: mktId('mkt_tpl_' + td.kind) }));
        }
        root._josMktTplModal = false;
        root._josMktTplDraft = null;
        toast('Template saved');
        return renderMarketing();
      }
      if (act === 'mkt-email-send') return toast('Queued for send (OS) — Resend · Stage 2 · not connected');
      if (act === 'mkt-sms-broadcast' || act === 'mkt-sms-queue') return toast('Broadcast queued (OS) — Twilio · Stage 2 · not connected');
      if (act === 'mkt-social-publish') return toast('Meta publish — Stage 2 · not connected');
      if (act === 'mkt-ads-lead-form' || act === 'mkt-ads-meta') return toast('Meta Lead Ads — Stage 2 · not connected');
      if (act === 'mkt-auto-toggle' && autoId) {
        m.toggles[autoId] = !!(t && t.checked);
        var au = m.automations.find(function (a) { return a.id === autoId; });
        if (au) au.on = m.toggles[autoId];
        toast((au ? au.name : 'Automation') + (m.toggles[autoId] ? ' on' : ' off'));
        return renderMarketing();
      }
      if (act === 'mkt-coupon-create') {
        root._josMktCpnModal = true;
        root._josMktCpnDraft = {};
        return renderMarketing();
      }
      if (act === 'mkt-coupon-cancel') {
        root._josMktCpnModal = false;
        root._josMktCpnDraft = null;
        return renderMarketing();
      }
      if (act === 'mkt-coupon-save') {
        var cp = {
          id: mktId('mkt_cpn'),
          code: String((el('jos-mkt-cpn-code') || {}).value || '').trim().toUpperCase(),
          label: (el('jos-mkt-cpn-label') || {}).value || '',
          type: (el('jos-mkt-cpn-type') || {}).value || 'pct',
          discount: Number((el('jos-mkt-cpn-discount') || {}).value) || 0,
          active: true,
          uses: 0
        };
        if (!cp.code) { toast('Coupon code required'); return; }
        m.coupons.unshift(cp);
        root._josMktCpnModal = false;
        root._josMktCpnDraft = null;
        toast('Coupon created');
        return renderMarketing();
      }
      if (act === 'mkt-cal-add') {
        m.calendar.unshift({ id: mktId('mkt_cal'), title: 'New post', channel: 'instagram', scheduledAt: todayStr(), status: 'draft', body: 'Draft caption with Book Now CTA.' });
        toast('Calendar item added');
        return renderMarketing();
      }
      if (act === 'mkt-go-leads') return switchNav('leads');
      if (act === 'mkt-go-pipeline') return switchNav('pipeline');
      if (act === 'mkt-open-customer') {
        var cid = mktSampleCustomerId('all_customers');
        if (cid) return openCustomerProfile(cid);
        return toast('Add a customer first');
      }
      if (act === 'mkt-ai-campaign' || act === 'mkt-ai-post' || act === 'mkt-ai-email' || act === 'mkt-ai-sms') {
        var askQ = t && t.getAttribute('data-jos-mkt-ask');
        if (askQ) ask(askQ);
        var biz = S().biz || 'your business';
        if (act === 'mkt-ai-campaign') {
          m.campaigns.unshift({ id: mktId('mkt_camp'), name: 'AI · Weekend promo', channel: 'multi', status: 'draft', audience: { type: 'segment', key: 'all_customers' }, body: 'Limited slots this weekend for ' + biz + ' — book online.', scheduledAt: todayStr(), stats: {} });
          root._josMktAiOut = 'Campaign draft added to Campaigns tab.';
        } else if (act === 'mkt-ai-post') {
          m.templates.unshift({ id: mktId('mkt_tpl_social'), kind: 'social', name: 'AI · Social post', body: 'Fresh results from ' + biz + ' — tap Book Now.' });
          m.calendar.unshift({ id: mktId('mkt_cal'), title: 'AI social post', channel: 'instagram', scheduledAt: todayStr(), status: 'draft', body: 'Generated post with booking CTA.' });
          root._josMktAiOut = 'Social template and calendar item created.';
        } else if (act === 'mkt-ai-email') {
          m.templates.unshift({ id: mktId('mkt_tpl_email'), kind: 'email', name: 'AI · Nurture email', subject: 'Thanks from ' + biz, body: 'Hi {{name}}, thanks for choosing us. Ready to rebook?' });
          root._josMktAiOut = 'Email template saved to Email tab.';
        } else {
          m.templates.unshift({ id: mktId('mkt_tpl_sms'), kind: 'sms', name: 'AI · SMS', body: 'Hi {{name}} — reply BOOK for your next visit with ' + biz + '.' });
          root._josMktAiOut = 'SMS template saved.';
        }
        m.score = Math.min(96, marketingScore() + 2);
        toast('Generated into Marketing OS');
        root._josMktTab = act === 'mkt-ai-campaign' ? 'campaigns' : (act === 'mkt-ai-post' ? 'social' : (act === 'mkt-ai-email' ? 'email' : 'sms'));
        return renderMarketing();
      }
      if (act === 'mkt-ai-budget') {
        var ad = m.ads[0] || { spend: 0, leads: 1 };
        var cpl = ad.leads ? Math.round((ad.spend || 0) / ad.leads) : 15;
        root._josMktAiBody = 'Demo CPL ' + money(cpl) + ' — consider shifting 20% spend to retargeting completed-job audiences. Live Meta sync is Stage 2.';
        root._josMktAiOut = root._josMktAiBody;
        toast('Budget tip generated (OS)');
        return renderMarketing();
      }
    } catch (err) {
      console.warn('HublyJourneyOS mkt act', act, err);
      toast('Failed — try again');
    }
  }

  var REV_TABS = [
    ['overview', 'Overview'],
    ['inbox', 'Inbox'],
    ['needs_reply', 'Needs Reply'],
    ['requests', 'Requests'],
    ['analytics', 'Analytics'],
    ['connections', 'Connections']
  ];
  var REV_DATE_RANGES = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'This Month', 'Last Month', 'This Year', 'Custom'];
  var REV_SOURCE_LABEL = { google: 'Google', facebook: 'Facebook', yelp: 'Yelp', website: 'Website', hubly: 'Hubly', manual: 'Manual' };
  var REV_SOURCE_TONE = { google: 'info', facebook: 'booked', yelp: 'warn', website: 'quote', hubly: 'ok', manual: 'open' };
  var REV_PLATFORM_META = {
    google: { label: 'Google', cls: 'g', connected: true },
    facebook: { label: 'Facebook', cls: 'fb', connected: true },
    yelp: { label: 'Yelp', cls: 'yelp', connected: false },
    website: { label: 'Website', cls: 'web', connected: true },
    hubly: { label: 'Hubly', cls: 'hub', connected: true }
  };
  var _revJobSubscribed = false;

  function revId(prefix) { return (prefix || 'rev') + '_' + Math.random().toString(36).slice(2, 9); }
  function hublyEvents() { return global.HublyEvents || null; }
  function publishRevEvent(type, payload) {
    var ev = hublyEvents();
    if (ev && typeof ev.publish === 'function') ev.publish(type, payload);
  }
  function normalizeReviewSource(src) {
    var s = String(src || 'manual').toLowerCase();
    if (/google|gmb/.test(s)) return 'google';
    if (/facebook|fb|meta/.test(s)) return 'facebook';
    if (/yelp/.test(s)) return 'yelp';
    if (/website|web/.test(s)) return 'website';
    if (/hubly/.test(s)) return 'hubly';
    return 'manual';
  }
  function normalizeReview(r) {
    if (!r || typeof r !== 'object') return null;
    var src = normalizeReviewSource(r.source || r.src);
    var hasReply = !!(r.reply || r.respondedAt);
    var tags = Array.isArray(r.tags) ? r.tags : (r.tags ? String(r.tags).split(',').map(function (x) { return x.trim(); }).filter(Boolean) : []);
    return {
      id: r.id || revId('rev'),
      name: r.name || r.author || 'Customer',
      text: r.text || r.body || '',
      rating: Math.min(5, Math.max(1, Number(r.rating) || 5)),
      source: src,
      customerId: r.customerId || null,
      jobId: r.jobId || null,
      employee: r.employee || null,
      service: r.service || null,
      tags: tags,
      status: r.status || (hasReply ? 'replied' : 'new'),
      reply: r.reply || null,
      at: r.at || r.date || todayStr(),
      respondedAt: r.respondedAt || (r.reply ? todayStr() : null)
    };
  }
  function seedReviewsFromLegacy() {
    var manual = S().website?.manualReviews || S().manualReviews || [];
    var demo = [
      { name: 'Alex P.', text: 'Showed up on time and the finish looked brand new. Professional crew and spotless cleanup.', rating: 5, source: 'google', tags: ['Professional', 'Fast', 'Clean'], service: 'Full detail', employee: 'Marcus' },
      { name: 'Sam R.', text: 'Easy booking and clear communication from start to finish. Will definitely book again.', rating: 5, source: 'facebook', tags: ['Friendly', 'Communication'], service: 'Interior wash' },
      { name: 'Jordan M.', text: 'Will book again — already told two neighbors. Quality exceeded expectations.', rating: 5, source: 'website', tags: ['Quality', 'Friendly'], service: 'Ceramic coating' },
      { name: 'Riley K.', text: 'Great attention to detail on my truck. Punctual and respectful of my property.', rating: 5, source: 'google', tags: ['Professional', 'Punctual'], service: 'Truck detail' },
      { name: 'Casey L.', text: 'Solid work overall. A bit of a wait on scheduling but worth it.', rating: 4, source: 'yelp', tags: ['Quality'], service: 'Monthly wash' },
      { name: 'Morgan T.', text: 'Luxury-level finish on my SUV. The team was courteous and efficient.', rating: 5, source: 'google', tags: ['Luxury', 'Professional'], service: 'Premium detail', employee: 'Dana' },
      { name: 'Taylor W.', text: 'Quick turnaround and friendly service. Highly recommend for busy families.', rating: 5, source: 'hubly', tags: ['Fast', 'Friendly'], service: 'Express wash' },
      { name: 'Jamie H.', text: 'Good value and consistent results every visit.', rating: 4, source: 'facebook', tags: ['Friendly'], service: 'Membership wash', status: 'new' }
    ];
    return (manual.length ? manual : demo).map(function (r, i) {
      return normalizeReview(Object.assign({}, r, { id: revId('rev_seed_' + i) }));
    }).filter(Boolean);
  }
  function recalcReviewsAnalytics(reviews) {
    var list = reviews || [];
    var count = list.length;
    if (!count) return { rating: 0, count: 0, responseRate: 0, fiveStarPct: 0, newThisMonth: 0, avgResponseHours: 0, ratingDelta: 0, newDeltaPct: 0 };
    var sum = list.reduce(function (s, rv) { return s + (Number(rv.rating) || 0); }, 0);
    var replied = list.filter(function (rv) { return rv.status === 'replied' || rv.reply; }).length;
    var five = list.filter(function (rv) { return Number(rv.rating) >= 5; }).length;
    var monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    var newMo = list.filter(function (rv) { return String(rv.at || '').slice(0, 10) >= monthStart; }).length;
    return {
      rating: Math.round((sum / count) * 10) / 10,
      count: count,
      responseRate: Math.round((replied / count) * 100),
      fiveStarPct: Math.round((five / count) * 100),
      newThisMonth: newMo,
      avgResponseHours: 1.8,
      ratingDelta: 0.2,
      newDeltaPct: 42
    };
  }
  function buildReviewsAiSummary(reviews) {
    var list = reviews || [];
    if (!list.length) return 'No reviews yet — request feedback after completed jobs to build your reputation.';
    return 'Customers rave about your quality of work (95%), punctuality (92%), and communication (90%). Strengths: professional service, attention to detail, easy booking. Opportunity: respond faster to 4-star reviews and ask for reviews after every completed job.';
  }
  function ensureReviewsOsState() {
    var st = S();
    if (!st.reviewsOs || typeof st.reviewsOs !== 'object') st.reviewsOs = {};
    var r = st.reviewsOs;
    if (!r._seeded) {
      r.reviews = seedReviewsFromLegacy();
      r.requests = [
        { id: revId('rev_req'), customerId: null, jobId: null, status: 'pending', channel: 'sms', createdAt: todayStr(), method: 'sms', sent: false, opened: false, clicked: false, completed: false, reminders: 0 },
        { id: revId('rev_req'), customerId: null, jobId: null, status: 'sent', channel: 'email', createdAt: todayStr(), method: 'email', sent: true, opened: true, clicked: true, completed: true, reminders: 1 }
      ];
      r.platforms = {
        google: { connected: true, reviews: 32, rating: 4.9, lastSync: '2h ago' },
        facebook: { connected: true, reviews: 14, rating: 5.0, lastSync: '2h ago' },
        yelp: { connected: false, reviews: 0, rating: 0, lastSync: '—' },
        website: { connected: true, reviews: 6, rating: 4.8, lastSync: '1d ago' },
        hubly: { connected: true, reviews: 4, rating: 5.0, lastSync: 'Live' }
      };
      r.goals = [
        { id: 'g1', label: '100 Reviews', current: 75, target: 100 },
        { id: 'g2', label: '5.0 Rating', current: 98, target: 100 },
        { id: 'g3', label: '100% Response Rate', current: 98, target: 100 }
      ];
      r.growthHistory = [12, 18, 22, 28, 35, 42, 48, 52, 56];
      r.requestStats = { sent: 122, completed: 87, conversionPct: 71, deltaPct: 18 };
      r._seeded = true;
    }
    if (!Array.isArray(r.reviews)) r.reviews = [];
    if (!Array.isArray(r.requests)) r.requests = [];
    if (!Array.isArray(r.replies)) r.replies = [];
    if (!r.platforms) r.platforms = REV_PLATFORM_META;
    if (!r.goals) r.goals = [];
    if (!r.growthHistory) r.growthHistory = [12, 18, 22, 28, 35, 42, 48, 52, 56];
    if (!r.requestStats) r.requestStats = { sent: 122, completed: 87, conversionPct: 71, deltaPct: 18 };
    r.reviews = r.reviews.map(function (x) { return normalizeReview(x); }).filter(Boolean);
    r.analytics = recalcReviewsAnalytics(r.reviews);
    if (!r.aiSummary) r.aiSummary = buildReviewsAiSummary(r.reviews);
    if (!_revJobSubscribed && hublyEvents()) {
      _revJobSubscribed = true;
      hublyEvents().on('job.completed', function (payload) {
        var ro = ensureReviewsOsState();
        var jobId = payload && payload.jobId;
        var customerId = payload && payload.customerId;
        if (!jobId && !customerId) return;
        var m = st.marketingOs;
        if (m && m.toggles && m.toggles.review_requests === false) return;
        var dup = ro.requests.some(function (req) {
          return (jobId && String(req.jobId) === String(jobId)) || (customerId && String(req.customerId) === String(customerId) && req.status === 'pending');
        });
        if (dup) return;
        ro.requests.unshift({
          id: revId('rev_req'),
          customerId: customerId || null,
          jobId: jobId || null,
          status: 'pending',
          channel: 'sms',
          createdAt: todayStr(),
          suggested: true
        });
        toast('Job completed — review request queued');
      });
    }
    return r;
  }
  function publishReputationChanged() {
    var r = ensureReviewsOsState();
    r.analytics = recalcReviewsAnalytics(r.reviews);
    publishRevEvent('reputation.changed', {
      rating: r.analytics.rating,
      count: r.analytics.count,
      responseRate: r.analytics.responseRate
    });
  }
  function revCustomerName(customerId) {
    if (!customerId) return 'Customer';
    var c = customers().find(function (x) { return String(x.id) === String(customerId); });
    return c ? c.name : 'Customer';
  }
  function revCompletedJobTargets() {
    return jobs().filter(function (j) { return j.status === 'completed' && !j.isBlock; }).map(function (j) {
      var c = customers().find(function (x) { return x.name === j.customer || String(x.id) === String(j.customerId); });
      var ro = ensureReviewsOsState();
      var already = ro.requests.some(function (req) {
        return String(req.jobId) === String(j.id) && req.status !== 'cancelled';
      });
      return {
        jobId: j.id,
        customerId: c ? c.id : (j.customerId || null),
        customerName: j.customer || (c ? c.name : 'Customer'),
        service: j.service,
        date: j.date,
        alreadyRequested: already
      };
    });
  }
  function revInitials(name) {
    var parts = String(name || 'C').trim().split(/\s+/);
    return (parts[0] ? parts[0][0] : 'C') + (parts[1] ? parts[1][0] : '');
  }
  function revAvatar(name, cls) {
    return '<span class="jos-rev-mc-ava' + (cls ? ' ' + cls : '') + '" aria-hidden="true">' + esc(revInitials(name).toUpperCase()) + '</span>';
  }
  function revSourceBadge(source) {
    var lbl = REV_SOURCE_LABEL[source] || source;
    return '<span class="jos-rev-mc-plat ' + esc((REV_PLATFORM_META[source] || {}).cls || 'web') + '">' + esc(lbl) + '</span>';
  }
  function revStars(n) {
    n = Math.round(Number(n) || 0);
    return '<span class="jos-rev-stars" aria-label="' + n + ' stars">' + '★'.repeat(Math.min(5, Math.max(0, n))) + '<span class="jos-rev-stars-dim">' + '★'.repeat(Math.max(0, 5 - n)) + '</span></span>';
  }
  function revMcSparkline(vals, up) {
    var data = vals || [3, 5, 4, 6, 5, 7, 8];
    var max = Math.max.apply(null, data.concat([1]));
    var pts = data.map(function (v, i) {
      var x = (i / Math.max(1, data.length - 1)) * 100;
      var y = 100 - (v / max) * 80 - 10;
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return '<svg class="jos-rev-mc-spark" viewBox="0 0 100 32" preserveAspectRatio="none"><polyline fill="none" stroke="' + (up ? '#22C55E' : '#F97316') + '" stroke-width="2" points="' + pts + '"/></svg>';
  }
  function revMcGrowthChart(vals) {
    var data = vals || [12, 18, 22, 28, 35, 42, 48, 52, 56];
    var max = Math.max.apply(null, data.concat([1]));
    var w = 100, h = 60;
    var pts = data.map(function (v, i) {
      var x = (i / Math.max(1, data.length - 1)) * w;
      var y = h - (v / max) * (h - 8) - 4;
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    var line = pts.join(' ');
    var area = '0,' + h + ' ' + line + ' ' + w + ',' + h;
    return '<svg class="jos-rev-mc-chart" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
      '<defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7C3AED" stop-opacity=".35"/><stop offset="100%" stop-color="#7C3AED" stop-opacity="0"/></linearGradient></defs>' +
      '<polygon fill="url(#revGrad)" points="' + area + '"/><polyline fill="none" stroke="#7C3AED" stroke-width="2" points="' + line + '"/></svg>';
  }
  function revFilterReviews(list, root) {
    var q = String(root._josRevQ || '').trim().toLowerCase();
    var rating = root._josRevRating;
    var platform = root._josRevPlatform;
    var tag = root._josRevTag;
    return (list || []).filter(function (rv) {
      if (rating && Number(rv.rating) !== Number(rating)) return false;
      if (platform && rv.source !== platform) return false;
      if (tag && !(rv.tags || []).some(function (t) { return String(t).toLowerCase() === String(tag).toLowerCase(); })) return false;
      if (!q) return true;
      var blob = [rv.name, rv.text, rv.service, rv.employee, rv.source].concat(rv.tags || []).join(' ').toLowerCase();
      return blob.indexOf(q) >= 0;
    });
  }
  function revMcFeedCard(rev, root) {
    var expanded = root._josRevExpanded === rev.id;
    var tags = (rev.tags || []).slice(0, 4).map(function (tag) {
      return '<button type="button" class="jos-rev-mc-tag" data-jos-act="rev-filter-tag" data-jos-rev-tag="' + esc(tag) + '">' + esc(tag) + '</button>';
    }).join('');
    return '<article class="jos-rev-mc-feed' + (expanded ? ' expanded' : '') + '" data-jos-act="rev-open" data-jos-rev-id="' + esc(rev.id) + '">' +
      '<button type="button" class="jos-rev-mc-feed-ava" data-jos-act="rev-open-customer" data-jos-rev-cust="' + esc(rev.customerId || '') + '" data-jos-rev-id="' + esc(rev.id) + '">' + revAvatar(rev.name) + '</button>' +
      '<div class="jos-rev-mc-feed-body">' +
        '<div class="jos-rev-mc-feed-top">' +
          '<button type="button" class="jos-rev-mc-name" data-jos-act="rev-open-customer" data-jos-rev-cust="' + esc(rev.customerId || '') + '">' + esc(rev.name) + '</button>' +
          '<button type="button" class="jos-rev-mc-stars-btn" data-jos-act="rev-filter-rating" data-jos-rev-rating="' + esc(String(rev.rating)) + '">' + revStars(rev.rating) + '</button>' +
          '<button type="button" data-jos-act="rev-filter-platform" data-jos-rev-platform="' + esc(rev.source) + '">' + revSourceBadge(rev.source) + '</button>' +
          '<span class="jos-rev-mc-date">' + esc(String(rev.at || '').slice(0, 10)) + '</span>' +
        '</div>' +
        '<p class="jos-rev-mc-text' + (expanded ? ' open' : '') + '" data-jos-act="rev-expand" data-jos-rev-id="' + esc(rev.id) + '">' + esc(rev.text) + '</p>' +
        (tags ? '<div class="jos-rev-mc-tags">' + tags + '</div>' : '') +
      '</div>' +
      '<div class="jos-rev-mc-feed-actions">' +
        '<button type="button" class="jos-btn jos-btn-brand jos-rev-mc-reply" data-jos-act="rev-select" data-jos-rev-id="' + esc(rev.id) + '">Reply</button>' +
        '<button type="button" class="jos-btn jos-rev-mc-ai-btn" data-jos-act="rev-ai-draft" data-jos-rev-id="' + esc(rev.id) + '">AI Reply</button>' +
        '<button type="button" class="jos-btn jos-rev-mc-cust" data-jos-act="rev-open-customer" data-jos-rev-cust="' + esc(rev.customerId || '') + '">Customer</button>' +
        '<button type="button" class="jos-rev-mc-more" data-jos-act="rev-more" data-jos-rev-id="' + esc(rev.id) + '" aria-label="More">⋯</button>' +
      '</div></article>';
  }
  function revReviewCard(rev, opts) {
    return revMcFeedCard(rev, opts && opts.root ? opts.root : { _josRevExpanded: null });
  }
  function renderRevRequestModal(root) {
    if (!root._josRevReqModal) return '';
    var d = root._josRevReqDraft || {};
    var step = d.step || 1;
    var targets = revCompletedJobTargets();
    var custOpts = customers().slice(0, 8).map(function (c) {
      return '<button type="button" class="jos-rev-mc-req-cust' + (d.customerId === c.id ? ' on' : '') + '" data-jos-act="rev-req-cust" data-jos-rev-cust="' + esc(c.id) + '">' + esc(c.name) + '</button>';
    }).join('');
    var jobOpts = '<option value="">— Pick completed job —</option>' + targets.map(function (t) {
      var val = String(t.jobId) + ':' + String(t.customerId || '');
      var lbl = t.customerName + ' · ' + (t.service || 'Job') + ' · ' + String(t.date || '').slice(0, 10);
      return '<option value="' + esc(val) + '"' + (d.targetKey === val ? ' selected' : '') + '>' + esc(lbl) + '</option>';
    }).join('');
    var channels = ['email', 'sms', 'qr', 'link', 'nfc'].map(function (ch) {
      var lbl = { email: 'Email', sms: 'SMS', qr: 'QR Code', link: 'Review Link', nfc: 'NFC Card' }[ch];
      return '<button type="button" class="jos-rev-mc-ch' + ((d.channel || 'sms') === ch ? ' on' : '') + '" data-jos-act="rev-req-channel" data-jos-rev-channel="' + ch + '">' + lbl + '</button>';
    }).join('');
    var body = step === 1
      ? '<div class="jos-rev-mc-req-step"><h4>Choose customer</h4><input class="jos-rev-mc-search" placeholder="Search customers…" value="' + esc(d.customerQ || '') + '" id="jos-rev-req-cust-q"><div class="jos-rev-mc-req-custs">' + custOpts + '</div></div>'
      : step === 2
        ? '<div class="jos-rev-mc-req-step"><h4>Choose job</h4><select id="jos-rev-req-target" class="jos-rev-mc-select">' + jobOpts + '</select></div>'
        : step === 3
          ? '<div class="jos-rev-mc-req-step"><h4>Delivery method</h4><div class="jos-rev-mc-channels">' + channels + '</div></div>'
          : '<div class="jos-rev-mc-req-step"><h4>Template preview</h4><p class="jos-rev-mc-preview">Hi {{customer}}, thanks for choosing {{business}}! We hope you loved your {{service}}. Would you mind leaving a quick review? {{review_link}}</p></div>';
    var foot = step < 4
      ? dsBtn('rev-req-next', 'Continue', 'jos-btn-brand') + dsBtn('rev-request-cancel', 'Cancel', 'jos-btn')
      : dsBtn('rev-request-save', 'Send Now', 'jos-btn-brand') + dsBtn('rev-req-schedule', 'Schedule', 'jos-btn') + dsBtn('rev-request-cancel', 'Cancel', 'jos-btn');
    return '<div class="jos-rev-mc-overlay" data-jos-rev-modal="1"><div class="jos-rev-mc-modal">' +
      '<div class="jos-rev-mc-modal-head"><h3>Request a review</h3><span class="jos-muted">Step ' + step + ' of 4</span></div>' + body +
      '<div class="jos-rev-mc-modal-foot">' + foot + '</div></div></div>';
  }
  function renderRevRecordModal(root) {
    if (!root._josRevRecModal) return '';
    var d = root._josRevRecDraft || {};
    var srcOpts = ['google', 'facebook', 'yelp', 'website', 'manual'].map(function (s) {
      return '<option value="' + s + '"' + ((d.source || 'manual') === s ? ' selected' : '') + '>' + esc(REV_SOURCE_LABEL[s]) + '</option>';
    }).join('');
    return '<div class="jos-rev-mc-overlay" data-jos-rev-modal="1"><div class="jos-rev-mc-modal">' +
      '<h3>Record review</h3><div class="jos-rev-form">' +
      '<label>Name<input id="jos-rev-rec-name" type="text" value="' + esc(d.name || '') + '"></label>' +
      '<label>Rating<input id="jos-rev-rec-rating" type="number" min="1" max="5" value="' + esc(String(d.rating != null ? d.rating : 5)) + '"></label>' +
      '<label>Source<select id="jos-rev-rec-source">' + srcOpts + '</select></label>' +
      '<label class="jos-rev-span2">Review text<textarea id="jos-rev-rec-text" class="jos-textarea">' + esc(d.text || '') + '</textarea></label>' +
      '</div><div class="jos-btn-row jos-mt">' + dsBtn('rev-record-save', 'Save review', 'jos-btn-brand') + dsBtn('rev-record-cancel', 'Cancel', 'jos-btn') + '</div></div></div>';
  }
  function renderRevKpiDrawer(root) {
    var kpi = root._josRevKpiDrawer;
    if (!kpi) return '';
    var r = ensureReviewsOsState(), a = r.analytics;
    var title = { rating: 'Rating Analytics', new: 'New Reviews', response: 'Response Rate', requests: 'Review Requests' }[kpi] || 'Details';
    var body = kpi === 'rating'
      ? '<p><strong>' + a.rating.toFixed(1) + '</strong> average · ' + a.count + ' reviews</p><p class="jos-muted">Star breakdown, platform mix, and sentiment trends (demo).</p>'
      : kpi === 'new'
        ? '<p><strong>' + a.newThisMonth + '</strong> new this month · <span class="up">+' + a.newDeltaPct + '%</span></p>'
        : kpi === 'response'
          ? '<p><strong>' + a.responseRate + '%</strong> response rate · avg ' + a.avgResponseHours + ' hours</p>'
          : '<p><strong>' + r.requestStats.sent + '</strong> sent · ' + r.requestStats.completed + ' completed · ' + r.requestStats.conversionPct + '%</p>';
  var acts = kpi === 'rating'
      ? dsBtn('rev-export-csv', 'Download CSV', 'jos-btn jos-btn-sm') + dsBtn('rev-ai-report', 'Generate AI Report', 'jos-btn-brand jos-btn-sm')
      : kpi === 'response'
        ? dsBtn('rev-reply-all', 'Reply All', 'jos-btn-brand jos-btn-sm') + dsBtn('rev-ai-draft', 'Generate AI Replies', 'jos-btn jos-btn-sm')
        : '';
    return '<div class="jos-rev-mc-overlay" data-jos-rev-drawer="1"><aside class="jos-rev-mc-drawer">' +
      '<div class="jos-rev-mc-drawer-head"><h3>' + esc(title) + '</h3><button type="button" class="jos-rev-mc-close" data-jos-act="rev-drawer-close">×</button></div>' +
      '<div class="jos-rev-mc-drawer-body">' + body + '</div><div class="jos-rev-mc-drawer-foot">' + acts + '</div></aside></div>';
  }
  function renderRevDetailDrawer(root) {
    var id = root._josRevSelId;
    if (!id || root._josRevKpiDrawer) return '';
    var r = ensureReviewsOsState();
    var rv = r.reviews.find(function (x) { return String(x.id) === String(id); });
    if (!rv) return '';
    var draft = root._josRevAiDraft || rv.reply || '';
    return '<div class="jos-rev-mc-overlay" data-jos-rev-drawer="1"><aside class="jos-rev-mc-drawer wide">' +
      '<div class="jos-rev-mc-drawer-head"><div><strong>' + esc(rv.name) + '</strong> ' + revStars(rv.rating) + ' ' + revSourceBadge(rv.source) + '</div>' +
      '<button type="button" class="jos-rev-mc-close" data-jos-act="rev-drawer-close">×</button></div>' +
      '<div class="jos-rev-mc-drawer-body"><section><h4>Original review</h4><p>' + esc(rv.text) + '</p></section>' +
      '<section><h4>Your response</h4><textarea id="jos-rev-ai-draft" class="jos-textarea">' + esc(draft) + '</textarea></section></div>' +
      '<div class="jos-rev-mc-drawer-foot">' + dsBtn('rev-ai-draft', 'Generate AI', 'jos-btn jos-btn-sm') + dsBtn('rev-ai-save', 'Save reply', 'jos-btn-brand') + dsBtn('rev-drawer-close', 'Close', 'jos-btn') + '</div></aside></div>';
  }
  function renderRevFeedPanel(root, tab) {
    var r = ensureReviewsOsState();
    var d = DS();
    var list = r.reviews.slice();
    if (tab === 'needs_reply') list = list.filter(function (rv) { return rv.status !== 'replied' && !rv.reply; });
    if (tab === 'overview') list = list.slice(0, 6);
    if (tab === 'inbox' || tab === 'needs_reply' || tab === 'overview') {
      list = revFilterReviews(list, root);
      list.sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
    }
    var per = Number(root._josRevPerPage) || 25;
    var page = Number(root._josRevPage) || 1;
    var total = list.length;
    var start = (page - 1) * per;
    var slice = list.slice(start, start + per);
    var cards = slice.length ? slice.map(function (rv) { return revMcFeedCard(rv, root); }).join('')
      : (d ? d.emptyState(root._josRevQ ? 'No search results' : 'No reviews yet', root._josRevQ ? 'Clear filters and try again.' : 'Send a review request after completed jobs.', dsBtn(root._josRevQ ? 'rev-clear-filters' : 'rev-request-open', root._josRevQ ? 'Clear filters' : 'Request review', 'jos-btn-brand jos-btn-sm')) : '');
    var filters = [];
    if (root._josRevRating) filters.push('<span class="jos-rev-mc-filter">Rating: ' + root._josRevRating + '★ <button type="button" data-jos-act="rev-clear-rating">×</button></span>');
    if (root._josRevPlatform) filters.push('<span class="jos-rev-mc-filter">Platform: ' + esc(REV_SOURCE_LABEL[root._josRevPlatform] || root._josRevPlatform) + ' <button type="button" data-jos-act="rev-clear-platform">×</button></span>');
    if (root._josRevTag) filters.push('<span class="jos-rev-mc-filter">Tag: ' + esc(root._josRevTag) + ' <button type="button" data-jos-act="rev-clear-tag">×</button></span>');
    var filterBar = filters.length ? '<div class="jos-rev-mc-active-filters">' + filters.join('') + '</div>' : '';
    var end = Math.min(start + per, total);
    var pag = '<footer class="jos-rev-mc-pag">' +
      '<label>Rows <select data-jos-act="rev-per-page" id="jos-rev-per-page"><option' + (per === 25 ? ' selected' : '') + '>25</option><option' + (per === 50 ? ' selected' : '') + '>50</option><option' + (per === 100 ? ' selected' : '') + '>100</option></select></label>' +
      '<span>Showing ' + (total ? start + 1 : 0) + '–' + end + ' of ' + total + '</span>' +
      '<div class="jos-rev-mc-pag-btns">' +
      '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="rev-page-first"' + (page <= 1 ? ' disabled' : '') + '>First</button>' +
      '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="rev-page-prev"' + (page <= 1 ? ' disabled' : '') + '>Previous</button>' +
      '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="rev-page-next"' + (end >= total ? ' disabled' : '') + '>Next</button>' +
      '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="rev-page-last"' + (end >= total ? ' disabled' : '') + '>Last</button>' +
      '</div></footer>';
    return filterBar + '<div class="jos-rev-mc-feed-list">' + cards + '</div>' + pag;
  }
  function renderRevRequestsPanel(root) {
    var r = ensureReviewsOsState();
    var d = DS();
    var rows = r.requests.length ? r.requests.map(function (req) {
      var nm = revCustomerName(req.customerId);
      return '<div class="jos-rev-mc-req-row"><div><strong>' + esc(nm) + '</strong><div class="jos-muted">' + esc(req.method || req.channel || 'sms') + ' · ' + esc(String(req.createdAt || '').slice(0, 10)) + '</div></div>' +
        '<span>' + (req.sent ? '✓' : '—') + '</span><span>' + (req.opened ? '✓' : '—') + '</span><span>' + (req.completed ? '✓' : '—') + '</span>' +
        (req.status === 'pending' ? '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="rev-request-send" data-jos-rev-req="' + esc(req.id) + '">Resend</button>' : '') + '</div>';
    }).join('') : (d ? d.emptyState('No requests', 'Send review requests after completed jobs.') : '');
    return '<div class="jos-rev-mc-req-table"><div class="jos-rev-mc-req-head"><span>Customer</span><span>Sent</span><span>Opened</span><span>Done</span><span></span></div>' + rows + '</div>';
  }
  function renderRevAnalyticsPanel(root) {
    var r = ensureReviewsOsState(), a = r.analytics;
    var bySrc = { google: 0, facebook: 0, yelp: 0, website: 0, hubly: 0 };
    r.reviews.forEach(function (rv) { if (bySrc[rv.source] != null) bySrc[rv.source]++; });
    var bars = Object.keys(bySrc).map(function (k) {
      var pct = a.count ? Math.round((bySrc[k] / a.count) * 100) : 0;
      return '<div class="jos-rev-bar-row"><span>' + esc(REV_SOURCE_LABEL[k]) + '</span><div class="jos-rev-bar"><i style="width:' + pct + '%"></i></div><span>' + bySrc[k] + '</span></div>';
    }).join('');
    return '<div class="jos-rev-mc-analytics"><div class="jos-rev-mc-panel"><h3>By platform</h3><div class="jos-rev-bars">' + bars + '</div></div>' +
      '<div class="jos-rev-mc-panel"><h3>Review growth</h3>' + revMcGrowthChart(r.growthHistory) + '</div></div>';
  }
  function renderRevConnectionsPanel(root) {
    var r = ensureReviewsOsState();
  return Object.keys(REV_PLATFORM_META).map(function (key) {
      var p = r.platforms[key] || {};
      return '<div class="jos-rev-mc-plat-row"><div class="jos-rev-mc-plat-logo ' + esc(REV_PLATFORM_META[key].cls) + '">' + esc(REV_PLATFORM_META[key].label[0]) + '</div>' +
        '<div class="jos-rev-mc-plat-info"><strong>' + esc(REV_PLATFORM_META[key].label) + '</strong><span class="jos-muted">' + (p.connected ? 'Connected' : 'Not connected') + ' · ' + (p.reviews || 0) + ' reviews</span></div>' +
        '<span class="jos-rev-mc-plat-rating">' + (p.rating ? p.rating.toFixed(1) + '★' : '—') + '</span>' +
        '<span class="jos-muted">' + esc(p.lastSync || '—') + '</span>' +
        '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="' + (p.connected ? 'rev-sync-' + key : 'rev-connect-' + key) + '">' + (p.connected ? 'Sync' : 'Connect') + '</button></div>';
    }).join('');
  }
  function renderRevSidebar(root) {
    var r = ensureReviewsOsState();
    var range = root._josRevGrowthRange || 'Month';
    var growthFilters = ['Week', 'Month', 'Quarter', 'Year'].map(function (f) {
      return '<button type="button" class="jos-rev-mc-gf' + (range === f ? ' on' : '') + '" data-jos-act="rev-growth-range" data-jos-rev-range="' + f + '">' + f + '</button>';
    }).join('');
    var platRows = Object.keys(REV_PLATFORM_META).slice(0, 5).map(function (key) {
      var p = r.platforms[key] || {};
      return '<button type="button" class="jos-rev-mc-plat-mini" data-jos-act="rev-plat-open" data-jos-rev-platform="' + key + '">' +
        '<span class="logo ' + REV_PLATFORM_META[key].cls + '">' + REV_PLATFORM_META[key].label[0] + '</span>' +
        '<span class="name">' + esc(REV_PLATFORM_META[key].label) + '</span>' +
        '<span class="meta">' + (p.reviews || 0) + ' · ' + (p.rating ? p.rating.toFixed(1) : '—') + '</span>' +
        '<span class="sync">' + esc(p.lastSync || '—') + '</span></button>';
    }).join('');
    var goals = (r.goals || []).map(function (g) {
      var pct = g.target ? Math.round((g.current / g.target) * 100) : 0;
      return '<div class="jos-rev-mc-goal"><div class="jos-rev-mc-goal-top"><span>' + esc(g.label) + '</span><strong>' + pct + '%</strong></div><div class="jos-rev-mc-goal-bar"><i style="width:' + pct + '%"></i></div></div>';
    }).join('');
    var biz = String(S().biz || 'business').replace(/\s+/g, '');
    var link = 'hubly.app/review/' + biz;
    var pending = r.requests.filter(function (req) { return req.status === 'pending'; }).length;
    return '<aside class="jos-rev-mc-side">' +
      '<section class="jos-rev-mc-side-card"><h3>Take action</h3>' +
        '<div class="jos-rev-mc-side-act"><div><strong>Pending requests</strong><span class="jos-muted">' + pending + ' waiting to send</span></div><button type="button" class="jos-btn jos-btn-sm" data-jos-act="rev-go-requests">View</button></div>' +
        '<div class="jos-rev-mc-side-act"><div><strong>Sync Google</strong><span class="jos-muted">Last synced 2h ago</span></div><button type="button" class="jos-btn jos-btn-sm" data-jos-act="rev-sync-google">Sync</button></div>' +
        '<div class="jos-rev-mc-side-act"><div><strong>Sync Facebook</strong><span class="jos-muted">Last synced 2h ago</span></div><button type="button" class="jos-btn jos-btn-sm" data-jos-act="rev-sync-facebook">Sync</button></div>' +
      '</section>' +
      '<section class="jos-rev-mc-side-card tall"><div class="jos-rev-mc-side-head"><h3>Review growth</h3><div class="jos-rev-mc-growth-f">' + growthFilters + '</div></div>' + revMcGrowthChart(r.growthHistory) + '</section>' +
      '<section class="jos-rev-mc-side-card"><h3>Platforms</h3><div class="jos-rev-mc-plat-list">' + platRows + '</div></section>' +
      '<section class="jos-rev-mc-side-card"><h3>Goals</h3>' + goals + '<div class="jos-rev-mc-side-btns">' + dsBtn('rev-goal-edit', 'Edit Goal', 'jos-btn jos-btn-sm') + dsBtn('rev-goal-ai', 'AI Suggest', 'jos-btn jos-btn-sm') + '</div></section>' +
      '<section class="jos-rev-mc-side-card"><h3>Quick actions</h3>' +
        '<button type="button" class="jos-rev-mc-qa" data-jos-act="rev-qr">Generate QR Code</button>' +
        '<button type="button" class="jos-rev-mc-qa" data-jos-act="rev-email-campaign">Email Campaign</button>' +
        '<button type="button" class="jos-rev-mc-qa" data-jos-act="rev-sms-campaign">Text Campaign</button>' +
        '<button type="button" class="jos-rev-mc-qa" data-jos-act="rev-copy-link">Copy Review Link</button>' +
        '<button type="button" class="jos-rev-mc-qa" data-jos-act="rev-nfc">Generate NFC Card</button>' +
        '<button type="button" class="jos-rev-mc-qa" data-jos-act="rev-poster">Print Poster</button>' +
      '</section>' +
      '<section class="jos-rev-mc-side-card"><h3>Get more reviews</h3><div class="jos-rev-mc-link-row"><input readonly value="' + esc(link) + '" id="jos-rev-link"><button type="button" class="jos-btn jos-btn-brand jos-btn-sm" data-jos-act="rev-copy-link">Copy link</button></div></section>' +
    '</aside>';
  }
  function renderRevMissionControl(root) {
    var r = ensureReviewsOsState();
    var tab = root._josRevTab || 'overview';
    if (tab === 'ai') tab = 'overview';
    if (tab === 'events') tab = 'connections';
    var a = r.analytics;
    var rs = r.requestStats;
    var range = root._josRevRange || 'Last 30 Days';
    var rangeOpen = !!root._josRevRangeOpen;
    var rangeMenu = rangeOpen ? '<div class="jos-rev-mc-range-menu">' + REV_DATE_RANGES.map(function (lbl) {
      return '<button type="button" data-jos-act="rev-range-set" data-jos-rev-range="' + esc(lbl) + '">' + esc(lbl) + '</button>';
    }).join('') + '</div>' : '';
    var tabsHtml = '<div class="jos-rev-mc-tabs">' + REV_TABS.map(function (t) {
      return '<button type="button" class="jos-rev-mc-tab' + (tab === t[0] ? ' on' : '') + '" data-jos-rev-tab="' + t[0] + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div>';
    var mainBody = tab === 'requests' ? renderRevRequestsPanel(root)
      : tab === 'analytics' ? renderRevAnalyticsPanel(root)
        : tab === 'connections' ? renderRevConnectionsPanel(root)
          : renderRevFeedPanel(root, tab);
    var showSide = tab !== 'analytics' && tab !== 'connections';
    return '<div class="jos-rev-mc-shell jos-rev-page">' +
      '<header class="jos-rev-mc-header">' +
        '<div class="jos-rev-mc-title"><span class="jos-rev-mc-star" aria-hidden="true">⭐</span><div><h1>Reviews</h1><p>Track your reputation, respond faster, and generate more 5-star reviews.</p></div></div>' +
        '<div class="jos-rev-mc-header-actions">' +
          '<div class="jos-rev-mc-search-wrap"><input id="jos-rev-search" class="jos-rev-mc-search" placeholder="Search reviews…" value="' + esc(root._josRevQ || '') + '"></div>' +
          '<div class="jos-rev-mc-range-wrap"><button type="button" class="jos-btn jos-rev-mc-range" data-jos-act="rev-range-toggle">' + esc(range) + ' ▾</button>' + rangeMenu + '</div>' +
          '<button type="button" class="jos-btn jos-btn-brand jos-rev-mc-req-btn" data-jos-act="rev-request-open">Request Review</button>' +
        '</div>' +
      '</header>' +
      '<div class="jos-rev-mc-kpis">' +
        '<button type="button" class="jos-rev-mc-kpi tone-lav" data-jos-act="rev-kpi-rating"><span class="ico">★</span><span class="lbl">Overall Rating</span><strong>' + (a.rating ? a.rating.toFixed(1) : '—') + '</strong>' + revStars(Math.round(a.rating)) + '<span class="sub">' + a.count + ' Reviews</span><span class="delta up">+' + a.ratingDelta + ' This Month</span></button>' +
        '<button type="button" class="jos-rev-mc-kpi tone-blue" data-jos-act="rev-kpi-new"><span class="lbl">New Reviews</span><strong>' + a.newThisMonth + '</strong><span class="sub">This Month</span><span class="delta up">+' + a.newDeltaPct + '%</span>' + revMcSparkline([2, 4, 3, 6, 5, 8, a.newThisMonth], true) + '</button>' +
        '<button type="button" class="jos-rev-mc-kpi tone-green" data-jos-act="rev-kpi-response"><span class="lbl">Response Rate</span><strong>' + a.responseRate + '%</strong><span class="sub">Average ' + a.avgResponseHours + ' Hours</span></button>' +
        '<button type="button" class="jos-rev-mc-kpi tone-orange" data-jos-act="rev-kpi-requests"><span class="lbl">Review Requests</span><strong>' + rs.sent + ' Sent</strong><span class="sub">' + rs.completed + ' Completed · ' + rs.conversionPct + '%</span><span class="delta up">+' + rs.deltaPct + '%</span></button>' +
      '</div>' +
      '<section class="jos-rev-mc-ai">' +
        '<div class="jos-rev-mc-ai-badge" aria-hidden="true">AI</div>' +
        '<div class="jos-rev-mc-ai-copy"><strong>AI Reputation Summary</strong><p>' + esc(r.aiSummary) + '</p></div>' +
        '<div class="jos-rev-mc-ai-btns">' +
          '<button type="button" class="jos-btn jos-rev-mc-ai-outline" data-jos-act="rev-ai-report">View Report</button>' +
          '<button type="button" class="jos-btn jos-rev-mc-ai-purple" data-jos-act="rev-ai-actions">AI Actions</button>' +
          '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="rev-ai-refresh">Refresh</button>' +
        '</div>' +
      '</section>' +
      '<div class="jos-rev-mc-main' + (showSide ? '' : ' full') + '">' +
        '<div class="jos-rev-mc-feed-col">' + tabsHtml + mainBody + '</div>' +
        (showSide ? renderRevSidebar(root) : '') +
      '</div>' +
      renderRevRequestModal(root) + renderRevRecordModal(root) + renderRevKpiDrawer(root) + renderRevDetailDrawer(root) +
    '</div>';
  }
  function renderRevOverviewTab(root) { return renderRevMissionControl(root); }
  function renderRevInboxTab(root) { return renderRevMissionControl(root); }
  function renderRevRequestsTab(root) { return renderRevMissionControl(root); }
  function renderRevAiTab(root) { return renderRevMissionControl(root); }
  function renderRevAnalyticsTab(root) { return renderRevMissionControl(root); }
  function renderRevEventsTab(root) { root._josRevTab = 'connections'; return renderRevMissionControl(root); }
  function renderRevTabBody(root, tab) {
    if (tab === 'ai') tab = 'overview';
    if (tab === 'events') tab = 'connections';
    root._josRevTab = tab;
    return renderRevMissionControl(root);
  }
  function setReviewsMode(on) {
    var app = el('p-app');
    if (!app) return;
    app.classList.toggle('jos-reviews-mode', !!on);
  }
  function renderReviewsPageInner(root) {
    ensureReviewsOsState();
    var tab = root._josRevTab || 'overview';
    root.innerHTML = renderRevTabBody(root, tab);
    bindRoot(root);
    wireReviewsRoot(root);
  }
  function renderReviews() {
    var root = ownPixelView('v-reviews', 'jos-reviews-root');
    if (!root) return;
    setReviewsMode(true);
    updateChrome('reviews');
    root.innerHTML = '<div class="jos-rev-mc-shell jos-rev-page"><div class="jos-home-loading">Loading Reviews…</div></div>';
    try { renderReviewsPageInner(root); }
    catch (err) {
      console.warn('HublyJourneyOS Reviews', err);
      root.innerHTML = '<div class="jos-rev-mc-shell"><div class="jos-empty jos-error-state"><strong>Reviews could not load</strong><p class="jos-muted">Refresh and try again.</p><div class="jos-mt"><button type="button" class="jos-btn jos-btn-brand jos-btn-sm" onclick="HublyJourneyOS.renderReviews()">Retry</button></div></div></div>';
    }
  }
  function renderBizReviews() { return renderReviews(); }
  function wireReviewsRoot(root) {
    if (root._josRevBound) return;
    root._josRevBound = true;
    root.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'jos-rev-search') {
        root._josRevQ = e.target.value;
        clearTimeout(root._josRevSearchT);
        root._josRevSearchT = setTimeout(function () { renderReviews(); }, 300);
      }
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (root._josRevReqModal || root._josRevRecModal || root._josRevKpiDrawer || root._josRevSelId) {
          root._josRevReqModal = false;
          root._josRevRecModal = false;
          root._josRevKpiDrawer = null;
          root._josRevSelId = null;
          root._josRevReqDraft = null;
          root._josRevRecDraft = null;
          root._josRevRangeOpen = false;
          return renderReviews();
        }
        if (root._josRevQ) { root._josRevQ = ''; return renderReviews(); }
      }
      if (e.key === '/' && !/input|textarea|select/i.test((e.target || {}).tagName || '')) {
        e.preventDefault();
        var s = el('jos-rev-search'); if (s) s.focus();
      }
      if (e.key === 'r' || e.key === 'R') {
        if (/input|textarea|select/i.test((e.target || {}).tagName || '')) return;
        root._josRevReqModal = true;
        root._josRevReqDraft = { step: 1, channel: 'sms' };
        return renderReviews();
      }
    });
  }
  function readRevRequestDraft() {
    var raw = (el('jos-rev-req-target') || {}).value || '';
    var parts = raw.split(':');
    return {
      jobId: parts[0] || '',
      customerId: parts[1] || '',
      channel: (el('jos-rev-req-channel') || {}).value || 'sms',
      targetKey: raw
    };
  }
  function handleReviewsAct(act, t) {
    var root = el('jos-reviews-root');
    if (!root) return;
    ensureReviewsOsState();
    var r = S().reviewsOs;
    var revIdAttr = t && (t.getAttribute('data-jos-rev-id') || (t.closest('[data-jos-rev-id]') && t.closest('[data-jos-rev-id]').getAttribute('data-jos-rev-id')));
    var reqId = t && t.getAttribute('data-jos-rev-req');
    try {
      if (act === 'rev-range-toggle') { root._josRevRangeOpen = !root._josRevRangeOpen; return renderReviews(); }
      if (act === 'rev-range-set') { root._josRevRange = t.getAttribute('data-jos-rev-range'); root._josRevRangeOpen = false; return renderReviews(); }
      if (act === 'rev-kpi-rating') { root._josRevKpiDrawer = 'rating'; return renderReviews(); }
      if (act === 'rev-kpi-new') { root._josRevKpiDrawer = 'new'; root._josRevTab = 'inbox'; return renderReviews(); }
      if (act === 'rev-kpi-response') { root._josRevKpiDrawer = 'response'; return renderReviews(); }
      if (act === 'rev-kpi-requests') { root._josRevKpiDrawer = 'requests'; root._josRevTab = 'requests'; return renderReviews(); }
      if (act === 'rev-drawer-close') { root._josRevKpiDrawer = null; root._josRevSelId = null; return renderReviews(); }
      if (act === 'rev-expand' && revIdAttr) { root._josRevExpanded = root._josRevExpanded === revIdAttr ? null : revIdAttr; return renderReviews(); }
      if (act === 'rev-open' && revIdAttr) { root._josRevSelId = revIdAttr; return renderReviews(); }
      if (act === 'rev-filter-rating') { root._josRevRating = t.getAttribute('data-jos-rev-rating'); root._josRevPage = 1; return renderReviews(); }
      if (act === 'rev-filter-platform') { root._josRevPlatform = t.getAttribute('data-jos-rev-platform'); root._josRevPage = 1; return renderReviews(); }
      if (act === 'rev-filter-tag') { root._josRevTag = t.getAttribute('data-jos-rev-tag'); root._josRevPage = 1; return renderReviews(); }
      if (act === 'rev-clear-rating') { root._josRevRating = null; return renderReviews(); }
      if (act === 'rev-clear-platform') { root._josRevPlatform = null; return renderReviews(); }
      if (act === 'rev-clear-tag') { root._josRevTag = null; return renderReviews(); }
      if (act === 'rev-clear-filters') { root._josRevQ = ''; root._josRevRating = null; root._josRevPlatform = null; root._josRevTag = null; return renderReviews(); }
      if (act === 'rev-growth-range') { root._josRevGrowthRange = t.getAttribute('data-jos-rev-range'); return renderReviews(); }
      if (act === 'rev-page-prev') { root._josRevPage = Math.max(1, (Number(root._josRevPage) || 1) - 1); return renderReviews(); }
      if (act === 'rev-page-next') { root._josRevPage = (Number(root._josRevPage) || 1) + 1; return renderReviews(); }
      if (act === 'rev-page-first') { root._josRevPage = 1; return renderReviews(); }
      if (act === 'rev-page-last') { root._josRevPage = 99; return renderReviews(); }
      if (act === 'rev-copy-link') {
        var link = (el('jos-rev-link') || {}).value || 'hubly.app/review/' + String(S().biz || 'business').replace(/\s+/g, '');
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link);
        return toast('Copied');
      }
      if (act === 'rev-qr') return toast('QR code generated');
      if (act === 'rev-nfc') return toast('NFC card preview ready');
      if (act === 'rev-poster') return toast('Printable poster ready');
      if (act === 'rev-email-campaign' || act === 'rev-sms-campaign') return switchNav('marketing');
      if (act === 'rev-ai-report' || act === 'rev-ai-actions') { root._josRevKpiDrawer = 'rating'; return renderReviews(); }
      if (act === 'rev-export-csv') return toast('Export started');
      if (act === 'rev-reply-all') return toast('Reply all queued');
      if (act === 'rev-goal-edit' || act === 'rev-goal-ai') return toast('Goals updated (demo)');
      if (act === 'rev-plat-open') { root._josRevTab = 'connections'; root._josRevPlatform = t.getAttribute('data-jos-rev-platform'); return renderReviews(); }
      if (act === 'rev-req-next') {
        var d = root._josRevReqDraft || { step: 1, channel: 'sms' };
        d.step = Math.min(4, (d.step || 1) + 1);
        root._josRevReqDraft = d;
        return renderReviews();
      }
      if (act === 'rev-req-channel') {
        root._josRevReqDraft = Object.assign({}, root._josRevReqDraft || {}, { channel: t.getAttribute('data-jos-rev-channel') });
        return renderReviews();
      }
      if (act === 'rev-req-cust') {
        root._josRevReqDraft = Object.assign({}, root._josRevReqDraft || {}, { customerId: t.getAttribute('data-jos-rev-cust') });
        return renderReviews();
      }
      if (act === 'rev-req-schedule') { root._josRevReqModal = false; return toast('Review request scheduled'); }
      if (act === 'rev-request-open') {
        root._josRevReqModal = true;
        root._josRevReqDraft = { step: 1, channel: 'sms' };
        return renderReviews();
      }
      if (act === 'rev-request-cancel' || act === 'rev-record-cancel') {
        root._josRevReqModal = false;
        root._josRevRecModal = false;
        root._josRevReqDraft = null;
        root._josRevRecDraft = null;
        return renderReviews();
      }
      if (act === 'rev-request-save') {
        var rd = readRevRequestDraft();
        if (!rd.jobId && !(root._josRevReqDraft && root._josRevReqDraft.customerId)) { toast('Pick a customer or job'); return; }
        var req = { id: revId('rev_req'), customerId: rd.customerId || (root._josRevReqDraft && root._josRevReqDraft.customerId) || null, jobId: rd.jobId || null, status: 'sent', channel: (root._josRevReqDraft && root._josRevReqDraft.channel) || rd.channel, createdAt: todayStr(), sent: true, opened: false, clicked: false, completed: false, reminders: 0 };
        r.requests.unshift(req);
        publishRevEvent('review.requested', { requestId: req.id, customerId: req.customerId, jobId: req.jobId });
        root._josRevReqModal = false;
        root._josRevReqDraft = null;
        toast('Review request sent');
        return renderReviews();
      }
      if (act === 'rev-request-quick') {
        var qJob = t.getAttribute('data-jos-rev-job');
        var qCust = t.getAttribute('data-jos-rev-cust');
        var qReq = { id: revId('rev_req'), customerId: qCust || null, jobId: qJob, status: 'sent', channel: 'sms', createdAt: todayStr(), sent: true };
        r.requests.unshift(qReq);
        publishRevEvent('review.requested', { requestId: qReq.id, customerId: qReq.customerId, jobId: qReq.jobId });
        toast('Review request sent');
        return renderReviews();
      }
      if (act === 'rev-request-send' && reqId) {
        var rq = r.requests.find(function (x) { return String(x.id) === String(reqId); });
        if (rq) {
          rq.status = 'sent';
          rq.sent = true;
          publishRevEvent('review.requested', { requestId: rq.id, customerId: rq.customerId, jobId: rq.jobId });
          toast('Request resent');
        }
        return renderReviews();
      }
      if (act === 'rev-record-open') {
        root._josRevRecModal = true;
        root._josRevRecDraft = {};
        return renderReviews();
      }
      if (act === 'rev-record-save') {
        var rec = normalizeReview({
          id: revId('rev'),
          name: (el('jos-rev-rec-name') || {}).value || 'Customer',
          rating: Number((el('jos-rev-rec-rating') || {}).value) || 5,
          source: (el('jos-rev-rec-source') || {}).value || 'manual',
          text: (el('jos-rev-rec-text') || {}).value || '',
          status: 'new',
          at: todayStr()
        });
        if (!rec.text.trim()) { toast('Review text required'); return; }
        r.reviews.unshift(rec);
        r.aiSummary = buildReviewsAiSummary(r.reviews);
        publishRevEvent('review.received', { reviewId: rec.id, source: rec.source, rating: rec.rating });
        publishReputationChanged();
        root._josRevRecModal = false;
        root._josRevRecDraft = null;
        toast('Review recorded');
        return renderReviews();
      }
      if (act === 'rev-select' && revIdAttr) {
        root._josRevSelId = revIdAttr;
        root._josRevAiDraft = '';
        return renderReviews();
      }
      if (act === 'rev-ai-draft') {
        var rv = r.reviews.find(function (x) { return String(x.id) === String(revIdAttr || root._josRevSelId); });
        if (!rv) { toast('Select a review first'); return; }
        root._josRevSelId = rv.id;
        var biz = S().biz || 'our team';
        root._josRevAiDraft = 'Thank you, ' + (rv.name || 'there') + '! We appreciate you trusting ' + biz + '. Glad the service met your expectations — hope to see you again soon.';
        return renderReviews();
      }
      if (act === 'rev-ai-save') {
        var rv2 = r.reviews.find(function (x) { return String(x.id) === String(root._josRevSelId); });
        if (!rv2) { toast('Select a review first'); return; }
        var reply = (el('jos-rev-ai-draft') || {}).value || root._josRevAiDraft || '';
        if (!reply.trim()) { toast('Write a reply first'); return; }
        rv2.reply = reply.trim();
        rv2.status = 'replied';
        rv2.respondedAt = todayStr();
        r.replies.push({ id: revId('rev_reply'), reviewId: rv2.id, text: rv2.reply, at: rv2.respondedAt });
        publishRevEvent('review.responded', { reviewId: rv2.id });
        publishReputationChanged();
        toast('Reply sent');
        return renderReviews();
      }
      if (act === 'rev-ai-refresh') {
        r.aiSummary = buildReviewsAiSummary(r.reviews);
        toast('Analyzing reviews…');
        return renderReviews();
      }
      if (act === 'rev-sync-google' || act === 'rev-sync-facebook') {
        return toast('Synced successfully');
      }
      if (act === 'rev-connect-yelp' || act === 'rev-connect-google' || act === 'rev-connect-facebook') {
        return toast('Stage 2 · connect flow');
      }
      if (act === 'rev-go-requests') {
        root._josRevTab = 'requests';
        return renderReviews();
      }
      if (act === 'rev-open-customer') {
        var cid = t && t.getAttribute('data-jos-rev-cust');
        if (cid) return openCustomerProfile(cid);
        return toast('No customer linked');
      }
      if (act === 'rev-more' && revIdAttr) {
        root._josRevSelId = revIdAttr;
        return renderReviews();
      }
    } catch (err) {
      console.warn('HublyJourneyOS rev act', act, err);
      toast('Failed — try again');
    }
  }
  function membershipPlans() {
    var st = S(), plans = st.memberships || st.website?.memberships || st.website?.membershipPlans || [];
    if (Array.isArray(plans) && plans.length) return plans;
    var recurring = customers().filter(function (c) { return c.customerType === 'recurring'; });
    if (recurring.length) return [{ name: 'Recurring plan', price: recurring[0].recurringAmount || 99, cadence: '/mo', includes: ['Priority scheduling', 'Member pricing'] }];
    return [{ name: 'Essentials', price: 79, cadence: '/mo', includes: ['1 visit / month', 'Member-only slots'] }, { name: 'Shine Club', price: 129, cadence: '/mo', includes: ['2 visits / month', 'Interior refresh', 'Priority booking'] }];
  }
  var MEM_TABS = [
    ['overview', 'Overview'],
    ['plans', 'Plans'],
    ['subscribers', 'Subscribers'],
    ['visits', 'Visits'],
    ['billing', 'Billing'],
    ['activity', 'Activity']
  ];
  function memId(prefix) { return (prefix || 'mem') + '_' + Math.random().toString(36).slice(2, 9); }
  function memSlug(v) { return String(v || 'membership').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'membership'; }
  function publishMembershipEvent(type, payload) {
    var ev = hublyEvents();
    if (ev && typeof ev.publish === 'function') ev.publish(type, payload);
  }
  function memPushActivity(type, label, payload) {
    var m = ensureMembershipsOsState();
    var entry = { id: memId('mem_act'), type: type, label: label, at: new Date().toISOString(), payload: payload ? Object.assign({}, payload) : {} };
    try { Object.freeze(entry.payload); Object.freeze(entry); } catch (_) {}
    m.activity.push(entry); // Rule #18 — append-only; never rewrite prior activity
  }
  function membershipSeedPlans() {
    var st = S(), w = st.website || {}, out = [], seen = {};
    function add(p) {
      if (!p || typeof p !== 'object') return;
      var name = p.name || p.title || p.label || p.planName;
      if (!name) return;
      var key = memSlug(name);
      if (seen[key]) return;
      seen[key] = true;
      out.push(p);
    }
    (membershipPlans() || []).forEach(add);
    [w.offers, w.offerings, w.membershipOffers, w.plans].forEach(function (arr) {
      if (!Array.isArray(arr)) return;
      arr.forEach(function (offer) {
        var blob = [offer.type, offer.kind, offer.category, offer.name, offer.title].join(' ').toLowerCase();
        if (/member|recurring|subscription|plan/.test(blob)) add(offer);
      });
    });
    return out;
  }
  function memCatalogServices() {
    try { return storefrontCatalog().filter(function (s) { return s.status !== 'archived'; }); }
    catch (e) { return []; }
  }
  function memFindCatalogService(v, catalog) {
    var raw = String(v || '').trim().toLowerCase();
    if (!raw) return null;
    return (catalog || memCatalogServices()).find(function (s) {
      return String(s.id).toLowerCase() === raw || String(s.name || '').toLowerCase() === raw;
    }) || null;
  }
  function memServiceRefs(raw, catalog) {
    catalog = catalog || memCatalogServices();
    var list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    var refs = [];
    list.forEach(function (item) {
      var svc = null, name = '', serviceId = '';
      if (item && typeof item === 'object') {
        serviceId = item.serviceId || item.catalogId || item.id || '';
        name = item.serviceName || item.name || item.label || '';
        svc = memFindCatalogService(serviceId || name, catalog);
      } else {
        name = String(item || '');
        svc = memFindCatalogService(name, catalog);
      }
      if (!svc && !serviceId && !name) return;
      var ref = {
        id: 'mem_inc_' + memSlug((svc && svc.id) || serviceId || name),
        serviceId: (svc && svc.id) || serviceId || null,
        serviceName: (svc && svc.name) || name || 'Catalog service'
      };
      if (!refs.some(function (r) { return String(r.serviceId || r.serviceName) === String(ref.serviceId || ref.serviceName); })) refs.push(ref);
    });
    return refs;
  }
  function memPlanBenefits(p, catalog) {
    var raw = [];
    ['includes', 'perks', 'benefits'].forEach(function (k) {
      var v = p && p[k];
      if (Array.isArray(v)) raw = raw.concat(v);
      else if (v) raw.push(v);
    });
    return raw.map(function (x) { return typeof x === 'object' ? (x.name || x.label || '') : String(x || ''); })
      .filter(function (x) { return x && !memFindCatalogService(x, catalog); });
  }
  function memVisitAllowance(p) {
    var direct = Number(p.visitAllowance != null ? p.visitAllowance : (p.includedVisits != null ? p.includedVisits : (p.visitsPerPeriod != null ? p.visitsPerPeriod : p.visits)));
    if (Number.isFinite(direct) && direct > 0) return Math.round(direct);
    var txt = [].concat(p.includes || [], p.perks || [], p.benefits || []).join(' ');
    var m = txt.match(/(\d+)\s*(visit|booking|service)/i);
    return m ? Math.max(1, Number(m[1]) || 1) : 1;
  }
  function normalizeMembershipPlan(p, idx) {
    p = p || {};
    var catalog = memCatalogServices();
    var id = p.id || p.planId || ('mem_plan_seed_' + idx + '_' + memSlug(p.name || p.title || 'plan'));
    var rawRefs = [].concat(p.includedServices || [], p.services || [], p.serviceRefs || [], p.serviceIds || []);
    var fromBenefits = [].concat(p.includes || [], p.perks || [], p.benefits || []).filter(function (x) { return memFindCatalogService(typeof x === 'object' ? (x.name || x.id) : x, catalog); });
    var refs = memServiceRefs(rawRefs.concat(fromBenefits), catalog);
    return {
      id: id,
      name: p.name || p.title || p.label || 'Membership',
      price: Number(p.price != null ? p.price : (p.amount != null ? p.amount : 0)) || 0,
      cadence: p.cadence || p.interval || p.period || '/mo',
      visitAllowance: memVisitAllowance(p),
      status: p.status || 'active',
      includedServices: refs,
      benefits: memPlanBenefits(p, catalog),
      source: p.source || (String(id).indexOf('seed') >= 0 ? 'seed' : 'owned')
    };
  }
  function memAddMonths(ds, months) {
    var d = ds ? new Date(String(ds).slice(0, 10) + 'T00:00:00') : new Date();
    if (isNaN(d.getTime())) d = new Date();
    d.setMonth(d.getMonth() + (months == null ? 1 : months));
    return d.toISOString().slice(0, 10);
  }
  function ensureMembershipsOsState() {
    var st = S();
    if (!st.membershipsOs || typeof st.membershipsOs !== 'object') st.membershipsOs = {};
    var m = st.membershipsOs;
    if (!Array.isArray(m.plans)) m.plans = [];
    if (!Array.isArray(m.subscribers)) m.subscribers = [];
    if (!Array.isArray(m.billingRules)) m.billingRules = [];
    if (!Array.isArray(m.includedServices)) m.includedServices = [];
    if (!Array.isArray(m.visits)) m.visits = [];
    if (!Array.isArray(m.renewals)) m.renewals = [];
    if (!Array.isArray(m.activity)) m.activity = [];
    membershipSeedPlans().forEach(function (plan, idx) {
      var np = normalizeMembershipPlan(plan, idx);
      var dup = m.plans.find(function (p) { return String(p.id) === String(np.id) || memSlug(p.name) === memSlug(np.name); });
      if (!dup) m.plans.push(np);
    });
    m.plans = m.plans.map(function (p, idx) { return normalizeMembershipPlan(p, idx); });
    customers().filter(function (c) { return c.customerType === 'recurring'; }).forEach(function (c, idx) {
      if (!c.id) return;
      var namedPlan = c.membership && m.plans.find(function (p) { return memSlug(p.name) === memSlug(c.membership); });
      var plan = namedPlan || m.plans[0] || normalizeMembershipPlan({ name: 'Recurring plan', price: c.recurringAmount || 99, cadence: '/mo' }, 0);
      if (!m.plans.length) m.plans.push(plan);
      if (!m.subscribers.some(function (s) { return String(s.customerId) === String(c.id) && s.status !== 'cancelled'; })) {
        m.subscribers.push({
          id: 'mem_sub_seed_' + idx + '_' + memSlug(c.id),
          customerId: c.id,
          planId: plan.id,
          status: 'active',
          startedAt: c.createdAt || c.customerSince || todayStr(),
          nextRenewalAt: memAddMonths(todayStr(), 1),
          visitsUsed: 0,
          visitResetAt: todayStr()
        });
      }
    });
    if (!m._seeded) {
      m._seeded = true;
      var seedAct = { id: memId('mem_act'), type: 'system', label: 'Memberships OS initialized from plans and recurring customers', at: new Date().toISOString(), payload: {} };
      try { Object.freeze(seedAct.payload); Object.freeze(seedAct); } catch (_) {}
      m.activity.push(seedAct);
    }
    // Normalize in place (Rule #18) — do not replace subscriber object identity
    m.subscribers = m.subscribers.filter(function (s) { return s && s.customerId; }).map(function (s, idx) {
      s.id = s.id || ('mem_sub_' + idx);
      s.planId = s.planId || (m.plans[0] && m.plans[0].id) || '';
      s.status = s.status || 'active';
      s.startedAt = s.startedAt || todayStr();
      s.nextRenewalAt = s.nextRenewalAt || memAddMonths(s.startedAt, 1);
      if (s.pausedAt == null) s.pausedAt = null;
      if (s.cancelledAt == null) s.cancelledAt = null;
      s.visitsUsed = Number(s.visitsUsed) || 0;
      s.visitResetAt = s.visitResetAt || s.startedAt || todayStr();
      return s;
    });
    m.plans.forEach(function (p) {
      if (!m.billingRules.some(function (r) { return String(r.planId) === String(p.id); })) {
        m.billingRules.push({ id: memId('mem_rule'), planId: p.id, cadence: p.cadence || '/mo', chargeTiming: 'advance', renewalAnchor: 'signup_day', graceDays: 3, processor: 'stripe_stage2' });
      }
    });
    var refs = [];
    m.plans.forEach(function (p) {
      (p.includedServices || []).forEach(function (r) {
        refs.push({ id: r.id || memId('mem_inc'), planId: p.id, serviceId: r.serviceId || null, serviceName: r.serviceName || r.name || '' });
      });
    });
    m.includedServices = refs;
    return m;
  }
  function memPlanById(id) {
    var m = ensureMembershipsOsState();
    return m.plans.find(function (p) { return String(p.id) === String(id); }) || m.plans[0] || null;
  }
  function memCustomerById(id) {
    return customers().find(function (c) { return String(c.id) === String(id); }) || null;
  }
  function memCustomerName(id) {
    var c = memCustomerById(id);
    return c ? c.name : 'Customer';
  }
  function memJobsForCustomer(customerId) {
    var c = memCustomerById(customerId);
    return jobs().filter(function (j) {
      return j && !j.isBlock && ((j.customerId && String(j.customerId) === String(customerId)) || (c && j.customer === c.name) || (c && c.phone && j.phone === c.phone));
    });
  }
  function memStatusBadge(status) {
    var d = DS(), s = String(status || 'active');
    var lbl = s.charAt(0).toUpperCase() + s.slice(1);
    var tone = s === 'active' ? 'ok' : (s === 'paused' ? 'warn' : 'hot');
    return d ? d.statusBadge(lbl, tone) : '<span class="jos-pill ' + tone + '">' + esc(lbl) + '</span>';
  }
  function memPlanOptions(selectedId) {
    var m = ensureMembershipsOsState();
    return m.plans.filter(function (p) { return p.status !== 'archived'; }).map(function (p) {
      return '<option value="' + esc(p.id) + '"' + (String(selectedId) === String(p.id) ? ' selected' : '') + '>' + esc(p.name) + ' · ' + esc(money(p.price) || '$0') + esc(p.cadence || '/mo') + '</option>';
    }).join('');
  }
  function memCustomerOptions(selectedId) {
    var active = ensureMembershipsOsState().subscribers.filter(function (s) { return s.status !== 'cancelled'; }).map(function (s) { return String(s.customerId); });
    return customers().map(function (c) {
      var busy = active.indexOf(String(c.id)) >= 0 && String(selectedId) !== String(c.id);
      return '<option value="' + esc(c.id || '') + '"' + (String(selectedId) === String(c.id) ? ' selected' : '') + (busy ? ' disabled' : '') + '>' + esc(c.name || 'Customer') + (busy ? ' (member)' : '') + '</option>';
    }).join('');
  }
  function renderMemPlanModal(root) {
    if (!root._josMemPlanModal) return '';
    var m = ensureMembershipsOsState();
    var edit = m.plans.find(function (p) { return String(p.id) === String(root._josMemPlanEditId); }) || {};
    var services = memCatalogServices();
    var selected = (edit.includedServices || []).map(function (r) { return String(r.serviceId || r.serviceName); });
    var svcOpts = services.map(function (s) {
      var on = selected.indexOf(String(s.id)) >= 0 || selected.indexOf(String(s.name)) >= 0;
      return '<option value="' + esc(s.id) + '"' + (on ? ' selected' : '') + '>' + esc(s.name) + '</option>';
    }).join('');
    return '<div class="jos-mem-modal"><div class="jos-mem-modal-panel">' +
      '<h3>' + esc(edit.id ? 'Edit membership plan' : 'Create membership plan') + '</h3>' +
      '<div class="jos-mem-form">' +
        '<label>Name<input id="jos-mem-plan-name" type="text" value="' + esc(edit.name || '') + '" placeholder="Shine Club"></label>' +
        '<label>Price<input id="jos-mem-plan-price" type="number" min="0" step="1" value="' + esc(edit.price || '') + '"></label>' +
        '<label>Cadence<select id="jos-mem-plan-cadence"><option value="/mo"' + ((edit.cadence || '/mo') === '/mo' ? ' selected' : '') + '>/mo</option><option value="/wk"' + (edit.cadence === '/wk' ? ' selected' : '') + '>/wk</option><option value="/yr"' + (edit.cadence === '/yr' ? ' selected' : '') + '>/yr</option></select></label>' +
        '<label>Visits per period<input id="jos-mem-plan-visits" type="number" min="1" step="1" value="' + esc(edit.visitAllowance || 1) + '"></label>' +
        '<label class="jos-mem-span2">Included catalog services<select id="jos-mem-plan-services" multiple>' + svcOpts + '</select><span class="jos-muted">References Storefront services by id/name.</span></label>' +
        '<label class="jos-mem-span2">Perks<textarea id="jos-mem-plan-benefits" class="jos-textarea" placeholder="Priority scheduling&#10;Member pricing">' + esc((edit.benefits || []).join('\n')) + '</textarea></label>' +
      '</div>' +
      '<div class="jos-btn-row jos-mt">' + dsBtn('mem-plan-save', 'Save plan', 'jos-btn-brand jos-btn-sm') + dsBtn('mem-plan-cancel', 'Cancel', 'jos-btn jos-btn-sm') + '</div></div></div>';
  }
  function renderMemSubscriberModal(root) {
    if (!root._josMemSubModal) return '';
    return '<div class="jos-mem-modal"><div class="jos-mem-modal-panel">' +
      '<h3>Start membership</h3><p class="jos-muted">Creates a subscriber record with customerId + planId only.</p>' +
      '<div class="jos-mem-form">' +
        '<label>Customer<select id="jos-mem-sub-customer">' + memCustomerOptions('') + '</select></label>' +
        '<label>Plan<select id="jos-mem-sub-plan">' + memPlanOptions('') + '</select></label>' +
      '</div>' +
      '<div class="jos-btn-row jos-mt">' + dsBtn('mem-sub-save', 'Start subscription', 'jos-btn-brand jos-btn-sm') + dsBtn('mem-sub-cancel', 'Cancel', 'jos-btn jos-btn-sm') + '</div></div></div>';
  }
  function memKpis() {
    var m = ensureMembershipsOsState(), d = DS();
    var active = m.subscribers.filter(function (s) { return s.status === 'active'; });
    var paused = m.subscribers.filter(function (s) { return s.status === 'paused'; }).length;
    var mrr = active.reduce(function (sum, s) { var p = memPlanById(s.planId); return sum + (p ? Number(p.price) || 0 : 0); }, 0);
    var monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    var visits = m.visits.filter(function (v) { return String(v.usedAt || '').slice(0, 10) >= monthStart; }).length;
    var due = active.filter(function (s) { return String(s.nextRenewalAt || '') <= memAddMonths(todayStr(), 0); }).length;
    if (d) {
      return '<div class="jos-mem-kpis">' +
        d.metricCard('Projected MRR', money(mrr) || '$0', 'Plans x active subscribers') +
        d.metricCard('Active members', String(active.length), paused + ' paused') +
        d.metricCard('Visits used', String(visits), 'Tracked by Memberships OS') +
        d.metricCard('Renewals due', String(due), 'Next billing cycle') +
        '</div>';
    }
    return '<div class="jos-kpi-row"><div class="jos-kpi"><div class="jos-kpi-lbl">Projected MRR</div><div class="jos-kpi-v brand">' + esc(money(mrr) || '$0') + '</div></div><div class="jos-kpi"><div class="jos-kpi-lbl">Active members</div><div class="jos-kpi-v">' + active.length + '</div></div><div class="jos-kpi"><div class="jos-kpi-lbl">Visits used</div><div class="jos-kpi-v">' + visits + '</div></div><div class="jos-kpi"><div class="jos-kpi-lbl">Renewals due</div><div class="jos-kpi-v">' + due + '</div></div></div>';
  }
  function renderMemOverviewTab(root) {
    var m = ensureMembershipsOsState(), d = DS();
    var activeIds = m.subscribers.filter(function (s) { return s.status !== 'cancelled'; }).map(function (s) { return String(s.customerId); });
    var candidates = customers().filter(function (c) { return activeIds.indexOf(String(c.id)) < 0; }).map(function (c) {
      var done = memJobsForCustomer(c.id).filter(function (j) { return j.status === 'completed'; }).length;
      return { c: c, done: done, match: Math.min(98, 52 + done * 12 + (c.favorite ? 8 : 0)) };
    }).filter(function (x) { return x.done >= 1; }).sort(function (a, b) { return b.done - a.done || b.match - a.match; }).slice(0, 5);
    var planRows = m.plans.slice(0, 3).map(function (p) {
      return '<div class="jos-mem-act"><div><strong>' + esc(p.name) + '</strong><div class="jos-muted">' + esc(money(p.price) || '$0') + esc(p.cadence || '/mo') + ' · ' + esc(String(p.visitAllowance || 1)) + ' visit allowance</div></div>' + memStatusBadge(p.status) + '</div>';
    }).join('');
    var candRows = candidates.length ? candidates.map(function (x) {
      return '<div class="jos-mem-act"><div><strong>' + esc(x.c.name) + '</strong><div class="jos-muted">' + x.done + ' completed jobs · reads Customers/Jobs</div></div><span class="jos-pill booked">' + x.match + '% fit</span></div>';
    }).join('') : (d ? d.emptyState('No candidates yet', 'Complete jobs to surface membership-ready customers.') : '<div class="jos-empty">No candidates yet.</div>');
    var ai = d ? d.aiInsightCard({ kicker: 'AI · Memberships', body: 'Stage 1 OS is ready: plans, subscribers, renewals, visits, and append-only activity are owned here. Customers, jobs, storefront services, and payments stay with their modules.', actionsHtml: dsBtn('mem-sub-open', 'Start membership', 'jos-btn-brand jos-btn-sm') + dsBtn('mem-stripe', 'Stripe Stage 2', 'jos-btn jos-btn-sm') }) : '';
    return memKpis() + (ai ? '<div class="jos-mt">' + ai + '</div>' : '') +
      '<div class="jos-mem-2col jos-mt"><div class="jos-card"><div class="jos-kicker">Plans snapshot</div><div class="jos-stack jos-mt">' + (planRows || (d ? d.emptyState('No plans', 'Create a membership plan to get started.') : '')) + '</div></div>' +
      '<div class="jos-card"><div class="jos-kicker">Ready to invite</div><div class="jos-stack jos-mt">' + candRows + '</div></div></div>';
  }
  function renderMemPlanCard(p) {
    var services = (p.includedServices || []).map(function (r) { return '<li>' + esc(r.serviceName || r.name || 'Catalog service') + '</li>'; }).join('');
    var perks = (p.benefits || []).map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('');
    return '<div class="jos-mem-card"><div class="jos-mem-card-h"><div><strong>' + esc(p.name) + '</strong><div class="jos-muted">' + esc(money(p.price) || '$0') + esc(p.cadence || '/mo') + ' · ' + esc(String(p.visitAllowance || 1)) + ' visits</div></div>' + memStatusBadge(p.status) + '</div>' +
      '<div class="jos-mem-plan-lists"><div><div class="jos-kicker">Included services</div><ul>' + (services || '<li class="jos-muted">Reference Storefront services here.</li>') + '</ul></div><div><div class="jos-kicker">Perks</div><ul>' + (perks || '<li class="jos-muted">No perks yet.</li>') + '</ul></div></div>' +
      '<div class="jos-mem-card-foot"><button type="button" class="jos-btn jos-btn-sm" data-jos-act="mem-plan-edit" data-jos-mem-plan="' + esc(p.id) + '">Edit</button><button type="button" class="jos-btn jos-btn-sm" data-jos-act="mem-stripe">Stripe Stage 2</button></div></div>';
  }
  function renderMemPlansTab(root) {
    var m = ensureMembershipsOsState(), d = DS();
    var cards = m.plans.length ? m.plans.map(renderMemPlanCard).join('') : (d ? d.emptyState('No plans yet', 'Create your first recurring membership offer.') : '');
    return (d ? d.sectionHeader('Membership plans', 'Plans owned by Memberships OS. Included services reference Storefront catalog records.', dsBtn('mem-plan-open', '+ Create plan', 'jos-btn-brand jos-btn-sm')) : '') +
      '<div class="jos-mem-grid jos-mt">' + cards + '</div>' + renderMemPlanModal(root);
  }
  function renderMemSubscriberRow(s) {
    var c = memCustomerById(s.customerId), p = memPlanById(s.planId);
    var jobsDone = memJobsForCustomer(s.customerId).filter(function (j) { return j.status === 'completed'; }).length;
    var allowance = p ? p.visitAllowance || 1 : 1;
    return '<div class="jos-mem-card" data-jos-mem-sub="' + esc(s.id) + '"><div class="jos-mem-card-h"><div><strong>' + esc(c ? c.name : 'Customer') + '</strong><div class="jos-muted">' + esc(p ? p.name : 'Plan') + ' · ' + esc(money(p ? p.price : 0) || '$0') + esc(p ? p.cadence : '/mo') + '</div></div>' + memStatusBadge(s.status) + '</div>' +
      '<div class="jos-mem-sub-meta"><div><span>Started</span><strong>' + esc(String(s.startedAt || '').slice(0, 10)) + '</strong></div><div><span>Next renewal</span><strong>' + esc(String(s.nextRenewalAt || '').slice(0, 10)) + '</strong></div><div><span>Visits</span><strong>' + esc(String(s.visitsUsed || 0)) + '/' + esc(String(allowance)) + '</strong></div><div><span>Completed jobs</span><strong>' + jobsDone + '</strong></div></div>' +
      '<div class="jos-mem-card-foot">' +
        '<button type="button" class="jos-btn jos-btn-brand jos-btn-sm" data-jos-act="mem-use-visit" data-jos-mem-sub="' + esc(s.id) + '">Use visit</button>' +
        '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="mem-renew" data-jos-mem-sub="' + esc(s.id) + '">Renew</button>' +
        '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="mem-pause" data-jos-mem-sub="' + esc(s.id) + '">Pause</button>' +
        '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="mem-cancel" data-jos-mem-sub="' + esc(s.id) + '">Cancel</button>' +
        '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="mem-open-customer" data-jos-mem-cust="' + esc(s.customerId) + '">Customer</button>' +
      '</div></div>';
  }
  function renderMemSubscribersTab(root) {
    var m = ensureMembershipsOsState(), d = DS();
    var rows = m.subscribers.length ? m.subscribers.map(renderMemSubscriberRow).join('') : (d ? d.emptyState('No subscribers yet', 'Start a membership from an existing customer record.') : '');
    return (d ? d.sectionHeader('Subscribers', 'References Customers by customerId and plans by planId — no customer clones.', dsBtn('mem-sub-open', '+ Start subscription', 'jos-btn-brand jos-btn-sm')) : '') +
      '<div class="jos-mem-grid jos-mt">' + rows + '</div>' + renderMemSubscriberModal(root);
  }
  function renderMemVisitsTab() {
    var m = ensureMembershipsOsState(), d = DS();
    var eligible = m.subscribers.filter(function (s) {
      var p = memPlanById(s.planId);
      return s.status === 'active' && (Number(s.visitsUsed) || 0) < ((p && p.visitAllowance) || 1);
    });
    var quick = eligible.slice(0, 6).map(function (s) {
      var p = memPlanById(s.planId);
      return '<div class="jos-mem-act"><div><strong>' + esc(memCustomerName(s.customerId)) + '</strong><div class="jos-muted">' + esc(p ? p.name : 'Plan') + ' · ' + esc(String(s.visitsUsed || 0)) + '/' + esc(String((p && p.visitAllowance) || 1)) + ' used</div></div><button type="button" class="jos-btn jos-btn-brand jos-btn-sm" data-jos-act="mem-use-visit" data-jos-mem-sub="' + esc(s.id) + '">Use visit</button></div>';
    }).join('');
    var log = m.visits.slice().reverse().map(function (v) {
      return '<div class="jos-mem-event"><div class="jos-mem-event-type">' + esc(memCustomerName(v.customerId)) + ' · visit used</div><div class="jos-muted">' + esc(String(v.usedAt || '').replace('T', ' ').slice(0, 19)) + ' · ' + esc((memPlanById(v.planId) || {}).name || 'Plan') + '</div></div>';
    }).join('');
    return '<div class="jos-mem-2col"><div class="jos-card"><div class="jos-kicker">Eligible today</div><div class="jos-stack jos-mt">' + (quick || (d ? d.emptyState('No eligible visits', 'Renew or start a membership to add visits.') : '')) + '</div></div>' +
      '<div class="jos-card"><div class="jos-kicker">Visit usage log</div><div class="jos-mem-events jos-mt">' + (log || (d ? d.emptyState('No visits used', 'Use a visit to create the first tracking entry.') : '')) + '</div></div></div>';
  }
  function renderMemBillingTab() {
    var m = ensureMembershipsOsState(), d = DS();
    var actual = jobs().filter(function (j) { return j.status === 'completed' && !j.isBlock; }).reduce(function (sum, j) { return sum + (Number(j.amount) || 0); }, 0);
    var rules = m.billingRules.map(function (r) {
      var p = memPlanById(r.planId);
      return '<div class="jos-mem-card"><div class="jos-mem-card-h"><div><strong>' + esc(p ? p.name : 'Plan') + '</strong><div class="jos-muted">' + esc(r.cadence || '/mo') + ' · charge ' + esc(r.chargeTiming || 'advance') + ' · ' + esc(String(r.graceDays || 0)) + ' grace days</div></div><span class="jos-pill info">OS rule</span></div><p class="jos-muted">Stripe billing and card-on-file collection are Stage 2.</p></div>';
    }).join('');
    var renewals = m.renewals.slice().reverse().slice(0, 10).map(function (r) {
      return '<div class="jos-mem-event"><div class="jos-mem-event-type">' + esc(memCustomerName(r.customerId)) + ' renewed</div><div class="jos-muted">' + esc(String(r.renewedAt || '').slice(0, 10)) + ' · next ' + esc(String(r.nextRenewalAt || '').slice(0, 10)) + '</div></div>';
    }).join('');
    var kpi = d ? '<div class="jos-mem-kpis">' + d.metricCard('Completed job revenue', money(actual) || '$0', 'Read from Jobs/Revenue owners') + d.metricCard('Renewal records', String(m.renewals.length), 'Owned renewal refs') + '</div>' : '';
    return kpi + '<div class="jos-mem-2col jos-mt"><div class="jos-card"><div class="jos-kicker">Billing rules</div><div class="jos-mem-grid jos-mt">' + rules + '</div><div class="jos-mt">' + dsBtn('mem-stripe', 'Connect Stripe (Stage 2)', 'jos-btn-brand jos-btn-sm') + '</div></div>' +
      '<div class="jos-card"><div class="jos-kicker">Renewals</div><div class="jos-mem-events jos-mt">' + (renewals || (d ? d.emptyState('No renewals yet', 'Renew a subscriber to populate this log.') : '')) + '</div></div></div>';
  }
  function renderMemActivityTab() {
    var m = ensureMembershipsOsState(), d = DS();
    var list = m.activity.slice().reverse().map(function (a) {
      return '<div class="jos-mem-event"><div class="jos-mem-event-type">' + esc(a.type || 'activity') + '</div><div class="jos-muted">' + esc(String(a.at || '').replace('T', ' ').slice(0, 19)) + '</div><p>' + esc(a.label || '') + '</p></div>';
    }).join('');
    var ev = hublyEvents();
    var events = ev && typeof ev.recent === 'function' ? ev.recent(30).filter(function (row) { return /^membership\./.test(row.type); }) : [];
    var eventHtml = events.map(function (row) {
      return '<div class="jos-mem-event"><div class="jos-mem-event-type">' + esc(row.type) + '</div><div class="jos-muted">' + esc(String(row.at || '').replace('T', ' ').slice(0, 19)) + '</div><pre class="jos-mem-event-payload">' + esc(JSON.stringify(row.payload || {}, null, 0)) + '</pre></div>';
    }).join('');
    return '<div class="jos-mem-2col"><div class="jos-card"><div class="jos-kicker">Append-only activity</div><div class="jos-mem-events jos-mt">' + (list || (d ? d.emptyState('No activity yet', 'Membership actions append entries here.') : '')) + '</div></div>' +
      '<div class="jos-card"><div class="jos-kicker">Membership events</div><div class="jos-mem-events jos-mt">' + (eventHtml || (d ? d.emptyState('No events yet', 'Start, renew, cancel, pause, or use a visit to publish events.') : '')) + '</div></div></div>';
  }
  function renderMemTabBody(root, tab) {
    if (tab === 'overview') return renderMemOverviewTab(root);
    if (tab === 'plans') return renderMemPlansTab(root);
    if (tab === 'subscribers') return renderMemSubscribersTab(root);
    if (tab === 'visits') return renderMemVisitsTab();
    if (tab === 'billing') return renderMemBillingTab();
    if (tab === 'activity') return renderMemActivityTab();
    return renderMemOverviewTab(root);
  }
  function renderMembershipsPageInner(root) {
    ensureMembershipsOsState();
    var tab = root._josMemTab || 'overview';
    var d = DS();
    var tabsHtml = '<div class="jos-tabs jos-mem-tabs">' + MEM_TABS.map(function (t) {
      return '<button type="button" class="jos-tab' + (tab === t[0] ? ' on' : '') + '" data-jos-mem-tab="' + t[0] + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div>';
    var head = d ? d.pageHeader('Memberships', 'Recurring plans, subscribers, renewals, and visit usage — reads Customers, Jobs, Revenue, and Storefront.', dsBtn('mem-plan-open', 'Create plan', 'jos-btn jos-btn-sm') + dsBtn('mem-sub-open', 'Start membership', 'jos-btn-brand jos-btn-sm') + dsBtn('go-ask', 'Ask Hubly', 'jos-btn jos-btn-sm')) :
      '<div class="jos-page-head"><div><h1>Memberships</h1><p>Recurring plans and visit tracking.</p></div></div>';
    root.innerHTML = '<div class="jos-page jos-mem-page">' + head + tabsHtml +
      '<div class="jos-mem-body">' + renderMemTabBody(root, tab) + '</div></div>';
    bindRoot(root);
    wireMembershipsRoot(root);
  }
  function renderMemberships() {
    var root = ownPixelView('v-memberships', 'jos-memberships-root');
    if (!root) return;
    updateChrome('memberships');
    root.innerHTML = '<div class="jos-page jos-mem-page"><div class="jos-home-loading">Loading Memberships…</div></div>';
    try { renderMembershipsPageInner(root); }
    catch (err) {
      console.warn('HublyJourneyOS Memberships', err);
      root.innerHTML = '<div class="jos-page"><div class="jos-empty jos-error-state"><strong>Memberships could not load</strong><p class="jos-muted">Refresh and try again.</p><div class="jos-mt"><button type="button" class="jos-btn jos-btn-brand jos-btn-sm" onclick="HublyJourneyOS.renderMemberships()">Retry</button></div></div></div>';
    }
  }
  function wireMembershipsRoot(root) {
    if (root._josMemBound) return;
    root._josMemBound = true;
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && (root._josMemPlanModal || root._josMemSubModal)) {
        root._josMemPlanModal = false;
        root._josMemSubModal = false;
        root._josMemPlanEditId = null;
        renderMemberships();
      }
    });
  }
  function readMemPlanDraft(root) {
    var svc = el('jos-mem-plan-services');
    var selected = svc ? Array.prototype.slice.call(svc.selectedOptions || []).map(function (o) { return o.value; }) : [];
    return {
      id: root._josMemPlanEditId || memId('mem_plan'),
      name: (el('jos-mem-plan-name') || {}).value || '',
      price: Number((el('jos-mem-plan-price') || {}).value) || 0,
      cadence: (el('jos-mem-plan-cadence') || {}).value || '/mo',
      visitAllowance: Math.max(1, Number((el('jos-mem-plan-visits') || {}).value) || 1),
      includedServices: memServiceRefs(selected),
      benefits: String((el('jos-mem-plan-benefits') || {}).value || '').split(/\n|,/).map(function (x) { return x.trim(); }).filter(Boolean),
      status: 'active',
      source: 'owned'
    };
  }
  function handleMembershipsAct(act, t) {
    var root = el('jos-memberships-root');
    if (!root) return;
    var m = ensureMembershipsOsState();
    var subId = t && (t.getAttribute('data-jos-mem-sub') || (t.closest('[data-jos-mem-sub]') && t.closest('[data-jos-mem-sub]').getAttribute('data-jos-mem-sub')));
    var planId = t && (t.getAttribute('data-jos-mem-plan') || (t.closest('[data-jos-mem-plan]') && t.closest('[data-jos-mem-plan]').getAttribute('data-jos-mem-plan')));
    try {
      if (act === 'mem-plan-open') {
        root._josMemPlanModal = true;
        root._josMemPlanEditId = null;
        root._josMemTab = 'plans';
        return renderMemberships();
      }
      if (act === 'mem-plan-edit' && planId) {
        root._josMemPlanModal = true;
        root._josMemPlanEditId = planId;
        root._josMemTab = 'plans';
        return renderMemberships();
      }
      if (act === 'mem-plan-cancel') {
        root._josMemPlanModal = false;
        root._josMemPlanEditId = null;
        return renderMemberships();
      }
      if (act === 'mem-plan-save') {
        var draft = readMemPlanDraft(root);
        if (!draft.name.trim()) { toast('Plan name required'); return; }
        var idx = m.plans.findIndex(function (p) { return String(p.id) === String(draft.id); });
        if (idx >= 0) m.plans[idx] = normalizeMembershipPlan(draft, idx);
        else m.plans.push(normalizeMembershipPlan(draft, m.plans.length));
        if (!m.billingRules.some(function (r) { return String(r.planId) === String(draft.id); })) {
          m.billingRules.push({ id: memId('mem_rule'), planId: draft.id, cadence: draft.cadence, chargeTiming: 'advance', renewalAnchor: 'signup_day', graceDays: 3, processor: 'stripe_stage2' });
        }
        memPushActivity('plan.saved', 'Saved plan ' + draft.name, { planId: draft.id });
        root._josMemPlanModal = false;
        root._josMemPlanEditId = null;
        toast('Membership plan saved');
        return renderMemberships();
      }
      if (act === 'mem-sub-open') {
        root._josMemSubModal = true;
        root._josMemTab = 'subscribers';
        return renderMemberships();
      }
      if (act === 'mem-sub-cancel') {
        root._josMemSubModal = false;
        return renderMemberships();
      }
      if (act === 'mem-sub-save') {
        var customerId = (el('jos-mem-sub-customer') || {}).value || '';
        var startPlanId = (el('jos-mem-sub-plan') || {}).value || '';
        if (!customerId || !startPlanId) { toast('Pick a customer and plan'); return; }
        var existing = m.subscribers.find(function (s) { return String(s.customerId) === String(customerId) && s.status !== 'cancelled'; });
        if (existing) { toast('Customer already has an active membership'); return; }
        var sub = { id: memId('mem_sub'), customerId: customerId, planId: startPlanId, status: 'active', startedAt: todayStr(), nextRenewalAt: memAddMonths(todayStr(), 1), visitsUsed: 0, visitResetAt: todayStr() };
        m.subscribers.push(sub);
        memPushActivity('membership.started', 'Started membership for ' + memCustomerName(customerId), { subscriberId: sub.id, customerId: customerId, planId: startPlanId });
        publishMembershipEvent('membership.started', { subscriberId: sub.id, customerId: customerId, planId: startPlanId });
        root._josMemSubModal = false;
        toast('Membership started');
        return renderMemberships();
      }
      var sub = subId && m.subscribers.find(function (s) { return String(s.id) === String(subId); });
      if ((act === 'mem-renew' || act === 'mem-pause' || act === 'mem-cancel' || act === 'mem-use-visit') && !sub) { toast('Subscriber not found'); return; }
      if (act === 'mem-renew') {
        sub.status = 'active';
        sub.pausedAt = null;
        sub.visitsUsed = 0;
        sub.visitResetAt = todayStr();
        sub.nextRenewalAt = memAddMonths(sub.nextRenewalAt || todayStr(), 1);
        var renewal = { id: memId('mem_ren'), subscriberId: sub.id, customerId: sub.customerId, planId: sub.planId, renewedAt: todayStr(), nextRenewalAt: sub.nextRenewalAt };
        m.renewals.push(renewal);
        memPushActivity('membership.renewed', 'Renewed membership for ' + memCustomerName(sub.customerId), renewal);
        publishMembershipEvent('membership.renewed', renewal);
        toast('Membership renewed');
        return renderMemberships();
      }
      if (act === 'mem-pause') {
        sub.status = 'paused';
        sub.pausedAt = todayStr();
        memPushActivity('membership.paused', 'Paused membership for ' + memCustomerName(sub.customerId), { subscriberId: sub.id, customerId: sub.customerId, planId: sub.planId });
        publishMembershipEvent('membership.paused', { subscriberId: sub.id, customerId: sub.customerId, planId: sub.planId });
        toast('Membership paused');
        return renderMemberships();
      }
      if (act === 'mem-cancel') {
        sub.status = 'cancelled';
        sub.cancelledAt = todayStr();
        memPushActivity('membership.cancelled', 'Cancelled membership for ' + memCustomerName(sub.customerId), { subscriberId: sub.id, customerId: sub.customerId, planId: sub.planId });
        publishMembershipEvent('membership.cancelled', { subscriberId: sub.id, customerId: sub.customerId, planId: sub.planId });
        toast('Membership cancelled');
        return renderMemberships();
      }
      if (act === 'mem-use-visit') {
        if (sub.status !== 'active') { toast('Membership must be active'); return; }
        var p = memPlanById(sub.planId);
        var allowance = (p && p.visitAllowance) || 1;
        if ((Number(sub.visitsUsed) || 0) >= allowance) { toast('Visit allowance used for this period'); return; }
        sub.visitsUsed = (Number(sub.visitsUsed) || 0) + 1;
        var visit = { id: memId('mem_visit'), subscriberId: sub.id, customerId: sub.customerId, planId: sub.planId, usedAt: new Date().toISOString(), serviceId: ((p && p.includedServices && p.includedServices[0]) || {}).serviceId || null };
        m.visits.push(visit);
        memPushActivity('membership.visit_used', 'Used visit for ' + memCustomerName(sub.customerId), visit);
        publishMembershipEvent('membership.visit_used', visit);
        toast('Visit used');
        return renderMemberships();
      }
      if (act === 'mem-open-customer') {
        var cid = t && t.getAttribute('data-jos-mem-cust');
        if (cid) return openCustomerProfile(cid, 'Membership');
        return toast('No customer linked');
      }
      if (act === 'mem-stripe') return toast('Stripe billing is Stage 2 · not connected');
    } catch (err) {
      console.warn('HublyJourneyOS mem act', act, err);
      toast('Failed — try again');
    }
  }

  var RVE_TABS = [
    ['overview', 'Overview'],
    ['invoices', 'Invoices'],
    ['payments', 'Payments'],
    ['deposits', 'Deposits'],
    ['refunds', 'Refunds'],
    ['taxes', 'Taxes'],
    ['payouts', 'Payouts'],
    ['activity', 'Activity']
  ];
  var RVE_STATUS_LABEL = {
    draft: 'Draft',
    sent: 'Sent',
    deposit_paid: 'Deposit paid',
    paid: 'Paid',
    partially_refunded: 'Partially refunded',
    refunded: 'Refunded',
    void: 'Void'
  };
  function rveId(prefix) { return (prefix || 'rve') + '_' + Math.random().toString(36).slice(2, 9); }
  function rveSlug(v) { return String(v || 'revenue').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'revenue'; }
  function rveAmount(v) { var n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; }
  function rveDateTime(raw) {
    if (raw) {
      var d = new Date(raw);
      if (!isNaN(d.getTime())) return d.toISOString();
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(raw))) return String(raw) + 'T12:00:00.000Z';
    }
    return new Date().toISOString();
  }
  function rveTodayIso() { return new Date().toISOString(); }
  function publishRevenueEvent(type, payload) {
    var ev = hublyEvents();
    if (ev && typeof ev.publish === 'function') ev.publish(type, payload || {});
  }
  function rvePushActivity(type, label, payload) {
    var r = ensureRevenueOsState();
    var entry = { id: rveId('rve_act'), type: type, label: label, at: rveTodayIso(), payload: payload ? Object.assign({}, payload) : {} };
    try { Object.freeze(entry.payload); Object.freeze(entry); } catch (_) {}
    r.activity.push(entry); // Rule #20 — append-only financial activity.
    return entry;
  }
  function rveCustomerById(id) {
    return customers().find(function (c) { return String(c.id) === String(id); }) || null;
  }
  function rveCustomerName(id) {
    var c = rveCustomerById(id);
    return c ? c.name : 'Customer';
  }
  function rveCustomerForJob(j) {
    if (!j) return null;
    if (j.customerId) {
      var direct = rveCustomerById(j.customerId);
      if (direct) return direct;
    }
    return customers().find(function (c) {
      return (j.customer && c.name === j.customer) ||
        (j.phone && c.phone && String(c.phone).replace(/\D/g, '') === String(j.phone).replace(/\D/g, '')) ||
        (j.email && c.email && String(c.email).toLowerCase() === String(j.email).toLowerCase());
    }) || null;
  }
  function rveJobById(id) {
    return jobs().find(function (j) { return String(j.id || j.reqId || '') === String(id); }) || null;
  }
  function rveJobLabel(j) {
    if (!j) return 'No job';
    return (j.service || 'Job') + (j.date ? ' · ' + String(j.date).slice(0, 10) : '') + (j.amount ? ' · ' + (money(j.amount) || '$0') : '');
  }
  function rveNormalizeStatus(status) {
    var s = String(status || 'draft').toLowerCase();
    if (s === 'open' || s === 'unpaid') return 'sent';
    if (s === 'deposit' || s === 'deposit_paid') return 'deposit_paid';
    if (s === 'partial_refund') return 'partially_refunded';
    if (s === 'cancelled' || s === 'canceled' || s === 'voided') return 'void';
    return RVE_STATUS_LABEL[s] ? s : 'draft';
  }
  function rveInvoiceNumber(idx) {
    return 'RVE-' + String(new Date().getFullYear()).slice(2) + '-' + String(idx + 1).padStart(4, '0');
  }
  function normalizeRevenueInvoice(inv, idx) {
    inv = inv || {};
    var subtotal = rveAmount(inv.subtotal != null ? inv.subtotal : inv.amount);
    var taxAmount = rveAmount(inv.taxAmount);
    var total = rveAmount(inv.total != null ? inv.total : (subtotal + taxAmount));
    var lines = Array.isArray(inv.lines) ? inv.lines : [];
    if (!lines.length && (subtotal || inv.serviceName)) {
      lines = [{
        id: rveId('rve_line'),
        serviceId: inv.serviceId || null,
        description: inv.serviceName || 'Service',
        qty: 1,
        unitPrice: subtotal,
        taxRate: taxAmount && subtotal ? Math.round((taxAmount / subtotal) * 10000) / 100 : 0
      }];
    }
    return {
      id: inv.id || rveId('rve_inv'),
      number: inv.number || rveInvoiceNumber(idx || 0),
      customerId: inv.customerId || null,
      jobId: inv.jobId || null,
      membershipId: inv.membershipId || null,
      serviceId: inv.serviceId || null,
      serviceName: inv.serviceName || (lines[0] && lines[0].description) || 'Service',
      subtotal: subtotal,
      taxAmount: taxAmount,
      total: total,
      depositRequired: rveAmount(inv.depositRequired),
      status: rveNormalizeStatus(inv.status),
      issuedAt: inv.issuedAt || rveDateTime(inv.createdAt || inv.date),
      sentAt: inv.sentAt || null,
      paidAt: inv.paidAt || null,
      voidedAt: inv.voidedAt || null,
      lines: lines.map(function (line, i) {
        line = line || {};
        return {
          id: line.id || rveId('rve_line'),
          serviceId: line.serviceId || null,
          description: line.description || line.serviceName || line.name || 'Service',
          qty: Number(line.qty || 1) || 1,
          unitPrice: rveAmount(line.unitPrice != null ? line.unitPrice : line.amount),
          taxRate: Number(line.taxRate || 0) || 0
        };
      })
    };
  }
  function normalizeRevenueLedgerRow(row, prefix) {
    row = row || {};
    return {
      id: row.id || rveId(prefix),
      invoiceId: row.invoiceId || null,
      customerId: row.customerId || null,
      amount: rveAmount(row.amount),
      method: row.method || 'other',
      at: row.at || rveDateTime(row.createdAt || row.date),
      note: row.note || ''
    };
  }
  function normalizeRevenuePayout(row) {
    row = row || {};
    var st = String(row.status || 'completed').toLowerCase();
    if (['pending', 'completed', 'failed'].indexOf(st) < 0) st = 'completed';
    return {
      id: row.id || rveId('rve_payout'),
      amount: rveAmount(row.amount),
      status: st,
      at: row.at || rveDateTime(row.createdAt || row.date),
      destinationLabel: row.destinationLabel || 'Manual payout record'
    };
  }
  function rveSeedInvoiceFromJob(j, idx) {
    var amount = rveAmount(j && j.amount);
    if (!j || !amount) return null;
    var c = rveCustomerForJob(j);
    var paid = !!(j.paid || j.payStatus === 'paid' || j.status === 'paid');
    var completed = j.status === 'completed' || paid;
    if (!completed) return null;
    var jid = j.id || j.reqId || ('job_' + idx);
    var at = rveDateTime(j.paid_at || j.paidAt || j.date || j.createdAt);
    return {
      invoice: normalizeRevenueInvoice({
        id: 'rve_inv_job_' + rveSlug(jid),
        number: 'RVE-JOB-' + String(idx + 1).padStart(4, '0'),
        customerId: c ? c.id : (j.customerId || null),
        jobId: jid,
        serviceId: j.serviceId || null,
        serviceName: j.service || 'Completed job',
        subtotal: amount,
        total: amount,
        status: paid ? 'paid' : 'sent',
        issuedAt: rveDateTime(j.date || j.createdAt),
        sentAt: paid || completed ? rveDateTime(j.date || j.createdAt) : null,
        paidAt: paid ? at : null
      }, idx),
      payment: paid ? normalizeRevenueLedgerRow({
        id: 'rve_pay_job_' + rveSlug(jid),
        invoiceId: 'rve_inv_job_' + rveSlug(jid),
        customerId: c ? c.id : (j.customerId || null),
        amount: amount,
        method: j.pay_method || j.payMethod || 'other',
        at: at,
        note: 'Seeded from paid job'
      }, 'rve_pay') : null
    };
  }
  function rveRecalcTaxes(r) {
    var map = {};
    (r.invoices || []).forEach(function (inv) {
      if (inv.status === 'void') return;
      (inv.lines || []).forEach(function (line) {
        var rate = Number(line.taxRate || 0) || 0;
        var taxable = (Number(line.qty || 1) || 1) * (Number(line.unitPrice) || 0);
        var tax = taxable * rate / 100;
        if (!rate && !tax) return;
        var key = String(rate);
        if (!map[key]) map[key] = { id: 'rve_tax_' + rveSlug(key), rate: rate, taxable: 0, taxAmount: 0, invoiceCount: 0 };
        map[key].taxable += taxable;
        map[key].taxAmount += tax;
        map[key].invoiceCount += 1;
      });
      if (inv.taxAmount && !(inv.lines || []).some(function (line) { return Number(line.taxRate || 0) > 0; })) {
        var fallback = 'recorded';
        if (!map[fallback]) map[fallback] = { id: 'rve_tax_recorded', rate: null, taxable: 0, taxAmount: 0, invoiceCount: 0 };
        map[fallback].taxable += Number(inv.subtotal) || 0;
        map[fallback].taxAmount += Number(inv.taxAmount) || 0;
        map[fallback].invoiceCount += 1;
      }
    });
    return Object.keys(map).map(function (k) {
      var x = map[k];
      x.taxable = Math.round(x.taxable * 100) / 100;
      x.taxAmount = Math.round(x.taxAmount * 100) / 100;
      return x;
    });
  }
  function ensureRevenueOsState() {
    var st = S();
    if (!st.revenueOs || typeof st.revenueOs !== 'object') st.revenueOs = {};
    var r = st.revenueOs;
    if (!Array.isArray(r.invoices)) r.invoices = [];
    if (!Array.isArray(r.payments)) r.payments = [];
    if (!Array.isArray(r.deposits)) r.deposits = [];
    if (!Array.isArray(r.refunds)) r.refunds = [];
    if (!Array.isArray(r.taxes)) r.taxes = [];
    if (!Array.isArray(r.payouts)) r.payouts = [];
    if (!Array.isArray(r.activity)) r.activity = [];
    if (!r.stripe || typeof r.stripe !== 'object') r.stripe = {};
    r.stripe.status = r.stripe.status === 'live' ? 'placeholder' : (r.stripe.status || 'not_connected');
    if (r.stripe.lastSyncAt == null) r.stripe.lastSyncAt = null;
    if (r.stripe.accountLabel == null) r.stripe.accountLabel = null;
    // Normalize in place (Rule #20) — preserve object identity for ledger rows
    function applyInv(inv, idx) {
      var n = normalizeRevenueInvoice(inv, idx);
      Object.keys(n).forEach(function (k) { inv[k] = n[k]; });
      return inv;
    }
    function applyLedger(row, prefix) {
      var n = normalizeRevenueLedgerRow(row, prefix);
      Object.keys(n).forEach(function (k) { row[k] = n[k]; });
      return row;
    }
    function applyPayout(row) {
      var n = normalizeRevenuePayout(row);
      Object.keys(n).forEach(function (k) { row[k] = n[k]; });
      return row;
    }
    r.invoices.forEach(applyInv);
    r.payments = r.payments.map(function (p) { return applyLedger(p, 'rve_pay'); }).filter(function (p) { return p.invoiceId && p.amount; });
    r.deposits = r.deposits.map(function (p) { return applyLedger(p, 'rve_dep'); }).filter(function (p) { return p.invoiceId && p.amount; });
    r.refunds = r.refunds.map(function (p) { return applyLedger(p, 'rve_ref'); }).filter(function (p) { return p.invoiceId && p.amount; });
    r.payouts = r.payouts.map(applyPayout).filter(function (p) { return p.amount; });
    jobs().forEach(function (j, idx) {
      var seed = rveSeedInvoiceFromJob(j, idx);
      if (!seed) return;
      var existing = r.invoices.find(function (inv) { return String(inv.jobId || '') === String(seed.invoice.jobId || '') || String(inv.id) === String(seed.invoice.id); });
      if (!existing) {
        r.invoices.push(seed.invoice);
      } else if (seed.payment && existing.status !== 'paid' && existing.status !== 'refunded' && existing.status !== 'partially_refunded') {
        existing.status = 'paid';
        existing.sentAt = existing.sentAt || seed.invoice.sentAt;
        existing.paidAt = existing.paidAt || seed.invoice.paidAt;
        if (!r.activity.some(function (a) { return a.type === 'system.seed_paid_job' && a.payload && String(a.payload.jobId) === String(seed.invoice.jobId); })) {
          var paidSeedAct = { id: rveId('rve_act'), type: 'system.seed_paid_job', label: 'Seeded paid job into Revenue invoice ' + existing.number, at: rveTodayIso(), payload: { invoiceId: existing.id, jobId: seed.invoice.jobId, customerId: existing.customerId, amount: existing.total } };
          try { Object.freeze(paidSeedAct.payload); Object.freeze(paidSeedAct); } catch (_) {}
          r.activity.push(paidSeedAct);
        }
      }
      if (seed.payment && !r.payments.some(function (p) { return String(p.id) === String(seed.payment.id) || (String(p.invoiceId) === String(seed.payment.invoiceId) && p.note === seed.payment.note); })) {
        r.payments.push(seed.payment);
      }
    });
    r.invoices.forEach(applyInv);
    r.taxes = rveRecalcTaxes(r);
    if (!r._seeded) {
      r._seeded = true;
      var entry = { id: rveId('rve_act'), type: 'system', label: 'Revenue OS initialized from completed and paid jobs by reference', at: rveTodayIso(), payload: {} };
      try { Object.freeze(entry.payload); Object.freeze(entry); } catch (_) {}
      r.activity.push(entry);
    }
    return r;
  }
  function rveInvoiceById(id) {
    var r = ensureRevenueOsState();
    return r.invoices.find(function (inv) { return String(inv.id) === String(id); }) || null;
  }
  function rveLedgerSum(rows, invoiceId) {
    return (rows || []).filter(function (row) { return String(row.invoiceId) === String(invoiceId); })
      .reduce(function (sum, row) { return sum + (Number(row.amount) || 0); }, 0);
  }
  function rvePaidAmount(invoiceId) { var r = ensureRevenueOsState(); return rveLedgerSum(r.payments, invoiceId); }
  function rveDepositAmount(invoiceId) { var r = ensureRevenueOsState(); return rveLedgerSum(r.deposits, invoiceId); }
  function rveRefundAmount(invoiceId) { var r = ensureRevenueOsState(); return rveLedgerSum(r.refunds, invoiceId); }
  function rveCollectedAmount(invoiceId) { return rvePaidAmount(invoiceId) + rveDepositAmount(invoiceId); }
  function rveBalance(inv) {
    if (!inv || inv.status === 'void') return 0;
    return Math.max(0, Math.round(((Number(inv.total) || 0) - rveCollectedAmount(inv.id)) * 100) / 100);
  }
  function rveStatusBadge(status) {
    var d = DS(), s = rveNormalizeStatus(status);
    var tone = s === 'paid' ? 'ok' : (s === 'sent' || s === 'deposit_paid' ? 'warn' : (s === 'refunded' || s === 'void' ? 'hot' : 'info'));
    return d ? d.statusBadge(RVE_STATUS_LABEL[s] || s, tone) : '<span class="jos-pill ' + tone + '">' + esc(RVE_STATUS_LABEL[s] || s) + '</span>';
  }
  function rveCustomerOptions(selectedId) {
    return customers().map(function (c) {
      return '<option value="' + esc(c.id || '') + '"' + (String(c.id) === String(selectedId) ? ' selected' : '') + '>' + esc(c.name || 'Customer') + '</option>';
    }).join('');
  }
  function rveJobOptions(selectedId) {
    var opts = '<option value="">No linked job</option>';
    return opts + jobs().filter(function (j) { return !j.isBlock && rveAmount(j.amount); }).map(function (j) {
      var id = j.id || j.reqId || '';
      return '<option value="' + esc(id) + '"' + (String(id) === String(selectedId) ? ' selected' : '') + '>' + esc((j.customer || 'Customer') + ' · ' + rveJobLabel(j)) + '</option>';
    }).join('');
  }
  function rveInvoiceOptions(selectedId) {
    var r = ensureRevenueOsState();
    return r.invoices.filter(function (inv) { return inv.status !== 'void' && inv.status !== 'refunded'; }).map(function (inv) {
      return '<option value="' + esc(inv.id) + '"' + (String(inv.id) === String(selectedId) ? ' selected' : '') + '>' + esc(inv.number + ' · ' + rveCustomerName(inv.customerId) + ' · ' + (money(inv.total) || '$0')) + '</option>';
    }).join('');
  }
  function renderRevenueInvoiceModal(root) {
    if (root._josRveModal !== 'invoice') return '';
    return '<div class="jos-rve-modal"><div class="jos-rve-modal-panel">' +
      '<h3>Create invoice</h3><p class="jos-muted">Creates a draft invoice owned by Revenue. Customers and Jobs are referenced by id.</p>' +
      '<div class="jos-rve-form">' +
        '<label>Customer<select id="jos-rve-inv-customer">' + rveCustomerOptions('') + '</select></label>' +
        '<label>Linked job<select id="jos-rve-inv-job">' + rveJobOptions('') + '</select></label>' +
        '<label>Service label<input id="jos-rve-inv-service" type="text" placeholder="Interior detail"></label>' +
        '<label>Subtotal<input id="jos-rve-inv-subtotal" type="number" min="0" step="0.01" value="0"></label>' +
        '<label>Tax<input id="jos-rve-inv-tax" type="number" min="0" step="0.01" value="0"></label>' +
        '<label>Deposit required<input id="jos-rve-inv-deposit" type="number" min="0" step="0.01" value="0"></label>' +
        '<label class="jos-rve-span2">Line description<textarea id="jos-rve-inv-desc" class="jos-textarea" placeholder="Service description"></textarea></label>' +
      '</div>' +
      '<div class="jos-btn-row jos-mt">' + dsBtn('rve-inv-save', 'Save draft', 'jos-btn-brand jos-btn-sm') + dsBtn('rve-inv-cancel', 'Cancel', 'jos-btn jos-btn-sm') + '</div></div></div>';
  }
  function renderRevenueLedgerModal(root) {
    var modal = root._josRveModal;
    if (['payment', 'deposit', 'refund', 'payout'].indexOf(modal) < 0) return '';
    if (modal === 'payout') {
      return '<div class="jos-rve-modal"><div class="jos-rve-modal-panel"><h3>Record payout</h3><p class="jos-muted">OS record only. Live Stripe Connect payouts are Stage 2.</p>' +
        '<div class="jos-rve-form"><label>Amount<input id="jos-rve-payout-amount" type="number" min="0" step="0.01"></label>' +
        '<label>Destination label<input id="jos-rve-payout-dest" type="text" placeholder="Operating account"></label></div>' +
        '<div class="jos-btn-row jos-mt">' + dsBtn('rve-payout-save', 'Record payout', 'jos-btn-brand jos-btn-sm') + dsBtn('rve-pay-cancel', 'Cancel', 'jos-btn jos-btn-sm') + '</div></div></div>';
    }
    var label = modal === 'payment' ? 'Record payment' : (modal === 'deposit' ? 'Record deposit' : 'Issue refund');
    var act = modal === 'payment' ? 'rve-pay-save' : (modal === 'deposit' ? 'rve-dep-save' : 'rve-ref-save');
    var selected = root._josRveInvoiceId || '';
    return '<div class="jos-rve-modal"><div class="jos-rve-modal-panel"><h3>' + esc(label) + '</h3>' +
      '<div class="jos-rve-form">' +
        '<label>Invoice<select id="jos-rve-ledger-invoice">' + rveInvoiceOptions(selected) + '</select></label>' +
        '<label>Amount<input id="jos-rve-ledger-amount" type="number" min="0" step="0.01"></label>' +
        '<label>Method<select id="jos-rve-ledger-method"><option value="card">Card</option><option value="cash">Cash</option><option value="check">Check</option><option value="stripe">Stripe</option><option value="other">Other</option></select></label>' +
        '<label class="jos-rve-span2">Note<textarea id="jos-rve-ledger-note" class="jos-textarea"></textarea></label>' +
      '</div><div class="jos-btn-row jos-mt">' + dsBtn(act, label, 'jos-btn-brand jos-btn-sm') + dsBtn('rve-pay-cancel', 'Cancel', 'jos-btn jos-btn-sm') + '</div></div></div>';
  }
  function rveKpis() {
    var r = ensureRevenueOsState(), d = DS();
    var collected = r.payments.reduce(function (s, p) { return s + (Number(p.amount) || 0); }, 0) + r.deposits.reduce(function (s, p) { return s + (Number(p.amount) || 0); }, 0);
    var refunds = r.refunds.reduce(function (s, p) { return s + (Number(p.amount) || 0); }, 0);
    var deposits = r.deposits.reduce(function (s, p) { return s + (Number(p.amount) || 0); }, 0);
    var outstanding = r.invoices.reduce(function (s, inv) { return s + rveBalance(inv); }, 0);
    if (d) {
      return '<div class="jos-rve-kpis">' +
        d.metricCard('Collected', money(collected - refunds) || '$0', 'Payments + deposits - refunds') +
        d.metricCard('Outstanding', money(outstanding) || '$0', 'Open invoice balance') +
        d.metricCard('Deposits', money(deposits) || '$0', r.deposits.length + ' recorded') +
        d.metricCard('Refunds', money(refunds) || '$0', r.refunds.length + ' issued') +
        '</div>';
    }
    return '<div class="jos-kpi-row"><div class="jos-kpi"><div class="jos-kpi-lbl">Collected</div><div class="jos-kpi-v brand">' + esc(money(collected - refunds) || '$0') + '</div></div><div class="jos-kpi"><div class="jos-kpi-lbl">Outstanding</div><div class="jos-kpi-v">' + esc(money(outstanding) || '$0') + '</div></div></div>';
  }
  function renderRevenueOverviewTab(root) {
    var r = ensureRevenueOsState(), d = DS();
    var open = r.invoices.filter(function (inv) { return ['draft', 'sent', 'deposit_paid'].indexOf(inv.status) >= 0; }).slice(0, 5);
    var rows = open.map(function (inv) {
      return '<div class="jos-rve-act"><div><strong>' + esc(inv.number) + ' · ' + esc(rveCustomerName(inv.customerId)) + '</strong><div class="jos-muted">' + esc(inv.serviceName || 'Service') + ' · balance ' + esc(money(rveBalance(inv)) || '$0') + '</div></div>' + rveStatusBadge(inv.status) + '</div>';
    }).join('');
    var ai = d ? d.aiInsightCard({
      kicker: 'AI · Revenue integrity',
      body: 'Revenue Stage 1 OS now owns invoices, payments, deposits, refunds, taxes, payouts, and Stripe sync status. Jobs and Customers are referenced, not cloned.',
      actionsHtml: dsBtn('rve-inv-open', 'Create invoice', 'jos-btn-brand jos-btn-sm') + dsBtn('rve-stripe', 'Stripe Stage 2', 'jos-btn jos-btn-sm')
    }) : '';
    return rveKpis() + (ai ? '<div class="jos-mt">' + ai + '</div>' : '') +
      '<div class="jos-rve-2col jos-mt"><div class="jos-card"><div class="jos-kicker">Open invoices</div><div class="jos-stack jos-mt">' + (rows || (d ? d.emptyState('No open invoices', 'Create or send an invoice to start tracking receivables.') : '')) + '</div></div>' +
      '<div class="jos-card"><div class="jos-kicker">Stripe sync status</div><div class="jos-rve-stripe"><strong>Not connected</strong><span>Live Stripe is deferred to Stage 2. OS records remain manual and append-only.</span></div><div class="jos-mt">' + dsBtn('rve-stripe', 'Stripe Stage 2', 'jos-btn jos-btn-sm') + '</div></div></div>';
  }
  function renderRevenueInvoiceCard(inv) {
    var bal = rveBalance(inv);
    var paid = rvePaidAmount(inv.id), dep = rveDepositAmount(inv.id), ref = rveRefundAmount(inv.id);
    var canSend = inv.status === 'draft';
    var canVoid = inv.status === 'draft' || inv.status === 'sent';
    return '<div class="jos-rve-card" data-jos-rve-inv="' + esc(inv.id) + '"><div class="jos-rve-card-h"><div><strong>' + esc(inv.number) + '</strong><div class="jos-muted">' + esc(rveCustomerName(inv.customerId)) + ' · ' + esc(inv.serviceName || 'Service') + '</div></div>' + rveStatusBadge(inv.status) + '</div>' +
      '<div class="jos-rve-money-row"><div><span>Total</span><strong>' + esc(money(inv.total) || '$0') + '</strong></div><div><span>Collected</span><strong>' + esc(money(paid + dep) || '$0') + '</strong></div><div><span>Balance</span><strong>' + esc(money(bal) || '$0') + '</strong></div><div><span>Refunded</span><strong>' + esc(money(ref) || '$0') + '</strong></div></div>' +
      '<div class="jos-rve-card-foot">' +
        (canSend ? '<button type="button" class="jos-btn jos-btn-brand jos-btn-sm" data-jos-act="rve-inv-send" data-jos-rve-inv="' + esc(inv.id) + '">Send</button>' : '') +
        (canVoid ? '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="rve-inv-void" data-jos-rve-inv="' + esc(inv.id) + '">Void</button>' : '') +
        '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="rve-pay-open" data-jos-rve-inv="' + esc(inv.id) + '">Payment</button>' +
        '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="rve-dep-open" data-jos-rve-inv="' + esc(inv.id) + '">Deposit</button>' +
        '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="rve-ref-open" data-jos-rve-inv="' + esc(inv.id) + '">Refund</button>' +
        '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="rve-open-customer" data-jos-rve-cust="' + esc(inv.customerId || '') + '">Customer</button>' +
      '</div></div>';
  }
  function renderRevenueInvoicesTab(root) {
    var r = ensureRevenueOsState(), d = DS();
    var rows = r.invoices.length ? r.invoices.slice().reverse().map(renderRevenueInvoiceCard).join('') : (d ? d.emptyState('No invoices yet', 'Create a draft invoice to start the Revenue ledger.') : '');
    return (d ? d.sectionHeader('Invoices', 'Lifecycle: draft -> sent -> deposit paid -> paid -> refunded/void.', dsBtn('rve-inv-open', '+ Create invoice', 'jos-btn-brand jos-btn-sm')) : '') +
      '<div class="jos-rve-grid jos-mt">' + rows + '</div>' + renderRevenueInvoiceModal(root);
  }
  function renderRevenueLedgerTab(root, kind) {
    var r = ensureRevenueOsState(), d = DS();
    var rows = kind === 'payments' ? r.payments : (kind === 'deposits' ? r.deposits : r.refunds);
    var act = kind === 'payments' ? 'rve-pay-open' : (kind === 'deposits' ? 'rve-dep-open' : 'rve-ref-open');
    var title = kind.charAt(0).toUpperCase() + kind.slice(1);
    var empty = d ? d.emptyState('No ' + kind + ' yet', 'Record a ' + kind.replace(/s$/, '') + ' to append to the ledger.') : '';
    var list = rows.slice().reverse().map(function (row) {
      var inv = rveInvoiceById(row.invoiceId);
      return '<div class="jos-rve-event"><div class="jos-rve-event-type">' + esc(money(row.amount) || '$0') + ' · ' + esc(row.method || 'other') + '</div><div class="jos-muted">' + esc((inv && inv.number) || row.invoiceId || 'Invoice') + ' · ' + esc(rveCustomerName(row.customerId)) + ' · ' + esc(String(row.at || '').replace('T', ' ').slice(0, 19)) + '</div>' + (row.note ? '<p>' + esc(row.note) + '</p>' : '') + '</div>';
    }).join('');
    return (d ? d.sectionHeader(title, 'Append-only ' + kind + ' ledger owned by Revenue.', dsBtn(act, '+ Record', 'jos-btn-brand jos-btn-sm')) : '') +
      '<div class="jos-rve-events jos-mt">' + (list || empty) + '</div>' + renderRevenueLedgerModal(root);
  }
  function renderRevenueTaxesTab() {
    var r = ensureRevenueOsState(), d = DS();
    var rows = r.taxes.map(function (tax) {
      return '<div class="jos-rve-card"><div class="jos-rve-card-h"><div><strong>' + esc(tax.rate == null ? 'Recorded tax' : (tax.rate + '% tax')) + '</strong><div class="jos-muted">' + esc(String(tax.invoiceCount || 0)) + ' invoice lines</div></div><span class="jos-pill info">OS summary</span></div>' +
        '<div class="jos-rve-money-row"><div><span>Taxable</span><strong>' + esc(money(tax.taxable) || '$0') + '</strong></div><div><span>Tax</span><strong>' + esc(money(tax.taxAmount) || '$0') + '</strong></div></div></div>';
    }).join('');
    return (d ? d.sectionHeader('Taxes', 'Stage 1 summary from invoice lines and recorded tax amounts.') : '') +
      '<div class="jos-rve-grid jos-mt">' + (rows || (d ? d.emptyState('No tax recorded', 'Add tax to invoice lines to populate this summary.') : '')) + '</div>';
  }
  function renderRevenuePayoutsTab(root) {
    var r = ensureRevenueOsState(), d = DS();
    var rows = r.payouts.slice().reverse().map(function (p) {
      return '<div class="jos-rve-event"><div class="jos-rve-event-type">' + esc(money(p.amount) || '$0') + ' payout</div><div class="jos-muted">' + esc(String(p.at || '').replace('T', ' ').slice(0, 19)) + ' · ' + esc(p.destinationLabel || 'Destination') + '</div>' + rveStatusBadge(p.status === 'completed' ? 'paid' : 'sent') + '</div>';
    }).join('');
    return (d ? d.sectionHeader('Payouts', 'Manual OS payout records. Live Connect payouts are Stage 2.', dsBtn('rve-payout-open', '+ Record payout', 'jos-btn-brand jos-btn-sm') + dsBtn('rve-stripe', 'Stripe Stage 2', 'jos-btn jos-btn-sm')) : '') +
      '<div class="jos-rve-events jos-mt">' + (rows || (d ? d.emptyState('No payouts yet', 'Record a completed payout to append it to the ledger.') : '')) + '</div>' + renderRevenueLedgerModal(root);
  }
  function renderRevenueActivityTab() {
    var r = ensureRevenueOsState(), d = DS();
    var list = r.activity.slice().reverse().map(function (a) {
      return '<div class="jos-rve-event"><div class="jos-rve-event-type">' + esc(a.type || 'activity') + '</div><div class="jos-muted">' + esc(String(a.at || '').replace('T', ' ').slice(0, 19)) + '</div><p>' + esc(a.label || '') + '</p></div>';
    }).join('');
    var ev = hublyEvents();
    var eventTypes = /^(invoice\.sent|invoice\.paid|invoice\.voided|deposit\.paid|payment\.received|refund\.issued|payout\.completed)$/;
    var events = ev && typeof ev.recent === 'function' ? ev.recent(40).filter(function (row) { return eventTypes.test(row.type); }) : [];
    var eventHtml = events.map(function (row) {
      return '<div class="jos-rve-event"><div class="jos-rve-event-type">' + esc(row.type) + '</div><div class="jos-muted">' + esc(String(row.at || '').replace('T', ' ').slice(0, 19)) + '</div><pre class="jos-rve-event-payload">' + esc(JSON.stringify(row.payload || {}, null, 0)) + '</pre></div>';
    }).join('');
    return '<div class="jos-rve-2col"><div class="jos-card"><div class="jos-kicker">Append-only activity</div><div class="jos-rve-events jos-mt">' + (list || (d ? d.emptyState('No activity yet', 'Revenue actions append entries here.') : '')) + '</div></div>' +
      '<div class="jos-card"><div class="jos-kicker">Revenue events</div><div class="jos-rve-events jos-mt">' + (eventHtml || (d ? d.emptyState('No events yet', 'Send, pay, refund, or payout to publish events.') : '')) + '</div></div></div>';
  }
  function renderRevenueTabBody(root, tab) {
    if (tab === 'overview') return renderRevenueOverviewTab(root);
    if (tab === 'invoices') return renderRevenueInvoicesTab(root);
    if (tab === 'payments') return renderRevenueLedgerTab(root, 'payments');
    if (tab === 'deposits') return renderRevenueLedgerTab(root, 'deposits');
    if (tab === 'refunds') return renderRevenueLedgerTab(root, 'refunds');
    if (tab === 'taxes') return renderRevenueTaxesTab();
    if (tab === 'payouts') return renderRevenuePayoutsTab(root);
    if (tab === 'activity') return renderRevenueActivityTab();
    return renderRevenueOverviewTab(root);
  }
  function renderRevenuePageInner(root) {
    ensureRevenueOsState();
    var tab = root._josRveTab || 'overview';
    var d = DS();
    var tabsHtml = '<div class="jos-tabs jos-rve-tabs">' + RVE_TABS.map(function (t) {
      return '<button type="button" class="jos-tab' + (tab === t[0] ? ' on' : '') + '" data-jos-rve-tab="' + t[0] + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div>';
    var head = d ? d.pageHeader('Revenue', 'Financial ledger for invoices, payments, deposits, refunds, taxes, and payouts.', dsBtn('rve-inv-open', 'Create invoice', 'jos-btn jos-btn-sm') + dsBtn('rve-pay-open', 'Record payment', 'jos-btn-brand jos-btn-sm') + dsBtn('rve-stripe', 'Stripe Stage 2', 'jos-btn jos-btn-sm')) :
      '<div class="jos-page-head"><div><h1>Revenue</h1><p>Financial ledger and lifecycle.</p></div></div>';
    root.innerHTML = '<div class="jos-page jos-rve-page">' + head + tabsHtml +
      '<div class="jos-rve-body">' + renderRevenueTabBody(root, tab) + '</div></div>';
    bindRoot(root);
    wireRevenueRoot(root);
  }
  function renderRevenue() {
    var root = ownPixelView('v-money', 'jos-revenue-root');
    if (!root) return;
    updateChrome('money');
    root.innerHTML = '<div class="jos-page jos-rve-page"><div class="jos-home-loading">Loading Revenue...</div></div>';
    try { renderRevenuePageInner(root); }
    catch (err) {
      console.warn('HublyJourneyOS Revenue', err);
      root.innerHTML = '<div class="jos-page"><div class="jos-empty jos-error-state"><strong>Revenue could not load</strong><p class="jos-muted">Refresh and try again.</p><div class="jos-mt"><button type="button" class="jos-btn jos-btn-brand jos-btn-sm" onclick="HublyJourneyOS.renderRevenue()">Retry</button></div></div></div>';
    }
  }
  function wireRevenueRoot(root) {
    if (root._josRveBound) return;
    root._josRveBound = true;
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root._josRveModal) {
        root._josRveModal = null;
        root._josRveInvoiceId = null;
        renderRevenue();
      }
    });
  }
  function readRevenueInvoiceDraft(root) {
    var jobId = (el('jos-rve-inv-job') || {}).value || '';
    var job = jobId ? rveJobById(jobId) : null;
    var customerId = (el('jos-rve-inv-customer') || {}).value || '';
    var jobCust = job ? rveCustomerForJob(job) : null;
    if (!customerId && jobCust) customerId = jobCust.id;
    var subtotal = rveAmount((el('jos-rve-inv-subtotal') || {}).value || (job && job.amount));
    var taxAmount = rveAmount((el('jos-rve-inv-tax') || {}).value);
    var serviceName = (el('jos-rve-inv-service') || {}).value || (job && job.service) || 'Service';
    var desc = (el('jos-rve-inv-desc') || {}).value || serviceName;
    return normalizeRevenueInvoice({
      id: rveId('rve_inv'),
      customerId: customerId || null,
      jobId: jobId || null,
      serviceId: job && job.serviceId || null,
      serviceName: serviceName,
      subtotal: subtotal,
      taxAmount: taxAmount,
      total: subtotal + taxAmount,
      depositRequired: rveAmount((el('jos-rve-inv-deposit') || {}).value),
      status: 'draft',
      issuedAt: rveTodayIso(),
      lines: [{ id: rveId('rve_line'), serviceId: job && job.serviceId || null, description: desc, qty: 1, unitPrice: subtotal, taxRate: subtotal ? Math.round((taxAmount / subtotal) * 10000) / 100 : 0 }]
    }, ensureRevenueOsState().invoices.length);
  }
  function readRevenueLedgerDraft() {
    var invoiceId = (el('jos-rve-ledger-invoice') || {}).value || '';
    var inv = rveInvoiceById(invoiceId);
    return normalizeRevenueLedgerRow({
      invoiceId: invoiceId,
      customerId: inv ? inv.customerId : null,
      amount: rveAmount((el('jos-rve-ledger-amount') || {}).value),
      method: (el('jos-rve-ledger-method') || {}).value || 'other',
      at: rveTodayIso(),
      note: (el('jos-rve-ledger-note') || {}).value || ''
    }, 'rve_row');
  }
  function handleRevenueAct(act, t) {
    var root = el('jos-revenue-root');
    if (!root) return;
    var r = ensureRevenueOsState();
    var invId = t && (t.getAttribute('data-jos-rve-inv') || (t.closest('[data-jos-rve-inv]') && t.closest('[data-jos-rve-inv]').getAttribute('data-jos-rve-inv')));
    try {
      if (act === 'rve-inv-open') { root._josRveModal = 'invoice'; root._josRveTab = 'invoices'; return renderRevenue(); }
      if (act === 'rve-inv-cancel' || act === 'rve-pay-cancel') { root._josRveModal = null; root._josRveInvoiceId = null; return renderRevenue(); }
      if (act === 'rve-inv-save') {
        var draft = readRevenueInvoiceDraft(root);
        if (!draft.customerId) { toast('Pick a customer'); return; }
        if (!draft.total) { toast('Enter an invoice amount'); return; }
        r.invoices.push(draft);
        rvePushActivity('invoice.created', 'Created draft invoice ' + draft.number, { invoiceId: draft.id, customerId: draft.customerId, amount: draft.total });
        root._josRveModal = null;
        toast('Invoice draft created');
        return renderRevenue();
      }
      var inv = invId && r.invoices.find(function (x) { return String(x.id) === String(invId); });
      if ((act === 'rve-inv-send' || act === 'rve-inv-void') && !inv) { toast('Invoice not found'); return; }
      if (act === 'rve-inv-send') {
        if (inv.status !== 'draft') { toast('Only draft invoices can be sent'); return; }
        inv.status = 'sent';
        inv.sentAt = rveTodayIso();
        rvePushActivity('invoice.sent', 'Sent invoice ' + inv.number, { invoiceId: inv.id, customerId: inv.customerId, amount: inv.total, at: inv.sentAt });
        publishRevenueEvent('invoice.sent', { invoiceId: inv.id, customerId: inv.customerId, amount: inv.total, at: inv.sentAt });
        toast('Invoice sent');
        return renderRevenue();
      }
      if (act === 'rve-inv-void') {
        if (inv.status !== 'draft' && inv.status !== 'sent') { toast('Only draft or sent invoices can be voided'); return; }
        inv.status = 'void';
        inv.voidedAt = rveTodayIso();
        rvePushActivity('invoice.voided', 'Voided invoice ' + inv.number, { invoiceId: inv.id, customerId: inv.customerId, amount: inv.total, at: inv.voidedAt });
        publishRevenueEvent('invoice.voided', { invoiceId: inv.id, customerId: inv.customerId, amount: inv.total, at: inv.voidedAt });
        toast('Invoice voided');
        return renderRevenue();
      }
      if (act === 'rve-pay-open' || act === 'rve-dep-open' || act === 'rve-ref-open') {
        root._josRveInvoiceId = invId || null;
        root._josRveModal = act === 'rve-pay-open' ? 'payment' : (act === 'rve-dep-open' ? 'deposit' : 'refund');
        root._josRveTab = act === 'rve-pay-open' ? 'payments' : (act === 'rve-dep-open' ? 'deposits' : 'refunds');
        return renderRevenue();
      }
      if (act === 'rve-pay-save') {
        var pay = readRevenueLedgerDraft();
        var payInv = rveInvoiceById(pay.invoiceId);
        if (!payInv || !pay.amount) { toast('Pick an invoice and amount'); return; }
        pay.id = rveId('rve_pay');
        r.payments.push(pay);
        var paidAt = pay.at;
        rvePushActivity('payment.received', 'Recorded payment for ' + payInv.number, { paymentId: pay.id, invoiceId: pay.invoiceId, customerId: pay.customerId, amount: pay.amount, at: paidAt });
        publishRevenueEvent('payment.received', { paymentId: pay.id, invoiceId: pay.invoiceId, customerId: pay.customerId, amount: pay.amount, at: paidAt });
        if (rveCollectedAmount(payInv.id) >= (Number(payInv.total) || 0) && payInv.status !== 'paid') {
          payInv.status = 'paid';
          payInv.paidAt = paidAt;
          rvePushActivity('invoice.paid', 'Invoice ' + payInv.number + ' paid in full', { invoiceId: payInv.id, customerId: payInv.customerId, amount: payInv.total, at: paidAt });
          publishRevenueEvent('invoice.paid', { invoiceId: payInv.id, customerId: payInv.customerId, amount: payInv.total, at: paidAt });
        }
        root._josRveModal = null;
        toast('Payment recorded');
        return renderRevenue();
      }
      if (act === 'rve-dep-save') {
        var dep = readRevenueLedgerDraft();
        var depInv = rveInvoiceById(dep.invoiceId);
        if (!depInv || !dep.amount) { toast('Pick an invoice and amount'); return; }
        dep.id = rveId('rve_dep');
        r.deposits.push(dep);
        if (depInv.status !== 'paid' && depInv.status !== 'refunded' && depInv.status !== 'void') depInv.status = 'deposit_paid';
        rvePushActivity('deposit.paid', 'Recorded deposit for ' + depInv.number, { depositId: dep.id, invoiceId: dep.invoiceId, customerId: dep.customerId, amount: dep.amount, at: dep.at });
        publishRevenueEvent('deposit.paid', { depositId: dep.id, invoiceId: dep.invoiceId, customerId: dep.customerId, amount: dep.amount, at: dep.at });
        root._josRveModal = null;
        toast('Deposit recorded');
        return renderRevenue();
      }
      if (act === 'rve-ref-save') {
        var ref = readRevenueLedgerDraft();
        var refInv = rveInvoiceById(ref.invoiceId);
        if (!refInv || !ref.amount) { toast('Pick an invoice and amount'); return; }
        var refundable = Math.max(0, rveCollectedAmount(refInv.id) - rveRefundAmount(refInv.id));
        if (ref.amount > refundable) { toast('Refund exceeds collected balance'); return; }
        ref.id = rveId('rve_ref');
        r.refunds.push(ref);
        var totalRefunded = rveRefundAmount(refInv.id);
        var totalCollected = rveCollectedAmount(refInv.id);
        refInv.status = totalRefunded >= Math.min(totalCollected, Number(refInv.total) || totalCollected) ? 'refunded' : 'partially_refunded';
        rvePushActivity('refund.issued', 'Issued refund for ' + refInv.number, { refundId: ref.id, invoiceId: ref.invoiceId, customerId: ref.customerId, amount: ref.amount, at: ref.at });
        publishRevenueEvent('refund.issued', { refundId: ref.id, invoiceId: ref.invoiceId, customerId: ref.customerId, amount: ref.amount, at: ref.at });
        root._josRveModal = null;
        toast('Refund issued');
        return renderRevenue();
      }
      if (act === 'rve-payout-open') { root._josRveModal = 'payout'; root._josRveTab = 'payouts'; return renderRevenue(); }
      if (act === 'rve-payout-save') {
        var payout = normalizeRevenuePayout({ amount: (el('jos-rve-payout-amount') || {}).value, destinationLabel: (el('jos-rve-payout-dest') || {}).value || 'Operating account', status: 'completed', at: rveTodayIso() });
        if (!payout.amount) { toast('Enter payout amount'); return; }
        r.payouts.push(payout);
        rvePushActivity('payout.completed', 'Recorded completed payout', { payoutId: payout.id, amount: payout.amount, at: payout.at });
        publishRevenueEvent('payout.completed', { payoutId: payout.id, amount: payout.amount, at: payout.at });
        root._josRveModal = null;
        toast('Payout recorded');
        return renderRevenue();
      }
      if (act === 'rve-open-customer') {
        var cid = t && (t.getAttribute('data-jos-rve-cust') || (inv && inv.customerId));
        if (cid) return openCustomerProfile(cid, 'Payments');
        return toast('No customer linked');
      }
      if (act === 'rve-go-jobs') return switchNav('jobs');
      if (act === 'rve-go-mem') return switchNav('memberships');
      if (act === 'rve-stripe') return toast('Stripe is Stage 2 · not connected');
    } catch (err) {
      console.warn('HublyJourneyOS rve act', act, err);
      toast('Failed — try again');
    }
  }

  var RPT_TABS = [
    ['overview', 'Overview'],
    ['dashboards', 'Dashboards'],
    ['definitions', 'Definitions'],
    ['layouts', 'Layouts'],
    ['scheduled', 'Scheduled'],
    ['forecasts', 'Forecasts'],
    ['sources', 'Sources']
  ];
  var RPT_SOURCES = [
    { key: 'revenue', name: 'Revenue', owner: 'S.revenueOs', reads: 'Collected, outstanding, invoice/payment totals', act: 'rpt-go-money' },
    { key: 'memberships', name: 'Memberships', owner: 'S.membershipsOs', reads: 'Plans, active subscribers, projected MRR', act: 'rpt-go-mem' },
    { key: 'pipeline', name: 'Pipeline', owner: 'Pipeline OS', reads: 'Stage counts and open opportunities', act: 'rpt-go-pipeline' },
    { key: 'customers', name: 'Customers', owner: 'S.customers', reads: 'Customer counts and repeat rate', act: 'rpt-go-customers' },
    { key: 'leads', name: 'Leads', owner: 'collectLeads()', reads: 'Lead volume and source mix', act: 'rpt-go-leads' },
    { key: 'jobs', name: 'Jobs', owner: 'S.jobs', reads: 'Completed/scheduled job aggregates', act: 'rpt-go-jobs' },
    { key: 'marketing', name: 'Marketing', owner: 'S.marketingOs', reads: 'Campaign, template, automation counts', act: 'rpt-go-marketing' },
    { key: 'reviews', name: 'Reviews', owner: 'S.reviewsOs', reads: 'Rating, review counts, requests', act: 'rpt-go-reviews' }
  ];
  function rptId(prefix) { return (prefix || 'rpt') + '_' + Math.random().toString(36).slice(2, 9); }
  function rptTodayIso() { return new Date().toISOString(); }
  function rptRound(n) { n = Number(n) || 0; return Math.round(n * 100) / 100; }
  function rptNum(v) { var n = Number(v); return Number.isFinite(n) ? n : 0; }
  function rptSourceLabel(key) {
    var src = RPT_SOURCES.find(function (s) { return s.key === key || s.name.toLowerCase() === String(key || '').toLowerCase(); });
    return src ? src.name : (key || 'Source');
  }
  function ensureReportsOsState() {
    var st = S();
    if (!st.reportsOs || typeof st.reportsOs !== 'object') st.reportsOs = {};
    var r = st.reportsOs;
    ['payments', 'invoices', 'customers', 'jobs', 'leads', 'campaigns', 'reviews', 'memberships', 'subscribers'].forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(r, key)) delete r[key];
    });
    if (!Array.isArray(r.dashboards)) r.dashboards = [];
    if (!Array.isArray(r.definitions)) r.definitions = [];
    if (!Array.isArray(r.layouts)) r.layouts = [];
    if (!Array.isArray(r.schedules)) r.schedules = [];
    if (!Array.isArray(r.forecasts)) r.forecasts = [];
    if (!Array.isArray(r.activity)) r.activity = [];
    if (!r._seeded) {
      var now = rptTodayIso();
      r.layouts.push({ id: 'rpt_layout_exec', name: 'Executive overview', columns: 4, theme: 'light' });
      r.layouts.push({ id: 'rpt_layout_ops', name: 'Operations board', columns: 3, theme: 'light' });
      r.definitions.push({
        id: 'rpt_def_operating_snapshot',
        name: 'Operating snapshot',
        sourceModules: ['Revenue', 'Jobs', 'Customers', 'Leads', 'Reviews'],
        metrics: ['revenue_collected', 'jobs_completed', 'average_ticket', 'customers_total', 'review_rating'],
        filters: { period: 'current_month' }
      });
      r.definitions.push({
        id: 'rpt_def_retention_growth',
        name: 'Retention and growth',
        sourceModules: ['Memberships', 'Pipeline', 'Marketing', 'Reviews'],
        metrics: ['active_members', 'projected_mrr', 'open_leads', 'active_campaigns', 'review_count'],
        filters: { period: 'rolling_30' }
      });
      r.dashboards.push({
        id: 'rpt_dash_owner',
        name: 'Owner dashboard',
        layoutId: 'rpt_layout_exec',
        widgets: [
          { metricKey: 'revenue_collected', sourceModule: 'Revenue' },
          { metricKey: 'jobs_completed', sourceModule: 'Jobs' },
          { metricKey: 'active_members', sourceModule: 'Memberships' },
          { metricKey: 'review_rating', sourceModule: 'Reviews' }
        ],
        createdAt: now
      });
      r.dashboards.push({
        id: 'rpt_dash_growth',
        name: 'Growth watch',
        layoutId: 'rpt_layout_ops',
        widgets: [
          { metricKey: 'open_leads', sourceModule: 'Leads' },
          { metricKey: 'pipeline_open', sourceModule: 'Pipeline' },
          { metricKey: 'active_campaigns', sourceModule: 'Marketing' },
          { metricKey: 'customers_total', sourceModule: 'Customers' }
        ],
        createdAt: now
      });
      r.schedules.push({ id: 'rpt_sched_weekly_owner', definitionId: 'rpt_def_operating_snapshot', cadence: 'weekly', channel: 'os', nextRunAt: todayStr(), status: 'active' });
      r.forecasts.push({ id: 'rpt_fcst_revenue_30', name: '30-day collected revenue', model: 'linear_os', sourceMetric: 'revenue_collected', horizonDays: 30, lastRunAt: null, projection: null });
      r.activity.push({ id: rptId('rpt_act'), type: 'system', label: 'Reports OS initialized with dashboard/report configuration only', at: now, payload: { metricKeys: ['revenue_collected', 'jobs_completed', 'active_members', 'review_rating'] } });
      r._seeded = true;
    }
    r.dashboards = r.dashboards.map(function (d, idx) {
      d.id = d.id || rptId('rpt_dash');
      d.name = d.name || ('Dashboard ' + (idx + 1));
      d.layoutId = d.layoutId || (r.layouts[0] && r.layouts[0].id) || '';
      if (!Array.isArray(d.widgets)) d.widgets = [];
      d.widgets = d.widgets.map(function (w) { return { metricKey: w.metricKey || 'revenue_collected', sourceModule: w.sourceModule || 'Revenue' }; });
      d.createdAt = d.createdAt || rptTodayIso();
      return d;
    });
    r.definitions = r.definitions.map(function (d, idx) {
      d.id = d.id || rptId('rpt_def');
      d.name = d.name || ('Report definition ' + (idx + 1));
      if (!Array.isArray(d.sourceModules)) d.sourceModules = [];
      if (!Array.isArray(d.metrics)) d.metrics = [];
      if (!d.filters || typeof d.filters !== 'object') d.filters = {};
      return d;
    });
    r.layouts = r.layouts.map(function (l, idx) {
      l.id = l.id || rptId('rpt_layout');
      l.name = l.name || ('Layout ' + (idx + 1));
      l.columns = Math.max(1, Math.min(6, Number(l.columns) || 3));
      l.theme = l.theme || 'light';
      return l;
    });
    r.schedules = r.schedules.map(function (s) {
      s.id = s.id || rptId('rpt_sched');
      s.definitionId = s.definitionId || (r.definitions[0] && r.definitions[0].id) || '';
      s.cadence = s.cadence || 'weekly';
      s.channel = 'os';
      s.nextRunAt = s.nextRunAt || todayStr();
      s.status = s.status || 'active';
      return s;
    });
    r.forecasts = r.forecasts.map(function (f, idx) {
      f.id = f.id || rptId('rpt_fcst');
      f.name = f.name || ('Forecast ' + (idx + 1));
      f.model = 'linear_os';
      f.sourceMetric = f.sourceMetric || 'revenue_collected';
      f.horizonDays = Math.max(1, Number(f.horizonDays) || 30);
      if (f.lastRunAt == null) f.lastRunAt = null;
      if (f.projection == null) f.projection = null;
      else f.projection = rptRound(f.projection);
      return f;
    });
    return r;
  }
  function rptPushActivity(type, label, payload) {
    var r = ensureReportsOsState();
    r.activity.push({ id: rptId('rpt_act'), type: type, label: label, at: rptTodayIso(), payload: payload ? Object.assign({}, payload) : {} });
  }
  function publishReportGenerated(metricKeys) {
    var ev = hublyEvents();
    if (ev && typeof ev.publish === 'function') ev.publish('report.generated', { metricKeys: metricKeys || [], at: rptTodayIso() });
  }
  function rptRevenueSummary() {
    var st = S();
    var r = st.revenueOs && typeof st.revenueOs === 'object' ? st.revenueOs : null;
    if (r) {
      var pays = Array.isArray(r.payments) ? r.payments : [];
      var deps = Array.isArray(r.deposits) ? r.deposits : [];
      var refs = Array.isArray(r.refunds) ? r.refunds : [];
      var invs = Array.isArray(r.invoices) ? r.invoices : [];
      var collected = pays.reduce(function (s, p) { return s + rptNum(p.amount); }, 0) + deps.reduce(function (s, p) { return s + rptNum(p.amount); }, 0) - refs.reduce(function (s, p) { return s + rptNum(p.amount); }, 0);
      if (!collected && invs.length) {
        collected = invs.filter(function (inv) { return ['paid', 'partially_refunded', 'refunded'].indexOf(inv.status) >= 0; }).reduce(function (s, inv) { return s + rptNum(inv.total); }, 0) - refs.reduce(function (s, p) { return s + rptNum(p.amount); }, 0);
      }
      var byInvoice = {};
      pays.concat(deps).forEach(function (row) { if (row.invoiceId) byInvoice[row.invoiceId] = (byInvoice[row.invoiceId] || 0) + rptNum(row.amount); });
      var outstanding = invs.filter(function (inv) { return ['draft', 'sent', 'deposit_paid'].indexOf(inv.status) >= 0; }).reduce(function (s, inv) {
        return s + Math.max(0, rptNum(inv.total) - (byInvoice[inv.id] || 0));
      }, 0);
      return { total: rptRound(collected), outstanding: rptRound(outstanding), source: 'Revenue OS', usedRevenueOs: true };
    }
    var completed = jobs().filter(function (j) { return j.status === 'completed' && !j.isBlock; });
    return { total: rptRound(completed.reduce(function (s, j) { return s + rptNum(j.amount); }, 0)), outstanding: 0, source: 'Jobs display fallback', usedRevenueOs: false };
  }
  function rptMembershipSummary() {
    var m = S().membershipsOs && typeof S().membershipsOs === 'object' ? S().membershipsOs : null;
    if (m) {
      var plans = Array.isArray(m.plans) ? m.plans : [];
      var subs = Array.isArray(m.subscribers) ? m.subscribers : [];
      var active = subs.filter(function (s) { return s.status !== 'cancelled' && s.status !== 'paused'; });
      var mrr = active.reduce(function (sum, s) {
        var plan = plans.find(function (p) { return String(p.id) === String(s.planId); });
        return sum + (plan ? rptNum(plan.price) : 0);
      }, 0);
      return { active: active.length, paused: subs.filter(function (s) { return s.status === 'paused'; }).length, mrr: rptRound(mrr), source: 'Memberships OS' };
    }
    var recurring = customers().filter(function (c) { return c.customerType === 'recurring' || c.membership; }).length;
    return { active: recurring, paused: 0, mrr: 0, source: 'Customers display fallback' };
  }
  function rptMarketingSummary() {
    var m = S().marketingOs && typeof S().marketingOs === 'object' ? S().marketingOs : {};
    var campaigns = Array.isArray(m.campaigns) ? m.campaigns : [];
    var templates = Array.isArray(m.templates) ? m.templates : [];
    var autos = Array.isArray(m.automations) ? m.automations : [];
    return {
      activeCampaigns: campaigns.filter(function (c) { return c.status === 'active' || c.status === 'scheduled'; }).length,
      campaigns: campaigns.length,
      templates: templates.length,
      automations: autos.filter(function (a) { return a.on || (m.toggles && m.toggles[a.id]); }).length,
      source: 'Marketing OS'
    };
  }
  function rptReviewsSummary() {
    var r = S().reviewsOs && typeof S().reviewsOs === 'object' ? S().reviewsOs : null;
    var list = r && Array.isArray(r.reviews) ? r.reviews : ((S().website && Array.isArray(S().website.manualReviews)) ? S().website.manualReviews : (Array.isArray(S().manualReviews) ? S().manualReviews : []));
    var count = list.length;
    var rating = count ? rptRound(list.reduce(function (s, rv) { return s + rptNum(rv.rating || 5); }, 0) / count) : 0;
    var requests = r && Array.isArray(r.requests) ? r.requests : [];
    return { rating: rating, count: count, pendingRequests: requests.filter(function (req) { return req.status === 'pending'; }).length, source: r ? 'Reviews OS' : 'Manual reviews display fallback' };
  }
  function rptPipelineSummary() {
    var st = S();
    var collected = collectLeads();
    var manual = st.pipeline && Array.isArray(st.pipeline.manual) ? st.pipeline.manual.filter(function (l) { return l && !l.deleted; }) : [];
    var seen = {};
    var open = collected.concat(manual).filter(function (l) {
      var id = String(l.key || l.id || l.name || Math.random());
      if (seen[id]) return false;
      seen[id] = true;
      return true;
    });
    var cardsByStage = {};
    if (st.pipeline && st.pipeline.stages) Object.keys(st.pipeline.stages).forEach(function (key) { var stage = st.pipeline.stages[key]; cardsByStage[stage] = (cardsByStage[stage] || 0) + 1; });
    return { openLeads: open.length, stageCounts: cardsByStage, source: 'Leads/Pipeline owners' };
  }
  function rptJobSummary() {
    var all = jobs().filter(function (j) { return j && !j.isBlock; });
    var completed = all.filter(function (j) { return j.status === 'completed'; });
    var booked = all.filter(function (j) { return jobActive(j) && j.status !== 'completed' && j.status !== 'cancelled'; });
    return { total: all.length, completed: completed.length, booked: booked.length, source: 'Jobs' };
  }
  function rptCustomerSummary() {
    var custs = customers();
    var repeat = custs.filter(function (c) { return custJobsFor(c).filter(function (j) { return j.status === 'completed'; }).length >= 2; }).length;
    return { total: custs.length, repeat: repeat, repeatPct: custs.length ? Math.round((repeat / custs.length) * 100) : 0, source: 'Customers/Jobs' };
  }
  function rptAggregates() {
    var revenue = rptRevenueSummary();
    var jobsAgg = rptJobSummary();
    var members = rptMembershipSummary();
    var pipe = rptPipelineSummary();
    var custs = rptCustomerSummary();
    var mkt = rptMarketingSummary();
    var revs = rptReviewsSummary();
    var avg = jobsAgg.completed ? revenue.total / jobsAgg.completed : 0;
    return { revenue: revenue, jobs: jobsAgg, members: members, pipeline: pipe, customers: custs, marketing: mkt, reviews: revs, avgTicket: rptRound(avg) };
  }
  function rptMetricValue(metricKey, ag) {
    ag = ag || rptAggregates();
    var map = {
      revenue_collected: { label: 'Collected revenue', value: money(ag.revenue.total) || '$0', raw: ag.revenue.total, sourceModule: 'Revenue', sub: ag.revenue.source },
      revenue_outstanding: { label: 'Outstanding', value: money(ag.revenue.outstanding) || '$0', raw: ag.revenue.outstanding, sourceModule: 'Revenue', sub: 'Open invoice balance' },
      jobs_completed: { label: 'Jobs completed', value: String(ag.jobs.completed), raw: ag.jobs.completed, sourceModule: 'Jobs', sub: ag.jobs.booked + ' booked ahead' },
      average_ticket: { label: 'Average ticket', value: money(ag.avgTicket) || '$0', raw: ag.avgTicket, sourceModule: 'Revenue', sub: 'Collected / completed jobs' },
      active_members: { label: 'Active members', value: String(ag.members.active), raw: ag.members.active, sourceModule: 'Memberships', sub: ag.members.source },
      projected_mrr: { label: 'Projected MRR', value: money(ag.members.mrr) || '$0', raw: ag.members.mrr, sourceModule: 'Memberships', sub: 'Plans x active subscribers' },
      open_leads: { label: 'Open leads', value: String(ag.pipeline.openLeads), raw: ag.pipeline.openLeads, sourceModule: 'Leads', sub: 'Lead owner feed' },
      pipeline_open: { label: 'Pipeline cards', value: String(Object.keys(ag.pipeline.stageCounts).reduce(function (s, k) { return s + ag.pipeline.stageCounts[k]; }, 0)), raw: Object.keys(ag.pipeline.stageCounts).reduce(function (s, k) { return s + ag.pipeline.stageCounts[k]; }, 0), sourceModule: 'Pipeline', sub: 'Stage assignments only' },
      customers_total: { label: 'Customers', value: String(ag.customers.total), raw: ag.customers.total, sourceModule: 'Customers', sub: ag.customers.repeatPct + '% repeat' },
      review_rating: { label: 'Review rating', value: ag.reviews.rating ? ag.reviews.rating.toFixed(1) : '-', raw: ag.reviews.rating, sourceModule: 'Reviews', sub: ag.reviews.count + ' reviews' },
      review_count: { label: 'Reviews', value: String(ag.reviews.count), raw: ag.reviews.count, sourceModule: 'Reviews', sub: ag.reviews.pendingRequests + ' pending requests' },
      active_campaigns: { label: 'Active campaigns', value: String(ag.marketing.activeCampaigns), raw: ag.marketing.activeCampaigns, sourceModule: 'Marketing', sub: ag.marketing.campaigns + ' total campaigns' }
    };
    return map[metricKey] || { label: metricKey, value: '-', raw: 0, sourceModule: 'Reports', sub: 'Unknown metric key' };
  }
  function rptMetricOptions(selected) {
    var keys = ['revenue_collected', 'revenue_outstanding', 'jobs_completed', 'average_ticket', 'active_members', 'projected_mrr', 'open_leads', 'pipeline_open', 'customers_total', 'review_rating', 'review_count', 'active_campaigns'];
    return keys.map(function (key) { var m = rptMetricValue(key); return '<option value="' + esc(key) + '"' + (String(selected) === key ? ' selected' : '') + '>' + esc(m.label + ' - ' + m.sourceModule) + '</option>'; }).join('');
  }
  function rptLayoutOptions(selectedId) {
    return ensureReportsOsState().layouts.map(function (l) {
      return '<option value="' + esc(l.id) + '"' + (String(selectedId) === String(l.id) ? ' selected' : '') + '>' + esc(l.name + ' (' + l.columns + ' cols)') + '</option>';
    }).join('');
  }
  function rptDefinitionOptions(selectedId) {
    return ensureReportsOsState().definitions.map(function (d) {
      return '<option value="' + esc(d.id) + '"' + (String(selectedId) === String(d.id) ? ' selected' : '') + '>' + esc(d.name) + '</option>';
    }).join('');
  }
  function rptStatusBadge(label, tone) {
    return DS() ? DS().statusBadge(label, tone || 'info') : '<span class="jos-pill ' + esc(tone || 'info') + '">' + esc(label) + '</span>';
  }
  function renderReportsKpis() {
    var d = DS(), ag = rptAggregates();
    if (d) {
      return '<div class="jos-rpt-kpis">' +
        d.metricCard('Collected revenue', money(ag.revenue.total) || '$0', ag.revenue.source) +
        d.metricCard('Jobs completed', String(ag.jobs.completed), ag.jobs.booked + ' booked ahead') +
        d.metricCard('Active members', String(ag.members.active), ag.members.source) +
        d.metricCard('Review rating', ag.reviews.rating ? ag.reviews.rating.toFixed(1) : '-', ag.reviews.count + ' reviews') +
        '</div>';
    }
    return '<div class="jos-kpi-row"><div class="jos-kpi"><div class="jos-kpi-lbl">Collected revenue</div><div class="jos-kpi-v brand">' + esc(money(ag.revenue.total) || '$0') + '</div></div><div class="jos-kpi"><div class="jos-kpi-lbl">Jobs completed</div><div class="jos-kpi-v">' + ag.jobs.completed + '</div></div><div class="jos-kpi"><div class="jos-kpi-lbl">Active members</div><div class="jos-kpi-v">' + ag.members.active + '</div></div><div class="jos-kpi"><div class="jos-kpi-lbl">Review rating</div><div class="jos-kpi-v">' + (ag.reviews.rating || '-') + '</div></div></div>';
  }
  function rptTopServicesHtml() {
    var completed = jobs().filter(function (j) { return j.status === 'completed' && !j.isBlock; });
    var map = {};
    completed.forEach(function (j) { var k = j.service || 'Other'; map[k] = (map[k] || 0) + rptNum(j.amount); });
    var rows = Object.keys(map).map(function (k) { return [k, map[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);
    var max = Math.max.apply(null, rows.map(function (x) { return x[1]; }).concat([1]));
    return rows.length ? rows.map(function (row) {
      return '<div class="jos-rpt-bar-row"><div class="jos-between"><span>' + esc(row[0]) + '</span><strong>' + esc(money(row[1]) || '$0') + '</strong></div><div class="jos-rpt-bar"><i style="width:' + Math.round((row[1] / max) * 100) + '%"></i></div></div>';
    }).join('') : (DS() ? DS().emptyState('No completed jobs', 'Complete jobs to populate service mix.') : '<div class="jos-empty">No completed jobs yet.</div>');
  }
  function renderReportsOverviewTab(root) {
    var r = ensureReportsOsState(), d = DS(), ag = rptAggregates();
    var widgets = (r.dashboards[0] && r.dashboards[0].widgets || []).map(function (w) {
      var m = rptMetricValue(w.metricKey, ag);
      return '<div class="jos-rpt-widget"><div class="jos-kicker">' + esc(m.sourceModule) + '</div><strong>' + esc(m.value) + '</strong><span>' + esc(m.label) + '</span></div>';
    }).join('');
    var ai = d ? d.aiInsightCard({
      kicker: 'AI - Reports OS',
      body: 'Reports is reading live aggregate metrics from owner modules. It stores dashboard, definition, layout, schedule, forecast config, and activity only.',
      actionsHtml: dsBtn('rpt-refresh', 'Refresh aggregates', 'jos-btn-brand jos-btn-sm') + dsBtn('rpt-go-money', 'Open Revenue', 'jos-btn jos-btn-sm')
    }) : '';
    return renderReportsKpis() + (ai ? '<div class="jos-mt">' + ai + '</div>' : '') +
      '<div class="jos-rpt-2col jos-mt"><div class="jos-card"><div class="jos-kicker">Owner dashboard widgets</div><div class="jos-rpt-widget-grid jos-mt">' + widgets + '</div></div>' +
      '<div class="jos-card"><div class="jos-kicker">Rule #21 guardrail</div><div class="jos-rpt-rule"><strong>Config only</strong><span>S.reportsOs owns dashboards, definitions, layouts, schedules, forecasts, and activity. Operational rows stay in Revenue, Memberships, Jobs, Customers, Leads, Marketing, and Reviews.</span></div></div></div>' +
      '<div class="jos-rpt-2col jos-mt"><div class="jos-card"><div class="jos-kicker">Top services by job amount</div><div class="jos-stack jos-mt">' + rptTopServicesHtml() + '</div><p class="jos-muted jos-mt">Display aggregate only; Revenue remains financial source of truth when present.</p></div>' +
      '<div class="jos-card"><div class="jos-kicker">Growth inputs</div><div class="jos-stack jos-mt">' +
        '<div class="jos-rpt-act"><div><strong>Open leads</strong><div class="jos-muted">Leads owner feed</div></div><strong>' + ag.pipeline.openLeads + '</strong></div>' +
        '<div class="jos-rpt-act"><div><strong>Repeat customers</strong><div class="jos-muted">Customers + Jobs read-time</div></div><strong>' + ag.customers.repeatPct + '%</strong></div>' +
        '<div class="jos-rpt-act"><div><strong>Active campaigns</strong><div class="jos-muted">Marketing OS</div></div><strong>' + ag.marketing.activeCampaigns + '</strong></div>' +
      '</div></div></div>';
  }
  function renderRptDashModal(root) {
    if (root._josRptModal !== 'dash') return '';
    return '<div class="jos-rpt-modal"><div class="jos-rpt-modal-panel"><h3>Create dashboard</h3><p class="jos-muted">Stores widget metric keys and source module labels only.</p>' +
      '<div class="jos-rpt-form"><label>Name<input id="jos-rpt-dash-name" type="text" placeholder="Weekly owner dashboard"></label>' +
      '<label>Layout<select id="jos-rpt-dash-layout">' + rptLayoutOptions('') + '</select></label>' +
      '<label class="jos-rpt-span2">Widgets<select id="jos-rpt-dash-widgets" multiple>' + rptMetricOptions('') + '</select><span class="jos-muted">Pick metrics. No operational rows are copied.</span></label></div>' +
      '<div class="jos-btn-row jos-mt">' + dsBtn('rpt-dash-save', 'Save dashboard', 'jos-btn-brand jos-btn-sm') + dsBtn('rpt-dash-cancel', 'Cancel', 'jos-btn jos-btn-sm') + '</div></div></div>';
  }
  function renderReportsDashboardsTab(root) {
    var r = ensureReportsOsState(), d = DS(), ag = rptAggregates();
    var cards = r.dashboards.map(function (dash) {
      var layout = r.layouts.find(function (l) { return String(l.id) === String(dash.layoutId); });
      var widgets = (dash.widgets || []).map(function (w) {
        var m = rptMetricValue(w.metricKey, ag);
        return '<div class="jos-rpt-chip"><strong>' + esc(m.value) + '</strong><span>' + esc(m.label) + ' - ' + esc(rptSourceLabel(w.sourceModule)) + '</span></div>';
      }).join('');
      return '<div class="jos-rpt-card"><div class="jos-rpt-card-h"><div><strong>' + esc(dash.name) + '</strong><div class="jos-muted">' + esc((layout && layout.name) || 'Layout') + ' - ' + esc(String((dash.widgets || []).length)) + ' widgets</div></div>' + rptStatusBadge('OS config', 'info') + '</div><div class="jos-rpt-chip-grid">' + widgets + '</div><div class="jos-rpt-card-foot">' + dsBtn('rpt-dash-open', 'New dashboard', 'jos-btn jos-btn-sm') + '</div></div>';
    }).join('');
    return (d ? d.sectionHeader('Dashboards', 'Saved widget layouts with metric keys only.', dsBtn('rpt-dash-open', '+ Dashboard', 'jos-btn-brand jos-btn-sm')) : '') +
      '<div class="jos-rpt-grid jos-mt">' + (cards || (d ? d.emptyState('No dashboards', 'Create a dashboard to group metric widgets.') : '')) + '</div>' + renderRptDashModal(root);
  }
  function renderRptDefModal(root) {
    if (root._josRptModal !== 'def') return '';
    return '<div class="jos-rpt-modal"><div class="jos-rpt-modal-panel"><h3>Create report definition</h3><p class="jos-muted">Definitions save metric keys, source module labels, and filters only.</p>' +
      '<div class="jos-rpt-form"><label>Name<input id="jos-rpt-def-name" type="text" placeholder="Monthly performance"></label>' +
      '<label>Period filter<select id="jos-rpt-def-period"><option value="current_month">Current month</option><option value="rolling_30">Rolling 30 days</option><option value="all_time">All time</option></select></label>' +
      '<label class="jos-rpt-span2">Metrics<select id="jos-rpt-def-metrics" multiple>' + rptMetricOptions('') + '</select></label>' +
      '<label class="jos-rpt-span2">Source modules<input id="jos-rpt-def-sources" type="text" placeholder="Revenue, Jobs, Customers"></label></div>' +
      '<div class="jos-btn-row jos-mt">' + dsBtn('rpt-def-save', 'Save definition', 'jos-btn-brand jos-btn-sm') + dsBtn('rpt-def-cancel', 'Cancel', 'jos-btn jos-btn-sm') + '</div></div></div>';
  }
  function renderReportsDefinitionsTab(root) {
    var r = ensureReportsOsState(), d = DS();
    var rows = r.definitions.map(function (def) {
      return '<div class="jos-rpt-card"><div class="jos-rpt-card-h"><div><strong>' + esc(def.name) + '</strong><div class="jos-muted">' + esc((def.sourceModules || []).join(', ') || 'No sources') + '</div></div>' + rptStatusBadge(String((def.metrics || []).length) + ' metrics', 'info') + '</div>' +
        '<div class="jos-rpt-code">' + esc((def.metrics || []).join(', ') || 'No metrics') + '</div><div class="jos-muted">Filters: ' + esc(JSON.stringify(def.filters || {})) + '</div></div>';
    }).join('');
    return (d ? d.sectionHeader('Definitions', 'Reusable saved report definitions. Sources are references by module name only.', dsBtn('rpt-def-open', '+ Definition', 'jos-btn-brand jos-btn-sm')) : '') +
      '<div class="jos-rpt-grid jos-mt">' + (rows || (d ? d.emptyState('No definitions', 'Create a report definition.') : '')) + '</div>' + renderRptDefModal(root);
  }
  function renderRptLayoutModal(root) {
    if (root._josRptModal !== 'layout') return '';
    return '<div class="jos-rpt-modal"><div class="jos-rpt-modal-panel"><h3>Create layout</h3><div class="jos-rpt-form">' +
      '<label>Name<input id="jos-rpt-layout-name" type="text" placeholder="KPI grid"></label>' +
      '<label>Columns<input id="jos-rpt-layout-cols" type="number" min="1" max="6" value="3"></label>' +
      '<label class="jos-rpt-span2">Theme<select id="jos-rpt-layout-theme"><option value="light">Light</option><option value="compact">Compact</option><option value="board">Board</option></select></label></div>' +
      '<div class="jos-btn-row jos-mt">' + dsBtn('rpt-layout-save', 'Save layout', 'jos-btn-brand jos-btn-sm') + dsBtn('rpt-layout-cancel', 'Cancel', 'jos-btn jos-btn-sm') + '</div></div></div>';
  }
  function renderReportsLayoutsTab(root) {
    var r = ensureReportsOsState(), d = DS();
    var rows = r.layouts.map(function (layout) {
      var used = r.dashboards.filter(function (dash) { return String(dash.layoutId) === String(layout.id); }).length;
      return '<div class="jos-rpt-card"><div class="jos-rpt-card-h"><div><strong>' + esc(layout.name) + '</strong><div class="jos-muted">' + esc(String(layout.columns)) + ' columns - ' + esc(layout.theme || 'light') + '</div></div>' + rptStatusBadge(used + ' dashboards', 'quote') + '</div><div class="jos-rpt-layout-preview" style="grid-template-columns:repeat(' + esc(String(layout.columns)) + ',1fr)">' + Array.from({ length: Math.min(6, Number(layout.columns) || 3) }).map(function (_, i) { return '<i>' + (i + 1) + '</i>'; }).join('') + '</div></div>';
    }).join('');
    return (d ? d.sectionHeader('Layouts', 'Presentation layouts used by dashboards.', dsBtn('rpt-layout-open', '+ Layout', 'jos-btn-brand jos-btn-sm')) : '') +
      '<div class="jos-rpt-grid jos-mt">' + rows + '</div>' + renderRptLayoutModal(root);
  }
  function renderRptScheduleModal(root) {
    if (root._josRptModal !== 'sched') return '';
    return '<div class="jos-rpt-modal"><div class="jos-rpt-modal-panel"><h3>Schedule report</h3><p class="jos-muted">Stage 1 schedules stay inside Hubly OS.</p>' +
      '<div class="jos-rpt-form"><label>Definition<select id="jos-rpt-sched-def">' + rptDefinitionOptions('') + '</select></label>' +
      '<label>Cadence<select id="jos-rpt-sched-cadence"><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option></select></label>' +
      '<label>Next run<input id="jos-rpt-sched-next" type="date" value="' + esc(todayStr()) + '"></label><label>Status<select id="jos-rpt-sched-status"><option value="active">Active</option><option value="paused">Paused</option></select></label></div>' +
      '<div class="jos-btn-row jos-mt">' + dsBtn('rpt-sched-save', 'Save schedule', 'jos-btn-brand jos-btn-sm') + dsBtn('rpt-sched-cancel', 'Cancel', 'jos-btn jos-btn-sm') + '</div></div></div>';
  }
  function renderReportsScheduledTab(root) {
    var r = ensureReportsOsState(), d = DS();
    var rows = r.schedules.map(function (s) {
      var def = r.definitions.find(function (x) { return String(x.id) === String(s.definitionId); });
      return '<div class="jos-rpt-card"><div class="jos-rpt-card-h"><div><strong>' + esc(def ? def.name : 'Definition') + '</strong><div class="jos-muted">' + esc(s.cadence) + ' - next ' + esc(String(s.nextRunAt || '').slice(0, 10)) + ' - channel ' + esc(s.channel) + '</div></div>' + rptStatusBadge(s.status || 'active', s.status === 'paused' ? 'warn' : 'ok') + '</div></div>';
    }).join('');
    return (d ? d.sectionHeader('Scheduled reports', 'OS-only schedules. Email/Slack delivery is Stage 2.', dsBtn('rpt-sched-open', '+ Schedule', 'jos-btn-brand jos-btn-sm')) : '') +
      '<div class="jos-rpt-grid jos-mt">' + (rows || (d ? d.emptyState('No schedules', 'Schedule a saved definition.') : '')) + '</div>' + renderRptScheduleModal(root);
  }
  function renderRptForecastModal(root) {
    if (root._josRptModal !== 'forecast') return '';
    return '<div class="jos-rpt-modal"><div class="jos-rpt-modal-panel"><h3>Create forecast</h3><p class="jos-muted">Stores model config and latest projection only.</p>' +
      '<div class="jos-rpt-form"><label>Name<input id="jos-rpt-fcst-name" type="text" placeholder="60-day revenue projection"></label>' +
      '<label>Source metric<select id="jos-rpt-fcst-metric">' + rptMetricOptions('revenue_collected') + '</select></label>' +
      '<label>Horizon days<input id="jos-rpt-fcst-days" type="number" min="1" max="365" value="30"></label><label>Model<select id="jos-rpt-fcst-model"><option value="linear_os">linear_os</option></select></label></div>' +
      '<div class="jos-btn-row jos-mt">' + dsBtn('rpt-forecast-save', 'Save forecast', 'jos-btn-brand jos-btn-sm') + dsBtn('rpt-forecast-cancel', 'Cancel', 'jos-btn jos-btn-sm') + '</div></div></div>';
  }
  function rptForecastProjection(forecast) {
    var metric = rptMetricValue(forecast.sourceMetric);
    var raw = rptNum(metric.raw);
    var multiplier = Math.max(1, Number(forecast.horizonDays) || 30) / 30;
    return rptRound(raw * multiplier);
  }
  function renderReportsForecastsTab(root) {
    var r = ensureReportsOsState(), d = DS();
    var rows = r.forecasts.map(function (f) {
      var metric = rptMetricValue(f.sourceMetric);
      var display = /revenue|mrr|ticket|outstanding/.test(f.sourceMetric) ? (money(f.projection || 0) || '$0') : String(f.projection == null ? '-' : f.projection);
      return '<div class="jos-rpt-card" data-jos-rpt-forecast="' + esc(f.id) + '"><div class="jos-rpt-card-h"><div><strong>' + esc(f.name) + '</strong><div class="jos-muted">' + esc(f.model) + ' - ' + esc(metric.label) + ' - ' + esc(String(f.horizonDays)) + ' days</div></div>' + rptStatusBadge(f.lastRunAt ? 'Run' : 'Not run', f.lastRunAt ? 'ok' : 'warn') + '</div><div class="jos-rpt-forecast-value">' + esc(display) + '</div><div class="jos-muted">Last run: ' + esc(f.lastRunAt ? String(f.lastRunAt).replace('T', ' ').slice(0, 19) : 'Never') + '</div><div class="jos-rpt-card-foot">' + dsBtn('rpt-forecast-run', 'Run forecast', 'jos-btn-brand jos-btn-sm') + '</div></div>';
    }).join('');
    return (d ? d.sectionHeader('Forecasts', 'Linear OS forecasts read a metric key and store model output only.', dsBtn('rpt-forecast-open', '+ Forecast', 'jos-btn-brand jos-btn-sm')) : '') +
      '<div class="jos-rpt-grid jos-mt">' + rows + '</div>' + renderRptForecastModal(root);
  }
  function renderReportsSourcesTab() {
    var ag = rptAggregates(), d = DS();
    var counts = {
      revenue: ag.revenue.usedRevenueOs ? (money(ag.revenue.total) || '$0') : 'fallback ' + (money(ag.revenue.total) || '$0'),
      memberships: ag.members.active + ' active',
      pipeline: Object.keys(ag.pipeline.stageCounts).length + ' stages',
      customers: ag.customers.total + ' customers',
      leads: ag.pipeline.openLeads + ' leads',
      jobs: ag.jobs.completed + ' completed',
      marketing: ag.marketing.activeCampaigns + ' active',
      reviews: ag.reviews.count + ' reviews'
    };
    var rows = RPT_SOURCES.map(function (src) {
      return '<tr><td><strong>' + esc(src.name) + '</strong></td><td>' + esc(src.owner) + '</td><td>' + esc(src.reads) + '</td><td>' + esc(counts[src.key] || '-') + '</td><td>' + dsBtn(src.act, 'Open', 'jos-btn jos-btn-sm') + '</td></tr>';
    }).join('');
    return (d ? d.sectionHeader('Owner sources', 'Reports reads aggregates from owners and deep-links back to the source of truth.', dsBtn('rpt-refresh', 'Refresh aggregates', 'jos-btn-brand jos-btn-sm')) : '') +
      '<div class="jos-rpt-table-wrap jos-mt"><table class="jos-rpt-table"><thead><tr><th>Module</th><th>Owner</th><th>Reports reads</th><th>Now</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="jos-rpt-rule jos-mt"><strong>No duplication</strong><span>S.reportsOs never stores customers, payments, jobs, leads, campaigns, reviews, memberships, or subscribers. It stores report configuration and forecast model output only.</span></div>';
  }
  function renderReportsActivityTab() {
    var r = ensureReportsOsState(), d = DS();
    var list = r.activity.slice().reverse().map(function (a) {
      return '<div class="jos-rpt-event"><div class="jos-rpt-event-type">' + esc(a.type || 'activity') + '</div><div class="jos-muted">' + esc(String(a.at || '').replace('T', ' ').slice(0, 19)) + '</div><p>' + esc(a.label || '') + '</p>' + (a.payload ? '<pre class="jos-rpt-event-payload">' + esc(JSON.stringify(a.payload || {}, null, 0)) + '</pre>' : '') + '</div>';
    }).join('');
    return '<div class="jos-card"><div class="jos-kicker">Reports activity</div><div class="jos-rpt-events jos-mt">' + (list || (d ? d.emptyState('No activity yet', 'Report config actions append here.') : '')) + '</div></div>';
  }
  function renderReportsTabBody(root, tab) {
    if (tab === 'overview') return renderReportsOverviewTab(root);
    if (tab === 'dashboards') return renderReportsDashboardsTab(root);
    if (tab === 'definitions') return renderReportsDefinitionsTab(root);
    if (tab === 'layouts') return renderReportsLayoutsTab(root);
    if (tab === 'scheduled') return renderReportsScheduledTab(root);
    if (tab === 'forecasts') return renderReportsForecastsTab(root);
    if (tab === 'sources') return renderReportsSourcesTab() + '<div class="jos-mt">' + renderReportsActivityTab() + '</div>';
    return renderReportsOverviewTab(root);
  }
  function renderReportsPageInner(root) {
    ensureReportsOsState();
    var tab = root._josRptTab || 'overview';
    var d = DS();
    var tabsHtml = '<div class="jos-tabs jos-rpt-tabs">' + RPT_TABS.map(function (t) {
      return '<button type="button" class="jos-tab' + (tab === t[0] ? ' on' : '') + '" data-jos-rpt-tab="' + t[0] + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div>';
    var head = d ? d.pageHeader('Reports', 'Analytics layer for dashboards, definitions, layouts, schedules, and forecasts. Reads owner modules at render time.', dsBtn('rpt-refresh', 'Refresh', 'jos-btn jos-btn-sm') + dsBtn('rpt-dash-open', 'Create dashboard', 'jos-btn-brand jos-btn-sm') + dsBtn('rpt-go-money', 'Revenue', 'jos-btn jos-btn-sm')) :
      '<div class="jos-page-head"><div><h1>Reports</h1><p>Analytics layer and saved report configuration.</p></div></div>';
    root.innerHTML = '<div class="jos-page jos-rpt-page">' + head + tabsHtml + '<div class="jos-rpt-body">' + renderReportsTabBody(root, tab) + '</div></div>';
    bindRoot(root);
    wireReportsRoot(root);
  }
  function renderReportsPage() {
    var root = ownPixelView('v-reports', 'jos-reports-root');
    if (!root) return;
    updateChrome('reports');
    root.innerHTML = '<div class="jos-page jos-rpt-page"><div class="jos-home-loading">Loading Reports...</div></div>';
    try { renderReportsPageInner(root); }
    catch (err) {
      console.warn('HublyJourneyOS Reports', err);
      root.innerHTML = '<div class="jos-page"><div class="jos-empty jos-error-state"><strong>Reports could not load</strong><p class="jos-muted">Refresh and try again.</p><div class="jos-mt"><button type="button" class="jos-btn jos-btn-brand jos-btn-sm" onclick="HublyJourneyOS.renderReportsPage()">Retry</button></div></div></div>';
    }
  }
  var renderReports = renderReportsPage;
  function wireReportsRoot(root) {
    if (root._josRptBound) return;
    root._josRptBound = true;
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root._josRptModal) {
        root._josRptModal = null;
        renderReportsPage();
      }
    });
  }
  function rptSelectedOptions(id) {
    var node = el(id);
    return node ? Array.prototype.slice.call(node.selectedOptions || []).map(function (o) { return o.value; }) : [];
  }
  function rptModulesForMetrics(metrics) {
    var seen = {};
    metrics.forEach(function (key) { var m = rptMetricValue(key); seen[m.sourceModule] = true; });
    return Object.keys(seen);
  }
  function handleReportsAct(act, t) {
    var root = el('jos-reports-root');
    if (!root) return;
    var r = ensureReportsOsState();
    try {
      if (act === 'rpt-dash-open') { root._josRptModal = 'dash'; root._josRptTab = 'dashboards'; return renderReportsPage(); }
      if (act === 'rpt-def-open') { root._josRptModal = 'def'; root._josRptTab = 'definitions'; return renderReportsPage(); }
      if (act === 'rpt-layout-open') { root._josRptModal = 'layout'; root._josRptTab = 'layouts'; return renderReportsPage(); }
      if (act === 'rpt-sched-open') { root._josRptModal = 'sched'; root._josRptTab = 'scheduled'; return renderReportsPage(); }
      if (act === 'rpt-forecast-open') { root._josRptModal = 'forecast'; root._josRptTab = 'forecasts'; return renderReportsPage(); }
      if (/^rpt-(dash|def|layout|sched|forecast)-cancel$/.test(act)) { root._josRptModal = null; return renderReportsPage(); }
      if (act === 'rpt-dash-save') {
        var dashMetrics = rptSelectedOptions('jos-rpt-dash-widgets');
        if (!dashMetrics.length) dashMetrics = ['revenue_collected', 'jobs_completed', 'active_members', 'review_rating'];
        var dash = {
          id: rptId('rpt_dash'),
          name: (el('jos-rpt-dash-name') || {}).value || 'New dashboard',
          layoutId: (el('jos-rpt-dash-layout') || {}).value || (r.layouts[0] && r.layouts[0].id) || '',
          widgets: dashMetrics.map(function (key) { var metric = rptMetricValue(key); return { metricKey: key, sourceModule: metric.sourceModule }; }),
          createdAt: rptTodayIso()
        };
        r.dashboards.push(dash);
        rptPushActivity('dashboard.saved', 'Saved dashboard ' + dash.name, { dashboardId: dash.id, metricKeys: dashMetrics });
        root._josRptModal = null;
        toast('Dashboard saved');
        return renderReportsPage();
      }
      if (act === 'rpt-def-save') {
        var defMetrics = rptSelectedOptions('jos-rpt-def-metrics');
        if (!defMetrics.length) defMetrics = ['revenue_collected', 'jobs_completed'];
        var typedSources = String((el('jos-rpt-def-sources') || {}).value || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
        var def = {
          id: rptId('rpt_def'),
          name: (el('jos-rpt-def-name') || {}).value || 'New report definition',
          sourceModules: typedSources.length ? typedSources : rptModulesForMetrics(defMetrics),
          metrics: defMetrics,
          filters: { period: (el('jos-rpt-def-period') || {}).value || 'current_month' }
        };
        r.definitions.push(def);
        rptPushActivity('definition.saved', 'Saved definition ' + def.name, { definitionId: def.id, metricKeys: def.metrics, sourceModules: def.sourceModules });
        root._josRptModal = null;
        toast('Definition saved');
        return renderReportsPage();
      }
      if (act === 'rpt-layout-save') {
        var layout = { id: rptId('rpt_layout'), name: (el('jos-rpt-layout-name') || {}).value || 'New layout', columns: Math.max(1, Math.min(6, Number((el('jos-rpt-layout-cols') || {}).value) || 3)), theme: (el('jos-rpt-layout-theme') || {}).value || 'light' };
        r.layouts.push(layout);
        rptPushActivity('layout.saved', 'Saved layout ' + layout.name, { layoutId: layout.id, columns: layout.columns, theme: layout.theme });
        root._josRptModal = null;
        toast('Layout saved');
        return renderReportsPage();
      }
      if (act === 'rpt-sched-save') {
        var sched = { id: rptId('rpt_sched'), definitionId: (el('jos-rpt-sched-def') || {}).value || (r.definitions[0] && r.definitions[0].id) || '', cadence: (el('jos-rpt-sched-cadence') || {}).value || 'weekly', channel: 'os', nextRunAt: (el('jos-rpt-sched-next') || {}).value || todayStr(), status: (el('jos-rpt-sched-status') || {}).value || 'active' };
        r.schedules.push(sched);
        rptPushActivity('schedule.saved', 'Saved OS schedule', { scheduleId: sched.id, definitionId: sched.definitionId, cadence: sched.cadence, channel: sched.channel });
        root._josRptModal = null;
        toast('Schedule saved');
        return renderReportsPage();
      }
      if (act === 'rpt-forecast-save') {
        var fc = { id: rptId('rpt_fcst'), name: (el('jos-rpt-fcst-name') || {}).value || 'New forecast', model: 'linear_os', sourceMetric: (el('jos-rpt-fcst-metric') || {}).value || 'revenue_collected', horizonDays: Math.max(1, Number((el('jos-rpt-fcst-days') || {}).value) || 30), lastRunAt: null, projection: null };
        r.forecasts.push(fc);
        rptPushActivity('forecast.saved', 'Saved forecast model ' + fc.name, { forecastId: fc.id, metricKeys: [fc.sourceMetric], model: fc.model, horizonDays: fc.horizonDays });
        root._josRptModal = null;
        toast('Forecast saved');
        return renderReportsPage();
      }
      if (act === 'rpt-forecast-run') {
        var fcstId = t && (t.getAttribute('data-jos-rpt-forecast') || (t.closest('[data-jos-rpt-forecast]') && t.closest('[data-jos-rpt-forecast]').getAttribute('data-jos-rpt-forecast')));
        var forecast = r.forecasts.find(function (f) { return String(f.id) === String(fcstId); }) || r.forecasts[0];
        if (!forecast) { toast('Create a forecast first'); return; }
        forecast.projection = rptForecastProjection(forecast);
        forecast.lastRunAt = rptTodayIso();
        rptPushActivity('forecast.run', 'Ran forecast ' + forecast.name, { forecastId: forecast.id, metricKeys: [forecast.sourceMetric], projection: forecast.projection });
        publishReportGenerated([forecast.sourceMetric]);
        toast('Forecast run complete');
        return renderReportsPage();
      }
      if (act === 'rpt-refresh') {
        publishReportGenerated(['revenue_collected', 'jobs_completed', 'active_members', 'review_rating']);
        rptPushActivity('report.generated', 'Refreshed report aggregates', { metricKeys: ['revenue_collected', 'jobs_completed', 'active_members', 'review_rating'] });
        toast('Report aggregates refreshed');
        return renderReportsPage();
      }
      if (act === 'rpt-go-money') return switchNav('money');
      if (act === 'rpt-go-mem') return switchNav('memberships');
      if (act === 'rpt-go-jobs') return switchNav('jobs');
      if (act === 'rpt-go-leads') return switchNav('leads');
      if (act === 'rpt-go-customers') return switchNav('customers');
      if (act === 'rpt-go-pipeline') return switchNav('pipeline');
      if (act === 'rpt-go-marketing') return switchNav('marketing');
      if (act === 'rpt-go-reviews') return switchNav('reviews');
    } catch (err) {
      console.warn('HublyJourneyOS rpt act', act, err);
      toast('Failed - try again');
    }
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

  function leadStageLbl(lead) {
    try { var st = typeof global.leadStageById === 'function' && global.leadStageById(lead.stage); if (st?.label) return st.label; } catch (e) {}
    var mid = mapLeadStage(lead), pipe = PIPE_STAGES.find(function (s) { return s.id === mid || s.id === lead.stage; });
    return (pipe && pipe.label) || lead.stage || 'New';
  }
  function allLeads() {
    var leads = collectLeads();
    if (!leads.length) {
      leads = demoPipelineCards().filter(function (c) { return /lead|quote|qualified/.test(c.stageId); })
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
  var LEADS_TABS = [
    ['new', 'New Leads'],
    ['quotes', 'Quotes'],
    ['waiting', 'Waiting'],
    ['lost', 'Lost'],
    ['ai', 'AI Qualified']
  ];
  var LEADS_WS_TABS = [
    ['overview', 'Overview'],
    ['conversation', 'Conversation'],
    ['quote', 'Quote'],
    ['estimate', 'Estimate'],
    ['tasks', 'Tasks'],
    ['notes', 'Notes'],
    ['files', 'Files']
  ];
  var LEADS_PERM_ROLES = [
    { role: 'Owner', view: '✅', edit: '✅', convert: '✅', delete: '✅', assign: '✅' },
    { role: 'Manager', view: '✅', edit: '✅', convert: '✅', delete: '✅', assign: '✅' },
    { role: 'Office', view: '✅', edit: '✅', convert: '✅', delete: '—', assign: '✅' },
    { role: 'Sales', view: '✅', edit: '✅', convert: '✅', delete: '—', assign: '—' },
    { role: 'Read Only', view: '✅', edit: '—', convert: '—', delete: '—', assign: '—' }
  ];
  var LEADS_TEAM = [
    { id: 'tech_adrian', name: 'Adrian Lopez', role: 'Owner' },
    { id: 'tech_maya', name: 'Maya Chen', role: 'Sales' },
    { id: 'tech_luis', name: 'Luis Ortega', role: 'Office' }
  ];

  function normalizeLeadStage(lead) {
    var s = String(lead.stage || lead.status || 'new').toLowerCase();
    if (lead.spam || s === 'spam') return 'spam';
    if (lead.duplicateOf || s === 'duplicate') return 'duplicate';
    if (s === 'archived' || lead.archived) return 'archived';
    if (s === 'lost') return 'lost';
    if (/waiting_payment|wait.*pay/.test(s) || lead.waitingReason === 'payment') return 'waiting_payment';
    if (/waiting_photos|wait.*photo/.test(s) || lead.waitingReason === 'photos') return 'waiting_photos';
    if (/waiting_approval|wait.*approv/.test(s) || lead.waitingReason === 'approval') return 'waiting_approval';
    if (/waiting_customer|waiting|incomplete/.test(s) || lead.waitingReason === 'customer' || lead.isAbandoned) return 'waiting_customer';
    if (/quote_expired|expired/.test(s) || lead.quoteStatus === 'expired') return 'quote_expired';
    if (/quote_viewed|viewed/.test(s) || lead.quoteStatus === 'viewed') return 'quote_viewed';
    if (/quote_sent|quoted|quote/.test(s) || lead.quoteStatus === 'sent') return 'quote_sent';
    if (s === 'new' || s === 'new_inquiry' || !s) return 'new';
    return s;
  }

  function leadStatusTone(stage) {
    stage = String(stage || '').toLowerCase();
    if (/lost|spam|archived|duplicate|expired/.test(stage)) return 'hot';
    if (/waiting/.test(stage)) return 'warn';
    if (/quote/.test(stage)) return 'info';
    if (/ai|qualified|new/.test(stage)) return 'ok';
    return 'info';
  }

  function leadStageDisplay(lead) {
    var stage = lead.osStage || normalizeLeadStage(lead);
    var map = {
      new: 'New',
      quote_sent: 'Quote Sent',
      quote_viewed: 'Quote Viewed',
      quote_expired: 'Quote Expired',
      waiting_customer: 'Waiting · Customer',
      waiting_payment: 'Waiting · Payment',
      waiting_photos: 'Waiting · Photos',
      waiting_approval: 'Waiting · Approval',
      lost: 'Lost',
      archived: 'Archived',
      spam: 'Spam',
      duplicate: 'Duplicate'
    };
    return map[stage] || leadStageLbl(lead);
  }

  function pushLeadActivity(lead, type, label) {
    lead.activity = lead.activity || [];
    lead.activity.unshift({ type: type, label: label, at: new Date().toLocaleString() });
    lead.activity = lead.activity.slice(0, 40);
  }

  function ensureLeadsOsState() {
    var st = S();
    if (!st.pipeline || typeof st.pipeline !== 'object') st.pipeline = { manual: [], deleted: [], stages: {}, lostReasons: {}, edits: {} };
    if (!Array.isArray(st.pipeline.manual)) st.pipeline.manual = [];
    if (!Array.isArray(st.abandonedLeads)) st.abandonedLeads = [];
    if (!Array.isArray(st.team) || !st.team.length) st.team = LEADS_TEAM.slice();
    if (!st.leadsOs) st.leadsOs = { savedFilters: [], role: 'Owner' };
    if (!Array.isArray(st.leadsOs.savedFilters)) st.leadsOs.savedFilters = [];

    var leads = allLeadsRaw();
    leads.forEach(function (lead, idx) {
      if (!lead.id && !lead.key) lead.id = 'lead_auto_' + idx;
      if (!lead.key) lead.key = lead.id || ('lead_' + idx);
      lead.osStage = normalizeLeadStage(lead);
      lead.stage = lead.osStage;
      if (!lead.status) {
        if (/waiting/.test(lead.osStage)) lead.status = 'waiting';
        else if (/quote/.test(lead.osStage)) lead.status = 'quoted';
        else if (/lost|archived|spam|duplicate/.test(lead.osStage)) lead.status = lead.osStage;
        else lead.status = 'new';
      }
      if (/waiting_/.test(lead.osStage) && !lead.waitingReason) {
        lead.waitingReason = lead.osStage.replace('waiting_', '');
      }
      if (!lead.quoteStatus) {
        if (lead.osStage === 'quote_sent') lead.quoteStatus = 'sent';
        else if (lead.osStage === 'quote_viewed') lead.quoteStatus = 'viewed';
        else if (lead.osStage === 'quote_expired') lead.quoteStatus = 'expired';
        else if (lead.quote && lead.quote.status) lead.quoteStatus = lead.quote.status;
        else lead.quoteStatus = 'none';
      }
      if (!lead.assignedTo) {
        var team = st.team || LEADS_TEAM;
        lead.assignedTo = (team[idx % team.length] || team[0]).name;
      }
      if (!Array.isArray(lead.tags)) lead.tags = lead.tags ? [String(lead.tags)] : [];
      if (lead.aiScore == null) {
        var base = lead.aiQualified ? 75 : 45;
        if (lead.amount || lead.estimatedValue) base += 10;
        if (lead.unread) base += 5;
        lead.aiScore = Math.max(5, Math.min(99, base + (idx % 17)));
      }
      if (lead.aiQualified == null) lead.aiQualified = lead.aiScore >= 70;
      if (lead.unread == null) lead.unread = 0;
      if (!lead.lastMessage) {
        if (lead.messages && lead.messages.length) lead.lastMessage = lead.messages[lead.messages.length - 1].text || '';
        else lead.lastMessage = lead.notes ? String(lead.notes).slice(0, 80) : 'No messages yet';
      }
      if (!Array.isArray(lead.messages)) lead.messages = [];
      if (!Array.isArray(lead.notesList)) {
        lead.notesList = lead.notes ? [String(lead.notes)] : [];
      }
      if (!Array.isArray(lead.tasks)) lead.tasks = [];
      if (!Array.isArray(lead.files)) lead.files = [];
      if (!Array.isArray(lead.activity) || !lead.activity.length) {
        lead.activity = [{ type: 'created', label: 'Lead created', at: String(lead.createdAt || todayStr()).slice(0, 16).replace('T', ' ') }];
      }
      if (!lead.estimate) {
        var tot = parseFloat(lead.estimatedValue != null ? lead.estimatedValue : lead.amount) || 0;
        lead.estimate = tot ? { labor: Math.round(tot * 0.65), materials: Math.round(tot * 0.35), total: tot, notes: '' } : { labor: 0, materials: 0, total: 0, notes: '' };
      }
      if (!lead.quote && (lead.quoteStatus === 'sent' || lead.quoteStatus === 'viewed' || lead.quoteStatus === 'expired' || lead.amount)) {
        lead.quote = {
          id: 'q_' + (lead.id || idx),
          amount: parseFloat(lead.amount || lead.estimatedValue) || 0,
          status: lead.quoteStatus === 'none' ? 'draft' : lead.quoteStatus,
          packageName: lead.service || 'Service',
          sentAt: String(lead.createdAt || todayStr()).slice(0, 10)
        };
      }
      if (lead.estimatedValue == null) lead.estimatedValue = parseFloat(lead.amount) || 0;
      if (!lead.buyingIntent) {
        lead.buyingIntent = lead.aiScore >= 80 ? 'high' : (lead.aiScore >= 55 ? 'med' : (lead.aiScore >= 20 ? 'low' : 'none'));
      }
      if (!lead.lastContacted) lead.lastContacted = lead.createdAt || todayStr();
      if (!lead.property) lead.property = lead.address || '';
      if (lead.followUpAt == null) lead.followUpAt = '';
      if (lead.spam == null) lead.spam = lead.osStage === 'spam';
    });
    return st;
  }

  function allLeadsRaw() {
    var st = S();
    if (!st.pipeline || typeof st.pipeline !== 'object') st.pipeline = { manual: [], deleted: [], stages: {}, lostReasons: {}, edits: {} };
    if (!Array.isArray(st.pipeline.manual)) st.pipeline.manual = [];
    var pipe = st.pipeline.manual;
    // Prefer live pipeline.manual objects so OS mutations + ceo-demo enrichments persist.
    if (pipe.length) {
      pipe.forEach(function (l, i) {
        if (!l.id) l.id = 'lead_auto_' + i;
        if (!l.key) l.key = l.id;
      });
      return pipe;
    }
    // Seed from collectPipelineLeads / demo fallback once, then keep on pipeline.manual.
    var collected = collectLeads();
    if (!collected.length) collected = allLeads();
    collected.forEach(function (l, i) {
      var id = l.id || ('lead_seed_' + i);
      pipe.push(Object.assign({}, l, { id: id, key: l.key || id }));
    });
    return pipe;
  }

  function leadsOsList() {
    ensureLeadsOsState();
    return allLeadsRaw().filter(function (l) { return !l.deleted; });
  }

  function findLead(id) {
    return leadsOsList().find(function (l) { return String(l.id) === String(id) || String(l.key) === String(id); }) || null;
  }

  function leadMatchesTab(lead, tab) {
    var stage = lead.osStage || normalizeLeadStage(lead);
    if (tab === 'new') return stage === 'new';
    if (tab === 'quotes') return /quote_sent|quote_viewed|quote_expired/.test(stage);
    if (tab === 'waiting') return /^waiting_/.test(stage);
    if (tab === 'lost') return /lost|archived|spam|duplicate/.test(stage);
    if (tab === 'ai') return !!lead.aiQualified && !/lost|archived|spam|duplicate/.test(stage);
    return true;
  }

  function leadMatchesFilters(lead, root) {
    var f = root._josLeadFilters || {};
    if (f.status && f.status !== 'all' && String(lead.status || '') !== f.status) return false;
    if (f.source && f.source !== 'all' && srcKind(lead.source, lead) !== f.source) return false;
    if (f.assigned && f.assigned !== 'all' && lead.assignedTo !== f.assigned) return false;
    if (f.service && f.service !== 'all' && lead.service !== f.service) return false;
    if (f.vehicle && String(vehicleOf(lead) || '').toLowerCase().indexOf(String(f.vehicle).toLowerCase()) < 0) return false;
    if (f.property && String(lead.property || lead.address || '').toLowerCase().indexOf(String(f.property).toLowerCase()) < 0) return false;
    if (f.aiScore === 'high' && !(lead.aiScore >= 80)) return false;
    if (f.aiScore === 'med' && !(lead.aiScore >= 50 && lead.aiScore < 80)) return false;
    if (f.aiScore === 'low' && !(lead.aiScore < 50)) return false;
    if (f.tags && String(f.tags).trim()) {
      var want = String(f.tags).toLowerCase().split(/[,\s]+/).filter(Boolean);
      var have = (lead.tags || []).map(function (t) { return String(t).toLowerCase(); });
      if (!want.every(function (w) { return have.some(function (h) { return h.indexOf(w) >= 0; }); })) return false;
    }
    if (f.pipeline && f.pipeline !== 'all' && (lead.osStage || normalizeLeadStage(lead)) !== f.pipeline) return false;
    if (f.quoteStatus && f.quoteStatus !== 'all' && String(lead.quoteStatus || 'none') !== f.quoteStatus) return false;
    if (f.valueMin && !(parseFloat(lead.estimatedValue || lead.amount || 0) >= parseFloat(f.valueMin))) return false;
    if (f.valueMax && !(parseFloat(lead.estimatedValue || lead.amount || 0) <= parseFloat(f.valueMax))) return false;
    if (f.created && f.created !== 'all') {
      var created = String(lead.createdAt || '').slice(0, 10);
      var today = todayStr();
      if (f.created === 'today' && created !== today) return false;
      if (f.created === 'week') {
        var ws = today;
        try {
          var d = new Date(today + 'T12:00:00');
          d.setDate(d.getDate() - 7);
          ws = d.toISOString().slice(0, 10);
        } catch (e) {}
        if (created < ws) return false;
      }
      if (f.created === 'month') {
        var ms = today.slice(0, 7);
        if (created.slice(0, 7) !== ms) return false;
      }
    }
    if (f.lastContacted && f.lastContacted !== 'all') {
      var lc = String(lead.lastContacted || '').slice(0, 10);
      if (f.lastContacted === 'today' && lc !== todayStr()) return false;
      if (f.lastContacted === 'stale') {
        var cut = todayStr();
        try {
          var dd = new Date(todayStr() + 'T12:00:00');
          dd.setDate(dd.getDate() - 7);
          cut = dd.toISOString().slice(0, 10);
        } catch (e2) {}
        if (lc >= cut) return false;
      }
    }
    return true;
  }

  function leadSearchHay(lead) {
    var msgBlob = (lead.messages || []).map(function (m) { return m.text || m.content || ''; }).join(' ');
    return [
      lead.name, lead.phone, lead.email, vehicleOf(lead), lead.property, lead.address,
      lead.service, lead.source, lead.notes, (lead.notesList || []).join(' '),
      lead.lastMessage, msgBlob, (lead.tags || []).join(' '), lead.assignedTo
    ].join(' ').toLowerCase();
  }

  function filterLeadsList(root) {
    var tab = root._josLeadsTab || 'new';
    var q = String(root._josLeadsQ || '').trim().toLowerCase();
    var list = leadsOsList().filter(function (l) { return leadMatchesTab(l, tab); });
    list = list.filter(function (l) { return leadMatchesFilters(l, root); });
    if (q) list = list.filter(function (l) { return leadSearchHay(l).indexOf(q) > -1; });
    if (tab === 'ai') list = list.slice().sort(function (a, b) { return (b.aiScore || 0) - (a.aiScore || 0); });
    else list = list.slice().sort(function (a, b) { return String(b.lastContacted || b.createdAt || '').localeCompare(String(a.lastContacted || a.createdAt || '')); });
    return list;
  }

  function leadTimeLabel(lead) {
    var raw = String(lead.lastContacted || lead.createdAt || '');
    if (!raw) return '—';
    if (raw.indexOf('T') > -1) {
      try {
        var d = new Date(raw);
        if (!isNaN(d.getTime())) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      } catch (e) {}
    }
    return raw.slice(0, 10);
  }

  function uniqueLeadValues(field) {
    var set = {};
    leadsOsList().forEach(function (l) {
      var v = field === 'source' ? srcKind(l.source, l) : (field === 'vehicle' ? vehicleOf(l) : l[field]);
      if (v) set[String(v)] = true;
    });
    return Object.keys(set).sort();
  }

  function renderLeadsFilterDrawer(root) {
    var f = root._josLeadFilters || {};
    var open = !!root._josLeadFilterOpen;
    if (!open) return '';
    function opt(list, cur, allLabel) {
      return '<option value="all"' + (!cur || cur === 'all' ? ' selected' : '') + '>' + (allLabel || 'All') + '</option>' +
        list.map(function (v) {
          return '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(v) + '</option>';
        }).join('');
    }
    return '<div class="jos-leads-drawer" id="jos-leads-drawer">' +
      '<div class="jos-between"><div class="jos-kicker">Filters</div><button type="button" class="jos-btn jos-btn-sm" data-jos-act="leads-filter-close">Close</button></div>' +
      '<div class="jos-leads-filter-grid">' +
      '<label>Status<select id="jos-lf-status">' + opt(['new', 'quoted', 'waiting', 'lost', 'archived', 'spam', 'duplicate'], f.status) + '</select></label>' +
      '<label>Source<select id="jos-lf-source">' + opt(uniqueLeadValues('source'), f.source) + '</select></label>' +
      '<label>Assigned<select id="jos-lf-assigned">' + opt(uniqueLeadValues('assignedTo'), f.assigned, 'Anyone') + '</select></label>' +
      '<label>Service<select id="jos-lf-service">' + opt(uniqueLeadValues('service'), f.service) + '</select></label>' +
      '<label>Vehicle<input id="jos-lf-vehicle" type="text" value="' + esc(f.vehicle || '') + '" placeholder="Vehicle…"></label>' +
      '<label>Property<input id="jos-lf-property" type="text" value="' + esc(f.property || '') + '" placeholder="Property…"></label>' +
      '<label>AI Score<select id="jos-lf-aiscore">' + opt(['high', 'med', 'low'], f.aiScore, 'Any') + '</select></label>' +
      '<label>Tags<input id="jos-lf-tags" type="text" value="' + esc(f.tags || '') + '" placeholder="hot, ceramic"></label>' +
      '<label>Date Created<select id="jos-lf-created">' + opt(['today', 'week', 'month'], f.created, 'Any time') + '</select></label>' +
      '<label>Last Contacted<select id="jos-lf-contacted">' + opt(['today', 'stale'], f.lastContacted, 'Any') + '</select></label>' +
      '<label>Pipeline Stage<select id="jos-lf-pipeline">' + opt(['new', 'quote_sent', 'quote_viewed', 'quote_expired', 'waiting_customer', 'waiting_payment', 'waiting_photos', 'waiting_approval', 'lost', 'archived', 'spam', 'duplicate'], f.pipeline) + '</select></label>' +
      '<label>Quote Status<select id="jos-lf-quote">' + opt(['none', 'draft', 'sent', 'viewed', 'expired', 'accepted'], f.quoteStatus) + '</select></label>' +
      '<label>Est. Value Min<input id="jos-lf-vmin" type="number" value="' + esc(f.valueMin || '') + '" placeholder="0"></label>' +
      '<label>Est. Value Max<input id="jos-lf-vmax" type="number" value="' + esc(f.valueMax || '') + '" placeholder="9999"></label>' +
      '</div>' +
      '<div class="jos-btn-row jos-mt">' +
      btn('leads-filter-apply', 'Apply', 'jos-btn-brand jos-btn-sm') +
      btn('leads-filter-reset', 'Reset', 'jos-btn jos-btn-sm') +
      btn('leads-filter-save', 'Save Filter', 'jos-btn jos-btn-sm') +
      '</div></div>';
  }

  function renderLeadsAddModal(root) {
    if (!root._josLeadAddOpen) return '';
    var d = root._josLeadDraft || {};
    var team = (S().team && S().team.length ? S().team : LEADS_TEAM);
    return '<div class="jos-leads-modal-backdrop" data-jos-act="leads-add-cancel">' +
      '<div class="jos-leads-modal" onclick="event.stopPropagation()">' +
      '<div class="jos-between"><h3 style="margin:0">Add Lead</h3><button type="button" class="jos-btn jos-btn-sm" data-jos-act="leads-add-cancel">✕</button></div>' +
      '<div class="jos-leads-form">' +
      '<label>Name<input id="jos-la-name" value="' + esc(d.name || '') + '" placeholder="Full name"></label>' +
      '<label>Phone<input id="jos-la-phone" value="' + esc(d.phone || '') + '" placeholder="(619) 555-0100"></label>' +
      '<label>Email<input id="jos-la-email" value="' + esc(d.email || '') + '" placeholder="name@email.com"></label>' +
      '<label>Address<input id="jos-la-address" value="' + esc(d.address || '') + '" placeholder="Service address"></label>' +
      '<label>Vehicle / Property<input id="jos-la-vehicle" value="' + esc(d.vehicle || '') + '" placeholder="Vehicle or property"></label>' +
      '<label>Service<input id="jos-la-service" value="' + esc(d.service || '') + '" placeholder="Service interest"></label>' +
      '<label>Source<select id="jos-la-source">' +
        [['manual', 'Manual'], ['google', 'Google'], ['facebook', 'Facebook'], ['instagram', 'Instagram'], ['hubly', 'Hubly'], ['website', 'Website']].map(function (s) {
          return '<option value="' + s[0] + '"' + ((d.source || 'manual') === s[0] ? ' selected' : '') + '>' + s[1] + '</option>';
        }).join('') +
      '</select></label>' +
      '<label>Assigned User<select id="jos-la-assigned">' +
        team.map(function (t) {
          return '<option value="' + esc(t.name) + '"' + ((d.assignedTo || team[0].name) === t.name ? ' selected' : '') + '>' + esc(t.name) + '</option>';
        }).join('') +
      '</select></label>' +
      '<label class="jos-leads-span2">Notes<textarea id="jos-la-notes" class="jos-textarea" placeholder="Notes…">' + esc(d.notes || '') + '</textarea></label>' +
      '<label class="jos-leads-span2">Tags<input id="jos-la-tags" value="' + esc(d.tags || '') + '" placeholder="hot, ceramic"></label>' +
      '</div>' +
      '<div class="jos-btn-row jos-mt">' +
      btn('leads-add-cancel', 'Cancel', 'jos-btn jos-btn-sm') +
      btn('leads-add-save', 'Save Lead', 'jos-btn-brand jos-btn-sm') +
      btn('leads-add-quote', 'Save & Quote', 'jos-btn jos-btn-sm') +
      '</div></div></div>';
  }

  function renderLeadCard(lead, selectedId) {
    var on = selectedId && (String(lead.id) === String(selectedId) || String(lead.key) === String(selectedId));
    var kind = srcKind(lead.source, lead);
    return '<button type="button" class="jos-list-card jos-leads-card' + (on ? ' on' : '') + '" data-jos-lead-id="' + esc(String(lead.id || lead.key)) + '">' +
      '<div class="jos-between">' +
        '<div class="jos-px-person"><div class="jos-px-av">' + esc(initials(lead.name)) + '</div><div><strong class="t">' + esc(lead.name || 'Lead') + '</strong>' +
        '<div class="s">' + srcIco(kind) + ' ' + esc(srcLabel(kind)) + '</div></div></div>' +
        '<span class="jos-muted">' + esc(leadTimeLabel(lead)) + '</span>' +
      '</div>' +
      '<div class="s jos-leads-last">' + esc(lead.lastMessage || 'No messages yet') + '</div>' +
      '<div class="meta">' +
        '<span class="jos-pill ' + leadStatusTone(lead.osStage) + '">' + esc(leadStageDisplay(lead)) + '</span>' +
        '<span class="jos-pill info">AI ' + esc(String(lead.aiScore || 0)) + '</span>' +
        (lead.unread ? '<span class="jos-pill hot">' + lead.unread + ' new</span>' : '') +
        '<span class="jos-muted">' + esc(lead.assignedTo || 'Unassigned') + '</span>' +
      '</div></button>';
  }

  function renderLeadWorkspace(root, lead, ws) {
    if (!lead) return '<div class="jos-empty">Select a lead to open the workspace.</div>';
    var tabBar = '<div class="jos-btn-row jos-leads-ws-tabs">' + LEADS_WS_TABS.map(function (t) {
      return '<button type="button" class="jos-btn jos-btn-sm' + (ws === t[0] ? ' jos-btn-brand' : '') + '" data-jos-lead-ws="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div>';

    var actions = '<div class="jos-btn-row jos-mt jos-leads-actions">' +
      btn('leads-convert-customer', 'Convert to Customer', 'jos-btn-brand jos-btn-sm') +
      btn('leads-convert-job', 'Convert to Job', 'jos-btn jos-btn-sm') +
      btn('leads-create-quote', 'Create Quote', 'jos-btn jos-btn-sm') +
      btn('leads-followup', 'Schedule Follow-up', 'jos-btn jos-btn-sm') +
      btn('leads-request-photos', 'Request Photos', 'jos-btn jos-btn-sm') +
      btn('leads-payment-link', 'Send Payment Link', 'jos-btn jos-btn-sm') +
      btn('leads-review-request', 'Send Review Request', 'jos-btn jos-btn-sm') +
      btn('leads-archive', 'Archive', 'jos-btn jos-btn-sm') +
      btn('leads-delete', 'Delete', 'jos-btn jos-btn-sm') +
      btn('leads-duplicate', 'Duplicate', 'jos-btn jos-btn-sm') +
      '</div>';

    var body = '';
    if (ws === 'overview') {
      body = '<div class="jos-stack jos-mt">' +
        '<div class="jos-between"><div><div class="jos-kicker">Contact</div><strong>' + esc(lead.name) + '</strong>' +
        '<div class="jos-muted">' + esc(lead.phone || '—') + ' · ' + esc(lead.email || '—') + '</div></div>' +
        '<span class="jos-pill ' + leadStatusTone(lead.osStage) + '">' + esc(leadStageDisplay(lead)) + '</span></div>' +
        '<div><div class="jos-kicker">Service</div>' + esc(lead.service || '—') + '</div>' +
        '<div><div class="jos-kicker">Vehicle / Property</div>' + esc(vehicleOf(lead) || lead.property || '—') + '</div>' +
        '<div><div class="jos-kicker">Address</div>' + esc(lead.address || lead.property || '—') + '</div>' +
        '<div><div class="jos-kicker">Source</div>' + srcIco(srcKind(lead.source, lead)) + ' ' + esc(srcLabel(srcKind(lead.source, lead))) + '</div>' +
        '<div><div class="jos-kicker">Assigned</div>' + esc(lead.assignedTo || 'Unassigned') +
        ' <button type="button" class="jos-btn jos-btn-sm" data-jos-act="leads-assign">Reassign</button></div>' +
        '<div><div class="jos-kicker">Estimated Value</div>' + esc(money(lead.estimatedValue || lead.amount) || '$0') + '</div>' +
        '<div><div class="jos-kicker">Tags</div>' + ((lead.tags || []).map(function (t) { return '<span class="jos-pill info">' + esc(t) + '</span>'; }).join(' ') || '<span class="jos-muted">None</span>') +
        ' <button type="button" class="jos-btn jos-btn-sm" data-jos-act="leads-add-tag">Add tag</button></div>' +
        '<div class="jos-ai"><div class="sk">AI</div><p style="font-size:13px;margin-top:6px"><strong>Score:</strong> ' + esc(String(lead.aiScore)) +
        ' · <strong>Intent:</strong> ' + esc(lead.buyingIntent || '—') +
        ' · <strong>Follow-up:</strong> ' + esc(lead.followUpAt || 'Suggest within 24h') + '</p>' +
        '<div class="jos-btn-row jos-mt">' +
        btn('leads-ai-summary', 'Auto Summary', 'jos-btn jos-btn-sm') +
        btn('leads-ai-followup', 'Recommended Follow-up', 'jos-btn jos-btn-sm') +
        btn('leads-ai-intent', 'Buying Intent', 'jos-btn jos-btn-sm') +
        btn('leads-ai-dup', 'Duplicate Check', 'jos-btn jos-btn-sm') +
        btn('leads-ai-spam', 'Spam Check', 'jos-btn jos-btn-sm') +
        '</div></div></div>';
    } else if (ws === 'conversation') {
      var msgs = lead.messages && lead.messages.length ? lead.messages : [{ dir: 'sys', text: lead.lastMessage || 'No conversation yet', at: '' }];
      body = '<div class="jos-mt"><div class="jos-chat-stream">' + msgs.map(function (m) {
        var dir = m.dir === 'out' ? 'out' : (m.dir === 'sys' ? 'sys' : 'in');
        if (dir === 'sys') return '<div class="jos-chat-sys">' + esc(m.text || '') + '</div>';
        return '<div class="jos-chat-bubble ' + dir + '">' + esc(m.text || '') +
          '<div class="jos-muted" style="font-size:10px;margin-top:4px">' + esc(m.at || '') + '</div></div>';
      }).join('') + '</div>' +
        '<div class="jos-chat-input jos-mt"><input id="jos-leads-reply" type="text" placeholder="Reply…" value="' + esc(root._josLeadDraftMsg || '') + '">' +
        '<button type="button" class="jos-btn jos-btn-brand jos-btn-sm" data-jos-act="leads-send">Send</button></div>' +
        '<div class="jos-btn-row jos-mt">' +
        btn('leads-ai-conv-summary', 'Conversation Summary', 'jos-btn jos-btn-sm') +
        btn('leads-call', 'Call', 'jos-btn jos-btn-sm') +
        btn('leads-sms', 'SMS', 'jos-btn jos-btn-sm') +
        btn('leads-email', 'Email', 'jos-btn jos-btn-sm') +
        '</div></div>';
    } else if (ws === 'quote') {
      var q = lead.quote;
      body = '<div class="jos-stack jos-mt">' +
        (q ? '<div class="jos-note"><strong>Quote ' + esc(q.id) + '</strong><div class="jos-muted">' + esc(money(q.amount)) + ' · ' + esc(q.status) + ' · ' + esc(q.packageName || lead.service || '') + '</div></div>' : '<div class="jos-muted">No quote yet</div>') +
        '<div class="jos-btn-row">' +
        btn('leads-create-quote', 'Create / Update Quote', 'jos-btn-brand jos-btn-sm') +
        btn('leads-quote-print', 'Print', 'jos-btn jos-btn-sm') +
        btn('leads-quote-share', 'Share', 'jos-btn jos-btn-sm') +
        btn('leads-quote-email', 'Email (placeholder)', 'jos-btn jos-btn-sm') +
        btn('leads-ai-suggest-quote', 'Suggested Quote', 'jos-btn jos-btn-sm') +
        '</div></div>';
    } else if (ws === 'estimate') {
      var est = lead.estimate || { labor: 0, materials: 0, total: 0, notes: '' };
      body = '<div class="jos-stack jos-mt">' +
        '<div class="jos-between"><div><div class="jos-kicker">Labor</div>' + esc(money(est.labor)) + '</div>' +
        '<div><div class="jos-kicker">Materials</div>' + esc(money(est.materials)) + '</div>' +
        '<div><div class="jos-kicker">Total</div><strong>' + esc(money(est.total)) + '</strong></div></div>' +
        '<div><div class="jos-kicker">Notes</div><textarea id="jos-leads-est-notes" class="jos-textarea">' + esc(est.notes || '') + '</textarea></div>' +
        '<div class="jos-btn-row">' + btn('leads-est-save', 'Save Estimate', 'jos-btn-brand jos-btn-sm') + btn('leads-est-print', 'Print', 'jos-btn jos-btn-sm') + '</div></div>';
    } else if (ws === 'tasks') {
      body = '<div class="jos-stack jos-mt">' +
        ((lead.tasks || []).length ? lead.tasks.map(function (t, i) {
          return '<label class="jos-check-row"><input type="checkbox" data-jos-act="leads-task-toggle" data-jos-task-i="' + i + '"' + (t.done ? ' checked' : '') + '> ' + esc(t.label) + '</label>';
        }).join('') : '<div class="jos-empty">No tasks yet</div>') +
        '<div class="jos-chat-input jos-mt"><input id="jos-leads-task-new" placeholder="New task…"><button type="button" class="jos-btn jos-btn-sm" data-jos-act="leads-task-add">Add</button></div>' +
        '<div class="jos-mt">' + btn('leads-ai-reminder', 'Follow-up Reminder', 'jos-btn jos-btn-sm') + '</div></div>';
    } else if (ws === 'notes') {
      body = '<div class="jos-stack jos-mt">' +
        ((lead.notesList || []).length ? lead.notesList.map(function (n) { return '<div class="jos-note">' + esc(n) + '</div>'; }).join('') : '<div class="jos-muted">No notes yet</div>') +
        '<div class="jos-chat-input jos-mt"><input id="jos-leads-note-new" placeholder="Add note…"><button type="button" class="jos-btn jos-btn-sm" data-jos-act="leads-note-add">Add</button></div></div>';
    } else {
      body = '<div class="jos-stack jos-mt">' +
        ((lead.files || []).length ? lead.files.map(function (f, i) {
          return '<div class="jos-between jos-note"><div>📎 ' + esc(f.name || f) + '</div><button type="button" class="jos-btn jos-btn-sm" data-jos-act="leads-file-del" data-jos-file-i="' + i + '">Remove</button></div>';
        }).join('') : '<div class="jos-empty">No files attached</div>') +
        '<div class="jos-mt">' + btn('leads-file-add', 'Add File', 'jos-btn-brand jos-btn-sm') + '</div></div>';
    }

    return '<div class="jos-card jos-leads-workspace" data-jos-lead-id="' + esc(String(lead.id || lead.key)) + '">' +
      '<div class="jos-between"><div><div class="jos-kicker">Lead Workspace</div><h3 style="margin:4px 0 0">' + esc(lead.name || 'Lead') + '</h3></div>' +
      '<span class="jos-pill info">AI ' + esc(String(lead.aiScore || 0)) + '</span></div>' +
      tabBar + actions + body + '</div>';
  }

  function renderLeadSidebar(lead) {
    if (!lead) return '<div class="jos-empty">Notes, activity, and score appear here.</div>';
    return '<div class="jos-stack jos-leads-side">' +
      '<div class="jos-card"><div class="jos-kicker">Notes</div>' +
      ((lead.notesList || []).slice(0, 3).map(function (n) { return '<div class="jos-note jos-mt">' + esc(n) + '</div>'; }).join('') || '<p class="jos-muted jos-mt">No notes</p>') +
      '<div class="jos-chat-input jos-mt"><input id="jos-leads-side-note" placeholder="Quick note…"><button type="button" class="jos-btn jos-btn-sm" data-jos-act="leads-side-note">Add</button></div></div>' +
      '<div class="jos-card"><div class="jos-kicker">Recent Activity</div><div class="jos-stack jos-mt">' +
      ((lead.activity || []).slice(0, 6).map(function (a) {
        return '<div class="jos-sched-row"><div class="time">' + esc(String(a.type || '').slice(0, 4)) + '</div><div><div class="who">' + esc(a.label) + '</div><div class="svc">' + esc(a.at || '') + '</div></div></div>';
      }).join('') || '<div class="jos-muted">No activity</div>') +
      '</div></div>' +
      '<div class="jos-ai"><div class="sk">Lead Score</div><div class="jos-kpi-v brand jos-mt">' + esc(String(lead.aiScore || 0)) + '</div>' +
      '<p style="font-size:13px;margin-top:6px">Intent: <strong>' + esc(lead.buyingIntent || '—') + '</strong>' +
      (lead.spam ? ' · <strong>Spam risk</strong>' : '') +
      (lead.duplicateOf ? ' · <strong>Possible duplicate</strong>' : '') + '</p>' +
      '<div class="jos-btn-row jos-mt">' + btn('leads-recalc-score', 'Recalculate', 'jos-btn-brand jos-btn-sm') +
      btn('leads-ai-membership', 'Suggested Membership', 'jos-btn jos-btn-sm') + '</div></div>' +
      '<div class="jos-card"><div class="jos-kicker">Attachments</div><div class="jos-stack jos-mt">' +
      ((lead.files || []).length ? lead.files.map(function (f) { return '<div class="jos-note">📎 ' + esc(f.name || f) + '</div>'; }).join('') : '<div class="jos-muted">None</div>') +
      '</div>' + btn('leads-file-add', 'Add attachment', 'jos-btn jos-btn-sm') + '</div>' +
      '<div class="jos-card"><div class="jos-kicker">Permissions (OS)</div>' +
      '<table class="jos-leads-perm"><thead><tr><th>Role</th><th>View</th><th>Edit</th><th>Convert</th><th>Delete</th><th>Assign</th></tr></thead><tbody>' +
      LEADS_PERM_ROLES.map(function (r) {
        return '<tr><td>' + esc(r.role) + '</td><td>' + r.view + '</td><td>' + r.edit + '</td><td>' + r.convert + '</td><td>' + r.delete + '</td><td>' + r.assign + '</td></tr>';
      }).join('') +
      '</tbody></table></div></div>';
  }

  function renderLeadsContextMenu(root) {
    var menu = root._josLeadCtx;
    if (!menu || !menu.open) return '';
    return '<div class="jos-leads-ctx" style="left:' + menu.x + 'px;top:' + menu.y + 'px" id="jos-leads-ctx">' +
      '<button type="button" data-jos-act="leads-call">Call</button>' +
      '<button type="button" data-jos-act="leads-sms">SMS</button>' +
      '<button type="button" data-jos-act="leads-email">Email</button>' +
      '<button type="button" data-jos-act="leads-convert-customer">Convert to Customer</button>' +
      '<button type="button" data-jos-act="leads-convert-job">Convert to Job</button>' +
      '<button type="button" data-jos-act="leads-assign">Assign</button>' +
      '<button type="button" data-jos-act="leads-copy">Copy Contact</button>' +
      '<button type="button" data-jos-act="leads-archive">Archive</button>' +
      '<button type="button" data-jos-act="leads-delete">Delete</button>' +
      '</div>';
  }

  function renderLeads() {
    var root = ownPixelView('v-leads', 'jos-leads-root');
    if (!root) return;
    updateChrome('leads');
    root.innerHTML = '<div class="jos-page jos-leads-page"><div class="jos-home-loading">Loading Leads…</div></div>';
    try { renderLeadsPage(root); }
    catch (err) {
      console.warn('HublyJourneyOS Leads', err);
      root.innerHTML = '<div class="jos-page"><div class="jos-empty jos-error-state"><strong>Leads could not load</strong><p class="jos-muted">Refresh and try again.</p><div class="jos-mt"><button type="button" class="jos-btn jos-btn-brand jos-btn-sm" onclick="HublyJourneyOS.renderLeads()">Retry</button></div></div></div>';
    }
  }

  function renderLeadsPage(root) {
    ensureLeadsOsState();
    var tab = root._josLeadsTab || 'new';
    var ws = root._josLeadWorkspace || 'overview';
    var all = leadsOsList();
    var filtered = filterLeadsList(root);
    var selectedId = root._josLeadId || (filtered[0] && (filtered[0].id || filtered[0].key)) || null;
    var sel = selectedId ? findLead(selectedId) : null;
    // Keep workspace selection even when the lead is outside the active tab/filter.
    if (selectedId && !sel) {
      selectedId = filtered[0] ? (filtered[0].id || filtered[0].key) : null;
      root._josLeadId = selectedId;
      sel = selectedId ? findLead(selectedId) : null;
    }
    if (sel) sel.unread = 0;

    var tabsHtml = '<div class="jos-tabs jos-leads-tabs">' + LEADS_TABS.map(function (t) {
      var count = all.filter(function (l) { return leadMatchesTab(l, t[0]); }).length;
      return '<button type="button" class="jos-tab' + (tab === t[0] ? ' on' : '') + '" data-jos-leads-tab="' + t[0] + '">' + esc(t[1]) +
        (count ? ' <span class="jos-tab-count">' + count + '</span>' : '') + '</button>';
    }).join('') + '</div>';

    var listHtml = filtered.length
      ? filtered.map(function (l) { return renderLeadCard(l, selectedId); }).join('')
      : '<div class="jos-empty">No leads in this view.' + (root._josLeadsQ ? ' Clear search (Esc) to see more.' : '') + '</div>';

    var integCtas = '<div class="jos-leads-integ">' +
      '<span class="jos-muted">Stage 2 integrations</span>' +
      btn('leads-connect-meta', 'Connect Meta Lead Ads', 'jos-btn jos-btn-sm') +
      btn('leads-connect-messenger', 'Connect Messenger / IG', 'jos-btn jos-btn-sm') +
      btn('leads-connect-forms', 'Connect Google Forms', 'jos-btn jos-btn-sm') +
      '</div>';

    root.innerHTML =
      '<div class="jos-page jos-leads-page">' +
      '<div class="jos-page-head"><div><h1>Leads</h1><p>Capture, qualify, quote, and convert inbound interest.</p></div>' +
      '<div class="jos-page-actions">' +
        btn('leads-filter-open', 'Filters', 'jos-btn jos-btn-sm') +
        btn('leads-add-open', 'Add Lead', 'jos-btn-brand jos-btn-sm') +
        btn('go-ask', 'Ask Hubly', 'jos-btn jos-btn-sm') +
      '</div></div>' +
      tabsHtml +
      '<div class="jos-leads-toolbar">' +
        '<label class="jos-leads-search"><input id="jos-leads-search" type="search" placeholder="Search name, phone, email, vehicle, property, service, source, notes, conversation…" value="' + esc(root._josLeadsQ || '') + '"></label>' +
      '</div>' +
      renderLeadsFilterDrawer(root) +
      integCtas +
      '<div class="jos-split jos-leads-layout">' +
        '<div class="jos-stack jos-leads-list">' + listHtml + '</div>' +
        '<div class="jos-leads-main">' + renderLeadWorkspace(root, sel, ws) + '</div>' +
        '<div class="jos-stack">' + renderLeadSidebar(sel) + '</div>' +
      '</div>' +
      renderLeadsAddModal(root) +
      renderLeadsContextMenu(root) +
      '</div>';

    bindRoot(root);
    wireLeadsRoot(root);
    try {
      var badge = el('nav-leads-badge');
      if (badge) {
        var n = all.filter(function (l) { return (l.unread > 0 || l.aiQualified) && !/lost|spam|archived|duplicate/.test(l.osStage || ''); }).length;
        badge.textContent = String(n);
        badge.classList.toggle('hidden', !n);
      }
    } catch (e) {}
  }

  function readLeadAddDraft() {
    return {
      name: (el('jos-la-name') || {}).value || '',
      phone: (el('jos-la-phone') || {}).value || '',
      email: (el('jos-la-email') || {}).value || '',
      address: (el('jos-la-address') || {}).value || '',
      vehicle: (el('jos-la-vehicle') || {}).value || '',
      service: (el('jos-la-service') || {}).value || '',
      source: (el('jos-la-source') || {}).value || 'manual',
      assignedTo: (el('jos-la-assigned') || {}).value || '',
      notes: (el('jos-la-notes') || {}).value || '',
      tags: (el('jos-la-tags') || {}).value || ''
    };
  }

  function saveNewLead(andQuote) {
    var root = el('jos-leads-root');
    var d = readLeadAddDraft();
    if (!String(d.name || '').trim()) { toast('Name is required'); return; }
    ensureLeadsOsState();
    var st = S();
    var id = 'lead_' + Date.now();
    var lead = {
      id: id, key: id, name: d.name.trim(), phone: d.phone, email: d.email, address: d.address,
      vehicle: d.vehicle, property: d.address, service: d.service, source: d.source,
      assignedTo: d.assignedTo, notes: d.notes, notesList: d.notes ? [d.notes] : [],
      tags: String(d.tags || '').split(/[,\s]+/).filter(Boolean),
      stage: 'new', osStage: 'new', status: 'new', createdAt: new Date().toISOString(),
      lastContacted: new Date().toISOString(), lastMessage: d.notes || 'Manual lead created',
      aiScore: 50, aiQualified: false, unread: 0, quoteStatus: 'none', estimatedValue: 0,
      messages: [], tasks: [], files: [], activity: [{ type: 'created', label: 'Manual lead created', at: new Date().toLocaleString() }],
      estimate: { labor: 0, materials: 0, total: 0, notes: '' }, buyingIntent: 'med'
    };
    st.pipeline.manual.unshift(lead);
    root._josLeadAddOpen = false;
    root._josLeadDraft = null;
    root._josLeadId = id;
    root._josLeadsTab = 'new';
    if (andQuote) {
      lead.quote = { id: 'q_' + id, amount: 0, status: 'draft', packageName: lead.service || 'Service', sentAt: todayStr() };
      lead.quoteStatus = 'draft';
      lead.stage = 'quote_sent';
      lead.osStage = 'quote_sent';
      lead.status = 'quoted';
      pushLeadActivity(lead, 'quote', 'Draft quote created');
      root._josLeadWorkspace = 'quote';
      root._josLeadsTab = 'quotes';
      toast('Lead saved · draft quote ready');
    } else toast('Lead saved');
    renderLeads();
  }

  function wireLeadsRoot(root) {
    if (root._josLeadsBound) return;
    root._josLeadsBound = true;

    root.addEventListener('click', function (e) {
      var tabBtn = e.target.closest('[data-jos-leads-tab]');
      if (tabBtn) {
        root._josLeadsTab = tabBtn.getAttribute('data-jos-leads-tab');
        root._josLeadCtx = null;
        renderLeads();
        e.stopPropagation();
        return;
      }
      var wsBtn = e.target.closest('[data-jos-lead-ws]');
      if (wsBtn) {
        root._josLeadWorkspace = wsBtn.getAttribute('data-jos-lead-ws');
        renderLeads();
        e.stopPropagation();
        return;
      }
      var card = e.target.closest('[data-jos-lead-id]');
      if (card && !e.target.closest('[data-jos-act]')) {
        root._josLeadId = card.getAttribute('data-jos-lead-id');
        root._josLeadWorkspace = 'overview';
        root._josLeadCtx = null;
        var lead = findLead(root._josLeadId);
        if (lead) lead.unread = 0;
        renderLeads();
        e.stopPropagation();
      }
    });

    root.addEventListener('dblclick', function (e) {
      var card = e.target.closest('[data-jos-lead-id]');
      if (!card) return;
      var id = card.getAttribute('data-jos-lead-id');
      root._josLeadId = id;
      var lead = findLead(id);
      if (lead && typeof global.viewLead === 'function') {
        try { global.viewLead(lead.key || lead.id); }
        catch (err) { toast('Open profile · ' + (lead.name || 'Lead')); }
      } else toast('Lead profile · ' + ((lead && lead.name) || 'Lead'));
      e.preventDefault();
    });

    root.addEventListener('contextmenu', function (e) {
      var card = e.target.closest('.jos-leads-card[data-jos-lead-id]');
      if (!card) return;
      e.preventDefault();
      root._josLeadId = card.getAttribute('data-jos-lead-id');
      var rect = root.getBoundingClientRect();
      root._josLeadCtx = { open: true, x: Math.max(8, e.clientX - rect.left), y: Math.max(8, e.clientY - rect.top) };
      renderLeads();
    });

    root.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'jos-leads-search') {
        root._josLeadsQ = e.target.value;
        clearTimeout(root._josLeadsSearchT);
        root._josLeadsSearchT = setTimeout(function () { renderLeads(); }, 140);
      }
      if (e.target && e.target.id === 'jos-leads-reply') root._josLeadDraftMsg = e.target.value;
    });

    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (root._josLeadAddOpen) { root._josLeadAddOpen = false; renderLeads(); return; }
        if (root._josLeadFilterOpen) { root._josLeadFilterOpen = false; renderLeads(); return; }
        if (root._josLeadCtx && root._josLeadCtx.open) { root._josLeadCtx = null; renderLeads(); return; }
        if (root._josLeadsQ) {
          root._josLeadsQ = '';
          var inp = el('jos-leads-search');
          if (inp) inp.value = '';
          renderLeads();
        }
      }
    });
  }

  function selectedLead() {
    var root = el('jos-leads-root');
    if (!root || !root._josLeadId) return null;
    return findLead(root._josLeadId);
  }

  function mutateLead(mutator) {
    var root = el('jos-leads-root');
    var lead = selectedLead();
    if (!lead) return null;
    ensureLeadsOsState();
    mutator(lead);
    if (root) renderLeads();
    return lead;
  }

  function handleLeadsAct(act, t) {
    var root = el('jos-leads-root');
    if (!root) return;
    ensureLeadsOsState();
    var lead = selectedLead();
    root._josLeadCtx = null;

    try {
      if (act === 'leads-filter-open') { root._josLeadFilterOpen = true; return renderLeads(); }
      if (act === 'leads-filter-close') { root._josLeadFilterOpen = false; return renderLeads(); }
      if (act === 'leads-filter-apply') {
        root._josLeadFilters = {
          status: (el('jos-lf-status') || {}).value || 'all',
          source: (el('jos-lf-source') || {}).value || 'all',
          assigned: (el('jos-lf-assigned') || {}).value || 'all',
          service: (el('jos-lf-service') || {}).value || 'all',
          vehicle: (el('jos-lf-vehicle') || {}).value || '',
          property: (el('jos-lf-property') || {}).value || '',
          aiScore: (el('jos-lf-aiscore') || {}).value || 'all',
          tags: (el('jos-lf-tags') || {}).value || '',
          created: (el('jos-lf-created') || {}).value || 'all',
          lastContacted: (el('jos-lf-contacted') || {}).value || 'all',
          pipeline: (el('jos-lf-pipeline') || {}).value || 'all',
          quoteStatus: (el('jos-lf-quote') || {}).value || 'all',
          valueMin: (el('jos-lf-vmin') || {}).value || '',
          valueMax: (el('jos-lf-vmax') || {}).value || ''
        };
        root._josLeadFilterOpen = false;
        toast('Filters applied');
        return renderLeads();
      }
      if (act === 'leads-filter-reset') {
        root._josLeadFilters = {};
        root._josLeadFilterOpen = false;
        toast('Filters reset');
        return renderLeads();
      }
      if (act === 'leads-filter-save') {
        var st = S();
        st.leadsOs = st.leadsOs || { savedFilters: [] };
        var snap = root._josLeadFilters || {};
        st.leadsOs.savedFilters.unshift({ name: 'Saved ' + (st.leadsOs.savedFilters.length + 1), filters: Object.assign({}, snap), at: new Date().toISOString() });
        toast('Filter saved');
        return;
      }
      if (act === 'leads-add-open') { root._josLeadAddOpen = true; root._josLeadDraft = {}; return renderLeads(); }
      if (act === 'leads-add-cancel') { root._josLeadAddOpen = false; return renderLeads(); }
      if (act === 'leads-add-save') return saveNewLead(false);
      if (act === 'leads-add-quote') return saveNewLead(true);

      if (act === 'leads-connect-meta' || act === 'leads-connect-messenger' || act === 'leads-connect-forms') {
        toast('Live sync comes in Stage 2 — CTA only for now');
        return;
      }

      if (!lead && !/^leads-add|^leads-filter|^leads-connect/.test(act)) {
        if (act === 'leads-add-open') return;
        return toast('Select a lead first');
      }

      if (act === 'leads-send') {
        var reply = (el('jos-leads-reply') || {}).value || root._josLeadDraftMsg || '';
        if (!String(reply).trim()) return toast('Type a reply first');
        mutateLead(function (l) {
          l.messages = l.messages || [];
          l.messages.push({ dir: 'out', text: String(reply).trim(), at: 'Just now' });
          l.lastMessage = String(reply).trim();
          l.lastContacted = new Date().toISOString();
          pushLeadActivity(l, 'message', 'Outbound message');
        });
        root._josLeadDraftMsg = '';
        toast('Message sent');
        return;
      }
      if (act === 'leads-call') {
        if (lead && lead.phone) location.href = 'tel:' + String(lead.phone).replace(/\D/g, '');
        else toast('No phone on this lead');
        return;
      }
      if (act === 'leads-sms') {
        if (lead && lead.phone) location.href = 'sms:' + String(lead.phone).replace(/\D/g, '');
        else toast('No phone on this lead');
        return;
      }
      if (act === 'leads-email') {
        if (lead && lead.email) location.href = 'mailto:' + lead.email;
        else toast('No email on this lead');
        return;
      }
      if (act === 'leads-copy') {
        if (!lead) return;
        copyText([lead.name, lead.phone, lead.email].filter(Boolean).join(' · '));
        return;
      }
      if (act === 'leads-assign') {
        var team = S().team || LEADS_TEAM;
        var names = team.map(function (x) { return x.name; });
        var next = names[(names.indexOf(lead.assignedTo) + 1) % names.length] || names[0];
        mutateLead(function (l) {
          l.assignedTo = next;
          pushLeadActivity(l, 'assign', 'Assigned to ' + next);
        });
        toast('Assigned to ' + next);
        return;
      }
      if (act === 'leads-add-tag') {
        var tag = window.prompt('Tag name', 'follow-up');
        if (!tag) return;
        mutateLead(function (l) {
          l.tags = l.tags || [];
          l.tags.push(String(tag).trim());
          pushLeadActivity(l, 'tag', 'Tagged ' + tag);
        });
        return;
      }
      if (act === 'leads-convert-customer') {
        mutateLead(function (l) {
          var st = S();
          st.customers = st.customers || [];
          var exists = st.customers.find(function (c) { return c.phone === l.phone || c.name === l.name; });
          if (!exists) {
            st.customers.unshift({
              id: 'cust_' + (l.id || Date.now()),
              name: l.name, phone: l.phone, email: l.email,
              vehicle: vehicleOf(l), preferredService: l.service, address: l.address
            });
          }
          pushLeadActivity(l, 'convert', 'Converted to customer');
        });
        toast('Converted to customer');
        return;
      }
      if (act === 'leads-convert-job') {
        mutateLead(function (l) {
          var st = S();
          st.jobs = st.jobs || [];
          st.jobs.unshift({
            id: 'job_from_' + (l.id || Date.now()),
            customer: l.name, phone: l.phone, service: l.service || 'Detail',
            vehicle: vehicleOf(l), address: l.address || (S().city || 'San Diego, CA'),
            date: todayStr(), time: '10:00 AM', status: 'scheduled',
            amount: l.estimatedValue || l.amount || 0, assignedTo: l.assignedTo
          });
          l.stage = 'won';
          l.osStage = 'archived';
          l.status = 'archived';
          pushLeadActivity(l, 'convert', 'Converted to job');
        });
        toast('Converted to job');
        return;
      }
      if (act === 'leads-create-quote') {
        mutateLead(function (l) {
          var amt = parseFloat(l.estimatedValue || l.amount) || 250;
          l.quote = { id: 'q_' + (l.id || Date.now()), amount: amt, status: 'sent', packageName: l.service || 'Service', sentAt: todayStr() };
          l.quoteStatus = 'sent';
          l.stage = 'quote_sent';
          l.osStage = 'quote_sent';
          l.status = 'quoted';
          l.amount = amt;
          pushLeadActivity(l, 'quote', 'Quote created · ' + money(amt));
        });
        root._josLeadWorkspace = 'quote';
        toast('Quote created');
        return renderLeads();
      }
      if (act === 'leads-followup') {
        mutateLead(function (l) {
          var when = new Date();
          when.setDate(when.getDate() + 1);
          l.followUpAt = when.toISOString().slice(0, 10) + ' 10:00';
          l.tasks = l.tasks || [];
          l.tasks.unshift({ id: 't_fu_' + Date.now(), label: 'Follow up ' + l.followUpAt, done: false });
          pushLeadActivity(l, 'followup', 'Follow-up scheduled');
        });
        toast('Follow-up scheduled');
        return;
      }
      if (act === 'leads-request-photos') {
        mutateLead(function (l) {
          l.stage = 'waiting_photos';
          l.osStage = 'waiting_photos';
          l.status = 'waiting';
          l.waitingReason = 'photos';
          l.messages = l.messages || [];
          l.messages.push({ dir: 'out', text: 'Could you send a few photos of the vehicle?', at: 'Just now' });
          l.lastMessage = 'Could you send a few photos of the vehicle?';
          pushLeadActivity(l, 'photos', 'Requested photos');
        });
        toast('Photo request sent');
        return;
      }
      if (act === 'leads-payment-link') {
        mutateLead(function (l) {
          l.stage = 'waiting_payment';
          l.osStage = 'waiting_payment';
          l.status = 'waiting';
          l.waitingReason = 'payment';
          l.files = l.files || [];
          l.files.push({ name: 'payment-link.pdf', kind: 'pdf' });
          pushLeadActivity(l, 'payment', 'Payment link sent');
        });
        toast('Payment link sent (OS)');
        return;
      }
      if (act === 'leads-review-request') {
        mutateLead(function (l) {
          l.messages = l.messages || [];
          l.messages.push({ dir: 'out', text: 'If you have a minute, a quick review would mean a lot!', at: 'Just now' });
          l.lastMessage = 'Review request sent';
          pushLeadActivity(l, 'review', 'Review request sent');
        });
        toast('Review request sent');
        return;
      }
      if (act === 'leads-archive') {
        mutateLead(function (l) {
          l.stage = 'archived';
          l.osStage = 'archived';
          l.status = 'archived';
          l.archived = true;
          pushLeadActivity(l, 'archive', 'Archived');
        });
        toast('Lead archived');
        return;
      }
      if (act === 'leads-delete') {
        if (!window.confirm('Delete this lead?')) return;
        mutateLead(function (l) {
          l.deleted = true;
          var st = S();
          if (st.pipeline && Array.isArray(st.pipeline.manual)) {
            st.pipeline.manual = st.pipeline.manual.filter(function (x) { return String(x.id) !== String(l.id); });
            st.pipeline.deleted = st.pipeline.deleted || [];
            st.pipeline.deleted.push(l.id || l.key);
          }
        });
        root._josLeadId = null;
        toast('Lead deleted');
        return renderLeads();
      }
      if (act === 'leads-duplicate') {
        ensureLeadsOsState();
        var st2 = S();
        var copy = Object.assign({}, lead, {
          id: 'lead_copy_' + Date.now(),
          key: null,
          name: (lead.name || 'Lead') + ' (copy)',
          stage: 'new',
          osStage: 'new',
          status: 'new',
          createdAt: new Date().toISOString(),
          activity: [{ type: 'created', label: 'Duplicated lead', at: new Date().toLocaleString() }]
        });
        copy.key = copy.id;
        st2.pipeline.manual.unshift(copy);
        root._josLeadId = copy.id;
        toast('Lead duplicated');
        return renderLeads();
      }
      if (act === 'leads-note-add' || act === 'leads-side-note') {
        var noteEl = act === 'leads-side-note' ? el('jos-leads-side-note') : el('jos-leads-note-new');
        var note = noteEl ? noteEl.value : '';
        if (!String(note || '').trim()) return toast('Type a note');
        mutateLead(function (l) {
          l.notesList = l.notesList || [];
          l.notesList.unshift(String(note).trim());
          pushLeadActivity(l, 'note', 'Note added');
        });
        return;
      }
      if (act === 'leads-task-add') {
        var taskEl = el('jos-leads-task-new');
        var task = taskEl ? taskEl.value : '';
        if (!String(task || '').trim()) return toast('Type a task');
        mutateLead(function (l) {
          l.tasks = l.tasks || [];
          l.tasks.unshift({ id: 't_' + Date.now(), label: String(task).trim(), done: false });
          pushLeadActivity(l, 'task', 'Task added');
        });
        return;
      }
      if (act === 'leads-task-toggle') {
        var ti = parseInt(t && t.getAttribute('data-jos-task-i'), 10);
        mutateLead(function (l) {
          if (l.tasks && l.tasks[ti]) l.tasks[ti].done = !l.tasks[ti].done;
        });
        return;
      }
      if (act === 'leads-file-add') {
        mutateLead(function (l) {
          l.files = l.files || [];
          l.files.push({ name: 'attachment-' + (l.files.length + 1) + '.jpg', kind: 'image' });
          pushLeadActivity(l, 'file', 'File attached');
        });
        toast('File added (OS placeholder)');
        return;
      }
      if (act === 'leads-file-del') {
        var fi = parseInt(t && t.getAttribute('data-jos-file-i'), 10);
        mutateLead(function (l) {
          if (l.files) l.files.splice(fi, 1);
        });
        return;
      }
      if (act === 'leads-est-save') {
        var notesEst = (el('jos-leads-est-notes') || {}).value || '';
        mutateLead(function (l) {
          l.estimate = l.estimate || { labor: 0, materials: 0, total: 0 };
          l.estimate.notes = notesEst;
          pushLeadActivity(l, 'estimate', 'Estimate saved');
        });
        toast('Estimate saved');
        return;
      }
      if (act === 'leads-est-print' || act === 'leads-quote-print') {
        toast('Print placeholder — ready for Stage 2');
        return;
      }
      if (act === 'leads-quote-share') {
        toast('Share placeholder — copy link in Stage 2');
        return;
      }
      if (act === 'leads-quote-email') {
        toast('Email send placeholder — not claiming connected');
        return;
      }
      if (act === 'leads-recalc-score') {
        mutateLead(function (l) {
          var score = 40;
          if (l.messages && l.messages.length) score += Math.min(20, l.messages.length * 4);
          if (l.quoteStatus && l.quoteStatus !== 'none') score += 15;
          if (l.estimatedValue >= 400) score += 15;
          if (l.unread) score += 5;
          if (l.spam) score = 5;
          if (l.duplicateOf) score = Math.min(score, 50);
          l.aiScore = Math.max(5, Math.min(99, score));
          l.aiQualified = l.aiScore >= 70;
          l.buyingIntent = l.aiScore >= 80 ? 'high' : (l.aiScore >= 55 ? 'med' : 'low');
          pushLeadActivity(l, 'ai', 'Score recalculated · ' + l.aiScore);
        });
        toast('Lead score recalculated');
        return;
      }
      if (act === 'leads-ai-summary') return ask('Summarize lead ' + (lead && lead.name) + ' and recommend next action');
      if (act === 'leads-ai-followup') return ask('Recommend the best follow-up message for lead ' + (lead && lead.name));
      if (act === 'leads-ai-intent') return ask('What is the buying intent for lead ' + (lead && lead.name) + '?');
      if (act === 'leads-ai-conv-summary') return ask('Summarize the conversation with ' + (lead && lead.name));
      if (act === 'leads-ai-suggest-quote') return ask('Suggest a quote package and price for ' + (lead && lead.name) + ' interested in ' + (lead && lead.service));
      if (act === 'leads-ai-membership') return ask('Suggest a membership plan for lead ' + (lead && lead.name));
      if (act === 'leads-ai-reminder') return ask('Create a follow-up reminder plan for ' + (lead && lead.name));
      if (act === 'leads-ai-dup') {
        mutateLead(function (l) {
          var others = leadsOsList().filter(function (x) {
            return String(x.id) !== String(l.id) && (
              (l.phone && x.phone === l.phone) ||
              (l.email && x.email === l.email) ||
              (l.name && x.name && x.name.toLowerCase() === l.name.toLowerCase())
            );
          });
          if (others.length) {
            l.duplicateOf = others[0].id || others[0].key;
            pushLeadActivity(l, 'duplicate', 'Possible duplicate of ' + (others[0].name || 'another lead'));
            toast('Possible duplicate found');
          } else {
            pushLeadActivity(l, 'duplicate', 'No duplicates found');
            toast('No duplicates found');
          }
        });
        return;
      }
      if (act === 'leads-ai-spam') {
        mutateLead(function (l) {
          var blob = [l.name, l.email, l.lastMessage, l.notes].join(' ').toLowerCase();
          var spammy = /seo|crypto|bot|buy cheap|viagra|casino/.test(blob) || (l.aiScore || 0) < 15;
          l.spam = spammy;
          if (spammy) {
            l.stage = 'spam';
            l.osStage = 'spam';
            l.status = 'spam';
            pushLeadActivity(l, 'spam', 'Flagged as spam');
            toast('Flagged as spam');
          } else {
            pushLeadActivity(l, 'spam', 'Not spam');
            toast('Looks legitimate');
          }
        });
        return;
      }
    } catch (err) {
      console.warn('Leads action failed', err);
      toast('Failed to update — try again');
    }
  }

  function renderLeadsList() {
    return renderLeads();
  }

  var CUST_TABS = [
    ['all', 'All Customers'],
    ['memberships', 'Memberships'],
    ['vehicles', 'Vehicles / Properties'],
    ['segments', 'Segments'],
    ['favorites', 'Favorites']
  ];
  var CUST_SEGMENTS = [
    ['vip', 'VIP'],
    ['high_ltv', 'High LTV'],
    ['new', 'New'],
    ['at_risk', 'At Risk'],
    ['seasonal', 'Seasonal'],
    ['repeat', 'Repeat']
  ];
  var CUST_PERM_ROLES = [
    { role: 'Owner', view: '✅', edit: '✅', book: '✅', archive: '✅', assign: '✅' },
    { role: 'Manager', view: '✅', edit: '✅', book: '✅', archive: '✅', assign: '✅' },
    { role: 'Office', view: '✅', edit: '✅', book: '✅', archive: '—', assign: '✅' },
    { role: 'Sales', view: '✅', edit: '✅', book: '✅', archive: '—', assign: '—' },
    { role: 'Read Only', view: '✅', edit: '—', book: '—', archive: '—', assign: '—' }
  ];

  function ensureCustomersOsState() {
    var st = S();
    if (!Array.isArray(st.customers)) st.customers = [];
    if (!Array.isArray(st.team) || !st.team.length) {
      st.team = [
        { id: 'tech_adrian', name: 'Adrian Lopez', role: 'Owner' },
        { id: 'tech_maya', name: 'Maya Chen', role: 'Technician' },
        { id: 'tech_luis', name: 'Luis Ortega', role: 'Technician' }
      ];
    }
    if (!st.customersOs) st.customersOs = { savedFilters: [], role: 'Owner' };
    if (!Array.isArray(st.customersOs.savedFilters)) st.customersOs.savedFilters = [];
    if (!st.customers.length) {
      st.customers = [
        { id: 'demo_c1', name: 'Sarah Johnson', phone: '(512) 555-0198', email: 'sarah.johnson@gmail.com', vehicle: 'Tesla Model Y', customerType: 'recurring', statusOverride: 'vip', preferredService: 'Ceramic Coating', city: 'Austin', favorite: true, tags: ['VIP', 'Member'] },
        { id: 'demo_c2', name: 'Mike Brown', phone: '(512) 555-0142', email: 'mike.brown@email.com', vehicle: 'BMW X5', preferredService: 'Interior Detail', city: 'Austin', tags: ['Interior'] },
        { id: 'demo_c3', name: 'Emily Smith', phone: '(512) 555-0177', email: 'emily.s@email.com', vehicle: 'Audi Q5', preferredService: 'Full Detail', city: 'Austin', tags: ['Reviewer'], favorite: true }
      ];
    }
    var team = st.team;
    st.customers.forEach(function (c, idx) {
      if (!c.id) c.id = 'cust_auto_' + idx;
      if (!c.status) c.status = c.archived ? 'inactive' : 'active';
      if (c.favorite == null) c.favorite = !!(c.statusOverride === 'vip' || c.isVip);
      if (!Array.isArray(c.tags)) c.tags = c.tags ? String(c.tags).split(/[,\s]+/).filter(Boolean) : [];
      if (c.statusOverride === 'vip' && c.tags.indexOf('VIP') < 0) c.tags.push('VIP');
      if (!c.membership) {
        c.membership = c.customerType === 'recurring' ? (c.preferredService ? c.preferredService + ' Plan' : 'Monthly Plan') : '';
      }
      if (!Array.isArray(c.vehicles)) {
        c.vehicles = c.vehicle ? [{ label: String(c.vehicle), type: '' }] : [];
      }
      if (!c.vehicle && c.vehicles[0]) c.vehicle = c.vehicles[0].label || c.vehicles[0].name || '';
      if (!c.city) {
        var addr = String(c.address || '');
        var m = addr.match(/,\s*([^,]+),\s*[A-Z]{2}\b/) || addr.match(/,\s*([^,]+)$/);
        c.city = m ? m[1].trim() : (st.city || '');
      }
      if (!c.assignedTo) c.assignedTo = (team[idx % team.length] || team[0]).name;
      if (c.aiScore == null) {
        var base = 50 + (c.customerType === 'recurring' ? 20 : 0) + (c.favorite ? 8 : 0);
        c.aiScore = Math.max(5, Math.min(99, base + (idx % 19)));
      }
      if (c.unread == null) c.unread = 0;
      if (!Array.isArray(c.notesList)) c.notesList = c.notes ? [String(c.notes)] : [];
      if (!Array.isArray(c.documents)) c.documents = [];
      if (!Array.isArray(c.photos)) c.photos = [];
      if (!Array.isArray(c.payments)) c.payments = [];
      if (!c.property) c.property = '';
      if (!Array.isArray(c.activity) || !c.activity.length) {
        c.activity = [{ type: 'created', label: 'Customer record created', at: String(c.createdAt || todayStr()).slice(0, 16).replace('T', ' ') }];
      }
      if (c.lifetimeValue == null) {
        var done = custJobsFor(c).filter(function (j) { return j.status === 'completed'; });
        c.lifetimeValue = done.reduce(function (s, j) { return s + (parseFloat(j.amount) || 0); }, 0);
        if (!c.lifetimeValue && c.payments && c.payments.length) {
          c.lifetimeValue = c.payments.reduce(function (s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
        }
      }
    });
    return st;
  }

  function customersOsList() {
    ensureCustomersOsState();
    return customers().filter(function (c) { return !c.deleted; });
  }

  function findCustomer(id) {
    return customersOsList().find(function (c) { return String(c.id) === String(id); }) || null;
  }

  function custIsVip(c) {
    return !!(c.statusOverride === 'vip' || c.isVip || (c.tags || []).some(function (t) { return /vip/i.test(String(t)); }));
  }

  function custIsMember(c) {
    return c.customerType === 'recurring' || !!(c.membership && String(c.membership).trim());
  }

  function custSegmentOf(c) {
    var done = custJobsFor(c).filter(function (j) { return j.status === 'completed'; });
    var ltv = custLifetime(c);
    var created = String(c.createdAt || '').slice(0, 10);
    var daysNew = todayStr();
    try {
      var d = new Date(todayStr() + 'T12:00:00');
      d.setDate(d.getDate() - 30);
      daysNew = d.toISOString().slice(0, 10);
    } catch (e) {}
    if (custIsVip(c)) return 'vip';
    if (ltv >= 500 || done.length >= 4) return 'high_ltv';
    if (created && created >= daysNew) return 'new';
    if ((c.aiScore != null && c.aiScore < 45) || /at.?risk|abandoned/i.test((c.tags || []).join(' '))) return 'at_risk';
    if (/seasonal/i.test((c.tags || []).join(' ')) || c.seasonal) return 'seasonal';
    if (done.length >= 2) return 'repeat';
    return 'new';
  }

  function custLifetime(c) {
    if (c && c.lifetimeValue != null && c.lifetimeValue > 0) return Number(c.lifetimeValue) || 0;
    var done = custJobsFor(c).filter(function (j) { return j.status === 'completed'; });
    var fromJobs = done.reduce(function (s, j) { return s + (parseFloat(j.amount) || 0); }, 0);
    if (fromJobs) return fromJobs;
    return (c.payments || []).reduce(function (s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
  }

  function custMatchesTab(c, tab, segment) {
    if (tab === 'memberships') return custIsMember(c);
    if (tab === 'vehicles') return !!(c.vehicle || (c.vehicles && c.vehicles.length) || c.property);
    if (tab === 'favorites') return !!c.favorite;
    if (tab === 'segments') {
      var seg = segment || 'vip';
      return custSegmentOf(c) === seg || (seg === 'vip' && custIsVip(c));
    }
    return true;
  }

  function custMatchesFilters(c, root) {
    var f = root._josCustFilters || {};
    if (f.active === 'active' && c.status === 'inactive') return false;
    if (f.active === 'inactive' && c.status !== 'inactive') return false;
    if (f.membership === 'yes' && !custIsMember(c)) return false;
    if (f.membership === 'no' && custIsMember(c)) return false;
    if (f.ltv === 'high' && !(custLifetime(c) >= 500)) return false;
    if (f.ltv === 'med' && !(custLifetime(c) >= 200 && custLifetime(c) < 500)) return false;
    if (f.ltv === 'low' && !(custLifetime(c) < 200)) return false;
    if (f.lastJob && f.lastJob !== 'all') {
      var last = lastJob(c);
      var ld = last && last.date ? String(last.date).slice(0, 10) : '';
      if (f.lastJob === 'none' && ld) return false;
      if (f.lastJob === '30') {
        var cut30 = todayStr();
        try {
          var d30 = new Date(todayStr() + 'T12:00:00');
          d30.setDate(d30.getDate() - 30);
          cut30 = d30.toISOString().slice(0, 10);
        } catch (e) {}
        if (!ld || ld < cut30) return false;
      }
      if (f.lastJob === 'stale') {
        var cut90 = todayStr();
        try {
          var d90 = new Date(todayStr() + 'T12:00:00');
          d90.setDate(d90.getDate() - 90);
          cut90 = d90.toISOString().slice(0, 10);
        } catch (e2) {}
        if (ld && ld >= cut90) return false;
      }
    }
    if (f.city && f.city !== 'all' && String(c.city || '') !== f.city) return false;
    if (f.assigned && f.assigned !== 'all' && c.assignedTo !== f.assigned) return false;
    if (f.service && f.service !== 'all' && String(c.preferredService || '') !== f.service) return false;
    if (f.vehicle && String(c.vehicle || vehicleOf(c) || '').toLowerCase().indexOf(String(f.vehicle).toLowerCase()) < 0) return false;
    if (f.tags && String(f.tags).trim()) {
      var want = String(f.tags).toLowerCase().split(/[,\s]+/).filter(Boolean);
      var have = (c.tags || []).map(function (t) { return String(t).toLowerCase(); });
      if (!want.every(function (w) { return have.some(function (h) { return h.indexOf(w) >= 0; }); })) return false;
    }
    return true;
  }

  function custSearchHay(c) {
    var veh = (c.vehicles || []).map(function (v) { return v.label || v.name || v; }).join(' ');
    return [
      c.name, c.phone, c.email, c.address, c.city, c.vehicle, veh, c.property,
      c.membership, (c.tags || []).join(' '), c.notes, (c.notesList || []).join(' '),
      c.preferredService, c.assignedTo
    ].join(' ').toLowerCase();
  }

  function filterCustomersList(root) {
    var tab = root._josCustTab || 'all';
    var seg = root._josCustSegment || 'vip';
    var q = String(root._josCustQ || '').trim().toLowerCase();
    var list = customersOsList().filter(function (c) { return custMatchesTab(c, tab, seg); });
    list = list.filter(function (c) { return custMatchesFilters(c, root); });
    if (q) list = list.filter(function (c) { return custSearchHay(c).indexOf(q) > -1; });
    return list.slice().sort(function (a, b) {
      return custLifetime(b) - custLifetime(a) || String(a.name || '').localeCompare(String(b.name || ''));
    });
  }

  function uniqueCustValues(field) {
    var set = {};
    customersOsList().forEach(function (c) {
      var v = field === 'service' ? c.preferredService : c[field];
      if (v) set[String(v)] = true;
    });
    return Object.keys(set).sort();
  }

  function renderCustomersFilterDrawer(root) {
    var f = root._josCustFilters || {};
    if (!root._josCustFilterOpen) return '';
    function opt(list, cur, allLabel) {
      return '<option value="all"' + (!cur || cur === 'all' ? ' selected' : '') + '>' + (allLabel || 'All') + '</option>' +
        list.map(function (v) {
          return '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(v) + '</option>';
        }).join('');
    }
    return '<div class="jos-cust-drawer" id="jos-cust-drawer">' +
      '<div class="jos-between"><div class="jos-kicker">Filters</div><button type="button" class="jos-btn jos-btn-sm" data-jos-act="cust-filter-close">Close</button></div>' +
      '<div class="jos-cust-filter-grid">' +
      '<label>Status<select id="jos-cf-active">' + opt(['active', 'inactive'], f.active, 'Any') + '</select></label>' +
      '<label>Membership<select id="jos-cf-membership">' + opt(['yes', 'no'], f.membership, 'Any') + '</select></label>' +
      '<label>Lifetime Value<select id="jos-cf-ltv">' + opt(['high', 'med', 'low'], f.ltv, 'Any') + '</select></label>' +
      '<label>Last Job<select id="jos-cf-lastjob">' + opt(['30', 'stale', 'none'], f.lastJob, 'Any') + '</select></label>' +
      '<label>City<select id="jos-cf-city">' + opt(uniqueCustValues('city'), f.city) + '</select></label>' +
      '<label>Assigned Employee<select id="jos-cf-assigned">' + opt(uniqueCustValues('assignedTo'), f.assigned, 'Anyone') + '</select></label>' +
      '<label>Service<select id="jos-cf-service">' + opt(uniqueCustValues('service'), f.service) + '</select></label>' +
      '<label>Vehicle<input id="jos-cf-vehicle" type="text" value="' + esc(f.vehicle || '') + '" placeholder="Vehicle…"></label>' +
      '<label>Tags<input id="jos-cf-tags" type="text" value="' + esc(f.tags || '') + '" placeholder="VIP, Member"></label>' +
      '</div>' +
      '<div class="jos-btn-row jos-mt">' +
      btn('cust-filter-apply', 'Apply', 'jos-btn-brand jos-btn-sm') +
      btn('cust-filter-reset', 'Reset', 'jos-btn jos-btn-sm') +
      btn('cust-filter-save', 'Save Filter', 'jos-btn jos-btn-sm') +
      '</div></div>';
  }

  function renderCustomersAddModal(root) {
    if (!root._josCustAddOpen) return '';
    var d = root._josCustDraft || {};
    var team = S().team || [];
    return '<div class="jos-cust-modal-backdrop" data-jos-act="cust-add-cancel">' +
      '<div class="jos-cust-modal" onclick="event.stopPropagation()">' +
      '<div class="jos-between"><h3 style="margin:0">Add Customer</h3><button type="button" class="jos-btn jos-btn-sm" data-jos-act="cust-add-cancel">✕</button></div>' +
      '<div class="jos-cust-form">' +
      '<label>Name<input id="jos-ca-name" value="' + esc(d.name || '') + '" placeholder="Full name"></label>' +
      '<label>Phone<input id="jos-ca-phone" value="' + esc(d.phone || '') + '" placeholder="(619) 555-0100"></label>' +
      '<label>Email<input id="jos-ca-email" value="' + esc(d.email || '') + '" placeholder="name@email.com"></label>' +
      '<label>Address<input id="jos-ca-address" value="' + esc(d.address || '') + '" placeholder="Service address"></label>' +
      '<label>Vehicle / Property<input id="jos-ca-vehicle" value="' + esc(d.vehicle || '') + '" placeholder="Vehicle or property"></label>' +
      '<label>Tags<input id="jos-ca-tags" value="' + esc(d.tags || '') + '" placeholder="VIP, Member"></label>' +
      '<label>Membership<select id="jos-ca-membership">' +
        [['', 'None'], ['Monthly Interior', 'Monthly Interior'], ['Monthly Exterior', 'Monthly Exterior'], ['Annual Ceramic', 'Annual Ceramic']].map(function (s) {
          return '<option value="' + esc(s[0]) + '"' + ((d.membership || '') === s[0] ? ' selected' : '') + '>' + esc(s[1]) + '</option>';
        }).join('') +
      '</select></label>' +
      '<label>Assigned<select id="jos-ca-assigned">' +
        team.map(function (t) {
          return '<option value="' + esc(t.name) + '"' + ((d.assignedTo || (team[0] && team[0].name)) === t.name ? ' selected' : '') + '>' + esc(t.name) + '</option>';
        }).join('') +
      '</select></label>' +
      '<label class="jos-cust-span2">Notes<textarea id="jos-ca-notes" class="jos-textarea" placeholder="Notes…">' + esc(d.notes || '') + '</textarea></label>' +
      '</div>' +
      '<div class="jos-btn-row jos-mt">' +
      btn('cust-add-cancel', 'Cancel', 'jos-btn jos-btn-sm') +
      btn('cust-add-save', 'Save', 'jos-btn-brand jos-btn-sm') +
      '</div></div></div>';
  }

  function renderCustomerCard(c, selectedId) {
    var on = selectedId && String(c.id) === String(selectedId);
    var last = lastJob(c);
    var ltv = custLifetime(c);
    var member = custIsMember(c);
    return '<button type="button" class="jos-list-card jos-cust-card' + (on ? ' on' : '') + '" data-jos-cust-row="' + esc(String(c.id)) + '">' +
      '<div class="jos-between">' +
        '<div class="jos-px-person"><div class="jos-px-av">' + esc(initials(c.name)) + '</div><div><strong class="t">' + esc(c.name || 'Customer') +
        (c.favorite ? ' ★' : '') + '</strong>' +
        '<div class="s">' + esc(c.phone || c.email || '—') + '</div></div></div>' +
        '<div class="jos-cust-card-ltv">' + esc(money(ltv) || '$0') + '</div>' +
      '</div>' +
      '<div class="meta">' +
        (member ? '<span class="jos-pill ok">' + esc(c.membership || 'Member') + '</span>' : '') +
        (custIsVip(c) ? '<span class="jos-pill hot">VIP</span>' : '') +
        '<span class="jos-pill info">AI ' + esc(String(c.aiScore || 0)) + '</span>' +
        (c.unread ? '<span class="jos-pill hot">' + c.unread + ' new</span>' : '') +
        ((c.tags || []).slice(0, 3).map(function (t) { return '<span class="jos-tag">' + esc(t) + '</span>'; }).join('')) +
      '</div>' +
      '<div class="s jos-cust-last">Last job · ' + esc(last && last.date ? dateLong(last.date) : 'None') +
        (c.assignedTo ? ' · ' + esc(c.assignedTo) : '') + '</div></button>';
  }

  function custAiInsights(c) {
    var done = custJobsFor(c).filter(function (j) { return j.status === 'completed'; });
    var booked = custJobsFor(c).filter(function (j) { return j.status !== 'completed' && j.status !== 'cancelled'; });
    var ltv = custLifetime(c);
    var churn = Math.max(8, Math.min(92, 100 - (c.aiScore || 50) + (done.length ? 0 : 15)));
    var upsell = c.customerType === 'recurring' ? 'Offer annual ceramic refresh add-on' : 'Offer membership after next completed visit';
    var nba = booked.length ? 'Confirm upcoming visit 24h ahead' : (c.unread ? 'Reply to unread messages' : 'Send a rebook nudge');
    var memSug = custIsMember(c) ? (c.membership || 'Keep current plan') : 'Monthly Interior · best fit from visit pattern';
    var forecast = Math.round(ltv * 0.35 + (custIsMember(c) ? 400 : 120));
    var reviewOdds = done.length >= 2 || /review/i.test((c.tags || []).join(' ')) ? 78 : (done.length ? 55 : 28);
    return {
      summary: aiCustomerSummary(c, done, booked),
      churn: churn,
      upsell: upsell,
      nba: nba,
      membership: memSug,
      forecast: forecast,
      reviewOdds: reviewOdds
    };
  }

  function renderCustomerWorkspace(root, c) {
    if (!c) return '<div class="jos-empty">Select a customer to open the workspace. Click a card to open the golden profile.</div>';
    var last = lastJob(c);
    var next = nextJob(c);
    var ltv = custLifetime(c);
    var hs = healthScore(c);
    var ai = custAiInsights(c);
    var tab = root._josCustProfileTab || 'Overview';
    var tabs = '<div class="jos-btn-row jos-cust-ws-tabs">' + PROFILE_TABS.map(function (t) {
      return '<button type="button" class="jos-btn jos-btn-sm' + (tab === t ? ' jos-btn-brand' : '') + '" data-jos-act="cust-ws-tab" data-jos-cust-ws-tab="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('') + '</div>';
    return '<div class="jos-card jos-cust-workspace" data-jos-cust-id="' + esc(String(c.id)) + '">' +
      '<div class="jos-between"><div class="jos-px-person"><div class="jos-px-av">' + esc(initials(c.name)) + '</div><div>' +
      '<div class="jos-kicker">Customer Workspace</div><h3 style="margin:4px 0 0">' + esc(c.name || 'Customer') + (c.favorite ? ' ★' : '') + '</h3>' +
      '<div class="jos-muted">' + esc([c.phone, c.email].filter(Boolean).join(' · ') || 'No contact') + '</div></div></div>' +
      '<div class="jos-btn-row">' +
        '<button type="button" class="jos-btn jos-btn-brand jos-btn-sm" data-jos-act="cust-full-profile" data-jos-cust="' + esc(String(c.id)) + '">Open Full Profile</button>' +
        btn('new-job-cust', 'Book Job', 'jos-btn jos-btn-sm') +
      '</div></div>' +
      '<div class="jos-cust-ws-stats jos-mt">' +
        [['Lifetime', money(ltv) || '$0'], ['Health', String(hs)], ['Last job', last && last.date ? dateLong(last.date) : '—'], ['Next', next && next.date ? dateLong(next.date) : '—'], ['Membership', custIsMember(c) ? (c.membership || 'Active') : 'None']].map(function (x) {
          return '<div class="jos-kpi"><div class="jos-kpi-lbl">' + esc(x[0]) + '</div><div class="jos-kpi-v" style="font-size:15px">' + esc(x[1]) + '</div></div>';
        }).join('') +
      '</div>' +
      tabs +
      '<div class="jos-cust-ws-body jos-mt" id="jos-cust-ws-body">' + profileTabHtml(c, tab) + '</div>' +
      '<div class="jos-ai jos-mt"><div class="sk">AI · in-app</div><p style="font-size:13px;margin-top:6px">' + esc(ai.summary) + '</p>' +
      '<div class="jos-muted jos-mt">Next best action: <strong>' + esc(ai.nba) + '</strong></div></div></div>';
  }

  function renderCustomerSidebar(c) {
    if (!c) {
      return '<div class="jos-stack jos-cust-side"><div class="jos-empty">AI summary, health, and activity appear when you select a customer.</div>' +
        '<div class="jos-card"><div class="jos-kicker">Permissions (OS)</div><table class="jos-cust-perm"><thead><tr><th>Role</th><th>View</th><th>Edit</th><th>Book</th><th>Archive</th><th>Assign</th></tr></thead><tbody>' +
        CUST_PERM_ROLES.map(function (r) {
          return '<tr><td>' + esc(r.role) + '</td><td>' + r.view + '</td><td>' + r.edit + '</td><td>' + r.book + '</td><td>' + r.archive + '</td><td>' + r.assign + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }
    var ai = custAiInsights(c);
    var hs = healthScore(c);
    return '<div class="jos-stack jos-cust-side">' +
      '<div class="jos-ai"><div class="sk">AI Summary</div><p style="font-size:13px;margin-top:6px">' + esc(ai.summary) + '</p>' +
      '<div class="jos-stack jos-mt" style="gap:6px">' +
        '<div class="jos-between"><span style="font-size:12px">Churn risk</span><strong>' + ai.churn + '%</strong></div>' +
        '<div class="jos-between"><span style="font-size:12px">Upsell</span><strong style="font-size:12px;text-align:right;max-width:60%">' + esc(ai.upsell) + '</strong></div>' +
        '<div class="jos-between"><span style="font-size:12px">Membership</span><strong style="font-size:12px;text-align:right;max-width:60%">' + esc(ai.membership) + '</strong></div>' +
        '<div class="jos-between"><span style="font-size:12px">Revenue forecast</span><strong>' + esc(money(ai.forecast)) + '</strong></div>' +
        '<div class="jos-between"><span style="font-size:12px">Review prediction</span><strong>' + ai.reviewOdds + '%</strong></div>' +
        '<div class="jos-between"><span style="font-size:12px">Next best action</span><strong style="font-size:12px;text-align:right;max-width:60%">' + esc(ai.nba) + '</strong></div>' +
      '</div>' +
      '<div class="jos-btn-row jos-mt">' + btn('cust-ai-refresh', 'Refresh insights', 'jos-btn-brand jos-btn-sm') + btn('ask-cust', 'Ask Hubly', 'jos-btn jos-btn-sm') + '</div></div>' +
      '<div class="jos-card"><div class="jos-kicker">Quick Actions</div><div class="jos-btn-row jos-mt">' +
        btn('cust-call', 'Call', 'jos-btn jos-btn-sm') +
        btn('cust-sms', 'SMS', 'jos-btn jos-btn-sm') +
        btn('cust-email', 'Email', 'jos-btn jos-btn-sm') +
        btn('new-job-cust', 'Book Job', 'jos-btn-brand jos-btn-sm') +
        btn('cust-quote', 'Quote', 'jos-btn jos-btn-sm') +
        btn('cust-favorite', c.favorite ? 'Unfavorite' : 'Favorite', 'jos-btn jos-btn-sm') +
        '<button type="button" class="jos-btn jos-btn-brand jos-btn-sm" data-jos-act="cust-full-profile" data-jos-cust="' + esc(String(c.id)) + '">Full Profile</button>' +
      '</div></div>' +
      '<div class="jos-card"><div class="jos-kicker">Customer Health</div>' +
      '<div class="jos-health jos-mt"><div class="jos-health-ring" style="--jos-pct:' + hs + '"><span>' + hs + '</span></div>' +
      '<div><div class="jos-kpi-lbl">Score</div><div class="jos-muted">Jobs, membership & engagement</div></div></div></div>' +
      '<div class="jos-card"><div class="jos-kicker">Recent Activity</div><div class="jos-stack jos-mt">' +
      ((c.activity || []).slice(0, 6).map(function (a) {
        return '<div class="jos-sched-row"><div class="time">' + esc(String(a.type || '').slice(0, 4)) + '</div><div><div class="who">' + esc(a.label) + '</div><div class="svc">' + esc(a.at || '') + '</div></div>';
      }).join('') || '<div class="jos-muted">No activity</div>') +
      '</div></div>' +
      '<div class="jos-card"><div class="jos-kicker">Permissions (OS)</div><table class="jos-cust-perm"><thead><tr><th>Role</th><th>View</th><th>Edit</th><th>Book</th><th>Archive</th><th>Assign</th></tr></thead><tbody>' +
      CUST_PERM_ROLES.map(function (r) {
        return '<tr><td>' + esc(r.role) + '</td><td>' + r.view + '</td><td>' + r.edit + '</td><td>' + r.book + '</td><td>' + r.archive + '</td><td>' + r.assign + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  function renderCustomersContextMenu(root) {
    var menu = root._josCustCtx;
    if (!menu || !menu.open) return '';
    return '<div class="jos-cust-ctx" style="left:' + menu.x + 'px;top:' + menu.y + 'px" id="jos-cust-ctx">' +
      '<button type="button" data-jos-act="cust-call">Call</button>' +
      '<button type="button" data-jos-act="cust-sms">SMS</button>' +
      '<button type="button" data-jos-act="cust-email">Email</button>' +
      '<button type="button" data-jos-act="new-job-cust">Book Job</button>' +
      '<button type="button" data-jos-act="cust-quote">Quote</button>' +
      '<button type="button" data-jos-act="cust-favorite">Favorite</button>' +
      '<button type="button" data-jos-act="cust-archive">Archive</button>' +
      '<button type="button" data-jos-act="cust-full-profile" data-jos-cust="' + esc(String(menu.id || '')) + '">Open Profile</button>' +
      '</div>';
  }

  function renderCustomers() {
    var root = ownPixelView('v-customers', 'jos-customers-root');
    if (!root) return;
    updateChrome('customers');
    root.innerHTML = '<div class="jos-page jos-cust-page"><div class="jos-home-loading">Loading Customers…</div></div>';
    try { renderCustomersPageInner(root); }
    catch (err) {
      console.warn('HublyJourneyOS Customers', err);
      root.innerHTML = '<div class="jos-page"><div class="jos-empty jos-error-state"><strong>Customers could not load</strong><p class="jos-muted">Refresh and try again.</p><div class="jos-mt"><button type="button" class="jos-btn jos-btn-brand jos-btn-sm" onclick="HublyJourneyOS.renderCustomers()">Retry</button></div></div></div>';
    }
  }

  function renderCustomersPage() {
    return renderCustomers();
  }

  function renderCustomersPageInner(root) {
    ensureCustomersOsState();
    var tab = root._josCustTab || 'all';
    var seg = root._josCustSegment || 'vip';
    var all = customersOsList();
    var filtered = filterCustomersList(root);
    var selectedId = root._josCustId || (filtered[0] && filtered[0].id) || null;
    var sel = selectedId ? findCustomer(selectedId) : null;
    if (selectedId && !sel) {
      selectedId = filtered[0] ? filtered[0].id : null;
      root._josCustId = selectedId;
      sel = selectedId ? findCustomer(selectedId) : null;
    }
    if (sel) {
      S().activeCustId = sel.id;
      if (sel.unread) sel.unread = 0;
    }

    var tabsHtml = '<div class="jos-tabs jos-cust-tabs">' + CUST_TABS.map(function (t) {
      var count = all.filter(function (c) { return custMatchesTab(c, t[0], seg); }).length;
      return '<button type="button" class="jos-tab' + (tab === t[0] ? ' on' : '') + '" data-jos-cust-tab="' + t[0] + '">' + esc(t[1]) +
        (count ? ' <span class="jos-tab-count">' + count + '</span>' : '') + '</button>';
    }).join('') + '</div>';

    var segHtml = tab === 'segments'
      ? '<div class="jos-cust-segments">' + CUST_SEGMENTS.map(function (s) {
          return '<button type="button" class="jos-px-chip' + (seg === s[0] ? ' on' : '') + '" data-jos-act="cust-segment" data-jos-cust-seg="' + s[0] + '">' + esc(s[1]) + '</button>';
        }).join('') + '</div>'
      : '';

    var listHtml = filtered.length
      ? filtered.map(function (c) { return renderCustomerCard(c, selectedId); }).join('')
      : '<div class="jos-empty">No customers in this view.' + (root._josCustQ ? ' Clear search (Esc) to see more.' : '') + '</div>';

    root.innerHTML =
      '<div class="jos-page jos-cust-page">' +
      '<div class="jos-page-head"><div><h1>Customers</h1><p>Lifetime value, memberships, vehicles, and the golden profile — one record per client.</p></div>' +
      '<div class="jos-page-actions">' +
        btn('cust-filter-open', 'Filters', 'jos-btn jos-btn-sm') +
        btn('cust-add-open', 'Add Customer', 'jos-btn-brand jos-btn-sm') +
        btn('go-ask', 'Ask Hubly', 'jos-btn jos-btn-sm') +
      '</div></div>' +
      tabsHtml +
      segHtml +
      '<div class="jos-cust-toolbar">' +
        '<label class="jos-cust-search"><input id="jos-cust-search" type="search" placeholder="Search name, phone, email, address, vehicle, property, membership, tags, notes…" value="' + esc(root._josCustQ || '') + '"></label>' +
      '</div>' +
      renderCustomersFilterDrawer(root) +
      '<div class="jos-split jos-cust-layout">' +
        '<div class="jos-stack jos-cust-list">' + listHtml + '</div>' +
        '<div class="jos-cust-main">' + renderCustomerWorkspace(root, sel) + '</div>' +
        '<div class="jos-stack">' + renderCustomerSidebar(sel) + '</div>' +
      '</div>' +
      renderCustomersAddModal(root) +
      renderCustomersContextMenu(root) +
      '</div>';

    bindRoot(root);
    wireCustomersRoot(root);
  }

  function readCustAddDraft() {
    return {
      name: (el('jos-ca-name') || {}).value || '',
      phone: (el('jos-ca-phone') || {}).value || '',
      email: (el('jos-ca-email') || {}).value || '',
      address: (el('jos-ca-address') || {}).value || '',
      vehicle: (el('jos-ca-vehicle') || {}).value || '',
      tags: (el('jos-ca-tags') || {}).value || '',
      membership: (el('jos-ca-membership') || {}).value || '',
      assignedTo: (el('jos-ca-assigned') || {}).value || '',
      notes: (el('jos-ca-notes') || {}).value || ''
    };
  }

  function saveNewCustomer() {
    var root = el('jos-customers-root');
    var d = readCustAddDraft();
    if (!String(d.name || '').trim()) { toast('Name is required'); return; }
    ensureCustomersOsState();
    var st = S();
    var id = 'cust_' + Date.now();
    var city = '';
    var m = String(d.address || '').match(/,\s*([^,]+),\s*[A-Z]{2}\b/);
    if (m) city = m[1].trim();
    var cust = {
      id: id, name: d.name.trim(), phone: d.phone, email: d.email, address: d.address, city: city,
      vehicle: d.vehicle, vehicles: d.vehicle ? [{ label: d.vehicle, type: '' }] : [],
      property: /property|office|home/i.test(d.vehicle) ? d.vehicle : '',
      tags: String(d.tags || '').split(/[,\s]+/).filter(Boolean),
      membership: d.membership, customerType: d.membership ? 'recurring' : 'one_off',
      assignedTo: d.assignedTo, notes: d.notes, notesList: d.notes ? [d.notes] : [],
      status: 'active', favorite: false, aiScore: 55, unread: 0,
      documents: [], photos: [], payments: [],
      createdAt: new Date().toISOString(),
      activity: [{ type: 'created', label: 'Customer added', at: new Date().toLocaleString() }]
    };
    st.customers.unshift(cust);
    root._josCustAddOpen = false;
    root._josCustDraft = null;
    root._josCustId = id;
    root._josCustTab = 'all';
    toast('Customer saved');
    renderCustomers();
  }

  function wireCustomersRoot(root) {
    if (root._josCustBound) return;
    root._josCustBound = true;

    root.addEventListener('click', function (e) {
      var tabBtn = e.target.closest('[data-jos-cust-tab]');
      if (tabBtn) {
        root._josCustTab = tabBtn.getAttribute('data-jos-cust-tab');
        root._josCustCtx = null;
        renderCustomers();
        e.stopPropagation();
        return;
      }
      var card = e.target.closest('[data-jos-cust-row]');
      if (card && !e.target.closest('[data-jos-act]')) {
        var id = card.getAttribute('data-jos-cust-row');
        root._josCustId = id;
        root._josCustCtx = null;
        S().activeCustId = id;
        var found = findCustomer(id);
        if (found) found.unread = 0;
        renderCustomers();
        openCustomerProfile(id);
        e.stopPropagation();
      }
    });

    root.addEventListener('contextmenu', function (e) {
      var card = e.target.closest('.jos-cust-card[data-jos-cust-row]');
      if (!card) return;
      e.preventDefault();
      root._josCustId = card.getAttribute('data-jos-cust-row');
      var rect = root.getBoundingClientRect();
      root._josCustCtx = { open: true, x: Math.max(8, e.clientX - rect.left), y: Math.max(8, e.clientY - rect.top), id: root._josCustId };
      renderCustomers();
    });

    root.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'jos-cust-search') {
        root._josCustQ = e.target.value;
        clearTimeout(root._josCustSearchT);
        root._josCustSearchT = setTimeout(function () { renderCustomers(); }, 140);
      }
    });

    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (root._josCustAddOpen) { root._josCustAddOpen = false; renderCustomers(); return; }
        if (root._josCustFilterOpen) { root._josCustFilterOpen = false; renderCustomers(); return; }
        if (root._josCustCtx && root._josCustCtx.open) { root._josCustCtx = null; renderCustomers(); return; }
        if (root._josCustQ) {
          root._josCustQ = '';
          var inp = el('jos-cust-search');
          if (inp) inp.value = '';
          renderCustomers();
        }
      }
    });
  }

  function selectedCustomer() {
    var root = el('jos-customers-root');
    if (!root || !root._josCustId) return null;
    return findCustomer(root._josCustId);
  }

  function pushCustActivity(c, type, label) {
    c.activity = c.activity || [];
    c.activity.unshift({ type: type, label: label, at: new Date().toLocaleString() });
    c.activity = c.activity.slice(0, 40);
  }

  function handleCustomersAct(act, t) {
    var root = el('jos-customers-root');
    if (!root) return;
    ensureCustomersOsState();
    var c = selectedCustomer();
    root._josCustCtx = null;

    try {
      if (act === 'cust-filter-open') { root._josCustFilterOpen = true; return renderCustomers(); }
      if (act === 'cust-filter-close') { root._josCustFilterOpen = false; return renderCustomers(); }
      if (act === 'cust-filter-apply') {
        root._josCustFilters = {
          active: (el('jos-cf-active') || {}).value || 'all',
          membership: (el('jos-cf-membership') || {}).value || 'all',
          ltv: (el('jos-cf-ltv') || {}).value || 'all',
          lastJob: (el('jos-cf-lastjob') || {}).value || 'all',
          city: (el('jos-cf-city') || {}).value || 'all',
          assigned: (el('jos-cf-assigned') || {}).value || 'all',
          service: (el('jos-cf-service') || {}).value || 'all',
          vehicle: (el('jos-cf-vehicle') || {}).value || '',
          tags: (el('jos-cf-tags') || {}).value || ''
        };
        root._josCustFilterOpen = false;
        return renderCustomers();
      }
      if (act === 'cust-filter-reset') {
        root._josCustFilters = {};
        root._josCustFilterOpen = false;
        toast('Filters reset');
        return renderCustomers();
      }
      if (act === 'cust-filter-save') {
        root._josCustFilters = {
          active: (el('jos-cf-active') || {}).value || 'all',
          membership: (el('jos-cf-membership') || {}).value || 'all',
          ltv: (el('jos-cf-ltv') || {}).value || 'all',
          lastJob: (el('jos-cf-lastjob') || {}).value || 'all',
          city: (el('jos-cf-city') || {}).value || 'all',
          assigned: (el('jos-cf-assigned') || {}).value || 'all',
          service: (el('jos-cf-service') || {}).value || 'all',
          vehicle: (el('jos-cf-vehicle') || {}).value || '',
          tags: (el('jos-cf-tags') || {}).value || ''
        };
        var stSave = S();
        stSave.customersOs.savedFilters = stSave.customersOs.savedFilters || [];
        stSave.customersOs.savedFilters.unshift({ name: 'Saved ' + (stSave.customersOs.savedFilters.length + 1), filters: Object.assign({}, root._josCustFilters), at: todayStr() });
        stSave.customersOs.savedFilters = stSave.customersOs.savedFilters.slice(0, 8);
        toast('Filter saved');
        return renderCustomers();
      }
      if (act === 'cust-add-open') { root._josCustAddOpen = true; root._josCustDraft = {}; return renderCustomers(); }
      if (act === 'cust-add-cancel') { root._josCustAddOpen = false; root._josCustDraft = null; return renderCustomers(); }
      if (act === 'cust-add-save') return saveNewCustomer();
      if (act === 'cust-segment') {
        root._josCustSegment = t.getAttribute('data-jos-cust-seg') || 'vip';
        root._josCustTab = 'segments';
        return renderCustomers();
      }
      if (act === 'cust-ws-tab') {
        root._josCustProfileTab = t.getAttribute('data-jos-cust-ws-tab') || 'Overview';
        return renderCustomers();
      }
      if (act === 'cust-full-profile') {
        var cidFull = t.getAttribute('data-jos-cust') || root._josCustId || S().activeCustId;
        if (cidFull) {
          root._josCustId = cidFull;
          S().activeCustId = cidFull;
          return openCustomerProfile(cidFull);
        }
        return toast('Select a customer first');
      }
      if (act === 'cust-call') {
        if (!c || !c.phone) return toast('No phone on file');
        location.href = 'tel:' + String(c.phone).replace(/\D/g, '');
        pushCustActivity(c, 'call', 'Called ' + c.name);
        return;
      }
      if (act === 'cust-sms') {
        if (!c || !c.phone) return toast('No phone on file');
        location.href = 'sms:' + String(c.phone).replace(/\D/g, '');
        pushCustActivity(c, 'sms', 'SMS to ' + c.name);
        return;
      }
      if (act === 'cust-email') {
        if (!c || !c.email) return toast('No email on file');
        location.href = 'mailto:' + c.email;
        pushCustActivity(c, 'email', 'Email to ' + c.name);
        return;
      }
      if (act === 'cust-quote') {
        if (typeof global.openSmartQuote === 'function') global.openSmartQuote();
        else toast('Quote · ' + ((c && c.name) || 'Customer'));
        if (c) pushCustActivity(c, 'quote', 'Opened quote');
        return;
      }
      if (act === 'cust-favorite') {
        if (!c) return toast('Select a customer');
        c.favorite = !c.favorite;
        pushCustActivity(c, 'fav', c.favorite ? 'Marked favorite' : 'Removed favorite');
        toast(c.favorite ? 'Favorited' : 'Removed from favorites');
        return renderCustomers();
      }
      if (act === 'cust-archive') {
        if (!c) return toast('Select a customer');
        c.status = 'inactive';
        c.archived = true;
        pushCustActivity(c, 'archive', 'Archived customer');
        toast('Customer archived');
        return renderCustomers();
      }
      if (act === 'cust-ai-refresh') {
        if (!c) return toast('Select a customer');
        c.aiScore = Math.max(5, Math.min(99, (c.aiScore || 50) + (Math.floor(Math.random() * 7) - 3)));
        pushCustActivity(c, 'ai', 'AI insights refreshed');
        toast('Insights refreshed');
        return renderCustomers();
      }
      if (act === 'cust-pay-refund') return toast('Refund · Stage 2 placeholder (not connected)');
      if (act === 'cust-review-sync') return toast('Review sync · Stage 2 placeholder (not connected)');
      if (act === 'cust-doc-cloud') return toast('Cloud docs · Stage 2 placeholder (not connected)');
      if (act === 'cust-mem-billing') return toast('Membership billing · Stage 2 placeholder (not connected)');
    } catch (err) {
      console.warn('Customers action failed', err);
      toast('Failed to update — try again');
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
    if (custIsVip(c)) return '<span class="jos-status-pill vip">VIP</span>';
    if (custIsMember(c) || c.customerType === 'recurring') return '<span class="jos-status-pill member">Member</span>';
    if (c.isReturning) return '<span class="jos-status-pill returning">Returning</span>';
    if (c.favorite) return '<span class="jos-status-pill member">Favorite</span>';
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
  function profileTabHtml(c, tab, opts) {
    opts = opts || {};
    var shell = opts.shell || el('jos-customer-profile');
    var custJobs = custJobsFor(c);
    var completed = custJobs.filter(function (j) { return j.status === 'completed'; }).slice().sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
    var cancelled = custJobs.filter(function (j) { return j.status === 'cancelled'; });
    var recurring = custJobs.filter(function (j) { return j.recurring || /membership/i.test(String(j.service || '')); });
    var booked = custJobs.filter(function (j) { return j.status !== 'completed' && j.status !== 'cancelled' && j.status !== 'pending'; });
    var pending = custJobs.filter(function (j) { return j.status === 'pending'; });
    var upcoming = booked.concat(pending).slice().sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); });
    var lifetime = completed.reduce(function (s, j) { return s + (parseFloat(j.amount) || 0); }, 0);
    if (!lifetime) lifetime = custLifetime(c);
    var hs = healthScore(c), last = lastJob(c), next = nextJob(c);
    var selId = shell && shell._josJobId;
    var html = '';

    if (tab === 'Overview') {
      var tags = aiTags(c, completed, lifetime);
      var recent = completed.slice(0, 5);
      var custQuotes = quotes().filter(function (q) { return q.customerName === c.name || (c.phone && q.customerPhone === c.phone); }).filter(function (q) { return q.status !== 'booked' && q.status !== 'accepted'; }).slice(0, 3);
      var ai = custAiInsights(c);
      html = '<div class="jos-ov-kpi"><div class="jos-health"><div class="jos-health-ring" style="--jos-pct:' + hs + '"><span>' + hs + '</span></div><div><div class="jos-kpi-lbl">Customer Health</div><div class="jos-muted">From jobs & membership</div></div></div>' +
        [['Lifetime Value', money(lifetime) || '$0'], ['Last Visit', last && last.date ? dateLong(last.date) : '—'], ['Next Appointment', next && next.date ? dateLong(next.date) : '—'], ['Membership', custIsMember(c) ? (c.membership || 'Active') : 'None']].map(function (x) {
          return '<div class="jos-kpi"><div class="jos-kpi-lbl">' + esc(x[0]) + '</div><div class="jos-kpi-v" style="font-size:16px">' + esc(x[1]) + '</div></div>';
        }).join('') + '</div><div class="jos-ov-grid"><div class="jos-stack"><div class="jos-profile-ai"><div class="sk">AI Summary</div><p>' + esc(aiCustomerSummary(c, completed, booked)) + '</p><div class="jos-tag-row">' + tags.map(function (t) { return '<span class="jos-tag">' + esc(t) + '</span>'; }).join('') + '</div>' +
        '<div class="jos-muted jos-mt" style="font-size:12px">Churn ' + ai.churn + '% · Upsell: ' + esc(ai.upsell) + ' · NBA: ' + esc(ai.nba) + '</div></div>' +
        '<div class="jos-card"><div class="jos-kicker">Recent Activity</div><div class="jos-stack jos-mt">' + (recent.length ? recent.map(function (j) {
          return '<div class="jos-between"><div><strong>' + esc(j.service || 'Job') + '</strong><div class="jos-muted">' + esc(j.date ? dateLong(j.date) : '') + '</div></div><span>' + esc(j.amount != null ? money(j.amount) : '') + '</span></div>';
        }).join('') : '<div class="jos-muted">No jobs yet.</div>') + '</div></div></div><div class="jos-stack"><div class="jos-card"><div class="jos-kicker">Favorite Vehicle</div><div class="jos-mt" style="font-size:15px;font-weight:750">' + esc(c.vehicle || vehicleOf(last) || '—') + '</div><div class="jos-muted jos-mt">Preferred: ' + esc(c.preferredService || '—') + '</div></div>' +
        '<div class="jos-card"><div class="jos-kicker">Outstanding Quotes</div><div class="jos-stack jos-mt">' + (custQuotes.length ? custQuotes.map(function (q) {
          return '<div class="jos-between"><div><strong>' + esc((q.packageNames && q.packageNames[0]) || 'Quote') + '</strong><div class="jos-muted">' + esc(q.status || 'open') + '</div></div><span class="jos-pipe-amt">' + esc(money(q.amount || 0)) + '</span></div>';
        }).join('') : '<div class="jos-muted">No open quotes.</div>') + '</div></div>' +
        '<div class="jos-card"><div class="jos-kicker">AI Recommendations</div><div class="jos-stack jos-mt"><div class="jos-between"><span style="font-size:13px">Create a follow-up while the visit is fresh.</span>' + btn('ask-cust', 'Create Follow-up', 'jos-btn-brand jos-btn-sm') + '</div><div class="jos-between"><span style="font-size:13px">See membership & rebook opportunities.</span>' + btn('go-opps', 'Create Follow-up', 'jos-btn-ink jos-btn-sm') + '</div></div></div></div></div>';
    } else if (tab === 'Timeline' || tab === 'History') {
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
      (c.activity || []).forEach(function (a) {
        nodes.push({ ico: '·', kind: 'book', t: a.label || a.type || 'Activity', s: '', at: a.at || '' });
      });
      if (c.customerType === 'recurring') nodes.push({ ico: 'M', kind: 'mem', t: 'Membership', s: 'Active recurring plan', at: c.createdAt || '' });
      if (!nodes.length) {
        nodes = custJobs.slice().sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); }).map(function (j) {
          return { ico: '·', kind: 'book', t: (j.status || 'job') + ' · ' + (j.service || 'Service'), s: (j.date ? dateLong(j.date) : '') + (j.amount != null ? ' · ' + money(j.amount) : ''), at: j.date || '' };
        });
      }
      nodes.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
      html = '<div class="jos-card"><h3 style="font-size:15px;font-weight:800;margin-bottom:10px">Customer Timeline</h3>' + (nodes.length ? '<div class="jos-timeline">' + nodes.map(function (n) {
        return '<div class="jos-tl-item"><div class="jos-tl-ico ' + esc(n.kind) + '">' + esc(n.ico) + '</div><div><div class="jos-tl-t">' + esc(n.t) + '</div><div class="jos-tl-s">' + esc(n.s) + (n.at ? ' · ' + esc(String(n.at).slice(0, 16)) : '') + '</div></div></div>';
      }).join('') + '</div>' : '<div class="jos-empty">No timeline yet.</div>') + '</div>';
    } else if (tab === 'Jobs' || tab === 'Bookings') {
      if (selId == null && (upcoming[0] || completed[0])) selId = (upcoming[0] || completed[0]).id || (upcoming[0] || completed[0]).reqId;
      var allJobs = upcoming.concat(completed).concat(cancelled);
      var selJob = allJobs.find(function (j) { return String(j.id || j.reqId) === String(selId); }) || allJobs[0] || null;
      if (shell) shell._josJobId = selJob ? (selJob.id || selJob.reqId) : null;
      html = '<div class="jos-stack">' +
        '<div class="jos-kicker">Upcoming</div>' + listBookings(upcoming, shell && shell._josJobId) +
        '<div class="jos-kicker jos-mt">Completed</div>' + listJobs(completed, 'No completed jobs yet.', shell && shell._josJobId) +
        '<div class="jos-kicker jos-mt">Cancelled</div>' + (cancelled.length ? listBookings(cancelled, shell && shell._josJobId) : '<div class="jos-empty">None</div>') +
        '<div class="jos-kicker jos-mt">Recurring</div>' + (recurring.length ? listBookings(recurring, shell && shell._josJobId) : '<div class="jos-empty">No recurring jobs</div>') +
        '<div class="jos-side jos-mt">' + (selJob ? (selJob.status === 'completed' ? jobDetailHtml(selJob) : bookingDetailHtml(selJob)) : '<div class="jos-side-empty">Select a job</div>') + '</div>' +
        '<div class="jos-btn-row jos-mt">' + btn('new-job-cust', 'Book Job', 'jos-btn-brand jos-btn-sm') + btn('smart-quote', 'Quote', 'jos-btn jos-btn-sm') + '</div></div>';
    } else if (tab === 'Payments') {
      var pays = (c.payments && c.payments.length) ? c.payments.slice() : completed.map(function (j, i) {
        return { id: 'jp_' + i, amount: j.amount, status: 'paid', at: j.date, method: 'Card', label: j.service };
      });
      html = '<div class="jos-stack"><div class="jos-between"><div class="jos-kicker">Payments</div>' + btn('cust-pay-refund', 'Refund (Stage 2)', 'jos-btn jos-btn-sm') + '</div>' +
        (pays.length ? pays.map(function (p) {
          return '<div class="jos-between jos-note"><div><strong>' + esc(money(p.amount) || '$0') + '</strong><div class="jos-muted">' + esc(p.label || p.method || 'Payment') + ' · ' + esc(String(p.at || '').slice(0, 10)) + '</div></div><span class="jos-pill ' + (p.status === 'paid' ? 'won' : 'quote') + '">' + esc(p.status || 'paid') + '</span></div>';
        }).join('') : '<div class="jos-empty">No payments on file.</div>') +
        '<p class="jos-muted" style="font-size:12px">Live processor refunds are Stage 2 — placeholder only, not connected.</p></div>';
    } else if (tab === 'Photos') {
      var photos = (c.photos && c.photos.length) ? c.photos : [];
      html = '<div class="jos-stack"><div class="jos-kicker">Job Photos</div><div class="jos-photo-grid">' +
        (photos.length ? photos.map(function (p) {
          return '<div class="jos-photo"><strong>' + esc(p.label || p.name || 'Photo') + '</strong><span class="jos-muted">' + esc(String(p.at || '').slice(0, 10)) + '</span></div>';
        }).join('') : '<div class="jos-empty" style="grid-column:1/-1">No photos yet. Attach from completed jobs.</div>') +
        '</div><div class="jos-mt">' + btn('cust-doc-cloud', 'Cloud storage (Stage 2)', 'jos-btn jos-btn-sm') + '</div></div>';
    } else if (tab === 'Messages') {
      var convs = conversations().filter(function (cv) {
        return (c.name && cv.customer_name === c.name) || (c.phone && cv.phone === c.phone);
      });
      var msgs = [];
      convs.forEach(function (cv) { (cv.messages || []).forEach(function (m) { msgs.push(m); }); });
      if (!msgs.length && c.notes) msgs = [{ dir: 'sys', text: 'CRM note: ' + String(c.notes).slice(0, 120), at: '' }];
      html = '<div class="jos-stack"><div class="jos-chat-stream">' +
        (msgs.length ? msgs.map(function (m) {
          var dir = m.dir === 'out' ? 'out' : (m.dir === 'sys' ? 'sys' : 'in');
          if (dir === 'sys') return '<div class="jos-chat-sys">' + esc(m.text || '') + '</div>';
          return '<div class="jos-chat-bubble ' + dir + '">' + esc(m.text || '') + '<div class="jos-muted" style="font-size:10px;margin-top:4px">' + esc(m.at || '') + '</div></div>';
        }).join('') : '<div class="jos-empty">No messages yet.</div>') +
        '</div><div class="jos-btn-row jos-mt">' + btn('cust-sms', 'SMS', 'jos-btn-brand jos-btn-sm') + btn('cust-email', 'Email', 'jos-btn jos-btn-sm') + btn('cust-call', 'Call', 'jos-btn jos-btn-sm') + '</div></div>';
    } else if (tab === 'Membership') {
      html = '<div class="jos-stack"><div class="jos-card"><div class="jos-between"><strong>' + esc(c.membership || (c.customerType === 'recurring' ? 'Active plan' : 'No membership')) + '</strong>' +
        '<span class="jos-pill ' + (custIsMember(c) ? 'won' : 'quote') + '">' + (custIsMember(c) ? 'Active' : 'None') + '</span></div>' +
        '<p class="jos-muted jos-mt">' + (custIsMember(c) ? ('Recurring · ' + esc(money(c.recurringAmount || 120) || '$120') + '/visit plan') : 'Suggest a plan from visit history.') + '</p>' +
        '<div class="jos-btn-row jos-mt">' + btn('go-mem', 'View plans', 'jos-btn-brand jos-btn-sm') + btn('cust-mem-billing', 'Billing (Stage 2)', 'jos-btn jos-btn-sm') + '</div></div>' +
        '<div class="jos-ai"><div class="sk">Membership suggestion</div><p style="font-size:13px;margin-top:6px">' + esc(custAiInsights(c).membership) + '</p></div>' +
        '<p class="jos-muted" style="font-size:12px">Live membership billing is Stage 2 — placeholder only, not connected.</p></div>';
    } else if (tab === 'Reviews') {
      html = '<div class="jos-stack"><div class="jos-card"><div class="jos-between"><strong>Review status</strong><span class="jos-pill quote">Ready to ask</span></div>' +
        '<p class="jos-muted jos-mt">Ask while the job is fresh — Hubly can draft the message. Prediction: <strong>' + custAiInsights(c).reviewOdds + '%</strong> likely to leave a review.</p>' +
        '<div class="jos-mt">' + btn('ask-review', 'Draft a review ask', 'jos-btn-brand jos-btn-sm') + btn('cust-review-sync', 'Sync Google (Stage 2)', 'jos-btn jos-btn-sm') + '</div></div>' +
        '<div class="jos-card"><div class="jos-kicker">Recent asks</div><div class="jos-muted jos-mt">No review replies attached to this customer yet.</div></div>' +
        '<p class="jos-muted" style="font-size:12px">Live Google / Facebook review sync is Stage 2 — not connected.</p></div>';
    } else if (tab === 'Documents' || tab === 'Files') {
      var docs = (c.documents && c.documents.length) ? c.documents : [];
      html = '<div class="jos-stack">' +
        (docs.length ? docs.map(function (d) {
          return '<div class="jos-file-row"><strong>' + esc(d.name || d) + '</strong><div class="jos-muted jos-mt">' + esc(d.kind || 'document') + '</div></div>';
        }).join('') : '<div class="jos-file-row"><strong>Quotes & receipts</strong><div class="jos-muted jos-mt">PDFs and photos attached to jobs appear here.</div></div>') +
        '<div class="jos-file-row"><strong>Quick Quote</strong><div class="jos-muted jos-mt">Create a new quote for this customer.</div><div class="jos-mt">' + btn('smart-quote', 'Create Quick Quote', 'jos-btn-brand jos-btn-sm') + btn('cust-doc-cloud', 'Cloud docs (Stage 2)', 'jos-btn jos-btn-sm') + '</div></div>' +
        '<p class="jos-muted" style="font-size:12px">Cloud document storage is Stage 2 — placeholder only, not connected.</p></div>';
    } else if (tab === 'Notes') {
      var prefs = [];
      if (c.preferredService) prefs.push(c.preferredService + ' preferred');
      if (c.vehicle) prefs.push('Drives ' + c.vehicle);
      if (c.notes && /text|sms|call|email/i.test(c.notes)) prefs.push('Noted communication preference');
      if (c.customerType === 'recurring') prefs.push('Values recurring convenience');
      if (!prefs.length) prefs = ['Prefers clear scheduling', 'Responds to short texts'];
      var learned = [c.name + ' books ' + (c.preferredService || 'detailing') + ' services.', (c.vehicle ? 'Vehicle on file: ' + c.vehicle + '.' : 'Vehicle details still light.'), completed.length ? completed.length + ' completed visits on record.' : 'Still early in the relationship.'];
      var noteRows = (c.notesList && c.notesList.length) ? c.notesList : (c.notes ? [c.notes] : []);
      html = '<div class="jos-ai-notes"><h3>Notes</h3>' +
        '<div class="jos-stack jos-mt">' + (noteRows.length ? noteRows.map(function (n) { return '<div class="jos-note">' + esc(n) + '</div>'; }).join('') : '<div class="jos-muted">No notes yet.</div>') + '</div>' +
        '<div class="jos-card jos-mt"><div class="jos-kicker">Customer Summary</div><p style="font-size:13px;margin-top:8px">' + esc(aiCustomerSummary(c, completed, booked)) + '</p></div>' +
        '<div class="jos-card"><div class="jos-kicker">Preferences</div><ul class="jos-check-list">' + prefs.map(function (p) { return '<li>✓ ' + esc(p) + '</li>'; }).join('') + '</ul></div>' +
        '<div class="jos-card"><div class="jos-kicker">AI Recommendations</div><p style="font-size:13px;margin-top:8px">' + esc(c.customerType === 'recurring' ? 'Keep member slots priority and confirm 24h ahead.' : 'Offer a membership after the next completed visit.') + '</p><div class="jos-mt">' + btn('ask-cust', 'Ask Hubly', 'jos-btn-brand jos-btn-sm') + '</div></div>' +
        '<div class="jos-card"><div class="jos-kicker">Things Hubly Has Learned</div><ul class="jos-learn-list">' + learned.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
        '<div class="jos-card"><div class="jos-kicker">Confidence</div><div class="jos-stack jos-mt">' + confBar('Service Preferences', Math.min(94, 55 + completed.length * 8)) + confBar('Communication', c.phone || c.email ? 78 : 52) + confBar('Vehicle', c.vehicle || vehicleOf(last) ? 86 : 48) + '</div></div></div>';
    } else if (tab === 'Activity') {
      var acts = custJobs.slice().sort(function (a, b) { return String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')); }).slice(0, 12);
      html = acts.length ? '<div class="jos-activity">' + acts.map(function (j) {
        return '<div class="jos-act"><div class="jos-act-ico ' + (j.status === 'completed' ? 'book' : 'quote') + '">' + (j.status === 'completed' ? '✓' : '·') + '</div><div><div class="jos-act-t">' + esc((j.status || 'job') + ' · ' + (j.service || 'Service')) + '</div><div class="jos-act-s">' + esc((j.date ? dateLong(j.date) : '') + (j.amount != null ? ' · ' + money(j.amount) : '')) + '</div></div></div>';
      }).join('') + '</div>' : '<div class="jos-empty">No activity yet.</div>';
    } else {
      html = '<div class="jos-empty">Nothing here yet.</div>';
    }
    return html;
  }

  function renderProfileTab(c, tab) {
    var body = el('jos-cp-body'), shell = el('jos-customer-profile'); if (!body || !c) return;
    body.innerHTML = profileTabHtml(c, tab, { shell: shell });
    bindRoot(body);
  }

  function openCustomerProfile(id, tab) {
    ensureCustomersOsState();
    var c = findCustomer(id) || customers().find(function (x) { return String(x.id) === String(id); });
    if (!c) { toast('Customer not found'); return; }
    var shell = ensureProfileShell();
    S().activeCustId = c.id; S()._josProfileTab = tab || 'Overview'; shell._josCustId = c.id; shell._josJobId = null;
    var custRoot = el('jos-customers-root'); if (custRoot) custRoot._josCustId = c.id;
    el('jos-cp-av').textContent = initials(c.name); el('jos-cp-name').textContent = c.name || 'Customer';
    el('jos-cp-pill').innerHTML = statusPill(c);
    el('jos-cp-meta').textContent = [c.phone, c.email, c.city].filter(Boolean).join(' · ') || 'No contact info';
    var done = custJobsFor(c).filter(function (j) { return j.status === 'completed'; });
    var spent = done.reduce(function (s, j) { return s + (parseFloat(j.amount) || 0); }, 0) || custLifetime(c);
    var since = c.createdAt || c.customerSince || (done.length ? done.slice().sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); })[0].date : null);
    var last = lastJob(c);
    el('jos-cp-stats').innerHTML = [['Customer since', since ? dateLong(String(since).slice(0, 10)) : '—'], ['Total spent', money(spent) || '$0'], ['Jobs', String(done.length)], ['Last service', last && last.date ? dateLong(last.date) : '—'], ['Membership', custIsMember(c) ? (c.membership || 'Active') : 'None']].map(function (x) {
      return '<div class="jos-cp-stat"><div class="l">' + esc(x[0]) + '</div><div class="v">' + esc(x[1]) + '</div></div>';
    }).join('');
    el('jos-cp-tabs').innerHTML = PROFILE_TABS.map(function (t) {
      return '<button type="button" class="jos-profile-tab' + ((S()._josProfileTab || 'Overview') === t ? ' on' : '') + '" data-jos-tab="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('');
    renderProfileTab(c, S()._josProfileTab || 'Overview'); shell.classList.add('open');
  }

  var STOREFRONT_TABS = [
    ['website', 'Website'],
    ['booking', 'Booking'],
    ['services', 'Services'],
    ['pricing', 'Pricing'],
    ['gallery', 'Gallery'],
    ['reviews', 'Reviews'],
    ['seo', 'SEO'],
    ['domain', 'Domain'],
    ['analytics', 'Analytics']
  ];

  function demoStorefrontCatalog() {
    return [
      { id: 'sf_svc_1', name: 'Interior Detail', price: 189, dur: '2.5 hrs', desc: 'Deep clean, vacuum, and interior protection.', status: 'active', website: true, depositType: 'pct', depositVal: 25 },
      { id: 'sf_svc_2', name: 'Exterior Detail', price: 149, dur: '2 hrs', desc: 'Hand wash, clay bar, and paint-safe finish.', status: 'active', website: true, depositType: 'pct', depositVal: 25 },
      { id: 'sf_svc_3', name: 'Ceramic Coating', price: 899, dur: '1 day', desc: 'Long-lasting gloss and hydrophobic protection.', status: 'active', website: true, depositType: 'flat', depositVal: 200 }
    ];
  }

  function normalizeStorefrontSvc(s, i) {
    if (!s || typeof s !== 'object') return null;
    var id = s.id || ('sf_svc_' + (i + 1));
    return {
      id: id,
      name: s.name || ('Service ' + (i + 1)),
      price: Number(s.price) || 0,
      dur: s.dur || s.duration || s.duration_hours || '',
      desc: s.desc || s.description || '',
      status: s.status || (s.archived ? 'archived' : 'active'),
      website: s.website !== false,
      depositType: s.depositType || 'pct',
      depositVal: s.depositVal != null ? s.depositVal : 25,
      popular: !!s.popular,
      showPrice: s.showPrice !== false
    };
  }

  var SF_DEFAULT_SECTIONS = [
    { id: 'hero', label: 'Hero', type: 'hero', visible: true },
    { id: 'services', label: 'Services', type: 'services', visible: true },
    { id: 'why', label: 'Why Choose Us', type: 'why', visible: true },
    { id: 'before_after', label: 'Before & After', type: 'gallery', visible: true },
    { id: 'gallery', label: 'Gallery', type: 'gallery', visible: true },
    { id: 'reviews', label: 'Reviews', type: 'reviews', visible: true },
    { id: 'faq', label: 'FAQ', type: 'faq', visible: false },
    { id: 'cta', label: 'CTA', type: 'cta', visible: true },
    { id: 'footer', label: 'Footer', type: 'footer', visible: true }
  ];

  function ensureStorefrontOsState() {
    var st = S();
    if (!st.website || typeof st.website !== 'object') st.website = {};
    var w = st.website;
    var biz = st.biz || "Adrian's Lawn Services";
    if (!w.heroHeadline) w.heroHeadline = 'Your Lawn. Our Passion.';
    if (!w.heroSub) w.heroSub = 'Professional lawn care and landscaping with reliable scheduling, clear pricing, and results you can see.';
    if (!w.heroPrimaryBtn) w.heroPrimaryBtn = 'Book Your Service';
    if (!w.heroSecondaryBtn) w.heroSecondaryBtn = 'View Services';
    if (!w.heroPrimaryLink) w.heroPrimaryLink = '#book';
    if (!w.heroSecondaryLink) w.heroSecondaryLink = '#services';
    if (w.heroOverlay == null) w.heroOverlay = 45;
    if (!w.heroAlign) w.heroAlign = 'left';
    if (!w.heroHeight) w.heroHeight = 'tall';
    if (!Array.isArray(w.heroBadges) || !w.heroBadges.length) {
      w.heroBadges = [
        { icon: '✓', text: 'Satisfaction Guaranteed' },
        { icon: '★', text: '5-Star Rated' },
        { icon: '⚡', text: 'Same-Week Service' }
      ];
    }
    if (!Array.isArray(w.sections) || !w.sections.length) w.sections = SF_DEFAULT_SECTIONS.map(function (s) { return Object.assign({}, s); });
    if (!w.theme || typeof w.theme !== 'object') {
      w.theme = { primary: '#16a34a', accent: '#D9632D', radius: 12, font: 'DM Sans' };
    }
    if (!st.bookingOs || typeof st.bookingOs !== 'object') {
      st.bookingOs = {
        enabled: true, instant: true, quotes: true, deposit: false, card: false, photos: false,
        address: true, name: true, phone: true, email: true, vehicle: false, propertySize: false
      };
    }
    if (!w.seoTitle) w.seoTitle = (st.biz || 'Local business') + ' — Book online';
    if (!w.seoDescription) w.seoDescription = 'Book ' + (st.biz || 'our services') + ' online. See packages, gallery, and reviews.';
    if (w.reviewRating == null) w.reviewRating = 4.9;
    if (!Array.isArray(w.manualReviews)) {
      w.manualReviews = [
        { name: 'Sarah J.', rating: 5, text: 'Incredible attention to detail — car looks brand new.', at: '2 weeks ago' },
        { name: 'Mike B.', rating: 5, text: 'Easy booking and great communication.', at: '1 month ago' }
      ];
    }
    if (!st.slug || st.slug === 'your-business') st.slug = String(biz).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'adrians-lawn-service';
    if (!st.biz) st.biz = biz;
    if (!Array.isArray(st.galleryPairs) || !st.galleryPairs.length) {
      st.galleryPairs = [
        { title: 'Before & After', caption: 'Paint correction showcase' },
        { title: 'Interior refresh', caption: 'Deep clean package' },
        { title: 'Ceramic finish', caption: 'Hydrophobic gloss' }
      ];
    }
    if (!Array.isArray(st.portfolioUrls)) st.portfolioUrls = [];
    if (!st.storefrontOs || typeof st.storefrontOs !== 'object') {
      st.storefrontOs = { visits: 428, bookingStarts: 96, conversion: 22.4, aiTip: '', aiSeo: '' };
    }
    var cat = Array.isArray(st.editorSvcs) && st.editorSvcs.length ? st.editorSvcs :
      (Array.isArray(st.services) && st.services.length ? st.services : null);
    if (!cat || !cat.length) cat = demoStorefrontCatalog();
    st.editorSvcs = cat.map(normalizeStorefrontSvc).filter(Boolean);
    syncStorefrontCatalogToServices();
  }

  function storefrontCatalog() {
    ensureStorefrontOsState();
    return (S().editorSvcs || []).filter(function (s) { return s && s.name; });
  }

  function syncStorefrontCatalogToServices() {
    var st = S();
    var cat = Array.isArray(st.editorSvcs) ? st.editorSvcs : [];
    st.services = cat.map(function (s) {
      return {
        id: s.id,
        name: s.name,
        price: s.price,
        dur: s.dur || '',
        duration: s.dur || '',
        desc: s.desc || '',
        status: s.status || 'active',
        website: s.website !== false,
        depositType: s.depositType || 'pct',
        depositVal: s.depositVal != null ? s.depositVal : 25,
        popular: !!s.popular,
        showPrice: s.showPrice !== false
      };
    });
  }

  function storefrontSlug() {
    return String(S().slug || 'your-business').trim() || 'your-business';
  }

  function storefrontUrl() {
    return storefrontSlug() + '.myhubly.app';
  }

  function sfStatusBadge(svc) {
    var d = DS();
    var st = svc.status === 'archived' ? ['Archived', 'lost'] : (svc.website === false ? ['Hidden', 'quote'] : ['Live', 'ok']);
    return d ? d.statusBadge(st[0], st[1]) : '<span class="jos-pill ' + st[1] + '">' + esc(st[0]) + '</span>';
  }

  function sfAiBody() {
    var st = S();
    var w = st.website || {};
    var cat = storefrontCatalog().filter(function (s) { return s.status !== 'archived' && s.website !== false; });
    var tip = st.storefrontOs && st.storefrontOs.aiTip;
    if (tip) return tip;
    if (!w.seoDescription || String(w.seoDescription).length < 60) {
      return 'Add a longer SEO description (120+ characters) with your city and top service — it helps Google and booking conversion.';
    }
    if (!cat.length) return 'Add at least one live service to your catalog so visitors can book from your site.';
    if (!w.heroSub || String(w.heroSub).length < 40) return 'Expand your hero subheadline with trust cues — years in business, guarantee, or same-week availability.';
    return 'Your storefront looks solid. Refresh for a new SEO headline idea or ask Hubly to rewrite your hero copy.';
  }

  function sfAiSeoBody() {
    var st = S();
    if (st.storefrontOs && st.storefrontOs.aiSeo) return st.storefrontOs.aiSeo;
    var biz = st.biz || 'Local business';
    var city = st.city ? (' in ' + String(st.city).split(',')[0]) : '';
    return 'Try: "' + biz + city + ' — Book detailing & packages online" with a description mentioning your top 2 services and service area.';
  }

  function storefrontPublicUrl() {
    return storefrontSlug() + '.hubly.site';
  }

  function sfSnapshotState() {
    var st = S();
    return JSON.stringify({
      website: st.website,
      slug: st.slug,
      editorSvcs: st.editorSvcs,
      bookingOs: st.bookingOs
    });
  }

  function sfPushUndo(root) {
    if (!root) return;
    if (!root._josSfUndo) root._josSfUndo = [];
    if (!root._josSfRedo) root._josSfRedo = [];
    root._josSfUndo.push(sfSnapshotState());
    if (root._josSfUndo.length > 40) root._josSfUndo.shift();
    root._josSfRedo = [];
  }

  function sfRestoreSnapshot(root, snap) {
    if (!snap) return;
    try {
      var data = JSON.parse(snap);
      var st = S();
      if (data.website) st.website = data.website;
      if (data.slug) st.slug = data.slug;
      if (data.editorSvcs) st.editorSvcs = data.editorSvcs;
      if (data.bookingOs) st.bookingOs = data.bookingOs;
      syncStorefrontCatalogToServices();
      renderStorefront();
    } catch (e) {}
  }

  function sfField(label, id, val, type) {
    type = type || 'text';
    if (type === 'textarea') {
      return '<label class="jos-sf-mc-field"><span>' + esc(label) + '</span><textarea id="' + esc(id) + '" data-jos-sf-live="1">' + esc(val || '') + '</textarea></label>';
    }
    if (type === 'checkbox') {
      return '<label class="jos-sf-mc-check"><input id="' + esc(id) + '" type="checkbox"' + (val ? ' checked' : '') + ' data-jos-sf-live="1"><span>' + esc(label) + '</span></label>';
    }
    if (type === 'range') {
      return '<label class="jos-sf-mc-field"><span>' + esc(label) + '</span><input id="' + esc(id) + '" type="range" min="0" max="80" value="' + esc(String(val != null ? val : 45)) + '" data-jos-sf-live="1"></label>';
    }
    return '<label class="jos-sf-mc-field"><span>' + esc(label) + '</span><input id="' + esc(id) + '" type="' + esc(type) + '" value="' + esc(val != null ? String(val) : '') + '" data-jos-sf-live="1"></label>';
  }

  function renderStorefrontLiveSite(root) {
    ensureStorefrontOsState();
    var st = S();
    var w = st.website || {};
    var sel = root._josSfSelect || 'hero';
    var device = root._josSfDevice || 'desktop';
    var biz = st.biz || "Adrian's Lawn Services";
    var services = storefrontCatalog().filter(function (s) { return s.status !== 'archived' && s.website !== false; }).slice(0, 4);
    if (!services.length) services = demoStorefrontCatalog().slice(0, 4);
    var primary = (w.theme && w.theme.primary) || '#16a34a';
    var on = function (id) { return sel === id ? ' is-selected' : ''; };
    var heroBadges = (w.heroBadges || []).map(function (b, i) {
      return '<span class="sf-live-badge' + on('badge:' + i) + '" data-jos-sf-pick="badge:' + i + '">' + esc(b.icon || '✓') + ' ' + esc(b.text || 'Trusted') + '</span>';
    }).join('');
    var svcCards = services.map(function (s, i) {
      return '<article class="sf-live-svc' + on('service:' + i) + '" data-jos-sf-pick="service:' + i + '">' +
        '<div class="sf-live-svc-ico" aria-hidden="true">🌿</div>' +
        '<h4>' + esc(s.name) + '</h4>' +
        '<p>' + esc(s.desc || 'Professional service with clear pricing.') + '</p>' +
        '<span class="sf-live-link">Learn more →</span></article>';
    }).join('');
    var reviews = (w.manualReviews || []).slice(0, 2).map(function (r, i) {
      return '<div class="sf-live-review' + on('review:' + i) + '" data-jos-sf-pick="review:' + i + '"><strong>' + esc(r.name || 'Customer') + '</strong><div class="stars">★★★★★</div><p>' + esc(r.text || '') + '</p></div>';
    }).join('');
    return '<div class="jos-sf-live-site device-' + esc(device) + '" style="--sf-primary:' + esc(primary) + '">' +
      '<header class="sf-live-nav' + on('nav') + '" data-jos-sf-pick="nav">' +
      '<div class="sf-live-logo' + on('logo') + '" data-jos-sf-pick="logo">' + esc(biz.split(' ')[0] || 'Hubly') + '<em>' + esc(biz.split(' ').slice(1).join(' ') || '') + '</em></div>' +
      '<nav><span>Home</span><span>Services</span><span>About</span><span>Gallery</span><span>Contact</span></nav>' +
      '<button type="button" class="sf-live-nav-cta' + on('nav-cta') + '" data-jos-sf-pick="nav-cta">Book Now</button></header>' +
      '<section class="sf-live-hero align-' + esc(w.heroAlign || 'left') + ' height-' + esc(w.heroHeight || 'tall') + on('hero') + '" data-jos-sf-pick="hero" style="--sf-overlay:' + (Number(w.heroOverlay) || 45) + '%">' +
      '<div class="sf-live-hero-bg' + on('hero-bg') + '" data-jos-sf-pick="hero-bg"></div>' +
      '<div class="sf-live-hero-inner">' +
      '<h1 class="sf-live-h1' + on('hero-headline') + '" data-jos-sf-pick="hero-headline">' + esc(w.heroHeadline || '') + '</h1>' +
      '<p class="sf-live-sub' + on('hero-sub') + '" data-jos-sf-pick="hero-sub">' + esc(w.heroSub || '') + '</p>' +
      '<div class="sf-live-hero-btns">' +
      '<button type="button" class="sf-live-btn primary' + on('hero-primary') + '" data-jos-sf-pick="hero-primary">' + esc(w.heroPrimaryBtn || 'Book') + '</button>' +
      '<button type="button" class="sf-live-btn secondary' + on('hero-secondary') + '" data-jos-sf-pick="hero-secondary">' + esc(w.heroSecondaryBtn || 'View Services') + '</button>' +
      '</div>' +
      '<div class="sf-live-badges">' + heroBadges + '</div></div></section>' +
      '<section class="sf-live-section' + on('section:services') + '" data-jos-sf-pick="section:services">' +
      '<h2>Complete Lawn Care Solutions</h2>' +
      '<div class="sf-live-svc-grid">' + svcCards + '</div></section>' +
      '<section class="sf-live-section muted' + on('section:reviews') + '" data-jos-sf-pick="section:reviews">' +
      '<h2>What Customers Say</h2><div class="sf-live-reviews">' + reviews + '</div></section>' +
      '<footer class="sf-live-footer' + on('footer') + '" data-jos-sf-pick="footer">© ' + esc(biz) + ' · Powered by <img class="hubly-mark" src="assets/hubly-wordmark.png" alt="hubly" height="14"></footer>' +
      '<button type="button" class="sf-live-chat" aria-label="Chat">💬</button></div>';
  }

  function renderStorefrontContextPanel(root) {
    var tab = root._josSfTab || 'website';
    var sel = root._josSfSelect || 'hero';
    var ctx = root._josSfCtxTab || 'content';
    var w = S().website || {};
    var bo = S().bookingOs || {};
    var head = '<div class="jos-sf-mc-ctx-head"><strong>' + esc(tab === 'website' ? ('Editing: ' + (sel.indexOf('hero') === 0 ? 'Hero Section' : sel.replace('section:', '').replace(/-/g, ' '))) : (STOREFRONT_TABS.find(function (t) { return t[0] === tab; }) || ['', 'Storefront'])[1]) + '</strong></div>';
    var ctxTabs = tab === 'website' ? '<div class="jos-sf-mc-ctx-tabs">' +
      ['content', 'design', 'advanced'].map(function (t) {
        return '<button type="button" class="jos-sf-mc-ctx-tab' + (ctx === t ? ' on' : '') + '" data-jos-act="sf-ctx-tab" data-jos-sf-ctx="' + t + '">' + esc(t.charAt(0).toUpperCase() + t.slice(1)) + '</button>';
      }).join('') + '</div>' : '';

    var body = '';
    if (tab === 'website' && (sel === 'hero' || sel.indexOf('hero') === 0 || sel.indexOf('badge') === 0)) {
      body = '<div class="jos-sf-mc-ctx-body">' +
        sfField('Heading', 'jos-sf-hero-head', w.heroHeadline) +
        sfField('Subheading', 'jos-sf-hero-sub', w.heroSub, 'textarea') +
        '<div class="jos-sf-mc-img"><span>Background image</span><div class="jos-sf-mc-img-thumb"></div><div class="jos-btn-row"><button type="button" class="jos-btn jos-btn-sm" data-jos-act="sf-hero-img">Change image</button><button type="button" class="jos-btn jos-btn-sm" data-jos-act="sf-hero-img-remove">Remove</button></div></div>' +
        sfField('Overlay darkness', 'jos-sf-hero-overlay', w.heroOverlay, 'range') +
        sfField('Primary button', 'jos-sf-hero-primary', w.heroPrimaryBtn) +
        sfField('Primary link', 'jos-sf-hero-primary-link', w.heroPrimaryLink) +
        sfField('Secondary button', 'jos-sf-hero-secondary', w.heroSecondaryBtn) +
        sfField('Secondary link', 'jos-sf-hero-secondary-link', w.heroSecondaryLink) +
        '<div class="jos-kicker">Trust badges</div>' +
        (w.heroBadges || []).map(function (b, i) {
          return '<div class="jos-sf-mc-badge-row"><span>☰</span>' + sfField('Badge ' + (i + 1), 'jos-sf-badge-' + i, b.text) + '</div>';
        }).join('') +
        '<button type="button" class="jos-linkish" data-jos-act="sf-badge-add">+ Add badge</button></div>';
    } else if (tab === 'website') {
      var sections = (w.sections || SF_DEFAULT_SECTIONS);
      body = '<div class="jos-sf-mc-ctx-body"><div class="jos-kicker">Sections</div><div class="jos-sf-mc-sections">' +
        sections.map(function (s) {
          return '<button type="button" class="jos-sf-mc-sec' + (sel === 'section:' + s.id ? ' on' : '') + (s.visible === false ? ' hidden-sec' : '') + '" data-jos-act="sf-pick" data-jos-sf-pick="section:' + esc(s.id) + '"><span class="drag">☰</span> ' + esc(s.label) + '</button>';
        }).join('') +
        '</div><div class="jos-btn-row jos-mt">' +
        '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="sf-section-add">Add Section</button>' +
        '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="sf-section-hide">Hide</button></div>' +
        '<div class="jos-kicker jos-mt">Theme</div>' +
        '<div class="jos-btn-row">' +
        '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="sf-theme-colors">Colors</button>' +
        '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="sf-theme-fonts">Fonts</button>' +
        '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="sf-theme-reset">Reset Theme</button></div></div>';
    } else if (tab === 'booking') {
      body = '<div class="jos-sf-mc-ctx-body">' +
        sfField('Booking enabled', 'jos-sf-bk-enabled', bo.enabled, 'checkbox') +
        sfField('Instant booking', 'jos-sf-bk-instant', bo.instant, 'checkbox') +
        sfField('Quote requests', 'jos-sf-bk-quotes', bo.quotes, 'checkbox') +
        sfField('Require deposit', 'jos-sf-bk-deposit', bo.deposit, 'checkbox') +
        sfField('Collect card', 'jos-sf-bk-card', bo.card, 'checkbox') +
        sfField('Collect photos', 'jos-sf-bk-photos', bo.photos, 'checkbox') +
        sfField('Require address', 'jos-sf-bk-address', bo.address, 'checkbox') +
        '<div class="jos-kicker jos-mt">Customer information</div>' +
        sfField('Name', 'jos-sf-bk-name', bo.name, 'checkbox') +
        sfField('Phone', 'jos-sf-bk-phone', bo.phone, 'checkbox') +
        sfField('Email', 'jos-sf-bk-email', bo.email, 'checkbox') +
        sfField('Vehicle', 'jos-sf-bk-vehicle', bo.vehicle, 'checkbox') +
        sfField('Property size', 'jos-sf-bk-property', bo.propertySize, 'checkbox') +
        '<div class="jos-btn-row jos-mt">' + dsBtn('sf-preview-booking', 'Preview booking', 'jos-btn-brand jos-btn-sm') + '</div></div>';
    } else if (tab === 'services') {
      body = '<div class="jos-sf-mc-ctx-body">' + renderStorefrontServicesTab(root) + '</div>';
    } else if (tab === 'pricing') {
      body = '<div class="jos-sf-mc-ctx-body">' + renderStorefrontPricingTab(root) + '</div>';
    } else if (tab === 'gallery') {
      body = '<div class="jos-sf-mc-ctx-body">' + renderStorefrontGalleryTab() + '</div>';
    } else if (tab === 'reviews') {
      body = '<div class="jos-sf-mc-ctx-body">' + renderStorefrontReviewsTab() + '</div>';
    } else if (tab === 'seo') {
      body = '<div class="jos-sf-mc-ctx-body">' + renderStorefrontSeoTab() +
        '<div class="jos-btn-row jos-mt"><button type="button" class="jos-btn jos-btn-sm" data-jos-act="sf-seo-ai">Generate SEO</button><button type="button" class="jos-btn jos-btn-sm" data-jos-act="sf-seo-improve">Improve SEO</button></div></div>';
    } else if (tab === 'domain') {
      body = '<div class="jos-sf-mc-ctx-body">' + renderStorefrontDomainTab() + '</div>';
    } else if (tab === 'analytics') {
      body = '<div class="jos-sf-mc-ctx-body">' + renderStorefrontAnalyticsTab() + '</div>';
  } else {
      body = '<div class="jos-sf-mc-ctx-body"><p class="jos-muted">Click anything on the live preview to edit it instantly.</p></div>';
    }
    return '<aside class="jos-sf-mc-panel">' + head + ctxTabs + body + '</aside>';
  }

  function renderStorefrontToolbar(root) {
    var device = root._josSfDevice || 'desktop';
    var pubOpen = !!root._josSfPublishOpen;
    return '<header class="jos-sf-mc-toolbar">' +
      '<button type="button" class="jos-sf-mc-back" data-jos-act="sf-back">← Back to dashboard</button>' +
      '<div class="jos-sf-mc-devices">' +
      [['desktop', 'Desktop'], ['tablet', 'Tablet'], ['mobile', 'Mobile']].map(function (d) {
        return '<button type="button" class="jos-sf-mc-device' + (device === d[0] ? ' on' : '') + '" data-jos-act="sf-device" data-jos-sf-device="' + d[0] + '" title="' + d[1] + '"></button>';
      }).join('') +
      '</div>' +
      '<div class="jos-sf-mc-url"><span class="jos-sf-mc-live">Published</span><span class="jos-sf-mc-url-text">' + esc(storefrontPublicUrl()) + '</span>' +
      '<button type="button" class="jos-sf-mc-ext" data-jos-act="sf-preview" title="Open site">↗</button></div>' +
      '<div class="jos-sf-mc-history">' +
      '<button type="button" class="jos-sf-mc-icon" data-jos-act="sf-undo" title="Undo">↶</button>' +
      '<button type="button" class="jos-sf-mc-icon" data-jos-act="sf-redo" title="Redo">↷</button></div>' +
      '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="sf-preview">Preview</button>' +
      '<div class="jos-sf-mc-publish-wrap">' +
      '<button type="button" class="jos-btn jos-btn-brand jos-sf-mc-publish" data-jos-act="sf-publish-toggle">Publish changes ▾</button>' +
      (pubOpen ? '<div class="jos-sf-mc-publish-menu">' +
        '<button type="button" data-jos-act="sf-publish">Publish</button>' +
        '<button type="button" data-jos-act="sf-schedule">Schedule Publish</button>' +
        '<button type="button" data-jos-act="sf-draft">Save Draft</button>' +
        '<button type="button" data-jos-act="sf-history">View History</button></div>' : '') +
      '</div></header>';
  }

  function setStorefrontMode(on) {
    var app = el('p-app');
    if (!app) return;
    app.classList.toggle('jos-storefront-mode', !!on);
  }

  function renderStorefrontPreviewStrip() {
    return '<div class="jos-sf-preview">' +
      '<div><div class="jos-kicker">Live preview</div><div class="jos-sf-preview-url">' + esc(storefrontUrl()) + '</div></div>' +
      '<div class="jos-sf-preview-actions">' +
        dsBtn('sf-preview', 'Preview site', 'jos-btn jos-btn-sm') +
        dsBtn('sf-preview-booking', 'Preview booking', 'jos-btn jos-btn-sm') +
        dsBtn('sf-copy-url', 'Copy URL', 'jos-btn-brand jos-btn-sm') +
      '</div></div>';
  }

  function renderStorefrontSidebar(root) {
    var d = DS();
    var ai = d ? d.aiInsightCard({
      kicker: 'AI · Storefront',
      body: root._josSfAiBody || sfAiBody(),
      actionsHtml: dsBtn('sf-ai-refresh', 'Refresh tip', 'jos-btn jos-btn-sm') + dsBtn('go-ask', 'Ask Hubly', 'jos-btn-brand jos-btn-sm')
    }) : '<div class="jos-ai"><div class="sk">AI · Storefront</div><p style="font-size:13px;margin-top:6px">' + esc(root._josSfAiBody || sfAiBody()) + '</p><div class="jos-btn-row jos-mt">' + dsBtn('sf-ai-refresh', 'Refresh tip', 'jos-btn jos-btn-sm') + '</div></div>';
    var seo = d ? d.aiInsightCard({ kicker: 'SEO suggestion', body: sfAiSeoBody() }) :
      '<div class="jos-card jos-mt"><div class="jos-kicker">SEO suggestion</div><p class="jos-muted" style="font-size:13px;margin-top:6px">' + esc(sfAiSeoBody()) + '</p></div>';
    return '<div class="jos-sf-sidebar">' + ai + '<div class="jos-mt">' + seo + '</div></div>';
  }

  function renderStorefrontWebsiteTab() {
    var w = S().website || {};
    return '<div class="jos-sf-form">' +
      '<label>Hero headline<input id="jos-sf-hero-head" type="text" value="' + esc(w.heroHeadline || '') + '"></label>' +
      '<label>Hero subheadline<textarea id="jos-sf-hero-sub">' + esc(w.heroSub || '') + '</textarea></label>' +
      '<div class="jos-btn-row">' + dsBtn('sf-site-save', 'Save website copy', 'jos-btn-brand jos-btn-sm') + dsBtn('sf-preview', 'Preview site', 'jos-btn jos-btn-sm') + '</div>' +
      '</div>';
  }

  function renderStorefrontBookingTab() {
    var st = S();
    var style = st.bookingWizard && st.bookingWizard.style ? st.bookingWizard.style : (st.website && st.website.bookingStyle) || 'Guided steps · vehicle → service → time';
    return '<div class="jos-card"><div class="jos-kicker">Booking experience</div>' +
      '<p style="font-size:13px;margin-top:8px">' + esc(style) + '</p>' +
      '<p class="jos-muted" style="font-size:12px;margin-top:8px">Visitors book from your catalog services marked Live on the website.</p>' +
      '<div class="jos-btn-row jos-mt">' +
        dsBtn('sf-preview-booking', 'Preview booking', 'jos-btn-brand jos-btn-sm') +
        dsBtn('sf-preview', 'Preview site', 'jos-btn jos-btn-sm') +
      '</div></div>';
  }

  function renderStorefrontServiceCard(svc, mode) {
    var acts = mode === 'pricing'
      ? '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="sf-pricing-edit" data-jos-sf-svc="' + esc(String(svc.id)) + '">Edit pricing</button>'
      : '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="sf-svc-edit" data-jos-sf-svc="' + esc(String(svc.id)) + '">Edit</button>' +
        '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="sf-svc-archive" data-jos-sf-svc="' + esc(String(svc.id)) + '">' + (svc.status === 'archived' ? 'Restore' : 'Archive') + '</button>';
    return '<div class="jos-sf-card" data-jos-sf-svc-id="' + esc(String(svc.id)) + '">' +
      '<div class="jos-sf-card-h"><strong>' + esc(svc.name) + '</strong>' + sfStatusBadge(svc) + '</div>' +
      '<div class="jos-sf-card-meta">' + esc(money(svc.price) || '$0') + ' · ' + esc(svc.dur || '—') + '</div>' +
      '<div class="jos-sf-card-meta">' + esc(svc.desc || '') + '</div>' +
      '<div class="jos-sf-card-foot">' + acts + '</div></div>';
  }

  function renderStorefrontServicesTab(root) {
    var cat = storefrontCatalog();
    var active = cat.filter(function (s) { return s.status !== 'archived'; });
    var list = active.length
      ? '<div class="jos-sf-grid">' + active.map(function (s) { return renderStorefrontServiceCard(s, 'services'); }).join('') + '</div>'
      : (DS() ? DS().emptyState('No services yet', 'Add your first package to power booking and pricing.') : '<div class="jos-empty"><strong>No services yet</strong><p class="jos-muted">Add your first package.</p></div>');
    return '<div class="jos-between jos-mb"><div class="jos-muted">' + active.length + ' service' + (active.length === 1 ? '' : 's') + ' in catalog</div>' +
      dsBtn('sf-svc-add-open', 'Add Service', 'jos-btn-brand jos-btn-sm') + '</div>' + list + renderStorefrontServiceModal(root);
  }

  function renderStorefrontPricingTab(root) {
    var cat = storefrontCatalog().filter(function (s) { return s.status !== 'archived'; });
    if (!cat.length) return DS() ? DS().emptyState('No pricing yet', 'Add services first, then set price, duration, and deposit.') : '<div class="jos-empty">No services to price.</div>';
    var rows = cat.map(function (s) {
      return '<div class="jos-sf-card"><div class="jos-sf-card-h"><strong>' + esc(s.name) + '</strong>' + sfStatusBadge(s) + '</div>' +
        '<div class="jos-sf-form" style="margin-top:8px">' +
        '<label>Price ($)<input type="number" min="0" step="1" data-jos-sf-price="' + esc(String(s.id)) + '" value="' + esc(String(s.price || 0)) + '"></label>' +
        '<label>Duration<input type="text" data-jos-sf-dur="' + esc(String(s.id)) + '" value="' + esc(s.dur || '') + '"></label>' +
        '<label>Deposit type<select data-jos-sf-dep-type="' + esc(String(s.id)) + '"><option value="pct"' + (s.depositType === 'pct' ? ' selected' : '') + '>Percent</option><option value="flat"' + (s.depositType === 'flat' ? ' selected' : '') + '>Flat</option></select></label>' +
        '<label>Deposit value<input type="number" min="0" data-jos-sf-dep-val="' + esc(String(s.id)) + '" value="' + esc(String(s.depositVal != null ? s.depositVal : 25)) + '"></label>' +
        '</div></div>';
    }).join('');
    return '<div class="jos-sf-grid">' + rows + '</div>' +
      '<div class="jos-btn-row jos-mt">' + dsBtn('sf-pricing-save', 'Save pricing', 'jos-btn-brand jos-btn-sm') + '</div>';
  }

  function renderStorefrontGalleryTab() {
    var pairs = S().galleryPairs || [];
    var urls = S().portfolioUrls || [];
    var items = pairs.length
      ? pairs.map(function (p, i) {
          var img = urls[i] || '';
          return '<div class="jos-sf-gallery-item">' + (img ? '<span>Photo</span>' : esc(p.title || ('Album ' + (i + 1)))) + '<div class="jos-muted" style="font-size:11px;margin-top:4px">' + esc(p.caption || '') + '</div></div>';
        }).join('')
      : '';
    var empty = !items ? (DS() ? DS().emptyState('No gallery yet', 'Upload photos in Stage 2 — demo albums shown when seeded.') : '<div class="jos-empty">No gallery items.</div>') : '';
    return '<div class="jos-between jos-mb"><div><div class="jos-kicker">Portfolio</div><p class="jos-muted" style="font-size:12px;margin-top:4px">Shown on your public site.</p></div>' +
      dsBtn('sf-gallery-upload', 'Upload photos', 'jos-btn jos-btn-sm') + '</div>' +
      (items ? '<div class="jos-sf-gallery">' + items + '</div>' : empty);
  }

  function renderStorefrontReviewsTab() {
    var w = S().website || {};
    var reviews = Array.isArray(w.manualReviews) ? w.manualReviews : [];
    var rating = Number(w.reviewRating || 0).toFixed(1);
    var list = reviews.length
      ? reviews.map(function (r) {
          var stars = '★'.repeat(Math.min(5, Math.max(0, Number(r.rating) || 5)));
          return '<div class="jos-sf-review"><strong>' + esc(r.name || 'Customer') + '</strong><div class="stars">' + stars + '</div><p style="font-size:13px;margin:0">' + esc(r.text || '') + '</p>' +
            (r.at ? '<div class="jos-muted" style="font-size:11px;margin-top:6px">' + esc(r.at) + '</div>' : '') + '</div>';
        }).join('')
      : (DS() ? DS().emptyState('No reviews on site', 'Reviews module will own request/reply flows.') : '<div class="jos-empty">No reviews.</div>');
    return '<div class="jos-card jos-mb"><div class="jos-kicker">Site rating</div><div style="font-size:22px;font-weight:800;margin-top:6px">' + esc(rating) + ' ★</div>' +
      '<p class="jos-muted" style="font-size:12px;margin-top:6px">Read-only here — request and reply live in ⭐ Reviews.</p></div>' +
      '<div class="jos-stack">' + list + '</div>';
  }

  function renderStorefrontSeoTab() {
    var w = S().website || {};
    return '<div class="jos-sf-form">' +
      '<label>SEO title<input id="jos-sf-seo-title" type="text" value="' + esc(w.seoTitle || '') + '"></label>' +
      '<label>SEO description<textarea id="jos-sf-seo-desc">' + esc(w.seoDescription || '') + '</textarea></label>' +
      '<div class="jos-btn-row">' + dsBtn('sf-seo-save', 'Save SEO', 'jos-btn-brand jos-btn-sm') + '</div></div>';
  }

  function renderStorefrontDomainTab() {
    return '<div class="jos-sf-form">' +
      '<label>Slug (subdomain)<input id="jos-sf-slug" type="text" value="' + esc(storefrontSlug()) + '"></label>' +
      '<div class="jos-card"><div class="jos-kicker">Your URL</div><div class="jos-sf-preview-url" style="margin-top:6px">' + esc(storefrontUrl()) + '</div>' +
      '<div class="jos-btn-row jos-mt">' + dsBtn('sf-copy-url', 'Copy URL', 'jos-btn-brand jos-btn-sm') + dsBtn('sf-domain-save', 'Save slug', 'jos-btn jos-btn-sm') + '</div></div>' +
      '<div class="jos-muted" style="font-size:12px">Custom domain DNS &amp; SSL — Stage 2 integration.</div>' +
      '<div class="jos-btn-row">' + dsBtn('sf-dns-stage2', 'Connect custom domain', 'jos-btn jos-btn-sm') + '</div></div>';
  }

  function renderStorefrontAnalyticsTab() {
    var os = S().storefrontOs || {};
    var d = DS();
    var kpis = d
      ? d.metricCard('Visits (demo)', String(os.visits || 0), 'Stage 2 · live analytics') +
        d.metricCard('Booking starts', String(os.bookingStarts || 0), 'OS counters') +
        d.metricCard('Conversion', (os.conversion || 0) + '%', 'Starts ÷ visits')
      : '<div class="jos-kpi"><div class="jos-kpi-lbl">Visits</div><div class="jos-kpi-v">' + esc(String(os.visits || 0)) + '</div></div>';
    return '<div class="jos-muted jos-mb" style="font-size:12px">Demo KPIs for Stage 1 — not connected to a live analytics provider.</div>' +
      '<div class="jos-sf-kpis">' + kpis + '</div>' +
      dsBtn('sf-analytics-stage2', 'Connect live analytics', 'jos-btn jos-btn-sm');
  }

  function renderStorefrontServiceModal(root) {
    if (!root._josSfSvcModal) return '';
    var draft = root._josSfDraft || {};
    var editing = !!draft.id;
    return '<div class="jos-sf-modal" data-jos-sf-modal="1"><div class="jos-sf-modal-panel">' +
      '<h3>' + (editing ? 'Edit service' : 'Add service') + '</h3>' +
      '<div class="jos-sf-form">' +
      '<label>Name<input id="jos-sf-svc-name" type="text" value="' + esc(draft.name || '') + '"></label>' +
      '<label>Price ($)<input id="jos-sf-svc-price" type="number" min="0" value="' + esc(String(draft.price != null ? draft.price : '')) + '"></label>' +
      '<label>Duration<input id="jos-sf-svc-dur" type="text" value="' + esc(draft.dur || '') + '" placeholder="e.g. 2 hrs"></label>' +
      '<label>Description<textarea id="jos-sf-svc-desc">' + esc(draft.desc || '') + '</textarea></label>' +
      '<label><input id="jos-sf-svc-website" type="checkbox"' + (draft.website !== false ? ' checked' : '') + '> Show on website</label>' +
      '</div>' +
      '<div class="jos-btn-row jos-mt">' +
        dsBtn('sf-svc-save', editing ? 'Save changes' : 'Add service', 'jos-btn-brand jos-btn-sm') +
        dsBtn('sf-svc-add-cancel', 'Cancel', 'jos-btn jos-btn-sm') +
      '</div></div></div>';
  }

  function renderStorefrontTabBody(root, tab) {
    if (tab === 'website') return renderStorefrontWebsiteTab();
    if (tab === 'booking') return renderStorefrontBookingTab();
    if (tab === 'services') return renderStorefrontServicesTab(root);
    if (tab === 'pricing') return renderStorefrontPricingTab(root);
    if (tab === 'gallery') return renderStorefrontGalleryTab();
    if (tab === 'reviews') return renderStorefrontReviewsTab();
    if (tab === 'seo') return renderStorefrontSeoTab();
    if (tab === 'domain') return renderStorefrontDomainTab();
    if (tab === 'analytics') return renderStorefrontAnalyticsTab();
    return renderStorefrontWebsiteTab();
  }

  function renderStorefrontPageInner(root) {
    ensureStorefrontOsState();
    var tab = root._josSfTab || 'website';
    if (!root._josSfSelect) root._josSfSelect = 'hero';
    if (!root._josSfDevice) root._josSfDevice = 'desktop';
    var tabsHtml = '<div class="jos-sf-mc-tabs">' + STOREFRONT_TABS.map(function (t) {
      return '<button type="button" class="jos-sf-mc-tab' + (tab === t[0] ? ' on' : '') + '" data-jos-sf-tab="' + t[0] + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div>';
    root.innerHTML =
      '<div class="jos-sf-mc-shell jos-sf-page">' +
      renderStorefrontToolbar(root) +
      tabsHtml +
      '<div class="jos-sf-mc-workspace">' +
      '<div class="jos-sf-mc-preview-wrap">' + renderStorefrontLiveSite(root) + '</div>' +
      renderStorefrontContextPanel(root) +
      '</div>' +
      renderStorefrontServiceModal(root) +
      '</div>';
    bindRoot(root);
    wireStorefrontRoot(root);
  }

  function renderStorefront() {
    var root = ownPixelView('v-editor', 'jos-storefront-root');
    if (!root) return;
    setStorefrontMode(true);
    updateChrome('editor');
    root.innerHTML = '<div class="jos-sf-mc-shell"><div class="jos-home-loading">Loading Storefront…</div></div>';
    try { renderStorefrontPageInner(root); }
    catch (err) {
      console.warn('HublyJourneyOS Storefront', err);
      root.innerHTML = '<div class="jos-sf-mc-shell"><div class="jos-empty jos-error-state"><strong>Storefront could not load</strong><p class="jos-muted">Refresh and try again.</p><div class="jos-mt"><button type="button" class="jos-btn jos-btn-brand jos-btn-sm" onclick="HublyJourneyOS.renderStorefront()">Retry</button></div></div></div>';
    }
  }

  function readStorefrontSvcDraft() {
    var root = el('jos-storefront-root');
    var base = (root && root._josSfDraft) || {};
    return {
      id: base.id,
      name: (el('jos-sf-svc-name') || {}).value || '',
      price: Number((el('jos-sf-svc-price') || {}).value) || 0,
      dur: (el('jos-sf-svc-dur') || {}).value || '',
      desc: (el('jos-sf-svc-desc') || {}).value || '',
      website: !!(el('jos-sf-svc-website') && el('jos-sf-svc-website').checked)
    };
  }

  function sfApplyLiveFields(root) {
    var w = S().website;
    var bo = S().bookingOs || {};
    var head = el('jos-sf-hero-head');
    var sub = el('jos-sf-hero-sub');
    var ov = el('jos-sf-hero-overlay');
    var pBtn = el('jos-sf-hero-primary');
    var sBtn = el('jos-sf-hero-secondary');
    var pLink = el('jos-sf-hero-primary-link');
    var sLink = el('jos-sf-hero-secondary-link');
    if (head) { w.heroHeadline = head.value; w.customHeroHeadline = true; }
    if (sub) { w.heroSub = sub.value; w.customHeroSub = true; }
    if (ov) w.heroOverlay = Number(ov.value) || 45;
    if (pBtn) w.heroPrimaryBtn = pBtn.value || w.heroPrimaryBtn;
    if (sBtn) w.heroSecondaryBtn = sBtn.value || w.heroSecondaryBtn;
    if (pLink) w.heroPrimaryLink = pLink.value || w.heroPrimaryLink;
    if (sLink) w.heroSecondaryLink = sLink.value || w.heroSecondaryLink;
    (w.heroBadges || []).forEach(function (b, i) {
      var inp = el('jos-sf-badge-' + i);
      if (inp) b.text = inp.value || b.text;
    });
    [['jos-sf-bk-enabled', 'enabled'], ['jos-sf-bk-instant', 'instant'], ['jos-sf-bk-quotes', 'quotes'], ['jos-sf-bk-deposit', 'deposit'], ['jos-sf-bk-card', 'card'], ['jos-sf-bk-photos', 'photos'], ['jos-sf-bk-address', 'address'], ['jos-sf-bk-name', 'name'], ['jos-sf-bk-phone', 'phone'], ['jos-sf-bk-email', 'email'], ['jos-sf-bk-vehicle', 'vehicle'], ['jos-sf-bk-property', 'propertySize']].forEach(function (pair) {
      var node = el(pair[0]);
      if (node) bo[pair[1]] = !!node.checked;
    });
    S().bookingOs = bo;
  }

  function wireStorefrontRoot(root) {
    if (root._josSfBound) return;
    root._josSfBound = true;
    root.addEventListener('click', function (e) {
      var pick = e.target.closest('[data-jos-sf-pick]');
      if (pick) {
        root._josSfSelect = pick.getAttribute('data-jos-sf-pick');
        root._josSfTab = 'website';
        renderStorefront();
        e.stopPropagation();
        return;
      }
    });
    root.addEventListener('input', function (e) {
      var t = e.target;
      if (!(t instanceof Element)) return;
      if (t.getAttribute('data-jos-sf-live') != null || t.id && String(t.id).indexOf('jos-sf-') === 0) {
        sfApplyLiveFields(root);
        clearTimeout(root._josSfLiveT);
        root._josSfLiveT = setTimeout(function () { renderStorefront(); }, 120);
      }
    });
    root.addEventListener('change', function (e) {
      var t = e.target;
      if (!(t instanceof Element)) return;
      if (t.getAttribute('data-jos-sf-live') != null || (t.id && String(t.id).indexOf('jos-sf-bk-') === 0)) {
        sfApplyLiveFields(root);
        renderStorefront();
      }
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (root._josSfSvcModal) { root._josSfSvcModal = false; root._josSfDraft = null; return renderStorefront(); }
        if (root._josSfPublishOpen) { root._josSfPublishOpen = false; return renderStorefront(); }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (root._josSfUndo && root._josSfUndo.length) {
          var cur = sfSnapshotState();
          root._josSfRedo = root._josSfRedo || [];
          root._josSfRedo.push(cur);
          sfRestoreSnapshot(root, root._josSfUndo.pop());
        }
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (root._josSfRedo && root._josSfRedo.length) {
          var cur2 = sfSnapshotState();
          root._josSfUndo = root._josSfUndo || [];
          root._josSfUndo.push(cur2);
          sfRestoreSnapshot(root, root._josSfRedo.pop());
        }
      }
    });
  }

  function findStorefrontSvc(id) {
    return storefrontCatalog().find(function (s) { return String(s.id) === String(id); });
  }

  function handleStorefrontAct(act, t) {
    var root = el('jos-storefront-root');
    if (!root) return;
    ensureStorefrontOsState();
    var svcId = t && (t.getAttribute('data-jos-sf-svc') || t.getAttribute('data-jos-sf-svc-id') || (t.closest('[data-jos-sf-svc-id]') && t.closest('[data-jos-sf-svc-id]').getAttribute('data-jos-sf-svc-id')));
    try {
      if (act === 'sf-back') return switchNav('dashboard');
      if (act === 'sf-device') {
        root._josSfDevice = (t && t.getAttribute('data-jos-sf-device')) || 'desktop';
        return renderStorefront();
      }
      if (act === 'sf-pick') {
        root._josSfSelect = (t && t.getAttribute('data-jos-sf-pick')) || 'hero';
        root._josSfTab = 'website';
        return renderStorefront();
      }
      if (act === 'sf-ctx-tab') {
        root._josSfCtxTab = (t && t.getAttribute('data-jos-sf-ctx')) || 'content';
        return renderStorefront();
      }
      if (act === 'sf-publish-toggle') {
        root._josSfPublishOpen = !root._josSfPublishOpen;
        return renderStorefront();
      }
      if (act === 'sf-publish') {
        sfPushUndo(root);
        sfApplyLiveFields(root);
        root._josSfPublishOpen = false;
        toast('Published — your site is live.');
        return renderStorefront();
      }
      if (act === 'sf-schedule') { root._josSfPublishOpen = false; return toast('Schedule publish — coming soon.'); }
      if (act === 'sf-draft') { sfApplyLiveFields(root); root._josSfPublishOpen = false; toast('Draft saved.'); return renderStorefront(); }
      if (act === 'sf-history') { root._josSfPublishOpen = false; return toast('Publish history — coming soon.'); }
      if (act === 'sf-undo') {
        if (root._josSfUndo && root._josSfUndo.length) {
          root._josSfRedo = root._josSfRedo || [];
          root._josSfRedo.push(sfSnapshotState());
          sfRestoreSnapshot(root, root._josSfUndo.pop());
          toast('Undone');
        }
        return;
      }
      if (act === 'sf-redo') {
        if (root._josSfRedo && root._josSfRedo.length) {
          root._josSfUndo = root._josSfUndo || [];
          root._josSfUndo.push(sfSnapshotState());
          sfRestoreSnapshot(root, root._josSfRedo.pop());
          toast('Redone');
        }
        return;
      }
      if (act === 'sf-hero-img') return toast('Image picker — upload or stock photos coming next.');
      if (act === 'sf-hero-img-remove') { S().website.heroImage = ''; toast('Background image removed'); return renderStorefront(); }
      if (act === 'sf-badge-add') {
        S().website.heroBadges = (S().website.heroBadges || []).concat([{ icon: '✓', text: 'New badge' }]);
        return renderStorefront();
      }
      if (act === 'sf-section-add') return toast('Section library — add Hero, FAQ, CTA, and more.');
      if (act === 'sf-section-hide') {
        var sid = String(root._josSfSelect || '').replace('section:', '');
        if (sid) {
          (S().website.sections || []).forEach(function (s) { if (s.id === sid) s.visible = false; });
          toast('Section hidden on site');
          return renderStorefront();
        }
        return toast('Select a section first');
      }
      if (act === 'sf-theme-colors' || act === 'sf-theme-fonts' || act === 'sf-theme-reset') {
        if (act === 'sf-theme-reset') S().website.theme = { primary: '#16a34a', accent: '#D9632D', radius: 12, font: 'DM Sans' };
        else toast('Theme editor — ' + (act === 'sf-theme-colors' ? 'colors' : 'fonts') + ' panel coming next.');
        return renderStorefront();
      }
      if (act === 'sf-seo-ai' || act === 'sf-seo-improve') {
        var biz = S().biz || 'Local business';
        S().website.seoTitle = biz + ' — Book lawn care online';
        S().website.seoDescription = 'Professional lawn care and landscaping. Book online, see pricing, and schedule service in minutes.';
        toast('SEO copy generated — review in SEO tab.');
        root._josSfTab = 'seo';
        return renderStorefront();
      }
      if (act === 'sf-preview') {
        if (typeof global.previewProfile === 'function') return global.previewProfile();
        return toast('Preview not available in this session');
      }
      if (act === 'sf-preview-booking') {
        if (typeof global.previewBookingOverlay === 'function') return global.previewBookingOverlay();
        if (typeof global.previewBookingPage === 'function') return global.previewBookingPage();
        return toast('Booking preview not available');
      }
      if (act === 'sf-copy-url') return copyText('https://' + storefrontUrl());
      if (act === 'sf-site-save') {
        sfPushUndo(root);
        sfApplyLiveFields(root);
        var seoT = el('jos-sf-seo-title');
        var seoD = el('jos-sf-seo-desc');
        if (seoT) w.seoTitle = seoT.value || w.seoTitle;
        if (seoD) w.seoDescription = seoD.value || w.seoDescription;
        toast('Saved');
        return renderStorefront();
      }
      if (act === 'sf-seo-save') {
        var ws = S().website;
        ws.seoTitle = (el('jos-sf-seo-title') || {}).value || ws.seoTitle;
        ws.seoDescription = (el('jos-sf-seo-desc') || {}).value || ws.seoDescription;
        toast('SEO saved');
        return renderStorefront();
      }
      if (act === 'sf-domain-save') {
        var slug = String((el('jos-sf-slug') || {}).value || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
        if (!slug) { toast('Slug is required'); return; }
        S().slug = slug;
        toast('Slug saved · ' + storefrontUrl());
        return renderStorefront();
      }
      if (act === 'sf-dns-stage2') return toast('Stage 2 — custom domain DNS not connected yet');
      if (act === 'sf-analytics-stage2') return toast('Stage 2 — live analytics provider not connected yet');
      if (act === 'sf-gallery-upload') return toast('Stage 2 — gallery upload coming soon');
      if (act === 'sf-ai-refresh') {
        root._josSfAiBody = sfAiBody() + ' · Tip refreshed ' + new Date().toLocaleTimeString();
        S().storefrontOs.aiTip = root._josSfAiBody;
        S().storefrontOs.aiSeo = sfAiSeoBody();
        return renderStorefront();
      }
      if (act === 'sf-svc-add-open') {
        root._josSfSvcModal = true;
        root._josSfDraft = { website: true, status: 'active' };
        return renderStorefront();
      }
      if (act === 'sf-svc-add-cancel') {
        root._josSfSvcModal = false;
        root._josSfDraft = null;
        return renderStorefront();
      }
      if (act === 'sf-svc-edit' && svcId) {
        var editSvc = findStorefrontSvc(svcId);
        if (!editSvc) return toast('Service not found');
        root._josSfSvcModal = true;
        root._josSfDraft = Object.assign({}, editSvc);
        return renderStorefront();
      }
      if (act === 'sf-svc-archive' && svcId) {
        var arch = findStorefrontSvc(svcId);
        if (!arch) return toast('Service not found');
        arch.status = arch.status === 'archived' ? 'active' : 'archived';
        syncStorefrontCatalogToServices();
        toast(arch.status === 'archived' ? 'Service archived' : 'Service restored');
        return renderStorefront();
      }
      if (act === 'sf-svc-save') {
        var d = readStorefrontSvcDraft();
        if (!String(d.name || '').trim()) { toast('Service name is required'); return; }
        var cat = storefrontCatalog();
        if (d.id) {
          var existing = findStorefrontSvc(d.id);
          if (existing) Object.assign(existing, d, { status: existing.status || 'active' });
        } else {
          cat.push(normalizeStorefrontSvc({
            id: 'sf_svc_' + Date.now(),
            name: d.name,
            price: d.price,
            dur: d.dur,
            desc: d.desc,
            website: d.website,
            status: 'active'
          }, cat.length));
        }
        S().editorSvcs = cat;
        syncStorefrontCatalogToServices();
        root._josSfSvcModal = false;
        root._josSfDraft = null;
        toast('Service saved');
        return renderStorefront();
      }
      if (act === 'sf-pricing-save') {
        var priced = storefrontCatalog();
        priced.forEach(function (s) {
          var p = root.querySelector('[data-jos-sf-price="' + s.id + '"]');
          var du = root.querySelector('[data-jos-sf-dur="' + s.id + '"]');
          var dt = root.querySelector('[data-jos-sf-dep-type="' + s.id + '"]');
          var dv = root.querySelector('[data-jos-sf-dep-val="' + s.id + '"]');
          if (p) s.price = Number(p.value) || 0;
          if (du) s.dur = du.value || s.dur;
          if (dt) s.depositType = dt.value || s.depositType;
          if (dv) s.depositVal = Number(dv.value) || 0;
        });
        syncStorefrontCatalogToServices();
        toast('Pricing saved');
        return renderStorefront();
      }
      if (act === 'sf-pricing-edit' && svcId) {
        root._josSfTab = 'pricing';
        return renderStorefront();
      }
    } catch (err) {
      console.warn('HublyJourneyOS sf act', act, err);
      toast('Failed — try again');
    }
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
    dashboard: { title: 'Home', sub: 'Your Business Command Center — focus on what matters next.' },
    chats: { title: 'Messages', sub: 'Every conversation in one place.' },
    jobs: { title: 'Jobs', sub: 'Schedule, routes, and today\u2019s work.' },
    leads: { title: 'Leads', sub: 'Capture and convert new demand.' },
    customers: { title: 'Customers', sub: 'People, vehicles, and history.' },
    pipeline: { title: 'Pipeline', sub: 'Move every job from inquiry to booked.' },
    editor: { title: 'Storefront', sub: 'Your booking site and pages.' },
    marketing: { title: 'Marketing', sub: 'Campaigns that fill the calendar.' },
    reviews: { title: 'Reviews', sub: 'Track your reputation, respond faster, and generate more 5-star reviews.' },
    memberships: { title: 'Memberships', sub: 'Recurring revenue plans.' },
    money: { title: 'Dashboard', sub: 'Revenue, payouts, and cash flow.' },
    reports: { title: 'Reports', sub: 'Performance across the business.' },
    quotes: { title: 'Quotes', sub: 'Estimates and follow-ups.' },
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

  function widgetMenuHtml(widgetId) {
    var items = [
      ['wmenu-refresh', 'Refresh'],
      ['wmenu-duplicate', 'Duplicate Widget'],
      ['wmenu-move', 'Move'],
      ['wmenu-hide', 'Hide'],
      ['wmenu-pin', 'Pin'],
      ['wmenu-export', 'Export']
    ];
    return '<div class="jos-wmenu" data-jos-widget-id="' + esc(widgetId) + '">' +
      '<button type="button" class="jos-wmenu-btn" data-jos-act="wmenu-toggle" aria-label="Widget menu" title="Widget menu">⋯</button>' +
      '<div class="jos-wmenu-pop" hidden>' +
      items.map(function (it) {
        return '<button type="button" data-jos-act="' + esc(it[0]) + '" data-jos-widget-id="' + esc(widgetId) + '">' + esc(it[1]) + '</button>';
      }).join('') +
      '</div></div>';
  }

  function commandCenterActions(ctx) {
    var actions = [];
    var quoteVal = ctx.outstanding || 0;
    if (quoteVal > 0 || ctx.ceoDemo) {
      actions.push({
        title: 'You have ' + money(quoteVal || 2180) + ' in quotes that haven\'t been followed up.',
        meta: 'Estimated recover · ' + money(Math.round((quoteVal || 2180) * 0.42)),
        cta: 'Follow Up',
        act: 'go-quotes',
        tone: 'hot'
      });
    }
    if (ctx.openLeads > 0 || ctx.ceoDemo) {
      var leadN = ctx.openLeads || 5;
      actions.push({
        title: 'Respond to ' + leadN + ' new lead' + (leadN === 1 ? '' : 's'),
        meta: 'Estimated value · ' + money(ctx.leadValue || 920),
        cta: 'Respond',
        act: 'go-leads',
        tone: 'brand'
      });
    }
    if (ctx.gapHours >= 2 || ctx.ceoDemo) {
      actions.push({
        title: 'Tomorrow\'s schedule has a ' + (ctx.gapHours || 3) + '-hour gap.',
        meta: 'Fill with detail packages near your route',
        cta: 'Fill Schedule',
        act: 'go-jobs',
        tone: 'warn'
      });
    }
    actions.push({
      title: 'Ceramic Coating is converting 41% better than Interior Details.',
      meta: 'Potential monthly gain · +$480',
      cta: 'Promote Service',
      act: 'go-marketing',
      tone: 'ok'
    });
    if (ctx.staleCustomers > 0 || ctx.ceoDemo) {
      actions.push({
        title: (ctx.staleCustomers || 3) + ' repeat customers haven\'t booked in over 90 days.',
        meta: 'Win-back reminder ready',
        cta: 'Send Reminder',
        act: 'ask-share',
        tone: 'info'
      });
    }
    if (ctx.msgsWaiting > 0) {
      actions.push({
        title: ctx.msgsWaiting + ' conversation' + (ctx.msgsWaiting === 1 ? '' : 's') + ' need a reply.',
        meta: 'Missed chats hurt conversion',
        cta: 'Open Inbox',
        act: 'go-chats',
        tone: 'hot'
      });
    }
    actions.push({
      title: 'You haven\'t posted on Google this week.',
      meta: 'Keep local visibility warm',
      cta: 'Generate Post',
      act: 'ask',
      tone: 'info'
    });
    if (ctx.revBeat > 0 || ctx.ceoDemo) {
      actions.push({
        title: 'You\'re on track to beat last month\'s revenue by ' + money(ctx.revBeat || 1420) + '.',
        meta: 'Pace looks strong — protect the calendar',
        cta: 'See Forecast',
        act: 'go-reports',
        tone: 'ok'
      });
    }
    return actions.slice(0, 6);
  }

  function revenueChartSvg(range, series) {
    var vals = series || [42, 55, 48, 62, 70, 66, 78];
    var max = Math.max.apply(null, vals.concat([1]));
    var w = 420, h = 160, pad = 16;
    var step = (w - pad * 2) / Math.max(1, vals.length - 1);
    var pts = vals.map(function (v, i) {
      var x = pad + i * step;
      var y = h - pad - ((v / max) * (h - pad * 2));
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    var area = pad + ',' + (h - pad) + ' ' + pts + ' ' + (pad + (vals.length - 1) * step).toFixed(1) + ',' + (h - pad);
    var bars = vals.map(function (v, i) {
      var bw = Math.max(8, step * 0.45);
      var x = pad + i * step - bw / 2;
      var bh = (v / max) * (h - pad * 2);
      var y = h - pad - bh;
      return '<rect class="jos-rev-bar" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="4" data-jos-tip="' + esc(String(v)) + '"/>';
    }).join('');
    return '<svg class="jos-rev-chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Revenue ' + esc(range) + '">' +
      '<defs><linearGradient id="josRevFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(217,99,45,.35)"/><stop offset="100%" stop-color="rgba(217,99,45,0)"/></linearGradient></defs>' +
      '<polygon fill="url(#josRevFill)" points="' + area + '"/>' +
      '<polyline fill="none" stroke="#D9632D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="' + pts + '"/>' +
      bars +
      '</svg>';
  }

  function renderHomeDashboard(root) {
    root.innerHTML = '<div class="jos-page jos-home-page jos-home-v2"><div class="jos-home-loading" aria-live="polite">Loading Home…</div></div>';
    var today = todayStr();
    var allJobs = jobs().filter(function (j) { return !j.isBlock && j.status !== 'cancelled'; });
    var todayJobs = allJobs.filter(function (j) { return j.date === today; });
    var demoSched = false;
    var ceoDemo = !!S()._ceoDemo;
    if (!todayJobs.length) {
      demoSched = true;
      ceoDemo = true;
      todayJobs = [
        { id: 'demo_j1', customer: 'Sarah Johnson', service: 'Interior Detail', time: '9:00 AM', amount: 260, status: 'confirmed', address: 'La Jolla, CA', phone: '(619) 555-0198' },
        { id: 'demo_j2', customer: 'Mike Brown', service: 'Exterior Detail', time: '1:00 PM', amount: 180, status: 'confirmed', address: 'Pacific Beach, CA', phone: '(619) 555-0142' },
        { id: 'demo_j3', customer: 'Chris Park', service: 'Paint Correction', time: '4:00 PM', amount: 450, status: 'in_progress', address: 'Mission Valley, CA', phone: '(619) 555-0177' }
      ];
    }
    var completedToday = todayJobs.filter(function (j) { return j.status === 'completed'; });
    var weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    var weekJobsDone = allJobs.filter(function (j) {
      if (j.status !== 'completed') return false;
      var d = new Date(String(j.date || '') + 'T12:00:00');
      return !isNaN(d.getTime()) && d >= weekStart;
    }).length;
    var month = today.slice(0, 7);
    var monthJobsDone = allJobs.filter(function (j) { return j.status === 'completed' && String(j.date || '').slice(0, 7) === month; }).length;
    if (!monthJobsDone && ceoDemo) monthJobsDone = 28;
    if (!weekJobsDone && ceoDemo) weekJobsDone = 9;
    var completionPct = todayJobs.length ? Math.round((completedToday.length / todayJobs.length) * 100) : (ceoDemo ? 67 : 0);

    var todayRev = jobs().filter(function (j) { return j.status === 'completed' && j.date === today; }).reduce(function (s, j) { return s + (parseFloat(j.amount) || 0); }, 0);
    if (!todayRev && ceoDemo) todayRev = todayJobs.reduce(function (s, j) { return s + (parseFloat(j.amount) || 0); }, 0) * 0.35 || 845;
    var yest = new Date(); yest.setDate(yest.getDate() - 1);
    var yestStr = typeof global.dateStr === 'function' ? global.dateStr(yest) : yest.toISOString().slice(0, 10);
    var yestRev = jobs().filter(function (j) { return j.status === 'completed' && j.date === yestStr; }).reduce(function (s, j) { return s + (parseFloat(j.amount) || 0); }, 0);
    if (!yestRev && ceoDemo) yestRev = Math.round(todayRev * 0.88);
    var weekRev = jobs().filter(function (j) { return j.status === 'completed' && !j.isBlock; }).slice(0, 14).reduce(function (s, j) { return s + (parseFloat(j.amount) || 0); }, 0);
    if (!weekRev && ceoDemo) weekRev = Math.round(todayRev * 5.2);
    var monthRev = jobs().filter(function (j) { return j.status === 'completed' && String(j.date || '').slice(0, 7) === month; }).reduce(function (s, j) { return s + (parseFloat(j.amount) || 0); }, 0);
    if (!monthRev && ceoDemo) monthRev = Math.round(todayRev * 18);
    var outstanding = quotes().filter(function (q) { return q.status === 'sent' || q.status === 'draft'; }).reduce(function (s, q) { return s + (parseFloat(q.amount) || 0); }, 0);
    if (!outstanding && ceoDemo) outstanding = 2180;
    var revDelta = yestRev ? Math.round(((todayRev - yestRev) / yestRev) * 100) : (ceoDemo ? 12 : 0);
    var revBeat = Math.max(0, Math.round(monthRev * 0.12) || (ceoDemo ? 1420 : 0));

    var convs = conversations().length ? conversations() : (ceoDemo ? demoConversations() : []);
    var ch = channelCounts(convs);
    var msgsWaiting = convs.reduce(function (s, c) { return s + (c.unread || 0); }, 0);
    if (!msgsWaiting && ceoDemo) msgsWaiting = ch.needs || 5;

    var scores = homeScores();
    var hour = new Date().getHours();
    var greet = hour < 12 ? 'Good Morning' : (hour < 18 ? 'Good Afternoon' : 'Good Evening');
    var owner = S().ownerName || 'Adrian';
    if (typeof owner === 'string' && owner.indexOf('@') > -1) owner = owner.split('@')[0];
    if (owner.indexOf(' ') > -1) owner = owner.split(' ')[0];
    var bizName = S().biz || 'Pro Shine Detailing';
    var layout = homeLayout() || { widgets: {}, revRange: 'month', layoutPreset: 'owner' };
    if (!layout.widgets) layout.widgets = {};
    var W = layout.widgets;
    var revRange = root._josRevRange || layout.revRange || 'month';
    root._josRevRange = revRange;
    var sparkRev = [yestRev * 0.7, yestRev * 0.85, yestRev, todayRev * 0.6, todayRev * 0.8, todayRev * 0.9, todayRev].map(function (n) { return Math.max(8, Math.round(n / 40)); });
    var leadList = collectLeads();
    var openLeads = leadList.length || (ceoDemo ? 5 : 0);
    var leadValue = leadList.reduce(function (s, l) { return s + (parseFloat(l.value || l.amount || l.estimate) || 0); }, 0) || (ceoDemo ? 920 : 0);
    var reviews = (S().website && S().website.manualReviews) || [];
    var rating = Number(S().website && S().website.reviewRating) || (reviews[0] && reviews[0].rating) || 4.9;
    var reviewCount = Number(S().website && S().website.reviewCount) || reviews.length || (ceoDemo ? 128 : 0);
    var recentReview = reviews[0] || { name: 'Emily Wilson', text: 'Incredible ceramic coating — car looks brand new.', rating: 5 };
    var dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    var weatherTemp = 72;
    var weatherLbl = 'Sunny · 0% rain';
    var staleCustomers = customers().filter(function (c) {
      var last = c.lastJobDate || c.lastVisit || c.updatedAt;
      if (!last) return true;
      var d = new Date(last);
      return !isNaN(d.getTime()) && ((Date.now() - d.getTime()) / 86400000) > 90;
    }).length;

    var ccActions = commandCenterActions({
      outstanding: outstanding,
      openLeads: openLeads,
      leadValue: leadValue,
      gapHours: todayJobs.length < 3 ? 3 : 0,
      staleCustomers: staleCustomers,
      msgsWaiting: msgsWaiting,
      revBeat: revBeat,
      ceoDemo: ceoDemo
    });

    var chartSeries = {
      week: [todayRev * 0.6, todayRev * 0.8, yestRev, todayRev * 0.9, todayRev, weekRev / 5, weekRev / 4].map(function (n) { return Math.max(10, Math.round(n || 40)); }),
      month: [monthRev * 0.18, monthRev * 0.22, monthRev * 0.2, monthRev * 0.28, monthRev * 0.25, monthRev * 0.3, monthRev * 0.32].map(function (n) { return Math.max(20, Math.round((n || 80) / 10)); }),
      quarter: [62, 70, 68, 74, 80, 78, 88],
      year: [48, 52, 55, 60, 66, 72, 80]
    };

    var scoreMetrics = [
      { id: 'response', label: 'Response time', value: scores.leadResp, tip: 'Average reply is under 8 minutes. Industry average is 42 minutes. Turn on auto-SMS for after-hours leads.' },
      { id: 'reviews', label: 'Review score', value: scores.reviews, tip: 'Ask every completed job for a Google review within 2 hours.' },
      { id: 'website', label: 'Website completion', value: scores.marketing, tip: 'Add before/after photos and a clear ceramic CTA on Storefront.' },
      { id: 'bookings', label: 'Bookings', value: Math.min(99, 60 + todayJobs.length * 6), tip: 'Fill tomorrow\'s gap with a short exterior package promo.' },
      { id: 'retention', label: 'Customer retention', value: scores.membership, tip: 'Send a 90-day win-back to inactive repeat customers.' },
      { id: 'growth', label: 'Revenue growth', value: scores.revenue, tip: 'You are pacing ahead of last month — protect high-ticket slots.' },
      { id: 'missed', label: 'Missed opportunities', value: Math.max(40, 100 - (msgsWaiting * 4 + openLeads * 3)), tip: 'Clear inbox and quote follow-ups first for the biggest lift.' }
    ];

    function cardShell(widgetId, extraClass, inner) {
      var hidden = W[widgetId] === false ? ' jos-widget-hidden' : '';
      return '<section class="jos-hcard' + (extraClass ? ' ' + extraClass : '') + hidden + '" data-jos-widget="' + esc(widgetId) + '" draggable="true">' +
        widgetMenuHtml(widgetId) + inner + '</section>';
    }

    var hero = '<header class="jos-home-hero" data-jos-widget="hero">' +
      '<div class="jos-home-hero-main">' +
      '<h1>' + esc(greet) + ' ' + esc(owner) + ' <span aria-hidden="true">👋</span></h1>' +
      '<p class="jos-home-hero-biz">' + esc(bizName) + '</p>' +
      '<p class="jos-home-hero-motivation">Here\'s what deserves your attention next — Hubly is watching the business with you.</p>' +
      '</div>' +
      '<div class="jos-home-hero-meta">' +
      '<div class="jos-home-weather"><span class="jos-home-weather-temp">' + weatherTemp + '°F</span><span>' + esc(weatherLbl) + '</span></div>' +
      '<div class="jos-home-date">' + esc(dateLabel) + '</div>' +
      '<button type="button" class="jos-btn jos-btn-sm" data-jos-act="toggle-customize">Customize</button>' +
      '</div></header>';

    var kpiRow = '<div class="jos-home-kpis jos-home-kpi-row">' +
      cardShell('kpi-revenue', 'jos-kpi-card', 
        '<button type="button" class="jos-kpi-hit" data-jos-act="go-money">' +
        '<div class="jos-kpi-top"><span class="jos-kpi-ico" aria-hidden="true">$</span><span class="lbl">Revenue</span></div>' +
        '<div class="v">' + esc(canViewRevenue() ? money(todayRev) : '•••') + '</div>' +
        '<div class="jos-kpi-lines"><span>Today · ' + esc(canViewRevenue() ? money(todayRev) : 'Hidden') + '</span><span>Month · ' + esc(canViewRevenue() ? money(monthRev) : 'Hidden') + '</span></div>' +
        '<div class="s">' + (revDelta >= 0 ? '+' : '') + revDelta + '% growth</div>' +
        sparkSvg(sparkRev) +
        '<span class="jos-kpi-cta">View Revenue →</span></button>') +
      cardShell('kpi-jobs', 'jos-kpi-card',
        '<button type="button" class="jos-kpi-hit" data-jos-act="go-jobs">' +
        '<div class="jos-kpi-top"><span class="jos-kpi-ico" aria-hidden="true">✓</span><span class="lbl">Jobs Completed</span></div>' +
        '<div class="v">' + (completedToday.length || (ceoDemo ? 2 : 0)) + '</div>' +
        '<div class="jos-kpi-lines"><span>Today · ' + completedToday.length + '</span><span>Week · ' + weekJobsDone + '</span><span>Month · ' + monthJobsDone + '</span></div>' +
        '<div class="s">' + completionPct + '% completion</div>' +
        sparkSvg([2, 3, 4, 3, 5, 6, Math.max(1, completedToday.length || 2)], '#2563EB') +
        '<span class="jos-kpi-cta">Jobs Analytics →</span></button>') +
      cardShell('kpi-leads', 'jos-kpi-card',
        '<button type="button" class="jos-kpi-hit" data-jos-act="go-leads">' +
        '<div class="jos-kpi-top"><span class="jos-kpi-ico" aria-hidden="true">◎</span><span class="lbl">New Leads</span></div>' +
        '<div class="v">' + openLeads + '</div>' +
        '<div class="jos-kpi-lines"><span>Response · ~6 min</span><span>Conversion · 28%</span></div>' +
        '<div class="s">Newest first ready</div>' +
        sparkSvg([1, 2, 2, 4, 3, 5, openLeads || 3], '#B84E1F') +
        '<span class="jos-kpi-cta">Open Leads →</span></button>') +
      cardShell('kpi-rating', 'jos-kpi-card',
        '<button type="button" class="jos-kpi-hit" data-jos-act="go-reviews">' +
        '<div class="jos-kpi-top"><span class="jos-kpi-ico" aria-hidden="true">★</span><span class="lbl">Rating</span></div>' +
        '<div class="v">' + Number(rating).toFixed(1) + '</div>' +
        '<div class="jos-kpi-lines"><span>Google · ' + Number(rating).toFixed(1) + '</span><span>' + reviewCount + ' reviews</span></div>' +
        '<div class="s jos-kpi-quote">“' + esc(String(recentReview.text || recentReview.body || 'Great work').slice(0, 48)) + (String(recentReview.text || '').length > 48 ? '…' : '') + '”</div>' +
        sparkSvg([scores.reviews - 8, scores.reviews - 5, scores.reviews - 2, scores.reviews], '#15803D') +
        '<span class="jos-kpi-cta">Review Center →</span></button>') +
      '</div>';

    var ccRows = ccActions.map(function (a, i) {
      return '<div class="jos-cc-row tone-' + esc(a.tone || 'brand') + '">' +
        '<div class="jos-cc-idx">' + (i + 1) + '</div>' +
        '<div class="jos-cc-body"><div class="jos-cc-title">' + esc(a.title) + '</div><div class="jos-cc-meta">' + esc(a.meta) + '</div></div>' +
        '<button type="button" class="jos-btn jos-btn-brand jos-btn-sm" data-jos-act="' + esc(a.act) + '">' + esc(a.cta) + '</button>' +
        '</div>';
    }).join('');

    var commandCenter = cardShell('command', 'jos-command-card',
      '<div class="jos-cc-head">' +
      '<div><div class="jos-kicker">Business Command Center</div>' +
      '<h2>Here\'s what I\'d focus on today.</h2>' +
      '<p class="jos-muted">Live from bookings, revenue, missed leads, calendar, weather, reviews, website, and marketing.</p></div>' +
      btn('go-ask', 'Full AI Workspace', 'jos-btn jos-btn-sm') +
      '</div>' +
      '<div class="jos-cc-list">' + (ccRows || '<div class="jos-empty-action"><strong>You\'re clear for now</strong><p>Ask Hubly what to improve next, or fill the calendar.</p><div class="jos-btn-row">' + btn('go-jobs', 'Fill Schedule', 'jos-btn-brand jos-btn-sm') + btn('go-ask', 'Ask Hubly', 'jos-btn jos-btn-sm') + '</div></div>') + '</div>' +
      '<form class="jos-cc-chat" data-jos-act="cc-ask-form" onsubmit="return false;">' +
      '<input id="jos-home-cc-input" type="text" placeholder="Ask Hubly AI…" autocomplete="off" aria-label="Ask Hubly AI">' +
      '<button type="button" class="jos-btn jos-btn-brand" data-jos-act="cc-ask">Ask</button>' +
      '</form>');

    var timeline = todayJobs.length ? todayJobs.slice(0, 8).map(function (j) {
      var st = j.status === 'in_progress' || j.status === 'running' ? 'info' : (j.status === 'completed' ? 'ok' : 'warn');
      var stLbl = j.status === 'in_progress' || j.status === 'running' ? 'In Progress' : (j.status === 'completed' ? 'Done' : 'Scheduled');
      return '<button type="button" class="jos-today-item" data-jos-act="go-jobs" data-jos-job-id="' + esc(j.id || '') + '">' +
        '<div class="jos-today-time">' + esc(j.time || j.startTime || '—') + '</div>' +
        '<div class="jos-today-dot" aria-hidden="true"></div>' +
        '<div class="jos-today-body">' +
        '<div class="who">' + esc(j.customer || 'Customer') + '</div>' +
        '<div class="svc">' + esc(j.service || 'Job') + '</div>' +
        '<div class="jos-muted">' + esc(j.address || j.location || 'Address on file') + '</div>' +
        '</div><span class="jos-pill ' + st + '">' + esc(stLbl) + '</span></button>';
    }).join('') : '<div class="jos-empty-action"><strong>No appointments today</strong><p>Let\'s get your first job on the board.</p><div class="jos-btn-row">' + btn('new-job-cust', 'New Job', 'jos-btn-brand jos-btn-sm') + btn('go-marketing', 'Run Campaign', 'jos-btn jos-btn-sm') + '</div></div>';

    var todayPanel = cardShell('today', 'jos-today-card',
      '<div class="jos-between"><div><div class="jos-kicker">Today</div><h3 class="jos-card-title">Today\'s Timeline</h3></div>' +
      btn('go-jobs', 'View Calendar', 'jos-btn jos-btn-sm') + '</div>' +
      '<div class="jos-today-timeline">' + timeline + '</div>' +
      (demoSched ? '<p class="jos-muted jos-mt">Sample day for walkthrough — live jobs replace this automatically.</p>' : ''));

    var leadRows = (leadList.length ? leadList : (ceoDemo ? [
      { name: 'Alex Rivera', service: 'Ceramic Coating', location: 'La Jolla', time: '2m ago', status: 'New', value: 650 },
      { name: 'Jordan Lee', service: 'Interior Detail', location: 'PB', time: '18m ago', status: 'Contacted', value: 220 },
      { name: 'Sam Ortiz', service: 'Full Detail', location: 'Mission Valley', time: '1h ago', status: 'Quoted', value: 380 },
      { name: 'Riley Chen', service: 'Paint Correction', location: 'UTC', time: '3h ago', status: 'New', value: 520 }
    ] : [])).slice(0, 6).map(function (l) {
      return '<tr class="jos-leads-row">' +
        '<td><button type="button" class="jos-linkish" data-jos-act="go-customers">' + esc(l.name || l.customer || 'Lead') + '</button></td>' +
        '<td>' + esc(l.service || 'Service') + '</td>' +
        '<td>' + esc(l.location || l.city || l.address || '—') + '</td>' +
        '<td>' + esc(l.time || l.createdAt || l.date || '—') + '</td>' +
        '<td><button type="button" class="jos-pill warn" data-jos-act="go-leads">' + esc(l.status || 'New') + '</button></td>' +
        '<td><button type="button" class="jos-linkish" data-jos-act="go-quotes">' + esc(money(parseFloat(l.value || l.amount) || 0)) + '</button></td>' +
        '</tr>';
    }).join('');

    var recentLeads = cardShell('recent-leads', 'jos-leads-card',
      '<div class="jos-between"><div><div class="jos-kicker">Recent Leads</div><h3 class="jos-card-title">Newest conversations</h3></div>' +
      btn('go-leads', 'View All Leads', 'jos-btn jos-btn-sm') + '</div>' +
      (leadRows
        ? '<div class="jos-table-wrap"><table class="jos-home-table"><thead><tr><th>Customer</th><th>Service</th><th>Location</th><th>Time</th><th>Status</th><th>Value</th></tr></thead><tbody>' + leadRows + '</tbody></table></div>'
        : '<div class="jos-empty-action"><strong>No leads yet</strong><p>Let\'s get your first customer.</p><div class="jos-btn-row">' + btn('go-editor', 'Generate Website', 'jos-btn-brand jos-btn-sm') + btn('go-marketing', 'Run Marketing Campaign', 'jos-btn jos-btn-sm') + btn('copy-link', 'Share Booking Link', 'jos-btn jos-btn-sm') + '</div></div>'));

    var revFilters = ['week', 'month', 'quarter', 'year'].map(function (r) {
      return '<button type="button" class="jos-chip' + (revRange === r ? ' on' : '') + '" data-jos-act="rev-range" data-jos-range="' + r + '">' + (r.charAt(0).toUpperCase() + r.slice(1)) + '</button>';
    }).join('');

    var revenueSummary = cardShell('revenue-chart', 'jos-revsum-card',
      '<div class="jos-between"><div><div class="jos-kicker">Revenue Summary</div><h3 class="jos-card-title">Interactive graph</h3></div>' +
      '<div class="jos-chip-row">' + revFilters + '</div></div>' +
      '<button type="button" class="jos-rev-chart-btn" data-jos-act="go-money" title="Open Revenue Analytics">' +
      revenueChartSvg(revRange, chartSeries[revRange] || chartSeries.month) +
      '<div class="jos-rev-tip jos-muted">Hover points · Revenue · Jobs · Average ticket</div></button>' +
      '<div class="jos-rev-stats">' +
      '<div><span class="jos-muted">Revenue</span><strong>' + esc(canViewRevenue() ? money(revRange === 'week' ? weekRev : monthRev) : '•••') + '</strong></div>' +
      '<div><span class="jos-muted">Jobs</span><strong>' + (revRange === 'week' ? weekJobsDone : monthJobsDone) + '</strong></div>' +
      '<div><span class="jos-muted">Avg ticket</span><strong>' + esc(canViewRevenue() ? money(Math.round((monthRev || todayRev || 1) / Math.max(1, monthJobsDone || 1))) : '•••') + '</strong></div>' +
      '</div>');

    var scoreExpanded = root._josScoreExpand || null;
    var scoreRows = scoreMetrics.map(function (m) {
      var open = scoreExpanded === m.id;
      return '<div class="jos-score-metric' + (open ? ' open' : '') + '">' +
        '<button type="button" class="jos-score-metric-btn" data-jos-act="score-expand" data-jos-score="' + esc(m.id) + '">' +
        '<span>' + esc(m.label) + '</span><strong>' + m.value + '</strong></button>' +
        (open ? '<div class="jos-score-tip"><p>' + esc(m.tip) + '</p><div class="jos-btn-row">' + btn('go-ask', 'AI tips', 'jos-btn-brand jos-btn-sm') + btn('ask', 'Automations', 'jos-btn jos-btn-sm') + '</div></div>' : '') +
        '</div>';
    }).join('');

    var businessScore = cardShell('biz-score', 'jos-score-card',
      '<div class="jos-between"><div><div class="jos-kicker">Business Score</div><h3 class="jos-card-title">Health at a glance</h3></div></div>' +
      '<div class="jos-score-ring-wrap">' +
      '<div class="jos-score-ring" style="--jos-pct:' + scores.overall + '"><span>' + scores.overall + '</span></div>' +
      '<div><strong>' + (scores.overall >= 85 ? 'Excellent' : (scores.overall >= 70 ? 'Strong' : 'Needs focus')) + '</strong>' +
      '<p class="jos-muted">0–100 from response, reviews, website, bookings, retention, growth, and missed opportunities.</p></div></div>' +
      '<div class="jos-score-metrics">' + scoreRows + '</div>');

    var quickActs = [
      ['manual-lead', 'New Lead'],
      ['smart-quote', 'New Quote'],
      ['new-job-cust', 'New Job'],
      ['go-chats', 'Send Message'],
      ['ask-review', 'Request Review'],
      ['new-invoice', 'Create Invoice'],
      ['go-jobs', 'Update Availability'],
      ['go-editor', 'Edit Storefront'],
      ['ask', 'Generate Social Post'],
      ['go-ask', 'Open AI Coach']
    ];
    var quickRow = cardShell('quick', 'jos-quick-card',
      '<div class="jos-kicker">Quick Actions</div>' +
      '<div class="jos-quick-row">' + quickActs.map(function (q) {
        return '<button type="button" class="jos-quick-btn" data-jos-act="' + esc(q[0]) + '">' + esc(q[1]) + '</button>';
      }).join('') + '</div>');

    var customizeHtml = '<div class="jos-customize" id="jos-home-customize">' +
      '<div class="jos-between"><div class="jos-kicker">Dashboard customization</div>' + btn('save-home-layout', 'Save layout', 'jos-btn-brand jos-btn-sm') + '</div>' +
      '<p class="jos-muted">Hide widgets, pick a role layout, and save your operating view.</p>' +
      '<div class="jos-layout-presets">' +
      [['owner', 'Owner'], ['office', 'Office Manager'], ['employee', 'Employee'], ['sales', 'Sales'], ['franchise', 'Franchise']].map(function (p) {
        return '<button type="button" class="jos-chip' + ((layout.layoutPreset || 'owner') === p[0] ? ' on' : '') + '" data-jos-act="layout-preset" data-jos-preset="' + p[0] + '">' + p[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="jos-customize-grid">' +
      [['kpi-revenue', 'Revenue'], ['kpi-jobs', 'Jobs'], ['kpi-leads', 'Leads'], ['kpi-rating', 'Rating'], ['command', 'Command Center'], ['today', 'Today'], ['recent-leads', 'Recent Leads'], ['revenue-chart', 'Revenue Chart'], ['biz-score', 'Business Score'], ['quick', 'Quick Actions']].map(function (w) {
        return '<label><input type="checkbox" data-jos-widget-toggle="' + w[0] + '"' + (W[w[0]] === false ? '' : ' checked') + '> ' + w[1] + '</label>';
      }).join('') +
      '</div></div>';

    var fab = '<button type="button" class="jos-home-fab" data-jos-act="home-fab" aria-label="Quick actions">+</button>' +
      '<div class="jos-home-fab-sheet" id="jos-home-fab-sheet" hidden>' +
      quickActs.map(function (q) {
        return '<button type="button" data-jos-act="' + esc(q[0]) + '">' + esc(q[1]) + '</button>';
      }).join('') + '</div>';

    var notifs = [
      { act: 'go-jobs', t: 'Recent booking', s: 'Mike Brown confirmed for 1:00 PM', ago: '18m' },
      { act: 'go-chats', t: 'Missed chat', s: '3 conversations need a reply', ago: 'now' },
      { act: 'go-leads', t: 'New lead', s: 'Alex Rivera asked about ceramic coating', ago: '2m' },
      { act: 'go-reviews', t: 'Review received', s: 'Emily left a 5-star Google review', ago: '3h' },
      { act: 'go-money', t: 'Payment completed', s: 'Stripe deposited $1,240', ago: '1h' }
    ];

    root.innerHTML =
      '<div class="jos-page jos-home-page jos-home-v2">' +
      customizeHtml +
      hero +
      kpiRow +
      '<div class="jos-home-row-cc">' + commandCenter + todayPanel + '</div>' +
      '<div class="jos-home-row-3">' + recentLeads + revenueSummary + businessScore + '</div>' +
      quickRow +
      fab +
      '</div>';

    bindRoot(root);
    if (!root._josHomeBound) {
      root._josHomeBound = true;
      root.addEventListener('click', function (e) {
        var menuBtn = e.target.closest('[data-jos-act="wmenu-toggle"]');
        if (menuBtn) {
          var wrap = menuBtn.closest('.jos-wmenu');
          var pop = wrap && wrap.querySelector('.jos-wmenu-pop');
          root.querySelectorAll('.jos-wmenu-pop').forEach(function (p) { if (p !== pop) p.hidden = true; });
          if (pop) pop.hidden = !pop.hidden;
          e.stopPropagation();
          return;
        }
        if (e.target.closest('[data-jos-act="wmenu-hide"]')) {
          var wid = e.target.closest('[data-jos-act="wmenu-hide"]').getAttribute('data-jos-widget-id');
          var nextHide = homeLayout() || {};
          nextHide.widgets = nextHide.widgets || {};
          nextHide.widgets[wid] = false;
          saveHomeLayout(nextHide);
          toast('Widget hidden — Customize to restore');
          enhanceDashboard();
          e.stopPropagation();
          return;
        }
        if (e.target.closest('[data-jos-act="wmenu-refresh"]')) {
          toast('Widget refreshed');
          enhanceDashboard();
          e.stopPropagation();
          return;
        }
        if (e.target.closest('[data-jos-act="wmenu-pin"]')) {
          toast('Widget pinned to top of layout');
          e.stopPropagation();
          return;
        }
        if (e.target.closest('[data-jos-act="wmenu-duplicate"]') || e.target.closest('[data-jos-act="wmenu-move"]') || e.target.closest('[data-jos-act="wmenu-export"]')) {
          toast('Layout editor saved for this session');
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
          next.widgets = next.widgets || {};
          next.revRange = root._josRevRange || 'month';
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
        var presetBtn = e.target.closest('[data-jos-act="layout-preset"]');
        if (presetBtn) {
          var preset = presetBtn.getAttribute('data-jos-preset');
          var lp = homeLayout() || { widgets: {} };
          lp.layoutPreset = preset;
          lp.widgets = lp.widgets || {};
          if (preset === 'employee') {
            lp.widgets['kpi-revenue'] = false;
            lp.widgets['revenue-chart'] = false;
            lp.widgets['biz-score'] = false;
          } else if (preset === 'sales') {
            lp.widgets['kpi-jobs'] = false;
            lp.widgets.today = false;
          } else {
            Object.keys(lp.widgets).forEach(function (k) { lp.widgets[k] = true; });
          }
          saveHomeLayout(lp);
          toast((presetBtn.textContent || 'Layout') + ' layout applied');
          enhanceDashboard();
          e.stopPropagation();
          return;
        }
        var rangeBtn = e.target.closest('[data-jos-act="rev-range"]');
        if (rangeBtn) {
          root._josRevRange = rangeBtn.getAttribute('data-jos-range') || 'month';
          var lr = homeLayout() || {};
          lr.revRange = root._josRevRange;
          saveHomeLayout(lr);
          enhanceDashboard();
          e.stopPropagation();
          return;
        }
        var scoreBtn = e.target.closest('[data-jos-act="score-expand"]');
        if (scoreBtn) {
          var sid = scoreBtn.getAttribute('data-jos-score');
          root._josScoreExpand = root._josScoreExpand === sid ? null : sid;
          enhanceDashboard();
          e.stopPropagation();
          return;
        }
        if (e.target.closest('[data-jos-act="cc-ask"]') || e.target.closest('[data-jos-act="cc-ask-form"]')) {
          var input = el('jos-home-cc-input');
          var q = (input && input.value) || 'What should I focus on right now?';
          switchNav('ask');
          setTimeout(function () { HublyJourneyOS._askFromInput(q); }, 40);
          e.stopPropagation();
          return;
        }
        if (e.target.closest('[data-jos-act="home-fab"]')) {
          var sheet = el('jos-home-fab-sheet');
          if (sheet) sheet.hidden = !sheet.hidden;
          e.stopPropagation();
          return;
        }
      });
      root.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target && e.target.id === 'jos-home-cc-input') {
          e.preventDefault();
          var askBtn = root.querySelector('[data-jos-act="cc-ask"]');
          if (askBtn) askBtn.click();
        }
      });
      root.addEventListener('dragstart', function (e) {
        var card = e.target.closest('[data-jos-widget].jos-hcard');
        if (!card) return;
        root._josDragWidget = card.getAttribute('data-jos-widget');
        card.classList.add('jos-dragging');
      });
      root.addEventListener('dragend', function (e) {
        var card = e.target.closest('.jos-hcard');
        if (card) card.classList.remove('jos-dragging');
        root._josDragWidget = null;
      });
    }

    // Soft realtime refresh markers
    if (!root._josLiveTimer) {
      root._josLiveTimer = setInterval(function () {
        if (!document.body.contains(root)) {
          clearInterval(root._josLiveTimer);
          root._josLiveTimer = null;
          return;
        }
        if (document.hidden) return;
        if (root.classList.contains('jos-customize-on')) return;
        if (root.querySelector('.jos-wmenu-pop:not([hidden])')) return;
        if (el('jos-home-cc-input') && document.activeElement === el('jos-home-cc-input')) return;
        // Lightweight pulse: re-render on a gentle cadence for live feel
        if (!root._josLiveTick) root._josLiveTick = 0;
        root._josLiveTick += 1;
        if (root._josLiveTick % 2 === 0) enhanceDashboard();
      }, 30000);
    }

    wireGlobalChrome(notifs);
    wireHomeProfileMenu();
  }

  function wireHomeProfileMenu() {
    var biz = document.querySelector('#p-app.jos-pixel .jos-bar-biz');
    if (!biz || biz._josProfileWired) return;
    biz._josProfileWired = true;
    biz.style.cursor = 'pointer';
    biz.setAttribute('tabindex', '0');
    biz.setAttribute('role', 'button');
    biz.setAttribute('aria-label', 'Profile menu');
    biz.addEventListener('click', function (e) {
      e.stopPropagation();
      var pop = el('jos-profile-pop');
      if (!pop) {
        pop = document.createElement('div');
        pop.id = 'jos-profile-pop';
        pop.className = 'jos-profile-pop';
        pop.innerHTML = [
          ['go-settings', 'Business Profile'],
          ['go-settings', 'Subscription'],
          ['go-settings', 'Team'],
          ['go-settings', 'Settings'],
          ['sign-out', 'Logout']
        ].map(function (x) {
          return '<button type="button" data-jos-act="' + esc(x[0]) + '">' + esc(x[1]) + '</button>';
        }).join('');
        document.body.appendChild(pop);
        pop.addEventListener('click', function (ev) {
          var b = ev.target.closest('[data-jos-act]');
          if (!b) return;
          var act = b.getAttribute('data-jos-act');
          pop.classList.remove('open');
          if (act === 'sign-out') return typeof global.signOut === 'function' ? global.signOut() : null;
          if (act === 'go-settings') return switchNav('settings');
        });
        document.addEventListener('click', function (ev) {
          if (!pop.classList.contains('open')) return;
          if (!pop.contains(ev.target) && !ev.target.closest('.jos-bar-biz')) pop.classList.remove('open');
        });
      }
      var r = biz.getBoundingClientRect();
      pop.style.top = (r.bottom + 8) + 'px';
      pop.style.left = Math.max(12, Math.min(r.right - 220, window.innerWidth - 240)) + 'px';
      pop.classList.toggle('open');
    });
  }

  function runGlobalSearch(q) {
    q = String(q || '').trim().toLowerCase();
    var hits = [];
    if (!q) {
      hits.push({ act: 'go-ask', t: 'Ask Hubly', s: 'Search customers, jobs, invoices, messages, services, quotes…' });
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
    quotes().forEach(function (qt) {
      var blob = ((qt.customer || qt.name || '') + ' ' + (qt.service || '') + ' ' + (qt.status || '') + ' ' + String(qt.amount || '')).toLowerCase();
      if (blob.indexOf(q) > -1) hits.push({ act: 'go-quotes', t: qt.customer || qt.name || 'Quote', s: 'Quote · ' + money(parseFloat(qt.amount) || 0) });
    });
    try {
      var invs = (S().invoices || S().revenueOs && S().revenueOs.invoices) || [];
      (invs || []).forEach(function (inv) {
        var blob = ((inv.customer || inv.name || '') + ' ' + (inv.number || inv.id || '') + ' ' + String(inv.amount || '')).toLowerCase();
        if (blob.indexOf(q) > -1) hits.push({ act: 'go-money', t: inv.customer || inv.number || 'Invoice', s: 'Invoice · ' + money(parseFloat(inv.amount) || 0) });
      });
    } catch (eInv) {}
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
    if ('ai knowledge coach command'.indexOf(q) > -1 || q.indexOf('ai') > -1) {
      hits.push({ act: 'go-ask', t: 'AI Knowledge', s: 'Ask Hubly · Business Command Center' });
    }
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
      search.placeholder = 'Search customers, jobs, invoices...';
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
    pop.innerHTML = [['new-job-cust', 'New Job'], ['manual-lead', 'New Lead'], ['add-cust', 'New Customer'], ['smart-quote', 'New Quote'], ['new-invoice', 'New Invoice'], ['go-editor', 'New Service']].map(function (x) {
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
      if (!j.photos || typeof j.photos !== 'object' || Array.isArray(j.photos)) j.photos = { before: [], after: [] };
      if (!Array.isArray(j.photos.before)) j.photos.before = [];
      if (!Array.isArray(j.photos.after)) j.photos.after = [];
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
    setStorefrontMode(v === 'editor');
    var map = {
      pipeline: renderPipeline,
      opportunities: renderOpportunities,
      activity: renderActivity,
      ask: renderAskHubly,
      'ask-hubly': renderAskHubly,
      marketing: renderMarketing,
      memberships: renderMemberships,
      money: renderRevenue,
      reports: renderReportsPage,
      growth: renderGrowth,
      reviews: renderReviews,
      settings: renderSettingsHub,
      leads: renderLeads,
      customers: renderCustomers,
      dashboard: enhanceDashboard,
      chats: renderInbox,
      jobs: renderJobs,
      editor: renderStorefront
    };
    if (map[v]) try { map[v](); } catch (e) { console.warn('HublyJourneyOS', v, e); }
  }

  function bindRoot(root) {
    if (!root || root._josBound) return; root._josBound = true;
    root.addEventListener('click', function (e) {
      var t = e.target.closest('[data-jos-act],[data-jos-ask],[data-jos-card],[data-jos-pipe-card],[data-jos-opp],[data-jos-lead],[data-jos-lead-row],[data-jos-lead-id],[data-jos-lead-filter],[data-jos-leads-tab],[data-jos-lead-ws],[data-jos-cust-row],[data-jos-cust-tab],[data-jos-cust],[data-jos-sf-tab],[data-jos-mkt-tab],[data-jos-rev-tab],[data-jos-rev-source],[data-jos-mem-tab],[data-jos-rve-tab],[data-jos-rpt-tab],[data-jos-ah-tab],[data-jos-set-tab],[data-jos-tab],[data-jos-job],[data-jos-inbox-tab],[data-jos-inbox-id]'); if (!t) return;
      if (t.hasAttribute('data-jos-inbox-tab')) {
        var irTab = el('jos-inbox-root'); if (irTab) { irTab._josInboxTab = t.getAttribute('data-jos-inbox-tab'); renderInbox(); }
        return;
      }
      if (t.hasAttribute('data-jos-inbox-id')) {
        var irId = el('jos-inbox-root'); if (irId) { irId._josInboxId = t.getAttribute('data-jos-inbox-id'); renderInbox(); }
        return;
      }
      if (t.hasAttribute('data-jos-leads-tab')) {
        var ltRoot = el('jos-leads-root'); if (ltRoot) { ltRoot._josLeadsTab = t.getAttribute('data-jos-leads-tab'); renderLeads(); }
        return;
      }
      if (t.hasAttribute('data-jos-lead-ws')) {
        var lwRoot = el('jos-leads-root'); if (lwRoot) { lwRoot._josLeadWorkspace = t.getAttribute('data-jos-lead-ws'); renderLeads(); }
        return;
      }
      if (t.hasAttribute('data-jos-lead-id')) {
        var liRoot = el('jos-leads-root'); if (liRoot) { liRoot._josLeadId = t.getAttribute('data-jos-lead-id'); liRoot._josLeadWorkspace = liRoot._josLeadWorkspace || 'overview'; renderLeads(); }
        return;
      }
      if (t.hasAttribute('data-jos-card')) {
        var cards = el('jos-pipeline-root')?._josCards || [];
        return openCard(cards.find(function (c) { return String(c.id) === String(t.getAttribute('data-jos-card')); }));
      }
      if (t.hasAttribute('data-jos-pipe-card')) {
        var pr = el('jos-pipeline-root');
        if (pr) { pr._josPipeId = t.getAttribute('data-jos-pipe-card'); renderPipeline(); }
        return;
      }
      if (t.hasAttribute('data-jos-lead-filter')) {
        var leadsRoot = el('jos-leads-root'); if (leadsRoot) { leadsRoot._josLeadFilter = t.getAttribute('data-jos-lead-filter'); renderLeads(); }
        return;
      }
      if (t.hasAttribute('data-jos-lead-row')) {
        var lr = el('jos-leads-root'); if (lr) { lr._josLeadId = t.getAttribute('data-jos-lead-row') || t.getAttribute('data-jos-lead-id'); renderLeads(); }
        return;
      }
      if (t.hasAttribute('data-jos-lead')) { var key = t.getAttribute('data-jos-lead'); if (key && typeof global.viewLead === 'function') global.viewLead(key); return; }
      if (t.hasAttribute('data-jos-cust-tab')) {
        var cr = el('jos-customers-root'); if (cr) { cr._josCustTab = t.getAttribute('data-jos-cust-tab'); renderCustomers(); }
        return;
      }
      if (t.hasAttribute('data-jos-sf-tab')) {
        var sfr = el('jos-storefront-root'); if (sfr) { sfr._josSfTab = t.getAttribute('data-jos-sf-tab'); renderStorefront(); }
        return;
      }
      if (t.hasAttribute('data-jos-mkt-tab')) {
        var mkr = el('jos-marketing-root'); if (mkr) { mkr._josMktTab = t.getAttribute('data-jos-mkt-tab'); renderMarketing(); }
        return;
      }
      if (t.hasAttribute('data-jos-rev-tab')) {
        var revr = el('jos-reviews-root'); if (revr) { revr._josRevTab = t.getAttribute('data-jos-rev-tab'); renderReviews(); }
        return;
      }
      if (t.hasAttribute('data-jos-rev-source')) {
        var revs = el('jos-reviews-root'); if (revs) { revs._josRevSource = t.getAttribute('data-jos-rev-source'); renderReviews(); }
        return;
      }
      if (t.hasAttribute('data-jos-mem-tab')) {
        var memr = el('jos-memberships-root'); if (memr) { memr._josMemTab = t.getAttribute('data-jos-mem-tab'); renderMemberships(); }
        return;
      }
      if (t.hasAttribute('data-jos-rve-tab')) {
        var rver = el('jos-revenue-root'); if (rver) { rver._josRveTab = t.getAttribute('data-jos-rve-tab'); renderRevenue(); }
        return;
      }
      if (t.hasAttribute('data-jos-rpt-tab')) {
        var rptr = el('jos-reports-root'); if (rptr) { rptr._josRptTab = t.getAttribute('data-jos-rpt-tab'); renderReportsPage(); }
        return;
      }
      if (t.hasAttribute('data-jos-ah-tab')) {
        var ahr = el('jos-ask-root'); if (ahr) { ahr._josAhTab = t.getAttribute('data-jos-ah-tab'); renderAskHubly(); }
        return;
      }
      if (t.hasAttribute('data-jos-set-tab')) {
        var setr = el('jos-settings-root'); if (setr) { setr._josSetTab = t.getAttribute('data-jos-set-tab'); ensureSettingsOsState().tab = setr._josSetTab; renderSettings(); }
        return;
      }
      if (t.hasAttribute('data-jos-cust-row')) {
        var crow = el('jos-customers-root');
        if (crow) {
          crow._josCustId = t.getAttribute('data-jos-cust-row');
          S().activeCustId = crow._josCustId;
          renderCustomers();
          openCustomerProfile(crow._josCustId);
        }
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
      if (act && String(act).indexOf('leads-') === 0) return handleLeadsAct(act, t);
      if (act && String(act).indexOf('pipe-') === 0) return handlePipelineAct(act, t);
      if (act && (String(act).indexOf('cust-') === 0 || String(act).indexOf('customers-') === 0)) return handleCustomersAct(act, t);
      if (act && String(act).indexOf('sf-') === 0) return handleStorefrontAct(act, t);
      if (act && String(act).indexOf('mkt-') === 0) return handleMarketingAct(act, t);
      if (act && String(act).indexOf('rev-') === 0) return handleReviewsAct(act, t);
      if (act && String(act).indexOf('mem-') === 0) return handleMembershipsAct(act, t);
      if (act && String(act).indexOf('rve-') === 0) return handleRevenueAct(act, t);
      if (act && String(act).indexOf('rpt-') === 0) return handleReportsAct(act, t);
      if (act && String(act).indexOf('ah-') === 0) return handleAskHublyAct(act, t);
      if (act && String(act).indexOf('set-') === 0) return handleSettingsAct(act, t);
      if (act === 'ask-submit' || act === 'ask-brief') {
        switchNav('ask');
        return HublyJourneyOS._askFromInput(act === 'ask-brief' ? 'What should I focus on this morning?' : null);
      }
      if (act === 'manual-lead') return typeof global.openM === 'function' ? global.openM('m-new-lead') : toast('Add lead');
      if (act === 'add-cust') {
        var custRootAdd = el('jos-customers-root');
        if (custRootAdd) return handleCustomersAct('cust-add-open', t);
        return typeof global.openM === 'function' ? global.openM('m-new-cust') : toast('Add customer');
      }
      if (act === 'new-invoice') return typeof global.openM === 'function' ? global.openM('m-new-invoice') : toast('New invoice');
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
      if (act === 'go-marketing') return switchNav('marketing');
      if (act === 'go-quotes') return switchNav('quotes');
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
    handlePipelineAct: handlePipelineAct,
    renderOpportunities: renderOpportunities,
    renderActivity: renderActivity,
    renderAskHubly: renderAskHubly,
    handleAskHublyAct: handleAskHublyAct,
    renderSettings: renderSettings,
    renderSettingsHub: renderSettingsHub,
    handleSettingsAct: handleSettingsAct,
    renderMarketing: renderMarketing,
    handleMarketingAct: handleMarketingAct,
    renderMemberships: renderMemberships,
    handleMembershipsAct: handleMembershipsAct,
    renderRevenue: renderRevenue,
    handleRevenueAct: handleRevenueAct,
    renderReportsPage: renderReportsPage,
    renderReports: renderReports,
    handleReportsAct: handleReportsAct,
    renderGrowth: renderGrowth,
    renderReviews: renderReviews,
    handleReviewsAct: handleReviewsAct,
    renderBizReviews: renderBizReviews,
    renderLeads: renderLeads,
    renderLeadsList: renderLeadsList,
    renderCustomers: renderCustomers,
    renderCustomersPage: renderCustomers,
    renderInbox: renderInbox,
    renderJobs: renderJobs,
    renderStorefront: renderStorefront,
    handleStorefrontAct: handleStorefrontAct,
    openCustomerProfile: openCustomerProfile,
    handleCustomersAct: handleCustomersAct,
    closeCustomerProfile: closeCustomerProfile,
    enhanceDashboard: enhanceDashboard,
    openQuickNew: openQuickNew,
    onSwitchView: onSwitchView,
    updateChrome: updateChrome,
    _askFromInput: function (preset) {
      var input = el('jos-ask-input') || el('ai-question-input');
      ahAsk(preset || (input && input.value) || '');
      if (input && !preset) input.value = '';
    }
  };
  global.HublyJourneyOS = HublyJourneyOS;
})(typeof window !== 'undefined' ? window : this);


