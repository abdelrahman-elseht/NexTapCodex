-- Keep the legacy server actions behind the same relationship and owner checks
-- as the newer atomic editor contracts.
begin;

create or replace function private.update_business_page(
  target_business_id uuid,
  target_page_id uuid,
  business_name text,
  business_category text,
  business_status text,
  page_slug text,
  page_template text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null or not private.is_owner() then raise exception 'not authorized' using errcode='42501'; end if;
  if coalesce(btrim(business_name),'') = '' or char_length(business_name) > 120 then raise exception 'invalid business' using errcode='22023'; end if;
  if business_status not in ('active','archived') then raise exception 'invalid business status' using errcode='22023'; end if;
  if page_template not in ('cafe','restaurant','salon','retail','professional') then raise exception 'invalid template' using errcode='22023'; end if;
  if page_slug !~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$' then raise exception 'invalid slug' using errcode='22023'; end if;
  if not exists (select 1 from public.business_pages where id=target_page_id and business_id=target_business_id) then
    raise exception 'page does not belong to business' using errcode='P0002';
  end if;
  update public.businesses set name=business_name, category=coalesce(nullif(business_category,''),'business'), status=business_status, updated_at=now()
    where id=target_business_id;
  update public.business_pages set slug=page_slug, template=page_template, updated_at=now()
    where id=target_page_id and business_id=target_business_id;
  if not found then raise exception 'page does not belong to business' using errcode='P0002'; end if;
  return jsonb_build_object('ok',true);
end; $$;

create or replace function public.update_business_page(
  target_business_id uuid,
  target_page_id uuid,
  business_name text,
  business_category text,
  business_status text,
  page_slug text,
  page_template text
) returns jsonb language sql security invoker set search_path='' as $$
  select private.update_business_page(target_business_id,target_page_id,business_name,business_category,business_status,page_slug,page_template);
$$;

revoke all on function private.update_business_page(uuid,uuid,text,text,text,text,text), public.update_business_page(uuid,uuid,text,text,text,text,text) from public, anon;
grant execute on function private.update_business_page(uuid,uuid,text,text,text,text,text), public.update_business_page(uuid,uuid,text,text,text,text,text) to authenticated;
notify pgrst, 'reload schema';
commit;
