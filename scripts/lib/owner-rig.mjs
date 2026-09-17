/**
 * THE SIMULATED SIGNED-IN OWNER — one declared fake, not a third copy of one.
 *
 * check-arrival-in-dom, check-day-is-reachable and check-conversation-is-the-surface each grew
 * their own `fakeBackend`, and they had already drifted: one returned no business_places rows,
 * which makes hcWorkspaces() FAIL OPEN and every place look earned — so a red-proof for the
 * earned-gate defect passed with the defect restored. A fake that differs between checks is a
 * second opinion about what the product's world looks like, and it fails the same way two
 * readers of one fact always fail.
 *
 * SIMULATED AND SAID SO, EVERY TIME. There is no session here. `window.supabase.createClient`
 * is replaced with this; everything it answers is declared in the caller's `opts`. What runs
 * between the seam and the DOM is the shipping code in public/platform-home.html.
 *
 * ══ WHAT THIS FIXTURE STILL CANNOT DO — 2026-09-17, written down rather than discovered ═══════
 *
 * Adrian called this "the last bad fixture". Four things that made it one are fixed this round
 * (the channel stub swallowed its handlers; edge calls all returned null; `from()` was read-only
 * so nothing could test a write; `create_task` returned `{id:null}` so the product's own read-back
 * could never succeed and correct code was reported as failing). What is LEFT is listed here so
 * the next person meets it as a limit rather than as a mystery:
 *
 *   1. `eq` IS THE ONLY PREDICATE. `gte`, `lte`, `in`, `is`, `not`, `order` and `limit` are
 *      NO-OPS. A check whose fixture depends on a date window narrowing, or on `order(...)`
 *      choosing which row comes back, is measuring this file rather than the product. Where order
 *      matters — the latest document, the most recent conversation — pass one row.
 *   2. RLS IS NOT SIMULATED. Every read returns what `opts` declares, whoever is asking. A defect
 *      where the product reads a row it should not be allowed to see is INVISIBLE here, and that
 *      is exactly the class the claimed-owner write audit exists for.
 *   3. THE SHAPES ARE DECLARED, NOT DERIVED. Each RPC's return is hand-written to match the real
 *      one; when a migration changes a return shape, this file does not notice. `create_business_job`
 *      returning a TABLE (an array) rather than an object is the one that has already bitten.
 *   4. NO LATENCY, NO FAILURE, NO CONCURRENCY. Everything resolves immediately and succeeds unless
 *      a flag says otherwise, so a race the product has in production cannot appear here.
 *
 * None of these is a reason to distrust a green leg. They are the reasons to say what a green leg
 * is green ABOUT.
 */

/** Installed in the PAGE world. Serialised by Playwright, so it may not close over anything. */
export function installOwnerFake(opts) {
  const W = window;
  W.__rig = { rpc: [], writes: [], quotes: (opts.quotes || []).slice(),
    // THE PLACES ROWS ARE STATE, NOT A CONSTANT. add_business_place WRITES here and
    // get_public_business_places READS here, so a check can press "Yes, add it" and then ask
    // what the server would hand back — which is the only way the write and the read can be
    // shown to agree. A fixture where the writer cannot change what the reader returns proves
    // a click happened and nothing more.
    tables: {},
    places: (opts.places || [{ kind: "website", scope: "workspace", visible: true, sort_order: 10 }]).map((p) => Object.assign({}, p)) };
  // ══ LATENCY, WHEN THE CHECK IS ABOUT WHAT HAPPENS BEFORE THE ANSWER ═══════════════════════════
  //
  // Limit 4 says "no latency", and that limit cost a leg on 2026-09-17. The first-paint check needs
  // to see the state the shell is in WHILE the ownership question is outstanding; with every read
  // resolving in the same microtask, the pre-answer state was over before the first animation frame,
  // so a leg written to observe it recorded zero frames of it and went red at the product.
  //
  // `rpcDelayMs` is a DECLARED delay, not a sleep bolted onto a check — the fixture says how slow it
  // is, and the check's output can name the number. It is the one thing a check cannot supply from
  // outside: you cannot wait for a moment that has already passed.
  const delay = Math.max(0, Number(opts.rpcDelayMs || 0));
  const ok = (data) => (delay
    ? new Promise((r) => setTimeout(() => r({ data, error: null }), delay))
    : Promise.resolve({ data, error: null }));
  const q = (rows) => {
    let held = rows.slice();
    const t = {
      select: (_c, o) => (o && o.count ? Object.assign(t, { __count: true }) : t),
      in: () => t, gte: () => t, lte: () => t, order: () => t, limit: () => t,
      // `is` and `not` join the no-ops; `eq` is the only predicate the fake actually applies, and
      // that is stated rather than left to be discovered: a check whose fixture relies on gte/lte
      // narrowing is measuring the fake, not the product.
      is: () => t, not: () => t,
      eq: (c, v) => { held = held.filter((r) => String(r[c]) === String(v)); return t; },
      maybeSingle: () => ok(held[0] || null),
      single: () => ok(held[0] || null),
      then: (res, rej) => Promise.resolve(
        t.__count ? { data: null, count: held.length, error: null } : { data: held, error: null }
      ).then(res, rej),
    };
    return t;
  };
  const client = {
    auth: {
      getUser: () => ok({ user: { id: opts.uid, email: opts.email, user_metadata: opts.meta || {} } }),
      getSession: () => ok({ session: { access_token: opts.accessToken || "sim-access-token",
                                        expires_at: Math.floor(Date.now() / 1000) + 3600 } }),
      signOut: () => ok(null),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    // ══ TABLES THE PRODUCT INSERTS INTO, NOT JUST READS ════════════════════════════════════
    //
    // `from()` returned a read-only view over a declared array, so `.insert()` was `undefined` and
    // any code path that WRITES through PostgREST threw — which made conversation identity
    // (ask_hubly_conversations / ask_hubly_messages, both owner-RLS and written directly) untestable.
    // Writes land in W.__rig.tables so a check can read back what the product stored.
    from: (table) => {
      const held = (W.__rig.tables[table] = W.__rig.tables[table] || ((opts.tables || {})[table] || []).slice());
      const view = q(held);
      view.insert = (row) => {
        const rows = Array.isArray(row) ? row : [row];
        rows.forEach((r) => { held.push(Object.assign({ id: "row-" + (held.length + 1) }, r)); });
        W.__rig.writes.push({ name: "insert:" + table, args: rows });
        const made = held.slice(-rows.length);
        const res = { data: rows.length === 1 ? made[0] : made, error: null };
        const t2 = { select: () => t2, eq: () => t2, maybeSingle: () => Promise.resolve(res), single: () => Promise.resolve(res),
                     then: (ok, no) => Promise.resolve(res).then(ok, no) };
        return t2;
      };
      view.update = (patch) => {
        W.__rig.writes.push({ name: "update:" + table, args: patch });
        const t3 = { eq: (col, val) => { held.forEach((r) => { if (String(r[col]) === String(val)) Object.assign(r, patch); });
                                         return Promise.resolve({ data: null, error: null }); },
                     then: (ok, no) => Promise.resolve({ data: null, error: null }).then(ok, no) };
        return t3;
      };
      return view;
    },
    rpc: (name, args) => {
      W.__rig.rpc.push(name);
      // ══ A READER THAT DOES NOT ANSWER IS A STATE THE PRODUCT HAS TO HANDLE ═══════════════════
      //
      // Limit 4 in the header ("no latency, no failure, no concurrency") is why a whole class of
      // behaviour was untestable: everything here succeeded, so any branch the product has for "the
      // question could not be asked" was unreachable from a check. `failRpc: ["get_my_businesses"]`
      // makes one named reader reject the way a dropped connection does. Named, not global: a fake
      // where everything fails at once measures a page with no backend, which is a different thing.
      if ((opts.failRpc || []).indexOf(name) !== -1) {
        const err = new Error("simulated network failure calling " + name);
        return delay ? new Promise((_, rej) => setTimeout(() => rej(err), delay)) : Promise.reject(err);
      }
      const tables = opts.tables || {};
      if (name === "get_owner_profile") {
        return ok([{ display_name: opts.displayName ?? null,
                     name_source: opts.displayName ? "owner" : "unknown",
                     welcomed_at: opts.welcomedAt ?? "2026-09-14T22:01:24Z" }]);
      }
      if (name === "mark_owner_welcomed") return ok(new Date().toISOString());
      if (name === "get_business_customers") return ok(tables.customers || []);
      if (name === "get_business_customer_count") return ok((tables.customers || []).length);
      if (name === "get_business_hours") return ok(opts.hours || []);
      if (name === "get_business_tasks") return ok((tables.tasks || []).slice());
      // THE UNION SERVICES READER. Shaped exactly as the RPC returns it — name + price in DOLLARS
      // (the relational table's unit) plus `source` and `conflicts` — so a check exercising the quoter
      // is exercising the conversion too, which is where a units bug would live.
      if (name === "get_business_services") return ok(tables.services || []);
      if (name === "create_quote") {
        W.__rig.writes.push({ name, args });
        const money = (lines, kind, val) => {
          const sub = (lines || []).reduce((a, l) => a + (Number(l.unit_cents) || 0) * (Number(l.qty) || 1), 0);
          let d = 0;
          if (kind === "pct" && val > 0) d = Math.min(Math.round(sub * Math.min(val, 100) / 100), sub);
          if (kind === "flat" && val > 0) d = Math.min(Math.round(val * 100), sub);
          return { subtotal_cents: sub, discount_cents: d, total_cents: sub - d };
        };
        const m = money(args.p_lines, args.p_discount_kind, args.p_discount_value);
        const id = "q-" + (W.__rig.quotes.length + 1);
        W.__rig.quotes.push(Object.assign({ id, status: "draft", lines: args.p_lines,
          customer_name: args.p_customer_name, discount_kind: args.p_discount_kind,
          discount_value: args.p_discount_value, discount_words: args.p_discount_words }, m));
        return ok(Object.assign({ ok: true, id, status: "draft", lines: args.p_lines }, m));
      }
      if (name === "get_business_quotes") return ok(W.__rig.quotes.slice());
      if (name === "set_quote_status") { W.__rig.writes.push({ name, args }); return ok({ ok: true, status: args.p_status }); }
      if (name === "accept_quote") {
        W.__rig.writes.push({ name, args });
        const q = W.__rig.quotes.filter((x) => x.id === args.p_quote_id)[0];
        if (!q) return ok({ ok: false, error: "not_owner" });
        if (q.status === "accepted") return ok({ ok: false, error: "already_accepted", job_id: q.became_job_id || null });
        return ok({ ok: true, job_id: "job-from-" + q.id, became: "job",
                    service_name: (q.lines || []).map((l) => l.name).join(" + "),
                    amount_cents: q.total_cents, customer_name: q.customer_name });
      }
      // create_business_job returns a TABLE, so the client sees an ARRAY with one row — and the row
      // echoes what was written plus the new id, which is what the reply is composed from. Shaped as
      // the real RPC returns it (20260914200000_create_business_job.sql) rather than as a bare object:
      // a fake that returns the wrong SHAPE makes a correct client look broken.
      if (name === "create_business_job") {
        W.__rig.writes.push({ name, args });
        const j = (args && args.p_job) || {};
        return ok([{ id: "job-" + (W.__rig.jobsMade = (W.__rig.jobsMade || 0) + 1),
                     customer_name: j.customer_name ?? null, service_name: j.service_name ?? null,
                     scheduled_date: j.scheduled_date ?? null, scheduled_time: j.scheduled_time ?? null,
                     address: j.address ?? null, phone: j.phone ?? null,
                     amount: j.amount ?? null, notes: j.notes ?? null,
                     status: "scheduled", error: null }]);
      }
      // MUTABLE ON PURPOSE. A check that asks "does this arrive without a refresh" has to be
      // able to make the server's answer CHANGE between two reads — a fixed array can only ever
      // prove that a reload renders what was always there.
      if (name === "get_business_events") {
        if (!W.__rig.events) W.__rig.events = (tables.events || []).slice();
        return ok(W.__rig.events.map((e) => Object.assign({}, e)));
      }
      // SEEN IS A REAL WRITE, SO THE FAKE HONOURS IT. Without this, `is_new` stayed true for
      // everything he had already been shown and any count of "things he has not seen" was the
      // count of things that exist — which is the one number that must never be wrong on a badge.
      if (name === "mark_business_events_seen") {
        W.__rig.writes.push({ name, args });
        const upto = new Date(String((args && args.p_seen_at) || 0)).getTime();
        (W.__rig.events || []).forEach((e) => {
          if (!isFinite(upto) || new Date(String(e.occurred_at)).getTime() <= upto) e.is_new = false;
        });
        return ok(true);
      }
      if (name === "get_public_business") return ok([{ brand_color: null, city: null, state: null, meta: null }]);
      // THE PLACES ROWS MATTER MORE THAN THEY LOOK. Returning [] leaves hc.places null, which
      // makes hcWorkspaces() fail open and treat every place as earned. Default to the shape a
      // real account actually has — ONE row — so a check measures the world owners live in.
      if (name === "get_public_business_places") {
        return ok(W.__rig.places.map((p) => Object.assign({}, p)));
      }
      // ══ THE PLACE WRITER, SHAPED LIKE THE REAL ONE ══════════════════════════════════════
      //
      // 20260908030000_add_business_place.sql returns WHICH OF THREE THINGS HAPPENED, and the
      // caller composes its sentence from that — so a fake that always answered {ok:true} would
      // let a client that never distinguishes them look correct. It also refuses without a
      // credential and refuses for the wrong owner, because "the write went out" and "the write
      // was allowed" are different facts and only the second one earns a tab.
      //
      // NOT MODELLED, AND SAID SO: the real function also rejects an unknown kind or scope with
      // a check_violation. Nothing here exercises that, so nothing here should be read as proof
      // of it.
      if (name === "add_business_place") {
        W.__rig.writes.push({ name, args });
        // A DECLARED REFUSAL. "Yes, add it" failing is a real state — the write is authorised
        // server-side and can say no — and a check that can only ever see the happy path is
        // half a check. Shaped as the real function's refusal, not as a thrown error.
        if (opts.refuseAddPlace) return ok({ ok: false, error: "not_owner" });
        const a = args || {};
        if (!a.p_id || !a.p_owner_id) return ok({ ok: false, error: "missing_credential" });
        if (String(a.p_owner_id) !== String(opts.uid)) return ok({ ok: false, error: "not_owner" });
        const rows = W.__rig.places;
        const hit = rows.filter((r) => r.kind === a.p_kind && r.scope === a.p_scope)[0];
        if (hit && hit.visible !== false) return ok({ ok: true, outcome: "already", kind: a.p_kind, scope: a.p_scope });
        if (hit) { hit.visible = true; return ok({ ok: true, outcome: "re-enabled", kind: a.p_kind, scope: a.p_scope }); }
        const next = rows.filter((r) => r.scope === a.p_scope)
                         .reduce((m, r) => Math.max(m, Number(r.sort_order) || 0), 0) + 10;
        rows.push({ kind: a.p_kind, scope: a.p_scope, visible: true, sort_order: next, config: null });
        return ok({ ok: true, outcome: "created", kind: a.p_kind, scope: a.p_scope });
      }
      // ══ create_task WRITES, AND THE PRODUCT READS IT BACK ═══════════════════════════════════
      //
      // This returned `{ id: null }`, so hcAddDayTask's read-back — "the writer telling us what it
      // wrote is the writer's word; the table is the record" — could never find the row and every
      // successful write was reported as `not_readable_back`. A fixture that cannot satisfy the
      // product's own postcondition makes correct code look broken, which is how the photo-import
      // check first reported two written tasks as two failures.
      if (name === "create_task") {
        W.__rig.writes.push({ name, args });
        const a = args || {};
        const row = { id: "task-" + ((W.__rig.tasksMade = (W.__rig.tasksMade || 0) + 1)),
                      title: a.p_title ?? null, due_date: a.p_due_date ?? null, due_time: a.p_due_time ?? null,
                      band: a.p_band ?? null, band_source: "owner", band_reason: a.p_band_reason ?? null,
                      lane: a.p_lane ?? "work", status: "open", roll_count: 0, notes: a.p_notes ?? null };
        (tables.tasks = tables.tasks || []).push(row);
        return ok(row);
      }
      if (name === "update_business_job") { W.__rig.writes.push({ name, args }); return ok([{ id: null, error: null }]); }
      // ══ WHICH BUSINESSES THIS ACCOUNT OWNS — the reader the whole shell boots from ═══════════
      //
      // hcLoadOwnedBusiness() calls this first on every load, and until now it fell through to
      // `ok(null)`, i.e. "owns none". Checks that wanted a signed-in owner had to reach past the
      // boot path and call hcOpenOwnedBusiness() themselves, which skips the very decision under
      // test. Declaring it here means the fake can express BOTH honest answers: owns one (the app
      // opens) and owns none (a browser holding a session for an account with nothing in it).
      //
      // Default is [] — the same "owns none" the fallthrough already produced, so no existing
      // check changes behaviour.
      if (name === "get_my_businesses") return ok((opts.businesses || []).map((b) => Object.assign({}, b)));
      return ok(null);
    },
    // ══ THE SOCKET IS A REAL PATH INTO THE APP, SO THE FAKE KEEPS ITS HANDLERS ═══════════
    //
    // This returned a stub that swallowed every `.on(...)`, which made "does a booking reach
    // him without a refresh" unanswerable: the check could only call the app's own handler,
    // and calling a handler is not the arrival of an event. The handlers are recorded now, so
    // a check can deliver a postgres_changes payload the way Realtime would and watch what the
    // product does with it. Still simulated — nothing here proves the DB publishes the row.
    channel: (name) => {
      const entry = { name, handlers: [], subscribed: false };
      W.__rig.channels = W.__rig.channels || [];
      W.__rig.channels.push(entry);
      const ch = {
        on: (kind, opts, cb) => { entry.handlers.push({ kind, opts, cb }); return ch; },
        subscribe: () => { entry.subscribed = true; return ch; },
        unsubscribe: () => { entry.subscribed = false; return ch; },
      };
      return ch;
    },
    removeChannel: () => {},
  };
  // ══ THE FAKE MUST STILL BE THE FAKE WHEN WE MEASURE ══════════════════════════════════
  //
  // 2026-09-16: the real supabase-js arrives from the CDN as a DEFERRED script, so it runs
  // AFTER anything installed via page.addInitScript and OVERWRITES window.supabase. Every read
  // then failed with "supabaseKey is required", and the planner correctly rendered its
  // unreadiness message — so the room LOOKED like it was working while the success path was
  // never once exercised. A whole measurement reported off a broken app.
  //
  // Installing after load avoids it (authGetClient polls for window.supabase.createClient), and
  // every shipped check already does. But "already does" is a fact about today, so the fake now
  // SAYS whether it is still the one in place, and a check can refuse to run rather than measure
  // an app whose backend is a stranger. Leg-0 discipline, applied to the harness itself.
  const marker = "rig-" + Math.random().toString(36).slice(2, 10);
  const factory = () => { W.__rig.clientHandouts = (W.__rig.clientHandouts || 0) + 1; return client; };
  factory.__rigMarker = marker;
  W.supabase = { createClient: factory };
  W.__rigFake = {
    marker,
    /** Is OUR createClient still the one the page would get? */
    intact: () => !!(W.supabase && W.supabase.createClient && W.supabase.createClient.__rigMarker === marker),
    /** Did the page actually take a client from us? A fake nobody asked for proves nothing. */
    used: () => (W.__rig.clientHandouts || 0) > 0,
    rpcCount: () => (W.__rig.rpc || []).length,
  };
  try {
    localStorage.setItem("sb-rtwxxkxpkqdrhclkozma-auth-token",
      JSON.stringify({ access_token: "sim", expires_at: Math.floor(Date.now() / 1000) + 3600 }));
  } catch (_) {}
  // ══ EDGE CALLS ARE PART OF THE DECLARED BACKEND TOO ═════════════════════════════════════
  //
  // A blanket stub returning `null` made every edge-function door unanswerable: the control could
  // be pressed and what it SENT — which endpoint, which id, whose token — went nowhere a check
  // could read. Every request is recorded, and `opts.edge` declares the answers by endpoint name.
  // Anything not declared still gets the old empty answer, so nothing that used to pass changes.
  W.__rig.fetches = [];
  W.fetch = (url, init) => {
    const u = String(url || "");
    const name = (u.match(/\/functions\/v1\/([A-Za-z0-9_-]+)/) || [])[1] || null;
    let body = null;
    try { body = init && init.body ? JSON.parse(String(init.body)) : null; } catch (_) { body = String((init || {}).body || ""); }
    const auth = String(((init || {}).headers || {}).authorization || "");
    W.__rig.fetches.push({ url: u, fn: name, body, auth,
      // WHOSE TOKEN, without the token reaching a transcript. A check asserting "the owner's own
      // JWT, not the anon key" needs to know which it was, never what it said.
      authKind: auth ? (auth.indexOf(opts.accessToken || "sim-access-token") >= 0 ? "owner-jwt"
                       : (auth.indexOf("anon") >= 0 ? "anon-key" : "other")) : "none" });
    const declared = (opts.edge || {})[name];
    const answer = typeof declared === "function" ? declared(body) : declared;
    if (answer === undefined) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(null), text: () => Promise.resolve("") });
    }
    const status = (answer && answer.__status) || 200;
    return Promise.resolve({ ok: status >= 200 && status < 300, status,
      json: () => Promise.resolve(answer), text: () => Promise.resolve(JSON.stringify(answer)) });
  };
}

/**
 * EVERY WORD THAT BROKE, EVERY BOX THAT CLIPPED — measured as GEOMETRY, never as presence.
 *
 * Adrian, 2026-09-15: "the check my sales edit my website things on this view are too squeezed
 * … we should not have squeezed things like that, it doesn't look good." And the standing rule:
 * nothing in Hubly renders squeezed, at any width a surface can actually reach.
 *
 * An assertion that the label is PRESENT passes happily on "Chec k my sales" — the string is
 * still there, it is the RENDERING that is broken. So this walks text nodes, puts a Range around
 * each WORD, and asks the browser where that word actually is. A word whose rects sit on two
 * different lines was broken mid-word. Nothing here reads CSS or guesses at wrapping.
 */
/** ONE LINE A CHECK CAN CALL BEFORE IT BELIEVES ANYTHING IT MEASURED.
 *
 *  Returns null when all is well, or a sentence saying what is wrong. A check that ignores this
 *  is measuring an app whose backend may be a stranger — which is exactly how a room that could
 *  not read anything was mistaken for a room that worked. */
export function fakeIntact() {
  const F = window.__rigFake;
  if (!F) return "the owner fake was never installed on this page";
  if (!F.intact()) return "the owner fake was REPLACED after installation — the real supabase-js " +
    "loads deferred from the CDN and overwrites window.supabase, so every read failed and the app " +
    "rendered its unreadiness paths. Install the fake AFTER load.";
  if (!F.used()) return "the fake is intact but the page never took a client from it — nothing " +
    "measured here went through the declared backend";
  return null;
}

export function squeezeProbe() {
  const out = { brokenWords: [], clipped: [], overflowing: [] };
  const seen = new Set();
  const vis = (el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const label = (el) => {
    const id = el.id ? "#" + el.id : "";
    const cls = (el.className && typeof el.className === "string") ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    return el.tagName.toLowerCase() + id + cls;
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const txt = n.nodeValue;
    if (!txt || !txt.trim()) continue;
    const el = n.parentElement;
    if (!el || !vis(el)) continue;
    if (el.closest("script,style,noscript")) continue;
    // WORD BY WORD. A word is a run of non-space; its rects tell us where it landed.
    const re = /\S+/g;
    let m;
    while ((m = re.exec(txt))) {
      const word = m[0];
      if (word.length < 2) continue;
      // A hyphenated or slashed token may legitimately break at its separator.
      if (/[-–—/]/.test(word)) continue;
      const r = document.createRange();
      r.setStart(n, m.index);
      r.setEnd(n, m.index + word.length);
      const rects = [...r.getClientRects()].filter((x) => x.width > 0.5 && x.height > 0.5);
      if (rects.length > 1) {
        const tops = new Set(rects.map((x) => Math.round(x.top)));
        if (tops.size > 1) {
          const key = label(el) + "|" + word;
          if (!seen.has(key)) { seen.add(key); out.brokenWords.push({ where: label(el), word, text: txt.trim().slice(0, 70) }); }
        }
      }
    }
  }
  // CLIPPED: content wider or taller than its box, with the overflow hidden so it is simply gone.
  document.querySelectorAll("body *").forEach((el) => {
    if (!vis(el)) return;
    if (el.closest("script,style,noscript")) return;
    const s = getComputedStyle(el);
    const hidesX = s.overflowX === "hidden" || s.overflow === "hidden";
    const hidesY = s.overflowY === "hidden" || s.overflow === "hidden";
    const overX = el.scrollWidth - el.clientWidth > 1;
    const overY = el.scrollHeight - el.clientHeight > 1;
    if ((hidesX && overX) || (hidesY && overY)) {
      const key = "clip|" + label(el);
      if (!seen.has(key)) {
        seen.add(key);
        out.clipped.push({ where: label(el), over: (overX ? el.scrollWidth - el.clientWidth : 0) + "x" + (overY ? el.scrollHeight - el.clientHeight : 0),
                           text: (el.innerText || "").trim().slice(0, 60) });
      }
    }
  });
  return out;
}
