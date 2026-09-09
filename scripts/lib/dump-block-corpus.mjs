/**
 * Builds scripts/baselines/block-legibility-corpus.json — every real page that could
 * receive a services block, WITH the block already inserted, plus every page that
 * already carries a contact block. Regenerate when the corpus moves; the standing rule
 * is that a reused export silently undercounts.
 *
 *   deno run -A scripts/lib/dump-block-corpus.ts   (see the .ts sibling — this file is
 *   the Node half and reads what that wrote)
 */
