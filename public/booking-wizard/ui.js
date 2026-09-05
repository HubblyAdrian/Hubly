/**
 * Owner Booking Wizard — edit industry frame like the website editor.
 */
(function (global) {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function appState() {
    if (global.S) return global.S;
    try {
      if (typeof S !== 'undefined' && S) return S;
    } catch (e) {}
    return null;
  }

  function ensureWizard() {
    const app = appState();
    if (!app) return null;
    const Frames = global.HublyBookingFrames;
    const wanted =
      Frames && typeof Frames.recipeId === 'function'
        ? Frames.recipeId(app.businessType)
        : String(app.businessType || '')
            .toLowerCase()
            .trim();

    const needsReseed =
      !app.bookingWizard ||
      !app.bookingWizard.frameId ||
      (wanted && app.bookingWizard.frameId && app.bookingWizard.frameId !== wanted);

    if (needsReseed && Frames) {
      const keepServices = app.bookingWizard && app.bookingWizard.frameId === wanted;
      app.bookingWizard = Frames.seedWizard({
        businessType: app.businessType,
        services: app.editorSvcs || app.services,
        addons: app.editorAddons,
        existing: keepServices ? app.bookingWizard : null,
      });
    } else if (!app.bookingWizard || !app.bookingWizard.frameId) {
      app.bookingWizard = {
        frameId: wanted || 'custom',
        headline: '',
        blurb: '',
        servicePrompt: '',
        trustLines: [],
        sidebarIncludes: [],
        benefitOptions: [],
        ownerTips: [],
        ctaLabel: 'Book now',
        packagesTitle: 'Packages',
        services: [],
        addons: [],
        done: false,
      };
    } else if (!app.bookingWizard.services || !app.bookingWizard.services.length) {
      const src = (app.editorSvcs || app.services || []).filter((s) => s && s.name);
      if (src.length) {
        app.bookingWizard.services = src.map((s, i) => ({
          id: s.id || 'svc-' + i,
          name: s.name,
          desc: s.desc || '',
          price: Number(s.price) || 0,
          dur: s.dur || '1',
          image: s.imgUrl || s.image || (Array.isArray(s.photos) && s.photos[0]) || '',
          popular: !!s.popular,
        }));
      }
    }

    const w = app.bookingWizard;
    // Fill industry chrome from the live frame when missing (older drafts).
    if (Frames && typeof Frames.get === 'function') {
      const frame = Frames.get(app.businessType);
      if (frame) {
        if (!w.benefitOptions || !w.benefitOptions.length) {
          w.benefitOptions = (frame.benefitOptions || frame.sidebarIncludes || []).slice();
        }
        if (!w.ownerTips || !w.ownerTips.length) {
          w.ownerTips = (frame.ownerTips || []).slice();
        }
        if (!w.ctaLabel) w.ctaLabel = frame.ctaLabel || '';
        if (!w.packagesTitle) w.packagesTitle = frame.packagesTitle || '';
        // trustLines and sidebarIncludes are deliberately NOT filled from the
        // frame here — same reason as registry.js frameDefaults(). What a
        // business tells a customer in the booking summary is the owner's to
        // choose from benefitOptions, not ours to pre-write into their record.
        // See OPEN_FINDINGS #25.
        if (!w.whereOptions || !w.whereOptions.length) {
          w.whereOptions = (frame.whereOptions || []).map((x) => Object.assign({}, x));
        }
        if (!w.headline && frame.headline) w.headline = frame.headline;
        if (!w.blurb && frame.blurb) w.blurb = frame.blurb;
        if (!w.servicePrompt && frame.servicePrompt) w.servicePrompt = frame.servicePrompt;
      }
    }

    if (!Array.isArray(w.sidebarIncludes)) w.sidebarIncludes = [];
    if (!Array.isArray(w.benefitOptions)) w.benefitOptions = w.sidebarIncludes.slice();
    if (!Array.isArray(w.trustLines)) w.trustLines = [];
    if (!Array.isArray(w.ownerTips)) w.ownerTips = [];
    if (!Array.isArray(w.addons)) w.addons = [];
    if (!Array.isArray(w.whereOptions)) w.whereOptions = [];

    // Seed add-ons from this trade's blueprint — never a shared generic list.
    if (!w.addons.length) {
      let tradeAddons = [];
      try {
        if (typeof global.getTradeDefaultAddons === 'function') {
          tradeAddons = global.getTradeDefaultAddons() || [];
        } else if (global.HublyBlueprints && typeof HublyBlueprints.defaultAddons === 'function') {
          tradeAddons = HublyBlueprints.defaultAddons(app.businessType, app.businessSpecialty) || [];
        }
      } catch (e) {}
      if (!tradeAddons.length && Array.isArray(app.editorAddons) && app.editorAddons.length) {
        tradeAddons = app.editorAddons;
      }
      w.addons = (tradeAddons || [])
        .filter((a) => a && a.name)
        .map((a, i) => ({
          id: a.id || 'addon-' + i,
          name: a.name,
          price: Number(a.price) || 0,
          enabled: true,
        }));
    }

    w.addons.forEach((a) => {
      if (a && a.enabled == null) a.enabled = true;
    });
    if (w.defaultWhereId == null && w.whereOptions[0]) w.defaultWhereId = w.whereOptions[0].id;
    if (!w.ctaLabel) w.ctaLabel = 'Book now';
    return w;
  }

  function persistLocal() {
    const app = appState();
    if (!app || !app.bookingWizard) return;
    try {
      const key = 'hubly_booking_wizard_' + (app.slug || 'draft');
      localStorage.setItem(key, JSON.stringify(app.bookingWizard));
    } catch (e) {}
  }

  function syncServicesOut() {
    const app = appState();
    const w = ensureWizard();
    if (!app || !w) return;
    // Packages remain source of truth in editorSvcs — only sync addons back.
    app.editorAddons = (w.addons || [])
      .filter((a) => a && a.enabled !== false)
      .map((a) => ({ name: a.name, price: a.price }));
  }

  function setCopy(key, value) {
    const w = ensureWizard();
    if (!w) return;
    w[key] = value;
    persistLocal();
    renderPreview();
  }

  function toggleBenefit(label) {
    const w = ensureWizard();
    if (!w) return;
    const list = w.sidebarIncludes || (w.sidebarIncludes = []);
    const i = list.indexOf(label);
    if (i >= 0) list.splice(i, 1);
    else list.push(label);
    persistLocal();
    renderEditor();
    renderPreview();
  }

  function updateTrustLine(i, value) {
    const w = ensureWizard();
    if (!w || !w.trustLines) return;
    w.trustLines[i] = value;
    persistLocal();
    renderPreview();
  }

  function addTrustLine() {
    const w = ensureWizard();
    if (!w) return;
    w.trustLines = w.trustLines || [];
    const frameHint =
      (w.benefitOptions && w.benefitOptions[0]) ||
      (w.sidebarIncludes && w.sidebarIncludes[0]) ||
      'Trusted local service';
    w.trustLines.push(frameHint);
    persistLocal();
    renderEditor();
    renderPreview();
  }

  function removeTrustLine(i) {
    const w = ensureWizard();
    if (!w) return;
    w.trustLines.splice(i, 1);
    persistLocal();
    renderEditor();
    renderPreview();
  }

  function setSiteRating(value) {
    const app = appState();
    if (!app) return;
    app.website = app.website || {};
    const n = Number(value);
    const rating = Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n * 10) / 10)) : 4.9;
    app.website.rating = rating;
    app.rating = rating;
    persistLocal();
    try {
      if (typeof markDirty === 'function') markDirty();
    } catch (e) {}
    renderPreview();
    try {
      if (typeof HublyBookingSQ !== 'undefined' && HublyBookingSQ.renderEstimate) HublyBookingSQ.renderEstimate();
    } catch (e) {}
  }

  function setSiteReviewCount(value) {
    const app = appState();
    if (!app) return;
    app.website = app.website || {};
    const n = Math.max(0, Math.floor(Number(value) || 0));
    app.website.reviewCount = n;
    app.reviewCount = n;
    persistLocal();
    try {
      if (typeof markDirty === 'function') markDirty();
    } catch (e) {}
    renderPreview();
    try {
      if (typeof HublyBookingSQ !== 'undefined' && HublyBookingSQ.renderEstimate) HublyBookingSQ.renderEstimate();
    } catch (e) {}
  }

  function updateService(i, key, value) {
    const w = ensureWizard();
    if (!w || !w.services[i]) return;
    if (key === 'price') w.services[i].price = Number(value) || 0;
    else if (key === 'popular') w.services[i].popular = !!value;
    else w.services[i][key] = value;
    persistLocal();
    renderPreview();
  }

  function addService() {
    openWebsiteEditorForServices();
  }

  function removeService() {
    openWebsiteEditorForServices();
  }

  function updateAddon(i, key, value) {
    const w = ensureWizard();
    if (!w || !w.addons[i]) return;
    if (key === 'price') w.addons[i].price = Number(value) || 0;
    else if (key === 'enabled') w.addons[i].enabled = !!value;
    else w.addons[i][key] = value;
    syncServicesOut();
    persistLocal();
    if (key === 'enabled' || key === 'name' || key === 'price') {
      try {
        if (typeof renderBkAddonGrid === 'function') renderBkAddonGrid();
      } catch (e) {}
    }
    if (key === 'enabled') renderEditor();
    renderPreview();
  }

  function addAddon() {
    const w = ensureWizard();
    if (!w) return;
    w.addons = w.addons || [];
    w.addons.push({ id: 'addon-' + Date.now(), name: 'New add-on', price: 25, enabled: true });
    syncServicesOut();
    persistLocal();
    renderEditor();
    renderPreview();
  }

  function removeAddon(i) {
    const w = ensureWizard();
    if (!w) return;
    w.addons.splice(i, 1);
    syncServicesOut();
    persistLocal();
    renderEditor();
    renderPreview();
  }

  function updateWhere(i, key, value) {
    const w = ensureWizard();
    if (!w || !w.whereOptions[i]) return;
    w.whereOptions[i][key] = value;
    persistLocal();
    renderPreview();
  }

  function setDefaultWhere(id) {
    const w = ensureWizard();
    if (!w) return;
    w.defaultWhereId = id;
    persistLocal();
    renderEditor();
    renderPreview();
  }

  function previewLiveBooking() {
    const w = ensureWizard();
    syncServicesOut();
    persistLocal();
    const name = (w && w.services && w.services[0] && w.services[0].name) || null;
    try {
      if (typeof setOwnerPreview === 'function') setOwnerPreview(true);
    } catch (e) {}
    if (typeof openBookingPage === 'function') {
      openBookingPage(name);
      return;
    }
    if (typeof toast === 'function') toast('Couldn’t open Book Now preview');
  }

  function openWebsiteEditorForServices() {
    try {
      if (typeof openWebsiteEditorHub === 'function') {
        openWebsiteEditorHub('packages');
        return;
      }
      if (typeof showP === 'function') showP('p-app', { replaceRoute: true });
      const nav = document.querySelector('[data-v="editor"]');
      if (nav && typeof switchV === 'function') switchV(nav);
    } catch (e) {
      if (typeof toast === 'function') toast('Open Website editor → Packages');
    }
  }

  function editorRoot() {
    const ed = document.getElementById('ed-bw-editor');
    if (ed && ed.closest('.ed-hub-panel')?.classList.contains('on')) return ed;
    return document.getElementById('bw-editor') || ed;
  }

  function previewRoot() {
    const ed = document.getElementById('ed-bw-preview');
    if (ed && ed.closest('.ed-hub-panel')?.classList.contains('on')) return ed;
    return document.getElementById('bw-preview') || ed;
  }

  function draftBannerRoot() {
    const ed = document.getElementById('ed-bw-draft-banner');
    if (ed && document.getElementById('ed-hub-book')?.classList.contains('on')) return ed;
    return document.getElementById('bw-draft-banner') || ed;
  }

  function navRoot() {
    return document.getElementById('ed-bw-nav');
  }

  function activeSection() {
    const app = appState();
    return (app && app._bwHubSec) || 'headline';
  }

  function setSection(id) {
    const app = appState();
    if (app) app._bwHubSec = id;
    renderNav();
    renderEditor();
    renderPreview();
    const target = document.getElementById('bw-sec-' + id);
    if (target) {
      setTimeout(() => {
        try {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) {}
      }, 40);
    }
  }

  function renderNav() {
    const nav = navRoot();
    const w = ensureWizard();
    if (!nav || !w) return;
    const sec = activeSection();
    const addonN = (w.addons || []).filter((a) => a && a.enabled !== false).length;
    const items = [
      { id: 'headline', label: 'Headline & Intro', icon: '✎' },
      { id: 'packages', label: 'Packages', icon: '▦' },
      { id: 'addons', label: 'Add-ons', icon: '+', badge: addonN || null },
      { id: 'where', label: 'Where Options', icon: '⌖' },
      { id: 'trust', label: 'Trust & Info', icon: '✓' },
      { id: 'settings', label: 'Settings', icon: '⚙' },
    ];
    nav.innerHTML = items
      .map(
        (it) => `<button type="button" class="${sec === it.id ? 'on' : ''}" onclick="HublyBookingWizardUI.setSection('${it.id}')">
        <span aria-hidden="true">${it.icon}</span>
        <span>${esc(it.label)}</span>
        ${it.badge != null ? `<span class="badge">${esc(String(it.badge))}</span>` : ''}
      </button>`
      )
      .join('');
  }

  function syncServicesFromEditor() {
    const w = ensureWizard();
    const app = appState();
    if (!w || !app) return;
    const src = (app.editorSvcs || app.services || []).filter((s) => s && s.name);
    if (src.length) {
      w.services = src.map((s, i) => ({
        id: s.id || 'svc-' + i,
        name: s.name,
        desc: s.desc || '',
        price: Number(s.price) || 0,
        dur: s.dur || '',
        image: s.imgUrl || s.image || (Array.isArray(s.photos) && s.photos[0]) || '',
        popular: !!s.popular,
      }));
    }
  }

  function renderEditor() {
    const root = editorRoot();
    const w = ensureWizard();
    if (!root || !w) return;
    syncServicesFromEditor();
    renderNav();

    const benefitPresets = (w.benefitOptions && w.benefitOptions.length
      ? w.benefitOptions
      : w.sidebarIncludes || []
    ).slice();
    const activeBenefits = w.sidebarIncludes || [];
    const benefitHtml = benefitPresets
      .map((b) => {
        const on = activeBenefits.includes(b);
        return `<button type="button" class="bw-benefit-chip ${on ? 'on' : ''}" data-benefit="${esc(b)}" onclick="HublyBookingWizardUI.toggleBenefit(this.getAttribute('data-benefit'))">${esc(b)}</button>`;
      })
      .join('') || '<p class="bw-muted">No benefit tags for this industry yet.</p>';

    const svcHtml = (w.services || [])
      .map((s) => {
        const price = Number(s.price);
        const priceTxt = Number.isFinite(price) && price > 0 ? `$${Math.round(price)}` : '—';
        const dur = s.dur ? `+ ${esc(String(s.dur))} hrs` : '';
        return `<div class="bw-pkg-ro">
          <div class="thumb">${s.image ? `<img src="${esc(s.image)}" alt="">` : ''}</div>
          <div>
            <strong>${esc(s.name)}</strong>
            ${s.desc ? `<em>${esc(s.desc)}</em>` : ''}
          </div>
          <span>${esc(priceTxt)}${dur ? `<br><small style="color:var(--ink-3);font-weight:600">${dur}</small>` : ''}${s.popular ? '<br><small style="color:var(--brand);font-weight:800">Popular</small>' : ''}</span>
        </div>`;
      })
      .join('');

    const addonHtml = (w.addons || [])
      .map((a, i) => {
        const on = a.enabled !== false;
        return `<div class="bw-addon-card ${on ? '' : 'is-off'}">
          <div class="bw-addon-card-main">
            <div class="bw-addon-fields">
              <label>Name<input class="bw-input" value="${esc(a.name)}" oninput="HublyBookingWizardUI.updateAddon(${i},'name',this.value)" placeholder="e.g. Edging upgrade"></label>
              <label>Price $<input class="bw-input bw-price" type="number" min="0" step="1" value="${esc(a.price)}" oninput="HublyBookingWizardUI.updateAddon(${i},'price',this.value)" placeholder="15"></label>
            </div>
            <div class="bw-addon-card-actions">
              <label class="tog" title="Show to customers"><input type="checkbox" ${on ? 'checked' : ''} onchange="HublyBookingWizardUI.updateAddon(${i},'enabled',this.checked)"><span class="tog-sl"></span></label>
              <button type="button" class="btn btn-out btn-sm" onclick="HublyBookingWizardUI.removeAddon(${i})" aria-label="Remove add-on">×</button>
            </div>
          </div>
          <p class="bw-addon-card-foot">${on ? 'Shown on Book Now' : 'Hidden from customers'}</p>
        </div>`;
      })
      .join('');

    const whereHtml = (w.whereOptions || [])
      .map((o, i) => {
        const on = (w.defaultWhereId || (w.whereOptions[0] && w.whereOptions[0].id)) === o.id;
        return `<button type="button" class="${on ? 'on' : ''}" onclick="HublyBookingWizardUI.setDefaultWhere('${esc(o.id)}')">
          <strong>${esc(o.label)}${on ? ' · Default' : ''}</strong>
          <span>${esc(o.desc || '')}</span>
        </button>`;
      })
      .join('');

    const trustHtml = (w.trustLines || [])
      .map(
        (line, i) => `<div class="bw-trust-edit">
        <span class="chk">✓</span>
        <input class="bw-input" style="margin:0;flex:1" value="${esc(line)}" oninput="HublyBookingWizardUI.updateTrustLine(${i},this.value)">
        <button type="button" class="btn btn-out btn-sm" onclick="HublyBookingWizardUI.removeTrustLine(${i})">×</button>
      </div>`
      )
      .join('');

    const sec = activeSection();
    root.innerHTML = `
      <section class="bw-sec ${sec === 'headline' ? 'is-focus' : ''}" id="bw-sec-headline">
        <h3>Headline &amp; Introduction</h3>
        <label class="bw-field-lbl">Headline</label>
        <input class="bw-input" value="${esc(w.headline)}" oninput="HublyBookingWizardUI.setCopy('headline',this.value)" maxlength="80">
        <label class="bw-field-lbl">Subheadline</label>
        <input class="bw-input" value="${esc(w.blurb)}" oninput="HublyBookingWizardUI.setCopy('blurb',this.value)" maxlength="140">
        <label class="bw-field-lbl">Benefit tags <span>Tap to show or hide on Book Now</span></label>
        <div class="bw-benefit-row">${benefitHtml}</div>
        <label class="bw-field-lbl" style="margin-top:10px">Service prompt</label>
        <input class="bw-input" value="${esc(w.servicePrompt || '')}" oninput="HublyBookingWizardUI.setCopy('servicePrompt',this.value)" placeholder="What service do you need?">
      </section>
      <section class="bw-sec ${sec === 'packages' ? 'is-focus' : ''}" id="bw-sec-packages">
        <div class="bw-sec-h"><h3>Packages</h3>
          <button type="button" class="btn btn-brand btn-sm" onclick="HublyBookingWizardUI.openWebsiteEditorForServices()">Manage packages</button></div>
        <p class="bw-muted" style="margin:0 0 10px;">Edited under Packages so your site, Book Now, and Smart Quote stay in sync.</p>
        ${svcHtml || '<p class="bw-muted">No packages yet — add them under Packages.</p>'}
        <button type="button" class="btn btn-out btn-sm" onclick="HublyBookingWizardUI.openWebsiteEditorForServices()">+ Add or reorder packages</button>
      </section>
      <section class="bw-sec ${sec === 'addons' ? 'is-focus' : ''}" id="bw-sec-addons">
        <div class="bw-sec-h"><h3>Add-ons</h3>
          <button type="button" class="btn btn-brand btn-sm" onclick="HublyBookingWizardUI.addAddon()">+ Add add-on</button></div>
        <p class="bw-muted" style="margin:0 0 12px;">Optional extras customers can tap after they pick a package — same cards they see on Book Now.</p>
        <div class="bw-addon-list">${addonHtml || '<div class="bw-empty-card"><strong>No add-ons yet</strong><span>Add something like Edging upgrade or Fertilizer boost.</span></div>'}</div>
      </section>
      <section class="bw-sec ${sec === 'where' ? 'is-focus' : ''}" id="bw-sec-where">
        <div class="bw-sec-h"><h3>Where options</h3></div>
        <p class="bw-muted" style="margin:0 0 10px;">Pick the default location type for step 2.</p>
        <div class="bw-where-pick">${whereHtml || '<p class="bw-muted">Location types for step 2.</p>'}</div>
        <label class="bw-field-lbl">Studio / service address</label>
        <input class="bw-input" value="${esc(w.studioAddress || '')}" oninput="HublyBookingWizardUI.setCopy('studioAddress',this.value)" placeholder="123 Studio Lane, City, ST">
        <label class="bw-field-lbl">Where-step note <span>optional</span></label>
        <input class="bw-input" value="${esc(w.whereNote || '')}" oninput="HublyBookingWizardUI.setCopy('whereNote',this.value)" placeholder="e.g. We’ll confirm the exact address before arrival">
      </section>
      <section class="bw-sec ${sec === 'trust' ? 'is-focus' : ''}" id="bw-sec-trust">
        <h3>Trust &amp; review copy</h3>
        ${trustHtml || '<p class="bw-muted">Add trust lines customers see on review.</p>'}
        <button type="button" class="btn btn-out btn-sm" onclick="HublyBookingWizardUI.addTrustLine()">+ Add trust line</button>
        <div class="bw-rating-row" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0 0;">
          <div>
            <label class="bw-field-lbl">Star rating</label>
            <input class="bw-input" type="number" min="1" max="5" step="0.1" value="${esc(String((appState()?.website?.rating ?? appState()?.rating ?? 4.9)))}" oninput="HublyBookingWizardUI.setSiteRating(this.value)" placeholder="4.9">
          </div>
          <div>
            <label class="bw-field-lbl">Review count</label>
            <input class="bw-input" type="number" min="0" step="1" value="${esc(String((appState()?.website?.reviewCount ?? appState()?.reviewCount ?? 0)))}" oninput="HublyBookingWizardUI.setSiteReviewCount(this.value)" placeholder="248">
          </div>
        </div>
        <p class="bw-muted" style="margin:6px 0 0;">Shown on Book Now next to the stars. Leave count at 0 to hide the reviews card until you have real ones.</p>
        <label class="bw-field-lbl" style="margin-top:10px">Help blurb</label>
        <input class="bw-input" value="${esc(w.helpBlurb || '')}" oninput="HublyBookingWizardUI.setCopy('helpBlurb',this.value)" placeholder="Help blurb">
        <label class="bw-field-lbl">Review trust line</label>
        <input class="bw-input" value="${esc(w.reviewTrust || '')}" oninput="HublyBookingWizardUI.setCopy('reviewTrust',this.value)" placeholder="Review trust line">
        <label class="bw-field-lbl">Cancel / reschedule</label>
        <textarea class="bw-input" rows="2" oninput="HublyBookingWizardUI.setCopy('cancelBlurb',this.value)" placeholder="Cancel / reschedule blurb">${esc(w.cancelBlurb || '')}</textarea>
      </section>
      <section class="bw-sec bw-suggest ${sec === 'settings' ? 'is-focus' : ''}" id="bw-sec-settings">
        <h3>Settings</h3>
        <p class="bw-muted">Packages live under the Packages tab. Suggest a different industry if this frame doesn’t fit.</p>
        <button type="button" class="btn btn-out" onclick="openSuggestIndustryModal()">Suggest my industry →</button>
      </section>`;
    renderTips(w);
  }

  function enabledQuestionLabels() {
    try {
      const SQ = global.HublySmartQuote;
      const app = appState() || {};
      if (!SQ || typeof SQ.resolveConfig !== 'function') return [];
      let bp = null;
      try {
        if (typeof global.getActiveBlueprint === 'function') bp = global.getActiveBlueprint();
      } catch (e) {}
      const cfg = SQ.resolveConfig({
        businessType: app.businessType || (bp && bp.id) || 'detailing',
        blueprint: bp,
        ownerConfig: app.quoteConfig,
        packagesFirst: false,
      });
      if (!cfg || !cfg.fields) return [];
      const disabled = new Set((app.quoteConfig && app.quoteConfig.disabledFields) || []);
      return Object.keys(cfg.fields)
        .map((id) => {
          const f = cfg.fields[id] || {};
          if (disabled.has(id) || f.disabled) return null;
          return f.label || id;
        })
        .filter(Boolean)
        .slice(0, 4);
    } catch (e) {
      return [];
    }
  }

  function renderPreview() {
    const root = previewRoot();
    const w = ensureWizard();
    const app = appState() || {};
    if (!root || !w) return;
    syncServicesFromEditor();
    let accent = app.siteAccent || app.brandColor || app.color || '#D9632D';
    try {
      if (typeof getAccentColor === 'function') {
        const a = getAccentColor();
        if (a) accent = a;
      }
    } catch (e) {}

    const sec = activeSection();
    const pkgRows = (w.services || [])
      .slice(0, 5)
      .map((s, i) => {
        const priceNum = Number(s.price);
        const price =
          Number.isFinite(priceNum) && priceNum > 0 ? `$${Math.round(priceNum)}` : '';
        const dur = String(s.dur || '').trim();
        return `<div class="bw-prev-card ${s.popular ? 'pop' : ''} ${i === 0 ? 'is-sel' : ''}">
          <div class="bw-prev-media">${s.image ? `<img src="${esc(s.image)}" alt="">` : '<span class="bw-prev-ph" aria-hidden="true">▦</span>'}</div>
          <div class="bw-prev-meta">
            <strong>${esc(s.name)}</strong>
            <span>${price ? esc(price) : ''}${price && dur ? ' · ' : ''}${dur ? esc(dur) + ' hrs' : ''}</span>
          </div>
        </div>`;
      })
      .join('');

    const enabledAddons = (w.addons || []).filter((a) => a && a.enabled !== false);
    const addonRows = enabledAddons
      .map(
        (a) =>
          `<div class="bw-prev-addon">
            <span class="bw-prev-check" aria-hidden="true"></span>
            <div class="bw-prev-addon-copy"><strong>${esc(a.name)}</strong></div>
            <em>+$${Math.round(Number(a.price) || 0)}</em>
          </div>`
      )
      .join('');

    const whereRows = (w.whereOptions || [])
      .map((o) => {
        const on = (w.defaultWhereId || (w.whereOptions[0] && w.whereOptions[0].id)) === o.id;
        return `<div class="bw-prev-where ${on ? 'on' : ''}">
          <span class="bw-prev-radio" aria-hidden="true"></span>
          <strong>${esc(o.label)}</strong>
        </div>`;
      })
      .join('');

    const benefits = (w.sidebarIncludes || [])
      .slice(0, 4)
      .map((x) => `<span class="bw-prev-benefit">${esc(x)}</span>`)
      .join('');

    const asked = enabledQuestionLabels();
    const askedHtml = asked.length
      ? `<div class="bw-prev-block ${sec === 'headline' ? '' : ''}">
          <div class="bw-prev-kicker">Questions</div>
          <ul class="bw-prev-asked">${asked.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>
          <button type="button" class="bw-prev-link" onclick="openWebsiteEditorHub('quote')">Customize questions →</button>
        </div>`
      : `<div class="bw-prev-block">
          <div class="bw-prev-kicker">Questions</div>
          <p class="bw-prev-empty">No booking questions on yet.</p>
          <button type="button" class="bw-prev-link" onclick="openWebsiteEditorHub('quote')">Add questions →</button>
        </div>`;

    root.innerHTML = `
      <div class="bw-prev-label">Live preview</div>
      <div class="bw-prev-phone">
        <div class="bw-prev-shell" style="--bw-accent:${esc(accent)}">
          <div class="bw-prev-brand" style="background:${esc(accent)}">${esc(app.biz || 'Your Business')}</div>
          <div class="bw-prev-body">
            <div class="bw-prev-block ${sec === 'headline' ? 'is-focus' : ''}">
              <h2>${esc(w.headline || 'Book with us')}</h2>
              <p class="bw-prev-blurb">${esc(w.blurb || '')}</p>
              ${benefits ? `<div class="bw-prev-benefits">${benefits}</div>` : ''}
              <div class="bw-prev-prompt">${esc(w.servicePrompt || 'Choose a service')}</div>
            </div>
            <div class="bw-prev-block ${sec === 'packages' ? 'is-focus' : ''}">
              <div class="bw-prev-kicker">${esc(w.packagesTitle || 'Packages')}</div>
              <div class="bw-prev-pkgs">${pkgRows || '<div class="bw-prev-empty">Services appear here</div>'}</div>
            </div>
            <div class="bw-prev-block ${sec === 'addons' ? 'is-focus' : ''}">
              <div class="bw-prev-kicker">Add-ons</div>
              ${addonRows || '<div class="bw-prev-empty">Optional extras show here</div>'}
            </div>
            ${askedHtml}
            ${
              whereRows
                ? `<div class="bw-prev-block ${sec === 'where' ? 'is-focus' : ''}">
              <div class="bw-prev-kicker">Where should we come?</div>
              <div class="bw-prev-wheres">${whereRows}</div>
            </div>`
                : ''
            }
            <button type="button" class="bw-prev-cta" style="background:${esc(accent)}" onclick="HublyBookingWizardUI.previewLiveBooking()">${esc(w.ctaLabel || 'Book now')}</button>
          </div>
        </div>
      </div>`;
    renderTips(w);
  }

  function renderTips(w) {
    const el = document.getElementById('ed-bw-tips');
    if (!el) return;
    const tips = (w && w.ownerTips && w.ownerTips.length
      ? w.ownerTips
      : null);
    if (!tips) {
      el.innerHTML = '';
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    const trade =
      (w && w.packagesTitle) ||
      (appState() && appState().businessType) ||
      'your trade';
    el.innerHTML = `<h4>Tips for ${esc(String(trade))}</h4><ul>${tips
      .map((t) => `<li>${esc(t)}</li>`)
      .join('')}</ul>`;
  }

  function open() {
    const Frames = global.HublyBookingFrames;
    const go = () => {
      ensureWizard();
      if (typeof openWebsiteEditorHub === 'function') {
        openWebsiteEditorHub('book');
        return;
      }
      if (typeof showP === 'function') showP('p-app', { replaceRoute: true });
      const edNav = document.querySelector('[data-v="editor"]');
      if (edNav && typeof switchV === 'function') switchV(edNav);
      renderEditor();
      renderPreview();
      renderDraftBanner();
    };
    if (Frames && !Frames.isReady()) Frames.whenReady(go);
    else go();
  }

  function renderDraftBanner() {
    const el = draftBannerRoot();
    if (!el) return;
    const app = appState() || {};
    const mode = (app._is && app._is.servicesMode) || app.servicesMode || null;
    const draft = !!app._servicesDraft || mode === 'later' || mode === 'draft';
    if (!draft || mode === 'now') {
      el.classList.add('hidden');
      el.innerHTML = '';
      return;
    }
    el.classList.remove('hidden');
    if (mode === 'later') {
      el.innerHTML =
        '<strong>Starter packages on your site</strong>You chose to set services after the website. These are example packages so the page looks real — rename, reprice, or replace them under Packages.';
    } else {
      el.innerHTML =
        '<strong>Hubly drafted these packages</strong>They’re a starting vision for your trade. Keep what you like under Packages.';
    }
  }

  function finish(opts) {
    if (opts && opts.preview) {
      previewLiveBooking();
      return;
    }
    const w = ensureWizard();
    const app = appState();
    if (w) w.done = true;
    if (app) {
      app._bookingWizardDone = true;
      app._servicesDraft = false;
      if (app._is) app._is.servicesMode = app._is.servicesMode || 'now';
      try {
        localStorage.setItem('hubly_booking_wizard_done_' + (app.slug || 'draft'), '1');
      } catch (e) {}
    }
    syncServicesOut();
    persistLocal();
    if (typeof saveStorefront === 'function') {
      try {
        saveStorefront();
      } catch (e) {}
    }
    if (typeof goDash === 'function') goDash();
    if (typeof toast === 'function') toast(opts && opts.skipped ? 'You can finish booking setup anytime' : 'Booking wizard saved');
  }

  function skip() {
    finish({ skipped: true });
  }

  function saveAndStay() {
    syncServicesOut();
    persistLocal();
    if (typeof saveStorefront === 'function') {
      try {
        saveStorefront();
      } catch (e) {}
    }
    if (typeof toast === 'function') toast('Booking setup saved');
    renderEditor();
    renderPreview();
  }

  global.HublyBookingWizardUI = {
    open,
    finish,
    skip,
    saveAndStay,
    previewLiveBooking,
    ensureWizard,
    setCopy,
    toggleBenefit,
    updateTrustLine,
    addTrustLine,
    removeTrustLine,
    setSiteRating,
    setSiteReviewCount,
    updateService,
    addService,
    removeService,
    updateAddon,
    addAddon,
    removeAddon,
    updateWhere,
    setDefaultWhere,
    setSection,
    openWebsiteEditorForServices,
    renderEditor,
    renderPreview,
    renderDraftBanner,
    syncServicesOut,
    persistLocal,
  };
})(typeof window !== 'undefined' ? window : global);
