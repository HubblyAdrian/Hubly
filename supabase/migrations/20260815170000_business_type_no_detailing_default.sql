-- businesses.business_type: stop defaulting unknown trades to auto detailing.
--
-- 20260713130000_add_business_type.sql created the column as:
--     text not null default 'detailing'
--
-- That single DDL line is the deepest of the hardcoded detailing fallbacks. Any
-- insert that did not name a trade — the anonymous builder, the marketplace lite
-- signup, any partial onboarding — got a row that positively asserts the business
-- details cars. Nothing downstream can tell that apart from an owner who actually
-- said "detailing", so the whole runtime (blueprint, service catalog, website copy,
-- AI prompt) follows it, and a photographer is sold ceramic coatings.
--
-- "Not known yet" is a real state and NULL is how it is spelled. The server already
-- treats it correctly: resolveBusinessDna(null) returns null, which makes the AI
-- identity block say "Industry: NOT KNOWN. Do not guess one." The client resolves an
-- absent type to the neutral 'generic' blueprint, which carries no trade nouns.
--
-- Existing rows are deliberately left alone. 13 of 19 production businesses read
-- 'detailing' today and there is no way, from this side, to tell a real detailer
-- from a defaulted one. Rewriting them would destroy information rather than
-- recover it; that reconciliation needs evidence (services, website copy, photos)
-- and is a separate piece of work.

alter table public.businesses
  alter column business_type drop default;

alter table public.businesses
  alter column business_type drop not null;

comment on column public.businesses.business_type is
  'Trade/industry id, matching a Business Blueprint (detailing, photography, hvac, ...). '
  'NULL means NOT KNOWN — never guess a value here and never default it to a real trade. '
  'Clients resolve NULL to the neutral "generic" blueprint; the server resolves it to no '
  'Business DNA at all, which makes the AI say it does not know the industry.';
