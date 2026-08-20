/**
 * Allow-lists that say what they dropped.
 *
 * THE CLASS OF BUG THIS EXISTS TO END
 *
 * Four times now, a hardcoded list of names has silently dropped a new entry,
 * and every time the failure was invisible because dropping is the list's normal
 * behaviour:
 *
 *   - `patch_business_in_progress`'s column whitelist returned ok:true and wrote
 *     nothing for six columns, for months.
 *   - The publishable-key script-tag guard matched its own comment, passed six
 *     broken pages, and shipped them blank.
 *   - `NEEDS_DRAFT_INJECTION` gave `website.newPage` no credentials, so it told
 *     the owner there was no draft business.
 *   - `GATED_WEBSITE_ACTIONS` omitted `newPage` at three sites, leaving it
 *     advertised and dispatchable while the feature flag was off.
 *
 * The shape is always the same: a set of known names, an input that may contain
 * an unknown one, and an `if (known.has(x))` that takes the silent branch. The
 * list is never wrong in a way anything can see, because "not in the list" and
 * "deliberately excluded" are the same code path.
 *
 * THE RULE: A LIST THAT SILENTLY DROPS UNKNOWN ENTRIES MUST LOG THE DROP.
 *
 * Not throw — most of these lists are correct most of the time, and failing hard
 * on an unknown name would turn a small omission into an outage. Log it, name
 * the list, name what fell through, and say where to fix it. One line is enough;
 * the entire cost of all four bugs above was that the line did not exist.
 */

/** Emitted once per distinct drop per isolate, so a hot path cannot flood logs. */
const alreadyReported = new Set<string>();

export interface AllowlistDrop {
  /** The list's own name, as written in the code, so it can be grepped for. */
  list: string;
  /** What fell through. */
  dropped: string[];
  /** Where to fix it — file and symbol. */
  fixAt: string;
  /** What the drop actually causes, in one clause. */
  consequence: string;
}

/**
 * Report entries that an allow-list did not cover.
 *
 * Deliberately cheap and non-throwing: call it wherever the list is applied, or
 * once at module load when the full candidate set is knowable up front (which is
 * better — a boot-time line appears before anyone hits the broken path).
 */
export function reportAllowlistDrops(drop: AllowlistDrop): void {
  if (!drop.dropped.length) return;
  const key = `${drop.list}:${drop.dropped.slice().sort().join(",")}`;
  if (alreadyReported.has(key)) return;
  alreadyReported.add(key);
  console.warn(
    `allowlist-drop [${drop.list}] ${drop.dropped.length} not covered: ${drop.dropped.join(", ")}` +
      ` | consequence: ${drop.consequence}` +
      ` | fix at: ${drop.fixAt}`,
  );
}

/** Test seam. Nothing in production should need this. */
export function _resetAllowlistDropReporting(): void {
  alreadyReported.clear();
}
