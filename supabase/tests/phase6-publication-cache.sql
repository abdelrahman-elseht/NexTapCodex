-- Run against an isolated Supabase project after applying migrations.
-- The assertions cover live eligibility and restricted snapshot access.
do $$
begin
  if not has_function_privilege('anon','public.get_publication_snapshot(uuid)','EXECUTE') then
    raise exception 'anonymous snapshot RPC is required for cookie-free cache fills';
  end if;
  if not has_function_privilege('anon','public.get_publication_pointer(text)','EXECUTE') then
    raise exception 'anonymous pointer RPC is required';
  end if;
end $$;
