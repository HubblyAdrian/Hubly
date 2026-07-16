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
    if (Array.isArray(st._sq.addonIds)) st._sq.addonIds = st._sq.addonIds.map(String);
    if (Array.isArray(st._sq.packageIds)) st._sq.packageIds = st._sq.packageIds.map(String);
    if (!st._sq.customer || typeof st._sq.customer !== 'object') {
      st._sq.customer = { name: '', phone: '', email: '', notes: '' };
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
        // Always string — onclick attrs and packageIds must match (numeric Date.now ids broke clicks).
        id: String(x.id != null && x.id !== '' ? x.id : HublySmartQuote && HublySmartQuote.slug(x.name)),
        name: x.name,
        price: x.price != null ? x.price : x.defaultPrice,
        pricingType: x.pricingType === 'variable' ? 'variable' : 'flat',
        varPrices: x.varPrices && typeof x.varPrices === 'object' ? Object.assign({}, x.varPrices) : {},
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
        id: String(a.id != null && a.id !== '' ? a.id : 'addon-' + i),
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
    // Quick Quote chrome is Vehicle → Service → Extras → Review (same order as Book Now).
    // Do not use packagesFirst — that reordered steps and broke Next / stepper.
    const cfg = SQ.resolveConfig({
      businessType: st.businessType || (bp && bp.id) || 'detailing',
      blueprint: bp,
      ownerConfig: st.quoteConfig,
      packagesFirst: false,
    });
    if (typeof SQ.applyOwnerDirtyToConfig === 'function') {
      SQ.applyOwnerDirtyToConfig(cfg, st.dirtySurcharge);
    }
    // Photography: packages already encode shoot type — don't also charge sessionType.
    if (typeof SQ.applyPackageDrivenFieldGuards === 'function') {
      SQ.applyPackageDrivenFieldGuards(cfg, SQ.packagesFromServices(activeServices(), cfg));
    }
    return cfg;
  }

  function livePackages(cfg, st) {
    const SQ = global.HublySmartQuote;
    const app = appState();
    if (!SQ || !cfg) return [];
    const base = SQ.packagesFromServices(activeServices(), cfg);
    if (typeof SQ.prepareLivePricing === 'function') {
      // Clone cfg fields so size-zeroing for variable pkgs doesn't stick across renders incorrectly —
      // getConfig already returns a fresh resolveConfig each time, but prepareLivePricing mutates it.
      return SQ.prepareLivePricing(cfg, app && app.dirtySurcharge, base, st || {});
    }
    return base;
  }

  function computeNow() {
    const SQ = global.HublySmartQuote;
    const st = ensureState();
    const cfg = getConfig();
    if (!SQ || !cfg || !st) return { total: 0, formatted: '$0', lineItems: [] };
    const pkgs = livePackages(cfg, st);
    return SQ.compute(cfg, st, pkgs, activeAddons());
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

  function chromeNavOpts() {
    return { hasAddons: !!(activeAddons() || []).length };
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
      packageIds: pkgs[0] ? [String(pkgs[0].id)] : [],
      addonIds: [],
      answers: SQ.defaultAnswers(cfg),
      draftId: null,
      customer: { name: '', phone: '', email: '', notes: '' },
    };
    document.getElementById('sq-workspace')?.classList.remove('hidden');
    document.getElementById('sq-list-wrap')?.classList.add('hidden');
    const flow = getQuickQuoteFlow();
    const start =
      typeof SQ.firstUsefulChromeIndex === 'function'
        ? SQ.firstUsefulChromeIndex(cfg, flow, chromeNavOpts())
        : 0;
    setChromeStep(start);
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
    const prev =
      SQ && typeof SQ.prevUsefulChromeIndex === 'function'
        ? SQ.prevUsefulChromeIndex(cfg, flow, chromeIdx, chromeNavOpts())
        : chromeIdx - 1;
    if (prev < 0) {
      exitQuote();
      return;
    }
    setChromeStep(prev);
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
      if (!requireCustomerContact()) return;
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
    const next =
      SQ && typeof SQ.nextUsefulChromeIndex === 'function'
        ? SQ.nextUsefulChromeIndex(cfg, flow, chromeIdx, chromeNavOpts())
        : chromeIdx + 1;
    if (next === chromeIdx) return;
    setChromeStep(next);
  }

  function packageIdSelected(ids, id) {
    const sid = String(id);
    return (ids || []).some((x) => String(x) === sid);
  }

  function togglePackage(id) {
    const st = ensureState();
    if (!st) return;
    const sid = String(id);
    // Quick Quote package step is single-select (radio), not multi-toggle.
    st.packageIds = [sid];
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
    const draftBtn = `<button type="button" class="btn btn-brand sq-save-btn" onclick="HublySmartQuoteUI.saveDraft()">Save draft</button>`;
    const actions = onReview
      ? `${draftBtn}
         <button type="button" class="btn btn-out sq-save-btn" onclick="HublySmartQuoteUI.openSendMenu()">Send quote</button>
         <button type="button" class="btn btn-ink sq-save-btn" onclick="HublySmartQuoteUI.bookThisQuote()">Book Now</button>`
      : draftBtn;
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
      const pkgs = livePackages(cfg, st);
      body = `<div class="sq-pkg-grid sq-pkg-grid-visual">${pkgs
        .map((p) => {
          const sel = packageIdSelected(st.packageIds, p.id) ? ' sel' : '';
          const img = p.image
            ? `<img src="${esc(p.image)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'sq-pkg-ph',textContent:'📷'}))">`
            : `<div class="sq-pkg-ph" aria-hidden="true">📷</div>`;
          const dur = p.dur
            ? `<span class="sq-pkg-dur">⏱ ${esc(String(p.dur))}${
                /hr|hour|min/i.test(String(p.dur)) ? '' : ' hrs'
              }</span>`
            : '';
          const pkgIdAttr = esc(String(p.id));
          return `<button type="button" class="sq-pkg sq-pkg-visual${sel}" data-pkg-id="${pkgIdAttr}" onclick="HublySmartQuoteUI.togglePackage(this.getAttribute('data-pkg-id'))">
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
        <p class="sq-muted" style="margin:0 0 14px;line-height:1.45;">You’re building this for a client — enter their <strong>name, phone, and email</strong> so you can send the quote (text or email) when you’re done.</p>
        <div class="sq-field"><div class="sq-lbl">Client name *</div><input type="text" value="${esc(c.name || '')}" placeholder="Jordan Lee" autocomplete="name" oninput="HublySmartQuoteUI.setCustomer('name',this.value)"></div>
        <div class="sq-field-row">
          <div class="sq-field"><div class="sq-lbl">Phone *</div><input type="tel" inputmode="numeric" value="${esc(c.phone || '')}" placeholder="000-000-0000" autocomplete="tel" oninput="HublySmartQuoteUI.setCustomerPhone(this)"></div>
          <div class="sq-field"><div class="sq-lbl">Email *</div><input type="email" value="${esc(c.email || '')}" placeholder="jordan@email.com" autocomplete="email" oninput="HublySmartQuoteUI.setCustomer('email',this.value)"></div>
        </div>
        <p class="sq-muted" style="margin:0 0 10px;font-size:12px;">Need at least a phone or email — both is best.</p>
        <div class="sq-field"><div class="sq-lbl">Notes</div><textarea rows="3" placeholder="Anything to remember…" oninput="HublySmartQuoteUI.setCustomer('notes',this.value)">${esc(c.notes || '')}</textarea></div>`;
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
        '<div class="sq-muted">Nothing to ask here — tap <strong>Next step</strong> to pick a package and price.</div>';
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
              const sel = addonIdSelected(st.addonIds, a.id) ? ' sel' : '';
              const aid = esc(String(a.id));
              return `<button type="button" class="sq-tile${sel}" data-addon-id="${aid}" onclick="HublySmartQuoteUI.toggleAddon(this.getAttribute('data-addon-id'))"><strong>${esc(a.name)}</strong><em>+${SQ.formatMoney(a.price)}</em></button>`;
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
          <button type="button" class="btn btn-ink btn-sm sq-draft-btn" onclick="HublySmartQuoteUI.saveDraft()">Save draft</button>
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

  function addonIdSelected(ids, id) {
    const sid = String(id);
    return (ids || []).some((x) => String(x) === sid);
  }

  function toggleAddon(id) {
    const st = ensureState();
    if (!st) return;
    const sid = String(id);
    st.addonIds = Array.isArray(st.addonIds) ? st.addonIds.map(String) : [];
    const i = st.addonIds.indexOf(sid);
    if (i >= 0) st.addonIds.splice(i, 1);
    else st.addonIds.push(sid);
    renderWorkspace();
  }

  function formatQuotePhoneValue(raw) {
    const v = String(raw || '')
      .replace(/[^0-9]/g, '')
      .slice(0, 10);
    if (v.length >= 7) return v.slice(0, 3) + '-' + v.slice(3, 6) + '-' + v.slice(6);
    if (v.length >= 4) return v.slice(0, 3) + '-' + v.slice(3);
    return v;
  }

  function setCustomerPhone(el) {
    if (!el) return;
    if (typeof global.formatPhone === 'function') global.formatPhone(el);
    else el.value = formatQuotePhoneValue(el.value);
    setCustomer('phone', el.value);
  }

  function requireCustomerContact(opts) {
    const st = ensureState();
    const cfg = getConfig();
    const c = (st && st.customer) || {};
    const name = String(c.name || '').trim();
    const phoneDigits = String(c.phone || '').replace(/\D/g, '');
    const email = String(c.email || '').trim();
    const goCustomer = () => {
      try {
        const custIdx = (cfg && cfg.steps ? cfg.steps : []).findIndex((s) => s && s.id === 'customer');
        if (custIdx >= 0) setStep(custIdx);
      } catch (e) {}
    };
    if (!name) {
      if (typeof toast === 'function') toast('Add the client’s name so you can send this quote');
      goCustomer();
      return false;
    }
    if (phoneDigits.length < 10 && !email) {
      if (typeof toast === 'function') toast('Add a phone (000-000-0000) or email to send the quote');
      goCustomer();
      return false;
    }
    if (phoneDigits.length && phoneDigits.length !== 10) {
      if (typeof toast === 'function') toast('Phone should be 10 digits — 000-000-0000');
      goCustomer();
      return false;
    }
    if (opts && opts.requireEmail && (!email || !email.includes('@'))) {
      if (typeof toast === 'function') toast('Add the client’s email to send');
      goCustomer();
      return false;
    }
    if (opts && opts.requirePhone && phoneDigits.length !== 10) {
      if (typeof toast === 'function') toast('Add the client’s phone (000-000-0000) to text the quote');
      goCustomer();
      return false;
    }
    return true;
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
        service_name: packageNamesFromQuote(rec) || 'Quick Quote',
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
        .map((id) => (pkgs.find((p) => String(p.id) === String(id)) || {}).name)
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
    if (!requireCustomerContact({ requireEmail: true })) return;
    const c = st.customer || {};
    const email = String(c.email || '').trim();

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
      '<div class="empty" style="padding:28px;"><div class="empty-msg">No quotes yet — start a Quick Quote for a customer.</div></div>';
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
      packageIds: (rec.packageIds || []).map((x) => String(x)),
      addonIds: (rec.addonIds || []).map((x) => String(x)),
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
    if (!requireCustomerContact()) return;
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
    if (!st) return;
    if (!(st.packageIds || []).length) {
      if (typeof toast === 'function') toast('Pick at least one package');
      return;
    }
    if (!requireCustomerContact({ requirePhone: true })) return;
    const c = st.customer || {};
    const phone = String(c.phone || '').replace(/[^\d+]/g, '');
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
    renderList();
    createQuoteLead(rec).catch(() => {});
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
    const biz = app.biz || 'Quote';
    const phone = app.phone || '';
    const logoUrl = app.logoUrl || '';
    const initials = String(biz)
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'QB';
    const clientBits = [rec.customerName || 'Customer', rec.customerPhone, rec.customerEmail].filter(Boolean);
    const lines = (money.lineItems || [])
      .filter((l) => l && l.amount)
      .map((l) => {
        const amt = Number(l.amount) || 0;
        const showSign = l.kind !== 'package';
        const sign = amt < 0 ? '−' : '+';
        return `<div class="sq-line"><span>${esc(l.label)}</span><strong>${
          showSign ? sign : ''
        }${SQ.formatMoney(Math.abs(amt))}</strong></div>`;
      })
      .join('');
    const includes = (cfg.includes || []).map((x) => `<li>${esc(x)}</li>`).join('');
    const tip =
      cfg.tip && (cfg.tip.title || cfg.tip.body)
        ? `<div class="sq-tip"><strong>${esc(cfg.tip.title || 'Tip')}</strong><p>${esc(
            cfg.tip.body || ''
          )}</p></div>`
        : '';
    const logoBlock = logoUrl
      ? `<img class="brand-logo" src="${esc(logoUrl)}" alt="${esc(biz)}">`
      : `<div class="brand-mark">${esc(initials)}</div>`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Quote — ${esc(biz)}</title>
      <style>
        *{box-sizing:border-box}
        body{margin:0;padding:32px 20px 48px;background:#e8eef5;color:#0f172a;
          font-family:'Plus Jakarta Sans','DM Sans',system-ui,-apple-system,sans-serif}
        .sheet{max-width:440px;margin:0 auto}
        .brand{display:flex;align-items:center;gap:14px;margin-bottom:18px}
        .brand-logo{max-height:52px;max-width:140px;width:auto;border-radius:8px;object-fit:contain;background:#fff;padding:4px}
        .brand-mark{width:52px;height:52px;border-radius:14px;background:#141B2B;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;flex-shrink:0}
        .brand-copy h1{margin:0;font-size:22px;font-weight:800;letter-spacing:-.02em;color:#141B2B}
        .brand-copy p{margin:4px 0 0;font-size:13px;color:#64748b}
        .for{font-size:13px;color:#475569;margin:0 0 14px;line-height:1.45}
        .for strong{color:#141B2B}
        .card{background:#0f172a;color:#f8fafc;border-radius:18px;padding:22px 20px;box-shadow:0 16px 40px rgba(15,23,42,.18)}
        .kicker{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8}
        .total{font-size:40px;font-weight:800;margin:8px 0 14px;color:#fff;letter-spacing:-.02em}
        .sq-lines{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
        .sq-line{display:flex;justify-content:space-between;gap:12px;font-size:13px;color:#cbd5e1}
        .sq-line strong{color:#fff;font-weight:700}
        .sq-includes{margin:0 0 14px;padding-left:18px;font-size:13px;color:#cbd5e1;line-height:1.55}
        .sq-tip{background:color-mix(in srgb,${esc(accent)} 22%,#0f172a);border:1px solid color-mix(in srgb,${esc(
      accent
    )} 45%,transparent);border-radius:12px;padding:12px;margin-bottom:12px}
        .sq-tip strong{display:block;font-size:12px;margin-bottom:4px;color:#fff}
        .sq-tip p{margin:0;font-size:12px;color:#e2e8f0;line-height:1.4}
        .disc{margin:0;font-size:11px;color:#94a3b8;line-height:1.45}
        .notes{margin:14px 0 0;padding:12px 14px;background:#fff;border-radius:12px;border:1px solid #dbe3ee;font-size:13px;color:#334155;line-height:1.45}
        .notes strong{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;margin-bottom:4px}
        .print-btn{display:block;width:100%;margin-top:18px;padding:12px 16px;border-radius:12px;border:none;background:${esc(
          accent
        )};color:#fff;font-weight:700;font-size:14px;cursor:pointer}
        @media print{
          body{background:#fff;padding:0}
          .print-btn{display:none}
          .sheet{max-width:none}
          .card{-webkit-print-color-adjust:exact;print-color-adjust:exact}
        }
      </style></head><body>
      <div class="sheet">
        <div class="brand">${logoBlock}<div class="brand-copy"><h1>${esc(biz)}</h1>${
      phone ? `<p>${esc(phone)}</p>` : ''
    }</div></div>
        <p class="for">Prepared for <strong>${esc(clientBits.join(' · '))}</strong></p>
        <div class="card">
          <div class="kicker">Your quote</div>
          <div class="total">${esc(money.formatted)}</div>
          <div class="sq-lines">${lines || '<div class="sq-line"><span>Estimate</span><strong>—</strong></div>'}</div>
          ${includes ? `<ul class="sq-includes">${includes}</ul>` : ''}
          ${tip}
          <p class="disc">${esc(SQ.estimateDisclaimer(cfg && cfg.trade))}</p>
        </div>
        ${
          rec.notes
            ? `<div class="notes"><strong>Notes</strong>${esc(rec.notes)}</div>`
            : ''
        }
        <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
      </div>
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
    if (!requireCustomerContact()) return;
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
    const picked = pkgs.find((p) => packageIdSelected(rec.packageIds, p.id)) || pkgs[0];
    const svcName = (picked && picked.name) || null;
    const addons = activeAddons().filter((a) => addonIdSelected(rec.addonIds, a.id));

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
      <div class="modal-h"><div class="modal-t">Customize questions</div><button type="button" class="modal-x" onclick="HublySmartQuoteUI.closeSetup()">×</button></div>
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
    if (f && f._custom) return `Your custom question · shown under “${step}”`;
    if (f && f.rule) return `Customers answer this under “${step}” · changes the estimate`;
    if (f && f.type === 'toggle') return `Optional upsell under “${step}”`;
    return `Customers answer this under “${step}”`;
  }

  function ensureCustomFields() {
    const app = appState();
    if (!app) return [];
    if (!app.quoteConfig || typeof app.quoteConfig !== 'object') app.quoteConfig = {};
    if (!Array.isArray(app.quoteConfig.customFields)) app.quoteConfig.customFields = [];
    return app.quoteConfig.customFields;
  }

  function isOwnerCustomField(id) {
    return ensureCustomFields().some((f) => f && String(f.id) === String(id));
  }

  function refreshSetupUi() {
    const inline = document.getElementById('ed-quote-setup');
    if (inline) {
      renderSetupInline('ed-quote-setup');
      return;
    }
    const body = document.getElementById('sq-setup-body');
    if (body && !document.getElementById('m-sq-setup')?.classList.contains('hidden')) {
      body.innerHTML = buildSetupHtml({ inline: false });
    }
  }

  function customQuestionFormHtml() {
    return `<div class="sq-setup-add" id="sq-add-q">
      <div class="sq-lbl" style="margin:0 0 6px">Add a question</div>
      <p class="sq-muted" style="margin:0 0 10px">Your own questions show in Quick Quote and Book Now for every industry.</p>
      <div class="sq-setup-add-grid">
        <div class="sq-field" style="margin:0"><label class="sq-lbl">Question</label>
          <input type="text" id="sq-add-q-label" placeholder="e.g. Preferred shoot location" autocomplete="off"></div>
        <div class="sq-field" style="margin:0"><label class="sq-lbl">Type</label>
          <select id="sq-add-q-type" onchange="HublySmartQuoteUI.onCustomQuestionTypeChange()">
            <option value="text">Short text</option>
            <option value="textarea">Long text</option>
            <option value="toggle">Yes / No</option>
            <option value="tiles">Multiple choice</option>
          </select></div>
        <div class="sq-field" style="margin:0"><label class="sq-lbl">Ask on</label>
          <select id="sq-add-q-step">
            <option value="subject">Details (first step)</option>
            <option value="modifiers">Extras step</option>
          </select></div>
        <div class="sq-field sq-add-q-extra hidden" id="sq-add-q-price-wrap" style="margin:0"><label class="sq-lbl">If Yes, add $</label>
          <input type="number" id="sq-add-q-price" min="0" step="1" value="0" placeholder="0"></div>
        <div class="sq-field sq-add-q-extra hidden" id="sq-add-q-choices-wrap" style="margin:0;grid-column:1/-1"><label class="sq-lbl">Choices (comma-separated)</label>
          <input type="text" id="sq-add-q-choices" placeholder="e.g. Indoor, Outdoor, Studio"></div>
      </div>
      <button type="button" class="btn btn-out btn-sm" style="margin-top:10px" onclick="HublySmartQuoteUI.addCustomQuestion()">+ Add question</button>
    </div>`;
  }

  function onCustomQuestionTypeChange() {
    const type = document.getElementById('sq-add-q-type')?.value || 'text';
    const price = document.getElementById('sq-add-q-price-wrap');
    const choices = document.getElementById('sq-add-q-choices-wrap');
    if (price) price.classList.toggle('hidden', type !== 'toggle');
    if (choices) choices.classList.toggle('hidden', type !== 'tiles');
  }

  function addCustomQuestion() {
    const SQ = global.HublySmartQuote;
    const app = appState();
    if (!app || !SQ) return;
    const label = String(document.getElementById('sq-add-q-label')?.value || '').trim();
    if (!label) {
      if (typeof toast === 'function') toast('Add a question label first');
      return;
    }
    const type = document.getElementById('sq-add-q-type')?.value || 'text';
    const step = document.getElementById('sq-add-q-step')?.value === 'modifiers' ? 'modifiers' : 'subject';
    const list = ensureCustomFields();
    let base = (SQ.slug ? SQ.slug(label) : label.toLowerCase().replace(/[^a-z0-9]+/g, '_')).replace(/-/g, '_');
    if (!base) base = 'q';
    let id = 'custom_' + base;
    let n = 2;
    while (list.some((f) => f && f.id === id) || (getConfig()?.fields && getConfig().fields[id])) {
      id = 'custom_' + base + '_' + n;
      n++;
    }
    const field = { id, step, type, label, optional: true, _custom: true };
    if (type === 'toggle') {
      const amount = Number(document.getElementById('sq-add-q-price')?.value) || 0;
      if (amount > 0) field.rule = { type: 'flat', amount, label: label };
    } else if (type === 'tiles') {
      const raw = String(document.getElementById('sq-add-q-choices')?.value || '').trim();
      const parts = raw
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 8);
      if (parts.length < 2) {
        if (typeof toast === 'function') toast('Add at least two choices, separated by commas');
        return;
      }
      field.options = parts.map((lab) => ({
        id: (SQ.slug ? SQ.slug(lab) : lab.toLowerCase().replace(/[^a-z0-9]+/g, '_')) || 'opt',
        label: lab,
        surcharge: 0,
      }));
    } else if (type === 'textarea') {
      field.type = 'textarea';
    } else {
      field.type = 'text';
    }
    list.push(field);
    try {
      if (typeof saveStorefront === 'function') saveStorefront();
    } catch (e) {}
    persistQuotes();
    refreshSetupUi();
    if (!document.getElementById('sq-workspace')?.classList.contains('hidden')) renderWorkspace();
    if (typeof toast === 'function') toast('Question added');
  }

  function removeCustomQuestion(id) {
    const list = ensureCustomFields();
    const sid = String(id || '');
    const next = list.filter((f) => f && String(f.id) !== sid);
    if (next.length === list.length) return;
    const app = appState();
    if (!app?.quoteConfig) return;
    app.quoteConfig.customFields = next;
    if (Array.isArray(app.quoteConfig.disabledFields)) {
      app.quoteConfig.disabledFields = app.quoteConfig.disabledFields.filter((x) => String(x) !== sid);
    }
    if (app.quoteConfig.fieldOverrides) delete app.quoteConfig.fieldOverrides[sid];
    try {
      if (typeof saveStorefront === 'function') saveStorefront();
    } catch (e) {}
    persistQuotes();
    refreshSetupUi();
    if (!document.getElementById('sq-workspace')?.classList.contains('hidden')) renderWorkspace();
    if (typeof toast === 'function') toast('Question removed');
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
        const custom = !!(f._custom || isOwnerCustomField(f.id));
        return `<div class="sq-setup-row sq-setup-tog">
          <label class="sq-setup-tog-copy" style="cursor:pointer;flex:1;min-width:0">
            <strong>${esc(f.label || f.id)}${custom ? ' <span class="sq-setup-custom-tag">Custom</span>' : ''}</strong>
            <em>${esc(fieldOwnerHelp(cfg, f))}</em>
          </label>
          <span class="sq-setup-tog-actions">
            ${
              custom
                ? `<button type="button" class="btn btn-out btn-sm" title="Remove question" onclick="event.preventDefault();HublySmartQuoteUI.removeCustomQuestion('${esc(
                    f.id
                  )}')">×</button>`
                : ''
            }
            <label class="tog" title="Show in quotes"><input type="checkbox" data-sq-field="${esc(f.id)}" ${
              on ? 'checked' : ''
            } onchange="HublySmartQuoteUI.previewSetupInline()"><span class="tog-sl"></span></label>
          </span>
        </div>`;
      })
      .join('');
    const surchargeFields = fieldEntries.filter(
      (f) => f && f.type === 'tiles' && Array.isArray(f.options) && f.options.length && !disabled.has(f.id)
    );
    const surchargeHtml = surchargeFields
      .map((f) => {
        const rows = (f.options || [])
          .map((o) => {
            if (!o || !o.id) return '';
            const val = Number(o.surcharge) || 0;
            return `<div class="sq-setup-surcharge-row">
              <span><strong>${esc(o.label || o.id)}</strong><em>${esc(f.label || f.id)}</em></span>
              <div class="pfx"><span class="pfx-sym">+$</span><input type="number" min="0" step="1" value="${val}" data-sq-opt-surcharge data-sq-field-id="${esc(
                f.id
              )}" data-sq-opt-id="${esc(o.id)}" oninput="HublySmartQuoteUI.previewSetupInline()"></div>
            </div>`;
          })
          .join('');
        return rows
          ? `<div class="sq-setup-surcharge-block" style="margin:0 0 12px"><div class="sq-lbl" style="margin:0 0 6px">${esc(
              f.label || f.id
            )}</div><div class="sq-setup-surcharge-list">${rows}</div></div>`
          : '';
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
        <p class="sq-muted" style="margin:0 0 10px;">Flip a switch off if you don’t want that question in Quick Quote or Book Now — or add your own below.</p>
        <div class="sq-setup-list">${fieldRows || '<div class="sq-muted">No quote questions for this industry yet.</div>'}</div>
        ${customQuestionFormHtml()}
      </div>
      ${
        surchargeHtml
          ? `<div class="sq-setup-section">
        <div class="sq-lbl">Price adds by choice</div>
        <p class="sq-muted" style="margin:0 0 8px;">Extra $ when they pick Residential vs Commercial (or similar). $0 means no add-on for that choice.</p>
        ${surchargeHtml}
      </div>`
          : ''
      }
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
      <div class="sq-setup-section"><div class="sq-lbl">Customize questions</div>
        <p class="sq-muted" style="margin:0 0 10px;">Turn fields on/off for ${esc(tradeLabel)}, or add your own. Changes apply to Quick Quote and Book Now.</p>
        <div class="sq-setup-list">${fieldRows || '<div class="sq-muted">No fields</div>'}</div>
        ${customQuestionFormHtml()}
      </div>
      ${
        surchargeHtml
          ? `<div class="sq-setup-section">
        <div class="sq-lbl">Price adds by choice</div>
        <p class="sq-muted" style="margin:0 0 8px;">Set the extra $ for each choice (e.g. Commercial +$40). Applies to Quick Quote and Book Now.</p>
        ${surchargeHtml}
      </div>`
          : ''
      }
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
      if (typeof toast === 'function') toast('Quick Quote not ready');
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
      root.innerHTML = '<p class="sq-muted">Quick Quote not ready yet.</p>';
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
    const overrides = Object.assign({}, app.quoteConfig.fieldOverrides || {});
    root.querySelectorAll('[data-sq-opt-surcharge]').forEach((inp) => {
      const fid = inp.getAttribute('data-sq-field-id');
      const oid = inp.getAttribute('data-sq-opt-id');
      if (!fid || !oid) return;
      if (!overrides[fid]) overrides[fid] = {};
      if (!overrides[fid].optionSurcharges) overrides[fid].optionSurcharges = {};
      const n = Number(inp.value);
      overrides[fid].optionSurcharges[oid] = Number.isFinite(n) && n >= 0 ? n : 0;
    });
    app.quoteConfig.fieldOverrides = overrides;
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
    if (typeof toast === 'function') toast('Customize questions saved');
  }

  function saveSetupInline() {
    const root = document.getElementById('ed-quote-setup');
    if (!saveFromRoot(root)) return;
    if (typeof toast === 'function') toast('Customize questions saved');
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
    setCustomerPhone,
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
    addCustomQuestion,
    removeCustomQuestion,
    onCustomQuestionTypeChange,
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
