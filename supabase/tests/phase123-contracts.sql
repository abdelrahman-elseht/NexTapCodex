-- Execute only on a verified isolated project. All mutations roll back.
begin;
select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from public.owner_users limit 1),'role','authenticated')::text, true);
set local role authenticated;
do $$
declare bid uuid; pid uuid; original jsonb; snapshot jsonb;
begin
  insert into public.businesses(name,category) values('Phase123 transaction QA','QA') returning id into bid;
  insert into public.business_pages(business_id,slug) values(bid,'phase123-sql-'||left(gen_random_uuid()::text,8)) returning id into pid;
  perform public.save_page_draft(bid,pid,'Phase123 transaction QA','QA','active','phase123-sql-'||left(pid::text,8),'professional',
    '[{"section_key":"hero","kind":"hero","title":"Hero","position":0,"enabled":true,"content":{"language":"ar"}}]',
    '{"instapay":{"url":"https://example.com/provider","destinationStrategy":"external_url"}}');
  if not exists(select 1 from public.businesses where id=bid and provider_profiles->'instapay'->>'url'='https://example.com/provider') then raise exception 'provider profiles lost'; end if;
  -- Supported legacy clients omit profiles; the overload must preserve them.
  perform public.save_page_draft(bid,pid,'Phase123 transaction QA','QA','active','phase123-sql-'||left(pid::text,8),'professional',
    '[{"section_key":"hero","kind":"hero","title":"Hero","position":0,"enabled":true,"content":{"language":"ar"}}]'::jsonb);
  if not exists(select 1 from public.businesses where id=bid and provider_profiles->'instapay'->>'url'='https://example.com/provider') then raise exception 'legacy save erased profiles'; end if;
  if public.get_published_page('phase123-sql-'||left(pid::text,8)) is not null then raise exception 'draft is public'; end if;
  perform public.publish_page(pid);
  select pp.snapshot into snapshot from public.page_publications pp where page_id=pid;
  if snapshot->'providerProfiles'->'instapay'->>'url'<>'https://example.com/provider' then raise exception 'published profile lost'; end if;
  select jsonb_agg(to_jsonb(s)) into original from public.page_sections s where page_id=pid;
  begin
    perform public.save_page_draft(bid,pid,'Failed edit','QA','active','phase123-sql-'||left(pid::text,8),'professional',
      '[{"section_key":"invalid","kind":"invalid","position":0,"enabled":true,"content":{}}]', '{}');
    raise exception 'invalid section accepted';
  exception when check_violation or invalid_parameter_value then null;
  end;
  if original is distinct from (select jsonb_agg(to_jsonb(s)) from public.page_sections s where page_id=pid) then raise exception 'partial save escaped transaction'; end if;
  if snapshot is distinct from (select pp.snapshot from public.page_publications pp where page_id=pid) then raise exception 'publication mutated'; end if;
end; $$;
reset role;
select set_config('request.jwt.claims', jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text, true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.businesses) or exists(select 1 from public.media_assets) or exists(select 1 from public.page_sections) then raise exception 'non-owner can read private rows'; end if;
  begin
    perform public.save_page_draft(gen_random_uuid(),gen_random_uuid(),'QA','QA','active','qa-denied','professional','[]','{}');
    raise exception 'non-owner save allowed';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
set local role anon;
do $$ begin
  if has_function_privilege('anon','public.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb,jsonb)','EXECUTE') then raise exception 'anon save grant'; end if;
  if has_function_privilege('anon','public.publish_page(uuid)','EXECUTE') then raise exception 'anon publish grant'; end if;
end; $$;
reset role;
rollback;
select 'phase123 transaction / RLS contracts passed' as result;
