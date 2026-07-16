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

  /** Prefer windowThis.S — hubly.html defines `const S` then assigns window.S. */
  function appState() {
    if (global.S) return global.S;
    try {
      if (typeof S !== 'undefined' && S) return S;
    } catch (e) {}
    return null;
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
    const st = appState();
    if (!st) return [];
    const list = (st.editorSvcs && st.editorSvcs.length ? st.editorSvcs : null) || st.services || [];
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
    const st = appState();
    if (!st) return [];
    const list = st.editorAddons || st.addons || [];
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
    const st = appState();
    if (!SQ || !st) return null;
    let bp = null;
    try {
      if (typeof getActiveBlueprint === 'function') bp = getActiveBlueprint();
    } catch (e) {}
    // Quick Quote chrome is Vehicle → Service → Add-ons → Review (same order as Book Now).
    // Do not use packagesFirst — that reordered steps and broke Next / stepper.
    const cfg = SQ.resolveConfig({
      businessType: st.businessType || (bp && bp.id) || 'detailing',
      blueprint: bp,
      ownerConfig: st.quoteConfig,
      packagesFirst: false,
    });
    // Sync dirty surcharge % from owner booking settings when detailing
    if (cfg.trade === 'detailing' && st.dirtySurcharge && st.dirtySurcharge.enabled && cfg.fields.condition) {
      const d = st.dirtySurcharge;
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

  function getQuickQuoteFlow() {
    const SQ = global.HublySmartQuote;
    const st = appState();
    if (!SQ || !SQ.resolveQuickQuoteFlow) {
      return {
        trade: 'detailing',
        title: 'Quick Quote',
        tagline: 'Fast. Simple. Mobile.',
        tileArt: true,
        chromeSteps: [
          { id: 'subject', label: 'Details', hint: '', mapsTo: 'subject' },
          { id: 'service', label: 'Service', hint: '', mapsTo: 'packages' },
          { id: 'addons', label: 'Add-ons', hint: '', mapsTo: 'modifiers' },
          { id: 'review', label: 'Review', hint: '', mapsTo: 'customer' },
        ],
      };
    }
    let bp = null;
    try {
      if (typeof getActiveBlueprint === 'function') bp = getActiveBlueprint();
    } catch (e) {}
    return SQ.resolveQuickQuoteFlow({
      businessType: (st && st.businessType) || (bp && bp.id) || 'detailing',
      blueprint: bp,
    });
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
    const app = appState();
    const cfg = getConfig();
    if (!SQ || !cfg || !app) {
      if (typeof toast === 'function') toast('Quick Quote engine not ready');
      return;
    }
    const pkgs = SQ.packagesFromServices(activeServices(), cfg);
    app._sq = {
      step: 0,
      packageIds: pkgs[0] ? [pkgs[0].id] : [],
      addonIds: [],
      answers: SQ.defaultAnswers(cfg),
      draftId: null,
      customer: { name: '', phone: '', email: '', notes: '' },
    };
    document.getElementById('sq-workspace')?.classList.remove('hidden');
    document.getElementById('sq-list-wrap')?.classList.add('hidden');
    // Land on chrome step 0 (Vehicle / trade subject), not packages.
    setChromeStep(0);
  }

  function backStep() {
    const SQ = global.HublySmartQuote;
    const cfg = getConfig();
    const st = ensureState();
    const flow = getQuickQuoteFlow();
    if (!st || !cfg) return;
    const step = cfg.steps[st.step];
    // Within Review chrome: recipe review → customer before leaving the chrome step.
    if (step && step.id === 'review') {
      const custIdx = (cfg.steps || []).findIndex((s) => s && s.id === 'customer');
      if (custIdx >= 0) {
        setStep(custIdx);
        return;
      }
    }
    const chromeIdx =
      SQ && typeof SQ.chromeIndexForRecipeStep === 'function'
        ? SQ.chromeIndexForRecipeStep(flow, step && step.id)
        : st.step;
    if (chromeIdx <= 0) {
      exitQuote();
      return;
    }
    setChromeStep(chromeIdx - 1);
  }

  function exitQuote() {
    closeWorkspace();
    try {
      if (typeof closeSmartQuoteToReturn === 'function' && S._sqReturnNav && S._sqReturnNav !== 'quotes') {
        closeSmartQuoteToReturn();
      }
    } catch (e) {}
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
    const SQ = global.HublySmartQuote;
    const cfg = getConfig();
    const st = ensureState();
    const flow = getQuickQuoteFlow();
    if (!cfg || !st) return;
    const step = cfg.steps[st.step];
    // Within Review chrome: customer → recipe review before Send quote.
    if (step && step.id === 'customer') {
      const reviewIdx = (cfg.steps || []).findIndex((s) => s && s.id === 'review');
      if (reviewIdx >= 0 && st.step < reviewIdx) {
        setStep(reviewIdx);
        return;
      }
    }
    const chromeIdx =
      SQ && typeof SQ.chromeIndexForRecipeStep === 'function'
        ? SQ.chromeIndexForRecipeStep(flow, step && step.id)
        : st.step;
    const lastChrome = ((flow && flow.chromeSteps) || []).length - 1;
    if (chromeIdx >= lastChrome) return;
    setChromeStep(chromeIdx + 1);
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
    const SQ = global.HublySmartQuote;
    if (field.type === 'tiles') {
      const rich = (field.options || []).some((o) => o && o.image);
      return `<div class="sq-field"><div class="sq-lbl">${esc(field.label)}</div>
        <div class="sq-tiles${rich ? ' sq-tiles-rich' : ''}">${(field.options || [])
          .map((o) => {
            const onclick = `onclick="HublySmartQuoteUI.setAnswer('${esc(field.id)}','${esc(o.id)}')"`;
            if (SQ && SQ.renderTileOptionHtml) {
              return SQ.renderTileOptionHtml(o, ans === o.id, onclick, true);
            }
            const sel = ans === o.id ? ' sel' : '';
            return `<button type="button" class="sq-tile${sel}" ${onclick}>
              <strong>${esc(o.label)}</strong>
              ${o.desc ? `<span>${esc(o.desc)}</span>` : ''}
              ${o.surcharge ? `<em>+$${o.surcharge}</em>` : ''}
            </button>`;
          })
          .join('')}</div></div>`;
    }
    if (field.type === 'stepper') {
      return `<div class="sq-field"><div class="sq-lbl">${esc(field.label)}</div>
        <div class="sq-stepper sq-stepper-rich">
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
      return `<label class="sq-toggle sq-toggle-card"><input type="checkbox" ${ans ? 'checked' : ''} onchange="HublySmartQuoteUI.setAnswer('${esc(field.id)}',this.checked)"><span>${esc(field.label)}</span></label>`;
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
      ? `<button type="button" class="btn btn-brand sq-save-btn" onclick="HublySmartQuoteUI.openSendMenu()">Send quote</button>
         <button type="button" class="btn btn-ink sq-save-btn" onclick="HublySmartQuoteUI.bookThisQuote()">Book Now</button>`
      : `<button type="button" class="btn btn-out sq-save-btn" onclick="HublySmartQuoteUI.saveDraft()">Save draft</button>`;
    side.innerHTML = SQ.renderEstimateCardHtml({
      accent,
      trade: cfg.trade,
      formatted: money.formatted,
      lineItems: money.lineItems,
      includes: cfg.includes,
      tip: cfg.tip,
      emptyText: 'Select a package to start',
      kicker: 'Your quote',
      actionsHtml: actions,
      formatMoney: SQ.formatMoney,
    });
  }

  function setChromeStep(chromeIndex) {
    const SQ = global.HublySmartQuote;
    const cfg = getConfig();
    const flow = getQuickQuoteFlow();
    if (!SQ || !cfg) return;
    const idx =
      typeof SQ.recipeStepIndexForChrome === 'function'
        ? SQ.recipeStepIndexForChrome(cfg, flow, chromeIndex)
        : chromeIndex;
    setStep(idx);
  }

  function renderWorkspace(opts) {
    const SQ = global.HublySmartQuote;
    const cfg = getConfig();
    const st = ensureState();
    const flow = getQuickQuoteFlow();
    const root = document.getElementById('sq-main');
    if (!root || !cfg || !st || !SQ) return;
    const accent = resolveAccent(cfg);
    document.documentElement.style.setProperty('--sq-accent', accent);
    const moreOpen = !!(opts && opts.moreOpen);
    const step = cfg.steps[st.step] || cfg.steps[0];
    const chromeIdx =
      typeof SQ.chromeIndexForRecipeStep === 'function'
        ? SQ.chromeIndexForRecipeStep(flow, step && step.id)
        : st.step;
    const prog = (flow.chromeSteps || [])
      .map((s, i) => {
        const on = i === chromeIdx ? ' on' : i < chromeIdx ? ' done' : '';
        const hint = s.hint ? `<em>${esc(s.hint)}</em>` : '';
        return `<button type="button" class="sq-prog-step sq-qq-step${on}" onclick="HublySmartQuoteUI.setChromeStep(${i})"><span>${
          i + 1
        }</span><div class="sq-qq-step-copy"><strong>${esc(s.label || s.id)}</strong>${hint}</div></button>`;
      })
      .join('');

    let body = '';
    if (step.id === 'packages') {
      const pkgs = SQ.packagesFromServices(activeServices(), cfg);
      body = `<div class="sq-pkg-grid sq-pkg-grid-visual">${pkgs
        .map((p) => {
          const sel = st.packageIds.includes(p.id) ? ' sel' : '';
          const img = p.image
            ? `<img src="${esc(p.image)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'sq-pkg-ph',textContent:'📷'}))">`
            : `<div class="sq-pkg-ph" aria-hidden="true">📷</div>`;
          const dur = p.dur
            ? `<span class="sq-pkg-dur">⏱ ${esc(String(p.dur))}${
                /hr|hour|min/i.test(String(p.dur)) ? '' : ' hrs'
              }</span>`
            : '';
          return `<button type="button" class="sq-pkg sq-pkg-visual${sel}" onclick="HublySmartQuoteUI.togglePackage('${esc(
            p.id
          )}')">
            <span class="bk-sel-check" aria-hidden="true">✓</span>
            <div class="sq-pkg-media">${img}</div>
            <div class="sq-pkg-copy">
              <strong>${esc(p.name)}</strong>
              <div class="sq-pkg-meta"><b>${SQ.formatMoney(p.price)}</b>${dur}</div>
              <p>${esc(p.desc || '')}</p>
            </div>
          </button>`;
        })
        .join('') ||
        '<div class="sq-muted">No packages yet — add them in <button type="button" class="btn btn-out btn-sm" onclick="HublySmartQuoteUI.openWebsiteEditorForPackages()">Website editor → Packages</button>.</div>'}</div>
        <button type="button" class="btn btn-out btn-sm" style="margin-top:10px" onclick="HublySmartQuoteUI.openWebsiteEditorForPackages()">Edit packages in Website editor →</button>`;
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
        <div class="sq-review-actions">
          <button type="button" class="btn btn-brand" onclick="HublySmartQuoteUI.openSendMenu()">Send quote</button>
          <button type="button" class="btn btn-ink" onclick="HublySmartQuoteUI.bookThisQuote()">Book Now</button>
        </div>
        <div id="sq-send-menu" class="sq-send-menu hidden">
          <button type="button" class="btn btn-out" onclick="HublySmartQuoteUI.markSent()">Email PDF-ready quote</button>
          <button type="button" class="btn btn-out" onclick="HublySmartQuoteUI.sendQuoteSms()">Text via phone</button>
          <button type="button" class="btn btn-out" onclick="HublySmartQuoteUI.downloadQuotePdf()">Download / print PDF</button>
        </div>
      </div>`;
    } else {
      const fields = SQ.fieldsForStep(cfg, step.id);
      const parts = SQ.partitionFields(fields);
      body =
        parts.primary.map(renderField).join('') ||
        '<div class="sq-muted">No fields on this step — open Customize questions to enable one.</div>';
      if (parts.secondary.length) {
        body += `<details class="sq-more"${moreOpen ? ' open' : ''}><summary>More details <span>(optional)</span></summary>${parts.secondary
          .map(renderField)
          .join('')}</details>`;
      }
      if (step.id === 'modifiers') {
        const addons = activeAddons();
        if (addons.length) {
          body += `<div class="sq-field"><div class="sq-lbl">Quick add-ons</div><div class="sq-tiles sq-tiles-addons">${addons
            .map((a) => {
              const sel = st.addonIds.includes(a.id) ? ' sel' : '';
              return `<button type="button" class="sq-tile${sel}" onclick="HublySmartQuoteUI.toggleAddon('${esc(a.id)}')"><strong>${esc(a.name)}</strong><em>+${SQ.formatMoney(a.price)}</em></button>`;
            })
            .join('')}</div></div>`;
        }
      }
    }

    const onReview = st.step >= cfg.steps.length - 1;
    const chrome = (flow.chromeSteps || [])[chromeIdx] || {};
    const stepTitle = chrome.hint || step.title;
    const stepBlurb = chrome.label ? `${chrome.label} · ${step.blurb || flow.tagline || ''}` : step.blurb || '';
    root.innerHTML = `
      <div class="sq-head sq-qq-head" style="--sq-accent:${esc(accent)}">
        <div>
          <div class="sq-kicker">${esc(flow.title || 'Quick Quote')}</div>
          <h2>${esc(flow.title || 'Quick Quote')}</h2>
          <p>${esc(flow.tagline || 'Fast. Simple. Mobile.')}</p>
        </div>
        <div class="sq-head-actions">
          <button type="button" class="btn btn-out btn-sm" onclick="HublySmartQuoteUI.saveDraft()">Save draft</button>
          <button type="button" class="btn btn-brand btn-sm" onclick="HublySmartQuoteUI.openSendMenu()">Send quote</button>
          <button type="button" class="btn btn-out btn-sm" onclick="HublySmartQuoteUI.exitQuote()">Close</button>
        </div>
      </div>
      <div class="sq-prog sq-qq-prog">${prog}</div>
      <div class="sq-step-title"><h3>${esc(stepTitle)}</h3><p>${esc(stepBlurb)}</p></div>
      <div class="sq-body">${body}</div>
      <div class="sq-foot">
        <button type="button" class="btn btn-out" onclick="HublySmartQuoteUI.backStep()">${
          st.step === 0 ? '← Back' : '← Back'
        }</button>
        <button type="button" class="btn btn-brand" onclick="HublySmartQuoteUI.${
          onReview ? 'openSendMenu()' : 'nextStep()'
        }">${onReview ? 'Send quote →' : 'Next step'}</button>
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
    if (!st) {
      if (typeof toast === 'function') toast('Quick Quote isn’t ready — open New Quick Quote again');
      return;
    }
    if (!(st.packageIds || []).length) {
      if (typeof toast === 'function') toast('Pick at least one package');
      return;
    }
    const c = st.customer || {};
    const phone = String(c.phone || '').trim();
    const email = String(c.email || '').trim();
    const name = String(c.name || '').trim();
    if (!phone && !email) {
      if (typeof toast === 'function') toast('Add customer phone or email so this becomes a lead');
      try {
        const cfg = getConfig();
        const custIdx = (cfg.steps || []).findIndex((s) => s && s.id === 'customer');
        if (custIdx >= 0) setStep(custIdx);
      } catch (e) {}
      return;
    }
    const rec = buildQuoteRecord('draft');
    st.draftId = rec.id;
    if (!Array.isArray(S.quotes)) S.quotes = [];
    const idx = S.quotes.findIndex((q) => q.id === rec.id);
    if (idx >= 0) S.quotes[idx] = rec;
    else S.quotes.unshift(rec);
    persistQuotes();
    renderList();
    // Create a visible Hubly lead (New bookings) so Save isn’t local-only.
    createQuoteLead(rec)
      .then((ok) => {
        if (typeof toast === 'function')
          toast(ok ? 'Quote saved — lead added under New bookings' : 'Quote saved on this device');
        closeWorkspace();
      })
      .catch(() => {
        if (typeof toast === 'function') toast('Quote saved on this device');
        closeWorkspace();
      });
  }

  async function createQuoteLead(rec) {
    try {
      if (typeof currentBusiness === 'undefined' || !currentBusiness?.id) return false;
      if (typeof waitForDb !== 'function') return false;
      const dbClient = await waitForDb();
      const money = (rec && rec.amount) || 0;
      const phone = String((rec && rec.customerPhone) || '').trim();
      const email = String((rec && rec.customerEmail) || '').trim() || null;
      const leadPhone = phone || (email ? `email:${email}` : '');
      if (!leadPhone) return false;
      const id = crypto.randomUUID();
      const payload = {
        id,
        business_id: currentBusiness.id,
        customer_name: (rec && rec.customerName) || nameFromEmail(email) || 'Quote lead',
        customer_phone: leadPhone,
        customer_email: email,
        service_name: packageNamesFromQuote(rec) || 'Smart Quote',
        notes: `[source:smart_quote][QUOTE:$${Number(money).toFixed(2)}] id:${(rec && rec.id) || id}`,
        status: 'pending',
      };
      const { error } = await dbClient.from('booking_requests').insert(payload);
      if (error) {
        console.warn('smart quote lead insert failed', error.message || error);
        return false;
      }
      try {
        if (typeof loadJobs === 'function') loadJobs();
      } catch (e) {}
      return true;
    } catch (e) {
      console.warn('createQuoteLead', e);
      return false;
    }
  }

  function nameFromEmail(email) {
    const e = String(email || '');
    if (!e.includes('@')) return '';
    return e.split('@')[0] || '';
  }

  function packageNamesFromQuote(rec) {
    try {
      const SQ = global.HublySmartQuote;
      const cfg = getConfig();
      if (!SQ || !cfg || !rec) return '';
      const pkgs = SQ.packagesFromServices(activeServices(), cfg);
      const names = (rec.packageIds || [])
        .map((id) => (pkgs.find((p) => p.id === id) || {}).name)
        .filter(Boolean);
      return names.join(', ');
    } catch (e) {
      return '';
    }
  }

  function buildQuoteEmail(rec, money, cfg) {
    const biz = S.biz || 'us';
    const name = (rec && rec.customerName) || 'there';
    const lines = ((money && money.lineItems) || (rec && rec.lineItems) || [])
      .filter((l) => l && l.amount)
      .map((l) => {
        const amt = Number(l.amount) || 0;
        const sign = l.kind === 'package' ? '' : amt < 0 ? '-' : '+';
        return `  ${l.label}: ${sign}$${Math.abs(amt).toFixed(2)}`;
      })
      .join('\n');
    const total = (money && money.formatted) || HublySmartQuote.formatMoney((rec && rec.amount) || 0);
    const disc =
      (global.HublySmartQuote && HublySmartQuote.estimateDisclaimer(cfg && cfg.trade)) ||
      'Estimate based on what you selected — confirmed before you pay.';
    const phone = S.phone || '';
    const bookHint = S.slug
      ? `\nBook online anytime from your ${biz} page when you’re ready.\n`
      : '\nReply to this email or call us when you’re ready to book.\n';
    return {
      subject: `Your quote from ${biz} — ${total}`,
      body: `Hi ${name},

Here’s your quote from ${biz}:

${lines || '  (see total below)'}

Total: ${total}

${disc}
${bookHint}${phone ? `\nCall or text: ${phone}\n` : ''}
Thanks,
${biz}`,
    };
  }

  async function markSent() {
    const st = ensureState();
    const cfg = getConfig();
    if (!st) return;
    if (!(st.packageIds || []).length) {
      if (typeof toast === 'function') toast('Pick at least one package');
      return;
    }
    const c = st.customer || {};
    const email = String(c.email || '').trim();
    if (!email || !email.includes('@')) {
      if (typeof toast === 'function') toast('Add the customer email on the Customer step first');
      try {
        const custIdx = (cfg.steps || []).findIndex((s) => s && s.id === 'customer');
        if (custIdx >= 0) setStep(custIdx);
      } catch (e) {}
      return;
    }

    const money = computeNow();
    const rec = buildQuoteRecord('sent');
    rec.sentAt = new Date().toISOString();
    const mail = buildQuoteEmail(rec, money, cfg);

    if (typeof toast === 'function') toast('Sending quote…');
    try {
      if (typeof waitForDb !== 'function') throw new Error('Email not available offline');
      const dbClient = await waitForDb();
      const { error } = await dbClient.functions.invoke('send-customer-email', {
        body: {
          to_email: email,
          to_name: c.name || '',
          subject: mail.subject,
          body: mail.body,
          business_name: S.biz || 'Hubly',
        },
      });
      if (error) throw new Error(error.message || 'Send failed');
      rec.emailSentAt = new Date().toISOString();
      rec.emailSubject = mail.subject;
      st.draftId = rec.id;
      const idx = S.quotes.findIndex((q) => q.id === rec.id);
      if (idx >= 0) S.quotes[idx] = rec;
      else S.quotes.unshift(rec);
      persistQuotes();
      try {
        await createQuoteLead(rec);
      } catch (e) {}
      if (typeof toast === 'function') toast('Quote emailed to ' + email);
      closeWorkspace();
    } catch (e) {
      console.warn('markSent email failed', e);
      if (typeof toast === 'function')
        toast('Couldn’t send email' + (e && e.message ? ': ' + e.message : '') + ' — quote not marked sent');
    }
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
            <div class="sq-muted">${esc(q.status)}${q.emailSentAt ? ' · emailed' : ''} · ${esc(
              (q.createdAt || '').slice(0, 10)
            )} · ${esc((q.trade || '').replace(/_/g, ' '))}</div>
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

  function openSendMenu() {
    const menu = document.getElementById('sq-send-menu');
    if (menu) {
      menu.classList.toggle('hidden');
      return;
    }
    // Sidebar path — jump to review then show buttons
    const cfg = getConfig();
    const st = ensureState();
    if (!cfg || !st) return;
    const reviewIdx = (cfg.steps || []).findIndex((s) => s && s.id === 'review');
    if (reviewIdx >= 0 && st.step !== reviewIdx) setStep(reviewIdx);
    else renderWorkspace();
    setTimeout(() => document.getElementById('sq-send-menu')?.classList.remove('hidden'), 40);
  }

  function quoteSmsBody(rec, money, cfg) {
    const biz = (appState() || {}).biz || 'us';
    const total = (money && money.formatted) || HublySmartQuote.formatMoney((rec && rec.amount) || 0);
    const lines = ((money && money.lineItems) || (rec && rec.lineItems) || [])
      .filter((l) => l && l.amount)
      .slice(0, 4)
      .map((l) => `${l.label}: $${Math.abs(Number(l.amount) || 0).toFixed(0)}`)
      .join(' · ');
    return `Hi ${(rec && rec.customerName) || 'there'} — quote from ${biz}: ${lines || total}. Total ${total}. Reply to book!`;
  }

  function sendQuoteSms() {
    const st = ensureState();
    const cfg = getConfig();
    if (!st) return;
    if (!(st.packageIds || []).length) {
      if (typeof toast === 'function') toast('Pick at least one package');
      return;
    }
    const c = st.customer || {};
    const phone = String(c.phone || '').replace(/[^\d+]/g, '');
    if (!phone || phone.replace(/\D/g, '').length < 7) {
      if (typeof toast === 'function') toast('Add the customer phone on the Client step first');
      try {
        const custIdx = (cfg.steps || []).findIndex((s) => s && s.id === 'customer');
        if (custIdx >= 0) setStep(custIdx);
      } catch (e) {}
      return;
    }
    const money = computeNow();
    const rec = buildQuoteRecord('sent');
    const body = quoteSmsBody(rec, money, cfg);
    const href = `sms:${phone}${/iPhone|iPad|Mac/i.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(
      body
    )}`;
    rec.sentAt = new Date().toISOString();
    rec.smsOpenedAt = new Date().toISOString();
    st.draftId = rec.id;
    const idx = S.quotes.findIndex((q) => q.id === rec.id);
    if (idx >= 0) S.quotes[idx] = rec;
    else S.quotes.unshift(rec);
    persistQuotes();
    window.location.href = href;
    if (typeof toast === 'function') toast('Opening Messages with the quote…');
  }

  function downloadQuotePdf() {
    const st = ensureState();
    const cfg = getConfig();
    const SQ = global.HublySmartQuote;
    if (!st || !SQ) return;
    if (!(st.packageIds || []).length) {
      if (typeof toast === 'function') toast('Pick at least one package');
      return;
    }
    const money = computeNow();
    const rec = buildQuoteRecord('draft');
    const app = appState() || {};
    const accent = resolveAccent(cfg);
    const lines = (money.lineItems || [])
      .filter((l) => l && l.amount)
      .map(
        (l) =>
          `<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${esc(l.label)}</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;">${SQ.formatMoney(
            l.amount
          )}</td></tr>`
      )
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Quote — ${esc(
      app.biz || 'Hubly'
    )}</title>
      <style>body{font-family:system-ui,sans-serif;color:#0f172a;padding:40px;max-width:640px;margin:0 auto}
      h1{font-size:22px;margin:0 0 4px} .muted{color:#64748b;font-size:13px}
      .total{font-size:28px;font-weight:800;color:${esc(accent)};margin:18px 0}
      table{width:100%;border-collapse:collapse;margin:16px 0} @media print{button{display:none}}</style></head><body>
      <h1>${esc(app.biz || 'Quote')}</h1>
      <p class="muted">Prepared for ${esc(rec.customerName || 'Customer')}${
      rec.customerEmail ? ' · ' + esc(rec.customerEmail) : ''
    }${rec.customerPhone ? ' · ' + esc(rec.customerPhone) : ''}</p>
      <table>${lines}</table>
      <div class="total">Total ${esc(money.formatted)}</div>
      <p class="muted">${esc(SQ.estimateDisclaimer(cfg && cfg.trade))}</p>
      <p class="muted">${esc(rec.notes || '')}</p>
      <button onclick="window.print()" style="margin-top:20px;padding:10px 16px;border-radius:10px;border:none;background:${esc(
        accent
      )};color:#fff;font-weight:700;cursor:pointer">Print / Save PDF</button>
      <script>setTimeout(function(){try{window.print()}catch(e){}},400)<\\/script>
      </body></html>`;
    const win = window.open('', '_blank');
    if (!win) {
      if (typeof toast === 'function') toast('Allow pop-ups to download the PDF');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    if (typeof toast === 'function') toast('Quote opened — use Print → Save as PDF');
  }

  function bookThisQuote() {
    const SQ = global.HublySmartQuote;
    const cfg = getConfig();
    const st = ensureState();
    const app = appState();
    if (!st || !SQ || !cfg || !app) return;
    if (!(st.packageIds || []).length) {
      if (typeof toast === 'function') toast('Pick at least one package');
      return;
    }
    const rec = buildQuoteRecord('accepted');
    rec.sentAt = new Date().toISOString();
    st.draftId = rec.id;
    const idx = (app.quotes || []).findIndex((q) => q.id === rec.id);
    if (!Array.isArray(app.quotes)) app.quotes = [];
    if (idx >= 0) app.quotes[idx] = rec;
    else app.quotes.unshift(rec);
    app._bookFromQuote = rec;
    persistQuotes();

    const pkgs = SQ.packagesFromServices(activeServices(), cfg);
    const picked = pkgs.find((p) => (rec.packageIds || []).includes(p.id)) || pkgs[0];
    const svcName = (picked && picked.name) || null;
    const addons = activeAddons().filter((a) => (rec.addonIds || []).includes(a.id));

    closeWorkspace();

    try {
      if (typeof openBookingPage === 'function') {
        openBookingPage(svcName, {
          forceNoPromo: true,
          fromQuote: rec,
          quotePackage: picked || null,
          quoteAddons: addons,
        });
      }
    } catch (e) {
      if (typeof toast === 'function') toast('Could not open booking');
      console.warn(e);
    }
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

  function openWebsiteEditorForPackages() {
    closeSetup();
    try {
      if (typeof openWebsiteEditorHub === 'function') {
        openWebsiteEditorHub('packages');
        return;
      }
      if (typeof showP === 'function') showP('p-app', { replaceRoute: true });
      const nav = document.querySelector('[data-v="editor"]');
      if (nav && typeof switchV === 'function') switchV(nav);
      setTimeout(() => {
        try {
          document.getElementById('ed-services')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) {}
      }, 120);
    } catch (e) {
      if (typeof toast === 'function') toast('Open Website editor → Packages to edit');
    }
  }

  function stepTitleFor(cfg, stepId) {
    const steps = (cfg && cfg.steps) || [];
    const hit = steps.find((s) => s && s.id === stepId);
    return (hit && hit.title) || 'Quote details';
  }

  function fieldOwnerHelp(cfg, f) {
    const step = stepTitleFor(cfg, (f && f.step) || 'subject');
    if (f && f.rule) return `Customers answer this under “${step}” · changes the estimate`;
    if (f && f.type === 'toggle') return `Optional upsell under “${step}”`;
    return `Customers answer this under “${step}”`;
  }

  function samplePreviewPackage(pkgs) {
    if (!pkgs || !pkgs.length) return null;
    return pkgs.find((p) => p && p.popular) || pkgs[0];
  }

  function renderQuoteSidePreview(cfg, pkgs, enabledFields) {
    const SQ = global.HublySmartQuote;
    const side = document.getElementById('ed-quote-side');
    if (!side || !SQ) return;
    const app = appState() || {};
    const sample = samplePreviewPackage(pkgs);
    const total = sample ? SQ.formatMoney(sample.price) : '$—';
    // Prefer Book Now benefit chips when set; fall back to recipe includes.
    const w = app.bookingWizard || {};
    const includes = (
      (w.sidebarIncludes && w.sidebarIncludes.length ? w.sidebarIncludes : null) ||
      cfg.includes ||
      []
    ).slice(0, 4);
    const tip = cfg.tip || null;
    const disc = String(
      (app.quoteConfig && (app.quoteConfig._previewDisclaimer || app.quoteConfig.disclaimer)) ||
        SQ.estimateDisclaimer(cfg.trade) ||
        ''
    ).trim();
    const asked = (enabledFields || [])
      .slice(0, 6)
      .map((f) => `<li>${esc(f.label || f.id)}</li>`)
      .join('');
    const accent = esc(resolveAccent(cfg));
    side.innerHTML = `
      <div class="sq-estimate-card" style="--sq-accent:${accent}">
        <div class="sq-estimate-kicker">Your estimate</div>
        <div class="sq-estimate-total">${esc(total)}</div>
        ${
          sample
            ? `<div class="sq-lines"><div class="sq-line"><span>${esc(sample.name)}</span><strong>${esc(
                SQ.formatMoney(sample.price)
              )}</strong></div></div>`
            : `<div class="sq-muted" style="color:#94a3b8;margin-bottom:12px;">Add packages under Packages to preview a sample estimate.</div>`
        }
        ${
          includes.length
            ? `<ul class="sq-includes">${includes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
            : ''
        }
        ${
          tip
            ? `<div class="sq-tip" style="--sq-accent:${accent}"><strong>${esc(
                tip.title || ''
              )}</strong><p>${esc(tip.body || '')}</p></div>`
            : ''
        }
        ${disc ? `<p class="sq-disclaimer">${esc(disc)}</p>` : ''}
        <div class="ed-quote-actions">
          <button type="button" class="btn btn-brand btn-sm" onclick="HublySmartQuoteUI.previewSendQuote()">Send quote</button>
          <button type="button" class="btn btn-out btn-sm" style="color:#fff;border-color:rgba(255,255,255,.35)" onclick="HublySmartQuoteUI.previewBookNow()">Book Now</button>
        </div>
        <div class="ed-quote-asked">
          <strong>Customers will be asked</strong>
          <ul>${asked || '<li>Turn on at least one question</li>'}</ul>
        </div>
      </div>
      <p class="ed-quote-side-note">Sample with your featured package. Real totals change when customers answer the questions you leave on.</p>`;
  }

  function previewSendQuote() {
    try {
      if (typeof openWebsiteEditorHub === 'function') openWebsiteEditorHub('quote');
      if (typeof toast === 'function') {
        toast('Save questions, then open Quotes to send a real estimate');
      }
      if (typeof switchV === 'function') {
        const quotes = document.querySelector('[data-v="quotes"]');
        if (quotes) {
          setTimeout(() => {
            try {
              switchV(quotes);
              if (typeof HublySmartQuoteUI !== 'undefined' && HublySmartQuoteUI.openNew) {
                HublySmartQuoteUI.openNew();
              }
            } catch (e) {}
          }, 60);
        }
      }
    } catch (e) {
      if (typeof toast === 'function') toast('Open Quotes to send an estimate');
    }
  }

  function previewBookNow() {
    try {
      const app = appState();
      const SQ = global.HublySmartQuote;
      const pkgs = SQ ? SQ.packagesFromServices(activeServices(), getConfig()) : [];
      const sample = samplePreviewPackage(pkgs);
      if (typeof setOwnerPreview === 'function') setOwnerPreview(true);
      if (typeof openBookingPage === 'function') {
        openBookingPage(sample && sample.name ? sample.name : null);
        return;
      }
    } catch (e) {}
    if (typeof toast === 'function') toast('Open Book Now to preview booking');
  }

  function buildSetupHtml(opts) {
    const SQ = global.HublySmartQuote;
    const cfg = getConfig();
    const app = appState();
    if (!SQ || !cfg || !app) return '';
    if (!app.quoteConfig) app.quoteConfig = {};
    if (!Array.isArray(app.quoteConfig.disabledFields)) app.quoteConfig.disabledFields = [];
    const disabled = new Set(app.quoteConfig.disabledFields || []);
    const tradeLabel = String(cfg.trade || 'your trade').replace(/_/g, ' ');
    const fieldEntries = Object.keys(cfg.fields || {}).map((fid) => {
      const f = Object.assign({ id: fid }, cfg.fields[fid] || {});
      return f;
    });
    const enabledFields = fieldEntries.filter((f) => !disabled.has(f.id));
    const fieldRows = fieldEntries
      .map((f) => {
        const on = !disabled.has(f.id);
        return `<label class="sq-setup-row sq-setup-tog">
          <span class="sq-setup-tog-copy">
            <strong>${esc(f.label || f.id)}</strong>
            <em>${esc(fieldOwnerHelp(cfg, f))}</em>
          </span>
          <span class="tog"><input type="checkbox" data-sq-field="${esc(f.id)}" ${
            on ? 'checked' : ''
          } onchange="HublySmartQuoteUI.previewSetupInline()"><span class="tog-sl"></span></span>
        </label>`;
      })
      .join('');
    const pkgs = SQ.packagesFromServices(activeServices(), cfg);
    const disclaimer =
      (app.quoteConfig && app.quoteConfig.disclaimer) || SQ.estimateDisclaimer(cfg.trade) || '';

    if (opts && opts.inline) {
      renderQuoteSidePreview(cfg, pkgs, enabledFields);
      return `
      <div class="ed-quote-job">
        <strong>Your job here:</strong>
        Choose which questions customers answer before they see a price. Packages stay under the Packages tab.
      </div>
      <div class="sq-setup-section ed-quote-pkg-strip">
        <div>
          <div class="sq-lbl" style="margin:0">Packages power the estimate</div>
          <p class="sq-muted" style="margin:4px 0 0">${
            pkgs.length
              ? `${pkgs.length} package${pkgs.length === 1 ? '' : 's'} ready · edit under Packages`
              : 'No packages yet — add them under Packages first'
          }</p>
        </div>
        <button type="button" class="btn btn-out btn-sm" onclick="HublySmartQuoteUI.openWebsiteEditorForPackages()">Edit packages →</button>
      </div>
      <div class="sq-setup-section">
        <div class="sq-lbl">Questions for ${esc(tradeLabel)}</div>
        <p class="sq-muted" style="margin:0 0 10px;">Flip a switch off if you don’t want that question in Smart Quote or Book Now.</p>
        <div class="sq-setup-list">${fieldRows || '<div class="sq-muted">No quote questions for this industry yet.</div>'}</div>
      </div>
      <div class="sq-setup-section">
        <div class="sq-lbl">Disclaimer</div>
        <p class="sq-muted" style="margin:0 0 8px;">Shown under the customer estimate.</p>
        <textarea class="bw-input" rows="2" data-sq-disclaimer placeholder="e.g. Final total may adjust after we see the job." oninput="HublySmartQuoteUI.previewSetupInline()">${esc(
          disclaimer
        )}</textarea>
      </div>`;
    }

    const pkgPreview = pkgs
      .map(
        (p) =>
          `<div class="sq-setup-pkg-ro"><strong>${esc(p.name)}</strong><span>${SQ.formatMoney(
            p.price
          )}${p.dur ? ` · ${esc(String(p.dur))} hrs` : ''}</span></div>`
      )
      .join('');
    return `
      <p class="sq-muted" style="margin:0 0 14px;">Choose which questions customers answer. Packages live under <strong>Packages</strong>.</p>
      <div class="sq-setup-section">
        <div class="sq-setup-sec-h"><div class="sq-lbl">Your packages</div>
          <button type="button" class="btn btn-brand btn-sm" onclick="HublySmartQuoteUI.openWebsiteEditorForPackages()">Edit packages →</button></div>
        <div class="sq-setup-pkg-list">${
          pkgPreview ||
          '<div class="sq-muted">No packages yet — add them under Packages.</div>'
        }</div>
      </div>
      <div class="sq-setup-section"><div class="sq-lbl">Quote questions</div>
        <p class="sq-muted" style="margin:0 0 10px;">Turn fields on/off for ${esc(tradeLabel)}. Changes apply to Smart Quote and Book Now.</p>
        <div class="sq-setup-list">${fieldRows || '<div class="sq-muted">No fields</div>'}</div>
      </div>
      <div class="sq-setup-foot">
        <button type="button" class="btn btn-out" onclick="HublySmartQuoteUI.closeSetup()">Cancel</button>
        <button type="button" class="btn btn-brand" onclick="HublySmartQuoteUI.saveSetup()">Save setup</button>
      </div>`;
  }

  function previewSetupInline() {
    const root = document.getElementById('ed-quote-setup');
    const SQ = global.HublySmartQuote;
    const cfg = getConfig();
    const app = appState();
    if (!root || !SQ || !cfg || !app) return;
    if (!app.quoteConfig) app.quoteConfig = {};
    const disabled = [];
    root.querySelectorAll('[data-sq-field]').forEach((inp) => {
      if (!inp.checked) disabled.push(inp.getAttribute('data-sq-field'));
    });
    // Live preview only — not persisted until Save.
    const disabledSet = new Set(disabled);
    const enabledFields = Object.keys(cfg.fields || {})
      .filter((fid) => !disabledSet.has(fid))
      .map((fid) => Object.assign({ id: fid }, cfg.fields[fid] || {}));
    const pkgs = SQ.packagesFromServices(activeServices(), cfg);
    const discEl = root.querySelector('[data-sq-disclaimer]');
    if (discEl) app.quoteConfig._previewDisclaimer = discEl.value;
    renderQuoteSidePreview(cfg, pkgs, enabledFields);
  }

  function openSetup() {
    const SQ = global.HublySmartQuote;
    const cfg = getConfig();
    const app = appState();
    if (!SQ || !cfg || !app) {
      if (typeof toast === 'function') toast('Smart Quote not ready');
      return;
    }
    if (typeof openWebsiteEditorHub === 'function' && document.getElementById('ed-quote-setup')) {
      openWebsiteEditorHub('quote');
      return;
    }
    loadPersisted();
    ensureSetupModal();
    const body = document.getElementById('sq-setup-body');
    if (body) body.innerHTML = buildSetupHtml({ inline: false });
    document.getElementById('m-sq-setup')?.classList.remove('hidden');
  }

  function renderSetupInline(targetId) {
    const SQ = global.HublySmartQuote;
    const cfg = getConfig();
    const app = appState();
    const root = document.getElementById(targetId || 'ed-quote-setup');
    if (!root) return;
    if (!SQ || !cfg || !app) {
      root.innerHTML = '<p class="sq-muted">Smart Quote not ready yet.</p>';
      return;
    }
    loadPersisted();
    root.innerHTML = buildSetupHtml({ inline: true });
  }

  function closeSetup() {
    document.getElementById('m-sq-setup')?.classList.add('hidden');
  }

  function saveFromRoot(root) {
    const app = appState();
    if (!app || !root) return false;
    if (!app.quoteConfig) app.quoteConfig = {};
    const disabled = [];
    root.querySelectorAll('[data-sq-field]').forEach((inp) => {
      if (!inp.checked) disabled.push(inp.getAttribute('data-sq-field'));
    });
    app.quoteConfig.disabledFields = disabled;
    const disc = root.querySelector('[data-sq-disclaimer]');
    if (disc) app.quoteConfig.disclaimer = String(disc.value || '').trim();
    delete app.quoteConfig._previewDisclaimer;
    persistQuotes();
    try {
      if (typeof saveStorefront === 'function') saveStorefront();
    } catch (e) {}
    const badge = document.getElementById('sq-trade-badge');
    const cfg = getConfig();
    if (badge && cfg) {
      badge.textContent = (cfg.trade || 'trade').replace(/_/g, ' ');
      badge.style.background = resolveAccent(cfg);
    }
    if (!document.getElementById('sq-workspace')?.classList.contains('hidden')) renderWorkspace();
    return true;
  }

  function saveSetup() {
    const body = document.getElementById('sq-setup-body');
    if (!saveFromRoot(body)) return;
    closeSetup();
    if (typeof toast === 'function') toast('Quote setup saved');
  }

  function saveSetupInline() {
    const root = document.getElementById('ed-quote-setup');
    if (!saveFromRoot(root)) return;
    if (typeof toast === 'function') toast('Quote questions saved');
    renderSetupInline('ed-quote-setup');
  }

  // Packages are owned by Website editor — these stubs keep old callsites safe.
  function updateSetupPackage() {}
  function addSetupPackage() {
    openWebsiteEditorForPackages();
  }
  function removeSetupPackage() {}
  function addCustomPackageFromSetup() {
    openWebsiteEditorForPackages();
  }
  function removeCustomPackage() {}
  function syncSetupServicesOut() {}

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
    exitQuote,
    setStep,
    setChromeStep,
    nextStep,
    backStep,
    togglePackage,
    toggleAddon,
    setAnswer,
    setCustomer,
    nudge,
    saveDraft,
    markSent,
    openSendMenu,
    sendQuoteSms,
    downloadQuotePdf,
    bookThisQuote,
    openSaved,
    renderQuotesView,
    openCustomize,
    disableCurrentFieldPrompt,
    openSetup,
    closeSetup,
    saveSetup,
    saveSetupInline,
    renderSetupInline,
    previewSetupInline,
    previewSendQuote,
    previewBookNow,
    openWebsiteEditorForPackages,
    updateSetupPackage,
    addSetupPackage,
    removeSetupPackage,
    addCustomPackageFromSetup,
    removeCustomPackage,
    computeNow,
    getConfig,
    getQuickQuoteFlow,
  };
})(typeof window !== 'undefined' ? window : global);
