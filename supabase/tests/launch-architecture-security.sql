-- ACL contract for the launch security migration.
do $$
declare
  rls_handler oid := to_regprocedure('public.rls_auto_enable()');
begin
  if has_function_privilege('anon', 'public.assign_card(uuid,uuid,text,text)', 'EXECUTE') then
    raise exception 'anonymous assign_card execution remains granted';
  end if;
  if not has_function_privilege('authenticated', 'public.assign_card(uuid,uuid,text,text)', 'EXECUTE') then
    raise exception 'authenticated assign_card owner path was revoked';
  end if;
  if rls_handler is not null and (
    has_function_privilege('anon', rls_handler, 'EXECUTE')
    or has_function_privilege('authenticated', rls_handler, 'EXECUTE')
  ) then
    raise exception 'rls_auto_enable remains callable through the Data API';
  end if;
end
$$;
