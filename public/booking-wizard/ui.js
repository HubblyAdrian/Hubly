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
    if (!app.bookingWizard || !app.bookingWizard.frameId) {
      const Frames = global.HublyBookingFrames;
      if (Frames) {
        app.bookingWizard = Frames.seedWizard({
          businessType: app.businessType,
          services: app.editorSvcs || app.services,
          addons: app.editorAddons,
          existing: app.bookingWizard,
        });
      } else {
        app.bookingWizard = app.bookingWizard || { frameId: 'detailing', services: [], addons: [], done: false };
      }
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
    return app.bookingWizard;
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
    app.editorSvcs = (w.services || []).map((s) => ({
      name: s.name,
      desc: s.desc || '',
      price: s.price,
      dur: s.dur || '1',
      imgUrl: s.image || null,
      photos: s.image ? [s.image] : [],
      popular: !!s.popular,
      pricingType: 'flat',
      varPrices: {},
      includes: '',
      showPrice: true,
      _open: false,
    }));
    app.services = app.editorSvcs.map((s) => ({
      name: s.name,
      price: s.price,
      dur: s.dur,
      desc: s.desc,
      imgUrl: s.imgUrl,
    }));
    app.editorAddons = (w.addons || []).map((a) => ({ name: a.name, price: a.price }));
  }

  function setCopy(key, value) {
    const w = ensureWizard();
    if (!w) return;
    w[key] = value;
    persistLocal();
    renderPreview();
  }

  function updateService(i, key, value) {
    const w = ensureWizard();
    if (!w || !w.services[i]) return;
    if (key === 'price') w.services[i].price = Number(value) || 0;
    else if (key === 'popular') w.services[i].popular = !!value;
    else w.services[i][key] = value;
    syncServicesOut();
    persistLocal();
    renderEditor();
    renderPreview();
  }

  function addService() {
    const w = ensureWizard();
    if (!w) return;
    w.services = w.services || [];
    w.services.push({
      id: 'svc-' + Date.now(),
      name: 'New service',
      desc: '',
      price: 99,
      dur: '1',
      image: '',
      popular: false,
    });
    syncServicesOut();
    persistLocal();
    renderEditor();
    renderPreview();
  }

  function removeService(i) {
    const w = ensureWizard();
    if (!w) return;
    w.services.splice(i, 1);
    syncServicesOut();
    persistLocal();
    renderEditor();
    renderPreview();
  }

  function updateAddon(i, key, value) {
    const w = ensureWizard();
    if (!w || !w.addons[i]) return;
    if (key === 'price') w.addons[i].price = Number(value) || 0;
    else w.addons[i][key] = value;
    syncServicesOut();
    persistLocal();
    renderEditor();
  }

  function addAddon() {
    const w = ensureWizard();
    if (!w) return;
    w.addons = w.addons || [];
    w.addons.push({ id: 'addon-' + Date.now(), name: 'New add-on', price: 25 });
    syncServicesOut();
    persistLocal();
    renderEditor();
  }

  function removeAddon(i) {
    const w = ensureWizard();
    if (!w) return;
    w.addons.splice(i, 1);
    syncServicesOut();
    persistLocal();
    renderEditor();
  }

  function updateWhere(i, key, value) {
    const w = ensureWizard();
    if (!w || !w.whereOptions[i]) return;
    w.whereOptions[i][key] = value;
    persistLocal();
    renderPreview();
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
      setTimeout(() => {
        try {
          document.getElementById('ed-services')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) {}
      }, 120);
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

  function renderEditor() {
    const root = editorRoot();
    const w = ensureWizard();
    if (!root || !w) return;
    // Always refresh services from Website editor (single source of truth).
    const app = appState();
    if (app) {
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
    const svcHtml = (w.services || [])
      .map((s) => {
        const price = Number(s.price);
        const priceTxt = Number.isFinite(price) && price > 0 ? `$${Math.round(price)}` : '—';
        const dur = s.dur ? ` · ${esc(String(s.dur))} hrs` : '';
        return `<div class="bw-pkg-ro">
          <strong>${esc(s.name)}</strong>
          <span>${esc(priceTxt)}${dur}</span>
          ${s.desc ? `<em>${esc(s.desc)}</em>` : ''}
        </div>`;
      })
      .join('');
    const addonHtml = (w.addons || [])
      .map(
        (a, i) => `<div class="bw-card-row">
        <input class="bw-input" value="${esc(a.name)}" oninput="HublyBookingWizardUI.updateAddon(${i},'name',this.value)">
        <input class="bw-input bw-price" type="number" value="${esc(a.price)}" oninput="HublyBookingWizardUI.updateAddon(${i},'price',this.value)">
        <button type="button" class="btn btn-out btn-sm" onclick="HublyBookingWizardUI.removeAddon(${i})">Remove</button>
      </div>`
      )
      .join('');
    const whereHtml = (w.whereOptions || [])
      .map(
        (o, i) => `<div class="bw-card">
        <input class="bw-input" value="${esc(o.label)}" oninput="HublyBookingWizardUI.updateWhere(${i},'label',this.value)" placeholder="Location label">
        <input class="bw-input" value="${esc(o.desc)}" oninput="HublyBookingWizardUI.updateWhere(${i},'desc',this.value)" placeholder="Description">
        <input class="bw-input" value="${esc(o.image)}" oninput="HublyBookingWizardUI.updateWhere(${i},'image',this.value)" placeholder="Photo URL">
      </div>`
      )
      .join('');

    root.innerHTML = `
      <section class="bw-sec">
        <h3>1 · Headline</h3>
        <input class="bw-input" value="${esc(w.headline)}" oninput="HublyBookingWizardUI.setCopy('headline',this.value)">
        <input class="bw-input" value="${esc(w.blurb)}" oninput="HublyBookingWizardUI.setCopy('blurb',this.value)">
        <input class="bw-input" value="${esc(w.servicePrompt)}" oninput="HublyBookingWizardUI.setCopy('servicePrompt',this.value)">
      </section>
      <section class="bw-sec">
        <div class="bw-sec-h"><h3>2 · Packages</h3>
          <button type="button" class="btn btn-brand btn-sm" onclick="HublyBookingWizardUI.openWebsiteEditorForServices()">Edit packages →</button></div>
        <p class="bw-muted" style="margin:0 0 10px;">Packages are edited under Website editor → Packages so your site, Book Now, and Smart Quote stay the same.</p>
        ${svcHtml || '<p class="bw-muted">No packages yet — add them under Packages.</p>'}
      </section>
      <section class="bw-sec">
        <div class="bw-sec-h"><h3>3 · Add-ons</h3>
          <button type="button" class="btn btn-out btn-sm" onclick="HublyBookingWizardUI.addAddon()">+ Add</button></div>
        ${addonHtml || '<p class="bw-muted">Optional add-ons customers can tap.</p>'}
      </section>
      <section class="bw-sec">
        <h3>4 · Where options</h3>
        <label class="bw-muted" style="display:block;margin:0 0 6px;">Studio address (shown when customers pick Studio)</label>
        <input class="bw-input" value="${esc(w.studioAddress || '')}" oninput="HublyBookingWizardUI.setCopy('studioAddress',this.value)" placeholder="123 Studio Lane, City, ST">
        <input class="bw-input" value="${esc(w.whereNote || '')}" oninput="HublyBookingWizardUI.setCopy('whereNote',this.value)" placeholder="Where-step note (optional)">
        ${whereHtml || '<p class="bw-muted">Location types for step 2.</p>'}
      </section>
      <section class="bw-sec">
        <h3>5 · Trust & review copy</h3>
        <input class="bw-input" value="${esc(w.helpBlurb)}" oninput="HublyBookingWizardUI.setCopy('helpBlurb',this.value)" placeholder="Help blurb">
        <input class="bw-input" value="${esc(w.reviewTrust)}" oninput="HublyBookingWizardUI.setCopy('reviewTrust',this.value)" placeholder="Review trust line">
        <textarea class="bw-input" rows="2" oninput="HublyBookingWizardUI.setCopy('cancelBlurb',this.value)" placeholder="Cancel / reschedule blurb">${esc(w.cancelBlurb)}</textarea>
      </section>
      <section class="bw-sec bw-suggest">
        <h3>Not your industry?</h3>
        <p class="bw-muted">Suggest a trade and we’ll help set it up.</p>
        <button type="button" class="btn btn-out" onclick="openSuggestIndustryModal()">Suggest my industry →</button>
      </section>`;
  }

  function renderPreview() {
    const root = previewRoot();
    const w = ensureWizard();
    const app = appState() || {};
    if (!root || !w) return;
    let accent = app.siteAccent || app.brandColor || app.color || '#0f766e';
    try {
      if (typeof getAccentColor === 'function') {
        const a = getAccentColor();
        if (a) accent = a;
      }
    } catch (e) {}
    const cards = (w.services || [])
      .slice(0, 5)
      .map((s) => {
        const priceNum = Number(s.price);
        const price =
          Number.isFinite(priceNum) && priceNum > 0 ? `$${Math.round(priceNum)}` : '';
        const dur = String(s.dur || '').trim();
        const meta =
          price || dur
            ? `<div class="bw-prev-meta">${price ? esc(price) : ''}${
                price && dur ? ' · ' : ''
              }${dur ? `⏱ ${esc(dur)} hrs` : ''}</div>`
            : '';
        return `<div class="bw-prev-card ${s.popular ? 'pop' : ''}">
        <div class="bw-prev-media">${s.image ? `<img src="${esc(s.image)}" alt="">` : ''}</div>
        <strong>${esc(s.name)}</strong>
        ${meta}
        <span>${esc(s.desc || '')}</span>
        ${s.popular ? '<em>Most popular</em>' : ''}
      </div>`;
      })
      .join('');
    root.innerHTML = `
      <div class="bw-prev-shell" style="--bw-accent:${esc(accent)}">
        <div class="bw-prev-brand" style="background:${esc(accent)}">${esc(app.biz || 'Your Business')}</div>
        <div class="bw-prev-steps">
          <span class="on"><i>1</i>Details<em>Choose your service</em></span>
          <span><i>2</i>When &amp; where<em>Pick date &amp; location</em></span>
          <span><i>3</i>Your info<em>Tell us about you</em></span>
          <span><i>4</i>Review<em>Confirm &amp; book</em></span>
        </div>
        <h2>${esc(w.headline || 'Book with us')}</h2>
        <p>${esc(w.blurb || '')}</p>
        <div class="bw-prev-prompt">${esc(w.servicePrompt || '')}</div>
        <div class="bw-prev-grid">${cards || '<div class="bw-muted">Services appear here</div>'}</div>
        <div class="bw-prev-side">
          <div class="bw-prev-kicker">Booking summary</div>
          <ul>${(w.sidebarIncludes || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
          <p class="bw-muted">${esc(w.helpBlurb || '')}</p>
        </div>
      </div>`;
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
      const nav = document.querySelector('[data-v="booking-wizard"]');
      if (nav && typeof switchV === 'function') switchV(nav);
      else {
        document.querySelectorAll('.body').forEach((el) => el.classList.add('hidden'));
        document.getElementById('v-booking-wizard')?.classList.remove('hidden');
      }
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
        '<strong>Starter packages on your site</strong>You chose to set services after the website. These are example packages so the page looks real — rename, reprice, or replace them here.';
    } else {
      el.innerHTML =
        '<strong>Hubly drafted these packages</strong>They’re a starting vision for your trade. Keep what you like, swap photos, or add your own.';
    }
  }

  function finish(opts) {
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
    if (opts && opts.preview) {
      if (typeof openBookingPage === 'function') {
        const name = (w.services && w.services[0] && w.services[0].name) || null;
        if (typeof setOwnerPreview === 'function') setOwnerPreview(true);
        openBookingPage(name);
        return;
      }
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
    ensureWizard,
    setCopy,
    updateService,
    addService,
    removeService,
    updateAddon,
    addAddon,
    removeAddon,
    updateWhere,
    openWebsiteEditorForServices,
    renderEditor,
    renderPreview,
    renderDraftBanner,
    syncServicesOut,
    persistLocal,
  };
})(typeof window !== 'undefined' ? window : global);
