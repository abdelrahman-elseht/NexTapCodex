-- Replace the editor's multi-request delete/reinsert with one owner-checked transaction.
create or replace function private.save_page_draft(
  target_business_id uuid,
  target_page_id uuid,
  business_name text,
  business_category text,
  business_status text,
  page_slug text,
  page_template text,
  section_rows jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare actor uuid := (select auth.uid()); row jsonb; page_row public.business_pages;
begin
  if actor is null or not private.is_owner() then raise exception 'not authorized' using errcode='42501'; end if;
  if business_status not in ('active','archived') then raise exception 'invalid business status'; end if;
  if page_template not in ('cafe','restaurant','salon','retail','professional') then raise exception 'invalid template'; end if;
  select * into page_row from public.business_pages where id=target_page_id and business_id=target_business_id for update;
  if not found then raise exception 'page not found'; end if;
  update public.businesses set name=left(business_name,120), category=left(coalesce(business_category,'business'),80), status=business_status, updated_at=now() where id=target_business_id;
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
  business_status text, page_slug text, page_template text, section_rows jsonb
) returns jsonb language sql security invoker set search_path='' as $$
  select private.save_page_draft(target_business_id,target_page_id,business_name,business_category,business_status,page_slug,page_template,section_rows);
$$;
revoke all on function private.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb), public.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb) from public,anon;
grant execute on function private.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb) to authenticated;
grant execute on function public.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb) to authenticated;
