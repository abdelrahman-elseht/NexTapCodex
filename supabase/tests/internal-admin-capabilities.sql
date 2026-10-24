begin;
insert into auth.users values ('00000000-0000-4000-8000-000000000071'),('00000000-0000-4000-8000-000000000072');
do $$ begin
  begin
    insert into public.owner_users(user_id) values ('00000000-0000-4000-8000-000000000071');
    raise exception 'unapproved admission accepted';
  exception when foreign_key_violation then null; end;
end; $$;
insert into private.admin_admissions(user_id,role,reason) values ('00000000-0000-4000-8000-000000000071','editor','Explicit disposable internal editor approval');
insert into public.owner_users(user_id,admin_role) values ('00000000-0000-4000-8000-000000000071','editor');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000071',true);
do $$ declare a uuid; b uuid; p uuid; begin
  assert public.admin_has_capability('read') and public.admin_has_capability('edit') and public.admin_has_capability('media');
  assert not public.admin_has_capability('publish') and not public.admin_has_capability('inventory') and not public.admin_has_capability('delete');
  insert into public.businesses(name) values ('Shared team A') returning id into a;
  insert into public.businesses(name) values ('Shared team B') returning id into b;
  assert (select count(*) from public.businesses where id in (a,b))=2,'global internal access';
  insert into public.business_pages(business_id,slug) values (a,'internal-editor-contract') returning id into p;
  begin perform public.publish_page(p); raise exception 'editor published through RPC'; exception when insufficient_privilege then null; end;
  begin update public.business_pages set is_active=true where id=p; raise exception 'editor activated through direct write'; exception when insufficient_privilege then null; end;
  begin perform public.create_card_batch('Denied',1,gen_random_uuid(),array[repeat('Q',40)]); raise exception 'editor manufactured cards'; exception when insufficient_privilege then null; end;
  begin update public.owner_users set admin_role='administrator' where user_id=auth.uid(); raise exception 'self-promotion accepted'; exception when insufficient_privilege then null; end;
  begin insert into private.admin_admissions(user_id,role,reason) values ('00000000-0000-4000-8000-000000000072','administrator','Untrusted self-admission attempt'); raise exception 'browser admission accepted'; exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000072',true);
do $$ begin
 assert not public.admin_has_capability('read');
 assert not exists(select 1 from public.businesses);
 begin insert into public.businesses(name) values ('Denied'); raise exception 'external write accepted'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
insert into auth.users values ('00000000-0000-4000-8000-000000000073'),('00000000-0000-4000-8000-000000000074'),('00000000-0000-4000-8000-000000000075');
insert into private.admin_admissions(user_id,role,reason) values
 ('00000000-0000-4000-8000-000000000073','publisher','Explicit disposable publisher approval'),
 ('00000000-0000-4000-8000-000000000074','inventory','Explicit disposable inventory approval'),
 ('00000000-0000-4000-8000-000000000075','auditor','Explicit disposable auditor approval');
insert into public.owner_users(user_id,admin_role) select user_id,role from private.admin_admissions where user_id in ('00000000-0000-4000-8000-000000000073','00000000-0000-4000-8000-000000000074','00000000-0000-4000-8000-000000000075');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000073',true);
do $$ begin
 assert public.admin_has_capability('publish') and public.admin_has_capability('edit') and public.admin_has_capability('media');
 assert not public.admin_has_capability('inventory') and not public.admin_has_capability('export') and not public.admin_has_capability('delete');
 begin perform public.preview_card_deletion(null,null); raise exception 'publisher deletion accepted'; exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000074',true);
do $$ declare batch jsonb; bid uuid; begin
 assert public.admin_has_capability('inventory') and public.admin_has_capability('export') and public.admin_has_capability('read');
 assert not public.admin_has_capability('edit') and not public.admin_has_capability('publish') and not public.admin_has_capability('media') and not public.admin_has_capability('delete');
 batch := public.create_card_batch('Role matrix',1,gen_random_uuid(),array[repeat('R',40)]);
 bid := (batch->>'id')::uuid;
 assert public.card_batch_snapshot(bid) is not null;
 begin delete from public.card_batches where id=bid; raise exception 'inventory deletion accepted'; exception when insufficient_privilege then null; end;
 begin perform public.preview_card_deletion(null,bid); raise exception 'inventory deletion RPC accepted'; exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000075',true);
do $$ begin
 assert public.admin_has_capability('read') and not public.admin_has_capability('edit') and not public.admin_has_capability('export');
 assert exists(select 1 from public.businesses where name='Shared team B');
 assert public.card_batch_snapshot((select id from public.card_batches where name='Role matrix')) is null;
 begin insert into public.businesses(name) values ('Auditor write denied'); raise exception 'auditor write accepted'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
rollback;
