/**
 * Owner Smart Quote UI — depends on HublySmartQuote + globals (S, toast, escPeHtml).
 */
(function (global) {
  function esc(s) {
    if (typeof global.escPeHtml === 'function') return global.escPeHtml(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** hubly.html uses `const S` (lexical global), not window.S */
  function appState() {
    try {
      if (typeof S !== 'undefined' && S) return S;
    } catch (e) {}
    return global.S || null;
  }

  function ensureState() {
    const st = appState();
    if (!st) return null;
    if (!Array.isArray(st.quotes)) st.quotes = [];
    if (!st.quoteConfig || typeof st.quoteConfig !== 'object') st.quoteConfig = {};
    if (!st._sq) {
      st._sq = {
        step: 0,
        packageIds: [],
        addonIds: [],
        answers: {},
        draftId: null,
      };
    }
    return st._sq;
  }

  function activeServices() {
    const list = (S.editorSvcs && S.editorSvcs.length ? S.editorSvcs : null) || S.services || [];
    return list
      .filter((x) => x && x.name)
      .map((x) => ({
        id: x.id || (HublySmartQuote && HublySmartQuote.slug(x.name)),
        name: x.name,
        price: x.price != null ? x.price : x.defaultPrice,
        dur: x.dur,
        desc: x.desc,
        category: x.category,
        image: x.image || x.imgUrl,
      }));
  }

  function activeAddons() {
    const list = S.editorAddons || S.addons || [];
    return (list || [])
      .filter((a) => a && (a.name || a.label))
      .map((a, i) => ({
        id: a.id || 'addon-' + i,
        name: a.name || a.label,
        price: Number(a.price) || 0,
      }));
  }

  function getConfig() {
    const SQ = global.HublySmartQuote;
    if (!SQ) return null;
    let bp = null;
    try {
      if (typeof getActiveBlueprint === 'function') bp = getActiveBlueprint();
    } catch (e) {}
    const cfg = SQ.resolveConfig({
      businessType: S.businessType || (bp && bp.id) || 'detailing',
      blueprint: bp,
      ownerConfig: S.quoteConfig,
      packagesFirst: true,
    });
    // Sync dirty surcharge % from owner booking settings when detailing
    if (cfg.trade === 'detailing' && S.dirtySurcharge && S.dirtySurcharge.enabled && cfg.fields.condition) {
      const d = S.dirtySurcharge;
      const type = d.type || 'percent';
      const map = [
        ['light', d.light],
        ['moderate', d.moderate],
        ['heavy', d.heavy],
        ['extreme', d.extreme],
      ];
      cfg.fields.condition.options = (cfg.fields.condition.options || []).map((opt, i) => {
        const raw = map[i] ? map[i][1] : '';
        const n = Number(raw);
        if (!Number.isFinite(n) || n === 0 && (raw === '' || raw == null)) return opt;
        if (type === 'percent') {
          return Object.assign({}, opt, { rule: { type: 'percent', value: n }, surcharge: 0 });
        }
        return Object.assign({}, opt, { rule: { type: 'flat', amount: n }, surcharge: 0 });
      });
    }
    return cfg;
  }

  function computeNow() {
    const SQ = global.HublySmartQuote;
    const st = ensureState();
    const cfg = getConfig();
    if (!SQ || !cfg || !st) return { total: 0, formatted: '$0', lineItems: [] };
    return SQ.compute(cfg, st, SQ.packagesFromServices(activeServices(), cfg), activeAddons());
  }

  function openNew() {
    const SQ = global.HublySmartQuote;
    const cfg = getConfig();
    if (!SQ || !cfg) {
      if (typeof toast === 'function') toast('Smart Quote engine not ready');
      return;
    }
    const pkgs = SQ.packagesFromServices(activeServices(), cfg);
    S._sq = {
      step: 0,
      packageIds: pkgs[0] ? [pkgs[0].id] : [],
      addonIds: [],
      answers: SQ.defaultAnswers(cfg),
      draftId: null,
      customer: { name: '', phone: '', email: '', notes: '' },
    };
    document.getElementById('sq-workspace')?.classList.remove('hidden');
    document.getElementById('sq-list-wrap')?.classList.add('hidden');
    renderWorkspace();
  }

  function closeWorkspace() {
    document.getElementById('sq-workspace')?.classList.add('hidden');
    document.getElementById('sq-list-wrap')?.classList.remove('hidden');
    renderList();
  }

  function setStep(i) {
    const st = ensureState();
    const cfg = getConfig();
    if (!st || !cfg) return;
    st.step = Math.max(0, Math.min((cfg.steps || []).length - 1, i));
    renderWorkspace();
  }

  function nextStep() {
    const cfg = getConfig();
    const st = ensureState();
    if (!cfg || !st) return;
    if (st.step >= cfg.steps.length - 1) return;
    setStep(st.step + 1);
  }

  function backStep() {
    const st = ensureState();
    if (!st) return;
    setStep(st.step - 1);
  }

  function togglePackage(id) {
    const st = ensureState();
    if (!st) return;
    const i = st.packageIds.indexOf(id);
    if (i >= 0) st.packageIds.splice(i, 1);
    else st.packageIds.push(id);
    renderWorkspace();
  }

  function resolveAccent(cfg) {
    let accent = (cfg && cfg.accent) || '#7c3aed';
    try {
      if (typeof getAccentColor === 'function') {
        const a = getAccentColor();
        if (a) accent = a;
      } else if (S.siteAccent || S.brandColor || S.color) {
        accent = S.siteAccent || S.brandColor || S.color;
      }
    } catch (e) {}
    return accent;
  }

  function setAnswer(fieldId, value) {
    const st = ensureState();
    const cfg = getConfig();
    if (!st) return;
    st.answers[fieldId] = value;
    const f = cfg && cfg.fields[fieldId];
    // Text / range: don't rebuild DOM (keeps focus + open "More details").
    if (f && (f.type === 'text' || f.type === 'textarea')) {
      renderSidebar();
      return;
    }
    if (f && f.type === 'range') {
      const lab = document.querySelector(`#sq-main .sq-field input[type=range][data-sq-field="${fieldId}"]`);
      if (lab && lab.previousElementSibling) {
        /* label is sibling structure: .sq-lbl then input */
      }
      const lbl = document.querySelector(`#sq-ans-range-${CSS.escape ? CSS.escape(fieldId) : fieldId}`);
      if (lbl) lbl.textContent = value;
      renderSidebar();
      return;
    }
    const moreOpen = !!document.querySelector('#sq-main details.sq-more[open]');
    renderWorkspace({ moreOpen });
  }

  function setCustomer(key, value) {
    const st = ensureState();
    if (!st) return;
    st.customer = st.customer || {};
    st.customer[key] = value;
    // don't full re-render inputs on every keystroke for text — update sidebar only
    renderSidebar();
  }

  function renderField(field) {
    const st = ensureState();
    const ans = st.answers[field.id];
    if (field.type === 'tiles') {
      return `<div class="sq-field"><div class="sq-lbl">${esc(field.label)}</div>
        <div class="sq-tiles">${(field.options || [])
          .map((o) => {
            const sel = ans === o.id ? ' sel' : '';
            return `<button type="button" class="sq-tile${sel}" onclick="HublySmartQuoteUI.setAnswer('${esc(field.id)}','${esc(o.id)}')">
              <strong>${esc(o.label)}</strong>
              ${o.desc ? `<span>${esc(o.desc)}</span>` : ''}
              ${o.surcharge ? `<em>+$${o.surcharge}</em>` : ''}
            </button>`;
          })
          .join('')}</div></div>`;
    }
    if (field.type === 'stepper') {
      return `<div class="sq-field"><div class="sq-lbl">${esc(field.label)}</div>
        <div class="sq-stepper">
          <button type="button" onclick="HublySmartQuoteUI.nudge('${esc(field.id)}',-1)">−</button>
          <strong id="sq-ans-${esc(field.id)}">${esc(ans)}</strong>
          <button type="button" onclick="HublySmartQuoteUI.nudge('${esc(field.id)}',1)">+</button>
        </div></div>`;
    }
    if (field.type === 'range') {
      return `<div class="sq-field"><div class="sq-lbl">${esc(field.label)}: <strong id="sq-ans-range-${esc(field.id)}">${esc(ans)}</strong></div>
        <input type="range" data-sq-field="${esc(field.id)}" min="${field.min || 0}" max="${field.max || 100}" step="${field.step || 1}" value="${esc(ans)}"
          oninput="HublySmartQuoteUI.setAnswer('${esc(field.id)}',+this.value)"></div>`;
    }
    if (field.type === 'toggle') {
      return `<label class="sq-toggle"><input type="checkbox" ${ans ? 'checked' : ''} onchange="HublySmartQuoteUI.setAnswer('${esc(field.id)}',this.checked)"> ${esc(field.label)}</label>`;
    }
    if (field.type === 'textarea') {
      return `<div class="sq-field"><div class="sq-lbl">${esc(field.label)}</div>
        <textarea rows="2" oninput="HublySmartQuoteUI.setAnswer('${esc(field.id)}',this.value)">${esc(ans || '')}</textarea></div>`;
    }
    return `<div class="sq-field"><div class="sq-lbl">${esc(field.label)}</div>
      <input type="text" value="${esc(ans || '')}" oninput="HublySmartQuoteUI.setAnswer('${esc(field.id)}',this.value)"></div>`;
  }

  function nudge(fieldId, delta) {
    const cfg = getConfig();
    const st = ensureState();
    const f = cfg && cfg.fields[fieldId];
    if (!f || !st) return;
    let v = Number(st.answers[fieldId]) || 0;
    v += delta;
    if (f.min != null) v = Math.max(f.min, v);
    if (f.max != null) v = Math.min(f.max, v);
    setAnswer(fieldId, v);
  }

  function renderSidebar() {
    const SQ = global.HublySmartQuote;
    const cfg = getConfig();
    const st = ensureState();
    const money = computeNow();
    const side = document.getElementById('sq-sidebar');
    if (!side || !cfg || !SQ) return;
    const onReview = st && cfg.steps && st.step >= cfg.steps.length - 1;
    const accent = resolveAccent(cfg);
    const actions = onReview
      ? `<button type="button" class="btn btn-ink sq-save-btn" onclick="HublySmartQuoteUI.markSent()">Mark as sent</button>
         <button type="button" class="btn btn-brand sq-save-btn" onclick="HublySmartQuoteUI.bookThisQuote()">Book this next</button>`
      : `<button type="button" class="btn btn-out sq-save-btn" onclick="HublySmartQuoteUI.saveDraft()">Save draft</button>`;
    side.innerHTML = SQ.renderEstimateCardHtml({
      accent,
      trade: cfg.trade,
      formatted: money.formatted,
      lineItems: money.lineItems,
      includes: cfg.includes,
      tip: cfg.tip,
      emptyText: 'Select a package to start',
      kicker: 'Customer estimate',
      actionsHtml: actions,
      formatMoney: SQ.formatMoney,
    });
  }

  function renderWorkspace(opts) {
    const SQ = global.HublySmartQuote;
    const cfg = getConfig();
    const st = ensureState();
    const root = document.getElementById('sq-main');
    if (!root || !cfg || !st || !SQ) return;
    const accent = resolveAccent(cfg);
    document.documentElement.style.setProperty('--sq-accent', accent);
    const moreOpen = !!(opts && opts.moreOpen);
    const step = cfg.steps[st.step] || cfg.steps[0];
    const prog = cfg.steps
      .map((s, i) => {
        const on = i === st.step ? ' on' : i < st.step ? ' done' : '';
        return `<button type="button" class="sq-prog-step${on}" onclick="HublySmartQuoteUI.setStep(${i})"><span>${i + 1}</span>${esc(s.title)}</button>`;
      })
      .join('');

    let body = '';
    if (step.id === 'packages') {
      const pkgs = SQ.packagesFromServices(activeServices(), cfg);
      body = `<div class="sq-pkg-grid">${pkgs
        .map((p) => {
          const sel = st.packageIds.includes(p.id) ? ' sel' : '';
          return `<button type="button" class="sq-pkg${sel}" onclick="HublySmartQuoteUI.togglePackage('${esc(p.id)}')">
            <div class="sq-pkg-top"><strong>${esc(p.name)}</strong><span>${SQ.formatMoney(p.price)}</span></div>
            <p>${esc(p.desc || '')}</p>
          </button>`;
        })
        .join('') || '<div class="sq-muted">Add services in Website editor — they show up here as packages. Or open Quote setup to add a custom package.</div>'}</div>`;
    } else if (step.id === 'customer') {
      const c = st.customer || {};
      body = `
        <div class="sq-field"><div class="sq-lbl">Name</div><input type="text" value="${esc(c.name || '')}" oninput="HublySmartQuoteUI.setCustomer('name',this.value)"></div>
        <div class="sq-field-row">
          <div class="sq-field"><div class="sq-lbl">Phone</div><input type="text" value="${esc(c.phone || '')}" oninput="HublySmartQuoteUI.setCustomer('phone',this.value)"></div>
          <div class="sq-field"><div class="sq-lbl">Email</div><input type="text" value="${esc(c.email || '')}" oninput="HublySmartQuoteUI.setCustomer('email',this.value)"></div>
        </div>
        <div class="sq-field"><div class="sq-lbl">Notes</div><textarea rows="3" oninput="HublySmartQuoteUI.setCustomer('notes',this.value)">${esc(c.notes || '')}</textarea></div>`;
    } else if (step.id === 'review') {
      const money = computeNow();
      const c = st.customer || {};
      body = `<div class="sq-review">
        <p><strong>${esc(c.name || 'Customer')}</strong> · ${esc(c.phone || 'no phone')} · ${esc(c.email || 'no email')}</p>
        <div class="sq-lines sq-lines-light">${(money.lineItems || [])
          .filter((l) => l.amount)
          .map((l) => `<div class="sq-line"><span>${esc(l.label)}</span><strong>${SQ.formatMoney(l.amount)}</strong></div>`)
          .join('')}</div>
        <div class="sq-review-total">Total ${esc(money.formatted)}</div>
        <p class="sq-disclaimer sq-disclaimer-light">${esc(SQ.estimateDisclaimer(cfg.trade))}</p>
        <p class="sq-muted" style="margin-top:10px;">Use the estimate panel to mark sent or book this quote.</p>
      </div>`;
    } else {
      const fields = SQ.fieldsForStep(cfg, step.id);
      const parts = SQ.partitionFields(fields);
      body =
        parts.primary.map(renderField).join('') ||
        '<div class="sq-muted">No fields on this step — open Quote setup to enable one.</div>';
      if (parts.secondary.length) {
        body += `<details class="sq-more"${moreOpen ? ' open' : ''}><summary>More details <span>(optional)</span></summary>${parts.secondary
          .map(renderField)
          .join('')}</details>`;
      }
      if (step.id === 'modifiers') {
        const addons = activeAddons();
        if (addons.length) {
          body += `<div class="sq-field"><div class="sq-lbl">Add-ons</div><div class="sq-tiles">${addons
            .map((a) => {
              const sel = st.addonIds.includes(a.id) ? ' sel' : '';
              return `<button type="button" class="sq-tile${sel}" onclick="HublySmartQuoteUI.toggleAddon('${esc(a.id)}')"><strong>${esc(a.name)}</strong><em>${SQ.formatMoney(a.price)}</em></button>`;
            })
            .join('')}</div></div>`;
        }
      }
    }

    const onReview = st.step >= cfg.steps.length - 1;
    root.innerHTML = `
      <div class="sq-head" style="--sq-accent:${esc(accent)}">
        <div>
          <div class="sq-kicker">${esc((S.businessType || cfg.trade || '').replace(/_/g, ' '))}</div>
          <h2>${esc(cfg.title)}</h2>
          <p>${esc(cfg.subtitle)}</p>
        </div>
        <button type="button" class="btn btn-out btn-sm" onclick="HublySmartQuoteUI.closeWorkspace()">Close</button>
      </div>
      <div class="sq-prog">${prog}</div>
      <div class="sq-step-title"><h3>${esc(step.title)}</h3><p>${esc(step.blurb || '')}</p></div>
      <div class="sq-body">${body}</div>
      <div class="sq-foot">
        <button type="button" class="btn btn-out" onclick="HublySmartQuoteUI.backStep()" ${st.step === 0 ? 'disabled' : ''}>Back</button>
        <button type="button" class="btn btn-brand" onclick="HublySmartQuoteUI.${
          onReview ? 'saveDraft()' : 'nextStep()'
        }">${onReview ? 'Save draft' : 'Next'}</button>
      </div>`;
    renderSidebar();
  }

  function toggleAddon(id) {
    const st = ensureState();
    if (!st) return;
    const i = st.addonIds.indexOf(id);
    if (i >= 0) st.addonIds.splice(i, 1);
    else st.addonIds.push(id);
    renderWorkspace();
  }

  function buildQuoteRecord(status) {
    const SQ = global.HublySmartQuote;
    const cfg = getConfig();
    const st = ensureState();
    const money = computeNow();
    const c = (st && st.customer) || {};
    const id = (st && st.draftId) || 'q-' + Date.now().toString(36);
    const prev = (S.quotes || []).find((q) => q.id === id);
    return {
      id,
      status: status || 'draft',
      createdAt: (prev && prev.createdAt) || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      trade: cfg.trade,
      customerName: c.name || 'Customer',
      customerPhone: c.phone || '',
      customerEmail: c.email || '',
      notes: c.notes || '',
      answers: Object.assign({}, st.answers),
      packageIds: (st.packageIds || []).slice(),
      addonIds: (st.addonIds || []).slice(),
      lineItems: money.lineItems || [],
      amount: money.total,
    };
  }

  function saveDraft() {
    const st = ensureState();
    if (!st) return;
    if (!(st.packageIds || []).length) {
      if (typeof toast === 'function') toast('Pick at least one package');
      return;
    }
    const rec = buildQuoteRecord('draft');
    st.draftId = rec.id;
    const idx = S.quotes.findIndex((q) => q.id === rec.id);
    if (idx >= 0) S.quotes[idx] = rec;
    else S.quotes.unshift(rec);
    if (typeof toast === 'function') toast('Quote saved');
    persistQuotes();
    closeWorkspace();
  }

  function markSent() {
    const st = ensureState();
    if (!st) return;
    if (!(st.packageIds || []).length) {
      if (typeof toast === 'function') toast('Pick at least one package');
      return;
    }
    const rec = buildQuoteRecord('sent');
    rec.sentAt = new Date().toISOString();
    st.draftId = rec.id;
    const idx = S.quotes.findIndex((q) => q.id === rec.id);
    if (idx >= 0) S.quotes[idx] = rec;
    else S.quotes.unshift(rec);
    if (typeof toast === 'function') toast('Quote marked sent — email send hooks in next pass');
    persistQuotes();
    closeWorkspace();
  }

  function persistQuotes() {
    try {
      localStorage.setItem('hubly_quotes_' + (S.slug || 'local'), JSON.stringify(S.quotes || []));
      localStorage.setItem('hubly_quote_config_' + (S.slug || 'local'), JSON.stringify(S.quoteConfig || {}));
    } catch (e) {}
  }

  function loadPersisted() {
    try {
      const q = JSON.parse(localStorage.getItem('hubly_quotes_' + (S.slug || 'local')) || '[]');
      if (Array.isArray(q)) S.quotes = q;
      const c = JSON.parse(localStorage.getItem('hubly_quote_config_' + (S.slug || 'local')) || '{}');
      if (c && typeof c === 'object') S.quoteConfig = c;
    } catch (e) {}
  }

  function renderList() {
    loadPersisted();
    const el = document.getElementById('sq-list');
    if (!el) return;
    const rows = (S.quotes || [])
      .map((q) => {
        return `<div class="sq-list-row" role="button" tabindex="0" onclick="HublySmartQuoteUI.openSaved('${esc(q.id)}')">
          <div>
            <strong>${esc(q.customerName || 'Customer')}</strong>
            <div class="sq-muted">${esc(q.status)} · ${esc((q.createdAt || '').slice(0, 10))} · ${esc(
              (q.trade || '').replace(/_/g, ' ')
            )}</div>
          </div>
          <div class="sq-list-amt">${HublySmartQuote.formatMoney(q.amount || 0)}</div>
        </div>`;
      })
      .join('');
    el.innerHTML =
      rows ||
      '<div class="empty" style="padding:28px;"><div class="empty-msg">No quotes yet — start a Smart Quote for a customer.</div></div>';
  }

  function openSaved(id) {
    loadPersisted();
    const rec = (S.quotes || []).find((q) => q.id === id);
    if (!rec) {
      if (typeof toast === 'function') toast('Quote not found');
      return;
    }
    const SQ = global.HublySmartQuote;
    const cfg = getConfig();
    if (!SQ || !cfg) return;
    S._sq = {
      step: 0,
      packageIds: (rec.packageIds || []).slice(),
      addonIds: (rec.addonIds || []).slice(),
      answers: Object.assign({}, rec.answers || {}),
      draftId: rec.id,
      customer: {
        name: rec.customerName || '',
        phone: rec.customerPhone || '',
        email: rec.customerEmail || '',
        notes: rec.notes || '',
      },
    };
    document.getElementById('sq-workspace')?.classList.remove('hidden');
    document.getElementById('sq-list-wrap')?.classList.add('hidden');
    renderWorkspace();
  }

  function bookThisQuote() {
    const SQ = global.HublySmartQuote;
    const cfg = getConfig();
    const st = ensureState();
    if (!st || !SQ || !cfg) return;
    if (!(st.packageIds || []).length) {
      if (typeof toast === 'function') toast('Pick at least one package');
      return;
    }
    const rec = buildQuoteRecord('accepted');
    rec.sentAt = new Date().toISOString();
    st.draftId = rec.id;
    const idx = S.quotes.findIndex((q) => q.id === rec.id);
    if (idx >= 0) S.quotes[idx] = rec;
    else S.quotes.unshift(rec);
    S._bookFromQuote = rec;
    persistQuotes();
    closeWorkspace();

    const pkgs = SQ.packagesFromServices(activeServices(), cfg);
    const picked = pkgs.find((p) => (rec.packageIds || []).includes(p.id)) || pkgs[0];
    const svcName = picked && picked.name;
    try {
      if (typeof openBookingPage === 'function' && svcName) openBookingPage(svcName, { forceNoPromo: true });
      else if (typeof openBookingPage === 'function') openBookingPage(null, { forceNoPromo: true });
    } catch (e) {
      if (typeof toast === 'function') toast('Could not open booking');
      return;
    }
    // Hydrate after openBookingPage resets intake state
    setTimeout(() => {
      try {
        if (!S._bkSq) S._bkSq = { answers: {}, packageIds: [] };
        S._bkSq.answers = Object.assign({}, SQ.defaultAnswers(cfg), rec.answers || {});
        if (picked) S._bkSq.packageIds = [picked.id];
        if (typeof HublyBookingSQ !== 'undefined') {
          HublyBookingSQ.syncLegacyFromAnswers();
          HublyBookingSQ.renderIntake();
          HublyBookingSQ.updateEstimate();
        }
        const nameEl = document.getElementById('bk-name');
        const phoneEl = document.getElementById('bk-phone');
        const emailEl = document.getElementById('bk-email');
        if (nameEl) nameEl.value = rec.customerName || '';
        if (phoneEl) phoneEl.value = rec.customerPhone || '';
        if (emailEl) emailEl.value = rec.customerEmail || '';
        if (typeof updateStickyPrice === 'function') updateStickyPrice();
        if (typeof toast === 'function')
          toast('Quote loaded — pick a time to finish booking for ' + (rec.customerName || 'this customer'));
      } catch (e) {
        console.warn('hydrate booking from quote', e);
      }
    }, 80);
  }

  /** Keep old entry points working */
  function openCustomize() {
    openSetup();
  }
  function disableCurrentFieldPrompt() {
    openSetup();
  }

  function ensureSetupModal() {
    let el = document.getElementById('m-sq-setup');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'm-sq-setup';
    el.className = 'modal-bg hidden';
    el.onclick = function (e) {
      if (e.target === el) closeSetup();
    };
    el.innerHTML = `<div class="modal sq-setup-modal" style="max-width:560px;">
      <div class="modal-h"><div class="modal-t">Quote setup</div><button type="button" class="modal-x" onclick="HublySmartQuoteUI.closeSetup()">×</button></div>
      <div class="modal-b" id="sq-setup-body"></div>
    </div>`;
    document.body.appendChild(el);
    return el;
  }

  function openSetup() {
    const SQ = global.HublySmartQuote;
    const cfg = getConfig();
    if (!SQ || !cfg) {
      if (typeof toast === 'function') toast('Smart Quote not ready');
      return;
    }
    loadPersisted();
    if (!S.quoteConfig) S.quoteConfig = {};
    if (!Array.isArray(S.quoteConfig.disabledFields)) S.quoteConfig.disabledFields = [];
    if (!Array.isArray(S.quoteConfig.customPackages)) S.quoteConfig.customPackages = [];
    ensureSetupModal();
    const body = document.getElementById('sq-setup-body');
    const disabled = new Set(S.quoteConfig.disabledFields || []);
    const fieldRows = Object.keys(cfg.fields || {})
      .map((fid) => {
        const f = cfg.fields[fid];
        const on = !disabled.has(fid);
        return `<label class="sq-setup-row"><input type="checkbox" data-sq-field="${esc(fid)}" ${
          on ? 'checked' : ''
        }> <span><strong>${esc(f.label || fid)}</strong><em>${esc(fid)} · ${esc(f.step || 'subject')}</em></span></label>`;
      })
      .join('');
    const customPkgs = (S.quoteConfig.customPackages || [])
      .map(
        (p, i) =>
          `<div class="sq-setup-pkg"><strong>${esc(p.name)}</strong><span>${SQ.formatMoney(p.price)}</span>
            <button type="button" class="btn btn-out btn-sm" onclick="HublySmartQuoteUI.removeCustomPackage(${i})">Remove</button></div>`
      )
      .join('');
    body.innerHTML = `
      <p class="sq-muted" style="margin:0 0 14px;">Turn fields on/off for ${esc(
        (cfg.trade || '').replace(/_/g, ' ')
      )}. Changes apply to Smart Quote and Book Now.</p>
      <div class="sq-setup-section"><div class="sq-lbl">Fields</div><div class="sq-setup-list">${
        fieldRows || '<div class="sq-muted">No fields</div>'
      }</div></div>
      <div class="sq-setup-section"><div class="sq-lbl">Custom packages</div>
        ${customPkgs || '<div class="sq-muted">None yet</div>'}
        <div class="sq-setup-add">
          <input type="text" id="sq-setup-pkg-name" placeholder="Package name">
          <input type="number" id="sq-setup-pkg-price" placeholder="Price" min="0" step="1">
          <button type="button" class="btn btn-out btn-sm" onclick="HublySmartQuoteUI.addCustomPackageFromSetup()">Add</button>
        </div>
      </div>
      <div class="sq-setup-foot">
        <button type="button" class="btn btn-out" onclick="HublySmartQuoteUI.closeSetup()">Cancel</button>
        <button type="button" class="btn btn-brand" onclick="HublySmartQuoteUI.saveSetup()">Save setup</button>
      </div>`;
    document.getElementById('m-sq-setup')?.classList.remove('hidden');
  }

  function closeSetup() {
    document.getElementById('m-sq-setup')?.classList.add('hidden');
  }

  function saveSetup() {
    if (!S.quoteConfig) S.quoteConfig = {};
    const disabled = [];
    document.querySelectorAll('#sq-setup-body [data-sq-field]').forEach((inp) => {
      if (!inp.checked) disabled.push(inp.getAttribute('data-sq-field'));
    });
    S.quoteConfig.disabledFields = disabled;
    persistQuotes();
    closeSetup();
    if (typeof toast === 'function') toast('Quote setup saved');
    const badge = document.getElementById('sq-trade-badge');
    const cfg = getConfig();
    if (badge && cfg) {
      badge.textContent = (cfg.trade || 'trade').replace(/_/g, ' ');
      badge.style.background = resolveAccent(cfg);
    }
    if (!document.getElementById('sq-workspace')?.classList.contains('hidden')) renderWorkspace();
  }

  function addCustomPackageFromSetup() {
    const name = (document.getElementById('sq-setup-pkg-name')?.value || '').trim();
    const price = Number(document.getElementById('sq-setup-pkg-price')?.value);
    if (!name) {
      if (typeof toast === 'function') toast('Enter a package name');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      if (typeof toast === 'function') toast('Enter a valid price');
      return;
    }
    if (!S.quoteConfig) S.quoteConfig = {};
    if (!Array.isArray(S.quoteConfig.customPackages)) S.quoteConfig.customPackages = [];
    S.quoteConfig.customPackages.push({ name, price, category: 'Custom' });
    persistQuotes();
    openSetup();
    if (typeof toast === 'function') toast('Package added');
  }

  function removeCustomPackage(i) {
    if (!S.quoteConfig || !Array.isArray(S.quoteConfig.customPackages)) return;
    S.quoteConfig.customPackages.splice(i, 1);
    persistQuotes();
    openSetup();
  }

  function renderQuotesView() {
    loadPersisted();
    const cfg = getConfig();
    const badge = document.getElementById('sq-trade-badge');
    if (badge && cfg) {
      badge.textContent = (cfg.trade || 'trade').replace(/_/g, ' ');
      badge.style.background = resolveAccent(cfg);
    }
    renderList();
    document.getElementById('sq-workspace')?.classList.add('hidden');
    document.getElementById('sq-list-wrap')?.classList.remove('hidden');
  }

  global.HublySmartQuoteUI = {
    openNew,
    closeWorkspace,
    setStep,
    nextStep,
    backStep,
    togglePackage,
    toggleAddon,
    setAnswer,
    setCustomer,
    nudge,
    saveDraft,
    markSent,
    bookThisQuote,
    openSaved,
    renderQuotesView,
    openCustomize,
    disableCurrentFieldPrompt,
    openSetup,
    closeSetup,
    saveSetup,
    addCustomPackageFromSetup,
    removeCustomPackage,
    computeNow,
    getConfig,
  };
})(typeof window !== 'undefined' ? window : global);
