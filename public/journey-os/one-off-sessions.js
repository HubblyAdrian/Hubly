/**
 * Hubly One-Off Sessions — owner surface (Operate → Sessions).
 *
 * A One-Off Session is a temporary, date-specific booking event: a
 * photographer's mini sessions, a detailer's wash day, a lawn crew's
 * neighborhood service day. It is deliberately NOT a Service — it never joins
 * the permanent catalog or the normal booking page, and customers reach it only
 * through its private link.
 *
 * This module owns zero business logic. Slots, deposits, lifecycle, calendar
 * blocking and seat reservation all live server-side in the one-off-sessions
 * Edge Function (backed by _shared/one_off_session_engine.ts) — the same API the
 * AI capability calls. Everything rendered here is a projection of what that API
 * actually returned; nothing is computed locally and nothing is assumed.
 */
(function (global) {
  'use strict';

  var view = { sessions: [], loading: false, error: null, notice: null, openId: null, detail: null, creating: false, editing: false };

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function toast(msg) {
    if (typeof global.toast === 'function') return global.toast(msg);
    try { console.log('[Hubly Sessions]', msg); } catch (e) {}
  }
  function money(cents) {
    var n = Math.round(Number(cents) || 0) / 100;
    return '$' + n.toFixed(2).replace(/\.00$/, '');
  }
  function businessId() {
    try { if (global.currentBusiness && global.currentBusiness.id) return String(global.currentBusiness.id); } catch (e) {}
    var S = global.S || {};
    return S.businessId || S.bizId || S.business_id || '';
  }
  function friendlyDate(ds) {
    if (!ds) return '';
    try {
      var p = String(ds).slice(0, 10).split('-').map(Number);
      return new Date(p[0], (p[1] || 1) - 1, p[2] || 1).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch (e) { return String(ds); }
  }
  function friendlyTime(hm) {
    if (!hm) return '';
    var p = String(hm).slice(0, 5).split(':');
    var hh = Number(p[0]), mm = Number(p[1]);
    if (!isFinite(hh) || !isFinite(mm)) return String(hm);
    return ((hh % 12) || 12) + ':' + String(mm).padStart(2, '0') + ' ' + (hh >= 12 ? 'PM' : 'AM');
  }

  /* ── API ────────────────────────────────────────────────────────────────── */

  async function api(action, payload) {
    var base = '';
    try { if (global.HublySupabase && global.HublySupabase.url) base = String(global.HublySupabase.url).replace(/\/$/, ''); } catch (e) {}
    if (!base) return { ok: false, error: 'not_configured' };
    var headers = { 'content-type': 'application/json' };
    try {
      var anon = global.HublySupabase && (global.HublySupabase.anonKey || global.HublySupabase.key);
      if (anon) headers.apikey = anon;
      var sess = global.HublySupabase && global.HublySupabase.session;
      var token = sess && (sess.access_token || sess.accessToken);
      // Owner actions are authorized by this JWT against businesses.owner_id
      // server-side. Without it the API returns 401 — never a silent fallback.
      if (token) headers.Authorization = 'Bearer ' + token;
    } catch (e2) {}
    var res = await fetch(base + '/functions/v1/one-off-sessions', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(Object.assign({ action: action, business_id: businessId() }, payload || {}))
    });
    var data = null;
    try { data = await res.json(); } catch (e3) {}
    return data || { ok: false, error: 'request_failed' };
  }

  /* ── chrome ─────────────────────────────────────────────────────────────── */

  function setMode(on) {
    var app = el('p-app');
    if (!app) return;
    if (on) {
      app.classList.add('jos-pixel');
      try { document.body.classList.add('jos-pixel'); } catch (e) {}
    }
    app.classList.toggle('jos-sessions-mode', !!on);
  }

  function ownRoot() {
    var vw = el('v-sessions');
    if (!vw) return null;
    vw.classList.add('jos-pixel-owned');
    vw.classList.remove('hidden');
    vw.hidden = false;
    var root = el('jos-sessions-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'jos-sessions-root';
      vw.appendChild(root);
    }
    Array.prototype.slice.call(vw.children).forEach(function (ch) {
      if (ch.id !== 'jos-sessions-root') ch.remove();
    });
    return root;
  }

  function injectStyle() {
    if (el('jos-sessions-style')) return;
    var st = document.createElement('style');
    st.id = 'jos-sessions-style';
    st.textContent =
      '.oos-wrap{padding:22px 24px 60px;max-width:1080px;}' +
      '.oos-head{display:flex;align-items:flex-start;gap:16px;margin-bottom:6px;flex-wrap:wrap;}' +
      '.oos-head h1{font-size:24px;font-weight:800;letter-spacing:-.02em;margin:0;color:#141B2B;}' +
      '.oos-head .oos-sub{color:#6b7280;font-size:14px;margin-top:4px;max-width:640px;line-height:1.5;}' +
      '.oos-head .oos-spacer{flex:1;}' +
      '.oos-btn{border:0;border-radius:999px;background:#D9632D;color:#fff;font:inherit;font-weight:700;font-size:14px;padding:10px 18px;cursor:pointer;}' +
      '.oos-btn.ghost{background:#F1F3F5;color:#141B2B;}' +
      '.oos-btn.quiet{background:transparent;color:#5b6472;border:1px solid #E6E8EC;font-weight:600;}' +
      '.oos-btn:disabled{opacity:.45;cursor:default;}' +
      '.oos-card{border:1px solid #E6E8EC;border-radius:14px;background:#fff;padding:18px;margin-top:14px;}' +
      '.oos-row{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;}' +
      '.oos-row .oos-main{flex:1;min-width:220px;}' +
      '.oos-name{font-weight:700;font-size:17px;color:#141B2B;}' +
      '.oos-meta{color:#6b7280;font-size:13.5px;margin-top:4px;line-height:1.6;}' +
      '.oos-pill{display:inline-block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:3px 9px;border-radius:999px;background:#eef1f5;color:#5b6472;margin-left:8px;vertical-align:2px;}' +
      '.oos-pill.published{background:#e6f4ea;color:#1e7a3c;}' +
      '.oos-pill.draft{background:#fdeee5;color:#D9632D;}' +
      '.oos-pill.sold_out{background:#fff4d6;color:#946200;}' +
      '.oos-pill.closed,.oos-pill.completed{background:#eef1f5;color:#6b7280;}' +
      '.oos-pill.cancelled{background:#fdecea;color:#a8271b;}' +
      '.oos-counts{display:flex;gap:22px;flex-wrap:wrap;margin-top:12px;}' +
      '.oos-counts .k{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#8a9099;font-weight:700;}' +
      '.oos-counts .v{font-size:19px;font-weight:800;color:#141B2B;}' +
      '.oos-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;}' +
      '.oos-empty{color:#6b7280;font-size:14px;padding:26px 0;}' +
      '.oos-err{background:#fdecea;color:#a8271b;border-radius:10px;padding:11px 14px;font-size:14px;margin-top:14px;}' +
      '.oos-note{background:#eef1f5;color:#4a5163;border-radius:10px;padding:11px 14px;font-size:13.5px;margin-top:12px;line-height:1.55;}' +
      '.oos-sec{margin-top:20px;}' +
      '.oos-sec h3{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#8a9099;margin:0 0 10px;}' +
      '.oos-kv{display:flex;justify-content:space-between;gap:14px;font-size:14px;padding:6px 0;border-bottom:1px solid #F1F3F5;}' +
      '.oos-kv .k{color:#6b7280;}' +
      '.oos-kv .v{font-weight:600;text-align:right;color:#141B2B;}' +
      '.oos-link{display:flex;gap:8px;align-items:center;margin-top:8px;}' +
      '.oos-link input{flex:1;padding:10px 12px;border:1px solid #E6E8EC;border-radius:10px;font:inherit;font-size:13px;color:#4a5163;background:#FAFBFC;}' +
      '.oos-form{display:grid;grid-template-columns:1fr 1fr;gap:12px;}' +
      '.oos-form .full{grid-column:1/-1;}' +
      '.oos-form label{display:block;font-size:12px;font-weight:600;color:#5b6472;margin-bottom:5px;}' +
      '.oos-form input,.oos-form select,.oos-form textarea{width:100%;padding:10px 12px;border:1px solid #E6E8EC;border-radius:10px;font:inherit;font-size:14px;background:#fff;}' +
      '.oos-bk{display:flex;justify-content:space-between;gap:12px;font-size:14px;padding:9px 0;border-bottom:1px solid #F1F3F5;}' +
      '.oos-bk .when{font-weight:700;width:86px;flex:none;}' +
      '.oos-bk .who{flex:1;}' +
      '.oos-bk .pay{color:#6b7280;font-size:13px;}' +
      '.oos-bk-sub{color:#8a9099;font-size:12.5px;}' +
      '.oos-bk-x{border:0;background:transparent;color:#b4b9c0;font-size:18px;line-height:1;cursor:pointer;padding:0 2px;}' +
      '.oos-bk-x:hover{color:#a8271b;}' +
      '.oos-price{font-weight:700;font-size:15px;color:#141B2B;margin-top:10px;}' +
      '@media(max-width:720px){.oos-form{grid-template-columns:1fr;}.oos-wrap{padding:18px 16px 60px;}}';
    document.head.appendChild(st);
  }

  /* ── render ─────────────────────────────────────────────────────────────── */

  function statusPill(s) {
    return '<span class="oos-pill ' + esc(s.status) + '">' + esc(String(s.status).replace('_', ' ')) + '</span>';
  }

  /** "$150 · $50 deposit" — what the customer pays, in the provider's language. */
  function priceLine(s) {
    if (!s.price_cents) return 'No charge';
    var bits = [money(s.price_cents)];
    var p = s.payment_summary || {};
    if (p.mode === 'deposit' && p.charge_now_cents) bits.push(money(p.charge_now_cents) + ' deposit');
    else if (p.mode === 'full') bits.push('paid in full at booking');
    else bits.push('paid at the session');
    return bits.join(' · ');
  }

  function sessionLine(s) {
    var bits = [
      friendlyDate(s.session_date),
      friendlyTime(s.start_time) + ' – ' + friendlyTime(s.end_time),
      s.appointment_duration_minutes + ' min'
    ];
    if (s.location) bits.push(s.location);
    if (s.price_cents) bits.push(money(s.price_cents));
    return bits.join(' · ');
  }

  function listHtml() {
    if (view.loading) return '<div class="oos-empty">Loading sessions…</div>';
    if (!view.sessions.length) {
      return '<div class="oos-card"><div class="oos-empty">' +
        'No sessions yet. A session is a one-off event — a specific date and window you open up for short back-to-back appointments. ' +
        'It stays off your normal booking page and holds your calendar for the whole window.' +
        '</div><button type="button" class="oos-btn" data-oos-act="new">+ Create Session</button></div>';
    }
    return view.sessions.map(function (s) {
      return '<div class="oos-card">' +
        '<div class="oos-row"><div class="oos-main">' +
          '<div class="oos-name">' + esc(s.name) + statusPill(s) + '</div>' +
          '<div class="oos-meta">' + esc(friendlyDate(s.session_date)) + '</div>' +
          '<div class="oos-meta">' + esc(friendlyTime(s.start_time)) + ' – ' + esc(friendlyTime(s.end_time)) + '</div>' +
          '<div class="oos-counts">' +
            '<div><div class="k">Spots</div><div class="v">' + esc(s.total_spots) + '</div></div>' +
            '<div><div class="k">Booked</div><div class="v">' + esc(s.booked) + '</div></div>' +
            '<div><div class="k">Available</div><div class="v">' + esc(s.remaining) + '</div></div>' +
          '</div>' +
          '<div class="oos-price">' + esc(priceLine(s)) + '</div>' +
        '</div></div>' +
        '<div class="oos-actions">' +
          '<button type="button" class="oos-btn ghost" data-oos-act="open" data-id="' + esc(s.id) + '">View</button>' +
          (s.booking_url ? '<button type="button" class="oos-btn quiet" data-oos-act="copy" data-url="' + esc(s.booking_url) + '">Share</button>' : '') +
          (s.status === 'draft' ? '<button type="button" class="oos-btn" data-oos-act="publish" data-id="' + esc(s.id) + '">Publish</button>' : '') +
        '</div>' +
        '</div>';
    }).join('');
  }

  /** One form for both create and edit — the fields are identical, so there is
   *  exactly one place the session shape is described to the provider. */
  function sessionFormHtml(existing) {
    var e = existing || {};
    var v = function (k, d) { return e[k] != null ? e[k] : (d == null ? '' : d); };
    var mode = e.id ? 'edit' : 'create';
    var payMode = e.payment_summary ? e.payment_summary.mode : 'none';
    var depDollars = (e.payment_summary && e.payment_summary.mode === 'deposit' && e.payment_summary.charge_now_cents)
      ? (e.payment_summary.charge_now_cents / 100) : '';
    return '<div class="oos-card">' +
      '<h3 style="margin:0 0 14px;font-size:16px;">' + (mode === 'edit' ? 'Edit session' : 'New session') + '</h3>' +
      '<div class="oos-form">' +
        '<div class="full"><label for="oos-name">Name</label><input id="oos-name" type="text" placeholder="Fall Mini Sessions" value="' + esc(v('name')) + '"></div>' +
        '<div class="full"><label for="oos-desc">Description</label><textarea id="oos-desc" rows="2" placeholder="20-minute photography sessions">' + esc(v('description')) + '</textarea></div>' +
        '<div><label for="oos-date">Date</label><input id="oos-date" type="date" value="' + esc(String(v('session_date')).slice(0, 10)) + '"></div>' +
        '<div><label for="oos-loc">Location</label><input id="oos-loc" type="text" placeholder="Thanksgiving Point" value="' + esc(v('location')) + '"></div>' +
        '<div><label for="oos-start">Start</label><input id="oos-start" type="time" value="' + esc(String(v('start_time', '08:00')).slice(0, 5)) + '"></div>' +
        '<div><label for="oos-end">End</label><input id="oos-end" type="time" value="' + esc(String(v('end_time', '14:00')).slice(0, 5)) + '"></div>' +
        '<div><label for="oos-dur">Appointment length (min)</label><input id="oos-dur" type="number" min="5" step="5" value="' + esc(v('appointment_duration_minutes', 20)) + '"></div>' +
        '<div><label for="oos-buf">Buffer between (min)</label><input id="oos-buf" type="number" min="0" step="5" value="' + esc(v('buffer_minutes', 0)) + '"></div>' +
        '<div><label for="oos-price">Price ($)</label><input id="oos-price" type="number" min="0" step="1" placeholder="150" value="' + esc(e.price_cents ? e.price_cents / 100 : '') + '"></div>' +
        '<div><label for="oos-cap">Customers per time</label><input id="oos-cap" type="number" min="1" step="1" value="' + esc(v('capacity_per_slot', 1)) + '"></div>' +
        '<div><label for="oos-paymode">Payment</label><select id="oos-paymode">' +
          '<option value="none"' + (payMode === 'none' ? ' selected' : '') + '>Pay at the session</option>' +
          '<option value="deposit"' + (payMode === 'deposit' ? ' selected' : '') + '>Deposit at booking</option>' +
          '<option value="full"' + (payMode === 'full' ? ' selected' : '') + '>Full payment at booking</option>' +
        '</select></div>' +
        '<div><label for="oos-dep">Deposit ($)</label><input id="oos-dep" type="number" min="0" step="1" placeholder="50" value="' + esc(depDollars) + '"></div>' +
      '</div>' +
      (mode === 'edit'
        ? '<div class="oos-note">Changes apply to NEW bookings. Anyone already booked keeps the time and price they booked at — Hubly refuses a change that would strand an existing appointment.</div>'
        : '<div class="oos-note">Creating it saves a draft. Nothing is public and no calendar time is held until you publish.</div>') +
      '<div class="oos-actions">' +
        '<button type="button" class="oos-btn" data-oos-act="' + (mode === 'edit' ? 'save' : 'create') + '"' + (mode === 'edit' ? ' data-id="' + esc(e.id) + '"' : '') + '>' +
          (mode === 'edit' ? 'Save changes' : 'Create draft') + '</button>' +
        '<button type="button" class="oos-btn quiet" data-oos-act="' + (mode === 'edit' ? 'cancel-edit' : 'cancel-new') + '">Cancel</button>' +
      '</div>' +
      '</div>';
  }

  function detailHtml() {
    var d = view.detail;
    if (!d) return '<div class="oos-empty">Loading…</div>';
    var s = d.session;
    var bookings = (d.bookings || []).filter(function (b) { return b.status !== 'cancelled'; });

    var overview = '<div class="oos-sec"><h3>Overview</h3>' +
      '<div class="oos-kv"><span class="k">Date</span><span class="v">' + esc(friendlyDate(s.session_date)) + '</span></div>' +
      '<div class="oos-kv"><span class="k">Window</span><span class="v">' + esc(friendlyTime(s.start_time)) + ' – ' + esc(friendlyTime(s.end_time)) + '</span></div>' +
      '<div class="oos-kv"><span class="k">Appointment</span><span class="v">' + esc(s.appointment_duration_minutes) + ' min' + (s.buffer_minutes ? ' + ' + esc(s.buffer_minutes) + ' min buffer' : '') + '</span></div>' +
      (s.location ? '<div class="oos-kv"><span class="k">Location</span><span class="v">' + esc(s.location) + '</span></div>' : '') +
      (s.service_name ? '<div class="oos-kv"><span class="k">Service</span><span class="v">' + esc(s.service_name) + '</span></div>' : '') +
      '<div class="oos-kv"><span class="k">Price</span><span class="v">' + esc(s.price_cents ? money(s.price_cents) : 'No charge') + '</span></div>' +
      '<div class="oos-kv"><span class="k">Deposit</span><span class="v">' + esc(
        (s.payment_summary && s.payment_summary.mode === 'deposit' && s.payment_summary.charge_now_cents)
          ? money(s.payment_summary.charge_now_cents) + ' due at booking'
          : (s.payment_summary && s.payment_summary.mode === 'full' ? 'Full payment at booking' : 'None')) + '</span></div>' +
      '</div>';

    var availability = '<div class="oos-sec"><h3>Availability</h3>' +
      '<div class="oos-counts">' +
        '<div><div class="k">Total slots</div><div class="v">' + esc(s.slot_count) + '</div></div>' +
        '<div><div class="k">Booked</div><div class="v">' + esc(s.booked) + '</div></div>' +
        '<div><div class="k">Remaining</div><div class="v">' + esc(s.remaining) + '</div></div>' +
      '</div></div>';

    var bookingsHtml = '<div class="oos-sec"><h3>Bookings</h3>' +
      (bookings.length
        ? bookings.map(function (b) {
            var pay = b.payment_status === 'paid'
              ? money(b.amount_paid_cents) + ' paid'
              : (b.status === 'pending_payment' ? 'awaiting payment' : 'pay at session');
            return '<div class="oos-bk"><span class="when">' + esc(friendlyTime(b.slot_time)) + '</span>' +
              '<span class="who">' + esc(b.customer_name) +
                (b.customer_email ? '<br><span class="oos-bk-sub">' + esc(b.customer_email) + '</span>' : '') +
                (b.customer_phone ? '<span class="oos-bk-sub"> &middot; ' + esc(b.customer_phone) + '</span>' : '') +
              '</span>' +
              '<span class="pay">' + esc(pay) + '</span>' +
              '<button type="button" class="oos-bk-x" title="Cancel this booking" ' +
                'data-oos-act="cancel-booking" data-id="' + esc(b.id) + '" ' +
                'data-paid="' + esc(b.payment_status === 'paid' ? b.amount_paid_cents : 0) + '">&times;</button>' +
              '</div>';
          }).join('')
        : '<div class="oos-empty" style="padding:8px 0;">Nobody has booked yet.</div>') +
      '</div>';

    var sharing = '<div class="oos-sec"><h3>Sharing</h3>' +
      (s.booking_url
        ? '<div class="oos-link"><input type="text" readonly value="' + esc(s.booking_url) + '">' +
          '<button type="button" class="oos-btn ghost" data-oos-act="copy" data-url="' + esc(s.booking_url) + '">Copy</button></div>' +
          '<div class="oos-note">This is the only way customers reach the session. It stays off your normal booking page and out of search.</div>'
        : '<div class="oos-empty" style="padding:8px 0;">No link yet.</div>') +
      '</div>';

    var website = '<div class="oos-sec"><h3>Website</h3>' +
      '<div class="oos-kv"><span class="k">Storefront promotion</span><span class="v">' +
        esc(s.website_promotion && s.website_promotion.storefront ? 'On' : 'Off') + '</span></div>' +
      '<div class="oos-actions">' +
        (s.website_promotion && s.website_promotion.storefront
          ? '<button type="button" class="oos-btn quiet" data-oos-act="promo-off" data-id="' + esc(s.id) + '">Remove from website</button>'
          : '<button type="button" class="oos-btn ghost" data-oos-act="promo-on" data-id="' + esc(s.id) + '">Add to website</button>') +
      '</div>' +
      '<div class="oos-note">Turning this on lets a promotional banner on your Store point straight at this session. The banner follows the session\'s state on its own — it shows Sold Out or No longer available without you editing it.</div>' +
      '</div>';

    var calendar = '<div class="oos-sec"><h3>Calendar</h3>' +
      '<div class="oos-kv"><span class="k">Hubly calendar</span><span class="v">' +
        esc(s.calendar_blocked ? 'Blocked ' + friendlyTime(s.start_time) + ' – ' + friendlyTime(s.end_time) : 'Not held') + '</span></div>' +
      '<div class="oos-kv"><span class="k">Google Calendar</span><span class="v">' +
        esc(s.google_synced ? 'Synced' : (s.calendar_blocked ? 'Not connected' : '—')) + '</span></div>' +
      (s.calendar_blocked
        ? '<div class="oos-note">Normal booking can\'t offer that window while the session holds it. Session customers still book inside it as usual.</div>'
        : '') +
      '</div>';

    var lifecycle = '<div class="oos-sec"><h3>Actions</h3><div class="oos-actions">' +
      (s.status !== 'cancelled' && s.status !== 'completed'
        ? '<button type="button" class="oos-btn ghost" data-oos-act="edit" data-id="' + esc(s.id) + '">Edit</button>' : '') +
      (s.booking_url ? '<button type="button" class="oos-btn quiet" data-oos-act="copy" data-url="' + esc(s.booking_url) + '">Share</button>' : '') +
      (s.status === 'draft' ? '<button type="button" class="oos-btn" data-oos-act="publish" data-id="' + esc(s.id) + '">Publish session</button>' : '') +
      (s.status === 'published' || s.status === 'sold_out' || s.status === 'closed'
        ? (s.status === 'closed'
            ? '<button type="button" class="oos-btn ghost" data-oos-act="publish" data-id="' + esc(s.id) + '">Reopen</button>'
            : '<button type="button" class="oos-btn ghost" data-oos-act="close" data-id="' + esc(s.id) + '">Close bookings</button>')
        : '') +
      (s.status !== 'cancelled' && s.status !== 'completed'
        ? '<button type="button" class="oos-btn quiet" data-oos-act="cancel-session" data-id="' + esc(s.id) + '">Cancel session</button>'
        : '') +
      '</div></div>';

    if (view.editing) {
      return '<div class="oos-card" style="padding-bottom:4px;">' +
        '<button type="button" class="oos-btn quiet" data-oos-act="back">&larr; All sessions</button></div>' +
        sessionFormHtml(s);
    }
    return '<div class="oos-card">' +
      '<button type="button" class="oos-btn quiet" data-oos-act="back" style="margin-bottom:14px;">&larr; All sessions</button>' +
      '<div class="oos-name" style="font-size:20px;">' + esc(s.name) + statusPill(s) + '</div>' +
      (s.description ? '<div class="oos-meta">' + esc(s.description) + '</div>' : '') +
      '<div class="oos-price">' + esc(priceLine(s)) + '</div>' +
      overview + availability + bookingsHtml + sharing + website + calendar + lifecycle +
      '</div>';
  }

  function render() {
    injectStyle();
    var root = ownRoot();
    if (!root) return;
    var body = view.openId
      ? detailHtml()
      : ((view.creating ? sessionFormHtml(null) : '') + listHtml());
    root.innerHTML =
      '<div class="oos-wrap">' +
        '<div class="oos-head">' +
          '<div><h1>Sessions</h1>' +
          '<div class="oos-sub">One-off booking events — a single date and window you open for short back-to-back appointments. Private by default: shared by link, kept off your normal booking page, and it holds your calendar so nothing double-books.</div></div>' +
          '<div class="oos-spacer"></div>' +
          (view.openId ? '' : '<button type="button" class="oos-btn" data-oos-act="new">+ Create Session</button>') +
        '</div>' +
        (view.error ? '<div class="oos-err">' + esc(view.error) + '</div>' : '') +
        (view.notice ? '<div class="oos-note">' + esc(view.notice) + '</div>' : '') +
        body +
      '</div>';
    wire(root);
  }

  /* ── actions ────────────────────────────────────────────────────────────── */

  function num(id) {
    var v = (el(id) || {}).value;
    if (v === '' || v == null) return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }
  function str(id) { return String(((el(id) || {}).value) || '').trim(); }

  /** The form's current values as an API payload. One reader for create and edit. */
  function readForm() {
    var payMode = str('oos-paymode') || 'none';
    var price = num('oos-price');
    var session = {
      name: str('oos-name'),
      description: str('oos-desc') || null,
      session_date: str('oos-date'),
      start_time: str('oos-start'),
      end_time: str('oos-end'),
      appointment_duration_minutes: num('oos-dur'),
      buffer_minutes: num('oos-buf') || 0,
      location: str('oos-loc') || null,
      capacity_per_slot: num('oos-cap') || 1,
      payment_mode: payMode
    };
    session.price_cents = price != null ? Math.round(price * 100) : null;
    if (payMode === 'deposit') {
      session.deposit_type = 'flat';
      var dep = num('oos-dep');
      session.deposit_cents = dep != null ? Math.round(dep * 100) : null;
      session.deposit_percentage = null;
    } else {
      session.deposit_type = null;
      session.deposit_cents = null;
      session.deposit_percentage = null;
    }
    return session;
  }

  async function doCreate() {
    var r = await api('create', { session: readForm() });
    if (!r.ok) { view.error = r.error || 'Could not create the session.'; render(); return; }
    view.creating = false;
    view.error = null;
    view.notice = null;
    toast('Session draft created');
    await load();
  }

  async function doSave(id) {
    var r = await api('update', { session_id: id, session: readForm() });
    if (!r.ok) {
      // The backend refuses anything that would strand a real appointment — show
      // its explanation verbatim rather than a generic failure.
      view.error = r.error || 'Could not save those changes.';
      render();
      return;
    }
    view.error = null;
    // Warnings are things the owner must know (repricing isn't retroactive, a
    // moved location doesn't notify anyone) — surfaced, never swallowed.
    view.notice = (r.warnings && r.warnings.length) ? r.warnings.join(' ') : null;
    view.editing = false;
    toast('Session updated');
    await openDetail(id);
  }

  async function doCancelBooking(bookingId, paidCents) {
    var paid = Number(paidCents) || 0;
    var msg = paid > 0
      ? 'Cancel this booking? The time goes back on sale. ' + money(paid) +
        ' was already paid — Hubly cannot refund it automatically, so you\'ll need to refund it in Stripe.'
      : 'Cancel this booking? The time goes back on sale.';
    if (!global.confirm(msg)) return;
    var r = await api('cancel_booking', { session_id: view.openId, booking_id: bookingId });
    if (!r.ok) { view.error = r.error || 'Could not cancel that booking.'; render(); return; }
    view.error = null;
    view.notice = r.refund_due_cents
      ? money(r.refund_due_cents) + ' still needs refunding in Stripe — Hubly did not refund it.'
      : null;
    toast('Booking cancelled');
    await openDetail(view.openId);
  }

  async function openDetail(id) {
    view.openId = id;
    view.detail = null;
    if (view.openId !== id) view.editing = false;
    render();
    var [s, b] = await Promise.all([
      api('get', { session_id: id }),
      api('bookings', { session_id: id })
    ]);
    if (!s.ok) { view.error = s.error || 'Could not open that session.'; view.openId = null; render(); return; }
    view.detail = { session: s.session, bookings: b.ok ? b.bookings : [] };
    render();
  }

  async function lifecycle(action, id, confirmMsg) {
    if (confirmMsg && !global.confirm(confirmMsg)) return;
    var r = await api(action, { session_id: id });
    if (!r.ok) { view.error = r.error || 'That didn\'t go through.'; render(); return; }
    view.error = null;
    toast(
      action === 'publish' ? 'Session published — calendar blocked' :
      action === 'close' ? 'Bookings closed — unsold time released' :
      action === 'cancel' ? 'Session cancelled' : 'Updated'
    );
    if (view.openId) await openDetail(view.openId);
    else await load();
  }

  async function promotion(on, id) {
    var r = await api(on ? 'promotion_set' : 'promotion_remove', { session_id: id });
    if (!r.ok) { view.error = r.error || 'Could not change the promotion.'; render(); return; }
    toast(on ? 'Added to your website' : 'Removed from your website');
    if (view.openId) await openDetail(view.openId);
    else await load();
  }

  function copyLink(url) {
    try {
      navigator.clipboard.writeText(url).then(function () { toast('Booking link copied'); },
        function () { global.prompt('Copy this link:', url); });
    } catch (e) { global.prompt('Copy this link:', url); }
  }

  function wire(root) {
    root.querySelectorAll('[data-oos-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        var act = b.getAttribute('data-oos-act');
        var id = b.getAttribute('data-id');
        if (act === 'new') { view.creating = true; view.openId = null; view.notice = null; render(); return; }
        if (act === 'cancel-new') { view.creating = false; render(); return; }
        if (act === 'create') return doCreate();
        if (act === 'edit') { view.editing = true; view.error = null; view.notice = null; render(); return; }
        if (act === 'cancel-edit') { view.editing = false; view.error = null; render(); return; }
        if (act === 'save') return doSave(id);
        if (act === 'cancel-booking') return doCancelBooking(id, b.getAttribute('data-paid'));
        if (act === 'open') return openDetail(id);
        if (act === 'back') { view.openId = null; view.detail = null; view.editing = false; render(); return; }
        if (act === 'copy') return copyLink(b.getAttribute('data-url') || '');
        if (act === 'publish') return lifecycle('publish', id);
        if (act === 'close') {
          return lifecycle('close', id,
            'Close bookings for this session? Existing appointments are kept, and the unsold part of the window goes back to normal booking.');
        }
        if (act === 'cancel-session') {
          return lifecycle('cancel', id,
            'Cancel this session? Every booking on it is cancelled and the whole window is released. Hubly does not refund anyone automatically — any payments already collected have to be refunded in Stripe.');
        }
        if (act === 'promo-on') return promotion(true, id);
        if (act === 'promo-off') return promotion(false, id);
      });
    });
  }

  async function load() {
    view.loading = true;
    render();
    var r = await api('list', {});
    view.loading = false;
    if (!r.ok) {
      view.error = r.error === 'Unauthorized'
        ? 'Sign in again to manage sessions.'
        : (r.error || 'Could not load sessions.');
      view.sessions = [];
    } else {
      view.error = null;
      view.sessions = r.sessions || [];
    }
    render();
  }

  function renderView() {
    if (!businessId()) {
      injectStyle();
      var root = ownRoot();
      if (root) root.innerHTML = '<div class="oos-wrap"><div class="oos-empty">Sessions become available once your business is set up.</div></div>';
      return;
    }
    if (view.openId) { openDetail(view.openId); return; }
    load();
  }

  global.HublyOneOffSessions = {
    render: renderView,
    setMode: setMode,
    reload: load,
    /** Open a specific session's detail from elsewhere (AI result, calendar, dashboard). */
    open: function (id) { view.openId = id; renderView(); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
