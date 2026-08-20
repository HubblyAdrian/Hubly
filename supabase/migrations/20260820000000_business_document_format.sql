-- One column that says what `document` actually is.
--
-- WHY
--
-- business_documents.document has meant exactly one thing since the table was
-- created: a Hubly Document AST, walkable by id, re-renderable to HTML. Six
-- readers assume that without checking, because until now there was nothing to
-- check. Freeform pages break the assumption: there is no tree, only HTML.
--
-- A column that is sometimes a tree and sometimes not, with readers unaware, is
-- worse than either option. So the discriminator lands FIRST, and every reader
-- branches on it in the same change.
--
-- ONE FACT, ONE PLACE
--
-- The format lives in a column and NOWHERE ELSE. Specifically it does not also
-- appear inside the document jsonb. Two copies of a discriminator is two
-- opportunities to disagree, and the loser is whichever reader picked the stale
-- one.
--
-- WHAT GOES IN `document` FOR A FREEFORM ROW
--
-- The column is NOT NULL and stays that way, so a freeform row has to put
-- something there. It puts something USEFUL: the design brief the page was
-- generated from and the images it was given. That is exactly what Step 5's
-- "new version" needs in order to regenerate a page that is recognisably for
-- the same business, and it is otherwise nowhere on the row. What it must NOT
-- contain is a second copy of the format.

alter table public.business_documents
  add column if not exists format text not null default 'ast';

-- Existing rows: all 15 of them, across 6 businesses, are ASTs. The default
-- covers them; no backfill statement is needed and none is written, because a
-- backfill that does nothing is a backfill nobody can verify.
alter table public.business_documents
  drop constraint if exists business_documents_format_check;
alter table public.business_documents
  add constraint business_documents_format_check check (format in ('ast', 'html'));

comment on column public.business_documents.format is
  'What `document` holds. ''ast'' = a Hubly Document tree (walkable by node id, '
  're-renderable via renderHublyDocument) -- the original and still the default. '
  '''html'' = a freeform page: rendered_html IS the page, and `document` holds the '
  'design brief and image list it was generated from, NOT a tree. Every reader of '
  '`document` must branch on this column. The discriminator lives here and only '
  'here -- never inside the document jsonb.';

-- ---------------------------------------------------------------------------
-- create_business_document, +1 parameter.
--
-- REBUILT FROM THE LIVE BODY, read back with pg_get_functiondef immediately
-- before writing this file -- not from a migration found by name. That mistake
-- took production down on 2026-08-19 by silently reverting a validation block
-- two revisions newer than the copy it started from. The live body was verified
-- identical to 20260807010000, so nothing is being reverted here.
--
-- THE DROP IS NOT OPTIONAL. `create or replace function` with a DIFFERENT
-- signature does not replace anything -- it creates a second overload. The old
-- 7-argument version and a new 8-argument version whose last parameter has a
-- default are both candidates for every existing 7-argument call, and Postgres
-- resolves that with "function is not unique" rather than picking one. Every
-- caller would break at once. Drop first, then create, then re-grant (the drop
-- takes the grants with it).
-- ---------------------------------------------------------------------------

drop function if exists public.create_business_document(uuid, uuid, text, jsonb, text, text, text);

create or replace function public.create_business_document(
  p_business_id uuid,
  p_draft_token uuid,
  p_tag text default 'website',
  p_document jsonb default '{}'::jsonb,
  p_rendered_html text default null,
  p_created_by text default 'ai',
  p_design_rationale text default null,
  p_format text default 'ast'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $FN$
declare
  v_row businesses%rowtype;
  v_next_version int;
  v_id uuid;
  v_format text;
begin
  select * into v_row from businesses where id = p_business_id;

  if not found
     or v_row.owner_id is not null
     or v_row.draft_token is null
     or v_row.draft_token is distinct from p_draft_token
  then
    return jsonb_build_object('ok', false, 'error', 'not_a_draft_or_token_mismatch');
  end if;

  if p_created_by not in ('ai', 'user', 'patch') then
    return jsonb_build_object('ok', false, 'error', 'invalid_created_by');
  end if;

  -- Reject an unknown format HERE, with a named error, rather than letting the
  -- check constraint raise. A caller that mistypes 'HTML' should be told which
  -- argument was wrong, not handed a constraint violation from two layers down.
  v_format := coalesce(nullif(p_format, ''), 'ast');
  if v_format not in ('ast', 'html') then
    return jsonb_build_object('ok', false, 'error', 'invalid_format');
  end if;

  -- A freeform row whose rendered_html is empty is a page that does not exist.
  -- For an AST row this is survivable -- the tree can be re-rendered. For an
  -- html row the HTML is the only copy, so refuse rather than store a blank.
  if v_format = 'html' and coalesce(length(btrim(p_rendered_html)), 0) = 0 then
    return jsonb_build_object('ok', false, 'error', 'freeform_requires_rendered_html');
  end if;

  select coalesce(max(version), 0) + 1 into v_next_version
  from business_documents
  where business_id = p_business_id and tag = coalesce(p_tag, 'website');

  insert into business_documents (business_id, tag, version, document, rendered_html, created_by, design_rationale, format)
  values (p_business_id, coalesce(p_tag, 'website'), v_next_version, p_document, p_rendered_html, p_created_by, p_design_rationale, v_format)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'version', v_next_version, 'slug', v_row.slug, 'format', v_format);
end;
$FN$;

-- The grant list is copied from the LIVE acl read back before this file was
-- written (postgres, anon, authenticated, service_role), not from the earlier
-- migration, which grants only anon and authenticated. Dropping the function
-- drops its grants; re-granting the narrower historical list would have
-- silently removed service_role's EXECUTE -- and service_role is the role every
-- Edge Function acts as, so every save in the product would have started
-- failing with a permission error that names the function but not the cause.
revoke all on function public.create_business_document(uuid, uuid, text, jsonb, text, text, text, text) from public;
grant execute on function public.create_business_document(uuid, uuid, text, jsonb, text, text, text, text)
  to anon, authenticated, service_role;
