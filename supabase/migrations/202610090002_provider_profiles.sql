-- Store reusable provider destinations once per business. Item rows may still
-- opt into an explicit override for a section-specific destination.
alter table public.businesses
  add column if not exists provider_profiles jsonb not null default '{}'::jsonb
  check (pg_column_size(provider_profiles) <= 65536);

create or replace function private.save_page_draft(
  target_business_id uuid,
  target_page_id uuid,
  business_name text,
  business_category text,
  business_status text,
  page_slug text,
  page_template text,
  section_rows jsonb,
  target_provider_profiles jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare actor uuid := (select auth.uid()); row jsonb; page_row public.business_pages;
begin
  if actor is null or not private.is_owner() then raise exception 'not authorized' using errcode='42501'; end if;
  if business_status not in ('active','archived') then raise exception 'invalid business status'; end if;
  if page_template not in ('cafe','restaurant','salon','retail','professional') then raise exception 'invalid template'; end if;
  if pg_column_size(coalesce(target_provider_profiles,'{}'::jsonb)) > 65536 then raise exception 'provider profiles are too large'; end if;
  select * into page_row from public.business_pages where id=target_page_id and business_id=target_business_id for update;
  if not found then raise exception 'page not found'; end if;
  update public.businesses
  set name=left(business_name,120), category=left(coalesce(business_category,'business'),80),
      status=business_status, provider_profiles=coalesce(target_provider_profiles,'{}'::jsonb), updated_at=now()
  where id=target_business_id;
  update public.business_pages set slug=page_slug, template=page_template, updated_at=now() where id=target_page_id;
  delete from public.page_sections where page_id=target_page_id;
  for row in select value from jsonb_array_elements(coalesce(section_rows,'[]'::jsonb)) loop
    insert into public.page_sections(page_id,section_key,kind,title,position,enabled,content)
    values(target_page_id,
      left(row->>'section_key',40), row->>'kind', left(coalesce(row->>'title',''),80), (row->>'position')::smallint,
      coalesce((row->>'enabled')::boolean,true), coalesce(row->'content','{}'::jsonb));
  end loop;
  return jsonb_build_object('ok',true);
end; $$;

create or replace function public.save_page_draft(
  target_business_id uuid, target_page_id uuid, business_name text, business_category text,
  business_status text, page_slug text, page_template text, section_rows jsonb,
  target_provider_profiles jsonb default '{}'::jsonb
) returns jsonb language sql security invoker set search_path='' as $$
  select private.save_page_draft(target_business_id,target_page_id,business_name,business_category,
    business_status,page_slug,page_template,section_rows,target_provider_profiles);
$$;

revoke all on function private.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb),
  private.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb,jsonb),
  public.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb),
  public.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb,jsonb) from public,anon;
grant execute on function private.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb,jsonb) to authenticated;
grant execute on function public.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb,jsonb) to authenticated;

create or replace function private.publish_page(target_page_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid := (select auth.uid()); page_row public.business_pages; biz public.businesses; new_version bigint; publication_id uuid; snapshot jsonb;
begin
  if actor is null or not private.is_owner() then raise exception 'not authorized' using errcode='42501'; end if;
  select * into page_row from public.business_pages where id=target_page_id for update;
  if not found then raise exception 'page not found'; end if;
  select * into biz from public.businesses where id=page_row.business_id;
  new_version := page_row.published_version + 1;
  snapshot := jsonb_build_object(
    'business',jsonb_build_object('name',biz.name,'category',biz.category),
    'page',jsonb_build_object('slug',page_row.slug,'template',page_row.template,'type',page_row.page_type,'branchName',page_row.branch_name),
    'providerProfiles',coalesce(biz.provider_profiles,'{}'::jsonb),
    'sections',coalesce((select jsonb_agg(jsonb_build_object(
      'key',s.section_key,'title',s.title,'position',s.position,'enabled',s.enabled,'kind',s.kind,'content',s.content
    ) order by s.position) from public.page_sections s where s.page_id=page_row.id),'[]'::jsonb)
  );
  insert into public.page_publications(page_id,version,snapshot,published_by)
  values(target_page_id,new_version,snapshot,actor) returning id into publication_id;
  update public.business_pages set published_version=new_version,published_snapshot_id=publication_id,is_active=true,updated_at=now()
  where id=target_page_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(actor,'page.publish','page',target_page_id,jsonb_build_object('version',new_version));
  return jsonb_build_object('ok',true,'publicationId',publication_id,'version',new_version);
end; $$;

create or replace function public.publish_page(target_page_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.publish_page(target_page_id); $$;
revoke all on function private.publish_page(uuid),public.publish_page(uuid) from public,anon;
grant execute on function private.publish_page(uuid) to authenticated;
grant execute on function public.publish_page(uuid) to authenticated;
