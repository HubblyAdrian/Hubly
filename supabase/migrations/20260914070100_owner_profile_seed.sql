-- SEED THE NINE NAMES WE ALREADY HAVE, AND RECORD WHERE EACH CAME FROM.
--
-- Measured before writing (docs/WHAT_THE_MODEL_KNOWS.md): 9 of 29 owners have a name in
-- auth.users.raw_user_meta_data. They are NOT the same kind of fact:
--
--   5 with provider 'email'  — typed into Hubly's OWN signup form. The owner gave us this.
--                              Seeded as 'signup'.
--   4 with provider 'google' — supplied by an OAuth profile. Useful, not chosen for us.
--                              Seeded as 'google', which set_owner_display_name ranks BELOW
--                              anything the owner later says, so the first time one of them
--                              tells Hubly their name in conversation it wins permanently.
--
-- Nobody is asked again for a name we already hold. Nobody has a name they chose replaced by
-- one a provider guessed. `welcomed_at` is deliberately left NULL for all nine: none of them
-- has ever been welcomed by name, because nothing has ever been able to.
insert into public.hubly_owner_profile (owner_id, display_name, name_source, name_set_at, updated_at)
select u.id,
       btrim(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')),
       case when coalesce(u.raw_app_meta_data->>'provider','') = 'google' then 'google' else 'signup' end,
       now(), now()
from auth.users u
where exists (select 1 from public.businesses b where b.owner_id = u.id)
  and nullif(btrim(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')), '') is not null
on conflict (owner_id) do nothing;
