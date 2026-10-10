-- Phase 5: validate the complete draft before one atomic incremental commit.
-- Existing section ids are retained by the (page_id, section_key) key. A
-- temporary position range makes swaps safe despite the unique position key.
begin;

alter table public.page_sections drop constraint if exists page_sections_page_id_section_key_key;
alter table public.page_sections drop constraint if exists page_sections_page_id_position_key;
alter table public.page_sections add constraint page_sections_page_key_unique unique (page_id, section_key) deferrable initially immediate;
alter table public.page_sections add constraint page_sections_page_position_unique unique (page_id, position) deferrable initially immediate;

create or replace function private.save_page_draft(
  target_business_id uuid, target_page_id uuid, business_name text,
  business_category text, business_status text, page_slug text,
  page_template text, section_rows jsonb, target_provider_profiles jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := (select auth.uid());
  page_row public.business_pages;
  section_row jsonb;
  section_ordinal bigint;
  section_count integer := jsonb_array_length(coalesce(section_rows, '[]'::jsonb));
  existing_count integer;
  maximum_position integer;
  position_offset integer;
  committed_at timestamptz := statement_timestamp();
begin
  if actor is null or not private.is_owner() then
    raise exception 'not authorized' using errcode='42501';
  end if;
  if business_status not in ('active','archived') then raise exception 'invalid business status' using errcode='22023'; end if;
  if page_template not in ('cafe','restaurant','salon','retail','professional') then raise exception 'invalid template' using errcode='22023'; end if;
  if section_count < 1 or section_count > 100 then raise exception 'invalid section count' using errcode='22023'; end if;
  if page_slug !~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$' then raise exception 'invalid slug' using errcode='22023'; end if;
  if pg_column_size(coalesce(target_provider_profiles,'{}'::jsonb)) > 65536 then raise exception 'provider profiles are too large' using errcode='22023'; end if;
  if jsonb_typeof(coalesce(section_rows, '[]'::jsonb)) <> 'array' then raise exception 'sections must be an array' using errcode='22023'; end if;

  -- Validate every row and the complete order before changing any table.
  for section_row, section_ordinal in
    select value, ordinal from jsonb_array_elements(coalesce(section_rows,'[]'::jsonb)) with ordinality as items(value, ordinal)
  loop
    if jsonb_typeof(section_row) <> 'object'
      or coalesce(section_row->>'section_key','') !~ '^[a-z][a-z0-9_]{0,39}$'
      or coalesce(section_row->>'kind','') not in ('hero','about','hours','contact','quick_actions','social','payments','links','services','gallery','reviews','branch')
      or jsonb_typeof(coalesce(section_row->'content','{}'::jsonb)) <> 'object'
      or pg_column_size(coalesce(section_row->'content','{}'::jsonb)) > 65536
      or coalesce(section_row->>'title','') is null
      or char_length(coalesce(section_row->>'title','')) > 80
      or (section_row ? 'position') is false
      or (section_row->>'position') !~ '^[0-9]+$'
      or (section_row->>'position')::integer <> section_ordinal - 1 then
      raise exception 'invalid section row' using errcode='22023';
    end if;
    if (section_row->>'position')::integer > 32767 then raise exception 'section positions exceed the supported range' using errcode='22003'; end if;
    if coalesce(section_row->>'enabled','true') not in ('true','false') then raise exception 'invalid section enabled flag' using errcode='22023'; end if;
  end loop;
  if (select count(distinct value->>'section_key') from jsonb_array_elements(coalesce(section_rows,'[]'::jsonb))) <> section_count
     or (select count(distinct (value->>'position')::integer) from jsonb_array_elements(coalesce(section_rows,'[]'::jsonb))) <> section_count
     or exists (select 1 from jsonb_array_elements(coalesce(section_rows,'[]'::jsonb)) item where (item->>'position')::integer >= section_count) then
    raise exception 'section keys and positions must be unique and contiguous' using errcode='22023';
  end if;

  select * into page_row from public.business_pages where id=target_page_id and business_id=target_business_id for update;
  if not found then raise exception 'page not found' using errcode='P0002'; end if;
  select count(*), coalesce(max(position), -1) into existing_count, maximum_position from public.page_sections where page_id=target_page_id;
  position_offset := greatest(maximum_position + 1, section_count + 1);
  if maximum_position + position_offset > 32767 then raise exception 'section positions exceed the supported range' using errcode='22003'; end if;

  update public.businesses set name=left(business_name,120), category=left(coalesce(business_category,'business'),80), status=business_status,
    provider_profiles=coalesce(target_provider_profiles,'{}'::jsonb), updated_at=committed_at where id=target_business_id;
  update public.business_pages set slug=page_slug, template=page_template, updated_at=committed_at where id=target_page_id;

  set constraints all deferred;
  insert into public.page_sections(page_id,section_key,kind,title,position,enabled,content,updated_at)
  select target_page_id, row->>'section_key', row->>'kind', left(coalesce(row->>'title',''),80), (row->>'position')::smallint,
    coalesce((row->>'enabled')::boolean,true), coalesce(row->'content','{}'::jsonb), committed_at
  from jsonb_array_elements(coalesce(section_rows,'[]'::jsonb)) row
  on conflict (page_id,section_key) do update set kind=excluded.kind, title=excluded.title, position=excluded.position,
    enabled=excluded.enabled, content=excluded.content, updated_at=excluded.updated_at
  where public.page_sections.kind is distinct from excluded.kind
     or public.page_sections.title is distinct from excluded.title
     or public.page_sections.position is distinct from excluded.position
     or public.page_sections.enabled is distinct from excluded.enabled
     or public.page_sections.content is distinct from excluded.content;
  delete from public.page_sections where page_id=target_page_id
    and section_key not in (select value->>'section_key' from jsonb_array_elements(coalesce(section_rows,'[]'::jsonb)));
  set constraints all immediate;

  return jsonb_build_object('ok',true,'sections',coalesce((select jsonb_agg(jsonb_build_object('id',id,'section_key',section_key) order by position)
    from public.page_sections where page_id=target_page_id),'[]'::jsonb),'committedAt',committed_at);
end; $$;

create or replace function private.save_page_draft(
  target_business_id uuid, target_page_id uuid, business_name text,
  business_category text, business_status text, page_slug text,
  page_template text, section_rows jsonb
) returns jsonb language sql security definer set search_path='' as $$
  select private.save_page_draft(target_business_id,target_page_id,business_name,business_category,business_status,page_slug,page_template,section_rows,
    coalesce((select provider_profiles from public.businesses where id=target_business_id),'{}'::jsonb));
$$;

create or replace function public.save_page_draft(
  target_business_id uuid, target_page_id uuid, business_name text, business_category text,
  business_status text, page_slug text, page_template text, section_rows jsonb, target_provider_profiles jsonb
) returns jsonb language sql security invoker set search_path='' as $$
  select private.save_page_draft(target_business_id,target_page_id,business_name,business_category,business_status,page_slug,page_template,section_rows,target_provider_profiles);
$$;

create or replace function public.save_page_draft(
  target_business_id uuid, target_page_id uuid, business_name text, business_category text,
  business_status text, page_slug text, page_template text, section_rows jsonb
) returns jsonb language sql security invoker set search_path='' as $$
  select private.save_page_draft(target_business_id,target_page_id,business_name,business_category,business_status,page_slug,page_template,section_rows,
    coalesce((select provider_profiles from public.businesses where id=target_business_id),'{}'::jsonb));
$$;

revoke all on function private.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb), private.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb,jsonb),
  public.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb), public.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb,jsonb) from public, anon;
grant execute on function private.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb), private.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb,jsonb),
  public.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb), public.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb,jsonb) to authenticated;

-- Keep the owner predicate constant for each statement so PostgreSQL evaluates
-- it once per query. Row-dependent predicates remain unchanged.
alter policy owner_businesses_all on public.businesses using ((select private.is_owner())) with check ((select private.is_owner()));
alter policy owner_pages_all on public.business_pages using ((select private.is_owner())) with check ((select private.is_owner()));
alter policy owner_sections_all on public.page_sections using ((select private.is_owner())) with check ((select private.is_owner()));
alter policy owner_publications_read on public.page_publications using ((select private.is_owner()));
alter policy owner_publications_insert on public.page_publications with check ((select private.is_owner()) and published_by=(select auth.uid()));
alter policy owner_batches_all on public.card_batches using ((select private.is_owner())) with check ((select private.is_owner()) and created_by=(select auth.uid()));
alter policy owner_cards_all on public.cards using ((select private.is_owner())) with check ((select private.is_owner()));
alter policy owner_history_read on public.card_assignment_history using ((select private.is_owner()));
alter policy owner_media_all on public.media_assets using ((select private.is_owner())) with check ((select private.is_owner()));
alter policy owner_audit_read on public.audit_logs using ((select private.is_owner()));
notify pgrst, 'reload schema';
commit;
