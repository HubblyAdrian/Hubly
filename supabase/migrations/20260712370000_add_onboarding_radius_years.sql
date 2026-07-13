-- Item 7, gaps 1+2: two new onboarding fields identified against the vision
-- doc's described flow (business name -> city -> travel radius -> years ->
-- ...), neither of which existed anywhere in the schema before now.
alter table businesses add column if not exists travel_radius_miles integer;
alter table businesses add column if not exists years_in_business integer;
