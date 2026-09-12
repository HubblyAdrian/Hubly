-- A WRONG STAMP IS A FALSE FACT AND MUST BE REMOVED.
--
-- Two pages carry data-hubly-service on header furniture, stamped by the scorer that
-- B2 replaced (findServiceNameElement — a tag ranking plus a penalty list that did not
-- include "header"):
--   toms-gutters-more   <div class="service-label"> inside .brand-slot  — a strapline
--   site-f71f30         <strong> inside .trade-label inside .header-inner
--
-- BYTE PROOF, run before applying: each document contains the attribute exactly once and
-- shrinks by exactly its own length — 56 and 38 characters respectively, both matching the
-- attribute text precisely. Attribute-only; visible text is untouched; nothing re-rendered.
--
-- WHAT THIS DOES AND DOES NOT DO — worth stating, because the obvious reading is wrong.
-- The mechanism we expected was that a false anchor suppresses the guess-row fallback
-- (useGuessRows = allServiceAnchors(html).length === 0), so stripping it would re-enable a
-- working path. MEASURED: both pages have ZERO guess rows, so there is no path to
-- re-enable. Stripping does not make either page writable.
--
-- It matters for a different and sharper reason. allServiceAnchors requires only
-- findServiceEntryBounds, NOT the structural region check — that check governs STAMPING,
-- not reading. site-f71f30's anchor is joinable (an ancestor <div> qualifies) so the
-- inserter would accept it and insert a service INTO THE PAGE HEADER. Removing it prevents
-- a service being written into the site's branding.
--
-- Both pages are test and unclaimed, so nothing customer-facing was at risk. Done properly
-- anyway: a false fact left in the corpus is a trap for a future measurement, and one was
-- sprung tonight.
update business_documents
   set rendered_html = regexp_replace(rendered_html, ' data-hubly-service="[^"]*"', '', 'g')
 where business_id in (select id from businesses where slug in ('site-f71f30','toms-gutters-more'))
   and rendered_html like '%data-hubly-service=%';
