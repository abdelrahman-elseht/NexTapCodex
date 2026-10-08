create sequence public.card_batch_code_seq start with 1;

alter table public.card_batches
  add column batch_code text,
  add column idempotency_key uuid;

with numbered as (
  select id, row_number() over (order by created_at, id) as n
  from public.card_batches
)
update public.card_batches b
set batch_code = 'BATCH-' || lpad(numbered.n::text, 3, '0')
from numbered
where b.id = numbered.id;

select setval(
  'public.card_batch_code_seq',
  greatest(coalesce((select max(regexp_replace(batch_code, '^BATCH-', '')::bigint) from public.card_batches), 0), 1),
  coalesce((select count(*) > 0 from public.card_batches), false)
);

alter table public.card_batches alter column batch_code set not null;
alter table public.card_batches add constraint card_batches_batch_code_key unique (batch_code);
alter table public.card_batches add constraint card_batches_idempotency_key_key unique (created_by, idempotency_key);
create or replace function public.create_card_batch(
  batch_name text,
  card_quantity integer,
  request_key uuid,
  card_tokens text[]
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  existing_batch public.card_batches;
  new_batch public.card_batches;
  daily_serial bigint;
  batch_number bigint;
  batch_day text := to_char(current_date, 'YYYYMMDD');
begin
  if actor is null or not private.is_owner() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if request_key is null then
    raise exception 'invalid batch request' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('batch-idempotency-' || actor::text || '-' || request_key::text, 0));
  select * into existing_batch
  from public.card_batches
  where created_by = actor and idempotency_key = request_key;
  if found then
    return to_jsonb(existing_batch) || jsonb_build_object('created', false);
  end if;

  if request_key is null
    or batch_name is null
    or char_length(btrim(batch_name)) not between 1 and 100
    or batch_name ~ '[[:cntrl:]]'
    or card_quantity is null
    or card_quantity not between 1 and 1000
    or card_tokens is null
    or cardinality(card_tokens) <> card_quantity
    or exists (
      select 1 from unnest(card_tokens) token
      where token !~ '^[A-Za-z0-9_-]{32,64}$'
    )
    or (select count(distinct token) from unnest(card_tokens) token) <> card_quantity
  then
    raise exception 'invalid batch request' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('nextap-card-serial-' || batch_day, 0));
  select coalesce(max(substring(serial from 13 for 6)::bigint), 0)
    into daily_serial
  from public.cards
  where serial like 'NT-' || batch_day || '-______';
  if daily_serial + card_quantity > 999999 then
    raise exception 'daily serial capacity exceeded' using errcode = '22023';
  end if;

  batch_number := nextval('public.card_batch_code_seq');
  insert into public.card_batches(name, quantity, created_by, batch_code, idempotency_key)
  values (btrim(batch_name), card_quantity, actor, 'BATCH-' || lpad(batch_number::text, 3, '0'), request_key)
  returning * into new_batch;

  insert into public.cards(batch_id, serial, token, status)
  select new_batch.id,
         'NT-' || batch_day || '-' || lpad((daily_serial + item.ordinality)::text, 6, '0'),
         item.token,
         'unassigned'
  from unnest(card_tokens) with ordinality as item(token, ordinality);

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (actor, 'cards.batch_create', 'card_batch', new_batch.id,
          jsonb_build_object('quantity', card_quantity, 'batchCode', new_batch.batch_code));

  return to_jsonb(new_batch) || jsonb_build_object('created', true);
end;
$$;

revoke all on function public.create_card_batch(text, integer, uuid, text[]) from public, anon;
grant execute on function public.create_card_batch(text, integer, uuid, text[]) to authenticated;

create or replace function private.keep_card_identifiers_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.serial is distinct from old.serial
    or new.token is distinct from old.token
    or new.batch_id is distinct from old.batch_id
  then
    raise exception 'card manufacturing identifiers are immutable' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function private.keep_card_identifiers_immutable() from public, anon, authenticated;
create trigger cards_keep_manufacturing_identifiers
before update on public.cards
for each row execute function private.keep_card_identifiers_immutable();

comment on column public.card_batches.batch_code is 'Stable manufacturing export identifier.';
comment on column public.card_batches.idempotency_key is 'Owner-scoped request key preventing duplicate batch creation.';
