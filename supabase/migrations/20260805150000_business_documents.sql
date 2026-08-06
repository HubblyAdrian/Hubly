-- Hubly Document storage: a version-history table for the validated
-- node-tree documents Hubly generates and patches (websites today; the
-- `tag` column is what lets this same model extend to booking experiences,
-- storefronts, emails, quotes, proposals, and CRM views later without a
-- new table).
--
-- Deliberately append-only: every generation and every patch inserts a new
-- version rather than mutating one in place, so "what did this look like
-- before that edit" is always answerable, and a bad patch can be rolled
-- back by simply reading an earlier version.
--
-- Security mirrors patch_business_in_progress exactly: writes go through a
-- SECURITY DEFINER RPC gated on the real draft_token, since this table
-- backs the same anonymous-draft flow. Public SELECT mirrors the existing
-- "Public can read businesses" policy — a generated document is no more
-- sensitive than the businesses row it belongs to, and the public renderer
-- needs to read it with just the anon key, same as loadPublicProfile does
-- for businesses today.

create table if not exists business_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  tag text not null default 'website',
  version int not null,
  document jsonb not null,
  rendered_html text,
  created_by text not null check (created_by in ('ai', 'user', 'patch')),
  created_at timestamptz not null default now(),
  unique (business_id, tag, version)
);

create index if not exists business_documents_latest_idx
  on business_documents (business_id, tag, version desc);

alter table business_documents enable row level security;

drop policy if exists "Public can read business documents" on business_documents;
create policy "Public can read business documents"
  on business_documents for select
  to anon
  using (true);

-- No direct INSERT/UPDATE/DELETE policies for anon/authenticated — all
-- writes go through create_business_document below, which validates the
-- draft_token itself rather than relying on RLS to gate the write.

create or replace function create_business_document(
  p_business_id uuid,
  p_draft_token uuid,
  p_tag text default 'website',
  p_document jsonb default '{}'::jsonb,
  p_rendered_html text default null,
  p_created_by text default 'ai'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row businesses%rowtype;
  v_next_version int;
  v_id uuid;
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

  select coalesce(max(version), 0) + 1 into v_next_version
  from business_documents
  where business_id = p_business_id and tag = coalesce(p_tag, 'website');

  insert into business_documents (business_id, tag, version, document, rendered_html, created_by)
  values (p_business_id, coalesce(p_tag, 'website'), v_next_version, p_document, p_rendered_html, p_created_by)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'version', v_next_version, 'slug', v_row.slug);
end;
$$;

grant execute on function create_business_document(uuid, uuid, text, jsonb, text, text) to anon, authenticated;
revoke all on function create_business_document(uuid, uuid, text, jsonb, text, text) from public;
