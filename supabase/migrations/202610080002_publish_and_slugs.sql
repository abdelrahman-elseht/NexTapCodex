create table public.page_slug_aliases (
  alias_slug text primary key check (alias_slug ~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$'),
  page_id uuid not null references public.business_pages(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index page_slug_aliases_page_idx on public.page_slug_aliases(page_id);
alter table public.page_slug_aliases enable row level security;
create policy owner_slug_aliases_all on public.page_slug_aliases for all to authenticated
using(private.is_owner()) with check(private.is_owner());
grant select,insert,update,delete on public.page_slug_aliases to authenticated;

create or replace function private.remember_old_slug() returns trigger language plpgsql set search_path=''
as $$
begin
  if old.slug is distinct from new.slug then
    if exists(select 1 from public.business_pages where slug=new.slug and id<>old.id) then
      raise exception 'slug already in use';
    end if;
    insert into public.page_slug_aliases(alias_slug,page_id) values(old.slug,old.id)
    on conflict(alias_slug) do update set page_id=excluded.page_id;
  end if;
  return new;
end; $$;
create trigger remember_page_slug before update of slug on public.business_pages
for each row execute function private.remember_old_slug();

create or replace function private.get_published_page(page_slug text) returns jsonb
language sql stable security definer set search_path=''
as $$
  select pp.snapshot || jsonb_build_object('publicationId',pp.id,'version',pp.version)
  from public.business_pages bp
  join public.businesses b on b.id=bp.business_id and b.status='active'
  join public.page_publications pp on pp.id=bp.published_snapshot_id and pp.page_id=bp.id
  left join public.page_slug_aliases a on a.page_id=bp.id
  where (bp.slug=page_slug or a.alias_slug=page_slug) and bp.is_active
  limit 1;
$$;
revoke all on function private.remember_old_slug() from public,anon,authenticated;
