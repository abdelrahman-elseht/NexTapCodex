-- Launch architecture security hardening.
-- Keep the authenticated owner card workflow while removing unused API surface.
revoke execute on function public.assign_card(uuid, uuid, text, text) from public, anon;

-- rls_auto_enable is an event-trigger handler present in the hosted project,
-- but not in every fresh local schema. Revoke its Data API surface when it exists.
do $$
declare
  handler oid := to_regprocedure('public.rls_auto_enable()');
begin
  if handler is not null then
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      handler::regprocedure
    );
  end if;
end
$$;
