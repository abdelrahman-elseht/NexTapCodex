-- Public card resolver contract: unassigned cards expose only state and printed serial.
do $$
declare
  definition text := pg_get_functiondef('private.resolve_card(text)'::regprocedure);
begin
  if position('jsonb_build_object(''state'',''unassigned'',''serial'',c.serial)' in definition) = 0 then
    raise exception 'resolve_card unassigned result does not include only the serial';
  end if;
  if has_function_privilege('anon', 'public.resolve_card(text)', 'EXECUTE') = false
     or has_function_privilege('authenticated', 'public.resolve_card(text)', 'EXECUTE') = false then
    raise exception 'public resolver grants changed';
  end if;
  if has_function_privilege('anon', 'private.assign_card(uuid,uuid,text,text)', 'EXECUTE') then
    raise exception 'anonymous assignment execution remains granted';
  end if;
end
$$;
