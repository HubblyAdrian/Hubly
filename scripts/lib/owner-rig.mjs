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
 */

/** Installed in the PAGE world. Serialised by Playwright, so it may not close over anything. */
export function installOwnerFake(opts) {
  const W = window;
  W.__rig = { rpc: [], writes: [], quotes: [] };
  const ok = (data) => Promise.resolve({ data, error: null });
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
      getSession: () => ok({ session: { access_token: "sim", expires_at: Math.floor(Date.now() / 1000) + 3600 } }),
      signOut: () => ok(null),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: (table) => q((opts.tables || {})[table] || []),
    rpc: (name, args) => {
      W.__rig.rpc.push(name);
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
      if (name === "get_business_tasks") return ok(tables.tasks || []);
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
      if (name === "get_business_events") return ok(tables.events || []);
      if (name === "get_public_business") return ok([{ brand_color: null, city: null, state: null, meta: null }]);
      // THE PLACES ROWS MATTER MORE THAN THEY LOOK. Returning [] leaves hc.places null, which
      // makes hcWorkspaces() fail open and treat every place as earned. Default to the shape a
      // real account actually has — ONE row — so a check measures the world owners live in.
      if (name === "get_public_business_places") {
        return ok(opts.places || [{ kind: "website", scope: "workspace", visible: true, sort_order: 10 }]);
      }
      if (name === "update_business_job" || name === "create_task") { W.__rig.writes.push({ name, args }); return ok([{ id: null, error: null }]); }
      return ok(null);
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
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
  W.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(null), text: () => Promise.resolve("") });
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
