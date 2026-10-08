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
