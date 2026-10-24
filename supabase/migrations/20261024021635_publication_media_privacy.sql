begin;
create table private.publication_media (
 publication_id uuid not null references public.page_publications(id) on delete restrict,
 storage_path text not null,
 primary key(publication_id,storage_path)
);
alter table private.publication_media enable row level security;
revoke all on private.publication_media from public,anon,authenticated;
-- Reverse lookup supports object authorization and deletion protection.
create index publication_media_path_idx on private.publication_media(storage_path,publication_id);

create function private.snapshot_media_paths(snapshot jsonb) returns setof text
language sql immutable security invoker set search_path='' as $$
 with sections as (select s from jsonb_array_elements(coalesce(snapshot->'sections','[]')) s where coalesce((s->>'enabled')::boolean,true)),
 urls as (
  select s->'content'->>key as value from sections cross join unnest(array['coverUrl','logoUrl','mapImageUrl','backgroundUrl']) key
  union all select item->>'url' from sections cross join lateral jsonb_array_elements(coalesce(s->'content'->'items','[]')) item
   where s->>'kind'='gallery' and coalesce((item->>'enabled')::boolean,true)
 ), paths as (
  select split_part(value,'/storage/v1/object/public/business-media/',2) path from urls
   where value ~ '^https?://[a-zA-Z0-9.:-]+/storage/v1/object/public/business-media/'
  union select snapshot#>>'{contact,photoPath}'
 ) select distinct path from paths where path ~ '^[a-fA-F0-9-]{36}/[a-fA-F0-9-]{36}/[a-fA-F0-9-]{36}([.]crop-[0-9]{1,4}-[0-9]{1,4}-[0-9]{4})?[.](webp|png|jpg|jpeg|contact[.]jpg)$';
$$;
revoke all on function private.snapshot_media_paths(jsonb) from public,anon,authenticated;

insert into private.publication_media(publication_id,storage_path)
select p.id,path from public.page_publications p join public.business_pages b on b.id=p.page_id
cross join lateral private.snapshot_media_paths(p.snapshot) path where split_part(path,'/',2)=b.business_id::text
on conflict do nothing;

create function private.register_publication_media() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not private.has_capability('publish') then raise exception 'not authorized' using errcode='42501'; end if;
 insert into private.publication_media(publication_id,storage_path)
 select new.id,path from private.snapshot_media_paths(new.snapshot) path
 join public.business_pages b on b.id=new.page_id and b.business_id::text=split_part(path,'/',2);
 return new;
end; $$;
revoke all on function private.register_publication_media() from public,anon,authenticated;
create trigger register_publication_media after insert on public.page_publications for each row execute function private.register_publication_media();

-- Narrow anonymous decision: only objects in the current active public snapshot.
create function private.is_published_media(object_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select length(object_path)<=250
 and coalesce(nullif(current_setting('request.jwt.claim.role',true),''),current_setting('role',true)) in ('anon','authenticated')
 and exists(select 1 from private.publication_media m
 join public.page_publications p on p.id=m.publication_id
 join public.business_pages bp on bp.id=p.page_id and bp.published_snapshot_id=p.id and bp.is_active
 join public.businesses b on b.id=bp.business_id and b.status='active'
 where m.storage_path=object_path and split_part(object_path,'/',2)=b.id::text);
$$;
create function private.is_retained_media(object_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.has_capability('read') and exists(select 1 from private.publication_media where storage_path=object_path);
$$;
revoke all on function private.is_published_media(text),private.is_retained_media(text) from public;
grant execute on function private.is_published_media(text) to anon,authenticated;
grant execute on function private.is_retained_media(text) to authenticated;

update storage.buckets set public=false where id='business-media';
drop policy public_read_business_media on storage.objects;
create policy publication_media_read on storage.objects for select to anon,authenticated
 using(bucket_id='business-media' and private.is_published_media(name));
create policy internal_media_read on storage.objects for select to authenticated
 using(bucket_id='business-media' and private.has_capability('read'));
alter policy owner_media_upload on storage.objects with check
 (bucket_id='business-media' and private.has_capability('media') and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.businesses b where b.id::text=(storage.foldername(name))[2]));
-- Managed originals and derivatives are write-once. Upload replacement uses a new UUID.
drop policy owner_media_update on storage.objects;
alter policy owner_media_delete on storage.objects using
 (bucket_id='business-media' and private.has_capability('media') and not private.is_retained_media(name));

create function private.protect_media_metadata() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='DELETE' then
  if private.is_retained_media(old.storage_path) or private.is_retained_media(old.contact_photo_path) then
   raise exception 'published media is retained' using errcode='23503';
  end if;
 end if;
 if tg_op='UPDATE' and (new.storage_path is distinct from old.storage_path or new.business_id is distinct from old.business_id) then
  raise exception 'media identity is immutable' using errcode='23514';
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
end; $$;
revoke all on function private.protect_media_metadata() from public,anon,authenticated;
create trigger protect_media_metadata before update or delete on public.media_assets for each row execute function private.protect_media_metadata();
notify pgrst, 'reload schema';
commit;
