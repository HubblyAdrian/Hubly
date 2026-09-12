-- PATCH THE STYLE BLOCK, DO NOT RE-RENDER. Applied 2026-09-12; recorded here so it is
-- reproducible and so the reasoning is not left in a conversation.
--
-- The layout net is APPENDED CSS and it survives later patches, so every page built since
-- 2026-08-27 already carries <style id="hubly-layout-net"> — it just carries the OLD
-- scoped selector inside it. Fixing existing pages is therefore a string replacement in a
-- style block that is already there: zero generations, no lost owner edits, no model.
-- Re-rendering would have cost one generation per page and discarded owner edits, to
-- achieve strictly less.
--
-- DRY RUN BEFORE APPLYING: 265 documents contained the old selector, 0 contained the new.
-- Every replacement delta is an exact multiple of 7 characters (265 of 265) — the proof
-- that nothing but the selector string can change. min 7, max 42, because 166 documents
-- carry the net more than once: it is appended unconditionally on every pass rather than
-- replaced. Harmless (same id, same rule) but sloppy; noted, not fixed here.
--
-- RESULT, re-measured by rendering the corpus FROM THE DATABASE with nothing regenerated:
-- 7 affected pages -> 1, and 22 collapsed elements -> 3.
--
-- THE REMAINDER IS NOT A FAILURE OF THIS PATCH. sebastian-roesler-flight-instruction is a
-- test draft whose document dates from 2026-08-23, before the net existed, so it carries
-- no style block to patch. Pages predating 2026-08-27 are reachable only by a re-render.
update business_documents
   set rendered_html = replace(rendered_html, ':where(li,dd,dt)>*:only-child', ':where(*)>*:only-child')
 where rendered_html like '%:where(li,dd,dt)>*:only-child%';
