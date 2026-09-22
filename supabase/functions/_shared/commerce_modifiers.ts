/**
 * Commerce modifiers — ONE resolver, and every writer calls it.
 *
 * ══ WHY THIS IS A MODULE AND NOT TWO BLOCKS OF CODE ═════════════════════════════════════════
 *
 * Hubly has two carts. In Phase 1E the persisted one was found dropping `variant_id` and pricing
 * from the base product while the guest one had always been right — one rule, two writers, and the
 * quiet one was wrong for months. Modifiers arrive with the same two writers
 * (`commerce-api` POST /cart and `commerce_checkout.computeAuthoritativeOrder`) plus a third
 * reader (the storefront), so the rule is written ONCE, here, and both writers call it. A second
 * copy of this logic is the defect, not a convenience.
 *
 * ══ WHAT THE CLIENT MAY SAY ═════════════════════════════════════════════════════════════════
 *
 * An array of `commerce_modifier_options.id`. That is all. No name, no price, no group, no total.
 * Everything else is reloaded from the database here. A client that sends `{name:"Bacon",
 * price:99900}` is sending an object this module will refuse to read.
 *
 * ══ CANONICAL FORM, AND WHY SORTING IS THE WHOLE POINT ══════════════════════════════════════
 *
 * {bacon, mushroom} and {mushroom, bacon} are the SAME configuration and must produce the same
 * cart line. So the selection is deduplicated and sorted before anything else happens, and the
 * canonical array is what gets stored and what the client's own line key is built from. Array
 * order is never identity. A repeated id is the same choice made twice, so it collapses to one —
 * deterministically, which is what matters, rather than being an error the customer cannot act on.
 *
 * ══ EVERY REFUSAL IS ITS OWN SENTENCE ═══════════════════════════════════════════════════════
 *
 * Prohibition 3: a step asserts its postcondition or fails, and every distinct failure gets a
 * distinct message. An invalid selection is NEVER dropped and the line NEVER falls back to the
 * base product — a silently-removed topping is a customer charged for something else than what
 * they chose.
 *
 * ══ AN ARCHIVED GROUP CANNOT BLOCK A SALE ═══════════════════════════════════════════════════
 *
 * `min_select` is enforced over ACTIVE groups only. An owner who archives a required group must
 * not thereby make every product it was attached to unpurchasable — archiving is how a group is
 * retired, and a retirement that breaks checkout would be discovered by a customer.
 *
 * Nothing here knows what trade the business is in. A topping, a wax, a gift wrap and a rush fee
 * are the same object.
 */

// deno-lint-ignore no-explicit-any
type Admin = any;

/** One selection, frozen for the order line. Ids for traceability; names and money for history. */
export type ModifierSnapshotEntry = {
  group_id: string;
  group_name: string;
  option_id: string;
  option_name: string;
  price_adjustment_cents: number;
};

export type ModifierResolution =
  | {
    ok: true;
    /** Deduplicated, sorted option ids — the canonical form. Store THIS, never the raw input. */
    option_ids: string[];
    /** Frozen snapshot, ordered by group sort_order then option sort_order. */
    snapshot: ModifierSnapshotEntry[];
    /** Sum of the real price_adjustment_cents. Signed. */
    adjustment_cents: number;
  }
  | { ok: false; error: string; detail?: string };

/** A selection carrying more entries than this is malformed, not a choice. */
const MAX_RAW_SELECTIONS = 100;

/**
 * Deduplicate and sort. THE canonical form, exported because the cart line key and the storefront
 * must build the identical string or two representations of one line will disagree.
 * Non-strings and blanks are dropped here — `resolveProductModifiers` refuses them first, so by
 * the time this runs the input has already been judged.
 */
export function canonicalModifierIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const v of raw) {
    const s = typeof v === "string" ? v.trim() : "";
    if (s) seen.add(s);
  }
  return [...seen].sort();
}

/** The line-identity fragment. Shared with the browser's lineKey via the same recipe. */
export function modifierIdentity(raw: unknown): string {
  return canonicalModifierIds(raw).join(",");
}

/**
 * Resolve and validate a modifier selection against the REAL Commerce rows.
 *
 * Checks, in the order a person would ask them:
 *   the input is a list of ids ·  each id is an option attached to THIS product on THIS business ·
 *   the option is active ·  its group is active ·  each active group's min_select is satisfied ·
 *   each group's max_select is not exceeded.
 *
 * Returns the canonical ids, the frozen snapshot and the authoritative adjustment — or a refusal
 * naming exactly what was wrong.
 */
export async function resolveProductModifiers(
  admin: Admin,
  businessId: string,
  productId: string,
  rawSelection: unknown,
): Promise<ModifierResolution> {
  const fail = (error: string, detail?: string): ModifierResolution => ({ ok: false, error, detail });

  // ── The input must be a list of ids, and nothing else ────────────────────────────────────
  if (rawSelection != null && !Array.isArray(rawSelection)) {
    return fail("modifier_selection_invalid", "selected_modifiers must be an array of option ids");
  }
  const rawArr: unknown[] = Array.isArray(rawSelection) ? rawSelection : [];
  if (rawArr.length > MAX_RAW_SELECTIONS) {
    return fail("modifier_selection_invalid", `too many selections (${rawArr.length})`);
  }
  for (const v of rawArr) {
    // An object here is a client trying to send a name or a price. It is refused by shape, before
    // anything has a chance to read a field off it.
    if (typeof v !== "string" || !v.trim()) {
      return fail("modifier_selection_invalid", "every selection must be a modifier option id");
    }
  }
  const wanted = canonicalModifierIds(rawArr);

  // ── What this product actually offers ────────────────────────────────────────────────────
  // Attached groups are loaded whatever their status: an archived group must be distinguishable
  // from one that was never attached, or "you picked something from another product" and "that
  // choice has been retired" become the same sentence.
  const { data: attached, error: attachErr } = await admin
    .from("commerce_product_modifier_groups")
    .select("modifier_group_id,sort_order")
    .eq("product_id", productId)
    .eq("business_id", businessId)
    .order("sort_order");
  if (attachErr) return fail("modifier_lookup_failed", attachErr.message);

  const attachedRows = (attached || []) as Array<{ modifier_group_id: string; sort_order: number }>;
  if (!attachedRows.length) {
    // A product with no groups: the only valid selection is none. This is the path every existing
    // Commerce product takes, and it must stay cheap and must stay silent.
    if (wanted.length) {
      return fail("modifier_option_not_found", `product has no modifier groups (${wanted[0]})`);
    }
    return { ok: true, option_ids: [], snapshot: [], adjustment_cents: 0 };
  }

  const groupOrder = new Map<string, number>();
  for (const a of attachedRows) groupOrder.set(String(a.modifier_group_id), Number(a.sort_order) || 0);
  const groupIds = [...groupOrder.keys()];

  const { data: groupRows, error: groupErr } = await admin
    .from("commerce_modifier_groups")
    .select("id,name,min_select,max_select,status")
    .in("id", groupIds)
    .eq("business_id", businessId);
  if (groupErr) return fail("modifier_lookup_failed", groupErr.message);
  const groups = new Map<string, { id: string; name: string; min_select: number; max_select: number; status: string }>();
  for (const g of (groupRows || [])) groups.set(String(g.id), g);

  const { data: optionRows, error: optErr } = await admin
    .from("commerce_modifier_options")
    .select("id,name,price_adjustment_cents,status,sort_order,modifier_group_id")
    .in("modifier_group_id", groupIds)
    .eq("business_id", businessId)
    .order("sort_order");
  if (optErr) return fail("modifier_lookup_failed", optErr.message);
  // Scoped by construction: this map holds ONLY options whose group is attached to this product
  // AND whose business_id is this business. An option from another product, or another business,
  // is simply absent — there is no branch that could let one through.
  const options = new Map<string, { id: string; name: string; price_adjustment_cents: number; status: string; sort_order: number; modifier_group_id: string }>();
  for (const o of (optionRows || [])) options.set(String(o.id), o);

  // ── Judge each selection ─────────────────────────────────────────────────────────────────
  const chosen: Array<{ group: { id: string; name: string }; option: { id: string; name: string; price_adjustment_cents: number; sort_order: number } }> = [];
  const perGroup = new Map<string, number>();
  for (const id of wanted) {
    const opt = options.get(id);
    if (!opt) return fail("modifier_option_not_found", id);
    const grp = groups.get(String(opt.modifier_group_id));
    if (!grp) return fail("modifier_option_not_found", id);
    if (grp.status !== "active") return fail("modifier_group_inactive", grp.name || grp.id);
    if (opt.status !== "active") return fail("modifier_option_inactive", opt.name || id);
    perGroup.set(grp.id, (perGroup.get(grp.id) || 0) + 1);
    chosen.push({
      group: { id: grp.id, name: String(grp.name || "") },
      option: {
        id: String(opt.id),
        name: String(opt.name || ""),
        price_adjustment_cents: Number(opt.price_adjustment_cents) || 0,
        sort_order: Number(opt.sort_order) || 0,
      },
    });
  }

  // ── Constraints, over ACTIVE groups only ─────────────────────────────────────────────────
  for (const gid of groupIds) {
    const g = groups.get(gid);
    if (!g || g.status !== "active") continue;
    const n = perGroup.get(gid) || 0;
    const min = Number(g.min_select) || 0;
    const max = Number(g.max_select) || 0;
    if (n < min) {
      return fail(
        "modifier_group_required",
        `${g.name || gid} needs at least ${min} selection${min === 1 ? "" : "s"} (got ${n})`,
      );
    }
    if (n > max) {
      return fail(
        "modifier_group_max_exceeded",
        `${g.name || gid} allows at most ${max} selection${max === 1 ? "" : "s"} (got ${n})`,
      );
    }
  }

  // ── The frozen record, in the order the page shows it ────────────────────────────────────
  chosen.sort((a, b) => {
    const ga = groupOrder.get(a.group.id) ?? 0;
    const gb = groupOrder.get(b.group.id) ?? 0;
    if (ga !== gb) return ga - gb;
    if (a.option.sort_order !== b.option.sort_order) return a.option.sort_order - b.option.sort_order;
    return a.option.id < b.option.id ? -1 : 1;
  });

  const snapshot: ModifierSnapshotEntry[] = chosen.map((c) => ({
    group_id: c.group.id,
    group_name: c.group.name,
    option_id: c.option.id,
    option_name: c.option.name,
    price_adjustment_cents: c.option.price_adjustment_cents,
  }));
  const adjustment = snapshot.reduce((s, e) => s + e.price_adjustment_cents, 0);

  return { ok: true, option_ids: wanted, snapshot, adjustment_cents: adjustment };
}

/**
 * Render a snapshot for a human — one line, the way a receipt reads.
 * Used by the order notification, which must not have to know the shape of the jsonb.
 */
export function describeModifierSnapshot(raw: unknown): string {
  if (!Array.isArray(raw) || !raw.length) return "";
  return raw
    .map((e) => {
      const r = (e || {}) as Record<string, unknown>;
      const name = String(r.option_name || "").trim();
      if (!name) return "";
      const cents = Number(r.price_adjustment_cents) || 0;
      if (!cents) return name;
      const sign = cents > 0 ? "+" : "−";
      return `${name} ${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
    })
    .filter(Boolean)
    .join(", ");
}
