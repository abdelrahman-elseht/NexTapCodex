-- Rolled-back fixtures: no dependency on hosted records or real card tokens.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$
declare b jsonb; preview jsonb; result jsonb; again jsonb; ids uuid[]; survivor uuid;
  request_id uuid:=gen_random_uuid(); original_serial text; next_batch jsonb; batch_code text;
begin
  b := public.create_card_batch('Deletion contract',3,request_id,array[repeat('D',32),repeat('E',32),repeat('F',32)]);
  select array_agg(id order by serial),max(serial) into ids,original_serial from public.cards where batch_id=(b->>'id')::uuid;
  survivor:=ids[1];
  perform public.assign_card(ids[2],null,'disabled','deactivation');
  preview:=public.preview_card_deletion(array[ids[2],ids[3],ids[3]],null);
  assert (preview->>'count')::int=2,'deduplicated explicit scope';
  begin
    perform public.commit_card_deletion((preview->>'operationId')::uuid,false,false,null);
    raise exception 'missing acknowledgement accepted';
  exception when invalid_parameter_value then null; end;
  result:=public.commit_card_deletion((preview->>'operationId')::uuid,true,false,null);
  again:=public.commit_card_deletion((preview->>'operationId')::uuid,true,false,null);
  assert result=again,'retry must return identical receipt';
  assert (result->>'deletedCards')::int=2 and (result->>'deletedHistory')::int=1,'exact history/card removal';
  assert exists(select 1 from public.cards where id=survivor),'survivor stable';
  assert jsonb_array_length(public.card_batch_snapshot((b->>'id')::uuid)->'cards')=1,'partial snapshot';
  assert (public.resolve_card(repeat('F',32))->>'state')='invalid','removed public token';
  preview:=public.preview_card_deletion(array[survivor],null);
  perform public.assign_card(survivor,null,'replaced','replacement');
  begin
    perform public.commit_card_deletion((preview->>'operationId')::uuid,true,false,null);
    raise exception 'stale confirmation accepted';
  exception when serialization_failure then null; end;
  preview:=public.preview_card_deletion(array[survivor],null);
  perform public.commit_card_deletion((preview->>'operationId')::uuid,true,false,null);
  assert jsonb_array_length(public.card_batch_snapshot((b->>'id')::uuid)->'cards')=0,'empty batch retained';
  next_batch:=public.create_card_batch('After removal',1,gen_random_uuid(),array[repeat('G',32)]);
  assert (select serial>original_serial from public.cards where batch_id=(next_batch->>'id')::uuid),'serial high water retained';
  preview:=public.preview_card_deletion(null,(b->>'id')::uuid);
  begin
    perform public.commit_card_deletion((preview->>'operationId')::uuid,true,false,'WRONG');
    raise exception 'incorrect batch code accepted';
  exception when invalid_parameter_value then null; end;
  perform public.commit_card_deletion((preview->>'operationId')::uuid,true,false,b->>'batch_code');
  assert public.card_batch_snapshot((b->>'id')::uuid) is null,'deleted batch is missing';
  begin
    perform public.create_card_batch('Deletion contract',3,request_id,array[repeat('H',32),repeat('I',32),repeat('J',32)]);
    raise exception 'deleted creation resurrected';
  exception when no_data_found then null; end;
  begin
    delete from public.cards where id=survivor;
    raise exception 'unguarded delete allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_card_batch('Reused token',1,gen_random_uuid(),array[repeat('F',32)]);
    raise exception 'old token reused';
  exception when unique_violation then null; end;
end; $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ begin
  begin perform public.preview_card_deletion(array[gen_random_uuid()],null); raise exception 'nonowner preview accepted';
  exception when insufficient_privilege then null; end;
  begin perform public.commit_card_deletion(gen_random_uuid(),true,true,null); raise exception 'nonowner commit accepted';
  exception when insufficient_privilege then null; end;
end; $$;
set local role anon;
do $$ begin
  begin perform public.preview_card_deletion(array[gen_random_uuid()],null); raise exception 'anon preview accepted';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
-- Expiry, actor binding, all statuses, legacy large batches and RPC creation.
insert into public.owner_users(user_id) values('00000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$
declare creation jsonb; again jsonb; b jsonb; p jsonb; ids uuid[]; key uuid:=gen_random_uuid(); signature jsonb;
begin
  signature:=jsonb_build_object('name','Deletion business fixture','slug','deletion-fixture-'||left(key::text,8),'template','professional');
  creation:=public.create_admin_page(key,signature,'[{"kind":"hero","content":{}}]');
  again:=public.create_admin_page(key,signature,'[{"kind":"hero","content":{}}]');
  assert creation=again,'business request replay';
  perform public.publish_page((creation->>'pageId')::uuid);
  b:=public.create_card_batch('All statuses',4,gen_random_uuid(),array[repeat('K',32),repeat('L',32),repeat('M',32),repeat('N',32)]);
  select array_agg(id order by serial) into ids from public.cards where batch_id=(b->>'id')::uuid;
  key:=gen_random_uuid();
  again:=public.assign_card_once(ids[2],(creation->>'pageId')::uuid,'active','activation',key);
  assert again=public.assign_card_once(ids[2],(creation->>'pageId')::uuid,'active','activation',key),'assignment replay';
  assert (select count(*) from public.card_assignment_history where card_id=ids[2])=1,'assignment replay no duplicate history';
  perform public.assign_card(ids[3],null,'disabled','deactivation');
  perform public.assign_card(ids[4],null,'replaced','replacement');
  p:=public.preview_card_deletion(null,(b->>'id')::uuid);
  assert (p->>'count')::int=4 and (p->>'activeCount')::int=1,'whole batch all statuses';
  begin
    perform public.commit_card_deletion((p->>'operationId')::uuid,true,false,b->>'batch_code');
    raise exception 'active deletion without impact acknowledgement';
  exception when invalid_parameter_value then null; end;
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
  begin
    perform public.commit_card_deletion((p->>'operationId')::uuid,true,true,b->>'batch_code');
    raise exception 'cross-owner confirmation accepted';
  exception when no_data_found then null; end;
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
  again:=public.commit_card_deletion((p->>'operationId')::uuid,true,true,b->>'batch_code');
  assert (again->>'deletedCards')::int=4,'whole membership removed';
  assert exists(select 1 from public.business_pages where id=(creation->>'pageId')::uuid),'page survives';
  assert exists(select 1 from public.page_publications where page_id=(creation->>'pageId')::uuid),'publication survives';
  assert not exists(select 1 from public.cards where id=any(ids)),'all statuses removed';
  begin
    perform public.create_admin_page(gen_random_uuid(),null,null);
    raise exception 'null creation accepted';
  exception when invalid_parameter_value then null; end;
end; $$;
reset role;
do $$
declare b uuid; p jsonb; original_count bigint; today text:=to_char(current_date,'YYYYMMDD');
begin
  insert into public.card_batches(name,quantity,created_by,batch_code) values('Legacy large batch',1001,auth.uid(),'LEGACY-TEST') returning id into b;
  select coalesce((select issued from private.card_serial_counters where day=today),0) into original_count;
  insert into public.cards(batch_id,serial,token) select b,'NT-'||today||'-'||lpad((original_count+i)::text,6,'0'),md5(i::text||b::text) from generate_series(1,1001) i order by i;
  p:=public.preview_card_deletion(null,b);
  assert (p->>'count')::int=1001,'preview includes rows beyond PostgREST cap';
  assert jsonb_array_length(public.card_batch_snapshot(b)->'cards')=1001,'complete legacy export snapshot';
  update private.card_deletion_operations set expires_at=clock_timestamp()-interval '1 second' where id=(p->>'operationId')::uuid;
  begin
    perform public.commit_card_deletion((p->>'operationId')::uuid,true,true,'LEGACY-TEST');
    raise exception 'expired confirmation accepted';
  exception when serialization_failure then null; end;
  assert (select count(*) from public.cards where batch_id=b)=1001,'expired preview changes nothing';
  p:=public.preview_card_deletion(null,b);
  perform public.commit_card_deletion((p->>'operationId')::uuid,true,true,'LEGACY-TEST');
  assert not exists(select 1 from public.cards where batch_id=b),'large batch complete deletion';
  update private.card_serial_counters set issued=999999 where day=today;
  begin
    perform public.create_card_batch('Capacity',1,gen_random_uuid(),array[repeat('P',32)]);
    raise exception 'daily capacity overflow accepted';
  exception when invalid_parameter_value then null; end;
end; $$;
select not has_table_privilege('authenticated','private.card_deletion_operations','SELECT') as private_receipts,
  not has_table_privilege('authenticated','public.card_batches','DELETE') as guarded_batches,
  not has_table_privilege('anon','private.card_token_issuance','SELECT') as private_fingerprints;
rollback;
