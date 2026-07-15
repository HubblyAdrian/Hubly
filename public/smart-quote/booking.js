/**
 * Public Book Now ↔ Smart Quote bridge.
 * Same trade fields + price math as owner Smart Quote; schedule stays booking-native.
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

  function getCfg() {
    const SQ = global.HublySmartQuote;
    const st = appState();
    if (!SQ || !st) return null;
    let bp = null;
    try {
      if (typeof getActiveBlueprint === 'function') bp = getActiveBlueprint();
    } catch (e) {}
    const cfg = SQ.resolveConfig({
      businessType: st.businessType || (bp && bp.id) || 'detailing',
      blueprint: bp,
      ownerConfig: st.quoteConfig || {},
    });
    // Detailing: fold owner dirty surcharge settings into condition options
    if (cfg.trade === 'detailing' && st.dirtySurcharge && st.dirtySurcharge.enabled && cfg.fields.condition) {
      const d = st.dirtySurcharge;
      const type = d.type || 'percent';
      const map = [d.light, d.moderate, d.heavy, d.extreme];
      cfg.fields.condition.options = (cfg.fields.condition.options || []).map((opt, i) => {
        const n = Number(map[i]);
        if (!Number.isFinite(n)) return opt;
        if (type === 'percent') return Object.assign({}, opt, { rule: { type: 'percent', value: n }, surcharge: 0 });
        return Object.assign({}, opt, { rule: { type: 'flat', amount: n }, surcharge: 0 });
      });
    } else if (cfg.trade === 'detailing' && cfg.fields.condition && !(st.dirtySurcharge && st.dirtySurcharge.enabled)) {
      // Keep condition UI for UX, but zero surcharges if owner disabled dirty pricing
      cfg.fields.condition.options = (cfg.fields.condition.options || []).map((opt) =>
        Object.assign({}, opt, { rule: { type: 'percent', value: 0 }, surcharge: 0 })
      );
    }
    return cfg;
  }

  function serviceAsPackage() {
    const SQ = global.HublySmartQuote;
    const svc = S.bkSvcObj || { name: S.bkService, price: S.bkBasePrice };
    if (!svc || !svc.name) return [];
    let price = Number(svc.price != null ? svc.price : svc.defaultPrice);
    if (svc.pricingType === 'variable') {
      // Prefer sedan/default tier if present; else base price from vehicle sync
      const vp = svc.varPrices || {};
      price = Number(vp.sedan || vp.coupe || svc.price) || 0;
    }
    if (!Number.isFinite(price)) price = Number(S.bkBasePrice) || 0;
    return [
      {
        id: svc.id || (SQ ? SQ.slug(svc.name) : 'svc'),
        name: svc.name,
        price: price,
        desc: svc.desc || '',
      },
    ];
  }

  function addonList() {
    return (S.bkAddons || []).map((a, i) => ({
      id: 'bk-addon-' + i + '-' + (a.name || ''),
      name: a.name,
      price: Number(a.price) || 0,
    }));
  }

  function ensureBkSq() {
    if (!S._bkSq) {
      const SQ = global.HublySmartQuote;
      const cfg = getCfg();
      S._bkSq = {
        answers: SQ && cfg ? SQ.defaultAnswers(cfg) : {},
        packageIds: [],
      };
    }
    const pkgs = serviceAsPackage();
    if (pkgs[0]) S._bkSq.packageIds = [pkgs[0].id];
    return S._bkSq;
  }

  function computeMoney() {
    const SQ = global.HublySmartQuote;
    const cfg = getCfg();
    const st = ensureBkSq();
    if (!SQ || !cfg) {
      const base = (S.bkBasePrice || 0) + (S.bkVSurcharge || 0) + (S.bkCondSurcharge || 0);
      const addons = (S.bkAddons || []).reduce((s, a) => s + (Number(a.price) || 0), 0);
      const sub = base + addons;
      const disc = Number(S.bkDiscountPercent) || 0;
      const total = Math.max(0, sub - (disc > 0 ? (sub * disc) / 100 : 0));
      return { total, formatted: '$' + total.toFixed(2), lineItems: [], subtotal: sub };
    }
    const pkgs = serviceAsPackage();
    // Variable pricing: update package price from vehicle tier if detailing
    if (S.bkSvcObj && S.bkSvcObj.pricingType === 'variable' && pkgs[0]) {
      const tier = mapVehicleTier(st.answers.vehicleType);
      const vp = S.bkSvcObj.varPrices || {};
      const tierPrice = Number(vp[tier]);
      if (Number.isFinite(tierPrice) && tierPrice > 0) pkgs[0].price = tierPrice;
      else if (S.bkBasePrice > 0) pkgs[0].price = S.bkBasePrice;
    }
    const addons = addonList();
    const money = SQ.compute(
      cfg,
      { packageIds: pkgs.map((p) => p.id), answers: st.answers, addonIds: addons.map((a) => a.id) },
      pkgs,
      addons
    );
    const disc = Number(S.bkDiscountPercent) || 0;
    if (disc > 0) {
      const cut = money.total * (disc / 100);
      money.lineItems.push({ kind: 'discount', label: disc + '% off', amount: -cut });
      money.total = SQ.money(Math.max(0, money.total - cut));
      money.formatted = SQ.formatMoney(money.total);
    }
    return money;
  }

  function mapVehicleTier(vehicleTypeId) {
    const id = String(vehicleTypeId || '').toLowerCase();
    if (id === 'suv' || id === 'truck') return id === 'truck' ? 'truck' : 'suv';
    if (id === 'van') return 'van';
    if (id === 'crossover') return 'crossover';
    if (id === 'coupe') return 'coupe';
    return 'sedan';
  }

  /** Mirror SQ answers into legacy booking fields used by submitBooking. */
  function syncLegacyFromAnswers() {
    const st = ensureBkSq();
    const a = st.answers || {};
    const cfg = getCfg();
    if (a.vehicleType) {
      const opt = cfg && cfg.fields.vehicleType && (cfg.fields.vehicleType.options || []).find((o) => o.id === a.vehicleType);
      S.bkVType = opt ? opt.label : a.vehicleType;
      S.bkVSurcharge = opt && opt.surcharge ? Number(opt.surcharge) : 0;
      if (S.bkSvcObj && S.bkSvcObj.pricingType === 'variable') {
        const tier = mapVehicleTier(a.vehicleType);
        const vp = S.bkSvcObj.varPrices || {};
        const tierPrice = Number(vp[tier]);
        if (tierPrice > 0) {
          S.bkBasePrice = tierPrice;
          S.bkVSurcharge = 0;
        }
      }
    }
    if (a.condition) {
      const opt = cfg && cfg.fields.condition && (cfg.fields.condition.options || []).find((o) => o.id === a.condition);
      S.bkCondName = opt ? opt.label : a.condition;
    }
    if (typeof document !== 'undefined') {
      if (a.year != null) {
        const el = document.getElementById('bk-year');
        if (el) el.value = a.year;
      }
      if (a.make != null) {
        const el = document.getElementById('bk-make');
        if (el) el.value = a.make;
      }
      if (a.model != null) {
        const el = document.getElementById('bk-model');
        if (el) el.value = a.model;
      }
      if (a.color != null) {
        S.bkVColor = a.color;
        const lbl = document.getElementById('sel-color-lbl');
        if (lbl) lbl.textContent = a.color;
      }
    } else if (a.color != null) {
      S.bkVColor = a.color;
    }
    // Non-vehicle intake → notes bag
    S.bkIntake = S.bkIntake || {};
    Object.keys(a).forEach((k) => {
      if (['vehicleType', 'condition', 'year', 'make', 'model', 'color'].includes(k)) return;
      if (a[k] === '' || a[k] == null || a[k] === false) return;
      S.bkIntake[k] = a[k];
    });
  }

  function setAnswer(fieldId, value) {
    const st = ensureBkSq();
    const cfg = getCfg();
    st.answers[fieldId] = value;
    syncLegacyFromAnswers();
    const f = cfg && cfg.fields[fieldId];
    if (f && f.type === 'range') {
      const lbl = document.getElementById('bk-sq-range-' + fieldId);
      if (lbl) lbl.textContent = value;
      updateEstimate();
      if (typeof updateStickyPrice === 'function') updateStickyPrice();
      return;
    }
    const moreOpen = !!document.querySelector('#bk-sq-intake details.sq-more[open]');
    renderIntake({ moreOpen });
    updateEstimate();
    if (typeof updateStickyPrice === 'function') updateStickyPrice();
  }

  function renderField(field) {
    const st = ensureBkSq();
    const ans = st.answers[field.id];
    if (field.type === 'tiles') {
      return `<div class="sq-field"><div class="sq-lbl">${esc(field.label)}</div>
        <div class="sq-tiles">${(field.options || [])
          .map((o) => {
            const sel = ans === o.id ? ' sel' : '';
            return `<button type="button" class="sq-tile${sel}" onclick="HublyBookingSQ.setAnswer('${esc(field.id)}','${esc(o.id)}')">
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
          <button type="button" onclick="HublyBookingSQ.nudge('${esc(field.id)}',-1)">−</button>
          <strong>${esc(ans)}</strong>
          <button type="button" onclick="HublyBookingSQ.nudge('${esc(field.id)}',1)">+</button>
        </div></div>`;
    }
    if (field.type === 'range') {
      return `<div class="sq-field"><div class="sq-lbl">${esc(field.label)}: <strong id="bk-sq-range-${esc(field.id)}">${esc(ans)}</strong></div>
        <input type="range" min="${field.min || 0}" max="${field.max || 100}" step="${field.step || 1}" value="${esc(ans)}"
          oninput="HublyBookingSQ.setAnswer('${esc(field.id)}',+this.value)"></div>`;
    }
    if (field.type === 'toggle') {
      return `<label class="sq-toggle"><input type="checkbox" ${ans ? 'checked' : ''} onchange="HublyBookingSQ.setAnswer('${esc(field.id)}',this.checked)"> ${esc(field.label)}</label>`;
    }
    return `<div class="sq-field"><div class="sq-lbl">${esc(field.label)}</div>
      <input type="text" value="${esc(ans || '')}" oninput="HublyBookingSQ.setAnswerText('${esc(field.id)}',this.value)"></div>`;
  }

  function nudge(fieldId, delta) {
    const cfg = getCfg();
    const st = ensureBkSq();
    const f = cfg && cfg.fields[fieldId];
    if (!f) return;
    let v = Number(st.answers[fieldId]) || 0;
    v += delta;
    if (f.min != null) v = Math.max(f.min, v);
    if (f.max != null) v = Math.min(f.max, v);
    setAnswer(fieldId, v);
  }

  function setAnswerText(fieldId, value) {
    const st = ensureBkSq();
    st.answers[fieldId] = value;
    syncLegacyFromAnswers();
    updateEstimate();
    if (typeof updateStickyPrice === 'function') updateStickyPrice();
  }

  function renderIntake(opts) {
    const SQ = global.HublySmartQuote;
    const cfg = getCfg();
    const root = typeof document !== 'undefined' ? document.getElementById('bk-sq-intake') : null;
    if (!root || !cfg || !SQ) return;
    ensureBkSq();
    const moreOpen =
      opts && opts.moreOpen != null
        ? !!opts.moreOpen
        : !!root.querySelector('details.sq-more[open]');
    const fields = []
      .concat(SQ.fieldsForStep(cfg, 'subject'))
      .concat(SQ.fieldsForStep(cfg, 'modifiers'));
    const parts = SQ.partitionFields(fields);
    let html =
      parts.primary.map(renderField).join('') ||
      '<p class="bk-step-sub" style="margin:0;">No extra details for this service — continue to pick a time.</p>';
    if (parts.secondary.length) {
      html += `<details class="sq-more"${moreOpen ? ' open' : ''}><summary>More details <span>(optional)</span></summary>${parts.secondary
        .map(renderField)
        .join('')}</details>`;
    }
    root.innerHTML = html;
  }

  function updateEstimate() {
    const SQ = global.HublySmartQuote;
    const cfg = getCfg();
    const money = computeMoney();
    const side = typeof document !== 'undefined' ? document.getElementById('bk-sq-estimate') : null;
    const mobile = typeof document !== 'undefined' ? document.getElementById('bk-sq-mobile-est') : null;
    let accent = (cfg && cfg.accent) || '#7c3aed';
    try {
      if (typeof getAccentColor === 'function') {
        const a = getAccentColor();
        if (a) accent = a;
      } else if (S.siteAccent || S.brandColor || S.color) {
        accent = S.siteAccent || S.brandColor || S.color;
      }
    } catch (e) {}
    if (cfg && SQ) {
      const cardHtml = SQ.renderEstimateCardHtml({
        accent,
        trade: cfg.trade,
        formatted: money.formatted,
        lineItems: money.lineItems,
        includes: cfg.includes,
        tip: cfg.tip,
        emptyText: 'Adjust details to update price',
        kicker: 'Your estimate',
        formatMoney: SQ.formatMoney,
        actionsHtml:
          '<div class="sq-muted" style="color:#94a3b8;font-size:11px;margin-top:4px;">Busy times stay blocked on the next step.</div>',
      });
      if (side) side.innerHTML = cardHtml;
      if (mobile) mobile.innerHTML = cardHtml;
    }
    const st = ensureBkSq();
    if (typeof document !== 'undefined') {
      const yearEl = document.getElementById('bk-year');
      if (st.answers.year != null && yearEl && !yearEl.value) yearEl.value = st.answers.year;
    }
    syncLegacyFromAnswers();
    return money;
  }

  function applyShellChrome() {
    if (typeof document === 'undefined') return;
    const shell = document.getElementById('p-booking');
    const cfg = getCfg();
    if (shell) shell.classList.add('bk-sq-mode');
    let accent = (cfg && cfg.accent) || '#7c3aed';
    try {
      if (typeof getAccentColor === 'function') {
        const a = getAccentColor();
        if (a) accent = a;
      } else if (S.siteAccent || S.brandColor || S.color) {
        accent = S.siteAccent || S.brandColor || S.color;
      }
    } catch (e) {}
    document.documentElement.style.setProperty('--sq-accent', accent);
    document.documentElement.style.setProperty('--bk-ui-accent', accent);
    const title = document.getElementById('bk-step-1-title');
    const sub = document.getElementById('bk-step-1-sub');
    const subjectStep =
      (cfg && cfg.steps && cfg.steps.find((s) => s && s.id === 'subject')) ||
      (cfg && cfg.steps && cfg.steps.find((s) => s && s.id !== 'packages')) ||
      null;
    if (title) title.textContent = (subjectStep && subjectStep.title) || 'Details';
    if (sub)
      sub.textContent =
        (subjectStep && subjectStep.blurb) || 'A few details so we can price this right';
    document.getElementById('bk-vehicle-block')?.classList.add('hidden');
    document.getElementById('bk-blueprint-intake')?.classList.add('hidden');
    document.getElementById('bk-sq-intake')?.classList.remove('hidden');
    const labels = document.getElementById('bk-prog-labels');
    if (labels) {
      labels.innerHTML = ['Details', 'When & where', 'Your info', 'Review']
        .map((t, i) => `<span data-bk-step="${i + 1}">${esc(t)}</span>`)
        .join('');
    }
  }

  function initForBooking() {
    if (!global.HublySmartQuote) return false;
    S._bkSq = null;
    ensureBkSq();
    applyShellChrome();
    renderIntake();
    updateEstimate();
    return true;
  }

  function refreshProgressLabels(step) {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('#bk-prog-labels span').forEach((el) => {
      const n = Number(el.getAttribute('data-bk-step'));
      el.classList.toggle('on', n === step);
      el.classList.toggle('done', n < step);
    });
  }

  global.HublyBookingSQ = {
    initForBooking,
    setAnswer,
    setAnswerText,
    nudge,
    renderIntake,
    updateEstimate,
    computeMoney,
    syncLegacyFromAnswers,
    refreshProgressLabels,
    getCfg,
  };
})(typeof window !== 'undefined' ? window : global);
