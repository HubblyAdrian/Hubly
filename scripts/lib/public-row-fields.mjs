/** ══ WHICH FIELDS OF THE PUBLIC BUSINESS ROW DOES A SHELL ACTUALLY READ? ══════════════════════
 *
 * Derived by PARSING the shell (acorn, a real dependency of this repo) and resolving identifiers
 * through real scopes — not by grepping, and not by following variable NAMES across a 3MB file.
 *
 * ══ WHY THE CHEAP VERSIONS ALL FAILED, IN ORDER ══════════════════════════════════════════════
 *
 * This derivation is the one that produced the seven-field regression, and it has now been wrong
 * four different ways. Each is recorded because each is a different lesson:
 *
 *   1. FILE-WIDE GREP for `\.field` -> 80 fields. Every property access in 3MB of unrelated code.
 *   2. FUNCTION-SCOPED grep -> 4 fields. It lost `let {data,error} = ...` entirely, because the
 *      pattern it knew was `var x = ...`. A derivation that silently drops a binding SHAPE reports
 *      a small confident answer, which is the dangerous kind.
 *   3. A 60-LINE WINDOW after the call -> missed a ~180-line unpack. THIS is the one that shipped:
 *      seven fields were dropped from the reader's allowlist and the regression went live.
 *   4. NAME-BASED FLOW ANALYSIS (the closure this replaced) -> 205 "fields", most of them not
 *      fields at all. `data` is bound in hundreds of unrelated places in hubly.html, so tracking
 *      the NAME `data` file-wide taints every one of them; `var city = data.city` then made `city`
 *      a row, and `el.textContent = data` made `textContent` one. It failed LOUDLY (far too many)
 *      rather than quietly, which is the only good thing about it.
 *
 * The common shape of all four: the instrument answered a question about SCOPE using a tool that
 * has no concept of scope. So this one resolves every identifier to its declaring scope, and a
 * name only carries the row where it actually holds the row.
 *
 * ══ WHAT IT DOES ═════════════════════════════════════════════════════════════════════════════
 *
 *   seed        every `rpc('get_public_business', ...)` call; the ROW is the result's `.data`
 *               (through `.single()`, `await`, a destructure, or an `Array.isArray(...)?[0]:` )
 *   propagate   to a fixpoint over: aliasing (`X = ROW`), unwrapping (`ROW.data`, `ROW[0]`),
 *               assignment to an OUTER-scope binding (this is how `currentBusiness` gets the row),
 *               and ARGUMENTS passed to a named function (so a renderer taking `biz` is covered)
 *   collect     every member read on a tainted binding -> the field name
 *
 * ══ WHAT IT CANNOT SEE — STATED, BECAUSE A DERIVATION'S BLIND SPOTS ARE PART OF ITS RESULT ═══
 *
 *   · a field reached by a COMPUTED key (`row[k]`). Reported separately as `computed`, never
 *     silently ignored: if a shell reads the row by computed key, the answer is incomplete and
 *     the caller must be told rather than reassured.
 *   · a field read after the row crosses postMessage, JSON.stringify/parse, or a template string.
 *   · meta's SUBKEYS. `meta` is one field here; its 56-subtree allowlist is a second derivation
 *     and is NOT attempted — an unattempted half is honest, a half-attempted one is not.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const acorn = createRequire(import.meta.url)("acorn");

/** Inline <script> bodies. A `</script>` can appear inside a string literal, so the end is found
 *  by trying each candidate and keeping the first that PARSES — never the first that matches. */
export function scriptBodies(html) {
  const out = [];
  const open = /<script(?![^>]*\bsrc=)[^>]*>/gi;
  let m;
  while ((m = open.exec(html))) {
    const start = m.index + m[0].length;
    let from = start, body = null, end = -1;
    for (;;) {
      const close = html.indexOf("</script", from);
      if (close < 0) break;
      const cand = html.slice(start, close);
      try { acorn.parse(cand, { ecmaVersion: "latest", allowReturnOutsideFunction: true }); body = cand; end = close; break; }
      catch { from = close + 8; }
    }
    if (body !== null) { out.push({ code: body, start }); open.lastIndex = end; }
  }
  return out;
}

const FN = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);
const walk = (node, visit, parent = null) => {
  if (!node || typeof node.type !== "string") return;
  visit(node, parent);
  for (const k of Object.keys(node)) {
    if (k === "type" || k === "start" || k === "end" || k === "__scope") continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === "string" && walk(c, visit, node));
    else if (v && typeof v.type === "string") walk(v, visit, node);
  }
};

/** Scopes, function-granular. `let` in a block is treated as function-scoped, which can only
 *  MERGE two same-named bindings inside one function — it never leaks a name between functions,
 *  and leaking between functions is the error that mattered. */
function scopeTree(ast, shared) {
  const scopes = new Map();          // node -> {parent, names:Map(name -> binding), node}
  const mk = (node, parent) => { const s = { parent, names: new Map(), node }; scopes.set(node, s); return s; };
  // ══ THE ROOT OF A CLASSIC SCRIPT BLOCK *IS* THE GLOBAL SCOPE ══════════════════════════════
  //
  // Both shells are one program split across several <script> blocks. `var currentBusiness = null`
  // is in one block and `currentBusiness = data` is in another, ~4500 lines later. Giving each
  // block its own root made that assignment resolve to NOTHING — and the analyzer then reported
  // one tainted binding and 26 fields without a word about the name it had failed to resolve.
  // Silence, presented as an answer, in the instrument written to stop exactly that. So the root
  // is SHARED, which is also simply what the runtime does.
  const root = shared || mk(ast, null);
  if (shared) scopes.set(ast, shared);
  const fnOf = new Map([[ast, root]]);
  const declare = (scope, name) => { if (!scope.names.has(name)) scope.names.set(name, { name, scope, tainted: false, fields: new Map(), computed: 0 }); return scope.names.get(name); };
  const patNames = (p, acc = []) => {
    if (!p) return acc;
    if (p.type === "Identifier") acc.push(p.name);
    else if (p.type === "ObjectPattern") p.properties.forEach((pr) => patNames(pr.value || pr.argument, acc));
    else if (p.type === "ArrayPattern") p.elements.forEach((e) => patNames(e, acc));
    else if (p.type === "AssignmentPattern") patNames(p.left, acc);
    else if (p.type === "RestElement") patNames(p.argument, acc);
    return acc;
  };
  // pass 1: build scopes and declarations
  const stack = [root];
  const enter = (node) => { const s = mk(node, stack[stack.length - 1]); fnOf.set(node, s); return s; };
  (function rec(node, parent) {
    if (!node || typeof node.type !== "string") return;
    let mine = null;
    if (FN.has(node.type)) {
      if (node.type === "FunctionDeclaration" && node.id) declare(stack[stack.length - 1], node.id.name);
      mine = enter(node); stack.push(mine);
      node.params.forEach((p) => patNames(p).forEach((n) => declare(mine, n)));
      if (node.id && node.type !== "FunctionDeclaration") declare(mine, node.id.name);
    }
    if (node.type === "VariableDeclaration") node.declarations.forEach((d) => patNames(d.id).forEach((n) => declare(stack[stack.length - 1], n)));
    if (node.type === "CatchClause" && node.param) patNames(node.param).forEach((n) => declare(stack[stack.length - 1], n));
    for (const k of Object.keys(node)) {
      if (k === "type" || k === "start" || k === "end") continue;
      const v = node[k];
      if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === "string" && rec(c, node));
      else if (v && typeof v.type === "string") rec(v, node);
    }
    if (mine) stack.pop();
  })(ast, null);
  return { scopes, root, fnOf, declare, patNames };
}

/** The nearest enclosing scope for a node — computed by walking down and remembering. */
function scopeIndex(ast, T) {
  const at = new Map();
  (function rec(node, cur) {
    if (!node || typeof node.type !== "string") return;
    const s = FN.has(node.type) ? T.fnOf.get(node) || cur : cur;
    at.set(node, s);
    for (const k of Object.keys(node)) {
      if (k === "type" || k === "start" || k === "end") continue;
      const v = node[k];
      if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === "string" && rec(c, s));
      else if (v && typeof v.type === "string") rec(v, s);
    }
  })(ast, T.root);
  return at;
}
const resolve = (scope, name) => { for (let s = scope; s; s = s.parent) if (s.names.has(name)) return s.names.get(name); return null; };

const isRpcCall = (n) => n && n.type === "CallExpression" && n.callee.type === "MemberExpression" &&
  n.callee.property.name === "rpc" && n.arguments[0] &&
  n.arguments[0].type === "Literal" && n.arguments[0].value === "get_public_business";

/** Is this expression the ROW (or something that unwraps to it)? */
function rowish(node, at, seedCalls) {
  if (!node) return false;
  if (node.type === "AwaitExpression") return rowish(node.argument, at, seedCalls);
  if (node.type === "LogicalExpression") return rowish(node.left, at, seedCalls) || rowish(node.right, at, seedCalls);
  if (node.type === "ConditionalExpression") return rowish(node.consequent, at, seedCalls) || rowish(node.alternate, at, seedCalls);
  if (node.type === "Identifier") { const b = resolve(at.get(node), node.name); return !!(b && b.tainted); }
  if (node.type === "MemberExpression") {
    if (!node.computed && node.property.name === "data") return rowish(node.object, at, seedCalls) || resultish(node.object, at, seedCalls);
    if (node.computed && node.property.type === "Literal" && node.property.value === 0) return rowish(node.object, at, seedCalls);
    return false;
  }
  return false;
}
/** Is this the rpc RESULT (whose `.data` is the row)? */
function resultish(node, at, seedCalls) {
  if (!node) return false;
  if (node.type === "AwaitExpression") return resultish(node.argument, at, seedCalls);
  if (node.type === "CallExpression") {
    if (seedCalls.has(node)) return true;
    // `.single()` / `.maybeSingle()` chained onto the seed
    if (node.callee.type === "MemberExpression" && /^(single|maybeSingle)$/.test(node.callee.property.name || "")) return resultish(node.callee.object, at, seedCalls);
    return false;
  }
  if (node.type === "Identifier") { const b = resolve(at.get(node), node.name); return !!(b && b.result); }
  if (node.type === "LogicalExpression") return resultish(node.left, at, seedCalls) || resultish(node.right, at, seedCalls);
  return false;
}

export function publicRowFields(html) {
  const notes = [], fields = new Map(), tainted = new Set();
  let computed = 0, seeds = 0, unresolved = 0;
  const GLOBAL = { parent: null, names: new Map(), node: null };
  const fnByName = new Map();
  const units = [];
  for (const { code } of scriptBodies(html)) {
    let ast; try { ast = acorn.parse(code, { ecmaVersion: "latest", allowReturnOutsideFunction: true }); } catch { continue; }
    const T = scopeTree(ast, GLOBAL), at = scopeIndex(ast, T);
    const seedCalls = new Set();
    walk(ast, (n) => { if (isRpcCall(n)) { seedCalls.add(n); seeds++; notes.push(`rpc('get_public_business') at script-line ${code.slice(0, n.start).split("\n").length}`); } });
    walk(ast, (n) => { if (n.type === "FunctionDeclaration" && n.id && !fnByName.has(n.id.name)) fnByName.set(n.id.name, { fn: n, T }); });
    units.push({ ast, T, at, seedCalls, code });
  }
  if (!seeds) return { fields, notes, computed, seeds, sinks: 0, unresolved };

  const taint = (b, why) => { if (b && !b.tainted) { b.tainted = true; tainted.add(b); notes.push(`  row flows into \`${b.name}\` (${why})`); return true; } return false; };
  const markResult = (b) => { if (b && !b.result) { b.result = true; return true; } return false; };
  // An assignment to a name nothing declares is an implicit global at runtime, so it gets a
  // global binding rather than being dropped. Dropping it is how the row went invisible once.
  const bindFor = (scope, name) => {
    const found = resolve(scope, name);
    if (found) return found;
    unresolved++;
    if (!GLOBAL.names.has(name)) GLOBAL.names.set(name, { name, scope: GLOBAL, tainted: false, implicit: true });
    return GLOBAL.names.get(name);
  };

  for (let pass = 0; pass < 24; pass++) {
    let grew = false;
    for (const u of units) {
      const { ast, at, seedCalls, T } = u;
      walk(ast, (n) => {
        if (n.type === "VariableDeclarator") {
          if (n.id.type === "Identifier") {
            if (rowish(n.init, at, seedCalls)) grew = taint(bindFor(at.get(n.id), n.id.name), "declared from the row") || grew;
            else if (resultish(n.init, at, seedCalls)) grew = markResult(bindFor(at.get(n.id), n.id.name)) || grew;
          } else if (n.id.type === "ObjectPattern" && resultish(n.init, at, seedCalls)) {
            for (const p of n.id.properties)
              if (p.key && p.key.name === "data" && p.value && p.value.type === "Identifier")
                grew = taint(bindFor(at.get(p.value), p.value.name), "destructured `data` off the result") || grew;
          }
        }
        if (n.type === "AssignmentExpression" && n.left.type === "Identifier") {
          if (rowish(n.right, at, seedCalls)) grew = taint(bindFor(at.get(n.left), n.left.name), "assigned the row") || grew;
          else if (resultish(n.right, at, seedCalls)) grew = markResult(bindFor(at.get(n.left), n.left.name)) || grew;
        }
        if (n.type === "CallExpression" && n.callee.type === "Identifier") {
          const hit = fnByName.get(n.callee.name);
          if (hit) n.arguments.forEach((a, i) => {
            const p = hit.fn.params[i];
            if (p && p.type === "Identifier" && rowish(a, at, seedCalls))
              grew = taint(resolve(hit.T.fnOf.get(hit.fn), p.name), `passed to ${n.callee.name}() as \`${p.name}\``) || grew;
          });
        }
      });
    }
    if (!grew) break;
  }

  for (const u of units) walk(u.ast, (n) => {
    if (n.type !== "MemberExpression") return;
    if (!rowish(n.object, u.at, u.seedCalls)) return;
    if (n.computed) {
      if (n.property.type === "Literal" && typeof n.property.value === "string") {
        if (!fields.has(n.property.value)) fields.set(n.property.value, new Set());
        fields.get(n.property.value).add("computed-literal");
      } else computed++;
      return;
    }
    const k = n.property.name;
    if (k === "data" || typeof k !== "string") return;   // the unwrap itself, not a field
    if (!fields.has(k)) fields.set(k, new Set());
    fields.get(k).add("read");
  });
  return { fields, notes, computed, seeds, sinks: tainted.size, unresolved };
}

export function readShell(path) { return publicRowFields(readFileSync(path, "utf8")); }

/** The reader's returned top-level keys, parsed out of the SHIPPING migration. */
export function allowlistFromMigration(sql) {
  const body = sql.slice(sql.indexOf("jsonb_build_object"));
  const cols = [...body.matchAll(/'([a-z_]+)',\s*b\.[a-z_]+/g)].map((m) => m[1]);
  const hasMeta = /jsonb_build_object\(\s*'meta'/.test(body);
  return { cols: new Set(hasMeta ? cols.concat("meta") : cols), declaredMeta: hasMeta };
}
