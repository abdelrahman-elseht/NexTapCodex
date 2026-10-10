-- Phase 5 transaction contracts. Run against the isolated project with an
-- owner JWT in request.jwt.claims. The outer transaction is rolled back.
begin;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub',(select user_id from public.owner_users limit 1),'role','authenticated')::text, true);

create temporary table phase5_fixture(bid uuid, pid uuid, hero_id uuid, about_id uuid) on commit drop;
insert into phase5_fixture(bid,pid) values (gen_random_uuid(),gen_random_uuid());
insert into public.businesses(id,name,category) select bid,'Phase 5 QA','QA' from phase5_fixture;
insert into public.business_pages(id,business_id,slug,template)
select pid,bid,'phase5-'||left(pid::text,8),'professional' from phase5_fixture;

create temporary table phase5_first_result as
select public.save_page_draft(
  f.bid,f.pid,'Phase 5 QA','QA','active','phase5-'||left(f.pid::text,8),'professional',
  '[{"section_key":"hero","kind":"hero","title":"Hero","position":0,"enabled":true,"content":{"description":"one"}},
    {"section_key":"about","kind":"about","title":"About","position":1,"enabled":true,"content":{"description":"two"}}]'::jsonb,'{}'::jsonb
) as result from phase5_fixture f;
update phase5_fixture f set hero_id=s.id from public.page_sections s where s.page_id=f.pid and s.section_key='hero';
update phase5_fixture f set about_id=s.id from public.page_sections s where s.page_id=f.pid and s.section_key='about';
select (result->>'ok')::boolean as committed,
       jsonb_array_length(coalesce(result->'sections','[]'::jsonb))=2 as returned_two_sections
from phase5_first_result;

select public.save_page_draft(
  f.bid,f.pid,'Phase 5 QA','QA','active','phase5-'||left(f.pid::text,8),'professional',
  '[{"section_key":"about","kind":"about","title":"About","position":0,"enabled":true,"content":{"description":"two"}},
    {"section_key":"hero","kind":"hero","title":"Hero","position":1,"enabled":true,"content":{"description":"changed"}}]'::jsonb,'{}'::jsonb
) as reorder_result from phase5_fixture f;
select f.hero_id=(select id from public.page_sections where page_id=f.pid and section_key='hero') as hero_id_retained,
       f.about_id=(select id from public.page_sections where page_id=f.pid and section_key='about') as about_id_retained,
       (select position from public.page_sections where id=f.hero_id)=1 as reorder_committed
from phase5_fixture f;

select public.save_page_draft(
  f.bid,f.pid,'Phase 5 QA','QA','active','phase5-'||left(f.pid::text,8),'professional',
  '[{"section_key":"hero","kind":"hero","title":"Hero","position":0,"enabled":true,"content":{}},
    {"section_key":"contact","kind":"contact","title":"Contact","position":1,"enabled":true,"content":{}}]'::jsonb,'{}'::jsonb
) as add_remove_result from phase5_fixture f;
select exists(select 1 from public.page_sections s join phase5_fixture f on f.pid=s.page_id and s.id=f.hero_id) as retained_after_add,
       not exists(select 1 from public.page_sections s join phase5_fixture f on f.pid=s.page_id and s.section_key='about') as removed_about
from phase5_fixture limit 1;

-- Invalid-kind rollback is exercised separately because an expected RPC error
-- aborts a PostgREST SQL request; the fixture above remains fully runnable.
rollback;
