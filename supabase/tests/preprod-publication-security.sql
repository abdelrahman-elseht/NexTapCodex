-- Executed by the disposable database harness; all fixture mutations roll back.
begin;
select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from public.owner_users limit 1),'role','authenticated')::text,true);
create temporary table publication_fixture(bid uuid, pid uuid, first_id uuid, second_id uuid);
grant select on publication_fixture to anon,authenticated;
insert into publication_fixture(bid,pid) values(gen_random_uuid(),gen_random_uuid());
insert into public.businesses(id,name) select bid,'Preprod SQL fixture' from publication_fixture;
insert into public.business_pages(id,business_id,slug) select pid,bid,'preprod-sql' from publication_fixture;
insert into public.page_sections(page_id,section_key,kind,position,content)
  select pid,'hero','hero',0,'{"language":"ar"}' from publication_fixture;

set local role anon;
do $$ begin
  if public.get_publication_pointer('preprod-sql') is not null then raise exception 'draft pointer leaked'; end if;
end $$;
reset role;
select public.publish_page(pid) from publication_fixture;
update publication_fixture f set first_id=p.published_snapshot_id from public.business_pages p where p.id=f.pid;

set local role anon;
do $$ declare publication uuid := (select first_id from publication_fixture); begin
  if (public.get_publication_pointer('preprod-sql')->>'publicationId')::uuid is distinct from publication then raise exception 'live pointer missing'; end if;
  if public.get_publication_snapshot(publication) is null then raise exception 'live snapshot missing'; end if;
  begin
    perform * from public.page_sections;
    raise exception 'anonymous draft table read allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.business_pages set slug='preprod-renamed' where id=(select pid from publication_fixture);
select public.publish_page(pid) from publication_fixture;
update publication_fixture f set second_id=p.published_snapshot_id from public.business_pages p where p.id=f.pid;

set local role anon;
do $$ begin
  if public.get_publication_snapshot((select first_id from publication_fixture)) is not null then raise exception 'superseded snapshot leaked'; end if;
  if public.get_publication_snapshot((select second_id from publication_fixture)) is null then raise exception 'new publication missing'; end if;
  if (public.get_publication_pointer('preprod-sql')->>'isAlias')::boolean is distinct from true then raise exception 'permanent slug alias lost'; end if;
end $$;
reset role;
update public.business_pages set is_active=false where id=(select pid from publication_fixture);
set local role anon;
do $$ begin
  if public.get_publication_pointer('preprod-renamed') is not null or public.get_publication_snapshot((select second_id from publication_fixture)) is not null then raise exception 'disabled page leaked'; end if;
end $$;
reset role;
update public.business_pages set is_active=true where id=(select pid from publication_fixture);
update public.businesses set status='archived' where id=(select bid from publication_fixture);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
  if exists(select 1 from public.businesses) then raise exception 'non-owner read allowed'; end if;
  if public.get_publication_pointer('preprod-renamed') is not null or public.get_publication_snapshot((select second_id from publication_fixture)) is not null then raise exception 'archived page leaked'; end if;
  begin
    perform public.create_card_batch('Denied batch',1,gen_random_uuid(),array[repeat('a',32)]);
    raise exception 'non-owner card batch creation allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
