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
  W.__rig = { rpc: [], writes: [] };
  const ok = (data) => Promise.resolve({ data, error: null });
  const q = (rows) => {
    let held = rows.slice();
    const t = {
      select: (_c, o) => (o && o.count ? Object.assign(t, { __count: true }) : t),
      in: () => t, gte: () => t, lte: () => t, order: () => t, limit: () => t,
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
  W.supabase = { createClient: () => client };
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
