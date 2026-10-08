create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.owner_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  category text not null default 'business' check (char_length(category) <= 80),
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.business_pages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  parent_page_id uuid references public.business_pages(id) on delete set null,
  page_type text not null default 'main' check (page_type in ('main','branch')),
  branch_name text,
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$'),
  template text not null default 'professional' check (template in ('cafe','retail','professional')),
  is_active boolean not null default false,
  published_version bigint not null default 0,
  published_snapshot_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((page_type = 'main' and parent_page_id is null) or (page_type = 'branch' and branch_name is not null)),
  unique (business_id, page_type, branch_name)
);
create table public.page_sections (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.business_pages(id) on delete cascade,
  section_key text not null check (section_key ~ '^[a-z][a-z0-9_]{0,39}$'),
  title text not null default '', position smallint not null check (position >= 0),
  enabled boolean not null default true,
  kind text not null check (kind in ('hero','about','hours','contact','social','payments','links','services','gallery','reviews','branch')),
  content jsonb not null default '{}'::jsonb check (pg_column_size(content) <= 65536),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (page_id, section_key), unique (page_id, position)
);
create table public.page_publications (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.business_pages(id) on delete cascade,
  version bigint not null, snapshot jsonb not null check (pg_column_size(snapshot) <= 262144),
  published_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  unique (page_id, version)
);
alter table public.business_pages add constraint business_pages_published_fk
  foreign key (published_snapshot_id) references public.page_publications(id) on delete set null;
create table public.card_batches (
  id uuid primary key default gen_random_uuid(), name text not null check (char_length(name) between 1 and 100),
  quantity integer not null check (quantity between 1 and 10000),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.card_batches(id) on delete restrict,
  serial text not null unique check (serial ~ '^NT-[0-9]{8}-[0-9]{6}$'),
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{32,64}$'),
  page_id uuid references public.business_pages(id) on delete set null,
  status text not null default 'unassigned' check (status in ('unassigned','active','disabled','replaced')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((status = 'active' and page_id is not null) or status <> 'active')
);
create table public.card_assignment_history (
  id bigint generated always as identity primary key,
  card_id uuid not null references public.cards(id) on delete restrict,
  old_page_id uuid references public.business_pages(id) on delete set null,
  new_page_id uuid references public.business_pages(id) on delete set null,
  old_status text not null, new_status text not null,
  changed_by uuid not null references auth.users(id),
  reason text not null default 'assignment' check (reason in ('assignment','activation','deactivation','reassignment','replacement')),
  created_at timestamptz not null default now()
);
create table public.media_assets (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  storage_path text not null unique check (storage_path !~ '(^/|\\.\\.)'),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  alt_text text not null default '' check (char_length(alt_text) <= 200), created_at timestamptz not null default now()
);
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  action text not null check (char_length(action) between 1 and 80),
  entity_type text not null check (char_length(entity_type) between 1 and 80),
  entity_id uuid, details jsonb not null default '{}'::jsonb check (pg_column_size(details) <= 8192),
  created_at timestamptz not null default now()
);
create index business_pages_business_idx on public.business_pages(business_id);
create index business_pages_published_idx on public.business_pages(slug) where is_active and published_snapshot_id is not null;
create index page_sections_order_idx on public.page_sections(page_id,position);
create index page_publications_latest_idx on public.page_publications(page_id,version desc);
create index cards_page_status_idx on public.cards(page_id,status);
create index cards_batch_idx on public.cards(batch_id,created_at);
create index card_history_card_created_idx on public.card_assignment_history(card_id,created_at desc);
create index audit_logs_created_idx on public.audit_logs(created_at desc);

create or replace function private.is_owner() returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.owner_users where user_id=(select auth.uid())); $$;
create or replace function private.get_published_page(page_slug text) returns jsonb language sql stable security definer set search_path=''
as $$ select pp.snapshot || jsonb_build_object('publicationId',pp.id,'version',pp.version)
from public.business_pages bp join public.businesses b on b.id=bp.business_id and b.status='active'
join public.page_publications pp on pp.id=bp.published_snapshot_id and pp.page_id=bp.id
where bp.slug=page_slug and bp.is_active limit 1; $$;
create or replace function private.resolve_card(card_token text) returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare c record;
begin
 select cards.status,business_pages.slug,business_pages.is_active,businesses.status as business_status,business_pages.published_snapshot_id
 into c from public.cards left join public.business_pages on business_pages.id=cards.page_id
 left join public.businesses on businesses.id=business_pages.business_id where cards.token=card_token;
 if not found then return jsonb_build_object('state','invalid'); end if;
 if c.status='unassigned' then return jsonb_build_object('state','unassigned'); end if;
 if c.status<>'active' or not coalesce(c.is_active,false) or c.business_status<>'active' or c.published_snapshot_id is null
 then return jsonb_build_object('state','inactive'); end if;
 return jsonb_build_object('state','active','slug',c.slug);
end; $$;
create or replace function private.assign_card(card_id uuid,target_page_id uuid,next_status text,change_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare c public.cards; actor uuid := (select auth.uid());
begin
 if actor is null or not private.is_owner() then raise exception 'not authorized' using errcode='42501'; end if;
 if next_status not in ('unassigned','active','disabled','replaced') then raise exception 'invalid status'; end if;
 if next_status='active' and target_page_id is null then raise exception 'active cards require a page'; end if;
 if next_status='active' and not exists(select 1 from public.business_pages bp join public.businesses b on b.id=bp.business_id
 where bp.id=target_page_id and bp.is_active and bp.published_snapshot_id is not null and b.status='active')
 then raise exception 'target page must be published and active'; end if;
 select * into c from public.cards where id=card_id for update;
 if not found then raise exception 'card not found'; end if;
 update public.cards set page_id=target_page_id,status=next_status,updated_at=now() where id=card_id;
 insert into public.card_assignment_history(card_id,old_page_id,new_page_id,old_status,new_status,changed_by,reason)
 values(c.id,c.page_id,target_page_id,c.status,next_status,actor,change_reason);
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
 values(actor,'card.'||change_reason,'card',c.id,jsonb_build_object('fromStatus',c.status,'toStatus',next_status));
 return jsonb_build_object('ok',true);
end; $$;
create or replace function public.get_published_page(page_slug text) returns jsonb language sql stable security invoker set search_path=''
as $$ select private.get_published_page(page_slug); $$;
create or replace function public.resolve_card(card_token text) returns jsonb language sql stable security invoker set search_path=''
as $$ select private.resolve_card(card_token); $$;
create or replace function public.assign_card(card_id uuid,target_page_id uuid,next_status text,change_reason text)
returns jsonb language sql security invoker set search_path='' as $$ select private.assign_card(card_id,target_page_id,next_status,change_reason); $$;
revoke all on function private.is_owner() from public,anon;
revoke all on function private.get_published_page(text),private.resolve_card(text),private.assign_card(uuid,uuid,text,text) from public;
grant usage on schema private to anon,authenticated;
grant execute on function private.get_published_page(text),private.resolve_card(text) to anon,authenticated;
grant execute on function private.is_owner(),private.assign_card(uuid,uuid,text,text) to authenticated;
revoke all on function public.get_published_page(text),public.resolve_card(text),public.assign_card(uuid,uuid,text,text) from public;
grant execute on function public.get_published_page(text),public.resolve_card(text) to anon,authenticated;
grant execute on function public.assign_card(uuid,uuid,text,text) to authenticated;

alter table public.owner_users enable row level security;
alter table public.businesses enable row level security;
alter table public.business_pages enable row level security;
alter table public.page_sections enable row level security;
alter table public.page_publications enable row level security;
alter table public.card_batches enable row level security;
alter table public.cards enable row level security;
alter table public.card_assignment_history enable row level security;
alter table public.media_assets enable row level security;
alter table public.audit_logs enable row level security;
create policy owner_users_read_self on public.owner_users for select to authenticated using(user_id=(select auth.uid()));
create policy owner_businesses_all on public.businesses for all to authenticated using(private.is_owner()) with check(private.is_owner());
create policy owner_pages_all on public.business_pages for all to authenticated using(private.is_owner()) with check(private.is_owner());
create policy owner_sections_all on public.page_sections for all to authenticated using(private.is_owner()) with check(private.is_owner());
create policy owner_publications_read on public.page_publications for select to authenticated using(private.is_owner());
create policy owner_publications_insert on public.page_publications for insert to authenticated with check(private.is_owner() and published_by=(select auth.uid()));
create policy owner_batches_all on public.card_batches for all to authenticated using(private.is_owner()) with check(private.is_owner() and created_by=(select auth.uid()));
create policy owner_cards_all on public.cards for all to authenticated using(private.is_owner()) with check(private.is_owner());
create policy owner_history_read on public.card_assignment_history for select to authenticated using(private.is_owner());
create policy owner_media_all on public.media_assets for all to authenticated using(private.is_owner()) with check(private.is_owner());
create policy owner_audit_read on public.audit_logs for select to authenticated using(private.is_owner());
revoke all on all tables in schema public from anon,authenticated;
revoke all on all sequences in schema public from anon,authenticated;
grant select on public.owner_users to authenticated;
grant select,insert,update,delete on public.businesses,public.business_pages,public.page_sections to authenticated;
grant select,insert on public.page_publications to authenticated;
grant select,insert,update,delete on public.card_batches,public.cards,public.media_assets to authenticated;
grant select on public.card_assignment_history,public.audit_logs to authenticated;
grant usage,select on all sequences in schema public to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('business-media','business-media',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy owner_media_upload on storage.objects for insert to authenticated
with check(bucket_id='business-media' and private.is_owner() and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy owner_media_update on storage.objects for update to authenticated
using(bucket_id='business-media' and private.is_owner() and (storage.foldername(name))[1]=(select auth.uid())::text)
with check(bucket_id='business-media' and private.is_owner() and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy owner_media_delete on storage.objects for delete to authenticated
using(bucket_id='business-media' and private.is_owner() and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy public_read_business_media on storage.objects for select to anon,authenticated using(bucket_id='business-media');
comment on table public.owner_users is 'Owner authorization allowlist; administrator-managed.';
comment on table public.page_publications is 'Immutable snapshots; draft edits never mutate earlier published versions.';
comment on table public.cards is 'Private physical inventory; public resolution uses a narrow RPC.';
