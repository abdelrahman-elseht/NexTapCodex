begin;
-- Deployment operators approve individual Auth UUIDs; browser roles cannot admit users.
create table private.admin_admissions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('administrator','publisher','editor','inventory','auditor')),
  reason text not null check (length(trim(reason)) between 10 and 500),
  approved_at timestamptz not null default now(),
  unique(user_id,role)
);
alter table private.admin_admissions enable row level security;
revoke all on private.admin_admissions from public,anon,authenticated;
alter table public.owner_users add column admin_role text not null default 'administrator'
  check (admin_role in ('administrator','publisher','editor','inventory','auditor'));
insert into private.admin_admissions(user_id,role,reason)
select user_id,admin_role,'Existing internal administrator preserved by reviewed remediation migration' from public.owner_users;
alter table public.owner_users add constraint owner_users_approved_admission_fk
  foreign key(user_id,admin_role) references private.admin_admissions(user_id,role);
revoke insert,update,delete,truncate,references,trigger on public.owner_users from public,anon,authenticated;
comment on table public.owner_users is 'Trusted internal administrators with global business access, not business-isolated tenants. Admission requires a private deployment-operator approval.';

create function private.has_capability(capability text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (
   select 1 from public.owner_users u join private.admin_admissions a on (a.user_id,a.role)=(u.user_id,u.admin_role)
   where u.user_id=auth.uid() and case capability
     when 'read' then true
     when 'edit' then u.admin_role in ('administrator','publisher','editor')
     when 'media' then u.admin_role in ('administrator','publisher','editor')
     when 'publish' then u.admin_role in ('administrator','publisher')
     when 'inventory' then u.admin_role in ('administrator','inventory')
     when 'export' then u.admin_role in ('administrator','inventory')
     when 'delete' then u.admin_role='administrator'
     else false end);
$$;
revoke all on function private.has_capability(text) from public,anon;
grant execute on function private.has_capability(text) to authenticated;
create or replace function private.is_owner() returns boolean
language sql stable security definer set search_path='' as $$ select private.has_capability('read'); $$;
revoke all on function private.is_owner() from public,anon;
grant execute on function private.is_owner() to authenticated;

create function public.admin_has_capability(capability text) returns boolean
language sql stable security invoker set search_path='' as $$ select private.has_capability(capability); $$;
revoke all on function public.admin_has_capability(text) from public,anon;
grant execute on function public.admin_has_capability(text) to authenticated;

-- Triggers enforce permissions even when a SECURITY DEFINER RPC bypasses RLS.
create function private.enforce_admin_write() returns trigger
language plpgsql security invoker set search_path='' as $$
declare required text := tg_argv[0];
begin
  -- Direct deployment SQL without a JWT is a separate trusted operator boundary.
  if auth.uid() is null and coalesce(current_setting('role',true),'none') in ('none','postgres') then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_op='DELETE' and tg_table_name in ('cards','card_batches','card_assignment_history','businesses','business_pages') then required := 'delete'; end if;
  if tg_table_name='business_pages' and tg_op='UPDATE' then
    if new.is_active is distinct from old.is_active or new.published_snapshot_id is distinct from old.published_snapshot_id or new.published_version is distinct from old.published_version then required := 'publish'; end if;
  end if;
  if tg_table_name='businesses' and tg_op='UPDATE' then
    if new.status is distinct from old.status then required := 'publish'; end if;
  end if;
  if not private.has_capability(required) then raise exception 'not authorized' using errcode='42501'; end if;
  if tg_op='DELETE' then return old; else return new; end if;
end; $$;
revoke all on function private.enforce_admin_write() from public,anon,authenticated;
create trigger enforce_admin_write before insert or update or delete on public.businesses for each row execute function private.enforce_admin_write('edit');
create trigger enforce_admin_write before insert or update or delete on public.business_pages for each row execute function private.enforce_admin_write('edit');
create trigger enforce_admin_write before insert or update or delete on public.page_sections for each row execute function private.enforce_admin_write('edit');
create trigger enforce_admin_write before insert or update or delete on public.page_slug_aliases for each row execute function private.enforce_admin_write('edit');
create trigger enforce_admin_write before insert on public.page_publications for each row execute function private.enforce_admin_write('publish');
create trigger enforce_admin_write before insert or update or delete on public.cards for each row execute function private.enforce_admin_write('inventory');
create trigger enforce_admin_write before insert or update or delete on public.card_batches for each row execute function private.enforce_admin_write('inventory');
create trigger enforce_admin_write before insert or update or delete on public.card_assignment_history for each row execute function private.enforce_admin_write('inventory');
create trigger enforce_admin_write before insert or update or delete on public.media_assets for each row execute function private.enforce_admin_write('media');

-- Restrictive policies intersect existing owner policies; reads remain global.
create policy admin_business_write on public.businesses as restrictive for all to authenticated
using (private.has_capability('read')) with check (private.has_capability('edit'));
create policy admin_page_write on public.business_pages as restrictive for all to authenticated
using (private.has_capability('read')) with check (private.has_capability('edit'));
create policy admin_section_write on public.page_sections as restrictive for all to authenticated
using (private.has_capability('read')) with check (private.has_capability('edit'));
create policy admin_media_write on public.media_assets as restrictive for all to authenticated
using (private.has_capability('read')) with check (private.has_capability('media'));

-- Preserve the reviewed transaction bodies and signatures while strengthening
-- their existing actor guard, including receipt replay and preview-only paths.
do $$ declare f record; definition text; required text; begin
 for f in select p.oid,p.proname,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='private' and p.proname in ('save_page_draft','publish_page','assign_card','assign_card_once','create_card_batch','create_admin_page','preview_card_deletion','commit_card_deletion','update_business_page'))
    or (n.nspname='public' and p.proname='save_contact_draft') loop
   required := case when f.proname='publish_page' then 'publish' when f.proname in ('preview_card_deletion','commit_card_deletion') then 'delete'
     when f.proname in ('assign_card','assign_card_once','create_card_batch') then 'inventory' else 'edit' end;
   definition := pg_get_functiondef(f.oid);
   if position('not private.is_owner()' in definition)>0 then
     execute replace(definition,'not private.is_owner()',format('not private.has_capability(%L)',required));
   elsif f.proname not in ('save_page_draft') then
     raise exception 'Expected actor guard absent: %.%',f.nspname,f.proname;
   end if;
 end loop;
end; $$;

alter policy owner_media_upload on storage.objects with check
 (bucket_id='business-media' and private.has_capability('media') and (storage.foldername(name))[1]=(select auth.uid())::text);
alter policy owner_media_update on storage.objects using
 (bucket_id='business-media' and private.has_capability('media') and (storage.foldername(name))[1]=(select auth.uid())::text) with check
 (bucket_id='business-media' and private.has_capability('media') and (storage.foldername(name))[1]=(select auth.uid())::text);
alter policy owner_media_delete on storage.objects using
 (bucket_id='business-media' and private.has_capability('media') and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Read-only RPCs must also enforce their operation capability.
create or replace function public.card_batch_snapshot(target_batch uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('batch',to_jsonb(b),'cards',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'serial',c.serial,'token',c.token,'status',c.status) order by c.serial) from public.cards c where c.batch_id=b.id),'[]'::jsonb))
 from public.card_batches b where b.id=target_batch and private.has_capability('export');
$$;
revoke all on function public.card_batch_snapshot(uuid) from public,anon;
grant execute on function public.card_batch_snapshot(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
