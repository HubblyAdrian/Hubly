-- == DATA CORRECTION: THREE PRICES ON evergreen-yard-care's PAGE DISAGREED WITH ITS RECORD ======
--
-- ADRIAN, 2026-09-18: "Correct the three values now stored on evergreen-yard-care — it is my test
-- business, patch not rebuild — and say what they were and what they became."
--
-- == WHAT WAS MEASURED ========================================================================
--
-- The `services` table and the stored website document disagreed about what this business charges,
-- and the document is the half a customer reads:
--
--   service            services.price      page said            why
--   Full Service       95                  111.222.333          inline edit, stored verbatim
--   Seasonal Cleanup   220                 $111,222,333         inline edit, stored verbatim
--   Basic Mow          40                  50                   inline edit, stored verbatim
--   Spring Aeration    130                 $130                 untouched — generation's format
--   Gutter Cleaning    150                 $150                 untouched
--   Leaf Removal       85                  $85                  untouched
--
-- The three untouched prices are UNIFORM, which is the whole diagnosis: generation has exactly ONE
-- formatter (svcDisplayPrice -> '$' + price). The freeform inline-edit path patched the page's TEXT
-- through `directFreeformEdit` and never touched `services`, so it neither parsed the input nor went
-- near the formatter. Three formats in one section, from one edit path that had no format at all.
--
-- == WHY THE RECORD IS THE VALUE THAT SURVIVES ================================================
--
-- The record was never wrong: nothing wrote to `services`, so 95/220/40 are the values that were
-- there before the test and are still there. The page is the side that drifted. Bringing the page to
-- the record therefore LOSES NOTHING of the owner's — whereas taking the page's numbers as truth
-- would publish `111.222.333` as a price and write it into the record as well.
--
-- Adrian: if `Basic Mow` was meant to become 50, re-edit it on the page now. That edit will write
-- BOTH stores, which is the fix that shipped with this correction — it did not before, which is the
-- entire reason these three diverged.
--
-- == PATCH, NOT REBUILD =======================================================================
--
-- Three targeted regexp_replace calls against the inner text of three `data-hubly-price` spans, in
-- the LATEST website document of ONE business, addressed by id. The anchor attribute is what makes
-- this a patch rather than a re-recognition of layout: the span is keyed by service name, so no
-- markup shape is being matched (CLAUDE.md — patched by an anchor stamped at build time). The page is
-- not regenerated; 31,393 bytes of model-authored HTML are left exactly as they are apart from three
-- price strings.
--
-- SCOPED, and the scope is the safety: slug = 'evergreen-yard-care' (account_kind='test', Adrian's
-- own test business). NOT graefs-autocare, which is read-only, and NOT either of the two claimed
-- market businesses holding real pipeline data.

update business_documents d
   set rendered_html =
         regexp_replace(
           regexp_replace(
             regexp_replace(d.rendered_html,
               '(data-hubly-price="Full Service">)[^<]*',     '\1$95'),
               '(data-hubly-price="Seasonal Cleanup">)[^<]*', '\1$220'),
               '(data-hubly-price="Basic Mow">)[^<]*',        '\1$40')
 where d.id = (
         select d2.id
           from business_documents d2
           join businesses b on b.id = d2.business_id
          where b.slug = 'evergreen-yard-care'
            and d2.tag = 'website'
          order by d2.created_at desc
          limit 1
       );
