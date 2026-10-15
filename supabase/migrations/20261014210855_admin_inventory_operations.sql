-- Inventory removal is an owner-only transaction. Private issuance and receipts
-- deliberately survive deletion; none contains a raw card token.
alter table public.cards add column inventory_revision bigint not null default 0;
create function private.advance_card_revision() returns trigger language plpgsql set search_path='' as $$
begin new.inventory_revision := old.inventory_revision+1; return new; end; $$;
revoke all on function private.advance_card_revision() from public,anon,authenticated;
create trigger cards_advance_revision before update on public.cards for each row execute function private.advance_card_revision();
create table private.card_serial_counters (
  day text primary key check (day ~ '^[0-9]{8}$'),
  issued integer not null check (issued between 0 and 999999)
);
insert into private.card_serial_counters(day, issued)
select substring(serial from 4 for 8), max(substring(serial from 13 for 6)::integer)
from public.cards group by 1;
create table private.card_token_issuance (fingerprint bytea primary key);
insert into private.card_token_issuance select extensions.digest(token, 'sha256') from public.cards;
create table private.card_batch_requests (
  actor uuid not null, request_id uuid not null, batch_id uuid not null,
  name text not null, quantity integer not null, primary key(actor, request_id)
);
insert into private.card_batch_requests
select created_by,idempotency_key,id,name,quantity from public.card_batches where idempotency_key is not null;
create table private.card_deletion_operations (
  id uuid primary key default gen_random_uuid(), actor uuid not null,
  batch_id uuid, card_ids uuid[], fingerprint text,
  expires_at timestamptz not null default (clock_timestamp() + interval '10 minutes'),
  result jsonb, created_at timestamptz not null default now(), committed_at timestamptz
);
create index card_deletion_expiry_idx on private.card_deletion_operations(expires_at) where result is null;
alter table private.card_serial_counters enable row level security;
alter table private.card_token_issuance enable row level security;
alter table private.card_batch_requests enable row level security;
alter table private.card_deletion_operations enable row level security;
revoke all on private.card_serial_counters,private.card_token_issuance,private.card_batch_requests,private.card_deletion_operations from public,anon,authenticated;
revoke delete,truncate on public.cards,public.card_batches,public.card_assignment_history from public,anon,authenticated;

-- Also guard legitimate direct owner INSERTs, so they cannot bypass issuance.
create function private.record_card_issuance() returns trigger
language plpgsql security definer set search_path='' as $$
declare d text := substring(new.serial from 4 for 8); n integer := substring(new.serial from 13 for 6)::integer; last_issued integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('nextap-card-serial-' || d,0));
  insert into private.card_serial_counters values(d,0) on conflict do nothing;
  select issued into last_issued from private.card_serial_counters where day=d for update;
  if n <= last_issued then raise exception 'serial already issued' using errcode='23505'; end if;
  insert into private.card_token_issuance values(extensions.digest(new.token,'sha256'));
  update private.card_serial_counters set issued=n where day=d;
  return new;
end; $$;
revoke all on function private.record_card_issuance() from public,anon,authenticated;
create trigger cards_record_issuance before insert on public.cards for each row execute function private.record_card_issuance();

create function private.create_card_batch(batch_name text,card_quantity integer,request_key uuid,card_tokens text[]) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare actor uuid := auth.uid(); receipt private.card_batch_requests; b public.card_batches;
  d text := to_char(current_date,'YYYYMMDD'); first_serial integer; batch_number bigint;
begin
  if actor is null or not private.is_owner() then raise exception 'not authorized' using errcode='42501'; end if;
  if request_key is null or batch_name is null or char_length(btrim(batch_name)) not between 1 and 100
    or batch_name ~ '[[:cntrl:]]' or card_quantity is null or card_quantity not between 1 and 1000
  then raise exception 'invalid batch request' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('batch-idempotency-'||actor::text||'-'||request_key::text,0));
  select * into receipt from private.card_batch_requests r where r.actor=auth.uid() and r.request_id=request_key;
  if found then
    if receipt.name <> btrim(batch_name) or receipt.quantity <> card_quantity then raise exception 'request changed' using errcode='40001'; end if;
    select * into b from public.card_batches where id=receipt.batch_id;
    if not found then raise exception 'created batch was deleted' using errcode='P0002'; end if;
    return to_jsonb(b)||jsonb_build_object('created',false);
  end if;
  if card_tokens is null or cardinality(card_tokens) <> card_quantity
    or exists(select 1 from unnest(card_tokens) t where t is null or t !~ '^[A-Za-z0-9_-]{32,64}$')
    or (select count(distinct t) from unnest(card_tokens) t) <> card_quantity
  then raise exception 'invalid card tokens' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('nextap-card-serial-'||d,0));
  select coalesce((select issued from private.card_serial_counters where day=d),0) into first_serial;
  if first_serial+card_quantity > 999999 then raise exception 'daily serial capacity exceeded' using errcode='22023'; end if;
  batch_number := nextval('public.card_batch_code_seq');
  insert into public.card_batches(name,quantity,created_by,batch_code,idempotency_key)
  values(btrim(batch_name),card_quantity,actor,'BATCH-'||lpad(batch_number::text,greatest(3,length(batch_number::text)),'0'),request_key) returning * into b;
  insert into public.cards(batch_id,serial,token,status)
  select b.id,'NT-'||d||'-'||lpad((first_serial+t.n)::text,6,'0'),t.token,'unassigned'
  from unnest(card_tokens) with ordinality t(token,n) order by t.n;
  insert into private.card_batch_requests values(actor,request_key,b.id,b.name,b.quantity);
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(actor,'cards.batch_create','card_batch',b.id,jsonb_build_object('quantity',card_quantity,'batchCode',b.batch_code));
  return to_jsonb(b)||jsonb_build_object('created',true);
end; $$;
create or replace function public.create_card_batch(batch_name text,card_quantity integer,request_key uuid,card_tokens text[]) returns jsonb
language sql security invoker set search_path='' as $$ select private.create_card_batch(batch_name,card_quantity,request_key,card_tokens); $$;
revoke all on function private.create_card_batch(text,integer,uuid,text[]) from public,anon;
grant execute on function private.create_card_batch(text,integer,uuid,text[]) to authenticated;

-- A single statement snapshot contains the complete membership, including legacy
-- batches larger than PostgREST's row limit. It distinguishes missing from empty.
create function public.card_batch_snapshot(target_batch uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('batch',to_jsonb(b),'cards',coalesce((
    select jsonb_agg(jsonb_build_object('id',c.id,'serial',c.serial,'token',c.token,'status',c.status) order by c.serial)
    from public.cards c where c.batch_id=b.id),'[]'::jsonb))
  from public.card_batches b where b.id=target_batch and private.is_owner();
$$;
revoke all on function public.card_batch_snapshot(uuid) from public,anon;
grant execute on function public.card_batch_snapshot(uuid) to authenticated;

-- Fingerprints include monotonic row revisions, not tokens. Even change-and-revert of an
-- assignment invalidates a previously acknowledged impact.
create function private.card_deletion_state(ids uuid[], bid uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'cards',coalesce(jsonb_agg(jsonb_build_object('id',c.id,'serial',c.serial,'batchId',c.batch_id,'status',c.status,'assigned',c.page_id is not null) order by c.id),'[]'::jsonb),
    'count',count(*),'assignedCount',count(*) filter(where c.page_id is not null),'activeCount',count(*) filter(where c.status='active'),
    'fingerprint',encode(extensions.digest(coalesce(string_agg(c.id::text||':'||c.inventory_revision::text||':'||c.status||':'||coalesce(c.page_id::text,''),',' order by c.id),'')||':'||coalesce((select b.batch_code from public.card_batches b where b.id=bid),''),'sha256'),'hex'))
  from public.cards c where (bid is not null and c.batch_id=bid) or (bid is null and c.id=any(ids));
$$;
revoke all on function private.card_deletion_state(uuid[],uuid) from public,anon,authenticated;

create function private.preview_card_deletion(card_ids uuid[],batch_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare ids uuid[]; state jsonb; operation private.card_deletion_operations; b public.card_batches;
begin
  if auth.uid() is null or not private.is_owner() then raise exception 'not authorized' using errcode='42501'; end if;
  if (batch_id is null) = (card_ids is null) or (card_ids is not null and (cardinality(card_ids) not between 1 and 1000 or array_position(card_ids,null) is not null)) then
    raise exception 'invalid deletion scope' using errcode='22023'; end if;
  select array_agg(distinct id order by id) into ids from unnest(card_ids) id;
  -- Batch first, then card UUID order. FK key-share locks serialize new members.
  perform 1 from public.card_batches b where b.id=batch_id or b.id in (select c.batch_id from public.cards c where c.id=any(ids)) order by b.id for update;
  if batch_id is not null then
    select * into b from public.card_batches where id=batch_id;
    if not found then raise exception 'batch not found' using errcode='P0002'; end if;
  end if;
  perform 1 from public.cards c where (batch_id is not null and c.batch_id=batch_id) or (batch_id is null and c.id=any(ids)) order by c.id for update;
  state := private.card_deletion_state(ids,batch_id);
  if batch_id is null and (state->>'count')::integer <> cardinality(ids) then raise exception 'card not found' using errcode='P0002'; end if;
  -- Expired previews carry no useful intent; bound retention without touching receipts.
  delete from private.card_deletion_operations where expires_at < clock_timestamp() and result is null;
  insert into private.card_deletion_operations(actor,batch_id,card_ids,fingerprint)
  values(auth.uid(),batch_id,ids,state->>'fingerprint') returning * into operation;
  return (state-'fingerprint')||jsonb_build_object('operationId',operation.id,'expiresAt',operation.expires_at,'batchCode',b.batch_code,'batchId',batch_id);
end; $$;

create function private.commit_card_deletion(operation_id uuid,acknowledged boolean,impact_acknowledged boolean,batch_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare op private.card_deletion_operations; state jsonb; ids uuid[]; affected uuid[]; b public.card_batches; history_count integer; result jsonb;
begin
  if auth.uid() is null or not private.is_owner() then raise exception 'not authorized' using errcode='42501'; end if;
  select * into op from private.card_deletion_operations where id=operation_id and actor=auth.uid() for update;
  if not found then raise exception 'confirmation not found' using errcode='P0002'; end if;
  if op.result is not null then return op.result; end if;
  if not coalesce(acknowledged,false) then raise exception 'confirmation required' using errcode='22023'; end if;
  if op.expires_at <= clock_timestamp() then raise exception 'confirmation expired' using errcode='40001'; end if;
  perform 1 from public.card_batches b where b.id=op.batch_id or b.id in (select c.batch_id from public.cards c where c.id=any(op.card_ids)) order by b.id for update;
  if op.batch_id is not null then
    select * into b from public.card_batches where id=op.batch_id;
    if not found then raise exception 'scope changed' using errcode='40001'; end if;
    if batch_code is distinct from b.batch_code then raise exception 'batch code required' using errcode='22023'; end if;
  end if;
  perform 1 from public.cards c where (op.batch_id is not null and c.batch_id=op.batch_id) or (op.batch_id is null and c.id=any(op.card_ids)) order by c.id for update;
  state := private.card_deletion_state(op.card_ids,op.batch_id);
  if state->>'fingerprint' is distinct from op.fingerprint then raise exception 'scope changed' using errcode='40001'; end if;
  if ((state->>'assignedCount')::integer > 0 or (state->>'activeCount')::integer > 0) and not coalesce(impact_acknowledged,false) then
    raise exception 'active assignment acknowledgement required' using errcode='22023'; end if;
  select array_agg(c.id order by c.id),array_agg(distinct c.batch_id order by c.batch_id) into ids,affected
  from public.cards c where (op.batch_id is not null and c.batch_id=op.batch_id) or (op.batch_id is null and c.id=any(op.card_ids));
  delete from public.card_assignment_history where card_id=any(ids);
  get diagnostics history_count = row_count;
  delete from public.cards where id=any(ids);
  if op.batch_id is not null then delete from public.card_batches where id=op.batch_id; end if;
  result := jsonb_build_object('ok',true,'operationId',op.id,'deletedCards',coalesce(cardinality(ids),0),'deletedHistory',history_count,'deletedBatchId',op.batch_id,
    'batches',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'quantity',b.quantity,'remaining',(select count(*) from public.cards c where c.batch_id=b.id))) from public.card_batches b where b.id=any(affected)),'[]'::jsonb));
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),'inventory.delete',case when op.batch_id is null then 'cards' else 'card_batch' end,coalesce(op.batch_id,case when cardinality(ids)=1 then ids[1] end),
    jsonb_build_object('requestId',op.id,'cards',coalesce(cardinality(ids),0),'history',history_count));
  update private.card_deletion_operations set result=result,card_ids=null,fingerprint=null,committed_at=now() where id=op.id;
  return result;
end; $$;
create function public.preview_card_deletion(card_ids uuid[] default null,batch_id uuid default null) returns jsonb
language sql security invoker set search_path='' as $$ select private.preview_card_deletion(card_ids,batch_id); $$;
create function public.commit_card_deletion(operation_id uuid,acknowledged boolean,impact_acknowledged boolean default false,batch_code text default null) returns jsonb
language sql security invoker set search_path='' as $$ select private.commit_card_deletion(operation_id,acknowledged,impact_acknowledged,batch_code); $$;
revoke all on function private.preview_card_deletion(uuid[],uuid),private.commit_card_deletion(uuid,boolean,boolean,text),public.preview_card_deletion(uuid[],uuid),public.commit_card_deletion(uuid,boolean,boolean,text) from public,anon;
grant execute on function private.preview_card_deletion(uuid[],uuid),private.commit_card_deletion(uuid,boolean,boolean,text),public.preview_card_deletion(uuid[],uuid),public.commit_card_deletion(uuid,boolean,boolean,text) to authenticated;

-- Creation/assignment receipts prevent duplicate side effects after a response loss.
create table private.admin_operation_receipts (
  actor uuid not null, request_id uuid not null, kind text not null,
  fingerprint text not null, result jsonb not null, created_at timestamptz not null default now(),
  primary key(actor,request_id)
);
alter table private.admin_operation_receipts enable row level security;
revoke all on private.admin_operation_receipts from public,anon,authenticated;
create function private.assign_card_once(card_id uuid,target_page_id uuid,next_status text,change_reason text,request_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare receipt private.admin_operation_receipts; signature text; result jsonb;
begin
  if auth.uid() is null or not private.is_owner() then raise exception 'not authorized' using errcode='42501'; end if;
  if request_key is null then raise exception 'request required' using errcode='22023'; end if;
  signature:=md5(jsonb_build_array(card_id,target_page_id,next_status,change_reason)::text);
  perform pg_advisory_xact_lock(hashtextextended('admin-operation-'||auth.uid()::text||request_key::text,0));
  select * into receipt from private.admin_operation_receipts r where r.actor=auth.uid() and r.request_id=request_key;
  if found then
    if receipt.kind<>'assignment' or receipt.fingerprint<>signature then raise exception 'request changed' using errcode='40001'; end if;
    return receipt.result;
  end if;
  perform private.assign_card(card_id,target_page_id,next_status,change_reason);
  select jsonb_build_object('ok',true,'card',jsonb_build_object('id',c.id,'status',c.status,'page_id',c.page_id,'revision',c.inventory_revision)) into result from public.cards c where c.id=card_id;
  insert into private.admin_operation_receipts values(auth.uid(),request_key,'assignment',signature,result,now());
  return result;
end; $$;
create function public.assign_card_once(card_id uuid,target_page_id uuid,next_status text,change_reason text,request_key uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.assign_card_once(card_id,target_page_id,next_status,change_reason,request_key); $$;
revoke all on function private.assign_card_once(uuid,uuid,text,text,uuid),public.assign_card_once(uuid,uuid,text,text,uuid) from public,anon;
grant execute on function private.assign_card_once(uuid,uuid,text,text,uuid),public.assign_card_once(uuid,uuid,text,text,uuid) to authenticated;

create function private.create_admin_page(request_key uuid,details jsonb,seeds jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare receipt private.admin_operation_receipts; signature text; result jsonb; bid uuid; pid uuid; parent public.business_pages; kind text;
begin
  if auth.uid() is null or not private.is_owner() then raise exception 'not authorized' using errcode='42501'; end if;
  if request_key is null or details is null or seeds is null or jsonb_typeof(details)<>'object' or jsonb_typeof(seeds)<>'array' then raise exception 'invalid creation' using errcode='22023'; end if;
  if jsonb_array_length(seeds) not between 1 and 20 or pg_column_size(seeds)>262144 or
    coalesce(details->>'slug','') !~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$' then raise exception 'invalid creation' using errcode='22023'; end if;
  kind:=case when details->>'parentId' is null then 'business' else 'branch' end;
  signature:=md5(jsonb_build_array(details,seeds)::text);
  perform pg_advisory_xact_lock(hashtextextended('admin-operation-'||auth.uid()::text||request_key::text,0));
  select * into receipt from private.admin_operation_receipts r where r.actor=auth.uid() and r.request_id=request_key;
  if found then
    if receipt.kind<>kind or receipt.fingerprint<>signature then raise exception 'request changed' using errcode='40001'; end if;
    return receipt.result;
  end if;
  if kind='business' then
    if coalesce(char_length(btrim(details->>'name')),0) not between 1 and 120 or
      coalesce(details->>'template','') not in ('cafe','retail','professional') then raise exception 'invalid business' using errcode='22023'; end if;
    insert into public.businesses(name,category) values(details->>'name',coalesce(nullif(details->>'category',''),'business')) returning id into bid;
    insert into public.business_pages(business_id,slug,template) values(bid,details->>'slug',details->>'template') returning id into pid;
  else
    select * into parent from public.business_pages where id=(details->>'parentId')::uuid and business_id=(details->>'businessId')::uuid for update;
    if not found then raise exception 'parent not found' using errcode='P0002'; end if;
    bid:=parent.business_id;
    if parent.page_type<>'main' or coalesce(char_length(btrim(details->>'branchName')),0) not between 1 and 100 then raise exception 'invalid branch name' using errcode='22023'; end if;
    insert into public.business_pages(business_id,parent_page_id,page_type,branch_name,slug,template)
    values(bid,parent.id,'branch',details->>'branchName',details->>'slug',parent.template) returning id into pid;
  end if;
  insert into public.page_sections(page_id,section_key,title,position,enabled,kind,content)
  select pid,s->>'kind',coalesce(s->>'title',''),(n-1)::smallint,coalesce((s->>'enabled')::boolean,true),s->>'kind',coalesce(s->'content','{}'::jsonb)
  from jsonb_array_elements(seeds) with ordinality t(s,n);
  result:=jsonb_build_object('ok',true,'businessId',bid,'pageId',pid);
  insert into private.admin_operation_receipts values(auth.uid(),request_key,kind,signature,result,now());
  insert into public.audit_logs(actor_id,action,entity_type,entity_id) values(auth.uid(),kind||'.create',kind,case when kind='business' then bid else pid end);
  return result;
end; $$;
create function public.create_admin_page(request_key uuid,details jsonb,seeds jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select private.create_admin_page(request_key,details,seeds); $$;
revoke all on function private.create_admin_page(uuid,jsonb,jsonb),public.create_admin_page(uuid,jsonb,jsonb) from public,anon;
grant execute on function private.create_admin_page(uuid,jsonb,jsonb),public.create_admin_page(uuid,jsonb,jsonb) to authenticated;
