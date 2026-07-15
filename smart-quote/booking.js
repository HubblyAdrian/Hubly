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

  /** Prefer globalThis.S — hubly.html defines `const S` then assigns window.S. */
  function appState() {
    if (global.S) return global.S;
    try {
      if (typeof S !== 'undefined' && S) return S;
    } catch (e) {}
    return null;
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
    const app = appState() || {};
    const svc = app.bkSvcObj || { name: app.bkService, price: app.bkBasePrice };
    if (!svc || !svc.name) return [];
    let price = Number(svc.price != null ? svc.price : svc.defaultPrice);
    if (svc.pricingType === 'variable') {
      const vp = svc.varPrices || {};
      price = Number(vp.sedan || vp.coupe || svc.price) || 0;
    }
    if (!Number.isFinite(price)) price = Number(app.bkBasePrice) || 0;
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
    const app = appState() || {};
    return (app.bkAddons || []).map((a, i) => ({
      id: 'bk-addon-' + i + '-' + (a.name || ''),
      name: a.name,
      price: Number(a.price) || 0,
    }));
  }

  function ensureBkSq() {
    const app = appState();
    if (!app) return { answers: {}, packageIds: [] };
    if (!app._bkSq) {
      const SQ = global.HublySmartQuote;
      const cfg = getCfg();
      app._bkSq = {
        answers: SQ && cfg ? SQ.defaultAnswers(cfg) : {},
        packageIds: [],
      };
    }
    const pkgs = serviceAsPackage();
    if (pkgs[0]) app._bkSq.packageIds = [pkgs[0].id];
    return app._bkSq;
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
    const showPrice = priceUnlocked();
    const SQ = global.HublySmartQuote;
    if (field.type === 'tiles') {
      const rich = (field.options || []).some((o) => o && o.image);
      return `<div class="sq-field"><div class="sq-lbl">${esc(field.label)}</div>
        <div class="sq-tiles${rich ? ' sq-tiles-rich' : ''}">${(field.options || [])
          .map((o) => {
            const onclick = `onclick="HublyBookingSQ.setAnswer('${esc(field.id)}','${esc(o.id)}')"`;
            if (SQ && SQ.renderTileOptionHtml) {
              return SQ.renderTileOptionHtml(o, ans === o.id, onclick, showPrice);
            }
            const sel = ans === o.id ? ' sel' : '';
            return `<button type="button" class="sq-tile${sel}" ${onclick}>
              <strong>${esc(o.label)}</strong>
              ${o.desc ? `<span>${esc(o.desc)}</span>` : ''}
              ${showPrice && o.surcharge ? `<em>+$${o.surcharge}</em>` : ''}
            </button>`;
          })
          .join('')}</div></div>`;
    }
    if (field.type === 'stepper') {
      const unit =
        field.id === 'hours' ? ` ${Number(ans) === 1 ? 'hour' : 'hours'}` : '';
      return `<div class="sq-field"><div class="sq-lbl">${esc(field.label)}</div>
        <div class="sq-stepper sq-stepper-rich">
          <button type="button" onclick="HublyBookingSQ.nudge('${esc(field.id)}',-1)">−</button>
          <strong>${esc(ans)}${unit}</strong>
          <button type="button" onclick="HublyBookingSQ.nudge('${esc(field.id)}',1)">+</button>
        </div></div>`;
    }
    if (field.type === 'range') {
      return `<div class="sq-field"><div class="sq-lbl">${esc(field.label)}: <strong id="bk-sq-range-${esc(field.id)}">${esc(ans)}</strong></div>
        <input type="range" min="${field.min || 0}" max="${field.max || 100}" step="${field.step || 1}" value="${esc(ans)}"
          oninput="HublyBookingSQ.setAnswer('${esc(field.id)}',+this.value)"></div>`;
    }
    if (field.type === 'toggle') {
      const hint =
        field.id === 'secondShooter'
          ? '<em>Perfect for larger events or multiple locations.</em>'
          : '';
      return `<label class="sq-toggle sq-toggle-card"><input type="checkbox" ${ans ? 'checked' : ''} onchange="HublyBookingSQ.setAnswer('${esc(field.id)}',this.checked)"><span>${esc(field.label)}${hint}</span></label>`;
    }
    return `<div class="sq-field"><div class="sq-lbl">${esc(field.label)}</div>
      <input type="text" value="${esc(ans || '')}" oninput="HublyBookingSQ.setAnswerText('${esc(field.id)}',this.value)"></div>`;
  }

  function previewPicks() {
    const SQ = global.HublySmartQuote;
    const cfg = getCfg();
    const st = ensureBkSq();
    const app = appState() || {};
    const picks = [];
    if (app.bkService) picks.push(app.bkService);
    if (!cfg || !SQ) return picks;
    const fields = []
      .concat(SQ.fieldsForStep(cfg, 'subject'))
      .concat(SQ.fieldsForStep(cfg, 'modifiers'));
    fields.forEach((f) => {
      const v = st.answers[f.id];
      if (v == null || v === '' || v === false) return;
      if (f.type === 'tiles') {
        const opt = (f.options || []).find((o) => o.id === v);
        if (opt) picks.push(opt.label);
      } else if (f.type === 'stepper' || f.type === 'range') {
        const unit = f.id === 'hours' ? (Number(v) === 1 ? ' hour' : ' hours') : '';
        picks.push(`${f.label}: ${v}${unit}`);
      } else if (f.type === 'toggle' && v) {
        picks.push(f.label);
      }
    });
    return picks.slice(0, 6);
  }

  function updateEstimate() {
    const SQ = global.HublySmartQuote;
    const cfg = getCfg();
    const money = computeMoney();
    const side = typeof document !== 'undefined' ? document.getElementById('bk-sq-estimate') : null;
    const mobile = typeof document !== 'undefined' ? document.getElementById('bk-sq-mobile-est') : null;
    const shell = typeof document !== 'undefined' ? document.getElementById('p-booking') : null;
    let accent = (cfg && cfg.accent) || '#0f766e';
    try {
      if (typeof getAccentColor === 'function') {
        const a = getAccentColor();
        if (a) accent = a;
      } else {
        const app = appState() || {};
        if (app.siteAccent || app.brandColor || app.color) {
          accent = app.siteAccent || app.brandColor || app.color;
        }
      }
    } catch (e) {}
    const showPrice = priceUnlocked();
    if (shell) shell.classList.toggle('bk-price-open', showPrice);
    const app = appState() || {};
    const w = wizardCfg();
    const picks = previewPicks();
    const includes =
      (w && Array.isArray(w.sidebarIncludes) && w.sidebarIncludes.length
        ? w.sidebarIncludes
        : cfg.includes) || [];
    if (cfg && SQ) {
      const cardHtml = renderMockSidebar({
        accent,
        money,
        showPrice,
        picks,
        includes,
        wizard: w,
        app,
        cfg,
      });
      if (side) side.innerHTML = cardHtml;
      if (mobile) mobile.innerHTML = cardHtml;
    }
    const stickyDetail = typeof document !== 'undefined' ? document.getElementById('sticky-detail') : null;
    const stickyPrice = typeof document !== 'undefined' ? document.getElementById('sticky-price') : null;
    if (!showPrice) {
      if (stickyDetail) stickyDetail.textContent = picks.slice(1, 3).join(' · ') || 'Continue when ready';
      if (stickyPrice) stickyPrice.textContent = 'Continue';
      document.getElementById('bk-sticky-summary')?.classList.add('price-locked');
    } else {
      if (stickyPrice) stickyPrice.textContent = money.formatted || '';
      document.getElementById('bk-sticky-summary')?.classList.remove('price-locked');
    }
    const st = ensureBkSq();
    if (typeof document !== 'undefined') {
      const yearEl = document.getElementById('bk-year');
      if (st.answers.year != null && yearEl && !yearEl.value) yearEl.value = st.answers.year;
    }
    syncLegacyFromAnswers();
    return money;
  }

  function wizardCfg() {
    const app = appState() || {};
    return app.bookingWizard && typeof app.bookingWizard === 'object' ? app.bookingWizard : null;
  }

  function renderMockSidebar(opts) {
    const accent = opts.accent || '#2563eb';
    const showPrice = !!opts.showPrice;
    const money = opts.money || {};
    const picks = Array.isArray(opts.picks) ? opts.picks.filter(Boolean) : [];
    const includes = Array.isArray(opts.includes) ? opts.includes : [];
    const w = opts.wizard || {};
    const app = opts.app || {};
    const step = currentBkStep();
    const svcName = app.bkService || picks[0] || 'Your booking';
    const svcObj = app.bkSvcObj || {};
    const img =
      svcObj.image ||
      svcObj.imgUrl ||
      (Array.isArray(svcObj.photos) && svcObj.photos[0]) ||
      '';
    const dots = [1, 2, 3, 4]
      .map((i) => `<i class="${i === step ? 'on' : ''}"></i>`)
      .join('');
    const lines = showPrice
      ? (money.lineItems || [])
          .filter((l) => l && l.amount)
          .map((l) => {
            const amt = Number(l.amount) || 0;
            const sign = amt < 0 ? '−' : amt && l.kind !== 'package' ? '+' : '';
            const abs = Math.abs(amt);
            const fmt = global.HublySmartQuote ? HublySmartQuote.formatMoney(abs) : '$' + abs.toFixed(2);
            return `<div class="bk-sum-line"><span>${esc(l.label)}</span><strong>${sign}${fmt}</strong></div>`;
          })
          .join('')
      : picks
          .slice(0, 6)
          .map((p) => `<div class="bk-sum-line"><span>${esc(p)}</span><em></em></div>`)
          .join('') ||
        `<div class="bk-sum-line"><span>${esc(svcName)}</span><em>Selected</em></div>`;
    const includeHtml = includes.length
      ? `<ul class="bk-sum-includes">${includes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
      : '';
    const lockBox = showPrice
      ? `<div class="bk-sum-total"><span>Total</span><b>${esc(money.formatted || '')}</b></div>`
      : '';
    const helpRaw = w.helpBlurb || "Have questions? We're here to help!";
    const phoneRaw = String(app.phone || '');
    const helpLink = phoneRaw
      ? `<a href="tel:${phoneRaw.replace(/[^\d+]/g, '')}">Message us ›</a>`
      : `<a href="#bk-step-3" onclick="try{goToStep(Number(S.bkStep)||1,3)}catch(e){};return false;">Message us ›</a>`;
    const reviews = Array.isArray(app.reviews) ? app.reviews : [];
    const rating =
      reviews.length > 0
        ? (
            reviews.reduce((n, r) => n + (Number(r.rating) || 5), 0) / reviews.length
          ).toFixed(1)
        : '4.9';
    const reviewCount = reviews.length > 0 ? reviews.length : 248;
    return `<div class="bk-mock-side" style="--bk-ui-accent:${accent}">
      <div class="bk-sum-card">
        <div class="bk-sum-head"><strong>📅 Booking summary</strong><div class="bk-sum-dots">${dots}</div></div>
        <div class="bk-sum-body">
          <div class="bk-sum-svc">
            ${img ? `<img src="${esc(img)}" alt="">` : `<div style="width:56px;height:44px;border-radius:10px;background:#e2e8f0;"></div>`}
            <div><strong>${esc(svcName)}</strong><span>${esc(svcObj.desc || picks.slice(1, 2).join(' · ') || '')}</span></div>
            ${
              showPrice
                ? `<button type="button" class="bk-sum-edit" onclick="try{goToStep(4,1)}catch(e){}">Edit</button>`
                : ''
            }
          </div>
          <div class="bk-sum-lines">${lines}</div>
          ${includeHtml}
          ${lockBox}
        </div>
      </div>
      <div class="bk-help-card">
        <img class="bk-help-ava" src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=120&q=80" alt="">
        <div><strong>${esc(helpRaw)}</strong>${helpLink}</div>
      </div>
      <div class="bk-reviews-card">
        <div class="stars">★★★★★</div>
        <strong>${esc(rating)}</strong> · ${esc(String(reviewCount))} reviews<br>
        Trusted by customers who book online.
      </div>
    </div>`;
  }

  function renderServicePicker() {
    const app = appState() || {};
    const w = wizardCfg();
    let svcs = [];
    if (w && Array.isArray(w.services) && w.services.length) {
      svcs = w.services;
    } else {
      svcs = (app.editorSvcs || app.services || []).filter((s) => s && s.name);
    }
    if (!svcs.length) return '';
    const prompt =
      (w && w.servicePrompt) ||
      'What service would you like?';
    const current = app.bkService || '';
    const cards = svcs
      .map((s) => {
        const name = s.name || 'Service';
        const sel = name === current ? ' sel' : '';
        const img =
          s.image || s.imgUrl || (Array.isArray(s.photos) && s.photos[0]) || '';
        const popular = s.popular ? '<em>Most popular</em>' : '';
        const priceNum = Number(s.price);
        const price =
          Number.isFinite(priceNum) && priceNum > 0
            ? `$${Math.round(priceNum)}`
            : '';
        const durRaw = String(s.dur || '').trim();
        const dur = durRaw
          ? `${durRaw}${/hr|hour|min/i.test(durRaw) ? '' : ' hrs'}`
          : '';
        const meta =
          price || dur
            ? `<div class="bk-svc-meta">${price ? `<b>${esc(price)}</b>` : ''}${
                price && dur ? ' · ' : ''
              }${dur ? `<span class="bk-svc-dur">⏱ ${esc(dur)}</span>` : ''}</div>`
            : '';
        return `<button type="button" class="bk-svc-card${sel}" onclick="HublyBookingSQ.pickService(${JSON.stringify(
          name
        )})">
          <span class="bk-sel-check" aria-hidden="true">✓</span>
          ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<div class="bk-svc-ph" style="aspect-ratio:4/3;background:#e2e8f0;"></div>'}
          <strong>${esc(name)}</strong>
          ${meta}
          <span>${esc(s.desc || '')}</span>
          ${popular}
        </button>`;
      })
      .join('');
    return `<div class="sq-field"><div class="sq-lbl">${esc(prompt)}</div><div class="bk-svc-pick">${cards}</div></div>`;
  }

  function pickService(name) {
    if (typeof global.openBookingPage === 'function') {
      global.openBookingPage(name, { forceNoPromo: true });
      return;
    }
    const app = appState();
    if (!app) return;
    app.bkService = name;
    renderIntake();
    updateEstimate();
  }

  function applyShellChrome() {
    if (typeof document === 'undefined') return;
    const shell = document.getElementById('p-booking');
    const cfg = getCfg();
    const w = wizardCfg();
    if (shell) {
      shell.classList.add('bk-sq-mode');
      shell.classList.toggle('bk-price-open', priceUnlocked());
    }
    let accent = (cfg && cfg.accent) || '#0f766e';
    try {
      if (typeof getAccentColor === 'function') {
        const a = getAccentColor();
        if (a) accent = a;
      } else {
        const app = appState() || {};
        if (app.siteAccent || app.brandColor || app.color) {
          accent = app.siteAccent || app.brandColor || app.color;
        }
      }
    } catch (e) {}
    document.documentElement.style.setProperty('--sq-accent', accent);
    document.documentElement.style.setProperty('--bk-ui-accent', accent);
    const titleTxt = document.getElementById('bk-step-1-title-txt') || document.getElementById('bk-step-1-title');
    const sub = document.getElementById('bk-step-1-sub');
    const tag = document.getElementById('bk-biz-tag');
    const trustRow = document.getElementById('bk-trust-row');
    const headline =
      (w && w.headline) ||
      (global.HublySmartQuote && HublySmartQuote.bookingHeadline
        ? HublySmartQuote.bookingHeadline(cfg && cfg.trade)
        : null) ||
      null;
    const subjectStep =
      (cfg && cfg.steps && cfg.steps.find((s) => s && s.id === 'subject')) || null;
    const titleText =
      (typeof headline === 'string' ? headline : headline && headline.title) ||
      (subjectStep && subjectStep.title) ||
      'Details';
    if (titleTxt) titleTxt.textContent = titleText;
    if (sub)
      sub.textContent =
        (w && w.blurb) ||
        (typeof headline === 'object' && headline && headline.blurb) ||
        (subjectStep && subjectStep.blurb) ||
        'Choose the service that best fits your needs.';
    if (tag) {
      const trust0 = (w && w.trustLines && w.trustLines[0]) || '';
      const tagline = trust0 || (appState() || {}).tag || '';
      tag.textContent = tagline;
      tag.classList.toggle('is-trust', /guarantee|insured|secure/i.test(tagline));
    }
    if (trustRow) {
      trustRow.style.display = 'none';
      trustRow.innerHTML = '';
    }
    const reviewTrust = document.getElementById('bk-review-trust');
    if (reviewTrust && w && w.reviewTrust) {
      reviewTrust.innerHTML = `<strong>Peace of mind</strong> ${esc(w.reviewTrust)}`;
    }
    document.getElementById('bk-vehicle-block')?.classList.add('hidden');
    document.getElementById('bk-blueprint-intake')?.classList.add('hidden');
    document.getElementById('bk-sq-intake')?.classList.remove('hidden');
    document.querySelectorAll('#p-booking .bk-step-foot .bk-trust').forEach((el) => el.remove());
    const labels = document.getElementById('bk-prog-labels');
    if (labels) {
      const step = currentBkStep();
      const steps = [
        { t: 'Details', h: 'Choose your service' },
        { t: 'When & where', h: 'Pick date & location' },
        { t: 'Your info', h: 'Tell us about you' },
        { t: 'Review', h: 'Confirm & book' },
      ];
      labels.innerHTML = steps
        .map((s, i) => {
          const n = i + 1;
          const on = n === step ? ' on' : n < step ? ' done' : '';
          const mark = n < step ? '✓' : String(n);
          return `<span class="bk-sq-prog-pill${on}" data-bk-step="${n}"><span>${mark}</span>${esc(s.t)}<em class="bk-step-hint">${esc(s.h)}</em></span>`;
        })
        .join('');
    }
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
    const svcPicker = renderServicePicker();
    // When owner packages already drive pick, skip duplicate shoot-type tiles
    const filtered = svcPicker
      ? fields.filter((f) => f && f.id !== 'sessionType')
      : fields;
    const parts = SQ.partitionFields(filtered);
    let html = svcPicker;
    html +=
      parts.primary.map(renderField).join('') ||
      (html
        ? ''
        : '<p class="bk-step-sub" style="margin:0;">No extra details for this service — continue to pick a time.</p>');
    if (parts.secondary.length) {
      html += `<details class="sq-more"${moreOpen ? ' open' : ''}><summary>More details <span>(optional)</span></summary>${parts.secondary
        .map(renderField)
        .join('')}</details>`;
    }
    root.innerHTML = html;
  }

  function currentBkStep() {
    try {
      const app = appState();
      const n = Number(app && app.bkStep);
      if (Number.isFinite(n) && n >= 1) return n;
    } catch (e) {}
    return 1;
  }

  function priceUnlocked() {
    return currentBkStep() >= 4;
  }

  function initForBooking() {
    if (!global.HublySmartQuote) return false;
    const app = appState();
    if (!app) return false;
    app._bkSq = null;
    app.bkStep = 1;
    ensureBkSq();
    applyShellChrome();
    renderIntake();
    updateEstimate();
    return true;
  }

  function refreshProgressLabels(step) {
    if (typeof document === 'undefined') return;
    const n = Number(step) || currentBkStep();
    try {
      const app = appState();
      if (app) app.bkStep = n;
    } catch (e) {}
    const labels = document.getElementById('bk-prog-labels');
    if (labels && !labels.querySelector('[data-bk-step]')) {
      applyShellChrome();
    }
    document.querySelectorAll('#bk-prog-labels [data-bk-step]').forEach((el) => {
      const i = Number(el.getAttribute('data-bk-step'));
      el.classList.toggle('on', i === n);
      el.classList.toggle('done', i < n);
      const badge = el.querySelector('span');
      if (badge) badge.textContent = i < n ? '✓' : String(i);
    });
    updateEstimate();
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
    applyShellChrome,
    getCfg,
    priceUnlocked,
    pickService,
  };
})(typeof window !== 'undefined' ? window : global);
