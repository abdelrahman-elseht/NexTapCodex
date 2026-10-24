begin;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
insert into public.businesses(id,name) values ('00000000-0000-4000-8000-000000000081','Media privacy fixture');
insert into public.business_pages(id,business_id,slug) values ('00000000-0000-4000-8000-000000000082','00000000-0000-4000-8000-000000000081','media-privacy-contract');
insert into public.page_sections(page_id,section_key,kind,position,content) values
 ('00000000-0000-4000-8000-000000000082','hero','hero',0,'{"logoUrl":"https://flkakuysakgwfoemgbwn.supabase.co/storage/v1/object/public/business-media/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000081/00000000-0000-4000-8000-000000000083.webp"}');
insert into storage.objects(bucket_id,name) values
 ('business-media','00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000081/00000000-0000-4000-8000-000000000083.webp'),
 ('business-media','00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000081/00000000-0000-4000-8000-000000000084.webp');
grant usage on schema storage to anon,authenticated;
grant select,insert,delete,update on storage.objects to anon,authenticated;
set local role anon;
do $$ begin
 assert not exists(select 1 from storage.objects where bucket_id='business-media'),'draft accessible anonymously';
end; $$;
reset role;
set local role authenticated;
do $$ begin
 assert (select count(*) from storage.objects where bucket_id='business-media')=2,'internal draft read denied';
end; $$;
insert into storage.objects(bucket_id,name) values
 ('business-media','00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000081/00000000-0000-4000-8000-000000000085.webp');
do $$ begin
 assert exists(select 1 from storage.objects where name like '%85.webp'),'owner media upload denied';
end; $$;
select public.publish_page('00000000-0000-4000-8000-000000000082');
set local role anon;
do $$ begin
 assert (select count(*) from storage.objects where bucket_id='business-media')=1,'publication visibility incorrect';
 assert exists(select 1 from storage.objects where name like '%83.webp'),'published media unavailable';
end; $$;
reset role;
set local role authenticated;
do $$ declare n integer; begin
 delete from storage.objects where name like '%83.webp'; get diagnostics n=row_count; assert n=0,'published asset deleted';
 update storage.objects set name='replacement' where name like '%83.webp'; get diagnostics n=row_count; assert n=0,'published asset overwritten';
 update public.page_sections set content=jsonb_build_object('logoUrl','https://flkakuysakgwfoemgbwn.supabase.co/storage/v1/object/public/business-media/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000081/00000000-0000-4000-8000-000000000084.webp') where page_id='00000000-0000-4000-8000-000000000082';
 perform public.publish_page('00000000-0000-4000-8000-000000000082');
 delete from storage.objects where name like '%83.webp'; get diagnostics n=row_count; assert n=0,'historical asset deleted';
end; $$;
set local role anon;
do $$ begin
 assert (select count(*) from storage.objects where bucket_id='business-media')=1;
 assert exists(select 1 from storage.objects where name like '%84.webp'),'replacement unavailable';
end; $$;
reset role;
update public.business_pages set is_active=false where id='00000000-0000-4000-8000-000000000082';
set local role anon;
do $$ begin assert not exists(select 1 from storage.objects where bucket_id='business-media'),'disabled page media still public'; end; $$;
reset role;
rollback;
