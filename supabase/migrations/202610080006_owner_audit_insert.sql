create policy owner_audit_insert on public.audit_logs
for insert to authenticated
with check (private.is_owner() and actor_id=(select auth.uid()));
grant insert on public.audit_logs to authenticated;