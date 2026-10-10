-- Forward-only repair for fresh installs and environments with the earlier
-- Phase 5 constraint repair. Preserve every row, section id, and RPC contract.
begin;

-- ON CONFLICT(page_id,section_key) requires a non-deferrable arbiter.
-- The position constraint remains deferrable so incremental swaps stay atomic.
do $$
declare key_constraint record;
begin
  for key_constraint in
    select c.conname from pg_constraint c
    where c.conrelid = 'public.page_sections'::regclass
      and c.contype = 'u' and c.condeferrable
      and (select array_agg(a.attname::text order by k.ordinality)
           from unnest(c.conkey) with ordinality k(attnum, ordinality)
           join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum)
          = array['page_id','section_key']
  loop
    execute format('alter table public.page_sections drop constraint %I', key_constraint.conname);
    execute format('alter table public.page_sections add constraint %I unique (page_id,section_key) not deferrable', key_constraint.conname);
  end loop;
end $$;

-- Public SECURITY INVOKER wrappers need permission to call these specific
-- private, read-only functions. The private schema must remain outside the API.
grant execute on function private.get_publication_pointer(text) to anon, authenticated;
grant execute on function private.get_publication_snapshot(uuid) to anon, authenticated;

commit;
