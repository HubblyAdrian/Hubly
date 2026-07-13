-- Item 7, gap 6: generate-site now returns 4 hero headline variants instead
-- of a single string. gen_hero_headline stays the single "definitive
-- value" (defaults to option 1, overwritten with the user's actual pick);
-- this new column stores the full set of options for the picker UI.
alter table businesses add column if not exists gen_hero_headline_options jsonb default '[]'::jsonb;
