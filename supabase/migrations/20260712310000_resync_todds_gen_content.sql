-- Item 6, Todds re-sync: applies Todds' EXISTING, correct gen_* content
-- (confirmed to genuinely describe Todds, unlike Adrian's mismatched
-- content) into meta.website, fixing the exact broken state the
-- self-destruct bug left behind. Scoped to fields confirmed to still be
-- unedited generic defaults (heroHeadline, heroSub, seoTitle -- verified
-- as exact literal matches to buildDefaultHeroHeadline()/
-- buildDefaultHeroSub()/the seoTitle template) or empty (faq,
-- whyChooseUs). Deliberately does NOT touch ownerBio or seoDescription,
-- which contain real human-authored text (a typo, informal phrasing)
-- that doesn't match any known default template.
create or replace function _resync_todds_gen_content(new_meta text)
returns void
language sql
security definer
set search_path = public
as $$
  update businesses set meta = new_meta
  where id = 'a9d5e990-acdb-4f76-849d-751d863cdc18';
$$;

grant execute on function _resync_todds_gen_content(text) to authenticated;
revoke all on function _resync_todds_gen_content(text) from public, anon;
