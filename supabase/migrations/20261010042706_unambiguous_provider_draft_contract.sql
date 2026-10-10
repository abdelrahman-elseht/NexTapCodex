-- PostgREST cannot choose an eight-argument overload when the ninth argument
-- on another overload has a default. Keep the legacy RPC and its behavior,
-- including preservation of provider profiles; require an explicit ninth
-- argument only for the newer RPC. Private authorization remains unchanged.
begin;
drop function public.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb,jsonb);
create function public.save_page_draft(
  target_business_id uuid, target_page_id uuid, business_name text, business_category text,
  business_status text, page_slug text, page_template text, section_rows jsonb,
  target_provider_profiles jsonb
) returns jsonb language sql security invoker set search_path='' as $$
  select private.save_page_draft(target_business_id,target_page_id,business_name,business_category,
    business_status,page_slug,page_template,section_rows,target_provider_profiles);
$$;
revoke all on function public.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb,jsonb) from public,anon;
grant execute on function public.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
