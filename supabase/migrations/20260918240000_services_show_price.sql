-- == services.show_price — SO A FREEFORM PAGE CAN HIDE A PRICE ==================================
--
-- RULED BY ADRIAN, 2026-09-18: "Add `show_price boolean not null default true` to `services`. Then
-- make the anchor placement honour it — a service with show_price false renders the 'quote at
-- booking' wording svcDisplayPrice already produces, on the freeform path too."
--
-- == WHY THIS COLUMN AND NOT THE ONE THAT ALREADY EXISTS ======================================
--
-- MEASURED FIRST, because the obvious objection is that show_price is already built. It is — in a
-- DIFFERENT STORE. `service_engine.ts` carries `pricing.show_price` on a catalog offer
-- (meta.serviceCatalog), computed as `show_price !== false && mode !== 'quote_required'`. That is
-- real and it works for the surfaces that read the catalog.
--
-- It does not reach a FREEFORM page, and that is not an opinion:
--
--   * a freeform page's prices are placed as `data-hubly-price` anchors by
--     applyServicesToFreeform(), whose signature is
--         services: { name: string; price?: number; description?: string }[]
--     — no show_price, no mode, no sale. Three fields, and the flag is not one of them.
--   * the array is built from `services` ROWS by the record-edit path (`const one = [{ name, price,
--     description }]`), so `services` is the operative store on that path.
--   * and the catalog is EMPTY for the businesses this matters to: evergreen-yard-care has 0
--     `meta.editorSvcs` and 6 `services` rows. Freeform is the path every new business takes.
--
-- So the flag has to exist where the freeform placement reads, and that is here.
--
-- == THE DUPLICATION THIS CREATES, REPORTED RATHER THAN HIDDEN ================================
--
-- After this there are TWO places that answer "is this price shown": `services.show_price` and
-- `pricing.show_price` on a catalog offer. That is two-of-everything, which is this repo's most
-- expensive recurring shape, and it is being accepted deliberately rather than by accident:
--
--   * they describe the same intention for DIFFERENT STORES that different renderers read, and
--     today no business populates both (the catalog is empty wherever freeform is in use);
--   * unifying them means one store for services, which is a migration of every business's offers
--     and is not what was ruled;
--   * so the honest end state is ONE store, and until then the risk is a business with BOTH a
--     catalog offer and a services row disagreeing about one service's price visibility.
--
-- RECORDED IN docs/OPEN_FINDINGS.md as the open half, with that exact failure named, so it is a
-- known cost and not a surprise. It is NOT a reason to withhold the column: without it a freeform
-- owner cannot hide a price at all.
--
-- == THE DEFAULT IS THE HONEST ONE ============================================================
--
-- `not null default true`: an existing row has always shown its price, so true preserves every
-- owner's current behaviour exactly. `not null` because a third state ("we do not know whether to
-- show this price") is not a thing a renderer can act on, and NULL would make `show_price = false`
-- miss rows that a reader would then treat as hidden or shown depending on which operator it used.
--
-- == NO PAGE IS REBUILT, NO ROW'S MEANING CHANGES ============================================
--
-- One ALTER TABLE, additive, with a default. Every existing row keeps rendering exactly as it does
-- today. graefs-autocare is read-only and is untouched by an additive column with a true default.

alter table public.services
  add column if not exists show_price boolean not null default true;

comment on column public.services.show_price is
  'False hides the NUMBER on the public page while the service stays bookable or quotable — the '
  'renderer shows the "quote at booking" wording instead. Ruled by Adrian 2026-09-18. NOTE: a '
  'catalog offer carries the same intention as pricing.show_price in meta.serviceCatalog; that is a '
  'known duplication across two stores, recorded in docs/OPEN_FINDINGS.md.';
