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
    const w = app.bookingWizard;
    if (!Array.isArray(w.sidebarIncludes)) w.sidebarIncludes = [];
    if (!Array.isArray(w.trustLines)) w.trustLines = [];
    if (!Array.isArray(w.addons)) w.addons = [];
    if (!Array.isArray(w.whereOptions)) w.whereOptions = [];
    w.addons.forEach((a) => {
      if (a && a.enabled == null) a.enabled = true;
    });
    if (w.defaultWhereId == null && w.whereOptions[0]) w.defaultWhereId = w.whereOptions[0].id;
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
    w.trustLines.push('Satisfaction guaranteed');
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
    const target = document.getElementById('bw-sec-' + id);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderNav() {
    const nav = navRoot();
    const w = ensureWizard();
    if (!nav || !w) return;
    const sec = activeSection();
    const items = [
      { id: 'headline', label: 'Headline & Intro', icon: '✎' },
      { id: 'packages', label: 'Packages', icon: '▦', badge: (w.services || []).length },
      { id: 'addons', label: 'Add-ons', icon: '+', badge: (w.addons || []).length },
      { id: 'where', label: 'Where Options', icon: '⌖' },
      { id: 'trust', label: 'Trust & Info', icon: '✓' },
      { id: 'settings', label: 'Settings', icon: '⚙' },
    ];
    nav.innerHTML = items
      .map(
        (it) => `<button type="button" class="${sec === it.id ? 'on' : ''}" onclick="HublyBookingWizardUI.setSection('${it.id}')">
        <span aria-hidden="true">${it.icon}</span>
        <span>${esc(it.label)}</span>
        ${it.badge != null ? `<span class="badge">${esc(it.badge)}</span>` : ''}
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

    const benefitPresets = [
      'Fast & easy booking',
      'Licensed & insured',
      'Satisfaction guaranteed',
      'Upfront pricing',
      'Online booking in minutes',
    ];
    const activeBenefits = w.sidebarIncludes || [];
    const benefitHtml = benefitPresets
      .map((b) => {
        const on = activeBenefits.includes(b);
        return `<button type="button" class="bw-benefit-chip ${on ? 'on' : ''}" onclick="HublyBookingWizardUI.toggleBenefit(${JSON.stringify(b)})">${esc(b)}</button>`;
      })
      .join('');

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
      .map(
        (a, i) => `<div class="bw-addon-row">
        <div class="grow">
          <input class="bw-input" style="margin:0 0 6px" value="${esc(a.name)}" oninput="HublyBookingWizardUI.updateAddon(${i},'name',this.value)">
          <input class="bw-input bw-price" type="number" value="${esc(a.price)}" oninput="HublyBookingWizardUI.updateAddon(${i},'price',this.value)">
        </div>
        <label class="tog" title="Show to customers"><input type="checkbox" ${a.enabled !== false ? 'checked' : ''} onchange="HublyBookingWizardUI.updateAddon(${i},'enabled',this.checked)"><span class="tog-sl"></span></label>
        <button type="button" class="btn btn-out btn-sm" onclick="HublyBookingWizardUI.removeAddon(${i})">×</button>
      </div>`
      )
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

    root.innerHTML = `
      <section class="bw-sec" id="bw-sec-headline">
        <h3>1 · Headline &amp; Introduction</h3>
        <label class="bw-muted" style="display:block;margin:0 0 4px">Headline</label>
        <input class="bw-input" value="${esc(w.headline)}" oninput="HublyBookingWizardUI.setCopy('headline',this.value)" maxlength="80">
        <label class="bw-muted" style="display:block;margin:0 0 4px">Subheadline</label>
        <input class="bw-input" value="${esc(w.blurb)}" oninput="HublyBookingWizardUI.setCopy('blurb',this.value)" maxlength="140">
        <label class="bw-muted" style="display:block;margin:4px 0">Benefit tags</label>
        <div class="bw-benefit-row">${benefitHtml}</div>
        <input class="bw-input" style="margin-top:10px" value="${esc(w.servicePrompt || '')}" oninput="HublyBookingWizardUI.setCopy('servicePrompt',this.value)" placeholder="Service prompt">
      </section>
      <section class="bw-sec" id="bw-sec-packages">
        <div class="bw-sec-h"><h3>2 · Packages</h3>
          <button type="button" class="btn btn-brand btn-sm" onclick="HublyBookingWizardUI.openWebsiteEditorForServices()">Manage packages</button></div>
        <p class="bw-muted" style="margin:0 0 10px;">Edited under Packages so your site, Book Now, and Smart Quote stay in sync.</p>
        ${svcHtml || '<p class="bw-muted">No packages yet — add them under Packages.</p>'}
        <button type="button" class="btn btn-out btn-sm" onclick="HublyBookingWizardUI.openWebsiteEditorForServices()">+ Add or reorder packages</button>
      </section>
      <section class="bw-sec" id="bw-sec-addons">
        <div class="bw-sec-h"><h3>3 · Add-ons</h3>
          <button type="button" class="btn btn-out btn-sm" onclick="HublyBookingWizardUI.addAddon()">+ Add add-on</button></div>
        ${addonHtml || '<p class="bw-muted">Optional extras customers can tap.</p>'}
      </section>
      <section class="bw-sec" id="bw-sec-where">
        <div class="bw-sec-h"><h3>4 · Where options</h3>
          <button type="button" class="btn btn-out btn-sm" onclick="HublyBookingWizardUI.setSection('where')">Customize</button></div>
        <div class="bw-where-pick">${whereHtml || '<p class="bw-muted">Location types for step 2.</p>'}</div>
        <label class="bw-muted" style="display:block;margin:0 0 6px;">Studio / service address</label>
        <input class="bw-input" value="${esc(w.studioAddress || '')}" oninput="HublyBookingWizardUI.setCopy('studioAddress',this.value)" placeholder="123 Studio Lane, City, ST">
        <input class="bw-input" value="${esc(w.whereNote || '')}" oninput="HublyBookingWizardUI.setCopy('whereNote',this.value)" placeholder="Where-step note (optional)">
      </section>
      <section class="bw-sec" id="bw-sec-trust">
        <h3>5 · Trust &amp; review copy</h3>
        ${trustHtml || '<p class="bw-muted">Add trust lines customers see on review.</p>'}
        <button type="button" class="btn btn-out btn-sm" onclick="HublyBookingWizardUI.addTrustLine()">+ Add trust line</button>
        <input class="bw-input" style="margin-top:10px" value="${esc(w.helpBlurb || '')}" oninput="HublyBookingWizardUI.setCopy('helpBlurb',this.value)" placeholder="Help blurb">
        <input class="bw-input" value="${esc(w.reviewTrust || '')}" oninput="HublyBookingWizardUI.setCopy('reviewTrust',this.value)" placeholder="Review trust line">
        <textarea class="bw-input" rows="2" oninput="HublyBookingWizardUI.setCopy('cancelBlurb',this.value)" placeholder="Cancel / reschedule blurb">${esc(w.cancelBlurb || '')}</textarea>
      </section>
      <section class="bw-sec bw-suggest" id="bw-sec-settings">
        <h3>Settings</h3>
        <p class="bw-muted">Packages live under the Packages tab. Suggest a different industry if this frame doesn’t fit.</p>
        <button type="button" class="btn btn-out" onclick="openSuggestIndustryModal()">Suggest my industry →</button>
      </section>`;
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

    const pkgRows = (w.services || [])
      .slice(0, 5)
      .map((s) => {
        const priceNum = Number(s.price);
        const price =
          Number.isFinite(priceNum) && priceNum > 0 ? `$${Math.round(priceNum)}` : '';
        const dur = String(s.dur || '').trim();
        return `<div class="bw-prev-card ${s.popular ? 'pop' : ''}" style="display:grid;grid-template-columns:56px 1fr;gap:8px;align-items:center;padding:8px;margin:0 0 8px">
          <div class="bw-prev-media" style="aspect-ratio:1;border-radius:8px">${s.image ? `<img src="${esc(s.image)}" alt="">` : ''}</div>
          <div>
            <strong style="padding:0;font-size:12px">${esc(s.name)}</strong>
            <div class="bw-prev-meta" style="font-size:11px;opacity:.8">${price ? esc(price) : ''}${price && dur ? ' · ' : ''}${dur ? esc(dur) + ' hrs' : ''}</div>
          </div>
        </div>`;
      })
      .join('');

    const addonRows = (w.addons || [])
      .filter((a) => a && a.enabled !== false)
      .map(
        (a) =>
          `<label style="display:flex;gap:8px;align-items:center;font-size:12px;margin:0 0 6px;opacity:.92"><input type="checkbox" disabled> ${esc(a.name)} <span style="margin-left:auto;font-weight:700">$${Math.round(Number(a.price) || 0)}</span></label>`
      )
      .join('');

    const whereRows = (w.whereOptions || [])
      .map((o) => {
        const on = (w.defaultWhereId || (w.whereOptions[0] && w.whereOptions[0].id)) === o.id;
        return `<label style="display:flex;gap:8px;align-items:center;font-size:12px;margin:0 0 6px"><input type="radio" disabled ${on ? 'checked' : ''}> ${esc(o.label)}</label>`;
      })
      .join('');

    const benefits = (w.sidebarIncludes || [])
      .slice(0, 3)
      .map((x) => `<span style="display:inline-block;font-size:10px;padding:3px 8px;border-radius:999px;background:rgba(255,255,255,.1);margin:0 4px 4px 0">${esc(x)}</span>`)
      .join('');

    root.innerHTML = `
      <div style="font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#64748b;margin:0 0 8px">Live preview</div>
      <div class="bw-prev-phone">
        <div class="bw-prev-shell" style="--bw-accent:${esc(accent)};padding:0">
          <div class="bw-prev-brand" style="background:${esc(accent)};color:#fff;padding:12px 14px;margin:0;font-size:13px">${esc(app.biz || 'Your Business')}</div>
          <div style="padding:14px 14px 18px">
            <h2 style="font-size:18px;margin:0 0 6px">${esc(w.headline || 'Book with us')}</h2>
            <p style="margin:0 0 10px;font-size:12px;color:#cbd5e1">${esc(w.blurb || '')}</p>
            <div style="margin:0 0 12px">${benefits}</div>
            <div class="bw-prev-prompt" style="margin:0 0 8px">${esc(w.servicePrompt || 'Choose a service')}</div>
            <div>${pkgRows || '<div class="bw-muted">Services appear here</div>'}</div>
            ${addonRows ? `<div style="margin:12px 0 8px;font-size:11px;font-weight:700;opacity:.7">Add-ons</div>${addonRows}` : ''}
            ${whereRows ? `<div style="margin:12px 0 8px;font-size:11px;font-weight:700;opacity:.7">Where should we come?</div>${whereRows}` : ''}
            <button type="button" style="display:block;width:100%;margin-top:14px;padding:12px;border:none;border-radius:12px;background:${esc(accent)};color:#fff;font:inherit;font-weight:750;font-size:13px">Request a quote</button>
          </div>
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
    toggleBenefit,
    updateTrustLine,
    addTrustLine,
    removeTrustLine,
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
