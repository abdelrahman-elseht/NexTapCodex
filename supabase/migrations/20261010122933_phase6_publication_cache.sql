-- Phase 6: immutable publication snapshots with a live eligibility check.
-- The pointer lookup remains uncached and is the only public cache key resolver.
create or replace function private.get_publication_pointer(page_slug text)
returns jsonb
language sql stable security definer set search_path=''
as $$
  select jsonb_build_object(
    'publicationId', pp.id,
    'version', pp.version,
    'slug', bp.slug,
    'isAlias', (a.alias_slug is not null and a.alias_slug <> bp.slug)
  )
  from public.business_pages bp
  join public.businesses b on b.id = bp.business_id and b.status = 'active'
  join public.page_publications pp on pp.id = bp.published_snapshot_id and pp.page_id = bp.id
  left join public.page_slug_aliases a on a.page_id = bp.id and a.alias_slug = page_slug
  where (bp.slug = page_slug or a.alias_slug = page_slug)
    and bp.is_active
  limit 1;
$$;

create or replace function public.get_publication_pointer(page_slug text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.get_publication_pointer(page_slug); $$;

-- Snapshot reads are keyed by the current pointer as well as the publication id.
-- This prevents an archived, disabled, or superseded page from warming a public cache.
create or replace function private.get_publication_snapshot(target_publication_id uuid)
returns jsonb
language sql stable security definer set search_path=''
as $$
  select pp.snapshot || jsonb_build_object('publicationId', pp.id, 'version', pp.version)
  from public.page_publications pp
  join public.business_pages bp on bp.id = pp.page_id and bp.published_snapshot_id = pp.id and bp.is_active
  join public.businesses b on b.id = bp.business_id and b.status = 'active'
  where pp.id = target_publication_id;
$$;

create or replace function public.get_publication_snapshot(target_publication_id uuid)
returns jsonb language sql security invoker set search_path=''
as $$ select private.get_publication_snapshot(target_publication_id); $$;

revoke all on function private.get_publication_pointer(text), private.get_publication_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.get_publication_pointer(text), public.get_publication_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.get_publication_pointer(text) to anon, authenticated;
grant execute on function public.get_publication_snapshot(uuid) to anon, authenticated;
